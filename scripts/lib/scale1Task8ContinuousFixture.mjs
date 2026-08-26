// SCALE-1 Task 8 — ONE continuous physical fixture, deterministically rasterized at 1.0 km or 1.5 km.
// Physical coordinates/features below are the sole fixture authority. Per-resolution worlds are
// projections of this object; no raster-specific feature tuning is permitted here.

export const TASK8_PHYSICAL_FIXTURE = Object.freeze({
  extentKm: Object.freeze({ width: 18, height: 15 }),
  river: Object.freeze({ xKm: 9, fordYKm: 4.5, capabilityCrossingYKm: 10.5 }),
  obstacle: Object.freeze({ minXKm: 4.5, maxXKm: 7.5, minYKm: 6, maxYKm: 9, movementCost: 8 }),
  points: Object.freeze({
    origin: Object.freeze({ xKm: 2.25, yKm: 7.5 }),
    nearTarget: Object.freeze({ xKm: 2.25, yKm: 6.5 }),
    distantTarget: Object.freeze({ xKm: 14.25, yKm: 7.5 }),
    routeChoiceTarget: Object.freeze({ xKm: 8.25, yKm: 7.5 }),
    cueTarget: Object.freeze({ xKm: 12.25, yKm: 12 }),
    catchmentOrigin: Object.freeze({ xKm: 13.5, yKm: 4.5 }),
    catchmentEast: Object.freeze({ xKm: 16.5, yKm: 4.5 }),
    edgeStart: Object.freeze({ xKm: 2.25, yKm: 2.25 }),
    edgeEnd: Object.freeze({ xKm: 5.25, yKm: 2.25 }),
    crossingOrigin: Object.freeze({ xKm: 7.25, yKm: 10.5 }),
    crossingTarget: Object.freeze({ xKm: 10.75, yKm: 10.5 }),
    socialNear: Object.freeze({ xKm: 5.25, yKm: 7.5 }),
    socialFar: Object.freeze({ xKm: 8.25, yKm: 7.5 }),
    localShift: Object.freeze({ xKm: 4.65, yKm: 7.5 }),
    relocation: Object.freeze({ xKm: 14.75, yKm: 7.5 }),
    fission: Object.freeze({ xKm: 8.25, yKm: 7.5 }),
    spawnTooNear: Object.freeze({ xKm: 14.25, yKm: 7.5 }),
    spawnFarEnough: Object.freeze({ xKm: 16.25, yKm: 7.5 }),
  }),
});

const EPSILON = 1e-9;

export function rasterizeTask8Fixture(templateWorld, cellKm) {
  if (cellKm !== 1 && cellKm !== 1.5) {
    throw new Error(`Task-8 fixture supports only 1.0 km and 1.5 km rasters, got ${cellKm}`);
  }
  const width = TASK8_PHYSICAL_FIXTURE.extentKm.width / cellKm;
  const height = TASK8_PHYSICAL_FIXTURE.extentKm.height / cellKm;
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    throw new Error(`Fixture extent must rasterize exactly at ${cellKm} km`);
  }

  const templateTile = Object.values(templateWorld.tiles)[0];
  const templateBand = Object.values(templateWorld.bands)
    .sort((left, right) => String(left.id).localeCompare(String(right.id)))[0];
  if (templateTile === undefined || templateBand === undefined) {
    throw new Error("Task-8 fixture needs one canonical template tile and band");
  }

  const idAt = (x, y) => `task8:${cellKm}:${x}:${y}`;
  const tiles = {};
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const center = cellCenter(cellKm, x, y);
      const id = idAt(x, y);
      const neighbors = [];
      if (x > 0) neighbors.push(idAt(x - 1, y));
      if (x + 1 < width) neighbors.push(idAt(x + 1, y));
      if (y > 0) neighbors.push(idAt(x, y - 1));
      if (y + 1 < height) neighbors.push(idAt(x, y + 1));
      const inObstacle = pointInRect(center, TASK8_PHYSICAL_FIXTURE.obstacle);
      tiles[id] = {
        ...templateTile,
        id,
        coord: { x, y },
        neighbors,
        terrainKind: inObstacle ? "hills" : "grassland",
        elevation: inObstacle ? 0.26 : 0.18,
        movementCost: inObstacle ? TASK8_PHYSICAL_FIXTURE.obstacle.movementCost : 1,
        isAquatic: false,
        isRiver: false,
        isRiverbank: false,
        isCoastal: false,
        isEstuary: false,
        isConfluence: false,
        isFloodplain: false,
        isMarshChannel: false,
        hasCreek: false,
        riverSegmentId: undefined,
        resourceProfile: {
          ...templateTile.resourceProfile,
          baseRichness: 0.45,
          waterAccess: 0.3,
          aquaticPotential: 0,
        },
        riskProfile: {
          ...templateTile.riskProfile,
          floodRisk: 0.05,
          droughtRisk: 0.2,
          diseaseRisk: 0.1,
        },
      };
    }
  }

  const pointTileIds = Object.fromEntries(
    Object.entries(TASK8_PHYSICAL_FIXTURE.points).map(([name, point]) => [name, tileIdForPhysicalPoint(cellKm, width, height, point)]),
  );

  // One distant physical landmark; this does not create observation/route knowledge.
  const cueId = pointTileIds.cueTarget;
  tiles[cueId] = {
    ...tiles[cueId],
    terrainKind: "lake",
    isAquatic: true,
    resourceProfile: {
      ...tiles[cueId].resourceProfile,
      waterAccess: 0.95,
      aquaticPotential: 0.8,
    },
  };

  const riverCrossings = buildRiverCrossings({ cellKm, width, height, idAt });
  const originId = pointTileIds.origin;
  const bandA = makeBand(templateBand, "band:task8:A", originId, tiles[originId]);
  const bands = { [bandA.id]: bandA };

  const config = {
    ...templateWorld.config,
    width,
    height,
    spatial: {
      cellWidthKm: cellKm,
      cellHeightKm: cellKm,
      coordinateFrame: "cartesian_cell_centers",
      connectivity: "cardinal_4",
    },
  };

  const world = {
    ...templateWorld,
    config,
    tiles,
    bands,
    rivers: {},
    riverCrossings,
    time: { ...templateWorld.time, tick: 0, season: "summer" },
  };

  return {
    world,
    band: bandA,
    pointTileIds,
    raster: {
      cellKm,
      width,
      height,
      cellCount: width * height,
      pointCenters: Object.fromEntries(
        Object.entries(pointTileIds).map(([name, id]) => [name, physicalCenterForTile(world, id)]),
      ),
    },
  };
}

