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

const forbiddenRoundTripBehaviorPatterns = [
  ["src/sim/agents/acuteRisk.ts", /\blongTrip\.roundTripTiles\b/],
  ["src/sim/agents/intraSeasonTrips.ts", /\brecord\.roundTripTiles\s*\*/],
  ["src/sim/agents/intraSeasonTrips.ts", /\bSHADOW_TRAVEL_RATE_PER_TILE\b/],
];

const forbiddenResidualCellBehaviorPatterns = [
  ["src/sim/agents/intraSeasonTrips.ts", /candidate\.distanceTiles\s*>=\s*8/],
  ["src/sim/agents/bandEvents.ts", /entry\.distanceTiles\s*>=\s*3/],
  ["src/sim/rules/bandDecision.ts", /getGridDistance\(adaptiveOriginTile, observationTile\)/],
  ["src/sim/agents/practicalFragments.ts", /residentialMoveDistance\s*>=\s*3/],
  ["src/sim/agents/adaptiveEfficacy.ts", /context\.moveDistance\s*===\s*1/],
  ["src/sim/agents/campMovement.ts", /tileDistanceByCoord\(from, to\)\s*<=\s*1/],
  ["src/sim/agents/campMovement.ts", /tileDistanceByCoord\(currentTile, tile\)\s*<=\s*2/],
  ["src/sim/agents/campMovement.ts", /tileDistanceByCoord\(current, tile\)\s*<=\s*2/],
  ["src/sim/agents/campMovement.ts", /shift\.distance\s*<=\s*1/],
  ["src/sim/agents/campMovement.ts", /moveDistance\s*<=\s*2/],
  ["src/sim/agents/campMovement.ts", /moveDistance\s*>\s*2/],
  ["src/sim/agents/campMovement.ts", /moveDistance\s*\*\s*0\.08/],
  ["src/sim/agents/campMovement.ts", /moveDistance\s*\*\s*0\.12/],
  ["src/sim/agents/campMovement.ts", /distance\s*\*\s*0\.04/],
  ["src/sim/agents/spawn.ts", /tileDistance\(candidate\.tile, selected\.tile\)\s*>=\s*9/],
];

const requiredPhysicalTripSemantics = [
  ["src/sim/agents/acuteRisk.ts", /ACUTE_RISK_ROUTE_LOAD_FULL_SCALE_KM\s*=\s*18\b/],
  ["src/sim/agents/intraSeasonTrips.ts", /TRANSPORT_LOSS_RATE_PER_ROUND_TRIP_KM\s*=\s*0\.008\b/],
  ["src/sim/agents/intraSeasonTrips.ts", /SHADOW_TRAVEL_RATE_PER_ROUND_TRIP_KM\s*=\s*1\s*\/\s*150\b/],
  ["src/sim/agents/intraSeasonTrips.ts", /UNCERTAIN_LONG_ROUTE_DISTANCE_KM\s*=\s*12\b/],
  ["src/sim/agents/bandEvents.ts", /ROUTE_TALK_DISTANCE_KM\s*=\s*4\.5\b/],
  ["src/sim/agents/practicalFragments.ts", /STAGED_LOAD_MOVE_DISTANCE_KM\s*=\s*4\.5\b/],
  ["src/sim/agents/campMovement.ts", /LOCAL_SHIFT_MAX_DISTANCE_KM\s*=\s*3\b/],
  ["src/sim/agents/campMovement.ts", /MICRO_SHIFT_MAX_DISTANCE_KM\s*=\s*1\.5\b/],
  ["src/sim/agents/spawn.ts", /INITIAL_SPAWN_SEPARATION_KM\s*=\s*13\.5\b/],
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
for (const [file, regex] of forbiddenRoundTripBehaviorPatterns) {
  const source = readFileSync(file, "utf8");
  if (regex.test(source)) failures.push({ file, kind: "round_trip_tile_behavior", match: regex.source });
}
for (const [file, regex] of forbiddenResidualCellBehaviorPatterns) {
  const source = readFileSync(file, "utf8");
  if (regex.test(source)) failures.push({ file, kind: "residual_cell_behavior", match: regex.source });
}
for (const [file, regex] of requiredPhysicalTripSemantics) {
  const source = readFileSync(file, "utf8");
  if (!regex.test(source)) failures.push({ file, kind: "physical_trip_semantics_missing", match: regex.source });
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
