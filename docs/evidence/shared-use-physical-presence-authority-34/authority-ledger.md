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

---

## CORRECTION-34B amendment

| Authority | Status |
| --- | --- |
| party size | **ONE AUTHORITY.** `partyWorkers`, `partyComposition`, `cargo.carryCapacityUnits` and cargo are reconciled together by `reconcileExpeditionCommitment`. Previously `partyWorkers` moved alone. |
| committed-worker totals | **AGREE.** `getCommittedExpeditionWorkers(band) === partyCompositionTotal(deriveCommittedMobilityPools(band))` on every band-day; 0 mismatches in 162,000 band-days at 50 y. |
| residential catchment effort | **AGREES WITH PARTY SIZE.** Effort adults = `workingAdults − committed`; the previous split produced **−1**. |
| carry ceiling | **FOLLOWS WORKERS.** Recomputed from the reduced party and wrapped in `Math.min`, so reconciliation can never raise it. Excess cargo is abandoned, `harvest + lost` invariant. |
| travel pace | **NEVER IMPROVES ON LOSS.** Removal order high → typical → limited. |
| `prepared` termination | **NOT A DEATH.** `aborted` + `commitment_unsupported`; only away parties below the minimum are `lost`. |
| `getBandPhysicalPresence` documentation | **CONTRADICTION REMOVED.** The file no longer says both "CONSERVES PEOPLE" and "NOT self-conserving"; it reports canonical state, conservation depends on upstream validity, and it never silently resizes a party. |
| provisions | **TRIP-LOCAL ACCOUNTING ABSTRACTION, not a conserved store.** Stated explicitly; full material conservation is not claimed for provisions. |

---

## CORRECTION-34C amendment

| Authority | Status |
| --- | --- |
| physical party headcount | **BOUNDED BY POPULATION (bodies).** Previously bounded by `workingAdults`, which made cohort aging delete a distant body. |
| productive working-adult labour | `getResidentialWorkingAdults`, clamped at 0. Unchanged and correct. |
| demographic cohort identity | `demography.ts`. Changes classification ONLY — never location. |
| fission founders | **PHYSICALLY RESIDENTIAL PEOPLE ONLY.** `min(getDaughterPopulation(total), population − awayPartyPeople)`, blocked below `DAUGHTER_MIN_POPULATION`. |
| residential catchment effort | Aged-away overflow now removed from **elders** as well as adults, so an away person who aged contributes no local effort. |
| `getBandCommitmentAccounting.conserved` | Tests **bodies** (`committed <= population`). `awayHeadcountExceedsWorkingAdults` reported separately — it is legitimate. |
| `reconcileExpeditionCommitment` | **DEFENSIVE REPAIR for corrupt/legacy state.** Cannot fire on ordinary demography; claims no physical mechanism. |
| party-local loss | Requires a party-local physical outcome. Never inferred from cohort aging. |

---

## CORRECTION-34D — the two party quantities

`partyWorkers` appears twice in the table above, once as a body count and once as labour. It is now
**labour only**, and the rows are corrected here rather than edited in place so the change is
visible.

| Authority | Question it answers | Reads | Consumers |
| --- | --- | --- | --- |
| `getExpeditionPhysicalPeople` (bandMobility) | how many bodies are in this party | `partyWorkers + nonWorkingPartyPeople` | presence, conservation, provisions, fission |
| `derivePhysicallyAwayPartyPeople` (bandMobility) | how many bodies are elsewhere | away phases only — **`prepared` excluded** | population conservation, fission founder draw |
| `derivePreparedCommitmentPartyPeople` (bandMobility) | who is here but already spoken for | `prepared` phase only | fission founder availability, named separately |
| `getExpeditionProductiveWorkers` (bandMobility) | how much work can this party do | `partyWorkers` | composition, pace, carrying, target work |
| `getCommittedExpeditionWorkers` (expedition) | how much of the band's labour is spoken for | `partyWorkers` over all committed phases **incl. `prepared`** | `getResidentialWorkingAdults`, catchment adult term |
| `getCommittedExpeditionPeople` (expedition) | how many bodies are away | `derivePhysicallyAwayPartyPeople` | conservation |
| `ExpeditionRecord.nonWorkingPartyPeople` | bodies present that supply no labour | stored, bounded, monotone while away | catchment elder term, provisions, pace |

### Consumers, corrected

