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

const applyMutation = (source, mutation) => {
  const edits = mutation.edits ?? [{ from: mutation.from, to: mutation.to }];
  return edits.reduce(
    (current, edit, index) => replaceExactlyOnce(current, edit.from, edit.to, `${mutation.id}[${index}]`),
    source,
  );
};

const mutations = [
  {
    id: "M1_remove_natural_atomic_caller",
    file: "src/sim/agents/naturalFissionDeparture.ts",
    from: '  apply: (world, day) => advanceNaturalFissionDepartures(world, day).world,',
    to: '  apply: (world) => world, // MUTANT: physical natural caller disabled',
    expected: "next legal production day must create the natural successor",
    authority: "naturalFissionDepartureDailyAction.apply",
    causalProperty: "ordinary daily production reaches performAtomicDeparture",
    baselineBehavior: "a canonical ready natural attempt creates its successor on the next legal production day",
    mutantBehavior: "the registered physical-departure action becomes a no-op, so no successor is created",
    nonVacuity: "the same fixture already reached canonical departure_ready and the direct seam control succeeds",
  },
  {
    id: "M2_restore_legacy_only_cooldown",
    file: "src/sim/agents/fissionSeparationHistory.ts",
    from: '  for (const record of band.successorDepartureRecords ?? []) {',
    to: '  for (const record of []) { // MUTANT: ignore Direction-D physical departures',
    expected: "physical-separation cooldown history must survive successor reintegration",
    authority: "getLatestPhysicalSeparationTick Direction-D record scan",
    causalProperty: "cooldown is keyed to real physical successor departure rather than only legacy fission history",
    baselineBehavior: "the parent retains the physical departure tick after downstream reintegration",
    mutantBehavior: "Direction-D records are ignored and the real split disappears from cooldown history",
    nonVacuity: "the fixture has a real successorDepartureRecord and no Direction-D legacy BandFissionEvent",
  },
  {
    id: "M3_disable_ready_day_protection",
    file: "src/sim/agents/naturalFissionDeparture.ts",
    from: '      today <= attempt.phaseEnteredDay',
    to: '      false // MUTANT: readiness may be consumed on the same simulated day',
    expected: "readiness created on D cannot be consumed on D",
    authority: "advanceNaturalFissionDepartures ready-day guard",
    causalProperty: "departure_ready written on day D cannot be physically consumed on D",
    baselineBehavior: "directly offering the canonical ready state on phaseEnteredDay produces zero departure records and zero successor",
    mutantBehavior: "the same-day call consumes readiness and physically creates the successor immediately",
    nonVacuity: "fixture creation bypasses only the physical reducer, then invokes the mutated production reducer on the exact readiness day",
  },
  {
    id: "M4_break_one_use_authorization",
    file: "src/sim/agents/fissionDepartureSeam.ts",
    from: '      preparedDeparture: { ...prepared, authorization: consumedAuthorization },',
    to: '      preparedDeparture: prepared, // MUTANT: bodies move while permit remains live',
    expected: "natural departure must consume the one-use permit",
    authority: "performAtomicDeparture parent preparedDeparture write",
    causalProperty: "physical transfer spends the one-use founder departure authorization atomically",
    baselineBehavior: "the parent retains the preparation record with authorization status consumed_by_departure",
    mutantBehavior: "bodies move but the parent still holds a live authorization",
    nonVacuity: "the fixture physically creates the successor before checking the retained permit",
  },
  {
    id: "M5_break_deterministic_successor_identity",
    file: "src/sim/agents/naturalFissionDeparture.ts",
    from: '  `successor:${lineageId}` as BandId;',
    to: '  "successor:collision" as BandId; // MUTANT: all lineages collide',
    expected: "independent canonical lineages must not compete for one occupied successor id",
    authority: "makeNaturalSuccessorBandId",
    causalProperty: "independent canonical lineages derive distinct deterministic physical successor identities",
    baselineBehavior: "two independently prepared ready parents with ample capacity both depart and produce two distinct successors",
    mutantBehavior: "the first parent creates successor:collision; the second reaches the occupied-ID seam and is refused instead of overwriting it",
    nonVacuity: "both parents are canonically ready, capacity is ample for both, and baseline has two departures with zero refusals",
  },
  {
    id: "M6_disable_execution_time_cap",
    file: "src/sim/agents/naturalFissionDeparture.ts",
    from: '    if (Object.keys(current.bands).length >= NOMADIC_MAX_MOBILE_BANDS_WARNING_COUNT) {',
    to: '    if (false && Object.keys(current.bands).length >= NOMADIC_MAX_MOBILE_BANDS_WARNING_COUNT) { // MUTANT',
    expected: "one remaining causal band slot must admit exactly one successor",
    authority: "advanceNaturalFissionDepartures execution-time retained-object cap",
    causalProperty: "concurrent ready attempts cannot overshoot the 36 retained Band-object bound",
    baselineBehavior: "35 retained Band objects admit exactly one successor and defer the other canonical ready attempt",
    mutantBehavior: "both ready attempts execute and the retained object count overshoots the cap",
    nonVacuity: "the fixture has two canonical ready attempts competing for exactly one remaining slot",
  },
  {
    id: "M7_disable_stale_ready_resolution",
    file: "src/sim/agents/naturalFissionDeparture.ts",
    from: '            current = abandoned.world;',
    to: '            current = superseded.world; // MUTANT: leave stale ready attempt nonterminal',
    expected: "stale ready attempt must terminalize instead of retrying",
    authority: "advanceNaturalFissionDepartures permanent-staleness resolution",
    causalProperty: "a permanently stale accepted attempt is superseded and abandoned rather than retried forever",
    baselineBehavior: "changed founder terms move nobody and terminalize the named attempt as abandoned",
    mutantBehavior: "the superseded preparation remains attached to a nonterminal ready attempt",
    nonVacuity: "the fixture changes the prepared cohort after acceptance and verifies that no successor was created",
  },
  {
    id: "M8_disable_current_lineage_social_guard",
    file: "src/sim/agents/socialContext.ts",
    from: '    if (left !== undefined && right !== undefined && shareCurrentFissionLineage(left, right)) {',
    to: '    if (false && left !== undefined && right !== undefined && shareCurrentFissionLineage(left, right)) { // MUTANT',
    expected: "parent must not invent stranger contact with its in-flight successor",
    authority: "socialContext current-fission-lineage exclusion",
    causalProperty: "a parent and its live provisional successor are not reinterpreted as unrelated strangers",
    baselineBehavior: "ordinary context update creates no parent↔successor stranger contact memory at departure",
    mutantBehavior: "co-located parent and newborn can be processed by the ordinary stranger-contact path",
    nonVacuity: "the successor physically exists at the parent's departure tile when social context is evaluated",
  },
  {
    id: "M9_birth_day_work_ordering",
    file: "src/sim/agents/dailyActionRegistry.ts",
    edits: [
      {
        from: '  provisionalTravelDailyAction,',
        to: '  naturalFissionDepartureDailyAction, // MUTANT: departure runs before provisional travel\n  provisionalTravelDailyAction,',
      },
      {
        from: '  naturalFissionDepartureDailyAction,\n];',
        to: '];',
      },
    ],
    expected: "new successor must not receive same-day travel",
    authority: "DEFAULT_DAILY_ACTIONS absolute-last natural_fission_departure registration",
    causalProperty: "a successor physically born on D receives no downstream provisional work later on D",
    baselineBehavior: "the production-born successor is byte-identical to a direct seam newborn and has an empty trail on its departure day",
    mutantBehavior: "departure executes before provisionalTravelDailyAction, which sees the newborn and writes same-day travel state",
    nonVacuity: "the mutant still creates the successor on its legal departure day; the downstream mover then consumes that real newborn",
  },
];

