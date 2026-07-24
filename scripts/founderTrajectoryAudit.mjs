// LOST-LINEAGE RECOVERY-12 — founder trajectory audit (Section 6/9 before-after arms).
//
// Runs the named founders on a map for N years across deterministic seeds, tracking the
// population authority `band.demography.population` (start / min / final / extinction year),
// cumulative births and deaths, terminal removals, final working-adult cohort, and per-season
// usable support vs demand (surplus/deficit season counts). It reads only the public sim API
// (initSimWorld / stepSim) plus already-written band fields, so the SAME script runs
// unchanged against the broken mainline (via a git worktree) and the corrected branch, giving
// an identical-configuration before/after.
//
// Usage: node scripts/founderTrajectoryAudit.mjs --map map1 --years 150 --seeds a,b,c

import { createServer } from "vite";

const NAMES = {
  "band:delta-coastal-foragers": "Delta Reed",
  "band:river-valley-foragers": "Green River",
  "band:lake-wetland-foragers": "Lake Marsh",
  "band:highland-edge-foragers": "Pass Edge",
  "band:dry-margin-foragers": "Dry Margin",
  "band:varied-estuary": "Estuary",
  "band:varied-river-mid": "Long River",
  "band:varied-lake-east": "Basin Crowd East",
  "band:varied-plains-creek": "Creek Plains",
  "band:varied-lake-north": "Rich Basin",
  "band:varied-lake-west": "Basin Crowd West",
  "band:varied-pass-frontier": "North Frontier",
  "band:varied-dry-corridor-upper": "Upper Corridor",
  "band:varied-dry-corridor-mid": "Yellow Corridor",
};

function arg(name, dflt) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : dflt;
}

const MAP = arg("--map", "map1");
const YEARS = Number(arg("--years", "150"));
const SEEDS = arg("--seeds", "s1").split(",");
const round2 = (v) => Math.round(v * 100) / 100;

const server = await createServer({
  root: `${process.cwd()}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");

  const bySeed = {};
  for (const seed of SEEDS) {
    let world = runner.initSimWorld({ kind: MAP }, `founder-trajectory:${MAP}:${seed}`);
    const founderIds = Object.keys(world.bands).filter((id) => NAMES[id] !== undefined);

    const track = {};
    for (const id of founderIds) {
      const pop = world.bands[id].demography.population;
      track[id] = {
        name: NAMES[id],
        start: pop,
        min: pop,
        final: pop,
        extinctYear: null,
        births: 0,
        deaths: 0,
        terminalRemoved: 0,
        finalWorkingAdults: world.bands[id].demography.workingAdults ?? 0,
        surplusSeasons: 0,
        deficitSeasons: 0,
        supportSeasonsSampled: 0,
        seenChurnYears: new Set(),
      };
    }

    for (let year = 1; year <= YEARS; year += 1) {
      for (let s = 0; s < 4; s += 1) {
        world = runner.stepSim(world, 1, "seasonal");
        for (const id of founderIds) {
          const band = world.bands[id];
          if (band === undefined) continue;
          const ledger = band.carryingCapacity?.perCapitaReturn?.supportDebug?.humanFoodLedger;
          if (ledger !== undefined) {
            track[id].supportSeasonsSampled += 1;
            if (ledger.rawSupportRatio >= 1) track[id].surplusSeasons += 1;
            else if (ledger.rawSupportRatio < 0.92) track[id].deficitSeasons += 1;
          }
        }
      }
      for (const id of founderIds) {
        const band = world.bands[id];
        if (band === undefined) continue;
        const pop = band.demography.population;
        const t = track[id];
        t.final = pop;
        t.min = Math.min(t.min, pop);
        if (pop <= 0 && t.extinctYear === null) t.extinctYear = year;
        t.terminalRemoved = Math.max(t.terminalRemoved, band.viability?.populationRemoved ?? 0);
        for (const rec of band.demography.demographicChurn?.records ?? []) {
          const key = Number(rec.year ?? rec.tick ?? -1);
          if (!t.seenChurnYears.has(key)) {
            t.seenChurnYears.add(key);
            t.births += rec.births ?? 0;
            t.deaths += rec.deaths ?? 0;
          }
        }
        t.finalWorkingAdults = band.demography.workingAdults ?? t.finalWorkingAdults;
      }
    }

    bySeed[seed] = Object.fromEntries(
      Object.entries(track).map(([id, t]) => [
        t.name,
        {
          start: t.start,
          min: round2(t.min),
          final: round2(t.final),
          extinctYear: t.extinctYear,
          net: round2(t.final - t.start),
          births: t.births,
          deaths: t.deaths,
          terminalRemoved: t.terminalRemoved,
          finalWorkingAdults: round2(t.finalWorkingAdults),
          surplusSeasons: t.surplusSeasons,
          deficitSeasons: t.deficitSeasons,
          supportSeasonsSampled: t.supportSeasonsSampled,
        },
      ]),
    );
  }

  console.log(JSON.stringify({ map: MAP, years: YEARS, seeds: SEEDS, bySeed }, null, 2));
} finally {
  await server.close();
}
