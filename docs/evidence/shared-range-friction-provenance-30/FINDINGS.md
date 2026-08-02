# CORRECTION-30 — FINDINGS

**SHARED RANGE — RANGE-FRICTION OBSERVATION PROVENANCE**

Branch `checkpoint/shared-range-friction-provenance-30`, from the accepted and frozen
CORRECTION-29 tip `a15d0a78a3a7ef57b87b22226190d6729ba9b9d7`.
`main` untouched at `0a43083a3a9103bc6b8f693b8823a604ae2c6a8d`.

**Verdict: PASS.** Roadmap item 3 (Crowding / Shared Range / Range Release) remains **OPEN**.

---

## 1. What was happening

A band could learn that another band was living somewhere, or had worked a place, **purely
by reading that other band's private records**. `rangeFriction.ts` contained no distance
computation of any kind — no `getGridDistance` import, no `distance` identifier in 800 lines.
Its only condition was *"is this tile one I remember?"*

Three separate reads of private state, all in the same module:

1. **`other.position`** (`:127-140`) → an `observed` `residential_presence` notice whenever
   the other band's tile fell anywhere in the observer's remembered country. Candidates came
   from proximity **or** kinship **or** any entry in `contactMemories` — the last two with no
   distance limit at all.
2. **`other.recentIntraSeasonTrips`** (`:141-163`) → an `inferred_from_recent_activity`
   notice with a `linkedActivityTripId` and an activity kind read straight off the other
   band's private `taskGroupType` / `objective` / `cause` / `movementType` /
   `resourceClassId` / `pathTiles`. The window was 12 ticks — **twelve seasons, three
   simulated years**.
3. **`countRecentTripsInRange`** (`:624-633`) → the *same* private trip list, read a third
   time, to inflate `recentOverlapCount` on the **residential** notice. That is the value
   driving `repeated_outsider_use` (≥ 3) and `moderate_placeholder` tension (≥ 4).

A place being familiar to the observer proves the observer knows the **place**. It does not
put the observer at it, and it says nothing about who else is there now.

**These records were not inert.** The module header claimed no movement, conflict,
demography, stress, yield, support or territory rule reads them. That is true of *direct*
readers only. Through `accessNorms.ts:426` the records set `strangerCaution`,
`sharedUsePressure` and `rememberedRefusalAvoidance`, which produce
`ProtoAccessBehaviorEffectState`, which `pressure.ts:161-166` consumes as five real decision
inputs. Separately `innerFission.ts:145` turns them into social tension, and
`reportedKnowledge.ts:648` republishes the top three as outgoing `outsider_use_warning`
reports to other bands. The header is corrected in this commit.

---

## 2. Was it genuinely fixed?

Yes, and the proof is a controlled fixture that produces the defect on the frozen commit and
does not produce it here, with the identical script.

**Headline, P1 — both arms, same script, same seed, same world.** Two bands **42 tiles
apart**, no encounter, no report. The other band's newest **real production** trip record is
retargeted at a tile the observer remembers (an `edge` tile, `tile:191:88`).

| | before (`a15d0a78`) | after |
| --- | --- | --- |
| verdict | `PRIVATE_TRIP_CREATES_FRICTION` | `NO_SOCIAL_FRICTION_RECORD` |
| records naming the other band | 1 | **0** |
| `inferred_from_recent_activity` | 1 | **0** |
| `linkedActivityTripId` written | 1 | **0** |
| activity kind claimed | `crossing_or_route_use` | none |
| interpretation | `ford_overlap` | none |
| the other band's trip record | survives | **survives** |

**P2 — hidden residence.** The observer is seeded with its own `observedTiles` +
`placeMemory` for the ground the other band stands on, 42 tiles away. Before: **2 records, one
of them `observed` `residential_presence`**, with `recentOverlapCount` **6** (inflated by the
private trip counter). After: **0**.