const baseline = spawnSync(process.execPath, [AUDIT], {
  cwd: ROOT,
  encoding: "utf8",
  timeout: 120_000,
  env: { ...process.env, CUTOVER_MUTATION: "" },
});
assert.equal(
  baseline.status,
  0,
  `mutation baseline must be genuinely green before counterfactuals run\n${baseline.stdout ?? ""}\n${baseline.stderr ?? ""}`,
);

const results = [];
try {
  for (const mutation of mutations) {
    const original = readOriginal(mutation.file);
    const mutated = applyMutation(original, mutation);
    writeFileSync(mutation.file, mutated);
    let row;
    let restorationVerified = false;
    try {
      const run = spawnSync(process.execPath, [AUDIT], {
        cwd: ROOT,
        encoding: "utf8",
        timeout: 120_000,
        env: { ...process.env, CUTOVER_MUTATION: mutation.id },
      });
      const combined = `${run.stdout ?? ""}\n${run.stderr ?? ""}`;
      const caught = run.status !== 0 && combined.includes(mutation.expected);
      row = {
        id: mutation.id,
        file: mutation.file,
        authority: mutation.authority,
        causalProperty: mutation.causalProperty,
        baselineBehavior: mutation.baselineBehavior,
        mutantBehavior: mutation.mutantBehavior,
        nonVacuity: mutation.nonVacuity,
        exitStatus: run.status,
        expectedAssertion: mutation.expected,
        caught,
        outputTail: combined.trim().split("\n").slice(-18).join("\n"),
      };
    } finally {
      writeFileSync(mutation.file, original);
      restorationVerified = readFileSync(mutation.file, "utf8") === original;
    }
    row.restorationVerified = restorationVerified;
    results.push(row);
    assert.equal(row.caught, true, `${mutation.id}: mutant must alter exercised behavior and be caught by '${mutation.expected}'`);
    assert.equal(restorationVerified, true, `${mutation.id}: production source must be restored byte-for-byte after mutation`);
  }
} finally {
  for (const [file, original] of originalByFile.entries()) writeFileSync(file, original);
}

const output = {
  audit: "ROADMAP ITEM 4 — natural physical cutover mutation controls",
  baseline: {
    exitStatus: baseline.status,
    genuinelyExercised: baseline.status === 0,
  },
  semanticGroups: {
    readyDayBarrier: results.find((row) => row.id === "M3_disable_ready_day_protection")?.caught === true,
    birthDayNoDownstreamWork: results.find((row) => row.id === "M9_birth_day_work_ordering")?.caught === true,
    realSuccessorCollision: results.find((row) => row.id === "M5_break_deterministic_successor_identity")?.caught === true,
  },
  results,
  allMutationsCaught: results.every((row) => row.caught),
  allSourcesRestored: results.every((row) => row.restorationVerified),
  verdict: results.every((row) => row.caught && row.restorationVerified) ? "PASS" : "FAIL",
};
const out = "docs/evidence/item4-natural-physical-cutover/mutation-controls.json";
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output, null, 2));
console.log(`written: ${out}`);
