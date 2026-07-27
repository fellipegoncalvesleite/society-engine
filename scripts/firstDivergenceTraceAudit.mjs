// CORRECTION-23E §6 — FIRST BEHAVIOURALLY MEANINGFUL DIVERGENCE, CHANNEL BY CHANNEL.
//
// R0 and R1 are different COMMITS, so they cannot be stepped inside one process. Each side
// therefore emits a compact per-day, per-band, per-CHANNEL trace, and `--compare` finds the
// first day each channel differs. Channels are ordered as §6 requires, so the output reads as
// the chain itself:
//
//   retry-policy difference -> party/activity schedule -> physical movement or observation
//   -> canonical knowledge -> later decision -> physical receipt or residence -> support
//   -> demography
//
// A channel that never differs is reported as an ABSENT LINK, and §6 says to stop at the
// first broken or absent link rather than narrating the rest.
//
// Usage:
//   node scripts/firstDivergenceTraceAudit.mjs --seed s3 --years 40 --out trace-R1.json
//   node scripts/firstDivergenceTraceAudit.mjs --compare trace-R0.json,trace-R1.json
import { createServer } from "vite";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt;
};

const COMPARE = arg("compare", "");

// ── comparison mode ────────────────────────────────────────────────────────────────────
if (COMPARE !== "") {
  const [leftPath, rightPath] = COMPARE.split(",");
  const left = JSON.parse(readFileSync(leftPath, "utf8"));
  const right = JSON.parse(readFileSync(rightPath, "utf8"));
  const channels = left.channels;
  const firstDivergence = {};

  for (const channel of channels) {
    let found = null;
    const days = Math.min(left.trace.length, right.trace.length);

    for (let d = 0; d < days; d += 1) {
      if (left.trace[d][channel] !== right.trace[d][channel]) {
        found = {
          day: left.trace[d].day,
          year: Math.ceil(left.trace[d].day / 360),
          tick: Math.floor(left.trace[d].day / 90),
          left: left.trace[d][channel],
          right: right.trace[d][channel],
        };
        break;
      }
    }

    firstDivergence[channel] = found ?? "NEVER DIVERGED (absent link)";
  }

  const ordered = channels
    .filter((channel) => firstDivergence[channel] !== "NEVER DIVERGED (absent link)")
    .sort((a, b) => firstDivergence[a].day - firstDivergence[b].day);

  console.log(`\n=== FIRST DIVERGENCE  ${left.label} vs ${right.label}  (seed ${left.seed}) ===\n`);
  for (const channel of channels) {
    const row = firstDivergence[channel];
    if (typeof row === "string") {
      console.log(`${channel.padEnd(26)} ${row}`);
    } else {
      console.log(
        `${channel.padEnd(26)} day ${String(row.day).padStart(6)} (y${String(row.year).padStart(3)} t${String(row.tick).padStart(4)})  ` +
          `${String(row.left).slice(0, 42)}  |  ${String(row.right).slice(0, 42)}`,
      );
    }
  }
  console.log(`\nCHAIN ORDER (earliest first): ${ordered.join(" -> ")}`);

  const out = arg("compare-out", "docs/evidence/correction23e/first-divergence.json");
  mkdirSync(out.slice(0, out.lastIndexOf("/")), { recursive: true });
  writeFileSync(
    out,
    JSON.stringify({ left: left.label, right: right.label, seed: left.seed, firstDivergence, chainOrder: ordered }, null, 2),
  );
  console.log(`wrote ${out}`);
  process.exit(0);
}

// ── trace mode ─────────────────────────────────────────────────────────────────────────
const MAP = arg("map", "map2");
const SITE = arg("site", "tile:204:72");
const YEARS = Number(arg("years", "40"));
const SEED = arg("seed", "s1");
const LABEL = arg("label", "R1");
const OUT = arg("out", `docs/evidence/correction23e/trace-${LABEL}-${SEED}.json`);
const SEED_PREFIX = arg("seed-prefix", "c23e:marginal_escapable");

