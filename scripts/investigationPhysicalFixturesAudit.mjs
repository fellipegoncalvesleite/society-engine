// CORRECTION-26 §14 — controlled fixtures P1–P12 for the physical investigation chain.
//
// Every fixture joins BY EXACT IDENTITY: `Decision.id` -> `PendingInvestigationRecord`
// -> `executionId` -> `InvestigationOutcomeRingEntry` -> the memory that changed. Nothing
// is matched by "the scout that happened to be near that tile".
//
// P1  successful resource_scout                     — real party, real route, real observation
// P2  successful logistical_probe                   — same, through the probe path
// P3  blocked / physically infeasible route         — named non-execution, no target truth read
// P4  insufficient labor                            — party never exceeds available workers
// P5  same-day boundary behaviour                   — <= 4 tiles one way executes
// P6  multi-day boundary behaviour                  — > 4 tiles one way is NOT compressed
// P7  selection-vs-execution latency                — the observation lands on a LATER day
// P8  cancellation after band movement              — deterministic, named
// P9  cancellation at band termination              — deterministic, named
// P10 no duplicate execution                        — one decision, at most one executionId
// P11 no false task-party record                    — a selection nobody executed makes none
// P12 zero information receipt / support            — no food, no cargo, no support
// P13 step-mode parity                              — daily/weekly/monthly/seasonal identical
//
// NO PRODUCTION INSTRUMENTATION. Fixtures are built by constructing production worlds and
// writing a pending record through the same production constructor the decision layer uses.
//
// Usage: node scripts/investigationPhysicalFixturesAudit.mjs

import { dirname } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "vite";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1] : fallback;
};

