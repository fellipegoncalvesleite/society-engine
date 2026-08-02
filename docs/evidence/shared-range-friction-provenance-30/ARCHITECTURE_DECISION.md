# CORRECTION-30 — architecture decision

**Decision: Option A + Option C, applied together as one coherent change.**

> Contemporary direct friction is admitted **only** by current physical proximity — the
> canonical `cache.nearbyBandsByBandId` set the crowding and encounter authorities already
> use. Every read of another band's private trip records is removed, because no trace or
> witness authority exists to ground it. Reports keep their own separate, already-correct
> path.

Written after the inspection (`authority-ledger.md`) and the causal/research review
(`RESEARCH_AND_CAUSAL_MODEL.md`), not before.

---

## 1. What has to be decided

Two defect chains, audited separately (checkpoint §4):

**A — hidden residential presence.**
`rangeFriction.ts:127-140` reads `other.position`, classifies it against the observer's own
familiar country, and — if the tile is remembered at all — writes
`activityKind: "residential_presence"`, `confidence: "observed"`. There is no distance
condition anywhere in the file. A kin band or a contact-memory band **forty tiles away** that
happens to stand on a tile the observer remembers becomes an *observed* residential presence.

**B — hidden activity party.**
`rangeFriction.ts:141-163` reads `other.recentIntraSeasonTrips`, keeps trips whose *target*
falls in the observer's remembered country within a 12-tick window (12 seasons = 3 years),
and writes `confidence: "inferred_from_recent_activity"` with `linkedActivityTripId` and an
activity kind derived from the other band's private `taskGroupType` / `objective` / `cause` /
`movementType` / `resourceClassId` / `pathTiles`.

A third, unnamed instance of the same defect: `countRecentTripsInRange`
(`rangeFriction.ts:624-633`) reads the same private trip list to inflate `recentOverlapCount`
on the **residential** notice — which is what drives `repeated_outsider_use` (≥ 3) and
`moderate_placeholder` tension (≥ 4). Leaving it would be exactly the half-state §18 forbids.

Neither chain has any legitimate perception, proximity, encounter or report behind the word
`observed` or the word `inferred`. Both are direct reads of private state.

---

## 2. Options compared

### Option A — proximity or encounter-only direct friction

Contemporary direct friction arises only from accepted physical proximity or a legitimate
encounter record. Reports stay separate.

- **For:** proximity is a canonical, physical, already-trusted authority
  (`DEFAULT_NEARBY_RADIUS = 4`, `contextCache.ts:26`). CORRECTION-28 kept exactly this for
  physical crowding; CORRECTION-29 kept exactly this for encounter candidacy. Reusing it
  invents nothing, adds no constant, adds no type, and makes the friction authority consistent
  with the two authorities either side of it.
- **For:** it is the honest floor while no trace and no long-range sighting exist (§5 of the
  research doc).
- **Against:** proximity 4 is a coarse stand-in for "could see them" — no terrain, no line of
  sight, symmetric. Recorded as a stated simplification (§7 of the research doc), not hidden.
- **On the encounter half:** inspected and found to be **subsumed**. Encounter admission is
  ≤ 3 (`getEncounterKind`, post-CORRECTION-29); proximity is ≤ 4; and
  `applyEncounterContext` runs immediately before `advanceRangeFriction` **on the same cache**
  (`socialContext.ts:151-160`), so positions are identical. A separate encounter branch could
  not admit anything proximity does not already admit — it would be a vacuous disjunct. It is
  therefore **not** added, and fixture P4 measures that a legitimate encounter still produces
  friction through the proximity gate rather than asserting it.

### Option B — a bounded observer-evidence interface

Introduce an `ObserverEvidence` type accepting direct observation / encounter / report /
future trace, and route every writer through it.

- **Against:** three of its four cases do not exist in this repository and one (encounter) is
  subsumed by another (proximity). A four-case interface with two live cases, one duplicate
  and one placeholder is a framework built for a future checkpoint's requirements —
  the "state field nobody reads" anti-pattern CORRECTION-28 rejected for the same reason.
- **Against:** it would make the before/after proof harder to read by moving code that does
  not need to move.
- **Rejected as premature.** The evidence *taxonomy* it would encode is still required by
  checkpoint §7 — it is recorded in `PROVENANCE.md` and enforced by fixtures, which is where
  a taxonomy with two live members belongs until it has more.

### Option C — remove private activity reads, defer activity friction

Stop deriving observed activity from another band's private trips until a legitimate trace or
witness authority exists.

- **For:** there is no honest alternative. Even the narrowest witness construction fails:
  `IntraSeasonTripRecord` carries `tick` and `day`, but the model stores **no positional
  history** — the observer's tile on the day of the other band's trip is unrecoverable. And
  the window is 12 ticks, i.e. three simulated years; §14 forbids changing it here.
- **For:** Binford (1980) is directly on point — a logistical task party leaves far less
  evidence than a residential base. Detecting trips as easily as residences is wrong in the
  direction that matters.
- **Against:** it removes a whole class of events. Accepted: §12 of the checkpoint forbids
  forcing the old count to hold, and the class was never grounded.
- **Adopted, and extended to `countRecentTripsInRange`** so no equivalent path keeps the read.

### Option D — implement physical traces now

