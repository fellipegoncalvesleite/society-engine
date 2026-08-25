import type { ReasonId, TileId } from "../core/types";
import { getTile, getTileAtCoord } from "../world/generate";
import {
  getEuclideanPhysicalDistanceKm,
  getRasterWindowForPhysicalRadius,
} from "../world/spatialGeometry";
import type { Tile, WorldState } from "../world/types";
import type {
  Band,
  LandscapeVisibilityCueKind,
  LandscapeVisibilityDirection,
  VisibleLandscapeCue,
} from "./types";

/**
 * SCALE-1 Task 5 — broad landscape cues are physically ranged in kilometres.
 *
 * These are SCALE-1 calibrated/model physical ranges: 15 km preserves the legacy
 * Map-2 compatibility intent and 4.5 km preserves the former distant-cue floor while
 * making both meanings raster-independent. They are NOT universal human biological
 * visibility constants. WORLD-M0/later empirical calibration may refine detectability
 * from target size/elevation, observer elevation, vegetation, atmosphere/weather, and
 * the future physical substrate; it must not reintroduce a cell-count authority.
 */
export const LANDSCAPE_VISIBILITY_MAX_RANGE_KM = 15;
/** Nearby country is learned through direct observation/travel rather than emitted as a distant cue. */
export const LANDSCAPE_VISIBILITY_MIN_RANGE_KM = 4.5;
const LANDSCAPE_NEAR_MAX_KM = 6;
const LANDSCAPE_MIDDLE_MAX_KM = 10.5;
const VISIBLE_CUE_LIMIT = 6;
const VISIBILITY_REFRESH_TICKS = 2;
const STALE_VISIBLE_CUE_TICKS = 16;

interface CueCandidate {
  readonly tile: Tile;
  readonly kind: LandscapeVisibilityCueKind;
  readonly direction: LandscapeVisibilityDirection;
  /** Topological/debug telemetry only. Never used as the physical range authority. */
  readonly distanceTiles: number;
  readonly distanceKm: number;
  readonly confidence: number;
  readonly blockedByTerrain: boolean;
}

export function advanceVisibleLandscapeCues(world: WorldState, band: Band): readonly VisibleLandscapeCue[] {
  const previous = band.visibleLandscapeCues ?? [];
  if (previous.some((cue) => cue.tick === world.time.tick)) {
    return previous;
  }

  const phase = deterministicIndex(String(band.id), VISIBILITY_REFRESH_TICKS);

  if ((Number(world.time.tick) + phase) % VISIBILITY_REFRESH_TICKS !== 0) {
    return previous
      .filter((cue) => Number(world.time.tick) - Number(cue.tick) <= STALE_VISIBLE_CUE_TICKS)
      .map((cue) => ({
        ...cue,
        status:
          Number(world.time.tick) - Number(cue.tick) > STALE_VISIBLE_CUE_TICKS / 2
            ? "stale"
            : cue.status,
      }));
  }

  const currentTile = getTile(world, band.position);
  if (currentTile === undefined) {
    return previous.filter((cue) => Number(world.time.tick) - Number(cue.tick) <= STALE_VISIBLE_CUE_TICKS);
  }

  const observed = band.knowledge.observedTiles;
  const candidates = collectCueCandidates(world, currentTile)
    .filter((candidate) => observed[candidate.tile.id] === undefined)
    .sort(compareCueCandidates);
  const merged = new Map<string, VisibleLandscapeCue>();

  for (const candidate of candidates) {
    if (merged.size >= VISIBLE_CUE_LIMIT) {
      break;
    }
    const key = cueMergeKey(candidate);
    if (merged.has(key)) {
      continue;
    }
    const prior = previous.find(
      (cue) =>
        cue.kind === candidate.kind &&
        cue.direction === candidate.direction &&
        distanceBand(getCuePhysicalDistanceKm(world, cue)) === distanceBand(candidate.distanceKm),
    );
    merged.set(key, makeVisibleCue(world, band, currentTile, candidate, prior));
  }

  for (const oldCue of previous) {
    if (merged.size >= VISIBLE_CUE_LIMIT) {
      break;
    }
    if (Number(world.time.tick) - Number(oldCue.tick) > STALE_VISIBLE_CUE_TICKS) {
      continue;
    }
    const key = `${oldCue.kind}:${oldCue.direction}:${distanceBand(getCuePhysicalDistanceKm(world, oldCue))}`;
    if (merged.has(key)) {
      continue;
    }
    merged.set(key, {
      ...oldCue,
      status: "stale",
    });
  }

  return [...merged.values()].sort((left, right) => right.confidence - left.confidence || left.cueId.localeCompare(right.cueId));
}

/**
 * Physical range -> bounded raster window -> exact physical filter -> LOS/cue logic.
 * The rectangular window is only an optimization. Corners outside the physical circle
 * are rejected before classification.
 */
