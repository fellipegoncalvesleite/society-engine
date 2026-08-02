# CORRECTION-32 — CAUSAL INFLUENCE GRAPH

One nearby physical band → every intermediate transformation → the final candidate score →
the selected action → the movement outcome. Every number below is **measured**, not read off a
coefficient: see `influence-attribution.json`, `counterfactual-matrix{,-before}.json`.

**The instrument.** `getNearbyBandPressure` reads `cache.nearbyBandPressureByBandTileKey` first
and returns the memo when present. The audit swaps that `Map` for a `Map`-like that answers
"nobody nearby" for every key, so **real production code** — `deriveBandPressureState`,
`getCrowdingPenalty`, `applyRangeSaturationContext` (range saturation *and* carrying capacity),
`getDaughterDispersalPressure`, and the whole candidate scorer — re-derives with the physical
crowding input at zero. No formula is re-implemented. `TOTAL = score(full) − score(zeroed)`.
`DIRECT` per path substitutes one field group in the real `ScoreBreakdown` and re-runs the
exported pure `scoreDecision` (exact, because `scoreDecision` is linear).
`RESIDUAL = TOTAL − Σ DIRECT` — crowding reaching the score through nested composites.

---

## 1. BEFORE — worked example, fixture `F4` (three neighbours, river valley, droughtRisk 0)

```text
3 nearby bands, each 30 people, at Manhattan distance 1-2
   │
   └─ weightedCrowding = 0.44
        │
        ├── DIRECT PATH 1 ────────────────────────────────────────────
        │   scoreBreakdown.nearbyBandPressure = 0.44   × (−0.24)
        │   measured on STAY: −0.10      measured on BEST MOVE: −0.08
        │
        ├── CAPACITY TRANSFORM
        │   crowdingPenalty = 0.44 × dryAmplifier(0.72) × (1 − buffer×0.48)
        │                   = 0.17        (transform ratio k = 0.386)
        │   │
        │   ├── DIRECT PATH 2 ────────────────────────────────────────
        │   │   scoreBreakdown.crowdingPenalty = 0.17  × (−0.72)
        │   │   measured on STAY: −0.12   measured on BEST MOVE: −0.09
        │   │
        │   ├── PRESSURE PATH ────────────────────────────────────────
        │   │   riskPressure       += 0.17 × 0.08   → 0.67 (vs 0.66 without)
        │   │   placeAttachmentPull −= 0.17 × 0.22  → 0.08 (vs 0.12 without)
        │   │   mobilityPressure   += 0.17 × 0.20   → 0.40 (vs 0.35 without)
        │   │   netMovePressure     = mobility + … − attachment×0.48
        │   │                       → 0.54 (vs 0.45 without)
        │   │   scored: mobilityPressure ×(−0.05), netMovePressure ×(+0.72),
        │   │           placeAttachmentPull ×(+0.40)
        │   │   measured on STAY: −0.01   measured on BEST MOVE: −0.04
        │   │
        │   └── SATURATION PATH ──────────────────────────────────────
        │       saturationPressure = … + 0.44×0.34 + populationPressure×0.28 + …
        │                          → 0.39 (vs 0.24 without)
        │       scored ×(−0.34) on STAY
        │       measured on STAY: −0.05
        │
        ├── DAUGHTER / FRONTIER PATH ─────────────────────────────────
        │   safeFrontierPull  −= 0.44 × 0.22        scored ×(+0.62)
        │   daughterDispersalPressure += 0.44 × 0.30 → 0.19 (vs 0.11 without)
        │        → daughterDispersalExploreBoost ×(+0.70)
        │   measured on BEST MOVE: −0.04
        │
        └── EXPLORATION PATH ─────────────────────────────────────────
            crowdingExploreBoost = clamp01(0.44 × 0.18)   ×(+0.48)
            saturationExploreBoost from the crowding-carrying saturation ×(+0.58)
            explorationValue also subtracts crowdingPenalty × 0.04
            (no exploration candidate exists in F4; see fixture F5 below)

EFFECTIVE MARGINAL CONTRIBUTION OF THE ORIGINAL SOURCE
   STAY       −0.28 through 4 named paths  +  −0.14 nested  =  −0.42 total
   BEST MOVE  −0.27 through 4 named paths  +  +0.03 nested  =  −0.24 total
```

## 2. BEFORE — the explainability failure, fixture `F5` (crowded, at the edge of known country)

The exploration candidate reads the **residence's** crowding — the destination is unknown — and
charges it six ways with contradictory signs:

```text
weightedCrowding = 0.15,  crowdingPenalty = 0.06

  nearbyBandPressure  (residence) → −0.24 →  measured  +0.03 when removed
  crowdingPenalty     (residence) → −0.72 →  measured  +0.04 when removed
  pressureState                            →  measured  −0.02 when removed
  rangeSaturation                          →  measured  +0.01 when removed
  crowdingExploreBoost 0.15 × 0.18 → +0.48 →  measured  −0.02 when removed
  daughter derivative                      →  measured  +0.01 when removed
                                              ─────────────────────────────
                                    NET TOTAL EFFECT ON THE SCORE:  −0.01
```

