import type {
  Band,
  CompressedCorridorSummary,
  PlaceMemoryRecord,
  TravelCorridorMemory,
} from "./types";
import type { TileId } from "../core/types";
import type {
  BroadWaterRole,
  CompressedKnownTileSummary,
  KnownAreaSummary,
  KnowledgeSourceKind,
  KnownTileRecord,
} from "../knowledge/types";
import { getNeighborTiles, getTile } from "../world/generate";
import type { Tile, WorldAuditOptions, WorldState } from "../world/types";
// CORRECTION-23G §11 — audit-only. Both return `false` when no audit has registered a
// donor-place set, which is every production, worker and UI path.
import {
  hasProtectedDonorPlaces,
  isProtectedDonorPlace,
} from "../diagnostics/verificationScheduleReplay";

const MAX_EXACT_KNOWN_TILES = 72;
const MAX_EXACT_PLACE_MEMORIES = 72;
const MAX_EXACT_CORRIDORS = 36;
const MAX_COMPRESSED_KNOWN_SUMMARIES = 40;
const MAX_COMPRESSED_AREA_SUMMARIES = 40;
const MAX_COMPRESSED_CORRIDOR_SUMMARIES = 32;
const RECENT_MEMORY_TICK_WINDOW = 96;

export function compressBandMemoryState(world: WorldState, band: Band): Band {
  if (world.time.tick % 4 !== 0) {
    return band;
  }

  const knownCount = Object.keys(band.knowledge.observedTiles).length;
  const placeMemoryCount = Object.keys(band.placeMemory).length;
  const corridorCount = Object.keys(band.travelCorridors).length;

  if (
    knownCount <= MAX_EXACT_KNOWN_TILES &&
    placeMemoryCount <= MAX_EXACT_PLACE_MEMORIES &&
    corridorCount <= MAX_EXACT_CORRIDORS
  ) {
    return band;
  }

  const knownRecords = Object.values(band.knowledge.observedTiles);
  const placeMemories = Object.values(band.placeMemory);
  const corridors = Object.values(band.travelCorridors);

  const retainedKnownTileIds = selectRetainedKnownTileIds(world, band, knownRecords);
  const compressedKnownRecords = knownRecords.filter((record) => !retainedKnownTileIds.has(record.tileId));
  const retainedObservedTiles = knownRecords
    .filter((record) => retainedKnownTileIds.has(record.tileId))
    .map((record) => [record.tileId, record] as const);
  const retainedPlaceMemoryIds = selectRetainedPlaceMemoryIds(band, retainedKnownTileIds, placeMemories);
  const compressedPlaceMemories = placeMemories.filter((memory) => !retainedPlaceMemoryIds.has(memory.tileId));
  const retainedPlaceMemories = placeMemories
    .filter((memory) => retainedPlaceMemoryIds.has(memory.tileId))
    .map((memory) => [memory.tileId, memory] as const);
  const retainedCorridors = selectRetainedCorridors(corridors);
  const retainedCorridorIds = new Set(retainedCorridors.map((corridor) => corridor.id));
  const compressedCorridors = corridors.filter((corridor) => !retainedCorridorIds.has(corridor.id));

  return {
    ...band,
    knowledge: {
      ...band.knowledge,
      observedTiles: Object.fromEntries(retainedObservedTiles) as Readonly<Record<TileId, KnownTileRecord>>,
      compressedKnownTileSummaries: appendCompressedKnownSummary(
        band.knowledge.compressedKnownTileSummaries ?? [],
        world,
        band,
        compressedKnownRecords,
      ),
      knownAreaSummaries: appendKnownAreaSummary(
        band.knowledge.knownAreaSummaries ?? [],
        world,
        band,
        compressedKnownRecords,
        compressedPlaceMemories,
      ),
    },
    placeMemory: Object.fromEntries(retainedPlaceMemories) as Readonly<Record<TileId, PlaceMemoryRecord>>,
    travelCorridors: Object.fromEntries(
      retainedCorridors.map((corridor) => [corridor.id, corridor] as const),
    ) as Band["travelCorridors"],
    compressedCorridorSummaries: appendCompressedCorridorSummary(
      band.compressedCorridorSummaries ?? [],
      world,
      band,
      compressedCorridors,
    ),
  };
}

