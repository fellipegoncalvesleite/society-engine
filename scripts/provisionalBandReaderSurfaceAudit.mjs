// ROADMAP ITEM 4 §8 — the provisional-successor reader surface, MEASURED.
//
// `ARCHITECTURE_DECISION.md` names this as the large cost of Direction D: "a provisional band is, to
// every other system, an ordinary band ... Making it provisional means auditing every reader, which
// is a large surface." Before any provisional state can be introduced, that surface has to be known
// rather than guessed, because a provisional band that every reader treats as ordinary is exactly the
// decorative state CLAUDE.md §18 forbids.
//
// WHAT THIS MEASURES.
//
// Every site in `src/sim` that ENUMERATES bands (`world.bands`) or BRANCHES ON a band's lifecycle
// status, with the filter it currently applies. The classification of each subsystem into
// allowed-unchanged / allowed-with-provisional-interpretation / blocked / deferred / not-applicable
// is a JUDGEMENT and is stored in this file's own table, next to the measurement that supports it —
// so a reader can check the judgement against the code rather than trusting it.
//
// WHAT THIS IS NOT, AND THE LIMITATION IS STATED RATHER THAN DISCOVERED LATER.
//
// This is a LEXICAL scan, not a type-aware one. It finds textual band enumeration and textual status
// branching. It cannot see a reader that receives an already-filtered band array from a caller, and
// it cannot prove that a site with no status filter is therefore wrong. Its output is a SURFACE — the
// set of places that must each be decided — and not a defect list. Every count below should be read
// as "sites requiring a decision", never as "sites that are broken".
import { readdirSync, readFileSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const ROOT = process.cwd();
const SRC = join(ROOT, "src", "sim");
const EVIDENCE = "docs/evidence/dynamic-fission-daughter-viability-37";
const OUT = arg("out", `${EVIDENCE}/provisional-reader-surface.json`);

const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
    } else if (entry.endsWith(".ts")) {
      files.push(full);
    }
  }
})(SRC);

// Enumeration of the band set: the thing a provisional band would silently join.
const ENUMERATION = /\bworld\.bands\b|\bbandsById\b|\ballBands\b/;
// The two independent lifecycle channels a reader can branch on today.
const STATUS_BRANCH = /\bband\.status\b|\bviability\?\.status\b|\bviability\.status\b|\bcandidate\.status\b|\bcurrentBand\.status\b|\bother\.status\b/;
// The terminal values production already excludes. A site that names one of these is ALREADY
// lifecycle-aware and is the cheapest place to teach about a provisional state; a site that
// enumerates and names none is where a provisional band would be treated as ordinary by default.
const TERMINAL_VALUE = /"dispersed"|"absorbed"|"extinct"/;

const isComment = (line) => {
  const t = line.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
};

const perFile = [];
let totalEnumerationSites = 0;
let totalStatusBranchSites = 0;
let totalEnumerationSitesWithoutNearbyTerminalFilter = 0;

for (const full of files) {
  const rel = relative(ROOT, full);
  const lines = readFileSync(full, "utf8").split("\n");
  const enumerationSites = [];
  const statusBranchSites = [];

  lines.forEach((line, i) => {
    if (isComment(line)) return;
    if (ENUMERATION.test(line)) {
      // A terminal filter within a small window counts as "this site already knows about lifecycle".
      // The window is stated rather than tuned: production's own filters sit within a few lines of the
      // enumeration in every idiom present in this repository (`.filter(b => b.status !== ...)`, or an
      // early `continue` guard directly beneath the loop header).
      const window = lines.slice(Math.max(0, i - 2), i + 8).join("\n");
      const guarded = TERMINAL_VALUE.test(window);
      enumerationSites.push({ line: i + 1, guarded, text: line.trim().slice(0, 160) });
      totalEnumerationSites += 1;
      if (!guarded) totalEnumerationSitesWithoutNearbyTerminalFilter += 1;
    }
    if (STATUS_BRANCH.test(line)) {
      statusBranchSites.push({ line: i + 1, text: line.trim().slice(0, 160) });
      totalStatusBranchSites += 1;
    }
  });

  if (enumerationSites.length > 0 || statusBranchSites.length > 0) {
    perFile.push({
      file: rel,
      enumerationSites: enumerationSites.length,
      enumerationSitesWithoutNearbyTerminalFilter: enumerationSites.filter((s) => !s.guarded).length,
      statusBranchSites: statusBranchSites.length,
      sites: { enumeration: enumerationSites, statusBranch: statusBranchSites },
    });
  }
}

