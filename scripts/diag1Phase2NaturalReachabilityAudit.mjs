// Read-only structural reachability proof for retained Phase-2 natural instruments.
// The natural payload deliberately does not serialize the new coverage/classification
// fields; absence of a key is therefore not treated as absence of a state.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";

const ROOT = process.cwd();
const NATURAL = join(ROOT, "docs/evidence/diag1-corrections/phase2/natural");
const OUT = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : join(ROOT, "docs/evidence/diag1-corrections/phase2/validation-round2/natural-reachability-structural.json");
const source = (p) => readFileSync(join(ROOT, p), "utf8");
const sourceHashes = {
  nutritionExposure: createHash("sha256").update(source("src/sim/agents/nutritionExposure.ts")).digest("hex"),
  seasonalSurvival: createHash("sha256").update(source("src/sim/agents/seasonalSurvival.ts")).digest("hex"),
  demography: createHash("sha256").update(source("src/sim/agents/demography.ts")).digest("hex"),
  advance: createHash("sha256").update(source("src/sim/tick/advance.ts")).digest("hex"),
};
const files = readdirSync(NATURAL).filter((f) => /^phase2-final3-.*\.json\.gz$/.test(f)).sort();
const courses = files.map((name) => JSON.parse(gunzipSync(readFileSync(join(NATURAL, name))).toString("utf8")));
const structural = {
  retainedFiles: files,
  courseCount: courses.length,
  dailyRowsEach: courses.map((d) => d.dailyRows?.length ?? 0),
  seasonRowsEach: courses.map((d) => d.seasonRows?.length ?? 0),
  residentialRowsEach: courses.map((d) => d.dailyRows.filter((r) => r.bands.every((b) => b.phase === "residential")).length),
  nonResidentialDailyRowsEach: courses.map((d) => d.dailyRows.filter((r) => r.bands.some((b) => b.phase !== "residential")).length),
  serializedCoverageFieldCount: courses.reduce((n, d) => n + d.dailyRows.reduce((m, r) => m + r.bands.filter((b) => Object.hasOwn(b, "nutritionCoverage") || Object.hasOwn(b, "knownPopulationFraction")).length, 0), 0),
  serializedClassificationFieldCount: courses.reduce((n, d) => n + d.dailyRows.reduce((m, r) => m + r.bands.filter((b) => Object.hasOwn(b, "hungerClassification")).length, 0), 0),
};
const advanceSource = source("src/sim/tick/advance.ts");
const seasonalTickStart = advanceSource.indexOf("function runSeasonalCompatibilityTick(");
const nextFunction = advanceSource.indexOf("\nfunction ", seasonalTickStart + 1);
const seasonalTickBody = advanceSource.slice(seasonalTickStart, nextFunction < 0 ? undefined : nextFunction);
const residentialSource = source("src/sim/agents/seasonalSurvival.ts");
const residentialUpdateStart = residentialSource.indexOf("function updateSeasonalSupportState(");
const residentialUpdateBody = residentialSource.slice(residentialUpdateStart, residentialSource.indexOf("\nexport function", residentialUpdateStart + 1));
const demographySource = source("src/sim/agents/demography.ts");
const demographyBodyStart = demographySource.indexOf("export function updateBandsDemographyAndFission(");
const demographyBody = demographySource.slice(demographyBodyStart, demographySource.indexOf("\nexport function", demographyBodyStart + 1));
const annualDemographyStart = demographySource.indexOf("function computeBandDemography(");
const annualDemographyBody = demographySource.slice(annualDemographyStart, demographySource.indexOf("\nfunction ", annualDemographyStart + 1));
const advanceWorldStart = advanceSource.indexOf("export function advanceWorldByDays(");
const advanceWorldBody = advanceSource.slice(advanceWorldStart, advanceSource.indexOf("\nfunction runSeasonalCompatibilityTick(", advanceWorldStart));
const naturalSeasonRowsComplete = courses.every((course) => {
  const rows = course.seasonRows ?? [];
  return rows.length === 120 && rows[0]?.day === 90 && rows.every((row, i) =>
    row.phase === "residential" && Number.isFinite(row.support) && Number.isFinite(row.demand) &&
    row.samples >= 1 && row.segments >= 1 && row.day === (i + 1) * 90);
});
const invariants = {
  sixCourses: structural.courseCount === 6,
  "10800DailyRowsEach": structural.dailyRowsEach.every((n) => n === 10800),
  "120SeasonRowsEach": structural.seasonRowsEach.every((n) => n === 120),
  allDailyRowsResidential: structural.nonResidentialDailyRowsEach.every((n) => n === 0),
  classificationsNotClaimedFromMissingKeys: structural.serializedCoverageFieldCount === 0 && structural.serializedClassificationFieldCount === 0,
  physicalExposureRejectsOverlap: /overlapping_exposure/.test(source("src/sim/agents/nutritionExposure.ts")) && /query contains overlapping producers/.test(source("src/sim/agents/nutritionExposure.ts")),
  physicalProducerHasChronology: /startDay:.*endDay - 90/.test(source("src/sim/agents/seasonalSurvival.ts")) && /exposureAsOfDay/.test(source("src/sim/agents/seasonalSurvival.ts")),
  annualUses360DayQuery: /deriveAnnualNutritionState/.test(source("src/sim/agents/demography.ts")) && /ANNUAL_NUTRITION_DAYS/.test(source("src/sim/agents/seasonalSurvival.ts")) && /querySupportExposure\(support, endDay, ANNUAL_NUTRITION_DAYS\)/.test(source("src/sim/agents/seasonalSurvival.ts")),
  annualRunsAfterSeasonSupport: seasonalTickBody.indexOf("updateBandsDemographyAndFission(") >= 0 &&
    seasonalTickBody.indexOf("updateBandsDemographyAndFission(") < seasonalTickBody.indexOf("advanceTileDepletion("),
  ordinaryResidentialProducerUsesFullBodyTime: residentialUpdateBody.includes('makeNutritionExposure("residential"') &&
    !residentialUpdateBody.includes("knownPopulationFraction") &&
    /isProvisionalSuccessor\(band\)/.test(residentialUpdateBody),
  changedCoverageBranchesRequirePartialOrShiftedInput: residentialSource.includes("current.coverage >= 1") &&
    residentialSource.includes("currentDay ?? exposureEndDay(support)") &&
    residentialSource.includes("knownPopulationFraction ?? 1"),
  retainedSeasonRowsHaveDatedSupportAndDemand: naturalSeasonRowsComplete,
  dailyResidenceProducerRunsBeforeSeasonalAnnualRead: advanceWorldBody.indexOf("runDailyActions(") >= 0 &&
    advanceWorldBody.indexOf("runDailyActions(") < advanceWorldBody.indexOf("runSeasonalCompatibilityTick(") &&
    source("src/sim/agents/dailyActionRegistry.ts").indexOf("residentialNutritionDailyAction") >= 0,
  annualReaderIsInsideAnnualDemographyPath: annualDemographyBody.includes("const nutrition = deriveAnnualNutritionState(seasonalSupport, getCalendarDay(world.time));") &&
    annualDemographyBody.indexOf("deriveAnnualNutritionState") > annualDemographyBody.indexOf("const seasonalSupport = band.seasonalSupport"),
  recoveryThresholdIntegral: /seasonalRecoveryStreak\s*>=\s*1/.test(source("src/sim/agents/seasonalSurvival.ts")) && /seasonalRecoveryStreak[^\n]*>=\s*1/.test(source("src/sim/agents/bandChronicle.ts")),
  partialCoverageExcludedFromRecovery: /knownPopulationFraction \?\? 1\) === 1/.test(source("src/sim/agents/seasonalSurvival.ts")) && /nutritionCoverage \?\? 1\) >= 1/.test(source("src/sim/agents/seasonalSurvival.ts")),
};
const pass = Object.values(invariants).every(Boolean);
const out = { check: "DIAG1-PHASE2-NATURAL-REACHABILITY-STRUCTURAL", verdict: pass ? "PASS" : "FAIL", inferenceBoundary: "Serialized-field absence is not treated as a state-exclusion proof. The retained residential chronology is paired with source-level producer, coverage-branch, annual-reader and executed seasonal-pipeline order invariants; this is a reachability boundary, not a claim that missing serialized keys encode state.", structural, invariants, sourceHashes };
mkdirSync(join(OUT, ".."), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify(out, null, 2));
if (!pass) process.exitCode = 1;
