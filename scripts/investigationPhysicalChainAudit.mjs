// CORRECTION-26 — natural-occurrence observation of the physical investigation chain.
//
// Steps production day by day and reads ONLY state production already persists:
//   world.decisions                          (the selecting Decision.id)
//   band.pendingInvestigation                (the bounded pending record)
//   band.recentInvestigationOutcomes         (the bounded terminal ring)
//   band.campMovement.temporaryTaskParties   (the truthful projection)
//   band.seasonalFoodReceipts                (the §11 accounting invariant)
//
// NO PRODUCTION INSTRUMENTATION. Pending records are captured per day while they are still
// pending, and joined afterwards to their terminal outcome BY `decisionId` — an exact
// identity join, never a nearest-target match.
//
// Usage:
//   node scripts/investigationPhysicalChainAudit.mjs --years 20 \
//     --scenarios map1,map2,ordinary --seeds s1

import { dirname } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "vite";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1] : fallback;
};

const YEARS = Number(arg("years", "20"));
const TOTAL_DAYS = YEARS * 360;
const SEEDS = arg("seeds", "s1").split(",").filter(Boolean);
const SEED_PREFIX = arg("seed-prefix", "c26:physical");
const OUT = arg("out", "docs/evidence/resource-investigation-physical-26/natural-occurrence.json");
const RAW_CAP = Number(arg("raw-cap", "40"));

const ALL_SCENARIOS = [
  { name: "map1", map: "map1", fixture: "default" },
  { name: "map2", map: "map2", fixture: "default" },
  { name: "ordinary", map: "map2", site: "tile:62:108" },
  { name: "site_A_coast", map: "map2", site: "tile:204:72" },
  { name: "site_B_dry_plains", map: "map2", site: "tile:10:34" },
  { name: "site_C_dry_plains", map: "map2", site: "tile:100:23" },
  { name: "site_D_aquatic", map: "map2", site: "tile:119:116" },
  { name: "site_E_hills", map: "map2", site: "tile:139:41" },
  { name: "site_F_hills", map: "map2", site: "tile:45:28" },
  { name: "isolated_marginal", map: "map2", site: "tile:16:34" },
  { name: "hostile", map: "map2", site: "tile:45:120" },
];

const requested = arg("scenarios", "map1,map2,ordinary").split(",");
const SCENARIOS = ALL_SCENARIOS.filter((scenario) => requested.includes(scenario.name));

