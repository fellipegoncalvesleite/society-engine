// CORRECTION-24C — exact return-writer replay with actual production reader and action events.
//
// The fork suppresses one tile write at the canonical frontier-return seam. Reader
// evidence comes only from the four production call sites instrumented in src/sim;
// this script never invokes a reader. Control and counterfactual runs start from the
// same immutable pre-return checkpoint, and every admitted control must reproduce
// the baseline dynamic state exactly.
//
// Usage:
//   node scripts/explorationProductionReaderReplayAudit.mjs --years 40
//   node scripts/explorationProductionReaderReplayAudit.mjs --years 200 \
//     --bins '1-40;81-120;161-200'
//   node scripts/explorationProductionReaderReplayAudit.mjs --years 500 \
//     --scenarios map1,map2 --bins '1-100;201-300;401-500'

import { createHash } from "node:crypto";
import { dirname } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "vite";

/** Reads a simple `--name value` argument. */
const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined
    ? process.argv[index + 1]
    : fallback;
};

const YEARS = Number(arg("years", "40"));
const TOTAL_DAYS = YEARS * 360;
const FOLLOW_DAYS = Number(arg("follow", "720"));
const SEEDS = arg("seeds", "s1,s2,s3,s4,s5").split(",").filter(Boolean);
const SEED_PREFIX = arg("seed-prefix", "c24a:chain");
const BIN_TEXT = arg("bins", "");
const OUT = arg(
  "out",
  `docs/evidence/correction24c/production-reader-replay-${YEARS}y.json`,
);

const READER_FAMILIES = [
  "movement_destination",
  "camp_movement",
  "resource_activity",
  "daughter_fission",
];

const CLASSES = [
  "WRITE_SUPPRESSION_NO_TRACKED_CONSEQUENCE",
  "WRITE_CHANGED_STORED_STATE_ONLY",
  "ACTUAL_READER_CONSULTED_SAME_OUTPUT",
  "ACTUAL_READER_OUTPUT_CHANGED",
  "SELECTED_ACTION_CHANGED",
  "PHYSICAL_ACTION_CHANGED",
  "RECEIPT_OR_SUPPORT_CHANGED",
  "DEMOGRAPHY_CHANGED",
  "CONTROL_REPLAY_UNSOUND",
];

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

/** Parses inclusive year bins into inclusive day ranges. */
const parseBins = (value) => {
  if (value === "") {
    return [{ label: `years_1_${YEARS}`, startDay: 1, endDay: TOTAL_DAYS }];
  }

  return value.split(";").map((part) => {
    const [startYear, endYear] = part.split("-").map(Number);

    if (
      !Number.isFinite(startYear) ||
      !Number.isFinite(endYear) ||
      startYear < 1 ||
      endYear < startYear
    ) {
      throw new Error(`Invalid temporal bin: ${part}`);
    }

    return {
      label: `years_${startYear}_${endYear}`,
      startDay: (startYear - 1) * 360 + 1,
      endDay: endYear * 360,
    };
  });
};

const BINS = parseBins(BIN_TEXT);
const INCLUDE_READER_SAMPLES = BIN_TEXT !== "";

/** Rounds a numeric evidence field without changing simulation arithmetic. */
const r6 = (value) =>
  value === null || value === undefined
    ? null
    : Math.round(Number(value) * 1_000_000) / 1_000_000;

/** Produces a deterministic SHA-256 digest of a JSON-serializable value. */
const digest = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** Returns whether a band is still a living behavioral actor. */
const isLiving = (band) =>
  band.viability?.status !== "extinct" &&
  band.viability?.status !== "absorbed" &&
  band.viability?.status !== "dispersed" &&
  Number(band.demography?.population ?? 0) > 0;

/** Returns the first mismatching array index, or null. */
const firstArrayDifference = (left, right) => {
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    if (JSON.stringify(left[index]) !== JSON.stringify(right[index])) {
      return index;
    }
  }

  return null;
};

/** Returns the first daily metric mismatch. */
const firstMetricDifference = (left, right) => {
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    if (JSON.stringify(left[index]) !== JSON.stringify(right[index])) {
      return {
        index,
        day: left[index]?.day ?? right[index]?.day ?? null,
        control: left[index] ?? null,
        counterfactual: right[index] ?? null,
      };
    }
  }

  return null;
};

/** Returns a bounded set of exact JSON field paths that differ. */
const differingPaths = (left, right, limit = 24) => {
  const paths = [];

  const visit = (leftValue, rightValue, path) => {
    if (paths.length >= limit || Object.is(leftValue, rightValue)) {
      return;
    }

    if (
      leftValue === null ||
      rightValue === null ||
      typeof leftValue !== "object" ||
      typeof rightValue !== "object"
    ) {
      paths.push(path);
      return;
    }

    const keys = [
      ...new Set([...Object.keys(leftValue), ...Object.keys(rightValue)]),
    ].sort();

    for (const key of keys) {
      visit(
        leftValue[key],
        rightValue[key],
        path === "" ? key : `${path}.${key}`,
      );

      if (paths.length >= limit) {
        return;
      }
    }
  };

  visit(left, right, "");
  return paths;
};

/** Groups an action ledger by day for stable stream comparison. */
const ledgerByDay = (rows) => {
  const grouped = new Map();

  for (const row of rows) {
    const day = Number(row.day);
    const items = grouped.get(day) ?? [];
    items.push(row);
    grouped.set(day, items);
  }

  return new Map(
    [...grouped.entries()].map(([day, items]) => [
      day,
      items
        .map((item) => JSON.stringify(item))
        .sort(),
    ]),
  );
};

