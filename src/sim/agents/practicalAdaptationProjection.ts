import type { WorldState } from "../world/types";
import { derivePracticalVariantExecutionClass } from "./practicalResponses";
import type {
  CanonicalCandidateProjection,
  ProblemFrame,
  ProblemFrameFamily,
  ProblemPracticeEvidenceRef,
  ProblemPracticeProfile,
  PracticeExperimentCandidate,
  PracticeExperimentFamily,
  PracticeExperimentStatus,
  PracticeFeedbackType,
  PracticeRiskLevel,
} from "./problemPractice";
import type {
  PracticeFeedbackBlocker,
  PracticeFeedbackEvidenceRef,
  PracticeFeedbackLivedBasis,
  PracticeFeedbackQuality,
  PracticeFeedbackReadinessFamily,
  PracticeFeedbackReadinessFeedbackType,
  PracticeFeedbackReadinessItem,
  PracticeFeedbackReadinessProfile,
  PracticeFeedbackReadinessStatus,
  PracticeFeedbackRisk,
} from "./practiceFeedbackReadiness";
import type {
  Band,
  PracticalAdaptationState,
  PracticalExperiment,
  PracticalIdeaCandidate,
  PracticalProblemFrame,
  PracticalResponseFamily,
  PracticalResponseState,
} from "./types";

const PROBLEM_FRAME_CAP = 6;
const PRACTICE_CANDIDATE_CAP = 9;
const READINESS_ITEM_CAP = 8;
const EVIDENCE_PER_FRAME_CAP = 3;
const EVIDENCE_PER_CANDIDATE_CAP = 3;
const EVIDENCE_PER_ITEM_CAP = 4;

const PROBLEM_FAMILIES = [
  "food_return_subsistence", "carrying_logistical_burden", "crossing_blocked_path",
  "route_new_country_uncertainty", "camp_setup_care_burden", "water_refuge_pressure",
  "social_contact_uncertainty",
] as const satisfies readonly ProblemFrameFamily[];

const CANDIDATE_FAMILIES = [
  "carrying_container_cordage", "food_processing_trial", "crossing_route_trial",
  "camp_shelter_care_trial", "fire_hearth_fuel_trial", "water_edge_capture_trial",
  "tool_digging_cutting_trial",
] as const satisfies readonly PracticeExperimentFamily[];

const READINESS_FAMILIES = [
  "carrying_fiber_handling", "food_work_processing", "route_crossing", "camp_setup_care",
  "fire_hearth_fuel", "water_edge_capture", "tool_digging_cutting",
] as const satisfies readonly PracticeFeedbackReadinessFamily[];

const PROBLEM_SOURCE_SYSTEMS = [
  "canonical_event", "knowledge_ecology", "activity_party", "activity_summary", "place_memory",
  "route_memory", "crossing_memory", "residential_move", "demography", "seasonal_support",
  "body_camp_logistics", "foraging_adaptation", "contact_memory", "reported_knowledge",
  "band_identity", "material_affordance",
] as const;

const READINESS_SOURCE_SYSTEMS = [
  "problem_practice", "material_affordance", "repetition_familiarity", "knowledge_ecology",
  "canonical_event", "activity_party", "camp_foothold", "foothold_storage", "foothold_fire",
  "foothold_care", "place_memory", "route_memory", "crossing_memory", "demography", "band_identity",
] as const;

const PRACTICE_STATUSES = [
  "plausible_untried", "implicit_repetition", "low_feedback_repetition", "blocked_by_missing_material",
  "blocked_by_labor", "inherited_not_tested_here", "currently_unsupported", "dead_end_risk",
  "false_confidence_risk", "local_only", "uncertain",
] as const satisfies readonly PracticeExperimentStatus[];

const FEEDBACK_TYPES = [
  "clear_success", "clear_failure", "mixed_feedback", "low_feedback", "delayed_feedback",
  "dangerous_feedback", "local_only_success", "inherited_no_local_feedback", "contradicted_by_recent_events",
] as const satisfies readonly PracticeFeedbackType[];

