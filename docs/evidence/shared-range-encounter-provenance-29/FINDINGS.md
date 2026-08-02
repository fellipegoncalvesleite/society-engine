# CORRECTION-29 — DIRECT ENCOUNTER PROVENANCE — FINDINGS

Branch `checkpoint/shared-range-encounter-provenance-29`, from the accepted CORRECTION-28 tip
`c5eb58a8f5ff7054665f9c376ac4ca856403efab`. `main` untouched at `0a43083`.

**PRODUCTION BEHAVIOUR CHANGED.** No fingerprint parity to `c5eb58a` is claimed or possible.
Encounter frequency was **not** recalibrated to preserve any previous number.

Claims are tagged **[MEASURED]**, **[CODE]**, **[INFERENCE]** or **[NOT PROVEN]**.

---

## 1. Git preflight

```
git status --short                                      (clean)
git rev-parse HEAD                                      c5eb58a8f5ff7054665f9c376ac4ca856403efab
git rev-parse origin/main                               0a43083a3a9103bc6b8f693b8823a604ae2c6a8d
git rev-parse origin/checkpoint/crowding-physical-memory-separation-28
                                                        c5eb58a8f5ff7054665f9c376ac4ca856403efab
git merge-base HEAD origin/main                         0a43083a3a9103bc6b8f693b8823a604ae2c6a8d
git worktree list                                       one worktree
git stash list                                          empty
```

Frozen and verified at entry and exit: CORRECTION-28 `c5eb58a`, AUDIT-27 `b352c31`,
CORRECTION-26 `5f341648`. `main` was not merged, reset, rebased or modified.

---

## 2. Where private memory became asserted direct contact

**[CODE]** The chain was entirely inside `socialContext.ts` and passed through **two independent
gates**, either of which alone would produce a false encounter.

| # | site | what it did |
| --- | --- | --- |
| 1 | `getEncounterCandidatePairs` (`socialContext.ts:1932-1986`) | paired **any two bands whose `topReturnPlaceIds` named the same tile**, with **no distance condition at all** — alongside the legitimate proximity-≤4 source |
| 2 | `getEncounterKind` (`socialContext.ts:1718-1746`) | `if (memoryOverlap > 0.24 \|\| distance <= 3)` — the **only** non-distance-gated branch in the whole encounter system |
| — | `getSharedMemoryOverlap` (`socialContext.ts:1774-1803`) | supplied `memoryOverlap` by reading **the other band's private `placeMemory` directly** |

**The first point at which coincidence becomes asserted contact is gate 1.** Gate 2 is what let it
survive `detectEncounter`.

**[CODE] What the false record then did.** `applyEncounterToBand` (`socialContext.ts:1134-1166`) is
the **only** production writer of `contactMemories` and `encounterRecords` outside spawn and
fission initialisation. It calls `updateContactMemory`, which increments `contactCount`, stamps
`lastContactAt`, sets `firstContactAt`, and raises `familiarity` — a complete direct contact.

**[CODE] And it did not stay put.** `rangeFriction.deriveCandidateBands` (`rangeFriction.ts:478`)
adds **every band id in `observer.contactMemories`** to the friction candidate set with no distance
condition, so one ghost contact makes a band 40+ tiles away a standing friction candidate.
`reportedKnowledge` and `accessNorms` also read contact memories.

**[INFERENCE] This is why the repair belongs at the encounter gates and nowhere else** — closing
them removes the contact memory that would have opened the downstream doors, so `rangeFriction.ts`
needed no edit. §8 permits touching its provenance only "where strictly necessary"; it was not.

---

## 3. The repair

**[CODE]** Three edits, one file, `src/sim/agents/socialContext.ts` (+21 −60):

1. `getEncounterCandidatePairs` — the `memoryTileBands` block is deleted. Candidacy is **current
   proximity only** (`getLocalEncounterCandidateIds`, distance ≤ 4, unchanged).
2. `getEncounterKind` — the `memoryOverlap` parameter and the `memoryOverlap > 0.24` disjunct are
   gone; the branch is `distance <= 3`. Every other branch is untouched.
