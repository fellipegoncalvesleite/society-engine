// CORRECTION-21 continuation §13 — PLACE EVIDENCE READ MODEL.
//
// The epistemic distinctions this correction introduced are causal: a shallow traversal now
// writes materially different `KnownTileRecord` contents from a residential observation, and
// downstream readers behave differently as a result. §13 requires that any such distinction
// be visible in a selected-band projection rather than existing only inside audit JSON.
//
// STRICT PROJECTION CONTRACT:
//   - derives ONLY from canonical band state (`band.knowledge.observedTiles`);
//   - never reads `world.tiles` ecology, so it cannot leak hidden truth into the UI;
//   - never mutates and is never read by any decision path;
//   - distinguishes UNKNOWN (the band has no record of this domain) from LOW CONFIDENCE
//     (the band has a weak record), which are different epistemic states and must not
//     render identically;
//   - names the uses a record does and does not authorise, with the reason.
//
// It takes the world only for tile identity/coordinates so distances can be reported; it
// reads no resource, seasonal or hydrological truth from it.
import type { TileId } from "../core/types";
import {
  deriveDirectWaterAccess,
  describeReopeningConditions,
  findPlaceDisposition,
  findVerificationEvidence,
  mayAskAgain,
} from "./verificationEvidence";
import {
  VERIFICATION_ATTEMPT_HISTORY_CAP,
  VERIFICATION_MAX_DISTANCE_TILES,
  classifyPlaceForQuestion,
  describeVerificationGap,
  type PlaceEpistemicState,
} from "./frontierVerification";
import type { KnownTileRecord, KnowledgeAcquisitionKind } from "../knowledge/types";
import { getTile } from "../world/generate";
import type { WorldState } from "../world/types";
import { deriveKnownRetentionAuditView } from "./memoryCompression";
import type { Band, FrontierVerificationQuestion } from "./types";

/** How well a single evidence domain is established for one place. */
export type PlaceEvidenceStrength =
  // The band holds no record for this domain at all — distinct from "weak".
  | "unknown"
  // Seen in passing; a coarse impression only.
  | "glimpsed"
  // Physically established by being there.
  | "observed"
  // Established and corroborated by repeated experience.
  | "experienced";

export interface PlaceEvidenceDomain {
  readonly domain:
    | "terrain_existence"
    | "passability"
    | "water_presence"
    | "water_reliability"
    | "resource_presence"
    | "risk"
    | "seasonal_coverage"
    | "residential_adequacy";
  readonly strength: PlaceEvidenceStrength;
  /** What the band actually holds, in words. Never a hidden-truth number. */
  readonly basis: string;
}

export interface PlaceEvidenceEntry {
  readonly tileId: TileId;
  readonly distanceTiles?: number;
  readonly acquisition: KnowledgeAcquisitionKind;
  readonly provenance: string;
  readonly visits: number;
  readonly seasonsObserved: number;
  readonly generalConfidence: number;
  readonly domains: readonly PlaceEvidenceDomain[];
  /** Uses this record supports, and uses it explicitly does not. */
  readonly permittedUses: readonly string[];
  readonly blockedUses: readonly { readonly use: string; readonly reason: string }[];
  /** Whether better evidence has already upgraded this record. */
  readonly upgradedFromTraversal: boolean;
}

/**
 * CORRECTION-23 CONTINUATION §14 — the verification mechanism, in the selected-band panel.
 *
 * Before this, every causal verification state existed only in audit JSON, which §14 forbids.
 * Everything below derives from canonical BAND state (`frontierVerificationAttempts`,
 * `expeditions`, `knowledge.observedTiles`) and the production classifier — no world ecology.
 */
export interface PlaceVerificationTarget {
  readonly tileId: TileId;
  readonly distanceTiles?: number;
  readonly question: FrontierVerificationQuestion;
  /** Why the band's own record makes this look worth a second visit. */
  readonly promisingSignal: string;
  /** The specific evidence the band does not have. */
  readonly missingEvidence: string;
  readonly state: PlaceEpistemicState;
  /** Present when the place is NOT a candidate, saying which gate stopped it. */
  readonly blockedReason?: string;
}

export interface PlaceVerificationParty {
  readonly tileId: TileId;
  readonly question: FrontierVerificationQuestion;
  readonly phase: string;
  readonly routeTiles: number;
  readonly onSiteBudgetDays: number;
  readonly workDaysElapsed: number;
  readonly selectionReason: string;
  readonly attemptIndex: number;
}

export interface PlaceVerificationAttemptView {
  readonly tileId: TileId;
  readonly question: FrontierVerificationQuestion;
  readonly outcome: "confirmed" | "negative" | "inconclusive" | "lost";
  readonly season: string;
  /** What this answer now permits the band to do that it could not before. */
  readonly nowPermitted: string;
  /** What is still not established about this place. */
  readonly stillMissing: string;
  /**
   * CORRECTION-23B §17 — which production decision consumes this answer, or an explicit
   * statement that none does yet. An answer no reader consumes must SAY so rather than
   * appearing to matter.
   */
  readonly consumedBy: string;
  /** Whether this answer currently enables a next action at all. */
  readonly behaviourallyActionable: boolean;
  /** §17 — why the band will not go back and ask this again. */
  readonly repeatBlockedReason?: string;
  /** CORRECTION-23D §17 — what material change could reopen this question. */
  readonly mayReopenOn: string;
  /** §17 — the authoritative conclusion survives even when the display ring drops the row. */
  readonly settled: boolean;
  readonly stillInRecentHistory: boolean;
  /** Seasons this exact question has actually been answered in at this place. */
  readonly seasonsAnswered: readonly string[];
}

