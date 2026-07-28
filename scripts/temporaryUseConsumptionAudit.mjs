// CORRECTION-23J §8/§10 — DID THE LAUNCH INFORM THE CAMP, OR DID THE EVIDENCE JUST TURN OUT
// USEFUL LATER?
//
// CORRECTION-23I reported that stored temporary-use negatives prevented 10,724 of 59,286
// ACTUALLY ATTEMPTED camps and retained the question on that basis. §3.3 rejects the inference:
// that total pairs no launch with the imminent camp decision that justified sending the party at
// that time. §10 therefore requires eight quantities measured SEPARATELY, and forbids reporting
// the first as though it were the sixth:
//
//   A  camp decisions blocked by ANY stored negative evidence       (23I's number)
//   B  distinct negative evidence records that ever block a camp
//   C  temporary-use verification launches
//   D  launches tied to a SELECTED operation at the same tile
//   E  launches whose answer physically returned before that operation's camp decision
//   F  launches whose NAMED operation actually consumed the answer
//   G  launches later useful only to UNRELATED operations
//   H  launches never consumed at all
//
// Every one is joined on real identities: the verification party's own expedition id, the
// operation's own expedition id, and days on a single timeline. Nothing is inferred from a
// changed predicate, a total, or an ordering.
//
// Usage: node scripts/temporaryUseConsumptionAudit.mjs [--years 40] [--seeds s1,..] [--out path]
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt;
};

const YEARS = Number(arg("years", "40"));
const SEEDS = arg("seeds", "s1,s2,s3,s4,s5").split(",").filter(Boolean);
const OUT = arg("out", "docs/evidence/correction23j/consumption-40y.json");
const SEED_PREFIX = arg("seed-prefix", "c23j:consume");

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

const r4 = (v) => (v === null || v === undefined ? null : Math.round(v * 10000) / 10000);

