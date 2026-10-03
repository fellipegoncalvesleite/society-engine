// Full-known compatibility vector against the reviewed pre-correction bytes.
// Coverage telemetry and the explicitly corrected maturity classification are
// excluded; every other canonical numeric output must remain byte-for-byte equal
// for actual and legacy histories, including demand/rounding boundaries.
import assert from "node:assert/strict";
import { createServer } from "vite";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const BASE = "bf5807e75bb650872d9c81cf95dce5dc1df6a509";
const OUT = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : undefined;
assert.ok(OUT, "fresh explicit --out required");
const overlay = {
  name: "diag1-full-known-reviewed-base",
  enforce: "pre",
  transform(code, id) {
    const relative = id.match(/\/(src\/sim\/agents\/(?:nutritionExposure|seasonalSurvival)\.ts)$/)?.[1];
    return relative ? execFileSync("git", ["show", `${BASE}:${relative}`], { encoding: "utf8" }) : undefined;
  },
};
const vectorFields = ["currentFoodStress", "recentFoodStress", "chronicFoodStress", "recoveryRelief", "nutritionalSurplus", "foodMovementPressure", "foodDemographicPressure"];
const ratios = [0, 0.315, 0.58, 0.92, 0.98, 1.12, 1.72];
const demands = [1, 7, 120];
const makeSample = (time, startDay, endDay, ratio, demand, quantityBasis) => {
  const duration = endDay - startDay;
  const actual = quantityBasis === "actual";
  const segment = actual
    ? { startDay, endDay, supportUnits: ratio * demand * duration, demandUnits: demand * duration, foodStress: Math.max(0, 1 - ratio), waterStress: 0.18, perCapitaReturn: ratio >= .98 ? 1 : ratio, recoveryEligible: ratio >= .98 }
    : { startDay, endDay, rawSupportRatio: ratio, foodStress: Math.max(0, 1 - ratio), waterStress: 0.18, perCapitaReturn: ratio >= .98 ? 1 : ratio, recoveryEligible: ratio >= .98 };
  const exposure = { version: 1, startDay, endDay, durationDays: duration, producer: "residential", provenance: "full-known-compatibility", ...(actual ? { quantityBasis: "actual" } : { quantityBasis: "legacy_ratio_only" }),
    ...(actual ? { supportUnits: segment.supportUnits, demandUnits: segment.demandUnits } : {}), foodStressDays: duration * segment.foodStress, waterStressDays: duration * segment.waterStress, recoveryDays: segment.recoveryEligible ? duration : 0, segments: [segment] };
  return { ...time.getWorldTimeForDay(endDay), rawSupportRatio: ratio, clampedSupportRatio: Math.min(1, ratio), perCapitaReturn: segment.perCapitaReturn, seasonalModifier: 1, foodStress: segment.foodStress, waterStress: segment.waterStress, deficitRatio: segment.foodStress, mode: ratio >= 1 ? "neutral" : "lean", exposure };
};
const run = async (server) => {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const nutrition = await server.ssrLoadModule("/sim/agents/seasonalSurvival.ts");
  const time = await server.ssrLoadModule("/sim/tick/time.ts");
  const baseBand = Object.values(runner.initSimWorld({ kind: "map2" }, "diag1:full-known-vector").bands)[0];
  const rows = [];
  for (const quantityBasis of ["actual", "legacy_ratio_only"]) {
    for (const demand of demands) {
      for (const ratio of ratios) {
        let state;
        state = nutrition.recordSupportInterval(state, makeSample(time, 0, 90, ratio, demand, quantityBasis), baseBand, time.getWorldTimeForDay(90), { topSeasonalSupportReasons: [], replaceSameTickSample: false });
        const canonical = nutrition.deriveCanonicalNutritionState(state);
        const annual = nutrition.deriveAnnualNutritionState(state, 90);
        rows.push({ quantityBasis, demand, ratio, canonical: Object.fromEntries(vectorFields.map((f) => [f, canonical[f]])), annual: Object.fromEntries(vectorFields.map((f) => [f, annual[f]])) });
      }
      let mixed;
      for (const [i, ratio] of [0.315, 0.92, 1.12, 1.72].entries()) mixed = nutrition.recordSupportInterval(mixed, makeSample(time, i * 90, (i + 1) * 90, ratio, demand, quantityBasis), baseBand, time.getWorldTimeForDay((i + 1) * 90), { topSeasonalSupportReasons: [], replaceSameTickSample: false });
      rows.push({ quantityBasis, demand, ratio: "mixed", canonical: Object.fromEntries(vectorFields.map((f) => [f, nutrition.deriveCanonicalNutritionState(mixed)[f]])), annual: Object.fromEntries(vectorFields.map((f) => [f, nutrition.deriveAnnualNutritionState(mixed, 360)[f]])) });
    }
  }
  return rows;
};
const makeServer = async (plugins = [], tag = "candidate") => createServer({ root: `${process.cwd()}/src`, configFile: false, cacheDir: `node_modules/.vite-diag1-vector-${tag}-${process.pid}`, appType: "custom", server: { middlewareMode: true, hmr: false, watch: null, ws: false }, logLevel: "error", plugins });
const candidateServer = await makeServer([], "candidate");
const candidate = await run(candidateServer);
await candidateServer.close();
const baseServer = await makeServer([overlay], "reviewed-base");
const reviewedBase = await run(baseServer);
await baseServer.close();
assert.deepEqual(candidate, reviewedBase);
const out = { check: "DIAG1-PHASE2-FULL-KNOWN-COMPATIBILITY", verdict: "PASS", baseCommit: BASE, excluded: ["nutritionCoverage telemetry", "knownPopulationFraction telemetry", "explicitly corrected recovery maturity classification"], vectorFields, rows: candidate.length, actualAndLegacy: true, varyingDemands: demands, roundingRatios: ratios, candidate, reviewedBase };
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify({ check: out.check, verdict: out.verdict, rows: out.rows, baseCommit: BASE }));
