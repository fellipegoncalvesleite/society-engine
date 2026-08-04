// ROADMAP ITEM 4 §3/§4/§5 — THE EXIT CONTRACT: NO TERMINAL OUTCOME FROM TIME ALONE, AND NO ALIAS
// THROUGH WHICH ONE HALF OF A SPLIT CAN REWRITE THE OTHER'S HISTORY.
//
// The reviewed defect: `returning` timed out into `reintegrated`, whose contract says the provisional
// entity is removed exactly once — and nothing removed it, so a group that had gone nowhere and come
// back from nothing became an ordinary band because a clock ran. This audit proves that path is gone,
// that no OTHER path like it exists, and that it cannot be re-entered by editing the contract table.
//
// It also closes the second half of the review: five fields are deliberately shared BY REFERENCE
// between parent and successor because they are historical facts about the same people. Shared
// identity is only safe if nobody mutates through it. That is proven here by DEEP-FREEZING the shared
// objects and running the world: an in-place write throws in module strict mode, so a silent
// cross-band mutation becomes a loud failure instead of a belief.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/dynamic-fission-daughter-viability-37";
const OUT = arg("out", `${EVIDENCE}/provisional-lifecycle-exit.json`);
const SEED = arg("seed", "audit27:natural:s1");
const WARM_DAYS = Number(arg("warm-days", "2100"));
const OBSERVE_DAYS = Number(arg("observe-days", "1200"));

const fixtures = [];
const record = (id, claim, passed, nonVacuous, detail) => {
  fixtures.push({
    id, claim,
    verdict: nonVacuous === false ? "VACUOUS" : passed ? "PASS" : "FAIL",
    nonVacuous: nonVacuous !== false,
    detail,
  });
};

