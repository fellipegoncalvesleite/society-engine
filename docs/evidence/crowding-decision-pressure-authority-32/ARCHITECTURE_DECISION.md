# CORRECTION-32 — ARCHITECTURE DECISION

**Selected: Option D, implemented on an Option-B authority.**
One physical fact (`weightedCrowding`), one capacity transform (`getCrowdingPenalty`), one
decision-facing cost per candidate tile, and a current-site dispersal motive that is expressed
**once** and only on candidates that are not the residence.

Written after §8's inspection and after the BEFORE arm of the §13 attribution matrix was measured,
so the option comparison rests on numbers rather than on reading coefficients.

---

## 1. Why crowding arises, and how a band experiences it

From `RESEARCH_AND_CAUSAL_MODEL.md`: another band nearby matters because it takes from the same
patches, because the ground has finite room and that room is habitat-specific, because it disturbs
local use, and — conditionally, and only with evidence — because it may be dangerous or may be a
partner worth being near. The band does not experience five separate crowding problems. It
experiences **one place that is harder to use because other people are on it**, plus, separately,
whatever its return actually is and whatever it actually knows about those people.

## 2. What the code does today (measured, not asserted)

`docs/evidence/.../counterfactual-matrix-before.json`, 12 bands, 113 candidates, 10 bands with
non-zero crowding, natural cases included:

| Path | Absolute score influence (Σ\|Δ\|) | Share |
| --- | ---: | ---: |
| direct `crowdingPenalty` term | 3.02 | 47.3% |
| direct `nearbyBandPressure` term | 2.02 | 31.7% |
| daughter/frontier derivative (`safeFrontierPull`, `parentCoreOverlap`, `daughterDispersalExploreBoost`) | 0.95 | 14.9% |
| crowding inside `pressureState` (`mobility` / `netMove` / `placeAttachmentPull`) | 0.23 | 3.6% |
| `rangeSaturation` crowding component | 0.15 | 2.4% |
| `crowdingExploreBoost` | 0.02 | 0.3% |

**49 of 113 candidates carried three or more separately-named crowding charges.** The zero controls
(`F2`, `F6`) read exactly `0` on every path, on stay **and** on exploration.

Three concrete readings:

- **`F4` (three neighbours, rich ground), stay candidate.** `weightedCrowding 0.44` →
  `nearbyBandPressure −0.10`, `crowdingPenalty −0.12`, `rangeSaturation −0.05`, `pressureState
  −0.01` = **−0.28 named + −0.14 nested = −0.42 total**, from one physical condition.
- **`F5` (crowded, at the edge of known country), exploration candidate.** Six non-zero paths with
  **opposite signs** — `+0.03 / +0.04 / −0.02 / +0.01 / −0.02 / +0.01` — netting **−0.01**. The
  same fact enters six times and explains nothing. This is §12.14 failing outright.
- **`F1` vs `F3` (identical pair, rich vs dry ground).** `weightedCrowding 0.15 → penalty 0.06`
  (k = 0.40) against `0.21 → 0.14` (k = 0.67). The capacity transform exists and works — and then
  the raw `nearbyBandPressure * 0.24` term charges the **untransformed** value alongside it,
  diluting exactly the terrain conditioning §12.9 requires.

Two further defects located by the same inspection:

- **The exploration candidate is charged the residence's crowding.** `buildExploreCandidate` reads
  `decisionCache.pressureSnapshot.nearbyBandPressure` — the **current tile** — and writes it into
  `nearbyBandPressure` and `crowdingPenalty`, which score negatively. The destination is *unknown*,
  so its crowding is unknowable; what is being charged is the residence's. §10.7 and §12.4.
- **Physical proximity manufactures social danger.** `dryMargin.getSocialAccessRisk` builds
  `localCrowding = clamp01(nearbyBandCount / 5 + salientUsers / 4)` and feeds it into
  `socialAccessRisk`, scored `−0.36` and used to rank water refuges (`×1.8`). Neither term is social
  evidence: the first is bodies, the second is *other bands' remembered places* with no distance
  gate. §12.6 and §10.4.

## 3. The options, and why each was accepted or rejected

### Option A — one canonical crowding decision cost, everywhere — **REJECTED**

Collapsing everything into a single scalar loses a distinction the measurement shows is real: on a
**move** candidate the crowding read is the **target's** (`tileMemo` at the candidate tile), while on
the **stay** candidate it is the residence's. Those are different objects with different meanings.
A single global scalar would either apply the residence's crowding to every destination (the
exploration bug, generalised) or lose target-specificity entirely, breaking §12.4.

