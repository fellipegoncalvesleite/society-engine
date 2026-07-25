// Canonical-state fingerprint (CORRECTION-14 parity instrument).
//
// Hashes the physically/causally meaningful per-band state after N years on a map,
// in a stable band order. Used two ways:
//   1. diagnostics-off parity — the same script, run on a worktree of the parent
//      commit and on this branch, must print the SAME hash when the only change is
//      audit instrumentation that is switched off;
//   2. fresh-process determinism — two independent processes must agree.
//
// Usage: node scripts/canonicalStateFingerprint.mjs --map map1 --years 40 [--seed s]
import { createHash } from "node:crypto";
import { createServer } from "vite";

function arg(name, dflt) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : dflt;
}

const MAP = arg("--map", "map1");
const YEARS = Number(arg("--years", "40"));
const SEED = arg("--seed", "");

const server = await createServer({
  root: `${process.cwd()}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

const r4 = (v) => Math.round((v ?? 0) * 10000) / 10000;

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  let world = SEED === ""
    ? runner.initSimWorld({ kind: MAP })
    : runner.initSimWorld({ kind: MAP }, SEED);

  for (let year = 0; year < YEARS; year += 1) {
    world = runner.stepSim(world, 4, "seasonal");
  }

  const bands = Object.values(world.bands)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map((band) => [
      String(band.id),
      String(band.position),
      String(band.status),
      String(band.viability?.status ?? "active"),
      band.demography.population,
      band.demography.dependents,
      band.demography.workingAdults,
      band.demography.elders,
      r4(band.demography.netDemographicRate),
      r4(band.demography.fertilityPressure),
      r4(band.demography.mortalityPressure),
      r4(band.demography.splitPressure),
      r4(band.demography.growthAccumulator),
      r4(band.demography.mortalityAccumulator),
      r4(band.seasonalSupport?.currentSeasonSupport?.rawSupportRatio),
      r4(band.seasonalSupport?.rolling4SeasonSupport),
      band.fissionEvents?.length ?? 0,
      (band.daughterBandIds ?? []).length,
      Object.keys(band.knowledge.observedTiles).length,
    ]);

  const payload = {
    map: MAP,
    years: YEARS,
    tick: Number(world.time.tick),
    season: world.time.season,
    bandCount: bands.length,
    totalPopulation: bands.reduce((sum, entry) => sum + entry[4], 0),
    bands,
  };

  console.log(JSON.stringify({
    map: MAP,
    years: YEARS,
    bandCount: payload.bandCount,
    totalPopulation: payload.totalPopulation,
    fingerprint: createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
  }));
} finally {
  await server.close();
}