/**
 * CORRECTION-23C §13 — water stated as three separate facts, because they ARE three separate
 * facts. CORRECTION-23B rendered a confirmed access as a reliability number, which is exactly
 * the conflation this correction removes. The panel must never show
 * "Water reliability: 0.55" because a party once drew water.
 */
export interface PlaceWaterEvidenceView {
  readonly tileId: TileId;
  readonly distanceTiles?: number;
  /** What the band saw. Presence is an observation, not an access claim. */
  readonly presence: "unknown" | "none observed" | "observed";
  /** What a party physically established, and in which season. */
  readonly physicalAccess: string;
  /** Deliberately qualitative: the band has no reliability measurement to show. */
  readonly reliability: string;
  readonly otherSeasons: string;
  /** What the answer does to a destination decision, in the narrowest true terms. */
  readonly destinationEffect: string;
}

/**
 * CORRECTION-23H §13 — DECISION-RELEVANCE VISIBILITY.
 *
 * The diagnostic asks a question nothing in the UI could previously answer: for a place the
 * band is about to send a party to, WHICH DECISION is currently blocked, and would either
 * possible answer actually unblock it? A question whose possible answers all lead to the same
 * decision has no current decision value however promising the place looks.
 *
 * Every field is derived from canonical band state through the SAME production readers the
 * decision itself uses. Nothing here reads world truth, and nothing here is an authority: it is
 * a statement about what the readers would say, shown before a party is committed.
 */
export interface PlaceDecisionRelevanceView {
  readonly tileId: TileId;
  readonly distanceTiles?: number;
  readonly question: FrontierVerificationQuestion;
  /** Plain-language statement of the question the party would go and settle. */
  readonly questionText: string;
  /** The decision that is currently blocked or open, in the terms the reader uses. */
  readonly currentBlocker: string;
  /** What a confirmed answer would do to that decision. */
  readonly ifConfirmed: string;
  /** What a negative answer would do to it. */
  readonly ifNegative: string;
  /** Explicitly stated because CORRECTION-23C separated the two and they must stay separated. */
  readonly rankingEffect: "unchanged" | "changes";
  readonly changesEligibility: boolean;
  readonly changesSelectedAction: boolean;
  /** The §6 relevance class, in the vocabulary the audit uses. */
  readonly classification:
    | "immediate_action_relevant"
    | "eligibility_relevant"
    | "ranking_relevant_only"
    | "future_system_evidence"
    | "redundant"
    | "inert";
  /** The physical task the answer would make legal, or the reader that is missing. */
  readonly nextPhysicalActionEnabled?: string;
  readonly missingReader?: string;
}

export interface PlaceVerificationProjection {
  /** §13 — presence / access / reliability / seasons, stated separately. */
  readonly water: readonly PlaceWaterEvidenceView[];
  /**
   * CORRECTION-23H §13 — for each place the band would verify: is the answer capable of
   * changing anything it is currently deciding?
   */
  readonly decisionRelevance: readonly PlaceDecisionRelevanceView[];
  /**
   * CORRECTION-23D §17 — conclusions the band still holds whose chronological row has aged
   * out of the display ring. Their presence here is the visible proof that eviction from a
   * capped list is not forgetting.
   */
  readonly retainedBeyondHistory: readonly PlaceVerificationAttemptView[];
  /** Places the band's own record marks promising for a question it has not answered. */
  readonly promisingUnverified: readonly PlaceVerificationTarget[];
  /** Places the band's own record marks as poor — a reason NOT to go. */
  readonly knownPoor: readonly PlaceVerificationTarget[];
  readonly activeParties: readonly PlaceVerificationParty[];
  readonly answered: readonly PlaceVerificationAttemptView[];
  readonly failedOrInconclusive: readonly PlaceVerificationAttemptView[];
  readonly attemptHistoryCap: number;
  readonly noHiddenTruthRead: true;
  readonly projectionOnly: true;
}

/**
 * CORRECTION-23E §17 — DEBUG-ONLY RETENTION VISIBILITY.
 *
 * The diagnostic found that a place record is forgotten wholesale on a capacity rule whose
 * ranking never actually executes (the mandatory set is ~161% of the 72-record capacity), and
 * that a settled verification conclusion disappears with the place that carries it. None of
 * that was visible anywhere. These rows make it visible, read-only, derived entirely from
 * canonical band knowledge and the production scorer — no hidden tile truth, no new authority.
 */
