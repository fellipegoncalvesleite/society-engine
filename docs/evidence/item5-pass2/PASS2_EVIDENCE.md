# Roadmap Item 5 — Physical-Effect Provenance Pass 2 Evidence

Date: 2026-08-18
Branch: `checkpoint/item5-physical-effect-provenance-pass2`
Required base: `31ced032d901e81d9d6ce56aedd997c31df1d258`
RED commit: `f91f84d7ff7ed0a15db449ad64b4dd43ae8736ed`
Production commit: `2d7251d4456ba52e98b6ebaddd51c54a5f5575f9`
Status: Pass 2 implemented and certified; Roadmap Item 5 remains open and is not frozen. No merge or push is part of this pass.

## Scope and hard gates

This pass is deliberately narrower than a material/inventory system. It establishes physical-effect provenance at the existing practical-response authority and refuses to infer executed artifacts from learned fragments, response labels, experiment plans, or environmental outcomes.

Hard gates enforced:

- exact Pass-1 base only;
- RED before production edits;
- `practice_only` behavior remains physically and lifecycle non-vacuous;
- `material_execution_required` has zero physical effect and zero efficacy maturation without execution proof;
- persisted `waterWorks` remains the existing physical-work authority;
- no coefficient compensation;
- no inventory, crafting, resource-stock, Item-4, or downstream-consumer refactor;
- mutation must catch the old learned-label-as-artifact path and restore source byte-identically;
- stop after committed Pass 2 with Pass 3 / Item-5 freeze / merge / push unstarted.

## RED — reproduced on untouched Pass-1 production

`node scripts/item5PhysicalEffectProvenanceAudit.mjs` exited 1 as required before any production edit. Raw capture: `provenance_red.*`.

The test proves the defect through production behavior rather than source-text expectation:

- forming `load_staging` positive control: active, relief `0.08`;
- active `load_staging` positive control: active, relief `0.26`;
- learned/active `membrane_water_bag` with no executed-material authority: carried-water reader active with capacity `0.12`, carrying burden `0.03`, and effective storage `0.22` instead of the baseline `0.16`;
- synthetic success on that unexecuted material response changed it to `active`, incremented `successCount` to 1, concluded the experiment, incremented `attemptSeasons` to 1, and wrote one efficacy record;
- synthetic failure incremented `failureCount` and `attemptSeasons` and wrote an efficacy record despite no execution proof;
- persisted `waterWorks` positive control remained active with relief `0.12`.

This is the exact causal gap Pass 2 is authorized to close.

## Implementation

Every `VARIANT_SPECS` entry now declares exactly one execution class:

- `practice_only`: `load_staging`, `stage_known_water`, `load_tally_reckoning`, `journey_pacing_reckoning`;
- `existing_physical_work`: `seep_scrape`, `lined_seep_pit`;
- `material_execution_required`: `fiber_sling`, `carrying_frame`, `crude_bundle_float`, `braced_load_raft`, `membrane_water_bag`, `woven_lined_carrier`, `sealed_water_carrier`, `brush_windbreak`, `shade_screen`, `covered_rain_shelter`, `thrown_reach_hunting`, `hafted_point_hunting`, `tensioned_snare_line`, `wound_binding_care`, `plant_poultice_care`.

`src/sim/agents/practicalResponses.ts` owns the central rule:

- practice-only responses may use the existing fragment/response basis;
- existing physical work requires its persisted execution authority;
- portable material-required responses receive no physical execution proof because this repository does not yet have one.

The same helper gates response-bound efficacy before lifecycle, problem revision, experiment conclusion, efficacy records, and fragment success/failure. `deriveShelterPortabilityBurden()` is gated in the same module because it was the physical coefficient bypassing the common relief helper. No downstream physical consumer is patched.

Existing `waterWorks` remains a separate persisted physical authority and is consumed by its existing reader. No portable execution/inventory/crafting/resource-stock state was added.

`PracticalExperiment` comments and the Ideas/Solutions UI now describe `materials`, procedure, labor/risk, and opportunity cost as planned/estimated requirements. They do not assert acquisition, consumption, execution, or paid cost.

## GREEN

The Pass-2 audit exits 0. Raw captures: `provenance_green.*` and `cert_01_provenance.*`.

Measured post-fix behavior:

- forming practice-only load staging: active, relief `0.08`;
- active practice-only load staging: active, relief `0.26`;
- unexecuted membrane carrier: inactive, physical relief `0`, capacity `0`, leakage effect `0`, burden `0`;
- effective storage remains baseline `0.16`;
- synthetic unproven material success/failure: response remains `forming`, success/failure counts stay 0, experiment stays `underway`, `attemptSeasons` stays 0, and no efficacy record is written;
- practice-only success still matures to `active` and concludes its experiment with one attempt;
- persisted waterworks remains active with relief `0.12`.

