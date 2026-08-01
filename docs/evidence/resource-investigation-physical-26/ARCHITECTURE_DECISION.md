# CORRECTION-26 — architecture decision

Written **before** implementation, as the checkpoint requires. Every claim below was
read from production at `f94755047b2ea2a47b9453f3917e8eaf67816ca3`.

## Problem

A selected seasonal `resource_scout` or `logistical_probe` changes target-area
knowledge with no executed party. `applyBandDecision` classifies both as
`isProbeAction`, sets `canonicalNextPosition = band.position`, and then calls
`collectProbeObservationTargets` (`bandDecision.ts:5539`), which returns the target
tile at distance 1 and each of its neighbours at distance 2. That set goes straight
to the canonical `observeTileAndNearby`. No worker leaves, no tile between origin and
target is crossed, no day elapses, and no physical failure is possible.

## Phase contract, read from production

`tick/advance.ts:115-123`:

```ts
while (getNextSeasonBoundaryDay(currentDay) <= targetDay) {
  const boundaryDay = getNextSeasonBoundaryDay(currentDay);
  current = runDailyActions(current, currentDay, boundaryDay - currentDay, DEFAULT_DAILY_ACTIONS);
  current = runSeasonalCompatibilityTick({ ...current, time: getWorldTimeForDay(boundaryDay) }, ...);
  currentDay = getCalendarDay(current.time);
}
```

Three facts follow, and they drive the whole decision.

**(1) Daily work for a season runs before that season's decision.**
`runDailyActions(world, startDay, elapsedDays, …)` iterates
`day = startDay + 1 … startDay + elapsedDays` (`dailyActions.ts:60`), so the call
above covers `currentDay+1 … boundaryDay`. The seasonal decision then runs *at*
`boundaryDay`, after every daily action for that span has already executed.

**(2) The boundary day is not a trip day.** The trip action fires only when
`dayOfSeason >= FIRST_TRIP_DAY_OF_SEASON (6) && dayOfSeason < 90 && dayOfSeason % 3 === 0`
(`intraSeasonTrips.ts:136`). A boundary day has `dayOfSeason = 0`, so it never fires.
There is no free same-day trip slot at the moment of selection.

**(3) The daily registry is declared the only sanctioned seam for sub-season work.**
`dailyActionRegistry.ts:33-35`: *"Adding an action here is the ONLY sanctioned way to
run sub-season physical work."* The module exists specifically to keep
`intraSeasonTrips → expedition → intraSeasonTrips` acyclic and to keep reducer order
deterministic.

## The distance trap, read from production

These three numbers are routinely conflated and must not be:

| quantity | value | source |
| --- | ---: | --- |
| scout candidate search radius | 10 | `resourceScout.ts:50` `SCOUT_MAX_DISTANCE` |
| daily-trip candidate radius | 10 | `intraSeasonTrips.ts:88` `MAX_TRIP_DISTANCE_TILES` |
| **honest same-day round-trip budget** | **8** | `intraSeasonTrips.ts:89` `SAME_DAY_ROUND_TRIP_TILE_BUDGET` |

`deriveTripDurationDays(d) = max(1, ceil(d * 2 / 8))` and its own comment names it
*"the single boundary between the two physical paths: 1 day => the ordinary same-day
activity path; more than 1 day => the expedition lifecycle."*

So a target is honestly same-day only at **one-way distance ≤ 4**. A scout may select
anything up to 10. **Targets at 5–10 tiles are already outside same-day physics**, and
compressing them into a one-day record would be exactly the falsification §8 forbids.
`selectExpeditionTripCandidate` already exists for the >1-day case and is already
consumed by the expedition retrieval family.

## Options

### Option A — immediate physical execution at the seasonal boundary

Call a shared information-trip resolver inline from the seasonal phase.

- **Reuses primitives?** Yes, in principle.
- **Temporally honest?** No. Fact (1) means every daily action for the season has
  already run; fact (2) means the boundary day is not a trip day. Executing physical
  work there inserts a trip on a day the cadence excludes.
- **Phase contract?** **Violated.** Fact (3) states the daily registry is the only
  sanctioned seam for sub-season physical work. Option A runs physical work from the
  seasonal reducer instead.
- **Labor consistency?** Poor. Labor committed inside the seasonal phase is invisible
  to the daily path that already ran and to the one that runs next.
- **Verdict: REJECTED** — it buys a smaller diff by breaking the documented contract.

