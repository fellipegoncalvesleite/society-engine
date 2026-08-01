// CORRECTION-26 §8 — the EXECUTION-NEUTRAL domain half of a resource investigation.
//
// WHY IT MOVED. Every function here used to live in `rules/bandDecision.ts`, which is the
// DECISION layer. Once an investigation is physically executed by the daily trip path
// (`agents/intraSeasonTrips.ts`), that layer needs the same canonical operation, and
// `agents -> rules` would be a runtime import cycle. The split is by ROLE, not by line
// count:
//
//   candidate selection        stays in rules/candidates/resourceScoutCandidate.ts
//                              (`buildResourceScoutContext`, `selectResourceScoutTarget`)
//   selection classification   stays in rules/bandDecision.ts
//                              (`isAppliedSideCountryProbe`, `isAppliedProactiveInfo`)
//   observation interpretation MOVED HERE
//   memory mutation            MOVED HERE
//   plant-use learning         MOVED HERE
//   debug / projection         MOVED HERE (it describes an observation, not a choice)
//
// The decision-time VOI numbers the old code recovered by RE-RUNNING the selector are now
// passed in as `PendingInvestigationSelectionEvidence` — captured once, at selection, by
// the scorer that actually produced them. That is both exact (the re-derivation could not
// see a past season's context) and acyclic.
//
// THERE IS STILL EXACTLY ONE KNOWLEDGE WRITER. Nothing here writes `band.knowledge`; the
// caller applies `observeTileAndNearby` (agents/tileObservation.ts) and hands the result
// in. This module only interprets an observation that has already legitimately happened.
import type { Action, ResourceScoutKind } from "../rules/types";
import type { ReasonId, TileId, WorldTime } from "../core/types";
import type { Tile, WorldState } from "../world/types";
import { getTile } from "../world/generate";
import type { Band } from "./types";
import { deriveBaseHabitatPotential } from "./habitatYield";
import { deriveResourceClassAvailability } from "./resourceClasses";
import type { ResourceKnowledgeState, ResourcePatchMemory } from "./resourceKnowledge";
import {
  effectiveResourceConfidence,
  updateResourceKnowledgeFromObservation,
} from "./resourceKnowledge";
import type { PlantScoutObservationHint } from "./plantPatches";
import { derivePlantScoutObservationHint } from "./plantPatches";
import { derivePlantUseEligibility } from "./plantUseEligibility";
import { applyPlantUseTestFromEligibility } from "./plantUseTesting";
import type { CauseSpecificEvent } from "./causeSpecificEvent";
import { deriveCauseSpecificEventFromPlantUseTest } from "./causeSpecificEvent";
import type { PlantUseTestEvent } from "./plantUseTesting";
import type { ResourceScoutDebug } from "./resourceScout";
import {
  applyResourceScoutLearningDelta,
  buildScoutExpectationRecord,
  classifyScoutContradiction,
  classifyScoutOutcome,
  effectiveConfidenceProfile,
  expectationSeasonalFit,
  plantObservationMemoryFromHint,
} from "./resourceScout";
import { getCanonicalFoodStress } from "./seasonalSurvival";
import type { PendingInvestigationSelectionEvidence } from "./pendingInvestigation";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Apply an EXECUTED resource scout.
 *
 * PRECONDITION, enforced by the caller and not by this function: a party physically
 * arrived at the target and `updatedKnowledge` already contains the observation record
 * that arrival produced. Calling this for a scout that did not arrive would read target
 * truth to compute an outcome, which §9 forbids — the daily executor's outcome ladder is
 * what keeps that impossible.
 *
 * Touches resource belief / patch memory ONLY: never yield, carrying capacity, stress,
 * mortality, or the residential position.
 */
