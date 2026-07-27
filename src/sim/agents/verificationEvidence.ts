// CORRECTION-23B §4/§11 — AUTHORITATIVE VERIFICATION EVIDENCE AND RETRY MEMORY.
//
// WHY THIS EXISTS. CORRECTION-23's continuation proved two things by measurement:
//
//   1. the answers were INERT. Destroying every affirmative on-site result (arm E5)
//      reproduced production seed for seed — identical extinction years on all ten marginal
//      seeds — because nothing outside the verification module read a result.
//   2. retry control was BROKEN. `mayRetry` consulted `frontierVerificationAttempts`, a ring
//      capped at 12 entries for display. With ~7 attempts per band-year the ring turned over
//      in under two years, after which a confirmed place reverted to "promising" and was
//      verified again: 267 repeats on one band/target pair at 100 years, 692 at 300, 1,186
//      at 500, growing linearly.
//
// This module is the single authority for both. Records are keyed by (place, question) and
// UPSERTED, so a repeat updates a row instead of appending one — retries cannot grow state.
//
// THE DOMAIN CONTRACT IS BINDING (§4). There is deliberately no `verificationConfirmed`
// boolean and no aggregate score. A reader may only consult the question whose domain it
// belongs to:
//
//   water_access           -> physical water access at a destination (carryingCapacity)
//   temporary_use          -> whether a bounded party may camp there (expedition)
//   resource_presence      -> eligibility to attempt a stock-backed test (this module)
//   resource_test_possible -> eligibility only; NEVER support, yield or food
//   seasonal_persistence   -> retained, intentionally unread (see §10 note below)
//
// Nothing here reads world truth. Every input is band state.
import type { Season, TickNumber, TileId } from "../core/types";
import type {
  Band,
  FrontierVerificationQuestion,
  RouteRepeatabilityEvidence,
  VerificationEvidenceRecord,
} from "./types";

/** Bounded evidence store. One row per (place, question); oldest row evicted first. */
export const VERIFICATION_EVIDENCE_CAP = 48;
/** Ticks before an INCONCLUSIVE question may be asked again at the same place. */
const RETRY_INTERVAL_TICKS = 24;
/** An inconclusive question is not asked forever. */
const MAX_INCONCLUSIVE_ATTEMPTS = 3;
/** Hardship must move by at least this much to count as a materially changed situation. */
const MATERIAL_HARDSHIP_DELTA = 0.2;
/** A route materially differs when its length changes by at least this many tiles. */
const MATERIAL_ROUTE_DELTA = 4;

/**
 * §5 — a party that physically reached water and drew from it has earned a stronger claim
 * than a walker who saw it from a distance. This is the floor that claim establishes: enough
 * to clear the physical-access gate, and deliberately well short of certainty, because
 * reaching water once says nothing about whether it is there every season.
 */
export const VERIFIED_WATER_ACCESS_FLOOR = 0.55;
/**
 * §5 — a party that walked there and found nothing reachable. That is real evidence and it
 * must bite: the ceiling sits below `carryingCapacity`'s 0.32 physical-access gate.
 */
export const REFUTED_WATER_ACCESS_CEILING = 0.28;

const key = (tileId: TileId, question: FrontierVerificationQuestion): string =>
  `${String(tileId)}|${question}`;

function find(
  band: Band,
  tileId: TileId,
  question: FrontierVerificationQuestion,
): VerificationEvidenceRecord | undefined {
  return (band.verificationEvidence ?? []).find(
    (record) => record.tileId === tileId && record.question === question,
  );
}

/**
 * Upsert one physically established answer.
 *
 * A repeat at the same place for the same question REPLACES its row and grows
 * `seasonsAnswered` only when the season is genuinely new — §10's requirement that repeated
 * visits in one season never accumulate into a calendar.
 */