/**
 * CORRECTION-23E §12 — AUDIT-ONLY retention counterfactuals (K1-K5).
 *
 * These exist to separate bad PRIORITISATION from raw CAPACITY pressure. They are read only
 * here, are undefined in every normal world, and §16 forbids promoting any of them to
 * production in this pass. K0 is production: no arm set.
 */
function isSettledVerifiedRecord(record: KnownTileRecord): boolean {
  return (record.verificationDisposition ?? []).some(
    (entry) => entry.outcome === "confirmed" || entry.outcome === "negative",
  );
}

function selectRetainedKnownTileIds(
  world: WorldState,
  band: Band,
  records: readonly KnownTileRecord[],
): Set<TileId> {
  const arm = world.auditOptions?.placeRetentionArm;
  const capacity =
    arm === "capacity_only"
      ? Math.max(MAX_EXACT_KNOWN_TILES, Math.floor(world.auditOptions?.placeRetentionCapacity ?? 288))
      : MAX_EXACT_KNOWN_TILES;
  // K5 — the inherited mandatory set (local ring, crossing endpoints, important water,
  // valenced places) stops consuming capacity, so scored records compete for all of it. The
  // band's own position is still kept: forgetting where you are standing is not forgetting.
  const mandatory =
    arm === "no_inherited_mandatory"
      ? new Set<TileId>([band.position])
      : new Set<TileId>([
          band.position,
          ...getLocalTileIds(world, band.position),
          ...getCrossingEndpointIds(band),
        ]);

  if (arm !== "no_inherited_mandatory") {
    for (const record of records) {
      const tile = getTile(world, record.tileId);
      const memory = band.placeMemory[record.tileId];

      if (
        tile !== undefined &&
        (isImportantWaterRecord(record, tile) ||
          memory?.isReturnPlace === true ||
          memory?.valences.includes("avoid_place") === true ||
          memory?.valences.includes("risky") === true ||
          memory?.valences.includes("depleted") === true)
      ) {
        mandatory.add(record.tileId);
      }
    }
  }

  // CORRECTION-23G §11 G6 — SPARSE DONOR-PLACE RETENTION, WITHOUT LAUNCHING ANYTHING.
  //
  // The question this answers is narrow: can RETAINING the same places substitute for
  // repeatedly WALKING to them? The protected set is exactly the places the F1 donor schedule
  // selected — a list the donor BAND itself chose from its own knowledge, not a list derived
  // from hidden ecology — and nothing else. It is audit-only, absent in every normal world,
  // and it does not touch capacity, the scored ordering, or the inherited mandatory set.
  if (hasProtectedDonorPlaces()) {
    for (const record of records) {
      if (isProtectedDonorPlace(record.tileId)) {
        mandatory.add(record.tileId);
      }
    }
  }

  // K1-K3 — three DIFFERENT answers to "which verified place deserves protection", so the
  // §11 question (is this forgetting legitimate?) is tested rather than assumed.
  if (arm === "protect_settled_verification") {
    for (const record of records) {
      if (isSettledVerifiedRecord(record)) {
        mandatory.add(record.tileId);
      }
    }
  } else if (arm === "protect_actionable_verified") {
    for (const record of records) {
      // Only a verified place that is still a live destination candidate: promising enough
      // to be chosen, not already exhausted.
      if (
        isSettledVerifiedRecord(record) &&
        (record.observedRichness ?? 0) >= 0.3 &&
        (record.observedWaterAccess ?? 0) >= 0.2
      ) {
        mandatory.add(record.tileId);
      }
    }
  } else if (arm === "protect_active_route_verified") {
    const activeRouteTiles = new Set<TileId>(
      band.expeditions?.flatMap((expedition) => expedition.routeTileIds ?? []) ?? [],
    );

    for (const record of records) {
      if (
        isSettledVerifiedRecord(record) &&
        (activeRouteTiles.has(record.tileId) ||
          world.time.tick - Number(record.lastObservedAt.tick) <= RECENT_MEMORY_TICK_WINDOW)
      ) {
        mandatory.add(record.tileId);
      }
    }
  }

  const sorted = [...records]
    .sort((left, right) => {
      const leftScore = getKnownRetentionScore(world, band, left, mandatory.has(left.tileId));
      const rightScore = getKnownRetentionScore(world, band, right, mandatory.has(right.tileId));

      return rightScore === leftScore
        ? String(left.tileId).localeCompare(String(right.tileId))
        : rightScore - leftScore;
    });
  const retained = new Set<TileId>();

  for (const record of sorted) {
    if (mandatory.has(record.tileId) || retained.size < capacity) {
      retained.add(record.tileId);
    }
  }

  return retained;
}