export function applyResourceScoutObservation(
  world: WorldState,
  band: Band,
  action: Extract<Action, { type: "resource_scout" }>,
  updatedKnowledge: Band["knowledge"],
  newTilesObserved: boolean,
  // CORRECTION-26 — decision-time selection evidence, carried on the pending record. The
  // pre-26 code re-ran the selector here; from the daily phase that would read the wrong
  // season and close an agents -> rules cycle.
  selectionEvidence: PendingInvestigationSelectionEvidence,
): { readonly resourceKnowledgeState: ResourceKnowledgeState | undefined; readonly debug: ResourceScoutDebug } {
  const targetTileId = action.targetTileId;
  const targetClass = action.targetResourceClass;
  const tick = Number(world.time.tick);
  const season = world.time.season;
  const findPatch = (state: ResourceKnowledgeState | undefined) =>
    state?.patchMemories.find((m) => m.approximateTile === targetTileId && m.resourceClassId === targetClass);

  const before = findPatch(band.resourceKnowledgeState);
  const beforeEff = before === undefined ? undefined : effectiveResourceConfidence(before, tick);
  const beforeProfile = effectiveConfidenceProfile(before, tick);
  const presenceBefore = beforeProfile.presenceConfidence;
  const accessBefore = beforeProfile.accessConfidence;
  const expectedSeasonalFit = expectationSeasonalFit(before, targetClass, season);
  const expectedYieldHint = round2(Math.max(beforeProfile.yieldConfidence, before?.useHistory.lastYieldEstimate ?? 0));
  const expectedSafety = beforeProfile.safetyConfidence;

  const targetSource = (selectionEvidence.targetSource ?? before?.source ?? "inferred") as ResourcePatchMemory["source"];
  const previousNoGainCount =
    band.probeMemory?.recentTargets.find((record) => record.tileId === targetTileId)?.consecutiveNoGain ?? 0;
  const targetTile = getTile(world, targetTileId);
  // §9 — the ONLY raw world-truth read in this module, and it is gated by the caller's
  // arrival proof. An unexecuted, cancelled or failed investigation never reaches here.
  const plantObservation = targetTile === undefined
    ? undefined
    : derivePlantObservationForResourceScout(action, targetTile, world.time);

  const targetRecord = updatedKnowledge.observedTiles[targetTileId];
  let observedClassAvailability = 0;
  let observedClassSupport = 0;
  let observedSeasonalFit = 0;
  let observedAccess = 0;
  let resourceKnowledgeStateAfterObservation = band.resourceKnowledgeState;
  if (targetRecord !== undefined) {
    const baseHab = deriveBaseHabitatPotential(targetTileId, targetRecord, world.time);
    const summary = deriveResourceClassAvailability(baseHab, targetRecord, world.time);
    const contribution = summary.contributionByClass.find((entry) => entry.classId === targetClass);
    observedClassAvailability = clamp01(contribution?.availability ?? 0);
    observedClassSupport = clamp01(contribution?.supportContribution ?? 0);
    observedSeasonalFit = clamp01(contribution?.seasonalModifier ?? 0);
    observedAccess = clamp01((1 - (targetRecord.observedMovementCost ?? 0.5)) * 0.6 + targetRecord.confidence * 0.4);
    resourceKnowledgeStateAfterObservation =
      updateResourceKnowledgeFromObservation(band.resourceKnowledgeState, summary, {
        tileId: targetTileId,
        tick: world.time.tick,
        season,
        waterStress: band.pressureState?.waterStress ?? 0,
        perCapitaReturn:
          band.carryingCapacity?.perCapitaReturn.perCapitaReturn ??
          band.perCapitaReturn?.perCapitaReturn ??
          0.5,
        anchorTileId: band.residentialAnchor?.anchorTileId,
      }) ?? band.resourceKnowledgeState;
  }

  if (plantObservation !== undefined) {
    observedClassAvailability = plantObservation.observedAvailabilityHint;
    observedClassSupport = plantObservation.observedAbundanceHint;
    observedSeasonalFit = plantObservation.seasonalFitHint;
    observedAccess = plantObservation.accessHint;
  }

  const afterObservation = findPatch(resourceKnowledgeStateAfterObservation);
  const afterObservationProfile = effectiveConfidenceProfile(afterObservation, tick);
  const outcome = plantObservation === undefined
    ? classifyScoutOutcome({
        scoutKind: action.scoutKind,
        targetResourceClass: targetClass,
        presenceBefore,
        presenceAfter: afterObservationProfile.presenceConfidence,
        observedClassAvailability,
        seasonMatch: observedSeasonalFit,
        newTilesObserved,
        accessBefore,
        accessAfter: observedAccess,
      })
    : mapPlantObservationToScoutOutcome(plantObservation);
  const contradictionKind = classifyScoutContradiction({
    scoutKind: action.scoutKind,
    targetSource,
    outcome,
    expectedPresence: presenceBefore,
    expectedSeasonalFit,
    expectedYieldHint,
    expectedAccess: accessBefore,
    observedPresenceHint: observedClassAvailability,
    observedSeasonalFit,
    observedYieldHint: observedClassSupport,
    observedAccess,
    previousNoGainCount,
    wasStale: beforeEff?.isStale === true,
  });
  const learningUpdate = applyResourceScoutLearningDelta({
    state: resourceKnowledgeStateAfterObservation,
    bandId: band.id,
    tick: world.time.tick,
    season,
    originTile: action.originTileId,
    targetTile: targetTileId,
    scoutKind: action.scoutKind,
    targetResourceClass: targetClass,
    targetSource,
    outcome,
    contradictionKind,
    expectedPresence: presenceBefore,
    expectedSeasonalFit,
    expectedYieldHint,
    expectedAccess: accessBefore,
    expectedSafety,
    observedPresenceHint: observedClassAvailability,
    observedSeasonalFit,
    observedYieldHint: observedClassSupport,
    observedAccess,
    plantObservation,
  });

  const resourceKnowledgeStateAfterScout = learningUpdate.state;
  const afterScout = findPatch(resourceKnowledgeStateAfterScout);
  const afterScoutProfile = effectiveConfidenceProfile(afterScout, tick);
  const memoryUpdated = resourceKnowledgeStateAfterScout !== band.resourceKnowledgeState;
  const plantUseEligibility = afterScout === undefined || plantObservation === undefined
    ? undefined
    : derivePlantUseEligibility(afterScout, {
        tick: world.time.tick,
        season,
        foodStress: getCanonicalFoodStress(band),
        perCapitaReturn:
          band.carryingCapacity?.perCapitaReturn.perCapitaReturn ??
          band.perCapitaReturn?.perCapitaReturn ??
          0.5,
        laborCapacity: band.carryingCapacity?.populationDemand?.laborCapacity,
        dependencyLoad: band.carryingCapacity?.populationDemand?.dependencyLoad,
      });
  const plantUseTestUpdate =
    resourceKnowledgeStateAfterScout === undefined || afterScout === undefined || plantUseEligibility === undefined
      ? undefined
      : applyPlantUseTestFromEligibility(resourceKnowledgeStateAfterScout, {
          bandId: band.id,
          tick: world.time.tick,
          season,
          memory: afterScout,
          eligibility: plantUseEligibility,
          foodStress: getCanonicalFoodStress(band),
          perCapitaReturn:
            band.carryingCapacity?.perCapitaReturn.perCapitaReturn ??
            band.perCapitaReturn?.perCapitaReturn ??
            0.5,
        });
  const resourceKnowledgeStateAfterPlantTest =
    plantUseTestUpdate?.resourceKnowledgeState ?? resourceKnowledgeStateAfterScout;
  // 2K.3A: a bounded NONLETHAL cause-specific event ONLY from a risk-relevant plant-use
  // outcome. Conservative band-known caution memory + debug — never yield/CC/stress/
  // mortality/population/relocation/fission. Most plant tests produce NO cause event.
  const causeSpecificUpdate =
    plantUseTestUpdate === undefined || plantUseEligibility === undefined
      ? undefined
      : deriveCauseSpecificEventFromPlantUseTest(plantUseTestUpdate.resourceKnowledgeState, {
          bandId: band.id,
          tick: world.time.tick,
          season,
          memory: plantUseTestUpdate.memory,
          plantUseTest: plantUseTestUpdate.event,
          eligibility: plantUseEligibility,
        });
  const resourceKnowledgeState =
    causeSpecificUpdate?.resourceKnowledgeState ?? resourceKnowledgeStateAfterPlantTest;
  const learning = buildScoutExpectationRecord({
    bandId: band.id,
    tick,
    season,
    originTile: action.originTileId,
    targetTile: targetTileId,
    scoutKind: action.scoutKind,
    targetResourceClass: targetClass,
    targetSource,
    expectedPresence: presenceBefore,
    expectedSeasonalFit,
    expectedYieldHint,
    expectedAccess: accessBefore,
    expectedSafety,
    observedPresenceHint: observedClassAvailability,
    observedSeasonalFit,
    observedYieldHint: observedClassSupport,
    observedAccess,
    plantObservation,
    outcome,
    contradictionKind,
    confidenceBefore: beforeProfile,
    confidenceAfter: afterScoutProfile,
    memoryUpdated,
    reasonIds: learningUpdate.reasonIds,
  });

  return {
    resourceKnowledgeState,
    debug: {
      tick,
      season,
      scoutKind: action.scoutKind,
      targetTile: targetTileId,
      targetResourceClass: targetClass,
      targetSource,
      candidateCount: selectionEvidence.candidateCount,
      selectedScore: selectionEvidence.voiScore,
      expectedInfoValue: selectionEvidence.expectedInfoValue,
      confidenceBefore: round2(presenceBefore),
      confidenceAfter: round2(afterScoutProfile.presenceConfidence),
      routeConfidenceChange: round2(afterScoutProfile.accessConfidence - accessBefore),
      repeatPenalty: selectionEvidence.repeatPenalty,
      outcome,
      contradictionKind,
      learning,
      deltaByConfidenceChannel: learning.deltaByConfidenceChannel,
      plantObservation,
      plantUseEligibility,
      plantUseTest: plantUseTestUpdate?.event,
      causeSpecificEvent: causeSpecificUpdate?.event,
      inferredBeliefTested: targetSource === "inferred",
      falseOrUnconfirmedInference: contradictionKind === "inferred_belief_unconfirmed",
      repeatedNoInfoScout: contradictionKind === "repeated_no_new_information",
      seasonalMismatch: contradictionKind === "expected_seasonal_found_out_of_season",
      partialConfirmation: contradictionKind === "partial_confirmation" || contradictionKind === "expected_animal_sign_only",
      partialConfirmContradict:
        contradictionKind !== "no_contradiction_confirmed" &&
        Object.values(learning.deltaByConfidenceChannel).some((delta) => delta > 0) &&
        Object.values(learning.deltaByConfidenceChannel).some((delta) => delta < 0),
      memoryUpdated,
      reasonVector: selectionEvidence.reasonVector ?? {
        uncertaintyReductionValue: 0,
        needPressure: 0,
        resourceClassUrgency: 0,
        seasonMatch: round2(expectedSeasonalFit),
        routeConfidence: round2(accessBefore),
        distanceCost: 0,
        repeatPenalty: 0,
        staleWrongPenalty: 0,
        lowConfidencePenalty: 0,
      },
      patchReturnGuidance: selectionEvidence.patchReturnGuidance,
      learnedWorldModelStatus: "future; contradiction records now feed it",
    },
  };
}

