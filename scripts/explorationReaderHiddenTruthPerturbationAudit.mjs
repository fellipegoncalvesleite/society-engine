// CORRECTION-24C — actual-reader hidden-truth perturbation audit.
//
// A real frontier party first returns a new KnownTileRecord through production.
// The paired arms then retain that exact band-known record while one arm changes
// only the hidden ecological fields of the physical tile. Production advances
// normally; this script observes the actual reader hooks and action ledgers
// without calling any reader itself.
//
// Usage:
//   node scripts/explorationReaderHiddenTruthPerturbationAudit.mjs

import { createHash } from "node:crypto";
import { dirname } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "vite";

/** Reads one `--name value` argument. */
const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined
    ? process.argv[index + 1]
    : fallback;
};

const OUT = arg(
  "out",
  "docs/evidence/correction24c/hidden-truth-perturbation.json",
);
const FOLLOW_DAYS = Number(arg("follow", "180"));

/** Produces a stable digest for concise evidence. */
const digest = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** Returns exact actual-reader output rows for one record identity. */
const readerRows = (causal, recordEventId) =>
  causal.readerEvents
    .filter((row) => row.recordEventId === recordEventId)
    .map((row) => ({
      readerFamily: row.readerFamily,
      productionFunction: row.productionFunction,
      invocationDay: row.invocationDay,
      actualRecordConsulted: row.actualRecordConsulted,
      consultationRole: row.consultationRole,
      readerVerdict: row.readerVerdict,
      readerRanking: row.readerRanking,
      selectedActionId: row.selectedActionId ?? null,
      selectedActionKind: row.selectedActionKind ?? null,
      selectedTarget: row.selectedTarget ?? null,
    }))
    .sort(
      (left, right) =>
        left.invocationDay - right.invocationDay ||
        left.readerFamily.localeCompare(right.readerFamily) ||
        left.productionFunction.localeCompare(right.productionFunction),
    );

