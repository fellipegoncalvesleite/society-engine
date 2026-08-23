# Item 5 Pass 3 — canonical projection and inheritance evidence

## Scope and status

- Exact accepted Pass-2 base: `31363c4f8e19e1c4f536338ecd0ef59e3fa7082f`.
- Branch: `checkpoint/item5-projection-inheritance-pass3`.
- Worktree: `/Users/fellipegoncalvesleite/.worktrees/society-engine-item5-projection-inheritance-pass3`.
- Pass 3 changes Item-5 read-model authority. The 2026-08-23 final correction also
  fixes audit-run provenance metadata and adds durable architecture-ownership
  governance. It does not change Item-4 simulation mechanics, daughter-transfer
  richness, physical-effect gates, coefficients, or the deterministic Map-2
  trajectory. Item 5 remains open and unfrozen, and Pass 3 remains pending
  independent architect review; this evidence is not a merge or acceptance record.

## Final provenance / capacity / audit-truth correction — 2026-08-23

This section supersedes earlier Pass-3 certification claims wherever they conflict
with it. The correction started from reviewed HEAD
`c49ba4674700903bc231f1900b9834d6e2fa4f16` with accepted Pass-2 merge base
`31363c4f8e19e1c4f536338ecd0ef59e3fa7082f`, a clean worktree, exact upstream
parity (`0 0`), and no unrelated commits. The implementation remains on
`checkpoint/item5-projection-inheritance-pass3`; Item 5 is not frozen and `main`
was not merged.

### RED controls and GREEN semantics

Commit `fe2c66bbe03ecaca96a61e0296e4514badfae36c` added the four final-correction
controls before production repair. The pre-fix audit exited `1`, reported 40 total
checks with exactly four failures, and measured the defects directly:

- **Efficacy-only orphan:** a retained `carrying_load` efficacy record with its
  response/idea/experiment absent was incorrectly `practice_attempted`, admitted
  the stale efficacy as execution evidence, emitted a visible practice diffusion
  trace, and exposed clear-success outcome/classification in normal UI.
- **Material-capable efficacy-only orphan:** the same loss of provenance in the
  `water_storage` family also became `practice_attempted`, admitted stale success,
  diffused it, and exposed it. Losing the variant therefore increased authority by
  erasing the evidence that might have classified it as material-required.
- **Canonical capacity pressure:** ten retained response records produced only nine
  canonical rows; `response:audit:cap-10` was silently absent because the canonical
  adapter inherited the legacy display cap of 9.
- **Item-4 run provenance:** both audit writers inherited a seeded
  `2000-01-01T00:00:00.000Z` timestamp from an existing output artifact rather than
  timestamping the current invocation.

Commit `c3f60d5ed8f5c11a7f44b91beb8209c007840880` applies positive execution
authorization. `derivePracticalVariantExecutionClass(...) === undefined` now yields
`execution_provenance_unproven`; unresolved provenance cannot admit execution
evidence. In the final GREEN fixtures both orphan families have:

- `executionEvidenceAdmitted: false`;
- `attemptSeasons: 0`;
- admitted `efficacyRecordIds: []`;
- the canonical record still preserved in `recordedEfficacyRecordIds`;
- `currently_unsupported` candidate status;
- `not_started` / `blocked_no_attempt` / `blocked` readiness;
- zero visible practice-trace diffusion items;
- no normal-UI clear-success outcome or classification.

This is the permanent monotonicity rule: **loss of provenance may preserve or reduce
authority; it may never increase authority.** Record existence is not execution
proof, efficacy proof, or successful practice. The diagnostic read model may state
that canonical efficacy was retained while execution provenance is unavailable.

The canonical adapter no longer applies the 9-row display cap.
`deriveCanonicalPracticalAdaptationRows()` returns every row implied by the already
bounded retained lifecycle arrays. The controlled 10-response fixture returns all
ten response IDs in deterministic order, including exact response
`response:audit:cap-10`, with its missing idea/experiment links and efficacy link
intact. The public profile may still display nine candidates, but now reports
`canonicalRowCount: 10`, `omittedCanonicalCandidateCount: 1`, and the explicit line
`Showing 9 of 10 retained canonical lifecycle rows; 1 omitted from this bounded
display only.` A display limit is therefore no longer canonical-history authority.

Commit `662d843ba9c66709ffc34d4086564f4b5b4c752f` removes old-artifact timestamp
reuse from both Item-4 audit writers. Every invocation writes a fresh current-run
`generatedAt`, including failure output. The final projection audit executes each
writer twice through isolated temporary output paths preloaded with the year-2000
timestamp; all four invocations timestamp themselves inside their own measured run
window and do not inherit the prior artifact.