const OUTCOMES = [
  "executed_and_returned",
  "route_unavailable",
  "arrival_failed",
  "beyond_same_day_reach",
  "insufficient_labor",
  "destination_blocked",
  "target_no_longer_valid",
  "band_moved_before_departure",
  "band_no_longer_active",
  "superseded",
  "expired_before_execution",
];

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c26-physical-${process.pid}`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const spawn = await server.ssrLoadModule("/sim/agents/spawn.ts");

  const buildWorld = (scenario, seed) => {
    let world = runner.initSimWorld({ kind: scenario.map }, `${SEED_PREFIX}:${seed}`);

    if (scenario.fixture !== "default") {
      world = spawn.removeInitialBands(world, Object.keys(world.bands));
      world = spawn.spawnCustomBands(
        world,
        [{ tileId: scenario.site, population: 34, name: scenario.name }],
        `${SEED_PREFIX}:${seed}`,
      );
    }

    return world;
  };

  const runs = [];
  const totals = {
    selectedInvestigations: 0,
    resolved: 0,
    stillPendingAtEnd: 0,
    byOutcome: Object.fromEntries(OUTCOMES.map((outcome) => [outcome, 0])),
    byAction: { resource_scout: 0, logistical_probe: 0 },
    // §15 — the defect's own signature. A target-area memory change with no execution.
    targetMemoryChangesWithoutExecution: 0,
    targetMemoryChangesAfterExecution: 0,
    // §11 accounting.
    investigationFoodReceipts: 0,
    investigationConsumedByEconomy: 0,
    // §12 truthfulness.
    taskPartyRecords: 0,
    taskPartyRecordsWithoutExecution: 0,
    // determinism / bounds.
    maxPendingPerBand: 0,
    maxOutcomeRingPerBand: 0,
    duplicateExecutionIds: 0,
  };
  const raw = [];

  for (const scenario of SCENARIOS) {
    for (const seed of SEEDS) {
      let world = buildWorld(scenario, seed);
      // decisionId -> the pending record as last seen while still pending
      const pendingSeen = new Map();
      // decisionId -> { targetTileId, presenceBefore } captured at selection
      const targetBeliefAtSelection = new Map();
      const resolvedByDecision = new Map();
      const executionIds = new Set();
      const partyIds = new Set();
      const outcomeCounts = Object.fromEntries(OUTCOMES.map((outcome) => [outcome, 0]));
      let selected = 0;
      let memoryChangeWithoutExecution = 0;
      let memoryChangeAfterExecution = 0;
      let partyRecords = 0;
      let partyRecordsWithoutExecution = 0;
      let maxPending = 0;
      let maxRing = 0;

      const presenceFor = (band, tileId) => {
        const memories = band.resourceKnowledgeState?.patchMemories ?? [];
        const match = memories.filter((memory) => memory.approximateTile === tileId);
        if (match.length === 0) {
          return undefined;
        }
        return match.reduce(
          (best, memory) => Math.max(best, memory.confidence?.presenceConfidence ?? 0),
          0,
        );
      };

      for (let day = 0; day < TOTAL_DAYS; day += 1) {
        world = advance.advanceWorldByDays(world, 1);

        for (const band of Object.values(world.bands)) {
          const pending = band.pendingInvestigation;

          if (pending !== undefined) {
            maxPending = Math.max(maxPending, 1);

            if (!pendingSeen.has(String(pending.decisionId))) {
              selected += 1;
              pendingSeen.set(String(pending.decisionId), {
                decisionId: String(pending.decisionId),
                bandId: String(pending.bandId),
                actionType: pending.actionType,
                originTileId: String(pending.originTileId),
                targetTileId: String(pending.targetTileId),
                selectedDay: Number(pending.selectedDay),
                selectedTick: Number(pending.selectedTick),
                expiresAfterDay: Number(pending.expiresAfterDay),
                scoutKind: pending.scoutKind ?? null,
                targetResourceClass: pending.targetResourceClass ?? null,
                probePurpose: pending.probePurpose ?? null,
              });
              targetBeliefAtSelection.set(String(pending.decisionId), {
                bandId: String(band.id),
                targetTileId: String(pending.targetTileId),
                presence: presenceFor(band, pending.targetTileId),
              });
            }
          }

          const ring = band.recentInvestigationOutcomes ?? [];
          maxRing = Math.max(maxRing, ring.length);

          for (const entry of ring) {
            const key = String(entry.decisionId);

            if (resolvedByDecision.has(key)) {
              continue;
            }

            resolvedByDecision.set(key, {
              decisionId: key,
              outcome: entry.outcome,
              actionType: entry.actionType,
              targetTileId: String(entry.targetTileId),
              resolvedDay: Number(entry.resolvedDay),
              executionId: entry.executionId ?? null,
              activityOutcome: entry.activityOutcome ?? null,
              partyWorkers: entry.partyWorkers ?? null,
              routeDistanceTiles: entry.routeDistanceTiles ?? null,
              observedTileCount: entry.observedTileCount ?? null,
            });
            outcomeCounts[entry.outcome] = (outcomeCounts[entry.outcome] ?? 0) + 1;

            if (entry.executionId !== undefined) {
              if (executionIds.has(String(entry.executionId))) {
                totals.duplicateExecutionIds += 1;
              }
              executionIds.add(String(entry.executionId));
            }

            // §15 — did target-area belief move, and was there an execution behind it?
            const atSelection = targetBeliefAtSelection.get(key);

            if (atSelection !== undefined) {
              const now = presenceFor(band, entry.targetTileId);
              const moved = atSelection.presence === undefined
                ? now !== undefined
                : now !== undefined && Math.abs(now - atSelection.presence) > 1e-9;

              if (moved) {
                if (entry.executionId === undefined) {
                  memoryChangeWithoutExecution += 1;
                } else {
                  memoryChangeAfterExecution += 1;
                }
              }
            }
          }

          for (const party of band.campMovement?.temporaryTaskParties ?? []) {
            // Distinct by id: the ring persists across days, so counting every sighting
            // would measure the ring's lifetime rather than the number of parties.
            if (partyIds.has(party.id)) {
              continue;
            }

            partyIds.add(party.id);
            partyRecords += 1;

            if (party.executionId === undefined) {
              partyRecordsWithoutExecution += 1;
            }
          }
        }
      }

      // §11 — an information investigation must never produce a food receipt.
      let receiptUnits = 0;
      for (const band of Object.values(world.bands)) {
        for (const trip of band.recentIntraSeasonTrips ?? []) {
          if (String(trip.activityOutcome) === "returned_with_information" &&
              (trip.resourceReturn?.consumedByEconomy === true ||
               (trip.resourceReturn?.estimatedReturnValue ?? 0) > 0)) {
            receiptUnits += 1;
          }
        }
      }

      let stillPending = 0;
      for (const band of Object.values(world.bands)) {
        if (band.pendingInvestigation !== undefined) {
          stillPending += 1;
        }
      }

      const run = {
        scenario: scenario.name,
        seed,
        years: YEARS,
        selected,
        resolved: resolvedByDecision.size,
        stillPendingAtEnd: stillPending,
        outcomeCounts,
        memoryChangeWithoutExecution,
        memoryChangeAfterExecution,
        taskPartyRecords: partyRecords,
        taskPartyRecordsWithoutExecution: partyRecordsWithoutExecution,
        investigationFoodReceipts: receiptUnits,
        maxPendingPerBand: maxPending,
        maxOutcomeRingPerBand: maxRing,
        unresolvedSelections: [...pendingSeen.keys()].filter((key) => !resolvedByDecision.has(key)).length,
      };
      runs.push(run);

      totals.selectedInvestigations += selected;
      totals.resolved += resolvedByDecision.size;
      totals.stillPendingAtEnd += stillPending;
      totals.targetMemoryChangesWithoutExecution += memoryChangeWithoutExecution;
      totals.targetMemoryChangesAfterExecution += memoryChangeAfterExecution;
      totals.taskPartyRecords += partyRecords;
      totals.taskPartyRecordsWithoutExecution += partyRecordsWithoutExecution;
      totals.investigationFoodReceipts += receiptUnits;
      totals.maxPendingPerBand = Math.max(totals.maxPendingPerBand, maxPending);
      totals.maxOutcomeRingPerBand = Math.max(totals.maxOutcomeRingPerBand, maxRing);

      for (const outcome of OUTCOMES) {
        totals.byOutcome[outcome] += outcomeCounts[outcome] ?? 0;
      }

      for (const entry of pendingSeen.values()) {
        totals.byAction[entry.actionType] = (totals.byAction[entry.actionType] ?? 0) + 1;
      }

      for (const entry of [...pendingSeen.values()].slice(0, RAW_CAP)) {
        const resolution = resolvedByDecision.get(entry.decisionId);
        raw.push({
          scenario: scenario.name,
          seed,
          selection: entry,
          resolution: resolution ?? null,
        });
      }
    }
  }

  const document = {
    checkpoint: "CORRECTION-26",
    generatedFor: "resource investigation physical execution — natural occurrence",
    years: YEARS,
    seedPrefix: SEED_PREFIX,
    seeds: SEEDS,
    scenarios: SCENARIOS.map((scenario) => scenario.name),
    totals,
    runs,
    rawSample: raw.slice(0, RAW_CAP * SCENARIOS.length),
    invariants: {
      everySelectionResolvedOrStillPending:
        totals.selectedInvestigations === totals.resolved + totals.stillPendingAtEnd,
      noTargetMemoryChangeWithoutExecution: totals.targetMemoryChangesWithoutExecution === 0,
      noTaskPartyRecordWithoutExecution: totals.taskPartyRecordsWithoutExecution === 0,
      noInvestigationFoodReceipt: totals.investigationFoodReceipts === 0,
      pendingCapHeld: totals.maxPendingPerBand <= 1,
      outcomeRingBounded: totals.maxOutcomeRingPerBand <= 6,
      noDuplicateExecution: totals.duplicateExecutionIds === 0,
    },
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ totals: document.totals, invariants: document.invariants }, null, 2));
} finally {
  await server.close();
}
