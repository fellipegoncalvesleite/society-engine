# CORRECTION-34A — FINDINGS (supersedes the CORRECTION-34 section below)

**DAILY TASK-PARTY PRESENCE, CATCHMENT ACCOUNTING AND EVIDENCE CLOSURE**

Continuing `4042210b332d41b91ed394aa9307962f0106a60c` on the same branch. CORRECTION-33 frozen at
`5ebb5e98`; `main` untouched at `0a43083a`. Production behaviour changed: three files.

## F1 — The person-conservation defect is not at launch

The brief expected an invalid launch. There isn't one. Verified:

- `deriveDepartableWorkers` = `max(0, min(getResidentialWorkingAdults(band) - 2, floor(workingAdults/3)))`
- `getResidentialWorkingAdults` = `max(0, workingAdults - getCommittedExpeditionWorkers(band))` — already-away workers are subtracted
- `deriveAvailableMobilityPools` subtracts `partyCompositionTotal(deriveCommittedMobilityPools(band))`
- `attachExpedition` enforces `EXPEDITION_ACTIVE_CAP`

So `sum(away) <= workingAdults - 2 <= population` **at the launch instant**. §6 Option A holds
there and only there; Option B is irrelevant because the launch is valid.

**The reachable route is that population falls afterwards.** `demography.ts`, `viability.ts` and
`demographicRenewal.ts` contain **zero** occurrences of "expedition" (case-insensitive), only
`expedition.ts` / `intraSeasonTrips.ts` / `pendingOperation.ts` write `band.expeditions`, and
`partyWorkers` is set once at creation (or as a literal `2` for the information families) and never
reduced. An annual demographic step or a fission transfer landing while a party is away therefore
drops the workforce below what is already committed. `bandMobility.ts:294-302` independently
corroborates this — it already handles "a pool that shrank while a party was away".

**Repair:** `reconcileExpeditionCommitment(band)` (pure; returns the same object when nothing is
overcommitted) shrinks the newest commitment first — array order *is* launch order because
`attachExpedition` appends — and declares a party `lost` below `EXPEDITION_MIN_PARTY_WORKERS = 2`,
reusing the existing terminal transition. It runs at the head of `expeditionDailyAction`, which
fires **every day**, so the repair stays inside `expedition.ts` with **no new import edge**.

`getBandCommitmentAccounting(band)` exports the invariant itself, returning physical population,
working adults, committed labour and dependents **separately** — §6 requires they not be
interchangeable — so audits assert the production predicate instead of a copy that can drift.

The `crowding.ts` clamp is **not** where this is fixed. It is now documented as defence-in-depth
and still refuses to shrink away sources, because proportionally shrinking an already-launched
party inside the read model would hide the defect rather than conserve people — §6 forbids exactly
that.

## F2 — The catchment comment was the confession

`getBandForagingDraw` divides a **contested physical catchment**, so it is an extraction-effort
term. Its own comment said it "Matches the adult-equivalent demand formula in
`carryingCapacity.derivePopulationDemand` so the shared division and the demand denominator are on
the same scale." Naming a quantity extraction effort while calibrating it to consumption demand is
the §9 conflation verbatim, and because `demo.workingAdults` is the full count it had a physical
consequence: a band with 3 of 9 adults away claimed the residential catchment as though all 9
foraged locally **while those same 3 removed stock at a different tile** through
`resolveExpeditionTargetWork`. One worker, two extractions.

The consumption side was *not* double-counted — provisions come from the party's carried cargo and
are subtracted from the receipt at return, never from a band store — so the repair is confined to
effort. **Option C selected.** §9's acceptance condition could not be proven because it was false.

Weights deliberately not retuned: **who** is counted changed, **how strongly** each person counts
did not. Fixture P22, identical demography: claim **127.02 → 109.62**, demand **25 → 25**.

## F3 — The inherited lifecycle FAIL was an instrument artifact, and it is now repaired

Daily (canonical, 14,400 samples) vs season boundary (160), same world and seed:

| | daily | seasonal |
| --- | --- | --- |
| operating party-days | **130** | **0** |
| returning party-days | **488** | **0** |
| task-camp days | **375** | **0** |
| concurrent parties seen | **true** | **false** |

Verdict **PASS, 0 failed checks**. `prepared` measures **0 days** — a phase-semantics fact
(committed at camp, not yet departed; launch and first step occur in the same daily action), not a
gap. `aborted` and `lost` are 0 naturally in 40 y of map1 and are proven by controlled fixture
instead of being marked successful on zero observations.

## F4 — §5 reproduced exactly

202 party-days, 123 beyond the residential radius, 0 ghosted, 0 missing; task camps 27, operating
16, returning 89. **No fixture definition was corrected and no total changed.**

## F5 — Natural occurrence, daily, map2:s1

| | 20 y | 50 y |
| --- | --- | --- |
| party-days | 854 | 2,011 |
| beyond `CROWDING_RADIUS` | 502 (58.8%) | 1,209 (60.1%) |
| task-camp days | 211 | 521 |
| prepared days | 0 | 0 |
| person-conservation failures | **0** | **0** |
| ghosted at home / represented nowhere | **0 / 0** | **0 / 0** |
| adverse verdicts | **0** | **0** |

## F6 — The same-day seam is structurally non-actionable, not merely unbuilt

**There is no within-day consumer of physical presence in production.** `runDailyActions` builds no
`TickContextCache`; every `buildTickContextCache` site is inside `runSeasonalCompatibilityTick`;
`intraSeasonTrips.ts` and `expedition.ts` reference `crowding` / `nearbyBand` / `TickContextCache`
**zero times**; and a same-day party never exists at a season boundary because it is created, acts
and returns inside one synchronous `applyTripDay`. A day-scoped ledger would be **empty at every
instant the only consumer runs**.

CORRECTION-34 is therefore **formally narrowed**: same-day presence is deferred to the future daily
mobility / party-overlap / encounter architecture. Same-day trips remain physically real. See
`SAME_DAY_PRESENCE_SEAM.md` for the missing consumer, why completed trip history cannot represent
current bodies, the exact future authority required, and the roadmap entry.

**This bounds the `4042210` repair too, and it is stated rather than hidden:** its 505 worker-days
were measured by a *daily probe*, while production reads presence only at boundaries — so the
multi-day fix moves production behaviour only when a party is still out when a boundary falls. The
repair is correct and retained; no claim is made that it moves behaviour on all 505.

## F7 — Evidence closure (supervisor scope amendment)

Same-day party **current-presence implementation** is formally removed from CORRECTION-34's
acceptance requirements, because the audit proved production has no within-day consumer capable of
reading such a ledger without a new daily shared-use authority. Same-day trips remain physically
real; no dead ledger was introduced; the seam is preserved in roadmap and handoff.

### F7.1 — The precise three-stage comparison

Daily, map2:s1, 6 years, 202 party-days:

| | ghosted at home | represented nowhere | at own position |
| --- | --- | --- | --- |
| BEFORE `5ebb5e98` | **505** | **505** | 0 |
| INTERMEDIATE `4042210` | 0 | 0 | **505** |
| AFTER tip | 0 | 0 | **505** |

Intermediate and after are identical here **because CORRECTION-34A did not touch the presence
authority** — that is the point of showing them separately.

Catchment, same run: claim sum **446,633.3 → 446,128.3**, reduction **exactly 505** across exactly
**202** band-days. The reduction equals the away-worker-days because the working-adult weight is
1.0; every other band-day is byte-identical, which is what shows the change is scoped to away
workers rather than a global recalibration.

Reconciliation, the constructed overcommit:

| | represented | population | conserved |
| --- | --- | --- | --- |
| BEFORE | 2 | 2 | true — but only by being blind to parties |
| INTERMEDIATE | **6** | 2 | **false** |
| AFTER | 2 | 2 | **true** (party declared `lost`) |

### F7.2 — Performance and boundedness

