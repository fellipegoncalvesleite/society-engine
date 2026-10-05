# CORRECTION-26 — findings

Continuation of the checkpoint whose only prior commit was the architecture-decision gate
`b746b68`. `src/sim` was byte-identical to
`f94755047b2ea2a47b9453f3917e8eaf67816ca3` at entry (`git diff --exit-code f947550 --
src/sim` passed), so everything below is a change made in this pass.

---

## 1. The defect, reproduced on `f947550`

A selected `resource_scout` or `logistical_probe` revised what a band believed about
country up to ten tiles away with nobody going there. `applyBandDecision` classified both
as `isProbeAction`, pinned `canonicalNextPosition = band.position`, and passed
`collectProbeObservationTargets(world, band.position, targetTile)` — the target tile plus
its whole 1-ring — straight to the canonical `observeTileAndNearby`. The band's own
position appeared in that call only to exclude itself from the ring; it was never a
departure point.

**Measured at the exact seam.** The production audit-only `decisionObserver`
(`tick/advance.ts:213-215`) fires between `applyBandDecision` and the write-back, so it
brackets the applier and nothing else. Two maps × two seeds × 12 years on `f947550`:

| | selections | gained target-area knowledge at selection |
| --- | ---: | ---: |
| **before (`f947550`)** | 192 | **176 (91.7%)** |
| **after** | 234 | **0 (0%)** |

The after arm selects **more** investigations, not fewer — 234 against 192 — so the result
is not reduced scout frequency wearing the costume of a repair.

**Pending is not executed, and the two are named apart.** The metric that checks
`updatedBand.pendingInvestigation.decisionId === decision.id` at the decision seam is
`selectionsWithPendingIdentity`. It proves the selection created an exact, joinable pending
identity; it proves nothing physical, because **nothing has executed at that instant**. (It
was briefly named `selectionsWithExecutionIdentity`, which overstated it; corrected.) The
counters that do inspect terminal outcomes are `executionsObserved` — a ring entry carrying
an `executionId` — and `namedNonExecutions`. The full chain, from the regenerated
`behavioral-comparison.json`:

| | selected | exact pending identities | later physical executions | later named non-executions | still pending at end |
| --- | ---: | ---: | ---: | ---: | ---: |
| **before (`f947550`)** | 192 | **0** | 0 | 0 | 0 |
| **after** | 234 | **234** | **97** | **132** | **5** |

97 + 132 + 5 = 234 exactly. Every pending identity resolves to a physical execution, to a
named non-execution, or is still waiting for its trip day when measurement stopped. The
before arm has no pending identity to resolve at all — that absence is the defect.

Two selections in the after arm show a target-area change, and both are knowledge being
**lost** (a tile in the ring forgotten under the bounded known-tile retention). That is the
opposite of the defect. The metric is directional for this reason and losses are reported
separately rather than folded into a symmetric "changed" count.

## 2. What replaced it

```text
seasonal scout/probe selected
→ exact bounded pending investigation (carries Decision.id)   [no observation]
→ next eligible trip day, sanctioned daily phase
→ workers allocated from what is left, or named non-execution
→ real contiguous passable route, or named non-execution
→ arrival, or failed_due_to_distance
→ observation ONLY on arrival, canonical observeTileAndNearby
→ scout learning / side-country memory / plant test / exploitation skill
→ terminal outcome appended to a bounded ring
```

New modules: `agents/pendingInvestigation.ts` (the record and its lifecycle; a runtime leaf
— every import is type-only) and `agents/resourceScoutObservation.ts` (the relocated
execution-neutral domain half). The executor lives in `agents/intraSeasonTrips.ts`, which
already owns the same-day physical path and is reached through the daily-action registry.

