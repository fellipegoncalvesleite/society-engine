# CORRECTION-32 — FINDINGS

> ## ⚠ CORRECTED BY CORRECTION-32A — READ THIS FIRST
>
> **CORRECTION-32 is `PROGRESS`. It is NOT accepted and NOT frozen.** Its first report said
> `PASS`; that verdict rested on an attribution instrument that has since been rejected.
>
> **What was wrong.** `scripts/crowdingDecisionAttributionAudit.mjs` paired the full and
> zero-crowding candidates by `${actionType}:${targetTileId}`. That key is **not unique** — an
> M0.8 corridor-relocation candidate emits a `move_to_tile` whose target can coincide with an
> ordinary known move's — and `new Map(...)` kept only the last. The audit then subtracted **two
> different candidates of two different families** and published the difference as crowding
> influence. `−4.02` is literally `0.96 − 4.98`. On a **solo band with no neighbours at all** it
> reported `−3.39`. Every impossible residual in both arms sits on a colliding key, 1:1, with no
> unexplained remainder.
>
> **What is withdrawn.** Every `totalCrowdingInfluence`; every
> `residualThroughNestedComposites` (the metric is removed, not recomputed); the headline
> **"candidates with ≥3 crowding paths 49 → 0"** and its natural restatements **56 → 0** and
> **144 → 0**; **"max paths 4 → 2"**; and the claim that P1 was a zero-crowding control (it
> verified `stay.totalCrowdingInfluence` only, while a move candidate in the same payload read
> −3.39).
>
> **What replaces them.** See `INSTRUMENT_CORRECTION.md`. Under an instrument that holds every
> non-crowding field of one fixed candidate byte-identical and rejects any pair it cannot prove
> clean: max separately-named **direct** charges on one candidate **3 → 1**; candidates carrying
> ≥3 direct charges **1 → 0**; direct `nearbyBandPressure` influence **2.02 → 0**; candidates
> charged through range saturation **32 → 0** and through daughter-kin **42 → 0**; max
> fixed-candidate partition total **0.42 → 0.24**. 150/152 candidates, **0 rejected, 0
> contaminated, 9/9 self-consistency assertions passing in both arms.**
>
> **What is NOT withdrawn.** The physical-layer readings, the pressure-state observations, the
> natural-occurrence occurrence counts and the behavioural comparison were never produced by the
> broken pairing. They stand, with the qualifications in `before-after.json`.
>
> **The production implementation is SUPPORTED by the corrected evidence** and was not changed in
> CORRECTION-32A. Two reporting errors are corrected: the diff touches **seven** production files,
> not six, and it **does** add one new exported constant (`CROWDING_DECISION_COST_WEIGHT = 0.96`)
> even though it adds no new constant *file*.
>
> Sections 1–11 below are the ORIGINAL report, preserved. Read them only alongside this block.

---

**SHARED RANGE — CROWDING DECISION-PRESSURE AUTHORITY AND DUPLICATE INFLUENCE**

Branch `checkpoint/crowding-decision-pressure-authority-32` from the accepted and frozen
CORRECTION-31 tip `3e2c1215b4ccef2beb799b3a7882247f6cd186cd`.
`main` untouched at `0a43083a3a9103bc6b8f693b8823a604ae2c6a8d`.
**PRODUCTION BEHAVIOUR CHANGED** — no fingerprint parity is claimed or possible.
**ROADMAP ITEM 3 REMAINS OPEN.**

---

## 1. What physical fact was being counted

One thing: **other people are physically nearby, right now.** Since CORRECTION-28 it has exactly
one source — `NearbyBandPressure.weightedCrowding`, built from current physical proximity within
a radius-4 ball, weighted by distance, same-patch occupancy and population, discounted `×0.72`
for kin. It is not memory, not hearsay, not a report. The repository already measures the
*consequences* of that fact elsewhere and separately: shared catchment splits reachable support,
depletion and per-capita return measure realized loss, and encounters / range friction / access
memory carry social evidence with provenance (CORRECTION-29, -30) and a lifecycle (CORRECTION-31).