const READINESS_FEEDBACK_TYPES = [
  "clear_success", "clear_failure", "mixed_feedback", "low_feedback", "delayed_feedback",
  "dangerous_feedback", "local_only_success", "inherited_no_local_feedback",
  "contradicted_by_recent_events", "blocked_no_attempt", "familiarity_only",
] as const satisfies readonly PracticeFeedbackReadinessFeedbackType[];

const FEEDBACK_QUALITIES = [
  "clear", "usable", "mixed", "weak", "delayed", "dangerous", "inherited_only", "blocked", "contradicted",
] as const satisfies readonly PracticeFeedbackQuality[];

const READINESS_STATUSES = [
  "not_started", "familiarity_only", "repeated_low_feedback", "repeated_mixed_feedback",
  "learning_ready_later", "blocked_by_material", "blocked_by_labor", "inherited_not_tested_here",
  "dead_end_risk", "false_confidence_risk", "local_only", "contradicted",
] as const satisfies readonly PracticeFeedbackReadinessStatus[];

const BLOCKERS = [
  "missing_material", "labor_burden", "place_not_stable", "season_or_weather", "feedback_too_weak",
  "inherited_not_local", "unsupported_ecology", "dangerous_or_contradicted",
] as const satisfies readonly PracticeFeedbackBlocker[];

const RISKS = [
  "dead_end", "false_confidence", "local_only", "low_feedback", "dangerous_feedback", "delayed_feedback",
] as const satisfies readonly PracticeFeedbackRisk[];

