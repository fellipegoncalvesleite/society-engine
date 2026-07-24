// LOST-LINEAGE RECOVERY-12 — food-receipt accounting audit.
//
// Proves the two reconstructed corrections directly, through the real production pipeline:
//   1. Receipt capture = 1.000 — every physically returned usable food unit is credited by
//      the authoritative per-period accumulator, even when the bounded 24-record
//      recentIntraSeasonTrips UI window evicts the early receipts (defect 1).
//   2. Freshness — food from an old season does not persist; a zero-harvest season credits
//      exactly zero current support and reads maximal food stress (defect 2).
//   3. Conservation — ledger credit <= physically returned usable food, each receipt once.
//   4. Same-day and expedition returns both feed the accumulator, independently.
//
// The "physically returned usable food" ground truth is measured INDEPENDENTLY of the
// accumulator: the season is stepped one day at a time with runDailyActions, and every new
// credited trip record is captured by object identity BEFORE the 24-cap can evict it. The
// old (mainline) ledger algorithm is reconstructed from the same final trip window to
// reproduce the loss.

import { createServer } from "vite";

const server = await createServer({
  root: `${process.cwd()}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

const MAP1_FOUNDERS = {
  "band:delta-coastal-foragers": "Delta Reed",
  "band:river-valley-foragers": "Green River",
  "band:lake-wetland-foragers": "Lake Marsh",
  "band:highland-edge-foragers": "Pass Edge",
  "band:dry-margin-foragers": "Dry Margin",
};

const SEASON_LENGTH_DAYS = 90;
const WARMUP_SEASONS = 12;
const INSTRUMENTED_SEASONS = 24;

function round4(v) {
  return Math.round(v * 10000) / 10000;
}

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const dailyActions = await server.ssrLoadModule("/sim/agents/dailyActions.ts");
  const registry = await server.ssrLoadModule("/sim/agents/dailyActionRegistry.ts");
  const food = await server.ssrLoadModule("/sim/agents/humanFoodSupport.ts");
  const seasonalReceipts = await server.ssrLoadModule("/sim/agents/seasonalFoodReceipts.ts");
  const returns = await server.ssrLoadModule("/sim/agents/physicalFoodReturn.ts");
  const carrying = await server.ssrLoadModule("/sim/agents/carryingCapacity.ts");

  const { runDailyActions } = dailyActions;
  const DEFAULT_DAILY_ACTIONS = registry.DEFAULT_DAILY_ACTIONS;
  const { isCreditedFoodReceipt, depositFoodReceipts } = seasonalReceipts;

  // The exact old (mainline) ledger read: filter the retained 24-record window to credited
  // food, take the latest retained tick, sum only that tick's receipts. Reproduces the loss.
  function oldWindowCredit(trips) {
    const credited = (trips ?? []).filter(isCreditedFoodReceipt);
    if (credited.length === 0) return 0;
    const latest = credited.reduce((m, t) => Math.max(m, Number(t.tick)), Number(credited[0].tick));
    return credited
      .filter((t) => Number(t.tick) === latest)
      .reduce((s, t) => s + t.physicalFoodHarvest.usableSupport, 0);
  }

  function isExpeditionReceipt(record) {
    return (record.reasonIds ?? []).some((r) => String(r).includes("expedition-return"));
  }

  // ---- Part 1: instrumented Map 1 capture / eviction / conservation / paths ----
  let world = runner.initSimWorld({ kind: "map1" }, "recovery-food-accounting:map1");
  for (let s = 0; s < WARMUP_SEASONS; s += 1) {
    world = runner.stepSim(world, 1, "seasonal");
  }

  const perFounder = {};
  for (const id of Object.keys(MAP1_FOUNDERS)) {
    perFounder[id] = {
      founder: MAP1_FOUNDERS[id],
      seasons: 0,
      returnedTotal: 0,
      creditedTotal: 0,
      oldWindowTotal: 0,
      receiptCountScanned: 0,
      receiptCountAccumulator: 0,
      sameDayReturned: 0,
      expeditionReturned: 0,
      maxTripsInSeason: 0,
      evictionSeasons: 0,
      seasonsWithHarvest: 0,
      worstOldWindowRatio: 1,
      minCaptureRatio: 1,
      conservationHolds: true,
    };
  }

  for (let season = 0; season < INSTRUMENTED_SEASONS; season += 1) {
    const periodTick = Number(world.time.tick); // boundary tick N; season-N receipts get tick N
    const startDay = periodTick * SEASON_LENGTH_DAYS;

    // GROUND TRUTH (uncapped): replay season N's daily actions on a throwaway COPY, one day at
    // a time, capturing every new credited trip record by object identity BEFORE the 24-record
    // cap can evict it. runDailyActions returns a fresh world, so `world` is untouched. Because
    // the copy starts from the identical state and covers the identical day range, its receipts
    // are exactly the ones the real season deposits into the accumulator.
    const seen = new Map();
    const returnedThis = {};
    for (const id of Object.keys(MAP1_FOUNDERS)) {
      seen.set(id, new Set());
      returnedThis[id] = { total: 0, count: 0, sameDay: 0, expedition: 0, trips: 0 };
    }
    let copy = world;
    for (let d = 0; d < SEASON_LENGTH_DAYS; d += 1) {
      copy = runDailyActions(copy, startDay + d, 1, DEFAULT_DAILY_ACTIONS);
      for (const id of Object.keys(MAP1_FOUNDERS)) {
        const band = copy.bands[id];
        if (band === undefined) continue;
        const set = seen.get(id);
        for (const rec of band.recentIntraSeasonTrips ?? []) {
          if (set.has(rec)) continue;
          set.add(rec);
          // The window still holds prior-season records at season start; the ground truth is
          // this season's physical returns only (all dated to periodTick).
          if (Number(rec.tick) !== periodTick) continue;
          returnedThis[id].trips += 1;
          if (isCreditedFoodReceipt(rec)) {
            const usable = rec.physicalFoodHarvest.usableSupport;
            returnedThis[id].total += usable;
            returnedThis[id].count += 1;
            if (isExpeditionReceipt(rec)) returnedThis[id].expedition += usable;
            else returnedThis[id].sameDay += usable;
          }
        }
      }
    }

    // Advance the REAL world one season the normal way. After this, world.time.tick = N+1 and
    // each band's accumulator still holds season N (periodTick N) until its next harvest.
    world = runner.stepSim(world, 1, "seasonal");
    const readTick = Number(world.time.tick); // N+1

    for (const id of Object.keys(MAP1_FOUNDERS)) {
      const band = world.bands[id];
      if (band === undefined) continue;
      const rt = returnedThis[id];
      const acc = band.seasonalFoodReceipts;
      const accFresh = acc !== undefined && Number(acc.periodTick) === periodTick ? acc : undefined;
      const demand = carrying.derivePopulationDemand(band).adultEquivalentDemand;
      const ledger = food.deriveHumanFoodSupportLedger(band, demand, readTick);
      const credited = ledger.rawUsableHarvest;
      const oldCredit = round4(oldWindowCredit(band.recentIntraSeasonTrips));
      const returned = round4(rt.total);

      const f = perFounder[id];
      f.seasons += 1;
      f.returnedTotal += returned;
      f.creditedTotal += credited;
      f.oldWindowTotal += oldCredit;
      f.receiptCountScanned += rt.count;
      f.receiptCountAccumulator += accFresh?.receiptCount ?? 0;
      f.sameDayReturned += round4(rt.sameDay);
      f.expeditionReturned += round4(rt.expedition);
      f.maxTripsInSeason = Math.max(f.maxTripsInSeason, rt.trips);
      if (rt.trips > 24) f.evictionSeasons += 1;
      if (returned > 0) {
        f.seasonsWithHarvest += 1;
        f.minCaptureRatio = Math.min(f.minCaptureRatio, credited / returned);
        f.worstOldWindowRatio = Math.min(f.worstOldWindowRatio, oldCredit / returned);
      }
      // Conservation: credited never exceeds physically returned, and each credited receipt is
      // counted exactly once (accumulator receiptCount == independent uncapped scan count).
      if (credited > returned + 1e-9) f.conservationHolds = false;
      if ((accFresh?.receiptCount ?? 0) !== rt.count) f.conservationHolds = false;
    }
  }

  // ---- Part 2: freshness / zero-harvest / reset (controlled, exact) ----
  const N = 40;
  const mkRecord = (tick, usable, source = "plant_patch", expedition = false) => ({
    tick,
    day: tick * SEASON_LENGTH_DAYS + 10,
    resourceReturn: { returnedResourceKind: "gathered_plant_food", consumedByEconomy: usable > 0 },
    physicalFoodHarvest: {
      sourceKind: source,
      sourceId: `src:${source}:${tick}`,
      sourceClass: "controlled",
      knownness: "known_target",
      attempted: true,
      physicalSourceFound: true,
      physicalAvailability: usable,
      harvestedAmount: usable,
      depletionApplied: usable,
      transportLoss: 0,
      processingLoss: 0,
      usableSupport: usable,
      worldTruthDebugOnly: true,
      reasonIds: expedition ? [`reason:expedition-return:test:${tick}`] : [`reason:same-day:test:${tick}`],
    },
  });

  // A productive season N (0.5) followed by zero-harvest seasons.
  const accN = depositFoodReceipts(undefined, [mkRecord(N, 0.3), mkRecord(N, 0.2)]);
  const bandN = { id: "band:freshness", seasonalFoodReceipts: accN };
  const freshLedger = food.deriveHumanFoodSupportLedger(bandN, 20, N + 1); // boundary right after N
  const staleLedger2 = food.deriveHumanFoodSupportLedger(bandN, 20, N + 2); // one zero-harvest season later
  const staleLedger3 = food.deriveHumanFoodSupportLedger(bandN, 20, N + 3);
  // A later harvest at N+2 RESETS the period (not accumulated across seasons).
  const accReset = depositFoodReceipts(accN, [mkRecord(N + 2, 0.1)]);

  const freshness = {
    accumulatedOnceInSeason: round4(accN.totalUsableSupport) === 0.5 && accN.receiptCount === 2,
    freshSeasonCredited: round4(freshLedger.rawUsableHarvest) === 0.5 && freshLedger.foodStress < 1,
    firstZeroHarvestSeasonCreditsZero: staleLedger2.rawUsableHarvest === 0 && staleLedger2.foodStress === 1,
    laterZeroHarvestSeasonCreditsZero: staleLedger3.rawUsableHarvest === 0 && staleLedger3.foodStress === 1,
    newHarvestResetsPeriod:
      Number(accReset.periodTick) === N + 2 && round4(accReset.totalUsableSupport) === 0.1 && accReset.receiptCount === 1,
  };

  // ---- Part 3: same-day and expedition paths credit independently (unit) ----
  const sameDayOnly = depositFoodReceipts(undefined, [mkRecord(N, 0.4, "plant_patch", false)]);
  const expeditionOnly = depositFoodReceipts(undefined, [mkRecord(N, 0.4, "fauna_stock", true)]);
  const bothPaths = depositFoodReceipts(undefined, [
    mkRecord(N, 0.4, "plant_patch", false),
    mkRecord(N, 0.25, "fauna_stock", true),
  ]);
  const paths = {
    sameDayCredited: round4(sameDayOnly.totalUsableSupport) === 0.4 && sameDayOnly.receiptCount === 1,
    expeditionCredited: round4(expeditionOnly.totalUsableSupport) === 0.4 && expeditionOnly.receiptCount === 1,
    bothCountedOnce: round4(bothPaths.totalUsableSupport) === 0.65 && bothPaths.receiptCount === 2,
    nonFoodRejected:
      depositFoodReceipts(undefined, [
        { tick: N, day: 1, resourceReturn: { returnedResourceKind: "water_information", consumedByEconomy: false } },
      ]) === undefined,
  };

  // Wiring: both production return sites deposit into the accumulator.
  const { readFileSync } = await import("node:fs");
  const tripSrc = readFileSync("src/sim/agents/intraSeasonTrips.ts", "utf8");
  const expSrc = readFileSync("src/sim/agents/expedition.ts", "utf8");
  const foodSrc = readFileSync("src/sim/agents/humanFoodSupport.ts", "utf8");
  const wiring = {
    sameDayDeposits: tripSrc.includes("depositFoodReceipt(band.seasonalFoodReceipts, record)"),
    expeditionDeposits: expSrc.includes("depositFoodReceipts(currentBand.seasonalFoodReceipts, deposits)"),
    ledgerReadsAccumulatorNotWindow:
      foodSrc.includes("readFreshAccumulator") && !foodSrc.includes("band.recentIntraSeasonTrips"),
  };

  // ---- Roll-up ----
  const founders = Object.values(perFounder).map((f) => ({
    founder: f.founder,
    seasons: f.seasons,
    seasonsWithHarvest: f.seasonsWithHarvest,
    maxTripsInSeason: f.maxTripsInSeason,
    evictionSeasons: f.evictionSeasons,
    returnedTotal: round4(f.returnedTotal),
    creditedTotal: round4(f.creditedTotal),
    oldWindowTotal: round4(f.oldWindowTotal),
    captureRatio: f.returnedTotal > 0 ? round4(f.creditedTotal / f.returnedTotal) : 1,
    minSeasonCaptureRatio: round4(f.minCaptureRatio),
    oldWindowCaptureRatio: f.returnedTotal > 0 ? round4(f.oldWindowTotal / f.returnedTotal) : 1,
    worstOldWindowRatio: round4(f.worstOldWindowRatio),
    receiptCountScanned: f.receiptCountScanned,
    receiptCountAccumulator: f.receiptCountAccumulator,
    sameDayReturned: round4(f.sameDayReturned),
    expeditionReturned: round4(f.expeditionReturned),
    conservationHolds: f.conservationHolds,
  }));

  const anyEvictionObserved = founders.some((f) => f.evictionSeasons > 0 || f.maxTripsInSeason > 24);
  const anyOldWindowLoss = founders.some((f) => f.returnedTotal > 0 && f.oldWindowCaptureRatio < 0.999);

  const checks = {
    captureRatioIsOnePerFounder: founders.every((f) => Math.abs(f.captureRatio - 1) < 1e-6),
    perSeasonCaptureAlwaysComplete: founders.every((f) => f.minSeasonCaptureRatio > 0.999999),
    receiptCountsReconcile: founders.every((f) => f.receiptCountScanned === f.receiptCountAccumulator),
    conservationHolds: founders.every((f) => f.conservationHolds),
    evictionActuallyStressed: anyEvictionObserved, // >24-trip seasons exist (defect precondition present)
    oldWindowReproducesLoss: anyOldWindowLoss, // mainline algorithm undercounts on the SAME history
    newAccountingBeatsOldWindow: founders.every((f) => f.captureRatio >= f.oldWindowCaptureRatio - 1e-9),
    freshSeasonCredited: freshness.freshSeasonCredited,
    accumulatedOnceInSeason: freshness.accumulatedOnceInSeason,
    zeroHarvestSeasonCreditsZero: freshness.firstZeroHarvestSeasonCreditsZero && freshness.laterZeroHarvestSeasonCreditsZero,
    newHarvestResetsPeriod: freshness.newHarvestResetsPeriod,
    sameDayPathCredits: paths.sameDayCredited,
    expeditionPathCredits: paths.expeditionCredited,
    bothPathsCountedOnce: paths.bothCountedOnce,
    nonFoodReturnsRejected: paths.nonFoodRejected,
    sameDayWiringPresent: wiring.sameDayDeposits,
    expeditionWiringPresent: wiring.expeditionDeposits,
    ledgerReadsAccumulatorNotWindow: wiring.ledgerReadsAccumulatorNotWindow,
  };

  const pass = Object.values(checks).every(Boolean);
  console.log(
    JSON.stringify(
      {
        check: "RECOVERY-12 food-receipt accounting audit",
        verdict: pass ? "PASS" : "FAIL",
        checks,
        founders,
        freshness,
        paths,
        wiring,
      },
      null,
      2,
    ),
  );
  process.exitCode = pass ? 0 : 1;
} finally {
  await server.close();
}
