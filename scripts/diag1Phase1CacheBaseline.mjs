// Read-only baseline witness. Run with DIAG1_PHASE1_VITE pointing to Vite's Node entry.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const { createServer } = await import(process.env.DIAG1_PHASE1_VITE ? pathToFileURL(process.env.DIAG1_PHASE1_VITE).href : 'vite');
const outIndex = process.argv.indexOf('--out');
if (outIndex < 0 || !process.argv[outIndex + 1]) throw new Error('Explicit fresh --out path required; historical evidence is immutable.');
const out = resolve(process.argv[outIndex + 1]);
if (existsSync(out)) throw new Error('Refusing to overwrite existing evidence: ' + out);
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim();
const sourceHash = createHash('sha256').update(readFileSync('src/sim/agents/plantStock.ts')).digest('hex');
const server = await createServer({ root: resolve('src'), configFile: false, cacheDir: resolve('artifacts/diag1-phase1-cache'), appType: 'custom', server: { middlewareMode: true, hmr: false, watch: null, ws: false }, logLevel: 'error' });
try {
  const gen = await server.ssrLoadModule('/sim/world/generate.ts');
  const ps = await server.ssrLoadModule('/sim/agents/plantStock.ts');
  const clock = await server.ssrLoadModule('/sim/tick/time.ts');
  const world = gen.createVariedMigrationWorld();
  const rows = [];
  for (const seasonDay of [0, 90, 180, 270]) {
    const t0 = clock.getWorldTimeForDay(seasonDay), t1 = clock.getWorldTimeForDay(360 + seasonDay);
    for (const id of ['tile:0:0', 'tile:6:0']) {
      const tile = structuredClone(world.tiles[id]);
      const original = JSON.stringify(tile);
      ps.resolvePlantFoodHarvest({ ...world, time: t0 }, tile, t0, 1, false);
      const current = { ...world, time: t1 };
      const warm = ps.resolvePlantFoodHarvest(current, tile, t1, 1, true);
      const cold = ps.resolvePlantFoodHarvest(current, structuredClone(tile), t1, 1, true);
      const summarize = ({ world: after, ...harvest }) => ({ ...harvest, depletion: after.plantPatchState });
      rows.push({ id, t0, t1, tileUnchanged: original === JSON.stringify(tile), inputUndepleted: world.plantPatchState === undefined, warm: summarize(warm), cold: summarize(cold) });
    }
  }
  mkdirSync(resolve(out, '..'), { recursive: true });
  writeFileSync(out, JSON.stringify({ sourceCommit, sourceHash, rows }, null, 2) + '\n');
  assert.ok(rows.every(row => row.tileUnchanged && row.inputUndepleted), 'input controls must be valid');
  console.log(JSON.stringify(rows.map(({ id, t1, warm, cold }) => ({ id, season: t1.season, warmTake: warm.harvestedAmount, coldTake: cold.harvestedAmount }))));
  assert.deepEqual(rows.map(row => row.warm), rows.map(row => row.cold), 'B-003: identical year-1 state must have identical physical take and depletion regardless of year-0 cache priming');
} finally { await server.close(); }
