# Roadmap Item 4 — parent residual viability: reproduction, design comparison, decision

`AUTHORITY_MAP.md` records "is the parent still viable?" as an authority that **does not exist**. This
document records the defect that shaped the one now added, the five models compared, the one
selected, and what it deliberately cannot answer.

**Status: the pure authority is implemented and audited. The Direction-D lifecycle that would call it
is NOT implemented. It has zero production callers, exactly like `fissionFounderAllocation.ts`.**

---

## 1. What was inherited, what was retained, what was replaced

Work on this module was interrupted mid-edit. The state inherited was:

| | |
|---|---|
| `src/sim/agents/fissionParentResidualViability.ts` | 578 lines, **did not compile** — `ParentResidualLimitingQuantities` declared `labourShareAtCampBefore`, `splitCausedStrain` and `priorFragility`, and the implementation returned none of them (`TS2739`) |
| `.probe-tmp.mjs` | a 53-line ad-hoc probe driving the module over twelve constructed parents |

The incomplete interface is itself the record of where the work stopped: the author had begun
separating split-caused strain from prior fragility in the *type* and had not yet done it in the
*body*. That separation is what this pass finished.

**Retained unchanged in substance:** the module's purpose and scope; the flat input struct as an
anti-omniscience device; the single `MIN_RESIDUAL_WORKING_ADULTS_AT_CAMP = 1` floor named as an
implementation abstraction; the three hard structural refusals; the bounded, deterministic,
downward-only, never-silent revision search; `permittedFounderCount` as the exported predicate; the
rule that cohorts are read from `allocateFounderCohorts` and never recomputed; and the deference of
the successor-side floor to the caller via `minimumFounderRequest`.

**Replaced:** the verdict model itself — one summed `residualStrain` against one threshold — for the
reasons in §2. **Added:** the ledger separation, `blockKind`, `unmeasuredInputs`, the before/after
mobility pair, `isPriorHardshipSeparatedFromSplitDamage`, and the rounding fix in §5.

`.probe-tmp.mjs` is superseded by two committed audits and is not carried forward.

---

## 2. The defect, reproduced before any design was chosen

The interrupted model computed

```
residualStrain = clamp01( dependencyWorsening*0.30 + labourThinness*0.34      ← caused by the split
                        + nutritionStrain*0.24     + embodiedStrain*0.20      ← already there
                        + mobilityStrain*0.14      + ecologicalStrain*0.12 )  ← already there
refused when residualStrain >= 0.62
```

Run on the real interrupted code (raw output preserved below), a parent of **10 working adults, 26
dependents and 14 elders** at maximum hunger, maximum embodied hardship, mobility 0.1 and ecological
risk 0.9 scored **0.92** and was refused:

```
all-bad {"verdict":"residual_nonviable","blocked":true,"strain":0.92,"camp":6,"share":0.19,
  "depBefore":4,"depAfter":4.33,
  "opp":["residual_dependency_load_worsened_by_the_split:0.22","residual_labour_share_thin_at_camp:0.53",
         "residual_nutrition_already_in_deficit:1","residual_carries_embodied_hardship:1",
         "residual_mobility_capability_reduced:0.9","residual_ecological_position_adverse:0.9",
         "no_permitted_founder_request_leaves_a_coherent_parent:1"]}
all-bad-small-min {...identical, strain 0.92, blocked true...}
```

`fissionParentResidualReproductionAudit.mjs` decomposes that score
(`parent-residual-prior-strain-reproduction.json`), and its reconstruction reproduces the real
module's figure to the digit — **0.9213**, which the real probe printed as `0.92`:

| quantity | value |
|---|---|
| `residualStrain` | **0.9213** against a 0.62 threshold |
| contributed by the split | 0.2473 |
| contributed by hardship the split did not cause | **0.6740** |
| **share of the refusal that was not about the split** | **73.16%** |

**And the refusal was irreparable by the only remedy this authority has.** Lowering the caller's
minimum founder request from 18 to 2 moved the score **not at all** — 0.9213 in both arms — because
every dominant term is invariant to the founder count. A smaller departing group does not make the
parent less hungry. The revision search dutifully evaluated candidates and every one failed for a
reason no candidate could address.

