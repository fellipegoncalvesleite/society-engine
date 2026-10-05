// REPEATED BAND EXPANSION + HABITAT VIABILITY (CORRECTION-14) — 500-year lineage
// expansion-chain audit.
//
// One authoritative machine-readable audit of the WHOLE expansion chain:
//
//   physical regional opportunity -> band knowledge -> reachable food acquisition
//   -> returned support -> nutrition -> fertility/mortality -> cohort growth
//   -> total population -> crowding/split pressure -> fission eligibility
//   -> daughter composition -> daughter placement + inherited knowledge
//   -> daughter food acquisition -> daughter survival -> descendant growth
//   -> repeated lineage fission
//
// It reads the public sim API (initSimWorld/stepSim/spawn) plus band state the
// production code already writes, and the audit-only, non-persisted fission
// evaluation observer (src/sim/diagnostics/fissionDiagnostics.ts) which reports
// the gate values the real decision computed. It never changes production rules.
//
// Habitat tiers are constructed from MEASURED PHYSICAL PROPERTIES (reachable live
// plant-food stock + water across the catchment, and the best alternative region
// within realistic discovery/movement range), never from a label.
//
// Usage:
//   node scripts/lineageExpansionAudit.mjs --mode tiers --tier all --years 500 --seeds s1,s2,s3,s4,s5
//   node scripts/lineageExpansionAudit.mjs --mode default --map map1 --years 500 --seeds s1,s2,s3
//   node scripts/lineageExpansionAudit.mjs --mode tiers --tier rich --arm no-fission --years 500
//   node scripts/lineageExpansionAudit.mjs --mode arm-b --years 120
//   node scripts/lineageExpansionAudit.mjs --mode sites            (emit tier evidence only)
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createServer } from "vite";

function arg(name, dflt) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : dflt;
}

const MODE = arg("--mode", "tiers");
const TIER = arg("--tier", "all");
const MAP = arg("--map", "map2");
const YEARS = Number(arg("--years", "500"));
const SEEDS = arg("--seeds", "s1").split(",").filter(Boolean);
const ARM = arg("--arm", "production");
const OUT = arg("--out", "");
const FOUNDER_POPULATION = Number(arg("--founder-population", "34"));
const SERIES_SEED = arg("--series-seed", SEEDS[0]);

const TIER_NAMES = [
  "exceptionally_rich",
  "good",
  "ordinary",
  "marginal_escapable",
  "isolated_marginal",
  "hostile",
];

const DEFAULT_FOUNDERS = {
  map1: {
    "band:delta-coastal-foragers": "Delta Reed",
    "band:river-valley-foragers": "Green River",
    "band:lake-wetland-foragers": "Lake Marsh",
    "band:highland-edge-foragers": "Pass Edge",
    "band:dry-margin-foragers": "Dry Margin",
  },
  map2: {
    "band:varied-estuary": "Estuary",
    "band:varied-river-mid": "Long River",
    "band:varied-plains-creek": "Creek Plains",
    "band:varied-lake-north": "Rich Basin",
    "band:varied-pass-frontier": "North Frontier",
    "band:varied-dry-corridor-upper": "Upper Corridor",
    "band:varied-dry-corridor-mid": "Yellow Corridor",
    "band:varied-lake-east": "Basin Crowd East",
    "band:varied-lake-west": "Basin Crowd West",
  },
};

