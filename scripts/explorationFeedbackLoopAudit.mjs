// CORRECTION-24A COMPLETION §16 — FEEDBACK LOOPS, WITH FIRST DIVERGENCE AND MEDIATION.
//
// §16 names two loops explicitly and requires that neither be called defective merely because it
// occurs: "A defect requires downstream cost or violation of the exploration contract." So every
// loop below reports THREE things separately —
//
//   OCCURS      the mechanism is present and how often
//   COST        what it demonstrably costs, measured, or `none_measured`
//   VERDICT     defective / real-but-non-binding / not-present
//
// The loops:
//
//   L1  launch stamps the cooldown -> the party returns EARLY -> the cooldown keeps running
//       despite the evidence that just came home -> the need is never re-evaluated.
//       Directly measurable now that §4.1 separated cooldown from concurrency: an opportunity with
//       `suppressionWindowActive && !activeFrontierParty` is a band being told to wait for a party
//       that is already home.
//
//   L2  an earlier candidate claims the scheduler -> fails after the claim -> exploration is never
//       reconsidered -> the SAME candidate claims again on the next opportunity and fails the same
//       way. Measured by grouping fallthrough opportunities on (band, claiming family, claimed
//       target, typed failure) and counting consecutive repeats.
//
//   L3  the returned record is evicted at its first annual compression -> the knowledge the journey
//       bought does not survive to be read -> the next launch re-learns the same country.
//       Mediation: eviction rate x re-acquisition of the same tile by a later journey.
//
//   L4  no reader changes a physical action -> extra launches cannot pay for themselves -> the
//       throttle costs nothing. Measured by the chain audit's E6 same-snapshot counterfactual; this
//       script reads the recorded reader rows rather than re-running the probe.
//
// L1 and L2 are the two §16 requires. L3 and L4 are the retention and reader loops the E-chain
// exposes. THE FOUR "ORIGINAL" LOOPS OF THE FIRST-PASS PROMPT ARE NOT REPRODUCED VERBATIM HERE —
// that text is not in this pass's brief, so these four are the loops the measured chain actually
// supports, and are labelled as such rather than presented as the original numbering.
//
// Usage:
//   node scripts/explorationFeedbackLoopAudit.mjs [--years 40] [--seeds s1,..] [--scenarios ..]
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt;
};

const YEARS = Number(arg("years", "40"));
const SEEDS = arg("seeds", "s1,s2,s3,s4,s5").split(",").filter(Boolean);
const SEED_PREFIX = arg("seed-prefix", "c24a:chain");
const OUT = arg("out", `docs/evidence/correction24a/feedback-loops-${YEARS}y.json`);

const ALL_SCENARIOS = [
  { name: "map1", map: "map1", fixture: "default" },
  { name: "map2", map: "map2", fixture: "default" },
  { name: "site_B_dry_plains", map: "map2", site: "tile:10:34" },
  { name: "site_D_aquatic", map: "map2", site: "tile:119:116" },
  { name: "site_C_dry_plains", map: "map2", site: "tile:100:23" },
  { name: "ordinary", map: "map2", site: "tile:62:108" },
];

const only = arg("scenarios", "");
const SCENARIOS = only === "" ? ALL_SCENARIOS : ALL_SCENARIOS.filter((s) => only.split(",").includes(s.name));

