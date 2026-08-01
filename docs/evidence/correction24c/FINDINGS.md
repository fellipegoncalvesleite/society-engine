# CORRECTION-24C — actual production reader events and long-horizon closure

CORRECTION-24C remains a diagnostic checkpoint. It changes no authorized
production behavior, begins no later roadmap system, and leaves CORRECTION-23
frozen at `59391d54f6553f7cd05170ce7889b4bd72a43055`. Repository and detached-
worktree authority is recorded in `PROVENANCE.md`; the exact temporary call-site
instrument is described in `AUTHORITY_LEDGER.md`.

## The 52/53 interpretation is withdrawn

The prior statements that 52 records were genuinely unread and 53 records were
actually read but inert are **withdrawn**. Their classifier treated a known-tile
count change at the writer as evidence of a reader. That proves only stored-state
divergence.

The superseding categories are:

```text
WRITE_SUPPRESSION_NO_TRACKED_CONSEQUENCE
WRITE_CHANGED_STORED_STATE_ONLY
```

until a real production call site consults the exact returned record. Historical
evidence is preserved; only its interpretation is superseded.

## Production authority and exact identities

The temporary ledger assigns a non-persisted `recordEventId` at the real
frontier-return writer. The counterfactual suppresses exactly one
`(expeditionId, tileId, returnDay)` tuple. It does not delete a later snapshot
and does not strip verification evidence, corridors, crossing memory, place
memory, resource memory, or inferred facts.

A read is recorded only while the normal production function dereferences the
exact canonical tile record. The audit runner never schedules a reader. The
observed families are:

| family | production authority |
| --- | --- |
| `movement_destination` | carrying capacity, known-tile statistics, range saturation, frontier dispersal, nearby opportunity |
| `camp_movement` | real camp-movement decision support |
| `resource_activity` | real same-day trip selection, starting reconnaissance, resource inference |
| `daughter_fission` | real fission-target selection |

`route_corridor` is a structural no-reader: residential corridors are produced
from executed residential movement, not from an exploration-returned record.

Selected decisions and materialized physical events are separate ledgers.
Movement requires a production decision and, for physical classification, a
real movement record. Camp movement requires a real local-shift or temporary-
camp record. Resource activity requires an executed task/trip and physical
outcome. Fission requires actual daughter creation. Candidate or influence
arrays are never actions.

## Corrected 40-year replay

The historical deterministic sample was rerun over eleven worlds and five
shared ordering seeds. All 110 rows reproduce their control exactly.

| terminal class | rows |
| --- | ---: |
| `WRITE_SUPPRESSION_NO_TRACKED_CONSEQUENCE` | 0 |
| `WRITE_CHANGED_STORED_STATE_ONLY` | 0 |
| `ACTUAL_READER_CONSULTED_SAME_OUTPUT` | 22 |
| `ACTUAL_READER_OUTPUT_CHANGED` | 70 |
| `SELECTED_ACTION_CHANGED` | 0 |
| `PHYSICAL_ACTION_CHANGED` | 10 |
| `RECEIPT_OR_SUPPORT_CHANGED` | 8 |
| `DEMOGRAPHY_CHANGED` | 0 |
| `CONTROL_REPLAY_UNSOUND` | 0 |

Cumulatively, all 110 sampled records were consulted by a real production
reader; 88 changed reader output, 18 changed a selected action, 18 changed a
materialized physical action, and 8 changed receipts/support. More-consequential
terminal classes explain why selected-action terminal rows are zero.

Action-family rows can overlap when one writer fork changes more than one later
event:

| exact action family | selected rows | materialized physical rows |
| --- | ---: | ---: |
| movement | 3 | 3 |
| camp | 3 | 3 |
| resource | 18 | 18 |
| fission | 0 | 0 |

Thus the corrected natural sample contains no stored-state-only or genuinely
unread row, but that is a sample result rather than a claim that such writes are
impossible. The non-vacuous controlled fixture separately proves the unread
classification.

