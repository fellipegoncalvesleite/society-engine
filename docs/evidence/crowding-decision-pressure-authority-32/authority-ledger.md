# CORRECTION-32 — AUTHORITY LEDGER

Every writer and reader of the fields §8 names, read from production at
`3e2c1215b4ccef2beb799b3a7882247f6cd186cd` (BEFORE) and at the CORRECTION-32 tip (AFTER).
"Direct score weight" means a term in `rules/decisionScoring.ts scoreDecision`.

Legend for **Contains physical crowding?**: **Yes** = derived from
`NearbyBandPressure.weightedCrowding`. **Yes (partial)** = one term among several.
**No** = independent authority.

---

## 1. The source

| Field | Canonical source | Transformation | Causal meaning | Physical crowding | Social evidence | Direct score weight | Indirect score paths | Behavioural readers | Duplicated by |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `NearbyBandPressure.weightedCrowding` | `agents/crowding.ts` `buildPressureResult` — proximity ball radius 4, `(distanceWeight*0.58 + samePatchWeight*0.34) * populationWeight`, kin `×0.72`, `/2.2`, `× aridityAmplifier`, clamp01, round2 | none (it IS the evidence) | other people physically occupy nearby space, now | **Yes — it is the fact** | No | **−0.24 → REMOVED** (evidence only) | via `crowdingPenalty`, `daughterDispersalPressure`, `rangeSaturation.nearbyCrowding` | `pressure.ts`, `bandDecision.ts`, `socialContext.ts`, `crowding.ts`, `render/canvasRenderer.ts`, `ui/band/sections.tsx` | was duplicated **by `crowdingPenalty`** — resolved |
| `NearbyBandPressure.nearbyBandCount` | same | count of contributors > 0.02 | how many groups | Yes | No | none | drives `confidence` only | UI, `crowding.ts` | — |
| `NearbyBandPressure.pressureBandIds` → `crowdingBandIds` | same, capped at 32 | identity list | which groups | Yes | No | none | `reportedKnowledge.ts:982` gates a report on a non-empty list | `pressure.ts:399`, `reportedKnowledge.ts` | — |
| `parentOverlap` / `daughterOverlap` | same, `/1.4` | kin share of the contribution | kin proximity | Yes | No | none | `kinCoreCrowding` → `daughterDispersalPressure` | `crowding.ts` | — |

## 2. The capacity transform — the single decision-facing authority

| Field | Canonical source | Transformation | Causal meaning | Physical crowding | Social evidence | Direct score weight | Indirect score paths | Behavioural readers | Duplicated by |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `crowdingPenalty` (candidate) | `crowding.ts getCrowdingPenalty(tile, nearby)` | `weightedCrowding × dryAmplifier × (1 − spatialCapacityBuffer × 0.48)` | how badly THIS ground absorbs the co-presence | **Yes** | No | **−0.72 → −0.96** (`CROWDING_DECISION_COST_WEIGHT`) | `expectedFutureValue`, `badSiteStuckResidencePenalty`, `explorationValue`, move-side `perCapitaReturn` — **all consolidated to one term each** | `bandDecision.ts` (candidate memo, per candidate tile), `pressure.ts` (residence only) | was duplicated **by `nearbyBandPressure`** — resolved |
| `pressureState.crowdingPenalty` | `pressure.ts:133` at `band.position` | same transform | the residence's crowding | Yes | No | none directly | `mobilityPressure ×0.20` → `netMovePressure` | `demography.ts:1525/1632`, `foragingAdaptation.ts`, `residentialMoveEvent.ts`, `campMovement.ts`, UI | — |

## 3. Pressure-state derivations

