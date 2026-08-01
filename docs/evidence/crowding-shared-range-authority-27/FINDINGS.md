# AUDIT-27 — CROWDING / SHARED RANGE / RANGE RELEASE FINDINGS

Branch `checkpoint/crowding-shared-range-authority-27`, from the frozen CORRECTION-26 tip
`5f341648addcd4331e86d340f21d2a830b703095`. `main` untouched at `0a43083`.
**No production file is modified. This pass is documentary and diagnostic.**

Every claim below is tagged:

- **[MEASURED]** — a number produced by a probe in this pass, reproducible from `PROVENANCE.md`.
- **[CODE]** — a code-supported architectural fact, cited to file:line.
- **[INFERENCE]** — a conclusion drawn from the above; stated as such.
- **[HYPOTHESIS]** — not established by this pass.

---

## 0. Headline

Crowding is not absent, and it is not one thing. Production contains **one honest physical
shared-use authority** (`sharedCatchment` + world ecology), **one honest access-expectation
memory** (`protoAccessMemory`), and **one scalar that silently mixes physical proximity with
remembered overlap** (`crowding.ts`'s `CrowdingField`) and is then read back into the same
candidate score through six separately-weighted terms.

Three module headers assert inertness that the code does not honour. One perception path lets a
band acquire social knowledge of another band **44 tiles away** with no contact. One band field
is a frozen spawn constant with three live behavioral readers.

Crowding is also **rare**: over 7,360 measured active band-pair-seasons, only 26 had bands within
the crowding radius, and **not one of 1,547 residential moves carried a crowding reason.**

---

## 1. Mandatory git preflight

```
git status --short                                        (clean, no output)
git branch --show-current                                 checkpoint/crowding-shared-range-authority-27
git rev-parse HEAD                                        5f341648addcd4331e86d340f21d2a830b703095
git rev-parse origin/main                                 0a43083a3a9103bc6b8f693b8823a604ae2c6a8d
git rev-parse origin/checkpoint/resource-investigation-physical-26
                                                          5f341648addcd4331e86d340f21d2a830b703095
git merge-base HEAD origin/main                            0a43083a3a9103bc6b8f693b8823a604ae2c6a8d
git worktree list                                         one worktree only
git stash list                                            empty
```

`git log --oneline --decorate -n 8` at entry:

```
5f34164 (HEAD, origin/checkpoint/resource-investigation-physical-26) docs: stop calling a note left at the decision an execution
b07a1b6 audit: explain the outcome that never happens instead of leaving it untested
ef17952 audit: watch the walk, and find the instrument lying twice before the simulation did
84c2da3 sim: make a band walk to what it wants to know about
e59c9ad docs: name the real production outcome the ADR was going to reuse
b746b68 docs: decide how a seasonal investigation should physically happen
f947550 (origin/checkpoint/resource-investigation-authority-25) audit: map what a resource investigation physically is
ce723b3 (origin/checkpoint/ordinary-exploration-capacity-24) audit: make the final exploration evidence reproducible
```

All required starting conditions were met. CORRECTION-26 remains frozen; `main` was neither
merged, rebased, reset nor modified; no concurrent writer was present.

---

## 2. Do the four concepts stay separate?

| concept | authority | separated? |
| --- | --- | --- |
| **A** physical shared use | `sharedCatchment.SharedCatchmentIndex`; `world.tileDepletion` / fauna / plant / forest | **yes**, cleanly |
| **B** physical crowding / competition | `sharedCatchment` share division **and, separately,** `crowdingPenalty` | **no** — two independent penalties for the same event |
| **C** perceived shared range | `RangeFrictionEvent`, `BandEncounterRecord`, `WordOfMouthReport` | partly — but their provenance gates are on *place*, not on *observation* |
| **D** access expectations / range memory | `ProtoAccessMemoryState` | **yes**, and it is the best-built authority in the set |

**[CODE]** The one place all four collapse into a single number is `crowding.ts`'s
`buildCrowdingField` (`crowding.ts:170-277`), whose per-tile weight is

```
basePreclamp = (distanceWeight*0.58 + samePatchWeight*0.34 + memoryOverlap*0.24) * populationWeight
```

`distanceWeight`/`samePatchWeight` are physical proximity (A/B). `memoryOverlap` is the *other*
band's remembered places (C/D). They are summed before anything downstream can tell them apart.

---

## 3. §7.1 — What is the current physical use footprint?

**[CODE]** There is a canonical physical footprint, and it is `getBandForagingFootprint`
(`sharedCatchment.ts:47-85`): the band's persisted `residentialAnchor.catchmentTileIds`, or a
radius-2 ring-walk over its own known tiles, capped at 16 tiles, weighted by adult-equivalent
foraging draw and distance decay. `sharedCatchment.ts:44-46` explicitly makes it the single
source of truth shared with the carrying-capacity yield sum, so "what the band forages" and
"what it competes for" cannot diverge. That is correct.

**[CODE] What it does NOT contain.** Grepping every crowding and shared-use reader for the
physical-activity records production already writes:

- `band.recentIntraSeasonTrips` (real same-day trips, with `targetTileId`) — read by
  `familiarCountry`, `rangeFriction`, `accessNorms`; **never** by `sharedCatchment`,
  `crowding` or `carryingCapacity`.
- `band.expeditions` / expedition route tiles — **never** read by any crowding or shared-use
  authority.
- `PendingInvestigationRecord` execution routes (CORRECTION-26's new physical walks) —
  **never** read by any crowding or shared-use authority.

**[INFERENCE]** Physical shared use is therefore modelled as **residence-anchored catchment
overlap only**. Two bands whose parties walk the same route or work the same distant patch
compete for nothing. This is the single largest representational gap this audit found.

---

## 4. §7.2 — Is `familiarCountry` mistaken for physical occupation?

**[CODE] The module header is wrong on two counts.** `familiarCountry.ts:1-7` states it is
`NEVER called inside stepSim — so the simulation is byte-identical`, and every summary it
returns carries `noBehaviorChange: true`. In fact:

- `accessNorms.ts:154` calls `deriveFamiliarCountry` inside `deriveAccessMemory`, per band per
  candidate tile, from `applyProtoAccessContext` — which is in `updateBandContextStates`.
- `rangeFriction.ts:486` calls it inside `buildRangeMembership`, from `advanceRangeFriction` —
  also in `updateBandContextStates`.

Both run three times per tick. `deriveFamiliarCountry`'s output reaches behavior through
`familiarUseStrength` → `ProtoAccessMemoryState` → `pressure.ts:161-166` → `mobilityPressure` and
`netMovePressure`.

**[CODE] The more serious conflation is in `crowding.ts`, not `familiarCountry.ts`.** The
crowding field's memory channel scatters a contribution around every salient remembered place a
band holds, **independent of where that band now is** (`crowding.ts:204-233`). Nothing checks
whether the remembering band is still using the place.

**[MEASURED] C4 — obsolete crowding persists.** Band A was warmed at the shared ground for 16
seasons, then relocated to `tile:195:124`; band B was placed on one of A's salient remembered
tiles, `tile:194:90`. **Residence distance 35 tiles.** B still reads
`weightedCrowding = 0.03`, `crowdingPenalty = 0.01`, and `crowdingBandIds = ["band:custom:0"]` —
naming a band a day's march away that is not using the place. The proximity channel is zero; the
entire reading is the memory channel.

**[MEASURED] Memory-only overlap is more common than real overlap.** Over 7,360 pair-seasons:
**27 memory-only overlap pairs against 25 real physical-activity overlap pairs.** The remembered
channel is not an edge case; it is the majority of what production calls crowding.

**[INFERENCE]** A remembered place *should* keep cultural and strategic weight — that is what
`placeAttachment`, `returnPlacePull` and `expectedReturnBias` are for. It should not create
perpetual **physical** competition. The repair is to remove `memoryOverlap` from
`basePreclamp`, not to weaken memory.

---

## 5. §7.3 — Is physical competition symmetric?

**[MEASURED] Yes, and it is real.** Same-snapshot counterfactual, one frozen two-band world,
second band removed and the observer's whole context recomputed
(`double-counting-trace.json`):

| quantity | with neighbour | without | delta |
| --- | --- | --- | --- |
| `meanCatchmentShare` | 0.6923 | 1.0 | **−0.3077** |
| `sharedReachableSupport` | 109.84 | 160.63 | **−50.79 (−31.6%)** |

**[CODE]** The division is proportional to real claim weight (`getTileSupportShare`,
`sharedCatchment.ts:144-156`), and the index is built over `cache.activeBandIds` in sorted order
(`sharedCatchment.ts:107-128`), so both bands pay and neither's order of processing matters.

**[MEASURED] C9 — order invariance holds.** Ascending, descending and permuted band processing
produce **byte-identical** fingerprints over position, population, crowding, crowding penalty,
saturation pressure, mean catchment share, per-capita return, local band count, local population
estimate, friction count, access state, access behavior hook and tile depletion.

**[MEASURED] C1 — the second band costs the first.** Over a 16-season paired series on identical
ecology, the duo arm's mean catchment share falls below the solo arm's while the solo arm holds
1.0. Depletion at the observer's tile is consistently higher in the duo arm (e.g. season 1:
0.0368 vs 0.0159).

**[INFERENCE] Shared depletion already provides the physical competition, and crowding adds a
second penalty for the same extraction.** See §6.

---

## 6. §7.4 — Is crowding double-counted?

**[MEASURED] One physical event moves 13 derived quantities and 6 separately-weighted candidate-score
inputs.** Removing one overlapping neighbour from a frozen snapshot changes:

```
nearbyBandPressure        0.15 -> 0        crowdingPenalty       0.06 -> 0
rangeSaturation           0.15 -> 0.04     rsNearbyCrowding      0.15 -> 0
ccCrowdingPenalty         0.15 -> 0        rsLocalPopulationEstimate  54 -> 30
rsLocalBandCount             2 -> 1        safeFrontierPull      0.64 -> 0.68
mobilityPressure          0.09 -> 0.08     netMovePressure       0.13 -> 0.12
riskPressure              0.36 -> 0.35     meanCatchmentShare  0.6923 -> 1.0
sharedReachableSupport  109.84 -> 160.63
```

**[CODE] `computeCandidateScore` (`decisionScoring.ts:41-112`) consumes the same crowding
derivation through twelve additive terms:**

| score term | weight | path |
| --- | --- | --- |
| `nearbyBandPressure` | −0.24 | the scalar itself |
| `crowdingPenalty` | **−0.72** | the same scalar × terrain re-weighting |
| `rangeSaturation` | −0.34 | contains `weightedCrowding * 0.34` |
| `netMovePressure` | +0.72 | contains `crowdingPenalty * 0.2` and `daughterDispersal * 0.18` |
| `mobilityPressure` | −0.05 | contains `crowdingPenalty * 0.2` |
| `placeAttachmentPull` | +0.40 | subtracts `crowdingPenalty * 0.22` |
| `localUsePressure` | −0.44 | the band's own use intensity is multiplied by `(1 + weightedCrowding*0.28)` at `pressure.ts:461-464` |
| `parentCoreOverlap` | −0.16 | daughter dispersal |
| `crowdingExploreBoost` | +0.48 | same scalar |
| `saturationExploreBoost` | +0.58 | saturation, which contains the scalar |
| `daughterDispersalExploreBoost` | +0.70 | contains `weightedCrowding * 0.36` |
| `perCapitaReturn` | +0.24 | shared-catchment share **and** a separate `saturationPenalty` |

**[CODE] Two of these are not distinct consequences.** `nearbyBandPressure` and
`crowdingPenalty` are the *same* number, the second multiplied by a terrain factor
(`getCrowdingPenalty`, `crowding.ts:486-498` — it introduces **no new evidence**). Both are
subtracted from the same score, 0.24 + 0.72 = 0.96 of combined weight for one event.
`rangeSaturation` then subtracts a third share of it.

**[CODE] Two more are genuinely distinct and should be kept.** The shared-catchment share is a
*physical return*, and `saturationPenalty` (`carryingCapacity.ts:429-449`) is a *sustained*
over-capacity effect gated on two consecutive derivations. These represent real, different
consequences of the same event, not repeated penalties.

**[CODE] Two channels are architecturally present but did not move in the same-snapshot arm.**
`placeAttachmentPull` and `localUsePressure` are written *during* the tick (in `applyBandDecision`),
not derived from the frozen snapshot, so the counterfactual cannot see them. Their code paths are
cited above; their magnitudes are **not measured by this pass**.

**[INFERENCE]** The system does not merely read one signal from several places — that would be
fine. It applies the **same scalar as a full penalty at least three times** in one score, on top
of a real physical cost that is already charged through the support ratio.

---

## 7. §7.5 — What currently makes a range "shared"?

**[CODE] Production's answer, in order of what actually fires:**

1. **Residence proximity ≤ 4** (`CROWDING_RADIUS`, `crowding.ts:15`) → crowding.
2. **Anchor-catchment / radius-2 footprint overlap** → shared-catchment division. *This is the
   only physical one.*
3. **Salient memory of a tile within distance 2 of another band's position** → crowding, at any
   distance (§4).
4. **Residence proximity ≤ 4** (`LOCAL_RANGE_RADIUS`, `socialContext.ts:78`) → local population
   estimate → saturation.
5. **The other band's position or private trip target falling inside the observer's familiar
   country** → range-friction notice (`rangeFriction.ts:120-150`).
6. **Two bands naming the same top return place** → encounter candidacy, *no distance gate*
   (`socialContext.ts:1952-1978`).
7. Kin relation → tolerance modifiers, never a sharing criterion by itself.

**Not** a criterion: overlap of activity routes; overlap of target patches outside the anchor
catchment; expedition overlap; repeated use across time as such.

**[MEASURED] C2 — nearby residence and shared activity are not separable at the production
radii.** Across separations 1–8, there was no season with `weightedCrowding > 0` and zero
footprint overlap. The crowding radius is 4 and the fallback footprint radius is 2 per band, so
the two conditions coincide almost exactly.

**[MEASURED, and this corrects the C3 fixture] C3 — shared physical activity without nearby
residence IS representable, but the fixture was too narrow.** The controlled fixture reported
`NOT_REPRESENTABLE_IN_FIXTURE` across separations 5–10. The natural-occurrence audit, which is
the authority here, found **4 pair-seasons with real footprint overlap while residence distance
exceeded the crowding radius** — these arise when a band's persisted `residentialAnchor`
catchment reaches further than the radius-2 fallback. The mechanism exists; it is rare, and the
fixture failed to construct it. **Do not cite the C3 fixture verdict.**

---

## 8. §7.6 / §7.7 — What releases a range, and at what speed?

**[MEASURED] The C5 release timeline** (`release-timelines.json`): real overlap established at
season 6, then band B relocated 34 tiles away and 16 further seasons observed.

| authority | behaviour after departure |
| --- | --- |
| `weightedCrowding`, `crowdingPenalty` | **0 immediately**, stay 0 |
| `overlappingBandIds`, `meanCatchmentShare` | overlap empty, share back to **1.0 immediately** |
| `rsLocalBandCount` | 2 → 1 **within one tick** |
| `tileDepletion` at the overlap tile | **0.0408 → 0.0359 → 0.0310 → 0.0261 → 0.0212 → 0.0163 → 0.0114 → 0.0065 → 0** — a clean physical recovery over 8 seasons |
| `observerContactMemoryAboutDeparted` | **1 for all 17 seasons** |
| `observerFrictionAboutDeparted` | **8 for all 17 seasons — no release at all** |
| `observerAccessSharedUsePressure` | 0.06 → 0.02 → … → **0.17 at season 6, 0.17 at 9, 0.18 at 14, 0.19 at 16** |
| observer access state | reaches **`avoided_shared_use` at seasons 6, 9, 14 and 16** — *long after* the other band left |

**[CODE] Why friction does not release.** `mergeEventRing` (`rangeFriction.ts:654-672`) prunes
only on `age > RANGE_FRICTION_MAX_AGE_TICKS = 48`, and `collectTileFrictionEvents`
(`accessNorms.ts:426-432`) filters on the same fixed 48-tick window. **The only release mechanism
is a fixed 12-simulated-year clock that is completely independent of whether the other band is
still there.** Nothing observes departure.

**[INFERENCE] This is the release defect.** The prompt's §7.7 table asks which effects should
release at different speeds. Production currently gets three of them right and two wrong:

| effect | should | production |
| --- | --- | --- |
| same-day physical congestion | end quickly | ✅ ends immediately |
| ecological depletion | recover through ecology | ✅ 8-season physical recovery |
| recent outsider-use suspicion | fade over encounters/time | ❌ fixed 48-tick clock, blind to departure |
| familiar-country memory | fade gradually | ✅ `recency = clamp(1 - age/40, 0.15, 1)` |
| return-place attachment | may persist longer | ✅ persists |
| access expectations | persist but remain revisable | ⚠️ revisable, but **drifts toward `avoided_shared_use` after the neighbour leaves** |
| territorial ownership | does not exist | ✅ does not exist |

**[MEASURED] C6 — terminal release is clean.** Dispersed, absorbed and extinct were each tested
from a season-0 world with confirmed pre-terminal overlap (`beforeWeightedCrowding = 0.15`,
`beforeOverlapping = ["band:custom:1"]`). In all three cases crowding fell to **0 immediately**,
the overlap list emptied, and the band was still absent one season later. **`terminalBandContributingToPressure = 0`
across all 7,360 natural pair-seasons.** No terminal band produces physical crowding.

---

## 9. §7.8 — Is the social layer anti-omniscient?

**No, in two places.**

**[CODE] (a) Encounter candidacy has no distance gate.**
`getEncounterCandidatePairs` (`socialContext.ts:1952-1978`) adds a pair whenever two bands'
`topReturnPlaceIds` name the same tile, with **no proximity condition**. `getEncounterKind`
(`socialContext.ts:1718-1746`) then returns `unrelated_overlap` / `shared_resource_area` whenever
`memoryOverlap > 0.24` **at any distance**, and `getSharedMemoryOverlap`
(`socialContext.ts:1774-1803`) computes that overlap by reading the *other* band's private
`placeMemory` directly.

**[MEASURED] C10b.** Two warmed bands separated to **44 tiles**, given one shared remembered
tile, stepped one season with the observer's contact record cleared first. Result: **a contact
memory naming the distant band, and a range-friction event naming it.** No proximity, no
encounter, no report — memory coincidence alone.

**[CODE] (b) Range-friction provenance is gated on place, not observation.**
`derivePairNotices` (`rangeFriction.ts:120-150`) reads `other.recentIntraSeasonTrips` — another
band's private activity log — and admits a notice whenever the trip's target tile is inside the
observer's own familiar country. There is no check that the observer was present, could see, or
was told.

**[CODE] (c) Hidden reads that are arguably legitimate.** `getLocalPopulationEstimate`
(`socialContext.ts:1600-1632`) sums every band's population within radius 4 with no perception
gate, and `crowding.ts`'s field reads exact positions. **[INFERENCE]** These are defensible as
*physical density a band experiences through its returns* — a band need not know who is nearby to
find less food — provided the resulting identities never reach a social reader. That condition
currently holds by luck rather than design: `band.pressureState.crowdingBandIds` carries real
`BandId`s on canonical band state, and its only production reader is `reportedKnowledge.ts:965`,
a `.length > 0` check.

**[MEASURED] C10 — ecology is affected from season 0** (mean share 0.6923 vs 1.0, depletion
0.0368 vs 0.0159) — but the two bands are adjacent, so the contact memory that appears at season 1
is legitimate. **C10 is not a clean unseen-band test and is not cited as one.** C10b is the
authoritative probe for this question.

**[MEASURED]** `hiddenCrowdingNoPerceptionBandSeasons = 0` naturally — but only because
`contactMemories` is almost never empty. That metric is weak and is reported, not relied on.

---

## 10. §7.9 — Are kin effects justified and reversible?

**[MEASURED] C7 — kinship does not change physical competition, and that is correct.** Identical
geometry and demography; the only difference is `parentBandId` / `daughterBandIds`:

| | stranger | kin |
| --- | --- | --- |
| `meanCatchmentShare` | 0.6923 | **0.6923** |
| `overlappingBandIds` | `[band:custom:1]` | `[band:custom:1]` |
| `weightedCrowding` | 0.15 | **0.11** |
| `crowdingPenalty` | 0.06 | **0.04** |

**[CODE]** `crowding.ts:77` applies `kinFactor = 0.72` to the crowding scalar;
`sharedCatchment.ts` applies **no** kin factor anywhere. So a kin group consumes exactly the same
resources — correct — while the crowding *scalar* is discounted.

**[INFERENCE] The discount is applied to a mixed-purpose scalar.** `crowdingPenalty` feeds
`riskPressure` and `mobilityPressure` (social/behavioral, where kin tolerance belongs) **and**
`carryingCapacity.perCapitaReturn.crowdingPenalty` and `habitatYield` (physical, where it does
not). A 0.72× kin discount therefore leaks a small physical benefit. The magnitude is **not
measured** by this pass.

**[CODE] Kin recognition is not gated on the band knowing it.** `isKinOverlap`
(`crowding.ts:680-686`) reads `parentBandId` / `daughterBandIds` directly. There is no check
against `band.contactMemories` or lineage knowledge. **[INFERENCE]** For parent/daughter this is
probably defensible (a band knows who split from it); for siblings after generations of
separation it is an omniscient genealogy read, which §14 of the prompt excludes from scope.

**[MEASURED] The entire kin branch has zero natural exercise.** `kinOverlapPairs = 0` across all
7,360 pair-seasons; `stranger` accounted for all 25 physical overlaps. Daughter Viability
(roadmap item 4) must not assume this machinery is live.

---

## 11. §7.10 — Does range release restore actual opportunity?

**[MEASURED] Partly — and the recovery is real ecology, not a declining abstraction.** The C5
timeline shows `tileDepletion` at the abandoned overlap tile falling monotonically 0.0408 → 0 over
eight seasons, driven by `advanceTileDepletion` (`world/depletion.ts`), while
`meanCatchmentShare` returns to 1.0 the moment the neighbour leaves. Both are physical.

**[MEASURED] But two things do not recover.** The observer's range-friction record about the
departed band is unchanged after 16 seasons, and its access state drifts *toward*
`avoided_shared_use` (seasons 6, 9, 14, 16) with `sharedUsePressure` rising to 0.17–0.19 —
i.e. the place becomes **more** contested-looking the longer it has been empty.

**[MEASURED] `pressurePersistedAfterDeparture = 56` naturally, against 1 clean recovery case.**
Caveat: this metric treats any position change as a departure and any residual
`recentUseIntensity > 0.05` after ≥ 4 seasons as persistence, so it over-counts short local
shifts. It is reported as a signal, not as a rate.

**[INFERENCE]** An abandoned place does not become permanently crowded — the physical channels
release cleanly. It can become permanently *suspect*, through the friction ring and the access
state.

---

## 12. §10 — Natural occurrence

20 simulated years × {map1, map2, ordinary} × {s1, s2}, 480 season samples, 2,400 band-seasons,
7,360 active band-pair-seasons.

| quantity | count |
| --- | --- |
| active band pair-seasons | 7,360 |
| same-tile residence | **0** |
| near-residence (≤ 4) | 26 |
| overlapping physical activity (footprint) | 25 |
| — of which residence distance > 4 | **4** |
| overlap inferred only from memory | **27** |
| kin overlap | **0** |
| stranger overlap | 25 |
| range-friction events | 149 (141 `familiar_neighbor`, 8 `stranger_or_unrecognized`) |
| access-memory non-`none` place-states | 18,417 (`familiar_use` 12,107, `expected_return` 6,239, `tolerated_shared_use` 71) |
| band-seasons with a non-zero access behavior hook | 2,400 (all) |
| band-seasons with non-zero `crowdingPenalty` | 89 |
| band-seasons with non-zero `saturationPressure` | 2,398 of 2,400 |
| residential moves | 1,547 |
| — moves carrying a crowding reason | **0** |
| crowding reason instances of any kind | **0** |
| possible double-counting band-seasons (all three channels non-zero at once) | 83 |
| terminal bands contributing to pressure | **0** |
| contested shared-catchment tile-seasons | 42 |

**[MEASURED] Crowding never explains a move.** The reason thresholds are
`nearbyBandPressure > 0.18` and `crowdingPenalty > 0.12` (`bandDecision.ts:4374,4391`); across
1,547 moves neither was ever crossed. **[INFERENCE]** Crowding's behavioral influence in ordinary
play is sub-threshold and diffuse — it perturbs scores without ever becoming a named cause.

**[MEASURED] Range saturation is essentially always on (2,398/2,400) while crowding is almost
always off (89/2,400).** **[INFERENCE]** `saturationPressure` is dominated by its
`localUsePressure`, `populationPressure` and `seasonalStress` terms, not by its crowding term.
Its very wide reader set is therefore mostly consuming a band's own use and stress, not
inter-band crowding.

Measured zeros with explanations: `sameTileResidencePairs = 0` (bands never co-locate);
`kinOverlapPairs = 0` (no fission produced an overlapping daughter in these runs);
`terminalBandContributingToPressure = 0` (the exclusion at `crowding.ts:61-68` and
`socialContext.ts:1608-1613` works); `crowdingReasonInstances = 0` (thresholds never crossed).

---

## 13. §11 — Performance and boundedness

**[CODE]** Every crowding-side structure is bounded and memoized:

- `CrowdingField` is built **once per `TickContextCache`** (`crowdingFieldMemo`), scattering each
  band into a Manhattan ball of radius 4 plus radius-2 balls around ≤ 16 salient places —
  `O(bands × radius²)`, not `O(bands²)`.
- Queries are `O(local kin)` via `childrenByParent`, not a band scan. The cache-less
  `computePressureFromScan` path remains only for isolated unit calls.
- `sharedCatchmentMemo` builds the claim index once per cache; footprints capped at
  `MAX_FOOTPRINT_TILES = 16`; the fallback ring-walk is memoized per `world.tiles` in a `WeakMap`.
- `salientPlaceMemoByBand` memoizes the salient sort by band-object identity.
- `pressureBandIds` capped at 32; `usePressure` compacted at 128 records; access memories at 8
  places / 18 candidates; friction ring at 8 events / 48 ticks / 12 candidates / 5 new per band.

**[CODE] Fixed-snapshot semantics are documented and deliberate.** `crowding.ts:141-147` states
the field reflects the fixed pre-decision snapshot rather than mid-loop moved positions, and that
the resulting drift versus the per-query scan is bounded and intended.

**[CODE] One staleness fact worth recording.** `band.rangeSaturation` is stored state written in
the previous context pass, so a read taken immediately after a position change is one tick stale
— visible in the C5 series, where `rsLocalBandCount` still reads 2 at season 0 after the
departure and drops to 1 at season 1.

**[INFERENCE] Do not replace the derived cache with persistent canonical state.** The
performance argument for the current design is sound and the audit found no boundedness defect.

---

## 13b. §8 — Architecture comparison

Nothing below is chosen here. This is the comparison the audit prompt requires, evaluated
against what the measurements above actually showed.

### Option A — fully derived physical footprint

Derive shared physical use from existing residence, activity, expedition and harvest records with
no new stored range state.

| axis | assessment |
| --- | --- |
| simplicity | **best.** `sharedCatchment` already is this, and `catchmentInvariants` passes. Extending its footprint source to include `recentIntraSeasonTrips.targetTileId` and expedition route tiles is additive. |
| boundedness | already bounded — `MAX_FOOTPRINT_TILES = 16`; trip and expedition rings are themselves capped |
| historical window | **the real constraint.** `recentIntraSeasonTrips` is a bounded UI-facing ring (RECOVERY-12 measured it evicting receipts at 24 records against 28 trip-days/season), so a derived footprint would inherit an eviction window nobody chose for this purpose |
| ability to model release | **best.** Nothing stored means nothing to release wrongly; departure is release |
| performance | good — the footprint is already built once per cache |
| physical provenance | **exact.** Every tile is one the band physically worked |
| verdict | **strongest candidate for the physical half.** Its only real risk is silently inheriting another subsystem's retention policy. |

### Option B — bounded per-band use-footprint memory

Store a compact per-band record of recent physical use, separate from familiar-country memory.

| axis | assessment |
| --- | --- |
| lifecycle | a fourth per-band store on top of `usePressure` (128 records), `placeMemory`, `anchorMemories` and `protoAccessMemory` |
| decay | would need its own clock — and §8 above shows this repo's fixed clocks (the 48-tick friction window) are exactly where release goes wrong |
| fission / inheritance | new question: does a daughter inherit the parent's use footprint? `demography.ts:763,810` already resets `recentRangeFrictionEvents` and `campMovement` for daughters, so there is precedent either way |
| terminal cleanup | new terminal path to get right; C6 shows the current exclusions work, and adding a store risks that |
| duplication | **high.** `band.usePressure` already IS a per-band record of recent physical use, with a physical recovery rate. A second one would be a near-duplicate. |
| performance | another bounded store per band; `placeStateSizeProbe` territory |
| verdict | **rejected on the evidence.** It duplicates `usePressure` and adds a release clock where release is already the weak point. |

### Option C — world-level shared-use field

A bounded world or tick-level spatial field derived from active physical use.

| axis | assessment |
| --- | --- |
| symmetry | **best** — a world field is symmetric by construction, no per-observer derivation |
| update order | must be built from the post-decision cache, like `advanceTileDepletion` already is; the seam exists |
| cache vs canonical | if derived per tick it is a cache (safe); if persisted it becomes canonical state and inherits every release problem in §8 |
| ecological coupling | **this already exists.** `world.tileDepletion` + fauna/plant/forest **is** a world-level shared-use field, advanced from the shared catchment index, and C5 measured it recovering cleanly |
| determinism | fine — the existing ecology advance is deterministic and order-invariant (C9) |
| risk of becoming territory | **the real risk.** A per-tile "who uses this" field with band identities is one reader away from ownership; §14 of the prompt excludes that |
| verdict | **largely already built, in the right place.** What is missing is not a field but the *inputs* to it (trips, expeditions). That is Option A's job. |

### Option D — hybrid layered authority

Separate physical use/competition, subjective familiar range, observed social overlap, and access
expectation memory into four layers.

| axis | assessment |
| --- | --- |
| does production already approximate it? | **yes, three of the four layers already exist and are individually sound**: `sharedCatchment` + world ecology (physical), `familiarCountry` (subjective range), `protoAccessMemory` (access expectation). The fourth, observed social overlap, exists as `RangeFrictionEvent` + `BandEncounterRecord` but with defective provenance gates (§9) |
| what is actually wrong | not the absence of layers — the **leakage between them**: `crowding.ts` mixes layer 1 and layer 2 in one scalar; `rangeFriction` and `familiarCountry` are documented as inert but feed layer 4; encounter candidacy reads layer 2 as if it were layer 3 |
| consolidation vs replacement | **consolidation.** No layer needs to be built from nothing |
| verdict | **this is the correct target architecture, and production is closer to it than its own documentation admits.** |

### Selected direction (not implemented)

**D as the target, reached by A for the physical half.** Concretely: keep the four layers,
un-mix `crowding.ts`'s two channels (the §14 boundary), widen `sharedCatchment`'s footprint
source to real physical activity rather than residence alone, and give the perception layer a
release that observes departure. Reject B outright; C is already present as world ecology and
needs inputs, not a new field.

---

## 14. Recommendation

**B + C + D — CONSOLIDATION REQUIRED, PHYSICAL SHARED-USE SUBSTRATE REQUIRED, and
RANGE-RELEASE LIFECYCLE REQUIRED — which together means E, MULTI-PASS REPAIR REQUIRED.**

- **B (consolidation)** because `nearbyBandPressure` and `crowdingPenalty` are the same number
  read twice into one score (§6), and because `familiarCountry` and `rangeFriction` carry headers
  asserting an inertness their code does not honour (§4, ledger).
- **C (physical substrate)** because the footprint is residence-anchored only, and real trips,
  expedition routes and investigation walks compete for nothing (§3).
- **D (release lifecycle)** because perceived shared-use evidence releases on a fixed 12-year
  clock that never observes departure, and access expectations drift *toward* avoidance after the
  neighbour has gone (§8, §11).

### Smallest safe next production boundary — DO NOT IMPLEMENT HERE

**Split the crowding field's two channels.** Remove `memoryOverlap * 0.24` from `basePreclamp`
(`crowding.ts:255` and its scan twin at `:655`) and expose the remembered-overlap term as a
separate, separately-named quantity that no physical reader consumes.

It is the smallest boundary because:

- it is one term in one expression, with an exact twin in the scan path;
- it is the direct cause of the C4 defect and of memory-only overlap outnumbering real overlap;
- it does not touch `sharedCatchment`, ecology, demography, fission or any release clock;
- it needs no new state and no new reader;
- **it is measurable at a seam that already exists** — `nearbyBandPressure` at the
  `decisionObserver` bracket in `tick/advance.ts:213-215`, the same seam CORRECTION-26 used.

Everything else found here — the double-read in `computeCandidateScore`, the encounter
memory-coincidence gate, the friction release clock, the trip/expedition substrate, and
`territorialPressure`'s missing writer — is a **separate** checkpoint each, and each needs its
own before/after evidence. None is authorized by this pass.

### Explicitly not recommended

- Do **not** delete `crowdingPenalty` in favour of `nearbyBandPressure` or vice versa without
  measuring the score-weight change; 0.24 and 0.72 are not interchangeable.
- Do **not** add a world-level shared-use field before the physical-substrate question is
  decided; `sharedCatchment` may simply need a wider footprint source rather than a new store.
- Do **not** touch the kin factor. Its natural exercise is **zero**, so any change would be
  unmeasurable in ordinary play and belongs with Daughter Viability.
- Do **not** repair `territorialPressure` here. Giving a frozen constant a writer is a behavior
  change, and deleting it changes three score terms.

---

## 15. Validation

`git diff --stat 5f341648 -- src/` is **empty**. `git status --short` shows only the three new
audit scripts and this evidence directory.

### Mandated checks

| command | result |
| --- | --- |
| `npx tsc -p tsconfig.json --noEmit` | **PASS** (exit 0) — there is no `npm run typecheck` script; this is the equivalent CLAUDE.md §17.1 records |
| `npx tsc -p tsconfig.node.json --noEmit` | **PASS** (exit 0) |
| `npm run build` | **PASS** (exit 0) |
| `node scripts/graphAudit.mjs` | **does not exist in this tree.** Substituted `node scripts/checkGraph.mjs` → **PASS**, graph 221/764, 0 duplicate ids, 0 dangling links |
| `node scripts/importBoundaryAudit.mjs` | **PASS** — `src/sim` imports nothing from ui/render/store/worker; 143 sim files; internal back edges **85, unchanged from CORRECTION-26** |
| `node scripts/seasonOrderInvarianceAudit.mjs` | **PASS** — `productionDeterministic`, `physicalOrderInvariant`, `residualDifferenceIsRecencyArtifactOnly` all true |
| `node scripts/stepModeInvarianceAudit.mjs` | **PASS** — `fullCanonicalStateMatch: true` on **both** maps, `firstDivergence: null`, populations 152 / 227 |

### Existing domain audits rerun

Output paths were inspected first; none of these writes into another checkpoint's evidence
directory (`socialCausalityAudit` writes only when `--out` is supplied, and it was not).

| audit | result | relevance |
| --- | --- | --- |
| `catchmentInvariants.mjs` | **PASS**, all 6 cases | the most directly relevant existing audit. Independently confirms §5: two equal-demand bands split **0.5 / 0.5 symmetrically**, and the larger band's per-capita drops 1.5 → 1.2 under contest |
| `livingEcologyFoodPipelineAudit.mjs` | **PASS** | the crowding → support → receipt chain is intact |
| `mobilityAuthorityAudit.mjs` | **PASS** | the mobility readers of `saturationPressure` / `territorialPressure` still run |
| `socialCausalityAudit.mjs` | ran; changed fingerprints `demographyAndFission` (seed b) and `pressureState` (seed d) | the CORRECTION-16 result that the social layer is causal still holds — relevant because `rangeFriction` reaches behaviour through `innerFission` |
| `demographicCompositionAudit.mjs` | ran, no failures reported | fission / split pressure readers |
| `taskCampComparisonAudit.mjs` | ran, no failures reported | camp-movement side |

**No regressions were introduced** — the tree's production code is byte-identical to the base
commit, so any failure would necessarily be inherited. None of the above failed.

**Inherited failure carried forward, not repaired:** `expeditionLifecycleAudit.mjs` FAILS on this
branch and identically on `f947550`, as CORRECTION-26 recorded. It is unrelated to crowding and
was not rerun as part of this pass's scope.

### Coverage gap worth recording

`scripts/` contains **no** dedicated crowding, range-friction, familiar-country, access-memory or
range-release audit. The three scripts added by this pass are the first coverage any of the
authorities in `AUTHORITY_LEDGER.md` have had.

---

## 16. What this pass does not prove

- No production behavior was changed, so **no before/after outcome comparison exists**.
- The `placeAttachmentPull` and `localUsePressure` crowding channels are cited from code but
  **their magnitudes are unmeasured** (§6).
- The kin physical-benefit leak (§10) is **unmeasured**.
- No long-horizon (200 y / 500 y) matrix was run; no population, survival or fitness effect of
  any crowding channel is claimed in either direction.
- The C3 fixture verdict is **withdrawn** in favour of the natural-occurrence measurement (§7).
- C10 is **not** a clean unseen-band test (§9); C10b is.
- `pressurePersistedAfterDeparture = 56` is a **signal, not a rate** (§11).
- Whether the 4-tile same-day trip budget interacts with crowding is **not examined** — the
  CORRECTION-26 deferral stands untouched.
