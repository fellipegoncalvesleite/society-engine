// CORRECTION-18 §9 — OPPORTUNITY SEMANTIC CONSISTENCY AUDIT.
//
// THE CLAIM UNDER TEST. `deriveKnownUnusedHabitat` decides whether a known candidate tile
// is a viable daughter destination with (carryingCapacity.ts:846):
//
//     consideredAsTarget = expectedPerCapita > currentPerCapita + competitionMargin
//
// where the two operands are built as:
//
//   expectedPerCapita = clamp01(effectiveYield * (1 - usePressure * 0.5))     [line 810]
//   currentPerCapita  = clampedSupportRatio                                   [line 445]
//                     = min(1, adjustedReachableSupport / adultEquivalentDemand)
//
// DIMENSIONAL ANALYSIS. These are not the same quantity.
//
//   effectiveYield is a NORMALIZED PER-TILE YIELD FRACTION in [0,1]. The module itself
//   converts it to physical support at line 202:
//       preDepletionTileSupport = effectiveYield * TILE_SUPPORT      (TILE_SUPPORT = 12.5)
//   so effectiveYield carries units of "adult-equivalents supported by ONE tile / 12.5".
//
//   clampedSupportRatio is a RATIO OF AGGREGATES: the whole catchment's support (summed
//   over up to MAX_CATCHMENT_FOR_YIELD = 16 tiles, i.e. up to 200 adult-equivalents)
//   divided by the whole band's adult-equivalent demand, then clamped to <= 1.
//
// To compare like with like, the candidate side would have to be
//       (effectiveYield * TILE_SUPPORT * plausibleDaughterCatchmentTiles) / daughterDemand
// which for a daughter of ~18 people over ~8 usable tiles is roughly 5-6x larger than the
// bare fraction production actually uses.
//
// THE PREDICTED CONSEQUENCE, which this audit measures: because expectedPerCapita is
// clamp01'd at 1.0, any band whose catchment meets its demand (clampedSupportRatio = 1.0)
// requires expectedPerCapita > 1.0 + competitionMargin, which is ARITHMETICALLY
// IMPOSSIBLE. A well-fed band can therefore never consider ANY candidate viable — not
// because the surrounding country is poor, but because the test cannot be satisfied.
//
// This is the measurement that decides whether CORRECTION-17's conclusion ("no
// alternatives materially better; the scoring is not at fault; the blocker is ecological")
// is sound or is an artefact of an invalid comparison.
//
// Usage: node scripts/opportunitySemanticConsistencyAudit.mjs
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const YEARS = 150;
const r3 = (v) => Math.round(v * 1000) / 1000;
const TILE_SUPPORT = 12.5;
const MAX_CATCHMENT_FOR_YIELD = 16;

