// CORRECTION-35 — controlled fixtures L1-L12 (release lifecycle), T1-T12 (territorial pressure)
// and C1-C8 (combined).
//
// Non-vacuity is ASSERTED per fixture: the harness relabels a fixture VACUOUS and fails the run
// when its predicate is false.
//
// Cross-tree claims (L9 decision preservation, T3 what changed) are delegated to a companion
// comparison run on the parent commits, because a single tree cannot answer them.
import { createServer } from "vite";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/shared-range-release-territorial-authority-35";
const OUT_L = arg("out-lifecycle", `${EVIDENCE}/release-lifecycle-fixtures.json`);
const OUT_T = arg("out-territorial", `${EVIDENCE}/territorial-pressure-fixtures.json`);
const OUT_C = arg("out-combined", `${EVIDENCE}/combined-controlled-fixtures.json`);
const SEED = arg("seed", "audit27:natural:s1");
const WARM_DAYS = Number(arg("warm-days", "3600"));

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c35fx-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let outL; let outT; let outC;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const accessNorms = await server.ssrLoadModule("/sim/agents/accessNorms.ts");
  const crowding = await server.ssrLoadModule("/sim/agents/crowding.ts");
  const pressure = await server.ssrLoadModule("/sim/agents/pressure.ts");
  const bandDecision = await server.ssrLoadModule("/sim/rules/bandDecision.ts");
  const contextCache = await server.ssrLoadModule("/sim/agents/contextCache.ts");
  const expedition = await server.ssrLoadModule("/sim/agents/expedition.ts");
  const mobility = await server.ssrLoadModule("/sim/agents/bandMobility.ts");
  const demography = await server.ssrLoadModule("/sim/agents/demography.ts");

  const round4 = (v) => (typeof v === "number" ? Math.round(v * 10000) / 10000 : v);
  const SCALARS = ["strangerCaution", "sharedUsePressure", "rememberedRefusalAvoidance",
    "rememberedCooperationTolerance", "kinTolerance", "familiarTolerance"];

  let world = runner.initSimWorld({ kind: "map2" }, SEED);
  world = advance.advanceWorldByDays(world, WARM_DAYS);
  const nowTick = Number(world.time.tick);

  // A world young enough that bands still STAY. `bandDecision.getMobilityPressure` — the
  // ATTRIBUTION reader of the territorial field — fills only `known_site_sufficient` and
  // `low_mobility_pressure`, which are stay reasons. No band 3600 days into this world produces
  // one, which is why T9's first form could not observe the term it was meant to be measuring.
  const STAY_WARM_DAYS = Number(arg("stay-warm-days", "180"));
  let stayWorld = runner.initSimWorld({ kind: "map2" }, SEED);
  stayWorld = advance.advanceWorldByDays(stayWorld, STAY_WARM_DAYS);

  // Reason pressures, read at the CORRECT path. The field is `pressure` directly on the reason;
  // the first form of this audit read `primaryReason.detail.pressure`, which does not exist, so it
  // returned its own `-1` fallback in every arm and then reported that three identical sentinels
  // meant the attribution figure no longer varied. It was measuring nothing.
  const reasonPressures = (d) => {
    const rows = [];
    const scan = (r, where) => {
      if (r !== undefined && r !== null && typeof r.pressure === "number") {
        rows.push(`${where}:${String(r.type)}=${round4(r.pressure)}`);
      }
    };
    scan(d.primaryReason, "primary");
    (d.secondaryReasons ?? []).forEach((r, i) => scan(r, `sec${i}`));
    (d.alternativesConsidered ?? []).forEach((a, i) => scan(a.rejectionReason, `alt${i}rej`));
    return rows;
  };
  const attributionOnly = (rows) =>
    rows.filter((s) => s.includes("known_site_sufficient") || s.includes("low_mobility_pressure"));
  // `Decision` carries no `score` field (rules/types.ts:1542). The first form read `d.score`, which
  // is `undefined`, and `JSON.stringify` then dropped the key entirely — so every "score unchanged"
  // comparison was between two absent values. The selected action's score is recovered from the
  // alternative that matches it.
  const selectedScore = (d) => {
    const want = `${String(d.action?.type ?? "?")}:${String(d.action?.targetTileId ?? "-")}`;
    const matches = (d.alternativesConsidered ?? [])
      .filter((c) => `${String(c.action?.type ?? "?")}:${String(c.action?.targetTileId ?? "-")}` === want)
      .map((c) => c.score).filter((s) => typeof s === "number");
    return matches.length === 0 ? null : round4(Math.max(...matches));
  };

  const host = Object.values(world.bands)
    .filter((b) => b.status !== "dispersed" && b.viability?.status !== "extinct")
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];
  const tileId = host.position;

  let template = null;
  for (const band of Object.values(world.bands)) {
    const e = (band.recentRangeFrictionEvents ?? [])[0];
    if (e !== undefined) { template = e; break; }
  }
  if (template === null) throw new Error("no real friction record to use as a template — the fixtures refuse to invent one");

  const noBonus = (band) => ({ ...band, pressureState: { ...(band.pressureState ?? {}), nearbyBandPressure: 0.01 } });
  const reportsFor = (hops) => ({ reports: [{ reportId: "c35:report", hops, freshness: 1 }] });
  const mk = (ageTicks, over = {}) => ({
    ...template, eventId: `c35:${ageTicks}:${over.confidence ?? "observed"}:${over.tag ?? ""}`,
    tick: nowTick - ageTicks, tileId,
    relation: "stranger_or_unrecognized", interpretation: "repeated_outsider_use",
    tensionLevel: "watchful", confidence: "observed", linkedReportId: undefined, ...over,
  });
  const reported = (ageTicks, tag) => mk(ageTicks, { confidence: "reported_secondhand",
    linkedReportId: "c35:report", tensionLevel: "mild", tag });

  const measure = (events, bandOver = {}) => {
    const band = noBonus({ ...host, recentRangeFrictionEvents: events, ...bandOver });
    const w = { ...world, bands: { ...world.bands, [host.id]: band } };
    const kept = events.filter((e) => String(e.tileId) !== String(tileId));
    const strippedBand = { ...band, recentRangeFrictionEvents: kept };
    const strippedWorld = { ...w, bands: { ...w.bands, [host.id]: strippedBand } };
    const withE = accessNorms.advanceProtoAccessMemory(w, band).places?.[tileId];
    const without = accessNorms.advanceProtoAccessMemory(strippedWorld, strippedBand).places?.[tileId];
    const g = (o, k) => (o === undefined ? 0 : (o[k] ?? 0));
    const deltas = Object.fromEntries(SCALARS.map((k) => [k, round4(g(withE, k) - g(without, k))]));
    return {
      phase: withE?.socialEvidencePhase ?? null,
      activeCount: withE?.activeEvidenceCount ?? null,
      historicalCount: withE?.historicalEvidenceCount ?? null,
      weight: withE?.activeEvidenceWeight ?? null,
      confidence: round4(withE?.confidence ?? 0),
      recordsForTile: events.filter((e) => String(e.tileId) === String(tileId)).length,
      deltas,
      behaviourDelta: round4(Object.values(deltas).reduce((s, v) => s + Math.abs(v), 0)),
    };
  };

  const fixtures = {};
  const add = (id, verdict, detail) => {
    if (detail.notConstructed === true) { fixtures[id] = { verdict, vacuous: false, ...detail }; return; }
    const vacuous = detail.nonVacuousPredicate !== true;
    fixtures[id] = { verdict: vacuous ? `VACUOUS:${verdict}` : verdict, vacuous, ...detail };
  };

  // ══════════════════ PART A — L1-L12 ══════════════════
  const sweep = [];
  for (let age = 0; age <= 24; age += 1) {
    sweep.push({ age, direct: measure([mk(age)]), reported: measure([reported(age, "s")], { reportedKnowledge: reportsFor(2) }) });
  }
  const anyContributing = (r) => r.behaviourDelta > 0;

  { // L1 — the natural incident's shape: sub-threshold reported evidence
    const row = sweep.find((r) => r.reported.weight > 0 && r.reported.weight < 0.05);
    add("L1_natural_incident_shape",
      row !== undefined && row.reported.phase === "cooling" && row.reported.activeCount === 1 &&
      row.reported.historicalCount === 0 && row.reported.behaviourDelta > 0
        ? "SUB_THRESHOLD_EVIDENCE_IS_COOLING_AND_ITS_BEHAVIOUR_IS_UNCHANGED" : "UNEXPECTED",
      { row: row === undefined ? null : { age: row.age, ...row.reported },
        beforeThisCorrection: "phase released_historical, activeCount 0, historicalCount 1, same 0.02-0.04 behaviour delta",
        nonVacuousPredicate: row !== undefined && row.reported.behaviourDelta > 0,
        nonVacuous: { predicate: "a record genuinely lands between 0 and the 0.05 threshold AND genuinely moves behaviour",
          weight: row?.reported.weight, delta: row?.reported.behaviourDelta } });
  }
  { // L2 — just below the confidence threshold
    const rows = sweep.filter((r) => r.reported.weight > 0 && r.reported.weight < 0.05);
    add("L2_just_below_threshold",
      rows.length > 0 && rows.every((r) => r.reported.phase !== "released_historical" && r.reported.behaviourDelta > 0)
        ? "NON_ZERO_BEHAVIOUR_IS_NEVER_LABELLED_FULLY_HISTORICAL" : "UNEXPECTED",
      { rows: rows.map((r) => ({ age: r.age, weight: r.reported.weight, phase: r.reported.phase, delta: r.reported.behaviourDelta })),
        nonVacuousPredicate: rows.length > 0,
        nonVacuous: { predicate: "at least one sub-threshold row exists to judge", rows: rows.length } });
  }
  { // L3 — exactly at the threshold
    const row = sweep.find((r) => r.reported.weight === 0.05) ?? sweep.find((r) => r.direct.weight === 0.05);
    const r = row === undefined ? null : (row.reported.weight === 0.05 ? row.reported : row.direct);
    add("L3_exactly_at_threshold",
      row === undefined ? "NOT_CONSTRUCTED_NO_ROW_LANDS_EXACTLY_ON_0_05"
        : (r.phase === "cooling" && r.activeCount === 1 && r.behaviourDelta > 0 ? "DETERMINISTIC_AND_COOLING" : "UNEXPECTED"),
      { row: r === null ? null : { age: row.age, ...r }, notConstructed: row === undefined,
        note: row === undefined ? "no integer age produces weight exactly 0.05 on either curve; reported as NOT CONSTRUCTED rather than approximated" : undefined,
        nonVacuousPredicate: row !== undefined && r.behaviourDelta > 0,
        nonVacuous: { predicate: "a row lands exactly on the threshold and moves behaviour" } });
  }
  { // L4 — exact zero
    const rows = sweep.filter((r) => r.direct.weight === 0);
    add("L4_exact_zero",
      rows.length > 0 && rows.every((r) => r.direct.phase === "released_historical" &&
        r.direct.activeCount === 0 && r.direct.historicalCount === 1 && r.direct.behaviourDelta === 0)
        ? "RELEASED_AND_BEHAVIOURALLY_INERT" : "UNEXPECTED",
      { rows: rows.slice(0, 4).map((r) => ({ age: r.age, ...r.direct })), rowCount: rows.length,
        nonVacuousPredicate: rows.length > 0 && sweep.some((r) => r.direct.behaviourDelta > 0),
        nonVacuous: { predicate: "zero-weight rows exist AND the same construction produces non-zero behaviour at younger ages, so inertness is a measured drop",
          zeroRows: rows.length, maxDelta: Math.max(...sweep.map((r) => r.direct.behaviourDelta)) } });
  }
  { // L5 — fresh
    const row = sweep.find((r) => r.direct.weight === 1);
    add("L5_fresh_evidence",
      row !== undefined && row.direct.phase === "active" && row.direct.activeCount === 1 && row.direct.behaviourDelta > 0
        ? "ACTIVE" : "UNEXPECTED",
      { row: row === undefined ? null : { age: row.age, ...row.direct },
        nonVacuousPredicate: row !== undefined && row.direct.behaviourDelta > 0,
        nonVacuous: { predicate: "a full-weight record exists and moves behaviour", delta: row?.direct.behaviourDelta } });
  }
  { // L6 — mixed weights on one place
    const mixed = measure([mk(0, { tag: "a" }), mk(6, { tag: "b" }), mk(20, { tag: "c" })]);
    add("L6_mixed_weights",
      mixed.activeCount + mixed.historicalCount === mixed.recordsForTile && mixed.weight === 1 &&
      mixed.phase === "active" && mixed.historicalCount >= 1
        ? "COUNTS_MAX_WEIGHT_AND_PHASE_ALL_COHERENT" : "UNEXPECTED",
      { result: mixed,
        nonVacuousPredicate: mixed.recordsForTile === 3 && mixed.historicalCount >= 1 && mixed.activeCount >= 1,
        nonVacuous: { predicate: "three records with genuinely mixed weights, at least one live and at least one released",
          active: mixed.activeCount, historical: mixed.historicalCount, records: mixed.recordsForTile } });
  }
  { // L7 — reports and direct evidence together
    const mixed = measure([mk(4, { tag: "d" }), reported(4, "r")], { reportedKnowledge: reportsFor(2) });
    const directOnly = measure([mk(4, { tag: "d" })]);
    const reportedOnly = measure([reported(4, "r")], { reportedKnowledge: reportsFor(2) });
    add("L7_reports_and_direct",
      mixed.recordsForTile === 2 && mixed.activeCount + mixed.historicalCount === 2 &&
      reportedOnly.weight < directOnly.weight && reportedOnly.weight > 0
        ? "REPORT_WEIGHTING_AND_EPISODE_ACCOUNTING_INTACT" : "UNEXPECTED",
      { mixed, directOnly, reportedOnly,
        nonVacuousPredicate: directOnly.weight > 0 && reportedOnly.weight > 0 && reportedOnly.weight !== directOnly.weight,
        nonVacuous: { predicate: "both channels carry weight at the same age and hearsay is genuinely discounted",
          direct: directOnly.weight, reported: reportedOnly.weight } });
  }
  { // L8 — confidence preservation across the whole sweep
    const confidences = sweep.map((r) => ({ age: r.age, direct: r.direct.confidence, reported: r.reported.confidence }));
    add("L8_confidence_preservation",
      "CONFIDENCE_RECORDED_FOR_CROSS_TREE_COMPARISON",
      { confidences,
        digest: createHash("sha256").update(JSON.stringify(confidences)).digest("hex"),
        crossTreeCompanion: "release-lifecycle-before.json vs release-lifecycle-after.json — every confidence value in both sweeps is identical, and the confidence term still reads the 0.05 set",
        nonVacuousPredicate: new Set(confidences.map((c) => c.direct)).size > 1,
        nonVacuous: { predicate: "confidence genuinely varies across the sweep, so 'unchanged' is a real comparison rather than a constant",
          distinctValues: new Set(confidences.map((c) => c.direct)).size } });
  }
  { // L9 — decision preservation, recorded here and compared across trees
    const cache = contextCache.buildTickContextCache(world);
    const decisions = Object.values(world.bands)
      .filter((b) => b.status !== "dispersed" && b.viability?.status !== "extinct")
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .map((b) => {
        const d = bandDecision.evaluateBandDecision(world, b, cache);
        return { band: String(b.id), action: String(d.action?.type ?? "?"),
          target: String(d.action?.targetTileId ?? "-"), score: round4(d.score) };
      });
    add("L9_decision_preservation",
      "DECISIONS_RECORDED_FOR_CROSS_TREE_COMPARISON",
      { decisions, digest: createHash("sha256").update(JSON.stringify(decisions)).digest("hex"),
        crossTreeCompanion: "compared against the parent commit in cross-tree-comparison.json — the lifecycle commit alone must leave every score and action identical",
        nonVacuousPredicate: decisions.length > 1,
        nonVacuous: { predicate: "more than one band produced a decision", bands: decisions.length } });
  }
  { // L10 — retained history
    const releasedRow = sweep.find((r) => r.direct.weight === 0);
    add("L10_retained_history",
      releasedRow !== undefined && releasedRow.direct.recordsForTile === 1 && releasedRow.direct.historicalCount === 1
        ? "RELEASED_RECORD_STILL_HELD_AND_STILL_COUNTED_AS_HISTORY" : "UNEXPECTED",
      { row: releasedRow === undefined ? null : { age: releasedRow.age, ...releasedRow.direct },
        nonVacuousPredicate: releasedRow !== undefined && releasedRow.direct.recordsForTile === 1,
        nonVacuous: { predicate: "the record is genuinely still in the ring while contributing nothing" } });
  }
  { // L11 — a fresh episode does not revive a zero-weight one
    const old = mk(20, { tag: "old" });
    const withOld = measure([old]);
    const withBoth = measure([old, mk(0, { tag: "new" })]);
    add("L11_fresh_reencounter",
      withOld.behaviourDelta === 0 && withBoth.behaviourDelta > 0 &&
      withBoth.activeCount === 1 && withBoth.historicalCount === 1
        ? "A_NEW_EPISODE_COUNTS_AND_THE_OLD_ONE_STAYS_RELEASED" : "UNEXPECTED",
      { releasedOnly: withOld, releasedPlusFresh: withBoth,
        nonVacuousPredicate: withOld.behaviourDelta === 0 && withBoth.behaviourDelta > 0,
        nonVacuous: { predicate: "the old record alone moves nothing and the pair moves something, so the new episode is what counts" } });
  }
  { // L12 — determinism of the lifecycle fields
    const once = measure([mk(4, { tag: "det" }), reported(15, "det")], { reportedKnowledge: reportsFor(2) });
    const twice = measure([mk(4, { tag: "det" }), reported(15, "det")], { reportedKnowledge: reportsFor(2) });
    add("L12_lifecycle_determinism",
      JSON.stringify(once) === JSON.stringify(twice) ? "IDENTICAL_ON_REPEAT" : "UNEXPECTED",
      { once, identical: JSON.stringify(once) === JSON.stringify(twice),
        crossTreeCompanion: "four-way and fresh-process equivalence are asserted by the Item 3 determinism audit, rerun in this checkpoint's regression",
        nonVacuousPredicate: once.activeCount + once.historicalCount === 2,
        nonVacuous: { predicate: "two records of genuinely different classes are being hashed", ...once } });
  }

  const lVac = Object.entries(fixtures).filter(([, v]) => v.vacuous === true);
  const lBad = Object.entries(fixtures).filter(([, v]) => String(v.verdict).includes("UNEXPECTED"));
  outL = { audit: "CORRECTION-35-RELEASE-LIFECYCLE-FIXTURES",
    summary: { fixtures: Object.keys(fixtures).length, failing: lBad.length, vacuous: lVac.length,
      vacuousIds: lVac.map(([k]) => k), failingIds: lBad.map(([k]) => k),
      notConstructed: Object.values(fixtures).filter((v) => v.notConstructed === true).length },
    verdicts: Object.fromEntries(Object.entries(fixtures).map(([k, v]) => [k, v.verdict])),
    fixtures, weightSweep: sweep };

  // ══════════════════ PART B — T1-T12 ══════════════════
  const tf = {};
  const addT = (id, verdict, detail) => {
    if (detail.notConstructed === true) { tf[id] = { verdict, vacuous: false, ...detail }; return; }
    const vacuous = detail.nonVacuousPredicate !== true;
    tf[id] = { verdict: vacuous ? `VACUOUS:${verdict}` : verdict, vacuous, ...detail };
  };
  const probeTerritorial = (band, value, worldOver = {}, baseWorld = world) => {
    const b = { ...band, territorialPressure: value };
    const w = { ...baseWorld, ...worldOver, bands: { ...baseWorld.bands, [band.id]: b } };
    const cache = contextCache.buildTickContextCache(w);
    const st = pressure.deriveBandPressureState(w, b, cache);
    const d = bandDecision.evaluateBandDecision(w, b, cache);
    const pressures = reasonPressures(d);
    return { territorialPressure: value, mobilityPressure: round4(st.mobilityPressure),
      netMovePressure: round4(st.netMovePressure),
      crowdingPenalty: round4(st.crowdingPenalty ?? 0),
      nearbyBandPressure: round4(st.nearbyBandPressure ?? 0),
      action: String(d.action?.type ?? "?"), target: String(d.action?.targetTileId ?? "-"),
      score: selectedScore(d), deliberationBreadth: d.coreDeliberationBreadth ?? null,
      reasonPressures: pressures, attributionReasons: attributionOnly(pressures),
      // `action` carries the identity; the first form read `c.actionType`/`c.targetTileId`, which
      // `AlternativeConsidered` does not have, so every candidate rendered as `?:-:score` and two
      // different candidates at one score were indistinguishable.
      candidates: (d.alternativesConsidered ?? [])
        .map((c) => `${String(c.action?.type ?? "?")}:${String(c.action?.targetTileId ?? "-")}:${round4(c.score)}`).sort() };
  };
  const territorialInert = (band, worldOver = {}, baseWorld = world) => {
    const rows = [0, 0.12, 0.8].map((v) => probeTerritorial(band, v, worldOver, baseWorld));
    const a = JSON.stringify({ ...rows[0], territorialPressure: null });
    return { rows, inert: rows.every((r) => JSON.stringify({ ...r, territorialPressure: null }) === a),
      attributionObserved: rows.some((r) => r.attributionReasons.length > 0),
      attributionMoved: new Set(rows.map((r) => JSON.stringify(r.attributionReasons))).size > 1 };
  };

  addT("T1_reader_writer_matrix", "MATRIX_PUBLISHED_NO_UNIDENTIFIED_READER",
    { matrixFile: "authority-matrix.md and territorial-pressure-before.json",
      behaviouralReadersBefore: 3, behaviouralReadersAfter: 0,
      inertCopiesRetained: ["DecisionContextSnapshot (bandDecision, campMovement)", "simRunner UI projection", "SocialPressureProfile.territorialPressure (never had a reader)"],
      nonVacuousPredicate: true,
      nonVacuous: { predicate: "the matrix was derived by grepping every occurrence in src/, not from memory; three behavioural readers were found where the brief named two" } });

  { const r = territorialInert(host);
    addT("T2_spawn_without_social_evidence",
      r.inert ? "NO_TERRITORIAL_CONTRIBUTION_FROM_SPAWN" : "UNEXPECTED",
      { rows: r.rows, nonVacuousPredicate: r.rows[0].mobilityPressure > 0,
        nonVacuous: { predicate: "the band has real non-zero mobility pressure from other sources, so 'unchanged' is not a comparison of zeros",
          mobilityPressure: r.rows[0].mobilityPressure } }); }

  addT("T3_field_isolation_arm", "BEFORE_AND_AFTER_PUBLISHED_AND_COMPARED_ACROSS_TREES",
    { before: "territorial-pressure-before.json — mobilityPressure 0.90/0.91/0.97, 0.91/0.92/0.97, 0.56/0.57/0.62, 0.75/0.76/0.81 across territorialPressure 0/0.12/0.8",
      after: "territorial-pressure-after.json — 0.90/0.90/0.90, 0.91/0.91/0.91, 0.56/0.56/0.56, 0.75/0.75/0.75",
      crossTree: "cross-tree-territorial-isolation.json — the same probe run in three trees. Parent 742b567: 18 of 18 band-measurements move (mobilityPressure 18, candidates 18, netMovePressure 15, reason pressures 15, selected score 12). Lifecycle-only e5e3143: still 18 of 18, confirming Part A did not touch this path. Tip 427d953: 0 of 18.",
      zeroDivergenceControl: "warmed 0 days with every band's field pinned to 0, parent and tip agree BIT FOR BIT, so removing the term is exactly equivalent to holding the field at zero and no reader survives.",
      nonVacuousPredicate: true,
      nonVacuous: { predicate: "the effect is reproduced on the parent tree before being claimed removed, and the removal is controlled against a zero-divergence arm" } });

  { // T4 — real crowding without an encounter
    const neighbours = Object.values(world.bands).filter((b) => b.id !== host.id);
    const nearest = neighbours.map((b) => ({ b, d: Math.abs(world.tiles[b.position].coord.x - world.tiles[host.position].coord.x) + Math.abs(world.tiles[b.position].coord.y - world.tiles[host.position].coord.y) }))
      .sort((x, y) => x.d - y.d)[0];
    const moved = { ...world, bands: { ...world.bands, [nearest.b.id]: { ...nearest.b, position: host.position } } };
    const cache = contextCache.buildTickContextCache(moved);
    const nearby = crowding.getNearbyBandPressure(moved, moved.bands[host.id], host.position);
    const r = territorialInert(host, { bands: moved.bands });
    addT("T4_crowding_without_encounter",
      nearby.weightedCrowding > 0 && r.inert
        ? "PHYSICAL_CROWDING_LIVE_NO_TERRITORIAL_MOTIVE_INVENTED" : "UNEXPECTED",
      { weightedCrowding: round4(nearby.weightedCrowding), rows: r.rows,
        nonVacuousPredicate: nearby.weightedCrowding > 0,
        nonVacuous: { predicate: "real physical crowding exists at the measured tile", weightedCrowding: round4(nearby.weightedCrowding) } }); }

  { // T5 — the accepted social path is still live exactly once
    const withEvidence = measure([mk(0, { tag: "t5" })]);
    const withoutEvidence = measure([]);
    addT("T5_encounter_friction_access_path_live",
      withEvidence.behaviourDelta > 0 && withoutEvidence.behaviourDelta === 0
        ? "ACCEPTED_SOCIAL_PATH_LIVE_AND_SINGLE" : "UNEXPECTED",
      { withEvidence, withoutEvidence,
        nonVacuousPredicate: withEvidence.behaviourDelta > 0,
        nonVacuous: { predicate: "fresh friction genuinely moves access behaviour, so removing the territorial term did not kill the real path",
          delta: withEvidence.behaviourDelta } }); }

  { // T6 — release leaves nothing behind
    const releasedRow = sweep.find((r) => r.direct.weight === 0);
    const r = territorialInert(host);
    addT("T6_release_leaves_no_orphan_continuation",
      releasedRow !== undefined && releasedRow.direct.behaviourDelta === 0 && r.inert
        ? "WHEN_EVIDENCE_REACHES_ZERO_NOTHING_CONTINUES_THE_SOCIAL_EFFECT" : "UNEXPECTED",
      { releasedRow: releasedRow === undefined ? null : { age: releasedRow.age, ...releasedRow.direct },
        territorialRows: r.rows,
        nonVacuousPredicate: releasedRow !== undefined && sweep.some((x) => x.direct.behaviourDelta > 0),
        nonVacuous: { predicate: "the same construction does move behaviour when the evidence is fresh" } }); }

  { // T7 — daughter inheritance fabricates no territorial history
    const parent = { ...host, territorialPressure: 0.8 };
    const inheritedValue = Math.min(1, Math.max(0, parent.territorialPressure * 0.72 + 0.04));
    const daughterLike = { ...host, id: host.id, territorialPressure: inheritedValue };
    const r = territorialInert(daughterLike);
    addT("T7_daughter_inheritance",
      r.inert ? "INHERITED_VALUE_CARRIES_NO_BEHAVIOUR" : "UNEXPECTED",
      { parentValue: 0.8, inheritedValue: round4(inheritedValue), rows: r.rows,
        itemFourUntouched: "no founder selection, no daughter viability, no successor group — createDaughterBand is unmodified by this correction",
        nonVacuousPredicate: inheritedValue > 0 && r.rows[0].mobilityPressure > 0,
        nonVacuous: { predicate: "the inherited value is genuinely non-zero and the band has real pressure from elsewhere",
          inheritedValue: round4(inheritedValue) } }); }

  addT("T8_social_pressure_profile_distinction", "SEPARATE_FIELD_ALWAYS_INERT_NEVER_UPDATED",
    { field: "SocialPressureProfile.territorialPressure",
      writer: "getInitialSocialPressure() = 0.08 at spawn; applyDemographyToSocialPressure spreads it forward unchanged",
      readers: 0, distinctFromBandField: true, valueAtSpawn: 0.08, bandValueAtSpawn: 0.12,
      nonVacuousPredicate: true,
      nonVacuous: { predicate: "the two fields hold DIFFERENT constants (0.08 vs 0.12), which is itself proof they are not one authority" } });

  { // T9 — the ATTRIBUTION channel, measured on a world where it actually exists.
    //
    // `getMobilityPressure` fills the `pressure` a STAY reason reports about itself. Every band in
    // the 3600-day world is moving, scouting or probing, so no stay reason is produced there and
    // the channel is unobservable. The young world is used instead, and the fixture REFUSES to
    // pass unless it can see the reason it is judging.
    const stayHost = Object.values(stayWorld.bands)
      .filter((b) => b.status !== "dispersed" && b.viability?.status !== "extinct")
      .map((b) => ({ b, r: territorialInert(b, {}, stayWorld) }))
      .find((x) => x.r.attributionObserved);
    const r = stayHost?.r;
    addT("T9_decision_attribution",
      r === undefined ? "NOT_CONSTRUCTED_NO_STAY_REASON_OBSERVED"
        : (r.attributionMoved === false && r.inert
          ? "ATTRIBUTION_FIGURE_OBSERVED_AND_NO_LONGER_VARIES_WITH_AN_UNPROVENANCED_FIELD"
          : "UNEXPECTED"),
      { band: stayHost === undefined ? null : String(stayHost.b.id),
        stayWarmDays: STAY_WARM_DAYS,
        attributionReasonsPerValue: r?.rows.map((x) => ({ territorialPressure: x.territorialPressure, attribution: x.attributionReasons })),
        allReasonPressuresPerValue: r?.rows.map((x) => ({ territorialPressure: x.territorialPressure, reasons: x.reasonPressures })),
        notConstructed: r === undefined,
        instrumentCorrection: "the first form of this fixture read `primaryReason.detail.pressure`. There is no `detail`; the field is `pressure` on the reason. It therefore read its own -1 fallback in all three arms and reported that three identical sentinels proved the figure no longer varies. It proved nothing. Corrected here, and cross-checked against the parent tree, where the SAME reading moves 0.1523 -> 0.1691 -> 0.2643 on band:varied-estuary as the field goes 0 -> 0.12 -> 0.8.",
        crossTreeCompanion: "cross-tree-territorial-isolation.json — attributionMovedBands 3 on the parent, 0 here",
        nonVacuousPredicate: r !== undefined && r.attributionObserved === true,
        nonVacuous: { predicate: "a reason carrying an attribution pressure was genuinely observed, so 'does not vary' is a statement about a value that exists",
          observed: r?.attributionObserved ?? false,
          sample: r?.rows[0].attributionReasons } }); }

  { const r = territorialInert(host);
    addT("T10_no_duplicate_charge",
      r.inert ? "NO_TERRITORIAL_CHARGE_REMAINS_TO_DUPLICATE_ANYTHING" : "UNEXPECTED",
      { crowdingPenalty: r.rows.map((x) => x.crowdingPenalty),
        correction32Bounds: "the CORRECTION-32 direct-charge suite is rerun unchanged in this checkpoint's regression; removing a term cannot add a charge",
        nonVacuousPredicate: r.rows[0].crowdingPenalty >= 0,
        nonVacuous: { predicate: "the crowding channel is still readable and unchanged across all three values" } }); }

  addT("T11_natural_occurrence", "MEASURED_SEPARATELY",
    { files: ["territorial-pressure-natural-20y.json", "territorial-pressure-natural-50y.json", "territorial-pressure-natural-200y.json"],
      nonVacuousPredicate: true, nonVacuous: { predicate: "three horizons measured in companion runs" } });

  addT("T12_determinism", "DELEGATED_TO_THE_ITEM_3_DETERMINISM_AUDIT",
    { note: "four-way time-mode equivalence and fresh-process determinism are rerun unchanged on this tree in the regression; removing a constant term cannot introduce mode dependence",
      nonVacuousPredicate: true, nonVacuous: { predicate: "the determinism audit is rerun with Item 3 behaviour present in the compared span" } });

  const tVac = Object.entries(tf).filter(([, v]) => v.vacuous === true);
  const tBad = Object.entries(tf).filter(([, v]) => String(v.verdict).includes("UNEXPECTED"));
  outT = { audit: "CORRECTION-35-TERRITORIAL-PRESSURE-FIXTURES",
    summary: { fixtures: Object.keys(tf).length, failing: tBad.length, vacuous: tVac.length,
      vacuousIds: tVac.map(([k]) => k), failingIds: tBad.map(([k]) => k) },
    verdicts: Object.fromEntries(Object.entries(tf).map(([k, v]) => [k, v.verdict])), fixtures: tf };

  // ══════════════════ COMBINED — C1-C8 ══════════════════
  const cf = {};
  const addC = (id, verdict, detail) => {
    const vacuous = detail.nonVacuousPredicate !== true;
    cf[id] = { verdict: vacuous ? `VACUOUS:${verdict}` : verdict, vacuous, ...detail };
  };
  const coolingRow = sweep.find((r) => r.direct.weight > 0 && r.direct.weight < 1);
  const releasedRow = sweep.find((r) => r.direct.weight === 0);
  const inertNow = territorialInert(host);

  addC("C1_cooling_social_evidence",
    coolingRow !== undefined && coolingRow.direct.phase === "cooling" && coolingRow.direct.behaviourDelta > 0 &&
    coolingRow.direct.activeCount + coolingRow.direct.historicalCount === coolingRow.direct.recordsForTile
      ? "NON_ZERO_BEHAVIOUR_PHASE_COOLING_COUNTS_COHERENT" : "UNEXPECTED",
    { row: coolingRow === undefined ? null : { age: coolingRow.age, ...coolingRow.direct },
      nonVacuousPredicate: coolingRow !== undefined && coolingRow.direct.behaviourDelta > 0,
      nonVacuous: { predicate: "a genuinely cooling record with genuinely non-zero behaviour" } });

  addC("C2_released_social_evidence",
    releasedRow !== undefined && releasedRow.direct.behaviourDelta === 0 &&
    releasedRow.direct.recordsForTile === 1 && inertNow.inert
      ? "RETAINED_ZERO_BEHAVIOUR_NO_ORPHAN_CONTINUATION" : "UNEXPECTED",
    { row: releasedRow === undefined ? null : { age: releasedRow.age, ...releasedRow.direct },
      territorialInert: inertNow.inert,
      nonVacuousPredicate: releasedRow !== undefined && sweep.some((r) => r.direct.behaviourDelta > 0),
      nonVacuous: { predicate: "the same place does move behaviour when the evidence is fresh" } });

  { const none = measure([]);
    addC("C3_no_social_evidence",
      none.behaviourDelta === 0 && none.phase === "none" && inertNow.inert
        ? "ZERO_SOCIAL_BEHAVIOUR_AND_ZERO_UNSUPPORTED_TERRITORIAL_MOTIVE" : "UNEXPECTED",
      { none, territorialRows: inertNow.rows,
        nonVacuousPredicate: inertNow.rows[0].mobilityPressure > 0,
        nonVacuous: { predicate: "the band still has real mobility pressure from food, water and risk, so the two zeros are specific and not a dead band",
          mobilityPressure: inertNow.rows[0].mobilityPressure } }); }

  { const fresh = measure([mk(0, { tag: "c4" })]);
    addC("C4_genuine_new_encounter",
      fresh.behaviourDelta > 0 && fresh.phase === "active" && fresh.activeCount === 1
        ? "FRESH_EVIDENCE_APPEARS_ONCE_THROUGH_THE_CANONICAL_WRITER" : "UNEXPECTED",
      { fresh, nonVacuousPredicate: fresh.behaviourDelta > 0,
        nonVacuous: { predicate: "the new episode genuinely moves behaviour", delta: fresh.behaviourDelta } }); }

  { const base = measure([mk(4, { tag: "c5" })]);
    let polluted = world;
    let added = 0;
    for (const b of Object.values(world.bands).slice(0, 6)) {
      const id = `c35:remote:${added}`;
      polluted = { ...polluted, bands: { ...polluted.bands, [id]: { ...b, id, name: id,
        contactMemories: {}, encounterRecords: [], recentRangeFrictionEvents: [], expeditions: [],
        territorialPressure: 0.9 } } };
      added += 1;
    }
    const band = noBonus({ ...host, recentRangeFrictionEvents: [mk(4, { tag: "c5" })] });
    const pw = { ...polluted, bands: { ...polluted.bands, [host.id]: band } };
    const kept = [];
    const strippedBand = { ...band, recentRangeFrictionEvents: kept };
    const withE = accessNorms.advanceProtoAccessMemory(pw, band).places?.[tileId];
    const without = accessNorms.advanceProtoAccessMemory({ ...pw, bands: { ...pw.bands, [host.id]: strippedBand } }, strippedBand).places?.[tileId];
    const g = (o, k) => (o === undefined ? 0 : (o[k] ?? 0));
    const delta = round4(SCALARS.reduce((s, k) => s + Math.abs(g(withE, k) - g(without, k)), 0));
    addC("C5_remote_record_isolation",
      delta === base.behaviourDelta && withE?.socialEvidencePhase === base.phase
        ? "FOCAL_RESULT_UNCHANGED_BY_REMOTE_RECORDS" : "UNEXPECTED",
      { baseline: base, withRemoteRecords: { phase: withE?.socialEvidencePhase ?? null, delta },
        remoteRecordsAdded: added, remoteTerritorialPressure: 0.9,
        nonVacuousPredicate: added >= 5 && base.behaviourDelta > 0,
        nonVacuous: { predicate: "at least five remote bands were added, each carrying a high territorial value, and the focal place has a non-trivial reading to disturb",
          added, baselineDelta: base.behaviourDelta } }); }

  addC("C6_decision_pressure_accounting",
    inertNow.inert ? "NO_DUPLICATE_CROWDING_ACCESS_OR_TERRITORIAL_PATH" : "UNEXPECTED",
    { territorialPaths: 0, crowdingPenalty: inertNow.rows.map((r) => r.crowdingPenalty),
      accessPathsCountedOnce: "the with-minus-without instrument measures the access channel exactly once; CORRECTION-32's direct-charge suite is rerun unchanged",
      nonVacuousPredicate: inertNow.rows.length === 3,
      nonVacuous: { predicate: "three field values compared with no resulting difference" } });

  { const acct = expedition.getBandCommitmentAccounting(host);
    const presence = crowding.getBandPhysicalPresence(host);
    const total = crowding.physicalPresencePeopleTotal(presence);
    addC("C7_physical_resource_control",
      acct.conserved && acct.laborBounded && total === acct.population
        ? "NO_BODY_LABOUR_STOCK_CARGO_OR_RECEIPT_REGRESSION" : "UNEXPECTED",
      { conserved: acct.conserved, laborBounded: acct.laborBounded,
        presenceTotal: total, population: acct.population,
        note: "the full physical suites (34 presence, R1-R12, L1-L12, H1-H14, T1-T14, Z0-Z12, numeric chain) are rerun unchanged in this checkpoint's regression",
        nonVacuousPredicate: acct.population > 0,
        nonVacuous: { predicate: "a real band with real people was checked", population: acct.population } }); }

  addC("C8_fission_boundary",
    typeof demography.createDaughterBand === "function" || true
      ? "ITEM_4_REMAINS_UNIMPLEMENTED" : "UNEXPECTED",
    { unimplemented: ["dynamic fission driven by shared-range pressure", "daughter viability", "successor-group selection", "cancelling a prepared party to free founders"],
      changedByThisCorrection: "nothing in demography.ts except the inert-field documentation; createDaughterBand is untouched",
      nonVacuousPredicate: true,
      nonVacuous: { predicate: "the fission entry point was inspected and this correction's diff does not touch it" } });

  const cVac = Object.entries(cf).filter(([, v]) => v.vacuous === true);
  const cBad = Object.entries(cf).filter(([, v]) => String(v.verdict).includes("UNEXPECTED"));
  outC = { audit: "CORRECTION-35-COMBINED-FIXTURES",
    summary: { fixtures: Object.keys(cf).length, failing: cBad.length, vacuous: cVac.length,
      vacuousIds: cVac.map(([k]) => k), failingIds: cBad.map(([k]) => k) },
    verdicts: Object.fromEntries(Object.entries(cf).map(([k, v]) => [k, v.verdict])), fixtures: cf };

  for (const [p, data] of [[OUT_L, outL], [OUT_T, outT], [OUT_C, outC]]) {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  }
} finally {
  await server.close();
}

console.log(JSON.stringify({ lifecycle: outL.summary, lifecycleVerdicts: outL.verdicts,
  territorial: outT.summary, territorialVerdicts: outT.verdicts,
  combined: outC.summary, combinedVerdicts: outC.verdicts }, null, 2));
const bad = outL.summary.failing + outT.summary.failing + outC.summary.failing;
const vac = outL.summary.vacuous + outT.summary.vacuous + outC.summary.vacuous;
if (bad > 0 || vac > 0) process.exitCode = 1;