| Consumer | Was | Now |
| --- | --- | --- |
| `getBandPhysicalPresence` | `partyWorkers` | **physical people** |
| `consumeProvisions`, `provisionsExhausted`, task-camp setup, campless shuttle, `acuteRisk` budget | `partyWorkers` | **physical people** — everyone eats |
| `deriveCarryCapacityUnits` | `partyWorkers` | unchanged — **productive workers**, zero for a non-working member |
| `deriveTravelPace` / `derivePartyPaceFactor` | composition only | composition **plus** non-working members at the existing limited-walker penalty |
| `createDaughterBand` | `partyCompositionTotal(deriveCommittedMobilityPools)` — counted `prepared` as away | **physically away** + separately named **prepared commitment** |
| `getBandForagingDraw` | adults − committed; elders − *inferred* overflow | adults − away workers; elders − **recorded** non-working |
| `getBandCommitmentAccounting.conserved` | committed workers ≤ population | **physically away people ≤ population** (+ new `laborBounded`) |
| `estimateTaskGroupPeople`, pending-investigation labour | `partyWorkers` | unchanged — labour questions against a labour cohort |
| `ExpeditionOutcomeSummary` | `partyWorkers` for human-facing counts | new `partyPeople`; events read `partyPeople ?? partyWorkers` |

### Duplication risks — updated

| Risk | Status |
| --- | --- |
| **away workers drawing the residential catchment while also provisioned and harvesting away** | **REPAIRED by CORRECTION-34A**, and its elder term is now read rather than inferred |
| a party granted more labour than the band's whole working-adult cohort | **REPAIRED** — `laborBounded`, measured every band-day |
| a non-working body vanishing from the map | **REPAIRED** — presence counts people |
| a non-working body eating for free | **REPAIRED** — consumption counts people |
| a non-working body granting carrying or work | **NOT PRESENT** — both read productive workers |
| prepared people counted as physically distant | **REPAIRED** — separate authority, separate name |
| a defensive repair read as a physical history | **NOT PRESENT** — `invalid_state_repaired`, never narrated |

---

## CORRECTION-34E amendment — target work

### A correction to the CORRECTION-34D row above

The 34D row for `getExpeditionProductiveWorkers` listed its consumers as
"composition, pace, carrying, **target work**". **The last of those was not true when it was
written.** Nothing in CORRECTION-34D touched target work; `resolveExpeditionTargetWork` still handed
the whole band to `buildTripRecord`, which sized the working group from
`estimateTaskGroupPeople(band)` — the residential cohort. The row is corrected here rather than
quietly amended in place.

### Authority, after CORRECTION-34E

| Question | Authority | Reads |
| --- | --- | --- |
| how many people are working at THIS TARGET, right now | `options.partyWorkers` on `resolveExpeditionTargetWork`, supplied as `getExpeditionProductiveWorkers(expedition)` | the party's own productive labour |
| how many people are working at the RESIDENCE today | `estimateTaskGroupPeople(band, taskGroupType)` | residential working adults minus committed party workers, capped by a task share, floored at 1 |

The parameter is **required and has no default**, so a caller that cannot say who is working cannot
resolve work. The ordering `same-day ≠ expedition` is therefore structural, not a convention.

### Consumers reached by the one corrected variable

`estimatedPeopleCount` is a single term inside `buildTripRecord`, so all of these follow from it and
none needed separate wiring:

| Consumer | Effect |
| --- | --- |
| `deriveResourceReturnRecord` | the requested target amount (`estimatedPeopleCount * 0.035 + ...`) |
| activity-outcome classification | `target_found` vs `partial_success` |
| `resolvePhysicalFoodHarvest` → `resolvePlantFoodHarvest` / `resolveFaunaFoodHarvest` | **the amount actually removed from world stock** |
| `estimateFaunaTripPressureIntensity` | fauna pressure |
| shadow subsistence record | the labour it describes |
| `IntraSeasonTripRecord.estimatedPeopleCount` | the recorded labour provenance |
| expedition cargo | via `usableSupport`, unchanged in its own equation |

### Duplication risks — updated again

| Risk | Status |
| --- | --- |
| **distant work scaled by workers who stayed home** | **REPAIRED** — measured 4.1× before (0.0086 vs 0.0354 removed by the same five-person party), invariant after |
| **a party inert at its own target** | **REPAIRED** — 2 vs 5 workers read 2 vs 2 before, 2 vs 5 after |
| a party silently floored to one person's work | **REPAIRED** — no floor on the party branch (T6) |
| a non-working body granting target work | **NOT PRESENT** — target work reads productive workers (T4) |
| a verification party depleting stock | **NOT PRESENT** — `verifyOnly` suppresses the take; 0 events in 50 y (T8) |
| the same-day path losing its residential authority | **NOT PRESENT** — it passes no party context; same-day records byte-identical across trees over the comparable window (T7) |
| two concurrent parties reading each other or their sum | **NOT PRESENT** — each reads its own record (T12) |
