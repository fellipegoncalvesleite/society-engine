# Roadmap Item 3 — final findings

**Branch** `checkpoint/shared-range-item-3-final-freeze-36`, from the accepted CORRECTION-35 tip
`706166892d40189fc56ac7458b9e90a8ffdbddd7`.

**AUDIT ONLY — `git diff 7061668..HEAD -- src/` is empty.** No production file, constant or
schema changed.

**Verdict: FINAL FREEZE CANDIDATE. Item 3 is not declared frozen here.**

---

## 1. What Item 3 now does for simulated humans

A band notices that other people are physically near it. If they are near enough for long enough,
the two meet. A meeting it can attribute — a place, a time, an episode — becomes a record it holds.
From the records it holds, and from nothing else, it forms an expectation about a particular place:
*I think using that water will be difficult.* That expectation changes where it moves.

The expectation then **fades**. Not on a cliff and not by forgetting: the evidence weighs less each
season, the expectation weakens in proportion, and when the last record reaches zero the place stops
influencing anything at all — while the records, the contact memories and the encounter records all
**remain**, inspectable. If the other band comes back, the belief is not revived. It is **re-earned**
by a new episode with a new identity.

Everything physical underneath that is conserved. People are where they are, including the party
three days' walk away. The labour that does a day's work at a distant target is the labour standing
at the target. What comes home is what was carried, and it feeds the band only after it arrives.

## 2. Does the full integrated chain work?

Yes, end to end, exercised through the canonical production readers:

```
physical co-presence → crowding → encounter opportunity → attributable friction
→ remembered access expectation → cooling → behavioural release → decision pressure
→ residential extraction → expeditionary presence → productive target work
→ physical cargo and return → historical persistence without current action
```

**I1–I16: 16 fixtures, 0 failing, 0 vacuous, 0 not-constructed.**
Natural: **adverse total 0** at 20, 50 and 200 years, and on the second seed at 200 years.

## 3. Are both previous blockers closed?

**Yes, and both are certified from production's own readers rather than from CORRECTION-35's report.**

**Blocker 1 — `released_historical` could still move behaviour.** Closed.
`A3`: a zero-weight record is retained, counted as history, and moves *exactly* nothing, while the
same construction moves behaviour when fresh — so the inertness is a measured drop, not an empty
patch. Naturally, the Item 3 audit's own released-place check found **197 released places at 200
years on the shared-range seed and 305 on the incident seed, with 0 still moving behaviour**. On the
parent tree that same check found one.

**Blocker 2 — `Band.territorialPressure` was a lived-causality orphan.** Closed.
`B1`: varying the field across `0 / 0.12 / 0.8` changes nothing, across eighteen band-measurements,
on nine quantities including the selected action, its score, the candidate set, deliberation breadth
and every reason's reported pressure. `B2`: the field enters **no arithmetic or conditional
expression anywhere** — its seven surviving sites are four record copies or declarations, two
constant writers and one daughter writer.

## 4. How release now differs from cooling

| | contributes to behaviour | `activeEvidenceCount` | `historicalEvidenceCount` | records kept |
|---|---|---|---|---|
| `active` | yes, at full strength (weight 1) | counts it | — | yes |
| `cooling` | **yes** — non-zero, in proportion to weight | counts it | — | yes |
| `released_historical` | **no — exactly zero** | 0 | counts it | **yes** |
| `none` | no evidence at all | 0 | 0 | — |

The distinction that was missing: a record between `0` and
`SOCIAL_EVIDENCE_ACTIVE_MIN_WEIGHT = 0.05` is **cooling**, not released. It still counts, because it
still moves behaviour. `A5` certifies the separation that makes this work — such a record counts as
active *and* contributes nothing to `confidence`, because the `0.05` threshold keeps its distinct
CORRECTION-31 job: retained records must not prop up the confidence that has to fall before
`staleness` can retire the memory.

## 5. What creates social movement pressure

Exactly three things, each with lived provenance:

1. **`crowdingPenalty`** — another band is physically within the radius now.
2. **`recentRangeFrictionEvents`** — this band witnessed something attributable.
3. **`protoAccessMemory`** — what it expects at a place, from the records it holds.

**Nothing else.** `B3`: with zero social evidence the access channel contributes exactly zero, while
fresh friction and real physical crowding both still fire — so the zero is specific, not a dead band.

## 6. Conservation

| quantity | result |
|---|---|
| people | 0 presence-sum mismatches, 0 ghost body-days, 0 bodies-represented-nowhere, 0 conservation failures over 627,479 band-days |
| productive labour | 0 labour-bound failures, 0 target-work labour mismatches, 0 invalid target-work calls |
| stock | target work removes real world stock; numeric chain `RECONCILED` |
| cargo | `I10` — one chain, units kept distinct |
| support | 0 receipts before return, 0 duplicate receipts, 0 support without source |

## 7. Do histories genuinely diverge?

Yes, and this is why both seeds are reported. Same map, same machinery, 200 years:

| | shared-range seed | incident seed |
|---|---|---|
| encounters | 467 | 244 |
| friction records | 739 | 553 |
| active / cooling / released expectations | 420 / 386 / 197 | 378 / 260 / 305 |
| target-work days | 1,099 | 1,211 |
| fissions | 1 | — |

Neither seed is treated as the answer.

## 8. The six carried-forward seams

