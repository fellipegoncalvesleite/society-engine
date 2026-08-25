import type {
  ActivityMemoryConfidenceChannel,
  ActivityMemoryConfidenceSnapshot,
  ActivityMemoryEffectCount,
  ActivityMemoryEffectRecord,
  ActivityMemoryEffectType,
  ActivityMemoryUpdateSummary,
  AnimalActivityTrace,
  ActivityGroupLaborRecord,
  ActivityGroupLaborStatus,
  ActivityLaborSummary,
  ActivityOutcomeSummary,
  ActivityOutcomeTaskTypeCount,
  ActivityOutcomeTypeCount,
  ActivityResourceReturnRecord,
  ActivityReturnResourceKind,
  ActivityReturnResourceKindCount,
  ActivityShadowReturnKind,
  ActivityShadowReturnKindContribution,
  ActivityShadowReturnRecord,
  ActivityShadowSubsistenceSummary,
  ActivityShadowTaskTypeContribution,
  ActivityTypeLaborAllocation,
  AquaticActivityTrace,
  Band,
  IntraSeasonTripCause,
  IntraSeasonTripActivityResult,
  IntraSeasonTripMovementType,
  IntraSeasonTripObjective,
  IntraSeasonTripOutcome,
  IntraSeasonTripRecord,
  IntraSeasonTripTaskGroupType,
  PlantPatchActivityTrace,
  PhysicalFoodHarvestRecord,
} from "./types";
import type { DailyAction } from "./dailyActions";
import { isProvisionalSuccessor } from "./bandLifecycle";
import { deriveBaseHabitatPotential } from "./habitatYield";
import {
  applyFaunaTripDepletion,
  deriveFaunaStockGeography,
  deriveFaunaTripStockTrace,
  deriveFaunaTripReturnFactor,
  resolveFaunaFoodHarvest,
  type FaunaTripStockTraceBase,
  type FaunaClass,
  type FaunaHabitatType,
  type FaunaStockGeography,
  type FaunaStockKind,
} from "./faunaStock";
import { derivePlantGatherPatchTrace, derivePlantGatherReturnFactor, resolvePlantFoodHarvest, type PlantGatherPatchTraceBase } from "./plantStock";
import { deriveResourceClassAvailability } from "./resourceClasses";
import { deriveHuntingSafetyRelief } from "./adaptationBoundary";
import {
  classifyActivityReturnKind,
  getActivityReturnSemantics,
  isPhysicalFoodReturnKind,
  isPhysicalMaterialReturnKind,
} from "./physicalFoodReturn";
import { depositFoodReceipt } from "./seasonalFoodReceipts";
import { effectiveResourceConfidence, updateResourceKnowledgeFromObservation } from "./resourceKnowledge";
import {
  deriveSeasonalEcologyFactor,
  shadowSeasonalModifier,
  taskGroupTypeToEcologyDomain,
  updateSeasonalEcologyMemory,
} from "./seasonalResourceEcology";
// 2K.12: selection-only seasonal-memory reader (band-learned only; no hidden truth).
import { domainForResourceClass, readSeasonalEcologyHint } from "./seasonalEcologyReader";
import type {
  ResourceConfidenceProfile,
  ResourceKnowledgeState,
  ResourcePatchContradictionKind,
  ResourcePatchLearningMemory,
  ResourcePatchLearningOutcome,
  ResourcePatchMemory,
  ResourceKnowledgeStateKind,
  ResourceUseHistory,
} from "./resourceKnowledge";
import type { ResourceClassId } from "./resourceClasses";
// CORRECTION-26 — the pending-investigation lifecycle and the execution-neutral domain
// half of a scout/probe observation. Both are `agents/` modules, so the daily physical path
// reaches the same canonical operations the seasonal decision layer uses without an
// `agents -> rules` runtime cycle.
import {
  appendInvestigationOutcome,
  makeInvestigationExecutionId,
  resolvePendingInvestigation,
  toInvestigationOutcomeEntry,
  type PendingInvestigationOutcome,
  type PendingInvestigationRecord,
} from "./pendingInvestigation";
import {
  applyResourceScoutObservation,
  applySideEncounteredCautiousTest,
  formSideCountryResourceMemory,
} from "./resourceScoutObservation";
import { appendRecentScoutLearning } from "./resourceScout";
import {
  collectDirectObservationTargets,
  observeTileAndNearby,
  type ObservationTarget,
} from "./tileObservation";
import { recordProbe } from "./probeMemory";
import { markVisibleLandscapeCueProbeChecked } from "./landscapeVisibility";
import { advanceExploitationSkill } from "./exploitationSkill";
import { appendRecentPlantUseTest, type PlantUseTestEvent } from "./plantUseTesting";
import { appendRecentCauseSpecificEvent, type CauseSpecificEvent } from "./causeSpecificEvent";
import type { BandId, DayNumber, ReasonId, ResourcePatchId, TickNumber, TileId } from "../core/types";
import { SEASON_LENGTH_DAYS } from "../core/types";
import { getWorldTimeForDay } from "../tick/time";
import { isBandPassableDestination } from "../world/passability";
import type { Tile, WorldState } from "../world/types";
import { deriveTravelPace, type TravelContext } from "./bandMobility";
import { getRouteTravelTimeDays } from "./traversal";

const TRIP_DAY_CADENCE = 3;
const FIRST_TRIP_DAY_OF_SEASON = 6;
const MAX_TRIP_DISTANCE_TILES = 10;
/** On-site search/work share reserved inside an ordinary same-day trip. */
const INTRA_SEASON_ACTIVITY_WORK_DAYS = 0.25;
const RECENT_TRIP_RECORD_CAP = 24;
const RECENT_ACTIVITY_GROUP_SUMMARY_CAP = 8;
const STARTING_LOCAL_RECON_MAX_DISTANCE_TILES = 2;
const STARTING_LOCAL_RECON_OBSERVED_TILE_CAP = 6;
const LOW_MEMORY_CONFIDENCE_THRESHOLD = 0.25;
const PARTIAL_RETURN_CONFIDENCE_THRESHOLD = 0.58;
const OBSERVATION_CONFIDENCE_THRESHOLD = 0.42;
const RECENT_ACTIVITY_MEMORY_EFFECT_CAP = 8;

interface TripCandidate {
  readonly memory: ResourcePatchMemory;
  readonly targetTileId: TileId;
  readonly distanceTiles: number;
  readonly cause: IntraSeasonTripCause;
  readonly score: number;
  readonly riskToleranceModifier: number;
  readonly fallbackExpansionBias: number;
  readonly tripAbandonmentPenalty: number;
  readonly nearbyProbeBonus: number;
  readonly logisticsSelectionBias: number;
  readonly seededResourceKnowledgeState?: ResourceKnowledgeState;
}

interface ActivityOutcomeDetail {
  readonly activityOutcome: IntraSeasonTripActivityResult;
  readonly activityOutcomeReasonIds: readonly ReasonId[];
  readonly activityOutcomeSummary: string;
  readonly resourceReturn: ActivityResourceReturnRecord;
}

export interface ActivityMemoryApplication {
  readonly resourceKnowledgeState: ResourceKnowledgeState | undefined;
  readonly effect: ActivityMemoryEffectRecord;
}

/**
 * TIME-1C: the task-group trip ledger exposed as a registered {@link DailyAction}.
 * It samples regular daily activity at a bounded cadence, recording
 * non-relocating task-group trips with explicit source/type/objective metadata.
 * `apply` records breadcrumbs/outcomes but NEVER moves `band.position`.
 * This is the first member of the daily-action registry; the time system runs it
 * identically under daily/weekly/monthly/seasonal step modes.
 */
export const intraSeasonTripDailyAction: DailyAction = {
  id: "intra-season-trips",
  firesOnDayOfSeason(dayOfSeason: number): boolean {
    return dayOfSeason >= FIRST_TRIP_DAY_OF_SEASON && dayOfSeason < SEASON_LENGTH_DAYS && dayOfSeason % TRIP_DAY_CADENCE === 0;
  },
  apply(world: WorldState, day: number): WorldState {
    return applyTripDay(world, day);
  },
};

/**
 * EXPEDITIONARY-1 — resolve the PHYSICAL work an away party performs at its distant
 * target, on the day it is actually standing there. This deliberately reuses the
 * daily-trip machinery unchanged (`buildTripRecord` → `resolvePhysicalFoodHarvest`),
 * so a distant party draws from the SAME plant/fauna/aquatic stocks, pays the SAME
 * transport/processing losses, and produces the SAME `PhysicalFoodHarvestRecord`
 * shape as a near trip. The stock is depleted HERE (the party is physically present);
 * the receipt is NOT yet food for the band — the expedition carries it home as cargo
 * and only the return deposits it into `recentIntraSeasonTrips` (and thus the
 * canonical ledger), exactly once.
 *
 * The returned record is NOT pushed anywhere by this function: the caller owns the
 * cargo/return lifecycle.
 */
export function resolveExpeditionTargetWork(
  world: WorldState,
  band: Band,
  memory: ResourcePatchMemory,
  targetTileId: TileId,
  distanceTiles: number,
  routeTiles: readonly TileId[],
  day: DayNumber,
  cause: IntraSeasonTripCause,
  options: {
    // §10 — verification parties look WITHOUT taking: the physical lookup runs (source
    // found? availability? depletion?) but the harvest is forced ineligible, so no stock
    // is depleted and no cargo/food can exist. The record still carries the physical
    // presence evidence the party will walk home.
    readonly verifyOnly?: boolean;
    /**
     * CORRECTION-34E — THE PRODUCTIVE LABOUR PHYSICALLY STANDING AT THIS TARGET.
     *
     * Required, and deliberately without a fallback. This resolver used to hand the whole
     * residential `band` to `buildTripRecord`, which derived a task-group size from
     * `workingAdults` MINUS the workers already committed to expeditions — the labour left AT
     * HOME. The party doing the work was never consulted. Measured on one real patch: the same
     * five-worker party removed 0.0086 of stock with one adult at home and 0.0354 with
     * twenty-five, a 4.1x difference in distant physical depletion decided by people who never
     * left camp, while changing the party from two workers to five changed nothing.
     *
     * A default here would silently restore that defect for any caller that forgot, so there is
     * none: an expedition that cannot say how many of its people are working cannot resolve work.
     *
     * CORRECTION-34F — MUST BE A POSITIVE INTEGER. 34E required the field and left the value
     * unconstrained, which let two impossible parties through. Zero workers were classified
     * `target_found` (the outcome test is `>= 2`), given a request built from the confidence terms
     * alone (`0 * 0.035 + yieldConfidence * 0.22 + presenceConfidence * 0.08`), and **removed
     * 0.0047 of real stock**; and `0.4` and `1.6` people were silently rounded to 0 and 2. People
     * are counted, not measured, and nobody cannot work.
     *
     * THE BOUND HERE IS ONE, NOT `EXPEDITION_MIN_PARTY_WORKERS`, and that is deliberate. One person
     * can physically do a day's work — the two-worker minimum is an EXPEDITION POLICY about what is
     * worth sending and what turns for home, enforced in `expedition.ts` by the launch gate
     * (`partyWorkers < 2` never launches) and by `reconcileExpeditionLabor` (a party reduced below
     * the minimum is turned `returning` or `aborted` before it can operate). This module is the
     * physical work resolver and must not encode that policy: `expedition.ts` imports
     * `intraSeasonTrips.ts` and never the reverse, so reaching for the constant would close a
     * dependency cycle to share a number that belongs to the other module anyway.
     */
    readonly partyWorkers: number;
  },
): { readonly world: WorldState; readonly record: IntraSeasonTripRecord } {
  const productiveWorkers = options?.partyWorkers;

  if (
    typeof productiveWorkers !== "number" ||
    !Number.isInteger(productiveWorkers) ||
    productiveWorkers < 1
  ) {
    throw new Error(
      "resolveExpeditionTargetWork requires options.partyWorkers to be a positive integer — the " +
      "productive labour physically present in the party. Received " + String(productiveWorkers) + ". " +
      "Zero or fractional labour cannot produce a physical request, stock removal, cargo or an " +
      "observation, and falling back to residential labour is the CORRECTION-34E defect.",
    );
  }

  const time = getWorldTimeForDay(day);
  const faunaGeo = deriveFaunaStockGeography(world);
  // EXPEDITIONARY-4 §5.2 (multi-tile patch) — a remembered patch is anchored to an
  // approximate tile but may span linked tiles. If the walked route physically ends on
  // one of the patch's linked tiles rather than the anchor, the party IS standing at
  // the patch: work resolves at the linked stand tile without losing the patch identity
  // the launch recorded.
  const standTileId = routeTiles[routeTiles.length - 1];
  const workTileId =
    standTileId !== targetTileId && memory.linkedTiles.includes(standTileId) ? standTileId : targetTileId;
  const candidate: TripCandidate = {
    memory,
    targetTileId: workTileId,
    distanceTiles,
    cause,
    score: 0,
    riskToleranceModifier: 0,
    fallbackExpansionBias: 0,
    tripAbandonmentPenalty: 0,
    nearbyProbeBonus: 0,
    logisticsSelectionBias: 0,
  };
  // EXPEDITIONARY-4 §5 — the party is PHYSICALLY at the target when this resolves. The
  // same-day shadow gates (`failed_due_to_distance`, `delayed_return`, low-memory
  // hesitation) model whether a day-group would even get there; applying them to a
  // party that already walked the route zeroed the physical work request and was the
  // proven cause of the generic target_not_found dominance (218/362 in the 40y audit).
  const baseRecord = buildTripRecord(world, band, candidate, day, time.tick, time.season, faunaGeo, {
    physicallyAtTarget: true,
    // CORRECTION-34F — passed through unaltered. The previous `Math.max(0, Math.round(...))` was
    // the laundering step: it turned an impossible count into a plausible one and let the caller's
    // mistake reach the stock. Validated above, so there is nothing left to clamp.
    productiveWorkers,
  });
  // Override the route with the expedition's real, already-walked physical route so
  // `routeReached` reflects where the party is genuinely standing rather than
  // re-deriving a short daily path.
  const verifyOnly = options?.verifyOnly === true;
  const expeditionRecord: IntraSeasonTripRecord = {
    ...baseRecord,
    pathTiles: routeTiles,
    // CORRECTION-4 §4 — mark a look-without-taking visit so recency suppression can tell
    // inspection from exploitation.
    ...(verifyOnly ? { inspectionOnly: true } : {}),
  };
  return resolvePhysicalFoodHarvest(world, expeditionRecord, time, faunaGeo, verifyOnly);
}

// EXPEDITIONARY-2 (Slice A): the registry moved to `dailyActionRegistry.ts`. Keeping it
// here would force this module to import the expedition module that imports it back,
// producing a module-initialization cycle (TDZ) on a registry const.

function applyTripDay(world: WorldState, day: number): WorldState {
  const time = getWorldTimeForDay(day as DayNumber);
  const bandsById: Record<string, Band> = { ...world.bands };
  // CORRECTION-26 — how many same-day workers each band already committed to its ordinary
  // subsistence trip today. The investigation party is staffed from what is LEFT, so the
  // two cannot both spend the same people.
  const tripWorkersByBandId = new Map<BandId, number>();
  // FAUNA/AQUATIC-1 — fauna geography is static (memoized by tiles); the dynamic
  // stock state is threaded through the day so each successful hunting/fishing
  // trip depletes the targeted stock and LATER bands the same day see the lower
  // abundance in their return factor (shared-catchment competition, deterministic
  // sorted band order).
  const faunaGeo = deriveFaunaStockGeography(world);
  let currentWorld = world;
  let changed = false;

  for (const band of Object.values(world.bands).sort(compareBands)) {
    if (!isActiveBand(band)) {
      continue;
    }

    // ROADMAP ITEM 4 — an ordinary same-day subsistence trip runs OUT FROM A RESIDENCE and back to
    // it. A provisional successor has no residence yet, and the admission audit measured one running
    // TWENTY-FOUR of these while a control band ran none. Whatever a travelling group eats is the
    // travel authority's to model; it may not borrow the residential one. Inert today.
    if (isProvisionalSuccessor(band)) {
      continue;
    }

    const candidate = selectTripCandidate(currentWorld, band, day, MAX_TRIP_DISTANCE_TILES, false, true);

    if (candidate === undefined) {
      continue;
    }

    // EXPEDITIONARY-2 §1 — REQUIRED PHYSICAL CORRECTION. This path is the SAME-DAY
    // activity path and nothing else. A round trip that does not fit the genuine
    // same-day budget used to be resolved here anyway: it was merely LABELLED
    // "overnight"/"continues" by classifyOutcome while still depleting the distant
    // stock and crediting the band's food ledger on the departure day — a teleport
    // with no travel time, provisions, carry ceiling, return leg, or risk.
    // Multi-day work now belongs to the expedition lifecycle (expedition.ts), which
    // launches from the same band-known candidate and delivers a receipt only on
    // physical return. Skipping here is what removes the fake instant credit.
    const activityBand =
      candidate.seededResourceKnowledgeState === undefined
        ? band
        : {
            ...band,
            resourceKnowledgeState: candidate.seededResourceKnowledgeState,
          };
    const initialRecord = buildTripRecord(currentWorld, activityBand, candidate, time.day ?? (day as DayNumber), time.tick, time.season, faunaGeo);
    const physicalResolution = resolvePhysicalFoodHarvest(currentWorld, initialRecord, time, faunaGeo);
    currentWorld = physicalResolution.world;
    const resolvedRecord = physicalResolution.record;
    const memoryApplication = applyActivityOutcomeToMemoryForWorld(currentWorld, activityBand, resolvedRecord, candidate.memory);
    const record: IntraSeasonTripRecord = {
      ...resolvedRecord,
      activityMemoryEffect: memoryApplication.effect,
      reasonIds: [...resolvedRecord.reasonIds, ...memoryApplication.effect.reasonIds],
    };
    const recentIntraSeasonTrips = [record, ...(band.recentIntraSeasonTrips ?? [])].slice(0, RECENT_TRIP_RECORD_CAP);
    const activityLaborSummary = buildActivityLaborSummary(activityBand, record, recentIntraSeasonTrips);
    // ECO-SEASON-1: learn the realized seasonal ecology into the band's SEPARATE seasonal
    // memory (never read by the economy). Only tiles the band actually visited get learned.
    const seasonalEcologyMemory =
      record.seasonalEcology === undefined || record.seasonalEcology.taughtSeasonalHint !== true
        ? band.seasonalEcologyMemory
        : updateSeasonalEcologyMemory(band.seasonalEcologyMemory, record.targetTileId, record.seasonalEcology, time.tick);
    bandsById[band.id] = {
      ...band,
      resourceKnowledgeState: memoryApplication.resourceKnowledgeState,
      lastIntraSeasonTrip: record,
      recentIntraSeasonTrips,
      // LOST-LINEAGE RECOVERY-12 — authoritative same-day food capture. This deposits the
      // freshly returned receipt (a no-op for non-food trips) into the bounded per-period
      // accumulator, independent of the `recentIntraSeasonTrips` UI window that can evict it.
      seasonalFoodReceipts: depositFoodReceipt(band.seasonalFoodReceipts, record),
      seasonalEcologyMemory,
      activityLaborSummary,
      activityOutcomeSummary: buildActivityOutcomeSummary(activityBand, record, recentIntraSeasonTrips),
      activityShadowSubsistenceSummary: buildActivityShadowSubsistenceSummary(
        activityBand,
        record,
        recentIntraSeasonTrips,
        activityLaborSummary,
      ),
      activityMemoryUpdateSummary: buildActivityMemoryUpdateSummary(activityBand, record, recentIntraSeasonTrips),
    };
    tripWorkersByBandId.set(band.id, record.estimatedPeopleCount);
    changed = true;

  }

  // CORRECTION-26 §13 step 5 — THE SANCTIONED DAILY EXECUTION OF A SELECTED INVESTIGATION.
  //
  // A separate, explicitly ordered phase rather than a branch inside the loop above, for the
  // same reason `dailyActionRegistry.ts` runs trips before expeditions: every band's ordinary
  // subsistence trip is resolved first, so the labour an investigation party can draw on is a
  // fact rather than a race. Band order is the same deterministic `compareBands` sort.
  for (const band of Object.values(bandsById).sort(compareBands)) {
    if (!isActiveBand(band) || band.pendingInvestigation === undefined) {
      continue;
    }

    const executed = executePendingInvestigation(
      // STEP-MODE CRITICAL — the world carried through `runDailyActions` keeps the time of
      // the span's START, because the daily loop never advances `world.time`. Under
      // seasonal stepping that is the previous boundary; under daily stepping it is the
      // real day. Observing with it stamped observations at day 180 instead of 185 and
      // broke step-mode invariance — the same defect CORRECTION-15 repaired for the
      // expedition observation timestamp. The executor is handed the day it is actually
      // running on, and `derivePhysicalRoundTripTiming`/`buildOutboundPathTiles` are unaffected
      // because they read tiles, not time.
      { ...currentWorld, time },
      band,
      day as DayNumber,
      tripWorkersByBandId.get(band.id) ?? 0,
    );

    if (executed === undefined) {
      continue;
    }

    bandsById[band.id] = executed;
    changed = true;
  }

  return changed
    ? {
        ...currentWorld,
        bands: bandsById as Readonly<Record<BandId, Band>>,
      }
    : world;
}

