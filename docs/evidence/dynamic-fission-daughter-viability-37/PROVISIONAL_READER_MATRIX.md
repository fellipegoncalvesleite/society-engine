# Roadmap Item 4 §4 — provisional reader matrix

**Semantic classification of every true enumeration of the band set.** This replaces the lexical
suspicion in `provisional-reader-surface.json` (160 sites / 144 unguarded), which was **discovery
evidence and is superseded** — see `PROVISIONAL_REPRESENTATION_DECISION.md` §1 for the 3.9×
overstatement and its three causes.

**41 true enumerations across 23 files. 29 keyed lookups (`world.bands[id]`) are irrelevant** — the
caller already holds the id, so a provisional successor cannot wander into one.

Two columns, because they answer different questions:

- **WANTS** — what the reader semantically means by "band": *all physical groups* (anything with
  bodies at a tile), or *established bands only* (a stabilized residential band), or neither.
- **ACTION** — what must therefore happen: `safe unchanged`, `adapter`, `provisional guard`,
  `blocked during provisional lifecycle`, `irrelevant false positive`.

`filter` records what the site does today: `canonical` = routes through `bandLifecycle.ts`,
`inline` = hand-written status test, `none` = no lifecycle filter.

---

## A. Physical layer — reads all physical groups, safe unchanged

A provisional successor has real bodies at a real tile. Excluding it here would recreate the ghost
bodies CORRECTION-34 removed, and would be a worse defect than the one Item 4 is closing.

| site | filter | WANTS | ACTION | why |
|---|---|---|---|---|
| `crowding.ts:885` | inline | all physical groups | **safe unchanged** | bodies crowd. The parent/successor co-residence exception is a *pair* rule, handled in §C, not an exclusion of the group |
| `world/depletion.ts:138` | none | all physical groups | **safe unchanged** | a group standing on a tile depletes it |
| `faunaStock.ts:1350` | canonical | all physical groups | **safe unchanged** | already routes through `isLivingBand`; a provisional group hunts |
| `resourceEcologyFoundation.ts:259` | none | all physical groups | **safe unchanged** | ecological pressure follows bodies |
| `visibleNature.ts:376` | none | all physical groups | **safe unchanged** | projection of what is physically there |
| `carryingCapacity.ts:360` | inline | all physical groups | **safe unchanged** | counts non-dispersed bands for ecological pressure; provisional groups eat |
| `acuteRisk.ts:55` | none | all physical groups | **safe unchanged** | **L5** — injury, sickness and fatigue are carried, not reset. A travelling group is exposed like any other |
| `spawn.ts:679` | none | all physical groups | **safe unchanged** | "is this tile occupied?" — a provisional group does occupy its tile |
| `spawn.ts:727` | none | all physical groups | **safe unchanged** | colour uniqueness; a provisional group is visible and needs a distinct one |

## B. Demography and consumption — reads all physical groups

| site | filter | WANTS | ACTION | why |
|---|---|---|---|---|
| `demography.ts:155` | none | all physical groups | **safe unchanged** | births and deaths continue for a group that exists. Reintegration must then use CURRENT cohorts, which is a requirement on the resolver, not on this loop |
| `demography.ts:3366` `getWorldPopulation` | none | all physical groups | **safe unchanged, and load-bearing** | the successor's people must be counted **exactly once** here. This is the seam at which defect 6's false conservation flag lives, and the departure fixture measures this function rather than restating the before value |
| `bodyCampLogistics.ts:63` | none | all physical groups | **adapter** | **L7** — must recompute only after honest cohorts, embodied condition, location, travel and material capability exist. Ordering constraint, not exclusion |
| `contextCache.ts:131` | canonical | all physical groups | **safe unchanged** | already routes through the predicate module |
| `contextCache.ts:183` `deriveActiveBandIds` | none | all physical groups | **adapter** | uses a **fourth private spelling**, `isActiveBand`, of the same question. Must be folded into the predicate module so one answer exists |

## C. Social layer — blocked for the parent/successor pair only

At departure the two groups stand on the same tile. CORRECTION-29 gated encounters on proximity, so
without a lineage exclusion the split would immediately manufacture stranger friction between a band
and the group that just left it, and CORRECTION-30's access expectation would carry that fiction
forward. **The exclusion is a pair rule using direct lifecycle/lineage provenance — no kinship is
invented.**

