import type {
  BandId,
  RouteId,
  Season,
  TickNumber,
  TileId,
} from "../core/types";
import type { WorldState } from "../world/types";
import { getTile, getTileAtCoord } from "../world/generate";
import { isBandPassableDestination } from "../world/passability";
import { getEuclideanPhysicalDistanceKm } from "../world/spatialGeometry";
import type {
  Band,
  DryMarginMobilityContext,
  NearbyBandPressure,
  NearbyOpportunityGradient,
  PlaceMemoryRecord,
  RangeSaturationState,
} from "./types";
import type { CrowdingField } from "./crowding";
import type { SharedCatchmentIndex } from "./sharedCatchment";
import type { ResidentialAnchorContext } from "./residentialAnchor";
import type { SeasonalRoundScoringContext } from "./seasonalRound";
import { isLivingBand } from "./bandLifecycle";

// PROVENANCE D — TECHNICAL CAP/INDEX GRANULARITY. Raster-cell buckets affect lookup fan-out only;
// exact physical distance below remains the behavior gate.
const SPATIAL_BUCKET_SIZE = 5;

// PROVENANCE C — MODEL / PROVISIONAL SCALE-1 CALIBRATION. The legacy cache/local-density rules
// used 4-cell neighborhoods and a +1-cell decay shoulder for local-density queries.
// Map 2 is 1.5 km/cell, so simply treating those integers as kilometers would be false provenance.
// The known-opportunity source is bounded by candidate count, not by a second physical radius;
// canonical traversal time decides whether a remembered candidate is behaviorally reachable.
export const DEFAULT_NEARBY_RADIUS_KM = 4;
const LOCAL_POPULATION_DECAY_SHOULDER_KM = 1;
const MAX_SALIENT_PLACES = 16;
const MAX_SALIENT_CORRIDORS = 12;
const MAX_FRONTIER_CANDIDATES = 16;
const MAX_OPPORTUNITY_CANDIDATES = 16;

export interface BandSpatialIndex {
  readonly bucketSize: number;
  readonly activeBandIds: readonly BandId[];
  readonly tileBandOccupancy: ReadonlyMap<TileId, readonly BandId[]>;
  readonly bandIdsByBucket: ReadonlyMap<string, readonly BandId[]>;
  // PERF-3: getNearbyActiveBandIdsForTile is a pure function of (tileId, radius)
  // for a given index/world, but is called ~9× per band per tick (nearbyBands
  // build + local population estimate + local band count, across 3 context
  // passes). Memoize the result per `${tileId}:${radius}` so repeated queries
  // for the same tile (clustered bands, multiple metrics, multiple passes)
  // reuse it. Byte-identical: the cached array is the same sorted list, and
  // all callers read it (filter/reduce produce new arrays, never mutate it).
  readonly nearbyByTileRadius: Map<string, readonly BandId[]>;
}

export interface SalientBandMemorySummary {
  readonly bandId: BandId;
  readonly topReturnPlaceIds: readonly TileId[];
  readonly topAnchorPlaceIds: readonly TileId[];
  readonly topRiskyPlaceIds: readonly TileId[];
  readonly topDepletedPlaceIds: readonly TileId[];
  readonly topCorridorIds: readonly RouteId[];
  readonly knownFrontierTileIds: readonly TileId[];
  readonly knownOpportunityCandidateIds: readonly TileId[];
  readonly salientInheritedMemoryIds: readonly TileId[];
}

