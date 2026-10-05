# ROADMAP ITEM 3 — INTEGRATED AUTHORITY MAP

One quantity → one canonical writer → explicit readers → no parallel hidden authority.

Everything below was read from current production, not from a prior report.

---

## 1. Physical presence

| Quantity | Canonical writer | Readers | Notes |
| --- | --- | --- | --- |
| residential remainder | `crowding.getBandPhysicalPresence` (derived, pure) | `buildCrowdingField`, `computeCrowdingContribDescriptor` | `population − physically-away people`, clamped at 0 |
| prepared party people | `bandMobility.derivePreparedCommitmentPartyPeople` | fission founder availability, `getBandCommitmentAccounting` | **NOT away.** Prepared people stand at the residence and are inside the residential remainder |
| outbound / operating / returning people | `bandMobility.getExpeditionPhysicalPeople` = `partyWorkers + nonWorkingPartyPeople` | presence, provisions, task-camp setup, campless shuttle, `acuteRisk` share | one body group per party at its own `positionTileId` |
| task-camp people | the party's own record (`ExpeditionRecord.taskCamp`) | task-camp lifecycle | a camp holds no separate body count; the party is the bodies |
| terminal expedition records | `expedition` phase transitions | nothing | `completed`/`aborted`/`lost` contribute **no** presence source |
| physical conservation | `expedition.getBandCommitmentAccounting.conserved` | audits, fission cap | `physically-away people ≤ population` |

`getBandPhysicalPresence` is explicitly **not self-conserving**: it renders the expedition state it
is handed. Validity is maintained upstream by `reconcileExpeditionCommitment`, daily.

## 2. Productive labour

| Quantity | Canonical writer | Readers | Notes |
| --- | --- | --- | --- |
| residential working labour | `expedition.getResidentialWorkingAdults` | same-day task groups, launch gate, catchment effort | `workingAdults − committed away workers` |
| committed expedition labour | `expedition.getCommittedExpeditionWorkers` | `getResidentialWorkingAdults`, `laborBounded` | includes `prepared` — labour is committed before departure |
| non-working party members | `ExpeditionRecord.nonWorkingPartyPeople` (stored) | physical headcount, provisions, pace | grants **no** work and **no** carrying |
| mobility composition | `bandMobility.deriveCommittedMobilityPools` / `selectPartyComposition` | pace, party formation | |
| carry capacity | `expedition.deriveCarryCapacityUnits` | cargo ceiling, abandonment | **productive workers only** |
| **target work** | `options.partyWorkers` on `intraSeasonTrips.resolveExpeditionTargetWork`, supplied as `getExpeditionProductiveWorkers` | the record's `estimatedPeopleCount`, and through it the request, outcome class, depletion, fauna pressure, shadow record | **required, positive integer, no default, no fallback, no rounding** |
| provisions | `expedition.consumeProvisions` | cargo | charged on **bodies**, because everyone eats |

The one distinction Item 3 exists to hold: **a same-day residential task group is not a multi-day
expedition party.** `estimateTaskGroupPeople` answers the first; `options.partyWorkers` answers the
second; neither is consulted for the other.

## 3. Shared-range social state

| Quantity | Canonical writer | Readers | Notes |
| --- | --- | --- | --- |
| encounter evidence | `socialContext.applyEncounterContext` → `applyEncounterToBand` | contact memory, friction candidacy | admission requires **distance ≤ 3**; memory coincidence alone cannot admit |
| friction | `rangeFriction.advanceRangeFriction` | `accessNorms`, `innerFission`, `reportedKnowledge` | a contemporary direct notice requires current physical proximity (`DEFAULT_NEARBY_RADIUS = 4`) |
| access expectation | `accessNorms.advanceProtoAccessMemory` (derived every tick, **stores nothing**) | `pressure.ts` behaviour hooks | reads the band's **own** ring; deleting the other band from the world changes nothing (I4) |
| active / cooling / released | derived in the same function: `activeEvidenceWeight`, `activeEvidenceCount`, `socialEvidencePhase` | audits, UI | **see the limitation in §B1: the label leads the quantity between weight 0 and 0.05** |
| decision pressure | `crowding.getCrowdingPenalty` at `CROWDING_DECISION_COST_WEIGHT` | `scoreDecision` | `weightedCrowding` is **evidence**; `crowdingPenalty` is the single decision-facing cost |
| candidate-pair identity | `RangeFrictionEvent.eventId` + `(observer, other, tile, interpretation, tick)` | dedup, release | 0 duplicate episodes and 0 duplicate event ids measured (I3) |
| provenance | `ProtoAccessMemory.antiOmniscience`, `RangeFrictionEvent.confidence` | audits | direct vs reported vs released is carried on the record |

