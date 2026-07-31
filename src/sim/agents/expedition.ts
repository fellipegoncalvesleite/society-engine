// EXPEDITIONARY-2 — the authoritative multi-day expedition lifecycle.
//
// An expedition is a MORE CAPABLE LIFECYCLE of the same task-group/party system that
// `intraSeasonTrips.ts` already owns — not a second simulator. It reuses that module's
// trip record, its passable-route builder, and its physical harvest resolution, and it
// delivers its result through the SAME `recentIntraSeasonTrips` → `humanFoodSupport`
// ledger. What it adds is the physics the daily path never had: real outbound days, a
// physical position while away, provisions that are eaten, a carry ceiling, a return
// leg, and a receipt that only exists once the party is physically home.
//
// THE BOUNDARY (EXPEDITIONARY-2 §1): duration, not distance, decides the path.
// `deriveSameDayRoundTripFeasible` asks whether the round trip fits the genuine
// same-day budget. If it does, the ordinary same-day trip path handles it, unchanged.
// If it does not, the work belongs here — including the former 5–10-tile band that used
// to be LABELLED "overnight"/"continues" while still crediting food instantly on the
// departure day. That instant credit was a teleport, and it is now removed.
//
// Determinism: no randomness. Every branch reads band-known state, the physical world,
// or a deterministic hash of stable identity. Bands and expeditions are iterated in
// sorted id order.
import type { DayNumber, ReasonId, TileId } from "../core/types";
import { isBandPassableDestination } from "../world/passability";
import { hashSeedString } from "../core/seededVariation";
import { getWorldTimeForDay } from "../tick/time";
import type { WorldState } from "../world/types";
import type { DailyAction } from "./dailyActions";
import { deriveCarriedWaterRelief, deriveCarryingRelief } from "./adaptationBoundary";
import {
  KM_PER_TILE,
  deriveAvailableMobilityPools,
  deriveTravelPace,
  recordExpeditionDistance,
  recordWalkingDay,
  selectPartyComposition,
  type TravelContext,
} from "./bandMobility";
import {
  applyActivityOutcomeToMemoryForWorld,
  buildExpeditionRouteTiles,
  compareExpeditionBands,
  deriveTripDurationDays,
  isActiveExpeditionBand,
  isFoodClass,
  resolveExpeditionTargetWork,
  selectExpeditionTripCandidate,
} from "./intraSeasonTrips";
import {
  applyVerificationObservationToMemory,
  effectiveResourceConfidence,
  type ResourcePatchMemory,
  type VerificationObservationKind,
} from "./resourceKnowledge";
import { depositFoodReceipts } from "./seasonalFoodReceipts";
import {
  buildFrontierCountryObservation,
  buildFrontierPlan,
  chooseNextFrontierStep,
  deriveFrontierExplorationEligibility,
  deriveFrontierHeading,
  deriveOutwardTilesRemaining,
  retainFrontierObservations,
} from "./frontierExploration";
import {
  recordPlaceDisposition,
  recordVerificationEvidence,
  taskCampRefusedByEvidence,
} from "./verificationEvidence";
import {
  VERIFICATION_ACTIVE_CAP,
  VERIFICATION_ON_SITE_DAYS,
  buildVerificationPlan,
  deriveVerificationNeed,
  makeVerificationReasonId,
  recordVerificationAttempt,
  type VerificationNeed,
  selectVerificationCandidate as selectFrontierVerificationCandidate,
} from "./frontierVerification";
import { observeTileAndNearby } from "./tileObservation";
// CORRECTION-23I — audit-only launch/consumption diagnostics; no-ops when unregistered.
import { getNeighborTiles, getTile } from "../world/generate";
// CORRECTION-24A §8 — audit-only exploration funnel; no-ops when unregistered.
import {
  amendExplorationJourney,
  classifyExplorationOpportunity,
  isExplorationPriorityArm,
  isFallthroughRepairArm,
  isRecordingExplorationFunnel,
  isRecordingExplorationJourneys,
  isRecordingExplorationRecords,
  noteClaimFailure,
  noteFrontierStepDay,
  recordExplorationJourney,
  recordExplorationRecord,
  takeFrontierStepDays,
  noteExplorationNotOffered,
  noteExplorationOffered,
  noteProposalCandidates,
  recordExplorationFunnel,
  takeExplorationOfferState,
  takeProposalCandidates,
  type PostClaimFailure,
  type SchedulerFamily,
  type SchedulerFamilyLedgerRow,
  type SchedulerOutcome,
} from "../diagnostics/explorationFunnelDiagnostics";
import {
  isCountingTaskCampOutcomes,
  isRecordingVerificationJourneys,
  recordTaskCampOutcome,
  recordVerificationDeparture,
  recordVerificationReturn,
} from "../diagnostics/verificationLaunchDiagnostics";
import {
  SIGNAL_ATTEMPT_CAP,
  appendReceivedSignal,
  findUnderstoodSignal,
  resolveSmokeSignal,
} from "./fireSignals";
import type { KnowledgeAcquisitionKind } from "../knowledge/types";
import type {
  Band,
  ExpeditionCargo,
  ExpeditionObservation,
  ExpeditionOutcomeReason,
  ExpeditionOutcomeSummary,
  ExpeditionPartyComposition,
  ExpeditionPhase,
  ExpeditionRecord,
  ExpeditionTaskCamp,
  ExpeditionTaskKind,
  IntraSeasonTripRecord,
  ReceivedSmokeSignal,
} from "./types";

// ── Bounds. Every one of these is a hard cap on state or search, never a tuning dial. ──

// CORRECTION-23J §5 — the travel pace now lives in `pendingOperation.ts`, which must be
// importable by `frontierVerification.ts` (this module imports THAT one, so it cannot be the
// owner without closing a cycle). Re-exported under its original name so every existing reader
// is unaffected.
export { EXPEDITION_BASE_TILES_PER_DAY } from "./pendingOperation";
import { EXPEDITION_BASE_TILES_PER_DAY } from "./pendingOperation";
/**
 * Ceiling on how far out an expedition may plan; derived reach is normally far lower.
 * §17 — this is a TECHNICAL search bound, not a behavioral range: at 36 tiles (54 km)
 * a well-found party can physically walk ~100+ km out-and-back inside the duration
 * window, while provisions, pace, fatigue, and candidate selection keep ordinary
 * expeditions far shorter. An arbitrary small cap here must never be what blocks a
 * long journey — the physical budgets are.
 */
export const EXPEDITION_MAX_ROUTE_TILES = 36;
/** A party may not stay out longer than this; exceeding it makes it overdue, then lost. */
export const EXPEDITION_MAX_DURATION_DAYS = 24;
/** Concurrent away parties per band. */
export const EXPEDITION_ACTIVE_CAP = 2;
/** Bounded terminal history per band. */
export const EXPEDITION_OUTCOME_CAP = 6;
/** Bounded carried observations per party. */
export const EXPEDITION_OBSERVATION_CAP = 6;
/** Bounded work days at the target before the party must turn for home. */
export const EXPEDITION_MAX_WORK_DAYS = 3;
/** Harvest units one worker can physically carry home. */
export const EXPEDITION_CARRY_UNITS_PER_WORKER = 0.12;
/**
 * Harvest units one worker eats per day away (trip-local provisioning; never a store).
 *
 * Scale note: harvest units are a fraction of ONE patch's seasonal availability (a
 * per-trip draw is capped around 0.5, see intraSeasonTrips `deriveResourceReturnRecord`),
 * so a party's own subsistence has to be a small fraction of a take — at a larger rate a
 * party mathematically eats its entire cargo on every trip and nothing can ever come
 * home, which is physically wrong rather than merely pessimistic. This is a real,
 * non-trivial cost (a long trip with a poor take can still net ~zero, which is the
 * intended "expeditions are not free" outcome) but it does not make delivery impossible.
 */
export const EXPEDITION_PROVISION_UNITS_PER_WORKER_DAY = 0.0008;

/**
 * The genuine same-day envelope: can a party walk to `distanceTiles` and back within one
 * activity day? This — not a distance constant — is what separates the two paths.
 */
export function deriveSameDayRoundTripFeasible(distanceTiles: number): boolean {
  return distanceTiles * 2 <= EXPEDITION_BASE_TILES_PER_DAY * 2;
}

/** Deterministic expedition identity from stable band/target/day facts. No counters, no clock. */
export function deriveExpeditionId(
  bandId: string,
  targetTileId: TileId,
  taskKind: ExpeditionTaskKind,
  day: DayNumber,
): string {
  const seed = hashSeedString(`expedition:${bandId}:${targetTileId}:${taskKind}:${Number(day)}`);
  return `expedition:${bandId}:${Number(day)}:${taskKind}:${seed.toString(16)}`;
}

/**
 * Working adults currently committed to away parties. The residential band physically
 * does not have these people: they are subtracted exactly once, here, and become
 * available again only when the party reaches home (or is declared lost).
 */
export function getCommittedExpeditionWorkers(band: Band): number {
  return (band.expeditions ?? [])
    .filter((expedition) => isExpeditionAway(expedition.phase))
    .reduce((total, expedition) => total + expedition.partyWorkers, 0);
}

/** Working adults still physically at the residential camp and available for local work. */
export function getResidentialWorkingAdults(band: Band): number {
  return Math.max(0, band.demography.workingAdults - getCommittedExpeditionWorkers(band));
}

function isExpeditionAway(phase: ExpeditionPhase): boolean {
  return phase === "prepared" || phase === "outbound" || phase === "operating" || phase === "returning";
}

function isTerminalPhase(phase: ExpeditionPhase): phase is "completed" | "aborted" | "lost" {
  return phase === "completed" || phase === "aborted" || phase === "lost";
}

/** A party's physical carry ceiling: workers, minus injury, plus any practiced carrying relief. */
export function deriveCarryCapacityUnits(
  band: Band,
  partyWorkers: number,
  injuryLoad: number,
  currentTick: number,
): number {
  const carryingRelief = deriveCarryingRelief(band, currentTick);
  const reliefFactor = 1 + Math.max(0, Math.min(0.24, carryingRelief.relief ?? 0));
  const injuryFactor = Math.max(0.35, 1 - injuryLoad);
  return round4(partyWorkers * EXPEDITION_CARRY_UNITS_PER_WORKER * reliefFactor * injuryFactor);
}

/**
 * Tiles a party covers today. Load and injury slow it; practiced carrying/water handling
 * (through the public adaptation boundary only) recover part of that loss. Bounded to at
 * least one tile so a party can never be permanently frozen mid-route.
 */
function deriveTilesPerDay(band: Band, expedition: ExpeditionRecord, currentTick: number): number {
  const carried = expedition.cargo.harvestUnits;
  const capacity = Math.max(0.0001, expedition.cargo.carryCapacityUnits);
  const loadRatio = Math.max(0, Math.min(1, carried / capacity));
  // EXPEDITIONARY-4 §6 — pace comes from the ONE canonical travel-pace boundary, in the
  // travel context this party is physically in: an injured party limps, a loaded return
  // party is slower than its own outbound leg, an information party travels light, and
  // an ordinary resource party walks at party capacity. Urgency (food stress) raises
  // willingness inside the authority; it cannot manufacture stamina. The party's §8
  // pool composition shapes its pace: who walks decides how far the party goes.
  const urgency = Math.max(0, Math.min(1, band.pressureState?.foodStress ?? 0));
  const context: TravelContext =
    expedition.injuryLoad > 0.25
      ? "delayed_or_injured_party"
      : loadRatio > 0
        ? "loaded_return_party"
        : expedition.taskKind === "distant_patch_verification" ||
            expedition.taskKind === "route_reconnaissance" ||
            // CORRECTION-17 §7 — a frontier party travels light and carries no cargo, so
            // it uses the SAME reconnaissance pace every other information party uses. It
            // is not faster because the band is hungry: `urgency` enters the shared pace
            // authority identically for all five task families, and this checkpoint adds
            // no frontier-specific speed, stamina, or duration term anywhere.
            expedition.taskKind === "frontier_exploration" ||
            expedition.taskKind === "frontier_verification"
          ? "selected_reconnaissance_party"
          : "resource_expedition";
  const pace = deriveTravelPace(band, context, {
    loadRatio,
    urgency,
    injuryLoad: expedition.injuryLoad,
    partyComposition: expedition.partyComposition,
  });
  // Practiced carrying/water handling (public adaptation boundary only) recovers part of
  // the load cost — learned technique, kept distinct from bodily conditioning.
  const carryingRelief = deriveCarryingRelief(band, currentTick);
  const waterRelief = deriveCarriedWaterRelief(band, currentTick);
  const reliefFactor =
    1 +
    Math.max(0, Math.min(0.2, carryingRelief.relief ?? 0)) +
    Math.max(0, Math.min(0.1, waterRelief.relief ?? 0));
  return Math.max(1, Math.floor(pace.tilesPerTravelDay * reliefFactor));
}

/**
 * A party establishes a temporary operating base only when the physical route/target
 * justifies it (the walk home is longer than a day) AND the ground can host one
 * (§16 local feasibility: dry, not flood-prone). It is not a settlement, holds
 * nothing, and expires. Establishment costs real labor/provisions (charged by the
 * caller, once); its benefit is equally physical — the party sleeps at its work
 * instead of shuttling to safe ground every evening.
 */
/**
 * CORRECTION-23I §7 — audit-only wrapper around the camp-outcome counter, so the four call
 * sites above stay one line each. A no-op, and one boolean test, when no audit is counting.
 */
function recordCampOutcome(
  expedition: ExpeditionRecord,
  day: DayNumber,
  reachedEvidenceReader: boolean,
  refusedByEvidence: boolean,
  blockedBefore?: "already_camped" | "same_day_reach" | "unusable_ground",
): void {
  if (!isCountingTaskCampOutcomes()) {
    return;
  }

  recordTaskCampOutcome({
    bandId: String(expedition.bandId),
    tileId: String(expedition.positionTileId),
    day: Number(day),
    // CORRECTION-23J §8 — the operation that took this decision, so a camp refusal can be joined
    // to the launch that named it instead of only counted in a total.
    operationId: expedition.id,
    activityKind: expedition.taskKind,
    reachedEvidenceReader,
    refusedByEvidence,
    ...(blockedBefore === undefined ? {} : { blockedBefore }),
  });
}

function deriveTaskCampForOperating(
  world: WorldState,
  expedition: ExpeditionRecord,
  day: DayNumber,
): ExpeditionTaskCamp | undefined {
  const homeLegDays = Math.ceil(expedition.routeTileIds.length / EXPEDITION_BASE_TILES_PER_DAY);

  if (homeLegDays < 1 || expedition.taskCamp !== undefined) {
    // CORRECTION-23I §7 — audit-only. A party that already has a camp, or whose work is inside
    // same-day reach, never reaches the evidence reader: those are not attempted camps and
    // must not be counted as ones the evidence could have prevented.
    recordCampOutcome(
      expedition,
      day,
      false,
      false,
      expedition.taskCamp !== undefined ? "already_camped" : "same_day_reach",
    );
    return expedition.taskCamp;
  }

  const standTile = world.tiles[expedition.positionTileId];

  // §16 — no dry, tolerable ground: no camp. The party pays the nightly shuttle instead.
  if (standTile === undefined || standTile.isAquatic === true || standTile.riskProfile.floodRisk > 0.75) {
    recordCampOutcome(expedition, day, false, false, "unusable_ground");
    return undefined;
  }

  // CORRECTION-23B §9 — THE TEMPORARY-USE READER. Bounded operation evidence gates bounded
  // operation, and nothing wider: a party that already tried to stay here and could not
  // does not camp here again. This authorises no residence, anchor, storage or claim — the
  // task-camp record asserts all three non-claims below — and it reads only the band's own
  // physically established answer to the temporary-use question at THIS tile.
  const campingBand = world.bands[expedition.bandId];

  const refusedByEvidence =
    campingBand !== undefined && taskCampRefusedByEvidence(campingBand, expedition.positionTileId);

  // CORRECTION-23I §7 — audit-only, and this is THE measurement the section turns on. Reaching
  // this line means every physical precondition already passed, so the camp was genuinely
  // attempted and only the band's own evidence decides it.
  recordCampOutcome(expedition, day, true, refusedByEvidence);

  if (refusedByEvidence) {
    return undefined;
  }

  return {
    tileId: expedition.positionTileId,
    establishedDay: day,
    expiresOnDay: (Number(day) + EXPEDITION_MAX_WORK_DAYS + homeLegDays) as DayNumber,
    reason: homeLegDays > 1 ? "leg_staging" : "repeated_retrieval",
    usedDays: 1,
    noResidentialRelocation: true,
    noStorage: true,
    noTerritoryClaim: true,
  };
}

