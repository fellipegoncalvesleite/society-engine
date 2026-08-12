import {
  advancePhysicalSuccessorDayWithoutStabilization,
  makeCanonicalStabilizationDeparture,
} from "./successorStabilizationFixture.mjs";

const replaceBand = (world, bandId, change) => ({
  ...world,
  bands: { ...world.bands, [bandId]: change(world.bands[bandId]) },
});

/**
 * Build the exact living debt through production transitions: depart, walk, arrive, let the bounded
 * establishment action fail, enter return, physically walk home, find the moved parent absent, and
 * let only the bounded return action expire.
 */
export function makeGenuineUnresolvedFailedReturn(modules, warmWorld, {
  successorBandId = "band:failed-return-continuation",
  lineageId = "LIN-FAILED-RETURN-CONTINUATION",
  terminalParent = false,
} = {}) {
  const departure = makeCanonicalStabilizationDeparture(modules, warmWorld, { successorBandId, lineageId });
  let world = departure.departure.world;
  const trace = [{ day: departure.departureDay, phase: "travelling", position: String(world.bands[departure.successorId].position) }];

  let establishingDay;
  for (let offset = 1; offset <= 80; offset += 1) {
    const day = departure.departureDay + offset;
    world = advancePhysicalSuccessorDayWithoutStabilization(modules, world, day);
    const band = world.bands[departure.successorId];
    trace.push({ day, phase: band.provisionalSuccessor.phase, position: String(band.position) });
    if (band.provisionalSuccessor.phase === "establishing") {
      establishingDay = day;
      break;
    }
  }
  if (establishingDay === undefined) throw new Error("failed-return fixture never physically arrived");

  const failureDay = establishingDay + modules.kernel.ESTABLISHMENT_MAX_DAYS;
  let resolved = modules.lifecycleResolver.resolveProvisionalLifecycles(world, failureDay);
  world = { ...resolved.world, time: modules.time.getWorldTimeForDay(failureDay) };
  if (world.bands[departure.successorId].provisionalSuccessor.phase !== "failed_early") {
    throw new Error("failed-return fixture did not enter failed_early");
  }
  trace.push({ day: failureDay, phase: "failed_early", position: String(world.bands[departure.successorId].position) });

  const returnDay = failureDay + modules.kernel.FAILED_EARLY_MAX_DAYS;
  resolved = modules.lifecycleResolver.resolveProvisionalLifecycles(world, returnDay);
  world = { ...resolved.world, time: modules.time.getWorldTimeForDay(returnDay) };
  const returning = world.bands[departure.successorId];
  if (returning.provisionalSuccessor.phase !== "returning" ||
      returning.provisionalSuccessor.separationCourse?.status !== "return_path_entered") {
    throw new Error("failed-return fixture did not genuinely enter the return path");
  }
  trace.push({ day: returnDay, phase: "returning", position: String(returning.position) });

  const parent = world.bands[departure.parent.id];
  const origin = modules.generate.getTile(world, parent.position);
  const returnStart = modules.generate.getTile(world, returning.position);
  const movedParentTile = Object.values(world.tiles)
    .filter(modules.passability.isBandPassableDestination)
    .filter((tile) =>
      Math.abs(tile.coord.x - origin.coord.x) + Math.abs(tile.coord.y - origin.coord.y) >= 12 &&
      Math.abs(tile.coord.x - returnStart.coord.x) + Math.abs(tile.coord.y - returnStart.coord.y) >= 12)
    .sort((left, right) => String(left.id).localeCompare(String(right.id)))[0];
  if (movedParentTile === undefined) throw new Error("failed-return fixture cannot move parent aside");
  world = replaceBand(world, parent.id, (band) => ({
    ...band,
    position: movedParentTile.id,
    ...(terminalParent
      ? {
          status: "dispersed",
          viability: {
            ...(band.viability ?? {}),
            status: "extinct",
            extinctionRisk: 1,
            reason: "controlled terminal parent",
            reasonIds: [],
          },
        }
      : {}),
  }));

  let reachedDepartureDay;
  let previous = returning.position;
  const returnMoves = [];
  for (let offset = 1; offset <= modules.kernel.RETURN_MAX_DAYS; offset += 1) {
    const day = returnDay + offset;
    const before = world.bands[departure.successorId];
    const moved = modules.travel.advanceProvisionalTravel(world, day);
    world = moved.world;
    world = modules.reintegration.advanceProvisionalReintegrations(world, day).world;
    const after = world.bands[departure.successorId];
    if (String(after.position) !== String(previous)) {
      const from = modules.generate.getTile(world, previous);
      const to = modules.generate.getTile(world, after.position);
      returnMoves.push({
        day,
        from: String(previous),
        to: String(after.position),
        manhattan: Math.abs(from.coord.x - to.coord.x) + Math.abs(from.coord.y - to.coord.y),
      });
      previous = after.position;
    }
    if (String(after.position) === String(after.provisionalSuccessor.departureTileId)) {
      reachedDepartureDay = day;
      break;
    }
    if (before.provisionalSuccessor.phase !== "returning" || after.provisionalSuccessor.phase !== "returning") {
      throw new Error(`return fixture resolved unexpectedly at ${after.provisionalSuccessor.phase}`);
    }
  }
  if (reachedDepartureDay === undefined) throw new Error("failed-return fixture never physically reached departure tile");
  trace.push({
    day: reachedDepartureDay,
    phase: world.bands[departure.successorId].provisionalSuccessor.phase,
    position: String(world.bands[departure.successorId].position),
  });

  const unresolvedDay = returnDay + modules.kernel.RETURN_MAX_DAYS;
  resolved = modules.lifecycleResolver.resolveProvisionalLifecycles(world, unresolvedDay);
  world = { ...resolved.world, time: modules.time.getWorldTimeForDay(unresolvedDay) };
  const unresolved = world.bands[departure.successorId];
  if (unresolved.provisionalSuccessor.phase !== "unresolved_after_failed_return") {
    throw new Error(`return fixture did not fail truthfully: ${unresolved.provisionalSuccessor.phase}`);
  }
  trace.push({ day: unresolvedDay, phase: unresolved.provisionalSuccessor.phase, position: String(unresolved.position) });
  return {
    departure,
    world,
    successorId: departure.successorId,
    parentId: String(parent.id),
    movedParentTileId: String(movedParentTile.id),
    establishingDay,
    failureDay,
    returnDay,
    reachedDepartureDay,
    unresolvedDay,
    returnMoves,
    trace,
  };
}