/**
 * CORRECTION-23E §10/§17 — READ-ONLY VIEW OF THE RETENTION AUTHORITY.
 *
 * §10 requires the eviction algorithm's priorities to be INVENTORIED rather than described,
 * and the §3 rules forbid trusting a name or a comment as proof of behaviour. This returns
 * exactly what `selectRetainedKnownTileIds` would decide right now, computed by the same
 * functions production uses — no reimplementation, no second copy of the scoring.
 *
 * It reads only band knowledge and world tiles, writes nothing, and is never called from a
 * decision path. The projection layer and the audits are its only consumers.
 */
export interface KnownRetentionAuditRow {
  readonly tileId: TileId;
  readonly score: number;
  readonly mandatory: boolean;
  readonly rank: number;
  readonly retained: boolean;
  readonly visits: number;
  readonly confidence: number;
  readonly ticksSinceLastObserved: number;
  readonly observedWaterAccess: number;
  readonly knowledgeSource: KnowledgeSourceKind;
  readonly acquisition?: KnownTileRecord["acquisition"];
  readonly verificationDispositionCount: number;
  readonly hasSettledDisposition: boolean;
}

export interface KnownRetentionAuditView {
  readonly capacity: number;
  readonly knownCount: number;
  readonly mandatoryCount: number;
  readonly retainedCount: number;
  readonly compressionWouldRun: boolean;
  readonly rows: readonly KnownRetentionAuditRow[];
}

export function deriveKnownRetentionAuditView(
  world: WorldState,
  band: Band,
): KnownRetentionAuditView {
  const records = Object.values(band.knowledge.observedTiles);
  const retained = selectRetainedKnownTileIds(world, band, records);
  const arm = world.auditOptions?.placeRetentionArm;
  const capacity =
    arm === "capacity_only"
      ? Math.max(MAX_EXACT_KNOWN_TILES, Math.floor(world.auditOptions?.placeRetentionCapacity ?? 288))
      : MAX_EXACT_KNOWN_TILES;

  const scored = records
    .map((record) => {
      const mandatory = isMandatoryForAudit(world, band, record, arm);
      const disposition = record.verificationDisposition ?? [];

      return {
        tileId: record.tileId,
        score: round2(getKnownRetentionScore(world, band, record, mandatory)),
        mandatory,
        retained: retained.has(record.tileId),
        visits: record.visits,
        confidence: round2(record.confidence),
        ticksSinceLastObserved: Number(world.time.tick) - Number(record.lastObservedAt.tick),
        observedWaterAccess: round2(record.observedWaterAccess ?? 0),
        knowledgeSource: record.knowledgeSource,
        ...(record.acquisition === undefined ? {} : { acquisition: record.acquisition }),
        verificationDispositionCount: disposition.length,
        hasSettledDisposition: disposition.some(
          (entry) => entry.outcome === "confirmed" || entry.outcome === "negative",
        ),
      };
    })
    .sort((left, right) =>
      right.score === left.score
        ? String(left.tileId).localeCompare(String(right.tileId))
        : right.score - left.score,
    );

  return {
    capacity,
    knownCount: records.length,
    mandatoryCount: scored.filter((row) => row.mandatory).length,
    retainedCount: retained.size,
    compressionWouldRun: world.time.tick % 4 === 0 && records.length > MAX_EXACT_KNOWN_TILES,
    rows: scored.map((row, index) => ({ ...row, rank: index + 1 })),
  };
}

