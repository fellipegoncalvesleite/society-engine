# CORRECTION-30 — writer / reader / provenance ledger

Read directly from the tree at `a15d0a78a3a7ef57b87b22226190d6729ba9b9d7`
(CORRECTION-29, CLOSED and FROZEN). Every line below is a repository fact, not an inference
from documentation.

---

## 1. `RangeFrictionEvent` — the record itself

**Type:** `src/sim/agents/types.ts:4867-4892`.
**Stored on:** `Band.recentRangeFrictionEvents?: readonly RangeFrictionEvent[]`
(`types.ts:6655`), a ring bounded to 8, aged out at 48 ticks.

### 1.1 Writers — complete

| Writer | File:line | What it reads to decide the record exists |
| --- | --- | --- |
| `advanceRangeFriction` | `rangeFriction.ts:53-103` | the only production writer |
| ↳ `derivePairNotices` → residential branch | `rangeFriction.ts:129-140` | **`other.position`** (private) + observer's own familiar country |
| ↳ `derivePairNotices` → trip branch | `rangeFriction.ts:141-163` | **`other.recentIntraSeasonTrips`** (private) + observer's own familiar country |
| ↳ `countRecentTripsInRange` | `rangeFriction.ts:624-633` | **`other.recentIntraSeasonTrips`** (private) — inflates `recentOverlapCount` on the residential notice |
| ↳ `classifyTripActivity` | `rangeFriction.ts:397-447` | **the other band's private trip record's** `taskGroupType`, `objective`, `cause`, `movementType`, `resourceClassId`, `pathTiles` |
| ↳ `deriveReportLinkedEvents` | `rangeFriction.ts:228-308` | the observer's **own** `reportedKnowledge.reports` — legitimate |

`advanceRangeFriction` is called from exactly one production site:
`socialContext.ts:149`, inside `updateBandContextStates`, immediately after
`advanceReportedKnowledge` and after `applyEncounterContext`. `updateBandContextStates` runs
**twice per tick** (`tick/advance.ts:171` pre-decision, `tick/advance.ts:284` final read-model
pass). One further audit call site: `scripts/simBenchmark.mjs:1561/8977/34790/54421`.

### 1.2 Reset

`demography.ts:763` lists `recentRangeFrictionEvents` in the daughter-reset field set;
`demography.ts:1074` sets it `undefined` on a fission daughter. Correct — friction notices
are observer-specific.

### 1.3 Readers of `recentRangeFrictionEvents` — complete

| Reader | File:line | Effect | Behaviourally live? |
| --- | --- | --- | --- |
| `collectAccessCandidateTileIds` | `accessNorms.ts:115-119` | friction tiles become access-memory candidates | **yes** |
| `collectTileFrictionEvents` | `accessNorms.ts:426` | supplies the friction set that drives `kinTolerance`, `familiarTolerance`, `strangerCaution`, `sharedUsePressure`, `rememberedRefusalAvoidance` | **yes** |
| `deriveSocialTensionReadabilityState` | `innerFission.ts:145-147, 166, 189` | `rangeFrictionTension` → `socialTensionPressure` at weight 0.12 | **yes** |
| `buildInternalFacts` | `reportedKnowledge.ts:648-667` | top-3 friction events become outgoing `outsider_use_warning` / `crowded_water_warning` reports | **yes** |
| `hasGroundedOtherBandEvidence` | `reportedKnowledge.ts:968` | flips `poor_return_region` (ecological framing) → `crowded_range_warning` (social framing) | **yes** |
| Selected-band panel | `ui/band/sections.tsx:2507, 2809` | display | no |
| Benchmark / audits | `scripts/simBenchmark.mjs` (many) | measurement | no |

### 1.4 The cascade is NOT inert — traced to a decision authority

