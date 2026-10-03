// DIAG-1 Phase2 correction round: unknown body-time coverage and recovery duration.
// The positive path reaches canonical, annual, demography, dry-margin and biome-adaptation
// readers. RED and mutant overlays deliberately restore the old known-subset, duration and
// surplus behaviors so the assertions fail for each targeted defect.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { phase2Harness } from "./lib/diag1Phase2Harness.mjs";

const originalProductionOverlay = process.argv.includes("--red-original") ? {
  name: "diag1-round2-original-production-bytes", enforce: "pre",
  transform(code, id) {
    const relative = id.match(/\/(src\/sim\/agents\/(?:nutritionExposure|seasonalSurvival)\.ts)$/)?.[1];
    if (!relative) return;
    const original = execFileSync("git", ["show", `bf5807e75bb650872d9c81cf95dce5dc1df6a509:${relative}`], { encoding: "utf8" });
    if (relative.endsWith("seasonalSurvival.ts")) {
      // The original bytes predate the coverage-reader exports added in this
      // correction. These audit-only adapters make the complete old consumer
      // set load while leaving every original production function byte-exact.
      return `${original}\nexport function getCurrentNutritionCoverage(s) { return s?.currentSeasonSupport?.nutritionCoverage ?? 1; }\nexport function getCurrentCoverageSafeClampedSupport(s) { return s?.currentSeasonSupport?.clampedSupportRatio ?? 0; }\nexport function getCurrentCoverageSafeWaterStress(s) { return s?.currentSeasonSupport?.waterStress ?? 0; }\nexport function getRecentNutritionCoverage(s) { return 1; }\n`;
    }
    return original;
  },
} : undefined;
const h = await phase2Harness(
  "DIAG1 Phase2 unknown coverage and recovery duration",
  originalProductionOverlay ? [originalProductionOverlay] : [],
);
const [runner, nutrition, time, fission, demography, dryMargin, biomeAdaptation, socialContext, contextCache, campFoothold, nutritionMigration, bodyCampLogistics, pressure] = await Promise.all([
  h.load("runner/simRunner"), h.load("agents/seasonalSurvival"), h.load("tick/time"), h.load("agents/innerFission"),
  h.load("agents/demography"), h.load("agents/dryMargin"), h.load("agents/biomeAdaptation"), h.load("agents/socialContext"),
  h.load("agents/contextCache"), h.load("agents/campFoothold"), h.load("agents/nutritionMigration"),
  h.load("agents/bodyCampLogistics"), h.load("agents/pressure"),
]);
const world = runner.initSimWorld({ kind: "map2" }, "diag1:phase2:coverage-recovery");
const band = Object.values(world.bands)[0];

function sample(startDay, endDay, ratio, knownPopulationFraction = 1, recoveryEligible = ratio >= .98) {
  const days = endDay - startDay;
  const demandUnits = days;
  const supportUnits = ratio * demandUnits;
  const foodStress = Math.max(0, 1 - ratio);
  const t = time.getWorldTimeForDay(endDay);
  return {
    ...t, rawSupportRatio: ratio, clampedSupportRatio: Math.min(1, ratio), perCapitaReturn: ratio >= .98 ? 1 : 0,
    seasonalModifier: 1, foodStress, waterStress: 0, deficitRatio: foodStress,
    mode: ratio >= 1 ? "neutral" : "lean",
    exposure: {
      version: 1, startDay, endDay, durationDays: days, producer: "inherited_condition",
      provenance: "coverage-recovery-controlled", supportUnits, demandUnits,
      foodStressDays: days * knownPopulationFraction * foodStress, waterStressDays: 0,
      recoveryDays: recoveryEligible ? days * knownPopulationFraction : 0,
      segments: [{ startDay, endDay, knownPopulationFraction, supportUnits, demandUnits,
        foodStress, waterStress: 0, perCapitaReturn: ratio >= .98 ? 1 : 0, recoveryEligible }],
    },
  };
}
function legacySample(startDay, endDay, ratio, knownPopulationFraction = 1, recoveryEligible = ratio >= .98) {
  const days = endDay - startDay;
  const t = time.getWorldTimeForDay(endDay);
  const segment = { startDay, endDay, knownPopulationFraction, rawSupportRatio: ratio,
    foodStress: Math.max(0, 1 - ratio), waterStress: 0, perCapitaReturn: ratio >= .98 ? 1 : 0, recoveryEligible };
  return { ...t, rawSupportRatio: ratio, clampedSupportRatio: Math.min(1, ratio), perCapitaReturn: segment.perCapitaReturn,
    seasonalModifier: 1, foodStress: segment.foodStress, waterStress: 0, deficitRatio: segment.foodStress,
    mode: ratio >= 1 ? "neutral" : "lean",
    exposure: { version: 1, startDay, endDay, durationDays: days, producer: "inherited_condition",
      provenance: "coverage-recovery-legacy-control", quantityBasis: "legacy_ratio_only",
      foodStressDays: days * knownPopulationFraction * segment.foodStress, waterStressDays: 0,
      recoveryDays: recoveryEligible ? days * knownPopulationFraction : 0, segments: [segment] } };
}
const write = (state, s) => nutrition.recordSupportInterval(
  state, s, band, time.getWorldTimeForDay(s.exposure.endDay),
  { topSeasonalSupportReasons: ["controlled correction-round exposure"], replaceSameTickSample: false },
);
const withActualDemand = (s, demandUnits) => {
  const segment = s.exposure.segments[0];
  const supportUnits = segment.rawSupportRatio !== undefined
    ? segment.rawSupportRatio * demandUnits : (segment.supportUnits / segment.demandUnits) * demandUnits;
  const exposure = { ...s.exposure, supportUnits, demandUnits,
    segments: [{ ...segment, supportUnits, demandUnits }] };
  return { ...s, exposure };
};
const merge = (s, parentPeople = 3, successorPeople = 9) => nutrition.mergeSupportHistories(
  write(undefined, s), undefined, band, parentPeople, successorPeople, time.getWorldTimeForDay(s.exposure.endDay),
);