// ─────────────────────────────────────────────────────────────────────────────
// CORRECTION-26 — PHYSICAL EXECUTION OF A SELECTED RESOURCE INVESTIGATION.
//
// The seasonal decision leaves a bounded pending record and observes nothing. This is where
// a party is actually staffed, walks a contiguous passable route, arrives or fails, and —
// only on arrival — observes. Every physical primitive is the one the same-day trip path
// already owns: `buildOutboundPathTiles`/`findPassablePath` for the route,
// `isBandPassableDestination` for the destination, `derivePhysicalRoundTripTiming` for the
// same-day boundary, and the identical aquatic-adjacent arrival rule
// `resolvePhysicalFoodHarvest` uses. Nothing new is scheduled and nothing is reserved.
//
// INFORMATION IS INFORMATION. This path never builds an `IntraSeasonTripRecord`, never
// touches `recentIntraSeasonTrips`, and therefore can never reach `depositFoodReceipt`,
// `resolvePlantFoodHarvest`/`resolveFaunaFoodHarvest`, or the canonical food ledger. The
// §11 accounting invariant is structural here, not conditional.
// ─────────────────────────────────────────────────────────────────────────────

/** The smallest party that can be sent to look at something. Below this, nobody goes. */
const INVESTIGATION_MIN_PARTY_WORKERS = 1;
/** An information party is small — the same shape as a `memory_refresh_group`. */
const INVESTIGATION_MAX_PARTY_WORKERS = 4;
const INVESTIGATION_PARTY_SHARE = 0.12;
/** Hard bound on how many tiles one executed investigation may observe. */
const INVESTIGATION_OBSERVATION_CAP = 32;

function executePendingInvestigation(
  world: WorldState,
  band: Band,
  day: DayNumber,
  tripWorkersUsedToday: number,
): Band | undefined {
  const record = band.pendingInvestigation;

  if (record === undefined || record.status !== "pending") {
    return undefined;
  }

  // NO DUPLICATE EXECUTION. An execution id is written exactly once; a record carrying one
  // has already been attempted and is never attempted again.
  if (record.executionId !== undefined) {
    return undefined;
  }

  const settle = (
    outcome: PendingInvestigationOutcome,
    detail?: Parameters<typeof resolvePendingInvestigation>[1],
  ): Band => {
    const resolved = resolvePendingInvestigation(record, {
      outcome,
      resolvedDay: day,
      ...(detail ?? {}),
    });
    return {
      ...band,
      pendingInvestigation: undefined,
      recentInvestigationOutcomes: appendInvestigationOutcome(
        band.recentInvestigationOutcomes,
        toInvestigationOutcomeEntry(resolved),
      ),
    };
  };

  // (1) DETERMINISTIC EXPIRY, checked before anything physical and before any tile is read.
  if (Number(day) > Number(record.expiresAfterDay)) {
    return settle("expired_before_execution");
  }

  // (2) REVALIDATION. None of these reads resource truth; they read where the band is and
  // whether the destination is a place a band may stand.
  if (band.position !== record.originTileId) {
    return settle("band_moved_before_departure");
  }

  const origin = world.tiles[record.originTileId];
  const target = world.tiles[record.targetTileId];

  if (origin === undefined || target === undefined) {
    return settle("target_no_longer_valid");
  }

  if (!isBandPassableDestination(target) && resolveShoreApproachTile(world, origin, target) === undefined) {
    return settle("destination_blocked");
  }

  // (4) LABOUR. Adults away on an expedition are not at camp; adults already out on today's
  // ordinary trip are already spent. The party can never exceed what is left, and a band
  // with nobody left sends nobody — the real `insufficient_labor` case, not a floor of one.
  //
  // CORRECTION-34D — this is a LABOUR question, so it correctly reads `partyWorkers`, which is now
  // productive labour only. A non-working party member is deliberately NOT subtracted here: they
  // are drawn from no cohort this sum counts, and subtracting them would charge the residence for
  // labour that was never in `workingAdults`.
  const awayWorkers = (band.expeditions ?? [])
    .filter((expedition) =>
      expedition.phase === "prepared" ||
      expedition.phase === "outbound" ||
      expedition.phase === "operating" ||
      expedition.phase === "returning")
    .reduce((total, expedition) => total + expedition.partyWorkers, 0);
  const availableWorkers = Math.max(
    0,
    Math.round(band.demography.workingAdults - awayWorkers - tripWorkersUsedToday),
  );

  if (availableWorkers < INVESTIGATION_MIN_PARTY_WORKERS) {
    return settle("insufficient_labor", {
      outcome: "insufficient_labor",
      resolvedDay: day,
      availableWorkers,
      partyWorkers: 0,
    });
  }

  // (5) THE ROUTE. The same deterministic passable-path builder the daily trips use. A
  // single-tile result means no contiguous passable route exists from where the band is
  // standing — so NOBODY LEAVES. `partyWorkers` stays 0: labour was available, but there
  // was nowhere to walk. No trip is resolved, so this case produces no
  // `IntraSeasonTripActivityResult` at all.
  const routeTiles = buildOutboundPathTiles(world, record.originTileId, record.targetTileId);

  if (routeTiles.length <= 1) {
    return settle("route_unavailable", {
      outcome: "route_unavailable",
      resolvedDay: day,
      availableWorkers,
      partyWorkers: 0,
      routeTileIds: routeTiles,
    });
  }

  // The party is staffed only once there is somewhere to walk, and never exceeds what is
  // available after the expedition and same-day commitments above.
  const partyWorkers = Math.min(
    availableWorkers,
    Math.max(
      INVESTIGATION_MIN_PARTY_WORKERS,
      Math.min(INVESTIGATION_MAX_PARTY_WORKERS, Math.round(availableWorkers * INVESTIGATION_PARTY_SHARE)),
    ),
  );

  // (6) THE REAL WALK. Selection measures straight-line distance; the ground may be longer.
  // Re-classify on the route actually walked, through the same authoritative helper.
  const routeDistanceTiles = routeTiles.length - 1;
  const tripTiming = derivePhysicalRoundTripTiming(
    world,
    band,
    routeTiles,
    INTRA_SEASON_ACTIVITY_WORK_DAYS,
    "selected_reconnaissance_party",
  );
  const durationDays = tripTiming.durationDays;

  if (!tripTiming.sameDay) {
    return settle("beyond_same_day_reach", {
      outcome: "beyond_same_day_reach",
      resolvedDay: day,
      availableWorkers,
      partyWorkers,
      routeTileIds: routeTiles,
      routeDistanceTiles,
      durationDays,
    });
  }

  // (7) ARRIVAL, by the identical rule `resolvePhysicalFoodHarvest:330-331` applies: the
  // party stands on the target, or on a land tile adjacent to an aquatic target.
  const standTileId = routeTiles[routeTiles.length - 1];
  const arrived = standTileId === record.targetTileId ||
    (target.isAquatic === true && world.tiles[standTileId]?.neighbors.includes(record.targetTileId) === true);
  const executionId = makeInvestigationExecutionId(record, day);

  if (!arrived) {
    // The exact production result for a party that could not reach its target. The audit
    // label `route_time_infeasible` is NOT a production name and is not used.
    return settle("arrival_failed", {
      outcome: "arrival_failed",
      resolvedDay: day,
      executionId,
      activityOutcome: "failed_due_to_distance",
      availableWorkers,
      partyWorkers,
      routeTileIds: routeTiles,
      routeDistanceTiles,
      durationDays,
    });
  }

  // (8) LEGITIMATE OBSERVATION. Only here, and only through the canonical writer.
  const observationTargets = collectInvestigationObservationTargets(world, routeTiles);
  const observedTileIds = observationTargets.map((entry) => entry.tile.id);
  const newTilesObserved = observedTileIds.some((id) => band.knowledge.observedTiles[id] === undefined);
  const updatedKnowledge = observeTileAndNearby(world, band.knowledge, observationTargets);
  const observedBand: Band = { ...band, knowledge: updatedKnowledge };
  const learned = applyInvestigationLearning(world, observedBand, record, updatedKnowledge, newTilesObserved);
  const resolved = resolvePendingInvestigation(record, {
    outcome: "executed_and_returned",
    resolvedDay: day,
    executionId,
    // A same-day information party comes home having looked. This is the only outcome that
    // may carry `returned_with_information`, and that kind is not a physical food return
    // (`physicalFoodReturn.ts`), so no receipt, cargo or support can follow from it.
    activityOutcome: "returned_with_information",
    availableWorkers,
    partyWorkers,
    routeTileIds: routeTiles,
    routeDistanceTiles,
    durationDays,
    observedTileIds,
  });

  return {
    ...band,
    ...learned,
    knowledge: updatedKnowledge,
    // 2K.1G/2K.1H probe recency — now recorded against a REAL visit, with a real answer to
    // "did this teach us anything the band did not already know".
    probeMemory: recordProbe(band.probeMemory, record.targetTileId, world.time.tick, newTilesObserved),
    // CORRECTION-26 — the cue is `partly_checked` because a party checked it.
    visibleLandscapeCues: markVisibleLandscapeCueChecked(band, record),
    pendingInvestigation: undefined,
    recentInvestigationOutcomes: appendInvestigationOutcome(
      band.recentInvestigationOutcomes,
      toInvestigationOutcomeEntry(resolved),
    ),
  };
}

/**
 * What a party that physically walked the route can directly perceive from each stand.
 * Candidate geometry and confidence are owned by tileObservation's physical-km authority;
 * the investigation still earns nothing until the route/time executor confirms arrival.
 */
function collectInvestigationObservationTargets(
  world: WorldState,
  routeTiles: readonly TileId[],
): readonly ObservationTarget[] {
  const byTileId = new Map<TileId, ObservationTarget>();

  for (const tileId of routeTiles) {
    const stoodTile = world.tiles[tileId];
    if (stoodTile === undefined) {
      continue;
    }

    for (const target of collectDirectObservationTargets(world, stoodTile)) {
      const existing = byTileId.get(target.tile.id);
      if (existing === undefined || target.distanceKm < existing.distanceKm) {
        byTileId.set(target.tile.id, target);
      }
    }
  }

  return Array.from(byTileId.values())
    .sort((left, right) =>
      left.distanceKm === right.distanceKm
        ? String(left.tile.id).localeCompare(String(right.tile.id))
        : left.distanceKm - right.distanceKm,
    )
    .slice(0, INVESTIGATION_OBSERVATION_CAP);
}

/**
 * The domain half: interpret the observation the party just made, through the SAME
 * canonical operations the seasonal applier used before CORRECTION-26 moved them to
 * `agents/resourceScoutObservation.ts`. No second knowledge writer exists — `knowledge`
 * was already written by `observeTileAndNearby` above and is passed in here read-only.
 */
function applyInvestigationLearning(
  world: WorldState,
  band: Band,
  record: PendingInvestigationRecord,
  updatedKnowledge: Band["knowledge"],
  newTilesObserved: boolean,
): Partial<Band> {
  if (record.actionType === "resource_scout") {
    if (record.scoutKind === undefined || record.targetResourceClass === undefined) {
      return {};
    }

    const scoutUpdate = applyResourceScoutObservation(
      world,
      band,
      {
        type: "resource_scout",
        originTileId: record.originTileId,
        targetTileId: record.targetTileId,
        scoutKind: record.scoutKind,
        targetResourceClass: record.targetResourceClass,
      },
      updatedKnowledge,
      newTilesObserved,
      record.selectionEvidence,
    );

    return {
      resourceKnowledgeState: scoutUpdate.resourceKnowledgeState,
      lastResourceScout: scoutUpdate.debug,
      recentScoutLearning: appendRecentScoutLearning(band.recentScoutLearning, scoutUpdate.debug.learning),
      ...applyInvestigationPlantLearning(band, scoutUpdate.debug.plantUseTest, scoutUpdate.debug.causeSpecificEvent, world),
    };
  }

  // 2K.10 / 2K.11 — a side-country probe that PHYSICALLY reached its inferred side tile may
  // form bounded resource memory there and run one cautious test. Other probe purposes
  // return information without forming patch memory, exactly as before.
  if (record.probePurpose !== "side_country_observation") {
    return {};
  }

  const sideState = formSideCountryResourceMemory(world, band, record.targetTileId, updatedKnowledge);

  if (sideState === undefined) {
    return {};
  }

  const sideTest = applySideEncounteredCautiousTest(world, band, record.targetTileId, sideState);

  return {
    resourceKnowledgeState: sideTest?.resourceKnowledgeState ?? sideState,
    ...applyInvestigationPlantLearning(band, sideTest?.plantUseTest, sideTest?.causeSpecificEvent, world),
  };
}

function applyInvestigationPlantLearning(
  band: Band,
  plantUseTest: PlantUseTestEvent | undefined,
  causeSpecificEvent: CauseSpecificEvent | undefined,
  world: WorldState,
): Partial<Band> {
  if (plantUseTest === undefined && causeSpecificEvent === undefined) {
    return {};
  }

  return {
    ...(plantUseTest === undefined
      ? {}
      : {
          lastPlantUseTest: plantUseTest,
          recentPlantUseTests: appendRecentPlantUseTest(band.recentPlantUseTests, plantUseTest),
        }),
    ...(causeSpecificEvent === undefined
      ? {}
      : {
          lastCauseSpecificEvent: causeSpecificEvent,
          recentCauseSpecificEvents: appendRecentCauseSpecificEvent(band.recentCauseSpecificEvents, causeSpecificEvent),
        }),
    // 2K.6 — learned competence accrues from the band's OWN test, which now required
    // somebody to physically go and test it.
    exploitationSkill: advanceExploitationSkill(
      band.exploitationSkill,
      band.id,
      world.time.tick,
      plantUseTest,
      causeSpecificEvent,
    ),
  };
}

function markVisibleLandscapeCueChecked(
  band: Band,
  record: PendingInvestigationRecord,
): Band["visibleLandscapeCues"] {
  return record.actionType === "logistical_probe"
    ? markVisibleLandscapeCueProbeChecked(band, record.targetTileId)
    : band.visibleLandscapeCues;
}

function resolvePhysicalFoodHarvest(
  world: WorldState,
  record: IntraSeasonTripRecord,
  time: ReturnType<typeof getWorldTimeForDay>,
  faunaGeo: FaunaStockGeography,
  // §10 verification: run the physical lookup but never the take (no depletion, no cargo).
  verifyOnly: boolean = false,
): { readonly world: WorldState; readonly record: IntraSeasonTripRecord } {
  const faunaClass = faunaClassForTrip(record.taskGroupType, record.resourceClassId);
  const plantTrip = faunaClass === undefined && isPlantGatherTrip(record.taskGroupType, record.resourceClassId);
  if (faunaClass === undefined && !plantTrip) {
    return { world, record };
  }

  const attempted = true;
  const standTileId = record.pathTiles[record.pathTiles.length - 1];
  const targetTile = world.tiles[record.targetTileId];
  const routeReached = standTileId === record.targetTileId ||
    (targetTile?.isAquatic === true && world.tiles[standTileId]?.neighbors.includes(record.targetTileId) === true);
  const activityEligible = !verifyOnly && routeReached && isPhysicalFoodReturnKind(record.resourceReturn.returnedResourceKind) &&
    record.resourceReturn.estimatedReturnValue > 0;
  const requestedAmount = record.resourceReturn.estimatedReturnValue;
  const transportLossRate = Math.min(0.25, record.roundTripTiles * 0.012);
  const knownness: PhysicalFoodHarvestRecord["knownness"] = record.resourceReturn.returnConfidence >= 0.42
    ? "known_target"
    : "stale_or_inferred_target";

  const resolution = faunaClass === undefined
    ? (() => {
        const tile = world.tiles[record.targetTileId];
        return tile === undefined
          ? {
              world,
              sourceFound: false,
              physicalAvailability: 0,
              harvestedAmount: 0,
              depletionApplied: 0,
              processingLossRate: 0,
              failureReason: "physical_source_absent" as const,
            }
          : resolvePlantFoodHarvest(world, tile, time, requestedAmount, activityEligible);
      })()
    : resolveFaunaFoodHarvest(
        world,
        faunaGeo,
        record.targetTileId,
        faunaClass,
        record.season,
        record.tick,
        requestedAmount,
        activityEligible,
      );
  const transportLoss = resolution.harvestedAmount * transportLossRate;
  const processingLoss = Math.max(0, resolution.harvestedAmount - transportLoss) * resolution.processingLossRate;
  const usableSupport = round4(Math.max(0, resolution.harvestedAmount - transportLoss - processingLoss));
  const sourceKind: PhysicalFoodHarvestRecord["sourceKind"] = faunaClass === "animal_food"
    ? "fauna_stock"
    : faunaClass === "aquatic_food"
      ? "aquatic_stock"
      : "plant_patch";
  const sourceId = resolution.sourceId;
  const sourceClass = String(resolution.sourceClass ?? record.resourceClassId ?? faunaClass ?? "generic_plant_food");
  const physicalFoodHarvest: PhysicalFoodHarvestRecord = {
    sourceKind,
    ...(sourceId === undefined ? {} : { sourceId: String(sourceId) }),
    sourceClass,
    knownness,
    attempted,
    physicalSourceFound: resolution.sourceFound,
    physicalAvailability: round4(resolution.physicalAvailability),
    harvestedAmount: round4(resolution.harvestedAmount),
    depletionApplied: round4(resolution.depletionApplied),
    transportLoss: round4(transportLoss),
    processingLoss: round4(processingLoss),
    usableSupport,
    ...(resolution.failureReason === undefined ? {} : { failureReason: resolution.failureReason }),
    worldTruthDebugOnly: true,
    reasonIds: [`reason:physical-food-harvest:${record.sourceBandId}:${record.day}:${sourceKind}:${sourceId ?? "absent"}` as ReasonId],
  };
  const physicalFailure = resolution.failureReason === "physical_source_absent" || resolution.failureReason === "physically_exhausted";
  const activityOutcome = !routeReached
    ? "failed_due_to_distance"
    : physicalFailure && isSuccessfulFaunaOutcome(record.activityOutcome)
      ? "target_not_found"
      : record.activityOutcome;
  const returnedResourceKind = usableSupport > 0 ? record.resourceReturn.returnedResourceKind : "none";
  const resourceReturn: ActivityResourceReturnRecord = {
    ...record.resourceReturn,
    returnedResourceKind,
    semantics: getActivityReturnSemantics(returnedResourceKind),
    estimatedReturnValue: usableSupport,
    consumedByEconomy: usableSupport > 0,
    noCarryingCapacityCoupling: false,
    noSupportChange: false,
    reasonIds: [...record.resourceReturn.reasonIds, ...physicalFoodHarvest.reasonIds],
  };

  return {
    world: resolution.world,
    record: {
      ...record,
      activityResult: activityOutcome,
      activityOutcome,
      activityOutcomeSummary: summarizeActivityOutcome(activityOutcome, returnedResourceKind),
      resultSummary: summarizeActivityOutcome(activityOutcome, returnedResourceKind),
      resourceReturn,
      physicalFoodHarvest,
      ...(record.plantPatchTrace === undefined
        ? {}
        : { plantPatchTrace: { ...record.plantPatchTrace, depletionApplied: resolution.depletionApplied > 0 } }),
      ...(record.animalActivityTrace === undefined
        ? {}
        : {
            animalActivityTrace: {
              ...record.animalActivityTrace,
              activityOutcome,
              actualReturnValue: usableSupport,
              depletionApplied: resolution.depletionApplied > 0,
              pressureApplied: resolution.depletionApplied > 0
                ? estimateFaunaTripPressureIntensity(record.estimatedPeopleCount, usableSupport)
                : 0,
            },
          }),
      ...(record.aquaticActivityTrace === undefined
        ? {}
        : { aquaticActivityTrace: { ...record.aquaticActivityTrace, activityOutcome, depletionApplied: resolution.depletionApplied > 0 } }),
      reasonIds: [...record.reasonIds, ...physicalFoodHarvest.reasonIds],
      noSupportChange: false,
    },
  };
}

