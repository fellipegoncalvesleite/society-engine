// CORE-PIPELINE-DECOMPOSITION-3 (Workstream B) — practical-adaptation / invention
// canonical public boundary.
//
// The sanctioned canonical entry point for production code OUTSIDE the practical
// adaptation subsystem to drive and read this causal chain:
//
//   lived evidence -> practical problem -> fragments/affordances -> idea ->
//   experiment -> physical result -> practical response / invention -> real
//   coefficient/capability effect -> efficacy -> revision/dormancy/inheritance ->
//   later behavior
//
// Canonical state:   band.practicalAdaptation
// Canonical writer:  advancePracticalAdaptation
// Effect boundary:   practicalResponses.ts is the single DEFINITION site for the
//                    practical effect readers (derive*Condition, derive*Relief,
//                    storage); production reads them THROUGH this boundary.
// Efficacy:          adaptiveEfficacy is read THROUGH this boundary via the
//                    evaluate*Efficacy operations below.
// Inheritance:       inheritPracticalAdaptationForDaughter is the canonical
//                    practical-adaptation fission inheritance path.
//
// Legacy `band.adaptiveHuman` compatibility is intentionally OUTSIDE this
// canonical boundary. Existing pre-canonical/old-state fallback consumers route
// through `legacyAdaptiveHumanCompatibility.ts`; that state is not a coequal
// adaptation/history authority.
//
// This surface is deliberately SMALLER than the internal implementation: the
// subsystem's problem-framing, fragment, affordance, idea, experiment, and
// invention-chain internals are NOT exported here — only the canonical practical
// operations production actually consumes, named explicitly (this is a CURATED
// boundary, NOT a re-export-everything `export *` barrel). Internal practical
// adaptation modules still import each other directly. The read-only UI
// projection layer is a separate concern governed by importBoundaryAudit.
import type { Band } from "./types";
import {
  deriveCarryingCondition,
  deriveWaterRouteCondition,
  deriveWaterStorageCondition,
} from "./practicalResponses";

// --- Advance canonical practical adaptation state ---
export { advancePracticalAdaptation } from "./practicalResponses";

// --- Read the real behavioral/physical effect coefficients (effect boundary) ---
// The band-known effect CONDITIONS the decision scorer consumes:
export {
  deriveCarryingCondition,
  deriveWaterRouteCondition,
  deriveWaterStorageCondition,
  deriveEffectiveStorageCapacity,
} from "./practicalResponses";
// The per-system RELIEFS individual physical agent modules apply (acute-risk
// care, camp shelter, hunting safety, local-use-pressure water works, residential/
// migration carrying + carried water + dry-route water, storage engineering):
export {
  deriveCareTreatmentRelief,
  deriveShelterExposureRelief,
  deriveShelterPortabilityBurden,
  deriveHuntingSafetyRelief,
  deriveWaterWorksRelief,
  deriveCarryingRelief,
  deriveCarriedWaterRelief,
  deriveDryRouteWaterRelief,
  deriveEngineeringSafetyRelief,
  type CarriedWaterReliefResult,
  type PracticalReliefResult,
} from "./practicalResponses";

// Convenience grouping of the three band-only effect conditions, so a caller can
// read the current adaptation effect coefficients in one call.
export function deriveAdaptationEffectConditions(band: Band): {
  readonly carrying: number;
  readonly waterRoute: number;
  readonly waterStorage: number;
} {
  return {
    carrying: deriveCarryingCondition(band),
    waterRoute: deriveWaterRouteCondition(band),
    waterStorage: deriveWaterStorageCondition(band),
  };
}

// --- Evaluate outcome efficacy of applied practical responses ---
export {
  evaluateCareEfficacy,
  evaluateCarryingEfficacy,
  evaluateEngineeringEfficacy,
  evaluateHuntingEfficacy,
  evaluateMeasureEfficacy,
  evaluateShelterEfficacy,
  evaluateWaterStorageEfficacy,
  evaluateWaterRouteEfficacy,
} from "./adaptiveEfficacy";

// --- Inherit canonical practical adaptation knowledge to a fission daughter ---
export { inheritPracticalAdaptationForDaughter } from "./practicalResponses";
