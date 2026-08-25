// ROADMAP ITEM 4 STAGE A — CONTIGUOUS OUTBOUND TRAVEL.
//
// Before this, a provisional successor was quarantined and INERT: excluded from residential movement
// with nothing to replace it, so it stood on its parent's tile and that was called a journey. The
// point of these fixtures is that "the group travelled" is a measured sequence of adjacent tiles and
// not a phase label.
//
// The target is chosen from the successor's OWN inherited knowledge at a real distance, because a
// departure whose target is the tile it is already standing on arrives instantly and proves nothing.
import { createServer } from "vite";
import { prepareAndDepart } from "./lib/preparedDeparture.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/dynamic-fission-daughter-viability-37";
const OUT = arg("out", `${EVIDENCE}/provisional-travel.json`);
const SEED = arg("seed", "audit27:natural:s1");
const WARM_DAYS = Number(arg("warm-days", "2100"));
const OBSERVE_DAYS = Number(arg("observe-days", "180"));

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
  cacheDir: `node_modules/.vite-i4trav-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const seam = await server.ssrLoadModule("/sim/agents/fissionDepartureSeam.ts");
  const prep = await server.ssrLoadModule("/sim/agents/fissionDeparturePreparation.ts");
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
  // A destination the PARENT actually knows, far enough that arriving takes real days, and passable so
  // the journey is not refused at its own endpoint.
  const targetTile = Object.keys(parent.knowledge.observedTiles)
    .map((id) => generate.getTile(world, id))
    .filter((t) => t !== undefined && passability.isBandPassableDestination(t) && dist(t) >= 4)
    .sort((a, b) => dist(a) - dist(b) || String(a.id).localeCompare(String(b.id)))[0];
  if (targetTile === undefined) throw new Error("no known passable target at distance >= 4");

  const dayD = Number(world.time.day ?? 0);
  const requested = Math.max(2, Math.floor(parent.demography.population * 0.35));
  // The departure now runs the canonical chain: `departure_planned` -> a real preparation (residual
  // assessment read off the band, a positive founder-cohort commitment, a one-use permit) ->
  // `departure_ready` -> the atomic transfer. The hand-built `departure_ready` record this fixture
  // used to construct is refused by production.
  const makeDeparture = (successorBandId) => prepareAndDepart({
    prep, seam, world, parentId: parent.id, today: dayD,
    lineageId: "LIN-TRAVEL-1", requestedFounders: requested,
    targetTileId: String(targetTile.id), successorBandId,
  }).departure;

  const departure = makeDeparture(`${parent.id}:provisional:1`);
  if (departure.ok !== true) throw new Error(`departure refused: ${departure.refusal} ${departure.detail ?? ""}`);
  const succId = String(departure.successorId);
  const startTile = String(departure.world.bands[succId].position);

  // ── V1 — the journey starts where the people were standing ──
  record(
    "V1_outbound_starts_on_the_parents_tile",
    "the successor begins its journey on the tile the founders physically left from, not at the destination — defect 2 was a daughter appearing 5 and 7 tiles away in a single day",
    startTile === String(parent.position) && startTile !== String(targetTile.id),
    true,
    { startTile, parentTile: String(parent.position), targetTile: String(targetTile.id), distanceToTarget: dist(targetTile) },
  );

  // ── walk the world one day at a time, recording every position ──
  let w = departure.world;
  const positions = [startTile];
  const phases = [departure.world.bands[succId].provisionalSuccessor.phase];
  let arrivedOnDay = null;
  for (let day = 1; day <= OBSERVE_DAYS; day += 1) {
    w = advance.advanceWorldByDays(w, 1);
    const b = w.bands[succId];
    if (b === undefined) break;
    const pos = String(b.position);
    if (pos !== positions[positions.length - 1]) positions.push(pos);
    const phase = b.provisionalSuccessor?.phase ?? null;
    if (phase !== phases[phases.length - 1]) phases.push(phase);
    if (arrivedOnDay === null && pos === String(targetTile.id)) arrivedOnDay = day;
  }
  const finalBand = w.bands[succId];

  // ── V2 — every completed edge is contiguous ──
  // SCALE-1 Task 4 can complete multiple adjacent edges in one day, so day-end snapshots
  // are no longer required to be one cell apart. The journey-local trail records each
  // completed edge origin and is the correct continuity surface.
  const currentTrail = finalBand?.provisionalSuccessor?.trail ?? [];
  const walkedSequence = [...currentTrail, ...(finalBand === undefined ? [] : [finalBand.position])];
  const nonContiguous = [];
  for (let i = 1; i < walkedSequence.length; i += 1) {
    const a = generate.getTile(w, walkedSequence[i - 1]);
    const b = generate.getTile(w, walkedSequence[i]);
    if (a === undefined || b === undefined) { nonContiguous.push({ from: walkedSequence[i - 1], to: walkedSequence[i], missing: true }); continue; }
    const d = Math.abs(a.coord.x - b.coord.x) + Math.abs(a.coord.y - b.coord.y);
    if (d !== 1) nonContiguous.push({ from: walkedSequence[i - 1], to: walkedSequence[i], manhattan: d });
  }
  record(
    "V2_every_step_is_contiguous",
    "every completed provisional transition in the canonical breadcrumb trail is exactly one graph edge; a single day may now complete several such edges",
    nonContiguous.length === 0,
    walkedSequence.length > 2,
    { dayEndPositions: positions, completedEdgeSequenceLength: walkedSequence.length, nonContiguous },
  );

  // ── V3 — every tile the group stood on physically admits people ──
  const impassableStops = positions.filter((id) => {
    const t = generate.getTile(w, id);
    return t === undefined || !passability.isBandPassableDestination(t);
  });
  record(
    "V3_the_group_never_stands_anywhere_it_could_not_walk",
    "world passability is a physical execution constraint on every step, so no position in the whole journey is a tile people cannot occupy",
    impassableStops.length === 0,
    positions.length > 1,
    { impassableStops },
  );

  // ── V4 — arrival produces a TRIAL, never a success ──
  const finalPhase = finalBand?.provisionalSuccessor?.phase ?? null;
  record(
    "V4_arrival_produces_establishing_not_stabilized",
    "reaching the destination earns only the right to try to live there; arrival supplies neither positive commitment nor stabilization authority",
    arrivedOnDay === null || (phases.includes("establishing") && !phases.includes("stabilized")),
    arrivedOnDay !== null,
    { arrivedOnDay, phaseTrail: phases, finalPhase, finalPosition: String(finalBand?.position ?? "gone") },
  );

  // ── V5 — the trail records completed physical ground and is bounded ──
  const trail = finalBand?.provisionalSuccessor?.trail ?? [];
  const trailPassable = trail.every((id) => {
    const tile = generate.getTile(w, id);
    return tile !== undefined && passability.isBandPassableDestination(tile);
  });
  record(
    "V5_the_trail_is_ground_actually_walked_and_is_bounded",
    "the retained trail contains completed physical edge origins only and remains bounded; unfinished edge progress is stored separately as a directed-edge time remainder",
    trailPassable && trail.length <= travel.TRAVEL_TRAIL_CAP,
    trail.length > 0,
    { trailLength: trail.length, cap: travel.TRAVEL_TRAIL_CAP, trailPassable, edgeRemainder: finalBand?.provisionalSuccessor?.travelEdgeRemainder ?? null, trail: trail.map(String) },
  );

  // ── V6 — pace responds to real burden ──
  //
  // The SAME band, differing only in the acute-risk movement term, is asked for a step. A hurt column
  // must not walk as often as a whole one.
  const base = departure.world.bands[succId];
  const hurt = {
    ...base,
    acuteRisk: { ...(base.acuteRisk ?? {}), activeEffect: { ...(base.acuteRisk?.activeEffect ?? {}), movementCautionBump: 0.95 } },
  };
  const wellStep = travel.advanceProvisionalTravel(departure.world, dayD + 1).steps.find((s) => s.bandId === succId);
  const hurtWorld = { ...departure.world, bands: { ...departure.world.bands, [succId]: hurt } };
  const hurtStep = travel.advanceProvisionalTravel(hurtWorld, dayD + 1).steps.find((s) => s.bandId === succId);
  record(
    "V6_pace_responds_to_real_burden",
    "an injured column is slower than a whole one — measured through the CANONICAL `deriveTravelPace` authority rather than a second pace model invented here",
    wellStep !== undefined && hurtStep !== undefined && hurtStep.kmPerActiveDay < wellStep.kmPerActiveDay,
    wellStep !== undefined && wellStep.kmPerActiveDay > 0,
    {
      whole: { kmPerActiveDay: wellStep?.kmPerActiveDay, edgeRemainingDays: wellStep?.edgeTravelTimeRemainingDays },
      injured: { kmPerActiveDay: hurtStep?.kmPerActiveDay, edgeRemainingDays: hurtStep?.edgeTravelTimeRemainingDays },
    },
  );

  // ── V7 — the travel authority is the ONLY thing that moved the group ──
  //
  // Measured by running the identical world WITHOUT the travel writer: the ordinary systems are all
  // still there, and the group must not move a tile.
  let noTravel = departure.world;
  const noTravelStart = String(noTravel.bands[succId].position);
  for (let day = 1; day <= 60; day += 1) {
    // Ordinary daily actions and the seasonal pipeline, with travel skipped: reproduced by stepping a
    // world whose successor is not in a travel phase, which is the only thing the writer reads.
    noTravel = advance.advanceWorldByDays(
      {
        ...noTravel,
        bands: {
          ...noTravel.bands,
          [succId]: {
            ...noTravel.bands[succId],
            provisionalSuccessor: { ...noTravel.bands[succId].provisionalSuccessor, phase: "establishing" },
          },
        },
      },
      1,
    );
  }
  record(
    "V7_no_ordinary_system_moves_a_provisional_group",
    "with the group held in a non-travel phase, sixty days of ordinary daily actions and seasonal processing move it exactly nowhere — so the position changes above are the travel authority's and nothing else's",
    String(noTravel.bands[succId]?.position ?? "gone") === noTravelStart,
    positions.length > 1,
    { startTile: noTravelStart, after60Days: String(noTravel.bands[succId]?.position ?? "gone"), travelArmDistinctPositions: positions.length },
  );

  // ── V8 — deterministic ──
  const again = makeDeparture(`${parent.id}:provisional:1`);
  let w2 = again.ok === true ? again.world : null;
  const positions2 = w2 === null ? [] : [String(w2.bands[succId].position)];
  if (w2 !== null) {
    for (let day = 1; day <= OBSERVE_DAYS; day += 1) {
      w2 = advance.advanceWorldByDays(w2, 1);
      const b = w2.bands[succId];
      if (b === undefined) break;
      const pos = String(b.position);
      if (pos !== positions2[positions2.length - 1]) positions2.push(pos);
    }
  }
  record(
    "V8_the_journey_is_deterministic",
    "two identical departures walk the identical sequence of tiles",
    JSON.stringify(positions) === JSON.stringify(positions2),
    positions.length > 1,
    { firstRunSteps: positions.length, secondRunSteps: positions2.length },
  );

  // ── V9 — PROVISIONAL SUBSISTENCE STAYS PHYSICAL AND OUTSIDE RESIDENTIAL ACCOUNTING ──
  const receipts = finalBand?.seasonalFoodReceipts === undefined ? 0 : 1;
  const subsistence = finalBand?.provisionalSuccessor?.travelSubsistence;
  const hungerFirst = base.hungerPressure;
  const hungerLast = finalBand?.hungerPressure ?? null;
  record(
    "V9_travel_support_is_physically_sourced_or_absent",
    "no ration, storage or capability appears from nothing — every support unit the group holds came from a real source that was really depleted, and a group that found nothing holds nothing",
    receipts === 0 && (finalBand?.storageCapacity ?? 0) === 0 &&
      (subsistence === undefined || subsistence.supportUnits <= 0 || subsistence.depletionApplied > 0),
    positions.length > 1,
    {
      residentialReceiptsDuringTravel: receipts,
      storageCapacity: finalBand?.storageCapacity ?? null,
      travelSupportUnits: subsistence?.supportUnits ?? null,
      travelDepletionApplied: subsistence?.depletionApplied ?? null,
      note: "travel receipts are successor-owned and live on the lifecycle record; `seasonalFoodReceipts` describes receipts from a residential camp, which a walking group does not have",
    },
  );

  // ── V10 — THE FINDING THIS AUDIT PUBLISHED IS NOW A GATE ────────────────────────────────────────
  //
  // The earlier form of this fixture RECORDED a defect it could not repair: a group with no camp, no
  // receipts and no way to forage walked its hunger down to zero, because `seasonalSupport` was reset
  // to absent by policy and `deriveCanonicalNutritionState` read absent as no stress. The group was
  // not measured as comfortable — it was never asked.
  //
  // The successor now departs MEASURED, carrying the samples its bodies actually lived, and its
  // hunger moves only when a physical source is really taken from. So the fixture that documented the
  // improvement now FORBIDS it: hunger may not fall over the journey unless support was physically
  // extracted, and the depletion is the proof it was.
  const earnedSupport = subsistence?.supportUnits ?? 0;
  const appliedDepletion = subsistence?.depletionApplied ?? 0;
  record(
    "V10_hunger_never_improves_without_physically_extracted_support",
    "the group's hunger over the journey may fall only if it physically took food from a real source and depleted it; walking is not eating",
    hungerLast === null || hungerLast >= hungerFirst || (earnedSupport > 0 && appliedDepletion > 0),
    hungerLast !== null,
    {
      hunger: { atDeparture: hungerFirst, atEnd: hungerLast },
      travelSupportUnits: earnedSupport,
      travelDepletionApplied: appliedDepletion,
      mechanism: "the departure seam supplies an opening measured interval from the founders' own lived samples, and provisionalTravelSubsistence closes further intervals from what the group physically extracted",
    },
  );

  const movedSteps = travel.advanceProvisionalTravel(departure.world, dayD + 1).steps;
  out = {
    generatedAt: new Date().toISOString(),
    seed: SEED, warmDays: WARM_DAYS, observeDays: OBSERVE_DAYS,
    parentId: String(parent.id), successorId: succId,
    targetTileId: String(targetTile.id),
    departureTileId: startTile,
    straightLineDistance: dist(targetTile),
    journey: { distinctPositions: positions.length, arrivedOnDay, path: positions, phaseTrail: phases },
    sampleStepRecord: movedSteps[0] ?? null,
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
console.log(JSON.stringify({ ...out.summary, journey: out.journey.distinctPositions, arrivedOnDay: out.journey.arrivedOnDay }, null, 2));
for (const f of out.fixtures) console.log(`${f.verdict.padEnd(7)} ${f.id}`);
if (out.summary.failing > 0 || out.summary.vacuous > 0) process.exitCode = 1;