```text
rangeFriction.ts  writes recentRangeFrictionEvents
  -> accessNorms.ts:426  collectTileFrictionEvents
  -> accessNorms.ts:196  strangerCaution         (friction relation + friction tension)
     accessNorms.ts:202  sharedUsePressure
     accessNorms.ts:215  rememberedRefusalAvoidance
  -> accessNorms.ts:225-232  accessState / placeSensitivity
  -> accessNorms.ts:345-372  deriveAccessBehavior -> ProtoAccessBehaviorEffectState
  -> pressure.ts:161-166     sensitivePlaceCautionBias, toleranceReductionBias,
                             kinToleranceReliefBias, contestedAvoidanceBias,
                             expectedReturnBias   ** a real pressure/decision input **
  -> foragingAdaptation.ts:1353   toleranceReductionBias * 0.5
  -> bodyCampLogistics.ts:831     sharedUsePressure / crowdingResourcePressure
  -> relationshipMemory.ts:402,587,597  accessTension, crowded-water classification
```

and independently:

```text
rangeFriction.ts -> innerFission.ts:145 rangeFrictionTension -> socialTensionPressure
rangeFriction.ts -> reportedKnowledge.ts:648 outgoing reports -> other bands' reports
                 -> rangeFriction.ts:228 deriveReportLinkedEvents (report-linked friction)
```

Note the loop in the last two lines: a false friction record is republished as a report, and a
report can seed report-linked friction elsewhere. The self-report cut at `rangeFriction.ts:250`
(the 2026-07-10 rumour-loop fix) blocks the band's *own* reports, but not a false record
travelling to a neighbour and returning.

`rangeFriction.ts`'s own header claims "no movement, conflict, demography, stress, yield,
support, or territory rule reads these records." **That is true only of direct reads.** Through
`accessNorms` → `pressure`, the records reach a behavioural authority. The header is not
false about direct readers but is misleading about consequence, and is corrected in this pass.

---

## 2. Provenance classification of every input `rangeFriction.ts` currently reads

| Input | File:line | Owner | Class |
| --- | --- | --- | --- |
| `observer.knowledge.observedTiles`, `placeMemory`, `travelCorridors`, `anchorMemories`, `seasonalEcologyMemory`, `residentialAnchor` (via `deriveFamiliarCountry`) | `familiarCountry.ts:85-269` | **observer** | own memory — legitimate |
| `deriveFordContext(band, world).knownFords` | `rangeFriction.ts:487` | **observer** | own memory — legitimate |
| `observer.reportedKnowledge.reports` | `rangeFriction.ts:234` | **observer** | received report — legitimate, `reported_secondhand` |
| `observer.recentRangeFrictionEvents` | `rangeFriction.ts:195, 286` | **observer** | own prior notices — legitimate |
| `observer.contactMemories` | `rangeFriction.ts:478, 556` | **observer** | prior contact — legitimate for **identification/relation**, carries **no position** |
| `observer.parentBandId` / `daughterBandIds` | `rangeFriction.ts:469-476` | **observer** | kinship — legitimate for relation |
| `cache.nearbyBandsByBandId` | `rangeFriction.ts:466` | **world, physical** | current proximity ≤ 4 — legitimate, and currently used **only** to seed the candidate list, never as an evidence gate |
| **`other.position`** | `rangeFriction.ts:127, 131, 134, 446` | **other band, private** | **NOT observer evidence** |
| **`other.recentIntraSeasonTrips`** | `rangeFriction.ts:141, 625` | **other band, private** | **NOT observer evidence** |
| **`trip.taskGroupType` / `objective` / `cause` / `movementType` / `resourceClassId` / `pathTiles` / `reasonIds`** | `rangeFriction.ts:397-447, 159-161` | **other band, private** | **NOT observer evidence** |
| `world.tiles` via `getTile` | `rangeFriction.ts:191, 263, 403` | world | terrain classification of a tile the observer already knows — legitimate |

### 2.1 The candidate list

`deriveCandidateBands` (`rangeFriction.ts:449-483`) admits, in order:

1. `cache.nearbyBandsByBandId` — **physical proximity ≤ 4** (legitimate);
2. `parentBandId`, `daughterBandIds`, siblings — **no distance limit**;
3. every key of `observer.contactMemories` — **no distance limit**.

