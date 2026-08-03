# CORRECTION-34E — EXPEDITION TARGET-WORK LABOUR PROVENANCE

**Branch** `checkpoint/shared-use-physical-presence-authority-34`, continuing `c8df1ea`
(CORRECTION-34D tip). **Production behaviour changed — two files.**

---

## 1. What CORRECTION-34D fixed, and the one thing it claimed but did not do

CORRECTION-34D separated a party's **physical headcount** from its **productive labour** and rewired
seven consumers onto the right one: presence, composition, mobility pools, pace, carrying,
provisions and fission availability.

Its own authority ledger listed `getExpeditionProductiveWorkers` as the authority for
"composition, pace, carrying, **target work**".

**That last item was not true when it was written.** Nothing in 34D touched target work. The claim
is corrected in `authority-ledger.md` in this pass, and it is the reason CORRECTION-34E exists.

## 2. The defect, reproduced on real production before anything changed

The chain at `c8df1ea`:

```text
advanceExpeditionOneDay
  -> resolveExpeditionTargetWork(world, band, ...)     // hands over the WHOLE BAND
    -> buildTripRecord(world, band, ...)
      -> estimateTaskGroupPeople(band, taskGroupType)  // workingAdults MINUS away workers,
                                                       // capped by a task share, floored at 1
```

The expedition passed its band. It never passed its party. So the size of the working group standing
at a target three days' walk away was a share of **the adults who stayed at the residence** —
and it was floored at one, so a party could also be shrunk to a single person's work by an
accounting rule that has nothing to do with who walked.

`estimatedPeopleCount` is not decorative. It is a single variable that feeds
`deriveResourceReturnRecord`'s request (`estimatedPeopleCount * 0.035 + ...`), the activity-outcome
classification, the fauna pressure intensity, the shadow record, and the record field itself. The
request then becomes the `requestedAmount` `resolvePhysicalFoodHarvest` hands to
`resolvePlantFoodHarvest` / `resolveFaunaFoodHarvest`, which **removes it from the world's stock**.

### The measurement (`target-work-labor-before.json`)

One real map2 world, two simulated years, one real band, one real remembered patch that production
actually harvests, one **identical** five-worker party — composition, cargo, target, route, season,
memory and world stock all held fixed. The only thing varied is how many working adults stayed home.

| | 1 adult at home | 25 adults at home |
| --- | --- | --- |
| record `estimatedPeopleCount` | **1** | **6** |
| stock removed at the target | **0.0086** | **0.0354** |
| patch depletion, before → after | 0.2198 → **0.4094** | 0.2198 → **1.0 (exhausted)** |
| usable support | 0.0071 | 0.0291 |
| outcome | `target_found` | `partial_success` |

**A 4.1× difference in distant physical depletion, decided entirely by people who never left camp.**
At the high end the same five people strip the patch to nothing; at the low end they take a fifth of
what is there. And in the other direction the party was **inert at its own target**: 2 workers and 5
workers both read `estimatedPeopleCount` **2**, because both left 10 adults at the residence.

## 3. The repair

**Option A, at the seam where the physical party is already known.** Two production files.

`intraSeasonTrips.resolveExpeditionTargetWork` takes a new **required** `options.partyWorkers` and
passes it to `buildTripRecord` as `partyWork.productiveWorkers`. `buildTripRecord` branches once:

```ts
const estimatedPeopleCount = partyWork === undefined
  ? estimateTaskGroupPeople(band, taskGroupType)   // same-day: unchanged
  : Math.max(0, Math.round(partyWork.productiveWorkers));
```

`expedition.ts` supplies `getExpeditionProductiveWorkers(withProvisions)` at **both** call sites —
the exploitation work day and the verification day.

Four properties this deliberately has:

1. **No fallback, and no default.** `resolveExpeditionTargetWork` throws if `partyWorkers` is
   missing. A default would silently restore the defect for any future caller that forgot; the
   absence of one makes the invariant structural rather than tested.
2. **No floor of one on the party branch.** The residential estimator's `Math.max(1, ...)` exists so
   a band always fields somebody at home. Importing it would let a party with no working members
   still request a person's work.
3. **One variable, so propagation is by construction.** Because `estimatedPeopleCount` is the single
   term every labour-dependent consumer reads, choosing it correctly at the record builder reaches
   the request, the outcome classification, the depletion, the fauna pressure, the shadow record and
   the cargo without enumerating them.
4. **The same-day path is not touched.** It passes no party context, takes the residential branch,
   and keeps its own authority — because a same-day group genuinely *is* drawn from the residence.