3. `getSharedMemoryOverlap` is **deleted**, together with its only call site in `detectEncounter`.

`updateContactMemory`, `applyEncounterToBand`, encounter outcomes, tolerance, tension, disposition,
perception and response distributions are untouched — a legitimate encounter does exactly what it
did before.

Architecture comparison, and why Option B (physical-activity evidence) is deferred rather than
rejected, are in `ARCHITECTURE_DECISION.md`.

---

## 4. The required headline

**[MEASURED]** Fixture P1, run unchanged in both arms. Two bands spawned **far apart from the
start** so they have never met, warmed 16 seasons, then one given a return-place record naming a
tile the other also holds — AUDIT-27 C10b's construction:

| | before (`c5eb58a`) | after |
| --- | --- | --- |
| separation | **42 tiles** | **42 tiles** |
| prior contact | none | none |
| new contact memory | **yes** | **no** |
| `contactCount` | **3** | **0** |
| encounter records naming the other band | **3** (`unrelated_overlap` ×3) | **0** |
| remembering band kept its place memory | **yes** | **yes** |

**`memory-only distant pair creating new direct contact: before = yes, after = no` — satisfied.**

**[MEASURED]** And the other half:

| | before | after |
| --- | --- | --- |
| P2 nearby pair → encounter + contact memory | `LEGITIMATE_ENCOUNTER_PRESENT` | `LEGITIMATE_ENCOUNTER_PRESENT` |
| P7 repeated legitimate contact accumulates | `REPEATED_CONTACT_ACCUMULATES` | `REPEATED_CONTACT_ACCUMULATES` |

**`physically legitimate nearby pair creating direct contact: before = yes, after = yes` —
satisfied.**

**[MEASURED] The result was not obtained by any forbidden means.** No memory was deleted (P1 and P6
both confirm the place memory survives; `reportedAwarenessRecords` is 35,776 in **both** arms), no
band was removed (`livingBandSeasons` 2,400 in both), encounters were not globally suppressed (17
still occur naturally, and P2/P7 still pass), durations and seeds are identical, map generation is
untouched, and contact-memory retention rules were not changed.

---

## 5. Controlled fixtures P1–P12

Every fixture ran unchanged in both arms. **Three verdicts changed, all in the intended direction.**

| id | question | before | after |
| --- | --- | --- | --- |
| **P1** | distant bands sharing a remembered place gain direct contact | **`GHOST_CONTACT_CREATED`** | **`NO_GHOST_CONTACT`** |
| P2 | genuinely close bands still encounter | `LEGITIMATE_ENCOUNTER_PRESENT` | unchanged |
| P3 | geometric proximity alone under current world constraints | `PROXIMITY_ALONE_SUFFICES_NO_VISIBILITY_RULE_EXISTS` | unchanged |
| P4 | previous contact survives separation without refreshing | `CONTACT_PRESERVED_NOT_REFRESHED` | unchanged |
| P5 | reports stay reports | `MEASURED` | unchanged |
| **P6** | shared remembered place transfers social identity knowledge | **`IDENTITY_KNOWLEDGE_CROSSED`** | **`NO_IDENTITY_KNOWLEDGE_CROSSED`** |
| P7 | repeated legitimate contact accumulates | `REPEATED_CONTACT_ACCUMULATES` | unchanged |
| **P8** | kin identity alone creates an encounter at distance | **`KIN_ENCOUNTER_AT_DISTANCE`** | **`NO_KIN_ENCOUNTER_AT_DISTANCE`** |
| P9 | ghost case creates friction through the encounter chain | `NO_GHOST_FRICTION` | unchanged |
| P10 | physical crowding / catchment / support / depletion | `MEASURED` | unchanged |
| P11 | order invariance | `ORDER_INVARIANT` | unchanged |
| P12 | step-mode invariance | `STEP_MODE_INVARIANT` | unchanged |

**No fixture is vacuous.**

**[MEASURED] P8 is the 44-tile case AUDIT-27 named, reproduced exactly.** It has two arms:

- `kin_only_at_distance` (separation **41**): **0 encounters in both arms.** Kin identity alone
  never created an encounter — an honest *unchanged* result, and kin recognition was not redesigned.
- `kin_plus_shared_memory_at_distance` (separation **44**): before **3 `shared_resource_area`
  encounters and a contact memory**; after **0 and none**.

**[MEASURED] P6** — before, *both* bands gained a contact memory and 3 encounter records naming the
other; after, neither band knows the other exists.

**[MEASURED] P4** — a genuine prior contact survives separation in **both** arms, and its
`contactCount` does **not** refresh at distance in either. §7.3 held before and still holds.

**[MEASURED] P10 — the physical system is byte-identical between arms** on the same frozen world:

```
before  [["band:custom:0",0.02,0.8846,132.06,0.0162],["band:custom:1",0.02,0.8846,116.76,0.2633]]
after   [["band:custom:0",0.02,0.8846,132.06,0.0162],["band:custom:1",0.02,0.8846,116.76,0.2633]]
         (weightedCrowding, meanCatchmentShare, sharedReachableSupport, tileDepletion)
```

and the **CORRECTION-28 guard (§7.8) holds in both arms**: the distant remembering band reads
`weightedCrowding 0` with an empty contributor list at separation 42.

**[MEASURED] P9 is an honest unchanged pass, not a repair credit.** No friction event named the
other band in **either** arm. **[INFERENCE]** The ghost contact memory *was* created in the before
arm, and `rangeFriction.ts:478` *would* have made that band a standing candidate — but a friction
notice also requires the other band's position or trip target to fall inside the observer's
familiar country, and at 42 tiles it does not. AUDIT-27's C10b did observe a friction event because
its bands were warmed **adjacent** first and therefore shared familiar country. **This checkpoint
therefore does not claim to have measured the friction cascade closing** — it claims the contact
memory that feeds it is no longer created.

**[MEASURED] P3 is a measurement, not a requirement.** Two bands placed on land tiles separated by
water still produce an encounter: production has **no** visibility, route or barrier rule for
encounters, and this checkpoint invents none. Recorded as an open question, not a defect repaired
here.

---

## 6. Natural occurrence — the four provenance classes kept apart

20 y × {map1, map2, ordinary} × {s1, s2}, same seeds and durations as AUDIT-27 / CORRECTION-28;
480 season samples, 2,400 living band-seasons per arm.

**[MEASURED] The four classes §11 requires to be distinguished:**

| class | before | after |
| --- | --- | --- |
| **direct encounter** (new `BandEncounterRecord`) | 22 | **17** |
| **remembered contact** (a contact memory present that did *not* refresh) | 50 | **60** |
| **reported awareness** (`WordOfMouthReport`) | 35,776 | **35,776** |
| **social-range recognition** (`deriveSocialRangeRecognition` neighbours) | 94 | **94** |

**[MEASURED] The single most informative number in this pass is a conservation:**
`contactMemoriesRefreshed` **42 → 32 (−10)** and `rememberedContactBandSeasons` **50 → 60 (+10)**.
**Ten band-seasons moved exactly from "refreshed" to "merely remembered."** Nothing was deleted —
contacts that used to be re-asserted every season by memory coincidence are now correctly held as
history. `contactMemoriesFirstCreated` is **2 in both arms**: no legitimate first contact was lost.

**[MEASURED] Everything else that moved**, and all of it small: candidate pair-seasons 27 → 28,
`bandSeasonsWithCrowding` 54 → 56, contested catchment tile-seasons 42 → 43, moves 1,546 → 1,547.
Unchanged: `livingBandSeasons` 2,400, `frictionEventsTotal` 746, `frictionEventsNamingAContact`
735, `fissions` 0, `finalLivingBandCount` 30, `finalPopulation` 817, `survived` 6/6.

### 6.1 Encounter distance — and an instrument limit stated plainly

| | before | after |
| --- | --- | --- |
| max direct-encounter distance (end-of-tick) | 5 | 5 |
| encounters beyond the admission radius (end-of-tick) | 11 | **5** |
| distance buckets | `{2-3: 11, 4: 6, 5-10: 5}` | `{2-3: 12, 4: 2, 5-10: 3}` |

