# CORRECTION-32A — INSTRUMENT CORRECTION

Why the CORRECTION-32 attribution instrument was rejected, what replaced it, what the replacement
can and cannot measure, and what the corrected measurements say about the production diff.

**Status of CORRECTION-32 when this pass began: PROGRESS — NOT ACCEPTED, NOT FROZEN.**
This is an evidence-repair pass. It opened no new roadmap seam and changed no production file.

---

## 1. The audit-design note (§4)

Written before the corrected instrument was built. Every question the checkpoint required, answered.

### What exactly is the causal question being measured?

> On one candidate that one band is weighing in one season, how much of that candidate's decision
> score is caused by *other bands being physically nearby right now*, and through how many
> separately-named paths does that one physical fact enter?

It is **not** "what does the world look like without crowding" — that is a different, much larger
question, and answering the second while claiming the first is precisely how the superseded
instrument failed.

### What is the treatment?

The single input `NearbyBandPressure` — the output of `getNearbyBandPressure`, which is the sole
reader of `cache.nearbyBandPressureByBandTileKey` (verified: `crowding.ts:24/34/45` are the only
references outside the cache's own declaration and construction). Setting that memo to an empty
neighbourhood is a clean single-cause intervention on the crowding *input*, and every downstream
production derivation then re-runs on real code.

### What must remain identical between the treated and control reading?

The candidate's entire non-crowding state: all 66 `ScoreBreakdown` fields outside the declared
crowding manifest, and the candidate's score addition made *outside* `scoreDecision`.

### What makes two candidates the same candidate?

Action type, target tile (or stayed tile), origin tile, and candidate family. The superseded key
omitted origin and family, and the omission is exactly what broke it.

### Which fields are legitimately crowding-derived? Which must remain fixed?

See `candidate-field-partition.json` — 22 declared fields, each with a traced source path, split
into `direct` (the field's whole value *is* the crowding quantity) and `composite` (crowding is one
term among others). The other 44 must not move. Three of the 22 — `recoveryBenefit`,
`knownOpportunityPull`, `depletionPenalty` — were **not** in the first draft; the equality guard
flagged them, every affected pair was rejected, and each was then traced in source before being
declared. None was added to make a test pass.

### What does a candidate-set change mean?

A behavioural response, reported in `candidate-construction-response{,-before}.json`. It is
**never** a score attribution, because there is no counterpart to subtract from.

### When is a score delta attributable? When must a result be labelled contaminated?

Attributable only when the pair is unique in both arms, every differing field is declared crowding,
and the external score addition is identical. Otherwise `attributableTotal = null` with a
`pairStatus` naming the cause. No residual is published in the rejected case.

### Can nested composite effects be measured exactly without rebuilding the whole candidate?

**No, and this is the honest limit.** Crowding inside `explorationValue` or `expectedFutureValue`
cannot be separated from those composites' food, water and own-use terms at the scorer. What *can*
be done exactly is to replace the whole composite with the value production itself computed under
zero crowding — which is what the partition metric does. Its crowding *share within* the composite
remains unmeasured and is named as such.

### What claims can the evidence honestly make?

Exact per-field direct contributions; exact fixed-candidate partition contributions on clean pairs;
candidate-set responses, separately. Not: a whole-world score difference called crowding magnitude.

### What invariants must a zero-crowding control satisfy?

Every generated candidate — selected or not — must read zero on every declared crowding field,
zero exact direct contribution, and zero partition contribution. See §11 and `zero-controls.json`.

### How will the instrument detect its own failure?

Nine self-consistency assertions (SC1–SC9), evaluated on every run and published in
`candidate-pairing-integrity{,-before}.json`. Two of them **failed on the first run** and forced
real changes: SC5 caught the three undeclared fields, and SC1/SC8 caught a design error in which
zeroing a *composite* was being reported as a crowding path. The audit was built to fail loudly and
it did.

---

## 2. Methodology and bibliography (§5)

The anthropological research is unchanged; production semantics did not move. See
`RESEARCH_AND_CAUSAL_MODEL.md`, which this pass preserves in full.

The methodology below is standard experimental and software-testing practice, applied to a
simulation. Each principle is separated from the repository-specific abstraction it justifies.

| Methodological principle | Source | Repository-specific abstraction |
| --- | --- | --- |
| A causal effect is the difference between two potential outcomes of *the same unit*; "no causation without manipulation" | Holland, *Statistics and Causal Inference*, JASA 81 (1986); Rubin, *Estimating Causal Effects*, J. Educ. Psych. 66 (1974) | The unit is ONE candidate, identified by action type + target + origin + family — not "the band", and not "the world" |
| Confounding: an estimate is only causal when every other input path is blocked | Pearl, *Causality* (2nd ed., 2009), ch. 3 — the back-door criterion | The 66-field equality guard: any undeclared field that moves blocks attribution and the pair is rejected |
| Internal validity threats in quasi-experiments; a difference that could be produced by the measurement procedure is not an effect | Shadish, Cook & Campbell, *Experimental and Quasi-Experimental Designs for Generalized Causal Inference* (2002) | The `pairStatus` taxonomy: `unpairable_duplicate_candidate_key`, `contaminated_non_crowding_difference`, `contaminated_external_score_addition_differs` |
| Blocking / paired designs: compare within a matched unit to remove between-unit variance | Fisher, *The Design of Experiments* (1935) | The fixed-breakdown hybrid — one candidate's own breakdown with only declared fields substituted, so nothing between candidates can vary |
| Metamorphic testing: assert a relation between the outputs of related inputs when no oracle exists | Chen, Cheung & Yiu, HKUST-CS98-01 (1998); Segura et al., *A Survey on Metamorphic Testing*, IEEE TSE 42 (2016) | The zero controls: "crowding = 0 ⟹ every crowding contribution = 0" is a metamorphic relation, and Z5 is its confounding-resistant form |
| Differential testing: run two versions on identical input and treat any difference as a signal to explain | McKeeman, *Differential Testing for Software*, Digital Technical Journal 10 (1998) | The before/after arms, run from the same script file on two commits |
| Measurement validity: a construct is only measured if the instrument responds to it and not to its neighbours | Cronbach & Meehl, *Construct Validity in Psychological Tests*, Psych. Bulletin 52 (1955) | Z5 (large unrelated pressures, crowding zero) and S7 (band count held constant) are discriminant-validity controls |

**Provenance of this bibliography:** these are standard, long-established references cited from the
established literature. They were not re-verified against online sources in this pass, and none of
them was used to choose or change a crowding coefficient — §5's prohibition is respected. Their
role is entirely methodological: *one changed cause → one attributable measured consequence.*

---

## 3. Why the superseded instrument's residuals were not crowding (§3.1–§3.3)

`actionKey` was `${type}:${targetTileId}`. An M0.8 corridor-relocation candidate emits a
`move_to_tile` whose target can coincide with an ordinary known move's, so both hashed to one key
and the control arm's `new Map(...)` kept only the last. The instrument then subtracted two
different candidates of two different families.

Measured, in `candidate-pairing-integrity.json`:

| fixture | colliding key | core move | corridor relocation | old "crowding influence" | corrected |
| --- | --- | --- | --- | --- | --- |
| `P1_zero_crowding_control` | `move_to_tile:tile:196:90` | 4.71 | 1.32 | −3.39 | **0** |
| `F1_adjacent_pair_rich` (after) | `move_to_tile:tile:194:90` | 4.98 | 0.96 | −4.02 | **0.04** |
| `F2_solo_control_rich` (after) | `move_to_tile:tile:196:90` | 4.71 | 1.32 | −3.39 | **0** |
| `F1_adjacent_pair_rich` (before) | `move_to_tile:tile:196:90` | 4.33 | 1.31 | −3.02 | **0.15** |
| `F2_solo_control_rich` (before) | `move_to_tile:tile:196:90` | 4.71 | 1.32 | −3.39 | **0** |

`−4.02` is `0.96 − 4.98`. Every impossible residual in both arms sat on a colliding key: 2 excess
duplicate entries per arm, 2 impossible residuals per arm — a 1:1 match, with no unexplained
remainder. All five cases are asserted in `instrument-regression.json`.

`RESIDUAL = TOTAL − sum(DIRECT)` is **removed**, not recomputed. It is admissible only when every
non-crowding input is provably identical, and where that *is* provable the partition contribution
already **is** the total, so the residual is redundant. This pass publishes no residual anywhere.

---

## 4. Architecture decision (§6)

| Option | Verdict | Reason |
| --- | --- | --- |
| **A** — fixed `ScoreBreakdown` substitution only | **ADOPTED** as metric 9.1 | Exact and pairing-free, but only meaningful for fields whose whole value IS the crowding quantity. Restricted to `nearbyBandPressure`, `crowdingPenalty`, `crowdingExploreBoost`. |
| **B** — hybrid candidate attribution | **ADOPTED** as metric 9.2 | The candidate's own breakdown with only declared fields replaced by production's zero-crowding values. Every other field byte-identical. |
| **C** — paired rebuild with a strict equality guard | **ADOPTED**, as B's admission gate | Unique identity in both arms, all 66 fields compared, external additions compared. Any failure ⇒ `attributableTotal = null`. |
| **D** — behaviour-neutral pure-helper extraction | **REJECTED** | Would have meant exporting `getBadSiteStuckResidencePenalty` from `bandDecision.ts`. Not necessary: its effect is captured wholesale as the external-addition difference, and where that differs the pair is rejected. §2's "prefer correcting the audit without touching production" applies, and **no production file was touched.** |
| **E** — qualify the claim | **ADOPTED** for what A/B/C cannot reach | The crowding *share within* a composite, and the crowding part of a differing external addition, are named as unmeasured rather than estimated. |
| Old TOTAL (whole-candidate subtraction, unguarded) | **REJECTED** | §6: "Do not preserve the old TOTAL metric merely because it appears in existing evidence." |

**Selection rule applied:** the smallest trustworthy method. A + B + C + E.

Why the zeroing **seam** was kept: the seam was never the defect. `getNearbyBandPressure` reads the
memo first and returns it, so swapping that one Map is a genuine single-cause intervention on the
crowding input. The pairing and the subtraction were the defect, and both are replaced.

### Why 9.1 was restricted mid-build

The first draft applied zero-substitution to composites too (`mobilityPressure`,
`perCapitaReturn`, `populationPressure`, …). SC1/SC8 failed immediately: a **solo band with no
neighbours** measured a direct contribution of −0.80, because zeroing `mobilityPressure` measures
the whole field — the band's own food stress, water stress and fatigue included — not crowding.
That is the same class of error as the superseded instrument, in a different form. Composites moved
to the partition metric, where they are replaced by production's own zero-crowding value.

---

## 5. Instrument limitations, stated not buried

1. **The zeroing seam does not zero `cache.nearbyBandsByBandId`.** On the *before* arm,
   `getSocialAccessRisk` read `nearbyBandCount` from that map, which this instrument leaves intact.
   `partition_socialAccessRisk` therefore reads **0 on both arms**, and that zero is an instrument
   blind spot, **not** evidence that the before arm's `socialAccessRisk` carried no crowding.
   Fixture **S1** covers it directly and measures the effect at **+0.05**.
2. **The crowding share inside a composite is not isolable at the scorer.** Only the whole composite
   can be substituted.
3. **A differing external score addition cannot be split.** `getBadSiteStuckResidencePenalty` is
   module-private and reads crowding fields off the breakdown, so when the external addition moves,
   the pair is rejected rather than partially attributed. One candidate in each arm's P1–P21 run is
   rejected on this ground.
4. **Production does not stamp `isSideCountryProbe` on `AlternativeConsidered`.** Two probes of
   different families at the same target are therefore indistinguishable in the archive. They are
   **rejected as duplicates rather than guessed** — 2 candidates per arm in the P1–P21 run.
5. **Group sums carry `round2` error.** `scoreDecision` is `round2(linear)`, so with 6 disjoint
   groups the sum-vs-total budget is a *proven* `0.01 × (6 + 1) = 0.07`. Observed maximum: **0.02**.
   SC9 asserts the groups are disjoint and cover the manifest exactly, which is what makes the
   linearity argument valid.
6. **The fixtures are synthetic in placement.** Bands warm on real ground and are then parked, and
   held geometries are re-parked after each real season. Flagged `syntheticState: true` throughout.
7. **Geometry is now resolved by search, not by fixed offsets.** The first version of
   `socialAccessLifecycleAudit.mjs` asked for a tile at `y = 144` on a 220 × 140 map and silently
   got nothing — the same class of error the previous pass recorded for `P21`. Corrected before any
   result was taken; the vacuous run is reported here rather than discarded.
8. **S5 (second-hand evidence) was NOT constructed.** Two bands in isolated proximity produce direct
   observation, not hearsay; a report needs a third relaying band. Reported as
   `NOT_CONSTRUCTED_NO_REPORT_LINKED_RECORD_IN_THIS_GEOMETRY`, **not** as a pass, and no claim about
   second-hand access evidence is made from this pass.

---

## 6. A confounder found in this pass's own fixture, and how it was resolved

The first version of **S2** compared a never-contacted world against a contacted one and measured
**−0.03** — apparently proving the new `socialAccessRisk` source was inert. It was not. A real
contact episode creates **two** things: place evidence *and* a contact memory. Since
`knownContactRelief = clamp01(knownContactCount * 0.08)` **subtracts** from access risk, the raw
delta was the sum of a rise in place caution (**+0.05**) and a fall from newly-known neighbours
(**−0.08**).

That is one treatment with two causes — the very error this correction exists to remove, reproduced
inside the correction itself. It was resolved by holding the confounder fixed rather than by
widening a tolerance: the place term is now isolated by comparing **two tiles inside the same
world**, where the 0.28 base, the contact relief and `unrelatedRisk` are all per-band and identical,
so `risk(X) − risk(Y)` is exactly the contribution of the evidence about X. Both the isolated
measurement (**+0.10**) and the confounded raw delta (**−0.03**, decomposed) are published.

A second, smaller instance: **S3**'s release assertion first demanded bitwise equality on a
two-decimal quantity and failed on `rememberedRefusalAvoidance` 0.33 vs 0.34 — one rounding unit,
and *below* the never-contacted baseline. The assertion was wrong, not the production code: release
means *no residual danger*, so the test is now directional (no caution input above baseline by more
than one unit of reported precision) and the exact residuals are published.

---

## 7. What the corrected instrument measures

Both arms, same script file, 150 (after) / 152 (before) candidates, **0 rejected, 0 contaminated,
0 unpaired, 0 undeclared differing fields, 9/9 self-consistency assertions passing on both arms.**

| Metric | before | after |
| --- | --- | --- |
| max separately-named **direct** crowding charges on one candidate | 3 | **1** |
| candidates carrying ≥3 direct crowding charges | 1 | **0** |
| direct `nearbyBandPressure` influence (Σ abs) | 2.02 | **0** |
| direct `crowdingPenalty` influence (Σ abs) | 3.02 | 3.92 |
| candidates charged through `partition_rangeSaturation` | 32 | **0** |
| candidates charged through `partition_daughterKin` | 42 | **0** |
| candidates charged through `partition_pressureState` | 22 | 16 |
| max abs fixed-candidate partition total | 0.42 | **0.24** |
| candidates with ≥3 non-zero partition groups | 48 | 7 |
| max non-zero partition groups on any candidate | 5 | **3** |

`direct_crowdingPenalty` **rising** 3.02 → 3.92 is the intended effect of
`CROWDING_DECISION_COST_WEIGHT` moving 0.72 → 0.96, not a regression.

The three partition groups still active on the after arm are the three paths CORRECTION-32 claims
to *keep*: the target-site cost, the current-site dispersal motive through
`mobilityPressure → netMovePressure`, and their own nested propagation through
`recoveryBenefit` / `expectedFutureValue` / `knownOpportunityPull`. Nested propagation of an
authority is not a second charge of it.

---

## 8. Production implementation decision (§18)

**A — PRODUCTION IMPLEMENTATION SUPPORTED.**

The corrected evidence supports the existing production diff. No production change is required, and
none was made: `git diff --name-only fdf0431..HEAD` contains only `scripts/`, `docs/` and the two
root documentation files.

The defect was in the audit's pairing, not in `src/sim`. Under an instrument that holds every
non-crowding field of a fixed candidate byte-identical and rejects anything it cannot prove clean:

- duplicate crowding score charges are removed (`nearbyBandPressure` direct influence 2.02 → 0;
  `rangeSaturation` 32 candidates → 0; daughter-kin 42 → 0);
- distinct ecological, social, target-site and kin effects remain separate (Z5: food stress 1.0,
  water stress 0.6, mobility pressure 0.95, own-use range saturation 0.49 all present with crowding
  at exactly zero, none classified as crowding);
- every zero-crowding candidate measures zero — 67 candidates across 6 fixtures, in **both** arms;
- legitimate active access evidence now moves social access (**+0.10**) where physical bodies no
  longer do (**+0.05 → 0**), and released history stops moving it.

Two things this pass does **not** claim: that `0.96` is the physically right magnitude — CORRECTION-32
fixed the authority and deliberately did not tune the strength — and any outcome improvement.
