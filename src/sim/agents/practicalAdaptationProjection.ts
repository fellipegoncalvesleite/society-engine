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
  AdaptiveAttemptOutcome,
  AdaptiveEfficacyRecord,
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
  "recorded_execution_without_feedback",
] as const satisfies readonly PracticeFeedbackType[];

const READINESS_FEEDBACK_TYPES = [
  "clear_success", "clear_failure", "mixed_feedback", "low_feedback", "delayed_feedback",
  "dangerous_feedback", "local_only_success", "inherited_no_local_feedback",
  "contradicted_by_recent_events", "blocked_no_attempt", "familiarity_only", "recorded_execution_without_feedback",
] as const satisfies readonly PracticeFeedbackReadinessFeedbackType[];

const FEEDBACK_QUALITIES = [
  "clear", "usable", "mixed", "weak", "delayed", "dangerous", "inherited_only", "blocked", "contradicted", "not_recorded",
] as const satisfies readonly PracticeFeedbackQuality[];

const READINESS_STATUSES = [
  "not_started", "familiarity_only", "repeated_low_feedback", "repeated_mixed_feedback",
  "learning_ready_later", "blocked_by_material", "blocked_by_labor", "inherited_not_tested_here",
  "dead_end_risk", "false_confidence_risk", "local_only", "contradicted", "executed_without_feedback",
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

function fallbackProblemFamily(family: PracticalResponseFamily): ProblemFrameFamily {
  switch (family) {
    case "carrying_load": return "carrying_logistical_burden";
    case "dry_route_water":
    case "proto_measure": return "route_new_country_uncertainty";
    case "hunting_distance": return "food_return_subsistence";
    case "temporary_shelter":
    case "care_treatment": return "camp_setup_care_burden";
    case "water_storage":
    case "groundwater_seek":
    case "animal_proximity": return "water_refuge_pressure";
    case "engineering_structure": return "crossing_blocked_path";
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

type CanonicalBasis = PracticeFeedbackLivedBasis;

function problemLivedBasis(problem: PracticalProblemFrame): CanonicalBasis {
  if (problem.origin === "inherited") return "inherited_not_lived";
  if (problem.origin === "copied") return "copied_not_lived";
  return "lived";
}

function candidateHasLocalExecution(canonical: CanonicalCandidateProjection): boolean {
  return canonical.executionTruth === "practice_attempted" ||
    canonical.executionTruth === "existing_physical_work_executed" ||
    canonical.executionTruth === "concluded_from_canonical_history";
}

function candidateStatus(entry: CanonicalPracticalAdaptationRow): PracticeExperimentStatus {
  const { canonical, experiment, candidateBasis } = entry;
  if (canonical.executionTruth === "blocked_material_execution") return "blocked_by_missing_material";
  if (canonical.executionTruth === "existing_physical_work_unproven" ||
      canonical.executionTruth === "execution_provenance_unproven") return "currently_unsupported";
  if ((candidateBasis === "inherited_not_lived" || candidateBasis === "copied_not_lived") &&
      !candidateHasLocalExecution(canonical)) return "inherited_not_tested_here";
  if (experiment?.status === "concluded_failure" || experiment?.status === "abandoned") return "dead_end_risk";
  if (experiment?.status === "concluded_partial") return "low_feedback_repetition";
  if (experiment?.status === "concluded_success") return "implicit_repetition";
  if (canonical.attemptSeasons > 0 || canonical.efficacyRecordIds.length > 0) return "implicit_repetition";
  if (canonical.responseStatus === "abandoned") return "dead_end_risk";
  if (canonical.executionTruth === "practice_attempted") return "implicit_repetition";
  if (experiment !== undefined) return "plausible_untried";
  return "currently_unsupported";
}

interface CanonicalFeedbackPresentation {
  readonly feedbackType: PracticeFeedbackType;
  readonly feedbackQuality: PracticeFeedbackQuality;
}

function feedbackFromEfficacy(record: AdaptiveEfficacyRecord): CanonicalFeedbackPresentation {
  const outcome: AdaptiveAttemptOutcome = record.outcome;
  switch (outcome) {
    case "clear_success": return { feedbackType: "clear_success", feedbackQuality: "clear" };
    case "clear_failure": return { feedbackType: "clear_failure", feedbackQuality: "clear" };
    case "partial_success": return { feedbackType: "mixed_feedback", feedbackQuality: "usable" };
    case "mixed_feedback": return { feedbackType: "mixed_feedback", feedbackQuality: "mixed" };
    case "low_feedback": return { feedbackType: "low_feedback", feedbackQuality: "weak" };
    case "delayed_feedback": return { feedbackType: "delayed_feedback", feedbackQuality: "delayed" };
    case "dangerous_feedback": return { feedbackType: "dangerous_feedback", feedbackQuality: "dangerous" };
    case "local_only_success": return { feedbackType: "local_only_success", feedbackQuality: "usable" };
    case "contradicted_by_event": return { feedbackType: "contradicted_by_recent_events", feedbackQuality: "contradicted" };
    case "false_confidence": return { feedbackType: "mixed_feedback", feedbackQuality: "mixed" };
    case "dead_end": return { feedbackType: "clear_failure", feedbackQuality: "weak" };
    case "blocked_before_attempt":
    case "too_labor_heavy":
      return { feedbackType: "delayed_feedback", feedbackQuality: "blocked" };
  }
  const exhaustive: never = outcome;
  return exhaustive;
}

function feedbackPresentation(entry: CanonicalPracticalAdaptationRow): CanonicalFeedbackPresentation {
  if (entry.canonical.executionTruth === "blocked_material_execution" ||
      entry.canonical.executionTruth === "existing_physical_work_unproven" ||
      entry.canonical.executionTruth === "execution_provenance_unproven") {
    return { feedbackType: "delayed_feedback", feedbackQuality: "blocked" };
  }
  if ((entry.candidateBasis === "inherited_not_lived" || entry.candidateBasis === "copied_not_lived") &&
      !candidateHasLocalExecution(entry.canonical)) {
    return { feedbackType: "inherited_no_local_feedback", feedbackQuality: "inherited_only" };
  }
  if (entry.experiment?.status === "concluded_success") return { feedbackType: "clear_success", feedbackQuality: "clear" };
  if (entry.experiment?.status === "concluded_partial") return { feedbackType: "mixed_feedback", feedbackQuality: "mixed" };
  if (entry.experiment?.status === "concluded_failure" || entry.experiment?.status === "abandoned") {
    return { feedbackType: "clear_failure", feedbackQuality: "contradicted" };
  }
  const efficacy = entry.efficacyRecords[0];
  if (efficacy !== undefined) return feedbackFromEfficacy(efficacy);
  if (entry.canonical.attemptSeasons > 0) return { feedbackType: "low_feedback", feedbackQuality: "weak" };
  if (entry.canonical.executionTruth === "existing_physical_work_executed") {
    return { feedbackType: "recorded_execution_without_feedback", feedbackQuality: "not_recorded" };
  }
  return { feedbackType: "delayed_feedback", feedbackQuality: "weak" };
}

export interface CanonicalPracticalAdaptationRow {
  readonly id: string;
  readonly family: PracticalResponseFamily;
  readonly variantKey: string;
  readonly problem?: PracticalProblemFrame;
  readonly idea?: PracticalIdeaCandidate;
  readonly experiment?: PracticalExperiment;
  readonly response?: PracticalResponseState;
  readonly efficacyRecords: readonly AdaptiveEfficacyRecord[];
  readonly recordedEfficacyRecords: readonly AdaptiveEfficacyRecord[];
  readonly canonical: CanonicalCandidateProjection;
  readonly candidateBasis: CanonicalBasis;
}

export function canonicalExecutionProofGap(canonical: CanonicalCandidateProjection): string | undefined {
  switch (canonical.executionTruth) {
    case "blocked_material_execution":
      return "material execution not proven";
    case "existing_physical_work_unproven":
      return "physical work not proven";
    case "execution_provenance_unproven":
      return "execution provenance unavailable";
    case "idea_only":
    case "planned_unexecuted":
    case "practice_attempted":
    case "existing_physical_work_executed":
    case "concluded_from_canonical_history":
      return undefined;
  }
}

export function canonicalEfficacyRecordsForProjection(
  canonical: CanonicalCandidateProjection,
  records: readonly AdaptiveEfficacyRecord[],
): readonly AdaptiveEfficacyRecord[] {
  const admittedIds = new Set(canonical.efficacyRecordIds);
  return records.filter((record) => admittedIds.has(record.id));
}

interface CanonicalRowSeed {
  readonly idea?: PracticalIdeaCandidate;
  readonly experiment?: PracticalExperiment;
  readonly response?: PracticalResponseState;
  readonly efficacyResponseId?: string;
}

const PRACTICAL_RESPONSE_FAMILIES = new Set<PracticalResponseFamily>([
  "carrying_load", "dry_route_water", "hunting_distance", "temporary_shelter", "water_storage",
  "animal_proximity", "engineering_structure", "groundwater_seek", "care_treatment", "proto_measure",
]);

function candidateBasis(idea: PracticalIdeaCandidate | undefined, canonical: CanonicalCandidateProjection): CanonicalBasis {
  const localExecution = candidateHasLocalExecution(canonical);
  if (idea?.source === "inherited") return localExecution ? "mixed" : "inherited_not_lived";
  if (idea?.source === "copied") return localExecution ? "mixed" : "copied_not_lived";
  if (idea?.source === "local_inference" || idea?.source === "accident") return "lived";
  return localExecution ? "lived" : "unknown";
}

function linkSeed(
  state: PracticalAdaptationState,
  retainedProblems: readonly PracticalProblemFrame[],
  seed: CanonicalRowSeed,
): CanonicalPracticalAdaptationRow | undefined {
  const idea = seed.idea;
  const experiment = seed.experiment;
  const response = seed.response;
  const family = idea?.family ?? experiment?.family ?? response?.family ??
    state.efficacyRecords.find((record) => record.responseId === seed.efficacyResponseId)?.family;
  if (family === undefined || !PRACTICAL_RESPONSE_FAMILIES.has(family as PracticalResponseFamily)) return undefined;
  const practicalFamily = family as PracticalResponseFamily;
  const variantKey = idea?.variantKey ?? experiment?.variantKey ?? response?.variantKey ?? "unknown_variant";
  const problemId = idea?.problemId ?? experiment?.problemId ?? response?.problemId;
  const ideaId = idea?.id ?? experiment?.ideaId ?? response?.ideaId;
  const experimentId = experiment?.id ?? response?.experimentId;
  const responseId = response?.id ?? experiment?.responseId ?? seed.efficacyResponseId;
  const problem = problemId === undefined ? undefined : retainedProblems.find((item) => item.id === problemId);
  const recordedEfficacyRecords = responseId === undefined
    ? []
    : state.efficacyRecords.filter((record) => record.responseId === responseId);
  const executionClass = derivePracticalVariantExecutionClass(practicalFamily, variantKey);
  const matchingPhysicalWork = responseId !== undefined && state.waterWorks?.responseId === responseId;
  // Positive authorization only: loss of variant provenance may preserve a
  // canonical record, but it can never increase execution authority.
  const executionEvidenceAdmitted = executionClass === "practice_only" ||
    (executionClass === "existing_physical_work" && matchingPhysicalWork);
  const executionTruth = executionClass === undefined
    ? "execution_provenance_unproven"
    : executionClass === "material_execution_required"
      ? "blocked_material_execution"
      : executionClass === "existing_physical_work"
        ? matchingPhysicalWork ? "existing_physical_work_executed" : "existing_physical_work_unproven"
        : experiment?.status.startsWith("concluded_") || experiment?.status === "abandoned"
          ? "concluded_from_canonical_history"
          : (experiment?.attemptSeasons ?? 0) > 0 || recordedEfficacyRecords.length > 0
            ? "practice_attempted"
            : experiment !== undefined
              ? "planned_unexecuted"
              : "idea_only";
  const missingLinks = [
    ...(problemId !== undefined && problem === undefined ? [{ kind: "problem" as const, id: problemId }] : []),
    ...(ideaId !== undefined && idea === undefined ? [{ kind: "idea" as const, id: ideaId }] : []),
    ...(experimentId !== undefined && experiment === undefined ? [{ kind: "experiment" as const, id: experimentId }] : []),
    ...(responseId !== undefined && response === undefined ? [{ kind: "response" as const, id: responseId }] : []),
  ];
  const recordedAttemptSeasons = experiment?.attemptSeasons ?? 0;
  const admittedEfficacyRecords = executionEvidenceAdmitted ? recordedEfficacyRecords : [];
  const canonical: CanonicalCandidateProjection = {
    ...(problemId === undefined ? {} : { problemId }),
    ...(problem === undefined ? {} : { problemOrigin: problem.origin }),
    ...(ideaId === undefined ? {} : { ideaId }),
    ...(idea === undefined ? {} : { ideaStatus: idea.status, ideaSource: idea.source }),
    ...(experimentId === undefined ? {} : { experimentId }),
    ...(experiment === undefined ? {} : { experimentStatus: experiment.status }),
    attemptSeasons: executionEvidenceAdmitted ? recordedAttemptSeasons : 0,
    recordedAttemptSeasons,
    ...(responseId === undefined ? {} : { responseId }),
    ...(response === undefined ? {} : { responseStatus: response.status }),
    efficacyRecordIds: admittedEfficacyRecords.map((record) => record.id),
    recordedEfficacyRecordIds: recordedEfficacyRecords.map((record) => record.id),
    missingLinks,
    executionEvidenceAdmitted,
    executionTruth,
  };
  return {
    id: idea?.id ?? experiment?.id ?? response?.id ?? recordedEfficacyRecords[0]?.id ?? `canonical-row:${practicalFamily}`,
    family: practicalFamily,
    variantKey,
    problem,
    idea,
    experiment,
    response,
    efficacyRecords: admittedEfficacyRecords,
    recordedEfficacyRecords,
    canonical,
    candidateBasis: candidateBasis(idea, canonical),
  };
}

/**
 * The single canonical lifecycle join used by every Item 5 read surface.
 * Each bounded array remains authoritative independently: missing neighbours
 * are represented in `canonical.missingLinks`, never converted into absence.
 */
export function deriveCanonicalPracticalAdaptationRows(
  state: PracticalAdaptationState,
  retainedProblems: readonly PracticalProblemFrame[] = (state.problems ?? []).slice(0, PROBLEM_FRAME_CAP),
): readonly CanonicalPracticalAdaptationRow[] {
  const experiments = state.experiments ?? [];
  const responses = state.responses ?? [];
  const usedExperiments = new Set<string>();
  const usedResponses = new Set<string>();
  const usedEfficacyResponseIds = new Set<string>();
  const seeds: CanonicalRowSeed[] = [];

  for (const idea of state.ideas ?? []) {
    const experiment = experiments.find((item) => !usedExperiments.has(item.id) && item.ideaId === idea.id);
    if (experiment !== undefined) usedExperiments.add(experiment.id);
    const response = experiment === undefined
      ? responses.find((item) => !usedResponses.has(item.id) && item.ideaId === idea.id)
      : responses.find((item) => !usedResponses.has(item.id) && item.id === experiment.responseId);
    if (response !== undefined) usedResponses.add(response.id);
    const efficacyResponseId = response?.id ?? experiment?.responseId;
    if (efficacyResponseId !== undefined) usedEfficacyResponseIds.add(efficacyResponseId);
    seeds.push({ idea, experiment, response, efficacyResponseId });
  }

  for (const experiment of experiments) {
    if (usedExperiments.has(experiment.id)) continue;
    usedExperiments.add(experiment.id);
    const response = responses.find((item) => !usedResponses.has(item.id) && item.id === experiment.responseId);
    if (response !== undefined) usedResponses.add(response.id);
    const efficacyResponseId = response?.id ?? experiment.responseId;
    usedEfficacyResponseIds.add(efficacyResponseId);
    seeds.push({ experiment, response, efficacyResponseId });
  }

  for (const response of responses) {
    if (usedResponses.has(response.id)) continue;
    usedResponses.add(response.id);
    usedEfficacyResponseIds.add(response.id);
    seeds.push({ response, efficacyResponseId: response.id });
  }

  for (const responseId of unique(state.efficacyRecords.map((record) => record.responseId))) {
    if (usedEfficacyResponseIds.has(responseId)) continue;
    seeds.push({ efficacyResponseId: responseId });
  }

  return seeds
    .map((seed) => linkSeed(state, retainedProblems, seed))
    .filter((entry): entry is CanonicalPracticalAdaptationRow => entry !== undefined);
}

function problemEvidence(problem: PracticalProblemFrame, basis: CanonicalBasis): readonly ProblemPracticeEvidenceRef[] {
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

function candidateEvidence(entry: CanonicalPracticalAdaptationRow, state: PracticalAdaptationState): readonly ProblemPracticeEvidenceRef[] {
  const ids = [entry.idea?.id, entry.experiment?.id, entry.response?.id, ...(entry.idea?.basisFragmentIds ?? [])]
    .filter((id): id is string => id !== undefined)
    .filter((id) => id === entry.idea?.id || id === entry.experiment?.id || id === entry.response?.id ||
      state.fragments.some((fragment) => fragment.id === id));
  return unique(ids).slice(0, EVIDENCE_PER_CANDIDATE_CAP).map((sourceId) => ({
    kind: "knowledge",
    sourceSystem: "knowledge_ecology",
    label: sourceId === entry.idea?.id ? entry.idea.publicLabel : `Canonical basis ${sourceId}`,
    sourceId,
    confidence: entry.idea?.basisScore ?? entry.response?.confidence ?? entry.problem?.confidence ?? 0,
    livedBasis: entry.candidateBasis,
    reasonIds: [],
  }));
}

export function deriveCanonicalProblemPracticeProfile(world: WorldState, band: Band): ProblemPracticeProfile {
  const state = band.practicalAdaptation;
  if (state === undefined) throw new Error("canonical practical projection requires practicalAdaptation");
  const problems = (state.problems ?? []).slice(0, PROBLEM_FRAME_CAP);
  const canonicalRows = deriveCanonicalPracticalAdaptationRows(state, problems);
  const entries = canonicalRows.slice(0, PRACTICE_CANDIDATE_CAP);
  const problemFrames: readonly ProblemFrame[] = problems.map((problem) => {
    const basis = problemLivedBasis(problem);
    const hooks = entries.filter((entry) => entry.problem?.id === problem.id).map((entry) => candidateFamily(entry.family));
    const basisLabel = basis === "inherited_not_lived"
      ? `${problem.publicLabel} (inherited; not tested here)`
      : basis === "copied_not_lived"
        ? `${problem.publicLabel} (copied; not lived here)`
        : problem.publicLabel;
    return {
      id: problem.id,
      family: problemFamily(problem.family),
      publicLabel: basisLabel,
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
      inheritedEvidenceCount: basis === "inherited_not_lived" || basis === "copied_not_lived" ? 1 : 0,
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
    const status = candidateStatus(entry);
    const feedback = feedbackPresentation(entry);
    const evidence = candidateEvidence(entry, state);
    const problemFrameId = entry.canonical.problemId ?? entry.problem?.id ?? `unlinked-problem:${entry.id}`;
    const relatedKnowledgeIds = (entry.idea?.basisFragmentIds ?? []).slice(0, 4);
    const inheritedLabel = entry.candidateBasis === "inherited_not_lived";
    const copiedLabel = entry.candidateBasis === "copied_not_lived";
    const baseLabel = entry.idea?.publicLabel ?? entry.response?.publicLabel ?? `Canonical ${entry.family} lifecycle record`;
    const publicLabel = inheritedLabel
      ? `${baseLabel} (inherited; not tested here)`
      : copiedLabel
        ? `${baseLabel} (copied; not tested here)`
        : baseLabel;
    const problemProjectionFamily = entry.problem === undefined
      ? fallbackProblemFamily(entry.family)
      : problemFamily(entry.problem.family);
    const executionUnproven = entry.canonical.executionTruth === "blocked_material_execution" ||
      entry.canonical.executionTruth === "existing_physical_work_unproven" ||
      entry.canonical.executionTruth === "execution_provenance_unproven";
    return {
      id: entry.id,
      family: candidateFamily(entry.family),
      publicLabel,
      meaning: entry.idea?.mechanismBelief ?? entry.experiment?.expectedEffect ?? entry.response?.contextNote ??
        "A retained canonical lifecycle record has missing adjacent history.",
      problemFrameId,
      problemFamily: problemProjectionFamily,
      relatedAffordanceIds: [],
      relatedKnowledgeIds,
      relatedEventIds: entry.problem === undefined ? [] : [entry.problem.id],
      relatedActivityIds: [],
      relatedRepetitionIds: [],
      materialBasis: relatedKnowledgeIds,
      knowledgeBasis: relatedKnowledgeIds,
      activityRepetitionBasis: [],
      expectedFeedbackType: feedback.feedbackType,
      likelyCostRisk: entry.experiment?.opportunityCost ?? entry.idea?.statusReason ?? "adjacent canonical history is missing",
      laborBurden: entry.experiment === undefined ? "no canonical experiment plan is recorded" : "planned requirements are not execution proof",
      confidence: entry.idea?.basisScore ?? entry.response?.confidence ?? entry.problem?.confidence ?? 0,
      uncertainty: executionUnproven
        ? entry.canonical.executionTruth === "blocked_material_execution"
          ? "material execution not proven"
          : entry.canonical.executionTruth === "existing_physical_work_unproven"
            ? "physical work not proven"
            : "canonical efficacy record retained, execution provenance unavailable"
        : entry.experiment?.observedOutcome ?? "",
      deadEndRisk: status === "dead_end_risk" ? "present" : "low",
      falseConfidenceRisk: entry.canonical.executionTruth === "blocked_material_execution" ? "present" : "low",
      lowFeedbackRisk: feedback.feedbackType === "low_feedback" ? "present" : "low",
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
  const inheritedBasisCount = allEvidence.filter((evidence) =>
    evidence.livedBasis === "inherited_not_lived" || evidence.livedBasis === "copied_not_lived").length;
  const payload = { bandId: band.id, generatedAtTick: Number(world.time.tick), problemFrames, practiceCandidates };
  return {
    bandId: band.id,
    generatedAtTick: Number(world.time.tick),
    generatedAtYear: world.time.year,
    projectionMode: "selected_band_projection",
    authority: "canonical_practical_adaptation",
    overviewTitle: problemFrames.length === 0 ? "No canonical practical problems recorded" : "Canonical practical problems and plans",
    overviewLines: practiceCandidates.length === 0
      ? problemFrames.some((frame) => frame.livedBasis === "inherited_not_lived" || frame.livedBasis === "copied_not_lived")
        ? ["Canonical inherited or copied problem framing is not a local trial."]
        : ["No canonical idea or experiment record is attached to the recorded local problem framing."]
      : [
          "Canonical ideas and experiment records only; planned requirements are not execution proof.",
          ...(canonicalRows.length > practiceCandidates.length
            ? [`Showing ${practiceCandidates.length} of ${canonicalRows.length} retained canonical lifecycle rows; ${canonicalRows.length - practiceCandidates.length} omitted from this bounded display only.`]
            : []),
        ],
    problemFrames,
    practiceCandidates,
    problemFamilyCounts: countByKey(PROBLEM_FAMILIES, problemFrames.map((frame) => frame.family)),
    candidateFamilyCounts: countByKey(CANDIDATE_FAMILIES, practiceCandidates.map((candidate) => candidate.family)),
    perceivedCauseCounts: countStrings(problemFrames.map((frame) => frame.perceivedCause)),
    sourceSystemCounts: countByKey(PROBLEM_SOURCE_SYSTEMS, allEvidence.map((evidence) => evidence.sourceSystem)),
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
      canonicalRowCount: canonicalRows.length,
      omittedCanonicalCandidateCount: canonicalRows.length - practiceCandidates.length,
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
  const inheritedCandidates = candidates.filter((candidate) => {
    const canonical = candidate.canonical;
    return (canonical?.ideaSource === "inherited" || canonical?.ideaSource === "copied") &&
      canonical !== undefined && !candidateHasLocalExecution(canonical);
  });
  return {
    selectedBandOnly: true, projectionOnly: true, noBehaviorInfluence: true, noDecisionInfluence: true,
    noSkillOrAdaptationState: true, noAutomaticImprovement: true, noCultureTabooMythWorldviewLanguage: true,
    noAgricultureSettlementTerritoryWar: true, ignoresLegacyStartingSkills: true,
    inheritedSeparated: frames.every((frame) => frame.livedBasis !== "unknown"),
    daughterParentKnowledgeNotTreatedAsTestedHere: inheritedCandidates.every((candidate) => candidate.status === "inherited_not_tested_here"),
    repetitionIsNotMastery: true,
    candidatesRequireProblemBasis: candidates.every((candidate) =>
      frames.some((frame) => frame.id === candidate.problemFrameId) ||
      candidate.canonical?.missingLinks?.some((link) => link.kind === "problem" && link.id === candidate.problemFrameId) === true),
  };
}

export function deriveCanonicalPracticeFeedbackReadinessProfile(world: WorldState, band: Band): PracticeFeedbackReadinessProfile {
  const state = band.practicalAdaptation;
  if (state === undefined) throw new Error("canonical practical projection requires practicalAdaptation");
  const problemProfile = deriveCanonicalProblemPracticeProfile(world, band);
  const entriesById = new Map(deriveCanonicalPracticalAdaptationRows(
    state,
    (state.problems ?? []).slice(0, PROBLEM_FRAME_CAP),
  ).map((entry) => [entry.id, entry]));
  const perFamilyCounts = new Map<PracticeFeedbackReadinessFamily, number>();
  const items: readonly PracticeFeedbackReadinessItem[] = problemProfile.practiceCandidates
    .filter((candidate) => {
      const family = readinessFamilyFromCandidate(candidate.family);
      const count = perFamilyCounts.get(family) ?? 0;
      if (count >= 2) return false;
      perFamilyCounts.set(family, count + 1);
      return true;
    })
    .slice(0, READINESS_ITEM_CAP)
    .map((candidate) => canonicalReadinessItem(candidate, entriesById.get(candidate.id)!));
  const evidence = items.flatMap((item) => item.evidence);
  const inheritedBasisCount = evidence.filter((item) =>
    item.livedBasis === "inherited_not_lived" || item.livedBasis === "copied_not_lived").length;
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
    repeatedExposureCount: items.filter((item) =>
      (item.canonical?.attemptSeasons ?? 0) > 0 || (item.canonical?.efficacyRecordIds.length ?? 0) > 0).length,
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
      capsHeld: items.length <= READINESS_ITEM_CAP && [...perFamilyCounts.values()].every((count) => count <= 2),
    },
    integrity: {
      selectedBandOnly: true, projectionOnly: true, noBehaviorInfluence: true, noDecisionInfluence: true,
      noSkillOrAdaptationState: true, noAutomaticImprovement: true, learningReadyLaterIsNotSkill: true,
      noCultureTabooMythWorldviewLanguage: true, noSettlementInventoryPropertyStorageEconomy: true,
      noAgricultureDomesticationWar: true, ignoresLegacyStartingSkills: true,
      inheritedSeparated: items.every((item) => item.inheritedVsLivedBasis !== "unknown"),
      daughterParentRoutineNotLocalTesting: items.every((item) =>
        (item.inheritedVsLivedBasis !== "inherited_not_lived" && item.inheritedVsLivedBasis !== "copied_not_lived") ||
        item.readinessStatus === "inherited_not_tested_here"),
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

function canonicalReadinessItem(candidate: PracticeExperimentCandidate, entry: CanonicalPracticalAdaptationRow): PracticeFeedbackReadinessItem {
  const canonical = candidate.canonical!;
  const basis = entry.candidateBasis;
  const inherited = basis === "inherited_not_lived" || basis === "copied_not_lived";
  const hasCanonicalPracticeEvidence = canonical.attemptSeasons > 0 || canonical.efficacyRecordIds.length > 0;
  const feedback = feedbackPresentation(entry);
  const executionUnproven = canonical.executionTruth === "blocked_material_execution" ||
    canonical.executionTruth === "existing_physical_work_unproven" ||
    canonical.executionTruth === "execution_provenance_unproven";
  const feedbackType: PracticeFeedbackReadinessFeedbackType = executionUnproven
    ? "blocked_no_attempt"
    : feedback.feedbackType;
  const readinessStatus: PracticeFeedbackReadinessStatus = inherited && !candidateHasLocalExecution(canonical)
    ? "inherited_not_tested_here"
    : canonical.executionTruth === "blocked_material_execution" ? "blocked_by_material"
    : canonical.executionTruth === "existing_physical_work_unproven" ? "not_started"
    : canonical.executionTruth === "execution_provenance_unproven" ? "not_started"
    : canonical.executionTruth === "concluded_from_canonical_history" && canonical.experimentStatus === "concluded_success" ? "learning_ready_later"
    : canonical.executionTruth === "concluded_from_canonical_history" && canonical.experimentStatus === "concluded_partial" ? "repeated_mixed_feedback"
    : canonical.executionTruth === "concluded_from_canonical_history" ? "contradicted"
    : feedback.feedbackType === "clear_success" ? "learning_ready_later"
    : feedback.feedbackType === "mixed_feedback" ? "repeated_mixed_feedback"
    : feedback.feedbackType === "clear_failure" || feedback.feedbackType === "dangerous_feedback" ? "contradicted"
    : hasCanonicalPracticeEvidence ? "repeated_low_feedback"
    : canonical.executionTruth === "existing_physical_work_executed" ? "executed_without_feedback"
    : "not_started";
  const feedbackQuality: PracticeFeedbackQuality = executionUnproven
    ? "blocked"
    : feedback.feedbackQuality;
  const blockers: readonly PracticeFeedbackBlocker[] = canonical.executionTruth === "blocked_material_execution" ? ["missing_material"]
    : canonical.executionTruth === "existing_physical_work_unproven" || canonical.executionTruth === "execution_provenance_unproven" ? ["unsupported_ecology"]
    : inherited && !candidateHasLocalExecution(canonical) ? ["inherited_not_local"] : [];
  const risks: readonly PracticeFeedbackRisk[] = candidate.deadEndRisk === "present" ? ["dead_end"]
    : candidate.lowFeedbackRisk === "present" ? ["low_feedback"] : [];
  const evidence: readonly PracticeFeedbackEvidenceRef[] = [canonical.ideaId, canonical.experimentId, canonical.responseId, ...candidate.relatedKnowledgeIds]
    .filter((id): id is string => id !== undefined)
    .slice(0, EVIDENCE_PER_ITEM_CAP)
    .map((sourceId) => ({
      kind: sourceId === candidate.id ? "practice_candidate" : "problem_frame",
      sourceSystem: "problem_practice",
      label: sourceId === candidate.id ? candidate.publicLabel : `Canonical evidence ${sourceId}`,
      sourceId,
      confidence: candidate.confidence,
      livedBasis: basis,
      problemFrameId: candidate.problemFrameId,
      practiceCandidateId: candidate.id,
      reasonIds: [],
    }));
  return {
    id: `practice-feedback:${candidate.id}`,
    problemFrameId: candidate.problemFrameId,
    family: readinessFamilyFromCandidate(candidate.family),
    publicLabel: candidate.publicLabel,
    meaning: canonical.executionTruth === "blocked_material_execution"
      ? "Material execution is not proven by this canonical plan."
      : canonical.executionTruth === "existing_physical_work_unproven"
        ? "Physical work is not proven without the matching canonical works record."
        : canonical.executionTruth === "execution_provenance_unproven"
          ? "Canonical efficacy is retained, but execution provenance is unavailable."
      : candidate.meaning,
    linkedProblemFrameId: candidate.problemFrameId,
    linkedPracticeCandidateId: candidate.id,
    linkedAffordanceIds: [], linkedKnowledgeIds: candidate.relatedKnowledgeIds, linkedActivityIds: [],
    linkedEventIds: entry.problem === undefined ? [] : [candidate.problemFrameId], linkedFootholdIds: [], linkedRepetitionIds: [],
    repeatedExposureBasis: hasCanonicalPracticeEvidence
      ? [`canonical attempt evidence (${canonical.attemptSeasons} seasons; ${canonical.efficacyRecordIds.length} efficacy records)`]
      : [],
    feedbackType, feedbackQuality,
    familiaritySignal: hasCanonicalPracticeEvidence
      ? "canonical practice evidence recorded"
      : canonical.executionTruth === "existing_physical_work_executed"
        ? "canonical physical work recorded; feedback not recorded"
        : canonical.executionTruth === "existing_physical_work_unproven"
          ? "canonical physical work not proven"
          : canonical.executionTruth === "execution_provenance_unproven"
            ? "canonical record retained; execution provenance unavailable"
        : "canonical plan recorded",
    readinessStatus, blockers, risks,
    inheritedVsLivedBasis: basis,
    localTransferClue: basis === "inherited_not_lived"
      ? "Inherited knowledge; not tested here."
      : basis === "copied_not_lived"
        ? "Copied knowledge; not tested here."
        : basis === "mixed"
          ? "Carried framing with local canonical testing evidence."
          : "Canonical lifecycle record; no inferred local execution.",
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
