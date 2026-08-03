# ROADMAP ITEM 3 — FINAL INTEGRATION FINDINGS

**Branch** `checkpoint/shared-range-item-3-final-freeze`, from the accepted CORRECTION-34 tip
`df349eb`. **AUDIT ONLY — `git diff df349eb..HEAD -- src/` is empty.**

**Verdict: PROGRESS.** The integrated system connects, conserves and releases; one measured
contradiction between a production claim and production behaviour prevents an unqualified freeze.
See `ITEM_3_LIMITATIONS.md` §B1.

---

## A1 — the chain closes

The required sequence was exercised end to end on controlled worlds, each stage measured through the
canonical production reader rather than reconstructed:

```text
crowding and shared physical use   → I1, I2, I12
→ encounter opportunity            → I3
→ friction and access expectation  → I3, I4
→ remembered / released state      → I6, I11, I16
→ decision pressure                → I5
→ residential extraction and target use → I8, I9, I10
→ physical expedition presence     → I7, I8, I13
→ productive labour and target work→ I9, I10, I14, I15
→ range release                    → I6, I11, I16
```

**I1–I16: 16 fixtures, 0 failing, 0 vacuous, 0 not-constructed.** Non-vacuity is *asserted* per
fixture — the harness relabels a fixture `VACUOUS:` and fails the run when its predicate is false.

## A2 — the forbidden list, item by item

| Forbidden | Result |
| --- | --- |
| duplicate pressure | **absent** — I5 (zero evidence → zero social pressure); CORRECTION-32 bounds hold (≥3 charges = 0, max paths = 2) |
| hidden global knowledge | **absent** — I2 and I12: 6 and 15 remote records of five kinds leave the focal reading byte-identical |
| ghost bodies | **absent** — 0 ghost band-days in 628,560 |
| teleported bodies | **absent** — I14: aging moves no body (6 bodies before and after, labour 6 → 3) |
| residential labour acting at a distance | **absent** — I8, I10; 0 target-work labour mismatches over 200 y |
| released records acting as current state | **ONE MEASURED CASE — see §B1.** Behaviourally minimal, but real |
| task camps treated as residential movement | **absent** — I7: the party is a presence source at its own tile, the residence is not moved |
| population counted twice | **absent** — 0 presence-sum mismatches in 628,560 band-days |
| invalid labour creating work | **absent** — I15: zero, fractional and non-finite all fail before reading the target |
| target removal becoming support before return | **absent** — I10: receipts unchanged on the work day while the patch moved 0.2198 → 1.0 |
| fission implemented early | **absent** — I13; no Item 4 behaviour exists |

## A3 — the social lifecycle, measured rather than asserted

Two adjacent bands warmed 16 seasons produce 24 encounters, contact count 25 and 8 friction records
naming `crowded_water_place` and `ford_overlap`. Holding the observer at the tile its own records
name, and moving the other band 44 tiles away:

```text
season   1     2     3     4     5     6 …
social   0.24  0.18  0.14  0.09  0.05  0.00   (from 0.31 while co-present)
phase    cooling cooling cooling cooling cooling released_historical
records  8     8     8     8     8     8
crowding 0     0     0     0     0     0
```

Physical release is immediate (season 1); social release completes at season 6; **all 8 records, the
contact memories and the encounter records survive**. Bringing the band back reactivates at season 1
with **1 new event id** — fresh evidence, never a revival of released records.

## A4 — two instrument errors in this audit's own probes, recorded

1. **The lifecycle cluster measured at the wrong place.** The first version captured the observer's
   position when the pair was warmed, then let the observer wander. The place dropped out of its
   bounded access memory and the contribution read 0 from season 1 — "release" proven on a pair that
   had never been active. Four fixtures were VACUOUS and two FAILING as a result. Corrected to
   measure at the tile the observer's **own records name**, with the observer re-pinned there so the
   only things changing are the other band's distance and the evidence's age.
2. **I16 counted records instead of identities.** The friction ring is capped at 8, so a fresh
   episode silently replaces an old one and the count never moves. The first version would have
   reported `REACTIVATED_WITHOUT_NEW_EVIDENCE` purely because 8 stayed 8. Corrected to compare
   `eventId` sets, which shows 1 new episode at reactivation and 8 by the end.

