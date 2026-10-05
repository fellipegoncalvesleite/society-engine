// CORRECTION-24C — exact O0/O3 frontier-party physical-stream parity through first return.
//
// The source root may point at the detached 9e317647 worktree where O3 still
// exists. Every row is observed while production advances the party; the audit
// never invokes the expedition authority on its own.
//
// Usage:
//   node scripts/explorationO3PhysicalParityAudit.mjs \
//     --source-root /absolute/path/to/9e317647/worktree/src \
//     --out docs/evidence/correction24c/o3-physical-stream-parity.json

import { dirname, resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "vite";

/** Reads one `--name value` argument. */
const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined
    ? process.argv[index + 1]
    : fallback;
};

const SOURCE_ROOT = resolve(arg("source-root", `${process.cwd()}/src`));
const OUT = arg(
  "out",
  "docs/evidence/correction24c/o3-physical-stream-parity.json",
);
const SEEDS = arg("seeds", "s1,s2,s3,s4,s5").split(",").filter(Boolean);
const SEED_PREFIX = arg("seed-prefix", "c24a:chain");
const MAX_DAYS = Number(arg("max-days", String(25 * 360)));

const SCENARIOS = [
  { name: "map1", map: "map1", fixture: "default" },
  { name: "map2", map: "map2", fixture: "default" },
  { name: "site_A_coast", map: "map2", site: "tile:204:72" },
  { name: "site_B_dry_plains", map: "map2", site: "tile:10:34" },
  { name: "site_C_dry_plains", map: "map2", site: "tile:100:23" },
  { name: "site_D_aquatic", map: "map2", site: "tile:119:116" },
  { name: "site_E_hills", map: "map2", site: "tile:139:41" },
  { name: "site_F_hills", map: "map2", site: "tile:45:28" },
  { name: "ordinary", map: "map2", site: "tile:62:108" },
  { name: "isolated_marginal", map: "map2", site: "tile:43:0" },
  { name: "hostile", map: "map2", site: "tile:150:12" },
];

/** Returns whether a band remains a living production actor. */
const isLiving = (band) =>
  band.viability?.status !== "extinct" &&
  band.viability?.status !== "absorbed" &&
  band.viability?.status !== "dispersed" &&
  Number(band.demography?.population ?? 0) > 0;

/** Returns the selected frontier expedition, if still retained by its band. */
const findExpedition = (world, expeditionId) => {
  for (const band of Object.values(world.bands)) {
    const expedition = (band.expeditions ?? []).find(
      (candidate) => String(candidate.id) === expeditionId,
    );

    if (expedition !== undefined) {
      return expedition;
    }
  }

  return undefined;
};

/** Returns the earliest frontier expedition currently present. */
const findFirstFrontierExpedition = (world) =>
  Object.values(world.bands)
    .flatMap((band) => band.expeditions ?? [])
    .filter((expedition) => expedition.taskKind === "frontier_exploration")
    .sort(
      (left, right) =>
        Number(left.departedDay) - Number(right.departedDay) ||
        String(left.id).localeCompare(String(right.id)),
    )[0];

/** Captures the exact physical fields that exist after one production day. */
const captureDailyExpedition = (day, expedition) => ({
  day,
  phase: String(expedition.phase),
  positionTileId: String(expedition.positionTileId),
  routeIndex: Number(expedition.routeIndex),
  routeTileIds: [...(expedition.routeTileIds ?? [])].map(String),
  riskEpisodeIds: [...(expedition.riskEpisodeIds ?? [])].map(String),
  provisionsConsumed: Number(
    expedition.cargo?.provisionUnitsConsumed ?? 0,
  ),
  outcomeReason:
    expedition.outcomeReason === undefined
      ? null
      : String(expedition.outcomeReason),
});

/**
 * Expands daily cumulative route states into the exact ordered tiles physically
 * traversed that day. Outbound days append to the breadcrumb trail; returning
 * days walk the same trail in reverse.
 */
