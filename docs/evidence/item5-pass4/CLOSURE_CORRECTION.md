# Roadmap Item 5 Pass 4 — Final Closure Correction

Independent architect verdict on reviewed closure candidate `1352c568968f6a556d64f8de616afe37335ce555`: **REWORK_REQUIRED**.

Current status of this record: closure correction implemented and implementer-certified on `checkpoint/item5-invention-diversity-pass4`, pending independent architect review. Item 5 is not accepted or frozen here.

## Reconciliation chronology

The closure-correction continuation reconciled the actual worktree before modifying anything:

- repository `fellipegoncalvesleite/society-engine`;
- worktree `/Users/fellipegoncalvesleite/.worktrees/society-engine-item5-invention-diversity-pass4`;
- branch `checkpoint/item5-invention-diversity-pass4`;
- starting HEAD exactly `1352c568968f6a556d64f8de616afe37335ce555`;
- accepted Pass-3 ancestor `e290a0a039b1e75dd949d646860f1b867ee1c9ce` verified in ancestry;
- reviewed `1352c568...` verified in ancestry;
- no intervening commits after `1352c568...`;
- no staged changes or conflicts;
- 17 legitimate modified tracked files present in total: eight closure-correction implementation/audit files plus nine evidence/regression-artifact files;
- this `CLOSURE_CORRECTION.md` evidence record present as an intended untracked file;
- temporary untracked `node_modules` symlink present only for dependency access.

No reset was performed and the legitimate correction work was preserved.

## Defect 1 — candidate universe was still effectively complete-design-led

### Architect defect

The rejected closure candidate did not yet provide convincing proof that a genuinely uncatalogued design could arise from primitive recombination rather than from an effective complete-design catalog with a cosmetic non-template identity.

### Root cause

Candidate generation still relied on a complete generic-design catalog as a primary construction surface. That made the real discovery universe equivalent to the catalog even if downstream normalization/variant keys looked non-template.

### Source correction

`compositionalInvention.ts` now constructs designs from bounded reusable primitive inputs:

- functional intent;
- mechanism primitives;
- component/form primitives;
- process/operation primitives;
- technical fragments;
- actionable human material-property beliefs;
- compatibility constraints;
- revision/history constraints.

Historical complete designs are consulted only **after composition** for recognition/compatibility and any already-existing physical-effect adapter.

Required direction:

```text
primitive composition → optional historical recognition
```

Forbidden regression:

```text
complete catalog entry → candidate
```

### GREEN proof

Closure fixture Q produces `design:ee8231c9` among the composed candidates with `historicalMatch: false`. The fixture also removes a required primitive and confirms the target composition disappears. This proves more than a non-template key.

Mutation M7 regresses toward catalog-only candidate generation and causes the targeted closure semantics to fail with non-zero process status; restoration is byte-identical and the audit returns GREEN.

## Defect 2 — stored material confidence acted as perpetual current proof

### Architect defect

Historical material knowledge could remain actionable forever because storage and current epistemic strength were not separated strongly enough.

### Root cause

Candidate role binding consumed stored property confidence without a freshness-sensitive effective-confidence layer. Historical memory therefore doubled as current practical proof.

### Source correction

`HumanMaterialBelief` retains history/provenance, while `effectiveMaterialPropertyConfidence` derives current actionability from reinforcement recency. Candidate material-role binding consumes the effective/current value.

This does not implement arbitrary forgetting. Stored belief history remains; stale actionability can fall to unknown; fresh observation reinforces the same identity.

### GREEN proof

Closure fixture R:

```text
fresh       → supported
stale       → unknown
reobserved  → supported
```

All three states retain the same identity:

`material-belief:band:audit:A:worked_plant_fiber`.

Inherited knowledge remains degraded and is not fresh local occurrence/execution evidence.

Mutation M8 restores perpetual stale actionability and causes R to fail; restoration is byte-identical and GREEN returns.

## Defect 3 — specific material-binding failure did not change future material choice

### Architect defect

A failed material binding could be recorded without creating enough localized negative information to stop the same failed material from being chosen again for the same role/context.

### Root cause

Feedback/revision history did not carry a binding-level lesson into later role binding. Broad weakening alone is both too imprecise and insufficient to guarantee alternate selection.

### Source correction

Specific attributed failure may now create a bounded failed-material-binding lesson scoped to relevant design/role/material/property/context. Candidate role binding consults that lesson. Unknown failure does not invent precise blame. Reinforcement newer than the lesson can make the prior binding viable again.