Because `add()` returns early once the 12-slot cap is reached and nearby bands are added
first, a nearby band can never be crowded out by a distant one. The candidate list is a
*selection* set, not an evidence claim. It is left unchanged; the evidence gate is what moves.

**`rangeFriction.ts` contains no distance computation of any kind** — verified: no
`getGridDistance` import, no `distance` identifier anywhere in the 800-line file.

---

## 3. Legitimate social-evidence authorities — what each actually proves

| Authority | Type / file | Written by | Proves | Does **not** prove |
| --- | --- | --- | --- | --- |
| `BandEncounterRecord` | `types.ts`; `Band.encounterRecords`, ring 24 | `applyEncounterToBand`, `socialContext.ts:1133-1166` — the only production writer outside spawn/fission | two bands were within ≤ 3 tiles this tick; `tileId` set only when distance 0 | anything about the other band's trips, plans, or later position |
| `KnownBandContactMemory` | `types.ts:4457-4471`; `Band.contactMemories` | `updateContactMemory`, `socialContext.ts:1168+` | prior contact happened; familiarity/tension/tolerance history | **contains no `tileId`, no position, no activity** — it cannot locate anybody |
| `WordOfMouthReport` | `types.ts:4761-4791`; `Band.reportedKnowledge.reports` | `advanceReportedKnowledge`, `reportedKnowledge.ts` | somebody said something, with `sourceBandId`, `hops`, `trustBasis`, `distortionLevel`, `freshness`, `confidence` | first-hand observation; it must stay `reported_secondhand` |
| `knownBands` / `SocialRangeRecognitionSummary` | `socialRangeRecognition.ts` | derived | that the observer recognises another band's country in general terms | current occupancy of any tile |
| `VisibleLandscapeCue` | `landscapeVisibility.ts:26-92` | `advanceVisibleLandscapeCues` | a **terrain** feature is visible at 3–10 tiles | **no cue kind refers to people, camps, fires or bands** — `LandscapeVisibilityCueKind` is entirely water/valley/ridge/vegetation. It cannot see a band. |
| `ReceivedSmokeSignal` | `fireSignals.ts:117-210` | `resolveSmokeSignal`, `appendReceivedSignal` | a band's **own** party signalled its **own** camp (`params.band` is one band; the signal is deliberate and same-band) | anything about another band. There is **no cross-band smoke detection.** |
| Current physical proximity | `contextCache.ts:139-155, 257-306`, `DEFAULT_NEARBY_RADIUS = 4` at `contextCache.ts:26` | `buildTickContextCache` | the two bands' **current** tiles are within Chebyshev 4 | what the other band did last season, or where its parties went |

### 3.1 Authorities that do NOT exist — searched and absent

| Channel | Search result |
| --- | --- |
| Human tracks / footprints / spoor | no state, no writer, no reader anywhere in `src/sim` |
| Trails as marks on the world | `Band.travelCorridors` is the band's **own** route memory, private to it |
| Abandoned camp remains | `TemporaryTaskPartyRecord` asserts `noCamp: true` (CORRECTION-26); `ExpeditionTaskCamp` is party-local and does not persist as a world feature |
| Trace freshness | no such field exists |
| Cross-band visibility / line of sight | `isSmokeLineOccluded` exists but is applied only to same-band smoke; CORRECTION-29 recorded that encounters have no visibility, route or barrier rule at all |

The word "footprint" in `sharedCatchment.ts`, `crowding.ts` and `carryingCapacity.ts` means a
**foraging catchment footprint** — an ecological competition weight — not a physical mark.
It is not readable by another band and is not a trace authority.

---

## 4. Downstream quantities named in the checkpoint — writers and readers