Nothing was faked to achieve this: no synthetic band, no temporary removal of the expedition from
the band, no post-hoc scaling of cargo, and no second harvest equation. There is still exactly one
physical resolver.

## 4. After, same inputs (`target-work-labor-after.json`)

| | 1 adult at home | 25 adults at home |
| --- | --- | --- |
| record `estimatedPeopleCount` | **5** | **5** |
| stock removed | **0.0354** | **0.0354** |
| patch depletion | 0.2198 → 1.0 | 0.2198 → 1.0 |

and party labour is now live: 2 workers remove **0.0226** (patch to 0.718), 5 workers remove
**0.0354** (patch to 1.0), with the residence held identical in both arms.

Headlines flip `DISTANT WORK CHANGES WHEN HOME LABOR CHANGES` → `TARGET WORK IS INVARIANT TO
RESIDENTIAL LABOR`, and `PARTY PRODUCTIVE LABOR IS INERT AT ITS OWN TARGET` → `TARGET WORK FOLLOWS
PARTY PRODUCTIVE LABOR`.

## 5. Caller matrix (`target-work-caller-matrix.json`)

Five production callers of the labour seam, each with a stated reason its authority is the right
one. The load-bearing distinction:

> **a same-day residential task group is not a multi-day expedition party**

| caller | labour authority | depletes | cargo |
| --- | --- | --- | --- |
| `applyTripDay → buildTripRecord` (same-day) | `estimateTaskGroupPeople(band)` — **unchanged** | yes | no |
| `expeditionDailyAction → resolveExpeditionTargetWork` (work) | `getExpeditionProductiveWorkers` — **repaired** | yes | yes |
| `expeditionDailyAction → resolveExpeditionTargetWork` (`verifyOnly`) | `getExpeditionProductiveWorkers` — **repaired** | no | no |
| `resolvePhysicalFoodHarvest` | none of its own; consumes the record | yes | no |
| `estimateTaskGroupPeople` | residential cohort — **not globally replaced** | no | no |

Six audit scripts also call the resolver; all now state the party they are simulating instead of
inheriting a residence.

## 6. Controlled fixtures T1–T14 — **14/14, 0 failing, 0 vacuous, 0 not-constructed**

Every fixture carries an **asserted** non-vacuity predicate, and the harness relabels a fixture
`VACUOUS:` and fails the run if its predicate is false. `0 vacuous` is a measurement here, not a
declaration.

| | verdict | what makes it non-vacuous |
| --- | --- | --- |
| T1 ordinary work | `RECORD_PEOPLE_EQUALS_PARTY_WORKERS` | a real source was found and a non-zero amount removed |
| T2 residential invariance | `DISTANT_WORK_UNMOVED_BY_HOME_LABOR` | both arms removed non-zero (not two zeros) |
| T3 party sensitivity | `WORK_REQUEST_FOLLOWS_PARTY_LABOR` | the larger party removed strictly more |
| T4 non-working members | `BODIES_CONSUME_AND_BURDEN_WITHOUT_WORKING` | the two extra bodies are present in the consumption count |
| T5 labour reduction | `REDUCED_LABOR_REACHES_EVERY_TARGET_WORK_FIELD` | reconciliation genuinely reduced 6 → 3, not to zero |
| T6 zero residential workers | `PARTY_DOES_NOT_FALL_TO_THE_RESIDENTIAL_FLOOR` | the record read 5, above the floor of 1 |
| T7 same-day control | `SAME_DAY_PATH_RETAINS_ITS_OWN_RESIDENTIAL_AUTHORITY` | 9 bands, cohorts 10..19, 216 records |
| T8 verify-only | `PARTY_LABOR_PROVENANCE_WITH_ZERO_REMOVAL` | a real source with real availability was standing there |
| T9 plant | `PARTY_LABOR_OWNS_PLANT_REQUEST_AND_DEPLETION` | both arms actually depleted the patch |
| T10 fauna | `PARTY_LABOR_OWNS_FAUNA_REQUEST_AND_PRESSURE` | real fauna source, larger party depleted more |
| T11 numeric chain | `CHAIN_CONSISTENT_UNITS_KEPT_DISTINCT` | every link non-zero, bodies > workers |
| T12 two parties | `EACH_PARTY_USES_ITS_OWN_LABOR` | both worked and read different counts |
| T13 legacy record | `LEGACY_RECORD_USES_PARTY_WORKERS_DETERMINISTICALLY` | the legacy fields are genuinely absent |
| T14 four-way step modes | `IDENTICAL_ACROSS_ALL_FOUR_MODES_WITH_REAL_TARGET_WORK` | 6 exploitation outcomes, 2 delivering harvest |

