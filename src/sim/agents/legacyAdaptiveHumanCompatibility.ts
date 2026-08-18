// ROADMAP ITEM 5 PASS 1 — LEGACY / COMPATIBILITY / NON-CANONICAL boundary.
//
// `band.practicalAdaptation` is the canonical adaptation/history authority once
// present. `band.adaptiveHuman` remains only for pre-canonical / old-state
// compatibility. The legacy state may be advanced only on that fallback path,
// and legacy decision influence must not apply after practical adaptation exists.
//
// No new production module should use this boundary to create a second
// adaptation history. This file only curates the legacy operations that existing
// compatibility consumers still require; algorithms remain in `adaptiveHuman.ts`.
export {
  advanceAdaptiveHumanState,
  deriveAdaptiveDecisionSupport,
  selectAdaptiveInfluenceForAction,
  deriveAdaptiveHumanProfile,
  inheritAdaptiveHumanForDaughter,
  type AdaptiveDecisionSupport,
} from "./adaptiveHuman";
