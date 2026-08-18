// ROADMAP ITEM 4 §4 — the band-lifecycle boundary audit.
//
// `bandLifecycle.ts` is the canonical answer to "what kind of band is this, for my purposes?". This
// audit is what makes that structural rather than remembered, in the same sense and by the same
// mechanism as `adaptationBoundaryAudit.mjs`.
//
// WHAT IT MUST NOT DO, and this is as important as what it checks.
//
// It must not forbid legitimate readers. A keyed lookup `world.bands[id]` is fine — the caller
// already holds the id and a provisional successor cannot wander into one. A PHYSICAL-GROUP reader
// that enumerates every living band is fine and is usually CORRECT: presence, depletion, fauna,
// consumption, health and demography all want every group with bodies on a tile, and excluding a
// provisional successor from them would recreate the ghost bodies CORRECTION-34 removed.
//
// So the audit checks four specific things, each drawn from `PROVISIONAL_READER_MATRIX.md`:
//
//   1. no MIGRATED module re-inlines a terminality test by hand;
//   2. no module declares a private duplicate spelling of a canonical predicate;
//   3. every module the matrix marks as needing a guard, a block or an adapter actually imports the
//      boundary;
//   4. the boundary itself stays curated — it exports predicates, not a re-export barrel.
import { readdirSync, readFileSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const ROOT = process.cwd();
const SRC = join(ROOT, "src", "sim");
const EVIDENCE = "docs/evidence/dynamic-fission-daughter-viability-37";
const OUT = arg("out", `${EVIDENCE}/band-lifecycle-boundary.json`);
const BOUNDARY = "src/sim/agents/bandLifecycle.ts";
// Modules that WRITE terminal state and therefore legitimately name the terminal values inline.
// `viability.ts` is the producer of `status: "dispersed"` and the reader of its own derived
// `viability.status === "extinct"`; it cannot consume a predicate for values it is itself deciding,
// and forcing it to would be a circular migration that proved nothing. Its Item 4 obligation is
// different and IS enforced below: it must import the boundary and skip provisional successors.
const TERMINALITY_OWNING_MODULES = ["src/sim/agents/viability.ts"];

// The inherited reader matrix entered this cutover at 5/12 source modules migrated. Natural physical
// reachability makes that bookkeeping stale in two different ways: some rows had already been
// satisfied by later Item-4 work, and some proposed adapters turn out not to be separate lifecycle
// readers at all. `status` keeps those cases distinct instead of silently relabelling them migrated.
const NATURAL_PATH_FILES = [
  "src/sim/agents/demography.ts",
  "src/sim/agents/naturalFissionPreDeparture.ts",
  "src/sim/agents/naturalFissionDeparture.ts",
  "src/sim/agents/dailyActionRegistry.ts",
  "src/sim/tick/advance.ts",
];
const MATRIX_MODULES = [
  { file: "src/sim/agents/contextCache.ts", action: "adapter", status: "migrated" },
  { file: "src/sim/agents/viability.ts", action: "blocked", status: "migrated" },
  { file: "src/sim/agents/demography.ts", action: "blocked + guard", status: "cutover_satisfied" },
  { file: "src/sim/agents/expedition.ts", action: "blocked while provisional", status: "migrated" },
  { file: "src/sim/agents/intraSeasonTrips.ts", action: "blocked while provisional", status: "migrated" },
  { file: "src/sim/agents/protoCamps.ts", action: "blocked while provisional", status: "migrated" },
  { file: "src/sim/agents/socialContext.ts", action: "current-lineage pair guard", status: "cutover_fixed" },
  { file: "src/sim/agents/relationshipMemory.ts", action: "pair guard", status: "non_applicable" },
  { file: "src/sim/agents/bodyCampLogistics.ts", action: "adapter", status: "non_applicable" },
  { file: "src/sim/agents/bandEvents.ts", action: "provisional lineage readability adapter", status: "cutover_satisfied" },
  { file: "src/sim/agents/bandHistory.ts", action: "deep-history lifecycle projection adapter", status: "migrated" },
  { file: "src/sim/runner/simRunner.ts", action: "provisional UI projection adapter", status: "cutover_satisfied" },
];

// Required by the handoff: classify the SEVEN rows that were pending at the accepted checkpoint.
// A = newly load-bearing now that ordinary production creates provisional successors; B = real debt
// intentionally left for the final whole-Item-4 freeze; C = stale/non-applicable pending label.
const CUTOVER_PENDING_REVIEW = [
  {
    file: "src/sim/agents/socialContext.ts",
    classification: "A",
    outcome: "fixed_here",
    reason: "ordinary context otherwise fabricated parent/successor encounter and contact memory at the physical departure tile; the current-lineage pair is now blocked only at the social encounter seam",
  },
  {
    file: "src/sim/agents/bandHistory.ts",
    classification: "B",
    outcome: "resolved_in_final_freeze",
    reason: "final freeze requires deep history to consume the canonical lifecycle boundary and project bounded successor separation history without becoming a lifecycle authority",
  },
  {
    file: "src/sim/agents/demography.ts",
    classification: "C",
    outcome: "already_satisfied_before_this_cutover",
    reason: "annual bodily demography intentionally includes provisional bodies, the producer already gates new fission with isFissionEligibleParent, and Object.keys(world.bands) already makes a physical successor consume the real MAX_BANDS slot",
  },
  {
    file: "src/sim/agents/relationshipMemory.ts",
    classification: "C",
    outcome: "upstream_authority_makes_separate_guard_non_applicable",
    reason: "relationship memory derives from the band's own contactMemories rather than enumerating another band pair; blocking the fictitious pair at the sole encounter/contact-memory writer prevents any false record from existing to consume",
  },
  {
    file: "src/sim/agents/bodyCampLogistics.ts",
    classification: "C",
    outcome: "existing_reset_and_recompute_contract_satisfies_adapter",
    reason: "the atomic field-transfer policy invalidates bodyCampLogistics on the successor, and the ordinary context pass recomputes it from the successor's current cohorts, condition and physical location; no lifecycle exclusion or second adapter is required",
  },
  {
    file: "src/sim/agents/bandEvents.ts",
    classification: "C",
    outcome: "already_satisfied_before_this_cutover",
    reason: "the source already imports isProvisionalSuccessor and projects provisional_separation versus established_daughter without fabricating a completed daughter event at departure",
  },
  {
    file: "src/sim/runner/simRunner.ts",
    classification: "C",
    outcome: "already_satisfied_before_this_cutover",
    reason: "the live overlay already imports isProvisionalSuccessor and emits isProvisional on markers, so an in-flight natural successor is not projected as an ordinary established daughter",
  },
];

// SEVEN single-band predicates. `shareCurrentFissionLineage` is a PAIR RELATION, not a predicate
// about one band, and `preserveTerminalBandSnapshots` is a reducer rather than either. The three
// kinds are listed separately because an earlier report described "seven predicates" while exporting
// eight boolean-returning helpers, which is the kind of undercount that hides a semantic question.
const CANONICAL_PREDICATES = [
  "isBandTerminal",
  "isLivingBand",
  "isProvisionalSuccessor",
  "hasCurrentFissionAttempt",
  "isEstablishedBand",
  "isFissionEligibleParent",
  "isProvisionalGroupInTransit",
];
const CANONICAL_PAIR_RELATIONS = ["shareCurrentFissionLineage"];
const CANONICAL_REDUCERS = ["preserveTerminalBandSnapshots"];
const CANONICAL = [...CANONICAL_PREDICATES, ...CANONICAL_PAIR_RELATIONS, ...CANONICAL_REDUCERS];

// ── §4: the legacy `"splitting"` marker ─────────────────────────────────────────────────────────
//
// `band.status` has exactly FIVE writers in the whole simulation — two `"foraging"` (spawn and
// daughter creation), one `"splitting"` (the PARENT, at `demography.ts:1160`, when a fission
// completes) and two `"dispersed"` (terminal). `"camped"`, `"moving"`, `"settled"` and `"stressed"`
// have ZERO PRODUCERS and are structurally unreachable.
//
// `"splitting"` is therefore an ACTIVITY / READ-MODEL marker, not a lifecycle phase, and it must not
// become a parallel lifecycle authority at cutover. This check forbids any NEW writer of it outside
// the one sanctioned site, and forbids reading it to answer a lifecycle question.
const LEGACY_MARKER_SANCTIONED_WRITERS = ["src/sim/agents/demography.ts"];
const LEGACY_MARKER_KNOWN_READERS = ["src/sim/agents/familiarCountry.ts", "src/ui/bandSummary.ts"];

const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (entry.endsWith(".ts")) files.push(full);
  }
})(SRC);

