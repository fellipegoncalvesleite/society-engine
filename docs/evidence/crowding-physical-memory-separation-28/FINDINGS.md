# CORRECTION-28 — PHYSICAL VS REMEMBERED CROWDING SEPARATION — FINDINGS

Branch `checkpoint/crowding-physical-memory-separation-28`, from the accepted AUDIT-27 tip
`b352c3195406fc9494c0b693a98eb0786f1a3780`. `main` untouched at `0a43083`.

**PRODUCTION BEHAVIOUR CHANGED.** No fingerprint parity to `b352c31` is claimed or possible.

Claims are tagged **[MEASURED]** (a number from this pass, reproducible from `PROVENANCE.md`),
**[CODE]** (a code-supported fact cited to file:line), **[INFERENCE]**, or **[NOT PROVEN]**.

---

## 1. Git preflight

```
git status --short                                          (clean)
git branch --show-current                                   checkpoint/crowding-shared-range-authority-27 → new branch created
git rev-parse HEAD                                          b352c3195406fc9494c0b693a98eb0786f1a3780
git rev-parse origin/main                                   0a43083a3a9103bc6b8f693b8823a604ae2c6a8d
git rev-parse origin/checkpoint/crowding-shared-range-authority-27
                                                            b352c3195406fc9494c0b693a98eb0786f1a3780
git merge-base HEAD origin/main                             0a43083a3a9103bc6b8f693b8823a604ae2c6a8d
git worktree list                                           one worktree
git stash list                                              empty
```

All required conditions held: HEAD exactly at the AUDIT-27 tip, clean tree, AUDIT-27 frozen
(remote resolves to the same commit), CORRECTION-26 frozen at `5f34164`, `main` untouched, one
writer. `main` was not merged, reset, rebased or modified.

---

## 2. The repair

**[CODE] One semantic edit, applied symmetrically to the two implementations of the same rule.**

`src/sim/agents/crowding.ts` derived physical crowding from two incompatible sources:

```
basePreclamp = (distanceWeight * 0.58 + samePatchWeight * 0.34 + memoryOverlap * 0.24) * populationWeight
```

and the memory channel additionally widened the scatter footprint itself — a band scattered into
the radius-2 ball around each of its salient remembered places **regardless of where it currently
was**.

Removed, in both the cached field path (`buildCrowdingField`) and the cache-less scan path
(`computeCrowdingContribDescriptor`):

- the `memOverlapByTile` construction and its `getSalientPlaceMemories` loop;
- the remembered tiles from the scatter footprint;
- the `memoryOverlap * 0.24` term;
- the `getRememberedAreaOverlap` helper (dead once its only caller lost the call).

The skip condition simplified from `distance > CROWDING_RADIUS && memoryOverlap <= 0` to
`distance > CROWDING_RADIUS` — a strict narrowing, not a widening.

`getSalientPlaceMemories` is **retained**: it still serves `getParentCoreOverlap` (see §8).

Architecture comparison and the rejection of Option B are in `ARCHITECTURE_DECISION.md`.

---

## 3. The required headline

**[MEASURED]** Fixture P1 reproduces AUDIT-27's C4 exactly — band A warmed 16 seasons, relocated,
band B standing on one of A's salient remembered tiles — and runs unchanged in both arms:

| | before (`b352c31`) | after |
| --- | --- | --- |
| residence distance | 35 tiles | 35 tiles |
| A still holds a salient memory within 2 of B | **yes** | **yes** |
| observer `weightedCrowding` | **0.03** | **0** |
| observer `crowdingPenalty` | **0.01** | **0** |
| observer `nearbyBandCount` | **1** | **0** |
| crowding contributor identities | **["band:custom:0"]** | **[]** |
| `RangeSaturationState.nearbyCrowding` | 0.03 | **0** |

**`memory-only distant contribution to physical crowding: before > 0, after = 0` — satisfied.**

**[MEASURED]** And the other half of the requirement:

| | before | after |
| --- | --- | --- |
| P2 nearby band (distance 1), `weightedCrowding` | **0.11** | **0.11** |
| P3 nearby band with *no* memory formed at all, `weightedCrowding` | > 0 | > 0 |

**`current physical proximity contribution: before > 0, after > 0` — satisfied.** Crowding is not
globally disabled, and P3 proves proximity crowding never needed shared memory in the first place.

**[MEASURED] The change was not obtained by reducing bands, memory formation or stepping
frequency.** Both arms run the same seeds, the same scenarios, the same 20-year durations and the
same measurement seams; `totalBandSeasons` is **2400 in both arms**, and P6/P12 show memory is
intact.

---

## 4. Controlled fixtures P1–P12

Every fixture ran unchanged in both arms. **Exactly one verdict changed.**

| id | question | before | after |
| --- | --- | --- | --- |
| P1 | distant remembering band contributes physical crowding | `MEMORY_ONLY_CROWDING_PRESENT` | **`MEMORY_ONLY_CROWDING_ABSENT`** |
| P2 | currently nearby band still produces crowding | `PROXIMITY_CROWDING_PRESENT` | `PROXIMITY_CROWDING_PRESENT` |
| P3 | proximity crowding without any remembered overlap | `PROXIMITY_ALONE_SUFFICES` | `PROXIMITY_ALONE_SUFFICES` |
| P4 | nearby band that also holds remembered overlap | `MEASURED` | `MEASURED` |
| P5 | equal-demand catchments split symmetrically | `SYMMETRIC_SPLIT_OBSERVED` | `SYMMETRIC_SPLIT_OBSERVED` |
| P6 | remembered place remains social/spatial memory | `MEMORY_PRESERVED` | `MEMORY_PRESERVED` |
| P7 | dispersed / absorbed / extinct contribute zero | `CLEAN_TERMINAL_EXCLUSION` | `CLEAN_TERMINAL_EXCLUSION` |
| P8 | cached field vs cache-less scan parity | `FIELD_SCAN_PARITY` | `FIELD_SCAN_PARITY` |
| P9 | band processing order invariance | `ORDER_INVARIANT` | `ORDER_INVARIANT` |
| P10 | step-mode invariance (daily/weekly/monthly/seasonal) | `STEP_MODE_INVARIANT` | `STEP_MODE_INVARIANT` |
| P11 | memory-only distant pair gains no new contact | `MEASURED` | `MEASURED` |
| P12 | derivations do not modify remembered state | `MEMORY_UNMODIFIED_BY_DERIVATION` | `MEMORY_UNMODIFIED_BY_DERIVATION` |

**No fixture is vacuous.** Each declares a precondition and reports `VACUOUS_*` when it is unmet;
none did. Two preconditions had to be forced by construction rather than left to drift, and both
are flagged `syntheticState: true`:

- **P1/P6** relocate the remembering band and place the observer on a tile it remembers.
- **P4** parks the observer on one of the *other* band's genuinely warmed salient tiles, with that
  band one step away — the only way to hold "nearby **and** remembered overlap" simultaneously,
  since bands drift apart during a warm-up. An earlier version reported
  `VACUOUS_NO_REMEMBERED_OVERLAP` and is recorded in `PROVENANCE.md` as an instrument error.

**[MEASURED] P8 — field/scan parity, the invariant §7.6 requires.** Every public field of
`NearbyBandPressure` (`tileId`, `nearbyBandCount`, `weightedCrowding`, `parentOverlap`,
`daughterOverlap`, `confidence`, `pressureBandIds`) was compared under both paths across 3 bands ×
8 probe tiles × 17 seasons: **0 mismatches in both arms**. The memory contribution existed in both
implementations and was removed from both; they still agree.

---

## 5. Natural occurrence, before vs after

Same maps, same seeds, same durations, same definitions — AUDIT-27's own
`crowdingSharedRangeNaturalOccurrenceAudit.mjs` run unmodified on both arms
(20 y × {map1, map2, ordinary} × {s1, s2}; 480 season samples, 2,400 band-seasons, 7,360
active band-pair-seasons).

