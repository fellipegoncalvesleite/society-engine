# Roadmap Item 5 — Adaptation Authority Consolidation Pass 1 Evidence

## Scope / authority

- Frozen base: `11f085930462f981fcca45faf37b67d961196adb` (`chore: freeze roadmap item 4`).
- Isolated worktree: `/Users/fellipegoncalvesleite/.worktrees/society-engine-item5-adaptation-authority-pass1`.
- Branch: `checkpoint/item5-adaptation-authority-pass1`.
- Implementation HEAD used for full GREEN verification before this documentation/evidence commit: `437fdc7d5f33118d2c80a8e163d3c2526af8fc2d`.
- Canonical Item-5 state: `band.practicalAdaptation`.
- Legacy compatibility state: `band.adaptiveHuman`, routed through `src/sim/agents/legacyAdaptiveHumanCompatibility.ts`.
- This pass does not repair physical artifact/material execution debt and does not begin Pass 2.

## TDD RED

`node scripts/item5AdaptationAuthorityAudit.mjs` was created before production edits and run on the frozen source. It exited `1` for the intended structural reason: `src/sim/agents/adaptationBoundary.ts` still exported the legacy adaptive-human operations as peers and no dedicated compatibility boundary existed. The RED output also showed the two existing `bandDecision.ts` fallback gates and both frozen formula hashes still passing.

Evidence: `authority_red.*`.

## Minimal GREEN implementation

- Added the small curated `src/sim/agents/legacyAdaptiveHumanCompatibility.ts` legacy surface; algorithms remain in `adaptiveHuman.ts`.
- Made `src/sim/agents/adaptationBoundary.ts` canonical practical-only.
- Migrated existing production callers mechanically, preserving call-site logic:
  - `src/sim/rules/bandDecision.ts`
  - `src/sim/rules/decisionCandidateTypes.ts`
  - `src/sim/agents/demography.ts`
  - `src/sim/agents/fissionDepartureSeam.ts`
  - `src/sim/agents/knowledgeCarriers.ts`
  - `src/sim/agents/publicHumanStory.ts`
- Updated `scripts/adaptationBoundaryAudit.mjs` to report canonical and legacy compatibility authority separately while retaining its runtime chain/effect/parity checks.
- Reconciled current authority/status wording in `docs/HANDOFF.md`, `AGENTS.md`, and `CLAUDE.md`; historical checkpoint logs remain intact.

## GREEN verification

| Gate | Command | Exit | Verdict |
|---|---|---:|---|
| App TypeScript | `npx tsc -p tsconfig.json --noEmit` | 0 | PASS |
| Node TypeScript | `npx tsc -p tsconfig.node.json --noEmit` | 0 | PASS |
| Production build | `npm run build` | 0 | PASS |
| Item-5 authority audit | `node scripts/item5AdaptationAuthorityAudit.mjs` | 0 | PASS |
| Existing adaptation boundary audit | `node scripts/adaptationBoundaryAudit.mjs` | 0 | PASS |
| Expedition adaptation/efficacy | `node scripts/expeditionAdaptationEfficacyAudit.mjs` | 0 | PASS |
| Fission field transfer | `node scripts/fissionFieldTransferAudit.mjs --out docs/evidence/item5-pass1/green_07_fission_transfer.json` | 0 | PASS, 12/12 non-vacuous fixtures |
| Item-4 whole integration freeze | `node scripts/item4WholeIntegrationFreezeAudit.mjs --out docs/evidence/item5-pass1/green_08_item4_whole.json` | 0 | PASS, 6/6 fixtures |
| Deterministic natural adaptation long-run | `node scripts/demographicLongRunAudit.mjs --map map2 --years 50 --repeat` | 0 | PASS |
| Diff whitespace | `git diff --check` | 0 | PASS |

The deterministic natural run completed 50 years twice with identical fingerprint `5f00bc43d90371e77aa84a76761be4fb1349a669debeb81c53623df33a94ae30`, observer parity true, 25 naturally attempted adaptations, and 3 effective adaptations. Evidence: `green_09_deterministic_natural_adaptation.*`.

## Mutation proof

A temporary, uncommitted forbidden re-export of `advanceAdaptiveHumanState` was added to `adaptationBoundary.ts`. The Item-5 authority audit exited `1` and failed specifically `canonicalBoundaryDoesNotExportLegacyAdaptiveHuman`. The file was then restored byte-identically; the before/after SHA-256 matched and the audit exited `0` again.

Evidence: `mutation_*`.

## Behavioral-diff proof

- `src/sim/agents/practicalResponses.ts` remains byte-identical to the frozen base, SHA-256 `432a0fb0a9826ead77648937e6d8626f6d5d62653a0a8768d979614f36b26a8e`.
- `src/sim/agents/adaptiveEfficacy.ts` remains byte-identical to the frozen base, SHA-256 `ca2603250e1716886e2bb21db2d1c3bed5114d7ed8cf9213761747acbb72e919`.
- No storage-capacity, carrying, relief, efficacy, invention-speed, fragment-threshold, material-availability, or response-confidence formula was changed.
- The `bandDecision.ts` behavioral gates are unchanged; its production diff is import routing/commentary only.
- Demography/fission lifecycle behavior is unchanged; the fission-related production changes are import routing only, with practical inheritance remaining on the canonical boundary and adaptive-human inheritance moving to the compatibility boundary.
- The pre-existing frozen Item-4 fission/whole-integration evidence files are unchanged. The final fission and whole-integration audits were redirected into this Item-5 evidence directory.
- `main` was not checked out, merged, or mutated. Its latest reflog entry is `e74e7e82cc038c009ecbab2146bea87ae3f2e60e` from 2026-08-16, before this pass.

Exact source patch and isolation evidence: `behavior_diff_proof.txt`, `isolation_proof.txt`.

## Diagnostic baseline issue discovered

`allMapLivingEcologyAudit.mjs` was initially selected as the natural adaptation regression because it explicitly runs 25 years for emergent adaptation. It exits `1` on this worktree only because `noDuplicateFoodAuthority` is false. The exact same audit at the untouched frozen Item-4 SHA also exits `1` on that same check, with the same adaptation-specific result (`adaptationsNotDecorative: true`) and the same per-map adaptation counts. No Item-5 fix was attempted for this unrelated inherited baseline debt. The passing deterministic 50-year Map-2 long-run above is the required natural adaptation regression for this pass.

Evidence: `diagnostic_all_map_current.*`, `diagnostic_all_map_frozen_base.*`.

## Unexpected source discovered during implementation

The frozen source had three additional legacy-boundary consumers beyond the controller's known-likely call-site list:

- `src/sim/rules/decisionCandidateTypes.ts` uses the `AdaptiveDecisionSupport` type.
- `src/sim/agents/knowledgeCarriers.ts` uses `deriveAdaptiveHumanProfile`.
- `src/sim/agents/publicHumanStory.ts` uses `deriveAdaptiveHumanProfile`.

Those findings are why `deriveAdaptiveHumanProfile` is genuinely required on the curated compatibility boundary rather than exported gratuitously.

A separate audit-harness behavior was also found: the fission-field-transfer and Item-4 whole-integration audits write default JSON evidence files. Baseline executions touched those files; they were immediately restored byte-identically and the final executions use explicit `--out` paths in this Item-5 directory.

## Open debt / stop condition

Portable artifact/material physical execution and provenance debt remains OPEN. This pass intentionally does not change storage capacity, material stock/object authority, carrying coefficients, relief formulas, thresholds, or any Item-16 resource model. Do not merge `main`; do not begin Item-5 Pass 2 until controller review.
