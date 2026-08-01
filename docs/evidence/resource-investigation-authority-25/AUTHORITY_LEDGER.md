# CLOSURE-25 — resource investigation / temporary use authority ledger

One block per action family. Every column required by the checkpoint is present on
every row; a column that does not exist in production is written `NONE` with the
reason, never left blank and never inferred from a name or a type.

Read against `ce723b3f1973e4f3f2c54a424a614e723a14558a`. Callers and readers were
traced by grep and by reading the call sites, not by naming.

**Vocabulary.** A candidate is not an action. An action is not physical execution. A
physical take is not a receipt. A receipt is not support until
`deriveHumanFoodSupportLedger` reads it.

---

## 1. `resource_scout`

| column | value |
| --- | --- |
| selector/writer | `rules/candidates/resourceScoutCandidate.ts` `buildResourceScoutCandidate` → `agents/resourceScout.ts` `selectResourceScoutTarget` |
| exact selected identity | `Decision.id` + `Action{type:"resource_scout", originTileId, targetTileId, scoutKind, targetResourceClass}` |
| exact executed identity | **NONE** — no executor exists in `bandDecision`'s applier, `intraSeasonTrips` or `expedition`. `applyResourceScoutObservation` (`bandDecision.ts:3108`) is an observation applier, not a physical execution |
| workers represented | **NONE** — the action carries no worker field |
| physical route/position | **NONE** — `collectProbeObservationTargets` (`bandDecision.ts:5539`) observes the target tile and its 1-ring; it never builds or walks a path. `band.position` is used only to exclude itself from the neighbour set |
| time and duration | **NONE** — resolves inside the seasonal decision |
| provisions/labor/risk | **NONE charged.** `resourceScout.ts:419` `laborCost = clamp01(0.2 + distance/10*0.5 + (1-capacity)*0.3)` is a normalized score term feeding `movementCost` and the VOI weight; it debits no labour pool |
| world-truth access and why legitimate | Reads the band-known `updatedKnowledge.observedTiles[target]` written by the canonical `observeTileAndNearby`. `derivePlantScoutObservationHint` additionally reads the raw `Tile`. Legitimate **only** on the premise that a task group is present; that presence is not modelled — see FINDINGS §3 |
| memory writer | Real: `updateResourceKnowledgeFromObservation` (`agents/resourceKnowledge.ts`) via `applyResourceScoutObservation` |
| stock depletion | **NONE** |
| cargo | **NONE** |
| return requirement | **NONE** — nothing leaves, so nothing returns |
| receipt writer | **NONE** |
| support reader | **NONE** |
| residential effect | None. `isMovementAction` is false, so `canonicalNextPosition = band.position` (verified: A1 position `tile:76:111` before and after) |
| persistent-state effect | `resourceKnowledgeState` patch memories; `probeMemory`; a `campMovement` temporary record (row 10) |
| behavioral readers | `reportedKnowledge.ts`, `campMovement.ts`, `adaptiveHuman.ts` influence families, `residentialMoveEvent.ts:434` |
| boundedness | Bounded — patch memories capped, `SCOUT_MAX_DISTANCE = 10` (`resourceScout.ts:50`) |
| **classification** | **INFORMATION-ONLY / BEHAVIORALLY REAL BUT AGGREGATED.** Real memory effect, real decision competition, **no physical execution link** |

## 2. `logistical_probe`

Identical structure to `resource_scout`: same `isProbeAction` branch in
`applyBandDecision`, same `collectProbeObservationTargets` observation, same absent
worker/route/duration/provision/receipt columns, same residence-unchanged guarantee.
Differs only in candidate family and target selection.

**Classification: INFORMATION-ONLY / BEHAVIORALLY REAL BUT AGGREGATED.**

## 3. Same-day water check

