// CORRECTION-24A COMPLETION §6/§7/§9/§10/§11/§12/§15 — THE ORDINARY-EXPLORATION CAUSAL CHAIN.
//
// The first pass measured the LAUNCH funnel and stopped there. It could say that bands almost always
// want to look further and are told to wait three years, and that on the days they are free the
// question is often never put to them — but it could not say whether a party that DOES go brings
// anything home, whether what it brings survives the year, or whether anything reads it. Those are
// the questions that decide whether the launch throttle is a defect at all.
//
// So this audit runs the whole chain and refuses to collapse any link into the next:
//
//   E0/E1/E2  did the band want to go, have a direction, and could it physically leave?
//   E3        was it offered the slot, and if not, did the family that took it actually go?
//   E4        what did the party physically do?
//   E5        what reached the canonical writer, and did it survive its first compression?
//   E6        did any production reader change a PHYSICAL ACTION because of it?
//
// E6 is a SAME-SNAPSHOT COUNTERFACTUAL, not a read counter. CORRECTION-23H's instrument bug #2
// counted "consumed" whenever a pure function returned a value and reported 100% consumption for
// questions with no reader at all. Here one identical band is evaluated twice through the real
// production decision function — once as it stands, once with its exploration-derived records
// removed — and only a DIFFERENT SELECTED ACTION counts. A score that moves without changing the
// action is recorded separately and explicitly does not count.
//
// Usage:
//   node scripts/explorationCausalChainAudit.mjs [--years 40] [--seeds s1,..] [--arm O0]
//                                                [--scenarios map1,map2] [--reader movement_destination]
//                                                [--e6-sample 4] [--out path]
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt;
};

const YEARS = Number(arg("years", "40"));
const SEEDS = arg("seeds", "s1,s2,s3,s4,s5").split(",").filter(Boolean);
const ARM = arg("arm", "O0");
const READER = arg("reader", "");
const SEED_PREFIX = arg("seed-prefix", "c24a:chain");
const E6_SAMPLE_YEARS = Number(arg("e6-sample", "4"));
const OUT = arg("out", `docs/evidence/correction24a/chain-${ARM}-${YEARS}y.json`);

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

const only = arg("scenarios", "");
const SCENARIOS = only === "" ? ALL_SCENARIOS : ALL_SCENARIOS.filter((s) => only.split(",").includes(s.name));

const r4 = (v) => (v === null || v === undefined ? null : Math.round(v * 10000) / 10000);
const inc = (obj, key, by = 1) => {
  obj[key] = (obj[key] ?? 0) + by;
};

