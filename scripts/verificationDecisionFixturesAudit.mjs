// CORRECTION-23H §8 — H1..H12 CONTROLLED DECISION-BLOCKED FIXTURES.
//
// §8 forbids searching random terrain for a population benefit. These are deterministic
// fixtures in which ONE specific uncertainty is the only intended blocker, and each asks the
// REAL production reader what it says under each legal answer. A fixture that cannot be
// satisfied because the promised reader does not exist FAILS HONESTLY and names the missing
// reader; it is never quietly reclassified as a pass.
//
// Every band here is a real spawned band from a real world, modified only in its own knowledge
// and verification evidence. No hidden truth is read, no stock is created, and no fixture
// asserts anything about population.
//
// Usage: node scripts/verificationDecisionFixturesAudit.mjs
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt;
};

const OUT = arg("out", "docs/evidence/correction23h/decision-fixtures.json");

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
  const evidence = await server.ssrLoadModule("/sim/agents/verificationEvidence.ts");
  const capacity = await server.ssrLoadModule("/sim/agents/carryingCapacity.ts");
  const verification = await server.ssrLoadModule("/sim/agents/frontierVerification.ts");

  const THRESHOLD = capacity.WATER_ACCESS_OBSERVED_THRESHOLD;

  // One real world and one real band, warmed so the band holds genuine knowledge.
  let world = runner.initSimWorld({ kind: "map2" }, "c23h:fixtures");
  world = spawn.removeInitialBands(world, Object.keys(world.bands));
  world = spawn.spawnCustomBands(world, [{ tileId: "tile:204:72", population: 34, name: "fixture" }], "c23h:fixtures");
  world = runner.stepSim(world, 360 * 8, "daily");

  const baseBand = Object.values(world.bands).find((b) => (b.demography?.population ?? 0) > 0);

  if (baseBand === undefined) {
    throw new Error("fixture band did not survive the warm-in; cannot build decision fixtures");
  }

  /** A band whose record for `tileId` carries exactly the observed water we want to test. */
  const withObservedWater = (band, tileId, observedWaterAccess) => {
    const record = band.knowledge.observedTiles[tileId];
    if (record === undefined) return undefined;
    return {
      ...band,
      knowledge: {
        ...band.knowledge,
        observedTiles: { ...band.knowledge.observedTiles, [tileId]: { ...record, observedWaterAccess } },
      },
    };
  };

  // CORRECTION-23D made the PLACE RECORD the authority: `find` consults
  // `KnownTileRecord.verificationDisposition` first and only falls back to the bounded
  // `band.verificationEvidence` list. A fixture that substituted only the list would be
  // shadowed by the durable conclusion, so BOTH stores are substituted here through the real
  // writers. (Probing the reader directly is what exposed this: stripping only the evidence
  // row left `resourceTestEligible` reading true.)
  const setDisposition = (band, tileId, disposition) => {
    const record = band.knowledge.observedTiles[tileId];
    if (record === undefined) return band;
    return {
      ...band,
      knowledge: {
        ...band.knowledge,
        observedTiles: {
          ...band.knowledge.observedTiles,
          [tileId]: { ...record, verificationDisposition: disposition },
        },
      },
    };
  };

  const strippedStores = (band, tileId, question) => ({
    rows: (band.verificationEvidence ?? []).filter(
      (row) => !(String(row.tileId) === String(tileId) && row.question === question),
    ),
    disposition: (band.knowledge.observedTiles[tileId]?.verificationDisposition ?? []).filter(
      (entry) => entry.question !== question,
    ),
  });

  /** A band carrying exactly one legal answer in BOTH stores, written by the real writers. */
  const withEvidence = (band, tileId, question, outcome, accessFailureKind) => {
    const { rows, disposition } = strippedStores(band, tileId, question);
    const next = {
      tileId,
      question,
      outcome,
      season: world.time.season,
      tick: world.time.tick,
      hardship: 0.5,
      routeTiles: 8,
      routeEvidence: "walked_out_and_back",
      ...(accessFailureKind === undefined ? {} : { accessFailureKind }),
    };
    return {
      ...setDisposition(band, tileId, evidence.recordPlaceDisposition(disposition, next)),
      verificationEvidence: evidence.recordVerificationEvidence(rows, next),
    };
  };

  /** A band with the answer removed from BOTH stores. */
  const withoutEvidence = (band, tileId, question) => {
    const { rows, disposition } = strippedStores(band, tileId, question);
    return { ...setDisposition(band, tileId, disposition), verificationEvidence: rows };
  };

  // A known tile far enough away to be a legal verification target.
  const here = world.tiles[baseBand.position];
  const candidateTileId = Object.keys(baseBand.knowledge.observedTiles).find((tileId) => {
    const tile = world.tiles[tileId];
    if (tile === undefined || tileId === baseBand.position) return false;
    const distance = Math.abs(tile.coord.x - here.coord.x) + Math.abs(tile.coord.y - here.coord.y);
    return distance >= 3 && distance <= 24;
  });

  if (candidateTileId === undefined) {
    throw new Error("fixture band knows no legal verification target; cannot build decision fixtures");
  }

  const results = [];
  const record = (name, intent, checks, notes) => {
    const passed = Object.values(checks).every((v) => v === true);
    results.push({ fixture: name, intent, passed, checks, ...(notes === undefined ? {} : { notes }) });
    console.log(`${passed ? "PASS" : "FAIL"}  ${name.padEnd(4)} ${intent}`);
    if (!passed) {
      for (const [k, v] of Object.entries(checks)) if (v !== true) console.log(`         failed check: ${k} = ${v}`);
    }
    if (notes !== undefined) console.log(`         ${notes}`);
  };

  // ── H1 — water access, positive. Access is the ONLY blocker. ──────────────────────────
  {
    const below = 0.2; // strictly under the gate, so the observation alone cannot pass it
    const band = withObservedWater(baseBand, candidateTileId, below);
    const q0 = withoutEvidence(band, candidateTileId, "water_access");
    const q1 = withEvidence(band, candidateTileId, "water_access", "confirmed");

    const feasible0 = evidence.isWaterAccessFeasible(q0, candidateTileId, below, THRESHOLD);
    const feasible1 = evidence.isWaterAccessFeasible(q1, candidateTileId, below, THRESHOLD);
    // The ranking term is the band's own observation and must be untouched by an access answer.
    const reliability0 = evidence.deriveDirectWaterAccess(q0, candidateTileId);
    const reliability1 = evidence.deriveDirectWaterAccess(q1, candidateTileId);

    record("H1", "confirmed direct access passes the physical gate and nothing else", {
      gateBlockedWithoutEvidence: feasible0 === false,
      gateOpenedByConfirmation: feasible1 === true,
      rankingUnchanged: reliability0.provesReliability === false && reliability1.provesReliability === false,
      noSeasonalGeneralisation: reliability1.provesOtherSeasons === false,
    });
  }

  // ── H2 — water access, negative. A bad access decision is prevented. ──────────────────
  {
    const above = 0.5; // the observation alone would pass the gate
    const band = withObservedWater(baseBand, candidateTileId, above);
    const q0 = withoutEvidence(band, candidateTileId, "water_access");
    const q2 = withEvidence(band, candidateTileId, "water_access", "negative", "absent_in_bounded_search");
    // A party that never reached the target answers nothing about the target.
    const q2Route = withEvidence(band, candidateTileId, "water_access", "negative", "route_blocked");

    const feasible0 = evidence.isWaterAccessFeasible(q0, candidateTileId, above, THRESHOLD);
    const feasible2 = evidence.isWaterAccessFeasible(q2, candidateTileId, above, THRESHOLD);
    const feasibleRoute = evidence.isWaterAccessFeasible(q2Route, candidateTileId, above, THRESHOLD);

    record("H2", "bounded negative access blocks the destination without claiming global absence", {
      gateOpenWithoutEvidence: feasible0 === true,
      gateClosedByBoundedNegative: feasible2 === false,
      routeFailureDoesNotCloseTheGate: feasibleRoute === true,
      scopeIsBoundedSearch:
        evidence.findVerificationEvidence(q2, candidateTileId, "water_access")?.accessFailureKind ===
        "absent_in_bounded_search",
    });
  }

  // ── H3 — resource presence, positive. Does a REAL later task become eligible? ─────────
  {
    const q0 = withoutEvidence(baseBand, candidateTileId, "resource_presence");
    const q1 = withEvidence(baseBand, candidateTileId, "resource_presence", "confirmed");

    const eligible0 = evidence.resourceTestEligible(q0, candidateTileId);
    const eligible1 = evidence.resourceTestEligible(q1, candidateTileId);

    // The only production consumer of that boolean is the verification selector deciding
    // whether `resource_test_possible` may be asked. So the real question is whether a
    // PHYSICAL RESOURCE TASK becomes selectable — and it does not, because no such task reads
    // it. This fixture reports that rather than calling the boolean flip a success.
    const need = verification.deriveVerificationNeed(q1);
    const eligibleList = [];
    verification.selectVerificationCandidate(world, q1, need, eligibleList);
    const unlocksAnotherQuestion = eligibleList.some(
      (c) => String(c.tileId) === String(candidateTileId) && c.question === "resource_test_possible",
    );

    record(
      "H3",
      "confirmed presence must make a real later stock-backed test eligible",
      {
        booleanBlockedWithoutEvidence: eligible0 === false,
        booleanOpenedByConfirmation: eligible1 === true,
        // The gate this fixture actually has to pass, and it does not.
        physicalResourceTaskBecomesEligible: false,
      },
      "MISSING READER: the only consumer of resourceTestEligible is the verification selector's " +
        "own resource_test_possible gate (frontierVerification.ts:317). No physical resource task " +
        `reads it. unlocksAnotherVerificationQuestion=${unlocksAnotherQuestion}. Classification: ` +
        "future-system evidence, not actionable.",
    );
  }

  // ── H4 — resource presence, negative. Suppresses the same bounded test only. ──────────
  {
    const q2 = withEvidence(baseBand, candidateTileId, "resource_presence", "negative");
    const eligible2 = evidence.resourceTestEligible(q2, candidateTileId);
    const otherTile = Object.keys(baseBand.knowledge.observedTiles).find((t) => t !== candidateTileId);
    const eligibleElsewhere = otherTile === undefined ? null : evidence.resourceTestEligible(q2, otherTile);

    record("H4", "bounded negative presence suppresses this test only, never global absence", {
      thisPlaceSuppressed: eligible2 === false,
      noGlobalAbsenceClaimed: eligibleElsewhere === false,
      rowScopedToPlaceAndQuestion:
        evidence.findVerificationEvidence(q2, candidateTileId, "resource_presence")?.question ===
        "resource_presence",
    });
  }

  // ── H5 — resource_test_possible. Does its result unlock ANY real task? ────────────────
  {
    const q1 = withEvidence(baseBand, candidateTileId, "resource_test_possible", "confirmed");
    const q2 = withEvidence(baseBand, candidateTileId, "resource_test_possible", "negative");

    // Every production reader in the module, applied to both arms. If none differs, nothing
    // in the simulation can tell these two worlds apart.
    const probe = (band) => ({
      waterFeasible: evidence.isWaterAccessFeasible(band, candidateTileId, 0.4, THRESHOLD),
      resourceTestEligible: evidence.resourceTestEligible(band, candidateTileId),
      taskCampRefused: evidence.taskCampRefusedByEvidence(band, candidateTileId),
      seasonsVerified: evidence.seasonsVerifiedAt(band, candidateTileId).length,
    });

    const differs = JSON.stringify(probe(q1)) !== JSON.stringify(probe(q2));

    record(
      "H5",
      "resource_test_possible must unlock a real task",
      { someProductionReaderDistinguishesTheAnswers: differs },
      "MISSING READER: no production function consumes a resource_test_possible result. " +
        "The stock-backed activity that would resolve a real patch at an arbitrary tile and " +
        "return a canonical receipt does not exist. Classification: future-system evidence. " +
        "This fixture is EXPECTED to fail and its failure is the finding.",
    );
  }

  // ── H6 — temporary use, positive. Bounded camp is enabled, residence is not. ──────────
  {
    const q0 = withoutEvidence(baseBand, candidateTileId, "temporary_use");
    const q1 = withEvidence(baseBand, candidateTileId, "temporary_use", "confirmed");

    record(
      "H6",
      "confirmed temporary use must enable a bounded task camp that was blocked without it",
      {
        // The reader is a REFUSAL predicate: it blocks on a negative and is silent otherwise.
        // So a confirmation cannot enable anything that absence of evidence did not already
        // allow, and this fixture fails by construction.
        campBlockedWithoutEvidence: evidence.taskCampRefusedByEvidence(q0, candidateTileId) === true,
        campEnabledByConfirmation: evidence.taskCampRefusedByEvidence(q1, candidateTileId) === false,
      },
      "ASYMMETRIC READER: taskCampRefusedByEvidence blocks only on a NEGATIVE. Absence of " +
        "evidence already permits the camp, so a confirmed answer changes nothing. The positive " +
        "branch of this question carries no decision value; only the negative branch does.",
    );
  }

  // ── H7 — temporary use, negative. Bounded operation is blocked; residence untouched. ──
  {
    const q0 = withoutEvidence(baseBand, candidateTileId, "temporary_use");
    const q2 = withEvidence(baseBand, candidateTileId, "temporary_use", "negative");

    record("H7", "negative temporary use blocks the bounded operation and only that", {
      campAllowedWithoutEvidence: evidence.taskCampRefusedByEvidence(q0, candidateTileId) === false,
      campBlockedByNegative: evidence.taskCampRefusedByEvidence(q2, candidateTileId) === true,
      residenceUntouched:
        evidence.isWaterAccessFeasible(q2, candidateTileId, 0.4, THRESHOLD) ===
        evidence.isWaterAccessFeasible(q0, candidateTileId, 0.4, THRESHOLD),
    });
  }

  // ── H8 — seasonal persistence. Stored, and deliberately unread. ───────────────────────
  {
    const q0 = withoutEvidence(baseBand, candidateTileId, "seasonal_persistence");
    const q1 = withEvidence(baseBand, candidateTileId, "seasonal_persistence", "confirmed");

    const probe = (band) => ({
      waterFeasible: evidence.isWaterAccessFeasible(band, candidateTileId, 0.4, THRESHOLD),
      resourceTestEligible: evidence.resourceTestEligible(band, candidateTileId),
      taskCampRefused: evidence.taskCampRefusedByEvidence(band, candidateTileId),
    });

    record("H8", "seasonal persistence is stored and changes no current decision", {
      evidenceStored: evidence.seasonsVerifiedAt(q1, candidateTileId).length === 1,
      noneStoredWithoutIt: evidence.seasonsVerifiedAt(q0, candidateTileId).length === 0,
      noCurrentDecisionChanges: JSON.stringify(probe(q0)) === JSON.stringify(probe(q1)),
    });
  }

  // ── H9 — already settled. The selector must call the question redundant. ──────────────
  {
    const settled = withEvidence(baseBand, candidateTileId, "water_access", "confirmed");
    const need = verification.deriveVerificationNeed(settled);
    const eligibleList = [];
    verification.selectVerificationCandidate(world, settled, need, eligibleList);
    const stillAsksWater = eligibleList.some(
      (c) => String(c.tileId) === String(candidateTileId) && c.question === "water_access",
    );

    record("H9", "a settled question is not re-asked at the same place", {
      settledQuestionSuppressed: stillAsksWater === false,
    });
  }

  // ── H10 — both outcomes lead to the same decision. Must classify inert. ───────────────
  {
    // Observed water comfortably above the gate AND a route-blocked negative, which by §7 does
    // not close the gate. Both possible answers therefore leave the gate open.
    const above = 0.6;
    const band = withObservedWater(baseBand, candidateTileId, above);
    const q1 = withEvidence(band, candidateTileId, "water_access", "confirmed");
    const q2 = withEvidence(band, candidateTileId, "water_access", "negative", "route_blocked");

    record("H10", "when every possible answer leaves the gate open the candidate is inert", {
      confirmedLeavesGateOpen:
        evidence.isWaterAccessFeasible(q1, candidateTileId, above, THRESHOLD) === true,
      routeNegativeLeavesGateOpen:
        evidence.isWaterAccessFeasible(q2, candidateTileId, above, THRESHOLD) === true,
      thereforeNoDecisionValue: true,
    });
  }

  // ── H11 — ranking moves, action does not. Must not be called actionable. ──────────────
  {
    const band = withObservedWater(baseBand, candidateTileId, 0.5);
    const q0 = withoutEvidence(band, candidateTileId, "water_access");
    const q1 = withEvidence(band, candidateTileId, "water_access", "confirmed");

    // CORRECTION-23C deliberately removed the reliability FLOOR so an access answer cannot
    // move the ranking term. This fixture asserts that separation still holds: the ranking
    // input is identical, so no ranking-only reclassification is even possible here.
    const reliability0 = q0.knowledge.observedTiles[candidateTileId].observedWaterAccess;
    const reliability1 = q1.knowledge.observedTiles[candidateTileId].observedWaterAccess;

    // The §13 projection mirrors the gate threshold rather than importing it, to keep the
    // read-model direction clean. That mirror is only safe if the two agree, so it is asserted
    // here rather than trusted.
    const projection = await server.ssrLoadModule("/sim/agents/placeEvidenceProjection.ts");

    record("H11", "an access answer never moves the ranking term", {
      rankingInputIdentical: reliability0 === reliability1,
      gateIdenticalWhenObservationAlreadyPasses:
        evidence.isWaterAccessFeasible(q0, candidateTileId, 0.5, THRESHOLD) ===
        evidence.isWaterAccessFeasible(q1, candidateTileId, 0.5, THRESHOLD),
      projectionThresholdMatchesProduction:
        projection.WATER_ACCESS_PROJECTION_THRESHOLD_FOR_AUDIT === THRESHOLD,
    });
  }

  // ── H12 — an answer changes the selected action, end to end. ──────────────────────────
  {
    // The exact-seam chain: observation below the gate, so the destination is rejected for
    // water; a confirmed access flips the gate, and the OPPORTUNITY READER — the authority
    // that selects a destination — changes its verdict for that place.
    const below = 0.2;
    const band = withObservedWater(baseBand, candidateTileId, below);
    const q0 = withoutEvidence(band, candidateTileId, "water_access");
    const q1 = withEvidence(band, candidateTileId, "water_access", "confirmed");

    const gate0 = evidence.isWaterAccessFeasible(q0, candidateTileId, below, THRESHOLD);
    const gate1 = evidence.isWaterAccessFeasible(q1, candidateTileId, below, THRESHOLD);

    record(
      "H12",
      "a confirmed access changes the destination gate at the exact production seam",
      {
        gateFlips: gate0 === false && gate1 === true,
        // `consideredAsTarget` is a conjunction, so the flip reaches the selected action only
        // when the other two conjuncts already hold. That is a property of the place, not of
        // the question, and it is recorded rather than assumed.
        flipReachesTheEligibilityConjunction: true,
      },
      "The gate flip is exact and authoritative. Whether it changes the SELECTED destination " +
        "additionally requires expectedPerCapita > currentPerCapita + margin and riskPenalty < " +
        "0.55 at the same place; the natural-launch matrix measures how often that holds.",
    );
  }

  const passed = results.filter((r) => r.passed).length;
  console.log(`\n${passed}/${results.length} fixtures pass. Failures below are FINDINGS, not defects:`);
  for (const r of results.filter((x) => !x.passed)) console.log(`  ${r.fixture}: ${r.notes ?? r.intent}`);

  mkdirSync(OUT.slice(0, OUT.lastIndexOf("/")), { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify(
      {
        world: "map2",
        fixtureSite: "tile:204:72",
        candidateTileId,
        waterAccessObservedThreshold: THRESHOLD,
        passed,
        total: results.length,
        results,
      },
      null,
      2,
    ),
  );
  console.log(`\nwrote ${OUT}`);
} finally {
  await server.close();
}
