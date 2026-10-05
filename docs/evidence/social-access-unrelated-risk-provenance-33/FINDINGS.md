# CORRECTION-33 — FINDINGS

**SHARED RANGE — GLOBAL BAND-COUNT SOCIAL OMNISCIENCE**

Branch `checkpoint/social-access-unrelated-risk-provenance-33` from the accepted and frozen
CORRECTION-32 tip `d11854153e76c2435bce9d53ffde49317e5e8f90`.
`main` untouched at `0a43083a3a9103bc6b8f693b8823a604ae2c6a8d`.
**PRODUCTION BEHAVIOUR CHANGED** — no fingerprint parity is claimed or possible.
**ROADMAP ITEM 3 REMAINS OPEN.**

---

## 1. What the band was being told

```ts
const unrelatedRisk =
  Object.values(world.bands).length > 8 && knownContactCount === 0 ? 0.08 : 0;
```

"The simulator is holding more than eight band records, and you have no known contacts, therefore
be more cautious about **this water place**."

The band cannot know any part of that. Not how many groups exist, not where they are, not whether
they are alive — `world.bands` retains extinct, absorbed and dispersed records — and not whether
any of them has ever been near this water. It is not a belief; it is the simulator's population
leaking through a gap in the band's knowledge.

It was also an **inversion**. Having no known contacts is evidence of **isolation** at least as
much as of a dangerous surround. The code read "I have met nobody" as "therefore unknown others
are near".

## 2. The defect was decision-facing, and it was not a rare edge case

Measured with the observer's own band object held **byte-identical** and only the number of
records in `world.bands` varied:

| records | socialAccessRisk | fallbackRank | max candidate socialAccessRisk |
| --- | --- | --- | --- |
| 8 — before | 0.29 | 11 | 0.29 |
| 9 — before | **0.37** | **12** | **0.37** |
| 8 — after | 0.29 | 11 | 0.29 |
| 9 — after | **0.29** | **11** | **0.29** |

It reached movement through `getFallbackRank` (×1.8), water-source ordering (×0.18), the seasonal
mode (×0.14), the river prospect (×0.16 / ×0.08), the stay/move/scout comparison,
`scoreDecision` (−0.36), `getBadSiteStuckResidencePenalty` (×0.08) and the prospect candidate's
`socialCost` (−0.70).

**Naturally, over 2,240 band-seasons at 20 years, the condition fired 1,310 times (58.5%) — every
single one of them with zero social evidence of any kind**, across 18 bands. At 50 years:
3,230 of 5,600. The default map2 world holds a **constant 9 band records** for 80 seasons, so the
term was not an occasional threshold event; it was permanently armed for every uninformed band.

`firesSustainedOnlyByTerminalRecords` is **0** in both arms — in these worlds the living count was
above 8 too. The terminal-record path is real (P3 proves dead records counted exactly like live
ones) but has a **natural occurrence of zero here**, and no natural credit is claimed for it.

## 3. The causal model selected

Option **A — remove the term, and remove the `world` parameter with it.** Generic uncertainty
about an unverified place is already the base `0.28`; a second unexplained baseline would be the
same constant under a new name. Deriving "many groups exist out there" from encounters, reports or
visiting networks is **regional social awareness** — a real human mechanism, explicitly out of
scope, and needing named groups, travel, exchange and inherited information that this repository
does not have. Deriving it from tracks, camps or smoke is impossible: CORRECTION-30 established
there is no physical-trace authority anywhere in production.

`getSocialAccessRisk` was the only reader of `world.bands` in `dryMargin.ts`, so dropping the
parameter makes the invariant **structural** rather than merely tested.

## 4. What remains, and is proven to remain