// A: 25% known hungry body-time, 75% unknown. The low-level query's known-subset
// mean remains useful telemetry; behavioral state must be coverage-scaled.
const partialHungry = merge(sample(0, 90, 0, 1), 3, 9);
const hungryQuery = nutrition.querySupportExposure(partialHungry, 90, 90);
const hungryCanonical = nutrition.deriveCanonicalNutritionState(partialHungry);
const hungryAnnual = nutrition.deriveAnnualNutritionState(partialHungry, 90);
h.observations.partialHungry = { query: hungryQuery, canonical: hungryCanonical, annual: hungryAnnual };
h.observations.partialHungry.demography = demography.deriveFoodDemographyRateTerms(hungryAnnual, partialHungry);
h.check("partial hungry low-level coverage is explicit", () => {
  assert.equal(hungryQuery.knownPopulationDays, 22.5);
  assert.equal(hungryQuery.unknownPopulationDays, 67.5);
  assert.equal(hungryQuery.foodStressDays, 22.5);
  assert.equal(hungryQuery.pooledSupportRatio, undefined);
});
h.check("partial hunger does not extrapolate current stress", () => assert.equal(hungryCanonical.currentFoodStress, .25));
h.check("partial hunger does not extrapolate annual stress", () => assert.equal(hungryAnnual.currentFoodStress, .25));
h.check("partial hunger keeps movement and demographic pressure coverage-safe", () => {
  assert.ok(hungryCanonical.foodMovementPressure < .5);
  assert.ok(hungryCanonical.foodDemographicPressure < .5);
});

// B: the known subset is comfortable and recovering; unknown people contribute no
// comfort, recovery or surplus evidence.
const partialComfort = write(undefined, sample(0, 90, 1.72, .25, true));
const comfortCanonical = nutrition.deriveCanonicalNutritionState(partialComfort);
const comfortAnnual = nutrition.deriveAnnualNutritionState(partialComfort, 90);
h.observations.partialComfort = { canonical: comfortCanonical, annual: comfortAnnual };
h.observations.partialComfort.demography = demography.deriveFoodDemographyRateTerms(comfortAnnual, partialComfort);
h.check("partial comfort scales recovery to measured body-time", () => assert.equal(comfortAnnual.recoveryRelief, .25));
h.check("partial comfort scales surplus to measured body-time", () => assert.equal(comfortAnnual.nutritionalSurplus, .06));
h.check("partial comfort remains neutral for hunger pressure", () => {
  assert.equal(comfortCanonical.currentFoodStress, 0);
  assert.equal(comfortCanonical.foodMovementPressure, 0);
});
h.check("partial annual demography consumes coverage-safe hungry and comfort terms", () => {
  const hungryTerms = h.observations.partialHungry.demography;
  const comfortTerms = h.observations.partialComfort.demography;
  assert.equal(hungryTerms.currentFoodStress, .25);
  assert.equal(hungryTerms.recentFoodStress, .25);
  assert.equal(hungryTerms.foodPerPersonStress, .17);
  assert.ok(Math.abs(hungryTerms.foodMortalityContribution - .0612) < 1e-12);
  assert.equal(comfortTerms.currentFoodStress, 0);
  assert.equal(comfortTerms.recentFoodStress, 0);
  assert.equal(comfortTerms.foodFertilitySurplusBonus, .0132);
});

