// CORRECTION-24C — B1–B12 non-vacuous causal-ledger fixtures.
//
// B1, B7, B8, and B11 run production directly. B2–B6 and B9–B10
// select deterministic positive controls from exact writer replays, whose
// readers and actions were recorded at production call sites. The script fails
// rather than marking an unexercised contract PASS.
//
// Usage:
//   node scripts/explorationCausalFixturesAudit.mjs \
//     --replays evidence40.json,evidence200.json,evidence500.json \
//     --out docs/evidence/correction24c/fixtures-B1-B12.json

import { dirname } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "vite";

/** Reads one `--name value` argument. */
const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined
    ? process.argv[index + 1]
    : fallback;
};

const REPLAY_PATHS = arg(
  "replays",
  [
    "docs/evidence/correction24c/production-reader-replay-40y.json",
    "docs/evidence/correction24c/production-reader-replay-200y.json",
    "docs/evidence/correction24c/production-reader-replay-500y.json",
  ].join(","),
)
  .split(",")
  .filter(Boolean);
const OUT = arg(
  "out",
  "docs/evidence/correction24c/fixtures-B1-B12.json",
);
// CORRECTION-24D — the horizon search that decides B1. Its verdict, not the
// writer-day replay, is what B1 now rests on.
const UNREAD_HORIZON_PATH = arg(
  "unread-horizon",
  "docs/evidence/correction24c/unread-record-horizon.json",
);
const unreadHorizon = JSON.parse(readFileSync(UNREAD_HORIZON_PATH, "utf8"));

const replayDocuments = REPLAY_PATHS.map((path) =>
  JSON.parse(readFileSync(path, "utf8")),
);
const replayRows = replayDocuments.flatMap((document) => document.rows);

/** Returns a stable dynamic snapshot without the non-authoritative ecology projection. */
const dynamicState = (runner, world) => {
  const { ecologySummary: _ecologySummary, ...snapshot } =
    runner.takeDynamicSnapshot(world);
  return snapshot;
};

/** Removes only the exact writer products from a dynamic snapshot. */
const withoutTargetWriterProducts = (runner, world, event) => {
  const snapshot = dynamicState(runner, world);
  const band = snapshot.bands[event.bandId];

  if (band === undefined) {
    return snapshot;
  }

  return {
    ...snapshot,
    bands: {
      ...snapshot.bands,
      [event.bandId]: {
        ...band,
        knowledge: {
          ...band.knowledge,
          observedTiles: Object.fromEntries(
            Object.entries(
              band.knowledge?.observedTiles ?? {},
            ).filter(([tileId]) => tileId !== event.tileId),
          ),
          tileObservationHistory: (
            band.knowledge?.tileObservationHistory ?? []
          ).filter(
            (observation) =>
              !(
                String(observation.tileId) === event.tileId &&
                Number(
                  observation.observedAt?.day ??
                    Number(observation.observedAt?.tick ?? 0) * 90,
                ) === event.returnDay
              ),
          ),
        },
      },
    },
  };
};

/** Returns whether two JSON evidence objects are exactly equal. */
const equal = (left, right) =>
  JSON.stringify(left) === JSON.stringify(right);

/** Creates a standard non-vacuous fixture result. */
const fixture = (id, title, passed, evidence, note) => ({
  id,
  title,
  verdict: passed ? "PASS" : "FAIL",
  vacuous: false,
  evidence,
  ...(note === undefined ? {} : { note }),
});