## Corrected long-horizon replay

The same corrected classifier was run at 200 and 500 years. Every admitted row
reproduces its control exactly.

| | 40 y | 200 y | 500 y |
| --- | ---: | ---: | ---: |
| worlds × seeds | 11 × 5 | 11 × 5 | 2 × 5 |
| replay events | 110 | 456 | 120 |
| control SOUND | 110 | 456 | 120 |
| control UNSOUND | 0 | 0 | 0 |
| `WRITE_SUPPRESSION_NO_TRACKED_CONSEQUENCE` | 0 | 0 | 0 |
| `WRITE_CHANGED_STORED_STATE_ONLY` | 0 | 0 | 0 |
| `ACTUAL_READER_CONSULTED_SAME_OUTPUT` | 22 | 219 | 50 |
| `ACTUAL_READER_OUTPUT_CHANGED` | 70 | 197 | 66 |
| `SELECTED_ACTION_CHANGED` | 0 | 0 | 0 |
| `PHYSICAL_ACTION_CHANGED` | 10 | 15 | 0 |
| `RECEIPT_OR_SUPPORT_CHANGED` | 8 | 25 | 4 |
| `DEMOGRAPHY_CHANGED` | 0 | 0 | 0 |

Across all three horizons **686 replay events are admitted and 686 are sound**.
Every one of them reached an actual production reader. Cumulatively the 200-year
matrix changed 237 reader outputs, 40 selected actions, 40 materialized physical
actions and 25 receipt/support results; the 500-year matrix changed 70, 4, 4 and 4.
**No horizon produced a single `DEMOGRAPHY_CHANGED` row.** A suppressed
exploration write is repeatedly consequential for a physical task and never once
consequential for births or deaths.

### The fission reader is naturally almost absent

The deterministic sample asks each bin for the first write consulted by each
reader family. The 200-year matrix reports **213 missing samples**, and they are
not evenly spread:

| missing sample slot | count |
| --- | ---: |
| `first_consulted_daughter_fission` | 137 |
| `first_new_write` | 20 |
| `first_consulted_camp_movement` | 14 |
| `first_consulted_movement_destination` | 14 |
| `first_consulted_resource_activity` | 14 |
| `first_refresh` | 14 |

Of 165 world/seed/bin combinations, 137 have no fission reader to sample at all.
The first reader across all 456 rows is only `movement_destination` (232) or
`camp_movement` (224); at 500 years exactly **one** row is first-read by
`daughter_fission`. This is reported as a measured scarcity, not as a structural
no-reader: `selectFissionTarget` demonstrably does consult an exploration-returned
record when one is available, which is what fixture B6 exercises. The 500-year
matrix has no missing samples.

## Receipt/support chains

All five required committed cases have a named physical cause and a complete
writer → reader → action → physical event → receipt → support chain. The
corrected replay also found three additional natural receipt divergences, which
are retained separately.

| required case | first reader | exact physical cause |
| --- | --- | --- |
| `site_D_aquatic s2` | camp movement | different executed resource trip |
| `site_D_aquatic s4` | movement destination | different executed resource trip |
| `site_E_hills s1` | movement destination | changed local residential/camp action |
| `site_E_hills s3` | movement destination | changed local residential/camp action |
| `site_E_hills s4` | movement destination | changed local residential/camp action |

The two site-D cases materialize a plant-gathering action at day 552: control
receipts are `0.0326` versus counterfactual `0.0084`, while bounded support is
`0.8` in both arms. In the three site-E cases the first reader occurs at day
180, the residential/camp action diverges at day 630, and the downstream day-636
receipt is control `0.0099` versus counterfactual `0.0189`; bounded support is
`0.09` in both arms. A receipt divergence is still reported even when the
bounded support projection is unchanged.

## B1–B12 controlled fixtures

The controlled fixtures exist to prove the diagnostic can see each outcome, not
to describe how often each outcome happens naturally.

```text
12 PASS / 0 FAIL / 0 VACUOUS
```

