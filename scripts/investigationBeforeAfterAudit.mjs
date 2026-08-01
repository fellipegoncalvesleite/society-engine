// CORRECTION-26 §15 — the before/after causal proof.
//
// THE SAME SCRIPT RUNS ON BOTH TREES. It reads only fields that exist at
// f94755047b2ea2a47b9453f3917e8eaf67816ca3 as well as at the corrected tree:
//   world.decisions                 (the selecting decision)
//   band.knowledge.observedTiles    (target-area terrain knowledge)
//   band.resourceKnowledgeState     (target-area resource belief)
// plus, where it exists, `band.pendingInvestigation` / `band.recentInvestigationOutcomes`,
// which is how the AFTER arm can point at an execution identity and the BEFORE arm cannot.
//
// THE MEASUREMENT SEAM. The production audit-only `decisionObserver`
// (`tick/advance.ts:213-215`) fires between `applyBandDecision` and the write-back, giving
// the EXACT pre-decision band and the EXACT post-decision band with nothing else in the
// window. It exists unchanged at f947550, so both arms measure the identical seam.
//
// An earlier version of this probe compared band state across a whole
// `advanceWorldByDays(world, 1)` step and reported 41/234 target-area changes on the
// corrected tree. That window also contains a day of daily actions, so ordinary subsistence
// trips and returning expeditions were being attributed to the decision. The number was the
// instrument's, not the simulation's. It is recorded here rather than quietly dropped.
//
// For every `resource_scout` / `logistical_probe` decision, the band's knowledge of the
// TARGET AREA (target tile + its 1-ring) is snapshotted on both sides of the applier. A
// change there, with no execution identity, is the defect: distant knowledge for free.
//
// The scout/probe frequency is NOT used as evidence either way. What is compared is, per
// selected investigation, whether target-area knowledge moved at selection.
//
// Usage:
//   node scripts/investigationBeforeAfterAudit.mjs --label before --out <path>

import { dirname } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "vite";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1] : fallback;
};

const LABEL = arg("label", "after");
const YEARS = Number(arg("years", "12"));
const TOTAL_DAYS = YEARS * 360;
const SEEDS = arg("seeds", "s1,s2").split(",").filter(Boolean);
const SEED_PREFIX = arg("seed-prefix", "c26:beforeafter");
const OUT = arg("out", `docs/evidence/resource-investigation-physical-26/behavioral-comparison-${LABEL}.json`);
const SCENARIO_NAMES = arg("scenarios", "map1,map2").split(",");