**Why that is a defect rather than a strict policy.** `RESEARCH_CONSTRAINTS.md` §3 records local
resource decline as one of the recurring **attested causes** of fission. A model that sums hardship
into the refusal makes hardship a veto, so the splits the literature says are most ordinary become
precisely the splits this authority refuses. It would have been a hardship gate wearing a viability
gate's name — and the brief's constraint "do not let existing hardship automatically veto every
split" is the same finding stated as a requirement.

---

## 3. Five models compared

| # | model | verdict rests on | rejected because |
|---|---|---|---|
| 1 | **absolute residual viability** | the residual's own state, hardship included | this is the interrupted model. §2 measures it: 73% of a refusal is hardship the split did not cause, and no revision can reach it. Makes hardship a veto. **Rejected.** |
| 2 | **split-caused deterioration only** | the before → after delta, hardship ignored | violates "do not make existing hardship irrelevant" — and worse, it is structurally permissive here. `allocateFounderCohorts` is **proportional**, so a proportional split of a doomed band deteriorates it very little by construction. This model would approve nearly every split of nearly every desperate band, which is exactly "allow a split merely because both resulting groups are equally bad". **Rejected.** |
| 3 | **hybrid: hard limits + split-caused damage + contextual margin** | absolute impossibilities alone; otherwise damage measured against a tolerance that hardship narrows | **SELECTED.** Distinguishes all five categories the brief requires, and does so structurally. |
| 4 | **bounded revision of the founder request** | "what is the largest request that works" | not a verdict model at all — it is an outcome channel, and it cannot express "no departure at all" or tell an impossibility from an over-large request. **Rejected as a sole design; retained as a component of 3.** |
| 5 | **two-ledger publication with an explicit tolerance** | the same comparison as 3, with damage and fragility published as separate first-class numbers and the tolerance published alongside | **not an alternative to 3 — it is 3 with a publication discipline**, and it comes straight from the repository: `SPLIT_POLICY_MATRIX.md` §1 requires the additive and no-unearned-improvement claims to be "published separately", because "publishing one number for both would be the false precision this matrix exists to prevent". **Adopted together with 3.** |

Model 5 is the "architecture suggested by the inspected code" the brief asked for, and it was the
inspected code that suggested it: the matrix had already ruled, for a different pair of quantities,
that two claims of different kinds must not share one number. The interrupted model had made exactly
that mistake for this pair.

---

## 4. The selected model

```
1. HARD PHYSICAL BLOCKS — absolute tests on the residual's own state, invariant to how the parent
   was before, strength 1, fatal alone:
       residual_has_no_bodies_at_camp
       residual_has_no_productive_labour_at_camp
       residual_labour_committed_beyond_its_workforce

2. splitCausedDamage  = clamp01( campLabourRemovedFraction*0.52
                               + dependencyWorsening*0.30
                               + mobilityLoss*0.22 )
   Every contributor is a BEFORE → AFTER movement.

3. priorFragility     = clamp01( nutrition*0.34 + embodied*0.28 + ecological*0.20
                               + campLabourThinnessBefore*0.30 + dependencyLoadBefore*0.22 )
   Every contributor is read at its BEFORE level.

4. tolerance = max(0.18, 0.52 − 0.34 × priorFragility)
   verdict   = splitCausedDamage >= tolerance
```

### The two guarantees, and why they are structural rather than calibrated

**Pre-existing hardship alone can never block.** A departure that changes nothing has
`splitCausedDamage === 0` exactly, and `tolerance >= TOLERANCE_FLOOR = 0.18 > 0`. The comparison
cannot fail. Setting the floor to zero would silently restore the §2 defect, which is why it is
documented as load-bearing. Fixture **PR19** asserts it at `priorFragility === 1`.

**Pre-existing hardship is never irrelevant.** Tolerance shrinks as fragility rises, so the same
departure a sound parent absorbs is refused for a fragile one. Fixtures **PR9/PR10/PR11** are the
proof, and they are constructed so each isolates one variable:

| fixture | parent | request | prior fragility | split damage | tolerance | verdict |
|---|---|---|---|---|---|---|
| PR9 | 29/14/7, starving | 6 | 0.38 | small | 0.39 | **viable** |
| PR10 | 29/14/7, starving | 40 | **0.38 — identical to PR9** | large | 0.39 | **refused** |
| PR11 | 29/14/7, **well fed** | 40 | 0.04 | **identical to PR10** | 0.51 | **viable** |