export function recordVerificationEvidence(
  existing: readonly VerificationEvidenceRecord[] | undefined,
  next: {
    readonly tileId: TileId;
    readonly question: FrontierVerificationQuestion;
    readonly outcome: "confirmed" | "negative" | "inconclusive";
    readonly season: Season;
    readonly tick: TickNumber;
    readonly hardship: number;
    readonly routeTiles: number;
    readonly routeEvidence: RouteRepeatabilityEvidence;
  },
): readonly VerificationEvidenceRecord[] {
  const rows = existing ?? [];
  const prior = rows.find(
    (record) => record.tileId === next.tileId && record.question === next.question,
  );
  const seasonsAnswered =
    prior === undefined
      ? [next.season]
      : prior.seasonsAnswered.includes(next.season)
        ? prior.seasonsAnswered
        : [...prior.seasonsAnswered, next.season];

  const updated: VerificationEvidenceRecord = {
    tileId: next.tileId,
    question: next.question,
    outcome: next.outcome,
    seasonsAnswered,
    lastSeason: next.season,
    lastTick: next.tick,
    attempts: (prior?.attempts ?? 0) + 1,
    hardshipAtLastAttempt: Math.round(Math.max(0, Math.min(1, next.hardship)) * 100) / 100,
    routeTilesAtLastAttempt: next.routeTiles,
    routeEvidence: next.routeEvidence,
  };

  const others = rows.filter(
    (record) => key(record.tileId, record.question) !== key(next.tileId, next.question),
  );

  // Bounded: evict the oldest rows, never the one just written.
  return [...others, updated]
    .sort((left, right) => Number(left.lastTick) - Number(right.lastTick))
    .slice(-VERIFICATION_EVIDENCE_CAP);
}

// ─────────────────────────────────────────────────────────────────────────────
// §11 — RETRY MEMORY. Separate from the display ring, and keyed by real conditions.
// ─────────────────────────────────────────────────────────────────────────────

export interface RetryConditions {
  readonly currentTick: number;
  readonly currentSeason: Season;
  readonly hardship: number;
  /** Route length the band would walk now, if known. */
  readonly routeTiles?: number;
}

export interface RetryDecision {
  readonly allowed: boolean;
  readonly reason: string;
}

/**
 * May this band ask this question about this place again?
 *
 * A settled answer stands until something actually changes. "Something changed" means a
 * changed SITUATION, not an elapsed timer: a different relevant season, a materially
 * different route, or materially different hardship. An inconclusive result is not an answer
 * and may be retried a bounded number of times.
 */
