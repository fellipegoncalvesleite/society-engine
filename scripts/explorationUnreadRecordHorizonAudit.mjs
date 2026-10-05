// CORRECTION-24D — does any retained exploration record survive an active follow
// horizon without being consulted?
//
// CORRECTION-24C's B1 replayed only the return day and concluded from
// `actualReaderEventsOnWriterDay === 0` that the record was "genuinely unread".
// That is a claim about one day, not about a horizon. This script searches for a
// record that is genuinely never consulted while its band stays alive and keeps
// taking ordinary decisions, over a follow window of at least 720 days.
//
// Production runs normally. Nothing is suppressed, no band is killed, no reader is
// disabled, no record is deleted after writing, and no reader is invoked by this
// script — reader events come only from the real call sites instrumented in src/sim.
//
// Usage:
//   node scripts/explorationUnreadRecordHorizonAudit.mjs
//   node scripts/explorationUnreadRecordHorizonAudit.mjs --years 40 --follow 720

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

const YEARS = Number(arg("years", "40"));
const TOTAL_DAYS = YEARS * 360;
const FOLLOW_DAYS = Number(arg("follow", "720"));
const SEEDS = arg("seeds", "s1,s2,s3,s4,s5").split(",").filter(Boolean);
const SEED_PREFIX = arg("seed-prefix", "c24a:chain");
const OUT = arg(
  "out",
  "docs/evidence/correction24c/unread-record-horizon.json",
);

// The same eleven physical worlds the natural matrices use, so this search runs
// over the population the B1 claim was made about.
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
  { name: "isolated_marginal", map: "map2", site: "tile:16:34" },
  { name: "hostile", map: "map2", site: "tile:45:120" },
];

