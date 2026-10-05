// CORRECTION-23G §9/§10 — SIX QUALIFIED MARGINAL SITES WITH A MEASURED LANDSCAPE PHENOTYPE.
//
// CORRECTION-23F used three sites and could not attribute a mechanism, because three terrains
// with one site each confound "terrain class" with "this particular tile". §10 fixes the
// design: at least six sites, at least two per physical structure class, so a class is never
// represented by a single site.
//
// A site qualifies ONLY on physical construction, never because a run survived. All four must
// hold, and each is checked here before the site is used:
//
//   1. the starting range is genuinely marginal — local support is poor;
//   2. materially better country is physically reachable inside expedition range;
//   3. route feasibility to that better country is real but NOT trivial;
//   4. the escape is physically possible but not free — corridor obstacles exist.
//
// (1)-(4) read world truth. That is legitimate and is scenario CONSTRUCTION, not band
// perception: no band reads any of it, and none of it is written into any band's knowledge.
// The run-dependent half of the phenotype (eviction rate, observation mix, launch rates,
// candidate-set size, near-tie density, mandatory-set pressure, baseline survival margin) is
// NOT guessed here — it is measured from the production F0 control in
// `scheduleReplayMatrixAudit.mjs` and merged into the reported table.
//
// Usage: node scripts/marginalSitePhenotypeProbe.mjs [--map map2] [--out PATH]
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt;
};

const MAP = arg("map", "map2");
// The three CORRECTION-23F sites are carried forward by id so the new matrix is comparable
// with the old one rather than replacing it with an unrelated set.
const INHERITED = arg("inherited", "tile:204:72,tile:10:34,tile:100:23").split(",").filter(Boolean);
const MIN_SEPARATION = Number(arg("min-separation", "40"));
const OUT = arg("out", "docs/evidence/correction23g/site-phenotypes.json");

const r3 = (v) => (v === null || v === undefined ? null : Math.round(v * 1000) / 1000);

