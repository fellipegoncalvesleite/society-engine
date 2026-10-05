// CORRECTION-24C — paired O0/O2 long-horizon matrix from the detached 9e317647 source.
//
// The runner retains only two compact 32-bit hashes per simulated day while the
// control runs, then compares the treated arm online. This identifies the first
// divergence without retaining millions of full JSON day snapshots.
//
// Usage:
//   node scripts/explorationO2LongHorizonAudit.mjs --years 500 \
//     --source-root /absolute/path/to/9e317647/worktree/src \
//     --out docs/evidence/correction24c/o2-500y.json

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

const YEARS = Number(arg("years", "500"));
const MAX_SEASONS = YEARS * 4;
const SOURCE_ROOT = resolve(arg("source-root", `${process.cwd()}/src`));
const OUT = arg(
  "out",
  `docs/evidence/correction24c/o2-${YEARS}y.json`,
);
const SEEDS = arg("seeds", "s1,s2,s3,s4,s5").split(",").filter(Boolean);
const SEED_PREFIX = arg("seed-prefix", "c24a:chain");
const BOOTSTRAP = Number(arg("bootstrap", "10000"));

const ALL_SCENARIOS = [
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

const requestedScenarios = arg("scenarios", "");
const SCENARIOS =
  requestedScenarios === ""
    ? ALL_SCENARIOS
    : ALL_SCENARIOS.filter((scenario) =>
        requestedScenarios.split(",").includes(scenario.name),
      );

/** Rounds evidence without changing simulation arithmetic. */
const r6 = (value) =>
  value === null || value === undefined
    ? null
    : Math.round(Number(value) * 1_000_000) / 1_000_000;

/** Deterministic PRNG for the paired bootstrap. */
const makeRng = (seed) => {
  let state = 2166136261 >>> 0;
  for (const character of String(seed)) {
    state ^= character.charCodeAt(0);
    state = Math.imul(state, 16777619) >>> 0;
  }

  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
};

/** Returns a reproducible percentile bootstrap interval for paired mean differences. */
const pairedBootstrap = (differences, iterations, seed) => {
  if (differences.length === 0) {
    return {
      lower: null,
      upper: null,
      median: null,
      iterations: 0,
    };
  }

  const random = makeRng(seed);
  const means = [];

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let total = 0;

    for (let index = 0; index < differences.length; index += 1) {
      total += differences[Math.floor(random() * differences.length)];
    }

    means.push(total / differences.length);
  }

  means.sort((left, right) => left - right);
  const sorted = [...differences].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return {
    lower: r6(means[Math.floor(iterations * 0.025)]),
    upper: r6(means[Math.floor(iterations * 0.975)]),
    median: r6(
      sorted.length % 2 === 1
        ? sorted[middle]
        : (sorted[middle - 1] + sorted[middle]) / 2,
    ),
    iterations,
  };
};

/** Returns whether a band remains a living production actor. */
const isLiving = (band) =>
  band.viability?.status !== "extinct" &&
  band.viability?.status !== "absorbed" &&
  band.viability?.status !== "dispersed" &&
  Number(band.demography?.population ?? 0) > 0;

/** Two independent compact hashes make accidental day-state collision negligible. */
const hashDayState = (text) => {
  let fnv = 2166136261 >>> 0;
  let djb = 5381 >>> 0;

  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    fnv ^= code;
    fnv = Math.imul(fnv, 16777619) >>> 0;
    djb = (Math.imul(djb, 33) ^ code) >>> 0;
  }

  return [fnv, djb];
};