// Maps a trip's task group / resource class to the finite fauna stock class it
// draws on, or undefined for non-fauna trips (plants / water / route / info).
function faunaClassForTrip(
  taskGroupType: IntraSeasonTripTaskGroupType,
  resourceClassId: ResourceClassId | undefined,
): FaunaClass | undefined {
  if (taskGroupType === "hunting_group" || resourceClassId === "animal_food") {
    return "animal_food";
  }

  if (taskGroupType === "fishing_group" || resourceClassId === "aquatic_food") {
    return "aquatic_food";
  }

  return undefined;
}

function isSuccessfulFaunaOutcome(outcome: IntraSeasonTripActivityResult): boolean {
  return outcome === "partial_success" || outcome === "target_found";
}

// A plant-gathering trip (not fauna, not water/route/info) that draws on finite
// plant patches and can overharvest them.
function isPlantGatherTrip(
  taskGroupType: IntraSeasonTripTaskGroupType,
  resourceClassId: ResourceClassId | undefined,
): boolean {
  if (taskGroupType === "hunting_group" || taskGroupType === "fishing_group" || taskGroupType === "water_group" || taskGroupType === "memory_refresh_group") {
    return false;
  }

  if (resourceClassId === "fiber_material" || resourceClassId === "fuel_material") {
    return false;
  }

  return (
    taskGroupType === "plant_gathering_group" ||
    taskGroupType === "local_foraging_group" ||
    taskGroupType === "plant_followup_group" ||
    resourceClassId === "generic_plant_food" ||
    resourceClassId === "fallback_food"
  );
}

function selectTripCandidate(
  world: WorldState,
  band: Band,
  day: number,
  maxDistanceTiles: number = MAX_TRIP_DISTANCE_TILES,
  // CORRECTION-4 — when the caller is the EXPEDITION selector it needs the best
  // MULTI-DAY candidate, not the global best. Previously the argmax ran over every
  // distance and near targets always won (their distance penalty is lowest); the
  // expedition selector then discarded that same-day winner and returned undefined.
  // A band holding any near food memory could therefore never produce a retrieval
  // candidate, which is why the ordinary founder launched 0 gathering expeditions
  // while still running verifications. Restricting the argmax domain — rather than
  // filtering after it — closes that eligibility gap without a second distance
  // authority: multi-day-ness is still decided by derivePhysicalRoundTripTiming.
  requireMultiDay: boolean = false,
  // REPEATED-BAND-EXPANSION-FISSION-14 §9 Stage 2 — the SYMMETRIC half of
  // CORRECTION-4's fix above. The same-day caller (`applyTripDay`) discards a winner
  // that does not fit the same-day budget, and because a band evaluates ONE candidate
  // per trip day, an out-of-budget argmax winner wasted the whole subsistence day.
  // Measured (docs/evidence/correction14/): after a residence walk moved the founder
  // 5-10 tiles from its nearest remembered patch, the argmax kept selecting that
  // now-multi-day patch, `applyTripDay` kept skipping it, and the band recorded
  // `trips: 0` for 17 consecutive seasons in the richest catchment on the map —
  // 141 of 480 seasons at exactly zero support. Restricting the argmax DOMAIN to what
  // the caller can actually execute (rather than filtering after it) is the same
  // repair CORRECTION-4 made for the expedition selector; multi-day-ness is still
  // decided only by `derivePhysicalRoundTripTiming`, and expeditions still receive the best
  // multi-day candidate from their own call.
  requireSameDay: boolean = false,
): TripCandidate | undefined {
  const origin = world.tiles[band.position];

  if (origin === undefined) {
    return undefined;
  }

  // REPEATED-BAND-EXPANSION-FISSION-14 §9 Stage 2 — MEASURED DEFECT. Local
  // reconnaissance used to bootstrap only when the band had NO patch memory AT ALL.
  // A band that walks its residence away from its old catchment keeps every one of
  // those memories, so the bootstrap stayed off while all of them sat further than
  // `maxDistanceTiles` from where the band is now standing. No candidate could be
  // built, so `applyTripDay` recorded NO trip, so no receipt existed, so the food
  // ledger read exactly zero — for as long as the relocation lasted.
  // Measured (docs/evidence/correction14/, richest map2 catchment, 500y): the founder
  // hit runs of 17 consecutive seasons with `trips: 0` and `rawSupportRatio: 0`
  // while standing in country whose reachable live plant stock was the highest on the
  // map, and 141 of 480 seasons read zero support. That is not scarcity — it is a
  // band unable to look at the ground under its feet because it remembers somewhere
  // else. Repair: the bootstrap fires whenever the band has no patch memory it can
  // actually REACH from here. It reads the band's OWN observed-tile records (the same
  // knowledge-bounded path as before, capped at
  // STARTING_LOCAL_RECON_OBSERVED_TILE_CAP tiles within
  // STARTING_LOCAL_RECON_MAX_DISTANCE_TILES) — no hidden truth, no yield change, and
  // a band that already has a reachable memory is byte-identical to before.
  const seededResourceKnowledgeState = hasReachablePatchMemory(world, band, origin, {
    maxDistanceTiles,
    requireMultiDay,
    requireSameDay,
  })
    ? undefined
    : buildStartingLocalReconnaissanceState(world, band, day);
  const resourceKnowledgeState = seededResourceKnowledgeState ?? band.resourceKnowledgeState;
  const memories = resourceKnowledgeState?.patchMemories ?? [];

  if (memories.length === 0) {
    return undefined;
  }

  const currentTick = Number(world.time.tick);
  const adaptationBehavior = band.foragingAdaptation?.behavior;
  let best: TripCandidate | undefined;

  for (const memory of memories) {
    if (memory.approximateTile === band.position) {
      continue;
    }

    const target = world.tiles[memory.approximateTile];

    if (target === undefined) {
      continue;
    }

    const distanceTiles = getGridDistance(origin, target);

    if (distanceTiles <= 0 || distanceTiles > maxDistanceTiles) {
      continue;
    }

    const candidateTiming = deriveCandidatePhysicalTiming(
      world,
      band,
      target.id,
      Math.min(maxDistanceTiles, distanceTiles + 8),
    );
    if (candidateTiming === undefined) {
      continue;
    }
    if (requireMultiDay && candidateTiming.sameDay) {
      continue;
    }
    if (requireSameDay && !candidateTiming.sameDay) {
      continue;
    }

    const cause = getTripCause(band, memory, currentTick);

    if (cause === undefined) {
      continue;
    }

    if (wasRecentlyVisited(band, memory.approximateTile, day, getRepeatTargetSuppressionDays(cause), isExploitationCause(cause))) {
      continue;
    }

    const effective = effectiveResourceConfidence(memory, currentTick);
    const causeWeight = getCauseWeight(cause);
    const distancePenalty = distanceTiles / MAX_TRIP_DISTANCE_TILES;
    const confidence = effective.effectivePresenceConfidence;
    const fallbackExpansionBias = getAdaptationFallbackSelectionBias(band, memory.resourceClassId);
    const tripAbandonmentPenalty = getAdaptationTripAbandonmentPenalty(band, memory.approximateTile, memory.resourceClassId);
    const nearbyProbeBonus = getAdaptationNearbyProbeBonus(band, memory.approximateTile);
    const logisticsSelectionBias = getLogisticsTripSelectionBias(band, memory.resourceClassId, distanceTiles);
    // 2K.12: bounded, selection-only seasonal-memory bias on the activity target argmax
    // (band-learned only, no hidden truth). Flag default OFF / no learned memory for this
    // tile → bias 0 → byte-identical activity-target selection.
    const seasonalBias =
      world.auditOptions?.seasonalEcologyMemoryReadersEnabled === true
        ? readSeasonalEcologyHint(band.seasonalEcologyMemory, memory.approximateTile, world.time.season, domainForResourceClass(memory.resourceClassId))?.bias ?? 0
        : 0;
    const score = round4(
      causeWeight +
        confidence * 0.2 -
        distancePenalty * 0.22 +
        seasonalBias +
        fallbackExpansionBias +
        nearbyProbeBonus -
        tripAbandonmentPenalty +
        logisticsSelectionBias,
    );
    const candidate = {
      memory,
      targetTileId: memory.approximateTile,
      distanceTiles,
      cause,
      score,
      riskToleranceModifier: adaptationBehavior?.riskToleranceModifier ?? 0,
      fallbackExpansionBias,
      tripAbandonmentPenalty,
      nearbyProbeBonus,
      logisticsSelectionBias,
      seededResourceKnowledgeState,
    };

    if (
      best === undefined ||
      candidate.score > best.score ||
      (candidate.score === best.score && String(candidate.targetTileId) < String(best.targetTileId))
    ) {
      best = candidate;
    }
  }

  return best;
}

function getAdaptationFallbackSelectionBias(
  band: Band,
  resourceClassId: ResourceClassId,
): number {
  const behavior = band.foragingAdaptation?.behavior;

  if (behavior === undefined || behavior.fallbackExpansionBias <= 0 || !isFoodClass(resourceClassId)) {
    return 0;
  }

  if (resourceClassId === "fallback_food") {
    return round4(behavior.fallbackExpansionBias * 0.55);
  }

  if (resourceClassId === "aquatic_food" || resourceClassId === "generic_plant_food") {
    return round4(behavior.fallbackExpansionBias * 0.32);
  }

  if (resourceClassId === "animal_food") {
    return round4(behavior.fallbackExpansionBias * 0.16);
  }

  return 0;
}

function getAdaptationTripAbandonmentPenalty(
  band: Band,
  tileId: TileId,
  resourceClassId: ResourceClassId,
): number {
  const behavior = band.foragingAdaptation?.behavior;

  if (behavior === undefined || behavior.tripAbandonmentBias <= 0) {
    return 0;
  }

  const memory = band.foragingAdaptation?.tripFailureMemories.find((entry) =>
    entry.tileId === tileId &&
    (entry.resourceClassId === undefined || entry.resourceClassId === resourceClassId),
  );

  if (memory === undefined) {
    return 0;
  }

  const actionWeight =
    memory.action === "abandon_temporarily" ? 1 :
      memory.action === "reduce_confidence" ? 0.72 :
        memory.action === "watch" ? 0.42 :
          memory.action === "recovering_after_success" ? 0.18 : 0;

  return round4(Math.min(0.18, behavior.tripAbandonmentBias * actionWeight + memory.confidencePenalty * 0.28));
}

function getAdaptationNearbyProbeBonus(
  band: Band,
  tileId: TileId,
): number {
  const behavior = band.foragingAdaptation?.behavior;

  if (behavior === undefined || behavior.nearbyProbeBias <= 0) {
    return 0;
  }

  const probe = band.foragingAdaptation?.nearbyOpportunityProbes.find((entry) => entry.tileId === tileId);

  if (probe === undefined || probe.comparison !== "nearby_probe") {
    return 0;
  }

  return round4(Math.min(0.14, behavior.nearbyProbeBias * 0.55 + probe.probeReadiness * 0.12));
}

function getLogisticsTripSelectionBias(
  band: Band,
  resourceClassId: ResourceClassId,
  distanceTiles: number,
): number {
  const logistics = band.bodyCampLogistics;

  if (logistics === undefined) {
    return 0;
  }

  const foodBias = isFoodClass(resourceClassId)
    ? logistics.behavior.opportunisticFoodBias * (distanceTiles <= 4 ? 0.46 : 0.18)
    : 0;
  const materialRepairBias =
    resourceClassId === "fiber_material" || resourceClassId === "fuel_material"
      ? logistics.behavior.materialWearPenalty * 0.42 +
        (logistics.fire.status === "limited_by_fuel" ? logistics.behavior.fireExposureReliefBias * 0.18 : 0)
      : 0;
  const sicknessDistancePenalty =
    distanceTiles >= 5
      ? logistics.behavior.sicknessActivityPenalty * 0.42 +
        logistics.behavior.careTravelBurdenBias * 0.34 +
        logistics.behavior.carryConstraintBias * 0.22
      : 0;

  return round4(Math.min(0.08, Math.max(-0.08, foodBias + materialRepairBias - sicknessDistancePenalty)));
}

// CORRECTION-14 — does the band hold any remembered patch it could actually USE from
// where it is standing? It applies exactly the geometric filters the candidate loop
// applies for this caller (different tile, positive distance, within
// `maxDistanceTiles`, and the caller's same-day / multi-day duration domain), so
// "reachable" has ONE definition: a memory that is reachable-in-principle but outside
// the caller's duration budget is correctly treated as no memory at all, and the local
// reconnaissance bootstrap fires instead of the band standing idle.
function hasReachablePatchMemory(
  world: WorldState,
  band: Band,
  origin: Tile,
  domain: {
    readonly maxDistanceTiles: number;
    readonly requireMultiDay: boolean;
    readonly requireSameDay: boolean;
  },
): boolean {
  for (const memory of band.resourceKnowledgeState?.patchMemories ?? []) {
    if (memory.approximateTile === band.position) {
      continue;
    }

    const target = world.tiles[memory.approximateTile];

    if (target === undefined) {
      continue;
    }

    const distanceTiles = getGridDistance(origin, target);

    if (distanceTiles <= 0 || distanceTiles > domain.maxDistanceTiles) {
      continue;
    }

    const candidateTiming = deriveCandidatePhysicalTiming(
      world,
      band,
      target.id,
      Math.min(domain.maxDistanceTiles, distanceTiles + 8),
    );
    if (candidateTiming === undefined) {
      continue;
    }
    if (domain.requireMultiDay && candidateTiming.sameDay) {
      continue;
    }
    if (domain.requireSameDay && !candidateTiming.sameDay) {
      continue;
    }

    return true;
  }

  return false;
}

function buildStartingLocalReconnaissanceState(
  world: WorldState,
  band: Band,
  day: number,
): ResourceKnowledgeState | undefined {
  const origin = world.tiles[band.position];

  if (origin === undefined) {
    return undefined;
  }

  const time = getWorldTimeForDay(day as DayNumber);
  const waterStress = band.pressureState?.waterStress ?? 0;
  const perCapitaReturn =
    band.carryingCapacity?.perCapitaReturn.perCapitaReturn ??
    band.perCapitaReturn?.perCapitaReturn ??
    0.5;
  let state = band.resourceKnowledgeState;
  const localObservedRecords = Object.values(band.knowledge.observedTiles)
    .map((record) => {
      const tile = world.tiles[record.tileId];

      return tile === undefined ? undefined : { record, tile, distanceTiles: getGridDistance(origin, tile) };
    })
    .filter((entry): entry is NonNullable<typeof entry> =>
      entry !== undefined &&
      entry.record.tileId !== band.position &&
      entry.distanceTiles > 0 &&
      entry.distanceTiles <= STARTING_LOCAL_RECON_MAX_DISTANCE_TILES,
    )
    .sort((left, right) => {
      const distanceDelta = left.distanceTiles - right.distanceTiles;

      return distanceDelta === 0
        ? String(left.record.tileId).localeCompare(String(right.record.tileId))
        : distanceDelta;
    })
    .slice(0, STARTING_LOCAL_RECON_OBSERVED_TILE_CAP);

  for (const { record } of localObservedRecords) {
    const habitatPotential = deriveBaseHabitatPotential(record.tileId, record, time);
    const resourceSummary = deriveResourceClassAvailability(habitatPotential, record, time);
    state = updateResourceKnowledgeFromObservation(state, resourceSummary, {
      tileId: record.tileId,
      tick: time.tick,
      season: time.season,
      waterStress,
      perCapitaReturn,
      anchorTileId: band.position,
      observationSource: "starting_local_reconnaissance",
    });
  }

  return state === band.resourceKnowledgeState ? undefined : state;
}

function getTripCause(
  band: Band,
  memory: ResourcePatchMemory,
  currentTick: number,
): IntraSeasonTripCause | undefined {
  const effective = effectiveResourceConfidence(memory, currentTick);
  const waterStress = band.pressureState?.waterStress ?? 0;
  const foodStress = band.pressureState?.foodStress ?? 0;
  const perCapitaReturn =
    band.carryingCapacity?.perCapitaReturn.perCapitaReturn ??
    band.perCapitaReturn?.perCapitaReturn ??
    0.5;
  const stressedForFood = foodStress >= 0.35 || perCapitaReturn < 0.55 || band.returnTrend?.chronicDecline === true;

  // ECOLOGY-VIABILITY-CORRECTION-8 §1 — MEASURED DEFECT. A water_check is an
  // INFORMATION action: it returns "returned_with_information", creates no water, and
  // never reaches the physical harvest resolver. But `waterStress` (pressure.ts:209) is
  // derived from the tile's `waterAccess` plus seasonal/acute terms and contains NO term
  // for water actually fetched — so the action CANNOT reduce the condition that triggers
  // it. Because a band selects ONE candidate per day, an unsatisfiable trigger evaluated
  // ahead of every food cause consumed the entire subsistence day, permanently.
  // Measured (docs/evidence/correction8/, 160 seasons, map2):
  //   rich     waterAccess 1.00  -> waterStress 0.01-0.05, never >= 0.32 ->    0 checks
  //   ordinary waterAccess 0.156 -> waterStress 0.35-0.52, NEVER < 0.32  -> 3434 checks
  //                                 = 89.4% of all trips; foodStress pinned at 1.0
  //   marginal waterAccess 0.00  -> waterStress 0.45-0.71                -> 3222 checks
  // The band re-checked 9 distinct tiles, the top one 1073 times, at mean confidence
  // 0.76 — it already knew those sources; the re-checks produced no new information.
  // That is why ordinary trip success was 2.9% while rich was 39.2%: it was never a
  // harvest-yield defect, it was food trips not being SELECTED.
  // Repair: an information action fires only when it can actually produce information —
  // when the band's own knowledge of that water source is deficient (dormant or below the
  // observation-confidence line). Band knowledge only; no hidden state is read, no
  // ecology/yield/fertility coefficient is touched, and a genuinely unknown or stale
  // water source still preempts food exactly as before.
  const waterKnowledgeDeficient =
    effective.isDormant || effective.effectivePresenceConfidence < OBSERVATION_CONFIDENCE_THRESHOLD;

  if (memory.resourceClassId === "water_resource" && waterStress >= 0.32 && waterKnowledgeDeficient) {
    return "water_check";
  }

  if (memory.plantObservation !== undefined && !hasRecentlyTestedClass(band, memory.resourceClassId)) {
    return "plant_followup_test";
  }

  if (stressedForFood && isFoodClass(memory.resourceClassId)) {
    return "food_resource_check";
  }

  if (effective.isStale && effective.effectivePresenceConfidence >= 0.25) {
    return "memory_refresh";
  }

  if (
    isFoodClass(memory.resourceClassId) &&
    effective.effectivePresenceConfidence >= 0.45 &&
    (band.intraSeasonActivity?.activityBudget.nearAnchorForaging ?? 0.45) >= 0.35
  ) {
    return "local_resource_use";
  }

  return undefined;
}

