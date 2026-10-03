import assert from 'node:assert/strict';
import { phase3Harness, digest } from './lib/diag1Phase3Harness.mjs';

const h = await phase3Harness('DIAG1 Chronicle heuristic risk presentation');
const [runner, history, chronicle, clock] = await Promise.all([
    'runner/simRunner', 'agents/bandHistory', 'agents/bandChronicle', 'tick/time',
].map(h.load));

// Controlled score, through the real history producer and public projection.
// This is a presentation witness, not evidence of natural prevalence.
let world = runner.initSimWorld({ kind: 'map2_single_origin' }, 'review:chronicle-risk');
let band = Object.values(world.bands)[0];
band = {
    ...band,
    deepHistory: band.deepHistory ?? history.createOriginDeepHistory(world, band),
    viability: { ...band.viability, extinctionRisk: .6 },
};
world = { ...world, time: clock.getWorldTimeForDay(360), bands: { [band.id]: band } };
const recorded = history.applyBandDeepHistoryContext(world);
band = recorded.bands[band.id];
const episode = band.deepHistory.episodes.find(e => e.type === 'near_collapse');
await h.check('canonical history producer preserves the supplied 0.6 score', () => {
    assert.ok(episode);
    assert.equal(episode.detail.extinctionRisk, .6);
});

const before = digest(recorded);
const projected = chronicle.deriveBandChronicle(recorded, band);
const summary = projected.article.deepHistory.episodes.find(e => e.title === 'Near collapse')?.summary;
const honestRisk = text => {
    assert.match(text, /heuristic viability\/risk score/i);
    assert.match(text, /no calibrated probability or time horizon/i);
    assert.doesNotMatch(text, /%|chance of extinction/i);
};
await h.check('lived Chronicle episode presents a score with no probability horizon', () => {
    honestRisk(summary);
    assert.match(summary, /0\.60/);
});

await h.check('inherited Chronicle episode retains both lineage and heuristic qualification', () => {
    const inheritedBand = { ...band, deepHistory: { ...band.deepHistory, episodes: [], inheritedEpisodes: [episode] } };
    const inherited = chronicle.deriveBandChronicle(recorded, inheritedBand).article.deepHistory.inherited[0].summary;
    assert.match(inherited, /Lineage memory, not a lived episode/);
    honestRisk(inherited);
});

await h.check('missing or nonfinite historical scores are not invented', () => {
    for (const score of [undefined, NaN, Infinity]) {
        const incomplete = { ...episode, detail: { ...episode.detail, extinctionRisk: score } };
        const incompleteBand = { ...band, deepHistory: { ...band.deepHistory, episodes: [incomplete] } };
        const text = chronicle.deriveBandChronicle(recorded, incompleteBand).article.deepHistory.episodes[0].summary;
        honestRisk(text);
        assert.doesNotMatch(text, /NaN|Infinity|0\.60/);
    }
});

await h.check('projection preserves full world and historical evidence', () => {
    assert.equal(digest(recorded), before);
    assert.equal(band.deepHistory.episodes.find(e => e.type === 'near_collapse').detail.extinctionRisk, .6);
});

await h.check('Chronicle on/off leaves every daily full-world fingerprint identical', () => {
    let observed = recorded, unobserved = structuredClone(recorded);
    const daily = [];
    for (let day = 0; day < 14; day++) {
        for (const currentBand of Object.values(observed.bands)) chronicle.deriveBandChronicle(observed, currentBand);
        observed = runner.stepSim(observed, 1, 'daily');
        unobserved = runner.stepSim(unobserved, 1, 'daily');
        assert.equal(digest(observed), digest(unobserved));
        daily.push({ day: observed.time.elapsedDays, fingerprint: digest(observed) });
    }
    h.observations.dailyParity = daily;
});
h.observations.fixture = 'Controlled canonical near-collapse record, not natural prevalence';
h.observations.summary = summary;
h.observations.uiConsumers = ['src/ui/band/History.tsx:406', 'src/ui/band/History.tsx:422'];
await h.finish();
