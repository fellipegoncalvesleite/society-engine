# Away-body, demographic cohort and fission ownership

> **SUPERSEDED IN PART BY CORRECTION-34D.** `partyWorkers` is no longer the physical headcount. It is PRODUCTIVE LABOUR; bodies are `partyWorkers + nonWorkingPartyPeople`. Every statement below that reads `partyWorkers` as a count of people is true only of a party whose members are all still working — which is every party at launch, and every party in these worlds naturally. **L10's verdict is corrected**: a party that silently lost three people while staying `operating` with a null outcome reason was accepted here as an explicit outcome; it was not, and the record is now retired whole under `invalid_state_repaired`. **L12 did not prove what its name claims** — it counted expedition records 1,260 days into a natural world, where a 24-day party cannot still be walking at an annual boundary; CORRECTION-34D H12 constructs that case. **The fission bound changed**: it used `deriveCommittedMobilityPools`, which counts `prepared` parties standing in the camp, and now uses physically-away people plus a separately named prepared-commitment rule.
> See `PARTY_HEADCOUNT_LABOR_AUTHORITY.md`.

CORRECTION-34C. Supervising review found that CORRECTION-34B made the party's internal authorities
agree while still letting a **demographic cohort change move a body without a journey**. It was
real. This documents the reproduction, the repair, and one precision correction to the finding.

---

## 1. What 34B fixed, and why it was still wrong

34B made `partyWorkers`, `partyComposition`, committed mobility pools, catchment effort, carry
capacity and cargo all move together. That is internal consistency. It says nothing about whether
the *reason* for moving them was physical.

The reconciler bounded the party by `demography.workingAdults`. That is a **labour
classification**, and it falls for reasons that move nobody — most plainly ordinary aging, which
`demography.ts:2532-2537` performs as:

```ts
adults  -= adultsAged;
elders  += adultsAged;      // population untouched
```

So a cohort reclassification became permission to delete a body from a distant party, and the
residential remainder absorbed it. Arithmetic conservation, physical teleportation.

## 2. Reproduction — T1, measured against `c207d8a` before any change

**Headline: `COHORT AGING TELEPORTS AWAY BODY`. One person relocated with no physical event.**

| | population | workingAdults | elders | residential | away | partyWorkers |
| --- | --- | --- | --- | --- | --- | --- |
| before aging | 20 | 6 | 6 | 14 | 6 | 6 |
| after aging, before reconciliation | 20 | 5 | 7 | 14 | 6 | 6 |
| **after 34B reconciliation** | 20 | 5 | 7 | **15** | **5** | **5** |
| **after 34C reconciliation** | 20 | 5 | 7 | **14** | **6** | **6** |

`physicalEventJustifyingLocationChange: null`. No route, return, communication, death or transfer.

### A precision correction to the finding

The finding illustrated this with *population 20 / workingAdults 10 → 9 / party 6*. **That case
does not trigger the reconciler at all** — it fires only when committed > workforce, and 6 ≤ 9. It
is reported in the evidence as a **true negative**.

The mechanism is real; the illustrative arithmetic was not the triggering case. The reachable path
is a workforce that has *already* declined to the party size — which is precisely the
CORRECTION-34A scenario, since `deriveDepartableWorkers` caps a launch at `workingAdults/3`, so a
party of 6 launches at `workingAdults >= 18` and the workforce then falls. The fixture starts at
that already-declined state.

## 3. T2 — the model does not know where a death happened

`doesTheArchitectureKnowWhereTheDeathOccurred: false`. Deaths are an aggregate net-rate quantity
with no location field; `demography.ts`, `viability.ts` and `demographicRenewal.ts` contain **zero**
expedition references; no death record carries a tile, a party id, or an at-camp/away flag.

The party *can* be resized, but nothing places the death inside it. Resizing on that evidence is an
assumption, not a derivation — which is exactly why the bound moved off `workingAdults`.

## 4. T3 — fission could draw founders who are not at camp

`getDaughterPopulation(parentPopulationBefore)` reads **total** parent population, and
`createDaughterBand` contained **zero** expedition references. Founders could therefore include
people standing on an expedition route or at its target — people who cannot walk out of a camp they
are not in. Separately, the parent's cohort recomputation could drop `workingAdults` beneath its own
committed party and let the next day's reconciler delete those bodies.

## 5. The architecture chosen — Option A, minimal

| Option | Decision |
| --- | --- |
| **A — protect away people upstream** | **SELECTED, in its minimal form.** Fission draws only from physically residential people; cohort reclassification never touches a party. |
| B — separate party people from party workers as new state | **Rejected for this checkpoint.** The distinction is real and is now *expressed* (headcount is bounded by population, labour by `workingAdults`), but adding a party-cohort model is Item 4 scope. |
| C — suspend cohort/fission operations while parties are away | **Rejected.** Coarse, and it would freeze demography because one small party exists — a hidden behavioural artifact. |
| D — allocate demographic change by location | **Rejected for now.** It needs party age cohorts, i.e. individual-ish structure this checkpoint must not invent. |