### GREEN proof

Controlled fixture S begins with A and B both plausible for role `support`.

Specific attributed A failure:

- later selected binding becomes `material:audit:B-binding`;
- implicated A `tensile_fibrous` confidence moves 0.78 → 0.69;
- A `flexibility` remains 0.78;
- A `heat_response` remains 0.78;
- unrelated B evidence remains unchanged.

Unknown-failure negative control:

- A remains eligible and selected as `material:audit:A-binding`.

Mutation M9 ignores failed bindings and causes S to fail; restoration is byte-identical and GREEN returns.

## Defect 4 — executor-less plans were falsely represented as underway experiments

### Architect defect

A novel design with no execution authority could enter `underway`, creating false lifecycle semantics even when the code withheld physical effect.

### Root cause

The experiment lifecycle lacked a truthful canonical state for “plan exists but no authority can execute it now.”

### Source correction

The existing experiment/history authority now includes `blocked_by_execution`. No parallel plan authority was added.

A blocked plan:

- `attemptSeasons = 0`;
- `executionOccurred = false`;
- has no execution proof;
- creates no physical response/effect;
- matures no efficacy;
- remains bounded;
- ranks below genuine `underway` work.

### GREEN proof

Closure fixture T produces `blocked_by_execution`, zero attempt seasons, no execution, within experiment cap 4. The bounded set contains one real `underway` experiment first and three blocked plans, proving blocked plans do not starve genuinely active work.

Mutation M10 restores false `underway` classification and causes T to fail; restoration is byte-identical and GREEN returns.

## RED evidence — chronology and limitation

The existing pre-correction `red.stderr` and `artifacts/RED_item5Pass4CompositionalAudit.txt` are not valid semantic RED evidence for these defects: that capture failed during Vite module loading. They remain historical files and are not rewritten to claim otherwise.

Because the handoff's statement that exactly four assertions had previously failed could not be independently verified from those stored bytes, the continuation reproduced RED later in a detached worktree at the exact rejected SHA `1352c568...`.

Method:

- production source stayed exactly at rejected `1352c568...`;
- the current 31-assertion audit was copied into the detached worktree;
- only three post-correction-only guards that require newly introduced fields/UI structure were neutralized for compatibility with the old tree;
- all four closure assertions Q/R/S/T were left active.

Result:

- process exit: non-zero;
- semantic verdict: FAIL;
- passed: 27;
- failed: 4;
- failures: exactly Q, R, S, T.

A local ignored reproduction artifact was captured as `artifacts/closure-correction-red-reproduction.json`; the durable tracked evidence is the exact SHA/method/result recorded here rather than the git-ignored generated artifact.

## Final GREEN and mutation evidence

Final corrected controlled audit:

- `node scripts/item5Pass4CompositionalAudit.mjs`;
- **PASS, 31/31, 0 failed**.

Final reversible mutation audit:

- `node scripts/item5Pass4MutationAudit.mjs`;
- **PASS, M1–M10**;
- each mutation produces a non-zero semantic failure;
- source restoration is byte-identical;
- restored controlled audit is GREEN.

## Final semantic regression matrix

- Pass 1 adaptation authority: **19/19 PASS**;
- Pass 2 physical provenance: **13/13 PASS**;
- Pass 3 projection/inheritance: **40/40 PASS**;
- Pass 4 corrected compositional: **31/31 PASS**;
- practical adaptation: **27/27 PASS**;
- adaptive efficacy: **26/26 PASS**;
- ROUTINES-2: **38/38 PASS**;
- Invention-3: **23/23 PASS**;
- expedition adaptation efficacy: **12/12 PASS**;
- Item-4 fission transfer: **12/12 PASS, 0 vacuous**;
- Item-4 whole integration: **6/6 PASS**;
- graph: **221 nodes / 764 edges / 0 duplicate ids / 0 dangling**;
- import boundary: **PASS**.

## Projection-truth correction

A stored `concluded_success` is historical data, not automatically admitted canonical execution/success proof. The UI/projection now withholds the success/execution claim when canonical execution proof is missing.

```text
stored historical claim != admitted canonical execution truth
```

This remains a read-model correction; the UI has no simulation writer.

## Benchmark migration correction

Old practical-adaptation/Invention-3 fixtures expected unsupported material plans to remain `underway` and/or behave as though a selected material plan implied physical execution. Those expectations were stale after the stronger execution boundary.

Migrated invariant:

```text
blocked_by_execution
+ zero attempt
+ zero physical execution
+ zero fabricated physical effect
```

Final Invention-3 result is 23/23 PASS; practical adaptation is 27/27 PASS.

## Natural evidence and blocked-plan churn correction

The first full natural rerun after the four architect defects were corrected produced Map-2/120 cumulative hypotheses = 424 with all retained caps still held. Inspection showed this count contained a real repeated-planning defect: a read-only probe found only 37 conceptual design keys; 12 of 19 blocked experiment keys restarted; the worst unchanged blocked experiment was recreated 74 times because cap eviction removed the only duplicate check.

A test-first narrow correction was then made. Existing bounded selected-idea history now supplies a 32-tick reconsideration cooldown for non-template `composed:` blocked plans. The strengthened T assertion first failed semantically with only T red, then returned GREEN after the source correction. Historical executable variants remain outside this suppression rule; no parallel plan ledger or permanent blacklist was added.

### Final Map 1 — 40 years

- hypotheses 9;
- non-template 4;
- independent convergence 1;
- candidate maxima 5/problem and 9/global;
- digest `17ebd55be40343bf4010d32ae9fecf60973971a4be3bac1be90807e44a04f1d6`.

### Final Map 2 — 40 years

- hypotheses 40;
- non-template 21;
- convergent signatures 5;
- candidate maxima 5/problem and 12/global;
- digest `dc046a550d27c01a0a376e9eef22ed7eccc33f20924cceb087484964df3dd6b8`.

### Final Map 2 — 120 years

- cumulative hypotheses 98;
- non-template 72;
- experiments 38;
- revisions 2; concluded partials 2; concluded successes 1; abandoned experiments 2;
- all retained-state caps held;
- candidate maxima 5/problem and 12/global;
- digest `4610cc2cd648ab6f75df8b5f574ad0868a90ae585486f4cb12ad1f83f51211ac`.

Post-fix churn probe: 19 blocked experiment keys are observed, 12 are reconsidered after cooldown, and the largest identical-plan start count is 9 rather than 74. Common restarts are separated by the intended 32 ticks. Classification: **immediate identical blocked-plan cycling was a real bounded semantic/performance defect and is corrected; periodic bounded reconsideration after 32 ticks remains an intentional coarse-resolution seam**.

## Deterministic evidence

Final Map-2 50-year repeat:

- verdict PASS;
- deterministic true;
- fingerprint `2f4b6b3a13b78f6b30555d0b503c50eb308aa10d59e496b4561bc7edb3f34287` in both repetitions;
- end population 214;
- active bands 9;
- movements 1077;
- adaptations attempted 8;
- adaptations effective 3;
- state caps held true.

No coefficient was tuned to reproduce any earlier fingerprint. The fingerprint changed because the closure certification itself found and corrected the blocked-plan churn defect.

## Physical authority invariant

Final `src/sim/agents/adaptiveEfficacy.ts` required SHA-256:

`ca2603250e1716886e2bb21db2d1c3bed5114d7ed8cf9213761747acbb72e919`

Pass-1/Pass-2 audits preserve existing physical effect constants. No physical coefficient retune is part of this correction.

## Final limitations

1. Material truth remains coarse human epistemic state, not canonical geology/material occurrence/properties.
2. Knowledge remains band-aggregate, not person-level teaching/skill carriers.
3. Plan labor remains estimated, not task-level executed labor.
4. Novel designs without execution authority remain blocked plans only.
5. Exact blocked composed designs may be reconsidered after the bounded 32-tick cooldown; evidence-sensitive retry timing remains a future refinement seam.
6. Natural horizons do not exhibit every controlled feedback/reactivation transition; controlled fixtures remain the proof for those semantics.
7. No extraction, inventory, craft, production, physical trade, construction, metallurgy, causal social/cultural adoption, or WORLD-M0 authority exists here.

## Scope and stop condition

This correction does not begin Pass 5, Item 6, WORLD-M0, world generation, geology, extraction, inventory/craft, construction, metallurgy, language/culture/religion, or a roadmap rewrite. It does not merge `main`.

`docs/HANDOFF_ITEM6_WORLD_GENERATION.md` remains present and unresolved.

Required status after commit/push verification:

**PASS 4 FINAL CLOSURE CORRECTION IMPLEMENTED / CERTIFIED / PUSHED**

**PENDING INDEPENDENT ARCHITECT REVIEW**

**ITEM 5 NOT YET ACCEPTED OR FROZEN**