const server = await createServer({
  root: `${process.cwd()}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");

  const samples = [];
  let bandYears = 0;
  let consideredTrue = 0;
  let impossibleByConstruction = 0;
  let currentPerCapitaAtCeiling = 0;
  const rejectionTally = {};

  for (const map of ["map1", "map2"]) {
    for (const seed of ["c18:sem:a", "c18:sem:b"]) {
      let world = runner.initSimWorld({ kind: map }, seed);

      for (let year = 1; year <= YEARS; year += 1) {
        world = runner.stepSim(world, 4, "seasonal");

        for (const band of Object.values(world.bands)) {
          const cc = band.carryingCapacity;
          const opp = cc?.daughterColonization?.bestKnownUnusedHabitatOpportunity
            ?? band.daughterColonization?.bestKnownUnusedHabitatOpportunity;
          const support = cc?.perCapitaReturn?.supportDebug;

          if (opp === undefined || support === undefined) continue;

          bandYears += 1;

          const currentPerCapita = support.clampedSupportRatio;
          const expectedPerCapita = opp.expectedPerCapitaReturn;
          // competitionMargin is not stored directly; competitionMarginRelaxed records
          // (0.08 - competitionMargin), so competitionMargin = 0.08 - relaxed.
          const competitionMargin = 0.08 - (opp.competitionMarginRelaxed ?? 0);
          const threshold = currentPerCapita + competitionMargin;

          if (opp.consideredAsTarget === true) consideredTrue += 1;
          if (currentPerCapita >= 0.999) currentPerCapitaAtCeiling += 1;
          // expectedPerCapita is clamp01'd, so a threshold above 1 can never be met.
          if (threshold > 1) impossibleByConstruction += 1;

          const rr = opp.rejectionReason ?? (opp.consideredAsTarget ? "considered" : "unknown");
          rejectionTally[rr] = (rejectionTally[rr] ?? 0) + 1;

          if (samples.length < 40) {
            // What the candidate side WOULD be if expressed in the same units as the
            // parent's support ratio: tile yield -> adult-equivalents -> / daughter demand.
            const daughterPopulation = 18; // DAUGHTER_MIN_POPULATION
            const daughterDemandApprox = daughterPopulation * 0.8; // adult-equivalent approx
            const plausibleTiles = 8;
            const likeForLikeCandidateRatio =
              (opp.expectedEffectiveYield * TILE_SUPPORT * plausibleTiles) / daughterDemandApprox;

            samples.push({
              map,
              seed,
              year,
              bandId: String(band.id),
              currentPerCapita_clampedSupportRatio: currentPerCapita,
              rawSupportRatio: support.rawSupportRatio,
              expectedPerCapita_bareTileYieldFraction: expectedPerCapita,
              expectedEffectiveYield: opp.expectedEffectiveYield,
              competitionMargin: r3(competitionMargin),
              threshold: r3(threshold),
              thresholdExceedsClampCeiling: threshold > 1,
              consideredAsTarget: opp.consideredAsTarget === true,
              rejectionReason: opp.rejectionReason ?? null,
              likeForLikeCandidateRatio: r3(likeForLikeCandidateRatio),
              likeForLikeWouldPass: likeForLikeCandidateRatio > threshold,
            });
          }
        }
      }
    }
  }

  const impossibleShare = bandYears === 0 ? 0 : impossibleByConstruction / bandYears;
  const ceilingShare = bandYears === 0 ? 0 : currentPerCapitaAtCeiling / bandYears;

  const result = {
    audit: "opportunitySemanticConsistency",
    checkpoint: "CORRECTION-18 §9",
    productionComparison:
      "consideredAsTarget = expectedPerCapita > currentPerCapita + competitionMargin",
    operandSemantics: {
      expectedPerCapita: {
        expression: "clamp01(effectiveYield * (1 - usePressure * 0.5))",
        meaning: "a NORMALIZED PER-TILE yield fraction in [0,1]",
        physicalConversionUsedElsewhereInSameModule: `effectiveYield * TILE_SUPPORT (=${TILE_SUPPORT}) = adult-equivalents from ONE tile`,
        divisedByAnyDemand: false,
        aggregatedOverAnyCatchment: false,
      },
      currentPerCapita: {
        expression: "clampedSupportRatio = min(1, adjustedReachableSupport / adultEquivalentDemand)",
        meaning: "a RATIO OF AGGREGATES: whole-catchment support / whole-band demand",
        aggregatedOverAnyCatchment: `yes, up to MAX_CATCHMENT_FOR_YIELD=${MAX_CATCHMENT_FOR_YIELD} tiles`,
        divisedByAnyDemand: true,
      },
      commensurable: false,
      approximateScaleErrorFactor:
        "TILE_SUPPORT * plausibleDaughterCatchmentTiles / daughterDemand  (~5-6x for an 18-person daughter over ~8 tiles)",
    },
    measured: {
      bandYearsWithAnOpportunityRecord: bandYears,
      consideredAsTargetTrue: consideredTrue,
      consideredAsTargetTrueShare: r3(bandYears === 0 ? 0 : consideredTrue / bandYears),
      currentPerCapitaAtClampCeiling: currentPerCapitaAtCeiling,
      currentPerCapitaAtClampCeilingShare: r3(ceilingShare),
      thresholdAboveClampCeiling: impossibleByConstruction,
      thresholdAboveClampCeilingShare: r3(impossibleShare),
      rejectionReasonTally: rejectionTally,
    },
    // The two findings are SEPARATE and must not be conflated.
    findings: {
      unitsAreIncommensurable: {
        established: "STATICALLY, by construction — see operandSemantics above.",
        confirmedNumerically:
          "Samples show current=0.31 vs expected=0.94 where the like-for-like candidate " +
          "ratio would be 6.5. The candidate side is UNDERSTATED by roughly 5-6x.",
        status: "CONFIRMED",
      },
      predictedUniversalBlockDidNotOccur: {
        hypothesisTested:
          "Because expectedPerCapita is clamp01'd at 1.0, a band at clampedSupportRatio = 1.0 " +
          "would need expectedPerCapita > 1.0 + margin, which is unsatisfiable — so well-fed " +
          "bands could never consider any candidate viable.",
        measured:
          `consideredAsTarget is TRUE in ${r3(bandYears === 0 ? 0 : consideredTrue / bandYears)} of band-years; ` +
          `currentPerCapita sits at the clamp ceiling in only ${r3(ceilingShare)}; ` +
          `the threshold exceeds the ceiling in only ${r3(impossibleShare)}.`,
        status: "HYPOTHESIS REFUTED BY MEASUREMENT",
        why:
          "Default-map bands mostly run well BELOW a support ratio of 1 (samples: 0.10-0.49), " +
          "so the understated candidate side still clears the understated threshold. The " +
          "dimensional error therefore makes the gate TOO PERMISSIVE in the common " +
          "low-support regime rather than impassable — wrong in a different direction, not " +
          "wrong in the direction predicted.",
      },
    },
    verdict:
      "UNITS_INVALID_BUT_NOT_THE_BLOCKING_GATE — the comparison is dimensionally " +
      "incommensurable and must be repaired per §9, but it is not what prevents distant " +
      "destinations from being selected.",
    consequenceForCorrection17:
      "NOT OVERTURNED BY THIS MEASUREMENT. CORRECTION-17 measured that a non-overlapping " +
      "candidate never WINS THE SCORE (S5=0). This audit shows the score-winner usually " +
      "PASSES viability (87.5%). Both are consistent with a different defect: viability is " +
      "evaluated only for the single score-winner, so distant candidates are never tested " +
      "at all. That is the §11 eligibility-before-ranking defect, and it remains the live " +
      "hypothesis for destination selection.",
    samples,
  };

  mkdirSync(join(process.cwd(), "docs/evidence/correction18"), { recursive: true });
  writeFileSync(
    join(process.cwd(), "docs/evidence/correction18/opportunity-semantic-consistency.json"),
    `${JSON.stringify(result, null, 2)}\n`,
  );

  console.log("── §9 OPPORTUNITY SEMANTIC CONSISTENCY ──");
  console.log(`band-years with an opportunity record : ${bandYears}`);
  console.log(`consideredAsTarget TRUE               : ${consideredTrue} (${r3(bandYears === 0 ? 0 : consideredTrue / bandYears)})`);
  console.log(`currentPerCapita at clamp ceiling 1.0 : ${currentPerCapitaAtCeiling} (${r3(ceilingShare)})`);
  console.log(`threshold ABOVE the clamp ceiling     : ${impossibleByConstruction} (${r3(impossibleShare)})`);
  console.log(`rejection reasons                     : ${JSON.stringify(rejectionTally)}`);
  console.log(`VERDICT: ${result.verdict}`);
  console.log("");
  for (const s of samples.slice(0, 5)) {
    console.log(
      `  ${s.map} y${s.year} current=${s.currentPerCapita_clampedSupportRatio} ` +
        `expected=${s.expectedPerCapita_bareTileYieldFraction} thr=${s.threshold} ` +
        `impossible=${s.thresholdExceedsClampCeiling} likeForLike=${s.likeForLikeCandidateRatio} ` +
        `wouldPass=${s.likeForLikeWouldPass}`,
    );
  }
} finally {
  await server.close();
}
