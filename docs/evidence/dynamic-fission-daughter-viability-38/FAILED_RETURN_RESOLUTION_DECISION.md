# Post-return continuation correction decision

Checkpoint: Roadmap Item 4, subpass correction 38

Starting commit: `65627a54f271d7729e8e13c36976d869d68d71ed`

Status: Item 4 active; physical cutover and Item 5 not started

## Exact reproduced defect

The accepted failed-return architecture truthfully allowed:

```text
unresolved_after_failed_return
→ fresh current-survivor commitment A
→ continuing_after_failed_return
→ fresh physical operation
→ established_after_failed_return
```

But `continuing_after_failed_return` permitted only establishment or zero-population extinction. On a
controlled world, A named observed `tile:197:89`; the group stood at `tile:195:89`, and only local
execution discovered that the forward step was impassable. After 90 registered days, three people
were alive at the original position, `blockedStepDays` was 90, phase and commitment id were unchanged,
and no production writer could reopen disposition. That was the same structural dead end one phase
later.

## Correction architectures compared

1. **Physical failure reopens disposition — selected.** Existing retained refusal counts, complete
   target-local operation windows and current bodily condition are real contradictions. They can
   truthfully end the current course without claiming success, death or global unreachability.
2. **Explicit commitment supersession — selected with 1.** Commitment A remains an immutable social
   fact with typed failure evidence, but it ceases to be current authority before any B decision.
3. **Bound continuation by elapsed time — rejected as the primary authority.** A timer contributes no
   physical fact. Expiry may never establish the group, and the source-derived physical boundaries
   already answer the relevant question without an arbitrary duration.
4. **Multi-stage known-country search — selected only through fresh decisions.** Every material
   retarget binds current survivors, the current decision tile and a group-known target under a new
   identity. No adapter silently edits A's target into B.
5. **Add a new phase or generalize ordinary stabilization — rejected.** The existing
   `unresolved_after_failed_return` phase already owns the social question. A new phase would move the
   dead-end risk, while ordinary `stabilized` must retain `provesNeverEnteredReturnPath`.

The smallest truthful architecture is **1 + 2 + 4** inside the existing two nonterminal phases.

## Selected authority

The corrected causal path is:

```text
continuing_after_failed_return(A)
→ typed physical contradiction
→ A becomes bounded historical/superseded evidence
→ unresolved_after_failed_return with no current commitment
→ fresh Band-only current-survivor decision
→ continuing_after_failed_return(B) with an empty operation ledger
→ strictly post-B physical operation
→ established_after_failed_return
```

`derivePostReturnContinuationFailureEvidence` is pure over `Band` plus day. It receives no
`WorldState`, chooses no replacement and cannot inspect a hidden route. Distinct typed reasons retain
what actually failed:

- five retained local progress refusals before reaching the target;
- a complete target-local demand window with no productive labour;
- a complete target-local window with failed water, physical take or support;
- current productive labour below the existing return minimum;
- current embodied mortality burden above the existing return limit.

One refused neighbor or one bad food day is insufficient. Route failure uses the existing
`RETURN_BLOCKED_DAYS = 5`; ground failure requires a complete `demand_window_complete` measurement
whose start is strictly after A and whose tiles are all A.

`advancePostReturnReconsiderations` is the sole supersession writer. It requests the guarded physical
kernel edge back to `unresolved_after_failed_return`, closes the active interval, moves A plus its
typed failure into history, records A as contradicted, clears current authority and writes no target
or success. The daily order places physical travel/subsistence before reconsideration and
reconsideration before replacement disposition. The two-day disposition measurement prevents a
same-day automatic retarget.

## Bounded history and fresh B semantics

Rich superseded commitment history is capped at 8 entries. Contradicted target memory retains only
tile ids and is capped at 72, matching the exact known-tile memory capacity; a currently representable
contradicted target therefore cannot become eligible merely because the rich history ring rolled.
If no co-located parent and no uncontradicted group-known target exists, unresolved persistence names
that genuine lack of a represented event rather than a missing writer: the reintegration,
disposition and zero-body authorities still run daily.

Commitment B binds:

- the current working-adult, dependent and elder counts;
- the current physical decision tile;
- the new current/observed target;
- the original failed-return episode and B's own decision day.

Target and decision day participate in the commitment id. Recording B resets `operationHistory` to
the canonical empty ledger. Completion still accepts only a demand-complete window with
`window.startDay > B.decisionDay`, real physical take/depletion, measured demand and labour,
acceptable water/support/burden, living workers and physical arrival at B. A's operation ledger and
failure window cannot establish B.