PR9→PR10 holds hardship constant and varies only the departure. PR10→PR11 holds the departure
constant and varies only the hardship. Between them: hardship is neither the verdict nor absent
from it.

### How the partition was decided

A quantity contributes to **damage** only if it has a genuine before/after pair. Nutrition, embodied
condition and ecological position have none, and that is a derivation rather than a preference:

- **Nutrition** — realism defect **L2** states that splitting does not reduce hunger or improve
  nutrition by itself. A quantity the split cannot move can contribute no split-caused movement.
- **Ecological position** — the parent does not move at a departure, so its tile is unchanged.
  Crediting a smaller band with better ground would be the **unearned improvement**
  `SPLIT_POLICY_MATRIX.md` forbids.
- **Embodied condition** — the L5 family: injuries and sickness are carried, not reset.

### Charging discipline

`labourShareAtCamp` after the split is published in `limiting` as **evidence and is charged
nowhere**. Charging both the level and the loss would be one physical fact counted twice under two
names — the CORRECTION-32 defect. The one term that is charged is
`campLabourRemovedFraction = departingWorkingAdults / campWorkingAdultsBefore`, the exact quantity
rather than a reconstruction from shares.

`campLabourRemovedFraction` and `dependencyWorsening` are **partially correlated by construction**
under a proportional allocation drawn working-adults-first. They are not the same quantity, and the
correlation is stated in the module rather than hidden; the weights are set so neither alone reaches
the tolerance floor.

---

## 5. A defect this pass's own fixtures found in this pass's own authority

**Fixture PR16 caught the authority publishing numbers that did not reproduce its own verdict.**

The verdict compared full-precision values while `limiting` published `round2` ones. In the narrow
band where the two round to the same figure, a reader recomputing the verdict from the published
evidence disagrees with it. Measured at `mobilityCapabilityAfter = 0.8`: published damage 0.39,
published tolerance 0.39, published comparison says *refuse*, verdict said *permit*.

This is CORRECTION-35's defect class exactly — a label leading its own quantity. **Fixed in the
authority, not in the test:** the comparison is now made on the rounded, published values, so the
verdict is exactly reproducible from the evidence. The fix costs nothing physical.

---

## 6. Fixture results

`fissionParentResidualFixturesAudit.mjs` → `parent-residual-controlled-fixtures.json`

**PR1–PR20: 20 passing, 0 failing, 0 vacuous, 0 errored.** Non-vacuity is asserted per fixture and
the harness relabels a fixture `VACUOUS` and fails the run when its predicate is false.

| | fixture | covers |
|---|---|---|
| PR1, PR2 | both sides feasible, on the two **real** natural fissions' cohorts | brief item 1 |
| PR3 | successor feasible, parent stranded | item 2 |
| PR4 | a smaller request repairs the parent | item 3 |
| PR5 | no feasible revision, search genuinely exhausted | item 4 |
| PR6, PR7, PR8 | dependent-heavy, elder-heavy, labour-thin | items 5–7 |
| PR9, PR10, PR11 | hunger with little / material worsening, plus the no-hunger isolation arm | items 8–9 |
| PR12 | illness without split-caused worsening | item 10 |
| PR13 | absolute physical impossibility | item 11 |
| PR14, PR15 | away-person and prepared-commitment constraints | items 12–13 |
| PR16 | deterministic boundary, swept | item 14 |
| PR17 | same allocation → byte-identical result | item 15 |
| PR18 | unrelated information cannot alter the verdict | item 16 |
| PR19 | zero damage never blocks at maximum fragility | the §4 guarantee |
| PR20 | uncertainty is not soundness | the fifth category |

**PR18 is structural, not statistical.** The input is a closed struct, so a polluted input carrying a
world object, world population, hidden target richness, other bands' positions, split pressure and a
seed produces a byte-identical assessment. Nothing outside the named fields is reachable from inside
the module.

### Three of this audit's own fixtures were wrong before they were right, and are recorded

1. **PR5 failed.** It asserted that a parent of 4/30/16 could not split at any size; the authority
   found a workable request at 10. **The authority was right and the fixture was wrong.** Rebuilt on
   a parent of 2/40/8, where the working-adults-first remainder draw puts a floor under the damage
   that no smaller request can get under.
