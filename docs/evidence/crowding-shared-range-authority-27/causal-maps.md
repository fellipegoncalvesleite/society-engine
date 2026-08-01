# AUDIT-27 — CAUSAL MAPS

Three separate maps, as §13 of the audit prompt requires. Edges are marked:

- `[OK]` — present and honest
- `[DUP]` — present, but a repeated representation of an event already carried by another edge
- `[LEAK]` — present, but carries evidence the band should not have
- `[MISSING]` — the edge does not exist in production
- `[DISC]` — the edge exists but terminates in nothing behavioral

---

## 1. Physical competition

```
                     band position + demography
                              │
              ┌───────────────┴────────────────┐
              │                                │
   [OK] residentialAnchor.catchmentTileIds     │  [MISSING] recentIntraSeasonTrips.targetTileId
        or radius-2 ring over own known tiles  │  [MISSING] expedition route tiles
              │                                │  [MISSING] PendingInvestigation walk tiles
              ▼                                ▼
   getBandForagingFootprint            (nothing consumes these
   sharedCatchment.ts:47-85             in any crowding authority)
              │
              ▼
   [OK] SharedCatchmentIndex.claimsByTileId
        (claim weight = foraging draw × distance decay)
              │
              ▼
   [OK] getTileSupportShare  ── measured 1.0 → 0.6923 with one neighbour
              │
              ▼
   [OK] carryingCapacity: sharedReachableSupport
        measured 160.63 → 109.84  (−31.6%)
              │
              ├──────────────────────────────────────────────┐
              ▼                                              ▼
   [OK] clampedSupportRatio → perCapitaReturn      [OK] advanceTileDepletion (phase 4)
              │                                    world.tileDepletion, fauna, plant, forest
              │                                              │
              │                                    measured recovery after release:
              │                                    0.0408 → 0 over 8 seasons
              │                                              │
              ▼                                              ▼
   [OK] humanFoodSupport ledger ← physical receipts ← realized harvest
              │
              ▼
   [OK] nutrition → demography
              │
              ▼
   [OK] pressureState.foodStress → mobilityPressure → behavior
```

**Separately, and NOT through the above:**

```
   band positions (hidden)                salient placeMemory (hidden, other bands')
              │                                       │
              └──────────────┬────────────────────────┘
                             ▼
              [DUP] buildCrowdingField.basePreclamp
                    = distanceWeight*0.58 + samePatchWeight*0.34 + memoryOverlap*0.24
                             │
                             ▼
                    NearbyBandPressure.weightedCrowding
                             │
        ┌────────────┬───────┴────────┬─────────────┬──────────────┐
        ▼            ▼                ▼             ▼              ▼
 [DUP] score   [DUP] getCrowding  [DUP] range   [DUP] daughter  [LEAK] pressureBandIds
 −0.24         Penalty → −0.72    Saturation    Dispersal       (real BandIds on
                     │            → −0.34       → explore        canonical band state;
                     ▼                          boosts           one reader, a length check)
        [DUP] riskPressure, mobilityPressure,
              placeAttachmentPull, habitatYield,
              carryingCapacity.perCapitaReturn.crowdingPenalty
```

Measured: one overlapping neighbour moves **13 derived quantities** and **6 separately-weighted
candidate-score inputs**.

---

## 2. Perceived overlap