**P6 — old contact, hidden current trip.** Two bands meet for real over six seasons, then
separate to 40 tiles, then the other band takes a hidden trip into the observer's country.
Before `OLD_CONTACT_REVEALS_NEW_TRIP`; after `OLD_CONTACT_REVEALS_NOTHING_CURRENT`. **The
contact memory is retained in both arms** — this is not achieved by forgetting anyone.
`maxRecentOverlapCount` falls 25 → 9 (9 = 1 + the 8-slot ring cap, exactly as designed).

**P7 — the physical/social split.** Same construction, both arms. Social knowledge 1 → 0
while every physical reading is **byte-identical**: position, `weightedCrowding`,
`crowdingPenalty`, `meanCatchmentShare`, `footprintTiles`, `overlappingBandIds`,
`perCapitaReturn`, `sharedReachableSupport` (144.56 observer / 35.79 other),
`tileDepletionHere` (0.0662 / 0.1857), `tripRecordCount` (24 / 24).

**The result was not obtained by** deleting the trip, moving the other band, deleting the
observer's place memory, suppressing every friction event, suppressing reports, changing
fixture duration, or changing simulation speed. Each of those is asserted false by the
fixture data itself, and the legitimate channels below prove it directly.

### Fixtures P1–P15, both arms, **0 vacuous in both**

| | question | before | after |
| --- | --- | --- | --- |
| P1 | unobserved band's private trip into remembered country | `PRIVATE_TRIP_CREATES_FRICTION` | **`NO_SOCIAL_FRICTION_RECORD`** |
| P2 | hidden residence in remembered country | `HIDDEN_RESIDENCE_BECOMES_OBSERVED` | **`NO_SOCIAL_FRICTION_RECORD`** |
| P3 | physically adjacent bands | `LEGITIMATE_DIRECT_FRICTION_PRESENT` | unchanged |
| P4 | a legitimate encounter | `ENCOUNTERED_PAIR_STILL_PRODUCES_FRICTION` | unchanged |
| P5 | a second-hand report | `REPORT_LINKED_FRICTION_STAYS_SECONDHAND` | unchanged |
| P6 | old contact, hidden current trip | `OLD_CONTACT_REVEALS_NEW_TRIP` | **`OLD_CONTACT_REVEALS_NOTHING_CURRENT`** |
| P7 | physical competition without awareness | `SOCIAL_KNOWLEDGE_PRESENT` | **`PHYSICAL_PRESENT_SOCIAL_ABSENT`** |
| P8 | trip outside familiar country (negative control) | `NO_FRICTION_EITHER_ARM` | unchanged |
| P9 | false access cascade | `NO_ACCESS_CASCADE` | unchanged — see §6 |
| P10 | false social-tension cascade | `NO_SOCIAL_TENSION_CASCADE` | unchanged — see §6 |
| P11 | uncertainty preserved | `UNCERTAINTY_PRESERVED` | unchanged |
| P12 | band-order invariance | `ORDER_INVARIANT` | unchanged |
| P13 | step-mode invariance | `STEP_MODE_INVARIANT` | unchanged |
| P14 | ring caps | `RINGS_BOUNDED` (max 8/8) | unchanged |
| P15 | terminal bands | `NO_FRICTION_FROM_TERMINAL_BAND` | unchanged |

Two fixtures were vacuous in their first form and were **repaired, not counted**: P3 relied
on two bands staying adjacent through warming and drifted apart
(`VACUOUS_BANDS_DRIFTED_APART`); P12 spawned onto a fixed offset triple and silently got
fewer than three bands (`VACUOUS_SPAWN_FAILED`). P3 now parks the neighbour relative to the
observer's post-warming position, and P12 finds spawnable tiles by trial spawn.

---

## 3. What changed in the simulator

**One production file, `src/sim/agents/rangeFriction.ts`, +71 −112.** Nothing else in
`src/` was touched.

- `derivePairNotices` now takes the observer's current physical proximity set and returns
  `[]` when the other band is not in it. The set is `cache.nearbyBandsByBandId`, built by
  `buildTickContextCache` at `DEFAULT_NEARBY_RADIUS = 4` — **the same canonical authority**
  CORRECTION-28 kept for physical crowding and CORRECTION-29 kept for encounter candidacy.
  No new constant, no new type, no new module, no new import.