export function runRegisteredPostReturnContinuation(modules, fixture, maxDays = 120) {
  let world = fixture.world;
  const trace = [];
  for (let offset = 1; offset <= maxDays; offset += 1) {
    world = modules.advance.advanceWorldByDays(world, 1);
    const band = world.bands[fixture.successorId];
    trace.push({
      offset,
      day: Number(world.time.day),
      phase: band?.provisionalSuccessor?.phase ?? "absent",
      position: band === undefined ? "absent" : String(band.position),
      commitmentId: band?.provisionalSuccessor?.postReturnCommitment?.commitmentId,
      population: band?.demography.population ?? 0,
    });
    if (band?.provisionalSuccessor?.phase === "established_after_failed_return") {
      return { world, band, day: Number(world.time.day), trace };
    }
    if (band === undefined || ["reintegrated", "stabilized", "provisional_extinguished"].includes(band.provisionalSuccessor?.phase)) {
      throw new Error(`post-return continuation left its path at ${band?.provisionalSuccessor?.phase ?? "absent"}`);
    }
  }
  throw new Error(`post-return continuation did not establish within ${maxDays} days`);
}

function manhattan(left, right) {
  return Math.abs(left.coord.x - right.coord.x) + Math.abs(left.coord.y - right.coord.y);
}

function makeTileDry(world, tileId) {
  return {
    ...world,
    tiles: {
      ...world.tiles,
      [tileId]: {
        ...world.tiles[tileId],
        resourceProfile: { ...world.tiles[tileId].resourceProfile, waterAccess: 0 },
      },
    },
  };
}

/** Physically exhaust every materialized food patch at one tile through the production stock owner. */
function exhaustTileFood(modules, world, tileId, day) {
  let current = world;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const tile = modules.generate.getTile(current, tileId);
    const harvest = modules.plantStock.resolvePlantFoodHarvest(
      current,
      tile,
      modules.time.getWorldTimeForDay(day),
      1_000_000,
      true,
    );
    current = harvest.world;
    if (!harvest.sourceFound || harvest.harvestedAmount <= 0) break;
  }
  return current;
}

