// ROADMAP ITEM 4 STAGE B — PHYSICAL RETURN AND ATOMIC REINTEGRATION.
//
// The reviewed defect was a group being declared home by a clock. These fixtures assert the opposite
// property from both directions: reintegration happens ONLY where the two groups physically meet, and
// when it happens the people are conserved line by line and the provisional entity is removed exactly
// once rather than left alive under a terminal label.
//
// The parent-unavailable arm is the one that matters most for honesty: a group that walks back to the
// tile it left and finds nobody must NOT be reintegrated, must not be retargeted at a position it has
// no way to know, and must not quietly disappear.
import { createServer } from "vite";
import { prepareAndDepart } from "./lib/preparedDeparture.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/dynamic-fission-daughter-viability-37";
const OUT = arg("out", `${EVIDENCE}/provisional-reintegration.json`);
const SEED = arg("seed", "audit27:natural:s1");
const WARM_DAYS = Number(arg("warm-days", "2100"));

const fixtures = [];
const record = (id, claim, passed, nonVacuous, detail) => {
  fixtures.push({
    id, claim,
    verdict: nonVacuous === false ? "VACUOUS" : passed ? "PASS" : "FAIL",
    nonVacuous: nonVacuous !== false, detail,
  });
};

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-i4rein-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const seam = await server.ssrLoadModule("/sim/agents/fissionDepartureSeam.ts");
  const prep = await server.ssrLoadModule("/sim/agents/fissionDeparturePreparation.ts");
  const reint = await server.ssrLoadModule("/sim/agents/provisionalReintegration.ts");
  const travel = await server.ssrLoadModule("/sim/agents/provisionalTravel.ts");
  const generate = await server.ssrLoadModule("/sim/world/generate.ts");
  const passability = await server.ssrLoadModule("/sim/world/passability.ts");
  const lc = await server.ssrLoadModule("/sim/agents/bandLifecycle.ts");

  let world = runner.initSimWorld({ kind: "map2" }, SEED);
  world = advance.advanceWorldByDays(world, WARM_DAYS);
  const parent = Object.values(world.bands)
    .filter((b) => lc.isEstablishedBand(b) && b.demography.workingAdults >= 6 && b.demography.population >= 24)
    .sort((a, b) => b.demography.population - a.demography.population)[0];
  if (parent === undefined) throw new Error("no suitable parent band");

  const here = generate.getTile(world, parent.position);
  const dist = (t) => Math.abs(t.coord.x - here.coord.x) + Math.abs(t.coord.y - here.coord.y);
  const targetTile = Object.keys(parent.knowledge.observedTiles)
    .map((id) => generate.getTile(world, id))
    .filter((t) => t !== undefined && passability.isBandPassableDestination(t) && dist(t) >= 4)
    .sort((a, b) => dist(a) - dist(b) || String(a.id).localeCompare(String(b.id)))[0];
  if (targetTile === undefined) throw new Error("no known passable target at distance >= 4");

  const dayD = Number(world.time.day ?? 0);
  const requested = Math.max(2, Math.floor(parent.demography.population * 0.35));
  const departure = prepareAndDepart({
    prep, seam, world: world, parentId: parent.id, today: dayD,
    lineageId: "LIN-REIN-1", requestedFounders: requested, targetTileId: String(targetTile.id),
    successorBandId: `${parent.id}:provisional:1`,
  }).departure;
  if (departure.ok !== true) throw new Error(`departure refused: ${departure.refusal}`);
  const succId = String(departure.successorId);
  const departureTile = String(departure.world.bands[succId].position);

  // ── walk out, then turn the group around ──
  let w = departure.world;
  for (let day = 1; day <= 40; day += 1) {
    w = advance.advanceWorldByDays(w, 1);
    if (String(w.bands[succId].position) === String(targetTile.id)) break;
  }
  const awayTile = String(w.bands[succId].position);
  const turnAround = (world_) => ({
    ...world_,
    bands: {
      ...world_.bands,
      [succId]: {
        ...world_.bands[succId],
        provisionalSuccessor: {
          ...world_.bands[succId].provisionalSuccessor,
          phase: "returning",
          phaseEnteredDay: Number(world_.time.day ?? 0),
          history: [...(world_.bands[succId].provisionalSuccessor.history ?? []), "travelling"],
        },
      },
    },
  });

  // ── R1 — reintegration is REFUSED while the group is still away ──
  const awayAttempt = reint.performAtomicReintegration({ world: turnAround(w), successorId: succId, today: Number(w.time.day ?? 0) });
  record(
    "R1_reintegration_is_refused_at_a_distance",
    "a returning group that is not standing on its parent's tile cannot be reintegrated — reintegration at a distance is the teleport this item exists to remove, in the opposite direction",
    awayAttempt.ok === false && awayAttempt.refusal === "not_physically_co_located",
    awayTile !== departureTile,
    { successorTile: awayTile, parentTile: String(w.bands[parent.id].position), refusal: awayAttempt.ok ? "ACCEPTED" : awayAttempt.refusal, detail: awayAttempt.detail },
  );

  // ── walk it home, and STOP ONE TILE SHORT ──
  //
  // FIXTURE REPAIR — the physical-return pass wired `provisional_reintegration` into the daily runner,
  // so production now merges a returning group ON THE DAY IT ARRIVES. This loop used to walk until the
  // successor stood on its parent's tile, which is now exactly one day too far: the runner had already
  // performed the merge, and R3-R9 — every fixture that tests the WRITER's own properties — ran against
  // a spent successor holding no bodies and reported `successor_is_not_returning`.
  //
  // The subject of R3-R9 is the authority, not the schedule, so the loop now stops while the group is
  // still live and adjacent; the `coLocated` construction below then places it on the parent's tile and
  // the manual call is the first merge, exactly as before. RX1/RX2 in
  // `provisionalReturnReachabilityAudit.mjs` cover the runner-driven path this repair steps around.
  const tileDistance = (world_, aId, bId) => {
    const a = generate.getTile(world_, aId);
    const b = generate.getTile(world_, bId);
    if (a === undefined || b === undefined) throw new Error("HARNESS HARD FAIL: missing tile in return walk");
    return Math.abs(a.coord.x - b.coord.x) + Math.abs(a.coord.y - b.coord.y);
  };
  let rw = turnAround(w);
  for (let day = 1; day <= 60; day += 1) {
    const next = advance.advanceWorldByDays(rw, 1);
    const b = next.bands[succId];
    if (b === undefined || !lc.isProvisionalSuccessor(b)) break;
    rw = next;
    if (tileDistance(rw, b.position, rw.bands[parent.id].position) <= 1) break;
  }
  const homeTile = String(rw.bands[succId]?.position ?? "gone");
  const parentTileNow = String(rw.bands[parent.id].position);

  // ── R2 — the return is a contiguous physical walk ──
  // The stopping point moved with the loop repair above: the walk is halted while the group is still
  // live and adjacent, so "arrived at the tile" is no longer the observable. The claim is unchanged and
  // is now stated as the thing that was always meant — the distance to the tile it left from FELL,
  // under its own steps, to within one tile.
  const awayDistanceToDeparture = tileDistance(w, awayTile, departureTile);
  const homeDistanceToDeparture = tileDistance(rw, homeTile, departureTile);
  record(
    "R2_the_return_is_a_physical_walk_back",
    "the group walks back toward the tile it physically left from — the last place it actually saw its parent — rather than being retargeted at a position it has no channel to observe",
    homeDistanceToDeparture < awayDistanceToDeparture && homeDistanceToDeparture <= 1,
    awayTile !== departureTile && awayDistanceToDeparture > 1,
    { departureTile, awayTile, afterReturnWalk: homeTile, parentTileNow,
      awayDistanceToDeparture, homeDistanceToDeparture,
      trailLength: (rw.bands[succId]?.provisionalSuccessor?.trail ?? []).length,
      note: "halted adjacent by design so R3-R9 can exercise the writer on a live successor; the runner-driven arrival is covered by RX1/RX2" },
  );

  // ── R3 — co-located: reintegration succeeds and conserves every cohort line ──
  const coLocated = {
    ...rw,
    bands: { ...rw.bands, [succId]: { ...rw.bands[succId], position: rw.bands[parent.id].position } },
  };
  const pBefore = coLocated.bands[parent.id].demography;
  const sBefore = coLocated.bands[succId].demography;
  const merged = reint.performAtomicReintegration({ world: coLocated, successorId: succId, today: Number(coLocated.time.day ?? 0) });
  record(
    "R3_co_located_reintegration_conserves_every_cohort_line",
    "the parent's working adults, dependents and elders each gain EXACTLY what the returning group held — cohorts are added line by line, never re-derived at fixed ratios, which is the mechanism that manufactured dependents in 0 of 2 measured natural fissions",
    merged.ok === true && reint.isReintegrationLedgerConserving(merged.ledger),
    Math.round(sBefore.population) > 0,
    merged.ok === true
      ? {
          parentBefore: merged.ledger.demographic.parentBefore,
          successorBefore: merged.ledger.demographic.successorBefore,
          parentAfter: merged.ledger.demographic.parentAfter,
          worldPopulation: { before: merged.ledger.demographic.worldPopulationBefore, after: merged.ledger.demographic.worldPopulationAfter },
          conserved: {
            population: merged.ledger.demographic.populationConserved,
            workingAdults: merged.ledger.demographic.workingAdultsConserved,
            dependents: merged.ledger.demographic.dependentsConserved,
            elders: merged.ledger.demographic.eldersConserved,
          },
        }
      : { refusal: merged.refusal, detail: merged.detail, parentPop: Math.round(pBefore.population), succPop: Math.round(sBefore.population) },
  );

  // ── R4 — the provisional entity is removed EXACTLY ONCE ──
  const afterBand = merged.ok === true ? merged.world.bands[succId] : undefined;
  const secondAttempt = merged.ok === true
    ? reint.performAtomicReintegration({ world: merged.world, successorId: succId, today: Number(merged.world.time.day ?? 0) })
    : null;
  record(
    "R4_the_provisional_entity_is_removed_exactly_once",
    "after reintegration the successor holds no bodies, is terminal, and a SECOND reintegration is refused — the contract said the entity is removed exactly once, and nothing used to remove it at all",
    merged.ok === true && merged.ledger.entity.removedExactlyOnce && !merged.ledger.entity.successorStillLiving &&
      secondAttempt !== null && secondAttempt.ok === false,
    merged.ok === true,
    merged.ok === true
      ? {
          entity: merged.ledger.entity,
          stillInWorldAsRecord: afterBand !== undefined,
          populationAfter: Math.round(afterBand?.demography.population ?? -1),
          isLivingBand: afterBand === undefined ? null : lc.isLivingBand(afterBand),
          isBandTerminal: afterBand === undefined ? null : lc.isBandTerminal(afterBand),
          secondAttempt: secondAttempt?.ok === true ? "ACCEPTED" : secondAttempt?.refusal,
        }
      : { refusal: merged.refusal },
  );

  // ── R5 — burden comes home; nobody is cured by walking back ──
  record(
    "R5_no_unearned_relief_from_absorbing_the_returning_group",
    "absorbing a HUNGRIER group never leaves the parent better fed than it was; the merged value is population-weighted, so the returning group's hardship is shared rather than erased",
    merged.ok === true && !merged.ledger.embodied.parentReliefedByAbsorbingAHungrierGroup,
    merged.ok === true,
    merged.ok === true ? merged.ledger.embodied : { refusal: merged.refusal },
  );

  // ── R6 — PARENT UNAVAILABLE: the group arrives and finds nobody ──
  //
  // Constructed by moving the parent one tile off the meeting place. Everything else is identical.
  const parentMoved = {
    ...rw,
    bands: {
      ...rw.bands,
      [succId]: { ...rw.bands[succId], position: rw.bands[parent.id].position },
      [parent.id]: {
        ...rw.bands[parent.id],
        position: generate.getNeighborTiles(rw, rw.bands[parent.id].position)
          .filter((t) => passability.isBandPassableDestination(t))
          .sort((a, b) => String(a.id).localeCompare(String(b.id)))[0]?.id ?? rw.bands[parent.id].position,
      },
    },
  };
  const movedAttempt = reint.performAtomicReintegration({ world: parentMoved, successorId: succId, today: Number(parentMoved.time.day ?? 0) });
  const succAfterRefusal = movedAttempt.ok === true ? null : parentMoved.bands[succId];
  record(
    "R6_a_parent_that_has_moved_prevents_remote_reintegration",
    "the group reaches the meeting place, its parent is not there, and it is NOT reintegrated, NOT retargeted at a position it has no channel to observe, and NOT made to disappear — it keeps its people and stays provisional",
    movedAttempt.ok === false && movedAttempt.refusal === "not_physically_co_located" &&
      succAfterRefusal !== undefined && Math.round(succAfterRefusal.demography.population) > 0 &&
      lc.isProvisionalSuccessor(succAfterRefusal),
    String(parentMoved.bands[parent.id].position) !== String(parentMoved.bands[succId].position),
    {
      successorTile: String(parentMoved.bands[succId].position),
      parentTile: String(parentMoved.bands[parent.id].position),
      refusal: movedAttempt.ok === true ? "ACCEPTED" : movedAttempt.refusal,
      successorStillHoldsPeople: Math.round(succAfterRefusal?.demography.population ?? 0),
      successorStillProvisional: succAfterRefusal === undefined ? null : lc.isProvisionalSuccessor(succAfterRefusal),
      NOT_RESOLVED_HERE: "after the bounded return action, a living separate group enters the named event-bounded unresolved state; later co-location or zero population can resolve it, and nothing here fabricates another outcome",
    },
  );

  // ── R7 — a terminal parent cannot receive anybody ──
  const deadParent = {
    ...rw,
    bands: {
      ...rw.bands,
      [succId]: { ...rw.bands[succId], position: rw.bands[parent.id].position },
      [parent.id]: { ...rw.bands[parent.id], status: "dispersed" },
    },
  };
  const deadAttempt = reint.performAtomicReintegration({ world: deadParent, successorId: succId, today: Number(deadParent.time.day ?? 0) });
  record(
    "R7_a_terminal_parent_cannot_receive_anybody",
    "co-location with a dispersed parent is refused — handing people to an archived band would resurrect it through the fission path",
    deadAttempt.ok === false && deadAttempt.refusal === "parent_is_terminal",
    true,
    { refusal: deadAttempt.ok === true ? "ACCEPTED" : deadAttempt.refusal },
  );

  // ── R8 — a group with nobody left is not reintegrated ──
  const emptied = {
    ...rw,
    bands: {
      ...rw.bands,
      [succId]: {
        ...rw.bands[succId],
        position: rw.bands[parent.id].position,
        demography: { ...rw.bands[succId].demography, population: 0, workingAdults: 0, dependents: 0, elders: 0 },
      },
    },
  };
  const emptyAttempt = reint.performAtomicReintegration({ world: emptied, successorId: succId, today: Number(emptied.time.day ?? 0) });
  record(
    "R8_a_group_with_no_bodies_is_not_reintegrated",
    "an empty group is refused rather than handed back — routing it through reintegration would transfer bodies that do not exist, and zero population is the extinguishment resolver's case",
    emptyAttempt.ok === false && emptyAttempt.refusal === "successor_has_no_bodies",
    true,
    { refusal: emptyAttempt.ok === true ? "ACCEPTED" : emptyAttempt.refusal },
  );

  // ── R9 — determinism ──
  const again = reint.performAtomicReintegration({ world: coLocated, successorId: succId, today: Number(coLocated.time.day ?? 0) });
  const digest = (v) => JSON.stringify(v, (k, x) => (x === undefined ? "<undefined>" : x));
  record(
    "R9_reintegration_is_deterministic",
    "two identical reintegration requests produce a byte-identical world",
    merged.ok === true && again.ok === true && digest(again.world.bands) === digest(merged.world.bands),
    merged.ok === true,
    { comparedBands: merged.ok === true ? Object.keys(merged.world.bands).length : 0 },
  );

  out = {
    generatedAt: new Date().toISOString(),
    seed: SEED, warmDays: WARM_DAYS,
    parentId: String(parent.id), successorId: succId,
    departureTile, targetTile: String(targetTile.id), awayTile, afterReturnWalk: homeTile,
    ledger: merged.ok === true ? merged.ledger : null,
    summary: {
      fixtures: fixtures.length,
      passing: fixtures.filter((f) => f.verdict === "PASS").length,
      failing: fixtures.filter((f) => f.verdict === "FAIL").length,
      vacuous: fixtures.filter((f) => f.verdict === "VACUOUS").length,
    },
    fixtures,
  };
} finally {
  await server.close();
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify(out.summary, null, 2));
for (const f of out.fixtures) console.log(`${f.verdict.padEnd(7)} ${f.id}`);
if (out.summary.failing > 0 || out.summary.vacuous > 0) process.exitCode = 1;