- **Rejected.** §3 of the checkpoint forbids adding a trace system because the literature
  shows humans follow traces, and §8/Option D forbids choosing it to preserve event
  frequency. The inspection found **no already-canonical physical trace authority** of any
  kind (`authority-ledger.md` §3.1): no tracks, no trails as world features, no camp remains
  (`TemporaryTaskPartyRecord` asserts `noCamp: true`), no freshness, no cross-band smoke
  (`fireSignals.ts` is same-band deliberate signalling), and no band/person cue in
  `landscapeVisibility.ts` (its `LandscapeVisibilityCueKind` union is entirely terrain).
  Choosing D would mean inventing witnesses and traces, which §9.9 prohibits. Deferred to the
  Persistent Human Landscape pass.

### Option E — another evidenced minimal design

Two variants were considered and rejected on inspection:

- **E1 — gate the trip channel on proximity to the trip *target* tile.** Rejected: it would
  say "I was near that place at some point this tick, therefore I know who worked it up to
  three years ago." The temporal mismatch is unbridgeable without positional history, and the
  activity kind would still be read from the other band's private record.
- **E2 — keep the trip channel but downgrade its confidence to `uncertain`.** Rejected: the
  defect is that the *record exists at all* without a detection channel. Relabelling
  unsupported knowledge as low-confidence knowledge is still knowledge, and it would still
  feed `strangerCaution`, `sharedUsePressure` and social tension. §9.1 requires *no new
  range-friction event*, not a quieter one.

---

## 3. The selected architecture

### 3.1 Rule

```text
CONTEMPORARY DIRECT FRICTION
  requires  other band ∈ cache.nearbyBandsByBandId[observer]     (physical, current, ≤ 4)
  and       the tile is inside the observer's own familiar country
  gives     activityKind residential_presence, confidence "observed"

REPORT-LINKED FRICTION                        (unchanged)
  requires  a WordOfMouthReport from ANOTHER band about a tile in familiar country
  gives     confidence "reported_secondhand", linkedReportId, source + trust preserved

EVERYTHING ELSE
  gives     no record
```

### 3.2 Concretely, in `src/sim/agents/rangeFriction.ts`

| Change | Why |
| --- | --- |
| `derivePairNotices` takes the observer's nearby-band set and returns `[]` when `other` is not in it | the proximity gate; `other.position` is then only read for a band the observer is physically next to |
| the recent-trips block (`:141-163`) is deleted | Option C — no witness authority |
| `countRecentTripsInRange` is deleted; `recentOverlapCount` becomes `1 +` the observer's own prior notices of this band inside its range, from its **own** `recentRangeFrictionEvents` ring | removes the third private read while keeping `repeated_outsider_use` / `moderate_placeholder` reachable from legitimate repeated observation (§9.4) |
| `classifyTripActivity`, `makeTripId`, `compareTrips` are deleted | dead once the trip channel is gone; leaving them invites the read back |
| `linkedActivityTripId` is no longer written | it can only be produced from a private trip record |
| `deriveCandidateBands` is **unchanged** | the candidate list is a selection set, not an evidence claim; nearby bands are added first and can never be crowded out by the 12-slot cap (`rangeFriction.ts:456-482`) |
| `deriveReportLinkedEvents` is **unchanged** | already correct: it reads the observer's own received reports, excludes self-sourced reports (the 2026-07-10 rumour-loop fix), and stamps `reported_secondhand` |
| the module header is corrected | its claim that nothing reads these records is misleading — `accessNorms` → `pressure.ts:161` is a real behavioural path |

`RangeFrictionOtherActivityKind` and `linkedActivityTripId` stay in `types.ts`. They are the
correct vocabulary for a future witnessed-activity channel; removing the type would be a
larger change than the defect requires, and `RangeFrictionEvent` already carries
`otherActivityKind: "unknown_activity"` for reported events.

### 3.3 What this does NOT change

Nothing outside `rangeFriction.ts`. In particular: no expiry constant, no release rule, no
access-memory decay, no crowding score, no `nearbyBandPressure` / `crowdingPenalty` weight, no
shared-catchment footprint, no trip or expedition execution, no encounter rule, no report
rule, no tension coefficient, no type deletion.

---

## 4. Why this is the smallest honest architecture

1. It uses an authority that already exists, at a radius that already exists, computed by a
   cache the function already receives. No new constant, no new type, no new module, no new
   import.
2. It leaves the legitimate channels (own memory, own reports, prior contact for *relation*)
   exactly as they were.
3. It removes every private read in one commit, so no equivalent path keeps the defect.
4. It defers precisely what the repository cannot support, and says so, rather than
   manufacturing a trace system to keep a number stable.

---

## 5. Predicted consequences, stated before measurement

- The `inferred_from_recent_activity` confidence class should fall to **zero** naturally.
- `linkedActivityTripId` should never be written.
- Residential-presence records should survive only for genuinely adjacent bands, so their
  count should fall substantially.
- `recentOverlapCount` on surviving records should fall (it no longer counts another band's
  private trips), which should reduce `repeated_outsider_use` and `moderate_placeholder`.
- Report-linked records should be **unchanged in the first instance**, then may drift because
  fewer false friction records are republished as reports (`reportedKnowledge.ts:648`).
- Physical ecology — trips, depletion, catchment, support, crowding — must be **identical**
  for any world where the friction change does not alter a decision.
- Some behavioural drift is expected and permitted, through
  `accessNorms` → `pressure.ts:161`. It is measured, not suppressed.

These are predictions, not results. Results are in `FINDINGS.md`.
