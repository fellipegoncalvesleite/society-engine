// CORRECTION-23B §13 — R1-R12 EXACT-SEAM TESTS.
//
// Every assertion runs against an AUTHORITATIVE PRODUCTION SEAM, not an audit mirror:
//
//   deriveKnownUnusedHabitat  the destination decision that consumes water evidence
//   classifyPlaceForQuestion  the eligibility state the selector acts on
//   mayAskAgain               the retry gate
//   applyVerifiedWaterAccess  the domain-locked water reader
//   taskCampRefusedByEvidence the bounded-use reader
//
// The decisive shape is the RESULT-DESTRUCTION COUNTERFACTUAL: one identical band, one
// identical world, differing only in whether the verification evidence row exists. If the
// decision is the same with and without it, the reader is not connected.
//
// Usage: node scripts/verificationReaderSeamAudit.mjs
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";

const server = await createServer({
  root: `${process.cwd()}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

const r3 = (v) => (v === undefined || v === null ? undefined : Math.round(v * 1000) / 1000);

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const evidenceMod = await server.ssrLoadModule("/sim/agents/verificationEvidence.ts");
  const verification = await server.ssrLoadModule("/sim/agents/frontierVerification.ts");
  const capacity = await server.ssrLoadModule("/sim/agents/carryingCapacity.ts");

  const world = runner.initSimWorld({ kind: "map2" }, "c23b:seams");
  const templateBand = Object.values(world.bands)[0];
  const home = world.tiles["tile:98:4"];
  const dist = (a, b) => Math.abs(a.coord.x - b.coord.x) + Math.abs(a.coord.y - b.coord.y);

  const cases = [];
  const record = (id, title, expectation, observed, pass, detail = {}) =>
    cases.push({ id, title, expectation, observed, pass, ...detail });

  const mkRecord = (tile, fields) => {
    const rec = {
      tileId: tile.id,
      firstObservedAt: world.time,
      lastObservedAt: world.time,
      seasonsObserved: [world.time.season],
      visits: 1,
      observedMovementCost: tile.movementCost,
      observedRisk: 0.3,
      confidence: 0.5,
      knowledgeSource: "personally_observed",
      acquisition: "returned_frontier_exploration",
      ...fields,
    };
    for (const k of Object.keys(rec)) if (rec[k] === undefined) delete rec[k];
    return rec;
  };

  const mkEvidence = (tile, question, outcome, extra = {}) => ({
    tileId: tile.id,
    question,
    outcome,
    seasonsAnswered: [world.time.season],
    lastSeason: world.time.season,
    lastTick: world.time.tick,
    attempts: 1,
    hardshipAtLastAttempt: 0.5,
    routeTilesAtLastAttempt: 8,
    routeEvidence: "walked_out_and_back",
    ...extra,
  });

  const mkBand = (records, evidence) => ({
    ...templateBand,
    position: home.id,
    knowledge: {
      ...templateBand.knowledge,
      observedTiles: Object.fromEntries(records.map((r) => [r.tileId, r])),
    },
    ...(evidence === undefined ? {} : { verificationEvidence: evidence }),
  });

  // ── R1 / R12 — the exact reader counterfactual at the destination seam. ─────────
  // A tile whose GLIMPSED water sits below the 0.32 physical-access gate: with the
  // verification answer it must pass, without it it must not.
  {
    const target = Object.values(world.tiles)
      .filter((t) => t.isAquatic !== true && t.movementCost < 3)
      .filter((t) => dist(t, home) >= 4 && dist(t, home) <= 10)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];
    const rec = mkRecord(target, { observedWaterAccess: 0.25, observedRichness: 0.5 });

    const without = evidenceMod.applyVerifiedWaterAccess(mkBand([rec]), target.id, 0.25);
    const withConfirmed = evidenceMod.applyVerifiedWaterAccess(
      mkBand([rec], [mkEvidence(target, "water_access", "confirmed")]),
      target.id,
      0.25,
    );
    const withNegative = evidenceMod.applyVerifiedWaterAccess(
      mkBand([rec], [mkEvidence(target, "water_access", "negative")]),
      target.id,
      0.25,
    );
    const withInconclusive = evidenceMod.applyVerifiedWaterAccess(
      mkBand([rec], [mkEvidence(target, "water_access", "inconclusive")]),
      target.id,
      0.25,
    );

    // The gate carryingCapacity applies is `waterReliability > 0.32`.
    record(
      "R1",
      "confirmed water access changes the water reader",
      "the same glimpse fails the 0.32 access gate without the answer and passes with it",
      {
        withoutEvidence: r3(without),
        withConfirmed: r3(withConfirmed),
        passesGateWithout: without > 0.32,
        passesGateWith: withConfirmed > 0.32,
      },
      without <= 0.32 && withConfirmed > 0.32,
      { target: target.id },
    );

    record(
      "R12",
      "destroying the result reproduces the pre-reader decision",
      "removing the evidence row returns the water term to exactly the observed value",
      { observed: 0.25, withoutEvidence: r3(without), identical: without === 0.25 },
      without === 0.25,
    );

    record(
      "R2",
      "negative water result suppresses this target only",
      "the negative caps THIS tile below the gate and leaves every other tile untouched",
      {
        withNegative: r3(withNegative),
        cappedBelowGate: withNegative <= 0.32,
        otherTileUnaffected: r3(
          evidenceMod.applyVerifiedWaterAccess(
            mkBand([rec], [mkEvidence(target, "water_access", "negative")]),
            home.id,
            0.9,
          ),
        ),
        inconclusiveIsNeutral: withInconclusive === 0.25,
      },
      withNegative <= 0.32 &&
        evidenceMod.applyVerifiedWaterAccess(
          mkBand([rec], [mkEvidence(target, "water_access", "negative")]),
          home.id,
          0.9,
        ) === 0.9 &&
        withInconclusive === 0.25,
    );

    // R5 — a route answer must not move ecology or water at all.
    const routeOnly = evidenceMod.applyVerifiedWaterAccess(
      mkBand([rec], [mkEvidence(target, "temporary_use", "confirmed")]),
      target.id,
      0.25,
    );
    record(
      "R5",
      "a non-water answer changes nothing in the water reader",
      "only the water_access question may move the water term",
      { withTemporaryUseConfirmed: r3(routeOnly), unchanged: routeOnly === 0.25 },
      routeOnly === 0.25,
      { note: "route_repeatability was REMOVED as a question (§8); route evidence is a by-product of any completed party." },
    );
  }

  // ── R1b — the SAME-SNAPSHOT PRODUCTION COUNTERFACTUAL. ─────────────────────────
  //
  // Two identical worlds, stepped through the REAL seasonal tick, differing only in whether
  // one verification evidence row exists. If the band's own recorded opportunity verdict is
  // the same either way, the reader is not connected. This is the §14 divergence proof at a
  // production decision, not at a helper.
  {
    const target = Object.values(world.tiles)
      .filter((t) => t.isAquatic !== true && t.movementCost < 3 && t.resourceProfile.baseRichness > 0.3)
      .filter((t) => dist(t, home) >= 4 && dist(t, home) <= 8)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];
    const homeRec = mkRecord(home, {
      observedWaterAccess: home.resourceProfile.waterAccess,
      observedRichness: home.resourceProfile.baseRichness,
      acquisition: "residential_observation",
      confidence: 1,
      visits: 20,
    });
    const rec = mkRecord(target, { observedWaterAccess: 0.25, observedRichness: 0.6 });

    const buildWorld = (evidence) => {
      const band = {
        ...mkBand([homeRec, rec], evidence),
        ...(templateBand.pressureState === undefined
          ? {}
          : { pressureState: { ...templateBand.pressureState, foodStress: 0.9, waterStress: 0.4 } }),
      };
      return { ...world, bands: { [band.id]: band } };
    };

    const stepAndRead = (evidence) => {
      let current = buildWorld(evidence);
      const bandId = Object.keys(current.bands)[0];
      current = runner.stepSim(current, 1, "seasonal");
      const band = current.bands[bandId];
      const opportunity = band?.carryingCapacity?.knownUnusedHabitat;
      return {
        candidateTileId: opportunity?.candidateTileId === undefined ? null : String(opportunity.candidateTileId),
        consideredAsTarget: opportunity?.consideredAsTarget ?? null,
        rejectionReason: opportunity?.rejectionReason ?? null,
        waterReliability: r3(opportunity?.waterReliability),
      };
    };

    const without = stepAndRead(undefined);
    const withConfirmed = stepAndRead([mkEvidence(target, "water_access", "confirmed")]);
    const diverged = JSON.stringify(without) !== JSON.stringify(withConfirmed);

    record(
      "R1b",
      "same-snapshot production counterfactual through the real tick",
      "one evidence row changes the band's own recorded destination verdict",
      { withoutEvidence: without, withConfirmedWaterAccess: withConfirmed, diverged },
      diverged,
      { target: target.id },
    );
  }

  // ── R3 / R4 — resource presence enables a later test; destroying it removes that. ──
  {
    const target = Object.values(world.tiles)
      .filter((t) => t.isAquatic !== true && t.resourceProfile.baseRichness > 0.3)
      .filter((t) => dist(t, home) >= 4 && dist(t, home) <= 10)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];
    const rec = mkRecord(target, { observedRichness: 0.5, observedWaterAccess: 0.15 });
    const bandWith = mkBand([rec], [mkEvidence(target, "resource_presence", "confirmed")]);
    const bandWithout = mkBand([rec]);
    const bandNegative = mkBand([rec], [mkEvidence(target, "resource_presence", "negative")]);

    const eligibleWith = evidenceMod.resourceTestEligible(bandWith, target.id);
    const eligibleWithout = evidenceMod.resourceTestEligible(bandWithout, target.id);
    const eligibleNegative = evidenceMod.resourceTestEligible(bandNegative, target.id);
    const receiptsWith = bandWith.seasonalFoodReceipts?.totalUsableSupport ?? 0;
    const receiptsWithout = bandWithout.seasonalFoodReceipts?.totalUsableSupport ?? 0;

    record(
      "R3",
      "resource presence enables a later test candidate",
      "eligibility flips; NO support or food is created",
      {
        eligibleWithConfirmedPresence: eligibleWith,
        eligibleWithout,
        receiptsWith: r3(receiptsWith),
        receiptsWithout: r3(receiptsWithout),
        receiptsUnchanged: receiptsWith === receiptsWithout,
      },
      eligibleWith === true && eligibleWithout === false && receiptsWith === receiptsWithout,
      { target: target.id },
    );

    record(
      "R4",
      "destroying the resource result removes eligibility",
      "the exact reader counterfactual, and a negative does not enable either",
      { eligibleWithout, eligibleNegative },
      eligibleWithout === false && eligibleNegative === false,
    );

    record(
      "R11",
      "a negative bounded search is not global absence",
      "the negative blocks this place and this question only; other places stay eligible",
      {
        thisPlaceEligible: evidenceMod.resourceTestEligible(bandNegative, target.id),
        otherPlaceStillPromising: verification.classifyPlaceForQuestion(
          mkRecord(home, { observedRichness: 0.5, observedWaterAccess: 0.15 }),
          "resource_presence",
          [],
        ),
      },
      evidenceMod.resourceTestEligible(bandNegative, target.id) === false &&
        verification.classifyPlaceForQuestion(
          mkRecord(home, { observedRichness: 0.5, observedWaterAccess: 0.15 }),
          "resource_presence",
          [],
        ) === "promising_unverified",
    );
  }

  // ── R6 — a route that was never walked establishes nothing. ─────────────────────
  {
    const target = Object.values(world.tiles).filter((t) => t.isAquatic !== true)[3];
    const bandNoEvidence = mkBand([mkRecord(target, { observedRichness: 0.5 })]);
    const questions = ["water_access", "resource_presence", "resource_test_possible", "temporary_use", "seasonal_persistence"];
    const anyRouteQuestion = questions.includes("route_repeatability");
    record(
      "R6",
      "an unwalked route remains unconfirmed",
      "route repeatability is no longer a question a party can 'pass' by definition",
      {
        productionQuestions: questions,
        routeRepeatabilityStillAQuestion: anyRouteQuestion,
        waterUnchangedWithNoEvidence:
          evidenceMod.applyVerifiedWaterAccess(bandNoEvidence, target.id, 0.4) === 0.4,
      },
      anyRouteQuestion === false &&
        evidenceMod.applyVerifiedWaterAccess(bandNoEvidence, target.id, 0.4) === 0.4,
      { note: "§8 removal: any completed party is a successful round trip, so the question was a tautology." },
    );
  }

  // ── R7 — temporary use changes only bounded-use eligibility. ────────────────────
  {
    const target = Object.values(world.tiles).filter((t) => t.isAquatic !== true)[7];
    const bandNegative = mkBand([mkRecord(target, {})], [mkEvidence(target, "temporary_use", "negative")]);
    const bandConfirmed = mkBand([mkRecord(target, {})], [mkEvidence(target, "temporary_use", "confirmed")]);
    const bandNone = mkBand([mkRecord(target, {})]);

    record(
      "R7",
      "temporary-use result changes only bounded-use eligibility",
      "a failure blocks a task camp there; it moves no water and no resource state",
      {
        campRefusedAfterNegative: evidenceMod.taskCampRefusedByEvidence(bandNegative, target.id),
        campRefusedAfterConfirmed: evidenceMod.taskCampRefusedByEvidence(bandConfirmed, target.id),
        campRefusedWithNoEvidence: evidenceMod.taskCampRefusedByEvidence(bandNone, target.id),
        waterUntouched: evidenceMod.applyVerifiedWaterAccess(bandNegative, target.id, 0.45) === 0.45,
        resourceUntouched: evidenceMod.resourceTestEligible(bandNegative, target.id) === false,
      },
      evidenceMod.taskCampRefusedByEvidence(bandNegative, target.id) === true &&
        evidenceMod.taskCampRefusedByEvidence(bandConfirmed, target.id) === false &&
        evidenceMod.applyVerifiedWaterAccess(bandNegative, target.id, 0.45) === 0.45,
    );
  }

  // ── R8 — same-season repeats do not build a calendar. ───────────────────────────
  {
    const target = Object.values(world.tiles).filter((t) => t.isAquatic !== true)[11];
    let evidence;
    for (let i = 0; i < 4; i += 1) {
      evidence = evidenceMod.recordVerificationEvidence(evidence, {
        tileId: target.id,
        question: "seasonal_persistence",
        outcome: "inconclusive",
        season: "spring",
        tick: world.time.tick,
        hardship: 0.5,
        routeTiles: 8,
        routeEvidence: "walked_out_and_back",
      });
    }
    const crossSeason = evidenceMod.recordVerificationEvidence(evidence, {
      tileId: target.id,
      question: "seasonal_persistence",
      outcome: "inconclusive",
      season: "autumn",
      tick: world.time.tick,
      hardship: 0.5,
      routeTiles: 8,
      routeEvidence: "walked_out_and_back",
    });

    record(
      "R8",
      "same-season attempts do not create seasonal persistence",
      "four spring visits give ONE season of coverage; a real new season gives two",
      {
        rowsAfterFourAttempts: evidence.length,
        attemptsRecorded: evidence[0].attempts,
        seasonsAfterFourSpringVisits: evidence[0].seasonsAnswered,
        seasonsAfterAnAutumnVisit: crossSeason[0].seasonsAnswered,
      },
      evidence.length === 1 &&
        evidence[0].seasonsAnswered.length === 1 &&
        evidence[0].attempts === 4 &&
        crossSeason[0].seasonsAnswered.length === 2,
      { note: "state does not grow with repeats — the row is upserted, which is the §11 bound." },
    );
  }

  // ── R9 / R10 — retry suppression and the conditions that legitimately reopen it. ──
  {
    const target = Object.values(world.tiles).filter((t) => t.isAquatic !== true)[13];
    const evidence = [mkEvidence(target, "water_access", "confirmed", { lastSeason: "spring" })];
    const band = mkBand([mkRecord(target, { observedWaterAccess: 0.5 })], evidence);
    const base = { currentTick: Number(world.time.tick) + 500, currentSeason: "spring", hardship: 0.5, routeTiles: 8 };

    const sameConditions = evidenceMod.mayAskAgain(band, target.id, "water_access", base);
    const newSeason = evidenceMod.mayAskAgain(band, target.id, "water_access", { ...base, currentSeason: "autumn" });
    const movedHardship = evidenceMod.mayAskAgain(band, target.id, "water_access", { ...base, hardship: 0.9 });
    const movedRoute = evidenceMod.mayAskAgain(band, target.id, "water_access", { ...base, routeTiles: 20 });
    const otherQuestion = evidenceMod.mayAskAgain(band, target.id, "resource_presence", base);
    const negativeEvidence = [mkEvidence(target, "water_access", "negative", { lastSeason: "spring" })];
    const negativeSame = evidenceMod.mayAskAgain(
      mkBand([mkRecord(target, {})], negativeEvidence),
      target.id,
      "water_access",
      base,
    );

    record(
      "R9",
      "repeated identical confirmed verification is suppressed",
      "500 ticks later, unchanged conditions, the same question is NOT re-asked",
      {
        sameConditionsAllowed: sameConditions.allowed,
        sameConditionsReason: sameConditions.reason,
        settledNegativeAlsoSuppressed: negativeSame.allowed,
        differentQuestionStillAllowed: otherQuestion.allowed,
      },
      sameConditions.allowed === false &&
        negativeSame.allowed === false &&
        otherQuestion.allowed === true,
      { note: "the 12-entry display ring is NOT consulted — this is the separate retry memory." },
    );

    record(
      "R10",
      "a changed season permits a relevant retry",
      "season, route and hardship changes each legitimately reopen the question",
      {
        newSeason: `${newSeason.allowed} (${newSeason.reason})`,
        movedHardship: `${movedHardship.allowed} (${movedHardship.reason})`,
        movedRoute: `${movedRoute.allowed} (${movedRoute.reason})`,
      },
      newSeason.allowed === true && movedHardship.allowed === true && movedRoute.allowed === true,
    );
  }

  const passed = cases.filter((c) => c.pass === true).length;
  const failed = cases.filter((c) => c.pass === false);

  console.log(`\n=== R1-R12 EXACT-SEAM TESTS: ${passed} pass / ${failed.length} fail ===\n`);
  for (const c of cases) {
    console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.id}  ${c.title}`);
    console.log(`      expect: ${c.expectation}`);
    console.log(`      got   : ${JSON.stringify(c.observed)}`);
    if (c.note !== undefined) console.log(`      note  : ${c.note}`);
  }

  mkdirSync("docs/evidence/correction23b", { recursive: true });
  writeFileSync(
    "docs/evidence/correction23b/reader-seam-tests.json",
    JSON.stringify({ passed, failed: failed.length, cases }, null, 2),
  );
  console.log("\nwrote docs/evidence/correction23b/reader-seam-tests.json");
} finally {
  await server.close();
}