/** The mandatory predicate, in exactly the composition `selectRetainedKnownTileIds` applies. */
function isMandatoryForAudit(
  world: WorldState,
  band: Band,
  record: KnownTileRecord,
  arm: WorldAuditOptions["placeRetentionArm"],
): boolean {
  if (arm === "no_inherited_mandatory") {
    return record.tileId === band.position;
  }

  if (
    record.tileId === band.position ||
    getLocalTileIds(world, band.position).includes(record.tileId) ||
    getCrossingEndpointIds(band).includes(record.tileId)
  ) {
    return true;
  }

  const tile = getTile(world, record.tileId);
  const memory = band.placeMemory[record.tileId];

  return (
    tile !== undefined &&
    (isImportantWaterRecord(record, tile) ||
      memory?.isReturnPlace === true ||
      memory?.valences.includes("avoid_place") === true ||
      memory?.valences.includes("risky") === true ||
      memory?.valences.includes("depleted") === true)
  );
}

function selectRetainedPlaceMemoryIds(
  band: Band,
  retainedKnownTileIds: ReadonlySet<TileId>,
  memories: readonly PlaceMemoryRecord[],
): Set<TileId> {
  const sorted = [...memories].sort((left, right) => {
    const leftScore = getPlaceRetentionScore(left, retainedKnownTileIds.has(left.tileId));
    const rightScore = getPlaceRetentionScore(right, retainedKnownTileIds.has(right.tileId));

    return rightScore === leftScore
      ? String(left.tileId).localeCompare(String(right.tileId))
      : rightScore - leftScore;
  });
  const retained = new Set<TileId>();

  for (const memory of sorted) {
    if (retainedKnownTileIds.has(memory.tileId) || retained.size < MAX_EXACT_PLACE_MEMORIES) {
      retained.add(memory.tileId);
    }
  }

  for (const tileId of getCrossingEndpointIds(band)) {
    retained.add(tileId);
  }

  return retained;
}

function selectRetainedCorridors(
  corridors: readonly TravelCorridorMemory[],
): readonly TravelCorridorMemory[] {
  if (corridors.length <= MAX_EXACT_CORRIDORS) {
    return corridors;
  }

  return [...corridors]
    .sort((left, right) => {
      const leftScore = left.useCount * 0.7 + left.confidence * 0.3 + left.lastUsedAt.tick * 0.0005;
      const rightScore = right.useCount * 0.7 + right.confidence * 0.3 + right.lastUsedAt.tick * 0.0005;

      return rightScore === leftScore
        ? String(left.id).localeCompare(String(right.id))
        : rightScore - leftScore;
    })
    .slice(0, MAX_EXACT_CORRIDORS);
}

function appendCompressedKnownSummary(
  existing: readonly CompressedKnownTileSummary[],
  world: WorldState,
  band: Band,
  records: readonly KnownTileRecord[],
): readonly CompressedKnownTileSummary[] {
  if (records.length === 0) {
    return existing;
  }

  return [...existing, buildCompressedKnownSummary(world, band, records)]
    .slice(-MAX_COMPRESSED_KNOWN_SUMMARIES);
}

function appendKnownAreaSummary(
  existing: readonly KnownAreaSummary[],
  world: WorldState,
  band: Band,
  records: readonly KnownTileRecord[],
  memories: readonly PlaceMemoryRecord[],
): readonly KnownAreaSummary[] {
  if (records.length === 0 && memories.length === 0) {
    return existing;
  }

  const sourceRecords = records.length > 0
    ? records
    : memories
      .map((memory) => band.knowledge.observedTiles[memory.tileId])
      .filter((record): record is KnownTileRecord => record !== undefined);

  if (sourceRecords.length === 0) {
    return existing;
  }

  return [...existing, buildKnownAreaSummary(world, band, sourceRecords)]
    .slice(-MAX_COMPRESSED_AREA_SUMMARIES);
}