**T4** is the split, measured: 5 workers + 0 non-working and 5 workers + 2 non-working produce
**identical** target work and identical worker-derived carrying, while B consumes 7 body-days
against A's 5 and carries the extra pace burden.

**T5** is the whole 34C/34D/34E chain in one fixture: a band whose working-adult cohort falls below
its commitment has `reconcileExpeditionCommitment` convert 3 workers into non-working members
**without moving a body** — bodies 6 → 6, workers 6 → 3 — and target work follows the labour, not
the bodies: `estimatedPeopleCount` 6 → 3, depletion 0.0354 → 0.0296.

**T6** is the floor: a band with every working adult away reads 5, where the residential estimator
would have said 1.

**T14** was **caught overclaiming and corrected before being counted.** Its first form used a
630-day span (the smallest divisible by all four mode strides) and returned
`IDENTICAL_BUT_NO_TARGET_WORK_OBSERVED` — the four modes agreed about a behaviour that never
occurred, because on this world the first expedition that actually exploits a target lands after day
720. Rebuilt at 2,520 days, where 6 exploitation outcomes and 2 delivered harvests exist and the
modes are still identical.

## 7. T7 in two halves, because one tree cannot answer it alone

**Single tree (in the fixtures):** a positive control, not a restatement. Across 9 bands with
working-adult cohorts spanning 10..19, all 216 same-day group sizes stay inside their own band's
residential cohort, respect the floor of one, and the largest-cohort band still fields the largest
group. If the party authority had leaked into the same-day path, group size would have stopped
tracking the residence.

**Cross-tree (`same-day-preservation.json`):** the same script, run unmodified at `c8df1ea` and at
this tree through a temporary detached worktree, digests every same-day trip record over the prefix
**before the first expedition target-work day**:

```text
729 days   2,034 same-day trip records   sha256 ac71f4f4…3911   IDENTICAL ON BOTH TREES
```

**Why the prefix and not the whole run, stated rather than hidden.** Past that day the two trees
legitimately differ — CORRECTION-34E intentionally changes what an expedition party's own record
says, **verification parties included**, because `estimatedPeopleCount` feeds a verification
record's outcome classification and therefore the observation it carries home. A whole-world byte
comparison past that point would be measuring an intended change and calling it a regression. The
prefix is the only window with no legitimate source of divergence, and it is not empty.

## 8. Numeric material chain (`target-work-numeric-chain.json`)

Measured on a **fauna** target chosen specifically because availability (0.7983) does **not** cap the
take, so the requested amount is directly observable rather than inferred:

```text
productive party labour                       5 workers
record estimatedPeopleCount                   5
requested target amount                       0.0455   (observable: uncapped)
physical availability at target               0.7983
actual removal  = depletionApplied            0.0455
transport loss                                0.0044
processing loss                               0.0066
usable support after losses                   0.0346   support units
carry ceiling from productive workers         0.6      cargo units
carried within ceiling                        0.0346
abandoned above ceiling                       0
physical people consuming provisions          7 bodies  ->  0.0056 provision units/day
```

Units are kept apart: `usableSupport` (support units) and `cargo.harvestUnits` (cargo units) are
**different quantities and are not equated**, and full material conservation is **not** claimed for
provisions — no residential store is decremented.

**Two things this chain does not demonstrate, stated:**

- **Abandonment reads 0 and is not proven here.** One work-day's take is two orders of magnitude
  below the carry ceiling; abandonment arises from cargo accumulated across work-days, which
  CORRECTION-34B already measured (0.648 → 0.6 carried + 0.048 lost). Nothing was fabricated to make
  it non-zero.
- **The pre-harvest request is not carried on the returned record at all.**
  `resolvePhysicalFoodHarvest` overwrites `resourceReturn.estimatedReturnValue` with the usable
  support, so that field is the RETURN. It is recoverable exactly when availability did not cap the
  take, which the chain reports explicitly (`requestWasCappedByAvailability`). On the plant patch
  used elsewhere in the fixtures it IS capped, and the chain says so rather than quietly reporting
  the cap as a request.

## 9. Natural occurrence, sampled DAILY

`natural-target-work-20y.json`, `natural-target-work-50y.json` — map2, seed `audit27:natural:map2:s1`.
A work-day is identified by the resolved record the expedition carries (`pendingReturnRecord` for
exploitation, `pendingKnowledgeRecord` for verification) advancing `workDaysElapsed`. No production
hook and no re-implemented arithmetic.

