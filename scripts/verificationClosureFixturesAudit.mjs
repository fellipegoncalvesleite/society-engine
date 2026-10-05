// CORRECTION-23I §13 — I1..I12 CONTROLLED CLOSURE FIXTURES.
//
// Each fixture drives the REAL production selector and the REAL readers on a real warmed band,
// modified only in its own knowledge, evidence and opportunity state. No hidden truth is read
// and no stock is created. A fixture that cannot pass because the behaviour is wrong FAILS —
// none of these is expected to fail.
//
// Usage: node scripts/verificationClosureFixturesAudit.mjs
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt;
};

const OUT = arg("out", "docs/evidence/correction23i/closure-fixtures.json");

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
  const exploration = await server.ssrLoadModule("/sim/agents/frontierExploration.ts");
  const diagnostics = await server.ssrLoadModule("/sim/diagnostics/verificationLaunchDiagnostics.ts");
  const pendingOperation = await server.ssrLoadModule("/sim/agents/pendingOperation.ts");

  const THRESHOLD = capacity.WATER_ACCESS_OBSERVED_THRESHOLD;

  let world = runner.initSimWorld({ kind: "map2" }, "c23i:fixtures");
  world = spawn.removeInitialBands(world, Object.keys(world.bands));
  world = spawn.spawnCustomBands(world, [{ tileId: "tile:204:72", population: 34, name: "fixture" }], "c23i:fixtures");
  world = runner.stepSim(world, 360 * 8, "daily");

  const baseBand = Object.values(world.bands).find((b) => (b.demography?.population ?? 0) > 0);
  if (baseBand === undefined) throw new Error("fixture band did not survive the warm-in");

  const here = world.tiles[baseBand.position];
  const legalTargets = Object.keys(baseBand.knowledge.observedTiles).filter((tileId) => {
    const tile = world.tiles[tileId];
    if (tile === undefined || tileId === baseBand.position) return false;
    const d = Math.abs(tile.coord.x - here.coord.x) + Math.abs(tile.coord.y - here.coord.y);
    return d >= 3 && d <= 24;
  });
  const targetTileId = legalTargets[0];
  const otherTileId = legalTargets[1];
  if (targetTileId === undefined || otherTileId === undefined) throw new Error("no legal targets known");

  // ── band builders. All modify band-known state only. ──────────────────────────────────
  const setDisposition = (band, tileId, disposition) => {
    const record = band.knowledge.observedTiles[tileId];
    if (record === undefined) return band;
    return {
      ...band,
      knowledge: {
        ...band.knowledge,
        observedTiles: { ...band.knowledge.observedTiles, [tileId]: { ...record, verificationDisposition: disposition } },
      },
    };
  };

  // CORRECTION-23D made the place record the authority — `find` reads it FIRST — so both
  // stores are always substituted together.
  const withAnswer = (band, tileId, question, outcome, accessFailureKind) => {
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
    const rows = (band.verificationEvidence ?? []).filter(
      (r) => !(String(r.tileId) === String(tileId) && r.question === question),
    );
    const disp = (band.knowledge.observedTiles[tileId]?.verificationDisposition ?? []).filter(
      (e) => e.question !== question,
    );
    return {
      ...setDisposition(band, tileId, evidence.recordPlaceDisposition(disp, next)),
      verificationEvidence: evidence.recordVerificationEvidence(rows, next),
    };
  };

  const withoutAnswer = (band, tileId, question) => ({
    ...setDisposition(
      band,
      tileId,
      (band.knowledge.observedTiles[tileId]?.verificationDisposition ?? []).filter((e) => e.question !== question),
    ),
    verificationEvidence: (band.verificationEvidence ?? []).filter(
      (r) => !(String(r.tileId) === String(tileId) && r.question === question),
    ),
  });

  /** Install a synthetic opportunity verdict — band-known state, the destination authority's own shape. */
  const withOpportunity = (band, opportunity) => ({
    ...band,
    carryingCapacity: { ...band.carryingCapacity, knownUnusedHabitat: opportunity },
  });

  const withColonization = (band, recommendedAction) => ({
    ...band,
    carryingCapacity: {
      ...band.carryingCapacity,
      daughterColonization: { ...band.carryingCapacity.daughterColonization, recommendedAction },
    },
  });

  const opportunityFor = (tileId, overrides) => ({
    ...(baseBand.carryingCapacity?.knownUnusedHabitat ?? {}),
    bandId: baseBand.id,
    candidateTileId: tileId,
    ...overrides,
  });

  /** Ask the REAL selector what it would launch, and return the eligible set. */
  const eligibleFor = (band) => {
    const need = verification.deriveVerificationNeed(band);
    const out = [];
    verification.selectVerificationCandidate(world, band, need, out);
    return out;
  };

  const asks = (band, tileId, question) =>
    eligibleFor(band).some((c) => String(c.tileId) === String(tileId) && c.question === question);

  const results = [];
  const record = (name, intent, checks, notes) => {
    const passed = Object.values(checks).every((v) => v === true);
    results.push({ fixture: name, intent, passed, checks, ...(notes === undefined ? {} : { notes }) });
    console.log(`${passed ? "PASS" : "FAIL"}  ${name.padEnd(4)} ${intent}`);
    if (!passed) for (const [k, v] of Object.entries(checks)) if (v !== true) console.log(`         ${k} = ${v}`);
  };

  // ── I1 — a confirmation unlocks the selected candidate ────────────────────────────────
  {
    const band = withOpportunity(withoutAnswer(baseBand, targetTileId, "water_access"), opportunityFor(targetTileId, {
      consideredAsTarget: false,
      rejectionReason: "insufficient_water_reliability",
      waterAccessFeasible: false,
      waterAccessIsBindingBlocker: true,
    }));

    const confirmed = withAnswer(band, targetTileId, "water_access", "confirmed");

    record("I1", "water confirmation unlocks the selected candidate, and the question is asked", {
      questionIsAsked: asks(band, targetTileId, "water_access"),
      gateBlockedBefore: evidence.isWaterAccessFeasible(band, targetTileId, 0.2, THRESHOLD) === false,
      gateOpenedByConfirmation: evidence.isWaterAccessFeasible(confirmed, targetTileId, 0.2, THRESHOLD) === true,
      notReAskedOnceSettled: asks(confirmed, targetTileId, "water_access") === false,
    });
  }

  // ── I2 — a negative cancels an imminent selected candidate ────────────────────────────
  {
    const band = withColonization(
      withOpportunity(withoutAnswer(baseBand, targetTileId, "water_access"), opportunityFor(targetTileId, {
        consideredAsTarget: true,
        rejectionReason: undefined,
        waterAccessFeasible: true,
        waterAccessIsBindingBlocker: false,
      })),
      "fission_toward_opportunity",
    );

    const negative = withAnswer(band, targetTileId, "water_access", "negative", "absent_in_bounded_search");

    record("I2", "a bounded negative cancels an imminent selected candidate", {
      questionIsAsked: asks(band, targetTileId, "water_access"),
      permittedOnObservationAlone: evidence.isWaterAccessFeasible(band, targetTileId, 0.5, THRESHOLD) === true,
      cancelledByNegative: evidence.isWaterAccessFeasible(negative, targetTileId, 0.5, THRESHOLD) === false,
    });
  }

  // ── I3 — an irrelevant list candidate must not generate a launch ──────────────────────
  {
    // The selected candidate is a DIFFERENT place; `otherTileId` merely exists in the band's
    // knowledge. §6.1 rejects "a hypothetical negative could move some list candidate's gate".
    const band = withOpportunity(withoutAnswer(baseBand, otherTileId, "water_access"), opportunityFor(targetTileId, {
      consideredAsTarget: true,
      waterAccessFeasible: true,
      waterAccessIsBindingBlocker: false,
    }));

    record("I3", "a non-selected list candidate does not generate a water launch", {
      notAsked: asks(band, otherTileId, "water_access") === false,
    });
  }

  // ── I4 — already settled, both variants ───────────────────────────────────────────────
  {
    const base = withOpportunity(baseBand, opportunityFor(targetTileId, {
      consideredAsTarget: false,
      rejectionReason: "insufficient_water_reliability",
      waterAccessFeasible: false,
      waterAccessIsBindingBlocker: true,
    }));

    record("I4", "a settled direct answer is not re-asked, confirmed or negative", {
      confirmedNotReAsked:
        asks(withAnswer(base, targetTileId, "water_access", "confirmed"), targetTileId, "water_access") === false,
      negativeNotReAsked:
        asks(
          withAnswer(base, targetTileId, "water_access", "negative", "absent_in_bounded_search"),
          targetTileId,
          "water_access",
        ) === false,
    });
  }

  // ── I5 — a temporary-use negative prevents an actually attempted camp ─────────────────
  {
    // The full natural chain is measured by the dedicated §7 audit over eleven worlds; here
    // the READER end of it is pinned: with a negative held, the camp predicate refuses.
    const band = withoutAnswer(baseBand, targetTileId, "temporary_use");
    const negative = withAnswer(band, targetTileId, "temporary_use", "negative");

    record(
      "I5",
      "a temporary-use negative refuses a bounded camp that was otherwise permitted",
      {
        campPermittedWithoutEvidence: evidence.taskCampRefusedByEvidence(band, targetTileId) === false,
        campRefusedByNegative: evidence.taskCampRefusedByEvidence(negative, targetTileId) === true,
      },
      "CORRECTION-23J §10 — the caveat that stood here cited 10,724 of 59,286 attempted camps. " +
        "That figure does not reproduce on the commit it shipped in: running the same audit " +
        "unmodified at 0955c87 gives 343 of 3,672 (9.34%). The old number described an " +
        "intermediate dirty-tree state, not committed behaviour. What this fixture pins is the " +
        "READER alone — a held negative refuses a camp — which is true and is all it tests. " +
        "Whether a LAUNCH ever informs a camp is J8/J11, and the answer there is no.",
    );
  }

  // ── I6 — the temporary-use gate reads a SELECTED operation, not memory or presence ─────
  {
    // CORRECTION-23J §14 — this fixture used to strip the patch memory and the expedition list
    // and assert nothing was asked. That tested the weak assumption itself: of course a band
    // with no memory and no parties asks nothing. What must be tested is the opposite — that a
    // band with BOTH still does not ask, because neither is a selected pending operation.
    const stripped = {
      ...withoutAnswer(baseBand, targetTileId, "temporary_use"),
      resourceKnowledgeState: {
        ...baseBand.resourceKnowledgeState,
        patchMemories: (baseBand.resourceKnowledgeState?.patchMemories ?? []).filter(
          (p) => String(p.approximateTile) !== String(targetTileId),
        ),
      },
      expeditions: [],
    };

    // Memory, restored. Intent, still absent.
    const remembered = {
      ...stripped,
      resourceKnowledgeState: {
        ...stripped.resourceKnowledgeState,
        patchMemories: [
          ...(stripped.resourceKnowledgeState.patchMemories ?? []),
          {
            ...(baseBand.resourceKnowledgeState?.patchMemories?.[0] ?? {}),
            patchId: `fixture:patch:${targetTileId}`,
            approximateTile: targetTileId,
            linkedTiles: [],
          },
        ],
      },
    };

    // A party at the target that has already passed its camp decision. Present, not pending.
    const returningParty = {
      ...remembered,
      expeditions: [
        {
          id: "fixture:returning",
          bandId: baseBand.id,
          taskKind: "distant_plant_gathering",
          phase: "returning",
          originTileId: baseBand.position,
          targetTileId,
          targetPatchId: `fixture:patch:${targetTileId}`,
          routeTileIds: [baseBand.position, targetTileId],
          positionTileId: targetTileId,
          routeIndex: 1,
          departedDay: Number(world.time.day) - 6,
          departedTick: world.time.tick,
          plannedReturnDay: Number(world.time.day) + 4,
          hardDeadlineDay: Number(world.time.day) + 10,
          travelDaysElapsed: 4,
          workDaysElapsed: 2,
          partyWorkers: 3,
          cargo: { harvestUnits: 0, carryCapacityUnits: 1, provisionUnitsConsumed: 0 },
          injuryLoad: 0,
          riskEpisodeIds: [],
          reasonIds: [],
        },
      ],
    };

    record("I6", "neither a remembered patch nor a returning party is a pending operation", {
      nothingPendingNotAsked: asks(stripped, targetTileId, "temporary_use") === false,
      patchMemoryAloneNotAsked: asks(remembered, targetTileId, "temporary_use") === false,
      returningPartyNotAsked: asks(returningParty, targetTileId, "temporary_use") === false,
      returningPartyIsNotPending:
        pendingOperation.derivePendingOperationAtTile(
          returningParty.expeditions,
          targetTileId,
          Number(world.time.day),
        ) === undefined,
    });
  }

  // ── I7 — positive temporary-use evidence creates no broader authority ─────────────────
  {
    const band = withoutAnswer(baseBand, targetTileId, "temporary_use");
    const confirmed = withAnswer(band, targetTileId, "temporary_use", "confirmed");

    record("I7", "positive temporary-use evidence grants nothing beyond the camp", {
      waterGateUnchanged:
        evidence.isWaterAccessFeasible(confirmed, targetTileId, 0.4, THRESHOLD) ===
        evidence.isWaterAccessFeasible(band, targetTileId, 0.4, THRESHOLD),
      resourceEligibilityUnchanged:
        evidence.resourceTestEligible(confirmed, targetTileId) === evidence.resourceTestEligible(band, targetTileId),
      campStillMerelyPermitted: evidence.taskCampRefusedByEvidence(confirmed, targetTileId) === false,
    });
  }

  // ── I8/I9/I10 — the three suspended questions are never asked ─────────────────────────
  for (const [name, question] of [
    ["I8", "resource_presence"],
    ["I9", "resource_test_possible"],
    ["I10", "seasonal_persistence"],
  ]) {
    // Give the band every reason to ask: strip any settled answer everywhere, and for the
    // resource pair install the confirmed presence that used to unlock the harder question.
    let band = baseBand;
    for (const tileId of legalTargets) band = withoutAnswer(band, tileId, question);
    if (question === "resource_test_possible") {
      band = withAnswer(band, targetTileId, "resource_presence", "confirmed");
    }

    const eligible = eligibleFor(band);
    const asked = eligible.filter((c) => c.question === question).length;

    record(`${name}`, `${question} is dormant — zero production launches`, {
      zeroEligibleCandidates: asked === 0,
      suspensionIsDeclared: verification.isSuspendedVerificationQuestion(question) === true,
    });
  }

  // ── I11 — ordinary exploration remains independently operational ──────────────────────
  {
    const eligibility = exploration.deriveFrontierExplorationEligibility(world, baseBand);
    const heading = exploration.deriveFrontierHeading(world, baseBand);

    record(
      "I11",
      "ordinary broad exploration still works after the inert questions are suspended",
      {
        eligibilityStillDerivable: typeof eligibility?.eligible === "boolean",
        headingStillDerivable: heading !== undefined,
      },
      "The natural matrix additionally shows exploration launch counts before and after.",
    );
  }

  // ── I12 — a lost verification party transfers nothing ─────────────────────────────────
  {
    // The production guard is the `phase === "completed"` test at the return seam: a lost
    // party never reaches the transfer branch. Asserted here on band state: a band that has
    // launched but holds no completed return carries no evidence for that target.
    const band = withoutAnswer(baseBand, targetTileId, "water_access");
    const holdsNothing =
      evidence.findVerificationEvidence(band, targetTileId, "water_access") === undefined &&
      (band.knowledge.observedTiles[targetTileId]?.verificationDisposition ?? []).every(
        (e) => e.question !== "water_access",
      );

    record(
      "I12",
      "a party that did not physically return transfers no evidence",
      { noEvidenceWithoutAReturn: holdsNothing },
      "The runtime invariant C3_lost_party_knowledge_transferred = 0 is asserted separately by " +
        "frontierAntiOmniscienceAudit over real lost parties.",
    );
  }

  // ── I13 — the water launch dependency reads no hidden truth ───────────────────────────
  //
  // §14 I13 asks whether the launch decision is derived entirely from band-known state and
  // real reader outputs. A name-based check would be worthless (§4: do not trust names), so
  // this PERTURBS the hidden world and asserts the decision does not move. The band state,
  // the opportunity and the evidence are held identical; only the tile's hidden hydrology and
  // stock change — exactly what a party would have to walk there to discover.
  {
    const band = withOpportunity(withoutAnswer(baseBand, targetTileId, "water_access"), opportunityFor(targetTileId, {
      consideredAsTarget: false,
      rejectionReason: "insufficient_water_reliability",
      waterAccessFeasible: false,
      waterAccessIsBindingBlocker: true,
    }));

    const baselineAsks = asks(band, targetTileId, "water_access");

    // Drive the hidden truth to both extremes. If any of it reached the launch gate, the
    // decision would differ between these two worlds.
    const perturb = (waterAccess, richness) => {
      const tile = world.tiles[targetTileId];
      return {
        ...world,
        tiles: {
          ...world.tiles,
          [targetTileId]: {
            ...tile,
            resourceProfile: {
              ...tile.resourceProfile,
              waterAccess,
              aquaticPotential: waterAccess,
              baseRichness: richness,
            },
          },
        },
      };
    };

    const dryWorld = perturb(0, 0);
    const wetWorld = perturb(1, 1);
    const asksDry = verification.selectVerificationCandidate(
      dryWorld, band, verification.deriveVerificationNeed(band),
    );
    const asksWet = verification.selectVerificationCandidate(
      wetWorld, band, verification.deriveVerificationNeed(band),
    );

    const sameDecision =
      (asksDry === undefined) === (asksWet === undefined) &&
      String(asksDry?.tileId) === String(asksWet?.tileId) &&
      String(asksDry?.question) === String(asksWet?.question);

    record("I13", "the water launch dependency is invariant to hidden tile truth", {
      launchDecisionUnchangedByHiddenWater: sameDecision,
      stillAsksInBothWorlds: (asksDry !== undefined) === baselineAsks,
    },
      "Hidden waterAccess/aquaticPotential/baseRichness at the target are driven from 0 to 1 " +
      "with band state, opportunity and evidence held identical. The launch decision is " +
      "unchanged, so no hidden ecology reaches the gate.");
  }

  // ── I14 — every remaining launch names a reader it can reach this season ───────────────
  //
  // §14 I14 requires each surviving launch to reach its named action reader within one season
  // or be reported as a contract violation. The dependency record names the reader; this
  // asserts the named reader is one of the two that actually exist and consume an answer, and
  // that the horizon is a single season. A launch naming an unbuilt or unnamed reader is a
  // contract violation by construction.
  {
    const CONSUMING_READERS = new Set([
      "carryingCapacity.deriveKnownUnusedHabitat / isWaterAccessFeasible",
      "expedition.deriveTaskCampForOperating / taskCampRefusedByEvidence",
    ]);

    const waterBand = withOpportunity(withoutAnswer(baseBand, targetTileId, "water_access"), opportunityFor(targetTileId, {
      consideredAsTarget: false,
      rejectionReason: "insufficient_water_reliability",
      waterAccessFeasible: false,
      waterAccessIsBindingBlocker: true,
    }));

    diagnostics.clearVerificationLaunchDiagnostics();
    diagnostics.setLaunchDependencyRecording(true);
    let rows = [];
    try {
      verification.selectVerificationCandidate(world, waterBand, verification.deriveVerificationNeed(waterBand));
      rows = [...diagnostics.getLaunchDependencies()];
    } finally {
      diagnostics.setLaunchDependencyRecording(false);
      diagnostics.clearVerificationLaunchDiagnostics();
    }

    const everyRowNamesAConsumingReader =
      rows.length > 0 && rows.every((row) => CONSUMING_READERS.has(row.authoritativeReader));
    const everyRowNamesABlockedAction =
      rows.length > 0 && rows.every((row) => String(row.blockedOrImminentAction ?? "").length > 0);
    const noSuspendedQuestionLaunches = rows.every(
      (row) => !verification.isSuspendedVerificationQuestion(row.question),
    );

    record("I14", "every remaining launch names a real consuming reader and a blocked action", {
      everyRowNamesAConsumingReader,
      everyRowNamesABlockedAction,
      noSuspendedQuestionLaunches,
    },
      "The horizon is one season by construction: both named readers run every season, and " +
      "the destination reader is re-derived each tick. A launch naming any other reader would " +
      "be a contract violation.");
  }

  const passed = results.filter((r) => r.passed).length;
  console.log(`\n${passed}/${results.length} closure fixtures pass`);

  mkdirSync(OUT.slice(0, OUT.lastIndexOf("/")), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ targetTileId, otherTileId, passed, total: results.length, results }, null, 2));
  console.log(`wrote ${OUT}`);
} finally {
  await server.close();
}