Deterministic audit comparison now normalizes **only the root `generatedAt` field**.
No behaviorally meaningful field is removed. Two consecutive runs of each Item-4
writer are semantically identical after that normalization. Final retained-artifact
proof against the prior committed artifacts is:

| Artifact | Prior raw SHA-256 | Fresh raw SHA-256 | Semantic SHA-256 before/after |
| --- | --- | --- | --- |
| `fission-field-transfer.json` | `ff897ce981623cfcdfdc6a6e049f4aab7787acb23aa362b5f3ba2424c683cfe5` | `059f1e19048e12f7e90c3dc8fd43a52500d5584b978cd602f337ae0cc18fed86` | `278d5d560f951c8ded4b6408cda15665b4d2c337ab1ca596fa3a3a07857f639b` |
| `item4-whole-integration.json` | `4255aa0456ca04f3340c71985517b44965abfdb7d45143dea6e54ad2f2e4cd3f` | `c9bcd0ef899f1a3cbdae53d0bade4b61f8b7406c05f051f5e0ea19d777f2402c` | `eca57acda4faea58c91454e0d9e59bae3afe493d96b853040c1a2bd3b8a72b64` |

The raw-byte changes are expected provenance changes. The semantic digests are
identical. This explicitly supersedes the earlier claim that reusing an existing
`generatedAt` was the correct mechanism for deterministic audit evidence.

### Final-correction mutation sensitivity

After GREEN, a reversible mutation changed only unresolved-class admission so that
`executionClass === undefined` became admissible again. The focused audit exited
`1`; exactly `orphanEfficacyCannotCreateExecutionAuthority` and
`orphanMaterialEfficacyCannotGainAuthorityFromLostVariant` failed. Restoration used
the saved exact bytes, not Git reset/checkout. SHA-256:

```text
before  419772dc1969b21a1cae9c9b67c874a52197589a8cd4260a4959e1eb87632c8e
mutated 98946adeac9f1679341bbcbad27150a8e738cd74ba40bc8b0e43ed7a6fcca9d5
after   419772dc1969b21a1cae9c9b67c874a52197589a8cd4260a4959e1eb87632c8e
```

`before == after` is true.

### Final verification

The exact required full verification was rerun after restoring the mutation:

| Command | Semantic result |
| --- | --- |
| `npx tsc -p tsconfig.json --noEmit` | exit 0 |
| `npx tsc -p tsconfig.node.json --noEmit` | exit 0 |
| `npm run build` | exit 0; Vite built 2,144 modules; existing >500 kB chunk advisory only |
| `node scripts/item5PhysicalEffectProvenanceAudit.mjs` | `PASS`, 13/13 |
| `node scripts/item5ProjectionInheritanceAudit.mjs` | `PASS`, 40/40 |
| `node scripts/adaptationBoundaryAudit.mjs` | `PASS`, 14/14 |
| `node scripts/expeditionAdaptationEfficacyAudit.mjs` | `PASS`, 12/12 |
| `node scripts/fissionFieldTransferAudit.mjs --out .../fission-field-transfer.json` | 12/12, 0 failing, 0 vacuous |
| `node scripts/item4WholeIntegrationFreezeAudit.mjs --out .../item4-whole-integration.json` | 6/6, 0 failing |
| `node scripts/demographicLongRunAudit.mjs --map map2 --years 50 --repeat` | `PASS`; all seven checks true; both fingerprints exact and identical |
| targeted practical-adaptation benchmark | `passed: true`; 27/27 assertions true |
| targeted adaptive-efficacy benchmark | `passed: true`; 26/26 assertions true |
| targeted routines-2 benchmark | `passed: true`; 38/38 assertions true |
| `git diff --check` | exit 0 |

The exact Map-2 fingerprint in both 50-year runs remains:

```text
f509b2f4d6e8a463b7505025afe22d151fd45a0598bd9550fbb84aac900da03c
```

No coefficient was tuned to preserve it.

### Durable ownership rule

`docs/ARCHITECTURE_OWNERSHIP.md` is now the permanent architect/implementer
ownership and escalation contract. `AGENTS.md` and `CLAUDE.md` link to it without
duplicating it. It records architect authority over consequential design, local
implementer authority, architectural escalation, stronger specification for weaker
local models, the duty to surface contradictions rather than obey known-bad design,
and the future cross-system roadmap-review rule. It does **not** perform the
post-Item-5 roadmap rewrite.