## 2. How many times it entered a decision before

Measured, not argued. The instrument is CORRECTION-31's with-minus-without counterfactual applied
to the decision score: the tick cache's nearby-band-pressure memo is answered as "nobody nearby",
so **real production code** — `deriveBandPressureState`, `getCrowdingPenalty`,
`applyRangeSaturationContext`, `getDaughterDispersalPressure` and the whole candidate scorer —
re-derives with the crowding input at zero. No formula was re-implemented.

**49 of 113 measured candidates carried three or more separately-named crowding charges.**
Naturally, over the same maps, seeds and 20-year duration AUDIT-27 through CORRECTION-31 used,
**56 of 212** candidate evaluations did; at 50 years, **144 of 488**. The worst candidates carried
**four** named charges, and the exploration candidate carried **six**.

The clearest single reading, fixture `F4` (three neighbours, river valley), stay candidate:

```text
weightedCrowding 0.44
  nearbyBandPressure  −0.10   (the raw scalar,        weight −0.24)
  crowdingPenalty     −0.12   (the same scalar × terrain, weight −0.72)
  rangeSaturation     −0.05   (the same scalar × 0.34 inside saturation)
  pressureState       −0.01   (risk / attachment / mobility)
  nested composites   −0.14
                      ─────
                      −0.42   from one physical condition
```

## 3. Which paths were genuinely distinct

Three, and they survive:

1. **A target-site cost.** A place with people on it is worse to occupy. Belongs on the candidate
   being judged, sourced from *that tile's* crowding.
2. **A current-site dispersal motive.** A crowded residence is a reason to look elsewhere. It
   reaches the score through `mobilityPressure → netMovePressure`, which is **0 on the stay
   candidate**, so it lifts alternatives instead of penalising home a second time.
3. **A bounded exploration response.** `crowdingExploreBoost`, counted once.

## 4. Which paths were duplicates

| Duplicate | What it actually was |
| --- | --- |
| `nearbyBandPressure × 0.24` **and** `crowdingPenalty × 0.72` | the same scalar, once raw and once capacity-conditioned. The raw term **diluted** exactly the terrain conditioning §12.9 requires |
| `expectedFutureValue`: `− crowdingPenalty×0.14 − weightedCrowding×0.08` | the same pair again, inside one composite |
| `badSiteStuckResidencePenalty`: `+ nearbyBandPressure×0.16 + crowdingPenalty×0.14` | the same pair a third time |
| `rangeSaturation × 0.34` on the stay candidate | contains `weightedCrowding × 0.34` — **and** `populationPressure`, a distance-weighted sum over every band in radius, which is a *second* measurement of the same bodies |
| `riskPressure += crowdingPenalty × 0.08` | proximity raising a **danger** signal that `demography.ts:401/1780` and `viability.ts:248` read, with no social evidence at all |
| `placeAttachmentPull −= crowdingPenalty × 0.22` | charged on the stay candidate, where the target cost already applies, and propagated again through `netMovePressure −= attachment × 0.48` |
| `safeFrontierPull −= weightedCrowding × 0.22` | scored at **+0.62** on the same move/explore candidate whose `crowdingPenalty` already charges that tile |
| move-side `perCapitaReturn = expectedKnownFood − crowdingPenalty×0.24` | inferring a per-capita return loss from bodies, which the ecology already measures physically |
| explore candidate's `nearbyBandPressure` / `crowdingPenalty` | **the residence's** crowding, charged as a cost against the option of leaving the residence |
| `dryMargin.getSocialAccessRisk`'s `localCrowding` | `nearbyBandCount/5 + salientUsers/4` → social danger. Neither term is social evidence: the first is bodies, the second is **other bands' remembered places with no distance gate at all** — the CORRECTION-28/29 defect surviving in a module neither checkpoint touched |

**The explainability failure, stated as a measurement.** On fixture `F5`, the exploration
candidate's six crowding charges have contradictory signs and net to **−0.01**. The same physical
fact simultaneously discouraged and encouraged the same option; no honest explanation of that
decision could be written. That is §12.14 failing, and it is why two crowding *reasons* were being
emitted for one charge.