/**
 * Produce a canonical post-return commitment toward observed country after two real failed
 * subsistence days on the occupied tile. No target is written by the fixture: the pure survivor
 * decision chooses it from the band's own knowledge.
 */
function commitObservedCourse(modules, unresolved) {
  const initial = unresolved.world.bands[unresolved.successorId];
  let world = makeTileDry(unresolved.world, initial.position);
  world = exhaustTileFood(modules, world, initial.position, unresolved.unresolvedDay);
  for (let offset = 1; offset <= modules.postReturn.POST_RETURN_DELIBERATION_MIN_DAYS; offset += 1) {
    const day = unresolved.unresolvedDay + offset;
    world = modules.subsistence.advanceProvisionalSubsistence(world, day).world;
    world = { ...world, time: modules.time.getWorldTimeForDay(day) };
  }
  const decisionDay = unresolved.unresolvedDay + modules.postReturn.POST_RETURN_DELIBERATION_MIN_DAYS;
  const decisionReadyWorld = world;
  const disposition = modules.postReturn.advancePostReturnDispositions(world, decisionDay);
  world = { ...disposition.world, time: modules.time.getWorldTimeForDay(decisionDay) };
  const band = world.bands[unresolved.successorId];
  const commitment = band.provisionalSuccessor.postReturnCommitment;
  if (disposition.commitments.length !== 1 || commitment === undefined) {
    throw new Error(`observed post-return course did not commit: ${JSON.stringify(disposition.refusals)}`);
  }
  if (commitment.evidence.target.basis !== "group_observed_memory" ||
      initial.knowledge.observedTiles[commitment.targetTileId] === undefined) {
    throw new Error("observed post-return course did not choose group-owned remembered country");
  }
  return {
    unresolved,
    world,
    successorId: unresolved.successorId,
    decisionDay,
    decisionReadyWorld,
    commitment,
  };
}

export function makeObservedPostReturnCommitment(modules, warmWorld, {
  successorBandId,
  lineageId,
} = {}) {
  const unresolved = makeGenuineUnresolvedFailedReturn(modules, warmWorld, { successorBandId, lineageId });
  return commitObservedCourse(modules, unresolved);
}

/** Construct A as locally unwalkable without placing any route or hidden-world fact in band state. */
export function makeBlockedPostReturnCourse(modules, warmWorld, options = {}) {
  const unresolved = makeGenuineUnresolvedFailedReturn(modules, warmWorld, options);
  const initial = unresolved.world.bands[unresolved.successorId];
  const here = modules.generate.getTile(unresolved.world, initial.position);
  const candidates = Object.values(initial.knowledge.observedTiles)
    .filter((record) =>
      String(record.tileId) !== String(initial.position) &&
      record.acquisition !== "reported_or_inferred" &&
      record.knowledgeSource !== "inherited_rumor")
    .sort((left, right) =>
      ((right.observedWaterAccess ?? -1) - (left.observedWaterAccess ?? -1)) ||
      (right.observedRichness - left.observedRichness) ||
      (right.confidence - left.confidence) ||
      (right.visits - left.visits) ||
      String(left.tileId).localeCompare(String(right.tileId)));
  const targetA = candidates[0];
  const targetB = candidates.find((candidate) => {
    const tile = modules.generate.getTile(unresolved.world, candidate.tileId);
    return String(candidate.tileId) !== String(targetA?.tileId) &&
      modules.passability.isBandPassableDestination(tile) &&
      tile.coord.x < here.coord.x && tile.coord.y > here.coord.y;
  });
  if (targetA === undefined || targetB === undefined) {
    throw new Error("blocked post-return course lacks two legitimately observed controlled targets");
  }
  const controlledKnowledgeWorld = replaceBand(unresolved.world, unresolved.successorId, (band) => ({
    ...band,
    knowledge: {
      ...band.knowledge,
      observedTiles: Object.fromEntries(
        [targetA, targetB].map((record) => [String(record.tileId), record]),
      ),
    },
  }));
  const committed = commitObservedCourse(modules, { ...unresolved, world: controlledKnowledgeWorld });
  const band = committed.world.bands[committed.successorId];
  const target = modules.generate.getTile(committed.world, committed.commitment.targetTileId);
  const blockingTileIds = modules.generate.getNeighborTiles(committed.world, band.position)
    .filter((tile) => manhattan(tile, target) < manhattan(here, target))
    .map((tile) => String(tile.id));
  if (blockingTileIds.length === 0) throw new Error("blocked post-return course has no forward local step");
  const world = {
    ...committed.world,
    // Food stock is restored for the long blocked-route arm so starvation cannot conceal a missing
    // disposition authority. The locally experienced dry-water fact remains, so the next social
    // decision has a reason to choose the separate observed alternative rather than stay put.
    plantPatchState: unresolved.world.plantPatchState,
    tiles: Object.fromEntries(Object.entries(committed.world.tiles).map(([id, tile]) => [
      id,
      blockingTileIds.includes(id) ? { ...tile, isAquatic: true } : tile,
    ])),
  };
  return {
    ...committed,
    world,
    blockingTileIds,
    alternativeTargetTileId: String(targetB.tileId),
  };
}