| | 20 y | 50 y |
| --- | --- | --- |
| elapsed | 6,208 ms | 14,844 ms |
| ms per simulated day | 0.86 | 0.82 |
| state size | **73.33 MB** | **74.40 MB** |
| max presence sources per band | 3 | 3 |
| max contributors per tile | 2 | 2 |
| max active parties per band | 2 | 2 |
| max trip records per band | 24 | 24 |
| max outcome records per band | 6 | 6 |
| stale terminal presence entries | **0** | **0** |
| person-conservation failures | **0** | **0** |
| duplicate expedition receipts | **0** | **0** |
| ephemeral daily presence entries | 0 | 0 (none exist) |

State grows **1.07 MB between 20 and 50 years** while every cap holds: 3 presence sources = 1
residential + `EXPEDITION_ACTIVE_CAP`, 24 = `RECENT_TRIP_RECORD_CAP`, 6 = `EXPEDITION_OUTCOME_CAP`.
Per-day cost is flat (0.86 → 0.82 ms), so nothing scales with elapsed time.

### F7.3 — Closure fixtures

12 fixtures: **0 unexpected, 0 not-constructed, 5 deferred by formal scope reduction.**

`P11` MONOTONE_AND_BOUNDED · `P13` BOTH_CONTRIBUTE_AND_EACH_BAND_CONSERVED · `P21`
NO_UNIT_APPEARS_TWICE · `P23` BODIES_LEAVE_IMMEDIATELY_MEMORY_IS_SEPARATE · `P24`
PHYSICAL_PRESENCE_ALONE_CREATES_NO_ENCOUNTER · `P26`
PRESENCE_IS_ORDER_INDEPENDENT_BY_CONSTRUCTION · `P28` BOUNDED_NO_GHOSTS_NO_LEAKS.

`P15`–`P19` report **DEFERRED_BY_FORMAL_SCOPE_REDUCTION**, not vacuous passes, each carrying the
four required proofs: no current consumer exists; completed records create no presence (24 trip
records + 1 terminal expedition record → 0 away sources, represented = population); no dead ledger
introduced; the future architecture is named.

### F7.3b — P27 covers all four step modes, not two

`stepModeInvarianceAudit` proves **daily == seasonal** with a full canonical-state match on both
maps. P27 asks for daily, weekly, monthly *and* seasonal, so a four-way audit was added
(`stepModeFourWayAudit.mjs`, `step-mode-four-way.json`):

| mode | steps | tick reached | matches daily |
| --- | --- | --- | --- |
| daily | 1,890 | 21 | — (reference) |
| weekly | 270 | 21 | **true** |
| monthly | 63 | 21 | **true** |
| seasonal | 21 | 21 | **true** |

All four produce a **byte-identical** canonical projection (3,945 bytes each) over the identical
630-day-multiple span. The projection is deliberately broad — band position, status, viability,
full demography, every expedition's phase/workers/position/route index/provisions/harvest, terminal
outcome ids, trip-record count, seasonal-receipt period, depletion key count — because
CORRECTION-16's admissibility rule forbids calling a narrow fingerprint "canonical state".

This makes "the four modes are batch sizes over one daily kernel" a measured fact rather than a
claim read off the call graph.

### F7.4 — Two instrument errors in this pass's own probes, caught and recorded

The first closure run reported **1,420 duplicate expedition receipts at 20 years and 3,136 at 50**.
That was the probe, not production: `recentIntraSeasonTrips` is a retained 24-slot ring, so the
same receipt is legitimately visible on every day it stays in the ring, and the probe accumulated
keys **across days**. It was counting retention, not duplication. Corrected to test uniqueness
**within one band's ring at one instant**, which is the actual question — result **0 at both
horizons**. The pre-correction numbers are recorded here rather than quietly dropped.

**(2) The four-way step-mode probe first reported `DIVERGENT`.** `stepSim(world, steps, mode)`
advances `steps` units *of that mode*, not days, so passing the same step count to all four
compared **24 days against 24 seasons** — ticks 0 / 1 / 8 / 24. It was measuring its own unequal
spans, not production. Corrected to equalise simulated days over a multiple of 630 (the LCM of the
four mode lengths), all four modes are byte-identical. The false `DIVERGENT` is recorded because a
reader who saw only the final result would not know the probe had ever been wrong.

