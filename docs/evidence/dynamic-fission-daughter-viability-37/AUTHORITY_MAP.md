# Roadmap Item 4 — authority map

> **Current implementation overlay (2026-08-11, branch
> `checkpoint/dynamic-fission-provisional-successor-38`).** This file began as the audit-only map at
> `ef76971`; the tables below are retained as the measured baseline. The current controlled-only
> positive outcome uses a dedicated `successorStabilization.ts` adapter plus a separate conjunctive
> proof object. Its authorities are direct commitment/consumed-permit/departure provenance,
> post-departure operation history, canonical cohort/embodied state and monotonic separation-course
> state. Stabilization atomically initializes completed lineage/history/current-camp/read-model state.
> Timeout cannot succeed, bounded lifecycle history cannot prove “never returned,” and no legacy
> fission event is recreated. Natural physical departure remains disconnected;
> `performAtomicDeparture` has zero natural callers and `createDaughterBand` remains unchanged and
> unreachable. `unresolved_after_failed_return` is still open and is the next Item-4 dependency.

**Historical baseline below:** left column is what fission did at `ef76971`; right column is what
Direction D required at that time.

---

## Current authorities, read from production at `ef76971`

| Question | Authority today | Verdict |
|---|---|---|
| when may a band consider splitting? | `demography.splitPressure` ≥ `SPLIT_PRESSURE_THRESHOLD`, or crisis breakaway, plus a cooldown — evaluated **only** in the annual spring step | keep the multi-cause pressure, **replace the single gate** |
| what blocks it? | `getSplitDeferredReason` — low population / no viable frontier / high risk | keep; extend with residual and successor viability |
| where would it go? | `selectFissionTarget` over `band.knowledge.observedTiles`, confidence ≥ 0.34 | **correct — keep unchanged** |
| who can leave? | `population − derivePhysicallyAwayPartyPeople − derivePreparedCommitmentPartyPeople`, blocked below `DAUGHTER_MIN_POPULATION` | **correct — keep unchanged** |
| how many leave? | `getDaughterPopulation` — a scale-class fraction, capped | keep as a proposal size; it must become a *request*, not a fact |
| **which cohorts leave?** | **nothing allocates them.** Both sides pass through `recomputeDemographicCounts`, which re-derives from population at fixed ratios | **REPLACE — this is defect 3** |
| where does the daughter appear? | `position: target.tileId` — directly at the destination | **REPLACE — this is defect 2** |
| is the parent still viable? | **no authority exists** | **ADD** |
| is the successor viable? | `daughterPopulation ≥ DAUGHTER_MIN_POPULATION` and nothing else | **ADD** |
| can it fail? | **no authority exists** | **ADD** |
| what does it start with? | support, receipts, trips and expeditions all reset; knowledge partial and degraded | **correct — keep unchanged** |
| what records it? | `BandFissionEvent` + `BandLineageLink`, bounded | extend with attempt identity and outcome |

## Authorities Direction D must add

| Authority | Owns | Must not |
|---|---|---|
| **fission attempt state** | proposal → commitment, reversible, bodies unmoved | hold bodies; survive unresolved; grow unbounded |
| **cohort allocation** | which aggregate cohorts leave, and in what order | claim to know *which people*; invent households, kin or sex |
| **parent residual viability** | whether what remains is coherent | silently shrink the request without recording it |
| **departure transition** | moving bodies exactly once | teleport; consult anything but an existing movement authority |
| **provisional successor lifecycle** | the establishment window | be indistinguishable from an ordinary band to other readers |
| **establishment resolution** | stabilize / return / reintegrate | implement general dissolution — that is Item 6 |

## Conservation seam

Departure is the **only** moment population moves between entities:

```
parent people after + successor people + explicitly recorded losses = parent people before
parent workingAdults after + successor workingAdults = parent workingAdults before
parent dependents    after + successor dependents    = parent dependents    before
parent elders        after + successor elders        = parent elders        before
```

The cohort lines are **currently false in 0 of 2 natural fissions** — see
`BEFORE_ARCHITECTURE_AUDIT.md`.

## Boundaries that hold unchanged

Item 3 is frozen and this checkpoint touches none of it. Physical crowding stays physical;
encounters stay proximity-gated; friction stays attributable; access expectation stays remembered
interpretation; released evidence contributes zero; the CORRECTION-32 direct-charge bounds hold.

The **three inert territorial names** — `Band.territorialPressure`,
`SocialPressureProfile.territorialPressure`, `Reason<"territorial_pressure">` — remain inert.
Item 4 gives none of them a writer.

Roadmap Item 6 owns band dissolution, long-term absorption and terminal extinction. Item 4 owns
only the **bounded early establishment window**.
