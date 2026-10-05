# AUDIT-27 — CROWDING / SHARED RANGE / RANGE RELEASE AUTHORITY LEDGER

Branch `checkpoint/crowding-shared-range-authority-27`, from the frozen CORRECTION-26 tip
`5f341648addcd4331e86d340f21d2a830b703095`. No production file is modified.

Every row was read from current production code. Where a module's own header comment
contradicts what the code does, the code wins and the discrepancy is recorded in the
`status` column and in `FINDINGS.md`.

## Classification key

`PHYS` physical world authority · `PERC` band-perceived social authority · `MEM` band memory ·
`DERIVED` derived read model · `ACTIVE` behaviorally active · `RECORD` record-only ·
`UI` UI-only · `AUDIT` debug/audit-only · `PARTIAL` · `DUP` duplicated · `DISC` disconnected ·
`INERT` legacy/inert · `MISSING`

---

## 1. Core crowding authorities

### CrowdingField

| field | value |
| --- | --- |
| file | `src/sim/agents/crowding.ts:150-277` |
| writer | `buildCrowdingField`, memoized on `TickContextCache.crowdingFieldMemo` |
| phase | lazily, on the first `getNearbyBandPressure` call that supplies a cache — i.e. inside phase 1 (`updateBandContextStates`) and again on the post-decision cache |
| stored/derived | **derived cache**, never persisted in `WorldState` |
| source evidence | every active band's **current position** (radius-4 ball) **plus its salient remembered places** (radius-2 ball around `isReturnPlace \|\| attachment > 0.5`), weighted by `demography.population / 36` |
| hidden vs band-known | **HIDDEN-WORLD.** Reads every other band's exact position and private `placeMemory`. The deciding band supplies no perception gate. |
| boundedness | bounded: radius 4 + radius 2 per salient place, ≤16 salient places, `MAX_DEBUG_PRESSURE_IDS = 32` |
| decay/release | **immediate on position change** for the proximity channel; **no independent decay** for the memory channel — it releases only when the underlying `placeMemory` record loses salience or is evicted |
| production readers | via `getNearbyBandPressure` only |
| behavioral effect | see `NearbyBandPressure` |
| represents | mixes **physical proximity** and **band memory** in one scalar |
| overlap | is the sole source of `NearbyBandPressure`, `crowdingPenalty`, `RangeSaturationState.nearbyCrowding`, and part of `DaughterDispersalPressure` |
| status | `PHYS` + `MEM` + `DERIVED` + `ACTIVE` + `DUP` |
| disposition | **split the two channels.** The proximity channel is physical; the memory channel is not, and C4 proves it keeps a departed band crowding a place 35 tiles away. |

### NearbyBandPressure

| field | value |
| --- | --- |
| file | `src/sim/agents/types.ts:3311`; derived `crowding.ts:17-48` |
| writer | `getNearbyBandPressure` (field path with a cache, scan path without) |
| phase | on demand, in phase 1 context, in the per-band decision loop, and in phase 3 range context |
| stored/derived | derived; the scalar is persisted onto `BandPressureState.nearbyBandPressure` (`pressure.ts:363`) and `RangeSaturationState.nearbyCrowding` (`socialContext.ts:495`) |
| hidden vs band-known | **HIDDEN-WORLD** (inherits CrowdingField) |
| boundedness | `clamp01((sum / 2.2) * aridityAmplifier)`; `pressureBandIds` capped at 32 |
| decay/release | none of its own; releases exactly when the field does. **C6: clean — dispersed / absorbed / extinct contributors are excluded immediately.** |
| production readers | `pressure.ts:130,455`; `bandDecision.ts:564,606`; `socialContext.ts:458,954,1513`; `demography.ts:1524`; `crowding.ts:426` (daughter); `carryingCapacity.ts:203,522,616` (as `input.nearbyCrowding`); plus 8 stored-field readers (`accessNorms`, `frontierIntent`, `innerFission`, `protoCamps`, `relationshipMemory`, `reportedKnowledge`, `residentialMoveEvent`, `socialContext`) |
| behavioral effect | reaches `computeCandidateScore` as its own term at `-0.24` **and** through five further terms (see `double-counting-trace.json`) |
| represents | claims to be physical competition; is physical proximity ∪ remembered overlap |
| overlap | **high** — see §4 |
| status | `PHYS` + `MEM` + `ACTIVE` + `DUP` |
| disposition | keep as the physical-proximity signal only, after the memory channel is removed. |