**Layering, measured not asserted.** A value-import graph over all 143 `src/sim` files
(counting only imports with a runtime binding) reports **0 runtime cycles in `src/sim`** and
**0 `agents → rules` runtime edges**. `importBoundaryAudit`'s informational back-edge count
rose 84 → 85; its regex counts `import type`, and the new edge is the type-only
`types.ts ⇄ pendingInvestigation.ts` pair, the same pattern `resourceScout.ts ⇄ types.ts`
already uses. It erases at compile time.

**The split was by role, not by line count.** `buildResourceScoutContext` and
`selectResourceScoutTarget` are candidate selection and stayed in
`rules/candidates/resourceScoutCandidate.ts`. `isAppliedSideCountryProbe` and
`isAppliedProactiveInfo` are selection classification and stayed in `rules/bandDecision.ts`.
Observation interpretation, memory mutation, plant-use learning and the debug projection
moved. The decision-time VOI numbers the old applier recovered by **re-running the
selector** are now captured once at selection and carried on the record — the daily
executor could not have re-derived them (wrong season) and the call would have closed an
`agents → rules/candidates` cycle.

## 3. Outcome distribution in nature

20 years × 3 scenarios × 2 seeds, 343 selected investigations:

| outcome | count |
| --- | ---: |
| `executed_and_returned` | 139 |
| `beyond_same_day_reach` | 147 |
| `route_unavailable` | 54 |
| `arrival_failed` | 0 (architecturally unreachable — see §11) |
| everything else | 0 |
| still pending at end of run | 3 |

343 = 340 resolved + 3 still pending. Nothing disappeared.

**`beyond_same_day_reach` is the largest class, and it is an honest NAMED REFUSAL under the
currently authoritative production boundary.** A scout may select a target up to 10 tiles
away (`resourceScout.ts:50`), while the same-day round-trip budget is 8
(`intraSeasonTrips.ts:89`). `deriveTripDurationDays` — the production helper whose own
comment calls itself "the single boundary between the two physical paths" — is applied twice:
once on the straight-line distance selection used, and again on the route actually walked,
which is often longer. Compressing those 147 into one-day records would have been exactly the
falsification this checkpoint exists to remove, so they are refused by name instead.

**What this does NOT establish.** It does **not** claim the four-tile boundary has been proven
physically correct. The executor obeys the boundary production already had; whether that
boundary is the right one was not tested here. See §9.

**`route_unavailable` is terrain, not policy.** Selection measures straight-line distance;
execution needs a contiguous passable path. This is the same mismatch CORRECTION-8 recorded
for ordinary trips (18.1% `failed_due_to_distance` on ordinary ground against 0% on rich).
Nobody leaves camp in this case, so `partyWorkers` is 0 and no trip result is produced.

**`insufficient_labor` reads zero in nature and is a MEASURED zero, not an unused branch.**
Fixture P4 drives a band to zero working adults and the outcome fires with
`partyWorkers: 0` and no execution id. The same applies to `band_moved_before_departure`
(P8), `destination_blocked` (P3) and `expired_before_execution` (P9): each has a real raise
site proven by a controlled fixture, and reads zero naturally because a band's residence
does not move inside a season and the record is replaced every boundary.

## 4. What an arrived party observes, and the honest cost of that

The removed free chain wrote the target at `distance 1` (confidence 0.68) and its ring at
`distance 2` (0.34), for nobody. A party that physically stood on the target observes it at
`distance 0` (confidence 1.0, `visits + 1`) and its 4-neighbours at `distance 1`, together
with every tile of the walked route on the same terms — the distances
`tileObservation.ts:259-268` already defines for standing somewhere. No second ring:
standing somewhere does not teach the country two tiles beyond it. Hard cap 32 targets.

**So a single successful investigation now teaches MORE than the defect did.** That is
stated rather than hidden. It is the correct direction: the population of investigations
that teach anything at all collapses from "every selection" to "only those physically
executed" — 139 of 343 here — and what an arrived party perceives should be what it
perceives. Understating the distances to make the diff look conservative would be its own
falsification.

