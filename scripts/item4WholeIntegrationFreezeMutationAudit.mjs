// ROADMAP ITEM 4 — FINAL FREEZE MUTATION CONTROL.
// Remove the deep-history projection only. The physical lifecycle must still execute to the same
// terminal outcomes, and the whole-integration audit must fail because that history disappears.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const OUT = arg("out", "docs/evidence/item4-final-freeze/whole-integration-mutation.json");
const AUDIT = "scripts/item4WholeIntegrationFreezeAudit.mjs";
const SOURCE = "src/sim/agents/bandHistory.ts";
const sha = (value) => createHash("sha256").update(value).digest("hex");
const original = readFileSync(SOURCE, "utf8");
const originalHash = sha(original);
const baselineOut = `/tmp/item4-freeze-mutation-baseline-${process.pid}.json`;
const mutantOut = `/tmp/item4-freeze-mutation-mutant-${process.pid}.json`;
const runAudit = (out) => spawnSync(process.execPath, [AUDIT, "--out", out], {
  cwd: process.cwd(),
  encoding: "utf8",
  timeout: 180_000,
});

const baseline = runAudit(baselineOut);
assert.equal(baseline.status, 0, `freeze mutation baseline must be green\n${baseline.stdout}\n${baseline.stderr}`);
const baselineJson = JSON.parse(readFileSync(baselineOut, "utf8"));
assert.equal(baselineJson.summary.verdict, "PASS", "baseline behavioral audit must report PASS");
assert.equal(baselineJson.fixtures.every((row) => row.nonVacuous === true), true, "baseline fixtures must all be non-vacuous");

const anchor = `): readonly BandHistoricalEpisode[] {\n  const id = \`episode:\${String(ownerBandId)}:successor_separation_lifecycle:\${departure.lineageId}\`;`;
const replacement = `): readonly BandHistoricalEpisode[] {\n  if (departure !== undefined) return existing; // MUTANT: erase deep-history lifecycle projection only\n  const id = \`episode:\${String(ownerBandId)}:successor_separation_lifecycle:\${departure.lineageId}\`;`;
const count = original.split(anchor).length - 1;
assert.equal(count, 1, `mutation anchor must be unique, found ${count}`);
const mutant = original.replace(anchor, replacement);
let mutantRun;
let mutantJson;
let restored = false;
try {
  writeFileSync(SOURCE, mutant, "utf8");
  mutantRun = runAudit(mutantOut);
  mutantJson = JSON.parse(readFileSync(mutantOut, "utf8"));
} finally {
  writeFileSync(SOURCE, original, "utf8");
  restored = readFileSync(SOURCE, "utf8") === original && sha(readFileSync(SOURCE, "utf8")) === originalHash;
}

const byId = Object.fromEntries((mutantJson?.fixtures ?? []).map((row) => [row.id, row]));
const physicalLifecycleStillRan =
  byId.F1_stabilized_successor_retains_physical_separation_history?.detail?.phase === "stabilized" &&
  byId.F2_post_return_establishment_preserves_distinct_terminal_outcome?.detail?.phase === "established_after_failed_return" &&
  byId.F3_parent_history_closes_real_reintegration_without_fabricating_daughter_success?.detail?.terminalPhase === "reintegrated" &&
  byId.F4_provisional_extinction_remains_a_distinct_terminal_history?.detail?.terminalPhase === "provisional_extinguished";
const historySpecificallyLost =
  (byId.F1_stabilized_successor_retains_physical_separation_history?.detail?.episodes?.length ?? -1) === 0 &&
  (byId.F2_post_return_establishment_preserves_distinct_terminal_outcome?.detail?.episodes?.length ?? -1) === 0 &&
  (byId.F3_parent_history_closes_real_reintegration_without_fabricating_daughter_success?.detail?.episodes?.length ?? -1) === 0 &&
  (byId.F4_provisional_extinction_remains_a_distinct_terminal_history?.detail?.episodes?.length ?? -1) === 0;
const caught = mutantRun?.status !== 0 && mutantJson?.summary?.verdict === "FAIL" && physicalLifecycleStillRan && historySpecificallyLost;

const output = {
  checkpoint: "ROADMAP ITEM 4 — FINAL WHOLE-INTEGRATION FREEZE MUTATION",
  generatedAt: new Date().toISOString(),
  baseline: {
    exitStatus: baseline.status,
    verdict: baselineJson.summary.verdict,
    nonVacuousFixtures: baselineJson.fixtures.filter((row) => row.nonVacuous === true).length,
  },
  mutation: {
    id: "M1_disable_band_history_successor_lifecycle_projection",
    file: SOURCE,
    physicalLifecycleStillRan,
    historySpecificallyLost,
    mutantExitStatus: mutantRun?.status,
    mutantVerdict: mutantJson?.summary?.verdict,
    failedFixtureIds: (mutantJson?.fixtures ?? []).filter((row) => row.verdict !== "PASS").map((row) => row.id),
    caught,
  },
  restoration: {
    sourceSha256Before: originalHash,
    sourceSha256After: sha(readFileSync(SOURCE, "utf8")),
    byteIdentical: restored,
  },
  verdict: caught && restored ? "PASS" : "FAIL",
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output, null, 2));
assert.equal(caught, true, "mutation must be caught specifically because deep history loses the lifecycle while physical outcomes remain intact");
assert.equal(restored, true, "bandHistory.ts must be restored byte-for-byte after mutation");
