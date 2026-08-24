import type { Coord } from "../core/types";
import type { WorldConfig } from "./types";
import type { PhysicalPointKm, RasterWindow, WorldPhysicalExtentKm } from "./spatialTypes";

export function getCellAreaKm2(config: WorldConfig): number {
  return config.spatial.cellWidthKm * config.spatial.cellHeightKm;
}

export function getWorldPhysicalExtentKm(config: WorldConfig): WorldPhysicalExtentKm {
  const widthKm = config.width * config.spatial.cellWidthKm;
  const heightKm = config.height * config.spatial.cellHeightKm;
  return { widthKm, heightKm, areaKm2: widthKm * heightKm };
}

export function getPhysicalCellCenterKm(config: WorldConfig, coord: Coord): PhysicalPointKm {
  return {
    xKm: (coord.x + 0.5) * config.spatial.cellWidthKm,
    yKm: (coord.y + 0.5) * config.spatial.cellHeightKm,
  };
}

export function getEuclideanPhysicalDistanceKm(config: WorldConfig, first: Coord, second: Coord): number {
  const left = getPhysicalCellCenterKm(config, first);
  const right = getPhysicalCellCenterKm(config, second);
  return Math.hypot(right.xKm - left.xKm, right.yKm - left.yKm);
}

export function getCardinalEdgeLengthKm(config: WorldConfig, from: Coord, to: Coord): number {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  if (dx + dy !== 1) {
    throw new Error(`Expected cardinally adjacent cells, got (${from.x},${from.y}) -> (${to.x},${to.y})`);
  }
  return dx === 1 ? config.spatial.cellWidthKm : config.spatial.cellHeightKm;
}

export function getRasterWindowForPhysicalRadius(
  config: WorldConfig,
  center: Coord,
  radiusKm: number,
): RasterWindow {
  const boundedRadius = Math.max(0, radiusKm);
  const xReach = Math.ceil(boundedRadius / config.spatial.cellWidthKm);
  const yReach = Math.ceil(boundedRadius / config.spatial.cellHeightKm);
  return {
    minX: Math.max(0, center.x - xReach),
    maxX: Math.min(config.width - 1, center.x + xReach),
    minY: Math.max(0, center.y - yReach),
    maxY: Math.min(config.height - 1, center.y + yReach),
  };
}

export function isWithinPhysicalRadius(
  config: WorldConfig,
  center: Coord,
  candidate: Coord,
  radiusKm: number,
): boolean {
  return getEuclideanPhysicalDistanceKm(config, center, candidate) <= Math.max(0, radiusKm);
}