/** Compact comparable state used only to locate the first O0/O2 divergence. */
const comparableDayState = (world) =>
  JSON.stringify(
    Object.values(world.bands)
      .sort((left, right) => String(left.id).localeCompare(String(right.id)))
      .map((band) => ({
        id: String(band.id),
        position: String(band.position),
        population: Number(band.demography?.population ?? 0),
        lastBirths: Number(band.demography?.lastBirths ?? 0),
        lastDeaths: Number(band.demography?.lastDeaths ?? 0),
        viability: String(band.viability?.status ?? ""),
        expeditions: (band.expeditions ?? [])
          .map((expedition) => [
            String(expedition.id),
            String(expedition.taskKind),
            String(expedition.phase),
            String(expedition.positionTileId),
            Number(expedition.routeIndex),
            Number(expedition.cargo?.provisionUnitsConsumed ?? 0),
          ])
          .sort((left, right) => String(left[0]).localeCompare(String(right[0]))),
        knownTileCount: Object.keys(
          band.knowledge?.observedTiles ?? {},
        ).length,
        receipt: r6(
          band.seasonalFoodReceipts?.totalUsableSupport ?? 0,
        ),
        support: r6(
          band.seasonalSupport?.rolling4SeasonSupport ?? 0,
        ),
      })),
  );