| column | value |
| --- | --- |
| selector/writer | `agents/intraSeasonTrips.ts` `getTripCause` → `runDailyActions` |
| exact selected identity | `IntraSeasonTripRecord{day, tick, cause:"water_check", targetTileId, objective}` |
| exact executed identity | The same record after `applyTripDay` |
| workers represented | `estimatedPeopleCount` |
| physical route/position | Real: `pathTiles` contiguous origin→target, `tilesCrossed`, `distanceTiles` |
| time and duration | `startDay`/`endDay`, `estimatedDurationDays`, `activityDaysRepresented` |
| provisions/labor/risk | Same-day; labour represented by the task group; no provisioning leg |
| world-truth access and why legitimate | The party is physically at the tile — legitimate presence-based perception |
| memory writer | `applyActivityOutcomeToMemoryForWorld` → `tileObservation.ts` |
| stock depletion | **NONE** — information task |
| cargo | **NONE** |
| return requirement | `returns_same_day` |
| receipt writer | **NONE** — `resourceReturn.returnedResourceKind = "none"`, `consumedByEconomy = false` |
| support reader | **NONE** |
| residential effect | `noResidentialRelocation: true` |
| persistent-state effect | Knowledge/water memory |
| behavioral readers | Water stress relief, trip cause selection |
| boundedness | `MAX_TRIP_DISTANCE_TILES`; `recentIntraSeasonTrips` capped at 24 |
| **classification** | **FULLY PHYSICAL, INFORMATION-ONLY.** Measured: 1,101 occurrences, **0** with any harvest, economy consumption or credit |

## 4. Same-day resource trip

| column | value |
| --- | --- |
| selector/writer | `intraSeasonTrips.ts` `getTripCause` / `selectTripCandidate` |
| exact selected identity | `IntraSeasonTripRecord{day, tick, cause:"food_resource_check", targetTileId, objective, resourceClassId}` |
| exact executed identity | Same record after `applyTripDay`, with `plantPatchTrace` / `animalActivityTrace` / `aquaticActivityTrace` |
| workers represented | `estimatedPeopleCount` (measured 4 in the A3 row) |
| physical route/position | Real contiguous `pathTiles` (measured `["tile:126:56","tile:125:56"]`, `tilesCrossed: 1`) |
| time and duration | Same-day; `activityDaysRepresented` |
| provisions/labor/risk | Same-day task group; no provisioning leg |
| world-truth access and why legitimate | Party physically present at the harvest tile |
| memory writer | `applyActivityOutcomeToMemoryForWorld` |
| stock depletion | **Real** — named source, e.g. `plant:tile:125:56:wetland_plant` |
| cargo | Carried home same day |
| return requirement | `returns_same_day` |
| receipt writer | `PhysicalFoodHarvestRecord` → `depositFoodReceipt` (`seasonalFoodReceipts.ts`) |
| support reader | `deriveHumanFoodSupportLedger` via `readFreshAccumulator` |
| residential effect | `noResidentialRelocation: true` |
| persistent-state effect | Stock depletion, resource memory, receipt accumulator |
| behavioral readers | Nutrition → demography; trip selection |
| boundedness | Per-trip request capped ≈0.5 of seasonal availability |
| **classification** | **FULLY PHYSICAL AND RECEIPT-CLOSED.** Measured 31,836 occurrences; arithmetic `usable = harvested − transport − processing` holds to 4-dp on every sampled row |

## 5. `distant_patch_verification`

| column | value |
| --- | --- |
| selector/writer | `agents/frontierVerification.ts` `selectVerificationCandidate` → `expedition.ts` `maybeLaunchExpedition` |
| exact selected identity | `ExpeditionRecord.id` (e.g. `expedition:band:…:frontier_verification:…`) |
| exact executed identity | Same record advanced daily through `applyExpeditionDay` |
| workers represented | `partyWorkers` (2 for fast walkers), `partyComposition` |
| physical route/position | `routeTileIds`, `positionTileId` advanced per day |
| time and duration | `departedDay`, per-day legs, `VERIFICATION_ON_SITE_DAYS` |
| provisions/labor/risk | `cargo.provisionUnitsConsumed`; `riskEpisodeIds`; workers committed and unavailable |
| world-truth access and why legitimate | Only at physical arrival |
| memory writer | `verificationEvidence.ts` upsert, **only after physical return** (`expeditionKnowledgeLatencyAudit` PASS; I12 PASS) |
| stock depletion | **NONE** in verify-only mode (`inspectionOnly: true`) |
| cargo | **NONE** |
| return requirement | Yes — a party that does not return writes nothing |
| receipt writer | **NONE** |
| support reader | **NONE** |
| residential effect | None |
| persistent-state effect | `verificationEvidence` rows, keyed by (place, question), upserted |
| behavioral readers | `isWaterAccessFeasible` gate; `taskCampRefusedByEvidence`; `resourceTestEligible` |
| boundedness | Evidence rows bounded by upsert; display ring capped |
| **classification** | **FULLY PHYSICAL, INFORMATION-ONLY.** Measured 6 occurrences |

