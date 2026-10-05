// CORRECTION-23E §8/§9/§11 — PLACE-RECORD LIFETIME BY EVIDENCE CLASS, IN VERIFIED UNITS.
//
// CORRECTION-23D reported a "median disposition lifetime of 282 days" and used it to argue
// that verification repetition cannot plateau while places churn. §9 requires that number to
// be re-derived in units that are actually verified against the simulation clock, and §8
// requires the whole DISTRIBUTION, per evidence class — because "one retention contract fits
// all evidence" is exactly the assumption under test.
//
// THE CLOCK (read from src/sim/core/types.ts and src/sim/tick/time.ts, then asserted below):
//
//   SEASON_LENGTH_DAYS = 90      SEASONS_PER_YEAR = 4      DAYS_PER_YEAR = 360
//   world.time.tick   is a SEASON tick    -> 1 tick  = 90 days
//   world.time.day    is a calendar day   -> 1 day   = 1/90 tick
//   memoryCompression runs on `tick % 4 === 0`, i.e. once per simulated YEAR.
//
// This loop steps ONE DAY per iteration, so a lifetime counted in iterations is in DAYS.
// Every figure below is reported in days AND ticks AND seasons AND years, so no reader has to
// guess which one a bare number meant.
//
// Usage: node scripts/placeRecordLifetimeAudit.mjs [--years 60] [--map map2] [--fixture marginal]
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt;
};

const MAP = arg("map", "map2");
const YEARS = Number(arg("years", "60"));
const FIXTURE = arg("fixture", "marginal");
const SITE = arg("site", "tile:204:72");
const SEED = arg("seed", "c23e:lifetime");
const ARM = arg("arm", "K0");
const OUT = arg("out", `docs/evidence/correction23e/place-lifetime-${ARM}.json`);

const ARM_OPTIONS = {
  K0: undefined,
  K1: { placeRetentionArm: "protect_settled_verification" },
  K2: { placeRetentionArm: "protect_actionable_verified" },
  K3: { placeRetentionArm: "protect_active_route_verified" },
  K4: { placeRetentionArm: "capacity_only", placeRetentionCapacity: 288 },
  K5: { placeRetentionArm: "no_inherited_mandatory" },
};

const CLASSES = [
  "traversed_only",
  "frontier_exploration",
  "verification_target",
  "confirmed_water_access",
  "negative_verification",
  "resource_presence",
  "temporary_use",
  "residentially_experienced",
  "active_route",
  "current_candidate",
  "recently_used_production_window",
  "used_within_one_year",
  "inherited_or_reported",
];

const quantile = (sorted, p) =>
  sorted.length === 0 ? null : sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))];

const distribution = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    n: sorted.length,
    min: quantile(sorted, 0),
    q1: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    q3: quantile(sorted, 0.75),
    p90: quantile(sorted, 0.9),
    max: quantile(sorted, 1),
  };
};

