// CORRECTION-15 §8 — recovery-basin matrix.
//
// Question: after a physically real hardship, can a band with adequate remaining function
// RECOVER once conditions improve — or does moderate early hardship create an absorbing
// collapse spiral? Resilience is resistance AND recovery (RESEARCH_CONSTRAINTS R5); a model
// that can absorb a shock but never recover is not resilient.
//
// Method follows the accepted CORRECTION-13 controlled-arm harness: drive the REAL
// production nutrition history (`updateSeasonalSupportState`) with a controlled physical
// support ratio, and run the REAL production annual demography (`updateBandDemography`).
// Nothing is faked downstream of the support ratio — fertility, mortality, cohorts, the
// clamp, accumulators and the surplus signal are all production. Only the physical support
// the band receives is scripted, which is what a "bad year" physically is.
//
// The arms vary ONLY band history and initial functional state; the good environment is
// byte-identical across arms, so any divergence is the band's own state, not the habitat.
//
// Usage: node scripts/recoveryBasinAudit.mjs [--years 150] [--out path]
import { createServer } from "vite";
import { writeFileSync } from "node:fs";

function arg(name, dflt) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : dflt;
}

const YEARS = Number(arg("--years", "150"));
const OUT = arg("--out", "");
const r4 = (v) => Math.round(v * 10000) / 10000;
const r2 = (v) => Math.round(v * 100) / 100;

