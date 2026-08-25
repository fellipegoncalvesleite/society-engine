// SCALE-1 Task 6 — physical crowding equivalence + presence audit.
// TDD contract: written before Task-6 production implementation.
import { createServer } from "vite";

const ROOT = process.cwd();
const server = await createServer({
  root: `${ROOT}/src`, configFile: false, appType: "custom",
  server: { middlewareMode: true }, logLevel: "error",
});

const round = (value, places = 4) => {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
};

function makeLineWorld(cellKm, bandSpecs) {
  const width = 14;
  const tiles = {};
  for (let x = 0; x < width; x += 1) {
    const id = `tile:${x},0`;
    const neighbors = [];
    if (x > 0) neighbors.push(`tile:${x - 1},0`);
    if (x + 1 < width) neighbors.push(`tile:${x + 1},0`);
    tiles[id] = {
      id,
      coord: { x, y: 0 },
      neighbors,
      movementCost: 1,
      isAquatic: false,
      terrainKind: "plains",
      isFloodplain: false,
      isRiverbank: false,
      resourceProfile: { baseRichness: 0.5, waterAccess: 0.5, aquaticPotential: 0 },
      riskProfile: { floodRisk: 0, droughtRisk: 0.2, diseaseRisk: 0.1 },
    };
  }
  const bands = {};
  for (const spec of bandSpecs) {
    bands[spec.id] = makeBand(spec.id, `tile:${spec.x},0`, spec);
  }
  return {
    config: {
      width, height: 1,
      spatial: {
        cellWidthKm: cellKm, cellHeightKm: cellKm,
        coordinateFrame: "cartesian_cell_centers", connectivity: "cardinal_4",
      },
      seasonsPerYear: 4, yearsPerGeneration: 25, ticksPerGeneration: 100,
    },
    tiles,
    bands,
    rivers: {}, riverCrossings: {},
    time: { tick: 1, season: "summer" },
  };
}

function makeBand(id, position, options = {}) {
  return {
    id,
    position,
    name: id,
    status: "active",
    parentBandId: options.parentBandId,
    daughterBandIds: options.daughterBandIds ?? [],
    demography: {
      population: options.population ?? 36,
      workingAdults: 18, dependents: 12, elders: 6,
      householdCrowdingPressure: 0,
      foodPerPersonStress: 0,
    },
    expeditions: options.expeditions ?? [],
    placeMemory: options.placeMemory ?? {},
    contactMemories: options.contactMemories ?? {},
    crossingMemories: {},
    usePressure: {},
  };
}

function pressureAt(crowding, world, decidingBandId, tileId) {
  return crowding.getNearbyBandPressure(world, world.bands[decidingBandId], tileId);
}