function appendCompressedCorridorSummary(
  existing: readonly CompressedCorridorSummary[],
  world: WorldState,
  band: Band,
  corridors: readonly TravelCorridorMemory[],
): readonly CompressedCorridorSummary[] {
  if (corridors.length === 0) {
    return existing;
  }

  const lastUsed = corridors.reduce((latest, corridor) =>
    corridor.lastUsedAt.tick > latest.tick ? corridor.lastUsedAt : latest,
    corridors[0]?.lastUsedAt ?? world.time,
  );
  const averageConfidence = corridors.reduce((total, corridor) => total + corridor.confidence, 0) / corridors.length;

  const summary: CompressedCorridorSummary = {
    id: `compressed-corridor:${band.id}:${world.time.tick}:${existing.length}`,
    corridorCount: corridors.length,
    sourceKnowledgeTypes: ["personally_observed"],
    confidence: round2(averageConfidence),
    lastUsedAt: lastUsed,
    broadCorridorRoles: getBroadCorridorRoles(world, corridors),
    canInfluenceDecisions: false,
    influenceMode: "ui_debug_only",
  };

  return [...existing, summary].slice(-MAX_COMPRESSED_CORRIDOR_SUMMARIES);
}

function buildCompressedKnownSummary(
  world: WorldState,
  band: Band,
  records: readonly KnownTileRecord[],
): CompressedKnownTileSummary {
  return {
    id: `compressed-known:${band.id}:${world.time.tick}:${records.length}`,
    tileCount: records.length,
    sourceKnowledgeTypes: getSourceTypes(records),
    confidence: round2(getAverageConfidence(records)),
    lastObservedAt: getLatestObservedAt(records),
    seasonsObserved: getSeasons(records),
    broadTerrainRoles: getTerrainRoles(world, records),
    broadWaterRoles: getWaterRoles(world, records),
    canInfluenceDecisions: false,
    influenceMode: "ui_debug_only",
  };
}

function buildKnownAreaSummary(
  world: WorldState,
  band: Band,
  records: readonly KnownTileRecord[],
): KnownAreaSummary {
  return {
    id: `known-area:${band.id}:${world.time.tick}:${records.length}`,
    tileCount: records.length,
    sourceKnowledgeTypes: getSourceTypes(records),
    confidence: round2(getAverageConfidence(records)),
    lastObservedAt: getLatestObservedAt(records),
    seasonsObserved: getSeasons(records),
    broadTerrainRoles: getTerrainRoles(world, records),
    broadWaterRoles: getWaterRoles(world, records),
    canInfluenceDecisions: false,
    influenceMode: "ui_debug_only",
  };
}

function getKnownRetentionScore(
  world: WorldState,
  band: Band,
  record: KnownTileRecord,
  mandatory: boolean,
): number {
  const tile = getTile(world, record.tileId);
  const memory = band.placeMemory[record.tileId];
  const recency = clamp01((RECENT_MEMORY_TICK_WINDOW - (world.time.tick - record.lastObservedAt.tick)) / RECENT_MEMORY_TICK_WINDOW);
  const waterValue = (record.observedWaterAccess ?? 0) * 0.32 + record.observedAquaticPotential * 0.22;
  const memoryValue =
    (memory?.attachment ?? 0) * 0.52 +
    (memory?.isReturnPlace === true ? 0.42 : 0) +
    (memory?.valences.includes("risky") === true ? 0.34 : 0) +
    (memory?.valences.includes("avoid_place") === true ? 0.38 : 0) +
    (memory?.valences.includes("depleted") === true ? 0.32 : 0);

  return (
    (mandatory ? 10 : 0) +
    record.visits * 0.42 +
    record.confidence * 0.28 +
    recency * 0.5 +
    waterValue +
    memoryValue +
    (tile !== undefined && isHighValueWaterTile(tile) ? 0.5 : 0) +
    (record.knowledgeSource === "personally_observed" ? 0.12 : -0.08)
  );
}

function getPlaceRetentionScore(
  memory: PlaceMemoryRecord,
  retainedKnownTile: boolean,
): number {
  return (
    (retainedKnownTile ? 1.2 : 0) +
    memory.attachment * 0.6 +
    memory.confidence * 0.24 +
    memory.visitCount * 0.08 +
    (memory.isReturnPlace ? 0.46 : 0) +
    (memory.valences.includes("risky") || memory.valences.includes("avoid_place") ? 0.38 : 0) +
    (memory.valences.includes("depleted") ? 0.34 : 0) +
    memory.lastObservedAt.tick * 0.0005
  );
}