**[MEASURED] The after arm shows 5 encounters "beyond radius", not 0, and that is an instrument
artifact, not a residual ghost.** The probe measures distance at the **end of the tick** in which
the record first appears. `applyEncounterContext` runs inside `updateBandContextStates` **before**
the decision loop moves bands, so a pair that was ≤ 3 apart at detection can be 4–5 apart when
sampled. **[CODE]** After the change, `getEncounterKind` returns `undefined` for **every**
`distance > 3`, so admission beyond 3 is impossible by construction. All five after-arm rows are
`unrelated_overlap`, and three of them (ticks 38, 43, 47) appear identically in the before arm at
the same distances — the same legitimate encounters.

**[MEASURED] No long-range ghost occurred naturally in these worlds.** Max encounter distance is 5
in *both* arms. **[INFERENCE]** The ghost path is real and reproducible — the fixtures show it at
42 and 44 tiles — but in 20-year natural runs the bands never developed coincident top-return-places
at long range. What it actually did in the wild was manufacture extra encounters between bands
already 4–5 apart, which is why the natural effect is 22 → 17 rather than a dramatic collapse.

---

## 7. Behavioural impact

**[MEASURED] Five of six 20-year runs are byte-identical.**

| scenario | seed | first divergence | moves | population |
| --- | --- | --- | --- | --- |
| map1 | s1 | **none** | 249 → 249 | 158 → 158 |
| map1 | s2 | **none** | 276 → 276 | 155 → 155 |
| map2 | s1 | **tick 58**, `band:varied-dry-corridor-mid`, position `tile:55:107` → `tile:56:107` | 430 → **431** | 226 → 226 |
| map2 | s2 | **none** | 470 → 470 | 225 → 225 |
| ordinary | s1 | **none** | 54 → 54 | 27 → 27 |
| ordinary | s2 | **none** | 67 → 67 | 26 → 26 |

Aggregate: moves 1,546 → 1,547; fissions 0 → 0; final population 817 → 817; final living bands
30 → 30; runs surviving 6/6 → 6/6.

**[MEASURED] Changed encounter outcomes:** 5 fewer direct encounters and 10 fewer contact refreshes
across 480 season samples. **Changed relationship state:** those 10 become remembered rather than
refreshed; no contact memory was created or destroyed that should not have been.
**Changed decisions and movement:** one band, one tile, at tick 58. **Changed demography and
survival:** none.

**No improvement is claimed.** The acceptance criterion is truthful provenance, and the aggregate
outcome is deliberately not tuned.

---

## 8. Invariants §7.1–§7.8

| invariant | evidence | held |
| --- | --- | --- |
| 7.1 no memory-only direct encounter | P1: 0 encounters, no contact memory, no contact count, no reason, no friction, at 42 tiles | ✅ |
| 7.2 legitimate nearby encounter remains | P2, P7; 17 encounters still occur naturally | ✅ |
| 7.3 existing historical contact remains | P4 in both arms: memory preserved, counters not refreshed; `contactMemoriesFirstCreated` 2 → 2 | ✅ |
| 7.4 reports remain reports | `reportedAwarenessRecords` 35,776 → 35,776; `advanceReportedKnowledge` untouched | ✅ |
| 7.5 social recognition stays non-contact | `socialRangeRecognizedNeighbours` 94 → 94; `socialRangeRecognition.ts` untouched and still UI-only | ✅ |
| 7.6 no private-memory omniscience | `getSharedMemoryOverlap`, the direct read of another band's `placeMemory`, is deleted; P6 shows no identity knowledge crosses | ✅ |
| 7.7 physical ecology unchanged | P10 byte-identical readings; `catchmentInvariants` PASS; no physical module touched | ✅ |
| 7.8 CORRECTION-28 intact | CORRECTION-28's own fixtures rerun **12/12 unchanged**, P1 still `MEMORY_ONLY_CROWDING_ABSENT`; P10's guard reads 0 crowding at 42 tiles | ✅ |

