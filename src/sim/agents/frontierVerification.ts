// CORRECTION-23 — PHYSICAL FRONTIER VERIFICATION: going back to find out.
//
// WHY THIS EXISTS. CORRECTION-22 proved a structural gap, not a tuning error. Every
// investigation activity in the simulator selects its target from
// `resourceKnowledgeState.patchMemories` — remembered RESOURCE PATCHES:
//
//   distant_plant_gathering / hunting / fishing   patch memories
//   distant_patch_verification                    patch memories (verifies a remembered PATCH)
//   route_reconnaissance                          patch memories + prior failed targets
//   frontier_exploration                          a band-known HEADING, targets no place
//
// Shallow frontier country, however, exists only in `knowledge.observedTiles`. Nothing
// bridged the two. A band could learn that country exists and roughly what it looks like,
// and then had no physical means of finding out whether it was actually usable. When
// CORRECTION-21 correctly stopped handing that band free hidden ecology, the
// `marginal_escapable` tier — whose entire survival strategy is to locate and reach better
// country — fell from 7/10 to 0/10.
//
// This module is the bridge. It reads `observedTiles`, finds places that look promising but
// are unverified for a SPECIFIC question, and produces a target for a physical party.
//
// THE ANTI-OMNISCIENCE CONTRACT IS UNCHANGED AND BINDING:
//   - eligibility and selection read ONLY band-known records, never world truth;
//   - "promising" is judged from what the band itself recorded (a coarse impression), not
//     from what is actually there;
//   - a place may look promising and turn out to be worthless — that is a required outcome,
//     not a failure of the mechanism;
//   - returning parties upgrade ONLY the domain physically investigated.
//
// Determinism: no randomness. Every tie breaks on tile id.
import type { ReasonId, Season, TickNumber, TileId } from "../core/types";
import type { KnownTileRecord } from "../knowledge/types";
import { getTile } from "../world/generate";
import { isBandPassableDestination } from "../world/passability";
import type { WorldState } from "../world/types";
import type {
  Band,
  FrontierVerificationAttempt,
  FrontierVerificationPlan,
  FrontierVerificationQuestion,
} from "./types";

// ── Bounds. Hard caps on state and search. ───────────────────────────────────────

/** §24 — concurrent verification parties per band. */
export const VERIFICATION_ACTIVE_CAP = 1;
/** §24 — candidate targets examined per selection pass. Bounded search, never a map scan. */
export const VERIFICATION_CANDIDATE_CAP = 24;
/** §24 — bounded retry history per band. */
export const VERIFICATION_ATTEMPT_HISTORY_CAP = 12;
/** §11 — days a party may work at the destination. */
export const VERIFICATION_ON_SITE_DAYS = 2;
/** §16 — ticks before the same question at the same place may be asked again. */
const VERIFICATION_RETRY_TICKS = 24;
/** Below this the band has no real reason to spend labour investigating anything. */
const VERIFICATION_MIN_NEED = 0.3;
/** A record must look at least this promising on the band's OWN coarse impression. */
const VERIFICATION_MIN_PROMISE = 0.28;
/** Beyond this the place is not a verification target; it is an exploration problem. */
export const VERIFICATION_MAX_DISTANCE_TILES = 24;

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const round2 = (v: number): number => Math.round(v * 100) / 100;

// ─────────────────────────────────────────────────────────────────────────────
// §8 — UNKNOWN vs KNOWN-POOR vs PROMISING-UNVERIFIED.
//
// These are three different states and must not collapse. The distinction is the whole
// reason verification can exist: a band investigates what it does not know, avoids what it
// knows to be poor, and must not treat the two identically.
// ─────────────────────────────────────────────────────────────────────────────

export type PlaceEpistemicState =
  // No record at all. Not a verification target — you cannot go back to somewhere you have
  // never been. This is an EXPLORATION problem.
  | "unknown"
  // The band has evidence and that evidence is bad. Strictly worse than unknown.
  | "known_poor"
  // Coarse evidence that looks worth a second visit, with the specific domain untested.
  | "promising_unverified"
  // Physically tested and found inadequate for the question asked.
  | "verified_inadequate"
  // Physically tested and found usable.
  | "verified_usable";

/**
 * Classify what the band holds about a place FOR A GIVEN QUESTION.
 *
 * Reads only the band's own record. `undefined` means the band never learned that domain —
 * it is treated as UNKNOWN, never silently as poor. That asymmetry is deliberate: a missing
 * value is an invitation to investigate, a low value is a reason not to.
 */
