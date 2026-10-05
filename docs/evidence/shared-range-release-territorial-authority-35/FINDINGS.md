# CORRECTION-35 — findings

**Branch** `checkpoint/shared-range-release-territorial-authority-35`, from the Item 3
final-integration candidate freeze head `742b567`.
**Production behaviour changed — six files.**
**Roadmap Item 3 remains ACTIVE. Roadmap Item 4 was NOT started.**

Two defects the Item 3 final audit named and did not fix. One is the blocker that prevented its
freeze; the other is an orphan it recorded as still open.

---

## PART A — a place labelled `released_historical` was still being listened to

### The defect, in production's own words

`types.ts` said, in two places, that a released record "no longer moves anything". Every social
contribution in `accessNorms.ts` scales by `entry.weight` — `strongestFrictionRelation`,
`bestContactTolerance`, `tensionFromFriction`, the tolerance and refusal terms, `eventPressure` — so
a record stops moving behaviour when its weight reaches **zero**. The labels were derived from
`weight >= SOCIAL_EVIDENCE_ACTIVE_MIN_WEIGHT (0.05)`.

Everything in the open interval `0 < weight < 0.05` was therefore published as fully historical
while still changing what the band did. **The label led its own quantity.**

### The incident is twice the size that was published

The Item 3 audit found one natural case and reported it at `<= 0.02`. Re-measured on the parent tree
where it exists, at the same seed, day, band and tile, reading **all six** behaviour scalars instead
of three:

| scalar | delta | read by the original probe? |
|---|---|---|
| `strangerCaution` | 0.01 | yes |
| `sharedUsePressure` | 0 | yes |
| `rememberedRefusalAvoidance` | 0.01 | yes |
| `rememberedCooperationTolerance` | 0 | **no** |
| **`kinTolerance`** | **0.02** | **no** |
| `familiarTolerance` | 0 | **no** |
| **total** | **0.04** | |
| original three | 0.02 | reproduces the published figure exactly |

`kinTolerance` is the largest single component and the original probe never looked at it. Full
account in `../shared-range-item-3-final-freeze/ITEM_3_INCIDENT_CORRECTION.md`. **The Item 3
`PROGRESS` verdict was correct**; doubling the magnitude strengthens its argument.

### The repair

Two questions, answered separately:

```ts
const confidenceEvidence   = friction.filter((e) => e.weight >= SOCIAL_EVIDENCE_ACTIVE_MIN_WEIGHT);
const contributingEvidence = friction.filter((e) => e.weight > 0);
```

`confidence` still reads the 0.05 set — the CORRECTION-31 job of that threshold is untouched. The
three lifecycle fields now read the contribution curve. `weight > 0` is exact, not an epsilon:
`weighSocialEvidence` returns `round2(...)`, so zero is a true multiplicative zero.

### It changed no behaviour, and that is measured rather than asserted

`cross-tree-release-preservation.json` — the same probe run in three trees. Parent `742b567` versus
the lifecycle-only commit `e5e3143`:

| digest | result |
|---|---|
| access behaviour (all six scalars + confidence, 72 place-rows) | **IDENTICAL** |
| decisions (action, target, selected score, candidate set) | **IDENTICAL** |
| pressure state (`mobilityPressure`, `netMovePressure`) | **IDENTICAL** |
| every reason's reported pressure | **IDENTICAL** |

Non-vacuous: **all 72** compared place-rows carry at least one non-zero access scalar, so this is a
comparison of live readings and not of zeros.

### Natural occurrence — an honest mixture

- **Shared-range seed** (`audit27:natural:s1`), 20 / 50 / 200 years: the corrected interval is
  occupied **0 times** in 5,586 / 14,226 / 55,592 place-samples. At this seed the parent's labels
  were already right and the correction changes no published field.
- **Incident seed** (`audit27:natural:map2:s1`), 200 years: the interval IS occupied — **2 of
  55,714** place-samples, both at weight `0.04`, both now `cooling / activeCount 1 /
  historicalCount 0` where the parent published `released_historical / 0 / 1`.
- **Contradictions after the correction: 0** at every horizon on every seed.

A zero here is a null observation about frequency, not evidence the defect is unreal. The
controlled fixtures are the proof.

### The Item 3 blocker, closed by the instrument that found it

`itemThreeReleasedPlaceProbe.mjs`, unmodified, rerun on the corrected tree:

```
releasedPlacesChecked 305   incidentsFound 0
"no released place moved behaviour in the scanned window"
```

