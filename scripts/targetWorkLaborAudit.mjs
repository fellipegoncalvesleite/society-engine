// CORRECTION-34E §3 — does an expedition's target work use the party standing there, or the
// workers who stayed home?
//
// Runs the REAL production chain, not private arithmetic:
//   resolveExpeditionTargetWork -> buildTripRecord -> resolvePhysicalFoodHarvest
// and inspects the returned record AND the physical stock change in the returned world.
//
// Arm-neutral: identical on both trees. `--phase` only labels the output file. On the before arm
// the party's productive labour cannot be passed at all (no such parameter exists), which is
// itself the finding; the probe detects that and says so rather than pretending to vary it.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/shared-use-physical-presence-authority-34";
const PHASE = arg("phase", "before");
const OUT = arg("out", `${EVIDENCE}/target-work-labor-${PHASE}.json`);

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c34e-tw-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const trips = await server.ssrLoadModule("/sim/agents/intraSeasonTrips.ts");

  let world = runner.initSimWorld({ kind: "map2" }, "c34e:targetwork");
  world = advance.advanceWorldByDays(world, 360 * 2);
  const day = Number(world.time.day);

  // ── A REAL band and a REAL target that production ACTUALLY harvests ─────────────────────────
  // Hand-building a `ResourcePatchMemory` is unsafe (its confidences live in a nested profile) and
  // picking a remembered tile is not enough — a band can remember a patch that is physically
  // absent, which resolves as `physical_source_absent` with a zero take and would make the whole
  // comparison vacuous. The probe therefore TRIAL-RESOLVES candidates through production and keeps
  // the first that yields a real physical source with non-zero availability. Production selects
  // the fixture; the probe only refuses to invent one.
  const living = Object.values(world.bands)
    .filter((b) => b.status !== "dispersed" && b.viability?.status !== "absorbed" && b.viability?.status !== "extinct")
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));

  const FOOD_CLASSES = ["generic_plant_food", "animal_food", "aquatic_food", "fallback_food"];
  const trialBand = (b, exp) => ({
    ...b,
    demography: { ...b.demography, population: 45, workingAdults: 30, elders: 5, dependents: 5 },
    expeditions: [exp],
  });
  const trialParty = (t, route) => ({
    id: "e:trial", phase: "operating", partyWorkers: 5,
    partyComposition: { limited: 0, typical: 5, high: 0 },
    positionTileId: t, routeTileIds: route, routeIndex: 1, targetTileId: t,
    taskKind: "distant_plant_gathering", injuryLoad: 0,
    travelDaysElapsed: 1, workDaysElapsed: 0, hardDeadlineDay: 9999,
    cargo: { harvestUnits: 0, carryCapacityUnits: 1, provisionUnitsConsumed: 0, lostUnits: 0 },
  });

  let base;
  let memory;
  let targetTileId;
  let route;
  let distanceTiles;
  let selectionTrials = 0;

  outer:
  for (const b of living) {
    const mems = (b.resourceKnowledgeState?.patchMemories ?? [])
      .filter((x) => FOOD_CLASSES.includes(x.resourceClassId) && world.tiles[x.approximateTile] !== undefined)
      .sort((x, y) => String(x.patchId).localeCompare(String(y.patchId)));
    for (const m of mems) {
      const t = m.approximateTile;
      const r0 = [b.position, t];
      const tt = world.tiles[t];
      const bt = world.tiles[b.position];
      const d = Math.abs(tt.coord.x - bt.coord.x) + Math.abs(tt.coord.y - bt.coord.y);
      selectionTrials += 1;
      const probe = trips.resolveExpeditionTargetWork(
        world, trialBand(b, trialParty(t, r0)), m, t, d, r0, day, "food_resource_check",
        { partyWorkers: 5 },
      );
      const h = probe.record.physicalFoodHarvest;
      if (h?.physicalSourceFound === true && (h.physicalAvailability ?? 0) > 0 &&
          (probe.record.resourceReturn?.estimatedReturnValue ?? 0) > 0) {
        base = b; memory = m; targetTileId = t; route = r0; distanceTiles = d;
        break outer;
      }
    }
  }

  if (base === undefined) {
    throw new Error("no band holds a remembered patch that production physically harvests — the probe refuses to fabricate one");
  }

  // Physical stock at the target. Tiles carry no stock field, so the world-level stores are read
  // by identity and hashed; `depletionApplied` on the harvest record is reported alongside it.
  const stockAt = (w) => {
    const pick = (store) => {
      if (store === undefined || store === null) return null;
      const entry = Array.isArray(store)
        ? store.find((x) => String(x?.tileId ?? x?.approximateTile) === String(targetTileId))
        : store[targetTileId];
      return entry === undefined ? null : JSON.stringify(entry);
    };
    return {
      depletionStore: pick(w.depletion ?? w.tileDepletion),
      plantStore: pick(w.plantPatches ?? w.plantPatchState),
      faunaStore: pick(w.faunaStocks ?? w.faunaStockState),
    };
  };

  // The band under test: `workingAdults` is the RESIDENTIAL labour cohort, and the expedition
  // record carries the party. Everything else is held identical.
  const party = (workers, nonWorking) => ({
    id: "e:tw", phase: "operating", partyWorkers: workers,
    ...(nonWorking > 0 ? { nonWorkingPartyPeople: nonWorking } : {}),
    partyComposition: { limited: 0, typical: workers, high: 0 },
    positionTileId: targetTileId, routeTileIds: route, routeIndex: 1,
    targetTileId, taskKind: "distant_plant_gathering", injuryLoad: 0,
    travelDaysElapsed: 1, workDaysElapsed: 0, hardDeadlineDay: 9999,
    cargo: { harvestUnits: 0, carryCapacityUnits: 1, provisionUnitsConsumed: 0, lostUnits: 0 },
  });
  const mkBand = (workingAdults, workers, nonWorking) => ({
    ...base,
    demography: {
      ...base.demography,
      population: workingAdults + 10 + workers + nonWorking,
      workingAdults, elders: 5, dependents: 5,
    },
    expeditions: [party(workers, nonWorking)],
  });

  // Does the production resolver accept a party-labour authority at all?
  // Detect by BEHAVIOUR, not by arity, and stay valid on BOTH trees. Resolve the identical party
  // once WITHOUT the party-labour option: the before arm silently ignores it and returns a
  // residentially-derived count; the after arm refuses to resolve at all. Either answer identifies
  // the tree without the probe assuming which one it is on.
  let acceptsPartyLabour;
  let refusesWithoutPartyLabour = false;
  try {
    const capA = trips.resolveExpeditionTargetWork(
      world, mkBand(30, 5, 0), memory, targetTileId, distanceTiles, route, day, "food_resource_check").record;
    const capB = trips.resolveExpeditionTargetWork(
      world, mkBand(30, 5, 0), memory, targetTileId, distanceTiles, route, day, "food_resource_check",
      { partyWorkers: 5 }).record;
    acceptsPartyLabour = capA.estimatedPeopleCount !== capB.estimatedPeopleCount;
  } catch {
    // The resolver will not resolve expedition work without being told who is working.
    acceptsPartyLabour = true;
    refusesWithoutPartyLabour = true;
  }

  // One measurement through the real chain.
  const measure = (band, opts) => {
    const before = stockAt(world);
    const res = trips.resolveExpeditionTargetWork(
      world, band, memory, targetTileId,
      distanceTiles, route, day, "food_resource_check",
      opts,
    );
    const r = res.record;
    const after = stockAt(res.world);
    const h = r.physicalFoodHarvest;
    return {
      estimatedPeopleCount: r.estimatedPeopleCount,
      activityOutcome: r.activityOutcome,
      estimatedReturnValue: r.resourceReturn?.estimatedReturnValue ?? null,
      returnedResourceKind: r.resourceReturn?.returnedResourceKind ?? null,
      requestedAmount: r.resourceReturn?.estimatedReturnValue ?? null,
      physicalSourceFound: h?.physicalSourceFound ?? null,
      physicalAvailability: h?.physicalAvailability ?? null,
      harvestedAmount: h?.harvestedAmount ?? null,
      depletionApplied: h?.depletionApplied ?? null,
      transportLoss: h?.transportLoss ?? null,
      processingLoss: h?.processingLoss ?? null,
      usableSupport: h?.usableSupport ?? null,
      shadowPeople: r.shadowSubsistence?.peopleCount ?? null,
      stockBefore: before, stockAfter: after,
      stockChangedAtTarget: JSON.stringify(before) !== JSON.stringify(after),
    };
  };

  const partyOpts = (workers) => ({ partyWorkers: workers });

  // ── W1 — same party, different residential labour ───────────────────────────────────────────
  const w1Low = measure(mkBand(6, 5, 0), partyOpts(5));    // 6 adults, 5 away -> 1 at home
  const w1High = measure(mkBand(30, 5, 0), partyOpts(5));  // 30 adults, 5 away -> 25 at home
  const w1Invariant =
    w1Low.estimatedPeopleCount === w1High.estimatedPeopleCount &&
    w1Low.estimatedReturnValue === w1High.estimatedReturnValue &&
    w1Low.harvestedAmount === w1High.harvestedAmount &&
    w1Low.depletionApplied === w1High.depletionApplied;

  // ── W2 — same residence, different productive party labour ──────────────────────────────────
  // Residential labour is held at 10 in both arms: 12 adults with a 2-worker party, and 15 adults
  // with a 5-worker party, both leave 10 at home.
  const w2Small = measure(mkBand(12, 2, 0), partyOpts(2));
  const w2Large = measure(mkBand(15, 5, 0), partyOpts(5));
  const w2Sensitive =
    w2Small.estimatedPeopleCount !== w2Large.estimatedPeopleCount &&
    w2Large.estimatedPeopleCount > w2Small.estimatedPeopleCount;

  // ── W3 — productive labour vs physical headcount ────────────────────────────────────────────
  const w3A = measure(mkBand(15, 5, 0), partyOpts(5));   // 5 workers, 0 non-working, 5 bodies
  const w3B = measure(mkBand(15, 5, 2), partyOpts(5));   // 5 workers, 2 non-working, 7 bodies
  const w3WorkEqual =
    w3A.estimatedPeopleCount === w3B.estimatedPeopleCount &&
    w3A.estimatedReturnValue === w3B.estimatedReturnValue &&
    w3A.harvestedAmount === w3B.harvestedAmount;

  // ── Headlines ───────────────────────────────────────────────────────────────────────────────
  const w1Headline = w1Invariant
    ? "TARGET WORK IS INVARIANT TO RESIDENTIAL LABOR"
    : "DISTANT WORK CHANGES WHEN HOME LABOR CHANGES";
  const w2Headline = w2Sensitive
    ? "TARGET WORK FOLLOWS PARTY PRODUCTIVE LABOR"
    : "PARTY PRODUCTIVE LABOR IS INERT AT ITS OWN TARGET";

  out = {
    audit: "CORRECTION-34E-EXPEDITION-TARGET-WORK-LABOR",
    phase: PHASE,
    productionAcceptsPartyLabourAuthority: acceptsPartyLabour,
    productionRefusesToResolveWithoutPartyLabour: refusesWithoutPartyLabour,
    target: String(targetTileId),
    band: String(base.id),
    patchId: String(memory.patchId),
    distanceTiles,
    memoryPresenceConfidence: memory.confidence.presenceConfidence,
    memoryYieldConfidence: memory.confidence.yieldConfidence,
    chain: "resolveExpeditionTargetWork -> buildTripRecord -> resolvePhysicalFoodHarvest (real production)",
    headlines: { W1: w1Headline, W2: w2Headline },
    W1_same_party_different_residential_labor: {
      arms: {
        residentialAdultsAtHome_1: { workingAdults: 6, partyWorkers: 5, ...w1Low },
        residentialAdultsAtHome_25: { workingAdults: 30, partyWorkers: 5, ...w1High },
      },
      invariant: w1Invariant,
      note: "the party, its composition, its cargo, the target, the route, the season, the memory and the world stock are identical; ONLY the adults left at the residence differ",
    },
    W2_same_residence_different_party_labor: {
      arms: {
        party_2_workers: { workingAdults: 12, residentialAfterCommitment: 10, partyWorkers: 2, ...w2Small },
        party_5_workers: { workingAdults: 15, residentialAfterCommitment: 10, partyWorkers: 5, ...w2Large },
      },
      partyLabourChangesWork: w2Sensitive,
      note: "residential labour after commitment is 10 in BOTH arms, so any difference is attributable to the party",
    },
    W3_productive_labor_vs_physical_headcount: {
      arms: {
        A_5workers_0nonworking_5bodies: w3A,
        B_5workers_2nonworking_7bodies: w3B,
      },
      targetWorkEqual: w3WorkEqual,
      note: "non-working bodies must not increase the take; consumption and pace burden are measured separately by the CORRECTION-34D fixtures",
    },
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
} finally {
  await server.close();
}

