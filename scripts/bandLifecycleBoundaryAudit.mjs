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

// Modules the reader matrix marks as needing a guard, a block or an adapter. Until a module is
// migrated it is listed as PENDING rather than failing the run — an audit that fails on work that is
// honestly not started yet would have to be disabled to make progress, and a disabled audit proves
// nothing. `migrated: true` moves it into the enforced set.
const MATRIX_MODULES = [
  { file: "src/sim/agents/contextCache.ts", action: "adapter", migrated: true },
  { file: "src/sim/agents/viability.ts", action: "blocked", migrated: false },
  { file: "src/sim/agents/demography.ts", action: "blocked + guard", migrated: false },
  { file: "src/sim/agents/expedition.ts", action: "blocked while travelling", migrated: false },
  { file: "src/sim/agents/intraSeasonTrips.ts", action: "blocked while travelling", migrated: false },
  { file: "src/sim/agents/protoCamps.ts", action: "blocked while travelling + pair guard", migrated: false },
  { file: "src/sim/agents/socialContext.ts", action: "pair guard", migrated: false },
  { file: "src/sim/agents/relationshipMemory.ts", action: "pair guard", migrated: false },
  { file: "src/sim/agents/bodyCampLogistics.ts", action: "adapter", migrated: false },
  { file: "src/sim/agents/bandEvents.ts", action: "adapter", migrated: false },
  { file: "src/sim/agents/bandHistory.ts", action: "adapter", migrated: false },
  { file: "src/sim/runner/simRunner.ts", action: "adapter", migrated: false },
];

const CANONICAL = [
  "isBandTerminal",
  "isLivingBand",
  "isProvisionalSuccessor",
  "hasCurrentFissionAttempt",
  "isEstablishedBand",
  "isFissionEligibleParent",
  "isProvisionalGroupInTransit",
  "shareCurrentFissionLineage",
  "preserveTerminalBandSnapshots",
];

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

const migrated = new Set(MATRIX_MODULES.filter((m) => m.migrated).map((m) => m.file));

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
      if (migrated.has(rel)) {
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
    if (entry.migrated && !importsBoundary) {
      violations.push({ kind: "migrated_module_does_not_import_the_boundary", file: rel, action: entry.action });
    } else if (!entry.migrated) {
      pending.push({ file: rel, action: entry.action, importsBoundary });
    }
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

const out = {
  generatedAt: new Date().toISOString(),
  checkpoint: "ROADMAP ITEM 4 §4 — band lifecycle boundary",
  boundary: BOUNDARY,
  boundaryExports,
  canonicalPredicates: CANONICAL,
  whatThisDoesNotForbid:
    "Keyed lookups (world.bands[id]) and physical-group readers that enumerate every living band. Both are legitimate: a provisional successor holds real bodies and must appear in presence, depletion, consumption, health and demography. Excluding it from those would recreate the ghost bodies CORRECTION-34 removed.",
  enforcedModules: MATRIX_MODULES.filter((m) => m.migrated),
  pendingModules: pending,
  privateDuplicateSpellings: privateDuplicates,
  inlineTerminalitySitesOutsideBoundary,
  violations,
  summary: {
    filesScanned: files.length,
    enforced: MATRIX_MODULES.filter((m) => m.migrated).length,
    pending: pending.length,
    violations: violations.length,
    privateDuplicates: privateDuplicates.length,
    inlineTerminalitySitesOutsideBoundary,
    verdict: violations.length === 0 ? "PASS" : "FAIL",
  },
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify(out.summary, null, 2));
if (violations.length > 0) {
  console.log("\nVIOLATIONS:");
  for (const v of violations) console.log(`  ${v.kind}  ${v.file}${v.line ? `:${v.line}` : ""}${v.name ? ` (${v.name})` : ""}`);
}
console.log(`\npending migration (${pending.length}, honestly not started — not a violation):`);
for (const p of pending) console.log(`  ${p.file}  [${p.action}]`);
console.log(`\nwritten: ${OUT}`);
if (violations.length > 0) process.exitCode = 1;
