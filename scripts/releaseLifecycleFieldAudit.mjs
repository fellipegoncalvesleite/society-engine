// CORRECTION-35 PART A — do the exported release-lifecycle fields agree with actual behaviour?
//
// The Item 3 final integration audit measured one place production labels `released_historical`
// that still moves behaviour by 0.02. This probe reproduces that incident from the natural world
// AND constructs the whole weight ladder (A1-A5) so the contradiction is characterised rather than
// merely witnessed once.
//
// The behavioural instrument is CORRECTION-31's with-minus-without counterfactual, narrowed to a
// SINGLE TILE's own records: derive access twice, once as production does and once with only that
// tile's friction removed, and subtract. Reading raw scalars does not work — they also carry the
// band's own use pressure — and stripping the whole ring would also remove other tiles' effects.
//
// Arm-neutral: the identical file runs on both trees.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/shared-range-release-territorial-authority-35";
const PHASE = arg("phase", "before");
const OUT = arg("out", `${EVIDENCE}/release-lifecycle-${PHASE}.json`);
const SEED = arg("seed", "audit27:natural:map2:s1");
const INCIDENT_DAY = Number(arg("incident-day", "44640"));

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c35a-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const accessNorms = await server.ssrLoadModule("/sim/agents/accessNorms.ts");

  const round4 = (v) => (typeof v === "number" ? Math.round(v * 10000) / 10000 : v);

  // Contribution of ONE TILE's own friction records, measured through production.
  const tileContribution = (world, band, tileId) => {
    const kept = (band.recentRangeFrictionEvents ?? []).filter((e) => String(e.tileId) !== String(tileId));
    const strippedBand = { ...band, recentRangeFrictionEvents: kept };
    const strippedWorld = { ...world, bands: { ...world.bands, [band.id]: strippedBand } };
    const withEvidence = accessNorms.advanceProtoAccessMemory(world, band).places?.[tileId];
    const without = accessNorms.advanceProtoAccessMemory(strippedWorld, strippedBand).places?.[tileId];
    const g = (o, k) => (o === undefined ? 0 : (o[k] ?? 0));
    const d = (k) => round4(g(withEvidence, k) - g(without, k));
    const scalars = ["strangerCaution", "sharedUsePressure", "rememberedRefusalAvoidance",
      "rememberedCooperationTolerance", "kinTolerance", "familiarTolerance"];
    const deltas = Object.fromEntries(scalars.map((k) => [k, d(k)]));
    return {
      fields: {
        socialEvidencePhase: withEvidence?.socialEvidencePhase ?? null,
        activeEvidenceCount: withEvidence?.activeEvidenceCount ?? null,
        historicalEvidenceCount: withEvidence?.historicalEvidenceCount ?? null,
        activeEvidenceWeight: withEvidence?.activeEvidenceWeight ?? null,
        confidence: round4(withEvidence?.confidence ?? 0),
      },
      recordsNamingThisTile: (band.recentRangeFrictionEvents ?? []).filter((e) => String(e.tileId) === String(tileId)).length,
      deltas,
      totalBehaviourDelta: round4(Object.values(deltas).reduce((s, v) => s + Math.abs(v), 0)),
      placeTracked: withEvidence !== undefined,
    };
  };

  // ── the natural incident, replayed ──────────────────────────────────────────────────────────
  let world = runner.initSimWorld({ kind: "map2" }, SEED);
  world = advance.advanceWorldByDays(world, INCIDENT_DAY);
  let incident = null;
  for (const band of Object.values(world.bands)) {
    if (band.status === "dispersed" || band.viability?.status === "extinct") continue;
    const access = accessNorms.advanceProtoAccessMemory(world, band);
    for (const p of Object.values(access.places ?? {})) {
      if (p.socialEvidencePhase !== "released_historical") continue;
      const c = tileContribution(world, band, p.tileId);
      if (c.totalBehaviourDelta <= 0) continue;
      const records = (band.recentRangeFrictionEvents ?? [])
        .filter((e) => String(e.tileId) === String(p.tileId))
        .map((e) => ({ eventId: String(e.eventId), tick: Number(e.tick),
          ageTicks: Number(world.time.tick) - Number(e.tick),
          confidence: String(e.confidence), relation: String(e.relation),
          interpretation: String(e.interpretation), tensionLevel: String(e.tensionLevel),
          linkedReportId: e.linkedReportId === undefined ? null : String(e.linkedReportId) }));
      incident = { day: INCIDENT_DAY, tick: Number(world.time.tick), band: String(band.id),
        tile: String(p.tileId), ...c, records };
      break;
    }
    if (incident !== null) break;
  }

  // ── the controlled weight ladder A1-A5 ──────────────────────────────────────────────────────
  // A real record from the natural world is used as the template so no field shape is invented;
  // only `tick` and `confidence` are varied, which is exactly what the weight curve reads.
  let template = null;
  for (const band of Object.values(world.bands)) {
    const e = (band.recentRangeFrictionEvents ?? [])[0];
    if (e !== undefined) { template = e; break; }
  }
  if (template === undefined || template === null) {
    throw new Error("no real friction record exists to use as a template — the probe refuses to invent one");
  }

  const host = Object.values(world.bands).find((b) =>
    b.status !== "dispersed" && b.viability?.status !== "extinct");
  const tileId = host.position;
  const nowTick = Number(world.time.tick);

  // SELF-CALIBRATING LADDER.
  //
  // A first version picked ages from the published curve and got every bucket wrong: the observer
  // had accumulated `presentWithoutOthersSeasons`, which adds PRESENT_WITHOUT_OTHERS_AGE_BONUS_TICKS
  // per season to the effective age, so an age-0 record already weighed 0.89. Rather than model
  // that bonus and risk modelling it wrongly, the probe SWEEPS integer ages through production and
  // reads the weight production actually assigns, then selects each bucket from the observed sweep.
  // A bucket that cannot be hit is reported NOT_CONSTRUCTED rather than approximated.
  const mk = (ageTicks, over = {}) => ({
    ...template,
    eventId: `c35:${ageTicks}:${over.confidence ?? "observed"}`,
    tick: nowTick - ageTicks,
    tileId,
    relation: "stranger_or_unrecognized",
    interpretation: "repeated_outsider_use",
    tensionLevel: "watchful",
    confidence: "observed",
    linkedReportId: undefined,
    ...over,
  });
  // The contradiction channel adds PRESENT_WITHOUT_OTHERS_AGE_BONUS_TICKS per season to the
  // effective age whenever the band stands at the place with nobody in proximity. On this host it
  // offsets every injected age by +4, which put weight 1 out of reach. Setting a non-zero
  // `nearbyBandPressure` makes `presentWithoutOthers` false and the bonus 0, so the sweep reads the
  // pure age curve. Both arms of every contribution measurement share the override, so the measured
  // DELTA is unaffected by it.
  const withoutContradictionBonus = (band) => ({
    ...band,
    pressureState: { ...(band.pressureState ?? {}), nearbyBandPressure: 0.01 },
  });
  // The reported path multiplies by the report's own hop factor and freshness. A report the band
  // does not hold reads as hops 1 / freshness 1, which lands exactly ON 0.05 and cannot enter the
  // sub-threshold band. A held two-hop report is what the natural incident effectively has. Only
  // `hops` and `freshness` are read at this seam.
  const reportsFor = (hops) => ({ reports: [{ reportId: "c35:report", hops, freshness: 1 }] });

  const probe = (events, label, over = {}) => {
    const band = withoutContradictionBonus({ ...host, recentRangeFrictionEvents: events, ...over });
    const w = { ...world, bands: { ...world.bands, [host.id]: band } };
    return { case: label, ...tileContribution(w, band, tileId) };
  };

  const sweep = (over, kind, bandOver = {}) => {
    const rows = [];
    for (let age = 0; age <= 24; age += 1) {
      const r = probe([mk(age, over)], `${kind}:age${age}`, bandOver);
      rows.push({ injectedAgeTicks: age, weight: r.fields.activeEvidenceWeight,
        phase: r.fields.socialEvidencePhase, activeCount: r.fields.activeEvidenceCount,
        historicalCount: r.fields.historicalEvidenceCount, confidence: r.fields.confidence,
        behaviourDelta: r.totalBehaviourDelta });
    }
    return rows;
  };
  const directSweep = sweep({}, "direct");
  // The reported path multiplies the age curve by REPORTED_EVIDENCE_WEIGHT_CAP (0.7), a hop factor
  // and the report's own freshness, so it can land BETWEEN the integer steps the direct curve is
  // limited to. `linkedReportId` names a report the band does not hold, which production treats as
  // freshness 1 / hops 1 — the most conservative reported case.
  const reportedSweep = sweep({ confidence: "reported_secondhand", linkedReportId: "c35:report",
    tensionLevel: "mild" }, "reported", { reportedKnowledge: reportsFor(2) });

  const pick = (rows, predicate) => rows.find(predicate);
  const bucket = (row, kind) => row === undefined ? { notConstructed: true }
    : { ...probe([mk(row.injectedAgeTicks, kind === "reported"
        ? { confidence: "reported_secondhand", linkedReportId: "c35:report", tensionLevel: "mild" }
        : {})], `${kind}:age${row.injectedAgeTicks}`,
        kind === "reported" ? { reportedKnowledge: reportsFor(2) } : {}),
      injectedAgeTicks: row.injectedAgeTicks };

  const ladder = {
    A1_fresh: bucket(pick(directSweep, (r) => r.weight === 1), "direct"),
    A2_cooling_above_threshold: bucket(pick(directSweep, (r) => r.weight > 0.05 && r.weight < 1), "direct"),
    A3_sub_threshold_still_contributing: bucket(pick(reportedSweep, (r) => r.weight > 0 && r.weight < 0.05), "reported"),
    A4_fully_released: bucket(pick(directSweep, (r) => r.weight === 0), "direct"),
    A5_no_evidence: probe([], "no_records"),
  };
  ladder.A3_sub_threshold_still_contributing.note =
    "the (0, 0.05) band is unreachable for DIRECT evidence on an integer tick age — the direct curve's lowest non-zero steps are 0.2 / 0.11 / 0.08 on the tolerated / neutral / tense horizons. Only the reported path, whose weight is a product, lands inside it. The natural incident is exactly such a record.";

  const sweeps = { direct: directSweep, reported: reportedSweep };

  const a3 = ladder.A3_sub_threshold_still_contributing;
  const a4 = ladder.A4_fully_released;
  const contradiction =
    (a3.fields !== undefined && a3.fields.socialEvidencePhase === "released_historical" && a3.totalBehaviourDelta > 0) ||
    (incident !== null && incident.totalBehaviourDelta > 0);

  out = {
    audit: "CORRECTION-35A-RELEASE-LIFECYCLE-FIELD-CONSISTENCY",
    phase: PHASE,
    headline: contradiction ? "RELEASE LABEL LEADS NON-ZERO BEHAVIOR" : "RELEASE LABEL AGREES WITH BEHAVIOR",
    naturalIncident: incident,
    naturalIncidentReproduced: incident !== null,
    controlledLadder: ladder,
    weightSweeps: sweeps,
    curveFacts: {
      freshTicks: 3, horizons: { tolerated: 8, neutral: 12, tense: 16, reported: 16 },
      weightIsRounded: "weighSocialEvidence returns round2(clamp01(weight)), so the smallest non-zero weight is 0.01 and weight === 0 is an EXACT causal zero, not an epsilon",
      everyContributionScalesByWeight: "strongestFrictionRelation, bestContactTolerance, tensionFromFriction, the tolerance and refusal terms and eventPressure all multiply by entry.weight, so weight 0 gives exactly 0 by multiplication",
      subThresholdReachability: "on an integer tick age the direct curve yields 0.2 / 0.11 / 0.08 as its lowest non-zero weights on the tolerated / neutral / tense horizons — all at or above the 0.05 activity threshold. The (0, 0.05) band is reachable only through the REPORTED path, whose weight is a product ageWeight x 0.7 x hopFactor x freshness. That is why the defect is rare and why the natural incident is a reported record.",
    },
    invariantsUnderTest: {
      releasedMeansZeroContribution: a4.fields !== undefined && a4.fields.socialEvidencePhase === "released_historical" && a4.totalBehaviourDelta === 0,
      subThresholdIsLabelledReleasedWhileContributing: a3.fields !== undefined && a3.fields.socialEvidencePhase === "released_historical" && a3.totalBehaviourDelta > 0,
      countsSumToRetainedRecords: Object.values(ladder).every((c) =>
        c.notConstructed === true || c.fields === undefined ||
        (c.fields.activeEvidenceCount + c.fields.historicalEvidenceCount) === c.recordsNamingThisTile),
      everySweepRowWithNonZeroWeightContributes: [...directSweep, ...reportedSweep]
        .filter((r) => r.weight > 0).every((r) => r.behaviourDelta > 0),
      everySweepRowLabelledReleasedContributesNothing: [...directSweep, ...reportedSweep]
        .filter((r) => r.phase === "released_historical").every((r) => r.behaviourDelta === 0),
    },
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
} finally {
  await server.close();
}

console.log(JSON.stringify({
  phase: out.phase, headline: out.headline,
  naturalIncident: out.naturalIncident === null ? null : {
    band: out.naturalIncident.band, tile: out.naturalIncident.tile,
    fields: out.naturalIncident.fields, total: out.naturalIncident.totalBehaviourDelta,
    records: out.naturalIncident.records,
  },
  ladder: Object.fromEntries(Object.entries(out.controlledLadder).map(([k, v]) =>
    [k, v.fields === undefined ? { notConstructed: true } : { age: v.injectedAgeTicks,
      phase: v.fields.socialEvidencePhase, active: v.fields.activeEvidenceCount,
      historical: v.fields.historicalEvidenceCount, weight: v.fields.activeEvidenceWeight,
      confidence: v.fields.confidence, behaviourDelta: v.totalBehaviourDelta }])),
  invariants: out.invariantsUnderTest,
}, null, 2));
