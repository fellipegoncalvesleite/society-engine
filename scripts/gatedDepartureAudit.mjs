// ROADMAP ITEM 4 — THE ATOMIC DEPARTURE GATE.
//
// `performAtomicDeparture` used to decide, while it was executing, who was leaving: it read a
// founder count off the attempt, allocated a cohort, ran the parent-residual authority on numbers
// its CALLER supplied, took the revision, re-allocated, and only then moved bodies. So there were
// two answers to "who exactly is leaving" and two moments at which the parent-side terms could
// change, and the only thing between a hand-built record and eleven people walking out of a camp
// was a phase string.
//
// These fixtures are about whether that is over. The decisive ones are A (the old bypass is refused
// outright), C (the REVISED cohort is what physically moves), G/H (freshness cannot be faked because
// there is no longer any surface to fake it through), J (a late refusal leaves the permit unspent)
// and F (the same permit cannot move bodies twice).
import { createServer } from "vite";
import { mkdirSync, writeFileSync, readFileSync, copyFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import { bestKnownTargetAtDistance } from "./lib/preparedDeparture.mjs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/dynamic-fission-daughter-viability-37";
const OUT = arg("out", `${EVIDENCE}/gated-departure.json`);
const SEED = arg("seed", "audit27:natural:s1");
const WARM_DAYS = Number(arg("warm-days", "2100"));

const fixtures = [];
const record = (id, claim, passed, nonVacuous, detail) => {
  fixtures.push({ id, claim, verdict: nonVacuous === false ? "VACUOUS" : passed ? "PASS" : "FAIL", nonVacuous: nonVacuous !== false, detail });
};
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

const SEAM_SRC = "src/sim/agents/fissionDepartureSeam.ts";

const server = await createServer({
  root: `${process.cwd()}/src`, cacheDir: `node_modules/.vite-i4gate-${process.pid}`,
  configFile: false, appType: "custom", server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const seam = await server.ssrLoadModule("/sim/agents/fissionDepartureSeam.ts");
  const prep = await server.ssrLoadModule("/sim/agents/fissionDeparturePreparation.ts");
  const commitment = await server.ssrLoadModule("/sim/agents/fissionCommitment.ts");
  const measurement = await server.ssrLoadModule("/sim/agents/fissionResidualMeasurement.ts");
  const kernel = await server.ssrLoadModule("/sim/agents/fissionLifecycleKernel.ts");
  const generate = await server.ssrLoadModule("/sim/world/generate.ts");
  const passability = await server.ssrLoadModule("/sim/world/passability.ts");
  const lc = await server.ssrLoadModule("/sim/agents/bandLifecycle.ts");

  const base = advance.advanceWorldByDays(runner.initSimWorld({ kind: "map2" }, SEED), WARM_DAYS);
  const day0 = Number(base.time.day ?? 0);
  const parent = Object.values(base.bands)
    .filter((b) => lc.isEstablishedBand(b) && b.demography.workingAdults >= 6 && b.demography.population >= 24)
    .sort((a, b) => b.demography.population - a.demography.population)[0];
  const target = bestKnownTargetAtDistance(generate, passability, base, parent, 4);
  if (target === undefined) throw new Error("no known passable target at distance >= 4");

  const POLICY = { minimumFounderRequest: 2 };
  const SID = `${parent.id}:provisional:1`;
  const LIN = "LIN-GATE-1";
  const worldPopulation = (w) => Object.values(w.bands).reduce((t, b) => t + Math.round(b.demography.population), 0);
  const cohortsOf = (b) => ({ workingAdults: b.demography.workingAdults, dependents: b.demography.dependents, elders: b.demography.elders });

  /** A parent at the planning stage. `over.band` mutates the band; `over.attempt` the attempt. */
  const planned = (over = {}) => ({
    ...base,
    bands: {
      ...base.bands,
      [parent.id]: {
        ...parent,
        ...(over.band ?? {}),
        demography: { ...parent.demography, splitPressure: 1, ...(over.demography ?? {}) },
        fissionAttempt: {
          phase: "departure_planned", phaseEnteredDay: day0 - 2, history: ["proposed"],
          lineageId: LIN, requestedFounders: over.requestedFounders ?? 8,
          targetTileId: String(target.id), ...(over.attempt ?? {}),
        },
      },
    },
  });

  const prepare = (over = {}, policy = {}) => prep.prepareFissionDeparture({
    world: planned(over), parentId: parent.id, today: day0, policy: { ...POLICY, ...policy } });

  const departFrom = (world, successorBandId = SID) => seam.performAtomicDeparture({
    world, parentId: parent.id, today: day0 + 1, successorBandId, lineageId: LIN });

  const readyWorld = prepare();
  if (readyWorld.ok !== true) throw new Error(`preparation refused: ${readyWorld.refusal} ${readyWorld.detail ?? ""}`);
  const prepared = readyWorld.prepared;
  const beforePop = worldPopulation(readyWorld.world);
  const ordinary = departFrom(readyWorld.world);

  // ══ A — THE OLD BYPASS DIES. THE CENTRAL NEGATIVE CONTROL. ══
  //
  // Exactly what production accepted before this pass: an attempt sitting at `departure_ready` with
  // a founder count and a destination and NOTHING behind it. It used to move bodies.
  const bypassWorld = {
    ...base,
    bands: { ...base.bands, [parent.id]: { ...parent,
      demography: { ...parent.demography, splitPressure: 1 },
      fissionAttempt: { phase: "departure_ready", phaseEnteredDay: day0 - 5,
        history: ["proposed", "departure_planned"], lineageId: LIN,
        requestedFounders: 8, targetTileId: String(target.id) } } },
  };
  const bypassBefore = JSON.stringify(bypassWorld);
  const bypass = departFrom(bypassWorld);
  record("A_a_hand_built_departure_ready_record_moves_nobody",
    "an attempt constructed directly at `departure_ready`, with a founder count and a band-known destination and no preparation behind it, is REFUSED BY NAME — it used to move eleven people with nothing recording that leaving had been chosen",
    bypass.ok === false &&
      bypass.refusal === "departure_not_prepared" &&
      JSON.stringify(bypassWorld) === bypassBefore &&
      bypassWorld.bands[SID] === undefined &&
      Math.round(bypassWorld.bands[parent.id].demography.population) === Math.round(parent.demography.population),
    true,
    { refusal: bypass.ok === false ? bypass.refusal : "ACCEPTED",
      worldUnchanged: JSON.stringify(bypassWorld) === bypassBefore,
      successorCreated: bypassWorld.bands[SID] !== undefined,
      parentPopulation: Math.round(bypassWorld.bands[parent.id].demography.population) });

  // ══ B — AN ORDINARY PREPARED DEPARTURE SUCCEEDS ══
  const succ = ordinary.ok === true ? ordinary.world.bands[SID] : undefined;
  const parentAfter = ordinary.ok === true ? ordinary.world.bands[parent.id] : undefined;
  const alloc = prepared.allocation.successor;
  const exactMatch = succ === undefined ? false :
    succ.demography.workingAdults === alloc.workingAdults &&
    succ.demography.dependents === alloc.dependents &&
    succ.demography.elders === alloc.elders;
  record("B_a_prepared_departure_transfers_exactly_the_accepted_cohort_and_spends_the_permit",
    "the exact prepared allocation moves, the parent loses exactly those three cohort lines, world population is conserved, and the one-use permit ends `consumed_by_departure` in the same mutation",
    ordinary.ok === true && exactMatch &&
      parentAfter.demography.workingAdults === parent.demography.workingAdults - alloc.workingAdults &&
      parentAfter.demography.dependents === parent.demography.dependents - alloc.dependents &&
      parentAfter.demography.elders === parent.demography.elders - alloc.elders &&
      worldPopulation(ordinary.world) === beforePop &&
      ordinary.consumedAuthorization.status === "consumed_by_departure" &&
      parentAfter.fissionAttempt.preparedDeparture.authorization.status === "consumed_by_departure",
    true,
    { preparedCohort: alloc, transferredCohort: succ === undefined ? null : cohortsOf(succ),
      parentBefore: cohortsOf(parent), parentAfter: parentAfter === undefined ? null : cohortsOf(parentAfter),
      worldPopulation: { before: beforePop, after: ordinary.ok === true ? worldPopulation(ordinary.world) : null },
      permitStatus: ordinary.ok === true ? ordinary.consumedAuthorization.status : null });

  // ══ C — A REVISION TRANSFERS THE REVISED COHORT, NOT THE REQUEST ══
  //
  // The request size is SEARCHED against a genuinely burdened parent, because a hard-coded count the
  // authority simply permits produces an honest VACUOUS rather than a false pass.
  const burdenedBand = {
    bodyCampLogistics: {
      behavior: { sicknessActivityPenalty: 0.9 },
      careTravelBurden: { dependentCarryBurden: 0.9, elderTravelCaution: 0.9, pregnancyNursingBurden: 0.9,
        sickCareBurden: 0.9, wholeBandCrossingBurden: 0.9, longMoveBurden: 0.9, coldHeatVulnerability: 0.9,
        adultLaborAvailable: 0.1, reasonIds: [], aggregateOnly: true },
    },
    pressureState: { ...(parent.pressureState ?? {}), riskPressure: 0.9 },
  };
  const revisionSweep = [];
  let revisedPrep;
  for (let ask = 6; ask <= Math.max(6, parent.demography.workingAdults + 8); ask += 2) {
    const p = prepare({ requestedFounders: ask, band: burdenedBand });
    revisionSweep.push({ requested: ask, outcome: p.ok === true
      ? (p.founderRequestWasRevisedDownward ? "revised" : "as_requested") : p.refusal });
    if (p.ok === true && p.founderRequestWasRevisedDownward === true) { revisedPrep = p; break; }
  }
  const revisedDep = revisedPrep === undefined ? undefined : departFrom(revisedPrep.world, `${parent.id}:provisional:rev`);
  const revisedSucc = revisedDep?.ok === true ? revisedDep.world.bands[`${parent.id}:provisional:rev`] : undefined;
  const requestedAlloc = revisedPrep === undefined ? undefined
    : (() => { const a = revisedPrep.prepared; return a; })();
  record("C_the_revised_cohort_is_what_physically_moves",
    "when the residual authority revised the request downward, the bodies that leave are the ENDORSED allocation — not the original request and not a count the transfer recomputed for itself",
    revisedDep?.ok === true && revisedSucc !== undefined &&
      revisedSucc.demography.workingAdults === revisedPrep.prepared.allocation.successor.workingAdults &&
      revisedSucc.demography.dependents === revisedPrep.prepared.allocation.successor.dependents &&
      revisedSucc.demography.elders === revisedPrep.prepared.allocation.successor.elders &&
      revisedDep.endorsedFounders < revisedDep.requestedFounders,
    revisedPrep !== undefined && revisedPrep.founderRequestWasRevisedDownward === true,
    { requested: requestedAlloc?.requestedFounders ?? null,
      endorsed: requestedAlloc?.endorsedFounders ?? null,
      preparedCohort: requestedAlloc?.allocation.successor ?? null,
      transferredCohort: revisedSucc === undefined ? null : cohortsOf(revisedSucc),
      revisionSweep });

  // ══ D — A CORRUPTED ALLOCATION IS REFUSED, NOT REPAIRED ══
  const corruptWorld = (() => {
    const a = readyWorld.world.bands[parent.id].fissionAttempt;
    const p2 = { ...a.preparedDeparture, allocation: { ...a.preparedDeparture.allocation,
      successor: { ...a.preparedDeparture.allocation.successor,
        dependents: a.preparedDeparture.allocation.successor.dependents + 1 } } };
    return { ...readyWorld.world, bands: { ...readyWorld.world.bands,
      [parent.id]: { ...readyWorld.world.bands[parent.id], fissionAttempt: { ...a, preparedDeparture: p2 } } } };
  })();
  const corruptBefore = JSON.stringify(corruptWorld);
  const corrupt = departFrom(corruptWorld);
  record("D_a_mutated_cohort_line_is_refused_without_mutation",
    "moving one dependent between the successor and the remainder makes the record disagree with itself and with the accepted commitment; the departure is refused and the world is returned untouched",
    corrupt.ok === false &&
      JSON.stringify(corruptWorld) === corruptBefore &&
      corruptWorld.bands[SID] === undefined,
    true,
    { refusal: corrupt.ok === false ? corrupt.refusal : "ACCEPTED",
      worldUnchanged: JSON.stringify(corruptWorld) === corruptBefore });

  // ══ D2 — THE ACCEPTED DESTINATION AND THE EXECUTED DESTINATION ARE ONE FACT ══
  //
  // THE DECISIVE FIXTURE OF THIS CORRECTION, and the state it constructs used to DEPART.
  //
  // The gate compared the commitment's destination against `prepared.commitment.targetTileId` — its
  // own — so the check was vacuous, while the successor's lifecycle received `attempt.targetTileId`
  // and `provisionalTravel` walks the group toward exactly that. Everything else here is left
  // untouched and valid: the same commitment, the same allocation, the same live permit, the same
  // fresh parent, the same phase. ONLY the execution target moves, to a second tile the band also
  // genuinely knows — so a refusal cannot be freshness, nutrition, cohort, phase or familiarity.
  const targetB = (() => {
    const here = generate.getTile(base, parent.position);
    const dist = (t) => Math.abs(t.coord.x - here.coord.x) + Math.abs(t.coord.y - here.coord.y);
    return Object.keys(parent.knowledge.observedTiles)
      .map((id) => ({ id, record: parent.knowledge.observedTiles[id], tile: generate.getTile(base, id) }))
      .filter((e) => e.tile !== undefined && passability.isBandPassableDestination(e.tile)
        && String(e.id) !== String(target.id) && dist(e.tile) >= 4)
      .sort((a, b) => (b.record.visits ?? 0) - (a.record.visits ?? 0)
        || String(a.id).localeCompare(String(b.id)))[0]?.tile;
  })();
  const retargetedWorld = targetB === undefined ? undefined : (() => {
    const a = readyWorld.world.bands[parent.id].fissionAttempt;
    return { ...readyWorld.world, bands: { ...readyWorld.world.bands,
      [parent.id]: { ...readyWorld.world.bands[parent.id],
        fissionAttempt: { ...a, targetTileId: String(targetB.id) } } } };
  })();
  const retargetBefore = retargetedWorld === undefined ? "" : JSON.stringify(retargetedWorld);
  const retargeted = retargetedWorld === undefined ? undefined : departFrom(retargetedWorld);
  const retargetAttemptAfter = retargetedWorld?.bands[parent.id].fissionAttempt;
  record("D2_a_departure_cannot_execute_a_destination_the_cohort_never_accepted",
    "with the commitment, the allocation, the live permit and the parent's condition ALL unchanged and valid, moving only the execution target to a second well-known tile refuses the departure BY ITS OWN NAME: no successor, no cohort line moves, the world is byte-identical, the permit is untouched and the commitment is not rewritten",
    targetB !== undefined &&
      retargeted.ok === false &&
      retargeted.refusal === "attempt_names_a_different_destination_than_the_commitment" &&
      JSON.stringify(retargetedWorld) === retargetBefore &&
      retargetedWorld.bands[SID] === undefined &&
      retargetedWorld.bands[parent.id].demography.workingAdults === parent.demography.workingAdults &&
      retargetedWorld.bands[parent.id].demography.dependents === parent.demography.dependents &&
      retargetedWorld.bands[parent.id].demography.elders === parent.demography.elders &&
      retargetAttemptAfter.preparedDeparture.authorization.status === "live" &&
      String(retargetAttemptAfter.preparedDeparture.commitment.targetTileId) === String(target.id),
    // NON-VACUITY, AND IT IS THE WHOLE POINT: the identical world with the target left ALONE departs
    // successfully in the same run, so the only difference between departing and refusing is the
    // destination — the refusal cannot be attributed to anything else.
    targetB !== undefined && ordinary.ok === true,
    { acceptedDestination: String(target.id), executionDestination: String(targetB?.id ?? "none"),
      refusal: retargeted === undefined ? "NOT CONSTRUCTED"
        : (retargeted.ok === false ? retargeted.refusal : "DEPARTED TO A DESTINATION NOBODY ACCEPTED"),
      detail: retargeted?.ok === false ? retargeted.detail : null,
      worldUnchanged: JSON.stringify(retargetedWorld) === retargetBefore,
      successorCreated: retargetedWorld?.bands[SID] !== undefined,
      permitStatus: retargetAttemptAfter?.preparedDeparture.authorization.status ?? null,
      commitmentTargetStillA: String(retargetAttemptAfter?.preparedDeparture.commitment.targetTileId ?? ""),
      bothTilesAreWellKnown: {
        A: parent.knowledge.observedTiles[String(target.id)]?.visits ?? 0,
        B: parent.knowledge.observedTiles[String(targetB?.id)]?.visits ?? 0 },
      controlInTheSameRun: ordinary.ok === true ? "the unretargeted world DEPARTED" : "did not depart" });

  // ══ D3 — THE EXECUTED DESTINATION IS THE ACCEPTED ONE, AND TRAVEL READS IT ══
  record("D3_the_successor_walks_toward_the_destination_its_founders_accepted",
    "the successor's provisional lifecycle target — the field `provisionalTravel` reads to choose every step — is the commitment's destination, and the parent's terminal attempt record carries the same one; there is a single answer to where these founders are going",
    ordinary.ok === true &&
      String(succ.provisionalSuccessor.targetTileId) === String(prepared.commitment.targetTileId) &&
      String(succ.provisionalSuccessor.targetTileId) === String(prepared.authorization.targetTileId) &&
      String(parentAfter.fissionAttempt.targetTileId) === String(prepared.commitment.targetTileId) &&
      String(succ.provisionalSuccessor.targetTileId) === String(target.id) &&
      // and the successor is placed at the PARENT's tile, never at the destination
      String(succ.position) === String(parent.position),
    ordinary.ok === true,
    { commitmentTarget: String(prepared.commitment.targetTileId),
      permitTarget: String(prepared.authorization.targetTileId),
      successorLifecycleTarget: String(succ?.provisionalSuccessor.targetTileId ?? ""),
      parentTerminalRecordTarget: String(parentAfter?.fissionAttempt.targetTileId ?? ""),
      successorPosition: String(succ?.position ?? ""), parentPosition: String(parent.position) });

  // ══ D4 — THE LEGITIMATE DESTINATION CHANGE ══
  //
  // Changing where the group is going is a change of ACCEPTED TERMS, so it goes through supersession.
  // The historical commitment to A survives — a cohort did accept it, and that stays true — while the
  // permit becomes terminal and can authorize neither A nor B.
  const supersededByDestination = prep.supersedePreparedDeparture(
    readyWorld.world, parent.id, "destination_changed", day0 + 2);
  const supersededRecord = supersededByDestination.ok === true
    ? supersededByDestination.world.bands[parent.id].fissionAttempt.preparedDeparture : undefined;
  const afterSupersedeToA = supersededByDestination.ok !== true ? undefined
    : departFrom(supersededByDestination.world);
  const afterSupersedeToB = supersededByDestination.ok !== true || targetB === undefined ? undefined
    : (() => {
      const a = supersededByDestination.world.bands[parent.id].fissionAttempt;
      return departFrom({ ...supersededByDestination.world, bands: { ...supersededByDestination.world.bands,
        [parent.id]: { ...supersededByDestination.world.bands[parent.id],
          fissionAttempt: { ...a, targetTileId: String(targetB.id) } } } });
    })();
  record("D4_a_destination_change_supersedes_the_terms_and_authorizes_neither_destination",
    "superseding for `destination_changed` ends the permit `superseded_by_revised_terms`, leaves the historical acceptance of A intact, and refuses a departure to A AND a departure to B — going somewhere else requires agreeing again",
    supersededByDestination.ok === true &&
      supersededRecord.authorization.status === "superseded_by_revised_terms" &&
      supersededRecord.authorization.endedBecause === "destination_changed" &&
      String(supersededRecord.commitment.targetTileId) === String(target.id) &&
      supersededRecord.commitment.commitmentId === prepared.commitment.commitmentId &&
      afterSupersedeToA?.ok === false &&
      afterSupersedeToA.refusal === "departure_authorization_not_live" &&
      afterSupersedeToB?.ok === false,
    targetB !== undefined,
    { permitStatus: supersededRecord?.authorization.status ?? null,
      endedBecause: supersededRecord?.authorization.endedBecause ?? null,
      historicalCommitmentTarget: String(supersededRecord?.commitment.targetTileId ?? ""),
      historicalCommitmentIdUnchanged: supersededRecord?.commitment.commitmentId === prepared.commitment.commitmentId,
      departureToA: afterSupersedeToA?.ok === false ? afterSupersedeToA.refusal : "ACCEPTED",
      departureToB: afterSupersedeToB?.ok === false ? afterSupersedeToB.refusal : "ACCEPTED" });

  // ══ E — A TERMINAL PERMIT AUTHORIZES NOTHING ══
  const endedRows = {};
  for (const [name, cause] of [["withdrawn", "attempt_abandoned_before_departure"],
    ["superseded", "founder_allocation_changed"], ["consumed", "physical_departure_consumed_it"]]) {
    const ended = commitment.endDepartureAuthorization(prepared.authorization, cause, day0);
    const a = readyWorld.world.bands[parent.id].fissionAttempt;
    const w = { ...readyWorld.world, bands: { ...readyWorld.world.bands,
      [parent.id]: { ...readyWorld.world.bands[parent.id],
        fissionAttempt: { ...a, preparedDeparture: { ...a.preparedDeparture, authorization: ended } } } } };
    const r = departFrom(w);
    endedRows[name] = { status: ended.status, refusal: r.ok === true ? "ACCEPTED" : r.refusal,
      successorCreated: w.bands[SID] !== undefined };
  }
  record("E_a_withdrawn_superseded_or_spent_permit_moves_nobody",
    "every terminal permit status refuses the departure by name and creates no successor — liveness is the authority, and there is no reopen",
    Object.values(endedRows).every((r) => r.refusal === "departure_authorization_not_live" && r.successorCreated === false),
    true, endedRows);

  // ══ F — A SECOND DEPARTURE ON THE SAME PERMIT IS IMPOSSIBLE ══
  const secondAttempt = ordinary.ok === true ? departFrom(ordinary.world, `${parent.id}:provisional:2`) : undefined;
  const secondOnRestoredPhase = ordinary.ok === true ? (() => {
    // Even with the phase forced back to `departure_ready`, so the phase gate cannot be what refuses.
    const a = ordinary.world.bands[parent.id].fissionAttempt;
    const w = { ...ordinary.world, bands: { ...ordinary.world.bands,
      [parent.id]: { ...ordinary.world.bands[parent.id], fissionAttempt: { ...a, phase: "departure_ready" } } } };
    return departFrom(w, `${parent.id}:provisional:2`);
  })() : undefined;
  record("F_the_same_commitment_cannot_move_bodies_twice",
    "re-running the departure on the resulting world is refused, and it is still refused when the attempt phase is forced back to `departure_ready` — so the barrier is the SPENT PERMIT and not merely the terminal phase",
    secondAttempt?.ok === false &&
      secondOnRestoredPhase?.ok === false &&
      secondOnRestoredPhase.refusal === "departure_authorization_not_live" &&
      ordinary.world.bands[`${parent.id}:provisional:2`] === undefined,
    ordinary.ok === true,
    { withTerminalPhase: secondAttempt?.ok === false ? secondAttempt.refusal : "ACCEPTED",
      withPhaseForcedBack: secondOnRestoredPhase?.ok === false ? secondOnRestoredPhase.refusal : "ACCEPTED",
      secondSuccessorCreated: ordinary.ok === true && ordinary.world.bands[`${parent.id}:provisional:2`] !== undefined });

  // ══ G — TRUSTED FRESHNESS: A REAL LOAD-BEARING INPUT MOVES ══
  //
  // Each arm changes ONE canonical field through the source the residual reading is derived from, on
  // a world that already holds a complete, live, coherent prepared departure.
  const withParent = (mutate) => {
    const p = readyWorld.world.bands[parent.id];
    return { ...readyWorld.world, bands: { ...readyWorld.world.bands, [parent.id]: mutate(p) } };
  };
  const staleArms = {
    // the annual demographic step: one adult ages into the elders
    cohortsAged: departFrom(withParent((p) => ({ ...p, demography: { ...p.demography,
      workingAdults: p.demography.workingAdults - 1, elders: p.demography.elders + 1 } }))),
    // daily expeditions: three bodies leave camp on a party
    bodiesLeftOnAParty: departFrom(withParent((p) => ({ ...p, expeditions: [...(p.expeditions ?? []),
      { id: "gate:away:1", phase: "operating", partyWorkers: 3, nonWorkingPartyPeople: 0 }] }))),
    // seasonal nutrition: the camp's measured food stress moves
    nutritionMoved: departFrom(withParent((p) => ({ ...p, seasonalSupport: { ...p.seasonalSupport,
      chronicDeficitStreak: (p.seasonalSupport?.chronicDeficitStreak ?? 0) + 4,
      deficitSeasonsLast8: (p.seasonalSupport?.deficitSeasonsLast8 ?? 0) + 4 } }))),
    // embodied condition: an acute-risk effect appears
    acuteRiskAppeared: departFrom(withParent((p) => ({ ...p, acuteRisk: { ...(p.acuteRisk ?? { bandId: p.id, episodes: [] }),
      activeEffect: { activityEfficiencyPenalty: 0.8, extraSeasonalStress: 0.4, mortalityRiskBump: 0,
        movementCautionBump: 0, knowledgeUpdateWeight: 0, recoverySeasons: 4 } } }))),
  };
  const staleRefusals = Object.fromEntries(Object.entries(staleArms)
    .map(([k, r]) => [k, r.ok === true ? "ACCEPTED" : r.refusal]));
  record("G_a_parent_that_moved_after_preparation_cannot_depart_on_the_old_terms",
    "cohorts, away bodies, nutrition and embodied condition each move on their own real cadence and each is read off the band; moving any ONE of them makes the prepared terms stale and refuses the departure",
    Object.values(staleRefusals).every((v) => v === "prepared_terms_are_stale"),
    ordinary.ok === true,
    { arms: staleRefusals,
      note: "the unmodified world departs successfully in the same run (fixture B), so these are refusals and not a broken seam" });

  // ══ H — THE STALE-CONTEXT ATTACK IS STRUCTURALLY IMPOSSIBLE ══
  //
  // MANDATORY. The old attack was: prepare on day D with reading X, let the parent change, then send
  // X again on day D+5 so the fingerprint matches. It cannot be expressed, because the public API no
  // longer has anywhere to put X — which is proved from PRODUCTION SOURCE and from the runtime
  // behaviour of a call that tries anyway.
  const seamSource = readFileSync(SEAM_SRC, "utf8");
  const prepSource = readFileSync("src/sim/agents/fissionDeparturePreparation.ts", "utf8");
  const agedWorld = withParent((p) => ({ ...p, demography: { ...p.demography,
    workingAdults: p.demography.workingAdults - 1, elders: p.demography.elders + 1 } }));
  // The old reading, handed back verbatim in every shape a caller could try.
  const oldReading = measurement.deriveCurrentParentResidualInput(parent, prepared.allocation, prepared.residualPolicy);
  const smuggled = seam.performAtomicDeparture({
    world: agedWorld, parentId: parent.id, today: day0 + 1, successorBandId: SID, lineageId: LIN,
    residualContext: oldReading, residualInput: oldReading, parentResidualInput: oldReading });
  record("H_an_old_residual_reading_cannot_be_resent_to_fake_freshness",
    "the departure request declares no residual field at all, so a caller that attaches its stale reading under any name is ignored and the departure is still refused as stale — the check reads the band, and the band is the only thing that can answer for it",
    smuggled.ok === false &&
      smuggled.refusal === "prepared_terms_are_stale" &&
      /readonly residual/.test(seamSource) === false &&
      /residualContext:/.test(seamSource) === false &&
      /readonly residualContext/.test(prepSource) === false &&
      /deriveCurrentParentResidualInput/.test(prepSource) === true,
    true,
    { refusalWithSmuggledReading: smuggled.ok === false ? smuggled.refusal : "ACCEPTED",
      seamDeclaresAnyResidualField: /readonly residual/.test(seamSource),
      seamMentionsResidualContextOnlyInProse: /residualContext/.test(seamSource) && !/residualContext:/.test(seamSource),
      preparationDeclaresAResidualContextField: /readonly residualContext/.test(prepSource),
      preparationDerivesItsOwnReading: /deriveCurrentParentResidualInput/.test(prepSource),
      note: "the extra request fields are ignored by the type and by the implementation; the refusal comes from the DERIVED reading disagreeing with the stored fingerprint" });

  // ══ I — AN IRRELEVANT PARENT FACT DOES NOT FALSELY INVALIDATE ══
  //
  // Guards against fingerprinting the whole Band indiscriminately, which would make every prepared
  // departure stale within a day and turn a real check into a permanent refusal.
  const irrelevantArms = {
    nameChanged: departFrom(withParent((p) => ({ ...p, name: `${p.name} (renamed)` }))),
    tripHistoryGrew: departFrom(withParent((p) => ({ ...p,
      recentIntraSeasonTrips: [...(p.recentIntraSeasonTrips ?? []), { id: "gate:trip:1" }] }))),
    decisionRecorded: departFrom(withParent((p) => ({ ...p,
      decisionHistory: [...(p.decisionHistory ?? []), { id: "gate:decision:1" }] }))),
    // A PREPARED party: its people are standing in this camp, so it is committed labour and NOT an
    // away body. It legitimately IS a residual input, so it is expected to invalidate — recorded as
    // the discriminating control rather than as an irrelevant fact.
    preparedPartyAppeared: departFrom(withParent((p) => ({ ...p, expeditions: [...(p.expeditions ?? []),
      { id: "gate:prepared:1", phase: "prepared", partyWorkers: 2, nonWorkingPartyPeople: 0 }] }))),
  };
  const irrelevantRows = Object.fromEntries(Object.entries(irrelevantArms)
    .map(([k, r]) => [k, r.ok === true ? "DEPARTED" : r.refusal]));
  record("I_facts_the_assessment_never_read_do_not_invalidate_a_prepared_departure",
    "renaming the band, recording a trip and recording a decision leave the prepared terms fresh, while a newly PREPARED party — which is committed labour and a real residual input — correctly makes them stale",
    irrelevantRows.nameChanged === "DEPARTED" &&
      irrelevantRows.tripHistoryGrew === "DEPARTED" &&
      irrelevantRows.decisionRecorded === "DEPARTED" &&
      irrelevantRows.preparedPartyAppeared === "prepared_terms_are_stale",
    true,
    { arms: irrelevantRows,
      note: "the discriminating control is the last row: without it, three DEPARTEDs would be consistent with a fingerprint that measures nothing" });

  // ══ J — A LATE REFUSAL IS ATOMIC ══
  //
  // The transfer policy runs AFTER the gate and long after the permit would have been consumed by a
  // two-step implementation. The mechanism is a real one this repository has already recorded: a
  // 4-digit shorthand colour that `hexToHsl` cannot parse, so `deriveDaughterColor` returns the
  // parent's colour verbatim and the successor is indistinguishable from its parent on the map.
  // Colour is not a residual input, so the prepared terms stay FRESH and the refusal is genuinely a
  // late one.
  const lateWorld = withParent((p) => ({ ...p, color: "#111" }));
  const lateBefore = JSON.stringify(lateWorld);
  const late = departFrom(lateWorld);
  const lateAttempt = lateWorld.bands[parent.id].fissionAttempt;
  record("J_a_late_validation_refusal_leaves_the_permit_unspent_and_nobody_moved",
    "a departure that passes the whole gate and is then refused by the field-transfer policy returns the ORIGINAL world: no successor, the parent's cohorts untouched, and the permit still `live` — there is no state in which a permit is spent and no bodies moved",
    late.ok === false &&
      late.refusal === "successor_violated_the_field_transfer_policy" &&
      JSON.stringify(lateWorld) === lateBefore &&
      lateWorld.bands[SID] === undefined &&
      lateAttempt.preparedDeparture.authorization.status === "live" &&
      Math.round(lateWorld.bands[parent.id].demography.population) === Math.round(parent.demography.population),
    true,
    { refusal: late.ok === false ? late.refusal : "ACCEPTED",
      detail: late.ok === false ? late.detail : null,
      worldUnchanged: JSON.stringify(lateWorld) === lateBefore,
      permitStatusAfterRefusal: lateAttempt.preparedDeparture.authorization.status,
      successorCreated: lateWorld.bands[SID] !== undefined });

  // ══ K — THE SUCCESSOR CARRIES BOUNDED CONSUMED PROVENANCE, AND NO PERMIT ══
  const prov = succ?.provisionalSuccessor?.departureProvenance;
  const provJson = JSON.stringify(prov ?? {});
  record("K_the_successor_can_prove_which_commitment_produced_it_without_holding_a_permit",
    "the successor carries the commitment id, its decision day, the departure day, the exact represented cohort and the spent status — enough to connect lineage, commitment, allocation and physical departure without consulting the parent — and carries NO live permit and no prepared record",
    prov !== undefined &&
      prov.commitmentId === prepared.commitment.commitmentId &&
      prov.authorizationStatus === "consumed_by_departure" &&
      prov.departedOnDay === day0 + 1 &&
      prov.commitmentDecisionDay === prepared.commitment.decisionDay &&
      prov.founders.workingAdults === alloc.workingAdults &&
      prov.founders.dependents === alloc.dependents &&
      prov.founders.elders === alloc.elders &&
      succ.provisionalSuccessor.lineageId === LIN &&
      succ.provisionalSuccessor.preparedDeparture === undefined &&
      succ.fissionAttempt === undefined &&
      !/"status":"live"/.test(provJson) &&
      provJson.length < 400,
    ordinary.ok === true,
    { provenance: prov ?? null, bytes: provJson.length,
      successorHoldsAPreparedRecord: succ?.provisionalSuccessor?.preparedDeparture !== undefined,
      successorHoldsAnAttempt: succ?.fissionAttempt !== undefined });

  // ══ L — ABANDONMENT AND THE TIMEOUT PATH ══
  //
  // Two independent barriers, and the second matters because production has NO adapter that resolves
  // the parent attempt's timeout at all: `resolveTimeout` has zero callers in `src/`, and
  // `resolveProvisionalLifecycles` reads `provisionalSuccessor` only. So even if a future adapter
  // times the attempt out WITHOUT touching the permit, the phase gate still refuses.
  const abandoned = prep.abandonPreparedDeparture(readyWorld.world, parent.id, day0 + 3);
  const abandonedWorld = abandoned.ok === true ? abandoned.world : undefined;
  const afterAbandon = abandonedWorld === undefined ? undefined : departFrom(abandonedWorld);
  const timedOut = kernel.resolveTimeout(
    { phase: "departure_ready", phaseEnteredDay: day0, history: ["proposed", "departure_planned"] },
    day0 + kernel.DEPARTURE_READY_MAX_DAYS + 1);
  const timeoutOnlyWorld = (() => {
    const a = readyWorld.world.bands[parent.id].fissionAttempt;
    return { ...readyWorld.world, bands: { ...readyWorld.world.bands,
      [parent.id]: { ...readyWorld.world.bands[parent.id], fissionAttempt: { ...a, phase: "abandoned" } } } };
  })();
  const afterTimeoutOnly = departFrom(timeoutOnlyWorld);
  const resolverSource = readFileSync("src/sim/agents/provisionalLifecycleResolver.ts", "utf8");
  const productionTimeoutCallers = ["src/sim/agents/provisionalLifecycleResolver.ts", "src/sim/tick/advance.ts",
    "src/sim/agents/demography.ts"].filter((f) => /resolveTimeout\s*\(/.test(readFileSync(f, "utf8")));
  record("L_no_live_permit_survives_an_abandoned_attempt",
    "explicit abandonment ends the permit `withdrawn_before_departure` while keeping the commitment as a true historical fact; and a timeout that ended the phase WITHOUT touching the permit is still refused, so the two barriers are independent",
    abandoned.ok === true &&
      abandonedWorld.bands[parent.id].fissionAttempt.preparedDeparture.authorization.status === "withdrawn_before_departure" &&
      abandonedWorld.bands[parent.id].fissionAttempt.preparedDeparture.commitment.commitmentId === prepared.commitment.commitmentId &&
      afterAbandon.ok === false &&
      afterTimeoutOnly.ok === false &&
      afterTimeoutOnly.refusal === "parent_attempt_not_departure_ready" &&
      timedOut.ok === true && timedOut.state.phase === "abandoned" &&
      productionTimeoutCallers.length === 0,
    true,
    { permitAfterAbandonment: abandonedWorld?.bands[parent.id].fissionAttempt.preparedDeparture.authorization.status ?? null,
      commitmentRetained: abandonedWorld?.bands[parent.id].fissionAttempt.preparedDeparture.commitment.commitmentId === prepared.commitment.commitmentId,
      departureAfterAbandonment: afterAbandon?.ok === false ? afterAbandon.refusal : "ACCEPTED",
      kernelTimeoutTarget: timedOut.ok === true ? timedOut.state.phase : timedOut.rejection,
      departureAfterTimeoutWithPermitUntouched: afterTimeoutOnly.ok === false ? afterTimeoutOnly.refusal : "ACCEPTED",
      productionCallersOfResolveTimeout: productionTimeoutCallers,
      resolverHandlesTheParentAttempt: /fissionAttempt/.test(resolverSource),
      statedGap: "no production adapter resolves the parent attempt's timeout; `departure_ready -> abandoned` is declared in the contract table and driven by nothing" });

  // ══ M — CONSERVATION, MEASURED ON THE RESULTING WORLD ══
  const before = { pop: beforePop, ...cohortsOf(parent) };
  const after = ordinary.ok !== true ? undefined : {
    pop: worldPopulation(ordinary.world),
    workingAdults: parentAfter.demography.workingAdults + succ.demography.workingAdults,
    dependents: parentAfter.demography.dependents + succ.demography.dependents,
    elders: parentAfter.demography.elders + succ.demography.elders,
  };
  record("M_every_demographic_line_is_conserved_exactly",
    "world population and all three cohort lines are read from the RESULTING world and balance exactly — never restated from before, and never re-derived at fixed ratios",
    after !== undefined && after.pop === before.pop &&
      after.workingAdults === before.workingAdults &&
      after.dependents === before.dependents &&
      after.elders === before.elders &&
      seam.isDepartureLedgerConserving(ordinary.ledger) === true &&
      ordinary.ledger.demographic.fixedRatioRecomputeUsed === false,
    ordinary.ok === true,
    { before, after, ledgerConserving: ordinary.ok === true ? seam.isDepartureLedgerConserving(ordinary.ledger) : null });

  // ══ N — DETERMINISM ══
  const rerunPrep = prepare();
  const rerun = rerunPrep.ok === true ? departFrom(rerunPrep.world) : undefined;
  const digest = (r) => r?.ok === true
    ? JSON.stringify({ ledger: r.ledger, prov: r.successorDepartureProvenance, permit: r.consumedAuthorization,
      succ: cohortsOf(r.world.bands[SID]) }) : "REFUSED";
  record("N_the_same_prepared_input_produces_a_byte_identical_result",
    "preparing and departing twice from the same canonical world produces identical ledgers, provenance, permits and cohorts",
    digest(rerun) === digest(ordinary) && digest(ordinary) !== "REFUSED",
    ordinary.ok === true,
    { identical: digest(rerun) === digest(ordinary), bytes: digest(ordinary).length });

  // ══ O — NO NATURAL CUTOVER ══
  const naturalFiles = ["src/sim/agents/demography.ts", "src/sim/tick/advance.ts",
    "src/sim/rules/bandDecision.ts", "src/sim/runner/simRunner.ts"]
    .map((f) => ({ file: f, source: readFileSync(f, "utf8") }))
    .map((e) => ({ file: e.file,
      reachesTheSeam: /performAtomicDeparture|fissionDepartureSeam/.test(e.source),
      reachesPreparation: /prepareFissionDeparture|fissionDeparturePreparation/.test(e.source) }));
  const demographySource = readFileSync("src/sim/agents/demography.ts", "utf8");
  record("O_ordinary_ecology_still_cannot_reach_any_of_this",
    "no demographic, runner, decision or annual-fission path calls the preparation writer or the departure seam, and `createDaughterBand` remains the only route ordinary ecology can take",
    naturalFiles.every((e) => e.reachesTheSeam === false && e.reachesPreparation === false) &&
      demographySource.includes("createDaughterBand"),
    demographySource.includes("createDaughterBand"),
    { naturalFiles, legacyPathIntact: demographySource.includes("createDaughterBand") });

  // ══ P — NEGATIVE CONTROLS ══
  //
  // Four mutations of PRODUCTION source, each expressing one defect this pass removed, each run in a
  // restored copy and each required to make a named fixture fail. A gate nothing can break is a gate
  // nothing is testing.
  const shaBefore = sha(SEAM_SRC);
  copyFileSync(SEAM_SRC, `${SEAM_SRC}.gatebak`);
  const controls = [];
  const mutations = [
    { id: "P1_remove_the_prepared_departure_gate",
      expect: "A", from: `  if (prepared === undefined) {
    return { ok: false, refusal: "departure_not_prepared" };
  }`, to: `  if (prepared === undefined && false) {
    return { ok: false, refusal: "departure_not_prepared" };
  }` },
    { id: "P2_trust_the_stored_fingerprint_instead_of_re_deriving_it",
      expect: "G", from: `  const currentFingerprint = deriveCurrentPreparedFingerprint(prepared, parent);`,
      to: `  const currentFingerprint = prepared.residualInputFingerprint;` },
    { id: "P3_transfer_a_cohort_other_than_the_one_that_was_accepted",
      expect: "B",
      // The two lines are SWAPPED, so the sum still equals the parent and the executability check
      // cannot be what catches it: the only thing wrong is that the wrong people left.
      from: `  const successorCohorts = allocation.successor;
  const parentAfterCohorts = allocation.parentRemainder;`,
      to: `  const successorCohorts = allocation.parentRemainder;
  const parentAfterCohorts = allocation.successor;` },
    { id: "P4_fail_to_consume_the_permit",
      expect: "F", from: `      preparedDeparture: { ...prepared, authorization: consumedAuthorization },`,
      to: `      preparedDeparture: { ...prepared },` },
    // THE DEFECT THIS CORRECTION REMOVED, RESTORED IN FULL. Both halves are needed to reproduce it:
    // the destination compared against ITSELF (so nothing refuses), and the successor's lifecycle
    // target read off the ATTEMPT (so the group physically walks to the unaccepted tile). Restoring
    // only the first would show a departure that should have been refused, but not the founders
    // walking somewhere nobody agreed to go — which is the part that matters.
    { id: "P5_restore_the_self_compared_destination_and_the_attempt_sourced_successor_target",
      expect: "D2",
      from: `  if (String(executionDestination) !== String(acceptedDestination)) {`,
      to: `  if (false && String(executionDestination) !== String(acceptedDestination)) {`,
      alsoEdits: [
        { from: `    targetTileId: executionDestination,`, to: `    targetTileId: acceptedDestination,` },
        { from: `      targetTileId: acceptedDestination,
      // The tile the founders physically left from`,
          to: `      targetTileId: attempt.targetTileId,
      // The tile the founders physically left from` },
      ] },
  ];
  for (const m of mutations) {
    const src = readFileSync(`${SEAM_SRC}.gatebak`, "utf8");
    if (!src.includes(m.from)) { controls.push({ ...m, applied: false, note: "anchor not found" }); continue; }
    let mutated = src.replace(m.from, m.to);
    let missing;
    for (const edit of m.alsoEdits ?? []) {
      if (!mutated.includes(edit.from)) { missing = edit.from.slice(0, 60); break; }
      mutated = mutated.replace(edit.from, edit.to);
    }
    if (missing !== undefined) { controls.push({ ...m, applied: false, note: `secondary anchor not found: ${missing}` }); continue; }
    writeFileSync(SEAM_SRC, mutated);
    const mutant = await createServer({ root: `${process.cwd()}/src`,
      cacheDir: `node_modules/.vite-i4gatemut-${process.pid}-${m.id}`, configFile: false, appType: "custom",
      server: { middlewareMode: true, hmr: false }, logLevel: "error" });
    let row;
    try {
      const mseam = await mutant.ssrLoadModule("/sim/agents/fissionDepartureSeam.ts");
      const go = (w, sid = SID) => mseam.performAtomicDeparture({ world: w, parentId: parent.id,
        today: day0 + 1, successorBandId: sid, lineageId: LIN });
      if (m.expect === "A") {
        const r = go({ ...bypassWorld, bands: { ...bypassWorld.bands } });
        row = { fixture: "A", brokenBy: r.ok === true ? "the bypass DEPARTED" : `still refused: ${r.refusal}`,
          controlHolds: r.ok === true || r.refusal !== "departure_not_prepared" };
        // A throw is also a broken A: the fixture requires a NAMED refusal with the world untouched.
      } else if (m.expect === "G") {
        // Deliberately the AWAY-BODIES arm, and choosing it took two attempts worth recording.
        // The cohort arm is caught by a second independent barrier (§2c: the accepted cohort must
        // still be drawable from the parent), and the nutrition arm by a third (the successor may not
        // depart less hungry than the camp it left, since `buildOpeningEmbodiedSupport` rebuilds its
        // state from the samples rather than from the streak counters). Either would have left this
        // control unable to isolate the freshness check: the mutant would still refuse, and the
        // control would have looked like it held for a reason that was not the one under test.
        // Bodies leaving on a party move a real residual input and nothing else.
        const r = go(withParent((p) => ({ ...p, expeditions: [...(p.expeditions ?? []),
          { id: "gate:control:away", phase: "operating", partyWorkers: 3, nonWorkingPartyPeople: 0 }] })));
        row = { fixture: "G", brokenBy: r.ok === true ? "a stale parent DEPARTED" : `still refused: ${r.refusal}`,
          controlHolds: r.ok === true };
      } else if (m.expect === "B") {
        const r = go(readyWorld.world);
        const moved = r.ok === true ? cohortsOf(r.world.bands[SID]) : null;
        row = { fixture: "B", movedCohort: moved, preparedCohort: alloc,
          controlHolds: r.ok !== true || moved.dependents !== alloc.dependents };
      } else if (m.expect === "D2") {
        // Restoring the self-comparison must let a group depart toward a destination its founders
        // never accepted — the state that used to be representable.
        const r = go(retargetedWorld, `${parent.id}:provisional:retarget`);
        const walkedTo = r.ok === true
          ? String(r.world.bands[`${parent.id}:provisional:retarget`].provisionalSuccessor.targetTileId)
          : null;
        row = { fixture: "D2",
          brokenBy: r.ok === true ? `departed toward ${walkedTo} under a commitment for ${String(target.id)}`
            : `still refused: ${r.refusal}`,
          acceptedDestination: String(target.id), executedDestination: walkedTo,
          controlHolds: r.ok === true };
      } else {
        // The second attempt is replayed against the UNCHANGED parent carrying the attempt record as
        // the first departure left it. Under production that record's permit reads
        // `consumed_by_departure` and the replay is refused; under the mutation it is still `live`.
        // Replaying on the post-departure world instead would have been caught by FRESHNESS (the
        // parent's cohorts moved), so the control would not have isolated consumption at all.
        const first = go(readyWorld.world);
        const replayed = first.ok === true ? (() => {
          const a = first.world.bands[parent.id].fissionAttempt;
          const w = { ...readyWorld.world, bands: { ...readyWorld.world.bands, [parent.id]: {
            ...readyWorld.world.bands[parent.id],
            fissionAttempt: { ...a, phase: "departure_ready" } } } };
          return go(w, `${parent.id}:provisional:2`);
        })() : undefined;
        row = { fixture: "F", firstDeparture: first.ok === true ? "DEPARTED" : first.refusal,
          permitAfterFirst: first.ok === true
            ? first.world.bands[parent.id].fissionAttempt.preparedDeparture.authorization.status : null,
          replayedDeparture: replayed?.ok === true ? "DEPARTED AGAIN" : (replayed?.refusal ?? "n/a"),
          controlHolds: first.ok === true && replayed?.ok === true };
      }
    } catch (e) {
      // With the gate gone the seam dereferences an absent prepared record and throws. A's claim is
      // "refused BY NAME with the world untouched", so a crash breaks it exactly as a departure would
      // — recorded as what it is rather than folded into a silent pass.
      row = { fixture: m.expect, brokenBy: `threw instead of refusing: ${String(e?.message ?? e)}`,
        controlHolds: true };
    } finally {
      await mutant.close();
    }
    controls.push({ id: m.id, applied: true, ...row });
  }
  copyFileSync(`${SEAM_SRC}.gatebak`, SEAM_SRC);
  const shaAfter = sha(SEAM_SRC);
  record("P_negative_controls_each_defect_breaks_a_named_fixture",
    "removing the prepared-departure gate, trusting the stored fingerprint instead of re-deriving it, transferring a cohort other than the prepared one, and failing to consume the permit each make a named fixture fail — and production is restored byte-identically",
    controls.every((c) => c.applied === true && c.controlHolds === true) && shaBefore === shaAfter,
    true,
    { controls, productionRestoredByteIdentically: shaBefore === shaAfter, sha256: shaBefore });

  const failing = fixtures.filter((f) => f.verdict === "FAIL");
  const vacuous = fixtures.filter((f) => f.verdict === "VACUOUS");
  out = {
    generatedAt: new Date().toISOString(), seed: SEED, warmDays: WARM_DAYS,
    parentBandId: String(parent.id), targetTileId: String(target.id),
    summary: { total: fixtures.length, passed: fixtures.filter((f) => f.verdict === "PASS").length,
      failed: failing.length, vacuous: vacuous.length },
    fixtures,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
  console.log(JSON.stringify({ summary: out.summary,
    fixtures: fixtures.map((f) => ({ id: f.id, verdict: f.verdict })) }, null, 2));
} finally {
  await server.close();
}
if (out !== undefined && (out.summary.failed > 0 || out.summary.vacuous > 0)) process.exitCode = 1;