function collectCueCandidates(world: WorldState, currentTile: Tile): readonly CueCandidate[] {
  const candidates: CueCandidate[] = [];
  const window = getRasterWindowForPhysicalRadius(
    world.config,
    currentTile.coord,
    LANDSCAPE_VISIBILITY_MAX_RANGE_KM,
  );

  for (let y = window.minY; y <= window.maxY; y += 1) {
    for (let x = window.minX; x <= window.maxX; x += 1) {
      const dx = x - currentTile.coord.x;
      const dy = y - currentTile.coord.y;
      if (dx === 0 && dy === 0) {
        continue;
      }

      const tile = getTileAtCoord(world, { x, y });
      if (tile === undefined) {
        continue;
      }

      const distanceKm = getEuclideanPhysicalDistanceKm(world.config, currentTile.coord, tile.coord);
      if (
        distanceKm < LANDSCAPE_VISIBILITY_MIN_RANGE_KM ||
        distanceKm > LANDSCAPE_VISIBILITY_MAX_RANGE_KM
      ) {
        continue;
      }

      const kind = classifyVisibleCue(currentTile, tile, distanceKm);
      if (kind === undefined) {
        continue;
      }

      // A terrain-blocked line is physically undetected, not a low-confidence cue.
      const blockedByTerrain = isLineBlocked(world, currentTile, tile);
      if (blockedByTerrain) {
        continue;
      }

      const confidence = visibleCueConfidence(currentTile, tile, distanceKm);
      if (confidence < 0.34) {
        continue;
      }

      candidates.push({
        tile,
        kind,
        direction: directionFromDelta(dx, dy),
        distanceTiles: Math.max(Math.abs(dx), Math.abs(dy)),
        distanceKm,
        confidence,
        blockedByTerrain,
      });
    }
  }

  return candidates;
}

function classifyVisibleCue(
  currentTile: Tile,
  target: Tile,
  distanceKm: number,
): LandscapeVisibilityCueKind | undefined {
  if (target.isEstuary || (target.isConfluence && target.isFloodplain)) {
    return "delta_like_area";
  }
  if (target.terrainKind === "lake" || (target.isAquatic && target.isRiver === false && target.isCoastal === false)) {
    return "lake_shore_visible";
  }
  if (target.terrainKind === "wetlands" || target.isMarshChannel) {
    return "visible_wetland";
  }
  if (target.isRiver || target.isRiverbank || target.hasCreek === true) {
    return "river_or_tributary_corridor";
  }
  if (target.isCoastal || target.isAquatic || target.resourceProfile.waterAccess > 0.7) {
    return "visible_water";
  }
  if (target.terrainKind === "river_valley" || target.isFloodplain) {
    return "open_valley";
  }
  if (
    (currentTile.isRiverbank || currentTile.isFloodplain || currentTile.isRiver) &&
    (target.isRiverbank || target.isFloodplain || target.isRiver) &&
    distanceKm >= LANDSCAPE_NEAR_MAX_KM
  ) {
    return "opposite_bank";
  }
  if (target.terrainKind === "hills" && target.movementCost <= 1.9 && target.elevation > currentTile.elevation + 0.05) {
    return "pass_or_saddle";
  }
  if (target.terrainKind === "mountains" || target.elevation > currentTile.elevation + 0.18) {
    return "higher_ground";
  }
  if (target.terrainKind === "desert" || target.riskProfile.droughtRisk > 0.68) {
    return "dry_or_barren_country";
  }
  if (
    target.resourceProfile.waterAccess > currentTile.resourceProfile.waterAccess + 0.18 ||
    target.terrainKind === "forest" ||
    (target.resourceProfile.baseRichness > currentTile.resourceProfile.baseRichness + 0.22 &&
      target.riskProfile.droughtRisk < 0.55)
  ) {
    return "greener_lowland";
  }

  return undefined;
}

/**
 * Physical detectability only. Need/crowding/stress deliberately do not appear here:
 * those belong in attention and decision salience after a cue has been physically detected.
 */
function visibleCueConfidence(
  currentTile: Tile,
  target: Tile,
  distanceKm: number,
): number {
  const rangeSpanKm = LANDSCAPE_VISIBILITY_MAX_RANGE_KM - LANDSCAPE_VISIBILITY_MIN_RANGE_KM;
  const distanceFactor = clamp01(
    1 - (distanceKm - LANDSCAPE_VISIBILITY_MIN_RANGE_KM) / Math.max(1e-9, rangeSpanKm),
  );
  const elevationFactor = clamp01(0.44 + currentTile.elevation * 0.3 + Math.max(0, target.elevation - currentTile.elevation) * 0.22);
  const waterSalience =
    target.isRiver ||
    target.isRiverbank ||
    target.isCoastal ||
    target.isAquatic ||
    target.terrainKind === "wetlands" ||
    target.terrainKind === "lake"
      ? 0.2
      : 0;
  return round2(clamp01(distanceFactor * 0.55 + elevationFactor * 0.25 + waterSalience));
}

