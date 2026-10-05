// CORRECTION-17 §15 — PARENT-RANGE OVERLAP ISOLATION.
//
// The causal-chain audit shows the chain breaking at exactly one link on 5/5 production
// seeds: L09, "opportunity evaluation on the new country". The residential knowledge
// horizon reaches 30-44 tiles, but `bestKnownUnusedHabitatOpportunity` never lands
// further than 8 tiles out. §15 requires establishing WHY before touching anything:
//
//   "Measure whether existing fission selection prefers destinations inside the parent's
//    current catchment because NO ALTERNATIVES EXIST or because the SCORING ITSELF
//    overvalues overlap."
//
// This audit separates the two, stage by stage, on a real explored band:
//
//   S1 does the band actually KNOW non-overlapping tiles?          (knowledge extent)
//   S2 do those tiles enter the CANDIDATE SET?                     (domain admission)
//   S3 do they SURVIVE the salient-summary slice?                  (candidate budget)
//   S4 do they pass `consideredAsTarget`?                          (viability criteria)
//   S5 do they LOSE the score to an overlapping candidate, and by  (scoring)
//      how much, and which TERM decides it?
//
// It reports the exact stage at which distant known country is lost, and — when the loss
// is at S5 — the head-to-head "known overlapping candidate vs known non-overlapping
// frontier candidate" comparison §15 asks for, with the per-term decomposition.
//
// Usage: node scripts/frontierOpportunityIsolationAudit.mjs
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const YEARS = 160;
const PARENT_CATCHMENT_RADIUS_TILES = 8;
const r3 = (v) => Math.round(v * 1000) / 1000;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

