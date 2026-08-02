# `expeditionLifecycleAudit` — instrument correction

**Outcome: the long-inherited FAIL was an INSTRUMENT ARTIFACT, not a production defect. Repaired.
The daily arm is canonical and now returns PASS with 0 failed checks.**

---

## 1. The defect in the instrument

The audit stepped the world one **season** at a time and observed only at the boundary:

```js
world = runner.stepSim(world, 1, "seasonal");   // 160 samples over 40 years
```

An expedition's entire lifecycle is bounded by `EXPEDITION_MAX_DURATION_DAYS = 24` inside a
90-day season. A party therefore launches, walks, works and returns **between** two boundaries.
`operating`, `returning` and `taskCamp` were structurally unobservable, and the audit reported

```
sawOperating: false, sawReturning: false, sawTaskCamp: false  ->  verdict FAIL
```

That FAIL was carried forward and re-reported as an inherited production failure by
CORRECTION-23G/H/J, CORRECTION-24A, CORRECTION-26 and CORRECTION-32 without being diagnosed.
CORRECTION-34 diagnosed it but did not repair it. CORRECTION-34A repairs it.

## 2. The repair

`runLifecycleArm(runner, expeditionMod, sampling, years)` runs the identical observation body under
two samplings on the same world and seed:

| Arm | Step | Samples over 40 y | Role |
| --- | --- | --- | --- |
| `daily` | `stepSim(world, 1, "daily")` | 14,400 | **CANONICAL** — the verdict comes from here |
| `seasonal` | `stepSim(world, 1, "seasonal")` | 160 | counter-example, retained deliberately |

Both outputs are explicit (`--out`, `--boundary-out`) and both default to `""` = print only,
write nothing — so this audit can never silently overwrite frozen evidence, which is the trap
CORRECTION-32A recorded happening twice.

## 3. What the two samplings see — same world, same seed

| Observation | Daily (canonical) | Season boundary |
| --- | --- | --- |
| samples | 14,400 | 160 |
| `operating` party-days | **130** | **0** |
| `returning` party-days | **488** | **0** |
| task-camp days | **375** | **0** |
| `outbound` party-days | 504 | (see note) |
| `sawOperating` | true | **false** |
| `sawReturning` | true | **false** |
| `sawTaskCamp` | true | **false** |
| `sawConcurrentParties` | true | **false** |

Boundary sampling sees **zero** of the three phases it was asserting on. This is the whole
explanation of the inherited failure.

## 4. Canonical daily result — 40 years, map1

```
verdict: PASS          failed checks: (none)
launched: 161          completed: 161      aborted: 0     lost: 0
phaseDays: prepared 0, outbound 504, operating 130, returning 488
taskCampDays: 375
personConservationViolations: 0
laborOverCommitViolations: 0
positionOffRouteViolations: 0
receiptsBeforeReturn: 0
sawConcurrentParties: true
```

New checks added by CORRECTION-34A:

- `personConserved` — asserts `getBandCommitmentAccounting(band).conserved` on **every sampled
  band-day**. This is the production predicate itself, not a re-implementation. 0 violations.
- `operatingObservedNonVacuously`, `returningObservedNonVacuously`,
  `taskCampObservedNonVacuously` — each requires a **positive count**, so these phases can never
  again be recorded as passing on zero observations.

## 5. What is proven naturally, and what still needs a fixture

| Phase / condition | Natural daily observation | Status |
| --- | --- | --- |
| `outbound` | 504 party-days | proven naturally |
| `operating` | 130 party-days | proven naturally |
| `returning` | 488 party-days | proven naturally |
| task camp | 375 days | proven naturally |
| `completed` | 161 | proven naturally |
| **two concurrent parties** | `sawConcurrentParties: true` | **proven naturally** |
| `prepared` | **0 days** | needs a fixture — see below |
| `aborted` | **0** | needs a fixture |
| `lost` | **0** | needs a fixture |

`prepared` measuring 0 is a **phase-semantics fact, not a gap**: `prepared` means "labor committed
at camp, not yet departed" (`types.ts:933`), and the launch and the first outbound step occur
inside the same daily action, so the phase never survives to any observation point. It is reported
as a measured 0 with a stated cause rather than as an unobserved phase.

`aborted` and `lost` are real terminal transitions with real raise sites (`expedition.ts:873`
declares `lost` past the hard deadline; `reconcileExpeditionCommitment` now also declares `lost`
when a band can no longer staff a party). They do not occur in 40 years of map1, so per §11 they
are proven by controlled fixture rather than marked successful on zero observations.

## 6. What this correction does NOT claim

- It does not claim the expedition lifecycle changed. Production phase behaviour is unchanged by
  this repair; only the observation cadence changed.
- It does not claim `aborted`/`lost` are unreachable — it claims they are *not naturally reached
  on map1 in 40 years*, which is a measured zero, not an absence of evidence.
- The daily arm runs on map1 with seed `expedition-lifecycle`. It is one world, not a matrix.