/** Locates the first day on which two action ledgers differ. */
const firstLedgerDifference = (controlRows, counterfactualRows) => {
  const control = ledgerByDay(controlRows);
  const counterfactual = ledgerByDay(counterfactualRows);
  const days = [...new Set([...control.keys(), ...counterfactual.keys()])].sort(
    (left, right) => left - right,
  );

  for (const day of days) {
    const left = control.get(day) ?? [];
    const right = counterfactual.get(day) ?? [];

    if (JSON.stringify(left) !== JSON.stringify(right)) {
      return {
        day,
        control: left.map((item) => JSON.parse(item)),
        counterfactual: right.map((item) => JSON.parse(item)),
      };
    }
  }

  return null;
};

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c24c-reader-${process.pid}`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const spawn = await server.ssrLoadModule("/sim/agents/spawn.ts");
  const diag = await server.ssrLoadModule(
    "/sim/diagnostics/explorationCausalAudit.ts",
  );

  /** Builds one deterministic production world. */
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

  /** Returns the authoritative dynamic snapshot without the debug ecology projection. */
  const dynamicState = (world) => {
    const { ecologySummary: _ecologySummary, ...snapshot } =
      runner.takeDynamicSnapshot(world);
    return snapshot;
  };

  /** Removes only the intentionally different tile record from the dynamic snapshot. */
  const dynamicStateWithoutTargetRecord = (world, targetEvent) => {
    const snapshot = dynamicState(world);
    const band = snapshot.bands[targetEvent.bandId];

    if (band === undefined) {
      return snapshot;
    }

    const observedTiles = Object.fromEntries(
      Object.entries(band.knowledge?.observedTiles ?? {}).filter(
        ([tileId]) => tileId !== targetEvent.tileId,
      ),
    );
    const tileObservationHistory = (
      band.knowledge?.tileObservationHistory ?? []
    ).filter(
      (observation) =>
        !(
          String(observation.tileId) === targetEvent.tileId &&
          Number(
            observation.observedAt?.day ??
              Number(observation.observedAt?.tick ?? 0) * 90,
          ) === targetEvent.returnDay
        ),
    );

    return {
      ...snapshot,
      bands: {
        ...snapshot.bands,
        [targetEvent.bandId]: {
          ...band,
          knowledge: {
            ...band.knowledge,
            observedTiles,
            tileObservationHistory,
          },
        },
      },
    };
  };

  /** Captures exact seasonal decision identities currently retained by production. */
  const decisionFingerprint = (world) =>
    JSON.stringify(
      Object.values(world.decisions ?? {})
        .map((decision) => [
          String(decision.id),
          String(decision.bandId ?? ""),
          Number(decision.time?.day ?? Number(decision.time?.tick ?? 0) * 90),
          decision.action,
        ])
        .sort((left, right) => String(left[0]).localeCompare(String(right[0]))),
    );

  /** Captures physical receipts and the canonical support summaries by band. */
  const receiptSupportSnapshot = (world, day) => {
    const rows = Object.values(world.bands)
      .sort((left, right) => String(left.id).localeCompare(String(right.id)))
      .map((band) => ({
        bandId: String(band.id),
        receipts: r6(band.seasonalFoodReceipts?.totalUsableSupport ?? 0),
        support: r6(
          band.seasonalSupport?.rolling4SeasonSupport ??
            band.seasonalSupport?.currentSeasonSupport?.usableSupport ??
            0,
        ),
      }));

    return {
      day,
      totalReceipts: r6(
        rows.reduce((total, row) => total + Number(row.receipts ?? 0), 0),
      ),
      totalSupport: r6(
        rows.reduce((total, row) => total + Number(row.support ?? 0), 0),
      ),
      rows,
    };
  };

  /** Captures population/cohort/fission state for demographic divergence. */
  const demographySnapshot = (world, day) => ({
    day,
    bands: Object.values(world.bands)
      .sort((left, right) => String(left.id).localeCompare(String(right.id)))
      .map((band) => ({
        bandId: String(band.id),
        population: Number(band.demography?.population ?? 0),
        dependents: Number(band.demography?.dependents ?? 0),
        workingAdults: Number(band.demography?.workingAdults ?? 0),
        elders: Number(band.demography?.elders ?? 0),
        lastBirths: Number(band.demography?.lastBirths ?? 0),
        lastDeaths: Number(band.demography?.lastDeaths ?? 0),
        birthAccumulator: r6(band.demography?.birthAccumulator ?? 0),
        dependentToAdultAccumulator: r6(
          band.demography?.dependentToAdultAccumulator ?? 0,
        ),
        adultToElderAccumulator: r6(
          band.demography?.adultToElderAccumulator ?? 0,
        ),
        elderMortalityAccumulator: r6(
          band.demography?.elderMortalityAccumulator ?? 0,
        ),
        daughterBandIds: [...(band.daughterBandIds ?? [])].map(String).sort(),
        fissionEventIds: [...(band.fissionEvents ?? [])]
          .map((event) => String(event.id))
          .sort(),
      })),
  });

  /**
   * Runs the discovery baseline. It records production events but deliberately
   * does not serialize the full world each day; selected controls are compared
   * against a second canonical capture pass at exact audit checkpoints.
   */
  const runDiscovery = (scenario, seed) => {
    diag.setExplorationCausalAuditRecording(true);
    diag.setRetainEmptyExplorationReaderInvocations(false);
    diag.setSuppressedExplorationReturnWrite(undefined);

    try {
      let world = buildWorld(scenario, seed);
      let completedThroughDay = 0;

      for (
        let season = 1;
        season <= Math.ceil(TOTAL_DAYS / 90);
        season += 1
      ) {
        const remainingDays = TOTAL_DAYS - completedThroughDay;
        const days = Math.min(90, remainingDays);
        world = advance.advanceWorldByDays(world, days);
        completedThroughDay = Number(
          world.time.day ?? Math.min(TOTAL_DAYS, season * 90),
        );

        if (!Object.values(world.bands).some(isLiving)) {
          break;
        }
      }

      return {
        world,
        completedThroughDay,
        causal: diag.getExplorationCausalAuditSnapshot(),
      };
    } finally {
      diag.clearExplorationCausalAudit();
    }
  };

  /** Returns the sparse exact-state checkpoints required for one replay. */
  const replayCheckpointDays = (event, followedToDay) => {
    const days = new Set([event.returnDay, followedToDay]);

    for (
      let day = Math.ceil(event.returnDay / 90) * 90;
      day <= followedToDay;
      day += 90
    ) {
      if (day >= event.returnDay) {
        days.add(day);
      }
    }

    return days;
  };

  /**
   * Re-runs the canonical baseline without diagnostics, retaining only the
   * selected pre-return worlds and exact return/season/final state digests.
   */
  const runCanonicalCapture = (
    scenario,
    seed,
    completedThroughDay,
    preparedSelections,
  ) => {
    const checkpointByRecordEventId = new Map();
    const rawHashByDay = new Map();
    const hashDays = new Set();
    const eventsByCheckpointDay = new Map();

    for (const selection of preparedSelections) {
      const checkpointDay = Math.max(0, selection.event.returnDay - 1);
      const events = eventsByCheckpointDay.get(checkpointDay) ?? [];
      events.push(selection.event);
      eventsByCheckpointDay.set(checkpointDay, events);

      for (const day of replayCheckpointDays(
        selection.event,
        selection.followedToDay,
      )) {
        hashDays.add(day);
      }
    }

    let world = buildWorld(scenario, seed);
    let currentDay = Number(world.time.day ?? 0);
    const captureDays = [
      ...new Set([
        ...eventsByCheckpointDay.keys(),
        ...hashDays,
      ]),
    ]
      .filter((day) => day >= currentDay && day <= completedThroughDay)
      .sort((left, right) => left - right);

    for (const day of captureDays) {
      world = advance.advanceWorldByDays(world, day - currentDay);
      currentDay = day;

      for (const event of eventsByCheckpointDay.get(day) ?? []) {
        checkpointByRecordEventId.set(event.recordEventId, world);
      }

      if (hashDays.has(day)) {
        rawHashByDay.set(day, digest(dynamicState(world)));
      }
    }

    return { checkpointByRecordEventId, rawHashByDay };
  };

  /** Seeds the latest still-addressable exploration identity at a replay checkpoint. */
  const seedPriorRecordIdentities = (
    checkpointWorld,
    baselineEvents,
    returnDay,
  ) => {
    const latest = new Map();

    for (const event of baselineEvents) {
      if (!event.writeSuppressed && event.returnDay < returnDay) {
        latest.set(`${event.bandId}|${event.tileId}`, event);
      }
    }

    for (const event of latest.values()) {
      const record =
        checkpointWorld.bands[event.bandId]?.knowledge?.observedTiles?.[event.tileId];

      if (record === undefined) {
        continue;
      }

      diag.seedExplorationRecordIdentity({
        recordEventId: event.recordEventId,
        bandId: event.bandId,
        tileId: event.tileId,
        expeditionId: event.expeditionId,
        returnDay: event.returnDay,
      });
    }
  };

  /** Runs a control or one-write-suppressed replay window from a pre-return checkpoint. */
  const runWindow = (
    checkpointWorld,
    baselineEvents,
    targetEvent,
    followedToDay,
    suppression,
  ) => {
    diag.setExplorationCausalAuditRecording(true);
    diag.setRetainEmptyExplorationReaderInvocations(true);
    diag.setSuppressedExplorationReturnWrite(suppression);
    seedPriorRecordIdentities(
      checkpointWorld,
      baselineEvents,
      targetEvent.returnDay,
    );

    try {
      let world = checkpointWorld;
      const rawHashes = [];
      const downstreamHashes = [];
      const decisionFingerprints = [];
      const verificationFingerprints = [];
      const corridorFingerprints = [];
      const preexistingCorridorIds = Object.keys(
        checkpointWorld.bands[targetEvent.bandId]?.travelCorridors ?? {},
      ).sort();
      const preexistingCorridorFingerprints = [];
      const receiptSupport = [];
      const demography = [];
      const checkpointDays = replayCheckpointDays(
        targetEvent,
        followedToDay,
      );

      for (
        let day = targetEvent.returnDay;
        day <= followedToDay;
        day += 1
      ) {
        world = runner.stepSim(world, 1, "daily");
        if (checkpointDays.has(day)) {
          rawHashes.push({ day, hash: digest(dynamicState(world)) });
          downstreamHashes.push({
            day,
            hash: digest(dynamicStateWithoutTargetRecord(world, targetEvent)),
          });
        }
        decisionFingerprints.push(decisionFingerprint(world));
        verificationFingerprints.push(
          JSON.stringify(
            world.bands[targetEvent.bandId]?.verificationEvidence ?? {},
          ),
        );
        corridorFingerprints.push(
          JSON.stringify(
            world.bands[targetEvent.bandId]?.travelCorridors ?? {},
          ),
        );
        const currentCorridors =
          world.bands[targetEvent.bandId]?.travelCorridors ?? {};
        preexistingCorridorFingerprints.push(
          Object.fromEntries(
            preexistingCorridorIds.map((corridorId) => [
              corridorId,
              JSON.stringify(currentCorridors[corridorId] ?? null),
            ]),
          ),
        );
        receiptSupport.push(receiptSupportSnapshot(world, day));
        demography.push(demographySnapshot(world, day));
      }

      return {
        world,
        rawHashes,
        downstreamHashes,
        decisionFingerprints,
        verificationFingerprints,
        corridorFingerprints,
        preexistingCorridorIds,
        preexistingCorridorFingerprints,
        receiptSupport,
        demography,
        causal: diag.getExplorationCausalAuditSnapshot(),
      };
    } finally {
      diag.setSuppressedExplorationReturnWrite(undefined);
      diag.clearExplorationCausalAudit();
    }
  };

  /** Selects first new/refresh events and, for long bins, first actually consulted family events. */
  const selectEvents = (baseline) => {
    const events = [...baseline.causal.recordEvents].sort(
      (left, right) =>
        left.returnDay - right.returnDay ||
        left.tileId.localeCompare(right.tileId) ||
        left.recordEventId.localeCompare(right.recordEventId),
    );
    const readerEventsByRecord = new Map();

    for (const reader of baseline.causal.readerEvents) {
      const rows = readerEventsByRecord.get(reader.recordEventId) ?? [];
      rows.push(reader);
      readerEventsByRecord.set(reader.recordEventId, rows);
    }

    const selected = new Map();
    const missing = [];

    const add = (event, bin, reason) => {
      if (event === undefined) {
        missing.push({ bin: bin.label, sample: reason });
        return;
      }

      const current = selected.get(event.recordEventId) ?? {
        event,
        bins: new Set(),
        selectionReasons: new Set(),
      };
      current.bins.add(bin.label);
      current.selectionReasons.add(reason);
      selected.set(event.recordEventId, current);
    };

    for (const bin of BINS) {
      const inBin = events.filter(
        (event) =>
          event.returnDay >= bin.startDay && event.returnDay <= bin.endDay,
      );
      add(
        inBin.find((event) => event.newOrRefreshed === "new"),
        bin,
        "first_new_write",
      );
      add(
        inBin.find((event) => event.newOrRefreshed === "refreshed"),
        bin,
        "first_refresh",
      );

      if (INCLUDE_READER_SAMPLES) {
        for (const family of READER_FAMILIES) {
          add(
            inBin.find((event) =>
              (readerEventsByRecord.get(event.recordEventId) ?? []).some(
                (reader) => reader.readerFamily === family,
              ),
            ),
            bin,
            `first_consulted_${family}`,
          );
        }
      }
    }

    return {
      selected: [...selected.values()]
        .map((entry) => ({
          event: entry.event,
          bins: [...entry.bins].sort(),
          selectionReasons: [...entry.selectionReasons].sort(),
        }))
        .sort(
          (left, right) =>
            left.event.returnDay - right.event.returnDay ||
            left.event.recordEventId.localeCompare(right.event.recordEventId),
        ),
      missing,
      readerEventsByRecord,
    };
  };

  /** Compares every real invocation that consulted one returned record event. */
  const compareReaderInvocations = (
    controlCausal,
    counterfactualCausal,
    recordEventId,
  ) =>
    controlCausal.readerInvocations
      .filter((invocation) =>
        invocation.consultedRecordEventIds.includes(recordEventId),
      )
      .sort(
        (left, right) =>
          left.invocationDay - right.invocationDay ||
          left.invocationKey.localeCompare(right.invocationKey),
      )
      .map((control) => {
        const counterfactual =
          counterfactualCausal.readerInvocations.find(
            (invocation) =>
              invocation.invocationKey === control.invocationKey,
          );
        const outputChanged =
          counterfactual === undefined ||
          control.readerVerdict !== counterfactual.readerVerdict ||
          control.readerRanking !== counterfactual.readerRanking;
        const selectedOutputChanged =
          counterfactual === undefined ||
          control.selectedActionId !== counterfactual.selectedActionId ||
          control.selectedActionKind !==
            counterfactual.selectedActionKind ||
          control.selectedTarget !== counterfactual.selectedTarget;

        return {
          control,
          counterfactual,
          outputChanged,
          selectedOutputChanged,
        };
      });

  /** Produces a compact reader-chain row without losing any changed invocation. */
  const compactReaderComparison = (comparison, recordEventId) => ({
    readerFamily: comparison.control.readerFamily,
    productionFunction: comparison.control.productionFunction,
    invocationDay: comparison.control.invocationDay,
    consultationRole:
      comparison.control.consultationRoles[recordEventId] ??
      "record_consulted",
    outputChanged: comparison.outputChanged,
    selectedOutputChanged: comparison.selectedOutputChanged,
    control: {
      verdict: comparison.control.readerVerdict,
      ranking: comparison.control.readerRanking,
      selectedActionId:
        comparison.control.selectedActionId ?? null,
      selectedActionKind:
        comparison.control.selectedActionKind ?? null,
      selectedTarget: comparison.control.selectedTarget ?? null,
    },
    counterfactual:
      comparison.counterfactual === undefined
        ? null
        : {
            verdict: comparison.counterfactual.readerVerdict,
            ranking: comparison.counterfactual.readerRanking,
            selectedActionId:
              comparison.counterfactual.selectedActionId ?? null,
            selectedActionKind:
              comparison.counterfactual.selectedActionKind ?? null,
            selectedTarget:
              comparison.counterfactual.selectedTarget ?? null,
          },
  });

  /** Infers a typed physical mechanism from exact action streams. */
  const classifyPhysicalMechanism = (actionDifferences) => {
    const orderedDifferences = [
      ["movement", actionDifferences.movement],
      ["camp", actionDifferences.camp],
      ["resource", actionDifferences.resource],
      ["fission", actionDifferences.fission],
    ]
      .filter(([, difference]) => difference !== null)
      .sort(
        (left, right) =>
          left[1].day - right[1].day ||
          left[0].localeCompare(right[0]),
      );
    const firstFamily = orderedDifferences[0]?.[0];

    if (firstFamily === "movement" || firstFamily === "camp") {
      return "changed_local_residential_action";
    }

    if (firstFamily === "fission") {
      return "changed_daughter_foundation_action";
    }

    const resource = actionDifferences.resource;

    if (firstFamily === "resource" && resource !== null) {
      const control = resource.control[0];
      const counterfactual = resource.counterfactual[0];

      if (
        String(control?.activityKind ?? "").includes("recon") ||
        String(counterfactual?.activityKind ?? "").includes("recon") ||
        String(control?.activityKind ?? "").includes("memory_refresh") ||
        String(counterfactual?.activityKind ?? "").includes("memory_refresh")
      ) {
        return "different_local_reconnaissance_task";
      }

      if (control?.selectedTileId !== counterfactual?.selectedTileId) {
        return "different_resource_trip";
      }

      if (
        JSON.stringify(control?.route ?? []) !==
        JSON.stringify(counterfactual?.route ?? [])
      ) {
        return "changed_route_or_duration";
      }

      if (control?.workers !== counterfactual?.workers) {
        return "changed_worker_availability";
      }

      if (control?.day !== counterfactual?.day) {
        return "changed_timing";
      }

      return "another_typed_physical_mechanism";
    }

    return "unresolved_no_action_stream_difference";
  };

  const totals = {
    events: 0,
    sound: 0,
    unsound: 0,
    byClass: Object.fromEntries(CLASSES.map((name) => [name, 0])),
    cumulative: {
      actualReaderConsulted: 0,
      readerOutputChanged: 0,
      selectedActionChanged: 0,
      physicalActionChanged: 0,
      receiptOrSupportChanged: 0,
      demographyChanged: 0,
    },
  };
  const rows = [];
  const missingSamples = [];
  const perScenario = {};

  for (const scenario of SCENARIOS) {
    const scenarioTotals = {
      events: 0,
      sound: 0,
      unsound: 0,
      byClass: Object.fromEntries(CLASSES.map((name) => [name, 0])),
    };

    for (const seed of SEEDS) {
      const baseline = runDiscovery(scenario, seed);
      const sample = selectEvents(baseline);
      missingSamples.push(
        ...sample.missing.map((entry) => ({
          scenario: scenario.name,
          seed,
          ...entry,
        })),
      );
      const preparedSelections = sample.selected.map((selection) => {
        const event = selection.event;
        const baselineFirstReader = (
          sample.readerEventsByRecord.get(event.recordEventId) ?? []
        )
          .slice()
          .sort(
            (left, right) =>
              left.invocationDay - right.invocationDay ||
              left.readerFamily.localeCompare(right.readerFamily),
          )[0];
        const followedToDay = Math.min(
          baseline.completedThroughDay,
          Math.max(
            event.returnDay + FOLLOW_DAYS,
            Number(baselineFirstReader?.invocationDay ?? event.returnDay) + 1,
          ),
        );

        return { ...selection, followedToDay };
      });
      const canonicalCapture = runCanonicalCapture(
        scenario,
        seed,
        baseline.completedThroughDay,
        preparedSelections,
      );

      for (const selection of preparedSelections) {
        const event = selection.event;
        const checkpoint = canonicalCapture.checkpointByRecordEventId.get(
          event.recordEventId,
        );

        totals.events += 1;
        scenarioTotals.events += 1;

        if (checkpoint === undefined) {
          totals.unsound += 1;
          scenarioTotals.unsound += 1;
          totals.byClass.CONTROL_REPLAY_UNSOUND += 1;
          scenarioTotals.byClass.CONTROL_REPLAY_UNSOUND += 1;
          rows.push({
            scenario: scenario.name,
            seed,
            ...event,
            bins: selection.bins,
            selectionReasons: selection.selectionReasons,
            classification: "CONTROL_REPLAY_UNSOUND",
            soundnessFailure: "missing_pre_return_checkpoint",
          });
          continue;
        }

        const followedToDay = selection.followedToDay;
        const control = runWindow(
          checkpoint,
          baseline.causal.recordEvents,
          event,
          followedToDay,
          undefined,
        );
        const counterfactual = runWindow(
          checkpoint,
          baseline.causal.recordEvents,
          event,
          followedToDay,
          {
            expeditionId: event.expeditionId,
            tileId: event.tileId,
            day: event.returnDay,
          },
        );

        let soundThroughDay = event.returnDay - 1;
        let sound = true;

        for (const checkpointHash of control.rawHashes) {
          const day = checkpointHash.day;
          const expected = canonicalCapture.rawHashByDay.get(day);

          if (expected === undefined || expected !== checkpointHash.hash) {
            sound = false;
            break;
          }

          soundThroughDay = day;
        }

        if (!sound) {
          totals.unsound += 1;
          scenarioTotals.unsound += 1;
          totals.byClass.CONTROL_REPLAY_UNSOUND += 1;
          scenarioTotals.byClass.CONTROL_REPLAY_UNSOUND += 1;
          rows.push({
            scenario: scenario.name,
            seed,
            ...event,
            bins: selection.bins,
            selectionReasons: selection.selectionReasons,
            followedToDay,
            soundThroughDay,
            classification: "CONTROL_REPLAY_UNSOUND",
          });
          continue;
        }

        totals.sound += 1;
        scenarioTotals.sound += 1;

        const readerComparisons = compareReaderInvocations(
          control.causal,
          counterfactual.causal,
          event.recordEventId,
        );
        const firstReaderComparison = readerComparisons[0];
        const controlReader = firstReaderComparison?.control;
        const counterfactualReader =
          firstReaderComparison?.counterfactual;
        const actualReaderConsulted = readerComparisons.length > 0;
        const readerOutputChanged = readerComparisons.some(
          (comparison) => comparison.outputChanged,
        );
        const decisionDifferenceIndex = firstArrayDifference(
          control.decisionFingerprints,
          counterfactual.decisionFingerprints,
        );
        const verificationDifferenceIndex = firstArrayDifference(
          control.verificationFingerprints,
          counterfactual.verificationFingerprints,
        );
        const corridorDifferenceIndex = firstArrayDifference(
          control.corridorFingerprints,
          counterfactual.corridorFingerprints,
        );
        const preservedPreexistingCorridorIds =
          control.preexistingCorridorIds.filter((corridorId) =>
            control.preexistingCorridorFingerprints.every(
              (fingerprints, index) =>
                fingerprints[corridorId] ===
                counterfactual.preexistingCorridorFingerprints[index]?.[
                  corridorId
                ],
            ),
          );
        const checkpointBand = checkpoint.bands[event.bandId];
        const preexistingVerificationEvidenceForTile =
          checkpointBand?.verificationEvidence?.filter(
            (record) => String(record.tileId) === event.tileId,
          ) ?? [];
        const actionDifferences = {
          movement: firstLedgerDifference(
            control.causal.movementActions,
            counterfactual.causal.movementActions,
          ),
          camp: firstLedgerDifference(
            control.causal.campActions,
            counterfactual.causal.campActions,
          ),
          resource: firstLedgerDifference(
            control.causal.resourceActions,
            counterfactual.causal.resourceActions,
          ),
          fission: firstLedgerDifference(
            control.causal.fissionActions,
            counterfactual.causal.fissionActions,
          ),
        };
        const selectedActionChanged =
          decisionDifferenceIndex !== null ||
          actionDifferences.movement !== null ||
          actionDifferences.camp !== null ||
          actionDifferences.resource !== null ||
          actionDifferences.fission !== null;
        const physicalDifferenceByFamily = {
          movement:
            actionDifferences.movement !== null &&
            [
              ...actionDifferences.movement.control,
              ...actionDifferences.movement.counterfactual,
            ].some((action) => action.movementRecordId !== undefined),
          camp: actionDifferences.camp !== null,
          resource: actionDifferences.resource !== null,
          fission:
            actionDifferences.fission !== null &&
            [
              ...actionDifferences.fission.control,
              ...actionDifferences.fission.counterfactual,
            ].some((action) => action.daughterActuallyCreated),
        };
        const physicalActionChanged = Object.values(
          physicalDifferenceByFamily,
        ).some(Boolean);
        const receiptDifference = firstMetricDifference(
          control.receiptSupport,
          counterfactual.receiptSupport,
        );
        const demographyDifference = firstMetricDifference(
          control.demography,
          counterfactual.demography,
        );
        const receiptOrSupportChanged = receiptDifference !== null;
        const demographyChanged = demographyDifference !== null;
        const downstreamDifferenceIndex = firstArrayDifference(
          control.downstreamHashes,
          counterfactual.downstreamHashes,
        );
        const firstDownstreamCheckpointDay =
          downstreamDifferenceIndex === null
            ? null
            : control.downstreamHashes[downstreamDifferenceIndex]?.day ??
              counterfactual.downstreamHashes[downstreamDifferenceIndex]?.day ??
              null;
        const finalDownstreamDifferencePaths =
          downstreamDifferenceIndex === null
            ? []
            : differingPaths(
                dynamicStateWithoutTargetRecord(control.world, event),
                dynamicStateWithoutTargetRecord(counterfactual.world, event),
              );
        const controlWriterEvent = control.causal.recordEvents.find(
          (row) => row.recordEventId === event.recordEventId,
        );
        const counterfactualWriterEvent =
          counterfactual.causal.recordEvents.find(
            (row) => row.recordEventId === event.recordEventId,
          );
        const storedRecordChanged =
          controlWriterEvent?.afterRecordFingerprint !==
          counterfactualWriterEvent?.afterRecordFingerprint;
        const recordPresenceChanged =
          controlWriterEvent?.afterRecordFingerprint !== undefined &&
          counterfactualWriterEvent?.afterRecordFingerprint === undefined;

        let classification = storedRecordChanged
          ? "WRITE_CHANGED_STORED_STATE_ONLY"
          : "WRITE_SUPPRESSION_NO_TRACKED_CONSEQUENCE";

        if (actualReaderConsulted) {
          classification = readerOutputChanged
            ? "ACTUAL_READER_OUTPUT_CHANGED"
            : "ACTUAL_READER_CONSULTED_SAME_OUTPUT";
        }
        if (selectedActionChanged) {
          classification = "SELECTED_ACTION_CHANGED";
        }
        if (physicalActionChanged) {
          classification = "PHYSICAL_ACTION_CHANGED";
        }
        if (receiptOrSupportChanged) {
          classification = "RECEIPT_OR_SUPPORT_CHANGED";
        }
        if (demographyChanged) {
          classification = "DEMOGRAPHY_CHANGED";
        }

        totals.byClass[classification] += 1;
        scenarioTotals.byClass[classification] += 1;
        if (actualReaderConsulted) totals.cumulative.actualReaderConsulted += 1;
        if (readerOutputChanged) totals.cumulative.readerOutputChanged += 1;
        if (selectedActionChanged) totals.cumulative.selectedActionChanged += 1;
        if (physicalActionChanged) totals.cumulative.physicalActionChanged += 1;
        if (receiptOrSupportChanged) {
          totals.cumulative.receiptOrSupportChanged += 1;
        }
        if (demographyChanged) totals.cumulative.demographyChanged += 1;

        const firstPhysicalDifference = [
          ["movement", actionDifferences.movement],
          ["camp", actionDifferences.camp],
          ["resource", actionDifferences.resource],
          ["fission", actionDifferences.fission],
        ]
          .filter(
            ([family, difference]) =>
              difference !== null &&
              physicalDifferenceByFamily[family],
          )
          .sort(
            (left, right) =>
              left[1].day - right[1].day ||
              left[0].localeCompare(right[0]),
          )[0]?.[1];
        const firstPhysicalAction =
          firstPhysicalDifference?.control[0] ??
          firstPhysicalDifference?.counterfactual[0];
        const firstPhysicalActionId =
          firstPhysicalAction?.activityActionId ??
          firstPhysicalAction?.decisionId ??
          firstPhysicalAction?.campActionId ??
          firstPhysicalAction?.fissionActionId;
        const firstChangedReaderComparison = readerComparisons.find(
          (comparison) =>
            comparison.outputChanged ||
            comparison.selectedOutputChanged,
        );
        const firstOutputChangedReaderComparison =
          readerComparisons.find(
            (comparison) => comparison.outputChanged,
          );
        const firstSelectedChangedReaderComparison =
          readerComparisons.find(
            (comparison) => comparison.selectedOutputChanged,
          );
        const actionReaderComparison =
          firstPhysicalActionId === undefined
            ? undefined
            : readerComparisons.find(
                (comparison) =>
                  comparison.control.selectedActionId ===
                    firstPhysicalActionId ||
                  comparison.counterfactual?.selectedActionId ===
                    firstPhysicalActionId,
              );
        const firstComparisonByFamily = new Set();
        const retainedReaderComparisons = readerComparisons.filter(
          (comparison, index) => {
            const family = comparison.control.readerFamily;
            const firstForFamily = !firstComparisonByFamily.has(family);
            firstComparisonByFamily.add(family);
            return (
              index === 0 ||
              firstForFamily ||
              comparison === firstOutputChangedReaderComparison ||
              comparison === firstSelectedChangedReaderComparison ||
              comparison === actionReaderComparison
            );
          },
        );

        rows.push({
          scenario: scenario.name,
          seed,
          ...event,
          bins: selection.bins,
          selectionReasons: selection.selectionReasons,
          followedToDay,
          controlSound: true,
          soundThroughDay,
          storedRecordChanged,
          recordPresenceChanged,
          counterfactualStoredRecordFingerprint:
            counterfactualWriterEvent?.afterRecordFingerprint ?? null,
          independentVerificationPreserved:
            verificationDifferenceIndex === null,
          preexistingVerificationEvidenceForTileCount:
            preexistingVerificationEvidenceForTile.length,
          independentVerificationEvidenceNamingTilePreserved:
            preexistingVerificationEvidenceForTile.length > 0 &&
            verificationDifferenceIndex === null,
          firstVerificationDifferenceDay:
            verificationDifferenceIndex === null
              ? null
              : event.returnDay + verificationDifferenceIndex,
          preexistingResidentialCorridorCount: Object.keys(
            checkpoint.bands[event.bandId]?.travelCorridors ?? {},
          ).length,
          preservedPreexistingResidentialCorridorIds:
            preservedPreexistingCorridorIds,
          existingResidentialCorridorsPreservedThroughFirstMovementDifference:
            preservedPreexistingCorridorIds.length ===
            control.preexistingCorridorIds.length,
          firstResidentialCorridorDifferenceDay:
            corridorDifferenceIndex === null
              ? null
              : event.returnDay + corridorDifferenceIndex,
          firstDownstreamDivergenceDay: firstDownstreamCheckpointDay,
          finalDownstreamDifferencePaths,
          firstReader:
            controlReader === undefined
              ? null
              : {
                  readerFamily: controlReader.readerFamily,
                  productionFunction: controlReader.productionFunction,
                  invocationDay: controlReader.invocationDay,
                  consultationRole:
                    controlReader.consultationRoles[event.recordEventId] ??
                    "record_consulted",
                },
          readerOutput: {
            control:
              controlReader === undefined
                ? null
                : {
                    verdict: controlReader.readerVerdict,
                    ranking: controlReader.readerRanking,
                    selectedActionId: controlReader.selectedActionId ?? null,
                    selectedActionKind:
                      controlReader.selectedActionKind ?? null,
                    selectedTarget: controlReader.selectedTarget ?? null,
                  },
            counterfactual:
              counterfactualReader === undefined
                ? null
                : {
                    verdict: counterfactualReader.readerVerdict,
                    ranking: counterfactualReader.readerRanking,
                    selectedActionId:
                      counterfactualReader.selectedActionId ?? null,
                    selectedActionKind:
                      counterfactualReader.selectedActionKind ?? null,
                    selectedTarget:
                      counterfactualReader.selectedTarget ?? null,
                  },
          },
          firstChangedReader:
            firstChangedReaderComparison === undefined
              ? null
              : compactReaderComparison(
                  firstChangedReaderComparison,
                  event.recordEventId,
                ),
          actionReader:
            actionReaderComparison === undefined
              ? null
              : compactReaderComparison(
                  actionReaderComparison,
                  event.recordEventId,
                ),
          readerChain: retainedReaderComparisons.map((comparison) =>
            compactReaderComparison(
              comparison,
              event.recordEventId,
            ),
          ),
          firstDecisionDivergenceDay:
            decisionDifferenceIndex === null
              ? null
              : event.returnDay + decisionDifferenceIndex,
          actionDifferences,
          actionId: firstPhysicalActionId ?? null,
          actionKind:
            firstPhysicalAction?.activityKind ??
            firstPhysicalAction?.actionKind ??
            firstPhysicalAction?.campActionKind ??
            (firstPhysicalAction?.daughterActuallyCreated
              ? "daughter_created"
              : null),
          target:
            firstPhysicalAction?.selectedTileId ??
            firstPhysicalAction?.targetTileId ??
            firstPhysicalAction?.selectedTargetTileId ??
            null,
          workers: firstPhysicalAction?.workers ?? null,
          route: firstPhysicalAction?.route ?? null,
          physicalOutcomeId:
            firstPhysicalAction?.physicalOutcomeId ??
            firstPhysicalAction?.movementRecordId ??
            firstPhysicalAction?.campRecordId ??
            firstPhysicalAction?.fissionActionId ??
            null,
          receiptDifference,
          supportDifference:
            receiptDifference === null
              ? null
              : {
                  day: receiptDifference.day,
                  control:
                    receiptDifference.control?.totalSupport ?? null,
                  counterfactual:
                    receiptDifference.counterfactual?.totalSupport ?? null,
                },
          demographyDifference,
          typedPhysicalMechanism:
            receiptOrSupportChanged || physicalActionChanged
              ? classifyPhysicalMechanism(actionDifferences)
              : null,
          cumulative: {
            actualReaderConsulted,
            readerOutputChanged,
            selectedActionChanged,
            physicalActionChanged,
            receiptOrSupportChanged,
            demographyChanged,
          },
          classification,
        });
      }

      console.log(
        `${scenario.name.padEnd(20)} ${seed} records=${String(
          baseline.causal.recordEvents.length,
        ).padStart(5)} samples=${String(sample.selected.length).padStart(2)} ` +
          `missing=${String(sample.missing.length).padStart(2)}`,
      );
    }

    perScenario[scenario.name] = scenarioTotals;
  }

  const result = {
    instrument: "ACTUAL PRODUCTION READER / DAILY PHYSICAL-ACTION WRITER REPLAY",
    note:
      "One exact return write is suppressed. Readers are observed only at production call sites; no audit-scheduled reader invocation occurs. The intentionally different tile record is excluded from downstream-state comparison.",
    years: YEARS,
    followDays: FOLLOW_DAYS,
    bins: BINS,
    seeds: SEEDS,
    scenarios: SCENARIOS.map((scenario) => scenario.name),
    deterministicSelection:
      INCLUDE_READER_SAMPLES
        ? "per bin: first new, first refresh, first actually consulted by each reader family"
        : "historical 40-year sample: first new and first refresh per scenario/seed",
    structuralNoReader: {
      readerFamily: "route_corridor",
      finding:
        "Exploration-returned KnownTileRecord has no production route/corridor reader; corridors are written from executed residential movement records.",
    },
    totals,
    perScenario,
    missingSamples,
    receiptSupportDivergenceTraces: rows.filter(
      (row) =>
        row.classification === "RECEIPT_OR_SUPPORT_CHANGED" ||
        row.classification === "DEMOGRAPHY_CHANGED",
    ),
    rows,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);

  console.log("");
  console.log(`replay events             : ${totals.events}`);
  console.log(`control SOUND             : ${totals.sound}`);
  console.log(`control UNSOUND           : ${totals.unsound}`);
  for (const classification of CLASSES) {
    console.log(
      `  ${classification.padEnd(44)} ${totals.byClass[classification]}`,
    );
  }
  console.log(`missing deterministic samples: ${missingSamples.length}`);
  console.log(`wrote ${OUT}`);
} finally {
  await server.close();
}