function getLocalTileIds(world: WorldState, tileId: TileId): readonly TileId[] {
  const output = new Set<TileId>([tileId]);

  for (const neighbor of getNeighborTiles(world, tileId)) {
    output.add(neighbor.id);

    for (const secondRing of getNeighborTiles(world, neighbor.id)) {
      output.add(secondRing.id);
    }
  }

  return [...output];
}

function getCrossingEndpointIds(band: Band): readonly TileId[] {
  const output = new Set<TileId>();

  for (const crossing of Object.values(band.crossingMemories)) {
    output.add(crossing.crossingTileA);
    output.add(crossing.crossingTileB);
  }

  return [...output];
}

function isImportantWaterRecord(record: KnownTileRecord, tile: Tile): boolean {
  return (
    record.visits > 0 &&
    ((record.observedWaterAccess ?? 0) >= 0.68 ||
      record.observedAquaticPotential >= 0.62 ||
      isHighValueWaterTile(tile))
  );
}

function isHighValueWaterTile(tile: Tile): boolean {
  return (
    tile.isRiver ||
    tile.isRiverbank ||
    tile.isFloodplain ||
    tile.isCoastal ||
    tile.isConfluence ||
    tile.isEstuary ||
    tile.isMarshChannel ||
    tile.terrainKind === "wetlands" ||
    tile.terrainKind === "lake"
  );
}

function getSourceTypes(records: readonly KnownTileRecord[]): readonly KnowledgeSourceKind[] {
  return addUnique(records.map((record) => record.knowledgeSource));
}

function getAverageConfidence(records: readonly KnownTileRecord[]): number {
  return records.reduce((total, record) => total + record.confidence, 0) / Math.max(1, records.length);
}

function getLatestObservedAt(records: readonly KnownTileRecord[]): KnownTileRecord["lastObservedAt"] {
  const first = records[0];

  if (first === undefined) {
    throw new Error("Cannot summarize empty known tile records");
  }

  return records.reduce((latest, record) =>
    record.lastObservedAt.tick > latest.tick ? record.lastObservedAt : latest,
    first.lastObservedAt,
  );
}

function getSeasons(records: readonly KnownTileRecord[]): readonly KnownTileRecord["seasonsObserved"][number][] {
  return addUnique(records.flatMap((record) => record.seasonsObserved));
}

function getTerrainRoles(
  world: WorldState,
  records: readonly KnownTileRecord[],
): readonly string[] {
  const roles = records.map((record) => getTile(world, record.tileId)?.terrainKind ?? "unknown");

  return addUnique(roles).slice(0, 8);
}

function getWaterRoles(
  world: WorldState,
  records: readonly KnownTileRecord[],
): readonly BroadWaterRole[] {
  return addUnique(records.map((record) => {
    const tile = getTile(world, record.tileId);

    if (tile === undefined) {
      return "unknown";
    }

    return getWaterRole(tile);
  })).slice(0, 8);
}

function getWaterRole(tile: Tile): BroadWaterRole {
  if (tile.isRiver || tile.isRiverbank || tile.isFloodplain || tile.isConfluence) {
    return "river";
  }

  if (tile.isCoastal || tile.isEstuary) {
    return "coast";
  }

  if (tile.terrainKind === "lake") {
    return "lake";
  }

  if (tile.terrainKind === "wetlands" || tile.isMarshChannel) {
    return "wetland";
  }

  return "dry";
}

function getBroadCorridorRoles(
  world: WorldState,
  corridors: readonly TravelCorridorMemory[],
): readonly string[] {
  return addUnique(corridors.flatMap((corridor) => {
    const fromTile = getTile(world, corridor.fromTileId);
    const toTile = getTile(world, corridor.toTileId);

    return [fromTile, toTile]
      .filter((tile): tile is Tile => tile !== undefined)
      .map((tile) => getWaterRole(tile));
  })).slice(0, 8);
}

function addUnique<TValue>(values: readonly TValue[]): readonly TValue[] {
  const output: TValue[] = [];

  for (const value of values) {
    if (!output.includes(value)) {
      output.push(value);
    }
  }

  return output;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