const r2 = (v) => Math.round((v ?? 0) * 100) / 100;
const r4 = (v) => Math.round((v ?? 0) * 10000) / 10000;
const mean = (xs) => (xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length);
const median = (xs) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const server = await createServer({
  root: `${process.cwd()}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

let output;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const spawn = await server.ssrLoadModule("/sim/agents/spawn.ts");
  const plantPatches = await server.ssrLoadModule("/sim/agents/plantPatches.ts");
  const fission = await server.ssrLoadModule("/sim/diagnostics/fissionDiagnostics.ts");

  // ───────────────────────────────────────────────────────────────────────────
  // §6 — habitat tiers DEFINED FROM PHYSICAL EVIDENCE.
  //
  // Scenario construction reads physical truth to PLACE a founder; the band
  // itself runs pure production logic and knows only what it learns.
  // ───────────────────────────────────────────────────────────────────────────
  const REACH_RADIUS = 10;           // realistic same-day/near catchment
  const ESCAPE_MIN = 12;             // "elsewhere" starts outside the home catchment
  const ESCAPE_MAX = 28;             // realistic discovery + relocation range

  function buildSiteEvidence(mapKind) {
    const world = runner.initSimWorld({ kind: mapKind }, `tier-scoring:${mapKind}`);
    const tiles = Object.values(world.tiles);
    const byCoord = new Map(tiles.map((t) => [`${t.coord.x}:${t.coord.y}`, t]));

    const scoreCenter = (center) => {
      let stock = 0;
      let water = 0;
      let waterTiles = 0;
      let usableTiles = 0;
      let passableTiles = 0;
      for (let dy = -REACH_RADIUS; dy <= REACH_RADIUS; dy += 1) {
        for (let dx = -REACH_RADIUS; dx <= REACH_RADIUS; dx += 1) {
          if (Math.abs(dx) + Math.abs(dy) > REACH_RADIUS) continue;
          const tile = byCoord.get(`${center.coord.x + dx}:${center.coord.y + dy}`);
          if (tile === undefined) continue;
          usableTiles += 1;
          if (tile.movementCost <= 2.35) passableTiles += 1;
          water += tile.resourceProfile.waterAccess;
          if (tile.resourceProfile.waterAccess > 0.55) waterTiles += 1;
          if (tile.isAquatic === true) continue;
          for (const patch of plantPatches.derivePlantPatchesForTile(tile, world.time)) {
            stock += patch.baseAbundance * patch.currentAbundance;
          }
        }
      }
      return {
        stock: r2(stock),
        meanWater: r4(usableTiles === 0 ? 0 : water / usableTiles),
        waterTiles,
        passableShare: r2(usableTiles === 0 ? 0 : passableTiles / usableTiles),
      };
    };

    const bounds = tiles.reduce(
      (acc, t) => ({
        maxX: Math.max(acc.maxX, t.coord.x),
        maxY: Math.max(acc.maxY, t.coord.y),
      }),
      { maxX: 0, maxY: 0 },
    );

    const grid = [];
    for (const tile of tiles) {
      if (tile.isAquatic === true) continue;
      if (tile.coord.x % 4 !== 0 || tile.coord.y % 4 !== 0) continue;
      if (tile.coord.x < 10 || tile.coord.y < 10) continue;
      if (tile.coord.x > bounds.maxX - 10 || tile.coord.y > bounds.maxY - 10) continue;
      if (tile.movementCost > 2.35) continue;
      grid.push({ tileId: tile.id, coord: tile.coord, ...scoreCenter(tile) });
    }

    // Best alternative region within realistic discovery/movement range: the
    // physical evidence that separates "marginal but escapable" from "isolated
    // marginal". Measured on the same grid, not asserted.
    for (const site of grid) {
      let best = 0;
      let bestTileId;
      for (const other of grid) {
        const d = Math.abs(other.coord.x - site.coord.x) + Math.abs(other.coord.y - site.coord.y);
        if (d < ESCAPE_MIN || d > ESCAPE_MAX) continue;
        if (other.stock > best) {
          best = other.stock;
          bestTileId = other.tileId;
        }
      }
      site.bestEscapeStock = r2(best);
      site.bestEscapeTileId = bestTileId;
    }

    const withWater = grid.filter((s) => s.waterTiles >= 6 && s.meanWater >= 0.28);
    const byStock = [...grid].sort((a, b) => a.stock - b.stock || String(a.tileId).localeCompare(String(b.tileId)));
    const withWaterByStock = [...withWater].sort((a, b) => a.stock - b.stock || String(a.tileId).localeCompare(String(b.tileId)));
    const pct = (arr, p) => arr[Math.min(arr.length - 1, Math.max(0, Math.floor(arr.length * p)))];

    const richPool = withWaterByStock.filter((s) => s.waterTiles >= 10);
    const exceptionally_rich = richPool[richPool.length - 1] ?? withWaterByStock[withWaterByStock.length - 1];
    const good = pct(withWaterByStock, 0.8);
    const ordinary = pct(withWaterByStock, 0.5);

    const lowStockCut = pct(byStock, 0.12).stock;
    const highStockCut = pct(byStock, 0.85).stock;
    // Marginal tiers isolate FOOD scarcity: they must still have some water, so the
    // marginal/isolated distinction is the reachable-food gradient and the presence
    // or absence of a better region in range — not a water confound. Waterless
    // ground is the separate `hostile` control.
    const lowPool = byStock.filter((s) => s.stock <= lowStockCut && s.waterTiles >= 5);
    const marginal_escapable =
      [...lowPool].sort((a, b) => (b.bestEscapeStock ?? 0) - (a.bestEscapeStock ?? 0) ||
        String(a.tileId).localeCompare(String(b.tileId)))[0];
    const isolated_marginal =
      [...lowPool].sort((a, b) => (a.bestEscapeStock ?? 0) - (b.bestEscapeStock ?? 0) ||
        String(a.tileId).localeCompare(String(b.tileId)))[0];
    const hostilePool = byStock.filter((s) => s.waterTiles <= 1);
    const hostile = hostilePool[0] ?? byStock[0];

    const sites = {
      exceptionally_rich,
      good,
      ordinary,
      marginal_escapable,
      isolated_marginal,
      hostile,
    };

    return {
      map: mapKind,
      reachRadiusTiles: REACH_RADIUS,
      escapeRangeTiles: [ESCAPE_MIN, ESCAPE_MAX],
      gridCenters: grid.length,
      stockPercentiles: {
        p12: r2(lowStockCut),
        p50: r2(pct(byStock, 0.5).stock),
        p85: r2(highStockCut),
        max: r2(byStock[byStock.length - 1].stock),
      },
      sites,
      tierEvidence: Object.fromEntries(Object.entries(sites).map(([name, site]) => [name, {
        tileId: site.tileId,
        reachableLivePlantStock: site.stock,
        meanWaterAccess: site.meanWater,
        reliableWaterTiles: site.waterTiles,
        passableShare: site.passableShare,
        bestAlternativeRegionStockWithinRange: site.bestEscapeStock,
        bestAlternativeRegionTileId: site.bestEscapeTileId,
      }])),
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Lineage tracking
  // ───────────────────────────────────────────────────────────────────────────
  function newBandTrack(band, birthYear, generation, parentId, rootId) {
    return {
      bandId: String(band.id),
      parentBandId: parentId === undefined ? undefined : String(parentId),
      rootFounderId: String(rootId),
      generation,
      birthYear,
      birthTick: Number(band.demography.lastDemographicUpdate?.tick ?? 0),
      terminalYear: null,
      terminalReason: null,
      startPopulation: band.demography.population,
      population: band.demography.population,
      maxPopulation: band.demography.population,
      minPopulation: band.demography.population,
      births: 0,
      deaths: 0,
      seenChurnYears: new Set(),
      fissionsAsParent: 0,
      evaluations: 0,
      maintenanceSeasons: 0,
      surplusSeasons: 0,
      deficitSeasons: 0,
      seasonsSampled: 0,
      maxSeasonRawSupport: 0,
      // chain-stage evidence (see STAGES)
      maxAnnualMeanRawSupport: 0,
      sustainedMaintenanceYears: 0,
      surplusSignalYears: 0,
      physicalSurplusYears: 0,
      positiveRateYears: 0,
      sumAnnualMeanRawSupport: 0,
      sumCurrentFoodStress: 0,
      sumNutritionalSurplus: 0,
      sumNetRate: 0,
      maxSplitPressure: 0,
      viableDestinationYears: 0,
      eligibleYears: 0,
      longestDeficitStreak: 0,
      longestSurplusStreak: 0,
      lastEval: undefined,
      firstEval: undefined,
      blockerCounts: {},
      series: [],
      // daughter-outcome evidence
      inheritedKnowledgeCount: null,
      inheritedResourceMemoryCount: null,
      placementMatchesDestination: null,
      startWorkingAdults: band.demography.workingAdults,
      startDependents: band.demography.dependents,
      startElders: band.demography.elders,
    };
  }

  function classifyBlocker(track, siteEvidence) {
    // Chain-ordered stages. The blocker is the FIRST stage the band never
    // satisfied in any year of its life.
    const knowledgeStarved = (track.lastEval?.fissionTargetCandidatesConsidered ?? 0) === 0;
    const physicallyPoor = siteEvidence !== undefined &&
      siteEvidence.reachableLivePlantStock < 4;

    if (track.maxAnnualMeanRawSupport < 0.92) {
      if (physicallyPoor) return "insufficient_physical_regional_support";
      if (knowledgeStarved) return "physical_support_exists_but_remains_unknown";
      return "returned_support_below_maintenance";
    }
    if (track.sustainedMaintenanceYears === 0) return "returned_support_below_maintenance";
    if (track.surplusSignalYears === 0) {
      // Distinguish "the year genuinely never produced surplus" from "the year DID
      // produce physical surplus but the demographic nutrition read never saw it".
      return track.physicalSurplusYears > track.evaluations * 0.2
        ? "physical_surplus_present_but_demographic_read_reports_none"
        : "support_above_maintenance_but_below_genuine_surplus";
    }
    if (track.positiveRateYears === 0) return "genuine_surplus_but_fertility_response_insufficient";
    if (track.maxPopulation < (track.lastEval?.minimumSplitPopulation ?? 46)) {
      const meanRate = track.evaluations === 0 ? 0 : track.sumNetRate / track.evaluations;
      const surplusBlind = track.physicalSurplusYears > track.surplusSignalYears * 2 &&
        track.physicalSurplusYears > track.evaluations * 0.2;
      if (surplusBlind) return "physical_surplus_present_but_demographic_read_reports_none";
      if (meanRate <= 0) return "births_occur_but_maturation_labor_replacement_fails";
      return "population_growth_too_slow_to_reach_split_minimum";
    }
    if (track.maxSplitPressure < (track.lastEval?.splitPressureThreshold ?? 0.64)) {
      return "population_grows_but_split_pressure_too_low";
    }
    if (track.viableDestinationYears === 0) return "no_known_viable_daughter_destination";
    if (track.eligibleYears === 0) {
      const deferred = Object.entries(track.blockerCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0];
      if (deferred === "split_deferred_no_viable_frontier") return "no_known_viable_daughter_destination";
      if (deferred === "split_deferred_high_risk") return "viable_destination_rejected_by_risk_logic";
      if (deferred === "split_deferred_low_population") return "population_grows_but_split_pressure_too_low";
      if ((track.lastEval?.bandCount ?? 0) >= (track.lastEval?.maxBands ?? 36)) return "maximum_band_constraint_blocks";
      if (track.lastEval?.cooldownElapsed === false) return "cooldown_blocks_repeated_fission";
      return "split_pressure_rises_but_eligibility_threshold_blocks";
    }
    if (track.fissionsAsParent === 0) {
      if ((track.lastEval?.projectedDaughterPopulation ?? 0) < (track.lastEval?.daughterMinPopulation ?? 18)) {
        return "daughter_cohort_composition_nonviable";
      }
      if ((track.lastEval?.bandCount ?? 0) >= (track.lastEval?.maxBands ?? 36)) {
        return "maximum_band_constraint_blocks";
      }
      return "eligible_but_daughter_creation_failed";
    }
    if (track.fissionsAsParent === 1) return "cooldown_or_regrowth_blocks_repeated_fission";
    return "none";
  }

  function runLineage({ mapKind, seed, siteTileId, founderPopulation, years, arm, label, siteEvidence, defaultFounderIds }) {
    let world = runner.initSimWorld({ kind: mapKind }, `c14:${label}:${seed}`);
    if (siteTileId !== undefined) {
      world = spawn.removeInitialBands(world, Object.keys(world.bands));
      world = spawn.spawnCustomBands(
        world,
        [{ tileId: siteTileId, population: founderPopulation, name: label }],
        `c14:${label}:${seed}`,
      );
    }

    const roots = defaultFounderIds ?? Object.keys(world.bands);
    if (roots.length === 0) {
      return { label, seed, failedToSpawn: true };
    }

    const tracks = new Map();
    const rootOf = new Map();
    for (const id of roots) {
      const band = world.bands[id];
      if (band === undefined) continue;
      tracks.set(String(id), newBandTrack(band, 0, 0, undefined, id));
      rootOf.set(String(id), String(id));
    }

    const evaluations = [];
    const fissionEvents = [];
    const conservation = { fissionChecked: 0, fissionMismatches: 0, cohortMismatches: 0, worldPopMismatches: 0 };

    const observer = (record) => {
      const id = String(record.bandId);
      const track = tracks.get(id);
      if (track === undefined) return;
      track.evaluations += 1;
      track.firstEval ??= record;
      track.lastEval = record;
      track.maxAnnualMeanRawSupport = Math.max(track.maxAnnualMeanRawSupport, record.annualMeanRawSupport);
      if (record.annualMeanRawSupport >= 0.98 && record.chronicFoodStress <= 0.24) track.sustainedMaintenanceYears += 1;
      if (record.nutritionalSurplus > 0) track.surplusSignalYears += 1;
      // PHYSICAL surplus: the year actually returned more usable food than the band
      // demanded, by the same deadband the surplus signal uses. The gap between this
      // and `surplusSignalYears` is the demographic read's blindness to it.
      if (record.annualMeanRawSupport >= 1.12) track.physicalSurplusYears += 1;
      if (record.netDemographicRate > 0) track.positiveRateYears += 1;
      track.sumAnnualMeanRawSupport += record.annualMeanRawSupport;
      track.sumCurrentFoodStress += record.currentFoodStress;
      track.sumNutritionalSurplus += record.nutritionalSurplus;
      track.sumNetRate += record.netDemographicRate;
      track.maxSplitPressure = Math.max(track.maxSplitPressure, record.splitPressure);
      if (record.viableFrontierTileId !== undefined) track.viableDestinationYears += 1;
      if (record.eligible) track.eligibleYears += 1;
      if (record.deferredReasonType !== undefined) {
        track.blockerCounts[record.deferredReasonType] = (track.blockerCounts[record.deferredReasonType] ?? 0) + 1;
      }
      if (seed === SERIES_SEED && track.series.length < 520) {
        track.series.push({
          y: record.year,
          pop: record.population,
          sup: record.annualMeanRawSupport,
          cur: record.currentFoodStress,
          chr: record.chronicFoodStress,
          sur: record.nutritionalSurplus,
          fer: record.fertilityPressure,
          mor: record.mortalityPressure,
          rate: record.netDemographicRate,
          sp: record.splitPressure,
          ps: record.pressureSignal,
          dp: record.dangerPenalty,
          tgt: record.viableFrontierTileId === undefined ? 0 : 1,
          el: record.eligible ? 1 : 0,
        });
      }
      evaluations.push(record);
    };

    fission.setFissionEvaluationObserver(observer);
    if (arm === "no-fission") fission.setFissionSuppressedForAudit(true);

    try {
      for (let year = 1; year <= years; year += 1) {
        for (let s = 0; s < 4; s += 1) {
          world = runner.stepSim(world, 1, "seasonal");
          for (const [id, track] of tracks) {
            const band = world.bands[id];
            if (band === undefined) continue;
            const ratio = band.seasonalSupport?.currentSeasonSupport?.rawSupportRatio;
            if (ratio !== undefined) {
              track.seasonsSampled += 1;
              track.maxSeasonRawSupport = Math.max(track.maxSeasonRawSupport, ratio);
              if (ratio >= 1) track.maintenanceSeasons += 1;
              if (ratio >= 1.12) track.surplusSeasons += 1;
              if (ratio < 0.92) track.deficitSeasons += 1;
            }
            track.longestDeficitStreak = Math.max(track.longestDeficitStreak, band.seasonalSupport?.chronicDeficitStreak ?? 0);
            track.longestSurplusStreak = Math.max(track.longestSurplusStreak, band.seasonalSupport?.seasonalRecoveryStreak ?? 0);
          }
        }

        // discover new lineage members (daughters) + record fission events
        for (const band of Object.values(world.bands)) {
          const id = String(band.id);
          if (tracks.has(id)) continue;
          const parentId = band.parentBandId === undefined ? undefined : String(band.parentBandId);
          if (parentId === undefined || !tracks.has(parentId)) continue;
          const parentTrack = tracks.get(parentId);
          const track = newBandTrack(band, year, parentTrack.generation + 1, parentId, parentTrack.rootFounderId);
          const creation = band.fissionEvents?.[0];
          if (creation !== undefined) {
            track.inheritedKnowledgeCount = creation.inheritedKnowledgeCount;
            track.inheritedResourceMemoryCount = creation.inheritedResourceMemoryCount;
            track.placementMatchesDestination = String(band.position) === String(creation.targetTileId);
          }
          tracks.set(id, track);
          rootOf.set(id, parentTrack.rootFounderId);
        }

        for (const [id, track] of tracks) {
          const band = world.bands[id];
          if (band === undefined) continue;
          const pop = band.demography.population;
          track.population = pop;
          track.maxPopulation = Math.max(track.maxPopulation, pop);
          track.minPopulation = Math.min(track.minPopulation, pop);
          const cohortSum = band.demography.dependents + band.demography.workingAdults + band.demography.elders;
          if (Math.abs(cohortSum - pop) > 0.5) conservation.cohortMismatches += 1;
          for (const rec of band.demography.demographicChurn?.records ?? []) {
            const key = Number(rec.year ?? rec.tick ?? -1);
            if (track.seenChurnYears.has(key)) continue;
            track.seenChurnYears.add(key);
            track.births += rec.births ?? 0;
            track.deaths += rec.deaths ?? 0;
          }
          const status = band.viability?.status ?? "active";
          if (track.terminalYear === null && (status === "extinct" || status === "absorbed" || band.status === "dispersed")) {
            track.terminalYear = year;
            track.terminalReason = status === "extinct"
              ? String(band.viability?.weakBandFate ?? band.viability?.weakBandClassification ?? "extinct")
              : status;
          }
          // record fission events authored by this band (as parent)
          for (const event of band.fissionEvents ?? []) {
            if (String(event.parentBandId) !== id) continue;
            if (fissionEvents.some((e) => e.id === String(event.id))) continue;
            conservation.fissionChecked += 1;
            const conserved = Math.abs(
              event.parentPopulationBefore - (event.parentPopulationAfter + event.daughterPopulation),
            ) < 0.5;
            if (!conserved || event.fissionPopulationConserved !== true) conservation.fissionMismatches += 1;
            fissionEvents.push({
              id: String(event.id),
              year: Number(event.time?.year ?? year),
              tick: Number(event.tick),
              parentBandId: id,
              daughterBandId: String(event.daughterBandId),
              parentGeneration: track.generation,
              parentPopulationBefore: event.parentPopulationBefore,
              parentPopulationAfter: event.parentPopulationAfter,
              daughterPopulation: event.daughterPopulation,
              conserved,
              originTileId: String(event.originTileId),
              targetTileId: String(event.targetTileId),
              inheritedKnowledgeCount: event.inheritedKnowledgeCount,
              inheritedMemoryCount: event.inheritedMemoryCount,
              inheritedResourceMemoryCount: event.inheritedResourceMemoryCount,
              inheritedCorridorCount: event.inheritedCorridorCount,
              reasonType: String(event.splitReason?.type ?? "unknown"),
            });
            track.fissionsAsParent += 1;
          }
        }
      }
    } finally {
      fission.setFissionEvaluationObserver(undefined);
      if (arm === "no-fission") fission.setFissionSuppressedForAudit(false);
    }

    // daughter outcome classification
    for (const event of fissionEvents) {
      const track = tracks.get(event.daughterBandId);
      if (track === undefined) {
        event.outcome = "daughter_missing";
        continue;
      }
      const lifespan = (track.terminalYear ?? years) - event.year;
      const neverViable = track.maxSeasonRawSupport < 1;
      event.daughterLifespanYears = lifespan;
      event.daughterFinalPopulation = track.population;
      event.daughterMaxPopulation = track.maxPopulation;
      event.daughterMaxSeasonRawSupport = r2(track.maxSeasonRawSupport);
      event.daughterPlacementMatchesDestination = track.placementMatchesDestination;
      event.survived5 = lifespan >= 5;
      event.survived20 = lifespan >= 20;
      event.survived50 = lifespan >= 50;
      event.survived100 = lifespan >= 100;
      event.outcome = neverViable
        ? "bookkeeping_only_split"
        : lifespan >= 50 && (track.terminalYear === null || track.population > 0)
          ? "successful_expansion"
          : lifespan >= 20
            ? "fragile_expansion"
            : "failed_offshoot";
    }

    for (const track of tracks.values()) {
      const site = track.generation === 0 ? siteEvidence : undefined;
      track.terminalBlocker = classifyBlocker(track, site);
    }

    const all = [...tracks.values()];
    const living = all.filter((t) => t.terminalYear === null && t.population > 0);
    const rootTracks = all.filter((t) => t.generation === 0);
    const successful = fissionEvents.filter((e) => e.outcome === "successful_expansion").length;
    const fragile = fissionEvents.filter((e) => e.outcome === "fragile_expansion").length;
    const failed = fissionEvents.filter((e) => e.outcome === "failed_offshoot").length;
    const bookkeeping = fissionEvents.filter((e) => e.outcome === "bookkeeping_only_split").length;
    const fissionYears = fissionEvents.map((e) => e.year).sort((a, b) => a - b);
    const intervals = fissionYears.slice(1).map((y, i) => y - fissionYears[i]);

    return {
      label,
      seed,
      map: mapKind,
      arm,
      years,
      siteTileId,
      founderSurvived: rootTracks.some((t) => t.terminalYear === null && t.population > 0),
      rootStartPopulation: rootTracks.reduce((s, t) => s + t.startPopulation, 0),
      livingBands: living.length,
      extinctBands: all.length - living.length,
      totalBands: all.length,
      totalLineagePopulation: living.reduce((s, t) => s + t.population, 0),
      deepestGeneration: Math.max(...all.map((t) => t.generation)),
      totalFissions: fissionEvents.length,
      successfulFissions: successful,
      fragileFissions: fragile,
      failedOffshoots: failed,
      bookkeepingOnlySplits: bookkeeping,
      secondGenerationFissions: fissionEvents.filter((e) => e.parentGeneration >= 1).length,
      firstFissionYear: fissionYears[0] ?? null,
      lastFissionYear: fissionYears[fissionYears.length - 1] ?? null,
      medianFissionInterval: intervals.length === 0 ? null : median(intervals),
      populationLostToFailedDaughters: fissionEvents
        .filter((e) => e.outcome === "failed_offshoot" || e.outcome === "bookkeeping_only_split")
        .reduce((s, e) => s + e.daughterPopulation, 0),
      conservation,
      terminalBlockers: all.reduce((acc, t) => {
        acc[t.terminalBlocker] = (acc[t.terminalBlocker] ?? 0) + 1;
        return acc;
      }, {}),
      bands: all.map((t) => ({
        bandId: t.bandId,
        parentBandId: t.parentBandId,
        rootFounderId: t.rootFounderId,
        generation: t.generation,
        birthYear: t.birthYear,
        terminalYear: t.terminalYear,
        terminalReason: t.terminalReason,
        startPopulation: t.startPopulation,
        finalPopulation: t.population,
        maxPopulation: t.maxPopulation,
        minPopulation: t.minPopulation,
        births: t.births,
        deaths: t.deaths,
        fissionsAsParent: t.fissionsAsParent,
        maintenanceSeasons: t.maintenanceSeasons,
        surplusSeasons: t.surplusSeasons,
        deficitSeasons: t.deficitSeasons,
        seasonsSampled: t.seasonsSampled,
        maxSeasonRawSupport: r2(t.maxSeasonRawSupport),
        maxAnnualMeanRawSupport: r2(t.maxAnnualMeanRawSupport),
        sustainedMaintenanceYears: t.sustainedMaintenanceYears,
        surplusSignalYears: t.surplusSignalYears,
        physicalSurplusYears: t.physicalSurplusYears,
        positiveRateYears: t.positiveRateYears,
        meanAnnualMeanRawSupport: r2(t.evaluations === 0 ? 0 : t.sumAnnualMeanRawSupport / t.evaluations),
        meanDemographicReadFoodStress: r2(t.evaluations === 0 ? 0 : t.sumCurrentFoodStress / t.evaluations),
        meanNutritionalSurplus: r2(t.evaluations === 0 ? 0 : t.sumNutritionalSurplus / t.evaluations),
        meanNetDemographicRate: r4(t.evaluations === 0 ? 0 : t.sumNetRate / t.evaluations),
        maxSplitPressure: r2(t.maxSplitPressure),
        viableDestinationYears: t.viableDestinationYears,
        eligibleYears: t.eligibleYears,
        longestDeficitStreak: t.longestDeficitStreak,
        longestSurplusStreak: t.longestSurplusStreak,
        inheritedKnowledgeCount: t.inheritedKnowledgeCount,
        inheritedResourceMemoryCount: t.inheritedResourceMemoryCount,
        placementMatchesDestination: t.placementMatchesDestination,
        startCohorts: { dependents: t.startDependents, workingAdults: t.startWorkingAdults, elders: t.startElders },
        deferredReasonCounts: t.blockerCounts,
        terminalBlocker: t.terminalBlocker,
        lastEval: t.lastEval === undefined ? undefined : {
          year: t.lastEval.year,
          population: t.lastEval.population,
          annualMeanRawSupport: t.lastEval.annualMeanRawSupport,
          currentFoodStress: t.lastEval.currentFoodStress,
          nutritionalSurplus: t.lastEval.nutritionalSurplus,
          netDemographicRate: t.lastEval.netDemographicRate,
          splitPressure: t.lastEval.splitPressure,
          pressureSignal: t.lastEval.pressureSignal,
          dangerPenalty: t.lastEval.dangerPenalty,
          viableFrontierScore: t.lastEval.viableFrontierScore,
          fissionTargetCandidatesConsidered: t.lastEval.fissionTargetCandidatesConsidered,
          bandCount: t.lastEval.bandCount,
        },
        ...(seed === SERIES_SEED && t.generation <= 1 ? { series: t.series.filter((_, i) => i % 10 === 0 || i === t.series.length - 1) } : {}),
      })),
      fissionEvents,
    };
  }

  function summarizeSeeds(results) {
    const ok = results.filter((r) => !r.failedToSpawn);
    return {
      seeds: ok.length,
      founderSurvivalRate: r2(ok.filter((r) => r.founderSurvived).length / Math.max(1, ok.length)),
      medianSuccessfulFissions: median(ok.map((r) => r.successfulFissions)),
      maxSuccessfulFissions: Math.max(0, ...ok.map((r) => r.successfulFissions)),
      medianTotalFissions: median(ok.map((r) => r.totalFissions)),
      medianLivingBands: median(ok.map((r) => r.livingBands)),
      medianLineagePopulation: median(ok.map((r) => r.totalLineagePopulation)),
      medianDeepestGeneration: median(ok.map((r) => r.deepestGeneration)),
      seedsWithSecondGenerationFission: ok.filter((r) => r.secondGenerationFissions > 0).length,
      seedsWithAnyFission: ok.filter((r) => r.totalFissions > 0).length,
      seedsWithSuccessfulFission: ok.filter((r) => r.successfulFissions > 0).length,
      totalFailedOffshoots: ok.reduce((s, r) => s + r.failedOffshoots, 0),
      totalBookkeepingOnlySplits: ok.reduce((s, r) => s + r.bookkeepingOnlySplits, 0),
      fissionConservationMismatches: ok.reduce((s, r) => s + r.conservation.fissionMismatches, 0),
      cohortMismatches: ok.reduce((s, r) => s + r.conservation.cohortMismatches, 0),
      perSeed: ok.map((r) => ({
        seed: r.seed,
        founderSurvived: r.founderSurvived,
        livingBands: r.livingBands,
        totalBands: r.totalBands,
        lineagePopulation: r.totalLineagePopulation,
        totalFissions: r.totalFissions,
        successfulFissions: r.successfulFissions,
        fragileFissions: r.fragileFissions,
        failedOffshoots: r.failedOffshoots,
        bookkeepingOnlySplits: r.bookkeepingOnlySplits,
        secondGenerationFissions: r.secondGenerationFissions,
        deepestGeneration: r.deepestGeneration,
        firstFissionYear: r.firstFissionYear,
        medianFissionInterval: r.medianFissionInterval,
        terminalBlockers: r.terminalBlockers,
      })),
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  if (MODE === "sites") {
    output = { check: "CORRECTION-14-HABITAT-TIERS", map1: buildSiteEvidence("map1"), map2: buildSiteEvidence("map2") };
  } else if (MODE === "default") {
    const founderIds = Object.keys(DEFAULT_FOUNDERS[MAP]);
    const byFounder = {};
    for (const id of founderIds) {
      byFounder[DEFAULT_FOUNDERS[MAP][id]] = [];
    }
    const runs = [];
    for (const seed of SEEDS) {
      const result = runLineage({
        mapKind: MAP, seed, years: YEARS, arm: ARM,
        label: `default-${MAP}`, defaultFounderIds: founderIds,
      });
      runs.push(result);
      // split the multi-founder run into per-root-lineage summaries
      for (const id of founderIds) {
        const name = DEFAULT_FOUNDERS[MAP][id];
        const lineage = result.bands.filter((b) => b.rootFounderId === id);
        if (lineage.length === 0) continue;
        const living = lineage.filter((b) => b.terminalYear === null && b.finalPopulation > 0);
        const events = result.fissionEvents.filter((e) => lineage.some((b) => b.bandId === e.parentBandId));
        const years = events.map((e) => e.year).sort((a, b) => a - b);
        const intervals = years.slice(1).map((y, i) => y - years[i]);
        byFounder[name].push({
          seed,
          founderFinalPopulation: lineage.find((b) => b.bandId === id)?.finalPopulation ?? 0,
          founderTerminalYear: lineage.find((b) => b.bandId === id)?.terminalYear ?? null,
          rootLineagePopulation: living.reduce((s, b) => s + b.finalPopulation, 0),
          livingDescendants: living.filter((b) => b.generation > 0).length,
          extinctDescendants: lineage.filter((b) => b.generation > 0 && b.terminalYear !== null).length,
          totalFissions: events.length,
          successfulFissions: events.filter((e) => e.outcome === "successful_expansion").length,
          failedOffshoots: events.filter((e) => e.outcome === "failed_offshoot" || e.outcome === "bookkeeping_only_split").length,
          deepestGeneration: Math.max(...lineage.map((b) => b.generation)),
          firstFissionYear: years[0] ?? null,
          lastFissionYear: years[years.length - 1] ?? null,
          medianFissionInterval: intervals.length === 0 ? null : median(intervals),
          births: lineage.reduce((s, b) => s + b.births, 0),
          deaths: lineage.reduce((s, b) => s + b.deaths, 0),
          meanMaintenanceSeasonShare: r2(mean(lineage.map((b) => b.seasonsSampled === 0 ? 0 : b.maintenanceSeasons / b.seasonsSampled))),
          terminalBlocker: lineage.find((b) => b.bandId === id)?.terminalBlocker,
        });
      }
    }
    output = {
      check: "CORRECTION-14-DEFAULT-MAP",
      map: MAP, years: YEARS, seeds: SEEDS, arm: ARM,
      byFounder,
      runs: runs.map((r) => ({
        seed: r.seed,
        livingBands: r.livingBands,
        totalBands: r.totalBands,
        totalPopulation: r.totalLineagePopulation,
        totalFissions: r.totalFissions,
        successfulFissions: r.successfulFissions,
        failedOffshoots: r.failedOffshoots,
        deepestGeneration: r.deepestGeneration,
        conservation: r.conservation,
        terminalBlockers: r.terminalBlockers,
      })),
      detail: runs.find((r) => r.seed === SERIES_SEED),
    };
  } else if (MODE === "arm-b") {
    // Arm B — forced eligibility EVALUATION, not a forced split. A real production
    // band is placed in a state that should satisfy the existing requirements
    // naturally (rich ground, population already above the split minimum); the real
    // fission decision then runs and every gate value is reported.
    const evidence = buildSiteEvidence("map2");
    const site = evidence.sites.exceptionally_rich;
    const results = [];
    for (const pop of [50, 60, 80, 120]) {
      const run = runLineage({
        mapKind: "map2", seed: `armb-${pop}`, siteTileId: site.tileId,
        founderPopulation: pop, years: YEARS, arm: "production",
        label: `arm-b-${pop}`, siteEvidence: evidence.tierEvidence.exceptionally_rich,
      });
      results.push({
        startPopulation: pop,
        firstFissionYear: run.firstFissionYear,
        totalFissions: run.totalFissions,
        successfulFissions: run.successfulFissions,
        deepestGeneration: run.deepestGeneration,
        livingBands: run.livingBands,
        rootBand: run.bands.find((b) => b.generation === 0),
      });
    }
    output = { check: "CORRECTION-14-ARM-B", site: evidence.tierEvidence.exceptionally_rich, years: YEARS, results };
  } else {
    const evidence = buildSiteEvidence(MAP);
    const tiers = TIER === "all" ? TIER_NAMES : [TIER];
    const byTier = {};
    for (const name of tiers) {
      const site = evidence.sites[name];
      const results = [];
      for (const seed of SEEDS) {
        results.push(runLineage({
          mapKind: MAP, seed, siteTileId: site.tileId, founderPopulation: FOUNDER_POPULATION,
          years: YEARS, arm: ARM, label: name, siteEvidence: evidence.tierEvidence[name],
        }));
      }
      byTier[name] = {
        evidence: evidence.tierEvidence[name],
        summary: summarizeSeeds(results),
        detail: results.find((r) => r.seed === SERIES_SEED),
      };
    }
    output = {
      check: "CORRECTION-14-TIER-LADDER",
      map: MAP, years: YEARS, seeds: SEEDS, arm: ARM, founderPopulation: FOUNDER_POPULATION,
      stockPercentiles: evidence.stockPercentiles,
      byTier,
    };
  }

  output.fingerprint = createHash("sha256")
    .update(JSON.stringify(output))
    .digest("hex");
} finally {
  await server.close();
}

const text = JSON.stringify(output, null, 1);
if (OUT !== "") {
  writeFileSync(OUT, text);
  console.log(JSON.stringify({ wrote: OUT, bytes: text.length, fingerprint: output.fingerprint }));
} else {
  console.log(text);
}