/** §16 — one-off physical establishment cost: setup labor eats a real provision share. */
const TASK_CAMP_SETUP_PROVISION_WORKER_DAYS = 0.5;
/** §16 — a campless party shuttles to safe ground nightly: real tiles walked per work day. */
const CAMPLESS_BACKTRACK_TILES_PER_WORK_DAY = 4;
/** §16 — the nightly shuttle also costs extra provisions (in worker-day equivalents). */
const CAMPLESS_EXTRA_PROVISION_WORKER_DAYS = 0.5;

/** Provisions the party eats today. Consumed from what it carries — never from a band store. */
function consumeProvisions(expedition: ExpeditionRecord): ExpeditionCargo {
  const eaten = round4(expedition.partyWorkers * EXPEDITION_PROVISION_UNITS_PER_WORKER_DAY);
  return {
    ...expedition.cargo,
    provisionUnitsConsumed: round4(expedition.cargo.provisionUnitsConsumed + eaten),
  };
}

/**
 * Has the party eaten more than the trip can physically justify? Provisions are drawn
 * against what the party can carry/gather; running past that is a real physical failure
 * that forces an early return rather than a free extension.
 */
function provisionsExhausted(expedition: ExpeditionRecord): boolean {
  const budget = round4(
    expedition.partyWorkers * EXPEDITION_PROVISION_UNITS_PER_WORKER_DAY * EXPEDITION_MAX_DURATION_DAYS,
  );
  return expedition.cargo.provisionUnitsConsumed > budget;
}

/**
 * The physical receipt that reaches the residential camp. The party ate part of what it
 * took, and it could only carry so much; both reductions are applied HERE, once, to the
 * receipt resolved at the target. A party that ate more than it took delivers nothing.
 */
function buildReturnedRecord(expedition: ExpeditionRecord, day: DayNumber): IntraSeasonTripRecord | undefined {
  const pending = expedition.pendingReturnRecord;

  if (pending?.physicalFoodHarvest === undefined) {
    return undefined;
  }

  const time = getWorldTimeForDay(day);
  const harvest = pending.physicalFoodHarvest;
  const carried = Math.max(0, Math.min(expedition.cargo.harvestUnits, expedition.cargo.carryCapacityUnits));
  const afterProvisions = Math.max(0, carried - expedition.cargo.provisionUnitsConsumed);
  const takenAtTarget = Math.max(0.0001, harvest.usableSupport);
  const deliveredFraction = Math.max(0, Math.min(1, afterProvisions / takenAtTarget));
  const usableSupport = round4(harvest.usableSupport * deliveredFraction);
  const returnedResourceKind = usableSupport > 0 ? pending.resourceReturn.returnedResourceKind : "none";

  return {
    ...pending,
    // The receipt is dated to the RETURN — this is what makes it enter the season's
    // ledger only now, and only once.
    day,
    tick: time.tick,
    endDay: day,
    physicalFoodHarvest: {
      ...harvest,
      usableSupport,
      reasonIds: [...harvest.reasonIds, `reason:expedition-return:${expedition.id}` as ReasonId],
    },
    resourceReturn: {
      ...pending.resourceReturn,
      returnedResourceKind,
      estimatedReturnValue: usableSupport,
      // The single gate the canonical ledger reads. Nothing the party did before this
      // moment set it true.
      consumedByEconomy: usableSupport > 0,
    },
    reasonIds: [...pending.reasonIds, `reason:expedition-return:${expedition.id}` as ReasonId],
  };
}

function summarizeOutcome(
  expedition: ExpeditionRecord,
  phase: "completed" | "aborted" | "lost",
  reason: ExpeditionOutcomeReason,
  deliveredUnits: number,
): ExpeditionOutcomeSummary {
  const time = getWorldTimeForDay(expedition.departedDay);
  return {
    id: expedition.id,
    tick: time.tick,
    taskKind: expedition.taskKind,
    targetTileId: expedition.targetTileId,
    phase,
    outcomeReason: reason,
    distanceTiles: Math.max(0, expedition.routeTileIds.length - 1),
    totalDays: expedition.travelDaysElapsed + expedition.workDaysElapsed,
    partyWorkers: expedition.partyWorkers,
    deliveredHarvestUnits: round4(deliveredUnits),
    provisionUnitsConsumed: expedition.cargo.provisionUnitsConsumed,
    lostUnits: expedition.cargo.lostUnits,
    injuryLoad: expedition.injuryLoad,
    usedTaskCamp: expedition.taskCamp !== undefined,
    // §11 — what the party physically brought home (only meaningful when it returned).
    ...(phase === "completed" && expedition.carriedObservations.length > 0
      ? { observations: expedition.carriedObservations }
      : {}),
  };
}

/** Create a prepared expedition. Called by the decision path when the candidate wins. */
export function createPreparedExpedition(params: {
  readonly band: Band;
  readonly taskKind: ExpeditionTaskKind;
  readonly targetTileId: TileId;
  readonly targetPatchId: string;
  readonly routeTileIds: readonly TileId[];
  readonly partyWorkers: number;
  readonly partyComposition?: ExpeditionPartyComposition;
  readonly day: DayNumber;
}): ExpeditionRecord {
  const { band, taskKind, targetTileId, targetPatchId, routeTileIds, partyWorkers, partyComposition, day } = params;
  const time = getWorldTimeForDay(day);
  const legDays = Math.ceil((routeTileIds.length - 1) / EXPEDITION_BASE_TILES_PER_DAY);
  const plannedDays = Math.min(EXPEDITION_MAX_DURATION_DAYS, legDays * 2 + EXPEDITION_MAX_WORK_DAYS);
  return {
    id: deriveExpeditionId(band.id, targetTileId, taskKind, day),
    bandId: band.id,
    taskKind,
    phase: "prepared",
    originTileId: band.position,
    targetTileId,
    targetPatchId,
    routeTileIds,
    positionTileId: band.position,
    routeIndex: 0,
    departedDay: day,
    departedTick: time.tick,
    plannedReturnDay: (Number(day) + plannedDays) as DayNumber,
    hardDeadlineDay: (Number(day) + EXPEDITION_MAX_DURATION_DAYS) as DayNumber,
    travelDaysElapsed: 0,
    workDaysElapsed: 0,
    partyWorkers,
    ...(partyComposition === undefined ? {} : { partyComposition }),
    cargo: {
      harvestUnits: 0,
      lostUnits: 0,
      provisionUnitsConsumed: 0,
      carryCapacityUnits: deriveCarryCapacityUnits(band, partyWorkers, 0, Number(time.tick)),
    },
    injuryLoad: 0,
    riskEpisodeIds: [],
    carriedObservations: [],
    reasonIds: [`reason:expedition-launch:${band.id}:${Number(day)}:${taskKind}:${targetTileId}` as ReasonId],
    noResidentialRelocation: true,
    bandKnownTargetOnly: true,
  };
}

/** Attach a prepared expedition to a band, respecting the concurrency cap. */
export function attachExpedition(band: Band, expedition: ExpeditionRecord): Band {
  const active = (band.expeditions ?? []).filter((current) => isExpeditionAway(current.phase));

  if (active.length >= EXPEDITION_ACTIVE_CAP) {
    return band;
  }

  return { ...band, expeditions: [...(band.expeditions ?? []), expedition] };
}

interface AdvanceResult {
  readonly world: WorldState;
  readonly expedition: ExpeditionRecord;
  /** Set only on the day the party physically reaches home with something to deposit. */
  readonly depositRecord?: IntraSeasonTripRecord;
  /**
   * EXPEDITIONARY-3 — kilometres the party PHYSICALLY covered today, and whether any of
   * it was under load. Realized history is written from this and nothing else, which is
   * why the reported walking average can never drift from what actually happened.
   */
  readonly walkedKm?: number;
  readonly walkedLoadedKm?: number;
  readonly walkSource?: "expedition_outbound" | "expedition_return" | "expedition_operating";
  /**
   * §13 — a smoke signal the RESIDENTIAL camp physically received today from this
   * party. The only pre-return information channel; bounded meaning only.
   */
  readonly receivedSignal?: ReceivedSmokeSignal;
}

/**
 * CORRECTION-17 §9/§10/§13 — ONE outbound day of a frontier exploration.
 *
 * The party takes up to `tilesPerDay` SUCCESSIVE physical steps. Before each step it
 * re-derives how much outward walking it may still afford while RESERVING enough
 * capacity to retrace its own trail home (§10). The moment that reserve binds — or the
 * ground ahead is impassable, or the bounded trail is full — it turns for home. There is
 * no branch anywhere in this function that walks outward until the duration cap and then
 * declares success: every termination below names a physical reason.
 *
 * `tilesPerDay` is the party's real physical pace, produced by the same canonical
 * travel-pace authority every other party uses. Nothing here consults food stress.
 */
function advanceFrontierExplorationOutboundDay(
  world: WorldState,
  expedition: ExpeditionRecord,
  tilesPerDay: number,
  day: DayNumber,
): AdvanceResult {
  const plan = expedition.frontierPlan;

  if (plan === undefined) {
    // A frontier party with no plan is a construction error, not a physical state: it
    // turns for home rather than inventing a destination.
    return {
      world,
      expedition: { ...expedition, phase: "returning", outcomeReason: "frontier_barrier_blocked" },
    };
  }

  const daysElapsed = Number(day) - Number(expedition.departedDay);
  let trail = [...expedition.routeTileIds];
  let observations: readonly ExpeditionObservation[] = expedition.carriedObservations;
  let positionTileId = expedition.positionTileId;
  let deepest = expedition.frontierDeepestReachTiles ?? 0;
  let stepsTaken = 0;
  let terminal: ExpeditionOutcomeReason | undefined;

  for (let step = 0; step < tilesPerDay; step += 1) {
    const outwardRemaining = deriveOutwardTilesRemaining({
      trailLength: trail.length,
      tilesPerDay,
      daysElapsed,
      maxDurationDays: EXPEDITION_MAX_DURATION_DAYS,
      outboundBudgetTiles: plan.outboundBudgetTiles,
    });
    const outcome = chooseNextFrontierStep(
      world,
      { ...expedition, routeTileIds: trail, positionTileId },
      outwardRemaining,
    );

    if (outcome.kind === "budget_reached") {
      terminal = "frontier_return_budget_reached";
      break;
    }

    if (outcome.kind === "blocked") {
      // A physical barrier at the party's deepest point is real evidence about the
      // country, and it is what distinguishes a blocked direction from a walkable one.
      const barrier = buildFrontierCountryObservation(world, positionTileId, Number(day));

      if (barrier !== undefined) {
        observations = [...observations, { ...barrier, kind: "frontier_barrier", confidence: 0.75 }];
      }

      terminal = "frontier_barrier_blocked";
      break;
    }

    // The party physically stepped onto a tile the residential band may never have seen.
    positionTileId = outcome.tileId;
    trail = [...trail, outcome.tileId];
    stepsTaken += 1;

    const originTile = world.tiles[expedition.originTileId];
    const standTile = world.tiles[outcome.tileId];

    if (originTile !== undefined && standTile !== undefined) {
      deepest = Math.max(
        deepest,
        Math.abs(standTile.coord.x - originTile.coord.x) + Math.abs(standTile.coord.y - originTile.coord.y),
      );
    }

    // §11/§12 — the party LOOKS from where it stands. The record is PARTY-LOCAL: it is
    // appended to `carriedObservations` and reaches residential knowledge only if this
    // party physically walks home (see the return handler in `applyExpeditionDay`).
    const seen = buildFrontierCountryObservation(world, outcome.tileId, Number(day));

    if (seen !== undefined) {
      observations = retainFrontierObservations([...observations, seen]);
    }
  }

  // §17/§11 control arm — the party that never came home. It walked and it observed;
  // at the moment it would have turned for home it is declared lost instead, so its
  // `carriedObservations` die with it and the residential band learns nothing. Undefined
  // in every normal world => this branch is never taken.
  const lostBeforeReturn =
    terminal !== undefined && world.auditOptions?.frontierExplorationAlwaysLost === true;

  // CORRECTION-24A §9 E4 — audit-only; no-op when nothing is recording.
  noteFrontierStepDay(expedition.id, stepsTaken);

  const walkedKm = stepsTaken * KM_PER_TILE;
  const moved: ExpeditionRecord = {
    ...expedition,
    routeTileIds: trail,
    // The trail is also the way home: the party stands at its end.
    routeIndex: trail.length - 1,
    positionTileId,
    travelDaysElapsed: expedition.travelDaysElapsed + 1,
    frontierDeepestReachTiles: deepest,
    carriedObservations: retainFrontierObservations(observations),
    phase: lostBeforeReturn ? "lost" : terminal === undefined ? "outbound" : "returning",
    ...(lostBeforeReturn
      ? { outcomeReason: "party_lost" as ExpeditionOutcomeReason }
      : terminal === undefined
        ? {}
        : { outcomeReason: terminal }),
  };

  return {
    world,
    expedition: moved,
    ...(walkedKm <= 0
      ? {}
      : { walkedKm, walkedLoadedKm: 0, walkSource: "expedition_outbound" as const }),
  };
}


/**
 * CORRECTION-23 §12 — resolve ONE verification question at the destination.
 *
 * Every branch reads the PHYSICAL WORLD AT THE PARTY'S FEET. That is legitimate: the party
 * is standing there. What it must not do — and does not do — is generalize. Reaching water
 * proves water is reachable today, not that it is reliable year-round. Finding a resource in
 * the bounded area searched is not proof of the catchment's total stock, and finding none is
 * not proof of absence anywhere.
 *
 * CORRECTION-23B §7 — NO question produces food. `resource_test_possible` reports whether a
 * real take is worth attempting; it does not make one. Every branch credits exactly zero.
 */
