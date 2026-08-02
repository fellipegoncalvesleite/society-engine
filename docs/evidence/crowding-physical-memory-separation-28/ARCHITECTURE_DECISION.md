# CORRECTION-28 — ARCHITECTURE DECISION

Branch `checkpoint/crowding-physical-memory-separation-28`, from the accepted AUDIT-27 tip
`b352c3195406fc9494c0b693a98eb0786f1a3780`.

**Decision: Option C** — remove the remembered-place contribution from physical crowding in both
the cached field path and the cache-less scan path, and rely on the remembered-range authorities
production already has. Option C's production edit is identical to Option A's; C is A plus the
§5 obligation to prove remembered overlap already has an honest home. Option B is rejected.

---

## 1. What the defect actually is

`crowding.ts` derives one scalar from two incompatible sources
(`buildCrowdingField`, `crowding.ts:254-255`, and its twin `computeCrowdingContribDescriptor`,
`crowding.ts:654-655`):

```
basePreclamp = (distanceWeight * 0.58        <- current physical proximity
              + samePatchWeight * 0.34       <- current physical proximity
              + memoryOverlap   * 0.24)      <- the OTHER band's remembered places
              * populationWeight
```

The memory channel additionally widens the scatter footprint itself
(`crowding.ts:226-233`): a band scatters into the radius-2 ball around each of its salient
remembered places **regardless of where it currently is**. That is why AUDIT-27's fixture C4
measured a band at **35 tiles** still producing `weightedCrowding = 0.03`,
`crowdingPenalty = 0.01` and a contributor identity at a tile it merely remembers, and why
memory-only overlap outnumbered real physical overlap **27 to 25** across 7,360 pair-seasons.

`memoryOverlap` is not a physical quantity. It is
`clamp01(memory.attachment * 0.46 + (isReturnPlace ? 0.22 : 0))` — a function of how much the
band *values* a place, with no term for presence, occupation, consumption or recency of use.

---

## 2. Options compared

### Option A — physical crowding uses current proximity only

Remove `memoryOverlap` from `basePreclamp` and from the footprint, in both implementations.

| axis | assessment |
| --- | --- |
| semantic clarity | **highest.** `NearbyBandPressure` becomes exactly what its name asserts: pressure from bands that are *nearby*. |
| behavior change | real and bounded. Distant remembering bands drop to zero. Nearby bands that also shared memory lose the additive boost (max `0.24 * 0.68 * populationWeight` ≈ 0.16 pre-clamp at the strongest possible memory). |
| field/scan parity | both sites carry the identical term and the identical `distance > CROWDING_RADIUS && memoryOverlap <= 0` skip; both must change together, and the change is symmetric. |
| does legitimate physical use disappear? | **No.** The only physical reading the memory channel could stand in for is "a band probably still forages where it used to", and production already models that *physically* through `sharedCatchment.getBandForagingFootprint`, which uses the band's persisted `residentialAnchor.catchmentTileIds` — real catchment, not valuation. Nothing physical is carried exclusively by `memoryOverlap`. |

### Option B — typed split inside the crowding derivation

Derive `physicalProximityPressure` and `rememberedRangeOverlap` as separately named channels; only
the physical one feeds physical readers.

**Rejected**, for three reasons:

1. It manufactures a **second remembered-range authority** with no reader. §5 of the checkpoint
   prompt forbids exactly this, and `CLAUDE.md` §3.2 lists "a state field exists but no decision
   reads it" as a defining example of incomplete work.
2. Remembered overlap already has four honest homes (§3 below). A fifth, derived inside the
   *physical* crowding module, is the accidental-coupling risk the option's own evaluation asks
   about: any future reader reaching for "crowding" would find the remembered channel sitting
   next to it under the same roof.
3. It enlarges the type surface (`CrowdingField`, `NearbyBandPressure`) and the per-tile cache
   entry for a value nothing consumes — a bounded but real state cost with no causal payoff.

### Option C — remove memory from crowding and rely on existing social authorities — **SELECTED**

The same production edit as A, adopted only after confirming the meaning survives elsewhere.

### Option D — another minimal architecture

Not required. D is admissible only when evidence shows A/B/C break a legitimate causal chain, and
§3 shows none is broken.

---

## 3. §5 obligation — does remembered overlap already have an honest representation?

Checked against current code, not documentation:

| authority | what it represents | anti-omniscient? | affected by this change? |
| --- | --- | --- | --- |
| `band.placeMemory` (`attachment`, `isReturnPlace`, `repeatedReturnCount`, valences) | the band's own valuation of a place | yes — the band's own store | **untouched** |
| `FamiliarCountrySummary` (`familiarCountry.ts`) | core / familiar / edge classification of remembered country, with a real `recency = clamp(1 - age/40, 0.15, 1)` decay | yes — reads only the observing band's own memory | **untouched** |
| `SocialRangeRecognitionSummary` (`socialRangeRecognition.ts`) | which neighbours the band recognises and how their ranges relate | yes, and it is UI-only (AUDIT-27 verified its "never in stepSim" header is true) | **untouched** |
| `ProtoAccessMemoryState` (`accessNorms.ts`) | access expectations: familiar use, expected return, tolerated / contested shared use, capped at `BEHAVIOR_HOOK_CAP = 0.08` | yes, **except** through `RangeFrictionEvent` | **untouched** |
| `RangeFrictionEvent` (`rangeFriction.ts`) | bounded recent shared-use notices | **no** — AUDIT-27 recorded that its trip-provenance gate is on place, not observation | **untouched, and deliberately so** |
| `BandEncounterRecord` (`socialContext.ts`) | encounters and contact memory | **no** — the 44-tile memory-coincidence pairing | **untouched, and deliberately so** |

The two authorities with known provenance defects are left exactly as they are. §7.5 of this
checkpoint requires it, and repairing them here would confound the before/after proof: a change to
encounter candidacy would move contact memory, which moves access states, which moves
`pressure.ts`'s biases — none of which is the physical crowding seam this checkpoint repairs.

**Conclusion:** remembered overlap is already represented four times over, three of them
anti-omniscient. Removing it from *physical crowding* deletes no meaning. It removes a claim that
was never true — that valuing a place is the same as occupying it.

---

## 4. Selected change, exactly

Two sites, one semantic edit, applied symmetrically.

**Cached field path — `buildCrowdingField` (`crowding.ts:200-256`)**

- delete the `memOverlapByTile` construction and its `getSalientPlaceMemories` loop;
- footprint becomes the proximity ball alone;
- skip becomes `distance > CROWDING_RADIUS` (a strict simplification of
  `distance > CROWDING_RADIUS && memoryOverlap <= 0`);
- `basePreclamp = (distanceWeight * 0.58 + samePatchWeight * 0.34) * populationWeight`.

**Cache-less scan path — `computeCrowdingContribDescriptor` (`crowding.ts:629-658`)**

- delete the `getRememberedAreaOverlap` call;
- skip becomes `distance > CROWDING_RADIUS`;
- identical `basePreclamp`.

**Dead code removed:** `getRememberedAreaOverlap` (its only caller was the scan path).
`getSalientPlaceMemories` is **retained** — it still serves `getParentCoreOverlap`.

**Header comment** (`crowding.ts:128-147`) updated: it currently documents the memory channel as
part of the field's contract.

---

## 5. What this change explicitly does NOT touch

`getParentCoreOverlap` (`crowding.ts:500-523`) contains a **second, independent** memory→pressure
path: it takes `max(directOverlap, memoryOverlap)` over the *parent* band's salient places, and
feeds `DaughterDispersalPressure.parentCoreOverlap`. It does **not** flow through `CrowdingField`,
it is not `NearbyBandPressure`, and it is kin machinery.

§7.8 forbids modifying kin behavior here (AUDIT-27 measured **zero** natural kin-overlap cases, so
there is no evidence to recalibrate against), and §8 excludes daughter viability and fission.
It is therefore **recorded as a deferred AUDIT-27 seam, not repaired**, and the fixtures below
measure it so the residual is quantified rather than assumed absent.

Also deferred, unchanged, and listed so no reader mistakes silence for completion:
shared-catchment footprint composition; same-day trip, expedition and investigation-route overlap;
encounter candidacy and the 44-tile ghost; range-friction expiration; access-memory decay; crowding
score weights and the `nearbyBandPressure` / `crowdingPenalty` double-read;
`RangeSaturationState` formulas; `localUsePressure` crowding inflation; `placeAttachmentPull`;
`territorialPressure`'s missing writer; kin factors; mobility-distance limits.

---

## 6. Expected consequences, declared before measurement

1. A distant remembering band contributes **exactly zero** — no weight, no contributor identity,
   no entry in the field at all, because the footprint no longer reaches the remembered tile.
2. A currently nearby band still contributes; crowding is **not** globally disabled.
3. Where a nearby band ALSO held qualifying memory, its contribution **falls** — the same event is
   now counted once, through proximity.
4. `RangeSaturationState.nearbyCrowding` falls with it; `localPopulationEstimate` and
   `localBandCount` are proximity-derived and **do not move**.
5. `sharedCatchment` division, ecological depletion and terminal exclusions are **unchanged**.
6. Production behavior changes, so no fingerprint parity to `b352c31` is claimed or possible.
