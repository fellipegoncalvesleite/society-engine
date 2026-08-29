import type { WorldM0Result } from "./failures";
import { worldM0Failure } from "./failures";
import type { WorldM0PhysicalConstantsV1 } from "./physicalConstants";

export interface TerrainScratchBudgetSnapshot {
  readonly maxBytes: number;
  readonly liveBytes: number;
  readonly peakBytes: number;
}

export interface TerrainScratchArrayRequest {
  readonly label: string;
  readonly kind: "u8" | "i32" | "f64";
  readonly length: number;
}

export interface TerrainScratchBudget {
  readonly snapshot: () => TerrainScratchBudgetSnapshot;
  readonly allocateBatch: (
    requests: readonly TerrainScratchArrayRequest[],
  ) => WorldM0Result<readonly (Uint8Array | Int32Array | Float64Array)[]>;
  readonly release: (label: string) => WorldM0Result<true>;
}

export interface TerrainScratchGrid {
  readonly width: number;
  readonly height: number;
  readonly cellSizeMeters: 250;
  readonly cellAreaM2: 62_500;
  readonly budget: TerrainScratchBudget;
  readonly elevationMeters: Float64Array;
  readonly landMask: Uint8Array;
  readonly routingElevationMeters: Float64Array;
  readonly flatRank: Int32Array;
  readonly terminalKindByCell: Uint8Array;
  readonly terminalOrdinalByCell: Int32Array;
}

export interface TerrainTerminalOwnerAnalysis {
  readonly terminalKindByCell: Uint8Array;
  readonly terminalOrdinalByCell: Int32Array;
  readonly terminalOwnerCells: Int32Array;
  readonly terminalCount: number;
}

export const TERRAIN_TERMINAL_NONE = 0;
export const TERRAIN_TERMINAL_OCEAN_OUTLET = 1;
export const TERRAIN_TERMINAL_EXTERNAL_DOMAIN_OUTLET = 2;
export const TERRAIN_TERMINAL_RETAINED_CLOSED_BASIN = 3;
export const TERRAIN_TERMINAL_ORDINAL_NONE = -1;

const ARRAY_BYTES = {
  u8: Uint8Array.BYTES_PER_ELEMENT,
  i32: Int32Array.BYTES_PER_ELEMENT,
  f64: Float64Array.BYTES_PER_ELEMENT,
} as const;

function boundFailure(path: string, detail: string): WorldM0Result<never> {
  return worldM0Failure("M02_BOUND_EXCEEDED", path, detail);
}

function invalidFailure(path: string, detail: string): WorldM0Result<never> {
  return worldM0Failure("M02_CANDIDATE_INVALID", path, detail);
}

export function createTerrainScratchBudget(
  maxScratchBytes: number,
): WorldM0Result<TerrainScratchBudget> {
  if (!Number.isSafeInteger(maxScratchBytes) || maxScratchBytes <= 0 || Object.is(maxScratchBytes, -0)) {
    return boundFailure("analysis.maxScratchBytes", "scratch byte bound must be a positive safe integer");
  }

  const allocations = new Map<string, {
    readonly bytes: number;
    readonly value: Uint8Array | Int32Array | Float64Array;
  }>();
  let liveBytes = 0;
  let peakBytes = 0;

  const budget: TerrainScratchBudget = {
    snapshot: () => ({ maxBytes: maxScratchBytes, liveBytes, peakBytes }),
    allocateBatch: (requests) => {
      if (!Array.isArray(requests)) {
        return invalidFailure("scratch.requests", "scratch batch must be an array");
      }
      const labels = new Set<string>();
      const byteCounts: number[] = [];
      let batchBytes = 0;
      for (let index = 0; index < requests.length; index += 1) {
        const request = requests[index] as TerrainScratchArrayRequest;
        if (typeof request?.label !== "string" || request.label.length === 0 ||
            (request.kind !== "u8" && request.kind !== "i32" && request.kind !== "f64") ||
            !Number.isSafeInteger(request.length) || request.length < 0 || Object.is(request.length, -0)) {
          return invalidFailure(`scratch.requests[${index}]`, "invalid scratch array request");
        }
        if (labels.has(request.label) || allocations.has(request.label)) {
          return invalidFailure(`scratch.requests[${index}].label`, "scratch allocation label must be unique and live only once");
        }
        labels.add(request.label);
        const bytes = request.length * ARRAY_BYTES[request.kind];
        if (!Number.isSafeInteger(bytes)) {
          return boundFailure(`scratch.requests[${index}].length`, "scratch allocation byte size exceeds safe integer range");
        }
        batchBytes += bytes;
        if (!Number.isSafeInteger(batchBytes)) {
          return boundFailure("scratch.requests", "scratch batch byte size exceeds safe integer range");
        }
        byteCounts.push(bytes);
      }
      const prospectiveLiveBytes = liveBytes + batchBytes;
      if (!Number.isSafeInteger(prospectiveLiveBytes) || prospectiveLiveBytes > maxScratchBytes) {
        return boundFailure("analysis.maxScratchBytes", "scratch batch exceeds peak-live byte bound");
      }

      const created: (Uint8Array | Int32Array | Float64Array)[] = [];
      try {
        for (const request of requests) {
          const value = request.kind === "u8"
            ? new Uint8Array(request.length)
            : request.kind === "i32"
              ? new Int32Array(request.length)
              : new Float64Array(request.length);
          created.push(value);
        }
      } catch {
        created.length = 0;
        return boundFailure("scratch.requests", "scratch array construction failed after successful byte preflight");
      }
      for (let index = 0; index < requests.length; index += 1) {
        allocations.set(requests[index].label, { bytes: byteCounts[index], value: created[index] });
      }
      liveBytes = prospectiveLiveBytes;
      peakBytes = Math.max(peakBytes, liveBytes);
      return { ok: true, value: created };
    },
    release: (label) => {
      const allocation = allocations.get(label);
      if (allocation === undefined) {
        return invalidFailure("scratch.label", "scratch allocation is absent or already released");
      }
      allocations.delete(label);
      const nextLiveBytes = liveBytes - allocation.bytes;
      if (!Number.isSafeInteger(nextLiveBytes) || nextLiveBytes < 0) {
        return invalidFailure("scratch.liveBytes", "scratch ledger underflow");
      }
      liveBytes = nextLiveBytes;
      return { ok: true, value: true };
    },
  };
  return { ok: true, value: budget };
}