### What now owns what

```
physical party headcount   → bounded by demography.population (bodies)
productive working-adult labour → getResidentialWorkingAdults (workingAdults − committed, clamped at 0)
demographic cohort identity → demography.ts, and it changes classification ONLY
party mobility-role composition → bandMobility, a capability classification
```

**A person becoming an elder does not teleport.** They are now an elder who happens to be on an
expedition.

## 6. The three production changes

1. **`reconcileExpeditionCommitment` bounds on `population`, not `workingAdults`** (`expedition.ts`).
   Only the band genuinely not having the people can make a body impossible.
2. **`createDaughterBand` caps the daughter by residential availability** (`demography.ts`):
   `min(getDaughterPopulation(total), population − awayPartyPeople)`, blocked below
   `DAUGHTER_MIN_POPULATION`. The away headcount comes from `bandMobility`, a leaf, and is the same
   authority `deriveAvailableMobilityPools` and the catchment effort term already use.
3. **`getBandForagingDraw` removes the aged-away overflow from elders** (`sharedCatchment.ts`).
   Subtracting the away headcount from adults alone would leave an away person who had aged
   counted in `elders`, contributing 0.85 of *local* extraction effort from an expedition tile.
   Dependents are never reduced — a party is not staffed from them.

`getBandCommitmentAccounting.conserved` now tests bodies (`committed <= population`) and reports
`awayHeadcountExceedsWorkingAdults` separately, because that condition is **legitimate**, not a
conservation failure.

## 7. What the reconciler now means

With a population bound it cannot fire on ordinary demography. It is a **defensive repair for
corrupted or legacy state**, not a demographic response, and it deliberately claims no physical
mechanism — when it fires, something upstream is already wrong. Party-local loss comes from
party-local physical outcomes (hard deadline, injury-forced return, provisions exhausted) and is
never inferred from cohort aging.

## 8. Fixtures L1–L12 — 12/12, 0 vacuous, 0 failing

`L1` no body changed tile · `L2` maturation does not touch the party · `L3` death changes residence
not the party · `L4` party-local outcome owns the loss · `L5` at-camp commitment moves nobody ·
`L6` daughter from residential people, party unchanged · `L7` **blocked rather than borrowing away
bodies** (population 60, 48 away, uncapped draw 20 > 12 at camp) · `L8` return reconciles once ·
`L9` both parties conserved across annual demography · `L10` explicit outcome + stated model limit ·
`L11` deterministic defensive repair, no invented history · `L12` identical across all four step
modes with expedition records present.

**An authoring error in L10 is recorded:** it first asserted `phase === "lost"`, but reducing 6 to 3
stays above the minimum, so a partial reduction is the correct explicit outcome. The assertion was
wrong, not production.

## 9. Natural occurrence

| | 20 y | 50 y |
| --- | --- | --- |
| band-days observed | 64,800 | 162,000 |
| annual boundaries crossed by active parties | **0** | **0** |
| adult→elder / dependent→adult while party active | 0 / 0 | 0 / 0 |
| deaths / fissions while party active | 0 / 0 | 0 / 0 |
| headcount changes by **physical return** | **302** | **720** |
| headcount changes by **reconciliation** | **0** | **0** |
| away-body changes without a physical event | **0** | **0** |
| population / cohort conservation failures | 0 / 0 | 0 / 0 |

**Ordinary parties last at most 24 days while demography runs annually, so natural overlap does not
occur in these worlds. A zero here is NOT proof of correctness** — the controlled fixtures are the
proof, and they were built regardless of natural frequency.

**An instrument error is recorded:** the first version of this probe classified every ordinary
physical return as a reconciliation, reporting 302 "unexplained" movements at 20 y while
`annualBoundariesCrossedByActiveParties` was 0 — a self-contradiction that exposed the bug. A
terminal party is pruned out of `band.expeditions` into `recentExpeditionOutcomes`; both stores are
consulted now.

## 10. What remains for Roadmap Item 4 and beyond

- **Item 4 — Dynamic Fission / Daughter Viability / Successor Groups.** This checkpoint set only the
  ownership boundary: a daughter is founded from people who are physically at the camp. Who leaves,
  whether the daughter is viable, and successor-group behaviour are all Item 4 and unstarted.
- **Future individual/household demography.** Away parties still carry no age cohorts. A party
  member who ages is tracked only as a band-level reclassification with an overflow rule. Locating
  a death inside a party, or giving parties their own age structure, needs the household/individual
  layer.
- **Same-day current presence** remains formally deferred — unchanged by this checkpoint.