const OUT = arg("out", "docs/evidence/resource-investigation-physical-26/fixtures.json");
const SEED_PREFIX = arg("seed-prefix", "c26:fixtures");
const MAX_DAYS = Number(arg("max-days", String(40 * 360)));

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c26-fixtures-${process.pid}`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  logLevel: "error",
});

const checks = [];
const cases = {};
const push = (name, passed, detail) => {
  checks.push({ name, passed, ...(detail === undefined ? {} : { detail }) });
};

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const trips = await server.ssrLoadModule("/sim/agents/intraSeasonTrips.ts");
  const pendingModule = await server.ssrLoadModule("/sim/agents/pendingInvestigation.ts");
  const passability = await server.ssrLoadModule("/sim/world/passability.ts");

  const baseWorld = runner.initSimWorld({ kind: "map2" }, `${SEED_PREFIX}:s1`);
  const anyBandId = Object.keys(baseWorld.bands)[0];

  /** Deterministic BFS over passable land, so fixtures aim at ground that really connects. */
  const passableNeighboursAtDistance = (world, originId, wanted) => {
    const seen = new Set([originId]);
    let frontier = [originId];
    let distance = 0;

    while (frontier.length > 0 && distance < wanted) {
      const next = [];
      for (const tileId of frontier) {
        const tile = world.tiles[tileId];
        if (tile === undefined) continue;
        for (const neighborId of [...tile.neighbors].sort()) {
          if (seen.has(neighborId)) continue;
          const neighbor = world.tiles[neighborId];
          if (neighbor === undefined || !passability.isBandPassableDestination(neighbor)) continue;
          seen.add(neighborId);
          next.push(neighborId);
        }
      }
      frontier = next;
      distance += 1;
    }

    return frontier;
  };

  /** Write a pending record onto a band through the production constructor. */
  const withPending = (world, bandId, overrides) => {
    const band = world.bands[bandId];
    const record = pendingModule.makePendingInvestigationRecord({
      decisionId: overrides.decisionId ?? `decision:fixture:${bandId}:${overrides.targetTileId}`,
      bandId,
      actionType: overrides.actionType ?? "logistical_probe",
      originTileId: overrides.originTileId ?? band.position,
      targetTileId: overrides.targetTileId,
      ...(overrides.actionType === "resource_scout"
        ? {
            scoutKind: overrides.scoutKind ?? "plant_patch",
            targetResourceClass: overrides.targetResourceClass ?? "generic_plant_food",
          }
        : { probePurpose: overrides.probePurpose ?? "general_probe" }),
      selectedTick: world.time.tick,
      selectedDay: world.time.day ?? 0,
      selectedSeason: world.time.season,
      selectionEvidence: { candidateCount: 1, voiScore: 0.5, expectedInfoValue: 0.4, repeatPenalty: 0 },
    });

    return {
      ...world,
      bands: {
        ...world.bands,
        [bandId]: {
          ...band,
          ...(overrides.band ?? {}),
          pendingInvestigation: { ...record, ...(overrides.record ?? {}) },
        },
      },
    };
  };

  /**
   * Advance until the pending record on `bandId` resolves, returning the terminal entry
   * found by EXACT decisionId, plus the day it landed and the knowledge before/after.
   */
  const runToResolution = (world, bandId, decisionId, maxDays = 120) => {
    const knowledgeBefore = { ...world.bands[bandId].knowledge.observedTiles };
    const memoryBefore = (world.bands[bandId].resourceKnowledgeState?.patchMemories ?? []).map(
      (memory) => `${memory.approximateTile}|${memory.resourceClassId}|${memory.confidence?.presenceConfidence ?? 0}`,
    );

    for (let day = 1; day <= maxDays; day += 1) {
      world = advance.advanceWorldByDays(world, 1);
      const band = world.bands[bandId];
      if (band === undefined) break;
      const entry = (band.recentInvestigationOutcomes ?? []).find(
        (item) => String(item.decisionId) === String(decisionId),
      );

      if (entry !== undefined) {
        return {
          world,
          band,
          entry,
          resolvedOnDay: Number(world.time.day ?? day),
          daysElapsed: day,
          knowledgeBefore,
          memoryBefore,
        };
      }
    }

    return { world, band: world.bands[bandId], entry: undefined, daysElapsed: maxDays, knowledgeBefore, memoryBefore };
  };

  // ── P1 / P2 / P5 — a successful same-day scout and probe ────────────────────────────
  for (const [label, actionType] of [["P1", "resource_scout"], ["P2", "logistical_probe"]]) {
    const band = baseWorld.bands[anyBandId];
    const targets = passableNeighboursAtDistance(baseWorld, band.position, 3);
    const targetTileId = targets[0];
    const decisionId = `decision:fixture:${label}`;

    if (targetTileId === undefined) {
      push(`${label}_target_available`, false, "no passable target at distance 3");
      continue;
    }

    const world = withPending(baseWorld, anyBandId, { actionType, targetTileId, decisionId });
    const result = runToResolution(world, anyBandId, decisionId);
    const entry = result.entry;
    const newlyObserved = entry === undefined
      ? []
      : Object.keys(result.band.knowledge.observedTiles).filter((id) => result.knowledgeBefore[id] === undefined);

    cases[label] = {
      actionType,
      targetTileId: String(targetTileId),
      decisionId,
      outcome: entry?.outcome ?? null,
      executionId: entry?.executionId ?? null,
      activityOutcome: entry?.activityOutcome ?? null,
      partyWorkers: entry?.partyWorkers ?? null,
      routeDistanceTiles: entry?.routeDistanceTiles ?? null,
      observedTileCount: entry?.observedTileCount ?? null,
      daysFromSelectionToResolution: result.daysElapsed,
      targetObservedAfter: result.band.knowledge.observedTiles[targetTileId] !== undefined,
      newlyObservedTileCount: newlyObserved.length,
    };

    push(`${label}_executed_and_returned`, entry?.outcome === "executed_and_returned", entry?.outcome);
    push(`${label}_carries_exact_execution_id`, typeof entry?.executionId === "string" && entry.executionId.includes(decisionId));
    push(`${label}_party_has_workers`, (entry?.partyWorkers ?? 0) >= 1, entry?.partyWorkers);
    push(`${label}_walked_a_real_route`, (entry?.routeDistanceTiles ?? 0) >= 1, entry?.routeDistanceTiles);
    push(`${label}_observed_the_target`, result.band.knowledge.observedTiles[targetTileId] !== undefined);
    // P5 — a target inside the same-day budget executes rather than being refused.
    push(`P5_same_day_boundary_${actionType}`, entry?.outcome === "executed_and_returned");
  }

  // ── P7 — selection and execution are on DIFFERENT days ──────────────────────────────
  push(
    "P7_execution_is_later_than_selection",
    (cases.P1?.daysFromSelectionToResolution ?? 0) >= 1 && (cases.P2?.daysFromSelectionToResolution ?? 0) >= 1,
    { P1: cases.P1?.daysFromSelectionToResolution, P2: cases.P2?.daysFromSelectionToResolution },
  );

  // ── P6 — a target beyond the same-day budget is NOT compressed into a one-day record ─
  {
    const band = baseWorld.bands[anyBandId];
    const targets = passableNeighboursAtDistance(baseWorld, band.position, 7);
    const targetTileId = targets[0];
    const decisionId = "decision:fixture:P6";

    if (targetTileId === undefined) {
      push("P6_target_available", false, "no passable target at distance 7");
    } else {
      const world = withPending(baseWorld, anyBandId, { actionType: "resource_scout", targetTileId, decisionId });
      const result = runToResolution(world, anyBandId, decisionId);
      cases.P6 = {
        targetTileId: String(targetTileId),
        outcome: result.entry?.outcome ?? null,
        executionId: result.entry?.executionId ?? null,
        targetObservedAfter: result.band.knowledge.observedTiles[targetTileId] !== undefined,
        targetKnownBefore: result.knowledgeBefore[targetTileId] !== undefined,
      };
      push("P6_beyond_same_day_named_not_executed", result.entry?.outcome === "beyond_same_day_reach", result.entry?.outcome);
      push("P6_no_execution_id", result.entry?.executionId === undefined);
      push(
        "P6_target_not_observed_by_the_refusal",
        cases.P6.targetKnownBefore || !cases.P6.targetObservedAfter,
      );
    }
  }

  // ── P3 — a physically unreachable target gets a named non-execution ─────────────────
  {
    // An enclosed water tile has no passable approach: `resolveShoreApproachTile` returns
    // undefined, so the destination is honestly blocked.
    const band = baseWorld.bands[anyBandId];
    const unreachable = Object.values(baseWorld.tiles).find(
      (tile) =>
        !passability.isBandPassableDestination(tile) &&
        tile.neighbors.every((id) => {
          const neighbor = baseWorld.tiles[id];
          return neighbor === undefined || !passability.isBandPassableDestination(neighbor);
        }),
    );
    const decisionId = "decision:fixture:P3";

    if (unreachable === undefined) {
      push("P3_unreachable_target_available", false, "no fully enclosed impassable tile on map2");
    } else {
      const world = withPending(baseWorld, anyBandId, {
        actionType: "resource_scout",
        targetTileId: unreachable.id,
        decisionId,
      });
      const result = runToResolution(world, anyBandId, decisionId);
      cases.P3 = {
        targetTileId: String(unreachable.id),
        outcome: result.entry?.outcome ?? null,
        executionId: result.entry?.executionId ?? null,
        partyWorkers: result.entry?.partyWorkers ?? null,
        targetObservedAfter: result.band.knowledge.observedTiles[unreachable.id] !== undefined,
        targetKnownBefore: result.knowledgeBefore[unreachable.id] !== undefined,
      };
      push(
        "P3_named_non_execution",
        result.entry?.outcome === "destination_blocked" || result.entry?.outcome === "route_unavailable",
        result.entry?.outcome,
      );
      push("P3_no_workers_left_camp", (result.entry?.partyWorkers ?? 0) === 0, result.entry?.partyWorkers);
      push(
        "P3_no_target_truth_read",
        cases.P3.targetKnownBefore || !cases.P3.targetObservedAfter,
      );
    }
  }

  // ── P4 — insufficient labor: a band with no spare working adults sends nobody ───────
  {
    const band = baseWorld.bands[anyBandId];
    const targets = passableNeighboursAtDistance(baseWorld, band.position, 2);
    const targetTileId = targets[0];
    const decisionId = "decision:fixture:P4";
    const world = withPending(baseWorld, anyBandId, {
      actionType: "resource_scout",
      targetTileId,
      decisionId,
      band: {
        demography: { ...band.demography, workingAdults: 0 },
      },
    });
    const result = runToResolution(world, anyBandId, decisionId);
    cases.P4 = {
      workingAdults: 0,
      outcome: result.entry?.outcome ?? null,
      partyWorkers: result.entry?.partyWorkers ?? null,
      availableWorkers: result.entry?.availableWorkers ?? null,
      executionId: result.entry?.executionId ?? null,
    };
    push("P4_insufficient_labor_named", result.entry?.outcome === "insufficient_labor", result.entry?.outcome);
    push("P4_zero_workers_committed", (result.entry?.partyWorkers ?? 0) === 0);
    push("P4_no_execution_id", result.entry?.executionId === undefined);
  }

  // ── P8 — the band moved before departure: deterministic cancellation ────────────────
  {
    const band = baseWorld.bands[anyBandId];
    const targets = passableNeighboursAtDistance(baseWorld, band.position, 2);
    const decisionId = "decision:fixture:P8";
    // A record whose origin is somewhere the band is not standing cannot depart from here.
    const elsewhere = passableNeighboursAtDistance(baseWorld, band.position, 4)[0];
    const world = withPending(baseWorld, anyBandId, {
      actionType: "resource_scout",
      targetTileId: targets[0],
      decisionId,
      record: { originTileId: elsewhere },
    });
    const result = runToResolution(world, anyBandId, decisionId);
    cases.P8 = {
      recordOrigin: String(elsewhere),
      bandPosition: String(band.position),
      outcome: result.entry?.outcome ?? null,
      executionId: result.entry?.executionId ?? null,
    };
    push("P8_band_moved_cancellation", result.entry?.outcome === "band_moved_before_departure", result.entry?.outcome);
    push("P8_no_execution_id", result.entry?.executionId === undefined);
  }

  // ── P9 — expiry: a record that outlives its season resolves, it does not linger ─────
  {
    const band = baseWorld.bands[anyBandId];
    const targets = passableNeighboursAtDistance(baseWorld, band.position, 2);
    const decisionId = "decision:fixture:P9";
    const world = withPending(baseWorld, anyBandId, {
      actionType: "resource_scout",
      targetTileId: targets[0],
      decisionId,
      // Already past its expiry on the very next trip day.
      record: { expiresAfterDay: -1 },
    });
    const result = runToResolution(world, anyBandId, decisionId);
    cases.P9 = { outcome: result.entry?.outcome ?? null, executionId: result.entry?.executionId ?? null };
    push("P9_expiry_named", result.entry?.outcome === "expired_before_execution", result.entry?.outcome);
    push("P9_no_execution_id", result.entry?.executionId === undefined);
  }

  // ── P10 / P11 / P12 — measured over the natural run, by identity ────────────────────
  {
    let world = runner.initSimWorld({ kind: "map1" }, `${SEED_PREFIX}:natural`);
    const executionIds = new Set();
    const decisionExecutionCount = new Map();
    const partyIds = new Map();
    let duplicateExecutions = 0;
    let partiesWithoutExecution = 0;
    let informationReceipts = 0;
    let informationSupport = 0;
    const resolvedDecisions = new Set();
    const selectedDecisions = new Set();

    for (let day = 0; day < 6 * 360; day += 1) {
      world = advance.advanceWorldByDays(world, 1);

      for (const band of Object.values(world.bands)) {
        if (band.pendingInvestigation !== undefined) {
          selectedDecisions.add(String(band.pendingInvestigation.decisionId));
        }

        for (const entry of band.recentInvestigationOutcomes ?? []) {
          const key = String(entry.decisionId);
          if (resolvedDecisions.has(key)) continue;
          resolvedDecisions.add(key);

          if (entry.executionId !== undefined) {
            if (executionIds.has(String(entry.executionId))) duplicateExecutions += 1;
            executionIds.add(String(entry.executionId));
            decisionExecutionCount.set(key, (decisionExecutionCount.get(key) ?? 0) + 1);
          }
        }

        for (const party of band.campMovement?.temporaryTaskParties ?? []) {
          if (partyIds.has(party.id)) continue;
          partyIds.set(party.id, party);
          if (party.executionId === undefined) partiesWithoutExecution += 1;
        }

        for (const trip of band.recentIntraSeasonTrips ?? []) {
          if (String(trip.activityOutcome) !== "returned_with_information") continue;
          if (trip.resourceReturn?.consumedByEconomy === true) informationReceipts += 1;
          informationSupport += trip.physicalFoodHarvest?.usableSupport ?? 0;
        }
      }
    }

    cases.P10_P12 = {
      selectedDecisions: selectedDecisions.size,
      resolvedDecisions: resolvedDecisions.size,
      distinctExecutionIds: executionIds.size,
      maxExecutionsPerDecision: Math.max(0, ...decisionExecutionCount.values()),
      duplicateExecutions,
      taskPartyRecords: partyIds.size,
      partiesWithoutExecution,
      informationReceipts,
      informationSupport,
    };
    push("P10_no_duplicate_execution", duplicateExecutions === 0);
    push("P10_at_most_one_execution_per_decision", Math.max(0, ...decisionExecutionCount.values(), 0) <= 1);
    push("P11_no_task_party_without_execution", partiesWithoutExecution === 0);
    push("P11_task_parties_never_exceed_executions", partyIds.size <= executionIds.size, {
      parties: partyIds.size,
      executions: executionIds.size,
    });
    push("P12_no_information_receipt", informationReceipts === 0);
    push("P12_zero_information_support", informationSupport === 0);
  }

  // ── P13 — step-mode parity: the chain resolves identically at every step granularity ─
  {
    const projection = (world) =>
      Object.values(world.bands)
        .sort((left, right) => String(left.id).localeCompare(String(right.id)))
        .map((band) => ({
          id: String(band.id),
          pending: band.pendingInvestigation === undefined
            ? null
            : {
                decisionId: String(band.pendingInvestigation.decisionId),
                target: String(band.pendingInvestigation.targetTileId),
                status: band.pendingInvestigation.status,
              },
          outcomes: (band.recentInvestigationOutcomes ?? []).map((entry) =>
            `${entry.decisionId}|${entry.outcome}|${entry.executionId ?? "-"}|${entry.partyWorkers ?? "-"}|${entry.routeDistanceTiles ?? "-"}|${entry.observedTileCount ?? "-"}`,
          ),
          parties: (band.campMovement?.temporaryTaskParties ?? []).map((party) =>
            `${party.id}|${party.status}|${party.partyWorkers}|${party.routeDistanceTiles}`,
          ),
          // The FIRST version of this fixture compared only the three fields above and
          // passed while step-mode invariance was actually broken: the executor was
          // observing with `world.time`, which lags a whole season under seasonal stepping,
          // so observations were stamped day 180 instead of day 185. The observation
          // TIMESTAMPS are what carry that defect, so they are compared here too.
          knowledge: Object.entries(band.knowledge.observedTiles)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([id, record]) =>
              `${id}|${record.firstObservedAt?.day ?? "-"}|${record.lastObservedAt?.day ?? "-"}|${record.visits}|${record.confidence}`,
            ),
          observationHistory: band.knowledge.tileObservationHistory.map((entry) =>
            `${entry.tileId}|${entry.observedAt?.day ?? "-"}|${entry.observedAt?.dayOfSeason ?? "-"}`,
          ),
        }));

    const runStepped = (chunkDays) => {
      let world = runner.initSimWorld({ kind: "map2" }, `${SEED_PREFIX}:stepmode`);
      const totalDays = 3 * 360;
      for (let done = 0; done < totalDays; done += chunkDays) {
        world = advance.advanceWorldByDays(world, Math.min(chunkDays, totalDays - done));
      }
      return JSON.stringify(projection(world));
    };

    const daily = runStepped(1);
    const weekly = runStepped(7);
    const monthly = runStepped(30);
    const seasonal = runStepped(90);
    cases.P13 = {
      dailyLength: daily.length,
      identicalWeekly: daily === weekly,
      identicalMonthly: daily === monthly,
      identicalSeasonal: daily === seasonal,
    };
    push("P13_step_mode_parity_weekly", daily === weekly);
    push("P13_step_mode_parity_monthly", daily === monthly);
    push("P13_step_mode_parity_seasonal", daily === seasonal);
  }

  const passed = checks.filter((check) => check.passed).length;
  const document = {
    checkpoint: "CORRECTION-26",
    generatedFor: "resource investigation physical execution — controlled fixtures P1-P13",
    seedPrefix: SEED_PREFIX,
    summary: { total: checks.length, passed, failed: checks.length - passed },
    checks,
    cases,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ summary: document.summary, failures: checks.filter((c) => !c.passed) }, null, 2));
} finally {
  await server.close();
}
