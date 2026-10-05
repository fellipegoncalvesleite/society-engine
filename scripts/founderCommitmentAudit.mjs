// ROADMAP ITEM 4 — THE POSITIVE FOUNDER-COHORT COMMITMENT, AND WHAT IT MAY NOT BE READ AS.
//
// The lifecycle carried a phase called `committed` that no production code ever wrote, whose declared
// adapter does not exist, and which the departure seam never checked the path to. These fixtures cover
// the event that replaces it — and, just as importantly, they FAIL if it is later widened into a
// claim the state cannot support: that individuals consented, that a request count is enough to
// authorize a departure, or that a feasible proposal is automatically an accepted one.
//
// The decisive fixture is B. If every feasible proposal committed, this authority would be a ceremony
// wearing a decision's name, which is exactly the defect the whole checkpoint exists to remove.
import { createServer } from "vite";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/dynamic-fission-daughter-viability-37";
const OUT = arg("out", `${EVIDENCE}/founder-commitment.json`);
const SEED = arg("seed", "audit27:natural:s1");
const WARM_DAYS = Number(arg("warm-days", "2100"));

const fixtures = [];
const record = (id, claim, passed, nonVacuous, detail) => {
  fixtures.push({ id, claim, verdict: nonVacuous === false ? "VACUOUS" : passed ? "PASS" : "FAIL", nonVacuous: nonVacuous !== false, detail });
};

