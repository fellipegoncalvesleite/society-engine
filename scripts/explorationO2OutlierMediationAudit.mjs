// CORRECTION-24C — first-divergence mediation for the three 200-year O2 outliers.
//
// Each arm advances production normally. The control retains compact per-stage
// hashes; O2 compares them online. A short control replay then captures the exact
// objects at each first mismatch, yielding the required causal chain without
// retaining 72,000 full daily worlds.
//
// Usage:
//   node scripts/explorationO2OutlierMediationAudit.mjs \
//     --source-root /absolute/path/to/9e317647/worktree/src \
//     --out docs/evidence/correction24c/o2-200y-outlier-mediation.json

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

const YEARS = 200;
const TRACE_YEARS = Number(arg("trace-years", "20"));
const TRACE_DAYS = TRACE_YEARS * 360;
const SOURCE_ROOT = resolve(arg("source-root", `${process.cwd()}/src`));
const OUT = arg(
  "out",
  "docs/evidence/correction24c/o2-200y-outlier-mediation.json",
);
const SEED_PREFIX = arg("seed-prefix", "c24a:chain");
const CASES = [
  { scenario: "map1", map: "map1", seed: "s2" },
  { scenario: "map1", map: "map1", seed: "s4" },
  { scenario: "map2", map: "map2", seed: "s2" },
];
const STAGES = [
  "fallthroughRepair",
  "explorationPhysical",
  "laborProvision",
  "localWorkTask",
  "receiptSupport",
  "birthsDeaths",
  "population",
];

/** Rounds evidence without changing simulation arithmetic. */
const r6 = (value) =>
  value === null || value === undefined
    ? null
    : Math.round(Number(value) * 1_000_000) / 1_000_000;

/** Returns whether a band remains a living production actor. */
const isLiving = (band) =>
  band.viability?.status !== "extinct" &&
  band.viability?.status !== "absorbed" &&
  band.viability?.status !== "dispersed" &&
  Number(band.demography?.population ?? 0) > 0;