const CHANNELS = [
  "verificationLaunches",
  "verificationTargets",
  "physicalRoutes",
  "tilesObserved",
  "placeRefreshed",
  "placeEvicted",
  "explorationLaunches",
  "decision",
  "position",
  "receipts",
  "support",
  "population",
];

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

  let world = runner.initSimWorld({ kind: MAP }, `${SEED_PREFIX}:${SEED}`);
  world = spawn.removeInitialBands(world, Object.keys(world.bands));
  world = spawn.spawnCustomBands(
    world,
    [{ tileId: SITE, population: 34, name: "marginal_escapable" }],
    `${SEED_PREFIX}:${SEED}`,
  );

  const isLiving = (band) =>
    band.viability?.status !== "extinct" &&
    band.viability?.status !== "absorbed" &&
    band.viability?.status !== "dispersed" &&
    (band.demography?.population ?? 0) > 0;

  const known = new Map();
  const seenExpeditions = new Set();
  const trace = [];
  const days = YEARS * 360;
  const r3 = (v) => (v === undefined || v === null ? "-" : Math.round(v * 1000) / 1000);

  for (let d = 1; d <= days; d += 1) {
    world = runner.stepSim(world, 1, "daily");
    const living = Object.values(world.bands).filter(isLiving).sort((a, b) => String(a.id).localeCompare(String(b.id)));

    const row = { day: d };
    const launches = [];
    const targets = [];
    const explorations = [];
    const routes = [];
    const observed = [];
    const refreshed = [];
    const evicted = [];
    const decisions = [];
    const positions = [];
    const receipts = [];
    const supports = [];
    let population = 0;

    for (const band of living) {
      const shortId = String(band.id).slice(-6);

      for (const expedition of band.expeditions ?? []) {
        if (!seenExpeditions.has(expedition.id)) {
          seenExpeditions.add(expedition.id);
          if (expedition.taskKind === "frontier_verification") {
            launches.push(shortId);
            targets.push(`${shortId}:${expedition.verificationPlan?.targetTileId}:${expedition.verificationPlan?.question}`);
          }
          if (expedition.taskKind === "frontier_exploration") explorations.push(shortId);
        }
        if ((expedition.routeTileIds ?? []).length > 0) {
          routes.push(`${shortId}:${expedition.taskKind}:${expedition.routeTileIds.length}`);
        }
      }

      const records = band.knowledge?.observedTiles ?? {};
      const nowKeys = Object.keys(records).sort();
      const prior = known.get(band.id);
      observed.push(`${shortId}:${nowKeys.length}`);

      if (prior !== undefined) {
        for (const tileId of nowKeys) {
          const stamp = Number(records[tileId].lastObservedAt?.day ?? 0);
          if (prior.stamps.get(tileId) !== undefined && stamp > prior.stamps.get(tileId)) {
            refreshed.push(`${shortId}:${tileId}`);
          }
        }
        for (const tileId of prior.stamps.keys()) {
          if (records[tileId] === undefined) evicted.push(`${shortId}:${tileId}`);
        }
      }

      known.set(band.id, {
        stamps: new Map(nowKeys.map((tileId) => [tileId, Number(records[tileId].lastObservedAt?.day ?? 0)])),
      });

      decisions.push(`${shortId}:${band.lastDecisionKind ?? band.movementIntent?.intent ?? "-"}`);
      positions.push(`${shortId}:${band.position}`);
      receipts.push(`${shortId}:${r3(band.seasonalFoodReceipts?.totalUsableSupport)}`);
      supports.push(`${shortId}:${r3(band.seasonalSupport?.currentSeasonSupport?.rawSupportRatio)}`);
      population += band.demography?.population ?? 0;
    }

    row.verificationLaunches = launches.join(",");
    row.verificationTargets = targets.join(",");
    row.physicalRoutes = routes.join(",");
    row.tilesObserved = observed.join(",");
    row.placeRefreshed = String(refreshed.length);
    row.placeEvicted = evicted.join(",");
    row.explorationLaunches = explorations.join(",");
    row.decision = decisions.join(",");
    row.position = positions.join(",");
    row.receipts = receipts.join(",");
    row.support = supports.join(",");
    row.population = String(population);
    trace.push(row);

    if (living.length === 0) break;
  }

  mkdirSync(OUT.slice(0, OUT.lastIndexOf("/")), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ label: LABEL, seed: SEED, map: MAP, years: YEARS, channels: CHANNELS, trace }));
  console.log(`wrote ${OUT} (${trace.length} days)`);
} finally {
  await server.close();
}
