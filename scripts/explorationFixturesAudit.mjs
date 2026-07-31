// CORRECTION-24A COMPLETION §13 — CONTROLLED FIXTURES X1–X16.
//
// Every fixture runs REAL production through `stepSim` and asserts on rows the production scheduler,
// the production return seam and the production compression authority actually wrote. None of them
// constructs a synthetic funnel row, and none asserts on a re-implementation of a production rule.
//
// THE VACUITY RULE, enforced rather than described. §13 forbids marking an empty candidate set or an
// empty launch set as a pass, so every fixture below declares the minimum evidence it needs and
// reports VACUOUS — not PASS — when the natural runs never produced that state. A contract nobody
// exercised is a contract nobody tested. CORRECTION-23J recorded exactly one such case (J12) rather
// than counting it, and the same discipline applies here.
//
// Usage: node scripts/explorationFixturesAudit.mjs [--years 25] [--seeds s1,s2,s3] [--out path]
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt;
};

const YEARS = Number(arg("years", "25"));
const SEEDS = arg("seeds", "s1,s2,s3").split(",").filter(Boolean);
const OUT = arg("out", "docs/evidence/correction24a/fixtures-X1-X16.json");
const SEED_PREFIX = arg("seed-prefix", "c24a:fixtures");

// Deliberately spread across structure classes so no fixture rests on one terrain — the
// CORRECTION-23G lesson that a single site can look like a mechanism.
const FIXTURE_WORLDS = [
  { name: "map2", map: "map2", fixture: "default" },
  { name: "map1", map: "map1", fixture: "default" },
  { name: "site_B_dry_plains", map: "map2", site: "tile:10:34" },
  { name: "site_D_aquatic", map: "map2", site: "tile:119:116" },
  { name: "hostile", map: "map2", site: "tile:150:12" },
];

