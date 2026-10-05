// CORRECTION-15 §5 — independent proof of each CORRECTION-14 candidate repair.
//
// Every claim below is proven from CURRENT production behavior on whatever branch this
// runs on, so the SAME script produces the "before" evidence on the starting commit and
// the "after" evidence once a repair is ported. Nothing here asserts a repair exists.
//
//   A. annual demographic nutrition sampling — does the annual step read one seasonal phase?
//   B. same-day selection domain — can selection pick what the executor must reject?
//   C. newly observed resource knowledge — does a saturated cap evict what was just seen?
//   D. expedition observation timestamp — proven by scripts/stepModeInvarianceAudit.mjs
//      (a recon-return day stamp taken from the batch-start world time); reported here only
//      as a pointer, because it is observable only once B and C make recon returns occur.
//
// Usage: node scripts/candidateRepairIsolationAudit.mjs [--years 120] [--tile tile:188:92]
import { createServer } from "vite";
import { writeFileSync } from "node:fs";

function arg(name, dflt) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : dflt;
}

const YEARS = Number(arg("--years", "120"));
const TILE = arg("--tile", "tile:188:92");
const OUT = arg("--out", "");
const r3 = (v) => Math.round(v * 1000) / 1000;
const mean = (xs) => (xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length);

const server = await createServer({
  root: `${process.cwd()}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const spawn = await server.ssrLoadModule("/sim/agents/spawn.ts");
  const resourceKnowledge = await server.ssrLoadModule("/sim/agents/resourceKnowledge.ts");

  // ── shared run: one isolated founder on the named physically-rich tile ────────────
  let world = runner.initSimWorld({ kind: "map2" }, "c15-isolation");
  world = spawn.removeInitialBands(world, Object.keys(world.bands));
  world = spawn.spawnCustomBands(world, [{ tileId: TILE, population: 34, name: "isolation" }], "c15-isolation");
  const bandId = Object.keys(world.bands)[0];

  const bySeason = { spring: [], summer: [], autumn: [], winter: [] };
  const demographyReadSeasons = {};
  const demographyReadRatios = [];
  const annualGroundTruthStress = [];
  const annualGroundTruthRatio = [];
  const demographyConsumedPressure = [];
  const demographySurplusBonus = [];
  let physicallySurplusYears = 0;
  let surplusSignalYears = 0;
  let demographyYears = 0;
  const seenTrips = new Set();
  // B: a trip-day opportunity the executor cannot use.
  let seasonsWithZeroTrips = 0;
  let seasonsTotal = 0;
  let zeroTripSeasonsWithReachableMemory = 0;
  let zeroTripSeasonsWithSameDayMemory = 0;
  let zeroTripSeasonsWithOnlyOutOfBudgetMemory = 0;
  const zeroTripExamples = [];

  const gridDistance = (world_, a, b) => {
    const ta = world_.tiles[a];
    const tb = world_.tiles[b];
    return ta === undefined || tb === undefined
      ? Infinity
      : Math.abs(ta.coord.x - tb.coord.x) + Math.abs(ta.coord.y - tb.coord.y);
  };
  // Same-day budget as production computes it: deriveTripDurationDays(d) <= 1.
  const SAME_DAY_ROUND_TRIP_TILE_BUDGET = 8;
  const isSameDay = (d) => Math.max(1, Math.ceil((d * 2) / SAME_DAY_ROUND_TRIP_TILE_BUDGET)) <= 1;

  for (let season = 0; season < YEARS * 4; season += 1) {
    world = runner.stepSim(world, 1, "seasonal");
    const band = world.bands[bandId];
    if (band === undefined) break;

    const ratio = band.seasonalSupport?.currentSeasonSupport?.rawSupportRatio;
    if (ratio !== undefined) bySeason[world.time.season]?.push(ratio);

    // The annual demographic step runs in spring (shouldRunAnnualDemography). Record which
    // season it lands on, the seasonal sample at that moment, the GROUND TRUTH for the year
    // it is integrating (the mean of the four seasonal samples in `recentSamples`), and what
    // production's demography actually consumed (`foodPerPersonStress` is the canonical
    // nutrition pressure it used; `foodFertilitySurplusBonus` is CORRECTION-13's surplus
    // signal). Reading production-written fields keeps this valid on both commits.
    if (Number(band.demography.lastDemographicUpdate?.tick ?? -1) === Number(world.time.tick)) {
      demographyReadSeasons[world.time.season] = (demographyReadSeasons[world.time.season] ?? 0) + 1;
      if (ratio !== undefined) demographyReadRatios.push(ratio);
      const samples = (band.seasonalSupport?.recentSamples ?? []).slice(-4);
      if (samples.length > 0) {
        const yearMeanStress = mean(samples.map((e) => Math.max(0, Math.min(1, e.foodStress))));
        const yearMeanRatio = mean(samples.map((e) => Math.max(0, e.rawSupportRatio)));
        annualGroundTruthStress.push(yearMeanStress);
        annualGroundTruthRatio.push(yearMeanRatio);
        demographyConsumedPressure.push(band.demography.foodPerPersonStress ?? 0);
        demographySurplusBonus.push(band.demography.foodFertilitySurplusBonus ?? 0);
        if (yearMeanRatio >= 1.12) physicallySurplusYears += 1;
        if ((band.demography.foodFertilitySurplusBonus ?? 0) > 0) surplusSignalYears += 1;
        demographyYears += 1;
      }
    }

    let trips = 0;
    for (const trip of band.recentIntraSeasonTrips ?? []) {
      const key = `${trip.tick}:${trip.day}:${trip.targetTileId}`;
      if (seenTrips.has(key)) continue;
      seenTrips.add(key);
      trips += 1;
    }
    seasonsTotal += 1;
    if (trips === 0) {
      seasonsWithZeroTrips += 1;
      const memories = band.resourceKnowledgeState?.patchMemories ?? [];
      const distances = memories
        .filter((m) => m.approximateTile !== band.position)
        .map((m) => gridDistance(world, band.position, m.approximateTile))
        .filter((d) => Number.isFinite(d) && d > 0);
      const reachable = distances.filter((d) => d <= 10);
      const sameDay = reachable.filter(isSameDay);
      if (reachable.length > 0) zeroTripSeasonsWithReachableMemory += 1;
      if (sameDay.length > 0) zeroTripSeasonsWithSameDayMemory += 1;
      if (reachable.length > 0 && sameDay.length === 0) {
        zeroTripSeasonsWithOnlyOutOfBudgetMemory += 1;
        if (zeroTripExamples.length < 6) {
          zeroTripExamples.push({
            season,
            position: String(band.position),
            memoryCount: memories.length,
            reachableWithin10: reachable.length,
            sameDayReachable: sameDay.length,
            nearestDistance: Math.min(...reachable),
          });
        }
      }
    }
  }

  const seasonMeans = Object.fromEntries(
    Object.entries(bySeason).map(([s, xs]) => [s, { n: xs.length, meanRatio: r3(mean(xs)) }]),
  );
  const orderedSeasons = Object.entries(seasonMeans).sort((a, b) => a[1].meanRatio - b[1].meanRatio);
  const leanestSeason = orderedSeasons[0]?.[0];
  const demographySeasons = Object.keys(demographyReadSeasons);
  const annualMeanAcrossAllSeasons = r3(mean(Object.values(bySeason).flat()));
  const demographyMeanRead = r3(mean(demographyReadRatios));

  const claimA = {
    claim: "The annual demographic step reads ONE seasonal phase, and it is systematically the same one.",
    demographyReadSeasons,
    readsExactlyOneSeason: demographySeasons.length === 1,
    demographySeason: demographySeasons[0],
    seasonMeanSupportRatio: seasonMeans,
    leanestSeason,
    demographyLandsOnLeanestSeason: demographySeasons.length === 1 && demographySeasons[0] === leanestSeason,
    meanRatioSeenByDemography: demographyMeanRead,
    meanRatioAcrossWholeYear: annualMeanAcrossAllSeasons,
    seasonalSampleBias: r3(demographyMeanRead - annualMeanAcrossAllSeasons),
    // The decisive measurement: what the demographic step CONSUMED versus what the year it
    // integrates actually was. `demographyYears` annual steps were observed.
    demographyYears,
    annualGroundTruthMeanFoodStress: r3(mean(annualGroundTruthStress)),
    annualGroundTruthMeanSupportRatio: r3(mean(annualGroundTruthRatio)),
    demographyConsumedMeanFoodPressure: r3(mean(demographyConsumedPressure)),
    // Overstatement of hardship: how much more pressure demography applied than the year held.
    consumedMinusGroundTruth: r3(mean(demographyConsumedPressure) - mean(annualGroundTruthStress)),
    physicallySurplusYears,
    surplusSignalYears,
    meanSurplusFertilityBonus: r3(mean(demographySurplusBonus)),
    // Defect: the annual step consumes materially more hardship than the year contained, or
    // it registers almost no surplus in years that were physically in surplus.
    defectPresent:
      demographySeasons.length === 1 &&
      (mean(demographyConsumedPressure) > mean(annualGroundTruthStress) + 0.15 ||
        (physicallySurplusYears > demographyYears * 0.2 && surplusSignalYears < physicallySurplusYears * 0.25)),
  };

  const claimB = {
    claim: "Selection can win a candidate the same-day executor must reject, wasting the band's one candidate that day.",
    seasonsTotal,
    seasonsWithZeroTrips,
    zeroTripSeasonsWithReachableMemory,
    zeroTripSeasonsWithSameDayMemory,
    // The decisive cell: the band HAD a remembered patch within the trip radius, but every
    // one of them was outside the same-day budget, and it produced no trip at all.
    zeroTripSeasonsWithOnlyOutOfBudgetMemory,
    zeroTripExamples,
    defectPresent: zeroTripSeasonsWithOnlyOutOfBudgetMemory > 0,
  };

  // ── C: direct unit proof against the exported knowledge functions ─────────────────
  // Build a saturated state of strong, long-held FAR memories, then apply one fresh local
  // observation and ask whether the just-observed patch id survives the cap.
  const { createEmptyResourceKnowledgeState, enforceResourceKnowledgeCap, RESOURCE_KNOWLEDGE_CAP } = resourceKnowledge;
  const strongMemory = (index, tick) => ({
    patchId: `patch:far-${index}`,
    resourceClassId: "generic_plant_food",
    approximateTile: `tile:far:${index}`,
    linkedTiles: [],
    state: "reliable",
    source: "direct",
    confidence: {
      presenceConfidence: 0.95, seasonConfidence: 0.9, yieldConfidence: 0.9,
      safetyConfidence: 0.9, processingConfidence: 0.9, accessConfidence: 0.9, recoveryConfidence: 0.9,
    },
    seasonality: { bestSeasons: [], badSeasons: [], failedSeasonCount: 0 },
    useHistory: {
      visits: 40, successfulUses: 30, failedUses: 2, lastYieldEstimate: 0.8,
      yieldTrend: "flat", depletionMemory: 0.1, recoveryExpectation: 0.6,
    },
    risk: { poisoningOrBadReaction: false, badWater: false, predatorOrAnimalRisk: 0, tabooOrAvoidanceFutureFlag: false },
    transmission: { detailLoss: 0, practiceReinforced: 6 },
    firstNotedTick: 0,
    lastNotedTick: tick,
    reasonIds: [],
  });
  const freshLocalMemory = (tick) => ({
    ...strongMemory("local", tick),
    patchId: "patch:just-observed-local",
    approximateTile: "tile:here",
    state: "observed",
    confidence: {
      presenceConfidence: 0.42, seasonConfidence: 0.1, yieldConfidence: 0.1,
      safetyConfidence: 0.3, processingConfidence: 0.05, accessConfidence: 0.3, recoveryConfidence: 0.1,
    },
    useHistory: {
      visits: 1, successfulUses: 0, failedUses: 0, lastYieldEstimate: 0.1,
      yieldTrend: "unknown", depletionMemory: 0, recoveryExpectation: 0.1,
    },
    transmission: { detailLoss: 0, practiceReinforced: 0 },
    firstNotedTick: tick,
    lastNotedTick: tick,
  });

  const tick = 400;
  const saturated = {
    ...createEmptyResourceKnowledgeState(),
    // 48 strong memories last confirmed a while ago, plus the one just observed here = 49.
    patchMemories: [
      ...Array.from({ length: RESOURCE_KNOWLEDGE_CAP }, (_, i) => strongMemory(i, tick - 24)),
      freshLocalMemory(tick),
    ],
  };
  const justObserved = new Set(["patch:just-observed-local"]);
  const cappedWithoutProtection = enforceResourceKnowledgeCap(saturated, tick);
  // Production may or may not accept a third argument; call it defensively.
  const cappedWithProtection = enforceResourceKnowledgeCap(saturated, tick, justObserved);
  const survives = (state) => state.patchMemories.some((m) => m.patchId === "patch:just-observed-local");

  const claimC = {
    claim: "A saturated bounded cap evicts the patch the band has just physically observed here.",
    cap: RESOURCE_KNOWLEDGE_CAP,
    inputMemories: saturated.patchMemories.length,
    capEnforcedLength: cappedWithoutProtection.patchMemories.length,
    justObservedSurvivesWithoutProtection: survives(cappedWithoutProtection),
    justObservedSurvivesWithProtection: survives(cappedWithProtection),
    capStillBoundedWithProtection: cappedWithProtection.patchMemories.length === RESOURCE_KNOWLEDGE_CAP,
    protectionArgumentSupported: survives(cappedWithProtection) && !survives(cappedWithoutProtection),
    defectPresent: !survives(cappedWithoutProtection),
  };

  const claimD = {
    claim: "Expedition recon returns stamp observations from the batch-start world time, so daily and seasonal stepping disagree on the recorded day.",
    provenBy: "scripts/stepModeInvarianceAudit.mjs (fullCanonicalStateMatch) — observable only once recon returns actually occur, i.e. after B and C",
    note: "Reported here as a pointer; this script does not exercise the expedition return path.",
  };

  out = {
    check: "CORRECTION-15 candidate repair isolation",
    years: YEARS,
    tile: TILE,
    A_annualNutritionSampling: claimA,
    B_sameDaySelectionDomain: claimB,
    C_newlyObservedResourceKnowledge: claimC,
    D_expeditionTimestamp: claimD,
  };
} finally {
  await server.close();
}

const text = JSON.stringify(out, null, 1);
if (OUT !== "") {
  writeFileSync(OUT, text);
  console.log(JSON.stringify({ wrote: OUT, bytes: text.length }));
} else {
  console.log(text);
}
