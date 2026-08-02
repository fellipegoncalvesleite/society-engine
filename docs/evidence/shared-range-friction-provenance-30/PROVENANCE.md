# CORRECTION-30 — evidence taxonomy and provenance rules

The classes checkpoint §7 requires, as they exist in this repository after the correction.
Each class states what it proves, what it does **not** prove, which authority carries it, and
how a fixture demonstrates it.

---

## 1. Direct contemporary observation

**Admitted by:** the other band being in the observer's current physical proximity set —
`TickContextCache.nearbyBandsByBandId`, built by `buildTickContextCache` from real band
positions at `DEFAULT_NEARBY_RADIUS = 4` (Chebyshev). This is the same canonical authority
CORRECTION-28 kept for physical crowding and CORRECTION-29 kept for encounter candidacy.

**Proves:** the observer and the other band are physically co-present enough for the observer
to see that the other band is living where it is living.

**Does not prove:** what that band did last season; where its parties went; what it intends;
where it will be next season.

**Recorded as:** `confidence: "observed"`, `otherActivityKind: "residential_presence"`.

**Fixtures:** P3 (adjacent pair still produces friction — `LEGITIMATE_DIRECT_FRICTION_PRESENT`
in both arms), P2 (a residence beyond the radius produces nothing after the correction).

**Explicit simplification:** proximity is treated as detection. There is no terrain, line of
sight, vegetation, weather or attention model for bands anywhere in production, and this
checkpoint invented none. See `RESEARCH_AND_CAUSAL_MODEL.md` §7.

---

## 2. Encounter-linked evidence

**Authority:** `Band.encounterRecords` / `BandEncounterRecord`, written only by
`applyEncounterToBand` (`socialContext.ts:1133`), admitted at distance ≤ 3 after
CORRECTION-29.

**Proves:** contemporary contact between the two bands.

**Does not prove:** every hidden activity or trip target the other band holds. CORRECTION-29
established that an encounter is a meeting, not a download.

**Status in this architecture — subsumed, and measured rather than asserted.** Encounter
admission (≤ 3) is a strict subset of proximity (≤ 4), and `applyEncounterContext` runs
immediately before `advanceRangeFriction` **on the same cache** (`socialContext.ts:151-160`),
so positions are identical at both calls. A separate encounter branch in `rangeFriction.ts`
could not admit anything the proximity gate does not already admit; adding one would be a
vacuous disjunct. Fixture **P4** therefore *measures* that an encountered pair still receives
friction (`ENCOUNTERED_PAIR_STILL_PRODUCES_FRICTION` in both arms) instead of asserting it,
and the natural audit reports `encounterLinkedRecords` as its own count (25 before → 24
after) so the class stays visible.

---

## 3. Reported evidence

**Authority:** `Band.reportedKnowledge.reports` / `WordOfMouthReport`, carrying
`sourceBandId`, `originalObserverBandId`, `trustBasis`, `hops`, `distortionLevel`,
`freshness`, `confidence`, `confirmationStatus`.

**Proves:** somebody told the observer something.

**Does not prove:** observation. A report may never be upgraded.

**Recorded as:** `confidence: "reported_secondhand"`, `linkedReportId` set,
`otherActivityKind: "unknown_activity"`, `otherBandId` = the report's source band.
`deriveReportLinkedEvents` was **not modified** by this checkpoint. Its existing self-report
exclusion (`rangeFriction.ts:250`, the 2026-07-10 rumour-loop fix) still holds.