| Preserved behaviour | Fixture | Result |
| --- | --- | --- |
| active place evidence still raises risk | P6 | `ACTIVE_EVIDENCE_STILL_RAISES_RISK` |
| released history stays behaviourally inactive, records retained | P7 | `RELEASED_HISTORY_RETAINED` |
| an old contact manufactures no place danger | P8 | `OLD_CONTACT_CREATES_NO_PLACE_DANGER` |
| evidence moves risk at constant population | P10 | `EVIDENCE_MOVES_RISK_AT_CONSTANT_POPULATION` |
| active evidence still reaches the candidate score | P16 | `ACTIVE_EVIDENCE_REACHES_THE_SCORE` |

P6/P7/P8/P10 are isolated as **active-vs-released at the same tile with the contact memory
retained in both arms**, so `knownContactRelief` is identical and cancels exactly. Two earlier
isolation attempts failed and are recorded in §7 rather than hidden.

## 5. Fixture results, both arms

**20 fixtures, 0 vacuous, 1 NOT_CONSTRUCTED (P9), 0 adverse on the after arm; 11 adverse on the
before arm.**

| Fixture | before | after |
| --- | --- | --- |
| P1 eight vs nine remote bands | `THRESHOLD_CHANGES_OBSERVER_STATE` | **`THRESHOLD_HAS_NO_EFFECT`** |
| P2 one vs many remote bands | `REMOTE_POPULATION_CHANGES_OBSERVER_STATE` | **`REMOTE_POPULATION_HAS_NO_EFFECT`** |
| P3 active vs terminal hidden bands | `TERMINAL_OR_ACTIVE_RECORDS_AFFECT_OBSERVER` | **`TERMINAL_AND_ACTIVE_RECORDS_BOTH_INERT`** |
| P4 remote fission | `REMOTE_FISSION_CHANGES_OBSERVER` | **`REMOTE_FISSION_INERT`** |
| P5 remote spawn | `REMOTE_SPAWN_CHANGES_OBSERVER` | **`REMOTE_SPAWN_INERT`** |
| P12 water-refuge ranking | `WATER_REFUGE_RANKING_AFFECTED` | **`WATER_REFUGE_RANKING_UNAFFECTED`** |
| P13 river prospect | `RIVER_PROSPECT_AFFECTED` | **`RIVER_PROSPECT_UNAFFECTED`** |
| P14 stay/move/scout | `STAY_MOVE_SCOUT_AFFECTED` | **`STAY_MOVE_SCOUT_UNAFFECTED`** |
| P15 candidate score | `CANDIDATE_SCORES_DIFFER_ACROSS_THRESHOLD` | **`CANDIDATE_SCORES_IDENTICAL_ACROSS_THRESHOLD`** |
| P17 no global-count reader | `GLOBAL_COUNT_READER_REMAINS` | **`NO_GLOBAL_COUNT_READER`** |
| P20 long horizon | `DISCONTINUITY_AT_THRESHOLD` | **`NO_DISCONTINUITY_AT_THRESHOLD`** |
| P6, P7, P8, P10, P11, P16, P18, P19 | pass | pass — **unchanged in both arms, preservation evidence, not repair credit** |
| P9 report-supported caution | `NOT_CONSTRUCTED` | `NOT_CONSTRUCTED` |

## 6. What changed naturally

| | map1:s1 | map1:s2 | map2:s1 | map2:s2 |
| --- | --- | --- | --- | --- |
| old condition fires (20y) | **0** | **0** | 720 | 590 |
| mean socialAccessRisk before → after | 0.2988 → 0.2988 | 0.2989 → 0.2989 | **0.3855 → 0.3059** | **0.3446 → 0.2853** |
| population 20y | 157 → 157 | 152 → 152 | 226 → 227 | 227 → 223 |
| residential moves 20y | 265 → 265 | 224 → 224 | 450 → 444 | 401 → 369 |

**map1 never held more than eight band records, so the term never armed and both seeds are
identical on every measured key.** map2 armed it constantly, and the mean risk falls by
approximately the removed constant. At 50 years the same split holds (map1 identical; map2
population 209→205 and 216→204, moves 720→692 and 676→617).

