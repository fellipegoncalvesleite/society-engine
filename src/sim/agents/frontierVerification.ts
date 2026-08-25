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
import { SEASON_LENGTH_DAYS } from "../core/types";
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
import {
  deriveDirectWaterAccess,
  mayAskAgain,
  resourceTestEligible,
  taskCampRefusedByEvidence,
} from "./verificationEvidence";
import { derivePhysicalRoundTripTiming } from "./intraSeasonTrips";
// CORRECTION-23J §5 — the identity of an operation the production selector actually chose.
import { derivePendingOperationAtTile } from "./pendingOperation";
// CORRECTION-23I — audit-only refusal counting and the typed dependency shape.
import {
  isRecordingLaunchDependencies,
  recordLaunchDependency,
  recordLaunchRefusal,
  type LaunchDecisionDependency,
} from "../diagnostics/verificationLaunchDiagnostics";

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
    case "resource_test_possible": {
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
    case "seasonal_persistence": {
      // One season of coverage is exactly the state this question exists to improve.
      const seasons = record.seasonsObserved?.length ?? 0;
      // CORRECTION-23G §8 — consequential whenever the count moves the place off `unknown`,
      // which is the only way this question ever becomes askable.
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
  // CORRECTION-23H §5 — audit-only out-parameter. §5 requires EVERY eligible candidate to be
  // evaluated, not only the winner this function returns, and re-deriving the eligible set in
  // an audit would be a second copy of the selector rather than the selector. Passing an array
  // here fills it with exactly the list the production sort below consumes. Undefined in every
  // normal world; the production return value is unaffected in both cases.
  auditEligibleOut?: VerificationCandidate[],
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
  const candidateDependencies = new Map<string, LaunchDecisionDependency>();
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

      // CORRECTION-23B §11 — RETRY MEMORY, not the display ring. The 12-entry
      // `frontierVerificationAttempts` history is a read-model bound and turned over in
      // under two years, which is why one band re-verified one place 1,186 times in 500
      // years. The gate now consults the upserted evidence store, keyed by real conditions.
      if (
        !mayAskAgain(band, record.tileId, question, {
          currentTick,
          currentSeason: season,
          hardship: need.need,
          routeTiles: distance,
        }).allowed
      ) {
        continue;
      }

      // §7 Option A — a stock-backed test is only worth attempting where food was
      // physically found. This is eligibility, never support: it authorises asking a
      // harder question, and creates no patch, stock, yield or receipt.
      if (question === "resource_test_possible" && !resourceTestEligible(band, record.tileId)) {
        continue;
      }

      // ─────────────────────────────────────────────────────────────────────────────────
      // CORRECTION-23I §5/§6/§7/§8 — THE DECISION-DEPENDENCY GATE.
      //
      // Everything above establishes that the band COULD ask. This establishes that the
      // answer would change something the band is actually deciding. CORRECTION-23H measured
      // what happens without it: across 1.63 million candidates, immediate action relevance
      // never exceeded 1.5% in any world, two questions were tautological in practice
      // (confirmation rates 0.98 and 1.00), and 94% of every physically consequential answer
      // in the simulation was one branch of one question.
      //
      // A place being interesting, uncertain, distant or highly ranked is not a reason to
      // spend two people and a week of walking on it.
      // ─────────────────────────────────────────────────────────────────────────────────
      const dependency = deriveLaunchDecisionDependency(world, band, record.tileId, question, distance);

      if (dependency === undefined) {
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

      // CORRECTION-23I §5/§12 — the approved candidate carries its decision dependency, so a
      // launch can always be explained by the reason it was allowed rather than reconstructed.
      candidateDependencies.set(`${String(record.tileId)}|${question}`, dependency);

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

  if (auditEligibleOut !== undefined) {
    auditEligibleOut.push(...eligible);
  }

  if (eligible.length === 0) {
    return undefined;
  }

  const winner = [...eligible].sort((left, right) =>
    right.score === left.score
      ? String(left.tileId).localeCompare(String(right.tileId))
      : right.score - left.score,
  )[0];

  // CORRECTION-23I §12 — record the winning launch's decision dependency for the debug
  // projection and the acceptance matrix. Audit-only: a no-op when nothing is recording.
  if (winner !== undefined && isRecordingLaunchDependencies()) {
    const dependency = candidateDependencies.get(`${String(winner.tileId)}|${winner.question}`);

    if (dependency !== undefined) {
      // CORRECTION-23J §8 — stamped in DAYS. This recorded `currentTick` before, which put launch
      // records on a different timeline from the expedition and camp records they must be joined
      // to; a 90x unit mismatch cannot be paired.
      recordLaunchDependency({ ...dependency, day: deriveCurrentDay(world) });
    }
  }

  return winner;
}

/**
 * Question priority. Water first because it gates everything else physically; then whether
 * there is food at all; then whether it can actually be taken; then whether a party can stay.
 * Route and seasonal questions are lower because they refine rather than unlock.
 */
const QUESTION_PRIORITY: readonly FrontierVerificationQuestion[] = [
  "water_access",
  "resource_presence",
  "resource_test_possible",
  "temporary_use",
  "seasonal_persistence",
];

/**
 * CORRECTION-23I §8 — QUESTIONS SUSPENDED BECAUSE NOTHING PHYSICAL READS THEM.
 *
 * Not deleted, and not disabled by a flag anyone can flip: suspended, with the reason stated,
 * because each one's promised consumer has not been built.
 *
 *   `resource_presence`        its ONLY consumer is the verification selector's own
 *                              `resource_test_possible` gate below. A confirmed presence makes
 *                              a second question askable and no physical task reads that
 *                              second question's answer. The chain terminates in nothing.
 *                              CORRECTION-23H: 22,205 answers returned, zero of them moved a
 *                              reader that gates a physical action, and not one negative was
 *                              ever returned (confirmation rate 1.00).
 *   `resource_test_possible`   no production function distinguishes a confirmed result from a
 *                              negative one. Fixture H5 proved it by probing every reader in
 *                              the module against both arms.
 *   `seasonal_persistence`     no behavioural reader, and the physical task returns
 *                              `inconclusive` by construction — one visit cannot answer a
 *                              question about other seasons. 9,435 answers, all inconclusive.
 *
 * The types, the physical resolvers and the evidence shapes are all retained: they are correct,
 * they cost nothing dormant, and recreating them would be more work than keeping them. What is
 * removed is the LAUNCH — the band no longer spends two people and a week of walking to
 * establish something nothing will read.
 *
 * The stock-backed resource activity that would give the resource pair a reader belongs to the
 * next roadmap item (Resource Investigation and Temporary Use Closure) and is deliberately NOT
 * built here. §4: do not build the next roadmap system early merely to give a question a
 * reader.
 */
const SUSPENDED_QUESTIONS: ReadonlySet<FrontierVerificationQuestion> = new Set([
  "resource_presence",
  "resource_test_possible",
  "seasonal_persistence",
]);

/**
 * CORRECTION-23J §7/§13 — WHY `temporary_use` IS NOT IN THAT SET, AND IS STILL DORMANT.
 *
 * The three questions above are suspended because nothing physical reads them. `temporary_use`
 * is different: it HAS a real reader — `deriveTaskCampForOperating` — and a held negative
 * genuinely refuses a bounded camp (fixtures I5, J7). What it does not have is a seam at which a
 * party could be sent in time to inform one.
 *
 * §7 asks which of three orderings the architecture can form. It forms none:
 *
 *   Model A (operation reserved, then investigated) does not exist. `maybeLaunchExpedition`
 *     selects a candidate and calls `createPreparedExpedition`/`attachExpedition` in the same
 *     call, so no operation is ever selected-and-waiting. Measured: 4,186,352 refusals for
 *     `no_selected_operation` against 27 evaluations that found a genuinely pending one.
 *   Model B (the selector blocked by temporary-use evidence, re-evaluating after an answer)
 *     does not exist either. `taskCampRefusedByEvidence` has exactly one production reader and
 *     it runs on ARRIVAL, inside the operating step — never in candidate selection.
 *   Model C therefore holds, and the arithmetic says why. A camp is only decided when the
 *     outbound leg is at least a day, so the decision falls `legDays` after the operation
 *     leaves; the verification party needs `2 * legDays + VERIFICATION_ON_SITE_DAYS`. The
 *     second is greater than the first for every leg length there is. Of the 27 evaluations
 *     that reached a pending operation, 25 failed exactly here.
 *
 * So the launch gate below is written in full and correctly, and it admits nothing: zero
 * production launches across eleven worlds x five seeds x 40 and 200 years. This is deliberately
 * NOT expressed as a name in `SUSPENDED_QUESTIONS`. The dormancy is a physical consequence, and
 * writing it as policy would hide the fact that the question becomes askable the moment a real
 * pre-operation seam exists — at which point the gate opens by itself, with no rule to revisit.
 *
 * The question's type, its physical resolver in `expedition.ts`, its evidence shape and its
 * reader are all retained and all correct. The operation-reservation seam that would feed them
 * belongs to Resource Investigation / Temporary Use Closure and is deliberately NOT built here.
 */

/**
 * §6.2 Case B — the actions production itself declares it is taking toward an opportunity. Used
 * as the imminence test rather than a new threshold, so "imminent" means what the daughter
 * colonization authority already means by it.
 */
const IMMINENT_COLONIZATION_ACTIONS: ReadonlySet<string> = new Set([
  "probe",
  "seek_new_range",
  "fission_toward_opportunity",
]);

/**
 * CORRECTION-23I §5 — THE TYPED DECISION DEPENDENCY.
 *
 * Returns the dependency when this question at this place can change a concrete decision the
 * band is making now, and `undefined` when it cannot. Every input is band-known state, a
 * current production decision input, a current pending physical activity, or canonical reader
 * output. Nothing here reads hidden ecology, the answer the party would obtain, future
 * population, future stock, or a benchmark result.
 */
/**
 * The elapsed DAY, not the seasonal tick.
 *
 * CORRECTION-23J §8 requires launch and camp-decision days on one timeline, and expedition
 * records are stamped in days. `world.time.day` is the authority; the fallback reproduces
 * `getWorldTimeForTick`'s own conversion for a world constructed without it.
 */
function deriveCurrentDay(world: WorldState): number {
  const day = world.time.day;
  return day === undefined ? Number(world.time.tick) * SEASON_LENGTH_DAYS : Number(day);
}

function deriveLaunchDecisionDependency(
  world: WorldState,
  band: Band,
  tileId: TileId,
  question: FrontierVerificationQuestion,
  distanceTiles: number,
): LaunchDecisionDependency | undefined {
  if (SUSPENDED_QUESTIONS.has(question)) {
    recordLaunchRefusal(question, "question_suspended_no_reader");
    return undefined;
  }

  if (question === "water_access") {
    const opportunity = band.carryingCapacity?.knownUnusedHabitat;

    // §6.2 — both cases require this place to BE the candidate the destination authority is
    // currently working with. §6.1 explicitly rejects the weaker rule ("some list candidate's
    // gate could hypothetically move"), which would preserve the existing over-launch: a
    // hypothetical negative moves the gate for most currently permitted candidates.
    if (opportunity === undefined || String(opportunity.candidateTileId) !== String(tileId)) {
      recordLaunchRefusal(question, "not_selected_or_imminent");
      return undefined;
    }

    // A settled direct answer means there is nothing left to establish.
    const direct = deriveDirectWaterAccess(band, tileId);

    if (direct.state === "accessed" || direct.state === "refuted") {
      recordLaunchRefusal(question, "already_settled_directly");
      return undefined;
    }

    // Case A — the candidate is rejected, and water is the ONLY reason. `waterAccessIsBinding
    // Blocker` is computed inside the destination reader where the yield term, the competition
    // margin and the risk term are all in scope, so this is not an approximation of the gate:
    // it is the gate's own statement that a confirmation would flip it.
    if (opportunity.consideredAsTarget !== true) {
      if (opportunity.waterAccessIsBindingBlocker !== true) {
        recordLaunchRefusal(
          question,
          opportunity.rejectionReason === "insufficient_water_reliability"
            ? "non_water_requirement_fails"
            : "water_not_the_binding_blocker",
        );
        return undefined;
      }

      return {
        bandId: String(band.id),
        day: 0,
        question,
        targetTileId: String(tileId),
        blockedOrImminentAction: `consider ${String(tileId)} as a destination`,
        authoritativeReader: "carryingCapacity.deriveKnownUnusedHabitat / isWaterAccessFeasible",
        baselineVerdict: "rejected — insufficient_water_reliability",
        possibleConfirmedVerdict: "eligible — every other requirement already passes",
        possibleNegativeVerdict: "still rejected, and the band stops re-considering it",
        exactReasonTheAnswerIsNeeded:
          "water access is the single failing conjunct of consideredAsTarget at the selected candidate",
        launchCase: "case_a_confirmation_unlocks",
      };
    }

    // Case B — the candidate is currently SELECTED, its water verdict rests only on coarse
    // observation, and production has declared it is acting toward it. A bounded negative
    // would cancel that action. `state === "unasked"` above already established there is no
    // direct evidence, so the current verdict is the observation's.
    const colonization = band.carryingCapacity?.daughterColonization;
    const imminent =
      colonization !== undefined &&
      IMMINENT_COLONIZATION_ACTIONS.has(String(colonization.recommendedAction));

    if (!imminent) {
      recordLaunchRefusal(question, "not_selected_or_imminent");
      return undefined;
    }

    return {
      bandId: String(band.id),
      day: 0,
      question,
      targetTileId: String(tileId),
      blockedOrImminentAction: `${String(colonization?.recommendedAction)} toward ${String(tileId)}`,
      authoritativeReader: "carryingCapacity.deriveKnownUnusedHabitat / isWaterAccessFeasible",
      baselineVerdict: "eligible on coarse observed water alone; no direct access established",
      possibleConfirmedVerdict: "unchanged — the candidate stays eligible, now on direct evidence",
      possibleNegativeVerdict: "the candidate is cancelled before the band commits to it",
      exactReasonTheAnswerIsNeeded:
        "a selected destination is resting on an unverified water observation and the band is about to act on it",
      launchCase: "case_b_negative_vetoes",
    };
  }

  if (question === "temporary_use") {
    // CORRECTION-23J §6 — EIGHT CONDITIONS, IN ORDER, EACH REFUSING FOR ITS OWN REASON.
    //
    // CORRECTION-23I gated this on "a patch is remembered here OR any party is away toward this
    // tile". §3 dismantled both halves: memory is not intent, and a `returning` party has already
    // taken the decision the answer was supposed to inform. What replaces them is the operation
    // itself — named, selected by the production activity selector, and still short of its camp
    // decision.
    const day = deriveCurrentDay(world);
    const operation = derivePendingOperationAtTile(band.expeditions, tileId, day);

    // (1) and (2) — a concrete operation, selected, at exactly this tile. `derivePendingOperation
    // AtTile` matches on target identity and rejects every task family that has no destination,
    // so a patch memory or a candidate-list entry can no longer reach this line at all.
    if (operation === undefined) {
      recordLaunchRefusal(question, "no_selected_operation");
      return undefined;
    }

    // (4) — the camp decision must still be ahead of it. Enforced twice on purpose: the identity
    // itself admits only `prepared` and `outbound`, and rejects a party whose arrival day has
    // already passed. `returning`, `completed`, `aborted` and `lost` can never appear here.
    if (operation.expectedOperatingDay <= day) {
      recordLaunchRefusal(question, "operation_camp_decision_already_passed");
      return undefined;
    }

    // (3) and (6) — the route and duration must actually imply a camp decision. A same-day
    // target never reaches the reader (`deriveTaskCampForOperating` returns early), so a bounded
    // negative could not prevent or alter anything about this operation.
    const verificationTiming = derivePhysicalRoundTripTiming(
      world,
      band,
      operation.routeTileIds,
      VERIFICATION_ON_SITE_DAYS,
      "selected_reconnaissance_party",
    );
    if (!operation.requiresTaskCampDecision || verificationTiming.sameDay) {
      recordLaunchRefusal(question, "operation_needs_no_camp_decision");
      return undefined;
    }

    // (5) — a settled negative has already decided it; there is nothing left to establish.
    if (taskCampRefusedByEvidence(band, tileId)) {
      recordLaunchRefusal(question, "already_settled_directly");
      return undefined;
    }

    // (7) — THE PHYSICAL ORDERING TEST, and the one §7 turns on. The party must be able to walk
    // out, do the bounded on-site work, and walk home before the operation arrives at its target.
    // No allowance, no rounding in the question's favour: an answer that lands after the camp
    // decision informed nothing, and crediting it would be exactly the retrospective attribution
    // §3.3 forbids.
    const daysUntilCampDecision = operation.expectedOperatingDay - day;
    const roundTripDays = verificationTiming.totalDays;

    if (!Number.isFinite(roundTripDays) || roundTripDays > daysUntilCampDecision) {
      recordLaunchRefusal(question, "answer_cannot_return_before_camp_decision");
      return undefined;
    }

    // (8) — the named operation must consume the answer inside one season. A decision further
    // out than that is not the decision this party is being sent for.
    if (daysUntilCampDecision > SEASON_LENGTH_DAYS) {
      recordLaunchRefusal(question, "consumption_beyond_one_season");
      return undefined;
    }

    return {
      bandId: String(band.id),
      day: 0,
      question,
      targetTileId: String(tileId),
      blockedOrImminentAction: `${operation.activityKind} ${operation.operationId} reaches ${String(tileId)} on day ${operation.expectedOperatingDay} and decides its camp`,
      authoritativeReader: "expedition.deriveTaskCampForOperating / taskCampRefusedByEvidence",
      baselineVerdict: "a bounded task camp for that operation is currently permitted",
      possibleConfirmedVerdict: "unchanged — absence of evidence already permitted the camp",
      possibleNegativeVerdict: "that operation's bounded task camp is refused and it shuttles or leaves",
      exactReasonTheAnswerIsNeeded:
        "one selected operation will decide a task camp at this place before the answer goes stale",
      launchCase: "case_b_negative_vetoes",
      pendingOperation: operation,
    };
  }

  return undefined;
}

/** Re-exported so the audit and the projection classify launches by the same rule. */
export function isSuspendedVerificationQuestion(question: FrontierVerificationQuestion): boolean {
  return SUSPENDED_QUESTIONS.has(question);
}

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
    case "resource_test_possible": {
      const richness = record.observedRichness ?? 0;
      if (richness < VERIFICATION_MIN_PROMISE) return undefined;
      return {
        promise: clamp01(richness) * 0.9,
        promisingSignal: "food was physically found here",
        missingEvidence: "whether a real take is worth attempting at all",
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
    case "seasonal_persistence": {
      const seasons = record.seasonsObserved?.length ?? 0;
      // CORRECTION-23G §8 — consequential when the count leaves a real gap to describe.
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