export interface PlaceRetentionView {
  readonly tileId: TileId;
  readonly distanceTiles?: number;
  /** The production retention score, from `memoryCompression`'s own scorer. */
  readonly salience: number;
  /** Rank by that score among this band's known places (1 = most salient). */
  readonly retentionPriorityRank: number;
  /** Kept unconditionally — the local ring, a crossing, important water, or a valenced place. */
  readonly mandatory: boolean;
  /** Whether the next compression would keep it. */
  readonly wouldBeRetained: boolean;
  /** Why it would be dropped, in the terms the algorithm actually uses. */
  readonly evictionReason?: string;
  /** Which evidence classes this record carries. */
  readonly evidenceClasses: readonly string[];
  readonly activeRoute: boolean;
  readonly currentCandidate: boolean;
  /** Seasons since the band last observed it. */
  readonly seasonsSinceLastUse: number;
  /** §17 — a settled conclusion is lost with the record; say so before it happens. */
  readonly dispositionWillDisappearWithRecord: boolean;
  readonly settledQuestionsHeld: readonly string[];
}

export interface PlaceRetentionProjection {
  readonly capacity: number;
  readonly knownPlaces: number;
  readonly mandatoryPlaces: number;
  /** Above 100% the scored ranking cannot retain anything — the kept set IS the mandatory set. */
  readonly mandatoryShareOfCapacityPercent: number;
  readonly overCapacity: boolean;
  readonly compressionRunsThisTick: boolean;
  readonly scoredRankingHasEffect: boolean;
  /** Bounded sample: the places closest to being forgotten. */
  readonly atRisk: readonly PlaceRetentionView[];
  readonly settledConclusionsAtRisk: number;
  readonly noHiddenTruthRead: true;
  readonly projectionOnly: true;
}

export interface PlaceEvidenceProjection {
  readonly totalKnownPlaces: number;
  readonly byAcquisition: Readonly<Record<string, number>>;
  readonly shallowTraversalPlaces: number;
  readonly residentiallyKnownPlaces: number;
  /** Bounded sample, farthest-first, so frontier country is what the panel shows. */
  readonly entries: readonly PlaceEvidenceEntry[];
  readonly verification: PlaceVerificationProjection;
  /** CORRECTION-23E §17 — what this band is about to forget, and why. */
  readonly retention: PlaceRetentionProjection;
  readonly noHiddenTruthRead: true;
  readonly projectionOnly: true;
}

const MAX_ENTRIES = 24;
const MAX_VERIFICATION_ROWS = 12;
const MAX_RETENTION_ROWS = 12;
const ALL_SEASONS = ["spring", "summer", "autumn", "winter"] as const;

/** What each answer establishes, and what it still leaves open. §4's semantic contract. */
const QUESTION_MEANING: Readonly<
  Record<FrontierVerificationQuestion, { readonly permits: string; readonly stillMissing: string }>
> = {
  water_access: {
    permits: "water can be reached and drawn here, on the day the party stood there",
    stillMissing: "whether it is dependable across seasons, and its quality",
  },
  resource_presence: {
    permits: "food resources were found in the bounded area actually searched",
    stillMissing: "how much there is, and whether it can be taken",
  },
  resource_test_possible: {
    permits: "a real, stock-backed attempt is worth making here",
    stillMissing: "the take itself — no stock has been drawn against and no food taken",
  },
  temporary_use: {
    permits: "a small party stayed and worked here for a short period",
    stillMissing: "whether the whole band could live here",
  },
  seasonal_persistence: {
    permits: "one more season of coverage",
    stillMissing: "the seasons still unvisited",
  },
};

/**
 * CORRECTION-23B §17 — the production decision each answer actually reaches, in plain words.
 * `undefined` means NOTHING reads it yet, and the panel says exactly that rather than
 * implying an effect the simulation does not have.
 */
const QUESTION_CONSUMER: Readonly<Record<FrontierVerificationQuestion, string | undefined>> = {
  water_access: "whether this place can be considered as somewhere to move to",
  resource_presence: "whether a real, stock-backed test here is worth attempting",
  resource_test_possible: undefined,
  temporary_use: "whether a party may set up a bounded working camp here",
  seasonal_persistence: undefined,
};

/**
 * CORRECTION-23H §13 — what each question actually asks, and what each answer does to the
 * decision that reads it. These strings are descriptions of measured reader behaviour, not
 * claims about the world: every one of them was checked by the H1..H12 fixtures.
 */