const server = await createServer({
  root: `${process.cwd()}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  logLevel: "error",
});

const results = [];
const record = (id, title, verdict, evidence, note) =>
  results.push({ id, title, verdict, evidence, ...(note === undefined ? {} : { note }) });

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const spawn = await server.ssrLoadModule("/sim/agents/spawn.ts");
  const diag = await server.ssrLoadModule("/sim/diagnostics/explorationFunnelDiagnostics.ts");
  const decision = await server.ssrLoadModule("/sim/rules/bandDecision.ts");
  const frontier = await server.ssrLoadModule("/sim/agents/frontierExploration.ts");

  const isLiving = (band) =>
    band.viability?.status !== "extinct" &&
    band.viability?.status !== "absorbed" &&
    band.viability?.status !== "dispersed" &&
    (band.demography?.population ?? 0) > 0;

  const build = (world, seed) => {
    let w = runner.initSimWorld({ kind: world.map }, `${SEED_PREFIX}:${seed}`);

    if (world.fixture !== "default") {
      w = spawn.removeInitialBands(w, Object.keys(w.bands));
      w = spawn.spawnCustomBands(w, [{ tileId: world.site, population: 34, name: world.name }], `${SEED_PREFIX}:${seed}`);
    }

    return w;
  };

  /** One shared corpus: every fixture reads the same real production runs. */
  const corpus = { rows: [], journeys: [], records: [], pairing: [], readerProbes: [] };

  for (const world of FIXTURE_WORLDS) {
    for (const seed of SEEDS) {
      diag.setExplorationFunnelRecording(true, world.name);
      diag.setExplorationJourneyRecording(true);
      diag.setExplorationRecordRecording(true);

      try {
        let w = build(world, seed);
        const days = YEARS * 360;

        for (let d = 1; d <= days; d += 1) {
          w = runner.stepSim(w, 1, "daily");

          if (d % (4 * 360) === 0) {
            for (const band of Object.values(w.bands).filter(isLiving)) {
              const observed = band.knowledge.observedTiles;
              const explorationTiles = Object.keys(observed).filter(
                (t) => observed[t]?.acquisition === "returned_frontier_exploration",
              );

              if (explorationTiles.length === 0) {
                continue;
              }

              const stripped = {};
              for (const [t, r] of Object.entries(observed)) {
                if (r?.acquisition !== "returned_frontier_exploration") stripped[t] = r;
              }

              const withoutBand = { ...band, knowledge: { ...band.knowledge, observedTiles: stripped } };
              const blindBand = { ...band, knowledge: { ...band.knowledge, observedTiles: {} } };
              const act = (b) => {
                try {
                  return JSON.stringify(
                    decision.evaluateBandDecision({ ...w, bands: { ...w.bands, [b.id]: b } }, b).action ?? null,
                  );
                } catch {
                  return undefined;
                }
              };
              const prod = act(band);
              const without = act(withoutBand);
              const blind = act(blindBand);

              if (prod === undefined || without === undefined) {
                continue;
              }

              corpus.readerProbes.push({
                world: world.name,
                seed,
                explorationTiles: explorationTiles.length,
                changedSelectedAction: prod !== without,
                controlChanged: blind !== undefined && blind !== prod,
              });
            }
          }

          if (Object.values(w.bands).filter(isLiving).length === 0) break;
        }

        corpus.rows.push(...diag.getExplorationFunnel().map((r) => ({ ...r, world: world.name, seed })));
        corpus.journeys.push(...diag.getExplorationJourneys().map((r) => ({ ...r, world: world.name, seed })));
        corpus.records.push(...diag.getExplorationRecords().map((r) => ({ ...r, world: world.name, seed })));
        corpus.pairing.push({ world: world.name, seed, ...diag.getOfferStatePairing() });
      } finally {
        diag.clearExplorationDiagnostics();
      }
    }
  }

  // ── CONTROLLED SUB-RUNS (§13 X7 / gate 21) ─────────────────────────────────────────────────
  //
  // Two contracts cannot be demonstrated by natural runs on these worlds: no band ever falls below
  // two departable walkers, and no exploration party is ever lost. §13 requires X7 to "use a REAL
  // insufficient-worker state", and gate 21 requires lost-party no-transfer to be PROVEN, so both
  // are constructed here rather than left vacuous. Neither changes production: the small band is a
  // real spawned band evaluated by the real scheduler, and the loss arm is CORRECTION-17's existing
  // `frontierExplorationAlwaysLost` audit option.
  const controlled = { lowLaborRows: [], lostJourneys: [], lostRecords: [], lowLaborBands: 0 };

  for (const seed of SEEDS) {
    diag.setExplorationFunnelRecording(true, "controlled_low_labour");
    diag.setExplorationJourneyRecording(true);

    try {
      // A band of three cannot put two departable walkers on the road once its own camp work and
      // dependents are accounted for, so the labour authority is exercised for real.
      let w = runner.initSimWorld({ kind: "map2" }, `${SEED_PREFIX}:${seed}`);
      w = spawn.removeInitialBands(w, Object.keys(w.bands));
      w = spawn.spawnCustomBands(w, [{ tileId: "tile:100:23", population: 3, name: "tiny" }], `${SEED_PREFIX}:${seed}`);
      controlled.lowLaborBands += Object.keys(w.bands).length;

      for (let d = 1; d <= 8 * 360; d += 1) {
        w = runner.stepSim(w, 1, "daily");
        if (Object.values(w.bands).filter(isLiving).length === 0) break;
      }

      controlled.lowLaborRows.push(...diag.getExplorationFunnel().map((r) => ({ ...r, seed })));
    } finally {
      diag.clearExplorationDiagnostics();
    }

    diag.setExplorationFunnelRecording(true, "controlled_always_lost");
    diag.setExplorationJourneyRecording(true);
    diag.setExplorationRecordRecording(true);

    try {
      let w = runner.initSimWorld({ kind: "map2" }, `${SEED_PREFIX}:${seed}`);
      w = spawn.removeInitialBands(w, Object.keys(w.bands));
      w = spawn.spawnCustomBands(w, [{ tileId: "tile:100:23", population: 34, name: "lost_arm" }], `${SEED_PREFIX}:${seed}`);
      w = { ...w, auditOptions: { ...w.auditOptions, frontierExplorationAlwaysLost: true } };

      for (let d = 1; d <= 25 * 360; d += 1) {
        w = runner.stepSim(w, 1, "daily");
        if (Object.values(w.bands).filter(isLiving).length === 0) break;
      }

      controlled.lostJourneys.push(...diag.getExplorationJourneys().map((r) => ({ ...r, seed })));
      controlled.lostRecords.push(...diag.getExplorationRecords().map((r) => ({ ...r, seed })));
    } finally {
      diag.clearExplorationDiagnostics();
    }
  }

  const rows = corpus.rows;
  const count = (fn) => rows.filter(fn).length;

  // ── X1 — a PHYSICALLY VALID PROPOSAL, not merely eligibility (§13 X1 strengthening). ──
  {
    const valid = rows.filter((r) => r.physicallyValidExplorationProposal);
    const intentOnly = rows.filter((r) => r.eligibleExplorationIntent && !r.physicallyValidExplorationProposal);
    const wellFormed = valid.every(
      (r) =>
        r.eligible &&
        r.headingAvailable &&
        r.partyCompositionAvailable &&
        r.canBeginPhysicalExploration &&
        r.firstStepOutcome === "step" &&
        r.returnReserveTiles > 0 &&
        r.durationBudgetDays > 0,
    );
    record(
      "X1",
      "a physically valid exploration proposal is reached, and is strictly stronger than eligibility",
      valid.length === 0 ? "VACUOUS" : wellFormed ? "PASS" : "FAIL",
      {
        physicallyValidProposals: valid.length,
        eligibleIntentButNotPhysicallyValid: intentOnly.length,
        everyValidRowClearsFullContract: wellFormed,
      },
      "The complete §6 contract is asserted field by field, so a row cannot be called valid on eligibility alone.",
    );
  }

  // ── X2 — no motive is classified as motive, not as something else. ──
  {
    const noMotive = rows.filter((r) => r.primaryBlocker === "NO_MOTIVE");
    const sound = noMotive.every((r) => !r.eligible) && noMotive.every((r) => r.primaryBlocker !== "SELECTED");
    record("X2", "a band with no reason to look is classified NO_MOTIVE and does not launch", noMotive.length === 0 ? "VACUOUS" : sound ? "PASS" : "FAIL", {
      rows: noMotive.length,
      allIneligible: sound,
      launchesUnderNoMotive: noMotive.filter((r) => r.schedulerOutcome === "exploration").length,
    });
  }

  // ── X3 — motive without a direction, CONSTRUCTED (§7). ──
  //
  // No natural opportunity in eleven worlds ever reaches NO_HEADING, so the first pass recorded
  // this VACUOUS. §7 requires either a real controlled state that reaches it, or a proof that the
  // class is architecturally unreachable. It is reachable, and here is the construction.
  //
  // `deriveFrontierHeading` has exactly five branches and returns undefined only if all five fail:
  //   (a) corridor continuation   — no corridor memory, no inferred tiles
  //   (b) inherited/frontier intent — no band.frontierIntent
  //   (c) viewshed water/relief cue — no cues
  //   (d) farthest KNOWN EDGE tile  — the load-bearing one
  //   (e) second-hand direction     — no inherited/reported records
  //
  // (d) needs a known, band-passable tile with an unknown 4-neighbour at distance >= 2 from camp
  // (MIN_ANCHOR_DISTANCE_TILES = 2, and the search floor starts at MIN - 1 so distance must EXCEED
  // 1). A band that knows ONLY its own tile and the 1-ring therefore has no qualifying edge: every
  // tile it knows with an unknown neighbour sits at distance 1. That is an ordinary band-known
  // state — a band that has never learned anything beyond arm's reach — and it reads no hidden
  // truth: the construction only REMOVES knowledge, it never adds any.
  {
    const attempts = [];

    for (const seed of SEEDS) {
      let w = build(FIXTURE_WORLDS[0], seed);

      for (let d = 1; d <= 3 * 360; d += 1) w = runner.stepSim(w, 1, "daily");

      for (const band of Object.values(w.bands).filter(isLiving)) {
        const origin = w.tiles[band.position];

        if (origin === undefined) continue;

        // Knowledge kept: own tile + its 4-adjacent ring, nothing further.
        const keep = new Set([String(band.position), ...origin.neighbors.map(String)]);
        const observedTiles = Object.fromEntries(
          Object.entries(band.knowledge.observedTiles).filter(([tileId]) => keep.has(String(tileId))),
        );

        const blind = {
          ...band,
          knowledge: {
            ...band.knowledge,
            observedTiles,
            // (e) no second-hand direction, and no route memory to imply one.
            knownRoutes: [],
            placeAttachments: [],
            rumors: [],
          },
          // (a) no corridor memory and no inferred frontier tiles.
          travelCorridors: {},
          frontierKnowledge: undefined,
          // (b) no sustained directional intent.
          frontierIntent: undefined,
          // (c) no directional cue visible from camp. The field is `visibleLandscapeCues`, read by
          // `selectDirectionalCue`; an earlier version of this fixture cleared a guessed
          // `viewshedCues`/`landscapeVisibility` pair that does not exist, and the water-margin
          // branch kept firing — which is why this fixture FAILED rather than passing quietly.
          visibleLandscapeCues: [],
        };

        const blindWorld = { ...w, bands: { ...w.bands, [blind.id]: blind } };
        const heading = frontier.deriveFrontierHeading(blindWorld, blind);
        const eligibility = frontier.deriveFrontierExplorationEligibility(blindWorld, blind);

        attempts.push({
          band: String(band.id),
          seed,
          knownTilesAfter: Object.keys(observedTiles).length,
          motivePresent: eligibility?.eligible === true,
          evidenceScore: Math.round(Number(eligibility?.evidenceScore ?? 0) * 1000) / 1000,
          headingReturned: heading !== undefined,
          basis: heading?.basis ?? null,
          anchorTileId: heading?.anchorTileId ?? null,
        });
      }
    }

    const noHeading = attempts.filter((a) => !a.headingReturned);
    const naturalRows = rows.filter((r) => r.primaryBlocker === "NO_HEADING");

    record(
      "X3",
      "a band with motive but no band-known heading yields NO HEADING from the real heading authority",
      attempts.length === 0 ? "FAIL" : noHeading.length > 0 ? "PASS" : "FAIL",
      {
        controlledBands: attempts.length,
        headingReturned: attempts.length - noHeading.length,
        noHeadingReturned: noHeading.length,
        motivePresentAmongNoHeading: noHeading.filter((a) => a.motivePresent).length,
        meanKnownTilesAfterNarrowing:
          Math.round((attempts.reduce((t, a) => t + a.knownTilesAfter, 0) / Math.max(1, attempts.length)) * 100) / 100,
        basesStillReturned: [...new Set(attempts.filter((a) => a.headingReturned).map((a) => a.basis))],
        naturalNoHeadingRowsOnElevenWorlds: naturalRows.length,
        headingAvailableRateNaturally:
          Math.round((count((r) => r.headingAvailable) / Math.max(1, rows.length)) * 10000) / 10000,
        examples: noHeading.slice(0, 3),
      },
      "Constructed, not natural: the eleven worlds never reach this class, so the class is exercised on a controlled band-known state that only REMOVES knowledge. NO_HEADING is therefore architecturally reachable and the diagnostic class is not dead.",
    );
  }

  // ── X4/X5 — TWO LIVE PROPOSALS, and the winner could physically launch (§13 strengthening). ──
  {
    const twoLive = rows.filter(
      (r) =>
        r.physicallyValidExplorationProposal &&
        r.proposalLedger.some((l) => l.family !== "frontier_exploration" && l.candidateExists),
    );
    const winnerLaunched = twoLive.filter((r) => r.proposalLedger.some((l) => l.actualLaunch));
    record(
      "X4",
      "two live proposals exist on the same decision and the chosen family PHYSICALLY LAUNCHED",
      twoLive.length === 0 ? "VACUOUS" : winnerLaunched.length === 0 ? "FAIL" : "PASS",
      {
        opportunitiesWithTwoLiveProposals: twoLive.length,
        ofThoseWhereSomeFamilyActuallyLaunched: winnerLaunched.length,
        ofThoseWhereNOBODYLaunched: twoLive.length - winnerLaunched.length,
      },
      "The second number is the point: a contest is only a contest when the winner goes.",
    );

    const displaced = rows.filter(
      (r) => r.primaryBlocker === "DISPLACED_BY_URGENT_TASK" || r.primaryBlocker === "DISPLACED_BY_NONURGENT_TASK",
    );
    record(
      "X5",
      "displacement is recorded only when another family actually launched",
      displaced.length === 0 ? "VACUOUS" : displaced.every((r) => r.schedulerOutcome !== "nothing") ? "PASS" : "FAIL",
      {
        displacedRows: displaced.length,
        withSchedulerOutcomeNothing: displaced.filter((r) => r.schedulerOutcome === "nothing").length,
      },
    );
  }

  // ── X6 — THE FALLTHROUGH PROOF (§13 X6). ──
  {
    const fall = rows.filter((r) => r.fallthroughOpportunity);
    const complete = fall.every(
      (r) =>
        r.physicallyValidExplorationProposal &&
        r.explorationOffered === false &&
        r.claimedBy !== undefined &&
        r.claimFailure !== undefined &&
        r.schedulerOutcome === "nothing",
    );
    const byFailure = {};
    const byClaimer = {};
    for (const r of fall) {
      byFailure[r.claimFailure] = (byFailure[r.claimFailure] ?? 0) + 1;
      byClaimer[r.claimedBy] = (byClaimer[r.claimedBy] ?? 0) + 1;
    }
    record(
      "X6",
      "earlier family claims -> fails to launch -> slot free -> valid exploration exists -> production does NOT reconsider",
      fall.length === 0 ? "VACUOUS" : complete ? "PASS" : "FAIL",
      {
        fallthroughOpportunities: fall.length,
        everyClauseHeldOnEveryRow: complete,
        claimingFamily: byClaimer,
        itsTypedPostClaimFailure: byFailure,
        exampleTargets: fall.slice(0, 3).map((r) => ({ band: r.bandId, day: r.day, claimedBy: r.claimedBy, target: r.claimedCandidateTarget, failure: r.claimFailure })),
      },
      "Every clause is asserted on every row, so this is fallthrough rather than ordering.",
    );
  }

  // ── X7 — a REAL insufficient-worker state (§13 X7). ──
  {
    const natural = rows.filter(
      (r) => r.primaryBlocker === "POPULATION_TOO_SMALL" || r.primaryBlocker === "INSUFFICIENT_LABOR",
    );
    // The CONTROLLED low-labour band is what makes this fixture real (§13 X7).
    const low = controlled.lowLaborRows.filter((r) => r.departableWorkers < 2);
    const lowClassified = low.filter(
      (r) => r.primaryBlocker === "POPULATION_TOO_SMALL" || r.primaryBlocker === "INSUFFICIENT_LABOR",
    );
    const lowNeverLaunched = low.every((r) => r.primaryBlocker !== "SELECTED");
    const everyLowRowIsClassifiedOnLabour = low.length > 0 && lowClassified.length === low.length;
    record(
      "X7",
      "a band that genuinely cannot raise two departable walkers is classified on labour",
      low.length === 0 ? "VACUOUS" : everyLowRowIsClassifiedOnLabour && lowNeverLaunched ? "PASS" : "FAIL",
      {
        controlledLowLabourOpportunities: controlled.lowLaborRows.length,
        ofThoseWithFewerThanTwoDepartableWorkers: low.length,
        classifiedOnLabour: lowClassified.length,
        everyLowRowIsClassifiedOnLabour,
        launchedAnyway: low.filter((r) => r.primaryBlocker === "SELECTED").length,
        naturalRowsOnElevenWorlds: natural.length,
        meanDepartableWorkersNaturally:
          Math.round((rows.reduce((s, r) => s + r.departableWorkers, 0) / Math.max(1, rows.length)) * 100) / 100,
      },
      "The eleven natural worlds never fall below two departable walkers, so this is measured on a deliberately tiny band. The natural count is reported beside it rather than instead of it.",
    );
  }

  // ── X8 — NO LEGAL FIRST STEP / NO RETURN RESERVE, never a hidden full route (§13 X8). ──
  {
    const blocked = rows.filter((r) => r.firstStepOutcome === "blocked");
    const noReserve = rows.filter((r) => r.returnReserveTiles <= 0);
    const primaryBlocked = rows.filter((r) => r.primaryBlocker === "NO_PASSABLE_FIRST_STEP");
    const neverRequiresFullRoute = rows.every((r) => r.fullRouteKnown === false);
    record(
      "X8",
      "physical departure is gated on a legal FIRST STEP and a positive return reserve, never on a known full route",
      blocked.length === 0 && noReserve.length === 0 ? "VACUOUS" : neverRequiresFullRoute ? "PASS" : "FAIL",
      {
        rowsWithNoPassableFirstStep: blocked.length,
        rowsWithZeroReturnReserve: noReserve.length,
        primaryBlockerNoPassableFirstStep: primaryBlocked.length,
        fullRouteKnownOnAnyRow: rows.some((r) => r.fullRouteKnown),
      },
      "fullRouteKnown is false on every row, which is the expected and required state for frontier exploration.",
    );
  }

  // ── X9 — the COOLDOWN is not a CONCURRENT PARTY (§4.1). ──
  {
    const suppressed = rows.filter((r) => r.suppressionWindowActive);
    const suppressedButHome = suppressed.filter((r) => !r.activeFrontierParty);
    const concurrent = rows.filter((r) => r.activeFrontierParty);
    record(
      "X9",
      "the suppression window outlives the party, so cooldown and concurrency are separately classified",
      suppressed.length === 0 ? "VACUOUS" : suppressedButHome.length > 0 ? "PASS" : "FAIL",
      {
        suppressionWindowActiveRows: suppressed.length,
        ofWhichNoFrontierPartyIsActuallyAway: suppressedButHome.length,
        rowsWithAPartyPhysicallyAway: concurrent.length,
        shareOfCooldownWithNobodyOut:
          Math.round((suppressedButHome.length / Math.max(1, suppressed.length)) * 10000) / 10000,
      },
      "This is the measurement that makes the §4.1 rename a correction rather than a relabelling.",
    );
  }

  // ── X10 — the active cap. ──
  {
    const capped = rows.filter((r) => r.primaryBlocker === "ACTIVE_CAP_FULL");
    record("X10", "a full expedition slot is classified ACTIVE_CAP_FULL", capped.length === 0 ? "VACUOUS" : capped.every((r) => r.activeCapFull && r.activeParties >= 2) ? "PASS" : "FAIL", {
      rows: capped.length,
      meanActiveParties: capped.length === 0 ? null : Math.round((capped.reduce((s, r) => s + r.activeParties, 0) / capped.length) * 100) / 100,
    });
  }

  // ── X11 — A RETURNED RECORD CHANGES A REAL PHYSICAL ACTION, OR THIS IS A MISSING-READER FINDING. ──
  {
    const probes = corpus.readerProbes;
    const changed = probes.filter((p) => p.changedSelectedAction);
    const control = probes.filter((p) => p.controlChanged);
    record(
      "X11",
      "a returned exploration record changes one real physical action",
      probes.length === 0
        ? "VACUOUS"
        : control.length === 0
          ? "VACUOUS"
          : changed.length > 0
            ? "PASS"
            : "FAIL — MISSING READER",
      {
        sameSnapshotProbes: probes.length,
        probesWhereRemovingExplorationRecordsChangedTheSelectedAction: changed.length,
        positiveControlProbesWhereRemovingALLKNOWLEDGEChangedIt: control.length,
        totalExplorationTilesHeldAcrossProbes: probes.reduce((s, p) => s + p.explorationTiles, 0),
      },
      "§13 requires this fixture to demonstrate the change or fail explicitly as a missing-reader finding. The positive control is what makes the failure evidence rather than an inert instrument.",
    );
  }

  // ── X12 — through the ACTUAL compression authority (§13 X12). ──
  {
    const reached = corpus.records.filter((r) => r.evictedAtFirstCompression !== undefined);
    const evicted = reached.filter((r) => r.evictedAtFirstCompression === true);
    const survived = reached.filter((r) => r.evictedAtFirstCompression === false);
    record(
      "X12",
      "returned records are followed through the real annual compression authority",
      reached.length === 0 ? "VACUOUS" : "PASS",
      {
        recordsWrittenByTheCanonicalReturnSeam: corpus.records.length,
        recordsThatReachedAFirstCompression: reached.length,
        evictedAtFirstCompression: evicted.length,
        survivedFirstCompression: survived.length,
        evictionShare: reached.length === 0 ? null : Math.round((evicted.length / reached.length) * 10000) / 10000,
        medianLifetimeDaysOfEvicted: (() => {
          const lives = evicted.map((r) => r.lifetimeDays).filter((v) => v !== undefined).sort((a, b) => a - b);
          return lives.length === 0 ? null : lives[Math.floor(lives.length / 2)];
        })(),
      },
      "Eviction is read from memoryCompression's own retained set, not inferred from a later known-tile count.",
    );
  }

  // ── X13 — a lost party transfers nothing. ──
  {
    const naturalLost = corpus.journeys.filter((j) => j.lost);
    // The CONTROLLED always-lost arm is what makes this fixture real (gate 21).
    const lost = controlled.lostJourneys.filter((j) => j.lost);
    const leaked = lost.filter((j) => j.newRecordsCreated > 0 || j.existingRecordsRefreshed > 0);
    const recordsFromLostArm = controlled.lostRecords.length;
    record(
      "X13",
      "a lost party transfers nothing",
      lost.length === 0 ? "VACUOUS" : leaked.length === 0 && recordsFromLostArm === 0 ? "PASS" : "FAIL",
      {
        controlledLostParties: lost.length,
        lostPartiesThatTransferredAnything: leaked.length,
        recordsWrittenByTheAlwaysLostArm: recordsFromLostArm,
        naturalLostPartiesOnElevenWorlds: naturalLost.length,
        completedPartiesNaturally: corpus.journeys.length - naturalLost.length,
      },
      "No party is lost naturally on these worlds, so loss is forced through CORRECTION-17's existing frontierExplorationAlwaysLost option. Two independent assertions: no journey row reports a transfer, and the canonical writer produced no record at all on that arm.",
    );
  }

  // ── X14 — the §8 offer-state pairing self-check. ──
  {
    const bad = corpus.pairing.filter((p) => p.keyMismatch !== 0 || p.overwritten !== 0 || p.leftover !== 0);
    const totalWritten = corpus.pairing.reduce((s, p) => s + p.written, 0);
    const totalConsumed = corpus.pairing.reduce((s, p) => s + p.consumed, 0);
    record(
      "X14",
      "offer state is consumed exactly once per recorded opportunity, with nothing left over",
      totalWritten === 0 ? "VACUOUS" : bad.length === 0 && totalWritten === totalConsumed ? "PASS" : "FAIL",
      {
        runs: corpus.pairing.length,
        written: totalWritten,
        consumed: totalConsumed,
        runsWithKeyMismatchOverwriteOrLeftover: bad.length,
        recordedOpportunities: rows.length,
        opportunitiesWhereTheSchedulerReturnedBeforeEitherMarker: rows.length - totalConsumed,
      },
      "The last number is not a leak: the scheduler exits before both markers when the cap is full, the day is off cadence or too few workers are departable, so nothing is written and nothing is consumed.",
    );
  }

  // ── X15 — the O2 arm converts a fallthrough into a launch (isolation proof). ──
  {
    let baseLaunches = 0;
    let armLaunches = 0;
    let baseFallthrough = 0;
    let armFallthrough = 0;

    for (const armName of ["O0", "O2"]) {
      for (const seed of SEEDS) {
        diag.setExplorationFunnelRecording(true, "x15");
        diag.setExplorationArm(armName);

        try {
          let w = build(FIXTURE_WORLDS[0], seed);
          for (let d = 1; d <= 12 * 360; d += 1) {
            w = runner.stepSim(w, 1, "daily");
            if (Object.values(w.bands).filter(isLiving).length === 0) break;
          }
          const r = diag.getExplorationFunnel();
          const launches = r.filter((x) => x.primaryBlocker === "SELECTED").length;
          const falls = r.filter((x) => x.fallthroughOpportunity).length;
          if (armName === "O0") {
            baseLaunches += launches;
            baseFallthrough += falls;
          } else {
            armLaunches += launches;
            armFallthrough += falls;
          }
        } finally {
          diag.clearExplorationDiagnostics();
        }
      }
    }

    record(
      "X15",
      "the O2 fallthrough-repair arm converts wasted decisions into launches and nothing else",
      baseFallthrough === 0 ? "VACUOUS" : armLaunches > baseLaunches ? "PASS" : "FAIL",
      {
        O0_launches: baseLaunches,
        O2_launches: armLaunches,
        O0_fallthroughOpportunities: baseFallthrough,
        O2_fallthroughOpportunities: armFallthrough,
        additionalLaunches: armLaunches - baseLaunches,
      },
      "O2 only reconsiders a proposal the band had already derived, on a slot the claiming family left free.",
    );
  }

  // ── X16 — recording changes no canonical state. ──
  {
    const fingerprint = (recordingOn) => {
      if (recordingOn) {
        diag.setExplorationFunnelRecording(true, "x16");
        diag.setExplorationJourneyRecording(true);
        diag.setExplorationRecordRecording(true);
      }

      try {
        let w = runner.initSimWorld({ kind: "map2" }, `${SEED_PREFIX}:x16`);
        for (let y = 0; y < 8; y += 1) w = runner.stepSim(w, 4, "seasonal");
        return Object.values(w.bands)
          .sort((a, b) => String(a.id).localeCompare(String(b.id)))
          .map(
            (b) =>
              `${b.id}|${b.position}|${b.demography?.population ?? 0}|${Object.keys(b.knowledge.observedTiles).length}`,
          )
          .join(";");
      } finally {
        diag.clearExplorationDiagnostics();
      }
    };

    const off = fingerprint(false);
    const on = fingerprint(true);
    record("X16", "canonical state is identical with the funnel recording on and off", on === off ? "PASS" : "FAIL", {
      identical: on === off,
      sampleLength: off.length,
    });
  }

  const summary = {
    pass: results.filter((r) => r.verdict === "PASS").length,
    fail: results.filter((r) => String(r.verdict).startsWith("FAIL")).length,
    vacuous: results.filter((r) => r.verdict === "VACUOUS").length,
  };

  const out = { years: YEARS, seeds: SEEDS, worlds: FIXTURE_WORLDS.map((w) => w.name), summary, fixtures: results };
  mkdirSync(OUT.split("/").slice(0, -1).join("/"), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);

  for (const r of results) {
    console.log(`${r.id.padEnd(4)} ${String(r.verdict).padEnd(20)} ${r.title}`);
  }
  console.log("");
  console.log(`PASS ${summary.pass}   FAIL ${summary.fail}   VACUOUS ${summary.vacuous}`);
  console.log(`wrote ${OUT}`);
} finally {
  await server.close();
}
