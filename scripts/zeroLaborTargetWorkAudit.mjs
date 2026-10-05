// CORRECTION-34F §4 — what does the EXPORTED target-work contract do when it is handed a labour
// count no party can have?
//
// CORRECTION-34E made `options.partyWorkers` required and removed the residential fallback. It did
// not constrain the VALUE. This probe asks the real production resolver what it does with zero,
// fractional, negative and non-finite labour, and — crucially — whether the world's stock changes.
//
// Arm-neutral: the identical file runs on both trees. Every case is wrapped, so a tree that throws
// and a tree that resolves both produce a comparable row instead of ending the run.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/shared-use-physical-presence-authority-34";
const PHASE = arg("phase", "before");
const OUT = arg("out", `${EVIDENCE}/zero-labor-target-work-${PHASE}.json`);

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c34f-${process.pid}`,
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

  // Same target-selection discipline as the CORRECTION-34E probe: production picks a real
  // remembered patch it actually harvests; the probe refuses to invent one.
  const living = Object.values(world.bands)
    .filter((b) => b.status !== "dispersed" && b.viability?.status !== "absorbed" && b.viability?.status !== "extinct")
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const FOOD_CLASSES = ["generic_plant_food", "animal_food", "aquatic_food", "fallback_food"];

  const party = (workers) => ({
    id: "e:zl", phase: "operating", partyWorkers: workers,
    partyComposition: { limited: 0, typical: Math.max(0, Math.round(workers) || 0), high: 0 },
    routeIndex: 1, taskKind: "distant_plant_gathering", injuryLoad: 0,
    travelDaysElapsed: 1, workDaysElapsed: 0, hardDeadlineDay: 9999,
    cargo: { harvestUnits: 0, carryCapacityUnits: 1, provisionUnitsConsumed: 0, lostUnits: 0 },
  });
  const mkBand = (b, t, route, workers) => ({
    ...b,
    demography: { ...b.demography, population: 45, workingAdults: 25, elders: 10, dependents: 10 },
    expeditions: [{ ...party(workers), positionTileId: t, routeTileIds: route, targetTileId: t }],
  });

  let base; let memory; let targetTileId; let route; let distanceTiles;
  outer:
  for (const b of living) {
    const mems = (b.resourceKnowledgeState?.patchMemories ?? [])
      .filter((x) => FOOD_CLASSES.includes(x.resourceClassId) && world.tiles[x.approximateTile] !== undefined)
      .sort((x, y) => String(x.patchId).localeCompare(String(y.patchId)));
    for (const m of mems) {
      const t = m.approximateTile;
      const r0 = [b.position, t];
      const d = Math.abs(world.tiles[t].coord.x - world.tiles[b.position].coord.x) +
        Math.abs(world.tiles[t].coord.y - world.tiles[b.position].coord.y);
      const probe = trips.resolveExpeditionTargetWork(
        world, mkBand(b, t, r0, 5), m, t, d, r0, day, "food_resource_check", { partyWorkers: 5 });
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

  // Stock is keyed by the SOURCE the resolver wrote, not by tile — the CORRECTION-34E instrument
  // correction. Reading it by tile measures nothing.
  const stockForSource = (w, sourceId) => {
    if (sourceId === undefined) return null;
    const pick = (store) => {
      if (store === undefined || store === null) return undefined;
      const entry = Array.isArray(store)
        ? store.find((x) => String(x?.patchId ?? x?.id ?? x?.sourceId) === String(sourceId))
        : store[sourceId];
      return entry === undefined ? undefined : JSON.stringify(entry);
    };
    return {
      plantPatchState: pick(w.plantPatchState) ?? null,
      faunaStockState: pick(w.faunaStockState) ?? null,
      aquaticStockState: pick(w.aquaticStockState) ?? null,
    };
  };
  // The same source id the valid five-worker resolution wrote, so a case that is REJECTED (and
  // therefore returns no record) can still have its stock compared against the same patch.
  const referenceSourceId = trips.resolveExpeditionTargetWork(
    world, mkBand(base, targetTileId, route, 5), memory, targetTileId, distanceTiles, route, day,
    "food_resource_check", { partyWorkers: 5 }).record.physicalFoodHarvest?.sourceId;

  const attempt = (label, workers, verifyOnly) => {
    const before = stockForSource(world, referenceSourceId);
    let result;
    try {
      const res = trips.resolveExpeditionTargetWork(
        world, mkBand(base, targetTileId, route, workers), memory, targetTileId, distanceTiles,
        route, day, "food_resource_check",
        verifyOnly ? { verifyOnly: true, partyWorkers: workers } : { partyWorkers: workers },
      );
      const r = res.record;
      const h = r.physicalFoodHarvest;
      const after = stockForSource(res.world, referenceSourceId);
      result = {
        accepted: true,
        threw: false,
        estimatedPeopleCount: r.estimatedPeopleCount ?? null,
        activityOutcome: r.activityOutcome ?? null,
        returnedResourceKind: r.resourceReturn?.returnedResourceKind ?? null,
        returnValueAfterHarvest: r.resourceReturn?.estimatedReturnValue ?? null,
        physicalSourceFound: h?.physicalSourceFound ?? null,
        physicalAvailability: h?.physicalAvailability ?? null,
        harvestedAmount: h?.harvestedAmount ?? null,
        depletionApplied: h?.depletionApplied ?? null,
        usableSupport: h?.usableSupport ?? null,
        // An observation is what a verification party carries home; the target-work authority
        // produces its raw material here.
        readTheTarget: h?.physicalSourceFound === true || (h?.physicalAvailability ?? 0) > 0,
        stockBefore: before, stockAfter: after,
        stockChangedAtTarget: JSON.stringify(before) !== JSON.stringify(after),
      };
    } catch (error) {
      result = {
        accepted: false,
        threw: true,
        errorMessage: String(error?.message ?? error).slice(0, 240),
        estimatedPeopleCount: null, activityOutcome: null, returnedResourceKind: null,
        returnValueAfterHarvest: null, physicalSourceFound: null, physicalAvailability: null,
        harvestedAmount: null, depletionApplied: null, usableSupport: null,
        readTheTarget: false,
        stockBefore: before, stockAfter: before, stockChangedAtTarget: false,
      };
    }
    return { case: label, partyWorkers: String(workers), verifyOnly: verifyOnly === true, ...result };
  };

  const cases = [
    attempt("Z1_zero_exploitation", 0, false),
    attempt("Z2_zero_verification", 0, true),
    attempt("Z3a_fractional_0_4", 0.4, false),
    attempt("Z3b_fractional_1_6", 1.6, false),
    attempt("Z4a_nan", Number.NaN, false),
    attempt("Z4b_infinity", Number.POSITIVE_INFINITY, false),
    attempt("Z4c_negative_infinity", Number.NEGATIVE_INFINITY, false),
    attempt("Z4d_negative_one", -1, false),
    attempt("Z6_one_worker", 1, false),
    attempt("Z7_two_workers", 2, false),
    attempt("Z8_five_workers", 5, false),
    attempt("Z10_verify_only_valid_party", 5, true),
  ];
  const byId = Object.fromEntries(cases.map((c) => [c.case, c]));

  const zero = byId.Z1_zero_exploitation;
  const zeroVerify = byId.Z2_zero_verification;
  const headline = zero.threw
    ? "ZERO LABOR REJECTED BEFORE WORK"
    : (zero.stockChangedAtTarget || (zero.depletionApplied ?? 0) > 0)
      ? "ZERO LABOR REMOVES PHYSICAL STOCK"
      : "ZERO LABOR ACCEPTED BUT REMOVED NO STOCK";

  out = {
    audit: "CORRECTION-34F-ZERO-LABOR-TARGET-WORK-CONTRACT",
    phase: PHASE,
    headline,
    verificationHeadline: zeroVerify.threw
      ? "ZERO LABOR CANNOT INSPECT THE TARGET"
      : zeroVerify.readTheTarget
        ? "ZERO LABOR READS THE TARGET THROUGH THE PARTY-WORK AUTHORITY"
        : "ZERO LABOR ACCEPTED BUT READ NOTHING",
    fractionalHeadline:
      byId.Z3a_fractional_0_4.threw && byId.Z3b_fractional_1_6.threw
        ? "FRACTIONAL PEOPLE REJECTED"
        : `FRACTIONAL PEOPLE SILENTLY ROUNDED (0.4 -> ${byId.Z3a_fractional_0_4.estimatedPeopleCount}, 1.6 -> ${byId.Z3b_fractional_1_6.estimatedPeopleCount})`,
    target: String(targetTileId),
    band: String(base.id),
    patchId: String(memory.patchId),
    sourceId: referenceSourceId === undefined ? null : String(referenceSourceId),
    distanceTiles,
    chain: "resolveExpeditionTargetWork -> buildTripRecord -> resolvePhysicalFoodHarvest (real production)",
    cases: byId,
    contractSummary: {
      rejectedCases: cases.filter((c) => c.threw).map((c) => c.case),
      acceptedCases: cases.filter((c) => !c.threw).map((c) => c.case),
      casesRemovingStockWithoutAValidPositiveIntegerParty: cases
        .filter((c) => !c.threw && !(Number.isInteger(Number(c.partyWorkers)) && Number(c.partyWorkers) > 0))
        .filter((c) => c.stockChangedAtTarget || (c.depletionApplied ?? 0) > 0)
        .map((c) => c.case),
    },
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
} finally {
  await server.close();
}

console.log(JSON.stringify({
  phase: out.phase,
  headline: out.headline,
  verificationHeadline: out.verificationHeadline,
  fractionalHeadline: out.fractionalHeadline,
  rejected: out.contractSummary.rejectedCases,
  removingStockWithoutValidParty: out.contractSummary.casesRemovingStockWithoutAValidPositiveIntegerParty,
  Z1: { people: out.cases.Z1_zero_exploitation.estimatedPeopleCount, outcome: out.cases.Z1_zero_exploitation.activityOutcome, depletion: out.cases.Z1_zero_exploitation.depletionApplied, stockChanged: out.cases.Z1_zero_exploitation.stockChangedAtTarget },
  Z2: { readTheTarget: out.cases.Z2_zero_verification.readTheTarget, depletion: out.cases.Z2_zero_verification.depletionApplied },
  Z6: { people: out.cases.Z6_one_worker.estimatedPeopleCount, depletion: out.cases.Z6_one_worker.depletionApplied },
  Z7: { people: out.cases.Z7_two_workers.estimatedPeopleCount },
  Z8: { people: out.cases.Z8_five_workers.estimatedPeopleCount },
}, null, 2));