function deriveDecisionRelevance(
  band: Band,
  target: PlaceVerificationTarget,
): PlaceDecisionRelevanceView {
  const base = {
    tileId: target.tileId,
    ...(target.distanceTiles === undefined ? {} : { distanceTiles: target.distanceTiles }),
    question: target.question,
    rankingEffect: "unchanged" as const,
  };

  switch (target.question) {
    case "water_access": {
      const record = band.knowledge.observedTiles[target.tileId];
      const observed = record?.observedWaterAccess ?? 0;
      // The gate the answer feeds. Reproduced here from the band's own record only — the same
      // inputs `isWaterAccessFeasible` consumes, so the statement matches the reader.
      const alreadyPasses = observed > WATER_ACCESS_PROJECTION_THRESHOLD;
      const settled = findVerificationEvidence(band, target.tileId, "water_access");

      if (settled?.outcome === "confirmed" || settled?.outcome === "negative") {
        return {
          ...base,
          questionText: "Is water physically accessible here?",
          currentBlocker: "already settled — the band has been and found out",
          ifConfirmed: "no change; the answer is already held",
          ifNegative: "no change; the answer is already held",
          changesEligibility: false,
          changesSelectedAction: false,
          classification: "redundant",
        };
      }

      // CORRECTION-23I §6.2 — a launch now requires this place to BE the candidate the
      // destination authority is working with, and water to be the binding blocker (Case A) or
      // the selection to be imminent and resting on coarse observation alone (Case B).
      const opportunity = band.carryingCapacity?.knownUnusedHabitat;
      const isSelectedCandidate =
        opportunity !== undefined && String(opportunity.candidateTileId) === String(target.tileId);
      const caseA = isSelectedCandidate && opportunity?.waterAccessIsBindingBlocker === true;
      const caseB = isSelectedCandidate && opportunity?.consideredAsTarget === true;

      return {
        ...base,
        questionText: "Is water physically accessible here?",
        currentBlocker: caseA
          ? "the destination is rejected for water and nothing else is failing"
          : caseB
            ? "the destination is selected on coarse observed water alone"
            : alreadyPasses
              ? "nothing — and this place is not the candidate under consideration, so no party is sent"
              : "insufficient access evidence, but this place is not the candidate under consideration",
        ifConfirmed: alreadyPasses
          ? "no change — the gate was already open"
          : "the destination becomes eligible to be considered",
        ifNegative: "the destination is blocked for water, within the area actually searched",
        changesEligibility: caseA || caseB,
        // Case A is the one place a water answer reaches the SELECTED destination: every other
        // conjunct of `consideredAsTarget` already passes, so the gate flip decides it.
        changesSelectedAction: caseA,
        classification: caseA
          ? "immediate_action_relevant"
          : caseB
            ? "eligibility_relevant"
            : "inert",
        nextPhysicalActionEnabled: caseA
          ? "this place becomes an eligible destination"
          : caseB
            ? "the band commits to this destination on direct rather than coarse evidence"
            : "none — no party is launched for this place",
      };
    }

    case "resource_presence": {
      return {
        ...base,
        questionText: "Is there food here at all, in the area a party can search?",
        currentBlocker: "SUSPENDED — no party is sent to establish this",
        ifConfirmed: "the harder resource question would become askable, and nothing reads its answer",
        ifNegative: "the same bounded test would be suppressed here, and only here",
        changesEligibility: false,
        changesSelectedAction: false,
        classification: "future_system_evidence",
        missingReader:
          "CORRECTION-23I §8.1 — suspended. The only consumer is the verification selector's own " +
          "resource_test_possible gate, and no physical resource task reads that question's answer. " +
          "The stock-backed activity that would give this a reader belongs to the next roadmap item",
      };
    }

    case "resource_test_possible": {
      return {
        ...base,
        questionText: "Is a real take here worth attempting?",
        currentBlocker: "SUSPENDED — no party is sent to establish this",
        ifConfirmed: "nothing changes",
        ifNegative: "nothing changes",
        changesEligibility: false,
        changesSelectedAction: false,
        classification: "future_system_evidence",
        missingReader:
          "CORRECTION-23I §8.2 — suspended. No production reader exists: the stock-backed " +
          "activity that would resolve a real patch at an arbitrary tile and return a canonical " +
          "receipt has not been built",
      };
    }

    case "temporary_use": {
      const settled = findVerificationEvidence(band, target.tileId, "temporary_use");

      return {
        ...base,
        questionText: "Can a small party stay and work here?",
        currentBlocker:
          settled?.outcome === "negative"
            ? "a party already tried to stay here and could not"
            : "nothing — a bounded camp here is already permitted",
        ifConfirmed: "no change; absence of evidence already permits the camp",
        ifNegative: "a bounded working camp here is refused",
        changesEligibility: true,
        changesSelectedAction: false,
        classification: settled === undefined ? "eligibility_relevant" : "redundant",
        nextPhysicalActionEnabled: "setting up a bounded working camp",
        missingReader:
          "asymmetric reader: only a NEGATIVE answer changes anything; the positive branch " +
          "carries no decision value",
      };
    }

    case "seasonal_persistence": {
      return {
        ...base,
        questionText: "Does this place stay productive across seasons?",
        currentBlocker: "SUSPENDED — no party is sent to establish this",
        ifConfirmed: "nothing changes",
        ifNegative: "nothing changes",
        changesEligibility: false,
        changesSelectedAction: false,
        classification: "future_system_evidence",
        missingReader:
          "CORRECTION-23I §8.3 — suspended. No behavioural reader exists and the physical task " +
          "returns inconclusive by construction; the seasonal-scheduling system that would " +
          "consume it has not been built, and inventing a premature consumer was rejected",
      };
    }
  }
}

/**
 * The observed-water level the access gate uses, mirrored for the projection. It must track
 * `carryingCapacity.WATER_ACCESS_OBSERVED_THRESHOLD`; the projection imports nothing from that
 * module to keep the read-model direction clean, and the H11 fixture asserts they agree.
 */
const WATER_ACCESS_PROJECTION_THRESHOLD = 0.32;

/** Audit accessor for the mirror above, so the H11 fixture can assert the two agree. */
export const WATER_ACCESS_PROJECTION_THRESHOLD_FOR_AUDIT = WATER_ACCESS_PROJECTION_THRESHOLD;

