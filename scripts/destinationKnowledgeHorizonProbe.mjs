// REPEATED-BAND-EXPANSION-FISSION-14 — destination knowledge horizon probe.
//
// Reports the distance distribution of a founder's OWN known-tile records from its
// current residence, every 50 years. This is the measurement behind the checkpoint's
// terminal blocker for multi-generation expansion: on the richest map2 catchment the
// founder's maximum known-tile distance is 7-9 tiles at EVERY sample over 300 years and
// `beyond10_conf>=0.34` is 0 throughout — so a daughter destination can only ever be
// selected inside the parent's own foraging catchment, no matter how the fission target
// is scored. Expanding that horizon is exploration/expedition reach, not fission.
//
// Usage: node scripts/destinationKnowledgeHorizonProbe.mjs
import { createServer } from "vite";
const server = await createServer({ root: `${process.cwd()}/src`, configFile: false, appType: "custom", server: { middlewareMode: true }, logLevel: "error" });
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const spawn = await server.ssrLoadModule("/sim/agents/spawn.ts");
  let world = runner.initSimWorld({ kind: "map2" }, "c14:exceptionally_rich:s1");
  world = spawn.removeInitialBands(world, Object.keys(world.bands));
  world = spawn.spawnCustomBands(world, [{ tileId: "tile:188:92", population: 34, name: "exceptionally_rich" }], "c14:exceptionally_rich:s1");
  const id = Object.keys(world.bands)[0];
  for (let y = 1; y <= 300; y++) {
    world = runner.stepSim(world, 4, "seasonal");
    if (y % 50 !== 0) continue;
    const b = world.bands[id]; if (!b) break;
    const o = world.tiles[b.position];
    const recs = Object.values(b.knowledge.observedTiles).map(r=>{
      const t = world.tiles[r.tileId];
      return t ? { d: Math.abs(t.coord.x-o.coord.x)+Math.abs(t.coord.y-o.coord.y), conf: r.confidence } : null;
    }).filter(Boolean);
    const buckets = {};
    for (const r of recs) { const k = r.d<=5?"0-5":r.d<=10?"6-10":r.d<=15?"11-15":r.d<=20?"16-20":">20"; buckets[k]=(buckets[k]??0)+1; }
    const beyond = recs.filter(r=>r.d>10);
    console.log("y"+String(y).padStart(3), "pos",String(b.position),"pop",b.demography.population,"known",recs.length,
      "buckets",JSON.stringify(buckets), "maxDist", Math.max(...recs.map(r=>r.d)),
      "beyond10_conf>=0.34", beyond.filter(r=>r.conf>=0.34).length);
  }
} finally { await server.close(); }