2. **PR10 failed and PR11 reported VACUOUS.** Both compared `limiting` across two arms — but whenever
   a revision succeeds, `limiting` describes the **revised** request, so they were comparing two
   different departures. Rebuilt to read `assessParentResidual` (no search) for the comparison and
   `assessParentResidualWithRevision` for the outcome.
3. **PR16 reported VACUOUS.** Its first sweep used a departure whose damage never reached the
   tolerance at all, so it contained one verdict and tested no boundary. Rebuilt at a request that
   sits close to its own tolerance — and it was the rebuilt form that then found the §5 defect.

A fourth instrument gap: the unreachable-refusal inspection initially read reason ids from a field
`brief()` never populated, so it reported three ids as unemitted that were being emitted. It is now
**measured** — every id the run emits is collected from the production assessments themselves.

### Structurally unreachable refusals, inspected

19 reason ids in the vocabulary, **18 emitted** by the fixtures. The one not emitted:

- **`residual_has_no_bodies_at_camp` — NOT CONSTRUCTED, deliberately.** It requires
  `physicallyAwayPeople` to exceed the entire residual. Reachable in principle, but the away count is
  drawn from the same population the residual is, so forcing it means handing the authority an input
  the departure seam cannot produce. **Building a fixture purely to light the enum would be the
  fabricated fixture the brief forbids.** Recorded as not constructed rather than counted as a pass.

---

## 7. What this authority deliberately cannot answer

Stated rather than papered over.

1. **"Should this split be refused because both resulting groups would be equally bad?"** It sees one
   of the two groups. `AUTHORITY_MAP.md` lists successor viability as its own authority. What this
   module *does* contribute is the three hard blocks, which are absolute tests on the residual rather
   than delta tests — those are what refuse a proportional split of a band whose remainder cannot
   function. The rest belongs to the successor authority and to the establishment window.
2. **Dependents and elders are treated identically as non-working burden.** The allocation conserves
   them as separate cohorts, but every burden term here reads `dependents + elders`. PR6 and PR7
   therefore produce very similar readings for compositions that are demographically quite different.
   The repository has no differential burden model, and inventing one to make the two diverge would
   be an anthropological claim this checkpoint is not licensed to make.
3. **The weights and the three tolerance constants are AUTHORITY BOUNDARIES, not calibrated
   magnitudes** — the CORRECTION-32 / -34E distinction. The authority is what this checkpoint fixes;
   the strength is deliberately not tuned, and no natural-occurrence run has been used to fit them.
4. **No natural-occurrence evidence exists for this module**, because it has no production callers.
   Every result here is from constructed fixtures. The two "real natural fission" fixtures use the
   measured cohorts of the two events in `fission-before.json`; they do **not** show this authority
   running inside a simulation.
5. **No graph node was added.** The immediately preceding commit added `fissionFounderAllocation.ts`
   without one and the graph is unchanged at 221/764; a leaf with no production callers is not yet an
   architecture node. Both modules get nodes when the departure seam calls them.

---

## 8. Checks run on this commit

| check | result |
|---|---|
| `tsc -p tsconfig.json --noEmit` | **PASS** (the inherited tree did **not** compile — `TS2739`) |
| `tsc -p tsconfig.node.json --noEmit` | PASS |
| `npm run build` | PASS |
| `checkGraph.mjs` | **221/764, 0 dup, 0 dangling — unchanged** |
| `importBoundaryAudit.mjs` | **85 internal back-edges — unchanged**; `src/sim` imports nothing from ui/render/store/worker |
| `fissionParentResidualFixturesAudit.mjs` | **20/20, 0 failing, 0 vacuous** |
| `fissionParentResidualReproductionAudit.mjs` | **4/4 claims hold** |
| `founderAllocationFixturesAudit.mjs` | re-run, unchanged |

**No frozen evidence was modified.** Both new outputs are new files inside this checkpoint's own
directory, and both audits take an explicit `--out`.

**Production behaviour is unchanged.** The module has zero production callers, so no simulation
trajectory can move. That is also why **Item 4 is not implemented by this commit** — a pure leaf that
nothing calls is not a lifecycle.