const partialHighSurplus = write(undefined, sample(0, 90, 10, .25, true));
const highSurplusAnnual = nutrition.deriveAnnualNutritionState(partialHighSurplus, 90);
h.observations.partialHighSurplus = highSurplusAnnual;
h.check("partial high surplus remains coverage-bounded", () => {
  assert.equal(highSurplusAnnual.recoveryRelief, .25);
  assert.equal(highSurplusAnnual.nutritionalSurplus, .06);
});

// C/D: full coverage retains existing semantics, while no measured body-time is neutral.
const fullHungry = merge(sample(0, 90, 0), 12, 0);
const fullComfort = merge(sample(0, 90, 1.72), 12, 0);

// Compatibility projections are also consumed outside canonical demography. Reach
// the real dry-margin and biome-adaptation readers so partial comfort cannot leak
// through the legacy clamped-support field as an opportunity or competence gain.
const partialBehaviorBand = { ...band, seasonalSupport: partialComfort, carryingCapacity: undefined };
const fullBehaviorBand = { ...band, seasonalSupport: fullComfort, carryingCapacity: undefined };
const partialBehaviorWorld = { ...world, bands: { ...world.bands, [band.id]: partialBehaviorBand } };
const fullBehaviorWorld = { ...world, bands: { ...world.bands, [band.id]: fullBehaviorBand } };
const partialDryMargin = dryMargin.deriveDryMarginMobilityContext(partialBehaviorWorld, partialBehaviorBand);
const fullDryMargin = dryMargin.deriveDryMarginMobilityContext(fullBehaviorWorld, fullBehaviorBand);
const partialBiome = biomeAdaptation.updateBiomeAdaptation({ world: partialBehaviorWorld, band: partialBehaviorBand, observedTileIds: [band.position], nextPosition: band.position, moved: false });
const fullBiome = biomeAdaptation.updateBiomeAdaptation({ world: fullBehaviorWorld, band: fullBehaviorBand, observedTileIds: [band.position], nextPosition: band.position, moved: false });
const partialFissionBand = { ...partialBehaviorBand, innerFission: { pressureScore: .5 },
  pressureState: { fatiguePressure: 0, waterStress: 0 }, socialPressure: { fissionPressure: 0 },
  demography: { ...band.demography, splitPressure: 0 } };
const partialFission = fission.deriveInnerFissionState(partialBehaviorWorld, partialFissionBand);
const partialDisposition = socialContext.applyDispositionContext(partialBehaviorWorld, contextCache.buildTickContextCache(partialBehaviorWorld)).bands[band.id].disposition;
const fullDisposition = socialContext.applyDispositionContext(fullBehaviorWorld, contextCache.buildTickContextCache(fullBehaviorWorld)).bands[band.id].disposition;
const partialFoothold = campFoothold.deriveCampFootholdProfile(partialBehaviorWorld, partialBehaviorBand);
const fullFoothold = campFoothold.deriveCampFootholdProfile(fullBehaviorWorld, fullBehaviorBand);
const partialHungryBehaviorBand = { ...band, seasonalSupport: partialHungry, carryingCapacity: undefined };
const fullHungryBehaviorBand = { ...band, seasonalSupport: fullHungry, carryingCapacity: undefined };
const partialHungryBehaviorWorld = { ...world, bands: { ...world.bands, [band.id]: partialHungryBehaviorBand } };
const fullHungryBehaviorWorld = { ...world, bands: { ...world.bands, [band.id]: fullHungryBehaviorBand } };
const fullHungryFission = fission.deriveInnerFissionState(fullHungryBehaviorWorld, { ...partialFissionBand, seasonalSupport: fullHungry });
const partialHungryFoothold = campFoothold.deriveCampFootholdProfile(partialHungryBehaviorWorld, partialHungryBehaviorBand);
const fullHungryFoothold = campFoothold.deriveCampFootholdProfile(fullHungryBehaviorWorld, fullHungryBehaviorBand);
const mixedTemporal = write(write(undefined, sample(0, 89, 0, .25, false)), sample(89, 90, 1.72, 1, true));
const mixedTemporalBand = { ...band, seasonalSupport: mixedTemporal, carryingCapacity: undefined };
const mixedTemporalWorld = { ...world, bands: { ...world.bands, [band.id]: mixedTemporalBand } };
const mixedTemporalFoothold = campFoothold.deriveCampFootholdProfile(mixedTemporalWorld, mixedTemporalBand);
const seasonalEvidence = (profile) => profile.factors.flatMap((factor) => factor.evidence).find((evidence) => evidence.sourceSystem === "seasonal_support");
const partialSeasonalEvidence = seasonalEvidence(partialFoothold);
const fullSeasonalEvidence = seasonalEvidence(fullFoothold);
const partialHungrySeasonalEvidence = seasonalEvidence(partialHungryFoothold);
const fullHungrySeasonalEvidence = seasonalEvidence(fullHungryFoothold);
const mixedTemporalSeasonalEvidence = seasonalEvidence(mixedTemporalFoothold);
const moodShare = (disposition, mood) => disposition.moodShares.find((entry) => entry.mood === mood)?.share ?? 0;
// Migration compatibility control: an older persisted support sample can carry
// knownPopulationFraction in its dated exposure while omitting the newer optional
// nutritionCoverage field. Readers must derive coverage from that exposure rather
// than treating the missing projection key as full body-time.
const legacyPartialComfort = { ...partialComfort,
  currentSeasonSupport: { ...partialComfort.currentSeasonSupport,
    rawSupportRatio: 1.72, clampedSupportRatio: 1, perCapitaReturn: 1,
    foodStress: 0, deficitRatio: 0, mode: "pulse", nutritionCoverage: undefined } };