### Option B — `crowdingPenalty` as the canonical decision-facing authority — **ADOPTED IN PART**

Correct and adopted for the *quantity*: `weightedCrowding` is evidence, kin input and the input to
the transform; the terrain-adjusted `crowdingPenalty` is the only thing that charges a score. But
Option B alone does not answer the residence-versus-target question, and §11 asks explicitly whether
"pressure-state derivations then still charge it repeatedly" — measured, they do (`riskPressure`,
`placeAttachmentPull`). So B is necessary and not sufficient.

### Option C — pressure-state-only integration — **REJECTED**

`BandPressureState` is derived **at `band.position` only**. Routing all crowding through it would
make a crowded destination indistinguishable from an empty one, destroying §12.4 outright, and would
push crowding into `riskPressure` — which `demography.ts:401/1780` and `viability.ts:248` read — so a
peaceful neighbour would raise mortality-adjacent risk. That is §12.6 by the back door.

### Option D — separate current-site and target-site authorities — **SELECTED**

This is the design the causal model in §6 of `RESEARCH_AND_CAUSAL_MODEL.md` produces, and the only
one that survives all of §12:

```text
TARGET-SITE COST      crowdingPenalty(candidate tile) × 0.96, once per candidate
                      unknown destination ⇒ 0 (the band cannot know)

CURRENT-SITE MOTIVE   crowdingPenalty(residence) → mobilityPressure → netMovePressure
                      scored +0.72 on non-stay candidates ONLY (netMovePressure is 0 for stay),
                      so it lifts alternatives instead of penalising the residence twice

EXPLORATION RESPONSE  crowdingExploreBoost = crowdingPenalty(residence) × 0.18, counted once
```

The stay candidate needs no separate "push": for `stay`, target == residence, so the one target cost
already lowers staying relative to every alternative. That is the dispersal motive, expressed once.

### Option E — several paths with proven orthogonal semantics — **REJECTED ON EVIDENCE**

E is admissible only if each path has distinct inputs and distinct meaning. Measured, they do not:
`nearbyBandPressure` and `crowdingPenalty` are the same scalar with and without one multiplication;
`rangeSaturation`'s crowding component is `nearby.weightedCrowding * 0.34` of the same number; and
`safeFrontierPull`'s `− weightedCrowding * 0.22` is that number again on the same candidate. E fails
its own admission test.

### Option F — another design — **CONSIDERED AND REJECTED**

A new `PhysicalCrowdingCost` type with `currentSite` / `targetSite` members was considered and
rejected as a **fifth home for a fact three authorities already hold**, and as a store where
CORRECTION-31 showed a derived read is enough. The repair below adds **one derived field** and **no
new module, type, store or constant file.**

---

## 4. What changes, exactly

Six production files. Every item removes a **second charge of the same fact on the same candidate**;
nothing is zeroed and nothing new is invented.

