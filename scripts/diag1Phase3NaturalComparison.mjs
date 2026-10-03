import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const directory = 'docs/evidence/diag1-corrections/phase3';
const read = name => JSON.parse(existsSync(`${directory}/${name}.json`) ? readFileSync(`${directory}/${name}.json`, 'utf8') : gunzipSync(readFileSync(`${directory}/${name}.json.gz`)));
const pairs = [];
for (const name of ['map1', 'map2', 'map2multi']) {
    const before = read(`natural-${name}-base`), after = read(`natural-${name}-current`);
    assert.equal(before.initialWorldHash, after.initialWorldHash);
    assert.equal(before.substrateHash, after.substrateHash);
    assert.equal(before.injectedMemories, 0);
    assert.equal(after.injectedMemories, 0);
    const firstIndex = before.trace.findIndex((row, i) => row.hash !== after.trace[i].hash);
    const firstMetrics = {};
    for (const field of ['support', 'stress', 'fatigue', 'population', 'position', 'parties']) {
        for (let i = 0; i < before.trace.length; i++) {
            const a = before.trace[i], b = after.trace[i], bm = new Map(b.bands.map(x => [x.id, x]));
            const changes = a.bands.filter(x => bm.has(x.id) && JSON.stringify(x[field]) !== JSON.stringify(bm.get(x.id)[field]))
                .map(x => ({ band: x.id, before: x[field], after: bm.get(x.id)[field] }));
            if (changes.length) {
                firstMetrics[field] = { day: a.day, changes };
                break;
            }
        }
    }
    const fallback = d => d.trace.flatMap(row => row.events.filter(e => e.kind === 'fauna' && e.fallback).map(event => ({ day: row.day, ...event })));
    pairs.push({ map: after.kind, seed: after.seed, days: after.days, baseline: before.baseline,
        beforeCounts: before.counts, afterCounts: after.counts, finalHashEqual: before.finalWorldHash === after.finalWorldHash,
        finalHashes: [before.finalWorldHash, after.finalWorldHash], firstDivergence: firstIndex < 0 ? null : { day: before.trace[firstIndex].day, before: before.trace[firstIndex].events, after: after.trace[firstIndex].events },
        firstMetrics, fallbackBefore: fallback(before), fallbackAfter: fallback(after),
        finalPopulations: [before, after].map(d => d.trace.at(-1).bands.map(b => ({ id: b.id, population: b.population }))) });
}
const parity = [];
for (const name of ['map1', 'map2']) {
    const before = read(`natural-${name}-current`), after = read(`natural-${name}-readmodel${name === "map1" ? "-stable" : ""}`);
    const changedSource = Object.keys(after.sourceBefore).filter(p => after.sourceBefore[p] !== after.sourceAfter[p]);
    // Non-imported UI source edits are disclosed, never mistaken for mutated simulation bytes.
    assert.ok(changedSource.every(p => p.startsWith('src/ui/') || p.startsWith('src/render/')));
    assert.equal(before.finalWorldHash, after.finalWorldHash);
    assert.equal(before.substrateHash, after.substrateHash);
    assert.ok(before.trace.every((r, i) => r.hash === after.trace[i].hash));
    parity.push({ map: after.kind, days: after.days, fullWorldHash: after.finalWorldHash, allDailyCausalHashesIdentical: true, substrateIdentical: true,
        auditPass: after.pass, changedSourceDuringAudit: changedSource, causalSourcesPreserved: true,
        qualification: changedSource.length ? 'The source-preservation guard detected concurrent UI-only label work; simulation/read-model module hashes and every state fingerprint agree. This is not an overall audit PASS.' : 'Complete audit and fingerprint parity PASS.' });
}
writeFileSync(`${directory}/NATURAL_COMPARISON.json`, JSON.stringify({ pairs, parity, natural: true, injectedMemories: 0 }, null, 2) + '\n');
console.log(JSON.stringify({ pairs: pairs.map(p => ({ map: p.map, firstDivergence: p.firstDivergence?.day ?? null, counts: p.afterCounts })), parity }));
