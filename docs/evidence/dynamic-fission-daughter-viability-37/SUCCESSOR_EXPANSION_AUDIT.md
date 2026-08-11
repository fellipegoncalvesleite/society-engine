# Successor quarantine-release / cross-system expansion audit

Stabilization is not only a phase write. It changes `isProvisionalSuccessor` from true to false, so
older established-band readers become eligible immediately. This audit records which state must be
initialized atomically and which state must remain absent until its own ordinary writer runs.

## Atomic release state

| State | Release action | Why |
|---|---|---|
| `currentCampTileId` | set to the physically reached current position | Daily residential activity may not start from the parent's old camp or no camp. |
| `lineage` | create at stabilization; origin is departure tile, creation time is stabilization time | A completed daughter link was false during provisional life and true only now. |
| `deepHistory` | create a truthful stabilization-day founding snapshot | Existing daughter helper assumes instantaneous fission and would rewrite later parent condition into departure day. |
| completion event | append the identical bounded object to parent and successor | Both histories agree on the outcome and direct departure join. |
| lifecycle terminal state | write kernel state and completion-event id | Makes the entity non-provisional without deleting provenance. |
| `lineageReadability` | recompute immediately from released state | Stored UI/chronicle readers must not retain an absent/provisional label until a seasonal refresh. |

## State deliberately not fabricated

| State | Release value | Normal writer / interpretation |
|---|---|---|
| `viability` | absent | `updateBandViabilityStates` computes it on the ordinary pipeline; absence is unknown, not comfort. The controlled three-person band is later judged harshly/absorbed, proving stabilization is not immunity. |
| `residentialAnchor` | absent | Ordinary residential movement establishes it from lived use. |
| `protoCampMemory` | absent | `applyProtoCampContext` creates a first current-place record; it initially classifies `campLikeState = none`, not a free settlement. |
| seasonal context/read caches | no invented values | Rebuilt by their existing context writers. |
| ordinary trip receipts | none on stabilization day | Daily trip actions already ran while the group was provisional. |
| legacy `BandFissionEvent` | none | It encodes an instantaneous completed split and is not truthful for Direction D. |
| contact memory | lineage link starts at zero | Parent/successor history agreement does not create current social contact. |

## Reader audit

| Reader/system | Provisional behavior | Released behavior / safety result |
|---|---|---|
| seasonal decisions and demography | quarantined from established assumptions | eligible only on a later cycle; real cohorts and support are retained |
| future fission | `isFissionEligibleParent = false` | structurally eligible after stabilization, still subject to all ordinary gates |
| ordinary viability | provisional-specific branch | consumes the released band on its own cadence; may absorb/extinguish it normally |
| trips/expeditions | explicitly skip provisional successors | current camp is initialized before later admission |
| residential/proto-camp | parent camp/anchor reset at departure | no anchor or camp history invented; ordinary writer begins from current position |
| ecology/depletion | provisional bodies already physically consume/deplete | no discontinuity; the operation proof preserves actual patch depletion |
| encounters/social | living bodies remain present throughout | lineage contact memory is zero; no remote-contact fact is invented |
| parent history | departure only while trial is open | completed daughter episode becomes true only on stabilization |
| successor history | no founding snapshot while provisional | founding snapshot is at stabilization tile/day and separately references departure |
| canonical events | no completed daughter event | successor event is personally lived; the parent's objective matching history record is not projected as an inherited/lived event, so no contact or knowledge channel is invented |
| life/identity/chronicle UI | “provisional separation” | “established daughter” backed by lineage, deep history and completion event |
| live map projection | provisional marker/ring | completion-aware daughter marker; no position change |

## Historical timing

Physical departure and positive completion are two bounded records:

1. `SuccessorDepartureRecord` is written by the atomic body-transfer seam. It contains commitment,
   spent permit, exact cohorts, origin, accepted target and conservation values. It claims no success.
2. `SuccessorStabilizationEvent` is written only after the kernel accepts the physical-event
   transition. It contains the completion tile/day and independent-operation proof, and joins the
   earlier departure by id.

The new deep-history helper uses departure-time facts only from the immutable departure record.
Parent food/water/hunger/extinction state was not captured at departure, so those values remain
explicitly unknown rather than being read from the parent on stabilization day.

Fixture N9 calls the sole release writer with an `establishing` state and receives
`historical_completion_before_stabilization`. Mutation M6 removes that guard and hides a phase write
inside release; the same fixture then wrongly creates lineage, deep history and completion events.
