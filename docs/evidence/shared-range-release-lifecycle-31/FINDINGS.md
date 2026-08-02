# CORRECTION-31 — FINDINGS

**SHARED RANGE — RANGE-FRICTION AND ACCESS-EXPECTATION LIFECYCLE**

Branch `checkpoint/shared-range-release-lifecycle-31`, from the accepted and frozen
CORRECTION-30 tip `1c6a3ed8d0a8360c8fe4648a83387a2bd4fa30b4`.
`main` untouched at `0a43083a3a9103bc6b8f693b8823a604ae2c6a8d`.

**Verdict: PASS.** Roadmap item 3 remains **OPEN**.

---

## 1. What happened before

A band could correctly see another group using an important place. The group then left, and
physically everything released at once — no crowding, no shared catchment, depletion
recovering. Socially, **nothing released at all**.

Three separate defects, all verified in the tree at `1c6a3ed8`:

**(a) Friction evidence had no age, only a cliff.** Every one of the six functions that turn a
friction record into pressure — `eventPressure`, `strongestFrictionRelation`,
`tensionFromFriction`, `cooperationFromFriction`, `avoidanceFromFriction`,
`bestContactTolerance` — read **only fields stamped at the episode's creation**. Not one read
`event.tick`. The single age test in the whole chain was the binary
`age <= FRICTION_RECENT_WINDOW_TICKS` at `accessNorms.ts:429`. A 47-tick-old record pushed
exactly as hard as a fresh one; at 49 it vanished. **Twelve simulated years at full strength,
then a cliff.**

**(b) The evidence defended itself.** `staleness` can only produce `stale_access_memory` when
`confidence < 0.36`, but `confidence` counted `friction.length` — so the retained records
propped up the very confidence that would have retired them. Combined with `placeImportance`
rising as the observer went on using its own place, `rememberedRefusalAvoidance >= 0.46` could
be crossed *after* the other band left. That is AUDIT-27's C5, reproduced fresh on this tip
before any change (`baseline/audit27-fixtures-baseline.json`).

**(c) Report-linked friction never aged at all.** `deriveReportLinkedEvents` stamped every
record with `world.time.tick` — the *current* tick, every tick — and `makeEventId` embedded the
tick, so each pass minted a **new** record rather than refreshing one. A report-linked record
was permanently age 0: neither the 48-tick ring eviction nor the 48-tick access window could
ever reach it. One report kept a friction record alive for as long as the report lived —
`REPORT_MAX_AGE_TICKS = 160`, **forty simulated years** — at constant strength, with the
report's own decaying `freshness` never consulted. Verified directly: a ring holding two
records naming a band **40 tiles away**, both `reported_secondhand`, both stamped at the
current tick while the reports arrived five and ten ticks earlier.

And the loop behind it: `reportedKnowledge.ts:648` republished a band's friction as
`outsider_use_warning`, a neighbour's `deriveReportLinkedEvents` turned that back into friction,
which was republished again. `rangeFriction.ts:250` blocked only a band's **own** reports.

## 2. Why it was unrealistic

A belief about who is using a place is a standing bet on the last thing you saw, revised when
you next go there. It should weaken when nothing renews it, weaken faster when you stand there
and find nobody, and stop governing where you camp long before you forget it happened. What the
simulator had instead was a memory that learned nothing after the first day, could grow more
hostile while the subject was absent, and — through rumour — could outlive every witness.

## 3. The lifecycle selected

**Option A (provenance-specific age weighting) + Option C (active separated from historical) +
a bounded Option D (one contradiction channel).** Full comparison in `ARCHITECTURE_DECISION.md`;
the model itself in `LIFECYCLE_MODEL.md`.

The decisive repository fact: **`ProtoAccessMemory` stores nothing** — it is recomputed from
scratch every tick. A lifecycle therefore needs no new store, and "historical" already exists:
it is the retained record that no longer carries weight.