let out;
try {
  const crowding = await server.ssrLoadModule("/sim/agents/crowding.ts");
  const geometry = await server.ssrLoadModule("/sim/world/spatialGeometry.ts");

  const near1 = makeLineWorld(1, [
    { id: "band:A", x: 2 },
    { id: "band:B", x: 5 }, // 3 km
  ]);
  const near15 = makeLineWorld(1.5, [
    { id: "band:A", x: 2 },
    { id: "band:B", x: 4 }, // 3 km
  ]);
  const outside1 = makeLineWorld(1, [
    { id: "band:A", x: 2 },
    { id: "band:B", x: 8 }, // 6 km
  ]);
  const outside15 = makeLineWorld(1.5, [
    { id: "band:A", x: 2 },
    { id: "band:B", x: 6 }, // 6 km
  ]);

  const p1 = pressureAt(crowding, near1, "band:A", "tile:2,0");
  const p15 = pressureAt(crowding, near15, "band:A", "tile:2,0");
  const out1 = pressureAt(crowding, outside1, "band:A", "tile:2,0");
  const out15 = pressureAt(crowding, outside15, "band:A", "tile:2,0");

  // Residence is 8 km away in the 1 km fixture, but a 12-person expedition is 3 km away.
  const expedition = {
    id: "exp:B:1",
    phase: "operating",
    partyWorkers: 8,
    nonWorkingPartyPeople: 4,
    positionTileId: "tile:5,0",
  };
  const awayWorld = makeLineWorld(1, [
    { id: "band:A", x: 2 },
    { id: "band:B", x: 10, population: 36, expeditions: [expedition] },
  ]);
  const awayPressure = pressureAt(crowding, awayWorld, "band:A", "tile:2,0");
  const presence = crowding.getBandPhysicalPresence(awayWorld.bands["band:B"]);

  const memoryWorld = makeLineWorld(1, [
    { id: "band:A", x: 2 },
    {
      id: "band:B",
      x: 10,
      placeMemory: {
        "tile:2,0": {
          tileId: "tile:2,0", attachment: 1, confidence: 1,
          isReturnPlace: true, valences: [],
        },
      },
    },
  ]);
  const memoryPressure = pressureAt(crowding, memoryWorld, "band:A", "tile:2,0");
  const repeat = pressureAt(crowding, near1, "band:A", "tile:2,0");

  const radiusKm = crowding.CROWDING_RADIUS_KM;
  const window1 = Number.isFinite(radiusKm)
    ? geometry.getRasterWindowForPhysicalRadius(near1.config, near1.tiles["tile:2,0"].coord, radiusKm)
    : undefined;
  const window15 = Number.isFinite(radiusKm)
    ? geometry.getRasterWindowForPhysicalRadius(near15.config, near15.tiles["tile:2,0"].coord, radiusKm)
    : undefined;
  const countWindow = (window) => window === undefined ? 0 : (window.maxX - window.minX + 1) * (window.maxY - window.minY + 1);

  const checks = {
    physicalRadiusExported: Number.isFinite(radiusKm) && radiusKm > 0,
    samePhysicalSeparationComparable:
      Math.abs(p1.weightedCrowding - p15.weightedCrowding) <= 0.02 &&
      p1.nearbyBandCount === p15.nearbyBandCount,
    outsidePhysicalRangeZero:
      out1.weightedCrowding <= 0.01 && out15.weightedCrowding <= 0.01 &&
      out1.nearbyBandCount === 0 && out15.nearbyBandCount === 0,
    awayBodiesCountAtActualPosition:
      awayPressure.weightedCrowding > 0 && awayPressure.pressureBandIds.includes("band:B") &&
      presence.some((source) => source.kind === "away_party" && source.tileId === "tile:5,0" && source.people === 12),
    residenceRemainderPreserved:
      presence.some((source) => source.kind === "residential_remainder" && source.tileId === "tile:10,0" && source.people === 24),
    rememberedPlaceNoPhysicalCrowding:
      memoryPressure.weightedCrowding === 0 && memoryPressure.nearbyBandCount === 0,
    deterministicResult: JSON.stringify(p1) === JSON.stringify(repeat),
    rasterWindowScaleDerived:
      countWindow(window1) > countWindow(window15) && countWindow(window15) > 0,
  };

  out = {
    check: "SCALE1-TASK6-CROWDING-EQUIVALENCE",
    verdict: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
    checks,
    measurements: {
      crowdingRadiusKm: radiusKm,
      threeKm: { oneKmRaster: p1, onePointFiveKmRaster: p15 },
      sixKm: { oneKmRaster: out1, onePointFiveKmRaster: out15 },
      awayPressure,
      awayPresence: presence,
      rememberedOnlyPressure: memoryPressure,
      candidateWindowCells: { oneKm: countWindow(window1), onePointFiveKm: countWindow(window15) },
      sameSeparationDelta: round(Math.abs(p1.weightedCrowding - p15.weightedCrowding)),
    },
  };
} finally {
  await server.close();
}

console.log(JSON.stringify(out, null, 2));
if (out.verdict !== "PASS") process.exitCode = 1;