export function makeTask8Band(templateBand, id, positionTileId, tile, options = {}) {
  const band = makeBand(templateBand, id, positionTileId, tile);
  return {
    ...band,
    ...options,
    id,
    position: positionTileId,
    knowledge: {
      ...band.knowledge,
      ...(options.knowledge ?? {}),
      selfBandId: id,
    },
  };
}

export function makeCapableTask8Band(templateBand, id, positionTileId, tile) {
  const base = makeBand(templateBand, id, positionTileId, tile);
  return {
    ...base,
    practicalAdaptation: {
      ...(base.practicalAdaptation ?? {}),
      responses: [{ family: "engineering_structure", status: "active" }],
      fragments: [
        { subject: "buoyancy_under_load", knowledgeState: "usable" },
        { subject: "binding_under_load", knowledgeState: "usable" },
        { subject: "staged_shuttle_crossing", knowledgeState: "usable" },
      ],
    },
  };
}

export function physicalCenterForTile(world, tileId) {
  const tile = world.tiles[tileId];
  if (tile === undefined) return undefined;
  return cellCenter(world.config.spatial.cellWidthKm, tile.coord.x, tile.coord.y);
}

export function continuousPointErrorKm(point, center) {
  return center === undefined ? Number.POSITIVE_INFINITY : Math.hypot(point.xKm - center.xKm, point.yKm - center.yKm);
}

export function pointQuantizationRadiusKm(cellKm) {
  return Math.hypot(cellKm, cellKm) / 2;
}

export function crossResolutionPointToleranceKm(firstCellKm, secondCellKm) {
  return pointQuantizationRadiusKm(firstCellKm) + pointQuantizationRadiusKm(secondCellKm);
}

export function crossResolutionDistanceToleranceKm(firstCellKm, secondCellKm) {
  // Each endpoint can move by q on each raster. By triangle inequality a segment length can
  // differ from its continuous segment by at most 2q, hence cross-raster difference <=2(q1+q2).
  return 2 * crossResolutionPointToleranceKm(firstCellKm, secondCellKm);
}

export function crossResolutionRouteToleranceKm(firstCellKm, secondCellKm, continuousSegmentCount) {
  // A polyline with N continuous segments has two endpoint perturbations per segment. A raster's
  // path-length error is <=2*N*q; comparing two rasters therefore gives 2*N*(q1+q2).
  return 2 * Math.max(1, continuousSegmentCount) * crossResolutionPointToleranceKm(firstCellKm, secondCellKm);
}

export function rasterBoundaryAreaToleranceKm2(cellKm, boundaryPerimeterKm) {
  // Any center-classified raster disagreement lies inside a q-neighborhood of the physical boundary.
  // A conservative two-sided tube bound is 2*P*q + pi*q^2 (Steiner-style boundary dilation).
  const q = pointQuantizationRadiusKm(cellKm);
  return 2 * Math.max(0, boundaryPerimeterKm) * q + Math.PI * q * q;
}

