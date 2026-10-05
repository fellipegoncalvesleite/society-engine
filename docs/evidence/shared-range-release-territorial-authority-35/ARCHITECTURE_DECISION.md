# CORRECTION-35 — architecture decision

Two defects, one checkpoint. They are unrelated in mechanism and are kept in separate commits so
each can be judged on its own evidence.

---

## PART A — a place called `released_historical` was still being listened to

### The defect

`types.ts:2480` said `released_historical` means "records are still held, and no longer move any
behaviour". `types.ts:2528` said `historicalEvidenceCount` counts "records the band still holds that
no longer move anything".

Neither was true of the code beneath them.

Every social contribution scales by `entry.weight`:

```
strongestFrictionRelation   bestContactTolerance   tensionFromFriction
the tolerance terms         the refusal terms      eventPressure
```

So an episode stops moving behaviour when its weight reaches **zero**. But the lifecycle labels were
derived from `weight >= SOCIAL_EVIDENCE_ACTIVE_MIN_WEIGHT (0.05)`. Any record in the open interval
`0 < weight < 0.05` was published as fully historical while still changing what the band did.

**The label led its own quantity.**

### The options

| Option | What it does | Verdict |
|---|---|---|
| **A. Derive the labels from `weight > 0`** | the three lifecycle fields report the contribution curve; the 0.05 threshold keeps its real job (confidence) | **SELECTED** |
| B. Floor sub-threshold weights to zero | makes behaviour match the label | **REJECTED** — changes production behaviour to fix a naming error, and needs its own before/after |
| C. Move `SOCIAL_EVIDENCE_ACTIVE_MIN_WEIGHT` to 0 | one-line | **REJECTED** — the constant is load-bearing for confidence; CORRECTION-31 introduced it precisely so retained records cannot prop up the confidence that must fall before `staleness` retires the memory |
| D. Rename the phase | honest about the mismatch | **REJECTED** — leaves `activeEvidenceCount 0` beside a record that is active |

Option A was already named as the smallest correction by the Item 3 final audit, which called it
"a DERIVED READ-MODEL FIELD ONLY, no behaviour change, no constant moved". That is what was built.

### What was built

`accessNorms.ts` now separates two questions that were being answered by one filter:

```ts
// which episodes support the memory's CONFIDENCE — the CORRECTION-31 threshold, unchanged
const confidenceEvidence  = friction.filter((e) => e.weight >= SOCIAL_EVIDENCE_ACTIVE_MIN_WEIGHT);
// which episodes still change a behaviour scalar AT ALL
const contributingEvidence = friction.filter((e) => e.weight > 0);
```

- `confidence` still reads `confidenceEvidence` — **numerically unchanged**.
- `activeEvidenceCount` = `contributingEvidence.length`
- `historicalEvidenceCount` = `friction.length - contributingEvidence.length`
- `socialEvidencePhase` = `none` → `released_historical` (nothing contributes) → `active`
  (weight 1) → `cooling`

`weight > 0` is an **exact** test, not an epsilon: `weighSocialEvidence` returns `round2(...)`, so a
weight of zero is a true multiplicative zero.

### Why this is not a behaviour change

Nothing that feeds a scalar was touched. Proven cross-tree in
`cross-tree-release-preservation.json`: parent `742b567` and the lifecycle-only commit `e5e3143`
produce **identical digests** for access behaviour (all six scalars plus confidence, 72 non-trivial
place-rows), decisions, candidates, pressure state and every reason's reported pressure.

---

## PART B — a spawn constant was giving every band a territorial motive

### The defect

`Band.territorialPressure` is written **twice, ever**: `0.12` at spawn, and
`clamp01(parent * 0.72 + 0.04)` when a daughter is created. No lived process writes it — not
crowding, not encounters, not friction, not access expectation, not contested use.

It nevertheless reached behaviour through **three** readers:

| reader | weight | what it moved |
|---|---|---|
| `agents/pressure.ts` | × 0.08 | `mobilityPressure` → `netMovePressure` → candidate scores |
| `rules/mobilityIntent.ts` | × 0.12 | opened and scored movement intents |
| `rules/bandDecision.ts` | × 0.14 | the `pressure` a stay reason reports about itself |

The brief named two. The third — `mobilityIntent.ts` — was found by the inventory.

So a band that had never met anyone carried a standing motive to move, labelled *territorial*, with
no territory and no history behind it. Measured on the parent tree: varying the field alone moves
**18 of 18** band-measurements.

### The options

| Option | What it does | Verdict |
|---|---|---|
| **A. Make the field behaviourally inert; keep it in state** | removes the three readers; the field survives for schema, history and the UI | **SELECTED** |
| B. Delete the field entirely | maximally honest | **REJECTED** — breaks serialized worlds and the UI projection for no behavioural gain, and destroys the name a future system should claim |
| C. Give it a lived writer now | makes the motive real | **REJECTED** — that is a new social system. Cultural or institutional territoriality belongs to a later roadmap item, and inventing one here to preserve a coefficient is exactly what §3.9 forbids |
| D. Fold its weight into crowding | preserves the magnitude | **REJECTED** — re-labels a phantom as a real signal and would silently re-tune `CROWDING_DECISION_COST_WEIGHT`, which CORRECTION-32 fixed as an authority and deliberately did not tune |

### Why removal, rather than a writer

Every consequence the field was reaching for is already owned by a signal with real provenance:

- **another band is physically here** → `crowdingPenalty` (CORRECTION-28 / -32)
- **we have had trouble over this place** → `recentRangeFrictionEvents` (CORRECTION-30)
- **I expect difficulty using this place** → `protoAccessMemory` (CORRECTION-31)

Adding a fourth would be the duplicate charge CORRECTION-32 spent a whole checkpoint removing.

### What was NOT done

- No lived territorial writer was added.
- No constant was re-tuned; `CROWDING_DECISION_COST_WEIGHT` is untouched.
- The field was not deleted from state.
- `SocialPressureProfile.territorialPressure` — a **different** field that has never had a reader —
  was not touched either, only documented. See `authority-matrix.md`.

---

## Boundary

`sharedCatchment.ts` is **unchanged**. Its residence-anchored footprint remains a real, open
limitation and is published in `shared-catchment-boundary.json` so freezing Item 3 cannot be read as
resolving it.

**Roadmap Item 4 was not started.** `createDaughterBand` is untouched by this correction.