**[MEASURED] Everything that moved:**

| quantity | before | after | delta |
| --- | --- | --- | --- |
| band-seasons with non-zero `crowdingPenalty` | 89 | **49** | **−40 (−45%)** |
| possible double-counting band-seasons | 83 | **38** | **−45 (−54%)** |
| near-residence pairs | 26 | 27 | +1 |
| memory-only overlap pairs | 27 | 26 | −1 |
| range-friction events | 149 | 150 | +1 |
| residential moves | 1,547 | 1,546 | −1 |

Everything else is **identical**: `activeBandPairSeasons` 7,360; `sameTileResidencePairs` 0;
`overlappingPhysicalActivityPairs` 25; `physicalOverlapBeyondCrowdingRadiusPairs` 4;
`kinOverlapPairs` 0; `strangerOverlapPairs` 25; `accessMemoryStatesNonNone` 18,417;
`rangeSaturationNonZeroBandSeasons` 2,398; `movesWithCrowdingReason` 0;
`crowdingReasonInstances` 0; `terminalBandContributingToPressure` 0;
`sharedCatchmentContestedTileSeasons` 42; `hiddenCrowdingNoPerceptionBandSeasons` 0; and the
access-state distribution (`familiar_use` 12,107 / `expected_return` 6,239 /
`tolerated_shared_use` 71 / `none` 294) is unchanged in both arms.

**[MEASURED] 45% of naturally occurring crowding was memory-derived.** That is the single most
important number in this pass: it was not an edge case.

**[INFERENCE] The ±1 movements are downstream divergence, not mechanism change.** `nearResidencePairs`,
`memoryOnlyOverlapPairs`, `rangeFrictionEventsObserved` and `movesTotal` each shift by one because
one band in one run made one different decision (§6); none of those four counters reads the
crowding field.

**The semantic result §11 predicted holds exactly:** memory-only overlap still **exists as memory**
(26 pair-seasons, and `accessMemoryStatesNonNone` unchanged at 18,417) but **no longer counts as
physical crowding**.

---

## 6. Behavioural impact

**[MEASURED] Five of six natural runs are byte-identical between the arms.**

| scenario | seed | first divergence | moves | final population | band-seasons with crowding |
| --- | --- | --- | --- | --- | --- |
| map1 | s1 | **none** | 249 → 249 | 158 → 158 | 0 → 0 |
| map1 | s2 | **none** | 276 → 276 | 155 → 155 | 10 → 10 |
| map2 | s1 | **tick 37**, `band:varied-dry-corridor-mid`, `weightedCrowding` 0.12 → 0.11 | 431 → **430** | 226 → 226 | 82 → **40** |
| map2 | s2 | **none** | 470 → 470 | 225 → 225 | 4 → 4 |
| ordinary | s1 | **none** | 54 → 54 | 27 → 27 | 0 → 0 |
| ordinary | s2 | **none** | 67 → 67 | 26 → 26 | 0 → 0 |

Aggregate over all six runs:

| | before | after |
| --- | --- | --- |
| moves | 1,547 | 1,546 |
| moves naming crowding | 0 | 0 |
| crowding reason instances | 0 | 0 |
| band-seasons with crowding | 96 | **54** |
| crowding contributor identities | 96 | **54** |
| total band-seasons | 2,400 | 2,400 |
| fissions | 0 | 0 |
| final population | 817 | 817 |
| final living bands | 30 | 30 |
| runs surviving | 6/6 | 6/6 |

**[MEASURED] Which actions changed winner: exactly one, in one run.** The whole behavioural
footprint of this correction at 20 years is one residential move in `map2` seed `s1`, following a
0.01 fall in one band's crowding at tick 37.

**[INFERENCE] Changes arise only where memory-only crowding previously existed.** The three runs
that never had crowding at all (`map1 s1`, `ordinary s1`, `ordinary s2`) are identical; the two
with proximity-only crowding (`map1 s2` 10 → 10, `map2 s2` 4 → 4) are identical; only `map2 s1`,
which held 82 crowded band-seasons, moves — and its crowding halves to 40.

