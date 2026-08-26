// SCALE-1 Task 8 — adversarial self-discrimination audit.
// This script intentionally exercises the Task-8 certification's ability to reject
// audit-only corruptions. It must not mutate production state.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { TASK8_PHYSICAL_FIXTURE } from "./lib/scale1Task8ContinuousFixture.mjs";

const ROOT = process.cwd();
const mainSource = readFileSync(`${ROOT}/scripts/scale1Task8CrossResolutionCertificationAudit.mjs`, "utf8");
const main = JSON.parse(execFileSync(process.execPath, ["scripts/scale1Task8CrossResolutionCertificationAudit.mjs"], {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
}));

const riverXKm = TASK8_PHYSICAL_FIXTURE.river.xKm;
const aligns = (cellKm) => Math.abs(riverXKm / cellKm - Math.round(riverXKm / cellKm)) <= 1e-9;
const self = main.selfDiscrimination ?? {};
const oneKm = main.measurements?.oneKm ?? {};
const onePointFiveKm = main.measurements?.onePointFiveKm ?? {};

const checks = {
  H1_canonical_river_is_non_aligned: !aligns(1) && !aligns(1.5),
  H1_rasterizer_reports_geometric_segment_intersection:
    /center-to-center segment/i.test(main.fixtureAuthority?.rasterizationRule ?? ""),
  H2_route_negative_control_rejected: self.routeNegativeControlRejected === true,
  H3_one_km_catchment_exact_oracle: oneKm.catchment?.oracleExactMatch === true,
  H3_one_point_five_km_catchment_exact_oracle: onePointFiveKm.catchment?.oracleExactMatch === true,
  H3_oracle_uses_continuous_physical_origin:
    JSON.stringify(oneKm.catchment?.oraclePhysicalOrigin) === JSON.stringify(TASK8_PHYSICAL_FIXTURE.points.catchmentOrigin) &&
    JSON.stringify(onePointFiveKm.catchment?.oraclePhysicalOrigin) === JSON.stringify(TASK8_PHYSICAL_FIXTURE.points.catchmentOrigin),
  H3_safe_inside_outside_and_boundary_probes:
    oneKm.catchment?.probes?.inside?.safelyClassified === true &&
    onePointFiveKm.catchment?.probes?.inside?.safelyClassified === true &&
    oneKm.catchment?.probes?.outside?.safelyClassified === true &&
    onePointFiveKm.catchment?.probes?.outside?.safelyClassified === true &&
    oneKm.catchment?.probes?.boundary?.safelyClassified === false &&
    onePointFiveKm.catchment?.probes?.boundary?.safelyClassified === false,
  H3_catchment_negative_control_rejected: self.catchmentNegativeControlRejected === true,
  H4_perception_snapshots_straddle_real_cue_call:
    typeof oneKm.perception?.knowledgeBeforeFingerprint === "string" &&
    typeof oneKm.perception?.knowledgeAfterFingerprint === "string" &&
    oneKm.perception.knowledgeBeforeFingerprint === oneKm.perception.knowledgeAfterFingerprint &&
    typeof onePointFiveKm.perception?.knowledgeBeforeFingerprint === "string" &&
    typeof onePointFiveKm.perception?.knowledgeAfterFingerprint === "string" &&
    onePointFiveKm.perception.knowledgeBeforeFingerprint === onePointFiveKm.perception.knowledgeAfterFingerprint,
  H4_perception_negative_control_rejected:
    oneKm.perception?.insertedCueTargetMutationConstructed === true &&
    onePointFiveKm.perception?.insertedCueTargetMutationConstructed === true &&
    self.perceptionNegativeControlRejected === true,
  H5_magic_0_02_removed: !/weightedCrowding[^\n]*0\.02|0\.02[^\n]*weightedCrowding/.test(mainSource),
  H5_crowding_numeric_equality_not_acceptance_authority:
    main.tolerances?.socialCrowding?.acceptanceAuthority === "categorical_physical_presence_and_proximity",
  N4_crossing_negative_control_rejected: self.crossingNegativeControlRejected === true,
  H6_open_traversal_equal_but_wrong_time_rejected:
    self.openTraversalTimeNegativeControlRejected === true,
};

const out = {
  audit: "SCALE1-TASK8-CERTIFICATION-DISCRIMINATION",
  verdict: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
  riverXKm,
  checks,
  negativeControls: main.selfDiscrimination ?? null,
};

console.log(JSON.stringify(out, null, 2));
if (out.verdict !== "PASS") process.exitCode = 1;