const server = await createServer({
  root: `${process.cwd()}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const spawn = await server.ssrLoadModule("/sim/agents/spawn.ts");
  const diag = await server.ssrLoadModule("/sim/diagnostics/explorationFunnelDiagnostics.ts");
  const decision = await server.ssrLoadModule("/sim/rules/bandDecision.ts");

  const isLiving = (band) =>
    band.viability?.status !== "extinct" &&
    band.viability?.status !== "absorbed" &&
    band.viability?.status !== "dispersed" &&
    (band.demography?.population ?? 0) > 0;

  /**
   * §11 E6 — one same-snapshot reader counterfactual for one band.
   *
   * Returns the production action, the action the same band would have selected with its
   * exploration-derived records removed, and whether the two differ. Nothing is mutated: the band is
   * cloned and the clone is discarded.
   */
  const readerCounterfactual = (world, band) => {
    const observed = band.knowledge.observedTiles;
    const explorationTileIds = Object.keys(observed).filter(
      (tileId) => observed[tileId]?.acquisition === "returned_frontier_exploration",
    );

    if (explorationTileIds.length === 0) {
      return undefined;
    }

    const stripped = {};

    for (const [tileId, record] of Object.entries(observed)) {
      if (record?.acquisition !== "returned_frontier_exploration") {
        stripped[tileId] = record;
      }
    }

    const withoutBand = {
      ...band,
      knowledge: { ...band.knowledge, observedTiles: stripped },
    };
    const withoutWorld = { ...world, bands: { ...world.bands, [band.id]: withoutBand } };

    let production;
    let without;

    try {
      production = decision.evaluateBandDecision(world, band);
      without = decision.evaluateBandDecision(withoutWorld, withoutBand);
    } catch {
      return undefined;
    }

    const actionOf = (d) => JSON.stringify(d.action ?? null);
    const kindOf = (d) => String(d.action?.type ?? "none");
    const scoreOf = (d) => Number(d.alternativesConsidered?.[0]?.score ?? 0);

    // POSITIVE CONTROL. A zero from this probe is only evidence if the probe can detect anything at
    // all: strip EVERY known tile from the same band and the selected action must move. Without
    // this, "no reader changed an action" is indistinguishable from "the instrument is inert",
    // which is the exact failure mode CORRECTION-23H's instrument bug #2 shipped.
    let controlChanged = false;

    try {
      const blindBand = { ...band, knowledge: { ...band.knowledge, observedTiles: {} } };
      const blindWorld = { ...world, bands: { ...world.bands, [band.id]: blindBand } };
      controlChanged = actionOf(decision.evaluateBandDecision(blindWorld, blindBand)) !== actionOf(production);
    } catch {
      controlChanged = false;
    }

    return {
      controlChanged,
      explorationRecords: explorationTileIds.length,
      actionBefore: kindOf(without),
      actionAfter: kindOf(production),
      // §11 — a SELECTED ACTION difference. Not a score difference, not a reader returning a value.
      changedSelectedAction: actionOf(production) !== actionOf(without),
      // Recorded separately and explicitly NOT counted as consumption.
      scoreMovedOnly: actionOf(production) === actionOf(without) && scoreOf(production) !== scoreOf(without),
      verdictBefore: r4(scoreOf(without)),
      verdictAfter: r4(scoreOf(production)),
    };
  };

  // §15 — ONE place that turns a funnel row into counters, so the yearly drain inside the day loop
  // and the final read after it cannot drift apart and count a row differently.
  const countFunnelRow = (acc, row) => {
    acc.opportunities += 1;
    inc(acc.blockers, row.primaryBlocker);
    inc(acc.firstStep, row.firstStepOutcome);
    if (row.eligibleExplorationIntent) acc.eligibleIntents += 1;
    if (row.physicallyValidExplorationProposal) acc.physicallyValidProposals += 1;
    if (row.primaryBlocker === "SELECTED") acc.launches += 1;
    if (row.suppressionWindowActive) acc.suppressionActive += 1;
    if (row.activeFrontierParty) acc.activeFrontierParty += 1;
    if (row.explorationOffered) acc.offered += 1;
    if (row.eligible) acc.motiveEligible += 1;
    if (row.headingAvailable) acc.headingAvailable += 1;
    if (row.returnReserveTiles <= 0) acc.returnReserveZero += 1;
    if (row.claimedBy !== undefined) inc(acc.claimedBy, row.claimedBy);
    if (row.claimFailure !== undefined) inc(acc.claimFailures, row.claimFailure);
    if (row.fallthroughOpportunity) acc.fallthroughOpportunities += 1;
  };

  const byScenario = {};
  const totals = {
    opportunities: 0,
    blockers: {},
    eligibleIntents: 0,
    physicallyValidProposals: 0,
    launches: 0,
    fallthroughOpportunities: 0,
    claimFailures: {},
    claimedBy: {},
    journeys: 0,
    lostJourneys: 0,
    lostTransferredObservations: 0,
    records: 0,
    newRecords: 0,
    evictedAtFirstCompression: 0,
    e6Probes: 0,
    e6ChangedAction: 0,
    e6ScoreOnly: 0,
    e6ControlChanged: 0,
    pairingViolations: 0,
  };

  for (const scenario of SCENARIOS) {
    const acc = {
      opportunities: 0,
      blockers: {},
      firstStep: {},
      eligibleIntents: 0,
      physicallyValidProposals: 0,
      launches: 0,
      suppressionActive: 0,
      activeFrontierParty: 0,
      offered: 0,
      claimedBy: {},
      claimFailures: {},
      fallthroughOpportunities: 0,
      motiveEligible: 0,
      headingAvailable: 0,
      returnReserveZero: 0,
      // E4
      journeys: 0,
      lostJourneys: 0,
      lostTransferredObservations: 0,
      forcedReturns: 0,
      meanRouteSteps: 0,
      meanDeepestReach: 0,
      meanNewTilesEntered: 0,
      meanDurationDays: 0,
      // E5
      records: 0,
      newRecords: 0,
      refreshedRecords: 0,
      evictedAtFirstCompression: 0,
      survivedFirstCompression: 0,
      meanLifetimeDays: 0,
      lifetimeSamples: 0,
      // E6
      e6Probes: 0,
      e6ChangedAction: 0,
      e6ScoreOnly: 0,
      e6ControlChanged: 0,
      e6ByAction: {},
      // outcome
      finalPopulation: 0,
      survived: 0,
      pairing: { written: 0, consumed: 0, keyMismatch: 0, overwritten: 0, leftover: 0 },
    };

    for (const seed of SEEDS) {
      diag.setExplorationFunnelRecording(true, scenario.name);
      diag.setExplorationJourneyRecording(true);
      diag.setExplorationRecordRecording(true);
      diag.setExplorationArm(ARM, READER === "" ? undefined : READER);

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

        // O3 — the journey happens; only the residential hand-off after physical return is
        // suppressed. Reuses the proven CORRECTION-18 ARM A seam rather than adding a second one.
        if (ARM === "O3") {
          world = { ...world, auditOptions: { ...world.auditOptions, frontierKnowledgeTransferDisabled: true } };
        }

        // O5 — reader isolation. Each family is suppressed at its OWN entry point through
        // `setExplorationArm(ARM, READER)` above, so the two halves of CORRECTION-20's combined
        // opportunity+fission switch are now separable and `frontierKnowledgeHiddenFromFission` is
        // deliberately NOT set here — setting it would suppress two families at once, which §12
        // forbids. `route_corridor` has no seam because it has no reader: corridor memory is
        // written by `updateTravelCorridorMemory` from the residential movement record, never from
        // the exploration knowledge hand-off, so there is nothing to withhold. That is reported as
        // a structural finding, not as a measured zero.

        const days = YEARS * 360;
        const e6Every = E6_SAMPLE_YEARS * 360;

        for (let d = 1; d <= days; d += 1) {
          world = runner.stepSim(world, 1, "daily");

          // §8 — the pairing self-check, asserted every day rather than once at the end.
          const pairing = diag.getOfferStatePairing();

          if (pairing.leftover !== 0 || pairing.keyMismatch !== 0 || pairing.overwritten !== 0) {
            totals.pairingViolations += 1;
          }

          // §11 — sample the reader counterfactual. Every band-year would be far too expensive
          // (it doubles the decision cost), and the question is whether ANY reader ever changes an
          // action, which a periodic sample answers as well as an exhaustive one would.
          if (d % e6Every === 0) {
            for (const band of Object.values(world.bands).filter(isLiving)) {
              const probe = readerCounterfactual(world, band);

              if (probe === undefined) {
                continue;
              }

              acc.e6Probes += 1;

              if (probe.controlChanged) {
                acc.e6ControlChanged += 1;
              }

              if (probe.changedSelectedAction) {
                acc.e6ChangedAction += 1;
                inc(acc.e6ByAction, `${probe.actionBefore}->${probe.actionAfter}`);
              } else if (probe.scoreMovedOnly) {
                acc.e6ScoreOnly += 1;
              }
            }
          }

          // §15 — drain the funnel once per simulated year so a 500-year horizon does not hold
          // hundreds of thousands of opportunity rows at once. Append-only rows, never amended,
          // so draining is identical to reading them all at the end.
          if (d % 360 === 0) {
            for (const row of diag.drainExplorationFunnel()) countFunnelRow(acc, row);
          }

          if (Object.values(world.bands).filter(isLiving).length === 0) break;
        }

        const finalPairing = diag.getOfferStatePairing();
        acc.pairing = {
          written: acc.pairing.written + finalPairing.written,
          consumed: acc.pairing.consumed + finalPairing.consumed,
          keyMismatch: acc.pairing.keyMismatch + finalPairing.keyMismatch,
          overwritten: acc.pairing.overwritten + finalPairing.overwritten,
          leftover: acc.pairing.leftover + finalPairing.leftover,
        };

        const living = Object.values(world.bands).filter(isLiving);
        acc.finalPopulation += living.reduce((sum, b) => sum + (b.demography?.population ?? 0), 0);
        acc.survived += living.length > 0 ? 1 : 0;

        // ── E0–E3 ── whatever the yearly drain has not already taken.
        for (const row of diag.getExplorationFunnel()) countFunnelRow(acc, row);

        // ── E4 ──
        for (const journey of diag.getExplorationJourneys()) {
          acc.journeys += 1;
          if (journey.lost) {
            acc.lostJourneys += 1;
            // §19/§21 — a lost party transfers NOTHING. Asserted, never assumed.
            if (journey.newRecordsCreated > 0 || journey.existingRecordsRefreshed > 0) {
              acc.lostTransferredObservations += 1;
            }
          }
          if (journey.forcedReturn) acc.forcedReturns += 1;
          acc.meanRouteSteps += journey.routeSteps;
          acc.meanDeepestReach += journey.deepestReachTiles;
          acc.meanNewTilesEntered += journey.newTilesEntered;
          acc.meanDurationDays += journey.durationDays ?? 0;
        }

        // ── E5 ──
        for (const record of diag.getExplorationRecords()) {
          acc.records += 1;
          if (record.isNewRecord) acc.newRecords += 1;
          else acc.refreshedRecords += 1;
          if (record.evictedAtFirstCompression === true) {
            acc.evictedAtFirstCompression += 1;
            if (record.lifetimeDays !== undefined) {
              acc.meanLifetimeDays += record.lifetimeDays;
              acc.lifetimeSamples += 1;
            }
          } else if (record.evictedAtFirstCompression === false) {
            acc.survivedFirstCompression += 1;
          }
        }
      } finally {
        diag.clearExplorationDiagnostics();
      }
    }

    const n = Math.max(1, acc.opportunities);
    const j = Math.max(1, acc.journeys);
    byScenario[scenario.name] = {
      ...acc,
      meanRouteSteps: r4(acc.meanRouteSteps / j),
      meanDeepestReach: r4(acc.meanDeepestReach / j),
      meanNewTilesEntered: r4(acc.meanNewTilesEntered / j),
      meanDurationDays: r4(acc.meanDurationDays / j),
      meanLifetimeDays: acc.lifetimeSamples === 0 ? null : r4(acc.meanLifetimeDays / acc.lifetimeSamples),
      motiveRate: r4(acc.motiveEligible / n),
      headingRate: r4(acc.headingAvailable / n),
      eligibleIntentRate: r4(acc.eligibleIntents / n),
      physicallyValidRate: r4(acc.physicallyValidProposals / n),
      launchRate: r4(acc.launches / n),
      fallthroughRate: r4(acc.fallthroughOpportunities / n),
      evictionRate: acc.records === 0 ? null : r4(acc.evictedAtFirstCompression / acc.records),
      e6ChangedActionRate: acc.e6Probes === 0 ? null : r4(acc.e6ChangedAction / acc.e6Probes),
      survivalRate: r4(acc.survived / SEEDS.length),
      meanFinalPopulation: r4(acc.finalPopulation / SEEDS.length),
    };

    totals.opportunities += acc.opportunities;
    totals.eligibleIntents += acc.eligibleIntents;
    totals.physicallyValidProposals += acc.physicallyValidProposals;
    totals.launches += acc.launches;
    totals.fallthroughOpportunities += acc.fallthroughOpportunities;
    totals.journeys += acc.journeys;
    totals.lostJourneys += acc.lostJourneys;
    totals.lostTransferredObservations += acc.lostTransferredObservations;
    totals.records += acc.records;
    totals.newRecords += acc.newRecords;
    totals.evictedAtFirstCompression += acc.evictedAtFirstCompression;
    totals.e6Probes += acc.e6Probes;
    totals.e6ChangedAction += acc.e6ChangedAction;
    totals.e6ScoreOnly += acc.e6ScoreOnly;
    totals.e6ControlChanged += acc.e6ControlChanged;
    for (const [k, v] of Object.entries(acc.blockers)) inc(totals.blockers, k, v);
    for (const [k, v] of Object.entries(acc.claimFailures)) inc(totals.claimFailures, k, v);
    for (const [k, v] of Object.entries(acc.claimedBy)) inc(totals.claimedBy, k, v);

    console.log(
      `${scenario.name.padEnd(20)} opps=${String(acc.opportunities).padStart(7)} ` +
        `intent=${String(acc.eligibleIntents).padStart(5)} valid=${String(acc.physicallyValidProposals).padStart(5)} ` +
        `launch=${String(acc.launches).padStart(4)} fall=${String(acc.fallthroughOpportunities).padStart(5)} ` +
        `journ=${String(acc.journeys).padStart(4)} rec=${String(acc.records).padStart(5)} ` +
        `evict=${String(acc.evictedAtFirstCompression).padStart(5)} ` +
        `e6=${acc.e6ChangedAction}/${acc.e6Probes} pop=${r4(acc.finalPopulation / SEEDS.length)}`,
    );
  }

  const result = {
    arm: ARM,
    ...(READER === "" ? {} : { suppressedReader: READER }),
    years: YEARS,
    seeds: SEEDS,
    scenarios: SCENARIOS.map((s) => s.name),
    // §6 — which launch-time authorities production actually HAS. A class whose authority is false
    // must never be reported as a measured zero.
    launchAuthorities: diag.EXPLORATION_LAUNCH_AUTHORITIES,
    totals,
    byScenario,
  };

  mkdirSync(OUT.split("/").slice(0, -1).join("/"), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);

  console.log("");
  console.log(`arm                          : ${ARM}${READER === "" ? "" : ` (reader ${READER})`}`);
  console.log(`opportunities                : ${totals.opportunities}`);
  console.log(`eligible exploration intent  : ${totals.eligibleIntents}`);
  console.log(`physically valid proposals   : ${totals.physicallyValidProposals}`);
  console.log(`launches                     : ${totals.launches}`);
  console.log(`fallthrough opportunities    : ${totals.fallthroughOpportunities}`);
  console.log(`journeys (E4)                : ${totals.journeys}  lost=${totals.lostJourneys}`);
  console.log(`lost parties that transferred: ${totals.lostTransferredObservations}  (MUST be 0)`);
  console.log(`records returned (E5)        : ${totals.records}  new=${totals.newRecords}`);
  console.log(`evicted at 1st compression   : ${totals.evictedAtFirstCompression}`);
  console.log(`E6 probes                    : ${totals.e6Probes}`);
  console.log(`E6 changed a physical action : ${totals.e6ChangedAction}`);
  console.log(`E6 score moved, action same  : ${totals.e6ScoreOnly}  (explicitly NOT consumption)`);
  console.log(`E6 POSITIVE CONTROL changed  : ${totals.e6ControlChanged}/${totals.e6Probes}  (proves the probe is sensitive)`);
  console.log(`offer-state pairing violations: ${totals.pairingViolations}  (MUST be 0)`);
  console.log("primary blockers, most common first:");
  for (const [k, v] of Object.entries(totals.blockers).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(30)} ${String(v).padStart(8)}  ${r4(v / Math.max(1, totals.opportunities))}`);
  }
  console.log("post-claim failures (§7):");
  for (const [k, v] of Object.entries(totals.claimFailures).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(30)} ${String(v).padStart(8)}`);
  }
  console.log(`wrote ${OUT}`);
} finally {
  await server.close();
}
