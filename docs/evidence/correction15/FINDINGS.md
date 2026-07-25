# HUMAN VIABILITY, RECOVERY, ADAPTIVE RESILIENCE — CORRECTION-15 findings

**Verdict: PROGRESS — NOT ACCEPTED / DO NOT MERGE.**

Branch `checkpoint/human-viability-adaptive-resilience-15`, from public `main`
`668763ffc33d80d102d25ac97e94c8a4e965fbf2`. CORRECTION-14's commit `222d3ec` was used
strictly as an evidence and patch donor — never merged, never wholesale cherry-picked.

This checkpoint is **partially complete**. What was done is done to the required standard and
is listed below with measurements; what was not reached is named explicitly in §9 rather than
glossed. The central new finding is that **the recovery basin is sound** — bands recover from
one, three, and even five severe bad years in good country — while **the social layer is
almost entirely non-causal** and **cohort composition has only a negligible causal path**.

---

## 1. Research constraints

`docs/evidence/correction15/RESEARCH_CONSTRAINTS.md` records six constraints (R1–R6) with
source, qualitative finding, what the simulator may represent, what must not be
universalized, and production status. The binding ones for this checkpoint:

- **R1** (Gurven & Davison 2019) — local forager populations can grow; long-run restraint
  comes from episodic catastrophe, not permanently suppressed fertility. *This checkpoint
  did not add a catastrophe generator; doing so on a schedule is explicitly forbidden.*
- **R5** (resilience literature) — resilience is resistance **and** recovery; historical
  hardship must decay under sustained physical recovery.
- **R4** (Gurven & Kaplan 2007; Walker et al. 2006) — mortality is age-structured and adult
  survival is socially buffered; adult labor loss should be consequential.
- **R2/R3** (Lewis et al. 2014; Apicella et al. 2012; Migliano et al. 2017) — mobility and
  sharing buffer variance, and cooperation must act through a concrete mechanism, never a
  generic scalar.

---

## 2. Candidate repair isolation (§5) — all four independently re-proven

Each claim was proven from production behavior on `668763f` **before** any repair was
ported, using the same script that later produced the "after" evidence
(`scripts/candidateRepairIsolationAudit.mjs`; before/after JSON in this directory).

### A — annual demography read one seasonal phase

| | before (`668763f`) | after |
| --- | --- | --- |
| annual step lands on | spring, 120 of 120 years | spring, 120 of 120 |
| mean food pressure demography **consumed** | **0.555** | **0.129** |
| mean food stress the year actually held | 0.335 | 0.206 |
| overstatement of hardship | **+0.220** | −0.077 |
| physically-surplus years | 89 | 111 |
| years the surplus signal fired | **0** | **114** |
| defect present | **true** | false |

Season means over 120 years on the richest catchment: spring **0.173**, winter 1.130,
autumn 1.801, summer 2.275 — the annual step lands on the leanest season, every year.

### B — same-day selection could win what the executor must reject

Decisive cell: seasons with **zero trips** where the band held a remembered patch inside the
10-tile trip radius but **none inside the same-day budget**.

| | before | after |
| --- | --- | --- |
| seasons with zero trips (of 480) | 44 | **0** |
| …of which only out-of-budget memories existed | **31** | **0** |
| defect present | true | false |

### C — a saturated cap evicted what the band had just observed

Direct unit proof against the exported knowledge functions: 48 strong far memories plus one
just-observed local patch.

| | before | after |
| --- | --- | --- |
| just-observed patch survives the cap | **false** | **true** |
| survives without the protection argument | false | false (unchanged) |
| list still bounded at 48 | true | true |

### D — expedition observation timestamp

Only observable once B and C make recon returns occur. Proven by construction:

- `668763f` (no repairs): `stepModeInvarianceAudit` **PASS** — the path is never exercised.
- B + C ported, D reverted: map2 **FAIL**, `fullCanonicalStateMatch: false` with identical
  populations — the divergence is the recorded `day`/`dayOfSeason` only.
- B + C + D: **PASS** on both maps.

D is therefore *required by* B and C, not cosmetic. All four repairs were ported.

---

## 3. Recovery-basin matrix (§8) — PASS

