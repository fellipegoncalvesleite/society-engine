// ROADMAP ITEM 4 — WHO MAY ENTER THE LEGACY DAUGHTER-CREATION PATH.
//
// `isFissionEligibleParent` has said since it was written that a provisional successor may not
// propose a split of its own — "it has not demonstrated that it can function, so a split of a split
// would be a claim about a group whose own viability is the open question". Supervisor source review
// found the predicate had NO PRODUCTION CALLER: `updateBandsDemographyAndFission` skips only
// `dispersed`/`absorbed`/`extinct`, and `computeBandDemography` derived eligibility from split
// pressure, crisis breakaway and cooldown with no lifecycle question anywhere in it.
//
// These fixtures hold the repaired boundary from BOTH sides, because a gate that blocks everything
// passes the half of the test that is easy to pass. F1 proves the annual bodily step still reaches a
// provisional group's people; F2 proves the same group, on the same day, at split pressure ABOVE the
// production threshold, creates no daughter. F3 and F4 are the controls that stop this being a
// global switch-off.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/dynamic-fission-daughter-viability-37";
const OUT = arg("out", `${EVIDENCE}/fission-admission-boundary.json`);
const SEED = arg("seed", "audit27:natural:s1");
const WARM_DAYS = Number(arg("warm-days", "2100"));

const fixtures = [];
const record = (id, claim, passed, nonVacuous, detail) => {
  fixtures.push({ id, claim, verdict: nonVacuous === false ? "VACUOUS" : passed ? "PASS" : "FAIL", nonVacuous: nonVacuous !== false, detail });
};

