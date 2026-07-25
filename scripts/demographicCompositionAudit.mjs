// DEMOGRAPHIC RESPONSE COMPRESSION CORRECTION-13 — composition audit + controlled arms.
//
// Measures the exact demographic arithmetic BEFORE any change. Food is fed through the real
// nutrition interface (`updateSeasonalSupportState`, the production seasonal-support builder,
// driven by a controlled carrying-capacity support ratio) — population outcomes are NEVER
// written directly; they come from the real `updateBandDemography`. Non-food stressors are held
// at a fixed neutral baseline so the arms isolate the food→demography response (arm E adds one
// non-food hazard). Demography runs annually (spring); support updates every season.
//
// Records, per arm, the full composition waterfall (state → fertility → mortality → cadence/
// clamp → realized births/deaths → trajectory) and the 150-year population trajectory.

import { createServer } from "vite";

function arg(name, dflt) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : dflt;
}
const YEARS = Number(arg("--years", "150"));
const round4 = (v) => Math.round(v * 1e4) / 1e4;

const server = await createServer({
  root: `${process.cwd()}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

// Controlled support levels. foodStress/deficit derive from the ratio exactly as the ledger
// would; perCapitaReturn gates the recovery streak (>=0.48). E reuses A's food + one hazard.
const ARMS = [
  { id: "A_strong_surplus", ratio: 1.5, perCapitaReturn: 0.7, hazard: false },
  { id: "B_maintenance", ratio: 1.0, perCapitaReturn: 0.55, hazard: false },
  { id: "C_moderate_deficit", ratio: 0.72, perCapitaReturn: 0.34, hazard: false },
  { id: "D_severe_deficit", ratio: 0.32, perCapitaReturn: 0.14, hazard: false },
  { id: "E_surplus_plus_hazard", ratio: 1.5, perCapitaReturn: 0.7, hazard: true },
];

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const demographyMod = await server.ssrLoadModule("/sim/agents/demography.ts");
  const survival = await server.ssrLoadModule("/sim/agents/seasonalSurvival.ts");
  const timeMod = await server.ssrLoadModule("/sim/tick/time.ts");
  const { updateBandDemography, deriveFoodDemographyRateTerms } = demographyMod;
  const { updateSeasonalSupportState, deriveCanonicalNutritionState } = survival;
  const { getWorldTimeForTick } = timeMod;

  // Controlled carrying state exposing exactly the fields updateSeasonalSupportState reads.
  const makeCarrying = (ratio, perCapitaReturn) => {
    const foodStress = Math.max(0, Math.min(1, 1 - ratio));
    return {
      perCapitaReturn: {
        perCapitaReturn,
        supportDebug: {
          rawSupportRatio: ratio,
          clampedSupportRatio: Math.min(1, ratio),
          deficitRatio: foodStress,
          perCapitaReturn,
          humanFoodLedger: { foodStress },
        },
      },
    };
  };

  // Fixed, realistic non-food stress baseline representative of a nomadic band (so the arms
  // isolate FOOD while the absolute levels are meaningful: true maintenance is roughly stable,
  // not artificially buoyant). Arm E overrides acuteRisk to add ONE non-food hazard.
  const neutralize = (band, hazard) => ({
    ...band,
    pressureState: {
      ...(band.pressureState ?? {}),
      waterStress: 0.34,
      riskPressure: 0.42,
      fatiguePressure: 0.08,
    },
    nomadicScalePressure: undefined,
    bodyCampLogistics: undefined,
    deathMemory: undefined,
    acuteRisk: hazard
      ? { activeEffect: { extraSeasonalStress: 0.3, mortalityRiskBump: 0.5, activityEfficiencyPenalty: 0.1 } }
      : undefined,
  });

  const world0 = runner.initSimWorld({ kind: "map1" }, "demographic-composition");
  const founder = Object.values(world0.bands).sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];
  const baseDemography = founder.demography; // identical starting structure for every arm
  const springWorld = (tick) => ({ ...world0, time: getWorldTimeForTick(tick) });

  function warmSupport(band, ratio, perCapitaReturn, seasons) {
    let support;
    for (let s = 0; s < seasons; s += 1) {
      support = updateSeasonalSupportState(support, makeCarrying(ratio, perCapitaReturn), band, getWorldTimeForTick(s + 1));
    }
    return support;
  }

  const results = {};
  for (const arm of ARMS) {
    const band0 = neutralize({ ...founder, demography: baseDemography }, arm.hazard);
    // Warm the nutrition history to the sustained level (12 seasons excluded from measurement).
    const warmedSupport = warmSupport(band0, arm.ratio, arm.perCapitaReturn, 12);
    const nutrition = deriveCanonicalNutritionState(warmedSupport);
    const foodTerms = deriveFoodDemographyRateTerms(nutrition, warmedSupport, "actual");

    // Composition waterfall at the warmed state (one representative annual update).
    const measureBand = { ...band0, seasonalSupport: warmedSupport };
    const comp = updateBandDemography(springWorld(12), measureBand);

    // 150-year trajectory: 4 support updates/year at the sustained level, 1 annual demography.
    let band = { ...band0, seasonalSupport: warmedSupport };
    let support = warmedSupport;
    let tick = 13;
    let pop = band.demography.population;
    let minPop = pop;
    let births = 0;
    let deaths = 0;
    const traj = [pop];
    for (let year = 1; year <= YEARS; year += 1) {
      for (let s = 0; s < 4; s += 1) {
        support = updateSeasonalSupportState(support, makeCarrying(arm.ratio, arm.perCapitaReturn), band, getWorldTimeForTick(tick));
        tick += 1;
      }
      // Align to a spring tick for the annual demography.
      const springTick = tick - (tick % 4); // nearest spring boundary
      const nextDemo = updateBandDemography(springWorld(springTick), { ...band, seasonalSupport: support });
      births += nextDemo.lastBirths ?? 0;
      deaths += nextDemo.lastDeaths ?? 0;
      band = { ...band, seasonalSupport: support, demography: nextDemo };
      pop = nextDemo.population;
      minPop = Math.min(minPop, pop);
      if (year % 10 === 0 || year === YEARS) traj.push(pop);
      if (pop <= 0) break;
    }

    results[arm.id] = {
      ratio: arm.ratio,
      hazard: arm.hazard,
      nutrition: {
        currentFoodStress: nutrition.currentFoodStress,
        recentFoodStress: nutrition.recentFoodStress,
        chronicFoodStress: nutrition.chronicFoodStress,
        foodDemographicPressure: nutrition.foodDemographicPressure,
      },
      composition: {
        baselineFertilityBasis: comp.baselineFertilityBasis,
        foodFertilitySuppression: comp.foodFertilitySuppression,
        foodMortalityContribution: comp.foodMortalityContribution,
        foodSevereChronicHazard: comp.foodSevereChronicHazard,
        foodSevereChronicRatePenalty: comp.foodSevereChronicRatePenalty,
        fertilityPressure: comp.fertilityPressure,
        mortalityPressure: comp.mortalityPressure,
        ordinaryMortalityBasis: comp.ordinaryMortalityBasis,
        uncappedDemographicRate: comp.uncappedDemographicRate,
        netDemographicRate: comp.netDemographicRate,
        declineCapBinds: comp.declineCapBinds,
        // rate contribution breakdown (annual)
        fertilityRateContribution: round4(comp.fertilityPressure * 0.012),
        mortalityRateContribution: round4(-comp.mortalityPressure * 0.014),
      },
      trajectory: {
        startPop: baseDemography.population,
        finalPop: pop,
        minPop,
        netChange: round4(pop - baseDemography.population),
        births,
        deaths,
        every10y: traj,
      },
    };
  }

  // Transient robustness: a healthy maintenance band, then ONE extreme season. Verifies one
  // bad season is not fatal and one good season does not explode (the surplus recovery gate).
  function runTransient(injectRatio, injectReturn) {
    const band0 = neutralize({ ...founder, demography: baseDemography }, false);
    let support = warmSupport(band0, 1.0, 0.55, 12);
    let band = { ...band0, seasonalSupport: support };
    let tick = 13;
    for (let y = 0; y < 5; y += 1) {
      for (let s = 0; s < 4; s += 1) { support = updateSeasonalSupportState(support, makeCarrying(1.0, 0.55), band, getWorldTimeForTick(tick)); tick += 1; }
      const st = tick - (tick % 4);
      band = { ...band, seasonalSupport: support, demography: updateBandDemography(springWorld(st), { ...band, seasonalSupport: support }) };
    }
    const popBefore = band.demography.population;
    support = updateSeasonalSupportState(support, makeCarrying(injectRatio, injectReturn), band, getWorldTimeForTick(tick)); tick += 1;
    let maxSurplus = deriveCanonicalNutritionState(support).nutritionalSurplus;
    for (let s = 0; s < 3; s += 1) { support = updateSeasonalSupportState(support, makeCarrying(1.0, 0.55), band, getWorldTimeForTick(tick)); tick += 1; maxSurplus = Math.max(maxSurplus, deriveCanonicalNutritionState(support).nutritionalSurplus); }
    const st = tick - (tick % 4);
    const demo = updateBandDemography(springWorld(st), { ...band, seasonalSupport: support });
    return { popBefore, popAfter: demo.population, delta: demo.population - popBefore, maxNutritionalSurplus: round4(maxSurplus) };
  }
  const transients = {
    oneBadSeason: runTransient(0.12, 0.1),
    oneGoodSeason: runTransient(1.8, 0.75),
    oneBadSeasonNotFatal: undefined,
    oneGoodSeasonNotExplosive: undefined,
  };
  transients.oneBadSeasonNotFatal = transients.oneBadSeason.delta >= -2;
  transients.oneGoodSeasonNotExplosive = transients.oneGoodSeason.maxNutritionalSurplus < 0.1 && transients.oneGoodSeason.delta <= 1;

  // Ordering summary — does the annual net rate order strong>maintenance>moderate>severe?
  const rate = (id) => results[id].composition.netDemographicRate;
  const ordering = {
    strong: rate("A_strong_surplus"),
    maintenance: rate("B_maintenance"),
    moderate: rate("C_moderate_deficit"),
    severe: rate("D_severe_deficit"),
    strongGtMaintenance: rate("A_strong_surplus") > rate("B_maintenance"),
    maintenanceGtModerate: rate("B_maintenance") > rate("C_moderate_deficit"),
    moderateGtSevere: rate("C_moderate_deficit") > rate("D_severe_deficit"),
    strongSurplusPositive: rate("A_strong_surplus") > 0,
    severeMateriallyWorseThanModerate: rate("C_moderate_deficit") - rate("D_severe_deficit") >= 0.004,
    fullSpanAnnual: round4(rate("A_strong_surplus") - rate("D_severe_deficit")),
  };

  console.log(JSON.stringify({ check: "CORRECTION-13 demographic composition + controlled arms", years: YEARS, ordering, transients, arms: results }, null, 2));
} finally {
  await server.close();
}