`scripts/recoveryBasinAudit.mjs`. Physical support is scripted (that is what a "bad year"
physically is); everything downstream — nutrition history, fertility, mortality, cohorts,
the clamp, accumulators, the surplus signal — is production. The good environment is
byte-identical across arms, so divergence is the band's own state.

| Arm | population | recovered to pre-shock in | chronic hunger cleared after | outcome |
| --- | --- | --- | --- | --- |
| A healthy baseline | 34 → 74 | 1 y | 1 y | grows |
| B one bad year | 34 → 73 | **1 y** | 2 y | recovered |
| C three bad years | 34 → 72 | **1 y** | 2 y | recovered |
| D five **severe** years | 34 → 68 (min 32) | 12 y | 2 y | recovered |
| G0 no death memory | 34 → 72 | 1 y | 2 y | recovered |
| G1 heavy death memory | 34 → 66 | 1 y | 2 y | recovered |
| I0/I1/I2 (33/34/35 people) | → 72 / 74 / 75 | 1 y | 1 y | no bifurcation |

**No absorbing collapse spiral was found.** One bad year is recoverable; three bad years are
recoverable; five severe years cost population and 12 years but still recover. Chronic
hunger clears within 2 years of sustained physical recovery. Heavy prior death memory
depresses the first post-shock year and then washes out — bereavement is temporary, not a
permanent fertility curse. Negligible initial differences (33 vs 34 vs 35 people) produce a
3-person spread after 150 years, not a thriving/doomed bifurcation.

### Cohort arms had to be moved to the full simulation

Arms E/F initially showed **zero** cohort effect — which turned out to be an artifact of the
scripted harness: supplying support directly bypasses the only causal path cohort
composition has (working adults → task-group party size → per-trip return → harvest →
support). Re-run through the **full production pipeline** on identical ground:

| Arm | start working adults | mean task-group party | mean support ratio |
| --- | --- | --- | --- |
| H healthy control | 19 | 4.66 | 1.53 |
| E adult-labor shock | 10 | 4.47 | 1.52 |
| F dependent-heavy | 12 | 4.15 | 1.23 |

The path is real and directionally correct but **negligible**: halving working adults costs
**0.01** of support ratio. Final populations (29 / 48 / 38) are dominated by trajectory
divergence, not by labor structure, and starting cohorts do not converge to a common value.
**A labor-collapse extinction cause is therefore not reachable in production.** This is
reported as debt, not patched — inventing a labor→mortality coefficient would be exactly the
generic penalty §13 forbids.

---

## 4. Social causality audit (§10) — the decisive negative result

`scripts/socialCausalityAudit.mjs`, two independent methods. The dynamic method clamps each
field to an extreme **after every tick** — these fields are derived and recomputed each tick,
so a one-shot perturbation would be overwritten and would prove nothing.

| Field | static production readers | UI readers | clamped-perturbation result |
| --- | --- | --- | --- |
| `cohesion` | 2 (`bandDecision`, `simRunner`) | 0 | **INERT** at 0.02 *and* 0.99 |
| `socialPressure` | 3 (`demography`, `bandDecision`, `simRunner`) | 0 | **CAUSAL** |
| `innerFission` | 3 | 2 | **INERT** |
| `socialTension` | 1 | 2 | **INERT** |
| `disposition` | 1 | 3 | not perturbed |
| `relationshipMemory` | 2 | 5 | not perturbed |
| `contactMemories` | 11 | 1 | not perturbed |
| `encounterResponses` | 1 | 1 | not perturbed |
| `reportedKnowledge` | 7 | 4 | not perturbed |

Answers to the §10 questions, as measured:

1. **Does cohesion change real labor, sharing, care, movement, demography or fission?**
   **No.** Held at 0.02 or at 0.99 for six years, canonical state is byte-identical to the
   control. Cohesion has syntactic readers and no behavioral consequence.
2. **Does `innerFission` physically contribute to daughter creation?** **No** — held at
   `near_split` with pressure 0.95, nothing changes. It is a readability projection.
3. **Does social tension alter decisions?** **No** — inert.
4/5. **Can cooperation / breakdown change resilience through a real mechanism?** **No.**
   There is no physical transfer of food, labor, or care between bands anywhere in
   production. Nothing to strengthen or break.