## 4. Resource use

| Quantity | Canonical writer | Readers | Notes |
| --- | --- | --- | --- |
| residential demand | `carryingCapacity.derivePopulationDemand` | nutrition | counts the **whole band** — an away worker still eats |
| residential extraction effort | `sharedCatchment.getBandForagingDraw` | catchment claim | counts adults **physically at camp**; away workers removed |
| catchment claim | `sharedCatchment.buildSharedCatchmentIndex` | per-capita return, support share | residence-anchored footprint |
| away-party provisions | `expedition.consumeProvisions` | cargo | trip-local accounting; **no residential store is decremented** |
| target stock removal | `plantStock.resolvePlantFoodHarvest` / `resolveFaunaFoodHarvest`, via `resolvePhysicalFoodHarvest` | world stock | the **one** physical harvest equation, deliberately labour-blind |
| cargo | `ExpeditionRecord.cargo.harvestUnits` | carry cap, return | |
| cargo loss | `cargo.lostUnits` | conservation | abandonment above the ceiling |
| consumption | `cargo.provisionUnitsConsumed` | delivered support | subtracted at return |
| returned receipt | `expedition.buildReturnedRecord` → `seasonalFoodReceipts` | `humanFoodSupport` | **only on physical return** |
| `humanFoodSupport` | `humanFoodSupport.deriveHumanFoodSupportLedger` | nutrition, demography | reads the bounded per-period accumulator |

**No support before return** is measured directly in I10: on a work day the band's receipts are
unchanged while the stock at the target has genuinely moved.

## 5. Range release

| Quantity | Canonical writer | Readers | Notes |
| --- | --- | --- | --- |
| release trigger | evidence **age**, weighted in `accessNorms.weighSocialEvidence` | every access scalar | horizons 8 / 12 / 16 ticks by relation, reports separately |
| released-state storage | **none — nothing is stored.** Release is a weighting recomputed every tick | — | this is why there is no second authority to drift |
| current inactivity | contribution scales by weight and reaches 0 at the horizon | `pressure.ts` | measured in I6: 0.31 → 0.24 → 0.18 → 0.14 → 0.09 → 0.05 → **0** |
| historical evidence | the ring, contact memories and encounter records are all **retained** | UI, history | 8 records still held after release (I6, I11) |
| reactivation | **no reactivation authority exists.** A returned band is noticed only through a **new** episode | — | I16 measured reactivation at season 1 with **1 new event id** — fresh evidence, not a revival |
| what must not influence current decisions | a released record | — | **see §B1 — this is the one thing this audit could not certify** |

## 6. Fission boundary

| Concern | Item 3 owns | Item 4 owns |
| --- | --- | --- |
| founder availability | `createDaughterBand` caps the daughter at `min(getDaughterPopulation(total), population − awayPartyPeople)` and blocks below `DAUGHTER_MIN_POPULATION` | — |
| physically away people | `bandMobility.derivePhysicallyAwayPartyPeople` — cannot be founders | — |
| prepared commitments | counted **present** for bodies, **committed** for labour; withheld from founding as a stated **policy**, not a physical necessity | whether that policy is right |
| who leaves | — | **Item 4** |
| daughter viability | — | **Item 4** |
| successor groups | — | **Item 4** |
| cancelling a prepared party to free founders | — | **Item 4** |

Measured in I13: a prepared party of five inside a band of 60 produces **zero** away presence
sources, `physicallyAwayPeople = 0`, `preparedCommitmentPeople = 5`, residential working adults
20 of 25.

---

## Parallel-authority check

Searched for a second writer of each quantity above. **None found**, with one structural note:

- `weightedCrowding` and `crowdingPenalty` are two names for the same physical fact, and that is
  deliberate and bounded — CORRECTION-32 made the first *evidence* and the second the *only*
  decision-facing cost. The CORRECTION-32 suite asserts ≥3-separately-named-charges = **0** and
  max paths = **2**, and both hold on this tree.
- `activeEvidenceWeight` and `socialEvidencePhase` are two derived views of the same evidence age.
  They are **not** two authorities, but they do not agree at the boundary — §B1.