/**
 * Run the registered daily pipeline long enough for A to fail, B to require a new decision and, on
 * the fixed controlled map, B to establish through fresh operation.
 */
export function runBlockedPostReturnCourse(
  modules,
  fixture,
  maxDays = 60,
  { stopAfterSupersession = false } = {},
) {
  let world = fixture.world;
  const trace = [];
  let superseded;
  let recommitted;
  let operationHistoryBeforeRecommitment;
  let operationHistoryAtRecommitment;
  let staleEvidenceRefusalAtRecommitment;
  let previousPosition = String(world.bands[fixture.successorId].position);
  for (let offset = 1; offset <= maxDays; offset += 1) {
    world = modules.advance.advanceWorldByDays(world, 1);
    const band = world.bands[fixture.successorId];
    const position = String(band.position);
    const from = modules.generate.getTile(world, previousPosition);
    const to = modules.generate.getTile(world, position);
    const movedDistance = position === previousPosition ? 0 : manhattan(from, to);
    const historical = band.provisionalSuccessor.postReturnCommitmentHistory?.at(-1);
    if (superseded === undefined && historical?.commitment.commitmentId === fixture.commitment.commitmentId) {
      superseded = historical;
      operationHistoryBeforeRecommitment = band.provisionalSuccessor.operationHistory;
    }
    const current = band.provisionalSuccessor.postReturnCommitment;
    const latestSubsistence = band.provisionalSuccessor.travelSubsistence?.recentDays?.at(-1);
    if (recommitted === undefined && current !== undefined && current.commitmentId !== fixture.commitment.commitmentId) {
      recommitted = current;
      operationHistoryAtRecommitment = band.provisionalSuccessor.operationHistory;
      staleEvidenceRefusalAtRecommitment = modules.postReturn
        .advancePostReturnEstablishment(world, Number(world.time.day)).refusals[0];
    }
    trace.push({
      day: Number(world.time.day),
      phase: band.provisionalSuccessor.phase,
      position,
      movedDistance,
      commitmentId: current?.commitmentId,
      blockedStepDays: band.provisionalSuccessor.blockedStepDays ?? 0,
      population: band.demography.population,
      supportUnits: latestSubsistence?.usableUnits,
      demandUnits: latestSubsistence?.demandUnits,
      waterStress: latestSubsistence?.waterStress,
    });
    previousPosition = position;
    if (stopAfterSupersession && superseded !== undefined && current === undefined) {
      return {
        world,
        band,
        trace,
        superseded,
        recommitted,
        operationHistoryBeforeRecommitment,
        operationHistoryAtRecommitment,
        staleEvidenceRefusalAtRecommitment,
        resolved: false,
      };
    }
    if (band.provisionalSuccessor.phase === "established_after_failed_return") {
      return {
        world,
        band,
        trace,
        superseded,
        recommitted,
        operationHistoryBeforeRecommitment,
        operationHistoryAtRecommitment,
        staleEvidenceRefusalAtRecommitment,
        resolved: true,
      };
    }
  }
  return {
    world,
    band: world.bands[fixture.successorId],
    trace,
    superseded,
    recommitted,
    operationHistoryBeforeRecommitment,
    operationHistoryAtRecommitment,
    staleEvidenceRefusalAtRecommitment,
    resolved: false,
  };
}

