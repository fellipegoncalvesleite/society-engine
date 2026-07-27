// CORRECTION-23G §5-§13 — EXACT TRAVEL REPLAY, TARGET-SELECTION ISOLATION, TERRAIN PHENOTYPE.
//
// One script, because every job needs the SAME instrumented run:
//
//   §5   stage 1 records the F1 donor schedule from the band-known production selector;
//        stage 2 replays it physically with no verification semantics at all (G1).
//   §6   G2 adds the bounded target-rotation disposition and nothing else.
//   §7   G3/G4/G5 keep the donor CADENCE and change only the target rule.
//   §8   season-information accounting is SPLIT into existing-record season additions and
//        new-record creations, and the behavioural readers are counted, not assumed.
//   §11  G6 protects the donor-schedule PLACES without launching anything.
//   §9   the run-dependent half of the site phenotype is measured from the F0 control.
//   §13  the mediation chain is traced end to end for every arm.
//
// Everything is observed DAILY. A party is raised, walks and returns inside a season, so
// season-boundary sampling cannot count launches; the only honest way to count one is to
// watch for it.
//
// ARM SEMANTICS, stated plainly because the names are not self-explanatory:
//
//   F0  production
//   F1  production + the one restored season term (`legacy_season_comparison`) — the
//       CORRECTION-23E/F positive control, and the DONOR for every G arm
//   G1  F1's exact physical schedule, no question / answer / evidence / disposition
//   G2  G1 + rotation state ("this audit activity already used this target under this replay
//       schedule"), which is read at exactly one place: choosing a substitute when the
//       scheduled target is physically unreachable
//   G3  F1's launch days and party count, ordinary broad-exploration target family
//   G4  F1's launch days and party count, nearest legal band-known uncertain target
//   G5  F1's launch days and party count, deterministic rotating band-known sectors
//   G6  production, plus sparse audit-only retention of exactly the donor-schedule places
//
// Usage:
//   node scripts/scheduleReplayMatrixAudit.mjs --sites tile:204:72,... \
//     --arms F0,F1,G1,G2,G3,G4,G5,G6 --seeds s1,..,s5 --years 200
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt;
};

const MAP = arg("map", "map2");
const SITES = arg("sites", "tile:204:72").split(",").filter(Boolean);
const YEARS = Number(arg("years", "200"));
const SEEDS = arg("seeds", "s1,s2,s3,s4,s5").split(",").filter(Boolean);
const ARMS = arg("arms", "F0,F1,G1,G2,G3,G4,G5,G6").split(",").filter(Boolean);
const FOUNDER = Number(arg("founder-population", "34"));
const LABEL = arg("label", "marginal_escapable");
const OUT = arg("out", "docs/evidence/correction23g/g-matrix.json");
// The seed string must be IDENTICAL across arms and sites, so it is fixed here and never
// derived from the arm. CORRECTION-23F used the same prefix family; the site is NOT part of
// it, so an arm difference can never be a seed difference.
const SEED_PREFIX = arg("seed-prefix", "c23e:marginal_escapable");

// Audit options per arm. G arms carry NO `WorldAuditOptions` at all: they are driven entirely
// by the module-slot replay seam, so the production option surface is untouched.
const ARM_OPTIONS = {
  F0: undefined,
  F1: { verificationRetryArm: "legacy_season_comparison" },
  G1: undefined,
  G2: undefined,
  G3: undefined,
  G4: undefined,
  G5: undefined,
  G6: undefined,
  // §6 supplement. F13 is CORRECTION-23F's inadmissible arm, rerun here ONLY as the control
  // for G2b: production selector, answer suppressed, and therefore disposition suppressed —
  // the collapse §6's rotation state is supposed to prevent. G2b is F13 plus that rotation
  // state and nothing else, so the pair isolates rotation in the one configuration where it
  // has a decision to make. Neither is a replacement for G1; both are reported as supplements.
  F13: { verificationRetryArm: "legacy_season_comparison", verificationTargetArm: "no_verification_question" },
  G2b: { verificationRetryArm: "legacy_season_comparison", verificationTargetArm: "no_verification_question" },
};