Verbatim in `ITEM_3_LIMITATIONS_AND_SEAMS.md` §A, copied from the single carry-forward block in
`docs/HANDOFF.md`. Summarised: the residence-anchored shared-use substrate; activity-party crowding
and expedition overlap; no visibility/route/barrier rule; no physical-trace authority;
`SocialPressureProfile.territorialPressure`; no UI surfacing the lifecycle.

**Freezing Item 3 closes none of them.** None is a blocker.

## 9. What remains absent

Roadmap Item 4 in full. Cultural or institutional territoriality. Activity-range shared use.
Visibility and barriers. Physical traces. Any UI for the lifecycle. The individual/household layer
that would say who *within* a party works. The public Day/Season simplification, still deferred.

## 10. Suspicious results, vacuous and not-constructed fixtures

Reported in separate fields, never folded into a `vacuous: 0`.

- **`L3_exactly_at_threshold` — `NOT_CONSTRUCTED`.** No integer age puts a record exactly on `0.05`
  on either the direct or the reported curve. Reported as not constructed rather than approximated.
- **`P8_P18_terminal_records_occupy_nothing` — VACUOUS, inherited.** Vacuous on the parent tree too;
  named by CORRECTION-34 and named again here rather than counted as a pass.
- **`P9_concurrent_parties` — horizon-dependent, and reported honestly.** Vacuous at 20 years on
  this tree, non-vacuous on the parent at the same horizon, and non-vacuous here at **50 and 100
  years** (`CONCURRENT_PARTIES_CONSERVED`). CORRECTION-35 Part B changes movement decisions, so the
  20-year window on this trajectory happens not to contain an overlap. The 50-year arm is the one
  reported in the manifest.
- **A third territorial name was found by this audit.** `rules/types.ts:1291` declares a
  `Reason<"territorial_pressure">` with **zero producers** anywhere in `src/`. Inert, **not a
  blocker**, recorded so a future system cannot inherit it by accident.
- **One instrument error in this audit's own probes.** `B2`'s first form asked "does the file
  mention `band.territorialPressure` outside a comment?" and flagged `bandDecision.ts:5225` — which
  is the inert `DecisionContextSnapshot` record copy, documented as having no reader. **A false
  UNEXPECTED is as damaging as a false pass**, so the check was rebuilt to distinguish a property
  copy from an arithmetic use and to enumerate every surviving site with its kind.
- **The lifecycle determinism audit reported VACUOUS before it reported a pass.** Its first form
  compared end states, and a place cools, releases and drops out of bounded access memory long
  before a run ends — so the end state read `none` everywhere while the lifecycle had run
  repeatedly. It said so rather than passing. Rebuilt to hash the whole trajectory on the 90-day
  grid, and extended to 200 years so that **release itself** is inside the compared span.

## 11. Natural occurrence

| horizon | seed | band-days | encounters | friction | active/cooling/released | party-days | task-camp | target-work | adverse |
|---|---|---|---|---|---|---|---|---|---|
| 20 y | shared-range | 64,800 | 48 | 43 | 15 / 3 / 0 | 961 | 263 | 86 | **0** |
| 50 y | shared-range | 162,000 | 144 | 117 | 29 / 6 / 0 | 2,784 | 882 | 320 | **0** |
| 200 y | shared-range | 627,479 | 467 | 739 | 420 / 386 / 197 | 8,296 | 2,451 | 1,099 | **0** |
| 200 y | incident | 628,919 | 244 | 553 | 378 / 260 / 305 | 8,765 | — | 1,211 | **0** |

Released places behaviourally checked: **197** and **305**; still moving behaviour: **0** and **0**.
Lifecycle phase/count contradictions: **0** everywhere. Orphan territorial contributions: **0** —
one distinct field value, 0 changes outside daughter creation, 0 bands moved by varying it.
Fissions with active parties: 0. Prepared commitments at fission: 0.

**Every zero at 20 and 50 years for the release checks is a null observation** — those horizons
produce no released places at all. The 200-year arms are where the check bites, and the controlled
fixtures are the proof.

## 12. Performance and bounded state

0.91 / 0.99 / 1.02 ms per simulated day at 20 / 50 / 200 years — **flat**. Every store at or below
its cap at every horizon. Wall clock on a shared machine; **no performance claim against any earlier
checkpoint**.

## 13. Realism

**24 ✅, 5 🟨, 8 ⬜, 0 ❌.** Full table in `ITEM_3_REALISM_CHECKLIST.md`. The five partials are:
crowding never decides an action by itself, `0.96` is an authority rather than a calibrated
magnitude, the release correction is contract-driven rather than frequent, only hearsay reaches the
corrected interval, and **no outcome improvement is claimed anywhere in Item 3**.

## 14. Validation

Everything in the manifest's audit table. **Accepted evidence verified byte-identical by sha256 over
all 607 files, before and after the entire regression.** No temporary overwrite incident occurred.

**Not run:** no 500-year horizon; no `simBenchmark` fingerprint comparison; no population, survival
or fitness comparison against any earlier tree; no third seed; no UI test. `expeditionLifecycleAudit`
was not rerun and nothing here claims it.

## 15. What Browser GPT must decide

Whether Roadmap Item 3 may be frozen at `706166892d40189fc56ac7458b9e90a8ffdbddd7`.

If it is frozen, **the six seams in §8 must be carried forward verbatim**, and the three inert
territorial names must be carried with the rule that none may be re-attached to behaviour without
its own lived writer.