const inUnits = (days) =>
  days === null
    ? null
    : {
        days,
        ticks: Math.round((days / 90) * 100) / 100,
        seasons: Math.round((days / 90) * 100) / 100,
        years: Math.round((days / 360) * 100) / 100,
      };

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
  const core = await server.ssrLoadModule("/sim/core/types.ts");
  const compression = await server.ssrLoadModule("/sim/agents/memoryCompression.ts");

  // ── §9 — VERIFY THE CLOCK, do not assume it. ─────────────────────────────────────────
  let world = runner.initSimWorld({ kind: MAP }, SEED);
  const timeAtStart = { ...world.time };
  const afterOneDay = runner.stepSim(world, 1, "daily").time;
  const afterNinetyDays = runner.stepSim(world, 90, "daily").time;

  const clock = {
    SEASON_LENGTH_DAYS: core.SEASON_LENGTH_DAYS,
    SEASONS_PER_YEAR: core.SEASONS_PER_YEAR,
    DAYS_PER_YEAR: core.DAYS_PER_YEAR,
    conversionFunction: "getWorldTimeForDay(day): tick = floor(day / SEASON_LENGTH_DAYS)",
    startDay: Number(timeAtStart.day),
    startTick: Number(timeAtStart.tick),
    dayAfterOneDailyStep: Number(afterOneDay.day),
    tickAfterOneDailyStep: Number(afterOneDay.tick),
    dayAfter90DailySteps: Number(afterNinetyDays.day),
    tickAfter90DailySteps: Number(afterNinetyDays.tick),
    oneLoopIterationIs: "one calendar DAY",
    oneTickIs: `${core.SEASON_LENGTH_DAYS} days = 1 season`,
    compressionCadence: "compressBandMemoryState runs when tick % 4 === 0 → once per simulated YEAR",
  };
  clock.dailyStepAdvancesOneDay = clock.dayAfterOneDailyStep - clock.startDay === 1;
  clock.ninetyDailyStepsAdvanceOneTick = clock.tickAfter90DailySteps - clock.startTick === 1;

  if (FIXTURE === "marginal") {
    world = spawn.removeInitialBands(world, Object.keys(world.bands));
    world = spawn.spawnCustomBands(world, [{ tileId: SITE, population: 34, name: "marginal_escapable" }], SEED);
  } else {
    world = runner.initSimWorld({ kind: MAP }, SEED);
  }

  const options = ARM_OPTIONS[ARM];
  if (options !== undefined) world = { ...world, auditOptions: options };

  // ── tracking ─────────────────────────────────────────────────────────────────────────
  const open = new Map(); // band|tile -> { firstDay, classes:Set, lastSeen }
  const everSeenByClass = new Map();
  const closed = []; // completed lifetimes
  const reacquisition = new Map(); // band|tile -> { evictedDay, hadDisposition, questions:Set }
  const reacquired = [];
  const repeatedAfterReacquisition = [];
  let compressionEvents = 0;
  const lastCompressionTick = new Map();
  let overCapBandTicks = 0;
  let bandTicks = 0;
  let mandatoryShareSum = 0;
  let mandatoryShareN = 0;
  let lowValueDisplacedVerified = 0;
  let verifiedBelowCutoff = 0;

  const isLiving = (band) =>
    band.viability?.status !== "extinct" &&
    band.viability?.status !== "absorbed" &&
    band.viability?.status !== "dispersed" &&
    (band.demography?.population ?? 0) > 0;

  const classify = (world, band, record, activeRouteTiles, candidateTiles) => {
    const classes = new Set();
    const disposition = record.verificationDisposition ?? [];

    if (disposition.length > 0) classes.add("verification_target");
    for (const entry of disposition) {
      if (entry.question === "water_access" && entry.outcome === "confirmed") {
        classes.add("confirmed_water_access");
      }
      if (entry.outcome === "negative") classes.add("negative_verification");
      if (entry.question === "resource_presence") classes.add("resource_presence");
      if (entry.question === "temporary_use") classes.add("temporary_use");
    }

    if (record.acquisition === "returned_frontier_exploration") classes.add("frontier_exploration");
    if (record.knowledgeSource !== undefined && record.knowledgeSource !== "personally_observed") {
      classes.add("inherited_or_reported");
    }
    if (activeRouteTiles.has(record.tileId)) classes.add("active_route");
    if (candidateTiles.has(record.tileId)) classes.add("current_candidate");
    // The PRODUCTION recency window is RECENT_MEMORY_TICK_WINDOW = 96 TICKS = 96 seasons =
    // 24 YEARS. Against a median record lifetime under one year that window is satisfied by
    // almost every record, so it is reported but NOT used as the relevance test. The tight
    // window (4 ticks = 1 year) is the one that can actually discriminate.
    const ticksSinceUse = Number(world.time.tick) - Number(record.lastObservedAt.tick);
    if (ticksSinceUse <= 96) classes.add("recently_used_production_window");
    if (ticksSinceUse <= 4) classes.add("used_within_one_year");

    const memory = band.placeMemory?.[record.tileId];
    if ((memory?.visitCount ?? 0) >= 3 || record.visits >= 4) classes.add("residentially_experienced");
    if (classes.size === 0 || (disposition.length === 0 && record.visits <= 1)) {
      classes.add("traversed_only");
    }

    return classes;
  };

  const days = YEARS * 360;

  for (let d = 1; d <= days; d += 1) {
    world = runner.stepSim(world, 1, "daily");
    const isCompressionDay = Number(world.time.tick) % 4 === 0;

    for (const band of Object.values(world.bands)) {
      if (!isLiving(band)) continue;
      bandTicks += 1;

      const records = Object.values(band.knowledge?.observedTiles ?? {});
      const activeRouteTiles = new Set((band.expeditions ?? []).flatMap((e) => e.routeTileIds ?? []));
      const candidateTiles = new Set(
        band.carryingCapacity?.knownUnusedHabitat?.candidateTileId === undefined
          ? []
          : [band.carryingCapacity.knownUnusedHabitat.candidateTileId],
      );
      const present = new Set();

      if (records.length > 72) overCapBandTicks += 1;

      for (const record of records) {
        const key = `${band.id}|${record.tileId}`;
        present.add(key);
        const entry = open.get(key);
        const classes = classify(world, band, record, activeRouteTiles, candidateTiles);
        for (const className of classes) {
          if (!everSeenByClass.has(className)) everSeenByClass.set(className, new Set());
          everSeenByClass.get(className).add(key);
        }

        if (entry === undefined) {
          open.set(key, { firstDay: d, classes, lastSeen: d, lastRecord: record });
          const pending = reacquisition.get(key);
          if (pending !== undefined) {
            reacquired.push({
              key,
              gapDays: d - pending.evictedDay,
              hadDisposition: pending.hadDisposition,
              lostQuestions: [...pending.questions],
            });
            reacquisition.delete(key);
            reacquisition.set(key, { ...pending, reacquiredDay: d, watching: true, questions: pending.questions });
          }
        } else {
          entry.lastSeen = d;
          entry.classes = classes;
          entry.lastRecord = record;

          // §8 — repeated verification AFTER reacquisition, which is the behavioural cost of
          // having forgotten the place.
          const watch = reacquisition.get(key);
          if (watch?.watching === true) {
            for (const disposition of record.verificationDisposition ?? []) {
              if (watch.questions.includes(disposition.question)) {
                repeatedAfterReacquisition.push({
                  key,
                  question: disposition.question,
                  daysAfterReacquisition: d - watch.reacquiredDay,
                });
                watch.watching = false;
                break;
              }
            }
          }
        }
      }

      // ── evictions ─────────────────────────────────────────────────────────────────
      for (const [key, entry] of open) {
        if (!key.startsWith(`${band.id}|`) || present.has(key)) continue;

        const record = entry.lastRecord;
        const disposition = record.verificationDisposition ?? [];
        closed.push({
          key,
          lifetimeDays: entry.lastSeen - entry.firstDay,
          classes: [...entry.classes],
          hadSettledDisposition: disposition.some(
            (row) => row.outcome === "confirmed" || row.outcome === "negative",
          ),
          behaviourallyRelevantAtEviction:
            entry.classes.has("active_route") ||
            entry.classes.has("current_candidate") ||
            entry.classes.has("used_within_one_year"),
          evictionCause: isCompressionDay ? "memory_compression" : "other",
        });
        open.delete(key);
        reacquisition.set(key, {
          evictedDay: d,
          hadDisposition: disposition.length > 0,
          questions: disposition.map((row) => row.question),
          watching: false,
        });

        if (disposition.length > 0 && entry.classes.has("used_within_one_year") === false) verifiedBelowCutoff += 1;
      }

      // ── §10 — retention authority, read through the production scorer ─────────────
      if (isCompressionDay && records.length > 72 && Number(world.time.tick) !== lastCompressionTick.get(band.id)) {
        lastCompressionTick.set(band.id, Number(world.time.tick));
        compressionEvents += 1;
        const view = compression.deriveKnownRetentionAuditView(world, band);
        mandatoryShareSum += view.mandatoryCount / Math.max(1, view.capacity);
        mandatoryShareN += 1;

        const droppedVerified = view.rows.filter(
          (row) => !row.retained && (row.verificationDispositionCount ?? 0) > 0,
        );
        const keptLowValue = view.rows.filter(
          (row) => row.retained && !row.mandatory && row.visits <= 1 && (row.verificationDispositionCount ?? 0) === 0,
        );
        if (droppedVerified.length > 0 && keptLowValue.length > 0) {
          lowValueDisplacedVerified += Math.min(droppedVerified.length, keptLowValue.length);
        }
      }
    }
  }

  // Records still alive at the end are RIGHT-CENSORED and must not be mixed into the
  // completed-lifetime distribution; they are reported separately.
  const censored = [...open.values()].map((entry) => days - entry.firstDay);

  const byClass = {};
  for (const className of CLASSES) {
    const rows = closed.filter((row) => row.classes.includes(className));
    const stats = distribution(rows.map((row) => row.lifetimeDays));
    byClass[className] = {
      recordsEverInClass: (everSeenByClass.get(className) ?? new Set()).size,
      evictions: rows.length,
      lifetimeDays: stats,
      lifetime: {
        min: inUnits(stats.min),
        q1: inUnits(stats.q1),
        median: inUnits(stats.median),
        q3: inUnits(stats.q3),
        p90: inUnits(stats.p90),
        max: inUnits(stats.max),
      },
      evictionCauses: rows.reduce((acc, row) => {
        acc[row.evictionCause] = (acc[row.evictionCause] ?? 0) + 1;
        return acc;
      }, {}),
      behaviourallyRelevantAtEviction: rows.filter((row) => row.behaviourallyRelevantAtEviction).length,
      settledDispositionLost: rows.filter((row) => row.hadSettledDisposition).length,
    };
  }

  const reacquiredWithDisposition = reacquired.filter((row) => row.hadDisposition);
  const result = {
    map: MAP,
    fixture: FIXTURE,
    arm: ARM,
    years: YEARS,
    clock,
    totals: {
      completedLifetimes: closed.length,
      stillAliveAtEnd: censored.length,
      censoredAgeDays: distribution(censored),
      bandTicks,
      overCapBandTickShare: Math.round((overCapBandTicks / Math.max(1, bandTicks)) * 1000) / 10,
      compressionEventsObserved: compressionEvents,
      meanMandatoryShareOfCapacity:
        mandatoryShareN === 0 ? null : Math.round((mandatoryShareSum / mandatoryShareN) * 1000) / 10,
      lowValueRecordDisplacedVerifiedPlace: lowValueDisplacedVerified,
      verifiedPlacesEvictedWhileNotRecentlyUsed: verifiedBelowCutoff,
    },
    allRecords: {
      lifetimeDays: distribution(closed.map((row) => row.lifetimeDays)),
      lifetime: inUnits(distribution(closed.map((row) => row.lifetimeDays)).median),
    },
    reacquisition: {
      evictedThenReacquired: reacquired.length,
      ofThoseCarryingADisposition: reacquiredWithDisposition.length,
      gapDays: distribution(reacquired.map((row) => row.gapDays)),
      gapDaysForVerifiedPlaces: distribution(reacquiredWithDisposition.map((row) => row.gapDays)),
      verificationQuestionsRepeatedAfterReacquisition: repeatedAfterReacquisition.length,
      daysToRepeatAfterReacquisition: distribution(
        repeatedAfterReacquisition.map((row) => row.daysAfterReacquisition),
      ),
    },
    byClass,
  };

  console.log("\n=== §9 CLOCK ===");
  console.log(JSON.stringify(clock, null, 2));
  console.log("\n=== §8 LIFETIME BY EVIDENCE CLASS (median) ===");
  for (const className of CLASSES) {
    const row = byClass[className];
    console.log(
      `${className.padEnd(30)} ever=${String(row.recordsEverInClass).padStart(5)} evicted=${String(row.evictions).padStart(5)}  median=${String(row.lifetimeDays.median ?? "-").padStart(5)}d  ` +
        `q1=${String(row.lifetimeDays.q1 ?? "-").padStart(5)}  q3=${String(row.lifetimeDays.q3 ?? "-").padStart(5)}  ` +
        `p90=${String(row.lifetimeDays.p90 ?? "-").padStart(5)}  relevant=${row.behaviourallyRelevantAtEviction}`,
    );
  }
  console.log("\n=== TOTALS ===");
  console.log(JSON.stringify(result.totals, null, 2));
  console.log(JSON.stringify(result.reacquisition, null, 2));

  mkdirSync(OUT.slice(0, OUT.lastIndexOf("/")), { recursive: true });
  writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log(`\nwrote ${OUT}`);
} finally {
  await server.close();
}