const legacyPartialBand = { ...band, seasonalSupport: legacyPartialComfort, carryingCapacity: undefined };
const legacyPartialWorld = { ...world, bands: { ...world.bands, [band.id]: legacyPartialBand } };
const legacyPartialFission = fission.deriveInnerFissionState(legacyPartialWorld, { ...partialFissionBand, seasonalSupport: legacyPartialComfort });
const legacyPartialDisposition = socialContext.applyDispositionContext(legacyPartialWorld, contextCache.buildTickContextCache(legacyPartialWorld)).bands[band.id].disposition;
const legacyPartialFoothold = campFoothold.deriveCampFootholdProfile(legacyPartialWorld, legacyPartialBand);
const legacyPartialSeasonalEvidence = seasonalEvidence(legacyPartialFoothold);
const legacyPartialDryMargin = dryMargin.deriveDryMarginMobilityContext(legacyPartialWorld, legacyPartialBand);
const legacyPartialBiome = biomeAdaptation.updateBiomeAdaptation({ world: legacyPartialWorld, band: legacyPartialBand, observedTileIds: [band.position], nextPosition: band.position, moved: false });
// Legitimate old-producer fixture: generated by the exact bf5807e record/merge
// path from a 25%-known hungry segment and 75% unknown body-time. Its persisted
// current projection is the old known-subset value (foodStress=1) and it omits
// nutritionCoverage. The new readers must derive the behavioral value from the
// retained dated exposure rather than trusting that stale projection.
const legacyOriginalFixture = JSON.parse(readFileSync(new URL("../docs/evidence/diag1-corrections/phase2/validation-round2/fresh/legacy-v1-original-producer-support.json", import.meta.url), "utf8"));
const legacyOriginalSupport = legacyOriginalFixture.support;
assert.equal(legacyOriginalSupport.bandId, band.id);
const legacyOriginalBand = { ...band, seasonalSupport: legacyOriginalSupport, carryingCapacity: undefined };
const legacyOriginalWorld = { ...world, bands: { ...world.bands, [band.id]: legacyOriginalBand } };
const legacyOriginalFission = fission.deriveInnerFissionState(legacyOriginalWorld, { ...partialFissionBand, seasonalSupport: legacyOriginalSupport });
const legacyOriginalDisposition = socialContext.applyDispositionContext(legacyOriginalWorld, contextCache.buildTickContextCache(legacyOriginalWorld)).bands[band.id].disposition;
const legacyOriginalFoothold = campFoothold.deriveCampFootholdProfile(legacyOriginalWorld, legacyOriginalBand);
const legacyOriginalSeasonalEvidence = seasonalEvidence(legacyOriginalFoothold);
const legacyOriginalCanonical = nutrition.deriveCanonicalNutritionState(legacyOriginalSupport);
const migratedLegacyWorldResult = nutritionMigration.migrateWorldNutrition({ ...legacyOriginalWorld, time: time.getWorldTimeForDay(90) });
assert.equal(migratedLegacyWorldResult.ok, true);
const migratedLegacyWorld = migratedLegacyWorldResult.world;
const migratedLegacyBand = migratedLegacyWorld.bands[band.id];
const migratedLegacyReaderBand = { ...migratedLegacyBand, foragingAdaptation: undefined, pressureState: undefined };
const migratedLegacyReaderWorld = { ...migratedLegacyWorld, bands: { ...migratedLegacyWorld.bands, [band.id]: migratedLegacyReaderBand } };
const migratedLegacyLoads = bodyCampLogistics.deriveBodyCampLoadSignals(migratedLegacyReaderBand);
const migratedLegacyLogistics = bodyCampLogistics.deriveBodyCampSurvivalLogistics(migratedLegacyReaderWorld, migratedLegacyReaderBand);
const migratedLegacyPressure = pressure.deriveBandPressureState(migratedLegacyReaderWorld, migratedLegacyReaderBand);
h.observations.legacyOriginalProducer = {
  sourceCommit: legacyOriginalFixture.sourceCommit,
  producer: legacyOriginalFixture.producer,
  scenario: legacyOriginalFixture.scenario,
  persistedCurrent: legacyOriginalSupport.currentSeasonSupport,
  canonical: legacyOriginalCanonical,
  fission: legacyOriginalFission,
  recoveringShare: moodShare(legacyOriginalDisposition, "recovering"),
  seasonalEvidence: legacyOriginalSeasonalEvidence,
  migration: {
    currentProjection: migratedLegacyBand.seasonalSupport.currentSeasonSupport,
    loads: migratedLegacyLoads,
    logistics: migratedLegacyLogistics,
    pressure: migratedLegacyPressure,
  },
};
h.check("bf5807e old-producer fixture derives partial hunger from dated exposure", () => {
  assert.equal(legacyOriginalSupport.currentSeasonSupport.foodStress, 1);
  assert.equal(legacyOriginalCanonical.currentFoodStress, .25);
  assert.equal(legacyOriginalCanonical.currentNutritionCoverage, .25);
  assert.ok(legacyOriginalFission.hungerTension < fullHungryFission.hungerTension);
  assert.ok(legacyOriginalSeasonalEvidence !== undefined && legacyOriginalSeasonalEvidence.confidence < fullHungrySeasonalEvidence.confidence);
  assert.equal(migratedLegacyBand.seasonalSupport.currentSeasonSupport.nutritionCoverage, .25);
  assert.equal(migratedLegacyBand.seasonalSupport.currentSeasonSupport.clampedSupportRatio, 0);
  assert.equal(migratedLegacyBand.seasonalSupport.currentSeasonSupport.foodStress, .25);
  assert.equal(migratedLegacyBand.seasonalSupport.currentSeasonSupport.rawSupportRatio, 0);
  assert.ok(migratedLegacyLoads.hunger <= .38);
  assert.ok(migratedLegacyLoads.hunger < 1);
  assert.ok(migratedLegacyPressure.foodStress < 1);
});
h.observations.compatibilityReaders = {
  partialClampedSupport: partialComfort.currentSeasonSupport.clampedSupportRatio,
  fullClampedSupport: fullComfort.currentSeasonSupport.clampedSupportRatio,
  partialDryMarginHarvestOpportunity: partialDryMargin?.seasonalMode.harvestOpportunity,
  fullDryMarginHarvestOpportunity: fullDryMargin?.seasonalMode.harvestOpportunity,
  partialBiome,
  fullBiome,
  partialHungerClassification: partialComfort.hungerClassification,
  partialUnityRecovering: partialFission.unityRecovering,
  partialDispositionRecoveryShare: moodShare(partialDisposition, "recovering"),
  fullDispositionRecoveryShare: moodShare(fullDisposition, "recovering"),
  partialCampSeasonalEvidence: partialSeasonalEvidence,
  fullCampSeasonalEvidence: fullSeasonalEvidence,
  partialHungryCampSeasonalEvidence: partialHungrySeasonalEvidence,
  fullHungryCampSeasonalEvidence: fullHungrySeasonalEvidence,
  mixedTemporalCampSeasonalEvidence: mixedTemporalSeasonalEvidence,
  legacyPartialUnityRecovering: legacyPartialFission.unityRecovering,
  legacyPartialDispositionRecoveryShare: moodShare(legacyPartialDisposition, "recovering"),
  legacyPartialCampSeasonalEvidence: legacyPartialSeasonalEvidence,
  legacyPartialDryMarginHarvestOpportunity: legacyPartialDryMargin?.seasonalMode.harvestOpportunity,
  legacyPartialBiome,
  legacyOriginalCanonical,
  legacyOriginalFission,
  legacyOriginalSeasonalEvidence,
};
h.check("partial comfort projection reaches dry-margin reader coverage-safely", () => {
  assert.ok(partialDryMargin !== undefined && fullDryMargin !== undefined);
  assert.ok(partialComfort.currentSeasonSupport.clampedSupportRatio < fullComfort.currentSeasonSupport.clampedSupportRatio);
  assert.ok(partialDryMargin.seasonalMode.harvestOpportunity < fullDryMargin.seasonalMode.harvestOpportunity);
});
h.check("partial comfort projection reaches biome-adaptation reader coverage-safely", () => {
  const kind = partialBiome.currentBiomeKind;
  assert.ok((partialBiome.records[kind]?.competence ?? 0) < (fullBiome.records[kind]?.competence ?? 0));
});
h.check("partial comfort does not promote recovery classification or inner-fission unity", () => {
  assert.equal(partialComfort.hungerClassification, "stable");
  assert.equal(partialFission.unityRecovering, false);
});
h.check("partial comfort does not fabricate social recovery or camp hardship confidence", () => {
  assert.ok(moodShare(partialDisposition, "recovering") < moodShare(fullDisposition, "recovering"));
  assert.ok(partialSeasonalEvidence !== undefined && fullSeasonalEvidence !== undefined);
  assert.ok(partialSeasonalEvidence.confidence <= fullSeasonalEvidence.confidence);
  assert.ok(partialHungrySeasonalEvidence !== undefined && fullHungrySeasonalEvidence !== undefined);
  assert.ok(partialHungrySeasonalEvidence.confidence < fullHungrySeasonalEvidence.confidence);
  assert.ok(mixedTemporalSeasonalEvidence !== undefined && mixedTemporalSeasonalEvidence.confidence === 0);
});
h.check("legacy partial exposure does not default missing coverage telemetry to full comfort", () => {
  assert.equal(legacyPartialFission.unityRecovering, false);
  assert.ok(moodShare(legacyPartialDisposition, "recovering") < moodShare(fullDisposition, "recovering"));
  assert.ok(legacyPartialSeasonalEvidence !== undefined && fullSeasonalEvidence !== undefined);
  assert.ok(legacyPartialSeasonalEvidence.confidence <= fullSeasonalEvidence.confidence);
  assert.ok(legacyPartialDryMargin !== undefined && legacyPartialDryMargin.seasonalMode.harvestOpportunity < fullDryMargin.seasonalMode.harvestOpportunity);
  const legacyKind = legacyPartialBiome.currentBiomeKind;
  const fullKind = fullBiome.currentBiomeKind;
  assert.ok((legacyPartialBiome.records[legacyKind]?.competence ?? 0) <= (fullBiome.records[fullKind]?.competence ?? 0));
});
const annualGap = nutrition.deriveAnnualNutritionState(fullHungry, 360);
// Shifted annual read: the retained exposure ends at day720, while the annual
// observer runs at day900. The physical query therefore sees only [540,720) of
// the current year and [180,720) of the 720-day history. Cached streak counters
// from the old exposure end must not be carried into this shifted read; the gap
// [720,900) must also interrupt the trailing contiguous streak.
const shiftedHungry = merge(sample(0, 720, 0), 12, 0);
const shiftedAnnual = nutrition.deriveAnnualNutritionState(shiftedHungry, 900);
h.observations.shiftedAnnual = shiftedAnnual;
h.check("shifted annual read uses dated coverage rather than cached counters", () => {
  assert.equal(shiftedAnnual.currentNutritionCoverage, .5);
  assert.equal(shiftedAnnual.chronicNutritionCoverage, .75);
  assert.equal(shiftedAnnual.chronicFoodStress, .32);
  assert.equal(shiftedAnnual.recentFoodStress, shiftedAnnual.currentFoodStress);
});
const fullMixed = write(
  write(
    write(
      write(undefined, sample(0, 90, .9, 1, false)),
      sample(90, 180, 2, 1, true),
    ),
    sample(180, 270, .9, 1, false),
  ),
  sample(270, 360, 2, 1, true),
);
const empty = nutrition.deriveCanonicalNutritionState(undefined);
h.check("full coverage hunger retains candidate semantics", () => assert.equal(nutrition.deriveCanonicalNutritionState(fullHungry).currentFoodStress, 1));
h.check("full coverage comfort retains candidate semantics", () => assert.ok(nutrition.deriveAnnualNutritionState(fullComfort, 90).nutritionalSurplus > .5));
h.observations.annualGap = annualGap;
h.check("annual horizon aligns recent stress with its physical gap", () => {
  assert.equal(annualGap.currentFoodStress, .25);
  assert.equal(annualGap.recentFoodStress, .25);
  assert.equal(annualGap.currentNutritionCoverage, .25);
  assert.equal(annualGap.recentNutritionCoverage, .25);
  // The annual reader changes the annual demographic horizon; movement keeps
  // the canonical current/rolling seasonal reader and must not be replaced by
  // the 360-day demographic mean.
  assert.equal(annualGap.foodMovementPressure, nutrition.deriveCanonicalNutritionState(fullHungry).foodMovementPressure);
  assert.ok(annualGap.foodDemographicPressure < .5);
});
h.check("partial annual nutrition reaches the actual demography reader coverage-safe", () => {
  const fullTerms = demography.deriveFoodDemographyRateTerms(
    nutrition.deriveAnnualNutritionState(fullHungry, 90), fullHungry,
  );
  assert.ok(hungryCanonical.foodDemographicPressure < fullTerms.foodPerPersonStress);
  assert.ok(hungryAnnual.foodDemographicPressure < fullTerms.foodPerPersonStress);
});
h.check("full coverage mixed support preserves pooled demand weighting", () => {
  const annual = nutrition.deriveAnnualNutritionState(fullMixed, 360);
  assert.equal(annual.nutritionalSurplus, .28);
  assert.equal(annual.recoveryRelief, .5);
});
const fullLegacyMixed = write(
  write(
    write(
      write(undefined, legacySample(0, 90, 0, 1, false)),
      legacySample(90, 180, 2, 1, true),
    ),
    legacySample(180, 270, 0, 1, false),
  ),
  legacySample(270, 360, 2, 1, true),
);
const fullLegacyAnnual = nutrition.deriveAnnualNutritionState(fullLegacyMixed, 360);
h.observations.fullLegacyMixed = fullLegacyAnnual;
h.check("full-known legacy coverage telemetry is explicit", () => {
  assert.equal(fullLegacyAnnual.chronicNutritionCoverage, 1);
});
h.check("full-known legacy mixed support preserves aggregate bounded semantics", () => {
  assert.equal(fullLegacyAnnual.nutritionalSurplus, 0);
});
h.check("zero coverage is unavailable and neutral", () => {
  assert.equal(empty.nutritionStateAvailable, false);
  assert.equal(empty.currentFoodStress, 0);
  assert.equal(empty.recoveryRelief, 0);
  assert.equal(empty.nutritionalSurplus, 0);
});

