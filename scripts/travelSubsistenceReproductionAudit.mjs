// ROADMAP ITEM 4 STAGE A §4 — WHY WALKING ON NOTHING MAKES A GROUP LESS HUNGRY.
//
// The previous pass PUBLISHED this defect and did not repair it. This probe reproduces it on a REAL
// departure from a REAL warmed world, and then follows the chain link by link until it reaches a
// bodily consequence, so the repair can be aimed at the link that is actually wrong rather than at
// the number that is visibly wrong.
//
// The distinction the whole thing turns on:
//
//   current founder-experienced hunger
//     != parent-wide seasonal support history
//     != the successor's first unmeasured interval
//     != zero stress
//     != physical travel support
//
// Four different quantities. Production collapses the middle three into one neutral reading.
import { createServer } from "vite";
import { prepareAndDepart, bestKnownTargetAtDistance } from "./lib/preparedDeparture.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/dynamic-fission-daughter-viability-37";
const OUT = arg("out", `${EVIDENCE}/travel-subsistence-reproduction.json`);
const SEED = arg("seed", "audit27:natural:s1");
const WARM_DAYS = Number(arg("warm-days", "2100"));
const OBSERVE_DAYS = Number(arg("observe-days", "60"));

const findings = [];
const record = (id, claim, observed, detail) => {
  findings.push({ id, claim, observed, detail });
};

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-i4sub-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const seam = await server.ssrLoadModule("/sim/agents/fissionDepartureSeam.ts");
  const prep = await server.ssrLoadModule("/sim/agents/fissionDeparturePreparation.ts");
  const generate = await server.ssrLoadModule("/sim/world/generate.ts");
  const passability = await server.ssrLoadModule("/sim/world/passability.ts");
  const lc = await server.ssrLoadModule("/sim/agents/bandLifecycle.ts");
  const survival = await server.ssrLoadModule("/sim/agents/seasonalSurvival.ts");
  const receipts = await server.ssrLoadModule("/sim/agents/seasonalFoodReceipts.ts");
  const ledger = await server.ssrLoadModule("/sim/agents/humanFoodSupport.ts");
  const policy = await server.ssrLoadModule("/sim/agents/fissionFieldTransferPolicy.ts");

  let world = runner.initSimWorld({ kind: "map2" }, SEED);
  world = advance.advanceWorldByDays(world, WARM_DAYS);

  // A parent that is ACTUALLY HUNGRY. A well-fed parent would make the reproduction vacuous — the
  // relief would be a fall from zero to zero.
  const candidates = Object.values(world.bands)
    .filter((b) => lc.isEstablishedBand(b) && b.demography.workingAdults >= 6 && b.demography.population >= 24)
    .map((b) => ({ band: b, nutrition: survival.deriveCanonicalNutritionState(b.seasonalSupport) }))
    .sort((a, b) => b.nutrition.foodMovementPressure - a.nutrition.foodMovementPressure);
  const chosen = candidates[0];
  if (chosen === undefined) throw new Error("no suitable parent band");
  const parent = chosen.band;

  const here = generate.getTile(world, parent.position);
  const dist = (t) => Math.abs(t.coord.x - here.coord.x) + Math.abs(t.coord.y - here.coord.y);
  // Best-KNOWN at distance, not farthest/nearest: the founder cohort refuses ground it has barely
  // seen (`destination_barely_known`), which is a real decision rather than a gate to route around.
  const targetTile = bestKnownTargetAtDistance(generate, passability, world, parent, 6);
  if (targetTile === undefined) throw new Error("no known passable target at distance >= 6");

  const dayD = Number(world.time.day ?? 0);
  const requested = Math.max(2, Math.floor(parent.demography.population * 0.35));
  const departure = prepareAndDepart({
    prep, seam, world: world, parentId: parent.id, today: dayD,
    lineageId: "LIN-SUBSIST-1", requestedFounders: requested, targetTileId: String(targetTile.id),
    successorBandId: `${parent.id}:provisional:1`,
  }).departure;
  if (departure.ok !== true) throw new Error(`departure refused: ${departure.refusal} ${departure.detail ?? ""}`);
  const succId = String(departure.successorId);

  const readNutrition = (band) => {
    const seasonal = survival.deriveCanonicalNutritionState(band?.seasonalSupport);
    const annual = survival.deriveAnnualNutritionState(band?.seasonalSupport);
    return {
      seasonalSupportPresent: band?.seasonalSupport !== undefined,
      nutritionStateAvailable: seasonal.nutritionStateAvailable,
      currentFoodStress: seasonal.currentFoodStress,
      recentFoodStress: seasonal.recentFoodStress,
      chronicFoodStress: seasonal.chronicFoodStress,
      foodMovementPressure: seasonal.foodMovementPressure,
      foodDemographicPressure: seasonal.foodDemographicPressure,
      annualFoodDemographicPressure: annual.foodDemographicPressure,
      canonicalFoodStress: band === undefined ? null : survival.getCanonicalFoodStress(band),
      legacyHungerPressure: band?.hungerPressure ?? null,
      seasonalReceiptsPresent: band?.seasonalFoodReceipts !== undefined,
      receiptUsableSupport: band?.seasonalFoodReceipts?.totalUsableSupport ?? 0,
    };
  };

  const parentBefore = readNutrition(parent);
  const successorAtBirth = readNutrition(departure.world.bands[succId]);

  // ── LINK 1 — the founders leave a hungry camp ──
  record(
    "L1_the_founders_leave_a_hungry_camp",
    "the parent this group left had a MEASURED food deficit; the founders are the same bodies, so nothing physical about walking away addressed it",
    { parentFoodMovementPressure: parentBefore.foodMovementPressure },
    { parentBefore, parentBandId: String(parent.id), targetTileId: String(targetTile.id), distance: dist(targetTile) },
  );

  // ── LINK 2 — the transfer policy resets seasonalSupport, correctly ──
  record(
    "L2_the_transfer_policy_resets_the_support_history_and_is_right_to",
    "`seasonalSupport` is classified INVALIDATE_UNTIL_LATER_PHASE: it is a history of seasons this group did not live as itself, so INHERITING it would be an unearned inheritance",
    {
      transferClass: policy.FISSION_FIELD_TRANSFER_POLICY?.seasonalSupport?.transferClass ?? "unknown",
      successorValue: policy.FISSION_FIELD_TRANSFER_POLICY?.seasonalSupport?.successorValue ?? "unknown",
      successorSeasonalSupportPresent: successorAtBirth.seasonalSupportPresent,
      hungerPressureTransferClass: policy.FISSION_FIELD_TRANSFER_POLICY?.hungerPressure?.transferClass ?? "unknown",
      carriedEmbodiedHunger: successorAtBirth.legacyHungerPressure,
    },
    { entry: policy.FISSION_FIELD_TRANSFER_POLICY?.seasonalSupport ?? null },
  );

  // ── LINK 3 — the absent history is READ AS NO STRESS ──
  const unmeasured = survival.deriveCanonicalNutritionState(undefined);
  const inherited = survival.deriveCanonicalNutritionState(parent.seasonalSupport);
  record(
    "L3_an_unmeasured_state_is_read_as_zero_stress",
    "`deriveCanonicalNutritionState(undefined)` returns every stress term at 0 and flags `nutritionStateAvailable: false` — the flag is published and the ZEROS are what every reader consumes",
    {
      unmeasuredFoodMovementPressure: unmeasured.foodMovementPressure,
      unmeasuredNutritionStateAvailable: unmeasured.nutritionStateAvailable,
      hadItInheritedInstead: inherited.foodMovementPressure,
      reliefDelta: Number((inherited.foodMovementPressure - unmeasured.foodMovementPressure).toFixed(4)),
    },
    { unmeasured, inherited },
  );

  // ── LINK 4 — WHO ACTUALLY READS THE ZERO. Measured, not asserted. ──
  //
  // Each reader is called twice on states differing ONLY in `seasonalSupport` (absent vs the parent's
  // measured history). A reader that moves is a reader that consumes the unearned relief.
  const withHistory = { ...departure.world.bands[succId], seasonalSupport: parent.seasonalSupport };
  const withoutHistory = departure.world.bands[succId];
  const readerProbes = [
    {
      reader: "seasonalSurvival.getCanonicalFoodStress",
      consumer: "movement pressure / decision scoring / campMovement / socialContext",
      without: survival.getCanonicalFoodStress(withoutHistory),
      with: survival.getCanonicalFoodStress(withHistory),
    },
    {
      reader: "seasonalSurvival.deriveAnnualNutritionState.foodDemographicPressure",
      consumer: "demography.ts annual vital rates (fertility + mortality)",
      without: survival.deriveAnnualNutritionState(withoutHistory.seasonalSupport).foodDemographicPressure,
      with: survival.deriveAnnualNutritionState(withHistory.seasonalSupport).foodDemographicPressure,
    },
    {
      reader: "seasonalSurvival.deriveCanonicalNutritionState.chronicFoodStress",
      consumer: "viability.ts derived viability + collapse",
      without: survival.deriveCanonicalNutritionState(withoutHistory.seasonalSupport).chronicFoodStress,
      with: survival.deriveCanonicalNutritionState(withHistory.seasonalSupport).chronicFoodStress,
    },
    {
      reader: "band.seasonalSupport.hungerClassification",
      consumer: "storageSuitability / campFoothold / bandChronicle / resourceEcologyFoundation",
      without: withoutHistory.seasonalSupport?.hungerClassification ?? "absent",
      with: withHistory.seasonalSupport?.hungerClassification ?? "absent",
    },
    {
      reader: "band.seasonalSupport.currentSeasonSupport.waterStress",
      consumer: "demography water mortality term / campFoothold",
      without: withoutHistory.seasonalSupport?.currentSeasonSupport?.waterStress ?? 0,
      with: withHistory.seasonalSupport?.currentSeasonSupport?.waterStress ?? 0,
    },
  ];
  record(
    "L4_the_readers_that_consume_the_zero",
    "every reader below returns a DIFFERENT value for the same band depending only on whether a support history exists; absence is therefore not inert, it is a positive claim of comfort",
    { readersMoved: readerProbes.filter((p) => String(p.with) !== String(p.without)).length, total: readerProbes.length },
    readerProbes,
  );

  // ── LINK 5 — the group walks, and there is no physical support anywhere ──
  let w = departure.world;
  const daily = [];
  for (let day = 1; day <= OBSERVE_DAYS; day += 1) {
    w = advance.advanceWorldByDays(w, 1);
    const b = w.bands[succId];
    if (b === undefined) break;
    const n = readNutrition(b);
    // §9 — THE DAILY TRAVEL LEDGER. Every quantity the brief requires for a controlled travel day,
    // read off production state rather than recomputed by the instrument.
    const sub = b.provisionalSuccessor?.travelSubsistence;
    const today = sub?.recentDays?.[sub.recentDays.length - 1];
    daily.push({
      day,
      tileId: String(b.position),
      phase: b.provisionalSuccessor?.phase ?? null,
      population: Math.round(b.demography.population),
      workingAdults: Math.round(b.demography.workingAdults),
      dependents: Math.round(b.demography.dependents),
      elders: Math.round(b.demography.elders),
      foodMovementPressure: n.foodMovementPressure,
      seasonalSupportPresent: n.seasonalSupportPresent,
      gatherShare: today?.gatherShare ?? null,
      gatheringWorkers: today?.gatheringWorkers ?? null,
      requestedUnits: today?.requestedUnits ?? null,
      harvestedUnits: today?.harvestedUnits ?? null,
      usableUnits: today?.usableUnits ?? null,
      depletionApplied: today?.depletionApplied ?? null,
      demandUnits: today?.demandUnits ?? null,
      waterStress: today?.waterStress ?? null,
      sourceKind: today?.sourceKind ?? null,
      sourceId: today?.sourceId ?? null,
      failureReason: today?.failureReason ?? null,
      intervalDays: sub?.daysElapsed ?? null,
      intervalSupport: sub?.supportUnits ?? null,
      intervalDemand: sub?.demandUnits ?? null,
      intervalDepletion: sub?.depletionApplied ?? null,
      closedIntervals: sub?.closedIntervals ?? null,
      acuteRiskEpisodes: b.acuteRisk?.recentEpisodes?.length ?? 0,
      residentialReceiptsPresent: n.seasonalReceiptsPresent,
      residentialReceiptSupport: n.receiptUsableSupport,
      ordinaryTripsToday: (b.recentIntraSeasonTrips ?? []).length,
    });
  }
  const anySupport = daily.some((d) => d.receiptUsableSupport > 0);
  const anyHistory = daily.some((d) => d.seasonalSupportPresent);
  record(
    "L5_the_group_walks_with_no_physical_support_of_any_kind",
    "over the observed span the successor accumulates NO food receipts and acquires NO support history — it is walking on nothing, and its measured hunger is nevertheless zero on every one of those days",
    {
      observedDays: daily.length,
      daysWithAnyReceipt: daily.filter((d) => d.receiptUsableSupport > 0).length,
      daysWithSupportHistory: daily.filter((d) => d.seasonalSupportPresent).length,
      maxFoodMovementPressure: daily.reduce((m, d) => Math.max(m, d.foodMovementPressure), 0),
      anySupport, anyHistory,
    },
    { firstTenDays: daily.slice(0, 10), lastDay: daily[daily.length - 1] ?? null },
  );

  // ── LINK 6 — the same absence in the LEDGER, for completeness ──
  //
  // The food ledger is the other place an absence could be read as a quantity. It is measured rather
  // than assumed, because "no receipts" and "no demand" are different absences.
  const succBand = w.bands[succId];
  const ledgerRead = succBand === undefined
    ? null
    : ledger.deriveHumanFoodSupportLedger(succBand, Math.max(1, succBand.demography.population), Number(w.time.tick ?? 0));
  record(
    "L6_the_food_ledger_reports_a_true_zero_and_the_nutrition_read_does_not",
    "the LEDGER is honest about an empty accumulator — it reports zero support against real demand, which is a deficit. The nutrition state never sees it, because no interval was ever closed to turn that deficit into a support history",
    {
      ledgerRawSupportRatio: ledgerRead?.rawSupportRatio ?? null,
      ledgerFoodStress: ledgerRead?.foodStress ?? null,
      nutritionFoodMovementPressure: readNutrition(succBand).foodMovementPressure,
      freshAccumulatorPresent: receipts.readFreshAccumulator(succBand?.seasonalFoodReceipts, Number(w.time.tick ?? 0)) !== undefined,
    },
    { ledger: ledgerRead },
  );

  // ── LINK 7 — THE MECHANICAL REASON NO INTERVAL EVER CLOSES ──
  //
  // This is the link the previous pass did not have, and it is what makes the repair aimable.
  // `updateSeasonalSupportState` returns its PREVIOUS value — `undefined` — whenever carrying capacity
  // is undefined, and `deriveCarryingCapacity` returns undefined when the band has no OBSERVED RECORD
  // of the tile it is standing on. A group walking across country it has never seen therefore never
  // closes a support interval, so its hunger is not "zero" — it is UNASKED.
  const carrying = await server.ssrLoadModule("/sim/agents/carryingCapacity.ts");
  const contextCache = await server.ssrLoadModule("/sim/agents/contextCache.ts");
  const cache = contextCache.buildTickContextCache(w);
  const walkers = Object.values(w.bands).filter((b) => b.provisionalSuccessor !== undefined);
  const carryingProbes = walkers.map((b) => {
    const result = carrying.deriveCarryingCapacity(w, b, cache, {
      localUsePressure: 0, nearbyCrowding: 0, localPopulationEstimate: 0, riskPenalty: 0.3,
    });
    return {
      bandId: String(b.id),
      standingOn: String(b.position),
      hasObservedRecordOfItsOwnPosition: b.knowledge.observedTiles[b.position] !== undefined,
      carryingCapacityDerivable: result !== undefined,
      observedTileCount: Object.keys(b.knowledge.observedTiles).length,
      supportIntervalWouldClose: result !== undefined,
    };
  });
  record(
    "L7_no_support_interval_can_close_because_the_group_stands_on_unobserved_ground",
    "`deriveCarryingCapacity` refuses without an observed record of the band's OWN position, so `updateSeasonalSupportState` returns its previous value (absent) forever — the zeros are an UNASKED QUESTION, not a measurement of comfort",
    {
      walkersProbed: carryingProbes.length,
      walkersWithoutAnObservedRecordOfTheirOwnTile: carryingProbes.filter((p) => !p.hasObservedRecordOfItsOwnPosition).length,
      walkersWhoseSupportIntervalCouldClose: carryingProbes.filter((p) => p.supportIntervalWouldClose).length,
    },
    carryingProbes,
  );

  const parentAfter = readNutrition(w.bands[String(parent.id)]);
  out = {
    generatedAt: new Date().toISOString(),
    seed: SEED, warmDays: WARM_DAYS, observeDays: OBSERVE_DAYS,
    parentBandId: String(parent.id), successorBandId: succId,
    targetTileId: String(targetTile.id), targetDistance: dist(targetTile),
    verdict:
      parentBefore.foodMovementPressure > 0 && successorAtBirth.foodMovementPressure === 0 && !anySupport
        ? "REPRODUCED_TRAVEL_REDUCES_HUNGER_WITHOUT_FOOD"
        : "NOT_REPRODUCED",
    chain: {
      parentBefore, successorAtBirth, parentAfter,
      reliefAtDeparture: Number((parentBefore.foodMovementPressure - successorAtBirth.foodMovementPressure).toFixed(4)),
    },
    findings,
    dailyLedger: daily,
  };
} finally {
  await server.close();
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify({ verdict: out.verdict, chain: out.chain, findings: out.findings.map((f) => ({ id: f.id, observed: f.observed })) }, null, 2));
