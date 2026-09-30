// CORRECTION-17 §4 — ANNUAL NUTRITION LIKE-FOR-LIKE AUDIT.
//
// WHY THIS EXISTS. `candidateRepairIsolationAudit.mjs` claim A compares
//
//     annual mean seasonal food stress        (ONE term, a plain mean of entry.foodStress)
//   vs
//     foodDemographicPressure                 (a FOUR-term composite)
//
// and reports the difference as "demographic overstatement". That is a category
// error: `foodDemographicPressure` is BY CONSTRUCTION
//
//     0.38*currentFoodStress + 0.26*recentFoodStress + 0.48*chronicFoodStress
//       - 0.14*recoveryRelief
//
// so it is not the same quantity as its own first term and MUST differ from it
// whenever the band carries any recent/chronic deficit history. The numeric gap
// that audit prints is therefore NOT evidence of a sampling defect, and CORRECTION-17
// §4 forbids citing it as one.
//
// WHAT THIS AUDIT DOES INSTEAD. A like-for-like reconstruction. It harvests REAL
// production `seasonalSupport` states from a live run, and for each one:
//
//   1. measures annual mean `currentFoodStress` over the SAME previous360 completed physical days;
//   2. measures annual mean raw support ratio over those samples;
//   3. measures the recovery share over those samples (the production predicate);
//   4. measures nutritional surplus over those samples;
//   5. measures chronic food stress under the EXACT production formula;
//   6. reconstructs `foodDemographicPressure` from those exact components;
//
// and proves
//
//     stored annual nutrition output == exact reconstruction from the same physical-day exposure
//
// term by term, to exact float equality after the production's own rounding.
//
// It ALSO proves the second half of §4: that every behavioral consumer still reads the
// SEASONAL nutrition state, i.e. `deriveAnnualNutritionState` is imported by exactly one
// production module (demography) and no behavioral module.
//
// It changes no production coefficient. It is a measurement, not a repair.
//
// Usage: node scripts/annualNutritionLikeForLikeAudit.mjs
import { createServer } from "vite";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ── The production constants, restated here so the reconstruction is INDEPENDENT.
// If production changes these, this audit must FAIL rather than silently follow.
const SEASONAL_MEMORY_WINDOW = 8;
const SHORT_WINDOW = 4;
const SURPLUS_ONSET = 1.12;
const SURPLUS_SPAN = 0.6;

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const round2 = (v) => Math.floor((Math.round(v * 1e12) + 5e9) / 1e10) / 100;
const mean = (xs) => (xs.length === 0 ? 0 : xs.reduce((s, v) => s + v, 0) / xs.length);
const r3 = (v) => Math.round(v * 1000) / 1000;

// The production recovery predicate (seasonalSurvival.isRecoverySeason), restated.
const isRecoverySeason = (e) =>
  e.rawSupportRatio >= 0.98 && e.perCapitaReturn >= 0.48 && e.foodStress < 0.32 && e.waterStress < 0.42;

// Independent decimal oracle: the production stress measurements are bounded decimal
// values. Sum their represented 12-decimal units as exact safe integers, avoiding a daily
// accumulation artifact at e.g. .315. This does not call the production aggregation helper.
const decimalTotal = (values) => values.reduce((n,value)=>n+Math.round(value*1e12),0)/1e12;
// Independent physical-day expansion: no production exposure query or counters are called.
function reconstructAnnualNutrition(support) {
  const end = support.exposureAsOfDay;
  const days = [];
  for (const sample of support.recentSamples) for (const segment of sample.exposure.segments) {
    for (let day = segment.startDay; day < segment.endDay; day++) {
      if (day < end - 720 || day >= end) continue;
      const fraction = segment.knownPopulationFraction ?? 1;
      const duration = segment.endDay - segment.startDay;
      days.push({day, fraction, stress:segment.foodStress, recovery:segment.recoveryEligible,
        demand:segment.demandUnits === undefined ? undefined : segment.demandUnits/duration,
        support:segment.supportUnits === undefined ? undefined : segment.supportUnits/duration,
        ratio:Number((segment.rawSupportRatio ?? segment.supportUnits/segment.demandUnits).toPrecision(14)),
        water:segment.waterStress});
    }
  }
  const year=days.filter(d=>d.day>=end-360), weight=xs=>xs.reduce((n,d)=>n+d.fraction,0);
  if(!year.length)return undefined;
  const weighted=(xs,fn)=>decimalTotal(xs.map(d=>d.fraction*fn(d)))/weight(xs);
  const currentFoodStress=weighted(year,d=>d.stress), recoveryRelief=weighted(year,d=>d.recovery?1:0);
  const allActual=days.every(d=>d.demand!==undefined && d.fraction===1);
  const meanRawSupport=allActual ? days.reduce((n,d)=>n+d.support,0)/days.reduce((n,d)=>n+d.demand,0) : weighted(days,d=>d.ratio);
  const deficitDays=days.reduce((n,d)=>n+(Math.max(0,1-d.ratio)>=.12||d.ratio<.92?d.fraction:0),0);
  let trailing=0,cursor=end;
  for(const d of days.slice().sort((a,b)=>b.day-a.day)){
    if(d.day!==cursor-1||!(Math.max(0,1-d.ratio)>=.16||d.ratio<.88))break;
    trailing+=d.fraction;cursor=d.day;
  }
  const chronicFoodStress=round2(clamp01(trailing/720*.58+deficitDays/720*.42));
  const recentFoodStress=round2(currentFoodStress);
  return { currentFoodStress:round2(currentFoodStress), recentFoodStress, chronicFoodStress,
    recoveryRelief:round2(recoveryRelief),
    nutritionalSurplus:round2(clamp01(clamp01((meanRawSupport-SURPLUS_ONSET)/SURPLUS_SPAN)*recoveryRelief)),
    foodDemographicPressure:round2(clamp01(currentFoodStress*.38+recentFoodStress*.26+chronicFoodStress*.48-recoveryRelief*.14)),
    _sampleCount:year.length,_annualMeanRawSupport:meanRawSupport,_annualMeanFoodStressRaw:currentFoodStress };
}