Acquisition kind stays `residential_observation`. An investigation party is a same-day task
group leaving from and returning to the residential camp inside the ordinary daily range,
which is exactly what that kind denotes and exactly what production already wrote for this
action. No new `KnowledgeAcquisitionKind` was added, so retention, compression and the
CORRECTION-24A label-bias finding are untouched.

## 5. Information-only accounting

The executor never builds an `IntraSeasonTripRecord`, never touches
`recentIntraSeasonTrips`, and therefore cannot reach `depositFoodReceipt`,
`resolvePlantFoodHarvest`/`resolveFaunaFoodHarvest`, or the canonical ledger. The §11
invariant is **structural**, not conditional. Measured anyway: 0 information receipts, 0
consumed-by-economy, 0 support units across the natural run and the 6-year fixture run.
`recoveryFoodAccountingAudit` still reports capture 1.000 with conservation holding.

## 6. CampMovement truthfulness

`TemporaryTaskCampRecord` was written whenever a band merely **selected** a probe or scout
while holding its residence, and asserted an `origin → target` camp with a purpose, a
confidence and a three-tick expiry. The event log, the public story and both UI panels
reported it as one — *"A small camp near the X let them test work…"*. No camp existed and
nobody had left. CLOSURE-25 had already recorded that this record has **no reader inside
the simulation at all**, only projections; so it was a projection of something that never
happened.

Reclassified, not merged and not silently deleted:

- type `TemporaryTaskCampRecord` → **`TemporaryTaskPartyRecord`**, field
  `temporaryTaskCamps` → `temporaryTaskParties`, purpose type `TemporaryCampPurpose` →
  `TemporaryTaskPurpose`;
- written **only** from a resolved investigation in which a party actually departed
  (`executed_and_returned` or `arrival_failed`) — a `route_unavailable` means nobody left,
  and every named non-execution writes nothing here;
- carries the execution's own `executionId`, real `partyWorkers` and real
  `routeDistanceTiles`, and asserts `noCamp: true` beside `noSettlement`/`noInventory`;
- the `active`/`expired` states and the expiry pass are gone: a same-day party is already
  home when its record is written;
- narration corrected in `eventSystem.ts`, `publicHumanStory.ts`, `ui/band/CampMovement.tsx`
  and `ui/band/Technical.tsx`.

`ExpeditionTaskCamp` is untouched and still governs every genuine multi-day camp. CLOSURE-25's
own authority audit, rerun unmodified: `camp_movement_temporary_record` **129 → 0**,
`expedition_task_camp` **103 → 113**.

Selected-but-unexecuted investigations stay inspectable through
`band.recentInvestigationOutcomes`, which names why nobody went.

## 7. A real regression this pass introduced, found and fixed

`stepModeInvarianceAudit` **failed** after the first implementation:
`fullCanonicalStateMatch: false` on map1, populations identical, its own divergence finder
returning `null`. A direct state diff located it in four lines: observations stamped
`firstObservedAt.day: 180` under seasonal stepping against `185` under daily stepping.

Cause: `runDailyActions` never advances `world.time`, so the world threaded through the
daily loop carries the time of the **span's start**. Under seasonal stepping that is the
previous boundary; under daily stepping it is the real day. The executor was observing with
it. This is the same defect CORRECTION-15 repaired as its item (D) for the expedition
observation timestamp. Fixed by handing the executor `{ ...currentWorld, time }` — the day
it is actually running on. Both maps now pass with `fullCanonicalStateMatch: true`.

**Fixture P13 passed while that bug was live.** It compared only
`pendingInvestigation` / `recentInvestigationOutcomes` / `temporaryTaskParties` — none of
which carry a timestamp. Observation timestamps and the observation history were added, and
a **negative control** was run: with the bug deliberately reintroduced the fixture fails
3/3 and passes 37/37 with it removed. A fixture that cannot fail is not evidence.

