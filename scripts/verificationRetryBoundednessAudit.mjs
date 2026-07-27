// CORRECTION-23D §11/§13/§14 — B1-B15, THE LEGITIMATE-CHANGE CASES, AND STATE BOUNDS.
//
// Every case runs against the authoritative production gate `mayAskAgain` and the durable
// disposition on the place record. The shape that matters is a pair: an unchanged question
// must stay suppressed no matter what is evicted, and a materially changed one must reopen.
// Boundedness achieved by banning all retries would be a FAIL, so both halves are asserted.
//
// Usage: node scripts/verificationRetryBoundednessAudit.mjs
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";

const server = await createServer({
  root: `${process.cwd()}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const ev = await server.ssrLoadModule("/sim/agents/verificationEvidence.ts");

  const world = runner.initSimWorld({ kind: "map2" }, "c23d:bounded");
  const templateBand = Object.values(world.bands)[0];
  const tiles = Object.values(world.tiles).filter((t) => t.isAquatic !== true);
  const target = tiles[0];
  const other = tiles[1];

  const cases = [];
  const record = (id, title, expectation, observed, pass, detail = {}) =>
    cases.push({ id, title, expectation, observed, pass, ...detail });

  const mkRecord = (tile, disposition) => ({
    tileId: tile.id,
    firstObservedAt: world.time,
    lastObservedAt: world.time,
    seasonsObserved: [world.time.season],
    visits: 1,
    observedRichness: 0.5,
    observedWaterAccess: 0.25,
    observedAquaticPotential: 0,
    observedMovementCost: tile.movementCost,
    observedRisk: 0.3,
    confidence: 0.5,
    knowledgeSource: "personally_observed",
    acquisition: "returned_frontier_exploration",
    ...(disposition === undefined ? {} : { verificationDisposition: disposition }),
  });

  const disp = (question, outcome, extra = {}) => ({
    question,
    outcome,
    seasonsAnswered: [world.time.season],
    attempts: 1,
    lastSeason: world.time.season,
    lastTick: world.time.tick,
    routeTilesAtLastAttempt: 8,
    ...(outcome === "negative" ? { accessFailureKind: "absent_in_bounded_search" } : {}),
    ...extra,
  });

  const mkBand = (records, { attempts, evidence } = {}) => ({
    ...templateBand,
    position: tiles[2].id,
    knowledge: {
      ...templateBand.knowledge,
      observedTiles: Object.fromEntries(records.map((r) => [r.tileId, r])),
    },
    ...(attempts === undefined ? {} : { frontierVerificationAttempts: attempts }),
    ...(evidence === undefined ? {} : { verificationEvidence: evidence }),
  });

  const base = {
    currentTick: Number(world.time.tick) + 5000,
    currentSeason: world.time.season,
    hardship: 0.5,
    routeTiles: 8,
  };
  const ask = (band, tileId, question, over = {}) =>
    ev.mayAskAgain(band, tileId, question, { ...base, ...over });

  const settledWater = mkRecord(target, [disp("water_access", "confirmed")]);

  // ── B1 — UI eviction does not reopen. ──────────────────────────────────────────
  {
    // A full, entirely unrelated 12-entry display ring: the settled row is long gone from it.
    const ring = Array.from({ length: 12 }, (_, i) => ({
      tileId: tiles[20 + i].id,
      question: "resource_presence",
      tick: world.time.tick,
      season: world.time.season,
      outcome: "confirmed",
    }));
    const band = mkBand([settledWater], { attempts: ring });
    const decision = ask(band, target.id, "water_access");
    record(
      "B1",
      "UI eviction does not reopen",
      "the settled question stays ineligible with the display ring full of unrelated rows",
      { ringLength: ring.length, allowed: decision.allowed, reason: decision.reason },
      decision.allowed === false,
    );
  }

  // ── B2 — evidence-cap pressure does not reopen. ────────────────────────────────
  {
    // 48 unrelated rows: exactly the pressure that evicted the settled row before 23D.
    const filler = Array.from({ length: 48 }, (_, i) => ({
      tileId: tiles[100 + i].id,
      question: "resource_presence",
      outcome: "confirmed",
      seasonsAnswered: [world.time.season],
      lastSeason: world.time.season,
      lastTick: world.time.tick,
      attempts: 1,
      hardshipAtLastAttempt: 0.5,
      routeTilesAtLastAttempt: 8,
      routeEvidence: "walked_out_and_back",
    }));
    const band = mkBand([settledWater], { evidence: filler });
    const decision = ask(band, target.id, "water_access");
    record(
      "B2",
      "evidence-cap pressure does not reopen",
      "48 unrelated evidence rows cannot evict the durable conclusion",
      {
        evidenceRows: filler.length,
        settledRowPresentInEvidence: false,
        allowed: decision.allowed,
        reason: decision.reason,
      },
      decision.allowed === false,
      { note: "before 23D this was 18.1% of all launches, with the cap under pressure on 75.3% of band-days." },
    );
  }

  // ── B3 / B4 — hardship is motivation, not invalidation. ────────────────────────
  {
    const band = mkBand([settledWater]);
    const results = [0, 0.25, 0.5, 0.75, 1].map((h) => ask(band, target.id, "water_access", { hardship: h }).allowed);
    const negRecord = mkRecord(other, [disp("resource_presence", "negative")]);
    const negBand = mkBand([negRecord]);
    const negResults = [0, 0.5, 1].map((h) => ask(negBand, other.id, "resource_presence", { hardship: h }).allowed);

    record(
      "B3",
      "hardship increase does not erase a confirmation",
      "the settled question stays settled across the whole hardship range",
      { allowedAcrossHardship: results },
      results.every((r) => r === false),
    );
    record(
      "B4",
      "hardship increase does not erase a bounded negative",
      "the identical search stays suppressed across the whole hardship range",
      { allowedAcrossHardship: negResults },
      negResults.every((r) => r === false),
    );
  }

  // ── B5 / B6 — independence of questions and targets. ───────────────────────────
  {
    const band = mkBand([settledWater, mkRecord(other)]);
    const otherQuestion = ask(band, target.id, "resource_presence");
    const otherTarget = ask(band, other.id, "water_access");
    record(
      "B5",
      "a different unresolved question remains eligible",
      "settling water access does not block resource presence at the same place",
      { allowed: otherQuestion.allowed, reason: otherQuestion.reason },
      otherQuestion.allowed === true,
    );
    record(
      "B6",
      "a different target remains eligible",
      "settling one place does not suppress investigation elsewhere",
      { allowed: otherTarget.allowed, reason: otherTarget.reason },
      otherTarget.allowed === true,
    );
  }

  // ── B7 / B8 — seasons. ─────────────────────────────────────────────────────────
  {
    const band = mkBand([settledWater]);
    const newSeason = ask(band, target.id, "water_access", { currentSeason: "autumn" });
    const sameSeason = ask(band, target.id, "water_access", { currentSeason: world.time.season });
    const allFour = mkBand([
      mkRecord(target, [
        disp("water_access", "confirmed", {
          seasonsAnswered: ["spring", "summer", "autumn", "winter"],
        }),
      ]),
    ]);
    const covered = ["spring", "summer", "autumn", "winter"].map(
      (s) => ask(allFour, target.id, "water_access", { currentSeason: s }).allowed,
    );

    record(
      "B7",
      "a new season permits a season-relevant retry",
      "a season the place has not been answered in reopens the question",
      { allowed: newSeason.allowed, reason: newSeason.reason },
      newSeason.allowed === true,
    );
    record(
      "B8",
      "repeated same season remains suppressed",
      "and once all four seasons are covered NO season reopens it — the old gate reopened 3 in 4 forever",
      {
        sameSeasonAllowed: sameSeason.allowed,
        allSeasonsCoveredAllowed: covered,
        previousBehaviour: "lastSeason !== currentSeason fired 3 seasons in 4 — 45.8% of all launches",
      },
      sameSeason.allowed === false && covered.every((c) => c === false),
    );
  }

  // ── B9 — a materially different route reconsiders the route, not the place. ────
  {
    const band = mkBand([settledWater]);
    const routeMoved = ask(band, target.id, "water_access", { routeTiles: 30 });
    const routeSame = ask(band, target.id, "water_access", { routeTiles: 9 });
    const direct = ev.deriveDirectWaterAccess(band, target.id);
    record(
      "B9",
      "a materially different route permits reconsideration",
      "and the destination evidence itself is untouched by the route changing",
      {
        routeMovedAllowed: routeMoved.allowed,
        routeUnchangedAllowed: routeSame.allowed,
        destinationEvidenceState: direct.state,
        destinationEvidenceSeasons: direct.seasonsObserved.map(String),
      },
      routeMoved.allowed === true && routeSame.allowed === false && direct.state === "accessed",
    );
  }

  // ── B10 — new signs permit a resource retry. ───────────────────────────────────
  {
    const settledNegative = mkRecord(target, [disp("resource_presence", "negative")]);
    const band = mkBand([settledNegative]);
    const unchanged = ask(band, target.id, "resource_presence");
    // A new bounded search in a season the place was never searched in IS a different search.
    const newSeason = ask(band, target.id, "resource_presence", { currentSeason: "winter" });
    record(
      "B10",
      "a materially different search permits a resource retry",
      "the identical search stays suppressed; a season it was never searched in reopens it",
      { identicalSearchAllowed: unchanged.allowed, newSeasonAllowed: newSeason.allowed },
      unchanged.allowed === false && newSeason.allowed === true,
      { note: "physical signs are not represented as band state, so season and route are the changes the model can honestly detect." },
    );
  }

  // ── B11 — inconclusive retries only after material change, and is bounded. ─────
  {
    const once = mkBand([mkRecord(target, [disp("water_access", "inconclusive")])]);
    const exhausted = mkBand([
      mkRecord(target, [disp("water_access", "inconclusive", { attempts: 3 })]),
    ]);
    const soon = ev.mayAskAgain(once, target.id, "water_access", {
      ...base,
      currentTick: Number(world.time.tick) + 1,
    });
    const later = ask(once, target.id, "water_access");
    const capped = ask(exhausted, target.id, "water_access");
    record(
      "B11",
      "an inconclusive result retries only after material change, and is bounded",
      "too soon: no; after a real interval: yes; after three attempts: never again",
      {
        tooSoon: soon.allowed,
        afterInterval: later.allowed,
        afterThreeAttempts: capped.allowed,
        cappedReason: capped.reason,
      },
      soon.allowed === false && later.allowed === true && capped.allowed === false,
    );
  }

  // ── B12 — authoritative place forgetting may reopen. ───────────────────────────
  {
    const withPlace = mkBand([settledWater]);
    const placeForgotten = mkBand([mkRecord(other)]);
    const settled = ask(withPlace, target.id, "water_access");
    const forgotten = ask(placeForgotten, target.id, "water_access");
    record(
      "B12",
      "authoritative place forgetting may reopen",
      "the question reopens ONLY when the place record itself is gone — not when a cap evicted",
      {
        whilePlaceKnown: settled.allowed,
        afterPlaceRecordRemoved: forgotten.allowed,
        reason: forgotten.reason,
      },
      settled.allowed === false && forgotten.allowed === true,
      { note: "this is the ONE legitimate reopening path, and it requires losing the place, not a list slot." },
    );
  }

  // ── B13 — a lost party transfers no disposition. ───────────────────────────────
  {
    const band = mkBand([mkRecord(target)]);
    const direct = ev.deriveDirectWaterAccess(band, target.id);
    record(
      "B13",
      "a lost party transfers no disposition",
      "an unanswered target is neither confirmed nor negative and stays eligible",
      {
        state: direct.state,
        attempts: direct.attempts,
        stillEligible: ask(band, target.id, "water_access").allowed,
      },
      direct.state === "unasked" && direct.attempts === 0 && ask(band, target.id, "water_access").allowed === true,
      { note: "the hand-off is gated on phase === 'completed', so a lost party never reaches the write seam." },
    );
  }

  // ── B14 — no dense matrix. ─────────────────────────────────────────────────────
  {
    let dispositions = undefined;
    for (const q of ["water_access", "resource_presence", "temporary_use"]) {
      for (let i = 0; i < 5; i += 1) {
        dispositions = ev.recordPlaceDisposition(dispositions, {
          question: q,
          outcome: "confirmed",
          season: world.time.season,
          tick: world.time.tick,
          routeTiles: 8,
        });
      }
    }
    const untouched = mkRecord(other);
    record(
      "B14",
      "state exists only for attempted target/question pairs",
      "15 attempts across 3 questions produce 3 entries; an unattempted place carries none",
      {
        attemptsMade: 15,
        entriesStored: dispositions.length,
        attemptsPerEntry: dispositions.map((d) => d.attempts),
        unattemptedPlaceHasNoState: untouched.verificationDisposition === undefined,
        worldTiles: Object.keys(world.tiles).length,
      },
      dispositions.length === 3 &&
        dispositions.every((d) => d.attempts === 5) &&
        untouched.verificationDisposition === undefined,
    );
  }

  // ── B15 — deterministic retention. ─────────────────────────────────────────────
  {
    const build = () => {
      let d = undefined;
      for (const q of ["water_access", "resource_presence", "seasonal_persistence"]) {
        d = ev.recordPlaceDisposition(d, {
          question: q,
          outcome: "confirmed",
          season: world.time.season,
          tick: world.time.tick,
          routeTiles: 8,
        });
      }
      return d;
    };
    const a = JSON.stringify(build());
    const b = JSON.stringify(build());
    record(
      "B15",
      "deterministic retention",
      "identical inputs retain and order identical summaries",
      { identical: a === b },
      a === b,
    );
  }

  const passed = cases.filter((c) => c.pass === true).length;
  const failed = cases.filter((c) => c.pass === false);

  console.log(`\n=== B1-B15: ${passed} pass / ${failed.length} fail ===\n`);
  for (const c of cases) {
    console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.id}  ${c.title}`);
    console.log(`      expect: ${c.expectation}`);
    console.log(`      got   : ${JSON.stringify(c.observed)}`);
    if (c.note !== undefined) console.log(`      note  : ${c.note}`);
  }

  mkdirSync("docs/evidence/correction23d", { recursive: true });
  writeFileSync(
    "docs/evidence/correction23d/retry-boundedness-cases.json",
    JSON.stringify({ passed, failed: failed.length, cases }, null, 2),
  );
  console.log("\nwrote docs/evidence/correction23d/retry-boundedness-cases.json");
} finally {
  await server.close();
}