## 5. What authority was selected

**Option D (separate current-site and target-site authorities), implemented on an Option-B
quantity (`crowdingPenalty` as the single decision-facing value).** A, C, E and F were rejected on
evidence — see `ARCHITECTURE_DECISION.md` §3.

```text
weightedCrowding                    EVIDENCE — UI, kin, explanation, transform input
  └─ crowdingPenalty = wc × dryAmplifier × (1 − spatialCapacityBuffer × 0.48)
       ├─ known candidate tile  → −0.96 × crowdingPenalty(that tile)   TARGET COST
       ├─ unknown destination   → 0                                    unknowable
       ├─ residence             → mobilityPressure ×0.20 → netMovePressure
       │                            → +0.72 on NON-STAY candidates      DISPERSAL MOTIVE
       └─ residence             → crowdingExploreBoost ×0.18
                                    → +0.48 on the exploration option   RESPONSE, once
```

`0.96 = 0.24 + 0.72` — the sum of the two weights it replaces. On the maximally constrained tile
(`dryAmplifier = 1`, `spatialCapacityBuffer = 0`) the charge is **exactly what it was**; only the
over-charge on spacious, well-watered ground is removed. Nothing is neutralised.

## 6. How current-site and target-site crowding now differ

- **Known move candidates** read `crowdingPenalty` from the **candidate tile's** memo — target
  specific, and they already did. `P3` shows a residence at `weightedCrowding 0.02` with a target
  6 tiles from the neighbour reading **0**, in **both arms**: the residence-versus-target confusion
  was never in the known-move family.
- **The exploration candidate** is where it lived, and it is fixed: its `crowdingPenalty` was the
  residence's and is now `0`. `P14`: `explorationPaths 6 → 2`, target penalty `0.06 → 0`, and the
  crowded-minus-clear exploration score gap goes `+0.01 → +0.04` — crowding now raises the value of
  looking elsewhere, once, with one sign.
- **A structural constraint found while building `P3`–`P5` and recorded rather than worked
  around:** `getTileIdsWithinKnownMoveRadius` caps ordinary known-move candidates at Manhattan
  distance **≤ 2**, while `CROWDING_RADIUS = 4`. A destination is therefore always deep inside the
  residence's own crowding ball, and residence-versus-target separation is expressible only in a
  narrow band of geometries — the ones the fixtures assert distances for.

## 7. How terrain, depletion, social evidence and kin remain separate

| | Evidence |
| --- | --- |
| **Terrain** | `P6`: identical populations, `capacityTransformRatio` **0.40** on spacious river valley vs **0.667** on constrained dry plains, **unchanged in both arms**. Stay influence falls `0.14 → 0.07` on rich ground and only `0.26 → 0.19` on dry — the removed over-charge is largest exactly where capacity is highest, which is the point |
| **Depletion** | `P7` (2 seasons): crowding 0.15, `perCapitaReturn` **1.00**, so crowding does **not** manufacture depletion. `P8` (24 seasons, neighbour departed): crowding **0**, `perCapitaReturn` **0.05** — real degradation with no current crowding. `P9`: both, coexisting, identical in both arms |
| **Social** | `P10`: physical `weightedCrowding 0.15` with 24 encounter records, 1 contact memory, `accessState expected_return` — the two channels read independently, and **crowding's contribution to `riskPressure` goes 0.01 → 0**. Naturally, band-seasons where crowding raised `riskPressure` go **3 → 0** at 20 years and **7 → 0** at 50 |
| **Kin** | `P11`: the kin arm reads `weightedCrowding` **0.11** against the non-kin arm's **0.15** — the `×0.72` discount, exactly — and `crowdingPenalty` 0.06 → 0.04. Kin are discounted and **still consume space**. `parentOverlap 0.31`, `daughterDispersalPressure 0.58` are unchanged in both arms |
| **Tolerance** | `P12`: `contactCount 36`, `trustLikeTolerance 0.98` coexisting with `weightedCrowding 0.15` — tolerated aggregation is not suppressed |
| **Release** | `P16`: the neighbour leaves → crowding `0.15 → 0`, penalty `0.06 → 0`, stay paths `1 → 0`, influence `0.07 → 0`, while the contact memory survives. `P21`: 30 seasons of proximity → departure → reaggregation, with **no residual after departure**. Before the repair, departure also had to release `decisionSaturation 0.17 → 0.05`; after, that value never carried crowding at all |

