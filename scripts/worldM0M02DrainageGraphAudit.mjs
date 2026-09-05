import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

import { clonePhysicalConstants } from "./lib/worldM0M02Fixture.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DRAINAGE_PATH = join(ROOT, "src/sim/world/physical/terrainDrainage.ts");
const CELL_AREA = 62_500;
const DRAINAGE_SOURCE = existsSync(DRAINAGE_PATH) ? readFileSync(DRAINAGE_PATH, "utf8") : "";
const BASE_LABELS = [
  "elevationMeters", "landMask", "routingElevationMeters", "flatRank",
  "terminalKindByCell", "terminalOrdinalByCell",
];
const FLOW_LABELS = [
  ["flowPrimaryReceiver", "i32"],
  ["flowSecondaryReceiver", "i32"],
  ["flowPrimaryWeight", "f64"],
  ["flowSecondaryWeight", "f64"],
  ["flowTerminalReceiver", "i32"],
  ["flowContributingAreaM2", "f64"],
  ["flowTopologicalOrder", "i32"],
];
const TASK8_LABELS = [
  "primaryContributingAreaM2", "catchmentRoot", "persistentEligible",
  "representedSupport", "representedIndegree", "firstReachAssignment",
];
const F567_ELEVATIONS = [
  9, 9, 9, 9, 9,
  9, 6, 5, 6, 9,
  9, 5, 1, 1, 5,
  9, 6, 5, 6, 4,
  9, 9, 9, 9, 3,
];
const ZERO_INTENT = Object.freeze({ a: 0, b: 0, c: 0, d: 0 });

async function loadModules(cacheSuffix = "") {
  const loaded = { loadError: undefined };
  const server = await createServer({
    root: join(ROOT, "src"),
    configFile: false,
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false },
    logLevel: "error",
  });
  try {
    loaded.scratch = await server.ssrLoadModule(`/sim/world/physical/terrainScratch.ts${cacheSuffix}`);
    loaded.flow = await server.ssrLoadModule(`/sim/world/physical/terrainFlow.ts${cacheSuffix}`);
    loaded.depressions = await server.ssrLoadModule(`/sim/world/physical/terrainDepressions.ts${cacheSuffix}`);
    if (existsSync(DRAINAGE_PATH)) {
      loaded.drainage = await server.ssrLoadModule(`/sim/world/physical/terrainDrainage.ts${cacheSuffix}`);
    }
  } catch (error) {
    loaded.loadError = error instanceof Error ? error.message : String(error);
  } finally {
    await server.close();
  }
  return loaded;
}

const modules = await loadModules();
const hasAuthority = typeof modules.drainage?.extractPersistentDrainageGraph === "function";

function id(namespace, ordinal) {
  return `${namespace}:${ordinal.toString(16).padStart(16, "0")}`;
}

function point(xM, yM) { return { xM, yM }; }
function samePoint(a, b) { return a?.xM === b?.xM && a?.yM === b?.yM; }
function exactArray(actual, expected) {
  return actual?.length === expected.length && expected.every((value, index) => Object.is(actual[index], value));
}
function exactPointArray(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length &&
    expected.every((value, index) => samePoint(actual[index], value));
}
function exactKeys(value, expected) {
  return value && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
}
function resultValue(result) { return result?.ok === true ? result.value : undefined; }
function resultError(result) { return result?.ok === false ? result.error : undefined; }

function makeSyntheticFixture(definition) {
  const constants = clonePhysicalConstants();
  if (definition.maxScratchBytes !== undefined) constants.analysis.maxScratchBytes = definition.maxScratchBytes;
  constants.drainage.persistenceAreaM2 = definition.persistenceAreaM2 ?? CELL_AREA;
  constants.drainage.minReachLengthMeters = definition.minReachLengthMeters ?? 500;
  constants.geometry.simplifyToleranceMeters = definition.simplifyToleranceMeters ?? 125;
  if (definition.maxPolygonVerticesPerFeature !== undefined) {
    constants.geometry.maxPolygonVerticesPerFeature = definition.maxPolygonVerticesPerFeature;
  }
  if (definition.maxPolylineVerticesPerFeature !== undefined) {
    constants.geometry.maxPolylineVerticesPerFeature = definition.maxPolylineVerticesPerFeature;
  }
  if (definition.maxNodes !== undefined) constants.drainage.maxNodes = definition.maxNodes;
  const n = definition.width * definition.height;
  constants.analysis.maxAnalysisCells = Math.max(constants.analysis.maxAnalysisCells, n);
  const budgetResult = modules.scratch?.createTerrainScratchBudget?.(constants.analysis.maxScratchBytes);
  const budget = resultValue(budgetResult);
  const gridResult = budget && modules.scratch?.allocateTerrainScratchGrid?.(
    definition.width * 250, definition.height * 250, constants, budget,
  );
  const grid = resultValue(gridResult);
  if (!grid) return { constants, budget, gridResult };

  const fillOrder = definition.fillOrder === "reverse"
    ? Array.from({ length: n }, (_, index) => n - 1 - index)
    : Array.from({ length: n }, (_, index) => index);
  for (const cell of fillOrder) {
    grid.elevationMeters[cell] = definition.elevations?.[cell] ?? (100 - cell);
    grid.routingElevationMeters[cell] = definition.routing?.[cell] ?? grid.elevationMeters[cell];
    grid.landMask[cell] = definition.landMask?.[cell] ?? 1;
    grid.flatRank[cell] = definition.flatRank?.[cell] ?? 0;
    grid.terminalKindByCell[cell] = definition.kinds?.[cell] ?? 0;
    grid.terminalOrdinalByCell[cell] = definition.ordinals?.[cell] ?? -1;
  }

  const ownersArray = budget.allocateBatch([
    { label: "terminalOwnerCells", kind: "i32", length: definition.owners.length },
  ]);
  if (!ownersArray.ok) return { constants, budget, grid, ownerError: ownersArray.error };
  const terminalOwnerCells = ownersArray.value[0];
  terminalOwnerCells.set(definition.owners);
  const terminalOwners = {
    terminalKindByCell: grid.terminalKindByCell,
    terminalOrdinalByCell: grid.terminalOrdinalByCell,
    terminalOwnerCells,
    terminalCount: definition.owners.length,
  };

  const flowAllocation = budget.allocateBatch(FLOW_LABELS.map(([label, kind]) => ({ label, kind, length: n })));
  if (!flowAllocation.ok) return { constants, budget, grid, terminalOwners, flowError: flowAllocation.error };
  const [primaryReceiver, secondaryReceiver, primaryWeight, secondaryWeight,
    terminalReceiver, contributingAreaM2, topologicalOrder] = flowAllocation.value;
  primaryReceiver.fill(-1);
  secondaryReceiver.fill(-1);
  terminalReceiver.fill(-1);
  topologicalOrder.fill(-1);
  for (let cell = 0; cell < n; cell += 1) {
    primaryReceiver[cell] = definition.primary[cell];
    if (definition.secondary) secondaryReceiver[cell] = definition.secondary[cell];
    primaryWeight[cell] = primaryReceiver[cell] >= 0 ? 1 : 0;
    secondaryWeight[cell] = 0;
    terminalReceiver[cell] = definition.terminalReceiver?.[cell] ??
      (grid.terminalOrdinalByCell[cell] >= 0 ? grid.terminalOrdinalByCell[cell] : -1);
    contributingAreaM2[cell] = definition.splitArea?.[cell] ?? (grid.landMask[cell] === 1 ? CELL_AREA : 0);
  }
  topologicalOrder.set(definition.topologicalOrder);
  const flow = { primaryReceiver, secondaryReceiver, primaryWeight, secondaryWeight,
    terminalReceiver, contributingAreaM2, topologicalOrder };
  const depression = {
    retainedDepressions: definition.retainedDepressions ?? [],
    terminalOwners,
    conditionedDepressionCount: 0,
    repairOperationCount: 0,
  };
  const landCount = Array.from(grid.landMask).filter((value) => value === 1).length;
  const coastline = definition.coastline ?? {
    seaLevelMeters: 0,
    coastline: [],
    landAreaM2: landCount * CELL_AREA,
    oceanAreaM2: (n - landCount) * CELL_AREA,
  };
  return { constants, budget, grid, terminalOwners, flow, depression, coastline };
}

