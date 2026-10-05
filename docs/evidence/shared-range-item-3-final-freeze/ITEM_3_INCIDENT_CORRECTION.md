# Superseding addendum — the released-place incident is twice the size that was published

**This is an addendum. Nothing in the Item 3 final-integration evidence has been rewritten, and its
`PROGRESS` verdict was correct.** The blocker it identified was real, it survived every artefact
test it applied, and naming it rather than waving it through is why this correction exists.

One number in it is understated, and the reason is worth recording.

---

## What was published

`released-place-probe.json`, seed `audit27:natural:map2:s1`, 200 years:

```
day 44,640   band:varied-estuary:daughter:1:t412   tile:194:90
phase released_historical   activeEvidenceCount 0   historicalEvidenceCount 1
activeEvidenceWeight 0.04

onlyThisTilesRecordsStrippedDelta: 0.02
  strangerCaution              0.01
  sharedUsePressure            0
  rememberedRefusalAvoidance   0.01
```

`ITEM_3_FINAL_FINDINGS.md` reported the magnitude as `<= 0.02`.

## What the probe actually measured

**Three scalars.** `ProtoAccessMemory` carries six that change behaviour:

```
strangerCaution   sharedUsePressure   rememberedRefusalAvoidance
rememberedCooperationTolerance        kinTolerance        familiarTolerance
```

The probe read the first three. It never looked at the other three, so it could not have found a
movement in them.

## The re-measurement

Same seed, same day, same band, same tile, same strip-only-this-tile's-records method, run on the
**parent tree `742b567` where the incident exists**, reading all six:

| scalar | delta | read by the original probe? |
|---|---|---|
| `strangerCaution` | **0.01** | yes |
| `sharedUsePressure` | 0 | yes |
| `rememberedRefusalAvoidance` | **0.01** | yes |
| `rememberedCooperationTolerance` | 0 | **no** |
| **`kinTolerance`** | **0.02** | **no** |
| `familiarTolerance` | 0 | **no** |
| **total across all six** | **0.04** | |
| total across the original three | 0.02 | — reproduces the published figure exactly |

Evidence: `docs/evidence/shared-range-release-territorial-authority-35/` →
`release-territorial-natural-200y-incident-seed.json` and the parent-tree arm described in
`FINDINGS.md`.

**The true magnitude is 0.04, and `kinTolerance` is its largest single component — larger than
either scalar the original probe did see.** The original three reproduce to the digit, which is what
confirms this is the same incident and not a different one.

---

## Why the original verdict still stands

The Item 3 audit's argument was: *a place production labels `released_historical` can still move
behaviour, therefore the label leads its own quantity, therefore Item 3 is not freezable.*

Doubling the magnitude strengthens that argument. It does not alter it. Specifically:

- the incident still survives all three artefact tests;
- the frequency is unchanged — 1 in 448 released samples on that seed, 0 in 193 on the other;
- the recommended smallest correction is unchanged, and is what CORRECTION-35 Part A implements;
- nothing revives, and the contribution curve still reaches exactly zero.

## The lesson worth keeping

The instrument chose its own denominator. A probe that reads three of six scalars cannot report a
bound on "how much behaviour moved" — it can only report how much moved **in the fields it read**,
and the published `<= 0.02` should have carried that qualification.

Any future probe asserting a bound on social behavioural movement should enumerate the scalar set it
reads, in the output, next to the number.

---

## Status after CORRECTION-35

The incident's evidence shape — a record weighing `0.04`, strictly between zero and
`SOCIAL_EVIDENCE_ACTIVE_MIN_WEIGHT` — is now labelled:

```
phase cooling   activeEvidenceCount 1   historicalEvidenceCount 0
```

The behaviour it moves is **unchanged**; only the label is now true of it. The Item 3 audit's own
unmodified `itemThreeReleasedPlaceProbe.mjs`, rerun on the corrected tree, reports
**0 incidents found** — "no released place moved behaviour in the scanned window".

That probe's denominator moves with the world (448 released samples on the parent, 305 on the
corrected tree), because CORRECTION-35 Part B changes movement decisions and therefore the
200-year trajectory. The 1 → 0 is **not** a like-for-like comparison on one world, and is reported
that way. The like-for-like proof is the controlled fixture pair `L1` / `L2`.
