# Roadmap Item 5 Pass 4 — Migration and Compatibility

Status: measured migration/certification record. Historical evidence files were not rewritten to make current production fit old assumptions.

## Pass-1 authority-audit migration

The old Pass-1 audit froze the complete hash of `practicalResponses.ts`. That whole-file hash is no longer a valid invariant because Pass 4 necessarily changes Item-5 response orchestration.

The live compatibility audit now preserves the reason the guard existed instead of freezing an obsolete file shape:

1. `src/sim/agents/adaptiveEfficacy.ts` remains byte-identical to the accepted Pass-3 authority: SHA-256 `ca2603250e1716886e2bb21db2d1c3bed5114d7ed8cf9213761747acbb72e919`.
2. Pass-2 physical execution provenance classes/gates remain authoritative; the focused provenance audit passes.
3. Material-execution-required responses cannot regain physical effect or efficacy without execution proof.
4. `band.practicalAdaptation` remains the only canonical Item-5 adaptation authority; no duplicate writer was introduced through `adaptiveHuman`, technologies, projections, or UI.

Fresh result: `node scripts/item5AdaptationAuthorityAudit.mjs` => PASS.

## Pass-3 projection/inheritance migration

The old live projection/inheritance audit assumed `problemCap === 5` and treated fragments/problems as the complete inheritable practical-knowledge surface. Pass 4 intentionally changes those schema assumptions.

The current live invariant is:

- problem cap: 6;
- fragment cap: 20;
- material-belief cap: 12;
- design-hint cap: 8;
- revision/dead-end lesson cap: 8;
- response cap: 12;
- efficacy cap: 12;
- idea cap: 8;
- experiment cap: 4.

The migrated audit proves daughter transfer may include degraded material beliefs/design hints while still refusing parent execution, efficacy, waterworks, local material occurrence, or local competence as daughter-local proof.

Fresh result: `node scripts/item5ProjectionInheritanceAudit.mjs` => PASS.

## Invention-3 benchmark migration discovered during final certification

Final certification found a stale benchmark rather than a production regression. `--targeted-invention-3-audit` still expected unexecuted water carriers, shelters, hunting material, and treatments to create physical effects and still enforced the old fragment/problem caps. Those expectations directly conflicted with accepted Pass-2 execution provenance and Pass-4 bounded state.

The benchmark fixture was migrated, not weakened:

- a material design may be selected and have an experiment plan without physical execution;
- its `executionOccurred` remains false and it cannot create material physical effects or efficacy;
- practice-only proto-measurement remains able to improve reckoning;
- persisted `waterWorks` remains a legitimate existing physical authority;
- unexecuted shelter/hunting/treatment plans produce zero physical effect;
- current store caps are checked explicitly.

Fresh result after migration: `--targeted-invention-3-audit` => `passed: true`, 23/23 checks.

## Compatibility with Item 4

`src/sim/agents/fissionFieldTransferPolicy.ts` receives only an Item-5 compatibility-description/classification update for the richer degraded practical-adaptation surface. No founder allocation, departure, travel, stabilization, reintegration, fission timing, or other Item-4 physical mechanic was changed.

Fresh regression evidence:

- Item-4 fission field transfer: 12/12 PASS, 0 vacuous;
- Item-4 whole integration freeze: 6/6 PASS;
- graph integrity: 221 nodes / 764 edges, 0 duplicate node ids, 0 dangling links;
- import boundary: PASS, 87 recorded agent-agent back edges.

## Legacy compatibility surfaces

`band.adaptiveHuman` remains compatibility/read-model only. `Band.technologies` remains legacy only. `materialAffordance` remains a projection/read model. No new causal reader/writer authority was granted to any of them.

The selected-band UI reads the canonical projection and does not own simulation state.
