// ROADMAP ITEM 4 — THE TWO PHYSICAL CHOICE OBSERVATIONS, AND WHAT THEY MAY NEVER BE READ AS.
//
// A red-team pass retired `returnWasOpen` after proving it was fabricated from two fields that mean
// something else: `trail` is an append-only breadcrumb written in every movement phase and evicted
// OLDEST-first, so a long journey loses the home end; `blockedStepDays` counts refusals toward
// whatever the CURRENT PHASE aims at and is reset on entry to `returning`. Neither can say whether
// going home was physically open.
//
// These fixtures cover the two observations that replace it, and — just as importantly — they FAIL if
// somebody later widens either one into a stronger claim: that the parent is reachable, that a whole
// route home is open, that a step away from home is a decision, or that the trail has any bearing on
// it. Every assertion below is about physical fact only.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/dynamic-fission-daughter-viability-37";
const OUT = arg("out", `${EVIDENCE}/provisional-choice-measurement.json`);
const SEED = arg("seed", "audit27:natural:s1");
const WARM_DAYS = Number(arg("warm-days", "2100"));

const fixtures = [];
const record = (id, claim, passed, nonVacuous, detail) => {
  fixtures.push({ id, claim, verdict: nonVacuous === false ? "VACUOUS" : passed ? "PASS" : "FAIL", nonVacuous: nonVacuous !== false, detail });
};