console.log(JSON.stringify({
  phase: out.phase,
  productionAcceptsPartyLabourAuthority: out.productionAcceptsPartyLabourAuthority,
  productionRefusesToResolveWithoutPartyLabour: out.productionRefusesToResolveWithoutPartyLabour,
  headlines: out.headlines,
  W1: {
    home1: out.W1_same_party_different_residential_labor.arms.residentialAdultsAtHome_1.estimatedPeopleCount,
    home25: out.W1_same_party_different_residential_labor.arms.residentialAdultsAtHome_25.estimatedPeopleCount,
    request1: out.W1_same_party_different_residential_labor.arms.residentialAdultsAtHome_1.estimatedReturnValue,
    request25: out.W1_same_party_different_residential_labor.arms.residentialAdultsAtHome_25.estimatedReturnValue,
    harvest1: out.W1_same_party_different_residential_labor.arms.residentialAdultsAtHome_1.harvestedAmount,
    harvest25: out.W1_same_party_different_residential_labor.arms.residentialAdultsAtHome_25.harvestedAmount,
    depletion1: out.W1_same_party_different_residential_labor.arms.residentialAdultsAtHome_1.depletionApplied,
    depletion25: out.W1_same_party_different_residential_labor.arms.residentialAdultsAtHome_25.depletionApplied,
  },
  W2: {
    party2: out.W2_same_residence_different_party_labor.arms.party_2_workers.estimatedPeopleCount,
    party5: out.W2_same_residence_different_party_labor.arms.party_5_workers.estimatedPeopleCount,
  },
  W3: { targetWorkEqual: out.W3_productive_labor_vs_physical_headcount.targetWorkEqual },
}, null, 2));