**No improvement is claimed.** Population, band count, survival and fissions are unchanged.
Nothing here shows the simulation is better off; it shows the crowding authority now says
something true. **[NOT PROVEN]** Any long-horizon (200 y / 500 y) consequence — none was run.

---

## 7. AUDIT-27's own instruments, rerun unmodified

`crowdingControlledFixturesAudit.mjs` and `crowdingDoubleCountingTraceAudit.mjs` were rerun on the
corrected tree with explicit `--out` paths so **no AUDIT-27 evidence file was touched**.

| AUDIT-27 fixture | at `b352c31` | on the corrected tree |
| --- | --- | --- |
| **C4** remembered place with no current use still produces crowding | **`OBSOLETE_CROWDING_PERSISTS`** | **`NO_OBSOLETE_CROWDING`** |
| C1 physical share reduced by a second band | `PHYSICAL_SHARE_REDUCED_BY_SECOND_BAND` | unchanged |
| C2 nearby residence without shared activity | `NOT_SEPARABLE_AT_PRODUCTION_RADII` | unchanged |
| C3 shared activity without nearby residence | `NOT_REPRESENTABLE_IN_FIXTURE` | unchanged |
| C5 range release after departure | `PHYSICAL_RELEASES_PERCEPTION_DOES_NOT` | unchanged |
| C6 terminal release | `CLEAN_TERMINAL_RELEASE` | unchanged |
| C7 kin tolerance vs ecological consumption | `PHYSICAL_COMPETITION_UNCHANGED_BY_KINSHIP` | unchanged |
| C8 capacity sensitivity | `CAPACITY_SENSITIVE` | unchanged |
| C9 order invariance | `ORDER_INVARIANT` | unchanged |
| C10 unseen band affects ecology | `SOCIAL_KNOWLEDGE_ACQUIRED_CHECK_PROVENANCE` | unchanged |
| **C10b** 44-tile ghost encounter | **`SOCIAL_KNOWLEDGE_FROM_MEMORY_OVERLAP_WITHOUT_PROXIMITY`** | **unchanged — deliberately** |

**The one AUDIT-27 finding this checkpoint set out to repair is repaired, measured by AUDIT-27's
own unmodified instrument, and nothing else moved.** C10b and C5 in particular are untouched,
which is what §7.5 and §8 require.

**[MEASURED] The double-counting trace is unchanged** — 13 moved derived quantities, 6 distinct
moved score inputs, 12 analytic channels. Its fixture is two bands at distance 1, i.e. pure
proximity, so the correction cannot and does not move it. Double-counting consolidation is
explicitly out of scope here (§8) and remains open.

---

## 8. What this checkpoint did NOT change, recorded as deferred AUDIT-27 seams

**[CODE] A second, independent memory→pressure path survives and is deliberately untouched.**
`getParentCoreOverlap` (`crowding.ts:487-505`) takes `max(directOverlap, memoryOverlap)` over the
*parent* band's salient places and feeds `DaughterDispersalPressure.parentCoreOverlap`. It does not
flow through `CrowdingField` and it is kin machinery. §7.8 forbids modifying kin behaviour here
(AUDIT-27 measured **zero** natural kin-overlap cases, so there is no evidence to recalibrate
against) and §8 excludes daughter viability and fission. The fixtures measure
`parentCoreOverlap` and `daughterDispersalPressure` on every read so the residual is quantified
rather than assumed absent.

Also unchanged, and listed so no reader mistakes silence for completion: shared-catchment
footprint composition; same-day trip, expedition and investigation-route overlap; encounter
candidacy and the 44-tile ghost; range-friction expiration and release; access-memory decay;
crowding score weights; the `nearbyBandPressure` / `crowdingPenalty` double-read in
`computeCandidateScore`; `RangeSaturationState` formulas; `localUsePressure` crowding inflation;
`placeAttachmentPull`; `territorialPressure`'s missing writer; kin factors; mobility-distance
limits; property, territory, borders, conflict and law.

