# Partial expedition reconciliation — split authority, reproduced and repaired

CORRECTION-34B. Supervising review of CORRECTION-34A found one untested reachable inconsistency in
`reconcileExpeditionCommitment`. It was real. This documents the measurement, the design decision,
the repair and its limits.

---

## 1. What review found

CORRECTION-34A reduced `partyWorkers` when the workforce fell below what was committed, and left
every quantity **derived** from it stale. The existing fixture (P10) missed it because it drove the
party below `EXPEDITION_MIN_PARTY_WORKERS` and declared the whole party lost — the partial path was
never exercised.

## 2. The measurement, taken before any production change

Controlled construction: `partyWorkers = 6`, `partyComposition` total 6 `{limited:1, typical:4,
high:1}`, cargo at 90% of capacity-for-six, workforce falls to 5, party stays above the minimum.

**Headline at `fd868d6`: `PARTIAL RECONCILIATION SPLIT AUTHORITY`.**

| quantity | before | 34A after | 34B after |
| --- | --- | --- | --- |
| `partyWorkers` | 6 | **5** | **5** |
| `partyCompositionTotal` | 6 | **6** ← stale | **5** |
| `getCommittedExpeditionWorkers` | 6 | 5 | 5 |
| `partyCompositionTotal(deriveCommittedMobilityPools)` | 6 | **6** ← stale | **5** |
| physical away people | 6 | 5 | 5 |
| residential physical people | 9 | 10 | 10 |
| represented population | 15 | 15 | 15 |
| `carryCapacityUnits` | 0.72 | **0.72** ← stale | **0.6** |
| capacity justified by current workers | 0.72 | 0.6 | 0.6 |
| `harvestUnits` | 0.648 | 0.648 | **0.6** |
| `lostUnits` | 0 | 0 | **0.048** |
| load ratio | 0.9 | 0.9 | 1.0 |
| party pace factor | 0.9917 | **0.9917** ← stale | **0.96** |
| next-day provisions | 0.0048 | 0.004 | 0.004 |
| **residential effort adults** | — | **−1** | **0** |

Failing checks at 34A: `partyWorkersEqualsCompositionTotal`, `committedTotalsAgree`,
`capacityMatchesCurrentWorkers`, `catchmentAgreesWithCommittedWorkers`. At 34B: **none**.

**The worst reading is `effortAdults: −1`** — the residential catchment believed *more* adults were
away than the band had working adults, i.e. a negative local extraction effort.

One honest detail: the catchment *draw value* read 32.085 in both arms, because
`Math.max(0, workingAdults - committed)` clamps −1 to 0. The clamp masked the defect in the output
while the underlying committed count was wrong. This is why the audit reports `effortAdults`
separately instead of trusting the draw.

## 3. Design decision — Option B, one authority

| Option | Decision |
| --- | --- |
| A — whole-party cancellation only | **Rejected.** Disproportionate: a band losing one adult would destroy a six-person party, its cargo and its information. |
| **B — canonical deterministic partial reconciliation** | **SELECTED.** Workers, composition, ceiling and cargo move together in one function. |
| C — protect away commitments upstream | **Rejected for this checkpoint, recorded as architecturally superior.** It requires demography/fission to own away-worker accounting; that is a demographic-ownership change well beyond a presence correction. |
| D — return/abort instead of resizing | **Rejected.** Turning a party for home requires the residential band to *know* something it has no channel to learn; CORRECTION-30 established there is no communication authority. |
| E — another design | Not required. |

### The aggregate-model limit, stated not hidden

The simulator has cohorts, not people. A workforce decline while a party is away **cannot** reveal
whether the people lost were at camp, in the party, aged out, transferred by fission or dead.
Nothing here pretends otherwise. What follows is a deterministic accounting convention, not a claim
about individuals.

### The rule that decides who leaves

**Reconciliation may never IMPROVE a party's capability.** Members are removed **high → typical →
limited**, because

```
derivePartyPaceFactor = 1 + (high*0.15 - limited*0.20) / total
```

Dropping `limited` members would make a party that just lost people move **faster** — a capability
granted by a loss. Removing from `high` first makes pace monotonically non-increasing. Measured:
`{1,4,1}` → `{1,4,0}`, pace `0.9917 → 0.96`.

## 4. Carrying and cargo

The ceiling is recomputed from the reduced party, wrapped in `Math.min` with the previous ceiling so
reconciliation can never raise it. Harvest above the new ceiling is abandoned into `lostUnits` —
fewer hands cannot carry what more hands could.