function resolveVerificationOnSite(
  world: WorldState,
  band: Band,
  expedition: ExpeditionRecord,
  day: DayNumber,
): AdvanceResult {
  const plan = expedition.verificationPlan;
  const standTile = world.tiles[expedition.positionTileId];
  const time = getWorldTimeForDay(day);


  if (plan === undefined || standTile === undefined) {
    return {
      world,
      expedition: { ...expedition, phase: "returning", outcomeReason: "verification_inconclusive" },
    };
  }

  const workDays = expedition.workDaysElapsed + 1;
  const reachedTarget = expedition.positionTileId === plan.targetTileId;

  // The party never got to the place it was sent to. That answers nothing about the place.
  if (!reachedTarget) {
    return {
      world,
      expedition: {
        ...expedition,
        phase: "returning",
        workDaysElapsed: workDays,
        outcomeReason: "route_endpoint_mismatch",
      },
    };
  }

  const finish = (
    rawOutcome: "confirmed" | "negative" | "inconclusive",
    evidenceBasis: string,
    harvestUnits = 0,
    // CORRECTION-23C §7 — the PHYSICAL SCOPE of a negative answer. Only causes the model
    // actually represents are encoded; a party that never reached the target does not
    // arrive here at all, so it can never produce a claim about the destination.
    accessFailureKind?: "absent_in_bounded_search" | "route_blocked",
  ): AdvanceResult => {
    // CORRECTION-23 CONTINUATION §9 E5 — audit-only. An affirmative answer is downgraded to
    // "we could not tell", isolating the value of confirmation from the value of asking.
    // Undefined in every normal world.
    const outcome =
      world.auditOptions?.frontierVerificationConfirmationDisabled === true && rawOutcome === "confirmed"
        ? ("inconclusive" as const)
        : rawOutcome;

    return {
    world,
    expedition: {
      ...expedition,
      phase: "returning",
      workDaysElapsed: workDays,
      outcomeReason:
        outcome === "confirmed"
          ? "verification_confirmed"
          : outcome === "negative"
            ? "verification_negative"
            : "verification_inconclusive",
      verificationResult: {
        question: plan.question,
        targetTileId: plan.targetTileId,
        outcome,
        season: time.season,
        harvested: harvestUnits > 0,
        harvestUnits: round4(harvestUnits),
        evidenceBasis,
        ...(outcome === "negative" && accessFailureKind !== undefined ? { accessFailureKind } : {}),
        reasonIds: [
          makeVerificationReasonId(String(band.id), time.tick, plan.question, outcome),
        ],
      },
      ...(harvestUnits > 0
        ? {
            cargo: {
              ...expedition.cargo,
              harvestUnits: round4(expedition.cargo.harvestUnits + harvestUnits),
            },
          }
        : {}),
    },
    };
  };

  switch (plan.question) {
    case "water_access": {
      // A person standing here can walk to the water or cannot. Adjacency and the tile's own
      // hydrography are what the party physically experiences.
      const hasWaterHere = standTile.resourceProfile.waterAccess >= 0.3;
      const adjacentWater = standTile.neighbors.some((id) => {
        const n = world.tiles[id];
        return n !== undefined && (n.isAquatic === true || n.isRiver === true || n.terrainKind === "wetlands");
      });

      return hasWaterHere || adjacentWater
        ? finish("confirmed", "the party reached water and drew from it")
        : finish(
            "negative",
            "no reachable water was found in the area the party searched",
            0,
            // §7 — scoped to the bounded area actually searched. It is NOT a claim that the
            // destination is dry, and NOT a route failure: the party got here.
            "absent_in_bounded_search",
          );
    }

    case "resource_presence": {
      // Bounded search of the stand tile only. Absence here is absence HERE.
      const present = standTile.resourceProfile.baseRichness >= 0.22;

      return present
        ? finish("confirmed", "food resources were physically found in the area searched")
        : finish("negative", "nothing usable was found in the area actually searched");
    }

    case "resource_test_possible": {
      // CORRECTION-23B §7 — this question was called `resource_usability`, which claimed
      // more than it establishes. What the party can honestly report is whether a real,
      // stock-backed take is worth attempting here: it reads the ground it is standing on,
      // draws against no patch, applies no depletion and produces no receipt.
      const richness = standTile.resourceProfile.baseRichness;

      if (richness < 0.22) {
        return finish("negative", "nothing was found worth attempting");
      }

      // Whether the attempt succeeds depends on the ground and the season, so a resource
      // that exists can still defeat a first attempt — which is the point of testing.
      const seasonLean = standTile.seasonalProfile.leanSeasons.includes(time.season);
      const attemptSucceeds = richness * (seasonLean ? 0.25 : 0.6) > 0.12;

      // CORRECTION-23B §7 Option A — NO CALORIES ARE CREDITED, DELIBERATELY.
      //
      // `plantStock.resolvePlantFoodHarvest` can resolve a real patch at an arbitrary TILE
      // and would be the legal seam for a stock-backed take, so the architecture exists.
      // But the only activity that legally reaches it — the same-day intra-season trip —
      // selects its target from patch memories, so giving verification its own call would
      // duplicate that path rather than reuse it. §7 says prefer eligibility-only unless an
      // authoritative task can consume the evidence without architectural duplication.
      //
      // So this returns EVIDENCE ONLY, under a name that says exactly that. The take itself
      // is recorded as unbuilt debt rather than faked or shortcut.
      return attemptSucceeds
        ? finish("confirmed", "the ground here is worth a real attempt")
        : finish("negative", "there is nothing here worth attempting");
    }

    case "temporary_use": {
      // Can a bounded party actually stay and work? Water, tolerable ground, tolerable risk.
      const flood = standTile.riskProfile.floodRisk;
      const liveable =
        standTile.isAquatic !== true && flood < 0.7 && standTile.resourceProfile.waterAccess >= 0.2;

      if (workDays < VERIFICATION_ON_SITE_DAYS) {
        // Staying is the test; it takes more than a day.
        return { world, expedition: { ...expedition, workDaysElapsed: workDays } };
      }

      return liveable
        ? finish("confirmed", "a small party stayed and worked here without failing")
        : finish("negative", "the party could not sustain itself here");
    }

    case "seasonal_persistence": {
      // One visit adds ONE season of coverage and cannot answer the question outright.
      const stillProductive = standTile.resourceProfile.baseRichness >= 0.22;

      return finish(
        "inconclusive",
        stillProductive
          ? `still productive in ${time.season}; other seasons remain unknown`
          : `poor in ${time.season}; other seasons remain unknown`,
      );
    }
  }
}

/** Advance ONE expedition by ONE physical day. Pure; the caller threads the world. */
function advanceExpeditionOneDay(
  world: WorldState,
  band: Band,
  expedition: ExpeditionRecord,
  day: DayNumber,
): AdvanceResult {
  if (isTerminalPhase(expedition.phase)) {
    return { world, expedition };
  }

  // Overdue past the hard window: the party did not come home. No cargo reaches camp.
  if (Number(day) > Number(expedition.hardDeadlineDay)) {
    return {
      world,
      expedition: { ...expedition, phase: "lost", outcomeReason: "party_lost" },
    };
  }

  const withProvisions: ExpeditionRecord = {
    ...expedition,
    cargo: consumeProvisions(expedition),
  };

  // Provisions gone: turn for home now, carrying whatever was already taken.
  if (provisionsExhausted(withProvisions) && withProvisions.phase !== "returning") {
    return {
      world,
      expedition: { ...withProvisions, phase: "returning", outcomeReason: "provisions_ran_out" },
    };
  }

  // §14 — a badly hurt party stops working and turns for home. It abandons the part
  // of its cargo its injured people can no longer physically carry (the injury factor
  // already slows its legs; this is the carrying consequence, applied once here).
  if (withProvisions.injuryLoad >= 0.5 && withProvisions.phase !== "returning") {
    const carryFactor = Math.max(0.35, 1 - withProvisions.injuryLoad);
    const carried = round4(withProvisions.cargo.harvestUnits * carryFactor);
    const abandoned = round4(Math.max(0, withProvisions.cargo.harvestUnits - carried));
    return {
      world,
      expedition: {
        ...withProvisions,
        phase: "returning",
        outcomeReason: "injury_forced_return",
        cargo: {
          ...withProvisions.cargo,
          harvestUnits: carried,
          lostUnits: round4(withProvisions.cargo.lostUnits + abandoned),
        },
      },
    };
  }

  const tilesPerDay = deriveTilesPerDay(band, withProvisions, Number(getWorldTimeForDay(day).tick));
  const lastIndex = withProvisions.routeTileIds.length - 1;

  if (withProvisions.phase === "prepared") {
    return {
      world,
      expedition: { ...withProvisions, phase: "outbound" },
    };
  }

  // CORRECTION-17 §9 — FRONTIER EXPLORATION walks a route it does not have. Every other
  // task family follows a `routeTileIds` path computed at launch; this one DISCOVERS its
  // route, choosing one 4-adjacent step at a time from where its feet actually are, and
  // appends each step to the trail it will later retrace home. It therefore takes its own
  // outbound branch here rather than indexing into a precomputed path.
  if (withProvisions.phase === "outbound" && withProvisions.taskKind === "frontier_exploration") {
    return advanceFrontierExplorationOutboundDay(world, withProvisions, tilesPerDay, day);
  }

  if (withProvisions.phase === "outbound") {
    const nextIndex = Math.min(lastIndex, withProvisions.routeIndex + tilesPerDay);
    const arrived = nextIndex >= lastIndex;
    const moved: ExpeditionRecord = {
      ...withProvisions,
      routeIndex: nextIndex,
      positionTileId: withProvisions.routeTileIds[nextIndex],
      travelDaysElapsed: withProvisions.travelDaysElapsed + 1,
      phase: arrived ? "operating" : "outbound",
    };
    const outboundKm = (nextIndex - withProvisions.routeIndex) * KM_PER_TILE;
    // §12 — the arriving party's bounded viewshed from its stand (and task camp, when
    // one is set up): a broad water/wetland feature on an adjacent tile is the kind of
    // physically grounded cue a person standing there cannot miss. It stays PARTY-LOCAL
    // until return (§11); no exact quantity, stock, or hidden band state is exposed.
    const arrivalObservation = arrived ? deriveArrivalViewshedObservation(world, moved, day) : undefined;
    // §16 — establishing the camp is real work: setup labor eats a provision share, once.
    const establishedCamp = arrived ? deriveTaskCampForOperating(world, moved, day) : undefined;
    const setupCost =
      arrived && establishedCamp !== undefined && moved.taskCamp === undefined
        ? round4(moved.partyWorkers * EXPEDITION_PROVISION_UNITS_PER_WORKER_DAY * TASK_CAMP_SETUP_PROVISION_WORKER_DAYS)
        : 0;
    return {
      world,
      expedition: arrived
        ? {
            ...moved,
            taskCamp: establishedCamp,
            ...(setupCost <= 0
              ? {}
              : {
                  cargo: {
                    ...moved.cargo,
                    provisionUnitsConsumed: round4(moved.cargo.provisionUnitsConsumed + setupCost),
                  },
                }),
            ...(arrivalObservation === undefined
              ? {}
              : {
                  carriedObservations: [...moved.carriedObservations, arrivalObservation].slice(
                    0,
                    EXPEDITION_OBSERVATION_CAP,
                  ),
                }),
          }
        : moved,
      walkedKm: outboundKm,
      walkedLoadedKm: 0,
      walkSource: "expedition_outbound",
    };
  }

  // CORRECTION-23 §12 — the ON-SITE VERIFICATION TASK. The party is standing at the place
  // it walked to and answers ONE question by doing something physical there. Each question
  // has its own task, its own evidence, and its own way of coming back negative.
  if (withProvisions.phase === "operating" && withProvisions.taskKind === "frontier_verification") {
    return resolveVerificationOnSite(world, band, withProvisions, day);
  }

  if (withProvisions.phase === "operating") {
    // §10 — information-only tasks never touch a stock; they carry observations home.
    // The observations are PHYSICAL: the party is standing there and looks.
    if (withProvisions.taskKind === "route_reconnaissance") {
      // The party physically walked this route; what it carries home is the lived
      // answer "this route is walkable to here" plus what it saw along the way. The
      // tiles themselves become band knowledge only at return (§11 latency).
      const observation: ExpeditionObservation = {
        tileId: withProvisions.positionTileId,
        kind: "route_passable",
        confidence: 0.8,
        observedDay: day,
      };
      return {
        world,
        expedition: {
          ...withProvisions,
          phase: "returning",
          workDaysElapsed: withProvisions.workDaysElapsed + 1,
          outcomeReason: "returned_information_only",
          carriedObservations: [...withProvisions.carriedObservations, observation].slice(0, EXPEDITION_OBSERVATION_CAP),
        },
      };
    }

    if (withProvisions.taskKind === "distant_patch_verification") {
      const verifyMemory = findTargetMemory(band, withProvisions.targetPatchId);

      if (verifyMemory === undefined) {
        return {
          world,
          expedition: { ...withProvisions, phase: "returning", outcomeReason: "evidence_stale" },
        };
      }

      // Look WITHOUT taking: the physical lookup runs (found? depleted?) but no stock
      // is touched and no cargo can exist. The record itself is carried home and is
      // applied to canonical patch memory only on physical return.
      const verification = resolveExpeditionTargetWork(
        world,
        band,
        verifyMemory,
        withProvisions.targetTileId,
        Math.max(0, withProvisions.routeTileIds.length - 1),
        withProvisions.routeTileIds,
        day,
        "food_resource_check",
        { verifyOnly: true },
      );
      const harvest = verification.record.physicalFoodHarvest;
      const observation: ExpeditionObservation = {
        tileId: withProvisions.targetTileId,
        kind:
          harvest === undefined || harvest.physicalSourceFound !== true
            ? "target_absent"
            : harvest.physicalAvailability <= 0.001
              ? "target_depleted"
              : "target_confirmed",
        // Physical presence beats remembered belief — but one visit is still one visit.
        confidence: 0.85,
        observedDay: day,
      };
      // §13 — a verification party that finds the target good attempts the PLANNED
      // "target confirmed" smoke convention (it left with exactly this arrangement).
      // The attempt is physical: fuel, wetness, distance, occlusion, and today's air
      // decide whether the camp actually sees and reads it. It costs this party its
      // work moment either way.
      const signal =
        observation.kind === "target_confirmed" &&
        (withProvisions.signalAttempts ?? []).length < SIGNAL_ATTEMPT_CAP
          ? resolveSmokeSignal({
              world,
              band,
              expeditionId: withProvisions.id,
              sourceTileId: withProvisions.positionTileId,
              meaning: "target_confirmed",
              planned: true,
              aboutTileId: withProvisions.targetTileId,
              day,
            })
          : undefined;
      return {
        // verifyOnly never mutates world state; thread the same world through.
        world: verification.world,
        expedition: {
          ...withProvisions,
          phase: "returning",
          workDaysElapsed: withProvisions.workDaysElapsed + 1,
          outcomeReason: "returned_information_only",
          pendingKnowledgeRecord: verification.record,
          carriedObservations: [...withProvisions.carriedObservations, observation].slice(0, EXPEDITION_OBSERVATION_CAP),
          ...(signal === undefined
            ? {}
            : { signalAttempts: [...(withProvisions.signalAttempts ?? []), signal.attempt].slice(0, SIGNAL_ATTEMPT_CAP) }),
        },
        ...(signal?.received === undefined ? {} : { receivedSignal: signal.received }),
      };
    }

    // Physical work: draw the distant stock through the SAME harvest resolution a near
    // trip uses. The stock is depleted here, standing at the target. The receipt is not
    // food yet — it becomes cargo.
    const memory = findTargetMemory(band, withProvisions.targetPatchId);

    if (memory === undefined) {
      // The band forgot this patch while the party was walking to it. That is stale
      // evidence, NOT an absent target — the distinction matters because it should
      // revise how the band trusts old memory, not how it rates the country.
      return {
        world,
        expedition: { ...withProvisions, phase: "returning", outcomeReason: "evidence_stale" },
      };
    }

    const work = resolveExpeditionTargetWork(
      world,
      band,
      memory,
      withProvisions.targetTileId,
      Math.max(0, withProvisions.routeTileIds.length - 1),
      withProvisions.routeTileIds,
      day,
      "food_resource_check",
    );
    const taken = work.record.physicalFoodHarvest?.usableSupport ?? 0;
    const capacity = withProvisions.cargo.carryCapacityUnits;
    const totalTaken = round4(withProvisions.cargo.harvestUnits + taken);
    // The party physically cannot carry more than its ceiling; the excess is left behind.
    const carried = Math.min(totalTaken, capacity);
    const lost = round4(Math.max(0, totalTaken - carried));
    const workDays = withProvisions.workDaysElapsed + 1;
    const doneWorking = workDays >= EXPEDITION_MAX_WORK_DAYS || carried >= capacity || taken <= 0;
    const camp = deriveTaskCampForOperating(world, withProvisions, day);
    // §16 — a party with NO feasible camp shuttles to safe ground every evening: real
    // tiles walked, real extra provisions. A camped party sleeps at its work.
    const campless = camp === undefined;
    const backtrackKm = campless ? CAMPLESS_BACKTRACK_TILES_PER_WORK_DAY * KM_PER_TILE : 0;
    const backtrackProvisions = campless
      ? round4(withProvisions.partyWorkers * EXPEDITION_PROVISION_UNITS_PER_WORKER_DAY * CAMPLESS_EXTRA_PROVISION_WORKER_DAYS)
      : 0;
    return {
      world: work.world,
      expedition: {
        ...withProvisions,
        phase: doneWorking ? "returning" : "operating",
        workDaysElapsed: workDays,
        pendingReturnRecord: work.record,
        outcomeReason: classifyTargetWorkOutcome(work.record, taken),
        cargo: {
          ...withProvisions.cargo,
          harvestUnits: round4(carried),
          lostUnits: round4(withProvisions.cargo.lostUnits + lost),
          ...(backtrackProvisions <= 0
            ? {}
            : { provisionUnitsConsumed: round4(withProvisions.cargo.provisionUnitsConsumed + backtrackProvisions) }),
        },
        ...(camp === undefined ? {} : { taskCamp: { ...camp, usedDays: camp.usedDays + 1 } }),
      },
      ...(backtrackKm <= 0 ? {} : { walkedKm: backtrackKm, walkedLoadedKm: 0, walkSource: "expedition_operating" as const }),
    };
  }

  // returning
  const nextIndex = Math.max(0, withProvisions.routeIndex - tilesPerDay);
  const home = nextIndex <= 0;
  const moved: ExpeditionRecord = {
    ...withProvisions,
    routeIndex: nextIndex,
    positionTileId: withProvisions.routeTileIds[nextIndex],
    travelDaysElapsed: withProvisions.travelDaysElapsed + 1,
    phase: home ? "completed" : "returning",
  };

  const returnKm = (withProvisions.routeIndex - nextIndex) * KM_PER_TILE;
  const loadedKm = withProvisions.cargo.harvestUnits > 0 ? returnKm : 0;

  if (!home) {
    return {
      world,
      expedition: moved,
      walkedKm: returnKm,
      walkedLoadedKm: loadedKm,
      walkSource: "expedition_return",
    };
  }

  const depositRecord = buildReturnedRecord(moved, day);
  return {
    world,
    expedition: moved,
    depositRecord,
    walkedKm: returnKm,
    walkedLoadedKm: loadedKm,
    walkSource: "expedition_return",
  };
}