### crowdingPenalty

| field | value |
| --- | --- |
| file | `crowding.ts:486-498` (`getCrowdingPenalty`) |
| writer | pure function of `(tile, NearbyBandPressure)`; persisted at `pressure.ts:368` |
| phase | decision loop and pressure derivation |
| stored/derived | derived; stored on `BandPressureState` and on `PerCapitaReturnState.crowdingPenalty` (`carryingCapacity.ts:522`) |
| source evidence | `weightedCrowding * dryAmplifier * (1 - spatialCapacityBuffer * 0.48)` — a **terrain re-weighting of the same scalar**, no new evidence |
| hidden vs band-known | hidden-world (inherits) |
| boundedness | `clamp01` |
| decay/release | none of its own |
| production readers | `decisionScoring.ts:98` (`-0.72`, the largest single crowding weight in the score); `pressure.ts:235,267,275` (risk, attachment, mobility); `bandDecision.ts:2071,3817,3990`; `campMovement.ts:1163`; `foragingAdaptation.ts:530,1401`; `habitatYield.ts:108-153`; `residentialMoveEvent.ts:473`; `demography.ts:1632` (`*0.36`) |
| behavioral effect | **strongest crowding consumer in the codebase** |
| represents | physical crowding, terrain-adjusted |
| overlap | it is `NearbyBandPressure` re-scaled; the two are read **side by side** in the same score |
| status | `PHYS` + `ACTIVE` + `DUP` |
| disposition | keep **one** of `nearbyBandPressure` / `crowdingPenalty` in `computeCandidateScore`, not both. |

### RangeSaturationState

| field | value |
| --- | --- |
| file | `types.ts:4126-4148`; derived `socialContext.ts:451-502`, extended `socialContext.ts:193-205` |
| writer | `deriveRangeSaturationState` (v0 fields) merged with `deriveCarryingCapacity(...).rangeV1` (`saturation`, `densityPhase`, `localPopulationDemand`, `localLaborCapacity`, `totalEffectiveYieldWithinRange`, `recoveryBuffer`, `highRankPersistence`) |
| phase | `applyRangeSaturationContext` — runs **three times per tick** (phase 1 head of `updateBandContextStates`, phase 3 post-decision, phase 5 final read-model pass) |
| stored/derived | **stored** on `band.rangeSaturation`; also cached on `TickContextCache.rangeSaturationByBandId` |
| source evidence | `localUsePressure*0.32 + nearby.weightedCrowding*0.34 + populationPressure*0.28 + seasonalStress - carryingBuffer*0.18` |
| hidden vs band-known | **HIDDEN-WORLD.** `populationPressure` derives from `getLocalPopulationEstimate`, which sums `otherBand.demography.population` over a radius-4 ball with **no perception gate at all** (`socialContext.ts:1600-1632`). |
| boundedness | `clamp01`; `saturation` clamped to `[0, 2.5]` |
| decay/release | **fully recomputed each tick from current state** — no stored decay. Releases as soon as the neighbours leave. Measured: `rsLocalBandCount` 2 → 1 within one tick of departure (`release-timelines.json`). |
| production readers | 20+ behavioral sites: `decisionScoring.ts:80` (`-0.34`), `bandDecision.ts:2030,3813,3646`, `mobilityIntent.ts:910,934`, `campMovement.ts:671,751,921`, `chronicHardship.ts:96`, `innerFission.ts:58-59,154-155`, `frontierIntent.ts:115`, `frontierExploration.ts:123`, `frontierVerification.ts:199`, `frontierResidence.ts:138`, `foragingAdaptation.ts:528,1399`, `mobilityBehaviorBasis.ts:150`, `demography.ts:682,1413`, `reportedKnowledge.ts:961,1537,2373,2634`, `carryingCapacity.ts:447`, `socialContext.ts:583,829,1088-1089` |
| behavioral effect | very wide |
| represents | a **blend** of physical use, crowding, hidden population density and the band's own stress |
| overlap | contains `weightedCrowding` at 0.34 **and** is read alongside it |
| status | `PHYS` + `DERIVED` + `ACTIVE` + `DUP` (crowding term) |
| disposition | keep — it is the best-behaved release authority in the system — but remove the `nearby.weightedCrowding` term or the separate crowding score terms, not both. |

### LocalUsePressureRecord (`band.usePressure`)

