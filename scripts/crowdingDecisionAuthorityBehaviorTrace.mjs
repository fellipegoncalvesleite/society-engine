// CORRECTION-32 — per-season behaviour trace, for the arm-vs-arm first-divergence comparison.
//
// Runs UNCHANGED on both arms and emits, per season, a compact PHYSICAL fingerprint of every
// living band (position, population, residential-move count) plus world depletion. Comparing
// the two files locates the first tick at which production behaviour diverges, and whether the
// divergence is physical or confined to derived pressure values.
//
// Usage: node scripts/crowdingDecisionAuthorityBehaviorTrace.mjs --arm after --years 20

import { dirname } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "vite";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const YEARS = Number(arg("years", "20"));
const SEASON_DAYS = 90;
const SEEDS = arg("seeds", "s1,s2").split(",").filter(Boolean);
const SEED_PREFIX = arg("seed-prefix", "audit27:natural");
const ARM = arg("arm", "after");
const OUT = arg("out", `docs/evidence/crowding-decision-pressure-authority-32/behavior-trace-${ARM}.json`);
const MAPS = arg("maps", "map1,map2").split(",");
const r4 = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10000) / 10000 : v);

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c32-trace-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const isLiving = (b) =>
    b.status !== "dispersed" && b.viability?.status !== "absorbed" && b.viability?.status !== "extinct";

  const runs = [];
  for (const map of MAPS) {
    for (const seed of SEEDS) {
      let world = runner.initSimWorld({ kind: map }, `${SEED_PREFIX}:${map}:${seed}`);
      const seasons = [];
      for (let s = 0; s < YEARS * 4; s += 1) {
        world = advance.advanceWorldByDays(world, SEASON_DAYS);
        const living = Object.values(world.bands).filter(isLiving)
          .sort((a, b) => String(a.id).localeCompare(String(b.id)));
        let depletion = 0;
        for (const tile of Object.values(world.tiles)) depletion += tile.depletion ?? 0;
        seasons.push({
          tick: Number(world.time.tick),
          physical: living.map((b) => `${b.id}@${b.position}#${b.demography?.population ?? 0}`).join(","),
          moves: Object.values(world.bands).reduce((n, b) => n + (b.movementHistory?.length ?? 0), 0),
          depletion: r4(depletion),
          derived: living.map((b) =>
            `${b.id}:r${r4(b.pressureState?.riskPressure ?? 0)}:n${r4(b.pressureState?.netMovePressure ?? 0)}:s${r4(b.rangeSaturation?.saturationPressure ?? 0)}`,
          ).join(","),
        });
      }
      runs.push({ map, seed, seasons });
    }
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify({ audit: "crowdingDecisionAuthorityBehaviorTrace", arm: ARM, years: YEARS, runs }, null, 2)}\n`);
  console.log(`wrote ${OUT} (${runs.length} runs x ${YEARS * 4} seasons)`);
} finally {
  await server.close();
}
