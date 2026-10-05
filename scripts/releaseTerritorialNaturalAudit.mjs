// CORRECTION-35 — NATURAL OCCURRENCE, both parts, one pass.
//
// Two questions this checkpoint must answer with a natural world rather than a constructed one:
//
//   PART A — how often does a place actually occupy the interval the correction is about? A record
//   weighing strictly between 0 and SOCIAL_EVIDENCE_ACTIVE_MIN_WEIGHT is one the parent labelled
//   `released_historical` while it was still moving behaviour. Places at exactly zero were labelled
//   correctly by both trees; places at or above the threshold were labelled correctly by both. Only
//   the open interval is corrected, so its natural frequency IS the natural frequency of the defect.
//
//   PART B — does anything in a natural world write `Band.territorialPressure`, and does its value
//   still reach a decision? Spawn and daughter creation are the only writers the inventory found.
//   This confirms that from the world rather than from the grep.
//
// It also re-measures the ONE natural incident the Item 3 final audit found
// (band:varied-estuary:daughter:1:t412, tile:194:90, day 44,640) across ALL SIX access scalars.
// The original probe read only three — strangerCaution, sharedUsePressure and
// rememberedRefusalAvoidance — and reported a 0.02 total. Whether the true figure is larger once
// kinTolerance, familiarTolerance and rememberedCooperationTolerance are included is a question the
// original evidence cannot answer, so it is answered here rather than asserted either way.
//
// SAMPLING CADENCE, STATED RATHER THAN ASSUMED. `Band.territorialPressure` is a stored field and is
// sampled DAILY. `ProtoAccessMemory` is DERIVED once per tick by `advanceProtoAccessMemory` and has
// no finer-grained value to observe, so it is sampled once per tick; sampling it daily would
// re-derive the identical object up to ninety times and report the repetition as data.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const OUT = arg("out", "artifacts/c35-natural.json");
const SEED = arg("seed", "audit27:natural:map2:s1");
const YEARS = Number(arg("years", "20"));
const DAYS = YEARS * 360;
// The Item 3 incident, re-measured across every scalar.
const INCIDENT_DAY = Number(arg("incident-day", "44640"));
const INCIDENT_BAND = arg("incident-band", "band:varied-estuary:daughter:1:t412");
const INCIDENT_TILE = arg("incident-tile", "tile:194:90");

const ACTIVE_MIN_WEIGHT = 0.05;
// Production's own evidence window and cap, from accessNorms.ts. An earlier form of this audit
// compared `activeEvidenceCount + historicalEvidenceCount` against every record in the ring naming
// the tile, and reported 16 "contradictions" over 50 years. Production does not consider every such
// record: `collectTileFrictionEvidence` keeps only those inside FRICTION_RECENT_WINDOW_TICKS and
// then takes the strongest six. The counts were right and the instrument was wrong.
const FRICTION_RECENT_WINDOW_TICKS = 48;
const FRICTION_EVIDENCE_CAP = 6;
const SCALARS = ["strangerCaution", "sharedUsePressure", "rememberedRefusalAvoidance",
  "rememberedCooperationTolerance", "kinTolerance", "familiarTolerance"];
