# Correction — `daughterSeasonalSupport: "INHERITED"`

**The historical result is not overwritten.** `fission-before.json` keeps the value it measured.
This document says what that value meant and which of the three statements was wrong.

---

## The contradiction

Three statements, at most two of which could be true:

| source | statement |
|---|---|
| `fission-before.json`, both events | `daughterSeasonalSupport: "INHERITED"` |
| `demography.ts:1024` | `seasonalSupport: undefined` |
| `BEFORE_ARCHITECTURE_AUDIT.md` | support is "reset" |

---

## What the original probe measured

The expression, reproduced exactly:

```js
daughterSeasonalSupport: b.seasonalSupport === undefined ? "reset" : "INHERITED"
```

It sampled `b` at the **end of the simulated day on which the fission occurred** — after
`advanceWorldByDays(world, 1)` returned. It then labelled **any** non-`undefined` value
`"INHERITED"`.

Both parts of that are wrong for this field.

## The exact creation-time value

`src/sim/agents/demography.ts:1024`:

```ts
seasonalSupport: undefined,
```

**The daughter is constructed with no seasonal support at all.** The written audit's "reset" was
**correct about creation time**.

## The first later writer

`src/sim/agents/socialContext.ts:283`, reached from `src/sim/tick/advance.ts:284`:

```ts
seasonalSupport: seasonalSupport ?? band.seasonalSupport,
```

That is the **final `updateBandContextStates` pass**, which runs *after*
`updateBandsDemographyAndFission` (`advance.ts:237`) and **inside the same simulated day**. It
derives a fresh seasonal support for every band, including the newly created daughter, from that
band's own position and state.

So by the time the probe looked, the field was populated — not because anything was carried over,
but because it had been **recomputed for the daughter from the daughter's own condition**.

## Verdict

**The probe's label was wrong. Production is correct. The written audit was correct but incomplete.**

Both of the brief's candidate causes apply, and they compound:

- **(a) sampled after a later context update** — the final context pass had already run;
- **(c) confused derived support with inherited support** — the label asserted provenance from
  presence alone.

`"INHERITED"` was never true of this field at any instant. The written claim "reset" was true at
creation and merely silent about the same-day re-derivation.

**No production defect.** This is an instrument-label error in this checkpoint's own before-probe,
recorded rather than quietly fixed.

---

## The question that actually matters

The label is not the important part. The important part is whether anything **physical** crossed.

| question | answer |
|---|---|
| was the physical receipt store inherited? | **No** — `seasonalFoodReceipts` reads `reset` in every observed fission |
| does the derived support object carry physical receipts? | **No** |
| is the daughter's support object the parent's object? | **No** |
| does it deep-equal the parent's? | **No** |
| were expeditions or current trips inherited? | **No** — 0 and 0 |

`seasonalFoodReceipts` is the **physical** accumulator; `seasonalSupport` is a **derived read-model**
over it. A daughter holding no receipts derives a support state that describes exactly that.

### The measurement that settles it

| reading | value |
|---|---|
| daughter `rawSupportRatio` | **0** |
| parent `rawSupportRatio` before fission | **1.12** |
| parent `rawSupportRatio` after fission | 0.26 |

**The daughter's support object is a freshly derived description of having nothing.** It is not the
parent's object, it does not deep-equal the parent's, and it carries no receipts. The label
`"INHERITED"` was not merely imprecise — it was the opposite of what the value says.

**The before-package's material claim stands unchanged: nothing physical is inherited at fission.
This correction changes the label, not the ledger.**

---

## What the implementation must carry forward

1. **Distinguish the physical store from the derived read-model.** Any Item 4 material ledger that
   treats `seasonalSupport` as evidence of carried material will be wrong in the same way this probe
   was.
2. **Sample at a named sub-step, not at end-of-day.** A daughter created mid-tick is written again
   before the day ends, so "what did it start with" and "what did it have at midnight" are different
   questions. This is the same sampling-cadence lesson CORRECTION-34A recorded for physical presence
   and CORRECTION-34D for demographic boundaries — a third instance, and worth treating as a
   standing rule rather than a recurring surprise.
3. **Do not let presence stand in for provenance.** `!== undefined` says a value exists. It says
   nothing about where it came from.