## Checkpoint finalization and provenance

The durable checkpoint reference is
`refs/heads/checkpoint/item5-projection-inheritance-pass3` and its remote-tracking
counterpart `refs/remotes/origin/checkpoint/item5-projection-inheritance-pass3`.
Before this finalization correction, the measured pushed checkpoint was
`effe5e7188c1f25e87b7a52220cda37df5cd2466` on both refs. Its author and
committer were both `fellipegoncalvesleite
<207756005+fellipegoncalvesleite@users.noreply.github.com>`; `git status
--short` produced no output and the ahead/behind count was `0 0`.

The measured provenance commands were:

```text
git rev-parse HEAD
git rev-parse @{upstream}
git rev-list --left-right --count HEAD...@{upstream}
git show -s --format='author=%an <%ae>%ncommitter=%cn <%ce>' HEAD
git status --short
git diff --check
```

A file cannot truthfully embed the hash of the commit that contains that same
file: changing the file changes the commit hash. Therefore this evidence names
the checkpoint branch/ref as the durable finalization identity and records the
prior measured pushed hash above. The actual post-commit final HEAD, upstream
hash, and parity must be measured after the commit and are recorded in the
ignored implementer report rather than guessed here.

## Design decision and authority boundary

Three designs were considered in the accepted specification:

- **A, selected:** one pure canonical adapter maps
  `band.practicalAdaptation` into both established public profiles. Existing
  entry points route canonical bands to the adapter and use the old heuristics
  only for explicit `legacy_compatibility` fallback.
- **B, rejected:** separate canonical-first rewrites in the two profile modules
  would duplicate lifecycle, family, efficacy, and execution-truth mapping.
- **C, rejected:** a UI-only correction would leave camp, diffusion,
  adaptive-human, story, and knowledge-carrier read models able to narrate a
  second history.

The canonical hierarchy is persisted practical-adaptation facts → one pure
adapter → existing read-model APIs → downstream UI/read-only consumers. The
adapter maps stored problem, idea, experiment, response, efficacy, fragment,
and matching `waterWorks` facts; it does not infer lifecycle from ecology,
affordances, repetition, camp state, identity, or events. Material-required
plans remain `blocked_material_execution`; matching persisted `waterWorks` is
the existing physical-work proof. Missing matching works is represented as
`existing_physical_work_unproven`. When retained efficacy has lost the variant
provenance needed to resolve any execution class, the adapter uses
`execution_provenance_unproven`. Both unproven states withhold attempts,
conclusions, outcomes, admitted efficacy, and visible practice diffusion from
downstream read surfaces.

The final whole-branch fix wave also makes the adapter join the independently
bounded problem, idea, experiment, response, and efficacy arrays without
requiring an adjacent array entry to survive. Missing retained neighbours are
explicit `{ kind, id }` links. Problem-origin basis is separate from the basis
of later local ideas/tests, so inherited or copied framing cannot relabel a
daughter's local attempt as inherited practice.

## RED, GREEN, and mutation sensitivity

The initial command `node scripts/item5ProjectionInheritanceAudit.mjs` exited
`1` with `verdict: "FAIL"`. It measured heuristic frames/candidates on a
canonical band, including `canonicalProblemsAreExclusive: false`,
`canonicalCandidateCardsAreExact: false`, canonical authority/readiness
failures, and `adaptiveHumanCanonicalLeakClosed: false`. The legacy positive
control, no-mutation control, inheritance-state control, and both caller
inventories were already true. The raw command, exit code, stdout, and stderr
are retained as `red.command`, `red.exit`, `red.stdout`, and `red.stderr`.

The reversible certification mutant made an exact temporary byte copy of
`src/sim/agents/problemPractice.ts`, changed only the canonical guard to
`if (false)`, and reran the audit. It exited `1`, emitted `verdict: "FAIL"`,
and made `canonicalProblemsAreExclusive: false`. Restoration copied the exact
temporary byte copy back; pre- and post-restore SHA-256 were both
`899d24ba907c822a0809fdeba6d8ebd65b3d6f9aa83be52487b4d6408b056366`, and
byte comparison succeeded. The discarded literal-inversion probe threw in the
legacy positive control before JSON and is not counted as the mutation proof.