export function derivePlantObservationForResourceScout(
  action: Extract<Action, { type: "resource_scout" }>,
  targetTile: Tile,
  time: WorldTime,
): PlantScoutObservationHint | undefined {
  return derivePlantScoutObservationHintForKind(action.scoutKind, targetTile, time);
}

function derivePlantScoutObservationHintForKind(
  scoutKind: ResourceScoutKind,
  targetTile: Tile,
  time: WorldTime,
): PlantScoutObservationHint | undefined {
  switch (scoutKind) {
    case "plant_patch":
    case "aquatic_patch":
    case "fallback_food":
    case "material_patch":
    case "medicinal_toxic":
      return derivePlantScoutObservationHint(targetTile, time, scoutKind);
    case "water_refuge":
    case "animal_sign":
      return undefined;
  }
}

export function mapPlantObservationToScoutOutcome(
  observation: PlantScoutObservationHint,
): ResourceScoutDebug["outcome"] {
  switch (observation.observationOutcome) {
    case "confirmed_patch_present":
      return "confirmed_patch_present";
    case "confirmed_seasonal_absent":
      return "confirmed_seasonal_absent";
    case "found_low_abundance":
      return "found_low_abundance";
    case "suspected_processing_need":
      return "processing_need_suspected";
    case "suspected_safety_risk":
      return "safety_risk_detected";
    case "fallback_role_identified":
      return "fallback_role_identified";
    case "plant_patch_not_confirmed":
      return "plant_patch_not_confirmed";
    case "memory_refreshed_no_new_info":
      return "memory_refreshed_no_new_info";
  }
}