const nearFullMixed = write(
  write(
    write(
      write(undefined, sample(0, 90, 0, .99, false)),
      sample(90, 180, 1.72, .99, true),
    ),
    sample(180, 270, 1.72, .99, true),
  ),
  sample(270, 360, 1.72, .99, true),
);
const nearFullAnnual = nutrition.deriveAnnualNutritionState(nearFullMixed, 360);
h.observations.nearFullMixed = nearFullAnnual;
h.check("near-full coverage telemetry is explicit", () => {
  assert.equal(nearFullAnnual.currentNutritionCoverage, .99);
});
h.check("near-full mixed coverage stays continuous and bounded", () => {
  assert.equal(nearFullAnnual.nutritionalSurplus, .21);
});

// E: measured hunger + measured comfort + unknown body-time. Only the supported
// quarter-day contributions may reach the behavioral terms.
const mixedExposure = { ...sample(0, 90, 0, .25), exposure: {
  ...sample(0, 90, 0, .25).exposure,
  segments: [
    { ...sample(0, 45, 0, .25).exposure.segments[0], startDay: 0, endDay: 45 },
    { ...sample(45, 90, 1.72, .25).exposure.segments[0], startDay: 45, endDay: 90 },
  ],
  supportUnits: 45 * 0 + 45 * 1.72,
  demandUnits: 90,
  foodStressDays: 45 * .25,
  waterStressDays: 0,
  recoveryDays: 45 * .25,
} };
const mixed = write(undefined, mixedExposure);
const mixedCanonical = nutrition.deriveCanonicalNutritionState(mixed);
h.observations.mixed = mixedCanonical;
h.check("mixed coverage weights measured negative evidence only", () => assert.equal(mixedCanonical.recentFoodStress, .13));
h.check("mixed coverage does not promote recovery or surplus", () => {
  assert.ok(mixedCanonical.recoveryRelief < 1);
  assert.ok(mixedCanonical.nutritionalSurplus < .99);
});