| site | filter | WANTS | ACTION | why |
|---|---|---|---|---|
| `socialContext.ts:134` | none | all physical groups | **provisional guard (pair)** | encounter context |
| `socialContext.ts:1044` | none | all physical groups | **provisional guard (pair)** | encounter application |
| `socialContext.ts:1626` | inline | all physical groups | **provisional guard (pair)** | aggregate over other bands |
| `socialContext.ts:1660` | inline | all physical groups | **provisional guard (pair)** | candidate set |
| `socialContext.ts:2006` | inline | all physical groups | **provisional guard (pair)** | recognition |
| `accessNorms.ts:86` | none | all physical groups | **safe unchanged** | reads the observer's **own held records**; with the pair blocked above, no record exists to read |
| `relationshipMemory.ts:53` | none | all physical groups | **provisional guard (pair)** | same pair rule |
| `protoCamps.ts:978` | inline | all physical groups | **provisional guard (pair)** | reads other bands' camps |

## D. Established bands only — blocked during the provisional lifecycle

| site | filter | WANTS | ACTION | why |
|---|---|---|---|---|
| `viability.ts:24` | none | established only | **blocked** | the extinction/absorption pass. **A failed successor must not vanish through general Item 6 cleanup** — its failure mode is return and reintegration, a different outcome from dissolution, and Item 6 owns dissolution |
| `viability.ts:330` | inline | established only | **blocked** | absorption target search — a provisional group may neither absorb nor be absorbed |
| `viability.ts:474` | none | established only | **blocked** | kin search for absorption |
| `demography.ts:183` (fission gate) | n/a | established only | **blocked** | **a provisional successor cannot itself propose a split.** It has not demonstrated it can function, so a split of a split is a claim about a group whose viability is the open question |
| `expedition.ts:2479` | none | established only | **blocked while travelling** | a group walking to a destination cannot also run expeditions from a camp it does not have — the same bodies in two places |
| `intraSeasonTrips.ts:312` | none | established only | **blocked while travelling** | same reason, for same-day residential trips |
| `protoCamps.ts:37` | none | established only | **blocked while travelling** | a group on a journey is not forming a proto-camp |

## E. Requires an explicit decision — not derivable, must be ruled on

| site | filter | WANTS | ACTION | the question |
|---|---|---|---|---|
| `demography.ts:402` | none | — | **provisional guard** | does a provisional successor consume a `MAX_BANDS` slot? **Proposed: yes.** It is a real group holding real bodies, and pretending otherwise would let attempts exceed the world's own bound. But it must not *block ordinary fission* while merely proposed — which is why the pre-departure attempt holds no bodies and no slot |
| `demography.ts:526` | none | — | **provisional guard** | same question, `canCreateMoreBands` |
| `demography.ts:702` | none | — | **safe unchanged** | reporting only |
| `demography.ts:3410` `activeBandColors` | inline | all physical groups | **safe unchanged** | display-only; the comment already states colour affects no decision |

## F. Lineage, history and projection — provisional interpretation

| site | filter | WANTS | ACTION | why |
|---|---|---|---|---|
| `bandEvents.ts:73` | none | all physical groups | **adapter** | the attempt, departure and resolution are all real events. **An ordinary daughter-success event must NOT be emitted at departure — L4** |
| `bandHistory.ts:315` | none | all physical groups | **adapter** | terminal history must be preserved for a failed successor; nothing may vanish silently |
| `simRunner.ts:607` | none | all physical groups | **adapter** | projection only. Must be able to say *provisional* rather than showing an ordinary band; decides nothing |
| `foragingAdaptation.ts:63` | none | all physical groups | **safe unchanged** | inheritance is already partial and degraded; lived problems on a journey are real problems |

## G. Irrelevant false positives

| site | filter | why |
|---|---|---|
| `spawn.ts:499, 536, 705, 778` | none | world construction and manual placement. A provisional successor exists only *after* a departure, which is after spawn |
| `world/mapEdits.ts:386` | none | the map editor, outside the simulation kernel |

---

## Totals

Counted by section: A 9 + B 5 + C 8 + D 6 + E 4 + F 4 + G 5 = **41 enumerations**, plus the
`demography.ts:183` fission gate, which is a branch rather than an enumeration and is listed in §D
because it is the same decision.

| ACTION | enumerations |
|---|---|
| safe unchanged | **16** |
| provisional guard | **9** |
| blocked during provisional lifecycle | **6** (+ the `demography.ts:183` gate) |
| adapter | **5** |
| irrelevant false positive | **5** |
| **total** | **41** |

**20 enumerations need real work** — 9 guards, 6 blocks and 5 adapters that change behaviour —
**plus the fission gate, so 21 changes.** **16 are safe unchanged and are recorded as decisions
rather than omissions.** **5 are false positives.** That is the surface Layer 2 must satisfy, and
those are the numbers the representation decision rests on.

