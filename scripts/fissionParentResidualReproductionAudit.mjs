// ROADMAP ITEM 4 — reproduction of the defect that shaped the parent-residual model.
//
// WHAT THIS MEASURES, AND WHAT IT CANNOT.
//
// The defect being reproduced lived in an INTERRUPTED, UNCOMMITTED implementation of
// `fissionParentResidualViability.ts`. There is no commit to run it from, so the usual
// before-tree/after-tree comparison is not available and is not claimed here.
//
// Instead this audit does two separable things and labels them apart:
//
//   ARM 1 — `superseded_model_reconstruction`. The interrupted model's arithmetic, transcribed
//   constant for constant from the file as it stood, and run inline. It is a RECONSTRUCTION and is
//   named as one. Its purpose is to make the decomposition checkable: how much of each refusal came
//   from hardship the split did not cause. The raw output of the real interrupted code is preserved
//   verbatim in `PARENT_RESIDUAL_DECISION.md` alongside this, so the reconstruction can be checked
//   against what the real module actually printed.
//
//   ARM 2 — the CURRENT production authority, unmodified, on identical inputs.
//
// The claim is the decomposition, not a trajectory comparison. No world is stepped here.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/dynamic-fission-daughter-viability-37";
const OUT = arg("out", `${EVIDENCE}/parent-residual-prior-strain-reproduction.json`);

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const round2 = (v) => Math.round(v * 100) / 100;
const round4 = (v) => Math.round(v * 10000) / 10000;

// ── ARM 1: the superseded single-aggregate model, transcribed ────────────────────────────────
//
// Every constant below is the interrupted file's own. The single `residualStrain` summed
// split-caused deterioration and pre-existing hardship into one number and compared it against one
// threshold, which is the defect.
const SUPERSEDED_THRESHOLD = 0.62;