Its denominator moves with the world — 448 on the parent, 305 here — because Part B changes the
200-year trajectory. **The 1 → 0 is not a like-for-like comparison on one world and is not offered
as one.** The like-for-like proof is `L1` / `L2`.

### L1–L12

**12 fixtures, 0 failing, 0 vacuous, 1 NOT CONSTRUCTED.** `L3` is reported as
`NOT_CONSTRUCTED_NO_ROW_LANDS_EXACTLY_ON_0_05` rather than approximated: no integer age puts a
record exactly on the threshold on either the direct or the reported curve.

`L7` records a structural fact worth keeping: **direct evidence cannot naturally occupy the
sub-0.05 positive interval** — its decay is too coarse. The measured incident came through
**reported hearsay**, which is discounted by hop count and by the report's own freshness and so
lands there. The correction is about the interval, not about one channel.

---

## PART B — a spawn constant was giving every band a territorial motive

### The defect

`Band.territorialPressure` is written twice, ever: `0.12` at spawn, and
`clamp01(parent * 0.72 + 0.04)` at daughter creation. No lived process writes it. It nevertheless
reached behaviour through **three** readers — `pressure.ts` (× 0.08), `mobilityIntent.ts` (× 0.12)
and `bandDecision.ts` (× 0.14). The brief named two; the inventory found the third, and it is the
one that scores movement intents.

Complete inventory of every occurrence: `authority-matrix.md`.

### Reproduced before it was claimed removed

`cross-tree-territorial-isolation.json`, varying **only** the field across `0 / 0.12 / 0.8`:

| tree | band-measurements moved | what moved |
|---|---|---|
| parent `742b567` | **18 of 18** | `mobilityPressure` 18, candidates 18, `netMovePressure` 15, reason pressures 15, selected score 12 |
| lifecycle-only `e5e3143` | **18 of 18** | unchanged — confirms Part A did not touch this path |
| tip `427d953` | **0 of 18** | nothing |

### The attribution channel is measured, not asserted

The Item 3 brief flagged this reader as possibly unmeasurable. It is measurable; the earlier probe
was reading a field that does not exist (`reason.detail.pressure` instead of `reason.pressure`) and
sampling a world too old to contain a stay reason.

Read correctly, on a 180-day world where bands still stay:

```
parent   band:varied-estuary   low_mobility_pressure   0.1523 → 0.1691 → 0.2643
tip      band:varied-estuary   low_mobility_pressure   0.1523 → 0.1523 → 0.1523
```

Three bands carry an observable attribution figure; **3 of 3 moved on the parent, 0 of 3 on the
tip**. A reason that reports a pressure inflated by a phantom term is a false explanation, and it no
longer does.

### The zero-divergence control — why "0 of 18" is not the whole proof

At a long warm-up the parent and the corrected tree hold **genuinely different worlds**: the term
was live for every one of those 3600 days on the parent, and `netMovePressure` reads accumulated
band state. Measured residual: 2 of 18 band-measurements differ by `0.01` between parent-at-zero and
the tip. That divergence **is** the production change and must not be mistaken for a surviving
reader.

The control removes the confound — warm 0 days, every band's field pinned to `0`, so both trees see
the identical world:

```
parent 742b567    3bb1964817c54fd27a727edbca1254c6
partA  e5e3143    3bb1964817c54fd27a727edbca1254c6
tip    427d953    3bb1964817c54fd27a727edbca1254c6
```

**Identical.** Removing the term is exactly equivalent to holding the field at zero, and no reader
survives.

### Natural occurrence

20 / 50 years, sampled **daily** because the field is stored: 64,800 and 162,000 band-days,
**one distinct value (`0.12`)**, **0 changes outside daughter creation**, and **0 bands** whose
pressure moves when the field is varied across its whole range. At 200 years a single daughter
appears carrying `0.1264` — inherited, and equally inert.

### T1–T12 and C1–C8

**T1–T12: 12 fixtures, 0 failing, 0 vacuous.** `T8` classifies
`SocialPressureProfile.territorialPressure` — a **different** field, `0.08` at spawn against `0.12`
on `Band`, with **zero readers anywhere in the repository**. A second orphan, but an inert one: it
has never reached behaviour, so it is not a blocker. Documented in `types.ts`, not removed.

**C1–C8: 8 fixtures, 0 failing, 0 vacuous.** `C8` confirms Item 4 is untouched.

---

## Boundary — shared catchment

`sharedCatchment.ts` is **unchanged** (`git diff 742b567..HEAD` over it is empty).

