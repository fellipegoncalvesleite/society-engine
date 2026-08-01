# CLOSURE-25 — resource investigation / temporary use authority closure

Diagnostic and documentary. No production behaviour is changed, no repair is made,
and no new subsystem is added. `src/sim` is tree-identical to
`ce723b3f1973e4f3f2c54a424a614e723a14558a`.

## Verdict

```text
PROGRESS — AUTHORITY MAP COMPLETE / ONE OR MORE EXACT PHYSICAL OR
BEHAVIORAL SEAMS REMAIN MISSING / MINIMUM CORRECTION IDENTIFIED /
ROADMAP DOES NOT ADVANCE
```

Eleven of the twelve action families are fully closed. One — the seasonal
`resource_scout` / `logistical_probe` pair — reaches ten tiles and updates
resource belief with **no physical execution identity of any kind**. That is the
single missing seam, it is stated exactly below, and it is deliberately **not**
repaired here.

## 1. The chain, link by link

```text
resource uncertainty or opportunity   fully physical (VOI over the band's own bounded patch memories)
→ investigation decision              fully physical (two competing authorities, §2)
→ exact target                        fully physical
→ workers physically leave            SPLIT — real for trips/expeditions, MISSING for scout/probe
→ route, time, provisions, risk       SPLIT — same split
→ physical observation or use         SPLIT — same split
→ return, failure or loss             fully physical where a party exists; N/A where none does
→ memory update                       fully physical (canonical writers, return-gated for parties)
→ physical receipt                    fully physical and closed
→ later behavioral consequence        fully physical
```

## 2. Two investigation authorities exist at the same range, with different fidelity

This is the central structural finding, and it is not visible from either module
alone.

| | seasonal `resource_scout` | same-day information trip |
| --- | --- | --- |
| cadence | seasonal decision | daily action |
| max range | `SCOUT_MAX_DISTANCE = 10` | `MAX_TRIP_DISTANCE_TILES = 10` |
| workers | **none** | `estimatedPeopleCount` |
| route | **none** — target + 1-ring | contiguous `pathTiles` |
| duration | **none** | `startDay`/`endDay`, `activityDaysRepresented` |
| provisions / risk | **none charged** | task-group labour |
| feasibility failure | cannot fail physically | `route_time_infeasible` is a real outcome |
| memory writer | `updateResourceKnowledgeFromObservation` | `applyActivityOutcomeToMemoryForWorld` |
| receipt | none (by design) | none (information task, by design) |

Both are legitimate designs in isolation. Together they mean **the same physical
question — "go look at that patch ten tiles away" — is answered by two authorities,
only one of which can physically fail.**

## 3. The missing seam, stated exactly

**Writer.** `rules/candidates/resourceScoutCandidate.ts` `buildResourceScoutCandidate`
produces `Action{type:"resource_scout", originTileId, targetTileId, scoutKind,
targetResourceClass}`.

**Reader.** `rules/bandDecision.ts` `applyBandDecision` classifies it as
`isProbeAction`, so `canonicalNextPosition = band.position` (residence unchanged),
then `collectProbeObservationTargets` (`bandDecision.ts:5539`) returns the target
tile at distance 1 and each of its neighbours at distance 2. That set goes to the
canonical `observeTileAndNearby`, and `applyResourceScoutObservation`
(`bandDecision.ts:3108`) folds the result into `resourceKnowledgeState`.

**Physical consequence.** A band standing at `tile:76:111` acquires and *revises*
belief about a patch up to ten tiles away without any worker leaving, any tile
between origin and target being crossed, any day elapsing, any provision being
consumed, or any risk being taken. Measured directly (A1):

```text
decision:band:varied-dry-corridor-mid:1   resource_scout   tile:76:111 → tile:77:111
position before / after      tile:76:111 / tile:76:111        (residence unchanged)
resource memory changed      true
  presenceConfidence         0.54 → 0.52
  yieldConfidence            0.28 → 0.22
matching expedition          null
same-tick trips to target    0
route physically traversed   false
provisions / risk charged    false / false
physical receipt             null
```

The belief update is real and it is *corrective* — the observation lowered an
over-optimistic estimate. The information is not free in score terms
(`laborCost` and `movementCost` are subtracted), but it is free in physical terms:
`resourceScout.ts:419` computes `laborCost` as a normalized
`clamp01(0.2 + distance/10*0.5 + (1-capacity)*0.3)` that feeds scoring only and
debits no labour pool.

**Minimum sufficient repair — identified, NOT applied.** Route the executed
`resource_scout` through the authority that already models this exact physical act:
emit a `logistical` / information `IntraSeasonTripRecord` from the existing
`intraSeasonTrips` machinery instead of observing directly from the seasonal
applier. That reuses `pathTiles`, `estimatedPeopleCount`, `activityDaysRepresented`
and the existing `route_time_infeasible` failure mode, and adds **no** new
subsystem, class, or state. It would change production behaviour — a scout could
then physically fail — so it belongs to a separate authorized checkpoint.

**What is explicitly NOT claimed.** This is not an anti-omniscience violation. The
scout writes through the canonical observation writer and reads band-known records;
`frontierAntiOmniscienceAudit` passes. The defect is *physical representation*, not
hidden-truth leakage.

## 4. The two temporary-camp representations do not conflict