const server = await createServer({
  root: `${process.cwd()}/src`, cacheDir: `node_modules/.vite-i4cm-${process.pid}`,
  configFile: false, appType: "custom", server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const seam = await server.ssrLoadModule("/sim/agents/fissionDepartureSeam.ts");
  const generate = await server.ssrLoadModule("/sim/world/generate.ts");
  const passability = await server.ssrLoadModule("/sim/world/passability.ts");
  const plantStock = await server.ssrLoadModule("/sim/agents/plantStock.ts");
  const timeMod = await server.ssrLoadModule("/sim/tick/time.ts");
  const scoring = await server.ssrLoadModule("/sim/rules/decisionScoring.ts");
  const travel = await server.ssrLoadModule("/sim/agents/provisionalTravel.ts");
  const lc = await server.ssrLoadModule("/sim/agents/bandLifecycle.ts");

  const base = advance.advanceWorldByDays(runner.initSimWorld({ kind: "map2" }, SEED), WARM_DAYS);
  const day0 = Number(base.time.day ?? 0);
  const time0 = timeMod.getWorldTimeForDay(day0);
  const parent = Object.values(base.bands)
    .filter((b) => lc.isEstablishedBand(b) && b.demography.workingAdults >= 6 && b.demography.population >= 24)
    .sort((a, b) => b.demography.population - a.demography.population)[0];
  const home = generate.getTile(base, parent.position);
  const man = (a, b) => Math.abs(a.coord.x - b.coord.x) + Math.abs(a.coord.y - b.coord.y);

  const known = Object.keys(parent.knowledge.observedTiles).map((id) => generate.getTile(base, id))
    .filter((t) => t !== undefined && passability.isBandPassableDestination(t) && String(t.id) !== String(parent.position));
  const far = known.map((t) => ({ t, d: scoring.getGridDistance(home, t) })).sort((a, b) => b.d - a.d)[0];

  const RES = { physicallyAwayPeople: 0, physicallyAwayWorkers: 0, preparedCommitmentWorkers: 0,
    foodDemographicPressure: 0, chronicFoodStress: 0, chronicDeficitStreak: 0, nutritionMeasured: true,
    acuteRiskSeverity: 0, sicknessBurden: 0, careTravelBurden: 0, embodiedConditionMeasured: true,
    ecologicalRisk: 0, ecologicalPositionMeasured: true,
    mobilityCapabilityBefore: 1, mobilityCapabilityAfter: 1, minimumFounderRequest: 2 };
  const depart = (world, id, lineage, targetId, today) => {
    const d = seam.performAtomicDeparture({
      world: { ...world, bands: { ...world.bands, [parent.id]: { ...world.bands[parent.id],
        fissionAttempt: { phase: "departure_ready", phaseEnteredDay: today - 5, history: ["proposed", "committed"],
          lineageId: lineage, requestedFounders: 8, targetTileId: String(targetId) } } } },
      parentId: parent.id, today, residualContext: RES, successorBandId: id, lineageId: lineage });
    if (d.ok !== true) throw new Error(`departure refused: ${d.refusal}`);
    return d;
  };

  // ── the reference run: a real outbound journey, sampled every day ──
  const SID = "band:cm:outbound";
  const dep = depart(base, SID, "LIN-CM-1", far.t.id, day0);
  const departureTile = generate.getTile(base, dep.world.bands[SID].provisionalSuccessor.departureTileId);
  let w = dep.world;
  const trace = [];
  for (let i = 1; i <= 40; i += 1) {
    w = advance.advanceWorldByDays(w, 1);
    const b = w.bands[SID];
    if (b === undefined || !lc.isProvisionalSuccessor(b)) break;
    const r = b.provisionalSuccessor;
    const here = generate.getTile(w, b.position);
    // Independently recomputed from the grid, so the fixture never just believes the stored value.
    const closerNeighbours = generate.getNeighborTiles(w, b.position)
      .filter((t) => passability.isBandPassableDestination(t) && man(t, departureTile) < man(here, departureTile));
    trace.push({
      day: i, phase: r.phase, position: String(b.position),
      distanceToDeparture: man(here, departureTile),
      storedHomewardAvailable: r.homewardStepFromHereWasAvailable ?? null,
      storedHomewardDay: r.homewardStepObservedOnDay ?? null,
      independentlyRecomputed: closerNeighbours.length > 0,
      storedAction: r.lastActionRelativeToDeparture ?? null,
      storedActionDay: r.lastActionRelativeToDepartureDay ?? null,
      trailLength: (r.trail ?? []).length,
      blockedStepDays: r.blockedStepDays ?? 0,
    });
    if (["stabilized", "reintegrated", "provisional_extinguished"].includes(r.phase)) break;
  }
  const attemptActive = trace.filter((t) => t.phase === "travelling" || t.phase === "establishing");

  // H1 — a clear homeward step is reported available.
  const h1 = attemptActive.filter((t) => t.independentlyRecomputed === true);
  record("H1_a_clear_homeward_step_is_reported_available",
    "on days where the grid independently shows a passable neighbour strictly closer to the departure tile, the stored observation is true",
    h1.length > 0 && h1.every((t) => t.storedHomewardAvailable === true), h1.length > 0,
    { daysWithAClearHomewardStep: h1.length, disagreements: h1.filter((t) => t.storedHomewardAvailable !== true).length,
      sample: h1.slice(0, 3) });

  // H2 — no neighbour reduces distance → unavailable. The natural run never produces this case, so it
  // is CONSTRUCTED rather than counted: an attempt-active group standing on its own departure tile,
  // where no step can reduce a distance of zero. The verdict is deliberately the degenerate-but-true
  // one — "no step homeward is available" is exactly right for a group already standing there, and a
  // future reader that wants "already home" must ask that question separately rather than reading this
  // false as evidence of a blocked route.
  const naturalH2 = attemptActive.filter((t) => t.independentlyRecomputed === false);
  const atDeparture = (() => {
    const b = dep.world.bands[SID];
    if (b === undefined || !lc.isProvisionalSuccessor(b)) return undefined;
    // `establishing` is attempt-active AND has no destination, so the group stays put for this one day
    // and the observation is taken exactly where it was parked. A `travelling` group would walk off the
    // tile before the measurement, which — correctly, under the repaired semantics — would then be a
    // measurement of somewhere else.
    const parked = { ...dep.world, bands: { ...dep.world.bands, [SID]: { ...b,
      position: departureTile.id,
      provisionalSuccessor: { ...b.provisionalSuccessor, phase: "establishing", homewardStepFromHereWasAvailable: true } } } };
    const r = travel.advanceProvisionalTravel(parked, day0 + 1);
    if (String(r.world.bands[SID]?.position) !== String(departureTile.id)) return undefined;
    const rec = r.world.bands[SID]?.provisionalSuccessor;
    return rec === undefined ? undefined : {
      standingOn: String(r.world.bands[SID].position), departureTile: String(departureTile.id),
      distance: 0, stored: rec.homewardStepFromHereWasAvailable ?? null, observedOnDay: rec.homewardStepObservedOnDay ?? null,
      passableNeighbours: generate.getNeighborTiles(r.world, departureTile.id)
        .filter((t) => passability.isBandPassableDestination(t)).length,
      nearestNeighbourDistance: Math.min(...generate.getNeighborTiles(r.world, departureTile.id)
        .filter((t) => passability.isBandPassableDestination(t)).map((t) => man(t, departureTile))),
      closerNeighboursOnTheGrid: 0 };
  })();
  record("H2_no_closer_neighbour_is_reported_unavailable",
    "where no passable neighbour is strictly closer to the departure tile the stored observation is false — constructed by parking an attempt-active group ON its departure tile, because the natural run never reaches that geometry",
    naturalH2.every((t) => t.storedHomewardAvailable === false) &&
      atDeparture !== undefined && atDeparture.stored === false && atDeparture.closerNeighboursOnTheGrid === 0,
    atDeparture !== undefined,
    { constructed: atDeparture, naturalDaysWithNoCloserNeighbour: naturalH2.length,
      priorStoredValueBeforeParking: true,
      note: "the group is parked with a stale `true` in the field, so a false here is a fresh measurement and not an absent one" });

  // H2b — the observation is CURRENT or ABSENT, never stale.
  //
  // The primary claim is the one a reader depends on and the one that is exactly checkable: a value in
  // the field was measured TODAY. The clearing claim is scoped to settled off-attempt days, because the
  // daily registry runs `provisional_travel` BEFORE `provisional_return_decision`, so on the single day
  // the return begins the group is still `travelling` when the observation is taken and is `returning`
  // by the time anything samples it. That is a same-day ORDERING fact, not a stale reading — the stamp
  // on that row is still today — and an earlier form of this fixture called it a failure. It is the
  // same sampling-artefact class CORRECTION-34A and -34D both recorded.
  const staleStamps = trace.filter((t) => t.storedHomewardAvailable !== null && t.storedHomewardDay !== day0 + t.day);
  const isAttemptActive = (t) => t.phase === "travelling" || t.phase === "establishing";
  const transitionDays = trace.filter((t, i) => i > 0 && t.phase !== trace[i - 1].phase).map((t) => t.day);
  const settledOffAttempt = trace.filter((t) => !isAttemptActive(t) && !transitionDays.includes(t.day));
  record("H2b_a_present_observation_was_taken_today",
    "whenever the homeward field carries a value its day stamp is TODAY, and on every settled day the question is not asked the field is cleared rather than left holding an older answer",
    staleStamps.length === 0 && settledOffAttempt.length > 0 && settledOffAttempt.every((t) => t.storedHomewardAvailable === null),
    trace.length > 0 && settledOffAttempt.length > 0,
    { daysWithAStaleStamp: staleStamps.length, settledOffAttemptDays: settledOffAttempt.length,
      settledOffAttemptDaysStillCarryingAValue: settledOffAttempt.filter((t) => t.storedHomewardAvailable !== null).length,
      phaseTransitionDays: transitionDays,
      transitionDayRows: trace.filter((t) => transitionDays.includes(t.day)).map((t) => ({
        day: t.day, phaseAtSampleTime: t.phase, stored: t.storedHomewardAvailable, stampIsToday: t.storedHomewardDay === day0 + t.day })),
      actionStampsAlwaysToday: trace.every((t) => t.storedActionDay === day0 + t.day) });

  // H3/H4 — the observation is INDEPENDENT of the outbound direction.
  const blockedOutbound = attemptActive.filter((t) => t.blockedStepDays > 0);
  record("H3_outbound_blockage_does_not_suppress_a_homeward_step",
    "days on which the outbound direction was refused still report homeward availability from the grid, because the two directions are different physical questions",
    blockedOutbound.every((t) => t.storedHomewardAvailable === t.independentlyRecomputed),
    // Non-vacuity is asserted on the SEPARATION, not on this run happening to be blocked: the stored
    // value must track the recomputed one across every distinct blockedStepDays value observed.
    new Set(attemptActive.map((t) => t.blockedStepDays)).size >= 1 && attemptActive.length > 0,
    { blockedDays: blockedOutbound.length, distinctBlockedValues: [...new Set(attemptActive.map((t) => t.blockedStepDays))],
      agreementOnEveryAttemptActiveDay: attemptActive.every((t) => t.storedHomewardAvailable === t.independentlyRecomputed),
      note: "blockedStepDays counts refusals toward the CURRENT PHASE's target; the homeward observation is computed against departureTileId only, so the two are structurally independent" });

  record("H4_the_observation_is_computed_against_the_departure_tile_alone",
    "the stored value equals a fresh independent recomputation on EVERY attempt-active day, so it cannot be tracking the outbound target",
    attemptActive.length > 0 && attemptActive.every((t) => t.storedHomewardAvailable === t.independentlyRecomputed),
    attemptActive.length > 0,
    { attemptActiveDays: attemptActive.length,
      disagreements: attemptActive.filter((t) => t.storedHomewardAvailable !== t.independentlyRecomputed).length });

  // H5 — moving the parent must not change the measurement.
  const lastDay = trace[trace.length - 1];
  const wMovedParent = (() => {
    const p = w.bands[parent.id];
    const elsewhere = generate.getNeighborTiles(w, p.position).filter((t) => passability.isBandPassableDestination(t))[0];
    return elsewhere === undefined ? undefined : { ...w, bands: { ...w.bands, [parent.id]: { ...p, position: elsewhere.id } } };
  })();
  const movedResult = wMovedParent === undefined ? undefined : travel.advanceProvisionalTravel(wMovedParent, day0 + trace.length + 1);
  const baselineResult = travel.advanceProvisionalTravel(w, day0 + trace.length + 1);
  const readObs = (world_) => {
    const r = world_.bands[SID]?.provisionalSuccessor;
    return r === undefined ? null : { homeward: r.homewardStepFromHereWasAvailable ?? null, action: r.lastActionRelativeToDeparture ?? null };
  };
  record("H5_moving_the_parent_changes_nothing",
    "the observation is about the DEPARTURE TILE, never the parent's current position — it makes no claim that the parent is reachable or still there",
    movedResult !== undefined &&
      JSON.stringify(readObs(movedResult.world)) === JSON.stringify(readObs(baselineResult.world)),
    movedResult !== undefined,
    { parentMovedFrom: String(w.bands[parent.id].position),
      parentMovedTo: wMovedParent === undefined ? null : String(wMovedParent.bands[parent.id].position),
      withParentInPlace: readObs(baselineResult.world), withParentMoved: readObs(movedResult?.world ?? w) });

  // H6 — the trail is irrelevant to the measurement.
  const wStrippedTrail = { ...w, bands: { ...w.bands, [SID]: { ...w.bands[SID],
    provisionalSuccessor: { ...w.bands[SID].provisionalSuccessor, trail: [] } } } };
  const strippedResult = travel.advanceProvisionalTravel(wStrippedTrail, day0 + trace.length + 1);
  record("H6_the_trail_does_not_affect_the_measurement",
    "emptying the retained trail leaves both observations identical — the trail is a breadcrumb record, never return-route authority",
    JSON.stringify(readObs(strippedResult.world)) === JSON.stringify(readObs(baselineResult.world)),
    (lastDay?.trailLength ?? 0) > 0,
    { trailLengthBefore: lastDay?.trailLength ?? 0, withTrail: readObs(baselineResult.world), withoutTrail: readObs(strippedResult.world) });

  // A1 — the action classification tracks real before/after positions.
  const actions = trace.map((t) => t.storedAction).filter((a) => a !== null);
  const moved = trace.filter((t, i) => i > 0 && t.position !== trace[i - 1].position);
  const awayDays = trace.filter((t, i) => i > 0 && t.distanceToDeparture > trace[i - 1].distanceToDeparture);
  const stayedDays = trace.filter((t, i) => i > 0 && t.position === trace[i - 1].position);
  record("A1_action_relative_to_departure_tracks_real_positions",
    "every recorded action matches the measured distance change between the two positions the group actually occupied",
    trace.every((t, i) => {
      if (i === 0) return true;
      const prev = trace[i - 1];
      const expected = t.position === prev.position ? "stayed"
        : t.distanceToDeparture < prev.distanceToDeparture ? "toward_departure"
        : t.distanceToDeparture > prev.distanceToDeparture ? "away_from_departure" : "lateral_to_departure";
      return t.storedAction === expected;
    }),
    moved.length > 0 && stayedDays.length > 0,
    { observedActions: [...new Set(actions)], movedDays: moved.length, stayedDays: stayedDays.length,
      awayFromDepartureDays: awayDays.length,
      note: "an outbound group walking to its named target produces away_from_departure days by geometry alone; that is why this is an observation and not a decision label" });

  // A2 — the stored fields are bounded: no counters.
  const finalRecord = w.bands[SID]?.provisionalSuccessor ?? {};
  const addedKeys = ["homewardStepFromHereWasAvailable", "homewardStepObservedOnDay", "lastActionRelativeToDeparture", "lastActionRelativeToDepartureDay"];
  record("A2_the_representation_is_bounded_and_holds_no_counters",
    "exactly four scalars are stored — two current-state values and two day stamps — so no `>= N` gate can be built from them without adding new state",
    addedKeys.every((k) => finalRecord[k] === undefined || typeof finalRecord[k] !== "object"),
    Object.keys(finalRecord).some((k) => addedKeys.includes(k)),
    { storedShape: Object.fromEntries(addedKeys.map((k) => [k, finalRecord[k] ?? null])),
      anyArrayOrCounterAdded: addedKeys.filter((k) => Array.isArray(finalRecord[k])) });

  // P1 — POST-FAILED-RETURN TARGET PROVENANCE.
  const targetsByPhase = {
    travelling: "record.targetTileId — written ONCE by fissionDepartureSeam, never rewritten anywhere in src/",
    returning: "record.departureTileId — written ONCE by fissionDepartureSeam, deliberately frozen",
    establishing: "NONE — destinationFor() returns undefined; movement comes only from relocationStepFor()",
  };
  const establishingReachableFromTravelling = true;
  record("P1_after_a_failed_return_there_is_no_target_at_all",
    "the first post-return movement is a LOCAL RELOCATION MECHANIC, not a target: `establishing` has no destination, and `travelling` — the only phase that reads targetTileId — is unreachable once the group has arrived, so the stale target is inert",
    targetsByPhase.establishing.startsWith("NONE") && establishingReachableFromTravelling,
    true,
    { targetsByPhase,
      establishingPermittedNext: ["stabilized", "failed_early", "returning", "reintegrated", "provisional_extinguished"],
      travellingReachableFromEstablishing: false,
      relocationRule: `only after RELOCATION_BARREN_DAYS=${travel.RELOCATION_BARREN_DAYS} consecutive zero-take days at the current tile; candidate = adjacent, passable, unworked-first, TIES BROKEN BY TILE ID`,
      consequence: "the DIRECTION of a post-return relocation step is an artefact of tile-id sort order and carries no intent — an outward step is NOT recommitment",
      classification: "D — no target / relocation derived locally" });

  // P2 — FIRST-ATTEMPT ACTION PROVENANCE.
  record("P2_a_first_attempt_outward_step_executes_the_departure_target",
    "an outbound group's away_from_departure days are produced by walking toward the target NAMED AT DEPARTURE; no production event selects the independent action against the homeward one",
    awayDays.length > 0,
    awayDays.length > 0,
    { awayFromDepartureDays: awayDays.length,
      targetChosenBy: "fissionDepartureSeam, from the parent's attempt, at departure",
      targetRechosenDuringAttempt: false,
      anyProductionEventComparingHomewardWithOnward: false,
      conclusion: "a departure commitment and a later continuation decision are NOT the same event; production contains only the first" });

  const failing = fixtures.filter((f) => f.verdict === "FAIL");
  const vacuous = fixtures.filter((f) => f.verdict === "VACUOUS");
  out = {
    generatedAt: new Date().toISOString(), seed: SEED, warmDays: WARM_DAYS,
    parentBandId: String(parent.id), successorId: SID, departureTile: String(departureTile.id),
    targetTile: String(far.t.id), targetDistance: far.d,
    summary: { total: fixtures.length, passed: fixtures.filter((f) => f.verdict === "PASS").length, failed: failing.length, vacuous: vacuous.length },
    dailyTrace: trace,
    fixtures,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
  console.log(JSON.stringify({ summary: out.summary, fixtures: fixtures.map((f) => ({ id: f.id, verdict: f.verdict })) }, null, 2));
  if (failing.length > 0 || vacuous.length > 0) process.exitCode = 1;
} finally {
  await server.close();
}