| field | value |
| --- | --- |
| file | `types.ts`; written `pressure.ts:517-621` |
| writer | `updateUsePressureRecords`, inside `updateBandPressure` during `applyBandDecision` |
| phase | phase 2, per band |
| stored/derived | **stored, per band**, `bandId` stamped on every record |
| source evidence | the band's OWN chosen action, its anchor catchment spread, and its own observed tiles |
| hidden vs band-known | band-known — **but** the intensity is multiplied by `(1 + nearbyPressure.weightedCrowding * 0.28)` (`pressure.ts:461-464`), injecting the hidden crowding scalar into the band's own use record |
| boundedness | capped at 128 records (`compactUsePressureRecords`) |
| decay/release | gradual, physical: `applyUsePressureRecovery` subtracts `recoveryRate * 0.7…0.94` per tick and halves `recentUseIntensity` |
| production readers | 25+ modules; `decisionScoring.ts:69` (`-0.44`), `carryingCapacity.ts`, `campMovement`, `protoCamps`, `accessNorms:209`, candidates |
| behavioral effect | wide |
| represents | **one band's own use only.** Two bands using the same tile hold two independent records and neither can read the other's. |
| overlap | this is the **missing shared-use substrate**: there is no world-level per-tile use record |
| status | `PHYS` + `ACTIVE` + `PARTIAL` (per-band, never shared) |
| disposition | keep; a shared-use field, if built, must be separate and must not double the private record. |

---

## 2. Physical shared-use authorities

### SharedCatchmentIndex — the real physical competition