function supersededModel(parentBefore, allocation, ctx) {
  const residual = allocation.parentRemainder;
  const residualPeople = residual.workingAdults + residual.dependents + residual.elders;
  const residualPeopleAtCamp = residualPeople - ctx.physicallyAwayPeople;
  const committedLabour = ctx.physicallyAwayWorkers + ctx.preparedCommitmentWorkers;
  const residualWorkingAdultsAtCamp = residual.workingAdults - committedLabour;

  const dependencyLoadAfter =
    residual.workingAdults <= 0
      ? Number.POSITIVE_INFINITY
      : (residual.dependents + residual.elders) / residual.workingAdults;
  const dependencyLoadBefore =
    parentBefore.workingAdults <= 0
      ? Number.POSITIVE_INFINITY
      : (parentBefore.dependents + parentBefore.elders) / parentBefore.workingAdults;
  const labourShareAtCamp =
    residualPeopleAtCamp <= 0 ? 0 : clamp01(Math.max(0, residualWorkingAdultsAtCamp) / residualPeopleAtCamp);

  const dependencyWorsening =
    !Number.isFinite(dependencyLoadAfter) || !Number.isFinite(dependencyLoadBefore)
      ? 1
      : clamp01((dependencyLoadAfter - dependencyLoadBefore) / 1.5);
  const labourThinness = clamp01(1 - labourShareAtCamp / 0.4);
  const nutritionStrain = ctx.nutritionStateAvailable
    ? clamp01(
        ctx.foodDemographicPressure * 0.5 + ctx.chronicFoodStress * 0.34 + clamp01(ctx.chronicDeficitStreak / 8) * 0.28,
      )
    : 0;
  const embodiedStrain = clamp01(
    ctx.acuteRiskSeverity * 0.46 + ctx.sicknessBurden * 0.38 + ctx.careTravelBurden * 0.28,
  );
  const mobilityStrain = clamp01(1 - ctx.mobilityCapability);
  const ecologicalStrain = clamp01(ctx.ecologicalRisk);

  // The two groups the superseded model added together. Separating them here is the whole point.
  const splitCausedPart = dependencyWorsening * 0.3 + labourThinness * 0.34;
  const preExistingPart = nutritionStrain * 0.24 + embodiedStrain * 0.2 + mobilityStrain * 0.14 + ecologicalStrain * 0.12;
  const residualStrain = clamp01(splitCausedPart + preExistingPart);

  const structurallyRefused =
    residualPeopleAtCamp < 1 || residualWorkingAdultsAtCamp < 1 || residual.workingAdults < committedLabour;
  const refused = structurallyRefused || residualStrain >= SUPERSEDED_THRESHOLD;

  return {
    residualStrain: round4(residualStrain),
    splitCausedPart: round4(splitCausedPart),
    preExistingPart: round4(preExistingPart),
    preExistingShareOfStrain: residualStrain > 0 ? round4(preExistingPart / residualStrain) : 0,
    structurallyRefused,
    refused,
    threshold: SUPERSEDED_THRESHOLD,
  };
}

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-i4repro-${process.pid}`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  logLevel: "error",
});

let out;
try {
  const alloc = await server.ssrLoadModule("/sim/agents/fissionFounderAllocation.ts");
  const viability = await server.ssrLoadModule("/sim/agents/fissionParentResidualViability.ts");

  // Contexts. `sound` is a parent carrying nothing; `hardship` is the parent whose refusal the
  // reproduction is about — maximum hunger, maximum embodied hardship, degraded mobility, adverse
  // ground. NONE of it is caused by, or changed by, a departure.
  const soundCtx = {
    physicallyAwayPeople: 0,
    physicallyAwayWorkers: 0,
    preparedCommitmentWorkers: 0,
    foodDemographicPressure: 0,
    chronicFoodStress: 0,
    chronicDeficitStreak: 0,
    nutritionStateAvailable: true,
    acuteRiskSeverity: 0,
    sicknessBurden: 0,
    careTravelBurden: 0,
    mobilityCapability: 1,
    ecologicalRisk: 0,
  };
  const hardshipCtx = {
    ...soundCtx,
    foodDemographicPressure: 1,
    chronicFoodStress: 1,
    chronicDeficitStreak: 12,
    acuteRiskSeverity: 1,
    sicknessBurden: 1,
    careTravelBurden: 1,
    mobilityCapability: 0.1,
    ecologicalRisk: 0.9,
  };

  // Translate a superseded context into the current authority's input shape. The mobility scalar
  // becomes a before/after PAIR held equal, because the superseded model had no notion of the split
  // moving it — holding it equal is what makes the two arms comparable rather than re-scored.
  const toCurrent = (parentBefore, allocation, ctx, minimumFounderRequest) => ({
    parentBefore,
    allocation,
    physicallyAwayPeople: ctx.physicallyAwayPeople,
    physicallyAwayWorkers: ctx.physicallyAwayWorkers,
    preparedCommitmentWorkers: ctx.preparedCommitmentWorkers,
    foodDemographicPressure: ctx.foodDemographicPressure,
    chronicFoodStress: ctx.chronicFoodStress,
    chronicDeficitStreak: ctx.chronicDeficitStreak,
    nutritionMeasured: ctx.nutritionStateAvailable,
    acuteRiskSeverity: ctx.acuteRiskSeverity,
    sicknessBurden: ctx.sicknessBurden,
    careTravelBurden: ctx.careTravelBurden,
    embodiedConditionMeasured: true,
    ecologicalRisk: ctx.ecologicalRisk,
    ecologicalPositionMeasured: true,
    mobilityCapabilityBefore: ctx.mobilityCapability,
    mobilityCapabilityAfter: ctx.mobilityCapability,
    minimumFounderRequest,
  });

  const cases = [
    { id: "R1_natural_s1_sound", parent: { workingAdults: 29, dependents: 14, elders: 7 }, request: 18, ctx: soundCtx, min: 18 },
    { id: "R2_struggling_parent_hardship", parent: { workingAdults: 10, dependents: 26, elders: 14 }, request: 18, ctx: hardshipCtx, min: 18 },
    { id: "R3_struggling_parent_hardship_low_minimum", parent: { workingAdults: 10, dependents: 26, elders: 14 }, request: 18, ctx: hardshipCtx, min: 2 },
    { id: "R4_healthy_composition_hardship_only", parent: { workingAdults: 29, dependents: 14, elders: 7 }, request: 6, ctx: hardshipCtx, min: 2 },
  ];

  const rows = [];
  for (const c of cases) {
    const a = alloc.allocateFounderCohorts(c.parent, c.request);
    if (a.ok !== true) {
      rows.push({ id: c.id, allocationRefused: a.refusal });
      continue;
    }
    const before = supersededModel(c.parent, a.allocation, c.ctx);
    const after = viability.assessParentResidualWithRevision(toCurrent(c.parent, a.allocation, c.ctx, c.min));
    rows.push({
      id: c.id,
      parentBefore: c.parent,
      requestedFounders: c.request,
      minimumFounderRequest: c.min,
      allocation: { successor: a.allocation.successor, parentRemainder: a.allocation.parentRemainder, exact: a.allocation.exact },
      supersededModelReconstruction: before,
      currentAuthority: {
        verdict: after.verdict,
        blockKind: after.blockKind,
        splitCausedDamage: after.limiting.splitCausedDamage,
        priorFragility: after.limiting.priorFragility,
        tolerance: after.limiting.tolerance,
        revisedFounderRequest: after.revisedFounderRequest ?? null,
        departureBlocked: after.departureBlocked,
        revisionCandidatesEvaluated: after.revisionCandidatesEvaluated,
      },
    });
  }

  // ── the two claims this reproduction exists to establish ──
  const r2 = rows.find((r) => r.id === "R2_struggling_parent_hardship");
  const r3 = rows.find((r) => r.id === "R3_struggling_parent_hardship_low_minimum");

  const claims = {
    // 1. In the superseded model, the refusal of a struggling parent was mostly not about the split.
    prior_hardship_dominated_the_superseded_refusal: {
      holds: r2.supersededModelReconstruction.refused && r2.supersededModelReconstruction.preExistingShareOfStrain > 0.5,
      residualStrain: r2.supersededModelReconstruction.residualStrain,
      splitCausedPart: r2.supersededModelReconstruction.splitCausedPart,
      preExistingPart: r2.supersededModelReconstruction.preExistingPart,
      preExistingShareOfStrain: r2.supersededModelReconstruction.preExistingShareOfStrain,
      note: "the share of the refusing score contributed by hardship the split did not cause and could not change",
    },
    // 2. And it was irreparable by the one remedy this authority has, because every dominant term
    //    was invariant to the founder count.
    superseded_refusal_was_invariant_to_founder_count: {
      holds:
        r2.supersededModelReconstruction.residualStrain === r3.supersededModelReconstruction.residualStrain &&
        r2.supersededModelReconstruction.refused &&
        r3.supersededModelReconstruction.refused,
      strainAtMinimum18: r2.supersededModelReconstruction.residualStrain,
      strainAtMinimum2: r3.supersededModelReconstruction.residualStrain,
      note: "lowering the caller's minimum founder request from 18 to 2 moved the superseded score not at all",
    },
    // 3. The current authority repairs exactly that, and nothing else about the case changed.
    current_authority_finds_a_smaller_request: {
      holds: r3.currentAuthority.verdict === "residual_viable_only_after_revision" && r3.currentAuthority.revisedFounderRequest !== null,
      verdict: r3.currentAuthority.verdict,
      revisedFounderRequest: r3.currentAuthority.revisedFounderRequest,
      splitCausedDamage: r3.currentAuthority.splitCausedDamage,
      priorFragility: r3.currentAuthority.priorFragility,
      tolerance: r3.currentAuthority.tolerance,
    },
    // 4. And a fragile parent is still held to a stricter standard — hardship is not made irrelevant.
    current_authority_still_narrows_tolerance_under_hardship: {
      holds: r3.currentAuthority.tolerance < 0.52,
      toleranceUnderHardship: r3.currentAuthority.tolerance,
      toleranceBase: 0.52,
    },
  };

  out = {
    generatedAt: new Date().toISOString(),
    checkpoint: "ROADMAP ITEM 4 — parent residual viability",
    what_this_is:
      "Reproduction of the defect that shaped the parent-residual model. ARM 1 is a RECONSTRUCTION of an interrupted, uncommitted implementation and is labelled as one; there is no commit to run it from and no trajectory comparison is claimed.",
    supersededModelSource: {
      file: "src/sim/agents/fissionParentResidualViability.ts (interrupted, uncommitted)",
      threshold: SUPERSEDED_THRESHOLD,
      weights: {
        dependencyWorsening: 0.3,
        labourThinness: 0.34,
        nutritionStrain: 0.24,
        embodiedStrain: 0.2,
        mobilityStrain: 0.14,
        ecologicalStrain: 0.12,
      },
    },
    rows,
    claims,
    summary: {
      claimsChecked: Object.keys(claims).length,
      claimsHolding: Object.values(claims).filter((c) => c.holds).length,
      claimsFailing: Object.values(claims).filter((c) => !c.holds).length,
    },
  };
} finally {
  await server.close();
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify(out.claims, null, 2));
console.log(`\nsummary: ${JSON.stringify(out.summary)}`);
console.log(`written: ${OUT}`);
if (out.summary.claimsFailing > 0) {
  process.exitCode = 1;
}