### F7.5 — `getBandPhysicalPresence` documentation corrected

The first CORRECTION-34A comment claimed conservation "holds on every band-day", which overclaims.
The function is **not self-conserving**: its sum equals `population` only for *valid canonical
expedition state*. Validity is maintained upstream by the daily reconciliation, which covers every
band-day the daily kernel produces — but **not** a band object assembled directly by a test,
fixture or future caller that never ran a day. Such a band will be rendered as overcommitted rather
than disguised. The comment now says exactly that, and points callers needing the guarantee at
`getBandCommitmentAccounting(band).conserved`.

## F8 — What is not claimed

- No outcome improvement. Nothing here argues the simulation is better, only that it is truthful.
- The **magnitudes** are untested: `0.12` carry units, the `0.65`/`0.85` catchment weights (now
  correctly *scoped*, still inherited), the 24-day cap and the provisions constant.
- One map and one seed underlie each measurement set (map1 for the lifecycle audit, map2:s1 for the
  natural sweeps). No matrix was run.
- Fixtures P11/P13/P19/P23/P24/P26/P27/P28 were **not built**; no before/intermediate arms were
  re-run; no performance or state-size measurement was taken.

---

# CORRECTION-34 — FINDINGS (superseded above)

**SHARED RANGE — RESIDENTIAL AND AWAY-PARTY PHYSICAL-PRESENCE AUTHORITY**

Branch `checkpoint/shared-use-physical-presence-authority-34` from the accepted and frozen
CORRECTION-33 tip `5ebb5e9887e36341f69350d4d3cff85f9493457c`. `main` untouched at `0a43083a`.
**PRODUCTION BEHAVIOUR CHANGED.** **ROADMAP ITEM 3 REMAINS OPEN.**

## VERDICT: PROGRESS

The production repair is sound and proven for multi-day expeditions. The checkpoint's **own
acceptance bar is not met**: the §19 evidence package is materially incomplete (no natural-occurrence
runs, no `resource-accounting.json`, no `performance.json`, no `before-after.json`), same-day party
presence is deferred, and the catchment double-draw is measured but unrepaired. Reporting PASS on
that basis would be exactly the "unsupported claim" the verdict rules forbid.

## 1. Where people were represented before

Everywhere the band was — and only there. `buildCrowdingField` scattered
`demography.population` from `band.position`, and nothing scattered from
`expedition.positionTileId`.

## 2. Who was duplicated or missing

The same people, both at once. Daily, map2:s1 over 6 years:

| | before | after |
| --- | --- | --- |
| party-days observed | 202 | 202 (identical — no expedition behaviour changed) |
| party-days beyond `CROWDING_RADIUS` from home | 123 (**60.9%**) | 123 |
| away-worker-days represented **nowhere** | **505** | **0** |
| away-worker-days **ghosted at home** | **505** | **0** |
| away-worker-days at their own position | 0 | **505** |

Natural at 20 years, 4 runs: **452 away-worker-seasons still weighted at home.**

## 3. How presence works now

`getBandPhysicalPresence(band)` returns the residential remainder at `band.position` plus one
bounded body group per physically-away party at its own `positionTileId`. People are conserved
exactly — asserted every band-day, **0 failures**. Both crowding paths iterate it, so field/scan
parity holds (`P8 = FIELD_SCAN_PARITY`).

A 2-worker party from a 22-person band leaves a remainder of 20 and reads `weightedCrowding 0.02`
at its own tile for a foreign observer — **party scale, not band scale**.

## 4–6. Same-day parties, expeditions, task camps

Same-day parties are **deferred** (Option E, named as the seam): they exist and return inside one
day and production keeps no simultaneous daily snapshot. Their harvest and depletion are untouched.
Completed trip records cannot become presence — `getBandPhysicalPresence` contains no reference to
`recentIntraSeasonTrips`, which makes that structural rather than tested.

