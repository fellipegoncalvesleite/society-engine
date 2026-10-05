# CORRECTION-16 — Findings

**Verdict: `PROGRESS — NOT ACCEPTED / DO NOT MERGE`.**

Branch `checkpoint/human-viability-causal-closure-16`, from base
`d41c97326eacde27442db9bcd15e308dc8c08cb1`
(`checkpoint/human-viability-adaptive-resilience-15`), whose own base is public main
`668763ffc33d80d102d25ac97e94c8a4e965fbf2`. `main` untouched.

This checkpoint completed the **evidence-repair** half of its scope (§1–§7 in part) and did
**not** complete the **construction** half (§8–§14). What is proven here is proven properly;
what was not attempted is named as such in "Unmet scope" below. No gate is claimed on
evidence that was not produced.

---

## 1. Headline result: CORRECTION-15's central social claim is false

CORRECTION-15 documented, and `CLAUDE.md` promoted to a binding architecture fact:

> The SOCIAL LAYER IS READABILITY-ONLY. cohesion / innerFission / socialTension are inert
> when clamped to extremes for six years; only socialPressure is causal.

**This is withdrawn.** Under an admissible instrument every one of those fields changes
physical outcomes, including movement, physical food receipts, knowledge, demography and
viability.

`node scripts/socialCausalityAudit.mjs --years 6` over five predeclared shared seeds:

| Arm | Seeds changed | Fingerprint groups moved |
| --- | --- | --- |
| `innerFission_highPressure` | **5/5** | movement, decision, receipts, pressure, knowledge, demography+fission, viability, protoCampBehavior, foragingAdaptationBehavior |
| `innerFission_zeroPressure` | **5/5** | as above, plus relationalSocialState |
| `cohesion_low` | 4/5 | all ten groups |
| `socialTension_hostile` | 4/5 | pressure, demography+fission, viability |
| `socialTension_harmonious` | 3/5 | movement, receipts, pressure, knowledge, demography+fission, viability, protoCampBehavior, foragingAdaptationBehavior |
| `cohesion_high` | 2/5 | all ten groups |

### Why CORRECTION-15 got a null — decomposed on its own seed

Re-running the corrected instrument on CORRECTION-15's *own* seed (`c15-social-causality`)
separates two independent defects:

| Field | Result on C15's own seed | Cause of the original null |
| --- | --- | --- |
| `innerFission` | **changes 8 fingerprint groups** | **Wrong seam (§4.3)** — nothing to do with the seed |
| `socialTension` | **changes pressure + demography** | **Wrong seam (§4.3)** |
| `cohesion` | still no change | **Single seed (§4.2) + narrow fingerprint (§4.4)** |

**The seam defect, exactly.** `innerFission` and `socialTension` are derived. Their canonical
writer `applyInnerFissionSocialReadabilityContext` sits at position 7 of the
`updateBandContextStates` composition (`socialContext.ts:130`). Their production readers
`applyProtoCampContext` (position 8) and `applyForagingLearningAdaptationContext` (position
12) run **later in the same call**; `pressure.ts:157-158` reads them later still via
`bandDecision`. CORRECTION-15 mutated these fields *between* `stepSim` calls, so the writer
destroyed the mutation before any reader executed. Its null carried no information.

**The fingerprint defect, exactly.** The 10-field projection CORRECTION-15 called "canonical
state" omitted `protoCampMemory.behavior`, `foragingAdaptation.behavior` and `pressureState`
— precisely the surfaces these fields feed.

**CORRECTION-15 contradicted its own evidence.** Its static half classified *every* social
field, cohesion and innerFission included, as `causal_or_intermediary_static_read`
(`docs/evidence/correction15/social_causality.json`). The documented conclusion was drawn
from the broken dynamic half alone.

### Hand-traced production chains (§4.5)