// G: reintegration keeps recorded physical quantities invariant while the embodied
// stress aggregate follows the currently surviving headcounts. This is a deliberate
// aggregate simplification: no person-level life course is invented during merge.
const parentHungry = withActualDemand(sample(0, 90, 0, 1, false), 120);
const successorComfort = withActualDemand(sample(0, 90, 1.72, 1, true), 60);
const mergedHungryHeavy = nutrition.mergeSupportHistories(
  write(undefined, parentHungry), write(undefined, successorComfort), band, 9, 3, time.getWorldTimeForDay(90),
);
const mergedComfortHeavy = nutrition.mergeSupportHistories(
  write(undefined, parentHungry), write(undefined, successorComfort), band, 3, 9, time.getWorldTimeForDay(90),
);
const mergeQueryHungryHeavy = nutrition.querySupportExposure(mergedHungryHeavy, 90, 90);
const mergeQueryComfortHeavy = nutrition.querySupportExposure(mergedComfortHeavy, 90, 90);
h.observations.mergeWeighting = {
  historicalInputs: { parentBodyDemandUnits: 120, successorBodyDemandUnits: 60, parentHistoricalHeadcount: 12, successorHistoricalHeadcount: 6 },
  survivorHeadcountsBeforeReintegration: { parent: 9, successor: 3 },
  survivorHeadcountsAfterReintegration: { parent: 3, successor: 9 },
  hungryHeavy: mergeQueryHungryHeavy,
  comfortHeavy: mergeQueryComfortHeavy,
  adjudication: "accepted aggregate simplification: current surviving headcounts weight embodied stress after a headcount change; recorded actual support/demand remain summed and unchanged; no person-level life course invented",
};
h.check("historical merge keeps actual quantities invariant", () => {
  assert.equal(mergeQueryHungryHeavy.supportUnits, mergeQueryComfortHeavy.supportUnits);
  assert.equal(mergeQueryHungryHeavy.demandUnits, mergeQueryComfortHeavy.demandUnits);
});
h.check("historical merge weights stress by current survivor headcount", () => {
  assert.notEqual(mergeQueryHungryHeavy.foodStress, mergeQueryComfortHeavy.foodStress);
});

