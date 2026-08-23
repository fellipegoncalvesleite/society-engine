# Roadmap Item 5 Pass 4 — Caps and Performance

Status: fresh exact-tree natural/long-run boundedness evidence from the closure-candidate tree. Wall-clock timings are measurements on the operator machine, not calibrated cross-machine benchmarks.

## Fixed production budgets

Pass-4 production limits include:

- fragments per band: 20;
- human material beliefs per band: 12;
- design hints per band: 8;
- revision/dead-end lessons per band: 8;
- problems per band: 6;
- responses per band: 12;
- efficacy records per band: 12;
- ideas per band: 8;
- experiments per band: 4;
- raw candidates per problem: 6;
- raw candidates globally per band/update: 18;
- shortlisted candidates per problem: 3.

Candidate generation reads bounded human-known stores and fixed generic/template design primitives. It performs no whole-world material scan and no candidate Cartesian product over world materials.

## Natural Map 1 — 40 years

Command: `node scripts/item5Pass4NaturalAudit.mjs --map map1 --years 40 --seed item5-pass4:map1`.

Result: **PASS**.

Measured natural activity on the final exact source bytes:

- bands producing `HumanMaterialBelief`: 1;
- distinct material-belief categories: 1;
- material beliefs observed: 1;
- compositional hypotheses observed: 14;
- named-template-recognized hypotheses: 5;
- non-template hypotheses: 9;
- experiments observed: 8;
- revision ideas: 0 — not naturally observed at this horizon;
- concluded failures: 0;
- concluded partials: 0;
- concluded successes: 0;
- abandoned experiments: 0;
- dead-end lessons: 0;
- dormant lessons: 0;
- reactivations: 0 — not naturally observed at this horizon;
- independent convergent signatures: 1.

Observed maxima:

- fragments 6 / cap 20;
- material beliefs 1 / cap 12;
- ideas 6 / cap 8;
- experiments 4 / cap 4;
- responses 2 / cap 12;
- efficacy records 12 / cap 12;
- dead-end lessons 0 / cap 8;
- raw candidates per problem 5 / cap 6;
- raw candidates globally 10 / cap 18.

Final band count: 5. Canonical Item-5 digest: `3626b45cf28088e26860989a51b9d2acdac69ba3eb059f6be56b063f789a84ae`.

Representative measured runtime from the final rerun: 8,575 ms total; 53.60 ms per simulated season.

## Natural Map 2 — 40 years

Command: `node scripts/item5Pass4NaturalAudit.mjs --map map2 --years 40 --seed item5-pass4:map2`.

Result: **PASS**.

Measured natural activity on the final exact source bytes:

- bands producing `HumanMaterialBelief`: 3;
- distinct material-belief categories: 1;
- material beliefs observed: 3;
- compositional hypotheses observed: 42;
- named-template-recognized hypotheses: 19;
- non-template hypotheses: 23;
- experiments observed: 30;
- revision ideas: 0 — not naturally observed at this horizon;
- concluded failures: 0;
- concluded partials: 0;
- concluded successes: 1;
- abandoned experiments: 0;
- dead-end lessons observed: 2;
- dormant lessons: 0;
- reactivations: 0 — not naturally observed at this horizon;
- independent convergent signatures: 5.

Observed maxima:

- fragments 7 / cap 20;
- material beliefs 1 / cap 12;
- ideas 6 / cap 8;
- experiments 4 / cap 4;
- responses 3 / cap 12;
- efficacy records 12 / cap 12;
- dead-end lessons 1 / cap 8;
- raw candidates per problem 5 / cap 6;
- raw candidates globally 12 / cap 18.

Final band count: 9. Canonical Item-5 digest: `4f59ed6878e4685947742048b61ce3a93fcfab1f916f936fb545000fe0ed5cc4`.

Representative measured runtime from the final rerun: 17,109 ms total; 106.93 ms per simulated season.

## Long Map 2 — 120 years

Command: `node scripts/item5Pass4NaturalAudit.mjs --map map2 --years 120 --seed item5-pass4:long:map2`.

Result: **PASS**.

Measured natural activity on the final exact source bytes:

- bands producing `HumanMaterialBelief`: 6;
- distinct material-belief categories: 2;
- material beliefs observed: 6;
- compositional hypotheses observed: 56;
- named-template-recognized hypotheses: 27;
- non-template hypotheses: 29;
- experiments observed: 40;
- revision ideas observed: 3;
- concluded failures: 0 at this seed/horizon;
- concluded partials: 2;
- concluded successes: 1;
- abandoned experiments: 2;
- dead-end lessons observed: 5;
- dormant lessons observed: 1;
- reactivations: 0 — not naturally observed at this seed/horizon;
- independent convergent signatures: 5.

Observed maxima:

- fragments 7 / cap 20;
- material beliefs 1 / cap 12;
- ideas 7 / cap 8;
- experiments 4 / cap 4;
- responses 4 / cap 12;
- efficacy records 12 / cap 12;
- dead-end lessons 2 / cap 8;
- raw candidates per problem 5 / cap 6;
- raw candidates globally 12 / cap 18.

Final band count: 9. Canonical Item-5 digest: `ff12c6b9cd1f2b25997a5e3af78928d53a740e6fef64e332495818bb85f28af5`.

Representative measured runtime from the final rerun: 54,136 ms total; 112.78 ms per simulated season.

The 120-year run demonstrates bounded stores and a fixed candidate budget with no observed combinatorial explosion. Candidate maxima remain below both raw-generation caps despite the longer history. Importantly, partial outcomes are naturally present in the final 120-year run; the earlier evidence statement that they were absent was generated from a pre-final source state and is superseded by this record.

## Deterministic long-run regression

Final exact-tree command: `node scripts/demographicLongRunAudit.mjs --map map2 --years 50 --repeat`.

Result: **PASS**, with both repetitions byte-identical at:

`1d442858bfece8f51f7a901c4a589b0f66f2696bef9a43d68044e21d58d5d9cd`

Two additional fresh Node processes running the same 50-year Map-2 audit independently produced the same fingerprint and the same key outcome counts (`endPopulation=214`, `activeBands=9`, `movements=1077`, `adaptationsAttempted=6`, `adaptationsEffective=3`). Thus the final source bytes reproduce the fingerprint across four executions, including independent processes.

An earlier evidence capture recorded `1d4424667b4047a705877dda15befff86148cb50ccc8e92b5276fa5156d24744`. That value is not reproducible from the final exact source bytes and is superseded as stale pre-final evidence; it is not treated as an ongoing nondeterminism signal. The Pass-3-to-Pass-4 causal divergence classification is documented separately in `DIVERGENCE_EVIDENCE.md`.