export interface TickContextCache {
  readonly tick: TickNumber;
  readonly season: Season;
  readonly bandSpatialIndex: BandSpatialIndex;
  readonly activeBandIds: readonly BandId[];
  readonly nonDispersedBandCount: number;
  readonly tileBandOccupancy: ReadonlyMap<TileId, readonly BandId[]>;
  readonly nearbyBandsByBandId: ReadonlyMap<BandId, readonly BandId[]>;
  readonly nearbyBandPressureByBandTileKey: Map<string, NearbyBandPressure>;
  readonly salientMemoryByBandId: ReadonlyMap<BandId, SalientBandMemorySummary>;
  readonly salientMemoryBandIdsByTileId: ReadonlyMap<TileId, readonly BandId[]>;
  readonly knownOpportunityByBandId: Map<BandId, NearbyOpportunityGradient>;
  readonly rangeSaturationByBandId: Map<BandId, RangeSaturationState>;
  // Pre-decision dry-margin + anchor contexts, computed once per band while
  // scoring (2I.3, PART 1). Reused as the post-decision state when the residence
  // does not move, so the anchor/catchment is derived once per held band per tick
  // instead of twice. `has(bandId)` distinguishes "computed, none" from "absent".
  readonly preDecisionDryContextByBandId: Map<BandId, DryMarginMobilityContext | undefined>;
  readonly preDecisionAnchorByBandId: Map<BandId, ResidentialAnchorContext | undefined>;
  readonly preDecisionSeasonalRoundByBandId: Map<BandId, SeasonalRoundScoringContext | undefined>;
  // Shared catchment claims index (2J.1), built at most once per cache via
  // getSharedCatchmentIndex. Mutable holder so the deterministic, bounded index
  // is memoized rather than rebuilt per band.
  readonly sharedCatchmentMemo: { value?: SharedCatchmentIndex };
  // Per-band salient place-memory sort (2J.1A perf). Keyed by the immutable band
  // SNAPSHOT (object identity), not band.id: applyBandDecision yields a new band
  // object whenever a band's memory changes, so a mutated band is a fresh key
  // (recomputed) and an unchanged snapshot read many times reuses one sort.
  readonly salientPlaceMemoByBand: WeakMap<Band, readonly PlaceMemoryRecord[]>;
  // Deterministic per-tick crowding field (2J.2B): each band scatters its
  // proximity + remembered-area influence into nearby tiles ONCE per cache from
  // the fixed band snapshot, so getNearbyBandPressure reads per-tile crowding in
  // O(local kin) instead of iterating nearby bands per (band, candidate tile).
  // Mutable holder so the field is built at most once per cache.
  readonly crowdingFieldMemo: { value?: CrowdingField };
}

// CORE-PIPELINE-DECOMPOSITION-3 (Workstream C) — audit-only lifecycle counters.
// These count full context rebuilds vs partial refreshes. They do not change the
// returned cache or any simulation behavior; contextLifecycleAudit.mjs resets them
// before a controlled run and reads them after. Not persisted, not read by the sim.
let fullContextBuildCount = 0;
let partialContextRefreshCount = 0;

export function getContextLifecycleCounters(): { readonly fullBuilds: number; readonly partialRefreshes: number } {
  return { fullBuilds: fullContextBuildCount, partialRefreshes: partialContextRefreshCount };
}

export function resetContextLifecycleCounters(): void {
  fullContextBuildCount = 0;
  partialContextRefreshCount = 0;
}

// CORE-PIPELINE-DECOMPOSITION-3 (Workstream C) — build options. `reuseSalientMemoryById`
// lets a partial refresh reuse per-band salient-memory summaries for bands whose
// memory is unchanged (the expensive shared work), recomputing only for new bands.
// `countAsPartialRefresh` records the build as a partial refresh, not a full rebuild.
// Both default to plain full-build behavior; the produced cache is byte-identical.
export interface BuildTickContextCacheOptions {
  readonly reuseSalientMemoryById?: ReadonlyMap<BandId, SalientBandMemorySummary>;
  readonly countAsPartialRefresh?: boolean;
}