## 8. What changed naturally

Same maps, seeds (`audit27:natural`), scenarios and durations as AUDIT-27 → CORRECTION-31.
**2,400 living band-seasons at 20 years; 6,000 at 50.**

**THE PHYSICAL CROWDING LAYER IS IDENTICAL AT 20 YEARS ON ALL SIX OF ITS KEYS** — 2,400 living
band-seasons, **20** crowded band-seasons, `weightedCrowding` sum **0.74** / max **0.07**,
`crowdingPenalty` sum **0.52** / max **0.06**. The field was not touched; only the charging was.

| | 20 y before → after | 50 y before → after |
| --- | --- | --- |
| candidates with ≥3 crowding paths | **56 → 0** | **144 → 0** |
| max paths on any candidate | 4 → **2** | 4 → **2** |
| direct `nearbyBandPressure` contribution | 0.97 → **0** | 3.23 → **0** |
| `rangeSaturation` overlap contribution | 0.09 → **0** | 0.23 → **0** |
| daughter-derived contribution | 0.54 → **0** | 1.67 → **0** |
| crowding raised `riskPressure` | **3 → 0** | **7 → 0** |
| crowding reduced `placeAttachmentPull` | **11 → 0** | **22 → 0** |
| combined effective contribution | 4.92 → 3.78 | 37.80 → 22.85 |

At 50 years the two worlds have diverged behaviourally (44 vs 46 crowded band-seasons), so the
50-year crowding totals are **not** like-for-like and are reported as such.

**Behaviourally.** Of four 20-year runs: `map1:s2` is **byte-identical across all 80 seasons**;
`map1:s1` diverges only in derived pressure values at tick 60 with **no physical divergence at
all** (moves 265 → 265); `map2:s1` diverges physically at tick **17** and `map2:s2` at tick **23**.
Final-state comparison across 6 runs × 14 keys: **75 of 84 identical**. The nine that move are
population (224→226, 226→227, 21→20), residential moves (448→450, 395→401, 53→57) and mean support
ratio. **Living bands, total bands, absorbed, extinct, dispersed, fissions, intra-season trips,
depletion sum, depleted tiles, contact memories and friction records are identical in every run.**

**`crowdedSeasonsWhereCrowdingFlippedSelection` is 0 in BOTH arms** at 20 and 50 years. Crowding
never decides an action on its own in these worlds — consistent with AUDIT-27's
`crowdingReasonInstances = 0` across 1,547 moves. **NO IMPROVEMENT IS CLAIMED.** The acceptance
criterion is a truthful single authority, not a better simulation.

**Changed decisions, classified** (§16):

- **duplicate influence removed** — every candidate whose path count fell from ≥2 to 1, i.e. all
  56 (20 y) and 144 (50 y) multi-path candidates, plus the 3/7 risk-pressure and 11/22
  attachment cases.
- **legitimate distinct effect preserved** — the target cost (`P4`, `P5`, `P18` move family), the
  dispersal motive (`netMovePressure`, `P3`'s `netMovePressureCrowdingContribution` 0.01 in both
  arms), the exploration response (`P14`), the terrain transform (`P6`), the kin discount (`P11`).
- **unexpected score inversion** — none found. `P17` stays monotone in both arms (weighted
  crowding 0.15 / 0.30 / 0.44 / 0.59 for 1–4 neighbours) and bounded.
- **unexplained divergence** — the two map2 runs' physical divergence from tick 17/23 onward is
  **explained in kind** (the whole score moved, so a near-tie resolved differently) but **not
  traced decision-by-decision**. That trace was not run and is not claimed.

