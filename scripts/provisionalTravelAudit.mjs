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
  const makeDeparture = (successorBandId) => seam.performAtomicDeparture({
    world: {
      ...world,
      bands: {
        ...world.bands,
        [parent.id]: {
          ...parent,
          fissionAttempt: {
            phase: "departure_ready", phaseEnteredDay: dayD - 5, history: ["proposed", "committed"],
            lineageId: "LIN-TRAVEL-1", requestedFounders: requested, targetTileId: String(targetTile.id),
          },
        },
      },
    },
    parentId: parent.id, today: dayD,
    residualContext: {
      physicallyAwayPeople: 0, physicallyAwayWorkers: 0, preparedCommitmentWorkers: 0,
      foodDemographicPressure: 0, chronicFoodStress: 0, chronicDeficitStreak: 0, nutritionMeasured: true,
      acuteRiskSeverity: 0, sicknessBurden: 0, careTravelBurden: 0, embodiedConditionMeasured: true,
      ecologicalRisk: 0, ecologicalPositionMeasured: true,
      mobilityCapabilityBefore: 1, mobilityCapabilityAfter: 1, minimumFounderRequest: 2,
    },
    successorBandId, lineageId: "LIN-TRAVEL-1",
  });

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

  // ── V2 — every step is contiguous ──
  const nonContiguous = [];
  for (let i = 1; i < positions.length; i += 1) {
    const a = generate.getTile(w, positions[i - 1]);
    const b = generate.getTile(w, positions[i]);
    const d = Math.abs(a.coord.x - b.coord.x) + Math.abs(a.coord.y - b.coord.y);
    if (d !== 1) nonContiguous.push({ from: positions[i - 1], to: positions[i], manhattan: d });
  }
  record(
    "V2_every_step_is_contiguous",
    "consecutive positions are always exactly one tile apart — the group walks rather than appearing somewhere",
    nonContiguous.length === 0,
    positions.length > 2,
    { distinctPositions: positions.length, nonContiguous, path: positions },
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
    "reaching the destination earns only the right to try to live there; `stabilized` still demands lived evidence and is never produced by arriving",
    arrivedOnDay === null || (phases.includes("establishing") && !phases.includes("stabilized")),
    arrivedOnDay !== null,
    { arrivedOnDay, phaseTrail: phases, finalPhase, finalPosition: String(finalBand?.position ?? "gone") },
  );

  // ── V5 — the trail records ground actually walked, and is bounded ──
  const trail = finalBand?.provisionalSuccessor?.trail ?? [];
  const trailIsPrefixOfPath = trail.every((id, i) => String(id) === positions[i]);
  record(
    "V5_the_trail_is_ground_actually_walked_and_is_bounded",
    "the retained trail is the sequence of tiles the group physically left, capped so a long journey cannot grow unbounded state — it is what a return retraces instead of re-deriving a route the group never had",
    trailIsPrefixOfPath && trail.length <= travel.TRAVEL_TRAIL_CAP,
    trail.length > 0,
    { trailLength: trail.length, cap: travel.TRAVEL_TRAIL_CAP, trailIsPrefixOfPath, trail: trail.map(String) },
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
    wellStep !== undefined && hurtStep !== undefined && hurtStep.daysPerTile >= wellStep.daysPerTile &&
      hurtStep.kmPerActiveDay < wellStep.kmPerActiveDay,
    wellStep !== undefined && wellStep.kmPerActiveDay > 0,
    {
      whole: { kmPerActiveDay: wellStep?.kmPerActiveDay, daysPerTile: wellStep?.daysPerTile },
      injured: { kmPerActiveDay: hurtStep?.kmPerActiveDay, daysPerTile: hurtStep?.daysPerTile },
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

  // ── V9 — TRAVEL SUBSISTENCE IS NOT IMPLEMENTED, AND THAT IS STATED RATHER THAN HIDDEN ──
  //
  // A walking group cannot run ordinary same-day trips (the quarantine blocks them, correctly — it has
  // no camp to run them from), and no route-foraging authority exists yet. So travel currently produces
  // NO food and consumes no travel-specific ration. The direction of that error matters and is the
  // reason it is acceptable as an interim: the group is HARSHER off, never freer. Its hunger still
  // rises through ordinary nutrition, and nothing here creates support from nothing.
  const receipts = finalBand?.seasonalFoodReceipts === undefined ? 0 : 1;
  const hungerFirst = base.hungerPressure;
  const hungerLast = finalBand?.hungerPressure ?? null;
  record(
    "V9_travel_creates_no_material_capability",
    "no receipt, no storage and no ration appears during the journey — travel subsistence is UNBUILT and is not faked",
    receipts === 0 && (finalBand?.storageCapacity ?? 0) === 0,
    positions.length > 1,
    {
      receiptsDuringTravel: receipts,
      storageCapacity: finalBand?.storageCapacity ?? null,
      NOT_IMPLEMENTED: "route foraging by the travelling bodies, and a physically debited carried provision stock; both need an authority that does not exist yet and neither is faked here",
    },
  );

  // ── V10 — FINDING: A WALKING GROUP GETS LESS HUNGRY, AND THE CAUSE IS AN ABSENCE READ AS ZERO ──
  //
  // Caught by this audit rather than by reading the code, and it inverts the claim an earlier form of
  // V9 made. `hungerPressure` has three real writers and every one derives it from the band's
  // `seasonalSupport` through the canonical nutrition state. The transfer policy resets
  // `seasonalSupport` to ABSENT — correctly, because it is a history of seasons this group did not
  // live as itself — and `deriveCanonicalNutritionState` reads absent as NO STRESS.
  //
  // So the reset that exists to prevent an unearned INHERITANCE produces an unearned IMPROVEMENT: a
  // group with no camp, no receipts and no way to forage walks its hunger down to zero. It is the same
  // shape as the `cause` field this pass made required — an absence read as permission — and it is an
  // L2 violation appearing in a place L2 was not previously looked for.
  //
  // NOT REPAIRED HERE. The honest fix is a real travel subsistence authority: bodies that eat what they
  // physically gather on the route, or a stock debited from a real source before departure. Both need
  // authorities that do not exist, and inventing a hunger floor instead would be a tuned number
  // standing in for a mechanism.
  record(
    "V10_FINDING_hunger_improves_during_travel_because_absent_support_reads_as_no_stress",
    "the group's hunger FALLS while it walks with nothing to eat, because its `seasonalSupport` is absent by policy and the canonical nutrition derivation treats absent as unstressed — an unearned improvement produced by a correct reset",
    true, // a published finding, not a gate — see the note above
    hungerLast !== null,
    {
      status: (hungerLast !== null && hungerLast < hungerFirst) ? "REPRODUCED" : "NOT_REPRODUCED_IN_THIS_WINDOW",
      hunger: { atDeparture: hungerFirst, atEnd: hungerLast },
      mechanism: "Band.seasonalSupport is INVALIDATE_UNTIL_LATER_PHASE (absent); all three hungerPressure writers derive it from that support through deriveCanonicalNutritionState, which reads absent as no stress",
      whyNotRepairedHere: "the fix is a travel subsistence authority (route foraging, or a debited carried stock); a hunger floor would be a tuned number standing in for a mechanism",
      consequence: "travel is currently EASIER than standing still, which is the opposite of the interim this pass wanted, and it is the blocking item for the travel-subsistence work",
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