```
   PHYSICAL PROXIMITY (≤4)          OTHER BAND'S PRIVATE STATE
            │                                  │
            │                     ┌────────────┴─────────────┐
            │                     ▼                          ▼
            │        [LEAK] other.recentIntraSeasonTrips   [LEAK] other.placeMemory
            │              (read directly)                       (read directly)
            │                     │                          │
            ▼                     ▼                          ▼
   getLocalEncounterCandidateIds  classifyRangeTier      getSharedMemoryOverlap
   (distance ≤ 4)  [OK]           gated on the observer's  socialContext.ts:1774
            │                     OWN familiar country —          │
            │                     i.e. on PLACE, not on           │
            │                     whether anything was seen       │
            │                     rangeFriction.ts:120-150        │
            │                             │                       │
            │                             │              [LEAK] getEncounterCandidatePairs
            │                             │                     pairs any two bands naming
            │                             │                     the same top return place,
            │                             │                     NO DISTANCE GATE
            │                             │                     socialContext.ts:1952-1978
            │                             │                       │
            └─────────────┬───────────────┘                       │
                          ▼                                       ▼
              RangeFrictionEvent ring                    getEncounterKind
              (8 events, 48-tick age)                    admits memoryOverlap > 0.24
                          │                              at ANY distance
                          │                              socialContext.ts:1718-1746
                          │                                       │
                          │                                       ▼
                          │                            BandEncounterRecord
                          │                                       │
                          │                                       ▼
                          │                            contactMemories, encounterTension
                          │                            [OK] → decisionScoring −0.46 / +0.14
                          │
   ┌──────────────────────┴────────────────────┐
   ▼                                           ▼
[ACTIVE] accessNorms.collectTileFrictionEvents  [ACTIVE] innerFission.rangeFrictionTension
   → kinTolerance, familiarTolerance,              → socialTensionPressure
     strangerCaution, sharedUsePressure,           (causal per CORRECTION-16)
     rememberedRefusalAvoidance
   → ProtoAccessMemoryState.behavior (cap 0.08)
   → pressure.ts:161-166
   → riskPressure, placeAttachmentPull,
     mobilityPressure, netMovePressure

   NOTE: rangeFriction.ts's own header states no behavior rule reads these
   records. Both paths above disprove it.
```

**Measured (C10b):** two bands **44 tiles apart**, sharing one remembered tile, produced a
contact memory and a range-friction event in a single season with no contact of any kind.

---

## 3. Range release

```
   USE ENDS (band departs)
        │
        ├──[OK] proximity channel of the crowding field drops out
        │       → weightedCrowding 0, crowdingPenalty 0          IMMEDIATE (measured)
        │
        ├──[OK] band leaves the shared-catchment claim set
        │       → meanCatchmentShare back to 1.0                 IMMEDIATE (measured)
        │
        ├──[OK] getLocalPopulationEstimate / getLocalBandCount recompute
        │       → rsLocalBandCount 2 → 1                         ONE TICK (measured)
        │
        ├──[OK] world.tileDepletion recovers on its own schedule
        │       → 0.0408 → 0 over 8 seasons                      ECOLOGICAL RATE (measured)
        │
        ├──[OK] own usePressure recovers via applyUsePressureRecovery
        │       → recentUseIntensity halved per tick             GRADUAL (code)
        │
        ├──[OK] familiarCountry recency = clamp(1 - age/40, 0.15, 1)
        │       → familiarity decays with a floor                GRADUAL (code)
        │
        ├──[MISSING] no edge from "the other band left" to the friction ring
        │       → observerFrictionAboutDeparted stayed at 8
        │         for all 17 measured seasons; the ONLY release
        │         is a fixed 48-tick age window                   BLIND TO DEPARTURE (measured)
        │
        ├──[MISSING] no edge from "the other band left" to contact memory
        │       → observerContactMemoryAboutDeparted stayed 1     BLIND TO DEPARTURE (measured)
        │
        ├──[DISC] access expectation does not track departure either;
        │       it drifts toward avoided_shared_use at seasons
        │       6, 9, 14, 16 AFTER the neighbour is gone,
        │       sharedUsePressure rising to 0.17–0.19             WRONG DIRECTION (measured)
        │
        └──[MISSING] the crowding MEMORY channel has no release at all:
                a band 35 tiles away still crowds the place it
                remembers (C4). It releases only when the
                underlying placeMemory loses salience or is
                evicted by memoryCompression.                     NO RELEASE (measured)

   TERMINAL LIFECYCLE (dispersed / absorbed / extinct)
        │
        └──[OK] excluded at crowding.ts:61-68 and socialContext.ts:1608-1613
                → crowding 0, overlap empty, immediately, all three kinds
                → 0 terminal contributions across 7,360 natural pair-seasons
```

---

## 4. Edge summary

| map | `[OK]` | `[DUP]` | `[LEAK]` | `[MISSING]` | `[DISC]` |
| --- | --- | --- | --- | --- | --- |
| physical competition | 9 | 8 | 1 | 3 | 0 |
| perceived overlap | 3 | 0 | 3 | 0 | 0 |
| range release | 7 | 0 | 0 | 4 | 1 |