perFile.sort((a, b) => b.enumerationSites + b.statusBranchSites - (a.enumerationSites + a.statusBranchSites));

// ── the §8 classification ────────────────────────────────────────────────────────────────────────
//
// One row per subsystem the brief names. `decision` is the judgement; `because` states the physical
// reason; `measuredIn` points at the files whose measured sites support it. Nothing here is applied
// to production by this audit — it is the specification the departure seam must satisfy.
const CLASSIFICATION = [
  {
    subsystem: "presence",
    files: ["src/sim/agents/crowding.ts"],
    decision: "allowed unchanged",
    because:
      "A provisional successor holds real bodies at a real tile. `getBandPhysicalPresence` must scatter them exactly as it does any band's — that is the whole point of Direction D over Direction A. Excluding them would recreate the CORRECTION-34 ghost-body defect the presence authority exists to prevent.",
  },
  {
    subsystem: "crowding",
    files: ["src/sim/agents/crowding.ts", "src/sim/agents/contextCache.ts"],
    decision: "allowed with provisional interpretation",
    because:
      "Bodies crowd. But at departure the successor is CO-RESIDENT with its parent by construction, and counting a group that has just walked out of the camp as a crowding neighbour of the camp it left would manufacture pressure from the split itself. The co-residence window needs an explicit rule; the general case is unchanged.",
  },
  {
    subsystem: "encounters and friction",
    files: ["src/sim/agents/socialContext.ts", "src/sim/agents/rangeFriction.ts", "src/sim/agents/accessNorms.ts"],
    decision: "blocked (parent/successor pair only)",
    because:
      "CORRECTION-29 gated encounters on proximity, and at departure the pair is at distance 0. Without a lineage exclusion the split would immediately generate stranger friction between a band and the group that just left it, and CORRECTION-30's access expectation would then carry that fiction forward. The pair must be excluded; every other pairing is unchanged.",
  },
  {
    subsystem: "access memory",
    files: ["src/sim/agents/accessNorms.ts"],
    decision: "allowed unchanged",
    because: "It reads the observer's own held records. With the encounter pairing blocked above, no record is created to read.",
  },
  {
    subsystem: "catchment",
    files: ["src/sim/agents/sharedCatchment.ts", "src/sim/agents/carryingCapacity.ts"],
    decision: "deferred",
    because:
      "The footprint is residence-anchored — the largest of Item 3's six carried-forward seams, frozen and explicitly not closed by Item 4. A travelling provisional successor competes for nothing under the current model, and fixing that is the shared-use substrate's job, not this checkpoint's.",
  },
  {
    subsystem: "food demand and receipts",
    files: ["src/sim/agents/humanFoodSupport.ts", "src/sim/agents/seasonalFoodReceipts.ts"],
    decision: "allowed unchanged",
    because:
      "A provisional successor eats and must earn its own receipts from zero — L4 requires that lived evidence, and the accumulator already resets for a new band. Exempting it from consumption would be the unearned support L3 forbids.",
  },
  {
    subsystem: "trips and expeditions",
    files: ["src/sim/agents/intraSeasonTrips.ts", "src/sim/agents/expedition.ts"],
    decision: "blocked while travelling",
    because:
      "A group physically walking to a destination cannot simultaneously run residential day-trips from a camp it does not have. Launching an expedition from a provisional successor in transit would put the same bodies in two places, which is the conservation defect Item 4 exists to close.",
  },
  {
    subsystem: "movement",
    files: ["src/sim/agents/bandMobility.ts", "src/sim/agents/migrationWalk.ts", "src/sim/agents/residentialMoveEvent.ts"],
    decision: "allowed with provisional interpretation",
    because:
      "Travel must reuse the canonical route and pace primitives — that is how defect 2 is closed. But a provisional successor is on a journey to a named target, not making seasonal residential decisions, so the ordinary decision-driven mover must not also move it.",
  },
  {
    subsystem: "demography",
    files: ["src/sim/agents/demography.ts", "src/sim/agents/demographicRenewal.ts"],
    decision: "allowed unchanged",
    because:
      "Births and deaths continue for a group that exists. Reintegration must then use CURRENT cohorts rather than the departure snapshot, which is a requirement on the resolver rather than on demography.",
  },
  {
    subsystem: "health and mortality",
    files: ["src/sim/agents/acuteRisk.ts", "src/sim/agents/bodyCampLogistics.ts", "src/sim/agents/viability.ts"],
    decision: "allowed unchanged",
    because: "L5 — injury, sickness and fatigue are carried, not reset. A travelling group is exposed like any other.",
  },
  {
    subsystem: "fission",
    files: ["src/sim/agents/demography.ts"],
    decision: "blocked",
    because:
      "A provisional successor cannot itself propose a split. It has not demonstrated it can function, so a split of a split would be a claim about a group whose own viability is the open question.",
  },
  {
    subsystem: "adaptation / ideas",
    files: ["src/sim/agents/adaptationBoundary.ts"],
    decision: "allowed unchanged",
    because: "Inheritance is already partial and degraded, and lived problems on a journey are real problems.",
  },
  {
    subsystem: "lineage / history",
    files: ["src/sim/agents/bandHistory.ts", "src/sim/agents/bandEvents.ts"],
    decision: "allowed with provisional interpretation",
    because:
      "The attempt, the departure and the resolution are all real events. But an ordinary daughter-success event must NOT be emitted at departure — L4. It belongs at stabilization, and a failed successor needs a terminal record rather than a silent disappearance.",
  },
  {
    subsystem: "UI / read models",
    files: ["src/sim/runner/simRunner.ts"],
    decision: "allowed with provisional interpretation",
    because: "Projection only. It must be able to say 'provisional' rather than showing an ordinary band, but it decides nothing.",
  },
  {
    subsystem: "Chronicle projection",
    files: ["src/sim/agents/bandChronicle.ts"],
    decision: "allowed with provisional interpretation",
    because:
      "§3.7 — a historical event must point at something that physically happened. A departure did; an establishment has not yet. The Chronicle may narrate the journey and must not narrate a founding until one occurs.",
  },
  {
    subsystem: "cleanup / extinction",
    files: ["src/sim/agents/viability.ts", "src/sim/agents/bandLifecycle.ts"],
    decision: "blocked",
    because:
      "A provisional successor must not disappear through general Item 6 cleanup. Its failure mode is RETURN AND REINTEGRATION, which is a different outcome from dissolution, and Item 6 owns dissolution.",
  },
  {
    subsystem: "serialization / performance",
    files: ["src/sim/runner/simRunner.ts"],
    decision: "allowed unchanged",
    because: "The new state must be bounded and must round-trip. No exemption is needed; a cap is.",
  },
];