export function buildTickContextCache(
  world: WorldState,
  options?: BuildTickContextCacheOptions,
): TickContextCache {
  if (options?.countAsPartialRefresh === true) {
    partialContextRefreshCount += 1;
  } else {
    fullContextBuildCount += 1;
  }
  const allBands = Object.values(world.bands);
  const activeBandIds = allBands
    .filter(isLivingBand)
    .map((band) => band.id)
    .sort(compareBandIds);
  const nonDispersedBandCount = allBands.filter(isLivingBand).length;
  const bandSpatialIndex = buildBandSpatialIndex(world, activeBandIds);
  const salientMemoryByBandId = new Map<BandId, SalientBandMemorySummary>();
  const nearbyBandsByBandId = new Map<BandId, readonly BandId[]>();

  for (const bandId of activeBandIds) {
    const band = world.bands[bandId];

    if (band === undefined) {
      continue;
    }

    const reusedSalientMemory = options?.reuseSalientMemoryById?.get(band.id);
    salientMemoryByBandId.set(band.id, reusedSalientMemory ?? buildSalientBandMemorySummary(world, band));
    nearbyBandsByBandId.set(
      band.id,
      getNearbyActiveBandIdsForTile(world, bandSpatialIndex, band.position, DEFAULT_NEARBY_RADIUS_KM)
        .filter((nearbyBandId) => nearbyBandId !== band.id),
    );
  }

  return {
    tick: world.time.tick,
    season: world.time.season,
    bandSpatialIndex,
    activeBandIds,
    nonDispersedBandCount,
    tileBandOccupancy: bandSpatialIndex.tileBandOccupancy,
    nearbyBandsByBandId,
    nearbyBandPressureByBandTileKey: new Map(),
    salientMemoryByBandId,
    salientMemoryBandIdsByTileId: buildSalientMemoryTileIndex(salientMemoryByBandId),
    knownOpportunityByBandId: new Map<BandId, NearbyOpportunityGradient>(),
    rangeSaturationByBandId: new Map<BandId, RangeSaturationState>(),
    preDecisionDryContextByBandId: new Map<BandId, DryMarginMobilityContext | undefined>(),
    preDecisionAnchorByBandId: new Map<BandId, ResidentialAnchorContext | undefined>(),
    preDecisionSeasonalRoundByBandId: new Map<BandId, SeasonalRoundScoringContext | undefined>(),
    sharedCatchmentMemo: {},
    salientPlaceMemoByBand: new WeakMap<Band, readonly PlaceMemoryRecord[]>(),
    crowdingFieldMemo: {},
  };
}

// CORE-PIPELINE-DECOMPOSITION-3 (Workstream C) — the sorted active band ids for a
// world, using the exact filter buildTickContextCache uses. Cheap; lets a caller
// decide whether a prior cache's derived band set is still valid.
export function deriveActiveBandIds(world: WorldState): readonly BandId[] {
  return Object.values(world.bands)
    .filter(isLivingBand)
    .map((band) => band.id)
    .sort(compareBandIds);
}

// CORE-PIPELINE-DECOMPOSITION-3 (Workstream C) — the end-of-season read-model
// context, derived as a PARTIAL REFRESH of the post-decision cache in every case,
// so the final read-model pass never costs a full shared rebuild:
//   - active band set unchanged (the common path): reuse all derived data (spatial
//     index, salient memory, nearby-band index) with fresh per-decision memos;
//   - active band set changed (fission/extinction): rebuild the cheap spatial/active/
//     nearby data from the advanced world but reuse per-band salient memory for the
//     surviving bands (the expensive shared work), computing it fresh only for new
//     bands. In both cases the result is byte-identical to a full rebuild.
export function deriveFinalReadModelContext(
  priorCache: TickContextCache,
  world: WorldState,
): TickContextCache {
  const activeBandIds = deriveActiveBandIds(world);
  const unchanged = activeBandIds.length === priorCache.activeBandIds.length &&
    activeBandIds.every((id, index) => id === priorCache.activeBandIds[index]);
  if (unchanged) {
    return cloneTickContextCacheWithFreshMemos(priorCache);
  }
  return buildTickContextCache(world, {
    reuseSalientMemoryById: priorCache.salientMemoryByBandId,
    countAsPartialRefresh: true,
  });
}