| Field | Writer | Crowding term BEFORE | Crowding term AFTER | Direct score weight | Why |
| --- | --- | --- | --- | --- | --- |
| `riskPressure` | `pressure.ts:232` | `+ crowdingPenalty × 0.08` | **removed** | none (feeds mobility/netMove and `rangeSaturation.seasonalStress`) | `demography.ts:401/1780` and `viability.ts:248` read it — proximity was raising a mortality-adjacent danger signal with no social evidence (§12.6) |
| `placeAttachmentPull` | `pressure.ts:264` | `− crowdingPenalty × 0.22` | **removed** | **+0.40** (stay) | charged on the stay candidate, where the target cost already applies; also propagated through `netMovePressure −= 0.48 × attachment` |
| `mobilityPressure` | `pressure.ts:270` | `+ crowdingPenalty × 0.20` | **KEPT** | −0.05 (all candidates) | the single current-site dispersal motive |
| `netMovePressure` | `pressure.ts:310` | `mobilityPressure + …` | unchanged formula; its crowding content is now only the `mobilityPressure` term | **+0.72**, and **0 on stay** | so a crowded residence lifts the alternatives rather than being charged twice |

## 4. Range saturation

| Field | Writer | Contains crowding | Direct score weight | Readers |
| --- | --- | --- | --- | --- |
| `rangeSaturation.saturationPressure` | `socialContext.ts deriveRangeSaturationState` — `localUsePressure×0.32 + weightedCrowding×0.34 + populationPressure×0.28 + seasonalStress − carryingBuffer×0.18` | **Yes, twice**: `weightedCrowding×0.34` explicitly, and `populationPressure` (a distance-weighted sum over **all** bands in radius, self included) | was **−0.34** on stay | `carryingCapacity.ts`, `innerFission.ts`, `reportedKnowledge.ts:2390`, `frontierDispersal`, `socialContext.ts:829/1087`, UI — **all unchanged** |
| `rangeSaturation.saturationPressureExcludingCrowding` **(new, derived)** | same function | **No** — the crowding term is dropped and `populationPressure` is replaced by the band's OWN population density | **−0.34** on stay, and the input to `saturationExploreBoost` | `bandDecision.ts` decision seam only |
| `rangeSaturation.nearbyCrowding` | same | Yes (a copy of `weightedCrowding`) | none | `carryingCapacity.ts:203/522/616`, UI | — |
| `perCapitaReturnEstimate` | same | Yes (via `effectiveHabitatSuitability`, `− saturationPressure×0.36 − weightedCrowding×0.12`) | **+0.24** on the **stay** candidate | ecology authority — **left in place, documented as a retained ecological path** |

## 5. Exploration response

| Field | Writer | Source BEFORE | Source AFTER | Direct score weight |
| --- | --- | --- | --- | --- |
| `crowdingExploreBoost` | `bandDecision.ts:2034` | `clamp01(weightedCrowding × 0.18)` — the RAW residence value | `clamp01(residenceCrowdingPenalty × 0.18)` — the canonical quantity | **+0.48**, and inside `explorationValue` (×1.25) |
| `saturationExploreBoost` | `bandDecision.ts:2039` | `clamp01(saturationPressure × 0.22 + sustainedOverCapacity × 0.3)` — carried crowding | same formula on `saturationPressureExcludingCrowding` | **+0.58**, and inside `explorationValue` |
| `daughterDispersalExploreBoost` | `bandDecision.ts:2043` | `clamp01(daughterDispersalPressure × 0.28)` | unchanged | **+0.70**, and inside `explorationValue` — **the one deliberately retained crowding path**, see §8 |
| explore candidate `crowdingPenalty` | `bandDecision.ts` | the **residence's** penalty, charged as a cost | **0** — an unknown destination has unknowable crowding | −0.96 |
| explore candidate `nearbyBandPressure` | `bandDecision.ts` | residence value, charged at −0.24 | residence value, **evidence only** | none |

## 6. Daughter / frontier derivations