/**
 * The band's own bounded patch memory for the target — band-known evidence only, matched
 * by the patch identity the launch recorded (never by tile shape, which can drift).
 * A party whose remembered patch has since been forgotten finds nothing, which is the
 * physical `target_not_found` case.
 */
/**
 * EXPEDITIONARY-4 §5.3 — map the resolved work record onto an explicit expedition
 * outcome. The resolver already knows exactly why nothing came back; collapsing that
 * into a generic `target_not_found` (as the first implementation did) destroys the
 * evidence a band needs to revise memory correctly and makes the natural outcome
 * distribution unreadable. Exported for the target-resolution audit.
 *
 * Precedence is the physical identity chain, outermost failure first:
 * route endpoint → patch existence (fresh vs stale evidence) → stock state →
 * band-known seasonality → the work itself.
 */
export function classifyTargetWorkOutcome(
  record: IntraSeasonTripRecord,
  taken: number,
): ExpeditionOutcomeReason {
  if (taken > 0) {
    return "returned_with_cargo";
  }

  // The physical resolver stamps `failed_due_to_distance` on the record ONLY when the
  // walked route did not end at the target (nor an accepted adjacent stand): the party
  // is standing somewhere that is not the patch, so nothing below it can be judged.
  if (record.activityOutcome === "failed_due_to_distance") {
    return "route_endpoint_mismatch";
  }

  const failureReason = record.physicalFoodHarvest?.failureReason;

  if (failureReason === "physical_source_absent") {
    // No patch at the stand tile. Whether that indicts the COUNTRY or the EVIDENCE
    // depends on how good the evidence was: a fresh, confident memory that turns out
    // wrong means the target is genuinely absent; a stale/inferred one means the band's
    // information failed, not the place.
    return record.physicalFoodHarvest?.knownness === "known_target" ? "target_absent" : "evidence_stale";
  }

  if (failureReason === "physically_exhausted") {
    return "physically_exhausted";
  }

  if (record.activityOutcome === "failed_due_to_season_mismatch") {
    return "seasonally_inactive";
  }

  // The party stood at a real patch and the attempt itself returned nothing.
  return "harvest_failed";
}

function findTargetMemory(band: Band, targetPatchId: string): ResourcePatchMemory | undefined {
  return band.resourceKnowledgeState?.patchMemories?.find((memory) => String(memory.patchId) === targetPatchId);
}

/**
 * §12 — the smallest honest party viewshed: from the tile the party physically stands
 * on, an adjacent broad water/wetland feature is visible and worth remembering.
 * Deterministic (sorted neighbor ids), bounded (one observation per arrival), and
 * broad-cue-only (no stock, no yield, no other band's state).
 */
function deriveArrivalViewshedObservation(
  world: WorldState,
  expedition: ExpeditionRecord,
  day: DayNumber,
): ExpeditionObservation | undefined {
  const standTile = world.tiles[expedition.positionTileId];

  if (standTile === undefined) {
    return undefined;
  }

  for (const neighborId of [...standTile.neighbors].sort((a, b) => String(a).localeCompare(String(b)))) {
    const neighbor = world.tiles[neighborId];

    if (neighbor === undefined) {
      continue;
    }

    if (neighbor.isAquatic === true || neighbor.terrainKind === "wetlands" || neighbor.isRiver === true) {
      return {
        tileId: neighborId,
        kind: "distant_feature",
        confidence: 0.7,
        observedDay: day,
      };
    }
  }

  return undefined;
}

/**
 * EXPEDITIONARY-2 — the expedition daily action. Fires every day so travel legs are
 * genuinely day-granular, and bails immediately for the (common) case of a band with no
 * party away, so the cost is a bounded per-band check rather than a map scan.
 */
export const expeditionDailyAction: DailyAction = {
  id: "expeditions",
  firesOnDayOfSeason(): boolean {
    return true;
  },
  apply(world: WorldState, day: number): WorldState {
    return applyExpeditionDay(world, day as DayNumber);
  },
};

/** Days between launch attempts, so a band cannot spam parties at a distant target. */
const EXPEDITION_LAUNCH_CADENCE_DAYS = 6;

/**
 * How many working adults may physically leave. Bounded by what is left at camp after
 * other parties are already away, and never more than a third of the residential
 * workforce — a band does not empty its camp. Returns 0 when nobody can safely go,
 * which is the physical "insufficient labor" block.
 */
function deriveDepartableWorkers(band: Band): number {
  const available = getResidentialWorkingAdults(band);
  const maxShare = Math.floor(band.demography.workingAdults / 3);
  return Math.max(0, Math.min(available - 2, maxShare));
}

/** Ticks within which a target already tried (any outcome) is not re-targeted by info tasks. */
const INFORMATION_TASK_SUPPRESSION_TICKS = 8;
/** Remembered value below which verification walking is not worth the labor (§10 EV gate). */
const VERIFICATION_MIN_REMEMBERED_VALUE = 0.3;

// ── CORRECTION-23G §7 — replay target-rule bounds. AUDIT-ONLY: every one of these is read
// exclusively by the G4/G5 target rules, which are reachable only while a schedule replay is
// registered. They deliberately reuse the same physical distance band the production
// verification family uses, so the arms differ in TARGET RULE and in nothing else.
/** Below this the place is inside the working range; a party is not raised for it. */
const REPLAY_MIN_TARGET_DISTANCE = 3;
/** Above this it is an exploration problem, not a destination a party is sent to. */
const REPLAY_MAX_TARGET_DISTANCE = 24;
/** Band-known confidence at or above which G4 does not call a place uncertain. */
const REPLAY_UNCERTAIN_CONFIDENCE = 0.7;
/** Fallbacks a single launch may try before recording a failure. Bounds the search, not the arm. */
const REPLAY_TARGET_CANDIDATE_CAP = 8;

// ── CORRECTION-5 — expedition value control ────────────────────────────────────────
//
// CORRECTION-4 opened the retrieval chain but launched distant gathering on every
// cadence day that any multi-day food memory existed. Measured cost: a rich founder ran
// 1326 gathering expeditions, 822 of them into already-exhausted stock, and the labour
// came straight out of productive local work — its same-day receipts fell 3799→3055 and
// total food fell 134.92→92.20 (-32%). Distance was reachable; it simply was not WORTH
// reaching.
//
// The gate below is an expected-net-value test computed ENTIRELY from band-known
// evidence — remembered yield, remembered depletion, decayed confidence, the band's own
// recent local trip returns, and its own expedition outcomes. It never reads a stock.
//
// Need changes WILLINGNESS and priority only: a hungry band accepts a thin margin, a
// well-fed band demands a clear surplus. Need never changes stamina, carry capacity,
// party size, travel speed, or yield.
const RETRIEVAL_EXHAUSTED_COOLDOWN_TICKS = 12;
/** Same-day food trips fire on this cadence, so one trip's yield spreads over 3 days. */
const LOCAL_TRIP_CADENCE_DAYS = 3;
/**
 * Floor on what a day of committed party labour is worth, in harvest units. Keeps an
 * expedition from reading as free when the band's recent local trips happened to return
 * nothing. Well under a typical successful trip (~0.15), so it never blocks a genuinely
 * good prospect — it only stops long walks toward weak ones.
 */
const MIN_COMMITTED_LABOUR_VALUE_PER_DAY = 0.025;

/** The band's own recent same-day food return per day — its opportunity cost baseline. */
function deriveRecentLocalYieldPerDay(band: Band): number {
  const trips = (band.recentIntraSeasonTrips ?? []).filter(
    (trip) => trip.inspectionOnly !== true && (trip.physicalFoodHarvest?.usableSupport ?? 0) > 0,
  );

  if (trips.length === 0) {
    return 0;
  }

  const total = trips.reduce((sum, trip) => sum + (trip.physicalFoodHarvest?.usableSupport ?? 0), 0);
  return total / trips.length / LOCAL_TRIP_CADENCE_DAYS;
}

/**
 * The band's OWN recent experience that this target had nothing to give. Not a stock
 * read: it is the party's returned outcome. Re-walking to a place that just came back
 * empty is the thrashing CORRECTION-4 produced.
 */
function wasTargetRecentlyEmpty(band: Band, targetTileId: TileId, currentTick: number): boolean {
  return (band.recentExpeditionOutcomes ?? []).some(
    (outcome) =>
      outcome.targetTileId === targetTileId &&
      currentTick - Number(outcome.tick) <= RETRIEVAL_EXHAUSTED_COOLDOWN_TICKS &&
      outcome.deliveredHarvestUnits <= 0 &&
      (outcome.outcomeReason === "physically_exhausted" ||
        outcome.outcomeReason === "target_absent" ||
        outcome.outcomeReason === "seasonally_inactive"),
  );
}

// CORRECTION-5 audit seam. Read-only; exposes the band-known value test so the
// willingness/stamina distinction and the anti-omniscience guarantee can be proven
// without a world. Mirrors the other *ForAudit helpers.
export function isDistantRetrievalWorthwhileForAudit(
  band: Band,
  retrieval: { readonly memory: ResourcePatchMemory; readonly targetTileId: TileId; readonly distanceTiles: number },
  foodStress: number,
  workers: number,
  currentTick: number,
): boolean {
  return isDistantRetrievalWorthwhile(
    band,
    retrieval,
    effectiveResourceConfidence(retrieval.memory, currentTick),
    foodStress,
    workers,
    currentTick,
  );
}

function isDistantRetrievalWorthwhile(
  band: Band,
  retrieval: { readonly memory: ResourcePatchMemory; readonly targetTileId: TileId; readonly distanceTiles: number },
  evidence: ReturnType<typeof effectiveResourceConfidence>,
  foodStress: number,
  workers: number,
  currentTick: number,
): boolean {
  if (wasTargetRecentlyEmpty(band, retrieval.targetTileId, currentTick)) {
    return false;
  }

  const history = retrieval.memory.useHistory;
  // Remembered value, degraded by remembered depletion and by decayed confidence.
  const rememberedUnits =
    Math.max(0, Math.min(1, history.lastYieldEstimate)) *
    evidence.effectivePresenceConfidence *
    evidence.effectiveYieldConfidence *
    Math.max(0, 1 - Math.max(0, Math.min(1, history.depletionMemory)));

  // A patch memory records what the PLACE seemed to hold, not what a small party can
  // actually walk home with. Measured: an ordinary founder's remembered value ran ~0.2
  // while its expeditions delivered 0.011 each — a ~20x overestimate that kept it
  // committing scarce workers to trips that never repaid them. Two physical corrections,
  // both band-known:
  //  1. a party cannot deliver more than it can carry;
  //  2. the band's OWN returned expeditions are evidence about what distant work yields
  //     here. If its parties keep coming home near-empty it should stop believing the
  //     patch estimate. This is realized-outcome feedback, not a stock read.
  const carryCeiling = deriveCarryCapacityUnits(band, workers, 0, currentTick);
  const delivered = (band.recentExpeditionOutcomes ?? []).filter(
    (outcome) => outcome.taskKind === "distant_plant_gathering",
  );
  const realizedMean =
    delivered.length === 0
      ? undefined
      : delivered.reduce((sum, outcome) => sum + Math.max(0, outcome.deliveredHarvestUnits), 0) / delivered.length;
  const expectedUnits =
    realizedMean === undefined
      ? Math.min(rememberedUnits, carryCeiling)
      : Math.min(rememberedUnits, carryCeiling, Math.max(realizedMean, rememberedUnits * 0.25));

  const travelDays = deriveTripDurationDays(retrieval.distanceTiles);
  const totalDays = travelDays + 1;
  const provisionUnits = workers * totalDays * EXPEDITION_PROVISION_UNITS_PER_WORKER_DAY;
  // Provisions alone are far too small to represent what an expedition really costs
  // (EXPEDITION_PROVISION_UNITS_PER_WORKER_DAY is 0.0008). The dominant cost is the
  // COMMITTED LABOUR: workers away for `totalDays` are not foraging near camp, and the
  // band cannot recall them. Valuing that at the band's own recent local return alone
  // makes the labour look free exactly when the band has been unlucky locally, which is
  // when it is least able to afford a wasted walk — so it is floored. This is what makes
  // distance and duration bite, and it is still entirely band-known.
  const labourValuePerDay = Math.max(deriveRecentLocalYieldPerDay(band), MIN_COMMITTED_LABOUR_VALUE_PER_DAY);
  const opportunityUnits = labourValuePerDay * totalDays;
  // Hungry → margin 1.0 (break-even is enough to try). Well fed → margin 2.5 (only a
  // clearly better prospect than staying home is worth the walk).
  const requiredMargin = 1 + (1 - Math.max(0, Math.min(1, foodStress))) * 1.5;

  return expectedUnits > (provisionUnits + opportunityUnits) * requiredMargin;
}

function wasTargetRecentlyConcluded(band: Band, targetTileId: TileId, currentTick: number): boolean {
  return (band.recentExpeditionOutcomes ?? []).some(
    (outcome) =>
      outcome.targetTileId === targetTileId &&
      currentTick - Number(outcome.tick) <= INFORMATION_TASK_SUPPRESSION_TICKS,
  );
}

function tileGridDistance(world: WorldState, fromTileId: TileId, toTileId: TileId): number | undefined {
  const from = world.tiles[fromTileId];
  const to = world.tiles[toTileId];

  if (from === undefined || to === undefined) {
    return undefined;
  }

  return Math.abs(from.coord.x - to.coord.x) + Math.abs(from.coord.y - to.coord.y);
}

/**
 * §10 — resource/place VERIFICATION candidate: a remembered food patch whose evidence
 * has gone stale/dormant while its remembered value stays high enough to justify
 * walking there to look. Uncertainty alone never launches (the EV gate and the
 * per-target suppression are what keep verification from running continuously).
 */
