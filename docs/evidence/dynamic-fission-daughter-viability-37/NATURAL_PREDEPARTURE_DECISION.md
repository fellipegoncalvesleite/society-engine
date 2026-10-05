# Natural pre-departure reachability and parent-attempt deadlines

Status: Roadmap Item 4 progress. This checkpoint deliberately stops before physical departure.

## Source audit

Natural separation pressure has one producer: `computeBandDemography` in `demography.ts`. It derives
split pressure and crisis-breakaway pressure from canonical demography/ecology, applies the existing
cooldown, parent-lifecycle and maximum-band gates, and selects `viableFrontier` only from the band's
own observed tiles. Before this checkpoint, its `shouldCreateDaughter` result immediately called the
private `createDaughterBand`, which moved cohorts, created an ordinary daughter, appended
`BandFissionEvent`, updated parent/daughter lineage fields and published completed-fission history in
one annual reducer call.

The parent-attempt lifecycle already had a pure `beginAttempt`, guarded `requestTransition`, daily
bounds in its phase contracts, canonical `prepareFissionDeparture`, and truthful
`abandonPreparedDeparture`. What it lacked was an ordinary proposal/planning writer and a world
adapter for parent attempt deadlines. `performAtomicDeparture` already enforced the accepted
physical gate, but had no production callers.

Current parent-attempt readers are `bandLifecycle`, `naturalFissionPreDeparture`,
`parentFissionAttemptResolver`, `fissionDeparturePreparation` and `fissionDepartureSeam`. Current
property writers are the natural adapter, the preparation/abandonment authority and the controlled
physical seam. The exact static sites are emitted by `naturalFissionPreDepartureAudit.mjs`.

Existing history and UI surfaces describe physical fission from `fissionEvents`, `daughterBandIds`
and daughter lineage. They do not infer a daughter from `fissionAttempt`, so the new proposal and
plan cannot be rendered as completed physical fission. A positive commitment remains historical
inside `PreparedFissionDeparture`; no `BandFissionEvent` is written before bodies move.

## Architectures compared

### A — convert the existing daughter-eligibility boundary into proposal initiation

This reuses the exact causal point at which ordinary ecology already judged a bounded split
warranted. It avoids a second motivation model and gives the legacy call site a clean physical
cutover point. Alone, it would leave lifecycle writes and annual evidence production coupled in the
large demography module.

### B — begin proposals earlier than legacy daughter eligibility

This could give plans time to develop before the former transfer threshold. The current source does
not contain a separately justified earlier threshold, cadence or persisted evidence boundary. Adding
one would invent another motivation model and coefficient surface in a subpass whose purpose is
reachability, not tuning.

### C — a dedicated natural adapter consumes the existing demographic/fission evidence

This keeps `computeBandDemography` as the one causal evidence producer and moves lifecycle writes,
revalidation and preparation into a narrow world adapter. It gives phase ordering and refusal
semantics one owner, keeps daily work out of unrelated demography, and is the cleanest attachment
point for a later physical cutover.

### D — a daily proposal evaluator independent of annual demography

No daily canonical split-pressure producer exists. Recomputing the annual evidence daily would add a
second cadence and could make the same ecology produce multiple answers. This was rejected.

## Selected architecture

A and C are combined at one causal boundary:

```text
annual computeBandDemography evidence
  -> beginNaturalFissionProposal
  -> proposed
later daily natural adapter call
  -> revalidate established parent + observed target + exact allocatability
  -> departure_planned
later daily natural adapter call
  -> prepareFissionDeparture
  -> real decline / residual refusal -> abandoned
  -> real acceptance -> exact preparation + positive commitment + live permit -> departure_ready
```

The annual threshold remains the sole natural initiation authority. The dedicated adapter owns the
lifecycle writes. This is not a second motivation model: its proposal record persists the annual
producer's cause, pressure, founder request, bounded available cohort, observed target, score and
reason ids.

Founder sizing retains the old ecological request and minimum. At proposal time it is capped by the
same physical-away and prior prepared-commitment authorities the legacy path used. Planning fixes the
bounded request and target only after revalidating the parent and the target in the parent's own
observed record. No hidden world tile and no timer may manufacture a plan.

## Phase ordering

Proposal day is D, planning can first occur on D+1, and preparation can first occur on D+2. The
adapter refuses to consume a phase on its `phaseEnteredDay`, and each pass handles only the phase
that was current when that parent was reached. Repeated reducer calls on one day therefore cannot
collapse no-attempt through ready.

Daily registry order is:

```text
ordinary daily trip/expedition work
  -> parent attempt deadline resolver
  -> natural pre-departure progression
  -> existing provisional lifecycle work
```

Deadline resolution runs before progression so a phase cannot evade its maximum by transitioning on
the due day.

## Refusal semantics

A real founder-cohort decline ends that named attempt immediately. Repeatedly asking the same
represented cohort until it accepts would manufacture acceptance. A parent residual block also
abandons because the canonical authority already tried every permitted downward revision to the
natural minimum. Missing plan content, a no-longer-known target or an incoherent allocation abandon
as an incoherent named plan. Unexpected structural preparation refusals remain planned for the
independent deadline rather than being relabelled as human choice.

## Parent deadline authority

`parentFissionAttemptResolver` is the single world adapter for `proposed`, `departure_planned` and
`departure_ready` bounds. It sorts parents by id, calls the pure kernel `resolveTimeout`, and delegates
the terminal world write to `abandonPreparedDeparture`.

That delegation is load-bearing for `departure_ready`: the exact allocation and positive commitment
remain historical, while the one-use authorization becomes terminal
`withdrawn_before_departure`. The resolver never plans, commits, moves bodies, creates a successor,
stabilizes or reintegrates. It runs daily because the kernel bounds are stated in days, and all four
step modes traverse the same daily-action kernel.

## Legacy and physical cutover status

1. `createDaughterBand` still exists as a private compatibility/debt implementation.
2. Its implementation was not rewritten.
3. Ordinary ecology has zero call sites to it after this checkpoint.
4. It is therefore not naturally reachable.
5. One causal split cannot create both a legacy daughter and a new attempt.
6. A later physical-cutover pass must attach at the natural adapter's `departure_ready` outcome and
   call the already-accepted `performAtomicDeparture` seam. That attachment is intentionally absent.

`prepareFissionDeparture` has exactly one natural caller: `naturalFissionPreDeparture`.
`performAtomicDeparture` has zero production callers. Natural production creates no provisional
successor in this checkpoint.

The temporary feature-branch consequence is explicit: ordinary ecology can now stop at a truthful
live-permitted `departure_ready`, and the daily parent resolver can expire it, but ordinary daughter
creation is temporarily unreachable until a separately authorized physical cutover.

## Evidence

- `scripts/naturalFissionPreDepartureAudit.mjs`: A–M, including an untouched seed reaching proposal
  at day 43,920, real next-day planning, both real declines and a real accepted preparation, exact
  timeout dates, permit withdrawal, four-way step equivalence, static callers, no duplicate and
  deterministic replay.
- `scripts/naturalFissionPreDepartureMutationAudit.mjs`: seven non-vacuous source mutations covering
  parent eligibility, real plan content, completed preparation, permit withdrawal, registered
  deadline execution, legacy/new duplication and provisional quarantine. Every mutated source is
  restored byte-identically.

## Explicitly remaining

- Natural physical departure and provisional-successor creation are not connected.
- Stabilization is not implemented.
- `unresolved_after_failed_return` is untouched and still blocks the final Item-4 freeze.
- Item 5 remains unstarted.