The final-review RED commit
`abc4259575e86ecff3fe9c33665de7e92e20fa8c` added six real fixture groups. The
focused audit exited 1 with exactly those six new checks false while every
existing 30 check remained true: missing-waterworks physical proof, blocked
material feedback short-circuiting, independent bounded joins, inherited-frame
versus local-test basis, plan-only foothold trace suppression, and local
idea-only diagnostics. After the production correction commit
`1658c92e187df42f3435d2290e30b38ad552817f`, the same audit exited 0 with all
36 checks true.

## Caller classifications

The runtime inventory classifies every observed projection caller as an
allowlisted read model. It found no caller under `src/sim/rules/`, no
writer/advance/runner/reducer/kernel caller, and no unclassified caller.

| Projection | Allowlisted read-model callers |
| --- | --- |
| `deriveProblemPracticeProfile` | `adaptiveHuman.ts`, `campFoothold.ts`, `practiceFeedbackReadiness.ts`, `socialEcologicalDiffusion.ts`, `ProblemsAndTrials.tsx`, `Technical.tsx` |
| `derivePracticeFeedbackReadinessProfile` | `adaptiveHuman.ts`, `socialEcologicalDiffusion.ts`, `PracticeFeedback.tsx`, `Technical.tsx` |

`deriveAdaptiveHumanProfile` now produces the canonical-suppressed legacy
profile for canonical bands. Diffusion admits a canonical visible-practice
trace only for execution-proven/attempted/concluded lifecycle truth; plans and
blocked material entries do not become visible practice.

## Canonical, legacy, inheritance, and UI evidence

- The final Pass-3 audit reports `verdict: "PASS"` with all 40 checks true:
  canonical-only profiles, exact IDs/statuses, no projection mutation, daughter
  inherited-not-local truth, legacy fallback, adaptive-human suppression,
  execution-gated diffusion, independently bounded missing-link truth, and SSR
  UI lifecycle/execution rendering.
- The canonical daughter is made by the real inheritor. It retains degraded
  inherited fragments and limited inherited problem framing while responses,
  ideas, experiments, efficacy records, and waterworks are absent; the
  projection labels this knowledge untested here rather than local proof.
- UI panels distinguish canonical authority from legacy compatibility, render
  plans separately from physical execution, show material execution as not
  proven, show missing `waterWorks` as physical work not proven, and withhold
  stale attempt/conclusion/outcome/efficacy claims. This is read-model wording
  and projection behavior, not a simulation writer change.
- Camp foothold factors may retain contextual plan evidence, but visible trace
  diffusion now requires separate physical camp/activity evidence. A plan-only
  storage factor remains present in the controlled fixture and yields zero
  foothold-trace diffusion items.
- The legacy no-canonical-state control remains a non-empty
  `legacy_compatibility` projection. Serialized world/band inputs are
  byte-identical before and after projection calls.

## Pass-2 preservation and regression verdicts

`adaptiveEfficacy.ts` remains SHA-256
`ca2603250e1716886e2bb21db2d1c3bed5114d7ed8cf9213761747acbb72e919`.
No coefficient was tuned. Pass-2's central execution provenance still yields
zero physical effect and zero efficacy maturation for material-required
responses lacking proof.

| Command | Measured result |
| --- | --- |
| `npx tsc -p tsconfig.json --noEmit` | exit 0 |
| `npx tsc -p tsconfig.node.json --noEmit` | exit 0 |
| `npm run build` | exit 0; existing Vite >500 kB chunk advisory only |
| `node scripts/item5PhysicalEffectProvenanceAudit.mjs` | exit 0; `PASS`, 13/13 checks |
| `node scripts/item5ProjectionInheritanceAudit.mjs` | exit 0; `PASS`, 40/40 checks |
| `node scripts/adaptationBoundaryAudit.mjs` | exit 0; `PASS`, 14/14 checks |
| `node scripts/expeditionAdaptationEfficacyAudit.mjs` | exit 0; `PASS`, 12/12 checks |
| `git diff --check` | exit 0 before evidence authoring and before the certification commits |

## Item-4 preservation

The retained command-generated artifacts are inspected JSON, not exit-code-only
claims:

- `fission-field-transfer.json`: 12/12 passing, 0 failing, 0 vacuous; 136 Band
  fields classified; fresh-run `generatedAt: 2026-08-23T17:24:47.463Z`; raw
  SHA-256 `059f1e19048e12f7e90c3dc8fd43a52500d5584b978cd602f337ae0cc18fed86`.
- `item4-whole-integration.json`: six fixtures passed, none failed,
  `verdict: "PASS"`; fresh-run `generatedAt: 2026-08-23T17:24:58.051Z`; raw
  SHA-256 `c9bcd0ef899f1a3cbdae53d0bade4b61f8b7406c05f051f5e0ea19d777f2402c`.

