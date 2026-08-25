// SCALE-1 Task 7 — repository-wide secondary scale closure.
// Static hard failures are deliberately narrow. Broad scale-looking matches are printed for
// human classification rather than treated as defects solely because they contain "tile".
import { readFileSync, readdirSync, statSync } from "node:fs";
import { relative } from "node:path";

const ROOT = process.cwd();
const productionRoots = ["src/sim", "src/ui", "src/render"];
const files = productionRoots.flatMap((root) => recursiveFiles(`${ROOT}/${root}`));
const sources = new Map(files.map((path) => [path, readFileSync(path, "utf8")]));
const production = [...sources.entries()].map(([path, source]) => `// ${relative(ROOT, path)}\n${source}`).join("\n");

const retiredSymbols = [
  "tilesPerTravelDay",
  "daysPerTile",
  "MIGRATION_WALK_MAX_STEPS",
  "VISIBILITY_RADIUS_TILES",
  "MIN_VISIBILITY_DISTANCE_TILES",
  "SMOKE_MAX_VISIBLE_TILES",
  "SCOUT_MAX_DISTANCE",
  "KNOWN_OPPORTUNITY_DISTANCE_KM",
  "KNOWN_OPPORTUNITY_PREFILTER_RADIUS_KM",
  "getBandRiverCrossingCapability",
];

const retiredSurvivors = retiredSymbols.filter((symbol) => production.includes(symbol));
const architectResidues = [
  "MAX_TRIP_DISTANCE_TILES",
  "STARTING_LOCAL_RECON_MAX_DISTANCE_TILES",
  "INFERRED_FRONTIER_PROBE_RADIUS",
].filter((symbol) => production.includes(symbol));

const fixedScaleViolations = collectMatches([
  { label: "fixed KM_PER_TILE=1.5", regex: /\bKM_PER_TILE\s*=\s*1\.5\b/g },
  { label: "fixed KM_PER_CELL=1.5", regex: /\bKM_PER_CELL\s*=\s*1\.5\b/g },
  { label: "distanceTiles*1.5", regex: /\bdistanceTiles\s*\*\s*1\.5\b/g },
  { label: "1.5*distanceTiles", regex: /\b1\.5\s*\*\s*distanceTiles\b/g },
]);

const broadPatterns = [
  ["distanceTiles", /\bdistanceTiles\b/g],
  ["roundTripTiles", /\broundTripTiles\b/g],
  ["radiusTiles/rangeTiles", /\b(?:radiusTiles|rangeTiles)\b/g],
  ["_TILES", /\b[A-Z][A-Z0-9_]*_TILES(?:_[A-Z0-9_]+)?\b/g],
  ["_STEPS", /\b[A-Z][A-Z0-9_]*_STEPS\b/g],
  ["_RADIUS", /\b[A-Z][A-Z0-9_]*_RADIUS\b/g],
  ["gridDistance", /\b(?:getGridDistance|gridDistance)\b/g],
  ["literal 1.5", /(?<![0-9])1\.5(?![0-9])/g],
];
const census = Object.fromEntries(broadPatterns.map(([label, regex]) => [label, collectSourceMatches(regex)]));

const checks = {
  retiredSymbolsAbsent: retiredSurvivors.length === 0,
  architectFoundFixedCellAuthoritiesAbsent: architectResidues.length === 0,
  noFixedOnePointFivePhysicalConversion: fixedScaleViolations.length === 0,
};

const out = {
  check: "SCALE1-STATIC-CLOSURE",
  verdict: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
  checks,
  failures: { retiredSurvivors, architectResidues, fixedScaleViolations },
  census,
};

console.log(JSON.stringify(out, null, 2));
if (out.verdict !== "PASS") process.exitCode = 1;

function recursiveFiles(root) {
  const result = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = `${root}/${entry.name}`;
    if (entry.isDirectory()) result.push(...recursiveFiles(path));
    else if (entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name) && statSync(path).isFile()) result.push(path);
  }
  return result.sort();
}

function collectMatches(patterns) {
  return patterns.flatMap(({ label, regex }) => collectSourceMatches(regex).map((match) => ({ label, ...match })));
}

function collectSourceMatches(regex) {
  const rows = [];
  for (const [path, source] of sources) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(source)) !== null) {
      const prefix = source.slice(0, match.index);
      const line = prefix.split("\n").length;
      rows.push({ file: relative(ROOT, path), line, match: match[0] });
      if (match[0].length === 0) regex.lastIndex += 1;
    }
  }
  return rows;
}