| Quantity | Writer | Behavioural readers |
| --- | --- | --- |
| `recentRangeFrictionEvents` | `rangeFriction.ts:94-97` | §1.3 above |
| `linkedActivityTripId` | `rangeFriction.ts:157, 217` — **set only from a private trip record** | `ui/band/sections.tsx:2809` only. No simulation reader. It is a provenance label for a record whose provenance is the defect. |
| `RangeFrictionConfidence` | `rangeFriction.ts:136, 155, 284` | `confidenceRank` (`rangeFriction.ts:782`) for ordering; `ui/band/sections.tsx` for display |
| `RangeFrictionOtherActivityKind` | `rangeFriction.ts:135, 154` via `classifyTripActivity` | event id composition; display |
| `ProtoAccessMemory` | `accessNorms.ts:143-340` | `pressure.ts:161`, `foragingAdaptation.ts:1353`, `bodyCampLogistics.ts:831`, `relationshipMemory.ts:396/402/576/587/597`, `memoryReferents.ts:895/1388`, `bandChronicle.ts`, `bandEvents.ts` |
| `strangerCaution` | `accessNorms.ts:196` | `accessNorms.ts:229` (`placeSensitivity`), `:352` (`sensitivePlaceCautionBias`), `:366`, `:690`, `:742`, `:754`; `relationshipMemory.ts:402` |
| `sharedUsePressure` | `accessNorms.ts:202` | `accessNorms.ts:213/230/357/363/365/366/369/693/726`; `bodyCampLogistics.ts:831`; `relationshipMemory.ts:587/597` |
| `rememberedRefusalAvoidance` | `accessNorms.ts:215` | `accessNorms.ts:231/352/363/687/732/742/825`; `memoryReferents.ts:913` |
| `rangeFrictionTension` | `innerFission.ts:145` | `innerFission.ts:166` → `socialTensionPressure`; `:189` topCauses |

---

## 5. Constants — all left unchanged by this checkpoint (§14)

| Constant | File:line | Value |
| --- | --- | --- |
| `RANGE_FRICTION_RING_LIMIT` | `rangeFriction.ts:28` | 8 |
| `RANGE_FRICTION_MAX_AGE_TICKS` | `rangeFriction.ts:29` | 48 |
| `RANGE_FRICTION_CANDIDATE_LIMIT` | `rangeFriction.ts:30` | 12 |
| `RANGE_FRICTION_TRIP_WINDOW_TICKS` | `rangeFriction.ts:31` | 12 |
| `RANGE_FRICTION_EVENTS_PER_PAIR_LIMIT` | `rangeFriction.ts:32` | 2 |
| `RANGE_FRICTION_NEW_EVENTS_PER_BAND_LIMIT` | `rangeFriction.ts:33` | 5 |
| `FRICTION_RECENT_WINDOW_TICKS` | `accessNorms.ts:24` | 48 |
| `REPORT_RECENT_WINDOW_TICKS` | `accessNorms.ts:25` | 80 |
| `ACCESS_MEMORY_CAP` | `accessNorms.ts:21` | 8 |
| `BEHAVIOR_HOOK_CAP` | `accessNorms.ts:26` | 0.08 |
| `DEFAULT_NEARBY_RADIUS` | `contextCache.ts:26` | 4 — **reused, not changed** |

---

## 6. Ordering facts that matter for measurement

- `advanceRangeFriction` runs **twice per tick**, inside both `updateBandContextStates` calls
  (`tick/advance.ts:171` and `:284`), with pre-decision and post-decision positions
  respectively.
- Within one `updateBandContextStates` call the order is
  `applyRangeSaturationContext` → `applyFrontierOpportunityContext` → `applyDispositionContext`
  → `applyEncounterContext` → `advanceReportedKnowledge` → `advanceRangeFriction` → …
  (`socialContext.ts:143-166`). Encounters and reports for the tick are therefore already
  written when friction is derived, and the **same cache** is used, so positions are identical.
- `applyEncounterContext` additionally runs standalone post-decision at `tick/advance.ts:236`.
- Nothing between the post-decision cache and the final read-model pass moves a band
  (`tick/advance.ts:267-279`), so proximity read in the final pass is the post-decision
  geometry.
