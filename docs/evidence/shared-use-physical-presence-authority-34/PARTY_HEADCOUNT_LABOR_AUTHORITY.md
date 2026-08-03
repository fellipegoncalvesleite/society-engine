# CORRECTION-34D — PARTY PHYSICAL HEADCOUNT vs PRODUCTIVE PARTY LABOUR

Continues CORRECTION-34C (`e9b9655`) on
`checkpoint/shared-use-physical-presence-authority-34`. Production behaviour changed — eleven
files. Roadmap Item 4 is **not** started.

---

## 1. What CORRECTION-34C fixed, and what it left conflated

34C moved `reconcileExpeditionCommitment`'s bound from `demography.workingAdults` to
`demography.population` and stopped an adult-to-elder transition teleporting a body home. It also
bounded fission against residential availability and removed an aged-away person from the elder
term of the residential catchment. Those repairs stand and are untouched here.

What one field could not do was stop the party being granted **labour the band does not have**. The
same record answered "how many bodies are at that tile?" and "how much work can they do?", so the
state 34C accepts as valid —

```text
population 20   workingAdults 5   elders 7   dependents 8
one operating party, partyWorkers 6, partyCompositionTotal 6
```

— gave a band of five working adults a party performing six adults' worth of work.

## 2. Reproduced before any production change

`scripts/headcountLaborAuthorityAudit.mjs`, run on `e9b9655`, on that exact state, **after running
production's own daily reconciliation** (`reconcileExpeditionCommitment`) so the measurement is of
what production produces rather than what a test hands it:

> **PARTY HEADCOUNT STILL ACTS AS IMPOSSIBLE LABOR**

| quantity | before | after | |
| --- | ---: | ---: | --- |
| physical away headcount | 6 | 6 | unchanged — nobody moves |
| residential physical headcount | 14 | 14 | unchanged |
| total working adults | 5 | 5 | |
| `partyWorkers` | 6 | **5** | labour, now bounded by the cohort |
| `nonWorkingPartyPeople` | 0 | **1** | the body that stopped working, still there |
| physical party people | 6 | 6 | |
| `partyCompositionTotal` | 6 | **5** | |
| committed mobility-pool total | 6 | **5** | |
| available mobility-pool total | 0 | 0 | |
| travel pace (tiles/day) | 2.092 | **1.969** | slower, never faster |
| party pace factor | 0.9917 | **0.9333** | |
| carry capacity | 0.72 | **0.6** | capacity-for-five, not six |
| provisions per day | 0.0048 | 0.0048 | **all six still eat** |
| maximum provision budget | 0.1152 | 0.1152 | |
| target-work residential labour | 0 | 0 | |
| catchment adults / elders | 0 / 6 | 0 / 6 | |
| catchment foraging draw | 10.3 | 10.3 | |
| total represented population | 20 | 20 | |
| `conserved` | true | true | |
| `laborBounded` | — | **true** | new; false on the before arm |

Composition moves `{1,4,1} → {1,4,0}`: the **high** pool is emptied first, so a party that lost
labour can never move faster than before it lost it.

Arms: `headcount-labor-before.json`, `headcount-labor-after.json`.

---

## 3. Architecture selected — Option B + Option C, with §8's prepared/away separation

**Option B — a bounded party-local non-working count.** `ExpeditionRecord.nonWorkingPartyPeople`
(optional; absent means zero). Physical headcount is **derived**:
`partyWorkers + nonWorkingPartyPeople`.

**Why B over A (two independent stored counts).** The §11 requirement
`0 <= productiveWorkers <= physicalPeople` becomes **structural** rather than asserted: physical is
the sum of two non-negative counts, one of which *is* productive. No clamp maintains the ordering,
so no clamp can hide it being violated — which is exactly what §11's "no clamp may hide a broken
invariant" asks for. Option A leaves two free numbers that must be kept ordered by convention.
Migration is also strictly safer: an absent field reads as zero, and a pre-split record then means
precisely what it always meant (headcount and labour equal at launch, nothing able to separate
them). Nothing is reinterpreted.

**Option C — residence-first aggregate allocation, adopted alongside B.** When the working-adult
cohort falls while a party is away, the change is charged to residential working adults first, for
as long as enough exist. Only when the residence can absorb no more does an away party convert
workers into non-working members.

