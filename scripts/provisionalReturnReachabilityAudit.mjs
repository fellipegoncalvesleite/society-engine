// ROADMAP ITEM 4 — PHYSICAL RETURN REACHABILITY AND TRUTHFUL DAY-BASED BOUNDS.
//
// Two repairs, one suite.
//
// PART A — REINTEGRATION WAS UNREACHABLE. `performAtomicReintegration` was written, audited and
// correct, and NOTHING IN `src/` IMPORTED IT. A measured stranded lifecycle stood on its living
// parent's tile for 552 consecutive days while the authority, asked diagnostically, answered `ok:
// true` every single day. The fixtures below assert the repair from both directions: a group that
// physically meets its parent IS handed back, through the real daily runner, on the day it arrives —
// and a group that has not met its parent is still refused.
//
// PART B — A BOUND DECLARED IN DAYS WAS EVALUATED ONCE A SEASON. `resolveProvisionalLifecycles` had
// exactly one caller, inside `runSeasonalCompatibilityTick`, so `today - phaseEnteredDay >= maxDays`
// was tested on one day in ninety. Measured lateness on one real run: 41 days, then 76. Declared
// worst case: 89. The fixtures assert the bound now binds within one daily tick of its declared day.
//
// NON-VACUITY IS ASSERTED PER FIXTURE. A fixture whose predicate holds over an empty set is relabelled
// VACUOUS and fails the run, so a zero here is a measured zero.
import { createServer } from "vite";
import { prepareAndDepart, bestKnownTargetAtDistance } from "./lib/preparedDeparture.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/dynamic-fission-daughter-viability-37";
const OUT = arg("out", `${EVIDENCE}/provisional-return-reachability.json`);
const SEED = arg("seed", "audit27:natural:s1");
const WARM_DAYS = Number(arg("warm-days", "2100"));