| field | value |
| --- | --- |
| file | `src/sim/agents/sharedCatchment.ts` |
| writer | `buildSharedCatchmentIndex`, memoized on `TickContextCache.sharedCatchmentMemo` |
| phase | on demand inside `deriveCarryingCapacity` |
| stored/derived | derived cache |
| source evidence | each band's **anchor catchment**, or a radius-2 ring-walk over its OWN known tiles, weighted by adult-equivalent foraging draw and distance decay |
| hidden vs band-known | the *footprint* is band-known; the *division* is a world-level fact the band never reads as an identity — it only experiences a smaller share. **This is the correct anti-omniscient design.** |
| boundedness | `MAX_FOOTPRINT_TILES = 16` per band |
| decay/release | recomputed per cache; releases immediately when a band leaves |
| production readers | `carryingCapacity.ts` (`share` multiplies every tile's support), `getOverlappingBandIds` |
| behavioral effect | **measured: mean share 1.0 → 0.6923 and reachable support 160.63 → 109.84 (−31.6%) from one overlapping neighbour** (`double-counting-trace.json`) |
| represents | genuine physical exploitation competition |
| overlap | the *only* authority that is unambiguously physical shared use |
| status | `PHYS` + `ACTIVE` |
| disposition | **this is the substrate to build on.** Its limitation is reach, not correctness: the footprint is residence-anchored, so it cannot represent expedition or same-day-trip overlap. |

### Shared ecological depletion (`world.tileDepletion`, fauna, plant, forest)

| field | value |
| --- | --- |
| file | `world/depletion.ts`, `agents/faunaStock.ts`, `agents/plantStock.ts`, `agents/forestPatches.ts` |
| writer | `advanceTileDepletion` etc., phase 4, once per season, from the post-decision catchment index |
| stored/derived | **stored on the world**, not the band — genuinely shared |
| hidden vs band-known | hidden-world physical truth; bands reach it only through observation |
| decay/release | **recovers on its own physical schedule.** Measured: depletion at an abandoned overlap tile 0.0254 → 0.0205 → 0.0156 → 0.0107 over three seasons after departure (`release-timelines.json`) |
| behavioral effect | via realized harvest → receipts → nutrition |
| represents | true shared physical consequence, symmetric by construction |
| status | `PHYS` + `ACTIVE` |
| disposition | keep unchanged; it already provides the "ecology recovers at its own rate" edge of the release map. |

---

## 3. Perception and memory authorities

### FamiliarCountrySummary

| field | value |
| --- | --- |
| file | `src/sim/agents/familiarCountry.ts` |
| writer | `deriveFamiliarCountry` — pure, stateless, nothing persisted |
| phase | **inside the tick**, twice: `accessNorms.ts:154` (per band, per candidate tile) and `rangeFriction.ts:486` |
| stored/derived | derived, recomputed every call |
| source evidence | the band's own `observedTiles`, `placeMemory`, `travelCorridors`, `anchorMemories`, `residentialAnchor`, recent trips and moves |
| hidden vs band-known | **band-known only** — this part of the header is accurate |
| boundedness | bounded by `observedTiles` (72-record cap) |
| decay/release | `recency = clamp(1 - age/40, 0.15, 1)` — a real gradual decay with a floor |
| production readers | `accessNorms` (→ `familiarUseStrength`), `rangeFriction` (→ `RangeMembership`, which decides which other-band activity the observer notices at all), `socialRangeRecognition` (UI-only) |
| behavioral effect | **yes**, through `ProtoAccessMemoryState.behavior` and through which range-friction events exist |
| **header discrepancy** | the module header states `NEVER called inside stepSim — so the simulation is byte-identical` and the summary carries `noBehaviorChange: true`. **Both are false as of this tip.** |
| status | `MEM` + `DERIVED` + `ACTIVE` — **misdocumented as inert** |
| disposition | correct the header and the `noBehaviorChange` flag; keep the decay, which is the model the release map wants for "familiar/attachment memory may persist longer". |

### RangeFrictionEvent (`band.recentRangeFrictionEvents`)

| field | value |
| --- | --- |
| file | `src/sim/agents/rangeFriction.ts`; type in `types.ts` |
| writer | `advanceRangeFriction`, called from `updateBandContextStates` (`socialContext.ts:149`) — **three times per tick** |
| stored/derived | **stored** ring on the observer band |
| source evidence | the other band's **current position** and its **private `recentIntraSeasonTrips`**, admitted only when the tile is inside the observer's own familiar country; plus contact memories, ford context and second-hand reports |
| hidden vs band-known | **MIXED, and the gate is on PLACE not on VISIBILITY.** `derivePairNotices` (`rangeFriction.ts:120-150`) reads `other.recentIntraSeasonTrips` and admits a notice whenever `classifyRangeTier(membership, trip.targetTileId) !== "unknown_to_observer"`. There is no check that the observer was present, could see, or heard anything. |
| boundedness | ring 8, age 48 ticks, 12 candidates, 2 events/pair, 5 new events/band/tick |
| decay/release | events age out of the 48-tick window. **Measured: they do NOT release on departure — `observerFrictionAboutDeparted` stays flat for the whole post-departure series while every physical authority goes to zero** (`release-timelines.json`, C5). |
| production readers | `accessNorms.ts:115` (candidate tiles) and `:426` (`collectTileFrictionEvents` → `kinTolerance`, `familiarTolerance`, `strangerCaution`, `sharedUsePressure`, `rememberedRefusalAvoidance`, `rememberedCooperationTolerance`); `innerFission.ts:146` (`rangeFrictionTension` → `socialTensionPressure`); `reportedKnowledge.ts:648,968` |
| behavioral effect | **YES.** `accessNorms` → `ProtoAccessMemoryState.behavior` → `pressure.ts:161-166` → `riskPressure`, `placeAttachmentPull`, `mobilityPressure`, `netMovePressure`. And `innerFission` is causal per CORRECTION-16. |
| **header discrepancy** | the module header states `It is memory/debug state only: no movement, conflict, demography, stress, yield, support, or territory rule reads these records.` **This is false** — two independent behavioral paths read it. |
| natural incidence | **149 events over 20 y × 3 scenarios × 2 seeds**, against only **26 near-residence pair-seasons**. 141 `familiar_neighbor`, 8 `stranger_or_unrecognized`. |
| status | `PERC` + `MEM` + `ACTIVE` — **misdocumented as record-only** |
| disposition | correct the header; then decide deliberately whether the trip-provenance gate should require observation. |

### ProtoAccessMemoryState

| field | value |
| --- | --- |
| file | `src/sim/agents/accessNorms.ts`; type `types.ts` |
| writer | `advanceProtoAccessMemory` via `applyProtoAccessContext`, inside `updateBandContextStates` |
| stored/derived | **stored** on `band.protoAccessMemory` |
| source evidence | place memory, anchor memories, proto-camp memory, familiar country, range-friction events, word-of-mouth reports, storage/visible signals, crossing memory |
| hidden vs band-known | band-known **except** through `RangeFrictionEvent`, which is not (above) |
| boundedness | `ACCESS_MEMORY_CAP = 8` places, 18 candidate tiles, 6 reasons |
| decay/release | `staleness = staleYears / 12`; `deriveAccessBehavior` returns the empty behavior once the state is `stale_access_memory`. **Measured lag: `accessSharedUsePressure` 0.05 → 0.25 → 0.26 → 0.02 across the four seasons after a departure — it RISES before it falls** (`release-timelines.json`). |
| production readers | `pressure.ts:161-166` → six named biases entering `riskPressure`, `placeAttachmentPull`, `mobilityPressure`, `netMovePressure`; `bandChronicle.ts` |
| behavioral effect | bounded at `BEHAVIOR_HOOK_CAP = 0.08` per bias |
| represents | **access expectation memory (concept D)** — correctly separated, correctly reversible, correctly capped |
| natural incidence | 18,417 non-`none` place-states over 2,400 band-seasons; `familiar_use` 12,107, `expected_return` 6,239, `tolerated_shared_use` **71** |
| status | `MEM` + `PERC` + `ACTIVE` |
| disposition | **this is the model the rest of the system should follow.** It is the only authority that separates D from A/B/C, caps its own influence, and declares `reversible / noConflict / noExpulsion / noFixedBorders / noProperty / noLaw / noWar`. |

### BandEncounterRecord

| field | value |
| --- | --- |
| file | `socialContext.ts:1020-1133` |
| writer | `applyEncounterContext` — phase 1 (inside `updateBandContextStates`) and again phase 3 |
| source evidence | pair candidacy from `getEncounterCandidatePairs` (`socialContext.ts:1932-1986`) |
| hidden vs band-known | **DEFECTIVE.** Pairs are generated from proximity ≤ 4 **and, separately, from any two bands whose `topReturnPlaceIds` share a tile — with no distance gate.** `getEncounterKind` then admits `memoryOverlap > 0.24` **at any distance**, and `getSharedMemoryOverlap` reads the other band's private `placeMemory` directly. |
| decay/release | bounded ring |
| production readers | `contactMemories`, encounter tension/tolerance in `decisionScoring.ts:95-96`, `accessNorms` via contact tolerance |
| behavioral effect | yes |
| measured defect | **C10b: two bands separated by 44 tiles, sharing one remembered tile, produced a contact memory AND a range-friction event in a single season.** |
| status | `PERC` + `ACTIVE` + **anti-omniscience violation** |
| disposition | require proximity or an evidence trail for encounter candidacy; memory coincidence is not contact. |

### SocialRangeRecognition (RANGE-3)

| field | value |
| --- | --- |
| file | `src/sim/agents/socialRangeRecognition.ts` |
| writer | `deriveSocialRangeRecognition`, pure |
| phase | **never in the tick.** Reached only from `socialEcologicalDiffusion.deriveSocialEcologicalDiffusionProfile` → `adaptiveHuman.deriveAdaptiveHumanProfile`, whose only importers are `publicHumanStory.ts`, `knowledgeCarriers.ts` and UI panels — and `publicHumanStory` / `knowledgeCarriers` are themselves imported **only by `src/ui/`**. |
| status | `UI` — **header claim verified true** |
| disposition | leave alone. It is the one range module that is honestly inert. |

---

## 4. Kin, dispersal and the frozen scalar

### DaughterDispersalPressure

| field | value |
| --- | --- |
| file | `crowding.ts:420-484` |
| writer | `getDaughterDispersalPressure`, pure per call |
| source evidence | `NearbyBandPressure` (0.36), `parentCoreOverlap` (0.42), `kinCoreCrowding` (0.32), `earlyDispersalUrgency`, `localUsePressure`, `safeFrontierPull`, minus `inheritedFamiliarityPull` and `kinSafety` |
| hidden vs band-known | **HIDDEN-WORLD.** `getParentCoreOverlap` reads the parent band's position **and its private salient place memory**. |
| decay/release | recomputed per call |
| production readers | `pressure.ts:131` → `mobilityPressure*0.16`, `netMovePressure*0.18`, `placeAttachmentPull`; `bandDecision.ts:565,607`; `decisionScoring.ts:77,93` |
| natural incidence | **`kinOverlapPairs = 0` across all 7,360 measured pair-seasons.** The whole kin branch is never exercised in the audited scenarios. |
| status | `PHYS` + `MEM` + `ACTIVE` + `DUP` (re-consumes `weightedCrowding`) |
| disposition | do not touch here — Daughter Viability is roadmap item 4. Record the measured zero so item 4 does not assume the machinery is live. |

### `band.territorialPressure`

| field | value |
| --- | --- |
| file | `types.ts:93` |
| writer | **`spawn.ts:922` (`0.12`) and `spawn.ts:1266` (`0.08`) only**, plus fission inheritance `demography.ts:957` (`parent * 0.72 + 0.04`) |
| phase | spawn / fission only |
| stored/derived | stored |
| source evidence | **none.** No event, encounter, crowding reading, use record or release ever writes it. |
| decay/release | **none — it is a constant for the whole life of a band.** |
| production readers | `pressure.ts:277` (`mobilityPressure += territorialPressure * 0.08`), `mobilityIntent.ts:930` (`* 0.12`), `bandDecision.ts:5531` (`* 0.14`) |
| behavioral effect | **real and permanent** |
| status | `INERT` **input** + `ACTIVE` **reader** — a frozen constant presented as a pressure |
| disposition | **either give it a writer or delete it.** As it stands it is the clearest instance of the prompt's "record-only systems presented as behavioral authorities" inverted: an unwritten constant presented as a responsive pressure. Deleting it is a behavior change and belongs to a production checkpoint, not this audit. |

### RangeRotationPressureReliefState

| field | value |
| --- | --- |
| file | `campMovement.ts:570-653`; type `types.ts:6247` |
| writer | `deriveRangeRotationPressureReliefState`, inside `advanceCampMovementState` / `deriveCampMovementDecisionSupport` |
| phase | phase 2, inside the decision |
| source evidence | `signals.currentUsePressure`, `localProblemPressure`, `rangeSaturation.saturationPressure`, non-food camp pressure; candidates from a bounded radius search over band-known tiles |
| decay/release | recomputed each call from current state |
| production readers | `bandDecision.ts:493-507` (`deriveCampMovementDecisionSupport`) and `:1730` (`selectCampMovementInfluenceForAction`) |
| behavioral effect | yes — it biases candidate selection |
| represents | **local pressure-relief movement**, i.e. release-seeking behavior |
| status | `DERIVED` + `ACTIVE` |
| disposition | keep. This is the closest thing production has to a deliberate "range rotation" mechanism and it is honestly derived. |

### `localPopulationEstimate` / `pressureBandIds` / `crowdingBandIds`

| field | value |
| --- | --- |
| files | `socialContext.ts:1600-1654`; `pressure.ts:399`; `crowding.ts:377-389` |
| hidden vs band-known | `getLocalPopulationEstimate` sums **every** band's `demography.population` inside radius 4, weighted by distance, with **no perception gate**. `crowdingBandIds` carries **real `BandId`s** derived from hidden positions and hidden memory. |
| production readers | `localPopulationEstimate` → `RangeSaturationState.localPopulationEstimate` → `populationPressure` → `saturationPressure` (wide), **and** → `carryingCapacity.saturation = localPopulationEstimate / supportableCapacity` → `saturationPenalty` (≤ 0.5) on per-capita return. `crowdingBandIds` has exactly **one** production reader: `reportedKnowledge.ts:965`, a `.length > 0` check. |
| status | `PHYS`-ish + `ACTIVE`; the **identities** are `DEBUG` in practice but are persisted on canonical band state |
| disposition | the population *magnitude* is defensible as a physical density the band experiences through returns; the *identities* should not be on canonical state. Reclassify or drop `crowdingBandIds`. |

---

## 5. Summary counts

| classification | authorities |
| --- | --- |
| `PHYS` + `ACTIVE`, honest | SharedCatchmentIndex, shared ecological depletion, LocalUsePressureRecord (per-band), RangeRotationPressureRelief |
| `PHYS`/`MEM` conflated | CrowdingField, NearbyBandPressure, crowdingPenalty, DaughterDispersalPressure |
| `PERC` + `ACTIVE`, misdocumented as inert | RangeFrictionEvent, FamiliarCountrySummary |
| `PERC` + `ACTIVE`, anti-omniscience violation | BandEncounterRecord (memory-coincidence pairing) |
| `MEM` + `ACTIVE`, correctly bounded | ProtoAccessMemoryState |
| `UI` only, correctly documented | SocialRangeRecognition |
| frozen constant with live readers | `band.territorialPressure` |
| `MISSING` | any world-level shared **use** record; any representation of expedition / same-day-trip route overlap in crowding |