const ALL_SCENARIOS = [
  { name: "map1", map: "map1" },
  { name: "map2", map: "map2" },
];
const SCENARIOS = ALL_SCENARIOS.filter((scenario) => SCENARIO_NAMES.includes(scenario.name));

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c26-beforeafter-${process.pid}`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");

  /** Target-area knowledge: the target tile and its 1-ring, as the band holds it. */
  const targetAreaSnapshot = (world, band, targetTileId) => {
    const tile = world.tiles[targetTileId];
    const ids = [targetTileId, ...(tile?.neighbors ?? [])];
    const terrain = {};
    for (const id of ids) {
      const record = band.knowledge.observedTiles[id];
      terrain[id] = record === undefined
        ? null
        : {
            confidence: record.confidence ?? 0,
            visits: record.visits ?? 0,
            richness: record.observedRichness ?? 0,
            water: record.observedWaterAccess ?? 0,
          };
    }
    const memories = {};
    for (const memory of band.resourceKnowledgeState?.patchMemories ?? []) {
      if (!ids.includes(memory.approximateTile)) continue;
      memories[`${memory.approximateTile}|${memory.resourceClassId}`] = {
        presence: memory.confidence?.presenceConfidence ?? 0,
        access: memory.confidence?.accessConfidence ?? 0,
        yield: memory.confidence?.yieldConfidence ?? 0,
      };
    }
    return { ids, terrain, memories };
  };

  /**
   * DIRECTIONAL comparison. "Free distant knowledge" means knowledge GAINED without a
   * physical journey, so a gain is a tile becoming known or any tracked confidence rising.
   * A LOSS (the band forgetting a tile in the target's ring, e.g. through the bounded
   * known-tile cap) is the opposite of the defect and is counted separately rather than
   * being folded into a symmetric "changed" number.
   */
  const compareTargetArea = (before, after) => {
    let gained = 0;
    let lost = 0;
    const detail = [];

    for (const id of before.ids) {
      const a = before.terrain[id];
      const b = after.terrain[id];
      if (a === null && b !== null) { gained += 1; detail.push(`${id}:became-known`); continue; }
      if (a !== null && b === null) { lost += 1; detail.push(`${id}:forgotten`); continue; }
      if (a === null || b === null) continue;
      if (b.confidence > a.confidence || b.visits > a.visits || b.richness > a.richness || b.water > a.water) {
        gained += 1;
        detail.push(`${id}:terrain-up`);
      } else if (b.confidence < a.confidence || b.visits < a.visits) {
        lost += 1;
        detail.push(`${id}:terrain-down`);
      }
    }

    const keys = new Set([...Object.keys(before.memories), ...Object.keys(after.memories)]);
    for (const key of keys) {
      const a = before.memories[key];
      const b = after.memories[key];
      if (a === undefined && b !== undefined) { gained += 1; detail.push(`${key}:memory-formed`); continue; }
      if (a !== undefined && b === undefined) { lost += 1; detail.push(`${key}:memory-dropped`); continue; }
      if (a === undefined || b === undefined) continue;
      if (b.presence > a.presence || b.access > a.access || b.yield > a.yield) {
        gained += 1;
        detail.push(`${key}:memory-up`);
      } else if (b.presence < a.presence || b.access < a.access || b.yield < a.yield) {
        lost += 1;
        detail.push(`${key}:memory-down`);
      }
    }

    return { gained, lost, detail };
  };

  const runs = [];
  const totals = {
    selections: 0,
    targetAreaChangedAtSelection: 0,
    targetAreaKnowledgeGainedAtSelection: 0,
    targetAreaKnowledgeLostAtSelection: 0,
    selectionsWithExecutionIdentity: 0,
    executionsObserved: 0,
    namedNonExecutions: 0,
  };
  const samples = [];

  for (const scenario of SCENARIOS) {
    for (const seed of SEEDS) {
      let world = runner.initSimWorld({ kind: scenario.map }, `${SEED_PREFIX}:${seed}`);
      let selections = 0;
      let changedAtSelection = 0;
      let knowledgeGained = 0;
      let knowledgeLost = 0;
      let withIdentity = 0;
      let executions = 0;
      let namedNonExecutions = 0;
      const countedOutcomes = new Set();

      // Read-only, fires exactly between applyBandDecision and the write-back.
      const observer = ({ world: preWorld, band: bandBefore, updatedBand, decision }) => {
        const type = String(decision.action?.type ?? "");
        if (type !== "resource_scout" && type !== "logistical_probe") return;

        const targetTileId = decision.action?.targetTileId;
        if (targetTileId === undefined) return;

        selections += 1;
        const snapBefore = targetAreaSnapshot(preWorld, bandBefore, targetTileId);
        const snapAfter = targetAreaSnapshot(preWorld, updatedBand, targetTileId);
        const diff = compareTargetArea(snapBefore, snapAfter);
        const gained = diff.gained > 0;
        const lost = diff.lost > 0;

        if (gained) knowledgeGained += 1;
        if (lost) knowledgeLost += 1;
        if (gained || lost) changedAtSelection += 1;

        const hasIdentity = updatedBand.pendingInvestigation !== undefined &&
          String(updatedBand.pendingInvestigation.decisionId) === String(decision.id);
        if (hasIdentity) withIdentity += 1;

        if ((gained || lost) && samples.length < 24) {
          samples.push({
            label: LABEL,
            scenario: scenario.name,
            seed,
            decisionId: String(decision.id),
            actionType: type,
            targetTileId: String(targetTileId),
            knowledgeGained: diff.gained,
            knowledgeLost: diff.lost,
            detail: diff.detail,
            hasPendingIdentity: hasIdentity,
            bandPosition: String(bandBefore.position),
          });
        }
      };

      for (let day = 0; day < TOTAL_DAYS; day += 1) {
        world = advance.advanceWorldByDays(world, 1, observer);

        for (const band of Object.values(world.bands)) {
          for (const entry of band.recentInvestigationOutcomes ?? []) {
            const key = `${band.id}|${entry.decisionId}`;
            if (countedOutcomes.has(key)) continue;
            countedOutcomes.add(key);
            if (entry.executionId !== undefined) executions += 1;
            else namedNonExecutions += 1;
          }
        }
      }

      runs.push({
        label: LABEL,
        scenario: scenario.name,
        seed,
        years: YEARS,
        selections,
        targetAreaChangedAtSelection: changedAtSelection,
        targetAreaKnowledgeGainedAtSelection: knowledgeGained,
        targetAreaKnowledgeLostAtSelection: knowledgeLost,
        selectionsWithExecutionIdentity: withIdentity,
        executionsObserved: executions,
        namedNonExecutions,
      });

      totals.selections += selections;
      totals.targetAreaChangedAtSelection += changedAtSelection;
      totals.targetAreaKnowledgeGainedAtSelection += knowledgeGained;
      totals.targetAreaKnowledgeLostAtSelection += knowledgeLost;
      totals.selectionsWithExecutionIdentity += withIdentity;
      totals.executionsObserved += executions;
      totals.namedNonExecutions += namedNonExecutions;
    }
  }

  const document = {
    checkpoint: "CORRECTION-26",
    arm: LABEL,
    generatedFor: "before/after causal proof — does selection alone change target-area knowledge",
    years: YEARS,
    seedPrefix: SEED_PREFIX,
    seeds: SEEDS,
    scenarios: SCENARIOS.map((scenario) => scenario.name),
    totals,
    shareOfSelectionsThatGainedTargetAreaKnowledge:
      totals.selections === 0 ? null : totals.targetAreaKnowledgeGainedAtSelection / totals.selections,
    runs,
    samples,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ arm: LABEL, totals, gainShare: document.shareOfSelectionsThatGainedTargetAreaKnowledge }, null, 2));
} finally {
  await server.close();
}