| id | contract | source |
| --- | --- | --- |
| B1 | genuinely unread writer-day record | 0 reader events on the writer day; terminal `WRITE_SUPPRESSION_NO_TRACKED_CONSEQUENCE` |
| B2 | actual reader consults the record and stays inert | `site_B_dry_plains s3` |
| B3 | changes an executed residential movement | `site_E_hills s1` |
| B4 | changes an executed camp action | `site_E_hills s1` |
| B5 | changes an executed resource activity | `site_A_coast s1` |
| B6 | changes an executed daughter foundation | bounded physically legal fission fixture |
| B7 | independent verification evidence preserved | production |
| B8 | pre-fork residential corridor preserved | production |
| B9 | later corridor difference follows natural movement | `site_E_hills s1` |
| B10 | suppressing a refresh preserves the pre-return record | `map1 s1` |
| B11 | lost party writes no event and no identity | 0 writer events, no identity created |
| B12 | every admitted control replay is sound | 686 events, 0 unsound |

B1 matters most. The natural matrices contain **no** stored-state-only and **no**
genuinely unread row at any horizon, so without B1 the unread classification would
be an untested branch. B1 constructs one and the classifier reports it correctly.

B6 is a constructed world rather than a natural sample, because natural fission
reads are as scarce as the missing-sample table shows. It is not vacuous: a real
`selectFissionTarget` call consults the refreshed record at day 360, returns
`fission_target:tile:119:116:0.9700`, and a daughter is actually created with a
different foundation target. A candidate ranking alone would not have passed.

## O2 500-year matrix

The 500-year O0/O2 comparison was run from the detached clean worktree at
`9e317647`, eleven worlds by five shared ordering seeds.

```text
55 paired runs
+6 positive / -13 negative / 36 tied
median  0
mean   -2.564
paired bootstrap 95% [-6.055, +0.055], 10,000 iterations — CROSSES ZERO
```

All eleven required metric families were captured. Reading them together is what
makes the result interpretable:

| metric | control mean | treated mean | paired difference |
| --- | ---: | ---: | ---: |
| survived | 0.618 | 0.600 | -0.018 |
| population | 52.109 | 49.545 | -2.564 |
| births | 489.78 | 466.82 | -22.96 |
| deaths | 494.67 | 474.13 | -20.55 |
| worker-days away | 3,818.7 | 3,839.9 | **+21.13** |
| provisions loaded | 11.168 | 11.181 | +0.013 |
| provisions consumed | 3.520 | 3.538 | +0.018 |
| receipts | 898.15 | 850.96 | -47.19 |
| support | 0.7516 | 0.7313 | -0.0203 |
| launches | 281.44 | 279.69 | -1.75 |
| returned records | 4,634.8 | 4,588.4 | -46.42 |

The treated arm spends **more** worker-days away and brings home **fewer**
returned records and fewer receipts. That is the cost side of the fallthrough
repair showing up directly.

### The effect is concentrated, not global

| world | pos/neg/tied | summed population difference |
| --- | --- | ---: |
| map1 | 2/3/0 | **-104** |
| map2 | 1/4/0 | **-24** |
| site_B_dry_plains | 1/3/1 | -11 |
| site_C_dry_plains | 0/1/4 | -1 |
| site_D_aquatic | 0/1/4 | -1 |
| isolated_marginal | 1/1/3 | -1 |
| site_E_hills | 1/0/4 | +1 |
| site_A_coast | 0/0/5 | 0 |
| site_F_hills | 0/0/5 | 0 |
| ordinary | 0/0/5 | 0 |
| hostile | 0/0/5 | 0 |

**-128 of the -141 total sits in the two default maps**, and they are the only two
worlds with no tied run at all. Four worlds are perfectly tied across every seed.
The 200-year concentration therefore reproduces at 500 years rather than washing
out, and the bootstrap interval still crosses zero. The honest reading is that O2
is interaction-dependent: it is inert on most terrain and costly on the default
maps, and neither "irrelevant" nor "globally harmful" describes it.

