// ROADMAP ITEM 4 — POSITIVE SUCCESSOR STABILIZATION, NEGATIVE BARRIERS, AND RELEASE AUDIT.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { prepareAndDepart } from "./lib/preparedDeparture.mjs";
import {
  loadSuccessorStabilizationModules,
  warmStabilizationWorld,
  makeCanonicalStabilizationDeparture,
  buildQualifyingPreReleaseWorld,
  runRegisteredPositiveStabilization,
  advancePhysicalSuccessorDayWithoutStabilization,
  totalWorldPopulation,
} from "./lib/successorStabilizationFixture.mjs";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1] : fallback;
};
const EVIDENCE = "docs/evidence/dynamic-fission-daughter-viability-37";
const OUT = arg("out", `${EVIDENCE}/successor-stabilization-fixtures.json`);

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
const completionAbsent = (band) =>
  band.lineage === undefined &&
  band.deepHistory === undefined &&
  band.currentCampTileId === undefined &&
  (band.successorStabilizationEvents?.length ?? 0) === 0 &&
  band.provisionalSuccessor?.stabilizationEventId === undefined;

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-i4-stabilization-${process.pid}`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  logLevel: "error",
});

let output;
try {
  const modules = await loadSuccessorStabilizationModules(server);
  const warm = warmStabilizationWorld(modules);
  const departure = makeCanonicalStabilizationDeparture(modules, warm);
  const qualifying = buildQualifyingPreReleaseWorld(modules, departure);
  const positive = runRegisteredPositiveStabilization(modules, departure);
  const successorId = departure.successorId;
  const parentId = String(departure.parent.id);
  const departedBand = departure.departure.world.bands[successorId];
  const qualifyingBand = qualifying.world.bands[successorId];
  const stabilizedBand = positive.band;
  const stabilizedParent = positive.world.bands[parentId];
  const departureRecord = departedBand.successorDepartureRecords?.[0];
  const stabilizationEvent = stabilizedBand.successorStabilizationEvents?.[0];

  // ── POSITIVE PATH ────────────────────────────────────────────────────────────────────────────
  const prepared = departure.preparation.prepared;
  const consumed = departure.departure.world.bands[parentId].fissionAttempt?.preparedDeparture?.authorization;
  record(
    "S1_canonical_positive_commitment_and_spent_permit",
    "the physical successor comes from a positive founder-cohort commitment and the exact one-use permit is consumed by departure",
    prepared.commitment.actorResolution === "aggregate_founder_cohort" &&
      prepared.authorization.status === "live" &&
      consumed?.status === "consumed_by_departure" &&
      consumed.commitmentId === prepared.commitment.commitmentId,
    prepared.commitment.founders.workingAdults > 0,
    {
      commitmentId: prepared.commitment.commitmentId,
      decisionDay: prepared.commitment.decisionDay,
      departureDay: departure.departureDay,
      founders: prepared.commitment.founders,
      permitBefore: prepared.authorization.status,
      permitAfter: consumed?.status,
    },
  );

  record(
    "S2_departure_is_a_separate_bounded_historical_fact",
    "departure writes the same direct record to parent and successor but writes no completed lineage, founding snapshot, stabilization event or legacy instantaneous-fission event",
    departureRecord !== undefined &&
      digest(departureRecord) === digest(departure.departure.world.bands[parentId].successorDepartureRecords?.at(-1)) &&
      completionAbsent(departedBand) &&
      departedBand.fissionEvents.length === 0,
    departureRecord !== undefined && departureRecord.departedOnDay === departure.departureDay,
    {
      departureRecord,
      successorCompletionAbsent: completionAbsent(departedBand),
      legacyFissionEvents: departedBand.fissionEvents.length,
    },
  );

  const path = [String(departedBand.position), ...positive.trace.map((row) => row.position)];
  const physicalMoves = [];
  for (let index = 1; index < path.length; index += 1) {
    if (path[index] === path[index - 1]) continue;
    const from = modules.generate.getTile(positive.world, path[index - 1]);
    const to = modules.generate.getTile(positive.world, path[index]);
    physicalMoves.push({
      from: path[index - 1],
      to: path[index],
      manhattan: Math.abs(from.coord.x - to.coord.x) + Math.abs(from.coord.y - to.coord.y),
    });
  }
  record(
    "S3_travel_is_contiguous_and_arrival_precedes_success",
    "the founders begin at the parent camp, walk only adjacent steps, reach the accepted target, enter establishing and stabilize later without teleporting",
    String(departedBand.position) === String(departure.parent.position) &&
      String(departedBand.position) !== String(departure.target.id) &&
      physicalMoves.length >= 3 && physicalMoves.every((move) => move.manhattan === 1) &&
      positive.trace.some((row) => row.phase === "establishing") &&
      String(stabilizedBand.position) === String(departure.target.id) &&
      positive.day > departure.departureDay,
    physicalMoves.length > 0,
    { physicalMoves, phaseTrail: positive.trace, departureTile: departedBand.position, target: departure.target.id },
  );

  const evidence = stabilizationEvent?.independentOperation;
  record(
    "S4_independent_operation_is_a_non_vacuous_conjunction",
    "one outcome-blind demand window contains demand, worker-days, usable physical take, matching depletion, water and surviving bodies; every named conjunct holds",
    evidence?.allRequirementsMet === true &&
      Object.values(evidence.requirements).every(Boolean) &&
      evidence.assessmentWindow.demandUnits > 0 &&
      evidence.assessmentWindow.supportUnits > 0 &&
      evidence.assessmentWindow.workerDays > 0 &&
      evidence.assessmentWindow.daysWithAnyPhysicalTake > 0 &&
      evidence.assessmentWindow.depletionApplied > 0,
    (evidence?.assessmentWindow.days ?? 0) > 1,
    evidence,
  );

  record(
    "S5_mobile_operation_not_sedentary_prosperity",
    "the qualifying measurement may span several physically occupied tiles and succeeds at the existing return-failure floor rather than requiring prosperity or a fixed residence duration",
    (evidence?.assessmentWindow.tileIds.length ?? 0) > 1 &&
      evidence.assessmentWindow.supportRatio >= modules.returnDecision.RETURN_SUPPORT_RATIO_FLOOR &&
      evidence.assessmentWindow.supportRatio < 1 &&
      stabilizedBand.hungerPressure > 0,
    (evidence?.assessmentWindow.tileIds.length ?? 0) > 1,
    {
      tiles: evidence?.assessmentWindow.tileIds,
      supportRatio: evidence?.assessmentWindow.supportRatio,
      returnFailureFloor: modules.returnDecision.RETURN_SUPPORT_RATIO_FLOOR,
      hungerPressure: stabilizedBand.hungerPressure,
    },
  );

  record(
    "S6_atomic_stabilization_conserves_people_and_creates_no_duplicate_band",
    "stabilization changes identity/history only: population and location are unchanged and departure created exactly one successor",
    totalWorldPopulation(warm) === totalWorldPopulation(departure.departure.world) &&
      totalWorldPopulation(departure.departure.world) === totalWorldPopulation(positive.world) &&
      Object.keys(departure.departure.world.bands).length === Object.keys(warm.bands).length + 1 &&
      Object.keys(positive.world.bands).length === Object.keys(departure.departure.world.bands).length &&
      String(stabilizedBand.position) === String(qualifyingBand.position) &&
      stabilizedBand.demography.population === qualifyingBand.demography.population,
    stabilizedBand.demography.population > 0,
    {
      warmPopulation: totalWorldPopulation(warm),
      departurePopulation: totalWorldPopulation(departure.departure.world),
      stabilizedPopulation: totalWorldPopulation(positive.world),
      bandCounts: [Object.keys(warm.bands).length, Object.keys(departure.departure.world.bands).length, Object.keys(positive.world.bands).length],
    },
  );

  record(
    "S7_quarantine_release_is_complete_and_minimal",
    "the successful transition initializes the camp, lineage, founding snapshot, completion event and stored lineage readability while leaving viability, residential-anchor and proto-camp claims to their own writers",
    stabilizedBand.provisionalSuccessor?.phase === "stabilized" &&
      modules.lifecycle.isProvisionalSuccessor(stabilizedBand) === false &&
      modules.lifecycle.isEstablishedBand(stabilizedBand) === true &&
      String(stabilizedBand.currentCampTileId) === String(stabilizedBand.position) &&
      stabilizedBand.lineage?.daughterBandId === stabilizedBand.id &&
      stabilizedBand.deepHistory?.founding.bandId === stabilizedBand.id &&
      stabilizedBand.lineageReadability?.formationStatus === "established_daughter" &&
      stabilizedBand.viability === undefined &&
      stabilizedBand.residentialAnchor === undefined &&
      stabilizedBand.protoCampMemory === undefined,
    stabilizationEvent !== undefined,
    {
      phase: stabilizedBand.provisionalSuccessor?.phase,
      currentCampTileId: stabilizedBand.currentCampTileId,
      formationStatus: stabilizedBand.lineageReadability?.formationStatus,
      deferredFields: {
        viability: stabilizedBand.viability === undefined ? "absent" : "present",
        residentialAnchor: stabilizedBand.residentialAnchor === undefined ? "absent" : "present",
        protoCampMemory: stabilizedBand.protoCampMemory === undefined ? "absent" : "present",
      },
    },
  );

  const parentEvent = stabilizedParent.successorStabilizationEvents?.find(
    (event) => String(event.id) === String(stabilizationEvent?.id),
  );
  record(
    "S8_parent_and_successor_history_agree_without_rewriting_departure",
    "parent and successor retain the identical completion object, which points to the earlier departure record; founding time/location are stabilization facts and origin remains a departure fact",
    stabilizationEvent !== undefined &&
      digest(stabilizationEvent) === digest(parentEvent) &&
      stabilizationEvent.departureRecordId === departureRecord?.id &&
      stabilizationEvent.stabilizedOnDay > departureRecord.departedOnDay &&
      stabilizedBand.deepHistory?.founding.foundedAt.day === stabilizationEvent.stabilizedOnDay &&
      String(stabilizedBand.deepHistory?.founding.foundingTileId) === String(stabilizationEvent.stabilizedTileId) &&
      String(stabilizedBand.lineage?.originTileId) === String(departureRecord.originTileId),
    stabilizationEvent !== undefined && departureRecord !== undefined,
    {
      departureDay: departureRecord?.departedOnDay,
      departureOrigin: departureRecord?.originTileId,
      stabilizationDay: stabilizationEvent?.stabilizedOnDay,
      stabilizationTile: stabilizationEvent?.stabilizedTileId,
      parentSuccessorEventByteEqual: digest(stabilizationEvent) === digest(parentEvent),
    },
  );

  const canonicalSuccessorEvent = modules.events.deriveCanonicalEvents(positive.world, stabilizedBand)
    .events.find((event) => event.type === "successor_stabilized");
  const canonicalParentEvent = modules.events.deriveCanonicalEvents(positive.world, stabilizedParent)
    .events.find((event) => event.type === "successor_stabilized");
  const life = modules.bandLife.deriveBandLifeSummary(stabilizedBand, positive.world.time.tick, "daily");
  const identity = modules.identity.deriveBandIdentityProfile(positive.world, stabilizedBand);
  const chronicle = modules.chronicle.deriveBandChronicle(positive.world, stabilizedBand);
  record(
    "S9_established_readers_show_truthful_completed_identity",
    "lineage, event, life, identity and chronicle readers distinguish a completed daughter from a provisional separation, while the parent's objective record creates no invented event/contact channel",
    canonicalSuccessorEvent?.livedStatus === "personally_lived" &&
      canonicalParentEvent === undefined &&
      parentEvent !== undefined &&
      life.chips.some((chip) => chip.label === "Established daughter band") &&
      identity.summaryTitle.toLowerCase().includes("daughter") &&
      chronicle.majorArcs.some((arc) => arc.kind === "lineage") &&
      stabilizedBand.lineageReadability?.formationStatus === "established_daughter",
    canonicalSuccessorEvent !== undefined,
    {
      successorEvent: canonicalSuccessorEvent,
      parentCanonicalEventAbsent: canonicalParentEvent === undefined,
      parentObjectiveHistoryPresent: parentEvent !== undefined,
      lifeChips: life.chips,
      identityTitle: identity.summaryTitle,
      chronicleArcKinds: chronicle.majorArcs.map((arc) => arc.kind),
    },
  );

  const actionIds = modules.registry.DEFAULT_DAILY_ACTIONS.map((action) => action.id);
  const stabilizationAction = modules.registry.DEFAULT_DAILY_ACTIONS.find(
    (action) => action.id === "successor_stabilization",
  );
  record(
    "S10_daily_order_prevents_same_day_graduation_bonuses",
    "recognition runs after subsistence, return and descriptive establishment, before only the deadline, and skips season boundaries; ordinary activity therefore starts no earlier than a later cycle",
    actionIds.indexOf("provisional_subsistence") < actionIds.indexOf("successor_stabilization") &&
      actionIds.indexOf("provisional_return_decision") < actionIds.indexOf("successor_stabilization") &&
      actionIds.indexOf("provisional_establishment") < actionIds.indexOf("successor_stabilization") &&
      actionIds.indexOf("successor_stabilization") < actionIds.indexOf("provisional_lifecycle_deadline") &&
      stabilizationAction?.firesOnDayOfSeason(0) === false &&
      (stabilizedBand.recentIntraSeasonTrips?.length ?? 0) === 0 &&
      modules.lifecycle.isFissionEligibleParent(stabilizedBand) === true,
    stabilizationAction !== undefined,
    { actionIds, stabilizationDayOfSeason: positive.world.time.dayOfSeason, sameDayTrips: stabilizedBand.recentIntraSeasonTrips?.length ?? 0 },
  );

  const viabilityAfterOwnWriter = modules.viability.updateBandViabilityStates(positive.world).bands[successorId];
  const protoCampAfterOwnWriter = modules.protoCamps.applyProtoCampContext(positive.world).bands[successorId];
  record(
    "S11_deferred_ordinary_state_has_real_next_writers",
    "fields not fabricated at release are accepted by their existing ordinary writers, which may judge the small band harshly and do not reinterpret absence as comfort",
    viabilityAfterOwnWriter.viability !== undefined &&
      protoCampAfterOwnWriter.protoCampMemory !== undefined &&
      String(protoCampAfterOwnWriter.position) === String(stabilizedBand.position) &&
      protoCampAfterOwnWriter.protoCampMemory.currentPlace?.campLikeState === "none",
    modules.lifecycle.isEstablishedBand(stabilizedBand),
    {
      viabilityVerdict: viabilityAfterOwnWriter.viability,
      protoCampState: protoCampAfterOwnWriter.protoCampMemory?.currentPlace?.campLikeState,
    },
  );

  const againDeparture = makeCanonicalStabilizationDeparture(modules, warm);
  const againPositive = runRegisteredPositiveStabilization(modules, againDeparture);
  const selectedPositiveState = (run) => ({
    day: run.day,
    trace: run.trace,
    band: {
      position: run.band.position,
      demography: run.band.demography,
      provisionalSuccessor: run.band.provisionalSuccessor,
      lineage: run.band.lineage,
      deepHistory: run.band.deepHistory,
      successorDepartureRecords: run.band.successorDepartureRecords,
      successorStabilizationEvents: run.band.successorStabilizationEvents,
      currentCampTileId: run.band.currentCampTileId,
      lineageReadability: run.band.lineageReadability,
    },
  });
  record(
    "S12_registered_positive_path_is_deterministic_and_bounded",
    "two identical controlled departures produce byte-identical stabilization state, and every retained history obeys its production cap",
    digest(selectedPositiveState(positive)) === digest(selectedPositiveState(againPositive)) &&
      stabilizedBand.provisionalSuccessor.history.length <= modules.kernel.LIFECYCLE_HISTORY_CAP &&
      (stabilizedBand.provisionalSuccessor.operationHistory?.recentAssessmentWindows.length ?? 0) <=
        modules.subsistence.RECENT_ASSESSMENT_WINDOW_CAP &&
      (stabilizedBand.successorDepartureRecords?.length ?? 0) <= 12 &&
      (stabilizedBand.successorStabilizationEvents?.length ?? 0) <= 12,
    positive.trace.length > 1,
    {
      byteIdentical: digest(selectedPositiveState(positive)) === digest(selectedPositiveState(againPositive)),
      lifecycleHistory: stabilizedBand.provisionalSuccessor.history.length,
      operationWindows: stabilizedBand.provisionalSuccessor.operationHistory?.recentAssessmentWindows.length,
      departureRecords: stabilizedBand.successorDepartureRecords?.length,
      stabilizationEvents: stabilizedBand.successorStabilizationEvents?.length,
    },
  );

  // ── NEGATIVE BARRIERS ────────────────────────────────────────────────────────────────────────
  const newlyDepartedEstablishing = replaceBand(departure.departure.world, successorId, (band) => ({
    ...band,
    provisionalSuccessor: {
      ...band.provisionalSuccessor,
      phase: "establishing",
      phaseEnteredDay: departure.departureDay,
      history: ["travelling"],
    },
  }));
  const noLivedOperation = modules.stabilization.advanceSuccessorStabilization(
    newlyDepartedEstablishing,
    departure.departureDay,
  );
  record(
    "N1_newly_departed_successor_cannot_stabilize_immediately",
    "an exact real departure with bodies and valid provenance but no completed operation window is refused",
    noLivedOperation.stabilized.length === 0 &&
      noLivedOperation.refusals[0]?.refusal === "no_completed_operation_window" &&
      completionAbsent(noLivedOperation.world.bands[successorId]),
    departureRecord !== undefined,
    {
      refusal: noLivedOperation.refusals[0],
      stabilized: noLivedOperation.stabilized,
      successorPhase: noLivedOperation.world.bands[successorId].provisionalSuccessor?.phase,
      completionAbsent: completionAbsent(noLivedOperation.world.bands[successorId]),
    },
  );

  const fullProof = {
    independentOperationProven: true,
    consumedDepartureProvenanceProven: true,
    neverEnteredReturnPathProven: true,
    quarantineReleaseInitialized: true,
  };
  const elapsedKernelAttempt = modules.kernel.requestTransition({
    current: { phase: "establishing", phaseEnteredDay: 0, history: ["travelling"] },
    to: "stabilized",
    today: modules.kernel.ESTABLISHMENT_MAX_DAYS + 1,
    cause: "elapsed_time",
    stabilizationProof: fullProof,
  });
  const oldUnmeasured = replaceBand(newlyDepartedEstablishing, successorId, (band) => ({
    ...band,
    provisionalSuccessor: {
      ...band.provisionalSuccessor,
      phaseEnteredDay: departure.departureDay - modules.kernel.ESTABLISHMENT_MAX_DAYS,
    },
  }));
  const timeoutResult = modules.lifecycleResolver.resolveProvisionalLifecycles(
    oldUnmeasured,
    departure.departureDay,
  );
  record(
    "N2_time_alone_fails_never_stabilizes",
    "even a complete claimed proof cannot enter a physical-event phase by elapsed time, and an expired unmeasured establishment trial becomes failed_early",
    elapsedKernelAttempt.ok === false &&
      elapsedKernelAttempt.rejection === "terminal_outcome_requires_a_physical_event" &&
      timeoutResult.world.bands[successorId].provisionalSuccessor?.phase === "failed_early",
    timeoutResult.resolutions.length === 1,
    { elapsedKernelAttempt, timeoutResolution: timeoutResult.resolutions },
  );

  const richTile = modules.plantStock.resolvePlantFoodHarvest(
    departure.departure.world,
    departure.target,
    departure.departure.world.time,
    0.2,
    true,
  );
  const richLooking = replaceBand(newlyDepartedEstablishing, successorId, (band) => ({
    ...band,
    position: departure.target.id,
  }));
  const richnessShortcut = modules.stabilization.advanceSuccessorStabilization(
    richLooking,
    departure.departureDay,
  );
  record(
    "N3_hidden_richness_cannot_replace_lived_operation",
    "placing the successor on a tile with physically available edible plants grants no success before it actually gathers, depletes and closes a demand window",
    richTile.harvestedAmount > 0 &&
      richnessShortcut.stabilized.length === 0 &&
      richnessShortcut.refusals[0]?.refusal === "no_completed_operation_window",
    richTile.sourceFound === true,
    { physicalAvailability: richTile.physicalAvailability, harvestedByProbeOnly: richTile.harvestedAmount, result: richnessShortcut.refusals },
  );

  const populousOnly = replaceBand(richLooking, successorId, (band) => ({
    ...band,
    size: 30,
    demography: { ...band.demography, population: 30, workingAdults: 18, dependents: 8, elders: 4 },
  }));
  const populousShortcut = modules.stabilization.advanceSuccessorStabilization(
    populousOnly,
    departure.departureDay,
  );
  record(
    "N4_population_alone_cannot_stabilize",
    "many living and working bodies do not replace a completed physical-operation record",
    populousShortcut.stabilized.length === 0 &&
      populousShortcut.refusals[0]?.refusal === "no_completed_operation_window",
    populousOnly.bands[successorId].demography.population === 30,
    populousShortcut.refusals,
  );

  const commitmentProven = modules.stabilization.validateConsumedDepartureProvenance(
    richLooking,
    richLooking.bands[successorId],
  );
  record(
    "N5_historical_commitment_and_consumed_permit_are_not_success",
    "the direct commitment/departure join can be fully valid while stabilization still refuses because nobody has yet operated independently",
    commitmentProven.ok === true &&
      richnessShortcut.stabilized.length === 0 &&
      richnessShortcut.refusals[0]?.refusal === "no_completed_operation_window",
    commitmentProven.ok === true,
    {
      commitmentProven: commitmentProven.ok,
      refusal: richnessShortcut.refusals[0],
    },
  );

  const returnTriggerWorld = replaceBand(qualifying.world, successorId, (band) => ({
    ...band,
    demography: { ...band.demography, workingAdults: 1 },
  }));
  const genuineReturn = modules.returnDecision.advanceProvisionalReturnDecisions(
    returnTriggerWorld,
    qualifying.day,
  );
  const returnedCourse = genuineReturn.world.bands[successorId].provisionalSuccessor?.separationCourse;
  const overflowedHistory = Array.from(
    { length: modules.kernel.LIFECYCLE_HISTORY_CAP },
    (_, index) => index % 2 === 0 ? "travelling" : "establishing",
  );
  const staleAfterReturn = replaceBand(qualifying.world, successorId, (band) => ({
    ...band,
    provisionalSuccessor: {
      ...band.provisionalSuccessor,
      phase: "establishing",
      history: overflowedHistory,
      separationCourse: returnedCourse,
    },
  }));
  const returnBarrier = modules.stabilization.advanceSuccessorStabilization(
    staleAfterReturn,
    qualifying.day,
  );
  record(
    "N6_return_path_survives_bounded_history_overflow",
    "a genuine return transition sets one absorbing course record; even when the capped phase ring no longer contains returning and old positive operation evidence is restored, stabilization is refused",
    genuineReturn.decisions.length === 1 &&
      returnedCourse?.status === "return_path_entered" &&
      overflowedHistory.includes("returning") === false &&
      overflowedHistory.length === modules.kernel.LIFECYCLE_HISTORY_CAP &&
      returnBarrier.stabilized.length === 0 &&
      returnBarrier.refusals[0]?.refusal === "never_returned_proof_not_satisfied",
    qualifying.evidence.allRequirementsMet === true,
    {
      returnDecision: genuineReturn.decisions[0],
      separationCourse: returnedCourse,
      overflowedHistory,
      refusal: returnBarrier.refusals[0],
    },
  );

  const fabricatedProvenanceWorld = replaceBand(qualifying.world, successorId, (band) => ({
    ...band,
    provisionalSuccessor: {
      ...band.provisionalSuccessor,
      departureProvenance: {
        ...band.provisionalSuccessor.departureProvenance,
        commitmentId: `${band.provisionalSuccessor.departureProvenance.commitmentId}:fabricated`,
      },
    },
  }));
  const fabricatedProvenance = modules.stabilization.advanceSuccessorStabilization(
    fabricatedProvenanceWorld,
    qualifying.day,
  );
  record(
    "N7_fabricated_or_mismatched_provenance_is_refused",
    "an otherwise qualifying physical record cannot stabilize when its claimed commitment does not match the immutable two-sided departure record",
    fabricatedProvenance.stabilized.length === 0 &&
      fabricatedProvenance.refusals[0]?.refusal === "consumed_departure_provenance_not_proven",
    qualifying.evidence.allRequirementsMet === true,
    fabricatedProvenance.refusals[0],
  );

  const zeroPopulationWorld = replaceBand(qualifying.world, successorId, (band) => ({
    ...band,
    size: 0,
    demography: { ...band.demography, population: 0, workingAdults: 0, dependents: 0, elders: 0 },
  }));
  const zeroPopulation = modules.stabilization.advanceSuccessorStabilization(
    zeroPopulationWorld,
    qualifying.day,
  );
  record(
    "N8_zero_population_cannot_stabilize",
    "old physical evidence cannot turn a zero-body provisional entity into an established band",
    zeroPopulation.stabilized.length === 0 &&
      zeroPopulation.refusals[0]?.refusal === "zero_physical_population",
    zeroPopulationWorld.bands[successorId].demography.population === 0,
    zeroPopulation.refusals[0],
  );

  const prematureRelease = modules.stabilization.applySuccessorQuarantineRelease({
    world: qualifying.world,
    successor: qualifyingBand,
    transitionState: {
      phase: "establishing",
      phaseEnteredDay: qualifyingBand.provisionalSuccessor.phaseEnteredDay,
      history: qualifyingBand.provisionalSuccessor.history,
    },
    lineage: stabilizedBand.lineage,
    event: stabilizationEvent,
    deepHistory: stabilizedBand.deepHistory,
    operationHistory: stabilizedBand.provisionalSuccessor.operationHistory,
  });
  record(
    "N9_no_completion_history_before_successful_transition",
    "even qualifying evidence has no lineage/founding/completion record before transition, and the sole release writer refuses an establishing state",
    completionAbsent(qualifyingBand) &&
      prematureRelease.ok === false &&
      prematureRelease.refusal === "historical_completion_before_stabilization",
    qualifying.evidence.allRequirementsMet === true,
    { completionAbsentBefore: completionAbsent(qualifyingBand), prematureRelease },
  );

  const unresolvedWorld = replaceBand(qualifying.world, successorId, (band) => ({
    ...band,
    provisionalSuccessor: {
      ...band.provisionalSuccessor,
      phase: "unresolved_after_failed_return",
      separationCourse: returnedCourse,
    },
  }));
  const unresolvedAttempt = modules.stabilization.advanceSuccessorStabilization(
    unresolvedWorld,
    qualifying.day + 1_000,
  );
  record(
    "N10_unresolved_failed_return_is_not_a_stabilization_escape",
    "the explicit living debt remains unchanged and cannot consume old establishment evidence as an escape hatch",
    unresolvedAttempt.stabilized.length === 0 &&
      unresolvedAttempt.world.bands[successorId].provisionalSuccessor?.phase === "unresolved_after_failed_return" &&
      completionAbsent(unresolvedAttempt.world.bands[successorId]),
    returnedCourse?.status === "return_path_entered",
    { phase: unresolvedAttempt.world.bands[successorId].provisionalSuccessor?.phase, stabilized: unresolvedAttempt.stabilized },
  );

  const dirtyReleaseWorld = replaceBand(qualifying.world, successorId, (band) => ({
    ...band,
    lineage: stabilizedBand.lineage,
  }));
  const dirtyRelease = modules.stabilization.advanceSuccessorStabilization(
    dirtyReleaseWorld,
    qualifying.day,
  );
  record(
    "N11_release_refuses_preexisting_completed_identity",
    "the adapter will not overwrite or merge a half-created lineage/history state",
    dirtyRelease.stabilized.length === 0 &&
      dirtyRelease.refusals[0]?.refusal === "quarantine_release_preconditions_not_met",
    qualifying.evidence.allRequirementsMet === true,
    dirtyRelease.refusals[0],
  );

  // ── LONGER-HORIZON DIVERGENT OUTCOMES ────────────────────────────────────────────────────────
  const successHorizonWorld = modules.advance.advanceWorldByDays(positive.world, 180);
  const successHorizonBand = successHorizonWorld.bands[successorId];
  record(
    "L1_success_does_not_claim_permanent_safety",
    "the positive arm really reaches stabilized, after which ordinary viability may retain or absorb the small band without rewriting its successful provisional outcome",
    successHorizonBand?.provisionalSuccessor?.phase === "stabilized" &&
      successHorizonBand.successorStabilizationEvents?.length === 1 &&
      modules.lifecycle.isProvisionalSuccessor(successHorizonBand) === false,
    stabilizedBand.provisionalSuccessor?.phase === "stabilized",
    {
      stabilizationDay: positive.day,
      horizonDay: successHorizonWorld.time.day,
      population: successHorizonBand?.demography.population,
      viability: successHorizonBand?.viability,
      status: successHorizonBand?.status,
    },
  );

  const returnParent = warm.bands["band:varied-river-mid"];
  const returnHome = modules.generate.getTile(warm, returnParent.position);
  const distanceFromReturnHome = (tile) =>
    Math.abs(tile.coord.x - returnHome.coord.x) + Math.abs(tile.coord.y - returnHome.coord.y);
  const returnTarget = Object.keys(returnParent.knowledge.observedTiles)
    .map((id) => modules.generate.getTile(warm, id))
    .filter((tile) =>
      tile !== undefined &&
      modules.passability.isBandPassableDestination(tile) &&
      distanceFromReturnHome(tile) >= 4)
    .sort((left, right) =>
      distanceFromReturnHome(left) - distanceFromReturnHome(right) ||
      String(left.id).localeCompare(String(right.id)))[0];
  if (returnTarget === undefined) throw new Error("no return-arm target");
  const returnDeparture = prepareAndDepart({
    prep: modules.preparation,
    seam: modules.seam,
    world: warm,
    parentId: returnParent.id,
    today: Number(warm.time.day ?? 0),
    lineageId: "LIN-SUCCESSOR-STABILIZATION-RETURN",
    requestedFounders: Math.max(2, Math.floor(returnParent.demography.population * 0.35)),
    targetTileId: String(returnTarget.id),
    successorBandId: "band:successor-stabilization-return",
  }).departure;
  if (returnDeparture.ok !== true) throw new Error(`return-arm departure refused: ${returnDeparture.refusal}`);
  let returnWorld = returnDeparture.world;
  const returnTrace = [];
  let returnLastPhase;
  for (let offset = 1; offset <= 500; offset += 1) {
    returnWorld = modules.advance.advanceWorldByDays(returnWorld, 1);
    const band = returnWorld.bands["band:successor-stabilization-return"];
    const phase = band?.provisionalSuccessor?.phase ?? "absent";
    if (phase !== returnLastPhase) {
      returnTrace.push({ offset, day: returnWorld.time.day, phase, position: band?.position, population: band?.demography.population });
      returnLastPhase = phase;
    }
    if (["reintegrated", "stabilized", "provisional_extinguished", "unresolved_after_failed_return"].includes(phase)) break;
  }
  const returnedBand = returnWorld.bands["band:successor-stabilization-return"];
  record(
    "L2_failure_path_still_gives_up_and_physically_reintegrates",
    "a different real successor reaches establishing, chooses returning from lived conditions and physically rejoins without being swallowed by the success authority",
    returnTrace.some((row) => row.phase === "establishing") &&
      returnTrace.some((row) => row.phase === "returning") &&
      returnTrace.some((row) => row.phase === "reintegrated") &&
      returnTrace.every((row) => row.phase !== "stabilized") &&
      returnedBand.demography.population === 0,
    returnTrace.length >= 3,
    { target: returnTarget.id, trace: returnTrace },
  );

  let failureWorld = departure.departure.world;
  let firstEstablishingDay;
  for (let offset = 1; offset <= 40; offset += 1) {
    const day = departure.departureDay + offset;
    failureWorld = advancePhysicalSuccessorDayWithoutStabilization(modules, failureWorld, day);
    if (failureWorld.bands[successorId].provisionalSuccessor?.phase === "establishing") {
      firstEstablishingDay = day;
      break;
    }
  }
  if (firstEstablishingDay === undefined) throw new Error("failed-early arm never reached establishing");
  const expiredEstablishment = replaceBand(failureWorld, successorId, (band) => ({
    ...band,
    provisionalSuccessor: {
      ...band.provisionalSuccessor,
      phaseEnteredDay: firstEstablishingDay - modules.kernel.ESTABLISHMENT_MAX_DAYS,
    },
  }));
  const earlyFailure = modules.lifecycleResolver.resolveProvisionalLifecycles(
    expiredEstablishment,
    firstEstablishingDay,
  );
  record(
    "L3_expired_trial_still_fails_early",
    "a controlled successor that physically arrived but did not receive a positive completion before the establishment bound follows the existing failed_early path",
    earlyFailure.world.bands[successorId].provisionalSuccessor?.phase === "failed_early" &&
      earlyFailure.resolutions.some((resolution) => resolution.toPhase === "failed_early") &&
      completionAbsent(earlyFailure.world.bands[successorId]),
    firstEstablishingDay !== undefined,
    { firstEstablishingDay, resolutions: earlyFailure.resolutions },
  );

  const zeroBodyDeparture = replaceBand(departure.departure.world, successorId, (band) => ({
    ...band,
    size: 0,
    demography: { ...band.demography, population: 0, workingAdults: 0, dependents: 0, elders: 0 },
  }));
  const extinguished = modules.lifecycleResolver.resolveProvisionalLifecycles(
    zeroBodyDeparture,
    departure.departureDay + 1,
  );
  record(
    "L4_zero_body_control_uses_provisional_extinction_not_success",
    "when the existing resolver is presented with the truthful physical fact of zero remaining bodies, it records provisional_extinguished and never stabilization",
    extinguished.world.bands[successorId].provisionalSuccessor?.phase === "provisional_extinguished" &&
      extinguished.resolutions.some((resolution) => resolution.toPhase === "provisional_extinguished") &&
      completionAbsent(extinguished.world.bands[successorId]),
    zeroBodyDeparture.bands[successorId].demography.population === 0,
    { resolutions: extinguished.resolutions },
  );

  const counts = fixtures.reduce((acc, fixture) => {
    acc[fixture.verdict] = (acc[fixture.verdict] ?? 0) + 1;
    return acc;
  }, { PASS: 0, FAIL: 0, VACUOUS: 0 });
  output = {
    generatedAt: new Date().toISOString(),
    checkpoint: "ROADMAP ITEM 4 — positive successor stabilization authority",
    controlledSeamOnly: true,
    fixtures,
    summary: {
      total: fixtures.length,
      passing: counts.PASS,
      failing: counts.FAIL,
      vacuous: counts.VACUOUS,
    },
  };
} finally {
  await server.close();
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(output, null, 2)}\n`);
for (const fixture of output.fixtures) {
  console.log(`${fixture.verdict.padEnd(7)} ${fixture.id}  ${fixture.claim}`);
  if (fixture.verdict !== "PASS") console.log(`        ${JSON.stringify(fixture).slice(0, 1_200)}`);
}
console.log(`\nsummary: ${JSON.stringify(output.summary)}`);
console.log(`written: ${OUT}`);
if (output.summary.failing > 0 || output.summary.vacuous > 0) process.exitCode = 1;
