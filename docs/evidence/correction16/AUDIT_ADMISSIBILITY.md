# CORRECTION-16 — Audit admissibility standard

Every causal audit in this checkpoint must satisfy all five rules below. The rules exist
because CORRECTION-15 produced confident, documented conclusions from evidence that could
not have supported them. Each rule names the concrete failure it prevents.

Status of this document: **binding on CORRECTION-16 and later.** An audit that violates any
rule below is inadmissible, and any claim resting on it must be marked `UNRESOLVED` until
re-proven.

---

## 4.1 Same-variable comparison

Do not compare a composite signal to one of its components and call the numeric difference
overstatement or suppression.

For annual nutrition, compare separately:

- annual `currentFoodStress` against the same annual mean of seasonal food stress;
- annual recovery share against the same recovery predicate over the same samples;
- annual surplus input against the exact rolling window production uses;
- final `foodDemographicPressure` against a reconstruction using the exact production formula.

**Prevents:** CORRECTION-15's "composite minus mean stress" magnitude estimate, which
subtracted a mean of one variable from a composite of several and reported the remainder as
a measured overstatement.

---

## 4.2 Same seed and same identity

Controlled arms must hold identical: terrain, map seed, `runSeed`, band ID (or an audit
identity override that prevents ID-derived differences), name, starting position, knowledge,
ecology, decision history, and all non-tested state. Only the intended variable may differ.

Every paired full-simulation comparison must run across **at least five predeclared shared
seeds**. Do not derive a seed from the arm name.

**Prevents:** CORRECTION-15's social conclusion, which rested on a single seed
(`c15-social-causality`). Re-run under the corrected instrument, that seed still shows no
cohesion effect while four of five other seeds do — the null was sampling, not physics.

---

## 4.3 Exact read-seam perturbation

A derived field cannot be perturbed between ticks when its official writer overwrites it
before the reader executes. Perturb either:

1. the authoritative source that generates it; or
2. an audit-only, non-persisted hook placed immediately after its canonical writer and
   immediately before its actual reader.

The hook must default to absent, never enter `WorldState`, never be reachable from UI or
worker production, be cleared in `finally`, and preserve diagnostics-off byte identity.

**An audit that perturbs a derived field must demonstrate that the perturbation survived to
the reader.** A null result without that demonstration is inadmissible.

**Prevents:** CORRECTION-15's social perturbation. `innerFission` and `socialTension` are
recomputed by `applyInnerFissionSocialReadabilityContext` at position 7 of the
`updateBandContextStates` composition, while their production readers
`applyProtoCampContext` (8) and `applyForagingLearningAdaptationContext` (12) run later in
the *same call*. A between-tick clamp was destroyed before any reader ran.

Field classes and their correct seams in this codebase:

| Field | Class | Correct seam |
| --- | --- | --- |
| `cohesion` | authoritative stored state (spawn + daughter inheritance) | between-tick clamp is valid |
| `innerFission` | derived, recomputed every context assembly | read-seam hook required |
| `socialTension` | derived, recomputed every context assembly | read-seam hook required |
| `socialPressure` | derived from demography | read-seam hook; and a positive result is not evidence of *social* causation |

The CORRECTION-16 hook is `src/sim/diagnostics/socialReadSeamHook.ts`, applied in
`socialContext.ts` between the writer and `applyProtoCampContext`.

---

## 4.4 Honest fingerprints

Do not call a projection "canonical state".

Maintain explicit, separately named fingerprints for: full causal band state; decisions and
selected action; decision candidate scores and reasons; movement; activity and physical
receipts; pressure; knowledge and memories; relationships and reports; demography and
fission; viability; ecology.

Exclude only fields proven to be read-model/debug projections, and list every exclusion with
its justification. A narrow outcome fingerprint may still be used, but it must be named after
exactly what it contains.

**Prevents:** CORRECTION-15's 10-field projection named "canonical state", which omitted
proto-camp behaviour, foraging-adaptation behaviour and pressure state — precisely the
surfaces the fields under test feed.

---

## 4.5 Static tracing

Do not classify causality by a broad regex plus a manually excluded filename list. For every
field, produce:

```text
authoritative writer
→ exact property read
→ consuming function
→ changed intermediate
→ downstream production reader
→ physical/behavioral result
```

A value copied by `simRunner.ts` into a selected-band panel is a **projection reader**, not a
causal consumer.

**Prevents:** the `PROJECTION_MODULES` filename set in the CORRECTION-15 audit, which decided
causality by which file a match landed in rather than by what the reader does with the value.

---

## Cross-cutting rules

### No vacuous passes

A check computed over an empty arm set, seed set, or sample set must report failure, not
success. `Array.prototype.every` on an empty array returns `true`; audits must guard against
it explicitly. (This bug occurred and was caught during CORRECTION-16: an incorrect band
status filter skipped every seed and the audit initially reported `localMechanismCorrect:
true` with an empty summary.)

### Local mechanism before trajectory

A multi-year comparison of arms that move independently measures the *system*, not the
mechanism. Where a mechanism claim is made, prove it on a **same-snapshot counterfactual**:
one identical pre-update state, cloned into arms differing only in the tested variable, run
through exactly one production update.

**Prevents:** the two failing checks in `demographicDeathMemoryPathAudit.mjs`, which assert
orderings on 40-year trajectory means. Density-dependent food feedback reverses the asserted
sign once the arms diverge.

### A test failure is not a production regression

Classify every failing check as one of: production regression, invalid audit expectation, or
mixed. The classification requires a local counterfactual. Documentation may not describe a
failing check as a regression without one.

### Code outranks documentation

Current production code and admissible experiments outrank any claim written by a previous
checkpoint, including claims in `CLAUDE.md`, `AGENTS.md`, and prior `FINDINGS.md` files. Do
not preserve a claim because it was previously accepted.