const server = await createServer({
  root: `${process.cwd()}/src`, cacheDir: `node_modules/.vite-i4fc-${process.pid}`,
  configFile: false, appType: "custom", server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const commitment = await server.ssrLoadModule("/sim/agents/fissionCommitment.ts");
  const allocation = await server.ssrLoadModule("/sim/agents/fissionFounderAllocation.ts");
  const generate = await server.ssrLoadModule("/sim/world/generate.ts");
  const passability = await server.ssrLoadModule("/sim/world/passability.ts");
  const lc = await server.ssrLoadModule("/sim/agents/bandLifecycle.ts");
  const residual = await server.ssrLoadModule("/sim/agents/fissionParentResidualViability.ts");

  const base = advance.advanceWorldByDays(runner.initSimWorld({ kind: "map2" }, SEED), WARM_DAYS);
  const day0 = Number(base.time.day ?? 0);
  const parent = Object.values(base.bands)
    .filter((b) => lc.isEstablishedBand(b) && b.demography.workingAdults >= 6 && b.demography.population >= 24)
    .sort((a, b) => b.demography.population - a.demography.population)[0];

  // A destination the parent GENUINELY knows, chosen by its own observed record rather than by us.
  const knownTargets = Object.keys(parent.knowledge.observedTiles)
    .filter((id) => String(id) !== String(parent.position))
    .map((id) => ({ id, record: parent.knowledge.observedTiles[id], tile: generate.getTile(base, id) }))
    .filter((e) => e.tile !== undefined && passability.isBandPassableDestination(e.tile))
    .sort((a, b) => (b.record.visits ?? 0) - (a.record.visits ?? 0));
  const wellKnown = knownTargets[0];
  const barelyKnown = knownTargets[knownTargets.length - 1];
  const unknownTile = Object.keys(base.tiles).find((id) => parent.knowledge.observedTiles[id] === undefined);

  const cohortsOf = (band) => ({
    workingAdults: Math.round(band.demography.workingAdults),
    dependents: Math.round(band.demography.dependents),
    elders: Math.round(band.demography.elders),
  });
  const alloc = (founders) => {
    const r = allocation.allocateFounderCohorts(cohortsOf(parent), founders);
    if (r.ok !== true) throw new Error(`allocation refused: ${r.refusal}`);
    return r.allocation;
  };
  const A8 = alloc(8);
  const A10 = alloc(10);

  // A band shaped so its HELD evidence supports acceptance, and one shaped so it does not. Nothing
  // about the physical departure differs between them — same parent, same allocation, same target.
  const withEvidence = (over) => ({
    ...parent,
    demography: { ...parent.demography, ...(over.splitPressure === undefined ? {} : { splitPressure: over.splitPressure }) },
    ...(over.acuteRisk === undefined ? {} : { acuteRisk: over.acuteRisk }),
  });
  const injured = { ...(parent.acuteRisk ?? {}), activeEffect: {
    ...(parent.acuteRisk?.activeEffect ?? {}), mortalityRiskBump: 1, movementCautionBump: 1 } };

  const willing = withEvidence({ splitPressure: 0.9 });
  const unwilling = withEvidence({ splitPressure: 0.05 });
  const hurt = withEvidence({ splitPressure: 0.9, acuteRisk: injured });

  // A commitment decision is now UNCONSTRUCTIBLE without a measured parent-separation consequence,
  // so every arm supplies one. `ask` defaults to the real baseline measurement; the unmeasured case
  // is reached deliberately, by A2, passing `omitConsequence`.
  const ask = (band, over = {}) => commitment.assessFounderCohortCommitment({
    band, allocation: over.allocation ?? A8, lineageId: over.lineageId ?? "LIN-FC",
    targetTileId: over.targetTileId ?? wellKnown.id,
    parentSeparationConsequence: over.omitConsequence === true
      ? undefined
      : (over.parentSeparationConsequence ?? baselineConsequence),
    today: over.today ?? day0,
  });

  // ── the parent-side consequence comes from the authority that owns it ──
  //
  // Every arm below runs the REAL `assessParentResidualWithRevision` and publishes its result
  // through the REAL `deriveParentSeparationConsequence`. Nothing here hand-builds a damage figure,
  // so a change to the residual authority's own arithmetic moves these fixtures with it.
  const residualInput = (over = {}) => ({
    parentBefore: cohortsOf(parent),
    allocation: over.allocation ?? A8,
    physicallyAwayPeople: 0, physicallyAwayWorkers: 0, preparedCommitmentWorkers: 0,
    foodDemographicPressure: over.foodDemographicPressure ?? 0,
    chronicFoodStress: over.chronicFoodStress ?? 0,
    chronicDeficitStreak: over.chronicDeficitStreak ?? 0,
    nutritionMeasured: over.nutritionMeasured ?? true,
    acuteRiskSeverity: over.acuteRiskSeverity ?? 0,
    sicknessBurden: over.sicknessBurden ?? 0,
    careTravelBurden: over.careTravelBurden ?? 0,
    embodiedConditionMeasured: over.embodiedConditionMeasured ?? true,
    ecologicalRisk: over.ecologicalRisk ?? 0,
    ecologicalPositionMeasured: over.ecologicalPositionMeasured ?? true,
    mobilityCapabilityBefore: over.mobilityCapabilityBefore ?? 1,
    mobilityCapabilityAfter: over.mobilityCapabilityAfter ?? 1,
    minimumFounderRequest: over.minimumFounderRequest ?? 2,
  });
  const consequenceOf = (over = {}) => {
    const assessment = residual.assessParentResidualWithRevision(residualInput(over));
    return { assessment, consequence: residual.deriveParentSeparationConsequence(assessment) };
  };
  const baselineConsequence = consequenceOf({}).consequence;

  const accepted = ask(willing);
  const declined = ask(unwilling);
  const declinedInjured = ask(hurt, {
    parentSeparationConsequence: consequenceOf({ mobilityCapabilityAfter: 0.4 }).consequence });

  // ══ A — a positive commitment is constructible and carries its provenance ══
  record("A_a_positive_commitment_is_constructible_with_bounded_provenance",
    "legitimate held evidence and one endorsed allocation produce an acceptance carrying parent, lineage, the represented cohort, the destination and the day",
    accepted.accepted === true &&
      String(accepted.commitment.parentBandId) === String(parent.id) &&
      accepted.commitment.lineageId === "LIN-FC" &&
      String(accepted.commitment.targetTileId) === String(wellKnown.id) &&
      accepted.commitment.decisionDay === day0 &&
      accepted.commitment.founders.workingAdults === A8.successor.workingAdults &&
      accepted.commitment.founders.dependents === A8.successor.dependents &&
      accepted.commitment.founders.elders === A8.successor.elders &&
      accepted.commitment.actorResolution === "aggregate_founder_cohort",
    true,
    { commitment: accepted.accepted === true ? accepted.commitment : null,
      evidence: accepted.evidence, allocationSuccessor: A8.successor });

  // ══ B — NON-ACCEPTANCE IS CONSTRUCTIBLE. Without this the authority is ceremonial. ══
  const sameDeparture =
    declined.accepted === false && declinedInjured.accepted === false &&
    accepted.accepted === true;
  record("B_the_same_feasible_departure_can_be_declined_on_held_evidence",
    "the identical parent, allocation and destination are ACCEPTED under one set of legitimately held evidence and DECLINED under another — so the authority decides rather than authorizes",
    sameDeparture &&
      declined.refusal === "not_willing_on_held_evidence" &&
      declinedInjured.refusal === "not_willing_on_held_evidence",
    // Non-vacuous only because the accepted arm exists: a gate that refuses everything would pass a
    // refusal test and prove nothing.
    accepted.accepted === true,
    { acceptedWillingness: accepted.evidence.willingness,
      declinedWeakMotive: { willingness: declined.evidence.willingness, refusal: declined.accepted === false ? declined.refusal : null, reasons: declined.reasonIds },
      declinedInjured: { willingness: declinedInjured.evidence.willingness, refusal: declinedInjured.accepted === false ? declinedInjured.refusal : null, reasons: declinedInjured.reasonIds },
      threshold: commitment.COMMITMENT_WILLINGNESS_THRESHOLD,
      differsOnlyBy: "the band's own split pressure, embodied burden and what the split costs those who stay — allocation, parent, lineage and target are identical" });

  // ══ C — elapsed time alone cannot commit ══
  const across = [day0, day0 + 90, day0 + 400, day0 + 5000].map((d) => ask(unwilling, { today: d }));
  record("C_elapsed_time_alone_cannot_produce_a_commitment",
    "advancing only the decision day never converts a declined proposal into an accepted one; the day is recorded provenance, not a cause",
    across.every((r) => r.accepted === false),
    across.length > 1,
    { daysTried: [day0, day0 + 90, day0 + 400, day0 + 5000],
      outcomes: across.map((r) => (r.accepted === true ? "accepted" : r.refusal)),
      willingnessAcrossDays: across.map((r) => r.evidence.willingness),
      note: "willingness is identical across every day because no term reads elapsed time" });

  // ══ D — pressure alone is not sufficient ══
  const maxPressureButUnknown = unknownTile === undefined ? undefined
    : ask(withEvidence({ splitPressure: 1 }), { targetTileId: unknownTile });
  const maxPressureButHurt = ask(withEvidence({ splitPressure: 1, acuteRisk: injured }),
    { parentSeparationConsequence: consequenceOf({ mobilityCapabilityAfter: 0.4 }).consequence });
  record("D_extreme_split_pressure_does_not_force_acceptance",
    "split pressure at its ceiling still yields non-acceptance when the destination is unknown to the band or the group is hurt and the separation is costly to those who stay",
    maxPressureButUnknown !== undefined &&
      maxPressureButUnknown.accepted === false &&
      maxPressureButUnknown.refusal === "destination_not_known_to_the_band" &&
      maxPressureButHurt.accepted === false,
    maxPressureButUnknown !== undefined,
    { pressureUsed: 1,
      unknownDestination: maxPressureButUnknown === undefined ? null
        : { refusal: maxPressureButUnknown.refusal, willingness: maxPressureButUnknown.evidence.willingness },
      hurtAndCostly: { refusal: maxPressureButHurt.accepted === false ? maxPressureButHurt.refusal : "ACCEPTED",
        willingness: maxPressureButHurt.evidence.willingness, evidence: maxPressureButHurt.evidence } });

  // ══ E — the binding is to the REPRESENTED ALLOCATION, and the request count is not it ══
  const departureOf = (a, over = {}) => ({
    parentBandId: over.parentBandId ?? parent.id,
    lineageId: over.lineageId ?? "LIN-FC",
    allocation: a,
    targetTileId: over.targetTileId ?? wellKnown.id,
  });
  const held = accepted.accepted === true ? accepted.commitment : undefined;
  const sameAllocationAgain = alloc(8);
  const bumpedWorkingAdults = { ...A8, successor: { ...A8.successor, workingAdults: A8.successor.workingAdults + 1 } };
  // The load-bearing case: the residual authority revised the request DOWNWARD and the seam
  // re-allocated. Same parent, same lineage, same target, different people.
  const revisedDownward = A10.successor.workingAdults !== A8.successor.workingAdults ||
    A10.successor.dependents !== A8.successor.dependents || A10.successor.elders !== A8.successor.elders
    ? A10 : undefined;
  record("E_a_commitment_cannot_authorize_a_different_represented_cohort",
    "the binding compares the endorsed cohort lines: an identical allocation matches, one more working adult does not, and a revised allocation of a different size cannot reuse the commitment",
    held !== undefined &&
      commitment.commitmentTermsMatchDeparture(held, departureOf(sameAllocationAgain)) === true &&
      commitment.commitmentTermsMatchDeparture(held, departureOf(bumpedWorkingAdults)) === false &&
      revisedDownward !== undefined &&
      commitment.commitmentTermsMatchDeparture(held, departureOf(revisedDownward)) === false,
    held !== undefined && revisedDownward !== undefined,
    { committedFounders: held?.founders ?? null,
      identicalReallocationMatches: held === undefined ? null : commitment.commitmentTermsMatchDeparture(held, departureOf(sameAllocationAgain)),
      oneMoreWorkingAdultMatches: held === undefined ? null : commitment.commitmentTermsMatchDeparture(held, departureOf(bumpedWorkingAdults)),
      differentSizedAllocation: revisedDownward?.successor ?? null,
      differentSizedMatches: held === undefined || revisedDownward === undefined ? null
        : commitment.commitmentTermsMatchDeparture(held, departureOf(revisedDownward)),
      whyRequestCountIsExcluded: "the residual authority may revise the request downward and the seam re-allocates on the revised count, so a commitment bound to the request would authorize different people" });

  // ══ F — parent and lineage are identity-bearing ══
  record("F_a_commitment_belongs_to_one_parent_and_one_lineage",
    "the same represented cohort under a different parent or a different lineage is not the same commitment",
    held !== undefined &&
      commitment.commitmentTermsMatchDeparture(held, departureOf(A8, { parentBandId: "band:someone-else" })) === false &&
      commitment.commitmentTermsMatchDeparture(held, departureOf(A8, { lineageId: "LIN-OTHER" })) === false &&
      commitment.commitmentTermsMatchDeparture(held, departureOf(A8)) === true,
    held !== undefined,
    { sameEverything: held === undefined ? null : commitment.commitmentTermsMatchDeparture(held, departureOf(A8)),
      otherParent: held === undefined ? null : commitment.commitmentTermsMatchDeparture(held, departureOf(A8, { parentBandId: "band:someone-else" })),
      otherLineage: held === undefined ? null : commitment.commitmentTermsMatchDeparture(held, departureOf(A8, { lineageId: "LIN-OTHER" })) });

  // ══ G — the destination is identity-bearing, and that is a decision worth stating ══
  record("G_the_destination_is_part_of_what_was_accepted",
    "a commitment authorizes the separation it concerns, not a separation to somewhere else: accepting a move to one known place does not authorize departing for another",
    held !== undefined && barelyKnown !== undefined &&
      String(barelyKnown.id) !== String(wellKnown.id) &&
      commitment.commitmentTermsMatchDeparture(held, departureOf(A8, { targetTileId: barelyKnown.id })) === false,
    held !== undefined && barelyKnown !== undefined && String(barelyKnown.id) !== String(wellKnown.id),
    { committedTarget: String(wellKnown.id), otherKnownTarget: String(barelyKnown?.id ?? ""),
      authorizesOtherTarget: held === undefined ? null : commitment.commitmentTermsMatchDeparture(held, departureOf(A8, { targetTileId: barelyKnown.id })),
      rationale: "a group accepts going SOMEWHERE; the destination is what makes the journey they accepted the one they get" });

  // ══ H — determinism ══
  const repeat = ask(willing);
  const freshObject = ask({ ...willing });
  record("H_identical_input_gives_an_identical_decision_and_identity",
    "the same held evidence produces a byte-identical decision and the same deterministic commitment id, in the same process and on a fresh object",
    JSON.stringify(accepted) === JSON.stringify(repeat) && JSON.stringify(accepted) === JSON.stringify(freshObject),
    accepted.accepted === true,
    { commitmentId: held?.commitmentId ?? null,
      repeatIdentical: JSON.stringify(accepted) === JSON.stringify(repeat),
      freshObjectIdentical: JSON.stringify(accepted) === JSON.stringify(freshObject),
      idIsDeterministicNotRandom: "derived by hashing the bound facts; no UUID and no wall clock" });

  // ══ I — anti-omniscience, structurally and behaviourally ══
  const source = readFileSync("src/sim/agents/fissionCommitment.ts", "utf8");
  // NOT a word ban — the module's own doc says the word while explaining why it takes no world, and
  // the first form of this check failed on that sentence. What matters is whether the type is
  // IMPORTED or used as an annotation, so comment lines are excluded and the remaining code is
  // searched for a real reference.
  const codeLines = source.split("\n").filter((line) => {
    const t = line.trim();
    return t !== "" && !t.startsWith("*") && !t.startsWith("//") && !t.startsWith("/*");
  });
  const worldStateReferences = codeLines.filter((line) => /\bWorldState\b/.test(line));
  const mentionsWorldState = worldStateReferences.length > 0;
  // Change the hidden truth of the destination without touching anything the band holds.
  const richerWorld = (() => {
    const tile = generate.getTile(base, wellKnown.id);
    if (tile === undefined) return undefined;
    return { ...base, tiles: { ...base.tiles, [wellKnown.id]: { ...tile, baseRichness: 1, waterAccess: 1 } } };
  })();
  const decisionUnchangedUnderHiddenChange = richerWorld !== undefined &&
    JSON.stringify(ask(willing)) === JSON.stringify(accepted);
  record("I_the_decision_core_cannot_read_world_truth",
    "the authority takes the actor's own band and no WorldState, so changing hidden destination truth cannot move it — the property is structural rather than tested",
    mentionsWorldState === false && decisionUnchangedUnderHiddenChange,
    true,
    { worldStateReferencesInCode: worldStateReferences, codeLinesSearched: codeLines.length,
      commentProseExcluded: true,
      hiddenRichnessRaisedTo: 1,
      decisionByteIdenticalAfterHiddenChange: decisionUnchangedUnderHiddenChange,
      inputsRead: ["band.demography.splitPressure", "band.knowledge.observedTiles[target]", "band.acuteRisk.activeEffect", "band identity via deriveBandTendencies", "the endorsed allocation", "residual reason ids", "the day"] });

  // ══ J — boundedness ══
  const wideProvenance = { ...consequenceOf({ mobilityCapabilityAfter: 0.4 }).consequence,
    splitCausedReasonIds: Array.from({ length: 50 }, (_, i) => `r${i}`) };
  const manyReasons = ask(willing, { parentSeparationConsequence: wideProvenance });
  const repeatedAttempts = Array.from({ length: 200 }, (_, i) => ask(willing, { today: day0 + i, lineageId: `LIN-${i}` }));
  const maxReasons = Math.max(...repeatedAttempts.map((r) => r.reasonIds.length), manyReasons.reasonIds.length);
  record("J_repeated_decisions_cannot_grow_state_without_bound",
    "reason ids are capped and each decision returns one bounded record; two hundred attempts accumulate nothing",
    maxReasons <= 8 && manyReasons.reasonIds.length <= 8 &&
      repeatedAttempts.every((r) => r.reasonIds.length <= 8),
    repeatedAttempts.length === 200,
    { attemptsRun: repeatedAttempts.length, maxReasonIdsSeen: maxReasons, cap: 8,
      fiftyResidualReasonsProduced: manyReasons.reasonIds.length,
      note: "the authority is pure and returns a value; it holds no accumulator of its own" });

  // ══ K — the representation may not claim individual consent ══
  //
  // Structural rather than a word ban: the binding must remain THREE COHORT INTEGERS. The day someone
  // adds a list of persons, this fails, which is the contract worth protecting — there are no
  // individuals in canonical state and the commitment must not imply otherwise.
  const founderKeys = held === undefined ? [] : Object.keys(held.founders).sort();
  const allIntegers = held !== undefined && Object.values(held.founders).every((v) => Number.isInteger(v));
  record("K_the_commitment_represents_a_cohort_and_never_named_individuals",
    "the binding is exactly the three cohort integers and the actor resolution says so; no per-person identity is represented, because none exists in canonical state",
    held !== undefined &&
      JSON.stringify(founderKeys) === JSON.stringify(["dependents", "elders", "workingAdults"]) &&
      allIntegers &&
      Object.values(held.founders).every((v) => !Array.isArray(v)) &&
      held.actorResolution === "aggregate_founder_cohort",
    held !== undefined,
    { founderBindingKeys: founderKeys, allValuesAreIntegers: allIntegers,
      actorResolution: held?.actorResolution ?? null,
      protects: "if a future change adds founder ids or a person list to the binding, this fixture fails rather than quietly upgrading the claim" });

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // L-O — THE COMMITMENT'S SEPARATION COST IS A MEASURED MAGNITUDE, NOT A COUNT OF EXPLANATIONS
  //
  // The corrected input reads `limiting.splitCausedDamage`. These four fixtures prove that the four
  // things which are NOT split-caused damage — supporting evidence, prior fragility, uncertainty and
  // sheer verbosity — cannot reach the willingness figure. Each holds everything else identical.
  // ══════════════════════════════════════════════════════════════════════════════════════════════

  // ══ L — SUPPORTING REASONS CANNOT RAISE THE COST ══
  //
  // The decisive one. Two assessments of the SAME departure: one where every channel is measured and
  // healthy (so the authority emits supporting reasons — good news), one where the same channels are
  // simply UNMEASURED (so it emits none, and an uncertainty reason instead). Under the old model the
  // healthy parent scored the HIGHER cost, purely for having more to say about itself.
  const richlySupported = consequenceOf({});
  const unmeasured = consequenceOf({
    nutritionMeasured: false, embodiedConditionMeasured: false, ecologicalPositionMeasured: false });
  const supportCount = richlySupported.assessment.supporting.length;
  const askSupported = ask(willing, { parentSeparationConsequence: richlySupported.consequence });
  const askUnmeasured = ask(willing, { parentSeparationConsequence: unmeasured.consequence });
  const reasonCountsDiffer =
    richlySupported.assessment.reasonIds.length !== unmeasured.assessment.reasonIds.length;
  record("L_supporting_reasons_cannot_increase_the_separation_cost",
    "two assessments of the identical departure, one emitting supporting reasons and one emitting none, publish the SAME split-caused damage and produce the SAME willingness — good news about the parent is not a cost",
    richlySupported.consequence.splitCausedDamage === unmeasured.consequence.splitCausedDamage &&
      askSupported.evidence.splitCausedDamage === askUnmeasured.evidence.splitCausedDamage &&
      askSupported.evidence.willingness === askUnmeasured.evidence.willingness &&
      askSupported.accepted === askUnmeasured.accepted &&
      // and the supporting reasons really are inside the authority's own reasonIds list, which is
      // exactly why counting that list was false.
      richlySupported.assessment.reasonIds.length >= supportCount && supportCount > 0,
    // Non-vacuous only if the two arms genuinely differ in how much they say.
    reasonCountsDiffer,
    { supportingReasonsEmitted: richlySupported.assessment.supporting.map((r) => r.id),
      reasonIdCounts: { measuredHealthy: richlySupported.assessment.reasonIds.length,
        unmeasured: unmeasured.assessment.reasonIds.length },
      splitCausedDamage: { measuredHealthy: richlySupported.consequence.splitCausedDamage,
        unmeasured: unmeasured.consequence.splitCausedDamage },
      willingness: { measuredHealthy: askSupported.evidence.willingness,
        unmeasured: askUnmeasured.evidence.willingness },
      wouldHaveBeenUnderTheOldModel: {
        measuredHealthy: Math.min(1, richlySupported.assessment.reasonIds.length / 4),
        unmeasured: Math.min(1, unmeasured.assessment.reasonIds.length / 4),
        // The sharpest form of the defect: the SUPPORTING reasons alone — every one of them good
        // news about the parent — would have produced this much cost, out of a maximum of 1.
        costTheSupportingReasonsAloneWouldHaveProduced: Math.min(1, supportCount / 4) },
      note: "reasonIds is [...opposing, ...supporting] across six ledgers, so a count charged support as cost" });

  // ══ M — PRIOR FRAGILITY IS NOT SPLIT-CAUSED COST ══
  //
  // Identical departure, identical mobility before and after, identical allocation: only the
  // hardship the parent ALREADY carried differs. The residual authority narrows its own tolerance on
  // that fragility — its business — but the magnitude the commitment consumes may not move, because
  // a departure does not become more damaging by happening to a parent that was already suffering.
  //
  // AN INSTRUMENT ERROR IN THIS FIXTURE'S OWN FIRST FORM IS RECORDED. It varied fragility at
  // `mobilityCapabilityAfter: 0.7`, where the damage is 0.27. Heavy fragility narrows the residual
  // authority's tolerance to 0.23, so that arm was REFUSED and `assessParentResidualWithRevision`
  // revised the founder request downward — leaving the fragile arm describing a SMALLER departure
  // with damage 0.20 and, absurdly, a HIGHER willingness (0.8903 against 0.8693). The two arms were
  // no longer the same separation. That is verbatim the trap PR10/PR11 recorded on this same
  // authority. The `noRevisionEitherArm` assertion below is what refused to let it pass, and the
  // repair is to hold the departure inside both tolerances rather than to relax the assertion.
  const fedParent = consequenceOf({});
  const fragileParent = consequenceOf({
    foodDemographicPressure: 0.9, chronicFoodStress: 0.9, chronicDeficitStreak: 8,
    acuteRiskSeverity: 0.9, sicknessBurden: 0.9, careTravelBurden: 0.9, ecologicalRisk: 0.9 });
  const askFed = ask(willing, { parentSeparationConsequence: fedParent.consequence });
  const askFragile = ask(willing, { parentSeparationConsequence: fragileParent.consequence });
  const fragilityMoved =
    fragileParent.assessment.limiting.priorFragility > fedParent.assessment.limiting.priorFragility;
  const noRevisionEitherArm =
    fedParent.assessment.requiresFounderRequestRevision === false &&
    fragileParent.assessment.requiresFounderRequestRevision === false;
  record("M_prior_fragility_does_not_enter_the_commitments_separation_cost",
    "a parent already carrying heavy nutritional, embodied and ecological hardship publishes the SAME split-caused damage for the SAME departure as a well-fed one, and the commitment's willingness is identical",
    fedParent.consequence.splitCausedDamage === fragileParent.consequence.splitCausedDamage &&
      askFed.evidence.splitCausedDamage === askFragile.evidence.splitCausedDamage &&
      askFed.evidence.willingness === askFragile.evidence.willingness &&
      noRevisionEitherArm,
    // Non-vacuous only if the fragility arm really is more fragile.
    fragilityMoved,
    { priorFragility: { fed: fedParent.assessment.limiting.priorFragility,
        fragile: fragileParent.assessment.limiting.priorFragility },
      tolerance: { fed: fedParent.assessment.limiting.tolerance,
        fragile: fragileParent.assessment.limiting.tolerance },
      splitCausedDamage: { fed: fedParent.consequence.splitCausedDamage,
        fragile: fragileParent.consequence.splitCausedDamage },
      willingness: { fed: askFed.evidence.willingness, fragile: askFragile.evidence.willingness },
      neitherArmWasRevised: noRevisionEitherArm,
      instrumentErrorRecorded: "the first form varied fragility at damage 0.27, which the fragile arm's narrowed tolerance (0.23) refused; the revision search then shrank the request and the arms stopped describing the same departure",
      note: "tolerance narrows with fragility inside the residual authority — which is why the commitment consumes the DAMAGE and not the verdict" });

  // ══ N — REAL SPLIT-CAUSED DAMAGE DOES MOVE THE DECISION ══
  //
  // The other half of L and M: having proved what cannot reach willingness, prove that the thing
  // which should, does. Same band, same motive, same readiness, same allocation and target — only
  // the mobility the parent is left with after the split differs, which is a genuine before→after
  // movement.
  const damageLadder = [1, 0.8, 0.55, 0.3].map((after) => {
    const c = consequenceOf({ mobilityCapabilityAfter: after });
    return { after, damage: c.consequence.splitCausedDamage,
      willingness: ask(willing, { parentSeparationConsequence: c.consequence }).evidence.willingness };
  });
  const damageRises = damageLadder.every((row, i) => i === 0 || row.damage >= damageLadder[i - 1].damage);
  const willingnessFalls = damageLadder.every((row, i) => i === 0 || row.willingness <= damageLadder[i - 1].willingness);
  record("N_real_split_caused_damage_moves_willingness_in_the_intended_direction",
    "holding motive, readiness, allocation and destination constant, rising measured split-caused damage produces monotonically falling willingness",
    damageRises && willingnessFalls &&
      damageLadder[damageLadder.length - 1].willingness < damageLadder[0].willingness,
    // Non-vacuous only if the damage figure actually moved across the ladder.
    damageLadder[damageLadder.length - 1].damage > damageLadder[0].damage,
    { ladder: damageLadder,
      note: "the only varied input is mobilityCapabilityAfter — a before→after movement, which is exactly what splitCausedDamage is made of" });

  // ══ O — REASON VERBOSITY CANNOT CHANGE BEHAVIOUR ══
  //
  // The same physical assessment, with its provenance list duplicated, reordered and padded. Under a
  // count-based cost every one of these arms would decide differently.
  const plain = consequenceOf({ mobilityCapabilityAfter: 0.5 }).consequence;
  const verbose = [
    { label: "as_published", c: plain },
    { label: "reordered", c: { ...plain, splitCausedReasonIds: [...plain.splitCausedReasonIds].reverse() } },
    { label: "duplicated", c: { ...plain, splitCausedReasonIds: [...plain.splitCausedReasonIds, ...plain.splitCausedReasonIds] } },
    { label: "padded_to_forty", c: { ...plain, splitCausedReasonIds: [...plain.splitCausedReasonIds, ...Array.from({ length: 40 }, (_, i) => `pad_${i}`)] } },
    { label: "emptied", c: { ...plain, splitCausedReasonIds: [] } },
  ].map((arm) => {
    const r = ask(willing, { parentSeparationConsequence: arm.c });
    return { label: arm.label, ids: arm.c.splitCausedReasonIds.length, accepted: r.accepted,
      willingness: r.evidence.willingness, splitCausedDamage: r.evidence.splitCausedDamage,
      commitmentId: r.accepted === true ? r.commitment.commitmentId : null };
  });
  const first = verbose[0];
  record("O_reason_verbosity_cannot_change_the_commitment",
    "duplicating, reordering, padding or emptying the provenance list while the measured assessment is unchanged leaves the decision, the willingness and the commitment identity identical",
    verbose.every((v) => v.accepted === first.accepted && v.willingness === first.willingness &&
      v.splitCausedDamage === first.splitCausedDamage && v.commitmentId === first.commitmentId),
    // Non-vacuous only if the arms really did carry different numbers of ids.
    new Set(verbose.map((v) => v.ids)).size > 1,
    { arms: verbose,
      note: "provenance is carried onto the accepted record as evidence; it is never read as a magnitude" });

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // P-V — HISTORICAL COMMITMENT vs LIVE AUTHORIZATION
  //
  // The event says a cohort once agreed. The authorization says whether that agreement is still in
  // force. These fixtures prove the two can be true and false at the same time.
  // ══════════════════════════════════════════════════════════════════════════════════════════════

  const authTerms = (allocation, over = {}) => departureOf(allocation, over);
  const liveAuth = held === undefined ? undefined : commitment.openDepartureAuthorization(held);

  // ══ P — a positive commitment opens exactly one live authorization on the accepted terms ══
  record("P_a_positive_commitment_opens_one_live_authorization_on_the_accepted_terms",
    "opening an authorization from the commitment yields exactly one live record carrying the same commitmentId, parent, lineage, cohort and destination, and it permits the departure it was accepted for",
    liveAuth !== undefined &&
      liveAuth.status === "live" &&
      commitment.authorizationIsLive(liveAuth) === true &&
      liveAuth.commitmentId === held.commitmentId &&
      String(liveAuth.parentBandId) === String(held.parentBandId) &&
      liveAuth.lineageId === held.lineageId &&
      String(liveAuth.targetTileId) === String(held.targetTileId) &&
      commitment.foundersMatch(liveAuth.founders, held.founders) &&
      liveAuth.openedDay === held.decisionDay &&
      liveAuth.endedDay === undefined && liveAuth.endedBecause === undefined &&
      commitment.authorizationPermitsDeparture(liveAuth, authTerms(A8)) === true,
    held !== undefined,
    { authorization: liveAuth ?? null, commitmentId: held?.commitmentId ?? null });

  // ══ Q — changed terms invalidate it, without anything having to be ended ══
  const qAlloc = commitment.authorizationPermitsDeparture(liveAuth, authTerms(A10));
  const qTarget = commitment.authorizationPermitsDeparture(liveAuth, authTerms(A8, { targetTileId: barelyKnown.id }));
  const qSupersededAlloc = commitment.endDepartureAuthorization(liveAuth, "founder_allocation_changed", day0 + 3);
  const qSupersededTarget = commitment.endDepartureAuthorization(liveAuth, "destination_changed", day0 + 3);
  record("Q_changed_founder_allocation_or_destination_invalidates_the_authorization",
    "a live authorization refuses a departure by a different represented cohort or to a different destination, and both changes can be recorded explicitly as superseded terms with a named cause",
    qAlloc === false && qTarget === false &&
      commitment.authorizationPermitsDeparture(liveAuth, authTerms(A8)) === true &&
      qSupersededAlloc?.status === "superseded_by_revised_terms" &&
      qSupersededAlloc?.endedBecause === "founder_allocation_changed" &&
      qSupersededTarget?.status === "superseded_by_revised_terms" &&
      qSupersededTarget?.endedBecause === "destination_changed" &&
      commitment.authorizationPermitsDeparture(qSupersededAlloc, authTerms(A8)) === false,
    liveAuth !== undefined,
    { permitsOriginalTerms: commitment.authorizationPermitsDeparture(liveAuth, authTerms(A8)),
      permitsRevisedAllocation: qAlloc, permitsOtherDestination: qTarget,
      supersededByAllocation: qSupersededAlloc ?? null, supersededByTarget: qSupersededTarget ?? null });

  // ══ R — abandoning before departure ends the authority and leaves the history intact ══
  const historyBefore = JSON.stringify(held ?? null);
  const withdrawn = commitment.endDepartureAuthorization(liveAuth, "attempt_abandoned_before_departure", day0 + 10);
  const historyAfter = JSON.stringify(held ?? null);
  record("R_abandoning_before_departure_ends_the_authority_and_leaves_the_commitment_true",
    "withdrawal ends the authorization with its own named cause and day, no longer permits any departure, and does not touch the historical event",
    withdrawn?.status === "withdrawn_before_departure" &&
      withdrawn?.endedBecause === "attempt_abandoned_before_departure" &&
      withdrawn?.endedDay === day0 + 10 &&
      commitment.authorizationIsLive(withdrawn) === false &&
      commitment.authorizationPermitsDeparture(withdrawn, authTerms(A8)) === false &&
      // the event is untouched and STILL TRUE about the past
      historyBefore === historyAfter &&
      commitment.commitmentTermsMatchDeparture(held, authTerms(A8)) === true,
    liveAuth !== undefined,
    { withdrawn: withdrawn ?? null,
      historicalEventUnchanged: historyBefore === historyAfter,
      eventStillDescribesTheseTerms: held === undefined ? null : commitment.commitmentTermsMatchDeparture(held, authTerms(A8)) });

  // ══ S — a physical departure consumes it exactly once ══
  const consumed = commitment.endDepartureAuthorization(liveAuth, "physical_departure_consumed_it", day0 + 20);
  const secondDeparture = consumed === undefined
    ? undefined
    : commitment.endDepartureAuthorization(consumed, "physical_departure_consumed_it", day0 + 21);
  record("S_a_spent_authorization_cannot_authorize_a_second_physical_departure",
    "consumption is terminal: the authorization no longer permits a departure, a second consumption is REFUSED rather than recorded, and the commitment survives as successor provenance",
    consumed?.status === "consumed_by_departure" &&
      consumed?.endedBecause === "physical_departure_consumed_it" &&
      commitment.authorizationPermitsDeparture(consumed, authTerms(A8)) === false &&
      secondDeparture === undefined &&
      commitment.commitmentTermsMatchDeparture(held, authTerms(A8)) === true,
    liveAuth !== undefined,
    { consumed: consumed ?? null, secondConsumptionRefused: secondDeparture === undefined,
      commitmentStillAvailableAsProvenance: held?.commitmentId ?? null });

  // ══ T — A RETURN DOES NOT TOUCH THIS RECORD, AND THE COMMITMENT IS NOT A STABILIZATION GATE ══
  //
  // The removed `ended_by_return` was unreachable: endings act only on a `live` record and
  // `consumed_by_departure` is terminal, so the only path to it was a return by a group that never
  // left. A return is a fact about the SUCCESSOR, and the successor lifecycle already carries it.
  const kernelSource = readFileSync("src/sim/agents/fissionLifecycleKernel.ts", "utf8");
  const returnPhases = [
    "returning",
    "unresolved_after_failed_return",
    "continuing_after_failed_return",
    "reintegrated",
    "established_after_failed_return",
  ];
  const phasesExist = returnPhases.every((ph) => kernelSource.includes(`| "${ph}"`));
  const consumedThenReturn = consumed === undefined
    ? undefined
    : commitment.endDepartureAuthorization(consumed, "physical_departure_consumed_it", day0 + 400);
  // Reuses fixture I's comment-stripped view of the module: a word ban that matched documentation
  // would fail on the paragraph EXPLAINING the removal, which is the trap I was rebuilt to avoid.
  const noReturnCause = !/successor_physically_returned/.test(codeLines) && !/ended_by_return/.test(codeLines);
  record("T_a_return_is_a_successor_lifecycle_fact_and_never_edits_the_departure_permit",
    "the permit carries no return cause and cannot be transitioned after departure consumed it; a return is recorded by the successor's own physical lifecycle, and the historical commitment stays true without ever becoming a stabilization gate",
    phasesExist && noReturnCause &&
      consumedThenReturn === undefined &&
      // the acceptance is still a true statement about the past...
      commitment.commitmentTermsMatchDeparture(held, authTerms(A8)) === true &&
      // ...which is exactly why it may not stand in for "still separated": it says the same thing
      // for a group that departed, gave up and walked home.
      commitment.authorizationPermitsDeparture(consumed, authTerms(A8)) === false,
    held !== undefined,
    { successorReturnPhasesPresentInKernel: returnPhases.filter((ph) => kernelSource.includes(`| "${ph}"`)),
      permitHasNoReturnCause: noReturnCause,
      anyTransitionAfterConsumption: consumedThenReturn === undefined ? "refused" : "accepted",
      historicalCommitmentStillTrue: held === undefined ? null : commitment.commitmentTermsMatchDeparture(held, authTerms(A8)),
      whatStabilizationMustInspectInstead: [
        "a positive commitment exists, by commitmentId",
        "its departure authorization reached consumed_by_departure",
        "the successor's monotonic separation course has never entered the return path",
        "the successor's lived physical evidence supports establishment (NOT BUILT)",
      ] });

  // ══ U — no implicit recommitment: nothing revives a terminal authorization ══
  //
  // Elapsed time and survival must not be able to restore a separation authority nobody re-accepted.
  // Structural rather than tested case by case: there is no reopen function, and every ending of an
  // already-terminal record is refused.
  const terminalArms = ["withdrawn_before_departure", "consumed_by_departure", "superseded_by_revised_terms"]
    .map((status) => ({ ...liveAuth, status, endedDay: day0 + 1, endedBecause: "attempt_abandoned_before_departure" }));
  const everyCause = ["founder_allocation_changed", "destination_changed",
    "attempt_abandoned_before_departure", "physical_departure_consumed_it"];
  const revivalAttempts = terminalArms.flatMap((auth) =>
    everyCause.flatMap((cause) => [day0 + 2, day0 + 900, day0 + 90000].map((d) => ({
      from: auth.status, cause, day: d,
      result: commitment.endDepartureAuthorization(auth, cause, d) === undefined ? "refused" : "accepted",
      permits: commitment.authorizationPermitsDeparture(auth, authTerms(A8)) }))));
  const reopenExports = Object.keys(commitment).filter((k) => /reopen|revive|restore|reactivat/i.test(k));
  record("U_time_or_survival_cannot_reactivate_a_terminal_authorization",
    "every ending of an already-terminal authorization is refused at every cause and every elapsed day, none permits a departure, and the module exports no way to reopen one — a new separation needs a new commitment",
    revivalAttempts.every((a) => a.result === "refused" && a.permits === false) &&
      reopenExports.length === 0,
    revivalAttempts.length === 36,
    { attemptsRun: revivalAttempts.length, allRefused: revivalAttempts.every((a) => a.result === "refused"),
      anyPermittedDeparture: revivalAttempts.some((a) => a.permits === true),
      reopenLikeExports: reopenExports,
      daysTried: [day0 + 2, day0 + 900, day0 + 90000] });

  // ══ V — the four facts stay four: the event carries no lifecycle status ══
  const eventKeys = held === undefined ? [] : Object.keys(held).sort();
  const statusLike = eventKeys.filter((k) => /status|phase|active|live|withdraw|consum|revok/i.test(k));
  const authKeys = liveAuth === undefined ? [] : Object.keys(liveAuth).sort();
  record("V_the_immutable_event_carries_no_status_and_the_authorization_is_a_separate_record",
    "the commitment record has no status, phase or liveness field of any kind; current authority lives in a separate record that references it by commitmentId — so a status can end without history being edited",
    held !== undefined && liveAuth !== undefined &&
      statusLike.length === 0 &&
      authKeys.includes("status") &&
      authKeys.includes("commitmentId") &&
      liveAuth.commitmentId === held.commitmentId,
    held !== undefined,
    { commitmentFields: eventKeys, statusLikeFieldsOnTheEvent: statusLike,
      authorizationFields: authKeys,
      protects: "if a future change puts a mutable status on the commitment, this fails — that collapse is the `committed` defect this checkpoint removed" });

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // W-X — UNKNOWN IS NOT ZERO
  //
  // The decision previously read `consequence?.splitCausedDamage ?? 0` while documenting that an
  // absent consequence means the residual authority has not run. "Nobody looked at what this does to
  // the parent" resolved into the single most permissive answer available.
  // ══════════════════════════════════════════════════════════════════════════════════════════════

  // ══ W (A1) — A MEASURED ZERO IS USABLE AS A MEASURED ZERO ══
  //
  // Also reports whether the residual authority can produce one at all. It cannot for any non-empty
  // allocation — every real departure removes some camp labour — which is what made the old `?? 0`
  // especially wrong: it substituted a value the measuring authority never emits.
  const measuredZero = { source: "parent_residual_authority", splitCausedDamage: 0, splitCausedReasonIds: [] };
  const zeroArm = ask(willing, { parentSeparationConsequence: measuredZero });
  const naturalDamages = [];
  for (let founders = 2; founders <= 12; founders += 1) {
    const r = allocation.allocateFounderCohorts(cohortsOf(parent), founders);
    if (r.ok !== true) continue;
    naturalDamages.push({ founders,
      damage: consequenceOf({ allocation: r.allocation }).consequence.splitCausedDamage });
  }
  const smallestNaturalDamage = Math.min(...naturalDamages.map((d) => d.damage));
  const expectedZeroWillingness = Number(
    (Math.min(1, Math.max(0, Math.min(1, Math.max(0, zeroArm.evidence.motive * zeroArm.evidence.readiness)) + zeroArm.evidence.tendencyDelta))).toFixed(4));
  record("W_a_measured_zero_is_used_as_a_measured_zero",
    "a genuine consequence measuring zero split-caused damage is consumed as zero cost — willingness is exactly motive x readiness plus disposition, with nothing subtracted",
    zeroArm.accepted === true &&
      zeroArm.evidence.splitCausedDamage === 0 &&
      Math.abs(zeroArm.evidence.willingness - expectedZeroWillingness) < 1e-9,
    naturalDamages.length > 0,
    { willingnessAtMeasuredZero: zeroArm.evidence.willingness,
      expectedFromMotiveTimesReadiness: expectedZeroWillingness,
      naturalDamageByFounderCount: naturalDamages,
      smallestDamageTheAuthorityCanProduce: smallestNaturalDamage,
      finding: smallestNaturalDamage > 0
        ? "the residual authority never emits zero for a non-empty allocation — every real departure removes camp labour — so the old `?? 0` substituted a value the measuring authority cannot produce"
        : "a genuine zero is producible naturally" });

  // ══ X (A2) — NOT MEASURED IS NOT BEHAVIOURALLY EQUIVALENT TO MEASURED ZERO ══
  //
  // The decisive fixture for defect A. TypeScript makes the omission unconstructible; this asserts
  // the runtime half, for the untyped callers TypeScript never sees.
  const unmeasuredArm = ask(willing, { omitConsequence: true });
  const malformedArms = [
    { label: "NaN", c: { source: "parent_residual_authority", splitCausedDamage: Number.NaN, splitCausedReasonIds: [] } },
    { label: "above_one", c: { source: "parent_residual_authority", splitCausedDamage: 1.7, splitCausedReasonIds: [] } },
    { label: "negative", c: { source: "parent_residual_authority", splitCausedDamage: -0.4, splitCausedReasonIds: [] } },
    { label: "infinite", c: { source: "parent_residual_authority", splitCausedDamage: Number.POSITIVE_INFINITY, splitCausedReasonIds: [] } },
  ].map((arm) => ({ label: arm.label, result: ask(willing, { parentSeparationConsequence: arm.c }) }));
  const requiredInType = /readonly parentSeparationConsequence: ParentSeparationConsequence;/.test(source);
  record("X_an_unmeasured_consequence_is_refused_and_never_read_as_zero",
    "omitting the parent-separation consequence produces the named refusal `parent_separation_consequence_not_measured` rather than a decision, publishes no willingness and no damage figure, and is therefore not interchangeable with the measured zero of fixture W; malformed magnitudes are refused rather than clamped into plausibility",
    unmeasuredArm.accepted === false &&
      unmeasuredArm.refusal === "parent_separation_consequence_not_measured" &&
      unmeasuredArm.evidence.splitCausedDamage === "not_measured" &&
      unmeasuredArm.evidence.willingness === "not_measured" &&
      unmeasuredArm.reasonIds.includes("parent_separation_consequence_absent") &&
      // not equivalent to A1's measured zero, which ACCEPTED
      zeroArm.accepted === true &&
      // and no laundering: an impossible magnitude is refused, not clamped
      malformedArms.every((a) => a.result.accepted === false &&
        a.result.refusal === "parent_separation_consequence_not_measured" &&
        a.result.evidence.splitCausedDamage === "not_measured") &&
      requiredInType,
    // Non-vacuous only because the measured-zero arm exists and decides.
    zeroArm.accepted === true,
    { unmeasured: { accepted: unmeasuredArm.accepted, refusal: unmeasuredArm.refusal,
        publishedDamage: unmeasuredArm.evidence.splitCausedDamage,
        publishedWillingness: unmeasuredArm.evidence.willingness, reasons: unmeasuredArm.reasonIds },
      measuredZero: { accepted: zeroArm.accepted, publishedDamage: zeroArm.evidence.splitCausedDamage,
        publishedWillingness: zeroArm.evidence.willingness },
      malformed: malformedArms.map((a) => ({ label: a.label, refusal: a.result.refusal,
        publishedDamage: a.result.evidence.splitCausedDamage, reasons: a.result.reasonIds })),
      requiredInTypeSignature: requiredInType });

  // ══ Y (B9) — EVERY ADVERTISED STATUS HAS A WRITER; NO IMPOSSIBLE MEMBER IS ADVERTISED ══
  //
  // The removed `ended_by_return` was reachable only from `live`, i.e. only by a group returning
  // from a departure that never happened. A status a caller can read about but never reach is a
  // claim the system cannot honour, so this fixture derives reachability from production itself.
  const declaredStatuses = (source.match(/export type DepartureAuthorizationStatus =([\s\S]*?);/) ?? ["", ""])[1]
    .match(/"([a-z_]+)"/g)?.map((q) => q.replace(/"/g, "")) ?? [];
  const declaredCauses = (source.match(/export type DepartureAuthorizationEndCause =([\s\S]*?);/) ?? ["", ""])[1]
    .match(/"([a-z_]+)"/g)?.map((q) => q.replace(/"/g, "")) ?? [];
  const reachable = new Set(["live"]);            // produced by openDepartureAuthorization
  const causeProducts = {};
  for (const cause of declaredCauses) {
    const ended = commitment.endDepartureAuthorization(liveAuth, cause, day0 + 1);
    if (ended !== undefined) { reachable.add(ended.status); causeProducts[cause] = ended.status; }
  }
  const unreachable = declaredStatuses.filter((st) => !reachable.has(st));
  const causesWithNoProduct = declaredCauses.filter((c) => causeProducts[c] === undefined);
  record("Y_every_advertised_authorization_status_is_reachable_from_production",
    "each declared status is produced either by opening a permit or by a declared end cause acting on a live permit, and each declared cause produces one — no status is advertised that the lifecycle cannot reach",
    declaredStatuses.length > 0 && declaredCauses.length > 0 &&
      unreachable.length === 0 && causesWithNoProduct.length === 0 &&
      // and the removed member is genuinely gone from the declaration
      !declaredStatuses.includes("ended_by_return"),
    declaredStatuses.length >= 3,
    { declaredStatuses, declaredCauses, causeProducts,
      reachable: [...reachable].sort(), unreachableStatuses: unreachable,
      causesProducingNothing: causesWithNoProduct,
      removedBecauseUnreachable: "ended_by_return — endings act only on a live permit and consumed_by_departure is terminal, so its only path was a return by a group that never left" });

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