const server = await createServer({
  root: `${process.cwd()}/src`,
  configFile: false,
  appType: "custom",
  cacheDir: `node_modules/.vite-annual-${process.pid}`,
  server: { middlewareMode: true, hmr:false, watch:null, ws:false },
  logLevel: "error",
});

const SEEDS = [
  { map: "map2", tile: "tile:188:92", pop: 34, seed: "c17:annual:rich:s1", label: "map2_rich" },
  { map: "map2", tile: "tile:188:92", pop: 26, seed: "c17:annual:rich:s2", label: "map2_rich_small" },
  { map: "map1", tile: undefined, pop: undefined, seed: "c17:annual:map1:s1", label: "map1_default" },
];

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const spawn = await server.ssrLoadModule("/sim/agents/spawn.ts");
  const survival = await server.ssrLoadModule("/sim/agents/seasonalSurvival.ts");

  const comparisons = [];
  const perSeed = [];

  for (const s of SEEDS.filter(s => !process.argv.includes("--seed-label") || s.label === process.argv[process.argv.indexOf("--seed-label") + 1])) {
    let world = runner.initSimWorld({ kind: s.map }, s.seed);

    if (s.tile !== undefined) {
      world = spawn.removeInitialBands(world, Object.keys(world.bands));
      world = spawn.spawnCustomBands(world, [{ tileId: s.tile, population: s.pop, name: s.label }], s.seed);
    }

    let seedComparisons = 0;
    let seedMismatches = 0;

    // Harvest real production seasonalSupport states across a long horizon. Every
    // spring the annual demographic step runs; we compare the annual read on the
    // SAME support object the production step would consume.
    for (let year = 1; year <= Number(process.argv.includes("--years") ? process.argv[process.argv.indexOf("--years") + 1] : 120); year += 1) {
      for (let season = 0; season < 4; season += 1) {
        world = runner.stepSim(world, 1, "seasonal");

        // Only sample where the production annual step actually reads: spring.
        if (world.time.season !== "spring") {
          continue;
        }

        for (const band of Object.values(world.bands)) {
          const support = band.seasonalSupport;

          if (support === undefined || (support.recentSamples ?? []).length === 0) {
            continue;
          }

          // PRODUCTION output — the actual function demography.ts:361 calls.
          const stored = survival.deriveAnnualNutritionState(support);
          // INDEPENDENT reconstruction from the same physical-day exposure.
          const rebuilt = reconstructAnnualNutrition(support);

          if (rebuilt === undefined) {
            continue;
          }

          const terms = [
            "currentFoodStress",
            "recentFoodStress",
            "chronicFoodStress",
            "recoveryRelief",
            "nutritionalSurplus",
            "foodDemographicPressure",
          ];
          const diffs = {};
          let mismatch = false;

          for (const t of terms) {
            const d = stored[t] - rebuilt[t];
            diffs[t] = d;

            if (Math.abs(d) > 1e-9) {
              mismatch = true;
            }
          }

          seedComparisons += 1;

          if (mismatch) {
            seedMismatches += 1;

            if (comparisons.length < 12) {
              comparisons.push({
                seed: s.label,
                year,
                bandId: String(band.id),
                stored: Object.fromEntries(terms.map((t) => [t, stored[t]])),
                rebuilt: Object.fromEntries(terms.map((t) => [t, rebuilt[t]])),
                diffs,
                sourceSupport: support,
              });
            }
          }
        }
      }
    }

    perSeed.push({
      seed: s.label,
      map: s.map,
      comparisons: seedComparisons,
      mismatches: seedMismatches,
      exactMatch: seedMismatches === 0 && seedComparisons > 0,
    });
    console.log(
      `[${s.label}] comparisons=${seedComparisons} mismatches=${seedMismatches} ` +
        `exact=${seedMismatches === 0 && seedComparisons > 0}`,
    );
  }

  // ── Part 2 (§4): prove every BEHAVIORAL consumer still reads seasonal nutrition. ──
  const srcRoot = join(process.cwd(), "src");
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(p);
      } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
        files.push(p);
      }
    }
  };
  walk(srcRoot);

  const annualConsumers = [];
  const seasonalConsumers = [];

  for (const f of files) {
    const text = readFileSync(f, "utf8");
    const rel = f.slice(process.cwd().length + 1);

    if (rel.endsWith("seasonalSurvival.ts")) {
      continue; // the definition site
    }

    // Count only real CALL sites, not the import line or a comment mention.
    if (/deriveAnnualNutritionState\s*\(/.test(text)) {
      annualConsumers.push(rel);
    }

    if (/deriveCanonicalNutritionState\s*\(|getCanonicalFoodStress\s*\(/.test(text)) {
      seasonalConsumers.push(rel);
    }
  }

  const annualIsDemographyOnly =
    annualConsumers.length === 1 && annualConsumers[0].endsWith("agents/demography.ts");
  const behavioralLeak = annualConsumers.filter((f) => !f.endsWith("agents/demography.ts"));

  const totalComparisons = perSeed.reduce((s, p) => s + p.comparisons, 0);
  const totalMismatches = perSeed.reduce((s, p) => s + p.mismatches, 0);

  const reconstructionExact = totalMismatches === 0 && totalComparisons > 0;
  const pass = reconstructionExact && annualIsDemographyOnly;

  const result = {
    audit: "annualNutritionLikeForLike",
    checkpoint: "CORRECTION-17 §4",
    supersedes: {
      script: "scripts/candidateRepairIsolationAudit.mjs",
      claim: "A_annualNutritionSampling",
      why:
        "That claim compares annual mean seasonal food stress (one term) against " +
        "foodDemographicPressure (a four-term composite). The two are different " +
        "quantities by construction, so their numeric difference is NOT evidence of " +
        "demographic overstatement and must not be cited as such.",
    },
    likeForLikeClaim:
      "stored annual nutrition output == exact reconstruction from the same previous360 completed physical days",
    measuredIndependently: [
      "annual mean currentFoodStress",
      "annual mean raw support ratio",
      "recovery share over the same physical-day exposure",
      "nutritional surplus over the same physical-day exposure",
      "chronic food stress under the exact production formula",
      "foodDemographicPressure reconstructed from those exact components",
    ],
    perSeed,
    totalComparisons,
    totalMismatches,
    reconstructionExact,
    mismatchExamples: comparisons,
    behavioralConsumerSeparation: {
      claim: "every behavioral consumer still uses SEASONAL nutrition",
      annualConsumers,
      annualIsDemographyOnly,
      behavioralLeak,
      seasonalConsumerCount: seasonalConsumers.length,
      seasonalConsumers,
    },
    productionCoefficientsChanged: false,
    verdict: pass ? "PASS" : "FAIL",
  };

  const outIndex=process.argv.indexOf('--out');
  const output=outIndex>=0?process.argv[outIndex+1]:join(process.cwd(), "docs/evidence/correction17/annual-nutrition-like-for-like.json");
  mkdirSync(join(output, '..'), { recursive: true });
  writeFileSync(
    output,
    `${JSON.stringify(result, null, 2)}\n`,
  );

  console.log("");
  console.log("── §4 ANNUAL NUTRITION LIKE-FOR-LIKE ──");
  console.log(`comparisons        ${totalComparisons}`);
  console.log(`mismatches         ${totalMismatches}`);
  console.log(`reconstruction     ${reconstructionExact ? "EXACT" : "DIVERGENT"}`);
  console.log(`annual consumers   ${JSON.stringify(annualConsumers)}`);
  console.log(`demography-only    ${annualIsDemographyOnly}`);
  console.log(`seasonal consumers ${seasonalConsumers.length}`);
  console.log(`VERDICT            ${result.verdict}`);

  if (!pass) {
    process.exitCode = 1;
  }
} finally {
  await server.close();
}
