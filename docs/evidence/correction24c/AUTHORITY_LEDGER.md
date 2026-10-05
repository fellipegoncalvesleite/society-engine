# CORRECTION-24C — actual reader and physical-action authority

This ledger describes the temporary Commit-A instrument. It is diagnostic only:
it owns no `WorldState`, changes no persisted record, and is absent from normal
production execution unless an audit runner explicitly enables it. Commit B
removes the module and every hook after the evidence is written.

## 1. Exact writer identity

The legal counterfactual remains the real frontier-return writer in
`agents/expedition.ts`. For every route tile carried home by a completed
`frontier_exploration` party, the temporary ledger assigns:

```text
recordEventId
bandId
tileId
expeditionId
returnDay
newOrRefreshed
```

The identity lives only in `diagnostics/explorationCausalAudit.ts`. A
`(bandId,tileId)` slot points to the most recent exploration-return event that
still names the canonical `KnownTileRecord`. A later exploration refresh
replaces that audit identity; a record learned anew after the event is not
misattributed to it.

The counterfactual suppresses one exact tuple:

```text
(expeditionId, tileId, returnDay)
```

It does not delete a later snapshot and does not touch verification evidence,
travel corridors, crossing memory, resource memory, place memory, or any other
fact.

## 2. Actual production readers

An event is counted as read only when the named production function
dereferences the exact canonical tile record while its normal call is in
progress. The audit runner never schedules or calls a reader.

| Family | Real production entry points observed | Exact consultation roles |
| --- | --- | --- |
| `movement_destination` | `deriveCarryingCapacity` / `deriveKnownUnusedHabitat`; `evaluateBandDecision` / `getKnownTileStats`; `deriveRangeSaturationState`; `deriveFrontierDispersalPressure`; `deriveNearbyOpportunityGradient` | current residence, destination candidate, known-tile statistic, saturation baseline, frontier candidate and known-neighbour boundary, nearby opportunity |
| `camp_movement` | `deriveCampMovementDecisionSupport` | current-camp baseline, pressure-relief candidate, local-shift candidate and current-shift baseline |
| `resource_activity` | `applyTripDay` / `selectTripCandidate`; `buildStartingLocalReconnaissanceState`; `collectResourceInferenceCandidates` | selected same-day resource candidate, starting local reconnaissance, resource-inference candidate |
| `daughter_fission` | `selectFissionTarget` | actual fission-target candidate |

Every completed invocation records the real production function, day/tick,
consultation role, verdict, deterministic ranking, and the action identity that
production subsequently attached at the same daily or seasonal seam.

### Route/corridor finding

`route_corridor` has no production reader of an exploration-returned
`KnownTileRecord`. Residential corridors are written from an executed
residential decision and movement record. Existing corridors are compared
byte-for-byte across the writer fork, and a later corridor difference is
admissible only after naturally divergent residential movement. No route reader
is invented for this audit.

## 3. Exact physical actions

| Physical family | Execution seam | Identity and physical proof |
| --- | --- | --- |
| Residential movement | immediately after `applyBandDecision` in the seasonal production loop | production `decisionId`, selected action and target, before/after position, and `movementRecordId` only when a movement record actually materializes |
| Camp movement | the same post-decision seam | `campActionId`, local-shift or temporary-task-camp kind, target, real camp-record ID, before/after position |
| Resource activity | after the real `runDailyActions` same-day task resolves | `activityActionId`, task/trip ID, selected patch/tile, workers, route, physical outcome, receipt ID and usable support |
| Daughter foundation | immediately after the annual fission authority returns | `fissionActionId`, parent, selected target, daughter ID and initial position, plus an explicit `daughterActuallyCreated` boolean |

Candidate arrays, influence arrays and rankings remain reader outputs. They are
not promoted to physical actions.

## 4. Replay soundness and terminal classes

Each replay begins from the immutable day immediately before the chosen return.
The control executes the real writer and must match a fresh canonical
diagnostics-off capture at the return day, every intervening seasonal boundary,
and the end of the follow window. An unsound control is excluded as
`CONTROL_REPLAY_UNSOUND`.

The counterfactual differs only at the one writer tuple. The intentionally
different target record and its same-day observation-history product are
removed before downstream-state comparison. Every sound row receives the most
consequential of:

```text
WRITE_SUPPRESSION_NO_TRACKED_CONSEQUENCE
WRITE_CHANGED_STORED_STATE_ONLY
ACTUAL_READER_CONSULTED_SAME_OUTPUT
ACTUAL_READER_OUTPUT_CHANGED
SELECTED_ACTION_CHANGED
PHYSICAL_ACTION_CHANGED
RECEIPT_OR_SUPPORT_CHANGED
DEMOGRAPHY_CHANGED
```

Reader consultation is not inferred from a knowledge-store count, a state
hash, or a missing refresh. Selected-action and physical-action classes require
their own exact production streams.

## 5. Anti-omniscience

The reader ledger receives only the band record already being dereferenced. It
never receives a `Tile` or an ecology stock. The separate hidden-truth
perturbation holds the band-known record fixed, changes the underlying physical
tile, observes real reader calls, and requires identical reader outputs and
action streams. This distinguishes an actual epistemic read from accidental
access to hidden world truth.

