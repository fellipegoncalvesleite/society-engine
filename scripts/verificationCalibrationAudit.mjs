// CORRECTION-23 CONTINUATION §4/§5/§7/§8 — VERIFICATION SEMANTICS, CONFIRMATION-RATE
// DECOMPOSITION, CANDIDATE CALIBRATION AND LAUNCH POLICY.
//
// The construction run reported confirmed 95 / negative 2 / inconclusive 1 — a 97%
// confirmation rate. §3 forbids tuning anything until the CAUSE is established. This audit
// establishes it by measurement rather than assertion.
//
// METHOD. Production is stepped a day at a time. Every frontier-verification party is
// captured at LAUNCH (band-known record, need components, plan) and again at COMPLETION
// (outcome). Hidden world truth at the target is read ONLY to label the sample, never fed
// back into anything the simulation sees.
//
// The decisive test is a MIRROR of the on-site predicates (resolveVerificationOnSite is
// module-private). The mirror is validated against every real outcome first; a mirror that
// reproduces production exactly can then be applied counterfactually to candidates that were
// NEVER selected, which separates two very different explanations of a 97% confirmation rate:
//
//   selector cherry-picking   ->  eligible-population confirm rate << selected confirm rate
//   tautological questions    ->  eligible-population confirm rate ~= selected confirm rate
//
// It also computes, per attempt, whether the on-site predicate was ALREADY IMPLIED by the
// eligibility predicate given the coarsening map — i.e. whether the answer was determined
// before the party left.
//
// Usage: node scripts/verificationCalibrationAudit.mjs [--years 60] [--maps map1,map2]
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] !== undefined ? args[index + 1] : fallback;
};
const YEARS = Number(argOf("years", "60"));
const MAPS = String(argOf("maps", "map1,map2")).split(",");
const SEED = argOf("seed", "c23c:cal");

const r3 = (v) => Math.round((v ?? 0) * 1000) / 1000;
const pct = (n, d) => (d === 0 ? null : Math.round((n / d) * 1000) / 10);

const QUESTIONS = [
  "water_access",
  "resource_presence",
  "resource_usability",
  "temporary_use",
  "route_repeatability",
  "seasonal_persistence",
];