## 6. `route_reconnaissance`

Same physical structure as row 5 (real party, route, provisions, risk, return
requirement), targeted at route rather than patch evidence. Measured 11 occurrences,
and it is the family that produced the sampled task camp (row 9).

**Classification: FULLY PHYSICAL, INFORMATION-ONLY.**

## 7. `frontier_exploration`

| column | value |
| --- | --- |
| selector/writer | `agents/frontierExploration.ts` → `expedition.ts` |
| exact selected identity | `ExpeditionRecord.id` (measured `expedition:band:dry-margin-foragers:96:frontier_exploration:742566b`) |
| exact executed identity | Same record; route discovered one 4-adjacent step at a time |
| workers represented | `partyWorkers` = 2 (measured) |
| physical route/position | `routeTileIds` length 19 (measured), stepwise |
| time and duration | `departedDay` 96 → last seen day 103 |
| provisions/labor/risk | `provisionUnitsConsumed` 0.0128 (measured); `riskEpisodeIds` |
| world-truth access and why legitimate | Party-local observations only; applied at physical return |
| memory writer | `observeTileAndNearby` at the return seam |
| stock depletion | **NONE** |
| cargo | **NONE** (information task) |
| return requirement | Yes |
| receipt writer | **NONE** |
| support reader | **NONE** |
| residential effect | None |
| persistent-state effect | `observedTiles`, corridors |
| behavioral readers | Destination/opportunity readers (CORRECTION-24: `getKnownTileStats` enumerates all retained records) |
| boundedness | `EXPEDITION_MAX_ROUTE_TILES`, suppression window |
| **classification** | **FULLY PHYSICAL, INFORMATION-ONLY.** Measured 95 occurrences |

## 8. Distant physical gathering

| column | value |
| --- | --- |
| selector/writer | `expedition.ts` retrieval candidate → `maybeLaunchExpedition` |
| exact selected identity | `ExpeditionRecord.id` with a remembered patch target |
| exact executed identity | Same record; `applyExpeditionDay` operating leg |
| workers represented | `partyWorkers`, `partyComposition` |
| physical route/position | `routeTileIds`, daily `positionTileId` |
| time and duration | Multi-day; measured 9 total days in the controlled comparison |
| provisions/labor/risk | Measured 0.0504 with camp / 0.0552 without; risk episodes recorded on the party |
| world-truth access and why legitimate | Physical presence at the patch |
| memory writer | On return |
| stock depletion | **Real** at the target patch |
| cargo | `ExpeditionCargo`, carry ceiling |
| return requirement | **Yes** — receipts are return-only |
| receipt writer | `depositFoodReceipts` on the return day |
| support reader | `deriveHumanFoodSupportLedger` |
| residential effect | None |
| persistent-state effect | Stock, memory, receipt |
| behavioral readers | Nutrition → demography |
| boundedness | Carry ceiling; route cap |
| **classification** | **FULLY PHYSICAL AND RECEIPT-CLOSED.** Measured 92 occurrences |

## 9. Expedition task camp (`ExpeditionTaskCamp`)

| column | value |
| --- | --- |
| selector/writer | `expedition.ts` `deriveTaskCampForOperating` (`:300`), attached at `:958` |
| exact selected identity | Owned by its `ExpeditionRecord.id` (measured `…:route_reconnaissance:f8787aec`) |
| exact executed identity | `{tileId, establishedDay, expiresOnDay, reason, usedDays}` — `usedDays` incremented daily at `:1146` |
| workers represented | Inherited from the owning party (measured 2) |
| physical route/position | Camp tile `tile:123:64` vs band position `tile:127:66` — physically distinct |
| time and duration | `establishedDay` 1448, bounded `expiresOnDay`, `usedDays` |
| provisions/labor/risk | Real setup cost; saves nightly shuttle |
| world-truth access | Via the owning party's presence |
| memory writer | None of its own |
| stock depletion | None of its own |
| cargo | None of its own |
| return requirement | Expires with its expedition |
| receipt writer | **NONE** — `campCreatesNoFood_16: true`; delivery identical with and without (0.0513 both) |
| support reader | **NONE** |
| residential effect | `noResidentialRelocation: true`; `noResidentialPositionMutation_16: true` |
| persistent-state effect | **NONE beyond its party** — `noStorage`, `noTerritoryClaim` |
| behavioral readers | `expedition.ts` lifecycle; `pendingOperation.ts:109`; `frontierVerification.ts:661` |
| boundedness | Bounded lifetime, expires with the expedition |
| **classification** | **FULLY PHYSICAL, BEHAVIORALLY REAL.** Measured 103 occurrences |