**Options D and E rejected.** D (blocking cohort transitions while parties are away) would let a
party's existence freeze a band's demography — coarse, and distorting in exactly the direction this
checkpoint family has been removing. No further architecture was found that is smaller than B+C
while remaining truthful.

The name `nonWorkingPartyPeople` is deliberately neutral. It does **not** claim the person is an
elder, a child or injured; the aggregate model cannot know.

---

## 4. Physical headcount authority

`bandMobility.getExpeditionPhysicalPeople` / `derivePhysicallyAwayPartyPeople`, in the leaf module
that already owns "who is committed away". Derived in exactly one place so no reader can drift.

- **How many bodies are in each party** — `partyWorkers + nonWorkingPartyPeople`.
- **Where they are** — `getBandPhysicalPresence` (crowding.ts) places that count at the party's own
  `positionTileId`. It previously placed `partyWorkers`, so a member who stopped working vanished
  from the map while still standing at the target.
- **When they depart** — the `prepared → outbound` transition. `prepared` people are physically
  residential and are excluded from the away set.
- **When they return** — terminal phases hold no body; production drops the record from
  `band.expeditions` into `recentExpeditionOutcomes`, releasing everyone exactly once.
- **When a physical loss changes them** — only through a party-local physical outcome
  (`party_lost` past the hard deadline, injury-forced return, provisions exhausted). Never from a
  cohort change.

## 5. Productive labour authority

`getCommittedExpeditionWorkers` (expedition.ts) over `partyWorkers`, with `partyComposition` as its
mobility-role decomposition.

- **How many can work** — `partyWorkers`, bounded by `reconcileExpeditionLabor` so
  `sum(away productive workers) <= workingAdults`.
- **How composition relates** — `partyCompositionTotal === partyWorkers`, maintained by the same
  function that reduces the workers. A non-working member draws from no mobility pool.
- **How reclassification changes labour** — high → typical → limited, so pace is monotonically
  non-increasing; the carry ceiling falls with the worker count; cargo above the reduced ceiling is
  abandoned into `lostUnits` with `harvest + lost` invariant.
- **How it stays bounded by band demography** — `getResidentialWorkingAdults` clamps at zero, and
  `getBandCommitmentAccounting.laborBounded` exposes the predicate production maintains.

## 6. Cohort allocation rule — stated as a convention, not an observation

> While the band still has residential working adults to absorb a change in the working-adult
> cohort, away parties are untouched. Only when the whole cohort falls below what is already
> committed does an away party convert workers into non-working members.

§7's own counterexample is the test: with `workingAdults` 20 → 19 and a party of six, **nothing
happens to the party**, and the model does not claim to know whether the person who aged was at
camp or on the route. Fixture H2 measures exactly this.

The away non-working count is charged against **elders** in the residential catchment, because
adult → elder is the only reclassification the annual step performs with population unchanged.
34C *inferred* that quantity as `max(0, committedAway - workingAdults)`; it is now **read from the
record**. Dependents are never reduced — a party is not staffed from them.

The model **cannot** locate a death inside a party (deaths are an aggregate net-rate quantity with
no location field), and nothing here claims otherwise.

## 7. Provisions, carrying, work and pace

| authority | reads | rationale |
| --- | --- | --- |
| provisions per day, provision budget, task-camp setup, campless shuttle, acute-risk share | **physical people** | everyone eats. Computing this from workers alone fed a body for free. This is the one place the split makes a party's life *harder*. |
| carry capacity | **productive workers** | §6's comparison: **zero productive carrying** selected over a partial share or an explicit burden. Both alternatives need per-person physiology this architecture has no state for; a bounded zero cannot grant capability through a loss. |
| target work, mobility pools, same-day task-group labour | **productive workers** | labour questions against a labour cohort. |
| travel pace | **both** | non-working members enter `derivePartyPaceFactor` with the existing limited-walker penalty and the existing denominator — no new constant, and no elder/child model. Measured 0.9917 → 0.9333. |

## 8. Prepared-party semantics (§8)

`deriveCommittedMobilityPools` includes `prepared`, and 34C used it as fission's `awayPartyPeople`.
Prepared people stand in the camp they have not yet left, so calling them physically absent was
false. Three facts are now distinct (fixture H6):