## 9. Suspicious findings and calibration limits

1. **`crowdingExploreBoost` reads 0 in the aggregate detector after the repair, and it is still
   live.** It is `0.0108` on fixture `F5` at weight `+0.48`; the product falls below
   `scoreDecision`'s own `round2`, so the per-path detector cannot see it. The boost was **not**
   removed — `P14` shows it, and the crowded-minus-clear exploration gap widened.
2. **`0.96`, `0.22`, `0.30`, `0.18` are calibration choices.** Each follows one stated rule — the
   consolidated weight is the sum of the weights it replaces, applied to the canonical
   capacity-conditioned quantity — so the constrained-terrain charge is unchanged and only the
   spacious-terrain over-charge is removed. No research result was converted into any of them and
   no weight was tuned toward a population, survival or event-frequency target.
3. **The retained crowding path is named, not hidden.** `daughterDispersalPressure` still consumes
   `weightedCrowding` (`×0.36` daughter, `×0.30` gated founder) and reaches the score through
   `daughterDispersalExploreBoost` (+0.70) and `explorationValue`. §6 forbids redesigning fission
   and §12.13 permits an explained path. Its natural contribution is **0**
   (`daughterExploreBoostCrowdingDerived = 0` at 20 and 50 years) because fissions are 0 naturally
   and AUDIT-27 measured `kinOverlapPairs = 0`; `P11` exercises it with a **synthetic** lineage
   link and claims no natural credit.
4. **`rangeSaturation.perCapitaReturnEstimate` still carries crowding into the stay candidate**
   (+0.24) through `effectiveHabitatSuitability`. That is the ecology authority's own estimate;
   changing it means touching `carryingCapacity`, which is outside this checkpoint. Documented in
   `authority-ledger.md` §8, not silently kept.
5. **A newly found anti-omniscience defect, deliberately NOT repaired.**
   `dryMargin.getSocialAccessRisk`'s `unrelatedRisk` reads
   `Object.values(world.bands).length > 8` — a **world-truth band count** a band cannot know. Found
   during the mandated inspection of `socialAccessRisk`; it is not a crowding defect, so it is
   recorded rather than fixed here.
6. **`socialAccessRisk`'s replacement source is narrower than what it replaced.** It now reads the
   band's own `protoAccessMemory.places[tileId]`, which is empty until the band has real access
   evidence about that place. In worlds with no friction this makes `socialAccessRisk` close to
   constant. That is the correct direction — social danger requires social evidence — but it means
   the term does less work than before, and no attempt was made to compensate.
7. **Three instrument errors in this pass's own probes were caught and are recorded, not dropped.**
   (a) The first attribution run measured every synthetic fixture at `weightedCrowding = 0`,
   because a 14-season warm-up lets parked pairs drift apart — the trap CORRECTION-28's P4 and
   CORRECTION-30's P3 both hit; fixtures now warm on real ground and then park.
   (b) The daughter-derivative arm first substituted values derived at the *residence* for
   candidates whose breakdown read the *target tile*, inflating that path from 0.95 to 2.11; it is
   now tile-exact.
   (c) `farLand` searched `+x` only, and the RICH origin is an estuary whose `+x` neighbourhood is
   water and then off-map, so it returned `undefined`, `park` silently skipped the placement, and
   `P21`'s "departed" phase measured a band that had never left. The fixture's own verdict caught
   it (`RESIDUAL_AFTER_DEPARTURE`), not the simulation.
8. **`crowdingControlledFixturesAudit.mjs` defaults its timeline output into AUDIT-27's frozen
   evidence directory**, and a mistyped flag (`--timeline` for `--timeline-out`) overwrote
   `release-timelines.json` once. It was restored with `git checkout` and rerun with the correct
   flag; `git status docs/evidence/` is clean apart from this checkpoint's own new directory. The
   same trap is recorded in CORRECTION-28's findings and it caught this pass too.
9. **`P12`'s contact-memory probe prints `bandId: "undefined"`** — a field-name mismatch in the
   audit's display code, not a production defect. The `contactCount` and `trustLikeTolerance`
   values it reports are real.