The previous byte-stability mechanism was wrong because it reused an existing
artifact's `generatedAt`. Current writers timestamp the invocation that actually
created the result. Deterministic certification normalizes only root
`generatedAt`; semantic SHA-256 remains respectively
`278d5d560f951c8ded4b6408cda15665b4d2c337ab1ca596fa3a3a07857f639b` and
`eca57acda4faea58c91454e0d9e59bae3afe493d96b853040c1a2bd3b8a72b64` before
and after the fresh rerun. No behaviorally meaningful field is normalized.

No Item-4 mechanic or inheritance richness was modified in this pass.

## Determinism and semantic benchmark inspection

The 50-year repeated Map-2 command exited 0 with `verdict: "PASS"`,
`deterministic: true`, all checks true, and the same fingerprint in both runs:

```text
f509b2f4d6e8a463b7505025afe22d151fd45a0598bd9550fbb84aac900da03c
```

Measured Map-2 outcome: population `238 + 201 - 226 = 213`, nine active
bands, zero extinct bands, 1,092 movements, natural adaptations attempted/effective
`8/3`, and state caps held.

All three benchmark JSON payloads were parsed after the npm preamble; each
reported `passed: true` with no false assertion.

| Benchmark | Semantic measurements |
| --- | --- |
| targeted practical adaptation | Each unit state reported `fragmentCap: 10`, `responseCap: 10`, `recordCap: 12`, `problemCap: 5`, `ideaCap: 8`, `experimentCap: 4`, `held: true`; the largest practical-state payload was 27,114 bytes. |
| targeted adaptive efficacy | 40-year harsh-dry live sweep: five bands, zero efficacy records, zero inconsistent records, zero unearned scout-probe clear successes, and zero decorative camp-care successes; no numeric cap object is reported. |
| targeted routines 2 | Caps: fragments 10, responses 10, raw/top candidates 6/3, animal patterns 12, management records 4, fauna stocks 260, influence tiles/stock 13. The Map-2 run measured nine bands, 3 animal patterns, 2 management records, 4 feeding attempts, 1 holding attempt, max animal state 1,974 bytes, and fauna routine state 112,202 bytes. |

## Exact changed-file inventory before this Task-5 record

From `31363c4f8e19e1c4f536338ecd0ef59e3fa7082f` through the pre-Task-5 tip
`5faf2862fb6f20610b0d6aa86420f17f8abd6547`, the branch added or modified:

```text
docs/evidence/item5-pass3/TASK4_CERTIFICATION.md
docs/evidence/item5-pass3/fission-field-transfer.json
docs/evidence/item5-pass3/item4-whole-integration.json
docs/evidence/item5-pass3/red.command
docs/evidence/item5-pass3/red.exit
docs/evidence/item5-pass3/red.stderr
docs/evidence/item5-pass3/red.stdout
docs/superpowers/plans/2026-08-20-item5-pass3-projection-inheritance.md
docs/superpowers/specs/2026-08-20-item5-pass3-projection-inheritance-design.md
scripts/adaptationBoundaryAudit.mjs
scripts/item5ProjectionInheritanceAudit.mjs
src/sim/agents/adaptiveHuman.ts
src/sim/agents/practicalAdaptationProjection.ts
src/sim/agents/practicalResponses.ts
src/sim/agents/practiceFeedbackReadiness.ts
src/sim/agents/problemPractice.ts
src/sim/agents/socialEcologicalDiffusion.ts
src/ui/band/IdeasSolutions.tsx
src/ui/band/PracticeFeedback.tsx
src/ui/band/ProblemsAndTrials.tsx
src/ui/band/Technical.tsx
```

The Task-5 documentation record adds this file plus current-authority updates
in `AGENTS.md`, `CLAUDE.md`, `docs/HANDOFF.md`, and supported plan checkboxes.

## Remaining debt and warnings

Portable-material execution still has no inventory, crafting, resource-stock,
or execution authority. Planned materials/procedure/labor/risk/opportunity
fields remain estimates, not evidence of acquisition, consumption, paid cost,
or execution. Later Item-5 work must supply truthful portable-material proof
before physical effects or efficacy maturation can be admitted. This pass does
not freeze Item 5, start Item 6, merge `main`, or alter Item-4 behavior.

The existing Vite large-chunk advisory remains. It is a warning, not a failed
build or a Pass-3 behavior claim.