- **physical residence** — prepared people are inside the residential physical headcount;
- **labour commitment** — their hands are promised, so no other party or task group may staff them;
- **founding availability** — they are withheld from founding a daughter as a **prior labour
  commitment**, named as the policy it is.

Cancelling a prepared party to free founders, and any other rule, require a fission that can take
decisions about parties. That is Roadmap Item 4, and nothing here cancels a party as a side effect
of a demographic step.

## 9. Fission founder availability

```text
daughter = min(getDaughterPopulation(totalPopulation),
               population - physicallyAwayPeople - preparedCommitmentPeople)
```

blocked below `DAUGHTER_MIN_POPULATION`. In the ordinary case (headcount == labour, no prepared
party) this is numerically identical to 34C, so no behaviour regresses; what changes is that the
two reasons a person cannot found are separated and correctly named, and a party's non-working
body is now also excluded from the founding draw. Fixtures H7 (48 away → residence physically holds
12, blocked) and H8 (48 prepared → residence physically holds **60**, founders available 12, same
outcome for a different and stated reason).

## 10. Defensive and legacy handling (§9)

**The L10 correction.** 34C accepted `phase: operating, outcomeReason: null, partyWorkers 6 → 3` as
`EXPLICIT_OUTCOME_AND_STATED_MODEL_LIMIT`. It was neither explicit nor an outcome: three people were
deleted with no named cause and the remainder was left *operating*, so the record went on describing
a journey in progress. The fixture's own text asserted a terminal outcome while the party was not
terminal.

The two bounds now separate cleanly:

- **Labour** below `EXPEDITION_MIN_PARTY_WORKERS` on a party that is physically away →
  `phase: returning`, `outcomeReason: party_labor_unsupported`. **Every body is kept** and walks
  home. 34C declared this `lost`, which invented a death out of an accounting change at home.
  (A `prepared` party in the same position is still `aborted` with `commitment_unsupported` — its
  people never left.)
- **Bodies** exceeding `population` → the record is **retired whole** as `phase: aborted`,
  `outcomeReason: invalid_state_repaired`. It is not partially and silently shrunk. `bandEvents`
  skips that reason entirely, so no journey, loss or homecoming is ever narrated from it.

Legacy migration (H14): an absent `nonWorkingPartyPeople` reads as zero. A pre-split record with no
`partyComposition` at all still reconciles — its workers fall and the extra body stays with it.

## 11. What the natural world does

Daily sampling, map2, seed `audit27:natural:map2:s1`
(`natural-headcount-labor-20y.json`, `-50y.json`):

| | 20 y | 50 y |
| --- | ---: | ---: |
| band-days | 64,800 | 162,000 |
| active party-days | 854 | 2,011 |
| physical party people-days | 2,059 | 4,842 |
| productive party worker-days | **2,059** | **4,842** |
| non-working away people-days | 0 | 0 |
| annual boundaries crossed while active (band-days) | **18** | **50** |
| cohort transitions while active | 0 | 0 |
| productive-labour reductions | 0 | 0 |
| physical-headcount reductions | 0 | 0 |
| every adverse counter | **0** | **0** |

People-days **equal** worker-days at both horizons: the split never opens by itself, because
nothing in these worlds drives a working-adult cohort below a committed party. The sweep therefore
shows the change is **inert in ordinary play** and proves nothing whatever about the reduction
path. H1–H14 are that proof, and they were built regardless of natural frequency.

**A correction to a prior checkpoint's reported natural result.** 34C reported *0 annual boundaries
crossed by active parties* at 20 and 50 years. Sampled daily on the season transition into spring —
the condition `shouldRunAnnualDemography` itself tests — it is 18 band-days at 20 years, 50 at 50,
on 7 of 20 world boundaries. The prior zero is best explained by the instrument artefact
CORRECTION-34A already identified once: a season-boundary sample cannot see a party. No verdict
moves, because no cohort transition happens while a party is away in these worlds, but the reported
frequency was wrong.

## 12. Fixtures — 14, 0 failing, 0 vacuous

`headcount-labor-fixtures.json`.