const server = await createServer({
  root: `${process.cwd()}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const spawn = await server.ssrLoadModule("/sim/agents/spawn.ts");

  const SEEDS = ["c17:chain:s1", "c17:chain:s2", "c17:chain:s3", "c17:chain:s4", "c17:chain:s5"];
  const perSeed = [];

  for (const seed of SEEDS) {
    let world = runner.initSimWorld({ kind: "map2" }, seed);
    world = spawn.removeInitialBands(world, Object.keys(world.bands));
    world = spawn.spawnCustomBands(world, [{ tileId: "tile:188:92", population: 34, name: "founder" }], seed);
    const founderId = Object.keys(world.bands)[0];

    const stages = {
      S1_knows_non_overlapping_tiles: 0,
      S2_non_overlapping_in_frontier_candidate_ids: 0,
      S3_survives_candidate_slice: 0,
      S4_passes_considered_as_target: 0,
      S5_wins_score: 0,
    };
    const headToHead = [];
    const distribution = {
      samples: 0,
      maxHabitatGap: -Infinity,
      maxNetGap: -Infinity,
      frontierCandidateShouldHaveWon: 0,
      worstMaskedGap: -Infinity,
    };

    for (let year = 1; year <= YEARS; year += 1) {
      world = runner.stepSim(world, 4, "seasonal");
      const band = world.bands[founderId];

      if (band === undefined) break;

      const here = world.tiles[band.position];
      const dist = (tileId) => {
        const t = world.tiles[tileId];
        return t === undefined ? undefined : Math.abs(t.coord.x - here.coord.x) + Math.abs(t.coord.y - here.coord.y);
      };

      // ── S1: does the band KNOW passable, confidence-qualified, non-overlapping tiles? ──
      const knownNonOverlapping = Object.values(band.knowledge.observedTiles).filter((rec) => {
        const d = dist(rec.tileId);
        const t = world.tiles[rec.tileId];
        return (
          d !== undefined &&
          d > PARENT_CATCHMENT_RADIUS_TILES &&
          t !== undefined &&
          t.isAquatic !== true &&
          rec.confidence >= 0.34
        );
      });

      if (knownNonOverlapping.length === 0) continue;

      stages.S1_knows_non_overlapping_tiles += 1;

      // ── S2: would they be admitted as FRONTIER records (the uncapped-distance path)? ──
      // Mirrors contextCache.isKnownFrontierRecord: passable + at least one UNOBSERVED
      // neighbour. This is the only opportunity-candidate path with no distance limit.
      const asFrontierRecords = knownNonOverlapping.filter((rec) => {
        const t = world.tiles[rec.tileId];
        return (
          t !== undefined &&
          t.neighbors.some((n) => band.knowledge.observedTiles[n] === undefined)
        );
      });

      if (asFrontierRecords.length > 0) stages.S2_non_overlapping_in_frontier_candidate_ids += 1;

      // ── S3: do they survive the MAX_FRONTIER_CANDIDATES=16 slice? ──
      // Mirrors contextCache.getRememberedOpportunityValue ordering over ALL frontier records.
      const allFrontierRecords = Object.values(band.knowledge.observedTiles).filter((rec) => {
        const t = world.tiles[rec.tileId];
        return (
          t !== undefined &&
          t.isAquatic !== true &&
          t.neighbors.some((n) => band.knowledge.observedTiles[n] === undefined)
        );
      });
      const remembered = (rec) =>
        rec.observedRichness * 0.36 +
        (rec.observedWaterAccess ?? 0) * 0.28 +
        rec.observedAquaticPotential * 0.16 +
        (rec.observedSeasonalPattern?.reliability ?? 0) * 0.1 +
        rec.confidence * 0.1 -
        (rec.observedRisk ?? 0) * 0.12;
      const sliced = [...allFrontierRecords]
        .sort((a, b) => {
          const d = remembered(b) - remembered(a);
          return d === 0 ? String(a.tileId).localeCompare(String(b.tileId)) : d;
        })
        .slice(0, 16);
      const survivors = sliced.filter((rec) => {
        const d = dist(rec.tileId);
        return d !== undefined && d > PARENT_CATCHMENT_RADIUS_TILES;
      });

      if (survivors.length > 0) stages.S3_survives_candidate_slice += 1;

      // ── S4/S5: the production opportunity outcome for this band-year. ──
      const opp = band.daughterColonization?.bestKnownUnusedHabitatOpportunity;
      const oppDist = opp === undefined ? undefined : dist(opp.candidateTileId);

      if (opp !== undefined && oppDist !== undefined && oppDist > PARENT_CATCHMENT_RADIUS_TILES) {
        stages.S5_wins_score += 1;

        if (opp.consideredAsTarget === true) stages.S4_passes_considered_as_target += 1;
      }

      // ── §15 head-to-head, on band-known records only. Reconstructs the production
      // opportunity score (carryingCapacity.deriveKnownUnusedHabitat) term by term so the
      // DECIDING TERM is visible. Uses ONLY the band's own KnownTileRecord fields.
      //
      // The DECISIVE question §15 poses is not "does the near tile win" (it does) but
      // "does a GENUINELY BETTER frontier candidate lose anyway". Answering it needs the
      // whole distribution, not a handful of samples: for every band-year we record the
      // best habitat advantage any non-overlapping candidate held, and whether that
      // advantage ever exceeded the travel penalty it was charged. A frontier candidate
      // that is not materially better habitat and loses on travel cost is the scoring
      // working correctly; one that IS materially better and still loses is the defect.
      if (survivors.length > 0) {
        const habitatOf = (rec) =>
          clamp01(rec.observedRichness) * 0.4 + clamp01(rec.observedWaterAccess ?? 0.3) * 0.24;
        const travelOf = (rec) => clamp01((dist(rec.tileId) ?? 0) / 12) * 0.2;
        const riskOf = (rec) => clamp01(rec.observedRisk ?? 0.3) * 0.18;
        const bestOverlapping = sliced
          .filter((rec) => (dist(rec.tileId) ?? 99) <= PARENT_CATCHMENT_RADIUS_TILES)
          .sort((a, b) => habitatOf(b) - travelOf(b) - riskOf(b) - (habitatOf(a) - travelOf(a) - riskOf(a)))[0];

        if (bestOverlapping !== undefined) {
          for (const rec of survivors) {
            const habitatGap = habitatOf(rec) - habitatOf(bestOverlapping);
            const travelPenaltyGap = travelOf(rec) - travelOf(bestOverlapping);
            const riskGap = riskOf(rec) - riskOf(bestOverlapping);
            const netGap = habitatGap - travelPenaltyGap - riskGap;

            distribution.samples += 1;
            distribution.maxHabitatGap = Math.max(distribution.maxHabitatGap, habitatGap);
            distribution.maxNetGap = Math.max(distribution.maxNetGap, netGap);

            // A frontier candidate whose HABITAT advantage beats the travel penalty it is
            // charged: it should have won. Count it, and remember the worst case.
            if (habitatGap > travelPenaltyGap + riskGap) {
              distribution.frontierCandidateShouldHaveWon += 1;
              distribution.worstMaskedGap = Math.max(distribution.worstMaskedGap, netGap);
            }
          }
        }
      }

      if (survivors.length > 0 && headToHead.length < 6) {
        const scoreOf = (rec) => {
          const d = dist(rec.tileId) ?? 0;
          // base.foragingPotential is derived from the RECORD's observed richness; the
          // audit uses observedRichness directly as its band-known proxy so that every
          // input here is something the band actually holds.
          const potential = clamp01(rec.observedRichness);
          const water = clamp01(rec.observedWaterAccess ?? 0.3);
          const risk = clamp01(rec.observedRisk ?? 0.3);
          const travelCost = clamp01(d / 12);
          return {
            tileId: String(rec.tileId),
            distance: d,
            potentialTerm: r3(potential * 0.4),
            waterTerm: r3(water * 0.24),
            usePressureTerm: r3(1 * 0.2),
            travelCostTerm: r3(-travelCost * 0.2),
            riskTerm: r3(-risk * 0.18),
            total: r3(potential * 0.4 + water * 0.24 + 0.2 - travelCost * 0.2 - risk * 0.18),
          };
        };
        const overlapping = sliced
          .filter((rec) => (dist(rec.tileId) ?? 99) <= PARENT_CATCHMENT_RADIUS_TILES)
          .map(scoreOf)
          .sort((a, b) => b.total - a.total)[0];
        const nonOverlapping = survivors.map(scoreOf).sort((a, b) => b.total - a.total)[0];

        if (overlapping !== undefined && nonOverlapping !== undefined) {
          headToHead.push({
            year,
            overlapping,
            nonOverlapping,
            winner: nonOverlapping.total > overlapping.total ? "non_overlapping" : "overlapping",
            margin: r3(nonOverlapping.total - overlapping.total),
            travelCostGap: r3(nonOverlapping.travelCostTerm - overlapping.travelCostTerm),
            habitatGap: r3(
              nonOverlapping.potentialTerm +
                nonOverlapping.waterTerm -
                (overlapping.potentialTerm + overlapping.waterTerm),
            ),
          });
        }
      }
    }

    for (const k of ["maxHabitatGap", "maxNetGap", "worstMaskedGap"]) {
      distribution[k] = distribution[k] === -Infinity ? null : r3(distribution[k]);
    }

    perSeed.push({ seed, stages, headToHead, distribution });
    console.log(
      `[${seed}] S1=${stages.S1_knows_non_overlapping_tiles} S2=${stages.S2_non_overlapping_in_frontier_candidate_ids} ` +
        `S3=${stages.S3_survives_candidate_slice} S4=${stages.S4_passes_considered_as_target} S5=${stages.S5_wins_score} ` +
        `| cand=${distribution.samples} maxHabitatGap=${distribution.maxHabitatGap} ` +
        `shouldHaveWon=${distribution.frontierCandidateShouldHaveWon}`,
    );
  }

  // Where is the loss?
  const sum = (k) => perSeed.reduce((s, p) => s + p.stages[k], 0);
  const totals = {
    S1_knows_non_overlapping_tiles: sum("S1_knows_non_overlapping_tiles"),
    S2_non_overlapping_in_frontier_candidate_ids: sum("S2_non_overlapping_in_frontier_candidate_ids"),
    S3_survives_candidate_slice: sum("S3_survives_candidate_slice"),
    S4_passes_considered_as_target: sum("S4_passes_considered_as_target"),
    S5_wins_score: sum("S5_wins_score"),
  };
  const allHeadToHead = perSeed.flatMap((p) => p.headToHead);
  const nonOverlappingWins = allHeadToHead.filter((h) => h.winner === "non_overlapping").length;

  const shouldHaveWon = perSeed.reduce((s, p) => s + p.distribution.frontierCandidateShouldHaveWon, 0);
  const candidatesExamined = perSeed.reduce((s, p) => s + p.distribution.samples, 0);
  const maxHabitatGap = Math.max(...perSeed.map((p) => p.distribution.maxHabitatGap ?? -1));

  const lossStage =
    totals.S1_knows_non_overlapping_tiles === 0
      ? "S1_no_non_overlapping_knowledge"
      : totals.S2_non_overlapping_in_frontier_candidate_ids === 0
        ? "S2_domain_admission"
        : totals.S3_survives_candidate_slice === 0
          ? "S3_candidate_budget_slice"
          : totals.S5_wins_score === 0
            ? "S5_scoring"
            : "none";

  const summary = {
    audit: "frontierOpportunityIsolation",
    checkpoint: "CORRECTION-17 §15",
    question:
      "Does fission selection prefer destinations inside the parent catchment because NO " +
      "ALTERNATIVES EXIST, or because the SCORING overvalues overlap?",
    bandYearTotals: totals,
    firstLossStage: lossStage,
    headToHeadSamples: allHeadToHead,
    headToHeadNonOverlappingWins: nonOverlappingWins,
    headToHeadTotal: allHeadToHead.length,
    // The §15 verdict proper. `frontierCandidateShouldHaveWon` counts non-overlapping
    // candidates whose HABITAT advantage exceeded the travel+risk penalty they were
    // charged and which lost anyway. Zero means the scoring is preferring near country
    // because the far country genuinely is not better, NOT because it overvalues overlap
    // — and in that case tuning the travel-cost term would be threshold tuning WITHOUT a
    // demonstrated defect, which this checkpoint forbids.
    nonOverlappingCandidatesExamined: candidatesExamined,
    frontierCandidateShouldHaveWon: shouldHaveWon,
    maxHabitatAdvantageObserved: maxHabitatGap,
    overlapVerdict:
      shouldHaveWon > 0
        ? "scoring_overvalues_overlap_defect_present"
        : "no_alternatives_materially_better_scoring_not_at_fault",
    perSeed,
  };

  mkdirSync(join(process.cwd(), "docs/evidence/correction17"), { recursive: true });
  writeFileSync(
    join(process.cwd(), "docs/evidence/correction17/frontier-opportunity-isolation.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );

  console.log("");
  console.log("── §15 ISOLATION ──");
  console.log(JSON.stringify(totals, null, 2));
  console.log(`first loss stage       : ${lossStage}`);
  console.log(`head-to-head samples   : ${allHeadToHead.length}, non-overlapping wins: ${nonOverlappingWins}`);
  console.log(`non-overlapping cands  : ${candidatesExamined}`);
  console.log(`should have won        : ${shouldHaveWon}`);
  console.log(`max habitat advantage  : ${maxHabitatGap}`);
  console.log(`OVERLAP VERDICT        : ${summary.overlapVerdict}`);

  for (const h of allHeadToHead.slice(0, 4)) {
    console.log(
      `  y${h.year} nonOverlap(d=${h.nonOverlapping.distance}) ${h.nonOverlapping.total} vs ` +
        `overlap(d=${h.overlapping.distance}) ${h.overlapping.total} -> ${h.winner} ` +
        `margin=${h.margin} travelCostGap=${h.travelCostGap} habitatGap=${h.habitatGap}`,
    );
  }
} finally {
  await server.close();
}
