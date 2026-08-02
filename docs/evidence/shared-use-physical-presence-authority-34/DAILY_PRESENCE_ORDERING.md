# Daily ordering and snapshot authority

CORRECTION-34A §8. Read from production at `4f29644`. This answers the eight required questions
about when parties are selected, against which snapshot, and what is order-dependent.

**Scope note:** §8 was written to specify the ordering contract for a *new same-day presence
authority*. Under the supervisor scope amendment no such authority is built, so this document
records the **existing** daily ordering exactly as production has it — which is what a future daily
mobility / party-overlap / encounter checkpoint must build on.

---

## 1. The daily kernel

`advanceWorldByDays` (`tick/advance.ts:98-134`) alternates:

```
runDailyActions(current, currentDay, boundaryDay - currentDay, DEFAULT_DAILY_ACTIONS)
runSeasonalCompatibilityTick({ ...current, time: boundaryDay })
```

`runDailyActions` (`agents/dailyActions.ts:45-71`) walks day by day and, for each day, runs each
registered action whose `firesOnDayOfSeason` matches. It builds **no context cache**.

`DEFAULT_DAILY_ACTIONS` (`agents/dailyActionRegistry.ts:36-39`) is a fixed literal, never sorted at
runtime, never mutated:

| Order | Action | Fires |
| --- | --- | --- |
| 1 | `intraSeasonTripDailyAction` | `dayOfSeason >= FIRST_TRIP_DAY_OF_SEASON` and `dayOfSeason % TRIP_DAY_CADENCE === 0` |
| 2 | `expeditionDailyAction` | **every day** (`return true`) |

The registry module exists specifically to keep this acyclic: it depends on both action owners and
neither depends on it, because a module-initialisation cycle would produce an import-order-dependent
handler — nondeterminism this simulator forbids.

## 2. The eight questions

### When are same-day parties selected?

Inside `applyTripDay` (`intraSeasonTrips.ts:244`), per band, in the loop at `:260` over
`Object.values(world.bands).sort(compareBands)` — a canonical deterministic id sort.

### Which world snapshot selects them?

`selectTripCandidate(currentWorld, band, day, ...)` at `:265` — note **`currentWorld`, not `world`**.
The band *set* being iterated is frozen (`world.bands`), but the *state* each band selects against
is the world already mutated by earlier bands on the same day.

### Can an earlier band deplete a target before a later band chooses?

**Yes, and it is deliberate.** Documented at `intraSeasonTrips.ts:251-255`: fauna geography is
memoized but the dynamic stock state is threaded through the day so "each successful
hunting/fishing trip depletes the targeted stock and LATER bands the same day see the lower
abundance in their return factor (shared-catchment competition, deterministic sorted band order)."

### Is that intended physical sequence or order dependence?

**Intended physical sequence, made deterministic by a canonical sort.** It is order-*sensitive* —
the outcome depends on who goes first — but not order-*ambiguous*, because the order is fixed by
`compareBands` and never varies between runs. `seasonOrderInvarianceAudit` separately proves that
permuting the *seasonal* band order leaves physical/causal state byte-identical; the daily loop has
no injectable permutation seam, which is stated as a limitation in fixture P26 rather than papered
over.

### When is daily physical presence visible?

**It is not.** There is no daily physical-presence read model. The only presence authority,
`getBandPhysicalPresence`, is consumed by `buildCrowdingField` (`crowding.ts:257`) and the
cache-less scan (`:737`), both reachable only from a `TickContextCache`, and every
`buildTickContextCache` call site is inside `runSeasonalCompatibilityTick`.

### When does it expire?

Not applicable — nothing ephemeral is stored. Multi-day expedition presence is derived on demand
from `band.expeditions` and is therefore always current by construction; it "expires" exactly when
the phase becomes terminal, with no separate lifetime to leak.

### Can crowding and shared-use read the same plan?

Today they read the same **authority** — `getBandPhysicalPresence` — from the same seasonal cache,
which is why field/scan parity (CORRECTION-28 P8) holds. There is no *plan* because there is no
daily read model.

### Can party labor be selected twice?

**No, and this is enforced at three separate points:**

1. `getResidentialWorkingAdults` subtracts `getCommittedExpeditionWorkers` before any new
   expedition is staffed (`expedition.ts:182-184`).
2. `deriveAvailableMobilityPools` subtracts `partyCompositionTotal(deriveCommittedMobilityPools)`
   (`bandMobility.ts:294-302`).
3. Within a trip day, `tripWorkersByBandId` records what each band already committed to its
   ordinary subsistence trip, and the investigation party is staffed from what is left
   (`intraSeasonTrips.ts:247-250`) — "the two cannot both spend the same people."

CORRECTION-34A adds a fourth, covering the case none of the three could: `reconcileExpeditionCommitment`
runs at the head of `expeditionDailyAction` and shrinks or loses a party the band can no longer
staff after demography or fission reduced the workforce beneath it.

## 3. The one explicit daily authority

For labour: `getResidentialWorkingAdults` / `deriveAvailableMobilityPools`, reconciled daily.

For physical presence: `getBandPhysicalPresence`, derived on demand, consumed seasonally.

**There is no daily physical-presence authority, and CORRECTION-34A deliberately does not create
one.** The future daily mobility / party-overlap / encounter checkpoint must supply it, and §3 of
`SAME_DAY_PRESENCE_SEAM.md` states its six requirements.

## 4. What a future daily authority must preserve from this ordering

1. The fixed registry order (trips before expeditions) and its acyclic module boundary.
2. The deliberate intra-day sequential depletion — later bands seeing earlier bands' effects is
   physical competition, not a bug to design away.
3. Selection against `currentWorld`, so a plan built from a frozen pre-day snapshot must not claim
   parties that the sequential selection would not actually produce.
4. The three existing labour non-reuse points, plus the daily reconciliation.
5. Determinism: no runtime sort mutation, no import-order dependence, no wall clock.
