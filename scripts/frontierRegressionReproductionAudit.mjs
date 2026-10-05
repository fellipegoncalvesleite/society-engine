// CORRECTION-18 §5 — REPRODUCE THE POPULATION REGRESSION BEFORE TOUCHING PRODUCTION.
//
// CORRECTION-17 reported that enabling frontier exploration costs 15-20% of default-map
// population. That report used 3 seeds per map and a single aggregate population figure.
// §5 forbids proceeding from an aggregate percentage: the regression must be reproduced on
// at least five predeclared shared seeds per map, and decomposed by ROOT LINEAGE and by
// WORLD across the full demographic and behavioural ledger, so that the later
// first-divergence and reader-release work has a real target rather than a headline.
//
// Nothing here changes production. The ONLY difference between arms is
// `auditOptions.frontierExplorationEnabled` (undefined = production, false = disabled).
//
// Usage: node scripts/frontierRegressionReproductionAudit.mjs
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const YEARS = 300;
// §5 — PREDECLARED shared seeds. Same five for both maps and both arms.
const SEEDS = ["c18:a", "c18:b", "c18:c", "c18:d", "c18:e"];
const MAPS = ["map1", "map2"];

const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
const mean = (xs) => (xs.length === 0 ? 0 : xs.reduce((s, v) => s + v, 0) / xs.length);
const median = (xs) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
};