Expeditions follow phase truth, not phase names: `prepared` is still at home (`types.ts:933`), and
measures **0 days** — it never survives to a day boundary. Terminal phases hold no body. Task camps
keep presence tied to the expedition: **27 task-camp days** observed.

## 7–8. Catchment and resources

**The catchment was NOT modified.** `getBandForagingDraw` still uses full `demography.workingAdults`,
so away workers keep drawing the residential catchment while also consuming provisions and
harvesting at the target — **226 band-seasons**. §11.7 forbids rewriting it without a food-pipeline
proof that this is duplication rather than legitimate central-place organisation. **This is the
named next seam, and it is why away workers remain duplicated in the ECOLOGICAL sense even though
they are no longer duplicated PHYSICALLY.**

`resource-accounting.json` (P21) was not produced. Depletion, receipts and cargo conservation are
**not** verified before/after in this pass.

## 9–10. Social separation

No encounter, friction or access authority reads the new presence set. Parties create **zero**
social consequence in either arm — co-presence is exposed, perception is not invented (§12.2). A
band never reads its own party as foreign crowding (**0 cases**). The CORRECTION-31 ghost-caution
separation is untouched.

## 12. Suspicious findings and limitations

- **A measurement confound in this pass's own first probe.** Seasonal sampling measured **0**
  parties beyond `CROWDING_RADIUS` and **0** task-camp days. Daily sampling measures 60.9% and 27.
  Physical presence is a daily fact; measuring it at a season boundary hides it entirely.
- **The inherited `expeditionLifecycleAudit` failure is an INSTRUMENT ARTIFACT, not a production
  defect.** It steps `stepSim(world, 1, "seasonal")`, so it samples once per season while
  expeditions launch, operate and return *within* one — making `operating`, `returning` and
  `taskCamp` structurally invisible to it. It still reports
  `sawOperating/sawReturning/sawTaskCamp: false` and `verdict: FAIL`, while a daily probe on the
  same default world sees operating 16, returning 89 and task-camp 27 days.
  **Classification: inherited failure, now DIAGNOSED as an audit sampling defect. Not repaired here**
  (repairing it is an audit change with its own evidence burden).
- Fixtures P6, P7, P11, P13, P19, P20, P21, P23, P24 and P26 were **not built**. P8/P9/P18 report
  **VACUOUS** — no terminal records or concurrent parties occurred in the sampled window.
- No natural-occurrence 20y/50y run, no performance measurement, no long-horizon lifecycle sweep.
- Party footprint keeps `CROWDING_RADIUS = 4`; scale is handled by the population weight only. A
  dedicated smaller party radius was considered and rejected as a new constant, but is **not**
  proven to be the right choice.

## 13. What must be decided next

Whether to authorize (a) the catchment draw repair, (b) the Option-E daily same-day presence ledger,
(c) repairing `expeditionLifecycleAudit`'s sampling, or (d) completing this checkpoint's evidence
package before any of them.

## 14. Validation

PASSED: `tsc` (both), `npm run build`, graph 221/764 0 dup 0 dangling, import boundary (85,
unchanged), season-order invariance, step-mode invariance with `fullCanonicalStateMatch: true` and
`firstDivergence: null`, catchment invariants, food pipeline, mobility authority, socialCausality,
CORRECTION-28 fixtures 12/12 including **P8 FIELD_SCAN_PARITY**.

FAILING: `expeditionLifecycleAudit` — inherited, now diagnosed as an audit sampling artifact (above).

NOT RUN: natural occurrence, performance, resource accounting.

---

# CORRECTION-34B — partial reconciliation consistency and numeric resource proof

## G1 — The split authority was real, and reproduced before any change

CORRECTION-34A reduced `partyWorkers` and left everything derived from it stale. Measured at
`fd868d6` on a six-worker party whose workforce fell to five while staying above the minimum:
**`PARTIAL RECONCILIATION SPLIT AUTHORITY`**, four failing checks. Composition stayed 6 while
workers read 5; `deriveCommittedMobilityPools` stayed 6 while `getCommittedExpeditionWorkers` read
5; the carry ceiling stayed at capacity-for-six; the pace factor kept the six-person composition;
and **residential effort adults read −1** — the catchment believed more adults were away than the
band had.