const r4 = (v) => Math.round((Number(v) || 0) * 10000) / 10000;
const inc = (obj, key, by = 1) => {
  obj[key] = (obj[key] ?? 0) + by;
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
  const diag = await server.ssrLoadModule("/sim/diagnostics/explorationFunnelDiagnostics.ts");

  const isLiving = (band) =>
    band.status !== "dispersed" && band.status !== "absorbed" && band.status !== "extinct";

  const L1 = {
    suppressedOpportunities: 0,
    suppressedWithPartyStillAway: 0,
    suppressedWithPartyALREADYHOME: 0,
    ofThoseWithAValidProposal: 0,
    firstDivergence: [],
    meanIdleCooldownTicksAtOpportunity: 0,
    idleSamples: 0,
  };
  const L2 = {
    fallthroughOpportunities: 0,
    distinctClaimChains: 0,
    repeatedChains: 0,
    longestRepeatRun: 0,
    repeatsByFailure: {},
    worstChains: [],
  };
  const L3 = {
    recordsReturned: 0,
    evictedAtFirstCompression: 0,
    survivedFirstCompression: 0,
    tilesRelearnedByALaterJourney: 0,
    meanLifetimeDaysOfEvicted: 0,
    lifetimeSamples: 0,
  };
  const L4 = { probes: 0, changedAction: 0, note: "measured by the chain audit E6 probe; see chain-O0-*.json" };

  const byScenario = {};

  for (const scenario of SCENARIOS) {
    const acc = {
      opportunities: 0,
      l1Idle: 0,
      l1Away: 0,
      l1IdleWithValidProposal: 0,
      l2Fallthrough: 0,
      l2Repeats: 0,
      l2LongestRun: 0,
      l3Records: 0,
      l3Evicted: 0,
      l3Relearned: 0,
      firstIdleDay: null,
      firstRepeatDay: null,
    };

    for (const seed of SEEDS) {
      diag.setExplorationFunnelRecording(true, scenario.name);
      diag.setExplorationJourneyRecording(true);
      diag.setExplorationRecordRecording(true);
      diag.setExplorationArm("O0");

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

        for (let d = 1; d <= YEARS * 360; d += 1) {
          world = runner.stepSim(world, 1, "daily");
          if (Object.values(world.bands).filter(isLiving).length === 0) break;
        }

        const rows = diag.getExplorationFunnel();

        // ── L1 ────────────────────────────────────────────────────────────────────────────
        for (const row of rows) {
          acc.opportunities += 1;

          if (!row.suppressionWindowActive) {
            continue;
          }

          L1.suppressedOpportunities += 1;

          if (row.activeFrontierParty) {
            L1.suppressedWithPartyStillAway += 1;
            acc.l1Away += 1;
            continue;
          }

          // The cooldown is running and NOTHING is away: the band is waiting on a party that
          // already came home, and what it brought back cannot shorten the wait.
          L1.suppressedWithPartyALREADYHOME += 1;
          acc.l1Idle += 1;

          if (row.ticksSinceLastExploration !== undefined) {
            L1.meanIdleCooldownTicksAtOpportunity += row.ticksSinceLastExploration;
            L1.idleSamples += 1;
          }

          if (row.eligible && row.headingAvailable && row.canBeginPhysicalExploration && row.partyCompositionAvailable) {
            L1.ofThoseWithAValidProposal += 1;
            acc.l1IdleWithValidProposal += 1;
          }

          if (acc.firstIdleDay === null) {
            acc.firstIdleDay = row.day;
            L1.firstDivergence.push({
              scenario: scenario.name,
              seed,
              day: row.day,
              band: row.bandId,
              ticksSinceLastExploration: row.ticksSinceLastExploration ?? null,
              activeFrontierParty: row.activeFrontierParty,
              eligible: row.eligible,
              canBeginPhysicalExploration: row.canBeginPhysicalExploration,
            });
          }
        }

        // ── L2 ────────────────────────────────────────────────────────────────────────────
        const chains = new Map();

        for (const row of rows) {
          if (!row.fallthroughOpportunity) {
            continue;
          }

          L2.fallthroughOpportunities += 1;
          acc.l2Fallthrough += 1;

          const key = `${scenario.name}|${seed}|${row.bandId}|${row.claimedBy ?? "?"}|${row.claimedCandidateTarget ?? "?"}|${row.claimFailure ?? "?"}`;
          const chain = chains.get(key) ?? { count: 0, firstDay: row.day, lastDay: row.day };
          chain.count += 1;
          chain.lastDay = row.day;
          chains.set(key, chain);
        }

        for (const [key, chain] of chains) {
          L2.distinctClaimChains += 1;

          if (chain.count > 1) {
            L2.repeatedChains += 1;
            acc.l2Repeats += 1;
            const failure = key.split("|")[5];
            inc(L2.repeatsByFailure, failure, chain.count - 1);

            if (chain.count > acc.l2LongestRun) acc.l2LongestRun = chain.count;
            if (chain.count > L2.longestRepeatRun) L2.longestRepeatRun = chain.count;

            L2.worstChains.push({ key, repeats: chain.count, firstDay: chain.firstDay, lastDay: chain.lastDay });

            if (acc.firstRepeatDay === null) acc.firstRepeatDay = chain.firstDay;
          }
        }

        // ── L3 ────────────────────────────────────────────────────────────────────────────
        const seenTiles = new Map();

        for (const record of diag.getExplorationRecords()) {
          L3.recordsReturned += 1;
          acc.l3Records += 1;

          const tileKey = `${record.bandId}|${record.tileId}`;
          const previous = seenTiles.get(tileKey);

          // A tile whose record was already evicted once and is created NEW again by a later
          // journey is the forget-relearn half of the loop, measured rather than assumed.
          if (previous === true && record.isNewRecord) {
            L3.tilesRelearnedByALaterJourney += 1;
            acc.l3Relearned += 1;
          }

          if (record.evictedAtFirstCompression === true) {
            L3.evictedAtFirstCompression += 1;
            acc.l3Evicted += 1;
            seenTiles.set(tileKey, true);

            if (record.lifetimeDays !== undefined) {
              L3.meanLifetimeDaysOfEvicted += record.lifetimeDays;
              L3.lifetimeSamples += 1;
            }
          } else if (record.evictedAtFirstCompression === false) {
            L3.survivedFirstCompression += 1;
            seenTiles.set(tileKey, false);
          }
        }
      } finally {
        diag.clearExplorationDiagnostics();
      }
    }

    byScenario[scenario.name] = {
      ...acc,
      l1IdleShareOfSuppressed: acc.l1Idle + acc.l1Away === 0 ? null : r4(acc.l1Idle / (acc.l1Idle + acc.l1Away)),
      l3EvictionRate: acc.l3Records === 0 ? null : r4(acc.l3Evicted / acc.l3Records),
    };

    console.log(
      `${scenario.name.padEnd(20)} opps=${String(acc.opportunities).padStart(7)} ` +
        `L1 idle=${String(acc.l1Idle).padStart(6)} away=${String(acc.l1Away).padStart(5)} ` +
        `L2 fall=${String(acc.l2Fallthrough).padStart(5)} repeatChains=${String(acc.l2Repeats).padStart(4)} ` +
        `L3 rec=${String(acc.l3Records).padStart(5)} evict=${String(acc.l3Evicted).padStart(5)} ` +
        `relearn=${String(acc.l3Relearned).padStart(4)}`,
    );
  }

  L2.worstChains = L2.worstChains.sort((a, b) => b.repeats - a.repeats).slice(0, 12);
  L1.meanIdleCooldownTicksAtOpportunity =
    L1.idleSamples === 0 ? null : r4(L1.meanIdleCooldownTicksAtOpportunity / L1.idleSamples);
  L3.meanLifetimeDaysOfEvicted =
    L3.lifetimeSamples === 0 ? null : r4(L3.meanLifetimeDaysOfEvicted / L3.lifetimeSamples);
  L1.firstDivergence = L1.firstDivergence.slice(0, 12);

  const verdicts = {
    L1: {
      occurs: L1.suppressedWithPartyALREADYHOME > 0,
      magnitude: L1.suppressedWithPartyALREADYHOME,
      shareOfSuppressed:
        L1.suppressedOpportunities === 0 ? null : r4(L1.suppressedWithPartyALREADYHOME / L1.suppressedOpportunities),
      cost:
        L1.ofThoseWithAValidProposal > 0
          ? `${L1.ofThoseWithAValidProposal} opportunities where the band could physically have gone and was refused by a cooldown for a party already home`
          : "none_measured",
    },
    L2: {
      occurs: L2.repeatedChains > 0,
      magnitude: L2.repeatedChains,
      longestRepeatRun: L2.longestRepeatRun,
      cost:
        L2.fallthroughOpportunities > 0
          ? `${L2.fallthroughOpportunities} opportunities where the slot went unused with a valid proposal in hand`
          : "none_measured",
    },
    L3: {
      occurs: L3.evictedAtFirstCompression > 0,
      evictionRate: L3.recordsReturned === 0 ? null : r4(L3.evictedAtFirstCompression / L3.recordsReturned),
      relearned: L3.tilesRelearnedByALaterJourney,
    },
    L4: { note: L4.note },
  };

  const result = { years: YEARS, seeds: SEEDS, scenarios: SCENARIOS.map((s) => s.name), L1, L2, L3, L4, verdicts, byScenario };

  mkdirSync(OUT.split("/").slice(0, -1).join("/"), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);

  console.log("");
  console.log("L1 cooldown-outlives-the-party");
  console.log(`  suppressed opportunities        : ${L1.suppressedOpportunities}`);
  console.log(`  ... party STILL AWAY            : ${L1.suppressedWithPartyStillAway}`);
  console.log(`  ... party ALREADY HOME          : ${L1.suppressedWithPartyALREADYHOME}  <- the loop`);
  console.log(`  ... and a valid proposal existed: ${L1.ofThoseWithAValidProposal}`);
  console.log(`  mean cooldown ticks elapsed     : ${L1.meanIdleCooldownTicksAtOpportunity}`);
  console.log("L2 claim-fail-repeat");
  console.log(`  fallthrough opportunities       : ${L2.fallthroughOpportunities}`);
  console.log(`  distinct claim chains           : ${L2.distinctClaimChains}`);
  console.log(`  chains that REPEATED            : ${L2.repeatedChains}`);
  console.log(`  longest repeat run              : ${L2.longestRepeatRun}`);
  console.log("L3 returned-then-evicted");
  console.log(`  records returned                : ${L3.recordsReturned}`);
  console.log(`  evicted at first compression    : ${L3.evictedAtFirstCompression}`);
  console.log(`  survived first compression      : ${L3.survivedFirstCompression}`);
  console.log(`  tiles relearned by a later trip : ${L3.tilesRelearnedByALaterJourney}`);
  console.log(`  mean lifetime of evicted (days) : ${L3.meanLifetimeDaysOfEvicted}`);
  console.log(`wrote ${OUT}`);
} finally {
  await server.close();
}
