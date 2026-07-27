// CORRECTION-23D §5/§12 — RETENTION INVENTORY AND THE EXACT REPEAT SEQUENCE.
//
// §5 first: for every structure that retains verification state, report its key, cap,
// eviction policy, authority, readers, and whether eviction can reopen behaviour.
//
// Then the measurement that matters: step production a day at a time and, for every
// verification party raised, look up the band's OWN prior state and classify WHY the retry
// became eligible. That decomposition is what identifies the cause of the measured 648
// repeats — rather than inferring it from the code.
//
// Usage: node scripts/verificationRetryRetentionAudit.mjs [--years 150] [--map map2]
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt;
};

const MAP = arg("map", "map2");
const YEARS = Number(arg("years", "150"));
const SEED = arg("seed", "c23d:retention");
const OUT = arg("out", `docs/evidence/correction23d/retention-${MAP}.json`);

const INVENTORY = [
  {
    structure: "Band.frontierVerificationAttempts",
    key: "append-ordered list of (tile, question, tick, season, outcome)",
    cap: 12,
    eviction: "oldest-first ring (slice(-12))",
    authority: "UI / chronological history ONLY since CORRECTION-23B",
    readers: "placeEvidenceProjection (display)",
    evictionCanReopen: false,
    repeatsConsumeCapacity: true,
    growsWith: "attempts (bounded by the ring)",
  },
  {
    structure: "Band.verificationEvidence",
    key: "(tileId, question), UPSERTED",
    cap: 48,
    eviction: "oldest lastTick evicted once 48 distinct pairs exist",
    authority: "AUTHORITATIVE for domain readers and, before 23D, for retry",
    readers: "isWaterAccessFeasible, deriveDirectWaterAccess, taskCampRefusedByEvidence, resourceTestEligible, mayAskAgain",
    evictionCanReopen: true,
    repeatsConsumeCapacity: false,
    growsWith: "distinct attempted (place, question) pairs — capped at 48",
  },
  {
    structure: "KnownTileRecord (knowledge.observedTiles)",
    key: "tileId",
    cap: "none in this subsystem — inherited mandatory-retention debt",
    eviction: "not evicted by verification; memoryCompression governs it",
    authority: "AUTHORITATIVE place knowledge",
    readers: "the whole decision layer",
    evictionCanReopen: true,
    repeatsConsumeCapacity: false,
    growsWith: "known places",
  },
  {
    structure: "expedition active-task guard",
    key: "band + taskKind",
    cap: 1,
    eviction: "n/a — cleared on terminal phase",
    authority: "concurrency only",
    readers: "maybeLaunchFrontierVerification",
    evictionCanReopen: false,
    repeatsConsumeCapacity: false,
    growsWith: "nothing",
  },
];

const r2 = (v) => (v === undefined || v === null ? null : Math.round(v * 100) / 100);