6. **Are supposed social causes ecological pressure restated in social language?** **Yes for
   the one causal field.** `socialPressure` is causal, but it is written by
   `applyDemographyToSocialPressure` — it is demography re-expressed socially, not an
   independent social cause.

**Conclusion: the social layer is readability-only in practice.** It must not be cited as an
explanation for survival or fission. No generic cohesion bonus was added, and no fake
social-conflict fission was introduced.

---

## 5. Habitat ladder (§14) — 500 years, 5 seeds, map 2

| Tier | reachable stock | founder survival | median successful fissions | median living bands | median lineage population | conservation |
| --- | --- | --- | --- | --- | --- | --- |
| exceptionally rich | 36.60 | 1.00 | **4** | 5 | **149** | 0/0 |
| good | 17.47 | 1.00 | 0 (max 1) | 2 | 46 | 0/0 |
| ordinary | 12.66 | **1.00** | 0 | 1 | 25 | 0/0 |
| marginal escapable | 1.91 | 0.00 | 0 | 0 | 0 | 0/0 |
| isolated marginal | 1.24 | 0.00 | 0 | 0 | 0 | 0/0 |
| hostile | 0.20 | 1.00 | 0 | 1 | 14 | 0/0 |

Rich root band: mean annual support 1.51, **453 physically-surplus years → 480
surplus-signal years**, no terminal blocker. Ordinary survives in all five seeds.
Marginal and isolated die at y100 and y94 on honest insufficiency (mean support 0.01 and
0.17). Population and cohort conservation: **0 mismatches in every tier and seed**.

### Default maps (§15), 500 years

| Map 1, seed s1 | value |
| --- | --- |
| living bands / total population | 13 / **337** |
| fissions (successful) | 8 (6) |
| extinct founders | **0 of 5** |
| conservation mismatches | 0 / 0 |

Per founder (s1): Delta Reed lineage 121 / 4 fissions; Green River 92 / 3; Lake Marsh 57 / 1
(blocked by cooldown-or-regrowth); Pass Edge and Dry Margin survive at 27 and 40 with growth
too slow to reach the split minimum.

| Map 2, seed s1 | value |
| --- | --- |
| living bands / total population | 10 / **277** |
| fissions (successful) | 4 (4) |
| extinct founders | 3 of 9 (North Frontier y381, Upper Corridor y188, Yellow Corridor y75) |
| conservation mismatches | 0 / 0 |

Estuary builds a 139-person lineage with 4 successful fissions; the dry corridors stay
honestly extinct. Seeds s2/s3 agree (9–10 living bands, 213–250 people, 4 fissions).

---

## 6. Regression, determinism, build

Executed on this branch.

| Check | Result |
| --- | --- |
| `npx tsc --noEmit`, `npm run build`, `checkGraph` | PASS (graph 217/754, 0 dup, 0 dangling) |
| `sim:benchmark --deterministic` | `deterministic=true` |
| Fresh-process determinism (2 processes × 2 maps, 40 y) | identical; map1 pop 159, map2 pop 221 |
| `stepModeInvarianceAudit` | PASS both maps |
| `recoveryFoodAccountingAudit` | PASS — receipt capture **1.000** every founder |
| `demographicCompositionAudit` (CORRECTION-13) | preserved **exactly**: +0.0062 / +0.0045 / −0.0006 / −0.0102; 80 / 64 / 32 / 7 |
| `foodDemographySeparationAudit`, `demographicPersistenceAudit`, `demographicLongRunAudit`, `demographicRenewalAudit` | PASS |
| `livingEcologyFoodPipelineAudit`, `livingEcologyTrophicAudit`, `dynamicSnapshotEcologyParityAudit` | PASS |
| `postEcologyTerminalExtinctionAudit`, `postEcologyReturnKindAudit`, `postEcologyHardshipOutcomeAudit` | PASS |
| `seasonOrderInvarianceAudit`, `contextLifecycleAudit`, `importBoundaryAudit`, `adaptationBoundaryAudit`, `decisionBoundaryAudit` | PASS |
| `demographicPerLineageAudit` | PASS after completing its world equation (below) |
| `demographicDeathMemoryPathAudit` | **FAIL — 2 of 11 checks**, NOT pre-existing |

