// CORRECTION-34E §9/§10 — controlled fixtures T1-T14 for expedition target-work labour provenance,
// plus the §10 caller matrix.
//
// Every fixture runs the REAL chain: resolveExpeditionTargetWork -> buildTripRecord ->
// resolvePhysicalFoodHarvest, and reads the returned record and world. Every fixture carries a
// non-vacuity predicate recording the numbers it judged on.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/shared-use-physical-presence-authority-34";
const OUT = arg("out", `${EVIDENCE}/target-work-labor-fixtures.json`);
const OUT_MATRIX = arg("out-matrix", `${EVIDENCE}/target-work-caller-matrix.json`);
const OUT_CHAIN = arg("out-chain", `${EVIDENCE}/target-work-numeric-chain.json`);

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c34e-fx-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
let matrix;
let chain;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const trips = await server.ssrLoadModule("/sim/agents/intraSeasonTrips.ts");
  const expedition = await server.ssrLoadModule("/sim/agents/expedition.ts");
  const mobility = await server.ssrLoadModule("/sim/agents/bandMobility.ts");

  let world = runner.initSimWorld({ kind: "map2" }, "c34e:targetwork");
  world = advance.advanceWorldByDays(world, 360 * 2);
  const day = Number(world.time.day);
  const tick = Number(world.time.tick);

  const living = Object.values(world.bands)
    .filter((b) => b.status !== "dispersed" && b.viability?.status !== "absorbed" && b.viability?.status !== "extinct")
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));

  const mkParty = (workers, nonWorking, t, route, over = {}) => ({
    id: "e:t", phase: "operating", partyWorkers: workers,
    ...(nonWorking > 0 ? { nonWorkingPartyPeople: nonWorking } : {}),
    partyComposition: { limited: 0, typical: workers, high: 0 },
    positionTileId: t, routeTileIds: route, routeIndex: 1, targetTileId: t,
    taskKind: "distant_plant_gathering", injuryLoad: 0,
    travelDaysElapsed: 1, workDaysElapsed: 0, hardDeadlineDay: 9999,
    cargo: { harvestUnits: 0, carryCapacityUnits: 1, provisionUnitsConsumed: 0, lostUnits: 0 },
    ...over,
  });
  const mkBand = (b, workingAdults, exps) => ({
    ...b,
    demography: { ...b.demography, population: workingAdults + 20, workingAdults, elders: 10, dependents: 10 },
    expeditions: exps,
  });

  // ── Production selects a target it actually harvests, per resource class ─────────────────────
  const findTarget = (classes) => {
    for (const b of living) {
      const mems = (b.resourceKnowledgeState?.patchMemories ?? [])
        .filter((x) => classes.includes(x.resourceClassId) && world.tiles[x.approximateTile] !== undefined)
        .sort((x, y) => String(x.patchId).localeCompare(String(y.patchId)));
      for (const m of mems) {
        const t = m.approximateTile;
        const r0 = [b.position, t];
        const d = Math.abs(world.tiles[t].coord.x - world.tiles[b.position].coord.x) +
          Math.abs(world.tiles[t].coord.y - world.tiles[b.position].coord.y);
        const probe = trips.resolveExpeditionTargetWork(
          world, mkBand(b, 30, [mkParty(5, 0, t, r0)]), m, t, d, r0, day, "food_resource_check",
          { partyWorkers: 5 });
        const h = probe.record.physicalFoodHarvest;
        if (h?.physicalSourceFound === true && (h.physicalAvailability ?? 0) > 0 &&
            (probe.record.resourceReturn?.estimatedReturnValue ?? 0) > 0) {
          return { band: b, memory: m, t, route: r0, d, sourceKind: h.sourceKind };
        }
      }
    }
    return undefined;
  };

  const plant = findTarget(["generic_plant_food", "fallback_food"]);
  const fauna = findTarget(["animal_food", "aquatic_food"]);

  if (plant === undefined) {
    throw new Error("no harvestable plant target found — the fixtures refuse to fabricate one");
  }

  const work = (site, band, workers, opts = {}) => {
    const res = trips.resolveExpeditionTargetWork(
      world, band, site.memory, site.t, site.d, site.route, day, "food_resource_check",
      { partyWorkers: workers, ...opts });
    const r = res.record;
    const h = r.physicalFoodHarvest;
    return {
      estimatedPeopleCount: r.estimatedPeopleCount,
      activityOutcome: r.activityOutcome,
      returnedResourceKind: r.resourceReturn?.returnedResourceKind ?? null,
      // POST-harvest. `resolvePhysicalFoodHarvest` overwrites `estimatedReturnValue` with the
      // usable support, so this is the RETURN, not the REQUEST. The pre-harvest request is not
      // carried on the returned record; it equals `harvestedAmount` exactly when availability did
      // not cap the take, which `requestWasCappedByAvailability` reports.
      returnValueAfterHarvest: r.resourceReturn?.estimatedReturnValue ?? 0,
      requestWasCappedByAvailability: h === undefined ? null
        : Math.abs((h.harvestedAmount ?? 0) - (h.physicalAvailability ?? 0)) < 1e-9,
      physicalSourceFound: h?.physicalSourceFound ?? null,
      physicalAvailability: h?.physicalAvailability ?? 0,
      harvestedAmount: h?.harvestedAmount ?? 0,
      depletionApplied: h?.depletionApplied ?? 0,
      transportLoss: h?.transportLoss ?? 0,
      processingLoss: h?.processingLoss ?? 0,
      usableSupport: h?.usableSupport ?? 0,
      shadowPeople: r.shadowSubsistence?.peopleCount ?? null,
      sourceKind: h?.sourceKind ?? null,
    };
  };

  const fixtures = {};
  // NON-VACUITY IS ASSERTED, NOT DECLARED. Every fixture supplies a boolean `nonVacuousPredicate`
  // naming the observation that had to exist for its verdict to mean anything, and the summary
  // counts the failures. A fixture whose predicate is false is reported VACUOUS regardless of how
  // its own comparison came out — an assertion that holds over an empty or degenerate set states a
  // contract without demonstrating it.
  const add = (id, verdict, detail) => {
    if (detail.notConstructed === true) {
      fixtures[id] = { verdict, vacuous: false, ...detail };
      return;
    }
    const vacuous = detail.nonVacuousPredicate !== true;
    fixtures[id] = { verdict: vacuous ? `VACUOUS:${verdict}` : verdict, vacuous, ...detail };
  };

  // ── T1 ordinary expedition work ─────────────────────────────────────────────────────────────
  {
    const r = work(plant, mkBand(plant.band, 20, [mkParty(5, 0, plant.t, plant.route)]), 5);
    add("T1_ordinary_expedition_work",
      r.estimatedPeopleCount === 5 ? "RECORD_PEOPLE_EQUALS_PARTY_WORKERS" : "UNEXPECTED",
      { result: r,
        nonVacuousPredicate: r.physicalSourceFound === true && r.harvestedAmount > 0,
        nonVacuous: { partyWorkers: 5, recordPeople: r.estimatedPeopleCount, harvested: r.harvestedAmount,
          predicate: "a real physical source was found and a non-zero amount was actually removed" },
        note: "the record's working group IS the party, not a share of anything" });
  }

  // ── T2 residential-labour invariance ────────────────────────────────────────────────────────
  {
    const lo = work(plant, mkBand(plant.band, 6, [mkParty(5, 0, plant.t, plant.route)]), 5);
    const hi = work(plant, mkBand(plant.band, 30, [mkParty(5, 0, plant.t, plant.route)]), 5);
    const same = lo.estimatedPeopleCount === hi.estimatedPeopleCount &&
      lo.returnValueAfterHarvest === hi.returnValueAfterHarvest && lo.harvestedAmount === hi.harvestedAmount &&
      lo.depletionApplied === hi.depletionApplied && lo.usableSupport === hi.usableSupport;
    add("T2_residential_labor_invariance",
      same ? "DISTANT_WORK_UNMOVED_BY_HOME_LABOR" : "UNEXPECTED",
      { oneAdultAtHome: lo, twentyFiveAtHome: hi,
        nonVacuousPredicate: lo.harvestedAmount > 0 && hi.harvestedAmount > 0,
        nonVacuous: { predicate: "both arms removed a non-zero amount, so equality is not two zeros", residentialAdults: "1 vs 25", people: `${lo.estimatedPeopleCount} vs ${hi.estimatedPeopleCount}`,
          depletion: `${lo.depletionApplied} vs ${hi.depletionApplied}` },
        note: "before the repair this pair read 1 vs 6 people and 0.0086 vs 0.0354 depletion" });
  }

  // ── T3 party-labour sensitivity ─────────────────────────────────────────────────────────────
  {
    const small = work(plant, mkBand(plant.band, 20, [mkParty(2, 0, plant.t, plant.route)]), 2);
    const large = work(plant, mkBand(plant.band, 20, [mkParty(6, 0, plant.t, plant.route)]), 6);
    add("T3_party_labor_sensitivity",
      small.estimatedPeopleCount === 2 && large.estimatedPeopleCount === 6 &&
      large.returnValueAfterHarvest > small.returnValueAfterHarvest
        ? "WORK_REQUEST_FOLLOWS_PARTY_LABOR" : "UNEXPECTED",
      { twoWorkers: small, sixWorkers: large,
        nonVacuousPredicate: small.harvestedAmount > 0 && large.harvestedAmount > small.harvestedAmount,
        nonVacuous: { predicate: "the larger party actually removed strictly more, so the response is measured not assumed",
          people: `${small.estimatedPeopleCount} -> ${large.estimatedPeopleCount}`,
          returnAfterHarvest: `${small.returnValueAfterHarvest} -> ${large.returnValueAfterHarvest}` },
        equation: "baseReturnValue = estimatedPeopleCount * 0.035 + yieldConfidence * 0.22 + presenceConfidence * 0.08 (deriveResourceReturnRecord), bounded and unchanged by this checkpoint" });
  }

  // ── T4 non-working physical members ─────────────────────────────────────────────────────────
  {
    const a = work(plant, mkBand(plant.band, 20, [mkParty(5, 0, plant.t, plant.route)]), 5);
    const b = work(plant, mkBand(plant.band, 20, [mkParty(5, 2, plant.t, plant.route)]), 5);
    const pA = mkParty(5, 0, plant.t, plant.route);
    const pB = mkParty(5, 2, plant.t, plant.route);
    const consumeA = mobility.getExpeditionPhysicalPeople(pA);
    const consumeB = mobility.getExpeditionPhysicalPeople(pB);
    const paceA = mobility.derivePartyPaceFactor(pA.partyComposition, 0);
    const paceB = mobility.derivePartyPaceFactor(pB.partyComposition, 2);
    add("T4_non_working_physical_members",
      a.estimatedPeopleCount === b.estimatedPeopleCount && a.harvestedAmount === b.harvestedAmount &&
      consumeB > consumeA && paceB < paceA
        ? "BODIES_CONSUME_AND_BURDEN_WITHOUT_WORKING" : "UNEXPECTED",
      { fiveWorkersZeroNonWorking: a, fiveWorkersTwoNonWorking: b,
        nonVacuousPredicate: a.harvestedAmount > 0 && consumeB === consumeA + 2 && paceA > 0,
        nonVacuous: { predicate: "real work was done and the two extra bodies are genuinely present in the consumption count",
          work: `${a.harvestedAmount} vs ${b.harvestedAmount}`,
          bodiesConsuming: `${consumeA} vs ${consumeB}`,
          paceFactor: `${Number(paceA.toFixed(6))} vs ${Number(paceB.toFixed(6))}` },
        note: "target work identical, consumption and pace burden both rise with the extra bodies" });
  }

  // ── T5 labour reduction before operation ────────────────────────────────────────────────────
  {
    // The band's whole working-adult cohort falls below what is committed, so
    // `reconcileExpeditionCommitment` converts workers to non-working WITHOUT moving a body.
    const before = mkBand(plant.band, 3, [mkParty(6, 0, plant.t, plant.route)]);
    const reconciled = expedition.reconcileExpeditionCommitment(before, tick);
    const e = reconciled.expeditions[0];
    const reducedWorkers = mobility.getExpeditionProductiveWorkers(e);
    const bodies = mobility.getExpeditionPhysicalPeople(e);
    const full = work(plant, before, 6);
    const reduced = work(plant, reconciled, reducedWorkers);
    add("T5_labor_reduction_before_operation",
      bodies === 6 && reducedWorkers === 3 && reduced.estimatedPeopleCount === reducedWorkers &&
      reduced.returnValueAfterHarvest < full.returnValueAfterHarvest && reduced.depletionApplied <= full.depletionApplied
        ? "REDUCED_LABOR_REACHES_EVERY_TARGET_WORK_FIELD" : "UNEXPECTED",
      { workersAfterReduction: reducedWorkers, physicalBodies: bodies,
        nonVacuousPredicate: reducedWorkers < 6 && reducedWorkers > 0 && full.harvestedAmount > 0,
        nonVacuousNote: "reconciliation genuinely reduced labour (6 -> <6, not to zero) and the unreduced arm did real work",
        nonWorking: e.nonWorkingPartyPeople ?? 0,
        atFullLabour: full, atReducedLabour: reduced,
        nonVacuous: { workers: `6 -> ${reducedWorkers}`, bodies: `6 -> ${bodies}`,
          people: `${full.estimatedPeopleCount} -> ${reduced.estimatedPeopleCount}`,
          depletion: `${full.depletionApplied} -> ${reduced.depletionApplied}` },
        note: "no body moved; no residential worker performed the distant work" });
  }

  // ── T6 zero residential workers ─────────────────────────────────────────────────────────────
  {
    // Every working adult is away. The residential estimator would floor at one.
    const band = mkBand(plant.band, 5, [mkParty(5, 0, plant.t, plant.route)]);
    const r = work(plant, band, 5);
    add("T6_zero_residential_workers",
      r.estimatedPeopleCount === 5 ? "PARTY_DOES_NOT_FALL_TO_THE_RESIDENTIAL_FLOOR" : "UNEXPECTED",
      { result: r, residentialWorkersRemaining: 0,
        nonVacuousPredicate: r.harvestedAmount > 0 && r.estimatedPeopleCount > 1,
        nonVacuous: { predicate: "the party did real work AND read above the residential floor of one, so the floor is provably not what answered", residentialAfterCommitment: 0, recordPeople: r.estimatedPeopleCount, wouldHaveBeen: 1 },
        note: "estimateTaskGroupPeople applies Math.max(1, ...) so the residential path would read 1; the party path applies no floor" });
  }

  // ── T7 same-day control ─────────────────────────────────────────────────────────────────────
  {
    // The same-day path passes no party context, so `buildTripRecord` takes the
    // `estimateTaskGroupPeople` branch. This fixture does not merely restate that: it proves the
    // residential authority is LIVE on this tree with a positive control — same-day group sizes
    // must still track the band's own residential working-adult cohort and must still respect the
    // floor of one and the cohort ceiling. If the party authority had leaked into the same-day
    // path, group size would stop tracking the residence.
    //
    // Cross-tree byte identity of a whole world is deliberately NOT claimed here and is measured
    // separately by `targetWorkSameDayPreservationAudit.mjs`; see that file for why a whole-world
    // comparison past the first expedition work day would be dishonest.
    let w = runner.initSimWorld({ kind: "map2" }, "c34e:sameday");
    w = advance.advanceWorldByDays(w, 400);
    const perBand = Object.values(w.bands)
      .filter((b) => b.status !== "dispersed" && b.viability?.status !== "extinct")
      .map((b) => ({
        id: String(b.id),
        workingAdults: b.demography?.workingAdults ?? 0,
        counts: (b.recentIntraSeasonTrips ?? [])
          .map((r) => r.estimatedPeopleCount)
          .filter((n) => typeof n === "number"),
      }))
      .filter((x) => x.counts.length > 0);
    const sameDayRecords = perBand.flatMap((x) => x.counts);
    const anyRecords = sameDayRecords.length;
    const allAtLeastOne = sameDayRecords.every((n) => n >= 1);
    // Every same-day group must fit inside its own band's residential cohort (floored at one),
    // which a party-derived count would not have to.
    const allWithinResidentialCohort = perBand.every((x) => x.counts.every((n) => n <= Math.max(1, x.workingAdults)));
    // Positive control: the band with the largest working-adult cohort must field a group at least
    // as large as the band with the smallest. A count that ignored the residence would not.
    const sorted = [...perBand].sort((a, b) => a.workingAdults - b.workingAdults);
    const lowest = sorted[0];
    const highest = sorted[sorted.length - 1];
    const cohortsDiffer = highest.workingAdults > lowest.workingAdults;
    const tracksResidence = Math.max(...highest.counts) >= Math.max(...lowest.counts);
    add("T7_same_day_control",
      anyRecords > 0 && allAtLeastOne && allWithinResidentialCohort && tracksResidence
        ? "SAME_DAY_PATH_RETAINS_ITS_OWN_RESIDENTIAL_AUTHORITY" : "UNEXPECTED",
      { sameDayRecordsObserved: anyRecords,
        bandsObserved: perBand.length,
        peopleCountRange: { min: Math.min(...sameDayRecords), max: Math.max(...sameDayRecords) },
        smallestCohortBand: { workingAdults: lowest.workingAdults, maxGroup: Math.max(...lowest.counts) },
        largestCohortBand: { workingAdults: highest.workingAdults, maxGroup: Math.max(...highest.counts) },
        allWithinResidentialCohort, tracksResidence,
        nonVacuousPredicate: anyRecords > 0 && perBand.length > 1 && cohortsDiffer,
        nonVacuous: { predicate: "more than one band produced same-day records AND their residential cohorts genuinely differ, so 'tracks the residence' is a real comparison",
          sameDayRecordsObserved: anyRecords, bands: perBand.length,
          cohortSpread: `${lowest.workingAdults} .. ${highest.workingAdults}` },
        crossTreeCompanion: "targetWorkSameDayPreservationAudit.mjs — same-day trip records over the pre-expedition-work prefix are BYTE-IDENTICAL between c8df1ea and this tree (2,034 records, 729 days, same sha256)",
        note: "same-day trips pass no party context; the residential estimator's floor of one and cohort ceiling both still govern them" });
  }

  // ── T8 verify-only control ──────────────────────────────────────────────────────────────────
  {
    const band = mkBand(plant.band, 20, [mkParty(5, 0, plant.t, plant.route)]);
    const v = work(plant, band, 5, { verifyOnly: true });
    const vLowHome = work(plant, mkBand(plant.band, 6, [mkParty(5, 0, plant.t, plant.route)]), 5, { verifyOnly: true });
    add("T8_verify_only_control",
      v.estimatedPeopleCount === 5 && v.harvestedAmount === 0 && v.depletionApplied === 0 &&
      v.estimatedPeopleCount === vLowHome.estimatedPeopleCount
        ? "PARTY_LABOR_PROVENANCE_WITH_ZERO_REMOVAL" : "UNEXPECTED",
      { verifyResult: v, verifyWithOneAdultAtHome: vLowHome,
        nonVacuousPredicate: v.physicalSourceFound === true && v.physicalAvailability > 0,
        nonVacuous: { predicate: "a real source with real availability WAS standing there, so zero removal is suppression and not absence", people: v.estimatedPeopleCount, harvested: v.harvestedAmount, depleted: v.depletionApplied,
          invariantToHomeLabour: v.estimatedPeopleCount === vLowHome.estimatedPeopleCount },
        honestLimit: "labour enters the verification record's own group size and its outcome classification. It does NOT change whether a source physically exists or its availability — those are world facts the party reads, not effort-scaled quantities, so party size cannot alter them and nothing here claims it does." });
  }

  // ── T9 plant target ─────────────────────────────────────────────────────────────────────────
  {
    const small = work(plant, mkBand(plant.band, 20, [mkParty(2, 0, plant.t, plant.route)]), 2);
    const large = work(plant, mkBand(plant.band, 20, [mkParty(6, 0, plant.t, plant.route)]), 6);
    add("T9_plant_target",
      small.sourceKind === "plant_patch" && large.depletionApplied >= small.depletionApplied &&
      large.estimatedPeopleCount > small.estimatedPeopleCount
        ? "PARTY_LABOR_OWNS_PLANT_REQUEST_AND_DEPLETION" : "UNEXPECTED",
      { sourceKind: small.sourceKind, twoWorkers: small, sixWorkers: large,
        nonVacuousPredicate: small.depletionApplied > 0 && large.depletionApplied > 0,
        nonVacuous: { predicate: "both arms actually depleted the patch",
          depletion: `${small.depletionApplied} -> ${large.depletionApplied}`,
          people: `${small.estimatedPeopleCount} -> ${large.estimatedPeopleCount}` } });
  }

  // ── T10 fauna or aquatic target ─────────────────────────────────────────────────────────────
  if (fauna === undefined) {
    add("T10_fauna_or_aquatic_target", "NOT_CONSTRUCTED_NO_HARVESTABLE_FAUNA_TARGET",
      { notConstructed: true,
        nonVacuous: { searched: living.length, found: 0 },
        note: "no band held a fauna/aquatic patch memory that production physically harvests in this world. Reported as NOT CONSTRUCTED rather than passed on an empty set." });
  } else {
    const small = work(fauna, mkBand(fauna.band, 20, [mkParty(2, 0, fauna.t, fauna.route)]), 2);
    const large = work(fauna, mkBand(fauna.band, 20, [mkParty(6, 0, fauna.t, fauna.route)]), 6);
    add("T10_fauna_or_aquatic_target",
      large.estimatedPeopleCount > small.estimatedPeopleCount && large.depletionApplied >= small.depletionApplied
        ? "PARTY_LABOR_OWNS_FAUNA_REQUEST_AND_PRESSURE" : "UNEXPECTED",
      { sourceKind: small.sourceKind, twoWorkers: small, sixWorkers: large,
        nonVacuousPredicate: small.physicalSourceFound === true && large.depletionApplied > 0,
        nonVacuous: { predicate: "a real fauna/aquatic source was found and the larger party actually depleted it",
          people: `${small.estimatedPeopleCount} -> ${large.estimatedPeopleCount}`,
          depletion: `${small.depletionApplied} -> ${large.depletionApplied}` } });
  }

  // ── T11 numeric chain ───────────────────────────────────────────────────────────────────────
  {
    // Prefer a site where physical availability does NOT cap the take: then `harvestedAmount` IS
    // the requested amount, so the requested->removed link is directly observable instead of being
    // inferred. The plant patch used elsewhere is capped, which is itself worth stating.
    const site = fauna ?? plant;
    const workers = 5;
    const nonWorking = 2;
    const party = mkParty(workers, nonWorking, site.t, site.route);
    const band = mkBand(site.band, 20, [party]);
    const r = work(site, band, workers);
    const bodies = mobility.getExpeditionPhysicalPeople(party);
    const capacity = expedition.deriveCarryCapacityUnits(band, workers, 0, tick);
    const requestObservable = r.requestWasCappedByAvailability === false;
    const carried = Math.min(r.usableSupport, capacity);
    const abandoned = Number(Math.max(0, r.usableSupport - capacity).toFixed(6));
    const provisionsPerDay = Number((bodies * expedition.EXPEDITION_PROVISION_UNITS_PER_WORKER_DAY).toFixed(6));
    chain = {
      audit: "CORRECTION-34E-TARGET-WORK-NUMERIC-CHAIN",
      units: {
        estimatedReturnValue: "trip-record return units (per-trip draw, capped at 0.5)",
        harvestedAmount: "physical stock units removed at the target",
        usableSupport: "human food support units after transport and processing losses",
        cargoHarvestUnits: "expedition cargo units (a DIFFERENT quantity from usableSupport; not equated here)",
        provisionUnits: "trip-local provision units, a bounded accounting abstraction — no residential store is decremented",
      },
      site: { tile: String(site.t), sourceKind: r.sourceKind, availabilityCappedTheTake: r.requestWasCappedByAvailability },
      steps: [
        { step: "productive party labour", value: workers },
        { step: "record estimatedPeopleCount", value: r.estimatedPeopleCount },
        { step: "return value after harvest (resourceReturn.estimatedReturnValue, OVERWRITTEN by the resolver — this is the return, not the request)", value: r.returnValueAfterHarvest },
        { step: "request was capped by availability", value: r.requestWasCappedByAvailability },
        { step: requestObservable
            ? "requested target amount (DIRECTLY OBSERVABLE: availability did not cap the take, so the request IS the removal)"
            : "requested target amount (NOT directly observable: availability capped the take, so the request is only bounded below by the removal)",
          value: requestObservable ? r.harvestedAmount : null,
          lowerBound: r.harvestedAmount },
        { step: "physical availability at target", value: r.physicalAvailability },
        { step: "actual target removal (harvestedAmount = depletionApplied)", value: r.harvestedAmount, alsoDepletion: r.depletionApplied },
        { step: "transport loss", value: r.transportLoss },
        { step: "processing loss", value: r.processingLoss },
        { step: "usable support after losses", value: r.usableSupport },
        { step: "carry ceiling justified by productive workers", value: capacity },
        { step: "carried within ceiling", value: Number(carried.toFixed(6)) },
        { step: "abandoned above ceiling", value: abandoned },
        { step: "physical people consuming provisions per day", value: bodies, perDay: provisionsPerDay },
      ],
      consistency: {
        removalEqualsDepletion: r.harvestedAmount === r.depletionApplied,
        supportNeverExceedsRemoval: r.usableSupport <= r.harvestedAmount + 1e-9,
        peopleEqualsPartyWorkers: r.estimatedPeopleCount === workers,
        provisionsCountBodiesNotWorkers: bodies === workers + nonWorking,
      },
      statedNonClaims: [
        "abandonment above the carry ceiling reads 0 here and is NOT demonstrated by this fixture: one work-day's take is two orders of magnitude below the ceiling, and abandonment arises from cargo ACCUMULATED across work-days, which CORRECTION-34B already measured (0.648 -> 0.6 carried + 0.048 lost). Nothing was fabricated to make it non-zero.",
        "usableSupport and cargo.harvestUnits are DIFFERENT quantities in different units and are not equated",
        "full material conservation is NOT claimed for trip-local provisions: no residential store is decremented and consumeProvisions only increments a counter",
      ],
    };
    add("T11_cargo_chain",
      chain.consistency.removalEqualsDepletion && chain.consistency.supportNeverExceedsRemoval &&
      chain.consistency.peopleEqualsPartyWorkers && chain.consistency.provisionsCountBodiesNotWorkers
        ? "CHAIN_CONSISTENT_UNITS_KEPT_DISTINCT" : "UNEXPECTED",
      { chain: chain.steps, consistency: chain.consistency,
        nonVacuousPredicate: r.harvestedAmount > 0 && r.usableSupport > 0 && bodies > workers && capacity > 0,
        nonVacuous: { predicate: "every link carries a non-zero quantity and the party genuinely holds more bodies than workers",
          removal: r.harvestedAmount, support: r.usableSupport, bodies, workers, capacity } });
  }

  // ── T12 two concurrent parties ──────────────────────────────────────────────────────────────
  {
    const pA = mkParty(2, 0, plant.t, plant.route, { id: "e:a" });
    const pB = mkParty(6, 0, plant.t, plant.route, { id: "e:b" });
    const band = mkBand(plant.band, 20, [pA, pB]);
    const rA = work(plant, band, mobility.getExpeditionProductiveWorkers(pA));
    const rB = work(plant, band, mobility.getExpeditionProductiveWorkers(pB));
    add("T12_two_concurrent_parties",
      rA.estimatedPeopleCount === 2 && rB.estimatedPeopleCount === 6
        ? "EACH_PARTY_USES_ITS_OWN_LABOR" : "UNEXPECTED",
      { partyA: rA, partyB: rB,
        nonVacuousPredicate: rA.harvestedAmount > 0 && rB.harvestedAmount > 0 && rA.estimatedPeopleCount !== rB.estimatedPeopleCount,
        nonVacuous: { predicate: "both parties did real work and read DIFFERENT counts, so neither collapsed onto a shared number", a: rA.estimatedPeopleCount, b: rB.estimatedPeopleCount, sumWouldBe: 8, residentialWouldBe: 12 },
        note: "neither party reads the sum (8), the residence (12 adults remaining), nor the other party" });
  }

  // ── T13 legacy expedition record ────────────────────────────────────────────────────────────
  {
    const legacy = mkParty(4, 0, plant.t, plant.route);
    delete legacy.nonWorkingPartyPeople;
    delete legacy.partyComposition;
    const band = mkBand(plant.band, 20, [legacy]);
    const r1 = work(plant, band, mobility.getExpeditionProductiveWorkers(legacy));
    const r2 = work(plant, band, mobility.getExpeditionProductiveWorkers(legacy));
    add("T13_legacy_expedition_record",
      r1.estimatedPeopleCount === 4 && JSON.stringify(r1) === JSON.stringify(r2)
        ? "LEGACY_RECORD_USES_PARTY_WORKERS_DETERMINISTICALLY" : "UNEXPECTED",
      { result: r1, deterministicAcrossRepeatedCalls: JSON.stringify(r1) === JSON.stringify(r2),
        nonVacuousPredicate: legacy.nonWorkingPartyPeople === undefined && legacy.partyComposition === undefined && r1.harvestedAmount > 0,
        nonVacuous: { predicate: "the legacy fields are genuinely absent and the record still produced real work", partyWorkers: 4, nonWorkingFieldPresent: legacy.nonWorkingPartyPeople !== undefined,
          compositionPresent: legacy.partyComposition !== undefined, recordPeople: r1.estimatedPeopleCount },
        note: "an absent nonWorkingPartyPeople reads as zero, so bodies equal workers and target labour is partyWorkers" });
  }

  // ── T14 four-way step-mode equivalence with real target work ────────────────────────────────
  {
    // 630 is the smallest span divisible by all four mode strides. It is TOO SHORT: measured on
    // this world, the first expedition that actually exploits a target lands after day 720, so a
    // 630-day arm agrees across all four modes while containing no target work at all — an
    // identity claim about a behaviour that never happened. 2520 (4 x 630, seven simulated years)
    // is the smallest multiple at which delivered exploitation harvests are observed.
    const MODE_DAYS = { daily: 1, weekly: 7, monthly: 30, seasonal: 90 };
    const SPAN = 2520;
    const canon = (w) => JSON.stringify(Object.values(w.bands)
      .sort((x, y) => String(x.id).localeCompare(String(y.id)))
      .map((b) => ({
        id: String(b.id), pos: String(b.position), pop: b.demography?.population,
        wa: b.demography?.workingAdults,
        exp: (b.expeditions ?? []).map((e) => `${e.phase}:${e.partyWorkers}:${e.nonWorkingPartyPeople ?? 0}`),
        out: (b.recentExpeditionOutcomes ?? []).map((o) => `${o.outcomeReason}:${o.deliveredHarvestUnits}`),
        trips: (b.recentIntraSeasonTrips ?? []).length,
      })));
    const results = {};
    let operatingWorkDays = 0;
    let exploitationOutcomes = 0;
    for (const [mode, days] of Object.entries(MODE_DAYS)) {
      let w = runner.initSimWorld({ kind: "map2" }, "audit27:natural:map2:s1");
      w = runner.stepSim(w, SPAN / days, mode);
      results[mode] = canon(w);
      if (mode === "daily") {
        // Non-vacuity: real expedition target work must actually have happened in the span. Two
        // independent counts, because the outcome ring is capped per band and undercounts.
        operatingWorkDays = Object.values(w.bands)
          .reduce((n, b) => n + (b.recentExpeditionOutcomes ?? [])
            .filter((o) => (o.deliveredHarvestUnits ?? 0) > 0).length, 0);
        exploitationOutcomes = Object.values(w.bands)
          .reduce((n, b) => n + (b.recentExpeditionOutcomes ?? [])
            .filter((o) => o.taskKind !== "frontier_exploration" && o.taskKind !== "frontier_verification").length, 0);
      }
    }
    const allMatch = Object.values(results).every((v) => v === results.daily);
    add("T14_four_way_step_mode_with_target_work",
      allMatch && operatingWorkDays > 0 ? "IDENTICAL_ACROSS_ALL_FOUR_MODES_WITH_REAL_TARGET_WORK"
        : allMatch ? "IDENTICAL_BUT_NO_TARGET_WORK_OBSERVED" : "DIVERGENT",
      { spanDays: SPAN, matches: Object.fromEntries(Object.keys(MODE_DAYS).map((m) => [m, results[m] === results.daily])),
        nonVacuousPredicate: operatingWorkDays > 0 && exploitationOutcomes > 0,
        nonVacuous: { predicate: "the span genuinely contains expeditions that exploited a target and delivered a harvest, so the identity is about a behaviour that happened",
          expeditionOutcomesDeliveringHarvest: operatingWorkDays, exploitationTaskOutcomes: exploitationOutcomes },
        note: "not marked PASS merely because the modes agree — the count of expeditions that actually delivered a harvest is what makes the agreement mean anything" });
  }

  // ── §10 caller matrix ───────────────────────────────────────────────────────────────────────
  matrix = {
    audit: "CORRECTION-34E-CALLER-MATRIX",
    distinction: "same-day residential task group != multi-day expedition party",
    callers: [
      {
        caller: "applyTripDay -> buildTripRecord (intraSeasonTrips.ts, same-day path)",
        activityType: "same-day residential task group",
        physicalLocation: "target within the same-day round-trip budget; the group sleeps at camp",
        laborAuthority: "estimateTaskGroupPeople(band) — a capped SHARE of residential working adults minus expedition commitments, floored at 1",
        depletesStock: true, producesCargo: false, reachesEconomy: true,
        whyLegitimate: "the group IS drawn from the residence that day, so residential labour is the correct authority. Unchanged by CORRECTION-34E; it passes no party context.",
      },
      {
        caller: "expeditionDailyAction -> resolveExpeditionTargetWork -> buildTripRecord (work)",
        activityType: "multi-day expedition party, operating at its target",
        physicalLocation: "the party's own positionTileId, up to many days from camp",
        laborAuthority: "options.partyWorkers = getExpeditionProductiveWorkers(expedition) — REQUIRED, no fallback",
        depletesStock: true, producesCargo: true, reachesEconomy: true,
        whyLegitimate: "the people doing the work are physically standing at the target. Repaired by CORRECTION-34E; previously read residential labour.",
      },
      {
        caller: "expeditionDailyAction -> resolveExpeditionTargetWork (verification, verifyOnly)",
        activityType: "multi-day verification party, looking without taking",
        physicalLocation: "the party's own positionTileId",
        laborAuthority: "options.partyWorkers = getExpeditionProductiveWorkers(expedition) — REQUIRED",
        depletesStock: false, producesCargo: false, reachesEconomy: false,
        whyLegitimate: "who looks is the party; the take is suppressed by verifyOnly, not by labour. Repaired by CORRECTION-34E.",
      },
      {
        caller: "resolvePhysicalFoodHarvest (intraSeasonTrips.ts, private)",
        activityType: "the ONE physical resolver, shared by both paths",
        physicalLocation: "the record's own target",
        laborAuthority: "none of its own — consumes record.resourceReturn.estimatedReturnValue as the requested amount",
        depletesStock: true, producesCargo: false, reachesEconomy: true,
        whyLegitimate: "deliberately labour-blind so there is exactly one physical harvest equation; correctness therefore depends entirely on the record it is handed, which is why the repair is at the record builder.",
      },
      {
        caller: "estimateTaskGroupPeople (intraSeasonTrips.ts, private)",
        activityType: "residential task-group sizing",
        physicalLocation: "the residence",
        laborAuthority: "band.demography.workingAdults minus committed expedition productive workers, capped and floored at 1",
        depletesStock: false, producesCargo: false, reachesEconomy: false,
        whyLegitimate: "a labour question against a labour cohort. NOT globally replaced: it remains correct for the same-day path and is simply not consulted by the expedition path.",
      },
    ],
    accidentalCallersOnTheWrongAuthority: 0,
    auditScriptCallers: [
      "expeditionTargetResolutionAudit.mjs (2 sites)", "expeditionAdaptationEfficacyAudit.mjs",
      "taskCampComparisonAudit.mjs", "expeditionPerformanceMatrixAudit.mjs",
      "targetWorkLaborAudit.mjs", "targetWorkFixturesAudit.mjs",
    ].map((s) => ({ script: s, nowPassesPartyWorkers: true })),
  };

  const verdicts = Object.fromEntries(Object.entries(fixtures).map(([k, v]) => [k, v.verdict]));
  const bad = Object.entries(verdicts).filter(([, v]) =>
    String(v).includes("UNEXPECTED") || String(v).includes("DIVERGENT") ||
    String(v).includes("IDENTICAL_BUT_NO_TARGET_WORK_OBSERVED"));
  const notConstructed = Object.entries(fixtures).filter(([, v]) => v.notConstructed === true);
  const vacuous = Object.entries(fixtures).filter(([, v]) => v.vacuous === true);

  out = {
    audit: "CORRECTION-34E-TARGET-WORK-FIXTURES",
    summary: {
      fixtures: Object.keys(fixtures).length,
      failing: bad.length,
      notConstructed: notConstructed.length,
      vacuous: vacuous.length,
      vacuousIds: vacuous.map(([k]) => k),
      failingIds: bad.map(([k]) => k),
    },
    plantTarget: { tile: String(plant.t), sourceKind: plant.sourceKind, band: String(plant.band.id) },
    faunaTarget: fauna === undefined ? null : { tile: String(fauna.t), sourceKind: fauna.sourceKind },
    verdicts, fixtures,
  };

  for (const [p, data] of [[OUT, out], [OUT_MATRIX, matrix], [OUT_CHAIN, chain]]) {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  }
} finally {
  await server.close();
}

console.log(JSON.stringify({ summary: out.summary, verdicts: out.verdicts }, null, 2));
if (out.summary.failing > 0 || out.summary.vacuous > 0) process.exitCode = 1;