Gate 3 resolves as **clearly different, non-conflicting roles**, proven by readers
rather than by shape.

| | `campMovement.TemporaryTaskCampRecord` | `ExpeditionTaskCamp` |
| --- | --- | --- |
| written by | `campMovement.ts:366`, from a seasonal probe/scout decision when the band did **not** move | `expedition.ts:300` `deriveTaskCampForOperating`, attached at `:958` |
| granularity | seasonal tick | day |
| owner | the band | one `ExpeditionRecord` |
| carries | `purpose`, `confidence`, `evidenceRefs`, `expiresAfterTick` | `establishedDay`, `expiresOnDay`, `reason`, `usedDays` |
| simulation-behavioural readers | **NONE** | `expedition.ts` lifecycle, `pendingOperation.ts:109`, `frontierVerification.ts:661` |
| other readers | `ui/band/CampMovement.tsx`, `ui/band/Technical.tsx`, `eventSystem.ts:637`, `publicHumanStory.ts:510` | `ui/band/Mobility.tsx` |

The A2 join fails on every physical column — `joinExpeditionId`,
`joinPartyWorkers`, `joinRouteTileIds`, `joinPhysicalOccupancyDay`, `joinTaskWork`,
`joinReceiptId` are all `null` — which is the expected result for a record that was
never a physical authority. **Neither reads the other, so no behavioural conflict
exists.** They share a word, not a role.

The record is nonetheless **misleadingly named**: "temporary task camp" describes a
physical act it never performs. Recorded as a naming hazard for human review; not
renamed here, per the diagnostic-only rule.

## 5. `temporary_use` is dormant by ordering, and that zero is correct

Measured: **0 production launches** across 20 years × 3 worlds. This reproduces the
accepted prior expectation and is **not** repaired.

The ordering proof is arithmetic, not statistical. `maybeLaunchExpedition` selects
and launches in one call, so there is no interval in which an operation is selected
but not yet launched. A task camp is decided `legDays` after departure; a
verification answer needs `2 × legDays + VERIFICATION_ON_SITE_DAYS`. The second is
greater than the first for every leg length, so an answer can never arrive before
the camp decision it is supposed to inform. `pendingOperationFixturesAudit` J8
states exactly this and passes, and J11 states the consequence — with no exact
consumption seam, production launches are zero.

Reactivating it to manufacture launches was explicitly out of scope and was not done.

## 6. Receipts are closed

`deriveHumanFoodSupportLedger` reads `readFreshAccumulator(band.seasonalFoodReceipts,
currentTick)` **and nothing else**. `storageContribution`, `transitionalResidual`,
`spoilageLoss` and `accessLoss` are hard zeros and `genericCatchmentFoodConsumed`
is `false`.

Admission requires all five of: a `PhysicalFoodHarvestRecord`, a `resourceReturn`,
`consumedByEconomy === true`, a physical food return kind, and `usableSupport > 0`.
Freshness requires `periodTick === currentTick − 1`, so a zero-harvest season reads
exactly zero and old receipts cannot feed later seasons.

Verified on natural data: 31,836 food trips produced 8,850 credited receipts;
`usable = harvested − transport − processing` holds to 4-decimal rounding on every
sampled row; and **0 of 1,101 information-only trips** carried any harvest, economy
consumption, or credit. `recoveryFoodAccountingAudit` confirms
`sameDayCredited`, `expeditionCredited`, `bothCountedOnce`, `nonFoodRejected`,
`newHarvestResetsPeriod` and `ledgerReadsAccumulatorNotWindow` all true.

## 7. Task camps cost and save exactly what they claim

`taskCampComparisonAudit`, same site (`tile:135:55`, 13 route tiles):

| | delivered | provisions | km walked | days |
| --- | ---: | ---: | ---: | ---: |
| with camp | 0.0513 | 0.0504 | 36 | 9 |
| without camp | 0.0513 | 0.0552 | 54 | 9 |

Delivery is **identical**, so the camp creates no food. It saves 18 km of nightly
shuttle and 0.0048 provisions, and pays a real setup cost. `campClaimsNothing_16`,
`noResidentialPositionMutation_16`, `campExpiresWithItsExpedition_16` all true.

## 8. Natural occurrence

20 years, `map1` / `map2` / `ordinary`, one shared seed. Every required event kind
occurred at this minimum scope, so **no expansion was used**.

| family | count | | family | count |
| --- | ---: | --- | --- | ---: |
| same-day resource trip | 31,836 | | frontier exploration | 95 |
| returned physical food receipt | 8,850 | | distant physical gathering | 92 |
| same-day water check | 1,101 | | camp-movement temporary record | 129 |
| logistical probe | 78 | | expedition task camp | 103 |
| resource scout | 51 | | distant patch verification | 6 |
| route reconnaissance | 11 | | temporary-use verification | **0** |

## 9. What was deliberately not done

No resource class, ecology, settlement, persistent camp, storage, ownership,
territory, agriculture, crowding, daughter viability, seasonal migration, culture,
religion or exploration-capacity change. No planned-operation queue — the evidence
does not show a behavioural requirement that the existing same-day and expedition
authorities cannot represent; the one missing seam is representable inside
`intraSeasonTrips` as described in §3. `temporary_use` was not reactivated. The
`resource_scout` seam was identified and left unrepaired for human review.
