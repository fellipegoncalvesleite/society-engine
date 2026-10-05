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
import type { KnowledgeAcquisitionKind, PlaceQuestionDisposition } from "../knowledge/types";
import type {
  Band,
  DirectWaterAccessEvidence,
  FrontierVerificationQuestion,
  RouteRepeatabilityEvidence,
  VerificationEvidenceRecord,
  WaterAccessFailureKind,
} from "./types";

/** Bounded evidence store. One row per (place, question); oldest row evicted first. */
export const VERIFICATION_EVIDENCE_CAP = 48;
/** Ticks before an INCONCLUSIVE question may be asked again at the same place. */
const RETRY_INTERVAL_TICKS = 24;
/** An inconclusive question is not asked forever. */
const MAX_INCONCLUSIVE_ATTEMPTS = 3;
/** A route materially differs when its length changes by at least this many tiles. */
const MATERIAL_ROUTE_DELTA = 4;

const key = (tileId: TileId, question: FrontierVerificationQuestion): string =>
  `${String(tileId)}|${question}`;

/**
 * CORRECTION-23D §4/§9 — THE AUTHORITY IS THE PLACE RECORD.
 *
 * `band.verificationEvidence` is a bounded chronological collection and is NO LONGER
 * authoritative: its 48-row cap was under pressure on 75.3% of band-days, and eviction
 * accounted for 18.1% of all verification launches — a settled question becoming "never
 * asked" because unrelated evidence filled a cap. §9 forbids exactly that.
 *
 * The durable conclusion lives on `KnownTileRecord.verificationDisposition`: sparse, one
 * entry per attempted question, and forgotten only when the band forgets the place.
 */
function findDisposition(
  band: Band,
  tileId: TileId,
  question: FrontierVerificationQuestion,
): PlaceQuestionDisposition | undefined {
  return band.knowledge.observedTiles[tileId]?.verificationDisposition?.find(
    (entry) => entry.question === question,
  );
}

function find(
  band: Band,
  tileId: TileId,
  question: FrontierVerificationQuestion,
): VerificationEvidenceRecord | undefined {
  const durable = findDisposition(band, tileId, question);

  if (durable !== undefined) {
    // Presented through the existing shape so every CORRECTION-23B/C domain reader keeps its
    // exact contract while reading from the durable home.
    return {
      tileId,
      question,
      outcome: durable.outcome,
      seasonsAnswered: durable.seasonsAnswered,
      lastSeason: durable.lastSeason,
      lastTick: durable.lastTick,
      attempts: durable.attempts,
      hardshipAtLastAttempt: 0,
      routeTilesAtLastAttempt: durable.routeTilesAtLastAttempt,
      routeEvidence: "walked_out_and_back",
      acquisition: band.knowledge.observedTiles[tileId]?.acquisition,
      ...(durable.accessFailureKind === undefined
        ? {}
        : { accessFailureKind: durable.accessFailureKind }),
    };
  }

  return (band.verificationEvidence ?? []).find(
    (record) => record.tileId === tileId && record.question === question,
  );
}

/**
 * §6 — upsert the durable disposition onto the place record. Bounded by the question count,
 * so a repeat updates an entry and never appends one.
 */
export function recordPlaceDisposition(
  existing: readonly PlaceQuestionDisposition[] | undefined,
  next: {
    readonly question: FrontierVerificationQuestion;
    readonly outcome: "confirmed" | "negative" | "inconclusive";
    readonly season: Season;
    readonly tick: TickNumber;
    readonly routeTiles: number;
    readonly accessFailureKind?: WaterAccessFailureKind;
  },
): readonly PlaceQuestionDisposition[] {
  const rows = existing ?? [];
  const prior = rows.find((entry) => entry.question === next.question);
  const seasonsAnswered =
    prior === undefined
      ? [next.season]
      : prior.seasonsAnswered.includes(next.season)
        ? prior.seasonsAnswered
        : [...prior.seasonsAnswered, next.season];

  const updated: PlaceQuestionDisposition = {
    question: next.question,
    outcome: next.outcome,
    seasonsAnswered,
    attempts: (prior?.attempts ?? 0) + 1,
    lastSeason: next.season,
    lastTick: next.tick,
    routeTilesAtLastAttempt: next.routeTiles,
    ...(next.outcome === "negative" && next.accessFailureKind !== undefined
      ? { accessFailureKind: next.accessFailureKind }
      : {}),
  };

  return [...rows.filter((entry) => entry.question !== next.question), updated];
}

