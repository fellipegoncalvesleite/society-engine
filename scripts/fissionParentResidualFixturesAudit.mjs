// ROADMAP ITEM 4 — controlled fixtures PR1-PR20 for the parent residual viability authority.
//
// Non-vacuity is ASSERTED per fixture: the harness relabels a fixture VACUOUS and fails the run when
// its predicate is false. A fixture that passes over an empty set, or that asserts a refusal on a
// case the allocation authority already refused, proves nothing and is reported as proving nothing.
//
// Every fixture reads the PRODUCTION authority. Nothing here re-implements the verdict.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/dynamic-fission-daughter-viability-37";
const OUT = arg("out", `${EVIDENCE}/parent-residual-controlled-fixtures.json`);

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-i4prfx-${process.pid}`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  logLevel: "error",
});

let out;
try {
  const alloc = await server.ssrLoadModule("/sim/agents/fissionFounderAllocation.ts");
  const v = await server.ssrLoadModule("/sim/agents/fissionParentResidualViability.ts");

  /** A parent carrying nothing: every fragility channel measured and sound. */
  const SOUND = {
    physicallyAwayPeople: 0,
    physicallyAwayWorkers: 0,
    preparedCommitmentWorkers: 0,
    foodDemographicPressure: 0,
    chronicFoodStress: 0,
    chronicDeficitStreak: 0,
    nutritionMeasured: true,
    acuteRiskSeverity: 0,
    sicknessBurden: 0,
    careTravelBurden: 0,
    embodiedConditionMeasured: true,
    ecologicalRisk: 0,
    ecologicalPositionMeasured: true,
    mobilityCapabilityBefore: 1,
    mobilityCapabilityAfter: 1,
    minimumFounderRequest: 2,
  };
  const HUNGRY = { foodDemographicPressure: 1, chronicFoodStress: 1, chronicDeficitStreak: 12 };
  const ILL = { acuteRiskSeverity: 1, sicknessBurden: 1, careTravelBurden: 1 };

  const fixtures = [];
  const record = (id, claim, run) => {
    let row;
    try {
      row = run();
    } catch (error) {
      fixtures.push({ id, claim, status: "ERROR", error: String(error && error.message ? error.message : error) });
      return;
    }
    const { nonVacuous, nonVacuityNote, passed, ...rest } = row;
    fixtures.push({
      id,
      claim,
      status: !nonVacuous ? "VACUOUS" : passed ? "PASS" : "FAIL",
      nonVacuityNote,
      ...rest,
    });
  };

  /**
   * Allocate, then assess — BOTH ways.
   *
   * `assessment` is the full authority including the revision search; `direct` is the same
   * allocation with no search. Keeping both is not redundancy: whenever a revision succeeds the
   * assessment's `limiting` describes the REVISED request, so a fixture comparing damage across two
   * arms must read `direct` or it will be comparing two different departures. An earlier form of
   * this audit did exactly that and reported a vacuous PR11 and a false PR10.
   */
  const assess = (parent, request, overrides = {}) => {
    const a = alloc.allocateFounderCohorts(parent, request);
    if (a.ok !== true) {
      return { allocationRefusal: a.refusal, allocation: undefined, assessment: undefined, direct: undefined };
    }
    const input = { ...SOUND, ...overrides, parentBefore: parent, allocation: a.allocation };
    return {
      allocationRefusal: undefined,
      allocation: a.allocation,
      assessment: v.assessParentResidualWithRevision(input),
      direct: v.assessParentResidual(input),
      input,
    };
  };

  /** Every reason id the run actually emitted, so unreachability is MEASURED rather than asserted. */
  const emittedIds = new Set();
  const collect = (a) => {
    if (a !== undefined) {
      for (const id of a.reasonIds) emittedIds.add(id);
    }
  };

  const brief = (r) => {
    if (r.assessment === undefined) {
      return { allocationRefusal: r.allocationRefusal };
    }
    collect(r.assessment);
    collect(r.direct);
    return {
      verdict: r.assessment.verdict,
      blockKind: r.assessment.blockKind,
      // the request AS ASKED, before any revision — this is the honest damage of this departure
      directVerdict: r.direct.verdict,
      directSplitCausedDamage: r.direct.limiting.splitCausedDamage,
      directTolerance: r.direct.limiting.tolerance,
      priorFragility: r.direct.limiting.priorFragility,
      revisedFounderRequest: r.assessment.revisedFounderRequest ?? null,
      departureBlocked: r.assessment.departureBlocked,
      revisionCandidatesEvaluated: r.assessment.revisionCandidatesEvaluated,
      campWorkingAdultsBefore: r.direct.limiting.campWorkingAdultsBefore,
      residualWorkingAdultsAtCamp: r.direct.limiting.residualWorkingAdultsAtCamp,
      unmeasuredInputs: r.assessment.unmeasuredInputs,
      separationHolds: v.isPriorHardshipSeparatedFromSplitDamage(r.assessment),
    };
  };

  // The two parents that actually fissioned in the 200-year before-audit, on their real cohorts.
  const NATURAL_S1 = { workingAdults: 29, dependents: 14, elders: 7 };
  const NATURAL_MAP2 = { workingAdults: 29, dependents: 14, elders: 6 };

  // ── PR1 / PR2 — both sides feasible, on the two real natural fissions ────────────────────────
  for (const [id, parent, label] of [
    ["PR1", NATURAL_S1, "seed audit27:natural:s1"],
    ["PR2", NATURAL_MAP2, "seed audit27:natural:map2:s1"],
  ]) {
    record(id, `a real natural fission (${label}) leaves a coherent parent and is permitted`, () => {
      const r = assess(parent, 18);
      return {
        parent,
        request: 18,
        result: brief(r),
        // Non-vacuous only if the split genuinely did something. A departure that changed nothing
        // would pass this fixture while proving the authority never looked.
        nonVacuous: r.assessment !== undefined && r.assessment.limiting.splitCausedDamage > 0,
        nonVacuityNote: "splitCausedDamage > 0 — the departure genuinely deteriorated the parent",
        passed:
          r.assessment !== undefined &&
          r.assessment.verdict === "residual_viable" &&
          r.assessment.blockKind === "none" &&
          r.allocation.exact === true &&
          v.permittedFounderCount(r.assessment, 18) === 18,
      };
    });
  }

  // ── PR3 — successor feasible, parent stranded by the split's damage ──────────────────────────
  record("PR3", "a departure the successor could sustain is refused because the parent could not", () => {
    const parent = { workingAdults: 4, dependents: 30, elders: 16 };
    const r = assess(parent, 20, { minimumFounderRequest: 20 });
    return {
      parent,
      request: 20,
      result: brief(r),
      // Non-vacuous only if the DEPARTING group is itself workable — otherwise this is a fixture
      // about an impossible successor wearing a parent-side label.
      nonVacuous: r.allocation !== undefined && r.allocation.successor.workingAdults >= 1,
      nonVacuityNote: "the departing group holds productive labour of its own, so the refusal is about the parent",
      passed:
        r.assessment !== undefined &&
        r.assessment.verdict === "residual_nonviable" &&
        r.assessment.blockKind === "split_caused_damage_exceeds_tolerance" &&
        r.assessment.departureBlocked === true,
    };
  });

  // ── PR4 — a smaller request repairs the parent ───────────────────────────────────────────────
  record("PR4", "a request that strands the parent is answered with the largest smaller one that does not", () => {
    const parent = { workingAdults: 10, dependents: 26, elders: 14 };
    const asked = assess(parent, 18, { ...HUNGRY, ...ILL, ecologicalRisk: 0.9, mobilityCapabilityBefore: 0.1, mobilityCapabilityAfter: 0.1, minimumFounderRequest: 2 });
    const atRevised =
      asked.assessment && asked.assessment.revisedFounderRequest
        ? assess(parent, asked.assessment.revisedFounderRequest, {
            ...HUNGRY,
            ...ILL,
            ecologicalRisk: 0.9,
            mobilityCapabilityBefore: 0.1,
            mobilityCapabilityAfter: 0.1,
            minimumFounderRequest: 2,
          })
        : undefined;
    return {
      parent,
      request: 18,
      result: brief(asked),
      atRevisedRequest: atRevised ? brief(atRevised) : null,
      // Non-vacuous only if the search actually ran and the original request was genuinely refused.
      nonVacuous: asked.assessment !== undefined && asked.assessment.revisionCandidatesEvaluated > 0,
      nonVacuityNote: "the revision search evaluated candidates rather than returning at once",
      passed:
        asked.assessment !== undefined &&
        asked.assessment.verdict === "residual_viable_only_after_revision" &&
        typeof asked.assessment.revisedFounderRequest === "number" &&
        asked.assessment.revisedFounderRequest < 18 &&
        asked.assessment.departureBlocked === false &&
        // the endorsed count must be the revised one, never the one that was asked for
        v.permittedFounderCount(asked.assessment, 18) === asked.assessment.revisedFounderRequest &&
        // and the revised request must itself stand up when assessed directly
        atRevised !== undefined &&
        atRevised.assessment.verdict === "residual_viable",
    };
  });

  // ── PR5 — no feasible revision, search genuinely exhausted ───────────────────────────────────
  record("PR5", "when no permitted request leaves a coherent parent, the search is exhausted and the departure is blocked", () => {
    // A parent with two working adults. Because the remainder is drawn working-adults-first, EVERY
    // legal departure — down to a single person — takes one of them, so the damage has a floor that
    // no smaller request can get under. This is what a genuinely unrevisable parent looks like.
    //
    // The first form of this fixture used 4/30/16 and FAILED, because the authority found a workable
    // request at 10 that the fixture had assumed did not exist. The authority was right and the
    // fixture was wrong; it is recorded here rather than quietly replaced.
    const parent = { workingAdults: 2, dependents: 40, elders: 8 };
    const r = assess(parent, 20, { minimumFounderRequest: 2 });
    return {
      parent,
      request: 20,
      result: brief(r),
      // Non-vacuous only if the search really scanned a range rather than returning immediately —
      // a "no feasible revision" that evaluated zero candidates has not looked for one.
      nonVacuous: r.assessment !== undefined && r.assessment.revisionCandidatesEvaluated > 1,
      nonVacuityNote: "more than one smaller request was actually evaluated and rejected",
      passed:
        r.assessment !== undefined &&
        r.assessment.verdict === "residual_nonviable" &&
        r.assessment.departureBlocked === true &&
        r.assessment.revisedFounderRequest === undefined &&
        r.assessment.revisionSearchTruncated === false &&
        v.permittedFounderCount(r.assessment, 20) === undefined,
    };
  });

  // ── PR6 / PR7 — dependent-heavy and elder-heavy parents ──────────────────────────────────────
  const depHeavy = assess({ workingAdults: 12, dependents: 30, elders: 8 }, 18);
  const elderHeavy = assess({ workingAdults: 12, dependents: 8, elders: 30 }, 18);
  record("PR6", "a dependent-heavy parent is assessed on its actual composition, not a re-derived one", () => ({
    parent: { workingAdults: 12, dependents: 30, elders: 8 },
    request: 18,
    result: brief(depHeavy),
    nonVacuous: depHeavy.allocation !== undefined && depHeavy.allocation.exact === true,
    nonVacuityNote: "the allocation balanced cohort by cohort, so the composition under test is the real one",
    passed:
      depHeavy.assessment !== undefined &&
      depHeavy.assessment.limiting.residualDependents === 30 - depHeavy.allocation.successor.dependents &&
      depHeavy.assessment.limiting.dependencyLoadBefore > 3,
  }));
  record("PR7", "an elder-heavy parent is assessed on its actual composition", () => ({
    parent: { workingAdults: 12, dependents: 8, elders: 30 },
    request: 18,
    result: brief(elderHeavy),
    nonVacuous: elderHeavy.allocation !== undefined && elderHeavy.allocation.exact === true,
    nonVacuityNote: "the allocation balanced cohort by cohort",
    passed:
      elderHeavy.assessment !== undefined &&
      elderHeavy.assessment.limiting.residualElders === 30 - elderHeavy.allocation.successor.elders,
  }));

  // ── PR8 — labour-thin parent ─────────────────────────────────────────────────────────────────
  record("PR8", "a labour-thin parent carries prior fragility from its own composition, before any hardship", () => {
    const parent = { workingAdults: 8, dependents: 24, elders: 18 };
    const r = assess(parent, 18);
    return {
      parent,
      request: 18,
      result: brief(r),
      // Non-vacuous only if EVERY optional hardship channel is sound — otherwise the fragility being
      // demonstrated could be coming from hunger rather than from composition.
      nonVacuous:
        r.assessment !== undefined &&
        r.assessment.opposing.every(
          (x) => x.id !== "parent_already_carried_nutritional_deficit" && x.id !== "parent_already_carried_embodied_hardship",
        ),
      nonVacuityNote: "nutrition and embodied condition are both sound, so the fragility is compositional",
      passed:
        r.assessment !== undefined &&
        r.assessment.limiting.priorFragility > 0 &&
        r.assessment.limiting.tolerance < 0.52 &&
        r.assessment.opposing.some((x) => x.id === "parent_camp_labour_share_already_thin"),
    };
  });

  // ── PR9 / PR10 / PR11 — the decisive triple ──────────────────────────────────────────────────
  //
  // Same parent composition throughout. PR9 and PR10 hold hunger constant and vary only the size of
  // the departure; PR11 holds the departure constant and removes the hunger. Between them they
  // establish that hardship is neither the verdict nor irrelevant to it.
  const hungrySmall = assess(NATURAL_S1, 6, HUNGRY);
  const hungryLarge = assess(NATURAL_S1, 40, HUNGRY);
  const soundLarge = assess(NATURAL_S1, 40);

  record("PR9", "severe existing hunger with LITTLE split-caused worsening does not block the split", () => ({
    parent: NATURAL_S1,
    request: 6,
    result: brief(hungrySmall),
    nonVacuous:
      hungrySmall.assessment !== undefined &&
      hungrySmall.assessment.opposing.some((x) => x.id === "parent_already_carried_nutritional_deficit"),
    nonVacuityNote: "the hunger is real and is recorded as opposition — it simply does not decide",
    passed:
      hungrySmall.assessment !== undefined &&
      hungrySmall.assessment.verdict === "residual_viable" &&
      hungrySmall.assessment.limiting.priorFragility > 0.2,
  }));

  // The departure AS ASKED is what PR10 and PR11 are about, so both read the direct assessment.
  // Reading the post-revision `limiting` would compare two different departures — the mistake an
  // earlier form of this audit made, which turned PR11 vacuous and PR10 false.
  record("PR10", "the SAME severe hunger with MATERIAL split-caused worsening does refuse the departure as asked", () => ({
    parent: NATURAL_S1,
    request: 40,
    result: brief(hungryLarge),
    nonVacuous:
      hungryLarge.direct !== undefined &&
      hungrySmall.direct !== undefined &&
      hungryLarge.direct.limiting.priorFragility === hungrySmall.direct.limiting.priorFragility,
    nonVacuityNote: "prior fragility is IDENTICAL to PR9 — only the departure differs, so the flip is the split's doing",
    passed:
      hungryLarge.direct !== undefined &&
      hungryLarge.direct.verdict === "residual_nonviable" &&
      hungryLarge.direct.blockKind === "split_caused_damage_exceeds_tolerance" &&
      hungryLarge.direct.limiting.splitCausedDamage > hungrySmall.direct.limiting.splitCausedDamage &&
      // and the request as asked is not what the authority endorses
      v.permittedFounderCount(hungryLarge.assessment, 40) !== 40,
  }));

  record("PR11", "the SAME departure is permitted when the parent is not hungry — hardship narrows tolerance, it does not decide", () => ({
    parent: NATURAL_S1,
    request: 40,
    hungryResult: brief(hungryLarge),
    soundResult: brief(soundLarge),
    nonVacuous:
      soundLarge.direct !== undefined &&
      hungryLarge.direct !== undefined &&
      soundLarge.direct.limiting.splitCausedDamage === hungryLarge.direct.limiting.splitCausedDamage,
    nonVacuityNote: "split-caused damage is IDENTICAL across the two arms — only the tolerance differs",
    passed:
      soundLarge.direct !== undefined &&
      soundLarge.direct.verdict === "residual_viable" &&
      hungryLarge.direct.verdict === "residual_nonviable" &&
      soundLarge.direct.limiting.tolerance > hungryLarge.direct.limiting.tolerance &&
      // the sound parent's departure needs no revision at all
      v.permittedFounderCount(soundLarge.assessment, 40) === 40,
  }));

  // ── PR12 — existing illness without split-caused worsening ───────────────────────────────────
  record("PR12", "existing illness alone does not block a departure that does little damage", () => {
    const r = assess(NATURAL_S1, 6, ILL);
    return {
      parent: NATURAL_S1,
      request: 6,
      result: brief(r),
      nonVacuous:
        r.assessment !== undefined && r.assessment.opposing.some((x) => x.id === "parent_already_carried_embodied_hardship"),
      nonVacuityNote: "the embodied hardship is real and recorded",
      passed: r.assessment !== undefined && r.assessment.verdict === "residual_viable" && r.assessment.limiting.tolerance < 0.52,
    };
  });

  // ── PR13 — absolute physical impossibility ───────────────────────────────────────────────────
  record("PR13", "a parent that owes more labour than it holds is an absolute impossibility, and the search is not run", () => {
    const parent = { workingAdults: 20, dependents: 20, elders: 10 };
    const r = assess(parent, 18, { physicallyAwayPeople: 22, physicallyAwayWorkers: 22, minimumFounderRequest: 2 });
    return {
      parent,
      request: 18,
      result: brief(r),
      // Non-vacuous only if the ALLOCATION succeeded — otherwise the refusal came from the allocation
      // authority and this fixture would be crediting the wrong module.
      nonVacuous: r.allocation !== undefined,
      nonVacuityNote: "the allocation itself was legal, so the refusal is this authority's own",
      passed:
        r.assessment !== undefined &&
        r.assessment.verdict === "residual_nonviable" &&
        r.assessment.blockKind === "absolute_physical_impossibility" &&
        r.assessment.departureBlocked === true &&
        // the search is deliberately skipped: no founder count can change what the parent owes
        r.assessment.revisionCandidatesEvaluated === 0,
    };
  });

  // ── PR14 — away-person constraint ────────────────────────────────────────────────────────────
  record("PR14", "people physically away belong to the parent but are not at camp, and the labour question is about camp", () => {
    const withAway = assess(NATURAL_S1, 18, { physicallyAwayPeople: 8, physicallyAwayWorkers: 8 });
    const without = assess(NATURAL_S1, 18);
    return {
      parent: NATURAL_S1,
      request: 18,
      withAway: brief(withAway),
      withoutAway: brief(without),
      nonVacuous:
        withAway.assessment !== undefined &&
        without.assessment !== undefined &&
        withAway.assessment.limiting.residualWorkingAdultsAtCamp !== without.assessment.limiting.residualWorkingAdultsAtCamp,
      nonVacuityNote: "the away party genuinely moved the camp labour reading",
      passed:
        withAway.assessment !== undefined &&
        // the away party's people are still counted in the residual — they will come home
        withAway.assessment.limiting.residualPeople === without.assessment.limiting.residualPeople &&
        // but not at camp
        withAway.assessment.limiting.residualPeopleAtCamp === without.assessment.limiting.residualPeopleAtCamp - 8 &&
        withAway.assessment.limiting.committedLabour === 8,
    };
  });

  // ── PR15 — prepared-commitment constraint ────────────────────────────────────────────────────
  record("PR15", "labour promised to a party about to depart is committed, and is charged to the camp before the split", () => {
    const r = assess(NATURAL_S1, 18, { preparedCommitmentWorkers: 12 });
    const without = assess(NATURAL_S1, 18);
    return {
      parent: NATURAL_S1,
      request: 18,
      withPrepared: brief(r),
      withoutPrepared: brief(without),
      nonVacuous:
        r.assessment !== undefined &&
        without.assessment !== undefined &&
        r.assessment.limiting.campWorkingAdultsBefore !== without.assessment.limiting.campWorkingAdultsBefore,
      nonVacuityNote: "the prepared commitment genuinely moved the pre-split camp labour reading",
      passed:
        r.assessment !== undefined &&
        r.assessment.limiting.committedLabour === 12 &&
        // charged on BOTH sides of the comparison, so it registers as prior fragility and not as
        // damage the departure caused
        r.assessment.limiting.campWorkingAdultsBefore === without.assessment.limiting.campWorkingAdultsBefore - 12 &&
        r.assessment.limiting.priorFragility > without.assessment.limiting.priorFragility,
    };
  });

  // ── PR16 — deterministic boundary ────────────────────────────────────────────────────────────
  record("PR16", "the verdict flips exactly once across a swept input, at the published damage-versus-tolerance boundary", () => {
    // Swept on the DIRECT verdict: the revision search would otherwise mask the boundary by
    // answering with a different departure. A request of 30 from a hungry parent sits close enough
    // to its own tolerance that losing mobility crosses it, which is what makes the sweep informative
    // rather than flat — the first form of this fixture swept a request whose damage never reached
    // the tolerance at all and honestly reported VACUOUS.
    const sweep = [];
    for (let i = 0; i <= 20; i += 1) {
      const after = Math.round((1 - i * 0.05) * 100) / 100;
      const r = assess(NATURAL_S1, 30, { ...HUNGRY, mobilityCapabilityBefore: 1, mobilityCapabilityAfter: after });
      collect(r.direct);
      sweep.push({
        mobilityCapabilityAfter: after,
        verdict: r.direct.verdict,
        splitCausedDamage: r.direct.limiting.splitCausedDamage,
        tolerance: r.direct.limiting.tolerance,
        // the verdict must agree with the numbers it published about itself
        agreesWithPublishedNumbers:
          (r.direct.limiting.splitCausedDamage >= r.direct.limiting.tolerance) === (r.direct.verdict !== "residual_viable"),
      });
    }
    const flips = sweep.filter((s, i) => i > 0 && s.verdict !== sweep[i - 1].verdict).length;
    return {
      parent: NATURAL_S1,
      request: 30,
      sweep,
      flips,
      nonVacuous: new Set(sweep.map((s) => s.verdict)).size === 2,
      nonVacuityNote: "the sweep genuinely contains both verdicts — a single-verdict sweep tests no boundary",
      passed: flips === 1 && sweep.every((s) => s.agreesWithPublishedNumbers),
    };
  });

  // ── PR17 — the same allocation produces the same result ──────────────────────────────────────
  record("PR17", "the same allocation and the same context produce a byte-identical assessment", () => {
    const a = alloc.allocateFounderCohorts(NATURAL_S1, 18);
    const input = { ...SOUND, ...HUNGRY, parentBefore: NATURAL_S1, allocation: a.allocation };
    const first = JSON.stringify(v.assessParentResidualWithRevision(input));
    const second = JSON.stringify(v.assessParentResidualWithRevision({ ...input }));
    // a fresh allocation object with the same values must also give the same answer
    const b = alloc.allocateFounderCohorts(NATURAL_S1, 18);
    const third = JSON.stringify(
      v.assessParentResidualWithRevision({ ...SOUND, ...HUNGRY, parentBefore: { ...NATURAL_S1 }, allocation: b.allocation }),
    );
    return {
      parent: NATURAL_S1,
      request: 18,
      identical: first === second && second === third,
      nonVacuous: first.length > 100 && JSON.parse(first).opposing.length > 0,
      nonVacuityNote: "the compared assessment is substantive rather than an empty object",
      passed: first === second && second === third,
    };
  });

  // ── PR18 — unrelated information cannot alter the verdict ────────────────────────────────────
  record("PR18", "information the authority has no field for cannot reach the verdict", () => {
    const a = alloc.allocateFounderCohorts(NATURAL_S1, 18);
    const clean = { ...SOUND, parentBefore: NATURAL_S1, allocation: a.allocation };
    // Everything a caller might plausibly have lying around, including world truth this authority
    // must never see. The struct is closed, so none of it is reachable.
    const polluted = {
      ...clean,
      world: { bands: { a: 1, b: 2, c: 3 }, time: { tick: 999 } },
      worldPopulation: 4211,
      hiddenTargetRichness: 0.99,
      otherBandPositions: ["tile:1:1", "tile:2:2"],
      splitPressure: 0.97,
      territorialPressure: 0.8,
      neighbouringBandCount: 12,
      knownContactCount: 7,
      daughterMinPopulation: 18,
      seed: "audit27:natural:s1",
    };
    const before = JSON.stringify(v.assessParentResidualWithRevision(clean));
    const after = JSON.stringify(v.assessParentResidualWithRevision(polluted));
    return {
      parent: NATURAL_S1,
      request: 18,
      pollutedKeys: Object.keys(polluted).filter((k) => !(k in clean)),
      identical: before === after,
      nonVacuous: Object.keys(polluted).length > Object.keys(clean).length,
      nonVacuityNote: "unrelated keys were genuinely present on the input object",
      passed: before === after,
    };
  });

  // ── PR19 — the structural guarantee ──────────────────────────────────────────────────────────
  record("PR19", "a departure that causes NO deterioration is never refused, at maximum prior fragility", () => {
    // A departure of zero working adults from a maximally fragile parent: nothing walks out of the
    // camp, the dependency load falls rather than rises, and mobility is unchanged. If prior hardship
    // could block on its own, this is where it would.
    const parent = { workingAdults: 12, dependents: 30, elders: 8 };
    const a = alloc.allocateFounderCohorts(parent, 18);
    // Force a departure that removes only non-workers, so damage is structurally zero.
    const handBuilt = {
      requestedFounders: 8,
      allocatedFounders: 8,
      successor: { workingAdults: 0, dependents: 8, elders: 0 },
      parentRemainder: { workingAdults: 12, dependents: 22, elders: 8 },
      remainderDrawOrder: a.allocation.remainderDrawOrder,
      exact: true,
    };
    const input = {
      ...SOUND,
      ...HUNGRY,
      ...ILL,
      ecologicalRisk: 1,
      mobilityCapabilityBefore: 0.05,
      mobilityCapabilityAfter: 0.05,
      parentBefore: parent,
      allocation: handBuilt,
    };
    const r = v.assessParentResidualWithRevision(input);
    collect(r);
    return {
      parent,
      allocation: handBuilt,
      result: {
        verdict: r.verdict,
        blockKind: r.blockKind,
        splitCausedDamage: r.limiting.splitCausedDamage,
        priorFragility: r.limiting.priorFragility,
        tolerance: r.limiting.tolerance,
        separationHolds: v.isPriorHardshipSeparatedFromSplitDamage(r),
      },
      // Non-vacuous only if the parent really is maximally fragile — otherwise this proves nothing
      // about hardship's inability to veto.
      nonVacuous: r.limiting.priorFragility >= 0.99,
      nonVacuityNote: "prior fragility is at its ceiling, so this is the hardest case for the guarantee",
      passed:
        r.limiting.splitCausedDamage === 0 &&
        r.verdict === "residual_viable" &&
        r.limiting.tolerance >= r.limiting.toleranceFloor &&
        v.isPriorHardshipSeparatedFromSplitDamage(r) === true,
    };
  });

  // ── PR20 — uncertainty is not soundness ──────────────────────────────────────────────────────
  record("PR20", "an unmeasured channel earns neither fragility nor credit, and is named", () => {
    const unmeasured = assess(NATURAL_S1, 18, {
      nutritionMeasured: false,
      embodiedConditionMeasured: false,
      ecologicalPositionMeasured: false,
    });
    const measuredSound = assess(NATURAL_S1, 18);
    return {
      parent: NATURAL_S1,
      request: 18,
      unmeasured: brief(unmeasured),
      measuredSound: brief(measuredSound),
      nonVacuous: unmeasured.assessment !== undefined && unmeasured.assessment.unmeasuredInputs.length === 3,
      nonVacuityNote: "all three optional channels were genuinely withheld",
      passed:
        unmeasured.assessment !== undefined &&
        unmeasured.assessment.unmeasuredInputs.length === 3 &&
        // no supporting reason may be earned from a channel that was never measured
        !unmeasured.assessment.supporting.some(
          (x) => x.id === "parent_carried_no_nutritional_deficit" || x.id === "parent_carried_no_embodied_hardship",
        ) &&
        // and the uncertainty is recorded rather than silently absent
        unmeasured.assessment.opposing.some((x) => x.id === "parent_condition_partly_unmeasured") &&
        measuredSound.assessment.supporting.some((x) => x.id === "parent_carried_no_nutritional_deficit"),
    };
  });

  // ── structurally unreachable refusals, inspected rather than fabricated ──────────────────────
  //
  // The brief requires these to be recorded, and explicitly forbids inventing a fixture merely to
  // exercise an enum value. Each entry below states what was checked and what the reachability
  // finding actually is.
  //
  // The full reason vocabulary, transcribed from the authority's own exported union. Anything here
  // that no fixture emitted is reported as NOT EMITTED with a stated reachability finding, rather
  // than having a fixture invented to light it up.
  const ALL_REASON_IDS = [
    "residual_has_no_bodies_at_camp",
    "residual_has_no_productive_labour_at_camp",
    "residual_labour_committed_beyond_its_workforce",
    "split_removes_productive_labour_from_camp",
    "split_worsens_dependency_load",
    "split_reduces_mobility_capability",
    "parent_already_carried_nutritional_deficit",
    "parent_already_carried_embodied_hardship",
    "parent_already_in_adverse_ecological_position",
    "parent_camp_labour_share_already_thin",
    "parent_dependency_load_already_high",
    "split_leaves_camp_labour_intact",
    "split_does_not_worsen_dependency_load",
    "parent_carried_no_nutritional_deficit",
    "parent_carried_no_embodied_hardship",
    "residual_retains_labour_beyond_its_commitments",
    "parent_condition_partly_unmeasured",
    "founder_request_revised_downward_to_protect_the_parent",
    "no_permitted_founder_request_leaves_a_coherent_parent",
  ];
  const NOT_EMITTED_FINDINGS = {
    residual_has_no_bodies_at_camp:
      "NOT CONSTRUCTED, deliberately. It requires `physicallyAwayPeople` to exceed the entire residual. That is reachable in principle, but the away count is drawn from the same population the residual is, so forcing it means handing the authority an input the departure seam cannot produce. Building a fixture purely to light the enum would be the fabricated-fixture the brief forbids. Recorded as not constructed rather than counted as a pass.",
  };
  const unreachableInspection = ALL_REASON_IDS.map((id) => ({
    id,
    emitted: emittedIds.has(id),
    finding: emittedIds.has(id) ? "EMITTED by at least one fixture" : (NOT_EMITTED_FINDINGS[id] ?? "NOT EMITTED — no finding recorded; investigate before relying on it"),
  }));

  const counts = fixtures.reduce(
    (acc, f) => {
      acc[f.status] = (acc[f.status] ?? 0) + 1;
      return acc;
    },
    { PASS: 0, FAIL: 0, VACUOUS: 0, ERROR: 0 },
  );

  out = {
    generatedAt: new Date().toISOString(),
    checkpoint: "ROADMAP ITEM 4 — parent residual viability controlled fixtures",
    authority: "src/sim/agents/fissionParentResidualViability.ts",
    fixtures,
    unreachableInspection,
    summary: {
      total: fixtures.length,
      passing: counts.PASS,
      failing: counts.FAIL,
      vacuous: counts.VACUOUS,
      errored: counts.ERROR,
      reasonIdsInVocabulary: ALL_REASON_IDS.length,
      reasonIdsEmitted: unreachableInspection.filter((u) => u.emitted).length,
      reasonIdsNotEmitted: unreachableInspection.filter((u) => !u.emitted).length,
      reasonIdsNotEmittedWithoutAFinding: unreachableInspection.filter(
        (u) => !u.emitted && NOT_EMITTED_FINDINGS[u.id] === undefined,
      ).length,
    },
  };
} finally {
  await server.close();
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
for (const f of out.fixtures) {
  console.log(`${f.status.padEnd(7)} ${f.id}  ${f.claim}`);
  if (f.status !== "PASS") {
    console.log(`        ${JSON.stringify(f).slice(0, 900)}`);
  }
}
console.log(`\nsummary: ${JSON.stringify(out.summary)}`);
console.log(`written: ${OUT}`);
if (out.summary.failing > 0 || out.summary.vacuous > 0 || out.summary.errored > 0) {
  process.exitCode = 1;
}