function selectVerificationCandidate(
  world: WorldState,
  band: Band,
  currentTick: number,
): { readonly memory: ResourcePatchMemory; readonly targetTileId: TileId } | undefined {
  let best: { readonly memory: ResourcePatchMemory; readonly targetTileId: TileId; readonly score: number } | undefined;

  for (const memory of band.resourceKnowledgeState?.patchMemories ?? []) {
    if (!isFoodClass(memory.resourceClassId)) {
      continue;
    }

    const distance = tileGridDistance(world, band.position, memory.approximateTile);

    if (distance === undefined || deriveTripDurationDays(distance) <= 1 || distance > EXPEDITION_MAX_ROUTE_TILES) {
      continue;
    }

    const effective = effectiveResourceConfidence(memory, currentTick);

    // Verification exists FOR degraded evidence: fresh memory needs no verifying.
    if (!effective.isStale && !effective.isDormant) {
      continue;
    }

    // The remembered value must justify the walk (never a generic curiosity walk).
    const rememberedValue = Math.max(memory.confidence.yieldConfidence, memory.useHistory.lastYieldEstimate);

    if (rememberedValue < VERIFICATION_MIN_REMEMBERED_VALUE) {
      continue;
    }

    if (wasTargetRecentlyConcluded(band, memory.approximateTile, currentTick)) {
      continue;
    }

    const score = rememberedValue + (effective.isDormant ? 0.2 : 0.1);

    if (
      best === undefined ||
      score > best.score ||
      (score === best.score && String(memory.patchId) < String(best.memory.patchId))
    ) {
      best = { memory, targetTileId: memory.approximateTile, score };
    }
  }

  return best === undefined ? undefined : { memory: best.memory, targetTileId: best.targetTileId };
}

/**
 * §10 — route/crossing RECONNAISSANCE candidate. Two physical triggers:
 *  (a) a recent expedition physically failed to reach its target
 *      (`route_endpoint_mismatch`) — the route itself needs a bounded re-read;
 *  (b) a valuable remembered patch beyond same-day reach whose ACCESS evidence is
 *      weak — the band knows the place but not the way.
 */
function selectReconnaissanceCandidate(
  world: WorldState,
  band: Band,
  currentTick: number,
): { readonly targetTileId: TileId; readonly targetPatchId: string } | undefined {
  for (const outcome of band.recentExpeditionOutcomes ?? []) {
    if (
      outcome.outcomeReason !== "route_endpoint_mismatch" ||
      currentTick - Number(outcome.tick) > INFORMATION_TASK_SUPPRESSION_TICKS
    ) {
      continue;
    }

    // One bounded re-read per failure: once a reconnaissance has concluded for this
    // tile since the failure, the question is answered until new evidence arrives.
    const reconDoneSince = (band.recentExpeditionOutcomes ?? []).some(
      (other) =>
        other.targetTileId === outcome.targetTileId &&
        other.outcomeReason === "returned_information_only" &&
        Number(other.tick) >= Number(outcome.tick),
    );

    if (!reconDoneSince) {
      return { targetTileId: outcome.targetTileId, targetPatchId: `route:${outcome.targetTileId}` };
    }
  }

  let best: { readonly targetTileId: TileId; readonly patchId: string; readonly score: number } | undefined;

  for (const memory of band.resourceKnowledgeState?.patchMemories ?? []) {
    if (!isFoodClass(memory.resourceClassId)) {
      continue;
    }

    const distance = tileGridDistance(world, band.position, memory.approximateTile);

    if (distance === undefined || deriveTripDurationDays(distance) <= 1 || distance > EXPEDITION_MAX_ROUTE_TILES) {
      continue;
    }

    const effective = effectiveResourceConfidence(memory, currentTick);
    const rememberedValue = Math.max(memory.confidence.yieldConfidence, memory.useHistory.lastYieldEstimate);

    if (
      effective.effectiveAccessConfidence >= 0.35 ||
      effective.effectivePresenceConfidence < 0.4 ||
      rememberedValue < VERIFICATION_MIN_REMEMBERED_VALUE ||
      wasTargetRecentlyConcluded(band, memory.approximateTile, currentTick)
    ) {
      continue;
    }

    const score = rememberedValue + (0.35 - effective.effectiveAccessConfidence);

    if (
      best === undefined ||
      score > best.score ||
      (score === best.score && String(memory.patchId) < String(best.patchId))
    ) {
      best = { targetTileId: memory.approximateTile, patchId: String(memory.patchId), score };
    }
  }

  return best === undefined ? undefined : { targetTileId: best.targetTileId, targetPatchId: best.patchId };
}


/**
 * CORRECTION-23 §7/§9/§10 — raise a verification party, or do not.
 *
 * This is the bridge CORRECTION-22 proved was missing. Unlike every other investigation
 * family, the candidate comes from `knowledge.observedTiles` — the shallow terrain records
 * frontier exploration produces — rather than from `resourceKnowledgeState.patchMemories`.
 *
 * Eligibility is applied INSIDE the selector, before ranking, so an ineligible high-scoring
 * target can never suppress an eligible lower-scoring one.
 */
function maybeLaunchFrontierVerification(
  world: WorldState,
  band: Band,
  day: DayNumber,
  partyWorkers: number,
  need: VerificationNeed,
): Band | undefined {
  // CORRECTION-23 CONTINUATION §9 E3 / §12 M5 — audit-only. Undefined in every normal world.
  if (world.auditOptions?.frontierVerificationDisabled === true) {
    return undefined;
  }

  const active = (band.expeditions ?? []).filter(
    (expedition) => isExpeditionAway(expedition.phase) && expedition.taskKind === "frontier_verification",
  );

  if (active.length >= VERIFICATION_ACTIVE_CAP || partyWorkers < 2) {
    return undefined;
  }

  const candidate = selectFrontierVerificationCandidate(world, band, need);

  if (candidate === undefined) {
    return undefined;
  }

  const record = band.knowledge.observedTiles[candidate.tileId];

  if (record === undefined) {
    return undefined;
  }

  // Information wants speed, not hands: the same small fast party the other information
  // families use.
  const availablePools = deriveAvailableMobilityPools(band);
  const partyComposition = selectPartyComposition(availablePools, 2, "fast");

  if (partyComposition === undefined) {
    return undefined;
  }

  // A real physical route. No route, no verification — the band does not teleport to ask.
  const searchBound = Math.min(EXPEDITION_MAX_ROUTE_TILES, candidate.distanceTiles + 8);
  const route = buildExpeditionRouteTiles(world, band.position, candidate.tileId, searchBound);

  if (route === undefined || route.length - 1 > EXPEDITION_MAX_ROUTE_TILES) {
    return undefined;
  }

  const legDays = Math.ceil((route.length - 1) / EXPEDITION_BASE_TILES_PER_DAY);

  // Return budget must physically fit, including the on-site work.
  if (legDays * 2 + VERIFICATION_ON_SITE_DAYS > EXPEDITION_MAX_DURATION_DAYS) {
    return undefined;
  }

  const plan = buildVerificationPlan(candidate, record, need, band.frontierVerificationAttempts ?? []);
  const prepared = createPreparedExpedition({
    band,
    taskKind: "frontier_verification",
    targetTileId: candidate.tileId,
    targetPatchId: `verify:${candidate.question}:${candidate.tileId}`,
    routeTileIds: route,
    partyWorkers: 2,
    partyComposition,
    day,
  });



  // CORRECTION-23J §8 — audit-only. The launch half of the paired trace, recorded where the
  // party is actually raised rather than where the candidate was picked, so a candidate that
  // wins selection and then fails to find a route is not counted as a journey.
  if (isRecordingVerificationJourneys()) {
    recordVerificationDeparture({
      verificationExpeditionId: prepared.id,
      bandId: String(band.id),
      question: plan.question,
      targetTileId: String(plan.targetTileId),
      departureDay: Number(day),
      routeTiles: route.length,
    });
  }

  return attachExpedition(band, { ...prepared, verificationPlan: plan });
}

/**
 * CORRECTION-17 §20 — ticks within which a band that already sent an exploratory party
 * does not send another. This is what keeps exploration from becoming expedition spam:
 * a band gets one honest look per window, and a null result costs it that window.
 */
const FRONTIER_EXPLORATION_SUPPRESSION_TICKS = 12;
/**
 * §10 — outward tiles a frontier party may plan for. This is NOT a raised cap: it is
 * strictly below the existing `EXPEDITION_MAX_ROUTE_TILES` (36) physical envelope, and
 * the return reserve in `deriveOutwardTilesRemaining` normally binds long before it. It
 * exists so a party does not set out intending to walk to the very edge of what the
 * duration window could theoretically permit.
 */
const FRONTIER_OUTBOUND_BUDGET_TILES = 18;

/**
 * CORRECTION-17 §6/§7/§8 — raise an exploratory party, or do not.
 *
 * Returns `undefined` (no launch) whenever the band has no band-known REASON to look
 * beyond its country, no band-known DIRECTION to look in, no spare people, or has
 * already had its look this window. Nothing in this function reads unseen country: the
 * eligibility comes from the band's own pressure/return/opportunity state, and the
 * heading comes from its own corridor memory, viewshed, known edge or inherited
 * direction. No destination tile is selected, here or anywhere downstream.
 */
function maybeLaunchFrontierExploration(
  world: WorldState,
  band: Band,
  day: DayNumber,
  currentTick: number,
  partyWorkers: number,
): Band | undefined {
  // §20 — one honest look per window, whatever it found. The window is measured from
  // the band's own `lastFrontierExplorationTick` scalar rather than from
  // `recentExpeditionOutcomes`, because that list is an LRU capped at six entries: six
  // ordinary expeditions concluding inside the window would evict the frontier record
  // and let the band explore again early.
  const lastExplorationTick = band.lastFrontierExplorationTick;
  const recentlyExplored =
    lastExplorationTick !== undefined &&
    currentTick - Number(lastExplorationTick) <= FRONTIER_EXPLORATION_SUPPRESSION_TICKS;

  if (recentlyExplored || partyWorkers < 2) {
    return undefined;
  }

  // §17 control arm. Undefined in every normal world => this branch is never taken and
  // the production path is unchanged.
  if (world.auditOptions?.frontierExplorationEnabled === false) {
    return undefined;
  }

  const eligibility = deriveFrontierExplorationEligibility(world, band);

  if (!eligibility.eligible) {
    return undefined;
  }

  const heading = deriveFrontierHeading(world, band);

  // No band-known direction to go in => the band does not go. It never picks a heading
  // by scanning the world for the best unseen country.
  if (heading === undefined) {
    return undefined;
  }

  // Information wants speed, not hands: the same small fast party the other two
  // information families use.
  const availablePools = deriveAvailableMobilityPools(band);
  const partyComposition = selectPartyComposition(availablePools, 2, "fast");

  if (partyComposition === undefined) {
    return undefined;
  }

  const plan = buildFrontierPlan({
    heading: { x: heading.heading.x, y: heading.heading.y },
    basis: heading.basis,
    anchorTileId: heading.anchorTileId,
    headingConfidence: heading.headingConfidence,
    outboundBudgetTiles: FRONTIER_OUTBOUND_BUDGET_TILES,
    // The reserve is re-derived physically every step; this records the intent.
    returnReserveTiles: FRONTIER_OUTBOUND_BUDGET_TILES,
  });

  const prepared = createPreparedExpedition({
    band,
    taskKind: "frontier_exploration",
    // §8 — for this family `targetTileId` is the plan's band-KNOWN anchor and is
    // explicitly NOT a destination. The party normally walks straight past it into
    // country nobody in the band has seen. It is carried only so the shared record shape,
    // the id derivation and the outcome summary keep working unchanged.
    targetTileId: plan.anchorTileId,
    targetPatchId: `frontier:${plan.sector}:${plan.basis}`,
    // §9 — the trail starts as the origin tile ALONE. There is no precomputed route:
    // every later entry is a tile the party has physically walked to.
    routeTileIds: [band.position],
    partyWorkers: 2,
    partyComposition,
    day,
  });

  return attachExpedition(
    // §20 — stamp the window the moment the party is raised, so a party that is still
    // walking already suppresses the next launch.
    { ...band, lastFrontierExplorationTick: getWorldTimeForDay(day).tick },
    {
      ...prepared,
      frontierPlan: plan,
      frontierDeepestReachTiles: 0,
      reasonIds: [...prepared.reasonIds, ...eligibility.reasonIds],
    },
  );
}

/**
 * EXPEDITIONARY-2 §1/Slice C — consider sending a party to band-known country that the
 * same-day path can no longer reach. The target comes from the trip authority's own
 * bounded patch-memory selection, so an expedition can never aim at hidden country.
 * Every rejection below is a physical constraint, not a score: no capacity, no spare
 * adults, no remembered distant target, no passable route.
 *
 * EXPEDITIONARY-4 §10 — three candidate families now COMPETE here, deterministically:
 * physical retrieval (food) wins when a credible distant food target exists; otherwise
 * a stale-but-valuable memory may justify a verification party; otherwise weak route
 * evidence toward valuable country may justify reconnaissance. Information tasks use a
 * small fast party. Camp labor, care, and same-day work already constrain all three
 * through the same departable-worker rule.
 */
function maybeLaunchExpedition(world: WorldState, band: Band, day: DayNumber): Band {
  // CORRECTION-24A §8/§9 — audit-only. One boolean test on the production path; when nothing is
  // recording this is exactly the old function. The wrapper exists because production CANNOT
  // answer §9's question on its own: `maybeLaunchFrontierExploration` is only called when no other
  // family wants the slot, so on every day another family wins, nobody ever asks whether
  // exploration was eligible. The recorder asks, with the same pure production functions.
  if (!isRecordingExplorationFunnel()) {
    return maybeLaunchExpeditionInner(world, band, day);
  }

  const result = maybeLaunchExpeditionInner(world, band, day);
  recordExplorationOpportunity(world, band, result, day);
  return result;
}

/**
 * CORRECTION-24A §8 — evaluate the complete exploration funnel for one opportunity and classify it
 * into exactly one primary blocker.
 *
 * Reads only band-known state and the same pure functions production uses. It never launches
 * anything, never mutates, and is only reached while an audit is recording.
 */
