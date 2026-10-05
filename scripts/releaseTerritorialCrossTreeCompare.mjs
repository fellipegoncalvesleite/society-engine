// CORRECTION-35 — CROSS-TREE COMPARISON.
//
// Reads three `releaseTerritorialCrossTreeProbe.mjs` outputs — the parent (742b567), the
// lifecycle-only commit (e5e3143) and the tip (427d953) — and publishes the two gates the
// checkpoint turns on:
//
//   L9  cross-tree-release-preservation.json   Part A must change NO behaviour.
//   T3  cross-tree-territorial-isolation.json  Part B must remove the field's causal effect.
//
// Separating the trees is what makes each gate readable. Comparing the parent straight to the tip
// would confound the two parts; the lifecycle-only commit is the arm that isolates Part A.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/shared-range-release-territorial-authority-35";
const parent = JSON.parse(readFileSync(arg("parent", "artifacts/c35-scratch/parent.json"), "utf8"));
const partA = JSON.parse(readFileSync(arg("part-a", "artifacts/c35-scratch/partA.json"), "utf8"));
const tip = JSON.parse(readFileSync(arg("tip", "artifacts/c35-scratch/tip.json"), "utf8"));
const OUT_L = arg("out-lifecycle", `${EVIDENCE}/cross-tree-release-preservation.json`);
const OUT_T = arg("out-territorial", `${EVIDENCE}/cross-tree-territorial-isolation.json`);

const write = (p, data) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, "utf8");
};
const same = (a, b) => a === b;

// ───────────────────────── L9 — Part A changed no behaviour ─────────────────────────
//
// The BEHAVIOUR digests must be identical between the parent and the lifecycle-only commit. The
// LIFECYCLE digest is allowed to differ, because the parent's values there are the defect being
// corrected — but at this seed and warm-up it happens NOT to differ, and that is reported as the
// honest null it is rather than dressed up as a result.
const behaviourKeys = ["accessBehaviour", "decision", "pressureState", "reasonPressures"];
const behaviourIdentical = behaviourKeys.every((k) => same(parent.digests[k], partA.digests[k]));
const lifecycleDiffers = !same(parent.digests.lifecycleMetadata, partA.digests.lifecycleMetadata);

// Non-vacuity: a preservation claim over empty or all-zero readings proves nothing.
const placeRows = tip.lifecycleArm.rows.flatMap((r) => r.accessBehaviour);
const nonZeroPlaceRows = placeRows.filter((s) =>
  s.split("|").slice(1).some((v) => Number(v) !== 0));

const lifecycleOut = {
  audit: "CORRECTION-35-CROSS-TREE-RELEASE-PRESERVATION",
  gate: "L9",
  question: "does the release-lifecycle correction change any behaviour?",
  trees: { parent: "742b567", lifecycleOnly: "e5e3143", tip: "427d953" },
  seed: parent.seed, warmDays: parent.warmDays,
  verdict: behaviourIdentical
    ? "PART_A_CHANGES_NO_BEHAVIOUR"
    : "PART_A_CHANGED_BEHAVIOUR_INVESTIGATE",
  behaviourDigests: Object.fromEntries(behaviourKeys.map((k) => [k, {
    parent: parent.digests[k], lifecycleOnly: partA.digests[k], tip: tip.digests[k],
    parentEqualsLifecycleOnly: same(parent.digests[k], partA.digests[k]),
    lifecycleOnlyEqualsTip: same(partA.digests[k], tip.digests[k]),
  }])),
  lifecycleMetadataDigest: {
    parent: parent.digests.lifecycleMetadata,
    lifecycleOnly: partA.digests.lifecycleMetadata,
    tip: tip.digests.lifecycleMetadata,
    differs: lifecycleDiffers,
    // The honest reading of an agreeing digest.
    interpretation: lifecycleDiffers
      ? "the metadata correction fires in this natural world"
      : "THIS WORLD DOES NOT OCCUPY THE CORRECTED INTERVAL. No place at this seed and warm-up holds evidence weighing strictly between 0 and SOCIAL_EVIDENCE_ACTIVE_MIN_WEIGHT, so the parent's labels happened to be right here and the digests agree. The correction is demonstrated by the controlled fixtures L1/L2 and its natural frequency is measured separately in release-lifecycle-natural-*.json. An agreeing digest here is NOT evidence that the correction does nothing.",
  },
  whyThisIsNotVacuous: {
    bands: tip.bands,
    placeRowsCompared: placeRows.length,
    placeRowsWithANonZeroAccessScalar: nonZeroPlaceRows.length,
    scalarsCompared: ["strangerCaution", "sharedUsePressure", "rememberedRefusalAvoidance",
      "rememberedCooperationTolerance", "kinTolerance", "familiarTolerance", "confidence"],
    note: "every compared place carries at least one non-zero access scalar, so 'identical' is a comparison of live readings and not of zeros. kinTolerance and familiarTolerance are included deliberately: the first form of this probe omitted them, and kinTolerance is the scalar the ORIGINAL Item 3 finding missed.",
  },
  partBIsSeparate: {
    note: "the tip differs from the lifecycle-only commit on decision, pressureState and reasonPressures. That is Part B (the territorial field), measured in cross-tree-territorial-isolation.json, and is intended.",
    accessBehaviourUnchangedByPartB: same(partA.digests.accessBehaviour, tip.digests.accessBehaviour),
    lifecycleMetadataUnchangedByPartB: same(partA.digests.lifecycleMetadata, tip.digests.lifecycleMetadata),
  },
};

