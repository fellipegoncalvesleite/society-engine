# CORRECTION-34 — AUTHORITY LEDGER

| Authority | Physical location | People represented | Duration | Temporal resolution | Direct physical truth | Band-known | Ecological consumers | Social consumers | Release | Terminal cleanup | Bounded |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `band.position` | residence | — | until the band moves | seasonal decision | yes | yes (own) | catchment, depletion | crowding, encounters | on move | with the band | yes |
| `demography.population` | none (a count) | whole band | continuous | seasonal | yes | own | catchment draw | crowding weight | — | — | yes |
| **`getBandPhysicalPresence` (NEW)** | residence **and** each away party's `positionTileId` | residential remainder + party workers, summing to `population` | one evaluation (pure fn) | **daily-accurate, evaluated wherever it is called** | **yes** | own only | physical crowding field | **none** | phase leaves the away set | terminal phases contribute nothing | 1 + active-expedition cap |
| `ExpeditionRecord.positionTileId` | real party position | `partyWorkers` | across days | daily | yes | own | provisions, target harvest | none | phase change | terminal phases | yes |
| `ExpeditionRecord.taskCamp` | operating base | party | operation | daily | yes | own | none | none | expires with the operation | yes | yes |
| `getCommittedExpeditionWorkers` | none (labour) | away workers | while away (**incl. `prepared`**) | seasonal | labour truth, not location | own | local work capacity | none | on return | yes | yes |
| `IntraSeasonTripRecord` | target + `pathTiles` | `estimatedPeopleCount` | one day | **daily, but HISTORY once written** | yes when it happened | own | depletion, harvest receipts | none | n/a — it is a record | ring-bounded | yes (24-slot ring) |
| `SharedCatchmentIndex` / `getBandForagingFootprint` | residence-anchored ball | `getBandForagingDraw` = **full** `workingAdults` + dependents + elders | season | seasonal | acquisition model, **not** body density | own | support share, per-capita return | none | on move | with the band | yes |
| `CrowdingField` | union of presence balls | via presence weights | tick | seasonal cache, daily-accurate inputs | yes | no (derived) | range saturation | decision score | rebuilt each tick | excludes terminal bands | per-tile contributor list |
| `BandEncounterRecord` / `RangeFrictionEvent` / `ProtoAccessMemory` | remembered places | — | lifecycle | seasonal | no — evidence | yes | none | access risk, tension | CORRECTION-31 | yes | yes |

## Duplication risks

| Risk | Status |
| --- | --- |
| away workers weighted at home **and** nowhere else | **REPAIRED** — 505 worker-days → 0 ghosted, 0 missing |
| a band reading its own away party as foreign crowding | **NOT PRESENT** — one weight per band per tile, existing self-exclusion applies (P12: 0 cases) |
| terminal expedition records holding presence | **NOT PRESENT** — terminal phases contribute no source |
| completed trip records becoming current presence | **STRUCTURALLY IMPOSSIBLE** — `getBandPhysicalPresence` contains no reference to `recentIntraSeasonTrips` |
| **away workers drawing the residential catchment while also provisioned and harvesting away** | **MEASURED, NOT REPAIRED** — 226 band-seasons. `getBandForagingDraw` uses full `workingAdults`. Named as the next seam; §11.7 forbids rewriting the catchment without a food-pipeline proof |
| same-day parties invisible to shared range | **MEASURED, DEFERRED** — needs the Option-E daily ledger |

---

## CORRECTION-34A amendment

| Authority | Status after CORRECTION-34A |
| --- | --- |
| same-day parties invisible to shared range | **FORMALLY DEFERRED — non-actionable, not merely unbuilt.** No within-day consumer of physical presence exists in production, so an Option-E ledger would have no reader. Removed from CORRECTION-34's acceptance requirements by supervisor amendment. See `SAME_DAY_PRESENCE_SEAM.md`. |
| person conservation across a party's absence | **REPAIRED** — `reconcileExpeditionCommitment` (daily, inside `expeditionDailyAction`) shrinks or loses a party the band can no longer staff. `getBandCommitmentAccounting` exports the invariant. The launch authority was already sound *at the launch instant*; the hole was that `demography.ts` / `viability.ts` / `demographicRenewal.ts` contain zero expedition references and `partyWorkers` is write-once. |
| residential catchment extraction effort | **REPAIRED** — `getBandForagingDraw` counts adults physically at camp (`deriveCommittedMobilityPools`, the same authority `deriveAvailableMobilityPools` uses). Weights not retuned. |
| consumption demand | **UNCHANGED AND SEPARATE** — `carryingCapacity.derivePopulationDemand` still counts the whole band, because an away worker still eats. |
| `getBandPhysicalPresence` conservation guarantee | **DOCUMENTATION CORRECTED** — it is not self-conserving. The sum equals `population` only for VALID canonical expedition state; validity is maintained upstream by the daily reconciliation, which covers every band-day the daily kernel produces but not a band object assembled directly by a test or future caller. |
| expedition lifecycle observation | **INSTRUMENT REPAIRED** — daily sampling is canonical; the seasonal arm is retained as the counter-example. |
