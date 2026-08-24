# Roadmap Item 5 Pass 4 — Migration and Compatibility

Status: final closure-correction migration/certification record pending independent architect review. Historical evidence is not rewritten to make the rejected `1352c568...` tree appear correct.

## Pass-1 authority-audit migration

The old Pass-1 audit once froze broader implementation shape that Pass 4 necessarily changes. The live compatibility gate now preserves the causal invariant instead:

1. `src/sim/agents/adaptiveEfficacy.ts` remains byte-identical to accepted Pass 3 at SHA-256 `ca2603250e1716886e2bb21db2d1c3bed5114d7ed8cf9213761747acbb72e919`.
2. Pass-2 execution provenance classes/gates remain authoritative.
3. `material_execution_required` responses cannot regain physical effect or efficacy without execution proof.
4. `band.practicalAdaptation` remains the single canonical Item-5 adaptation/history authority.

Fresh final result: `node scripts/item5AdaptationAuthorityAudit.mjs` => **PASS, 19/19**.

## Pass-3 projection/inheritance migration

Pass 4 adds bounded material-belief/design-hint/revision state, so a fixture that treated fragments/problems as the complete inheritable practical-knowledge surface became stale.

Current live caps are:

- problems 6;
- fragments 20;
- material beliefs 12;
- design hints 8;
- revision/dead-end lessons 8;
- responses 12;
- efficacy 12;
- ideas 8;
- experiments 4.

The migrated audit proves daughter transfer may include degraded material beliefs/design hints while refusing parent execution, efficacy, waterworks, current local material occurrence, or local competence as daughter-local proof.

Fresh final result: `node scripts/item5ProjectionInheritanceAudit.mjs` => **PASS, 40/40**.

## Practical-adaptation / Invention-3 blocked-plan migration

The reviewed closure candidate still carried older fixture expectations that unsupported material plans could remain `underway`. That expectation conflicts with the corrected execution/history semantics.

The stronger migrated invariant is:

```text
no execution authority
→ blocked_by_execution
→ attemptSeasons = 0
→ executionOccurred = false
→ zero material physical effect
→ zero efficacy maturation
```

The practical-adaptation suite now verifies this while retaining positive controls for legitimate practice-only work and existing narrow physical work.

Fresh final results:

- `--targeted-practical-adaptation-check` => **PASS, 27/27**;
- `--targeted-invention-3-audit` => **PASS, 23/23**.

This is a benchmark/test migration, not a relaxation of production execution requirements.

Final long-run certification additionally found that cap eviction could cause the same non-template blocked plan to be recreated immediately. The narrow correction uses the already-canonical bounded idea history as a 32-tick reconsideration cooldown for selected `composed:` designs. It does not suppress historical executable variants, does not add execution authority, and does not create a second durable plan ledger.

## Projection truth correction

A stored historical lifecycle label such as `concluded_success` is not itself canonical proof that physical execution happened. The selected-band diagnostic projection was corrected so absent canonical execution proof is not presented as admitted execution/success truth.

```text
stored historical claim != admitted canonical execution truth
```

Fresh Pass-3 projection/inheritance and Pass-4 controlled audits cover this stronger interpretation.

## Closure-test migration and RED chronology

The closure audit grew from 26 A–P assertions to 31 assertions including Q/R/S/T plus a static composition-order guard. The reversible mutation suite grew from M1–M6 to M1–M10.

The old stored RED output is retained as historical evidence of a failed capture but is not claimed as semantic RED: it failed at module loading. A detached reproduction against exact rejected SHA `1352c568...` instead establishes the four defect failures Q/R/S/T with exit non-zero, 4 failed and 27 passed.

## Compatibility with Item 4

`src/sim/agents/fissionFieldTransferPolicy.ts` receives only the already-authorized Item-5 compatibility classification for the richer degraded practical-adaptation surface. The closure correction does not redesign Item-4 departure, travel, transfer, stabilization, or reintegration mechanics.

Fresh final regression evidence:

- Item-4 fission field transfer: **12/12 PASS, 0 vacuous**;
- Item-4 whole integration: **6/6 PASS**;
- architecture graph: **221 nodes / 764 edges / 0 duplicate ids / 0 dangling links**;
- import boundary: **PASS**.

The import-boundary audit currently reports 68 internal sim back-edges as informational metadata. The prohibited simulation import boundary remains clean.

## Legacy compatibility surfaces

`band.adaptiveHuman` remains compatibility/read-model only. `Band.technologies` remains legacy only. `materialAffordance` remains projection/read model. The selected-band UI reads projection state and owns no simulation writer.

Historical complete design definitions may still be used for recognition/compatibility and existing effect adapters. They no longer define the discovery universe: a candidate is composed first from bounded primitives, then optionally recognized.

## Non-migrations

No compatibility migration in this correction adds or begins:

- WORLD-M0;
- canonical geology/material occurrence;
- extraction or inventory;
- craft/production;
- task-level labor;
- construction or metallurgy;
- physical trade;
- culture/adoption;
- Item 6;
- Pass 5;
- roadmap rewrite.