**Conservation: `harvest + lost` is invariant.** Measured 0.648 → 0.6 + 0.048 = 0.648.

No container, pack or basket is granted. The ceiling remains bare bodily carrying scaled only by the
band's own learned practice through `deriveCarryCapacityUnits`, per the Default Expedition Carrying
Rule. Outbound provisioning capacity and transport technology remain future Adaptation / Material
Culture work.

## 5. Phase-appropriate termination

`prepared` means labour committed **at camp, not yet departed**. Those people never left, so
`party_lost` would invent a death. One new outcome reason is introduced, and only because every
existing reason describes something that happened *on a journey* while a prepared party has none:

```
commitment_unsupported  — the band could no longer staff a commitment the party had not yet departed on
```

- `prepared` below the minimum → phase `aborted`, reason `commitment_unsupported`, no body lost
  (the people are already inside the residential remainder).
- `outbound` / `operating` / `returning` below the minimum → phase `lost`, reason `party_lost`, the
  existing terminal transition: no cargo and no information reach camp.
- All four phases, above the minimum → partial reduction; phase, route and position untouched.

## 6. Fixtures R1–R12 — 12/12, 0 vacuous, 0 failing

`R1` byte-identical same object · `R2` all authorities agree · `R3` cargo reconciled at scale
(8→4) · `R4` away party terminal, no body · `R5` newest reduced first, deterministic · `R6`
cancelled at camp, **not** declared lost · `R7` phase and route preserved · `R8` capacity and cargo
reconcile numerically · `R9` no cargo created · `R10` party does not regrow · `R11` terminal records
commit nothing · `R12` legacy fallback consistent.

**An authoring error in R5 is recorded rather than hidden:** its first version gave two four-worker
parties the six-worker default ceiling, so the *untouched* party was inconsistent before
reconciliation ran and the strict predicate correctly flagged it. The reconciliation itself was
right in that run (newest 4→2, oldest untouched, committed 6 = workforce 6).

## 7. Natural occurrence — an explicit null

| | 20 y | 50 y |
| --- | --- | --- |
| band-days observed | 64,800 | 162,000 |
| reconciliation checks | 64,800 | 162,000 |
| **no-op reconciliations** | **64,800** | **162,000** |
| partial party reductions | **0** | **0** |
| whole-party cancellations/losses | 0 | 0 |
| prepared cancellations | 0 | 0 |
| cargo abandoned by reconciliation | 0 | 0 |
| composition/worker mismatches | **0** | **0** |
| carry-capacity mismatches | **0** | **0** |
| catchment/worker mismatches | **0** | **0** |
| person-conservation failures | **0** | **0** |
| duplicate receipts | **0** | **0** |

**Partial reconciliation never occurs naturally in this world.** Stated plainly: the natural sweep
is a NULL result and proves nothing about partial-reduction correctness. **Controlled fixtures
R1–R12 are the proof.** The sweep shows only that the repair introduces no disagreement in ordinary
play — which is exactly the trap review warned about ("do not treat zero natural failures as proof
against this defect").

## 8. Limits

- The removal convention (high → typical → limited) is a **deterministic accounting rule chosen for
  monotonicity**, not an anthropological claim about which people a band loses.
- Option C remains architecturally preferable and is deferred, not refuted.
- Reconciliation is one-way: a party does not regrow when the cohort recovers (R10). That is
  deliberate — people do not walk back to a distant party because the census improved.
- One map and seed underlie the natural sweep.

---

## CORRECTION-34C amendment — the trigger moved from labour to bodies

This document's fixtures were built around the `workingAdults` trigger. CORRECTION-34C establishes
that a working-adult fall is **not** grounds to resize a party: it is a labour reclassification and
can occur through ordinary aging with population untouched.

R1–R12 were therefore re-pointed at the **population** trigger and re-run: **12/12, 0 vacuous**,
`PARTIAL RECONCILIATION CONSISTENT`. Everything they establish about partial reduction — workers,
composition, ceiling, cargo and pace moving together, high→typical→limited removal, `harvest+lost`
invariant, phase-appropriate termination — is unchanged and still holds. Only the circumstance that
*causes* a reduction is narrower, and correctly so.

The obsolete assertion `committed <= workingAdults` is retained as a labelled observation rather
than deleted, so the semantic change is visible in the evidence.
