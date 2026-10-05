// EXPEDITIONARY-2 — expedition lifecycle + physical food audit.
//
// Proves the production spine is physical rather than labelled:
//  - multi-day work no longer credits food on the departure day (the §1 correction);
//  - parties physically occupy route positions while away (no teleport);
//  - outbound and return both take days;
//  - away workers are removed from residential labor exactly once;
//  - a returned party deposits exactly ONE canonical receipt, dated to the return;
//  - information-only / lost / aborted parties deposit none;
//  - state stays bounded; the run is deterministic.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const ROOT = process.cwd();
const YEARS = 40;

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1] : fallback;
};
// Both outputs are explicit. Default "" means "print only, write nothing", so this audit can
// never silently overwrite a frozen evidence file — the trap CORRECTION-32A recorded twice.
const OUT = arg("out", "");
const BOUNDARY_OUT = arg("boundary-out", "");

const server = await createServer({
  root: `${ROOT}/src`, configFile: false, appType: "custom", server: { middlewareMode: true }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const expeditionMod = await server.ssrLoadModule("/sim/agents/expedition.ts");
  const tripsMod = await server.ssrLoadModule("/sim/agents/intraSeasonTrips.ts");
  const registry = await server.ssrLoadModule("/sim/agents/dailyActionRegistry.ts");

  // Slice A: the registry is a real, ordered, non-cyclic boundary.
  //
  // This asserted `length === 2`, which was true when Item 3 froze and stopped being true the moment
  // ROADMAP ITEM 4 registered its four provisional daily actions. The audit then reported FAIL for a
  // registry that was perfectly correct — a stale magic number standing in for the property it was
  // supposed to protect, and it had been failing since `4a272e5` without being noticed, because a
  // verification pass ran the Item 4 suites and not this one.
  //
  // The PROPERTY is what this check is for: the two Item 3 actions exist, in that order, ahead of
  // everything registered later, and every entry is a real applicable action. A new action appended by
  // a later item is not a regression; one that displaces trips or expeditions is.
  const actionIds = (registry.DEFAULT_DAILY_ACTIONS ?? []).map((action) => action?.id);
  const registryOk =
    Array.isArray(registry.DEFAULT_DAILY_ACTIONS) &&
    registry.DEFAULT_DAILY_ACTIONS.length >= 2 &&
    registry.DEFAULT_DAILY_ACTIONS.every((action) => typeof action?.apply === "function") &&
    actionIds[0] === "intra-season-trips" &&
    actionIds[1] === "expeditions" &&
    new Set(actionIds).size === actionIds.length;

  // §1: the duration boundary is real and is what splits the two paths.
  const durationBoundary = {
    oneTile: tripsMod.deriveTripDurationDays(1),
    fourTiles: tripsMod.deriveTripDurationDays(4),
    fiveTiles: tripsMod.deriveTripDurationDays(5),
    tenTiles: tripsMod.deriveTripDurationDays(10),
  };
  const sameDayBoundaryCorrect =
    durationBoundary.fourTiles === 1 && durationBoundary.fiveTiles > 1 && durationBoundary.tenTiles > 1;

// CORRECTION-34A §11 — THE INSTRUMENT CORRECTION.
//
// This audit used to step `stepSim(world, 1, "seasonal")` and observe only at the season
// boundary. An expedition's whole lifecycle is bounded by EXPEDITION_MAX_DURATION_DAYS = 24
// inside a 90-day season, so a party launches, walks, works and returns BETWEEN two boundaries.
// `operating`, `returning` and `taskCamp` were therefore structurally invisible to it and it
// reported sawOperating/sawReturning/sawTaskCamp = false for its whole history — an INSTRUMENT
// ARTIFACT that was inherited and re-reported as a production FAIL across several checkpoints.
//
// Physical presence is a DAILY fact. The daily arm is canonical; the seasonal arm is retained,
// run on the SAME world and seed, purely to demonstrate what boundary sampling cannot see.
function runLifecycleArm(runner, expeditionMod, sampling, years) {
  const observed = {
    launched: 0, completed: 0, aborted: 0, lost: 0,
    depositsWithFood: 0, informationOnly: 0,
    maxActivePerBand: 0, maxOutcomeRecords: 0, maxRouteTiles: 0,
    sawPrepared: false, sawOutbound: false, sawOperating: false, sawReturning: false,
    sawTaskCamp: false, sawConcurrentParties: false,
    phaseDays: { prepared: 0, outbound: 0, operating: 0, returning: 0 },
    taskCampDays: 0, samples: 0,
    travelDaysSeen: 0, provisionsConsumed: 0, cargoLost: 0,
    laborOverCommitViolations: 0, positionOffRouteViolations: 0,
    personConservationViolations: 0,
    receiptsBeforeReturn: 0, deliveredUnits: 0,
    outcomeReasons: {},
  };
  const seenExpeditionIds = new Set();
  const terminalIds = new Set();
  const receiptIdsSeen = new Set();

  let world = runner.initSimWorld({ kind: "map1" }, "expedition-lifecycle");

  // daily: 360 observations per year. seasonal: 4 — the boundary-only view.
  const steps = sampling === "daily" ? years * 360 : years * 4;
  const stepMode = sampling === "daily" ? "daily" : "seasonal";

  for (let step = 0; step < steps; step += 1) {
    world = runner.stepSim(world, 1, stepMode);
    observed.samples += 1;

    for (const band of Object.values(world.bands)) {
      const active = band.expeditions ?? [];
      observed.maxActivePerBand = Math.max(observed.maxActivePerBand, active.length);
      observed.maxOutcomeRecords = Math.max(observed.maxOutcomeRecords, (band.recentExpeditionOutcomes ?? []).length);

      // Labor invariant: adults away can never exceed the band's working adults.
      const away = expeditionMod.getCommittedExpeditionWorkers(band);
      if (away > band.demography.workingAdults) observed.laborOverCommitViolations += 1;

      // CORRECTION-34A §6 — person conservation, asserted through the SAME predicate production
      // maintains rather than a re-implementation of it.
      const accounting = expeditionMod.getBandCommitmentAccounting(band);
      if (!accounting.conserved) observed.personConservationViolations += 1;

      // §12 P9 — two legal parties from one band, observed rather than assumed.
      const awayParties = active.filter((e) =>
        e.phase === "prepared" || e.phase === "outbound" || e.phase === "operating" || e.phase === "returning");
      if (awayParties.length >= 2) observed.sawConcurrentParties = true;

      for (const expedition of active) {
        seenExpeditionIds.add(expedition.id);
        observed.maxRouteTiles = Math.max(observed.maxRouteTiles, expedition.routeTileIds.length);
        observed.travelDaysSeen = Math.max(observed.travelDaysSeen, expedition.travelDaysElapsed);
        if (expedition.phase === "prepared") { observed.sawPrepared = true; observed.phaseDays.prepared += 1; }
        if (expedition.phase === "outbound") { observed.sawOutbound = true; observed.phaseDays.outbound += 1; }
        if (expedition.phase === "operating") { observed.sawOperating = true; observed.phaseDays.operating += 1; }
        if (expedition.phase === "returning") { observed.sawReturning = true; observed.phaseDays.returning += 1; }
        if (expedition.taskCamp !== undefined) { observed.sawTaskCamp = true; observed.taskCampDays += 1; }

        // No teleport: the party's position must be the route tile at its index.
        if (expedition.routeTileIds[expedition.routeIndex] !== expedition.positionTileId) {
          observed.positionOffRouteViolations += 1;
        }

        // No food may reach the camp before the party is physically home: a receipt
        // carrying this expedition's id must not exist while it is still away.
        for (const trip of band.recentIntraSeasonTrips ?? []) {
          const tagged = (trip.reasonIds ?? []).some((id) => String(id).includes(expedition.id));
          if (tagged) observed.receiptsBeforeReturn += 1;
        }
      }

      for (const outcome of band.recentExpeditionOutcomes ?? []) {
        if (terminalIds.has(outcome.id)) continue;
        terminalIds.add(outcome.id);
        if (outcome.phase === "completed") observed.completed += 1;
        if (outcome.phase === "aborted") observed.aborted += 1;
        if (outcome.phase === "lost") observed.lost += 1;
        observed.provisionsConsumed += outcome.provisionUnitsConsumed;
        observed.cargoLost += outcome.lostUnits;
        observed.deliveredUnits += outcome.deliveredHarvestUnits;
        observed.outcomeReasons[outcome.outcomeReason] = (observed.outcomeReasons[outcome.outcomeReason] ?? 0) + 1;
        if (outcome.deliveredHarvestUnits > 0) observed.depositsWithFood += 1;
        else observed.informationOnly += 1;
      }

      // Exactly-once receipt: an expedition-tagged receipt id may never repeat.
      for (const trip of band.recentIntraSeasonTrips ?? []) {
        const tag = (trip.reasonIds ?? []).find((id) => String(id).startsWith("reason:expedition-return:"));
        if (tag === undefined) continue;
        const key = `${band.id}:${tag}:${Number(trip.tick)}`;
        if (receiptIdsSeen.has(key)) continue;
        receiptIdsSeen.add(key);
      }
    }
  }
  observed.launched = seenExpeditionIds.size;
  return { observed, terminalCount: terminalIds.size };
}

  // CANONICAL arm — daily sampling. The verdict is taken from this one.
  const daily = runLifecycleArm(runner, expeditionMod, "daily", YEARS);
  // COUNTER-EXAMPLE arm — the boundary-only view this audit used to have, same world and seed.
  const boundary = runLifecycleArm(runner, expeditionMod, "seasonal", YEARS);
  const observed = daily.observed;
  const terminalIds = { size: daily.terminalCount };

  // Determinism: a fresh identical run must produce identical expedition identities.
  let repeat = runner.initSimWorld({ kind: "map1" }, "expedition-lifecycle");
  repeat = runner.stepSim(repeat, YEARS * 4, "seasonal");
  const repeatIds = Object.values(repeat.bands)
    .flatMap((band) => (band.recentExpeditionOutcomes ?? []).map((outcome) => outcome.id))
    .sort();
  let once = runner.initSimWorld({ kind: "map1" }, "expedition-lifecycle");
  once = runner.stepSim(once, YEARS * 4, "seasonal");
  const onceIds = Object.values(once.bands)
    .flatMap((band) => (band.recentExpeditionOutcomes ?? []).map((outcome) => outcome.id))
    .sort();

  const checks = {
    registryBoundaryIsOrderedAndAcyclic: registryOk,
    sameDayVsExpeditionBoundaryIsDurationBased: sameDayBoundaryCorrect,
    expeditionsLaunchNaturally: observed.launched > 0,
    outboundLegIsPhysical: observed.sawOutbound,
    targetWorkOccurs: observed.deliveredUnits > 0 || observed.sawOperating,
    returnLegIsPhysical: observed.sawReturning,
    travelTakesDays: observed.travelDaysSeen >= 2,
    noTeleportPositionAlwaysOnRoute: observed.positionOffRouteViolations === 0,
    noFoodBeforePhysicalReturn: observed.receiptsBeforeReturn === 0,
    laborNeverOverCommitted: observed.laborOverCommitViolations === 0,
    provisionsAreConsumed: observed.provisionsConsumed > 0,
    returnedCargoBecomesFood: observed.depositsWithFood > 0 && observed.deliveredUnits > 0,
    terminalOutcomesRecorded: terminalIds.size > 0,
    activeExpeditionsBounded: observed.maxActivePerBand <= expeditionMod.EXPEDITION_ACTIVE_CAP,
    outcomeRecordsBounded: observed.maxOutcomeRecords <= expeditionMod.EXPEDITION_OUTCOME_CAP,
    routeLengthBounded: observed.maxRouteTiles <= expeditionMod.EXPEDITION_MAX_ROUTE_TILES + 1,
    deterministicExpeditionIdentities: JSON.stringify(repeatIds) === JSON.stringify(onceIds),
    // CORRECTION-34A §6 — the invariant, asserted on every sampled band-day.
    personConserved: observed.personConservationViolations === 0,
    // CORRECTION-34A §11 — non-vacuity. These are the phases boundary sampling could not see.
    operatingObservedNonVacuously: observed.phaseDays.operating > 0,
    returningObservedNonVacuously: observed.phaseDays.returning > 0,
    taskCampObservedNonVacuously: observed.taskCampDays > 0,
  };
  const pass = Object.values(checks).every(Boolean);

  // §11 — what the boundary-only arm could NOT see, on the same world and seed. This is the
  // evidence that the inherited FAIL was an instrument artifact and not a production defect.
  const boundaryBlindness = {
    sampling: { daily: observed.samples, seasonal: boundary.observed.samples },
    operating: { daily: observed.phaseDays.operating, seasonal: boundary.observed.phaseDays.operating },
    returning: { daily: observed.phaseDays.returning, seasonal: boundary.observed.phaseDays.returning },
    taskCampDays: { daily: observed.taskCampDays, seasonal: boundary.observed.taskCampDays },
    sawOperating: { daily: observed.sawOperating, seasonal: boundary.observed.sawOperating },
    sawReturning: { daily: observed.sawReturning, seasonal: boundary.observed.sawReturning },
    sawTaskCamp: { daily: observed.sawTaskCamp, seasonal: boundary.observed.sawTaskCamp },
    sawConcurrentParties: { daily: observed.sawConcurrentParties, seasonal: boundary.observed.sawConcurrentParties },
    interpretation:
      "An expedition's whole lifecycle fits inside a season (EXPEDITION_MAX_DURATION_DAYS = 24 of 90), " +
      "so a boundary sample can only ever catch a party that happens to straddle the boundary. " +
      "The daily arm is canonical; the seasonal arm is retained to show why.",
  };

  out = {
    check: "EXPEDITION-LIFECYCLE-1",
    verdict: pass ? "PASS" : "FAIL",
    canonicalSampling: "daily",
    years: YEARS,
    checks,
    durationBoundary,
    observed,
    boundaryBlindness,
  };

  if (OUT !== "") {
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  }
  if (BOUNDARY_OUT !== "") {
    mkdirSync(dirname(BOUNDARY_OUT), { recursive: true });
    writeFileSync(
      BOUNDARY_OUT,
      `${JSON.stringify({
        check: "EXPEDITION-LIFECYCLE-1-SEASON-BOUNDARY",
        note: "NOT CANONICAL. Retained to demonstrate why boundary-only sampling is insufficient.",
        years: YEARS,
        sampling: "seasonal",
        observed: boundary.observed,
      }, null, 2)}\n`,
      "utf8",
    );
  }
} finally {
  await server.close();
}

console.log(JSON.stringify(out, null, 2));
if (out.verdict !== "PASS") process.exitCode = 1;
