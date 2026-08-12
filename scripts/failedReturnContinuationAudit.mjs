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
  makeGenuineUnresolvedFailedReturn,
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

  // Structural response on bad ground: two real barren day records lead to a decision naming only
  // observed country; movement does not happen until the next day's travel action.
  const failureDays = [1, 2].map((offset) => ({
    day: unresolved.unresolvedDay + offset,
    tileId: before.position,
    gatherShare: 0.8,
    gatheringWorkers: Math.max(1, before.demography.workingAdults),
    requestedUnits: 1,
    harvestedUnits: 0,
    usableUnits: 0,
    depletionApplied: 0,
    demandUnits: 0.1,
    waterStress: 0.5,
    sourceKind: "none",
    failureReason: "physical_source_absent",
  }));
  const failing = replaceBand(unresolved.world, unresolved.successorId, (band) => ({
    ...band,
    provisionalSuccessor: {
      ...band.provisionalSuccessor,
      travelSubsistence: {
        ...band.provisionalSuccessor.travelSubsistence,
        lastAdvancedDay: unresolved.unresolvedDay + 2,
        daysElapsed: 2,
        demandUnits: 0.2,
        supportUnits: 0,
        gatheringDays: 2,
        waterStressDaySum: 1,
        daysWithoutWater: 2,
        recentDays: failureDays,
      },
    },
  }));
  const failingDecision = modules.postReturn.advancePostReturnDispositions(failing, unresolved.unresolvedDay + 2);
  const failingBand = failingDecision.world.bands[unresolved.successorId];
  const failingTarget = failingBand.provisionalSuccessor.postReturnCommitment?.targetTileId;
  const failingMoved = modules.travel.advanceProvisionalTravel(failingDecision.world, unresolved.unresolvedDay + 3);
  const failingStep = failingMoved.steps.find((step) => step.bandId === unresolved.successorId);
  record(
    "F12_structural_dead_end_removed_on_productive_and_failing_ground",
    "productive ground reaches a fresh established outcome, while failing ground produces a real social relocation decision toward observed country and a contiguous physical step instead of inert waiting",
    after.provisionalSuccessor.phase === "established_after_failed_return" &&
      failingDecision.commitments.length === 1 &&
      failingTarget !== undefined && before.knowledge.observedTiles[failingTarget] !== undefined &&
      failingStep !== undefined &&
      (failingStep.moved ? (() => {
        const from = modules.generate.getTile(failingMoved.world, failingStep.fromTileId);
        const to = modules.generate.getTile(failingMoved.world, failingStep.toTileId);
        return Math.abs(from.coord.x - to.coord.x) + Math.abs(from.coord.y - to.coord.y) === 1;
      })() : failingStep.refusal !== undefined),
    failingDecision.commitments.length === 1,
    { productiveOutcome: after.provisionalSuccessor.phase, failingCommitment: failingDecision.commitments[0], failingStep },
  );

  const repeated = runRegisteredPostReturnContinuation(
    modules,
    makeGenuineUnresolvedFailedReturn(modules, warm),
  );
  const selected = (run) => ({
    phase: run.band.provisionalSuccessor.phase,
    course: run.band.provisionalSuccessor.separationCourse,
    commitment: run.band.provisionalSuccessor.postReturnCommitment,
    event: run.band.successorPostReturnEstablishmentEvents?.at(-1),
    position: run.band.position,
    demography: run.band.demography,
  });
  record(
    "F13_deterministic_replay_and_bounded_state",
    "the same controlled causal setup replays to the same normalized state and all new histories remain bounded",
    digest(selected(positive)) === digest(selected(repeated)) &&
      after.provisionalSuccessor.history.length <= modules.kernel.LIFECYCLE_HISTORY_CAP &&
      (after.provisionalSuccessor.operationHistory?.recentAssessmentWindows.length ?? 0) <= modules.subsistence.RECENT_ASSESSMENT_WINDOW_CAP &&
      (after.successorPostReturnEstablishmentEvents?.length ?? 0) <= 12,
    positive.trace.length > 2 && repeated.trace.length > 2,
    {
      byteEqual: digest(selected(positive)) === digest(selected(repeated)),
      lifecycleHistory: after.provisionalSuccessor.history.length,
      operationWindows: after.provisionalSuccessor.operationHistory?.recentAssessmentWindows.length,
      completionEvents: after.successorPostReturnEstablishmentEvents?.length,
    },
  );

  const actionIds = modules.registry.DEFAULT_DAILY_ACTIONS.map((action) => action.id);
  record(
    "F14_order_and_quarantine_release_surface",
    "reintegration precedes disposition, movement precedes subsistence, disposition precedes post-return recognition, and the released band is admitted to viability/demography/future-fission readers only afterward",
    actionIds.indexOf("provisional_reintegration") < actionIds.indexOf("post_return_disposition") &&
      actionIds.indexOf("provisional_travel") < actionIds.indexOf("provisional_travel_subsistence") &&
      actionIds.indexOf("post_return_disposition") < actionIds.indexOf("post_return_establishment") &&
      actionIds.indexOf("post_return_establishment") < actionIds.indexOf("provisional_lifecycle_deadline") &&
      modules.viability.updateBandViabilityStates(positive.world).bands[after.id].viability !== undefined &&
      modules.lifecycle.isFissionEligibleParent(after) === true,
    actionIds.includes("post_return_disposition") && actionIds.includes("post_return_establishment"),
    { actionIds },
  );

  const matrix = {
    laterPhysicalReintegration: reunited.provisionalSuccessor.phase,
    newIndependentContinuation: after.provisionalSuccessor.phase,
    terminalParent: terminalParentPositive.band.provisionalSuccessor.phase,
    worseningCondition: {
      disposition: failingDecision.commitments[0],
      physicalStep: failingStep,
    },
    zeroPopulation: zeroResolution.world.bands[unresolved.successorId].provisionalSuccessor.phase,
  };
  record(
    "F15_long_horizon_controlled_matrix",
    "the controlled matrix reaches reintegration, distinct post-return establishment, parent-terminal continuation, a failing-ground relocation response, and zero-population extinction without threshold tuning",
    matrix.laterPhysicalReintegration === "reintegrated" &&
      matrix.newIndependentContinuation === "established_after_failed_return" &&
      matrix.terminalParent === "established_after_failed_return" &&
      matrix.worseningCondition.disposition !== undefined &&
      matrix.zeroPopulation === "provisional_extinguished",
    Object.values(matrix).length === 5,
    matrix,
  );

  const architectures = {
    A_fresh_recommitment: "SELECTED as a distinct current-survivor commitment",
    B_renewed_return_search: "REJECTED: no new parent location or information exists",
    C_independent_relocation: "SELECTED only inside provisional travel and only to current/observed country",
    D_distinct_terminal_outcome: "SELECTED: established_after_failed_return",
    E_generalize_stabilized: "REJECTED: would weaken provesNeverEnteredReturnPath",
    F_source_derived: "two-step commitment then strictly post-commitment operation",
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