/** Arms that switch the audit-only selector rotation gate on. */
const SELECTOR_ROTATION_ARMS = new Set(["G2b"]);

// Which arms are driven by the replay seam, and which need the donor schedule registered.
const REPLAY_ARMS = new Set(["G1", "G2", "G3", "G4", "G5"]);
const DONOR_PLACE_ARMS = new Set(["G6"]);

const r2 = (v) => (v === undefined || v === null ? null : Math.round(v * 100) / 100);
const r4 = (v) => (v === undefined || v === null ? null : Math.round(v * 10000) / 10000);

/** Information families — the ones whose walked route becomes ordinary known country. */
const INFORMATION_TASKS = new Set([
  "frontier_verification",
  "frontier_exploration",
  "route_reconnaissance",
  "distant_patch_verification",
]);

/** Score gap below which two candidates are a near tie. */
const NEAR_TIE_MARGIN = 0.02;

function logRow(row, ms, note) {
  console.log(
    `${row.site} ${row.arm.padEnd(3)} ${row.seed.padEnd(4)} surv=${String(row.survived).padEnd(5)} ` +
      `ext=${String(row.extinctionYear ?? "-").padStart(4)} pop=${String(row.finalPopulation).padStart(4)} ` +
      `verif=${String(row.verificationParties).padStart(4)} explo=${String(row.broadExplorationParties).padStart(4)} ` +
      `tiles=${String(row.uniqueTilesVisited).padStart(4)} newRec=${String(row.newRecordCreations).padStart(5)} ` +
      `sched=${String(row.replayScheduled).padStart(4)}/${String(row.replayLaunched).padStart(4)} ` +
      `(${Math.round(ms / 1000)}s) ${note}`,
  );
}

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
  const replay = await server.ssrLoadModule("/sim/diagnostics/verificationScheduleReplay.ts");
  const compression = await server.ssrLoadModule("/sim/agents/memoryCompression.ts");

  const isLiving = (band) =>
    band.viability?.status !== "extinct" &&
    band.viability?.status !== "absorbed" &&
    band.viability?.status !== "dispersed" &&
    (band.demography?.population ?? 0) > 0;

  /**
   * One instrumented run. `donorSchedule` is registered for replay arms; `recordDonor` turns
   * on stage-1 recording. The two are never both on: a donor run records, a replay run
   * replays, and the schedule crosses between them as data.
   */
  const runOne = (arm, seed, site, { donorSchedule, recordDonor } = {}) => {
    const collectedSchedule = [];

    if (recordDonor === true) {
      replay.setDonorScheduleRecorder((entry) => collectedSchedule.push(entry));
    }

    if (REPLAY_ARMS.has(arm)) {
      replay.setScheduleReplay({ arm, schedule: donorSchedule ?? [] });
    }

    if (DONOR_PLACE_ARMS.has(arm)) {
      replay.setProtectedDonorPlaces([...new Set((donorSchedule ?? []).map((entry) => entry.targetTileId))]);
    }

    if (SELECTOR_ROTATION_ARMS.has(arm)) {
      replay.setSelectorRotationGate(true);
    }

    replay.setSeasonIdentityReadCounting(true);

    let world = runner.initSimWorld({ kind: MAP }, `${SEED_PREFIX}:${seed}`);
    world = spawn.removeInitialBands(world, Object.keys(world.bands));
    world = spawn.spawnCustomBands(world, [{ tileId: site, population: FOUNDER, name: LABEL }], `${SEED_PREFIX}:${seed}`);

    const options = ARM_OPTIONS[arm];
    if (options !== undefined) world = { ...world, auditOptions: options };

    // ── §9 phenotype: what the founder KNEW before anything happened ──────────────────
    const founder = Object.values(world.bands)[0];
    const startingKnownTiles = Object.keys(founder?.knowledge?.observedTiles ?? {}).length;
    const startingKnownSupport = (() => {
      const records = Object.values(founder?.knowledge?.observedTiles ?? {});
      if (records.length === 0) return null;
      return records.reduce((acc, record) => acc + (record.observedRichness ?? 0), 0) / records.length;
    })();

    // ── cumulative, arm-comparable counters ───────────────────────────────────────────
    const seenExpeditions = new Set();
    const partyCounts = {};
    const tilesVisited = new Set();
    const routeObservedTiles = new Set(); // tiles an information party physically walked
    const uniqueInformationTargets = new Set();
    const uniqueRoutes = new Set();
    let residentialMoves = 0;
    let residentialMovesOntoRouteCountry = 0;
    let placeEvictions = 0;
    let reacquisitions = 0;
    let placeRefreshes = 0;
    let newRecordCreations = 0;
    let newRecordsWithBaseContent = 0;
    let existingRecordSeasonAdditions = 0;
    let receipts = 0;
    let receiptsFromRouteCountry = 0;
    let foodTripDays = 0;
    let births = 0;
    let deaths = 0;
    let peakPopulation = 0;
    let peakKnownTiles = 0;
    let extinctionYear = null;
    let supportSum = 0;
    let supportN = 0;
    let mandatoryPressureSum = 0;
    let mandatoryPressureN = 0;
    let candidateSetSum = 0;
    let candidateSetN = 0;
    let nearTies = 0;
    const churnYears = new Set();
    const localResourceTrips = new Set();
    const trajectory = [];

    // §12 decision observer — the ONLY authoritative candidate set. `alternativesConsidered`
    // carries the real scores, so candidate-set size and near-tie density are measured rather
    // than inferred from a provenance list.
    const decisionObserver = (observation) => {
      const alternatives = observation.decision?.alternativesConsidered ?? [];
      candidateSetSum += alternatives.length;
      candidateSetN += 1;

      if (alternatives.length >= 2) {
        const scores = alternatives.map((alternative) => alternative.score).sort((a, b) => b - a);
        if (Math.abs(scores[0] - scores[1]) <= NEAR_TIE_MARGIN) nearTies += 1;
      }
    };

    const track = new Map();
    const trackOf = (band) => {
      let state = track.get(band.id);
      if (state === undefined) {
        state = {
          position: band.position,
          known: new Set(Object.keys(band.knowledge?.observedTiles ?? {})),
          everKnown: new Set(Object.keys(band.knowledge?.observedTiles ?? {})),
          evicted: new Set(),
          lastObserved: new Map(),
          seasonCount: new Map(),
          season: null,
        };
        track.set(band.id, state);
      }
      return state;
    };

    const days = YEARS * 360;
    let population = 0;

    for (let d = 1; d <= days; d += 1) {
      world = runner.stepSim(world, 1, "daily", decisionObserver);

      const living = Object.values(world.bands).filter(isLiving);
      population = living.reduce((acc, b) => acc + (b.demography?.population ?? 0), 0);
      peakPopulation = Math.max(peakPopulation, population);

      for (const band of living) {
        const state = trackOf(band);

        if (band.position !== state.position) {
          residentialMoves += 1;
          if (routeObservedTiles.has(String(band.position))) residentialMovesOntoRouteCountry += 1;
          state.position = band.position;
        }
        tilesVisited.add(String(band.position));

        for (const expedition of band.expeditions ?? []) {
          if (!seenExpeditions.has(expedition.id)) {
            seenExpeditions.add(expedition.id);
            partyCounts[expedition.taskKind] = (partyCounts[expedition.taskKind] ?? 0) + 1;

            if (INFORMATION_TASKS.has(expedition.taskKind)) {
              uniqueInformationTargets.add(String(expedition.targetTileId));
            }
          }

          const route = expedition.routeTileIds ?? [];

          if (route.length > 0) {
            uniqueRoutes.add(`${expedition.taskKind}|${route.join(">")}`);
            for (const tileId of route) {
              tilesVisited.add(String(tileId));
              if (INFORMATION_TASKS.has(expedition.taskKind)) routeObservedTiles.add(String(tileId));
            }
          }
        }

        for (const trip of band.recentIntraSeasonTrips ?? []) {
          const key = `${band.id}|${String(trip.day)}|${String(trip.targetTileId)}|${trip.cause}`;
          if (localResourceTrips.has(key)) continue;
          localResourceTrips.add(key);

          const usable = trip.physicalFoodHarvest?.usableSupport ?? 0;

          if (usable > 0) {
            foodTripDays += 1;
            // §13 — the physical receipt end of the mediation chain: food actually brought
            // home from country an information party had walked.
            if (routeObservedTiles.has(String(trip.targetTileId))) receiptsFromRouteCountry += usable;
          }
        }

        // ── §8 SEASON-INFORMATION ACCOUNTING, split as the section requires ────────────
        const records = band.knowledge?.observedTiles ?? {};
        const nowKnown = new Set(Object.keys(records));
        peakKnownTiles = Math.max(peakKnownTiles, nowKnown.size);

        for (const tileId of state.known) {
          if (nowKnown.has(tileId)) continue;
          placeEvictions += 1;
          state.evicted.add(tileId);
          state.lastObserved.delete(tileId);
          state.seasonCount.delete(tileId);
        }

        for (const [tileId, record] of Object.entries(records)) {
          const isNew = !state.known.has(tileId);

          if (isNew) {
            if (state.everKnown.has(tileId)) {
              // A record that had been evicted and has come back.
              if (state.evicted.has(tileId)) {
                reacquisitions += 1;
                state.evicted.delete(tileId);
              }
            } else {
              // §8 — a NEW record. Creating one NECESSARILY writes base observation content,
              // so a "season only" arm cannot act on it without also writing content. That is
              // why the two are counted separately and never pooled.
              newRecordCreations += 1;
              state.everKnown.add(tileId);

              if (
                record.observedRichness !== undefined ||
                record.observedWaterAccess !== undefined ||
                record.observedMovementCost !== undefined
              ) {
                newRecordsWithBaseContent += 1;
              }
            }
          }

          const stamp = Number(record.lastObservedAt?.day ?? record.lastObservedAt?.tick ?? 0);
          const prior = state.lastObserved.get(tileId);
          if (!isNew && prior !== undefined && stamp > prior) placeRefreshes += 1;
          state.lastObserved.set(tileId, stamp);

          const seasons = record.seasonsObserved?.length ?? 0;
          const priorSeasons = state.seasonCount.get(tileId);
          // §8 — a season added to an ALREADY KNOWN record. This is the only arm-clean
          // measurement of season identity: nothing else about the record was created here.
          if (!isNew && priorSeasons !== undefined && seasons > priorSeasons) {
            existingRecordSeasonAdditions += seasons - priorSeasons;
          }
          state.seasonCount.set(tileId, seasons);
        }

        state.known = nowKnown;

        for (const record of band.demography?.demographicChurn?.records ?? []) {
          const churnKey = `${band.id}|${record.year}`;
          if (churnYears.has(churnKey)) continue;
          churnYears.add(churnKey);
          births += record.births ?? 0;
          deaths += record.deaths ?? 0;
        }

        if (state.season !== world.time.season) {
          state.season = world.time.season;
          receipts += band.seasonalFoodReceipts?.totalUsableSupport ?? 0;
          const support = band.seasonalSupport?.currentSeasonSupport?.rawSupportRatio;
          if (support !== undefined) {
            supportSum += support;
            supportN += 1;
          }

          // §9 phenotype — memory MANDATORY-SET PRESSURE, read through the production
          // retention authority itself rather than reimplemented here.
          try {
            const view = compression.deriveKnownRetentionAuditView(world, band);
            if (view !== undefined && view.capacity > 0) {
              mandatoryPressureSum += view.mandatoryCount / view.capacity;
              mandatoryPressureN += 1;
            }
          } catch {
            // A retention view is diagnostic; never let it change the run.
          }
        }
      }

      if (d % 360 === 0) {
        const year = d / 360;
        if (year % 25 === 0 || year <= 2) trajectory.push({ year, population, bands: living.length });
      }

      if (living.length === 0) {
        extinctionYear = Math.ceil(d / 360);
        break;
      }
    }

    const living = Object.values(world.bands).filter(isLiving);
    const finalPopulation = living.reduce((acc, b) => acc + (b.demography?.population ?? 0), 0);

    // ── §5/§6 SEMANTIC-SUPPRESSION PROOF ─────────────────────────────────────────────
    // The arm's claim is that it removes the question, the answer, the evidence and the
    // durable disposition. That claim is CHECKED here rather than asserted: on every G arm
    // all three of these must be zero across every band alive at the end. A replay that
    // silently kept writing dispositions would look like a valid counterfactual and be
    // exactly the F13 mistake again.
    const allBands = Object.values(world.bands);
    const verificationAttemptRows = allBands.reduce(
      (acc, band) => acc + (band.frontierVerificationAttempts?.length ?? 0),
      0,
    );
    // `verificationEvidence` is a plain array. Reading `?.entries?.length` here would silently
    // return 0 — `Array.prototype.entries` is a function whose `.length` is its arity — and a
    // suppression proof that always reads zero proves nothing.
    const verificationEvidenceRows = allBands.reduce(
      (acc, band) => acc + (band.verificationEvidence?.length ?? 0),
      0,
    );
    const dispositionRows = allBands.reduce(
      (acc, band) =>
        acc +
        Object.values(band.knowledge?.observedTiles ?? {}).reduce(
          (inner, record) => inner + (record.verificationDisposition?.length ?? 0),
          0,
        ),
      0,
    );

    const seasonReads = replay.getSeasonIdentityReads();
    const ledger = replay.getReplayLedger();
    const launched = ledger.filter((row) => row.launched);
    const years = extinctionYear ?? YEARS;

    const row = {
      arm,
      seed,
      site,
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
      // ── party families ──
      verificationParties: partyCounts.frontier_verification ?? 0,
      broadExplorationParties: partyCounts.frontier_exploration ?? 0,
      reconnaissanceParties: partyCounts.route_reconnaissance ?? 0,
      totalParties: seenExpeditions.size,
      partyMix: partyCounts,
      uniqueInformationTargets: uniqueInformationTargets.size,
      uniqueRoutes: uniqueRoutes.size,
      uniqueTilesVisited: tilesVisited.size,
      routeObservedTiles: routeObservedTiles.size,
      // ── §8 season-information accounting, SPLIT ──
      newRecordCreations,
      newRecordsWithBaseContent,
      existingRecordSeasonAdditions,
      placeRecordRefreshes: placeRefreshes,
      placeRecordEvictions: placeEvictions,
      reacquisitions,
      seasonIdentityReads: seasonReads,
      // ── semantic-suppression proof: must be 0/0/0 on every G arm ──
      verificationAttemptRows,
      verificationEvidenceRows,
      dispositionRows,
      // ── §13 mediation chain ──
      residentialMoves,
      residentialMovesOntoRouteCountry,
      receiptsFromRouteCountry: r2(receiptsFromRouteCountry),
      // ── §9 run-dependent phenotype ──
      startingKnownTiles,
      startingKnownSupport: r4(startingKnownSupport),
      peakKnownTiles,
      meanCandidateSetSize: r2(candidateSetN === 0 ? null : candidateSetSum / candidateSetN),
      nearTieDensity: r4(candidateSetN === 0 ? null : nearTies / candidateSetN),
      meanMandatorySetPressure: r4(mandatoryPressureN === 0 ? null : mandatoryPressureSum / mandatoryPressureN),
      evictionsPerYear: r2(placeEvictions / Math.max(1, years)),
      reacquiredShare: r4(placeEvictions === 0 ? null : reacquisitions / placeEvictions),
      newRecordShareOfObservations: r4(
        newRecordCreations + placeRefreshes === 0 ? null : newRecordCreations / (newRecordCreations + placeRefreshes),
      ),
      verificationLaunchRate: r2((partyCounts.frontier_verification ?? 0) / Math.max(1, years)),
      broadExplorationLaunchRate: r2((partyCounts.frontier_exploration ?? 0) / Math.max(1, years)),
      // ── replay fidelity ──
      replayScheduled: ledger.length,
      replayLaunched: launched.length,
      replayExactRoute: launched.filter((r) => r.exactRoute === true).length,
      replayOriginMatched: launched.filter((r) => r.originMatched === true).length,
      replayRotationRetargets: launched.filter((r) => r.rotationRetarget === true).length,
      replayFailures: ledger
        .filter((r) => !r.launched)
        .reduce((acc, r) => ({ ...acc, [r.failureReason]: (acc[r.failureReason] ?? 0) + 1 }), {}),
      trajectory,
    };

    return { row, schedule: collectedSchedule };
  };

  // ── the matrix ────────────────────────────────────────────────────────────────────────
  const rows = [];
  const donorSchedules = {};
  const scheduleStats = {};

  for (const site of SITES) {
    for (const seed of SEEDS) {
      // §5 stage 1 — the donor run comes FIRST for this (site, seed), and every G arm for
      // that pair replays THAT schedule. A schedule is never reused across seeds or sites.
      const donorKey = `${site}|${seed}`;
      const needsDonor = ARMS.some((arm) => REPLAY_ARMS.has(arm) || DONOR_PLACE_ARMS.has(arm));

      if (needsDonor && donorSchedules[donorKey] === undefined) {
        const started = Date.now();
        try {
          const donor = runOne("F1", seed, site, { recordDonor: true });
          donorSchedules[donorKey] = donor.schedule;
          scheduleStats[donorKey] = {
            launches: donor.schedule.length,
            distinctTargets: new Set(donor.schedule.map((e) => e.targetTileId)).size,
            distinctBands: new Set(donor.schedule.map((e) => e.bandId)).size,
            questions: donor.schedule.reduce((acc, e) => ({ ...acc, [e.question]: (acc[e.question] ?? 0) + 1 }), {}),
            meanRouteTiles: r2(
              donor.schedule.reduce((acc, e) => acc + e.feasibility.routeTiles, 0) / Math.max(1, donor.schedule.length),
            ),
            meanDistanceTiles: r2(
              donor.schedule.reduce((acc, e) => acc + e.feasibility.distanceTiles, 0) / Math.max(1, donor.schedule.length),
            ),
          };
          // The donor run IS an F1 run, so its row is kept rather than thrown away and rerun.
          if (ARMS.includes("F1")) {
            rows.push(donor.row);
            logRow(donor.row, Date.now() - started, "(donor)");
          }
        } finally {
          replay.clearScheduleReplayDiagnostics();
        }
      }

      for (const arm of ARMS) {
        if (arm === "F1" && donorSchedules[donorKey] !== undefined) continue; // already run above

        const started = Date.now();
        try {
          const { row } = runOne(arm, seed, site, { donorSchedule: donorSchedules[donorKey] });
          rows.push(row);
          logRow(row, Date.now() - started, "");
        } finally {
          replay.clearScheduleReplayDiagnostics();
        }
      }
    }
  }

  // ── summaries, per site and arm ───────────────────────────────────────────────────────
  const summary = {};

  for (const site of SITES) {
    summary[site] = {};

    for (const arm of ARMS) {
      const armRows = rows.filter((row) => row.arm === arm && row.site === site);
      if (armRows.length === 0) continue;

      const mean = (pick) =>
        r2(armRows.reduce((acc, row) => acc + (pick(row) ?? 0), 0) / Math.max(1, armRows.length));

      summary[site][arm] = {
        seeds: armRows.length,
        survival: r2(armRows.filter((row) => row.survived).length / armRows.length),
        meanFinalPopulation: mean((row) => row.finalPopulation),
        meanPeakPopulation: mean((row) => row.peakPopulation),
        meanSupport: mean((row) => row.meanSupport),
        meanReceipts: mean((row) => row.physicalFoodReceipts),
        meanVerificationParties: mean((row) => row.verificationParties),
        meanExplorationParties: mean((row) => row.broadExplorationParties),
        meanTotalParties: mean((row) => row.totalParties),
        meanUniqueInformationTargets: mean((row) => row.uniqueInformationTargets),
        meanUniqueTilesVisited: mean((row) => row.uniqueTilesVisited),
        meanRouteObservedTiles: mean((row) => row.routeObservedTiles),
        meanNewRecordCreations: mean((row) => row.newRecordCreations),
        meanNewRecordsWithBaseContent: mean((row) => row.newRecordsWithBaseContent),
        meanExistingRecordSeasonAdditions: mean((row) => row.existingRecordSeasonAdditions),
        meanPlaceRefreshes: mean((row) => row.placeRecordRefreshes),
        meanPlaceEvictions: mean((row) => row.placeRecordEvictions),
        meanReacquisitions: mean((row) => row.reacquisitions),
        meanResidentialMoves: mean((row) => row.residentialMoves),
        meanResidentialMovesOntoRouteCountry: mean((row) => row.residentialMovesOntoRouteCountry),
        meanReceiptsFromRouteCountry: mean((row) => row.receiptsFromRouteCountry),
        meanCandidateSetSize: mean((row) => row.meanCandidateSetSize),
        meanNearTieDensity: r4(
          armRows.reduce((acc, row) => acc + (row.nearTieDensity ?? 0), 0) / armRows.length,
        ),
        meanMandatorySetPressure: r4(
          armRows.reduce((acc, row) => acc + (row.meanMandatorySetPressure ?? 0), 0) / armRows.length,
        ),
        meanEvictionsPerYear: mean((row) => row.evictionsPerYear),
        meanReacquiredShare: r4(
          armRows.reduce((acc, row) => acc + (row.reacquiredShare ?? 0), 0) / armRows.length,
        ),
        meanNewRecordShare: r4(
          armRows.reduce((acc, row) => acc + (row.newRecordShareOfObservations ?? 0), 0) / armRows.length,
        ),
        meanBirths: mean((row) => row.births),
        meanDeaths: mean((row) => row.deaths),
        semanticSuppression: {
          verificationAttemptRows: armRows.reduce((acc, row) => acc + row.verificationAttemptRows, 0),
          verificationEvidenceRows: armRows.reduce((acc, row) => acc + row.verificationEvidenceRows, 0),
          dispositionRows: armRows.reduce((acc, row) => acc + row.dispositionRows, 0),
        },
        seasonIdentityReads: armRows.reduce((acc, row) => {
          for (const [reader, count] of Object.entries(row.seasonIdentityReads ?? {})) {
            const prior = acc[reader] ?? { reads: 0, consequential: 0 };
            acc[reader] = {
              reads: prior.reads + count.reads,
              consequential: prior.consequential + count.consequential,
            };
          }
          return acc;
        }, {}),
        replayFidelity: REPLAY_ARMS.has(arm)
          ? {
              scheduled: armRows.reduce((acc, row) => acc + row.replayScheduled, 0),
              launched: armRows.reduce((acc, row) => acc + row.replayLaunched, 0),
              exactRoute: armRows.reduce((acc, row) => acc + row.replayExactRoute, 0),
              originMatched: armRows.reduce((acc, row) => acc + row.replayOriginMatched, 0),
              rotationRetargets: armRows.reduce((acc, row) => acc + row.replayRotationRetargets, 0),
              failures: armRows.reduce((acc, row) => {
                for (const [reason, count] of Object.entries(row.replayFailures ?? {})) {
                  acc[reason] = (acc[reason] ?? 0) + count;
                }
                return acc;
              }, {}),
            }
          : undefined,
      };
    }
  }

  console.log("\n=== SUMMARY ===");
  for (const site of SITES) {
    console.log(`\n${site}`);
    for (const arm of ARMS) {
      const s = summary[site]?.[arm];
      if (s === undefined) continue;
      console.log(
        `  ${arm.padEnd(3)} surv=${String(s.survival).padEnd(5)} pop=${String(s.meanFinalPopulation).padStart(6)} ` +
          `tiles=${String(s.meanUniqueTilesVisited).padStart(6)} newRec=${String(s.meanNewRecordCreations).padStart(6)} ` +
          `seasonAdds=${String(s.meanExistingRecordSeasonAdditions).padStart(7)} ` +
          `parties=${String(s.meanTotalParties).padStart(6)} receipts=${String(s.meanReceipts).padStart(7)}`,
      );
    }
  }

  mkdirSync(OUT.slice(0, OUT.lastIndexOf("/")), { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify({ map: MAP, sites: SITES, years: YEARS, seeds: SEEDS, arms: ARMS, seedPrefix: SEED_PREFIX, scheduleStats, rows, summary }, null, 2),
  );
  console.log(`\nwrote ${OUT}`);
} finally {
  await server.close();
}