const PROVENANCE_LABEL: Readonly<Record<string, string>> = {
  residential_observation: "lived in or worked from",
  returned_frontier_exploration: "walked through by an exploring party",
  returned_route_reconnaissance: "walked through on a route reading",
  inherited_memory: "inherited from the parent band",
  reported_or_inferred: "reported or inferred, never seen",
};

function isShallow(acquisition: KnowledgeAcquisitionKind | undefined): boolean {
  return (
    acquisition === "returned_frontier_exploration" ||
    acquisition === "returned_route_reconnaissance"
  );
}

function strengthFromVisits(visits: number, shallow: boolean): PlaceEvidenceStrength {
  if (shallow) {
    return visits >= 3 ? "observed" : "glimpsed";
  }

  return visits >= 4 ? "experienced" : "observed";
}

function describeDomains(record: KnownTileRecord): readonly PlaceEvidenceDomain[] {
  const shallow = isShallow(record.acquisition);
  const visits = record.visits ?? 0;
  const base = strengthFromVisits(visits, shallow);
  const seasons = record.seasonsObserved?.length ?? 0;

  return [
    {
      domain: "terrain_existence",
      strength: base === "glimpsed" ? "observed" : base,
      basis: "the band has physically been here",
    },
    {
      domain: "passability",
      strength: record.observedMovementCost === undefined ? "unknown" : base === "glimpsed" ? "observed" : base,
      basis:
        record.observedMovementCost === undefined
          ? "no crossing recorded"
          : "walked; the going is known from experience",
    },
    {
      domain: "water_presence",
      strength: record.observedWaterAccess === undefined ? "unknown" : shallow ? "glimpsed" : base,
      basis:
        record.observedWaterAccess === undefined
          ? "no water observation"
          : shallow
            ? "water seen in passing; a coarse impression only"
            : "water observed from use of this place",
    },
    {
      domain: "water_reliability",
      // Reliability is NEVER established by traversal — it needs repeated seasons.
      strength: shallow || seasons < 2 ? "unknown" : seasons >= 3 ? "experienced" : "observed",
      basis:
        shallow || seasons < 2
          ? "not established — reliability needs repeated seasonal experience"
          : `observed across ${seasons} seasons`,
    },
    {
      domain: "resource_presence",
      strength: record.observedRichness === undefined ? "unknown" : shallow ? "glimpsed" : base,
      basis: shallow
        ? "broad impression of how lush the country looked in passing"
        : "productivity known from working this place",
    },
    {
      domain: "risk",
      strength: record.observedRisk === undefined ? "unknown" : shallow ? "glimpsed" : base,
      basis: shallow
        ? "terrain hazard visible on one crossing; an uneventful passage is not proof of safety"
        : "hazard known from repeated presence",
    },
    {
      domain: "seasonal_coverage",
      strength:
        record.observedSeasonalPattern === undefined ? "unknown" : seasons >= 3 ? "experienced" : "observed",
      basis:
        record.observedSeasonalPattern === undefined
          ? "no seasonal knowledge — the place has only been crossed"
          : `seasonal pattern held from ${seasons} observed season(s)`,
    },
    {
      domain: "residential_adequacy",
      strength: shallow ? "unknown" : base,
      basis: shallow
        ? "not established — passing through is not living here"
        : "the band has camped or dwelt here",
    },
  ];
}

function describeUses(record: KnownTileRecord): {
  readonly permitted: readonly string[];
  readonly blocked: readonly { readonly use: string; readonly reason: string }[];
} {
  const shallow = isShallow(record.acquisition);

  if (!shallow) {
    return {
      permitted: [
        "route planning",
        "resource expectation",
        "water planning",
        "camp and anchor choice",
        "seasonal planning",
        "daughter destination evaluation",
      ],
      blocked: [],
    };
  }

  return {
    permitted: [
      "route planning and further exploration",
      "knowing this country exists and roughly what it looks like",
    ],
    blocked: [
      { use: "confident resource exploitation", reason: "no resource was tested or harvested here" },
      { use: "water reliability planning", reason: "water was seen, not used across seasons" },
      { use: "seasonal planning", reason: "the place was crossed in one season only" },
      { use: "camp or residential anchoring", reason: "passing through is not residential experience" },
    ],
  };
}

const VERIFICATION_QUESTIONS: readonly FrontierVerificationQuestion[] = [
  "water_access",
  "resource_presence",
  "resource_test_possible",
  "temporary_use",
  "seasonal_persistence",
];

/**
 * CORRECTION-23 CONTINUATION §14 — the verification mechanism as the band itself holds it.
 *
 * Reads band state and the production classifier ONLY. It reports the same distance and
 * eligibility gates the selector applies, so a place the panel calls blocked is blocked for
 * the reason shown — not for a reason invented by the read model.
 */