export function allocateTerrainScratchGrid(
  extentWidthMeters: number,
  extentHeightMeters: number,
  constants: WorldM0PhysicalConstantsV1,
  budget: TerrainScratchBudget,
): WorldM0Result<TerrainScratchGrid> {
  const cellSizeMeters = constants.analysis.cellSizeMeters;
  if (!Number.isSafeInteger(extentWidthMeters) || extentWidthMeters <= 0 ||
      !Number.isSafeInteger(extentHeightMeters) || extentHeightMeters <= 0 ||
      cellSizeMeters !== 250 || extentWidthMeters % cellSizeMeters !== 0 ||
      extentHeightMeters % cellSizeMeters !== 0) {
    return worldM0Failure(
      "M02_ANALYSIS_GRID_UNSUPPORTED",
      "spatial",
      "physical extent must divide exactly by the 250 m analysis cell size",
    );
  }
  const width = extentWidthMeters / cellSizeMeters;
  const height = extentHeightMeters / cellSizeMeters;
  const length = width * height;
  if (!Number.isSafeInteger(length) || length <= 0 || length > constants.analysis.maxAnalysisCells) {
    return boundFailure("analysis.maxAnalysisCells", "analysis cell count exceeds verified bound");
  }
  const budgetSnapshot = budget.snapshot();
  if (budgetSnapshot.maxBytes > constants.analysis.maxScratchBytes) {
    return boundFailure("analysis.maxScratchBytes", "scratch ledger exceeds the verified physical-constants bound");
  }

  const allocated = budget.allocateBatch([
    { label: "elevationMeters", kind: "f64", length },
    { label: "landMask", kind: "u8", length },
    { label: "routingElevationMeters", kind: "f64", length },
    { label: "flatRank", kind: "i32", length },
    { label: "terminalKindByCell", kind: "u8", length },
    { label: "terminalOrdinalByCell", kind: "i32", length },
  ]);
  if (!allocated.ok) return allocated;
  const [
    elevationMeters,
    landMask,
    routingElevationMeters,
    flatRank,
    terminalKindByCell,
    terminalOrdinalByCell,
  ] = allocated.value;
  if (!(elevationMeters instanceof Float64Array) || !(landMask instanceof Uint8Array) ||
      !(routingElevationMeters instanceof Float64Array) || !(flatRank instanceof Int32Array) ||
      !(terminalKindByCell instanceof Uint8Array) || !(terminalOrdinalByCell instanceof Int32Array)) {
    return invalidFailure("scratch", "scratch allocator returned an unexpected array kind");
  }
  terminalOrdinalByCell.fill(TERRAIN_TERMINAL_ORDINAL_NONE);
  return {
    ok: true,
    value: {
      width,
      height,
      cellSizeMeters: 250,
      cellAreaM2: 62_500,
      budget,
      elevationMeters,
      landMask,
      routingElevationMeters,
      flatRank,
      terminalKindByCell,
      terminalOrdinalByCell,
    },
  };
}
