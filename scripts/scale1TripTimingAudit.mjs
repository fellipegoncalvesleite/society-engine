// SCALE-1 Task 3 — expedition and intra-season trip timing is physical route time + work time.
import { readFileSync } from "node:fs";
import { createServer } from "vite";

const ROOT = process.cwd();
const server = await createServer({
  root: `${ROOT}/src`, configFile: false, appType: "custom", server: { middlewareMode: true }, logLevel: "error",
});

let out;
try {
  const trips = await server.ssrLoadModule("/sim/agents/intraSeasonTrips.ts");
  const makeWorld = (cellKm) => ({
    config: {
      spatial: { cellWidthKm: cellKm, cellHeightKm: cellKm, coordinateFrame: "cartesian_cell_centers", connectivity: "cardinal_4" },
      width: 3, height: 1, seasonsPerYear: 4, yearsPerGeneration: 25, ticksPerGeneration: 100,
    },
    tiles: {
      a: { id: "a", coord: { x: 0, y: 0 }, movementCost: 1, isAquatic: false, neighbors: ["b"] },
      b: { id: "b", coord: { x: 1, y: 0 }, movementCost: 1, isAquatic: false, neighbors: ["a", "c"] },
      c: { id: "c", coord: { x: 2, y: 0 }, movementCost: 1, isAquatic: false, neighbors: ["b"] },
    },
    riverCrossings: {}, rivers: {}, time: { season: "summer", tick: 0 },
  });
  const band = {
    demography: { population: 20, workingAdults: 12, dependents: 6, elders: 2, foodPerPersonStress: 0 },
    pressureState: { fatiguePressure: 0, foodStress: 0, waterStress: 0 },
  };

  const hasPhysicalHelper = typeof trips.derivePhysicalRoundTripTiming === "function";
  const map1One = hasPhysicalHelper ? trips.derivePhysicalRoundTripTiming(makeWorld(1), band, ["a", "b"], 0.25) : undefined;
  const map15One = hasPhysicalHelper ? trips.derivePhysicalRoundTripTiming(makeWorld(1.5), band, ["a", "b"], 0.25) : undefined;
  const map15Two = hasPhysicalHelper ? trips.derivePhysicalRoundTripTiming(makeWorld(1.5), band, ["a", "b", "c"], 0.25) : undefined;
  const noWork = hasPhysicalHelper ? trips.derivePhysicalRoundTripTiming(makeWorld(1), band, ["a", "b"], 0) : undefined;

  const expeditionSrc = readFileSync(`${ROOT}/src/sim/agents/expedition.ts`, "utf8");
  const tripsSrc = readFileSync(`${ROOT}/src/sim/agents/intraSeasonTrips.ts`, "utf8");
  const pendingSrc = readFileSync(`${ROOT}/src/sim/agents/pendingOperation.ts`, "utf8");
  const staticCore = `${expeditionSrc}\n${tripsSrc}\n${pendingSrc}`;

  const checks = {
    physicalRoundTripHelperExists: hasPhysicalHelper,
    physicalRasterScaleChangesTravelTime:
      map1One !== undefined && map15One !== undefined && map15One.outboundTravelDays > map1One.outboundTravelDays,
    workTimeIncluded:
      map1One !== undefined && noWork !== undefined && map1One.totalDays > noWork.totalDays && map1One.activityDays === 0.25,
    sameDayComputedFromTotalTime:
      map1One !== undefined && map1One.sameDay === (map1One.totalDays <= 1),
    longerRouteCanBecomeOvernight:
      map15Two !== undefined && map15Two.sameDay === false && map15Two.durationDays >= 2,
    outboundAndReturnBothCount:
      map1One !== undefined && map1One.totalDays === map1One.outboundTravelDays + map1One.activityDays + map1One.returnTravelDays,
    noSameDayTileBudgetAuthority: !/SAME_DAY_ROUND_TRIP_TILE_BUDGET/.test(staticCore),
    noExpeditionTilesPerDayAuthority: !/EXPEDITION_BASE_TILES_PER_DAY/.test(staticCore),
    noExpeditionGlobalKmPerTile: !/\bKM_PER_TILE\b/.test(expeditionSrc),
    noDirectOnePointFivePhysicalConversion:
      !/distanceTiles\s*\*\s*2\s*\*\s*1\.5|\*\s*KM_PER_TILE/.test(staticCore),
  };

  out = {
    check: "SCALE1-TRIP-TIMING",
    verdict: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
    checks,
    measurements: { map1One, map15One, map15Two, noWork },
  };
} finally {
  await server.close();
}

console.log(JSON.stringify(out, null, 2));
if (out.verdict !== "PASS") process.exitCode = 1;