function recordExplorationOpportunity(
  world: WorldState,
  before: Band,
  after: Band,
  day: DayNumber,
): void {
  const active = (before.expeditions ?? []).filter((expedition) => isExpeditionAway(expedition.phase));
  const activeCapFull = active.length >= EXPEDITION_ACTIVE_CAP;
  const signalPrompt = (before.receivedSmokeSignals ?? []).some(
    (signal) =>
      signal.meaning === "target_confirmed" &&
      Number(signal.expiresOnDay) >= Number(day) &&
      Number(day) - Number(signal.day) <= 2,
  );
  const onLaunchCadence = Number(day) % EXPEDITION_LAUNCH_CADENCE_DAYS === 0 || signalPrompt;

  // §9 — an OPPORTUNITY is a day the scheduler actually runs. Production considers launching
  // only every `EXPEDITION_LAUNCH_CADENCE_DAYS`, so recording the other five days in six would
  // put a sampling choice of this audit's own making at the top of the blocker table and inflate
  // every denominator sixfold. Off-cadence days are not opportunities and are not recorded.
  if (!onLaunchCadence) {
    return;
  }

  const departableWorkers = deriveDepartableWorkers(before);
  const currentTick = Number(getWorldTimeForDay(day).tick);
  const lastExplorationTick = before.lastFrontierExplorationTick;
  const ticksSinceLastExploration =
    lastExplorationTick === undefined ? undefined : currentTick - Number(lastExplorationTick);
  const suppressionWindowActive =
    ticksSinceLastExploration !== undefined &&
    ticksSinceLastExploration <= FRONTIER_EXPLORATION_SUPPRESSION_TICKS;

  const eligibility = deriveFrontierExplorationEligibility(world, before);
  const heading = deriveFrontierHeading(world, before);
  const pools = deriveAvailableMobilityPools(before);
  const partyComposition = selectPartyComposition(pools, 2, "fast");

  // §8 E1 — the band's own known frontier edge: a KNOWN tile with at least one unknown
  // 4-neighbour. Band knowledge only; the neighbour lookup asks whether the BAND has a record,
  // never what is physically there.
  let knownEdgeTiles = 0;

  for (const tileId of Object.keys(before.knowledge.observedTiles)) {
    if (getTile(world, tileId as TileId) === undefined) {
      continue;
    }

    for (const neighbour of getNeighborTiles(world, tileId as TileId)) {
      if (before.knowledge.observedTiles[neighbour.id] === undefined) {
        knownEdgeTiles += 1;
        break;
      }
    }
  }

  // What the scheduler actually did with this slot.
  const beforeIds = new Set((before.expeditions ?? []).map((expedition) => expedition.id));
  const launched = (after.expeditions ?? []).find((expedition) => !beforeIds.has(expedition.id));
  const schedulerOutcome: SchedulerOutcome =
    launched === undefined
      ? "nothing"
      : launched.taskKind === "frontier_exploration"
        ? "exploration"
        : (launched.taskKind as SchedulerOutcome);

  const unit = (value: number): number => Math.max(0, Math.min(1, value));
  const to2 = (value: number): number => Math.round(value * 100) / 100;
  const foodStress = unit(before.pressureState?.foodStress ?? 0);
  const waterStress = unit(before.pressureState?.waterStress ?? 0);
  // Production's own urgency threshold, reused rather than invented: below 0.35 a band is
  // comfortable enough to verify before retrieving, so a retrieval that wins under it is not
  // an emergency displacing exploration.
  const retrievalUrgent = foodStress >= 0.35;

  // §4.1 — a party PHYSICALLY AWAY right now, which the 12-tick cooldown outlives. The first pass
  // called the cooldown `ALREADY_EXPLORING` and so could not tell the two apart.
  const activeFrontierParty = active.some((expedition) => expedition.taskKind === "frontier_exploration");

  // ── §6 — THE COMPLETE PHYSICAL-FEASIBILITY CONTRACT, through production authorities. ──
  //
  // Ordinary exploration discovers its route one physical step at a time, so there is no full route
  // to test and §6 explicitly forbids requiring one. What CAN be tested before the party is raised
  // is whether it could physically leave: build the plan production would build, prepare the record
  // production would prepare, and ask the production step and reserve authorities. All four calls
  // are pure — nothing below mutates the band, the world or the expedition list.
  const plan =
    heading === undefined
      ? undefined
      : buildFrontierPlan({
          heading: { x: heading.heading.x, y: heading.heading.y },
          basis: heading.basis,
          anchorTileId: heading.anchorTileId,
          headingConfidence: heading.headingConfidence,
          outboundBudgetTiles: FRONTIER_OUTBOUND_BUDGET_TILES,
          returnReserveTiles: FRONTIER_OUTBOUND_BUDGET_TILES,
        });
  const probe =
    plan === undefined
      ? undefined
      : {
          ...createPreparedExpedition({
            band: before,
            taskKind: "frontier_exploration" as ExpeditionTaskKind,
            targetTileId: plan.anchorTileId,
            targetPatchId: `frontier:${plan.sector}:${plan.basis}`,
            routeTileIds: [before.position],
            partyWorkers: 2,
            day,
          }),
          frontierPlan: plan,
          frontierDeepestReachTiles: 0,
        };
  const tilesPerDay = probe === undefined ? 0 : deriveTilesPerDay(before, probe, currentTick);
  const returnReserveTiles =
    probe === undefined
      ? 0
      : deriveOutwardTilesRemaining({
          trailLength: 1,
          tilesPerDay,
          daysElapsed: 0,
          maxDurationDays: EXPEDITION_MAX_DURATION_DAYS,
          outboundBudgetTiles: FRONTIER_OUTBOUND_BUDGET_TILES,
        });
  const firstStepOutcome =
    probe === undefined ? "no_plan" : chooseNextFrontierStep(world, probe, returnReserveTiles).kind;
  // The duration envelope a raised party would carry. `plannedReturnDay` comes from the same
  // `createPreparedExpedition` production uses, so this is production's own budget, not a replica.
  const durationBudgetDays = probe === undefined ? 0 : Number(probe.hardDeadlineDay) - Number(day);

  const offerState = takeExplorationOfferState(before.id, Number(day));
  const candidates = takeProposalCandidates(before.id, Number(day));

  const classification = classifyExplorationOpportunity({
    activeCapFull,
    onLaunchCadence,
    departableWorkers,
    suppressionWindowActive,
    activeFrontierParty,
    eligible: eligibility.eligible,
    noKnownNonOverlappingDestination: eligibility.noKnownNonOverlappingDestination,
    knownEdgeTiles,
    headingAvailable: heading !== undefined,
    partyCompositionAvailable: partyComposition !== undefined,
    firstStepOutcome,
    returnReserveTiles,
    durationBudgetDays,
    schedulerOutcome,
    retrievalUrgent,
    explorationOffered: offerState.offered,
    ...(offerState.claimFailure === undefined ? {} : { claimFailure: offerState.claimFailure }),
  });

  // ── §7 — THE SAME-DECISION PROPOSAL LEDGER. ──
  //
  // One row per family for THIS decision. Active expeditions are deliberately absent: a party
  // already walking is not a proposal competing for today's slot, and recording it as one was the
  // first pass's `competingProposals` error.
  const claimed = offerState.claimedBy;
  const ledger: SchedulerFamilyLedgerRow[] = [];
  const push = (
    family: SchedulerFamily,
    exists: boolean,
    target: string | undefined,
    eligible: boolean,
    reached: boolean,
    workers: number,
  ): void => {
    const isClaimer = claimed === family || (family === "frontier_exploration" && offerState.offered);
    const launched =
      (family === "frontier_exploration" && schedulerOutcome === "exploration") ||
      (family === "distant_retrieval" && schedulerOutcome === "distant_plant_gathering") ||
      (family === "distant_patch_verification" && schedulerOutcome === "distant_patch_verification") ||
      (family === "route_reconnaissance" && schedulerOutcome === "route_reconnaissance") ||
      (family === "frontier_water_verification" && schedulerOutcome === "frontier_verification");
    ledger.push({
      family,
      candidateExists: exists,
      ...(target === undefined ? {} : { candidateTarget: target }),
      eligible,
      priorityStatus: isClaimer ? "claimed" : reached ? "considered" : "not_reached",
      workersRequired: workers,
      partyCompositionAvailable: family === "frontier_exploration" ? partyComposition !== undefined : exists,
      ...(isClaimer && !launched && offerState.claimFailure !== undefined
        ? { reasonFailedAfterSelection: offerState.claimFailure }
        : {}),
      ...(isClaimer ? { reasonSelected: "highest priority family with a candidate" } : {}),
      ...(!isClaimer && !exists ? { reasonRejectedBeforeSelection: "no candidate" } : {}),
      ...(!isClaimer && exists && !reached ? { reasonRejectedBeforeSelection: "earlier family claimed" } : {}),
      actualLaunch: launched,
    });
  };

  push(
    "distant_retrieval",
    candidates?.retrievalExists ?? false,
    candidates?.retrievalTarget,
    candidates?.retrievalWorthwhile ?? false,
    true,
    candidates?.partyWorkers ?? departableWorkers,
  );
  push(
    "frontier_water_verification",
    schedulerOutcome === "frontier_verification" || (candidates?.waterVerificationGateOpen ?? false),
    undefined,
    candidates?.waterVerificationGateOpen ?? schedulerOutcome === "frontier_verification",
    true,
    2,
  );
  push(
    "distant_patch_verification",
    candidates?.patchVerificationExists ?? false,
    candidates?.patchVerificationTarget,
    candidates?.patchVerificationExists ?? false,
    candidates !== undefined,
    2,
  );
  push(
    "route_reconnaissance",
    candidates?.reconnaissanceExists ?? false,
    candidates?.reconnaissanceTarget,
    candidates?.reconnaissanceExists ?? false,
    candidates !== undefined,
    2,
  );
  push(
    "frontier_exploration",
    classification.eligibleExplorationIntent,
    plan === undefined ? undefined : String(plan.anchorTileId),
    classification.physicallyValidExplorationProposal,
    offerState.offered,
    2,
  );

  recordExplorationFunnel({
    bandId: String(before.id),
    day: Number(day),
    foodStress: to2(foodStress),
    waterStress: to2(waterStress),
    rangeSaturation: eligibility.rangeSaturation,
    lowReturnPressure: eligibility.lowReturnPressure,
    dispersalPressure: eligibility.dispersalPressure,
    noKnownNonOverlappingDestination: eligibility.noKnownNonOverlappingDestination,
    exhaustedKnownOpportunity: eligibility.exhaustedKnownOpportunity,
    evidenceScore: eligibility.evidenceScore,
    willingness: eligibility.willingness,
    eligible: eligibility.eligible,
    population: before.demography?.population ?? 0,
    departableWorkers,
    headingAvailable: heading !== undefined,
    ...(heading === undefined ? {} : { headingBasis: heading.basis, headingConfidence: heading.headingConfidence }),
    knownEdgeTiles,
    partyCompositionAvailable: partyComposition !== undefined,
    activeParties: active.length,
    activeCapFull,
    onLaunchCadence,
    suppressionWindowActive,
    ...(ticksSinceLastExploration === undefined ? {} : { ticksSinceLastExploration }),
    activeFrontierParty,
    canBeginPhysicalExploration: classification.canBeginPhysicalExploration,
    // §6 — normally FALSE and never required. Frontier exploration has no destination and no
    // precomputed route; only the anchor is known before departure.
    fullRouteKnown: false,
    firstStepOutcome,
    returnReserveTiles,
    durationBudgetDays,
    eligibleExplorationIntent: classification.eligibleExplorationIntent,
    physicallyValidExplorationProposal: classification.physicallyValidExplorationProposal,
    proposalLedger: ledger,
    activePartyKinds: active.map((expedition) => String(expedition.taskKind)),
    explorationOffered: offerState.offered,
    ...(offerState.claimedBy === undefined ? {} : { claimedBy: offerState.claimedBy }),
    ...(offerState.claimFailure === undefined ? {} : { claimFailure: offerState.claimFailure }),
    ...(offerState.claimedCandidateTarget === undefined
      ? {}
      : { claimedCandidateTarget: offerState.claimedCandidateTarget }),
    fallthroughOpportunity: classification.fallthroughOpportunity,
    retrievalWorthwhile: candidates?.retrievalWorthwhile ?? schedulerOutcome === "distant_plant_gathering",
    retrievalUrgent,
    schedulerOutcome,
    primaryBlocker: classification.primaryBlocker,
    secondaryBlockers: classification.secondaryBlockers,
  });
}