## 8. Instrument errors caught in this pass's own probes

Recorded rather than quietly dropped, because each would have produced a confident number:

1. **The before/after probe first compared band state across a whole
   `advanceWorldByDays(world, 1)` step** and reported 41 of 234 target-area changes on the
   corrected tree. That window also contains a day of daily actions, so ordinary subsistence
   trips and returning expeditions were being attributed to the decision. Moved to the
   `decisionObserver` seam: 2 of 234, and both are losses.
2. **The metric was symmetric.** "Free distant knowledge" is a gain; forgetting is the
   opposite. Counting any difference made two evictions look like leakage.
3. **P13 was vacuous** (see §7).

## 9. Deferred, unproven — the mobility-boundary concern

Explicitly outside this checkpoint's scope and **not acted on**. Selection may reach 10
tiles (`SCOUT_MAX_DISTANCE`, `MAX_TRIP_DISTANCE_TILES`) while the same-day round trip budget
is 8 (`SAME_DAY_ROUND_TRIP_TILE_BUDGET`), so 147 of 343 natural investigations — 43% — are
refused as `beyond_same_day_reach`. That refusal is honest **under the currently
authoritative production boundary**; the boundary itself is a separate question.

The possible mismatch between the fixed trip-distance budget and dynamic `bandMobility`
(pace, conditioning, fatigue) is **unproven in either direction**:

- **no mobility constant was changed** — `SAME_DAY_ROUND_TRIP_TILE_BUDGET`,
  `deriveTripDurationDays`, `SCOUT_MAX_DISTANCE`, `bandMobility`, walking capacity,
  conditioning, fatigue, urgency, tile scale, food-trip range, expedition limits and movement
  speed are all untouched;
- **no counterfactual over the boundary was run**;
- **no separate correction is authorized**, and no CORRECTION-27 exists;
- it is **not part of CORRECTION-26** and remains deferred for later evidence.

It must not be cited as a finding in either direction.

Also recorded and not acted on: `route_unavailable` at 54 of 343 has no failure memory, so a
band can re-select an unreachable target repeatedly. That is the same class of defect
CORRECTION-24A recommended a bounded negative memory for in the claiming family, on
correctness grounds. Neither is licensed by anything measured here.

## 10. Inherited debt, unchanged

`expeditionLifecycleAudit` reports **FAIL** on this tree — and reports the identical FAIL on
`f947550`, with the identical false flags (`sawOperating`, `sawReturning`, `sawTaskCamp`,
and the two checks that are vacuous without them). It is a pre-existing failure, not a
regression from this work, and it is not repaired here.

`WorldAuditOptions.retentionInteractionArm` still has no consumer; the superseded 23E/23F
replay arms are still present. Both inherited from CORRECTION-24A and untouched.

## 11. What is NOT claimed

- No claim that physical investigation improves outcomes. No population, survival or
  fitness comparison was run, and none is implied.
- No claim about the mobility boundary in either direction (§9).
- `arrival_failed` reads **0** across the natural run, and fixture P14 establishes **why**
  rather than leaving it an untested branch. It needs a route whose endpoint is not the
  target, which needs an impassable **non-aquatic** tile with a passable neighbour, because
  `buildOutboundPathTiles` aims at the target when passable and otherwise at
  `resolveShoreApproachTile`, and the reused arrival rule accepts a land tile adjacent to an
  **aquatic** target. Surveyed: map1 has 2,601 impassable tiles of 16,000 and map2 has 3,453
  of 30,800, and **0 of either are non-aquatic**. So the branch is architecturally
  unreachable on both production maps — a STRUCTURAL zero with a stated cause, not an
  unexercised outcome. It is kept as a defensive branch carrying the exact production result
  `failed_due_to_distance`.
- No claim that the three still-pending records at the end of the run are a defect: a
  record selected in the final season has not had its trip day yet. They are counted in the
  conservation identity, not hidden.