const server = await createServer({
  root: `${process.cwd()}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const verification = await server.ssrLoadModule("/sim/agents/frontierVerification.ts");

  // ── The MIRROR of resolveVerificationOnSite (expedition.ts:672-759). ─────────────
  // Reproduces each branch exactly. Validated against every observed production outcome
  // before it is trusted for counterfactuals.
  const mirrorOnSite = (world, tile, question, season) => {
    if (tile === undefined) return "inconclusive";

    switch (question) {
      case "water_access": {
        const hasWaterHere = tile.resourceProfile.waterAccess >= 0.3;
        const adjacentWater = tile.neighbors.some((id) => {
          const n = world.tiles[id];
          return n !== undefined && (n.isAquatic === true || n.isRiver === true || n.terrainKind === "wetlands");
        });
        return hasWaterHere || adjacentWater ? "confirmed" : "negative";
      }
      case "resource_presence":
        return tile.resourceProfile.baseRichness >= 0.22 ? "confirmed" : "negative";
      case "resource_usability": {
        const richness = tile.resourceProfile.baseRichness;
        if (richness < 0.22) return "negative";
        const lean = tile.seasonalProfile.leanSeasons.includes(season);
        return richness * (lean ? 0.25 : 0.6) > 0.12 ? "confirmed" : "negative";
      }
      case "temporary_use": {
        const liveable =
          tile.isAquatic !== true &&
          tile.riskProfile.floodRisk < 0.7 &&
          tile.resourceProfile.waterAccess >= 0.2;
        return liveable ? "confirmed" : "negative";
      }
      case "route_repeatability":
        return "confirmed";
      case "seasonal_persistence":
        return "inconclusive";
      default:
        return "inconclusive";
    }
  };

  // Can this question EVER return a negative, given the eligibility gate that admitted it?
  // `observed` is the band-known value the selector used. Returns the smallest hidden truth
  // consistent with that observation; if even the WORST case passes the on-site test, the
  // answer was determined before departure.
  const predeterminedByEligibility = (question, record) => {
    switch (question) {
      case "water_access": {
        // Shallow water is coarsened to quarter buckets then capped at 0.5; a bucket b
        // implies truth >= b - 0.125. Eligibility needs observed >= 0.28, so the lowest
        // admissible bucket is 0.5 => truth >= 0.375 > the 0.3 on-site threshold.
        const observed = record.observedWaterAccess ?? 0;
        const minTruth = record.acquisition === "residential_observation" ? observed : observed - 0.125;
        return minTruth >= 0.3;
      }
      case "resource_presence": {
        const observed = record.observedRichness ?? 0;
        const minTruth = record.acquisition === "residential_observation" ? observed : observed - 0.125;
        // NOTE: observedRichness is depletion-ADJUSTED; baseRichness is the on-site read, and
        // depletion only ever lowers the adjusted figure, so minTruthBase >= minTruthAdjusted.
        return minTruth >= 0.22;
      }
      case "resource_usability": {
        const observed = record.observedRichness ?? 0;
        const minTruth = record.acquisition === "residential_observation" ? observed : observed - 0.125;
        // Non-lean seasons need truth > 0.2; lean seasons need truth > 0.48.
        return minTruth > 0.48;
      }
      case "temporary_use":
        return false; // flood/aquatic/water are not implied by the promise gate.
      case "route_repeatability":
        return true; // unconditional confirm — no world state is read at all.
      case "seasonal_persistence":
        return true; // unconditional inconclusive.
      default:
        return false;
    }
  };

  const report = { years: YEARS, seed: SEED, maps: {} };

  for (const map of MAPS) {
    let world = runner.initSimWorld({ kind: map }, SEED);

    const launches = new Map(); // expeditionId -> launch snapshot
    const attempts = [];
    let bandDays = 0;
    let launchDaysNoUsefulRetrievalOnly = 0;
    let launchDaysHighNeed = 0;
    // §7 — candidate-population census, sampled to stay bounded.
    const census = {
      observedTilesSeen: 0,
      byQuestion: Object.fromEntries(
        QUESTIONS.map((q) => [q, { unknown: 0, known_poor: 0, promising_unverified: 0, verified_usable: 0, verified_inadequate: 0 }]),
      ),
      // counterfactual outcome over ALL promising_unverified candidates, not just selected
      counterfactual: Object.fromEntries(QUESTIONS.map((q) => [q, { confirmed: 0, negative: 0, inconclusive: 0 }])),
      samples: 0,
    };
    const scorePercentiles = [];
    const distances = [];
    const repeatTargets = new Map();

    const days = YEARS * 360;

    for (let d = 0; d < days; d += 1) {
      const before = world;
      world = runner.stepSim(world, 1, "daily");
      const season = world.time.season;

      for (const band of Object.values(world.bands)) {
        if (band.lifecycleStatus === "extinct") continue;
        bandDays += 1;

        for (const expedition of band.expeditions ?? []) {
          if (expedition.taskKind !== "frontier_verification") continue;
          if (launches.has(expedition.id)) continue;

          const priorBand = before.bands[band.id];
          const record = priorBand?.knowledge?.observedTiles?.[expedition.verificationPlan?.targetTileId];
          const need = priorBand === undefined ? undefined : verification.deriveVerificationNeed(priorBand);
          const truth = world.tiles[expedition.verificationPlan?.targetTileId];

          launches.set(expedition.id, {
            bandId: String(band.id),
            question: expedition.verificationPlan?.question,
            targetTileId: expedition.verificationPlan?.targetTileId,
            attemptIndex: expedition.verificationPlan?.attemptIndex,
            selectionReason: expedition.verificationPlan?.selectionReason,
            promisingSignal: expedition.verificationPlan?.promisingSignal,
            missingEvidence: expedition.verificationPlan?.missingEvidence,
            informationDeficit: expedition.verificationPlan?.informationDeficit,
            originatingAcquisition: expedition.verificationPlan?.originatingAcquisition,
            observedRichness: record?.observedRichness,
            observedWaterAccess: record?.observedWaterAccess,
            observedRisk: record?.observedRisk,
            confidence: record?.confidence,
            visits: record?.visits,
            seasonsObserved: record?.seasonsObserved?.length,
            acquisition: record?.acquisition,
            need: need?.need,
            foodPressure: need?.foodPressure,
            waterPressure: need?.waterPressure,
            chronicDecline: need?.chronicDecline,
            saturation: need?.saturation,
            routeTiles: expedition.routeTileIds?.length,
            launchSeason: season,
            // audit-only labelling of the sample; never fed back
            truthRichness: truth?.resourceProfile?.baseRichness,
            truthWaterAccess: truth?.resourceProfile?.waterAccess,
            truthFloodRisk: truth?.riskProfile?.floodRisk,
            predetermined:
              record === undefined
                ? null
                : predeterminedByEligibility(expedition.verificationPlan?.question, record),
          });

          if ((need?.need ?? 0) >= 0.45) launchDaysHighNeed += 1;
          else launchDaysNoUsefulRetrievalOnly += 1;

          distances.push(expedition.routeTileIds?.length ?? 0);
          const key = `${band.id}|${expedition.verificationPlan?.targetTileId}`;
          repeatTargets.set(key, (repeatTargets.get(key) ?? 0) + 1);
        }
      }

      // Completions: the attempt history is the authoritative outcome record.
      for (const band of Object.values(world.bands)) {
        const history = band.frontierVerificationAttempts ?? [];
        for (const attempt of history) {
          const id = `${band.id}|${attempt.tileId}|${attempt.question}|${String(attempt.tick)}`;
          if (attempts.some((a) => a.id === id)) continue;
          const launch = [...launches.values()].find(
            (l) => l.bandId === String(band.id) && l.targetTileId === attempt.tileId && l.question === attempt.question,
          );
          attempts.push({ id, ...attempt, tick: String(attempt.tick), launch });
        }
      }

      // §7 census — sample the whole legal candidate population periodically.
      if (d % 900 === 0) {
        for (const band of Object.values(world.bands)) {
          if (band.lifecycleStatus === "extinct") continue;
          const records = Object.values(band.knowledge?.observedTiles ?? {});
          const history = band.frontierVerificationAttempts ?? [];
          census.samples += 1;
          for (const record of records) {
            census.observedTilesSeen += 1;
            for (const question of QUESTIONS) {
              const state = verification.classifyPlaceForQuestion(record, question, history);
              census.byQuestion[question][state] += 1;
              if (state === "promising_unverified") {
                const tile = world.tiles[record.tileId];
                census.counterfactual[question][mirrorOnSite(world, tile, question, season)] += 1;
              }
            }
          }
        }
      }
    }

    // ── Mirror validation. ─────────────────────────────────────────────────────────
    let mirrorChecked = 0;
    let mirrorAgreed = 0;
    const mirrorDisagreements = [];

    for (const attempt of attempts) {
      if (attempt.launch === undefined || attempt.outcome === "lost") continue;
      const tile = world.tiles[attempt.tileId];
      const predicted = mirrorOnSite(world, tile, attempt.question, attempt.season);
      mirrorChecked += 1;
      if (predicted === attempt.outcome) mirrorAgreed += 1;
      else if (mirrorDisagreements.length < 8) {
        mirrorDisagreements.push({ question: attempt.question, predicted, actual: attempt.outcome });
      }
    }

    // ── §5 per-question outcome rates + predetermination. ──────────────────────────
    const byQuestion = {};
    for (const question of QUESTIONS) {
      const rows = attempts.filter((a) => a.question === question);
      const predetermined = rows.filter((a) => a.launch?.predetermined === true).length;
      byQuestion[question] = {
        attempts: rows.length,
        confirmed: rows.filter((a) => a.outcome === "confirmed").length,
        negative: rows.filter((a) => a.outcome === "negative").length,
        inconclusive: rows.filter((a) => a.outcome === "inconclusive").length,
        lost: rows.filter((a) => a.outcome === "lost").length,
        confirmedRate: pct(rows.filter((a) => a.outcome === "confirmed").length, rows.length),
        predeterminedByEligibility: predetermined,
        predeterminedRate: pct(predetermined, rows.length),
      };
    }

    // ── §7 selected-vs-population confirmation comparison. ─────────────────────────
    const populationVsSelected = {};
    for (const question of QUESTIONS) {
      const cf = census.counterfactual[question];
      const total = cf.confirmed + cf.negative + cf.inconclusive;
      populationVsSelected[question] = {
        eligiblePopulation: total,
        populationConfirmRate: pct(cf.confirmed, total),
        selectedConfirmRate: byQuestion[question].confirmedRate,
      };
    }

    const repeats = [...repeatTargets.values()];

    report.maps[map] = {
      bandDays,
      launches: launches.size,
      attemptsRecorded: attempts.length,
      mirror: {
        checked: mirrorChecked,
        agreed: mirrorAgreed,
        agreementRate: pct(mirrorAgreed, mirrorChecked),
        disagreements: mirrorDisagreements,
      },
      outcomeTotals: {
        confirmed: attempts.filter((a) => a.outcome === "confirmed").length,
        negative: attempts.filter((a) => a.outcome === "negative").length,
        inconclusive: attempts.filter((a) => a.outcome === "inconclusive").length,
        lost: attempts.filter((a) => a.outcome === "lost").length,
        overallConfirmRate: pct(attempts.filter((a) => a.outcome === "confirmed").length, attempts.length),
      },
      byQuestion,
      populationVsSelected,
      candidateCensus: {
        samplePasses: census.samples,
        observedTileRecordsScanned: census.observedTilesSeen,
        stateShares: Object.fromEntries(
          QUESTIONS.map((q) => {
            const s = census.byQuestion[q];
            const total = s.unknown + s.known_poor + s.promising_unverified + s.verified_usable + s.verified_inadequate;
            return [
              q,
              {
                unknownPct: pct(s.unknown, total),
                knownPoorPct: pct(s.known_poor, total),
                promisingPct: pct(s.promising_unverified, total),
                verifiedUsablePct: pct(s.verified_usable, total),
                verifiedInadequatePct: pct(s.verified_inadequate, total),
              },
            ];
          }),
        ),
      },
      launchPolicy: {
        launchesWithNeedBelow045_soCausedByNoUsefulRetrievalAlone: launchDaysNoUsefulRetrievalOnly,
        launchesWithNeedAtOrAbove045: launchDaysHighNeed,
        verificationBandDayShare: pct(launches.size, bandDays),
      },
      distanceTiles: {
        n: distances.length,
        mean: r3(distances.reduce((a, b) => a + b, 0) / Math.max(1, distances.length)),
        min: distances.length === 0 ? null : Math.min(...distances),
        max: distances.length === 0 ? null : Math.max(...distances),
      },
      repeatTargets: {
        distinctBandTargetPairs: repeats.length,
        maxRepeats: repeats.length === 0 ? 0 : Math.max(...repeats),
        pairsVisitedMoreThanOnce: repeats.filter((v) => v > 1).length,
      },
      sampleAttempts: attempts.slice(0, 12).map((a) => ({
        question: a.question,
        outcome: a.outcome,
        predetermined: a.launch?.predetermined ?? null,
        observedRichness: r3(a.launch?.observedRichness),
        truthRichness: r3(a.launch?.truthRichness),
        observedWaterAccess: r3(a.launch?.observedWaterAccess),
        truthWaterAccess: r3(a.launch?.truthWaterAccess),
        need: a.launch?.need,
        acquisition: a.launch?.acquisition,
      })),
    };

    console.log(`\n=== ${map} (${YEARS}y, seed ${SEED}) ===`);
    console.log(JSON.stringify(report.maps[map], null, 2));
  }

  mkdirSync("docs/evidence/correction23", { recursive: true });
  writeFileSync("docs/evidence/correction23/verification-calibration.json", JSON.stringify(report, null, 2));
  console.log("\nwrote docs/evidence/correction23/verification-calibration.json");
} finally {
  await server.close();
}
