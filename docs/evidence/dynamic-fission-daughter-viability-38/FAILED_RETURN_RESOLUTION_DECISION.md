# Failed-return resolution decision

Checkpoint: Roadmap Item 4, subpass 38
Starting commit: `1df00d2be8943e4c97b0f5b38ed9173e9314acdd`
Status: Item 4 active; physical cutover and Item 5 not started

## Source finding

At the starting commit, `returning` expired truthfully into the event-bounded living phase
`unresolved_after_failed_return`. Its contract permitted only:

- physical co-location followed by `reintegrated`;
- zero living bodies followed by `provisional_extinguished`.

That was causally honest but structurally incomplete: a living, provisioned group had no social or
physical authority for choosing a later independent course.

## Architectures compared

1. Fresh recommitment: selected, but represented by a new current-survivor record rather than the
   departure-specific founder commitment.
2. Renewed return/search: rejected. The group has no new observation of the parent's location, so
   replaying `returning` would repeat a bounded action against the same departure tile.
3. Independent relocation: selected only as provisional movement to the occupied tile or a tile in
   the group's own observed memory. Ordinary residential movement remains quarantined.
4. Distinct post-return terminal outcome: selected as `established_after_failed_return`.
5. Generalized ordinary stabilization: rejected. `stabilized` must retain its permanent
   `provesNeverEnteredReturnPath` requirement.
6. Source-derived combination: selected. A fresh social fact precedes any relocation and a complete
   qualifying physical-operation window must begin strictly after that fact.

## Selected causal path

```text
unresolved_after_failed_return
→ PostReturnContinuationCommitment by the current aggregate survivor cohort
→ continuing_after_failed_return
→ optional contiguous provisional travel to current/observed country
→ fresh physical-operation window
→ established_after_failed_return
```

The decision authority takes `Band` and day, not `WorldState`. It reads:

- the permanent `return_path_entered` separation course;
- physically recorded post-failure subsistence days;
- the current three demographic cohort lines;
- current embodied mortality burden;
- the occupied tile and `Band.knowledge.observedTiles`.

It does not read parent position, movement, health, terminality or willingness. World truth is used
later only to execute passability, validate direct consumed-departure provenance and perform atomic
release writes.

The commitment is not a `FounderCohortCommitment`: it binds no parent transfer, no departure permit,
and no original founder cohort. Its actor is explicitly the aggregate cohort still alive at decision
time.

## Fresh-evidence barrier

The disposition writer closes the old interval and resets `operationHistory` when it records the new
commitment. Completion accepts only a demand-complete assessment window with
`window.startDay > commitment.decisionDay`. It also requires real physical take and depletion,
measured demand and worker-days, acceptable support/water/burden, living workers and physical arrival
at the committed target.

Therefore none of these is sufficient:

- the old founder commitment or consumed permit;
- an outbound operation window;
- post-failure operation that predates the new commitment;
- elapsed time;
- a fabricated commitment id;
- a bounded lifecycle ring that has forgotten `returning`.

`ProvisionalSeparationCourse.status === "return_path_entered"` remains the monotonic source of truth.

## Competing outcomes

The daily registry gives physical reintegration first priority while the group remains unresolved:

```text
provisional_travel
→ provisional_reintegration
→ provisional_travel_subsistence
→ provisional_return_decision
→ post_return_disposition
→ ...
→ post_return_establishment
```

If a living parent is physically co-located before the fresh decision, `performAtomicReintegration`
conserves and transfers the cohorts and ends the successor. Once the survivor cohort has positively
committed to continuing separately, the course changes; `continuing_after_failed_return` has no
reintegration edge and no remote merger is possible.

## Historical and reader expansion

Completion writes a distinct bounded `SuccessorPostReturnEstablishmentEvent` to parent and successor.
It initializes the successor's lineage, deep-history founding snapshot, canonical event, Chronicle,
identity/readability and current camp at the physically occupied tile. It does not move population or
position, create a second band, manufacture viability, emit `SuccessorStabilizationEvent`, or rewrite
the failed-return episode.

Lifecycle predicates admit the terminal result as an established living band. Provisional travel,
subsistence, zero-pop cleanup, quarantine, viability/demography/future-fission admission, history,
events, identity/readability and map-marker semantics were audited. The marker already reads physical
living-band state and therefore needs no special outcome branch.

## Controlled evidence

`scripts/failedReturnContinuationAudit.mjs` constructs the positive path through canonical
preparation, atomic controlled departure, real travel and arrival, real lifecycle failure, monotonic
return entry, contiguous return travel, bounded failed return, registered post-return decision and
fresh operation. It reports 25/25 passing fixtures with zero vacuity.

`scripts/failedReturnContinuationMutationAudit.mjs` proves six barriers are load-bearing:

- canonical fresh decision;
- strictly fresh physical operation;
- monotonic return history;
- reintegration co-location;
- no elapsed-time positive outcome;
- clean atomic release initialization.

All six mutations violate their named control, and all touched production files restore
byte-identically.

## Boundary retained for physical cutover

Natural `performAtomicDeparture` callers remain zero and `createDaughterBand` callers remain zero.
Before physical cutover, two older authorities must be reconciled:

1. `hasFissionCooldownElapsed` still reads legacy `band.fissionEvents`, while Direction-D completion
   deliberately creates no legacy instantaneous fission event.
2. Natural readiness progresses daily, while the departure seam's ordering analysis belongs to the
   seasonal demography/fission step.

Neither debt is implemented in this subpass. Item 4 is not frozen and Item 5 is not started.