- **Option B (a stored pair/place state machine) rejected** — it would be a fifth home for facts
  four authorities already hold, it is quadratic in pair × place where §10.15 forbids an
  unbounded ledger, and "cooling" is an analyst's description, not something a band knows.
- **Option E (a shorter fixed expiry) rejected** — it moves the cliff rather than modelling a
  lifecycle. **No constant in `authority-ledger.md` §6 was changed.**
- **Of Option D's three candidates, two were rejected as unrepresentable**: `observed_departure`
  needs positional history that does not exist, and `credible_move_report` needs a report topic
  that does not exist and would mean inventing knowledge of where they went. Fixture **P5 is
  deliberately not constructed** and records why.

## 4. How creation, reinforcement, cooling, release and reactivation now work

| phase | mechanism |
| --- | --- |
| **creation** | unchanged — proximity observation (`tick: now`) or a received report (**`tick: report.tickReceived`**, new) |
| **reinforcement** | a fresh sighting is a new record at age 0; a report from a *different* original observer is independent; further relayed copies of one episode are **one record** |
| **saturation** | `recentOverlapCount` ≤ 1 + the 8-slot ring = **9**, and both the one-season and ten-season contact arms reach it (P2) |
| **cooling** | full inside the current annual round (3 ticks), then a straight decline to zero at 8 ticks (kin/tolerated), 12 (neutral), 16 (tense), 16 × 0.7 × hop × report-freshness (hearsay) |
| **contradiction** | standing at the place with `nearbyBandPressure === 0` makes every episode there count 2 ticks older per season, capped at 8 seasons |
| **release** | below weight 0.05 an episode contributes nothing to any access scalar, nothing to `ProtoAccessBehaviorEffectState`, and is no longer broadcast |
| **reactivation** | no special case: fresh evidence is age 0, therefore weight 1 |

**Horizons are justified, not picked:** one year fresh (Mauss, seasonal round); kin/tolerated
shortest (Peterson — access is normally granted, so the residue is recognition not caution);
tense longest but bounded; hearsay weaker per unit but stickier (Lewandowsky/Ecker on continued
influence).

## 5. What the band remembers after release

Everything except the pressure. Measured across every timeline: the friction records remain
(to the unchanged 48-tick eviction), `contactMemories` is untouched and carries **no position**,
`placeMemory` and attachment are held throughout, and an `avoid_place` valence still produces
avoidance **40 ticks after** the social episode released (P15) because the place-valence and
death-memory terms are deliberately left unweighted.

## 6. What reports do

They still arrive (`reportsReceived` 2,649 → 2,639 over 20 years) and still create
`reported_secondhand` friction. They now age, they stay second-hand, they are capped below
first-hand, they weaken with hop depth, and **five relayed copies of one story produce one
record instead of several confirmations**. A band no longer republishes a rumour as its own
knowledge, or broadcasts a belief it has stopped acting on.

## 7. Before/after

### 7.1 Controlled fixtures P1–P22, both arms, **0 vacuous in the after arm**, 11 of 22 changed

| | question | before | after |
| --- | --- | --- | --- |
| P1 | one observation then departure | `RELEASED_PHYS_S0_SOCIAL_**S18**` | `RELEASED_PHYS_S0_SOCIAL_**S8**` |
| P3 | unvisited place after departure | `COOLS_S18` | `COOLS_S8` |
| P4 | observer revisits and finds no one | **`NEVER_RELEASES_DESPITE_CONTRADICTION`** | **`CONTRADICTION_ACCELERATES_S6_VS_S8`** |
| P7 | return after full release | `VACUOUS_NOT_RELEASED_BEFORE_RETURN` | `FRESH_EVIDENCE_REQUIRED_AND_SUFFICIENT` |
| P10 | kin / peaceful sharing | `PEACEFUL_RELEASES_S18` | `PEACEFUL_RELEASES_S4` |
| P11 | tense stranger use | **`TENSE_NEVER_RELEASES`** | `TENSE_PERSISTS_LONGER_S12_VS_S4` |
| P12 | report-only belief | **`SECONDHAND_BUT_DOES_NOT_FADE`** | **`SECONDHAND_AND_FADES`** |
| P13 | five copies of one report | **`TREATED_AS_2_INDEPENDENT_CONFIRMATIONS`** | **`ONE_EPISODE_ONE_RECORD`** |
| P14 | two independent reports | `INDEPENDENT_SOURCES_NOT_DISTINGUISHED` | `INDEPENDENT_SOURCES_REINFORCE` |
| P16 | three-layer independence | `SOCIAL_S18` | `SOCIAL_S8` |
| P18 | terminal other band | `NO_NEW_EVIDENCE_BUT_OLD_PERSISTS` | `NO_NEW_EVIDENCE_AND_OLD_RELEASES` |