// CORE-PIPELINE-DECOMPOSITION-3 (Workstream C) — reuse an existing cache's expensive
// derived data (spatial index, active band ids, per-band salient-memory summaries,
// nearby-band index) but start FRESH empty per-decision memos, so ecology-dependent
// values (range saturation, known opportunity) recompute from the advanced world
// while the position/memory-derived data is safely reused. Callers MUST have verified
// the active band set is unchanged (see deriveFinalReadModelContext); counts as a
// partial refresh.
export function cloneTickContextCacheWithFreshMemos(cache: TickContextCache): TickContextCache {
  partialContextRefreshCount += 1;
  return {
    tick: cache.tick,
    season: cache.season,
    bandSpatialIndex: cache.bandSpatialIndex,
    activeBandIds: cache.activeBandIds,
    nonDispersedBandCount: cache.nonDispersedBandCount,
    tileBandOccupancy: cache.tileBandOccupancy,
    nearbyBandsByBandId: cache.nearbyBandsByBandId,
    salientMemoryByBandId: cache.salientMemoryByBandId,
    salientMemoryBandIdsByTileId: cache.salientMemoryBandIdsByTileId,
    // Fresh per-decision memos so ecology-dependent values are recomputed from the
    // advanced world rather than read stale from the post-decision cache.
    nearbyBandPressureByBandTileKey: new Map(),
    knownOpportunityByBandId: new Map<BandId, NearbyOpportunityGradient>(),
    rangeSaturationByBandId: new Map<BandId, RangeSaturationState>(),
    preDecisionDryContextByBandId: new Map<BandId, DryMarginMobilityContext | undefined>(),
    preDecisionAnchorByBandId: new Map<BandId, ResidentialAnchorContext | undefined>(),
    preDecisionSeasonalRoundByBandId: new Map<BandId, SeasonalRoundScoringContext | undefined>(),
    sharedCatchmentMemo: {},
    salientPlaceMemoByBand: new WeakMap<Band, readonly PlaceMemoryRecord[]>(),
    crowdingFieldMemo: {},
  };
}

export function getActiveBandsFromCache(
  world: WorldState,
  cache: TickContextCache,
): readonly Band[] {
  return cache.activeBandIds
    .map((bandId) => world.bands[bandId])
    .filter((band): band is Band => band !== undefined)
    .sort(compareBands);
}

export function getNearbyActiveBandIdsForTile(
  world: WorldState,
  index: BandSpatialIndex,
  tileId: TileId,
  radiusKm = DEFAULT_NEARBY_RADIUS_KM,
): readonly BandId[] {
  const tile = getTile(world, tileId);

  if (tile === undefined) {
    return [];
  }

  const memoKey = `${String(tileId)}:${radiusKm.toFixed(6)}km`;
  const memoized = index.nearbyByTileRadius.get(memoKey);

  if (memoized !== undefined) {
    return memoized;
  }

  const cellWidthKm = Math.max(1e-9, world.config.spatial.cellWidthKm);
  const cellHeightKm = Math.max(1e-9, world.config.spatial.cellHeightKm);
  const rasterRadius = Math.max(
    Math.ceil(radiusKm / cellWidthKm),
    Math.ceil(radiusKm / cellHeightKm),
  );
  const bucketRadius = Math.ceil(rasterRadius / index.bucketSize) + 1;
  const centerBucket = getBucketCoord(tile.coord.x, tile.coord.y, index.bucketSize);
  const candidateIds = new Set<BandId>();

  for (let y = centerBucket.y - bucketRadius; y <= centerBucket.y + bucketRadius; y += 1) {
    for (let x = centerBucket.x - bucketRadius; x <= centerBucket.x + bucketRadius; x += 1) {
      const bandIds = index.bandIdsByBucket.get(getBucketKey(x, y));

      if (bandIds === undefined) {
        continue;
      }

      for (const bandId of bandIds) {
        candidateIds.add(bandId);
      }
    }
  }

  const result = [...candidateIds]
    .filter((bandId) => {
      const band = world.bands[bandId];
      const bandTile = band === undefined ? undefined : getTile(world, band.position);

      return bandTile !== undefined && getPhysicalDistanceKm(world, tile, bandTile) <= radiusKm + 1e-9;
    })
    .sort(compareBandIds);

  index.nearbyByTileRadius.set(memoKey, result);

  return result;
}

