// CORRECTION-23F §12 — QUALIFY A SITE AS `marginal_escapable` BEFORE USING IT AS A TERRAIN.
//
// The previous ten-seed matrix varied near-tie ordering on ONE site. §12 requires independent
// physical variation, and it requires that each terrain still MEAN what the label says —
// otherwise "three terrains" is three different scenarios wearing one name.
//
// A site qualifies only if all four hold:
//   1. the starting range is genuinely marginal — local support is poor;
//   2. materially better country is physically reachable inside expedition range;
//   3. route feasibility to that better country is real but not trivial;
//   4. a founder placed there is neither immortal nor doomed — the tier is an ESCAPE test.
//
// (1)-(3) are read from world truth, which is legitimate here: this is scenario CONSTRUCTION,
// not band perception. No band reads any of it.
//
// Usage: node scripts/marginalSiteQualificationProbe.mjs [--map map2] [--candidates N]
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt;
};

const MAP = arg("map", "map2");
const KNOWN_SITE = arg("known-site", "tile:204:72");
const OUT = arg("out", "docs/evidence/correction23f/site-qualification.json");
const MIN_SEPARATION = Number(arg("min-separation", "40"));

const r3 = (v) => Math.round(v * 1000) / 1000;

const server = await createServer({
  root: `${process.cwd()}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const world = runner.initSimWorld({ kind: MAP }, "c23f:qualify");
  const tiles = Object.values(world.tiles);
  const byId = world.tiles;
  const dist = (a, b) => Math.abs(a.coord.x - b.coord.x) + Math.abs(a.coord.y - b.coord.y);

  // A crude but honest local-support proxy: the mean richness and water of the tile and its
  // immediate neighbours, which is the ground a band actually works day to day.
  const localSupport = (tile) => {
    const ring = [tile, ...tile.neighbors.map((id) => byId[id]).filter(Boolean)];
    return {
      richness: ring.reduce((a, t) => a + t.resourceProfile.baseRichness, 0) / ring.length,
      water: ring.reduce((a, t) => a + t.resourceProfile.waterAccess, 0) / ring.length,
    };
  };

  const passable = (tile) => tile.isAquatic !== true && tile.movementCost < 3;

  const describe = (tile) => {
    const local = localSupport(tile);
    // Better country within the verification/exploration reach the band actually has.
    const reach = tiles.filter((t) => passable(t) && dist(t, tile) >= 4 && dist(t, tile) <= 14);
    const better = reach.filter((t) => {
      const s = localSupport(t);
      return s.richness > local.richness + 0.15 && s.water >= local.water;
    });
    const bestBetter = better.reduce(
      (best, t) => {
        const s = localSupport(t);
        return s.richness > best.richness ? { tile: t, richness: s.richness, water: s.water } : best;
      },
      { tile: undefined, richness: 0, water: 0 },
    );
    // Route feasibility: how much of the straight-line corridor to the best better country is
    // passable. 1.0 is trivial, very low is impassable; the tier wants "real but not trivial".
    let corridorPassable = null;
    if (bestBetter.tile !== undefined) {
      const steps = [];
      const n = dist(bestBetter.tile, tile);
      for (let i = 1; i <= n; i += 1) {
        const x = Math.round(tile.coord.x + ((bestBetter.tile.coord.x - tile.coord.x) * i) / n);
        const y = Math.round(tile.coord.y + ((bestBetter.tile.coord.y - tile.coord.y) * i) / n);
        const t = byId[`tile:${x}:${y}`];
        if (t !== undefined) steps.push(passable(t));
      }
      corridorPassable = steps.length === 0 ? null : steps.filter(Boolean).length / steps.length;
    }

    return {
      tileId: tile.id,
      coord: tile.coord,
      localRichness: r3(local.richness),
      localWater: r3(local.water),
      betterCountryCount: better.length,
      bestReachableRichness: r3(bestBetter.richness),
      bestReachableWater: r3(bestBetter.water),
      bestReachableDistance: bestBetter.tile === undefined ? null : dist(bestBetter.tile, tile),
      corridorPassableShare: corridorPassable === null ? null : r3(corridorPassable),
      terrainKind: tile.terrainKind,
    };
  };

  const reference = describe(byId[KNOWN_SITE]);

  // Candidates must be genuinely marginal, have real escape options, and be FAR from the
  // established site so the terrain is independent rather than a neighbouring tile.
  const referenceTile = byId[KNOWN_SITE];
  const candidates = tiles
    .filter(passable)
    .filter((t) => dist(t, referenceTile) >= MIN_SEPARATION)
    .map(describe)
    .filter(
      (row) =>
        row.localRichness <= reference.localRichness + 0.06 &&
        row.localRichness >= reference.localRichness - 0.10 &&
        row.betterCountryCount >= 8 &&
        row.bestReachableRichness >= row.localRichness + 0.18 &&
        row.corridorPassableShare !== null &&
        row.corridorPassableShare >= 0.55 &&
        row.corridorPassableShare <= 0.98,
    );

  // Spread the chosen sites apart from each other too.
  const chosen = [];
  for (const row of candidates.sort((a, b) => String(a.tileId).localeCompare(String(b.tileId)))) {
    if (chosen.every((c) => dist(byId[c.tileId], byId[row.tileId]) >= MIN_SEPARATION)) {
      chosen.push(row);
    }
    if (chosen.length >= 2) break;
  }

  const result = { map: MAP, reference, candidatesConsidered: candidates.length, chosen };

  console.log("REFERENCE (terrain A):", JSON.stringify(reference));
  console.log(`qualifying candidates >= ${MIN_SEPARATION} tiles away: ${candidates.length}`);
  for (const row of chosen) console.log("CHOSEN:", JSON.stringify(row));

  mkdirSync(OUT.slice(0, OUT.lastIndexOf("/")), { recursive: true });
  writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log(`wrote ${OUT}`);
} finally {
  await server.close();
}
