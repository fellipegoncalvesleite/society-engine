# Roadmap Item 4 — architecture decision

Written after the before-audit, from the measured current chain rather than from an assumption
about it. The comparison is recorded in full because the selected direction is **not** the one that
changes the fewest files.

---

## 1. What the current chain actually is

Read from production at `ef76971`, confirmed by `fission-before.json`:

```
annual demographic step (spring only)
  → splitPressure accumulates from ~12 pressures
  → selectFissionTarget over band-KNOWN observed tiles (confidence ≥ 0.34)
  → getSplitDeferredReason blocks on: low population / no viable frontier / high risk
  → eligible = no deferral && splitPressure ≥ threshold (or crisis breakaway) && cooldown
  → createDaughterBand:
       founders = population − physically away − prepared commitments
       daughterPopulation = min(getDaughterPopulation(total), founders)
       BLOCK if < DAUGHTER_MIN_POPULATION
       construct daughter AT target.tileId, status "foraging", permanently ordinary
```

**What is already right, and is kept.** Founder availability is genuinely checked — CORRECTION-34C
and -34D exclude physically-away bodies and withhold prepared commitments, and block rather than
borrow. Destination selection is genuinely band-known. Knowledge inheritance is genuinely partial
and degraded, with a clone guard over a registered field list. Support and current commitments are
genuinely reset. **None of that needs redoing.**

**What is wrong, and is what Item 4 exists to fix.**

| # | Defect | Evidence |
|---|---|---|
| 1 | **Fission is instantaneous.** A complete, permanent daughter exists within one simulated day. There is no proposal, no commitment, no preparation, no journey. | `fission-before.json` — no attempt state exists at any point |
| 2 | **The daughter teleports.** It is constructed with `position: target.tileId`. Nobody walks; no movement authority is consulted. | `createDaughterBand`, `position: target.tileId` |
| 3 | **Cohort composition is destroyed on both sides.** Parent-after and daughter both pass through `recomputeDemographicCounts`, which *re-derives* cohorts from population at fixed ratios (dependents 35%, elders 10%, remainder working adults). The parent's actual composition is discarded. | `recomputeDemographicCounts`, called for both |
| 4 | **Viability is one inequality.** `daughterPopulation ≥ DAUGHTER_MIN_POPULATION`. There is no parent residual viability test and no successor viability test of any kind. | `createDaughterBand` |
| 5 | **Failure is impossible.** Creation either happens completely or does not happen at all; once created, a daughter is an ordinary band forever. No return, no reintegration, no failed establishment. | no such code path exists |
| 6 | **The event's conservation claim is a restatement.** `worldPopulationAfterFission` is *assigned* `worldPopulationBeforeFission`, so `fissionPopulationConserved` can never be false. | `createDaughterBand` |

Defect 3 is the one a reader is most likely to miss and is the most consequential for realism: a
band that has just aged badly, or lost working adults, splits into two groups **both** of which have
a textbook age structure. **The split launders composition.**

---

## 2. Directions compared

### Direction A — phaseful fission attempt on the parent

A bounded `FissionAttempt` on the parent records proposal → support → preparation → departure →
resolution. No second band exists until departure.

**For:** reversibility is natural; abandonment is just leaving the state; no new entity while
nothing physical has happened; conservation is trivial before departure because nobody moved.

**Against:** it answers nothing about the period *after* people walk out. Departed founders must be
physically somewhere, must eat, and must be represented in presence and crowding. Direction A alone
would either teleport them at the end (defect 2 unfixed) or need a second mechanism anyway.

### Direction B — provisional successor entity

A physically real but *provisional* band exists during an establishment window, becoming ordinary
only after viability is demonstrated.

**For:** it reuses the Band machinery that already places bodies, feeds them, moves them and
conserves them; the establishment window is where early failure genuinely lives; it is the only
direction that can express "they left and it did not work".

**Against:** a provisional band is, to every other system, an ordinary band — decisions, demography,
crowding, expeditions all see it. Making it *provisional* means auditing every reader, which is a
large surface. It also says nothing about the reversible period *before* departure.

### Direction C — bounded extension around `createDaughterBand`

Keep the creation seam; add pre-creation feasibility and post-creation stabilization authorities.