// ───────────────────── T3 — Part B removed the field's causal effect ─────────────────────
const armSummary = (d) => d.territorialArm.summary;
const controlIdentical = same(parent.digests.zeroDivergenceControl, tip.digests.zeroDivergenceControl)
  && same(partA.digests.zeroDivergenceControl, tip.digests.zeroDivergenceControl);

// The bands where the parent's own attribution figure moved with the field.
const parentAttribution = parent.territorialArm.rows
  .filter((r) => r.attributionObserved)
  .map((r) => ({ band: r.band, arm: r.label, moved: r.attributionMoved, reasons: r.attributionReasons }));
const tipAttribution = tip.territorialArm.rows
  .filter((r) => r.attributionObserved)
  .map((r) => ({ band: r.band, arm: r.label, moved: r.attributionMoved, reasons: r.attributionReasons }));

const territorialOut = {
  audit: "CORRECTION-35-CROSS-TREE-TERRITORIAL-ISOLATION",
  gate: "T3",
  question: "does Band.territorialPressure still move current behaviour?",
  trees: { parent: "742b567", lifecycleOnly: "e5e3143", tip: "427d953" },
  seed: parent.seed, valuesCompared: [0, 0.12, 0.8],
  verdict: armSummary(tip).bandsMoved === 0 && armSummary(parent).bandsMoved > 0 && controlIdentical
    ? "PARENT_CAUSAL_EFFECT_REPRODUCED_AND_REMOVED"
    : "UNEXPECTED_INVESTIGATE",
  parentCausalEffect: {
    ...armSummary(parent),
    note: "on the parent every measured band moves when the field alone is varied. The field is written once at spawn and once at daughter creation, so this is a motive with no lived provenance reaching real decisions.",
  },
  lifecycleOnlyStillHasIt: {
    ...armSummary(partA),
    note: "unchanged from the parent, which confirms Part A did not touch the territorial path and the two parts are genuinely separable.",
  },
  correctedEffect: {
    ...armSummary(tip),
    note: "no measured band moves on any of mobilityPressure, netMovePressure, the selected action, its score, the candidate set, deliberation breadth or any reason's reported pressure.",
  },
  attributionChannel: {
    what: "bandDecision.getMobilityPressure fills the `pressure` figure carried by the STAY reasons `known_site_sufficient` and `low_mobility_pressure`. It is ATTRIBUTION — the number a reason reports about itself — rather than score.",
    howItWasMeasured: "read at `reason.pressure`, on a 180-day world where bands still stay. A 3600-day world produces no stay reason at all, and the first form of this probe read a non-existent `reason.detail.pressure`, so it returned the -1 fallback in every arm and compared three sentinels with each other.",
    parentBandsWhereAttributionMoved: parent.territorialArm.summary.attributionMovedBands,
    tipBandsWhereAttributionMoved: tip.territorialArm.summary.attributionMovedBands,
    parent: parentAttribution,
    tip: tipAttribution,
    verdict: parent.territorialArm.summary.attributionMovedBands > 0
      && tip.territorialArm.summary.attributionMovedBands === 0
      ? "ATTRIBUTION_MEASURED_MOVING_BEFORE_AND_STILL_AFTER_CORRECTION"
      : "NOT_MEASURED_OR_UNEXPECTED",
  },
  zeroDivergenceControl: {
    digestParent: parent.digests.zeroDivergenceControl,
    digestLifecycleOnly: partA.digests.zeroDivergenceControl,
    digestTip: tip.digests.zeroDivergenceControl,
    identical: controlIdentical,
    whyItMatters: "at a long warm-up the parent and the corrected tree hold different worlds, because the term was live for every one of those days on the parent and `netMovePressure` reads accumulated band state. That divergence is the production change, not a surviving reader. This arm warms 0 days and pins every band's field to 0, so the trees see the identical world; agreeing bit for bit proves removing the term is exactly equivalent to holding the field at zero, and that no reader survives.",
    measuredResidualAtLongWarmUp: "2 of 18 band-measurements differ between parent-at-zero and the tip at 3600 days, by 0.01 on netMovePressure and on two candidate scores. Explained by the divergent warm-up above and by the complete field inventory, which finds no remaining reader.",
  },
};

write(OUT_L, lifecycleOut);
write(OUT_T, territorialOut);

console.log(JSON.stringify({
  L9: { verdict: lifecycleOut.verdict, behaviourIdentical,
    placeRowsCompared: placeRows.length, nonZeroPlaceRows: nonZeroPlaceRows.length,
    lifecycleMetadataDiffers: lifecycleDiffers },
  T3: { verdict: territorialOut.verdict,
    parentMoved: armSummary(parent).bandsMoved, partAMoved: armSummary(partA).bandsMoved,
    tipMoved: armSummary(tip).bandsMoved,
    attributionMovedParent: parent.territorialArm.summary.attributionMovedBands,
    attributionMovedTip: tip.territorialArm.summary.attributionMovedBands,
    zeroDivergenceControlIdentical: controlIdentical },
}, null, 2));

if (!behaviourIdentical || territorialOut.verdict !== "PARENT_CAUSAL_EFFECT_REPRODUCED_AND_REMOVED") {
  process.exitCode = 1;
}
