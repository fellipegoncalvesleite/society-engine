# CORRECTION-34 — FINDINGS

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