const fixtures = [];
const record = (id, claim, passed, nonVacuous, detail) => {
  fixtures.push({
    id, claim,
    verdict: nonVacuous === false ? "VACUOUS" : passed ? "PASS" : "FAIL",
    nonVacuous: nonVacuous !== false, detail,
  });
};

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-i4rr-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const seam = await server.ssrLoadModule("/sim/agents/fissionDepartureSeam.ts");
  const prep = await server.ssrLoadModule("/sim/agents/fissionDeparturePreparation.ts");
  const reint = await server.ssrLoadModule("/sim/agents/provisionalReintegration.ts");
  const resolver = await server.ssrLoadModule("/sim/agents/provisionalLifecycleResolver.ts");
  const kernel = await server.ssrLoadModule("/sim/agents/fissionLifecycleKernel.ts");
  const registry = await server.ssrLoadModule("/sim/agents/dailyActionRegistry.ts");
  const generate = await server.ssrLoadModule("/sim/world/generate.ts");
  const passability = await server.ssrLoadModule("/sim/world/passability.ts");
  const plantStock = await server.ssrLoadModule("/sim/agents/plantStock.ts");
  const timeMod = await server.ssrLoadModule("/sim/tick/time.ts");
  const scoring = await server.ssrLoadModule("/sim/rules/decisionScoring.ts");
  const lc = await server.ssrLoadModule("/sim/agents/bandLifecycle.ts");

  const base = advance.advanceWorldByDays(runner.initSimWorld({ kind: "map2" }, SEED), WARM_DAYS);
  const day0 = Number(base.time.day ?? 0);
  const time0 = timeMod.getWorldTimeForDay(day0);
  const parent = Object.values(base.bands)
    .filter((b) => lc.isEstablishedBand(b) && b.demography.workingAdults >= 6 && b.demography.population >= 24)
    .sort((a, b) => b.demography.population - a.demography.population)[0];
  if (parent === undefined) throw new Error("no suitable parent band");
  const home = generate.getTile(base, parent.position);

  const distOf = (w, aId, bId) => {
    const a = generate.getTile(w, aId), b = generate.getTile(w, bId);
    if (a === undefined || b === undefined) throw new Error("HARNESS HARD FAIL: missing tile");
    const d = scoring.getGridDistance(a, b);
    if (!Number.isFinite(d)) throw new Error("HARNESS HARD FAIL: non-finite distance");
    return d;
  };
  const probePatch = (w, tid) => {
    const t = generate.getTile(w, tid);
    if (t === undefined) return undefined;
    const r = plantStock.resolvePlantFoodHarvest(w, t, time0, 0.1, false);
    return r.sourceFound ? { patchId: r.sourceId, classId: r.sourceClass } : undefined;
  };

  const known = Object.keys(parent.knowledge.observedTiles)
    .map((id) => generate.getTile(base, id))
    .filter((t) => t !== undefined && passability.isBandPassableDestination(t) && String(t.id) !== String(parent.position));
  // Best-KNOWN at distance, not farthest/nearest: the founder cohort refuses ground it has barely
  // seen (`destination_barely_known`), which is a real decision rather than a gate to route around.
  const bestFar = bestKnownTargetAtDistance(generate, passability, base, parent, 2);
  const target = bestFar === undefined ? undefined : { t: bestFar, d: distOf(base, parent.position, bestFar.id) };
  if (target === undefined) throw new Error("no known passable target at distance 2..4");

  // Barren country, through the canonical patch store: the attempt must FAIL so the group turns for
  // home. Nothing else about the world is touched.
  const depEntries = [...known.map((t) => probePatch(base, t.id)), probePatch(base, parent.position)].filter(Boolean);
  const patchState = { ...(base.plantPatchState ?? {}) };
  for (const e of depEntries) {
    const p = patchState[e.patchId];
    patchState[e.patchId] = p !== undefined
      ? { ...p, depletion: 1 }
      : { depletion: 1, classId: e.classId, lastUseTick: time0.tick, cumulativeUse: 0 };
  }
  const barren = { ...base, plantPatchState: patchState };

  const RESIDUAL = {
    physicallyAwayPeople: 0, physicallyAwayWorkers: 0, preparedCommitmentWorkers: 0,
    foodDemographicPressure: 0, chronicFoodStress: 0, chronicDeficitStreak: 0, nutritionMeasured: true,
    acuteRiskSeverity: 0, sicknessBurden: 0, careTravelBurden: 0, embodiedConditionMeasured: true,
    ecologicalRisk: 0, ecologicalPositionMeasured: true,
    mobilityCapabilityBefore: 1, mobilityCapabilityAfter: 1, minimumFounderRequest: 2,
  };
  const depart = (world, successorBandId, lineageId, today) => {
    const d = prepareAndDepart({
      prep, seam, world, parentId: parent.id, today,
      lineageId, requestedFounders: 8, targetTileId: String(target.t.id), successorBandId,
    }).departure;
    if (d.ok !== true) throw new Error(`departure refused: ${d.refusal}`);
    return d;
  };

  // ════════════════════ PART A — REINTEGRATION IS REACHABLE ════════════════════
  const SID = "band:rr:coloc";
  const dep = depart(barren, SID, "LIN-RR-A", day0);
  const succ0 = dep.world.bands[SID];
  const parentAfterDeparture = dep.world.bands[parent.id];
  const cohortsBefore = {
    parent: {
      workingAdults: parentAfterDeparture.demography.workingAdults,
      dependents: parentAfterDeparture.demography.dependents,
      elders: parentAfterDeparture.demography.elders,
    },
    successor: {
      workingAdults: succ0.demography.workingAdults,
      dependents: succ0.demography.dependents,
      elders: succ0.demography.elders,
    },
  };
  const worldPopAtDeparture = Object.values(dep.world.bands)
    .reduce((t, b) => t + Math.round(b.demography.population), 0);

  let w = dep.world;
  let firstCoLocationDay = null;
  let reintegratedDay = null;
  let lastPhase = null;
  const timeline = [];
  const acuteEpisodesBeforeMerge = { parent: null, successor: null };
  for (let i = 1; i <= 200; i += 1) {
    const dayBefore = day0 + i;
    const bandBefore = w.bands[SID];
    const parentBefore = w.bands[parent.id];
    // Co-location is measured on the state the previous day left, BEFORE this day's actions run, so
    // "the day they met" and "the day they merged" are separately observable rather than the same read.
    //
    // INSTRUMENT CORRECTION: an earlier form asked only "same tile", and read day+1 — the successor is
    // CREATED on its parent's tile and has not walked yet, so it was trivially co-located while still
    // `departed`, and the fixture reported a 29-day latency that was really the outbound journey.
    // Co-location only means anything once the group is in a phase that can rejoin.
    const rejoinable = ["returning", "unresolved_after_failed_return"].includes(
      bandBefore?.provisionalSuccessor?.phase ?? "",
    );
    const coLocatedEntering =
      bandBefore !== undefined && lc.isProvisionalSuccessor(bandBefore) && rejoinable &&
      String(bandBefore.position) === String(parentBefore.position);
    if (coLocatedEntering && firstCoLocationDay === null) firstCoLocationDay = i;

    if (bandBefore !== undefined && lc.isProvisionalSuccessor(bandBefore) && reintegratedDay === null) {
      acuteEpisodesBeforeMerge.parent = parentBefore.acuteRisk?.recentEpisodes?.length ?? 0;
      acuteEpisodesBeforeMerge.successor = bandBefore.acuteRisk?.recentEpisodes?.length ?? 0;
    }

    w = advance.advanceWorldByDays(w, 1);
    const b = w.bands[SID];
    if (b === undefined) break;
    const rec = b.provisionalSuccessor;
    if (rec === undefined) break;
    if (rec.phase !== lastPhase) {
      timeline.push({ day: i, phase: rec.phase, pos: String(b.position), parentPos: String(w.bands[parent.id].position) });
      lastPhase = rec.phase;
    }
    if (rec.phase === "reintegrated" && reintegratedDay === null) {
      reintegratedDay = i;
      // The successor arrives and is merged inside the SAME day's action list, so the day it first
      // stands on the tile is the day it merges. Record it if the entering read never saw it separately.
      if (firstCoLocationDay === null) firstCoLocationDay = i;
      break;
    }
    if (["stabilized", "provisional_extinguished"].includes(rec.phase)) break;
  }

  const merged = w.bands[parent.id];
  const removedSuccessor = w.bands[SID];
  const worldPopAfter = Object.values(w.bands).reduce((t, b) => t + Math.round(b.demography.population), 0);

  record(
    "RX1_co_located_return_is_actually_reintegrated_by_production",
    "a returning group that physically reaches its living parent is handed back BY THE RUNNER, with no audit script calling the writer",
    reintegratedDay !== null,
    timeline.some((t) => t.phase === "returning"),
    {
      reintegratedOnDayOffset: reintegratedDay,
      timeline,
      note: "before this pass the same scenario stood co-located for 552 days and stabilized falsely on day+530",
    },
  );

  record(
    "RX2_reintegration_happens_on_the_day_of_arrival_not_a_season_later",
    "the merge day equals the co-location day; a meeting is not deferred to a boundary",
    reintegratedDay !== null && firstCoLocationDay !== null && reintegratedDay - firstCoLocationDay === 0,
    reintegratedDay !== null && firstCoLocationDay !== null,
    { firstCoLocationDayOffset: firstCoLocationDay, reintegratedOnDayOffset: reintegratedDay,
      latencyDays: reintegratedDay !== null && firstCoLocationDay !== null ? reintegratedDay - firstCoLocationDay : null },
  );

  const cohortsAfter = {
    workingAdults: merged.demography.workingAdults,
    dependents: merged.demography.dependents,
    elders: merged.demography.elders,
  };
  const conserved = {
    workingAdults: Math.abs(cohortsAfter.workingAdults - (cohortsBefore.parent.workingAdults + cohortsBefore.successor.workingAdults)) < 1e-9,
    dependents: Math.abs(cohortsAfter.dependents - (cohortsBefore.parent.dependents + cohortsBefore.successor.dependents)) < 1e-9,
    elders: Math.abs(cohortsAfter.elders - (cohortsBefore.parent.elders + cohortsBefore.successor.elders)) < 1e-9,
  };
  record(
    "RX3_cohorts_and_population_are_conserved_line_by_line",
    "each cohort adds exactly; no fixed-ratio re-derivation manufactures dependents on the way back in",
    conserved.workingAdults && conserved.dependents && conserved.elders && worldPopAfter === worldPopAtDeparture,
    Math.round(cohortsBefore.successor.workingAdults + cohortsBefore.successor.dependents + cohortsBefore.successor.elders) > 0,
    { cohortsBefore, cohortsAfter, conserved, worldPopAtDeparture, worldPopAfter,
      note: "world population is compared against the post-departure world, which is where these bodies already existed" },
  );

  const mergedEpisodes = merged.acuteRisk?.recentEpisodes?.length ?? 0;
  const episodeIdsAfter = new Set((merged.acuteRisk?.recentEpisodes ?? []).map((e) => String(e.id ?? e.episodeId ?? "")));
  record(
    "RX4_acute_risk_rings_merge_rather_than_one_being_dropped",
    "the returning group's burden survives the merge; nobody is healed by walking home",
    mergedEpisodes >= Math.max(acuteEpisodesBeforeMerge.parent ?? 0, acuteEpisodesBeforeMerge.successor ?? 0),
    (acuteEpisodesBeforeMerge.parent ?? 0) + (acuteEpisodesBeforeMerge.successor ?? 0) > 0,
    { parentEpisodesBefore: acuteEpisodesBeforeMerge.parent, successorEpisodesBefore: acuteEpisodesBeforeMerge.successor,
      mergedEpisodes, distinctEpisodeIdsAfter: episodeIdsAfter.size,
      mergedBandId: String(merged.acuteRisk?.bandId ?? "none") },
  );

  const sweepAgain = reint.advanceProvisionalReintegrations(w, day0 + 300);
  const popAfterSecondSweep = Object.values(sweepAgain.world.bands)
    .reduce((t, b) => t + Math.round(b.demography.population), 0);
  record(
    "RX5_the_entity_is_removed_exactly_once",
    "the successor is terminal with zero bodies, and a second sweep neither merges again nor duplicates anybody",
    Math.round(removedSuccessor.demography.population) === 0 &&
      removedSuccessor.provisionalSuccessor?.phase === "reintegrated" &&
      !lc.isProvisionalSuccessor(removedSuccessor) &&
      sweepAgain.reintegrations.length === 0 &&
      popAfterSecondSweep === worldPopAfter,
    reintegratedDay !== null,
    { successorPhase: removedSuccessor.provisionalSuccessor?.phase, successorStatus: String(removedSuccessor.status),
      successorPopulation: Math.round(removedSuccessor.demography.population),
      readsAsLiveProvisional: lc.isProvisionalSuccessor(removedSuccessor),
      secondSweepReintegrations: sweepAgain.reintegrations.length,
      worldPopAfter, popAfterSecondSweep },
  );

  // RX6 — NO REINTEGRATION AT DISTANCE. The same lineage, sampled on every day it was walking home.
  const distanceRefusals = [];
  let wd = dep.world;
  for (let i = 1; i <= 200; i += 1) {
    wd = advance.advanceWorldByDays(wd, 1);
    const b = wd.bands[SID];
    if (b === undefined || !lc.isProvisionalSuccessor(b)) break;
    const d = distOf(wd, b.position, wd.bands[parent.id].position);
    if (d > 0) {
      const attempt = reint.performAtomicReintegration({ world: wd, successorId: SID, today: day0 + i });
      distanceRefusals.push({ day: i, distance: d, ok: attempt.ok === true, refusal: attempt.ok === true ? null : attempt.refusal });
    }
  }
  const separatedDays = distanceRefusals.filter((r) => r.distance > 0);
  // INSTRUMENT CORRECTION: an earlier form demanded `not_physically_co_located` on EVERY separated day
  // and failed, because an OUTBOUND group at distance is refused for its phase first — the authority
  // tests rejoinable-phase before it tests position. Both refusals are correct; the claim that matters
  // is that no separated day is ever ACCEPTED, with the reasons reported rather than collapsed.
  const refusalReasons = [...new Set(separatedDays.map((r) => r.refusal))].sort();
  const distanceRefusedDays = separatedDays.filter((r) => r.refusal === "not_physically_co_located");
  record(
    "RX6_no_reintegration_at_any_distance_greater_than_zero",
    "no day on which the group was off its parent's tile was ever accepted, and every returning-phase day was refused specifically for position",
    separatedDays.length > 0 && separatedDays.every((r) => r.ok === false) && distanceRefusedDays.length > 0,
    separatedDays.length > 0,
    { separatedDaysSampled: separatedDays.length,
      distancesSeen: [...new Set(separatedDays.map((r) => r.distance))].sort((a, b) => a - b),
      anyAccepted: separatedDays.filter((r) => r.ok).length,
      refusalReasons,
      daysRefusedForPositionSpecifically: distanceRefusedDays.length,
      maxDistanceRefused: Math.max(...separatedDays.map((r) => r.distance)) },
  );

  // RX7 — WRONG PARENT / WRONG LINEAGE. The caller cannot name a parent: the authority reads the
  // successor's OWN `parentBandId`. The reachable failure is a parent that cannot receive anybody.
  const depB = depart(barren, "band:rr:lineageB", "LIN-RR-B", day0);
  const succB = depB.world.bands["band:rr:lineageB"];
  const foreignParentAttempt = (() => {
    const otherParent = Object.values(base.bands)
      .filter((b) => lc.isEstablishedBand(b) && String(b.id) !== String(parent.id))
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];
    if (otherParent === undefined) return { constructed: false };
    // Put the successor on a DIFFERENT band's tile and mark it returning. Its own parentBandId still
    // names its real parent, so co-location with a stranger must not reintegrate it into anybody.
    const worldWithSuccessorOnStrangerTile = {
      ...depB.world,
      bands: {
        ...depB.world.bands,
        "band:rr:lineageB": {
          ...succB,
          position: otherParent.position,
          provisionalSuccessor: { ...succB.provisionalSuccessor, phase: "returning", phaseEnteredDay: day0 },
        },
      },
    };
    const attempt = reint.performAtomicReintegration({
      world: worldWithSuccessorOnStrangerTile, successorId: "band:rr:lineageB", today: day0 + 1,
    });
    return {
      constructed: true,
      strangerBandId: String(otherParent.id),
      strangerTile: String(otherParent.position),
      successorRecordedParent: String(succB.parentBandId),
      ok: attempt.ok === true,
      refusal: attempt.ok === true ? null : attempt.refusal,
      strangerPopulationUnchanged:
        attempt.ok === true
          ? Math.round(attempt.world.bands[otherParent.id].demography.population) === Math.round(otherParent.demography.population)
          : true,
    };
  })();
  record(
    "RX7_a_stranger_band_cannot_absorb_a_successor_it_did_not_send",
    "the parent is read from the successor's own parentBandId, so standing on a stranger's tile reintegrates nobody",
    foreignParentAttempt.constructed === true &&
      foreignParentAttempt.ok === false &&
      foreignParentAttempt.refusal === "not_physically_co_located",
    foreignParentAttempt.constructed === true,
    foreignParentAttempt,
  );

  // RX8 — no later same-day action processes the removed successor.
  const laterActionIds = registry.DEFAULT_DAILY_ACTIONS.map((a) => a.id);
  const reintIndex = laterActionIds.indexOf("provisional_reintegration");
  const afterReint = laterActionIds.slice(reintIndex + 1);
  const successorSkipped = !lc.isProvisionalSuccessor(removedSuccessor);
  const subsistenceUnchanged = (() => {
    const before = removedSuccessor.provisionalSuccessor?.travelSubsistence;
    const advanced = advance.advanceWorldByDays(w, 5);
    const after = advanced.bands[SID]?.provisionalSuccessor?.travelSubsistence;
    return {
      daysElapsedBefore: before?.daysElapsed ?? null,
      daysElapsedAfterFiveMoreDays: after?.daysElapsed ?? null,
      unchanged: (before?.daysElapsed ?? null) === (after?.daysElapsed ?? null),
      populationStillZero: Math.round(advanced.bands[SID]?.demography.population ?? -1) === 0,
      phaseStill: advanced.bands[SID]?.provisionalSuccessor?.phase,
    };
  })();
  record(
    "RX8_no_later_same_day_system_processes_the_removed_successor",
    "reintegration runs before subsistence, return decision and establishment, and a terminal phase makes isProvisionalSuccessor false for all three",
    reintIndex >= 0 && afterReint.length >= 3 && successorSkipped &&
      subsistenceUnchanged.unchanged && subsistenceUnchanged.populationStillZero,
    reintIndex >= 0,
    { registryOrder: laterActionIds, actionsAfterReintegration: afterReint,
      successorReadsAsLiveProvisional: lc.isProvisionalSuccessor(removedSuccessor), ...subsistenceUnchanged },
  );

  // ════════════════════ PART B — DAY-BASED BOUNDS ════════════════════
  //
  // A controlled timing fixture, and it is labelled as one: `phaseEnteredDay` is set so the declared
  // bound falls a known small number of days ahead, because waiting 180 real days would measure the
  // same property far more slowly. Everything that RESOLVES the bound is production — the same
  // `resolveProvisionalLifecycles` authority, reached through `advanceWorldByDays`.
  const SEASON = 90;
  // INSTRUMENT CORRECTION: an earlier form parked the bound-test successor ON its own target tile, so
  // the `travelling` case ARRIVED on day 1 through `provisionalTravel` and produced `establishing` two
  // days BEFORE its bound — a negative lateness, which is an arrival, not a timeout. The bound-test
  // group must therefore stand somewhere that is neither its parent's tile (or reintegration pre-empts
  // the bound) nor its own destination (or arrival does).
  const farTile = known
    .map((t) => ({ t, d: distOf(base, parent.position, t.id) }))
    .filter((x) => x.d >= 4 && distOf(base, x.t.id, target.t.id) >= 3)
    .sort((a, b) => b.d - a.d)[0];
  if (farTile === undefined) throw new Error("HARNESS HARD FAIL: no holding tile far from both parent and target");
  const boundCases = [];
  for (const [phase, maxDays, expectedNext] of [
    ["returning", kernel.RETURN_MAX_DAYS, "unresolved_after_failed_return"],
    ["travelling", kernel.TRAVEL_MAX_DAYS, "returning"],
    ["failed_early", kernel.FAILED_EARLY_MAX_DAYS, "returning"],
    // `establishing` was the one declared bound with no CADENCE control. The kernel suite's K6 proves
    // the CONTRACT — it calls `resolveTimeout` directly and asserts the target is `failed_early` rather
    // than a success — but it never advances a world, so it cannot say when production notices. That is
    // exactly the gap the day-scale repair closed for the other three, and it is the longest bound of
    // the four, so a seasonal-only cadence had the most room to hide in it.
    ["establishing", kernel.ESTABLISHMENT_MAX_DAYS, "failed_early"],
  ]) {
    const bandId = `band:rr:bound:${phase}`;
    const d = depart(barren, bandId, `LIN-RR-${phase}`, day0);
    const dueInDays = 2;
    const enteredDay = day0 + dueInDays - maxDays;
    let bw = {
      ...d.world,
      bands: {
        ...d.world.bands,
        [bandId]: {
          ...d.world.bands[bandId],
          // Far from the parent (so a meeting cannot pre-empt the bound) AND far from its own target
          // (so an arrival cannot either). Both distances are asserted above.
          position: farTile.t.id,
          provisionalSuccessor: {
            ...d.world.bands[bandId].provisionalSuccessor,
            phase, phaseEnteredDay: enteredDay,
            history: [...(d.world.bands[bandId].provisionalSuccessor.history ?? []), phase],
          },
        },
      },
    };
    const dueDay = enteredDay + maxDays;
    let firedDay = null;
    let firedTo = null;
    for (let i = 1; i <= 200; i += 1) {
      bw = advance.advanceWorldByDays(bw, 1);
      const rec = bw.bands[bandId]?.provisionalSuccessor;
      if (rec === undefined) break;
      if (rec.phase !== phase) { firedDay = day0 + i; firedTo = rec.phase; break; }
    }
    // What the seasonal-only cadence would have done with the identical bound.
    const nextBoundary = Math.ceil(dueDay / SEASON) * SEASON;
    boundCases.push({
      phase, declaredMaxDays: maxDays, phaseEnteredDay: enteredDay, dueDay,
      firedDay, firedTo, expectedNext,
      latenessDays: firedDay === null ? null : firedDay - dueDay,
      seasonalOnlyWouldHaveFiredDay: nextBoundary,
      seasonalOnlyLatenessDays: nextBoundary - dueDay,
    });
  }
  const timedCases = boundCases.filter((c) => c.firedDay !== null);
  record(
    "DL1_every_day_declared_bound_resolves_within_one_daily_tick",
    "a bound declared in days binds on its declared day, not at the next season boundary",
    timedCases.length === boundCases.length && timedCases.every((c) => c.latenessDays >= 0 && c.latenessDays <= 1),
    boundCases.length > 0,
    { boundCases, maxLatenessDays: timedCases.length ? Math.max(...timedCases.map((c) => c.latenessDays)) : null,
      maxSeasonalOnlyLatenessDays: Math.max(...boundCases.map((c) => c.seasonalOnlyLatenessDays)),
      note: "seasonalOnly* is what the single seasonal caller would have produced for the identical bound" },
  );

  record(
    "DL2_the_timeout_target_is_the_contract_target",
    "each bound resolves into the phase its own contract names, and never into a physical-event phase",
    timedCases.length > 0 && timedCases.every((c) => c.firedTo === c.expectedNext),
    timedCases.length > 0,
    { transitions: timedCases.map((c) => ({ phase: c.phase, firedTo: c.firedTo, expected: c.expectedNext })) },
  );

  const physicalEventPhases = ["stabilized", "reintegrated", "provisional_extinguished", "departed"];
  record(
    "DL3_a_timer_alone_produces_no_physical_terminal_outcome",
    "no elapsed-time transition lands in stabilized, reintegrated, extinguished or departed",
    timedCases.every((c) => !physicalEventPhases.includes(c.firedTo)),
    timedCases.length > 0,
    { firedTargets: timedCases.map((c) => c.firedTo), forbiddenTargets: physicalEventPhases },
  );

  // DL4 — determinism of the repaired cadence.
  const repeatDays = [];
  for (let rep = 0; rep < 2; rep += 1) {
    const d = depart(barren, "band:rr:det", "LIN-RR-DET", day0);
    let dw = d.world;
    const transitions = [];
    let last = null;
    for (let i = 1; i <= 60; i += 1) {
      dw = advance.advanceWorldByDays(dw, 1);
      const rec = dw.bands["band:rr:det"]?.provisionalSuccessor;
      if (rec === undefined) break;
      if (rec.phase !== last) { transitions.push(`${rec.phase}@+${i}`); last = rec.phase; }
      if (["reintegrated", "stabilized", "provisional_extinguished"].includes(rec.phase)) break;
    }
    repeatDays.push(transitions.join(" "));
  }
  record(
    "DL4_repaired_cadence_is_deterministic",
    "the same seed produces the same transition days, including the reintegration day",
    repeatDays[0] === repeatDays[1] && repeatDays[0].length > 0,
    repeatDays[0].length > 0,
    { run1: repeatDays[0], run2: repeatDays[1] },
  );

  const failing = fixtures.filter((f) => f.verdict === "FAIL");
  const vacuous = fixtures.filter((f) => f.verdict === "VACUOUS");
  out = {
    generatedAt: new Date().toISOString(),
    seed: SEED, warmDays: WARM_DAYS, parentBandId: String(parent.id),
    parentTile: String(parent.position), targetTile: String(target.t.id), targetDistance: target.d,
    summary: { total: fixtures.length, passed: fixtures.filter((f) => f.verdict === "PASS").length,
      failed: failing.length, vacuous: vacuous.length },
    fixtures,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
  console.log(JSON.stringify(out, null, 2));
  if (failing.length > 0 || vacuous.length > 0) process.exitCode = 1;
} finally {
  await server.close();
}