**Fixtures:** P5 (`REPORT_LINKED_FRICTION_STAYS_SECONDHAND`, both arms), P11
(`UNCERTAINTY_PRESERVED`, both arms — P11 reads P5's own output so the two cannot disagree).

**Natural:** `reportLinkedRecords` **33 → 33**, `reportedAwarenessRecords` **35,776 → 35,776**.
The report channel is untouched in both count and content.

---

## 4. Historical contact memory

**Authority:** `Band.contactMemories` / `KnownBandContactMemory` (`types.ts:4457-4471`).

**Proves:** prior contact happened; how familiar, how tense, how tolerant.

**Does not prove:** current position, current activity, or current intention — and this is
structural, not a policy: **`KnownBandContactMemory` contains no tile, no coordinate and no
activity field at all.** It cannot locate anybody. That is precisely why the defect had to
read `other.position` directly.

**Use in `rangeFriction.ts`:** identification and relation only (`deriveRelation`,
`rangeFriction.ts:556-567`), plus candidate-list membership (`:478`). Neither is an evidence
claim; a contact-memory band still produces no record unless it is currently nearby.

**Fixture:** P6 — bands meet for real, separate to 40 tiles, the other band takes a hidden
trip into the observer's country. Before: `OLD_CONTACT_REVEALS_NEW_TRIP`. After:
`OLD_CONTACT_REVEALS_NOTHING_CURRENT`, with `contactMemoryStillHeld: true` in **both** arms.

---

## 5. Physical ecological competition without social awareness

**Rule:** another band may harvest, deplete, disturb and share a catchment with no social
record whatsoever. Removing false social knowledge must not touch any of it.

**Fixture P7:** a 40-tile-separated pair, one of them holding a real trip record.
Before: `SOCIAL_KNOWLEDGE_PRESENT`. After: `PHYSICAL_PRESENT_SOCIAL_ABSENT`, with the
observer's and the other band's physical readings **byte-identical between arms** —
position, `weightedCrowding`, `crowdingPenalty`, `meanCatchmentShare`, `footprintTiles`,
`overlappingBandIds`, `perCapitaReturn`, `sharedReachableSupport` (144.56 / 35.79),
`tileDepletionHere` (0.0662 / 0.1857), `tripRecordCount` (24 / 24).

**Fixture P7 states its own limit:** the pair is 40 tiles apart, so their catchments do not
overlap. P7 proves the *separation* of the physical and social layers, not that catchment
competition occurs at distance. Residence-anchored catchment footprint is an AUDIT-27 seam
this checkpoint does not touch.

**Natural, 20 y × 3 scenarios × 2 seeds:** every physical aggregate is **identical** between
arms — `weightedCrowdingSum` 2.51, `bandSeasonsWithCrowding` 56, `catchmentClaimTileSeasons`
26,515, `contestedCatchmentTileSeasons` 43, `sharedReachableSupportSum` 114,381.8,
`perCapitaReturnSum` 1,305.41, `tileDepletionSum` 3,419.5131, `tileDepletionNonZeroTiles`
41,278, `tripRecordSeasons` 57,600, `moves` 1,547, `fissions` 0, `finalPopulation` 817,
`finalLivingBandCount` 30, `survived` 6/6.

---

## 6. Private other-band state — never evidence

These are the other band's own records. None of them is admissible as observer evidence, and
after this correction `rangeFriction.ts` reads only the first, and only for a band the
observer is currently beside:

| Field | Status after CORRECTION-30 |
| --- | --- |
| `other.position` | read **only** when the other band is in the observer's current proximity set |
| `other.recentIntraSeasonTrips` | **not read at all** — all three reads removed (the notice loop, `classifyTripActivity`, `countRecentTripsInRange`) |
| `other.expeditions` | never read by this module |
| `other.placeMemory` | never read by this module (CORRECTION-29 removed the equivalent read in `socialContext.ts`) |
| `other.knowledge` | never read |
| `other.intent` | never read |
| `other.pressureState` | never read |

`linkedActivityTripId` was removed from the module's internal `PairNotice` shape so it is
structurally impossible to produce from a private trip record again. The field remains on
`RangeFrictionEvent` in `types.ts` as the correct vocabulary for a future witnessed-activity
or trace-read channel; **nothing writes it today** (natural: 84 → 0).

---

## 7. Absent channels — named, not filled in

The literature supports trace reading, smoke detection and long-range sighting
(`RESEARCH_AND_CAUSAL_MODEL.md` §4). This repository has **no authority for any of them**
(`authority-ledger.md` §3.1): no human tracks, no trails as world features, no camp remains
(`TemporaryTaskPartyRecord` asserts `noCamp: true`), no trace freshness, no cross-band smoke
(`fireSignals.ts` resolves one band's own deliberate signal to its own camp), and no
band/person cue kind in `landscapeVisibility.ts` (its `LandscapeVisibilityCueKind` union is
entirely terrain: water, wetland, valley, ridge, pass, dry country).

**No witness, trace, smoke, visibility or exact activity knowledge was fabricated.** The
activity-friction channel is deferred to the Persistent Human Landscape pass, and its
vocabulary is retained so that pass can reconnect it.

---

## 8. Classification rule used by the natural audit

Every record is classified **at creation** — the first tick its `eventId` appears — using the
observer/other distance at that tick. Sampling later would misclassify a legitimately created
record as distant once the two bands separate, because records live 48 ticks.

```text
linkedReportId present                                  -> reported_secondhand
confidence "inferred_from_recent_activity"
  or linkedActivityTripId present                       -> sourced only from private trips
confidence "observed" and distance <= 4 at creation     -> observed within proximity
confidence "observed" and distance >  4 at creation     -> sourced only from private position
  (and, separately flagged) the pair also holds an
  encounter record from the same tick                   -> encounter-linked
```

**Known approximation, stated:** the ring is sampled at end of tick, but
`advanceRangeFriction` also runs in the pre-decision pass, so a record created pre-decision is
first seen after the decision loop may have moved bands. The measure can therefore over-count
`sourced only from private position`. It reads **0 in both arms**, so there are no false
positives to discount — and chain A's natural occurrence is genuinely zero (see `FINDINGS.md`
§4, which does not claim natural credit for it).
