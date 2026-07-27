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
import { findVerificationEvidence, mayAskAgain } from "./verificationEvidence";
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
  /** Seasons this exact question has actually been answered in at this place. */
  readonly seasonsAnswered: readonly string[];
}

export interface PlaceVerificationProjection {
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

export interface PlaceEvidenceProjection {
  readonly totalKnownPlaces: number;
  readonly byAcquisition: Readonly<Record<string, number>>;
  readonly shallowTraversalPlaces: number;
  readonly residentiallyKnownPlaces: number;
  /** Bounded sample, farthest-first, so frontier country is what the panel shows. */
  readonly entries: readonly PlaceEvidenceEntry[];
  readonly verification: PlaceVerificationProjection;
  readonly noHiddenTruthRead: true;
  readonly projectionOnly: true;
}

const MAX_ENTRIES = 24;
const MAX_VERIFICATION_ROWS = 12;

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
      seasonsAnswered: evidence?.seasonsAnswered ?? [attempt.season],
    };
  };

  return {
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
    noHiddenTruthRead: true,
    projectionOnly: true,
  };
}