function hasRecentlyTestedClass(band: Band, classId: ResourceClassId): boolean {
  return (band.recentPlantUseTests ?? []).some((entry) => entry.resourceClassId === classId);
}

function wasRecentlyVisited(
  band: Band,
  targetTileId: TileId,
  day: number,
  suppressionDays: number,
  // CORRECTION-4 §4 — exploitation causes ignore inspection-only visits. A verification
  // party physically stood at the patch and refreshed what the band knows, but it took
  // nothing, so it is not evidence that another visit is pointless. Previously the
  // expedition deposited its return record re-dated to the RETURN day, re-suppressing its
  // own target for another 12 days against a 6-day launch cadence — the verification
  // permanently vetoed the gathering it had just justified. Verification still suppresses
  // redundant VERIFICATION (that cause keeps counting these records).
  ignoreInspectionOnly: boolean = false,
): boolean {
  return (band.recentIntraSeasonTrips ?? []).some(
    (trip) =>
      trip.targetTileId === targetTileId &&
      day - Number(trip.day) <= suppressionDays &&
      !(ignoreInspectionOnly && trip.inspectionOnly === true),
  );
}

// Causes that represent actually working a target, as opposed to inspecting it.
function isExploitationCause(cause: IntraSeasonTripCause): boolean {
  return cause === "food_resource_check" || cause === "local_resource_use" || cause === "water_check";
}

function buildTripRecord(
  world: WorldState,
  band: Band,
  candidate: TripCandidate,
  day: DayNumber,
  tick: TickNumber,
  season: IntraSeasonTripRecord["season"],
  faunaGeo: FaunaStockGeography,
  // EXPEDITIONARY-4 §5 / CORRECTION-34E — set ONLY by the expedition work day. It marks two
  // facts a same-day trip cannot have: the party has already walked the route and is standing at
  // the target (so the same-day travel-uncertainty gates must not zero its work request), and the
  // productive labour doing the work is the PARTY's, not whatever is left at the residence.
  //
  // Same-day trips never pass this and keep deriving their own residential task-group size through
  // `estimateTaskGroupPeople`, unchanged.
  partyWork?: {
    readonly physicallyAtTarget: boolean;
    /**
     * Authoritative, and never derived here. CORRECTION-34F — guaranteed a POSITIVE INTEGER by
     * `resolveExpeditionTargetWork`, the only caller that sets this object; zero and fractional
     * counts are rejected at that boundary rather than rounded into something plausible here.
     */
    readonly productiveWorkers: number;
  },
): IntraSeasonTripRecord {
  const pathTiles = buildOutboundPathTiles(world, band.position, candidate.targetTileId);
  const timing = derivePhysicalRoundTripTiming(world, band, pathTiles, INTRA_SEASON_ACTIVITY_WORK_DAYS);
  const estimatedDurationDays = timing.durationDays;
  const roundTripTiles = Math.max(0, pathTiles.length - 1) * 2; // TOPOLOGICAL telemetry only.
  const outcome = classifyOutcome(estimatedDurationDays);
  const movementType = deriveMovementType(candidate.cause, outcome, candidate.distanceTiles);
  const taskGroupType = deriveTaskGroupType(candidate.cause, candidate.memory.resourceClassId);
  const faunaClass = faunaClassForTrip(taskGroupType, candidate.memory.resourceClassId);
  const faunaReturnFactor = faunaClass === undefined
    ? 1
    : deriveFaunaTripReturnFactor(world, faunaGeo, candidate.targetTileId, faunaClass, season);
  const animalTraceBase = faunaClass === "animal_food"
    ? deriveFaunaTripStockTrace(world, faunaGeo, candidate.targetTileId, faunaClass, season, tick)
    : undefined;
  const aquaticTraceBase = faunaClass === "aquatic_food"
    ? deriveFaunaTripStockTrace(world, faunaGeo, candidate.targetTileId, faunaClass, season, tick)
    : undefined;
  const targetTile = world.tiles[candidate.targetTileId];
  const isPlantTraceTrip = faunaClass === undefined && isPlantGatherTrip(taskGroupType, candidate.memory.resourceClassId);
  const plantTraceBase = isPlantTraceTrip && targetTile !== undefined
    ? derivePlantGatherPatchTrace(world, targetTile, world.time)
    : undefined;
  const plantReturnFactor = plantTraceBase !== undefined
    ? plantTraceBase.expectedReturnFactor
    : isPlantTraceTrip && targetTile !== undefined
      ? derivePlantGatherReturnFactor(world, targetTile, world.time)
      : 1;
  // CORRECTION-34E — ONE variable feeds outcome classification, the resource-return value, the
  // fauna trace, the shadow record and the record field itself, so choosing it correctly here
  // propagates to every labour-dependent consumer by construction rather than by enumeration.
  //
  // The party path takes the party's own productive labour and applies NO floor of one: the
  // residential estimator's `Math.max(1, ...)` exists so a band always fields someone at home, and
  // importing it would let a party with no working members still request a person's work.
  //
  // CORRECTION-34F — and no rounding either. The value arrives validated as a positive integer, so
  // clamping it here could only ever disguise a caller that broke the contract.
  const estimatedPeopleCount = partyWork === undefined
    ? estimateTaskGroupPeople(band, taskGroupType)
    : partyWork.productiveWorkers;
  const objective = deriveObjective(candidate.cause);
  const endDay = (Number(day) + estimatedDurationDays - 1) as DayNumber;
  const reasonId =
    `reason:intra-season-trip:${band.id}:${Number(day)}:${candidate.cause}:${candidate.targetTileId}` as ReasonId;
  const outcomeDetail = deriveActivityOutcomeDetail(
    candidate,
    taskGroupType,
    estimatedPeopleCount,
    estimatedDurationDays,
    tick,
    season,
    band.id,
    day,
    faunaReturnFactor,
    plantReturnFactor,
    partyWork?.physicallyAtTarget === true,
  );
  // ECO-SEASON-1: realized seasonal ecology the group observes at its target this season.
  // Recorded on the trip (debug) and used to scale the SHADOW estimate only — never the
  // canonical activityOutcome above (which feeds memory->2K.9->carrying capacity).
  const seasonalEcology = deriveSeasonalEcologyFactor(
    world,
    candidate.targetTileId,
    taskGroupTypeToEcologyDomain(taskGroupType),
  );
  const plantPatchTrace = plantTraceBase === undefined
    ? undefined
    : finalizePlantPatchTrace(plantTraceBase, outcomeDetail.activityOutcome);
  const animalActivityTrace = animalTraceBase === undefined
    ? undefined
    : finalizeAnimalActivityTrace(
        animalTraceBase,
        outcomeDetail.activityOutcome,
        outcomeDetail.resourceReturn.estimatedReturnValue,
        candidate,
        estimatedPeopleCount,
        band,
        Number(tick),
      );
  const aquaticActivityTrace = aquaticTraceBase === undefined
    ? undefined
    : finalizeAquaticActivityTrace(aquaticTraceBase, outcomeDetail.activityOutcome);
  const effectiveResourceReturn = animalActivityTrace === undefined
    ? outcomeDetail.resourceReturn
    : {
        ...outcomeDetail.resourceReturn,
        estimatedReturnValue: animalActivityTrace.actualReturnValue,
      };

  return {
    day,
    tick,
    season,
    sourceBandId: band.id,
    originTileId: band.position,
    targetTileId: candidate.targetTileId,
    taskGroupType,
    groupLabel: deriveTaskGroupLabel(taskGroupType),
    estimatedPeopleCount,
    objective,
    objectiveLabel: deriveObjectiveLabel(objective),
    startDay: day,
    endDay,
    activityStatus: "completed_observation",
    distanceTiles: candidate.distanceTiles,
    estimatedDurationDays,
    cause: candidate.cause,
    movementType,
    outcome,
    activityResult: outcomeDetail.activityOutcome,
    activityOutcome: outcomeDetail.activityOutcome,
    activityOutcomeReasonIds: outcomeDetail.activityOutcomeReasonIds,
    activityOutcomeSummary: outcomeDetail.activityOutcomeSummary,
    resourceReturn: effectiveResourceReturn,
    shadowSubsistence: deriveShadowSubsistenceRecord(
      candidate,
      taskGroupType,
      estimatedPeopleCount,
      estimatedDurationDays,
      roundTripTiles,
      outcome,
      outcomeDetail.activityOutcome,
      effectiveResourceReturn,
      season,
      tick,
      band.id,
      day,
      shadowSeasonalModifier(seasonalEcology),
    ),
    seasonalEcology,
    ...(plantPatchTrace === undefined ? {} : { plantPatchTrace }),
    ...(animalActivityTrace === undefined ? {} : { animalActivityTrace }),
    ...(aquaticActivityTrace === undefined ? {} : { aquaticActivityTrace }),
    activityMemoryEffect: createNoActivityMemoryEffect(band.id, day, tick, season, candidate.targetTileId, outcomeDetail.activityOutcome),
    pathTiles,
    tilesCrossed: Math.max(0, pathTiles.length - 1),
    roundTripTiles,
    activityDaysRepresented: TRIP_DAY_CADENCE,
    resourceClassId: candidate.memory.resourceClassId,
    resultSummary: outcomeDetail.activityOutcomeSummary,
    reasonIds: [reasonId, ...outcomeDetail.activityOutcomeReasonIds, ...outcomeDetail.resourceReturn.reasonIds],
    noResidentialRelocation: true,
    noYieldChange: true,
    noStressChange: true,
    noPopulationChange: true,
    noCarryingCapacityChange: true,
    noSupportChange: true,
    bandKnownTargetOnly: true,
  };
}

function estimateFaunaTripPressureIntensity(estimatedPeopleCount: number, estimatedReturnValue: number): number {
  return Math.max(0, Math.min(1, estimatedPeopleCount * 0.08 + estimatedReturnValue * 0.6));
}

function animalArchetypeHint(kind: FaunaStockKind, habitat: FaunaHabitatType): string {
  switch (kind) {
    case "large_game":
      return habitat === "open_plain" || habitat === "river_meadow" ? "wild cattle / horse-like open herd" : "large herd prey";
    case "medium_game":
      return habitat === "open_plain" ? "wild horse-like open herd" : "deer / sheep / goat-like herd prey";
    case "small_game":
      return "hares / rabbits / small game";
    case "waterfowl":
      return "waterfowl / wetland birds";
    case "upland_game":
      return "upland deer / sheep / goat-like herd prey";
    case "forest_edge_game":
      return habitat === "wet_woodland" || habitat === "dense_cover" ? "boar-like or forest-edge game" : "forest-edge game";
    case "small_predator":
      return "small predator";
    case "large_predator":
      return "large predator";
    case "lake_fish":
    case "river_reach_fish":
    case "delta_wetland_fish":
    case "seasonal_fish_run":
    case "shellfish_reedbed":
      return "aquatic stock";
  }
}

function finalizeAnimalActivityTrace(
  base: FaunaTripStockTraceBase,
  outcome: IntraSeasonTripActivityResult,
  actualReturnValue: number,
  candidate: TripCandidate,
  estimatedPeopleCount: number,
  band: Band,
  currentTick: number,
): AnimalActivityTrace {
  const depletionApplied = isSuccessfulFaunaOutcome(outcome);
  const pressureApplied = depletionApplied
    ? estimateFaunaTripPressureIntensity(estimatedPeopleCount, actualReturnValue)
    : 0;
  const outcomeClass: AnimalActivityTrace["outcomeClass"] =
    outcome === "partial_success" || outcome === "target_found"
      ? outcome === "partial_success" ? "partial" : "success"
      : isFailureOutcome(outcome)
        ? "failure"
        : "information";
  const rawDangerRisk = round4(clamp01(base.risk + base.disturbance * 0.18 + base.pressure * 0.2 + (outcomeClass === "failure" ? 0.08 : 0)));
  // INVENTION-3: a practiced hunting-method response (striking from reach,
  // snare lines) relieves a bounded share of the danger this trip pays —
  // never more than 60% of it; defended/pressed game still turns hunts back.
  const hunting = deriveHuntingSafetyRelief(band, currentTick, { faunaKind: base.kind, habitat: base.habitat });
  const huntingReliefApplied = hunting.active && hunting.contextMatched && !hunting.materialFailed
    ? round4(Math.min(hunting.relief, rawDangerRisk * 0.6))
    : 0;
  const dangerRisk = round4(clamp01(rawDangerRisk - huntingReliefApplied));
  if (hunting.active && hunting.returnShift > 0) {
    actualReturnValue = round4(clamp01(actualReturnValue * (1 + hunting.returnShift)));
  }
  const knowledgeUpdate: AnimalActivityTrace["knowledgeUpdate"] =
    dangerRisk >= 0.52 && outcomeClass === "failure"
      ? "danger_caution_added"
      : outcomeClass === "partial" || outcomeClass === "success"
        ? base.pressure >= 0.3 ? "reliable_route_strengthened" : "direct_sighting"
        : outcomeClass === "failure"
          ? "failure_staled_route"
          : "tracks_observed";
  const protoCampInfluence: AnimalActivityTrace["protoCampInfluence"] =
    dangerRisk >= 0.55
      ? "danger_avoidance_signal"
      : base.pressure >= 0.48 || base.currentAbundance < 0.48
        ? "overhunted_scarcity_signal"
        : depletionApplied && (base.habitat === "forest_edge" || base.habitat === "wet_woodland" || base.habitat === "scrub_edge")
          ? "forest_edge_game_signal"
          : depletionApplied || base.expectedReturnFactor >= 0.72
            ? "animal_route_signal"
            : "none";

  return {
    stockId: base.stockId,
    faunaKind: base.kind,
    habitat: base.habitat,
    anchorTileId: base.anchorTileId,
    targetArchetypeHint: animalArchetypeHint(base.kind, base.habitat),
    targetChosenReason: `${candidate.cause}; resource memory ${candidate.memory.resourceClassId}; confidence ${round4(candidate.score)}`,
    habitatBasis: base.habitatBasis,
    habitatSuitability: base.habitatSuitability,
    expectedReturnFactor: base.expectedReturnFactor,
    actualReturnValue: round4(actualReturnValue),
    currentAbundance: base.currentAbundance,
    disturbance: base.disturbance,
    seasonalAvailability: base.seasonalAvailability,
    confidence: round4(clamp01(base.detectability * 0.34 + base.habitatSuitability * 0.28 + base.expectedReturnFactor * 0.26 - base.pressure * 0.12)),
    pressure: base.pressure,
    pressureApplied: round4(pressureApplied),
    recoveryRate: base.recoveryRate,
    warinessBefore: round4(clamp01(base.disturbance * 0.56 + base.pressure * 0.32)),
    warinessChange: round4(clamp01(pressureApplied * base.mobility * 0.18)),
    dangerRisk,
    dangerClass: dangerRisk >= 0.58 ? "high" : dangerRisk >= 0.32 ? "moderate" : "low",
    ...(hunting.attempted
      ? {
          dangerRiskBeforeLearning: rawDangerRisk,
          huntingReliefApplied,
          huntingResponseId: hunting.responseId,
          huntingVariantKey: hunting.variantKey,
          huntingContextMatched: hunting.contextMatched && !hunting.materialFailed,
          huntingPreparationLabor: hunting.laborShift,
          huntingReturnShiftApplied: round4(Math.max(0, actualReturnValue - actualReturnValue / Math.max(1, 1 + hunting.returnShift))),
        }
      : {}),
    distanceTiles: candidate.distanceTiles,
    travelCost: round4(clamp01(candidate.distanceTiles / MAX_TRIP_DISTANCE_TILES)),
    laborAccessCost: hunting.active && hunting.laborShift > 0
      ? round4(clamp01(base.laborAccessCost + hunting.laborShift))
      : base.laborAccessCost,
    activityOutcome: outcome,
    outcomeClass,
    depletionApplied,
    knowledgeUpdate,
    memoryUpdate: knowledgeUpdate === "failure_staled_route" || knowledgeUpdate === "reliable_route_strengthened" || depletionApplied
      ? "resource_memory_update"
      : knowledgeUpdate === "danger_caution_added"
        ? "caution_memory_update"
        : "no_memory_update",
    protoCampInfluence,
    rawSource: base.rawSource,
    reasonIds: base.reasonIds,
    targetKnownMemoryOnly: true,
  };
}

function finalizeAquaticActivityTrace(
  base: FaunaTripStockTraceBase,
  outcome: IntraSeasonTripActivityResult,
): AquaticActivityTrace {
  const depletionApplied = isSuccessfulFaunaOutcome(outcome);
  const knowledgeUpdate: AquaticActivityTrace["knowledgeUpdate"] = depletionApplied
    ? "confirmed_by_fishing"
    : isFailureOutcome(outcome)
      ? "failure_lowered_confidence"
      : "observed_only";
  const protoCampInfluence: AquaticActivityTrace["protoCampInfluence"] =
    depletionApplied && (base.seasonalAvailability >= 1 || base.expectedReturnFactor >= 0.72)
      ? "aquatic_activity_base_signal"
      : base.habitat === "lake" || base.habitat === "delta_wetland"
        ? "lean_season_buffer_signal"
        : "none";

  return {
    stockId: base.stockId,
    aquaticKind: base.kind,
    waterContext: base.habitat,
    anchorTileId: base.anchorTileId,
    resourceClassId: "aquatic_food",
    expectedReturnFactor: base.expectedReturnFactor,
    currentAbundance: base.currentAbundance,
    disturbance: base.disturbance,
    seasonalAvailability: base.seasonalAvailability,
    pressure: base.pressure,
    recoveryRate: base.recoveryRate,
    risk: base.risk,
    laborAccessCost: base.laborAccessCost,
    activityOutcome: outcome,
    depletionApplied,
    knowledgeUpdate,
    memoryUpdate: depletionApplied || knowledgeUpdate === "failure_lowered_confidence"
      ? "resource_memory_update"
      : "no_memory_update",
    protoCampInfluence,
    rawSource: base.rawSource,
    reasonIds: base.reasonIds,
  };
}

function finalizePlantPatchTrace(
  base: PlantGatherPatchTraceBase,
  outcome: IntraSeasonTripActivityResult,
): PlantPatchActivityTrace {
  const depletionApplied = isSuccessfulFaunaOutcome(outcome);
  const knowledgeUpdate: PlantPatchActivityTrace["knowledgeUpdate"] = depletionApplied
    ? "confirmed_by_gathering"
    : isFailureOutcome(outcome)
      ? "failure_lowered_confidence"
      : "observed_only";
  const protoCampInfluence: PlantPatchActivityTrace["protoCampInfluence"] =
    base.fallbackRole === "important" || base.fallbackRole === "emergency"
      ? "fallback_refuge_signal"
      : depletionApplied && base.expectedReturnFactor >= 0.72
        ? "activity_base_signal"
        : "none";

  return {
    ...base,
    depletionApplied,
    knowledgeUpdate,
    memoryUpdate: depletionApplied || knowledgeUpdate === "failure_lowered_confidence"
      ? "resource_memory_update"
      : "no_memory_update",
    protoCampInfluence,
  };
}