```text
band.cohesion (authoritative; spawn.ts:915, daughter demography.ts:955)
  → innerFission.ts:160 deriveSocialTensionReadabilityState
  → socialTension.socialTensionPressure ((1-cohesion)*0.28)
    AND socialTension.tolerance == band.cohesion when the band has no contacts (innerFission.ts:143)
  → protoCamps.ts:500 (tolerance <= 0.05 → "hostile social tension" factor 0.1)
  → proto-camp place scoring → which place is retained/returned to
```

```text
band.innerFission (derived; socialContext.ts:420)
  → pressure.ts:157-158 residentialDebatePressure, scoutingPressure
  → netMovePressure / scouting propensity
  → bandDecision.ts:1218 writes pressureState
  → residential movement
```

```text
band.innerFission.hungerTension
  → foragingAdaptation.ts:1352 (+0.08) and :1418 (-0.08)
  → foragingAdaptation.behavior.*
  → pressure.ts:168-173
  → risk tolerance, fallback expansion, trip abandonment → trips actually taken
```

`deriveInnerFissionState` does **not** read `band.cohesion` — innerFission is independent of
cohesion, contrary to the intuition that one summarises the other.

### What is still unresolved about the social layer

`relationshipMemory` and `reportedKnowledge` are marked **`UNRESOLVED`**, not classified.
Both have confirmed production readers (`pressure.ts`, `bandDecision.ts`), but §7.1's
per-property behaviour trace and the decision-edge target-bias isolation were **not done**.
`contactMemories`, `encounterResponses`, `disposition`, `protoAccessMemory` and `campRumors`
were **not perturbed at all**. No cooperation mechanism was added or assessed (§7.3).

---

## 2. Death-memory: the 2/11 failure is an INVALID AUDIT EXPECTATION

CORRECTION-15 reported `demographicDeathMemoryPathAudit` failing 2 of 11 checks and
classified it as "a REAL new failure … a production regression". **That classification is
withdrawn.**

The two failing checks are `directFoodTermRedundant` (asserts `r1.netRate >= r0.netRate`) and
`deathMemoryFertilityBounded` (asserts `r3.netRate >= r1.netRate`). Both compare **trajectory
means of arms that ran independently for 40 years**.

The confound is visible in that audit's own output — mean `currentFoodStress` rises
monotonically as death-memory suppression falls:

| Cell | deathMemorySeverity | recentDeathSuppression | fertilityPressure | netRate | currentFoodStress |
| --- | --- | --- | --- | --- | --- |
| R0 production | 0.1233 | 0.0566 | 0.2312 | **-0.001689** | 0.4233 |
| R1 direct food disabled | 0.0430 | 0.0184 | 0.2303 | **-0.001954** | 0.4347 |
| R3 death-memory fertility off | 0.0403 | 0.0174 | 0.2288 | **-0.002082** | 0.4526 |

Less fertility suppression → more people → more food stress → lower fertility and a lower net
rate. Density-dependent food feedback reverses the sign the old checks assert. This is the
pattern §6.3 forbids: two independently moving bands compared as if the difference measured a
local mechanism.

### Same-snapshot counterfactual (§6.1) — the local mechanism is correct

`scripts/demographicDeathMemoryCounterfactualAudit.mjs` takes ONE identical spring
pre-demography snapshot per seed, clones it into arms differing **only** in
`band.deathMemory`, and runs **exactly one** production annual demographic update
(`updateBandDemography`). Support, cohorts, place, ecology, water, risk, logistics,
population and the world object are identical references.

Seed `c16-dm-a`, band `delta-coastal-foragers`, population 34, tick 40 spring:

| Arm | fertilityPressure | mortalityPressure | netDemographicRate |
| --- | --- | --- | --- |
| noDeathMemory | 0.410000 | 0.250000 | 0.003500 |
| lowDeathMemory (0.05) | 0.400000 | 0.250000 | 0.003400 |
| highDeathMemory (0.40) | 0.340000 | 0.250000 | 0.002700 |
| highDeathMemory, fertility consumer disabled | 0.410000 | 0.250000 | 0.003500 |

All six checks pass on **5/5 seeds**:

