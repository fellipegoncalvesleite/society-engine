# Roadmap Item 4 — natural physical cutover decision

## Scope

This pass connects ordinary ecological fission pressure to the already-existing Direction-D atomic
physical departure and successor lifecycle. It does not start Item 5, freeze Item 4, or regenerate the
cumulative System Record / Canonical Bundle.

## Cadence decision

Three placements were re-evaluated against current production source rather than the older seam
comment:

1. **annual/seasonal physical departure** — rejected. `departure_ready` is a day-bounded state with a
   30-day parent deadline. Holding an accepted, live one-use authorization until an annual callback
   makes the physical event depend on step packaging rather than the lifecycle's own calendar.
2. **ordinary daily physical departure** — selected, with two protections. `runDailyActions` supplies
   the explicit simulated day and executes actions in fixed order. The physical cutover action is the
   absolute last daily action, so a newborn successor receives no downstream daily turn on its birth
   day. It also refuses a birth on a season-boundary day because the crossed-season pipeline follows
   that daily span and would otherwise grant same-day seasonal work.
3. **hybrid daily reservation / seasonal transfer** — rejected. A reservation would introduce a second
   capacity/ownership authority and a new intermediate state without solving a physical problem.

Exact semantics: readiness may be written on day **D**. Physical departure may not execute on D. Its
first legal execution is the first day **> D** that is not a season boundary and on which execution-time
capacity still exists. Usually this is D+1.

## Explicit time authority

The natural physical adapter consumes the `day` supplied by `runDailyActions`; it never uses
`world.time` to decide which daily instant is being executed. The atomic seam already receives this
same explicit `today` and derives the historical `WorldTime` for the departure record from it.

## Capacity and concurrency

Proposal-time capacity remains useful ecological backpressure but is not a reservation. At physical
execution the adapter re-counts the current world before every ready candidate. Candidates use an
explicit stable arbitration tuple:

`(departure_ready.phaseEnteredDay, lineageId, parentBandId)`.

Thus object insertion order is not physical truth. If two candidates fit, both may depart. If only one
slot remains, the tuple determines the winner and the other remains ready subject to its independent
ready deadline.

## Successor identity

Natural identity is `successor:${lineageId}`. It does not depend on a mutable global count or iteration
order. The atomic seam also refuses an already-occupied successor id before any mutation, so collision
cannot overwrite an existing band.

## Stale readiness

`performAtomicDeparture` remains fail-closed and byte-preserving on stale accepted terms. The natural
wrapper does not re-fit those terms. A stale fingerprint or no-longer-present accepted cohort ends that
exact ready attempt through canonical abandonment, which withdraws the live authorization. Any later
physical departure requires a new attempt and therefore current terms and positive acceptance again.
Unexpected structural corruption remains visible and is bounded by the existing ready deadline rather
than being mislabelled as a human decision.

## Physical-separation cooldown

Legacy completed daughters wrote `fissionEvents`; Direction-D departures deliberately do not. The
canonical cooldown reader therefore uses the latest tick across both legacy fission events and durable
Direction-D `successorDepartureRecords`. Because the same departure fact belongs to both parent and
successor, a real separation survives stabilization, reintegration, provisional extinction, and
post-return establishment as recent physical history. A pre-departure abandonment writes no departure
record and starts no cooldown.

No legacy `BandFissionEvent` is manufactured by Direction D.

## Reader boundary

The inherited “5/12” note is review-progress debt, not a runtime quantity. The semantic reader audits
remain authoritative for actual `world.bands` enumerations and lifecycle routing. Natural successors
now make those audits load-bearing in production; unresolved review entries belong to the final whole
Item-4 certification/freeze unless a semantic audit demonstrates an unsafe reader now.

## Research

No external literature was needed for this decision. The design question was about this repository's
causal calendar, state machine, ownership seam, and existing bounds; production source answered it more
directly than generic simulation literature could.

## Deferred closeout

The cumulative System Record and Canonical Bundle remain intentionally unchanged. They are updated only
after physical cutover, final Item-4 whole-integration certification, and Item-4 freeze.