A third correction is recorded in §B1 and was a probe error that initially looked like a defect.

## A5 — natural integrated occurrence

Daily sampling, map2, seed `audit27:natural:s1` (CORRECTION-30's shared-range seed).

| | 20 y | 50 y | 200 y |
| --- | --- | --- | --- |
| band-days | 64,800 | 162,000 | 628,560 |
| living bands at end | 9 | 9 | 9 |
| new encounters | 48 | 144 | 373 |
| new friction records | 43 | 117 | 587 |
| band-seasons with foreign crowding | 63 | 176 | 466 |
| access expectations active / cooling / released | 15 / 3 / 0 | 29 / 6 / 0 | 245 / 192 / **193** |
| active party-days | 961 | 2,790 | 8,626 |
| task-camp days | 263 | 886 | 2,519 |
| target-work days | 86 | 321 | 1,108 |
| non-working away person-days | 0 | 0 | 0 |
| **adverse total** | **0** | **0** | **0** |

Every adverse counter — conservation, labour bound, presence sums, ghosts, bodies nowhere,
target-work labour, invalid labour, negative catchment effort, receipts before return, duplicate
receipts, support without source, released acting as current — reads **0** at all three horizons on
this seed.

**Every zero above is a null observation, not a proof.** The controlled fixtures are the proof.

**A second seed is reported because it disagrees.** `audit27:natural:map2:s1` — the seed the
CORRECTION-34 family used — produces rich expedition activity and **zero** encounters and friction
across 200 years. Two seeds on the same map generate entirely different social worlds from identical
machinery, which is the divergent-history property Item 3 wanted; it is also why the canonical
natural arm uses the shared-range seed rather than the expedition one. The single §B1 incident was
found on that second seed, at 200 years.

## A6 — determinism and time modes

Two arms, because a four-way identity over a span containing none of the behaviour under audit is an
identity claim about nothing.

| Arm | Span | All four modes | Daily repeat | Fresh process | Occurrence in the compared run |
| --- | --- | --- | --- | --- | --- |
| expedition seed | 2,520 d | identical | identical | identical | 6 exploitation outcomes, 2 delivering harvest |
| shared-range seed | 5,040 d | identical | identical | identical | 26 exploitation outcomes, 3 active parties, **16 friction records, 48 encounters** |

The compared canonical projection includes every expedition's phase, productive workers,
non-working members, position and work days; the outcome ring with delivered harvest and party
people; the friction ring by event id, interpretation and tension; encounter counts and
contact-memory identities. Fresh-process determinism is a genuinely separate OS process.

The public Day/Season simplification remains **deferred** and was not implemented.

## A7 — frozen regressions

**222 fixtures across 17 accepted suites, 0 failing.** Every output flag was enumerated from each
script's own argument parser and redirected; no default path was trusted. Compared against the
CORRECTION-34F run of the same scripts with identical arguments: **21 of 21 comparable outputs
byte-identical** modulo `generatedAt`. No frozen evidence file changed.

One inherited vacuous fixture is carried forward and named rather than counted as a pass:
CORRECTION-34's `P8_P18_terminal_records_occupy_nothing`.

## A8 — performance and bounded state

Per-simulated-day cost is **flat** from 20 to 200 years (0.90 → 0.92 ms in the integrated probe;
0.80 ms in the checkpoint performance audit). Serialized state grows 73.38 → 74.34 MB between the 20
and 50 year horizons. Every Item 3 store sits at or below its production cap across 200 years:
presence sources 3, active parties 2, trip records 24, outcome records 6, friction records 8, access
places 8, crowding contributors on one tile 2.

## §B1 — the blocker

A place production labels `released_historical` can still move behaviour by up to 0.02. Full
statement, measurement, artefact tests and the smallest correction are in `ITEM_3_LIMITATIONS.md`
§B1 and `released-place-probe.json`.

In one line: **the label leads its own quantity.** `released_historical` fires when every record is
below the 0.05 activity threshold, while contributions scale continuously by weight and reach zero
only at the horizon — so a record at weight 0.04 is counted in `historicalEvidenceCount`, which
`types.ts:2522` says holds records that "no longer move anything", and still moves 0.01 on two
scalars.

The smallest correction is to a **derived read-model field**: label `released_historical` only at
weight exactly 0. The contribution curve is already correct, so nothing behavioural changes.