| | verdict |
| --- | --- |
| H1 ordinary valid party | ALL_AUTHORITIES_AGREE |
| H2 aging allocated to residence | RESIDENCE_ABSORBS_THE_TRANSITION_PARTY_UNTOUCHED |
| H3 forced away labour reduction | LABOR_REDUCES_THROUGH_ONE_AUTHORITY_NO_BODY_MOVES |
| H4 non-working person remains | PRESENT_AND_CONSUMING_WITHOUT_GRANTING_LABOR |
| H5 two concurrent parties | LABOR_ALLOCATED_DETERMINISTICALLY_WITHOUT_MOVING_BODIES |
| H6 prepared party | RESIDENTIAL_BODY_COMMITTED_LABOR_UNAVAILABLE_FOUNDER |
| H7 fission with an away party | FOUNDERS_ONLY_FROM_PHYSICALLY_RESIDENTIAL_PEOPLE |
| H8 fission with a prepared party | PREPARED_WITHHELD_AS_LABOR_COMMITMENT_NOT_CLASSIFIED_AS_ABSENT |
| H9 catchment after cohort transition | NO_AWAY_PERSON_DRAWS_LOCALLY_AND_NO_COHORT_IS_SUBTRACTED_TWICE |
| H10 return after labour reduction | HEADCOUNT_RETURNS_EXACTLY_ONCE_NO_COHORT_CREATED_OR_DELETED |
| H11 corrupt legacy state | LABELLED_NON_HISTORICAL_REPAIR_NO_SILENT_DELETION |
| H12 active annual-boundary equivalence | IDENTICAL_ACROSS_ALL_FOUR_MODES_WITH_AN_ACTIVE_PARTY |
| H13 no natural overlap control | NATURAL_FREQUENCY_REPORTED_NOT_SUBSTITUTED |
| H14 legacy record migration | UPGRADED_DETERMINISTICALLY_AND_CONSERVATIVELY |

**Why the old L12 did not prove active annual-boundary behaviour.** It stepped a natural world 1,260
days and counted expedition records at the end. A natural party lives at most
`EXPEDITION_MAX_DURATION_DAYS = 24` days against **annual** demography, so any record it found had
been launched long after the last boundary. It establishes step-mode determinism — which is real —
but not that an *active* party is represented identically across a demographic boundary, which is
the property this checkpoint changes. Its verdict is therefore narrowed to
`STEP_MODE_IDENTICAL_NO_ACTIVE_PARTY_CLAIM`.

H12 constructs the case: a party injected **two days before** the spring run at day 1080,
`outbound` along an 8-tile route so it is still walking out when demography executes, and the
fixture **measures the phase on the boundary day** rather than inferring it from the party having
existed at injection. Daily arm: **9 parties still walking the day before demography and 9 still
walking on the demography day**; all four step modes byte-identical on full canonical state.
Evidence: `active-annual-boundary-four-way.json`.

## 13. Three instrument errors in this pass's own probes, recorded

1. **The return fixtures (H4, H10) failed first, and it was the fixture.** They hand-built a
   `completed` record that stayed in `band.expeditions` with its counts zeroed and its
   `partyComposition` left standing, then failed their own `compositionTotal === workers` check.
   Production drops a terminal party out of the list entirely (`expedition.ts:2696-2701`); the
   fixtures now do what production does.
2. **H12 reported DIVERGENT on its own arithmetic.** Its setup span was stepped as
   `stepSim(w, 1080/days, mode)`; `1080/7 = 154.29`, so the weekly arm was handed a fractional step
   count and landed on a different day from the other three. Setup now walks `advanceWorldByDays`
   (identical in every arm) and only the compared span sits on the 630-day grid.
3. **H12 passed while claiming something it had not measured — caught by strengthening it, not by
   a failure.** Its first form injected a party ten days before the boundary and asserted only that
   parties existed at injection and resolved by the end of the span. Adding a direct measurement of
   the party's phase *on the demography day* showed **0 parties still walking**: an `operating`
   party one tile out finishes its three work days and walks home in about five, so it was already
   terminal at day 1080. The fixture had been asserting a boundary crossing that never happened.
   Rebuilt as an `outbound` party on an 8-tile route injected two days before the boundary, and the
   assertion now reads the measured phase. **The earlier PASS is withdrawn; the current one rests
   on 9 parties measured walking on both sides of the demographic step.**