/** Read model / audit accessor for the durable disposition. */
export function findPlaceDisposition(
  band: Band,
  tileId: TileId,
  question: FrontierVerificationQuestion,
): PlaceQuestionDisposition | undefined {
  return findDisposition(band, tileId, question);
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
    readonly acquisition?: KnowledgeAcquisitionKind;
    readonly accessFailureKind?: WaterAccessFailureKind;
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
    ...(next.acquisition === undefined ? {} : { acquisition: next.acquisition }),
    // §7 — the failure scope belongs to a negative answer and only to a negative answer.
    ...(next.outcome === "negative" && next.accessFailureKind !== undefined
      ? { accessFailureKind: next.accessFailureKind }
      : {}),
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

  // CORRECTION-23D §7 — A SEASON ALREADY COVERED REOPENS NOTHING.
  //
  // The previous gate compared `lastSeason !== currentSeason`, which is true three seasons
  // out of four FOREVER — so a fully covered question re-fired every season for the life of
  // the band. That single comparison was 45.8% of all verification launches, and it is the
  // linear-growth engine the 648-repeat measurement recorded. What can justify another visit
  // is a season this place has NOT been answered in.
  const seasonNew = !prior.seasonsAnswered.includes(conditions.currentSeason);
  const routeMoved =
    conditions.routeTiles !== undefined &&
    Math.abs(conditions.routeTiles - prior.routeTilesAtLastAttempt) >= MATERIAL_ROUTE_DELTA;

  // §7.5 — an inconclusive attempt settled nothing, so it may be retried; bounded, and only
  // after a real interval.
  if (prior.outcome === "inconclusive") {
    if (prior.attempts >= MAX_INCONCLUSIVE_ATTEMPTS) {
      return { allowed: false, reason: "asked and left unresolved too many times" };
    }

    if (seasonNew || routeMoved) {
      return { allowed: true, reason: "unresolved, and something about the attempt has changed" };
    }

    return conditions.currentTick - Number(prior.lastTick) >= RETRY_INTERVAL_TICKS
      ? { allowed: true, reason: "the last attempt settled nothing" }
      : { allowed: false, reason: "asked too recently" };
  }

  // §7.3 — once a stock-backed test is known to be worth attempting, the next behaviour is
  // the test, not another confirmation of the prerequisite.
  if (question === "resource_test_possible" && prior.outcome === "confirmed") {
    return { allowed: false, reason: "already established; the next step is the test itself" };
  }

  // §7.1/§7.2/§7.4 — a settled answer stands. It is reopened by a question the previous
  // visit could not have answered: a season it was never seen in, or a materially different
  // way there. Seasonal persistence is season-scoped by definition.
  if (question === "seasonal_persistence") {
    return seasonNew
      ? { allowed: true, reason: "a season this place has not been seen in" }
      : { allowed: false, reason: "this season is already covered here" };
  }

  if (seasonNew) {
    return { allowed: true, reason: "a season this place has not been answered in" };
  }


  if (routeMoved) {
    return { allowed: true, reason: "the way there has materially changed" };
  }



  // CORRECTION-23D §8 — HARDSHIP IS MOTIVATION, NOT EPISTEMIC INVALIDATION.
  //
  // The previous gate reopened a settled question whenever hardship moved by 0.2. Hardship
  // oscillates, so that term was a permanent oscillator: 0.3 -> 0.5 reopened it, 0.5 -> 0.3
  // reopened it again, forever, and it accounted for 2.5% of launches on its own. A hungry
  // band has more reason to go and look at something ELSE; it has no reason to have
  // forgotten what happened at this exact place. The term is gone, and `hardship` survives
  // in `RetryConditions` only because the launch policy still reads it as motivation.
  return {
    allowed: false,
    reason:
      prior.outcome === "confirmed"
        ? "already established here, and nothing about the question has changed"
        : "already found wanting here, and nothing about the question has changed",
  };
}

