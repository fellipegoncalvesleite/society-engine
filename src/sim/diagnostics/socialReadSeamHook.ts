// CORRECTION-16 §4.3 — exact-read-seam perturbation hook.
//
// AUDIT-ONLY and NON-PERSISTED. Nothing here enters `WorldState`, band state, snapshots,
// the worker, or the UI. The hook is a module-level slot the audit runner sets and clears
// in a `finally`. When no hook is registered — every production, worker and UI path — the
// only cost is one `undefined` check per context assembly, and canonical output is
// byte-identical to the pre-instrumentation branch.
//
// WHY THIS EXISTS
// ---------------
// `innerFission` and `socialTension` are DERIVED: their authoritative writer
// (`applyInnerFissionSocialReadabilityContext`) recomputes them from scratch on every
// context assembly. Their production readers — `applyProtoCampContext` and
// `applyForagingLearningAdaptationContext` — run LATER IN THE SAME CALL, and
// `pressure.ts` reads them later still, via `bandDecision`.
//
// CORRECTION-15 perturbed these fields BETWEEN `stepSim` calls. That mutation was
// destroyed by the canonical writer at the top of the next context assembly, before any
// reader executed. Its "byte-identical => inert" result was therefore an artifact of the
// perturbation seam and carried no information about causality. CORRECTION-16 §4.3
// requires perturbing either the authoritative source, or an audit-only hook placed
// immediately AFTER the canonical writer and immediately BEFORE the actual reader.
//
// This slot is that seam: it sits between `applyInnerFissionSocialReadabilityContext`
// and `applyProtoCampContext` in `updateBandContextStates`.

import type { Band } from "../agents/types";

/**
 * Transforms a band at the social read seam. Returning the band unchanged is a no-op.
 * Implementations must be pure and must not retain references to the band.
 */
export type SocialReadSeamHook = (band: Band) => Band;

let activeHook: SocialReadSeamHook | undefined;

/** Registers (or with `undefined`, clears) the audit hook. Audit runners only. */
export function setSocialReadSeamHook(hook: SocialReadSeamHook | undefined): void {
  activeHook = hook;
}

/** True when an audit is currently observing this seam. */
export function hasSocialReadSeamHook(): boolean {
  return activeHook !== undefined;
}

/**
 * Applies the registered hook to `band`. Production cost when unregistered is a single
 * `undefined` comparison; the band reference is returned untouched.
 */
export function applySocialReadSeam(band: Band): Band {
  return activeHook === undefined ? band : activeHook(band);
}