// 2K.10 — side-country resource/patch memory formation. When an EXECUTED side-country
// probe has OBSERVED its inferred side tile, run the SAME band-known
// observation -> patch-memory pipeline that resource_scout uses for that ONE observed
// tile. Anti-omniscient: forms ONLY from the band's own OBSERVED record of the tile
// (requires `updatedKnowledge.observedTiles[tileId]` — an inferred-only tile, never
// reached, forms NOTHING), salience-gated, low first-observation confidence, existing cap.
// NEVER mutates tile yield/truth, grants no support/safety/processing certainty, forces no
// movement.
//
// CORRECTION-26: "observed" now means a party physically stood there. Before, the observed
// record was written by the selection itself.
export function formSideCountryResourceMemory(
  world: WorldState,
  band: Band,
  tileId: TileId,
  updatedKnowledge: Band["knowledge"],
): ResourceKnowledgeState | undefined {
  const record = updatedKnowledge.observedTiles[tileId];

  if (record === undefined) {
    return undefined; // not actually observed → no resource memory (the anti-omniscience gate)
  }

  const baseHab = deriveBaseHabitatPotential(tileId, record, world.time);
  const summary = deriveResourceClassAvailability(baseHab, record, world.time);

  return updateResourceKnowledgeFromObservation(band.resourceKnowledgeState, summary, {
    tileId,
    tick: world.time.tick,
    season: world.time.season,
    waterStress: band.pressureState?.waterStress ?? 0,
    perCapitaReturn:
      band.carryingCapacity?.perCapitaReturn.perCapitaReturn ??
      band.perCapitaReturn?.perCapitaReturn ??
      0.5,
    anchorTileId: band.residentialAnchor?.anchorTileId,
    observationSource: "side_country_probe",
  });
}

