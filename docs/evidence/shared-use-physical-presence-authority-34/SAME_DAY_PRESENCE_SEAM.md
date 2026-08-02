# Same-day party physical presence — the seam, and why CORRECTION-34A does not build it

**Status: FORMALLY NARROWED AND DEFERRED.** CORRECTION-34's scope is reduced so that same-day
party *physical presence* is no longer a requirement of this checkpoint. Same-day parties remain
fully physically real — route, target, labor, depletion and return accounting are unchanged and
untouched. What is deferred is only the creation of a *current-presence substrate* for them.

This document exists so the seam cannot be lost. It records, in order: the missing consumer, why
completed trip history cannot stand in for current bodies, the exact future authority required,
and where the roadmap entry lives.

---

## 0. What was asked, and what was found

CORRECTION-34A §7 required that routine same-day parties stop being "entirely absent from the
physical shared-use substrate", comparing five architectures (a daily ephemeral presence plan,
target-only presence, route-day occupancy buckets, event-only overlap, or another bounded design).

Every one of those options writes presence state for a *reader*. The audit below establishes that
**no such reader exists anywhere in production**, and that creating one is not a same-day-presence
change at all — it is a redesign of when the shared-use substrate is built.

Building the ledger anyway would produce a state field with no behavioural consumer: the
decorative-state anti-pattern this repository forbids in §3.2 ("a state field exists but no
decision reads it") and §18.1, and which AUDIT-27 through CORRECTION-33 have repeatedly refused.

---

## 1. The missing consumer

**Claim: physical presence has no within-day consumer in production. The shared-use / crowding
substrate is constructed exclusively at season boundaries.**

Verified at `4042210b332d41b91ed394aa9307962f0106a60c`:

### 1.1 The daily kernel builds no context cache

`advanceWorldByDays` (`src/sim/tick/advance.ts:98-134`) alternates two things and only two:

```ts
current = runDailyActions(current, currentDay, boundaryDay - currentDay, DEFAULT_DAILY_ACTIONS);
current = runSeasonalCompatibilityTick({ ...current, time: ... }, ...);
```

`runDailyActions` (`src/sim/agents/dailyActions.ts:45-71`) is a plain day loop over the registry.
It constructs no `TickContextCache`, and therefore no `CrowdingField`.

### 1.2 Every context-cache construction is at a season boundary

`buildTickContextCache` call sites:

| Site | When |
| --- | --- |
| `tick/advance.ts:170` | pre-decision, inside `runSeasonalCompatibilityTick` |
| `tick/advance.ts:229` | post-decision, same |
| `tick/advance.ts:281` | final read-model pass, same |
| `agents/socialContext.ts:145` | default parameter for cache-less callers |
| `agents/contextCache.ts:208` | internal helper |

None is reachable from `runDailyActions`.

### 1.3 The crowding field is built only from that cache

`buildCrowdingField` has exactly one call site — `crowding.ts:257`, memoized on the tick context
cache. `getBandPhysicalPresence` is read at `crowding.ts:290` (cached field) and `crowding.ts:737`
(cache-less scan). Both are downstream of a cache that only the seasonal tick builds.

### 1.4 The daily-action modules never ask for it

```
grep -nE "crowding|nearbyBand|TickContextCache|contextCache" src/sim/agents/intraSeasonTrips.ts  -> 0 matches
grep -nE "crowding|nearbyBand|TickContextCache"               src/sim/agents/expedition.ts       -> 0 matches
```

### 1.5 A same-day party never exists at a season boundary

A same-day party is created, acts and returns inside a single synchronous `applyTripDay`
(`intraSeasonTrips.ts:244`). There is no moment *between* days at which one is out. Its whole
existence is interior to one daily reducer.

### 1.6 Conclusion

A day-scoped same-day presence ledger would be **empty at every instant the only consumer runs**.
Presence is a daily fact; the substrate is a seasonal artefact; the two never meet.

This also bounds the multi-day repair inherited from `4042210`, and that bound is stated here
rather than hidden: the 505 away-worker-days it corrected were measured by a **daily probe**.
Production reads presence only at boundaries, so the multi-day fix changes production behaviour
only in the narrower case where a party is still out when a boundary falls. The repair is correct
and is retained — `getBandPhysicalPresence` is now the single presence authority for both the
cached field and the cache-less scan — but no claim is made that it moves behaviour on every one
of those 505 worker-days.

---

## 2. Why completed trip history cannot represent current bodies

`Band.recentIntraSeasonTrips` is the obvious tempting substitute. It must not be used, for four
independent reasons:

1. **It is a receipt, not a position.** Each record describes work that has *already completed* —
   the party is home. Reading it as occupancy would place bodies at a target on every day the
   record survives, which is a ghost of exactly the kind AUDIT-27 (35-tile memory ghost),
   CORRECTION-28 and CORRECTION-29 were opened to remove.

2. **It is a bounded display ring, not an authority.** `RECENT_TRIP_RECORD_CAP = 24` against ~28
   trip-days per season. RECOVERY-12 already established this ring is **non-authoritative for
   food** precisely because it evicts real receipts, and replaced it with
   `seasonalFoodReceipts.ts` for the ledger. A store already proven too lossy to count calories
   cannot be promoted to counting people.

3. **Its retention window is seasons, not days.** One day's trip would project presence across
   the whole retention window — the "no season-long presence from one day's trip" constraint in
   §7's own mandatory list.

4. **CORRECTION-30 already removed a reader that did this.** `rangeFriction.ts` used to read
   another band's `recentIntraSeasonTrips` as `inferred_from_recent_activity` over a 12-tick
   window. That was deleted as a private-state provenance violation. Re-introducing trip history
   as a presence source would reinstate the same defect under a new name.

**Rule going forward: `recentIntraSeasonTrips` is history. It may never answer "who is standing
there now".**

---

## 3. The exact future authority required

Same-day presence becomes actionable when, and only when, a **daily physical co-presence
authority** exists. Minimum requirements:

1. **A daily shared-use substrate.** The occupancy/crowding read model must be constructed on the
   day, not at the season boundary — either by moving `buildCrowdingField` onto a daily cadence or
   by introducing a narrower daily occupancy index that the seasonal field is derived from. This
   is the load-bearing change and it is what makes every option in §7 buildable.

2. **One presence authority for both party kinds.** `getBandPhysicalPresence` already returns
   residential remainder + one source per away expedition party. The daily authority must extend
   *that* function, so same-day and multi-day parties are never two parallel notions of a body.

3. **An explicit within-day temporal abstraction, stated not implied.** Two parties visiting one
   tile on one day are not necessarily simultaneous. The authority must either represent coarse
   within-day intervals (§7 Option C) or declare in one place that same-day co-location is treated
   as potential contact rather than proven simultaneity. It must not silently call all same-day
   visits simultaneous.

4. **A frozen daily selection snapshot.** Same-day trips are selected against `currentWorld` inside
   the band loop (`intraSeasonTrips.ts:265`), and earlier bands deliberately deplete targets before
   later bands choose (`:251-255`). That sequential depletion is intended physical competition and
   must be preserved — so the presence plan must be built from one frozen pre-day snapshot, or be
   emitted by the resolver itself, rather than accumulated in a way that lets read order matter.

5. **Person conservation across both kinds.** The invariant CORRECTION-34A added for expeditions
   (`getBandCommitmentAccounting`, `reconcileExpeditionCommitment`) must extend to same-day
   parties, so residential remainder + away expedition workers + away same-day workers =
   represented population.

6. **Performance and step-mode proof.** A daily substrate multiplies the construction count by up
   to 90x per season. It requires its own bounded-cost measurement and must preserve
   `stepModeInvarianceAudit`'s `fullCanonicalStateMatch`, since daily/weekly/monthly/seasonal are
   batch sizes over one kernel and must remain so.

**Owning checkpoint:** the future *daily mobility / party-overlap / encounter* architecture.
This is where physical co-presence acquires its first real consumers (encounter opportunity,
information exchange, avoidance, cooperation, conflict). CORRECTION-34A establishes physical
possibility for multi-day parties only; it deliberately invents no encounter, no fear and no
social observation.

---

## 4. Roadmap and handoff entry

To prevent the seam being lost, it is recorded in all three tracked documents:

- `CLAUDE.md` — architecture change log entry for CORRECTION-34A, and the roadmap item 3 block,
  which states that same-day party presence is deferred with this file as the reference.
- `AGENTS.md` — the active-checkpoint block.
- `docs/HANDOFF.md` — the deferred-work list, with the exact next action.

The entry must survive until a daily physical co-presence authority exists. **Roadmap item 3 does
not close on CORRECTION-34A**, and the same-day seam is one of its named open items — alongside
the residence-anchored `sharedCatchment` footprint, `territorialPressure`'s missing writer, and
whether `CROWDING_DECISION_COST_WEIGHT = 0.96` is the physically right magnitude.

---

## 5. What was deliberately NOT done

- No presence ledger, plan, occupancy bucket or overlap record was added.
- `buildCrowdingField` was **not** moved to a daily cadence.
- Same-day trip physics were **not** touched: route building, target selection, party staffing,
  arrival rule, depletion and return accounting are byte-identical to `4042210`.
- No completed trip record was reinterpreted as a current body.
- No encounter, caution or social observation was invented from physical proximity.
