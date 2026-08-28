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

export interface WorldM0M01Failure {
  readonly code: WorldM0M01FailureCode;
  readonly path: string;
  readonly detail: string;
}

export type WorldM0Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: WorldM0M01Failure };

export function worldM0Failure(
  code: WorldM0M01FailureCode,
  path: string,
  detail: string,
): WorldM0Result<never> {
  return { ok: false, error: { code, path, detail } };
}
