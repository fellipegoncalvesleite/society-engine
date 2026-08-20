import { useMemo } from "react";

import {
  derivePracticeFeedbackReadinessProfile,
  practiceFeedbackQualityLabel,
  practiceFeedbackReadinessFamilyLabel,
  practiceFeedbackReadinessFeedbackTypeLabel,
  practiceFeedbackReadinessStatusLabel,
  type PracticeFeedbackEvidenceRef,
  type PracticeFeedbackReadinessFamily,
  type PracticeFeedbackReadinessItem,
} from "../../sim/agents/practiceFeedbackReadiness";
import type { AdaptiveEfficacyRecord, Band } from "../../sim/agents/types";
import type { WorldState } from "../../sim/world/types";

import { Icon, type IconName } from "../icons";
import { Chip, SectionHeading } from "./parts";

const FAMILY_ICON: Readonly<Record<PracticeFeedbackReadinessFamily, IconName>> = {
  carrying_fiber_handling: "storage",
  food_work_processing: "food",
  route_crossing: "ford",
  camp_setup_care: "camp",
  fire_hearth_fuel: "settle",
  water_edge_capture: "fishing",
  tool_digging_cutting: "craft",
};

export function PracticeFeedback({
  band,
  world,
}: {
  readonly band: Band;
  readonly world: WorldState | null;
}) {
  const profile = useMemo(
    () => (world === null ? undefined : derivePracticeFeedbackReadinessProfile(world, band)),
    [band, world],
  );

  if (profile === undefined) {
    return (
      <section className="bp-section band-practice-feedback">
        <SectionHeading icon="activity">Practice Feedback</SectionHeading>
        <p className="condition-note">World detail is unavailable for the selected band.</p>
      </section>
    );
  }

  if (profile.authority === "canonical_practical_adaptation") {
    return <CanonicalPracticeFeedback band={band} profile={profile} />;
  }

  const repeatedTrials = profile.items
    .filter((item) => item.repeatedExposureBasis.length > 0 || item.linkedRepetitionIds.length > 0)
    .slice(0, 5);
  const learningReady = profile.items
    .filter((item) => item.readinessStatus === "learning_ready_later")
    .slice(0, 4);
  const weakOrDeadEnd = profile.items
    .filter((item) =>
      item.readinessStatus === "repeated_low_feedback" ||
      item.readinessStatus === "dead_end_risk" ||
      item.readinessStatus === "false_confidence_risk" ||
      item.risks.includes("low_feedback") ||
      item.risks.includes("dead_end") ||
      item.risks.includes("false_confidence"))
    .slice(0, 4);
  const inherited = profile.items
    .filter((item) => item.readinessStatus === "inherited_not_tested_here" || item.inheritedVsLivedBasis === "inherited_not_lived")
    .slice(0, 3);

  return (
    <section className="bp-section band-practice-feedback" aria-label="practice feedback and routine readiness">
      <SectionHeading icon="activity">Practice Feedback</SectionHeading>
      <p className="condition-note">
        Repeated trial candidates and the feedback they seem to produce. Learning-ready later is not a skill.
      </p>

      <article className="practice-feedback-overview">
        <span className="practice-feedback-kicker">Routine readiness</span>
        <h3>{profile.overviewTitle}</h3>
        {profile.overviewLines.map((line) => (
          <p key={line}>{line}</p>
        ))}
        <div className="practice-feedback-overview-counts">
          <span>{profile.items.length} readiness item{profile.items.length === 1 ? "" : "s"}</span>
          <span>{profile.repeatedExposureCount} repeated exposure signal{profile.repeatedExposureCount === 1 ? "" : "s"}</span>
          <span>{profile.lowFeedbackRiskCount + profile.deadEndRiskCount} weak or dead-end risk</span>
          <span>{profile.footholdRefCount} camp/foothold ref{profile.footholdRefCount === 1 ? "" : "s"}</span>
        </div>
      </article>

      <div className="practice-feedback-note" role="note">
        <Icon name="warning" size={14} />
        <span>Repetition can clarify feedback or reinforce a bad routine. No method, adaptation, or extra effect exists here.</span>
      </div>

      <FeedbackBlock title="Repeated trials" empty="No repeated candidate is visible yet." items={repeatedTrials} />
      <FeedbackBlock title="Learning-ready later" empty="No candidate has both repetition and useful feedback yet." items={learningReady} ready />
      <FeedbackBlock title="Dead ends and weak feedback" empty="No weak-feedback or dead-end signal is currently prominent." items={weakOrDeadEnd} />

      {inherited.length === 0 ? null : (
        <div className="practice-feedback-block">
          <span className="practice-feedback-block-title">Inherited but untested</span>
          <div className="practice-feedback-grid compact">
            {inherited.map((item) => (
              <FeedbackCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function CanonicalPracticeFeedback({
  band,
  profile,
}: {
  readonly band: Band;
  readonly profile: ReturnType<typeof derivePracticeFeedbackReadinessProfile>;
}) {
  const planned = profile.items.filter((item) =>
    item.canonical?.executionTruth === "planned_unexecuted" ||
    item.canonical?.executionTruth === "blocked_material_execution");
  const attempted = profile.items.filter((item) =>
    item.canonical?.executionTruth === "practice_attempted" ||
    item.canonical?.executionTruth === "existing_physical_work_executed");
  const outcomes = profile.items.filter((item) =>
    item.canonical?.executionTruth === "concluded_from_canonical_history" ||
    item.canonical?.responseStatus !== undefined);
  const inheritedOnly =
    band.practicalAdaptation?.problems?.some((problem) => problem.origin === "inherited") === true ||
    band.practicalAdaptation?.fragments.some((fragment) => fragment.basis === "inherited") === true;
  const efficacyRecords = band.practicalAdaptation?.efficacyRecords ?? [];

  return (
    <section className="bp-section band-practice-feedback" aria-label="canonical practice lifecycle feedback">
      <SectionHeading icon="activity">Practice Feedback</SectionHeading>
      <p className="condition-note">Canonical practical-adaptation record: lifecycle facts are shown from stored experiment, response, efficacy, and execution evidence.</p>
      <article className="practice-feedback-overview">
        <span className="practice-feedback-kicker">Canonical practical-adaptation record</span>
        <h3>{profile.overviewTitle}</h3>
        {profile.overviewLines.map((line) => <p key={line}>{line}</p>)}
      </article>
      <FeedbackBlock title="Planned experiments" empty="No canonical experiment plan is recorded." items={planned} canonicalEfficacyRecords={efficacyRecords} />
      <FeedbackBlock title="Attempted practice or recorded physical work" empty="No attempted canonical practice or recorded physical work is visible." items={attempted} canonicalEfficacyRecords={efficacyRecords} />
      <FeedbackBlock title="Responses and recorded outcomes" empty="No canonical response or concluded outcome is recorded." items={outcomes} canonicalEfficacyRecords={efficacyRecords} />
      {inheritedOnly ? (
        <div className="practice-feedback-note inherited" role="note">
          <Icon name="lineage" size={14} />
          <span>Inherited practical fragments are knowledge carried from another band, not tested here.</span>
        </div>
      ) : null}
    </section>
  );
}

function FeedbackBlock({
  title,
  empty,
  items,
  ready = false,
  canonicalEfficacyRecords,
}: {
  readonly title: string;
  readonly empty: string;
  readonly items: readonly PracticeFeedbackReadinessItem[];
  readonly ready?: boolean;
  readonly canonicalEfficacyRecords?: readonly AdaptiveEfficacyRecord[];
}) {
  return (
    <div className="practice-feedback-block">
      <span className="practice-feedback-block-title">{title}</span>
      {items.length === 0 ? (
        <p className="empty-panel">{empty}</p>
      ) : (
        <>
          {ready ? (
            <p className="practice-feedback-subnote">These are future learning candidates only. They are not reliable methods.</p>
          ) : null}
          <div className="practice-feedback-grid">
            {items.map((item) => (
              <FeedbackCard key={item.id} item={item} efficacyRecords={canonicalEfficacyRecords} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function FeedbackCard({
  item,
  efficacyRecords,
}: {
  readonly item: PracticeFeedbackReadinessItem;
  readonly efficacyRecords?: readonly AdaptiveEfficacyRecord[];
}) {
  const materialExecutionUnproven = item.canonical?.executionTruth === "blocked_material_execution";
  return (
    <details className={`practice-feedback-card status-${item.readinessStatus}`}>
      <summary>
        <span className="practice-feedback-card-icon">
          <Icon name={FAMILY_ICON[item.family]} />
        </span>
        <span className="practice-feedback-card-head">
          <span className="practice-feedback-card-kicker">{practiceFeedbackReadinessFamilyLabel(item.family)}</span>
          <span className="practice-feedback-card-title">{item.publicLabel}</span>
          <span className="practice-feedback-card-summary">{materialExecutionUnproven ? "Material execution is not proven." : item.meaning}</span>
          {materialExecutionUnproven ? null : (
            <span className="practice-feedback-evidence-preview" aria-label="top feedback evidence">
              {item.evidence.slice(0, 2).map((entry, index) => (
                <EvidenceChip key={`${item.id}:preview:${entry.label}:${index}`} evidence={entry} />
              ))}
            </span>
          )}
        </span>
        <span className="practice-feedback-card-chips">
          <Chip>{practiceFeedbackReadinessStatusLabel(item.readinessStatus)}</Chip>
          <Chip>{materialExecutionUnproven ? "material execution not proven" : practiceFeedbackReadinessFeedbackTypeLabel(item.feedbackType)}</Chip>
          <Chip>{Math.round(item.confidence * 100)}%</Chip>
        </span>
      </summary>
      <div className="practice-feedback-card-body">
        {item.canonical === undefined ? null : <CanonicalLifecycleLines item={item} efficacyRecords={efficacyRecords ?? []} />}
        <p><strong>Feedback quality:</strong> {materialExecutionUnproven ? "material execution not proven" : practiceFeedbackQualityLabel(item.feedbackQuality)}</p>
        <p><strong>Familiarity:</strong> {materialExecutionUnproven ? "no material execution is proven" : item.familiaritySignal}</p>
        <p><strong>Transfer clue:</strong> {materialExecutionUnproven ? "no transfer claim can be made before material execution is proven" : item.localTransferClue}</p>
        {materialExecutionUnproven ? (
          <p className="practice-feedback-evidence-line">Stored experiment, response, and efficacy history is withheld as physical-execution proof.</p>
        ) : (
          <>
            <ChipLine title="Repeated basis" items={item.repeatedExposureBasis} empty="no repeated basis is clear" />
            <ChipLine title="Blockers" items={item.blockers.map((entry) => entry.replace(/_/g, " "))} empty="no major blocker shown" />
            <ChipLine title="Risks" items={item.risks.map((entry) => entry.replace(/_/g, " "))} empty="no major risk shown" />
            <EvidenceLine evidence={item.evidence} />
          </>
        )}
        <div className="practice-feedback-card-note">
          {item.canonical === undefined
            ? "No skill or adaptation exists yet."
            : "This projection creates no additional skill or adaptation; any recorded response is shown above."}
        </div>
      </div>
    </details>
  );
}

function CanonicalLifecycleLines({
  item,
  efficacyRecords,
}: {
  readonly item: PracticeFeedbackReadinessItem;
  readonly efficacyRecords: readonly AdaptiveEfficacyRecord[];
}) {
  const canonical = item.canonical;
  if (canonical === undefined) return null;
  const materialUnproven = canonical.executionTruth === "blocked_material_execution";
  const matchingEfficacy = canonical.responseId === undefined
    ? []
    : efficacyRecords.filter((record) => record.responseId === canonical.responseId);
  return (
    <>
      <p><strong>Canonical idea:</strong> {canonical.ideaId} · {canonical.ideaStatus}</p>
      <p><strong>Planned experiment:</strong> {materialUnproven ? `${canonical.experimentId ?? "none"} · material execution not proven` : `${canonical.experimentId ?? "none"} · ${canonical.experimentStatus ?? "not recorded"} · attempts ${canonical.attemptSeasons}`}</p>
      <p><strong>Response state:</strong> {materialUnproven ? `${canonical.responseId ?? "none"} · material execution not proven` : `${canonical.responseId ?? "none"} · ${canonical.responseStatus ?? "not recorded"}`}</p>
      <p><strong>Efficacy records:</strong> {materialUnproven ? "withheld: material execution not proven." : matchingEfficacy.length === 0 ? "none" : matchingEfficacy.map((record) => `${record.id} · outcome ${record.outcome} (${record.outcome.replace(/_/g, " ")}) · classification ${record.classification}`).join(" | ")}</p>
      <p><strong>Execution truth:</strong> {materialUnproven ? "material execution not proven" : canonical.executionTruth.replace(/_/g, " ")}</p>
    </>
  );
}

function EvidenceChip({
  evidence,
}: {
  readonly evidence: PracticeFeedbackEvidenceRef;
}) {
  return (
    <span className={`practice-feedback-evidence-chip source-${evidence.sourceSystem}`}>
      {sourceLabel(evidence)}
    </span>
  );
}

function EvidenceLine({ evidence }: { readonly evidence: readonly PracticeFeedbackEvidenceRef[] }) {
  if (evidence.length === 0) {
    return <p className="practice-feedback-evidence-line">Evidence remains thin.</p>;
  }

  return (
    <div className="practice-feedback-evidence-line">
      {evidence.map((entry, index) => (
        <span key={`${entry.label}:${index}`}>{sourceLabel(entry)}</span>
      ))}
    </div>
  );
}

function ChipLine({
  title,
  items,
  empty,
}: {
  readonly title: string;
  readonly items: readonly string[];
  readonly empty: string;
}) {
  return (
    <div className="practice-feedback-chip-line">
      <span className="practice-feedback-basis-title">{title}</span>
      {items.length === 0 ? (
        <span className="practice-feedback-muted">{empty}</span>
      ) : (
        <span className="practice-feedback-chip-list">
          {items.slice(0, 4).map((item) => (
            <Chip key={item}>{item}</Chip>
          ))}
        </span>
      )}
    </div>
  );
}

function sourceLabel(evidence: PracticeFeedbackEvidenceRef): string {
  switch (evidence.sourceSystem) {
    case "problem_practice":
      return evidence.kind === "problem_frame" ? "problem frame" : "trial candidate";
    case "material_affordance":
      return "material basis";
    case "repetition_familiarity":
      return "repetition";
    case "knowledge_ecology":
      return "knowledge";
    case "canonical_event":
      return "event";
    case "activity_party":
      return "activity";
    case "camp_foothold":
    case "foothold_storage":
    case "foothold_fire":
    case "foothold_care":
      return "camp foothold";
    case "place_memory":
      return "place memory";
    case "route_memory":
      return "route memory";
    case "crossing_memory":
      return "crossing memory";
    case "demography":
      return "labor";
    case "band_identity":
      return "identity context";
  }
}