Against the lexical scan's 144 apparently unguarded sites, **21 changes** is the corrected figure —
and it is what makes Representation A auditable rather than merely convenient.

## Not yet classified, and stated as such

**`sharedCatchment.ts` does not appear in this matrix**, because it does not enumerate
`world.bands` — its footprint is residence-anchored and derived elsewhere. That is Item 3's largest
carried-forward seam, **deferred and closed by nothing here**: a travelling provisional successor
competes for nothing under the current model. Recorded so freezing Item 3 or shipping Item 4 cannot
be read as resolving it.

**Every classification above is a specification, not an implementation.** No reader has been edited.

---

## E. Readers this pass created or moved — travel subsistence, burden merge, return, stabilization

Added by the travel-subsistence / evidence-based-resolution pass. Each row names the reader, the
authority it reads through, and whether the migration is genuinely done. **The overall Item 4 reader
migration is NOT complete** and is not claimed to be.

**TWO DIFFERENT COUNTS APPEAR IN THIS DOCUMENT AND THEY MEASURE DIFFERENT THINGS.** A verification
pass found them coexisting without names, which reads as a contradiction. They are both true:

```text
SOURCE-MODULE MIGRATION:   5/12   — `bandLifecycleBoundaryAudit`, verdict INCOMPLETE.
                                    Counts SOURCE FILES that read band state and must learn that a
                                    provisional successor is not an ordinary band. Seven pending and
                                    named: bandEvents, bandHistory, bodyCampLogistics, demography,
                                    relationshipMemory, socialContext, simRunner.

FUNCTIONAL-SEAM COVERAGE: 11/13   — the table below.
                                    Counts the Item 4 SEAMS this pass was asked to migrate. Two
                                    pending: serialization and history/read-model projection.
```

A seam can be migrated while modules that read around it are not, which is why the smaller number is
the binding one. **Neither count may be cited as "Item 4 reader migration complete".**

| reader | reads through | status | note |
|---|---|---|---|
| travel extraction | `plantStock.resolvePlantFoodHarvest` | **migrated** | the same canonical harvest owner every ordinary gather uses; no second extraction path exists |
| travel receipts | `FissionLifecycleRecord.travelSubsistence` | **migrated** | successor-owned. Deliberately NOT `seasonalFoodReceipts`, which describes receipts from a residential camp a walking group does not have |
| nutrition | `seasonalSurvival.recordSupportInterval` | **migrated** | ONE writer of derived support state, two sample producers (residential carrying capacity, travel interval) |
| water | the standing tile's own `resourceProfile.waterAccess` + `adaptationBoundary.deriveCarriedWaterRelief` | **migrated** | a physical execution constraint of the same class as passability; carried water only where a learned practice already exists |
| acute risk | `acuteRisk.mergeAcuteRiskOnReintegration` | **migrated** | union by episode id, effect rederived, cap enforced, drops counted |
| mortality / demography | unchanged — `demography.ts` reads `seasonalSupport` as it always did | **migrated by consequence** | the group's hunger is now measured, so the annual step reads a real deficit rather than a neutral absence |
| return intent | `provisionalReturnDecision.deriveProvisionalReturnDecision` | **migrated** | takes a band and a day, no world; the single writer of the transition into `returning` |
| establishment evidence | `provisionalEstablishment.assessEstablishmentEvidence` | **migrated** | pure over the band and its own site record |
| stabilization transition | `provisionalEstablishment` via `fissionLifecycleKernel.requestTransition` | **migrated** | physical event + measured evidence count; a timer is refused |
| post-stabilization admission | `bandLifecycle.isProvisionalSuccessor` | **migrated** | terminal phase ⇒ no longer provisional ⇒ every ordinary gate admits it, and not one moment earlier |
| reintegration merge | `provisionalReintegration.REINTEGRATION_FIELD_TREATMENTS` | **migrated** | every embodied and derived field classified once, in code |
| **serialization** | `WorldState.bands[].provisionalSuccessor` | **PENDING** | the whole record is part of `Band`, so a structural clone carries it — but `simRunner`'s **selected-band panel projection carries no lifecycle field at all**, so a UI reading that projection cannot see a journey, an interval or an evidence signal |
| **history / read-model projection** | none | **PENDING** | no Chronicle entry, no band event and no UI surface exists for departure, travel, return cause, evidence acquisition or stabilization. The lifecycle is fully readable in state and invisible in the product |