// What the ORIGINAL Item 3 probe read, kept separately so the two figures are comparable.
const ORIGINAL_SCALARS = ["strangerCaution", "sharedUsePressure", "rememberedRefusalAvoidance"];

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c35nat-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const accessNorms = await server.ssrLoadModule("/sim/agents/accessNorms.ts");
  const pressure = await server.ssrLoadModule("/sim/agents/pressure.ts");
  const contextCache = await server.ssrLoadModule("/sim/agents/contextCache.ts");
  const r4 = (v) => Math.round(v * 10000) / 10000;

  const lifecycle = {
    placeSamples: 0, bandTicksSampled: 0,
    phaseActive: 0, phaseCooling: 0, phaseReleased: 0, phaseNone: 0,
    // The corrected interval: strictly between zero and the confidence threshold.
    placesInCorrectedInterval: 0,
    placesAtExactlyZeroWeight: 0,
    placesAtOrAboveThreshold: 0,
    // Contradictions the corrected fields must never produce.
    releasedWithNonZeroWeight: 0,
    coolingWithZeroWeight: 0,
    countsDisagreeingWithRecordTotal: 0,
    activeCountZeroWithNonZeroWeight: 0,
    correctedIntervalExamples: [], countMismatchExamples: [],
  };
  const territorial = {
    bandDaysSampled: 0,
    distinctBandValues: new Set(),
    valueChangesOutsideDaughterCreation: 0,
    daughterCreationsObserved: 0,
    bandsWithNoSocialEvidenceHoldingNonZeroValue: 0,
    socialPressureProfileValues: new Set(),
    changeExamples: [],
  };
  const lastValue = new Map();
  const knownBands = new Set();

  let world = runner.initSimWorld({ kind: "map2" }, SEED);
  let lastTick = -1;
  let incident = null;
  let incidentDayReached = false;
  let incidentBandsPresentThatDay = [];

  const sampleAccess = (w) => {
    for (const band of Object.values(w.bands)) {
      if (band.status === "dispersed" || band.viability?.status === "extinct") continue;
      const acc = accessNorms.advanceProtoAccessMemory(w, band);
      lifecycle.bandTicksSampled += 1;
      for (const place of Object.values(acc.places ?? {})) {
        lifecycle.placeSamples += 1;
        const weight = place.activeEvidenceWeight ?? 0;
        const phase = place.socialEvidencePhase ?? "none";
        const active = place.activeEvidenceCount ?? 0;
        const historical = place.historicalEvidenceCount ?? 0;
        if (phase === "active") lifecycle.phaseActive += 1;
        else if (phase === "cooling") lifecycle.phaseCooling += 1;
        else if (phase === "released_historical") lifecycle.phaseReleased += 1;
        else lifecycle.phaseNone += 1;

        // Replicate production's filter exactly: this tile, inside the age window, strongest six.
        const tick = Number(w.time.tick);
        const records = Math.min(FRICTION_EVIDENCE_CAP, (band.recentRangeFrictionEvents ?? [])
          .filter((e) => String(e.tileId) === String(place.tileId)
            && tick - Number(e.tick) <= FRICTION_RECENT_WINDOW_TICKS).length);
        if (records > 0 && active + historical !== records) {
          lifecycle.countsDisagreeingWithRecordTotal += 1;
          if (lifecycle.countMismatchExamples.length < 8) {
            const all = (band.recentRangeFrictionEvents ?? [])
              .filter((e) => String(e.tileId) === String(place.tileId));
            lifecycle.countMismatchExamples.push({
              day: Number(w.time.day ?? 0), tick, band: String(band.id), tile: String(place.tileId),
              activeCount: active, historicalCount: historical, sum: active + historical,
              auditExpected: records,
              ringRecordsNamingTile: all.length,
              inWindow: all.filter((e) => tick - Number(e.tick) <= FRICTION_RECENT_WINDOW_TICKS).length,
              ages: all.map((e) => tick - Number(e.tick)).sort((x, y) => x - y).slice(0, 10),
              phase, weight: r4(weight),
            });
          }
        }
        if (phase === "released_historical" && weight > 0 && active > 0) {
          // The corrected fields must never call a place released while still counting a
          // contributing record against it.
          lifecycle.releasedWithNonZeroWeight += 1;
        }
        if (phase === "cooling" && weight === 0) lifecycle.coolingWithZeroWeight += 1;
        if (active === 0 && weight > 0) lifecycle.activeCountZeroWithNonZeroWeight += 1;

        if (records > 0) {
          if (weight === 0) lifecycle.placesAtExactlyZeroWeight += 1;
          else if (weight < ACTIVE_MIN_WEIGHT) {
            lifecycle.placesInCorrectedInterval += 1;
            if (lifecycle.correctedIntervalExamples.length < 12) {
              lifecycle.correctedIntervalExamples.push({
                day: Number(w.time.day ?? 0), tick: Number(w.time.tick),
                band: String(band.id), tile: String(place.tileId),
                weight: r4(weight), phaseNow: phase,
                phaseUnderParentRule: "released_historical",
                activeCountNow: active, historicalCountNow: historical,
              });
            }
          } else lifecycle.placesAtOrAboveThreshold += 1;
        }
      }
    }
  };

  // Strip exactly this tile's own friction records and re-derive — the Item 3 artefact test.
  const measureIncident = (w, band, tileId) => {
    const events = band.recentRangeFrictionEvents ?? [];
    const kept = events.filter((e) => String(e.tileId) !== String(tileId));
    const stripped = { ...band, recentRangeFrictionEvents: kept };
    const withE = accessNorms.advanceProtoAccessMemory(w, band).places?.[tileId];
    const without = accessNorms
      .advanceProtoAccessMemory({ ...w, bands: { ...w.bands, [band.id]: stripped } }, stripped)
      .places?.[tileId];
    if (withE === undefined) return null;
    const g = (o, k) => (o === undefined ? 0 : (o[k] ?? 0));
    const deltas = Object.fromEntries(SCALARS.map((k) => [k, r4(g(withE, k) - g(without, k))]));
    return {
      day: Number(w.time.day ?? 0), band: String(band.id), tile: String(tileId),
      phase: withE.socialEvidencePhase, activeEvidenceCount: withE.activeEvidenceCount,
      historicalEvidenceCount: withE.historicalEvidenceCount,
      activeEvidenceWeight: withE.activeEvidenceWeight,
      recordsNamingThisTile: events.length - kept.length,
      recordsNamingOtherTiles: kept.length,
      placeStillTrackedWhenStripped: without !== undefined,
      deltas,
      totalAcrossAllSixScalars: r4(Object.values(deltas).reduce((s, v) => s + Math.abs(v), 0)),
      totalAcrossTheThreeTheOriginalProbeRead:
        r4(ORIGINAL_SCALARS.reduce((s, k) => s + Math.abs(deltas[k]), 0)),
    };
  };

  for (let day = 0; day < DAYS; day += 1) {
    world = advance.advanceWorldByDays(world, 1);

    // ── Part B, sampled DAILY because the field is stored ──
    for (const band of Object.values(world.bands)) {
      if (band.status === "dispersed" || band.viability?.status === "extinct") continue;
      territorial.bandDaysSampled += 1;
      const v = band.territorialPressure;
      territorial.distinctBandValues.add(r4(v));
      territorial.socialPressureProfileValues.add(r4(band.socialPressure?.territorialPressure ?? -1));
      const isNew = !knownBands.has(String(band.id));
      if (isNew) {
        knownBands.add(String(band.id));
        if (day > 0) territorial.daughterCreationsObserved += 1;
      } else if (lastValue.get(String(band.id)) !== v) {
        territorial.valueChangesOutsideDaughterCreation += 1;
        if (territorial.changeExamples.length < 8) {
          territorial.changeExamples.push({ day, band: String(band.id),
            from: lastValue.get(String(band.id)), to: v });
        }
      }
      lastValue.set(String(band.id), v);
      const hasSocialEvidence = (band.recentRangeFrictionEvents ?? []).length > 0
        || Object.keys(band.contactMemories ?? {}).length > 0;
      if (!hasSocialEvidence && v > 0) territorial.bandsWithNoSocialEvidenceHoldingNonZeroValue += 1;
    }

    // ── Part A, sampled once per TICK, its own derivation cadence ──
    const tick = Number(world.time.tick);
    if (tick !== lastTick) { lastTick = tick; sampleAccess(world); }

    if (Number(world.time.day ?? 0) === INCIDENT_DAY && incident === null) {
      const b = world.bands[INCIDENT_BAND];
      incidentDayReached = true;
      incidentBandsPresentThatDay = Object.keys(world.bands).sort();
      if (b !== undefined) incident = measureIncident(world, b, INCIDENT_TILE);
    }
  }

  // The territorial field cannot reach a decision if varying it changes nothing. Confirm on the
  // FINAL natural world rather than on a constructed one.
  const cache = contextCache.buildTickContextCache(world);
  let bandsProbed = 0; let bandsMoved = 0;
  for (const band of Object.values(world.bands)) {
    if (band.status === "dispersed" || band.viability?.status === "extinct") continue;
    bandsProbed += 1;
    const readings = [0, 0.12, 0.8].map((v) => {
      const b = { ...band, territorialPressure: v };
      const w = { ...world, bands: { ...world.bands, [band.id]: b } };
      const c = contextCache.buildTickContextCache(w);
      const st = pressure.deriveBandPressureState(w, b, c);
      return `${r4(st.mobilityPressure)}|${r4(st.netMovePressure)}`;
    });
    if (new Set(readings).size > 1) bandsMoved += 1;
  }

  out = {
    audit: "CORRECTION-35-NATURAL-OCCURRENCE",
    seed: SEED, years: YEARS, days: DAYS,
    samplingCadence: {
      territorialField: "daily (stored field)",
      protoAccessMemory: "once per tick (its own derivation cadence; there is no finer value to observe)",
    },
    releaseLifecycle: {
      ...lifecycle,
      correctedIntervalShare: lifecycle.placeSamples === 0 ? 0
        : r4(lifecycle.placesInCorrectedInterval / lifecycle.placeSamples),
      interpretation: lifecycle.placesInCorrectedInterval === 0
        ? "NO place in this world occupies the corrected interval, so at this seed and horizon the parent's labels were already right and the correction changes no published field. That is a NULL OBSERVATION about frequency, not evidence that the defect does not exist — the Item 3 audit found it once in 448 released samples over 200 years, and the controlled fixtures L1/L2 are the proof it is real."
        : "the corrected interval IS occupied naturally; every one of these places was published as released_historical by the parent while still moving behaviour",
      contradictionsAfterCorrection:
        lifecycle.releasedWithNonZeroWeight + lifecycle.coolingWithZeroWeight
        + lifecycle.countsDisagreeingWithRecordTotal + lifecycle.activeCountZeroWithNonZeroWeight,
    },
    territorialPressure: {
      ...territorial,
      distinctBandValues: [...territorial.distinctBandValues].sort((a, b) => a - b),
      socialPressureProfileValues: [...territorial.socialPressureProfileValues].sort((a, b) => a - b),
      bandsProbedOnFinalWorld: bandsProbed,
      bandsWhereVaryingTheFieldMovedPressure: bandsMoved,
      interpretation: bandsMoved === 0
        ? "varying the field across its whole range moves no band's pressure on the final natural world"
        : "the field still reaches pressure — INVESTIGATE",
    },
    itemThreeIncidentReMeasured: incident === null
      ? { measured: false,
          incidentDay: INCIDENT_DAY, horizonDays: DAYS,
          incidentDayReached,
          incidentBandPresent: incidentBandsPresentThatDay.includes(INCIDENT_BAND),
          bandsPresentOnThatDay: incidentBandsPresentThatDay,
          reason: !incidentDayReached
            ? `the run is shorter than day ${INCIDENT_DAY}`
            : `day ${INCIDENT_DAY} was reached but band ${INCIDENT_BAND} does not exist in THIS tree's world. That is expected on the corrected tree: Part B changes movement decisions, so a 200-year trajectory diverges from the parent's and a daughter lineage founded at tick 412 in one world need not exist in the other. The incident must be re-measured on the tree where it was found — run this audit in a parent worktree.`,
          incidentDayReachedNote: "reported explicitly so 'not measured' is never mistaken for 'measured zero'" }
      : { measured: true, ...incident,
          originalItemThreeReport: { strangerCaution: 0.01, sharedUsePressure: 0, rememberedRefusalAvoidance: 0.01, total: 0.02, scalarsRead: ORIGINAL_SCALARS },
          note: "the original probe read three scalars and reported 0.02. This re-measurement reads all six." },
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
} finally {
  await server.close();
}