function deriveActivityOutcomeDetail(
  candidate: TripCandidate,
  taskGroupType: IntraSeasonTripTaskGroupType,
  estimatedPeopleCount: number,
  estimatedDurationDays: number,
  tick: TickNumber,
  season: IntraSeasonTripRecord["season"],
  bandId: BandId,
  day: DayNumber,
  faunaReturnFactor: number,
  plantReturnFactor: number,
  physicallyAtTarget: boolean = false,
): ActivityOutcomeDetail {
  const effective = effectiveResourceConfidence(candidate.memory, Number(tick));
  const seasonMismatch = isKnownSeasonMismatch(candidate.memory, season, effective.effectiveSeasonConfidence);
  const waterRiskKnown =
    candidate.memory.resourceClassId === "water_resource" &&
    candidate.memory.risk.badWater &&
    effective.effectiveSafetyConfidence >= 0.35;
  const riskToleranceModifier = candidate.riskToleranceModifier;
  const desperationFoodOverride =
    riskToleranceModifier >= 0.06 &&
    isFoodClass(candidate.memory.resourceClassId) &&
    effective.effectiveAccessConfidence >= 0.22 &&
    effective.effectivePresenceConfidence >= 0.18;
  // EXPEDITIONARY-4 §5 — "will we even get there?" is not a question for a party that
  // is already standing at the target; physical access was resolved by the walked route.
  const distanceRiskKnown =
    !physicallyAtTarget &&
    estimatedDurationDays > 1 &&
    candidate.distanceTiles >= 8 &&
    effective.effectiveAccessConfidence < 0.35 &&
    !desperationFoodOverride;
  const lowMemoryConfidenceThreshold = isFoodClass(candidate.memory.resourceClassId)
    ? Math.max(0.14, LOW_MEMORY_CONFIDENCE_THRESHOLD - riskToleranceModifier * 0.55)
    : LOW_MEMORY_CONFIDENCE_THRESHOLD;
  const lowMemoryConfidence =
    effective.isDormant ||
    Math.min(effective.effectivePresenceConfidence, effective.effectiveYieldConfidence) < lowMemoryConfidenceThreshold;
  const outcome = classifyActivityOutcome(
    candidate,
    taskGroupType,
    estimatedPeopleCount,
    estimatedDurationDays,
    seasonMismatch,
    waterRiskKnown,
    distanceRiskKnown,
    lowMemoryConfidence,
    effective.effectivePresenceConfidence,
    effective.effectiveYieldConfidence,
    physicallyAtTarget,
  );
  const outcomeReasonIds = [
    makeActivityReasonId(bandId, day, "outcome", outcome, candidate.targetTileId),
    ...(seasonMismatch ? [makeActivityReasonId(bandId, day, "season", "mismatch", candidate.targetTileId)] : []),
    ...(waterRiskKnown ? [makeActivityReasonId(bandId, day, "risk", "bad-water", candidate.targetTileId)] : []),
    ...(distanceRiskKnown ? [makeActivityReasonId(bandId, day, "distance", "access-low", candidate.targetTileId)] : []),
    ...(lowMemoryConfidence ? [makeActivityReasonId(bandId, day, "memory", "low-confidence", candidate.targetTileId)] : []),
    ...(desperationFoodOverride ? [makeActivityReasonId(bandId, day, "adaptation", "desperation-risk-tolerance", candidate.targetTileId)] : []),
  ];
  const resourceReturn = deriveResourceReturnRecord(
    candidate,
    taskGroupType,
    estimatedPeopleCount,
    outcome,
    effective.effectivePresenceConfidence,
    effective.effectiveYieldConfidence,
    bandId,
    day,
    faunaReturnFactor,
    plantReturnFactor,
  );

  return {
    activityOutcome: outcome,
    activityOutcomeReasonIds: outcomeReasonIds,
    activityOutcomeSummary: summarizeActivityOutcome(outcome, resourceReturn.returnedResourceKind),
    resourceReturn,
  };
}

function classifyActivityOutcome(
  candidate: TripCandidate,
  taskGroupType: IntraSeasonTripTaskGroupType,
  estimatedPeopleCount: number,
  estimatedDurationDays: number,
  seasonMismatch: boolean,
  waterRiskKnown: boolean,
  distanceRiskKnown: boolean,
  lowMemoryConfidence: boolean,
  presenceConfidence: number,
  yieldConfidence: number,
  physicallyAtTarget: boolean = false,
): IntraSeasonTripActivityResult {
  if (waterRiskKnown) {
    return candidate.cause === "water_check" ? "failed_due_to_water_risk" : "abandoned_due_to_risk";
  }

  if (distanceRiskKnown) {
    return "failed_due_to_distance";
  }

  if (seasonMismatch && candidate.cause !== "memory_refresh") {
    return "failed_due_to_season_mismatch";
  }

  // EXPEDITIONARY-4 §5 — a party standing at the target does not hesitate over how much
  // it trusts its memory of the place, and cannot be "delayed getting there": it is
  // there. It attempts the work; the PHYSICAL resolver (patch existence, stock,
  // depletion) decides what the attempt yields. Belief-confidence keeps shaping the
  // requested amount downstream, so bounded knowledge still matters — it just no longer
  // pretends a present party is absent.
  if (physicallyAtTarget && isFoodClass(candidate.memory.resourceClassId)) {
    return estimatedPeopleCount >= 2 ? "partial_success" : "target_found";
  }

  if (lowMemoryConfidence) {
    return candidate.memory.state === "suspected" || candidate.memory.source === "inferred"
      ? "target_not_found"
      : "failed_due_to_low_memory_confidence";
  }

  if (estimatedDurationDays > 1 && presenceConfidence < OBSERVATION_CONFIDENCE_THRESHOLD) {
    return "delayed_return";
  }

  if (candidate.cause === "memory_refresh" || taskGroupType === "memory_refresh_group") {
    return "returned_with_information";
  }

  if (candidate.cause === "water_check" || taskGroupType === "water_group") {
    return "returned_with_information";
  }

  if (candidate.cause === "plant_followup_test" || taskGroupType === "plant_followup_group") {
    return yieldConfidence >= PARTIAL_RETURN_CONFIDENCE_THRESHOLD ? "partial_success" : "returned_with_information";
  }

  if (isFoodClass(candidate.memory.resourceClassId)) {
    if (presenceConfidence >= PARTIAL_RETURN_CONFIDENCE_THRESHOLD && yieldConfidence >= OBSERVATION_CONFIDENCE_THRESHOLD) {
      return estimatedPeopleCount >= 2 ? "partial_success" : "target_found";
    }

    if (presenceConfidence >= OBSERVATION_CONFIDENCE_THRESHOLD) {
      return "target_found";
    }
  }

  if (presenceConfidence >= OBSERVATION_CONFIDENCE_THRESHOLD) {
    return "successful_observation";
  }

  return "no_effect_observed";
}

function deriveResourceReturnRecord(
  candidate: TripCandidate,
  taskGroupType: IntraSeasonTripTaskGroupType,
  estimatedPeopleCount: number,
  outcome: IntraSeasonTripActivityResult,
  presenceConfidence: number,
  yieldConfidence: number,
  bandId: BandId,
  day: DayNumber,
  faunaReturnFactor: number,
  plantReturnFactor: number,
): ActivityResourceReturnRecord {
  const returnedResourceKind = deriveReturnedResourceKind(candidate, taskGroupType, outcome);
  const returnConfidence = round4(Math.max(0, Math.min(1, presenceConfidence * 0.62 + yieldConfidence * 0.38)));
  // FAUNA/AQUATIC-1 + ECO-BIOME-1 — hunted/fish returns scale by the finite fauna
  // stock; gathered returns scale by the finite plant patch (abundance/season/
  // depletion). Shadow value only — it drives memory yield-trend / talk / movement,
  // never support directly. Water/info kinds are unaffected.
  const baseReturnValue = estimatedPeopleCount * 0.035 + yieldConfidence * 0.22 + presenceConfidence * 0.08;
  const isFaunaReturn = returnedResourceKind === "hunted_fauna_food" || returnedResourceKind === "harvested_aquatic_food";
  const isPlantReturn = returnedResourceKind === "gathered_plant_food";
  const scaledReturnValue = isFaunaReturn
    ? baseReturnValue * faunaReturnFactor
    : isPlantReturn
      ? baseReturnValue * plantReturnFactor
      : baseReturnValue;
  const outcomeRealization = outcome === "target_found" ? 0.55 : 1;
  const estimatedReturnValue = isPhysicalFoodReturnKind(returnedResourceKind) || isPhysicalMaterialReturnKind(returnedResourceKind)
    ? round4(Math.min(0.5, scaledReturnValue * outcomeRealization))
    : 0;

  return {
    returnedResourceKind,
    semantics: getActivityReturnSemantics(returnedResourceKind),
    estimatedReturnValue,
    returnConfidence,
    consumedByEconomy: false,
    noYieldCoupling: true,
    noCarryingCapacityCoupling: true,
    noPopulationChange: true,
    noStressChange: true,
    noSupportChange: true,
    reasonIds: [makeActivityReasonId(bandId, day, "return", returnedResourceKind, candidate.targetTileId)],
  };
}

function deriveReturnedResourceKind(
  candidate: TripCandidate,
  taskGroupType: IntraSeasonTripTaskGroupType,
  outcome: IntraSeasonTripActivityResult,
): ActivityReturnResourceKind {
  return classifyActivityReturnKind({
    resourceClassId: candidate.memory.resourceClassId,
    taskGroupType,
    outcome,
  });
}

function summarizeActivityOutcome(
  outcome: IntraSeasonTripActivityResult,
  returnedResourceKind: ActivityReturnResourceKind,
): string {
  const semantics = getActivityReturnSemantics(returnedResourceKind);
  const result = semantics.contributesToNutrition
    ? "physical_receipt_feeds_support"
    : semantics.category === "physical_material"
      ? "physical_material_no_nutrition"
      : "information_or_zero_return";
  return `deterministic_${outcome}; return=${returnedResourceKind}; ${result}`;
}

// ===========================================================================
// ACTIVITY-GROUPS-10 — SHADOW subsistence estimate.
//
// Academic grounding (central-place foraging; Hadza/Hill–Hurtado/Kelly/Binford):
//   - Gathering is the reliable caloric staple: moderate per-person return, low
//     variance. Local foraging near camp is similar but smaller.
//   - Fishing is moderately reliable where water/aquatic patches are known.
//   - Hunting is high-yield-per-success but HIGH VARIANCE: most outings fail, so a
//     success brings real (shared) food yet its EXPECTED, dependable contribution is
//     low. It must never be modelled as guaranteed food.
//   - Water groups produce survival-critical SUPPORT, not calories (own domain).
//   - Plant follow-up is uncertain: unproven safety/processing => discounted, never
//     instantly edible/safe.
//   - Central-place foraging: the band is fed by NET return after round-trip travel
//     cost and known risk; farther/over-night forays cost more. Food sharing means a
//     group's return supports the whole band, but only AFTER it returns (same-day
//     groups support the base today; overnight/continuing groups contribute later).
//
// All inputs are band-KNOWN (patch memory effective confidence, remembered risk,
// remembered seasonality, distance, estimated group size, task type, deterministic
// outcome). No hidden truth, no randomness. The result is shadow-only.
// ===========================================================================

const SHADOW_FOOD_BASE_RATE: Partial<Record<IntraSeasonTripTaskGroupType, number>> = {
  hunting_group: 0.18,
  fishing_group: 0.12,
  plant_gathering_group: 0.13,
  local_foraging_group: 0.1,
  plant_followup_group: 0.07,
};
const SHADOW_WATER_SUPPORT_RATE = 0.07;
const SHADOW_TASK_RELIABILITY: Record<IntraSeasonTripTaskGroupType, number> = {
  hunting_group: 0.32,
  fishing_group: 0.66,
  plant_gathering_group: 0.82,
  local_foraging_group: 0.8,
  plant_followup_group: 0.42,
  water_group: 0.85,
  memory_refresh_group: 0.9,
};
const SHADOW_TRAVEL_RATE_PER_TILE = 0.01;
const SHADOW_OVERNIGHT_TRAVEL_COST = 0.02;
const SHADOW_MAX_TRAVEL_COST = 0.25;
const SHADOW_MAX_RISK_PENALTY = 0.2;

function deriveShadowReturnKind(
  returnedResourceKind: ActivityReturnResourceKind,
  taskGroupType: IntraSeasonTripTaskGroupType,
): ActivityShadowReturnKind {
  switch (returnedResourceKind) {
    case "hunted_fauna_food":
      return "hunted_food_shadow";
    case "harvested_aquatic_food":
      return "fish_shadow";
    case "gathered_plant_food":
      return taskGroupType === "plant_followup_group" ? "plant_food_shadow_uncertain" : "gathered_food_shadow";
    case "water_information":
      return "water_support_shadow";
    case "food_observation_only":
    case "gathered_fiber_material":
    case "gathered_fuel_material":
    case "plant_information":
    case "route_information":
      return "information_only";
    case "none":
      return "none";
  }
}

function shadowSupportDomain(kind: ActivityShadowReturnKind): ActivityShadowReturnRecord["shadowSupportDomain"] {
  if (kind === "water_support_shadow") {
    return "water_support";
  }
  if (kind === "none" || kind === "information_only") {
    return "information";
  }
  return "food";
}

function shadowOutcomeFoodFactor(activityOutcome: IntraSeasonTripActivityResult): number {
  switch (activityOutcome) {
    case "partial_success":
      return 1;
    case "target_found":
      return 0.45;
    case "successful_observation":
      return 0.15;
    default:
      return 0;
  }
}

function deriveShadowSubsistenceRecord(
  candidate: TripCandidate,
  taskGroupType: IntraSeasonTripTaskGroupType,
  estimatedPeopleCount: number,
  estimatedDurationDays: number,
  roundTripTiles: number,
  tripOutcome: IntraSeasonTripOutcome,
  activityOutcome: IntraSeasonTripActivityResult,
  resourceReturn: ActivityResourceReturnRecord,
  season: IntraSeasonTripRecord["season"],
  tick: TickNumber,
  bandId: BandId,
  day: DayNumber,
  // ECO-SEASON-1: realized seasonal ecology multiplier (~0.5..1.3; 1 = season-neutral).
  // Scales the SHADOW estimate only — never the canonical outcome or the real economy
  // (the economy reads this shadow value solely through the OFF-by-default AG11 path).
  seasonalEcologyModifier = 1,
): ActivityShadowReturnRecord {
  const effective = effectiveResourceConfidence(candidate.memory, Number(tick));
  const kind = deriveShadowReturnKind(resourceReturn.returnedResourceKind, taskGroupType);
  const domain = shadowSupportDomain(kind);
  const patchConfidence = clamp01(resourceReturn.returnConfidence);
  const seasonMismatch = isKnownSeasonMismatch(candidate.memory, season, effective.effectiveSeasonConfidence);
  const seasonFactor = seasonMismatch ? 0.45 : clamp01(0.7 + 0.3 * effective.effectiveSeasonConfidence);

  // Known remembered risk (band-known only — never hidden truth).
  const predatorRisk = clamp01(candidate.memory.risk.predatorOrAnimalRisk ?? 0);
  const badWater = candidate.memory.risk.badWater === true;
  const badReaction = candidate.memory.risk.poisoningOrBadReaction === true;
  const overnight = estimatedDurationDays > 1;

  const ecologyModifier = Math.max(0.5, Math.min(1.3, seasonalEcologyModifier));
  let shadowGrossValue = 0;
  if (domain === "food") {
    const baseRate = SHADOW_FOOD_BASE_RATE[taskGroupType] ?? 0.09;
    shadowGrossValue =
      baseRate * estimatedPeopleCount * shadowOutcomeFoodFactor(activityOutcome) * patchConfidence * seasonFactor * ecologyModifier;
  } else if (domain === "water_support") {
    // Water security support: people-scaled, confidence-gated. ECO-SEASON-1 lets realized
    // seasonal water reliability scale it (the shadow only — economy reads it solely via AG11).
    shadowGrossValue = SHADOW_WATER_SUPPORT_RATE * estimatedPeopleCount * patchConfidence * ecologyModifier;
  }

  const shadowTravelCost = Math.min(
    SHADOW_MAX_TRAVEL_COST,
    SHADOW_TRAVEL_RATE_PER_TILE * roundTripTiles + (overnight ? SHADOW_OVERNIGHT_TRAVEL_COST * (estimatedDurationDays - 1) : 0),
  );
  const shadowRiskPenalty = Math.min(
    SHADOW_MAX_RISK_PENALTY,
    predatorRisk * 0.08 + (badWater ? 0.05 : 0) + (badReaction ? 0.05 : 0) + (overnight ? 0.02 : 0),
  );

  const shadowGross = round4(shadowGrossValue);
  const travelCost = round4(shadowGrossValue === 0 ? 0 : shadowTravelCost);
  const riskPenalty = round4(shadowGrossValue === 0 ? 0 : shadowRiskPenalty);
  const shadowNetValue = round4(Math.max(0, shadowGrossValue - travelCost - riskPenalty));

  const taskReliability = SHADOW_TASK_RELIABILITY[taskGroupType] ?? 0.6;
  const riskReliabilityFactor = clamp01(1 - (predatorRisk * 0.5 + (badWater ? 0.3 : 0) + (badReaction ? 0.3 : 0)));
  const shadowReliability = round4(
    domain === "information" || shadowGrossValue === 0
      ? 0
      : clamp01(taskReliability * patchConfidence * (seasonMismatch ? 0.6 : clamp01(0.85 + 0.15 * effective.effectiveSeasonConfidence)) * riskReliabilityFactor),
  );

  return {
    shadowReturnKind: kind,
    shadowSupportDomain: domain,
    shadowGrossValue: shadowGross,
    shadowTravelCost: travelCost,
    shadowRiskPenalty: riskPenalty,
    shadowNetValue,
    shadowReliability,
    contributesAtBaseSameDay: tripOutcome === "returns_same_day",
    seasonalEcologyModifier: round4(ecologyModifier),
    shadowConsumedByEconomy: false,
    noEconomyCoupling: true,
    reasonIds: [makeActivityReasonId(bandId, day, "shadow", kind, candidate.targetTileId)],
  };
}