function deriveVerificationProjection(
  world: WorldState,
  band: Band,
  distanceOf: (tileId: TileId) => number | undefined,
): PlaceVerificationProjection {
  const attempts = band.frontierVerificationAttempts ?? [];
  const currentTick = Number(world.time.tick);
  const currentSeason = world.time.season;
  const records = Object.values(band.knowledge.observedTiles);
  const promising: PlaceVerificationTarget[] = [];
  const poor: PlaceVerificationTarget[] = [];

  for (const record of records) {
    if (record.tileId === band.position) {
      continue;
    }

    const distance = distanceOf(record.tileId);

    for (const question of VERIFICATION_QUESTIONS) {
      const state = classifyPlaceForQuestion(record, question, attempts);

      if (state === "known_poor") {
        poor.push({
          tileId: record.tileId,
          ...(distance === undefined ? {} : { distanceTiles: distance }),
          question,
          promisingSignal: "the band's own record of this place is poor",
          missingEvidence: "nothing — this is evidence, not ignorance",
          state,
          blockedReason: "the band has looked and what it saw was bad; that is a reason not to go",
        });
        continue;
      }

      if (state !== "promising_unverified") {
        continue;
      }

      const gap = describeVerificationGap(record, question);
      const blockedReason =
        gap === undefined
          ? "the signal is too weak to justify the walk"
          : distance === undefined
            ? undefined
            : distance < 3
              ? "inside the working range already"
              : distance > VERIFICATION_MAX_DISTANCE_TILES
                ? "too far to verify — this is an exploration problem"
                : undefined;

      promising.push({
        tileId: record.tileId,
        ...(distance === undefined ? {} : { distanceTiles: distance }),
        question,
        promisingSignal: gap?.promisingSignal ?? "seen in passing",
        missingEvidence: gap?.missingEvidence ?? QUESTION_MEANING[question].stillMissing,
        state,
        ...(blockedReason === undefined ? {} : { blockedReason }),
      });
    }
  }

  const byDistance = (
    left: { readonly distanceTiles?: number; readonly tileId: TileId },
    right: { readonly distanceTiles?: number; readonly tileId: TileId },
  ): number =>
    (left.distanceTiles ?? 0) === (right.distanceTiles ?? 0)
      ? String(left.tileId).localeCompare(String(right.tileId))
      : (left.distanceTiles ?? 0) - (right.distanceTiles ?? 0);

  const activeParties = (band.expeditions ?? [])
    .filter((expedition) => expedition.taskKind === "frontier_verification")
    .map((expedition): PlaceVerificationParty | undefined => {
      const plan = expedition.verificationPlan;

      return plan === undefined
        ? undefined
        : {
            tileId: plan.targetTileId,
            question: plan.question,
            phase: expedition.phase,
            routeTiles: expedition.routeTileIds.length,
            onSiteBudgetDays: plan.onSiteBudgetDays,
            workDaysElapsed: expedition.workDaysElapsed,
            selectionReason: plan.selectionReason,
            attemptIndex: plan.attemptIndex,
          };
    })
    .filter((party): party is PlaceVerificationParty => party !== undefined);

  const asView = (attempt: (typeof attempts)[number]): PlaceVerificationAttemptView => {
    const consumer = QUESTION_CONSUMER[attempt.question];
    const evidence = findVerificationEvidence(band, attempt.tileId, attempt.question);
    const durable = findPlaceDisposition(band, attempt.tileId, attempt.question);
    const settled = attempt.outcome === "confirmed" || attempt.outcome === "negative";
    const retry =
      evidence === undefined
        ? undefined
        : mayAskAgain(band, attempt.tileId, attempt.question, {
            currentTick,
            currentSeason,
            hardship: evidence.hardshipAtLastAttempt,
            routeTiles: evidence.routeTilesAtLastAttempt,
          });

    return {
      tileId: attempt.tileId,
      question: attempt.question,
      outcome: attempt.outcome,
      season: attempt.season,
      nowPermitted:
        attempt.outcome === "confirmed"
          ? QUESTION_MEANING[attempt.question].permits
          : attempt.outcome === "negative"
            ? "nothing — the band learned this place does not answer that question"
            : "nothing yet — the question is still open",
      stillMissing: QUESTION_MEANING[attempt.question].stillMissing,
      consumedBy:
        consumer ??
        "nothing yet — this answer is recorded but no decision reads it, because the system that would does not exist",
      behaviourallyActionable: consumer !== undefined && settled,
      ...(retry === undefined || retry.allowed ? {} : { repeatBlockedReason: retry.reason }),
      mayReopenOn: describeReopeningConditions(
        attempt.question,
        attempt.outcome === "lost" ? "inconclusive" : attempt.outcome,
      ),
      settled: settled && durable !== undefined,
      stillInRecentHistory: true,
      seasonsAnswered: evidence?.seasonsAnswered ?? [attempt.season],
    };
  };

  // §13 — one row per place the band has a water answer or a water observation for.
  const water: PlaceWaterEvidenceView[] = [];

  for (const record of records) {
    const direct = deriveDirectWaterAccess(band, record.tileId);
    const observed = record.observedWaterAccess;

    if (direct.state === "unasked" && observed === undefined) {
      continue;
    }

    const distance = distanceOf(record.tileId);
    const seasons = direct.seasonsObserved;
    const unobserved = ALL_SEASONS.filter((season) => !seasons.includes(season));

    water.push({
      tileId: record.tileId,
      ...(distance === undefined ? {} : { distanceTiles: distance }),
      presence:
        observed === undefined ? "unknown" : observed < 0.12 ? "none observed" : "observed",
      physicalAccess:
        direct.state === "accessed"
          ? `confirmed in ${String(direct.season)}`
          : direct.state === "refuted"
            ? direct.failureKind === "absent_in_bounded_search"
              ? `nothing reachable in the area searched, in ${String(direct.season)}`
              : `the way there failed, in ${String(direct.season)}`
            : direct.state === "inconclusive"
              ? "attempted, settled nothing"
              : "never attempted",
      // No number. The band holds no reliability measurement, and saying "0.55" would be
      // inventing one out of a single access event.
      reliability:
        seasons.length >= 3
          ? "supported by evidence in most seasons"
          : direct.state === "accessed"
            ? "uncertain — reaching water once says nothing about how dependable it is"
            : "uncertain",
      otherSeasons:
        unobserved.length === 0 ? "all seasons observed" : `unobserved: ${unobserved.join(", ")}`,
      destinationEffect:
        direct.state === "accessed"
          ? "physical-access requirement satisfied; ranking unchanged"
          : direct.state === "refuted" && direct.failureKind === "absent_in_bounded_search"
            ? "physical-access requirement not satisfied here"
            : "no effect — the destination gate still reads what the band observed",
    });
  }

  // CORRECTION-23D §17 — conclusions the band still HOLDS but whose chronological row has
  // aged out of the 12-entry display ring. Without this the panel would imply the band had
  // forgotten something it has not forgotten — the exact confusion this correction removes.
  const retainedBeyondHistory: PlaceVerificationAttemptView[] = [];

  for (const record of records) {
    for (const entry of record.verificationDisposition ?? []) {
      const inHistory = attempts.some(
        (a) => a.tileId === record.tileId && a.question === entry.question,
      );

      if (inHistory) {
        continue;
      }

      const retry = mayAskAgain(band, record.tileId, entry.question, {
        currentTick,
        currentSeason,
        hardship: 0,
        routeTiles: entry.routeTilesAtLastAttempt,
      });

      retainedBeyondHistory.push({
        tileId: record.tileId,
        question: entry.question,
        outcome: entry.outcome,
        season: entry.lastSeason,
        nowPermitted:
          entry.outcome === "confirmed"
            ? QUESTION_MEANING[entry.question].permits
            : entry.outcome === "negative"
              ? "nothing — the band learned this place does not answer that question"
              : "nothing yet — the question is still open",
        stillMissing: QUESTION_MEANING[entry.question].stillMissing,
        consumedBy:
          QUESTION_CONSUMER[entry.question] ??
          "nothing yet — this answer is recorded but no decision reads it, because the system that would does not exist",
        behaviourallyActionable:
          QUESTION_CONSUMER[entry.question] !== undefined && entry.outcome !== "inconclusive",
        ...(retry.allowed ? {} : { repeatBlockedReason: retry.reason }),
        mayReopenOn: describeReopeningConditions(entry.question, entry.outcome),
        settled: !retry.allowed,
        // The point of this list: the row left the recent-history display, and the
        // authoritative result was retained anyway.
        stillInRecentHistory: false,
        seasonsAnswered: entry.seasonsAnswered,
      });
    }
  }

  // CORRECTION-23H §13 — the decision-relevance rows, computed for exactly the places the band
  // would send a party to. Each one asks the REAL reader what it says now and what it would say
  // under each legal answer, so the panel states decision value rather than implying it.
  const decisionRelevance: PlaceDecisionRelevanceView[] = [];

  for (const target of [...promising].sort(byDistance).slice(0, MAX_VERIFICATION_ROWS)) {
    decisionRelevance.push(deriveDecisionRelevance(band, target));
  }

  return {
    water: [...water].sort(byDistance).slice(0, MAX_VERIFICATION_ROWS),
    decisionRelevance,
    retainedBeyondHistory: retainedBeyondHistory.slice(0, MAX_VERIFICATION_ROWS),
    promisingUnverified: [...promising].sort(byDistance).slice(0, MAX_VERIFICATION_ROWS),
    knownPoor: [...poor].sort(byDistance).slice(0, MAX_VERIFICATION_ROWS),
    activeParties,
    answered: attempts.filter((a) => a.outcome === "confirmed").slice(-MAX_VERIFICATION_ROWS).map(asView),
    failedOrInconclusive: attempts
      .filter((a) => a.outcome !== "confirmed")
      .slice(-MAX_VERIFICATION_ROWS)
      .map(asView),
    attemptHistoryCap: VERIFICATION_ATTEMPT_HISTORY_CAP,
    noHiddenTruthRead: true,
    projectionOnly: true,
  };
}