## O2 three-run mediation

The three 200-year outliers were traced from their first causal divergence
through the required chain. All three complete it, and all three share the same
mechanism.

| run | population difference | fallthrough | exploration | labor | local work | receipts | births/deaths | population |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| map1 s2 | -44 | 1350 | 1350 | 1350 | 1452 | 1452 | 6120 | 6120 |
| map1 s4 | -41 | 1350 | 1350 | 1350 | 6399 | 6399 | 9360 | 9360 |
| map2 s2 | -37 | 1260 | 1260 | 1260 | 1359 | 1359 | 4320 | 4320 |

```text
sharedMechanism: true
```

Every chain begins at the fallthrough repair itself, and the exploration, labor
and provision differences appear on that same day. In `map1 s2` the control holds
a physically valid proposal that is offered and not claimed, while the treated arm
raises an additional party and immediately commits 2 worker-days that the control
never spends. The local work task diverges 102 days later — the control records
`target_not_found` where the treated arm does not — and receipts follow at the
same seam. Demography moves only thousands of days afterwards.

So the three runs are not three coincidences. They are one mechanism —
*additional exploration bought with labor that the local work task then lacks* —
firing on the terrain where exploration is already cheap enough to be offered
often.

## Anti-omniscience and hidden truth

The production reader ledger receives only the band-known record already being
dereferenced. Static anti-omniscience checks are clean; runtime C1–C5 and D are
all zero across 67 plans and 747 breadcrumb steps.

The dedicated hidden-truth perturbation changes the physical tile while holding
the band-known record byte-identical. Two actual production reader events occur,
yet reader outputs and all action streams remain identical. The result is
`PASS`: hidden world truth does not enter the reader result.

## O3 physical-stream parity

The O3 comparison is no longer a coarse journey summary. All 55 shared
world/seed runs match exactly through the first return seam on expedition ID,
band, party workers and composition, departure, every traversed tile and step,
daily position, risk-episode IDs, provisions loaded and consumed, forced return,
return day, loss, terminal outcome, and terminal position.

```text
55/55 exact physical-stream parity
0 mismatch
```

O3 is therefore a pure knowledge-withheld arm for the measured first journey;
its comparison is not withdrawn.

## Production-repair status

No cooldown, scheduler, fallthrough, route-failure memory, expedition capacity,
labor, provision, retention, verification, population, ecology, or reader
behavior is changed here. The writer fork and action identities are diagnostic
seams only and are removed by the cleanup commit.

## Verdict

```text
PROGRESS — EXPLORATION VALUE OR COST IS WORLD-DEPENDENT /
NO GLOBAL REPAIR JUSTIFIED /
HUMAN DESIGN DISCUSSION REQUIRED
```

Two findings decide this together, and neither alone would.

**A returned exploration observation does cause replicated physical action.** All
686 admitted replay events reached an actual production reader; 40 selected
actions and 40 materialized physical actions changed at 200 years, 18 and 18 at
40 years, across movement, camp and resource families in eleven worlds and five
seeds. That is replication, not a single-world artifact, and it is measured at
real production call sites rather than by re-invoking a reader from an audit
schedule. The CORRECTION-24B reading — that roughly half these writes were
never read — is withdrawn; it was an instrument artifact.

**But no replicated physical benefit justifies a repair.** The 500-year O2
matrix crosses zero, is tied in 36 of 55 runs, is perfectly tied in four entire
worlds, and concentrates -128 of its -141 population difference in the two
default maps. Where it does bite, the mediation shows the cost side plainly: more
worker-days away, fewer returned records, fewer receipts. Repairing the
fallthrough globally would spend labor on most terrain to buy nothing and on the
default maps to lose population.

The correct terminal class is therefore the interaction-dependent one. Exploration
observation is causally live; the throttling and fallthrough are real; and the
value of relieving them is a property of the world, not of the mechanism. No
production repair is made, and the choice of whether to pursue a world-conditional
seam is left to human design discussion.
