// REPEATED-BAND-EXPANSION-FISSION-14 audit instrumentation.
//
// AUDIT-ONLY and NON-PERSISTED. Nothing here lives in `WorldState`, snapshots, or
// band state; the observer is a module-level slot the audit runner sets and clears
// around a run. When no observer is registered (every production/UI/worker path)
// the only cost is one `undefined` check per band per annual demographic step, and
// canonical output is byte-identical to the pre-instrumentation branch.
//
// It exists because the expansion chain (support -> nutrition -> demography ->
// split pressure -> eligibility -> daughter -> descendant fission) previously had
// no way to say WHICH gate stopped a lineage from expanding. Every value below is
// read from the same locals the production decision already computed, so the audit
// reports the real decision rather than a reconstruction of it.

import type { BandId, TickNumber, TileId } from "../core/types";

export interface FissionEvaluationRecord {
  readonly tick: TickNumber;
  readonly year: number;
  readonly bandId: BandId;
  readonly parentBandId?: BandId;
  readonly population: number;
  readonly dependents: number;
  readonly workingAdults: number;
  readonly elders: number;

  // Support / nutrition state that fed this year's demography.
  readonly rawSupportRatio: number;
  readonly annualMeanRawSupport: number;
  readonly currentFoodStress: number;
  readonly recentFoodStress: number;
  readonly chronicFoodStress: number;
  readonly recoveryRelief: number;
  readonly nutritionalSurplus: number;
  readonly foodDemographicPressure: number;
  readonly chronicDeficitStreak: number;
  readonly sustainedRecoveryStreak: number;

  // Demographic response.
  readonly fertilityPressure: number;
  readonly mortalityPressure: number;
  readonly netDemographicRate: number;
  readonly uncappedDemographicRate: number;
  readonly births: number;
  readonly deaths: number;

  // Fission pressure components.
  readonly comfortablePopulation: number;
  readonly householdCrowdingPressure: number;
  readonly localUsePressure: number;
  readonly nomadicScalePressure: number;
  readonly largeBandFissionPressure: number;
  readonly rangeSaturation: number;
  readonly knowledgeSaturation: number;
  readonly frontierOpportunity: number;
  readonly pressureSignal: number;
  readonly dangerPenalty: number;
  readonly splitPressure: number;
  readonly splitPressureThreshold: number;

  // Eligibility gates.
  readonly minimumSplitPopulation: number;
  readonly cooldownElapsed: boolean;
  readonly ticksSinceLastFission: number | undefined;
  readonly requiredCooldownTicks: number;
  readonly bandCount: number;
  readonly maxBands: number;
  readonly fissionTargetEvaluated: boolean;
  readonly fissionTargetCandidatesConsidered: number;
  readonly viableFrontierTileId: TileId | undefined;
  readonly viableFrontierScore: number | undefined;
  readonly crisisBreakawayEligible: boolean;
  readonly deferredReasonType: string | undefined;
  readonly projectedDaughterPopulation: number;
  readonly daughterMinPopulation: number;
  readonly eligible: boolean;
}

export type FissionEvaluationObserver = (record: FissionEvaluationRecord) => void;

let observer: FissionEvaluationObserver | undefined;

export function setFissionEvaluationObserver(next: FissionEvaluationObserver | undefined): void {
  observer = next;
}

export function getFissionEvaluationObserver(): FissionEvaluationObserver | undefined {
  return observer;
}

// Arm A ("sustained surplus without fission"): run the REAL production demography
// while suppressing only the daughter-creation step, to measure the population
// trajectory a founder can reach and whether the threshold is ever crossed.
// Production never sets this; it defaults to false and is cleared by the audit.
let fissionSuppressed = false;

export function setFissionSuppressedForAudit(next: boolean): void {
  fissionSuppressed = next;
}

export function isFissionSuppressedForAudit(): boolean {
  return fissionSuppressed;
}