const out = {
  generatedAt: new Date().toISOString(),
  checkpoint: "ROADMAP ITEM 4 §8 — provisional-successor reader surface",
  method:
    "LEXICAL scan of src/sim for band enumeration and lifecycle-status branching. It measures a SURFACE of sites requiring a decision, NOT a defect list. It cannot see a reader handed an already-filtered array, and a site with no status filter is not thereby wrong.",
  summary: {
    filesScanned: files.length,
    filesTouchingBandsOrStatus: perFile.length,
    totalEnumerationSites,
    totalEnumerationSitesWithoutNearbyTerminalFilter,
    totalStatusBranchSites,
    subsystemsClassified: CLASSIFICATION.length,
    decisions: CLASSIFICATION.reduce((acc, c) => {
      acc[c.decision] = (acc[c.decision] ?? 0) + 1;
      return acc;
    }, {}),
  },
  classification: CLASSIFICATION,
  perFile,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);

console.log(JSON.stringify(out.summary, null, 2));
console.log("\ntop files by reader surface:");
for (const f of perFile.slice(0, 14)) {
  console.log(
    `  ${String(f.enumerationSites).padStart(3)} enum (${String(f.enumerationSitesWithoutNearbyTerminalFilter).padStart(3)} unguarded)  ${String(f.statusBranchSites).padStart(3)} status  ${f.file}`,
  );
}
console.log(`\nwritten: ${OUT}`);