/**
 * Separate arrival-ground failure: A is physically reached, then its real patches are exhausted and
 * its water is dry. The production measurement closes a target-local window before reconsideration.
 */
export function runFailedGroundAfterArrival(modules, warmWorld, options = {}, maxDays = 50) {
  const fixture = makeObservedPostReturnCommitment(modules, warmWorld, options);
  let world = makeTileDry(fixture.world, fixture.commitment.targetTileId);
  world = exhaustTileFood(modules, world, fixture.commitment.targetTileId, fixture.decisionDay);
  const trace = [];
  let arrivalDay;
  let establishmentRefusalAtFailure;
  let superseded;
  let recommitted;
  let operationHistoryBeforeRecommitment;
  let operationHistoryAtRecommitment;
  let staleEvidenceRefusalAtRecommitment;
  let previousPosition = String(world.bands[fixture.successorId].position);

  for (let offset = 1; offset <= maxDays; offset += 1) {
    const day = fixture.decisionDay + offset;
    world = modules.travel.advanceProvisionalTravel(world, day).world;
    world = modules.reintegration.advanceProvisionalReintegrations(world, day).world;
    world = modules.subsistence.advanceProvisionalSubsistence(world, day).world;
    world = modules.returnDecision.advanceProvisionalReturnDecisions(world, day).world;
    const beforeReconsideration = world;
    const reconsideration = modules.postReturn.advancePostReturnReconsiderations(beforeReconsideration, day);
    world = reconsideration.world;
    if (reconsideration.reconsiderations.length > 0) {
      establishmentRefusalAtFailure = modules.postReturn
        .advancePostReturnEstablishment(beforeReconsideration, day).refusals[0];
      superseded = world.bands[fixture.successorId].provisionalSuccessor.postReturnCommitmentHistory?.at(-1);
      operationHistoryBeforeRecommitment = world.bands[fixture.successorId].provisionalSuccessor.operationHistory;
    }
    const disposition = modules.postReturn.advancePostReturnDispositions(world, day);
    world = disposition.world;
    const currentAfterDisposition = world.bands[fixture.successorId]
      .provisionalSuccessor.postReturnCommitment;
    if (recommitted === undefined && currentAfterDisposition !== undefined &&
        currentAfterDisposition.commitmentId !== fixture.commitment.commitmentId) {
      recommitted = currentAfterDisposition;
      operationHistoryAtRecommitment = world.bands[fixture.successorId].provisionalSuccessor.operationHistory;
      staleEvidenceRefusalAtRecommitment = modules.postReturn
        .advancePostReturnEstablishment(world, day).refusals[0];
    }
    world = modules.postReturn.advancePostReturnEstablishment(world, day).world;
    world = modules.establishment.advanceProvisionalEstablishment(world, day).world;
    world = modules.lifecycleResolver.resolveProvisionalLifecycles(world, day).world;
    world = { ...world, time: modules.time.getWorldTimeForDay(day) };

    const band = world.bands[fixture.successorId];
    const position = String(band.position);
    if (arrivalDay === undefined && position === String(fixture.commitment.targetTileId)) arrivalDay = day;
    const current = band.provisionalSuccessor.postReturnCommitment;
    const latestSubsistence = band.provisionalSuccessor.travelSubsistence?.recentDays?.at(-1);
    const from = modules.generate.getTile(world, previousPosition);
    const to = modules.generate.getTile(world, position);
    trace.push({
      day,
      phase: band.provisionalSuccessor.phase,
      position,
      movedDistance: position === previousPosition ? 0 : manhattan(from, to),
      commitmentId: current?.commitmentId,
      population: band.demography.population,
      supportUnits: latestSubsistence?.usableUnits,
      demandUnits: latestSubsistence?.demandUnits,
      waterStress: latestSubsistence?.waterStress,
      reconsiderations: reconsideration.reconsiderations,
      recognitionRefusal: establishmentRefusalAtFailure?.refusal,
    });
    previousPosition = position;
    if (band.provisionalSuccessor.phase === "established_after_failed_return") break;
  }

  return {
    fixture,
    world,
    band: world.bands[fixture.successorId],
    trace,
    arrivalDay,
    establishmentRefusalAtFailure,
    superseded,
    recommitted,
    operationHistoryBeforeRecommitment,
    operationHistoryAtRecommitment,
    staleEvidenceRefusalAtRecommitment,
  };
}
