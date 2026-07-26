// CORRECTION-18 §11 — CANDIDATE COLLECTION AND ELIGIBILITY-ORDERING AUDIT.
//
// §11 requires PROVING which of three distinct things happens to frontier-derived
// candidates, rather than assuming one:
//
//   (a) STARVATION — they never reach the candidate list, because the 18-slot budget is
//                    filled by nearer evidence families first (category concatenation
//                    gives implicit priority);
//   (b) MASKING    — they reach the list and are scored, but production keeps a single
//                    best-by-SCORE winner and only tests VIABILITY on that winner, so a
//                    viable lower-scoring candidate is discarded untested;
//   (c) HONEST LOSS — they are evaluated fairly and genuinely lose.
//
// The audit reads the production candidate ledger through the audit-only observer in
// `opportunityCandidateDiagnostics.ts`, so it reports the real decision, not a
// reconstruction. The observer is cleared in `finally`.
//
// Usage: node scripts/opportunityCandidateOrderingAudit.mjs
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const YEARS = 150;
const SEEDS = ["c18:a", "c18:b"];
const MAPS = ["map1", "map2"];
const r3 = (v) => Math.round(v * 1000) / 1000;

const server = await createServer({
  root: `${process.cwd()}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

let diagnostics;

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  diagnostics = await server.ssrLoadModule("/sim/diagnostics/opportunityCandidateDiagnostics.ts");

  const totals = {
    ledgers: 0,
    candidateIdsCollected: 0,
    candidatesEvaluated: 0,
    // (a) starvation
    ledgersWithAnyFrontierDerivedCandidate: 0,
    frontierDerivedCandidatesSeen: 0,
    // (b) masking
    ledgersWhereWinnerFailedViability: 0,
    ledgersWhereWinnerFailedButAViableCandidateExisted: 0,
    viableCandidatesDiscardedByMasking: 0,
    // (c) honest loss
    ledgersWhereWinnerPassed: 0,
    frontierDerivedThatWouldPassViability: 0,
    frontierDerivedThatWonScore: 0,
    // distance reach
    maxEvaluatedCandidateDistance: 0,
    maxViableCandidateDistance: 0,
    maxWinnerDistance: 0,
  };
  const maskingExamples = [];

  const observer = (ledger) => {
    totals.ledgers += 1;
    totals.candidateIdsCollected += ledger.candidateIdsCollected;
    totals.candidatesEvaluated += ledger.candidatesEvaluated;

    const frontierDerived = ledger.candidates.filter(
      (c) => c.acquisition === "returned_frontier_exploration",
    );
    if (frontierDerived.length > 0) totals.ledgersWithAnyFrontierDerivedCandidate += 1;
    totals.frontierDerivedCandidatesSeen += frontierDerived.length;
    totals.frontierDerivedThatWouldPassViability += frontierDerived.filter((c) => c.wouldPassViability).length;
    totals.frontierDerivedThatWonScore += frontierDerived.filter((c) => c.isScoreWinner).length;

    const viable = ledger.candidates.filter((c) => c.wouldPassViability);

    for (const c of ledger.candidates) {
      totals.maxEvaluatedCandidateDistance = Math.max(totals.maxEvaluatedCandidateDistance, c.distanceTiles);
      if (c.wouldPassViability) {
        totals.maxViableCandidateDistance = Math.max(totals.maxViableCandidateDistance, c.distanceTiles);
      }
      if (c.isScoreWinner) {
        totals.maxWinnerDistance = Math.max(totals.maxWinnerDistance, c.distanceTiles);
      }
    }

    if (ledger.winnerPassedViability) {
      totals.ledgersWhereWinnerPassed += 1;
      return;
    }

    totals.ledgersWhereWinnerFailedViability += 1;

    // (b) MASKING: the winner failed viability while a viable candidate was sitting in
    // the very same evaluated ledger, discarded only because it scored lower.
    if (viable.length > 0) {
      totals.ledgersWhereWinnerFailedButAViableCandidateExisted += 1;
      totals.viableCandidatesDiscardedByMasking += viable.length;

      if (maskingExamples.length < 12) {
        const winner = ledger.candidates.find((c) => c.isScoreWinner);
        const bestViable = [...viable].sort((a, b) => b.score - a.score)[0];
        maskingExamples.push({
          bandId: String(ledger.bandId),
          currentPerCapita: ledger.currentPerCapita,
          winner: winner === undefined ? null : {
            tileId: String(winner.tileId),
            distance: winner.distanceTiles,
            score: winner.score,
            expectedPerCapita: winner.expectedPerCapita,
            water: winner.waterReliability,
            risk: winner.riskPenalty,
            acquisition: winner.acquisition,
            wouldPassViability: winner.wouldPassViability,
          },
          maskedViableCandidate: {
            tileId: String(bestViable.tileId),
            distance: bestViable.distanceTiles,
            score: bestViable.score,
            expectedPerCapita: bestViable.expectedPerCapita,
            water: bestViable.waterReliability,
            risk: bestViable.riskPenalty,
            acquisition: bestViable.acquisition,
          },
          viableCandidatesInLedger: viable.length,
        });
      }
    }
  };

  diagnostics.setOpportunityCandidateObserver(observer);

  for (const map of MAPS) {
    for (const seed of SEEDS) {
      let world = runner.initSimWorld({ kind: map }, seed);
      for (let year = 1; year <= YEARS; year += 1) {
        world = runner.stepSim(world, 4, "seasonal");
      }
      console.log(`[${map}][${seed}] ledgers so far: ${totals.ledgers}`);
    }
  }

  diagnostics.setOpportunityCandidateObserver(undefined);

  const starvation = totals.frontierDerivedCandidatesSeen === 0;
  const maskingRate =
    totals.ledgers === 0 ? 0 : totals.ledgersWhereWinnerFailedButAViableCandidateExisted / totals.ledgers;

  const diagnosis = starvation
    ? "STARVATION — frontier-derived candidates never reached the evaluated candidate list at all"
    : maskingRate > 0.01
      ? "MASKING — a viable candidate is discarded because a higher-scoring candidate wins and then fails viability"
      : "HONEST_LOSS — frontier-derived candidates are evaluated and lose on the merits";

  const result = {
    audit: "opportunityCandidateOrdering",
    checkpoint: "CORRECTION-18 §11",
    years: YEARS,
    seeds: SEEDS,
    maps: MAPS,
    productionStructure:
      "collect bounded candidates -> keep ONE best-by-score winner -> test viability on the winner only",
    requiredStructure:
      "collect bounded candidates by evidence family -> reserve bounded representation across families -> evaluate every retained candidate -> reject invalid -> identify viable -> rank viable -> retain best viable plus best rejected diagnostics",
    totals,
    derived: {
      meanCandidateIdsCollected: r3(totals.candidateIdsCollected / Math.max(1, totals.ledgers)),
      meanCandidatesEvaluated: r3(totals.candidatesEvaluated / Math.max(1, totals.ledgers)),
      winnerFailedViabilityRate: r3(totals.ledgersWhereWinnerFailedViability / Math.max(1, totals.ledgers)),
      maskingRate: r3(maskingRate),
      frontierDerivedShareOfEvaluated: r3(
        totals.frontierDerivedCandidatesSeen / Math.max(1, totals.candidatesEvaluated),
      ),
    },
    diagnosis,
    maskingExamples,
  };

  mkdirSync(join(process.cwd(), "docs/evidence/correction18"), { recursive: true });
  writeFileSync(
    join(process.cwd(), "docs/evidence/correction18/candidate-ordering.json"),
    `${JSON.stringify(result, null, 2)}\n`,
  );

  console.log("");
  console.log("── §11 CANDIDATE ORDERING ──");
  console.log(`ledgers observed                          : ${totals.ledgers}`);
  console.log(`mean candidate ids collected              : ${result.derived.meanCandidateIdsCollected}`);
  console.log(`mean candidates evaluated                 : ${result.derived.meanCandidatesEvaluated}`);
  console.log(`frontier-derived candidates seen          : ${totals.frontierDerivedCandidatesSeen}`);
  console.log(`  ... that would pass viability           : ${totals.frontierDerivedThatWouldPassViability}`);
  console.log(`  ... that won the score                  : ${totals.frontierDerivedThatWonScore}`);
  console.log(`winner FAILED viability (rate)            : ${result.derived.winnerFailedViabilityRate}`);
  console.log(`  ... while a viable candidate existed    : ${totals.ledgersWhereWinnerFailedButAViableCandidateExisted}`);
  console.log(`viable candidates discarded by masking    : ${totals.viableCandidatesDiscardedByMasking}`);
  console.log(`max distance  evaluated/viable/winner     : ${totals.maxEvaluatedCandidateDistance} / ${totals.maxViableCandidateDistance} / ${totals.maxWinnerDistance}`);
  console.log(`DIAGNOSIS: ${diagnosis}`);
} finally {
  if (diagnostics !== undefined) diagnostics.setOpportunityCandidateObserver(undefined);
  await server.close();
}