### Option B — bounded pending investigation executed by a daily action

Selection records a narrow pending investigation; the daily trip path executes it on
the next eligible trip day.

- **When does it depart?** The next day satisfying the existing trip cadence, inside
  the following season.
- **Cancellable / revalidated?** Yes, and it must be: on band move, dispersal,
  absorption, extinction, or expiry at the next seasonal boundary.
- **Labor reserved indefinitely?** No — nothing is reserved at selection. Labor is
  taken by the executing trip through the existing task-group path, exactly as any
  other trip.
- **Bounded?** Structurally. The seasonal loop produces **exactly one decision per band
  per season**, so a pending investigation is naturally capped at **one per band**, and
  it expires at the next boundary. This is not a queue; it cannot grow.
- **Generic operation framework?** No. One optional narrow record, one owner, one
  season of life, no priorities, no scheduling policy.
- **Verdict: SELECTED.**

### Option C — constrain candidates to immediately executable scope

Evaluate real route feasibility during candidate scoring and offer only executable
targets.

- **Erases legitimate demand?** Yes — it would silently delete every 5–10 tile
  investigation motive, which is most of the range the scout was built for.
- **Cost?** A route search per candidate per band per season, in the decision hot
  path.
- **Closes the chain?** **No.** It is a filter. Even a perfectly filtered selection
  still has no workers, no route, no duration and no failure mode.
- **Verdict: REJECTED as a solution**, but **adopted in part**: the *duration*
  classification (≤1 day vs >1 day) is applied at execution time using the existing
  `deriveTripDurationDays`, which is cheap and authoritative.

### Option D — retire the seasonal investigation authority

Make the seasonal action a motive and let daily/expedition systems select.

- **Loses the proven seasonal competition?** Yes. CLOSURE-25 measured 51 scouts and
  78 probes actually winning against stay/move/explore.
- **Breaks readers?** Yes — `probeMemory`, `reportedKnowledge.ts:474/504/2849`,
  `adaptiveHuman.ts` influence families and `residentialMoveEvent.ts:434` all read the
  action type.
- **Verdict: REJECTED** — largest blast radius, destroys working behaviour.

## Selected design

**Option B, with Option C's duration classification applied at execution.**

```text
band-known uncertainty
→ candidate investigation (unchanged selection logic)
→ exact Decision.id selected
→ NO observation at selection            ← the defect, removed
→ one bounded pending investigation recorded on the band, carrying Decision.id
→ next eligible trip day in the following season
→ duration classified by deriveTripDurationDays(distance)
     ≤ 1 day  → executed through the authoritative same-day trip path
     > 1 day  → not same-day executable; named outcome, no observation
→ real workers, contiguous path, real feasibility, real failure
→ arrival or named failure
→ observation ONLY on arrival, through the canonical observeTileAndNearby
→ canonical memory update
→ later behavioral consequence
```

**Why this is the smallest architecture that actually closes the chain.** It adds no
pathfinder, no second knowledge writer, no scheduler, and no new physical subsystem.
Every physical primitive — route, workers, duration, `route_time_infeasible`, memory
application — is the one production already uses for information trips. The only new
state is one optional, self-expiring record per band whose sole purpose is to carry
`Decision.id` across the phase boundary that facts (1)–(3) prove cannot be crossed any
other way.

## Outcome classes

Every selected investigation resolves to exactly one, and none is silently discarded:

```text
executed_and_returned
route_infeasible
insufficient_labor
target_no_longer_valid
cancelled_before_departure
superseded
transferred_to_existing_expedition_authority
```

## State implications

| property | value |
| --- | --- |
| record | one optional `pendingInvestigation` per band |
| cap | 1 (structural — one decision per band per season) |
| expiry | next seasonal boundary |
| cancellation | band moved, dispersed, absorbed, extinct, or target invalid |
| compaction | none needed; the record is replaced or cleared each season |
| long-run size | O(1) per band, independent of simulation age |

## What is deliberately not changed

Expeditions, `ExpeditionTaskCamp`, the receipt and support chain, ecology, yield,
fertility, mortality, carrying capacity, exploration capacity, movement speed, risk
tolerance, and dormant `temporary_use`. `campMovement`'s `TemporaryTaskCampRecord` is
made truthful (it must not claim a camp that never physically existed) but is **not**
merged with `ExpeditionTaskCamp` and does **not** become a second behavioural camp
authority.