## Controlled evidence

The corrected F12 is a long-run disposition test, not a one-step refusal test. Its controlled branch
has two personally held observed-country alternatives and no route record. A is physically present
in group knowledge, while the locally blocking tile exists only in world truth. Local food extraction
keeps all three people alive. A persists through retained refusal counts 1–4, fails on count 5, becomes
typed history, and leaves a two-day unresolved interval. A new decision creates B at a new id. The
group then moves only by Manhattan-distance-one steps and establishes after a complete post-B window.

The separate arrival-ground branch physically reaches A, remains alive, completes a strictly post-A
target-local window, receives `fresh_operation_contract_not_met`, supersedes A with typed water/ground
failure, creates B only after a fresh decision, refuses immediate B recognition with
`no_fresh_operation_window`, and later establishes from B's own operation.

The positive no-failure path is unchanged: the correction does not add a delay or reconsider a course
that earns the accepted conjunction.

## Reintegration and zero population

After A is superseded and before B exists, physically co-locating the parent still lets the existing
`performAtomicReintegration` authority win before disposition with exact cohort conservation. The
remote control still refuses. Both `continuing_after_failed_return` and the reopened unresolved state
retain a legal `provisional_extinguished` exit through the existing zero-body resolver.

## Every nonterminal successor phase

| Phase | Resolution kind | Production writer | Causal exits | Can living state persist indefinitely? |
|---|---|---|---|---|
| `travelling` | temporally bounded | `provisionalTravel` / resolver | contiguous arrival, lived return choice, travel timeout to return, zero bodies | No; `TRAVEL_MAX_DAYS` ends in non-success `returning` |
| `establishing` | temporally bounded | establishment/stabilization/reintegration/resolver adapters | proved operation, failed trial, return choice, physical reunion, zero bodies | No; `ESTABLISHMENT_MAX_DAYS` ends in `failed_early` |
| `failed_early` | temporally bounded | establishment/resolver adapters | bounded failure ends in return, or zero bodies | No; `FAILED_EARLY_MAX_DAYS` ends in `returning` |
| `returning` | temporally bounded | travel/reintegration/resolver adapters | physical reunion, truthful failed-return expiry, zero bodies | No; `RETURN_MAX_DAYS` ends in unresolved, never success |
| `unresolved_after_failed_return` | event-bounded living condition | resolver, reintegration and post-return disposition adapters | physical reunion, fresh group-owned decision, zero bodies | Yes, only while no co-located parent and no uncontradicted group-known course exists; all three authorities remain active |
| `continuing_after_failed_return` | event-bounded living condition | travel/subsistence, post-return reconsideration/establishment and resolver adapters | fresh operation, typed course failure reopening disposition, zero bodies | No under the production pipeline: physical execution yields arrival/measurement, retained refusal, bodily failure or extinction |

This table is generated as a non-vacuous fixture from every nonterminal successor contract so adding
or moving a phase without a disposition fails the audit.

## Mutation evidence

`scripts/failedReturnContinuationMutationAudit.mjs` reports 11/11 non-vacuous controls and restores
all production sources byte-identically. In addition to the six accepted failed-return barriers, it
proves that:

- disabling reconsideration leaves three living people in the same A commitment after 40 days with
  `blockedStepDays = 37` and no historical commitment;
- removing target/day from commitment identity makes a material B retarget masquerade under A's id;
- retaining A's operation ledger violates the empty-at-B stale-evidence fixture;
- replacing the Band-only result with a hidden `WorldState` tile violates the knowledge boundary;
- removing the corrected phase's zero-body edge leaves an immortal empty entity.

The inherited timer mutation still proves that removing the physical-event entry guard lets elapsed
time manufacture `established_after_failed_return`; production continues to refuse it.

## Validation and retained scope boundary

The corrected failed-return audit reports 31/31 passing fixtures, zero failing and zero vacuous. The
mutation audit reports 11/11 with byte-identical restoration. Affected lifecycle, travel,
subsistence, reintegration, stabilization, admission/quarantine, history/readability, determinism,
step-mode and season-order suites remain required before handoff.

Natural `performAtomicDeparture` callers remain zero and `createDaughterBand` callers remain zero.
Physical cutover still requires the separately scoped legacy fission-cooldown reconciliation and
natural readiness/departure seasonal-order decision. Neither debt is implemented here. Item 4 remains
active and Item 5 remains unstarted.