The existing P10 fixture missed it because it drove the party below the minimum and lost the whole
party, so the partial path was never exercised. Full table in `PARTIAL_RECONCILIATION_AUDIT.md`.

## G2 — Option B, with a rule that forbids capability gain

Workers, composition, ceiling and cargo now move together in one authority. Members are removed
**high → typical → limited**, because `derivePartyPaceFactor = 1 + (high*0.15 − limited*0.20)/total`
means dropping `limited` members would make a party that just lost people move *faster*. Measured
pace `0.9917 → 0.96`. Cargo above the reduced ceiling is abandoned: **0.648 → 0.6 harvest + 0.048
lost, sum invariant**. Capacity is wrapped in `Math.min` so it can never rise.

Option C (upstream demographic ownership of away workers) is recorded as **architecturally
superior and deferred, not refuted**. Option D was rejected because turning a party for home
requires the band to know something it has no channel to learn.

## G3 — `prepared` people are no longer declared lost

One new outcome reason, `commitment_unsupported`, introduced only because every existing reason
describes something that happened on a journey and a `prepared` party has none. A prepared party
that cannot be staffed is `aborted` at camp; only physically away parties below the minimum are
`lost`.

## G4 — Fixtures R1–R12: 12/12, 0 vacuous, 0 failing

An authoring error in R5 is recorded: its first version gave two four-worker parties the six-worker
default ceiling, so the untouched party was inconsistent before reconciliation ran.

## G5 — Numeric resource chain: `NUMERIC_RESOURCE_CHAIN_RECONCILED`

One real completed expedition, driven daily on map2:s1:

```
takenAtTarget_usableSupport = 0.0083     (support units)
cargo.harvestUnits          = 0.0757     (cargo units — a DIFFERENT quantity)
carryCapacityUnits          = 0.6
carried = min(harvest, capacity) = 0.0757
afterProvisions = max(0, carried - 0.038) = 0.0377
deliveredFraction = clamp01(0.0377 / 0.0083) = 1
delivered = 0.0083 = receipt usableSupport    IDENTITY HOLDS
```

**Provisions are classified as a trip-local accounting abstraction, and full material conservation
is explicitly NOT claimed for them.** No residential store is decremented at launch;
`consumeProvisions` only increments a counter; the constant's own header says "never a store". What
*is* conserved is the cargo chain. Backing provisions with a real store belongs to the Adaptation /
Material Culture pass.

## G6 — Natural occurrence is an explicit NULL

20 y: 64,800 band-days, **all no-op**. 50 y: 162,000 band-days, **all no-op**. Zero partial
reductions, zero mismatches of any kind, zero conservation failures, zero duplicate receipts.
**Partial reconciliation never occurs naturally in this world**, so the natural sweep proves nothing
about partial-reduction correctness — the controlled fixtures are the proof, exactly as review
warned.

## G7 — Three instrument errors in this pass's own probes, all recorded

1. **R5 fixture** built two four-worker parties with a six-worker ceiling (above).
2. **Numeric chain, first attempt:** used peak cargo as "taken at target". `cargo.harvestUnits` and
   `physicalFoodHarvest.usableSupport` are different quantities in different units; conflating them
   made the identity fail.
3. **Numeric chain, second attempt:** used *peak* cargo and capacity as the sample point. Cargo is
   not monotonic — a party can abandon load on the way home — so the correct sample is the **last
   away-phase day**. Both wrong readings are kept in the record.

## G8 — Documentation contradiction removed

`crowding.ts` previously said both "it CONSERVES PEOPLE" and "this read model is NOT
self-conserving". It now says one thing in all three places: the read model **reports** canonical
expedition state; conservation depends on that state being valid, which
`reconcileExpeditionCommitment` maintains upstream; and the read model never silently resizes a
party. The JSDoc no longer claims unconditionally that `sum(people)` equals `population`.
