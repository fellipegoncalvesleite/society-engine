import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
export const phase2Authority = '80bb005f6bf9856720ac07d3acbae9e4a57c677f';
export const digest = x => createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex');
export function functionText(code, name) { const start = code.indexOf(`function ${name}(`); assert.ok(start >= 0, name); const body = code.indexOf('{', code.indexOf('):', start)); let depth = 1, end = body + 1; for (; depth; end++) {
    if (code[end] === '{')
        depth++;
    if (code[end] === '}')
        depth--;
} return { start, end, text: code.slice(start, end) }; }
export async function phase3Harness(audit, plugins = []) {
    const arg = (k, d) => process.argv.includes('--' + k) ? process.argv[process.argv.indexOf('--' + k) + 1] : d;
    const out = arg('out'), mutant = arg('mutant', 'none'), baseline = arg('baseline');
    assert.ok(out && !existsSync(out), 'fresh explicit --out required');
    const paths = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', 'src'], { encoding: 'utf8' }).trim().split('\n');
    const hashes = () => Object.fromEntries(paths.map(p => [p, digest(readFileSync(p, 'utf8'))]));
    const before = hashes(), rows = [], observations = {}, loaded = {};
    globalThis.__diag3Hits = {};
    const hit = k => `(globalThis as any).__diag3Hits['${k}']=((globalThis as any).__diag3Hits['${k}']??0)+1;`;
    const server = await createServer({ root: resolve('src'), configFile: false, cacheDir: resolve(`node_modules/.vite-diag3-${process.pid}`), appType: 'custom', server: { middlewareMode: true, hmr: false, watch: null, ws: false }, logLevel: 'error', plugins: [{ name: 'diag3-overlays', enforce: 'pre', transform(code, id) {
                    const relative = id.startsWith(resolve('src') + '/') ? 'src/' + id.slice(resolve('src').length + 1) : undefined;
                    if (baseline && relative)
                        code = execFileSync('git', ['show', `${baseline}:${relative}`], { encoding: 'utf8', maxBuffer: 12 * 1024 * 1024 });
                    if (mutant === 'fauna' && id.endsWith('/agents/faunaStock.ts')) {
                        const f = functionText(code, 'selectFaunaFoodSource');
                        code = code.slice(0, f.start) + f.text.slice(0, f.text.indexOf('{', f.text.indexOf('):')) + 1) + hit('fauna') + ' return bestStockOfClassAt(geo,tileId,faunaClass);\n}' + code.slice(f.end);
                        loaded.fauna = true;
                    }
                    if (mutant === 'food' && id.endsWith('/agents/intraSeasonTrips.ts')) {
                        assert.ok(code.includes('if (foodOnly && !isFoodClass(memory.resourceClassId)) continue;'));
                        code = code.replace('if (foodOnly && !isFoodClass(memory.resourceClassId)) continue;', hit('food'));
                        loaded.food = true;
                    }
                    if (mutant === 'scout' && id.endsWith('/agents/plantPatches.ts')) {
                        const f = functionText(code, 'derivePlantPatchesForScoutKind'), old = functionText(execFileSync('git', ['show', `${phase2Authority}:src/sim/agents/plantPatches.ts`], { encoding: 'utf8' }), 'derivePlantPatchesForScoutKind');
                        const body = old.text.indexOf('{', old.text.indexOf('):'));
                        code = code.slice(0, f.start) + old.text.slice(0, body + 1) + hit('scout') + old.text.slice(body + 1) + code.slice(f.end);
                        loaded.scout = true;
                    }
                    if (mutant === 'diagnostic' && id.endsWith('/world/ecologicalProjection.ts')) {
                        assert.ok(code.includes('const abundance = dynamic.abundance;'));
                        code = code.replace('const abundance = dynamic.abundance;', hit('diagnostic') + ' const abundance = (world.faunaStocks?.[stock.id] as unknown as { stock?: number })?.stock ?? 0;');
                        loaded.diagnostic = true;
                    }
                    if (id.endsWith('/agents/expedition.ts'))
                        code += '\nexport { maybeLaunchExpedition as auditLaunch, deriveDepartableWorkers as auditDepartable };';
                    if (id.endsWith('/agents/intraSeasonTrips.ts'))
                        code += '\nexport { selectTripCandidate as auditSelect, resolvePhysicalFoodHarvest as auditResolve };';
                    return code;
                } }, ...plugins] });
    const check = async (name, fn) => { try {
        const evidence = await fn();
        rows.push({ name, pass: true, ...(evidence === undefined ? {} : { evidence }) });
    }
    catch (e) {
        rows.push({ name, pass: false, error: String(e.stack) });
    } console.log(`${rows.at(-1).pass ? 'PASS' : 'FAIL'} ${name}`); };
    return { arg, rows, observations, check, load: p => server.ssrLoadModule(`/sim/${p}.ts`), module: p => server.ssrLoadModule(p), async finish(extra = {}) { const after = hashes(); await check('production bytes preserved', () => assert.deepEqual(after, before)); const behavioralFailures = rows.filter(r => !r.pass && r.name !== 'production bytes preserved'); if (mutant !== 'none')
            await check('mutant loaded and executed', () => { assert.ok(loaded[mutant]); assert.ok(globalThis.__diag3Hits[mutant] > 0); }); const result = { audit, mutant, baseline, head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), loaded, executed: globalThis.__diag3Hits, behaviorallyDetected: mutant !== 'none' && behavioralFailures.length > 0, restored: JSON.stringify(before) === JSON.stringify(after), sourceBefore: before, sourceAfter: after, rows, observations, ...extra, pass: rows.every(r => r.pass) }; mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify({ audit, mutant, pass: result.pass, passed: rows.filter(r => r.pass).length, total: rows.length, failed: rows.filter(r => !r.pass).map(r => ({ name: r.name, error: r.error.slice(0, 300) })) })); await server.close(); if (!result.pass)
            process.exitCode = 1; return result; } };
}
