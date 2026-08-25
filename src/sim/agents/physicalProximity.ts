import type { TileId } from "../core/types";
import { getTile } from "../world/generate";
import { getEuclideanPhysicalDistanceKm } from "../world/spatialGeometry";
import type { WorldState } from "../world/types";

// PROVENANCE D — provisional physical compatibility calibrations for local evidence.
// The previous implementation used 2/3/4 cells on the canonical 1.5-km raster. These
// explicit km thresholds preserve that local/extended/known-kin ordering without making
// raster resolution a behavioral authority.
export const LOCAL_EVIDENCE_NEAR_KM = 3;
export const LOCAL_EVIDENCE_EXTENDED_KM = 4.5;
export const KNOWN_KIN_NEARBY_KM = 6;

export function getPhysicalTileDistanceKm(
  world: WorldState,
  firstTileId: TileId,
  secondTileId: TileId,
): number | undefined {
  const first = getTile(world, firstTileId);
  const second = getTile(world, secondTileId);
  return first === undefined || second === undefined
    ? undefined
    : getEuclideanPhysicalDistanceKm(world.config, first.coord, second.coord);
}

export function isWithinPhysicalProximity(
  world: WorldState,
  firstTileId: TileId,
  secondTileId: TileId,
  maxDistanceKm: number,
): boolean {
  const distanceKm = getPhysicalTileDistanceKm(world, firstTileId, secondTileId);
  return distanceKm !== undefined && distanceKm <= maxDistanceKm;
}