// Physical regimes, expressed as the raw support ratio the band physically achieves.
const GOOD = { ratio: 1.35, perCapitaReturn: 0.68 };      // good country, real surplus
const BAD = { ratio: 0.45, perCapitaReturn: 0.24 };       // a genuinely bad year
const SEVERE = { ratio: 0.16, perCapitaReturn: 0.1 };     // severe failure

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
  const demographyMod = await server.ssrLoadModule("/sim/agents/demography.ts");
  const survival = await server.ssrLoadModule("/sim/agents/seasonalSurvival.ts");
  const timeMod = await server.ssrLoadModule("/sim/tick/time.ts");
  const { updateBandDemography } = demographyMod;
  const { updateSeasonalSupportState } = survival;
  const { getWorldTimeForTick } = timeMod;

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

  // Fixed, realistic non-food stress baseline (identical across every arm).
  const neutralize = (band) => ({
    ...band,
    pressureState: { ...(band.pressureState ?? {}), waterStress: 0.34, riskPressure: 0.42, fatiguePressure: 0.08 },
    nomadicScalePressure: undefined,
    bodyCampLogistics: undefined,
    deathMemory: undefined,
    acuteRisk: undefined,
  });

  const world0 = runner.initSimWorld({ kind: "map1" }, "c15-recovery-basin");
  const founder = Object.values(world0.bands).sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];
  const springWorld = (tick) => ({ ...world0, time: getWorldTimeForTick(tick) });

  // Cohort structures are REAL production state (dependents/workingAdults/elders sum to
  // population and are carried forward by advanceAgeCohorts).
  const withPopulation = (demography, population, shape) => {
    const dependents = Math.round(population * shape.dependents);
    const elders = Math.round(population * shape.elders);
    const workingAdults = Math.max(1, population - dependents - elders);
    return { ...demography, population, dependents, workingAdults, elders,
      growthAccumulator: 0, mortalityAccumulator: 0,
      dependentToAdultAccumulator: 0, adultToElderAccumulator: 0, elderMortalityAccumulator: 0 };
  };
  const HEALTHY_SHAPE = { dependents: 0.35, elders: 0.1 };       // canonical
  const LABOR_SHOCK_SHAPE = { dependents: 0.42, elders: 0.28 };  // same total, far fewer adults
  const DEPENDENT_HEAVY_SHAPE = { dependents: 0.55, elders: 0.1 };

  function runArm(spec) {
    const base = neutralize({ ...founder, demography: withPopulation(founder.demography, spec.population, spec.shape) });
    let band = { ...base, ...(spec.deathMemory === undefined ? {} : { deathMemory: spec.deathMemory }) };
    let support;
    let tick = 1;

    // Warm the nutrition history in the arm's OPENING regime (excluded from measurement).
    const warmRegime = spec.shockYears > 0 ? spec.shockRegime : GOOD;
    for (let s = 0; s < 12; s += 1) {
      support = updateSeasonalSupportState(support, makeCarrying(warmRegime.ratio, warmRegime.perCapitaReturn), band, getWorldTimeForTick(tick));
      tick += 1;
    }
    band = { ...band, seasonalSupport: support };

    const startPopulation = band.demography.population;
    let population = startPopulation;
    let minPopulation = population;
    let maxPopulation = population;
    let births = 0;
    let deaths = 0;
    let extinctYear = null;
    let recoveryYear = null;        // first year back at/above the pre-shock population
    let firstPositiveYearAfterShock = null;
    let shockEndPopulation = null;
    const trajectory = [];
    const nutritionAtShockEnd = {};
    let clearedChronicYear = null;
    let clearedDeathMemoryYear = null;

    for (let year = 1; year <= YEARS; year += 1) {
      const inShock = year <= spec.shockYears;
      const regime = inShock ? spec.shockRegime : GOOD;
      for (let s = 0; s < 4; s += 1) {
        support = updateSeasonalSupportState(support, makeCarrying(regime.ratio, regime.perCapitaReturn), band, getWorldTimeForTick(tick));
        tick += 1;
      }
      const springTick = tick - (tick % 4);
      const next = updateBandDemography(springWorld(springTick), { ...band, seasonalSupport: support });
      births += next.lastBirths ?? 0;
      deaths += next.lastDeaths ?? 0;
      band = { ...band, seasonalSupport: support, demography: next };
      population = next.population;
      minPopulation = Math.min(minPopulation, population);
      maxPopulation = Math.max(maxPopulation, population);

      if (year === spec.shockYears) {
        shockEndPopulation = population;
        const n = survival.deriveCanonicalNutritionState(support);
        nutritionAtShockEnd.currentFoodStress = n.currentFoodStress;
        nutritionAtShockEnd.chronicFoodStress = n.chronicFoodStress;
        nutritionAtShockEnd.recoveryRelief = n.recoveryRelief;
      }
      if (!inShock) {
        if (firstPositiveYearAfterShock === null && (next.netDemographicRate ?? 0) > 0) {
          firstPositiveYearAfterShock = year - spec.shockYears;
        }
        if (recoveryYear === null && population >= startPopulation) {
          recoveryYear = year - spec.shockYears;
        }
        const n = survival.deriveCanonicalNutritionState(support);
        if (clearedChronicYear === null && n.chronicFoodStress === 0) clearedChronicYear = year - spec.shockYears;
      }
      if (clearedDeathMemoryYear === null && (band.deathMemory?.fertilitySuppressionFromRecentDeaths ?? 0) === 0 && year > spec.shockYears) {
        clearedDeathMemoryYear = year - spec.shockYears;
      }
      if (year % 25 === 0 || year === spec.shockYears || year === YEARS) {
        trajectory.push({ year, population, rate: r4(next.netDemographicRate ?? 0), workingAdults: next.workingAdults });
      }
      if (population <= 0) { extinctYear = year; break; }
    }

    const finalNutrition = survival.deriveCanonicalNutritionState(support);
    return {
      arm: spec.id,
      description: spec.description,
      startPopulation,
      shockYears: spec.shockYears,
      shockRegimeRatio: spec.shockRegime.ratio,
      startWorkingAdults: base.demography.workingAdults,
      shockEndPopulation,
      populationLostToShock: shockEndPopulation === null ? 0 : startPopulation - shockEndPopulation,
      nutritionAtShockEnd,
      finalPopulation: population,
      minPopulation,
      maxPopulation,
      extinctYear,
      recoveredToPreShockInYears: recoveryYear,
      firstPositiveRateYearAfterShock: firstPositiveYearAfterShock,
      chronicHungerClearedAfterYears: clearedChronicYear,
      deathMemoryClearedAfterYears: clearedDeathMemoryYear,
      births,
      deaths,
      finalChronicFoodStress: finalNutrition.chronicFoodStress,
      finalNutritionalSurplus: finalNutrition.nutritionalSurplus,
      finalRate: r4(band.demography.netDemographicRate ?? 0),
      recovered: extinctYear === null && population >= startPopulation,
      survived: extinctYear === null && population > 0,
      trajectory,
    };
  }

  // ── functional-state arms run in the FULL simulation ──────────────────────────────
  // The scripted harness above supplies support directly, which BYPASSES the only causal
  // path cohort composition actually has: working adults -> task-group party size
  // (`estimateTaskGroupPeople`) -> per-trip return -> harvest -> support. Measuring cohort
  // effects there would measure the harness, not production. Arms E/E2/F therefore run the
  // real pipeline on identical physically-rich ground, varying ONLY the cohort split.
  const spawn = await server.ssrLoadModule("/sim/agents/spawn.ts");
  const FULL_SIM_TILE = "tile:188:92";

  function runFullSimShapeArm(id, description, shape, years) {
    let world = runner.initSimWorld({ kind: "map2" }, `c15-basin-${id}`);
    world = spawn.removeInitialBands(world, Object.keys(world.bands));
    world = spawn.spawnCustomBands(world, [{ tileId: FULL_SIM_TILE, population: 34, name: id }], `c15-basin-${id}`);
    const bandId = Object.keys(world.bands)[0];
    const spawned = world.bands[bandId];
    const dependents = Math.round(34 * shape.dependents);
    const elders = Math.round(34 * shape.elders);
    const workingAdults = Math.max(1, 34 - dependents - elders);
    world = { ...world, bands: { ...world.bands, [bandId]: {
      ...spawned,
      demography: { ...spawned.demography, dependents, workingAdults, elders },
    } } };

    const startWorkingAdults = workingAdults;
    let minPopulation = 34;
    let sumSupport = 0;
    let seasons = 0;
    let sumPartyPeople = 0;
    let trips = 0;
    const seen = new Set();
    const trajectory = [];
    for (let season = 0; season < years * 4; season += 1) {
      world = runner.stepSim(world, 1, "seasonal");
      const band = world.bands[bandId];
      if (band === undefined) break;
      const ledger = band.carryingCapacity?.perCapitaReturn?.supportDebug?.humanFoodLedger;
      if (ledger !== undefined) { sumSupport += ledger.rawSupportRatio; seasons += 1; }
      for (const trip of band.recentIntraSeasonTrips ?? []) {
        const key = `${trip.tick}:${trip.day}:${trip.targetTileId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        sumPartyPeople += trip.estimatedPeopleCount ?? 0;
        trips += 1;
      }
      minPopulation = Math.min(minPopulation, band.demography.population);
      if (season % 100 === 0) {
        trajectory.push({ year: Math.floor(season / 4), population: band.demography.population, workingAdults: band.demography.workingAdults });
      }
    }
    const band = world.bands[bandId];
    return {
      arm: id,
      description,
      instrument: "full production simulation (real food pipeline)",
      startPopulation: 34,
      startWorkingAdults,
      finalPopulation: band?.demography.population ?? 0,
      finalWorkingAdults: band?.demography.workingAdults ?? 0,
      minPopulation,
      meanSupportRatio: r2(sumSupport / Math.max(1, seasons)),
      meanTaskGroupPeople: r2(sumPartyPeople / Math.max(1, trips)),
      survived: (band?.demography.population ?? 0) > 0,
      trajectory,
    };
  }

  const arms = [
    { id: "A_healthy_baseline", description: "Healthy 34-person founder, good country throughout", population: 34, shape: HEALTHY_SHAPE, shockYears: 0, shockRegime: GOOD },
    { id: "B_one_bad_year", description: "One physically real bad year, then the same good country", population: 34, shape: HEALTHY_SHAPE, shockYears: 1, shockRegime: BAD },
    { id: "C_three_bad_years", description: "Three bad years, then good country", population: 34, shape: HEALTHY_SHAPE, shockYears: 3, shockRegime: BAD },
    { id: "D_five_severe_years", description: "Five severe years, then good country", population: 34, shape: HEALTHY_SHAPE, shockYears: 5, shockRegime: SEVERE },
    { id: "G0_no_death_memory", description: "Identical recovery, no prior death history", population: 34, shape: HEALTHY_SHAPE, shockYears: 3, shockRegime: BAD },
    { id: "G1_heavy_death_memory", description: "Identical recovery, heavy prior death history", population: 34, shape: HEALTHY_SHAPE, shockYears: 3, shockRegime: BAD,
      deathMemory: { deathMemorySeverity: 0.62, fertilitySuppressionFromRecentDeaths: 0.34, recentDependentDeaths: 3, recentAdultDeaths: 2 } },
    { id: "I0_population_33", description: "Small initial difference: 33 people", population: 33, shape: HEALTHY_SHAPE, shockYears: 0, shockRegime: GOOD },
    { id: "I1_population_34", description: "Small initial difference: 34 people", population: 34, shape: HEALTHY_SHAPE, shockYears: 0, shockRegime: GOOD },
    { id: "I2_population_35", description: "Small initial difference: 35 people", population: 35, shape: HEALTHY_SHAPE, shockYears: 0, shockRegime: GOOD },
  ];

  const FULL_SIM_YEARS = Math.min(YEARS, 80);
  const results = arms.map(runArm);
  const fullSimResults = [
    runFullSimShapeArm("E_adult_labor_shock", "Same total population, sharply fewer working adults", LABOR_SHOCK_SHAPE, FULL_SIM_YEARS),
    runFullSimShapeArm("F_dependent_heavy", "Dependent-heavy band, identical ground", DEPENDENT_HEAVY_SHAPE, FULL_SIM_YEARS),
    runFullSimShapeArm("H_healthy_shape_control", "Canonical cohort split, identical ground (control)", HEALTHY_SHAPE, FULL_SIM_YEARS),
  ];
  const byId = Object.fromEntries([...results, ...fullSimResults].map((r) => [r.arm, r]));

  const checks = {
    // A: a healthy band in good country grows.
    healthyBaselineGrows: byId.A_healthy_baseline.finalPopulation > byId.A_healthy_baseline.startPopulation,
    // B: one bad year in good country is normally recoverable.
    oneBadYearRecovers: byId.B_one_bad_year.recovered,
    oneBadYearRecoveryBounded:
      byId.B_one_bad_year.recoveredToPreShockInYears !== null && byId.B_one_bad_year.recoveredToPreShockInYears <= 25,
    // C: moderate multi-year hardship retains a real recovery path.
    threeBadYearsRecover: byId.C_three_bad_years.recovered,
    // D: severe prolonged hardship MAY still be irreversible — recorded, not required either way.
    fiveSevereYearsOutcome: byId.D_five_severe_years.survived ? (byId.D_five_severe_years.recovered ? "recovered" : "survived_not_recovered") : "extinct",
    // E/F (full simulation): cohort composition must have a REAL causal path. The only one
    // production has is working adults -> task-group party size -> per-trip return -> support.
    adultLaborShockChangesPartySize:
      byId.E_adult_labor_shock.meanTaskGroupPeople < byId.H_healthy_shape_control.meanTaskGroupPeople,
    adultLaborShockChangesSupport:
      byId.E_adult_labor_shock.meanSupportRatio < byId.H_healthy_shape_control.meanSupportRatio,
    adultLaborShockIsCausal:
      byId.E_adult_labor_shock.finalPopulation !== byId.H_healthy_shape_control.finalPopulation ||
      byId.E_adult_labor_shock.meanSupportRatio !== byId.H_healthy_shape_control.meanSupportRatio,
    // Magnitude, reported not gated: how much a severe labor deficit actually costs.
    adultLaborSupportPenalty:
      r2(byId.H_healthy_shape_control.meanSupportRatio - byId.E_adult_labor_shock.meanSupportRatio),
    dependentHeavyNotAutomaticallyExtinct: byId.F_dependent_heavy.survived,
    dependentHeavyIsABurden:
      byId.F_dependent_heavy.meanSupportRatio < byId.H_healthy_shape_control.meanSupportRatio,
    cohortsConvergeRegardlessOfStart:
      Math.abs(byId.E_adult_labor_shock.finalWorkingAdults - byId.H_healthy_shape_control.finalWorkingAdults) <= 3,
    // G: bereavement is temporary, not a permanent fertility curse.
    deathMemoryMattersInitially:
      byId.G1_heavy_death_memory.trajectory[0].rate <= byId.G0_no_death_memory.trajectory[0].rate,
    deathMemoryDoesNotPermanentlyCurse:
      byId.G1_heavy_death_memory.survived === byId.G0_no_death_memory.survived,
    // Chronic hunger must clear under sustained physical recovery.
    chronicHungerClears:
      byId.C_three_bad_years.chronicHungerClearedAfterYears !== null &&
      byId.C_three_bad_years.finalChronicFoodStress === 0,
    // I: negligible initial differences must not bifurcate destiny.
    smallDifferencesDoNotBifurcate:
      [byId.I0_population_33, byId.I1_population_34, byId.I2_population_35].every((r) => r.survived) &&
      Math.max(byId.I0_population_33.finalPopulation, byId.I1_population_34.finalPopulation, byId.I2_population_35.finalPopulation) -
        Math.min(byId.I0_population_33.finalPopulation, byId.I1_population_34.finalPopulation, byId.I2_population_35.finalPopulation) <= 12,
  };

  const requiredChecks = [
    "healthyBaselineGrows", "oneBadYearRecovers", "oneBadYearRecoveryBounded", "threeBadYearsRecover",
    "adultLaborShockIsCausal", "adultLaborShockChangesPartySize", "adultLaborShockChangesSupport",
    "dependentHeavyNotAutomaticallyExtinct", "deathMemoryDoesNotPermanentlyCurse",
    "chronicHungerClears", "smallDifferencesDoNotBifurcate",
  ];
  const verdict = requiredChecks.every((k) => checks[k] === true) ? "PASS" : "FAIL";

  out = {
    check: "CORRECTION-15 recovery-basin matrix",
    verdict,
    years: YEARS,
    regimes: { good: GOOD, bad: BAD, severe: SEVERE },
    note: "Physical support is scripted; ALL downstream demography (nutrition history, fertility, mortality, cohorts, clamp, accumulators, surplus signal) is production.",
    checks,
    failing: requiredChecks.filter((k) => checks[k] !== true),
    results,
    fullSimulationArms: fullSimResults,
  };
} finally {
  await server.close();
}

const text = JSON.stringify(out, null, 1);
if (OUT !== "") {
  writeFileSync(OUT, text);
  console.log(JSON.stringify({ wrote: OUT, verdict: out.verdict, failing: out.failing }));
} else {
  console.log(text);
}
if (out.verdict !== "PASS") process.exitCode = 1;
