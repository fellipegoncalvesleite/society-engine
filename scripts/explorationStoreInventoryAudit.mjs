// CORRECTION-24A FINALIZATION §5 — AUTHORITATIVE-STORE INVENTORY.
//
// The event-paired one-record counterfactual in §6 is valid ONLY if removing one
// `KnownTileRecord` actually removes the exploration-derived fact from EVERY store that can hold
// it. CORRECTION-23H shipped an entire matrix that was silently shadowed because `find()` consulted
// `KnownTileRecord.verificationDisposition` before the bounded list the arm was stripping. This
// audit exists so that cannot happen again, and it answers the question EMPIRICALLY — by running
// real worlds until ordinary exploration has written real records, then asking which other stores
// mention those exact tiles — rather than by reading the code and hoping.
//
// For every store it reports: the writer, whether an exploration return can populate it, whether a
// behavioural reader exists, and whether deleting the KnownTileRecord alone is sufficient.
//
// Usage:
//   node scripts/explorationStoreInventoryAudit.mjs [--years 40] [--seeds s1,..] [--scenarios ..]
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt;
};

const YEARS = Number(arg("years", "40"));
const SEEDS = arg("seeds", "s1,s2,s3").split(",").filter(Boolean);
const SEED_PREFIX = arg("seed-prefix", "c24a:chain");
const OUT = arg("out", `docs/evidence/correction24a/store-inventory.json`);

const ALL_SCENARIOS = [
  { name: "map1", map: "map1", fixture: "default" },
  { name: "map2", map: "map2", fixture: "default" },
  { name: "site_C_dry_plains", map: "map2", site: "tile:100:23" },
  { name: "site_F_hills", map: "map2", site: "tile:45:28" },
  { name: "ordinary", map: "map2", site: "tile:62:108" },
];