const server = await createServer({
  root: `${process.cwd()}/src`, cacheDir: `node_modules/.vite-i4fa-${process.pid}`,
  configFile: false, appType: "custom", server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const demography = await server.ssrLoadModule("/sim/agents/demography.ts");
  const seam = await server.ssrLoadModule("/sim/agents/fissionDepartureSeam.ts");
  const generate = await server.ssrLoadModule("/sim/world/generate.ts");
  const passability = await server.ssrLoadModule("/sim/world/passability.ts");
  const lc = await server.ssrLoadModule("/sim/agents/bandLifecycle.ts");
  const timeMod = await server.ssrLoadModule("/sim/tick/time.ts");

  const base = advance.advanceWorldByDays(runner.initSimWorld({ kind: "map2" }, SEED), WARM_DAYS);
  const day0 = Number(base.time.day ?? 0);
  const parent = Object.values(base.bands)
    .filter((b) => lc.isEstablishedBand(b) && b.demography.workingAdults >= 6 && b.demography.population >= 24)
    .sort((a, b) => b.demography.population - a.demography.population)[0];

  const RES = { physicallyAwayPeople: 0, physicallyAwayWorkers: 0, preparedCommitmentWorkers: 0,
    foodDemographicPressure: 0, chronicFoodStress: 0, chronicDeficitStreak: 0, nutritionMeasured: true,
    acuteRiskSeverity: 0, sicknessBurden: 0, careTravelBurden: 0, embodiedConditionMeasured: true,
    ecologicalRisk: 0, ecologicalPositionMeasured: true,
    mobilityCapabilityBefore: 1, mobilityCapabilityAfter: 1, minimumFounderRequest: 2 };

  // ── a REAL provisional successor, through the REAL departure seam ──
  const SID = "band:fa:successor";
  const target = Object.keys(parent.knowledge.observedTiles).map((id) => generate.getTile(base, id))
    .filter((t) => t !== undefined && passability.isBandPassableDestination(t) && String(t.id) !== String(parent.position))[0];
  const dep = seam.performAtomicDeparture({
    world: { ...base, bands: { ...base.bands, [parent.id]: { ...base.bands[parent.id],
      fissionAttempt: { phase: "departure_ready", phaseEnteredDay: day0 - 5, history: ["proposed", "departure_planned"],
        lineageId: "LIN-FA", requestedFounders: 12, targetTileId: String(target.id) } } } },
    parentId: parent.id, today: day0, residualContext: RES, successorBandId: SID, lineageId: "LIN-FA" });
  if (dep.ok !== true) throw new Error(`departure refused: ${dep.refusal}`);

  // ── arm EVERY legacy fission precondition, not just the obvious one ──
  //
  // The first form of this fixture armed split pressure alone and the established control did not
  // fission — and the cause was NOT the new gate. Production's own evaluation observer reported
  // `split_deferred_low_population`: `MINIMUM_SPLIT_POPULATION` is 46 and no band in this world is
  // near it (the chosen parent holds 22 after the departure, the successor 12), so population was the
  // binding constraint and split pressure never decided anything. Arming a threshold that was not the
  // one refusing would have produced a fixture that passed for the wrong reason on the provisional arm
  // and failed for the wrong reason on the control.
  //
  // Armed here: population and cohorts above the split minimum, split pressure above the threshold,
  // and the fission cooldown cleared. Measured with the observer afterwards: both arms then read
  // `deferredReason: null`, split pressure 0.98 / 1.00 against a threshold of 0.64, cooldown elapsed.
  // The ONLY thing left that can separate them is the lifecycle gate.
  const ABOVE = 0.95;
  const armFission = (band) => ({
    ...band,
    fissionEvents: [],
    demography: { ...band.demography, splitPressure: ABOVE,
      population: 60, workingAdults: 30, dependents: 20, elders: 10 },
  });
  const successorArmed = armFission(dep.world.bands[SID]);
  const establishedArmed = armFission(dep.world.bands[parent.id]);

  // Advance to the day the ANNUAL demographic step actually runs, so nothing here depends on a
  // sampling choice — CORRECTION-34A/-34D both recorded a season-boundary sample hiding a daily fact.
  const findAnnualDay = (from) => {
    for (let d = from + 1; d < from + 400; d += 1) {
      const t = timeMod.getWorldTimeForDay(d);
      if (t.season === "spring" && t.dayOfSeason === 0) return d;
    }
    return undefined;
  };
  const annualDay = findAnnualDay(day0);

  // Production's OWN evaluation observer, so the gate values reported below are the ones the decision
  // used rather than a second copy of the arithmetic.
  const diag = await server.ssrLoadModule("/sim/diagnostics/fissionDiagnostics.ts");
  const gateRows = {};

  // THE ANNUAL AUTHORITY IS DRIVEN DIRECTLY, AND THAT IS THE CORRECTION THIS FIXTURE NEEDED.
  //
  // An earlier form advanced the world sixty days to the next spring boundary and then measured. It
  // reported a provisional group creating a daughter — and production was RIGHT: a group armed with
  // sixty healthy people STABILIZES inside those sixty days, so by the annual step it was an ordinary
  // established band (`successorPhase: "stabilized"`, `fissionEligible: true`) legitimately entitled
  // to fission. The arming that made the fixture non-vacuous had destroyed the very condition under
  // test. Advancing a world is the wrong instrument for a question about one instant.
  //
  // `updateBandsDemographyAndFission` self-gates on `world.time.season === "spring" && tick > 0`, so
  // the annual step is invoked once, at a constructed spring instant, on a group whose provisional
  // phase is asserted immediately beforehand.
  const annualTime = { ...timeMod.getWorldTimeForDay(annualDay), tick: Math.max(1, Number(base.time.tick ?? 1)) };
  const runAnnual = (label, bandsOverride) => {
    const w0 = { ...dep.world, time: annualTime, bands: { ...dep.world.bands, ...bandsOverride } };
    const seen = [];
    diag.setFissionEvaluationObserver((r) => {
      const id = String(r.bandId);
      if (id === String(parent.id) || id === SID) {
        seen.push({ band: id, population: r.population, splitPressure: r.splitPressure,
          threshold: r.splitPressureThreshold, minimumSplitPopulation: r.minimumSplitPopulation,
          cooldownElapsed: r.cooldownElapsed, deferredReason: r.deferredReasonType ?? null });
      }
    });
    const stepped = demography.updateBandsDemographyAndFission(w0);
    diag.setFissionEvaluationObserver(undefined);
    gateRows[label] = seen;
    gateRows[`${label}:provisionalAtCallTime`] = lc.isProvisionalSuccessor(w0.bands[SID]);
    gateRows[`${label}:phaseAtCallTime`] = w0.bands[SID]?.provisionalSuccessor?.phase ?? null;
    return stepped;
  };

  const bandIdsOf = (w) => Object.keys(w.bands).sort();
  const beforeIds = bandIdsOf(dep.world);

  // ══ F1 — DEMOGRAPHY STILL REACHES THE PROVISIONAL GROUP ══
  const afterSucc = runAnnual("provisional", { [SID]: successorArmed });
  const succBefore = successorArmed.demography;
  const succAfter = afterSucc.bands[SID]?.demography;
  const demographyMoved = succAfter !== undefined && (
    succAfter.population !== succBefore.population ||
    succAfter.growthAccumulator !== succBefore.growthAccumulator ||
    succAfter.mortalityAccumulator !== succBefore.mortalityAccumulator ||
    succAfter.workingAdults !== succBefore.workingAdults ||
    succAfter.dependents !== succBefore.dependents ||
    succAfter.elders !== succBefore.elders ||
    succAfter.splitPressure !== succBefore.splitPressure);
  record("F1_annual_demography_still_reaches_a_provisional_group",
    "the annual bodily step is still evaluated on a provisional successor — the gate withholds daughter creation, not biology, so the group can still change and still fail",
    demographyMoved,
    succAfter !== undefined,
    { populationBefore: succBefore.population, populationAfter: succAfter?.population ?? null,
      growthAccumulator: [succBefore.growthAccumulator, succAfter?.growthAccumulator ?? null],
      mortalityAccumulator: [succBefore.mortalityAccumulator, succAfter?.mortalityAccumulator ?? null],
      cohortsBefore: { w: succBefore.workingAdults, d: succBefore.dependents, e: succBefore.elders },
      cohortsAfter: succAfter === undefined ? null : { w: succAfter.workingAdults, d: succAfter.dependents, e: succAfter.elders },
      splitPressure: [succBefore.splitPressure, succAfter?.splitPressure ?? null],
      gateValuesProductionUsed: gateRows.provisional ?? null,
      note: "a band skipped at the top of the loop would move on NONE of these" });

  // ══ F2 — AND IT CREATES NO DAUGHTER ══
  const succNewIds = bandIdsOf(afterSucc).filter((id) => !beforeIds.includes(id));
  const succDaughtersOfSuccessor = succNewIds.filter((id) => afterSucc.bands[id]?.parentBandId === SID);
  const succFissionEvents = (afterSucc.bands[SID]?.fissionEvents ?? []).length;
  const stillProvisional = afterSucc.bands[SID] !== undefined && lc.isProvisionalSuccessor(afterSucc.bands[SID]);
  record("F2_a_provisional_successor_creates_no_legacy_daughter",
    "with split pressure above the production threshold and the cooldown clear, a live provisional successor produces no daughter id, no fission event and no daughter-band consequence",
    succDaughtersOfSuccessor.length === 0 && succFissionEvents === 0 &&
      (afterSucc.bands[SID]?.daughterBandIds ?? []).length === 0 &&
      gateRows["provisional:provisionalAtCallTime"] === true,
    // Non-vacuous only if the group really was provisional at the instant the authority ran.
    gateRows["provisional:provisionalAtCallTime"] === true,
    { splitPressureArmedAt: ABOVE, threshold: demography.SPLIT_PRESSURE_THRESHOLD ?? "module-private",
      newBandIdsAnywhere: succNewIds, daughtersOfTheSuccessor: succDaughtersOfSuccessor,
      fissionEventsOnSuccessor: succFissionEvents,
      daughterBandIdsOnSuccessor: afterSucc.bands[SID]?.daughterBandIds ?? [],
      provisionalAtTheInstantTheAuthorityRan: gateRows["provisional:provisionalAtCallTime"],
      phaseAtTheInstantTheAuthorityRan: gateRows["provisional:phaseAtCallTime"],
      successorStillProvisional: stillProvisional,
      successorPhase: afterSucc.bands[SID]?.provisionalSuccessor?.phase ?? null,
      fissionEligible: afterSucc.bands[SID] === undefined ? null : lc.isFissionEligibleParent(afterSucc.bands[SID]),
      gateValuesProductionUsed: gateRows.provisional ?? null });

  // ══ F3 — ESTABLISHED CONTROL: the legacy path is NOT globally disabled ══
  //
  // The same arming, on an ordinary established band, must still reach `createDaughterBand`. Without
  // this, F2 would be satisfied by a gate that refuses everybody.
  const afterEst = runAnnual("established", { [parent.id]: establishedArmed });
  const estNewIds = bandIdsOf(afterEst).filter((id) => !beforeIds.includes(id));
  const estDaughters = estNewIds.filter((id) => afterEst.bands[id]?.parentBandId === parent.id);
  record("F3_an_established_band_still_reaches_the_legacy_path",
    "the identical arming on an ordinary established band still produces a legacy daughter — the gate refuses a class, not everybody, and natural fission is NOT cut over",
    estDaughters.length > 0,
    true,
    { parentId: String(parent.id), splitPressureArmedAt: ABOVE,
      newBandIds: estNewIds, daughtersOfTheParent: estDaughters,
      daughterPopulation: estDaughters.map((id) => Math.round(afterEst.bands[id].demography.population)),
      parentFissionEvents: (afterEst.bands[parent.id]?.fissionEvents ?? []).length,
      gateValuesProductionUsed: gateRows.established ?? null,
      note: "this is the positive control that makes F2 a refusal rather than an empty patch" });

  // ══ F4 — CURRENT-ATTEMPT CONTROL: no two split authorities on one parent ══
  //
  // The other half of what `isFissionEligibleParent` promises. An established band holding a live
  // pre-departure Item-4 attempt must not ALSO create a legacy daughter underneath it.
  const attemptingParent = {
    ...establishedArmed,
    fissionAttempt: { phase: "departure_planned", phaseEnteredDay: day0 - 3, history: ["proposed"],
      lineageId: "LIN-FA-2", requestedFounders: 8, targetTileId: String(target.id) },
  };
  const afterAttempt = runAnnual("mid-attempt", { [parent.id]: attemptingParent });
  const attNewIds = bandIdsOf(afterAttempt).filter((id) => !beforeIds.includes(id));
  const attDaughters = attNewIds.filter((id) => afterAttempt.bands[id]?.parentBandId === parent.id);
  record("F4_a_parent_mid_attempt_cannot_also_create_a_legacy_daughter",
    "an established band holding a live pre-departure fission attempt creates no legacy daughter, so one parent never runs two split authorities at once",
    attDaughters.length === 0,
    // Non-vacuous BECAUSE F3 is the same band, same arming, same day, differing only in the attempt.
    estDaughters.length > 0,
    { attemptPhase: "departure_planned", differsFromF3ByOnly: "the presence of a live fissionAttempt",
      newBandIds: attNewIds, daughtersOfTheParent: attDaughters,
      f3ProducedDaughters: estDaughters.length,
      hasCurrentAttemptAfter: afterAttempt.bands[parent.id] === undefined ? null : lc.hasCurrentFissionAttempt(afterAttempt.bands[parent.id]),
      gateValuesProductionUsed: gateRows["mid-attempt"] ?? null });

  // ══ F5 — NON-VACUITY, STATED AS A MEASUREMENT ══
  //
  // The arming really is above the gate: the SAME construction on an established band fissions (F3),
  // so the provisional refusal in F2 cannot be "the pressure was never high enough".
  record("F5_the_arming_is_provably_above_the_legacy_threshold",
    "the split pressure used for the provisional arm is the same value that makes an established band fission on the same day, so F2 measures the lifecycle gate and nothing else",
    estDaughters.length > 0 && succDaughtersOfSuccessor.length === 0,
    true,
    { armedSplitPressure: ABOVE, establishedFissioned: estDaughters.length > 0,
      provisionalFissioned: succDaughtersOfSuccessor.length > 0,
      identicalExceptFor: "which band the arming was applied to",
      observedGateValues: gateRows });

  const failing = fixtures.filter((f) => f.verdict === "FAIL");
  const vacuous = fixtures.filter((f) => f.verdict === "VACUOUS");
  out = {
    generatedAt: new Date().toISOString(), seed: SEED, warmDays: WARM_DAYS,
    parentBandId: String(parent.id), successorId: SID, annualDay,
    summary: { total: fixtures.length, passed: fixtures.filter((f) => f.verdict === "PASS").length, failed: failing.length, vacuous: vacuous.length },
    fixtures,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
  console.log(JSON.stringify({ summary: out.summary, fixtures: fixtures.map((f) => ({ id: f.id, verdict: f.verdict })) }, null, 2));
  if (failing.length > 0 || vacuous.length > 0) process.exitCode = 1;
} finally {
  await server.close();
}