export function mayAskAgain(
  band: Band,
  tileId: TileId,
  question: FrontierVerificationQuestion,
  conditions: RetryConditions,
): RetryDecision {
  const prior = find(band, tileId, question);

  if (prior === undefined) {
    return { allowed: true, reason: "never asked here" };
  }

  const seasonChanged = prior.lastSeason !== conditions.currentSeason;
  const seasonNew = !prior.seasonsAnswered.includes(conditions.currentSeason);
  const hardshipMoved =
    Math.abs(conditions.hardship - prior.hardshipAtLastAttempt) >= MATERIAL_HARDSHIP_DELTA;
  const routeMoved =
    conditions.routeTiles !== undefined &&
    Math.abs(conditions.routeTiles - prior.routeTilesAtLastAttempt) >= MATERIAL_ROUTE_DELTA;

  // Seasonal persistence is the one question a genuinely new season re-opens on its own —
  // that is the question. Repeats within a season it already covers answer nothing.
  if (question === "seasonal_persistence") {
    return seasonNew
      ? { allowed: true, reason: "a season this place has not been seen in" }
      : { allowed: false, reason: "this season is already covered here" };
  }

  if (prior.outcome === "inconclusive") {
    if (prior.attempts >= MAX_INCONCLUSIVE_ATTEMPTS) {
      return { allowed: false, reason: "asked and left unresolved too many times" };
    }

    return conditions.currentTick - Number(prior.lastTick) >= RETRY_INTERVAL_TICKS
      ? { allowed: true, reason: "the last attempt settled nothing" }
      : { allowed: false, reason: "asked too recently" };
  }

  // A settled answer — confirmed or negative — stands until the situation moves.
  if (seasonChanged && (question === "water_access" || question === "resource_presence")) {
    return { allowed: true, reason: "a different season may give a different answer" };
  }

  if (routeMoved) {
    return { allowed: true, reason: "the way there has changed" };
  }

  if (hardshipMoved) {
    return { allowed: true, reason: "the band's situation has materially changed" };
  }

  return {
    allowed: false,
    reason:
      prior.outcome === "confirmed"
        ? "already established here, and nothing has changed"
        : "already found wanting here, and nothing has changed",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// §5 — WATER-ACCESS READER. The only reader that changes a destination decision.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply physically established water evidence to ONE tile's water-access term.
 *
 * A confirmed result means a party walked there and drew water: the band knows the water is
 * physically reachable, which is more than a glimpse from a crossing establishes and less
 * than seasonal dependability. A negative result means a party walked there and found
 * nothing reachable, which must bite.
 *
 * Domain-locked by construction: the observed value is the only input, the question is
 * hard-coded, and no other field of the record is consulted or returned.
 */
export function applyVerifiedWaterAccess(
  band: Band,
  tileId: TileId,
  observedWaterAccess: number,
): number {
  const evidence = find(band, tileId, "water_access");

  if (evidence === undefined || evidence.outcome === "inconclusive") {
    return observedWaterAccess;
  }

  return evidence.outcome === "confirmed"
    ? Math.max(observedWaterAccess, VERIFIED_WATER_ACCESS_FLOOR)
    : Math.min(observedWaterAccess, REFUTED_WATER_ACCESS_CEILING);
}

// ─────────────────────────────────────────────────────────────────────────────
// §9 — TEMPORARY-USE READER. Bounded operation evidence gates bounded operation.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * May a party establish a bounded task camp here, as far as the band's own evidence goes?
 *
 * This never authorises residence, an anchor, storage or a territory claim — the task-camp
 * record already asserts all three non-claims. It only lets the band act on having tried:
 * a party that could not sustain itself here before does not camp here again.
 */
export function taskCampRefusedByEvidence(band: Band, tileId: TileId): boolean {
  return find(band, tileId, "temporary_use")?.outcome === "negative";
}

// ─────────────────────────────────────────────────────────────────────────────
// §6/§7 — RESOURCE ELIGIBILITY. Option A: eligibility only, never support.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Is a real, stock-backed test worth attempting at this place?
 *
 * §7 Option A. A confirmed `resource_presence` result — food was physically found in the
 * bounded area actually searched — is what makes the stronger question worth asking. A
 * negative one suppresses immediate repetition of the same bounded search WITHOUT proving
 * global or permanent absence: it blocks only this place, only this question, and only until
 * the retry conditions above move.
 *
 * It creates no patch, no stock, no yield and no support. The cross-module consumer — an
 * activity that resolves a real patch at an arbitrary tile and returns a canonical receipt —
 * does not exist yet, and is deliberately NOT invented here.
 */
export function resourceTestEligible(band: Band, tileId: TileId): boolean {
  return find(band, tileId, "resource_presence")?.outcome === "confirmed";
}

/**
 * §10 — SEASONAL PERSISTENCE IS RETAINED AND INTENTIONALLY UNREAD.
 *
 * The evidence records exactly the seasons in which a place was physically seen, and never
 * synthesises the ones it was not. No production reader consumes it, because the downstream
 * system that would — seasonal scheduling over verified distant country — does not exist.
 * §10 is explicit that a premature consumer should not be invented for it. This accessor
 * exists so the read model can show the coverage honestly.
 */
export function seasonsVerifiedAt(band: Band, tileId: TileId): readonly Season[] {
  return find(band, tileId, "seasonal_persistence")?.seasonsAnswered ?? [];
}

/** Read model / audit accessor. Never used to make a decision. */
export function findVerificationEvidence(
  band: Band,
  tileId: TileId,
  question: FrontierVerificationQuestion,
): VerificationEvidenceRecord | undefined {
  return find(band, tileId, question);
}