**Roadmap item 3 (Crowding / Shared Range / Range Release) remains OPEN.** This checkpoint repairs
the first of the seams AUDIT-27 identified, not the item.

---

## 9. Invariants §7.1–§7.8

| invariant | evidence | held |
| --- | --- | --- |
| 7.1 memory-only separation — zero crowding, zero penalty, no contributor identity, no saturation contribution | P1: 0 / 0 / `[]` / 0 at 35 tiles | ✅ |
| 7.2 physical proximity remains active | P2 0.11, P3 proximity alone suffices | ✅ |
| 7.3 `sharedCatchment` unchanged | P5 symmetric split; `catchmentInvariants` PASS (0.5/0.5, per-capita 1.5 → 1.2 under contest); AUDIT-27 C1 unchanged; `src/sim/agents/sharedCatchment.ts` not modified | ✅ |
| 7.4 memories remain intact | P6 `MEMORY_PRESERVED` (record, attachment, `isReturnPlace`, familiar-country membership all present after relocation); P12 counts for `placeMemory` / `anchorMemories` / `travelCorridors` / access places; natural `accessMemoryStatesNonNone` 18,417 unchanged | ✅ |
| 7.5 no new social omniscience | P11: the memory-only distant pair's contact/friction/report counts are measured in both arms; C10b unchanged | ✅ |
| 7.6 field and scan parity | P8: 0 mismatches, both arms | ✅ |
| 7.7 lifecycle | P7 clean for dispersed / absorbed / extinct; natural `terminalBandContributingToPressure` 0 → 0 | ✅ |
| 7.8 kin behaviour unmodified | no kin factor or kin-recognition rule touched; `getParentCoreOverlap` left intact (§8) | ✅ |

---

## 10. Validation

`git diff --stat b352c31 -- src/` touches **one file**: `src/sim/agents/crowding.ts`.
`src/ui/**` is untouched.

| command | result |
| --- | --- |
| `npx tsc -p tsconfig.json --noEmit` | **PASS** |
| `npx tsc -p tsconfig.node.json --noEmit` | **PASS** |
| `npm run build` | **PASS** |
| `node scripts/checkGraph.mjs` | **PASS** — 221/764, 0 duplicate ids, 0 dangling links |
| `node scripts/importBoundaryAudit.mjs` | **PASS** — `src/sim` imports nothing from ui/render/store/worker; internal back edges 85, unchanged |
| `node scripts/seasonOrderInvarianceAudit.mjs` | **PASS** — deterministic, physically order-invariant, residual is the recency artifact only |
| `node scripts/stepModeInvarianceAudit.mjs` | **PASS** — `fullCanonicalStateMatch: true` on **both** maps, `firstDivergence: null` |
| `node scripts/catchmentInvariants.mjs` | **PASS**, all cases |
| `node scripts/livingEcologyFoodPipelineAudit.mjs` | **PASS** |
| `node scripts/mobilityAuthorityAudit.mjs` | **PASS** |

**No inherited failures were encountered in this set.** `expeditionLifecycleAudit` remains the
known inherited failure recorded by CORRECTION-26 (it fails identically at `f947550`); it is
unrelated to crowding and was not rerun as part of this scope.

---

## 11. What this pass does not prove

- **[NOT PROVEN]** Any long-horizon effect. No 200-year or 500-year matrix was run.
- **[NOT PROVEN]** That the simulation is better off. Population, bands, survival and fissions are
  unchanged at 20 years; one move differs. No improvement is claimed in either direction.
- **[NOT PROVEN]** That `getParentCoreOverlap`'s surviving memory→pressure path is harmless. It is
  measured and reported, not evaluated (§8).
- **[NOT PROVEN]** Anything about the remaining AUDIT-27 seams — double-counting, encounter
  provenance, range release, physical-activity footprint. All remain exactly as AUDIT-27 found
  them, and this pass's reruns confirm they did not move.
- The behavioural comparison rests on **six runs at 20 years**. Five are identical, which makes the
  isolation claim strong; it does not make the aggregate a population result.