Unchanged and required to stay so: P2 (saturation), P5 (not representable), P6 (reactivation
while cooling), P8 (no place transfer), P9 (a new band starts fresh), P15 (environmental
avoidance survives), P17 (band still known), P19 (no evidence, no state), P20/P21
(order and step-mode invariance), P22 (bounded).

### 7.2 The required headline chain — all eight parts satisfied

```text
legitimate direct overlap
-> other band departs
-> physical pressure releases immediately        season 0, IDENTICAL in both arms
-> no new direct evidence is written             directFrictionCreated 28 -> 28
-> active social pressure cools and releases     season 18 -> season 8
-> historical contact/place memory remains       held throughout, both arms
```

### 7.3 Natural occurrence, 20 years — same maps, seeds and scenarios as AUDIT-27 → CORRECTION-30

| | before | after |
| --- | ---: | ---: |
| stale-escalation samples | **3** | **0** |
| summed friction contribution to access | **27.13** | **6.74** (−75%) |
| band-seasons with an active contribution | 12 | **4** |
| band-seasons with retained but **inert** records | 13 | **21** |
| report-linked friction records created | **33** | **3** (−91%) |
| direct friction records created | 28 | **28** |
| mean measured record lifetime (ticks) | 10.4 | 16.07 |
| `sharedUsePressureSum` | 45.98 | 39.87 |
| `strangerCautionSum` | 76.68 | 67.37 |
| `rememberedRefusalAvoidanceSum` | 652.67 | 637.97 |
| access states `tolerated_shared_use` | 22 | 6 |
| `socialEvidencePhase` | (field absent) | none 4,734 / active 5 / cooling 1 |

**The physical layer is identical on all 17 checked keys**, at 20 years *and* at 50:
`weightedCrowdingSum` 2.51, `catchmentClaimTileSeasons` 26,515, `contestedCatchmentTileSeasons`
43, `sharedReachableSupportSum` 114,381.8, `perCapitaReturnSum` 1,305.41, `tileDepletionSum`
3,419.5131, `tripRecordSeasons` 57,600, `moves` 1,547, `fissions` 0, `absorbed` 0, `extinct` 0,
`finalPopulation` 817, `finalLivingBandCount` 30, `survived` 6/6.

**CORRECTION-30's own unmodified natural instrument agrees independently:**
`frictionRecordsCreated` 61 → 31, entirely from `reportLinkedRecords` **33 → 3**, with
`observed` records **unchanged at 28** and every one of its provenance guarantees intact.

### 7.4 Behavioural impact

Population, bands, moves, fissions, absorption, extinction and survival are **unchanged at both
horizons**, so there is no first physical divergence and no changed demography to report. The
divergence is entirely social, classified in `behavioral-comparison.json` as:

- **intended release effect** — contribution magnitude, active/inert band-seasons, stale
  escalations, report-linked creations, record lifetime;
- **secondary social effect** — access pressures, access-state mix, small drift in
  `reportsReceived` (2,649 → 2,639) and `distinctReportEpisodes` (1,638 → 1,636), which follows
  from publishing fewer friction-derived reports;