- The recent-trips block, `classifyTripActivity`, `makeTripId`, `compareTrips` and
  `RANGE_FRICTION_TRIP_WINDOW_TICKS` are deleted.
- `countRecentTripsInRange` is replaced by `countObserverNoticesOfBand`, which reads the
  observer's **own** friction ring — "how many times have I recently seen them here" —
  bounded by the 8-slot ring, so `recentOverlapCount` cannot exceed 9.
- `linkedActivityTripId` is removed from the module's internal `PairNotice` shape, making it
  structurally impossible to produce from a private trip record again. The field stays on
  `RangeFrictionEvent` in `types.ts` as the correct vocabulary for a future
  witnessed-activity or trace-read channel; nothing writes it today.
- `deriveCandidateBands` is **unchanged** — it is a selection set, not an evidence claim, and
  nearby bands are added first so the 12-slot cap can never crowd one out.
- `deriveReportLinkedEvents` is **unchanged**.
- The module header is corrected about the cascade.

### Architecture chosen, and what was rejected

Option **A (proximity/encounter-only direct friction) + C (remove private activity reads)**.
Full comparison in `ARCHITECTURE_DECISION.md`.

- **B (a bounded observer-evidence interface)** — rejected as premature. Three of its four
  cases do not exist here and a fourth (encounter) is subsumed by proximity.
- **D (implement physical traces now)** — rejected, and **not** because it is hard.
  Inspection found **no canonical physical trace authority of any kind**: no tracks, no
  trails as world features, no camp remains (`TemporaryTaskPartyRecord` asserts
  `noCamp: true`), no freshness, no cross-band smoke (`fireSignals.ts` resolves one band's
  own deliberate signal to its own camp), and no band or person cue in
  `landscapeVisibility.ts` — its `LandscapeVisibilityCueKind` union is entirely terrain.
  Choosing D would have meant inventing witnesses, which §9.9 forbids.
- **E1 (gate the trip channel on proximity to the target tile)** and **E2 (downgrade its
  confidence)** — both rejected on inspection. E1 cannot bridge time: trip records carry a
  tick and a day but **no band's position is stored per day**, so co-presence at the time of
  the trip is unrecoverable. E2 relabels unsupported knowledge as low-confidence knowledge,
  which still feeds the cascade.

**Encounter-linked evidence is subsumed, and that is measured rather than asserted.**
Encounter admission is ≤ 3, proximity is ≤ 4, and `applyEncounterContext` runs immediately
before `advanceRangeFriction` on the **same cache**, so a separate encounter branch could not
admit anything the proximity gate does not. Fixture P4 measures that encountered pairs still
get friction; the natural audit reports `encounterLinkedRecords` as its own count.

---

## 4. Which legitimate friction channels remain

Natural occurrence, run **unchanged on both arms** over the same maps, seeds
(`audit27:natural`, s1/s2), scenarios (map1 / map2 / ordinary) and 20-year duration
AUDIT-27, CORRECTION-28 and CORRECTION-29 used. **2,400 living band-seasons per arm.**
Records are classified **at creation**, using the distance at that tick.

| provenance class | before | after |
| --- | ---: | ---: |
| range-friction records created (total) | 148 | **61** (−87, −58.8%) |
| direct observed presence | 31 | 28 |
| inferred from recent activity | **84** | **0** |
| report-linked | 33 | **33** |
| encounter-linked (subset of observed) | 25 | 24 |
| sourced only from private other-band **position** | **0** | **0** |
| sourced only from private other-band **trips** | **84** | **0** |
| records carrying `linkedActivityTripId` | 84 | **0** |
| unique observer/other pairs | 2 | 2 |
| max friction ring length | 8 | 8 |
| max creation distance | 9 | 9 |

