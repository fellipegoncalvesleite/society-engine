# Roadmap Item 5 Pass 4 — Caps, Natural Evidence, and Reconsideration Cost

Status: final closure-correction boundedness record pending independent architect review. Wall-clock timing is intentionally not used as an acceptance threshold because the operator machine is shared; bounded state/candidate work and semantic outcomes are the acceptance evidence.

## Fixed production budgets

Current production limits:

- fragments per band: 20;
- human material beliefs per band: 12;
- design hints per band: 8;
- revision/dead-end lessons per band: 8;
- practical problems per band: 6;
- responses per band: 12;
- efficacy records per band: 12;
- ideas per band: 8;
- experiments per band: 4;
- raw candidates per problem: 6;
- raw candidates globally per band/update: 18;
- shortlisted candidates per problem: 3.

Primitive input budgets used by corrected composition are also bounded:

- mechanism primitives considered: 12;
- component/form primitives considered: 32;
- process/operation primitives considered: 36.

Candidate generation reads bounded human-known state; it does not scan a world/material Cartesian product or canonical hidden geology.

## Natural Map 1 — 40 years

Command: `node scripts/item5Pass4NaturalAudit.mjs --map map1 --years 40 --seed item5-pass4:map1`

Result: **PASS**.

Measured final-tree activity:

- bands producing `HumanMaterialBelief`: 1;
- distinct material-belief categories: 1;
- material beliefs observed: 1;
- compositional hypotheses observed: 9;
- named-historical-recognized hypotheses: 5;
- non-template hypotheses: 4;
- experiments observed: 7;
- revision ideas: 0;
- concluded failures / partials / successes: 0 / 0 / 0;
- abandoned experiments: 0;
- dead-end / dormant lessons: 0 / 0;
- reactivations: 0;
- independent convergent signatures: 1.

Observed maxima: fragments 6/20, material beliefs 1/12, ideas 5/8, experiments 4/4, responses 2/12, efficacy records 12/12, dead-end lessons 0/8, raw candidates 5/6 per problem and 9/18 globally.

Final bands: 5. Canonical Item-5 digest: `17ebd55be40343bf4010d32ae9fecf60973971a4be3bac1be90807e44a04f1d6`.

## Natural Map 2 — 40 years

Command: `node scripts/item5Pass4NaturalAudit.mjs --map map2 --years 40 --seed item5-pass4:map2`

Result: **PASS**.

Measured final-tree activity:

- bands producing `HumanMaterialBelief`: 3;
- distinct material-belief categories: 1;
- material beliefs observed: 3;
- compositional hypotheses observed: 40;
- named-historical-recognized hypotheses: 19;
- non-template hypotheses: 21;
- experiments observed: 29;
- revision ideas: 0;
- concluded failures / partials / successes: 0 / 0 / 1;
- abandoned experiments: 0;
- dead-end / dormant lessons: 2 / 0;
- reactivations: 0;
- independent convergent signatures: 5.

Observed maxima: fragments 7/20, material beliefs 1/12, ideas 6/8, experiments 4/4, responses 3/12, efficacy records 12/12, dead-end lessons 1/8, raw candidates 5/6 per problem and 12/18 globally.

Final bands: 9. Canonical Item-5 digest: `dc046a550d27c01a0a376e9eef22ed7eccc33f20924cceb087484964df3dd6b8`.

## Long Map 2 — 120 years

Command: `node scripts/item5Pass4NaturalAudit.mjs --map map2 --years 120 --seed item5-pass4:long:map2`

Result: **PASS**.

Measured final-tree activity:

- bands producing `HumanMaterialBelief`: 6;
- distinct material-belief categories: 2;
- material beliefs observed: 6;
- cumulative compositional hypothesis ids observed: 98;
- named-historical-recognized hypotheses: 26;
- non-template hypotheses: 72;
- experiments observed: 38;
- revision ideas: 2;
- concluded failures / partials / successes: 0 / 2 / 1;
- abandoned experiments: 2;
- dead-end / dormant lessons: 5 / 1;
- reactivations: 0;
- independent convergent signatures: 5.

Observed maxima: fragments 7/20, material beliefs 1/12, ideas 7/8, experiments 4/4, responses 4/12, efficacy records 12/12, dead-end lessons 2/8, raw candidates 5/6 per problem and 12/18 globally.

Final bands: 9. Canonical Item-5 digest: `4610cc2cd648ab6f75df8b5f574ad0868a90ae585486f4cb12ad1f83f51211ac`.

## Blocked-plan churn investigation

The pre-fix 120-year run produced 424 cumulative hypothesis ids despite bounded retained state. A dedicated read-only probe found 37 conceptual design keys and 19 blocked experiment keys; 12 blocked keys restarted, with the worst identical blocked plan started 74 times. This established a real repeated-planning defect rather than mere retained-state growth.

Root cause: experiment history is capped at four and already ranks true `underway` work above blocked plans, but candidate formation only remembered a blocked design while its experiment row remained in that store. Eviction made the unchanged design immediately eligible again.

The final source adds a bounded 32-tick reconsideration cooldown using existing selected composed-idea history. It adds neither a second plan authority nor a permanent blacklist. After correction:

- cumulative hypothesis ids fall from 424 to 98;
- non-template ids fall from 398 to 72;
- the worst identical blocked-plan start count falls from 74 to 9 over 480 seasons;
- common restarts occur at the intended 32-tick interval;
- retained maxima and raw-candidate budgets remain unchanged.

Classification: **immediate cycling corrected; bounded periodic reconsideration after 32 ticks remains an intentional current-resolution seam**. Blocked plans still fabricate zero attempts, execution, physical results, effects, or efficacy.

## Deterministic 50-year regression

Command: `node scripts/demographicLongRunAudit.mjs --map map2 --years 50 --repeat`

Result: **PASS**. Both repetitions produce fingerprint `2f4b6b3a13b78f6b30555d0b503c50eb308aa10d59e496b4561bc7edb3f34287`.

Key final results: start population 238, end population 214, active bands 9, extinct bands 0, movements 1077, adaptations attempted 8, adaptations effective 3, state caps held true, deterministic true.

No coefficient was tuned to obtain this fingerprint. It is the final closure-corrected behavior fingerprint after the bounded blocked-plan reconsideration fix.

## Performance interpretation

Candidate work is structurally bounded by fixed primitive/input, raw-candidate, shortlist, idea, experiment, hint, lesson, belief, response, and efficacy caps. The 120-year run completes with those caps intact and no retained-store growth with horizon. The pathological immediate re-planning loop identified during closure certification was removed; the remaining 32-tick retry seam is explicit and bounded.