console.log(JSON.stringify({
  seed: out.seed, years: out.years,
  lifecycle: {
    placeSamples: out.releaseLifecycle.placeSamples,
    correctedInterval: out.releaseLifecycle.placesInCorrectedInterval,
    exactlyZero: out.releaseLifecycle.placesAtExactlyZeroWeight,
    atOrAboveThreshold: out.releaseLifecycle.placesAtOrAboveThreshold,
    contradictions: out.releaseLifecycle.contradictionsAfterCorrection,
    phases: { active: out.releaseLifecycle.phaseActive, cooling: out.releaseLifecycle.phaseCooling,
      released: out.releaseLifecycle.phaseReleased, none: out.releaseLifecycle.phaseNone },
  },
  territorial: {
    bandDays: out.territorialPressure.bandDaysSampled,
    distinctValues: out.territorialPressure.distinctBandValues,
    changesOutsideDaughterCreation: out.territorialPressure.valueChangesOutsideDaughterCreation,
    daughterCreations: out.territorialPressure.daughterCreationsObserved,
    bandsMovedByField: out.territorialPressure.bandsWhereVaryingTheFieldMovedPressure,
  },
  incidentMeasured: out.itemThreeIncidentReMeasured.measured,
  incidentTotals: out.itemThreeIncidentReMeasured.measured
    ? { allSix: out.itemThreeIncidentReMeasured.totalAcrossAllSixScalars,
        originalThree: out.itemThreeIncidentReMeasured.totalAcrossTheThreeTheOriginalProbeRead }
    : null,
}, null, 2));
