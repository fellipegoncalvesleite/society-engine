// CORRECTION-23E §4/§5/§7 — RETRY-SUPPRESSION REGRESSION REPRODUCTION, COMPONENT ISOLATION
// AND EXPLORATION SUBSTITUTION.
//
// One script, three jobs, because they need the SAME instrumented run:
//
//   §4  reproduce the marginal regression on ten predeclared shared seeds, paired
//       R0 (76893be, run in a worktree) against R1 (6258c97, this tree);
//   §5  decompose R1 into its components with audit-only arms R2-R7;
//   §7  measure whether redundant verification was providing EXPLORATION rather than
//       verification — physical tiles walked, frontier tiles first observed, place records
//       refreshed and protected from eviction, and the party mix.
//
// Everything is observed DAILY. A verification party is raised, walks and returns inside a
// season, so season-boundary sampling cannot count launches, and the 12-entry attempt ring
// and 48-row evidence collection are both caps — neither is a cumulative counter. The only
// honest way to count a launch is to watch for it.
//
// R0 has none of the §5 audit options, so it is run by copying THIS FILE into the 76893be
// worktree and passing `--arms R1` there: the arm map sends both R0 and R1 to production
// behaviour, and the COMMIT is what distinguishes them.
//
// Usage:
//   node scripts/retryMediationMatrixAudit.mjs --arms R1,R2,R3,R4,R5,R6,R7 \
//        --seeds s1,...,s10 --years 150 --map map2 --site tile:204:72
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt;
};

const MAP = arg("map", "map2");
const SITE = arg("site", "tile:204:72");
const YEARS = Number(arg("years", "150"));
const SEEDS = arg("seeds", "s1,s2,s3,s4,s5,s6,s7,s8,s9,s10").split(",").filter(Boolean);
const ARMS = arg("arms", "R1").split(",").filter(Boolean);
const FOUNDER = Number(arg("founder-population", "34"));
const LABEL = arg("label", "marginal_escapable");
const OUT = arg("out", "docs/evidence/correction23e/mediation-matrix.json");
// The seed string must be IDENTICAL across arms and commits, so it is fixed here and never
// derived from the arm.
const SEED_PREFIX = arg("seed-prefix", "c23e:marginal_escapable");
const FIXTURE = arg("fixture", "controlled");

const ARM_OPTIONS = {
  // R0 (76893be, worktree) and R1 (6258c97, this tree) are BOTH production behaviour.
  R0: undefined,
  R1: undefined,
  R2: { verificationRetryArm: "legacy_eligibility" },
  R3: { verificationRetryArm: "hardship_reopens" },
  R4: { verificationRetryArm: "legacy_season_comparison" },
  R5: { verificationRetryArm: "suppression_disabled" },
  R6: { verificationPartyRouteObservationDisabled: true },
  R7: { explorationSchedulingIndependent: true },
  // §12 retention counterfactuals, measured through the same instrument.
  K0: undefined,
  K1: { placeRetentionArm: "protect_settled_verification" },
  K2: { placeRetentionArm: "protect_actionable_verified" },
  K3: { placeRetentionArm: "protect_active_route_verified" },
  K4: { placeRetentionArm: "capacity_only", placeRetentionCapacity: 288 },
  K5: { placeRetentionArm: "no_inherited_mandatory" },
};

