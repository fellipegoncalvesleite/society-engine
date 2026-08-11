# Positive successor stabilization decision

Status: implemented in the controlled-only Item-4 subpass. Natural physical departure remains
disconnected.

## Question

When may a physically departed provisional successor become an ordinary established band?

The answer must prove that a positively chosen separation actually operated as a human group. It
must not make prosperity, sedentary residence, elapsed time, population, hidden destination quality
or a count of descriptive diagnostics into identity authority.

## Architectures compared

| Architecture | Strength | Failure / cost | Verdict |
|---|---|---|---|
| A. Dedicated world adapter | One explicit owner can validate provenance, ask the kernel and release quarantine atomically. | Becomes omniscient if it re-derives hunger, water, destination quality or population from raw world state. | Selected, with a narrow input boundary. |
| B. Extend `provisionalEstablishment` | Small local diff; the module already publishes site diagnostics. | Gives a descriptive locality-measurement module group-identity authority and invites `satisfiedSignals >= N`; also biases success toward staying on one tile. | Rejected. Establishment remains descriptive. |
| C. Separate proof object | Bounded, explainable, mutation-testable conjunction whose quantities retain their source authorities. | A proof object alone cannot update the world or initialize older readers. | Selected as the adapter's input. |
| D. Make the kernel derive success | Centralizes phase logic. | The pure kernel has no `Band`, ecology or provenance and would need world knowledge, duplicating every physical authority. | Rejected. The kernel checks only named claims. |

The selected architecture is **A + C**:

1. `deriveSuccessorIndependentOperationEvidence` derives one bounded proof from successor-owned,
   already-written facts.
2. `advanceSuccessorStabilization` validates direct departure provenance and the monotonic
   never-returned record.
3. The adapter preflights the release, requests `establishing -> stabilized` with a
   `physical_event` cause, and publishes completion state atomically only after the kernel accepts.

## Independent-operation contract

The proof is a conjunction; no term compensates for another:

- the group is physically at its accepted target in `establishing`;
- one ordinary, outcome-blind demand window closed after departure;
- demand and worker-days are positive;
- usable food was physically taken and the same operation applied positive plant depletion;
- support is at or above the existing return-failure floor (`0.35`);
- mean standing-tile water stress is below the existing no-water line (`0.4`);
- population is positive and at least two working adults remain;
- embodied mortality burden is below the existing return line;
- the canonical return authority does not currently choose abandonment.

The window may span several tiles. Its roughly ten-day stable-composition cadence is inherited from
the existing demand fraction (`seasonal demand / 9`), not introduced as a stabilization duration.
Closing a window still grants no lifecycle outcome by itself.

The positive controlled run closed an 11-day window across four occupied tiles: support `0.1412`,
demand `0.3663`, ratio `0.3855`, six real extraction days, 12 worker-days, depletion `0.1618`, mean
water stress `0`, three living working adults. This is adequate operation, not prosperity: hunger
pressure remained `0.51` and support stayed below full demand.

## Evidence authorities

| Claim | Existing authority consumed |
|---|---|
| physical arrival | `provisionalTravel` transition and band position |
| demand | `carryingCapacity.derivePopulationDemand` |
| extraction and depletion | `plantStock.resolvePlantFoodHarvest` via `provisionalTravelSubsistence` |
| bounded operation window | `ProvisionalOperationHistory` |
| water | standing-tile water term in `provisionalTravelSubsistence` |
| working/living population | canonical band demography cohorts |
| embodied burden | `Band.acuteRisk.activeEffect` |
| current abandonment | `deriveProvisionalReturnDecision` |
| positive historical separation | prepared founder commitment + consumed permit + shared departure record |
| lifecycle legality | `fissionLifecycleKernel.requestTransition` |

No UI field, hidden richness, future knowledge, `ProvisionalEstablishmentState.satisfiedSignals` or
new hunger/viability score is read.

## Never-returned architecture

Alternatives considered:

- search `FissionLifecycleRecord.history` — rejected because the ring is capped at 12;
- retain an unbounded phase log — rejected because state would grow forever;
- infer from current phase — rejected because a later reconstruction or future transition could hide
  an earlier abandonment;
- one monotonic course record — selected.

The departure seam initializes `separationCourse = outbound_trial`. The first real transition into
`returning`, whether lived decision or timeout, replaces it with one absorbing
`return_path_entered` record containing first day, source phase and trigger. No writer can change it
back. Absence is not proof. Fixture N6 forces the ordinary phase ring to overflow until `returning`
is absent, restores otherwise qualifying evidence, and is still refused. Mutation M3 forces the
monotonic predicate true and the same fixture wrongly stabilizes.

## Timer and ordering

`stabilized.entryRequires` remains `physical_event`; the complete four-part kernel proof still fails
when the cause is `elapsed_time`. Establishment expiry remains `failed_early`.

Daily order is subsistence → return decision → descriptive establishment → stabilization → lifecycle
deadline. Stabilization skips `dayOfSeason = 0`; therefore it cannot make a band ordinary immediately
before the same day's seasonal pipeline. Ordinary daily writers have already run, so the first
possible ordinary behavior is a later cycle.

## Scope boundary

- `performAtomicDeparture` remains controlled-only with zero natural production callers.
- `createDaughterBand` is unchanged and remains unreachable from the new path.
- `unresolved_after_failed_return` remains event-bounded and cannot stabilize on old evidence.
- No natural provisional successor is created in this subpass.
- No Item-5 work is included.

## Validation closure

- positive/negative/divergent-outcome fixtures: 27/27 PASS, 0 vacuous;
- required source mutations: 6/6 PASS, 0 vacuous, production restored byte-identically;
- lifecycle kernel 14/14, lifecycle exit 10/10, subsistence 39/39, cleanup 12/12,
  quarantine 9/9, and all affected allocation/commitment/residual/preparation/departure/transfer/
  travel/return/reintegration/admission/reader suites green;
- both TypeScript projects and production build green; graph 221/764 with no duplicate or dangling
  nodes; import boundary PASS with 87 informational back-edges, unchanged;
- daily/seasonal full canonical state identical on both maps; all four step modes identical;
  season ordering physically invariant; deterministic benchmark repeat and fresh-process replay
  identical.
