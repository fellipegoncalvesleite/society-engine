import assert from "node:assert/strict";
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1] : fallback;
};

const DAYS = Number(arg("days", "46800")); // 130 years
const STEP_DAYS = Number(arg("step-days", "90"));
const OUT = arg("out", "docs/evidence/item4-natural-physical-cutover/long-natural-runs.json");

const CASES = [
  { kind: "map1", seed: "item4-cutover:map1" },
  { kind: "map2", seed: "audit27:natural:s1" },
];

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-i4-cutover-long-${process.pid}`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  logLevel: "error",
});

const phaseSetFor = (entry) => new Set([...(entry?.history ?? []), ...(entry?.phase ? [entry.phase] : [])]);

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const lifecycle = await server.ssrLoadModule("/sim/agents/bandLifecycle.ts");

  const results = [];

  for (const run of CASES) {
    let world = runner.initSimWorld({ kind: run.kind }, run.seed);
    const attempts = new Map();
    const departures = new Map();
    const stabilizations = new Map();
    const postReturnEstablishments = new Map();
    const lifecyclePhases = new Map();
    let maxLiveBandCount = Object.values(world.bands).filter(lifecycle.isLivingBand).length;
    let maxBandObjectCount = Object.keys(world.bands).length;
    let legacyFissionEventCount = 0;
    const boundedness = {
      successorDepartureRecords: 0,
      fissionAttemptHistory: 0,
      provisionalHistory: 0,
      stabilizationEvents: 0,
      postReturnEstablishmentEvents: 0,
      postReturnCommitmentHistory: 0,
      postReturnFailedTargetTileIds: 0,
      daughterBandIds: 0,
    };

    const observe = () => {
      maxLiveBandCount = Math.max(maxLiveBandCount, Object.values(world.bands).filter(lifecycle.isLivingBand).length);
      maxBandObjectCount = Math.max(maxBandObjectCount, Object.keys(world.bands).length);
      legacyFissionEventCount = Math.max(
        legacyFissionEventCount,
        Object.values(world.bands).reduce((sum, band) => sum + (band.fissionEvents?.length ?? 0), 0),
      );

      for (const band of Object.values(world.bands)) {
        boundedness.successorDepartureRecords = Math.max(boundedness.successorDepartureRecords, band.successorDepartureRecords?.length ?? 0);
        boundedness.fissionAttemptHistory = Math.max(boundedness.fissionAttemptHistory, band.fissionAttempt?.history?.length ?? 0);
        boundedness.provisionalHistory = Math.max(boundedness.provisionalHistory, band.provisionalSuccessor?.history?.length ?? 0);
        boundedness.stabilizationEvents = Math.max(boundedness.stabilizationEvents, band.successorStabilizationEvents?.length ?? 0);
        boundedness.postReturnEstablishmentEvents = Math.max(boundedness.postReturnEstablishmentEvents, band.successorPostReturnEstablishmentEvents?.length ?? 0);
        boundedness.postReturnCommitmentHistory = Math.max(boundedness.postReturnCommitmentHistory, band.provisionalSuccessor?.postReturnCommitmentHistory?.length ?? 0);
        boundedness.postReturnFailedTargetTileIds = Math.max(boundedness.postReturnFailedTargetTileIds, band.provisionalSuccessor?.postReturnFailedTargetTileIds?.length ?? 0);
        boundedness.daughterBandIds = Math.max(boundedness.daughterBandIds, band.daughterBandIds?.length ?? 0);

        const attempt = band.fissionAttempt;
        if (attempt?.naturalProposal !== undefined) {
          const existing = attempts.get(attempt.lineageId) ?? {
            lineageId: attempt.lineageId,
            parentId: String(band.id),
            proposedOnDay: attempt.naturalProposal.proposedOnDay,
            phases: new Set(),
            prepared: false,
            authorizationStatuses: new Set(),
          };
          for (const phase of phaseSetFor(attempt)) existing.phases.add(phase);
          existing.prepared ||= attempt.preparedDeparture !== undefined;
          if (attempt.preparedDeparture?.authorization.status) {
            existing.authorizationStatuses.add(attempt.preparedDeparture.authorization.status);
          }
          attempts.set(attempt.lineageId, existing);
        }

        const provisional = band.provisionalSuccessor;
        if (provisional !== undefined) {
          const phases = lifecyclePhases.get(provisional.lineageId) ?? new Set();
          for (const phase of phaseSetFor(provisional)) phases.add(phase);
          lifecyclePhases.set(provisional.lineageId, phases);
        }

        for (const record of band.successorDepartureRecords ?? []) departures.set(String(record.id), record);
        for (const event of band.successorStabilizationEvents ?? []) stabilizations.set(String(event.id), event);
        for (const event of band.successorPostReturnEstablishmentEvents ?? []) postReturnEstablishments.set(String(event.id), event);
      }
    };

    observe();
    for (let elapsed = 0; elapsed < DAYS; elapsed += STEP_DAYS) {
      world = advance.advanceWorldByDays(world, Math.min(STEP_DAYS, DAYS - elapsed));
      observe();
    }

    const attemptRows = [...attempts.values()].map((entry) => ({
      ...entry,
      phases: [...entry.phases],
      authorizationStatuses: [...entry.authorizationStatuses],
    }));
    const phaseHas = (lineageId, phase) => lifecyclePhases.get(lineageId)?.has(phase) === true;
    const departureRows = [...departures.values()].sort((a, b) => Number(a.departedOnDay) - Number(b.departedOnDay));
    const conservationFailures = departureRows.filter((record) => {
      const founders = Number(record.founders.workingAdults) + Number(record.founders.dependents) + Number(record.founders.elders);
      return Number(record.parentPopulationBefore) !== Number(record.parentPopulationAfter) + Number(record.successorPopulationAtDeparture)
        || founders !== Number(record.successorPopulationAtDeparture);
    }).map((record) => String(record.id));

    const byParent = new Map();
    for (const record of departureRows) {
      const rows = byParent.get(String(record.parentBandId)) ?? [];
      rows.push(record);
      byParent.set(String(record.parentBandId), rows);
    }
    let minPhysicalSeparationIntervalTicks;
    for (const rows of byParent.values()) {
      rows.sort((a, b) => Number(a.tick) - Number(b.tick));
      for (let i = 1; i < rows.length; i += 1) {
        const interval = Number(rows[i].tick) - Number(rows[i - 1].tick);
        minPhysicalSeparationIntervalTicks = minPhysicalSeparationIntervalTicks === undefined
          ? interval
          : Math.min(minPhysicalSeparationIntervalTicks, interval);
      }
    }

    const successorsByLineage = new Map();
    for (const record of departureRows) {
      const ids = successorsByLineage.get(record.lineageId) ?? new Set();
      ids.add(String(record.successorBandId));
      successorsByLineage.set(record.lineageId, ids);
    }
    const duplicateLineages = [...successorsByLineage.entries()]
      .filter(([, ids]) => ids.size > 1)
      .map(([lineageId, ids]) => ({ lineageId, successorBandIds: [...ids] }));
    const successorIds = departureRows.map((record) => String(record.successorBandId));
    const duplicateSuccessorIds = [...new Set(successorIds.filter((id, index) => successorIds.indexOf(id) !== index))];

    const currentUnresolved = Object.values(world.bands).filter((band) => {
      const phase = band.provisionalSuccessor?.phase;
      return phase !== undefined && !["reintegrated", "stabilized", "established_after_failed_return", "provisional_extinguished"].includes(phase);
    });

    const summary = {
      kind: run.kind,
      seed: run.seed,
      days: DAYS,
      years: DAYS / 360,
      finalDay: Number(world.time.day ?? 0),
      proposals: attemptRows.length,
      plans: attemptRows.filter((row) => row.phases.includes("departure_planned")).length,
      preparations: attemptRows.filter((row) => row.prepared).length,
      physicalDepartures: departureRows.length,
      abandonedAttempts: attemptRows.filter((row) => row.phases.includes("abandoned")).length,
      supersededPreparedAttempts: attemptRows.filter((row) => row.authorizationStatuses.includes("superseded_by_revised_terms")).length,
      stabilizations: stabilizations.size,
      returns: departureRows.filter((record) => phaseHas(record.lineageId, "returning")).length,
      reintegrations: departureRows.filter((record) => phaseHas(record.lineageId, "reintegrated")).length,
      provisionalExtinctions: departureRows.filter((record) => phaseHas(record.lineageId, "provisional_extinguished")).length,
      failedReturns: departureRows.filter((record) => phaseHas(record.lineageId, "unresolved_after_failed_return")).length,
      postReturnEstablishments: postReturnEstablishments.size,
      liveUnresolvedProvisionalSuccessors: currentUnresolved.length,
      repeatedSplitParents: [...byParent.entries()].filter(([, rows]) => rows.length > 1).map(([parentId, rows]) => ({ parentId, departures: rows.length })),
      minPhysicalSeparationIntervalTicks: minPhysicalSeparationIntervalTicks ?? null,
      maxLiveBandCount,
      maxBandObjectCount,
      populationConservationFailures: conservationFailures,
      duplicateSuccessorIds,
      duplicateLineages,
      legacyFissionEventCount,
      boundedness,
      firstPhysicalDeparture: departureRows[0] ? {
        id: String(departureRows[0].id),
        parentBandId: String(departureRows[0].parentBandId),
        successorBandId: String(departureRows[0].successorBandId),
        lineageId: departureRows[0].lineageId,
        departedOnDay: departureRows[0].departedOnDay,
        tick: Number(departureRows[0].tick),
        originTileId: String(departureRows[0].originTileId),
        targetTileId: String(departureRows[0].targetTileId),
        attemptPhasesObserved: attemptRows.find((row) => row.lineageId === departureRows[0].lineageId)?.phases ?? [],
        downstreamPhasesObserved: [...(lifecyclePhases.get(departureRows[0].lineageId) ?? [])],
      } : null,
    };
    results.push(summary);
    console.log(JSON.stringify(summary, null, 2));
  }

  const map2 = results.find((result) => result.kind === "map2");
  assert.ok(map2, "map2 long run must be present");
  assert.ok(map2.physicalDepartures > 0, "untouched map2 production must naturally reach physical departure within the audited horizon");
  for (const result of results) {
    assert.deepEqual(result.populationConservationFailures, [], `${result.kind}: every durable physical departure record must conserve people exactly`);
    assert.deepEqual(result.duplicateSuccessorIds, [], `${result.kind}: successor IDs must be unique`);
    assert.deepEqual(result.duplicateLineages, [], `${result.kind}: one lineage must not map to multiple successors`);
    assert.equal(result.legacyFissionEventCount, 0, `${result.kind}: Direction-D must not fabricate legacy BandFissionEvent records`);
    assert.ok(result.maxLiveBandCount <= 36, `${result.kind}: live band count must respect the causal execution cap`);
  }

  const output = {
    audit: "ROADMAP ITEM 4 — untouched natural physical cutover long runs",
    generatedAt: new Date().toISOString(),
    daysPerRun: DAYS,
    stepDays: STEP_DAYS,
    results,
    verdict: "PASS",
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`written: ${OUT}`);
} finally {
  await server.close();
}