export function getLocalPopulationEstimateFromCache(
  world: WorldState,
  cache: TickContextCache,
  tileId: TileId,
  radiusKm = DEFAULT_NEARBY_RADIUS_KM,
): number {
  const tile = getTile(world, tileId);

  if (tile === undefined) {
    return 0;
  }

  return getNearbyActiveBandIdsForTile(world, cache.bandSpatialIndex, tileId, radiusKm)
    .reduce((total, bandId) => {
      const band = world.bands[bandId];
      const bandTile = band === undefined ? undefined : getTile(world, band.position);

      if (band === undefined || bandTile === undefined) {
        return total;
      }

      const distanceKm = getPhysicalDistanceKm(world, tile, bandTile);
      const denominator = radiusKm + LOCAL_POPULATION_DECAY_SHOULDER_KM;
      const weight = denominator <= 0
        ? (distanceKm <= 1e-9 ? 1 : 0)
        : (radiusKm + LOCAL_POPULATION_DECAY_SHOULDER_KM - distanceKm) / denominator;

      return total + band.demography.population * Math.max(0, weight);
    }, 0);
}

export function getLocalBandCountFromCache(
  world: WorldState,
  cache: TickContextCache,
  tileId: TileId,
  radiusKm = DEFAULT_NEARBY_RADIUS_KM,
): number {
  return getNearbyActiveBandIdsForTile(world, cache.bandSpatialIndex, tileId, radiusKm).length;
}

export function getSalientMemorySummary(
  cache: TickContextCache | undefined,
  bandId: BandId,
): SalientBandMemorySummary | undefined {
  return cache?.salientMemoryByBandId.get(bandId);
}

export function getBandIdsWithSalientMemoryNearTile(
  world: WorldState,
  cache: TickContextCache,
  tileId: TileId,
  radiusTiles = 2,
): readonly BandId[] {
  const tile = getTile(world, tileId);

  if (tile === undefined) {
    return [];
  }

  const bandIds = new Set<BandId>();

  // TOPOLOGICAL memory-index lookup only. This does not represent physical presence,
  // encounter range, competition, or visiting reachability.
  for (let y = tile.coord.y - radiusTiles; y <= tile.coord.y + radiusTiles; y += 1) {
    for (let x = tile.coord.x - radiusTiles; x <= tile.coord.x + radiusTiles; x += 1) {
      if (Math.abs(tile.coord.x - x) + Math.abs(tile.coord.y - y) > radiusTiles) {
        continue;
      }

      const nearbyTile = getTileAtCoord(world, { x, y });

      if (nearbyTile === undefined) {
        continue;
      }

      for (const bandId of cache.salientMemoryBandIdsByTileId.get(nearbyTile.id) ?? []) {
        bandIds.add(bandId);
      }
    }
  }

  return [...bandIds].sort(compareBandIds);
}

function buildSalientMemoryTileIndex(
  summariesByBandId: ReadonlyMap<BandId, SalientBandMemorySummary>,
): ReadonlyMap<TileId, readonly BandId[]> {
  const entries = new Map<TileId, BandId[]>();

  for (const summary of summariesByBandId.values()) {
    const tileIds = new Set<TileId>([
      ...summary.topReturnPlaceIds,
      ...summary.topAnchorPlaceIds,
    ]);

    for (const tileId of tileIds) {
      const bandIds = entries.get(tileId) ?? [];
      bandIds.push(summary.bandId);
      entries.set(tileId, bandIds);
    }
  }

  const output = new Map<TileId, readonly BandId[]>();

  for (const [tileId, bandIds] of entries) {
    output.set(tileId, bandIds.sort(compareBandIds));
  }

  return output;
}

function buildBandSpatialIndex(
  world: WorldState,
  activeBandIds: readonly BandId[],
): BandSpatialIndex {
  const tileBandEntries = new Map<TileId, BandId[]>();
  const bucketEntries = new Map<string, BandId[]>();

  for (const bandId of activeBandIds) {
    const band = world.bands[bandId];
    const tile = band === undefined ? undefined : getTile(world, band.position);

    if (band === undefined || tile === undefined) {
      continue;
    }

    const tileBands = tileBandEntries.get(tile.id) ?? [];
    tileBands.push(band.id);
    tileBandEntries.set(tile.id, tileBands);

    const bucketKey = getBucketKeyForTile(tile.coord.x, tile.coord.y, SPATIAL_BUCKET_SIZE);
    const bucketBands = bucketEntries.get(bucketKey) ?? [];
    bucketBands.push(band.id);
    bucketEntries.set(bucketKey, bucketBands);
  }

  const tileBandOccupancy = new Map<TileId, readonly BandId[]>();
  const bandIdsByBucket = new Map<string, readonly BandId[]>();

  for (const [tileId, bandIds] of tileBandEntries) {
    tileBandOccupancy.set(tileId, bandIds.sort(compareBandIds));
  }

  for (const [bucketKey, bandIds] of bucketEntries) {
    bandIdsByBucket.set(bucketKey, bandIds.sort(compareBandIds));
  }

  return {
    bucketSize: SPATIAL_BUCKET_SIZE,
    activeBandIds,
    tileBandOccupancy,
    bandIdsByBucket,
    nearbyByTileRadius: new Map<string, readonly BandId[]>(),
  };
}

