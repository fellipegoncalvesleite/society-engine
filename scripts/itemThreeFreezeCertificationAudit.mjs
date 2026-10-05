// ROADMAP ITEM 3 — FINAL FREEZE CERTIFICATION.
//
// The previous final-integration audit proved the Item 3 chain and ended PROGRESS on two blockers.
// CORRECTION-35 claims both are closed. This re-certifies the claims themselves on the ACCEPTED
// production tree, from production's own readers, rather than trusting the correction's report.
//
// It is deliberately structured as a list of NAMED CLAIMS, each with its own non-vacuity predicate.
// A claim that cannot be exercised is reported NOT_CONSTRUCTED, never as a pass.
//
// AUDIT ONLY. Nothing here writes to a world that production keeps.
import { createServer } from "vite";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const OUT = arg("out", "artifacts/c36/freeze-certification.json");
const SEED = arg("seed", "audit27:natural:s1");
const WARM = Number(arg("warm-days", "3600"));
const STAY_WARM = Number(arg("stay-warm-days", "180"));

// Production's own constants, replicated so the audit filters exactly as production does.
const ACTIVE_MIN_WEIGHT = 0.05;
const FRICTION_RECENT_WINDOW_TICKS = 48;
const FRICTION_EVIDENCE_CAP = 6;
// Every ProtoAccessMemory scalar that carries social behaviour. The original Item 3 probe read
// three of these and under-reported its own incident by half; all six are read here.
const SCALARS = ["strangerCaution", "sharedUsePressure", "rememberedRefusalAvoidance",
  "rememberedCooperationTolerance", "kinTolerance", "familiarTolerance"];

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c36cert-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const accessNorms = await server.ssrLoadModule("/sim/agents/accessNorms.ts");
  const pressure = await server.ssrLoadModule("/sim/agents/pressure.ts");
  const bandDecision = await server.ssrLoadModule("/sim/rules/bandDecision.ts");
  const contextCache = await server.ssrLoadModule("/sim/agents/contextCache.ts");
  const crowding = await server.ssrLoadModule("/sim/agents/crowding.ts");

  const r4 = (v) => (typeof v === "number" ? Math.round(v * 10000) / 10000 : v);

  const claims = {};
  const claim = (id, verdict, detail) => {
    if (detail.notConstructed === true) { claims[id] = { verdict, vacuous: false, ...detail }; return; }
    const vacuous = detail.nonVacuousPredicate !== true;
    claims[id] = { verdict: vacuous ? `VACUOUS:${verdict}` : verdict, vacuous, ...detail };
  };

  let world = runner.initSimWorld({ kind: "map2" }, SEED);
  world = advance.advanceWorldByDays(world, WARM);
  const nowTick = Number(world.time.tick);
  const living = Object.values(world.bands)
    .filter((b) => b.status !== "dispersed" && b.viability?.status !== "extinct")
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const host = living[0];
  const tileId = host.position;

  // A real production friction record is used as the template. Nothing about an episode is invented.
  let template = null;
  for (const band of Object.values(world.bands)) {
    const e = (band.recentRangeFrictionEvents ?? [])[0];
    if (e !== undefined) { template = e; break; }
  }
  if (template === null) throw new Error("no real friction record to template from — refusing to invent one");

  const noBonus = (band) => ({ ...band, pressureState: { ...(band.pressureState ?? {}), nearbyBandPressure: 0.01 } });
  const reportsFor = (hops) => ({ reports: [{ reportId: "c36:report", hops, freshness: 1 }] });
  const mk = (ageTicks, over = {}) => ({
    ...template, eventId: `c36:${ageTicks}:${over.tag ?? ""}`,
    tick: nowTick - ageTicks, tileId,
    relation: "stranger_or_unrecognized", interpretation: "repeated_outsider_use",
    tensionLevel: "watchful", confidence: "observed", linkedReportId: undefined, ...over,
  });
  const reported = (ageTicks, tag) => mk(ageTicks, {
    confidence: "reported_secondhand", linkedReportId: "c36:report", tensionLevel: "mild", tag });

  // With-minus-without at the tile the records name: the canonical Item 3 instrument.
  const measure = (events, bandOver = {}) => {
    const band = noBonus({ ...host, recentRangeFrictionEvents: events, ...bandOver });
    const w = { ...world, bands: { ...world.bands, [host.id]: band } };
    const kept = events.filter((e) => String(e.tileId) !== String(tileId));
    const strippedBand = { ...band, recentRangeFrictionEvents: kept };
    const withE = accessNorms.advanceProtoAccessMemory(w, band).places?.[tileId];
    const without = accessNorms
      .advanceProtoAccessMemory({ ...w, bands: { ...w.bands, [host.id]: strippedBand } }, strippedBand)
      .places?.[tileId];
    const g = (o, k) => (o === undefined ? 0 : (o[k] ?? 0));
    const deltas = Object.fromEntries(SCALARS.map((k) => [k, r4(g(withE, k) - g(without, k))]));
    const inWindow = events.filter((e) => String(e.tileId) === String(tileId)
      && nowTick - Number(e.tick) <= FRICTION_RECENT_WINDOW_TICKS).length;
    return {
      phase: withE?.socialEvidencePhase ?? null,
      activeCount: withE?.activeEvidenceCount ?? null,
      historicalCount: withE?.historicalEvidenceCount ?? null,
      weight: withE?.activeEvidenceWeight ?? null,
      confidence: r4(withE?.confidence ?? 0),
      representedRecords: Math.min(FRICTION_EVIDENCE_CAP, inWindow),
      deltas,
      behaviourDelta: r4(Object.values(deltas).reduce((s, v) => s + Math.abs(v), 0)),
    };
  };

  // ══════════════════ A — RELEASE LIFECYCLE ══════════════════
  const sweep = [];
  for (let age = 0; age <= 24; age += 1) {
    sweep.push({ age, direct: measure([mk(age)]),
      reported: measure([reported(age, "s")], { reportedKnowledge: reportsFor(2) }) });
  }

  { const row = sweep.find((r) => r.direct.weight === 1);
    claim("A1_active_means_full_strength",
      row !== undefined && row.direct.phase === "active" && row.direct.behaviourDelta > 0
        ? "ACTIVE_IS_FULL_STRENGTH_CURRENT_EVIDENCE" : "UNEXPECTED",
      { row: row && { age: row.age, ...row.direct },
        nonVacuousPredicate: row !== undefined && row.direct.behaviourDelta > 0,
        nonVacuous: { predicate: "a full-weight record exists and moves behaviour" } }); }

  { const rows = sweep.filter((r) => r.direct.weight > 0 && r.direct.weight < 1)
      .concat(sweep.filter((r) => r.reported.weight > 0 && r.reported.weight < 1).map((r) => ({ ...r, direct: r.reported })));
    const ok = rows.length > 0 && rows.every((r) => r.direct.phase === "cooling" && r.direct.behaviourDelta > 0);
    claim("A2_cooling_means_non_zero_contribution",
      ok ? "EVERY_COOLING_ROW_STILL_MOVES_BEHAVIOUR" : "UNEXPECTED",
      { rowsChecked: rows.length,
        sample: rows.slice(0, 4).map((r) => ({ age: r.age, weight: r.direct.weight, phase: r.direct.phase, delta: r.direct.behaviourDelta })),
        nonVacuousPredicate: rows.length > 0,
        nonVacuous: { predicate: "at least one genuinely cooling row exists", rows: rows.length } }); }

  { const rows = sweep.filter((r) => r.direct.weight === 0);
    const ok = rows.length > 0 && rows.every((r) => r.direct.phase === "released_historical"
      && r.direct.behaviourDelta === 0 && r.direct.activeCount === 0 && r.direct.historicalCount === 1);
    claim("A3_released_means_retained_with_exactly_zero_contribution",
      ok ? "RELEASED_IS_RETAINED_AND_EXACTLY_INERT" : "UNEXPECTED",
      { rowsChecked: rows.length, sample: rows.slice(0, 3).map((r) => ({ age: r.age, ...r.direct })),
        nonVacuousPredicate: rows.length > 0 && sweep.some((r) => r.direct.behaviourDelta > 0),
        nonVacuous: { predicate: "zero-weight rows exist AND the same construction moves behaviour when fresh, so inertness is a measured drop rather than an empty patch" } }); }

  { // The counts must partition the evidence production actually represents.
    const mixed = measure([mk(0, { tag: "a" }), mk(6, { tag: "b" }), mk(20, { tag: "c" })]);
    const ok = mixed.activeCount + mixed.historicalCount === mixed.representedRecords;
    claim("A4_counts_sum_to_represented_retained_evidence",
      ok ? "COUNTS_PARTITION_THE_REPRESENTED_EVIDENCE" : "UNEXPECTED",
      { result: mixed,
        note: "represented = this tile's records inside FRICTION_RECENT_WINDOW_TICKS=48, capped at 6, which is exactly what collectTileFrictionEvidence keeps",
        nonVacuousPredicate: mixed.representedRecords === 3 && mixed.activeCount >= 1 && mixed.historicalCount >= 1,
        nonVacuous: { predicate: "three represented records genuinely split into a live part and a released part" } }); }

  { // THE SEPARATION PART A INTRODUCED. A record between 0 and 0.05 must COUNT as active while
    // contributing NOTHING to confidence — that is the whole point of keeping two filters.
    const sub = sweep.find((r) => r.reported.weight > 0 && r.reported.weight < ACTIVE_MIN_WEIGHT);
    const none = measure([], { reportedKnowledge: reportsFor(2) });
    const confidenceUnmoved = sub !== undefined && sub.reported.confidence === none.confidence;
    claim("A5_confidence_keeps_its_distinct_threshold",
      sub === undefined ? "NOT_CONSTRUCTED_NO_SUB_THRESHOLD_ROW"
        : (sub.reported.activeCount === 1 && confidenceUnmoved
          ? "SUB_THRESHOLD_RECORD_COUNTS_AS_ACTIVE_AND_ADDS_NOTHING_TO_CONFIDENCE" : "UNEXPECTED"),
      { subThresholdRow: sub && { age: sub.age, ...sub.reported },
        confidenceWithNoEvidence: none.confidence,
        confidenceWithSubThresholdEvidence: sub?.reported.confidence,
        notConstructed: sub === undefined,
        note: "the 0.05 constant keeps its CORRECTION-31 job — retained records must not prop up the confidence that has to fall before staleness retires the memory. The lifecycle labels no longer borrow it.",
        nonVacuousPredicate: sub !== undefined && sub.reported.behaviourDelta > 0,
        nonVacuous: { predicate: "the record genuinely moves behaviour while contributing nothing to confidence, which is the separation being certified" } }); }

  { // The Item 3 incident's EVIDENCE SHAPE. The band itself cannot be reached on this tree — Part B
    // changed the 200-year trajectory — so the shape is reconstructed and the natural arm carries
    // the seed-level confirmation.
    const sub = sweep.find((r) => r.reported.weight === 0.04);
    claim("A6_day_44640_incident_shape_is_cooling",
      sub === undefined ? "NOT_CONSTRUCTED_NO_0_04_ROW"
        : (sub.reported.phase === "cooling" && sub.reported.activeCount === 1
          && sub.reported.historicalCount === 0 ? "INCIDENT_SHAPE_IS_COOLING_NOT_RELEASED" : "UNEXPECTED"),
      { row: sub && { age: sub.age, ...sub.reported },
        underTheParentRule: "released_historical, activeEvidenceCount 0, historicalEvidenceCount 1",
        behaviourUnchanged: "the six-scalar delta is the SAME quantity in both trees; only the label moved. Cross-tree proof: cross-tree-release-preservation.json",
        notConstructed: sub === undefined,
        nonVacuousPredicate: sub !== undefined && sub.reported.behaviourDelta > 0,
        nonVacuous: { predicate: "a record at exactly the incident's weight exists and still moves behaviour" } }); }

  { const released = sweep.find((r) => r.direct.weight === 0);
    claim("A7_zero_weight_records_remain_inspectable",
      released !== undefined && released.direct.representedRecords === 1 && released.direct.historicalCount === 1
        ? "RETAINED_AND_COUNTED_AS_HISTORY" : "UNEXPECTED",
      { row: released && { age: released.age, ...released.direct },
        nonVacuousPredicate: released !== undefined && released.direct.representedRecords === 1,
        nonVacuous: { predicate: "the record is genuinely still represented while contributing nothing" } }); }

  { const old = mk(20, { tag: "old" });
    const before = measure([old]);
    const after = measure([old, mk(0, { tag: "fresh" })]);
    claim("A8_fresh_reencounter_creates_a_new_event_id",
      before.behaviourDelta === 0 && after.behaviourDelta > 0 && after.activeCount === 1 && after.historicalCount === 1
        ? "A_RELEASED_BELIEF_IS_RE_EARNED_NOT_REVIVED" : "UNEXPECTED",
      { releasedOnly: before, releasedPlusFresh: after,
        eventIds: [old.eventId, mk(0, { tag: "fresh" }).eventId],
        nonVacuousPredicate: before.behaviourDelta === 0 && after.behaviourDelta > 0,
        nonVacuous: { predicate: "the old record alone moves nothing and the pair moves something, so the new episode is what counts" } }); }

  // ══════════════════ B — TERRITORIAL AUTHORITY ══════════════════
  const territorialRows = (band, base, cache) => [0, 0.12, 0.8].map((v) => {
    const b = { ...band, territorialPressure: v };
    const w = { ...base, bands: { ...base.bands, [band.id]: b } };
    const c = contextCache.buildTickContextCache(w);
    const st = pressure.deriveBandPressureState(w, b, c);
    const d = bandDecision.evaluateBandDecision(w, b, c);
    const rp = [];
    const scan = (r, where) => { if (r && typeof r.pressure === "number") rp.push(`${where}:${r.type}=${r4(r.pressure)}`); };
    scan(d.primaryReason, "primary");
    (d.secondaryReasons ?? []).forEach((r, i) => scan(r, `sec${i}`));
    (d.alternativesConsidered ?? []).forEach((a, i) => scan(a.rejectionReason, `alt${i}rej`));
    const want = `${String(d.action?.type)}:${String(d.action?.targetTileId ?? "-")}`;
    const score = (d.alternativesConsidered ?? [])
      .filter((c2) => `${String(c2.action?.type)}:${String(c2.action?.targetTileId ?? "-")}` === want)
      .map((c2) => c2.score).filter((s) => typeof s === "number");
    return { territorialPressure: v,
      mobilityPressure: r4(st.mobilityPressure), netMovePressure: r4(st.netMovePressure),
      action: String(d.action?.type), target: String(d.action?.targetTileId ?? "-"),
      score: score.length ? r4(Math.max(...score)) : null,
      deliberationBreadth: d.coreDeliberationBreadth ?? null,
      candidates: (d.alternativesConsidered ?? [])
        .map((c2) => `${String(c2.action?.type)}:${String(c2.action?.targetTileId ?? "-")}:${r4(c2.score)}`).sort(),
      reasonPressures: rp,
      reasonTypes: [d.primaryReason?.type, ...(d.secondaryReasons ?? []).map((r) => r?.type)].filter(Boolean).sort() };
  });
  const inertness = (rows) => {
    const base = JSON.stringify({ ...rows[0], territorialPressure: null });
    return rows.every((r) => JSON.stringify({ ...r, territorialPressure: null }) === base);
  };

  const cache = contextCache.buildTickContextCache(world);
  const lateRows = living.map((b) => ({ band: String(b.id), rows: territorialRows(b, world, cache) }));
  let stayWorld = runner.initSimWorld({ kind: "map2" }, SEED);
  stayWorld = advance.advanceWorldByDays(stayWorld, STAY_WARM);
  const stayCache = contextCache.buildTickContextCache(stayWorld);
  const earlyRows = Object.values(stayWorld.bands)
    .filter((b) => b.status !== "dispersed" && b.viability?.status !== "extinct")
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map((b) => ({ band: String(b.id), rows: territorialRows(b, stayWorld, stayCache) }));
  const allRows = [...lateRows, ...earlyRows];
  const moved = allRows.filter((r) => !inertness(r.rows));

  claim("B1_territorial_field_has_zero_behavioural_readers",
    moved.length === 0 ? "VARYING_THE_FIELD_CHANGES_NO_CURRENT_BEHAVIOUR" : "UNEXPECTED",
    { bandsMeasured: allRows.length, bandsMoved: moved.length, movedBands: moved.map((r) => r.band),
      valuesCompared: [0, 0.12, 0.8],
      quantitiesCompared: ["mobilityPressure", "netMovePressure", "selected action", "target", "selected score", "deliberationBreadth", "candidate set", "every reason's reported pressure", "reason types"],
      nonVacuousPredicate: allRows.length > 0 && allRows[0].rows[0].mobilityPressure > 0,
      nonVacuous: { predicate: "the bands carry real non-zero mobility pressure from other sources, so 'unchanged' is not a comparison of zeros",
        sampleMobilityPressure: allRows[0].rows[0].mobilityPressure } });

  { // Was any removed coefficient quietly re-homed?
    //
    // INSTRUMENT CORRECTION. The first form of this check asked "does the file mention
    // `band.territorialPressure` outside a comment?" and flagged `bandDecision.ts` — which is a
    // FALSE POSITIVE, because line 5225 is `territorialPressure: band.territorialPressure,`, the
    // inert `DecisionContextSnapshot` record copy that `rules/types.ts:1537` documents as having no
    // reader. A record copy is not a coefficient. The question is whether the field enters an
    // ARITHMETIC or CONDITIONAL expression, so that is what is tested now, and the surviving
    // property-copy sites are enumerated separately and asserted to be exactly the known inert ones.
    const scanned = ["src/sim/agents/pressure.ts", "src/sim/rules/mobilityIntent.ts",
      "src/sim/rules/bandDecision.ts", "src/sim/agents/campMovement.ts",
      "src/sim/runner/simRunner.ts", "src/sim/agents/spawn.ts", "src/sim/agents/demography.ts"];
    const arithmetic = [];
    const propertyCopies = [];
    for (const f of scanned) {
      readFileSync(f, "utf8").split("\n").forEach((line, i) => {
        const t = line.trim();
        if (!t.includes("territorialPressure")) return;
        if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;
        const site = `${f}:${i + 1}`;
        // a pure `name: expr,` property assignment, with no operator applied to the value
        const isCopy = /^territorialPressure:\s*[A-Za-z_$][\w$.?[\]"']*\s*,?$/.test(t)
          || /^readonly territorialPressure:/.test(t);
        // a literal constant initialiser, e.g. `territorialPressure: 0.12,`
        const isConstInit = /^territorialPressure:\s*[\d.]+\s*,?$/.test(t);
        // a derived write, e.g. the daughter's clamp01(parent * 0.72 + 0.04)
        const isDerivedWrite = /^territorialPressure:\s*clamp01\(/.test(t);
        if (isCopy || isConstInit || isDerivedWrite) { propertyCopies.push({ site, kind: isConstInit ? "constant writer" : isDerivedWrite ? "daughter writer" : "record copy or declaration", line: t }); return; }
        arithmetic.push({ site, line: t });
      });
    }
    claim("B2_no_removed_coefficient_was_re_homed",
      arithmetic.length === 0
        ? "THE_FIELD_ENTERS_NO_ARITHMETIC_OR_CONDITIONAL_EXPRESSION_ANYWHERE" : "UNEXPECTED",
      { filesScanned: scanned,
        arithmeticOrConditionalUses: arithmetic,
        survivingSitesAndTheirKinds: propertyCopies,
        removedWeights: { "pressure.ts": 0.08, "mobilityIntent.ts": 0.12, "bandDecision.ts": 0.14 },
        crowdingDecisionCostWeightUntouched: "CROWDING_DECISION_COST_WEIGHT = 0.96, unchanged since CORRECTION-32",
        instrumentCorrection: "the first form of this check tested for any non-comment mention and flagged the inert DecisionContextSnapshot record copy at bandDecision.ts:5225. A false UNEXPECTED is as damaging as a false pass, so the check now distinguishes a property copy from an arithmetic use, and enumerates the surviving sites with their kinds instead of merely counting them.",
        nonVacuousPredicate: propertyCopies.length > 0,
        nonVacuous: { predicate: "the scan genuinely found the field's surviving sites, so 'no arithmetic use' is a statement about a field the scanner can see",
          survivingSites: propertyCopies.length } }); }

  { // Only crowding, friction and access expectation may create current social pressure.
    const noEvidence = measure([]);
    const withFriction = measure([mk(0, { tag: "auth" })]);
    const neighbours = living.filter((b) => b.id !== host.id);
    const nearest = neighbours
      .map((b) => ({ b, d: Math.abs(world.tiles[b.position].coord.x - world.tiles[host.position].coord.x)
        + Math.abs(world.tiles[b.position].coord.y - world.tiles[host.position].coord.y) }))
      .sort((x, y) => x.d - y.d)[0];
    const movedWorld = { ...world, bands: { ...world.bands, [nearest.b.id]: { ...nearest.b, position: host.position } } };
    const nearby = crowding.getNearbyBandPressure(movedWorld, movedWorld.bands[host.id], host.position);
    claim("B3_only_crowding_friction_and_access_create_social_pressure",
      noEvidence.behaviourDelta === 0 && withFriction.behaviourDelta > 0 && nearby.weightedCrowding > 0
        ? "ZERO_EVIDENCE_GIVES_ZERO_SOCIAL_PRESSURE_AND_THE_THREE_REAL_AUTHORITIES_REMAIN_LIVE" : "UNEXPECTED",
      { withNoSocialEvidence: noEvidence, withFreshFriction: withFriction,
        physicalCrowdingWhenANeighbourStandsHere: r4(nearby.weightedCrowding),
        nonVacuousPredicate: withFriction.behaviourDelta > 0 && nearby.weightedCrowding > 0,
        nonVacuous: { predicate: "both surviving authorities genuinely fire, so the zero for the removed one is specific" } }); }

  { // No decision explanation may report the legacy term.
    const types = new Set(allRows.flatMap((r) => r.rows.flatMap((x) => x.reasonTypes)));
    const territorialReasonEmitted = [...types].some((t) => String(t).includes("territor"));
    const pressuresVary = allRows.some((r) => new Set(r.rows.map((x) => JSON.stringify(x.reasonPressures))).size > 1);
    claim("B4_no_decision_explanation_reports_the_legacy_term",
      !territorialReasonEmitted && !pressuresVary
        ? "NO_REASON_NAMES_TERRITORY_AND_NO_REPORTED_PRESSURE_VARIES_WITH_THE_FIELD" : "UNEXPECTED",
      { distinctReasonTypesObserved: [...types].sort(),
        territorialReasonEmitted, anyReportedPressureVariesWithTheField: pressuresVary,
        vocabularyNote: "rules/types.ts:1291 declares a `territorial_pressure` reason type. It has ZERO producers anywhere in src/ — grep finds only the declaration. A THIRD inert territorial name, recorded so a future system cannot wire it up without a lived writer.",
        nonVacuousPredicate: types.size > 3,
        nonVacuous: { predicate: "a genuinely varied set of reason types was observed", distinct: types.size } }); }

  const failing = Object.entries(claims).filter(([, v]) => String(v.verdict).includes("UNEXPECTED"));
  const vacuous = Object.entries(claims).filter(([, v]) => v.vacuous === true);
  const notConstructed = Object.entries(claims).filter(([, v]) => v.notConstructed === true);

  out = {
    audit: "ITEM-3-FINAL-FREEZE-CERTIFICATION",
    tree: "706166892d40189fc56ac7458b9e90a8ffdbddd7",
    seed: SEED, warmDays: WARM, stayWarmDays: STAY_WARM,
    summary: {
      claims: Object.keys(claims).length,
      failing: failing.length, failingIds: failing.map(([k]) => k),
      // Reported SEPARATELY and never folded into one another.
      vacuous: vacuous.length, vacuousIds: vacuous.map(([k]) => k),
      notConstructed: notConstructed.length, notConstructedIds: notConstructed.map(([k]) => k),
    },
    verdicts: Object.fromEntries(Object.entries(claims).map(([k, v]) => [k, v.verdict])),
    claims, weightSweep: sweep,
    territorialArm: { bandsMeasured: allRows.length, rows: allRows },
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
} finally {
  await server.close();
}

console.log(JSON.stringify({ summary: out.summary, verdicts: out.verdicts }, null, 2));
if (out.summary.failing > 0 || out.summary.vacuous > 0) process.exitCode = 1;
