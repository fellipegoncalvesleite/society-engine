# Item 5 Pass 3 — canonical projection and inheritance evidence

## Scope and status

- Exact accepted Pass-2 base: `31363c4f8e19e1c4f536338ecd0ef59e3fa7082f`.
- Branch: `checkpoint/item5-projection-inheritance-pass3`.
- Worktree: `/Users/fellipegoncalvesleite/.worktrees/society-engine-item5-projection-inheritance-pass3`.
- This pass changes Item-5 read-model authority only. It does not change Item-4
  mechanics, daughter-transfer richness, physical-effect gates, coefficients, or
  the deterministic Map-2 trajectory. Item 5 remains open and unfrozen, and
  Pass 3 remains pending independent architect review; this evidence is not a
  merge or acceptance record.

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
the existing physical-work proof.

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

- The final Pass-3 audit reports `verdict: "PASS"` with all 30 checks true:
  canonical-only profiles, exact IDs/statuses, no projection mutation, daughter
  inherited-not-local truth, legacy fallback, adaptive-human suppression,
  execution-gated diffusion, and SSR UI lifecycle/execution rendering.
- The canonical daughter is made by the real inheritor. It retains degraded
  inherited fragments and limited inherited problem framing while responses,
  ideas, experiments, efficacy records, and waterworks are absent; the
  projection labels this knowledge untested here rather than local proof.
- UI panels distinguish canonical authority from legacy compatibility, render
  plans separately from physical execution, show material execution as not
  proven, and withhold stale material efficacy/aggregate claims. This is
  read-model wording and projection behavior, not a simulation writer change.
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
| `node scripts/item5ProjectionInheritanceAudit.mjs` | exit 0; `PASS`, 30/30 checks |
| `node scripts/adaptationBoundaryAudit.mjs` | exit 0; `PASS`, 14/14 checks |
| `node scripts/expeditionAdaptationEfficacyAudit.mjs` | exit 0; `PASS`, 12/12 checks |
| `git diff --check` | exit 0 before evidence authoring and before the certification commits |

## Item-4 preservation

The retained command-generated artifacts are inspected JSON, not exit-code-only
claims:

- `fission-field-transfer.json`: 12/12 passing, 0 failing, 0 vacuous; 136 Band
  fields classified; SHA-256
  `4f10cb0caefeb1b7b058edf23b766622c21457f50e2180543b7ace90e27830cd`.
- `item4-whole-integration.json`: six fixtures passed, none failed,
  `verdict: "PASS"`; SHA-256
  `d62fdd0ac9cba057f39dbd41540e02915e0196003e2e89d89886482d4983b575`.

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
