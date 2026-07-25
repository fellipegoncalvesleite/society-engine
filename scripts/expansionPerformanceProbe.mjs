// REPEATED-BAND-EXPANSION-FISSION-14 §19 — performance and retained-state bounds.
//
// Measures ms/tick and retained state for the cases this checkpoint changed: the two
// default maps at 150 years, and 500-year single-lineage runs on physically scored
// rich / ordinary / hostile ground. Reports peak living band count and serialized band
// state so the bounded-state claim is measured, not asserted.
//
// Run it ALONE (no other heavy job) — the numbers are wall-clock.
//
// Usage: node scripts/expansionPerformanceProbe.mjs [--case default|lineage|all]
import { createServer } from "vite";

function arg(name, dflt) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : dflt;
}

const CASE = arg("--case", "all");
const r2 = (v) => Math.round(v * 100) / 100;

const server = await createServer({
  root: `${process.cwd()}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const spawn = await server.ssrLoadModule("/sim/agents/spawn.ts");
  const results = [];

  const measure = (label, build, years) => {
    let world = build();
    const ticks = years * 4;
    let peakLivingBands = 0;
    const started = performance.now();
    for (let i = 0; i < ticks; i += 1) {
      world = runner.stepSim(world, 1, "seasonal");
      if (i % 20 === 0) {
        const living = Object.values(world.bands).filter(
          (b) => b.viability?.status !== "extinct" && b.viability?.status !== "absorbed" && b.demography.population > 0,
        ).length;
        peakLivingBands = Math.max(peakLivingBands, living);
      }
    }
    const elapsed = performance.now() - started;
    const bands = Object.values(world.bands);
    const living = bands.filter(
      (b) => b.viability?.status !== "extinct" && b.viability?.status !== "absorbed" && b.demography.population > 0,
    );
    const serializedBandBytes = bands.reduce((sum, b) => sum + JSON.stringify(b).length, 0);
    const largestBandBytes = bands.reduce((max, b) => Math.max(max, JSON.stringify(b).length), 0);
    const maxKnownTiles = bands.reduce((max, b) => Math.max(max, Object.keys(b.knowledge.observedTiles).length), 0);
    const maxPatchMemories = bands.reduce(
      (max, b) => Math.max(max, (b.resourceKnowledgeState?.patchMemories ?? []).length), 0);
    const maxFissionEvents = bands.reduce((max, b) => Math.max(max, (b.fissionEvents ?? []).length), 0);
    const maxRecentTrips = bands.reduce((max, b) => Math.max(max, (b.recentIntraSeasonTrips ?? []).length), 0);
    results.push({
      label,
      years,
      ticks,
      totalMs: r2(elapsed),
      msPerTick: r2(elapsed / ticks),
      bandRecords: bands.length,
      livingBands: living.length,
      peakLivingBands,
      totalPopulation: living.reduce((s, b) => s + b.demography.population, 0),
      retained: {
        serializedBandKB: r2(serializedBandBytes / 1024),
        largestBandKB: r2(largestBandBytes / 1024),
        maxKnownTiles,
        maxPatchMemories,
        maxFissionEvents,
        maxRecentTrips,
      },
    });
  };

  if (CASE === "default" || CASE === "all") {
    measure("map1-default-150y", () => runner.initSimWorld({ kind: "map1" }, "perf:map1"), 150);
    measure("map2-default-150y", () => runner.initSimWorld({ kind: "map2" }, "perf:map2"), 150);
  }

  if (CASE === "lineage" || CASE === "all") {
    const sites = {
      exceptionally_rich: "tile:188:92",
      ordinary: "tile:140:124",
      hostile: "tile:112:104",
    };
    for (const [name, tileId] of Object.entries(sites)) {
      measure(`${name}-lineage-500y`, () => {
        let world = runner.initSimWorld({ kind: "map2" }, `perf:${name}`);
        world = spawn.removeInitialBands(world, Object.keys(world.bands));
        return spawn.spawnCustomBands(world, [{ tileId, population: 34, name }], `perf:${name}`);
      }, 500);
    }
  }

  console.log(JSON.stringify({ check: "CORRECTION-14 performance and bounds", results }, null, 1));
} finally {
  await server.close();
}