**For:** smallest diff; no new entity; no new lifecycle.

**Against — and this is decisive:** it cannot fix defects 1, 2 or 5. Creation stays instantaneous,
the daughter still appears at the target, and "post-creation stabilization" on an already-ordinary
band is a label rather than a state. It would produce exactly the decorative state §3.2 forbids.
**Rejected.**

### Direction D — attempt on the parent, resolving into a provisional successor

**A + B in sequence, with a single explicit hand-off.** The attempt is the reversible phase and
holds no bodies. At departure — one event, one movement of people — the attempt resolves into a
provisional successor band that is physically real, co-resident with the parent, and must travel and
establish. The establishment window ends in stabilization or in return.

**For:** each half is used where it is truthful. Before departure nothing physical has happened, so
the attempt is cheap and freely abandonable. After departure people genuinely exist somewhere, so
the existing Band machinery carries them. The hand-off is the single place where conservation must
be proven, which makes it auditable in one location rather than diffusely.

**Against:** two states rather than one, and the provisional-band reader surface from Direction B
still has to be audited.

---

## 3. Selected — Direction D

Chosen because it is the smallest architecture that can be **causally truthful about all six
defects**, not because it is the smallest diff. Direction C is smaller and cannot fix half of them.

```
        (reversible, no bodies moved)          (physical, bodies moved exactly once)
pressure ─► proposal ─► commitment ─► DEPARTURE ─► provisional successor ─► stabilized daughter
              │            │                              │
              └── abandon ─┘                              └── return / reintegrate
```

### The phases, and what each may and may not do

| phase | bodies moved | may be abandoned | what it proves |
|---|---|---|---|
| **pressure** | no | n/a | nothing — it is a reading, not an intention |
| **proposal** | no | yes, freely | that separation is being considered, and why |
| **commitment** | no | yes | that specific aggregate founders and a specific known destination are named |
| **departure** | **yes, once** | no — it has happened | that people physically left one place |
| **provisional successor** | travels normally | resolves by return or stabilization | that a group is trying to function independently |
| **stabilized daughter** | ordinary | no | only that it met the bounded early conditions — **not** that it will survive |

### The conservation seam

Departure is the **only** moment population moves between entities, and it is the only place the
invariant must be proven:

```
parent physical people after
  + provisional successor physical people
  + explicitly recorded losses
  = parent physical people before
```

and separately, cohort-by-cohort — which is defect 3's repair:

```
parent workingAdults after + successor workingAdults = parent workingAdults before
parent dependents    after + successor dependents    = parent dependents    before
parent elders        after + successor elders        = parent elders        before
```

**Cohorts must be ALLOCATED, not re-derived.** The allocation convention must state which cohort is
drawn first and why, and must state plainly that it cannot know *which people* — there are no
individuals to know. That is an accounting convention and must be named as one (see
`RESEARCH_CONSTRAINTS.md` §8).

### What must not be built

- No new absorption or dissolution system — Roadmap Item 6 owns those.
- No cancellation of a prepared expedition as a *side effect*; if the prepared-commitment policy is
  "release", it must be an explicit, recorded transition.
- No teleport at any phase.
- No support, food, containers or carrying technology created by separating.
- No household, kin, faction or sex structure invented to decide who leaves.
- No re-attachment of the three inert territorial names.

---

## 4. Status of this checkpoint

**The audit and architecture phases are complete. The implementation is NOT started, and no
production file has been changed** — `git diff ef76971..HEAD -- src/` is empty.

This is a deliberate stopping point rather than an incomplete one. Implementing Direction D means a
new attempt state, a new provisional-successor lifecycle, a cohort-allocation authority, a physical
departure transition, an establishment window with resolution, and the audit of every reader that
would see a provisional band — together with the twenty-six controlled fixtures, the natural runs
and the full Item 3 regression that this repository requires before a production change of that size
is credible.

Shipping half of that would leave exactly the half-state that `CLAUDE.md` §18 forbids: an attempt
state nothing resolves, or a provisional band every other system already treats as ordinary. The
before-evidence and the architecture are therefore committed on their own, so the implementation
starts from a measured baseline and a decided design rather than from a fresh reading of the same
code.

**Verdict: PROGRESS. Roadmap Item 4 remains active.**