/**
 * CORRECTION-23E §17 — what this band is about to forget, and why.
 *
 * Everything here comes from `deriveKnownRetentionAuditView`, which runs the SAME scorer and
 * the SAME mandatory predicate `compressBandMemoryState` uses. Nothing is recomputed here, so
 * the panel cannot drift from the algorithm it describes.
 */
function deriveRetentionProjection(
  world: WorldState,
  band: Band,
  distanceOf: (tileId: TileId) => number | undefined,
): PlaceRetentionProjection {
  const view = deriveKnownRetentionAuditView(world, band);
  const records = band.knowledge.observedTiles;
  const activeRouteTiles = new Set<TileId>(
    (band.expeditions ?? []).flatMap((expedition) => expedition.routeTileIds ?? []),
  );
  const candidateTileId = band.carryingCapacity?.knownUnusedHabitat?.candidateTileId;
  const mandatoryShare = Math.round((view.mandatoryCount / Math.max(1, view.capacity)) * 1000) / 10;

  const rows = view.rows
    .filter((row) => !row.retained || !row.mandatory)
    .sort((left, right) => left.score - right.score)
    .slice(0, MAX_RETENTION_ROWS)
    .map((row): PlaceRetentionView => {
      const record = records[row.tileId];
      const disposition = record?.verificationDisposition ?? [];
      const settled = disposition.filter(
        (entry) => entry.outcome === "confirmed" || entry.outcome === "negative",
      );
      const distance = distanceOf(row.tileId);
      const classes: string[] = [];

      if (disposition.length > 0) classes.push("verified");
      if (record?.acquisition === "returned_frontier_exploration") classes.push("walked past once");
      if (record?.acquisition === "residential_observation") classes.push("lived around");
      if ((record?.visits ?? 0) <= 1 && disposition.length === 0) classes.push("crossed once");

      return {
        tileId: row.tileId,
        ...(distance === undefined ? {} : { distanceTiles: distance }),
        salience: row.score,
        retentionPriorityRank: row.rank,
        mandatory: row.mandatory,
        wouldBeRetained: row.retained,
        ...(row.retained
          ? {}
          : {
              evictionReason:
                mandatoryShare >= 100
                  ? "the places kept unconditionally already fill the whole memory, so nothing else is kept whatever it is worth"
                  : "ranked below the memory limit",
            }),
        evidenceClasses: classes,
        activeRoute: activeRouteTiles.has(row.tileId),
        currentCandidate: candidateTileId === row.tileId,
        seasonsSinceLastUse: row.ticksSinceLastObserved,
        dispositionWillDisappearWithRecord: !row.retained && disposition.length > 0,
        settledQuestionsHeld: settled.map((entry) => entry.question),
      };
    });

  return {
    capacity: view.capacity,
    knownPlaces: view.knownCount,
    mandatoryPlaces: view.mandatoryCount,
    mandatoryShareOfCapacityPercent: mandatoryShare,
    overCapacity: view.knownCount > view.capacity,
    compressionRunsThisTick: view.compressionWouldRun,
    // Above 100% every retained slot is spent before a scored record is considered, so the
    // salience ranking cannot change what is kept.
    scoredRankingHasEffect: mandatoryShare < 100,
    atRisk: rows,
    settledConclusionsAtRisk: rows.filter((row) => row.dispositionWillDisappearWithRecord).length,
    noHiddenTruthRead: true,
    projectionOnly: true,
  };
}

