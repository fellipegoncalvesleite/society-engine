# CORRECTION-24A §7 — ORDINARY FRONTIER EXPLORATION: THE COMPLETE PRODUCTION AUTHORITY

Read from production code, not from names or comments. Every row was traced by following the call
chain from the scheduler entry point to the physical consequence.

| # | Function | File | Inputs | Authority owned | Possible refusal | Downstream reader | Physical consequence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `maybeLaunchExpedition` | `agents/expedition.ts:1844` | band expeditions, received smoke signals, day | **The slot.** One expedition decision per band per opportunity | `ACTIVE_CAP_FULL` (≥2 away), off-cadence (day % 6 ≠ 0 and no signal prompt), `partyWorkers < 2` | — | No party raised at all |
| 2 | `deriveDepartableWorkers` | `agents/expedition.ts:1306` | band cohorts, away parties | Departable labour | `< 2` ends the whole decision | party sizing | Nobody can leave camp |
| 3 | `selectExpeditionTripCandidate` | `agents/intraSeasonTrips.ts` | patch memories, confidence, distance | The retrieval candidate | no candidate | `noUsefulRetrieval` | — |
| 4 | `isDistantRetrievalWorthwhile` | `agents/expedition.ts:1380` | memory value, food stress, workers | Whether retrieval is worth it | not worthwhile ⇒ `noUsefulRetrieval` | family ordering | — |
| 5 | `selectVerificationCandidate` | `agents/expedition.ts` | stale patch memories | The patch-verification candidate | no candidate | family ordering | **Claims the slot ahead of exploration** |
| 6 | `selectReconnaissanceCandidate` | `agents/expedition.ts` | weak route evidence | The reconnaissance candidate | no candidate | family ordering | **Claims the slot ahead of exploration** |
| 7 | *the ordering gate* | `agents/expedition.ts:1960` | `noUsefulRetrieval`, `verification`, `reconnaissance` | **Whether exploration is offered the slot at all** | any of the three present ⇒ exploration is never called | — | Exploration gets no hearing |
| 8 | `maybeLaunchFrontierExploration` | `agents/expedition.ts:1740` | `lastFrontierExplorationTick`, tick, workers | The exploration launch | `ALREADY_EXPLORING` (≤12 ticks), `partyWorkers < 2` | — | No exploration party |
| 9 | `deriveFrontierExplorationEligibility` | `agents/frontierExploration.ts:119` | range saturation, return trend, dispersal pressure, known opportunity, food stress, frontier intent | **Motive.** `evidenceScore × willingness ≥ 0.5` | `NO_MOTIVE` | the launcher | No party |
| 10 | `deriveFrontierHeading` | `agents/frontierExploration.ts:219` | corridor memory, frontier intent, viewshed cues, known edge, second-hand records | **Direction (never destination).** Five-branch precedence | `NO_HEADING` when all five are empty | `buildFrontierPlan` | No party |
| 11 | `deriveAvailableMobilityPools` / `selectPartyComposition` | `agents/expedition.ts` | present adults by mobility role | Party composition | `INSUFFICIENT_LABOR` | `createPreparedExpedition` | No party |
| 12 | `buildFrontierPlan` | `agents/frontierExploration.ts:316` | heading, basis, anchor, budgets | The carried plan | — | the walk | Party carries a direction |
| 13 | `createPreparedExpedition` / `attachExpedition` | `agents/expedition.ts:456/494` | band, plan, day | The party record; stamps `lastFrontierExplorationTick` | `EXPEDITION_ACTIVE_CAP` | lifecycle | Workers committed |
| 14 | `chooseNextFrontierStep` | `agents/frontierExploration.ts:361` | current position, heading, passability, **band knowledge only** | One 4-adjacent physical step | no passable step | the walk | Party physically moves |
| 15 | `deriveOutwardTilesRemaining` | `agents/frontierExploration.ts:452` | budget, reserve, provisions | Return reserve, re-derived every step | forces turn-around | the walk | Party turns for home |
| 16 | `buildFrontierCountryObservation` / `retainFrontierObservations` | `agents/frontierExploration.ts:541/496` | tiles physically entered | **Party-local** observations, capped at 12 | — | return transfer | Nothing reaches the band yet |
| 17 | *return transfer* | `agents/expedition.ts` (`returnedFrontierRouteTiles`) | party arrives home | Hand-off to band knowledge | **a lost party transfers nothing** | `observeTileAndNearby` | Knowledge enters the band |
| 18 | `observeTileAndNearby` | `agents/tileObservation.ts` | observed tiles, acquisition kind | **The canonical knowledge writer** | — | all knowledge readers | `KnownTileRecord` created/refreshed |
| 19 | `compressBandMemoryState` | `agents/memoryCompression.ts` | 72-record capacity, mandatory set | **Retention.** Runs once per year | evicts | — | Records disappear |
| 20 | `collectOpportunityCandidates` / `deriveKnownUnusedHabitat` | `agents/carryingCapacity.ts` | known tiles incl. frontier-derived | Destination candidacy | viability/score | movement, fission | Residential move / daughter |

## Constants that bound the whole family

| Constant | Value | File | Effect |
| --- | --- | --- | --- |
| `EXPEDITION_LAUNCH_CADENCE_DAYS` | 6 | `expedition.ts:1298` | The scheduler runs one day in six |
| `EXPEDITION_ACTIVE_CAP` | 2 | `expedition.ts:129` | Concurrent away parties per band |
| `FRONTIER_EXPLORATION_SUPPRESSION_TICKS` | **12** | `expedition.ts` | **12 ticks = 12 seasons = 3 YEARS between exploration launches**, stamped when the party is RAISED, not when it returns |
| `FRONTIER_ELIGIBILITY_THRESHOLD` | 0.5 | `frontierExploration.ts:78` | Motive gate on `evidenceScore × willingness` |
| `FRONTIER_OBSERVATION_CAP` | 12 | `frontierExploration.ts:71` | Party-local observations carried home |
| `MAX_EXACT_KNOWN_TILES` | 72 | `memoryCompression.ts` | Retention capacity (CORRECTION-23E debt) |

## The two authorities that actually bind

Rows **7** and **8** are where ordinary exploration is lost, and neither is about motive, direction,
labour or terrain:

* **Row 8 — the 3-year suppression window** accounts for **89.1%** of all opportunities.
* **Row 7 — the ordering gate** accounts for **8.6%**, and in *every one* of those 23,852 cases
  exploration was never offered the slot at all (0 offered-and-refused). The claiming family then
  launched nothing.

Rows 9–11 — motive, heading and labour — refuse almost nothing: eligibility is 99.4% on nine of
eleven worlds, heading availability is **1.000 everywhere**, and `INSUFFICIENT_LABOR` is **0**.