// The task families whose camp decision is a PHYSICAL WORK decision. `frontier_verification`
// parties reach the same reader and are refused camps by the same evidence, but a verification
// party being refused a camp is not the work the question exists to gate — counting it credits
// the question with governing its own parties. `frontier_exploration` has no destination.
const OPERATION_KINDS = new Set([
  "distant_plant_gathering",
  "distant_hunting",
  "distant_fishing",
  "distant_patch_verification",
  "route_reconnaissance",
]);

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
  const launch = await server.ssrLoadModule("/sim/diagnostics/verificationLaunchDiagnostics.ts");

  const isLiving = (band) =>
    band.viability?.status !== "extinct" &&
    band.viability?.status !== "absorbed" &&
    band.viability?.status !== "dispersed" &&
    (band.demography?.population ?? 0) > 0;

  const empty = () => ({
    A_campsBlockedByAnyStoredNegative: 0,
    B_distinctNegativeRecordsThatBlock: 0,
    C_temporaryUseLaunches: 0,
    D_launchesWithSelectedOperation: 0,
    E_launchesAnsweredInTime: 0,
    F_launchesConsumedByNamedOperation: 0,
    G_launchesUsefulOnlyToUnrelatedOperations: 0,
    H_launchesNeverConsumed: 0,
    launchesLost: 0,
    attemptedCamps: 0,
    campDecisions: 0,
    // WHY D comes out where it does. A launch can only name an operation at a place where work
    // actually happens, so the overlap between the two target populations bounds D from above
    // before any timing question is asked.
    launchesAtAPlaceWorkEverReached: 0,
    distinctVerificationTargets: 0,
    distinctOperationPlaces: 0,
    // A, split by who was actually refused. 23I reported the total.
    A_blockedForRealOperations: 0,
    A_blockedForVerificationPartiesThemselves: 0,
    attemptedCampsRealOperations: 0,
    refusalsByReason: {},
  });

  const add = (into, from) => {
    for (const key of Object.keys(from)) {
      if (key === "refusalsByReason") {
        for (const [reason, count] of Object.entries(from.refusalsByReason)) {
          into.refusalsByReason[reason] = (into.refusalsByReason[reason] ?? 0) + count;
        }
      } else {
        into[key] += from[key];
      }
    }
  };

  const totals = empty();
  const byScenario = {};
  const sampleTraces = [];

  for (const scenario of SCENARIOS) {
    const acc = empty();

    for (const seed of SEEDS) {
      launch.setTaskCampOutcomeCounting(true);
      launch.setLaunchDependencyRecording(true);
      launch.setLaunchRefusalCounting(true);
      launch.setVerificationJourneyRecording(true);

      try {
        let world = runner.initSimWorld({ kind: scenario.map }, `${SEED_PREFIX}:${seed}`);

        if (scenario.fixture !== "default") {
          world = spawn.removeInitialBands(world, Object.keys(world.bands));
          world = spawn.spawnCustomBands(
            world,
            [{ tileId: scenario.site, population: 34, name: scenario.name }],
            `${SEED_PREFIX}:${seed}`,
          );
        }

        const days = YEARS * 360;
        for (let d = 1; d <= days; d += 1) {
          world = runner.stepSim(world, 1, "daily");
          if (Object.values(world.bands).filter(isLiving).length === 0) break;
        }

        const campRows = launch.getTaskCampOutcomes();
        const departures = launch.getVerificationDepartures();
        const returns = launch.getVerificationReturns();
        const dependencies = launch.getLaunchDependencies();

        // ── A and B. The 23I quantity, recomputed unchanged so the two are comparable. ──
        const blockingRecords = new Set();

        for (const row of campRows) {
          const isOperation = OPERATION_KINDS.has(row.activityKind);

          acc.campDecisions += 1;
          if (row.reachedEvidenceReader) {
            acc.attemptedCamps += 1;
            if (isOperation) acc.attemptedCampsRealOperations += 1;
          }
          if (row.refusedByEvidence) {
            acc.A_campsBlockedByAnyStoredNegative += 1;
            if (isOperation) acc.A_blockedForRealOperations += 1;
            else acc.A_blockedForVerificationPartiesThemselves += 1;
            blockingRecords.add(`${row.bandId}|${row.tileId}`);
          }
        }

        acc.B_distinctNegativeRecordsThatBlock += blockingRecords.size;

        // ── The join. Every launch is matched to its own return and its own named operation. ──
        //
        // The dependency row is keyed by (band, day, tile, question); one verification party is
        // raised per band per day, so the pairing to a departure is exact.
        const dependencyByKey = new Map();

        for (const dep of dependencies) {
          if (dep.question !== "temporary_use") continue;
          dependencyByKey.set(`${dep.bandId}|${dep.day}|${dep.targetTileId}`, dep);
        }

        const returnById = new Map(returns.map((row) => [row.verificationExpeditionId, row]));

        // Camp decisions that REACHED the evidence reader, indexed by place. Anything that did
        // not reach the reader consumed nothing and must not be counted as consumption.
        const campsByPlace = new Map();

        for (const row of campRows) {
          if (!row.reachedEvidenceReader) continue;
          const key = `${row.bandId}|${row.tileId}`;
          const list = campsByPlace.get(key) ?? [];
          list.push(row);
          campsByPlace.set(key, list);
        }

        // Places any operation physically reached and decided a camp at. A verification target
        // outside this set can never have named an operation, whatever the timing.
        const operationPlaces = new Set(
          campRows
            .filter((row) => OPERATION_KINDS.has(row.activityKind))
            .map((row) => `${row.bandId}|${row.tileId}`),
        );
        const verificationTargets = new Set();

        acc.distinctOperationPlaces += operationPlaces.size;

        for (const departure of departures) {
          if (departure.question !== "temporary_use") continue;

          acc.C_temporaryUseLaunches += 1;
          verificationTargets.add(`${departure.bandId}|${departure.targetTileId}`);

          if (operationPlaces.has(`${departure.bandId}|${departure.targetTileId}`)) {
            acc.launchesAtAPlaceWorkEverReached += 1;
          }

          const dependency = dependencyByKey.get(
            `${departure.bandId}|${departure.departureDay}|${departure.targetTileId}`,
          );
          const operation = dependency?.pendingOperation;

          if (operation === undefined) {
            acc.H_launchesNeverConsumed += 1;
            continue;
          }

          acc.D_launchesWithSelectedOperation += 1;

          const home = returnById.get(departure.verificationExpeditionId);

          if (home === undefined) {
            // The party never came home. No answer, no disposition, nothing transfers — the
            // named operation follows its declared fallback. Not a consumption, and not a
            // "never consumed" launch either: it is the §8 lost-party outcome.
            acc.launchesLost += 1;
            continue;
          }

          const inTime = home.returnDay <= operation.expectedOperatingDay;

          if (inTime) acc.E_launchesAnsweredInTime += 1;

          const camps = campsByPlace.get(`${departure.bandId}|${departure.targetTileId}`) ?? [];
          const namedConsumption = camps.find(
            (row) => row.operationId === operation.operationId && row.day >= home.returnDay,
          );
          const unrelatedConsumption = camps.find(
            (row) => row.operationId !== operation.operationId && row.day >= home.returnDay,
          );

          if (namedConsumption !== undefined && inTime) {
            acc.F_launchesConsumedByNamedOperation += 1;

            if (sampleTraces.length < 40) {
              sampleTraces.push({
                scenario: scenario.name,
                seed,
                verificationExpeditionId: departure.verificationExpeditionId,
                decisionDependencyId: `${dependency.bandId}|${dependency.day}|${dependency.targetTileId}|temporary_use`,
                operationId: operation.operationId,
                targetTileId: departure.targetTileId,
                verificationDepartureDay: departure.departureDay,
                verificationReturnDay: home.returnDay,
                operationSelectionDay: operation.selectedDay,
                campDecisionDay: namedConsumption.day,
                readerInvocationDay: namedConsumption.day,
                answer: home.outcome,
                operationOutcome: namedConsumption.refusedByEvidence
                  ? "camp_refused"
                  : "camp_permitted",
              });
            }
          } else if (unrelatedConsumption !== undefined) {
            acc.G_launchesUsefulOnlyToUnrelatedOperations += 1;
          } else {
            acc.H_launchesNeverConsumed += 1;
          }
        }

        acc.distinctVerificationTargets += verificationTargets.size;

        for (const [key, count] of Object.entries(launch.getLaunchRefusals())) {
          if (!key.startsWith("temporary_use|")) continue;
          const reason = key.slice("temporary_use|".length);
          acc.refusalsByReason[reason] = (acc.refusalsByReason[reason] ?? 0) + count;
        }
      } finally {
        launch.clearVerificationLaunchDiagnostics();
      }
    }

    byScenario[scenario.name] = acc;
    add(totals, acc);

    console.log(
      `${scenario.name.padEnd(20)} A=${String(acc.A_campsBlockedByAnyStoredNegative).padStart(6)} ` +
        `C=${String(acc.C_temporaryUseLaunches).padStart(6)} D=${String(acc.D_launchesWithSelectedOperation).padStart(5)} ` +
        `E=${String(acc.E_launchesAnsweredInTime).padStart(4)} F=${String(acc.F_launchesConsumedByNamedOperation).padStart(4)} ` +
        `G=${String(acc.G_launchesUsefulOnlyToUnrelatedOperations).padStart(5)} H=${String(acc.H_launchesNeverConsumed).padStart(6)}`,
    );
  }

  const verdict =
    totals.C_temporaryUseLaunches === 0
      ? "NO TEMPORARY-USE LAUNCH OCCURRED — §13 Outcome B, the gate admits none"
      : totals.F_launchesConsumedByNamedOperation === 0
        ? "LAUNCHES OCCUR BUT NO NAMED OPERATION EVER CONSUMES THE ANSWER — §13 Outcome B"
        : `${totals.F_launchesConsumedByNamedOperation} OF ${totals.C_temporaryUseLaunches} LAUNCHES WERE CONSUMED BY THEIR OWN NAMED OPERATION`;

  const result = {
    years: YEARS,
    seeds: SEEDS,
    scenarios: SCENARIOS.map((s) => s.name),
    totals: {
      ...totals,
      preventionRateOfAttempts:
        totals.attemptedCamps === 0
          ? null
          : r4(totals.A_campsBlockedByAnyStoredNegative / totals.attemptedCamps),
      preventionRateOfRealOperationAttempts:
        totals.attemptedCampsRealOperations === 0
          ? null
          : r4(totals.A_blockedForRealOperations / totals.attemptedCampsRealOperations),
      namedConsumptionRateOfLaunches:
        totals.C_temporaryUseLaunches === 0
          ? null
          : r4(totals.F_launchesConsumedByNamedOperation / totals.C_temporaryUseLaunches),
    },
    byScenario,
    sampleTraces,
    verdict,
  };

  mkdirSync(OUT.split("/").slice(0, -1).join("/"), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);

  console.log("");
  console.log(`A camps blocked by any stored negative : ${totals.A_campsBlockedByAnyStoredNegative}`);
  console.log(`B distinct blocking evidence records   : ${totals.B_distinctNegativeRecordsThatBlock}`);
  console.log(`C temporary-use launches               : ${totals.C_temporaryUseLaunches}`);
  console.log(`D launches with a selected operation   : ${totals.D_launchesWithSelectedOperation}`);
  console.log(`E answers back before the decision     : ${totals.E_launchesAnsweredInTime}`);
  console.log(`F named operation consumed the answer  : ${totals.F_launchesConsumedByNamedOperation}`);
  console.log(`G useful only to unrelated operations  : ${totals.G_launchesUsefulOnlyToUnrelatedOperations}`);
  console.log(`H never consumed                       : ${totals.H_launchesNeverConsumed}`);
  console.log(`  (parties lost, no answer at all)     : ${totals.launchesLost}`);
  console.log(`  A for real work operations           : ${totals.A_blockedForRealOperations}`);
  console.log(`  A for verification parties themselves: ${totals.A_blockedForVerificationPartiesThemselves}`);
  console.log(`  launches at a place work ever reached: ${totals.launchesAtAPlaceWorkEverReached}`);
  console.log(`  distinct verification target places  : ${totals.distinctVerificationTargets}`);
  console.log(`  distinct places work reached         : ${totals.distinctOperationPlaces}`);
  console.log(`attempted camps                        : ${totals.attemptedCamps}`);
  console.log(`A / attempted camps                    : ${result.totals.preventionRateOfAttempts}`);
  console.log("");
  console.log(verdict);
  console.log(`wrote ${OUT}`);
} finally {
  await server.close();
}