function buildActivityShadowSubsistenceSummary(
  band: Band,
  record: IntraSeasonTripRecord,
  recentIntraSeasonTrips: readonly IntraSeasonTripRecord[],
  laborSummary: ActivityLaborSummary,
): ActivityShadowSubsistenceSummary {
  let totalShadowGross = 0;
  let totalShadowNet = 0;
  let totalFoodShadowNet = 0;
  let totalWaterSupportShadowNet = 0;
  let sameDayShadowNet = 0;
  let delayedShadowNet = 0;
  let totalShadowTravelCost = 0;
  let foodBearingTripCount = 0;
  let waterSupportTripCount = 0;
  let informationOnlyTripCount = 0;
  let noContributionTripCount = 0;
  let seasonMismatchTripCount = 0;
  let foodReliabilitySum = 0;
  const byTaskType = new Map<IntraSeasonTripTaskGroupType, ActivityShadowTaskTypeContribution>();
  const byReturnKind = new Map<ActivityShadowReturnKind, ActivityShadowReturnKindContribution>();

  for (const trip of recentIntraSeasonTrips) {
    const shadow = trip.shadowSubsistence;
    totalShadowGross += shadow.shadowGrossValue;
    totalShadowNet += shadow.shadowNetValue;
    totalShadowTravelCost += shadow.shadowTravelCost;
    if (shadow.contributesAtBaseSameDay) {
      sameDayShadowNet += shadow.shadowNetValue;
    } else {
      delayedShadowNet += shadow.shadowNetValue;
    }

    if (shadow.shadowSupportDomain === "food") {
      totalFoodShadowNet += shadow.shadowNetValue;
      if (shadow.shadowNetValue > 0) {
        foodBearingTripCount += 1;
        foodReliabilitySum += shadow.shadowReliability;
      }
    } else if (shadow.shadowSupportDomain === "water_support") {
      totalWaterSupportShadowNet += shadow.shadowNetValue;
      if (shadow.shadowNetValue > 0) {
        waterSupportTripCount += 1;
      }
    }

    if (shadow.shadowReturnKind === "information_only") {
      informationOnlyTripCount += 1;
    }
    if (shadow.shadowReturnKind === "none") {
      noContributionTripCount += 1;
    }
    if (trip.activityOutcome === "failed_due_to_season_mismatch") {
      seasonMismatchTripCount += 1;
    }

    const task = byTaskType.get(trip.taskGroupType) ?? {
      taskGroupType: trip.taskGroupType,
      count: 0,
      grossTotal: 0,
      netTotal: 0,
    };
    byTaskType.set(trip.taskGroupType, {
      taskGroupType: trip.taskGroupType,
      count: task.count + 1,
      grossTotal: round4(task.grossTotal + shadow.shadowGrossValue),
      netTotal: round4(task.netTotal + shadow.shadowNetValue),
    });

    const kind = byReturnKind.get(shadow.shadowReturnKind) ?? {
      shadowReturnKind: shadow.shadowReturnKind,
      count: 0,
      netTotal: 0,
    };
    byReturnKind.set(shadow.shadowReturnKind, {
      shadowReturnKind: shadow.shadowReturnKind,
      count: kind.count + 1,
      netTotal: round4(kind.netTotal + shadow.shadowNetValue),
    });
  }

  const recentTripCount = recentIntraSeasonTrips.length;
  const meanFoodTripShadowNet = foodBearingTripCount > 0 ? round4(totalFoodShadowNet / foodBearingTripCount) : 0;
  const meanShadowReliability = foodBearingTripCount > 0 ? round4(foodReliabilitySum / foodBearingTripCount) : 0;
  const currentAbstractPerCapitaReturn = round4(band.carryingCapacity?.perCapitaReturn?.perCapitaReturn ?? 0);
  const currentAbstractAdjustedSupport = round4(
    band.carryingCapacity?.perCapitaReturn?.supportDebug?.adjustedReachableSupport ?? 0,
  );
  const currentAbstractDemand = round4(
    band.carryingCapacity?.perCapitaReturn?.supportDebug?.adultEquivalentDemand ?? 0,
  );
  const shadowSupportComparable = currentAbstractPerCapitaReturn > 0 && foodBearingTripCount > 0;

  return {
    bandId: band.id,
    day: record.day,
    tick: record.tick,
    season: record.season,
    recentTripCount,
    foodBearingTripCount,
    waterSupportTripCount,
    informationOnlyTripCount,
    noContributionTripCount,
    totalShadowGross: round4(totalShadowGross),
    totalShadowNet: round4(totalShadowNet),
    totalFoodShadowNet: round4(totalFoodShadowNet),
    totalWaterSupportShadowNet: round4(totalWaterSupportShadowNet),
    sameDayShadowNet: round4(sameDayShadowNet),
    delayedShadowNet: round4(delayedShadowNet),
    totalShadowTravelCost: round4(totalShadowTravelCost),
    meanFoodTripShadowNet,
    meanShadowReliability,
    travelCostShareOfGross: totalShadowGross > 0 ? round4(totalShadowTravelCost / totalShadowGross) : 0,
    seasonMismatchTripShare: recentTripCount > 0 ? round4(seasonMismatchTripCount / recentTripCount) : 0,
    shadowByTaskType: [...byTaskType.values()].sort((left, right) =>
      left.taskGroupType.localeCompare(right.taskGroupType),
    ),
    shadowByReturnKind: [...byReturnKind.values()].sort((left, right) =>
      left.shadowReturnKind.localeCompare(right.shadowReturnKind),
    ),
    peopleAssignedEstimate: laborSummary.peopleAssignedToActivityGroups,
    peopleAtResidentialCenterEstimate: laborSummary.peopleAtResidentialCenterEstimate,
    currentAbstractPerCapitaReturn,
    currentAbstractAdjustedSupport,
    currentAbstractDemand,
    shadowVsCurrentSupportRatio: shadowSupportComparable
      ? round4(meanFoodTripShadowNet / currentAbstractPerCapitaReturn)
      : 0,
    shadowSupportComparable,
    shadowConsumedByEconomy: false,
    noEconomyCoupling: true,
    noYieldCoupling: true,
    noCarryingCapacityCoupling: true,
    noPopulationChange: true,
    noStressChange: true,
    noSupportChange: true,
  };
}

function isKnownSeasonMismatch(
  memory: ResourcePatchMemory,
  season: IntraSeasonTripRecord["season"],
  seasonConfidence: number,
): boolean {
  if (seasonConfidence < 0.35 || memory.seasonality.bestSeasons.length === 0) {
    return false;
  }

  return !memory.seasonality.bestSeasons.includes(season);
}

function makeActivityReasonId(
  bandId: BandId,
  day: DayNumber,
  category: string,
  detail: string,
  targetTileId: TileId,
): ReasonId {
  return `reason:activity-${category}:${bandId}:${Number(day)}:${detail}:${targetTileId}` as ReasonId;
}

function applyActivityOutcomeToMemory(
  band: Band,
  record: IntraSeasonTripRecord,
  targetMemory: ResourcePatchMemory,
): ActivityMemoryApplication {
  const state = band.resourceKnowledgeState;

  if (state === undefined) {
    return {
      resourceKnowledgeState: state,
      effect: createNoActivityMemoryEffect(
        band.id,
        record.day,
        record.tick,
        record.season,
        record.targetTileId,
        record.activityOutcome,
        "no band resource-knowledge state; no activity memory update",
      ),
    };
  }

  const memoryIndex = state.patchMemories.findIndex(
    (memory) => memory.patchId === targetMemory.patchId && memory.approximateTile === record.targetTileId,
  );

  if (memoryIndex === -1) {
    return {
      resourceKnowledgeState: state,
      effect: createNoActivityMemoryEffect(
        band.id,
        record.day,
        record.tick,
        record.season,
        record.targetTileId,
        record.activityOutcome,
        "target patch not in band-known memory; no discovery created",
      ),
    };
  }

  const memory = state.patchMemories[memoryIndex];
  const effectType = deriveActivityMemoryEffectType(record, memory);

  if (effectType === "none") {
    return {
      resourceKnowledgeState: state,
      effect: createNoActivityMemoryEffect(
        band.id,
        record.day,
        record.tick,
        record.season,
        record.targetTileId,
        record.activityOutcome,
        "activity outcome is debug-only for memory",
        memory,
      ),
    };
  }

  const reasonId = makeActivityReasonId(band.id, record.day, "memory", effectType, record.targetTileId);
  const updatedMemory = updateResourcePatchMemoryFromActivity(memory, record, effectType, reasonId);
  const patchMemories = state.patchMemories.map((entry, index) =>
    index === memoryIndex ? updatedMemory : entry,
  );
  const effect = buildActivityMemoryEffectRecord(
    band.id,
    record,
    memory,
    updatedMemory,
    effectType,
    reasonId,
  );

  return {
    resourceKnowledgeState: {
      ...state,
      patchMemories,
    },
    effect,
  };
}

// EXPEDITIONARY-4 §11 — exported so a RETURNED expedition applies its work/verification
// record to canonical patch memory through the SAME single application the daily path
// uses. Nothing else may write patch memory from expedition state.
export function applyActivityOutcomeToMemoryForWorld(
  world: WorldState,
  band: Band,
  record: IntraSeasonTripRecord,
  targetMemory: ResourcePatchMemory,
): ActivityMemoryApplication {
  if (world.auditOptions?.activityMemoryCouplingDisabled === true) {
    return {
      resourceKnowledgeState: band.resourceKnowledgeState,
      effect: createNoActivityMemoryEffect(
        band.id,
        record.day,
        record.tick,
        record.season,
        record.targetTileId,
        record.activityOutcome,
        "activity memory coupling disabled by audit; no memory update",
        targetMemory,
      ),
    };
  }

  return applyActivityOutcomeToMemory(band, record, targetMemory);
}

export function applyActivityOutcomeToMemoryForAudit(
  band: Band,
  record: IntraSeasonTripRecord,
  targetMemory: ResourcePatchMemory,
): ActivityMemoryApplication {
  return applyActivityOutcomeToMemory(band, record, targetMemory);
}

function deriveActivityMemoryEffectType(
  record: IntraSeasonTripRecord,
  memory: ResourcePatchMemory,
): ActivityMemoryEffectType {
  switch (record.activityOutcome) {
    case "partial_success":
    case "target_found":
    case "successful_observation":
      return "confidence_refreshed";
    case "returned_with_information":
      if (record.taskGroupType === "water_group" || memory.resourceClassId === "water_resource") {
        return "water_reliability_refreshed";
      }

      if (record.taskGroupType === "plant_followup_group" && memory.plantObservation !== undefined) {
        return "plant_caution_refreshed";
      }

      if (record.taskGroupType === "memory_refresh_group") {
        return "route_memory_refreshed";
      }

      return "confidence_refreshed";
    case "target_not_found":
    case "failed_due_to_low_memory_confidence":
    case "failed_due_to_distance":
    case "delayed_return":
      return "confidence_lowered";
    case "failed_due_to_season_mismatch":
      return "seasonality_hint_added";
    case "failed_due_to_water_risk":
    case "abandoned_due_to_risk":
      return "risk_suspicion_added";
    case "no_effect_observed":
      return "none";
  }
}

function updateResourcePatchMemoryFromActivity(
  memory: ResourcePatchMemory,
  record: IntraSeasonTripRecord,
  effectType: ActivityMemoryEffectType,
  reasonId: ReasonId,
): ResourcePatchMemory {
  const confidence = updateActivityMemoryConfidence(memory.confidence, memory, record, effectType);
  const state = updateActivityMemoryState(memory, record, effectType, confidence);
  const source = isActivityConfirmation(record.activityOutcome) ? "direct" : memory.source;

  return {
    ...memory,
    state,
    source,
    confidence,
    seasonality: updateActivitySeasonality(memory, record, effectType),
    useHistory: updateActivityUseHistory(memory, record, effectType, confidence),
    risk: updateActivityRisk(memory, record, effectType),
    plantObservation: updateActivityPlantObservation(memory, record, effectType, reasonId),
    learning: updateActivityPatchLearningMemory(memory.learning, record, effectType),
    lastNotedTick: record.tick,
    reasonIds: [...memory.reasonIds, reasonId, ...record.activityOutcomeReasonIds].slice(-12),
  };
}

function updateActivityMemoryConfidence(
  confidence: ResourceConfidenceProfile,
  memory: ResourcePatchMemory,
  record: IntraSeasonTripRecord,
  effectType: ActivityMemoryEffectType,
): ResourceConfidenceProfile {
  switch (effectType) {
    case "confidence_refreshed":
      return withActivityConfidenceDeltas(confidence, {
        presenceConfidence: 0.03,
        seasonConfidence: 0.02,
        yieldConfidence: record.activityOutcome === "partial_success" ? 0.03 : 0.01,
        safetyConfidence: 0.01,
        accessConfidence: 0.01,
      });
    case "water_reliability_refreshed":
      return withActivityConfidenceDeltas(confidence, {
        presenceConfidence: 0.02,
        seasonConfidence: 0.01,
        safetyConfidence: memory.risk.badWater ? 0 : 0.01,
        accessConfidence: 0.02,
      });
    case "plant_caution_refreshed":
      return withActivityConfidenceDeltas(confidence, {
        presenceConfidence: 0.01,
        safetyConfidence: memory.plantObservation?.suspectedSafetyRisk === true ? -0.02 : 0,
        processingConfidence: memory.plantObservation?.suspectedProcessingNeed === true ? 0.02 : 0,
      });
    case "route_memory_refreshed":
      return withActivityConfidenceDeltas(confidence, {
        presenceConfidence: 0.01,
        accessConfidence: 0.03,
      });
    case "confidence_lowered":
      if (record.activityOutcome === "failed_due_to_distance" || record.activityOutcome === "delayed_return") {
        return withActivityConfidenceDeltas(confidence, {
          presenceConfidence: -0.01,
          accessConfidence: -0.05,
        });
      }

      return withActivityConfidenceDeltas(confidence, {
        presenceConfidence: -0.04,
        yieldConfidence: -0.03,
        accessConfidence: -0.01,
      });
    case "seasonality_hint_added":
      return withActivityConfidenceDeltas(confidence, {
        seasonConfidence: -0.05,
        yieldConfidence: -0.03,
      });
    case "risk_suspicion_added":
      return withActivityConfidenceDeltas(confidence, {
        presenceConfidence: -0.01,
        safetyConfidence: -0.06,
      });
    case "repeated_use_counter_incremented_placeholder":
    case "none":
      return confidence;
  }
}

function withActivityConfidenceDeltas(
  confidence: ResourceConfidenceProfile,
  delta: Partial<Record<ActivityMemoryConfidenceChannel, number>>,
): ResourceConfidenceProfile {
  return {
    presenceConfidence: adjustActivityConfidenceChannel(confidence.presenceConfidence, delta.presenceConfidence ?? 0),
    seasonConfidence: adjustActivityConfidenceChannel(confidence.seasonConfidence, delta.seasonConfidence ?? 0),
    yieldConfidence: adjustActivityConfidenceChannel(confidence.yieldConfidence, delta.yieldConfidence ?? 0),
    safetyConfidence: adjustActivityConfidenceChannel(confidence.safetyConfidence, delta.safetyConfidence ?? 0),
    processingConfidence: adjustActivityConfidenceChannel(confidence.processingConfidence, delta.processingConfidence ?? 0),
    accessConfidence: adjustActivityConfidenceChannel(confidence.accessConfidence, delta.accessConfidence ?? 0),
    recoveryConfidence: adjustActivityConfidenceChannel(confidence.recoveryConfidence, delta.recoveryConfidence ?? 0),
  };
}

function adjustActivityConfidenceChannel(previous: number, delta: number): number {
  if (delta > 0) {
    return round2(previous >= 0.9 ? previous : Math.min(0.9, previous + delta));
  }

  return round2(clamp01(previous + delta));
}

function updateActivityMemoryState(
  memory: ResourcePatchMemory,
  record: IntraSeasonTripRecord,
  effectType: ActivityMemoryEffectType,
  confidence: ResourceConfidenceProfile,
): ResourceKnowledgeStateKind {
  if (effectType === "risk_suspicion_added") {
    return "risky";
  }

  if (effectType === "seasonality_hint_added") {
    return "seasonally_bad";
  }

  if (effectType === "confidence_lowered") {
    return confidence.presenceConfidence < 0.18 ? "suspected" : memory.state;
  }

  if (
    record.activityOutcome === "partial_success" &&
    (memory.state === "observed" || memory.state === "used" || memory.state === "reliable")
  ) {
    return "used";
  }

  if (isActivityConfirmation(record.activityOutcome) && (memory.state === "unknown" || memory.state === "suspected")) {
    return "observed";
  }

  return memory.state;
}

function updateActivitySeasonality(
  memory: ResourcePatchMemory,
  record: IntraSeasonTripRecord,
  effectType: ActivityMemoryEffectType,
): ResourcePatchMemory["seasonality"] {
  const confirmed = effectType === "confidence_refreshed" ||
    effectType === "water_reliability_refreshed" ||
    effectType === "route_memory_refreshed";
  const failed = effectType === "seasonality_hint_added";

  return {
    bestSeasons: confirmed
      ? addUniqueSeason(memory.seasonality.bestSeasons, record.season)
      : memory.seasonality.bestSeasons,
    badSeasons: failed
      ? addUniqueSeason(memory.seasonality.badSeasons, record.season)
      : memory.seasonality.badSeasons,
    lastConfirmedSeason: confirmed ? record.season : memory.seasonality.lastConfirmedSeason,
    lastFailedTick: failed ? record.tick : memory.seasonality.lastFailedTick,
    failedSeasonCount: failed
      ? Math.min(99, memory.seasonality.failedSeasonCount + 1)
      : memory.seasonality.failedSeasonCount,
  };
}

function updateActivityUseHistory(
  memory: ResourcePatchMemory,
  record: IntraSeasonTripRecord,
  effectType: ActivityMemoryEffectType,
  confidence: ResourceConfidenceProfile,
): ResourceUseHistory {
  const visited = effectType !== "none";
  const successfulUse = (record.physicalFoodHarvest?.usableSupport ?? 0) > 0;
  const failedUse = isFailureOutcome(record.activityOutcome);
  const previousYield = memory.useHistory.lastYieldEstimate;
  const nextYield = successfulUse || failedUse ? confidence.yieldConfidence : previousYield;

  return {
    ...memory.useHistory,
    visits: visited ? Math.min(999, memory.useHistory.visits + 1) : memory.useHistory.visits,
    successfulUses: successfulUse ? Math.min(999, memory.useHistory.successfulUses + 1) : memory.useHistory.successfulUses,
    failedUses: failedUse ? Math.min(999, memory.useHistory.failedUses + 1) : memory.useHistory.failedUses,
    lastUsedTick: successfulUse ? record.tick : memory.useHistory.lastUsedTick,
    lastYieldEstimate: round2(nextYield),
    yieldTrend: deriveActivityYieldTrend(previousYield, nextYield),
  };
}

function deriveActivityYieldTrend(previous: number, next: number): ResourceUseHistory["yieldTrend"] {
  if (next > previous + 0.03) {
    return "rising";
  }

  if (next < previous - 0.03) {
    return "declining";
  }

  return "flat";
}

function updateActivityRisk(
  memory: ResourcePatchMemory,
  record: IntraSeasonTripRecord,
  effectType: ActivityMemoryEffectType,
): ResourcePatchMemory["risk"] {
  if (effectType !== "risk_suspicion_added") {
    return memory.risk;
  }

  return {
    ...memory.risk,
    badWater: memory.risk.badWater || record.activityOutcome === "failed_due_to_water_risk",
    predatorOrAnimalRisk: record.activityOutcome === "abandoned_due_to_risk"
      ? round2(Math.min(0.85, memory.risk.predatorOrAnimalRisk + 0.05))
      : memory.risk.predatorOrAnimalRisk,
  };
}

function updateActivityPlantObservation(
  memory: ResourcePatchMemory,
  record: IntraSeasonTripRecord,
  effectType: ActivityMemoryEffectType,
  reasonId: ReasonId,
): ResourcePatchMemory["plantObservation"] {
  if (effectType !== "plant_caution_refreshed" || memory.plantObservation === undefined) {
    return memory.plantObservation;
  }

  return {
    ...memory.plantObservation,
    observationCount: Math.min(99, memory.plantObservation.observationCount + 1),
    lastObservedTick: record.tick,
    trueValueHiddenFromBand: true,
    reasonIds: [...memory.plantObservation.reasonIds, reasonId].slice(-12),
  };
}

