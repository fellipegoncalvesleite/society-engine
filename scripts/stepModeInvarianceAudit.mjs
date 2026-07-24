// LOST-LINEAGE RECOVERY-12 — step-mode invariance audit (Section 7).
//
// Daily and seasonal stepping must produce identical canonical causal state. The season's
// daily actions (including the new food-receipt accumulator writes) run in the same per-day
// path under both modes; only the number of days per advanceWorldByDays call differs. This
// walks the full canonical band state recursively and, per the spec, uses the population
// AUTHORITY `band.demography.population` (never the legacy `band.population`).
//
// Horizon is chosen as whole years so both modes land on the same season boundary/tick.
//
// ISOLATION: the sim memoizes some derivations at MODULE scope (per process, not per world
// — e.g. fauna-stock geography). Running two different maps in one process therefore lets an
// earlier map's memo perturb a later map's result. Production always runs ONE world per
// worker/process, so this is a harness artifact, not a production bug. To test invariance
// honestly, each map runs in its OWN fresh child process (`--single <map>`), which is the
// same fresh-process methodology the deterministic benchmark uses.

import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const YEARS = 20;
const MAPS = ["map1", "map2"];
const SELF = fileURLToPath(import.meta.url);

const singleArgIndex = process.argv.indexOf("--single");
const SINGLE_MAP = singleArgIndex >= 0 ? process.argv[singleArgIndex + 1] : undefined;

if (SINGLE_MAP === undefined) {
  // Orchestrator: run each map in a fresh child process, aggregate.
  const results = {};
  let allPass = true;
  for (const map of MAPS) {
    const out = execFileSync("node", [SELF, "--single", map], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    const parsed = JSON.parse(out.trim().split("\n").pop());
    results[map] = parsed;
    allPass = allPass && parsed.pass;
  }
  console.log(
    JSON.stringify(
      { check: "RECOVERY-12 step-mode invariance (daily == seasonal)", verdict: allPass ? "PASS" : "FAIL", years: YEARS, maps: MAPS, isolation: "one fresh child process per map", results },
      null,
      2,
    ),
  );
  process.exit(allPass ? 0 : 1);
}

const server = await createServer({
  root: `${process.cwd()}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

// Canonical causal projection of a band. Deliberately excludes nothing causal; the whole
// band object is compared below as the strong test, and this focused view makes any
// divergence legible (and asserts the population authority explicitly).
function bandCausal(band) {
  return {
    id: band.id,
    population: band.demography.population,
    growthAccumulator: band.demography.growthAccumulator,
    mortalityAccumulator: band.demography.mortalityAccumulator,
    position: band.position,
    activeStatus: band.viability?.status,
    seasonalFoodReceipts: band.seasonalFoodReceipts
      ? {
          periodTick: band.seasonalFoodReceipts.periodTick,
          receiptCount: band.seasonalFoodReceipts.receiptCount,
          totalUsableSupport: band.seasonalFoodReceipts.totalUsableSupport,
        }
      : null,
  };
}

function causalFingerprint(world) {
  return Object.values(world.bands)
    .map(bandCausal)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

// The strong test: the entire canonical bands map, compared by VALUE not by property
// insertion order. WorldTime lands on the same tick. Object property order is a non-causal
// serialization artifact — the same immutable band rebuilt via `{...band, field}` a different
// number of times (as happens across day-by-day vs batched season advance) yields identical
// key/value pairs in a different order; access is by key, so behaviour is unaffected. A
// canonical (recursively key-sorted) serialization removes that artifact and compares only
// values.
function canonicalize(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const out = {};
  for (const key of Object.keys(value).sort()) out[key] = canonicalize(value[key]);
  return out;
}
function fullBandsFingerprint(world) {
  const bands = Object.fromEntries(
    Object.entries(world.bands).sort(([a], [b]) => a.localeCompare(b)),
  );
  return JSON.stringify(canonicalize(bands));
}

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");

  const map = SINGLE_MAP;
  const seed = `step-mode-invariance:${map}`;
  const base = runner.initSimWorld({ kind: map }, seed);

  const seasonal = runner.stepSim(base, YEARS * 4, "seasonal");
  const daily = runner.stepSim(base, YEARS * 360, "daily");

  const seasonalCausal = causalFingerprint(seasonal);
  const dailyCausal = causalFingerprint(daily);
  const populationsMatch = JSON.stringify(seasonalCausal) === JSON.stringify(dailyCausal);
  const fullMatch = fullBandsFingerprint(seasonal) === fullBandsFingerprint(daily);
  const tickMatch = Number(seasonal.time.tick) === Number(daily.time.tick);

  const seasonalPop = seasonalCausal.reduce((s, b) => s + b.population, 0);
  const dailyPop = dailyCausal.reduce((s, b) => s + b.population, 0);

  let firstDivergence = null;
  for (let i = 0; i < Math.max(seasonalCausal.length, dailyCausal.length); i += 1) {
    if (JSON.stringify(seasonalCausal[i]) !== JSON.stringify(dailyCausal[i])) {
      firstDivergence = { seasonal: seasonalCausal[i] ?? null, daily: dailyCausal[i] ?? null };
      break;
    }
  }

  const pass = populationsMatch && fullMatch && tickMatch;
  const result = {
    map,
    pass,
    tickMatch,
    seasonalTick: Number(seasonal.time.tick),
    dailyTick: Number(daily.time.tick),
    populationAuthorityMatch: populationsMatch,
    fullCanonicalStateMatch: fullMatch,
    seasonalPopulation: seasonalPop,
    dailyPopulation: dailyPop,
    bandCount: seasonalCausal.length,
    firstDivergence,
  };
  console.log(JSON.stringify(result));
  process.exitCode = pass ? 0 : 1;
} finally {
  await server.close();
}