// PERF-2: the salient-memory summary is a pure function of the band's
// placeMemory / observedTiles / travelCorridors / position (+ static world
// topology). All four sub-objects are reference-preserved across context
// passes and ticks until the band actually changes that aspect (the range/
// frontier passes spread NEW band wrappers but keep these refs), so memoizing
// on placeMemory + validating the other three refs reuses the summary across
// the 3 cache builds per tick and into the next tick — byte-identical, since
// identical inputs yield identical output. It was ~6% of self-time (rebuilt 3×
// per tick per band). Keyed on placeMemory (unique per band snapshot).
interface SalientMemoCacheEntry {
  readonly observedTiles: Band["knowledge"]["observedTiles"];
  readonly travelCorridors: Band["travelCorridors"];
  readonly position: TileId;
  readonly summary: SalientBandMemorySummary;
}

const salientMemorySummaryMemo = new WeakMap<
  Band["placeMemory"],
  SalientMemoCacheEntry
>();

function buildSalientBandMemorySummary(
  world: WorldState,
  band: Band,
): SalientBandMemorySummary {
  const cached = salientMemorySummaryMemo.get(band.placeMemory);

  if (
    cached !== undefined &&
    cached.observedTiles === band.knowledge.observedTiles &&
    cached.travelCorridors === band.travelCorridors &&
    cached.position === band.position
  ) {
    return cached.summary;
  }

  const summary = computeSalientBandMemorySummary(world, band);
  salientMemorySummaryMemo.set(band.placeMemory, {
    observedTiles: band.knowledge.observedTiles,
    travelCorridors: band.travelCorridors,
    position: band.position,
    summary,
  });

  return summary;
}

function computeSalientBandMemorySummary(
  world: WorldState,
  band: Band,
): SalientBandMemorySummary {
  const placeMemories = Object.values(band.placeMemory);
  const topReturnPlaceIds = placeMemories
    .filter((memory) => memory.isReturnPlace)
    .sort(comparePlaceMemoryImportance)
    .slice(0, MAX_SALIENT_PLACES)
    .map((memory) => memory.tileId);
  const topAnchorPlaceIds = placeMemories
    .filter((memory) => memory.attachment > 0.4 || memory.isReturnPlace)
    .sort(comparePlaceMemoryImportance)
    .slice(0, MAX_SALIENT_PLACES)
    .map((memory) => memory.tileId);
  const topRiskyPlaceIds = placeMemories
    .filter((memory) => memory.valences.includes("risky") || memory.valences.includes("avoid_place"))
    .sort(comparePlaceMemoryImportance)
    .slice(0, MAX_SALIENT_PLACES)
    .map((memory) => memory.tileId);
  const topDepletedPlaceIds = placeMemories
    .filter((memory) => memory.valences.includes("depleted"))
    .sort(comparePlaceMemoryImportance)
    .slice(0, MAX_SALIENT_PLACES)
    .map((memory) => memory.tileId);
  const topCorridorIds = Object.values(band.travelCorridors)
    .sort((left, right) => {
      const scoreDelta = right.useCount + right.confidence - (left.useCount + left.confidence);

      return scoreDelta === 0
        ? String(left.id).localeCompare(String(right.id))
        : scoreDelta;
    })
    .slice(0, MAX_SALIENT_CORRIDORS)
    .map((corridor) => corridor.id);
  const knownRecords = Object.values(band.knowledge.observedTiles);
  const knownFrontierTileIds = knownRecords
    .filter((record) => isKnownFrontierRecord(world, band, record.tileId))
    .sort(compareKnownTileRecordOpportunity)
    .slice(0, MAX_FRONTIER_CANDIDATES)
    .map((record) => record.tileId);
  const knownOpportunityCandidateIds = knownRecords
    .filter((record) => isKnownOpportunityRecord(world, band, record.tileId))
    .sort(compareKnownTileRecordOpportunity)
    .slice(0, MAX_OPPORTUNITY_CANDIDATES)
    .map((record) => record.tileId);
  const salientInheritedMemoryIds = knownRecords
    .filter((record) => record.knowledgeSource !== "personally_observed" && record.confidence > 0.22)
    .sort(compareKnownTileRecordOpportunity)
    .slice(0, MAX_SALIENT_PLACES)
    .map((record) => record.tileId);

  return {
    bandId: band.id,
    topReturnPlaceIds,
    topAnchorPlaceIds,
    topRiskyPlaceIds,
    topDepletedPlaceIds,
    topCorridorIds,
    knownFrontierTileIds,
    knownOpportunityCandidateIds,
    salientInheritedMemoryIds,
  };
}