function maybeLaunchExpeditionInner(world: WorldState, band: Band, day: DayNumber): Band {
  const active = (band.expeditions ?? []).filter((expedition) => isExpeditionAway(expedition.phase));

  // §13 — smoke on the horizon is a PROMPT: a camp that just read its own party's
  // planned "target confirmed" column does not wait for the ordinary launch rhythm.
  // This is the physical point of the signal — acting days before the party is home.
  const signalPrompt = (band.receivedSmokeSignals ?? []).some(
    (signal) =>
      signal.meaning === "target_confirmed" &&
      Number(signal.expiresOnDay) >= Number(day) &&
      Number(day) - Number(signal.day) <= 2,
  );

  if (active.length >= EXPEDITION_ACTIVE_CAP || (Number(day) % EXPEDITION_LAUNCH_CADENCE_DAYS !== 0 && !signalPrompt)) {
    return band;
  }

  const partyWorkers = deriveDepartableWorkers(band);

  if (partyWorkers < 2) {
    return band;
  }

  const currentTick = Number(getWorldTimeForDay(day).tick);

  // §10 — the three candidate families compete deterministically.
  //  - A HUNGRY band gambles: physical retrieval goes even on stale evidence.
  //  - A comfortable band does NOT commit a full party to stale/dormant evidence — it
  //    sends two fast walkers to VERIFY first. A confirming return freshens the memory
  //    and the retrieval party goes next (returned knowledge changing later behavior);
  //    a contradicting return kills the wasted trip before it was ever walked.
  //  - With no retrieval target at all, stale-but-valuable memory justifies
  //    verification, and weak route evidence toward valuable country justifies
  //    reconnaissance. No candidate, no launch.
  const retrieval = selectExpeditionTripCandidate(world, band, Number(day), EXPEDITION_MAX_ROUTE_TILES);
  const retrievalEvidence =
    retrieval === undefined ? undefined : effectiveResourceConfidence(retrieval.memory, currentTick);
  const foodStress = Math.max(0, Math.min(1, band.pressureState?.foodStress ?? 0));
  // §13 — an UNDERSTOOD "target confirmed" smoke signal from the band's own away party
  // stands in for fresh evidence: the camp saw the planned convention on the horizon,
  // so the retrieval party can leave before the scouts are even home. This is the
  // physical relay value of the signal — bounded meaning changing one real decision.
  const signalConfirmedTarget =
    retrieval !== undefined &&
    findUnderstoodSignal(band, "target_confirmed", retrieval.targetTileId, day) !== undefined;
  const retrievalEvidenceDegraded =
    retrievalEvidence !== undefined &&
    (retrievalEvidence.isStale || retrievalEvidence.isDormant) &&
    !signalConfirmedTarget;
  const verifyBeforeRetrieving =
    retrieval !== undefined &&
    retrievalEvidenceDegraded &&
    foodStress < 0.35 &&
    !wasTargetRecentlyConcluded(band, retrieval.targetTileId, currentTick);
  // CORRECTION-5 — a reachable target is not automatically a worthwhile one.
  const retrievalWorthwhile =
    retrieval !== undefined &&
    retrievalEvidence !== undefined &&
    isDistantRetrievalWorthwhile(band, retrieval, retrievalEvidence, foodStress, partyWorkers, currentTick);

  // A retrieval target rejected on VALUE leaves the band free to do something useful
  // instead, exactly as if it had no retrieval candidate at all.
  const noUsefulRetrieval = retrieval === undefined || !retrievalWorthwhile;

  // CORRECTION-23 §9 — WHERE VERIFICATION COMPETES.
  //
  // Directly after retrieval, and BEFORE patch verification and route reconnaissance.
  // The ordering is a claim about what a band under real pressure should do, and it is
  // deliberate:
  //
  //   retrieval                 feeds people NOW from a known productive patch — first;
  //   frontier verification     answers "is there anywhere better than this failing range?";
  //   patch verification        re-checks a stale patch INSIDE the failing range;
  //   route reconnaissance      refines access to that same range.
  //
  // A band in chronic decline gains more from finding out whether the promising country it
  // walked past is usable than from re-reading a patch in the range that is already failing.
  // Placing it last was measured to make it unreachable: the patch-memory families fire in
  // almost every band-year on the default maps, so a verification candidate existed in
  // 1105 of 1352 sampled band-years and was never once launched.
  // Gated on `noUsefulRetrieval` OR real sustained hardship. The second clause matters:
  // a band whose range is failing usually STILL has a worthwhile retrieval target — that is
  // what it is living on — so gating verification purely on "nothing better to do" made it
  // unreachable in exactly the situation it exists for. A two-person party asking whether
  // there is anywhere better does not stop the rest of the band foraging, and
  // EXPEDITION_ACTIVE_CAP still bounds total parties.
  const verificationNeed = deriveVerificationNeed(band);
  // CORRECTION-23 CONTINUATION §8 — audit-only launch-arm isolation. Undefined in every
  // normal world, in which case both disjuncts stand exactly as written above.
  const launchArm = world.auditOptions?.frontierVerificationLaunchArm;
  const verificationGateOpen =
    launchArm === "no_useful_retrieval_only"
      ? noUsefulRetrieval
      : launchArm === "need_only"
        ? verificationNeed.need >= 0.45
        : noUsefulRetrieval || verificationNeed.need >= 0.45;


  if (verificationGateOpen) {
    const verified = maybeLaunchFrontierVerification(world, band, day, partyWorkers, verificationNeed);

    if (verified !== undefined) {
      return verified;
    }
  }
  const verification = noUsefulRetrieval ? selectVerificationCandidate(world, band, currentTick) : undefined;
  const reconnaissance =
    noUsefulRetrieval && verification === undefined
      ? selectReconnaissanceCandidate(world, band, currentTick)
      : undefined;

  // CORRECTION-17 §6/§7 — the FIFTH candidate family, and the only one that may enter
  // country the band does not know. It competes LAST, on purpose: a band that still has
  // a worthwhile remembered target to retrieve, a stale memory worth verifying, or a
  // route worth reading does that instead. Exploration is what a band does when its own
  // known country has stopped answering — which is exactly the band-known state
  // `deriveFrontierExplorationEligibility` measures.
  // CORRECTION-24A §12 O1 — audit-only priority arm, unset in every normal world. Exploration is
  // offered the slot FIRST, but only against a NONURGENT competitor: `foodStress >= 0.35` is
  // production's own urgency threshold and an urgent retrieval is never displaced. Motive, heading,
  // physical budgets, the active cap and the worker rule are all untouched — the arm changes the
  // ORDER of the cascade and nothing else, so a launch it produces is one production could have made.
  if (isExplorationPriorityArm() && foodStress < 0.35) {
    const preferred = maybeLaunchFrontierExploration(world, band, day, currentTick, partyWorkers);

    if (preferred !== undefined) {
      noteExplorationOffered(band.id, Number(day));
      return preferred;
    }
  }

  // CORRECTION-24A §7 — audit-only; records what this ONE decision actually had in front of it.
  noteProposalCandidates(band.id, Number(day), {
    retrievalExists: retrieval !== undefined,
    ...(retrieval === undefined ? {} : { retrievalTarget: String(retrieval.targetTileId) }),
    retrievalWorthwhile,
    verifyBeforeRetrieving,
    waterVerificationGateOpen: verificationGateOpen,
    patchVerificationExists: verification !== undefined,
    ...(verification === undefined ? {} : { patchVerificationTarget: String(verification.targetTileId) }),
    reconnaissanceExists: reconnaissance !== undefined,
    ...(reconnaissance === undefined ? {} : { reconnaissanceTarget: String(reconnaissance.targetTileId) }),
    partyWorkers,
  });

  const explorationOffered = noUsefulRetrieval && verification === undefined && reconnaissance === undefined;

  if (explorationOffered) {
    // CORRECTION-24A §7 — audit-only marker; no-op when nothing is recording.
    noteExplorationOffered(band.id, Number(day));

    const explored = maybeLaunchFrontierExploration(world, band, day, currentTick, partyWorkers);

    if (explored !== undefined) {
      return explored;
    }
  } else {
    noteExplorationNotOffered(
      band.id,
      Number(day),
      !noUsefulRetrieval
        ? "distant_retrieval"
        : verification !== undefined
          ? "distant_patch_verification"
          : "route_reconnaissance",
      String(
        !noUsefulRetrieval
          ? retrieval?.targetTileId
          : verification !== undefined
            ? verification.targetTileId
            : reconnaissance?.targetTileId,
      ),
    );
  }

  /**
   * CORRECTION-24A §7 — the claiming family reached a typed early return instead of launching.
   *
   * Every post-selection exit below funnels through here, so a scheduler FALLTHROUGH (the day is
   * wasted with a valid exploration proposal in hand) can never be confused with scheduler ORDERING
   * (exploration lost to a family that actually went). The `noteClaimFailure` call is audit-only.
   *
   * The O2 branch is the isolated fallthrough-repair arm and is unreachable in every normal world:
   * `isFallthroughRepairArm()` is false unless an audit runner selected O2. It reconsiders only a
   * proposal the band already derived, only when an earlier family claimed and then failed, and only
   * while the slot is still free — it never fills an idle slot that had no valid proposal.
   */
  const refuseLaunch = (failure: PostClaimFailure): Band => {
    noteClaimFailure(failure);

    if (isFallthroughRepairArm() && !explorationOffered) {
      const explored = maybeLaunchFrontierExploration(world, band, day, currentTick, partyWorkers);

      if (explored !== undefined) {
        return explored;
      }
    }

    return band;
  };

  const chosen =
    retrieval !== undefined && retrievalWorthwhile && !verifyBeforeRetrieving && !(retrievalEvidenceDegraded && foodStress < 0.35)
      ? {
          taskKind: "distant_plant_gathering" as ExpeditionTaskKind,
          targetTileId: retrieval.targetTileId,
          targetPatchId: String(retrieval.memory.patchId),
          linkedTiles: retrieval.memory.linkedTiles,
          // An ordinary gathering party fills from typical walkers first, touching
          // the scarce high-capacity pool only when it must.
          preference: "balanced" as const,
          workers: partyWorkers,
        }
      : verifyBeforeRetrieving && retrieval !== undefined
        ? {
            taskKind: "distant_patch_verification" as ExpeditionTaskKind,
            targetTileId: retrieval.targetTileId,
            targetPatchId: String(retrieval.memory.patchId),
            linkedTiles: retrieval.memory.linkedTiles,
            // Information wants speed, not hands: a small fast party.
            preference: "fast" as const,
            workers: 2,
          }
        : verification !== undefined
          ? {
              taskKind: "distant_patch_verification" as ExpeditionTaskKind,
              targetTileId: verification.targetTileId,
              targetPatchId: String(verification.memory.patchId),
              linkedTiles: verification.memory.linkedTiles,
              preference: "fast" as const,
              workers: 2,
            }
          : reconnaissance !== undefined
            ? {
                taskKind: "route_reconnaissance" as ExpeditionTaskKind,
                targetTileId: reconnaissance.targetTileId,
                targetPatchId: reconnaissance.targetPatchId,
                linkedTiles: [] as readonly TileId[],
                preference: "fast" as const,
                workers: 2,
              }
            : undefined;

  // One party per target — EXCEPT the §13 relay case: a retrieval party may leave for
  // a target the away VERIFICATION party just confirmed by smoke, before it returns.
  const sameTargetActive = active.some((expedition) => expedition.targetTileId === chosen?.targetTileId);
  const relayException =
    chosen !== undefined &&
    chosen.taskKind === "distant_plant_gathering" &&
    signalConfirmedTarget &&
    active.every(
      (expedition) =>
        expedition.targetTileId !== chosen.targetTileId ||
        expedition.taskKind === "distant_patch_verification",
    );

  if (chosen === undefined) {
    // The claiming family produced no candidate at all — a retrieval target that is worthwhile but
    // whose evidence is degraded, on a band that already concluded against it.
    return refuseLaunch("TARGET_STALE");
  }

  if (sameTargetActive && !relayException) {
    return refuseLaunch("SAME_TARGET_CONFLICT");
  }

  // §8 — the party is drawn from the AVAILABLE mobility-role pools (present adults
  // only; adults already away are committed elsewhere and cannot be drawn twice).
  const availablePools = deriveAvailableMobilityPools(band);
  const partyComposition = selectPartyComposition(availablePools, chosen.workers, chosen.preference);

  if (partyComposition === undefined) {
    return refuseLaunch("PARTY_COMPOSITION_FAILED");
  }

  // §5.2 (multi-tile patch) — aim at the remembered anchor tile first; when the anchor
  // itself is unreachable, any of the patch's linked tiles is an equally valid physical
  // stand (deterministic order), and reaching one does not lose the patch identity.
  //
  // §25 — the BFS exploration budget is sized to the CANDIDATE's real distance (plus
  // detour slack), not always the global route cap: a target 8 tiles out does not need
  // a 5776-tile search neighbourhood. The path-length cap below is unchanged; a target
  // needing a detour beyond its distance+slack neighbourhood is honestly unreachable.
  const searchBound = (targetTileId: TileId): number => {
    const distance = tileGridDistance(world, band.position, targetTileId);
    return distance === undefined
      ? EXPEDITION_MAX_ROUTE_TILES
      : Math.min(EXPEDITION_MAX_ROUTE_TILES, distance + 8);
  };
  let route = buildExpeditionRouteTiles(world, band.position, chosen.targetTileId, searchBound(chosen.targetTileId));

  if (route === undefined) {
    for (const linkedTileId of [...chosen.linkedTiles].sort((a, b) => String(a).localeCompare(String(b)))) {
      route = buildExpeditionRouteTiles(world, band.position, linkedTileId, searchBound(linkedTileId));

      if (route !== undefined) {
        break;
      }
    }
  }

  // No passable route within the bounded neighbourhood => physically unreachable. The
  // band simply does not go; it never teleports to the target.
  if (route === undefined || route.length - 1 > EXPEDITION_MAX_ROUTE_TILES) {
    return refuseLaunch("ROUTE_BUILD_FAILED");
  }

  const legDays = Math.ceil((route.length - 1) / EXPEDITION_BASE_TILES_PER_DAY);

  if (legDays * 2 + 1 > EXPEDITION_MAX_DURATION_DAYS) {
    return refuseLaunch("DURATION_FAILED");
  }

  const expedition = createPreparedExpedition({
    band,
    taskKind: chosen.taskKind,
    targetTileId: chosen.targetTileId,
    targetPatchId: chosen.targetPatchId,
    routeTileIds: route,
    partyWorkers: chosen.workers,
    partyComposition,
    day,
  });
  return attachExpedition(band, expedition);
}

