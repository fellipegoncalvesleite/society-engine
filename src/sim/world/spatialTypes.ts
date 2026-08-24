export type WorldCoordinateFrame = "cartesian_cell_centers";
export type WorldConnectivity = "cardinal_4";

/**
 * Physical interpretation of one world's simulation grid.
 *
 * SCALE-1 keeps this world-specific even though WORLD-M0 will eventually emit
 * canonical 1 km cells. Temporary authored Map 2 remains 1.5 km during migration.
 */
export interface WorldSpatialReference {
  readonly cellWidthKm: number;
  readonly cellHeightKm: number;
  readonly coordinateFrame: WorldCoordinateFrame;
  readonly connectivity: WorldConnectivity;
}

export interface PhysicalPointKm {
  readonly xKm: number;
  readonly yKm: number;
}

export interface WorldPhysicalExtentKm {
  readonly widthKm: number;
  readonly heightKm: number;
  readonly areaKm2: number;
}

/** Inclusive integer grid bounds used only to bound a later exact physical filter. */
export interface RasterWindow {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}
