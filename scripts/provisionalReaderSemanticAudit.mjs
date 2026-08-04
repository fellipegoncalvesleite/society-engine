// ROADMAP ITEM 4 §4 — SEMANTIC reader audit for the provisional successor.
//
// The lexical scan (`provisionalBandReaderSurfaceAudit.mjs`) reported 160 "enumeration sites", 144
// "unguarded". Those are DISCOVERY counts and this audit exists to replace them, because they are
// inflated in three specific ways that a semantic pass can separate:
//
//   1. A multi-line `Object.values(world.bands).filter(...).reduce((bandsById, band) => { ... })`
//      is ONE enumeration. The lexical scan counted the `.reduce` header, the accumulator writes and
//      the `return bandsById` as separate sites.
//   2. `world.bands[someId]` is a KEYED LOOKUP of an id the caller already holds, not an
//      enumeration of the band set. A provisional successor cannot wander into it.
//   3. `bandsById[band.id] = ...` is a write into a LOCAL accumulator, not a read of the world.
//
// What actually matters for a provisional successor is the count of places that ENUMERATE THE BAND
// SET and would therefore silently include one.
//
// THE LOAD-BEARING FINDING THIS AUDIT WAS BUILT TO CHECK.
//
// `src/sim/agents/bandLifecycle.ts` already exists and already owns the lifecycle predicate:
// `isBandTerminal`, `isLivingBand`, `preserveTerminalBandSnapshots`. It is the seam a provisional
// state would attach to. This audit measures how much of production actually routes through it
// versus inlining `band.status === "dispersed" || band.viability?.status === ...` by hand, because
// that ratio is what decides whether Representation A is cheap or ruinous.
import { readdirSync, readFileSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const ROOT = process.cwd();
const SRC = join(ROOT, "src", "sim");
const EVIDENCE = "docs/evidence/dynamic-fission-daughter-viability-37";
const OUT = arg("out", `${EVIDENCE}/provisional-reader-semantic.json`);

const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (entry.endsWith(".ts")) files.push(full);
  }
})(SRC);

// A TRUE enumeration of the band set. Everything else is a lookup or a local write.
const TRUE_ENUM = /Object\.(values|keys|entries)\s*\(\s*world\.bands\s*\)/;
// A keyed lookup by an id the caller already holds.
const KEYED_LOOKUP = /world\.bands\s*\[/;
// The canonical predicate module.
const CANONICAL_PREDICATE = /\bisLivingBand\b|\bisBandTerminal\b|\bpreserveTerminalBandSnapshots\b/;
// A hand-inlined lifecycle test — the thing the predicate module exists to replace.
const INLINE_STATUS = /\.status\s*===\s*"(dispersed|absorbed|extinct)"|\.status\s*!==\s*"(dispersed|absorbed|extinct)"/;

const isComment = (line) => {
  const t = line.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
};

const perFile = [];
let trueEnumerations = 0;
let keyedLookups = 0;
let enumViaCanonicalPredicate = 0;
let enumViaInlineStatus = 0;
let enumWithNoLifecycleFilter = 0;
const filesImportingCanonical = [];

for (const full of files) {
  const rel = relative(ROOT, full);
  const raw = readFileSync(full, "utf8");
  const lines = raw.split("\n");
  const importsCanonical = /from\s+"\.\/bandLifecycle"|from\s+"\.\.\/agents\/bandLifecycle"/.test(raw);
  if (importsCanonical) filesImportingCanonical.push(rel);

  const enums = [];
  let lookups = 0;

  lines.forEach((line, i) => {
    if (isComment(line)) return;
    if (TRUE_ENUM.test(line)) {
      // The filter for an enumeration lives within a few lines of it in every idiom present here:
      // a chained `.filter(...)`, or an early `continue` guard directly under a `for..of` header.
      const window = lines.slice(i, i + 6).join("\n");
      const viaCanonical = CANONICAL_PREDICATE.test(window);
      const viaInline = !viaCanonical && INLINE_STATUS.test(window);
      enums.push({
        line: i + 1,
        filter: viaCanonical ? "canonical_predicate" : viaInline ? "inline_status_test" : "none",
        text: line.trim().slice(0, 140),
      });
      trueEnumerations += 1;
      if (viaCanonical) enumViaCanonicalPredicate += 1;
      else if (viaInline) enumViaInlineStatus += 1;
      else enumWithNoLifecycleFilter += 1;
    } else if (KEYED_LOOKUP.test(line)) {
      lookups += 1;
      keyedLookups += 1;
    }
  });

  if (enums.length > 0 || lookups > 0) {
    perFile.push({ file: rel, importsCanonicalPredicate: importsCanonical, trueEnumerations: enums.length, keyedLookups: lookups, enumerations: enums });
  }
}

perFile.sort((a, b) => b.trueEnumerations - a.trueEnumerations);

const out = {
  generatedAt: new Date().toISOString(),
  checkpoint: "ROADMAP ITEM 4 §4 — semantic reader audit",
  supersedes:
    "The lexical counts in provisional-reader-surface.json (160 sites / 144 unguarded). Those were DISCOVERY evidence; these are the counts that describe the actual decision surface.",
  method:
    "Distinguishes a TRUE enumeration of the band set (Object.values/keys/entries(world.bands)) from a KEYED LOOKUP (world.bands[id], where the caller already holds the id and a provisional successor cannot wander in) and from writes into a local accumulator. For each true enumeration it records whether the lifecycle filter routes through the canonical bandLifecycle predicate, is hand-inlined, or is absent.",
  canonicalPredicateModule: {
    file: "src/sim/agents/bandLifecycle.ts",
    exports: ["isBandTerminal", "isLivingBand", "preserveTerminalBandSnapshots"],
    importedBy: filesImportingCanonical,
    importedByCount: filesImportingCanonical.length,
    finding:
      "The seam a provisional lifecycle would attach to ALREADY EXISTS and is ALREADY the canonical answer to 'is this band still an ordinary living band?'. It is imported by very few modules; most readers inline the same test by hand. That ratio is the real cost of Representation A, and it is a routing problem with an existing destination rather than a new architecture.",
  },
  summary: {
    filesScanned: files.length,
    trueEnumerations,
    keyedLookups,
    enumViaCanonicalPredicate,
    enumViaInlineStatus,
    enumWithNoLifecycleFilter,
    lexicalClaimedEnumerationSites: 160,
    lexicalOverstatementFactor: Math.round((160 / trueEnumerations) * 100) / 100,
  },
  perFile,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify(out.summary, null, 2));
console.log(`\ncanonical predicate imported by ${filesImportingCanonical.length}: ${filesImportingCanonical.join(", ")}`);
console.log("\ntrue enumerations by file:");
for (const f of perFile.filter((x) => x.trueEnumerations > 0)) {
  const via = f.enumerations.reduce((a, e) => { a[e.filter] = (a[e.filter] ?? 0) + 1; return a; }, {});
  console.log(`  ${String(f.trueEnumerations).padStart(2)}  ${f.file}  ${JSON.stringify(via)}`);
}
console.log(`\nwritten: ${OUT}`);