export function classifyPlaceForQuestion(
  record: KnownTileRecord | undefined,
  question: FrontierVerificationQuestion,
  attempts: readonly FrontierVerificationAttempt[],
): PlaceEpistemicState {
  if (record === undefined) {
    return "unknown";
  }

  const priorAnswer = attempts.find(
    (attempt) => attempt.tileId === record.tileId && attempt.question === question,
  );

  if (priorAnswer?.outcome === "confirmed") {
    return "verified_usable";
  }

  if (priorAnswer?.outcome === "negative") {
    return "verified_inadequate";
  }

  switch (question) {
    case "water_access": {
      const water = record.observedWaterAccess;
      // Never observed water here at all -> unknown, not poor.
      if (water === undefined) return "unknown";
      // The band saw the place and saw essentially no water. That is real evidence.
      return water < 0.12 ? "known_poor" : "promising_unverified";
    }
    case "resource_presence":
    case "resource_usability": {
      const richness = record.observedRichness;
      if (richness === undefined) return "unknown";
      return richness < 0.2 ? "known_poor" : "promising_unverified";
    }
    case "temporary_use": {
      // Needs somewhere that at least looked liveable in passing.
      if (record.observedRichness === undefined && record.observedWaterAccess === undefined) {
        return "unknown";
      }
      const risk = record.observedRisk ?? 0.3;
      return risk > 0.62 ? "known_poor" : "promising_unverified";
    }
    case "route_repeatability": {
      return record.observedMovementCost === undefined ? "unknown" : "promising_unverified";
    }
    case "seasonal_persistence": {
      // One season of coverage is exactly the state this question exists to improve.
      const seasons = record.seasonsObserved?.length ?? 0;
      return seasons === 0 ? "unknown" : seasons >= 3 ? "verified_usable" : "promising_unverified";
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// §7 — ELIGIBILITY AND NEED.
// ─────────────────────────────────────────────────────────────────────────────

export interface VerificationNeed {
  readonly need: number;
  readonly foodPressure: number;
  readonly waterPressure: number;
  readonly chronicDecline: number;
  readonly saturation: number;
  readonly reason: string;
}

/**
 * Does this band have a real, band-known reason to spend labour finding something out?
 *
 * Pressure raises WILLINGNESS to investigate. It never reveals anything, never makes a poor
 * place viable, and never removes route or risk constraints — a hungry band is more willing
 * to walk and find out, not better at guessing.
 */
export function deriveVerificationNeed(band: Band): VerificationNeed {
  const foodPressure = clamp01(band.pressureState?.foodStress ?? 0);
  const waterPressure = clamp01(band.pressureState?.waterStress ?? 0);
  const trend = band.returnTrend;
  const chronicDecline = clamp01(
    trend === undefined
      ? 0
      : Math.max(
          trend.chronicDecline ? 0.5 : 0,
          Math.max(0, -trend.shortLongDelta) * 0.8,
          Math.max(0, 0.45 - trend.mean8) * 1.2,
        ),
  );
  const saturation = clamp01(band.rangeSaturation?.saturationPressure ?? 0);
  const need = clamp01(
    foodPressure * 0.42 + chronicDecline * 0.34 + waterPressure * 0.26 + saturation * 0.18,
  );
  const reason =
    chronicDecline >= 0.4
      ? "returns from the known range have been declining"
      : foodPressure >= 0.4
        ? "sustained food pressure in the current range"
        : waterPressure >= 0.4
          ? "water pressure in the current range"
          : saturation >= 0.4
            ? "the known range is saturated"
            : "no pressing reason";

  return {
    need: round2(need),
    foodPressure: round2(foodPressure),
    waterPressure: round2(waterPressure),
    chronicDecline: round2(chronicDecline),
    saturation: round2(saturation),
    reason,
  };
}

/**
 * §16 — may this band ask this question about this place again?
 *
 * Not a bare timer. A repeat is justified by a CHANGED SITUATION: a different season can
 * answer a different question, and an inconclusive result is not an answer. The same
 * question, answered negatively, under unchanged conditions, is not re-asked.
 */
function mayRetry(
  attempts: readonly FrontierVerificationAttempt[],
  tileId: TileId,
  question: FrontierVerificationQuestion,
  currentTick: number,
  currentSeason: Season,
): boolean {
  const prior = attempts.filter(
    (attempt) => attempt.tileId === tileId && attempt.question === question,
  );

  if (prior.length === 0) {
    return true;
  }

  const latest = prior[prior.length - 1];
  const elapsed = currentTick - Number(latest.tick);

  // A definite negative stands until something changes.
  if (latest.outcome === "negative") {
    // Seasonal persistence is the one question a new season genuinely re-opens.
    return question === "seasonal_persistence" && latest.season !== currentSeason;
  }

  // A lost party answered nothing at all; the question is still open, but do not send a
  // second party straight after the first was lost.
  if (latest.outcome === "lost") {
    return elapsed >= VERIFICATION_RETRY_TICKS;
  }

  // Inconclusive: worth another attempt once, after a real interval.
  return elapsed >= VERIFICATION_RETRY_TICKS && prior.length < 3;
}

export interface VerificationCandidate {
  readonly tileId: TileId;
  readonly question: FrontierVerificationQuestion;
  readonly promisingSignal: string;
  readonly missingEvidence: string;
  readonly informationDeficit: number;
  readonly distanceTiles: number;
  readonly score: number;
}

/**
 * §9 — the bounded, deterministic selector.
 *
 * ELIGIBILITY IS APPLIED BEFORE RANKING. An ineligible high-scoring target can never
 * suppress an eligible lower-scoring one — that was the candidate-masking defect
 * CORRECTION-18 had to repair elsewhere, and it is not repeated here.
 */
export function selectVerificationCandidate(
  world: WorldState,
  band: Band,
  need: VerificationNeed,
): VerificationCandidate | undefined {
  if (need.need < VERIFICATION_MIN_NEED) {
    return undefined;
  }

  const here = getTile(world, band.position);

  if (here === undefined) {
    return undefined;
  }

  const attempts = band.frontierVerificationAttempts ?? [];
  const currentTick = Number(world.time.tick);
  const season = world.time.season;
  const eligible: VerificationCandidate[] = [];
  let examined = 0;

  // Farthest-first is wrong here and nearest-first biases toward the existing catchment, so
  // iterate in stable id order and let the score decide. Bounded by the candidate cap.
  const records = Object.values(band.knowledge.observedTiles).sort((a, b) =>
    String(a.tileId).localeCompare(String(b.tileId)),
  );

  for (const record of records) {
    if (examined >= VERIFICATION_CANDIDATE_CAP) {
      break;
    }

    if (record.tileId === band.position) {
      continue;
    }

    const tile = getTile(world, record.tileId);

    if (tile === undefined || !isBandPassableDestination(tile)) {
      continue;
    }

    const distance =
      Math.abs(tile.coord.x - here.coord.x) + Math.abs(tile.coord.y - here.coord.y);

    // Too close to be worth a party (it is inside the working range), or too far to be a
    // verification rather than an exploration problem.
    if (distance < 3 || distance > VERIFICATION_MAX_DISTANCE_TILES) {
      continue;
    }

    examined += 1;

    for (const question of QUESTION_PRIORITY) {
      const state = classifyPlaceForQuestion(record, question, attempts);

      // Only promising-but-unverified places are verification targets. `unknown` is an
      // exploration problem; `known_poor` is a reason NOT to go; already-verified needs
      // no repeat.
      if (state !== "promising_unverified") {
        continue;
      }

      if (!mayRetry(attempts, record.tileId, question, currentTick, season)) {
        continue;
      }

      const gap = describeVerificationGap(record, question);

      if (gap === undefined) {
        continue;
      }

      // Score: how promising it looked, how badly the answer is needed, discounted by the
      // walk. All band-known. Distance is a real cost here (the party has to get there and
      // back), and it appears once.
      const score = round2(
        gap.promise * 0.44 +
          gap.informationDeficit * 0.3 +
          need.need * 0.24 -
          clamp01(distance / VERIFICATION_MAX_DISTANCE_TILES) * 0.22 -
          clamp01(record.observedRisk ?? 0.3) * 0.16,
      );

      eligible.push({
        tileId: record.tileId,
        question,
        promisingSignal: gap.promisingSignal,
        missingEvidence: gap.missingEvidence,
        informationDeficit: round2(gap.informationDeficit),
        distanceTiles: distance,
        score,
      });
      // One question per place per pass: the highest-priority open question.
      break;
    }
  }

  if (eligible.length === 0) {
    return undefined;
  }

  return [...eligible].sort((left, right) =>
    right.score === left.score
      ? String(left.tileId).localeCompare(String(right.tileId))
      : right.score - left.score,
  )[0];
}

/**
 * Question priority. Water first because it gates everything else physically; then whether
 * there is food at all; then whether it can actually be taken; then whether a party can stay.
 * Route and seasonal questions are lower because they refine rather than unlock.
 */
const QUESTION_PRIORITY: readonly FrontierVerificationQuestion[] = [
  "water_access",
  "resource_presence",
  "resource_usability",
  "temporary_use",
  "route_repeatability",
  "seasonal_persistence",
];

/** What the band's own record says, and what it is missing, for one question. */
export function describeVerificationGap(
  record: KnownTileRecord,
  question: FrontierVerificationQuestion,
):
  | {
      readonly promise: number;
      readonly promisingSignal: string;
      readonly missingEvidence: string;
      readonly informationDeficit: number;
    }
  | undefined {
  switch (question) {
    case "water_access": {
      const water = record.observedWaterAccess ?? 0;
      if (water < VERIFICATION_MIN_PROMISE) return undefined;
      return {
        promise: clamp01(water),
        promisingSignal: "water was visible from the crossing",
        missingEvidence: "whether it can actually be reached and used",
        informationDeficit: 1 - clamp01(record.confidence),
      };
    }
    case "resource_presence": {
      const richness = record.observedRichness ?? 0;
      if (richness < VERIFICATION_MIN_PROMISE) return undefined;
      return {
        promise: clamp01(richness),
        promisingSignal: "the country looked productive in passing",
        missingEvidence: "whether any food resource is actually present",
        informationDeficit: 1 - clamp01(record.confidence),
      };
    }
    case "resource_usability": {
      const richness = record.observedRichness ?? 0;
      if (richness < VERIFICATION_MIN_PROMISE) return undefined;
      return {
        promise: clamp01(richness) * 0.9,
        promisingSignal: "resource signs were seen here",
        missingEvidence: "whether anything can actually be taken and carried home",
        informationDeficit: 1 - clamp01(record.confidence),
      };
    }
    case "temporary_use": {
      const richness = record.observedRichness ?? 0;
      const water = record.observedWaterAccess ?? 0;
      const promise = clamp01(richness * 0.6 + water * 0.4);
      if (promise < VERIFICATION_MIN_PROMISE) return undefined;
      return {
        promise,
        promisingSignal: "the place looked liveable in passing",
        missingEvidence: "whether a party can actually stay and work here",
        informationDeficit: 1 - clamp01(record.confidence),
      };
    }
    case "route_repeatability": {
      if (record.observedMovementCost === undefined) return undefined;
      return {
        promise: 0.4,
        promisingSignal: "a party walked this way once",
        missingEvidence: "whether the route can be relied on repeatedly",
        informationDeficit: 1 - clamp01(record.confidence),
      };
    }
    case "seasonal_persistence": {
      const seasons = record.seasonsObserved?.length ?? 0;
      if (seasons === 0 || seasons >= 3) return undefined;
      return {
        promise: clamp01(record.observedRichness ?? 0) * 0.8,
        promisingSignal: `seen in ${seasons} season(s)`,
        missingEvidence: "whether it holds up in the other seasons",
        informationDeficit: clamp01((3 - seasons) / 3),
      };
    }
  }
}

/** Build the plan a party carries. Contains no tile the band has not observed. */
export function buildVerificationPlan(
  candidate: VerificationCandidate,
  record: KnownTileRecord,
  need: VerificationNeed,
  attempts: readonly FrontierVerificationAttempt[],
): FrontierVerificationPlan {
  const attemptIndex = attempts.filter(
    (attempt) => attempt.tileId === candidate.tileId && attempt.question === candidate.question,
  ).length;

  return {
    question: candidate.question,
    targetTileId: candidate.tileId,
    originatingAcquisition: record.acquisition ?? "residential_observation",
    promisingSignal: candidate.promisingSignal,
    missingEvidence: candidate.missingEvidence,
    informationDeficit: round2(candidate.informationDeficit) as FrontierVerificationPlan["informationDeficit"],
    selectionReason: need.reason,
    onSiteBudgetDays: VERIFICATION_ON_SITE_DAYS,
    attemptIndex,
    noHiddenTruthRead: true,
    bandKnownTargetOnly: true,
  };
}

/** Bounded append to the retry history. */
export function recordVerificationAttempt(
  attempts: readonly FrontierVerificationAttempt[],
  attempt: FrontierVerificationAttempt,
): readonly FrontierVerificationAttempt[] {
  return [...attempts, attempt].slice(-VERIFICATION_ATTEMPT_HISTORY_CAP);
}

export function makeVerificationReasonId(
  bandId: string,
  tick: TickNumber,
  question: FrontierVerificationQuestion,
  suffix: string,
): ReasonId {
  return `reason:${bandId}:${String(tick)}:frontier_verification:${question}:${suffix}` as ReasonId;
}