/** Two independent compact hashes make accidental stage collision negligible. */
const hashText = (text) => {
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

/** Stable sorting helper for evidence arrays. */
const byId = (left, right) =>
  String(left.id ?? left.bandId ?? "").localeCompare(
    String(right.id ?? right.bandId ?? ""),
  );

/** Produces the exact comparable objects for each required mediation stage. */
const stageDetails = (
  world,
  newFunnelRows,
  newJourneyRows,
  cumulativeDemography,
) => {
  const bands = Object.values(world.bands).sort(byId);
  const activeExpeditions = bands
    .flatMap((band) =>
      (band.expeditions ?? []).map((expedition) => ({
        id: String(expedition.id),
        bandId: String(band.id),
        taskKind: String(expedition.taskKind),
        phase: String(expedition.phase),
        partyWorkers: Number(expedition.partyWorkers ?? 0),
        departedDay: Number(expedition.departedDay ?? 0),
        positionTileId: String(expedition.positionTileId),
        routeIndex: Number(expedition.routeIndex ?? 0),
        routeTileIds: [...(expedition.routeTileIds ?? [])].map(String),
        provisionsConsumed: Number(
          expedition.cargo?.provisionUnitsConsumed ?? 0,
        ),
      })),
    )
    .sort(byId);
  const frontierExpeditions = activeExpeditions.filter(
    (expedition) => expedition.taskKind === "frontier_exploration",
  );
  const trips = bands
    .flatMap((band) =>
      (band.recentIntraSeasonTrips ?? []).map((trip) => ({
        id: String(
          trip.id ??
            `${String(band.id)}:${String(trip.targetTileId)}:${String(
              trip.day ?? trip.tick ?? "",
            )}`,
        ),
        bandId: String(band.id),
        activityKind: String(
          trip.activityKind ?? trip.taskKind ?? trip.activityResult ?? "",
        ),
        targetTileId: String(trip.targetTileId ?? ""),
        targetPatchId:
          trip.targetPatchId === undefined
            ? null
            : String(trip.targetPatchId),
        workers: Number(trip.workers ?? trip.partyWorkers ?? 0),
        usableSupport: r6(
          trip.usableSupportReturned ??
            trip.usableSupport ??
            trip.harvestUnits ??
            0,
        ),
      })),
    )
    .sort(byId);

  return {
    fallthroughRepair: newFunnelRows
      .map((row) => ({
        bandId: String(row.bandId),
        day: Number(row.day),
        physicallyValidExplorationProposal: Boolean(
          row.physicallyValidExplorationProposal,
        ),
        explorationOffered: Boolean(row.explorationOffered),
        claimedBy:
          row.claimedBy === undefined ? null : String(row.claimedBy),
        claimFailure:
          row.claimFailure === undefined
            ? null
            : String(row.claimFailure),
        claimedCandidateTarget:
          row.claimedCandidateTarget === undefined
            ? null
            : String(row.claimedCandidateTarget),
        fallthroughOpportunity: Boolean(row.fallthroughOpportunity),
        schedulerOutcome: String(row.schedulerOutcome),
        primaryBlocker: String(row.primaryBlocker),
      }))
      .sort(byId),
    explorationPhysical: {
      active: frontierExpeditions,
      terminalToday: newJourneyRows
        .map((journey) => ({
          id: String(journey.expeditionId),
          bandId: String(journey.bandId),
          departureDay: Number(journey.departureDay),
          returnDay:
            journey.returnDay === undefined
              ? null
              : Number(journey.returnDay),
          partyWorkers: Number(journey.partyWorkers),
          routeTileIds: [...journey.routeTileIds].map(String),
          provisionsConsumed: Number(journey.provisionsConsumed),
          lost: Boolean(journey.lost),
        }))
        .sort(byId),
    },
    laborProvision: {
      activeWorkerDaysToday: activeExpeditions.reduce(
        (total, expedition) => total + expedition.partyWorkers,
        0,
      ),
      activeExpeditions,
      provisionsConsumedCumulativeActive: r6(
        activeExpeditions.reduce(
          (total, expedition) =>
            total + expedition.provisionsConsumed,
          0,
        ),
      ),
    },
    localWorkTask: trips,
    receiptSupport: bands.map((band) => ({
      bandId: String(band.id),
      seasonalReceipt: r6(
        band.seasonalFoodReceipts?.totalUsableSupport ?? 0,
      ),
      rollingSupport: r6(
        band.seasonalSupport?.rolling4SeasonSupport ?? 0,
      ),
      currentSupport: r6(
        band.seasonalSupport?.currentSeasonSupport?.rawSupportRatio ?? 0,
      ),
    })),
    birthsDeaths: {
      totalBirths: cumulativeDemography.births,
      totalDeaths: cumulativeDemography.deaths,
    },
    population: {
      totalPopulation: bands.reduce(
        (total, band) =>
          total + Number(band.demography?.population ?? 0),
        0,
      ),
    },
  };
};

/** Allocates compact per-day hashes for all causal stages. */
const createTrace = () =>
  Object.fromEntries(
    STAGES.map((stage) => [
      stage,
      {
        first: new Uint32Array(TRACE_DAYS + 1),
        second: new Uint32Array(TRACE_DAYS + 1),
      },
    ]),
  );

/** Finds the first unequal season-boundary detail in two compact timelines. */
const firstTimelineDifference = (control, treated, field) => {
  const length = Math.max(control.length, treated.length);

  for (let index = 0; index < length; index += 1) {
    const controlRow =
      control[Math.min(index, Math.max(0, control.length - 1))];
    const treatedRow =
      treated[Math.min(index, Math.max(0, treated.length - 1))];

    if (controlRow === undefined || treatedRow === undefined) {
      continue;
    }

    if (
      JSON.stringify(controlRow[field]) !==
      JSON.stringify(treatedRow[field])
    ) {
      return {
        day: Math.max(controlRow.day, treatedRow.day),
        control: controlRow[field],
        treated: treatedRow[field],
      };
    }
  }

  return null;
};

const server = await createServer({
  root: SOURCE_ROOT,
  cacheDir: `node_modules/.vite-c24c-o2-outlier-${process.pid}`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const diag = await server.ssrLoadModule(
    "/sim/diagnostics/explorationFunnelDiagnostics.ts",
  );

  /** Runs one arm and optionally compares its stage hashes to O0 online. */
  const runArm = (
    testCase,
    arm,
    controlTrace,
    stopAtDay = TRACE_DAYS,
  ) => {
    diag.setExplorationFunnelRecording(true, testCase.scenario);
    diag.setExplorationJourneyRecording(true);
    diag.setExplorationRecordRecording(true);
    diag.setExplorationArm(arm);

    try {
      let world = runner.initSimWorld(
        { kind: testCase.map },
        `${SEED_PREFIX}:${testCase.seed}`,
      );
      const trace = controlTrace === undefined ? createTrace() : undefined;
      const firstDifferences = Object.fromEntries(
        STAGES.map((stage) => [stage, null]),
      );
      const firstTreatedDetails = {};
      const requestedControlDays =
        typeof stopAtDay === "object" ? stopAtDay : undefined;
      const capturedControlDetails = {};
      let seenFunnelRows = 0;
      let seenJourneyRows = 0;
      let completedThroughDay = 0;
      let workerDaysAway = 0;
      let cumulativeBirths = 0;
      let cumulativeDeaths = 0;
      let cumulativeFreshSeasonReceipts = 0;
      let currentRawSupportRatioTotal = 0;
      let currentRawSupportRatioSamples = 0;
      let previousTick = Number(world.time.tick);
      const countedDemographyUpdates = new Set();

      for (
        let day = 1;
        day <=
        (requestedControlDays === undefined
          ? Number(stopAtDay)
          : Math.max(...Object.values(requestedControlDays)));
        day += 1
      ) {
        world = runner.stepSim(world, 1, "daily");
        completedThroughDay = day;
        const funnelRows = diag.getExplorationFunnel();
        const journeyRows = diag.getExplorationJourneys();
        const newFunnelRows = funnelRows.slice(seenFunnelRows);
        const newJourneyRows = journeyRows.slice(seenJourneyRows);
        seenFunnelRows = funnelRows.length;
        seenJourneyRows = journeyRows.length;
        const currentTick = Number(world.time.tick);
        const bandsToday = Object.values(world.bands);

        for (const band of bandsToday) {
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
        }

        if (currentTick !== previousTick) {
          for (const band of bandsToday) {
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
        }
        previousTick = currentTick;

        const details = stageDetails(
          world,
          newFunnelRows,
          newJourneyRows,
          {
            births: cumulativeBirths,
            deaths: cumulativeDeaths,
          },
        );

        for (const band of Object.values(world.bands)) {
          for (const expedition of band.expeditions ?? []) {
            if (
              expedition.phase !== "completed" &&
              expedition.phase !== "aborted" &&
              expedition.phase !== "lost"
            ) {
              workerDaysAway += Number(expedition.partyWorkers ?? 0);
            }
          }
        }

        for (const stage of STAGES) {
          const [first, second] = hashText(
            JSON.stringify(details[stage]),
          );

          if (trace !== undefined) {
            trace[stage].first[day] = first;
            trace[stage].second[day] = second;
          } else if (
            firstDifferences[stage] === null &&
            (controlTrace[stage].first[day] !== first ||
              controlTrace[stage].second[day] !== second)
          ) {
            firstDifferences[stage] = day;
            firstTreatedDetails[stage] = details[stage];
          }

          if (requestedControlDays?.[stage] === day) {
            capturedControlDetails[stage] = details[stage];
          }
        }

        if (!Object.values(world.bands).some(isLiving)) {
          break;
        }
      }

      const living = Object.values(world.bands).filter(isLiving);
      const allBands = Object.values(world.bands);
      const journeys = diag.getExplorationJourneys();
      const records = diag.getExplorationRecords();
      const funnel = diag.getExplorationFunnel();
      const metrics = {
        completedThroughDay,
        population: living.reduce(
          (total, band) =>
            total + Number(band.demography?.population ?? 0),
          0,
        ),
        births: cumulativeBirths,
        deaths: cumulativeDeaths,
        workerDaysAway,
        provisionsConsumed: r6(
          journeys.reduce(
            (total, journey) =>
              total + Number(journey.provisionsConsumed ?? 0),
            0,
          ),
        ),
        receipts: r6(cumulativeFreshSeasonReceipts),
        support: r6(
          currentRawSupportRatioSamples === 0
            ? 0
            : currentRawSupportRatioTotal /
                currentRawSupportRatioSamples,
        ),
        supportSampleCount: currentRawSupportRatioSamples,
        launches: funnel.filter(
          (row) => row.primaryBlocker === "SELECTED",
        ).length,
        fallthroughOpportunities: funnel.filter(
          (row) => row.fallthroughOpportunity,
        ).length,
        journeys: journeys.length,
        returnedRecords: records.length,
      };

      return {
        trace,
        firstDifferences,
        firstTreatedDetails,
        capturedControlDetails,
        metrics,
      };
    } finally {
      diag.clearExplorationDiagnostics();
    }
  };

  /**
   * Runs the full 200-year arm through production's season-step interface.
   * Daily physical work still executes internally; only the expensive
   * per-stage JSON capture is restricted to the first-divergence horizon.
   */
  const runFinalArm = (testCase, arm) => {
    diag.setExplorationFunnelRecording(true, testCase.scenario);
    diag.setExplorationJourneyRecording(true);
    diag.setExplorationRecordRecording(true);
    diag.setExplorationArm(arm);

    try {
      let world = runner.initSimWorld(
        { kind: testCase.map },
        `${SEED_PREFIX}:${testCase.seed}`,
      );
      let cumulativeBirths = 0;
      let cumulativeDeaths = 0;
      let cumulativeFreshSeasonReceipts = 0;
      let currentRawSupportRatioTotal = 0;
      let currentRawSupportRatioSamples = 0;
      const countedDemographyUpdates = new Set();
      const demographyTimeline = [];

      for (let season = 1; season <= YEARS * 4; season += 1) {
        world = runner.stepSim(world, 1, "seasonal");
        const currentTick = Number(world.time.tick);

        for (const band of Object.values(world.bands)) {
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

        demographyTimeline.push({
          day: Number(
            world.time.day ?? Number(world.time.tick) * 90,
          ),
          birthsDeaths: {
            totalBirths: cumulativeBirths,
            totalDeaths: cumulativeDeaths,
          },
          population: {
            totalPopulation: Object.values(world.bands).reduce(
              (total, band) =>
                total + Number(band.demography?.population ?? 0),
              0,
            ),
          },
        });

        if (!Object.values(world.bands).some(isLiving)) {
          break;
        }
      }

      const completedThroughDay = Number(
        world.time.day ?? Number(world.time.tick) * 90,
      );
      const living = Object.values(world.bands).filter(isLiving);
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

      return {
        completedThroughDay,
        population: living.reduce(
          (total, band) =>
            total + Number(band.demography?.population ?? 0),
          0,
        ),
        births: cumulativeBirths,
        deaths: cumulativeDeaths,
        workerDaysAway,
        provisionsConsumed: r6(
          journeys.reduce(
            (total, journey) =>
              total + Number(journey.provisionsConsumed ?? 0),
            0,
          ) +
            activeExplorations.reduce(
              (total, expedition) =>
                total +
                Number(
                  expedition.cargo?.provisionUnitsConsumed ?? 0,
                ),
              0,
            ),
        ),
        receipts: r6(cumulativeFreshSeasonReceipts),
        support: r6(
          currentRawSupportRatioSamples === 0
            ? 0
            : currentRawSupportRatioTotal /
                currentRawSupportRatioSamples,
        ),
        supportSampleCount: currentRawSupportRatioSamples,
        launches: funnel.filter(
          (row) => row.primaryBlocker === "SELECTED",
        ).length,
        fallthroughOpportunities: funnel.filter(
          (row) => row.fallthroughOpportunity,
        ).length,
        journeys: journeys.length,
        returnedRecords: records.length,
        demographyTimeline,
      };
    } finally {
      diag.clearExplorationDiagnostics();
    }
  };

  const rows = [];

  for (const testCase of CASES) {
    const controlTrace = runArm(
      testCase,
      "O0",
      undefined,
      TRACE_DAYS,
    );
    const treatedTrace = runArm(
      testCase,
      "O2",
      controlTrace.trace,
      TRACE_DAYS,
    );
    const requestedControlDays = Object.fromEntries(
      STAGES.filter(
        (stage) => treatedTrace.firstDifferences[stage] !== null,
      ).map((stage) => [
        stage,
        treatedTrace.firstDifferences[stage],
      ]),
    );
    const controlReplay = runArm(
      testCase,
      "O0",
      undefined,
      requestedControlDays,
    );
    const chain = STAGES.map((stage) => ({
      stage,
      firstDifferenceDay: treatedTrace.firstDifferences[stage],
      control:
        treatedTrace.firstDifferences[stage] === null
          ? null
          : controlReplay.capturedControlDetails[stage],
      treated:
        treatedTrace.firstDifferences[stage] === null
          ? null
          : treatedTrace.firstTreatedDetails[stage],
    }));
    const {
      demographyTimeline: controlDemographyTimeline,
      ...controlFinal
    } = runFinalArm(testCase, "O0");
    const {
      demographyTimeline: treatedDemographyTimeline,
      ...treatedFinal
    } = runFinalArm(testCase, "O2");

    for (const stage of ["birthsDeaths", "population"]) {
      const entry = chain.find((candidate) => candidate.stage === stage);

      if (entry?.firstDifferenceDay !== null) {
        continue;
      }

      const difference = firstTimelineDifference(
        controlDemographyTimeline,
        treatedDemographyTimeline,
        stage,
      );

      if (entry !== undefined && difference !== null) {
        entry.firstDifferenceDay = difference.day;
        entry.control = difference.control;
        entry.treated = difference.treated;
      }
    }

    const activeStages = chain.filter(
      (entry) => entry.firstDifferenceDay !== null,
    );
    const chronologicallyOrdered = activeStages.every(
      (entry, index) =>
        index === 0 ||
        entry.firstDifferenceDay >=
          activeStages[index - 1].firstDifferenceDay,
    );
    const row = {
      scenario: testCase.scenario,
      seed: testCase.seed,
      controlFinal,
      treatedFinal,
      populationDifference:
        treatedFinal.population - controlFinal.population,
      chain,
      chronologicallyOrdered,
    };
    rows.push(row);
    console.log(
      `${testCase.scenario} ${testCase.seed} popDiff=${
        row.populationDifference
      } chain=${chain
        .map((entry) => `${entry.stage}@${entry.firstDifferenceDay}`)
        .join(" -> ")}`,
    );
  }

  const sharedMechanism =
    rows.every((row) =>
      row.chain
        .filter((entry) => entry.firstDifferenceDay !== null)
        .map((entry) => entry.stage)
        .join("|")
        .startsWith(
          "fallthroughRepair|explorationPhysical|laborProvision",
        ),
    );
  const result = {
    instrument: "O2 THREE-OUTLIER FIRST-DIVERGENCE MEDIATION",
    sourceRoot: "detached-clean-worktree-at-9e317647/src",
    sourceCommit: "9e317647b3ab8d4a36ae905a567a46b7a4845e1f",
    years: YEARS,
    dailyTraceYears: TRACE_YEARS,
    requiredChain: STAGES,
    metricDefinitions: {
      workerDaysAway:
        "exact frontier-exploration party-workers multiplied by production departure-to-terminal duration",
      firstDifferenceDay:
        "daily production comparison through the bounded physical trace horizon, extended for births/deaths and population by season-boundary production comparisons through year 200",
      birthsAndDeaths:
        "cumulative production annual lastBirths/lastDeaths, counted once per band and demographic-update tick",
      receiptsAndSupport:
        "receipts is the cumulative sum of fresh production receipt accumulators at season boundaries; support is the mean current-season raw support ratio across living band-season observations",
    },
    interpretation:
      "Concentration in three default-map runs is interaction-dependent; it is neither global irrelevance nor evidence of a globally harmful arm.",
    sharedMechanism,
    rows,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`wrote ${OUT}`);
} finally {
  await server.close();
}
