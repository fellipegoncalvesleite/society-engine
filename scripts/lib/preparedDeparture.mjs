// ROADMAP ITEM 4 — HOW A CONTROLLED FIXTURE PRODUCES A DEPARTURE NOW.
//
// Every downstream Item-4 fixture (travel, return, reintegration, quarantine, subsistence, field
// transfer, admission, cleanup, two-day integration) used to hand-build a `departure_ready` attempt
// and call `performAtomicDeparture` directly with a residual context of its own invention. That was
// exactly the bypass the atomic-departure gate closes: a phase alone is not a decision, and a caller
// does not get to describe the parent it is asking to split.
//
// So a fixture must now go through the canonical chain — `departure_planned` -> preparation ->
// `departure_ready` -> departure — and this helper is that chain, in one place, so fourteen scripts
// do not grow fourteen slightly different versions of it.
//
// WHAT IT DOES NOT DO. It does not weaken any gate, supply any residual number, or manufacture a
// commitment. `prepareFissionDeparture` runs for real: the residual authority reads the band, the
// founder cohort actually decides, and a refusal is returned as a refusal. The only thing set for
// the fixture's benefit is `demography.splitPressure` — the band's motive to separate — because a
// fixture about what happens AFTER a departure needs a parent that wants one, and that is a real
// canonical field rather than a bypass.

/**
 * A destination the band GENUINELY KNOWS, at a chosen distance.
 *
 * The founder cohort refuses a destination it has barely seen — `destination_barely_known` is a real
 * refusal reason and it fired on fixtures that were picking the FARTHEST observed tile. Choosing the
 * best-known tile among those far enough away is not weakening a gate; it is giving the fixture a
 * departure a group would actually accept, which is the precondition for testing what happens after.
 */
export function bestKnownTargetAtDistance(generate, passability, world, band, minDistance = 0) {
  const here = generate.getTile(world, band.position);
  const dist = (t) => Math.abs(t.coord.x - here.coord.x) + Math.abs(t.coord.y - here.coord.y);
  return Object.keys(band.knowledge.observedTiles)
    .map((id) => ({ id, record: band.knowledge.observedTiles[id], tile: generate.getTile(world, id) }))
    .filter((e) => e.tile !== undefined && passability.isBandPassableDestination(e.tile) && dist(e.tile) >= minDistance)
    .sort((a, b) =>
      (b.record.visits ?? 0) - (a.record.visits ?? 0) ||
      (b.record.seasonsObserved?.length ?? 0) - (a.record.seasonsObserved?.length ?? 0) ||
      String(a.id).localeCompare(String(b.id)))[0]?.tile;
}

/**
 * Prepare and then execute a departure, the way production requires.
 *
 * Returns the departure outcome, plus the preparation outcome so a caller can tell a refused
 * PREPARATION (nobody agreed / the parent cannot afford it) from a refused DEPARTURE (the terms went
 * stale, the permit was spent).
 */
export function prepareAndDepart({
  prep,
  seam,
  world,
  parentId,
  today,
  lineageId,
  requestedFounders,
  targetTileId,
  successorBandId,
  minimumFounderRequest = 2,
  splitPressure = 1,
  phaseEnteredDay,
  band: bandOverride,
}) {
  const parent = world.bands[parentId];
  if (parent === undefined) throw new Error(`prepareAndDepart: no band ${String(parentId)}`);

  const plannedWorld = {
    ...world,
    bands: {
      ...world.bands,
      [parentId]: {
        ...parent,
        ...(bandOverride ?? {}),
        demography: { ...parent.demography, splitPressure },
        fissionAttempt: {
          phase: "departure_planned",
          phaseEnteredDay: phaseEnteredDay ?? today - 2,
          history: ["proposed"],
          lineageId,
          requestedFounders,
          targetTileId: String(targetTileId),
        },
      },
    },
  };

  const preparation = prep.prepareFissionDeparture({
    world: plannedWorld,
    parentId,
    today,
    policy: { minimumFounderRequest },
  });
  if (preparation.ok !== true) {
    return { preparation, departure: { ok: false, refusal: `preparation:${preparation.refusal}`, detail: preparation.detail } };
  }

  const departure = seam.performAtomicDeparture({
    world: preparation.world,
    parentId,
    today,
    successorBandId,
    lineageId,
  });
  return { preparation, departure };
}

/** The same, but throwing with a readable reason — for fixtures whose whole setup depends on it. */
export function prepareAndDepartOrThrow(args) {
  const { preparation, departure } = prepareAndDepart(args);
  if (departure.ok !== true) {
    const evidence = preparation.ok === true ? "" : ` (preparation detail: ${preparation.detail ?? "none"})`;
    throw new Error(`departure refused: ${departure.refusal} ${departure.detail ?? ""}${evidence}`);
  }
  return { preparation, departure };
}
