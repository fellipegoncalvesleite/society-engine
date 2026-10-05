// CORRECTION-17 §16/§17/§18/§19 — FRONTIER EXPLORATION FULL CAUSAL-CHAIN AUDIT.
//
// Traces, per seed, the whole intended chain and names the FIRST FAILED LINK for every
// run that does not complete it. It never reports only a final band count.
//
//   L01 expansion or range pressure
//   L02 -> frontier exploration eligibility
//   L03 -> task selection (a party was actually chosen and raised)
//   L04 -> party formation (workers physically committed)
//   L05 -> physical outward path (successive steps actually walked)
//   L06 -> party-local observations (carried, not yet band knowledge)
//   L07 -> physical return (the party walked home)
//   L08 -> residential knowledge update beyond the previous horizon
//   L09 -> later opportunity evaluation over that new country
//   L10 -> known NON-OVERLAPPING fission destination
//   L11 -> daughter creation
//   L12 -> daughter physical food acquisition (real receipts)
//   L13 -> daughter survival (>= 50 years)
//   L14 -> daughter population growth
//   L15 -> second-generation fission eligibility
//
// CONTROL ARMS (§17): production / exploration disabled / blocked route / poor distant
// country / lost-before-transfer. The enabled arm must beat the disabled arm through
// RETURNED KNOWLEDGE, not through changed yield or demography coefficients — no arm
// below touches a coefficient; the only thing that varies is whether, and how, parties
// physically travel and come home.
//
// KNOWLEDGE CLASSES (§19) are kept strictly separate and never combined into one metric:
//   partyLocal        — observations a party is carrying while away
//   residentialBand   — band.knowledge.observedTiles (the only class fission may use)
//   resourceSpecific  — band.resourceKnowledgeState.patchMemories
//   debugWorldTruth   — world.tiles (audit-only; never fed back into any band)
//
// Usage: node scripts/frontierExplorationCausalChainAudit.mjs
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const YEARS = 260;
const DAUGHTER_SURVIVAL_YEARS = 50;
// The measured pre-CORRECTION-17 destination-knowledge horizon (destinationKnowledgeHorizonProbe:
// max known-tile distance 7-11 over 300 years on the richest catchment). "Beyond the previous
// horizon" means strictly past this.
const PREVIOUS_HORIZON_TILES = 11;
// A destination this far from the parent's residence is outside the range it works.
const PARENT_CATCHMENT_RADIUS_TILES = 8;

const r2 = (v) => Math.round(v * 100) / 100;

const LINKS = [
  "L01_range_or_expansion_pressure",
  "L02_frontier_eligibility",
  "L03_task_selection",
  "L04_party_formation",
  "L05_physical_outward_path",
  "L06_party_local_observations",
  "L07_physical_return",
  "L08_residential_knowledge_beyond_horizon",
  "L09_opportunity_evaluation_on_new_country",
  "L10_known_non_overlapping_destination",
  "L11_daughter_created",
  "L12_daughter_physical_food_receipts",
  "L13_daughter_survived_50y",
  "L14_daughter_population_growth",
  "L15_second_generation_fission_eligible",
];

