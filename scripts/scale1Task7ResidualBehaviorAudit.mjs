// SCALE-1 Task 7 — focused static regression for residual behavioral cell authority.
// This is intentionally file/symbol specific: topology telemetry and proven technical storage caps
// may keep tile counts, but behavioral fixed-cell reach/severity may not.
import { readFileSync } from "node:fs";

const forbiddenSymbolChecks = [
  ["src/sim/agents/frontierVerification.ts", "VERIFICATION_MAX_DISTANCE_TILES"],
  ["src/sim/agents/campMovement.ts", "RELIEF_SEARCH_RADIUS_TILES"],
  ["src/sim/agents/frontierResidence.ts", "ANCHOR_RADIUS"],
  ["src/sim/agents/frontierExploration.ts", "PARENT_CATCHMENT_RADIUS_TILES"],
  ["src/sim/agents/frontierExploration.ts", "MIN_ANCHOR_DISTANCE_TILES"],
  ["src/sim/agents/expedition.ts", "EXPEDITION_MAX_ROUTE_TILES"],
  ["src/sim/agents/expedition.ts", "FRONTIER_OUTBOUND_BUDGET_TILES"],
  ["src/sim/agents/bandHistory.ts", "RELOCATION_MIN_DISTANCE_TILES"],
];

const allowedClassifications = [
  {
    file: "src/sim/agents/residentialMoveEvent.ts",
    symbol: "RESIDENTIAL_MOVE_PATH_MAX_TILES",
    classification: "C",
    reason: "record-only persisted path/reconstruction cap applied after movement; never move reach, execution, duration, or hardship authority",
    required: [
      /const RESIDENTIAL_MOVE_PATH_MAX_TILES = 64;/,
      /path\.slice\(0, RESIDENTIAL_MOVE_PATH_MAX_TILES\)/,
      /reversed\.length < RESIDENTIAL_MOVE_PATH_MAX_TILES/,
      /pathTiles are record-only \(cosmetic,/,
    ],
  },
];

const behavioralDistanceFiles = [
  "src/sim/agents/acuteRisk.ts",
  "src/sim/agents/bodyCampLogistics.ts",
  "src/sim/agents/relationshipMemory.ts",
  "src/sim/agents/practicalFragments.ts",
  "src/sim/agents/practicalResponses.ts",
  "src/sim/agents/reportedKnowledge.ts",
  "src/sim/agents/bandEvents.ts",
  "src/sim/agents/bandChronicle.ts",
];

const directBehaviorPatterns = [
  ["src/sim/agents/foragingAdaptation.ts", /\bgetGridDistance\b/],
  ["src/sim/agents/dryMargin.ts", /\bgetGridDistance\b/],
];

const failures = [];
for (const [file, symbol] of forbiddenSymbolChecks) {
  const source = readFileSync(file, "utf8");
  const exactSymbol = new RegExp(`\\b${symbol}\\b`);
  if (exactSymbol.test(source)) failures.push({ file, kind: "fixed_cell_authority", match: symbol });
}
for (const allowed of allowedClassifications) {
  const source = readFileSync(allowed.file, "utf8");
  for (const required of allowed.required) {
    if (!required.test(source)) {
      failures.push({
        file: allowed.file,
        kind: "allowed_classification_proof_missing",
        match: allowed.symbol,
        classification: allowed.classification,
        required: required.source,
      });
    }
  }
}
for (const file of behavioralDistanceFiles) {
  const source = readFileSync(file, "utf8");
  for (const regex of [/\btrip\.distanceTiles\b/g, /\bmove\.distanceTiles\b/g, /\bevent\.distanceTiles\b/g]) {
    for (const match of source.matchAll(regex)) {
      failures.push({ file, kind: "raw_cell_physical_severity", match: match[0] });
    }
  }
}
for (const [file, regex] of directBehaviorPatterns) {
  const source = readFileSync(file, "utf8");
  if (regex.test(source)) failures.push({ file, kind: "raw_grid_distance_behavior", match: regex.source });
}

const out = {
  check: "SCALE1-TASK7-RESIDUAL-BEHAVIOR",
  verdict: failures.length === 0 ? "PASS" : "FAIL",
  failureCount: failures.length,
  allowedClassifications: allowedClassifications.map(({ file, symbol, classification, reason }) => ({
    file, symbol, classification, reason,
  })),
  failures,
};
console.log(JSON.stringify(out, null, 2));
if (out.verdict !== "PASS") process.exitCode = 1;