| Field | Writer | Contains crowding | Direct score weight | Change |
| --- | --- | --- | --- | --- |
| `daughterDispersalPressure` | `crowding.ts getDaughterDispersalPressure` — `weightedCrowding × 0.36` (daughter) or `× 0.30` (gated founder) | **Yes** | none directly | **unchanged** — kin/fission machinery, out of scope (§6, §12.13) |
| `safeFrontierPull` | `crowding.ts getSafeFrontierPull` | was `− weightedCrowding × 0.22` | **+0.62** | crowding term **removed** — the same tile's crowding is already charged on the same candidate |
| `parentCoreOverlap` | `crowding.ts getParentCoreOverlap` | No (distance + parent's salient memory) | **−0.16** | unchanged (CORRECTION-28 recorded and retained its memory path) |
| `kinTolerance` / `kinSafety` / `inheritedFamiliarityPull` | `crowding.ts` | No | `+0.18` (inherited pull) | unchanged |

## 7. Social risk

| Field | Writer | Source BEFORE | Source AFTER | Direct score weight |
| --- | --- | --- | --- | --- |
| `socialAccessRisk` | `dryMargin.ts getSocialAccessRisk` | `0.28 + localCrowding×0.26 + unrelatedRisk − knownContactRelief`, where `localCrowding = clamp01(nearbyBandCount/5 + salientUsers/4)` — **bodies, plus other bands' remembered places with no distance gate** | `0.28 + rememberedAccessCaution×0.26 + unrelatedRisk − knownContactRelief`, where the caution comes from the band's own `protoAccessMemory.places[tileId]` | **−0.36**, plus `expectedFutureValue −0.08` and `getFallbackRank ×1.8` |
| `encounterTension` / `encounterTolerance` / `splitRisk` | `socialContext.ts` encounters | No — CORRECTION-29 requires distance ≤ 3 | −0.46 / +0.14 / −0.36 | unchanged |

## 8. Fields deliberately left carrying crowding, and why

1. **`daughterDispersalPressure` → `daughterDispersalExploreBoost` (+0.70) and `explorationValue`.**
   `getDaughterDispersalPressure` legitimately consumes `weightedCrowding` (a crowded core is a
   real reason for a daughter to disperse). §6 forbids redesigning fission and §12.13 permits the
   path provided it is explained. It is therefore **retained, documented and measured**: over 20
   natural years its score contribution is **0** (`daughterExploreBoostCrowdingDerived = 0`,
   `daughterDerivedCrowdingContribution` 0.54 → 0 after the `safeFrontierPull` removal), because
   `fissions = 0` naturally and AUDIT-27 measured `kinOverlapPairs = 0`. Fixture P11 exercises it
   with a synthetic lineage link and shows the kin discount holding.
2. **`rangeSaturation.perCapitaReturnEstimate` (+0.24 on stay).** Crowding reaches it through
   `effectiveHabitatSuitability`. This is the ecology authority's own estimate, not a decision-layer
   inference, and rewriting it would mean touching `carryingCapacity` — outside this checkpoint.
   The **move**-side inference (`− crowdingPenalty × 0.24`) *was* a decision-layer inference from
   bodies and **is removed**.
3. **`rangeSaturation.saturationPressure`** keeps its crowding term for every ecological and social
   reader; only the decision seam reads the partitioned value.

## 9. Newly found defect NOT repaired here

`dryMargin.getSocialAccessRisk`'s `unrelatedRisk` reads `Object.values(world.bands).length > 8` —
a **world-truth band count** a band cannot know (§3.4 anti-omniscience). Found during this
checkpoint's mandated inspection of `socialAccessRisk`, left in place because it is not a crowding
defect, and recorded here and in `FINDINGS.md` so it is not lost.

## 10. Files changed

```text
src/sim/agents/crowding.ts        +10  -4
src/sim/agents/dryMargin.ts       +25  -7
src/sim/agents/pressure.ts        +19  -3
src/sim/agents/socialContext.ts   +20  -0
src/sim/agents/types.ts           +10  -0
src/sim/rules/bandDecision.ts     +41 -28
src/sim/rules/decisionScoring.ts  +17  -2
                                 ---- ----
                                 +142 -44
```

No new module, no new store, no new constant file, no new import edge.