export function crossResolutionAreaToleranceKm2(firstCellKm, secondCellKm, boundaryPerimeterKm) {
  return rasterBoundaryAreaToleranceKm2(firstCellKm, boundaryPerimeterKm) +
    rasterBoundaryAreaToleranceKm2(secondCellKm, boundaryPerimeterKm);
}

export function physicalDistanceBetweenPoints(first, second) {
  return Math.hypot(second.xKm - first.xKm, second.yKm - first.yKm);
}

export function directCardinalRoute(world, fromTileId, toTileId) {
  const from = world.tiles[fromTileId];
  const to = world.tiles[toTileId];
  if (from === undefined || to === undefined) return undefined;
  const route = [from.id];
  let x = from.coord.x;
  let y = from.coord.y;
  const stepX = Math.sign(to.coord.x - x);
  while (x !== to.coord.x) {
    x += stepX;
    route.push(`task8:${world.config.spatial.cellWidthKm}:${x}:${y}`);
  }
  const stepY = Math.sign(to.coord.y - y);
  while (y !== to.coord.y) {
    y += stepY;
    route.push(`task8:${world.config.spatial.cellWidthKm}:${x}:${y}`);
  }
  return route.every((id) => world.tiles[id] !== undefined) ? route : undefined;
}

function makeBand(templateBand, id, positionTileId, tile) {
  const observedRecord = {
    tileId: positionTileId,
    observedRichness: 0.45,
    observedWaterAccess: 0.3,
    observedAquaticPotential: 0,
    observedMovementCost: tile.movementCost,
    observedRisk: 0.1,
    confidence: 0.9,
    knowledgeSource: "personally_observed",
  };
  return {
    ...templateBand,
    id,
    name: id,
    position: positionTileId,
    status: templateBand.status,
    parentBandId: undefined,
    daughterBandIds: [],
    expeditions: [],
    recentIntraSeasonTrips: [],
    crossingMemories: {},
    placeMemory: {},
    contactMemories: {},
    usePressure: {},
    visibleLandscapeCues: [],
    residentialAnchor: {
      ...(templateBand.residentialAnchor ?? {}),
      anchorTileId: positionTileId,
      catchmentTileIds: [positionTileId],
      foragingTravelTimeBudgetDays: 0.5,
      logisticalTravelTimeBudgetDays: 0.5,
    },
    knowledge: {
      ...templateBand.knowledge,
      selfBandId: id,
      observedTiles: { [positionTileId]: observedRecord },
      tileObservationHistory: [],
      knownBands: {},
    },
  };
}

function buildRiverCrossings({ cellKm, width, height, idAt }) {
  const crossings = {};
  const boundaryX = TASK8_PHYSICAL_FIXTURE.river.xKm / cellKm;
  if (!Number.isInteger(boundaryX) || boundaryX <= 0 || boundaryX >= width) {
    throw new Error(`River x=${TASK8_PHYSICAL_FIXTURE.river.xKm} km must align to raster boundary at ${cellKm} km`);
  }
  const leftX = boundaryX - 1;
  const rightX = boundaryX;
  for (let y = 0; y < height; y += 1) {
    const centerY = (y + 0.5) * cellKm;
    const fromTileId = idAt(leftX, y);
    const toTileId = idAt(rightX, y);
    const nearFord = Math.abs(centerY - TASK8_PHYSICAL_FIXTURE.river.fordYKm) <= cellKm / 2 + EPSILON;
    const nearCapability = Math.abs(centerY - TASK8_PHYSICAL_FIXTURE.river.capabilityCrossingYKm) <= cellKm / 2 + EPSILON;
    const crossingClass = nearFord ? "ford" : "impassable_without_watercraft";
    const key = [fromTileId, toTileId].sort().join("|");
    crossings[key] = {
      fromTileId,
      toTileId,
      riverId: "river:task8",
      crossingClass,
      baseCrossingCost: nearFord ? 0.08 : nearCapability ? 0.12 : 0.18,
      seasonalCostModifier: 0,
      risk: nearFord ? 0.05 : 0.16,
      knownFord: nearFord,
      confidence: 1,
    };
  }
  return crossings;
}

function tileIdForPhysicalPoint(cellKm, width, height, point) {
  const x = Math.max(0, Math.min(width - 1, Math.floor(point.xKm / cellKm)));
  const y = Math.max(0, Math.min(height - 1, Math.floor(point.yKm / cellKm)));
  return `task8:${cellKm}:${x}:${y}`;
}

function cellCenter(cellKm, x, y) {
  return { xKm: (x + 0.5) * cellKm, yKm: (y + 0.5) * cellKm };
}

function pointInRect(point, rect) {
  return point.xKm >= rect.minXKm - EPSILON && point.xKm <= rect.maxXKm + EPSILON &&
    point.yKm >= rect.minYKm - EPSILON && point.yKm <= rect.maxYKm + EPSILON;
}
