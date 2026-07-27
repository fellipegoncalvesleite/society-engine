// CORRECTION-23 CONTINUATION §15 — BOUNDEDNESS AND PERFORMANCE.
//
// §15 requires the retained-history cap of 12 to be justified as a MEMORY BOUND, not used as
// the retry-control mechanism. This measures both: state growth over long horizons, and how
// often the same band/target pair is verified repeatedly once the ring turns over.
//
// Usage: node scripts/verificationBoundednessAudit.mjs --map map2 --years 100,300,500
import { writeFileSync, mkdirSync } from "node:fs";
import { createServer } from "vite";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt;
};

const MAP = arg("map", "map2");
const HORIZONS = arg("years", "100,300,500").split(",").map(Number);
const SEED = arg("seed", "c23b:bounded");
const OUT = arg("out", `docs/evidence/correction23/boundedness-${MAP}.json`);

const r2 = (v) => (v === undefined || v === null ? null : Math.round(v * 100) / 100);
const isLiving = (b) =>
  b.viability?.status !== "extinct" && b.viability?.status !== "absorbed" && (b.demography?.population ?? 0) > 0;

const server = await createServer({
  root: `${process.cwd()}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const verification = await server.ssrLoadModule("/sim/agents/frontierVerification.ts");

  const results = [];
  const maxHorizon = Math.max(...HORIZONS);
  let world = runner.initSimWorld({ kind: MAP }, SEED);

  const repeatTargets = new Map();
  const seenAttempts = new Set();
  let ticks = 0;
  let elapsedMs = 0;

  for (let year = 1; year <= maxHorizon; year += 1) {
    const t0 = performance.now();
    for (let s = 0; s < 4; s += 1) {
      world = runner.stepSim(world, 1, "seasonal");
      ticks += 1;
    }
    elapsedMs += performance.now() - t0;

    for (const band of Object.values(world.bands)) {
      for (const attempt of band.frontierVerificationAttempts ?? []) {
        const key = `${band.id}|${attempt.tileId}|${attempt.question}|${String(attempt.tick)}`;
        if (seenAttempts.has(key)) continue;
        seenAttempts.add(key);
        const pair = `${band.id}|${attempt.tileId}`;
        repeatTargets.set(pair, (repeatTargets.get(pair) ?? 0) + 1);
      }
    }

    if (HORIZONS.includes(year)) {
      const living = Object.values(world.bands).filter(isLiving);
      const historyLengths = living.map((b) => (b.frontierVerificationAttempts ?? []).length);
      const activeVerification = living.map(
        (b) => (b.expeditions ?? []).filter((e) => e.taskKind === "frontier_verification").length,
      );
      const activeAll = living.map((b) => (b.expeditions ?? []).length);
      const repeats = [...repeatTargets.values()];
      // CORRECTION-23B §11 — the AUTHORITATIVE retry memory, which is what now gates a
      // repeat. The 12-entry ring above is a display bound only.
      const evidenceRows = living.map((b) => (b.verificationEvidence ?? []).length);
      const evidenceAttempts = living.flatMap((b) =>
        (b.verificationEvidence ?? []).map((e) => e.attempts),
      );
      // Serialized size of the verification-owned state only, then the whole band.
      const verificationBytes = living.reduce(
        (acc, b) => acc + JSON.stringify(b.frontierVerificationAttempts ?? []).length,
        0,
      );
      const bandBytes = living.reduce((acc, b) => acc + JSON.stringify(b).length, 0);

      results.push({
        years: year,
        livingBands: living.length,
        totalAttempts: seenAttempts.size,
        attemptsPerBand: r2(seenAttempts.size / Math.max(1, living.length)),
        retainedHistoryMax: historyLengths.length === 0 ? 0 : Math.max(...historyLengths),
        retainedHistoryMean: r2(historyLengths.reduce((a, b) => a + b, 0) / Math.max(1, historyLengths.length)),
        historyCap: verification.VERIFICATION_ATTEMPT_HISTORY_CAP,
        activeVerificationMax: activeVerification.length === 0 ? 0 : Math.max(...activeVerification),
        activeVerificationCap: verification.VERIFICATION_ACTIVE_CAP,
        activeExpeditionsMax: activeAll.length === 0 ? 0 : Math.max(...activeAll),
        distinctBandTargetPairs: repeats.length,
        pairsVerifiedMoreThanOnce: repeats.filter((v) => v > 1).length,
        maxRepeatsOnOnePair: repeats.length === 0 ? 0 : Math.max(...repeats),
        verificationStateBytes: verificationBytes,
        verificationBytesPerBand: r2(verificationBytes / Math.max(1, living.length)),
        totalBandBytes: bandBytes,
        verificationShareOfBandState: r2((verificationBytes / Math.max(1, bandBytes)) * 100),
        evidenceRowsMax: evidenceRows.length === 0 ? 0 : Math.max(...evidenceRows),
        evidenceRowsCap: 48,
        maxAttemptsOnOneEvidenceRow: evidenceAttempts.length === 0 ? 0 : Math.max(...evidenceAttempts),
        msPerTick: r2(elapsedMs / Math.max(1, ticks)),
      });

      console.log(JSON.stringify(results[results.length - 1]));
    }
  }

  mkdirSync(OUT.slice(0, OUT.lastIndexOf("/")), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ map: MAP, seed: SEED, results }, null, 2));
  console.log(`\nwrote ${OUT}`);
} finally {
  await server.close();
}
