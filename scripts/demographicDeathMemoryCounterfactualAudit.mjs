// CORRECTION-16 §6 — death-memory SAME-SNAPSHOT counterfactual.
//
// WHY THIS EXISTS
// ---------------
// `demographicDeathMemoryPathAudit.mjs` fails 2 of its 11 checks:
//   - directFoodTermRedundant     asserts r1.netRate >= r0.netRate
//   - deathMemoryFertilityBounded asserts r3.netRate >= r1.netRate
// Both compare TRAJECTORY MEANS of arms that ran independently for 40 years. Once the
// arms diverge they are no longer at the same state, so the comparison does not measure
// the local mechanism — §6.3 forbids exactly this ("do not compare two independently
// moving bands and call trajectory divergence a local mechanism measurement").
//
// The confound is visible in that audit's own output: mean currentFoodStress rises
// monotonically as death-memory suppression falls (R0 0.4233 -> R1 0.4347 -> R3 0.4526).
// Less fertility suppression => more people => more food stress => LOWER fertility and a
// lower net rate. Density-dependent food feedback reverses the sign the old test asserts.
//
// This audit replaces the trajectory ordering with the §6.1 test: ONE identical
// pre-demography snapshot, cloned into arms that differ ONLY in death memory, each run
// through EXACTLY ONE production annual demographic update.
//
// Usage: node scripts/demographicDeathMemoryCounterfactualAudit.mjs [--out path]
import { writeFileSync } from "node:fs";
import { createServer } from "vite";

function arg(name, dflt) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : dflt;
}
const OUT = arg("--out", "");
const SEEDS = arg("--seeds", "c16-dm-a,c16-dm-b,c16-dm-c,c16-dm-d,c16-dm-e").split(",");
const r6 = (v) => Math.round((v ?? 0) * 1e6) / 1e6;