---

## 9. Validation

`git diff --stat c5eb58a -- src/` touches **one file**: `src/sim/agents/socialContext.ts`
(+21 −60). `src/ui/**` untouched.

| command | result |
| --- | --- |
| `npx tsc -p tsconfig.json --noEmit` | **PASS** |
| `npx tsc -p tsconfig.node.json --noEmit` | **PASS** |
| `npm run build` | **PASS** |
| `node scripts/checkGraph.mjs` | **PASS** — 221/764, 0 dup, 0 dangling |
| `node scripts/importBoundaryAudit.mjs` | **PASS** |
| `node scripts/seasonOrderInvarianceAudit.mjs` | **PASS** |
| `node scripts/stepModeInvarianceAudit.mjs` | **PASS** — `fullCanonicalStateMatch: true` both maps, `firstDivergence: null` |
| `node scripts/catchmentInvariants.mjs` | **PASS**, all cases |
| `node scripts/livingEcologyFoodPipelineAudit.mjs` | **PASS** |
| `node scripts/mobilityAuthorityAudit.mjs` | **PASS** |

### Required reruns

| audit | result |
| --- | --- |
| **AUDIT-27 C10b** (its own unmodified fixture) | **`SOCIAL_KNOWLEDGE_FROM_MEMORY_OVERLAP_WITHOUT_PROXIMITY` → `NO_SOCIAL_KNOWLEDGE_WITHOUT_PROXIMITY`** |
| AUDIT-27 C1–C10 | **all unchanged**, including C4 `NO_OBSOLETE_CROWDING` and C5 `PHYSICAL_RELEASES_PERCEPTION_DOES_NOT` |
| CORRECTION-28 fixtures P1–P12 | **all 12 unchanged** |
| `socialCausalityAudit.mjs` | ran; same changed-fingerprint pattern as on `c5eb58a` (seeds b and d) |

**No inherited failures were encountered in this set.** `expeditionLifecycleAudit` remains the known
inherited failure recorded by CORRECTION-26; unrelated to encounters and not rerun in this scope.

---

## 10. Deferred seams, recorded not repaired

**[CODE] `rangeFriction.ts` keeps its own independent provenance defect.** `derivePairNotices`
reads another band's private `recentIntraSeasonTrips` and admits a notice whenever the trip's target
tile falls inside the observer's own familiar country — a gate on *place*, not on observation.
Closing the encounter chain does not close that, and §8 forbids repairing it here.

Also unchanged: range-friction expiration and release; access-memory decay; crowding score
double-counting; `nearbyBandPressure` and `crowdingPenalty` weights; range-saturation formulas;
shared-catchment footprint expansion; same-day trip, expedition and investigation-route overlap; kin
crowding factors; parent-memory dispersal pressure (`getParentCoreOverlap`); `territorialPressure`;
mobility-distance limits; property, territory, borders, warfare and law; Daughter Viability.

**Roadmap item 3 (Crowding / Shared Range / Range Release) remains OPEN.**

---

## 11. What this pass does not prove

- **[NOT PROVEN]** That the friction cascade closes. P9 is unchanged in both arms because the
  fixture's bands are too far apart to share familiar country (§5). The contact memory that feeds
  `rangeFriction.ts:478` is no longer created; the cascade itself was not exercised.
- **[NOT PROVEN]** Any long-horizon effect. No 200-year or 500-year matrix was run.
- **[NOT PROVEN]** That the simulation is better off. Population, bands, survival and fissions are
  unchanged at 20 years; one band moved one tile differently.
- **[NOT PROVEN]** Whether encounters *should* require visibility or a passable route. P3 measures
  that production has no such rule; this checkpoint deliberately invents none.
- The "encounters beyond admission radius" metric is an **upper bound** measured at end-of-tick
  (§6.1); the categorical claim rests on the code fact plus the 42/44-tile fixtures.
- The natural comparison rests on **six runs at 20 years**. Five are identical, which makes the
  isolation claim strong; it does not make the aggregate a population result.
