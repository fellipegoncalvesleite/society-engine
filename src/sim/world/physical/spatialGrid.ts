import type { WorldM0Result } from "./failures";
import { worldM0Failure } from "./failures";
import { hasExactWorldM0Keys, isWorldM0Record } from "./identity";
import type {
  WorldConnectivity,
  WorldCoordinateFrame,
  WorldPhysicalExtentKm,
  WorldSpatialReference,
} from "../spatialTypes";

export interface WorldM0SpatialRecipe {
  readonly gridSchema: "world-m0-grid/v1";
  readonly extentWidthMeters: number;
  readonly extentHeightMeters: number;
  readonly cellWidthMeters: number;
  readonly cellHeightMeters: number;
  readonly coordinateFrame: WorldCoordinateFrame;
  readonly connectivity: WorldConnectivity;
}

export interface WorldM0SpatialGridIdentity {
  readonly gridSchema: "world-m0-grid/v1";
  readonly extentWidthMeters: number;
  readonly extentHeightMeters: number;
  readonly columnCount: number;
  readonly rowCount: number;
  readonly spatialReference: WorldSpatialReference;
  readonly physicalExtentKm: WorldPhysicalExtentKm;
}

const SPATIAL_KEYS = [
  "gridSchema",
  "extentWidthMeters",
  "extentHeightMeters",
  "cellWidthMeters",
  "cellHeightMeters",
  "coordinateFrame",
  "connectivity",
] as const;

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    !Object.is(value, -0);
}

export function parseWorldM0SpatialRecipe(input: unknown): WorldM0Result<WorldM0SpatialRecipe> {
  if (!isWorldM0Record(input) || !hasExactWorldM0Keys(input, SPATIAL_KEYS)) {
    return worldM0Failure("INVALID_RECIPE", "spatial", "invalid spatial recipe shape");
  }
  if (input.gridSchema !== "world-m0-grid/v1") {
    return worldM0Failure("INVALID_RECIPE", "spatial.gridSchema", "unsupported grid schema");
  }
  if (input.coordinateFrame !== "cartesian_cell_centers") {
    return worldM0Failure("INVALID_RECIPE", "spatial.coordinateFrame", "unsupported coordinate frame");
  }
  if (input.connectivity !== "cardinal_4") {
    return worldM0Failure("INVALID_RECIPE", "spatial.connectivity", "unsupported connectivity");
  }
  const extentWidthMeters = input.extentWidthMeters;
  const extentHeightMeters = input.extentHeightMeters;
  const cellWidthMeters = input.cellWidthMeters;
  const cellHeightMeters = input.cellHeightMeters;
  if (!isPositiveSafeInteger(extentWidthMeters)) {
    return worldM0Failure("INVALID_SPATIAL_EXTENT", "spatial.extentWidthMeters", "expected positive safe integer meters");
  }
  if (!isPositiveSafeInteger(extentHeightMeters)) {
    return worldM0Failure("INVALID_SPATIAL_EXTENT", "spatial.extentHeightMeters", "expected positive safe integer meters");
  }
  if (!isPositiveSafeInteger(cellWidthMeters)) {
    return worldM0Failure("INVALID_SPATIAL_EXTENT", "spatial.cellWidthMeters", "expected positive safe integer meters");
  }
  if (!isPositiveSafeInteger(cellHeightMeters)) {
    return worldM0Failure("INVALID_SPATIAL_EXTENT", "spatial.cellHeightMeters", "expected positive safe integer meters");
  }
  return {
    ok: true,
    value: {
      gridSchema: input.gridSchema,
      extentWidthMeters,
      extentHeightMeters,
      cellWidthMeters,
      cellHeightMeters,
      coordinateFrame: input.coordinateFrame,
      connectivity: input.connectivity,
    },
  };
}

export function deriveWorldM0SpatialGridIdentity(
  spatial: WorldM0SpatialRecipe,
): WorldM0Result<WorldM0SpatialGridIdentity> {
  const validated = parseWorldM0SpatialRecipe(spatial);
  if (!validated.ok) return validated;
  const value = validated.value;
  if (value.extentWidthMeters % value.cellWidthMeters !== 0 ||
      value.extentHeightMeters % value.cellHeightMeters !== 0) {
    return worldM0Failure(
      "INVALID_SPATIAL_EXTENT",
      "spatial",
      "physical extent must divide exactly by strategic cell dimensions",
    );
  }

  const columnCount = value.extentWidthMeters / value.cellWidthMeters;
  const rowCount = value.extentHeightMeters / value.cellHeightMeters;
  const widthKm = value.extentWidthMeters / 1000;
  const heightKm = value.extentHeightMeters / 1000;

  return {
    ok: true,
    value: {
      gridSchema: value.gridSchema,
      extentWidthMeters: value.extentWidthMeters,
      extentHeightMeters: value.extentHeightMeters,
      columnCount,
      rowCount,
      spatialReference: {
        cellWidthKm: value.cellWidthMeters / 1000,
        cellHeightKm: value.cellHeightMeters / 1000,
        coordinateFrame: value.coordinateFrame,
        connectivity: value.connectivity,
      },
      physicalExtentKm: {
        widthKm,
        heightKm,
        areaKm2: widthKm * heightKm,
      },
    },
  };
}