- `fertilityMonotoneNonIncreasing`
- `netRateMonotoneNonIncreasing`
- `uncappedRateMonotoneNonIncreasing`
- `suppressionBounded`
- `mortalityUnchangedAcrossDeathMemory` — no mortality path consumes death memory
- `disablingFertilityConsumerRestoresNoMemoryFertility`

The measured fertility delta none→high is **0.070**, against the production formula's
`recentDeathSuppression * 0.18 = 0.40 * 0.18 = 0.072` (`demography.ts:445`; values round to
2dp). The mechanism matches its own formula exactly.

Cause attribution (§6.2), through the pure production helper `deriveDeathMemorySeverityTerms`,
all pass: food stress with zero realized deaths creates no suppression; non-food deaths under
adequate nutrition create bounded suppression; changing only the food label does not alter
production severity; cohort deaths contribute only through the documented cohort path.

**Classification: INVALID AUDIT EXPECTATION.** Production was not changed and was not tuned.
§6.3 (decay/recovery of suppression under identical scripted future support) was **not
measured**.

---

## 3. Preserved CORRECTION-15 repairs (§2 scope lock)

All four re-verified on this branch via `scripts/candidateRepairIsolationAudit.mjs`:

| Repair | Result |
| --- | --- |
| A — annual demography reads `deriveAnnualNutritionState` | `defectPresent: false`; 111 physically-surplus years now produce 114 surplus-signal years |
| B — same-day selection restricts the argmax domain | `defectPresent: false`; 0 of 480 zero-trip seasons (was 31) |
| C — newly observed patch memories survive cap enforcement | survives with protection, evicted without; cap still exactly **48** |
| D — expedition return uses the physical return day | proven by `stepModeInvarianceAudit` `fullCanonicalStateMatch: true` |

**Caveat on A (§4.1 violation carried forward, not repaired).** That audit still reports
`consumedMinusGroundTruth = -0.077` by subtracting `annualGroundTruthMeanFoodStress` (0.206,
a single component) from `demographyConsumedMeanFoodPressure` (0.129, the composite
`foodDemographicPressure`). §4.1 forbids exactly this comparison and §5A forbids reusing it
as a magnitude estimate. **Do not cite that number.** The structural claim — demography reads
one seasonal phase and the surplus signal is present — is unaffected. The four §4.1-compliant
like-for-like comparisons were **not built**.

Also newly visible and unexplained: `surplusSignalYears` (114) now slightly **exceeds**
`physicallySurplusYears` (111). Direction of that 3-year gap is not established.

---

## 4. Instrumentation added

`src/sim/diagnostics/socialReadSeamHook.ts` — audit-only, non-persisted module-level slot,
applied in `socialContext.ts` between `applyInnerFissionSocialReadabilityContext` (canonical
writer) and `applyProtoCampContext` (first production reader). Unregistered — every
production, worker and UI path — it is one boolean check and the world reference is returned
untouched.

**Diagnostics-off byte identity proven against base `d41c973`:**

| Map | Years | `d41c973` | CORRECTION-16 HEAD |
| --- | --- | --- | --- |
| map1 | 40 | `10af5773…1e6a621e` | `10af5773…1e6a621e` ✓ |
| map2 | 40 | `46b6ef70…fe276a53` | `46b6ef70…fe276a53` ✓ |

The audit's own seam validation records what each field held when the reader was about to
run: 240 hook invocations per 6-year run, 240 with `innerFission` defined, 240 with
`socialTension` defined — the perturbation demonstrably survives to the reader. CORRECTION-15
had no such self-check.

---

## 5. Regression matrix executed on this branch