const requestedScenarios = arg("scenarios", "");
const SCENARIOS =
  requestedScenarios === ""
    ? ALL_SCENARIOS
    : ALL_SCENARIOS.filter((scenario) =>
        requestedScenarios.split(",").includes(scenario.name),
      );

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c24d-unread-${process.pid}`,
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

  /** Builds one deterministic production world, exactly as the replay matrices do. */
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

  const rows = [];
  const totals = {
    recordsWritten: 0,
    recordsFullyFollowed: 0,
    recordsNeverConsulted: 0,
    recordsFirstReadAfterFollowHorizon: 0,
    recordsStillRetainedAtFollowEnd: 0,
  };
  let maxDelay = -1;
  let minDelay = Number.POSITIVE_INFINITY;
  const delayHistogram = {};
  const firstReaderFunctions = {};

  for (const scenario of SCENARIOS) {
    for (const seed of SEEDS) {
      diag.clearExplorationCausalAudit();
      diag.setExplorationCausalAuditRecording(true);

      let world = buildWorld(scenario, seed);
      world = advance.advanceWorldByDays(world, TOTAL_DAYS);

      const causal = diag.getExplorationCausalAuditSnapshot();
      diag.setExplorationCausalAuditRecording(false);

      // First actual consultation per record identity. Reader events exist only
      // where a production function dereferenced that exact canonical record.
      const firstReadByRecord = new Map();

      for (const event of causal.readerEvents) {
        const current = firstReadByRecord.get(event.recordEventId);

        if (current === undefined || event.invocationDay < current.invocationDay) {
          firstReadByRecord.set(event.recordEventId, event);
        }
      }

      // Reader cycles that actually ran, so an "unread" record cannot be explained
      // by a world in which nothing ever reads anything.
      const invocationDays = causal.readerInvocations.map(
        (invocation) => invocation.invocationDay,
      );
      const liveBandIds = new Set(
        Object.values(world.bands ?? {})
          .filter((band) => band.lifecycle?.status === undefined
            || !["extinct", "dispersed", "absorbed"].includes(
              String(band.lifecycle?.status),
            ))
          .map((band) => String(band.id)),
      );

      for (const record of causal.recordEvents) {
        if (record.writeSuppressed) {
          continue;
        }

        totals.recordsWritten += 1;

        const followEnd = record.returnDay + FOLLOW_DAYS;
        const fullyFollowed = followEnd <= TOTAL_DAYS;

        if (!fullyFollowed) {
          continue;
        }

        totals.recordsFullyFollowed += 1;

        const first = firstReadByRecord.get(record.recordEventId);
        const band = world.bands?.[record.bandId];
        const stillRetained =
          band?.knowledge?.observedTiles?.[record.tileId] !== undefined;

        if (stillRetained) {
          totals.recordsStillRetainedAtFollowEnd += 1;
        }

        // Reader opportunities inside this record's own follow window.
        const opportunitiesInWindow = invocationDays.filter(
          (day) => day >= record.returnDay && day <= followEnd,
        ).length;

        if (first === undefined) {
          totals.recordsNeverConsulted += 1;
          rows.push({
            outcome: "NEVER_CONSULTED",
            scenario: scenario.name,
            seed,
            recordEventId: record.recordEventId,
            bandId: record.bandId,
            tileId: record.tileId,
            returnDay: record.returnDay,
            followedToDay: followEnd,
            newOrRefreshed: record.newOrRefreshed,
            stillRetainedAtFollowEnd: stillRetained,
            bandAliveAtEnd: liveBandIds.has(String(record.bandId)),
            readerOpportunitiesInWindow: opportunitiesInWindow,
            exactConsultations: 0,
          });
          continue;
        }

        const delay = first.invocationDay - record.returnDay;

        if (delay > FOLLOW_DAYS) {
          totals.recordsFirstReadAfterFollowHorizon += 1;
          rows.push({
            outcome: "FIRST_READ_AFTER_FOLLOW_HORIZON",
            scenario: scenario.name,
            seed,
            recordEventId: record.recordEventId,
            returnDay: record.returnDay,
            followedToDay: followEnd,
            firstReadDay: first.invocationDay,
            delayDays: delay,
          });
          continue;
        }

        maxDelay = Math.max(maxDelay, delay);
        minDelay = Math.min(minDelay, delay);

        const bucket =
          delay <= 30 ? "0-30" : delay <= 60 ? "31-60" : delay <= 90 ? "61-90" : ">90";
        delayHistogram[bucket] = (delayHistogram[bucket] ?? 0) + 1;
        firstReaderFunctions[first.productionFunction] =
          (firstReaderFunctions[first.productionFunction] ?? 0) + 1;
      }

      console.log(
        `${scenario.name.padEnd(20)} ${seed} records=${String(
          causal.recordEvents.length,
        ).padStart(5)} followed=${String(totals.recordsFullyFollowed).padStart(
          5,
        )} neverRead=${totals.recordsNeverConsulted}`,
      );
    }
  }

  const verdict =
    totals.recordsNeverConsulted === 0 &&
    totals.recordsFirstReadAfterFollowHorizon === 0
      ? "NO_UNREAD_RECORD_EXISTS"
      : "UNREAD_RECORD_FOUND";

  const document = {
    instrument: "CORRECTION-24D — RETAINED-RECORD UNREAD HORIZON SEARCH",
    note:
      "Production runs normally. Nothing is suppressed or deleted, no band is " +
      "killed, no reader is disabled, and this script never invokes a reader.",
    years: YEARS,
    followDays: FOLLOW_DAYS,
    scenarios: SCENARIOS.map((scenario) => scenario.name),
    seeds: SEEDS,
    seasonLengthDays: 90,
    totals,
    firstConsultationDelayDays: {
      min: minDelay === Number.POSITIVE_INFINITY ? null : minDelay,
      max: maxDelay === -1 ? null : maxDelay,
      histogram: delayHistogram,
      exceedingSeasonLength: delayHistogram[">90"] ?? 0,
    },
    firstReaderFunctions,
    unreadCandidates: rows,
    verdict,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(document, null, 2)}\n`, "utf8");

  console.log("");
  console.log(`records written            : ${totals.recordsWritten}`);
  console.log(`fully followed ${FOLLOW_DAYS}d      : ${totals.recordsFullyFollowed}`);
  console.log(`never consulted            : ${totals.recordsNeverConsulted}`);
  console.log(
    `first read after horizon   : ${totals.recordsFirstReadAfterFollowHorizon}`,
  );
  console.log(
    `first-consultation delay   : min ${minDelay} max ${maxDelay} (season = 90)`,
  );
  console.log(`verdict                    : ${verdict}`);
  console.log(`wrote ${OUT}`);
} finally {
  await server.close();
}
