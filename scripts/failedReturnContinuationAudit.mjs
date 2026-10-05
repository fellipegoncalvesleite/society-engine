// ROADMAP ITEM 4 — FAILED RETURN -> FRESH COMMITMENT -> DISTINCT INDEPENDENT LIFE.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  loadSuccessorStabilizationModules,
  warmStabilizationWorld,
  makeCanonicalStabilizationDeparture,
  buildQualifyingPreReleaseWorld,
  totalWorldPopulation,
} from "./lib/successorStabilizationFixture.mjs";
import {
  makeBlockedPostReturnCourse,
  makeGenuineUnresolvedFailedReturn,
  runBlockedPostReturnCourse,
  runFailedGroundAfterArrival,
  runRegisteredPostReturnContinuation,
} from "./lib/failedReturnContinuationFixture.mjs";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1] : fallback;
};
const OUT = arg("out", "docs/evidence/dynamic-fission-daughter-viability-38/failed-return-continuation.json");
const fixtures = [];
const record = (id, claim, passed, nonVacuous, detail) => fixtures.push({
  id,
  claim,
  verdict: nonVacuous === false ? "VACUOUS" : passed ? "PASS" : "FAIL",
  nonVacuous: nonVacuous !== false,
  detail,
});
const digest = (value) => JSON.stringify(value);
const replaceBand = (world, bandId, change) => ({
  ...world,
  bands: { ...world.bands, [bandId]: change(world.bands[bandId]) },
});

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-i4-failed-return-${process.pid}`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  logLevel: "error",
});

let output;
try {
  const modules = await loadSuccessorStabilizationModules(server);
  const warm = warmStabilizationWorld(modules);
  const unresolved = makeGenuineUnresolvedFailedReturn(modules, warm);
  const positive = runRegisteredPostReturnContinuation(modules, unresolved);
  const before = unresolved.world.bands[unresolved.successorId];
  const after = positive.band;
  const parentAfter = positive.world.bands[unresolved.parentId];
  const commitment = after.provisionalSuccessor.postReturnCommitment;
  const event = after.successorPostReturnEstablishmentEvents?.at(-1);
  const departure = before.successorDepartureRecords?.at(-1);

  record(
    "F1_source_dead_end_was_exact",
    "before the new disposition, unresolved-after-failed-return was event-bounded and the only existing exits were physical reintegration or zero-population extinction",
    modules.kernel.getPhaseContract("unresolved_after_failed_return").resolutionKind === "event_bounded_living_condition" &&
      modules.kernel.getPhaseContract("unresolved_after_failed_return").permittedNext.includes("continuing_after_failed_return") &&
      before.provisionalSuccessor.phase === "unresolved_after_failed_return",
    unresolved.trace.some((row) => row.phase === "unresolved_after_failed_return"),
    {
      currentContract: modules.kernel.getPhaseContract("unresolved_after_failed_return"),
      reproducedPath: unresolved.trace,
      priorOnlyExits: ["reintegrated", "provisional_extinguished"],
    },
  );

  record(
    "F2_return_really_happened_and_failed",
    "the successor physically departed, arrived, entered a monotonic return path, retraced contiguous ground, found no co-located parent and only then entered unresolved-after-failed-return when the bounded action expired",
    unresolved.trace.some((row) => row.phase === "travelling") &&
      unresolved.trace.some((row) => row.phase === "establishing") &&
      unresolved.trace.some((row) => row.phase === "failed_early") &&
      unresolved.trace.some((row) => row.phase === "returning") &&
      unresolved.returnMoves.length > 0 && unresolved.returnMoves.every((move) => move.manhattan === 1) &&
      before.provisionalSuccessor.separationCourse?.status === "return_path_entered" &&
      String(before.position) === String(before.provisionalSuccessor.departureTileId) &&
      String(parentAfter.position) !== String(before.position),
    unresolved.returnMoves.length > 0,
    {
      trace: unresolved.trace,
      returnMoves: unresolved.returnMoves,
      separationCourse: before.provisionalSuccessor.separationCourse,
      parentTile: parentAfter.position,
      successorTileAtFailure: before.position,
    },
  );

  const originalFounders = before.provisionalSuccessor.departureProvenance.founders;
  record(
    "F3_fresh_social_fact_represents_current_survivors",
    "a new aggregate-current-survivor commitment, not the founder commitment or spent permit, binds the current three cohort lines after failed return",
    commitment?.authority === "post_return_continuation_commitment_v1" &&
      commitment.actorResolution === "aggregate_current_survivor_cohort" &&
      commitment.intent === "continue_as_separate_group" &&
      commitment.decisionDay > unresolved.unresolvedDay &&
      commitment.survivors.workingAdults === commitment.evidence.currentCondition.workingAdults &&
      commitment.survivors.dependents === commitment.evidence.currentCondition.dependents &&
      commitment.survivors.elders === commitment.evidence.currentCondition.elders &&
      commitment.commitmentId !== before.provisionalSuccessor.departureProvenance.commitmentId,
    commitment !== undefined,
    {
      founderCommitmentId: before.provisionalSuccessor.departureProvenance.commitmentId,
      originalFounders,
      postReturnCommitment: commitment,
    },
  );

  record(
    "F4_stale_evidence_barrier_is_temporal_and_structural",
    "the decision evidence begins after failed return and the establishment window begins strictly after the new commitment, so old outbound operation cannot be replayed",
    commitment !== undefined && event !== undefined &&
      commitment.evidence.livedSinceFailure.firstDay > commitment.failedReturnBeganOnDay &&
      event.independentOperation.assessmentWindow.startDay > commitment.decisionDay &&
      event.independentOperation.commitmentId === commitment.commitmentId &&
      event.independentOperation.allRequirementsMet === true,
    (event?.independentOperation.assessmentWindow.days ?? 0) > 1,
    {
      failedReturnBeganOnDay: commitment?.failedReturnBeganOnDay,
      decisionEvidence: commitment?.evidence.livedSinceFailure,
      decisionDay: commitment?.decisionDay,
      establishmentWindow: event?.independentOperation.assessmentWindow,
    },
  );

  record(
    "F5_distinct_established_outcome_preserves_whole_path",
    "completion is established-after-failed-return, never ordinary stabilized, and its event/deep history retain departure, failed return, fresh decision and later operation",
    after.provisionalSuccessor.phase === "established_after_failed_return" &&
      after.successorStabilizationEvents?.length === 0 &&
      event?.returnPathEntered === true &&
      event.failedReturnBeganOnDay === commitment?.failedReturnBeganOnDay &&
      after.deepHistory?.founding.creationCause === "independent_life_established_after_failed_return" &&
      after.deepHistory.founding.evidence.some((entry) => entry.kind === "successor_departure_event") &&
      after.deepHistory.founding.evidence.some((entry) => entry.kind === "post_return_continuation_commitment") &&
      after.deepHistory.founding.evidence.some((entry) => entry.kind === "successor_post_return_establishment_event") &&
      after.provisionalSuccessor.separationCourse?.status === "return_path_entered",
    event !== undefined,
    {
      phase: after.provisionalSuccessor.phase,
      ordinaryStabilizationEvents: after.successorStabilizationEvents?.length ?? 0,
      event,
      founding: after.deepHistory?.founding,
    },
  );

  record(
    "F6_release_conserves_bodies_and_initializes_established_readers",
    "the distinct release moves no person or position, creates no duplicate band, and atomically initializes camp, lineage, deep history and lineage readability while deferring ordinary viability",
    totalWorldPopulation(unresolved.world) === totalWorldPopulation(positive.world) &&
      Object.keys(unresolved.world.bands).length === Object.keys(positive.world.bands).length &&
      after.demography.population === before.demography.population &&
      modules.lifecycle.isEstablishedBand(after) === true &&
      modules.lifecycle.isProvisionalSuccessor(after) === false &&
      String(after.currentCampTileId) === String(after.position) &&
      after.lineage?.daughterBandId === after.id &&
      after.lineageReadability?.formationStatus === "established_daughter" &&
      after.viability === undefined,
    before.demography.population > 0,
    {
      populationBefore: before.demography.population,
      populationAfter: after.demography.population,
      positionBefore: before.position,
      positionAfter: after.position,
      bandCountBefore: Object.keys(unresolved.world.bands).length,
      bandCountAfter: Object.keys(positive.world.bands).length,
      formationStatus: after.lineageReadability?.formationStatus,
    },
  );

  const canonical = modules.events.deriveCanonicalEvents(positive.world, after).events
    .find((candidate) => candidate.type === "successor_established_after_failed_return");
  const ordinaryCanonical = modules.events.deriveCanonicalEvents(positive.world, after).events
    .find((candidate) => candidate.type === "successor_stabilized");
  const chronicle = modules.chronicle.deriveBandChronicle(positive.world, after);
  const identity = modules.identity.deriveBandIdentityProfile(positive.world, after);
  const panelProjection = modules.runner.takeSelectedBandPanelProjection(positive.world, String(after.id));
  const mapMarker = modules.runner.takeLiveOverlay(positive.world).markers
    .find((marker) => String(marker.id) === String(after.id));
  record(
    "F7_event_chronicle_identity_are_truthful",
    "event, Chronicle, identity, selected-band projection and map marker expose a completed daughter while the event explicitly names the failed-return recovery rather than projecting ordinary stabilization",
    canonical?.sourceSystem === "successor_post_return_establishment_record" &&
      canonical.title.toLowerCase().includes("failed return") &&
      ordinaryCanonical === undefined &&
      chronicle.majorArcs.some((arc) => arc.kind === "lineage" && arc.causeLines.some((line) => line.includes("return attempt failed"))) &&
      identity.summaryTitle.toLowerCase().includes("daughter") &&
      event !== undefined &&
      panelProjection?.band.successorPostReturnEstablishmentEvents?.some((entry) => entry.id === event.id) === true &&
      mapMarker?.isDaughter === true && mapMarker.isProvisional === false &&
      String(mapMarker.position) === String(after.position),
    canonical !== undefined,
    {
      canonical,
      ordinaryCanonical,
      chronicleArcs: chronicle.majorArcs,
      identityTitle: identity.summaryTitle,
      selectedPanelCarriesEvent: panelProjection?.band.successorPostReturnEstablishmentEvents?.some(
        (entry) => entry.id === event?.id,
      ),
      mapMarker,
    },
  );

  record(
    "F8_movement_uses_only_group_owned_target_and_contiguous_steps",
    "any post-return relocation target is either the occupied tile or an observed-memory tile, and every actual movement step remains contiguous",
    commitment !== undefined &&
      (commitment.evidence.target.basis === "current_occupied_tile" ||
        before.knowledge.observedTiles[commitment.targetTileId] !== undefined) &&
      positive.trace.every((row, index, rows) => {
        if (index === 0 || row.position === rows[index - 1].position) return true;
        const from = modules.generate.getTile(positive.world, rows[index - 1].position);
        const to = modules.generate.getTile(positive.world, row.position);
        return Math.abs(from.coord.x - to.coord.x) + Math.abs(from.coord.y - to.coord.y) === 1;
      }),
    positive.trace.length > 2,
    { target: commitment?.evidence.target, trace: positive.trace },
  );

  // Same-day competition: reintegration is earlier in the registry and ends the entity before a
  // post-return decision action can inspect it.
  const reunionDay = unresolved.unresolvedDay + 1;
  const coLocated = replaceBand(unresolved.world, unresolved.parentId, (parent) => ({
    ...parent,
    position: before.position,
  }));
  const reunion = modules.advance.advanceWorldByDays(coLocated, 1);
  const reunited = reunion.bands[unresolved.successorId];
  record(
    "F9_same_day_physical_reunion_has_explicit_priority",
    "when the parent is physically present on the day a post-return decision could begin, reintegration runs first and no fresh commitment or independent-completion event is written",
    reunited.provisionalSuccessor.phase === "reintegrated" &&
      reunited.provisionalSuccessor.postReturnCommitment === undefined &&
      (reunited.successorPostReturnEstablishmentEvents?.length ?? 0) === 0 &&
      reunited.demography.population === 0,
    String(coLocated.bands[unresolved.parentId].position) === String(before.position),
    {
      actionIds: modules.registry.DEFAULT_DAILY_ACTIONS.map((action) => action.id),
      phase: reunited.provisionalSuccessor.phase,
      commitment: reunited.provisionalSuccessor.postReturnCommitment,
    },
  );

  // Existing atomic authority, direct control with burden/conservation delegated to its own result.
  const directReunion = modules.reintegration.performAtomicReintegration({
    world: coLocated,
    successorId: unresolved.successorId,
    today: reunionDay,
  });
  record(
    "F10_reintegration_authority_is_preserved",
    "an unresolved group on the same tile still reintegrates only through performAtomicReintegration with exact cohort conservation and no independent-completion event",
    directReunion.ok === true &&
      directReunion.world.bands[unresolved.successorId].provisionalSuccessor.phase === "reintegrated" &&
      directReunion.world.bands[unresolved.successorId].demography.population === 0 &&
      totalWorldPopulation(directReunion.world) === totalWorldPopulation(coLocated) &&
      (directReunion.world.bands[unresolved.successorId].successorPostReturnEstablishmentEvents?.length ?? 0) === 0,
    directReunion.ok === true,
    directReunion.ok === true ? {
      ok: true,
      phase: directReunion.world.bands[unresolved.successorId].provisionalSuccessor.phase,
      ledger: directReunion.ledger,
    } : directReunion,
  );

  const terminalParentFixture = makeGenuineUnresolvedFailedReturn(modules, warm, {
    successorBandId: "band:failed-return-terminal-parent",
    lineageId: "LIN-FAILED-RETURN-TERMINAL-PARENT",
    terminalParent: true,
  });
  const terminalParentPositive = runRegisteredPostReturnContinuation(modules, terminalParentFixture);
  const terminalParentBand = terminalParentPositive.world.bands[terminalParentFixture.parentId];
  record(
    "F11_terminal_parent_creates_no_omniscience_or_dead_end",
    "a terminal parent cannot receive remote reintegration and is never read by the decision, while the living successor still needs and earns the same fresh decision and operation",
    terminalParentBand.status === "dispersed" &&
      terminalParentPositive.band.provisionalSuccessor.phase === "established_after_failed_return" &&
      terminalParentPositive.band.provisionalSuccessor.postReturnCommitment.evidence.sourceAuthorities.every(
        (source) => !source.toLowerCase().includes("parent condition") && !source.toLowerCase().includes("parent position"),
      ) &&
      terminalParentPositive.band.successorPostReturnEstablishmentEvents?.at(-1)?.independentOperation.allRequirementsMet === true,
    terminalParentBand.status === "dispersed",
    {
      parentStatus: terminalParentBand.status,
      parentPosition: terminalParentBand.position,
      successorPosition: terminalParentPositive.band.position,
      decisionSources: terminalParentPositive.band.provisionalSuccessor.postReturnCommitment.evidence.sourceAuthorities,
    },
  );

  // Negative: old founder commitment and arbitrary elapsed time cannot act.
  const timeOnly = modules.lifecycleResolver.resolveProvisionalLifecycles(
    unresolved.world,
    unresolved.unresolvedDay + 10_000,
  );
  record(
    "N1_old_commitment_and_time_only_cannot_resolve",
    "the old founder commitment, spent permit, living bodies and arbitrary elapsed time leave unresolved unchanged without a new decision",
    timeOnly.world.bands[unresolved.successorId].provisionalSuccessor.phase === "unresolved_after_failed_return" &&
      timeOnly.world.bands[unresolved.successorId].provisionalSuccessor.postReturnCommitment === undefined &&
      digest(timeOnly.world) === digest(unresolved.world),
    before.provisionalSuccessor.departureProvenance.authorizationStatus === "consumed_by_departure",
    { oldCommitment: before.provisionalSuccessor.departureProvenance.commitmentId, resolver: timeOnly.resolutions },
  );

  const oldDeparture = makeCanonicalStabilizationDeparture(modules, warm, {
    successorBandId: "band:failed-return-old-evidence",
    lineageId: "LIN-FAILED-RETURN-OLD-EVIDENCE",
  });
  const oldQualifying = buildQualifyingPreReleaseWorld(modules, oldDeparture);
  const oldEvidenceWorld = replaceBand(oldQualifying.world, oldDeparture.successorId, (band) => ({
    ...band,
    provisionalSuccessor: {
      ...band.provisionalSuccessor,
      phase: "unresolved_after_failed_return",
      phaseEnteredDay: oldQualifying.day + 1,
      separationCourse: {
        status: "return_path_entered",
        initializedOnDay: oldDeparture.departureDay,
        firstEnteredOnDay: oldQualifying.day,
        enteredFromPhase: "establishing",
        trigger: "lived_return_decision",
      },
    },
  }));
  const oldEvidence = modules.postReturn.advancePostReturnDispositions(oldEvidenceWorld, oldQualifying.day + 100);
  record(
    "N2_pre_return_operation_evidence_cannot_be_replayed",
    "a fully qualifying old outbound operation window supplies zero post-failure lived days and cannot create the new commitment",
    oldQualifying.evidence.allRequirementsMet === true &&
      oldEvidence.commitments.length === 0 &&
      oldEvidence.refusals[0]?.refusal === "post_failure_life_not_measured",
    oldQualifying.evidence.allRequirementsMet === true,
    { oldWindow: oldQualifying.evidence.assessmentWindow, refusal: oldEvidence.refusals[0] },
  );

  const overflowed = replaceBand(unresolved.world, unresolved.successorId, (band) => ({
    ...band,
    provisionalSuccessor: {
      ...band.provisionalSuccessor,
      history: Array.from({ length: modules.kernel.LIFECYCLE_HISTORY_CAP }, (_, index) =>
        index % 2 === 0 ? "travelling" : "establishing"),
    },
  }));
  record(
    "N3_history_overflow_cannot_forget_return",
    "evicting returning from the bounded lifecycle ring cannot erase the absorbing separation-course fact",
    overflowed.bands[unresolved.successorId].provisionalSuccessor.history.includes("returning") === false &&
      overflowed.bands[unresolved.successorId].provisionalSuccessor.separationCourse.status === "return_path_entered",
    overflowed.bands[unresolved.successorId].provisionalSuccessor.history.length === modules.kernel.LIFECYCLE_HISTORY_CAP,
    overflowed.bands[unresolved.successorId].provisionalSuccessor,
  );

  const fabricated = replaceBand(unresolved.world, unresolved.successorId, (band) => ({
    ...band,
    provisionalSuccessor: {
      ...band.provisionalSuccessor,
      phase: "continuing_after_failed_return",
      postReturnCommitment: {
        ...commitment,
        commitmentId: `${commitment.commitmentId}:fabricated`,
      },
      operationHistory: event.independentOperation === undefined ? undefined : after.provisionalSuccessor.operationHistory,
    },
  }));
  const fabricatedAttempt = modules.postReturn.advancePostReturnEstablishment(fabricated, positive.day);
  record(
    "N4_hand_built_commitment_cannot_complete",
    "a hand-built post-return commitment that did not come through the canonical identity/evidence path is refused even when later-looking operation history is present",
    fabricatedAttempt.established.length === 0 &&
      fabricatedAttempt.refusals[0]?.refusal === "fresh_commitment_not_canonical",
    fabricated.bands[unresolved.successorId].provisionalSuccessor.postReturnCommitment !== undefined,
    fabricatedAttempt.refusals[0],
  );

  const readyWorld = replaceBand(unresolved.world, unresolved.successorId, (band) => ({
    ...band,
    position: after.position,
    provisionalSuccessor: {
      ...band.provisionalSuccessor,
      phase: "continuing_after_failed_return",
      phaseEnteredDay: commitment.decisionDay,
      history: after.provisionalSuccessor.history.slice(0, -1),
      postReturnCommitment: commitment,
      operationHistory: after.provisionalSuccessor.operationHistory,
      travelSubsistence: after.provisionalSuccessor.travelSubsistence,
    },
  }));
  const stalePostCommitWorld = replaceBand(readyWorld, unresolved.successorId, (band) => ({
    ...band,
    provisionalSuccessor: {
      ...band.provisionalSuccessor,
      operationHistory: oldQualifying.world.bands[oldDeparture.successorId].provisionalSuccessor.operationHistory,
    },
  }));
  const stalePostCommitAttempt = modules.postReturn.advancePostReturnEstablishment(
    stalePostCommitWorld,
    positive.day,
  );
  record(
    "N4b_pre_commitment_operation_cannot_complete",
    "even a physically qualifying old demand window cannot establish the group unless its start is strictly after the fresh commitment",
    stalePostCommitAttempt.established.length === 0 &&
      stalePostCommitAttempt.refusals[0]?.refusal === "no_fresh_operation_window",
    oldQualifying.evidence.allRequirementsMet === true,
    { oldWindow: oldQualifying.evidence.assessmentWindow, decisionDay: commitment.decisionDay, refusal: stalePostCommitAttempt.refusals[0] },
  );

  const forgottenCourseWorld = replaceBand(readyWorld, unresolved.successorId, (band) => ({
    ...band,
    provisionalSuccessor: {
      ...band.provisionalSuccessor,
      separationCourse: { status: "outbound_trial", initializedOnDay: departure.departedOnDay },
    },
  }));
  const forgottenCourseAttempt = modules.postReturn.advancePostReturnEstablishment(
    forgottenCourseWorld,
    positive.day,
  );
  record(
    "N4c_monotonic_return_fact_is_a_completion_barrier",
    "a post-return completion is refused if the absorbing return-path fact is removed even though commitment and fresh operation otherwise qualify",
    forgottenCourseAttempt.established.length === 0 &&
      forgottenCourseAttempt.refusals[0]?.refusal === "fresh_commitment_not_canonical",
    event.independentOperation.allRequirementsMet === true,
    forgottenCourseAttempt.refusals[0],
  );

  const dirtyReleaseWorld = replaceBand(readyWorld, unresolved.successorId, (band) => ({
    ...band,
    currentCampTileId: band.position,
  }));
  const dirtyReleaseAttempt = modules.postReturn.advancePostReturnEstablishment(
    dirtyReleaseWorld,
    positive.day,
  );
  record(
    "N4d_cross_system_release_must_start_clean",
    "a half-initialized established surface is refused rather than overwritten or merged by the post-return release",
    dirtyReleaseAttempt.established.length === 0 &&
      dirtyReleaseAttempt.refusals[0]?.refusal === "quarantine_release_preconditions_not_met",
    dirtyReleaseWorld.bands[unresolved.successorId].currentCampTileId !== undefined,
    dirtyReleaseAttempt.refusals[0],
  );

  const awayReintegration = modules.reintegration.performAtomicReintegration({
    world: unresolved.world,
    successorId: unresolved.successorId,
    today: unresolved.unresolvedDay + 1,
  });
  record(
    "N5_no_remote_reintegration",
    "a real unresolved successor cannot reintegrate while the parent is physically elsewhere",
    awayReintegration.ok === false && awayReintegration.refusal === "not_physically_co_located" &&
      !("world" in awayReintegration),
    String(before.position) !== String(unresolved.world.bands[unresolved.parentId].position),
    awayReintegration,
  );

  const zero = replaceBand(unresolved.world, unresolved.successorId, (band) => ({
    ...band,
    size: 0,
    demography: { ...band.demography, population: 0, workingAdults: 0, dependents: 0, elders: 0 },
  }));
  const zeroDisposition = modules.postReturn.advancePostReturnDispositions(zero, unresolved.unresolvedDay + 5);
  const zeroResolution = modules.lifecycleResolver.resolveProvisionalLifecycles(zero, unresolved.unresolvedDay + 5);
  record(
    "N6_zero_bodies_cannot_establish",
    "a dead unresolved group creates no fresh commitment and terminalizes only through the existing zero-population resolver",
    zeroDisposition.commitments.length === 0 &&
      zeroResolution.world.bands[unresolved.successorId].provisionalSuccessor.phase === "provisional_extinguished",
    zero.bands[unresolved.successorId].demography.population === 0,
    { commitments: zeroDisposition.commitments, resolutions: zeroResolution.resolutions },
  );

  const elapsedCompletion = modules.kernel.requestTransition({
    current: { phase: "continuing_after_failed_return", phaseEnteredDay: 0, history: ["unresolved_after_failed_return"] },
    to: "established_after_failed_return",
    today: 10_000,
    cause: "elapsed_time",
    postReturnEstablishmentProof: {
      freshCommitmentProven: true,
      postCommitmentOperationProven: true,
      quarantineReleaseInitialized: true,
    },
  });
  record(
    "N7_no_timer_generated_positive_outcome",
    "even a caller claiming every proof cannot enter established-after-failed-return with elapsed time as its cause",
    elapsedCompletion.ok === false && elapsedCompletion.rejection === "terminal_outcome_requires_a_physical_event",
    true,
    elapsedCompletion,
  );

  // F12 is deliberately a long disposition proof. A single TravelRefusal is not an exit.
  const blockedOptions = {
    successorBandId: "band:failed-return-blocked-route",
    lineageId: "LIN-FAILED-RETURN-BLOCKED-ROUTE",
  };
  const blockedFixture = makeBlockedPostReturnCourse(modules, warm, blockedOptions);
  const blocked = runBlockedPostReturnCourse(modules, blockedFixture, 80);
  const blockedA = blockedFixture.commitment;
  const blockedB = blocked.recommitted;
  const failedA = blocked.superseded;
  const blockedKnowledge = blockedFixture.world.bands[blockedFixture.successorId].knowledge.observedTiles;
  const blockedCompletion = blocked.band.successorPostReturnEstablishmentEvents?.at(-1);
  const contiguousBlockedTrace = blocked.trace.every((row) => row.movedDistance === 0 || row.movedDistance === 1);
  const populationStayedAlive = blocked.trace.every((row) => row.population > 0);
  const localSubsistenceWasReal = blocked.trace.some((row) => (row.supportUnits ?? 0) > 0) &&
    blocked.trace.some((row) => (row.demandUnits ?? 0) > 0);
  record(
    "F12_structural_dead_end_removed_on_productive_and_failing_ground",
    "a living, locally blocked A course crosses the existing repeated-refusal boundary, becomes typed history, waits for a new Band-only decision, adopts observed B under a new identity, walks contiguously and establishes only after B's fresh operation",
    after.provisionalSuccessor.phase === "established_after_failed_return" &&
      blocked.resolved === true && populationStayedAlive && localSubsistenceWasReal &&
      blockedA.evidence.target.basis === "group_observed_memory" &&
      blockedKnowledge[blockedA.targetTileId] !== undefined &&
      blockedFixture.blockingTileIds.length > 0 &&
      blockedFixture.blockingTileIds.every((tileId) => blockedKnowledge[tileId] === undefined) &&
      failedA?.status === "superseded_after_physical_failure" &&
      failedA.commitment.commitmentId === blockedA.commitmentId &&
      failedA.failure.reason === "repeated_local_route_refusal" &&
      failedA.failure.blockedStepDays >= modules.returnDecision.RETURN_BLOCKED_DAYS &&
      blockedB !== undefined && blockedB.commitmentId !== blockedA.commitmentId &&
      String(blockedB.targetTileId) === String(blockedFixture.alternativeTargetTileId) &&
      blockedKnowledge[blockedB.targetTileId] !== undefined &&
      contiguousBlockedTrace &&
      blockedCompletion?.continuationCommitment.commitmentId === blockedB.commitmentId &&
      blockedCompletion.independentOperation.commitmentId === blockedB.commitmentId &&
      blockedCompletion.independentOperation.assessmentWindow.startDay > blockedB.decisionDay,
    blocked.trace.length > modules.returnDecision.RETURN_BLOCKED_DAYS && failedA !== undefined && blockedB !== undefined,
    {
      productiveOutcome: after.provisionalSuccessor.phase,
      A: blockedA,
      hiddenLocalBlockingTileIds: blockedFixture.blockingTileIds,
      AFailure: failedA,
      B: blockedB,
      BCompletion: blockedCompletion,
      trace: blocked.trace,
    },
  );

  const beforeFailureRows = failedA === undefined
    ? []
    : blocked.trace.filter((row) => row.day < failedA.supersededOnDay);
  record(
    "F12b_no_one_day_overreaction",
    "one refusal does not abandon A: the same current commitment persists while retained refused attempts accumulate through one, two, three and four, and only the existing fifth refusal proves route failure",
    beforeFailureRows.length >= modules.returnDecision.RETURN_BLOCKED_DAYS - 1 &&
      beforeFailureRows.every((row) =>
        row.phase === "continuing_after_failed_return" && row.commitmentId === blockedA.commitmentId) &&
      Array.from({ length: modules.returnDecision.RETURN_BLOCKED_DAYS - 1 }, (_, index) => index + 1)
        .every((count) => beforeFailureRows.some((row) => row.blockedStepDays === count)) &&
      failedA?.failure.blockedStepDaysRequired === modules.returnDecision.RETURN_BLOCKED_DAYS,
    failedA !== undefined && blocked.trace.some((row) => row.blockedStepDays === 1),
    { boundary: modules.returnDecision.RETURN_BLOCKED_DAYS, beforeFailureRows, failure: failedA?.failure },
  );

  const emptyOperationHistory = (history) =>
    history?.lifetimeDaysWithAnyPhysicalTake === 0 &&
    history?.lifetimeAssessmentWindows === 0 &&
    history?.recentAssessmentWindows.length === 0 &&
    history?.openAssessmentWindow === undefined;
  record(
    "F12c_recommitment_is_fresh_and_old_operation_isolated",
    "B binds the current cohorts, current decision tile and new observed target under a new id; A's active operation ledger is discarded and cannot establish B on the recommitment day",
    blockedB !== undefined && failedA !== undefined &&
      blockedB.commitmentId !== blockedA.commitmentId &&
      blockedB.decisionDay > failedA.supersededOnDay &&
      String(blockedB.decisionTileId) === String(blocked.trace.find(
        (row) => row.commitmentId === blockedB.commitmentId,
      )?.position) &&
      blockedB.survivors.workingAdults === blocked.band.demography.workingAdults &&
      blockedB.survivors.dependents === blocked.band.demography.dependents &&
      blockedB.survivors.elders === blocked.band.demography.elders &&
      (blocked.operationHistoryBeforeRecommitment?.lifetimeDaysWithAnyPhysicalTake ?? 0) > 0 &&
      emptyOperationHistory(blocked.operationHistoryAtRecommitment) &&
      blocked.staleEvidenceRefusalAtRecommitment?.refusal === "no_fresh_operation_window",
    blockedB !== undefined && (blocked.operationHistoryBeforeRecommitment?.lifetimeDaysWithAnyPhysicalTake ?? 0) > 0,
    {
      AId: blockedA.commitmentId,
      B: blockedB,
      operationBeforeB: blocked.operationHistoryBeforeRecommitment,
      operationAtB: blocked.operationHistoryAtRecommitment,
      immediateBRecognition: blocked.staleEvidenceRefusalAtRecommitment,
    },
  );

  const failedGround = runFailedGroundAfterArrival(modules, warm, {
    successorBandId: "band:failed-return-ground-failure",
    lineageId: "LIN-FAILED-RETURN-GROUND-FAILURE",
  }, 80);
  const groundA = failedGround.fixture.commitment;
  const groundB = failedGround.recommitted;
  const groundFailure = failedGround.superseded?.failure;
  const groundCompletion = failedGround.band.successorPostReturnEstablishmentEvents?.at(-1);
  record(
    "F12d_failed_ground_after_arrival_reopens_disposition",
    "A is physically reached, a complete strictly post-A target-local operation fails, establishment refuses, A becomes typed history, and only a later fresh B operation can establish",
    failedGround.arrivalDay !== undefined && failedGround.arrivalDay > groundA.decisionDay &&
      failedGround.establishmentRefusalAtFailure?.refusal === "fresh_operation_contract_not_met" &&
      groundFailure?.physicallyReachedCommittedTarget === true &&
      groundFailure.completedTargetWindow !== undefined &&
      groundFailure.completedTargetWindow.startDay > groundA.decisionDay &&
      groundFailure.completedTargetWindow.tileIds.every((tileId) => String(tileId) === String(groundA.targetTileId)) &&
      groundFailure.reason.startsWith("completed_target_window_") &&
      failedGround.superseded?.status === "superseded_after_physical_failure" &&
      groundB !== undefined && groundB.commitmentId !== groundA.commitmentId &&
      groundB.decisionDay > failedGround.superseded.supersededOnDay &&
      emptyOperationHistory(failedGround.operationHistoryAtRecommitment) &&
      failedGround.staleEvidenceRefusalAtRecommitment?.refusal === "no_fresh_operation_window" &&
      failedGround.trace.every((row) => row.population > 0 && (row.movedDistance === 0 || row.movedDistance === 1)) &&
      failedGround.band.provisionalSuccessor.phase === "established_after_failed_return" &&
      groundCompletion?.continuationCommitment.commitmentId === groundB.commitmentId &&
      groundCompletion.independentOperation.assessmentWindow.startDay > groundB.decisionDay,
    groundFailure?.completedTargetWindow !== undefined && groundB !== undefined,
    {
      A: groundA,
      arrivalDay: failedGround.arrivalDay,
      establishmentRefusal: failedGround.establishmentRefusalAtFailure,
      AFailure: failedGround.superseded,
      B: groundB,
      operationBeforeB: failedGround.operationHistoryBeforeRecommitment,
      operationAtB: failedGround.operationHistoryAtRecommitment,
      immediateBRecognition: failedGround.staleEvidenceRefusalAtRecommitment,
      BCompletion: groundCompletion,
      trace: failedGround.trace,
    },
  );

  const reintegrationFixture = makeBlockedPostReturnCourse(modules, warm, {
    successorBandId: "band:failed-return-reconsidered-reunion",
    lineageId: "LIN-FAILED-RETURN-RECONSIDERED-REUNION",
  });
  const reconsidered = runBlockedPostReturnCourse(
    modules,
    reintegrationFixture,
    30,
    { stopAfterSupersession: true },
  );
  const reconsideredBand = reconsidered.world.bands[reintegrationFixture.successorId];
  const parentRejoinedWorld = replaceBand(reconsidered.world, reintegrationFixture.unresolved.parentId, (parent) => ({
    ...parent,
    position: reconsideredBand.position,
  }));
  const rejoinedAfterA = modules.advance.advanceWorldByDays(parentRejoinedWorld, 1);
  const rejoinedAfterABand = rejoinedAfterA.bands[reintegrationFixture.successorId];
  record(
    "F12e_reintegration_survives_A_failure_before_B",
    "after A is superseded and before B exists, physical parent co-location still wins through the existing reintegration authority; no remote reunion or independent commitment is fabricated",
    reconsideredBand.provisionalSuccessor.phase === "unresolved_after_failed_return" &&
      reconsideredBand.provisionalSuccessor.postReturnCommitment === undefined &&
      reconsidered.superseded?.commitment.commitmentId === reintegrationFixture.commitment.commitmentId &&
      rejoinedAfterABand.provisionalSuccessor.phase === "reintegrated" &&
      rejoinedAfterABand.provisionalSuccessor.postReturnCommitment === undefined &&
      rejoinedAfterABand.demography.population === 0 &&
      totalWorldPopulation(parentRejoinedWorld) === totalWorldPopulation(rejoinedAfterA),
    reconsidered.superseded !== undefined &&
      String(parentRejoinedWorld.bands[reintegrationFixture.unresolved.parentId].position) === String(reconsideredBand.position),
    {
      reconsideredPhase: reconsideredBand.provisionalSuccessor.phase,
      history: reconsideredBand.provisionalSuccessor.postReturnCommitmentHistory,
      rejoinedPhase: rejoinedAfterABand.provisionalSuccessor.phase,
      actionIds: modules.registry.DEFAULT_DAILY_ACTIONS.map((action) => action.id),
    },
  );

  const zeroContinuing = replaceBand(blockedFixture.world, blockedFixture.successorId, (band) => ({
    ...band,
    size: 0,
    demography: { ...band.demography, population: 0, workingAdults: 0, dependents: 0, elders: 0 },
  }));
  const zeroReopened = replaceBand(reconsidered.world, reintegrationFixture.successorId, (band) => ({
    ...band,
    size: 0,
    demography: { ...band.demography, population: 0, workingAdults: 0, dependents: 0, elders: 0 },
  }));
  const zeroContinuingResult = modules.lifecycleResolver.resolveProvisionalLifecycles(
    zeroContinuing,
    blockedFixture.decisionDay + 1,
  );
  const zeroReopenedResult = modules.lifecycleResolver.resolveProvisionalLifecycles(
    zeroReopened,
    Number(zeroReopened.time.day) + 1,
  );
  record(
    "F12f_zero_population_terminalizes_current_and_reopened_states",
    "both a live commitment state and the decision-capable state reopened after A failure remain reachable by the existing zero-body terminalizer",
    zeroContinuingResult.world.bands[blockedFixture.successorId].provisionalSuccessor.phase === "provisional_extinguished" &&
      zeroReopenedResult.world.bands[reintegrationFixture.successorId].provisionalSuccessor.phase === "provisional_extinguished",
    zeroContinuing.bands[blockedFixture.successorId].provisionalSuccessor.phase === "continuing_after_failed_return" &&
      zeroReopened.bands[reintegrationFixture.successorId].provisionalSuccessor.phase === "unresolved_after_failed_return",
    {
      continuingResolution: zeroContinuingResult.resolutions,
      reopenedResolution: zeroReopenedResult.resolutions,
    },
  );

  const successorAdvanceFacts = {
    travelling: "contiguous physical arrival, lived return decision, travel timeout, or zero bodies",
    establishing: "fresh independent-operation proof, failed trial timeout, lived return decision, physical reunion, or zero bodies",
    failed_early: "bounded failure interval expires into a physical return course, or zero bodies",
    returning: "physical parent co-location, bounded return expiry without reunion, or zero bodies",
    unresolved_after_failed_return: "physical reunion, a fresh current-survivor decision using group-owned knowledge, or zero bodies",
    continuing_after_failed_return: "fresh post-commitment operation, typed physical course failure reopening disposition, or zero bodies",
  };
  const successorPersistence = {
    travelling: { canRemainAliveIndefinitely: false, why: "TRAVEL_MAX_DAYS has a non-success returning timeout" },
    establishing: { canRemainAliveIndefinitely: false, why: "ESTABLISHMENT_MAX_DAYS has a failed_early timeout" },
    failed_early: { canRemainAliveIndefinitely: false, why: "FAILED_EARLY_MAX_DAYS has a returning timeout" },
    returning: { canRemainAliveIndefinitely: false, why: "RETURN_MAX_DAYS ends only the action in unresolved_after_failed_return" },
    unresolved_after_failed_return: {
      canRemainAliveIndefinitely: true,
      why: "persistence is truthful only while no co-located parent and no uncontradicted group-known course exists; its decision authority still runs daily",
    },
    continuing_after_failed_return: {
      canRemainAliveIndefinitely: false,
      why: "movement/subsistence produces either a qualifying operation, a retained route refusal boundary, a completed failed target-local window, bodily failure, or zero bodies",
    },
  };
  const nonterminalSuccessorAudit = modules.kernel.PHASE_CONTRACTS
    .filter((contract) => contract.side === "successor" && contract.terminal === false)
    .map((contract) => ({
      phase: contract.phase,
      resolutionKind: contract.resolutionKind,
      permittedExits: contract.permittedNext,
      productionWriter: contract.transitionWriter,
      physicalOrSocialFact: successorAdvanceFacts[contract.phase],
      ...successorPersistence[contract.phase],
      ...(contract.maxDays === undefined ? {} : { maxDays: contract.maxDays, onTimeout: contract.onTimeout }),
    }));
  const auditedPhaseNames = nonterminalSuccessorAudit.map((row) => row.phase).sort();
  const expectedNonterminalSuccessorPhases = Object.keys(successorAdvanceFacts).sort();
  record(
    "F12g_every_nonterminal_successor_phase_has_a_causal_disposition",
    "every nonterminal successor contract names its resolution kind, exits, production writer, advancing fact and truthful persistence semantics; the correction did not move limbo into another phase",
    digest(auditedPhaseNames) === digest(expectedNonterminalSuccessorPhases) &&
      nonterminalSuccessorAudit.every((row) =>
        row.productionWriter.length > 0 && row.permittedExits.length > 0 && row.physicalOrSocialFact.length > 0 &&
        (row.resolutionKind !== "temporally_bounded_action" ||
          (row.canRemainAliveIndefinitely === false && row.maxDays > 0 && row.onTimeout !== undefined))) &&
      nonterminalSuccessorAudit.find((row) => row.phase === "continuing_after_failed_return")
        ?.permittedExits.includes("unresolved_after_failed_return") === true &&
      modules.registry.DEFAULT_DAILY_ACTIONS.some((action) => action.id === "post_return_reconsideration"),
    nonterminalSuccessorAudit.length === expectedNonterminalSuccessorPhases.length,
    nonterminalSuccessorAudit,
  );

  const repeated = runRegisteredPostReturnContinuation(
    modules,
    makeGenuineUnresolvedFailedReturn(modules, warm),
  );
  const repeatedBlocked = runBlockedPostReturnCourse(
    modules,
    makeBlockedPostReturnCourse(modules, warm, blockedOptions),
    80,
  );
  const selected = (run) => ({
    phase: run.band.provisionalSuccessor.phase,
    course: run.band.provisionalSuccessor.separationCourse,
    commitment: run.band.provisionalSuccessor.postReturnCommitment,
    event: run.band.successorPostReturnEstablishmentEvents?.at(-1),
    position: run.band.position,
    demography: run.band.demography,
  });
  const selectedCorrection = (run) => ({
    phase: run.band.provisionalSuccessor.phase,
    currentCommitment: run.band.provisionalSuccessor.postReturnCommitment,
    commitmentHistory: run.band.provisionalSuccessor.postReturnCommitmentHistory,
    failedTargetTileIds: run.band.provisionalSuccessor.postReturnFailedTargetTileIds,
    event: run.band.successorPostReturnEstablishmentEvents?.at(-1),
    position: run.band.position,
    demography: run.band.demography,
  });
  record(
    "F13_deterministic_replay_and_bounded_state",
    "both the unchanged positive path and the A-failure/B-recommitment course replay to byte-identical normalized states while rich commitment history and failed-target memory remain bounded",
    digest(selected(positive)) === digest(selected(repeated)) &&
      digest(selectedCorrection(blocked)) === digest(selectedCorrection(repeatedBlocked)) &&
      after.provisionalSuccessor.history.length <= modules.kernel.LIFECYCLE_HISTORY_CAP &&
      (after.provisionalSuccessor.operationHistory?.recentAssessmentWindows.length ?? 0) <= modules.subsistence.RECENT_ASSESSMENT_WINDOW_CAP &&
      (after.successorPostReturnEstablishmentEvents?.length ?? 0) <= 12 &&
      (blocked.band.provisionalSuccessor.postReturnCommitmentHistory?.length ?? 0) <=
        modules.postReturn.POST_RETURN_COMMITMENT_HISTORY_CAP &&
      (blocked.band.provisionalSuccessor.postReturnFailedTargetTileIds?.length ?? 0) <=
        modules.postReturn.POST_RETURN_FAILED_TARGET_CAP,
    positive.trace.length > 2 && repeated.trace.length > 2 && blocked.superseded !== undefined,
    {
      positiveByteEqual: digest(selected(positive)) === digest(selected(repeated)),
      correctionByteEqual: digest(selectedCorrection(blocked)) === digest(selectedCorrection(repeatedBlocked)),
      lifecycleHistory: after.provisionalSuccessor.history.length,
      operationWindows: after.provisionalSuccessor.operationHistory?.recentAssessmentWindows.length,
      completionEvents: after.successorPostReturnEstablishmentEvents?.length,
      commitmentHistory: blocked.band.provisionalSuccessor.postReturnCommitmentHistory?.length,
      commitmentHistoryCap: modules.postReturn.POST_RETURN_COMMITMENT_HISTORY_CAP,
      failedTargets: blocked.band.provisionalSuccessor.postReturnFailedTargetTileIds?.length,
      failedTargetCap: modules.postReturn.POST_RETURN_FAILED_TARGET_CAP,
    },
  );

  const actionIds = modules.registry.DEFAULT_DAILY_ACTIONS.map((action) => action.id);
  record(
    "F14_order_and_quarantine_release_surface",
    "reintegration precedes every post-return decision, movement precedes subsistence and physical-failure assessment, reconsideration precedes replacement disposition, and recognition precedes the deadline; released bands enter ordinary readers only afterward",
    actionIds.indexOf("provisional_reintegration") < actionIds.indexOf("post_return_disposition") &&
      actionIds.indexOf("provisional_travel") < actionIds.indexOf("provisional_travel_subsistence") &&
      actionIds.indexOf("provisional_travel_subsistence") < actionIds.indexOf("post_return_reconsideration") &&
      actionIds.indexOf("post_return_reconsideration") < actionIds.indexOf("post_return_disposition") &&
      actionIds.indexOf("post_return_disposition") < actionIds.indexOf("post_return_establishment") &&
      actionIds.indexOf("post_return_establishment") < actionIds.indexOf("provisional_lifecycle_deadline") &&
      modules.viability.updateBandViabilityStates(positive.world).bands[after.id].viability !== undefined &&
      modules.lifecycle.isFissionEligibleParent(after) === true,
    actionIds.includes("post_return_reconsideration") &&
      actionIds.includes("post_return_disposition") && actionIds.includes("post_return_establishment"),
    { actionIds },
  );

  const matrix = {
    laterPhysicalReintegration: reunited.provisionalSuccessor.phase,
    newIndependentContinuation: after.provisionalSuccessor.phase,
    terminalParent: terminalParentPositive.band.provisionalSuccessor.phase,
    worseningCondition: {
      blockedRoute: blocked.band.provisionalSuccessor.phase,
      failedGround: failedGround.band.provisionalSuccessor.phase,
      historicalReasons: [failedA?.failure.reason, groundFailure?.reason],
    },
    zeroPopulation: zeroResolution.world.bands[unresolved.successorId].provisionalSuccessor.phase,
  };
  record(
    "F15_long_horizon_controlled_matrix",
    "the controlled matrix reaches reintegration, unchanged positive completion, parent-terminal continuation, long blocked-route and failed-ground reconsideration/completion, and zero-population extinction without threshold tuning",
    matrix.laterPhysicalReintegration === "reintegrated" &&
      matrix.newIndependentContinuation === "established_after_failed_return" &&
      matrix.terminalParent === "established_after_failed_return" &&
      matrix.worseningCondition.blockedRoute === "established_after_failed_return" &&
      matrix.worseningCondition.failedGround === "established_after_failed_return" &&
      matrix.worseningCondition.historicalReasons.every((reason) => reason !== undefined) &&
      matrix.zeroPopulation === "provisional_extinguished",
    Object.values(matrix).length === 5,
    matrix,
  );

  const architectures = {
    A_physical_failure_reopens_disposition:
      "SELECTED: typed retained route refusal, complete target-local operation failure, or current bodily incapacity reopens unresolved_after_failed_return",
    B_explicit_commitment_supersession:
      "SELECTED with A: the immutable A decision and its typed contradiction move into bounded history before current authority is cleared",
    C_bounded_continuation_action:
      "REJECTED as the primary mechanism: an arbitrary clock adds no physical fact; elapsed time still cannot establish and physical boundaries act earlier",
    D_multi_stage_known_country_search:
      "SELECTED only through repeated fresh Band-only decisions; target ids are never edited in place and contradicted exact-memory targets are excluded",
    E_new_phase_or_generalized_stabilization:
      "REJECTED: the existing unresolved decision-capable state is sufficient, and ordinary stabilized must retain provesNeverEnteredReturnPath",
    selected_smallest_truthful_architecture:
      "A+B+D inside the existing two phases, preserving the distinct established_after_failed_return outcome and strict post-commitment evidence",
  };

  const failed = fixtures.filter((fixture) => fixture.verdict !== "PASS");
  output = {
    audit: "ROADMAP ITEM 4 — failed-return resolution",
    verdict: failed.length === 0 ? "PASS" : "FAIL",
    architectures,
    counts: { total: fixtures.length, passing: fixtures.length - failed.length, failing: failed.length, vacuous: fixtures.filter((f) => f.verdict === "VACUOUS").length },
    fixtures,
  };
} finally {
  await server.close();
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output, null, 2));
if (output.verdict !== "PASS") process.exitCode = 1;
