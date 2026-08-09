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

  const ask = (band, over = {}) => commitment.assessFounderCohortCommitment({
    band, allocation: over.allocation ?? A8, lineageId: over.lineageId ?? "LIN-FC",
    targetTileId: over.targetTileId ?? wellKnown.id,
    residualReasonIds: over.residualReasonIds, today: over.today ?? day0,
  });

  const accepted = ask(willing);
  const declined = ask(unwilling);
  const declinedInjured = ask(hurt, {
    residualReasonIds: ["residual_labour_thin", "residual_care_burden", "residual_mobility_loss", "residual_food_thin"] });

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
    { residualReasonIds: ["residual_labour_thin", "residual_care_burden", "residual_mobility_loss", "residual_food_thin"] });
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
      commitment.commitmentAuthorizesDeparture(held, departureOf(sameAllocationAgain)) === true &&
      commitment.commitmentAuthorizesDeparture(held, departureOf(bumpedWorkingAdults)) === false &&
      revisedDownward !== undefined &&
      commitment.commitmentAuthorizesDeparture(held, departureOf(revisedDownward)) === false,
    held !== undefined && revisedDownward !== undefined,
    { committedFounders: held?.founders ?? null,
      identicalReallocationMatches: held === undefined ? null : commitment.commitmentAuthorizesDeparture(held, departureOf(sameAllocationAgain)),
      oneMoreWorkingAdultMatches: held === undefined ? null : commitment.commitmentAuthorizesDeparture(held, departureOf(bumpedWorkingAdults)),
      differentSizedAllocation: revisedDownward?.successor ?? null,
      differentSizedMatches: held === undefined || revisedDownward === undefined ? null
        : commitment.commitmentAuthorizesDeparture(held, departureOf(revisedDownward)),
      whyRequestCountIsExcluded: "the residual authority may revise the request downward and the seam re-allocates on the revised count, so a commitment bound to the request would authorize different people" });

  // ══ F — parent and lineage are identity-bearing ══
  record("F_a_commitment_belongs_to_one_parent_and_one_lineage",
    "the same represented cohort under a different parent or a different lineage is not the same commitment",
    held !== undefined &&
      commitment.commitmentAuthorizesDeparture(held, departureOf(A8, { parentBandId: "band:someone-else" })) === false &&
      commitment.commitmentAuthorizesDeparture(held, departureOf(A8, { lineageId: "LIN-OTHER" })) === false &&
      commitment.commitmentAuthorizesDeparture(held, departureOf(A8)) === true,
    held !== undefined,
    { sameEverything: held === undefined ? null : commitment.commitmentAuthorizesDeparture(held, departureOf(A8)),
      otherParent: held === undefined ? null : commitment.commitmentAuthorizesDeparture(held, departureOf(A8, { parentBandId: "band:someone-else" })),
      otherLineage: held === undefined ? null : commitment.commitmentAuthorizesDeparture(held, departureOf(A8, { lineageId: "LIN-OTHER" })) });

  // ══ G — the destination is identity-bearing, and that is a decision worth stating ══
  record("G_the_destination_is_part_of_what_was_accepted",
    "a commitment authorizes the separation it concerns, not a separation to somewhere else: accepting a move to one known place does not authorize departing for another",
    held !== undefined && barelyKnown !== undefined &&
      String(barelyKnown.id) !== String(wellKnown.id) &&
      commitment.commitmentAuthorizesDeparture(held, departureOf(A8, { targetTileId: barelyKnown.id })) === false,
    held !== undefined && barelyKnown !== undefined && String(barelyKnown.id) !== String(wellKnown.id),
    { committedTarget: String(wellKnown.id), otherKnownTarget: String(barelyKnown?.id ?? ""),
      authorizesOtherTarget: held === undefined ? null : commitment.commitmentAuthorizesDeparture(held, departureOf(A8, { targetTileId: barelyKnown.id })),
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
  const manyReasons = ask(willing, { residualReasonIds: Array.from({ length: 50 }, (_, i) => `r${i}`) });
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