Measured, not asserted: the footprint is anchored on `band.residentialAnchor.catchmentTileIds`,
falling back to a bounded ring around `band.position` when no anchor is held. Expedition target work
removes **physical world stock**, so a later group at the same target observes the depletion — the
one genuine shared-use channel reaching past the residential catchment. **Route walking claims
nothing. A task camp claims nothing.**

**This remains an open FUTURE DEPENDENCY.** It predates CORRECTION-35 and survives it. Freezing
Item 3 does not resolve it.

---

## Regression

Full table in `regression-summary.json`. Every audit run with **every** output flag redirected.

`tsc` (both), `build`, graph **221/764 0 dup 0 dangling**, import boundary **85 back-edges
UNCHANGED**, season-order `PASS`, step-mode `PASS` (`fullCanonicalStateMatch true`,
`firstDivergence null`), four-way `ALL_FOUR_STEP_MODES_IDENTICAL`, catchment invariants, food
pipeline `PASS`, mobility authority `PASS`, socialCausality.

Item 3 **I1–I16 16/16, 0 failing, 0 vacuous**; determinism
`ALL_FOUR_MODES_IDENTICAL_WITH_ITEM_3_BEHAVIOUR_PRESENT` and `FRESH_PROCESS_IDENTICAL`; natural
integration **adverseTotal 0** at 20 / 50 / 200 years and on the shared-range seed.

AUDIT-27 11/11 with every accepted verdict reproduced (C5 still
`PHYSICAL_RELEASES_PERCEPTION_DOES_NOT`, as documented). CORRECTION-28 12/12 with **field/scan
parity 0 mismatches**, -29 12/12, -30 15/15, -31 22/22, -32 21/21 + zero controls 6/6 0 violating,
-33 20/20 0 adverse, -34 presence 0 adverse, -34A closure 12 / 0 unexpected, person conservation
9 / 0 unexpected, R1–R12 12/12, L1–L12 12/12, H1–H14 14/14, T1–T14 14/14, Z0–Z12 13/13, numeric
chain `RECONCILED`.

**Performance and bounded state:** 0.807 / 0.796 ms per simulated day at 20 / 50 years,
73.41 → 74.48 MB, every store at or below its production cap, **0 person-conservation failures, 0
duplicate receipts, 0 stale terminal presence entries**.

### Two deviations, stated rather than buried

- **`P8_P18_terminal_records_occupy_nothing` is VACUOUS on both parent and tip.** Inherited from
  CORRECTION-34 and named there too. Not counted as a pass.
- **`P9_concurrent_parties` is VACUOUS at 20 years on the corrected tree and non-vacuous on the
  parent at the same horizon.** Cause: Part B changes movement decisions, so the 20-year window on
  the corrected trajectory happens not to contain a concurrent-party overlap. **Coverage is restored
  at 50 and 100 years** (`CONCURRENT_PARTIES_CONSERVED`, only the inherited P8_P18 vacuous). A
  horizon artefact of a changed world — reported with the parent comparison rather than waved
  through.

### Frozen-evidence incident

Three audits wrote into frozen directories during the rerun because the flag enumeration missed
multi-line `arg(` declarations. **Four files affected, all restored with `git checkout` before any
commit**, `git status` and `git diff` over `docs/evidence/` both empty afterwards, every affected
audit rerun with every flag redirected. **No frozen-evidence commit exists.** Full account, with the
other seven instrument errors found in this checkpoint's own probes, in `PROVENANCE.md`.

---

## Limits — what is NOT claimed

- **No outcome improvement.** Part B changes the world trajectory; nothing here says the resulting
  world is better. Population, survival and fitness were not compared.
- **`0.08`, `0.12` and `0.14` were removed, not re-homed.** No constant was re-tuned and
  `CROWDING_DECISION_COST_WEIGHT` is untouched.
- **No lived territorial writer exists.** Cultural or institutional territoriality is a later
  roadmap item and this checkpoint invented none.
- **Part A's natural frequency is very low** — 0 occurrences at one seed across 200 years, 2 at the
  other. The correction is justified by the contract, not by frequency.
- **`L3` is not constructed** and claims nothing.
- **Direct evidence claims no natural credit** for the sub-threshold interval; the measured
  incident came through reported hearsay.
- **The residence-anchored catchment limitation is open.**
- **Roadmap Item 4 is unstarted.** No dynamic fission, no daughter viability, no successor-group
  selection; `createDaughterBand` is untouched.
- **Item 3 is not declared frozen here.** That decision is the supervisor's.