| # | File | Change | Why |
| --- | --- | --- | --- |
| 1 | `rules/decisionScoring.ts` | drop the `nearbyBandPressure × 0.24` term; `crowdingPenalty × 0.72` → `× 0.96` | one authority. **0.96 = 0.24 + 0.72**, so a fully capacity-constrained tile (k=1) charges exactly what it charged before; only the spacious-terrain over-charge is removed. `nearbyBandPressure` stays on `ScoreBreakdown` as evidence for UI/explanation. |
| 2 | `rules/bandDecision.ts` — explore candidate | `crowdingPenalty: 0`; `crowdingExploreBoost` sourced from the **residence's** `crowdingPenalty`; drop `− crowdingPenalty × 0.04` inside `explorationValue` | an unknown destination has unknowable crowding (§12.4, anti-omniscience); the residence's crowding reaches exploration through exactly one bounded boost (§12.5) |
| 3 | `rules/bandDecision.ts` — known-tile candidate | `expectedFutureValue`: `− crowdingPenalty×0.14 − weightedCrowding×0.08` → `− crowdingPenalty×0.22`; move-side `perCapitaReturn`: drop `− crowdingPenalty×0.24` | two charges → one, magnitude preserved; and a body count must not be converted into an inferred per-capita return loss when the ecology already measures it (§10.3) |
| 4 | `rules/bandDecision.ts` — `getBadSiteStuckResidencePenalty` | `nearbyBandPressure×0.16 + crowdingPenalty×0.14` → `crowdingPenalty×0.30` | same fact twice → once, magnitude preserved |
| 5 | `rules/bandDecision.ts` — reason hydration | stop emitting `nearby_band_crowding`; `crowding_reduced_local_suitability` carries the evidence **and** the cost | §12.14 / §20 — the explanation must name the charge that actually exists. The reason *type* is retained in `rules/types.ts` as vocabulary. |
| 6 | `agents/socialContext.ts` + `agents/types.ts` | new derived `RangeSaturationState.saturationPressureExcludingCrowding`; the decision scorer reads **that** | §12.12 — the overlap is explicitly partitioned. `saturationPressure` itself is **unchanged** for `carryingCapacity`, `innerFission`, `reportedKnowledge`, `frontierDispersal` and the UI. |
| 7 | `agents/pressure.ts` | `riskPressure`: drop `crowdingPenalty × 0.08` | §12.6 — peaceful neighbours must not raise a danger signal that `demography.ts` and `viability.ts` read |
| 8 | `agents/pressure.ts` | `placeAttachmentPull`: drop `crowdingPenalty × 0.22` | it is charged on the **stay** candidate where the target cost already applies. `mobilityPressure += crowdingPenalty × 0.20` is **KEPT** — that is the single current-site dispersal motive. |
| 9 | `agents/crowding.ts` | `getSafeFrontierPull`: drop `− nearby.weightedCrowding × 0.22` | the same tile's crowding is already charged on the same candidate; `safeFrontierPull` scores `+0.62`, so this was a fourth charge. **No fission rule, kin factor or dispersal formula is redesigned** (§6, §12.13). |
| 10 | `agents/dryMargin.ts` | `getSocialAccessRisk`: `localCrowding` (nearby band count + other bands' remembered places) → the band's **own** `protoAccessMemory.places[tileId]` (`strangerCaution`, `rememberedRefusalAvoidance`) | §12.6 — social danger requires social evidence. The replacement authority is the one CORRECTION-30 gave truthful provenance and CORRECTION-31 gave a lifecycle that releases. Coefficient `0.26` and the base/relief structure are **unchanged**. |

### What deliberately does not change

- `crowding.ts`'s field, scan, radius, population weight, kin factor `0.72×` and the
  `getCrowdingPenalty` transform itself. Physical crowding stays exactly as CORRECTION-28 left it.
- `sharedCatchment`, `depletion`, `plantStock`, `faunaStock`, `carryingCapacity` — actual resource
  pressure keeps its own authority (§12.8).
- Encounters, `rangeFriction`, `protoAccessMemory` — social evidence keeps its own authority and its
  CORRECTION-29/30/31 provenance and lifecycle rules (§12.6).
- Kin: `parentOverlap`, `daughterOverlap`, `kinTolerance`, `kinSafety`, `getDaughterDispersalPressure`'s
  structure (§12.7, §12.13).
- `StepMode`, the four internal step modes, and every UI control (§7).
- `territorialPressure` — still a spawn constant with three readers and no writer, and still out of
  scope.

## 5. Which effect owns the decision influence, after the repair

```text
one nearby physical band
  └─ weightedCrowding                      EVIDENCE (UI, kin, explanation, transform input)
       └─ crowdingPenalty = wc × dryAmp × (1 − buffer×0.48)   ONE capacity transform
            ├─ candidate tile is a KNOWN PLACE  → −0.96 × crowdingPenalty(that tile)   [target cost]
            ├─ candidate tile is UNKNOWN        → 0                                    [unknowable]
            ├─ residence                        → mobilityPressure ×0.20 → netMovePressure
            │                                      → +0.72 on NON-STAY candidates      [dispersal motive]
            └─ residence                        → crowdingExploreBoost ×0.18
                                                   → +0.48 on the exploration candidate [response, once]
```

Everything else that used to carry crowding — `riskPressure`, `placeAttachmentPull`,
`safeFrontierPull`, `socialAccessRisk`, `rangeSaturation` at the decision seam, the move-side
`perCapitaReturn`, `expectedFutureValue`'s second term, `badSiteStuckResidencePenalty`'s second term
— no longer does.

## 6. Calibration honesty

`0.96`, `0.22`, `0.30` and `0.18` are **[CALIBRATION]**. Each is chosen by one stated rule — *the
consolidated weight is the sum of the weights it replaces, applied to the canonical
capacity-conditioned quantity* — so the maximally constrained tile (`dryAmplifier = 1`,
`spatialCapacityBuffer = 0`) charges exactly what it charged before the repair, and only the
over-charge on spacious well-watered ground is removed. No research result was converted into any of
them, and no weight was tuned toward a population, survival or event-frequency target.