function isLineBlocked(world: WorldState, from: Tile, to: Tile): boolean {
  const dx = to.coord.x - from.coord.x;
  const dy = to.coord.y - from.coord.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  if (steps <= 2) {
    return false;
  }

  const sightCeiling = Math.max(from.elevation, to.elevation) + 0.16;
  for (let step = 1; step < steps; step += 1) {
    const sample = getTileAtCoord(world, {
      x: Math.round(from.coord.x + (dx * step) / steps),
      y: Math.round(from.coord.y + (dy * step) / steps),
    });
    if (sample !== undefined && sample.elevation > sightCeiling && sample.terrainKind === "mountains") {
      return true;
    }
  }
  return false;
}

function makeVisibleCue(
  world: WorldState,
  band: Band,
  currentTile: Tile,
  candidate: CueCandidate,
  prior: VisibleLandscapeCue | undefined,
): VisibleLandscapeCue {
  const reasonId =
    `reason:visible_landscape:${String(band.id)}:${Number(world.time.tick)}:${candidate.kind}:${candidate.direction}` as ReasonId;
  return {
    cueId: `visible:${String(band.id)}:${candidate.kind}:${candidate.direction}:${distanceBand(candidate.distanceKm)}`,
    bandId: band.id,
    tick: world.time.tick,
    sourceTileId: currentTile.id,
    approximateTileId: candidate.tile.id,
    kind: candidate.kind,
    direction: candidate.direction,
    distanceTiles: candidate.distanceTiles,
    distanceKm: candidate.distanceKm,
    confidence: round2(Math.max(candidate.confidence, prior?.confidence ?? 0)),
    status: "unchecked",
    blockedByTerrain: candidate.blockedByTerrain,
    influencedScoutOrProbeCount: prior?.influencedScoutOrProbeCount ?? 0,
    noObservedTileCreated: true,
    noResourceUnlock: true,
    noDirectRelocation: true,
    reasonIds: [reasonId],
  };
}

function getCuePhysicalDistanceKm(world: WorldState, cue: VisibleLandscapeCue): number {
  if (Number.isFinite(cue.distanceKm)) {
    return cue.distanceKm;
  }

  // Defensive compatibility for an in-memory pre-Task-5 cue during hot reload. Recompute
  // from spatial authority; never reconstruct kilometres from a historical tile count.
  const from = getTile(world, cue.sourceTileId);
  const to = getTile(world, cue.approximateTileId);
  return from === undefined || to === undefined
    ? Number.POSITIVE_INFINITY
    : getEuclideanPhysicalDistanceKm(world.config, from.coord, to.coord);
}

function directionFromDelta(dx: number, dy: number): LandscapeVisibilityDirection {
  const angle = Math.atan2(dy, dx);
  const eighth = Math.round(angle / (Math.PI / 4));
  const normalized = (eighth + 8) % 8;
  const directions: readonly LandscapeVisibilityDirection[] = [
    "east",
    "southeast",
    "south",
    "southwest",
    "west",
    "northwest",
    "north",
    "northeast",
  ];
  return directions[normalized] ?? "east";
}

function compareCueCandidates(left: CueCandidate, right: CueCandidate): number {
  return (
    right.confidence - left.confidence ||
    left.distanceKm - right.distanceKm ||
    left.kind.localeCompare(right.kind) ||
    String(left.tile.id).localeCompare(String(right.tile.id))
  );
}

function cueMergeKey(candidate: CueCandidate): string {
  return `${candidate.kind}:${candidate.direction}:${distanceBand(candidate.distanceKm)}`;
}

function distanceBand(distanceKm: number): string {
  if (distanceKm <= LANDSCAPE_NEAR_MAX_KM) {
    return "near";
  }
  if (distanceKm <= LANDSCAPE_MIDDLE_MAX_KM) {
    return "middle";
  }
  return "far";
}

function deterministicIndex(key: string, modulo: number): number {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % Math.max(1, modulo);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * CORRECTION-26 — mark a visible-landscape cue as physically checked.
 *
 * This moved out of `rules/candidates/visibleLandscapeCandidate.ts` and changed meaning
 * with it. Before, a `logistical_probe` being SELECTED set the cue to `partly_checked` and
 * incremented `influencedScoutOrProbeCount`, so a cue nobody ever walked to was reported as
 * checked. It is now called by the daily executor on ARRIVAL, so the status describes a
 * real visit and the count means "a party actually went because of this cue".
 *
 * It lives here because `landscapeVisibility.ts` owns the cue state (it is the constructor
 * at `buildCueRecord`), and because the daily physical path is in `agents/` and must not
 * import from `rules/`.
 */
export function markVisibleLandscapeCueProbeChecked(
  band: Band,
  checkedTileId: TileId,
): readonly VisibleLandscapeCue[] | undefined {
  const cues = band.visibleLandscapeCues;

  if (cues === undefined) {
    return cues;
  }

  return cues.map((cue) =>
    cue.approximateTileId === checkedTileId
      ? {
          ...cue,
          status: "partly_checked",
          influencedScoutOrProbeCount: cue.influencedScoutOrProbeCount + 1,
        }
      : cue,
  );
}