function updateActivityPatchLearningMemory(
  previous: ResourcePatchLearningMemory | undefined,
  record: IntraSeasonTripRecord,
  effectType: ActivityMemoryEffectType,
): ResourcePatchLearningMemory {
  const outcome = deriveActivityPatchLearningOutcome(record, effectType);
  const contradictionKind = deriveActivityPatchContradiction(record, effectType);
  const contradiction = isActivityMemoryContradiction(contradictionKind);
  const partial = contradictionKind === "partial_confirmation";
  const noInfo =
    contradictionKind === "repeated_no_new_information" ||
    contradictionKind === "memory_refreshed_without_confirmation";
  const falseInference = contradictionKind === "inferred_belief_unconfirmed";
  const seasonalMismatch = contradictionKind === "expected_seasonal_found_out_of_season";

  return {
    lastOutcome: outcome,
    lastContradictionKind: contradictionKind,
    lastOutcomeTick: record.tick,
    lastFailedTick: contradiction ? record.tick : previous?.lastFailedTick,
    confirmationCount: Math.min(
      999,
      (previous?.confirmationCount ?? 0) + (contradictionKind === "no_contradiction_confirmed" ? 1 : 0),
    ),
    contradictionCount: Math.min(999, (previous?.contradictionCount ?? 0) + (contradiction ? 1 : 0)),
    partialConfirmationCount: Math.min(999, (previous?.partialConfirmationCount ?? 0) + (partial ? 1 : 0)),
    noInfoCount: Math.min(999, (previous?.noInfoCount ?? 0) + (noInfo ? 1 : 0)),
    falseInferenceCount: Math.min(999, (previous?.falseInferenceCount ?? 0) + (falseInference ? 1 : 0)),
    seasonalMismatchCount: Math.min(999, (previous?.seasonalMismatchCount ?? 0) + (seasonalMismatch ? 1 : 0)),
  };
}

function deriveActivityPatchLearningOutcome(
  record: IntraSeasonTripRecord,
  effectType: ActivityMemoryEffectType,
): ResourcePatchLearningOutcome {
  if (effectType === "seasonality_hint_added") {
    return "confirmed_seasonal_absent";
  }

  if (effectType === "risk_suspicion_added") {
    return "safety_risk_detected";
  }

  if (effectType === "route_memory_refreshed") {
    return "route_improved_only";
  }

  if (effectType === "confidence_lowered") {
    return record.activityOutcome === "failed_due_to_distance" || record.activityOutcome === "delayed_return"
      ? "route_failed_or_blocked"
      : "belief_refuted";
  }

  if (effectType === "plant_caution_refreshed") {
    return "processing_need_suspected";
  }

  if (effectType === "water_reliability_refreshed" || effectType === "confidence_refreshed") {
    return record.activityOutcome === "partial_success" ? "confirmed_present" : "memory_refreshed_no_new_info";
  }

  return "memory_refreshed_no_new_info";
}

function deriveActivityPatchContradiction(
  record: IntraSeasonTripRecord,
  effectType: ActivityMemoryEffectType,
): ResourcePatchContradictionKind {
  if (effectType === "seasonality_hint_added") {
    return "expected_seasonal_found_out_of_season";
  }

  if (effectType === "risk_suspicion_added") {
    return record.activityOutcome === "failed_due_to_water_risk"
      ? "expected_water_refuge_unconfirmed"
      : "expected_accessible_found_costly";
  }

  if (effectType === "confidence_lowered") {
    return record.activityOutcome === "failed_due_to_distance" || record.activityOutcome === "delayed_return"
      ? "expected_accessible_found_costly"
      : "expected_present_found_absent";
  }

  if (effectType === "plant_caution_refreshed") {
    return "partial_confirmation";
  }

  if (effectType === "route_memory_refreshed") {
    return "memory_refreshed_without_confirmation";
  }

  if (record.activityOutcome === "partial_success") {
    return "partial_confirmation";
  }

  return "no_contradiction_confirmed";
}

function isActivityMemoryContradiction(kind: ResourcePatchContradictionKind): boolean {
  return kind !== "no_contradiction_confirmed" &&
    kind !== "partial_confirmation" &&
    kind !== "memory_refreshed_without_confirmation" &&
    kind !== "repeated_no_new_information";
}

function buildActivityMemoryEffectRecord(
  bandId: BandId,
  record: IntraSeasonTripRecord,
  before: ResourcePatchMemory,
  after: ResourcePatchMemory,
  effectType: ActivityMemoryEffectType,
  reasonId: ReasonId,
): ActivityMemoryEffectRecord {
  const beforeConfidence = snapshotActivityConfidence(before.confidence);
  const afterConfidence = snapshotActivityConfidence(after.confidence);
  const mainDelta = getMainActivityConfidenceDelta(beforeConfidence, afterConfidence);

  return {
    sourceBandId: bandId,
    sourceTripDay: record.day,
    tick: record.tick,
    season: record.season,
    targetTileId: record.targetTileId,
    patchId: before.patchId,
    resourceClassId: before.resourceClassId,
    activityOutcome: record.activityOutcome,
    effectType,
    effectSummary: summarizeActivityMemoryEffect(effectType, before, after, mainDelta.channel, mainDelta.delta),
    confidenceBefore: beforeConfidence,
    confidenceAfter: afterConfidence,
    mainConfidenceChannel: mainDelta.channel,
    confidenceDelta: mainDelta.delta,
    reasonIds: [reasonId],
    noHiddenTruth: true,
    targetKnownMemoryOnly: true,
    noNewResourceDiscovery: true,
    noFoodCoupling: true,
    noYieldCoupling: true,
    noCarryingCapacityCoupling: true,
    noPopulationChange: true,
    noStressChange: true,
    noSupportChange: true,
  };
}

function createNoActivityMemoryEffect(
  bandId: BandId,
  day: DayNumber,
  tick: TickNumber,
  season: IntraSeasonTripRecord["season"],
  targetTileId: TileId,
  activityOutcome: IntraSeasonTripActivityResult,
  summary = "no activity memory update",
  memory?: ResourcePatchMemory,
): ActivityMemoryEffectRecord {
  return {
    sourceBandId: bandId,
    sourceTripDay: day,
    tick,
    season,
    targetTileId,
    patchId: memory?.patchId,
    resourceClassId: memory?.resourceClassId,
    activityOutcome,
    effectType: "none",
    effectSummary: summary,
    confidenceBefore: memory === undefined ? undefined : snapshotActivityConfidence(memory.confidence),
    confidenceAfter: memory === undefined ? undefined : snapshotActivityConfidence(memory.confidence),
    confidenceDelta: 0,
    reasonIds: [],
    noHiddenTruth: true,
    targetKnownMemoryOnly: true,
    noNewResourceDiscovery: true,
    noFoodCoupling: true,
    noYieldCoupling: true,
    noCarryingCapacityCoupling: true,
    noPopulationChange: true,
    noStressChange: true,
    noSupportChange: true,
  };
}

function snapshotActivityConfidence(confidence: ResourceConfidenceProfile): ActivityMemoryConfidenceSnapshot {
  return {
    presenceConfidence: confidence.presenceConfidence,
    seasonConfidence: confidence.seasonConfidence,
    yieldConfidence: confidence.yieldConfidence,
    safetyConfidence: confidence.safetyConfidence,
    processingConfidence: confidence.processingConfidence,
    accessConfidence: confidence.accessConfidence,
    recoveryConfidence: confidence.recoveryConfidence,
  };
}

function getMainActivityConfidenceDelta(
  before: ActivityMemoryConfidenceSnapshot,
  after: ActivityMemoryConfidenceSnapshot,
): { readonly channel: ActivityMemoryConfidenceChannel; readonly delta: number } {
  const channels: readonly ActivityMemoryConfidenceChannel[] = [
    "presenceConfidence",
    "seasonConfidence",
    "yieldConfidence",
    "safetyConfidence",
    "processingConfidence",
    "accessConfidence",
    "recoveryConfidence",
  ];
  let channel = channels[0];
  let delta = round4(after[channel] - before[channel]);

  for (const candidate of channels.slice(1)) {
    const candidateDelta = round4(after[candidate] - before[candidate]);

    if (Math.abs(candidateDelta) > Math.abs(delta)) {
      channel = candidate;
      delta = candidateDelta;
    }
  }

  return { channel, delta };
}

function summarizeActivityMemoryEffect(
  effectType: ActivityMemoryEffectType,
  before: ResourcePatchMemory,
  after: ResourcePatchMemory,
  channel: ActivityMemoryConfidenceChannel,
  delta: number,
): string {
  return `${effectType}; ${String(before.patchId)}; ${channel} ${delta >= 0 ? "+" : ""}${round4(delta)}; state ${before.state}->${after.state}; memory_only_no_economy`;
}

function isActivityConfirmation(outcome: IntraSeasonTripActivityResult): boolean {
  return outcome === "successful_observation" ||
    outcome === "target_found" ||
    outcome === "partial_success" ||
    outcome === "returned_with_information";
}

function addUniqueSeason(seasons: readonly IntraSeasonTripRecord["season"][], season: IntraSeasonTripRecord["season"]): readonly IntraSeasonTripRecord["season"][] {
  return seasons.includes(season) ? seasons : [...seasons, season];
}

function deriveTaskGroupLabel(taskGroupType: IntraSeasonTripTaskGroupType): string {
  switch (taskGroupType) {
    case "hunting_group":
      return "Hunting group";
    case "fishing_group":
      return "Fishing group";
    case "plant_gathering_group":
      return "Plant gathering group";
    case "water_group":
      return "Water group";
    case "plant_followup_group":
      return "Plant follow-up group";
    case "memory_refresh_group":
      return "Memory refresh group";
    case "local_foraging_group":
      return "Local foraging group";
  }
}

function deriveObjectiveLabel(objective: IntraSeasonTripObjective): string {
  switch (objective) {
    case "local_exploitation":
      return "Local exploitation";
    case "water_security":
      return "Water security";
    case "food_patch_check":
      return "Food patch check";
    case "plant_followup_testing":
      return "Plant follow-up testing";
    case "memory_refresh":
      return "Memory refresh";
  }
}

function estimateTaskGroupPeople(band: Band, taskGroupType: IntraSeasonTripTaskGroupType): number {
  // EXPEDITIONARY-2 (Slice E) — adults who are physically AWAY on an expedition are not
  // at camp and cannot staff a same-day task group. They were committed exactly once when
  // the party departed and return to availability only when it comes home. This is read
  // straight off band state (rather than importing the expedition module) to keep the
  // dependency direction one-way: expedition -> intraSeasonTrips, never back.
  //
  // CORRECTION-34D — a labour question against a labour cohort, so `partyWorkers` (productive
  // labour) is the right term and non-working party members are correctly absent from it.
  const awayWorkers = (band.expeditions ?? [])
    .filter((expedition) =>
      expedition.phase === "prepared" ||
      expedition.phase === "outbound" ||
      expedition.phase === "operating" ||
      expedition.phase === "returning")
    .reduce((total, expedition) => total + expedition.partyWorkers, 0);
  const adults = Math.max(1, Math.round(Math.max(0, band.demography.workingAdults - awayWorkers)));
  const baseShare =
    taskGroupType === "water_group" || taskGroupType === "memory_refresh_group"
      ? 0.12
      : taskGroupType === "hunting_group" || taskGroupType === "plant_followup_group"
        ? 0.18
        : taskGroupType === "fishing_group" || taskGroupType === "plant_gathering_group"
          ? 0.22
          : 0.2;
  const cap =
    taskGroupType === "water_group" || taskGroupType === "memory_refresh_group"
      ? 4
      : taskGroupType === "hunting_group" || taskGroupType === "plant_followup_group"
        ? 6
        : 8;

  return Math.max(1, Math.min(cap, Math.round(adults * baseShare)));
}

function buildActivityLaborSummary(
  band: Band,
  latestTrip: IntraSeasonTripRecord,
  recentTrips: readonly IntraSeasonTripRecord[],
): ActivityLaborSummary {
  const workingAdults = Math.max(0, Math.round(band.demography.workingAdults));
  const totalPeople = Math.max(0, Math.round(band.demography.population));
  const day = latestTrip.day;
  const activeTrips = recentTrips
    .filter((trip) => isTripActiveOnDay(trip, day))
    .sort((left, right) => compareLaborTrips(left, right, day));
  let remainingAdults = workingAdults;
  let assignedPeople = 0;
  let awayPeople = 0;
  let impossibleOverAllocationCount = 0;
  const laborRecords: ActivityGroupLaborRecord[] = [];

  for (const trip of activeTrips) {
    const estimatedPeopleCount = Math.max(0, Math.round(trip.estimatedPeopleCount));
    const assignedPeopleEstimate = Math.min(estimatedPeopleCount, remainingAdults);
    const status = deriveLaborStatus(trip, day);

    if (assignedPeopleEstimate < estimatedPeopleCount) {
      impossibleOverAllocationCount += 1;
    }

    remainingAdults = Math.max(0, remainingAdults - assignedPeopleEstimate);
    assignedPeople += assignedPeopleEstimate;

    if (status !== "returned") {
      awayPeople += assignedPeopleEstimate;
    }

    laborRecords.push({
      sourceBandId: trip.sourceBandId,
      sourceTripDay: trip.day,
      sourceTripReasonIds: trip.reasonIds,
      taskGroupType: trip.taskGroupType,
      groupLabel: trip.groupLabel,
      objective: trip.objective,
      objectiveLabel: trip.objectiveLabel,
      targetTileId: trip.targetTileId,
      estimatedPeopleCount,
      assignedPeopleEstimate,
      status,
      outcome: trip.outcome,
      activityResult: trip.activityResult,
      activityOutcome: trip.activityOutcome,
      activityOutcomeSummary: trip.activityOutcomeSummary,
      resourceReturn: trip.resourceReturn,
      activityMemoryEffect: trip.activityMemoryEffect,
    });
  }

  const recentActivityGroupSummaries = [...laborRecords]
    .sort(compareLaborRecordsByRecency)
    .slice(0, RECENT_ACTIVITY_GROUP_SUMMARY_CAP);
  const physicalFoodConsumed = recentTrips.some((trip) => trip.resourceReturn.consumedByEconomy);

  return {
    bandId: band.id,
    day,
    tick: latestTrip.tick,
    season: latestTrip.season,
    totalPeople,
    workingAdults,
    activeActivityGroupCount: laborRecords.length,
    peopleAssignedToActivityGroups: assignedPeople,
    peopleAwayInActivityGroups: awayPeople,
    peopleAtResidentialCenterEstimate: Math.max(0, workingAdults - assignedPeople),
    peopleByActivityType: summarizePeopleByActivityType(laborRecords),
    latestActivityGroupSummary: recentActivityGroupSummaries[0],
    recentActivityGroupSummaries,
    cappedAllocation: impossibleOverAllocationCount > 0,
    impossibleOverAllocationCount,
    allocationConfidence: "estimated_only",
    noFoodCoupling: !physicalFoodConsumed,
    noYieldCoupling: true,
    noCarryingCapacityCoupling: !physicalFoodConsumed,
    noPopulationChange: true,
    noStressChange: true,
  };
}

function buildActivityOutcomeSummary(
  band: Band,
  latestTrip: IntraSeasonTripRecord,
  recentTrips: readonly IntraSeasonTripRecord[],
): ActivityOutcomeSummary {
  const outcomesByType: ActivityOutcomeTypeCount[] = [];
  const outcomesByTaskType: ActivityOutcomeTaskTypeCount[] = [];
  const returnsByResourceKind: ActivityReturnResourceKindCount[] = [];
  let successCount = 0;
  let partialCount = 0;
  let failedCount = 0;
  let informationCount = 0;
  let noEffectCount = 0;
  let maxEstimatedReturnValue = 0;
  let physicalFoodConsumed = false;

  for (const trip of recentTrips) {
    incrementOutcomeCount(outcomesByType, trip.activityOutcome);
    incrementTaskOutcomeCount(outcomesByTaskType, trip.taskGroupType, trip.activityOutcome);
    incrementReturnKindCount(
      returnsByResourceKind,
      trip.resourceReturn.returnedResourceKind,
      trip.resourceReturn.estimatedReturnValue,
    );
    maxEstimatedReturnValue = Math.max(maxEstimatedReturnValue, trip.resourceReturn.estimatedReturnValue);
    physicalFoodConsumed ||= trip.resourceReturn.consumedByEconomy;

    if (isSuccessOutcome(trip.activityOutcome)) {
      successCount += 1;
    } else if (trip.activityOutcome === "partial_success") {
      partialCount += 1;
    } else if (isFailureOutcome(trip.activityOutcome)) {
      failedCount += 1;
    } else if (trip.activityOutcome === "returned_with_information") {
      informationCount += 1;
    } else if (trip.activityOutcome === "no_effect_observed") {
      noEffectCount += 1;
    }
  }

  return {
    bandId: band.id,
    day: latestTrip.day,
    tick: latestTrip.tick,
    season: latestTrip.season,
    outcomesByType: outcomesByType.sort((left, right) => left.outcome.localeCompare(right.outcome)),
    outcomesByTaskType: outcomesByTaskType.sort((left, right) =>
      left.taskGroupType === right.taskGroupType
        ? left.outcome.localeCompare(right.outcome)
        : left.taskGroupType.localeCompare(right.taskGroupType),
    ),
    returnsByResourceKind: returnsByResourceKind.sort((left, right) =>
      left.returnedResourceKind.localeCompare(right.returnedResourceKind),
    ),
    successCount,
    partialCount,
    failedCount,
    informationCount,
    noEffectCount,
    maxEstimatedReturnValue: round4(maxEstimatedReturnValue),
    consumedByEconomy: physicalFoodConsumed,
    noYieldCoupling: true,
    noCarryingCapacityCoupling: !physicalFoodConsumed,
    noPopulationChange: true,
    noStressChange: true,
    noSupportChange: !physicalFoodConsumed,
  };
}

function buildActivityMemoryUpdateSummary(
  band: Band,
  latestTrip: IntraSeasonTripRecord,
  recentTrips: readonly IntraSeasonTripRecord[],
): ActivityMemoryUpdateSummary {
  const effects = recentTrips.map((trip) => trip.activityMemoryEffect);
  const effectCounts: ActivityMemoryEffectCount[] = [];
  const touchedPatchIds = new Set<ResourcePatchId>();
  let confidenceIncreaseTotal = 0;
  let confidenceDecreaseTotal = 0;
  let minConfidenceDelta = 0;
  let maxConfidenceDelta = 0;
  let sawDelta = false;

  for (const effect of effects) {
    incrementActivityMemoryEffectCount(effectCounts, effect.effectType);

    if (effect.effectType !== "none" && effect.patchId !== undefined) {
      touchedPatchIds.add(effect.patchId);
    }

    if (effect.confidenceDelta > 0) {
      confidenceIncreaseTotal += effect.confidenceDelta;
    } else if (effect.confidenceDelta < 0) {
      confidenceDecreaseTotal += effect.confidenceDelta;
    }

    if (!sawDelta || effect.confidenceDelta < minConfidenceDelta) {
      minConfidenceDelta = effect.confidenceDelta;
    }

    if (!sawDelta || effect.confidenceDelta > maxConfidenceDelta) {
      maxConfidenceDelta = effect.confidenceDelta;
    }

    sawDelta = true;
  }

  const recentMemoryEffects = effects
    .filter((effect) => effect.effectType !== "none")
    .slice(0, RECENT_ACTIVITY_MEMORY_EFFECT_CAP);

  return {
    bandId: band.id,
    day: latestTrip.day,
    tick: latestTrip.tick,
    season: latestTrip.season,
    effectCounts: effectCounts.sort((left, right) => left.effectType.localeCompare(right.effectType)),
    touchedMemoryCount: touchedPatchIds.size,
    confidenceIncreaseTotal: round4(confidenceIncreaseTotal),
    confidenceDecreaseTotal: round4(confidenceDecreaseTotal),
    minConfidenceDelta: round4(minConfidenceDelta),
    maxConfidenceDelta: round4(maxConfidenceDelta),
    latestMemoryEffect: recentMemoryEffects[0],
    recentMemoryEffects,
    noHiddenTruth: true,
    targetKnownMemoryOnly: true,
    noNewResourceDiscovery: true,
    noFoodCoupling: true,
    noYieldCoupling: true,
    noCarryingCapacityCoupling: true,
    noPopulationChange: true,
    noStressChange: true,
    noSupportChange: true,
  };
}