| Check | Result |
| --- | --- |
| `npm run build` (tsc + tsc.node + vite) | PASS |
| `npx tsc -p tsconfig.json --noEmit` | PASS |
| Graph validation | PASS — 217/754, 0 dup, 0 dangling |
| Import-boundary audit | PASS — 0 `simLayerViolations`; back-edges 83 (informational) |
| Adaptation-boundary audit | PASS — `boundaryMatchesInternal`, `adaptationObserverParity` |
| Context-lifecycle audit | PASS — `observerParity` |
| Season-order invariance | PASS — `perBandDivergence: []` |
| Step-mode invariance | PASS — `fullCanonicalStateMatch: true`, `firstDivergence: null` |
| Food-receipt accounting | PASS — `captureRatioIsOnePerFounder`, `perSeasonCaptureAlwaysComplete` |
| Deterministic benchmark | PASS — `deterministic=true` |
| Fresh-process determinism | PASS — two independent processes agree |
| Diagnostics-off parity vs `d41c973` | PASS — byte-identical, map1 + map2 @ 40y |
| Candidate repair isolation A–D | PASS (see §3 caveat) |
| Corrected social causality | executed; conclusion reversed |
| Death-memory counterfactual | PASS 6/6 checks × 5/5 seeds |
| `demographicDeathMemoryPathAudit` | still 2/11 fail — **reclassified as invalid expectation**, left in place, not tuned |

### Failure attribution

- **Pre-existing:** the 2/11 `demographicDeathMemoryPathAudit` checks — now reclassified,
  origin unchanged.
- **Introduced by CORRECTION-15:** the invalid social conclusion and the invalid
  regression classification (documentation defects, both corrected here).
- **Introduced by CORRECTION-16:** none detected.
- **Invalid old tests replaced:** `socialCausalityAudit.mjs` rewritten; the two
  trajectory-mean death-memory assertions superseded by the same-snapshot counterfactual.

---

## 6. Unmet scope — not attempted, not partially claimed

The following sections were **not implemented**. No evidence for them exists on this branch
and none is claimed.

- **§5A** the four §4.1-compliant annual-nutrition like-for-like comparisons.
- **§6.3** death-memory decay/recovery under identical scripted future support.
- **§7.1/§7.2** `relationshipMemory` and `reportedKnowledge` per-property traces; the
  remaining social fields' perturbations.
- **§8** cohort and labor causality: paired-seed arms, the mediation waterfall, the
  persistence/conservation audit of cohort transfer through fission.
- **§9** whole-viability cause taxonomy.
- **§10** adaptation cascade — **no adaptation family was proven end to end in either
  direction.**
- **§11** frontier exploration. The ~9-tile destination-knowledge horizon remains the
  binding blocker on multi-generation dispersal, unchanged and unaddressed.
- **§12** dedicated cause-specific extinction and recovery arms.
- **§13** fresh performance measurement across `668763f` / `d41c973` / HEAD; state-size and
  context-rebuild bounds. (The seam hook is byte-identical when off, but no timing run was
  made.)
- **§14** the remaining regression matrix entries: worker/direct equivalence, habitat ladder,
  default-map long runs, demographic persistence/per-lineage conservation, fission
  cohort conservation, recovery basin re-run.

## 7. Unmet gates

Gates **1, 2, 3, 5, 6, 7, 8, 20, 21, 22, 23, 24, 26, 27** are met.

Gates **4, 9, 10 (vacuously — nothing added), 11, 12, 13, 14, 15, 16, 17, 18, 19, 25** are
**unmet**: no cohort arms, no cause taxonomy, no adaptation cascade, no extinction arms, no
frontier exploration, no fresh performance measurement, and gate 4's like-for-like
annual-nutrition comparison not built.

## 8. First remaining causal blocker

Unchanged from CORRECTION-15 and now the only thing standing between this simulator and
multi-generation dispersal: **the ~9-tile destination-knowledge horizon**. Bands cannot learn
about viable country beyond their existing range, so no viable non-overlapping daughter
destination becomes known, so first-generation fission caps out and second-generation fission
never occurs. §11's bounded frontier-exploration family is the correct next construction, and
it must not be solved by widening a radius constant or granting hidden destination quality.

## 9. Merge recommendation

**DO NOT MERGE.** The evidence repairs here are sound and the documentation corrections
should be carried forward, but the constructive scope of CORRECTION-16 is largely unbuilt.
Continue on this branch.