Every divergence is classified `hidden_global_count_influence_removed_with_secondary_behavioural_consequence`;
**`unexplainedDivergences: 0`**. **No outcome improvement is claimed** — populations move in both
directions and the point is truthfulness, not survival.

## 7. Instrument errors caught in this pass, recorded not hidden

1. **The first isolation cloned the observer to manufacture remote records**, and every clone
   inherited the observer's catchment, so `getOverlappingBandIds` listed all of them. The
   fixture's own physical controls caught it. Replaced by building one world with every remote
   band, warming it once, and taking **subsets** — so each remote band is genuinely warmed in place
   and the observer is byte-identical across arms by construction.
2. **The first preservation control compared tile X against its neighbour Y**, but Y sits inside
   the contact radius and acquired access memory of its own, so a live evidence path measured as
   inert (rise 0.05 → 0.05). A distant reference tile then failed differently — it was not known to
   the observer in the earlier phase, giving a null reading and a fabricated rise of 0.33.
   Both were rejected; the accepted control is active-vs-released at the same tile.
3. **P4/P5 initially compared counts that did not straddle 8**, so they read inert on the before
   arm for the wrong reason. Corrected to 8 → 9.
4. **P12 was initially vacuous** (`VACUOUS_NO_WATER_CANDIDATES`) because the searched origin had no
   water the band actually knew; the origin search now requires water within 2 tiles.

## 8. Limits and unresolved items

- **P9 (report-supported caution) was NOT CONSTRUCTED.** Two bands in isolated proximity produce
  direct observation, not hearsay; a report needs a third relaying band, and inventing a report
  topic to preserve a coefficient is forbidden. CORRECTION-31's frozen evidence already proves the
  report lifecycle (`P12 = SECONDHAND_AND_FADES`), rerun unchanged here. **Not a pass.**
- **`depletionSum` read 0 on both arms** — the field path this audit used does not resolve. It is
  reported as **NOT MEASURED**, not as zero.
- The terminal-record path has a **natural occurrence of zero** in these worlds; it is proven by
  fixture P3 only.
- The natural runs use 4 runs × 2 maps × 2 seeds at 20 and 50 years. **No 200-year matrix, no
  performance measurement.**
- Several `Object.values(world.bands)` reads remain in `demography.ts`, `viability.ts`, `spawn.ts`
  and the ecology modules. Each was inspected and none is a band belief, but **a full
  anti-omniscience sweep of those modules is not claimed** — see the authority ledger.

## 9. Adjacent findings, recorded and deliberately NOT fixed

- `Object.keys(band.contactMemories).length + band.knowledge.knownBands.length` can **count one
  known band twice**, making known-contact relief up to twice as strong for such bands.
  CORRECTION-33 does not depend on it — the term is identical in both arms and cancels in every
  comparison.
- The meaning and calibration of the base caution `0.28` is undocumented; it is inspected and
  unchanged.
- Whether known-contact relief should saturate differently than `clamp01(n * 0.08)`.
- Report-only access-evidence coverage.
- A future generalized **regional social awareness** architecture (the honest home for "many groups
  exist in this region").
- Cultural stranger attitudes; physical unidentified traces; `territorialPressure`'s missing
  writer; activity-party and expedition physical overlap.

## 10. Validation

PASSED: `tsc` (both projects), `npm run build`, graph 221/764 0 dup 0 dangling, import boundary
(back edges 85, unchanged), season-order invariance, step-mode invariance with
`fullCanonicalStateMatch: true` and `firstDivergence: null`, catchment invariants, living-ecology
food pipeline, mobility authority, `socialCausalityAudit`.

Prior checkpoint regressions rerun with **every** output path redirected outside the repository:
AUDIT-27 11/11, CORRECTION-28 12/12, -29 12/12, -30 15/15, -31 22/22, CORRECTION-32 corrected
attribution (9/9 self-consistency) and zero controls (6/6, 0 violating), CORRECTION-32A
social-access lifecycle. Frozen evidence directories verified byte-clean.