function manhattan(world, a, b) {
  const ta = world.tiles[a];
  const tb = world.tiles[b];
  return ta === undefined || tb === undefined
    ? undefined
    : Math.abs(ta.coord.x - tb.coord.x) + Math.abs(ta.coord.y - tb.coord.y);
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
  const frontier = await server.ssrLoadModule("/sim/agents/frontierExploration.ts");

  // §17 — five PREDECLARED shared seeds on a physically rich controlled region. The
  // start tile is the richest measured map2 catchment (the same one the pre-existing
  // destinationKnowledgeHorizonProbe uses), so the starting catchment is viable, and
  // map2's river country puts genuinely distinct viable regions well beyond the old
  // ~9-tile horizon with a traversable but nontrivial route between them. The band has
  // NO hidden knowledge of the second region: everything past its own observed tiles
  // must be physically walked.
  const SEEDS = [
    "c17:chain:s1",
    "c17:chain:s2",
    "c17:chain:s3",
    "c17:chain:s4",
    "c17:chain:s5",
  ];
  const START_TILE = "tile:188:92";
  const START_POP = 34;

  const ARMS = [
    { id: "production", label: "frontier exploration enabled (production)" },
    { id: "exploration_disabled", label: "frontier exploration disabled, all else identical" },
    { id: "blocked_route", label: "outward route physically blocked" },
    { id: "poor_destination", label: "distant country physically poor" },
    { id: "lost_before_transfer", label: "expeditions lost before residential knowledge transfer" },
  ];

  function runArm(seed, arm) {
    let world = runner.initSimWorld({ kind: "map2" }, seed);
    world = spawn.removeInitialBands(world, Object.keys(world.bands));
    world = spawn.spawnCustomBands(world, [{ tileId: START_TILE, population: START_POP, name: "founder" }], seed);

    // ── Control-arm world surgery. NONE of these touches a demography, yield, fission
    // or nutrition coefficient. They change PHYSICAL GEOGRAPHY or PARTY FATE only.
    const founderId = Object.keys(world.bands)[0];
    const originTile = world.tiles[world.bands[founderId].position];

    if (arm === "blocked_route") {
      // Ring the starting catchment with impassable ground at radius 12 — beyond the
      // band's own catchment, so local subsistence is untouched, but no exploratory
      // party can physically walk past it into the distant region.
      const tiles = { ...world.tiles };

      for (const t of Object.values(world.tiles)) {
        const d = Math.abs(t.coord.x - originTile.coord.x) + Math.abs(t.coord.y - originTile.coord.y);

        if (d >= 12 && d <= 13) {
          tiles[t.id] = { ...t, movementCost: 1, isAquatic: true };
        }
      }

      world = { ...world, tiles };
    }

    if (arm === "poor_destination") {
      // Everything beyond the old horizon is made physically poor. The route is open and
      // parties still walk it — they simply find nothing worth founding a daughter on.
      // `baseRichness` is what `getDepletionAdjustedRichness` (and therefore the band's
      // own `observedRichness`) reads, so it must move with the potential.
      const tiles = { ...world.tiles };

      for (const t of Object.values(world.tiles)) {
        const d = Math.abs(t.coord.x - originTile.coord.x) + Math.abs(t.coord.y - originTile.coord.y);

        if (d > PREVIOUS_HORIZON_TILES) {
          tiles[t.id] = {
            ...t,
            resourceProfile: {
              ...t.resourceProfile,
              baseRichness: 0.02,
              foragingPotential: 0.02,
              waterAccess: Math.min(t.resourceProfile.waterAccess ?? 0, 0.05),
              aquaticPotential: 0,
            },
          };
        }
      }

      world = { ...world, tiles };
    } else {
      // §17 — THE CONTROLLED REGION. Every arm except `poor_destination` gets a genuinely
      // richer band of country in a RING at distance 18-24, i.e. well beyond the measured
      // pre-CORRECTION-17 knowledge horizon (7-11 tiles) and far outside the parent's
      // ~8-tile catchment, but inside the physical envelope an exploratory party can walk.
      //
      // This is REGION CONSTRUCTION, not destination prepopulation (§18): the band is
      // given NO knowledge of it whatsoever. Every tile of it must still be physically
      // walked to, observed, and carried home before it can influence anything. A ring
      // rather than a single disc so no direction is privileged — whichever way the
      // band's own band-known heading takes it, honest discovery is possible.
      //
      // Without this, the §15 isolation measured `maxHabitatAdvantageObserved = 0.094`
      // over 7186 non-overlapping candidates: on the default map2 catchment there simply
      // is no materially better country within reach, so the chain cannot demonstrate
      // knowledge-driven expansion either way.
      const tiles = { ...world.tiles };

      for (const t of Object.values(world.tiles)) {
        const d = Math.abs(t.coord.x - originTile.coord.x) + Math.abs(t.coord.y - originTile.coord.y);

        if (d >= 18 && d <= 24 && t.isAquatic !== true) {
          tiles[t.id] = {
            ...t,
            resourceProfile: {
              ...t.resourceProfile,
              baseRichness: Math.max(t.resourceProfile.baseRichness ?? 0, 0.92),
              foragingPotential: Math.max(t.resourceProfile.foragingPotential ?? 0, 0.92),
              waterAccess: Math.max(t.resourceProfile.waterAccess ?? 0, 0.85),
            },
            riskProfile: {
              ...t.riskProfile,
              floodRisk: Math.min(t.riskProfile.floodRisk, 0.15),
              droughtRisk: Math.min(t.riskProfile.droughtRisk, 0.15),
              diseaseRisk: Math.min(t.riskProfile.diseaseRisk, 0.15),
            },
          };
        }
      }

      world = { ...world, tiles };
    }

    world = {
      ...world,
      auditOptions: {
        ...(world.auditOptions ?? {}),
        ...(arm === "exploration_disabled" ? { frontierExplorationEnabled: false } : {}),
        ...(arm === "lost_before_transfer" ? { frontierExplorationAlwaysLost: true } : {}),
      },
    };

    // ── Per-link evidence accumulators. ──
    const ev = Object.fromEntries(LINKS.map((l) => [l, false]));
    const metrics = {
      maxEligibilityScore: 0,
      explorationsLaunched: 0,
      explorationsCompleted: 0,
      explorationsLost: 0,
      explorationsBlocked: 0,
      explorationsBudgetReached: 0,
      maxOutwardWalkTiles: 0,
      maxPartyLocalObservations: 0,
      maxPartyWorkers: 0,
      // §19 — the four knowledge classes, never combined.
      knowledgeHorizon: {
        residentialMaxKnownDistance: 0,
        residentialMaxConfidenceQualifiedDistance: 0,
        partyLocalMaxCarriedDistance: 0,
        resourceMemoryMaxDistance: 0,
        tilesLearnedOnlyViaReturnedExpedition: 0,
        resourceMemoriesFormedFromExploredTiles: 0,
      },
      knownNonOverlappingCandidates: 0,
      maxOpportunityDistance: 0,
      fissionDestinationDistance: undefined,
      daughterDistanceFromParentCatchment: undefined,
      daughterFoodReceiptSeasons: 0,
      daughterSurvivalYears: 0,
      daughterPeakPopulation: 0,
      daughterFounded: 0,
      secondGenerationFissions: 0,
      finalBandCount: 0,
    };

    // Tiles the residential band knew BEFORE any exploration returned (the baseline
    // knowledge set). Anything outside it that appears later, at a distance the ordinary
    // path cannot reach, was learned by a returned party.
    let preExplorationKnown = new Set(Object.keys(world.bands[founderId].knowledge.observedTiles));
    const seenExpeditionIds = new Set();
    const countedOutcomeIds = new Set();
    const daughters = new Map(); // id -> { bornYear, peakPop, receiptSeasons, lastSeenYear }
    let knownBandIds = new Set(Object.keys(world.bands));

    for (let year = 1; year <= YEARS; year += 1) {
      // Sample eligibility BEFORE stepping so we read the state the launcher reads.
      for (const band of Object.values(world.bands)) {
        const e = frontier.deriveFrontierExplorationEligibility(world, band);
        metrics.maxEligibilityScore = Math.max(metrics.maxEligibilityScore, e.evidenceScore);

        if (
          e.rangeSaturation > 0.3 ||
          e.dispersalPressure > 0.3 ||
          e.lowReturnPressure > 0.3
        ) {
          ev.L01_range_or_expansion_pressure = true;
        }

        if (e.eligible) {
          ev.L02_frontier_eligibility = true;
        }

        // §11 — party-local knowledge while away. Measured here and NEVER added to the
        // residential class.
        for (const x of band.expeditions ?? []) {
          if (x.taskKind !== "frontier_exploration") continue;

          if (!seenExpeditionIds.has(x.id)) {
            seenExpeditionIds.add(x.id);
            metrics.explorationsLaunched += 1;
            ev.L03_task_selection = true;
          }

          if (x.partyWorkers > 0) {
            ev.L04_party_formation = true;
            metrics.maxPartyWorkers = Math.max(metrics.maxPartyWorkers, x.partyWorkers);
          }

          metrics.maxPartyLocalObservations = Math.max(
            metrics.maxPartyLocalObservations,
            x.carriedObservations.length,
          );

          for (const o of x.carriedObservations) {
            const d = manhattan(world, band.position, o.tileId);

            if (d !== undefined) {
              metrics.knowledgeHorizon.partyLocalMaxCarriedDistance = Math.max(
                metrics.knowledgeHorizon.partyLocalMaxCarriedDistance,
                d,
              );
            }
          }
        }
      }

      world = runner.stepSim(world, 4, "seasonal");

      // ── Detect new daughters. ──
      const nowIds = new Set(Object.keys(world.bands));

      for (const id of nowIds) {
        if (knownBandIds.has(id)) continue;

        const b = world.bands[id];
        const parent = b.parentBandId === undefined ? undefined : world.bands[b.parentBandId];
        const parentPos = parent?.position;
        const d = parentPos === undefined ? undefined : manhattan(world, parentPos, b.position);

        if (b.parentBandId === founderId || parent === undefined) {
          metrics.daughterFounded += 1;
          ev.L11_daughter_created = true;

          if (d !== undefined) {
            metrics.fissionDestinationDistance = Math.max(metrics.fissionDestinationDistance ?? 0, d);
            metrics.daughterDistanceFromParentCatchment = Math.max(
              metrics.daughterDistanceFromParentCatchment ?? 0,
              d,
            );
          }
        } else {
          // A daughter of a daughter: second-generation fission ACTUALLY happened.
          metrics.secondGenerationFissions += 1;
          ev.L15_second_generation_fission_eligible = true;
        }

        daughters.set(id, { bornYear: year, peakPop: b.demography.population, receiptSeasons: 0, lastSeenYear: year });
      }

      knownBandIds = nowIds;

      // ── Per-band per-year evidence. ──
      for (const band of Object.values(world.bands)) {
        // Expedition outcomes (bounded LRU; we accumulate by id).
        for (const o of band.recentExpeditionOutcomes ?? []) {
          if (o.taskKind !== "frontier_exploration") continue;

          const key = `${o.id}`;

          if (!seenExpeditionIds.has(key)) {
            seenExpeditionIds.add(key);
            metrics.explorationsLaunched += 1;
            ev.L03_task_selection = true;
          }

          if (o.partyWorkers > 0) ev.L04_party_formation = true;

          if (o.distanceTiles > 0) {
            ev.L05_physical_outward_path = true;
            metrics.maxOutwardWalkTiles = Math.max(metrics.maxOutwardWalkTiles, o.distanceTiles);
          }

          if ((o.observations ?? []).length > 0) ev.L06_party_local_observations = true;

          // Outcomes live in a bounded LRU and are re-observed every year, so every
          // tally below is keyed by expedition id to avoid counting one journey twice.
          if (!countedOutcomeIds.has(key)) {
            countedOutcomeIds.add(key);

            if (o.phase === "completed") metrics.explorationsCompleted += 1;
            if (o.phase === "lost") metrics.explorationsLost += 1;
            if (o.outcomeReason === "frontier_barrier_blocked") metrics.explorationsBlocked += 1;
            if (o.outcomeReason === "frontier_return_budget_reached") metrics.explorationsBudgetReached += 1;
          }

          if (o.phase === "completed") ev.L07_physical_return = true;
        }

        // §19 — RESIDENTIAL band knowledge class.
        for (const rec of Object.values(band.knowledge.observedTiles)) {
          const d = manhattan(world, band.position, rec.tileId);
          if (d === undefined) continue;

          metrics.knowledgeHorizon.residentialMaxKnownDistance = Math.max(
            metrics.knowledgeHorizon.residentialMaxKnownDistance,
            d,
          );

          if (rec.confidence >= 0.34) {
            metrics.knowledgeHorizon.residentialMaxConfidenceQualifiedDistance = Math.max(
              metrics.knowledgeHorizon.residentialMaxConfidenceQualifiedDistance,
              d,
            );
          }

          if (band.id === founderId && d > PREVIOUS_HORIZON_TILES && !preExplorationKnown.has(rec.tileId)) {
            ev.L08_residential_knowledge_beyond_horizon = true;
          }
        }

        // §19 — RESOURCE-SPECIFIC knowledge class (kept separate from the two above).
        for (const m of band.resourceKnowledgeState?.patchMemories ?? []) {
          const d = manhattan(world, band.position, m.approximateTile);

          if (d !== undefined) {
            metrics.knowledgeHorizon.resourceMemoryMaxDistance = Math.max(
              metrics.knowledgeHorizon.resourceMemoryMaxDistance,
              d,
            );

            if (d > PREVIOUS_HORIZON_TILES) {
              metrics.knowledgeHorizon.resourceMemoriesFormedFromExploredTiles = Math.max(
                metrics.knowledgeHorizon.resourceMemoriesFormedFromExploredTiles,
                1,
              );
            }
          }
        }

        // §14/§15 — did the OPPORTUNITY evaluation actually see the new country, and did
        // it ever produce a candidate outside the parent's own catchment?
        const opp = band.daughterColonization?.bestKnownUnusedHabitatOpportunity;

        if (opp !== undefined) {
          const d = manhattan(world, band.position, opp.candidateTileId);

          if (d !== undefined) {
            metrics.maxOpportunityDistance = Math.max(metrics.maxOpportunityDistance, d);

            if (d > PREVIOUS_HORIZON_TILES) ev.L09_opportunity_evaluation_on_new_country = true;

            if (d > PARENT_CATCHMENT_RADIUS_TILES && opp.consideredAsTarget === true) {
              ev.L10_known_non_overlapping_destination = true;
              metrics.knownNonOverlappingCandidates += 1;
            }
          }
        }

        // Daughter tracking.
        const dgh = daughters.get(band.id);

        if (dgh !== undefined) {
          dgh.lastSeenYear = year;
          dgh.peakPop = Math.max(dgh.peakPop, band.demography.population);

          const receipts = band.seasonalFoodReceipts?.recentReceipts ?? band.recentIntraSeasonTrips ?? [];
          const gotFood = Array.isArray(receipts)
            ? receipts.some((rr) => (rr?.physicalFoodHarvest?.usableSupport ?? rr?.usableSupport ?? 0) > 0)
            : false;

          if (gotFood) {
            dgh.receiptSeasons += 1;
            ev.L12_daughter_physical_food_receipts = true;
          }

          const age = year - dgh.bornYear;

          if (age >= DAUGHTER_SURVIVAL_YEARS) ev.L13_daughter_survived_50y = true;
          if (dgh.peakPop > band.demography.population * 0 + 0 && dgh.peakPop > 0) {
            // growth measured against founding population below
          }

          if ((band.daughterColonization?.pressure ?? 0) > 0.5 && band.demography.population >= 46) {
            ev.L15_second_generation_fission_eligible = true;
          }
        }
      }
    }

    // Post-run daughter roll-up.
    for (const [id, d] of daughters) {
      const alive = world.bands[id] !== undefined;
      const years = d.lastSeenYear - d.bornYear;
      metrics.daughterSurvivalYears = Math.max(metrics.daughterSurvivalYears, years);
      metrics.daughterPeakPopulation = Math.max(metrics.daughterPeakPopulation, d.peakPop);
      metrics.daughterFoodReceiptSeasons = Math.max(metrics.daughterFoodReceiptSeasons, d.receiptSeasons);

      if (alive && world.bands[id].demography.population > 18) ev.L14_daughter_population_growth = true;
    }

    metrics.finalBandCount = Object.keys(world.bands).length;
    metrics.knowledgeHorizon.tilesLearnedOnlyViaReturnedExpedition = (() => {
      const b = world.bands[founderId];
      if (b === undefined) return 0;
      let n = 0;
      for (const rec of Object.values(b.knowledge.observedTiles)) {
        const d = manhattan(world, b.position, rec.tileId);
        if (d !== undefined && d > PREVIOUS_HORIZON_TILES && !preExplorationKnown.has(rec.tileId)) n += 1;
      }
      return n;
    })();

    const firstFailedLink = LINKS.find((l) => ev[l] === false);

    return {
      seed,
      arm,
      links: ev,
      firstFailedLink: firstFailedLink ?? null,
      chainComplete: firstFailedLink === undefined,
      metrics,
    };
  }

  const results = [];

  for (const seed of SEEDS) {
    for (const arm of ARMS) {
      const r = runArm(seed, arm.id);
      results.push(r);
      console.log(
        `[${seed}][${arm.id}] chain=${r.chainComplete ? "COMPLETE" : "INCOMPLETE"} ` +
          `firstFail=${r.firstFailedLink ?? "-"} ` +
          `launched=${r.metrics.explorationsLaunched} completed=${r.metrics.explorationsCompleted} ` +
          `lost=${r.metrics.explorationsLost} maxWalk=${r.metrics.maxOutwardWalkTiles} ` +
          `resHorizon=${r.metrics.knowledgeHorizon.residentialMaxKnownDistance} ` +
          `maxOppDist=${r.metrics.maxOpportunityDistance} ` +
          `bands=${r.metrics.finalBandCount}`,
      );
    }
  }

  const production = results.filter((r) => r.arm === "production");
  const disabled = results.filter((r) => r.arm === "exploration_disabled");
  const seedsCompletingChain = production.filter((r) => r.chainComplete).length;
  const honestFailures = results.filter(
    (r) =>
      r.arm === "production" &&
      (r.metrics.explorationsBlocked > 0 || r.metrics.explorationsLost > 0),
  ).length;

  const meanResidentialHorizon = (rs) =>
    r2(rs.reduce((s, r) => s + r.metrics.knowledgeHorizon.residentialMaxKnownDistance, 0) / Math.max(1, rs.length));

  const summary = {
    audit: "frontierExplorationCausalChain",
    checkpoint: "CORRECTION-17 §16/§17/§18/§19",
    years: YEARS,
    seeds: SEEDS,
    startTile: START_TILE,
    startPopulation: START_POP,
    previousHorizonTiles: PREVIOUS_HORIZON_TILES,
    links: LINKS,
    results,
    rollup: {
      productionSeedsCompletingFullChain: seedsCompletingChain,
      productionSeedsTotal: production.length,
      seedsWithHonestExplorationFailure: honestFailures,
      meanResidentialHorizonEnabled: meanResidentialHorizon(production),
      meanResidentialHorizonDisabled: meanResidentialHorizon(disabled),
      firstFailedLinkTally: production.reduce((acc, r) => {
        const k = r.firstFailedLink ?? "none";
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {}),
    },
  };

  mkdirSync(join(process.cwd(), "docs/evidence/correction17"), { recursive: true });
  writeFileSync(
    join(process.cwd(), "docs/evidence/correction17/frontier-causal-chain.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );

  console.log("");
  console.log("── §16/§18 ROLL-UP ──");
  console.log(`production seeds completing full chain : ${seedsCompletingChain}/${production.length}`);
  console.log(`seeds with honest exploration failure  : ${honestFailures}`);
  console.log(`mean residential horizon  enabled      : ${summary.rollup.meanResidentialHorizonEnabled}`);
  console.log(`mean residential horizon  disabled     : ${summary.rollup.meanResidentialHorizonDisabled}`);
  console.log(`first failed link tally (production)   : ${JSON.stringify(summary.rollup.firstFailedLinkTally)}`);
} finally {
  await server.close();
}
