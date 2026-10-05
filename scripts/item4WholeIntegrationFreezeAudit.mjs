// ROADMAP ITEM 4 — FINAL WHOLE-INTEGRATION FREEZE AUDIT.
// The behavioral core of the freeze: canonical physical successor lifecycle must be projected into
// bounded deep history without becoming a second lifecycle authority.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  loadSuccessorStabilizationModules,
  warmStabilizationWorld,
  makeCanonicalStabilizationDeparture,
  runRegisteredPositiveStabilization,
} from "./lib/successorStabilizationFixture.mjs";
import {
  makeGenuineUnresolvedFailedReturn,
  runRegisteredPostReturnContinuation,
} from "./lib/failedReturnContinuationFixture.mjs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const OUT = arg("out", "docs/evidence/item4-final-freeze/whole-integration.json");
const fixtures = [];
const record = (id, claim, passed, nonVacuous, detail) => fixtures.push({
  id,
  claim,
  verdict: nonVacuous === false ? "VACUOUS" : passed ? "PASS" : "FAIL",
  nonVacuous: nonVacuous !== false,
  detail,
});
const lifecycleEpisodes = (band) =>
  (band?.deepHistory?.episodes ?? []).filter((episode) => episode.type === "successor_separation_lifecycle");
const hasEvidence = (episode, kind, id) =>
  (episode?.evidence ?? []).some((ref) => ref.kind === kind && ref.ids.map(String).includes(String(id)));

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-i4-freeze-${process.pid}`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  logLevel: "error",
});

let output;
try {
  const modules = await loadSuccessorStabilizationModules(server);

  // F1 — positive stabilization must carry its entire provisional journey into its new deep history.
  const warmStabilization = warmStabilizationWorld(modules);
  const stabilizationDeparture = makeCanonicalStabilizationDeparture(modules, warmStabilization, {
    successorBandId: "band:item4-freeze-stabilized",
    lineageId: "LIN-ITEM4-FREEZE-STABILIZED",
  });
  const stabilized = runRegisteredPositiveStabilization(modules, stabilizationDeparture);
  const stabilizationRecord = stabilized.band.successorDepartureRecords?.at(-1);
  const stabilizationEpisodes = lifecycleEpisodes(stabilized.band);
  const stabilizationEpisode = stabilizationEpisodes[0];
  record(
    "F1_stabilized_successor_retains_physical_separation_history",
    "a real departure that later stabilizes produces exactly one completed deep-history lifecycle episode joined to the immutable departure and retained terminal lifecycle",
    stabilizationEpisodes.length === 1 &&
      stabilizationEpisode?.ongoing === false &&
      stabilizationEpisode?.detail?.terminalOutcomeStabilized === 1 &&
      hasEvidence(stabilizationEpisode, "successor_departure_event", stabilizationRecord?.id) &&
      hasEvidence(stabilizationEpisode, "successor_lifecycle_record", stabilized.band.provisionalSuccessor?.lineageId),
    stabilizationRecord !== undefined && stabilized.band.provisionalSuccessor?.phase === "stabilized",
    { departureRecordId: stabilizationRecord?.id, phase: stabilized.band.provisionalSuccessor?.phase, episodes: stabilizationEpisodes },
  );

  // F5 — the same projector must remain bounded even when the episode ring is saturated.
  const saturatedHistory = {
    ...stabilized.band.deepHistory,
    episodes: Array.from({ length: stabilized.band.deepHistory.caps.maxEpisodes }, (_, index) => ({
      id: `episode:${String(stabilized.band.id)}:band_collapsed_end:synthetic-${index}`,
      type: "band_collapsed_end",
      startYear: index,
      endYear: index,
      ongoing: false,
      severity: 1,
      summary: "synthetic cap-pressure control",
      detail: { populationAtEnd: index },
      evidence: [],
      recordKind: "recorded_event",
      confidence: 1,
      occurrenceCount: 1,
      lastUpdatedYear: index,
      provenance: "lived",
    })),
    payloadBytesEstimate: 0,
  };
  const saturatedProjected = modules.history.projectSuccessorSeparationLifecycleHistory(
    saturatedHistory,
    stabilizationRecord,
    stabilized.band,
    stabilized.world.time.year,
  );
  const retainedUnderPressure = lifecycleEpisodes({ deepHistory: saturatedProjected });
  record(
    "F5_retained_departure_projection_survives_episode_cap_pressure",
    "a saturated deep-history ring reserves a slot for the lifecycle projection of a still-retained physical departure while remaining within the existing deterministic episode and payload caps",
    retainedUnderPressure.length === 1 &&
      saturatedProjected.episodes.length <= saturatedProjected.caps.maxEpisodes &&
      saturatedProjected.caps.capsHeld === true,
    saturatedHistory.episodes.length === saturatedHistory.caps.maxEpisodes &&
      saturatedHistory.episodes.every((episode) => episode.type !== "successor_separation_lifecycle"),
    {
      beforeCount: saturatedHistory.episodes.length,
      afterCount: saturatedProjected.episodes.length,
      maxEpisodes: saturatedProjected.caps.maxEpisodes,
      payloadBytesEstimate: saturatedProjected.payloadBytesEstimate,
      capsHeld: saturatedProjected.caps.capsHeld,
      retainedLifecycleIds: retainedUnderPressure.map((episode) => episode.id),
    },
  );

  // F6 — a real departure observed before completion must remain ongoing; history may not invent an end.
  const inFlightWorld = stabilizationDeparture.departure.world;
  const inFlightParentId = String(stabilizationDeparture.parent.id);
  const inFlightSuccessorId = stabilizationDeparture.successorId;
  const inFlightSpringDay = (inFlightWorld.time.year + 1) * inFlightWorld.time.daysPerYear;
  const inFlightObserved = modules.history.applyBandDeepHistoryContext({
    ...inFlightWorld,
    time: modules.time.getWorldTimeForDay(inFlightSpringDay),
  });
  const inFlightEpisode = lifecycleEpisodes(inFlightObserved.bands[inFlightParentId]).find(
    (episode) => String(episode.relatedBandId) === String(inFlightSuccessorId),
  );
  record(
    "F6_in_flight_successor_history_stays_open_without_elapsed_time_inference",
    "a physically departed successor still in canonical travelling state is recorded as an ongoing lifecycle episode with no fabricated terminal year or terminal outcome",
    inFlightEpisode?.ongoing === true &&
      inFlightEpisode?.endYear === undefined &&
      inFlightEpisode?.detail?.terminalOutcomeStabilized === 0 &&
      inFlightEpisode?.detail?.terminalOutcomeEstablishedAfterFailedReturn === 0 &&
      inFlightEpisode?.detail?.terminalOutcomeReintegrated === 0 &&
      inFlightEpisode?.detail?.terminalOutcomeProvisionalExtinguished === 0 &&
      (inFlightEpisode?.evidence ?? []).some(
        (ref) => ref.kind === "successor_lifecycle_record" && ref.ids.includes("phase:travelling"),
      ),
    inFlightWorld.bands[inFlightSuccessorId].provisionalSuccessor?.phase === "travelling",
    {
      canonicalPhase: inFlightWorld.bands[inFlightSuccessorId].provisionalSuccessor?.phase,
      episode: inFlightEpisode,
    },
  );

  // F2 — the historically distinct failed-return establishment must not collapse into stabilization.
  const warmPostReturn = warmStabilizationWorld(modules);
  const unresolvedForEstablishment = makeGenuineUnresolvedFailedReturn(modules, warmPostReturn, {
    successorBandId: "band:item4-freeze-post-return",
    lineageId: "LIN-ITEM4-FREEZE-POST-RETURN",
  });
  const postReturn = runRegisteredPostReturnContinuation(modules, unresolvedForEstablishment);
  const postRecord = postReturn.band.successorDepartureRecords?.at(-1);
  const postEpisodes = lifecycleEpisodes(postReturn.band);
  const postEpisode = postEpisodes[0];
  record(
    "F2_post_return_establishment_preserves_distinct_terminal_outcome",
    "failed return followed by a fresh continuation and independent operation is retained as established_after_failed_return, never relabelled stabilized",
    postEpisodes.length === 1 &&
      postEpisode?.ongoing === false &&
      postEpisode?.detail?.terminalOutcomeEstablishedAfterFailedReturn === 1 &&
      postEpisode?.detail?.terminalOutcomeStabilized !== 1 &&
      hasEvidence(postEpisode, "successor_departure_event", postRecord?.id) &&
      hasEvidence(postEpisode, "successor_lifecycle_record", postReturn.band.provisionalSuccessor?.lineageId),
    postRecord !== undefined && postReturn.band.provisionalSuccessor?.phase === "established_after_failed_return",
    { departureRecordId: postRecord?.id, phase: postReturn.band.provisionalSuccessor?.phase, episodes: postEpisodes },
  );

  // F4 — physical extinction before establishment is a distinct terminal, not ordinary daughter success.
  const warmExtinction = warmStabilizationWorld(modules);
  const extinctionDeparture = makeCanonicalStabilizationDeparture(modules, warmExtinction, {
    successorBandId: "band:item4-freeze-extinguished",
    lineageId: "LIN-ITEM4-FREEZE-EXTINGUISHED",
  });
  const extinctionSuccessorId = extinctionDeparture.successorId;
  const extinctionParentId = String(extinctionDeparture.parent.id);
  const extinctionBase = extinctionDeparture.departure.world;
  const zeroWorld = {
    ...extinctionBase,
    bands: {
      ...extinctionBase.bands,
      [extinctionSuccessorId]: {
        ...extinctionBase.bands[extinctionSuccessorId],
        size: 0,
        demography: {
          ...extinctionBase.bands[extinctionSuccessorId].demography,
          population: 0, workingAdults: 0, dependents: 0, elders: 0,
        },
      },
    },
  };
  const extinctionDay = extinctionDeparture.departureDay + 1;
  const extinguished = modules.lifecycleResolver.resolveProvisionalLifecycles(zeroWorld, extinctionDay);
  const extinguishedBand = extinguished.world.bands[extinctionSuccessorId];
  const extinctionRecord = extinguished.world.bands[extinctionParentId].successorDepartureRecords?.find(
    (entry) => String(entry.successorBandId) === String(extinctionSuccessorId),
  );
  const extinctionSpringDay = (extinguished.world.time.year + 1) * extinguished.world.time.daysPerYear;
  const extinctionHistoryWorld = {
    ...extinguished.world,
    time: modules.time.getWorldTimeForDay(extinctionSpringDay),
  };
  const extinctionObserved = modules.history.applyBandDeepHistoryContext(extinctionHistoryWorld);
  const extinctionEpisodes = lifecycleEpisodes(extinctionObserved.bands[extinctionParentId]).filter(
    (episode) => String(episode.relatedBandId) === String(extinctionSuccessorId),
  );
  const extinctionEpisode = extinctionEpisodes[0];
  record(
    "F4_provisional_extinction_remains_a_distinct_terminal_history",
    "zero physical population resolves through the provisional lifecycle and deep history records provisional_extinguished without manufacturing a successful daughter branch",
    extinctionEpisodes.length === 1 &&
      extinctionEpisode?.ongoing === false &&
      extinctionEpisode?.detail?.terminalOutcomeProvisionalExtinguished === 1 &&
      hasEvidence(extinctionEpisode, "successor_departure_event", extinctionRecord?.id) &&
      hasEvidence(extinctionEpisode, "successor_lifecycle_record", extinguishedBand.provisionalSuccessor?.lineageId) &&
      !(extinctionObserved.bands[extinctionParentId].deepHistory?.episodes ?? []).some(
        (episode) => episode.type === "daughter_branch_formed" && String(episode.relatedBandId) === String(extinctionSuccessorId),
      ),
    extinctionRecord !== undefined && extinguishedBand.provisionalSuccessor?.phase === "provisional_extinguished" &&
      extinguished.resolutions.some((row) => row.reason === "zero_physical_population"),
    {
      departureRecordId: extinctionRecord?.id,
      terminalPhase: extinguishedBand.provisionalSuccessor?.phase,
      resolutions: extinguished.resolutions,
      episodes: extinctionEpisodes,
    },
  );

  // F3 — a genuine production return that physically rejoins must close on the PARENT's annual history.
  const warmReintegration = warmStabilizationWorld(modules);
  const unresolvedForReintegration = makeGenuineUnresolvedFailedReturn(modules, warmReintegration, {
    successorBandId: "band:item4-freeze-reintegrated",
    lineageId: "LIN-ITEM4-FREEZE-REINTEGRATED",
  });
  const preMerge = unresolvedForReintegration.world;
  const successorId = unresolvedForReintegration.successorId;
  const parentId = unresolvedForReintegration.parentId;
  const coLocated = {
    ...preMerge,
    bands: {
      ...preMerge.bands,
      [parentId]: { ...preMerge.bands[parentId], position: preMerge.bands[successorId].position },
    },
  };
  const reintegrationDay = unresolvedForReintegration.unresolvedDay + 1;
  const reintegrated = modules.reintegration.performAtomicReintegration({
    world: coLocated,
    successorId,
    today: reintegrationDay,
  });
  if (reintegrated.ok !== true) throw new Error(`freeze reintegration fixture refused: ${reintegrated.refusal}`);
  const terminalSuccessor = reintegrated.world.bands[successorId];
  const parentRecord = reintegrated.world.bands[parentId].successorDepartureRecords?.find(
    (entry) => String(entry.successorBandId) === String(successorId),
  );
  const nextSpringDay = (reintegrated.world.time.year + 1) * reintegrated.world.time.daysPerYear;
  const historyWorld = {
    ...reintegrated.world,
    time: modules.time.getWorldTimeForDay(nextSpringDay),
  };
  const observed = modules.history.applyBandDeepHistoryContext(historyWorld);
  const parentAfterHistory = observed.bands[parentId];
  const reintegrationEpisodes = lifecycleEpisodes(parentAfterHistory).filter(
    (episode) => String(episode.relatedBandId) === String(successorId),
  );
  const reintegrationEpisode = reintegrationEpisodes[0];
  record(
    "F3_parent_history_closes_real_reintegration_without_fabricating_daughter_success",
    "after a real departure/travel/return/reintegration path, the next legitimate annual history observation closes one lifecycle episode as reintegrated and does not manufacture daughter_branch_formed success",
    reintegrationEpisodes.length === 1 &&
      reintegrationEpisode?.ongoing === false &&
      reintegrationEpisode?.detail?.terminalOutcomeReintegrated === 1 &&
      hasEvidence(reintegrationEpisode, "successor_departure_event", parentRecord?.id) &&
      hasEvidence(reintegrationEpisode, "successor_lifecycle_record", terminalSuccessor.provisionalSuccessor?.lineageId) &&
      !(parentAfterHistory.deepHistory?.episodes ?? []).some(
        (episode) => episode.type === "daughter_branch_formed" && String(episode.relatedBandId) === String(successorId),
      ),
    parentRecord !== undefined && terminalSuccessor.provisionalSuccessor?.phase === "reintegrated" && unresolvedForReintegration.returnMoves.length > 0,
    {
      departureRecordId: parentRecord?.id,
      terminalPhase: terminalSuccessor.provisionalSuccessor?.phase,
      productionTrace: unresolvedForReintegration.trace,
      returnMoves: unresolvedForReintegration.returnMoves.length,
      episodes: reintegrationEpisodes,
    },
  );

  const failures = fixtures.filter((row) => row.verdict !== "PASS");
  output = {
    checkpoint: "ROADMAP ITEM 4 — FINAL WHOLE-INTEGRATION FREEZE",
    generatedAt: new Date().toISOString(),
    fixtures,
    summary: { total: fixtures.length, passed: fixtures.length - failures.length, failed: failures.length, verdict: failures.length === 0 ? "PASS" : "FAIL" },
  };
} catch (error) {
  output = {
    checkpoint: "ROADMAP ITEM 4 — FINAL WHOLE-INTEGRATION FREEZE",
    generatedAt: new Date().toISOString(),
    fixtures,
    summary: { total: fixtures.length, passed: fixtures.filter((row) => row.verdict === "PASS").length, failed: fixtures.filter((row) => row.verdict !== "PASS").length + 1, verdict: "FAIL" },
    harnessError: error instanceof Error ? error.stack ?? error.message : String(error),
  };
} finally {
  await server.close();
}
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output.summary, null, 2));
if (output.harnessError) console.error(output.harnessError);
for (const row of output.fixtures ?? []) if (row.verdict !== "PASS") console.error(`${row.verdict}: ${row.id}`);
if (output.summary.verdict !== "PASS") process.exitCode = 1;