export interface SideEncounteredCautiousTestUpdate {
  readonly resourceKnowledgeState: ResourceKnowledgeState | undefined;
  readonly plantUseTest: PlantUseTestEvent | undefined;
  readonly causeSpecificEvent: CauseSpecificEvent | undefined;
}

// 2K.11 — side-encountered cautious test. When a side-country probe formed a patch memory
// at a PLANT-BEARING side tile, run the SAME band-known plant-use-test chain the
// resource_scout uses on that ONE remembered patch, so exploitationSkill can ACCRUE for the
// side class the band actually encountered. Testability gate:
// `derivePlantScoutObservationHint` returns nothing for a non-plant side tile.
// Anti-omniscient: reads the band's OWN observed plant hint plus a band-known patch memory
// it just formed; outcomes stay suspicion-level. At most one test per executed side probe.
export function applySideEncounteredCautiousTest(
  world: WorldState,
  band: Band,
  tileId: TileId,
  sideResourceState: ResourceKnowledgeState,
): SideEncounteredCautiousTestUpdate | undefined {
  const tile = getTile(world, tileId);

  if (tile === undefined) {
    return undefined;
  }

  const hint = derivePlantScoutObservationHint(tile, world.time, "plant_patch");

  // Testability gate: a non-plant-bearing side tile yields no plant hint → no cautious test.
  if (hint === undefined || hint.observedPlantClassId === undefined || hint.linkedResourceClassId === undefined) {
    return undefined;
  }

  const resourceClass = hint.linkedResourceClassId;
  const memory = sideResourceState.patchMemories.find(
    (entry) => entry.approximateTile === tileId && entry.resourceClassId === resourceClass,
  );

  if (memory === undefined) {
    return undefined; // no band-known side memory of this observed class to test
  }

  const reasonId = `reason:side_encountered_cautious_test:${memory.patchId}:${Number(world.time.tick)}` as ReasonId;
  const memoryWithObs: ResourcePatchMemory = {
    ...memory,
    plantObservation: plantObservationMemoryFromHint(memory.plantObservation, hint, world.time.tick, reasonId),
  };
  const stateWithObs: ResourceKnowledgeState = {
    ...sideResourceState,
    patchMemories: sideResourceState.patchMemories.map((entry) =>
      entry.patchId === memory.patchId ? memoryWithObs : entry,
    ),
  };

  const season = world.time.season;
  const foodStress = getCanonicalFoodStress(band);
  const perCapitaReturn =
    band.carryingCapacity?.perCapitaReturn.perCapitaReturn ?? band.perCapitaReturn?.perCapitaReturn ?? 0.5;
  const eligibility = derivePlantUseEligibility(memoryWithObs, {
    tick: world.time.tick,
    season,
    foodStress,
    perCapitaReturn,
    laborCapacity: band.carryingCapacity?.populationDemand?.laborCapacity,
    dependencyLoad: band.carryingCapacity?.populationDemand?.dependencyLoad,
  });
  const testUpdate = applyPlantUseTestFromEligibility(stateWithObs, {
    bandId: band.id,
    tick: world.time.tick,
    season,
    memory: memoryWithObs,
    eligibility,
    foodStress,
    perCapitaReturn,
  });
  const causeUpdate = deriveCauseSpecificEventFromPlantUseTest(testUpdate.resourceKnowledgeState, {
    bandId: band.id,
    tick: world.time.tick,
    season,
    memory: testUpdate.memory,
    plantUseTest: testUpdate.event,
    eligibility,
  });

  return {
    resourceKnowledgeState: causeUpdate?.resourceKnowledgeState ?? testUpdate.resourceKnowledgeState,
    plantUseTest: testUpdate.event,
    causeSpecificEvent: causeUpdate?.event,
  };
}