// F: exact physical-time recovery threshold and interruption.
const crisis = write(undefined, sample(0, 90, .2));
const recoverFor = (days, gap = 0) => write(crisis, sample(90 + gap, 90 + gap + days, 1));
const oneRecovery = recoverFor(1);
const eightyNineRecovery = recoverFor(89);
const ninetyRecovery = recoverFor(90);
const interrupted = write(write(crisis, sample(90, 120, 1)), sample(121, 122, 1));
const measuredInterrupted = write(
  write(write(crisis, sample(90, 120, 1)), sample(120, 121, .9, 1, false)),
  sample(121, 122, 1),
);
h.observations.recoveryThresholds = {
  one: oneRecovery.seasonalRecoveryStreak, eightyNine: eightyNineRecovery.seasonalRecoveryStreak,
  ninety: ninetyRecovery.seasonalRecoveryStreak, interrupted: interrupted.seasonalRecoveryStreak,
  measuredInterrupted: measuredInterrupted.seasonalRecoveryStreak,
  classifications: {
    one: oneRecovery.hungerClassification, eightyNine: eightyNineRecovery.hungerClassification,
    ninety: ninetyRecovery.hungerClassification, interrupted: interrupted.hungerClassification,
    measuredInterrupted: measuredInterrupted.hungerClassification,
  },
};
h.check("one recovery day improves current condition but is not mature recovery", () => {
  assert.equal(oneRecovery.currentSeasonSupport.mode, "recovery");
  assert.notEqual(oneRecovery.hungerClassification, "recovery_after_crisis");
});
h.check("89 qualifying recovery days are not mature recovery", () => assert.notEqual(eightyNineRecovery.hungerClassification, "recovery_after_crisis"));
h.check("90 qualifying recovery days are mature recovery", () => assert.equal(ninetyRecovery.hungerClassification, "recovery_after_crisis"));
h.check("a gap resets contiguous recovery duration", () => {
  assert.equal(interrupted.seasonalRecoveryStreak, 1 / 90);
  assert.notEqual(interrupted.hungerClassification, "recovery_after_crisis");
});
h.check("a measured non-recovery interval resets contiguous recovery duration", () => {
  assert.equal(measuredInterrupted.seasonalRecoveryStreak, 1 / 90);
  assert.notEqual(measuredInterrupted.hungerClassification, "recovery_after_crisis");
});
h.check("inner fission preserves immediate recovery without mature classification", () => {
  const oneDayBand = { ...band, seasonalSupport: oneRecovery,
    innerFission: { pressureScore: .5 }, pressureState: { fatiguePressure: 0, waterStress: 0 },
    socialPressure: { fissionPressure: 0 }, demography: { ...band.demography, splitPressure: 0 } };
  const state = fission.deriveInnerFissionState(world, oneDayBand);
  assert.equal(oneRecovery.hungerClassification, "seasonal_pulse_recovery");
  if (state.unityRecovering) assert.equal(oneRecovery.hungerClassification, "seasonal_pulse_recovery");
});

// Inventory the converted comparisons so the final report names each behaviorally
// relevant >0/count assumption rather than silently widening this correction.
h.observations.thresholdInventory = {
  physicallyEquivalent: ["seasonalHungerStreak >= 2", "chronicDeficitStreak >= 4/6/8", "deficitSeasonsLast4/8 >= existing thresholds", "waterStressSeasonsLast8 >= existing thresholds"],
  correctedInThisRound: ["seasonalRecoveryStreak > 0 -> >= 1 for recovery_after_crisis", "bandChronicle recovery arc > 0 -> >= 1"],
  intentionallyDurationWeighted: ["socialContext recovery signal scales with seasonalRecoveryStreak", "protoCamps consumes classification, not raw duration"],
};
await h.finish({ ...(process.argv.includes("--red-original") ? { auditMode: "RED against exact original production bytes at bf5807e; initial pre-edit positive assertions were nondiscriminating and are reported explicitly" } : {}) });