const only = arg("scenarios", "");
const SCENARIOS = only === "" ? ALL_SCENARIOS : ALL_SCENARIOS.filter((s) => only.split(",").includes(s.name));

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

  const isLiving = (band) =>
    band.viability?.status !== "extinct" &&
    band.viability?.status !== "absorbed" &&
    band.viability?.status !== "dispersed" &&
    (band.demography?.population ?? 0) > 0;

  /**
   * Every band-level store that is KEYED BY TILE or can name a tile, so the sweep below cannot
   * miss one by only looking where it expects to find something.
   */
  const tileKeyedStores = (band) => ({
    observedTiles: Object.keys(band.knowledge?.observedTiles ?? {}),
    placeMemory: Object.keys(band.placeMemory ?? {}),
    placeAttachments: (band.knowledge?.placeAttachments ?? []).map((a) => String(a.tileId)),
    knownRoutes: (band.knowledge?.knownRoutes ?? []).flatMap((r) => (r.tileIds ?? []).map(String)),
    compressedKnownTileSummaries: (band.knowledge?.compressedKnownTileSummaries ?? []).flatMap((s) =>
      (s.tileIds ?? [s.tileId]).filter(Boolean).map(String),
    ),
    knownAreaSummaries: (band.knowledge?.knownAreaSummaries ?? []).flatMap((s) =>
      (s.tileIds ?? []).map(String),
    ),
    frontierInferredTiles: Object.keys(band.frontierKnowledge?.inferredTiles ?? {}),
    resourcePatchMemory: (band.resourceKnowledgeState?.patchMemories ?? []).map((m) => String(m.tileId)),
    travelCorridors: Object.values(band.travelCorridors ?? {}).flatMap((c) =>
      [c.fromTileId, c.toTileId, ...(c.tileIds ?? [])].filter(Boolean).map(String),
    ),
    crossingMemories: Object.values(band.crossingMemories ?? {}).flatMap((m) =>
      [m.crossingTileA, m.crossingTileB].filter(Boolean).map(String),
    ),
    protoCampMemory: (band.protoCampMemory?.camps ?? []).map((c) => String(c.tileId)),
    verificationEvidence: (band.verificationEvidence ?? []).map((e) => String(e.tileId)),
    seasonalRound: (band.seasonalRound?.phaseRecords ?? []).flatMap((p) =>
      (p.tileIds ?? []).map(String),
    ),
  });

  const storeNames = Object.keys(tileKeyedStores({}));
  const totals = {};
  for (const name of storeNames) {
    totals[name] = { holdsAnExplorationTile: 0, bandsChecked: 0, tilesHeld: 0 };
  }

  const perScenario = {};
  let explorationTilesSeen = 0;
  let bandsWithExplorationTiles = 0;

  for (const scenario of SCENARIOS) {
    const acc = { explorationTiles: 0, bands: 0, byStore: {} };
    for (const name of storeNames) acc.byStore[name] = 0;

    for (const seed of SEEDS) {
      let world = runner.initSimWorld({ kind: scenario.map }, `${SEED_PREFIX}:${seed}`);

      if (scenario.fixture !== "default") {
        world = spawn.removeInitialBands(world, Object.keys(world.bands));
        world = spawn.spawnCustomBands(
          world,
          [{ tileId: scenario.site, population: 34, name: scenario.name }],
          `${SEED_PREFIX}:${seed}`,
        );
      }

      // Sampled DURING the run, not at the end. An end-of-run snapshot reports zero: annual
      // compression evicts most exploration records and a later residential observation UPGRADES
      // the acquisition off `returned_frontier_exploration`, so by year 40 almost none survive
      // under that label. The §6 ablation happens at FIRST READ, days after arrival, so the
      // inventory has to look at the same moment.
      const sampled = [];

      for (let d = 1; d <= YEARS * 360; d += 1) {
        world = runner.stepSim(world, 1, "daily");
        if (d % 30 === 0) sampled.push(world);
        if (Object.values(world.bands).filter(isLiving).length === 0) break;
      }

      for (const snapshot of sampled) {
      for (const band of Object.values(snapshot.bands).filter(isLiving)) {
        const observed = band.knowledge?.observedTiles ?? {};
        const explorationTiles = Object.keys(observed).filter(
          (t) => observed[t]?.acquisition === "returned_frontier_exploration",
        );

        acc.bands += 1;

        if (explorationTiles.length === 0) {
          continue;
        }

        bandsWithExplorationTiles += 1;
        acc.explorationTiles += explorationTiles.length;
        explorationTilesSeen += explorationTiles.length;

        const stores = tileKeyedStores(band);
        const explorationSet = new Set(explorationTiles);

        for (const [name, tileIds] of Object.entries(stores)) {
          if (name === "observedTiles") {
            totals[name].tilesHeld += explorationTiles.length;
            totals[name].holdsAnExplorationTile += 1;
            acc.byStore[name] += explorationTiles.length;
            continue;
          }

          const overlap = tileIds.filter((t) => explorationSet.has(t));

          totals[name].bandsChecked += 1;

          if (overlap.length > 0) {
            totals[name].holdsAnExplorationTile += 1;
            totals[name].tilesHeld += overlap.length;
            acc.byStore[name] += overlap.length;
          }
        }
      }
      }
    }

    perScenario[scenario.name] = acc;
    console.log(
      `${scenario.name.padEnd(20)} explorationTiles=${String(acc.explorationTiles).padStart(5)} ` +
        Object.entries(acc.byStore)
          .filter(([n, v]) => v > 0 && n !== "observedTiles")
          .map(([n, v]) => `${n}=${v}`)
          .join(" "),
    );
  }

  // §5 — the static half: writer, source, reader, and the sufficiency verdict, read from
  // production and paired with the empirical overlap above.
  const staticLedger = {
    observedTiles: {
      writer: "tileObservation.observeTileAndNearby",
      explorationCanPopulate: true,
      authoritativeReader: "carryingCapacity.collectOpportunityCandidates, campMovement, intraSeasonTrips, demography.getFissionTargetRecordIds",
      note: "THE canonical store. The exploration return calls this writer directly with acquisition returned_frontier_exploration.",
    },
    placeMemory: {
      writer: "memory.updatePlaceMemory, called ONLY from bandDecision.ts:981",
      explorationCanPopulate: "INDIRECTLY — updatePlaceMemory iterates addUnique(observedTileIds, nextPosition) and reads knownTiles[tileId]. observedTileIds comes from the RESIDENTIAL decision's own observation targets, never from the exploration route. A place record is therefore derived from an exploration-derived KnownTileRecord only once the band residentially reaches or observes that tile.",
      authoritativeReader: "protoCamps scoring, campMovement",
      sufficiencyOfOneRecordDeletion: "NOT sufficient once the band has residentially reached the tile — a derived copy then exists. The §6 ablation therefore strips placeMemory[tileId] as well.",
    },
    travelCorridors: {
      writer: "memory.updateTravelCorridorMemory(band.travelCorridors, decision, movementRecord)",
      explorationCanPopulate: false,
      authoritativeReader: "bandDecision corridor candidates",
      note: "Built from the RESIDENTIAL movement record and decision. The exploration hand-off never reaches it — this is the structural no-reader finding for the route/corridor family.",
    },
    crossingMemories: {
      writer: "memory.updateCrossingMemory(input, movementRecord)",
      explorationCanPopulate: false,
      authoritativeReader: "fordContext (PROJECTION — never called inside stepSim), crossingPractice",
      note: "Also movement-record derived.",
    },
    resourcePatchMemory: {
      writer: "intraSeasonTrips.applyActivityOutcomeToMemory",
      explorationCanPopulate: false,
      authoritativeReader: "trip target selection, expedition retrieval candidates",
      note: "Requires an existing ResourcePatchMemory as targetMemory. Frontier exploration carries no target patch, and CORRECTION-17's anti-omniscience check C4 (exploration_created_resource_memory) measures 0.",
    },
    compressedKnownTileSummaries: {
      writer: "memoryCompression.appendCompressedKnownSummary on eviction",
      explorationCanPopulate: true,
      authoritativeReader: "NONE — readers are spawn (writes []), memoryCompression itself, bandChronicle and bandHistory (both projections), demography (writes [] for a daughter).",
      sufficiencyOfOneRecordDeletion: "Irrelevant to the counterfactual: no behavioural reader consumes it.",
    },
    verificationEvidence: {
      writer: "verificationEvidence.recordVerificationEvidence + KnownTileRecord.verificationDisposition",
      explorationCanPopulate: false,
      authoritativeReader: "frontierVerification selector, taskCampRefusedByEvidence",
      note: "Written by verification parties only. CORRECTION-23J left the question dormant.",
    },
    frontierInferredTiles: {
      writer: "frontierKnowledge",
      explorationCanPopulate: false,
      authoritativeReader: "frontier heading derivation",
      note: "pruneObserved REMOVES observed tiles from the inferred set, so observing a tile empties it here rather than filling it. It is the complement of exploration knowledge, not a copy of it.",
    },
  };

  const result = {
    years: YEARS,
    seeds: SEEDS,
    scenarios: SCENARIOS.map((s) => s.name),
    explorationTilesSeen,
    bandsWithExplorationTiles,
    empiricalOverlap: totals,
    perScenario,
    staticLedger,
    conclusion:
      explorationTilesSeen === 0
        ? "VACUOUS — no exploration tiles were produced, so no overlap could be observed."
        : "See empiricalOverlap: any store with holdsAnExplorationTile > 0 must be stripped by the §6 one-record ablation.",
  };

  mkdirSync(OUT.split("/").slice(0, -1).join("/"), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);

  console.log("");
  console.log(`exploration tiles observed   : ${explorationTilesSeen}`);
  console.log(`bands holding them           : ${bandsWithExplorationTiles}`);
  console.log("stores that ALSO name an exploration tile (must be stripped by the ablation):");
  for (const [name, v] of Object.entries(totals)) {
    if (name === "observedTiles") continue;
    const flag = v.holdsAnExplorationTile > 0 ? "  <-- MUST STRIP" : "";
    console.log(`  ${name.padEnd(30)} bands=${String(v.holdsAnExplorationTile).padStart(4)} tiles=${String(v.tilesHeld).padStart(5)}${flag}`);
  }
  console.log(`wrote ${OUT}`);
} finally {
  await server.close();
}