**Six separately-named charges whose net is −0.01.** No decision explanation can be given: the
same physical fact simultaneously discourages and encourages the same option. This is §12.14
failing, measured rather than argued.

---

## 3. AFTER — the same worked examples

```text
F4, 3 nearby bands, weightedCrowding 0.44
   └─ weightedCrowding = 0.44                     EVIDENCE (UI, kin, explanation)
        └─ crowdingPenalty = 0.17                 ONE capacity transform
             └─ scoreBreakdown.crowdingPenalty × (−0.96)
                   STAY      −0.16 through 1 named path + −0.07 nested = −0.23 total
                   BEST MOVE −0.13 through 1 named path +  0.01 nested = −0.12 total

   riskPressure           0.66 with crowding == 0.66 without   (path severed)
   placeAttachmentPull    0.12 with crowding == 0.12 without   (path severed)
   decision saturation    0.24 with crowding == 0.24 without   (partitioned)
   safeFrontierPull       no longer crowding-derived           (path severed)

F5 exploration candidate, weightedCrowding 0.15
   crowdingPenalty on the candidate      = 0        (unknown destination)
   nearbyBandPressure on the candidate   = 0.15     (evidence, no weight)
   crowdingExploreBoost                  = 0.06 × 0.18 = 0.0108   × (+0.48)
   pressureState (netMovePressure)       → −0.01 when removed, i.e. crowding RAISES
                                            the exploration score, once, with one sign
                                              ─────────────────────────────
                                    ONE path.  NET TOTAL EFFECT:  −0.04
```

---

## 4. Aggregate attribution — every candidate of every measured band

12 bands (4 synthetic geometries, 2 solo controls, 6 naturally crowded band-seasons drawn from
map1 and map2 by scanning 80 seasons), 111–113 candidates.

| Path | BEFORE Σ\|Δscore\| | AFTER Σ\|Δscore\| |
| --- | ---: | ---: |
| direct `crowdingPenalty` | 3.02 | **3.92** |
| direct `nearbyBandPressure` | 2.02 | **0** |
| daughter / frontier derivative | 0.95 | **0** |
| crowding inside `pressureState` | 0.23 | 0.11 |
| `rangeSaturation` crowding component | 0.15 | **0** |
| `crowdingExploreBoost` | 0.02 | 0 † |
| **candidates with ≥3 named crowding charges** | **49 of 113** | **0 of 111** |

† `crowdingExploreBoost` is still live (F5 after: 0.0108 at weight +0.48); its contribution now
falls below `scoreDecision`'s own `round2`, so the detector reads 0. **The boost was not removed.**

## 5. Natural occurrence — same maps, seeds and durations as AUDIT-27 → CORRECTION-31

2,400 living band-seasons at 20 years; 6,000 at 50 years.

| | 20 y before | 20 y after | 50 y before | 50 y after |
| --- | ---: | ---: | ---: | ---: |
| candidates with ≥3 crowding paths | **56** | **0** | **144** | **0** |
| max paths on any candidate | 4 | **2** | 4 | **2** |
| direct `nearbyBandPressure` contribution | 0.97 | **0** | 3.23 | **0** |
| direct `crowdingPenalty` contribution | 2.33 | 3.09 | 5.14 | 9.30 |
| indirect `pressureState` contribution | 0.20 | 0.18 | 0.46 | 0.76 |
| `rangeSaturation` overlap contribution | 0.09 | **0** | 0.23 | **0** |
| daughter-derived contribution | 0.54 | **0** | 1.67 | **0** |
| combined effective contribution | 4.92 | 3.78 | 37.80 | 22.85 |
| band-seasons where crowding raised `riskPressure` | **3** | **0** | **7** | **0** |
| band-seasons where crowding reduced `placeAttachmentPull` | **11** | **0** | **22** | **0** |

The physical layer is **identical at 20 years on all six of its keys** — 2,400 living
band-seasons, 20 crowded band-seasons, `weightedCrowding` sum 0.74 / max 0.07, `crowdingPenalty`
sum 0.52 / max 0.06 — so the change is entirely in how one unchanged fact is charged. At 50 years
the two worlds have diverged behaviourally (44 vs 46 crowded band-seasons), so those totals are
**not** like-for-like and are reported as such.

## 6. The final links: score → selected action → movement outcome

`scoreDecision` → `sortCandidatesWithSeededTieBreak` → `applyResidentialRelocationClearance` →
`Decision.action` → `applyBandDecision` → `band.position`.

- **`crowdedSeasonsWhereCrowdingFlippedSelection` = 0 in BOTH arms**, at 20 and at 50 years.
  Crowding is a small ranking contributor in these worlds and never decides an action by itself —
  consistent with AUDIT-27's `crowdingReasonInstances = 0` across 1,547 moves. **No improvement in
  outcomes is claimed.**
- Movement nevertheless changes, because the *whole* score moves: residential moves
  448 → 450 and 395 → 401 (map2 s1/s2), 53 → 57 (ordinary s1), and `map1` is unchanged at
  265 / 224. First physical divergence tick 17 (map2 s1) and 23 (map2 s2); `map1:s2` is
  **byte-identical across all 80 seasons**, and `map1:s1` diverges only in derived pressure
  values with **no physical divergence at all**.
