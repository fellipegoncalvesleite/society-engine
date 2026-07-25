// REPEATED-BAND-EXPANSION-FISSION-14 — food-access collapse probe.
//
// Runs ONE isolated founder on a named tile and reports, per season: position, trips
// attempted, trips that returned food, usable harvest, per-trip physical failure
// reasons, the food-receipt accumulator's period tick vs the ledger's read, tile
// depletion and known-tile count. It then prints the windows around every season whose
// support ratio is ~0, which is how the two access defects in this checkpoint were
// found:
//   * runs of `trips: 0` while the band walked its residence out of range of every
//     remembered patch (no reachable patch memory -> no candidate -> no receipt);
//   * `trips: 0` while reachable memories existed but all exceeded the same-day budget
//     that `applyTripDay` enforces after the argmax.
// Pre-fix the richest map2 catchment read ZERO support in 141 of 480 seasons; post-fix
// it reads zero in 1 of 480.
//
// Usage: node scripts/foodAccessCollapseProbe.mjs [tileId] [years]
import { createServer } from "vite";
const server = await createServer({ root: `${process.cwd()}/src`, configFile: false, appType: "custom", server: { middlewareMode: true }, logLevel: "error" });
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const spawn = await server.ssrLoadModule("/sim/agents/spawn.ts");
  const TILE = process.argv[2] ?? "tile:188:92";
  const YEARS = Number(process.argv[3] ?? 120);
  let world = runner.initSimWorld({ kind: "map2" }, "c14:exceptionally_rich:s1");
  world = spawn.removeInitialBands(world, Object.keys(world.bands));
  world = spawn.spawnCustomBands(world, [{ tileId: TILE, population: 34, name: "exceptionally_rich" }], "c14:exceptionally_rich:s1");
  const id = Object.keys(world.bands)[0];
  const rows = [];
  const seen = new Set();
  for (let s = 0; s < YEARS*4; s++) {
    world = runner.stepSim(world, 1, "seasonal");
    const b = world.bands[id]; if (!b) break;
    let trips = 0, foodTrips = 0, harv = 0, fails = {};
    for (const t of b.recentIntraSeasonTrips ?? []) {
      const k = `${t.tick}:${t.day}:${t.targetTileId}`; if (seen.has(k)) continue; seen.add(k);
      trips++; const u = t.physicalFoodHarvest?.usableSupport ?? 0;
      if (u > 0) { foodTrips++; harv += u; }
      const fr = t.physicalFoodHarvest?.failureReason ?? (t.cause==="water_check"?"water_check":undefined);
      if (fr) fails[fr] = (fails[fr] ?? 0) + 1;
    }
    const led = b.carryingCapacity?.perCapitaReturn?.supportDebug?.humanFoodLedger;
    const acc = b.seasonalFoodReceipts;
    rows.push({ s, y: Math.floor(s/4), season: world.time.season, tick: Number(world.time.tick), pop: b.demography.population,
      pos: String(b.position), ratio: led?.rawSupportRatio ?? null, srcTick: led?.sourceSeasonTick ?? null,
      accTick: acc?.periodTick ?? null, accUsable: acc?.totalUsableSupport ?? null, accReceipts: acc?.receiptCount ?? null,
      trips, foodTrips, harv: Math.round(harv*10000)/10000, fails,
      depl: Math.round((world.tileDepletion?.[b.position] ?? 0)*100)/100,
      status: b.status, knownTiles: Object.keys(b.knowledge.observedTiles).length });
  }
  // print collapse windows: seasons with ratio 0 and their neighbourhood
  const bad = rows.filter(r => (r.ratio ?? 1) < 0.05);
  console.log("zeroSeasons", bad.length, "of", rows.length);
  const windows = [];
  for (const r of bad) { if (!windows.some(w => Math.abs(w - r.s) < 12)) windows.push(r.s); }
  for (const w of windows.slice(0, 4)) {
    console.log("=== window around season", w, "(year", Math.floor(w/4), ") ===");
    for (const r of rows.filter(x => x.s >= w-6 && x.s <= w+8)) console.log(JSON.stringify(r));
  }
} finally { await server.close(); }
