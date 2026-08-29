export type WorldM0M01FailureCode =
  | "INVALID_RECIPE"
  | "UNSUPPORTED_RECIPE_SCHEMA"
  | "UNSUPPORTED_GENERATOR_FAMILY"
  | "UNSUPPORTED_PHYSICAL_GENERATOR_VERSION"
  | "UNSUPPORTED_ECOLOGY_REALIZER_VERSION"
  | "UNSUPPORTED_REPAIR_POLICY_VERSION"
  | "UNSUPPORTED_NUMERIC_KERNEL_VERSION"
  | "INVALID_SPATIAL_EXTENT"
  | "MISSING_REQUIRED_ASSET"
  | "SELECTED_ML_ASSET_MISSING"
  | "ASSET_DIGEST_MISMATCH";

export type WorldM0M02FailureCode =
  | "M02_UNSUPPORTED_GENERATOR_MODE"
  | "M02_REQUIRED_ASSET_UNSUPPORTED"
  | "M02_ML_UNSUPPORTED"
  | "M02_CONTENT_MISSING"
  | "M02_CONTENT_DUPLICATE"
  | "M02_CONTENT_DIGEST_MISMATCH"
  | "M02_CONTENT_VERSION_UNSUPPORTED"
  | "M02_CONTENT_INVALID"
  | "M02_ANALYSIS_GRID_UNSUPPORTED"
  | "M02_TERRAIN_BOUNDS_INVALID"
  | "M02_ROUTING_UNRESOLVABLE"
  | "M02_DRAINAGE_CYCLE"
  | "M02_TERMINAL_INVALID"
  | "M02_BASIN_GEOMETRY_INVALID"
  | "M02_PROTECTED_BASIN_DESTROYED"
  | "M02_BOUND_EXCEEDED"
  | "M02_REPAIR_BUDGET_EXHAUSTED"
  | "M02_CANDIDATE_INVALID";

export type WorldM0FailureCode = WorldM0M01FailureCode | WorldM0M02FailureCode;

export interface WorldM0Failure {
  readonly code: WorldM0FailureCode;
  readonly path: string;
  readonly detail: string;
}

export type WorldM0M01Failure = WorldM0Failure;

export type WorldM0Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: WorldM0Failure };

export function worldM0Failure(
  code: WorldM0FailureCode,
  path: string,
  detail: string,
): WorldM0Result<never> {
  return { ok: false, error: { code, path, detail } };
}