const server = await createServer({
  root: SOURCE_ROOT,
  cacheDir: `node_modules/.vite-c24c-o2-${process.pid}`,
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
  const expeditionModule = await server.ssrLoadModule(
    "/sim/agents/expedition.ts",
  );

  /** Builds the exact production world used by prior CORRECTION-24 matrices. */
  const buildWorld = (scenario, seed) => {
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

    return world;
  };

  /**
   * Runs one arm. Production's season-step interface still executes every
   * physical day internally, while the control retains only two hashes per
   * season. Exact frontier worker-days come from each journey's production
   * departure/terminal duration rather than from an external daily poll.
   */
  const runArm = (scenario, seed, arm, controlTrace) => {
    diag.setExplorationFunnelRecording(true, scenario.name);
    diag.setExplorationJourneyRecording(true);
    diag.setExplorationRecordRecording(true);
    diag.setExplorationArm(arm);

    try {
      let world = buildWorld(scenario, seed);
      const traceA =
        controlTrace === undefined
          ? new Uint32Array(MAX_SEASONS + 1)
          : undefined;
      const traceB =
        controlTrace === undefined
          ? new Uint32Array(MAX_SEASONS + 1)
          : undefined;
      let firstDivergenceDay = null;
      let completedThroughDay = 0;
      let cumulativeBirths = 0;
      let cumulativeDeaths = 0;
      let cumulativeFreshSeasonReceipts = 0;
      let currentRawSupportRatioTotal = 0;
      let currentRawSupportRatioSamples = 0;
      const countedDemographyUpdates = new Set();

      for (
        let seasonIndex = 1;
        seasonIndex <= MAX_SEASONS;
        seasonIndex += 1
      ) {
        world = runner.stepSim(world, 1, "seasonal");
        completedThroughDay = Number(
          world.time.day ?? seasonIndex * 90,
        );
        const currentTick = Number(world.time.tick);
        const bandsAtBoundary = Object.values(world.bands);

        for (const band of bandsAtBoundary) {
          const demographicTick = Number(
            band.demography?.lastDemographicUpdate?.tick,
          );
          const demographicKey = `${String(band.id)}:${demographicTick}`;

          if (
            demographicTick === currentTick &&
            !countedDemographyUpdates.has(demographicKey)
          ) {
            countedDemographyUpdates.add(demographicKey);
            cumulativeBirths += Number(band.demography?.lastBirths ?? 0);
            cumulativeDeaths += Number(band.demography?.lastDeaths ?? 0);
          }

          const receipt = band.seasonalFoodReceipts;
          if (
            receipt !== undefined &&
            Number(receipt.periodTick) === currentTick - 1
          ) {
            cumulativeFreshSeasonReceipts += Number(
              receipt.totalUsableSupport ?? 0,
            );
          }

          if (isLiving(band)) {
            const rawSupportRatio = Number(
              band.seasonalSupport?.currentSeasonSupport?.rawSupportRatio,
            );
            if (Number.isFinite(rawSupportRatio)) {
              currentRawSupportRatioTotal += rawSupportRatio;
              currentRawSupportRatioSamples += 1;
            }
          }
        }

        const [hashA, hashB] = hashDayState(comparableDayState(world));

        if (controlTrace === undefined) {
          traceA[seasonIndex] = hashA;
          traceB[seasonIndex] = hashB;
        } else if (
          firstDivergenceDay === null &&
          (controlTrace.traceA[seasonIndex] !== hashA ||
            controlTrace.traceB[seasonIndex] !== hashB)
        ) {
          firstDivergenceDay = completedThroughDay;
        }

        if (!Object.values(world.bands).some(isLiving)) {
          break;
        }
      }

      if (
        controlTrace !== undefined &&
        firstDivergenceDay === null &&
        completedThroughDay !== controlTrace.completedThroughDay
      ) {
        firstDivergenceDay =
          Math.min(completedThroughDay, controlTrace.completedThroughDay) + 1;
      }

      const livingBands = Object.values(world.bands).filter(isLiving);
      const allBands = Object.values(world.bands);
      const journeys = [...diag.getExplorationJourneys()];
      const records = [...diag.getExplorationRecords()];
      const funnel = [...diag.getExplorationFunnel()];
      const activeExplorations = allBands.flatMap((band) =>
        (band.expeditions ?? []).filter(
          (expedition) =>
            expedition.taskKind === "frontier_exploration" &&
            expedition.phase !== "completed" &&
            expedition.phase !== "aborted" &&
            expedition.phase !== "lost",
        ),
      );
      const workerDaysAway =
        journeys.reduce(
          (total, journey) =>
            total +
            Number(journey.partyWorkers ?? 0) *
              Number(
                journey.durationDays ??
                  Math.max(
                    0,
                    Number(journey.returnDay ?? completedThroughDay) -
                      Number(journey.departureDay ?? completedThroughDay),
                  ),
              ),
          0,
        ) +
        activeExplorations.reduce(
          (total, expedition) =>
            total +
            Number(expedition.partyWorkers ?? 0) *
              Math.max(
                0,
                completedThroughDay -
                  Number(expedition.departedDay ?? completedThroughDay) +
                  1,
              ),
          0,
        );
      const provisionsConsumed =
        journeys.reduce(
          (total, journey) =>
            total + Number(journey.provisionsConsumed ?? 0),
          0,
        ) +
        activeExplorations.reduce(
          (total, expedition) =>
            total +
            Number(expedition.cargo?.provisionUnitsConsumed ?? 0),
          0,
        );
      const provisionsLoaded =
        journeys.reduce(
          (total, journey) =>
            total +
            Number(journey.partyWorkers ?? 0) *
              Number(
                expeditionModule.EXPEDITION_PROVISION_UNITS_PER_WORKER_DAY,
              ) *
              Number(expeditionModule.EXPEDITION_MAX_DURATION_DAYS),
          0,
        ) +
        activeExplorations.reduce(
          (total, expedition) =>
            total +
            Number(expedition.partyWorkers ?? 0) *
              Number(
                expeditionModule.EXPEDITION_PROVISION_UNITS_PER_WORKER_DAY,
              ) *
              Number(expeditionModule.EXPEDITION_MAX_DURATION_DAYS),
          0,
        );

      return {
        ...(traceA === undefined
          ? {}
          : { traceA, traceB, completedThroughDay }),
        firstDivergenceDay,
        metrics: {
          completedThroughDay,
          survived: livingBands.length > 0,
          livingBands: livingBands.length,
          population: livingBands.reduce(
            (total, band) =>
              total + Number(band.demography?.population ?? 0),
            0,
          ),
          births: cumulativeBirths,
          deaths: cumulativeDeaths,
          workerDaysAway,
          provisionsLoaded: r6(provisionsLoaded),
          provisionsConsumed: r6(provisionsConsumed),
          receipts: r6(cumulativeFreshSeasonReceipts),
          support: r6(
            currentRawSupportRatioSamples === 0
              ? 0
              : currentRawSupportRatioTotal /
                  currentRawSupportRatioSamples,
          ),
          supportSampleCount: currentRawSupportRatioSamples,
          terminalSeasonReceipts: r6(
            livingBands.reduce(
              (total, band) =>
                total +
                Number(
                  band.seasonalFoodReceipts?.totalUsableSupport ?? 0,
                ),
              0,
            ),
          ),
          terminalRollingSupport: r6(
            livingBands.reduce(
              (total, band) =>
                total +
                Number(
                  band.seasonalSupport?.rolling4SeasonSupport ?? 0,
                ),
              0,
            ),
          ),
          launches: funnel.filter(
            (row) => row.primaryBlocker === "SELECTED",
          ).length,
          fallthroughOpportunities: funnel.filter(
            (row) => row.fallthroughOpportunity,
          ).length,
          frontierJourneys: journeys.length,
          returnedRecords: records.length,
        },
      };
    } finally {
      diag.clearExplorationDiagnostics();
    }
  };

  const pairs = [];

  for (const scenario of SCENARIOS) {
    for (const seed of SEEDS) {
      const control = runArm(scenario, seed, "O0", undefined);
      const treated = runArm(scenario, seed, "O2", control);
      const populationDifference =
        treated.metrics.population - control.metrics.population;
      const row = {
        scenario: scenario.name,
        seed,
        firstDivergenceDay: treated.firstDivergenceDay,
        control: control.metrics,
        treated: treated.metrics,
        populationDifference,
      };
      pairs.push(row);
      console.log(
        `${scenario.name.padEnd(20)} ${seed} div=${String(
          row.firstDivergenceDay,
        ).padStart(7)} pop=${control.metrics.population}->` +
          `${treated.metrics.population} diff=${populationDifference}`,
      );
    }
  }

  const differences = pairs.map((row) => row.populationDifference);
  const bootstrap = pairedBootstrap(
    differences,
    BOOTSTRAP,
    `O2:${YEARS}:${SCENARIOS.map((scenario) => scenario.name).join(",")}`,
  );
  const result = {
    instrument: "O0 VERSUS O2 PAIRED LONG-HORIZON MATRIX",
    sourceRoot: "detached-clean-worktree-at-9e317647/src",
    sourceCommit: "9e317647b3ab8d4a36ae905a567a46b7a4845e1f",
    years: YEARS,
    scenarios: SCENARIOS.map((scenario) => scenario.name),
    seeds: SEEDS,
    pairedRuns: pairs.length,
    metricDefinitions: {
      firstDivergenceDay:
        "first differing production season boundary; daily first-divergence mediation is reported separately for the three required 200-year outliers",
      workerDaysAway:
        "exact frontier-exploration party-workers multiplied by production departure-to-terminal duration, plus any still-active frontier journeys",
      provisions:
        "frontier-exploration provisions loaded and consumed, from production journey records plus still-active frontier parties",
      receiptsAndSupport:
        "receipts is the cumulative sum of fresh production receipt accumulators at season boundaries; support is the mean current-season raw support ratio across living band-season observations; terminal fields preserve the final current accumulator and rolling support",
      birthsAndDeaths:
        "cumulative production annual lastBirths/lastDeaths, counted once per band and demographic-update tick",
    },
    populationPairedDifference: {
      positive: differences.filter((difference) => difference > 0).length,
      negative: differences.filter((difference) => difference < 0).length,
      tied: differences.filter((difference) => difference === 0).length,
      median: bootstrap.median,
      mean: r6(
        differences.reduce((total, difference) => total + difference, 0) /
          Math.max(1, differences.length),
      ),
      bootstrap95: {
        lower: bootstrap.lower,
        upper: bootstrap.upper,
        iterations: bootstrap.iterations,
      },
      crossesZero:
        bootstrap.lower === null
          ? null
          : bootstrap.lower <= 0 && bootstrap.upper >= 0,
    },
    pairs,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
  console.log(
    `O2 ${YEARS}y: +${result.populationPairedDifference.positive} / ` +
      `-${result.populationPairedDifference.negative} / ` +
      `=${result.populationPairedDifference.tied}; wrote ${OUT}`,
  );
} finally {
  await server.close();
}
