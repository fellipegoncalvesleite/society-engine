# Roadmap Item 5 Pass 4 — Final Closure-Correction Evidence

Status: implementer certification of the closure-corrected Pass-4 tree, pending independent architect review. Item 5 is not accepted or frozen by this record.

## Reconciled starting state

The closure correction was found as legitimate uncommitted work on:

- repository: `fellipegoncalvesleite/society-engine`;
- branch: `checkpoint/item5-invention-diversity-pass4`;
- starting HEAD: `1352c568968f6a556d64f8de616afe37335ce555`;
- accepted Pass-3 ancestor: `e290a0a039b1e75dd949d646860f1b867ee1c9ce`;
- no intervening commit after `1352c568...`;
- no staged changes or conflicts at reconciliation time;
- 17 legitimate modified tracked files were present: eight implementation/audit files plus nine evidence/regression-artifact files; `CLOSURE_CORRECTION.md` was also present as an intended untracked evidence file, alongside a temporary untracked `node_modules` symlink used only to access dependencies.

The worktree was not reset and the legitimate closure-correction work was preserved.

## RED evidence and chronology

The architect verdict on the reviewed `1352c568...` closure candidate was `REWORK_REQUIRED` for four semantic defects.

The pre-existing `docs/evidence/item5-pass4/red.stderr` / `artifacts/RED_item5Pass4CompositionalAudit.txt` files do **not** prove those four defects: that historical capture failed during Vite module loading. They are not relabeled as a genuine semantic RED run.

A later detached reproduction was therefore run against the exact untouched `1352c568...` production tree, using the current closure audit while neutralizing only three guards that depend on fields/UI assertions introduced by the correction itself. That reproduction exited non-zero and produced exactly four semantic failures, 27 passes:

- `Q_primitive_recombination_constructs_uncatalogued_design`;
- `R_material_belief_staleness_and_reactivation`;
- `S_specific_material_binding_failure_substitutes_locally`;
- `T_executorless_novel_plan_is_not_false_underway_experiment`.

This is reproducible defect-level RED evidence against the rejected tree. It does not rewrite the chronology by pretending the broken older capture was valid.

## GREEN — corrected compositional audit

Command: `node scripts/item5Pass4CompositionalAudit.mjs`

Final semantic result: **PASS, 31/31, 0 failed**.

Closure-specific proof:

- Q: uncatalogued `design:ee8231c9` is produced by primitive recombination; `historicalMatch: false`; required primitive removal makes the target disappear.
- R: the same material-belief id moves `supported → unknown → supported` under freshness, staleness, and re-observation.
- S: specifically failed A is replaced by B; unknown failure keeps A; only the specifically implicated A property is weakened.
- T: executor-less novel plan is `blocked_by_execution`, `executionOccurred=false`, `attemptSeasons=0`; one genuinely `underway` experiment remains ahead of blocked plans inside cap 4.

## Reversible mutation certification

Command: `node scripts/item5Pass4MutationAudit.mjs`

Final semantic result: **PASS, M1–M10**. Every mutation caused a non-zero semantic failure, the intended source was restored byte-identically, and the restored controlled audit returned GREEN.

The closure mutations are:

- M7 — regress candidate formation toward catalog-only generation;
- M8 — make stale material confidence actionable forever;
- M9 — ignore a specifically failed material binding;
- M10 — classify an executor-less plan as `underway`.

M7–M10 each make their targeted Q/R/S/T closure invariant fail. Mutation residue was not retained.

## Regression matrix

Fresh final-tree semantic results:

| Gate | Result |
| --- | --- |
| Pass-1 adaptation authority | PASS — 19/19 |
| Pass-2 physical-effect provenance | PASS — 13/13 |
| Pass-3 projection/inheritance | PASS — 40/40 |
| Pass-4 corrected compositional | PASS — 31/31 |
| Reversible mutation audit | PASS — M1–M10 |
| Practical adaptation targeted | PASS — 27/27 |
| Adaptive efficacy targeted | PASS — 26/26 |
| ROUTINES-2 | PASS — 38/38 |
| Invention-3 compatibility | PASS — 23/23 |
| Expedition adaptation efficacy | PASS — 12/12 |
| Item-4 fission field transfer | PASS — 12/12, 0 vacuous |
| Item-4 whole integration | PASS — 6/6 |
| Architecture graph | PASS — 221 nodes / 764 edges / 0 duplicate ids / 0 dangling links |
| Import boundary | PASS |

The import-boundary run records 68 current internal sim back-edges as informational architecture metadata; its prohibited sim→UI/render/store/worker boundary verdict is PASS.

## Projection and benchmark corrections preserved

Two stale expectations discovered during closure work remain corrected:

1. Diagnostic projection no longer presents a stored `concluded_success` as admitted execution/success truth when canonical execution proof is missing.
2. Practical-adaptation/Invention-3 fixtures no longer demand that unsupported material plans remain `underway`. Their stronger invariant is `blocked_by_execution` + zero attempt + zero physical execution/effect.

The Invention-3 compatibility audit is 23/23 after that migration.

## Physical-authority invariant

`src/sim/agents/adaptiveEfficacy.ts` final required SHA-256:

`ca2603250e1716886e2bb21db2d1c3bed5114d7ed8cf9213761747acbb72e919`

Pass-1 and Pass-2 audits independently preserve the existing effect constants. No physical coefficient was retuned to recover a fingerprint.

## Natural and deterministic evidence

Natural Map 1, 40 years:

- PASS;
- hypotheses 9;
- non-template 4;
- independent convergence 1;
- raw candidate maxima 5/problem, 9/global;
- digest `17ebd55be40343bf4010d32ae9fecf60973971a4be3bac1be90807e44a04f1d6`.

Natural Map 2, 40 years:

- PASS;
- hypotheses 40;
- non-template 21;
- convergent signatures 5;
- raw candidate maxima 5/problem, 12/global;
- digest `dc046a550d27c01a0a376e9eef22ed7eccc33f20924cceb087484964df3dd6b8`.

Natural Map 2, 120 years:

- PASS;
- hypotheses encountered 98;
- non-template 72;
- experiments 38;
- revisions 2; partial outcomes 2; success outcomes 1; abandoned experiments 2; dead-end lessons 5; dormant lessons 1;
- all retained-state/candidate caps held;
- raw candidate maxima 5/problem, 12/global;
- digest `4610cc2cd648ab6f75df8b5f574ad0868a90ae585486f4cb12ad1f83f51211ac`.

Deterministic Map 2, 50 years, repeated in one audit:

- PASS, deterministic=true;
- fingerprint both repetitions `2f4b6b3a13b78f6b30555d0b503c50eb308aa10d59e496b4561bc7edb3f34287`;
- end population 214;
- active bands 9;
- movements 1077;
- adaptations attempted 8;
- adaptations effective 3;
- state caps held true.

## Blocked-plan churn investigation and correction

The initial closure-corrected 120-year run produced 424 cumulative hypothesis ids while retained state stayed bounded. A deeper read-only probe showed that this was not merely harmless accounting noise: only 37 conceptual `(band, problem, designSignature, variant)` keys underlay the 424 ids, 12 of 19 blocked experiment keys were restarted, and the worst identical blocked experiment was recreated 74 times. The root cause was precise: experiment history is capped at four, and candidate formation previously checked only retained `underway`/`blocked_by_execution` experiments. Once a blocked row was evicted, the same unchanged non-executable design could be selected again immediately.

The final correction reuses existing bounded selected-idea history as a 32-tick reconsideration memory for non-template `composed:` designs. The strengthened T fixture was written first and produced a semantic RED with only T failing; after the production change the audit returned 31/31. The control also proves the memory expires at tick 32 and does not suppress a historical executable variant.

Post-fix 120-year measurement:

- cumulative hypotheses: 98 instead of 424;
- non-template hypotheses: 72 instead of 398;
- blocked experiment keys observed: 19;
- keys restarted after cooldown: 12;
- maximum starts for one blocked experiment: 9 instead of 74;
- common retry spacing is the intended 32 ticks;
- retained maxima remain ideas 7/8, experiments 4/4, dead-end lessons 2/8, raw candidates 5/6 per problem and 12/18 globally.

Classification: **the immediate repeated-planning loop was a real bounded semantic/performance defect and is corrected; periodic reconsideration after the bounded 32-tick cooldown is an intentional coarse-resolution seam**. No permanent blacklist, second plan authority, physical execution, effect, or efficacy was added.

## Known limitations

- Historical material memory is aggregate band-level epistemic state, not person-level skill/teaching.
- Material categories/property predicates are coarse and are not canonical physical geology/material truth.
- Exact blocked composed hypotheses may be reconsidered after the bounded 32-tick cooldown; evidence-sensitive retry timing remains a future refinement seam.
- Natural runs do not demonstrate every controlled feedback transition; controlled fixtures remain the proof for stale/reactivation and localized binding substitution.
- Novel composed designs without an execution/effect authority remain plans only.
- No inventory, extraction, craft, production, construction, metallurgy, physical trade, task-labor, culture/adoption, or WORLD-M0 authority is claimed.

## Closure status

This evidence supports only:

**PASS 4 FINAL CLOSURE CORRECTION IMPLEMENTED / CERTIFIED**

It does not itself accept/freeze Item 5 or authorize Pass 5, Item 6, WORLD-M0, roadmap rewrite, or a merge to `main`.