const expandDailyPhysicalStream = (dailyRows, terminal) => {
  const finalRoute = [...terminal.routeTileIds].map(String);
  const rows = [...dailyRows];

  if (
    terminal.returnDay !== null &&
    !rows.some((row) => row.day === terminal.returnDay)
  ) {
    rows.push({
      day: terminal.returnDay,
      phase: terminal.lost ? "lost" : "completed",
      positionTileId: terminal.terminalPositionTileId,
      routeIndex: Math.max(
        0,
        finalRoute.lastIndexOf(terminal.terminalPositionTileId),
      ),
      routeTileIds: finalRoute,
      riskEpisodeIds: terminal.riskEpisodeIds,
      provisionsConsumed: terminal.provisionsConsumed,
      outcomeReason: terminal.terminalOutcome,
    });
  }

  rows.sort((left, right) => left.day - right.day);
  let priorRoute = [finalRoute[0]].filter(Boolean);
  let priorIndex = 0;
  let priorRiskIds = [];
  let priorProvisions = 0;

  return rows.map((row) => {
    const currentRoute = row.routeTileIds;
    const currentIndex = row.routeIndex;
    let traversedTileIds = [];

    if (currentRoute.length > priorRoute.length) {
      traversedTileIds = currentRoute.slice(priorRoute.length);
    } else if (currentIndex < priorIndex) {
      for (let index = priorIndex - 1; index >= currentIndex; index -= 1) {
        const tileId = finalRoute[index];
        if (tileId !== undefined) traversedTileIds.push(tileId);
      }
    } else if (currentIndex > priorIndex) {
      traversedTileIds = finalRoute.slice(priorIndex + 1, currentIndex + 1);
    }

    const riskEpisodeIdsAdded = row.riskEpisodeIds.filter(
      (id) => !priorRiskIds.includes(id),
    );
    const provisionUnitsConsumedToday =
      row.provisionsConsumed - priorProvisions;
    priorRoute = currentRoute;
    priorIndex = currentIndex;
    priorRiskIds = row.riskEpisodeIds;
    priorProvisions = row.provisionsConsumed;

    return {
      day: row.day,
      phaseAfterDay: row.phase,
      positionAfterDay: row.positionTileId,
      traversedTileIds,
      physicalStepCount: traversedTileIds.length,
      riskEpisodeIdsAdded,
      riskEpisodeIdsCumulative: row.riskEpisodeIds,
      provisionUnitsConsumedToday,
      provisionUnitsConsumedCumulative: row.provisionsConsumed,
      forcedReturnActive:
        row.phase === "returning" ||
        row.outcomeReason === "frontier_barrier_blocked" ||
        row.outcomeReason === "provisions_ran_out" ||
        row.outcomeReason === "injury_forced_return",
      outcomeReason: row.outcomeReason,
    };
  });
};