const server = await createServer({
  root: `${process.cwd()}/src`, configFile: false, appType: "custom",
  server: { middlewareMode: true }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const demography = await server.ssrLoadModule("/sim/agents/demography.ts");

  // ── §6.1 same-snapshot vital-rate test ────────────────────────────────────────────
  // Arms differ ONLY in band.deathMemory. Support, cohorts, place, ecology, water, risk,
  // logistics, population and the WORLD object are the identical references.
  const armsFor = (band) => {
    const dm = band.deathMemory;
    const withMemory = (severity, suppression) => ({
      ...band,
      deathMemory: {
        ...(dm ?? {}),
        deathMemorySeverity: severity,
        fertilitySuppressionFromRecentDeaths: suppression,
        cautionModifier: dm?.cautionModifier ?? 0,
        recentDependentDeaths: dm?.recentDependentDeaths ?? 0,
        recentAdultDeaths: dm?.recentAdultDeaths ?? 0,
      },
    });
    return {
      // Ordered by increasing real recent-death memory.
      noDeathMemory: { band: { ...band, deathMemory: undefined }, diagnostics: undefined },
      lowDeathMemory: { band: withMemory(0.10, 0.05), diagnostics: undefined },
      highDeathMemory: { band: withMemory(0.80, 0.40), diagnostics: undefined },
      // Same high memory, but the fertility consumer disabled through diagnostics.
      highDeathMemory_fertilityDisabled: {
        band: withMemory(0.80, 0.40),
        diagnostics: { disableDeathMemoryFertility: true },
      },
    };
  };

  const perSeed = {};
  for (const seed of SEEDS) {
    let world = runner.initSimWorld({ kind: "map1" }, seed);
    // Advance to a lived state, then stop on a spring boundary so the snapshot is a real
    // annual pre-demography state rather than a synthetic one.
    world = runner.stepSim(world, 40, "seasonal");
    while (world.time.season !== "spring") world = runner.stepSim(world, 1, "seasonal");

    const TERMINAL = new Set(["dispersed", "absorbed", "extinct"]);
    const band = Object.values(world.bands)
      .filter((b) => !TERMINAL.has(String(b.status)) && b.demography.population > 6)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];
    if (band === undefined) { perSeed[seed] = { skipped: "no eligible band" }; continue; }

    const results = {};
    for (const [name, arm] of Object.entries(armsFor(band))) {
      // EXACTLY ONE production annual demographic update.
      const d = demography.updateBandDemography(world, arm.band, arm.diagnostics);
      results[name] = {
        fertilityPressure: r6(d.fertilityPressure),
        mortalityPressure: r6(d.mortalityPressure),
        netDemographicRate: r6(d.netDemographicRate),
        uncappedDemographicRate: r6(d.uncappedDemographicRate),
        population: d.population,
      };
    }

    const n = results.noDeathMemory, l = results.lowDeathMemory, hi = results.highDeathMemory;
    const off = results.highDeathMemory_fertilityDisabled;
    perSeed[seed] = {
      bandId: String(band.id),
      snapshotPopulation: band.demography.population,
      season: world.time.season,
      tick: Number(world.time.tick),
      results,
      checks: {
        // Higher real recent-death memory -> non-increasing fertility pressure.
        fertilityMonotoneNonIncreasing:
          n.fertilityPressure >= l.fertilityPressure && l.fertilityPressure >= hi.fertilityPressure,
        // -> non-increasing net and uncapped demographic rate.
        netRateMonotoneNonIncreasing:
          n.netDemographicRate >= l.netDemographicRate && l.netDemographicRate >= hi.netDemographicRate,
        uncappedRateMonotoneNonIncreasing:
          n.uncappedDemographicRate >= l.uncappedDemographicRate &&
          l.uncappedDemographicRate >= hi.uncappedDemographicRate,
        // Suppression is bounded, not dominant.
        suppressionBounded:
          n.fertilityPressure - hi.fertilityPressure <= 0.5 &&
          n.fertilityPressure - hi.fertilityPressure >= 0,
        // Mortality must NOT change: no mortality path consumes death memory.
        mortalityUnchangedAcrossDeathMemory:
          n.mortalityPressure === l.mortalityPressure &&
          l.mortalityPressure === hi.mortalityPressure,
        // Disabling the fertility consumer removes the effect entirely.
        disablingFertilityConsumerRestoresNoMemoryFertility:
          off.fertilityPressure === n.fertilityPressure,
      },
    };
  }

  // ── §6.2 cause attribution, through the pure production helper ─────────────────────
  const terms = (inputs, mode = "actual") =>
    demography.deriveDeathMemorySeverityTerms(
      { population: 24, totalDeaths: 0, dependentDeaths: 0, adultDeaths: 0,
        seasonalFoodStress: 0, seasonalWaterStress: 0, ...inputs },
      mode,
    );

  const foodStressNoDeaths = terms({ seasonalFoodStress: 1, seasonalWaterStress: 1 });
  const nonFoodDeathsAdequateFood = terms({ totalDeaths: 3, adultDeaths: 2, dependentDeaths: 1 });
  const labelledFood = terms({ totalDeaths: 3, adultDeaths: 2, dependentDeaths: 1, seasonalFoodStress: 1 });
  const cohortNeutralized = demography.deriveDeathMemorySeverityTerms(
    { population: 24, totalDeaths: 3, dependentDeaths: 1, adultDeaths: 2,
      seasonalFoodStress: 0, seasonalWaterStress: 0 }, "actual", true,
  );

  const causeAttribution = {
    foodStressWithZeroDeathsCreatesNoSuppression:
      foodStressNoDeaths.severity === 0 &&
      foodStressNoDeaths.fertilitySuppressionFromRecentDeaths === 0,
    nonFoodDeathsUnderAdequateFoodCreateBoundedSuppression:
      nonFoodDeathsAdequateFood.fertilitySuppressionFromRecentDeaths > 0 &&
      nonFoodDeathsAdequateFood.fertilitySuppressionFromRecentDeaths <= 1,
    foodLabelAloneDoesNotAlterProductionSeverity:
      labelledFood.severity === nonFoodDeathsAdequateFood.severity,
    cohortDeathsContributeOnlyThroughDocumentedCohortPath:
      cohortNeutralized.severity < nonFoodDeathsAdequateFood.severity &&
      cohortNeutralized.cohortLossSeverity === 0,
    values: { foodStressNoDeaths, nonFoodDeathsAdequateFood, labelledFood, cohortNeutralized },
  };

  const seedResults = Object.values(perSeed).filter((r) => r.checks !== undefined);
  const checkNames = Object.keys(seedResults[0]?.checks ?? {});
  const summary = Object.fromEntries(
    checkNames.map((c) => [c, {
      passedSeeds: seedResults.filter((r) => r.checks[c]).length,
      totalSeeds: seedResults.length,
      allPass: seedResults.every((r) => r.checks[c]),
    }]),
  );

  // Guard against vacuous truth: an empty seed set must never report a pass.
  const localMechanismCorrect =
    seedResults.length === SEEDS.length &&
    checkNames.length > 0 &&
    checkNames.every((c) => summary[c].allPass) &&
    causeAttribution.foodStressWithZeroDeathsCreatesNoSuppression &&
    causeAttribution.nonFoodDeathsUnderAdequateFoodCreateBoundedSuppression &&
    causeAttribution.foodLabelAloneDoesNotAlterProductionSeverity;

  out = {
    check: "CORRECTION-16 §6 death-memory same-snapshot counterfactual",
    method:
      "ONE identical spring pre-demography snapshot per seed, cloned into arms differing ONLY in band.deathMemory, each run through EXACTLY ONE production annual demographic update (updateBandDemography). Support, cohorts, place, ecology, water, risk, logistics, population and the world object are identical references across arms.",
    replaces:
      "the 40-year trajectory-mean ordering assertions directFoodTermRedundant and deathMemoryFertilityBounded in demographicDeathMemoryPathAudit.mjs",
    seeds: SEEDS,
    perSeed,
    summary,
    causeAttribution,
    localMechanismCorrect,
    classificationOfOldFailure: localMechanismCorrect
      ? "INVALID AUDIT EXPECTATION — the local mechanism is correct under a same-snapshot counterfactual; the old assertions compared trajectory means of arms that had diverged, where density-dependent food feedback (mean currentFoodStress R0 0.4233 -> R1 0.4347 -> R3 0.4526) reverses the asserted ordering."
      : "PRODUCTION REGRESSION OR MIXED — the local mechanism itself failed the same-snapshot counterfactual; see failing checks.",
    notProven: [
      "§6.3 recovery/decay of death-memory suppression under identical scripted future support is NOT measured here.",
      "This audit measures the annual vital-rate response only; it does not re-measure multi-year population outcomes.",
    ],
  };
} finally {
  await server.close();
}

const text = JSON.stringify(out, null, 1);
if (OUT !== "") writeFileSync(OUT, text);
console.log(JSON.stringify({
  summary: out.summary,
  causeAttribution: Object.fromEntries(
    Object.entries(out.causeAttribution).filter(([k]) => k !== "values"),
  ),
  localMechanismCorrect: out.localMechanismCorrect,
  classification: out.classificationOfOldFailure,
}, null, 1));
