// ROADMAP ITEM 4 — CANONICAL PRE-DEPARTURE PREPARATION.
//
// The chain that must happen BEFORE anyone leaves, and the properties that make it truthful rather
// than merely ordered. The decisive ones are C (a revision that changes cohort COMPOSITION is what
// the commitment binds to, not the request), I (nobody moves), and L (the parent changing underneath
// a prepared departure is detectable).
import { createServer } from "vite";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/dynamic-fission-daughter-viability-37";
const OUT = arg("out", `${EVIDENCE}/departure-preparation.json`);
const SEED = arg("seed", "audit27:natural:s1");
const WARM_DAYS = Number(arg("warm-days", "2100"));

const fixtures = [];
const record = (id, claim, passed, nonVacuous, detail) => {
  fixtures.push({ id, claim, verdict: nonVacuous === false ? "VACUOUS" : passed ? "PASS" : "FAIL", nonVacuous: nonVacuous !== false, detail });
};

const server = await createServer({
  root: `${process.cwd()}/src`, cacheDir: `node_modules/.vite-i4prep-${process.pid}`,
  configFile: false, appType: "custom", server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const prep = await server.ssrLoadModule("/sim/agents/fissionDeparturePreparation.ts");
  const commitment = await server.ssrLoadModule("/sim/agents/fissionCommitment.ts");
  const allocation = await server.ssrLoadModule("/sim/agents/fissionFounderAllocation.ts");
  const kernel = await server.ssrLoadModule("/sim/agents/fissionLifecycleKernel.ts");
  const generate = await server.ssrLoadModule("/sim/world/generate.ts");
  const passability = await server.ssrLoadModule("/sim/world/passability.ts");
  const lc = await server.ssrLoadModule("/sim/agents/bandLifecycle.ts");

  const base = advance.advanceWorldByDays(runner.initSimWorld({ kind: "map2" }, SEED), WARM_DAYS);
  const day0 = Number(base.time.day ?? 0);
  const parent = Object.values(base.bands)
    .filter((b) => lc.isEstablishedBand(b) && b.demography.workingAdults >= 6 && b.demography.population >= 24)
    .sort((a, b) => b.demography.population - a.demography.population)[0];

  const knownTargets = Object.keys(parent.knowledge.observedTiles)
    .filter((id) => String(id) !== String(parent.position))
    .map((id) => ({ id, record: parent.knowledge.observedTiles[id], tile: generate.getTile(base, id) }))
    .filter((e) => e.tile !== undefined && passability.isBandPassableDestination(e.tile))
    .sort((a, b) => (b.record.visits ?? 0) - (a.record.visits ?? 0));
  const wellKnown = knownTargets[0];
  const unknownTile = Object.keys(base.tiles).find((id) => parent.knowledge.observedTiles[id] === undefined);

  // THE RESIDUAL READING IS NO LONGER SOMETHING A FIXTURE CAN ASSERT.
  //
  // These sixteen numbers used to be passed in as `residualContext`, which meant a fixture could
  // describe a parent that did not exist. `deriveCurrentParentResidualInput` now reads them off the
  // band, so a fixture that wants a fragile parent has to BUILD one — which is also what makes the
  // freshness fixtures below meaningful: changing a real field is the only way to move the reading.
  const POLICY = { minimumFounderRequest: 2 };

  // Prior fragility, expressed through the canonical fields each residual input is read from.
  const fragileState = (level) => ({
    seasonalSupport: {
      ...parent.seasonalSupport,
      currentSeasonSupport: { ...parent.seasonalSupport?.currentSeasonSupport, foodStress: level },
      rolling4SeasonSupport: 1 - level,
      rolling8SeasonRawSupport: 1 - level,
      chronicDeficitStreak: Math.round(level * 8),
      deficitSeasonsLast8: Math.round(level * 8),
      seasonalRecoveryStreak: 0,
    },
    acuteRisk: { ...(parent.acuteRisk ?? { bandId: parent.id, episodes: [] }),
      activeEffect: { activityEfficiencyPenalty: level, extraSeasonalStress: level,
        mortalityRiskBump: 0, movementCautionBump: 0, knowledgeUpdateWeight: 0, recoverySeasons: 4 } },
    bodyCampLogistics: { ...(parent.bodyCampLogistics ?? {}),
      behavior: { ...(parent.bodyCampLogistics?.behavior ?? {}), sicknessActivityPenalty: level },
      careTravelBurden: { ...(parent.bodyCampLogistics?.careTravelBurden ?? {}),
        dependentCarryBurden: level, elderTravelCaution: level, pregnancyNursingBurden: level,
        sickCareBurden: level, wholeBandCrossingBurden: level, longMoveBurden: level,
        coldHeatVulnerability: level, adultLaborAvailable: 1 - level, reasonIds: [], aggregateOnly: true } },
    pressureState: { ...(parent.pressureState ?? {}), riskPressure: level },
  });

  const cohortsOf = (b) => ({
    workingAdults: b.demography.workingAdults, dependents: b.demography.dependents, elders: b.demography.elders });
  const worldPopulation = (w) =>
    Object.values(w.bands).reduce((t, b) => t + Math.round(b.demography.population), 0);

  // A parent genuinely at the planning stage: a named founder count, a band-known destination, and
  // nobody gone anywhere. Everything below starts from this and varies exactly one thing.
  const planned = (over = {}) => {
    const band = {
      ...parent,
      ...(over.band ?? {}),
      demography: { ...parent.demography, splitPressure: over.splitPressure ?? 0.9,
        ...(over.demography ?? {}) },
      ...(over.acuteRisk === undefined ? {} : { acuteRisk: over.acuteRisk }),
      fissionAttempt: {
        phase: over.phase ?? "departure_planned",
        phaseEnteredDay: day0 - 2,
        history: ["proposed"],
        lineageId: over.lineageId ?? "LIN-PREP",
        requestedFounders: over.requestedFounders ?? 8,
        targetTileId: over.targetTileId === null ? undefined : (over.targetTileId ?? wellKnown.id),
      },
    };
    return { ...base, bands: { ...base.bands, [parent.id]: band } };
  };
  const run = (over = {}, policy = {}) => prep.prepareFissionDeparture({
    world: planned(over), parentId: parent.id, today: day0, policy: { ...POLICY, ...policy } });

  const ordinary = run();
  const preparedAttempt = ordinary.ok === true ? ordinary.world.bands[parent.id].fissionAttempt : undefined;
  const prepared = ordinary.ok === true ? ordinary.prepared : undefined;

  // ══ A — ORDINARY PREPARATION ══
  record("A_a_valid_plan_prepares_a_complete_commitment_backed_departure",
    "a coherent parent, a known destination and willing founders produce a final endorsed allocation, a positive commitment on exactly that allocation, a live one-use permit and `departure_ready` — with nobody moving",
    ordinary.ok === true &&
      prepared !== undefined &&
      prepared.allocation.exact === true &&
      prepared.commitment.actorResolution === "aggregate_founder_cohort" &&
      prep.isPreparedDepartureLive(prepared) === true &&
      prep.isPreparedDepartureCoherent(prepared) === true &&
      preparedAttempt.phase === "departure_ready" &&
      commitment.authorizationPermitsDeparture(prepared.authorization, {
        parentBandId: parent.id, lineageId: "LIN-PREP",
        allocation: prepared.allocation, targetTileId: wellKnown.id }) === true,
    true,
    { phase: preparedAttempt?.phase ?? null,
      allocationSuccessor: prepared?.allocation.successor ?? null,
      endorsedFounders: prepared?.endorsedFounders ?? null,
      commitmentId: prepared?.commitment.commitmentId ?? null,
      authorizationStatus: prepared?.authorization.status ?? null,
      evidence: prepared?.commitmentEvidence ?? null });

  // ══ B — THE REVISION HAPPENS BEFORE THE COMMITMENT ══
  //
  // A request large enough that the residual authority insists on fewer founders. What the cohort
  // accepts, and what the permit authorizes, must be the REVISED terms.
  //
  // The request size is SEARCHED rather than guessed. A first form hard-coded one large count and
  // the residual authority simply permitted it, so B and C reported VACUOUS — an honest empty test
  // rather than a false pass. The sweep pairs a narrowed tolerance (heavy prior fragility) with
  // ascending request sizes and takes the first that genuinely produces a downward revision.
  //
  // The fragility is now BUILT ON THE BAND rather than asserted in a context struct. `fragileState`
  // deliberately leaves `mortalityRiskBump` and `movementCautionBump` at zero, because those two are
  // the only acute-risk terms the COMMITMENT reads: a fragile parent must narrow the residual
  // authority's tolerance without also making the founder cohort decline, or the fixture would be
  // measuring the wrong refusal.
  const FRAGILE = { band: fragileState(0.9) };
  const revisionSweep = [];
  let revisedRun; let bigRequest = 0;
  for (let ask = 6; ask <= Math.max(6, parent.demography.workingAdults + 6); ask += 2) {
    const attempt = run({ requestedFounders: ask, ...FRAGILE });
    revisionSweep.push({ requested: ask,
      outcome: attempt.ok === true ? (attempt.founderRequestWasRevisedDownward ? "revised" : "as_requested") : attempt.refusal,
      endorsed: attempt.ok === true ? attempt.prepared.endorsedFounders : null });
    if (attempt.ok === true && attempt.founderRequestWasRevisedDownward === true) {
      revisedRun = attempt; bigRequest = ask; break;
    }
  }
  const revisedPrepared = revisedRun?.ok === true ? revisedRun.prepared : undefined;
  const requestedAllocation = bigRequest > 0
    ? allocation.allocateFounderCohorts(cohortsOf(parent), bigRequest)
    : { ok: false };
  const revisionHappened = revisedRun?.ok === true && revisedRun.founderRequestWasRevisedDownward === true;
  record("B_a_downward_revision_happens_before_commitment_and_binds_the_revised_terms",
    "when the residual authority revises the request downward, the commitment and the permit bind the REVISED endorsed allocation and never the original request",
    revisedRun?.ok === true &&
      revisedPrepared.endorsedFounders < revisedPrepared.requestedFounders &&
      revisedPrepared.commitment.founders.workingAdults === revisedPrepared.allocation.successor.workingAdults &&
      revisedPrepared.commitment.founders.dependents === revisedPrepared.allocation.successor.dependents &&
      revisedPrepared.commitment.founders.elders === revisedPrepared.allocation.successor.elders &&
      prep.isPreparedDepartureCoherent(revisedPrepared) === true &&
      // and the permit refuses the ORIGINAL requested allocation
      (requestedAllocation.ok !== true ||
        commitment.authorizationPermitsDeparture(revisedPrepared.authorization, {
          parentBandId: parent.id, lineageId: "LIN-PREP",
          allocation: requestedAllocation.allocation, targetTileId: wellKnown.id }) === false),
    revisionHappened,
    { requested: revisedPrepared?.requestedFounders ?? null,
      endorsed: revisedPrepared?.endorsedFounders ?? null,
      committedCohort: revisedPrepared?.commitment.founders ?? null,
      originalRequestedCohort: requestedAllocation.ok === true ? requestedAllocation.allocation.successor : null,
      revisionSweep });

  // ══ C — A REVISION THAT CHANGES COMPOSITION, NOT ONLY HEADCOUNT ══
  //
  // The decisive one for §6: a headcount cannot say who leaves. This fixture requires at least one
  // COHORT LINE to differ between the requested and the committed allocation.
  const compositionDiffers =
    revisedPrepared !== undefined && requestedAllocation.ok === true &&
    (requestedAllocation.allocation.successor.workingAdults !== revisedPrepared.commitment.founders.workingAdults ||
      requestedAllocation.allocation.successor.dependents !== revisedPrepared.commitment.founders.dependents ||
      requestedAllocation.allocation.successor.elders !== revisedPrepared.commitment.founders.elders);
  record("C_the_committed_cohort_is_the_revised_composition_not_the_requested_one",
    "the requested and endorsed allocations differ in at least one cohort line, and the stored commitment carries the revised composition — a headcount alone could not distinguish them",
    compositionDiffers &&
      revisedPrepared.commitment.founders.workingAdults === revisedPrepared.allocation.successor.workingAdults &&
      revisedPrepared.commitment.founders.dependents === revisedPrepared.allocation.successor.dependents &&
      revisedPrepared.commitment.founders.elders === revisedPrepared.allocation.successor.elders,
    // Non-vacuous only if a composition difference genuinely exists to test.
    compositionDiffers,
    { requestedComposition: requestedAllocation.ok === true ? requestedAllocation.allocation.successor : null,
      committedComposition: revisedPrepared?.commitment.founders ?? null,
      note: "both allocations exist; the fixture asserts the commitment tracks the endorsed one" });

  // ══ D — RESIDUAL BLOCKED ══
  // A HARD PHYSICAL BLOCK, BUILT ON THE BAND, so the claim "at every permitted size" is exact.
  //
  // Prior fragility alone could not produce this and should not: the residual authority's own
  // guarantee is that a departure changing nothing is never refused however fragile the parent, so a
  // fixture that expected fragility to block would have been asserting the opposite of a property
  // this family deliberately built. What DOES block absolutely is a residual with no labour left at
  // camp — here because the whole workforce is already committed to away parties, which CORRECTION-34C
  // records as a legitimate state. It is invariant to founder count, so the revision search has
  // nothing to find.
  const allAwayBand = { expeditions: [{ id: "audit:committed:1", phase: "operating",
    partyWorkers: parent.demography.workingAdults, nonWorkingPartyPeople: 0 }] };
  const blocked = run({ requestedFounders: 8, band: allAwayBand });
  const blockedWorld = blocked.ok === true ? blocked.world : planned({ requestedFounders: 8 });
  record("D_a_blocked_residual_produces_no_commitment_no_permit_and_no_departure_ready",
    "when the parent residual authority blocks the departure at every permitted size, preparation refuses by name and writes nothing at all",
    blocked.ok === false &&
      blocked.refusal === "residual_authority_blocked_the_departure" &&
      blockedWorld.bands[parent.id].fissionAttempt.preparedDeparture === undefined &&
      blockedWorld.bands[parent.id].fissionAttempt.phase === "departure_planned",
    true,
    { refusal: blocked.ok === false ? blocked.refusal : "PREPARED", detail: blocked.ok === false ? blocked.detail : null,
      phaseAfter: blockedWorld.bands[parent.id].fissionAttempt.phase,
      preparedRecordWritten: blockedWorld.bands[parent.id].fissionAttempt.preparedDeparture !== undefined });

  // ══ E — FOUNDERS DECLINE ══
  const injured = { ...(parent.acuteRisk ?? {}), activeEffect: {
    ...(parent.acuteRisk?.activeEffect ?? {}), mortalityRiskBump: 1, movementCautionBump: 1 } };
  const declined = run({ splitPressure: 0.05 });
  const declinedInjured = run({ splitPressure: 1, acuteRisk: injured });
  record("E_a_physically_feasible_split_the_cohort_declines_produces_no_permit",
    "a departure the residual authority permits but the represented founder cohort does not accept refuses as `founder_cohort_declined`, leaves the attempt at `departure_planned` and creates no permit",
    declined.ok === false && declined.refusal === "founder_cohort_declined" &&
      declinedInjured.ok === false && declinedInjured.refusal === "founder_cohort_declined" &&
      // the SAME departure is accepted under willing evidence, so this is a decision not a blanket refusal
      ordinary.ok === true,
    ordinary.ok === true,
    { weakMotive: declined.ok === false ? { refusal: declined.refusal, reasons: declined.detail } : "PREPARED",
      injured: declinedInjured.ok === false ? { refusal: declinedInjured.refusal } : "PREPARED",
      controlAccepted: ordinary.ok === true });

  // ══ F — NO COMMITMENT WITHOUT A REAL PARENT-SIDE CONSEQUENCE ══
  //
  // Structural rather than behavioural: the writer cannot reach the commitment without having run
  // the residual authority, because the consequence it must pass is derived from that assessment.
  const source = readFileSync("src/sim/agents/fissionDeparturePreparation.ts", "utf8");
  const codeLines = source.split("\n").filter((l) => {
    const t = l.trim();
    return t !== "" && !t.startsWith("*") && !t.startsWith("//") && !t.startsWith("/*");
  }).join("\n");
  const derivesConsequence = /deriveParentSeparationConsequence\(/.test(codeLines);
  const passesIt = /parentSeparationConsequence:\s*consequence/.test(codeLines);
  const fabricates = /commitment:\s*\{/.test(codeLines) || /openDepartureAuthorization\(\s*\{/.test(codeLines);
  record("F_the_writer_cannot_reach_a_commitment_without_a_measured_residual_consequence",
    "the preparation writer derives the parent-separation consequence from the residual assessment and passes it to the real decision authority; it never hand-builds a commitment or a permit",
    derivesConsequence && passesIt && !fabricates &&
      // and the commitment authority itself refuses an unmeasured consequence
      commitment.assessFounderCohortCommitment({
        band: parent, allocation: prepared.allocation, lineageId: "LIN-PREP",
        targetTileId: wellKnown.id, parentSeparationConsequence: undefined, today: day0,
      }).refusal === "parent_separation_consequence_not_measured",
    prepared !== undefined,
    { derivesConsequence, passesConsequenceToDecision: passesIt, fabricatesARecord: fabricates });

  // ══ G — UNKNOWN DESTINATION ══
  const unknownRun = unknownTile === undefined ? undefined : run({ targetTileId: unknownTile });
  const noTargetRun = run({ targetTileId: null });
  record("G_an_unknown_or_absent_destination_produces_no_commitment_and_no_permit",
    "a destination the parent has never observed, and an attempt naming no destination at all, both refuse by name and write nothing",
    (unknownRun === undefined || (unknownRun.ok === false && unknownRun.refusal === "destination_not_known_to_the_band")) &&
      noTargetRun.ok === false && noTargetRun.refusal === "attempt_names_no_target",
    unknownTile !== undefined,
    { unknownDestination: unknownRun === undefined ? "no unknown tile available" : (unknownRun.ok === false ? unknownRun.refusal : "PREPARED"),
      noTargetNamed: noTargetRun.ok === false ? noTargetRun.refusal : "PREPARED" });

  // ══ H — THE EXACT ALLOCATION SURVIVES SERIALIZATION ══
  const roundTripped = prepared === undefined ? undefined : JSON.parse(JSON.stringify(preparedAttempt.preparedDeparture));
  record("H_the_exact_represented_allocation_is_canonical_and_survives_serialization",
    "the prepared record serializes and reloads with the three cohort integers of the allocation that was actually assessed and accepted — a headcount alone would not identify it",
    roundTripped !== undefined &&
      roundTripped.allocation.successor.workingAdults === prepared.allocation.successor.workingAdults &&
      roundTripped.allocation.successor.dependents === prepared.allocation.successor.dependents &&
      roundTripped.allocation.successor.elders === prepared.allocation.successor.elders &&
      roundTripped.commitment.founders.workingAdults === prepared.commitment.founders.workingAdults &&
      roundTripped.commitment.founders.dependents === prepared.commitment.founders.dependents &&
      roundTripped.commitment.founders.elders === prepared.commitment.founders.elders &&
      roundTripped.residualInputFingerprint === prepared.residualInputFingerprint &&
      JSON.stringify(roundTripped) === JSON.stringify(prepared),
    prepared !== undefined,
    { serializedCohort: roundTripped?.allocation.successor ?? null,
      committedCohort: roundTripped?.commitment.founders ?? null,
      byteIdenticalRoundTrip: roundTripped !== undefined && JSON.stringify(roundTripped) === JSON.stringify(prepared) });

  // ══ I — NOBODY MOVED ══
  const beforePop = worldPopulation(base);
  const afterPop = ordinary.ok === true ? worldPopulation(ordinary.world) : -1;
  const parentAfter = ordinary.ok === true ? ordinary.world.bands[parent.id] : undefined;
  const bandCountBefore = Object.keys(base.bands).length;
  const bandCountAfter = ordinary.ok === true ? Object.keys(ordinary.world.bands).length : -1;
  record("I_preparation_moves_no_bodies_and_creates_no_successor",
    "world population, the parent's own cohorts, its position and the number of bands are all unchanged by a successful preparation — the people are packed and still at home",
    ordinary.ok === true &&
      afterPop === beforePop &&
      bandCountAfter === bandCountBefore &&
      parentAfter.demography.population === parent.demography.population &&
      parentAfter.demography.workingAdults === parent.demography.workingAdults &&
      parentAfter.demography.dependents === parent.demography.dependents &&
      parentAfter.demography.elders === parent.demography.elders &&
      String(parentAfter.position) === String(parent.position) &&
      parentAfter.provisionalSuccessor === undefined,
    true,
    { worldPopulation: { before: beforePop, after: afterPop },
      bands: { before: bandCountBefore, after: bandCountAfter },
      parentCohorts: { before: cohortsOf(parent), after: parentAfter === undefined ? null : cohortsOf(parentAfter) },
      successorCreated: parentAfter?.provisionalSuccessor !== undefined });

  // ══ J — DETERMINISM ══
  const repeat = run();
  record("J_identical_canonical_input_produces_an_identical_prepared_state",
    "running preparation twice on the same canonical input yields byte-identical prepared state, the same commitment id and the same permit",
    ordinary.ok === true && repeat.ok === true &&
      JSON.stringify(repeat.prepared) === JSON.stringify(prepared) &&
      repeat.prepared.commitment.commitmentId === prepared.commitment.commitmentId &&
      repeat.prepared.residualInputFingerprint === prepared.residualInputFingerprint,
    prepared !== undefined,
    { commitmentId: prepared?.commitment.commitmentId ?? null,
      identical: ordinary.ok === true && repeat.ok === true && JSON.stringify(repeat.prepared) === JSON.stringify(prepared) });

  // ══ K — BOUNDEDNESS ══
  //
  // Repeated failures write nothing, and repeated successes REPLACE rather than append, so canonical
  // history cannot grow with attempts.
  // Same construction as D — a hard block no founder count can escape — so all forty runs refuse.
  let churn = planned({ band: allAwayBand });
  for (let i = 0; i < 40; i += 1) {
    const failed = prep.prepareFissionDeparture({
      world: churn, parentId: parent.id, today: day0 + i,
      policy: POLICY });
    if (failed.ok === true) churn = failed.world;
  }
  const churnAttempt = churn.bands[parent.id].fissionAttempt;
  let repeatedSuccess = planned();
  for (let i = 0; i < 10; i += 1) {
    const okRun = prep.prepareFissionDeparture({
      world: repeatedSuccess, parentId: parent.id, today: day0, policy: POLICY });
    if (okRun.ok === true) repeatedSuccess = { ...okRun.world,
      bands: { ...okRun.world.bands, [parent.id]: { ...okRun.world.bands[parent.id],
        fissionAttempt: { ...okRun.world.bands[parent.id].fissionAttempt, phase: "departure_planned" } } } };
  }
  const repeatedAttempt = repeatedSuccess.bands[parent.id].fissionAttempt;
  const preparedBytes = JSON.stringify(repeatedAttempt.preparedDeparture ?? {}).length;
  const oneBytes = JSON.stringify(prepared ?? {}).length;
  record("K_repeated_preparation_and_failure_cannot_grow_canonical_state",
    "forty refused preparations write no record at all, and ten successful ones REPLACE a single bounded record rather than appending — the prepared state is one optional field, not a ledger",
    churnAttempt.preparedDeparture === undefined &&
      repeatedAttempt.preparedDeparture !== undefined &&
      preparedBytes <= oneBytes + 8 &&
      repeatedAttempt.history.length <= 64,
    true,
    { refusedRuns: 40, recordAfterRefusals: churnAttempt.preparedDeparture === undefined ? "none" : "written",
      successfulRuns: 10, bytesAfterTenSuccesses: preparedBytes, bytesAfterOne: oneBytes,
      historyLength: repeatedAttempt.history.length });

  // ══ L — STALE TERMS ══
  //
  // The parent changes underneath a prepared departure through a REAL load-bearing input — its own
  // cohorts, which the annual demographic step moves. The fingerprint must notice.
  // `preparedTermsAreStillFresh` now takes the BAND. There is no residual struct to hand it, so a
  // fixture that wants to move the reading has to move a real field on a real band — which is the
  // whole point of the change and why these three arms are now genuine.
  const freshStillMatches = prepared === undefined ? false : prep.preparedTermsAreStillFresh(prepared, parent);
  const agedParent = { ...parent, demography: { ...parent.demography,
    workingAdults: parent.demography.workingAdults - 1, elders: parent.demography.elders + 1 } };
  const staleDetected = prepared === undefined ? false
    : prep.preparedTermsAreStillFresh(prepared, agedParent) === false;
  const awayParent = { ...parent, expeditions: [...(parent.expeditions ?? []),
    { ...(parent.expeditions?.[0] ?? {}), id: "audit:away:1", phase: "operating",
      partyWorkers: 3, nonWorkingPartyPeople: 0 }] };
  const awayChanged = prepared === undefined ? false
    : prep.preparedTermsAreStillFresh(prepared, awayParent) === false;
  record("L_a_parent_that_changes_after_preparation_is_detected_as_stale",
    "the prepared terms verify as fresh against the parent they were assessed on, and as STALE the moment a real load-bearing input moves — cohort composition (annual demography) or bodies away from camp (daily expeditions)",
    freshStillMatches === true && staleDetected === true && awayChanged === true,
    prepared !== undefined,
    { freshAgainstOriginalParent: freshStillMatches,
      staleAfterOneAdultAged: staleDetected,
      staleAfterThreeBodiesLeaveOnAParty: awayChanged,
      fingerprint: prepared?.residualInputFingerprint ?? null,
      note: "cohorts move at the annual demographic step and away bodies daily, so both can change inside DEPARTURE_READY_MAX_DAYS" });

  // ══ M — CHANGED TERMS CANNOT BE SILENTLY AUTHORIZED ══
  const otherTarget = knownTargets[knownTargets.length - 1];
  const biggerAlloc = allocation.allocateFounderCohorts(cohortsOf(parent), (prepared?.endorsedFounders ?? 8) + 2);
  const superseded = ordinary.ok !== true ? undefined : prep.supersedePreparedDeparture(
    ordinary.world, parent.id, "founder_allocation_changed", day0 + 5);
  const supersededRecord = superseded?.ok === true
    ? superseded.world.bands[parent.id].fissionAttempt.preparedDeparture : undefined;
  record("M_changed_founder_terms_or_destination_cannot_reuse_the_old_permit",
    "the live permit refuses a different allocation and a different destination, and superseding it records a named cause and ends its authority over the original terms too",
    prepared !== undefined &&
      (biggerAlloc.ok !== true || commitment.authorizationPermitsDeparture(prepared.authorization, {
        parentBandId: parent.id, lineageId: "LIN-PREP", allocation: biggerAlloc.allocation,
        targetTileId: wellKnown.id }) === false) &&
      commitment.authorizationPermitsDeparture(prepared.authorization, {
        parentBandId: parent.id, lineageId: "LIN-PREP", allocation: prepared.allocation,
        targetTileId: otherTarget.id }) === false &&
      supersededRecord !== undefined &&
      supersededRecord.authorization.status === "superseded_by_revised_terms" &&
      supersededRecord.authorization.endedBecause === "founder_allocation_changed" &&
      prep.isPreparedDepartureLive(supersededRecord) === false &&
      // the historical commitment is untouched
      supersededRecord.commitment.commitmentId === prepared.commitment.commitmentId,
    prepared !== undefined,
    { permitsBiggerAllocation: biggerAlloc.ok === true && prepared !== undefined
        ? commitment.authorizationPermitsDeparture(prepared.authorization, { parentBandId: parent.id,
            lineageId: "LIN-PREP", allocation: biggerAlloc.allocation, targetTileId: wellKnown.id }) : null,
      supersededStatus: supersededRecord?.authorization.status ?? null,
      commitmentUnchanged: supersededRecord?.commitment.commitmentId === prepared?.commitment.commitmentId });

  // ══ N — ABANDONMENT ══
  const abandoned = ordinary.ok !== true ? undefined : prep.abandonPreparedDeparture(ordinary.world, parent.id, day0 + 9);
  const abandonedAttempt = abandoned?.ok === true ? abandoned.world.bands[parent.id].fissionAttempt : undefined;
  const abandonedRecord = abandonedAttempt?.preparedDeparture;
  const popAfterAbandon = abandoned?.ok === true ? worldPopulation(abandoned.world) : -1;
  record("N_abandonment_withdraws_the_permit_keeps_the_commitment_and_moves_nobody",
    "abandoning before departure ends the permit as `withdrawn_before_departure`, leaves the historical commitment intact as provenance, authorizes nothing further, and moves no bodies",
    abandoned?.ok === true &&
      abandonedAttempt.phase === "abandoned" &&
      abandonedRecord !== undefined &&
      abandonedRecord.authorization.status === "withdrawn_before_departure" &&
      abandonedRecord.authorization.endedBecause === "attempt_abandoned_before_departure" &&
      prep.isPreparedDepartureLive(abandonedRecord) === false &&
      commitment.authorizationPermitsDeparture(abandonedRecord.authorization, {
        parentBandId: parent.id, lineageId: "LIN-PREP", allocation: prepared.allocation,
        targetTileId: wellKnown.id }) === false &&
      // the acceptance remains a true historical fact
      abandonedRecord.commitment.commitmentId === prepared.commitment.commitmentId &&
      commitment.commitmentTermsMatchDeparture(abandonedRecord.commitment, {
        parentBandId: parent.id, lineageId: "LIN-PREP", allocation: prepared.allocation,
        targetTileId: wellKnown.id }) === true &&
      popAfterAbandon === beforePop,
    prepared !== undefined,
    { phase: abandonedAttempt?.phase ?? null,
      permitStatus: abandonedRecord?.authorization.status ?? null,
      commitmentStillTrue: abandonedRecord === undefined ? null :
        commitment.commitmentTermsMatchDeparture(abandonedRecord.commitment, { parentBandId: parent.id,
          lineageId: "LIN-PREP", allocation: prepared.allocation, targetTileId: wellKnown.id }),
      worldPopulation: { before: beforePop, afterAbandon: popAfterAbandon } });

  // ══ O — THE KERNEL NOW REQUIRES A COMPLETED PREPARATION ══
  const kernelWithout = kernel.requestTransition({
    current: { phase: "departure_planned", phaseEnteredDay: day0 - 2, history: ["proposed"] },
    to: "departure_ready", today: day0, cause: "elapsed_time" });
  const kernelWith = kernel.requestTransition({
    current: { phase: "departure_planned", phaseEnteredDay: day0 - 2, history: ["proposed"] },
    to: "departure_ready", today: day0, cause: "elapsed_time", preparedDepartureProven: true });
  record("O_departure_ready_is_no_longer_reachable_by_elapsed_time_alone",
    "the kernel refuses `departure_planned -> departure_ready` unless the adapter claims a completed preparation, so the phase now asserts something instead of only naming it",
    kernelWithout.ok === false &&
      kernelWithout.rejection === "departure_ready_without_completed_preparation" &&
      kernelWith.ok === true && kernelWith.state.phase === "departure_ready",
    true,
    { withoutClaim: kernelWithout.ok === false ? kernelWithout.rejection : "ACCEPTED",
      withClaim: kernelWith.ok === true ? kernelWith.state.phase : "REFUSED",
      note: "the departure seam additionally refuses a `departure_ready` record carrying no prepared departure; see the gated-departure audit's fixture A" });

  // ══ P — PRODUCTION REACHABILITY ══
  const natural = ["src/sim/agents/demography.ts", "src/sim/tick/advance.ts",
    "src/sim/rules/bandDecision.ts", "src/sim/runner/simRunner.ts"]
    .map((f) => ({ file: f, mentions: /prepareFissionDeparture|fissionDeparturePreparation/.test(readFileSync(f, "utf8")) }));
  const seamSource = readFileSync("src/sim/agents/fissionDepartureSeam.ts", "utf8");
  // THE SECOND HALF OF THIS FIXTURE IS INVERTED, AND THE INVERSION IS THE POINT.
  //
  // It used to assert that the departure seam does NOT mention the permit or the prepared terms —
  // a truthful record of the gap this family had not yet closed. That gap is closed, so the same
  // assertion now has to say the opposite: the seam MUST consume both, or the old bypass is back.
  // Natural reachability is unchanged and is still asserted to be zero.
  const seamConsumesPreparedTerms =
    /authorizationPermitsDeparture/.test(seamSource) && /preparedDeparture/.test(seamSource);
  const seamStillTakesResidualContext = /residualContext/.test(seamSource);
  record("P_the_preparation_writer_has_no_natural_callers_and_departure_now_requires_it",
    "no demographic, runner, decision or annual-fission path reaches the preparation writer, while `performAtomicDeparture` now consumes the prepared terms and the permit and no longer accepts a caller-supplied residual reading at all",
    natural.every((n) => n.mentions === false) &&
      seamConsumesPreparedTerms === true &&
      seamStillTakesResidualContext === false,
    true,
    { naturalCallers: natural,
      departureSeamConsumesPermitAndPreparedTerms: seamConsumesPreparedTerms,
      departureSeamStillAcceptsCallerResidualContext: seamStillTakesResidualContext,
      statedGap: "the controlled path is truthful; it is NOT natural — nothing in ordinary ecology proposes, prepares or executes a separation" });

  const failing = fixtures.filter((f) => f.verdict === "FAIL");
  const vacuous = fixtures.filter((f) => f.verdict === "VACUOUS");
  out = {
    generatedAt: new Date().toISOString(), seed: SEED, warmDays: WARM_DAYS,
    parentBandId: String(parent.id), wellKnownTarget: String(wellKnown.id),
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
