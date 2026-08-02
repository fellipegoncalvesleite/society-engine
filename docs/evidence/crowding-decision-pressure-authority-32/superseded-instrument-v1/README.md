# SUPERSEDED — CORRECTION-32 attribution instrument v1

**Every attribution number in this directory is invalid. Do not cite any of it.**

These files are preserved, not deleted, because an audit that quietly erases the evidence that
convicted it cannot be trusted the second time either.

## What the instrument did

`scripts/crowdingDecisionAttributionAudit.mjs` built each band's decision twice — once normally,
once with `cache.nearbyBandPressureByBandTileKey` swapped for a Map-like answering "nobody
nearby" — and then subtracted the two candidate scores:

```js
const zeroByKey = new Map(decisionZero.alternativesConsidered.map((a) => [actionKey(a.action), a]));
// ...
const total = zeroAlt === undefined ? null : r4(zeroAlt.score - alt.score);
```

with

```js
const actionKey = (action) =>
  action.type === "stay" ? `stay:${action.tileId}`
  : action.targetTileId !== undefined ? `${action.type}:${action.targetTileId}`
  : action.type;
```

It then published `RESIDUAL = TOTAL - sum(DIRECT)` and described the residual as crowding flowing
through nested composites.

## Why it was rejected

**`actionKey` is not unique, and `new Map(...)` silently kept only the last candidate holding
each key.**

`buildCorridorRelocationCandidate` (M0.8) emits a `move_to_tile` action whose target tile can
coincide with an ordinary known move's. Both candidates therefore hashed to the same key. The full
arm's list kept both; the control arm's `Map` kept one. The instrument then subtracted **two
different candidates**, from two different families, and reported the difference as the causal
effect of crowding.

Measured directly, in `../candidate-pairing-integrity.json`:

| fixture | colliding key | core candidate | corridor-relocation candidate | reported "crowding influence" |
| --- | --- | --- | --- | --- |
| `P1_zero_crowding_control` | `move_to_tile:tile:196:90` | 4.71 | 1.32 | **−3.39** |
| `F1_adjacent_pair_rich` | `move_to_tile:tile:194:90` | 4.98 | 0.96 | **−4.02** |
| `F2_solo_control_rich` | `move_to_tile:tile:196:90` | 4.71 | 1.32 | **−3.39** |

Every impossible residual in both arms sits on a colliding key — 2 excess duplicate entries per
arm, 2 impossible residuals per arm, a 1:1 match. `−4.02` is `0.96 − 4.98`. It is a subtraction
between a relocation candidate and a move candidate. It is not crowding, and on `P1` and `F2` the
band had **no neighbours at all**: `weightedCrowding 0`, `nearbyBandCount 0`, `crowdingBandIds []`,
every named crowding charge `0`.

Two further defects follow from the same design:

1. **`RESIDUAL = TOTAL − sum(DIRECT)` was never admissible.** A residual is only evidence of
   nested crowding if every non-crowding input is provably identical, and the instrument never
   checked. It could equally contain a changed candidate context, a different external score
   addition, a changed candidate set, or — as here — a pairing error.
2. **Composite fields were substituted by an observed RATIO**
   (`zeroSource * (storedValue / fullSource)`), an approximation presented alongside exact
   figures without the distinction being carried into the summaries.

## Which files are invalid for attribution

| File | Status |
| --- | --- |
| `counterfactual-matrix.json` | **INVALID** — `totalCrowdingInfluence`, `residualThroughNestedComposites`, `directPathSum` and every summary built on them |
| `counterfactual-matrix-before.json` | **INVALID** — same |
| `influence-attribution.json` | **INVALID** — derived from the matrix |
| `controlled-fixtures.json` | **PARTLY INVALID** — every `totalCrowdingInfluence`; the P1 zero control is invalid as a control because it verified `stay.totalCrowdingInfluence` only while a move candidate in the same payload read −3.39 |
| `controlled-fixtures-before.json` | **PARTLY INVALID** — same |
| `before-after.json` | **PARTLY INVALID** — every row sourced from the matrix |

The **physical readings** in these files — `weightedCrowding`, `nearbyBandCount`,
`crowdingBandIds`, `crowdingPenalty`, the pressure-state and range-saturation full/zero pairs, the
depletion, catchment and social independence probes — were never produced by the broken pairing
and are not withdrawn. Only the whole-candidate score subtraction and everything derived from it
is rejected.

## Claims that must not be reused

- any `totalCrowdingInfluence` figure;
- any `residualThroughNestedComposites` figure, and the phrase "residual through nested
  composites" as a measured quantity;
- the claim that P1 is a zero-crowding control;
- `candidatesWithThreeOrMoreDirectCrowdingPaths` **49 → 0** and the natural **56 → 0** / **144 → 0**
  restatements of it, which counted paths under the superseded field grouping (composite fields
  were zeroed wholesale, so a candidate's food, water and own-use terms were counted as crowding);
- `maxPathsOnAnyCandidate 4 → 2`.

The corrected replacements are in `../fixed-breakdown-attribution{,-before}.json` and
`../candidate-pairing-integrity{,-before}.json`.

## What was NOT rejected

**The production implementation was not rejected because of this instrument failure.** The defect
is in the audit's pairing, not in `src/sim`. The corrected instrument — which holds every
non-crowding field of a single fixed candidate byte-identical and rejects any pair it cannot prove
clean — was run on both arms and **supports** the production consolidation. See
`../INSTRUMENT_CORRECTION.md` §8 and `../FINDINGS.md`.

The superseded script itself is retained at `scripts/crowdingDecisionAttributionAudit.mjs` with a
header marking it superseded, so the history stays inspectable and nobody re-runs it by accident.