function isKnownFrontierRecord(
  world: WorldState,
  band: Band,
  tileId: TileId,
): boolean {
  const tile = getTile(world, tileId);

  return (
    tile !== undefined &&
    isBandPassableDestination(tile) &&
    tile.neighbors.some((neighborId) => band.knowledge.observedTiles[neighborId] === undefined)
  );
}

function isKnownOpportunityRecord(
  world: WorldState,
  band: Band,
  tileId: TileId,
): boolean {
  const tile = getTile(world, tileId);

  return (
    tile !== undefined &&
    tile.id !== band.position &&
    isBandPassableDestination(tile)
  );
}

function comparePlaceMemoryImportance(
  left: Band["placeMemory"][TileId],
  right: Band["placeMemory"][TileId],
): number {
  const leftScore = left.attachment + left.confidence * 0.18 + (left.isReturnPlace ? 0.35 : 0);
  const rightScore = right.attachment + right.confidence * 0.18 + (right.isReturnPlace ? 0.35 : 0);

  return rightScore === leftScore
    ? String(left.tileId).localeCompare(String(right.tileId))
    : rightScore - leftScore;
}

function compareKnownTileRecordOpportunity(
  left: Band["knowledge"]["observedTiles"][TileId],
  right: Band["knowledge"]["observedTiles"][TileId],
): number {
  const leftScore = getRememberedOpportunityValue(left);
  const rightScore = getRememberedOpportunityValue(right);

  return rightScore === leftScore
    ? String(left.tileId).localeCompare(String(right.tileId))
    : rightScore - leftScore;
}

function getRememberedOpportunityValue(record: Band["knowledge"]["observedTiles"][TileId]): number {
  return (
    record.observedRichness * 0.36 +
    (record.observedWaterAccess ?? 0) * 0.28 +
    record.observedAquaticPotential * 0.16 +
    (record.observedSeasonalPattern?.reliability ?? 0) * 0.1 +
    record.confidence * 0.1 -
    (record.observedRisk ?? 0) * 0.12
  );
}

function getBucketCoord(
  x: number,
  y: number,
  bucketSize: number,
): { readonly x: number; readonly y: number } {
  return {
    x: Math.floor(x / bucketSize),
    y: Math.floor(y / bucketSize),
  };
}

function getBucketKeyForTile(x: number, y: number, bucketSize: number): string {
  const bucketCoord = getBucketCoord(x, y, bucketSize);

  return getBucketKey(bucketCoord.x, bucketCoord.y);
}

function getBucketKey(x: number, y: number): string {
  return `${x},${y}`;
}

function getPhysicalDistanceKm(
  world: WorldState,
  first: NonNullable<ReturnType<typeof getTile>>,
  second: NonNullable<ReturnType<typeof getTile>>,
): number {
  return getEuclideanPhysicalDistanceKm(world.config, first.coord, second.coord);
}

function compareBands(left: Band, right: Band): number {
  return compareBandIds(left.id, right.id);
}

function compareBandIds(left: BandId, right: BandId): number {
  return String(left).localeCompare(String(right));
}