Confidence distribution `{observed 31, inferred 84, reported 33}` → `{observed 28, reported 33}`.
Creation-distance buckets `{2-3: 108, 4: 22, 5-10: 18}` → `{2-3: 40, 4: 9, 5-10: 12}` (the
5-10 bucket is report-linked records, whose "other band" is the report's distant source).
Interpretation `ford_overlap` 72 → 18, `noticed_shared_use` 5 → 2, `possible_intrusion`
17 → 0, `repeated_outsider_use` 21 → 8, `avoid_warning_remembered` 33 → 33.
Tension `watchful` 41 → 36, `none` 69 → 17, `mild` 21 → 1, `moderate_placeholder` 17 → 7.

**Reported awareness is untouched: 35,776 → 35,776 records, 33 → 33 report-linked friction
events.** The report channel was neither suppressed nor upgraded.

**A limit stated rather than buried: defect chain A has a natural occurrence of ZERO.**
`recordsSourcedOnlyFromPrivatePosition` reads **0 in both arms**. In these worlds, bands only
ever became residential-friction subjects while genuinely nearby, so the entire −87 comes
from chain B (private trips). The hidden-residence repair is proven **only by the controlled
fixture P2**, and no natural credit is claimed for it. The metric can over-count but not
under-report false positives (the ring is sampled at end of tick while
`advanceRangeFriction` also runs pre-decision), and it reads zero, so there is nothing to
discount.

**AUDIT-27's own unmodified natural instrument agrees, and isolates the change completely.**
Of its 24 aggregates, **exactly one moves**: `rangeFrictionEventsObserved` **148 → 61** —
the same two numbers my independent instrument produced. Everything else is identical,
including `crowdingPenaltyNonZeroBandSeasons` 51, `doubleCountedBandSeasons` 40,
`pressurePersistedAfterDeparture` 55, `movesTotal` 1,547, `accessMemoryStatesNonNone`
18,417, `memoryOnlyOverlapPairs` 25, `nearResidencePairs` 28, `overlappingPhysicalActivityPairs`
25, `sharedCatchmentContestedTileSeasons` 43, `terminalBandContributingToPressure` 0 and
`hiddenCrowdingNoPerceptionBandSeasons` 0. Its friction relation split moves
`stranger_or_unrecognized` 8 → 3 and `familiar_neighbor` 140 → 58.

### The physical layer did not move

Every physical aggregate is **identical** between arms, across 17 checked keys:

```text
weightedCrowdingSum            2.51        bandSeasonsWithCrowding           56
catchmentClaimTileSeasons      26,515      contestedCatchmentTileSeasons     43
sharedReachableSupportSum      114,381.8   perCapitaReturnSum                1,305.41
tileDepletionSum               3,419.5131  tileDepletionNonZeroTiles         41,278
tripRecordSeasons              57,600      moves                             1,547
fissions                       0           finalPopulation                   817
finalLivingBandCount           30          survived                          6/6
livingBandSeasons              2,400       seasons                           480
```

---

## 5. What behaviour changed naturally

**Five of six 20-year runs are identical on every traced field.** The sole divergent run is
**map2 seed s1**, which is also the only run that produces any friction at all in either arm.

**In all six runs, `firstPhysicalDivergenceTick` is `null`** — position and population never
diverge anywhere. Moves 1,547 → 1,547, population 817 → 817, living bands 30 → 30, survival
6/6, fissions 0 → 0.

**First divergence: map2 s1, tick 32**, band `varied-dry-corridor-mid`, social only:

```text
frictionRing            3    -> 2
frictionInferred        1    -> 0
frictionWithTripId      1    -> 0
socialTensionPressure   0.25 -> 0.24
```

The first thing that changes is exactly the false record disappearing. 49 seasons of that
run diverge, all social.

**No improvement is claimed.** Population, bands, moves, survival and fissions are unchanged
at 20 years, and no long-horizon matrix was run. Truthful provenance is the acceptance
criterion; no weight, threshold or coefficient was recalibrated to restore any previous
number.

### The one non-subtractive change, isolated with a third arm

Removing the false records does **not** simply reduce downstream pressure. Aggregate access
pressure moves slightly **up**:

| | before | after | delta |
| --- | ---: | ---: | ---: |
| `strangerCautionSum` | 298.32 | 300.64 | +2.32 |
| `sharedUsePressureSum` | 182.11 | 189.04 | +6.93 |
| `rememberedRefusalAvoidanceSum` | 2,547.08 | 2,551.35 | +4.27 |
| `socialTensionSum` (2,400 samples) | 605.79 | 606.55 | +0.76 |
| `accessBehaviorHookSum` | 148.68 | 148.68 | 0 |
| access states `tolerated_shared_use` | 70 | 83 | +13 |

Rather than guess, a **third arm** was run: the corrected tree with `recentOverlapCount`
pinned to `1`, isolating the observer-memory re-sourcing from the removal of the private
reads. Same maps, seeds and duration.

| | before | **overlap pinned to 1** | after |
| --- | ---: | ---: | ---: |
| records created | 148 | **61** | **61** |
| observed / inferred / reported | 31 / 84 / 33 | **28 / 0 / 33** | **28 / 0 / 33** |
| `sharedUsePressureSum` | 182.11 | **164.49** | 189.04 |
| `strangerCautionSum` | 298.32 | **290.34** | 300.64 |
| `rememberedRefusalAvoidanceSum` | 2,547.08 | **2,536.32** | 2,551.35 |
| `socialTensionSum` | 605.79 | **605.21** | 606.55 |
| `tolerated_shared_use` states | 70 | **35** | 83 |
| tension `moderate_placeholder` | 17 | **0** | 7 |

Two things follow, both measured rather than argued:

1. **The record counts are identical between the isolation arm and the shipped arm.** The
   −87 records are caused entirely by removing the private reads. The `recentOverlapCount`
   re-sourcing changes *how surviving records read*, never *how many exist*.
2. **The access-pressure rise is entirely the re-sourcing.** Removing the private reads alone
   drops `sharedUsePressure` by 9.7% (182.11 → 164.49); the observer-memory count adds
   +24.55 back.

**Why the shipped choice is the count and not the pin.** With the count pinned to 1 the
highest tension tier, `moderate_placeholder`, becomes **structurally unreachable** (17 → 0),
and the 8 records that read `repeated_outsider_use` in the shipped arm read
`possible_intrusion` instead — the same records, reclassified. §9.4 requires that a genuinely
supported case still be *capable* of producing appropriate contemporary friction; making the
top tier unreachable would come close to disabling part of the system. Repeated observation
of the same band in one's own country is precisely what "they keep using our place" means,
and it is now derived from the observer's own memory rather than from the other band's
diary. **This is the one place where this checkpoint's behaviour is not purely subtractive,
and it is reported as such.**

---

## 6. Limitations and suspicious findings

1. **P9 and P10 are unchanged passes in BOTH arms and are NOT credited as repairs.** The P1
   construction produces a single low-tension record; the trip target never enters the
   8-slot access memory at all (`placeExists: false`), and a record with `tensionLevel: none`
   contributes zero to `rangeFrictionTension`. The nulls are real, not instrument blindness:
   a **positive control** in each fixture strips the friction ring from a world where real
   friction exists and shows the probes move — access state `familiar_use` →
   `tolerated_shared_use`, `strangerCaution` 0 → 0.13, `sharedUsePressure` 0 → 0.24,
   `socialTensionPressure` 0.22 → 0.26. The cascade *is* live; this particular case never
   reached it in either arm. (This is the same honest shape as CORRECTION-29's P9.)

2. **Chain A has zero natural occurrence** (§4). Its repair rests on a controlled fixture.

3. **Proximity is a coarse stand-in for "could see them."** Radius 4, symmetric, no terrain,
   no line of sight, no attention, no time of day. It is reused rather than invented — but it
   is the model's whole detection theory, and it is thin. Production still has **no
   visibility, route or barrier rule** for social perception of any kind; CORRECTION-29
   recorded this for encounters and it is equally true here.

4. **Detection is treated as symmetric and identification as free.** In reality one group can
   be seen without seeing, and a group seen at distance is often not identifiable.
   `RangeFrictionEvent` requires a concrete `otherBandId`, so "somebody, unknown" is not
   expressible.

5. **The AUDIT-27 range-release timeline probe moved in exactly two fields**, both
   `observerAccessSharedUsePressure` (0.02 → 0.07 and 0.03 → 0.08) — the §5 re-sourcing again.
   Every other field of the release timeline is identical and the release *lifecycle* is
   untouched. `RANGE_FRICTION_MAX_AGE_TICKS`, `FRICTION_RECENT_WINDOW_TICKS`,
   `REPORT_RECENT_WINDOW_TICKS`, access-memory staleness and release behaviour were **not
   changed** (§14). Diff recorded in `reruns/audit27-release-timeline-diff.json`.

6. **The one metric that fell without an obvious cause: `directObservedPresenceRecords`
   31 → 28.** No observed record was ever created beyond the proximity radius in either arm,
   so these three are not ungrounded records being removed. `makeEventId` includes
   `interpretation`, which depends on `recentOverlapCount`, so the same physical situation
   now yields a different sequence of distinct event ids. It is a **re-identification**, not a
   loss — but it was not separately isolated and is reported as an unresolved detail rather
   than explained away.

7. **The report loop is only half-cut.** `rangeFriction.ts:250` blocks a band's *own* reports
   from seeding its own friction (the 2026-07-10 rumour-loop fix). A false record travelling
   to a neighbour as an `outsider_use_warning` and returning is still structurally possible;
   it matters much less now that far fewer false records exist, but it was not addressed.

8. **Not run, deliberately:** no 200-year or 500-year matrix, no performance measurement, no
   fresh-process determinism run, no `simBenchmark` fingerprint comparison (production
   behaviour changed, so parity is neither claimed nor possible).

9. **Inherited failure, not touched:** `expeditionLifecycleAudit` was recorded FAILING
   identically at CORRECTION-26's base and tip. It was not rerun here and is not claimed
   fixed.

---

## 7. What the supervising human must do next

1. Decide whether the `recentOverlapCount` re-sourcing (§5) is the semantics you want.
   It is the only judgement call in this pass, it is fully isolated, and reverting it is a
   one-line change with a measured consequence (`moderate_placeholder` becomes unreachable).
2. Close or reject this checkpoint. **Roadmap item 3 does not close on it.**
3. The next AUDIT-27 seam is **range release** — friction expires on a fixed 48-tick clock
   that never observes departure, and access expectations drift toward `avoided_shared_use`
   after the neighbour leaves (`C5` still reads
   `PHYSICAL_RELEASES_PERCEPTION_DOES_NOT`). It is now unblocked, because the false records
   that would have polluted a release measurement are gone.

Still open from AUDIT-27, each needing its own checkpoint: crowding double-counting in
`computeCandidateScore`; the residence-anchored physical shared-use footprint;
`territorialPressure` (a spawn constant with three behavioural readers and no writer); and
`nearbyBandPressure` / `crowdingPenalty` weighting.

---

## 8. Technical report

### 8.1 Git

```text
base            a15d0a78a3a7ef57b87b22226190d6729ba9b9d7   (CORRECTION-29, CLOSED and FROZEN)
branch          checkpoint/shared-range-friction-provenance-30
main            0a43083a3a9103bc6b8f693b8823a604ae2c6a8d   (local and remote, untouched)
merge-base      0a43083a3a9103bc6b8f693b8823a604ae2c6a8d
CORRECTION-28   c5eb58a  frozen        AUDIT-27  b352c31  frozen
worktrees       one at entry; a temporary detached read-only worktree at a15d0a78 was used
                for the before arm and removed afterwards. Nothing was committed from it.
stashes         none
```

Production change: **one file**, `src/sim/agents/rangeFriction.ts`, +71 −112.

New audit scripts (four): `rangeFrictionProvenanceFixturesAudit.mjs`,
`rangeFrictionProvenanceNaturalAudit.mjs`, `rangeFrictionProvenanceBehaviorTrace.mjs`,
`rangeFrictionProvenanceCompare.mjs`.

### 8.2 Validation executed on this branch

| check | result |
| --- | --- |
| `npx tsc -p tsconfig.json --noEmit` | PASS |
| `npx tsc -p tsconfig.node.json --noEmit` | PASS |
| `npm run build` | PASS |
| `node scripts/checkGraph.mjs` | PASS — graph 221/764, 0 dup, 0 dangling |
| `node scripts/importBoundaryAudit.mjs` | PASS — internal back edges 85, unchanged |
| `node scripts/seasonOrderInvarianceAudit.mjs` | PASS — ascending/descending/permuted identical |
| `node scripts/stepModeInvarianceAudit.mjs` | PASS — **both maps**, `fullCanonicalStateMatch: true`, `firstDivergence: null` |
| `node scripts/catchmentInvariants.mjs` | PASS — 0.5/0.5 symmetric split, per-capita 1.5 → 1.2 under contest |
| `node scripts/livingEcologyFoodPipelineAudit.mjs` | `"verdict": "PASS"` |
| `node scripts/mobilityAuthorityAudit.mjs` | `"verdict": "PASS"` |
| `git diff --check` | clean |

### 8.3 Reruns of prior checkpoints' own instruments

| audit | result |
| --- | --- |
| CORRECTION-29 fixtures (`encounterProvenanceFixturesAudit`) | **12/12 unchanged** |
| CORRECTION-28 fixtures (`crowdingMemorySeparationFixturesAudit`) | **12/12 unchanged** |
| AUDIT-27 fixtures (`crowdingControlledFixturesAudit`) | **11/11 unchanged vs the CORRECTION-29 tip**; C4 and C10b remain flipped (inherited from CORRECTION-28/-29), C5 range-release unchanged |
| AUDIT-27 release timelines | 2 fields changed, both `observerAccessSharedUsePressure`; lifecycle unchanged |
| AUDIT-27 natural occurrence | **1 of 24 aggregates moved** (`rangeFrictionEventsObserved` 148 → 61) |
| `socialCausalityAudit` | **byte-identical between arms** |

All reruns were given explicit `--out` paths. The three frozen evidence directories
(`crowding-shared-range-authority-27/`, `crowding-physical-memory-separation-28/`,
`shared-range-encounter-provenance-29/`) are **unmodified** — `git status --short` on them is
empty.

### 8.4 Evidence package

```text
docs/evidence/shared-range-friction-provenance-30/
  RESEARCH_AND_CAUSAL_MODEL.md          human causal model + 9-source bibliography
  ARCHITECTURE_DECISION.md              options A-E compared, A+C selected
  FINDINGS.md                           this file
  PROVENANCE.md                         evidence taxonomy §7
  authority-ledger.md                   writer/reader/provenance ledger
  before-after.json                     six headline requirements, all satisfied
  controlled-fixtures.json              P1-P15, after arm, 0 vacuous
  controlled-fixtures-before-arm.json   P1-P15, before arm, 0 vacuous
  natural-occurrence.json               provenance classes, after arm
  behavioral-comparison.json            first divergence, per run
  downstream-cascade.json               access / tension / report cascade + isolation arm
  reruns/                               prior checkpoints' own instruments, both arms
```

### 8.5 Claim provenance

- **Independently verified repository facts:** every file:line citation in
  `authority-ledger.md`; the absence of trace, smoke and band-visibility authorities; the
  `accessNorms → pressure.ts:161` cascade; `KnownBandContactMemory` carrying no position;
  `rangeFriction.ts` having contained no distance computation.
- **Executed by this implementation agent:** every number in §2, §4, §5 and §8.2–8.3,
  produced by scripts run unchanged on both arms.
- **Research-backed mechanisms:** the six detection routes, trace reading as a trained skill,
  monitoring as a cost, inter-camp visiting as the report channel — all sourced in
  `RESEARCH_AND_CAUSAL_MODEL.md` §4.
- **Implementation abstractions:** proximity-as-detection, symmetric detection, free
  identification, coarse activity — all listed in `RESEARCH_AND_CAUSAL_MODEL.md` §7.
- **Unresolved hypotheses:** the `directObservedPresenceRecords` 31 → 28 re-identification
  (§6.6); whether radius 4 is the right detection distance (untested in either direction);
  whether the surviving report loop (§6.7) matters.