const server = await createServer({
  root: `${process.cwd()}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const world = runner.initSimWorld({ kind: MAP }, "c23g:phenotype");
  const byId = world.tiles;
  const tiles = Object.values(byId);
  const dist = (a, b) => Math.abs(a.coord.x - b.coord.x) + Math.abs(a.coord.y - b.coord.y);
  const passable = (tile) => tile.isAquatic !== true && tile.movementCost < 3;

  // The ground a band actually works day to day: the tile and its 4-neighbours.
  const localSupport = (tile) => {
    const ring = [tile, ...tile.neighbors.map((id) => byId[id]).filter(Boolean)];
    const mean = (pick) => ring.reduce((acc, t) => acc + pick(t), 0) / ring.length;
    return {
      richness: mean((t) => t.resourceProfile.baseRichness),
      water: mean((t) => t.resourceProfile.waterAccess),
      aquatic: mean((t) => t.resourceProfile.aquaticPotential),
      variance: mean((t) => t.seasonalProfile.seasonalVariance),
      winterStress: mean((t) => t.seasonalProfile.expectedWinterStress),
      reliability: mean((t) => t.seasonalProfile.reliability),
      foraging: mean((t) => t.carryingCapacity.foraging.foodPerTick),
      aquaticFood: mean((t) => t.carryingCapacity.aquatic.foodPerTick),
    };
  };

  // The straight-line corridor to a destination, plus the band one tile either side of it —
  // that band is what "corridor width" means physically: how much room there is to get past
  // an obstacle without leaving the corridor.
  const corridor = (from, to) => {
    const n = dist(from, to);
    const spine = [];
    const flank = [];

    for (let i = 1; i <= n; i += 1) {
      const x = Math.round(from.coord.x + ((to.coord.x - from.coord.x) * i) / n);
      const y = Math.round(from.coord.y + ((to.coord.y - from.coord.y) * i) / n);
      const tile = byId[`tile:${x}:${y}`];

      if (tile !== undefined) {
        spine.push(tile);
      }

      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const side = byId[`tile:${x + dx}:${y + dy}`];
        if (side !== undefined) flank.push(side);
      }
    }

    return { spine, flank };
  };

  const describe = (tile) => {
    const local = localSupport(tile);
    // "Reachable" means inside the physical envelope a party actually has, not inside the
    // whole map: the verification family reaches 24 tiles, exploration less in practice.
    const reach = tiles.filter((t) => passable(t) && dist(t, tile) >= 4 && dist(t, tile) <= 14);
    const better = reach.filter((t) => {
      const s = localSupport(t);
      return s.richness > local.richness + 0.15 && s.water >= local.water;
    });

    let best = { tile: undefined, richness: 0, water: 0 };

    for (const t of better) {
      const s = localSupport(t);
      if (s.richness > best.richness) best = { tile: t, richness: s.richness, water: s.water };
    }

    // Distinct alternatives, not "how many tiles are good": cluster the better country by a
    // separation of 5 tiles so one large good region counts once.
    const clusters = [];
    for (const t of [...better].sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
      if (clusters.every((c) => dist(c, t) >= 5)) clusters.push(t);
    }

    let route = null;

    if (best.tile !== undefined) {
      const { spine, flank } = corridor(tile, best.tile);
      const spinePassable = spine.filter(passable);
      route = {
        corridorPassableShare: spine.length === 0 ? null : spinePassable.length / spine.length,
        obstacleCount: spine.length - spinePassable.length,
        // Route branching: the mean number of passable ways onward from each corridor tile.
        // A single-file gorge and an open plain both "connect"; only one of them offers the
        // party a choice about where to walk, and only one produces route-country variety.
        routeBranching:
          spinePassable.length === 0
            ? null
            : spinePassable.reduce(
                (acc, t) => acc + t.neighbors.map((id) => byId[id]).filter((n) => n !== undefined && passable(n)).length,
                0,
              ) / spinePassable.length,
        corridorWidth: flank.length === 0 ? null : flank.filter(passable).length / flank.length,
      };
    }

    const structure = {
      isCoastal: tile.isCoastal === true,
      isRiver: tile.isRiver === true,
      isEstuary: tile.isEstuary === true,
      isFloodplain: tile.isFloodplain === true,
      isRiverbank: tile.isRiverbank === true,
      isMarshChannel: tile.isMarshChannel === true,
      isConfluence: tile.isConfluence === true,
    };
    // Crossing structure in reach: how much water the party has to get around or over.
    const reachAll = tiles.filter((t) => dist(t, tile) >= 1 && dist(t, tile) <= 14);
    const nearby = {
      aquaticTilesInReach: reachAll.filter((t) => t.isAquatic === true).length,
      riverTilesInReach: reachAll.filter((t) => t.isRiver === true).length,
      lakeTilesInReach: reachAll.filter((t) => t.terrainKind === "lake").length,
      wetlandTilesInReach: reachAll.filter((t) => t.terrainKind === "wetlands").length,
      coastTilesInReach: reachAll.filter((t) => t.isCoastal === true).length,
    };
    const biomeMix = {};
    for (const t of reachAll) biomeMix[t.biomeKind] = (biomeMix[t.biomeKind] ?? 0) + 1;

    return {
      tileId: tile.id,
      coord: tile.coord,
      terrainKind: tile.terrainKind,
      biomeKind: tile.biomeKind,
      biomeMix: Object.fromEntries(
        Object.entries(biomeMix)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([k, v]) => [k, r3(v / reachAll.length)]),
      ),
      structure,
      nearby,
      // Starting physical support — what the ground can actually give, before anyone knows it.
      startingPhysicalSupport: {
        localRichness: r3(local.richness),
        localWater: r3(local.water),
        foragingFoodPerTick: r3(local.foraging),
        sustainablePopulation: tile.carryingCapacity.foraging.sustainablePopulation,
      },
      seasonal: {
        seasonalVariance: r3(local.variance),
        leanSeasonSeverity: r3(local.winterStress),
        reliability: r3(local.reliability),
        leanSeasons: tile.seasonalProfile.leanSeasons,
        peakSeasons: tile.seasonalProfile.peakSeasons,
      },
      waterProfile: {
        waterAccess: r3(tile.resourceProfile.waterAccess),
        ringWater: r3(local.water),
        droughtRisk: r3(tile.riskProfile.droughtRisk),
        floodRisk: r3(tile.riskProfile.floodRisk),
      },
      aquaticContribution: {
        aquaticPotential: r3(tile.resourceProfile.aquaticPotential),
        ringAquatic: r3(local.aquatic),
        // The share of the tile's own physical food capacity that is aquatic rather than
        // terrestrial. This is what "aquatic-influenced" has to mean if it is to be a
        // physical property rather than a label on a terrain name.
        aquaticFoodShare: r3(local.aquaticFood / Math.max(1e-9, local.foraging + local.aquaticFood)),
      },
      opportunity: {
        betterCountryCount: better.length,
        distinctViableAlternatives: clusters.length,
        bestReachableRichness: r3(best.richness),
        bestReachableWater: r3(best.water),
        reachableAdvantage: r3(best.richness - local.richness),
        distanceToBestAlternative: best.tile === undefined ? null : dist(best.tile, tile),
      },
      route:
        route === null
          ? null
          : {
              corridorPassableShare: r3(route.corridorPassableShare),
              obstacleCount: route.obstacleCount,
              routeBranching: r3(route.routeBranching),
              corridorWidth: r3(route.corridorWidth),
            },
    };
  };

  const referenceRow = describe(byId[INHERITED[0]]);
  const reference = referenceRow.startingPhysicalSupport;

  // §9 — the qualification conditions, as PHYSICAL CONSTRUCTION. A site is never called
  // `marginal_escapable` because one run survived. Each condition is reported separately so a
  // site that fails one is not silently dropped or silently kept.
  const qualifyConditions = (row) => ({
    startingRangeMarginal:
      row.startingPhysicalSupport.localRichness <= reference.localRichness + 0.06 &&
      row.startingPhysicalSupport.localRichness >= reference.localRichness - 0.1,
    viableAlternativeExists: row.opportunity.betterCountryCount >= 8 && row.opportunity.reachableAdvantage >= 0.18,
    escapePhysicallyPossible: row.route !== null && row.route.corridorPassableShare >= 0.55,
    // "possible but NOT trivial" is the condition CORRECTION-23F's own rule stated and then
    // did not apply to its own reference site. An unobstructed, fully passable corridor is a
    // free escape, and a free escape is a different scenario from an escapable one.
    escapeNotTrivial: row.route !== null && (row.route.corridorPassableShare <= 0.98 || row.route.obstacleCount >= 1),
  });

  const qualifies = (row) => Object.values(qualifyConditions(row)).every(Boolean);

  // §10 — the three required physical structure classes. Aquatic influence is decided by
  // PHYSICAL AQUATIC FOOD CONTRIBUTION or by real coastal/estuarine structure — never by
  // "there is water somewhere within fourteen tiles", which would let a dry plains tile with
  // a distant lake masquerade as an aquatic site.
  const classOf = (row) => {
    if (
      row.structure.isCoastal ||
      row.structure.isEstuary ||
      row.terrainKind === "lake" ||
      row.terrainKind === "wetlands" ||
      row.aquaticContribution.aquaticFoodShare >= 0.1
    ) {
      return "coastal_aquatic";
    }

    if ((row.terrainKind === "plains" || row.terrainKind === "desert") && row.waterProfile.waterAccess < 0.2) {
      return "dry_plains";
    }

    if (["river_valley", "forest", "hills"].includes(row.terrainKind) || row.structure.isRiver) {
      return "other_structure";
    }

    return "unclassified";
  };

  const inheritedRows = INHERITED.map((id) => describe(byId[id])).map((row) => ({
    ...row,
    structureClass: classOf(row),
    qualifies: qualifies(row),
    qualifyConditions: qualifyConditions(row),
    provenance: "correction23f",
  }));

  const allQualified = tiles
    .filter(passable)
    .map(describe)
    .filter(qualifies)
    .map((row) => ({ ...row, structureClass: classOf(row) }));

  // Fill each class up to two sites, keeping every site far from every other so the matrix
  // measures independent country rather than neighbouring tiles.
  const chosen = [...inheritedRows];
  const need = { coastal_aquatic: 2, dry_plains: 2, other_structure: 2 };

  for (const row of chosen) {
    if (need[row.structureClass] !== undefined) need[row.structureClass] -= 1;
  }

  for (const structureClass of ["coastal_aquatic", "dry_plains", "other_structure"]) {
    for (const row of allQualified
      .filter((candidate) => candidate.structureClass === structureClass)
      .sort((a, b) => String(a.tileId).localeCompare(String(b.tileId)))) {
      if (need[structureClass] <= 0) break;

      if (chosen.every((c) => dist(byId[c.tileId], byId[row.tileId]) >= MIN_SEPARATION)) {
        chosen.push({
          ...row,
          qualifies: true,
          qualifyConditions: qualifyConditions(row),
          provenance: "correction23g",
        });
        need[structureClass] -= 1;
      }
    }
  }

  const labels = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const sites = chosen.map((row, index) => ({ label: labels[index], ...row }));
  const composition = {};
  for (const site of sites) composition[site.structureClass] = (composition[site.structureClass] ?? 0) + 1;

  const result = {
    map: MAP,
    qualificationRule:
      "marginal local support within [-0.10,+0.06] of the reference; >=8 better-country tiles in reach; " +
      "reachable advantage >=0.18; corridor passable share in [0.55,0.98]; >=1 physical obstacle on the corridor",
    qualifiedCandidates: allQualified.length,
    composition,
    unmetClassQuota: Object.fromEntries(Object.entries(need).filter(([, remaining]) => remaining > 0)),
    sites,
  };

  for (const site of sites) {
    console.log(
      `${site.label} ${site.tileId.padEnd(15)} ${String(site.terrainKind).padEnd(12)} ${site.structureClass.padEnd(16)} ` +
        `rich=${site.startingPhysicalSupport.localRichness} water=${site.waterProfile.waterAccess} ` +
        `aqShare=${site.aquaticContribution.aquaticFoodShare} adv=${site.opportunity.reachableAdvantage} ` +
        `dist=${site.opportunity.distanceToBestAlternative} alts=${site.opportunity.distinctViableAlternatives} ` +
        `branch=${site.route?.routeBranching} width=${site.route?.corridorWidth} obst=${site.route?.obstacleCount} ` +
        `qual=${site.qualifies}${
          site.qualifies
            ? ""
            : ` FAILS:${Object.entries(site.qualifyConditions)
                .filter(([, ok]) => !ok)
                .map(([name]) => name)
                .join(",")}`
        }`,
    );
  }

  console.log(`\nqualified candidates on the map: ${allQualified.length}`);
  console.log(`composition: ${JSON.stringify(composition)}`);

  if (Object.keys(result.unmetClassQuota).length > 0) {
    console.log(`UNMET CLASS QUOTA: ${JSON.stringify(result.unmetClassQuota)}`);
  }

  mkdirSync(OUT.slice(0, OUT.lastIndexOf("/")), { recursive: true });
  writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log(`wrote ${OUT}`);
} finally {
  await server.close();
}