## 10. Validation

Executed on this branch:

| Check | Result |
| --- | --- |
| `npx tsc -p tsconfig.json --noEmit` | PASS |
| `npx tsc -p tsconfig.node.json --noEmit` | PASS |
| `npm run build` | PASS |
| `node scripts/checkGraph.mjs` | PASS — graph 221/764, 0 dup, 0 dangling |
| `node scripts/importBoundaryAudit.mjs` | PASS — internal back edges **85, unchanged** |
| `node scripts/seasonOrderInvarianceAudit.mjs` | PASS — 0 per-band divergence |
| `node scripts/stepModeInvarianceAudit.mjs` | PASS — **both maps, `fullCanonicalStateMatch: true`, `firstDivergence: null`** |
| `node scripts/catchmentInvariants.mjs` | PASS — 0.5/0.5 symmetric split, per-capita 1.5 → 1.2 under contest |
| `node scripts/livingEcologyFoodPipelineAudit.mjs` | PASS |
| `node scripts/mobilityAuthorityAudit.mjs` | PASS |
| `node scripts/socialCausalityAudit.mjs` | **byte-identical between arms (7,226 bytes)** |
| AUDIT-27 controlled fixtures | **11/11 unchanged between arms** |
| CORRECTION-28 fixtures | **12/12 unchanged** |
| CORRECTION-29 fixtures | **12/12 unchanged** |
| CORRECTION-30 fixtures | **15/15 unchanged** |
| CORRECTION-31 fixtures | **22/22 unchanged** |
| CORRECTION-32 fixtures P1–P21 | **21/21, 0 vacuous, in BOTH arms** |
| crowding field/scan parity | CORRECTION-28 `P8 FIELD_SCAN_PARITY`, unchanged |

**Two timeline instruments diverge, and the reason is behavioural, not a lifecycle regression.**
CORRECTION-31's `lifecycle-timelines` differ in 2 of 6 timelines: the bands drift to different
distances (`physicalDistance 40 → 38–39`) and a **report arrives that did not arrive before**,
reactivating a cooling phase through exactly the mechanism CORRECTION-31 built
(`socialEvidencePhase released_historical → cooling`, `provenance: reported_secondhand`). AUDIT-27's
release timeline differs because it selects a **different episode** (`overlapSeason 6 → 16`,
`overlapTile tile:198:89 → tile:194:90`). Both are consequences of a changed world; both
checkpoints' **fixture verdicts** are unchanged.

**NOT RUN, deliberately:** no 200-year or 500-year matrix, no performance re-measurement, no
fresh-process determinism run, no `simBenchmark` fingerprint comparison, no decision-by-decision
trace of the map2 divergences. **INHERITED FAILURE, not rerun and not claimed fixed:**
`expeditionLifecycleAudit` (recorded FAILING identically at CORRECTION-26's base and tip).

## 11. What the supervising human must decide next

Roadmap item 3 is still open. The AUDIT-27 seams that remain, none of them started here:

1. **The physical shared-use substrate.** `sharedCatchment`'s footprint is residence-anchored, so
   real trips, expedition routes and investigation walks compete for nothing.
2. **`territorialPressure`** — a spawn constant with three live readers and no writer.
3. **Activity-party crowding / expedition overlap / temporary task-party footprints.**
4. **The anti-omniscience defect in `getSocialAccessRisk`'s `unrelatedRisk`** (§9.5).
5. **`rangeSaturation.perCapitaReturnEstimate`'s crowding content** (§9.4), if the ecology
   authority is ever reopened.
6. Whether `0.96` is the right magnitude for the single crowding cost — this pass fixed the
   *authority*, and deliberately did not tune the *strength*.

Two absences carried forward from CORRECTION-29 and -30 and again not filled: production has **no
visibility, route or barrier rule** for social perception, and **no physical-trace authority of any
kind**. Both belong to the Persistent Human Landscape pass. Inventing either to make crowding feel
richer remains forbidden.