const r2 = (v) => (v === undefined || v === null ? null : Math.round(v * 100) / 100);
const r4 = (v) => (v === undefined || v === null ? null : Math.round(v * 10000) / 10000);

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

  const isLiving = (band) =>
    band.viability?.status !== "extinct" &&
    band.viability?.status !== "absorbed" &&
    band.viability?.status !== "dispersed" &&
    (band.demography?.population ?? 0) > 0;

  const runOne = (arm, seed) => {
    let world = runner.initSimWorld({ kind: MAP }, `${SEED_PREFIX}:${seed}`);

    // CORRECTION-23E §15 — the default maps run their OWN founders, so the controlled
    // single-founder fixture must not be imposed on them.
    if (FIXTURE !== "default") {
      world = spawn.removeInitialBands(world, Object.keys(world.bands));
      world = spawn.spawnCustomBands(
        world,
        [{ tileId: SITE, population: FOUNDER, name: LABEL }],
        `${SEED_PREFIX}:${seed}`,
      );
    }

    const options = ARM_OPTIONS[arm];
    if (options !== undefined) world = { ...world, auditOptions: options };

    // ── cumulative, arm-comparable counters ────────────────────────────────────────────
    const seenExpeditions = new Set();
    const partyCounts = {};
    const verificationPairs = new Map(); // band|tile|question -> attempts
    const tilesVisited = new Set(); // physically stood on or walked through
    const tilesRepeated = new Set();
    const frontierTilesFirstObserved = new Set();
    const uniqueRoutes = new Set();
    const localResourceTrips = new Set();
    let foodTripDays = 0;
    let residentialMoves = 0;
    let placeEvictions = 0;
    let verifiedPlaceEvictions = 0;
    let placeRefreshes = 0;
    let receipts = 0;
    let births = 0;
    let deaths = 0;
    const churnYears = new Set();
    let supportSum = 0;
    let supportN = 0;
    let candidateSetSum = 0;
    let candidateSetN = 0;
    let knownUnusedConsidered = 0;
    let peakPopulation = 0;
    let peakKnownTiles = 0;
    let peakDispositionRows = 0;
    let extinctionYear = null;
    const trajectory = [];
    const residentialDestinations = new Set();

    // per-band tracking state
    const track = new Map();
    const trackOf = (band) => {
      let state = track.get(band.id);
      if (state === undefined) {
        state = {
          position: band.position,
          known: new Set(Object.keys(band.knowledge?.observedTiles ?? {})),
          verified: new Set(),
          lastObserved: new Map(),
          season: null,
        };
        track.set(band.id, state);
      }
      return state;
    };

    const days = YEARS * 360;
    let population = 0;

    for (let d = 1; d <= days; d += 1) {
      world = runner.stepSim(world, 1, "daily");

      const living = Object.values(world.bands).filter(isLiving);
      population = living.reduce((acc, b) => acc + (b.demography?.population ?? 0), 0);
      peakPopulation = Math.max(peakPopulation, population);

      for (const band of living) {
        const state = trackOf(band);

        // ── movement ────────────────────────────────────────────────────────────────
        if (band.position !== state.position) {
          residentialMoves += 1;
          residentialDestinations.add(String(band.position));
          state.position = band.position;
        }
        tilesVisited.add(String(band.position));

        // ── parties ─────────────────────────────────────────────────────────────────
        for (const expedition of band.expeditions ?? []) {
          if (!seenExpeditions.has(expedition.id)) {
            seenExpeditions.add(expedition.id);
            partyCounts[expedition.taskKind] = (partyCounts[expedition.taskKind] ?? 0) + 1;

            if (expedition.taskKind === "frontier_verification") {
              const plan = expedition.verificationPlan;
              const key = `${band.id}|${plan?.targetTileId}|${plan?.question}`;
              verificationPairs.set(key, (verificationPairs.get(key) ?? 0) + 1);
            }
          }

          const route = expedition.routeTileIds ?? [];
          if (route.length > 0) {
            uniqueRoutes.add(`${expedition.taskKind}|${route.join(">")}`);
            for (const tileId of route) {
              if (tilesVisited.has(String(tileId))) tilesRepeated.add(String(tileId));
              tilesVisited.add(String(tileId));
            }
          }
        }

        // ── same-day physical trips ─────────────────────────────────────────────────
        for (const trip of band.recentIntraSeasonTrips ?? []) {
          const key = `${band.id}|${String(trip.day)}|${String(trip.targetTileId)}|${trip.cause}`;
          if (localResourceTrips.has(key)) continue;
          localResourceTrips.add(key);
          if ((trip.physicalFoodHarvest?.usableSupport ?? 0) > 0) foodTripDays += 1;
        }

        // ── knowledge: refreshes, evictions, verified evictions ─────────────────────
        const records = band.knowledge?.observedTiles ?? {};
        const nowKnown = new Set(Object.keys(records));
        peakKnownTiles = Math.max(peakKnownTiles, nowKnown.size);

        for (const tileId of state.known) {
          if (nowKnown.has(tileId)) continue;
          placeEvictions += 1;
          if (state.verified.has(tileId)) verifiedPlaceEvictions += 1;
          state.verified.delete(tileId);
          state.lastObserved.delete(tileId);
        }

        let dispositionRows = 0;
        for (const [tileId, record] of Object.entries(records)) {
          const stamp = Number(record.lastObservedAt?.day ?? record.lastObservedAt?.tick ?? 0);
          const prior = state.lastObserved.get(tileId);
          if (prior !== undefined && stamp > prior) placeRefreshes += 1;
          state.lastObserved.set(tileId, stamp);

          if (record.acquisition === "returned_frontier_exploration") {
            frontierTilesFirstObserved.add(`${band.id}|${tileId}`);
          }

          const disposition = record.verificationDisposition ?? [];
          if (disposition.length > 0) {
            dispositionRows += disposition.length;
            state.verified.add(tileId);
          }
        }
        peakDispositionRows = Math.max(peakDispositionRows, dispositionRows);
        state.known = nowKnown;

        // ── destination evaluation (candidate set / opportunity) ────────────────────
        const opportunity = band.carryingCapacity?.knownUnusedHabitat;
        if (opportunity !== undefined) {
          candidateSetSum += opportunity.basis?.length ?? 0;
          candidateSetN += 1;
          if (opportunity.consideredAsTarget === true) knownUnusedConsidered += 1;
        }

        // ── §4 births and deaths, from the canonical per-year churn record ─────────
        for (const record of band.demography?.demographicChurn?.records ?? []) {
          const churnKey = `${band.id}|${record.year}`;
          if (churnYears.has(churnKey)) continue;
          churnYears.add(churnKey);
          births += record.births ?? 0;
          deaths += record.deaths ?? 0;
        }

        // ── season-boundary accumulators ────────────────────────────────────────────
        if (state.season !== world.time.season) {
          state.season = world.time.season;
          receipts += band.seasonalFoodReceipts?.totalUsableSupport ?? 0;
          const support = band.seasonalSupport?.currentSeasonSupport?.rawSupportRatio;
          if (support !== undefined) {
            supportSum += support;
            supportN += 1;
          }
        }
      }

      if (d % 360 === 0) {
        const year = d / 360;
        if (year % 10 === 0 || year <= 3) {
          trajectory.push({ year, population, bands: living.length });
        }
      }

      if (living.length === 0) {
        extinctionYear = Math.ceil(d / 360);
        break;
      }
    }

    const living = Object.values(world.bands).filter(isLiving);
    const finalPopulation = living.reduce((acc, b) => acc + (b.demography?.population ?? 0), 0);
    const attempts = [...verificationPairs.values()];
    // `growthAccumulator` / `mortalityAccumulator` retain only the FRACTIONAL remainder after
    // whole births and deaths are taken off them (`demography.ts:2415-2420`), so they are not
    // counts of anything. The real per-year figures live on the bounded `demographicChurn`
    // record list, which is sampled below as the run proceeds.

    return {
      arm,
      seed,
      survived: living.length > 0,
      extinctionYear,
      finalPopulation,
      finalBands: living.length,
      peakPopulation,
      meanSupport: r4(supportN === 0 ? null : supportSum / supportN),
      births,
      deaths,
      physicalFoodReceipts: r2(receipts),
      foodTripDays,
      verificationParties: partyCounts.frontier_verification ?? 0,
      uniqueVerificationTargets: verificationPairs.size,
      repeatedVerificationPairs: attempts.filter((count) => count > 1).length,
      maxAttemptsOnOnePair: attempts.length === 0 ? 0 : Math.max(...attempts),
      broadExplorationParties: partyCounts.frontier_exploration ?? 0,
      totalParties: seenExpeditions.size,
      partyMix: partyCounts,
      localResourceActivities: localResourceTrips.size,
      residentialMoves,
      residentialDestinations: residentialDestinations.size,
      uniqueTilesVisited: tilesVisited.size,
      repeatedTilesVisited: tilesRepeated.size,
      frontierTilesFirstObserved: frontierTilesFirstObserved.size,
      uniqueRoutes: uniqueRoutes.size,
      peakKnownTiles,
      peakDispositionRows,
      placeRecordEvictions: placeEvictions,
      verifiedPlaceEvictions,
      placeRecordRefreshes: placeRefreshes,
      meanCandidateSetSize: r2(candidateSetN === 0 ? null : candidateSetSum / candidateSetN),
      knownUnusedConsideredBandDays: knownUnusedConsidered,
      trajectory,
    };
  };

  const rows = [];
  for (const arm of ARMS) {
    for (const seed of SEEDS) {
      const started = Date.now();
      const row = runOne(arm, seed);
      rows.push(row);
      console.log(
        `${arm} ${seed.padEnd(4)} surv=${String(row.survived).padEnd(5)} ext=${String(row.extinctionYear ?? "-").padStart(4)} ` +
          `pop=${String(row.finalPopulation).padStart(4)} peak=${String(row.peakPopulation).padStart(4)} ` +
          `verif=${String(row.verificationParties).padStart(4)} explo=${String(row.broadExplorationParties).padStart(4)} ` +
          `tiles=${String(row.uniqueTilesVisited).padStart(4)} evict=${String(row.placeRecordEvictions).padStart(5)} ` +
          `(${Math.round((Date.now() - started) / 1000)}s)`,
      );
    }
  }

  const summary = {};
  for (const arm of ARMS) {
    const armRows = rows.filter((row) => row.arm === arm);
    const mean = (pick) =>
      r2(armRows.reduce((acc, row) => acc + (pick(row) ?? 0), 0) / Math.max(1, armRows.length));

    summary[arm] = {
      seeds: armRows.length,
      survival: r2(armRows.filter((row) => row.survived).length / Math.max(1, armRows.length)),
      meanFinalPopulation: mean((row) => row.finalPopulation),
      meanPeakPopulation: mean((row) => row.peakPopulation),
      meanExtinctionYear: r2(
        armRows.filter((row) => row.extinctionYear !== null).reduce((acc, row) => acc + row.extinctionYear, 0) /
          Math.max(1, armRows.filter((row) => row.extinctionYear !== null).length),
      ),
      meanSupport: mean((row) => row.meanSupport),
      meanReceipts: mean((row) => row.physicalFoodReceipts),
      meanVerificationParties: mean((row) => row.verificationParties),
      meanRepeatedPairs: mean((row) => row.repeatedVerificationPairs),
      meanExplorationParties: mean((row) => row.broadExplorationParties),
      meanTotalParties: mean((row) => row.totalParties),
      meanUniqueTilesVisited: mean((row) => row.uniqueTilesVisited),
      meanFrontierTilesObserved: mean((row) => row.frontierTilesFirstObserved),
      meanUniqueRoutes: mean((row) => row.uniqueRoutes),
      meanPlaceEvictions: mean((row) => row.placeRecordEvictions),
      meanVerifiedPlaceEvictions: mean((row) => row.verifiedPlaceEvictions),
      meanPlaceRefreshes: mean((row) => row.placeRecordRefreshes),
      meanResidentialMoves: mean((row) => row.residentialMoves),
      meanLocalResourceActivities: mean((row) => row.localResourceActivities),
      meanKnownTiles: mean((row) => row.peakKnownTiles),
    };
  }

  console.log("\n=== ARM SUMMARY ===");
  console.log(JSON.stringify(summary, null, 2));

  mkdirSync(OUT.slice(0, OUT.lastIndexOf("/")), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ map: MAP, site: SITE, fixture: FIXTURE, label: LABEL, years: YEARS, seedPrefix: SEED_PREFIX, rows, summary }, null, 2));
  console.log(`\nwrote ${OUT}`);
} finally {
  await server.close();
}