/** Returns the exact audit action streams in stable object form. */
const actionStreams = (causal) => ({
  movement: causal.movementActions,
  camp: causal.campActions,
  resource: causal.resourceActions,
  fission: causal.fissionActions,
});

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c24c-hidden-${process.pid}`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const spawn = await server.ssrLoadModule("/sim/agents/spawn.ts");
  const diag = await server.ssrLoadModule(
    "/sim/diagnostics/explorationCausalAudit.ts",
  );

  /** Runs production until the first return carrying at least one new distant tile. */
  const captureReturnedRecord = () => {
    diag.setExplorationCausalAuditRecording(true);
    let world = runner.initSimWorld(
      { kind: "map2" },
      "c24c:hidden-truth",
    );
    world = spawn.removeInitialBands(world, Object.keys(world.bands));
    world = spawn.spawnCustomBands(
      world,
      [
        {
          tileId: "tile:139:41",
          population: 34,
          name: "hidden_truth_fixture",
        },
      ],
      "c24c:hidden-truth",
    );

    try {
      for (let day = 1; day <= 10 * 360; day += 1) {
        world = runner.stepSim(world, 1, "daily");
        const causal = diag.getExplorationCausalAuditSnapshot();
        const newEvents = causal.recordEvents.filter(
          (event) => event.newOrRefreshed === "new",
        );

        if (newEvents.length === 0) {
          continue;
        }

        const event = [...newEvents]
          .map((candidate) => {
            const band = world.bands[candidate.bandId];
            const origin = world.tiles[band?.position];
            const tile = world.tiles[candidate.tileId];
            const distance =
              origin === undefined || tile === undefined
                ? -1
                : Math.abs(origin.coord.x - tile.coord.x) +
                  Math.abs(origin.coord.y - tile.coord.y);
            return { candidate, distance };
          })
          .sort(
            (left, right) =>
              right.distance - left.distance ||
              left.candidate.recordEventId.localeCompare(
                right.candidate.recordEventId,
              ),
          )[0]?.candidate;

        if (event !== undefined) {
          return { world, event };
        }
      }

      return undefined;
    } finally {
      diag.clearExplorationCausalAudit();
    }
  };

  const captured = captureReturnedRecord();

  if (captured === undefined) {
    throw new Error("No returned exploration record was produced");
  }

  const { world: returnedWorld, event } = captured;
  const targetTile = returnedWorld.tiles[event.tileId];
  const knownRecord =
    returnedWorld.bands[event.bandId]?.knowledge?.observedTiles?.[
      event.tileId
    ];

  if (targetTile === undefined || knownRecord === undefined) {
    throw new Error("Returned record target is absent from the captured world");
  }

  const perturbedTile = {
    ...targetTile,
    resourceProfile: {
      ...targetTile.resourceProfile,
      baseRichness:
        targetTile.resourceProfile.baseRichness >= 0.5 ? 0.01 : 0.99,
      waterAccess:
        targetTile.resourceProfile.waterAccess >= 0.5 ? 0.01 : 0.99,
      aquaticPotential:
        targetTile.resourceProfile.aquaticPotential >= 0.5 ? 0.01 : 0.99,
      storageSuitability:
        targetTile.resourceProfile.storageSuitability >= 0.5 ? 0.01 : 0.99,
    },
    seasonalProfile: {
      ...targetTile.seasonalProfile,
      reliability:
        targetTile.seasonalProfile.reliability >= 0.5 ? 0.01 : 0.99,
      peakSeasons: [...targetTile.seasonalProfile.leanSeasons],
      leanSeasons: [...targetTile.seasonalProfile.peakSeasons],
    },
  };
  const perturbedWorld = {
    ...returnedWorld,
    tiles: {
      ...returnedWorld.tiles,
      [event.tileId]: perturbedTile,
    },
  };

  /** Advances one paired arm while observing only real production invocations. */
  const runArm = (startWorld) => {
    const startBand = startWorld.bands[event.bandId];
    const isolatedStartWorld =
      startBand === undefined
        ? startWorld
        : {
            ...startWorld,
            bands: {
              ...startWorld.bands,
              [event.bandId]: {
                ...startBand,
                knowledge: {
                  ...startBand.knowledge,
                  observedTiles: {
                    ...startBand.knowledge.observedTiles,
                  },
                },
              },
            },
          };
    diag.setExplorationCausalAuditRecording(true);
    diag.setRetainEmptyExplorationReaderInvocations(true);
    diag.seedExplorationRecordIdentity({
      recordEventId: event.recordEventId,
      bandId: event.bandId,
      tileId: event.tileId,
      expeditionId: event.expeditionId,
      returnDay: event.returnDay,
    });

    try {
      let world = isolatedStartWorld;

      for (let offset = 1; offset <= FOLLOW_DAYS; offset += 1) {
        world = runner.stepSim(world, 1, "daily");
      }

      const causal = diag.getExplorationCausalAuditSnapshot();
      return {
        readers: readerRows(causal, event.recordEventId),
        actions: actionStreams(causal),
      };
    } finally {
      diag.clearExplorationCausalAudit();
    }
  };

  const control = runArm(returnedWorld);
  const perturbed = runArm(perturbedWorld);
  const knownRecordFingerprint = digest(knownRecord);
  const perturbedKnownRecordFingerprint = digest(
    perturbedWorld.bands[event.bandId]?.knowledge?.observedTiles?.[
      event.tileId
    ],
  );
  const truthFingerprint = digest({
    resourceProfile: targetTile.resourceProfile,
    seasonalProfile: targetTile.seasonalProfile,
  });
  const perturbedTruthFingerprint = digest({
    resourceProfile: perturbedTile.resourceProfile,
    seasonalProfile: perturbedTile.seasonalProfile,
  });
  const result = {
    instrument:
      "ACTUAL PRODUCTION READER HIDDEN-TRUTH PERTURBATION",
    recordEventId: event.recordEventId,
    bandId: event.bandId,
    tileId: event.tileId,
    expeditionId: event.expeditionId,
    returnDay: event.returnDay,
    followedThroughDay: event.returnDay + FOLLOW_DAYS,
    hiddenTruthActuallyChanged:
      truthFingerprint !== perturbedTruthFingerprint,
    bandKnownRecordIdentical:
      knownRecordFingerprint === perturbedKnownRecordFingerprint,
    actualReaderEventsObserved: control.readers.length,
    actualReaderOutputsIdentical:
      JSON.stringify(control.readers) === JSON.stringify(perturbed.readers),
    actionStreamsIdentical:
      JSON.stringify(control.actions) === JSON.stringify(perturbed.actions),
    fingerprints: {
      controlHiddenTruth: truthFingerprint,
      perturbedHiddenTruth: perturbedTruthFingerprint,
      controlKnownRecord: knownRecordFingerprint,
      perturbedKnownRecord: perturbedKnownRecordFingerprint,
    },
    control,
    perturbed,
  };
  result.verdict =
    result.hiddenTruthActuallyChanged &&
    result.bandKnownRecordIdentical &&
    result.actualReaderEventsObserved > 0 &&
    result.actualReaderOutputsIdentical &&
    result.actionStreamsIdentical
      ? "PASS"
      : "FAIL";

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
  console.log(
    `hidden-truth perturbation: ${result.verdict}; ` +
      `actual readers=${result.actualReaderEventsObserved}; wrote ${OUT}`,
  );

  if (result.verdict !== "PASS") {
    process.exitCode = 1;
  }
} finally {
  await server.close();
}