const server = await createServer({
  root: SOURCE_ROOT,
  cacheDir: `node_modules/.vite-c24c-o3-${process.pid}`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const spawn = await server.ssrLoadModule("/sim/agents/spawn.ts");
  const diag = await server.ssrLoadModule(
    "/sim/diagnostics/explorationFunnelDiagnostics.ts",
  );

  /** Builds the exact production fixture for one scenario/seed/arm. */
  const buildWorld = (scenario, seed, arm) => {
    let world = runner.initSimWorld(
      { kind: scenario.map },
      `${SEED_PREFIX}:${seed}`,
    );

    if (scenario.fixture !== "default") {
      world = spawn.removeInitialBands(world, Object.keys(world.bands));
      world = spawn.spawnCustomBands(
        world,
        [{ tileId: scenario.site, population: 34, name: scenario.name }],
        `${SEED_PREFIX}:${seed}`,
      );
    }

    return arm === "O3"
      ? {
          ...world,
          auditOptions: {
            ...world.auditOptions,
            frontierKnowledgeTransferDisabled: true,
          },
        }
      : world;
  };

  /** Runs production until its first frontier party physically returns. */
  const runArm = (scenario, seed, arm) => {
    diag.setExplorationJourneyRecording(true);

    try {
      let world = buildWorld(scenario, seed, arm);
      let expeditionId;
      const dailyRows = [];
      let terminal;

      for (let day = 1; day <= MAX_DAYS; day += 1) {
        world = runner.stepSim(world, 1, "daily");

        if (expeditionId === undefined) {
          expeditionId = findFirstFrontierExpedition(world)?.id;
        }

        if (expeditionId !== undefined) {
          const active = findExpedition(world, String(expeditionId));

          if (active !== undefined) {
            dailyRows.push(captureDailyExpedition(day, active));
          }

          terminal = diag
            .getExplorationJourneys()
            .find(
              (journey) =>
                String(journey.expeditionId) === String(expeditionId),
            );

          if (terminal !== undefined) {
            break;
          }
        }

        if (!Object.values(world.bands).some(isLiving)) {
          break;
        }
      }

      if (terminal === undefined) {
        return null;
      }

      const normalizedTerminal = {
        expeditionId: String(terminal.expeditionId),
        bandId: String(terminal.bandId),
        partyWorkers: Number(terminal.partyWorkers),
        partyComposition:
          terminal.partyComposition === undefined
            ? null
            : {
                limited: Number(terminal.partyComposition.limited),
                typical: Number(terminal.partyComposition.typical),
                high: Number(terminal.partyComposition.high),
              },
        departureDay: Number(terminal.departureDay),
        provisionsLoaded: Number(terminal.provisionsLoaded),
        routeTileIds: [...terminal.routeTileIds].map(String),
        outboundStepCountsByDay: [...terminal.routeStepsByDay].map(Number),
        riskEpisodeIds: [...terminal.riskEpisodeIds].map(String),
        provisionsConsumed: Number(terminal.provisionsConsumed),
        forcedReturn: Boolean(terminal.forcedReturn),
        returnDay:
          terminal.returnDay === undefined
            ? null
            : Number(terminal.returnDay),
        lost: Boolean(terminal.lost),
        terminalOutcome: String(terminal.terminalOutcome),
        terminalPositionTileId: String(terminal.terminalPositionTileId),
      };

      return {
        ...normalizedTerminal,
        dailyPhysicalStream: expandDailyPhysicalStream(
          dailyRows,
          normalizedTerminal,
        ),
      };
    } finally {
      diag.setExplorationJourneyRecording(false);
    }
  };

  const rows = [];

  for (const scenario of SCENARIOS) {
    for (const seed of SEEDS) {
      const control = runArm(scenario, seed, "O0");
      const treated = runArm(scenario, seed, "O3");
      const exactParity = JSON.stringify(control) === JSON.stringify(treated);
      rows.push({
        scenario: scenario.name,
        seed,
        exactParity,
        control,
        treated,
      });
      console.log(
        `${scenario.name.padEnd(20)} ${seed} ${
          exactParity ? "EXACT" : "MISMATCH"
        }`,
      );
    }
  }

  const exact = rows.filter((row) => row.exactParity).length;
  const result = {
    instrument: "O3 EXACT PHYSICAL-STREAM PARITY THROUGH FIRST RETURN",
    sourceRoot: "detached-o3-worktree-at-9e317647/src",
    sourceCommit: "9e317647b3ab8d4a36ae905a567a46b7a4845e1f",
    comparedRuns: rows.length,
    exactParityRuns: exact,
    mismatchRuns: rows.length - exact,
    verdict: exact === rows.length ? "PASS" : "FAIL",
    requiredFields: [
      "expeditionId",
      "bandId",
      "partyWorkers",
      "partyComposition",
      "departureDay",
      "routeTileIds",
      "dailyPhysicalStream.traversedTileIds",
      "dailyPhysicalStream.physicalStepCount",
      "dailyPhysicalStream.positionAfterDay",
      "riskEpisodeIds",
      "provisionsLoaded",
      "provisionsConsumed",
      "forcedReturn",
      "returnDay",
      "lost",
      "terminalOutcome",
      "terminalPositionTileId",
    ],
    rows,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
  console.log(
    `O3 exact physical-stream parity: ${exact}/${rows.length}; wrote ${OUT}`,
  );
} finally {
  await server.close();
}