All coefficient pins in the audit remain unchanged. `src/sim/agents/adaptiveEfficacy.ts` is byte-unchanged at SHA-256 `ca2603250e1716886e2bb21db2d1c3bed5114d7ed8cf9213761747acbb72e919`.

## Required mutation

The mutation temporarily changed the `material_execution_required` branch of the central proof helper to return `true`, exactly re-authorizing the forbidden learned-label-as-executed-artifact path.

The Pass-2 audit then exited 1 and reproduced the material physical/lifecycle effects. Source restoration is byte-identical:

- before SHA-256: `d59c22929c40641d2bbdec84edb9b49cabd3e0b8c3ca05dc30396ff3ccc19a04`;
- after SHA-256: `d59c22929c40641d2bbdec84edb9b49cabd3e0b8c3ca05dc30396ff3ccc19a04`.

Raw capture: `mutation.*`, `mutation_before.sha256`, `mutation_after.sha256`, `mutation_restoration.txt`.

## Certification battery

All required live gates below exited 0; command/stdout/stderr/exit captures are stored as `cert_01_*` through `cert_12_*`:

1. `node scripts/item5PhysicalEffectProvenanceAudit.mjs`
2. `npx tsc -p tsconfig.json --noEmit`
3. `npx tsc -p tsconfig.node.json --noEmit`
4. `npm run build`
5. `node scripts/adaptationBoundaryAudit.mjs`
6. `node scripts/expeditionAdaptationEfficacyAudit.mjs`
7. `node scripts/fissionFieldTransferAudit.mjs --out docs/evidence/item5-pass2/cert_07_fission_transfer.json`
8. `node scripts/item4WholeIntegrationFreezeAudit.mjs --out docs/evidence/item5-pass2/cert_08_item4_whole.json`
9. `node scripts/demographicLongRunAudit.mjs --map map2 --years 50 --repeat`
10. `npm run sim:benchmark -- --targeted-practical-adaptation-check`
11. `npm run sim:benchmark -- --targeted-adaptive-efficacy-check`
12. `npm run sim:benchmark -- --targeted-routines-2-check`

The 50-year Map-2 repeat reports `deterministic: true` and the exact same fingerprint in both runs:

`f509b2f4d6e8a463b7505025afe22d151fd45a0598bd9550fbb84aac900da03c`

The natural run is not adaptation-vacuous: 8 adaptations attempted, 3 effective. End population is 213 across 9 living bands; population accounting reconciles (`238 + 201 - 226 = 213`).

## Historical Pass-1 audit diagnostic

`scripts/item5AdaptationAuthorityAudit.mjs` is retained unmodified as a historical Pass-1 instrument. It exits 1 on Pass 2 for exactly one reason: `practicalPhysicalAndEfficacyFormulaSourcesUnchanged` is false because that audit intentionally pins the Pass-1 `practicalResponses.ts` source hash.

That is not a Pass-2 regression gate: Pass 2 is explicitly authorized to change `practicalResponses.ts`. Every live authority check in that audit remains true, and its `adaptiveEfficacy.ts` frozen hash remains unchanged. Raw capture: `diagnostic_pass1_hash_gate.*`. The historical audit was not weakened to make it green.

## Scope audit / non-claims

Committed production changes from the exact base through the production commit are limited to:

- `src/sim/agents/practicalResponses.ts` — provenance classification and central effect/efficacy gate;
- `src/sim/agents/types.ts` — truth-in-documentation comments for experiment requirements;
- `src/sim/agents/inventionChain.ts` — truth-in-documentation comment only;
- `src/ui/band/IdeasSolutions.tsx` — planned/estimated labels only.

Plus the new Pass-2 audit and its RED evidence. See `scope_diff.txt`.

Not done and not claimed:

- no material inventory;
- no crafting;
- no resource stock;
- no portable material execution authority;
- no coefficient tuning to compensate for removed magic effects;
- no `adaptiveEfficacy.ts` formula change;
- no Item-4 code change;
- no downstream physical-consumer refactor;
- no Pass 3;
- no Item-5 freeze;
- no merge;
- no push.

Final clean-worktree status is verified after the evidence/documentation commit, because a file cannot truthfully contain the status of the commit that contains itself. `isolation.txt`, `source_hashes.txt`, and `certification_summary.txt` carry the pre-final-commit evidence needed to audit the close.