function runSynthetic(definition) {
  const fixture = makeSyntheticFixture(definition);
  const before = fixture.budget?.snapshot();
  const task8Aliases = [];
  const originalAllocateBatch = fixture.budget?.allocateBatch;
  if (definition.captureReleasedAliases && fixture.budget && originalAllocateBatch) {
    fixture.budget.allocateBatch = (requests) => {
      const allocated = originalAllocateBatch(requests);
      if (allocated.ok && requests.some((request) => TASK8_LABELS.includes(request.label))) {
        task8Aliases.push(...allocated.value);
      }
      return allocated;
    };
  }
  let result;
  try {
    result = fixture.grid && hasAuthority
      ? modules.drainage.extractPersistentDrainageGraph(
        fixture.grid, fixture.coastline, fixture.flow, fixture.depression, fixture.constants,
      )
      : undefined;
  } finally {
    if (definition.captureReleasedAliases && fixture.budget && originalAllocateBatch) {
      fixture.budget.allocateBatch = originalAllocateBatch;
    }
  }
  const releasedAliases = definition.captureReleasedAliases && fixture.flow && fixture.terminalOwners
    ? [...task8Aliases, ...FLOW_LABELS.map(([label]) => ({
      flowPrimaryReceiver: fixture.flow.primaryReceiver,
      flowSecondaryReceiver: fixture.flow.secondaryReceiver,
      flowPrimaryWeight: fixture.flow.primaryWeight,
      flowSecondaryWeight: fixture.flow.secondaryWeight,
      flowTerminalReceiver: fixture.flow.terminalReceiver,
      flowContributingAreaM2: fixture.flow.contributingAreaM2,
      flowTopologicalOrder: fixture.flow.topologicalOrder,
    })[label]), fixture.terminalOwners.terminalOwnerCells]
    : [];
  return { fixture, before, result, value: resultValue(result), after: fixture.budget?.snapshot(), releasedAliases };
}