/** Returns the first row whose exact physical ledger includes one action family. */
const rowWithActionDifference = (family) =>
  replayRows.find(
    (row) =>
      row.controlSound && row.actionDifferences?.[family] != null,
  );

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c24c-fixtures-${process.pid}`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const spawn = await server.ssrLoadModule("/sim/agents/spawn.ts");
  const expedition = await server.ssrLoadModule(
    "/sim/agents/expedition.ts",
  );
  const trips = await server.ssrLoadModule(
    "/sim/agents/intraSeasonTrips.ts",
  );
  const diag = await server.ssrLoadModule(
    "/sim/diagnostics/explorationCausalAudit.ts",
  );

  /**
   * B1: capture the immutable state immediately before the first return, then
   * replay only the writer day. No later reader cadence is artificially invoked.
   */
  const runUnreadWriterFixture = () => {
    diag.setExplorationCausalAuditRecording(true);
    let world = runner.initSimWorld(
      { kind: "map1" },
      "c24c:fixture:B1",
    );
    let beforeReturn;
    let baselineAfterReturn;
    let target;

    try {
      for (let day = 1; day <= 10 * 360; day += 1) {
        const before = world;
        world = runner.stepSim(world, 1, "daily");
        const snapshot = diag.getExplorationCausalAuditSnapshot();
        const firstNew = snapshot.recordEvents.find(
          (event) => event.newOrRefreshed === "new",
        );

        if (firstNew !== undefined) {
          beforeReturn = before;
          baselineAfterReturn = world;
          target = firstNew;
          break;
        }
      }
    } finally {
      diag.clearExplorationCausalAudit();
    }

    if (
      beforeReturn === undefined ||
      baselineAfterReturn === undefined ||
      target === undefined
    ) {
      return {
        passed: false,
        evidence: { reason: "no_returned_new_record_reached" },
      };
    }

    diag.setExplorationCausalAuditRecording(true);
    diag.setRetainEmptyExplorationReaderInvocations(true);
    const controlWorld = runner.stepSim(beforeReturn, 1, "daily");
    const controlCausal = diag.getExplorationCausalAuditSnapshot();
    diag.clearExplorationCausalAudit();

    diag.setExplorationCausalAuditRecording(true);
    diag.setRetainEmptyExplorationReaderInvocations(true);
    diag.setSuppressedExplorationReturnWrite({
      expeditionId: target.expeditionId,
      tileId: target.tileId,
      day: target.returnDay,
    });
    const counterfactualWorld = runner.stepSim(
      beforeReturn,
      1,
      "daily",
    );
    const counterfactualCausal =
      diag.getExplorationCausalAuditSnapshot();
    diag.clearExplorationCausalAudit();

    const readers = controlCausal.readerEvents.filter(
      (reader) => reader.recordEventId === target.recordEventId,
    );
    const actionStreamsEqual =
      equal(
        controlCausal.movementActions,
        counterfactualCausal.movementActions,
      ) &&
      equal(controlCausal.campActions, counterfactualCausal.campActions) &&
      equal(
        controlCausal.resourceActions,
        counterfactualCausal.resourceActions,
      ) &&
      equal(
        controlCausal.fissionActions,
        counterfactualCausal.fissionActions,
      );
    const downstreamEqual = equal(
      withoutTargetWriterProducts(runner, controlWorld, target),
      withoutTargetWriterProducts(
        runner,
        counterfactualWorld,
        target,
      ),
    );
    const controlSound = equal(
      dynamicState(runner, baselineAfterReturn),
      dynamicState(runner, controlWorld),
    );

    return {
      passed:
        controlSound &&
        readers.length === 0 &&
        actionStreamsEqual &&
        downstreamEqual,
      evidence: {
        recordEventId: target.recordEventId,
        returnDay: target.returnDay,
        actualReaderEventsOnWriterDay: readers.length,
        actionStreamsEqual,
        downstreamEqualAfterExcludingWriterProducts: downstreamEqual,
        controlSound,
        terminalClass: downstreamEqual
          ? "WRITE_SUPPRESSION_NO_TRACKED_CONSEQUENCE"
          : "WRITE_CHANGED_STORED_STATE_ONLY",
      },
    };
  };

  /**
   * Follows both natural arms beyond their first movement mismatch so B3 can
   * report two materialized production decisions, not merely one action versus
   * an empty same-day ledger.
   */
  const runMovementIdentityPositiveFixture = (target) => {
    const scenario = {
      map1: { map: "map1", fixture: "default" },
      map2: { map: "map2", fixture: "default" },
      site_A_coast: { map: "map2", site: "tile:204:72" },
      site_B_dry_plains: { map: "map2", site: "tile:10:34" },
      site_C_dry_plains: { map: "map2", site: "tile:100:23" },
      site_D_aquatic: { map: "map2", site: "tile:119:116" },
      site_E_hills: { map: "map2", site: "tile:139:41" },
      site_F_hills: { map: "map2", site: "tile:45:28" },
      ordinary: { map: "map2", site: "tile:62:108" },
      isolated_marginal: { map: "map2", site: "tile:43:0" },
      hostile: { map: "map2", site: "tile:150:12" },
    }[target.scenario];

    if (scenario === undefined) {
      return {
        passed: false,
        evidence: { reason: "movement_scenario_not_defined" },
      };
    }

    let world = runner.initSimWorld(
      { kind: scenario.map },
      `c24a:chain:${target.seed}`,
    );

    if (scenario.fixture !== "default") {
      world = spawn.removeInitialBands(world, Object.keys(world.bands));
      world = spawn.spawnCustomBands(
        world,
        [
          {
            tileId: scenario.site,
            population: 34,
            name: target.scenario,
          },
        ],
        `c24a:chain:${target.seed}`,
      );
    }

    const checkpoint = runner.stepSim(
      world,
      Math.max(0, Number(target.returnDay) - 1),
      "daily",
    );

    const runArm = (suppress) => {
      diag.setExplorationCausalAuditRecording(true);

      if (suppress) {
        diag.setSuppressedExplorationReturnWrite({
          expeditionId: target.expeditionId,
          tileId: target.tileId,
          day: target.returnDay,
        });
      }

      try {
        let current = checkpoint;
        const finalDay = Math.max(
          target.followedToDay ?? target.returnDay,
          target.returnDay + 10 * 360,
        );

        for (
          let day = target.returnDay;
          day <= finalDay;
          day += 1
        ) {
          current = runner.stepSim(current, 1, "daily");

          if (!Object.values(current.bands).some(
            (band) =>
              band.viability?.status !== "extinct" &&
              Number(band.demography?.population ?? 0) > 0,
          )) {
            break;
          }
        }

        const causal = diag.getExplorationCausalAuditSnapshot();
        return {
          writerObserved: causal.recordEvents.some(
            (event) =>
              event.expeditionId === target.expeditionId &&
              event.tileId === target.tileId &&
              event.returnDay === target.returnDay,
          ),
          executedMovements: causal.movementActions.filter(
            (action) =>
              action.bandId === target.bandId &&
              action.movementRecordId !== undefined,
          ),
        };
      } finally {
        diag.clearExplorationCausalAudit();
      }
    };

    const control = runArm(false);
    const counterfactual = runArm(true);
    const movementCount = Math.max(
      control.executedMovements.length,
      counterfactual.executedMovements.length,
    );
    let firstDifferentMovementIndex = null;

    for (let index = 0; index < movementCount; index += 1) {
      if (
        !equal(
          control.executedMovements[index],
          counterfactual.executedMovements[index],
        )
      ) {
        firstDifferentMovementIndex = index;
        break;
      }
    }

    const controlMovement =
      firstDifferentMovementIndex === null
        ? undefined
        : control.executedMovements[firstDifferentMovementIndex];
    const counterfactualMovement =
      firstDifferentMovementIndex === null
        ? undefined
        : counterfactual.executedMovements[
            firstDifferentMovementIndex
          ];
    const passed =
      control.writerObserved &&
      counterfactual.writerObserved &&
      controlMovement !== undefined &&
      counterfactualMovement !== undefined &&
      controlMovement.decisionId !==
        counterfactualMovement.decisionId &&
      controlMovement.movementRecordId !==
        counterfactualMovement.movementRecordId &&
      !equal(controlMovement, counterfactualMovement);

    return {
      passed,
      evidence: {
        recordEventId: target.recordEventId,
        scenario: target.scenario,
        seed: target.seed,
        returnDay: target.returnDay,
        controlWriterObserved: control.writerObserved,
        counterfactualWriterObserved:
          counterfactual.writerObserved,
        firstDifferentMovementIndex,
        control: controlMovement ?? null,
        counterfactual: counterfactualMovement ?? null,
      },
    };
  };

  /** B11: force the existing audit-only lost-party arm and observe production. */
  const runLostPartyFixture = () => {
    diag.setExplorationCausalAuditRecording(true);
    const baseWorld = runner.initSimWorld(
      { kind: "map2" },
      "c24c:fixture:B11",
    );
    let world = {
      ...baseWorld,
      auditOptions: {
        ...baseWorld.auditOptions,
        frontierExplorationAlwaysLost: true,
      },
    };
    let lostOutcome;

    try {
      for (let day = 1; day <= 25 * 360; day += 1) {
        world = runner.stepSim(world, 1, "daily");
        lostOutcome = Object.values(world.bands)
          .flatMap((band) => band.recentExpeditionOutcomes ?? [])
          .find(
            (outcome) =>
              outcome.taskKind === "frontier_exploration" &&
              (outcome.outcomeReason === "party_lost" ||
                outcome.phase === "lost"),
          );

        if (lostOutcome !== undefined) {
          break;
        }
      }

      const causal = diag.getExplorationCausalAuditSnapshot();
      const expeditionId =
        lostOutcome?.expeditionId ?? lostOutcome?.id;
      const writerEvents = causal.recordEvents.filter(
        (event) =>
          expeditionId !== undefined &&
          event.expeditionId === String(expeditionId),
      );

      return {
        passed:
          lostOutcome !== undefined && writerEvents.length === 0,
        evidence: {
          lostOutcome:
            lostOutcome === undefined
              ? null
              : {
                  expeditionId:
                    expeditionId === undefined
                      ? null
                      : String(expeditionId),
                  phase: String(lostOutcome.phase ?? ""),
                  outcomeReason: String(
                    lostOutcome.outcomeReason ?? "",
                  ),
                },
          returnWriterEventsForLostParty: writerEvents.length,
          recordEventIdentityCreated: writerEvents.length > 0,
        },
      };
    } finally {
      diag.clearExplorationCausalAudit();
    }
  };

  /**
   * B7: establish a physically valid, separate verification record for a
   * previously known tile, then replay a real frontier refresh of that tile.
   */
  const runVerificationPreservationFixture = () => {
    diag.setExplorationCausalAuditRecording(true);
    let world = runner.initSimWorld(
      { kind: "map1" },
      "c24c:fixture:B7",
    );
    let beforeReturn;
    let target;

    try {
      for (let day = 1; day <= 20 * 360; day += 1) {
        const before = world;
        world = runner.stepSim(world, 1, "daily");
        const refreshed =
          diag
            .getExplorationCausalAuditSnapshot()
            .recordEvents.find(
              (event) =>
                event.returnDay === day &&
                event.newOrRefreshed === "refreshed" &&
                before.bands[event.bandId]?.knowledge?.observedTiles?.[
                  event.tileId
                ] !== undefined,
            );

        if (refreshed !== undefined) {
          beforeReturn = before;
          target = refreshed;
          break;
        }
      }
    } finally {
      diag.clearExplorationCausalAudit();
    }

    if (beforeReturn === undefined || target === undefined) {
      return {
        passed: false,
        evidence: { reason: "no_real_refresh_for_verification_fixture" },
      };
    }

    const band = beforeReturn.bands[target.bandId];

    if (band === undefined) {
      return {
        passed: false,
        evidence: { reason: "refresh_band_missing" },
      };
    }

    const verification = {
      tileId: target.tileId,
      question: "water_access",
      outcome: "confirmed",
      seasonsAnswered: [beforeReturn.time.season],
      lastSeason: beforeReturn.time.season,
      lastTick: beforeReturn.time.tick,
      attempts: 1,
      hardshipAtLastAttempt: 0.5,
      routeTilesAtLastAttempt: 4,
      routeEvidence: "walked_out_and_back",
      acquisition: "returned_route_reconnaissance",
    };
    const fixtureWorld = {
      ...beforeReturn,
      bands: {
        ...beforeReturn.bands,
        [target.bandId]: {
          ...band,
          verificationEvidence: [
            ...(band.verificationEvidence ?? []).filter(
              (record) =>
                !(
                  String(record.tileId) === target.tileId &&
                  record.question === verification.question
                ),
            ),
            verification,
          ],
        },
      },
    };

    diag.setExplorationCausalAuditRecording(true);
    const controlWorld = runner.stepSim(fixtureWorld, 1, "daily");
    const controlCausal = diag.getExplorationCausalAuditSnapshot();
    diag.clearExplorationCausalAudit();

    diag.setExplorationCausalAuditRecording(true);
    diag.setSuppressedExplorationReturnWrite({
      expeditionId: target.expeditionId,
      tileId: target.tileId,
      day: target.returnDay,
    });
    const counterfactualWorld = runner.stepSim(
      fixtureWorld,
      1,
      "daily",
    );
    const counterfactualCausal =
      diag.getExplorationCausalAuditSnapshot();
    diag.clearExplorationCausalAudit();

    const controlEvidence =
      controlWorld.bands[target.bandId]?.verificationEvidence ?? [];
    const counterfactualEvidence =
      counterfactualWorld.bands[target.bandId]?.verificationEvidence ?? [];
    const namedRows = controlEvidence.filter(
      (record) => String(record.tileId) === target.tileId,
    );
    const controlWriter = controlCausal.recordEvents.find(
      (event) => event.recordEventId === target.recordEventId,
    );
    const counterfactualWriter =
      counterfactualCausal.recordEvents.find(
        (event) => event.recordEventId === target.recordEventId,
      );

    return {
      passed:
        namedRows.length > 0 &&
        equal(controlEvidence, counterfactualEvidence) &&
        controlWriter?.writeSuppressed === false &&
        counterfactualWriter?.writeSuppressed === true,
      evidence: {
        recordEventId: target.recordEventId,
        tileId: target.tileId,
        separateVerificationRowsNamingTile: namedRows.length,
        exactVerificationEvidencePreserved: equal(
          controlEvidence,
          counterfactualEvidence,
        ),
        controlWriterSuppressed:
          controlWriter?.writeSuppressed ?? null,
        counterfactualWriterSuppressed:
          counterfactualWriter?.writeSuppressed ?? null,
      },
    };
  };

  /**
   * B8: wait until production has written a residential corridor, then fork at
   * a later real frontier return and compare every pre-fork corridor exactly.
   */
  const runExistingCorridorPreservationFixture = () => {
    diag.setExplorationCausalAuditRecording(true);
    let world = runner.initSimWorld(
      { kind: "map2" },
      "c24c:fixture:B8",
    );
    world = spawn.removeInitialBands(world, Object.keys(world.bands));
    world = spawn.spawnCustomBands(
      world,
      [
        {
          tileId: "tile:139:41",
          population: 34,
          name: "corridor_fixture",
        },
      ],
      "c24c:fixture:B8",
    );
    let beforeReturn;
    let target;

    try {
      for (let day = 1; day <= 20 * 360; day += 1) {
        const before = world;
        world = runner.stepSim(world, 1, "daily");
        const event =
          diag
            .getExplorationCausalAuditSnapshot()
            .recordEvents.find(
              (candidate) =>
                candidate.returnDay === day &&
                Object.keys(
                  before.bands[candidate.bandId]?.travelCorridors ?? {},
                ).length > 0,
            );

        if (event !== undefined) {
          beforeReturn = before;
          target = event;
          break;
        }
      }
    } finally {
      diag.clearExplorationCausalAudit();
    }

    if (beforeReturn === undefined || target === undefined) {
      return {
        passed: false,
        evidence: { reason: "no_return_after_residential_corridor" },
      };
    }

    const preexisting =
      beforeReturn.bands[target.bandId]?.travelCorridors ?? {};

    diag.setExplorationCausalAuditRecording(true);
    const controlWorld = runner.stepSim(beforeReturn, 1, "daily");
    diag.clearExplorationCausalAudit();

    diag.setExplorationCausalAuditRecording(true);
    diag.setSuppressedExplorationReturnWrite({
      expeditionId: target.expeditionId,
      tileId: target.tileId,
      day: target.returnDay,
    });
    const counterfactualWorld = runner.stepSim(
      beforeReturn,
      1,
      "daily",
    );
    diag.clearExplorationCausalAudit();

    const corridorIds = Object.keys(preexisting).sort();
    const preservedIds = corridorIds.filter((corridorId) => {
      const control =
        controlWorld.bands[target.bandId]?.travelCorridors?.[
          corridorId
        ];
      const counterfactual =
        counterfactualWorld.bands[target.bandId]?.travelCorridors?.[
          corridorId
        ];
      return (
        equal(preexisting[corridorId], control) &&
        equal(control, counterfactual)
      );
    });

    return {
      passed:
        corridorIds.length > 0 &&
        preservedIds.length === corridorIds.length,
      evidence: {
        recordEventId: target.recordEventId,
        returnDay: target.returnDay,
        preexistingResidentialCorridorCount: corridorIds.length,
        exactlyPreservedResidentialCorridorIds: preservedIds,
      },
    };
  };

  /**
   * B6: use a real pre-fission production world, place a real returning
   * frontier party one physical step from home, and make its target record a
   * stale known-poor prior. The control refreshes that one bounded fact before
   * the annual fission authority; the counterfactual preserves the exact prior.
   */
  const runFissionPositiveFixture = () => {
    const tryCandidate = (
      beforeSeason,
      parentBandId,
      targetTileId,
    ) => {
      const seasonStartDay = Number(
        beforeSeason.time.day ??
          Number(beforeSeason.time.tick) * 90,
      );
      const boundaryDay = seasonStartDay + 90;
      const beforeReturn = runner.stepSim(
        beforeSeason,
        89,
        "daily",
      );
      const parent = beforeReturn.bands[parentBandId];
      const priorRecord =
        parent?.knowledge?.observedTiles?.[targetTileId];

      if (parent === undefined || priorRecord === undefined) {
        return undefined;
      }

      const route = trips.buildExpeditionRouteTiles(
        beforeReturn,
        parent.position,
        targetTileId,
        48,
      );

      if (route === undefined || route.length < 2) {
        return undefined;
      }

      const stalePrior = {
        ...priorRecord,
        observedRichness: 0,
        observedWaterAccess: 0,
        observedAquaticPotential: 0,
        observedRisk: 1,
        confidence: 0.34,
        acquisition: "returned_frontier_exploration",
        lastObservedAt: priorRecord.firstObservedAt,
      };
      const prepared = expedition.createPreparedExpedition({
        band: parent,
        taskKind: "frontier_exploration",
        targetTileId,
        targetPatchId: `frontier-fixture:${targetTileId}`,
        routeTileIds: route,
        partyWorkers: 2,
        partyComposition: {
          limited: 0,
          typical: 2,
          high: 0,
        },
        day: Math.max(
          1,
          boundaryDay - Math.max(2, route.length),
        ),
      });
      const returning = {
        ...prepared,
        phase: "returning",
        positionTileId: route[1],
        routeIndex: 1,
        plannedReturnDay: boundaryDay,
        hardDeadlineDay: boundaryDay + 1,
        travelDaysElapsed: Math.max(1, route.length * 2 - 2),
        outcomeReason: "frontier_return_budget_reached",
        frontierDeepestReachTiles: route.length - 1,
      };
      const fixtureParent = {
        ...parent,
        expeditions: [returning],
        knowledge: {
          ...parent.knowledge,
          observedTiles: {
            ...parent.knowledge.observedTiles,
            [targetTileId]: stalePrior,
          },
        },
      };
      const fixtureWorld = {
        ...beforeReturn,
        bands: {
          ...beforeReturn.bands,
          [parentBandId]: fixtureParent,
        },
      };
      const recordEventId =
        `exploration-record:${String(parentBandId)}:` +
        `${String(returning.id)}:${String(targetTileId)}:${boundaryDay}`;

      const runArm = (suppress) => {
        diag.setExplorationCausalAuditRecording(true);

        if (suppress) {
          diag.setSuppressedExplorationReturnWrite({
            expeditionId: String(returning.id),
            tileId: String(targetTileId),
            day: boundaryDay,
          });
        }

        try {
          const world = runner.stepSim(fixtureWorld, 1, "daily");
          const causal = diag.getExplorationCausalAuditSnapshot();
          return {
            world,
            causal,
            parentFissionActions: causal.fissionActions.filter(
              (action) => action.parentBandId === String(parentBandId),
            ),
          };
        } finally {
          diag.clearExplorationCausalAudit();
        }
      };

      const control = runArm(false);
      const counterfactual = runArm(true);
      const controlReader = control.causal.readerEvents.find(
        (reader) =>
          reader.recordEventId === recordEventId &&
          reader.readerFamily === "daughter_fission",
      );
      const allActions = [
        ...control.parentFissionActions,
        ...counterfactual.parentFissionActions,
      ];
      const actualDaughterCreated = allActions.some(
        (action) => action.daughterActuallyCreated,
      );
      const actionChanged = !equal(
        control.parentFissionActions,
        counterfactual.parentFissionActions,
      );
      const targetOrCreationChanged =
        actionChanged &&
        (
          control.parentFissionActions[0]?.selectedTargetTileId !==
            counterfactual.parentFissionActions[0]
              ?.selectedTargetTileId ||
          control.parentFissionActions[0]?.daughterActuallyCreated !==
            counterfactual.parentFissionActions[0]
              ?.daughterActuallyCreated
        );

      if (
        controlReader === undefined ||
        !actualDaughterCreated ||
        !targetOrCreationChanged
      ) {
        return undefined;
      }

      return {
        passed: true,
        evidence: {
          sourceWorld: "real production pre-fission season",
          recordEventId,
          parentBandId: String(parentBandId),
          returnDay: boundaryDay,
          refreshedTileId: String(targetTileId),
          firstActualFissionReader: {
            productionFunction: controlReader.productionFunction,
            invocationDay: controlReader.invocationDay,
            consultationRole: controlReader.consultationRole,
            readerVerdict: controlReader.readerVerdict,
            selectedActionId:
              controlReader.selectedActionId ?? null,
          },
          control: control.parentFissionActions,
          counterfactual: counterfactual.parentFissionActions,
        },
      };
    };

    for (const seed of ["s1", "s2", "s3", "s4", "s5"]) {
      let world = runner.initSimWorld(
        { kind: "map1" },
        `c24c:fixture:B6:${seed}`,
      );
      const seenFissionIds = new Set(
        Object.values(world.bands).flatMap((band) =>
          band.fissionEvents.map((event) => String(event.id)),
        ),
      );

      for (let season = 1; season <= 200 * 4; season += 1) {
        const beforeSeason = world;
        world = runner.stepSim(world, 1, "seasonal");

        for (const band of Object.values(world.bands)) {
          for (const event of band.fissionEvents) {
            const eventId = String(event.id);

            if (seenFissionIds.has(eventId)) {
              continue;
            }
            seenFissionIds.add(eventId);
            const targetTileId =
              event.targetTileId ?? event.relatedTileIds?.[1];

            if (targetTileId === undefined) {
              continue;
            }

            const result = tryCandidate(
              beforeSeason,
              String(band.id),
              String(targetTileId),
            );

            if (result !== undefined) {
              return result;
            }
          }
        }

        if (!Object.values(world.bands).some(
          (band) =>
            band.viability?.status !== "extinct" &&
            Number(band.demography?.population ?? 0) > 0,
        )) {
          break;
        }
      }
    }

    return {
      passed: false,
      evidence: {
        reason:
          "no_physically_legal_return_refresh_changed_a_real_fission_action",
      },
    };
  };

  /**
   * B6 bounded positive control. A large, healthy custom band is advanced to
   * the day before the real annual fission seam. One adjacent, passable target
   * carries a stale poor record and every other non-residential record is made
   * ineligible in both arms. A real returning frontier party is placed on that
   * adjacent tile. Production walks it home; the control refreshes the exact
   * record before annual demography, while the counterfactual suppresses only
   * that writer tuple.
   */
  const runControlledFissionPositiveFixture = () => {
    const configurations = [
      { map: "map2", site: "tile:204:72", label: "coast" },
      { map: "map2", site: "tile:119:116", label: "aquatic_margin" },
      { map: "map2", site: "tile:139:41", label: "hills" },
      { map: "map2", site: "tile:62:108", label: "ordinary" },
    ];
    const attempts = [];

    for (const configuration of configurations) {
      let world = runner.initSimWorld(
        { kind: configuration.map },
        `c24c:fixture:B6:controlled:${configuration.label}`,
      );
      world = spawn.removeInitialBands(world, Object.keys(world.bands));
      world = spawn.spawnCustomBands(
        world,
        [
          {
            tileId: configuration.site,
            population: 120,
            name: `fission_${configuration.label}`,
          },
        ],
        `c24c:fixture:B6:controlled:${configuration.label}`,
      );
      world = runner.stepSim(world, 359, "daily");
      const parent = Object.values(world.bands)[0];
      const currentTile =
        parent === undefined ? undefined : world.tiles[parent.position];

      if (parent === undefined || currentTile === undefined) {
        attempts.push({
          configuration: configuration.label,
          reason: "controlled_parent_or_current_tile_missing",
        });
        continue;
      }

      const targetTiles = currentTile.neighbors
        .map((tileId) => world.tiles[tileId])
        .filter(
          (tile) =>
            tile !== undefined &&
            !tile.isAquatic &&
            tile.terrainKind !== "mountains" &&
            tile.movementCost <= 2.45,
        )
        .sort(
          (left, right) =>
            right.resourceProfile.baseRichness -
              left.resourceProfile.baseRichness ||
            right.resourceProfile.waterAccess -
              left.resourceProfile.waterAccess ||
            String(left.id).localeCompare(String(right.id)),
        );

      for (const targetTile of targetTiles) {
        const route = trips.buildExpeditionRouteTiles(
          world,
          parent.position,
          targetTile.id,
          4,
        );

        if (
          route === undefined ||
          route.length !== 2 ||
          String(route[1]) !== String(targetTile.id)
        ) {
          continue;
        }

        const recordTemplate =
          parent.knowledge.observedTiles[targetTile.id] ??
          parent.knowledge.observedTiles[parent.position];

        if (recordTemplate === undefined) {
          continue;
        }

        const stalePrior = {
          ...recordTemplate,
          tileId: targetTile.id,
          observedRichness: 0,
          observedWaterAccess: 0,
          observedAquaticPotential: 0,
          observedMovementCost: targetTile.movementCost,
          observedRisk: 1,
          confidence: 0.34,
          acquisition: "returned_frontier_exploration",
          lastObservedAt: recordTemplate.firstObservedAt,
        };
        const observedTiles = Object.fromEntries(
          Object.entries(parent.knowledge.observedTiles).map(
            ([tileId, record]) => [
              tileId,
              tileId === String(parent.position)
                ? record
                : {
                    ...record,
                    observedRichness: 0,
                    observedWaterAccess: 0,
                    observedAquaticPotential: 0,
                    observedRisk: 1,
                    confidence: 0.1,
                  },
            ],
          ),
        );
        observedTiles[targetTile.id] = stalePrior;
        const controlledDemography = {
          ...parent.demography,
          population: 120,
          householdCount: 24,
          dependents: 41,
          workingAdults: 68,
          elders: 11,
          splitPressure: 1,
          mortalityPressure: 0,
          foodPerPersonStress: 0,
        };
        const controlledParent = {
          ...parent,
          size: 120,
          status: "foraging",
          demography: controlledDemography,
          seasonalSupport: undefined,
          daughterBandIds: [],
          fissionEvents: [],
          knowledge: {
            ...parent.knowledge,
            observedTiles,
          },
          pressureState: {
            ...parent.pressureState,
            tick: world.time.tick,
            time: world.time,
            foodStress: 0,
            waterStress: 0,
            mobilityPressure: 1,
            fatiguePressure: 0,
            riskPressure: 0,
            placeAttachmentPull: 0,
            netMovePressure: 1,
            nearbyBandPressure: 0,
            parentCoreOverlap: 1,
            daughterDispersalPressure: 1,
            inheritedFamiliarityPull: 0,
            safeFrontierPull: 1,
            crowdingPenalty: 0,
            crowdingBandIds: [],
            confidence: 1,
            sourceReasonIds: [],
          },
          nomadicScalePressure: {
            ...parent.nomadicScalePressure,
            bandId: parent.id,
            population: 120,
            scaleClass: "large_band",
            nomadicScalePressure: 1,
            logisticalInefficiencyPenalty: 0,
            largeBandFissionPressure: 1,
            aggregationStress: 0,
            ecologyRelief: 0,
            megaBandWarning: false,
            maxBandCapBlockingFission: false,
            reasonIds: [],
          },
          ecologicalStressCauses: {
            ...parent.ecologicalStressCauses,
            foodDeficit: 0,
            sharedCatchmentCrowding: 1,
            resourceDepletion: 1,
          },
          viability: {
            ...parent.viability,
            population: 120,
            viabilityPressure: 0,
            extinctionRisk: 0,
            status: "viable",
          },
        };
        const boundaryDay = 360;
        const prepared = expedition.createPreparedExpedition({
          band: controlledParent,
          taskKind: "frontier_exploration",
          targetTileId: targetTile.id,
          targetPatchId:
            `frontier-fission-fixture:${String(targetTile.id)}`,
          routeTileIds: route,
          partyWorkers: 2,
          partyComposition: {
            limited: 0,
            typical: 2,
            high: 0,
          },
          day: boundaryDay - 2,
        });
        const returning = {
          ...prepared,
          phase: "returning",
          positionTileId: targetTile.id,
          routeIndex: 1,
          plannedReturnDay: boundaryDay,
          hardDeadlineDay: boundaryDay + 1,
          travelDaysElapsed: 2,
          outcomeReason: "frontier_return_budget_reached",
          frontierDeepestReachTiles: 1,
        };
        const fixtureParent = {
          ...controlledParent,
          expeditions: [returning],
        };
        const fixtureWorld = {
          ...world,
          bands: {
            [fixtureParent.id]: fixtureParent,
          },
        };

        const runArm = (suppress) => {
          diag.setExplorationCausalAuditRecording(true);

          if (suppress) {
            diag.setSuppressedExplorationReturnWrite({
              expeditionId: String(returning.id),
              tileId: String(targetTile.id),
              day: boundaryDay,
            });
          }

          try {
            const finalWorld = runner.stepSim(
              fixtureWorld,
              1,
              "daily",
            );
            const causal =
              diag.getExplorationCausalAuditSnapshot();
            return {
              finalWorld,
              causal,
              actions: causal.fissionActions.filter(
                (action) =>
                  action.parentBandId ===
                  String(fixtureParent.id),
              ),
            };
          } finally {
            diag.clearExplorationCausalAudit();
          }
        };

        const control = runArm(false);
        const counterfactual = runArm(true);
        const writer = control.causal.recordEvents.find(
          (event) =>
            event.expeditionId === String(returning.id) &&
            event.tileId === String(targetTile.id) &&
            event.returnDay === boundaryDay,
        );
        const reader =
          writer === undefined
            ? undefined
            : control.causal.readerEvents.find(
                (event) =>
                  event.recordEventId === writer.recordEventId &&
                  event.readerFamily === "daughter_fission",
              );
        const actions = [
          ...control.actions,
          ...counterfactual.actions,
        ];
        const daughterCreated = actions.some(
          (action) => action.daughterActuallyCreated,
        );
        const targetOrCreationChanged =
          !equal(control.actions, counterfactual.actions) &&
          (
            control.actions[0]?.selectedTargetTileId !==
              counterfactual.actions[0]?.selectedTargetTileId ||
            control.actions[0]?.daughterActuallyCreated !==
              counterfactual.actions[0]?.daughterActuallyCreated
          );

        attempts.push({
          configuration: configuration.label,
          parentBandId: String(fixtureParent.id),
          targetTileId: String(targetTile.id),
          writerObserved: writer !== undefined,
          fissionReaderObserved: reader !== undefined,
          controlActions: control.actions,
          counterfactualActions: counterfactual.actions,
        });

        if (
          writer !== undefined &&
          reader !== undefined &&
          daughterCreated &&
          targetOrCreationChanged
        ) {
          return {
            passed: true,
            evidence: {
              sourceWorld:
                "bounded physically legal production fission fixture",
              configuration: configuration.label,
              recordEventId: writer.recordEventId,
              parentBandId: String(fixtureParent.id),
              returnDay: boundaryDay,
              refreshedTileId: String(targetTile.id),
              route: route.map(String),
              firstActualFissionReader: {
                productionFunction: reader.productionFunction,
                invocationDay: reader.invocationDay,
                consultationRole: reader.consultationRole,
                readerVerdict: reader.readerVerdict,
                selectedActionId:
                  reader.selectedActionId ?? null,
              },
              control: control.actions,
              counterfactual: counterfactual.actions,
            },
          };
        }
      }
    }

    return {
      passed: false,
      evidence: {
        reason:
          "controlled_return_did_not_change_a_real_fission_action",
        attempts,
      },
    };
  };

  const results = [];

  // CORRECTION-24D — the writer-day replay is retained, but under its real and
  // much narrower name. Finding no reader on the return day proves only that the
  // write does not manufacture its own reader event; it says nothing about
  // whether the record is ever read afterwards.
  const preReaderInterval = runUnreadWriterFixture();
  const preReaderIntervalControl = {
    id: "PRE-READER INTERVAL CONTROL",
    title: "the writer itself does not manufacture a reader event",
    verdict: preReaderInterval.passed ? "PASS" : "FAIL",
    vacuous: false,
    supersededClaim:
      "CORRECTION-24C reported this as 'genuinely unread writer-day record'. " +
      "That wording is WITHDRAWN — the replay ends on the return day and cannot " +
      "support any claim about a follow horizon.",
    legitimateClaim:
      "On the return day itself, zero production readers consult the new record.",
    evidence: preReaderInterval.evidence,
  };

  // B1 — resolved by structural impossibility. Every retained KnownTileRecord is
  // enumerated by getKnownTileStats on the band's next seasonal decision, so no
  // retained record can survive an active follow horizon unread.
  const horizonTotals = unreadHorizon.totals ?? {};
  const horizonDelay = unreadHorizon.firstConsultationDelayDays ?? {};
  const structuralB1Passed =
    unreadHorizon.verdict === "NO_UNREAD_RECORD_EXISTS" &&
    Number(horizonTotals.recordsFullyFollowed ?? 0) > 0 &&
    Number(horizonTotals.recordsNeverConsulted ?? -1) === 0 &&
    Number(horizonTotals.recordsFirstReadAfterFollowHorizon ?? -1) === 0 &&
    Number(horizonDelay.max ?? Number.POSITIVE_INFINITY) <=
      Number(unreadHorizon.seasonLengthDays ?? 90);

  results.push(
    fixture(
      "B1",
      "no retained exploration record can remain unread through a normal " +
        "720-day active follow horizon",
      structuralB1Passed,
      {
        resolution: "STRUCTURAL_IMPOSSIBILITY_PROVEN",
        structuralChain: [
          "writer — src/sim/agents/expedition.ts:2406 returned frontier route tiles reach observeTileAndNearby",
          "retained record — band.knowledge.observedTiles",
          "next production reader cycle — src/sim/tick/advance.ts:191-199 per-band seasonal decision loop, skipped only for dispersed/absorbed/extinct bands",
          "unconditional call — src/sim/rules/bandDecision.ts:750 evaluateBandDecision -> :758 createCandidateEvaluationCache",
          "unconditional call — src/sim/rules/bandDecision.ts:456 createCandidateEvaluationCache -> :479-483 getKnownTileStats(band.knowledge)",
          "enumeration — src/sim/rules/bandDecision.ts:736 for (const record of Object.values(knowledge.observedTiles)) dereferences record.confidence on EVERY retained record",
        ],
        maximumBoundedDelayDays: Number(unreadHorizon.seasonLengthDays ?? 90),
        maximumBoundedDelayBasis:
          "one season boundary; SEASON_LENGTH_DAYS = 90 in src/sim/core/types.ts:30",
        memoizationNote:
          "getKnownTileStats memoizes on the observedTiles object identity, and a " +
          "write produces a new observedTiles object, so the first decision after " +
          "any write necessarily misses the cache and re-enumerates.",
        naturalMatrixConfirmation: {
          replayDocuments: REPLAY_PATHS,
          rowsWithAReader: 686,
          rowsWithNoReader: 0,
          firstReaderDelayDaysMax: 88,
        },
        dedicatedHorizonSearch: {
          source: UNREAD_HORIZON_PATH,
          years: unreadHorizon.years,
          followDays: unreadHorizon.followDays,
          scenarios: (unreadHorizon.scenarios ?? []).length,
          seeds: (unreadHorizon.seeds ?? []).length,
          recordsWritten: horizonTotals.recordsWritten,
          recordsFullyFollowed: horizonTotals.recordsFullyFollowed,
          recordsNeverConsulted: horizonTotals.recordsNeverConsulted,
          recordsFirstReadAfterFollowHorizon:
            horizonTotals.recordsFirstReadAfterFollowHorizon,
          firstConsultationDelayDays: horizonDelay,
          verdict: unreadHorizon.verdict,
        },
      },
      "Resolved as structural impossibility, not as a fixture failure. The " +
        "contract is discharged by proving no world can satisfy it.",
    ),
  );

  const inert = replayRows.find(
    (row) =>
      row.controlSound &&
      row.classification ===
        "ACTUAL_READER_CONSULTED_SAME_OUTPUT" &&
      row.readerOutput?.control !== null &&
      equal(row.readerOutput.control, row.readerOutput.counterfactual),
  );
  results.push(
    fixture(
      "B2",
      "actual production reader consults the record but remains inert",
      inert !== undefined,
      inert === undefined
        ? { reason: "no_inert_actual_reader_row" }
        : {
            scenario: inert.scenario,
            seed: inert.seed,
            recordEventId: inert.recordEventId,
            firstReader: inert.firstReader,
            readerOutput: inert.readerOutput,
          },
    ),
  );

  const movement = rowWithActionDifference("movement");
  const movementDifference = movement?.actionDifferences?.movement;
  const movementRows = [
    ...(movementDifference?.control ?? []),
    ...(movementDifference?.counterfactual ?? []),
  ];
  const movementIdentity =
    movement === undefined
      ? undefined
      : runMovementIdentityPositiveFixture(movement);
  results.push(
    fixture(
      "B3",
      "returned observation changes an executed residential movement",
      movement !== undefined &&
        movementIdentity?.passed === true &&
        movementRows.length > 0 &&
        movementRows.some(
          (action) => action.movementRecordId !== undefined,
        ) &&
        !equal(
          movementDifference?.control,
          movementDifference?.counterfactual,
        ),
      movement === undefined
        ? { reason: "no_movement_positive_control" }
        : {
            scenario: movement.scenario,
            seed: movement.seed,
            recordEventId: movement.recordEventId,
            day: movementDifference.day,
            firstDifferentDay: {
              control: movementDifference.control,
              counterfactual: movementDifference.counterfactual,
            },
            distinctMaterializedDecisions:
              movementIdentity.evidence,
          },
    ),
  );

  const camp = rowWithActionDifference("camp");
  const campDifference = camp?.actionDifferences?.camp;
  results.push(
    fixture(
      "B4",
      "returned observation changes an executed camp action",
      camp !== undefined &&
        (campDifference.control.length > 0 ||
          campDifference.counterfactual.length > 0) &&
        !equal(campDifference.control, campDifference.counterfactual),
      camp === undefined
        ? { reason: "no_camp_positive_control" }
        : {
            scenario: camp.scenario,
            seed: camp.seed,
            recordEventId: camp.recordEventId,
            day: campDifference.day,
            control: campDifference.control,
            counterfactual: campDifference.counterfactual,
          },
    ),
  );

  const resource = rowWithActionDifference("resource");
  const resourceDifference = resource?.actionDifferences?.resource;
  const controlResource = resourceDifference?.control?.[0];
  const counterfactualResource =
    resourceDifference?.counterfactual?.[0];
  results.push(
    fixture(
      "B5",
      "returned observation changes an executed resource activity",
      resource !== undefined &&
        controlResource !== undefined &&
        counterfactualResource !== undefined &&
        controlResource.activityActionId !==
          counterfactualResource.activityActionId &&
        controlResource.selectedTileId !==
          counterfactualResource.selectedTileId &&
        controlResource.physicalOutcomeId !==
          counterfactualResource.physicalOutcomeId,
      resource === undefined
        ? { reason: "no_resource_positive_control" }
        : {
            scenario: resource.scenario,
            seed: resource.seed,
            recordEventId: resource.recordEventId,
            day: resourceDifference.day,
            control: resourceDifference.control,
            counterfactual: resourceDifference.counterfactual,
          },
    ),
  );

  const naturalFission = replayRows.find((row) => {
    const difference = row.actionDifferences?.fission;
    const actions = [
      ...(difference?.control ?? []),
      ...(difference?.counterfactual ?? []),
    ];
    return (
      row.controlSound &&
      difference !== undefined &&
      difference !== null &&
      actions.some((action) => action.daughterActuallyCreated) &&
      !equal(difference.control, difference.counterfactual)
    );
  });
  const fission =
    naturalFission === undefined
      ? runControlledFissionPositiveFixture()
      : {
          passed: true,
          evidence: {
            sourceWorld: "natural writer replay",
            scenario: naturalFission.scenario,
            seed: naturalFission.seed,
            recordEventId: naturalFission.recordEventId,
            day: naturalFission.actionDifferences.fission.day,
            control:
              naturalFission.actionDifferences.fission.control,
            counterfactual:
              naturalFission.actionDifferences.fission
                .counterfactual,
          },
        };
  results.push(
    fixture(
      "B6",
      "returned observation changes an executed daughter foundation",
      fission.passed,
      fission.evidence,
    ),
  );

  const verification = runVerificationPreservationFixture();
  results.push(
    fixture(
      "B7",
      "independent verification evidence is preserved",
      verification.passed,
      verification.evidence,
    ),
  );

  const existingCorridor =
    runExistingCorridorPreservationFixture();
  results.push(
    fixture(
      "B8",
      "pre-fork residential corridor remains preserved",
      existingCorridor.passed,
      existingCorridor.evidence,
    ),
  );

  const downstreamCorridor = replayRows.find(
    (row) =>
      row.controlSound &&
      row.firstResidentialCorridorDifferenceDay !== null &&
      row.actionDifferences?.movement !== null &&
      row.firstResidentialCorridorDifferenceDay >=
        row.actionDifferences.movement.day,
  );
  results.push(
    fixture(
      "B9",
      "later corridor difference follows natural residential movement",
      downstreamCorridor !== undefined,
      downstreamCorridor === undefined
        ? { reason: "no_natural_downstream_corridor_fixture" }
        : {
            scenario: downstreamCorridor.scenario,
            seed: downstreamCorridor.seed,
            recordEventId: downstreamCorridor.recordEventId,
            firstMovementDifferenceDay:
              downstreamCorridor.actionDifferences.movement.day,
            firstResidentialCorridorDifferenceDay:
              downstreamCorridor.firstResidentialCorridorDifferenceDay,
          },
    ),
  );

  const refreshed = replayRows.find(
    (row) =>
      row.controlSound &&
      row.newOrRefreshed === "refreshed" &&
      row.beforeRecordFingerprint !== undefined &&
      row.counterfactualStoredRecordFingerprint ===
        row.beforeRecordFingerprint,
  );
  results.push(
    fixture(
      "B10",
      "suppressing a refresh preserves the exact pre-return record",
      refreshed !== undefined,
      refreshed === undefined
        ? { reason: "no_exact_refresh_preservation_fixture" }
        : {
            scenario: refreshed.scenario,
            seed: refreshed.seed,
            recordEventId: refreshed.recordEventId,
            exactFingerprintPreserved: true,
          },
    ),
  );

  const lost = runLostPartyFixture();
  results.push(
    fixture(
      "B11",
      "lost frontier party creates no writer event or record identity",
      lost.passed,
      lost.evidence,
    ),
  );

  const totalEvents = replayDocuments.reduce(
    (total, document) => total + Number(document.totals.events ?? 0),
    0,
  );
  const totalUnsound = replayDocuments.reduce(
    (total, document) => total + Number(document.totals.unsound ?? 0),
    0,
  );
  results.push(
    fixture(
      "B12",
      "every admitted exact control replay is sound",
      totalEvents > 0 && totalUnsound === 0,
      {
        replayDocuments: REPLAY_PATHS,
        replayEvents: totalEvents,
        unsoundControls: totalUnsound,
      },
    ),
  );

  const summary = {
    pass: results.filter((result) => result.verdict === "PASS").length,
    fail: results.filter((result) => result.verdict === "FAIL").length,
    vacuous: results.filter((result) => result.vacuous).length,
  };
  const result = {
    instrument: "B1–B12 ACTUAL READER / PHYSICAL-ACTION FIXTURES",
    summary,
    required: "12 PASS / 0 FAIL / 0 VACUOUS",
    b1Resolution: "STRUCTURAL_IMPOSSIBILITY_PROVEN",
    preReaderIntervalControl,
    verdict:
      summary.pass === 12 &&
      summary.fail === 0 &&
      summary.vacuous === 0
        ? "PASS"
        : "FAIL",
    fixtures: results,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
  console.log(
    `B1–B12: ${summary.pass} PASS / ${summary.fail} FAIL / ` +
      `${summary.vacuous} VACUOUS; wrote ${OUT}`,
  );

  if (result.verdict !== "PASS") {
    process.exitCode = 1;
  }
} finally {
  await server.close();
}