const server = await createServer({
  root: `${process.cwd()}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const verification = await server.ssrLoadModule("/sim/agents/frontierVerification.ts");

  let world = runner.initSimWorld({ kind: MAP }, SEED);

  // Why did this retry become eligible? Classified from the band's own prior state, using
  // exactly the conditions the production gate consults.
  const reasons = {
    never_asked: 0,
    place_forgotten_at_launch: 0,
    place_relearned_after_forgetting: 0,
    hardship_moved: 0,
    season_changed_not_new: 0,
    season_genuinely_new: 0,
    route_moved: 0,
    inconclusive_interval: 0,
    unclassified: 0,
  };
  const pairAttempts = new Map();
  let launches = 0;
  let evidenceCapPressureBandDays = 0;
  let bandDays = 0;

  const days = YEARS * 360;

  for (let d = 0; d < days; d += 1) {
    const before = world;
    world = runner.stepSim(world, 1, "daily");

    for (const band of Object.values(world.bands)) {
      if (band.viability?.status === "extinct") continue;
      bandDays += 1;
      if ((band.verificationEvidence ?? []).length >= 48) evidenceCapPressureBandDays += 1;

      for (const expedition of band.expeditions ?? []) {
        if (expedition.taskKind !== "frontier_verification") continue;
        if (expedition.phase !== "prepared" && expedition.phase !== "outbound") continue;

        const key = `${band.id}|${expedition.verificationPlan?.targetTileId}|${expedition.verificationPlan?.question}`;
        const seen = pairAttempts.get(key);
        if (seen !== undefined && seen.lastSeenDay === d - 1) {
          pairAttempts.set(key, { ...seen, lastSeenDay: d });
          continue;
        }

        launches += 1;
        pairAttempts.set(key, { count: (seen?.count ?? 0) + 1, lastSeenDay: d });

        const prior = before.bands[band.id];
        const question = expedition.verificationPlan?.question;
        const tileId = expedition.verificationPlan?.targetTileId;
        // CORRECTION-23D — the AUTHORITY is the place record. Reading the bounded
        // chronological collection here would misclassify a retained conclusion as evicted.
        const durable = prior?.knowledge?.observedTiles?.[tileId]?.verificationDisposition?.find(
          (e) => e.question === question,
        );
        const row =
          durable === undefined
            ? undefined
            : {
                seasonsAnswered: durable.seasonsAnswered,
                lastSeason: durable.lastSeason,
                lastTick: durable.lastTick,
                outcome: durable.outcome,
                attempts: durable.attempts,
                hardshipAtLastAttempt: 0,
                routeTilesAtLastAttempt: durable.routeTilesAtLastAttempt,
              };

        if (seen === undefined && row === undefined) {
          reasons.never_asked += 1;
          continue;
        }

        if (seen !== undefined && row === undefined) {
          // §9 — the DISTINCTION that decides whether this reopening is legitimate.
          // Place record gone  => the band genuinely forgot the place. Legitimate.
          // Place record present but no disposition => something is still DROPPING it.
          // A dedicated lifetime probe settled what this split cannot see from a single
          // frame: of 598 dispositions that disappeared over 25 years, 598 lost the PLACE
          // RECORD too and 0 kept the record while losing the disposition. So a record that
          // is present here without a disposition is a place the band FORGOT and has since
          // RE-LEARNED as new country — §9's one legitimate reopening path — not a writer
          // dropping the field. Median disposition lifetime: 282 days, governed by
          // memoryCompression's eviction of observedTiles, which is inherited debt.
          if (prior?.knowledge?.observedTiles?.[tileId] === undefined) {
            reasons.place_forgotten_at_launch += 1;
          } else {
            reasons.place_relearned_after_forgetting += 1;
          }
          continue;
        }

        const need = verification.deriveVerificationNeed(prior);
        const season = before.time.season;
        const seasonNew = !row.seasonsAnswered.includes(season);
        const seasonChanged = row.lastSeason !== season;
        const hardshipMoved = false; // §8 — hardship no longer invalidates
        const routeMoved =
          Math.abs((expedition.routeTileIds?.length ?? 0) - row.routeTilesAtLastAttempt) >= 4;

        if (row.outcome === "inconclusive") reasons.inconclusive_interval += 1;
        else if (seasonNew) reasons.season_genuinely_new += 1;
        else if (seasonChanged && (question === "water_access" || question === "resource_presence"))
          reasons.season_changed_not_new += 1;
        else if (routeMoved) reasons.route_moved += 1;
        else if (hardshipMoved) reasons.hardship_moved += 1;
        else reasons.unclassified += 1;
      }
    }
  }

  const counts = [...pairAttempts.values()].map((v) => v.count);
  const repeats = counts.filter((c) => c > 1).length;

  const result = {
    map: MAP,
    years: YEARS,
    seed: SEED,
    bandDays,
    launches,
    distinctPairs: counts.length,
    pairsAttemptedMoreThanOnce: repeats,
    maxAttemptsOnOnePair: counts.length === 0 ? 0 : Math.max(...counts),
    medianAttemptsPerPair: counts.length === 0 ? 0 : counts.sort((a, b) => a - b)[Math.floor(counts.length / 2)],
    evidenceCapPressureBandDayShare: r2((evidenceCapPressureBandDays / Math.max(1, bandDays)) * 100),
    retryEligibilityReasons: reasons,
    inventory: INVENTORY,
  };

  console.log("\n=== §5 RETENTION INVENTORY ===\n");
  for (const row of INVENTORY) {
    console.log(`${row.structure}`);
    console.log(`    key                 : ${row.key}`);
    console.log(`    cap / eviction      : ${row.cap} / ${row.eviction}`);
    console.log(`    authority           : ${row.authority}`);
    console.log(`    eviction can reopen : ${row.evictionCanReopen}`);
    console.log(`    grows with          : ${row.growsWith}`);
  }

  console.log(`\n=== WHY RETRIES BECAME ELIGIBLE (${MAP}, ${YEARS}y) ===`);
  console.log(JSON.stringify(result.retryEligibilityReasons, null, 2));
  console.log(
    `\nlaunches ${launches}  distinct pairs ${result.distinctPairs}  repeated ${repeats}  ` +
      `max on one pair ${result.maxAttemptsOnOnePair}  evidence-cap pressure ${result.evidenceCapPressureBandDayShare}% of band-days`,
  );

  mkdirSync(OUT.slice(0, OUT.lastIndexOf("/")), { recursive: true });
  writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log(`\nwrote ${OUT}`);
} finally {
  await server.close();
}
