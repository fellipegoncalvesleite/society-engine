// ROADMAP ITEM 4 §11 — controlled gates D1-D18 for the atomic departure seam.
//
// Non-vacuity is ASSERTED per gate. The harness relabels a gate VACUOUS and fails the run when its
// predicate is false.
//
// SCOPE LIMIT, STATED UP FRONT: the seam is NOT reachable from ordinary fission. These gates drive
// the production writer directly, which is what the brief authorises. They prove the departure
// TRANSITION is truthful. They prove nothing about travel, return or stabilization, none of which
// exist, and nothing about natural occurrence.
import { createServer } from "vite";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/dynamic-fission-daughter-viability-37";
const OUT = arg("out", `${EVIDENCE}/departure-seam-fixtures.json`);
const OUT_ORDER = arg("out-ordering", `${EVIDENCE}/departure-ordering.json`);

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-i4dep-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
let ordering;
try {
  const seam = await server.ssrLoadModule("/sim/agents/fissionDepartureSeam.ts");
  const lc = await server.ssrLoadModule("/sim/agents/bandLifecycle.ts");
  const survival = await server.ssrLoadModule("/sim/agents/seasonalSurvival.ts");

  /** A parent carrying an attempt at departure_ready, plus everything the boundary reads. */
  /**
   * A support state produced the way production produces one: a sample handed to the single writer,
   * which derives the windows, the streaks and the classification. `foodStress: 0.7` matches the
   * `hungerPressure: 0.7` these fixtures give the parent, so the camp is hungry AND measured — which
   * is the only combination a real band can be in.
   */
  const makeMeasuredSupport = (bandId) => survival.recordSupportInterval(
    undefined,
    {
      tick: 1, year: 1, season: "summer",
      rawSupportRatio: 0.3, clampedSupportRatio: 0.3, perCapitaReturn: 0.3,
      seasonalModifier: 1, foodStress: 0.7, waterStress: 0.1, deficitRatio: 0.7, mode: "lean",
    },
    { id: bandId, demography: { population: 50, workingAdults: 29, dependents: 14, elders: 7 } },
    { tick: 1, year: 1, season: "summer", day: 100 },
    { topSeasonalSupportReasons: ["fixture: a measured, hungry camp"], replaceSameTickSample: true },
  );

  const makeParent = (cohorts, opts = {}) => ({
    id: "parent",
    name: "Parent",
    // A WELL-FORMED 7-digit hex, and the reason is a real finding rather than tidiness: the previous
    // "#111" is 4-digit shorthand, `hexToHsl` cannot parse it, and `deriveDaughterColor`'s non-hex
    // guard then RETURNS THE PARENT'S COLOUR VERBATIM. The transfer policy caught that as
    // `color:identical_to_the_parent` and refused the departure — correctly, because two bands the
    // viewer cannot tell apart at the moment of a split is exactly what the identity class is for.
    color: "#3366cc",
    position: "tile:10:10",
    size: cohorts.workingAdults + cohorts.dependents + cohorts.elders,
    status: "foraging",
    demography: {
      population: cohorts.workingAdults + cohorts.dependents + cohorts.elders,
      workingAdults: cohorts.workingAdults,
      dependents: cohorts.dependents,
      elders: cohorts.elders,
    },
    hungerPressure: opts.hungerPressure ?? 0.7,
    // ── A MEASURED CAMP, because an unmeasured one is not a camp production can build ──
    //
    // These fixtures used to hand a parent `hungerPressure: 0.7` and NO `seasonalSupport`, which is a
    // band that has never completed a physical-food interval yet somehow knows it is hungry. Production
    // cannot produce that pairing: hunger is derived FROM the support state. The seam now refuses to
    // send anybody out of an unmeasured camp — unconditionally, because guarding that refusal on the
    // parent being measured was the exact hole it existed to close — so the omission stopped being
    // invisible and started refusing D1, which cascaded into twelve errors downstream.
    //
    // Built through the production writer rather than by hand, so the fixture cannot invent a shape
    // the real one would not produce. The sample is deliberately consistent with the hunger above.
    seasonalSupport: opts.seasonalSupport ?? makeMeasuredSupport("parent"),
    acuteRisk: opts.acuteRisk ?? { severity: 0.4 },
    deathMemory: opts.deathMemory ?? { sourceEventIds: ["death:1"] },
    storageCapacity: opts.storageCapacity ?? 0.5,
    expeditions: [],
    seasonalFoodReceipts: { periodTick: 3, usableSupport: 9 },
    recentIntraSeasonTrips: [{ id: "t1" }],
    daughterBandIds: [],
    fissionEvents: [],
    // ROADMAP ITEM 4 §4 — the seam now routes the successor's knowledge through the SAME canonical
    // degrading inheritors the legacy daughter path uses, so it reads the parent's knowledge stores
    // and the world's tiles. These fixtures test conservation and ownership, not knowledge transfer,
    // so they supply the EMPTY shapes: present and well-formed, carrying nothing to transfer. The
    // suite crashed before this was added, and that is worth recording — a synthetic world with no
    // `tiles` map at all is not a world, and the fixture was passing only because the seam had never
    // needed to look.
    knowledge: opts.knowledge ?? {
      selfBandId: "parent", observedTiles: {}, compressedKnownTileSummaries: [], knownAreaSummaries: [],
      knownBands: [], knownSettlements: [], knownRoutes: [], placeAttachments: [],
      tileObservationHistory: [], rumors: [],
    },
    placeMemory: {},
    travelCorridors: {},
    crossingMemories: {},
    technologies: [],
    viability: opts.parentViability ?? { status: "viable" },
    fissionAttempt: opts.attempt ?? {
      phase: "departure_ready",
      phaseEnteredDay: 0,
      history: ["proposed", "departure_planned"],
      lineageId: "LIN-1",
      requestedFounders: opts.requestedFounders ?? 18,
      targetTileId: "tile:17:17",
    },
  });

  const RESIDUAL_SOUND = {
    physicallyAwayPeople: 0, physicallyAwayWorkers: 0, preparedCommitmentWorkers: 0,
    foodDemographicPressure: 0, chronicFoodStress: 0, chronicDeficitStreak: 0, nutritionMeasured: true,
    acuteRiskSeverity: 0, sicknessBurden: 0, careTravelBurden: 0, embodiedConditionMeasured: true,
    ecologicalRisk: 0, ecologicalPositionMeasured: true,
    mobilityCapabilityBefore: 1, mobilityCapabilityAfter: 1,
    minimumFounderRequest: 2,
  };

  const depart = (parent, residual = {}, day = 100) =>
    seam.performAtomicDeparture({
      world: { bands: { parent }, tiles: {}, time: { day, tick: 1 } },
      parentId: "parent",
      today: day,
      residualContext: { ...RESIDUAL_SOUND, ...residual },
      successorBandId: "successor",
      lineageId: "LIN-1",
    });

  const fixtures = [];
  const record = (id, claim, run) => {
    let row;
    try { row = run(); } catch (e) { fixtures.push({ id, claim, status: "ERROR", error: String(e?.message ?? e) }); return; }
    const { nonVacuous, nonVacuityNote, passed, ...rest } = row;
    fixtures.push({ id, claim, status: !nonVacuous ? "VACUOUS" : passed ? "PASS" : "FAIL", nonVacuityNote, ...rest });
  };

  const NATURAL = { workingAdults: 29, dependents: 14, elders: 7 };
  const baseline = depart(makeParent(NATURAL));

  // ── D1 — the departure happens at all ───────────────────────────────────────────────────────
  record("D1", "a departure_ready attempt with a viable residual departs", () => ({
    ok: baseline.ok,
    endorsed: baseline.ok ? baseline.endorsedFounders : baseline.refusal,
    nonVacuous: baseline.ok === true,
    nonVacuityNote: "the seam genuinely produced a departure; every later gate reads this world",
    passed: baseline.ok === true,
  }));

  // ── D2 — L1 exact conservation, MEASURED from the resulting world ───────────────────────────
  record("D2", "population and all three cohorts are conserved exactly, measured after the mutation", () => {
    const d = baseline.ledger.demographic;
    return {
      ledger: d,
      conserving: seam.isDepartureLedgerConserving(baseline.ledger),
      nonVacuous: d.successor.workingAdults + d.successor.dependents + d.successor.elders > 0,
      nonVacuityNote: "people genuinely moved, so the conservation is over a real transfer",
      passed:
        seam.isDepartureLedgerConserving(baseline.ledger) &&
        d.measuredFromResultingWorld === true &&
        d.fixedRatioRecomputeUsed === false &&
        // the legacy textbook shape must NOT appear
        !(Math.abs(d.successor.dependents / (d.successor.workingAdults + d.successor.dependents + d.successor.elders) - 0.3333) < 0.001),
    };
  });

  // ── D3 — corrupted conservation is DETECTED ─────────────────────────────────────────────────
  record("D3", "a deliberately corrupted ledger is detected rather than reported conserved", () => {
    const good = baseline.ledger;
    const corrupted = { ...good, demographic: { ...good.demographic, worldPopulationAfter: good.demographic.worldPopulationBefore + 1, populationConserved: false } };
    const cohortCorrupted = { ...good, demographic: { ...good.demographic, dependentsConserved: false } };
    return {
      healthy: seam.isDepartureLedgerConserving(good),
      populationCorrupted: seam.isDepartureLedgerConserving(corrupted),
      cohortCorrupted: seam.isDepartureLedgerConserving(cohortCorrupted),
      nonVacuous: seam.isDepartureLedgerConserving(good) === true,
      nonVacuityNote: "the healthy ledger passes in the same run, so the detections are detections",
      // the cohort case is the one that matters: a total can balance while composition does not
      passed: seam.isDepartureLedgerConserving(corrupted) === false && seam.isDepartureLedgerConserving(cohortCorrupted) === false,
    };
  });

  // ── D4 — the successor starts at the PARENT'S tile ──────────────────────────────────────────
  record("D4", "the successor is created at the parent's tile, never at the target", () => {
    const succ = baseline.world.bands.successor;
    const parent = baseline.world.bands.parent;
    return {
      successorPosition: succ.position,
      parentPosition: parent.position,
      attemptTarget: parent.fissionAttempt.targetTileId,
      nonVacuous: parent.fissionAttempt.targetTileId !== parent.position,
      nonVacuityNote: "the target genuinely differs from the parent tile, so co-residence is a choice",
      passed: succ.position === parent.position && succ.position !== parent.fissionAttempt.targetTileId,
    };
  });

  // ── D5 — living, not established, cannot fission ────────────────────────────────────────────
  record("D5", "the successor is living, is not established, and cannot fission", () => {
    const succ = baseline.world.bands.successor;
    const parent = baseline.world.bands.parent;
    return {
      living: lc.isLivingBand(succ),
      established: lc.isEstablishedBand(succ),
      fissionEligible: lc.isFissionEligibleParent(succ),
      provisional: lc.isProvisionalSuccessor(succ),
      parentEstablished: lc.isEstablishedBand(parent),
      nonVacuous: lc.isEstablishedBand(parent) === true,
      nonVacuityNote: "the PARENT is established in the same world, so the successor's false is discriminating",
      passed:
        lc.isLivingBand(succ) === true && lc.isEstablishedBand(succ) === false &&
        lc.isFissionEligibleParent(succ) === false && lc.isProvisionalSuccessor(succ) === true,
    };
  });

  // ── D6 — L4, no viability at departure ──────────────────────────────────────────────────────
  record("D6", "no viable status is asserted at departure", () => ({
    successorViability: baseline.ledger.derived.successorViabilityStatus ?? null,
    asserted: baseline.ledger.derived.viabilityAssertedAtDeparture,
    parentViability: baseline.world.bands.parent.viability?.status,
    nonVacuous: baseline.world.bands.parent.viability?.status === "viable",
    nonVacuityNote: "the parent DOES carry a viability status, so the successor's absence is deliberate",
    passed: baseline.ledger.derived.viabilityAssertedAtDeparture === false,
  }));

  // ── D7 — L3, no material capability from nothing ────────────────────────────────────────────
  record("D7", "no storage, expedition or receipt is created by departing", () => {
    const m = baseline.ledger.material;
    return {
      material: m,
      parentStorage: baseline.world.bands.parent.storageCapacity,
      nonVacuous: (baseline.world.bands.parent.storageCapacity ?? 0) > 0,
      nonVacuityNote: "the parent HAS storage, so the successor's zero is an honest absence rather than a world with no storage at all",
      passed:
        m.storageCapacityCreatedFromNothing === false && m.successorStorageCapacity === 0 &&
        m.successorInheritedExpeditions === 0 && m.successorInheritedReceipts === 0 &&
        // Added after the admission audit measured a real successor inheriting the parent's 20
        // decision records, 4 move events and its proto-camp memory through the spread.
        m.inheritedDecisionRecords === 0 && m.inheritedResidentialMoveEvents === 0 &&
        m.inheritedProtoCampMemory === 0,
    };
  });

  // ── D8 — L2, no hunger improvement ──────────────────────────────────────────────────────────
  record("D8", "the split does not make anybody less hungry", () => {
    const e = baseline.ledger.embodied;
    return {
      embodied: e,
      nonVacuous: e.parentHungerBefore > 0,
      nonVacuityNote: "the parent was genuinely hungry, so 'not improved' is a real claim",
      passed: e.hungerImprovedByTheSplit === false && e.successorHunger === e.parentHungerBefore && e.exactnessClaimed === false,
    };
  });

  // ── D9 — L5 / L6, condition and memory carried ──────────────────────────────────────────────
  record("D9", "acute condition and death memory are carried, not reset and not duplicated", () => {
    const p = baseline.ledger.provenance;
    const succ = baseline.world.bands.successor;
    return {
      provenance: p,
      acuteRiskCarried: baseline.ledger.embodied.acuteRiskCarried,
      successorHasAcuteRisk: succ.acuteRisk !== undefined,
      nonVacuous: baseline.world.bands.parent.acuteRisk !== undefined,
      nonVacuityNote: "the parent genuinely carried acute risk and a death memory",
      passed: p.deathMemoryErased === false && p.deathMemoryDuplicatedAsUnrelatedEvents === false && succ.acuteRisk !== undefined,
    };
  });

  // ── D10 — ownership: one physical owner, no duplicates ──────────────────────────────────────
  record("D10", "the resulting world has exactly one current owner for the departure", () => {
    const findings = lc.auditFissionLineageOwnership(Object.values(baseline.world.bands));
    const parent = baseline.world.bands.parent;
    return {
      findings: findings.map((f) => f.defect),
      parentAttemptPhase: parent.fissionAttempt.phase,
      parentHasCurrentAttempt: lc.hasCurrentFissionAttempt(parent),
      nonVacuous: parent.fissionAttempt !== undefined,
      nonVacuityNote: "the parent genuinely retains its attempt record as provenance",
      // the attempt is terminal, so it is provenance and NOT a second current body owner
      passed: findings.length === 0 && parent.fissionAttempt.phase === "departed" && lc.hasCurrentFissionAttempt(parent) === false,
    };
  });

  // ── D11 — the pair is lineage-safe, and a stranger is not ───────────────────────────────────
  record("D11", "parent and successor are recognised as one split; an unrelated band is not", () => {
    const parent = baseline.world.bands.parent;
    const succ = baseline.world.bands.successor;
    // A GENUINE stranger. Built by hand rather than through `makeParent`, because that helper uses
    // `opts.attempt ?? {default}` — so passing `attempt: undefined` silently hands the "stranger" the
    // PARENT'S lineage id and the fixture reports a false failure. It did exactly that on the first
    // run, and the authority was right both times.
    const stranger = {
      id: "stranger", name: "Stranger", color: "#222", position: "tile:99:99", size: 15,
      status: "foraging",
      demography: { population: 15, workingAdults: 5, dependents: 5, elders: 5 },
      expeditions: [], daughterBandIds: [], fissionEvents: [],
      fissionAttempt: undefined, provisionalSuccessor: undefined,
    };
    return {
      pairProtected: lc.shareCurrentFissionLineage(parent, succ),
      strangerProtected: lc.shareCurrentFissionLineage(stranger, succ),
      nonVacuous: lc.shareCurrentFissionLineage(parent, succ) === true,
      nonVacuityNote: "the real pair IS protected, so the stranger's false is a real negative",
      passed: lc.shareCurrentFissionLineage(parent, succ) === true && lc.shareCurrentFissionLineage(stranger, succ) === false,
    };
  });

  // ── D12 — the seam refuses without departure_ready ──────────────────────────────────────────
  record("D12", "a departure is refused from every phase except departure_ready", () => {
    const rows = {};
    for (const phase of ["proposed", "departure_planned", "abandoned", "departed"]) {
      const r = depart(makeParent(NATURAL, { attempt: { phase, phaseEnteredDay: 0, history: [], lineageId: "LIN-1", requestedFounders: 18, targetTileId: "tile:17:17" } }));
      rows[phase] = r.ok === true ? "ACCEPTED" : r.refusal;
    }
    return {
      rows,
      readyAccepted: baseline.ok,
      nonVacuous: baseline.ok === true,
      nonVacuityNote: "departure_ready IS accepted in the same run",
      passed: Object.values(rows).every((v) => v === "parent_attempt_not_departure_ready"),
    };
  });

  // ── D13 — the residual authority can block the departure ────────────────────────────────────
  record("D13", "a departure that would strand the parent is refused by the residual authority", () => {
    const stranded = depart(makeParent({ workingAdults: 4, dependents: 30, elders: 16 }, { requestedFounders: 20 }), { minimumFounderRequest: 20 });
    return {
      outcome: stranded.ok ? "ACCEPTED" : stranded.refusal,
      detail: stranded.ok ? null : stranded.detail,
      nonVacuous: baseline.ok === true,
      nonVacuityNote: "a healthy parent DOES depart in the same run, so the refusal is not a broken seam",
      passed: stranded.ok === false && stranded.refusal === "residual_authority_blocked_the_departure",
    };
  });

  // ── D14 — a revision is APPLIED, not merely recorded ────────────────────────────────────────
  record("D14", "when the residual authority revises the request down, the smaller group is the one that leaves", () => {
    const revised = depart(
      makeParent({ workingAdults: 10, dependents: 26, elders: 14 }, { requestedFounders: 18 }),
      { foodDemographicPressure: 1, chronicFoodStress: 1, chronicDeficitStreak: 12, acuteRiskSeverity: 1, sicknessBurden: 1, careTravelBurden: 1, ecologicalRisk: 0.9, mobilityCapabilityBefore: 0.1, mobilityCapabilityAfter: 0.1, minimumFounderRequest: 2 },
    );
    if (revised.ok !== true) return { outcome: revised.refusal, nonVacuous: true, nonVacuityNote: "n/a", passed: false };
    const succTotal = revised.ledger.demographic.successor.workingAdults + revised.ledger.demographic.successor.dependents + revised.ledger.demographic.successor.elders;
    return {
      requested: revised.requestedFounders,
      endorsed: revised.endorsedFounders,
      revisionApplied: revised.revisionApplied,
      actualSuccessorSize: succTotal,
      conserving: seam.isDepartureLedgerConserving(revised.ledger),
      nonVacuous: revised.revisionApplied === true,
      nonVacuityNote: "a revision genuinely occurred; without one this gate would prove nothing",
      // the group that actually left must be the ENDORSED size, not the requested one
      passed: succTotal === revised.endorsedFounders && succTotal < revised.requestedFounders && seam.isDepartureLedgerConserving(revised.ledger),
    };
  });

  // ── D15 — the parent is updated by SUBTRACTION, not re-derivation ───────────────────────────
  record("D15", "the parent's cohorts after are its own minus the departing group, not a re-derived shape", () => {
    const d = baseline.ledger.demographic;
    const total = d.parentAfter.workingAdults + d.parentAfter.dependents + d.parentAfter.elders;
    const textbookDependents = Math.round(total * 0.35);
    const textbookElders = Math.round(total * 0.1);
    return {
      parentAfter: d.parentAfter,
      whatFixedRatioRecomputeWouldHaveGiven: { dependents: textbookDependents, elders: textbookElders },
      nonVacuous: textbookDependents !== d.parentAfter.dependents || textbookElders !== d.parentAfter.elders,
      nonVacuityNote: "the fixed-ratio shape genuinely differs from the true remainder here, so the check discriminates",
      passed:
        d.parentAfter.workingAdults === d.parentBefore.workingAdults - d.successor.workingAdults &&
        d.parentAfter.dependents === d.parentBefore.dependents - d.successor.dependents &&
        d.parentAfter.elders === d.parentBefore.elders - d.successor.elders,
    };
  });

  // ── D16 — the seam is not reachable from ordinary fission ───────────────────────────────────
  record("D16", "nothing in production calls this seam, so ordinary behaviour cannot change", () => {
    // Read from the actual source rather than asserted.
    const demography = readFileSync("src/sim/agents/demography.ts", "utf8");
    const advance = readFileSync("src/sim/tick/advance.ts", "utf8");
    const callers = ["demography.ts", "advance.ts"].filter((_, i) =>
      [demography, advance][i].includes("performAtomicDeparture") || [demography, advance][i].includes("fissionDepartureSeam"),
    );
    return {
      callers,
      legacyPathIntact: demography.includes("createDaughterBand"),
      nonVacuous: demography.includes("createDaughterBand"),
      nonVacuityNote: "the legacy path genuinely still exists in demography.ts",
      passed: callers.length === 0,
    };
  });

  // ── D17 — determinism ───────────────────────────────────────────────────────────────────────
  record("D17", "the same request produces a byte-identical world and ledger", () => {
    const a = JSON.stringify(depart(makeParent(NATURAL)).ledger);
    const b = JSON.stringify(depart(makeParent(NATURAL)).ledger);
    return {
      identical: a === b,
      nonVacuous: a.length > 200,
      nonVacuityNote: "the compared ledger is substantive",
      passed: a === b,
    };
  });

  // ── D18 — a refusal leaves the world untouched ──────────────────────────────────────────────
  record("D18", "a refused departure returns the original world with nobody moved", () => {
    const parent = makeParent(NATURAL, { attempt: { phase: "proposed", phaseEnteredDay: 0, history: [], lineageId: "LIN-1", requestedFounders: 18 } });
    const world = { bands: { parent }, time: { day: 100, tick: 1 } };
    const before = JSON.stringify(world);
    const r = seam.performAtomicDeparture({ world, parentId: "parent", today: 100, residualContext: RESIDUAL_SOUND, successorBandId: "successor", lineageId: "LIN-1" });
    return {
      refusal: r.ok ? "ACCEPTED" : r.refusal,
      worldUnchanged: JSON.stringify(world) === before,
      bandCount: Object.keys(world.bands).length,
      nonVacuous: r.ok === false,
      nonVacuityNote: "the departure was genuinely refused",
      passed: r.ok === false && JSON.stringify(world) === before && Object.keys(world.bands).length === 1,
    };
  });

  const counts = fixtures.reduce((a, f) => { a[f.status] = (a[f.status] ?? 0) + 1; return a; }, { PASS: 0, FAIL: 0, VACUOUS: 0, ERROR: 0 });

  out = {
    generatedAt: new Date().toISOString(),
    checkpoint: "ROADMAP ITEM 4 §11 — atomic departure seam controlled gates",
    authority: "src/sim/agents/fissionDepartureSeam.ts",
    scopeLimit:
      "The seam is NOT reachable from ordinary fission — D16 reads the sources to prove it. These gates drive the production writer directly. They prove the departure TRANSITION is truthful; they prove nothing about travel, return or stabilization, none of which exist, and nothing about natural occurrence.",
    fixtures,
    summary: { total: fixtures.length, passing: counts.PASS, failing: counts.FAIL, vacuous: counts.VACUOUS, errored: counts.ERROR },
  };

  ordering = {
    generatedAt: new Date().toISOString(),
    checkpoint: "ROADMAP ITEM 4 §5 — runner sub-step ordering and departure seam selection",
    seasonalTickSubSteps: [
      { step: 1, name: "buildTickContextCache (pre-decision)", movesBands: false },
      { step: 2, name: "updateBandContextStates", movesBands: false },
      { step: 3, name: "applyAcuteRiskContext", movesBands: false },
      { step: 4, name: "per-band decision loop (evaluateBandDecision + applyBandDecision)", movesBands: true, note: "iterates a bandOrder SNAPSHOT taken before the loop" },
      { step: 5, name: "buildTickContextCache (post-decision)", movesBands: false, note: "this cache feeds every ecology step below" },
      { step: 6, name: "applyRangeSaturationContext", movesBands: false },
      { step: 7, name: "applyEncounterContext", movesBands: false },
      { step: 8, name: "updateBandsDemographyAndFission", movesBands: false, note: "THE CHOSEN SEAM. Iterates its own bandOrder SNAPSHOT taken at entry" },
      { step: 9, name: "updateBandViabilityStates", movesBands: false, note: "enumerates world.bands live — sees a band created at step 8. This is the reader that must be blocked" },
      { step: 10, name: "applyBandDeepHistoryContext", movesBands: false },
      { step: 11, name: "advanceTileDepletion / Fauna / Plant / Forest", movesBands: false, note: "consume the step-5 cache, so a band created at step 8 exerts no depletion this tick" },
      { step: 12, name: "deriveFinalReadModelContext + updateBandContextStates", movesBands: false, note: "partial rebuild when the active band set changed, so the successor enters the read model this tick" },
    ],
    chosenSeam: {
      step: 8,
      writer: "src/sim/agents/fissionDepartureSeam.ts performAtomicDeparture",
      why: "Both the decision loop's bandOrder and updateBandsDemographyAndFission's own bandOrder are snapshots taken before their loops begin, so a band created at step 8 is in NEITHER. It therefore cannot receive a decision this tick (no free movement, no double movement) and cannot receive a demographic update this tick (no double update). It gets its first of each on the next tick, exactly once. This is also exactly where the legacy path already sits.",
      acceptedConsequence:
        "The ecology steps consume the step-5 cache, so the successor exerts no depletion on its birth tick. This is IDENTICAL to what the legacy daughter does today, so it is a preserved property rather than a new defect.",
    },
    rejectedSeams: [
      { step: 4, why: "bands physically move here, so a successor created mid-loop could be handed a decision and move on its birth day — free movement" },
      { step: 11, why: "after the ecology advance the successor would miss viability and the read-model pass, appearing only in the next tick's cache — a one-tick disappearance from physical presence" },
      { name: "runDailyActions", why: "wrong cadence entirely; fission is annual and a daily writer would need its own resolution bound" },
    ],
    doubleProcessingRisks: {
      consumedTwice: "prevented — the successor is not in step 4's snapshot",
      noConsumption: "accepted for the birth tick, identical to the legacy daughter",
      twoDemographicUpdates: "prevented — the successor is not in step 8's snapshot",
      movedForFree: "prevented — no decision is evaluated for it this tick",
      duplicateReceipts: "prevented — seasonalFoodReceipts is reset to undefined at construction",
      absentFromPresence: "prevented — step 12 rebuilds the read model with the changed band set",
      ownedByBoth: "prevented — the attempt resolves to the terminal `departed` phase, so hasCurrentFissionAttempt reads false",
    },
    stillOpen: {
      viabilityCleanup:
        "step 9 enumerates world.bands live and WILL see the successor. It is listed `blocked` in PROVISIONAL_READER_MATRIX.md and is NOT yet migrated. Until it is, a production-reachable successor could be removed by Item 6 cleanup — which is one of the reasons this seam is deliberately not connected to natural fission.",
    },
  };
} finally {
  await server.close();
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
writeFileSync(OUT_ORDER, `${JSON.stringify(ordering, null, 2)}\n`);
for (const f of out.fixtures) {
  console.log(`${f.status.padEnd(7)} ${f.id}  ${f.claim}`);
  if (f.status !== "PASS") console.log(`        ${JSON.stringify(f).slice(0, 800)}`);
}
console.log(`\nsummary: ${JSON.stringify(out.summary)}`);
console.log(`written: ${OUT}\nwritten: ${OUT_ORDER}`);
if (out.summary.failing > 0 || out.summary.vacuous > 0 || out.summary.errored > 0) process.exitCode = 1;