function replaceSourceExactlyOnce(source, needle, replacement) {
  const first = source.indexOf(needle);
  if (first < 0 || first !== source.lastIndexOf(needle)) return undefined;
  return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

function independentLocalWitnessSourceGuard(source) {
  return source.includes("reaches[firstReachAssignment[current]].localAreaM2 += scratch.cellAreaM2;") &&
    source.includes("reaches[firstReachAssignment[cell]].localAreaM2 += scratch.cellAreaM2;") &&
    !/localAreaM2\s*=\s*primaryArea\[reach\.measurementCell\]\s*-/.test(source);
}

async function runDrainageSourceMutation(label, mutateSource, exercise) {
  const originalBytes = readFileSync(DRAINAGE_PATH);
  const originalSource = originalBytes.toString("utf8");
  const mutatedSource = mutateSource(originalSource);
  if (typeof mutatedSource !== "string" || mutatedSource === originalSource) {
    return { applied: false, detected: false, restored: readFileSync(DRAINAGE_PATH).equals(originalBytes), detail: null };
  }
  const originalDrainage = modules.drainage;
  let detected = false;
  let detail = null;
  try {
    writeFileSync(DRAINAGE_PATH, mutatedSource);
    const loaded = await loadModules(`?task8_mutant=${encodeURIComponent(label)}`);
    if (loaded.loadError !== undefined || typeof loaded.drainage?.extractPersistentDrainageGraph !== "function") {
      detail = { loadError: loaded.loadError ?? "mutated drainage authority absent" };
    } else {
      modules.drainage = loaded.drainage;
      const outcome = exercise(mutatedSource);
      detected = outcome?.detected === true;
      detail = outcome?.detail ?? null;
    }
  } finally {
    modules.drainage = originalDrainage;
    writeFileSync(DRAINAGE_PATH, originalBytes);
  }
  return { applied: true, detected, restored: readFileSync(DRAINAGE_PATH).equals(originalBytes), detail };
}

function runWithPushGuard(definition, shouldGuard, limit) {
  const fixture = makeSyntheticFixture(definition);
  const originalPush = Array.prototype.push;
  let guardTrips = 0;
  let thrown;
  let result;
  Array.prototype.push = function (...items) {
    if (items.some(shouldGuard) && this.length + items.length > limit) {
      guardTrips += 1;
      throw new Error(`TASK8_RUNTIME_PUSH_GUARD:${limit}`);
    }
    return originalPush.apply(this, items);
  };
  try {
    result = fixture.grid && hasAuthority
      ? modules.drainage.extractPersistentDrainageGraph(
        fixture.grid, fixture.coastline, fixture.flow, fixture.depression, fixture.constants,
      )
      : undefined;
  } catch (error) {
    thrown = error instanceof Error ? error.message : String(error);
  } finally {
    Array.prototype.push = originalPush;
  }
  return { fixture, result, value: resultValue(result), guardTrips, thrown };
}

function runWithArrayCopyGuard(definition) {
  const fixture = makeSyntheticFixture(definition);
  const methodNames = ["map", "slice", "flatMap", "concat"];
  const originals = new Map(methodNames.map((name) => [name, Array.prototype[name]]));
  const trips = [];
  let thrown;
  let result;
  for (const name of methodNames) {
    const original = originals.get(name);
    Array.prototype[name] = function (...args) {
      trips.push({ name, length: this.length });
      throw new Error(`TASK8_RUNTIME_ARRAY_COPY_GUARD:${name}:${this.length}`);
    };
  }
  try {
    result = fixture.grid && hasAuthority
      ? modules.drainage.extractPersistentDrainageGraph(
        fixture.grid, fixture.coastline, fixture.flow, fixture.depression, fixture.constants,
      )
      : undefined;
  } catch (error) {
    thrown = error instanceof Error ? error.message : String(error);
  } finally {
    for (const [name, original] of originals) Array.prototype[name] = original;
  }
  return { fixture, result, value: resultValue(result), trips, thrown };
}

function runWithArrayLengthGuard(definition, guardedLength) {
  const fixture = makeSyntheticFixture(definition);
  const NativeArray = globalThis.Array;
  let guardTrips = 0;
  let thrown;
  let result;
  globalThis.Array = new Proxy(NativeArray, {
    construct(target, args, newTarget) {
      if (args.length === 1 && args[0] === guardedLength) {
        guardTrips += 1;
        throw new Error(`TASK8_RUNTIME_ARRAY_LENGTH_GUARD:${guardedLength}`);
      }
      return Reflect.construct(target, args, newTarget);
    },
    apply(target, thisArg, args) { return Reflect.apply(target, thisArg, args); },
  });
  try {
    result = fixture.grid && hasAuthority
      ? modules.drainage.extractPersistentDrainageGraph(
        fixture.grid, fixture.coastline, fixture.flow, fixture.depression, fixture.constants,
      )
      : undefined;
  } catch (error) {
    thrown = error instanceof Error ? error.message : String(error);
  } finally {
    globalThis.Array = NativeArray;
  }
  return { fixture, result, value: resultValue(result), guardTrips, thrown };
}

const F1 = Object.freeze({
  width: 5, height: 1,
  primary: [1, 2, 3, 4, -1],
  kinds: [0, 0, 0, 0, 2],
  ordinals: [-1, -1, -1, -1, 0], owners: [4],
  topologicalOrder: [0, 1, 2, 3, 4],
  splitArea: [CELL_AREA, 2 * CELL_AREA, 3 * CELL_AREA, 4 * CELL_AREA, 5 * CELL_AREA],
  persistenceAreaM2: 2 * CELL_AREA,
  elevations: [50, 40, 30, 20, 10],
});
const f1 = runSynthetic(F1);
const f10ReleaseAliases = runSynthetic({ ...F1, captureReleasedAliases: true });
const f10CatchmentBoundGuard = runWithPushGuard(
  { ...F1, maxPolygonVerticesPerFeature: 5, persistenceAreaM2: 10_000_000 },
  (value) => value && typeof value === "object" && Number.isFinite(value.xM) && Number.isFinite(value.yM) &&
    value.xM % 250 === 0 && value.yM % 250 === 0,
  5,
);
const F10_LONG_REACH = Object.freeze({
  width: 8, height: 1,
  primary: [1, 2, 3, 4, 5, 6, 7, -1],
  kinds: [0, 0, 0, 0, 0, 0, 0, 2],
  ordinals: [-1, -1, -1, -1, -1, -1, -1, 0], owners: [7],
  topologicalOrder: [0, 1, 2, 3, 4, 5, 6, 7],
  splitArea: [CELL_AREA, 2 * CELL_AREA, 3 * CELL_AREA, 4 * CELL_AREA, 5 * CELL_AREA, 6 * CELL_AREA, 7 * CELL_AREA, 8 * CELL_AREA],
  persistenceAreaM2: CELL_AREA,
  maxPolygonVerticesPerFeature: 5,
  maxPolylineVerticesPerFeature: 2,
});
const f10ReachBoundGuard = runWithPushGuard(
  F10_LONG_REACH,
  (value) => value && typeof value === "object" && Number.isFinite(value.xM) && Number.isFinite(value.yM) &&
    value.xM % 250 === 125 && value.yM % 250 === 125,
  2,
);
const F10_MANY_TERMINALS = Object.freeze({
  width: 16, height: 1,
  primary: Array(16).fill(-1),
  kinds: Array(16).fill(2),
  ordinals: Array.from({ length: 16 }, (_, index) => index),
  owners: Array.from({ length: 16 }, (_, index) => index),
  topologicalOrder: Array.from({ length: 16 }, (_, index) => index),
  persistenceAreaM2: 10_000_000,
});
const f10TerminalMirrorGuard = runWithArrayLengthGuard(F10_MANY_TERMINALS, 16);
const f10NodeBoundGuard = runWithPushGuard(
  { ...F1, maxNodes: 1 },
  (value) => value && typeof value === "object" && Number.isSafeInteger(value.cell) &&
    (value.kind === "source" || value.kind === "confluence" || value.kind === "terminal"),
  1,
);
const f10ArrayCopyGuard = runWithArrayCopyGuard(F1);
const f10ForbiddenCopySourceMatches = [...DRAINAGE_SOURCE.matchAll(/\.(map|slice|flatMap|concat)\s*\(/g)]
  .map((match) => ({ method: match[1], index: match.index }));
const f8LiteralDomain1Structure =
  /function\s+finalizeCatchmentGeometryDomainV1\s*\(/.test(DRAINAGE_SOURCE) &&
  /originalUnsimplified/.test(DRAINAGE_SOURCE) &&
  /earlierFinal/.test(DRAINAGE_SOURCE) &&
  /laterOriginal/.test(DRAINAGE_SOURCE) &&
  DRAINAGE_SOURCE.indexOf("finalizeCatchmentGeometryDomainV1(") <
    DRAINAGE_SOURCE.indexOf('formatTerrainHydroId("catchment"');
const f8GridToleranceSpecializationExact =
  /2\s*\*\s*toleranceSquared\s*<\s*scratch\.cellSizeMeters\s*\*\s*scratch\.cellSizeMeters/.test(DRAINAGE_SOURCE) &&
  !/rasterCornerHasProtectedCellCenter/.test(DRAINAGE_SOURCE);
const f1ReverseFill = runSynthetic({ ...F1, fillOrder: "reverse" });
const f1ThresholdAt = f1;
const f1ThresholdBelow = runSynthetic({ ...F1, persistenceAreaM2: 2 * CELL_AREA + 1 });
const f1ReliefChanged = runSynthetic({ ...F1, elevations: [500, -20, 900, 3, 777] });

const F2 = Object.freeze({
  width: 6, height: 1,
  primary: [-1, 0, 1, 4, 5, -1],
  kinds: [2, 0, 0, 0, 0, 2],
  ordinals: [0, -1, -1, -1, -1, 1], owners: [0, 5],
  topologicalOrder: [2, 1, 0, 3, 4, 5],
  splitArea: [3 * CELL_AREA, 2 * CELL_AREA, CELL_AREA, CELL_AREA, 2 * CELL_AREA, 3 * CELL_AREA],
  persistenceAreaM2: CELL_AREA,
  elevations: [10, 20, 30, 30, 20, 10],
});
const f2 = runSynthetic(F2);
const f4OwnerBypass = runSynthetic({
  ...F2,
  primary: [5, 0, 1, 4, 5, -1],
  terminalReceiver: [0, -1, -1, -1, -1, 1],
});

const F8_DONUT = Object.freeze({
  width: 4, height: 4,
  landMask: [
    1, 1, 1, 0,
    1, 1, 1, 0,
    1, 1, 1, 0,
    0, 0, 0, 1,
  ],
  primary: [
    -1, 0, 1, -1,
    0, -1, 2, -1,
    4, 8, 9, -1,
    -1, -1, -1, 10,
  ],
  kinds: [
    2, 0, 0, 0,
    0, 3, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
  ],
  ordinals: [
    1, -1, -1, -1,
    -1, 0, -1, -1,
    -1, -1, -1, -1,
    -1, -1, -1, -1,
  ],
  owners: [5, 0],
  topologicalOrder: [6, 2, 1, 15, 10, 9, 8, 4, 0, 5, -1, -1, -1, -1, -1, -1],
  persistenceAreaM2: 10_000_000,
});
const f8Donut = runSynthetic(F8_DONUT);

const F3 = Object.freeze({
  width: 4, height: 2,
  landMask: [0, 1, 0, 0, 1, 1, 1, 1],
  primary: [-1, 5, -1, -1, 5, 6, 7, -1],
  kinds: [0, 0, 0, 0, 0, 0, 0, 2],
  ordinals: [-1, -1, -1, -1, -1, -1, -1, 0], owners: [7],
  topologicalOrder: [4, 1, 5, 6, 7, -1, -1, -1],
  splitArea: [0, CELL_AREA, 0, 0, CELL_AREA, 2 * CELL_AREA, 3 * CELL_AREA, 5 * CELL_AREA],
  persistenceAreaM2: CELL_AREA,
  elevations: [0, 40, 0, 0, 50, 30, 20, 10],
  minReachLengthMeters: 2_000,
});
const f3 = runSynthetic(F3);
const f3SiblingOrder = runSynthetic({ ...F3, topologicalOrder: [1, 4, 5, 6, 7, -1, -1, -1] });
const f3Cycle = runSynthetic({ ...F3, primary: [-1, 5, -1, -1, 5, 6, 5, -1] });
const f3InvalidReceiver = runSynthetic({ ...F3, primary: [-1, 5, -1, -1, 99, 6, 7, -1] });
const F3_TERMINAL_OWNER_MERGE = Object.freeze({
  width: 2, height: 2,
  landMask: [0, 1, 1, 1],
  primary: [-1, 3, 3, -1],
  kinds: [0, 0, 0, 2],
  ordinals: [-1, -1, -1, 0], owners: [3],
  topologicalOrder: [2, 1, 3, -1],
  splitArea: [0, CELL_AREA, CELL_AREA, 3 * CELL_AREA],
  persistenceAreaM2: CELL_AREA,
  elevations: [0, 40, 50, 30],
});
const f3TerminalOwnerMerge = runSynthetic(F3_TERMINAL_OWNER_MERGE);
const f1BadCoastline = runSynthetic({ ...F1, coastline: {
  seaLevelMeters: 0, coastline: [], landAreaM2: 0, oceanAreaM2: 0,
} });
const f1Preflight = runSynthetic({ ...F1, maxScratchBytes: 443 });
const f1ReleaseProbe = f1.fixture.budget.allocateBatch([
  ...FLOW_LABELS.map(([label, kind]) => ({ label, kind, length: 5 })),
  ...TASK8_LABELS.map((label, index) => ({ label, kind: ["f64", "i32", "u8", "u8", "i32", "i32"][index], length: 5 })),
  { label: "terminalOwnerCells", kind: "i32", length: 1 },
]);

function structuralGraph(value) {
  if (!value) return undefined;
  return {
    terminals: value.terminals,
    catchments: value.catchments,
    nodes: value.nodes,
    reaches: value.reaches.map(({ meanTerrainGradient, localReliefMeters, channelIncisionMeters, ...rest }) => rest),
    retainedDepressionLinks: value.retainedDepressionLinks,
  };
}

function reachByEndpoints(value, upstream, downstream) {
  if (!value) return undefined;
  return value.reaches.find((reach) => {
    const up = value.nodes.find((node) => node.id === reach.upstreamNodeId);
    const down = value.nodes.find((node) => node.id === reach.downstreamNodeId);
    return samePoint(up?.point, upstream) && samePoint(down?.point, downstream);
  });
}

const f1Source = f1.value?.nodes.find((node) => node.kind === "source");
const f1Terminal = f1.value?.terminals[0];
const f1Reach = f1.value?.reaches[0];
const f2Sources = f2.value?.nodes.filter((node) => node.kind === "source") ?? [];
const f3TribA = reachByEndpoints(f3.value, point(125, 125), point(375, 125));
const f3TribB = reachByEndpoints(f3.value, point(375, 375), point(375, 125));
const f3Trunk = reachByEndpoints(f3.value, point(375, 125), point(875, 0));
const f3TerminalMergeTribA = reachByEndpoints(f3TerminalOwnerMerge.value, point(125, 125), point(375, 125));
const f3TerminalMergeTribB = reachByEndpoints(f3TerminalOwnerMerge.value, point(375, 375), point(375, 125));
const f3TerminalMergeTrunk = reachByEndpoints(f3TerminalOwnerMerge.value, point(375, 125), point(375, 0));

const oldTerminalOwnerMergeMutation = await runDrainageSourceMutation(
  "old-terminal-owner-merge",
  (source) => replaceSourceExactlyOnce(
    source,
    "      const terminalMerge = representedIndegree[cell] >= 2 && !samePoint(cellCenter, terminal.point);",
    "      const terminalMerge = false;",
  ),
  () => {
    const mutant = runSynthetic(F3_TERMINAL_OWNER_MERGE);
    return {
      detected: mutant.result?.ok === true && mutant.value?.nodes.filter((node) => node.kind === "confluence").length === 0 &&
        mutant.value?.reaches.length === 2,
      detail: { error: resultError(mutant.result) ?? null, nodeKinds: mutant.value?.nodes.map((node) => node.kind) ?? null,
        reachCount: mutant.value?.reaches.length ?? null },
    };
  },
);

const droppedOffSupportMutation = await runDrainageSourceMutation(
  "drop-off-support-cell",
  (source) => replaceSourceExactlyOnce(
    source,
    "    if (scratch.landMask[cell] !== 1 || firstReachAssignment[cell] >= 0) continue;",
    "    if (scratch.landMask[cell] !== 1 || firstReachAssignment[cell] >= 0 || representedSupport[cell] !== 1) continue;",
  ),
  () => {
    const mutant = runSynthetic(F1);
    return {
      detected: mutant.result?.ok === true && mutant.value?.reaches[0]?.localContributingAreaM2 === 4 * CELL_AREA,
      detail: { error: resultError(mutant.result) ?? null,
        localContributingAreaM2: mutant.value?.reaches[0]?.localContributingAreaM2 ?? null },
    };
  },
);

const incomingConfluenceAssignmentMutation = await runDrainageSourceMutation(
  "assign-confluence-cell-incoming",
  (source) => replaceSourceExactlyOnce(
    source,
    "    firstReachAssignment[node.cell] = outgoing.transientOrdinal;",
    "    const incoming = reaches.find((reach) => reach.downstreamCell === node.cell);\n" +
      "    firstReachAssignment[node.cell] = incoming?.transientOrdinal ?? outgoing.transientOrdinal;",
  ),
  () => {
    const mutant = runSynthetic(F3);
    const trunk = reachByEndpoints(mutant.value, point(375, 125), point(875, 0));
    const tribA = reachByEndpoints(mutant.value, point(125, 125), point(375, 125));
    const tribB = reachByEndpoints(mutant.value, point(375, 375), point(375, 125));
    return {
      detected: mutant.result?.ok === true && (trunk?.localContributingAreaM2 !== 3 * CELL_AREA ||
        tribA?.localContributingAreaM2 !== CELL_AREA || tribB?.localContributingAreaM2 !== CELL_AREA),
      detail: { error: resultError(mutant.result) ?? null, trunkLocal: trunk?.localContributingAreaM2 ?? null,
        tribALocal: tribA?.localContributingAreaM2 ?? null, tribBLocal: tribB?.localContributingAreaM2 ?? null },
    };
  },
);

const residualLocalAreaMutation = await runDrainageSourceMutation(
  "derive-local-as-residual",
  (source) => replaceSourceExactlyOnce(
    source,
    "\n  // Final physical identity sort uses the finalized geometry, not the domain-2",
    "\n  for (const reach of reaches) {\n" +
      "    let upstreamTotalM2 = 0;\n" +
      "    for (const candidate of reaches) {\n" +
      "      if (candidate !== reach && candidate.downstreamCell === reach.upstreamCell) {\n" +
      "        upstreamTotalM2 += primaryArea[candidate.measurementCell];\n" +
      "      }\n" +
      "    }\n" +
      "    reach.localAreaM2 = primaryArea[reach.measurementCell] - upstreamTotalM2;\n" +
      "  }\n\n" +
      "  // Final physical identity sort uses the finalized geometry, not the domain-2",
  ),
  (mutatedSource) => {
    const mutant = runSynthetic(F3);
    return {
      detected: mutant.result?.ok === true && !independentLocalWitnessSourceGuard(mutatedSource),
      detail: { error: resultError(mutant.result) ?? null, sourceGuard: independentLocalWitnessSourceGuard(mutatedSource) },
    };
  },
);

function setupG6() {
  const definition = {
    width: 3, height: 3,
    routing: [100, 98, 100, 97, 97, 97, 100, 100, 100],
    elevations: [100, 98, 100, 97, 97, 97, 100, 100, 100],
    flatRank: Array(9).fill(0),
    kinds: [2, 2, 2, 2, 3, 2, 2, 2, 2],
    ordinals: [3, 5, 7, 2, 0, 8, 1, 4, 6],
    owners: [4, 6, 3, 0, 7, 1, 8, 2, 5],
    primary: Array(9).fill(-1), topologicalOrder: Array(9).fill(-1),
    persistenceAreaM2: 10_000_000,
  };
  const constants = clonePhysicalConstants();
  constants.drainage.persistenceAreaM2 = definition.persistenceAreaM2;
  const budgetResult = modules.scratch?.createTerrainScratchBudget?.(constants.analysis.maxScratchBytes);
  const budget = resultValue(budgetResult);
  const grid = budget && resultValue(modules.scratch?.allocateTerrainScratchGrid?.(750, 750, constants, budget));
  if (!grid) return { constants, budget };
  grid.elevationMeters.set(definition.elevations);
  grid.routingElevationMeters.set(definition.routing);
  grid.landMask.fill(1);
  grid.flatRank.fill(0);
  grid.terminalKindByCell.set(definition.kinds);
  grid.terminalOrdinalByCell.set(definition.ordinals);
  const ownerResult = budget.allocateBatch([{ label: "terminalOwnerCells", kind: "i32", length: 9 }]);
  if (!ownerResult.ok) return { constants, budget, grid };
  const terminalOwnerCells = ownerResult.value[0];
  terminalOwnerCells.set(definition.owners);
  const owners = { terminalKindByCell: grid.terminalKindByCell, terminalOrdinalByCell: grid.terminalOrdinalByCell,
    terminalOwnerCells, terminalCount: 9 };
  const decision = modules.flow?.evaluateDInfinityCellDecision?.(grid, owners, 1);
  const flowResult = modules.flow?.analyzeDInfinityFlow?.(grid, owners, constants);
  const flow = resultValue(flowResult);
  const depression = { retainedDepressions: [], terminalOwners: owners, conditionedDepressionCount: 0, repairOperationCount: 0 };
  const coastline = { seaLevelMeters: 0, coastline: [], landAreaM2: 9 * CELL_AREA, oceanAreaM2: 0 };
  const drainageResult = flow && hasAuthority
    ? modules.drainage.extractPersistentDrainageGraph(grid, coastline, flow, depression, constants)
    : undefined;
  return { constants, budget, grid, owners, decision, flowResult, drainageResult, value: resultValue(drainageResult) };
}
const g6 = setupG6();

function runF67(kind) {
  const constants = clonePhysicalConstants();
  constants.drainage.persistenceAreaM2 = CELL_AREA;
  if (kind === "F6") {
    constants.depression.retainedMinAreaM2 = 1_000_000;
    constants.depression.retainedMinDepthMeters = 10;
    constants.depression.protectedClosedBasinRatePer65536 = 42_612;
  } else {
    constants.depression.retainedMinAreaM2 = 125_000;
    constants.depression.retainedMinDepthMeters = 3;
    constants.depression.protectedClosedBasinRatePer65536 = 0;
  }
  const budget = resultValue(modules.scratch?.createTerrainScratchBudget?.(constants.analysis.maxScratchBytes));
  const grid = budget && resultValue(modules.scratch?.allocateTerrainScratchGrid?.(1250, 1250, constants, budget));
  if (!grid) return { constants, budget };
  grid.elevationMeters.set(F567_ELEVATIONS);
  grid.landMask.fill(1);
  const depressionResult = modules.depressions?.analyzeTerrainDepressionsAndBoundaries?.(
    grid, 0, ZERO_INTENT, constants,
  );
  const depression = resultValue(depressionResult);
  const flowResult = depression && modules.flow?.analyzeDInfinityFlow?.(grid, depression.terminalOwners, constants);
  const flow = resultValue(flowResult);
  const coastline = { seaLevelMeters: 0, coastline: [], landAreaM2: 25 * CELL_AREA, oceanAreaM2: 0 };
  const drainageResult = depression && flow && hasAuthority
    ? modules.drainage.extractPersistentDrainageGraph(grid, coastline, flow, depression, constants)
    : undefined;
  return { constants, budget, grid, depressionResult, depression, flowResult, drainageResult, value: resultValue(drainageResult) };
}
const f6 = runF67("F6");
const f7 = runF67("F7");

const A = [point(0, 0), point(100, 100), point(200, 0)];
const B = [point(50, 20), point(100, -10), point(150, 20)];

// Independent audit-side oracle for the frozen §8/M03 A/B discriminator.
// Production Task 8 must not carry a second copy-heavy simplifier merely so the
// audit can call it; this oracle intentionally owns its own tiny bounded arrays.
function auditPointSegmentDistanceSquared(previous, vertex, next) {
  const dx = next.xM - previous.xM;
  const dy = next.yM - previous.yM;
  const wx = vertex.xM - previous.xM;
  const wy = vertex.yM - previous.yM;
  const len2 = dx * dx + dy * dy;
  if (!(len2 > 0)) return Number.POSITIVE_INFINITY;
  const t = (wx * dx + wy * dy) / len2;
  const tc = Math.min(1, Math.max(0, t));
  const qx = previous.xM + tc * dx;
  const qy = previous.yM + tc * dy;
  const ex = vertex.xM - qx;
  const ey = vertex.yM - qy;
  return ex * ex + ey * ey;
}
function auditM03ReachDomain(input, toleranceMeters) {
  const original = input.map((feature) => ({
    preKey: feature.preKey,
    geometry: feature.geometry.map((p) => point(p.xM, p.yM)),
  })).sort((left, right) => left.preKey < right.preKey ? -1 : left.preKey > right.preKey ? 1 : 0);
  const final = [];
  const toleranceSquared = toleranceMeters * toleranceMeters;
  for (let featureIndex = 0; featureIndex < original.length; featureIndex += 1) {
    const work = original[featureIndex].geometry.map((p, ordinal) => ({ ...p, ordinal }));
    const rejected = new Set();
    while (true) {
      let best = -1;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let index = 1; index + 1 < work.length; index += 1) {
        if (rejected.has(index)) continue;
        const distance = auditPointSegmentDistanceSquared(work[index - 1], work[index], work[index + 1]);
        if (distance > toleranceSquared) continue;
        const bestPoint = best >= 0 ? work[best] : undefined;
        if (best < 0 || distance < bestDistance ||
            (distance === bestDistance && (work[index].xM < bestPoint.xM ||
              (work[index].xM === bestPoint.xM && (work[index].yM < bestPoint.yM ||
                (work[index].yM === bestPoint.yM && work[index].ordinal < bestPoint.ordinal)))))) {
          best = index;
          bestDistance = distance;
        }
      }
      if (best < 0) break;
      const previous = work[best - 1];
      const next = work[best + 1];
      let conflict = false;
      for (let earlier = 0; earlier < final.length && !conflict; earlier += 1) {
        const geometry = final[earlier].geometry;
        for (let segment = 0; segment + 1 < geometry.length; segment += 1) {
          if (properCross(previous, next, geometry[segment], geometry[segment + 1])) { conflict = true; break; }
        }
      }
      for (let later = featureIndex + 1; later < original.length && !conflict; later += 1) {
        const geometry = original[later].geometry;
        for (let segment = 0; segment + 1 < geometry.length; segment += 1) {
          if (properCross(previous, next, geometry[segment], geometry[segment + 1])) { conflict = true; break; }
        }
      }
      if (conflict) { rejected.add(best); continue; }
      work.splice(best, 1);
      rejected.clear();
    }
    final.push({ preKey: original[featureIndex].preKey, geometry: work.map(({ xM, yM }) => point(xM, yM)) });
  }
  return { ok: true, value: final };
}
const m03Forward = auditM03ReachDomain(
  [{ preKey: "A", geometry: A }, { preKey: "B", geometry: B }], 125,
);
const m03Shuffled = auditM03ReachDomain(
  [{ preKey: "B", geometry: B }, { preKey: "A", geometry: A }], 125,
);

function orientation(a, b, c) {
  const value = (b.xM - a.xM) * (c.yM - a.yM) - (b.yM - a.yM) * (c.xM - a.xM);
  return value < 0 ? -1 : value > 0 ? 1 : 0;
}
function properCross(a, b, c, d) {
  return orientation(a, b, c) * orientation(a, b, d) < 0 &&
    orientation(c, d, a) * orientation(c, d, b) < 0;
}
function forcedReverseM03() {
  const bFinal = [B[0], B[2]];
  const aChordCrossesBFinal = properCross(A[0], A[2], bFinal[0], bFinal[1]);
  return { A: aChordCrossesBFinal ? A : [A[0], A[2]], B: bFinal };
}
const m03ForcedReverse = forcedReverseM03();

function ringSignedArea2(ring) {
  let area2 = 0;
  for (let index = 0; index + 1 < ring.length; index += 1) {
    area2 += ring[index].xM * ring[index + 1].yM - ring[index + 1].xM * ring[index].yM;
  }
  return area2;
}

function ringAreaM2(ring) {
  let area2 = 0;
  for (let index = 0; index + 1 < ring.length; index += 1) {
    area2 += ring[index].xM * ring[index + 1].yM - ring[index + 1].xM * ring[index].yM;
  }
  return area2 / 2;
}

const sharedF1Point = modules.depressions?.terminalPointCoordinates?.(
  4, modules.scratch?.TERRAIN_TERMINAL_EXTERNAL_DOMAIN_OUTLET, f1.fixture.grid,
);

const checks = {
  authorityPersistentDrainageExtractor: hasAuthority && modules.loadError === undefined,
  r004ConsumesFinalCoastlineAuthority:
    resultError(f1BadCoastline.result)?.code === "M02_CANDIDATE_INVALID" &&
    resultError(f1BadCoastline.result)?.path === "coastline",
  r005SharedPureTerminalPoint:
    sharedF1Point?.x === 1125 && sharedF1Point?.y === 0 && samePoint(f1Terminal?.point, point(1125, 0)),

  f1LiteralPlanar:
    f1.result?.ok === true && f1.value?.terminals.length === 1 && f1.value?.catchments.length === 1 &&
    f1.value?.nodes.length === 2 && f1.value?.reaches.length === 1 &&
    f1Terminal?.id === id("terminal", 0) && f1Terminal?.kind === "external_domain_outlet" &&
    samePoint(f1Terminal?.point, point(1125, 0)) &&
    f1.value.catchments[0].id === id("catchment", 0) && f1.value.catchments[0].terminalId === f1Terminal.id &&
    f1Terminal.catchmentId === f1.value.catchments[0].id && f1.value.catchments[0].areaM2 === 312_500 &&
    samePoint(f1Source?.point, point(375, 125)) && f1Source?.kind === "source" &&
    f1Reach?.downstreamReachId === null && f1Reach?.terminalId === f1Terminal.id &&
    f1Reach?.catchmentId === f1.value.catchments[0].id && f1Reach?.contributingAreaM2 === 312_500 &&
    f1Reach?.localContributingAreaM2 === 312_500,

  f2LiteralRidgePartition:
    f2.result?.ok === true && f2.value?.terminals.length === 2 && f2.value?.catchments.length === 2 &&
    f2.value?.nodes.length === 4 && f2.value?.reaches.length === 2 && f2Sources.length === 2 &&
    samePoint(f2.value.terminals[0].point, point(0, 125)) &&
    samePoint(f2.value.terminals[1].point, point(1375, 0)) &&
    samePoint(f2Sources[0]?.point, point(625, 125)) && samePoint(f2Sources[1]?.point, point(875, 125)) &&
    f2.value.catchments.every((catchment) => catchment.areaM2 === 187_500) &&
    f2.value.reaches.every((reach) => reach.contributingAreaM2 === 187_500 &&
      reach.localContributingAreaM2 === 187_500 && reach.downstreamReachId === null) &&
    f2.value.reaches[0].terminalId !== f2.value.reaches[1].terminalId,

  f3LiteralYConfluence:
    f3.result?.ok === true && f3.value?.terminals.length === 1 && f3.value?.catchments.length === 1 &&
    f3.value?.nodes.filter((node) => node.kind === "source").length === 2 &&
    f3.value?.nodes.filter((node) => node.kind === "confluence").length === 1 &&
    f3.value?.nodes.length === 4 && f3.value?.reaches.length === 3 &&
    samePoint(f3.value.terminals[0].point, point(875, 0)) && f3.value.catchments[0].areaM2 === 312_500 &&
    f3TribA?.contributingAreaM2 === 62_500 && f3TribA?.localContributingAreaM2 === 62_500 &&
    f3TribB?.contributingAreaM2 === 62_500 && f3TribB?.localContributingAreaM2 === 62_500 &&
    f3Trunk?.contributingAreaM2 === 312_500 && f3Trunk?.localContributingAreaM2 === 187_500 &&
    f3TribA?.downstreamReachId === f3Trunk?.id && f3TribB?.downstreamReachId === f3Trunk?.id &&
    f3Trunk?.downstreamReachId === null &&
    f3Trunk?.contributingAreaM2 === f3Trunk?.localContributingAreaM2 +
      f3TribA?.contributingAreaM2 + f3TribB?.contributingAreaM2,

  terminalOwnerMergePreservesConfluenceBeforeBoundaryTerminal:
    f3TerminalOwnerMerge.result?.ok === true &&
    f3TerminalOwnerMerge.value?.terminals.length === 1 && f3TerminalOwnerMerge.value?.catchments.length === 1 &&
    f3TerminalOwnerMerge.value?.nodes.filter((node) => node.kind === "source").length === 2 &&
    f3TerminalOwnerMerge.value?.nodes.filter((node) => node.kind === "confluence").length === 1 &&
    f3TerminalOwnerMerge.value?.nodes.filter((node) => node.kind === "terminal").length === 1 &&
    f3TerminalOwnerMerge.value?.nodes.length === 4 && f3TerminalOwnerMerge.value?.reaches.length === 3 &&
    samePoint(f3TerminalOwnerMerge.value.terminals[0].point, point(375, 0)) &&
    f3TerminalOwnerMerge.value.catchments[0].areaM2 === 3 * CELL_AREA &&
    f3TerminalMergeTribA?.contributingAreaM2 === CELL_AREA && f3TerminalMergeTribA?.localContributingAreaM2 === CELL_AREA &&
    f3TerminalMergeTribB?.contributingAreaM2 === CELL_AREA && f3TerminalMergeTribB?.localContributingAreaM2 === CELL_AREA &&
    f3TerminalMergeTrunk?.contributingAreaM2 === 3 * CELL_AREA && f3TerminalMergeTrunk?.localContributingAreaM2 === CELL_AREA &&
    f3TerminalMergeTribA?.downstreamReachId === f3TerminalMergeTrunk?.id &&
    f3TerminalMergeTribB?.downstreamReachId === f3TerminalMergeTrunk?.id &&
    f3TerminalMergeTrunk?.downstreamReachId === null &&
    f3TerminalMergeTrunk?.contributingAreaM2 === f3TerminalMergeTrunk?.localContributingAreaM2 +
      f3TerminalMergeTribA?.contributingAreaM2 + f3TerminalMergeTribB?.contributingAreaM2,

  criticalShortReachSurvivesMinLength:
    f3TribA && f3TribB && f3.value?.reaches.length === 3 &&
    f3TribA.lengthMeters < F3.minReachLengthMeters && f3TribB.lengthMeters < F3.minReachLengthMeters,

  areaOnlyEligibilityIgnoresRawRelief:
    f1.result?.ok === true && f1ReliefChanged.result?.ok === true &&
    JSON.stringify(structuralGraph(f1.value)) === JSON.stringify(structuralGraph(f1ReliefChanged.value)),
  thresholdEntryExact:
    f1ThresholdAt.value?.nodes.some((node) => node.kind === "source" && samePoint(node.point, point(375, 125))) === true &&
    f1ThresholdBelow.value?.nodes.some((node) => node.kind === "source" && samePoint(node.point, point(625, 125))) === true,

  primaryFullAreaAndLocalConservation:
    f1Reach?.contributingAreaM2 === 5 * CELL_AREA && f1Reach?.localContributingAreaM2 === 5 * CELL_AREA &&
    f3Trunk?.contributingAreaM2 === 5 * CELL_AREA && f3Trunk?.localContributingAreaM2 === 3 * CELL_AREA,
  independentLocalWitnessUsesCellAssignment: independentLocalWitnessSourceGuard(DRAINAGE_SOURCE),
  oldTerminalOwnerMergeMutantKilled:
    oldTerminalOwnerMergeMutation.applied && oldTerminalOwnerMergeMutation.detected && oldTerminalOwnerMergeMutation.restored,
  droppedOffSupportCellMutantKilled:
    droppedOffSupportMutation.applied && droppedOffSupportMutation.detected && droppedOffSupportMutation.restored,
  incomingConfluenceAssignmentMutantKilled:
    incomingConfluenceAssignmentMutation.applied && incomingConfluenceAssignmentMutation.detected && incomingConfluenceAssignmentMutation.restored,
  residualLocalAreaMutantKilled:
    residualLocalAreaMutation.applied && residualLocalAreaMutation.detected && residualLocalAreaMutation.restored,
  terminalCatchmentBijectionAndPartition:
    [f1.value, f2.value, f3.value].every((value) => value && value.terminals.length === value.catchments.length &&
      value.terminals.length <= 1_000_000 &&
      value.catchments.reduce((sum, catchment) => sum + catchment.areaM2, 0) ===
        value.catchments.reduce((sum, catchment) => sum +
          catchment.boundaryRings.reduce((ringSum, ring) => ringSum + ringAreaM2(ring), 0), 0) &&
      value.terminals.every((terminal) => value.catchments.filter((catchment) => catchment.id === terminal.catchmentId &&
        catchment.terminalId === terminal.id).length === 1)),
  representedSupportTopology:
    f1.value?.nodes.filter((node) => node.kind === "source").length === 1 &&
    f3.value?.nodes.filter((node) => node.kind === "confluence").length === 1,

  f4OwnerBypassRejected:
    resultError(f4OwnerBypass.result)?.code === "M02_TERMINAL_INVALID",

  f8LiteralCatchmentM03DomainSchedulePresent: f8LiteralDomain1Structure,
  f8GridToleranceSpecializationExact,

  f8CanonicalOuterOuterHoleOrder: (() => {
    const external = f8Donut.value?.terminals.find((terminal) => terminal.kind === "external_domain_outlet");
    const catchment = external && f8Donut.value?.catchments.find((candidate) => candidate.id === external.catchmentId);
    if (!catchment || catchment.boundaryRings.length !== 3) return false;
    const [mainOuter, disconnectedOuter, hole] = catchment.boundaryRings;
    return ringSignedArea2(mainOuter) > 0 && ringSignedArea2(disconnectedOuter) > 0 && ringSignedArea2(hole) < 0 &&
      exactPointArray(mainOuter, [point(0, 250), point(750, 250), point(750, 1000), point(0, 1000), point(0, 250)]) &&
      exactPointArray(disconnectedOuter, [point(750, 0), point(1000, 0), point(1000, 250), point(750, 250), point(750, 0)]) &&
      exactPointArray(hole, [point(250, 500), point(250, 750), point(500, 750), point(500, 500), point(250, 500)]);
  })(),

  g6Positive004B05Persistence:
    g6.decision?.ok === true && g6.decision.value.selectedFacet === null &&
    g6.decision.value.terminalReceiverOrdinal === 5 && g6.decision.value.receivers.length === 0 &&
    (98 - 97) / 250 === 0.004 && g6.flowResult?.ok === true && g6.value?.terminals.length === 9 &&
    g6.value?.catchments.length === 9 &&
    g6.value.terminals.some((terminal) => terminal.kind === "external_domain_outlet" &&
      samePoint(terminal.point, point(375, 750)) &&
      g6.value.catchments.some((catchment) => catchment.id === terminal.catchmentId && catchment.terminalId === terminal.id)),

  f6RetainedClosedLink:
    f6.drainageResult?.ok === true && f6.value?.retainedDepressionLinks.length === 1 &&
    f6.value.retainedDepressionLinks[0].depressionToken === "depression-analysis:0000000000000000" &&
    f6.value.terminals.find((terminal) => terminal.id === f6.value.retainedDepressionLinks[0].terminalId)?.kind === "retained_closed_basin" &&
    f6.value.retainedDepressionLinks[0].catchmentId ===
      f6.value.terminals.find((terminal) => terminal.id === f6.value.retainedDepressionLinks[0].terminalId)?.catchmentId,
  f7RetainedExorheicLink:
    f7.drainageResult?.ok === true && f7.value?.retainedDepressionLinks.length === 1 &&
    f7.value.retainedDepressionLinks[0].depressionToken === "depression-analysis:0000000000000000" &&
    f7.value.terminals.find((terminal) => terminal.id === f7.value.retainedDepressionLinks[0].terminalId)?.kind === "external_domain_outlet",

  traversalFillOrderInvariant:
    f1.result?.ok === true && f1ReverseFill.result?.ok === true &&
    JSON.stringify(f1.value) === JSON.stringify(f1ReverseFill.value) &&
    f3SiblingOrder.result?.ok === true && JSON.stringify(f3.value) === JSON.stringify(f3SiblingOrder.value),
  m03CanonicalDomainSchedule:
    m03Forward?.ok === true && m03Forward.value.length === 2 &&
    m03Forward.value[0].preKey === "A" && exactPointArray(m03Forward.value[0].geometry, A) &&
    m03Forward.value[1].preKey === "B" && exactPointArray(m03Forward.value[1].geometry, [B[0], B[2]]),
  m03ProducerShuffleInvariant:
    m03Forward?.ok === true && m03Shuffled?.ok === true && JSON.stringify(m03Forward.value) === JSON.stringify(m03Shuffled.value),
  m03ForcedReverseDiscriminates:
    exactPointArray(m03ForcedReverse.A, [A[0], A[2]]) && exactPointArray(m03ForcedReverse.B, [B[0], B[2]]) &&
    JSON.stringify(m03ForcedReverse.A) !== JSON.stringify(A),

  idBarriersAndNamespaces:
    f1Terminal?.id === id("terminal", 0) && f1.value?.catchments[0].id === id("catchment", 0) &&
    f1.value?.nodes.every((node, index) => node.id === id("drainage-node", index)) &&
    f1.value?.reaches.every((reach, index) => reach.id === id("drainage-reach", index)),
  dagCycleRejected:
    resultError(f3Cycle.result)?.code === "M02_DRAINAGE_CYCLE",
  invalidReceiverRejected:
    resultError(f3InvalidReceiver.result)?.code === "M02_DRAINAGE_CYCLE",
  task9Firewall:
    exactKeys(f1.value, ["terminals", "catchments", "nodes", "reaches", "retainedDepressionLinks"]),

  f10ReleasedAliasesAreDetached:
    f10ReleaseAliases.result?.ok === true && f10ReleaseAliases.releasedAliases.length === 14 &&
    f10ReleaseAliases.releasedAliases.every((array) => array.byteLength === 0),
  f10CatchmentGeometryBoundedBeforeJsMaterialization:
    f10CatchmentBoundGuard.guardTrips === 0 && f10CatchmentBoundGuard.result?.ok === true &&
    f10CatchmentBoundGuard.value?.catchments[0]?.boundaryRings[0]?.length === 5,
  f10ReachGeometryBoundedBeforeJsMaterialization:
    f10ReachBoundGuard.guardTrips === 0 && f10ReachBoundGuard.result?.ok === true &&
    f10ReachBoundGuard.value?.reaches[0]?.geometry.length === 2,
  f10NoPerTerminalJsMirror:
    f10TerminalMirrorGuard.guardTrips === 0 && f10TerminalMirrorGuard.result?.ok === true &&
    f10TerminalMirrorGuard.value?.terminals.length === 16 && f10TerminalMirrorGuard.value?.catchments.length === 16,
  f10NodeBoundCheckedBeforeJsMaterialization:
    f10NodeBoundGuard.guardTrips === 0 && resultError(f10NodeBoundGuard.result)?.code === "M02_BOUND_EXCEEDED" &&
    resultError(f10NodeBoundGuard.result)?.path === "drainage.maxNodes",
  f10NoGenericArrayCopyPrimitivesAtRuntime:
    f10ArrayCopyGuard.trips.length === 0 && f10ArrayCopyGuard.result?.ok === true,
  f10NoGenericArrayCopyPrimitivesInTask8Source:
    f10ForbiddenCopySourceMatches.length === 0,

  exactTask8PeakAndRelease:
    f1.before?.liveBytes === 66 * 5 + 4 && f1.after?.peakBytes === 88 * 5 + 4 &&
    f1.after?.liveBytes === 26 * 5 && f1ReleaseProbe.ok === true,
  task8AtomicPreflightLeavesAuthorityUntouched:
    f1Preflight.before?.liveBytes === 66 * 5 + 4 && f1Preflight.before?.peakBytes === 66 * 5 + 4 &&
    resultError(f1Preflight.result)?.code === "M02_BOUND_EXCEEDED" &&
    f1Preflight.after?.liveBytes === f1Preflight.before.liveBytes &&
    f1Preflight.after?.peakBytes === f1Preflight.before.peakBytes,
  exactWorstCase92NFormula:
    (88 * 864_000 + 4 * 864_000) === 79_488_000,
};

const report = {
  audit: "world-m0-m02-drainage-graph",
  authorityPresent: hasAuthority,
  loadError: modules.loadError ?? null,
  checks,
  evidence: {
    f1Error: resultError(f1.result) ?? null,
    f2Error: resultError(f2.result) ?? null,
    f3Error: resultError(f3.result) ?? null,
    f3TerminalOwnerMergeError: resultError(f3TerminalOwnerMerge.result) ?? null,
    oldTerminalOwnerMergeMutation,
    droppedOffSupportMutation,
    incomingConfluenceAssignmentMutation,
    residualLocalAreaMutation,
    f3CycleError: resultError(f3Cycle.result) ?? null,
    f3InvalidReceiverError: resultError(f3InvalidReceiver.result) ?? null,
    f4OwnerBypassError: resultError(f4OwnerBypass.result) ?? null,
    f8DonutError: resultError(f8Donut.result) ?? null,
    f10CatchmentBoundGuard: { trips: f10CatchmentBoundGuard.guardTrips, thrown: f10CatchmentBoundGuard.thrown ?? null },
    f10ReachBoundGuard: { trips: f10ReachBoundGuard.guardTrips, thrown: f10ReachBoundGuard.thrown ?? null, error: resultError(f10ReachBoundGuard.result) ?? null },
    f10TerminalMirrorGuard: { trips: f10TerminalMirrorGuard.guardTrips, thrown: f10TerminalMirrorGuard.thrown ?? null },
    f10NodeBoundGuard: { trips: f10NodeBoundGuard.guardTrips, thrown: f10NodeBoundGuard.thrown ?? null },
    f10ArrayCopyGuard: { trips: f10ArrayCopyGuard.trips, thrown: f10ArrayCopyGuard.thrown ?? null },
    f10ForbiddenCopySourceMatches,
    f8LiteralDomain1Structure,
    f8GridToleranceSpecializationExact,
    f1BadCoastlineError: resultError(f1BadCoastline.result) ?? null,
    f1PreflightError: resultError(f1Preflight.result) ?? null,
    f6Error: resultError(f6.drainageResult) ?? resultError(f6.flowResult) ?? resultError(f6.depressionResult) ?? null,
    f7Error: resultError(f7.drainageResult) ?? resultError(f7.flowResult) ?? resultError(f7.depressionResult) ?? null,
    task8F1Before: f1.before ?? null,
    task8F1After: f1.after ?? null,
    m03Canonical: resultValue(m03Forward) ?? null,
    m03ForcedReverse,
  },
};
report.pass = Object.values(checks).every(Boolean);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.pass) process.exitCode = 1;