/**
 * Build the selected-band place-evidence projection. Pure, bounded, and behaviourally inert.
 */
export function derivePlaceEvidenceProjection(
  world: WorldState,
  band: Band,
): PlaceEvidenceProjection {
  const records = Object.values(band.knowledge.observedTiles);
  const here = getTile(world, band.position);
  const byAcquisition: Record<string, number> = {};
  let shallowCount = 0;
  let residentialCount = 0;

  for (const record of records) {
    const key = String(record.acquisition ?? "unspecified");
    byAcquisition[key] = (byAcquisition[key] ?? 0) + 1;

    if (isShallow(record.acquisition)) {
      shallowCount += 1;
    } else if (record.acquisition === "residential_observation") {
      residentialCount += 1;
    }
  }

  const distanceOf = (tileId: TileId): number | undefined => {
    const tile = getTile(world, tileId);

    return tile === undefined || here === undefined
      ? undefined
      : Math.abs(tile.coord.x - here.coord.x) + Math.abs(tile.coord.y - here.coord.y);
  };

  // Farthest-first: the interesting rows are the frontier ones, and the panel is bounded.
  const entries = [...records]
    .sort((left, right) => {
      const dl = distanceOf(left.tileId) ?? 0;
      const dr = distanceOf(right.tileId) ?? 0;

      return dr === dl ? String(left.tileId).localeCompare(String(right.tileId)) : dr - dl;
    })
    .slice(0, MAX_ENTRIES)
    .map((record): PlaceEvidenceEntry => {
      const uses = describeUses(record);
      const distance = distanceOf(record.tileId);

      return {
        tileId: record.tileId,
        ...(distance === undefined ? {} : { distanceTiles: distance }),
        acquisition: record.acquisition ?? "residential_observation",
        provenance: PROVENANCE_LABEL[String(record.acquisition)] ?? String(record.acquisition),
        visits: record.visits ?? 0,
        seasonsObserved: record.seasonsObserved?.length ?? 0,
        generalConfidence: record.confidence,
        domains: describeDomains(record),
        permittedUses: uses.permitted,
        blockedUses: uses.blocked,
        // A record that is residentially acquired but was first reached by a party carries
        // the upgrade; the writer's provenance rule keeps residential once earned.
        upgradedFromTraversal:
          record.acquisition === "residential_observation" && (record.visits ?? 0) > 1,
      };
    });

  return {
    totalKnownPlaces: records.length,
    byAcquisition,
    shallowTraversalPlaces: shallowCount,
    residentiallyKnownPlaces: residentialCount,
    entries,
    verification: deriveVerificationProjection(world, band, distanceOf),
    retention: deriveRetentionProjection(world, band, distanceOf),
    noHiddenTruthRead: true,
    projectionOnly: true,
  };
}
