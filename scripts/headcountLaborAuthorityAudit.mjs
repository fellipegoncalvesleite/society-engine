// CORRECTION-34D §3 — reproduce the headcount/labour split on the state CORRECTION-34C accepts.
//
// Constructs the exact controlled state CORRECTION-34C's L1/L9 accept as valid:
//   population 20, workingAdults 5, elders 7, dependents 8, one operating party of 6.
// and reads EVERY authority §3 names, through production functions wherever they are exported.
// Where a reader is module-private (`getBandForagingDraw`, `estimateTaskGroupPeople`) the audit
// reproduces its published arithmetic and SAYS SO rather than pretending to call it.
//
// This audit is arm-neutral: it runs identically before and after the repair. `--phase` only
// labels the output file.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/shared-use-physical-presence-authority-34";
const PHASE = arg("phase", "before");
const OUT = arg("out", `${EVIDENCE}/headcount-labor-${PHASE}.json`);

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c34d-hl-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const expedition = await server.ssrLoadModule("/sim/agents/expedition.ts");
  const crowding = await server.ssrLoadModule("/sim/agents/crowding.ts");
  const mobility = await server.ssrLoadModule("/sim/agents/bandMobility.ts");

  let world = runner.initSimWorld({ kind: "map2" }, "c34c:fixtures");
  world = advance.advanceWorldByDays(world, 360 * 2);
  const base = Object.values(world.bands)
    .filter((b) => b.status !== "dispersed" && b.viability?.status !== "absorbed" && b.viability?.status !== "extinct")
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];
  const tick = Number(world.time.tick);
  const t1 = (world.tiles[base.position]?.neighbors ?? [])[0] ?? base.position;

  // The exact CORRECTION-34C accepted state.
  const party = {
    id: "e:d", phase: "operating", partyWorkers: 6,
    partyComposition: { limited: 1, typical: 4, high: 1 },
    positionTileId: t1, routeTileIds: [base.position, t1], routeIndex: 1,
    taskKind: "resource_retrieval", injuryLoad: 0, travelDaysElapsed: 2, workDaysElapsed: 0,
    hardDeadlineDay: 9999,
    cargo: {
      harvestUnits: 0,
      carryCapacityUnits: expedition.deriveCarryCapacityUnits(base, 6, 0, tick),
      provisionUnitsConsumed: 0, lostUnits: 0,
    },
  };
  const band = {
    ...base,
    demography: { ...base.demography, population: 20, workingAdults: 5, elders: 7, dependents: 8 },
    expeditions: [party],
  };

  // Provisions: expedition.ts consumeProvisions / provisionsExhausted (module-private, published
  // arithmetic — the constant itself is exported).
  const RATE = expedition.EXPEDITION_PROVISION_UNITS_PER_WORKER_DAY;
  const MAX_DAYS = expedition.EXPEDITION_MAX_DURATION_DAYS;
  const AWAY_PHASES = ["prepared", "outbound", "operating", "returning"];

  // ── Every authority §3 names, read off one band ─────────────────────────────────────────────
  const measure = (b) => {
    const presence = crowding.getBandPhysicalPresence(b);
    const awayPresence = presence.filter((s) => s.kind === "away_party");
    const homePresence = presence.find((s) => s.kind === "residential_remainder");
    const e = b.expeditions[0];
    const nonWorking = Math.max(0, e.nonWorkingPartyPeople ?? 0);

    const committedPools = mobility.deriveCommittedMobilityPools(b);
    const availablePools = mobility.deriveAvailableMobilityPools(b);
    // `derivePartyPaceFactor` gained an optional second argument in this checkpoint; passing it on
    // the BEFORE arm is harmless (extra arguments are ignored) so both arms run one expression.
    const paceFactor = mobility.derivePartyPaceFactor(e.partyComposition, nonWorking);
    const pace = mobility.deriveTravelPace(b, "resource_expedition", {
      loadRatio: 0, urgency: 0, injuryLoad: 0,
      partyComposition: e.partyComposition, nonWorkingPartyPeople: nonWorking,
    });

    const physicalAwayHeadcount = awayPresence.reduce((n, s) => n + s.people, 0);
    const productivePartyWorkers = e.partyComposition === undefined
      ? e.partyWorkers : mobility.partyCompositionTotal(e.partyComposition);
    const physicalPartyPeople = e.partyWorkers + nonWorking;

    // Catchment: sharedCatchment.getBandForagingDraw is module-private; its arithmetic is
    // published in its own comment block and reproduced here, labelled as such. BOTH arms'
    // arithmetic is reproduced so the comparison is like-for-like.
    const committedAwayWorkers = mobility.partyCompositionTotal(committedPools);
    const awayNonWorking = (b.expeditions ?? [])
      .filter((x) => AWAY_PHASES.includes(x.phase))
      .reduce((n, x) => n + Math.max(0, x.nonWorkingPartyPeople ?? 0), 0);
    const catchmentAdults = Math.max(0, b.demography.workingAdults - committedAwayWorkers);
    // BEFORE: elders lose an INFERRED overflow. AFTER: elders lose the RECORDED non-working count.
    const inferredAgedAwayOverflow =
      Math.max(0, committedAwayWorkers - Math.max(0, b.demography.workingAdults));
    const eldersSubtrahend = awayNonWorking > 0 ? awayNonWorking : inferredAgedAwayOverflow;
    const catchmentElders = Math.max(0, Math.max(0, b.demography.elders) - eldersSubtrahend);
    const catchmentDependents = Math.max(0, b.demography.dependents);
    const catchmentDraw = Math.max(1, catchmentAdults * 1.0 + catchmentDependents * 0.65 + catchmentElders * 0.85);

    // Target work labour: the expedition's on-site work resolves through
    // `resolveExpeditionTargetWork` -> `buildTripRecord`, whose task-group size comes from
    // `estimateTaskGroupPeople` (module-private): workingAdults MINUS away partyWorkers.
    const residentialLabourForTargetWork = Math.max(0, Math.round(
      b.demography.workingAdults - (b.expeditions ?? [])
        .filter((x) => AWAY_PHASES.includes(x.phase))
        .reduce((n, x) => n + x.partyWorkers, 0),
    ));

    return {
      physicalAwayHeadcount,
      residentialPhysicalHeadcount: homePresence?.people ?? 0,
      totalWorkingAdults: b.demography.workingAdults,
      partyWorkers: e.partyWorkers,
      partyPhase: e.phase,
      partyOutcomeReason: e.outcomeReason ?? null,
      nonWorkingPartyPeople: nonWorking,
      physicalPartyPeople,
      partyComposition: e.partyComposition,
      partyCompositionTotal: productivePartyWorkers,
      committedMobilityPoolTotal: committedAwayWorkers,
      availableMobilityPoolTotal: availablePools.limited + availablePools.typical + availablePools.high,
      travelPaceTilesPerDay: pace.tilesPerTravelDay,
      travelPacePartyFactor: Number(paceFactor.toFixed(6)),
      carryCapacityUnits: expedition.deriveCarryCapacityUnits(b, e.partyWorkers, 0, tick),
      // Consumption is charged on BODIES after the repair and on `partyWorkers` before it; both
      // arms report the quantity production actually consumes, which is the point of comparison.
      provisionConsumptionPerDay: Number((physicalPartyPeople * RATE).toFixed(6)),
      maximumProvisionBudget: Number((physicalPartyPeople * RATE * MAX_DAYS).toFixed(6)),
      targetWorkResidentialLabour: residentialLabourForTargetWork,
      catchmentAdults, catchmentElders, catchmentDependents,
      catchmentEldersSubtrahend: eldersSubtrahend,
      catchmentForagingDraw: Number(catchmentDraw.toFixed(4)),
      totalRepresentedPopulation: presence.reduce((n, s) => n + s.people, 0),
      commitmentAccounting: expedition.getBandCommitmentAccounting(b),
    };
  };

  const asHandedIn = measure(band);
  // The SAME production entry point the daily kernel calls at the head of `expeditionDailyAction`.
  const reconciledBand = expedition.reconcileExpeditionCommitment(band, tick);
  const afterProductionReconciliation = measure(reconciledBand);

  // ── The §3 headline ─────────────────────────────────────────────────────────────────────────
  //
  // Judged on what production PRODUCES, not on what a test hands it: after the band's own daily
  // reconciliation, does the party still supply more productive labour than the whole band's
  // working-adult cohort holds — and are the two quantities separable in state at all?
  const r = afterProductionReconciliation;
  const labourExceedsCohort = r.partyCompositionTotal > r.totalWorkingAdults;
  const distinctAuthorities = r.physicalAwayHeadcount !== r.partyCompositionTotal;

  const headline = !labourExceedsCohort && distinctAuthorities
    ? "PHYSICAL HEADCOUNT AND PRODUCTIVE LABOR ARE DISTINCT"
    : "PARTY HEADCOUNT STILL ACTS AS IMPOSSIBLE LABOR";

  out = {
    audit: "CORRECTION-34D-PARTY-HEADCOUNT-LABOR-AUTHORITY",
    phase: PHASE,
    constructedState: {
      population: band.demography.population, workingAdults: band.demography.workingAdults,
      elders: band.demography.elders, dependents: band.demography.dependents,
      parties: 1, partyPhase: band.expeditions[0].phase,
    },
    headline,
    split: {
      labourGrantedToParty: r.partyCompositionTotal,
      bandWorkingAdultCohort: r.totalWorkingAdults,
      impossibleLabourGranted: Math.max(0, r.partyCompositionTotal - r.totalWorkingAdults),
      physicalHeadcountUnchangedByReconciliation:
        r.physicalAwayHeadcount === asHandedIn.physicalAwayHeadcount,
      physicalHeadcountAndLabourSeparableInState: distinctAuthorities,
      fieldsPresentOnRecord: {
        partyWorkers: band.expeditions[0].partyWorkers !== undefined,
        nonWorkingPartyPeople: reconciledBand.expeditions[0].nonWorkingPartyPeople !== undefined,
      },
    },
    measurements: { asHandedIn, afterProductionReconciliation },
    privateReaderArithmeticReproduced: [
      "sharedCatchment.getBandForagingDraw (module-private; arithmetic published in its own comment)",
      "intraSeasonTrips.estimateTaskGroupPeople (module-private; reads workingAdults minus away partyWorkers)",
      "expedition.consumeProvisions / provisionsExhausted (module-private; the rate constant is exported)",
    ],
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
} finally {
  await server.close();
}

console.log(JSON.stringify({ phase: out.phase, headline: out.headline, split: out.split, measurements: out.measurements }, null, 2));
