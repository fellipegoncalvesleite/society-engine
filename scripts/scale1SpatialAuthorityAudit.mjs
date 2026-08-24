// SCALE-1 Task 1 — world-specific physical spatial authority.
// TDD audit: written before the production spatial modules.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createServer } from "vite";

const ROOT = process.cwd();
const spatialGeometryPath = `${ROOT}/src/sim/world/spatialGeometry.ts`;
const spatialTypesPath = `${ROOT}/src/sim/world/spatialTypes.ts`;
const server = await createServer({
  root: `${ROOT}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

let out;
try {
  const generate = await server.ssrLoadModule("/sim/world/generate.ts");
  const hasSpatialModules = existsSync(spatialGeometryPath) && existsSync(spatialTypesPath);
  const geometry = hasSpatialModules
    ? await server.ssrLoadModule("/sim/world/spatialGeometry.ts")
    : undefined;

  const map1 = generate.REGIONAL_DEBUG_WORLD_CONFIG;
  const map2 = generate.VARIED_MIGRATION_WORLD_CONFIG;
  const map1Spatial = map1.spatial;
  const map2Spatial = map2.spatial;

  const map1Area = geometry && map1Spatial ? geometry.getCellAreaKm2(map1) : undefined;
  const map2Area = geometry && map2Spatial ? geometry.getCellAreaKm2(map2) : undefined;
  const map1Extent = geometry && map1Spatial ? geometry.getWorldPhysicalExtentKm(map1) : undefined;
  const map2Extent = geometry && map2Spatial ? geometry.getWorldPhysicalExtentKm(map2) : undefined;
  const centerA = geometry && map2Spatial ? geometry.getPhysicalCellCenterKm(map2, { x: 2, y: 3 }) : undefined;
  const centerB = geometry && map2Spatial ? geometry.getPhysicalCellCenterKm(map2, { x: 5, y: 7 }) : undefined;
  const distance = geometry && map2Spatial
    ? geometry.getEuclideanPhysicalDistanceKm(map2, { x: 2, y: 3 }, { x: 5, y: 7 })
    : undefined;
  const horizontalEdge = geometry && map2Spatial
    ? geometry.getCardinalEdgeLengthKm(map2, { x: 2, y: 3 }, { x: 3, y: 3 })
    : undefined;
  const verticalEdge = geometry && map2Spatial
    ? geometry.getCardinalEdgeLengthKm(map2, { x: 2, y: 3 }, { x: 2, y: 4 })
    : undefined;
  const boundedWindow = geometry && map2Spatial
    ? geometry.getRasterWindowForPhysicalRadius(map2, { x: 0, y: 0 }, 3.1)
    : undefined;

  const geometrySource = existsSync(spatialGeometryPath) ? readFileSync(spatialGeometryPath, "utf8") : "";
  const rendererSource = readFileSync(`${ROOT}/src/render/canvasRenderer.ts`, "utf8");
  const simImportsRenderer = [...recursiveTypeScriptFiles(`${ROOT}/src/sim`)].some((path) => {
    const source = readFileSync(path, "utf8");
    return /from\s+["'][^"']*(?:render|canvasRenderer)[^"']*["']/.test(source);
  });

  const checks = {
    focusedSpatialModulesExist: hasSpatialModules,
    map1TrueOneKmCells:
      map1Spatial?.cellWidthKm === 1 && map1Spatial?.cellHeightKm === 1,
    map2TrueOnePointFiveKmCells:
      map2Spatial?.cellWidthKm === 1.5 && map2Spatial?.cellHeightKm === 1.5,
    coordinateFrameExplicit:
      map1Spatial?.coordinateFrame === "cartesian_cell_centers" &&
      map2Spatial?.coordinateFrame === "cartesian_cell_centers",
    connectivityExplicit:
      map1Spatial?.connectivity === "cardinal_4" && map2Spatial?.connectivity === "cardinal_4",
    derivedCellAreaCorrect: map1Area === 1 && map2Area === 2.25,
    derivedExtentsCorrect:
      map1Extent?.widthKm === map1.width &&
      map1Extent?.heightKm === map1.height &&
      map2Extent?.widthKm === map2.width * 1.5 &&
      map2Extent?.heightKm === map2.height * 1.5,
    physicalCellCentersCorrect:
      centerA?.xKm === 3.75 && centerA?.yKm === 5.25 &&
      centerB?.xKm === 8.25 && centerB?.yKm === 11.25,
    euclideanPhysicalDistanceCorrect: distance === 7.5,
    cardinalEdgesUseWorldScale: horizontalEdge === 1.5 && verticalEdge === 1.5,
    radiusWindowBoundedAndScaleDerived:
      boundedWindow?.minX === 0 && boundedWindow?.minY === 0 &&
      boundedWindow?.maxX === 3 && boundedWindow?.maxY === 3,
    geometryHasNoGlobalKmPerTile: !/KM_PER_TILE/.test(geometrySource),
    rendererCellSizeIsDisplayOnly:
      rendererSource.includes("cellSize") && !simImportsRenderer,
  };

  const pass = Object.values(checks).every(Boolean);
  out = {
    check: "SCALE1-SPATIAL-AUTHORITY",
    verdict: pass ? "PASS" : "FAIL",
    checks,
    measurements: {
      map1Spatial,
      map2Spatial,
      map1Area,
      map2Area,
      map1Extent,
      map2Extent,
      centerA,
      centerB,
      distance,
      horizontalEdge,
      verticalEdge,
      boundedWindow,
    },
  };
} finally {
  await server.close();
}

console.log(JSON.stringify(out, null, 2));
if (out.verdict !== "PASS") process.exitCode = 1;

function* recursiveTypeScriptFiles(root) {
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) stack.push(path);
      else if (entry.isFile() && /\.tsx?$/.test(entry.name)) yield path;
    }
  }
}