| | 20 y | 50 y |
| --- | --- | --- |
| band-days | 64,800 | 162,000 |
| active party-days | 866 | 1,992 |
| **expedition target work-days** | **87** | **213** |
| work-days with real depletion | 32 | 76 |
| productive worker-days on work-days | 301 | 721 |
| physical people-days on work-days | 301 | 721 |
| record `estimatedPeopleCount` sum | 301 | 721 |
| target stock removed | 1.9705 | 4.3042 |
| usable support | 1.4836 | 3.3039 |
| delivered (returned) support | 0.3006 | 0.6964 |
| **work-days where record people ≠ party workers** | **0** | **0** |
| verify-only depletion events | 0 | 0 |
| stock-conservation failures | 0 | 0 |
| support exceeding removal | 0 | 0 |
| person-conservation failures | 0 | 0 |
| duplicate work receipts | 0 | 0 |
| work-days with zero residential productive labour | 0 | 0 |
| **work-days where a residence-derived count would have DIFFERED** | **87 / 87** | **213 / 213** |

**This change is NOT inert in ordinary play**, and that is the sharpest difference from
CORRECTION-34D. On **every single** natural target-work day the old residential authority would have
produced a different working-group size from the party's own labour. The repair fires constantly.

Two honest qualifications. Physical people-days equal productive worker-days at both horizons, so
the *non-working-member* half of the split still never opens by itself in these worlds — T4 is the
proof of that half, not the sweep. And `work-days with zero residential productive labour` reads 0,
so T6's floor case is proven by fixture only and claims no natural credit.

## 10. Instrument errors found in this pass's own probes — recorded, not hidden

1. **The before/after probe's stock reading measured nothing.** Its first version keyed the world's
   stock stores by `targetTileId`. `plantPatchState` is keyed by **patch id** and the fauna store by
   its own source id, so the lookup never matched and `stockChangedAtTarget` read `false` in **every
   arm of both trees** while `depletionApplied` showed real removal. Corrected to key on
   `physicalFoodHarvest.sourceId`, and **both arms were regenerated with the corrected probe** — the
   superseded pair is preserved in git at `12716a6` / `d36bc87`. Only after the correction does the
   before arm show what the defect actually does to the world: patch depletion 0.2198 → **0.4094**
   versus 0.2198 → **1.0** on the same party.
2. **`requestedAmount` was the return, not the request.** Both probes labelled
   `resourceReturn.estimatedReturnValue` as the requested amount. The resolver overwrites that field
   with the usable support before returning. Renamed to `returnValueAfterHarvest` everywhere, and
   the numeric chain now reports the request only where it is genuinely observable.
3. **The natural probe read the wrong field for verification days.** It looked only at
   `pendingReturnRecord`; a verification day stores its record on `pendingKnowledgeRecord`. Before
   the fix a 2-year run reported **0 work-days** when verification days existed.
4. **T14's first form was vacuous** (§6).
5. **`summary.vacuous: 0` was hardcoded** in the inherited fixtures script. Replaced with an
   asserted per-fixture predicate and a counted total; the run now fails on any vacuous fixture.

## 11. What is claimed, and what is not

**Claimed.** The productive labour that performs an expedition's target work is the labour
physically standing at that target. Distant harvest, stock depletion, fauna pressure, cargo and
recorded labour provenance no longer depend on workers who remained at the residence. Non-working
party members consume and burden travel without granting target work or carrying. The same-day
residential path keeps its own authority and is byte-identical over the window in which a comparison
is meaningful.

**Not claimed.**

- **That the equation is right, only that its input is.** `estimatedPeopleCount * 0.035` is
  untouched; CORRECTION-34E fixed the AUTHORITY, not the STRENGTH — the same discipline
  CORRECTION-32 and -34D applied.
- **Any outcome improvement.** Population, survival and band counts were not tuned toward anything
  and no improvement is asserted. Production behaviour did change (active party-days at 20 y move
  854 → 866), which is expected and is not presented as a benefit.
- **Anything about who *within* a party works.** A party is still an aggregate of workers and
  non-working members; locating skill, age, injury or a division of labour inside it needs the
  future individual/household layer.
- **Any performance conclusion.** No before/after timing arm was built.
- **A 200-year matrix.** Not run.

## 12. Scope

Roadmap Item 3 stays active. Roadmap Item 4 remains **unstarted** — nothing here cancels, staffs or
selects a party. The CORRECTION-34A formal scope reduction (same-day *current presence* deferred
with a documented seam) is preserved exactly and is untouched by this pass.