- **physical ecological drift** — none;
- **unexplained divergence** — none.

**No improvement is claimed.** No coefficient was recalibrated to preserve a prior fingerprint.

## 8. Suspicious results and unresolved limitations

1. **AUDIT-27's C5 is byte-identical between arms and does NOT flip.** Its test is
   `observerFrictionAboutDeparted` at the end ≥ at the start — it counts **retained records**,
   which this design deliberately keeps (§10.5) — and its access readings are taken at the
   observer's *current* tile, not the departed band's place. Its whole 24-season timeline is
   unchanged. **C5 cannot express this repair**, and it is reported unchanged rather than
   worked around. The instrument that does measure release is the with-ring-minus-without-ring
   counterfactual in this checkpoint's own fixtures.

2. **P2 does not show what §11 anticipated, and says so.** `recentOverlapCount` saturates at
   1 + the 8-slot ring = 9 within the first seasons of contact, so both the one-season and
   ten-season arms sit at the ceiling: **saturation is demonstrated, "repeated use persists
   measurably longer" is not**, because the counter has no headroom to express it. That ceiling
   is the pre-existing bounded design, not something introduced here.

3. **Three instrument errors in this checkpoint's own probes, found and repaired.** (a) The
   first version read raw access scalars, but `sharedUsePressure` also carries the band's own
   use pressure, so a departure looked like escalation — replaced by the counterfactual.
   (b) A cooled place drops out of the 8-slot access memory, making "not tracked"
   indistinguishable from "released" — the fixtures now pick a place the observer values for
   its own reasons, and the counterfactual is immune either way. (c) Reactivation was measured
   place-scoped while a returning band returns to wherever the observer now is, producing a
   false `NO_REACTIVATION` — now pair-scoped.

4. **`presentWithoutOthersSeasons` is one small accumulator on a store that was otherwise
   purely derived.** It is bounded at 8 and resets when the band leaves, and there is precedent
   (`droppedLowSalienceCount`), but it is the one piece of state this checkpoint adds and it is
   named rather than buried.

5. **Cooling is time-based, not season-aware.** Mauss's point that a summer place is empty every
   winter without being abandoned is in the model only as "cool slowly and reactivate cheaply".
   There is no seasonal-round model for *other* bands.

6. **The contradiction channel is symmetric and terrain-blind**, inheriting CORRECTION-30's
   proximity-as-detection simplification. Production still has no visibility, route or barrier
   rule for social perception.

7. **Not run, deliberately:** no 200-year matrix, no performance measurement, no fresh-process
   determinism run, no `simBenchmark` fingerprint comparison (behaviour changed, so parity is
   neither claimed nor possible).

8. **Inherited failure, not rerun and not claimed fixed:** `expeditionLifecycleAudit`, recorded
   failing identically at CORRECTION-26's base and tip.

## 9. What the supervising human must decide next

1. Whether the four release horizons (8 / 12 / 16 ticks, and hearsay at 16 × 0.7) are the right
   calibration. They are justified but not measured against anything — no data fixes them.
2. Whether `presentWithoutOthersSeasons` is an acceptable addition to a derived store.
3. Whether to accept that AUDIT-27's C5 verdict string stays put (§8.1).
4. Close or reject this checkpoint. **Roadmap item 3 does not close on it.**

Still open from AUDIT-27, each needing its own checkpoint: `nearbyBandPressure` vs
`crowdingPenalty` double influence; candidate-score crowding double counting; the
residence-anchored physical footprint; activity-party and expedition physical overlap;
`territorialPressure`'s missing writer; kin crowding weights; parent-memory dispersal pressure;
broader encounter visibility and barrier rules.

## 10. Technical report

### 10.1 Git

