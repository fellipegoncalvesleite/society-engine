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

## F7 — What is not claimed

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