## 10. `campMovement` `TemporaryTaskCampRecord`

| column | value |
| --- | --- |
| selector/writer | `agents/campMovement.ts:366` — written when a **seasonal** decision is `logistical_probe` or `resource_scout` and the band did **not** move |
| exact selected identity | `temporary-task-camp:<bandId>:<tick>:<tileId>` (measured `…:band:dry-margin-foragers:2:tile:115:39`) |
| exact executed identity | **NONE** — no execution seam exists |
| workers represented | **NONE** |
| physical route/position | **NONE** — carries `originTileId`/`targetTileId` only |
| time and duration | Seasonal `tick`, `expiresAfterTick` — no days, no occupancy |
| provisions/labor/risk | **NONE** |
| world-truth access | **NONE** |
| memory writer | **NONE** — it *is* an evidence record (`confidence`, `evidenceRefs`) |
| stock depletion | **NONE** |
| cargo | **NONE** |
| return requirement | **NONE** |
| receipt writer | **NONE** |
| support reader | **NONE** |
| residential effect | None (`noSettlement`, `noInventory`) |
| persistent-state effect | Bounded record on `band.campMovement` |
| behavioral readers | **NONE.** Only `ui/band/CampMovement.tsx`, `ui/band/Technical.tsx`, `agents/eventSystem.ts:637`, `agents/publicHumanStory.ts:510`, plus its own writer/invariants |
| boundedness | `TEMPORARY_CAMP_CAP`, `EVIDENCE_PER_ITEM_CAP` |
| **classification** | **HISTORICAL / STORY PROJECTION.** Not a physical authority and not a behavioural one |

**A2 join result (measured, 3+ records):** `joinExpeditionId`, `joinPartyWorkers`,
`joinRouteTileIds`, `joinPhysicalOccupancyDay`, `joinTaskWork`, `joinReceiptId` are
**all `null`**. There is no shared column with `ExpeditionTaskCamp` except a target
tile id.

## 11. Frontier-verification `temporary_use` question

| column | value |
| --- | --- |
| selector/writer | `frontierVerification.ts:661` gate, reading `taskCampRefusedByEvidence` |
| exact selected identity | Would be an `ExpeditionRecord` of kind `frontier_verification` |
| exact executed identity | **NONE OBSERVED — 0 production launches** |
| all physical columns | **N/A — the family does not launch** |
| memory writer | `verificationEvidence` (dormant for this question) |
| behavioral readers | `taskCampRefusedByEvidence` → `expedition.ts:330` bounded task camp, negative branch only |
| boundedness | N/A |
| **classification** | **DORMANT BY STRUCTURAL ORDERING — NOT DISCONNECTED.** See FINDINGS §5 |

## 12. Returned physical food receipt

| column | value |
| --- | --- |
| selector/writer | `seasonalFoodReceipts.ts` `depositFoodReceipt` — **the only writer** of `Band.seasonalFoodReceipts` |
| exact selected identity | `PhysicalFoodHarvestRecord` inside an `IntraSeasonTripRecord`, bound to `record.tick` |
| exact executed identity | Accumulator `{periodTick, receiptCount, …, totalUsableSupport}` |
| admission predicate | `isCreditedFoodReceipt`: harvest present **and** `resourceReturn` present **and** `consumedByEconomy === true` **and** `isPhysicalFoodReturnKind` **and** `usableSupport > 0` |
| deposit-once | `depositFoodReceipts` folds each record exactly once; older-period deposits are ignored |
| freshness | `readFreshAccumulator`: `periodTick === currentTick − 1`. A zero-harvest season leaves the period stale, so support reads exactly 0 |
| support reader | `deriveHumanFoodSupportLedger` — reads the accumulator and nothing else |
| explicit zeros | `storageContribution: 0`, `transitionalResidual: 0`, `spoilageLoss: 0`, `accessLoss: 0`, `genericCatchmentFoodConsumed: false` |
| boundedness | Running sums O(1); `topReceipts` capped at 16, display-only |
| **classification** | **FULLY PHYSICAL AND CLOSED.** Measured 8,850 receipts |
