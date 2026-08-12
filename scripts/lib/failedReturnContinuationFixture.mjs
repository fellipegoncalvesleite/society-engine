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