function countByKey<K extends string>(keys: readonly K[], values: readonly K[]): Readonly<Record<K, number>> {
  const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
  for (const value of values) counts[value] += 1;
  return counts;
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function problemFamily(family: PracticalProblemFrame["family"]): ProblemFrameFamily {
  switch (family) {
    case "carrying_burden": return "carrying_logistical_burden";
    case "water_route_shortage": return "route_new_country_uncertainty";
    case "camp_water_shortage":
    case "vessel_water_loss": return "water_refuge_pressure";
    case "camp_exposure":
    case "sickness_injury": return "camp_setup_care_burden";
    case "hunting_danger": return "food_return_subsistence";
    case "journey_misjudgment": return "route_new_country_uncertainty";
    case "crossing_blocked": return "crossing_blocked_path";
  }
}

function candidateFamily(family: PracticalResponseFamily): PracticeExperimentFamily {
  switch (family) {
    case "carrying_load":
    case "water_storage":
    case "proto_measure": return "carrying_container_cordage";
    case "dry_route_water":
    case "engineering_structure": return "crossing_route_trial";
    case "hunting_distance": return "food_processing_trial";
    case "temporary_shelter":
    case "care_treatment": return "camp_shelter_care_trial";
    case "groundwater_seek": return "tool_digging_cutting_trial";
    case "animal_proximity": return "water_edge_capture_trial";
  }
}

function readinessFamily(family: PracticalResponseFamily): PracticeFeedbackReadinessFamily {
  switch (family) {
    case "carrying_load":
    case "water_storage":
    case "proto_measure": return "carrying_fiber_handling";
    case "dry_route_water":
    case "engineering_structure": return "route_crossing";
    case "hunting_distance": return "food_work_processing";
    case "temporary_shelter":
    case "care_treatment": return "camp_setup_care";
    case "groundwater_seek": return "tool_digging_cutting";
    case "animal_proximity": return "water_edge_capture";
  }
}

function livedBasis(problem: PracticalProblemFrame, state: PracticalAdaptationState): "lived" | "inherited_not_lived" {
  return problem.origin === "inherited" || state.fragments.every((fragment) => fragment.basis === "inherited")
    ? "inherited_not_lived"
    : "lived";
}

function candidateStatus(
  problem: PracticalProblemFrame,
  experiment: PracticalExperiment | undefined,
  canonical: CanonicalCandidateProjection,
  state: PracticalAdaptationState,
): PracticeExperimentStatus {
  if (livedBasis(problem, state) === "inherited_not_lived" && experiment === undefined) return "inherited_not_tested_here";
  if (canonical.executionTruth === "blocked_material_execution") return "blocked_by_missing_material";
  if (experiment?.status === "concluded_failure" || experiment?.status === "abandoned" || canonical.responseStatus === "abandoned") return "dead_end_risk";
  if (canonical.executionTruth === "practice_attempted") return "implicit_repetition";
  if (experiment !== undefined) return "plausible_untried";
  return "currently_unsupported";
}

function feedbackType(experiment: PracticalExperiment | undefined, canonical: CanonicalCandidateProjection, inherited: boolean): PracticeFeedbackType {
  if (inherited) return "inherited_no_local_feedback";
  if (experiment?.status === "concluded_success") return "clear_success";
  if (experiment?.status === "concluded_partial") return "mixed_feedback";
  if (experiment?.status === "concluded_failure" || experiment?.status === "abandoned") return "clear_failure";
  if (canonical.executionTruth === "practice_attempted") return "low_feedback";
  return "delayed_feedback";
}

interface CanonicalCandidateEntry {
  readonly problem: PracticalProblemFrame;
  readonly idea: PracticalIdeaCandidate;
  readonly experiment?: PracticalExperiment;
  readonly response?: PracticalResponseState;
  readonly canonical: CanonicalCandidateProjection;
  readonly inherited: boolean;
}

function entriesFor(state: PracticalAdaptationState, problems: readonly PracticalProblemFrame[]): readonly CanonicalCandidateEntry[] {
  const problemIds = new Set(problems.map((problem) => problem.id));
  return (state.ideas ?? [])
    .filter((idea) => problemIds.has(idea.problemId))
    .slice(0, PRACTICE_CANDIDATE_CAP)
    .map((idea) => {
      const problem = problems.find((item) => item.id === idea.problemId)!;
      const experiment = (state.experiments ?? []).find((item) => item.problemId === problem.id && item.ideaId === idea.id);
      const response = experiment === undefined ? undefined : state.responses.find((item) =>
        item.id === experiment.responseId && item.problemId === problem.id && item.ideaId === idea.id && item.experimentId === experiment.id);
      const efficacyRecordIds = response === undefined
        ? []
        : state.efficacyRecords.filter((record) => record.responseId === response.id).map((record) => record.id);
      const executionClass = derivePracticalVariantExecutionClass(idea.family, idea.variantKey);
      const matchingWaterWorks = response !== undefined && state.waterWorks?.responseId === response.id;
      const executionTruth = executionClass === "material_execution_required"
        ? "blocked_material_execution"
        : executionClass === "existing_physical_work" && matchingWaterWorks
          ? "existing_physical_work_executed"
          : experiment?.status.startsWith("concluded_") || experiment?.status === "abandoned"
            ? "concluded_from_canonical_history"
            : (experiment?.attemptSeasons ?? 0) > 0 || efficacyRecordIds.length > 0
              ? "practice_attempted"
              : experiment !== undefined
                ? "planned_unexecuted"
                : "idea_only";
      return {
        problem,
        idea,
        experiment,
        response,
        inherited: livedBasis(problem, state) === "inherited_not_lived",
        canonical: {
          ideaId: idea.id,
          ideaStatus: idea.status,
          ...(experiment === undefined ? {} : { experimentId: experiment.id, experimentStatus: experiment.status }),
          attemptSeasons: experiment?.attemptSeasons ?? 0,
          ...(response === undefined ? {} : { responseId: response.id, responseStatus: response.status }),
          efficacyRecordIds,
          executionTruth,
        },
      };
    });
}

function problemEvidence(problem: PracticalProblemFrame, basis: "lived" | "inherited_not_lived"): readonly ProblemPracticeEvidenceRef[] {
  return unique([problem.id, ...problem.evidenceRefs]).slice(0, EVIDENCE_PER_FRAME_CAP).map((sourceId) => ({
    kind: "event",
    sourceSystem: "canonical_event",
    label: sourceId === problem.id ? problem.publicLabel : `Canonical evidence ${sourceId}`,
    sourceId,
    confidence: problem.confidence,
    livedBasis: basis,
    reasonIds: [],
  }));
}

function candidateEvidence(entry: CanonicalCandidateEntry, state: PracticalAdaptationState): readonly ProblemPracticeEvidenceRef[] {
  const ids = [entry.idea.id, entry.experiment?.id, ...entry.idea.basisFragmentIds]
    .filter((id): id is string => id !== undefined)
    .filter((id) => id === entry.idea.id || id === entry.experiment?.id || state.fragments.some((fragment) => fragment.id === id));
  return unique(ids).slice(0, EVIDENCE_PER_CANDIDATE_CAP).map((sourceId) => ({
    kind: "knowledge",
    sourceSystem: "knowledge_ecology",
    label: sourceId === entry.idea.id ? entry.idea.publicLabel : `Canonical basis ${sourceId}`,
    sourceId,
    confidence: entry.idea.basisScore,
    livedBasis: entry.inherited ? "inherited_not_lived" : "lived",
    reasonIds: [],
  }));
}

export function deriveCanonicalProblemPracticeProfile(world: WorldState, band: Band): ProblemPracticeProfile {
  const state = band.practicalAdaptation;
  if (state === undefined) throw new Error("canonical practical projection requires practicalAdaptation");
  const problems = (state.problems ?? []).slice(0, PROBLEM_FRAME_CAP);
  const entries = entriesFor(state, problems);
  const problemFrames: readonly ProblemFrame[] = problems.map((problem) => {
    const basis = livedBasis(problem, state);
    const hooks = entries.filter((entry) => entry.problem.id === problem.id).map((entry) => candidateFamily(entry.idea.family));
    return {
      id: problem.id,
      family: problemFamily(problem.family),
      publicLabel: basis === "inherited_not_lived" ? `${problem.publicLabel} (inherited; not tested here)` : problem.publicLabel,
      meaning: problem.interpretation,
      objectiveBasis: problem.evidenceRefs.slice(0, EVIDENCE_PER_FRAME_CAP),
      perceivedCause: problem.interpretation,
      confidence: problem.confidence,
      uncertainty: problem.competingInterpretation ?? "",
      possibleMisread: problem.misread ? "the stored framing may be mistaken" : "",
      evidence: problemEvidence(problem, basis),
      sourceSystems: ["canonical_event"],
      livedBasis: basis,
      livedEvidenceCount: basis === "lived" ? 1 : 0,
      inheritedEvidenceCount: basis === "inherited_not_lived" ? 1 : 0,
      relatedAffordanceIds: [],
      relatedKnowledgeIds: [],
      relatedEventIds: unique([problem.id, ...problem.evidenceRefs]).slice(0, EVIDENCE_PER_FRAME_CAP),
      relatedActivityIds: [],
      relatedRepetitionIds: [],
      possibleExperimentHooks: [...new Set(hooks)].slice(0, 4),
      noDecisionInfluence: true,
      canonical: { problemId: problem.id, problemStatus: problem.status, problemOrigin: problem.origin },
    };
  });
  const practiceCandidates: readonly PracticeExperimentCandidate[] = entries.map((entry) => {
    const status = candidateStatus(entry.problem, entry.experiment, entry.canonical, state);
    const feedback = feedbackType(entry.experiment, entry.canonical, entry.inherited);
    const evidence = candidateEvidence(entry, state);
    return {
      id: entry.idea.id,
      family: candidateFamily(entry.idea.family),
      publicLabel: entry.inherited ? `${entry.idea.publicLabel} (inherited; not tested here)` : entry.idea.publicLabel,
      meaning: entry.idea.mechanismBelief,
      problemFrameId: entry.problem.id,
      problemFamily: problemFamily(entry.problem.family),
      relatedAffordanceIds: [],
      relatedKnowledgeIds: entry.idea.basisFragmentIds.slice(0, 4),
      relatedEventIds: [entry.problem.id],
      relatedActivityIds: [],
      relatedRepetitionIds: [],
      materialBasis: entry.idea.basisFragmentIds.slice(0, 4),
      knowledgeBasis: entry.idea.basisFragmentIds.slice(0, 4),
      activityRepetitionBasis: [],
      expectedFeedbackType: feedback,
      likelyCostRisk: entry.experiment?.opportunityCost ?? entry.idea.statusReason,
      laborBurden: entry.experiment === undefined ? "no canonical experiment plan is recorded" : "planned requirements are not execution proof",
      confidence: entry.idea.basisScore,
      uncertainty: entry.experiment?.observedOutcome ?? "",
      deadEndRisk: status === "dead_end_risk" ? "present" : "low",
      falseConfidenceRisk: entry.canonical.executionTruth === "blocked_material_execution" ? "present" : "low",
      lowFeedbackRisk: feedback === "low_feedback" ? "present" : "low",
      localOnlyRisk: "low",
      status,
      evidence,
      noSkillUnlocked: true,
      noAutomaticImprovement: true,
      futureHook: "practice_learning_candidate",
      canonical: entry.canonical,
    };
  });
  const allEvidence = [...problemFrames.flatMap((frame) => frame.evidence), ...practiceCandidates.flatMap((candidate) => candidate.evidence)];
  const inheritedBasisCount = allEvidence.filter((evidence) => evidence.livedBasis === "inherited_not_lived").length;
  const payload = { bandId: band.id, generatedAtTick: Number(world.time.tick), problemFrames, practiceCandidates };
  return {
    bandId: band.id,
    generatedAtTick: Number(world.time.tick),
    generatedAtYear: world.time.year,
    projectionMode: "selected_band_projection",
    authority: "canonical_practical_adaptation",
    overviewTitle: problemFrames.length === 0 ? "No canonical practical problems recorded" : "Canonical practical problems and plans",
    overviewLines: practiceCandidates.length === 0
      ? ["Canonical inherited knowledge is not a local trial."]
      : ["Canonical ideas and experiment records only; planned requirements are not execution proof."],
    problemFrames,
    practiceCandidates,
    problemFamilyCounts: countByKey(PROBLEM_FAMILIES, problemFrames.map((frame) => frame.family)),
    candidateFamilyCounts: countByKey(CANDIDATE_FAMILIES, practiceCandidates.map((candidate) => candidate.family)),
    perceivedCauseCounts: countStrings(problemFrames.map((frame) => frame.perceivedCause)),
    sourceSystemCounts: countByKey(PROBLEM_SOURCE_SYSTEMS, allEvidence.map(() => "canonical_event")),
    feedbackTypeCounts: countByKey(FEEDBACK_TYPES, practiceCandidates.map((candidate) => candidate.expectedFeedbackType)),
    statusCounts: countByKey(PRACTICE_STATUSES, practiceCandidates.map((candidate) => candidate.status)),
    uncertaintyMisreadCount: problemFrames.filter((frame) => frame.uncertainty.length > 0 || frame.possibleMisread.length > 0).length,
    affordanceRefCount: 0,
    knowledgeRefCount: unique(practiceCandidates.flatMap((candidate) => candidate.relatedKnowledgeIds)).length,
    eventRefCount: unique(problemFrames.flatMap((frame) => frame.relatedEventIds)).length,
    activityRefCount: 0,
    repetitionRefCount: 0,
    inheritedBasisCount,
    livedBasisCount: allEvidence.length - inheritedBasisCount,
    deadEndRiskCount: practiceCandidates.filter((candidate) => candidate.deadEndRisk !== "low").length,
    falseConfidenceRiskCount: practiceCandidates.filter((candidate) => candidate.falseConfidenceRisk !== "low").length,
    lowFeedbackRiskCount: practiceCandidates.filter((candidate) => candidate.lowFeedbackRisk !== "low").length,
    localOnlyRiskCount: 0,
    constraints: ["projection only: canonical practical adaptation is the lifecycle authority", "planned requirements are not execution proof", "inherited knowledge is not tested here"],
    caps: {
      problemFrameCap: PROBLEM_FRAME_CAP,
      practiceCandidateCap: PRACTICE_CANDIDATE_CAP,
      evidencePerFrameCap: EVIDENCE_PER_FRAME_CAP,
      evidencePerCandidateCap: EVIDENCE_PER_CANDIDATE_CAP,
      basisPerCandidateCap: 4,
      relatedLinkCap: 4,
      contextRecordCap: 16,
      capsHeld: problemFrames.length <= PROBLEM_FRAME_CAP && practiceCandidates.length <= PRACTICE_CANDIDATE_CAP,
    },
    integrity: canonicalProblemIntegrity(problemFrames, practiceCandidates),
    chronicleIntegration: { mode: "inspected_skipped", reason: "Canonical practical history remains a read model.", brokenRenderedLinks: 0 },
    technicalProof: {
      payloadBytesEstimate: JSON.stringify(payload).length,
      maxFramePayloadBytes: Math.max(0, ...problemFrames.map((frame) => JSON.stringify(frame).length)),
      maxCandidatePayloadBytes: Math.max(0, ...practiceCandidates.map((candidate) => JSON.stringify(candidate).length)),
      sourceIdSamples: unique(allEvidence.map((evidence) => evidence.sourceId)).slice(0, 12),
      affordanceIdSamples: [],
      knowledgeIdSamples: unique(practiceCandidates.flatMap((candidate) => candidate.relatedKnowledgeIds)).slice(0, 12),
      eventIdSamples: unique(problemFrames.flatMap((frame) => frame.relatedEventIds)).slice(0, 12),
      activityIdSamples: [],
      repetitionIdSamples: [],
      legacyStartingSkillProofCount: 0,
      fakeSkillStateCount: 0,
      decisionPathIsolation: true,
    },
  };
}

function canonicalProblemIntegrity(
  frames: readonly ProblemFrame[],
  candidates: readonly PracticeExperimentCandidate[],
): ProblemPracticeProfile["integrity"] {
  const inheritedCandidates = candidates.filter((candidate) => candidate.canonical?.executionTruth === "idea_only");
  return {
    selectedBandOnly: true, projectionOnly: true, noBehaviorInfluence: true, noDecisionInfluence: true,
    noSkillOrAdaptationState: true, noAutomaticImprovement: true, noCultureTabooMythWorldviewLanguage: true,
    noAgricultureSettlementTerritoryWar: true, ignoresLegacyStartingSkills: true,
    inheritedSeparated: frames.every((frame) => frame.livedBasis !== "unknown"),
    daughterParentKnowledgeNotTreatedAsTestedHere: inheritedCandidates.every((candidate) => candidate.status === "inherited_not_tested_here"),
    repetitionIsNotMastery: true,
    candidatesRequireProblemBasis: candidates.every((candidate) => frames.some((frame) => frame.id === candidate.problemFrameId)),
  };
}

export function deriveCanonicalPracticeFeedbackReadinessProfile(world: WorldState, band: Band): PracticeFeedbackReadinessProfile {
  const problemProfile = deriveCanonicalProblemPracticeProfile(world, band);
  const items: readonly PracticeFeedbackReadinessItem[] = problemProfile.practiceCandidates
    .slice(0, READINESS_ITEM_CAP)
    .map((candidate) => canonicalReadinessItem(candidate));
  const evidence = items.flatMap((item) => item.evidence);
  const inheritedBasisCount = evidence.filter((item) => item.livedBasis === "inherited_not_lived").length;
  const payload = { bandId: band.id, generatedAtTick: Number(world.time.tick), items };
  return {
    bandId: band.id,
    generatedAtTick: Number(world.time.tick),
    generatedAtYear: world.time.year,
    projectionMode: "selected_band_projection",
    authority: "canonical_practical_adaptation",
    overviewTitle: items.length === 0 ? "No canonical practice readiness recorded" : "Canonical practice plans and feedback",
    overviewLines: ["Readiness is derived from canonical lifecycle records; a plan is not a completed practice."],
    items,
    familyCounts: countByKey(READINESS_FAMILIES, items.map((item) => item.family)),
    feedbackTypeCounts: countByKey(READINESS_FEEDBACK_TYPES, items.map((item) => item.feedbackType)),
    feedbackQualityCounts: countByKey(FEEDBACK_QUALITIES, items.map((item) => item.feedbackQuality)),
    readinessStatusCounts: countByKey(READINESS_STATUSES, items.map((item) => item.readinessStatus)),
    sourceSystemCounts: countByKey(READINESS_SOURCE_SYSTEMS, evidence.map(() => "problem_practice")),
    repeatedExposureCount: items.filter((item) => item.canonical?.executionTruth === "practice_attempted").length,
    deadEndRiskCount: items.filter((item) => item.risks.includes("dead_end")).length,
    falseConfidenceRiskCount: items.filter((item) => item.risks.includes("false_confidence")).length,
    localOnlyRiskCount: 0,
    lowFeedbackRiskCount: items.filter((item) => item.risks.includes("low_feedback")).length,
    blockerCounts: countByKey(BLOCKERS, items.flatMap((item) => item.blockers)),
    problemRefCount: unique(items.flatMap((item) => item.linkedProblemFrameId === undefined ? [] : [item.linkedProblemFrameId])).length,
    candidateRefCount: unique(items.flatMap((item) => item.linkedPracticeCandidateId === undefined ? [] : [item.linkedPracticeCandidateId])).length,
    affordanceRefCount: 0,
    knowledgeRefCount: unique(items.flatMap((item) => item.linkedKnowledgeIds)).length,
    activityRefCount: 0,
    eventRefCount: unique(items.flatMap((item) => item.linkedEventIds)).length,
    footholdRefCount: 0,
    repetitionRefCount: 0,
    inheritedBasisCount,
    livedBasisCount: evidence.length - inheritedBasisCount,
    constraints: ["projection only: readiness is not stored and does not change choices", "planned material requirements are not execution proof", "inherited knowledge is not local practice"],
    caps: {
      itemCap: READINESS_ITEM_CAP, itemsPerFamilyCap: 2, evidencePerItemCap: EVIDENCE_PER_ITEM_CAP,
      blockersPerItemCap: 4, risksPerItemCap: 4, basisPerItemCap: 4, linkPerItemCap: 4, contextRecordCap: 16,
      capsHeld: items.length <= READINESS_ITEM_CAP,
    },
    integrity: {
      selectedBandOnly: true, projectionOnly: true, noBehaviorInfluence: true, noDecisionInfluence: true,
      noSkillOrAdaptationState: true, noAutomaticImprovement: true, learningReadyLaterIsNotSkill: true,
      noCultureTabooMythWorldviewLanguage: true, noSettlementInventoryPropertyStorageEconomy: true,
      noAgricultureDomesticationWar: true, ignoresLegacyStartingSkills: true,
      inheritedSeparated: items.every((item) => item.inheritedVsLivedBasis !== "unknown"),
      daughterParentRoutineNotLocalTesting: items.every((item) => item.inheritedVsLivedBasis !== "inherited_not_lived" || item.readinessStatus === "inherited_not_tested_here"),
      badRepetitionRepresented: true,
      itemsRequireCandidateOrRepeatedAffordanceBasis: items.every((item) => item.linkedPracticeCandidateId !== undefined),
    },
    chronicleIntegration: { mode: "inspected_skipped", reason: "Canonical practical history remains a read model.", brokenRenderedLinks: 0 },
    technicalProof: {
      payloadBytesEstimate: JSON.stringify(payload).length,
      maxItemPayloadBytes: Math.max(0, ...items.map((item) => JSON.stringify(item).length)),
      sourceIdSamples: unique(evidence.map((item) => item.sourceId)).slice(0, 12),
      problemFrameIdSamples: unique(items.flatMap((item) => item.linkedProblemFrameId === undefined ? [] : [item.linkedProblemFrameId])).slice(0, 12),
      practiceCandidateIdSamples: unique(items.flatMap((item) => item.linkedPracticeCandidateId === undefined ? [] : [item.linkedPracticeCandidateId])).slice(0, 12),
      affordanceIdSamples: [], knowledgeIdSamples: unique(items.flatMap((item) => item.linkedKnowledgeIds)).slice(0, 12),
      activityIdSamples: [], eventIdSamples: unique(items.flatMap((item) => item.linkedEventIds)).slice(0, 12),
      footholdIdSamples: [], repetitionIdSamples: [], brokenRenderedLinks: 0, legacyStartingSkillProofCount: 0,
      fakeSkillClaimCount: 0, fakeCultureClaimCount: 0, fakeSettlementInventoryClaimCount: 0, decisionPathIsolation: true,
    },
  };
}

function canonicalReadinessItem(candidate: PracticeExperimentCandidate): PracticeFeedbackReadinessItem {
  const canonical = candidate.canonical!;
  const inherited = candidate.status === "inherited_not_tested_here";
  const feedbackType: PracticeFeedbackReadinessFeedbackType = inherited ? "inherited_no_local_feedback"
    : canonical.executionTruth === "blocked_material_execution" ? "blocked_no_attempt"
    : candidate.expectedFeedbackType;
  const readinessStatus: PracticeFeedbackReadinessStatus = inherited ? "inherited_not_tested_here"
    : canonical.executionTruth === "blocked_material_execution" ? "blocked_by_material"
    : canonical.executionTruth === "practice_attempted" ? "repeated_low_feedback"
    : canonical.executionTruth === "concluded_from_canonical_history" && canonical.experimentStatus === "concluded_failure" ? "contradicted"
    : "not_started";
  const feedbackQuality: PracticeFeedbackQuality = inherited ? "inherited_only"
    : canonical.executionTruth === "blocked_material_execution" ? "blocked"
    : canonical.executionTruth === "concluded_from_canonical_history" && canonical.experimentStatus === "concluded_success" ? "clear"
    : canonical.executionTruth === "concluded_from_canonical_history" ? "mixed"
    : "weak";
  const blockers: readonly PracticeFeedbackBlocker[] = canonical.executionTruth === "blocked_material_execution" ? ["missing_material"]
    : inherited ? ["inherited_not_local"] : [];
  const risks: readonly PracticeFeedbackRisk[] = candidate.deadEndRisk === "present" ? ["dead_end"]
    : candidate.lowFeedbackRisk === "present" ? ["low_feedback"] : [];
  const evidence: readonly PracticeFeedbackEvidenceRef[] = [canonical.ideaId, canonical.experimentId, ...candidate.relatedKnowledgeIds]
    .filter((id): id is string => id !== undefined)
    .slice(0, EVIDENCE_PER_ITEM_CAP)
    .map((sourceId) => ({
      kind: sourceId === candidate.id ? "practice_candidate" : "problem_frame",
      sourceSystem: "problem_practice",
      label: sourceId === candidate.id ? candidate.publicLabel : `Canonical evidence ${sourceId}`,
      sourceId,
      confidence: candidate.confidence,
      livedBasis: inherited ? "inherited_not_lived" : "lived",
      problemFrameId: candidate.problemFrameId,
      practiceCandidateId: candidate.id,
      reasonIds: [],
    }));
  return {
    id: `practice-feedback:${candidate.id}`,
    problemFrameId: candidate.problemFrameId,
    family: readinessFamilyFromCandidate(candidate.family),
    publicLabel: inherited ? `${candidate.publicLabel} (inherited; not tested here)` : candidate.publicLabel,
    meaning: canonical.executionTruth === "blocked_material_execution"
      ? "Material execution is not proven by this canonical plan."
      : candidate.meaning,
    linkedProblemFrameId: candidate.problemFrameId,
    linkedPracticeCandidateId: candidate.id,
    linkedAffordanceIds: [], linkedKnowledgeIds: candidate.relatedKnowledgeIds, linkedActivityIds: [],
    linkedEventIds: [candidate.problemFrameId], linkedFootholdIds: [], linkedRepetitionIds: [],
    repeatedExposureBasis: canonical.executionTruth === "practice_attempted" ? ["canonical attempted practice"] : [],
    feedbackType, feedbackQuality,
    familiaritySignal: canonical.executionTruth === "practice_attempted" ? "canonical attempt recorded" : "canonical plan recorded",
    readinessStatus, blockers, risks,
    inheritedVsLivedBasis: inherited ? "inherited_not_lived" : "lived",
    localTransferClue: inherited ? "Inherited knowledge; not tested here." : "Canonical lifecycle record; no inferred local execution.",
    confidence: candidate.confidence,
    evidence,
    sourceSystems: ["problem_practice"],
    noSkillUnlocked: true, noAutomaticImprovement: true, noDecisionInfluence: true,
    learningReadyLaterIsNotSkill: true, futureHook: "practice_learning_readiness_candidate",
    canonical,
  };
}

function readinessFamilyFromCandidate(family: PracticeExperimentFamily): PracticeFeedbackReadinessFamily {
  switch (family) {
    case "carrying_container_cordage": return "carrying_fiber_handling";
    case "food_processing_trial": return "food_work_processing";
    case "crossing_route_trial": return "route_crossing";
    case "camp_shelter_care_trial": return "camp_setup_care";
    case "fire_hearth_fuel_trial": return "fire_hearth_fuel";
    case "water_edge_capture_trial": return "water_edge_capture";
    case "tool_digging_cutting_trial": return "tool_digging_cutting";
  }
}

function countStrings(values: readonly string[]): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}