function incrementActivityMemoryEffectCount(
  counts: ActivityMemoryEffectCount[],
  effectType: ActivityMemoryEffectType,
): void {
  const index = counts.findIndex((entry) => entry.effectType === effectType);

  if (index === -1) {
    counts.push({ effectType, count: 1 });
    return;
  }

  counts[index] = { ...counts[index], count: counts[index].count + 1 };
}

function incrementOutcomeCount(
  counts: ActivityOutcomeTypeCount[],
  outcome: IntraSeasonTripActivityResult,
): void {
  const index = counts.findIndex((entry) => entry.outcome === outcome);

  if (index === -1) {
    counts.push({ outcome, count: 1 });
    return;
  }

  counts[index] = { ...counts[index], count: counts[index].count + 1 };
}

function incrementTaskOutcomeCount(
  counts: ActivityOutcomeTaskTypeCount[],
  taskGroupType: IntraSeasonTripTaskGroupType,
  outcome: IntraSeasonTripActivityResult,
): void {
  const index = counts.findIndex((entry) => entry.taskGroupType === taskGroupType && entry.outcome === outcome);

  if (index === -1) {
    counts.push({ taskGroupType, outcome, count: 1 });
    return;
  }

  counts[index] = { ...counts[index], count: counts[index].count + 1 };
}

function incrementReturnKindCount(
  counts: ActivityReturnResourceKindCount[],
  returnedResourceKind: ActivityReturnResourceKind,
  estimatedReturnValue: number,
): void {
  const index = counts.findIndex((entry) => entry.returnedResourceKind === returnedResourceKind);

  if (index === -1) {
    counts.push({
      returnedResourceKind,
      count: 1,
      estimatedReturnValueTotal: round4(estimatedReturnValue),
    });
    return;
  }

  counts[index] = {
    ...counts[index],
    count: counts[index].count + 1,
    estimatedReturnValueTotal: round4(counts[index].estimatedReturnValueTotal + estimatedReturnValue),
  };
}

function compareLaborRecordsByRecency(
  left: ActivityGroupLaborRecord,
  right: ActivityGroupLaborRecord,
): number {
  if (Number(right.sourceTripDay) !== Number(left.sourceTripDay)) {
    return Number(right.sourceTripDay) - Number(left.sourceTripDay);
  }

  return String(left.targetTileId).localeCompare(String(right.targetTileId));
}

function isTripActiveOnDay(trip: IntraSeasonTripRecord, day: DayNumber): boolean {
  const numericDay = Number(day);

  return Number(trip.startDay) <= numericDay && Number(trip.endDay) >= numericDay;
}

function compareLaborTrips(
  left: IntraSeasonTripRecord,
  right: IntraSeasonTripRecord,
  day: DayNumber,
): number {
  const leftPriority = getLaborStatusPriority(deriveLaborStatus(left, day));
  const rightPriority = getLaborStatusPriority(deriveLaborStatus(right, day));

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  if (Number(left.startDay) !== Number(right.startDay)) {
    return Number(left.startDay) - Number(right.startDay);
  }

  return String(left.targetTileId).localeCompare(String(right.targetTileId));
}

function deriveLaborStatus(
  trip: IntraSeasonTripRecord,
  day: DayNumber,
): ActivityGroupLaborStatus {
  if (trip.activityOutcome === "delayed_return") {
    return "delayed";
  }

  const numericDay = Number(day);

  if (trip.outcome === "continues") {
    return numericDay < Number(trip.endDay) ? "continuing" : "returned";
  }

  if (trip.outcome === "overnight") {
    return numericDay < Number(trip.endDay) ? "overnight" : "returned";
  }

  if (trip.outcome === "returns_same_day") {
    return "returned";
  }

  return "away";
}

function isSuccessOutcome(outcome: IntraSeasonTripActivityResult): boolean {
  return outcome === "successful_observation" || outcome === "target_found";
}

function isFailureOutcome(outcome: IntraSeasonTripActivityResult): boolean {
  return outcome === "target_not_found" ||
    outcome === "failed_due_to_distance" ||
    outcome === "failed_due_to_water_risk" ||
    outcome === "failed_due_to_low_memory_confidence" ||
    outcome === "failed_due_to_season_mismatch" ||
    outcome === "abandoned_due_to_risk";
}

function getLaborStatusPriority(status: ActivityGroupLaborStatus): number {
  switch (status) {
    case "continuing":
      return 0;
    case "overnight":
      return 1;
    case "delayed":
      return 2;
    case "away":
      return 3;
    case "returned":
      return 4;
  }
}

function summarizePeopleByActivityType(
  records: readonly ActivityGroupLaborRecord[],
): readonly ActivityTypeLaborAllocation[] {
  const byType: Partial<Record<IntraSeasonTripTaskGroupType, ActivityTypeLaborAllocation>> = {};

  for (const record of records) {
    const previous = byType[record.taskGroupType];
    byType[record.taskGroupType] = previous === undefined
      ? {
          taskGroupType: record.taskGroupType,
          groupCount: 1,
          assignedPeopleEstimate: record.assignedPeopleEstimate,
        }
      : {
          ...previous,
          groupCount: previous.groupCount + 1,
          assignedPeopleEstimate: previous.assignedPeopleEstimate + record.assignedPeopleEstimate,
        };
  }

  return Object.values(byType).sort((left, right) =>
    left.taskGroupType.localeCompare(right.taskGroupType),
  );
}

export interface PhysicalRoundTripTiming {
  readonly outboundTravelDays: number;
  readonly activityDays: number;
  readonly returnTravelDays: number;
  readonly totalDays: number;
  readonly durationDays: number;
  readonly sameDay: boolean;
  readonly kmPerTravelDay: number;
}

/**
 * SCALE-1 — the physical boundary between ordinary same-day activity and the
 * expedition lifecycle. Route topology is supplied by the existing bounded path
 * builder; only physical edge time + explicit on-site time decides the domain.
 */
export function derivePhysicalRoundTripTiming(
  world: WorldState,
  band: Band,
  outboundRouteTileIds: readonly TileId[],
  activityDays: number = INTRA_SEASON_ACTIVITY_WORK_DAYS,
  travelContext: TravelContext = "resource_expedition",
): PhysicalRoundTripTiming {
  const kmPerTravelDay = deriveTravelPace(band, travelContext).kmPerTravelDay;
  const outboundTravelDays = getRouteTravelTimeDays(world, outboundRouteTileIds, kmPerTravelDay);
  const returnTravelDays = getRouteTravelTimeDays(world, [...outboundRouteTileIds].reverse(), kmPerTravelDay);
  const boundedActivityDays = Math.max(0, activityDays);
  const totalDays = outboundTravelDays + boundedActivityDays + returnTravelDays;
  return {
    outboundTravelDays,
    activityDays: boundedActivityDays,
    returnTravelDays,
    totalDays,
    durationDays: Number.isFinite(totalDays) ? Math.max(1, Math.ceil(totalDays)) : Number.POSITIVE_INFINITY,
    sameDay: Number.isFinite(totalDays) && totalDays <= 1 + 1e-9,
    kmPerTravelDay,
  };
}

function deriveCandidatePhysicalTiming(
  world: WorldState,
  band: Band,
  targetTileId: TileId,
  maxReachTiles: number = MAX_TRIP_DISTANCE_TILES,
): PhysicalRoundTripTiming | undefined {
  const route = buildOutboundPathTiles(world, band.position, targetTileId, maxReachTiles);
  return route.length <= 1
    ? undefined
    : derivePhysicalRoundTripTiming(world, band, route, INTRA_SEASON_ACTIVITY_WORK_DAYS);
}

/**
 * EXPEDITIONARY-2 — the band-known trip target the expedition lifecycle should consider,
 * using this module's own bounded patch-memory selection (so an expedition can never
 * target country the band does not remember). `maxDistanceTiles` lets a party look past
 * the daily-trip cap; the caller owns feasibility.
 */
export function selectExpeditionTripCandidate(
  world: WorldState,
  band: Band,
  day: number,
  maxDistanceTiles: number,
): { readonly memory: ResourcePatchMemory; readonly targetTileId: TileId; readonly distanceTiles: number } | undefined {
  const candidate = selectTripCandidate(world, band, day, maxDistanceTiles, true);

  if (candidate === undefined) {
    return undefined;
  }

  // ECOLOGY-VIABILITY-CORRECTION-1 — this selector's ONLY production consumer is the
  // expedition retrieval family (expedition.ts `retrieval`), which launches the party as
  // `distant_plant_gathering` and hard-codes the cause to "food_resource_check". But
  // `getTripCause` also yields non-food causes ("water_check" for water_resource,
  // "plant_followup_test" for any observed class, "memory_refresh" for any stale memory),
  // so a water or material memory could be sent out as a food-gathering expedition. Such a
  // party cannot take food: the physically-at-target bypass below is food-class-only, so
  // the belief gates zero the return kind, `activityEligible` is false, and the trip
  // terminates `harvest_failed` having never queried a stock. Measured on a marginal-site
  // founder: 86 of 115 gathering attempts ended `harvest_failed` and 0 food units were
  // ever delivered. A gathering party must target food the band remembers as food.
  if (!isFoodClass(candidate.memory.resourceClassId)) {
    return undefined;
  }

  return {
    memory: candidate.memory,
    targetTileId: candidate.targetTileId,
    distanceTiles: candidate.distanceTiles,
  };
}

function classifyOutcome(estimatedDurationDays: number): IntraSeasonTripOutcome {
  if (estimatedDurationDays <= 1) {
    return "returns_same_day";
  }

  if (estimatedDurationDays === 2) {
    return "overnight";
  }

  return "continues";
}

function deriveMovementType(
  cause: IntraSeasonTripCause,
  outcome: IntraSeasonTripOutcome,
  distanceTiles: number,
): IntraSeasonTripMovementType {
  if (cause === "local_resource_use") {
    return "local_foraging_loop";
  }

  if (cause === "water_check") {
    return "water_trip";
  }

  if (cause === "plant_followup_test") {
    return "plant_followup_trip";
  }

  if (cause === "memory_refresh") {
    return "memory_refresh_trip";
  }

  // food_resource_check: a same-day short hop is a local foraging loop; a same-day
  // longer reach is a known-patch trip; an out-overnight one is a hunt/scout foray.
  if (outcome !== "returns_same_day") {
    return "overnight_hunt_or_scout";
  }

  return distanceTiles <= 2 ? "local_foraging_loop" : "food_patch_trip";
}

function deriveTaskGroupType(
  cause: IntraSeasonTripCause,
  resourceClassId: ResourceClassId,
): IntraSeasonTripTaskGroupType {
  if (cause === "water_check") {
    return "water_group";
  }

  if (cause === "plant_followup_test") {
    return "plant_followup_group";
  }

  if (cause === "memory_refresh") {
    return "memory_refresh_group";
  }

  if (cause === "local_resource_use") {
    return "local_foraging_group";
  }

  switch (resourceClassId) {
    case "animal_food":
      return "hunting_group";
    case "aquatic_food":
      return "fishing_group";
    case "generic_plant_food":
    case "fallback_food":
      return "plant_gathering_group";
    default:
      return "local_foraging_group";
  }
}

function deriveObjective(cause: IntraSeasonTripCause): IntraSeasonTripObjective {
  switch (cause) {
    case "water_check":
      return "water_security";
    case "food_resource_check":
      return "food_patch_check";
    case "plant_followup_test":
      return "plant_followup_testing";
    case "memory_refresh":
      return "memory_refresh";
    case "local_resource_use":
    default:
      return "local_exploitation";
  }
}

// Deterministic 4-neighbour staircase that hugs the straight line origin→target: at
// each step move the axis with more distance remaining (x wins ties). Each step is
// grid-distance 1 — the trip is logically NOT a teleport even if the UI compresses
// it; history preserves every crossed tile. Bounded by MAX_TRIP_DISTANCE_TILES + 1.
/**
 * REALISM-2B Part C — passability-aware activity breadcrumb.
 *
 * The earlier geometric (Bresenham) path stepped straight through water: ~26% of
 * trips ended STANDING on an aquatic tile because a water/aquatic target tile is
 * itself unwalkable. There is no boat/swim system, so an activity group must keep
 * to passable land:
 *   - a land target is aimed at directly;
 *   - an aquatic target (a water source) is a valid OBJECTIVE but not a stand tile,
 *     so we resolve the accessible shoreline tile nearest the origin and stand there;
 *   - the route is a contiguous (4-adjacent) shortest path over PASSABLE land only;
 *   - if no passable route exists, we return a single-tile (non-drawable) path rather
 *     than draw a fake water crossing.
 *
 * `targetTileId`/`distanceTiles`/`roundTripTiles` (and therefore the shadow economy)
 * are unchanged — only the drawn breadcrumb `pathTiles`/`tilesCrossed` become honest.
 */
function buildOutboundPathTiles(
  world: WorldState,
  originTileId: TileId,
  targetTileId: TileId,
  maxReachTiles: number = MAX_TRIP_DISTANCE_TILES,
): readonly TileId[] {
  const origin = world.tiles[originTileId];
  const target = world.tiles[targetTileId];

  if (origin === undefined || target === undefined) {
    return [originTileId];
  }

  const aimTile = isBandPassableDestination(target)
    ? target
    : resolveShoreApproachTile(world, origin, target) ?? origin;

  if (aimTile.id === originTileId) {
    return [originTileId];
  }

  return findPassablePath(world, origin, aimTile, maxReachTiles) ?? [originTileId];
}

/**
 * EXPEDITIONARY-1 — the physical outbound ROUTE for a multi-day expedition, built by
 * the same deterministic passable-path machinery the daily trips use (so an
 * expedition is the same party system reaching further, not a second pathfinder).
 * Returns the tile-by-tile route origin→target inclusive, or undefined when no
 * passable route exists within the expedition's bounded neighbourhood — which is
 * exactly the physical `route_impassable` case, never a teleport.
 */
export function buildExpeditionRouteTiles(
  world: WorldState,
  originTileId: TileId,
  targetTileId: TileId,
  maxReachTiles: number,
): readonly TileId[] | undefined {
  const route = buildOutboundPathTiles(world, originTileId, targetTileId, maxReachTiles);

  if (route.length <= 1) {
    return undefined;
  }

  return route;
}

/**
 * The accessible shoreline/land tile adjacent to a water target, nearest the origin
 * (deterministic tile-id tie-break). Undefined when the water source has no passable
 * 4-neighbour at all (fully enclosed water) → the trip is target-inaccessible.
 */
function resolveShoreApproachTile(world: WorldState, origin: Tile, target: Tile): Tile | undefined {
  let best: Tile | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const neighborId of target.neighbors) {
    const neighbor = world.tiles[neighborId];

    if (neighbor === undefined || getGridDistance(target, neighbor) !== 1 || !isBandPassableDestination(neighbor)) {
      continue;
    }

    const distance = getGridDistance(origin, neighbor);

    if (
      best === undefined ||
      distance < bestDistance ||
      (distance === bestDistance && String(neighbor.id) < String(best.id))
    ) {
      best = neighbor;
      bestDistance = distance;
    }
  }

  return best;
}

/**
 * Deterministic breadth-first shortest contiguous path over 4-adjacent PASSABLE land
 * tiles from origin to aim. The aim tile is always enterable (it is already passable
 * land — a land target or a resolved shoreline). Returns undefined when no passable
 * route exists within a bounded neighbourhood.
 */
function findPassablePath(
  world: WorldState,
  origin: Tile,
  aim: Tile,
  // EXPEDITIONARY-1: expeditions reach country BEYOND the daily trip envelope, so
  // they need a correspondingly larger (still hard-bounded) search neighbourhood.
  // Same-day trips keep the original bound exactly — passing nothing is unchanged.
  maxReachTiles: number = MAX_TRIP_DISTANCE_TILES,
): readonly TileId[] | undefined {
  const maxExplored = (maxReachTiles * 2 + 4) ** 2;
  const cameFrom = new Map<TileId, TileId>();
  const visited = new Set<TileId>([origin.id]);
  let frontier: Tile[] = [origin];
  let explored = 0;

  while (frontier.length > 0 && explored < maxExplored) {
    const next: Tile[] = [];

    for (const tile of frontier) {
      explored += 1;

      if (tile.id === aim.id) {
        return reconstructPassablePath(cameFrom, origin.id, aim.id);
      }

      const neighbors = [...tile.neighbors].sort((left, right) => String(left).localeCompare(String(right)));

      for (const neighborId of neighbors) {
        if (visited.has(neighborId)) {
          continue;
        }

        const neighbor = world.tiles[neighborId];

        if (neighbor === undefined || getGridDistance(tile, neighbor) !== 1) {
          continue;
        }

        if (neighbor.id !== aim.id && !isBandPassableDestination(neighbor)) {
          continue;
        }

        visited.add(neighborId);
        cameFrom.set(neighborId, tile.id);
        next.push(neighbor);
      }
    }

    frontier = next;
  }

  return undefined;
}

function reconstructPassablePath(
  cameFrom: ReadonlyMap<TileId, TileId>,
  originId: TileId,
  aimId: TileId,
): readonly TileId[] {
  const reversed: TileId[] = [aimId];
  let current = aimId;

  while (current !== originId) {
    const previous = cameFrom.get(current);

    if (previous === undefined) {
      break;
    }

    reversed.push(previous);
    current = previous;
  }

  reversed.reverse();

  return reversed;
}

// EXPEDITIONARY-2: the expedition lifecycle is part of this same party authority and
// must iterate bands in the identical deterministic order, so these are shared rather
// than re-implemented there.
export function isActiveExpeditionBand(band: Band): boolean {
  return isActiveBand(band);
}

export function compareExpeditionBands(left: Band, right: Band): number {
  return compareBands(left, right);
}

function isActiveBand(band: Band): boolean {
  return (
    band.status !== "dispersed" &&
    band.viability?.status !== "absorbed" &&
    band.viability?.status !== "extinct"
  );
}

export function isFoodClass(classId: ResourceClassId): boolean {
  return classId === "generic_plant_food" || classId === "aquatic_food" || classId === "animal_food" || classId === "fallback_food";
}

function getCauseWeight(cause: IntraSeasonTripCause): number {
  switch (cause) {
    case "local_resource_use":
      return 0.58;
    case "water_check":
      return 0.82;
    case "food_resource_check":
      return 0.72;
    case "plant_followup_test":
      return 0.66;
    case "memory_refresh":
    default:
      return 0.52;
  }
}

function getRepeatTargetSuppressionDays(cause: IntraSeasonTripCause): number {
  switch (cause) {
    case "water_check":
      return 6;
    case "local_resource_use":
      return 6;
    case "food_resource_check":
      return 12;
    case "memory_refresh":
      return 21;
    case "plant_followup_test":
    default:
      return 30;
  }
}

function getGridDistance(left: Tile, right: Tile): number {
  return Math.abs(left.coord.x - right.coord.x) + Math.abs(left.coord.y - right.coord.y);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function compareBands(left: Band, right: Band): number {
  return String(left.id).localeCompare(String(right.id));
}