**`demographicPerLineageAudit`.** Failed with a gap of exactly **36 = 2 daughters × 18**: the
world equation counted a daughter's *transferred* founding population as new people. The term
was silently zero on `668763f` because that commit produced no fissions in this run. The
corrected equation subtracts fission transfers and passes on **both** this branch
(`155 + 312 − 296 = 171`) and the starting commit (`155 + 261 − 287 = 129`) — completed, not
loosened.

**`demographicDeathMemoryPathAudit`.** Reproduced on `668763f`: **PASS**. So this is a real
new failure, not pre-existing, and it is reported as such. It is isolated to the annual
nutrition read. The two failing checks are `r1.netRate >= r0.netRate` and
`r3.netRate >= r1.netRate` — ceteris-paribus orderings applied across three independently
diverging 40-year simulations, where the cells' mean food stress now differs by 0.011–0.029
(worth 0.0001–0.0003 of rate) while the effect being ordered is 0.00013–0.00027. The
confound is larger than the signal. Every primary mechanism assertion still passes. **The
audit was left unchanged.**

---

## 7. Performance

Not re-measured on this branch. CORRECTION-14 measured the identical production change set:
Map 2 150 y unchanged (70.2 → 70.6 ms/tick), Map 1 +22% (38.6 → 47.1) tracking the extra
living bands rather than per-band overhead; 500-year lineages 8–24 ms/tick; retained state
bounded (patch memories 48, trips 24, largest band 1.7–2.3 MB). Carrying that measurement
forward is an assumption, not a fresh result, and is flagged here as such.

---

## 8. Conservation

Population, cohort and fission conservation: **0 mismatches** across every tier and seed of
the 500-year ladder (`parentBefore === parentAfter + daughterPopulation` per event;
`dependents + workingAdults + elders === population` per band per year). Food receipt
capture **1.000**. Root-lineage reconciliation verified through the corrected per-lineage
equation.

---

## 9. What this checkpoint did NOT complete

Stated plainly rather than implied:

- **§6/§7 whole-viability audit with the full cause taxonomy.** Not built. The existing
  chain audit reports a terminal *blocker* taxonomy, not the ~30-family cause taxonomy with
  contributing causes and single-count death attribution. **Gates 9, 10, 11 are not met.**
- **§9 adaptation cascade.** Not built. No pressure→response→physical-result→recovery trace
  exists, so "adaptation appears before collapse" (gate 19) is **unproven** in either
  direction.
- **§12 dedicated multi-cause extinction arms.** Not built. Gate 26 (four distinct cause
  families producing extinction) is **not met**. The labor-collapse arm in particular is
  known to be unreachable (§3).
- **§11 prosperity trajectory metrics** (doubling time, years in surplus, shock recovery
  time as first-class outputs) are only partially covered by the ladder.
- **10-seed arms** where the spec asks for ten; the ladder used five.
- **Performance** was not re-measured on this branch (§7).

Gates from §14 also unmet, unchanged from CORRECTION-14 and with the same measured cause:
no rich seed reaches 6 successful fissions (max 4); **no second-generation fission**; only
3 of 5 `good` lineages fission at all; marginal-but-escapable never escapes (0/5 survive);
hostile does not go extinct (5/5 survive, declining 34 → 12–14 with no floor). Four of these
share the destination-knowledge horizon measured in CORRECTION-14: a band's known-tile
horizon never exceeds 9 tiles, so every daughter is founded inside the parent's own
catchment.

## 10. Remaining debt, in priority order

1. **Destination knowledge horizon / exploration reach** — still the binding limit on
   multi-generation expansion.
2. **Social causality** — the entire social layer is readability-only; cooperation and
   breakdown have no physical mechanism. Requires the relationship/household substrate, not
   a scalar.
3. **Cohort causality** — working adults affect food only through party size, worth 0.01 of
   support ratio. Labor collapse cannot cause extinction.
4. **Cause taxonomy, adaptation cascade, extinction arms** — the unbuilt parts of this
   checkpoint (§9).
5. `demographicDeathMemoryPathAudit`'s two confounded orderings (§6).