const server = await createServer({
  root: `${process.cwd()}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");

  function run(map, seed, explorationEnabled) {
    let world = runner.initSimWorld({ kind: map }, seed);

    if (!explorationEnabled) {
      world = {
        ...world,
        auditOptions: { ...(world.auditOptions ?? {}), frontierExplorationEnabled: false },
      };
    }

    // Root lineages = the bands the world starts with. Every later band is attributed to
    // the root it descends from, so "by root lineage" is a real partition of the world.
    const rootOf = new Map();
    for (const id of Object.keys(world.bands)) rootOf.set(id, id);

    const m = {
      // world totals
      population: 0,
      bands: 0,
      births: 0,
      deaths: 0,
      starvationDeaths: 0,
      waterStressDeaths: 0,
      crisisDeaths: 0,
      migrationHardshipDeaths: 0,
      // behaviour
      frontierExpeditions: 0,
      otherExpeditions: 0,
      intraSeasonTrips: 0,
      residentialMoves: 0,
      fissions: 0,
      daughterFailures: 0,
      extinctions: 0,
      absorptions: 0,
      // state
      knownTilesMax: 0,
      knownTilesFinalMean: 0,
      resourceMemoriesFinalMean: 0,
      // nutrition / food (means over sampled band-years)
      annualNutritionSamples: 0,
      foodDemographicPressureSum: 0,
      currentFoodStressSum: 0,
      netDemographicRateSum: 0,
      netDemographicRateSamples: 0,
      physicalReceiptSeasons: 0,
      physicalReceiptUsableSupportSum: 0,
    };

    const countedTrips = new Set();
    const countedExpeditions = new Set();
    const countedChurnYears = new Set();
    let previousIds = new Set(Object.keys(world.bands));
    let previousPositions = new Map(
      Object.entries(world.bands).map(([id, b]) => [id, b.position]),
    );
    const perRoot = new Map();
    for (const id of previousIds) {
      perRoot.set(id, { population: 0, bands: 0, births: 0, deaths: 0, fissions: 0, extinct: false });
    }

    for (let year = 1; year <= YEARS; year += 1) {
      world = runner.stepSim(world, 4, "seasonal");
      const nowIds = new Set(Object.keys(world.bands));

      // Fissions / extinctions / absorptions, attributed to root lineage.
      for (const id of nowIds) {
        if (previousIds.has(id)) continue;

        const b = world.bands[id];
        const parentRoot = b.parentBandId === undefined ? id : rootOf.get(b.parentBandId) ?? id;
        rootOf.set(id, parentRoot);
        m.fissions += 1;
        const pr = perRoot.get(parentRoot);
        if (pr !== undefined) pr.fissions += 1;
      }

      for (const id of previousIds) {
        if (nowIds.has(id)) continue;
        m.extinctions += 1;
        const root = rootOf.get(id);
        const pr = root === undefined ? undefined : perRoot.get(root);
        if (pr !== undefined && root === id) pr.extinct = true;
      }

      for (const band of Object.values(world.bands)) {
        // Residential moves — position changed since last sample.
        const prev = previousPositions.get(band.id);
        if (prev !== undefined && prev !== band.position) m.residentialMoves += 1;

        // Births / deaths from the canonical churn ledger, once per band-year.
        const churn = band.demography.demographicChurn;
        if (churn !== undefined) {
          const key = `${band.id}:${churn.latestYear}`;
          if (!countedChurnYears.has(key)) {
            countedChurnYears.add(key);
            for (const rec of churn.records ?? []) {
              const rk = `${band.id}:rec:${rec.year}`;
              if (countedChurnYears.has(rk)) continue;
              countedChurnYears.add(rk);
              m.births += rec.births;
              m.deaths += rec.deaths;
              m.starvationDeaths += rec.starvationDeaths ?? 0;
              m.waterStressDeaths += rec.waterStressDeaths ?? 0;
              m.crisisDeaths += rec.crisisDeaths ?? 0;
              m.migrationHardshipDeaths += rec.migrationHardshipDeaths ?? 0;
              const root = rootOf.get(band.id);
              const pr = root === undefined ? undefined : perRoot.get(root);
              if (pr !== undefined) {
                pr.births += rec.births;
                pr.deaths += rec.deaths;
              }
            }
          }
        }

        // Net demographic rate.
        if (band.demography.netDemographicRate !== undefined) {
          m.netDemographicRateSum += band.demography.netDemographicRate;
          m.netDemographicRateSamples += 1;
        }

        // Annual nutrition (the demography-facing read) and current seasonal stress.
        const ss = band.seasonalSupport;
        if (ss !== undefined) {
          m.annualNutritionSamples += 1;
          m.currentFoodStressSum += ss.currentSeasonSupport?.foodStress ?? 0;
        }

        // Physical food receipts actually banked.
        const rec = band.seasonalFoodReceipts;
        if (rec !== undefined && (rec.totalUsableSupport ?? 0) > 0) {
          m.physicalReceiptSeasons += 1;
          m.physicalReceiptUsableSupportSum += rec.totalUsableSupport ?? 0;
        }

        // Expeditions and trips, deduped by id.
        for (const o of band.recentExpeditionOutcomes ?? []) {
          if (countedExpeditions.has(o.id)) continue;
          countedExpeditions.add(o.id);
          if (o.taskKind === "frontier_exploration") m.frontierExpeditions += 1;
          else m.otherExpeditions += 1;
        }

        for (const t of band.recentIntraSeasonTrips ?? []) {
          const k = `${band.id}:${t.day}:${t.targetTileId ?? "x"}:${t.taskGroupType ?? "x"}`;
          if (countedTrips.has(k)) continue;
          countedTrips.add(k);
          m.intraSeasonTrips += 1;
        }

        m.knownTilesMax = Math.max(m.knownTilesMax, Object.keys(band.knowledge.observedTiles).length);

        // Daughter failure: a band that has a parent and is below the daughter minimum.
        if (band.parentBandId !== undefined && band.demography.population < 18) {
          m.daughterFailures += 1;
        }
      }

      previousIds = nowIds;
      previousPositions = new Map(
        Object.entries(world.bands).map(([id, b]) => [id, b.position]),
      );
    }

    const finalBands = Object.values(world.bands);
    m.population = finalBands.reduce((s, b) => s + b.demography.population, 0);
    m.bands = finalBands.length;
    m.knownTilesFinalMean = r2(
      mean(finalBands.map((b) => Object.keys(b.knowledge.observedTiles).length)),
    );
    m.resourceMemoriesFinalMean = r2(
      mean(finalBands.map((b) => (b.resourceKnowledgeState?.patchMemories ?? []).length)),
    );

    for (const b of finalBands) {
      const root = rootOf.get(b.id);
      const pr = root === undefined ? undefined : perRoot.get(root);
      if (pr !== undefined) {
        pr.population += b.demography.population;
        pr.bands += 1;
      }
    }

    return {
      map,
      seed,
      explorationEnabled,
      world: {
        population: m.population,
        bands: m.bands,
        births: m.births,
        deaths: m.deaths,
        netBirthsMinusDeaths: m.births - m.deaths,
        starvationDeaths: m.starvationDeaths,
        waterStressDeaths: m.waterStressDeaths,
        crisisDeaths: m.crisisDeaths,
        migrationHardshipDeaths: m.migrationHardshipDeaths,
        meanNetDemographicRate: r3(
          m.netDemographicRateSum / Math.max(1, m.netDemographicRateSamples),
        ),
        meanCurrentFoodStress: r3(m.currentFoodStressSum / Math.max(1, m.annualNutritionSamples)),
        physicalReceiptSeasons: m.physicalReceiptSeasons,
        meanReceiptUsableSupport: r3(
          m.physicalReceiptUsableSupportSum / Math.max(1, m.physicalReceiptSeasons),
        ),
        frontierExpeditions: m.frontierExpeditions,
        otherExpeditions: m.otherExpeditions,
        intraSeasonTrips: m.intraSeasonTrips,
        residentialMoves: m.residentialMoves,
        fissions: m.fissions,
        daughterFailures: m.daughterFailures,
        extinctions: m.extinctions,
        knownTilesMax: m.knownTilesMax,
        knownTilesFinalMean: m.knownTilesFinalMean,
        resourceMemoriesFinalMean: m.resourceMemoriesFinalMean,
      },
      byRootLineage: [...perRoot.entries()]
        .map(([root, v]) => ({ root, ...v }))
        .sort((a, b) => String(a.root).localeCompare(String(b.root))),
    };
  }

  const results = [];

  for (const map of MAPS) {
    for (const seed of SEEDS) {
      for (const enabled of [true, false]) {
        const r = run(map, seed, enabled);
        results.push(r);
        console.log(
          `[${map}][${seed}][${enabled ? "ON " : "OFF"}] pop=${r.world.population} bands=${r.world.bands} ` +
            `B=${r.world.births} D=${r.world.deaths} starv=${r.world.starvationDeaths} ` +
            `trips=${r.world.intraSeasonTrips} moves=${r.world.residentialMoves} ` +
            `fis=${r.world.fissions} ext=${r.world.extinctions} ` +
            `fx=${r.world.frontierExpeditions} known=${r.world.knownTilesFinalMean}`,
        );
      }
    }
  }

  // ── Decomposition, per map. ──
  const summary = { audit: "frontierRegressionReproduction", checkpoint: "CORRECTION-18 §5", years: YEARS, seeds: SEEDS, results, perMap: {} };

  for (const map of MAPS) {
    const on = results.filter((r) => r.map === map && r.explorationEnabled);
    const off = results.filter((r) => r.map === map && !r.explorationEnabled);
    const f = (arr, k) => arr.map((r) => r.world[k]);
    const cmp = (k) => ({
      enabledMedian: r2(median(f(on, k))),
      disabledMedian: r2(median(f(off, k))),
      enabledMean: r2(mean(f(on, k))),
      disabledMean: r2(mean(f(off, k))),
      deltaMean: r2(mean(f(on, k)) - mean(f(off, k))),
      pctDeltaMean:
        mean(f(off, k)) === 0 ? null : r2(((mean(f(on, k)) - mean(f(off, k))) / mean(f(off, k))) * 100),
      perSeedEnabled: f(on, k),
      perSeedDisabled: f(off, k),
    });

    const pop = cmp("population");
    // Per-seed sign agreement is what separates a real effect from variance.
    const seedWiseLower = SEEDS.filter((s, i) => f(on, "population")[i] < f(off, "population")[i]).length;

    summary.perMap[map] = {
      population: pop,
      populationSeedsWhereEnabledIsLower: `${seedWiseLower}/${SEEDS.length}`,
      bands: cmp("bands"),
      births: cmp("births"),
      deaths: cmp("deaths"),
      netBirthsMinusDeaths: cmp("netBirthsMinusDeaths"),
      starvationDeaths: cmp("starvationDeaths"),
      waterStressDeaths: cmp("waterStressDeaths"),
      crisisDeaths: cmp("crisisDeaths"),
      migrationHardshipDeaths: cmp("migrationHardshipDeaths"),
      meanNetDemographicRate: cmp("meanNetDemographicRate"),
      meanCurrentFoodStress: cmp("meanCurrentFoodStress"),
      physicalReceiptSeasons: cmp("physicalReceiptSeasons"),
      meanReceiptUsableSupport: cmp("meanReceiptUsableSupport"),
      intraSeasonTrips: cmp("intraSeasonTrips"),
      otherExpeditions: cmp("otherExpeditions"),
      frontierExpeditions: cmp("frontierExpeditions"),
      residentialMoves: cmp("residentialMoves"),
      fissions: cmp("fissions"),
      daughterFailures: cmp("daughterFailures"),
      extinctions: cmp("extinctions"),
      knownTilesFinalMean: cmp("knownTilesFinalMean"),
      resourceMemoriesFinalMean: cmp("resourceMemoriesFinalMean"),
    };
  }

  // Classification of the CORRECTION-17 claim.
  const map1Pct = summary.perMap.map1.population.pctDeltaMean;
  const map2Pct = summary.perMap.map2.population.pctDeltaMean;
  const reproduced =
    map1Pct !== null && map2Pct !== null && map1Pct <= -10 && map2Pct <= -10;
  summary.correction17ClaimClassification = {
    claim: "enabling frontier exploration reduces default-map population by ~15-20%",
    map1PctDelta: map1Pct,
    map2PctDelta: map2Pct,
    map1SeedsLower: summary.perMap.map1.populationSeedsWhereEnabledIsLower,
    map2SeedsLower: summary.perMap.map2.populationSeedsWhereEnabledIsLower,
    classification: reproduced
      ? "REPRODUCED"
      : map1Pct !== null && map2Pct !== null && (map1Pct <= -5 || map2Pct <= -5)
        ? "PARTIALLY_REPRODUCED_SMALLER_THAN_CLAIMED"
        : "NOT_REPRODUCED",
  };

  mkdirSync(join(process.cwd(), "docs/evidence/correction18"), { recursive: true });
  writeFileSync(
    join(process.cwd(), "docs/evidence/correction18/regression-reproduction.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );

  console.log("");
  console.log("── §5 REGRESSION REPRODUCTION ──");
  for (const map of MAPS) {
    const p = summary.perMap[map];
    console.log(
      `${map}: pop ON mean=${p.population.enabledMean} OFF mean=${p.population.disabledMean} ` +
        `delta=${p.population.deltaMean} (${p.population.pctDeltaMean}%) ` +
        `seedsLower=${p.populationSeedsWhereEnabledIsLower}`,
    );
    console.log(
      `      births ${p.births.deltaMean}  deaths ${p.deaths.deltaMean}  ` +
        `starv ${p.starvationDeaths.deltaMean}  trips ${p.intraSeasonTrips.deltaMean}  ` +
        `moves ${p.residentialMoves.deltaMean}  fissions ${p.fissions.deltaMean}  ` +
        `foodStress ${p.meanCurrentFoodStress.deltaMean}`,
    );
  }
  console.log(`CLASSIFICATION: ${summary.correction17ClaimClassification.classification}`);
} finally {
  await server.close();
}
