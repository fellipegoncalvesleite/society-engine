// CORRECTION-33 — natural occurrence of the hidden global band-count path.
//
// Same maps, seeds and scenario shape as CORRECTION-32's natural audit. Measures, per arm:
//   - band-seasons where the OLD condition (records > 8 && knownContactCount === 0) would fire
//   - how many of those are sustained ONLY by terminal records (records > 8 but living <= 8)
//   - how many have zero legitimate social evidence of any kind
//   - the socialAccessRisk distribution actually produced
//   - world aggregates that must not move for social reasons
//
// Usage: node scripts/socialAccessUnrelatedRiskNaturalAudit.mjs --arm after --years 20

import { dirname } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "vite";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};

const EVIDENCE = "docs/evidence/social-access-unrelated-risk-provenance-33";
const ARM = arg("arm", "after");
const YEARS = Number(arg("years", "20"));
const SUFFIX = ARM === "before" ? "-before" : "";
const OUT = arg("out", `${EVIDENCE}/natural-occurrence-${YEARS}y${SUFFIX}.json`);
const SEED_PREFIX = arg("seed-prefix", "audit27:natural");
const SCENARIOS = arg("scenarios", "map1,map2").split(",");
const SEEDS = arg("seeds", "s1,s2").split(",");
const SEASON_DAYS = 90;
const r4 = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10000) / 10000 : v);

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c33-nat-${process.pid}`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const contextCache = await server.ssrLoadModule("/sim/agents/contextCache.ts");
  const dryMargin = await server.ssrLoadModule("/sim/agents/dryMargin.ts");

  const runs = [];
  for (const kind of SCENARIOS) {
    for (const seed of SEEDS) {
      let world = runner.initSimWorld({ kind }, `${SEED_PREFIX}:${kind}:${seed}`);
      const risks = [];
      let bandSeasons = 0;
      let livingBandSeasons = 0;
      let oldConditionFires = 0;
      let firesSustainedOnlyByTerminalRecords = 0;
      let firesWithZeroSocialEvidence = 0;
      const affectedBands = new Set();
      let dryMarginReadings = 0;

      for (let season = 0; season < YEARS * 4; season += 1) {
        world = advance.advanceWorldByDays(world, SEASON_DAYS);
        const records = Object.values(world.bands).length;
        const living = Object.values(world.bands).filter(
          (b) => b.status !== "dispersed" && b.viability?.status !== "absorbed" && b.viability?.status !== "extinct",
        );
        const cache = contextCache.buildTickContextCache(world);
        for (const band of [...living].sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
          bandSeasons += 1;
          livingBandSeasons += 1;
          const knownContactCount =
            Object.keys(band.contactMemories ?? {}).length + (band.knowledge?.knownBands ?? []).length;
          // The OLD condition, evaluated as a DETECTOR on both arms. On the after arm it still
          // describes the world state; it simply no longer reaches any decision.
          if (records > 8 && knownContactCount === 0) {
            oldConditionFires += 1;
            affectedBands.add(String(band.id));
            if (living.length <= 8) firesSustainedOnlyByTerminalRecords += 1;
            const frictionRecords = (band.rangeFriction?.events ?? []).length;
            const encounters = (band.encounterRecords ?? []).length;
            if (frictionRecords === 0 && encounters === 0 && knownContactCount === 0) {
              firesWithZeroSocialEvidence += 1;
            }
          }
          const ctx = dryMargin.deriveDryMarginMobilityContext(world, band, cache);
          const risk = ctx?.currentWaterRefuge?.socialAccessRisk;
          if (risk !== undefined && risk !== null) {
            dryMarginReadings += 1;
            risks.push(risk);
          }
        }
      }

      const sorted = [...risks].sort((a, b) => a - b);
      const q = (p) => (sorted.length === 0 ? null : r4(sorted[Math.floor((sorted.length - 1) * p)]));
      const finalLiving = Object.values(world.bands).filter(
        (b) => b.status !== "dispersed" && b.viability?.status !== "absorbed" && b.viability?.status !== "extinct",
      );
      runs.push({
        scenario: kind,
        seed,
        years: YEARS,
        bandSeasons,
        livingBandSeasons,
        oldConditionFires,
        oldConditionFireRate: bandSeasons === 0 ? null : r4(oldConditionFires / bandSeasons),
        bandsAffected: affectedBands.size,
        firesSustainedOnlyByTerminalRecords,
        firesWithZeroSocialEvidence,
        socialAccessRisk: {
          readings: dryMarginReadings,
          min: q(0),
          p25: q(0.25),
          median: q(0.5),
          p75: q(0.75),
          max: q(1),
          mean: risks.length === 0 ? null : r4(risks.reduce((s, v) => s + v, 0) / risks.length),
        },
        finalState: {
          worldBandRecords: Object.values(world.bands).length,
          livingBands: finalLiving.length,
          population: finalLiving.reduce((s, b) => s + (b.demography?.population ?? 0), 0),
          absorbed: Object.values(world.bands).filter((b) => b.viability?.status === "absorbed").length,
          extinct: Object.values(world.bands).filter((b) => b.viability?.status === "extinct").length,
          dispersed: Object.values(world.bands).filter((b) => b.status === "dispersed").length,
          residentialMoves: finalLiving.reduce((s, b) => s + (b.movementHistory?.length ?? 0), 0),
          contactMemories: finalLiving.reduce((s, b) => s + Object.keys(b.contactMemories ?? {}).length, 0),
          frictionRecords: finalLiving.reduce((s, b) => s + (b.rangeFriction?.events ?? []).length, 0),
          depletionSum: r4(Object.values(world.tiles).reduce((s, t) => s + (t.depletion ?? 0), 0)),
        },
      });
    }
  }

  const total = (pick) => runs.reduce((s, r) => s + (pick(r) ?? 0), 0);
  const payload = {
    audit: "socialAccessUnrelatedRiskNaturalAudit",
    checkpoint: "CORRECTION-33",
    arm: ARM,
    years: YEARS,
    seedPrefix: SEED_PREFIX,
    scenarios: SCENARIOS,
    seeds: SEEDS,
    generatedAt: new Date().toISOString(),
    detectorNote:
      "`oldConditionFires` evaluates the REMOVED expression as a pure detector on both arms. It " +
      "describes world state, not behaviour: on the after arm it still fires and simply reaches " +
      "no decision. A high rate on the after arm is the POINT — it measures how often the old term " +
      "was silently active.",
    summary: {
      runs: runs.length,
      bandSeasons: total((r) => r.bandSeasons),
      oldConditionFires: total((r) => r.oldConditionFires),
      bandsAffected: total((r) => r.bandsAffected),
      firesSustainedOnlyByTerminalRecords: total((r) => r.firesSustainedOnlyByTerminalRecords),
      firesWithZeroSocialEvidence: total((r) => r.firesWithZeroSocialEvidence),
      finalPopulation: total((r) => r.finalState.population),
      finalLivingBands: total((r) => r.finalState.livingBands),
      finalWorldBandRecords: total((r) => r.finalState.worldBandRecords),
      residentialMoves: total((r) => r.finalState.residentialMoves),
      depletionSum: r4(total((r) => r.finalState.depletionSum)),
    },
    runs,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify(payload.summary, null, 2));
  console.log(`\nwrote ${OUT}`);
} finally {
  await server.close();
}