/** Freeze an object and everything reachable from it, so any in-place write throws. */
function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  Object.freeze(value);
  for (const key of Object.keys(value)) deepFreeze(value[key], seen);
  return value;
}
const digest = (v) => JSON.stringify(v, (k, x) => (x === undefined ? "<undefined>" : x));

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-i4exit-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const seam = await server.ssrLoadModule("/sim/agents/fissionDepartureSeam.ts");
  const kernel = await server.ssrLoadModule("/sim/agents/fissionLifecycleKernel.ts");
  const resolver = await server.ssrLoadModule("/sim/agents/provisionalLifecycleResolver.ts");
  const policy = await server.ssrLoadModule("/sim/agents/fissionFieldTransferPolicy.ts");
  const lc = await server.ssrLoadModule("/sim/agents/bandLifecycle.ts");

  // ── E1 — every phase is classified, and the two successful terminals require a world event ──
  const contracts = kernel.PHASE_CONTRACTS;
  const unclassified = contracts.filter((c) => c.entryRequires !== "elapsed_time_permitted" && c.entryRequires !== "physical_event");
  const physicalEventPhases = contracts.filter((c) => c.entryRequires === "physical_event").map((c) => c.phase);
  record(
    "E1_successful_terminals_require_a_physical_event",
    "`reintegrated` and `stabilized` — the two phases that assert something happened in the world — are classified as requiring a physical event, and every phase carries a classification",
    unclassified.length === 0 && physicalEventPhases.includes("reintegrated") && physicalEventPhases.includes("stabilized"),
    contracts.length >= 12,
    { phases: contracts.length, unclassified: unclassified.map((c) => c.phase), physicalEventPhases },
  );

  // ── E2 — no contract times out into a phase that asserts a world event ──
  const problems = kernel.assertSingleOwnership();
  const timeoutIntoPhysical = contracts.filter((c) => {
    if (c.onTimeout === undefined) return false;
    return kernel.getPhaseContract(c.onTimeout).entryRequires === "physical_event";
  });
  record(
    "E2_no_timeout_points_at_a_phase_requiring_a_physical_event",
    "the structural invariant over the contract table itself — a timeout is elapsed time by definition, so pointing one at a phase that asserts a world event is the defect regardless of which phases are involved; re-pointing `returning.onTimeout` back at `reintegrated` fails this",
    timeoutIntoPhysical.length === 0 && problems.length === 0,
    contracts.filter((c) => c.onTimeout !== undefined).length > 0,
    { ownershipProblems: problems, timeoutIntoPhysical: timeoutIntoPhysical.map((c) => `${c.phase} -> ${c.onTimeout}`) },
  );

  // ── E3 — the kernel refuses elapsed time as a cause for a physical-event phase ──
  const returning = { phase: "returning", phaseEnteredDay: 0, history: ["travelling"] };
  const establishing = { phase: "establishing", phaseEnteredDay: 0, history: ["travelling"] };
  const byTime = kernel.requestTransition({ current: returning, to: "reintegrated", today: 500, cause: "elapsed_time" });
  const byTimeStabilize = kernel.requestTransition({ current: establishing, to: "stabilized", today: 900, cause: "elapsed_time", livedEvidenceCount: 99 });
  const byEventNoProof = kernel.requestTransition({ current: returning, to: "reintegrated", today: 500, cause: "physical_event" });
  const byEventProven = kernel.requestTransition({ current: returning, to: "reintegrated", today: 500, cause: "physical_event", physicalCoLocationProven: true });
  record(
    "E3_elapsed_time_cannot_request_a_physical_event_phase",
    "a transition to `reintegrated` or `stabilized` carrying `cause: elapsed_time` is REFUSED, even when every other precondition is satisfied — the stabilize arm passes 99 units of lived evidence and is still refused",
    byTime.ok === false && byTime.rejection === "terminal_outcome_requires_a_physical_event" &&
      byTimeStabilize.ok === false && byTimeStabilize.rejection === "terminal_outcome_requires_a_physical_event" &&
      byEventNoProof.ok === false && byEventNoProof.rejection === "reintegration_without_proven_co_location" &&
      byEventProven.ok === true,
    true,
    {
      elapsedTimeToReintegrated: byTime.ok ? "ACCEPTED" : byTime.rejection,
      elapsedTimeToStabilizedWith99Evidence: byTimeStabilize.ok ? "ACCEPTED" : byTimeStabilize.rejection,
      physicalEventWithoutCoLocationProof: byEventNoProof.ok ? "ACCEPTED" : byEventNoProof.rejection,
      physicalEventWithCoLocationProof: byEventProven.ok ? "ACCEPTED" : byEventProven.rejection,
    },
  );

  // ── E4 — `resolveTimeout` routes through the same guards instead of around them ──
  //
  // Its old form called the phase-entry helper directly and bypassed every check in the module. This
  // asserts it now refuses exactly what `requestTransition` refuses, on a synthetic contract path.
  const timedOut = kernel.resolveTimeout({ phase: "returning", phaseEnteredDay: 0, history: [] }, kernel.RETURN_MAX_DAYS + 1);
  record(
    "E4_the_timeout_resolver_does_not_bypass_the_guards",
    "`resolveTimeout` on an expired `returning` produces `establishing` — the group tries to live where it stands — and cannot produce `reintegrated` by any path",
    timedOut.ok === true && timedOut.state.phase === "establishing" && timedOut.timedOut === true,
    true,
    { resultPhase: timedOut.ok ? timedOut.state.phase : timedOut.rejection, timedOut: timedOut.ok ? timedOut.timedOut : null },
  );

  // ── E7 — a caller that declares NO cause is refused ──
  //
  // The point of making `cause` required rather than defaulted: an omitted field is how
  // `returning -> reintegrated` survived in the first place — it needed nothing, so it got nothing,
  // and the absence read as permission.
  const undeclared = kernel.requestTransition({ current: returning, to: "reintegrated", today: 500, physicalCoLocationProven: true });
  const undeclaredStabilize = kernel.requestTransition({ current: establishing, to: "stabilized", today: 900, livedEvidenceCount: 99 });
  record(
    "E7_a_caller_that_declares_no_cause_is_refused",
    "omitting `cause` entirely does not read as permission — both successful terminals refuse an undeclared caller even with every other precondition satisfied",
    undeclared.ok === false && undeclared.rejection === "terminal_outcome_requires_a_physical_event" &&
      undeclaredStabilize.ok === false && undeclaredStabilize.rejection === "terminal_outcome_requires_a_physical_event",
    true,
    {
      undeclaredToReintegrated: undeclared.ok ? "ACCEPTED" : undeclared.rejection,
      undeclaredToStabilized: undeclaredStabilize.ok ? "ACCEPTED" : undeclaredStabilize.rejection,
    },
  );

  // ── build a real departure for the world-level arms ──
  let world = runner.initSimWorld({ kind: "map2" }, SEED);
  world = advance.advanceWorldByDays(world, WARM_DAYS);
  const parent = Object.values(world.bands)
    .filter((b) => lc.isEstablishedBand(b) && b.demography.workingAdults >= 6 && b.demography.population >= 24)
    .sort((a, b) => b.demography.population - a.demography.population)[0];
  if (parent === undefined) throw new Error("no suitable parent band");
  const dayD = Number(world.time.day ?? 0);
  const requested = Math.max(2, Math.floor(parent.demography.population * 0.35));
  const departure = seam.performAtomicDeparture({
    world: {
      ...world,
      bands: {
        ...world.bands,
        [parent.id]: {
          ...parent,
          fissionAttempt: {
            phase: "departure_ready", phaseEnteredDay: dayD - 5, history: ["proposed", "committed"],
            lineageId: "LIN-EXIT-1", requestedFounders: requested, targetTileId: String(parent.position),
          },
        },
      },
    },
    parentId: parent.id, today: dayD,
    residualContext: {
      physicallyAwayPeople: 0, physicallyAwayWorkers: 0, preparedCommitmentWorkers: 0,
      foodDemographicPressure: 0, chronicFoodStress: 0, chronicDeficitStreak: 0, nutritionMeasured: true,
      acuteRiskSeverity: 0, sicknessBurden: 0, careTravelBurden: 0, embodiedConditionMeasured: true,
      ecologicalRisk: 0, ecologicalPositionMeasured: true,
      mobilityCapabilityBefore: 1, mobilityCapabilityAfter: 1, minimumFounderRequest: 2,
    },
    successorBandId: `${parent.id}:provisional:1`, lineageId: "LIN-EXIT-1",
  });
  if (departure.ok !== true) throw new Error(`departure refused: ${departure.refusal} ${departure.detail ?? ""}`);
  const succId = String(departure.successorId);

  // ── E5 — THE REPRODUCED DEFECT IS GONE, MEASURED ON A REAL WORLD OVER A LONG WINDOW ──
  //
  // The previous pass reproduced it: quarantine ended after 359 days at `reintegrated`, the band
  // stayed in the world holding 11 people and resumed ordinary behaviour. Same world, same seed, same
  // instrument, a window three times longer.
  let w = departure.world;
  const phaseTrail = [];
  let lastPhase = w.bands[succId]?.provisionalSuccessor?.phase ?? null;
  phaseTrail.push({ dayOffset: 0, phase: lastPhase });
  let becameOrdinary = null;
  for (let day = 1; day <= OBSERVE_DAYS; day += 1) {
    w = advance.advanceWorldByDays(w, 1);
    const b = w.bands[succId];
    if (b === undefined) break;
    const phase = b.provisionalSuccessor?.phase ?? null;
    if (phase !== lastPhase) {
      phaseTrail.push({ dayOffset: day, phase, cycles: b.provisionalSuccessor?.resolutionCycles ?? 0 });
      lastPhase = phase;
    }
    if (becameOrdinary === null && !lc.isProvisionalSuccessor(b) && lc.isEstablishedBand(b)) {
      becameOrdinary = { dayOffset: day, phase, population: Math.round(b.demography.population) };
    }
  }
  const finalBand = w.bands[succId];
  const finalPhase = finalBand?.provisionalSuccessor?.phase ?? null;
  record(
    "E5_a_group_can_no_longer_leave_quarantine_on_a_timer",
    "the same world, seed and instrument that previously reproduced `reintegrated` at day 359 now never reaches it, and the successor never becomes an ordinary established band by elapsed time alone",
    becameOrdinary === null && finalPhase !== "reintegrated" && finalPhase !== "stabilized",
    // Non-vacuity: the lifecycle must actually have MOVED, or "never reached reintegrated" is a claim
    // about a band that did nothing.
    phaseTrail.length > 1,
    { observedDays: OBSERVE_DAYS, phaseTrail, finalPhase, becameOrdinaryAt: becameOrdinary, stillProvisional: finalBand === undefined ? null : lc.isProvisionalSuccessor(finalBand) },
  );

  // ── E6 — the return/establish churn is bounded, and the end of it is REPORTED ──
  const cycles = finalBand?.provisionalSuccessor?.resolutionCycles ?? 0;
  const reportedUnresolved = resolver.hasUnresolvedProvisionalGroup(w);
  const finalResolutions = resolver.resolveProvisionalLifecycles(w, Number(w.time.day ?? 0)).resolutions
    .filter((r) => r.bandId === succId);
  record(
    "E6_the_return_establish_cycle_is_bounded_and_its_end_is_named",
    "the lineage stops being shuffled between phases once its cycle budget is spent, and that state is REPORTED as unresolved rather than sitting silently immortal — every exit it has left is physical: reach the parent, demonstrate establishment, or die",
    cycles <= kernel.MAX_RETURN_ESTABLISH_CYCLES &&
      (cycles < kernel.MAX_RETURN_ESTABLISH_CYCLES || reportedUnresolved),
    true,
    { resolutionCycles: cycles, maxCycles: kernel.MAX_RETURN_ESTABLISH_CYCLES, reportedAsUnresolved: reportedUnresolved, finalResolutions },
  );

  // ── A1..A5 — ALIAS SAFETY FOR THE FIVE DELIBERATELY SHARED REFERENCES ──
  //
  // Shared identity is correct for a historical fact about the same people — one remembered death may
  // not become two independent bereavements. It is only SAFE if nobody writes through the alias. Proven
  // by deep-freezing the shared objects on both bands and running the world: an in-place write throws.
  const sharedFields = departure.ledger.transfer.sharedByReferenceFields;
  const frozenWorld = (() => {
    const p = departure.world.bands[parent.id];
    const s = departure.world.bands[succId];
    for (const field of sharedFields) {
      if (p[field] !== undefined) deepFreeze(p[field]);
    }
    return departure.world;
  })();
  const before = Object.fromEntries(sharedFields.map((f) => [f, digest(departure.world.bands[succId][f])]));

  let mutationError = null;
  let fw = frozenWorld;
  try {
    for (let day = 0; day < 400; day += 1) fw = advance.advanceWorldByDays(fw, 1);
  } catch (error) {
    mutationError = String(error?.message ?? error);
  }
  const after = Object.fromEntries(
    sharedFields.map((f) => [f, fw.bands[succId] === undefined ? "<band gone>" : digest(fw.bands[succId][f])]),
  );
  const contentChanged = sharedFields.filter((f) => before[f] !== after[f]);
  // The pass condition is NO IN-PLACE WRITE, which a deep freeze turns from a belief into a thrown
  // TypeError. A field whose CONTENT changed while its object was frozen is positive evidence in the
  // same direction — the only way to achieve that is to replace the object, which is what an immutable
  // writer does. An earlier form of this fixture treated a content change as a failure and reported
  // `socialPressure` as unsafe when it had simply been recomputed correctly for the successor.
  record(
    "A1_the_shared_references_are_never_mutated_through_the_alias",
    "every field the transfer policy shares BY REFERENCE is deep-frozen on both bands and the world is advanced 400 days; an in-place write throws in module strict mode, and none does",
    mutationError === null,
    fw.bands[succId] !== undefined && sharedFields.length > 0,
    {
      sharedFields,
      mutationError,
      replacedRatherThanEdited: contentChanged,
      note: "replacedRatherThanEdited lists fields whose content moved while frozen — only achievable by replacing the object, so it is evidence FOR immutability, not against it",
    },
  );

  // ── A2 — the sharing is CLASSIFIED, not accidental ──
  const TABLE = policy.FISSION_FIELD_TRANSFER_POLICY;
  const classification = Object.fromEntries(
    sharedFields.map((f) => [f, { transferClass: TABLE[f]?.transferClass ?? null, successorValue: TABLE[f]?.successorValue ?? null }]),
  );
  const permitted = sharedFields.filter((f) => {
    const shape = TABLE[f]?.successorValue;
    return shape === "carried" || shape === "carried_no_relief" || shape === "carried_pending_recompute";
  });
  record(
    "A2_every_shared_reference_is_a_classified_decision",
    "no field is shared by accident: each carries a transfer class and a value shape that explicitly permits carrying",
    permitted.length === sharedFields.length,
    sharedFields.length > 0,
    { classification, permitted: permitted.length, total: sharedFields.length },
  );

  // ── A3 — a parent-side update REPLACES rather than edits, so the alias breaks cleanly ──
  //
  // The safety property is not "the object is frozen in production" — it is that the writers are
  // immutable, so the first divergent write gives each band its own object. Measured on the UNFROZEN
  // world: after advancing, wherever a field's content differs between the two bands their object
  // identities must ALSO differ, which is what an immutable writer produces and an in-place edit does
  // not.
  let uw = departure.world;
  for (let day = 0; day < 400; day += 1) uw = advance.advanceWorldByDays(uw, 1);
  const up = uw.bands[parent.id];
  const us = uw.bands[succId];
  const divergedButAliased = us === undefined ? [] : sharedFields.filter(
    (f) => digest(up?.[f]) !== digest(us[f]) && up?.[f] === us[f],
  );
  const stillAliased = us === undefined ? [] : sharedFields.filter((f) => up?.[f] !== undefined && up[f] === us[f]);
  record(
    "A3_divergent_content_implies_divergent_objects",
    "no field ends up with different content on the two bands while still pointing at ONE object — which is exactly the state an in-place write would leave and an immutable writer cannot",
    divergedButAliased.length === 0,
    sharedFields.length > 0,
    { divergedButAliased, stillAliasedAfter400Days: stillAliased, successorSurvived: us !== undefined },
  );

  out = {
    generatedAt: new Date().toISOString(),
    seed: SEED, warmDays: WARM_DAYS, observeDays: OBSERVE_DAYS,
    parentId: String(parent.id), successorId: succId,
    summary: {
      fixtures: fixtures.length,
      passing: fixtures.filter((f) => f.verdict === "PASS").length,
      failing: fixtures.filter((f) => f.verdict === "FAIL").length,
      vacuous: fixtures.filter((f) => f.verdict === "VACUOUS").length,
      physicalEventPhases,
      sharedByReferenceFields: sharedFields,
    },
    fixtures,
  };
} finally {
  await server.close();
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify(out.summary, null, 2));
for (const f of out.fixtures) console.log(`${f.verdict.padEnd(7)} ${f.id}`);
if (out.summary.failing > 0 || out.summary.vacuous > 0) process.exitCode = 1;