/**
 * §17 — what material change could reopen this question, in words, for the read model.
 */
export function describeReopeningConditions(
  question: FrontierVerificationQuestion,
  outcome: "confirmed" | "negative" | "inconclusive",
): string {
  if (question === "resource_test_possible" && outcome === "confirmed") {
    return "nothing — the next step is a real test, not another check";
  }

  if (outcome === "inconclusive") {
    return "a season it has not been seen in, a materially different route, or a later attempt";
  }

  return "a season it has not been answered in, or a materially different route";
}

// ─────────────────────────────────────────────────────────────────────────────
// CORRECTION-23C §5/§6 — DIRECT WATER ACCESS: FEASIBILITY ONLY.
//
// What CORRECTION-23B did, and why it was wrong: a confirmed access floored
// `waterReliability` at 0.55. That single field is read by a physical-ACCESS gate
// (`> 0.32`), by the destination RANKING term (`score += waterReliability * 0.24`) and by a
// margin relaxation (`> 0.36`) — so evidence that answered "a party reached water here once"
// also made the place score better and relax its own comparison margin. Worse, a
// confirmation needs only `waterAccess >= 0.3` or an adjacent water tile, so 0.55 could sit
// ABOVE the physical value.
//
// The repair is a separation, not a smaller number. Direct access now answers exactly one
// question — is reaching water here physically possible — and reliability is left entirely
// to observation and experience.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read the band's own direct water-access evidence for one place.
 *
 * Returns the full bounded statement rather than a scalar, so a caller cannot accidentally
 * use it as a magnitude. `provesReliability` and `provesOtherSeasons` are `false` by
 * construction and are asserted by W3/W7/W8.
 */
export function deriveDirectWaterAccess(band: Band, tileId: TileId): DirectWaterAccessEvidence {
  const evidence = find(band, tileId, "water_access");

  if (evidence === undefined) {
    return {
      state: "unasked",
      seasonsObserved: [],
      attempts: 0,
      provesReliability: false,
      provesOtherSeasons: false,
    };
  }

  return {
    state:
      evidence.outcome === "confirmed"
        ? "accessed"
        : evidence.outcome === "negative"
          ? "refuted"
          : "inconclusive",
    season: evidence.lastSeason,
    seasonsObserved: evidence.seasonsAnswered,
    routeTiles: evidence.routeTilesAtLastAttempt,
    routeEvidence: evidence.routeEvidence,
    acquisition: evidence.acquisition,
    attempts: evidence.attempts,
    ...(evidence.accessFailureKind === undefined ? {} : { failureKind: evidence.accessFailureKind }),
    provesReliability: false,
    provesOtherSeasons: false,
  };
}

/**
 * §6 — the physical-access question, and ONLY that question.
 *
 *   accessFeasible = directly confirmed access
 *                    OR sufficiently supported observed access
 *
 * A direct refutation at the place searched overrides an observation, because a party stood
 * there and could not reach water. An inconclusive attempt is neutral in both directions: it
 * neither passes the gate nor closes it, which is what "we could not tell" means.
 *
 * This returns a BOOLEAN on purpose. There is no number to leak into a ranking term.
 *
 * Physical access is a property of terrain, route and hydrography, none of which vary by
 * season in this model, so a confirmation is not re-asked every season. Seasonal
 * DEPENDABILITY is a different question entirely and this function does not touch it.
 */
export function isWaterAccessFeasible(
  band: Band,
  tileId: TileId,
  observedWaterAccess: number,
  observedAccessThreshold: number,
  // CORRECTION-23C §11 arm C2 — audit-only. Undefined/false in every normal world.
  evidenceHiddenFromDestination = false,
): boolean {
  if (evidenceHiddenFromDestination) {
    return observedWaterAccess > observedAccessThreshold;
  }

  const direct = deriveDirectWaterAccess(band, tileId);

  if (direct.state === "accessed") {
    return true;
  }

  // §7 — a refutation is scoped to the bounded area the party actually searched. A route
  // failure never produces this state, because a party that could not reach the target
  // answered nothing about the target and writes no row.
  if (direct.state === "refuted" && direct.failureKind === "absent_in_bounded_search") {
    return false;
  }

  return observedWaterAccess > observedAccessThreshold;
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