function applyExpeditionDay(world: WorldState, day: DayNumber): WorldState {
  const bandsById: Record<string, Band> = { ...world.bands };
  let currentWorld = world;
  let changed = false;

  for (const band of Object.values(world.bands).sort(compareExpeditionBands)) {
    if (!isActiveExpeditionBand(band)) {
      continue;
    }

    const launched = maybeLaunchExpedition(currentWorld, bandsById[band.id] ?? band, day);

    if (launched !== (bandsById[band.id] ?? band)) {
      bandsById[band.id] = launched;
      changed = true;
    }

    if ((launched.expeditions ?? []).length === 0) {
      continue;
    }

    const currentBand = launched;
    let mobility = currentBand.mobility;
    const nextExpeditions: ExpeditionRecord[] = [];
    const deposits: IntraSeasonTripRecord[] = [];
    // §11 — knowledge PHYSICALLY carried home by parties that completed their return
    // today. It is applied below, once, through the canonical writers. Lost parties
    // apply nothing: their observations never came home.
    const returnedKnowledgeRecords: {
      readonly record: IntraSeasonTripRecord;
      readonly targetPatchId: string;
      readonly verificationObservation?: ExpeditionObservation & { readonly kind: VerificationObservationKind };
    }[] = [];
    const returnedReconRouteTiles: TileId[] = [];
    // CORRECTION-23F §7 — the verification family's own route tiles, tracked separately so an
    // audit policy can reach verification travel without touching route reconnaissance.
    const returnedVerificationRouteTiles: TileId[] = [];
    // CORRECTION-23 §13 — verification results carried home by parties that PHYSICALLY
    // returned today. A lost party contributes nothing here, which is the §15 control.
    const returnedVerifications: {
      readonly routeTiles: number;
      readonly acquisition?: KnowledgeAcquisitionKind;
      readonly result: NonNullable<ExpeditionRecord["verificationResult"]>;
      readonly harvestUnits: number;
      /** CORRECTION-23J §8 — which party came home, so the return can be paired to its launch. */
      readonly expeditionId: string;
    }[] = [];
    // CORRECTION-18 §8 — kept SEPARATE from the reconnaissance list so the two returning
    // families can be stamped with their own acquisition provenance.
    const returnedFrontierRouteTiles: TileId[] = [];
    // CORRECTION-24A §10 E5 — audit-only. Which parties reached the canonical writer, so the
    // records it creates can be attributed to the journey that carried them home.
    const completedFrontierJourneys: ExpeditionRecord[] = [];
    // §13 — smoke the residential camp physically received today (bounded meaning only).
    const receivedSignalsToday: ReceivedSmokeSignal[] = [];
    let outcomes = [...(currentBand.recentExpeditionOutcomes ?? [])];
    // EXPEDITIONARY-3 — realized walking for THIS band on THIS day, accumulated across its
    // parties and written once below. Days with no movement are recorded as rest days,
    // which is precisely what makes the calendar-day mean differ from the active-day mean.
    let dayKm = 0;
    let dayLoadedKm = 0;
    let daySource: "expedition_outbound" | "expedition_return" | "expedition_operating" = "expedition_operating";

    for (const rawExpedition of [...(currentBand.expeditions ?? [])].sort((a, b) => a.id.localeCompare(b.id))) {
      // §13 — an overdue party raises the PLANNED "delayed" smoke convention exactly
      // once (parties leave with "smoke if late"). Physical: fuel, occlusion, distance,
      // and today's air decide whether the camp actually sees it.
      let expedition = rawExpedition;

      if (
        !isTerminalPhase(expedition.phase) &&
        Number(day) > Number(expedition.plannedReturnDay) &&
        (expedition.signalAttempts ?? []).length < SIGNAL_ATTEMPT_CAP &&
        !(expedition.signalAttempts ?? []).some((attempt) => attempt.meaning === "delayed")
      ) {
        const delayed = resolveSmokeSignal({
          world: currentWorld,
          band: currentBand,
          expeditionId: expedition.id,
          sourceTileId: expedition.positionTileId,
          meaning: "delayed",
          planned: true,
          aboutTileId: expedition.targetTileId,
          day,
        });
        expedition = {
          ...expedition,
          signalAttempts: [...(expedition.signalAttempts ?? []), delayed.attempt].slice(0, SIGNAL_ATTEMPT_CAP),
        };

        if (delayed.received !== undefined) {
          receivedSignalsToday.push(delayed.received);
        }
      }

      const result = advanceExpeditionOneDay(currentWorld, currentBand, expedition, day);
      currentWorld = result.world;

      if (result.receivedSignal !== undefined) {
        receivedSignalsToday.push(result.receivedSignal);
      }

      if ((result.walkedKm ?? 0) > 0) {
        dayKm += result.walkedKm ?? 0;
        dayLoadedKm += result.walkedLoadedKm ?? 0;
        daySource = result.walkSource ?? daySource;
      }

      if (result.depositRecord !== undefined) {
        deposits.push(result.depositRecord);
      }

      if (isTerminalPhase(result.expedition.phase)) {
        const delivered = result.depositRecord?.physicalFoodHarvest?.usableSupport ?? 0;
        const provisionalReason =
          result.expedition.outcomeReason ?? (result.expedition.phase === "lost" ? "party_lost" : "returned_information_only");
        // §5.3 — harvest physically taken at the target but nothing survived the walk
        // home (the party ate it / the carry ceiling lost it): the RETURN failed, not
        // the target. Distinct from every target-stage failure above.
        const terminalReason: ExpeditionOutcomeReason =
          provisionalReason === "returned_with_cargo" && delivered <= 0 && result.expedition.phase === "completed"
            ? "cargo_return_failed"
            : provisionalReason;
        // Observation only: how far this whole journey actually walked, out and back.
        mobility = recordExpeditionDistance(
          mobility,
          (result.expedition.routeTileIds.length - 1) * 2 * KM_PER_TILE,
        );
        outcomes = [
          summarizeOutcome(
            result.expedition,
            result.expedition.phase,
            terminalReason,
            delivered,
          ),
          ...outcomes,
        ].slice(0, EXPEDITION_OUTCOME_CAP);

        // §11 — ONLY a party that physically completed its return transfers knowledge.
        if (result.expedition.phase === "completed") {
          // CORRECTION-23 §13 — a verification party that PHYSICALLY WALKED HOME hands over
          // the answer to the one question it went to ask. A lost party never reaches this
          // branch and therefore transfers nothing, which is the §15 control. The walked
          // route also becomes known country through the same canonical tile-observation
          // writer every other returning party uses.
          if (result.expedition.taskKind === "frontier_verification") {
            returnedReconRouteTiles.push(...result.expedition.routeTileIds);
            returnedVerificationRouteTiles.push(...result.expedition.routeTileIds);

            const verificationResult = result.expedition.verificationResult;

            // CORRECTION-23 CONTINUATION §9 E4 — audit-only. The party walked, worked and
            // came home; only the answer is withheld at the hand-off. Undefined in every
            // normal world.
            // CORRECTION-23F §10 F13 — THE ARCHITECTURAL COUNTERFACTUAL. The party is raised
            // on the same schedule, walks to the same target along the same physical route,
            // and its walked route becomes ordinary known country exactly as before — but it
            // carries no question, records no result and writes no disposition. If this
            // reproduces F1, the useful behaviour belongs to exploration and re-observation,
            // not to verification, and the production seam is not in this module's question
            // machinery at all. Audit-only; undefined in every normal world.
            if (
              verificationResult !== undefined &&
              currentWorld.auditOptions?.frontierVerificationKnowledgeDisabled !== true
            ) {
              returnedVerifications.push({
                routeTiles: result.expedition.routeTileIds.length,
                acquisition: result.expedition.verificationPlan?.originatingAcquisition,
                result: verificationResult,
                harvestUnits: verificationResult.harvestUnits,
                expeditionId: result.expedition.id,
              });
            }
          }

          const knowledgeRecord = result.expedition.pendingReturnRecord ?? result.expedition.pendingKnowledgeRecord;

          if (knowledgeRecord !== undefined) {
            // CORRECTION-3 (Defect B) — a verification party looked without taking, so its
            // record is zero-yield BY CONSTRUCTION and must not be read as a failed
            // harvest. Carry the physical observation it actually made about its own
            // target instead; the applier below routes on this.
            const verificationObservation =
              result.expedition.taskKind === "distant_patch_verification"
                ? result.expedition.carriedObservations.find(
                    (observation): observation is ExpeditionObservation & {
                      readonly kind: VerificationObservationKind;
                    } =>
                      observation.tileId === result.expedition.targetTileId &&
                      (observation.kind === "target_confirmed" ||
                        observation.kind === "target_depleted" ||
                        observation.kind === "target_absent"),
                  )
                : undefined;

            returnedKnowledgeRecords.push({
              record: knowledgeRecord,
              targetPatchId: result.expedition.targetPatchId,
              ...(verificationObservation === undefined ? {} : { verificationObservation }),
            });
          }

          if (result.expedition.taskKind === "route_reconnaissance") {
            returnedReconRouteTiles.push(...result.expedition.routeTileIds);
          }

          // CORRECTION-17 §11/§12 — a frontier party that PHYSICALLY WALKED HOME hands
          // over the corridor it walked. Until this line executed, none of it existed
          // for the residential band: no KnownTileRecord, no resource memory, no
          // daughter target. A `lost` party never reaches this branch and therefore
          // transfers nothing, which is the §11 control.
          //
          // The tiles go through the SAME canonical `observeTileAndNearby` writer the
          // residential decision path uses (applied once, below). That writer records
          // existence, broad terrain, water access, relief/movement cost, observed risk
          // and the season physically experienced — and creates NO resource memory and
          // NO food receipt. Learning that a place exists is not learning what can be
          // eaten there: that still requires the existing observe/test/use paths.
          if (result.expedition.taskKind === "frontier_exploration") {
            returnedFrontierRouteTiles.push(...result.expedition.routeTileIds);
            completedFrontierJourneys.push(result.expedition);
          }
        }

        // CORRECTION-24A §9 E4 — audit-only. EVERY terminal frontier party, not only the ones
        // that came home: a `lost` party's journey is exactly the control that proves it
        // transferred nothing, and deriving that from final known-tile counts (which §9 forbids)
        // could never show it. Recorded here, before the return hand-off below, so the
        // "tiles the BAND already knew" comparison is against pre-return knowledge.
        if (isRecordingExplorationJourneys() && result.expedition.taskKind === "frontier_exploration") {
          const plan = result.expedition.frontierPlan;
          const trail = result.expedition.routeTileIds;
          let newTiles = 0;

          for (const tileId of new Set(trail)) {
            if (currentBand.knowledge.observedTiles[tileId] === undefined) {
              newTiles += 1;
            }
          }

          recordExplorationJourney({
            expeditionId: result.expedition.id,
            bandId: String(currentBand.id),
            departureDay: Number(result.expedition.departedDay),
            ...(result.expedition.phase === "completed" ? { returnDay: Number(day) } : {}),
            lost: result.expedition.phase === "lost",
            forcedReturn: terminalReason === "frontier_barrier_blocked" || terminalReason === "party_lost",
            durationDays: Number(day) - Number(result.expedition.departedDay),
            partyWorkers: result.expedition.partyWorkers,
            headingX: plan?.headingX ?? 0,
            headingY: plan?.headingY ?? 0,
            headingBasis: String(plan?.basis ?? "none"),
            anchorTileId: String(result.expedition.targetTileId),
            routeTileIds: trail.map((tileId) => String(tileId)),
            routeSteps: Math.max(0, trail.length - 1),
            routeStepsByDay: takeFrontierStepDays(result.expedition.id),
            deepestReachTiles: result.expedition.frontierDeepestReachTiles ?? 0,
            newTilesEntered: newTiles,
            knownTilesRevisited: new Set(trail).size - newTiles,
            partyLocalObservations: result.expedition.carriedObservations.length,
            provisionsConsumed: result.expedition.cargo.provisionUnitsConsumed,
            riskEpisodes: (result.expedition.riskEpisodeIds ?? []).length,
            // E5 — filled by the return seam below. A lost party never reaches it, so these
            // stay zero and the no-transfer control is structural rather than asserted.
            newRecordsCreated: 0,
            existingRecordsRefreshed: 0,
          });
        }
        // Terminal parties are compacted into bounded history and dropped from the
        // active list — their workers become available again exactly here.
        continue;
      }

      nextExpeditions.push(result.expedition);
    }

    // The ONE writer of realized walking history: completed physical movement.
    mobility = recordWalkingDay(mobility, {
      day,
      km: round4(dayKm),
      loadedKm: round4(dayLoadedKm),
      activeTravel: dayKm > 0,
      source: daySource,
    });

    // §11 — apply the knowledge that PHYSICALLY arrived today, exactly once, through
    // the canonical writers. Patch evidence goes through the SAME activity-memory
    // application the daily path uses; a reconnaissance party's walked tiles go
    // through the SAME single tile-observation writer the decision path uses.
    // While the party was away none of this touched residential knowledge.
    let resourceKnowledgeState = currentBand.resourceKnowledgeState;

    for (const returned of returnedKnowledgeRecords) {
      const targetMemory = resourceKnowledgeState?.patchMemories.find(
        (memory) => String(memory.patchId) === returned.targetPatchId,
      );

      if (targetMemory === undefined) {
        continue;
      }

      // CORRECTION-3 (Defect B) — verification returns go through the observation writer,
      // NOT the activity/harvest writer. A party that never physically reached its patch
      // carries no observation for that tile and therefore updates nothing here.
      if (returned.verificationObservation !== undefined) {
        const updated = applyVerificationObservationToMemory(
          targetMemory,
          returned.verificationObservation.kind,
          returned.verificationObservation.confidence,
          currentWorld.time.tick,
        );
        resourceKnowledgeState =
          resourceKnowledgeState === undefined
            ? resourceKnowledgeState
            : {
                ...resourceKnowledgeState,
                patchMemories: resourceKnowledgeState.patchMemories.map((memory) =>
                  memory.patchId === targetMemory.patchId ? updated : memory,
                ),
              };
        continue;
      }

      const application = applyActivityOutcomeToMemoryForWorld(
        currentWorld,
        { ...currentBand, resourceKnowledgeState },
        returned.record,
        targetMemory,
      );
      resourceKnowledgeState = application.resourceKnowledgeState;
    }

    // REPEATED-BAND-EXPANSION-FISSION-14 — step-mode invariance. `observeTileAndNearby`
    // stamps `firstObservedAt`/`lastObservedAt`/`observedAt` from the world it is given.
    // `currentWorld.time` is the time at the START of the daily-action batch, so under
    // seasonal stepping (one 90-day batch) a return recorded the season-boundary day while
    // under daily stepping (90 one-day batches) the same return recorded its own day —
    // identical tick and season, divergent `day`/`dayOfSeason`. A party physically returned
    // on THIS day, so the day's own time is the correct stamp and it is identical under both
    // step modes. (Latent before this checkpoint: route-reconnaissance returns were rare
    // enough that no audited run exercised the path.)
    const observationWorld = { ...currentWorld, time: getWorldTimeForDay(day) };
    const toTargets = (tileIds: readonly TileId[]) =>
      [...new Set(tileIds)]
        .map((tileId) => currentWorld.tiles[tileId])
        .filter((tile): tile is NonNullable<typeof tile> => tile !== undefined)
        .map((tile) => ({ tile, distance: 0 }));
    // CORRECTION-18 §7 ARM A — physical exploration WITHOUT residential transfer. The
    // party still departs, still commits its workers, still eats its provisions and still
    // walks every step; only the knowledge hand-off is suppressed. That isolates the
    // DIRECT EXPEDITION COST from everything the returned knowledge later causes.
    // Undefined in every normal world, so production is unchanged.
    const transferSuppressed = currentWorld.auditOptions?.frontierKnowledgeTransferDisabled === true;
    // §8 — the two returning information families are stamped with DIFFERENT provenance:
    // a reconnaissance party re-reads country the band already knows, a frontier party
    // brings back shallow single-traversal knowledge of country it did not.
    let knowledge = currentBand.knowledge;

    if (returnedReconRouteTiles.length > 0) {
      knowledge = observeTileAndNearby(
        observationWorld,
        knowledge,
        toTargets(returnedReconRouteTiles),
        "returned_route_reconnaissance",
      );
    }

    if (returnedFrontierRouteTiles.length > 0 && !transferSuppressed) {
      // CORRECTION-24A §10 E5 — audit-only. The canonical return is the ONE place where a
      // party's observations become band knowledge, so "what the party brought home" and "what
      // the band now holds" are measured on either side of this single call rather than
      // inferred from a later count. §10 forbids collapsing the two.
      const before = knowledge.observedTiles;

      knowledge = observeTileAndNearby(
        observationWorld,
        knowledge,
        toTargets(returnedFrontierRouteTiles),
        "returned_frontier_exploration",
      );

      if (isRecordingExplorationRecords()) {
        const journey = completedFrontierJourneys[0];
        let created = 0;
        let refreshed = 0;

        for (const tileId of new Set(returnedFrontierRouteTiles)) {
          const after = knowledge.observedTiles[tileId];

          if (after === undefined) {
            continue;
          }

          const isNew = before[tileId] === undefined;

          if (isNew) {
            created += 1;
          } else {
            refreshed += 1;
          }

          recordExplorationRecord({
            bandId: String(currentBand.id),
            tileId: String(tileId),
            expeditionId: String(journey?.id ?? ""),
            createdDay: Number(day),
            isNewRecord: isNew,
            ...(after.acquisition === undefined ? {} : { acquisitionKind: String(after.acquisition) }),
            confidence: after.confidence ?? 0,
            seasonsObserved: (after.seasonsObserved ?? []).length,
            firstObservedDay: Number(after.firstObservedAt ?? day),
            lastObservedDay: Number(after.lastObservedAt ?? day),
          });
        }

        if (journey !== undefined) {
          amendExplorationJourney(journey.id, { newRecordsCreated: created, existingRecordsRefreshed: refreshed });
        }
      }
    }

    // CORRECTION-23 §13/§14 — apply what verification parties physically brought home.
    //
    // The attempt history is recorded for EVERY returned verification, including negatives,
    // because "we went and there was nothing" is exactly the evidence that stops the band
    // walking back there forever. Only the tested domain is upgraded: a water answer never
    // becomes a resource claim, and a single visit never becomes a seasonal calendar.
    let verificationAttempts = currentBand.frontierVerificationAttempts ?? [];
    // CORRECTION-23B §4/§11 — the AUTHORITATIVE record the domain readers consume, kept
    // separate from the bounded display ring above. Keyed by (place, question) and upserted,
    // so repeated attempts update a row instead of appending one.
    let verificationEvidence = currentBand.verificationEvidence;
    const verificationHardship = deriveVerificationNeed(currentBand).need;

    for (const returned of returnedVerifications) {
      // CORRECTION-23J §8 — audit-only. The return half. Reaching this loop IS the physical
      // return: a lost party never appears, which is the §9 J9 control.
      if (isRecordingVerificationJourneys()) {
        recordVerificationReturn({
          verificationExpeditionId: returned.expeditionId,
          bandId: String(currentBand.id),
          question: returned.result.question,
          targetTileId: String(returned.result.targetTileId),
          returnDay: Number(day),
          outcome: returned.result.outcome,
        });
      }

      verificationAttempts = recordVerificationAttempt(verificationAttempts, {
        tileId: returned.result.targetTileId,
        question: returned.result.question,
        tick: getWorldTimeForDay(day).tick,
        season: returned.result.season,
        outcome: returned.result.outcome,
      });
      // CORRECTION-23D §6/§9 — the DURABLE conclusion goes on the place record, which is
      // written AFTER `observeTileAndNearby` above so the walked-route observation cannot
      // overwrite it. It survives every cap in this subsystem and is forgotten only when the
      // band forgets the place itself.
      const targetRecord = knowledge.observedTiles[returned.result.targetTileId];

      if (targetRecord !== undefined) {
        knowledge = {
          ...knowledge,
          observedTiles: {
            ...knowledge.observedTiles,
            [returned.result.targetTileId]: {
              ...targetRecord,
              verificationDisposition: recordPlaceDisposition(targetRecord.verificationDisposition, {
                question: returned.result.question,
                outcome: returned.result.outcome,
                season: returned.result.season,
                tick: getWorldTimeForDay(day).tick,
                routeTiles: returned.routeTiles,
                ...(returned.result.accessFailureKind === undefined
                  ? {}
                  : { accessFailureKind: returned.result.accessFailureKind }),
              }),
            },
          },
        };
      }

      verificationEvidence = recordVerificationEvidence(verificationEvidence, {
        tileId: returned.result.targetTileId,
        question: returned.result.question,
        outcome: returned.result.outcome,
        season: returned.result.season,
        tick: getWorldTimeForDay(day).tick,
        hardship: verificationHardship,
        routeTiles: returned.routeTiles,
        // CORRECTION-23B §8 — route repeatability, recorded as a BY-PRODUCT of the journey
        // rather than as a question that consumes a party. This party walked out and walked
        // home, which is the whole test the removed question used to claim to perform.
        routeEvidence: "walked_out_and_back",
        ...(returned.acquisition === undefined ? {} : { acquisition: returned.acquisition }),
        ...(returned.result.accessFailureKind === undefined
          ? {}
          : { accessFailureKind: returned.result.accessFailureKind }),
      });
    }

    // §13 — smoke the camp saw today enters the band's bounded, expiring record.
    let receivedSmokeSignals = currentBand.receivedSmokeSignals;

    for (const received of receivedSignalsToday) {
      receivedSmokeSignals = appendReceivedSignal(
        { ...currentBand, receivedSmokeSignals },
        received,
        day,
      );
    }

    if (deposits.length === 0 && nextExpeditions.length === (currentBand.expeditions ?? []).length) {
      bandsById[band.id] = {
        ...currentBand,
        expeditions: nextExpeditions,
        recentExpeditionOutcomes: outcomes,
        mobility,
        resourceKnowledgeState,
        knowledge,
        receivedSmokeSignals,
        frontierVerificationAttempts: verificationAttempts,
        ...(verificationEvidence === undefined ? {} : { verificationEvidence }),
      };
      changed = true;
      continue;
    }

    bandsById[band.id] = {
      ...currentBand,
      expeditions: nextExpeditions,
      recentExpeditionOutcomes: outcomes,
      mobility,
      resourceKnowledgeState,
      knowledge,
      receivedSmokeSignals,
      frontierVerificationAttempts: verificationAttempts,
      ...(verificationEvidence === undefined ? {} : { verificationEvidence }),
      ...(deposits.length === 0
        ? {}
        : {
            // The ONE place an expedition's food becomes the band's food: at the return
            // tick, once. `recentIntraSeasonTrips` remains the behaviour/UI record, while
            // the authoritative food credit goes to the bounded per-period accumulator
            // (LOST-LINEAGE RECOVERY-12) so carried-home cargo can never be evicted from the
            // 24-record UI window before the ledger reads it. Each deposit is counted once.
            recentIntraSeasonTrips: [...deposits, ...(currentBand.recentIntraSeasonTrips ?? [])].slice(0, 24),
            lastIntraSeasonTrip: deposits[0],
            seasonalFoodReceipts: depositFoodReceipts(currentBand.seasonalFoodReceipts, deposits),
          }),
    };
    changed = true;
  }

  return changed ? { ...currentWorld, bands: bandsById as WorldState["bands"] } : world;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