```text
base       1c6a3ed8d0a8360c8fe4648a83387a2bd4fa30b4  (CORRECTION-30, CLOSED and FROZEN)
branch     checkpoint/shared-range-release-lifecycle-31
main       0a43083a3a9103bc6b8f693b8823a604ae2c6a8d  (local and remote, untouched)
frozen     C30 1c6a3ed · C29 a15d0a7 · C28 c5eb58a · AUDIT-27 b352c31
worktrees  one at entry; a temporary detached read-only worktree at 1c6a3ed was used for the
           before arm and removed afterwards. Nothing was committed from it.
```

Production: **four files** — `accessNorms.ts` (the weighting layer), `rangeFriction.ts` (report
events age and dedupe by episode), `reportedKnowledge.ts` (two republication filters),
`types.ts` (five optional derived fields + one derived phase union).

New audit scripts: `rangeReleaseLifecycleFixturesAudit.mjs`,
`rangeReleaseLifecycleNaturalAudit.mjs`, `rangeReleaseLifecycleCompare.mjs`.

### 10.2 Validation executed on this branch

| check | result |
| --- | --- |
| `npx tsc -p tsconfig.json --noEmit` / `tsconfig.node.json` | PASS |
| `npm run build` | PASS |
| `node scripts/checkGraph.mjs` | PASS — 221/764, 0 dup, 0 dangling |
| `node scripts/importBoundaryAudit.mjs` | PASS — internal back edges **85, unchanged** |
| `node scripts/seasonOrderInvarianceAudit.mjs` | `"verdict": "PASS"`, no per-band divergence |
| `node scripts/stepModeInvarianceAudit.mjs` | PASS — **both maps**, `fullCanonicalStateMatch: true`, `firstDivergence: null` |
| `node scripts/catchmentInvariants.mjs` | 5 PASS, 0 FAIL |
| `node scripts/livingEcologyFoodPipelineAudit.mjs` | `"verdict": "PASS"` |
| `node scripts/mobilityAuthorityAudit.mjs` | `"verdict": "PASS"` |
| `node scripts/socialCausalityAudit.mjs` | **byte-identical between arms** |

### 10.3 Reruns of prior checkpoints' own instruments

| audit | result |
| --- | --- |
| AUDIT-27 controlled fixtures | **11/11 unchanged** |
| AUDIT-27 release timeline (16 and 24 seasons) | **byte-identical** — see §8.1 |
| CORRECTION-28 fixtures | **12/12 unchanged** |
| CORRECTION-29 fixtures | **12/12 unchanged** |
| CORRECTION-30 fixtures | **15/15 unchanged** |
| CORRECTION-30 natural provenance | 6 of 38 aggregates moved, all report-linked; `observed` records and every provenance guarantee unchanged |

All reruns were given explicit `--out` paths. The four frozen evidence directories are
**unmodified** — `git status --short` on them is empty.

### 10.4 Claim provenance

- **Repository facts** (independently verified): every file:line in `authority-ledger.md`; that
  no friction→pressure function read `event.tick`; that report-linked events were re-minted at
  the current tick; that `confidence` counted retained records; that `ProtoAccessMemory` stores
  nothing; that `KnownBandContactMemory` carries no position; the absence of departure events,
  band-movement report topics, traces and cross-band visibility.
- **Research-backed mechanisms**: staleness as the default when nobody monitors; absence as
  evidence only when the observer was positioned to notice; seasonal absence ≠ abandonment;
  access as normally granted; retelling ≠ confirmation. Sources in
  `RESEARCH_AND_CAUSAL_MODEL.md` §3, classified by strength in §4.
- **Implementation abstractions**: the four release horizons; the linear decay shape; the
  2-ticks-per-season contradiction bonus; proximity-as-detection; the 0.05 activity floor.
- **Executor-run evidence**: every number in §7 and §10.2–10.3.
- **Unresolved interpretation**: whether the horizons are right; whether tense episodes really
  should persist twice as long as tolerated ones; whether the residual access-pressure
  reduction changes anything a supervising human would want changed.