4. **Two evidence-output incidents, reported in full in `PROVENANCE.md`.**
   `socialAccessUnrelatedRiskFixturesAudit` has **six** output flags and the first rerun redirected
   only one, writing five files into CORRECTION-33's frozen directory; restored with
   `git checkout`, and each is byte-identical to both `e9b9655` and `HEAD`. Separately the presence
   audit's six-year default overwrote six files whose committed data was a twenty-year run;
   restored and re-run at twenty years — five of those files now **differ from the pre-run
   committed version by their `generatedAt` line and are NOT byte-restored**, and
   `controlled-fixtures.json` deliberately moved from six years to twenty, which promotes
   `P9_concurrent_parties` out of vacuous. `performance.json` was restored untouched at the time
   and then **legitimately regenerated by the final validation run**, so it too is no longer
   byte-identical; the exact deltas and their attribution are tabulated in `PROVENANCE.md`.

## 14. Limitations, stated

- The split **never opens naturally** in these worlds. Every claim about the reduction path rests on
  controlled fixtures.
- The residence-first rule is an **accounting convention**. Locating a cohort transition, an injury
  or a death inside a party needs the future individual/household layer.
- Zero productive carrying for a non-working member is a **bounded abstraction**, not a physiology
  model. No claim is made that it is the physically right magnitude.
- Pace charges a non-working member the existing limited-walker penalty. The constant was **not**
  tuned; the authority changed, the strength deliberately did not.
- Withholding prepared people from founding is a **policy**, not a physical necessity.
- `getBandPhysicalPresence` remains **not self-conserving** for a band assembled directly by a test
  that never ran a day; assert `getBandCommitmentAccounting(band).conserved`.
- **State cost is measured and bounded: +1,224 B at 20 years and +1,332 B at 50**, entirely the new
  `partyPeople` field on the 6-record outcome ring (54 records across 9 bands). Every cap is
  unchanged.
- **No performance claim is made.** The wall-clock rows moved from 0.86/0.82 to 1.52/1.49 ms per
  simulated day, but that is not a controlled comparison — no before/after timing arm was built and
  the machine was under sustained load. It is reported, not interpreted. No 200-year matrix.
- **Roadmap Item 4 is not started.** The formal same-day presence deferral is preserved exactly.

## 15. Realism checklist (§12)

| | item | status |
| --- | --- | --- |
| 1 | physical headcount separate from labour | ✅ two derivations, one leaf, structurally ordered |
| 2 | aging does not move bodies | ✅ H1, H2, H3 — presence identical across every cohort change |
| 3 | aging or reclassification can alter labour | ✅ H3 — 6 → 5 workers with 6 bodies at the same tile |
| 4 | all physical people consume | ✅ provisions, budget, task-camp setup, campless shuttle, acute-risk share |
| 5 | non-workers do not grant full carrying/work capacity | ✅ zero productive carrying; carry 0.72 → 0.6 |
| 6 | mobility composition matches productive labour | ✅ `partyCompositionTotal === partyWorkers`, checked every band-day naturally |
| 7 | prepared commitment separate from physical absence | ✅ H6, H8 — residence reads 60, not 12 |
| 8 | fission uses physically available founders | ✅ H7, H8 |
| 9 | aggregate allocation rule stated honestly | ✅ named a convention in code and here; H2 is §7's own counterexample |
| 10 | mortality-location limit stated honestly | ✅ the model cannot locate a death; nothing claims to |
| 11 | no hidden repair presented as history | ✅ `invalid_state_repaired`, retired whole, never narrated |
| 12 | bounded state | ✅ one optional integer per expedition record; no new store, ring or index |
| 13 | deterministic replay | ✅ H5, H11 idempotent; H12 identical across all four step modes; four-way audit `ALL_FOUR_STEP_MODES_IDENTICAL` |
| 14 | future individual/household dependency documented | ✅ §6, §14, and the roadmap entry |
| — | **pace burden calibrated against evidence** | 🟨 the *authority* is correct — a non-working member cannot be invisible — but the magnitude reuses the existing limited-walker penalty and is **not** independently justified |
| — | **carrying share for a non-working member** | 🟨 zero is a bounded choice, not a measured one |
| — | **cancel-prepared-party-to-found policy** | ⬜ not built; Roadmap Item 4 |
| — | **locating a cohort transition, injury or death inside a party** | ⬜ not built; needs the individual/household layer |
| — | **same-day party presence** | ⬜ formally deferred by the CORRECTION-34A scope reduction, preserved exactly |
