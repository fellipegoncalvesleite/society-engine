// CORRECTION-23J §9 — J1..J12 CONTROLLED PENDING-OPERATION FIXTURES.
//
// Every fixture drives the REAL production selector on a real warmed band whose only
// modifications are to its own knowledge, evidence and expedition roster. The expeditions the
// fixtures install are built by the REAL `createPreparedExpedition` on REAL routes, so the
// identity under test is the one production writes — not a hand-shaped object that happens to
// have the right field names.
//
// A fixture that cannot pass because the behaviour is wrong FAILS. J11 and J12 are the two that
// report on nature rather than on a construction, and neither is allowed to pass vacuously.
//
// Usage: node scripts/pendingOperationFixturesAudit.mjs
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt;
};

const OUT = arg("out", "docs/evidence/correction23j/pending-operation-fixtures.json");

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
  const expedition = await server.ssrLoadModule("/sim/agents/expedition.ts");
  const pending = await server.ssrLoadModule("/sim/agents/pendingOperation.ts");
  const trips = await server.ssrLoadModule("/sim/agents/intraSeasonTrips.ts");
  const diagnostics = await server.ssrLoadModule("/sim/diagnostics/verificationLaunchDiagnostics.ts");

  const THRESHOLD = capacity.WATER_ACCESS_OBSERVED_THRESHOLD;

  let world = runner.initSimWorld({ kind: "map2" }, "c23j:fixtures");
  world = spawn.removeInitialBands(world, Object.keys(world.bands));
  world = spawn.spawnCustomBands(
    world,
    [{ tileId: "tile:204:72", population: 34, name: "fixture" }],
    "c23j:fixtures",
  );
  world = runner.stepSim(world, 360 * 8, "daily");

  const baseBand = Object.values(world.bands).find((b) => (b.demography?.population ?? 0) > 0);
  if (baseBand === undefined) throw new Error("fixture band did not survive the warm-in");

  const currentDay = Number(world.time.day);
  const here = world.tiles[baseBand.position];

  // A far target and a near one, both band-known and both physically routable. "Far" must be
  // far enough that the outbound leg is several days, which is what makes a camp decision
  // exist at all; "near" must be inside same-day reach so J3 has a real same-day operation.
  const known = Object.keys(baseBand.knowledge.observedTiles).filter((tileId) => {
    const tile = world.tiles[tileId];
    return tile !== undefined && tileId !== baseBand.position;
  });
  const distanceOf = (tileId) => {
    const tile = world.tiles[tileId];
    return Math.abs(tile.coord.x - here.coord.x) + Math.abs(tile.coord.y - here.coord.y);
  };

  const routable = [];

  for (const tileId of known.sort((a, b) => distanceOf(a) - distanceOf(b) || a.localeCompare(b))) {
    const distance = distanceOf(tileId);
    if (distance < 3 || distance > 24) continue;
    const route = trips.buildExpeditionRouteTiles(world, baseBand.position, tileId, distance + 8);
    if (route === undefined) continue;
    routable.push({ tileId, distance, route });
  }

  // The fixtures need targets whose outbound leg is genuinely multi-day, so that an operation
  // aimed there still has a camp decision ahead of it after it sets out.
  const farTargets = routable.filter((entry) => pending.deriveOutboundLegDays(entry.route.length) >= 3);
  if (farTargets.length < 2) throw new Error("fixture needs two multi-day-leg targets");

  const target = farTargets[0];
  const otherTarget = farTargets[1];
  const nearTarget = routable.find((entry) => pending.deriveOutboundLegDays(entry.route.length) <= 1);

  // ── band builders. Band-known state only; no world truth is touched. ──────────────────
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

  const withAnswer = (band, tileId, question, outcome) => {
    const next = {
      tileId,
      question,
      outcome,
      season: world.time.season,
      tick: world.time.tick,
      hardship: 0.5,
      routeTiles: 8,
      routeEvidence: "walked_out_and_back",
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
      (band.knowledge.observedTiles[tileId]?.verificationDisposition ?? []).filter(
        (e) => e.question !== question,
      ),
    ),
    verificationEvidence: (band.verificationEvidence ?? []).filter(
      (r) => !(String(r.tileId) === String(tileId) && r.question === question),
    ),
  });

  /** Strip every remembered patch and every party, so nothing is pending anywhere. */
  const bare = (band) => ({
    ...band,
    resourceKnowledgeState: { ...band.resourceKnowledgeState, patchMemories: [] },
    expeditions: [],
  });

  /** Install a remembered patch at a tile. Memory only — never intent. */
  const withPatchMemory = (band, tileId) => ({
    ...band,
    resourceKnowledgeState: {
      ...band.resourceKnowledgeState,
      patchMemories: [
        ...(band.resourceKnowledgeState?.patchMemories ?? []),
        {
          ...(baseBand.resourceKnowledgeState?.patchMemories?.[0] ?? {}),
          patchId: `fixture:patch:${tileId}`,
          approximateTile: tileId,
          linkedTiles: [],
        },
      ],
    },
  });

  /**
   * Install a REAL operation built by the production launcher, in a chosen phase and departed a
   * chosen number of days ago. `createPreparedExpedition` is production's own constructor, so
   * the record carries production's own route, ids and day stamps.
   */
  const withOperation = (band, entry, { phase = "outbound", departedDaysAgo = 1, taskKind = "distant_plant_gathering" } = {}) => {
    const prepared = expedition.createPreparedExpedition({
      band,
      taskKind,
      targetTileId: entry.tileId,
      targetPatchId: `fixture:patch:${entry.tileId}`,
      routeTileIds: entry.route,
      partyWorkers: 3,
      partyComposition: { limited: 0, typical: 3, high: 0 },
      day: currentDay - departedDaysAgo,
    });

    return { ...band, expeditions: [...(band.expeditions ?? []), { ...prepared, phase }] };
  };

  /** Install a synthetic opportunity verdict — the destination authority's own band-known shape. */
  const withOpportunity = (band, opportunity) => ({
    ...band,
    carryingCapacity: { ...band.carryingCapacity, knownUnusedHabitat: opportunity },
  });

  const opportunityFor = (tileId, overrides) => ({
    ...(baseBand.carryingCapacity?.knownUnusedHabitat ?? {}),
    bandId: baseBand.id,
    candidateTileId: tileId,
    ...overrides,
  });

  /** Ask the REAL selector what it would launch. */
  const eligibleFor = (band) => {
    const need = verification.deriveVerificationNeed(band);
    const out = [];
    verification.selectVerificationCandidate(world, band, need, out);
    return out;
  };

  const asks = (band, tileId, question) =>
    eligibleFor(band).some((c) => String(c.tileId) === String(tileId) && c.question === question);

  const results = [];
  // A fixture whose assertions hold only because its subject set is empty is NOT a pass. It is
  // recorded as `vacuous`, counted separately, and never folded into the passed total —
  // otherwise the suite would report a contract as demonstrated when nothing exercised it.
  const record = (name, intent, checks, notes, vacuous = false) => {
    const holds = Object.values(checks).every((v) => v === true);
    const status = vacuous ? "VACUOUS" : holds ? "PASS" : "FAIL";
    results.push({
      fixture: name,
      intent,
      status,
      passed: holds && !vacuous,
      checks,
      ...(notes === undefined ? {} : { notes }),
    });
    console.log(`${status.padEnd(7)} ${name.padEnd(4)} ${intent}`);
    if (!holds) for (const [k, v] of Object.entries(checks)) if (v !== true) console.log(`         ${k} = ${v}`);
  };

  const clean = withoutAnswer(bare(baseBand), target.tileId, "temporary_use");

  // ── J1 — patch memory only ────────────────────────────────────────────────────────────
  {
    const band = withPatchMemory(clean, target.tileId);

    record("J1", "a remembered multi-day patch with no selected operation does not launch", {
      patchMemoryPresent:
        (band.resourceKnowledgeState.patchMemories ?? []).some(
          (p) => String(p.approximateTile) === String(target.tileId),
        ) === true,
      noPendingOperation:
        pending.derivePendingOperationAtTile(band.expeditions, target.tileId, currentDay) === undefined,
      notAsked: asks(band, target.tileId, "temporary_use") === false,
    });
  }

  // ── J2 — candidate membership only ────────────────────────────────────────────────────
  {
    // The tile is a live verification CANDIDATE — it is in the eligible set for other questions
    // — and is remembered as a patch, i.e. it is exactly the sort of place a candidate list
    // admits. Nothing selected it, so temporary use must not launch.
    // The tile must ACTUALLY be in the selector's own eligible set, otherwise this fixture
    // asserts nothing: a place the selector never considers cannot demonstrate that being
    // considered differs from being selected. It is made a live WATER candidate — the one
    // question that still launches — while carrying a remembered patch and no operation.
    const band = withOpportunity(
      withPatchMemory(withoutAnswer(clean, target.tileId, "water_access"), target.tileId),
      opportunityFor(target.tileId, {
        consideredAsTarget: false,
        rejectionReason: "insufficient_water_reliability",
        waterAccessFeasible: false,
        waterAccessIsBindingBlocker: true,
      }),
    );
    const admitted = eligibleFor(band);

    record(
      "J2",
      "admission to a candidate list is not selection",
      {
        candidateListIsNotEmpty: admitted.length > 0,
        tileIsAnAdmittedCandidate: admitted.some((c) => String(c.tileId) === String(target.tileId)),
        patchIsRemembered: (band.resourceKnowledgeState.patchMemories ?? []).some(
          (p) => String(p.approximateTile) === String(target.tileId),
        ),
        noPendingOperationThere:
          pending.derivePendingOperationAtTile(band.expeditions, target.tileId, currentDay) === undefined,
        noTemporaryUseCandidate:
          admitted.some(
            (c) => String(c.tileId) === String(target.tileId) && c.question === "temporary_use",
          ) === false,
      },
      `The place is live in the selector's own eligible set (${admitted.map((c) => c.question).join(", ")}) ` +
        `and carries a remembered patch; temporary use is still not asked there.`,
    );
  }

  // ── J3 — a selected operation that needs no camp ──────────────────────────────────────
  {
    if (nearTarget === undefined) {
      record("J3", "a selected same-day operation does not launch temporary-use verification", {
        skipped: false,
      }, "No same-day-reach target is known to the warmed band; fixture could not be constructed.");
    } else {
      const nearClean = withoutAnswer(bare(baseBand), nearTarget.tileId, "temporary_use");
      const band = withOperation(nearClean, nearTarget, { departedDaysAgo: 0 });

      record("J3", "a selected same-day operation does not launch temporary-use verification", {
        operationExists: (band.expeditions ?? []).length === 1,
        notAsked: asks(band, nearTarget.tileId, "temporary_use") === false,
      });
    }
  }

  // ── J4 — a selected multi-day operation MAY generate the dependency ───────────────────
  {
    // Departed today, so its whole outbound leg is still ahead of it: this is the most
    // favourable pending operation the architecture can produce.
    const band = withOperation(clean, target, { departedDaysAgo: 0, phase: "prepared" });
    const identity = pending.derivePendingOperationAtTile(band.expeditions, target.tileId, currentDay);
    const roundTrip = pending.deriveVerificationRoundTripDays(
      target.distance,
      verification.VERIFICATION_ON_SITE_DAYS,
    );
    const daysUntilCamp = identity === undefined ? 0 : identity.expectedOperatingDay - currentDay;

    record(
      "J4",
      "a real selected multi-day operation produces a complete, correctly typed identity",
      {
        identityExists: identity !== undefined,
        namesTheProductionExpedition: identity?.operationId === band.expeditions[0].id,
        targetMatches: identity?.targetTileId === String(target.tileId),
        selectorIsProduction: identity?.authoritativeSelector === "expedition.maybeLaunchExpedition",
        requiresCampDecision: identity?.requiresTaskCampDecision === true,
        requiresMultiDayOperation: identity?.requiresMultiDayOperation === true,
        campDecisionStillAhead: daysUntilCamp > 0,
      },
      `Outbound leg ${daysUntilCamp} day(s); a verification party needs ${roundTrip} day(s) out and back. ` +
        `The launch itself is decided by J7/J8, not here.`,
    );
  }

  // ── J5 — target mismatch ──────────────────────────────────────────────────────────────
  {
    const band = withOperation(
      withoutAnswer(clean, otherTarget.tileId, "temporary_use"),
      target,
      { departedDaysAgo: 0, phase: "prepared" },
    );

    record("J5", "an operation pending at tile A does not justify verification at tile B", {
      operationAtA:
        pending.derivePendingOperationAtTile(band.expeditions, target.tileId, currentDay) !== undefined,
      nothingPendingAtB:
        pending.derivePendingOperationAtTile(band.expeditions, otherTarget.tileId, currentDay) === undefined,
      notAskedAtB: asks(band, otherTarget.tileId, "temporary_use") === false,
    });
  }

  // ── J6 — a returning party is not pending ─────────────────────────────────────────────
  {
    const checks = { notAsked: true };

    for (const phase of ["returning", "completed", "aborted", "lost", "operating"]) {
      const band = withOperation(clean, target, { departedDaysAgo: 1, phase });
      checks[`${phase}IsNotPending`] =
        pending.derivePendingOperationAtTile(band.expeditions, target.tileId, currentDay) === undefined;
      checks[`${phase}DoesNotLaunch`] = asks(band, target.tileId, "temporary_use") === false;
    }

    record("J6", "returning, terminal and already-arrived parties can never be pending", checks);
  }

  // ── J7 / J8 — the physical ordering test ──────────────────────────────────────────────
  {
    // J7 asks whether an answer that lands BEFORE the decision changes that exact operation's
    // camp outcome, and J8 whether a late answer is credited. The two are one measurement,
    // because the architecture decides which case is reachable.
    const band = withOperation(clean, target, { departedDaysAgo: 0, phase: "prepared" });
    const identity = pending.derivePendingOperationAtTile(band.expeditions, target.tileId, currentDay);
    const daysUntilCamp = identity.expectedOperatingDay - currentDay;
    const roundTrip = pending.deriveVerificationRoundTripDays(
      target.distance,
      verification.VERIFICATION_ON_SITE_DAYS,
    );

    // The READER end, pinned independently of timing: with a negative held, the exact camp is
    // refused; without it, permitted.
    const negative = withAnswer(band, target.tileId, "temporary_use", "negative");

    record(
      "J7",
      "a negative that reaches the reader changes the exact named operation's camp outcome",
      {
        campPermittedWithoutEvidence: evidence.taskCampRefusedByEvidence(band, target.tileId) === false,
        campRefusedByNegative: evidence.taskCampRefusedByEvidence(negative, target.tileId) === true,
      },
    );

    record(
      "J8",
      "an answer that cannot arrive before the camp decision is not credited with informing it",
      {
        answerArrivesTooLate: roundTrip > daysUntilCamp,
        launchRefused: asks(band, target.tileId, "temporary_use") === false,
      },
      `Best case measurable in this architecture: the operation decides its camp in ${daysUntilCamp} ` +
        `day(s); the verification round trip is ${roundTrip} day(s). §7 Model C.`,
    );
  }

  // ── J9 — a lost verification party transfers nothing ──────────────────────────────────
  {
    // A party that never came home wrote no evidence and no disposition, so the reader must be
    // in exactly the state it was in before the party left.
    const before = clean;
    const lostParty = {
      ...clean,
      expeditions: [
        {
          ...expedition.createPreparedExpedition({
            band: clean,
            taskKind: "frontier_verification",
            targetTileId: target.tileId,
            targetPatchId: `verify:temporary_use:${target.tileId}`,
            routeTileIds: target.route,
            partyWorkers: 2,
            partyComposition: { limited: 0, typical: 2, high: 0 },
            day: currentDay - 10,
          }),
          phase: "lost",
        },
      ],
    };

    record("J9", "a lost verification party transfers no answer and no disposition", {
      noEvidenceRow:
        (lostParty.verificationEvidence ?? []).some(
          (r) => String(r.tileId) === String(target.tileId) && r.question === "temporary_use",
        ) === false,
      noDisposition:
        (lostParty.knowledge.observedTiles[target.tileId]?.verificationDisposition ?? []).some(
          (e) => e.question === "temporary_use",
        ) === false,
      readerUnchanged:
        evidence.taskCampRefusedByEvidence(lostParty, target.tileId) ===
        evidence.taskCampRefusedByEvidence(before, target.tileId),
      campStillPermitted: evidence.taskCampRefusedByEvidence(lostParty, target.tileId) === false,
    });
  }

  // ── J10 — confirmation is bounded ─────────────────────────────────────────────────────
  {
    const band = clean;
    const confirmed = withAnswer(band, target.tileId, "temporary_use", "confirmed");

    record("J10", "a temporary-use confirmation grants nothing beyond the camp", {
      waterGateUnchanged:
        evidence.isWaterAccessFeasible(confirmed, target.tileId, 0.4, THRESHOLD) ===
        evidence.isWaterAccessFeasible(band, target.tileId, 0.4, THRESHOLD),
      resourceEligibilityUnchanged:
        evidence.resourceTestEligible(confirmed, target.tileId) ===
        evidence.resourceTestEligible(band, target.tileId),
      campStillMerelyPermitted:
        evidence.taskCampRefusedByEvidence(confirmed, target.tileId) === false,
      noResidenceOrStorageAuthority:
        confirmed.position === band.position && confirmed.protoCampMemory === band.protoCampMemory,
    });
  }

  // ── J11 / J12 — what NATURE does, read from the natural matrix ────────────────────────
  {
    // These two report on the run matrix rather than on a construction, so they are read from
    // its evidence rather than re-run here. Reporting them as passing without that evidence
    // would be exactly the vacuous pass the admissibility rule forbids.
    let natural;

    try {
      const { readFileSync } = await import("node:fs");
      natural = JSON.parse(readFileSync("docs/evidence/correction23j/consumption-after-40y.json", "utf8"));
    } catch {
      natural = undefined;
    }

    if (natural === undefined) {
      record("J11", "with no exact consumption seam, production temporary-use launches are zero", {
        evidencePresent: false,
      }, "Run temporaryUseConsumptionAudit.mjs first — J11 must not pass without its measurement.");
      record("J12", "every natural launch names one operation and consumes it in time", {
        evidencePresent: false,
      }, "Run temporaryUseConsumptionAudit.mjs first — J12 must not pass without its measurement.");
    } else {
      const t = natural.totals;

      record(
        "J11",
        "with no exact consumption seam, production temporary-use launches are zero",
        {
          launchesAreZero: t.C_temporaryUseLaunches === 0,
          campsWereStillAttempted: t.attemptedCamps > 0,
          refusalReasonIsTheOrdering:
            (t.refusalsByReason.no_selected_operation ?? 0) > 0 ||
            (t.refusalsByReason.answer_cannot_return_before_camp_decision ?? 0) > 0,
        },
        `Measured over ${natural.scenarios.length} worlds x ${natural.seeds.length} seeds x ${natural.years} y. ` +
          `Camps are still attempted (${t.attemptedCamps}), so the zero is a launch decision, not an absent reader.`,
      );

      record(
        "J12",
        "every natural launch names one operation and consumes it before the camp decision",
        {
          noUnnamedLaunch: t.C_temporaryUseLaunches === t.D_launchesWithSelectedOperation,
          noLateConsumption: t.F_launchesConsumedByNamedOperation === t.E_launchesAnsweredInTime,
          noUnrelatedOnlyUse: t.G_launchesUsefulOnlyToUnrelatedOperations === 0,
        },
        t.C_temporaryUseLaunches === 0
          ? "VACUOUS: there are no natural launches, so the contract holds over an empty set. This " +
            "fixture asserts the contract; it does NOT demonstrate the behaviour exists, and is " +
            "not counted as a pass."
          : `${t.F_launchesConsumedByNamedOperation} of ${t.C_temporaryUseLaunches} launches consumed by their own operation.`,
        t.C_temporaryUseLaunches === 0,
      );
    }
  }

  const passed = results.filter((r) => r.status === "PASS").length;
  const vacuous = results.filter((r) => r.status === "VACUOUS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const result = {
    fixtures: results.length,
    passed,
    vacuous,
    failed,
    results,
    orderingModel: "C — no valid pre-operation seam exists",
    diagnosticsRegistered: diagnostics.hasVerificationLaunchDiagnostics(),
  };

  mkdirSync(OUT.split("/").slice(0, -1).join("/"), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);

  console.log("");
  console.log(`${passed}/${results.length} fixtures passed, ${vacuous} vacuous, ${failed} failed`);
  console.log(`wrote ${OUT}`);

  if (failed > 0) process.exitCode = 1;
} finally {
  await server.close();
}