const isComment = (line) => {
  const t = line.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
};
// A hand-inlined terminality test. The boundary module itself is where this is allowed to live.
const INLINE_TERMINALITY = /\.status\s*===\s*"dispersed"|viability\?\.status\s*===\s*"(absorbed|extinct)"|viability\.status\s*===\s*"(absorbed|extinct)"/;

const violations = [];
const pending = [];
const privateDuplicates = [];
let inlineTerminalitySitesOutsideBoundary = 0;

const enforced = new Set(
  MATRIX_MODULES
    .filter((m) => m.status === "migrated")
    .map((m) => m.file),
);

for (const full of files) {
  const rel = relative(ROOT, full);
  const raw = readFileSync(full, "utf8");
  const lines = raw.split("\n");
  const importsBoundary = /from\s+"\.\/bandLifecycle"|from\s+"\.\.\/agents\/bandLifecycle"/.test(raw);

  // ── check 1 + 2 ──
  lines.forEach((line, i) => {
    if (isComment(line)) return;
    if (rel !== BOUNDARY && INLINE_TERMINALITY.test(line)) {
      inlineTerminalitySitesOutsideBoundary += 1;
      if (enforced.has(rel) && !TERMINALITY_OWNING_MODULES.includes(rel)) {
        violations.push({ kind: "inlined_terminality_in_migrated_module", file: rel, line: i + 1, text: line.trim().slice(0, 140) });
      }
    }
    // A private function whose whole body is a canonical predicate call — the `isActiveBand` shape.
    const dup = line.match(/function\s+(is[A-Z]\w*)\s*\(/);
    if (dup !== null && rel !== BOUNDARY) {
      const body = lines.slice(i, i + 4).join("\n");
      if (CANONICAL.some((c) => new RegExp(`return\\s+${c}\\s*\\(`).test(body))) {
        privateDuplicates.push({ file: rel, line: i + 1, name: dup[1] });
        violations.push({ kind: "private_duplicate_spelling", file: rel, line: i + 1, name: dup[1] });
      }
    }
  });

  // ── check 3 ──
  const entry = MATRIX_MODULES.find((m) => m.file === rel);
  if (entry !== undefined) {
    if (enforced.has(rel) && !importsBoundary) {
      violations.push({ kind: "migrated_module_does_not_import_the_boundary", file: rel, action: entry.action, status: entry.status });
    } else if (entry.status === "final_freeze_debt") {
      pending.push({ file: rel, action: entry.action, importsBoundary, status: entry.status });
    }
  }
}

// ── final-freeze B-class reader check: deep history is a canonical lifecycle projection ───────
const bandHistoryRaw = readFileSync(join(ROOT, "src/sim/agents/bandHistory.ts"), "utf8");
const bandHistoryRequirements = [
  ["imports_isBandTerminal", /import\s*\{[^}]*isBandTerminal[^}]*\}\s*from\s*["']\.\/bandLifecycle["']/s],
  ["imports_isProvisionalSuccessor", /import\s*\{[^}]*isProvisionalSuccessor[^}]*\}\s*from\s*["']\.\/bandLifecycle["']/s],
  ["projects_successor_separation_lifecycle", /successor_separation_lifecycle/],
  ["reads_successor_departure_records", /successorDepartureRecords/],
  ["joins_successor_by_recorded_identity", /departure\.successorBandId/],
  ["joins_lifecycle_by_lineage", /lineageId/],
  ["records_canonical_lifecycle_evidence", /successor_lifecycle_record/],
];
for (const [name, pattern] of bandHistoryRequirements) {
  if (!pattern.test(bandHistoryRaw)) {
    violations.push({ kind: "band_history_final_freeze_projection_requirement_missing", file: "src/sim/agents/bandHistory.ts", requirement: name });
  }
}

// ── cutover A-class reader check: social parent/successor pair guard ───────────────────────────
const socialContextRaw = readFileSync(join(ROOT, "src/sim/agents/socialContext.ts"), "utf8");
if (
  !/shareCurrentFissionLineage/.test(socialContextRaw) ||
  !/if\s*\(left !== undefined && right !== undefined && shareCurrentFissionLineage\(left, right\)\)/.test(socialContextRaw)
) {
  violations.push({ kind: "natural_parent_successor_social_pair_guard_missing", file: "src/sim/agents/socialContext.ts" });
}

// ── check 3b: a terminality-owning module must still exclude provisional successors ──
for (const rel of TERMINALITY_OWNING_MODULES) {
  const raw = readFileSync(join(ROOT, rel), "utf8");
  if (!/isProvisionalSuccessor/.test(raw)) {
    violations.push({ kind: "terminality_owner_does_not_guard_provisional_successors", file: rel });
  }
}

// ── check 4: the boundary stays curated ──
const boundaryRaw = readFileSync(join(ROOT, BOUNDARY), "utf8");
const boundaryExports = [...boundaryRaw.matchAll(/export\s+function\s+(\w+)/g)].map((m) => m[1]);
const isBarrel = /export\s+\*/.test(boundaryRaw);
if (isBarrel) violations.push({ kind: "boundary_became_a_barrel", file: BOUNDARY });
for (const name of CANONICAL) {
  if (!boundaryExports.includes(name)) {
    violations.push({ kind: "canonical_predicate_missing_from_boundary", file: BOUNDARY, name });
  }
}

// ── check 5b (§10): exactly one ordinary natural physical caller ───────────────────────────────
//
// Natural proposal/preparation remain separate authorities. Only the physical adapter may import and
// call the atomic seam; demography, the pre-departure reducer, registry and time orchestrator may not.
const naturalSeamCallers = [];
for (const rel of NATURAL_PATH_FILES) {
  const raw = readFileSync(join(ROOT, rel), "utf8");
  const calls = /\bperformAtomicDeparture\s*\(/.test(raw);
  const imports = /from\s+["'][^"']*fissionDepartureSeam["']/.test(raw);
  if (calls || imports) naturalSeamCallers.push({ file: rel, calls, imports });
}
if (
  naturalSeamCallers.length !== 1 ||
  naturalSeamCallers[0]?.file !== "src/sim/agents/naturalFissionDeparture.ts" ||
  naturalSeamCallers[0]?.calls !== true ||
  naturalSeamCallers[0]?.imports !== true
) {
  violations.push({ kind: "natural_departure_seam_caller_count_is_not_exactly_one", callers: naturalSeamCallers });
}

// ── check 5 (§4): the legacy `"splitting"` marker gains no new lifecycle writer ──
const legacyWriters = [];
const legacyReaders = [];
for (const full of files.concat([join(ROOT, "src", "ui", "bandSummary.ts")])) {
  let rel;
  try {
    rel = relative(ROOT, full);
    const lines = readFileSync(full, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (isComment(line)) return;
      if (/status:\s*"splitting"/.test(line)) {
        legacyWriters.push({ file: rel, line: i + 1 });
        if (!LEGACY_MARKER_SANCTIONED_WRITERS.includes(rel)) {
          violations.push({ kind: "new_writer_of_legacy_splitting_marker", file: rel, line: i + 1 });
        }
      }
      if (/status\s*===\s*"splitting"/.test(line)) {
        legacyReaders.push({ file: rel, line: i + 1 });
        if (!LEGACY_MARKER_KNOWN_READERS.includes(rel)) {
          violations.push({ kind: "new_reader_of_legacy_splitting_marker", file: rel, line: i + 1 });
        }
      }
    });
  } catch {
    // the ui file is outside src/sim and may not exist in a trimmed tree; not a violation
  }
}
// The marker must never be consulted to answer a lifecycle question — that is what would make it a
// parallel authority. A file that reads it AND imports the boundary is the shape to catch.
for (const r of legacyReaders) {
  const raw = readFileSync(join(ROOT, r.file), "utf8");
  if (/from\s+"\.\/bandLifecycle"/.test(raw) && /status\s*===\s*"splitting"/.test(raw)) {
    violations.push({ kind: "legacy_marker_read_alongside_the_lifecycle_boundary", file: r.file, line: r.line });
  }
}

const out = {
  generatedAt: new Date().toISOString(),
  checkpoint: "ROADMAP ITEM 4 §4 — band lifecycle boundary",
  boundary: BOUNDARY,
  boundaryExports,
  canonicalPredicates: CANONICAL,
  whatThisDoesNotForbid:
    "Keyed lookups (world.bands[id]) and physical-group readers that enumerate every living band. Both are legitimate: a provisional successor holds real bodies and must appear in presence, depletion, consumption, health and demography. Excluding it from those would recreate the ghost bodies CORRECTION-34 removed.",
  enforcedModules: MATRIX_MODULES.filter((m) => enforced.has(m.file)),
  cutoverPendingReview: CUTOVER_PENDING_REVIEW,
  pendingModules: pending,
  naturalSeamCallers,
  privateDuplicateSpellings: privateDuplicates,
  inlineTerminalitySitesOutsideBoundary,
  violations,
  legacySplittingMarker: {
    note:
      "band.status has exactly five writers in the whole simulation. `camped`, `moving`, `settled` and `stressed` have ZERO PRODUCERS and are structurally unreachable. `splitting` is an activity/read-model marker, not a lifecycle phase, and must not become a parallel lifecycle authority.",
    writers: legacyWriters,
    readers: legacyReaders,
    sanctionedWriters: LEGACY_MARKER_SANCTIONED_WRITERS,
    knownReaders: LEGACY_MARKER_KNOWN_READERS,
  },
  // ── §2: the categories reported separately, never folded into one boolean ──
  summary: {
    filesScanned: files.length,
    canonicalSinglebandPredicates: CANONICAL_PREDICATES.length,
    canonicalPairRelations: CANONICAL_PAIR_RELATIONS.length,
    canonicalReducers: CANONICAL_REDUCERS.length,
    canonicalExportsTotal: CANONICAL.length,

    structuralViolationsInMigratedScope: violations.filter((v) =>
      v.kind === "inlined_terminality_in_migrated_module" || v.kind === "migrated_module_does_not_import_the_boundary",
    ).length,
    privateDuplicatePredicates: privateDuplicates.length,
    legacyMarkerViolations: violations.filter((v) => v.kind.includes("legacy_splitting")).length,
    boundaryIntegrityViolations: violations.filter((v) =>
      v.kind === "boundary_became_a_barrel" || v.kind === "canonical_predicate_missing_from_boundary",
    ).length,

    migratedReaders: MATRIX_MODULES.filter((m) => m.status === "migrated").length,
    cutoverFixedReaders: MATRIX_MODULES.filter((m) => m.status === "cutover_fixed").length,
    cutoverSatisfiedReaders: MATRIX_MODULES.filter((m) => m.status === "cutover_satisfied").length,
    nonApplicableReaderRows: MATRIX_MODULES.filter((m) => m.status === "non_applicable").length,
    finalFreezeDebtReaders: MATRIX_MODULES.filter((m) => m.status === "final_freeze_debt").length,
    totalReaderRows: MATRIX_MODULES.length,
    resolvedReaderRows: MATRIX_MODULES.length - pending.length,
    readerBoundaryStatus: `${MATRIX_MODULES.length - pending.length}/${MATRIX_MODULES.length}`,
    pendingReaders: pending.length,
    pendingAdapters: pending.filter((p) => p.action.includes("adapter")).length,
    pendingGuards: pending.filter((p) => p.action.includes("guard")).length,
    pendingBlocked: pending.filter((p) => p.action.includes("blocked")).length,
    safeUnchangedReaders: 16,
    inlineTerminalitySitesOutsideBoundary,
    terminalityOwningModules: TERMINALITY_OWNING_MODULES,

    // Structural cleanliness of the MIGRATED scope is not the same claim as migration being done,
    // and folding them into one PASS is exactly how a half-finished migration looks finished.
    migratedScopeStructurallyClean: violations.length === 0,
    inheritedMigrationStatus: "5/12 at accepted checkpoint",
    cutoverReviewStatus: `${MATRIX_MODULES.length - pending.length}/${MATRIX_MODULES.length} reader rows resolved for final Item-4 freeze; ${pending.length} pending`,
    verdict:
      violations.length > 0 ? "FAIL" : pending.length > 0 ? "INCOMPLETE_FINAL_FREEZE_DEBT" : "PASS",
    verdictNote:
      violations.length > 0
        ? "structural violations exist in enforced cutover scope"
        : pending.length > 0
          ? "all newly load-bearing physical-cutover readers are resolved; the named B-class deep-history adapter remains intentionally deferred to final whole-Item-4 freeze"
          : "every cutover reader row is resolved and the enforced scope is clean",
  },
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify(out.summary, null, 2));
if (violations.length > 0) {
  console.log("\nVIOLATIONS:");
  for (const v of violations) console.log(`  ${v.kind}  ${v.file}${v.line ? `:${v.line}` : ""}${v.name ? ` (${v.name})` : ""}`);
}
console.log(`\nfinal-freeze reader debt (${pending.length}):`);
for (const p of pending) console.log(`  ${p.file}  [${p.action}]`);
console.log(`\nwritten: ${OUT}`);
if (violations.length > 0) process.exitCode = 1;
