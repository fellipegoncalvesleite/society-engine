import assert from "node:assert/strict";
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const SEED = "audit27:natural:s1";
const WARM_DAYS = 2100;

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-i4-cutover-${process.pid}`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const demography = await server.ssrLoadModule("/sim/agents/demography.ts");
  const lifecycle = await server.ssrLoadModule("/sim/agents/bandLifecycle.ts");
  const time = await server.ssrLoadModule("/sim/tick/time.ts");
  const seam = await server.ssrLoadModule("/sim/agents/fissionDepartureSeam.ts");
  const natural = await server.ssrLoadModule("/sim/agents/naturalFissionPreDeparture.ts");
  const naturalDeparture = await server.ssrLoadModule("/sim/agents/naturalFissionDeparture.ts");
  const separationHistory = await server.ssrLoadModule("/sim/agents/fissionSeparationHistory.ts");
  const diagnostics = await server.ssrLoadModule("/sim/diagnostics/fissionDiagnostics.ts");
  const social = await server.ssrLoadModule("/sim/agents/socialContext.ts");

  const base = advance.advanceWorldByDays(runner.initSimWorld({ kind: "map2" }, SEED), WARM_DAYS);
  const annualDay = Math.ceil((Number(base.time.day ?? 0) + 1) / 360) * 360;
  const annualTime = time.getWorldTimeForDay(annualDay);
  const candidates = Object.values(base.bands)
    .filter((band) =>
      lifecycle.isFissionEligibleParent(band) &&
      band.fissionAttempt === undefined &&
      band.fissionEvents.length === 0 &&
      Object.values(band.knowledge.observedTiles).some(
        (known) => String(known.tileId) !== String(band.position) && known.confidence >= 0.34,
      ),
    )
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));

  let controlled;
  for (const candidate of candidates) {
    const parent = base.bands[candidate.id];
    const inputWorld = {
      ...base,
      time: annualTime,
      bands: {
        ...base.bands,
        [candidate.id]: {
          ...parent,
          size: 60,
          demography: {
            ...parent.demography,
            population: 60,
            workingAdults: 30,
            dependents: 20,
            elders: 10,
            splitPressure: 0.95,
          },
        },
      },
    };
    const proposedWorld = demography.updateBandsDemographyAndFission(inputWorld);
    const proposed = proposedWorld.bands[candidate.id]?.fissionAttempt;
    if (proposed?.phase !== "proposed" || proposed.naturalProposal === undefined) continue;
    // Build the two pre-departure days through the production reducer directly, then mirror the
    // time update `advanceWorldByDays` performs after daily actions. This keeps the controlled ready
    // fixture available even when the separate ready-day barrier is mutation-tested: the fixture
    // itself must not disappear merely because physical execution is intentionally broken.
    const planDay = Number(proposed.phaseEnteredDay) + 1;
    const planned = natural.advanceNaturalFissionPreDeparture(proposedWorld, planDay);
    const plannedWorld = { ...planned.world, time: time.getWorldTimeForDay(planDay) };
    const readyDay = planDay + 1;
    const prepared = natural.advanceNaturalFissionPreDeparture(plannedWorld, readyDay);
    const readyWorld = { ...prepared.world, time: time.getWorldTimeForDay(readyDay) };
    const ready = readyWorld.bands[candidate.id]?.fissionAttempt;
    if (ready?.phase === "departure_ready" && ready.preparedDeparture?.authorization.status === "live") {
      controlled = { parentId: candidate.id, readyWorld };
      break;
    }
  }
  assert.ok(controlled, "fixture must reach departure_ready through production proposal/planning/preparation");

  const parentId = controlled.parentId;
  const readyParent = controlled.readyWorld.bands[parentId];
  const readyAttempt = readyParent.fissionAttempt;
  const readinessDay = Number(readyAttempt.phaseEnteredDay);
  const departureDay = readinessDay + 1;
  const successorBandId = naturalDeparture.makeNaturalSuccessorBandId(readyAttempt.lineageId);

  // Distinct invariant A: readiness written on D is not physical permission to depart on D.
  // Exercise the production departure reducer directly so a ready-day mutation is caught by the
  // causal assertion rather than by making this fixture vanish during setup.
  const sameDayBarrier = naturalDeparture.advanceNaturalFissionDepartures(controlled.readyWorld, readinessDay);
  assert.equal(sameDayBarrier.records.length, 0, "readiness created on D cannot be consumed on D");
  assert.equal(sameDayBarrier.world.bands[successorBandId], undefined, "ready-day barrier must move no bodies and create no successor");

  // Distinct invariant B: the production daily registry must connect a natural ready attempt to the
  // atomic seam only after every downstream provisional action for the legal departure day has run.
  assert.equal(controlled.readyWorld.bands[successorBandId], undefined, "readiness day must not create a successor");
  const productionDepartureWorld = advance.advanceWorldByDays(controlled.readyWorld, 1);
  const productionParent = productionDepartureWorld.bands[parentId];
  const productionSuccessor = productionDepartureWorld.bands[successorBandId];
  assert.ok(productionSuccessor, "next legal production day must create the natural successor");
  assert.equal(productionParent.fissionAttempt.phase, "departed", "production parent attempt must terminalize as departed");
  assert.equal(productionSuccessor.provisionalSuccessor?.phase, "travelling", "new successor must begin provisional travel state");
  assert.equal(productionSuccessor.provisionalSuccessor?.phaseEnteredDay, departureDay, "departure day must be the successor lifecycle day");
  assert.deepEqual(productionSuccessor.provisionalSuccessor?.trail ?? [], [], "new successor must not receive same-day travel");

  // A direct seam execution from the exact same ready state is the no-free-work oracle: if the daily
  // adapter is last, the newborn object must be byte-identical to what the seam itself creates.
  const directControl = seam.performAtomicDeparture({
    world: controlled.readyWorld,
    parentId,
    today: departureDay,
    successorBandId,
    lineageId: readyAttempt.lineageId,
  });
  assert.equal(directControl.ok, true, "direct control departure must succeed");
  assert.deepEqual(productionSuccessor, directControl.world.bands[successorBandId], "birth day must contain no post-departure successor work");

  // RED/guard: when ordinary context next runs, the parent and its still-provisional successor
  // are two physical groups but not strangers. Their shared current lineage must not manufacture an
  // encounter/contact-memory event merely because departure starts from the same tile.
  const contextAfterBirth = social.updateBandContextStates(productionDepartureWorld);
  assert.equal(contextAfterBirth.bands[parentId].contactMemories?.[successorBandId], undefined, "parent must not invent stranger contact with its in-flight successor");
  assert.equal(contextAfterBirth.bands[successorBandId].contactMemories?.[parentId], undefined, "successor must not invent stranger contact with its parent");

  // Exact transfer and one-use execution remain seam-owned under the natural caller.
  assert.equal(seam.isDepartureLedgerConserving(directControl.ledger), true, "natural execution must conserve population and all three cohorts");
  assert.equal(productionParent.fissionAttempt.preparedDeparture.authorization.status, "consumed_by_departure", "natural departure must consume the one-use permit");
  const repeatNatural = naturalDeparture.advanceNaturalFissionDepartures(productionDepartureWorld, departureDay + 1);
  assert.equal(repeatNatural.records.length, 0, "terminal departed attempt must not be offered to the seam again");
  assert.equal(Object.keys(repeatNatural.world.bands).length, Object.keys(productionDepartureWorld.bands).length, "repeated natural reducer must not create a duplicate successor");

  // Continue the actually created successor only through ordinary registered production actions.
  let downstreamWorld = productionDepartureWorld;
  const downstreamPhases = [productionSuccessor.provisionalSuccessor.phase];
  let previousPhase = downstreamPhases[0];
  for (let i = 0; i < 360; i += 1) {
    downstreamWorld = advance.advanceWorldByDays(downstreamWorld, 1);
    const successorNow = downstreamWorld.bands[successorBandId];
    const phase = successorNow?.provisionalSuccessor?.phase ?? (successorNow ? "established" : "missing");
    if (phase !== previousPhase) {
      downstreamPhases.push(phase);
      previousPhase = phase;
    }
    if (phase === "reintegrated") break;
  }
  assert.deepEqual(downstreamPhases.slice(0, 4), ["travelling", "establishing", "returning", "reintegrated"], "ordinary lifecycle must reach physical reintegration in this deterministic fixture");
  const reintegratedParent = downstreamWorld.bands[parentId];
  assert.equal(separationHistory.getLatestPhysicalSeparationTick(reintegratedParent), Number(productionParent.successorDepartureRecords.at(-1).tick), "physical-separation cooldown history must survive successor reintegration");

  // A legitimate ready attempt positioned immediately before a season boundary must not create a
  // successor on the boundary day, because the seasonal pipeline runs immediately after daily actions.
  const boundaryDay = Math.ceil((departureDay + 1) / 90) * 90;
  const boundaryReadyParent = {
    ...readyParent,
    fissionAttempt: { ...readyAttempt, phaseEnteredDay: boundaryDay - 1 },
  };
  const boundaryReadyWorld = {
    ...controlled.readyWorld,
    time: time.getWorldTimeForDay(boundaryDay - 1),
    bands: { ...controlled.readyWorld.bands, [parentId]: boundaryReadyParent },
  };
  const afterBoundaryDay = advance.advanceWorldByDays(boundaryReadyWorld, 1);
  assert.equal(afterBoundaryDay.bands[successorBandId], undefined, "season-boundary day must not create a newborn successor");
  assert.notEqual(afterBoundaryDay.bands[parentId].fissionAttempt?.phase, "departed", "boundary-day seasonal pipeline must not observe a same-day physical split");

  const boundaryChunked = advance.advanceWorldByDays(boundaryReadyWorld, 2);
  const boundaryDaily = advance.advanceWorldByDays(afterBoundaryDay, 1);
  assert.deepEqual(boundaryChunked, boundaryDaily, "season-boundary deferral must be invariant to chunked vs one-day stepping order");

  // Build multiple ready natural attempts through the real proposal + plan + preparation authorities.
  // The direct proposal call is a concurrency fixture, not the untouched-natural acceptance proof.
  const sourceForConcurrent = readyParent;
  const cloneIds = Array.from({ length: 12 }, (_, i) => `band:cutover-concurrent-${String(i).padStart(2, "0")}`);
  let concurrentWorld = { ...controlled.readyWorld, bands: { ...controlled.readyWorld.bands } };
  const cloneTarget = Object.values(sourceForConcurrent.knowledge.observedTiles)
    .filter((record) => String(record.tileId) !== String(sourceForConcurrent.position) && record.confidence >= 0.34)
    .sort((a, b) => (b.visits ?? 0) - (a.visits ?? 0) || String(a.tileId).localeCompare(String(b.tileId)))[0];
  assert.ok(cloneTarget, "concurrency fixture needs a genuinely known target");
  for (const cloneId of cloneIds) {
    const clone = {
      ...sourceForConcurrent,
      id: cloneId,
      name: cloneId,
      parentBandId: undefined,
      daughterBandIds: [],
      fissionEvents: [],
      successorDepartureRecords: [],
      fissionAttempt: undefined,
      provisionalSuccessor: undefined,
      knowledge: { ...sourceForConcurrent.knowledge, selfBandId: cloneId },
    };
    concurrentWorld = { ...concurrentWorld, bands: { ...concurrentWorld.bands, [cloneId]: clone } };
    const begun = natural.beginNaturalFissionProposal({
      world: concurrentWorld,
      parentId: cloneId,
      today: departureDay + 10,
      input: {
        cause: "accumulated_split_pressure",
        splitPressure: 1,
        ecologicalFounderRequest: 20,
        minimumFounderRequest: 2,
        targetTileId: cloneTarget.tileId,
        targetScore: 1,
        targetReason: "frontier_split",
        reasonIds: [`reason:cutover-concurrency:${cloneId}`],
      },
    });
    if (begun.ok === true) concurrentWorld = begun.world;
  }
  concurrentWorld = natural.advanceNaturalFissionPreDeparture(concurrentWorld, departureDay + 11).world;
  concurrentWorld = natural.advanceNaturalFissionPreDeparture(concurrentWorld, departureDay + 12).world;
  const readyConcurrent = Object.values(concurrentWorld.bands)
    .filter((band) => cloneIds.includes(String(band.id)) && band.fissionAttempt?.phase === "departure_ready")
    .sort((a, b) => a.fissionAttempt.lineageId.localeCompare(b.fissionAttempt.lineageId));
  assert.ok(readyConcurrent.length >= 2, `concurrency fixture must produce at least two canonically prepared ready attempts; got ${readyConcurrent.length}`);
  const twoReady = readyConcurrent.slice(0, 2);

  // Two independent canonical lineages with ample capacity must both depart and create distinct
  // deterministic successors. This is the baseline half of the collision mutation: replacing the
  // identity authority with one constant makes the SECOND attempt reach the real occupied-ID seam.
  const collisionDay = departureDay + 13;
  const collisionBaselineWorld = {
    ...concurrentWorld,
    bands: Object.fromEntries(twoReady.map((band) => [band.id, band])),
  };
  const collisionBaseline = naturalDeparture.advanceNaturalFissionDepartures(collisionBaselineWorld, collisionDay);
  const collisionDepartures = collisionBaseline.records.filter((record) => record.kind === "departed");
  const collisionRefusals = collisionBaseline.records.filter((record) => record.kind === "refused");
  const occupiedIdCollisionRefusals = collisionRefusals.filter((record) => record.refusal === "successor_band_id_already_exists");
  assert.equal(occupiedIdCollisionRefusals.length, 0, "independent canonical lineages must not compete for one occupied successor id");
  assert.equal(collisionDepartures.length, 2, "both independent ready lineages must physically depart when two slots are available");
  assert.equal(collisionRefusals.length, 0, "distinct canonical lineages must not collide at the occupied-ID seam");
  const collisionSuccessorIds = collisionDepartures.map((record) => String(record.successorBandId));
  assert.equal(new Set(collisionSuccessorIds).size, 2, "independent ready lineages must derive two distinct deterministic successor ids");
  for (const id of collisionSuccessorIds) {
    assert.ok(collisionBaseline.world.bands[id], `baseline collision fixture must retain successor ${id}`);
  }
  assert.equal(naturalDeparture.makeNaturalSuccessorBandId(readyAttempt.lineageId), successorBandId, "same lineage must deterministically map to the same successor id");
  assert.equal(successorBandId, `successor:${readyAttempt.lineageId}`, "canonical successor identity must be lineage-derived rather than wall-clock or insertion-order derived");
  assert.notEqual(naturalDeparture.makeNaturalSuccessorBandId(`${readyAttempt.lineageId}:other`), successorBandId, "different lineage must map to a different successor id");

  const kept = Object.fromEntries(twoReady.map((band) => [band.id, band]));
  const fillerSource = Object.values(controlled.readyWorld.bands).find((band) => band.id !== parentId);
  assert.ok(fillerSource, "cap fixture needs an inert filler source");
  for (let i = 0; Object.keys(kept).length < 35; i += 1) {
    const id = `band:cutover-filler-${String(i).padStart(2, "0")}`;
    kept[id] = {
      ...fillerSource, id, name: id, parentBandId: undefined, daughterBandIds: [], fissionEvents: [],
      successorDepartureRecords: [], fissionAttempt: undefined, provisionalSuccessor: undefined,
      knowledge: { ...fillerSource.knowledge, selfBandId: id },
    };
  }
  const capWorld = { ...concurrentWorld, bands: kept };
  const capDay = collisionDay;
  const capResult = naturalDeparture.advanceNaturalFissionDepartures(capWorld, capDay);
  const departedRows = capResult.records.filter((record) => record.kind === "departed");
  const deferredRows = capResult.records.filter((record) => record.kind === "capacity_deferred");
  assert.equal(Object.keys(capResult.world.bands).length, 36, "one remaining causal band slot must admit exactly one successor");
  assert.equal(departedRows.length, 1, "exactly one concurrent ready attempt may consume the final slot");
  assert.equal(deferredRows.length, 1, "the other concurrent ready attempt must be explicitly capacity-deferred");
  const reversedCapWorld = { ...capWorld, bands: Object.fromEntries(Object.entries(capWorld.bands).reverse()) };
  const reversedCapResult = naturalDeparture.advanceNaturalFissionDepartures(reversedCapWorld, capDay);
  assert.equal(reversedCapResult.records.find((record) => record.kind === "departed")?.parentId, departedRows[0].parentId, "band insertion order must not choose the capacity winner");

  // The 36 threshold has two source-derived meanings that share one historical numeric constant:
  // nomadic-scale PRESSURE counts living bodies, but MAX_BANDS is a simulation-management bound on
  // retained Band objects. Terminal snapshots therefore still consume object-capacity even though
  // they do not count as living ecological bands. Prove that distinction rather than inferring it
  // from the constant's historical name.
  const terminalKept = Object.fromEntries(twoReady.map((band) => [band.id, band]));
  for (let i = 0; Object.keys(terminalKept).length < 35; i += 1) {
    const id = `band:cutover-terminal-${String(i).padStart(2, "0")}`;
    terminalKept[id] = {
      ...fillerSource,
      id,
      name: id,
      size: 0,
      status: "dispersed",
      parentBandId: undefined,
      daughterBandIds: [],
      fissionEvents: [],
      successorDepartureRecords: [],
      fissionAttempt: undefined,
      provisionalSuccessor: undefined,
      demography: {
        ...fillerSource.demography,
        population: 0,
        workingAdults: 0,
        dependents: 0,
        elders: 0,
      },
      knowledge: { ...fillerSource.knowledge, selfBandId: id },
    };
  }
  const terminalCapWorld = { ...concurrentWorld, bands: terminalKept };
  const terminalStoredCount = Object.values(terminalCapWorld.bands).filter((band) => lifecycle.isBandTerminal(band)).length;
  const terminalLivingCount = Object.values(terminalCapWorld.bands).filter((band) => lifecycle.isLivingBand(band)).length;
  assert.equal(terminalStoredCount, 33, "terminal-cap fixture must contain 33 retained archival band objects");
  assert.equal(terminalLivingCount, 2, "terminal-cap fixture must contain only the two living ready parents");
  const terminalCapResult = naturalDeparture.advanceNaturalFissionDepartures(terminalCapWorld, capDay);
  assert.equal(Object.keys(terminalCapResult.world.bands).length, 36, "retained terminal Band objects must consume the shared simulation-management cap");
  assert.equal(terminalCapResult.records.filter((record) => record.kind === "departed").length, 1, "terminal-object cap must admit only one final successor slot");
  assert.equal(terminalCapResult.records.filter((record) => record.kind === "capacity_deferred").length, 1, "second ready parent must defer when retained-object count reaches 36");

  // RED 5: the explicit simulated departure day is the one time authority. A stale world clock
  // must not stamp inherited successor knowledge with an older tick while the departure record says
  // something else. This mirrors accelerated stepping where daily reducers receive `day` explicitly.
  const staleClockWorld = {
    ...controlled.readyWorld,
    time: time.getWorldTimeForDay(100),
  };
  const staleClockDeparture = seam.performAtomicDeparture({
    world: staleClockWorld,
    parentId,
    today: departureDay,
    successorBandId,
    lineageId: readyAttempt.lineageId,
  });
  assert.equal(staleClockDeparture.ok, true, "stale-clock control departure must still execute accepted terms");
  const explicitDepartureTime = time.getWorldTimeForDay(departureDay);
  const explicitDepartureTick = explicitDepartureTime.tick;
  const staleSuccessor = staleClockDeparture.world.bands[successorBandId];
  const staleDepartureRecord = staleSuccessor.successorDepartureRecords.at(-1);
  assert.ok(staleDepartureRecord, "stale-clock departure must create one physical departure record");
  assert.deepEqual(staleDepartureRecord.time, explicitDepartureTime, "departure record WorldTime must come from explicit simulated departure day");
  assert.equal(staleDepartureRecord.tick, explicitDepartureTick, "departure record tick must come from explicit simulated departure day");
  assert.equal(staleSuccessor.provisionalSuccessor?.phaseEnteredDay, departureDay, "provisional lifecycle must begin on the explicit departure day");
  assert.equal(staleClockDeparture.consumedAuthorization.endedDay, departureDay, "consumed authorization must end on the explicit departure day");
  assert.equal(staleClockDeparture.successorDepartureProvenance.departedOnDay, departureDay, "departure provenance must share the same simulated instant");

  const inheritedPatches = staleSuccessor.resourceKnowledgeState?.patchMemories ?? [];
  assert.ok(inheritedPatches.length > 0, "fixture must carry at least one inherited resource memory so the time assertion is non-vacuous");
  for (const inheritedPatch of inheritedPatches) {
    assert.equal(inheritedPatch.firstNotedTick, explicitDepartureTick, `inherited resource ${String(inheritedPatch.patchId)} first reception must use explicit departure tick`);
    assert.equal(inheritedPatch.lastNotedTick, explicitDepartureTick, `inherited resource ${String(inheritedPatch.patchId)} recency must use explicit departure tick`);
    if (inheritedPatch.plantObservation !== undefined) {
      assert.equal(inheritedPatch.plantObservation.lastObservedTick, explicitDepartureTick, `inherited plant hint ${String(inheritedPatch.patchId)} must use explicit departure tick`);
    }
  }

  const generalKnowledge = Object.values(staleSuccessor.knowledge.observedTiles);
  assert.ok(generalKnowledge.length > 0, "fixture must create successor general tile knowledge");
  const inheritedTileKnowledge = generalKnowledge.filter((record) => record.knowledgeSource === "inherited_memory");
  const physicalTileKnowledge = generalKnowledge.filter((record) =>
    record.knowledgeSource === "personally_observed" || record.knowledgeSource === "physically_seen_on_spawn",
  );
  assert.ok(inheritedTileKnowledge.length > 0, "fixture must carry at least one inherited general tile record");
  assert.ok(physicalTileKnowledge.length > 0, "fixture must create at least one physical spawn-perception tile record");
  for (const record of generalKnowledge) {
    assert.deepEqual(record.firstObservedAt, explicitDepartureTime, `new successor tile ${String(record.tileId)} firstObservedAt must use explicit departure time`);
    assert.deepEqual(record.lastObservedAt, explicitDepartureTime, `new successor tile ${String(record.tileId)} lastObservedAt must use explicit departure time`);
    if (record.knowledgeSource !== "inherited_memory") {
      assert.deepEqual(record.seasonsObserved, [explicitDepartureTime.season], `physical spawn tile ${String(record.tileId)} season must use explicit departure season`);
    }
  }

  const observations = staleSuccessor.knowledge.tileObservationHistory;
  assert.ok(observations.length > 0, "fixture must create successor tile-observation history");
  for (const observation of observations) {
    assert.deepEqual(observation.observedAt, explicitDepartureTime, `new successor observation ${String(observation.tileId)} must use explicit departure time`);
    assert.equal(observation.season, explicitDepartureTime.season, `new successor observation ${String(observation.tileId)} must use explicit departure season`);
  }

  const parentKnownBand = staleSuccessor.knowledge.knownBands.find((record) => String(record.bandId) === String(parentId));
  assert.ok(parentKnownBand, "successor must create a direct known-band record for its parent");
  assert.deepEqual(parentKnownBand.firstObservedAt, explicitDepartureTime, "new parent known-band record firstObservedAt must use explicit departure time");
  assert.deepEqual(parentKnownBand.lastObservedAt, explicitDepartureTime, "new parent known-band record lastObservedAt must use explicit departure time");

  const inheritedTickStates = [
    ["animal-pattern", staleSuccessor.animalPatternKnowledge],
    ["exploitation-skill", staleSuccessor.exploitationSkill],
    ["adaptive-human", staleSuccessor.adaptiveHuman],
    ["practical-adaptation", staleSuccessor.practicalAdaptation],
  ];
  for (const [label, state] of inheritedTickStates) {
    if (state !== undefined) {
      assert.equal(state.lastUpdatedTick, explicitDepartureTick, `${label} inheritance timestamp must use explicit departure tick`);
    }
  }
  for (const record of staleSuccessor.animalPatternKnowledge?.records ?? []) {
    assert.equal(record.lastObservedTick, explicitDepartureTick, `inherited animal pattern ${String(record.stockId)} must use explicit departure tick`);
  }
  for (const skill of Object.values(staleSuccessor.exploitationSkill?.skills ?? {})) {
    assert.equal(skill.lastUpdatedTick, explicitDepartureTick, `inherited exploitation skill ${String(skill.resourceClassId)} must use explicit departure tick`);
  }
  for (const fragment of staleSuccessor.practicalAdaptation?.fragments ?? []) {
    assert.equal(fragment.lastReinforcedTick, explicitDepartureTick, `inherited practical fragment ${String(fragment.id)} must use explicit departure tick`);
  }
  for (const problem of staleSuccessor.practicalAdaptation?.problems ?? []) {
    assert.equal(problem.framedAtTick, explicitDepartureTick, `inherited practical problem ${String(problem.id)} must be framed at explicit departure tick`);
    assert.equal(problem.lastEvidenceTick, explicitDepartureTick, `inherited practical problem ${String(problem.id)} evidence recency must use explicit departure tick`);
  }

  // Historical evidence is the opposite category: the successor receives it NOW, but its internal
  // event times still describe when the parent actually experienced those places/routes. Restamping
  // these would manufacture history. Assert that those original timestamps survive unchanged.
  for (const [tileId, memory] of Object.entries(staleSuccessor.placeMemory ?? {})) {
    const parentMemory = readyParent.placeMemory?.[tileId];
    assert.ok(parentMemory, `inherited place memory ${tileId} must originate in the parent`);
    assert.deepEqual(memory.firstObservedAt, parentMemory.firstObservedAt, `place memory ${tileId} firstObservedAt is historical evidence and must remain old`);
    assert.deepEqual(memory.lastObservedAt, parentMemory.lastObservedAt, `place memory ${tileId} lastObservedAt is historical evidence and must remain old`);
    assert.deepEqual(memory.lastReturnAt, parentMemory.lastReturnAt, `place memory ${tileId} lastReturnAt is historical evidence and must remain old`);
  }
  for (const [crossingKey, memory] of Object.entries(staleSuccessor.crossingMemories ?? {})) {
    const parentMemory = readyParent.crossingMemories?.[crossingKey];
    assert.ok(parentMemory, `inherited crossing memory ${crossingKey} must originate in the parent`);
    assert.deepEqual(memory.firstUsedAt, parentMemory.firstUsedAt, `crossing ${crossingKey} firstUsedAt is historical evidence and must remain old`);
    assert.deepEqual(memory.lastUsedAt, parentMemory.lastUsedAt, `crossing ${crossingKey} lastUsedAt is historical evidence and must remain old`);
  }
  for (const [corridorId, memory] of Object.entries(staleSuccessor.travelCorridors ?? {})) {
    const parentMemory = readyParent.travelCorridors?.[corridorId];
    assert.ok(parentMemory, `inherited corridor ${corridorId} must originate in the parent`);
    assert.deepEqual(memory.lastUsedAt, parentMemory.lastUsedAt, `corridor ${corridorId} lastUsedAt is historical evidence and must remain old`);
  }

  if (staleSuccessor.seasonalSupport !== undefined) {
    assert.equal(staleSuccessor.seasonalSupport.lastUpdatedTick, explicitDepartureTick, "successor opening embodied-support state must be rebuilt at explicit departure tick");
    const parentSamples = readyParent.seasonalSupport?.recentSamples?.length > 0
      ? readyParent.seasonalSupport.recentSamples
      : readyParent.seasonalSupport === undefined
        ? []
        : [readyParent.seasonalSupport.currentSeasonSupport];
    assert.deepEqual(staleSuccessor.seasonalSupport.recentSamples, parentSamples, "opening embodied-support samples must retain their original historical tick/year/season evidence");
  }

  // RED 4: a permanently stale ready attempt must not be retried forever. The exact accepted
  // cohort changed after preparation; production must preserve the refusal, supersede the old permit
  // and terminalize this named attempt without silently reallocating anybody.
  const staleParent = controlled.readyWorld.bands[parentId];
  const staleWorld = {
    ...controlled.readyWorld,
    bands: {
      ...controlled.readyWorld.bands,
      [parentId]: {
        ...staleParent,
        size: staleParent.size + 1,
        demography: {
          ...staleParent.demography,
          population: staleParent.demography.population + 1,
          workingAdults: staleParent.demography.workingAdults + 1,
        },
      },
    },
  };
  const staleAfter = advance.advanceWorldByDays(staleWorld, 1);
  const staleAttempt = staleAfter.bands[parentId].fissionAttempt;
  assert.equal(staleAfter.bands[successorBandId], undefined, "stale terms must move nobody");
  assert.equal(staleAttempt.phase, "abandoned", "stale ready attempt must terminalize instead of retrying");
  assert.equal(staleAttempt.preparedDeparture.authorization.status, "superseded_by_revised_terms", "stale permit must be superseded, not silently reused");

  assert.equal(
    separationHistory.getLatestPhysicalSeparationTick(staleAfter.bands[parentId]),
    undefined,
    "pre-departure abandonment must not start physical-separation cooldown",
  );

  // RED 1: the atomic seam must refuse an occupied deterministic successor id before any mutation.
  const occupiedBand = {
    ...readyParent,
    id: successorBandId,
    name: "Occupied collision fixture",
    fissionAttempt: undefined,
    parentBandId: undefined,
    provisionalSuccessor: undefined,
  };
  const occupiedWorld = {
    ...controlled.readyWorld,
    bands: { ...controlled.readyWorld.bands, [successorBandId]: occupiedBand },
  };
  const occupiedBefore = JSON.stringify(occupiedWorld);
  const occupied = seam.performAtomicDeparture({
    world: occupiedWorld,
    parentId,
    today: departureDay,
    successorBandId,
    lineageId: readyAttempt.lineageId,
  });
  assert.equal(occupied.ok, false, "occupied successor id must refuse");
  assert.equal(occupied.refusal, "successor_band_id_already_exists");
  assert.equal(JSON.stringify(occupiedWorld), occupiedBefore, "occupied-id refusal must not mutate input world");

  // Produce one real Direction-D departure for the cooldown diagnostic test.
  const departure = seam.performAtomicDeparture({
    world: controlled.readyWorld,
    parentId,
    today: departureDay,
    successorBandId,
    lineageId: readyAttempt.lineageId,
  });
  assert.equal(departure.ok, true, "control departure must succeed");
  const departedParent = departure.world.bands[parentId];
  assert.equal(departedParent.fissionEvents.length, 0, "Direction-D must not fabricate legacy fission events");
  assert.equal(departedParent.successorDepartureRecords.length > 0, true, "Direction-D must record physical departure");

  // RED 2: production diagnostics and production cooldown must read the same physical-separation fact.
  const nextAnnualDay = Math.ceil((departureDay + 1) / 360) * 360;
  const diagnosticWorld = { ...departure.world, time: time.getWorldTimeForDay(nextAnnualDay) };
  const rows = [];
  diagnostics.setFissionEvaluationObserver((row) => rows.push(row));
  try {
    demography.updateBandsDemographyAndFission(diagnosticWorld);
  } finally {
    diagnostics.setFissionEvaluationObserver(undefined);
  }
  const row = rows.find((entry) => String(entry.bandId) === String(parentId));
  assert.ok(row, "parent must emit a fission diagnostic row");
  const departureTick = departedParent.successorDepartureRecords.at(-1).tick;
  const expectedTicksSince = Number(diagnosticWorld.time.tick) - Number(departureTick);
  assert.equal(row.ticksSinceLastFission, expectedTicksSince, "diagnostic recency must include Direction-D departure");
  assert.equal(row.cooldownElapsed, expectedTicksSince >= row.requiredCooldownTicks, "cooldown and recency must share one authority");

  // Secondary cooldown outcome matrix. The physical-separation fact belongs to the parent and must
  // remain true regardless of how the already-departed successor later resolves. These variants are
  // deliberately not the untouched-natural proof; they isolate the cooldown reader against each
  // terminal downstream classification while retaining the one real Direction-D departure record.
  const cooldownOutcomeMatrix = {};
  for (const outcomePhase of ["stabilized", "reintegrated", "provisional_extinguished", "established_after_failed_return"]) {
    const outcomeSuccessor = departure.world.bands[successorBandId];
    const outcomeWorld = {
      ...departure.world,
      time: time.getWorldTimeForDay(nextAnnualDay),
      bands: {
        ...departure.world.bands,
        [successorBandId]: {
          ...outcomeSuccessor,
          provisionalSuccessor: {
            ...outcomeSuccessor.provisionalSuccessor,
            phase: outcomePhase,
            phaseEnteredDay: departureDay + 1,
            history: [...(outcomeSuccessor.provisionalSuccessor?.history ?? []), outcomeSuccessor.provisionalSuccessor?.phase ?? "travelling"],
          },
        },
      },
    };
    const outcomeRows = [];
    diagnostics.setFissionEvaluationObserver((entry) => outcomeRows.push(entry));
    try {
      demography.updateBandsDemographyAndFission(outcomeWorld);
    } finally {
      diagnostics.setFissionEvaluationObserver(undefined);
    }
    const outcomeParentRow = outcomeRows.find((entry) => String(entry.bandId) === String(parentId));
    assert.ok(outcomeParentRow, `${outcomePhase}: parent must remain observable by the annual cooldown diagnostic`);
    assert.equal(outcomeParentRow.ticksSinceLastFission, expectedTicksSince, `${outcomePhase}: downstream outcome must not erase physical split recency`);
    assert.equal(outcomeParentRow.cooldownElapsed, expectedTicksSince >= outcomeParentRow.requiredCooldownTicks, `${outcomePhase}: cooldown result must still derive from the same physical split`);
    cooldownOutcomeMatrix[outcomePhase] = {
      ticksSinceLastFission: outcomeParentRow.ticksSinceLastFission,
      requiredCooldownTicks: outcomeParentRow.requiredCooldownTicks,
      cooldownElapsed: outcomeParentRow.cooldownElapsed,
    };
  }

  const result = {
    audit: "ROADMAP ITEM 4 — controlled natural physical cutover",
    verdict: "PASS",
    parentId,
    successorBandId,
    departureDay,
    departureTick,
    diagnosticTick: diagnosticWorld.time.tick,
    expectedTicksSince,
    downstreamPhases,
    boundaryDay,
    concurrentReadyCount: readyConcurrent.length,
    capWinner: departedRows[0]?.parentId,
    collisionBaseline: {
      independentReadyAttempts: twoReady.length,
      departures: collisionDepartures.length,
      distinctSuccessorIds: new Set(collisionSuccessorIds).size,
      refusals: collisionRefusals.length,
    },
    staleClockEvidence: {
      staleWorldTime: staleClockWorld.time,
      explicitDepartureTime,
      inheritedResourceMemories: inheritedPatches.length,
      inheritedGeneralTiles: inheritedTileKnowledge.length,
      physicalSpawnTiles: physicalTileKnowledge.length,
      tileObservations: observations.length,
      inheritedDomainsPresent: {
        animalPattern: staleSuccessor.animalPatternKnowledge !== undefined,
        exploitationSkill: staleSuccessor.exploitationSkill !== undefined,
        adaptiveHuman: staleSuccessor.adaptiveHuman !== undefined,
        practicalAdaptation: staleSuccessor.practicalAdaptation !== undefined,
        placeMemory: Object.keys(staleSuccessor.placeMemory ?? {}).length,
        crossingMemories: Object.keys(staleSuccessor.crossingMemories ?? {}).length,
        travelCorridors: Object.keys(staleSuccessor.travelCorridors ?? {}).length,
        openingEmbodiedSupport: staleSuccessor.seasonalSupport !== undefined,
      },
    },
    capSemantics: {
      threshold: 36,
      retainedBandObjectCountBefore: Object.keys(terminalCapWorld.bands).length,
      terminalStoredCount,
      livingBandCount: terminalLivingCount,
      admittedDepartures: terminalCapResult.records.filter((record) => record.kind === "departed").length,
      deferredDepartures: terminalCapResult.records.filter((record) => record.kind === "capacity_deferred").length,
      interpretation: "shared numeric threshold; ecological scale pressure counts living bands, physical fission MAX_BANDS bounds retained Band objects",
    },
    cooldownOutcomeMatrix,
  };
  const out = "docs/evidence/item4-natural-physical-cutover/controlled-cutover.json";
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
  console.log(`written: ${out}`);
} finally {
  await server.close();
}
