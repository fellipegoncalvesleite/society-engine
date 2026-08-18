import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";

const AUDIT = "scripts/naturalPhysicalCutoverAudit.mjs";
const ROOT = process.cwd();
const originalByFile = new Map();

const readOriginal = (file) => {
  if (!originalByFile.has(file)) originalByFile.set(file, readFileSync(file, "utf8"));
  return originalByFile.get(file);
};

const replaceExactlyOnce = (source, from, to, label) => {
  const first = source.indexOf(from);
  assert.notEqual(first, -1, `${label}: mutation anchor must exist`);
  assert.equal(source.indexOf(from, first + from.length), -1, `${label}: mutation anchor must be unique`);
  return source.slice(0, first) + to + source.slice(first + from.length);
};

const mutations = [
  {
    id: "M1_remove_natural_atomic_caller",
    file: "src/sim/agents/naturalFissionDeparture.ts",
    from: '  apply: (world, day) => advanceNaturalFissionDepartures(world, day).world,',
    to: '  apply: (world) => world, // MUTANT: physical natural caller disabled',
    expected: "next legal production day must create the natural successor",
  },
  {
    id: "M2_restore_legacy_only_cooldown",
    file: "src/sim/agents/fissionSeparationHistory.ts",
    from: '  for (const record of band.successorDepartureRecords ?? []) {',
    to: '  for (const record of []) { // MUTANT: ignore Direction-D physical departures',
    expected: "physical-separation cooldown history must survive successor reintegration",
  },
  {
    id: "M3_disable_ready_day_protection",
    file: "src/sim/agents/naturalFissionDeparture.ts",
    from: '      today <= attempt.phaseEnteredDay',
    to: '      false // MUTANT: readiness may be consumed on the same simulated day',
    expected: "fixture must reach departure_ready through production proposal/planning/preparation",
  },
  {
    id: "M4_break_one_use_authorization",
    file: "src/sim/agents/fissionDepartureSeam.ts",
    from: '      preparedDeparture: { ...prepared, authorization: consumedAuthorization },',
    to: '      preparedDeparture: prepared, // MUTANT: bodies move while permit remains live',
    expected: "natural departure must consume the one-use permit",
  },
  {
    id: "M5_break_deterministic_successor_identity",
    file: "src/sim/agents/naturalFissionDeparture.ts",
    from: '  `successor:${lineageId}` as BandId;',
    to: '  "successor:collision" as BandId; // MUTANT: all lineages collide',
    expected: "next legal production day must create the natural successor",
  },
  {
    id: "M6_disable_execution_time_cap",
    file: "src/sim/agents/naturalFissionDeparture.ts",
    from: '    if (Object.keys(current.bands).length >= NOMADIC_MAX_MOBILE_BANDS_WARNING_COUNT) {',
    to: '    if (false && Object.keys(current.bands).length >= NOMADIC_MAX_MOBILE_BANDS_WARNING_COUNT) { // MUTANT',
    expected: "one remaining causal band slot must admit exactly one successor",
  },
  {
    id: "M7_disable_stale_ready_resolution",
    file: "src/sim/agents/naturalFissionDeparture.ts",
    from: '            current = abandoned.world;',
    to: '            current = superseded.world; // MUTANT: leave stale ready attempt nonterminal',
    expected: "stale ready attempt must terminalize instead of retrying",
  },
  {
    id: "M8_disable_current_lineage_social_guard",
    file: "src/sim/agents/socialContext.ts",
    from: '    if (left !== undefined && right !== undefined && shareCurrentFissionLineage(left, right)) {',
    to: '    if (false && left !== undefined && right !== undefined && shareCurrentFissionLineage(left, right)) { // MUTANT',
    expected: "parent must not invent stranger contact with its in-flight successor",
  },
];

const results = [];
try {
  for (const mutation of mutations) {
    const original = readOriginal(mutation.file);
    const mutated = replaceExactlyOnce(original, mutation.from, mutation.to, mutation.id);
    writeFileSync(mutation.file, mutated);
    try {
      const run = spawnSync(process.execPath, [AUDIT], {
        cwd: ROOT,
        encoding: "utf8",
        timeout: 120_000,
        env: { ...process.env, CUTOVER_MUTATION: mutation.id },
      });
      const combined = `${run.stdout ?? ""}\n${run.stderr ?? ""}`;
      const caught = run.status !== 0 && combined.includes(mutation.expected);
      results.push({
        id: mutation.id,
        file: mutation.file,
        exitStatus: run.status,
        expectedAssertion: mutation.expected,
        caught,
        outputTail: combined.trim().split("\n").slice(-18).join("\n"),
      });
      assert.equal(caught, true, `${mutation.id}: mutant must alter exercised behavior and be caught by '${mutation.expected}'`);
    } finally {
      writeFileSync(mutation.file, original);
    }
  }
} finally {
  for (const [file, original] of originalByFile.entries()) writeFileSync(file, original);
}

const output = {
  audit: "ROADMAP ITEM 4 — natural physical cutover mutation controls",
  results,
  requiredMutationsCaught: results.slice(0, 7).every((row) => row.caught),
  extraCrossSystemMutationCaught: results[7]?.caught === true,
  verdict: results.every((row) => row.caught) ? "PASS" : "FAIL",
};
const out = "docs/evidence/item4-natural-physical-cutover/mutation-controls.json";
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output, null, 2));
console.log(`written: ${out}`);
