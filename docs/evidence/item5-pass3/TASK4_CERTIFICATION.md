# Item 5 Pass 3 — Task 4 certification evidence

Certification base: `09b5c8f54b3526cd5ede8da0288222ba3d2762e3` on
`checkpoint/item5-projection-inheritance-pass3`.

## 2026-08-23 final-correction addendum — current certification

This addendum supersedes the older counts, mutation target, and audit-timestamp
mechanism below where they conflict. The older sections remain as historical
evidence of the earlier Pass-3 certification.

The final correction began at reviewed HEAD
`c49ba4674700903bc231f1900b9834d6e2fa4f16`. RED-first runtime fixtures proved
that efficacy-only orphan rows were incorrectly admitted as `practice_attempted`,
that the same failure let a material-capable orphan gain authority when its variant
was evicted, that ten retained responses were truncated to nine canonical rows, and
that both Item-4 writers inherited an existing artifact's `generatedAt`.

GREEN now requires unresolved variant provenance to be
`execution_provenance_unproven`: the canonical efficacy record remains recorded,
but admitted efficacy is empty, attempts remain zero, readiness is blocked/not
started, no practice trace diffuses, and normal UI withholds the stale success and
classification. The canonical row adapter returns all ten controlled responses in
deterministic order; the legacy display still shows nine only by an explicit display
cap with total 10 and omitted count 1.

The Item-4 writers now write a fresh current-invocation `generatedAt`. Semantic
comparison removes only root `generatedAt`; no behavior field is ignored. Fresh
raw SHA-256 is `059f1e19048e12f7e90c3dc8fd43a52500d5584b978cd602f337ae0cc18fed86`
for field transfer and `c9bcd0ef899f1a3cbdae53d0bade4b61f8b7406c05f051f5e0ea19d777f2402c`
for whole integration, while their normalized semantic SHA-256 values remain exactly
`278d5d560f951c8ded4b6408cda15665b4d2c337ab1ca596fa3a3a07857f639b` and
`eca57acda4faea58c91454e0d9e59bae3afe493d96b853040c1a2bd3b8a72b64`.

The final reversible mutant re-admitted `executionClass === undefined`. The audit
then failed both orphan authority controls. Exact source SHA-256 values were:

```text
before  419772dc1969b21a1cae9c9b67c874a52197589a8cd4260a4959e1eb87632c8e
mutated 98946adeac9f1679341bbcbad27150a8e738cd74ba40bc8b0e43ed7a6fcca9d5
after   419772dc1969b21a1cae9c9b67c874a52197589a8cd4260a4959e1eb87632c8e
```

Restoration used the exact saved bytes, not Git reset/checkout. Final verification:
projection 40/40, physical-effect provenance 13/13, adaptation boundary 14/14,
expedition efficacy 12/12, Item-4 transfer 12/12 with 0 vacuous, whole integration
6/6, both TypeScript projects and build green, and all benchmark assertion maps
true (27/27 practical, 26/26 efficacy, 38/38 routines). The repeated Map-2
fingerprint remains exactly
`f509b2f4d6e8a463b7505025afe22d151fd45a0598bd9550fbb84aac900da03c`.

## Reversible canonical-guard mutation

Target: `src/sim/agents/problemPractice.ts`.

- Pre-mutation SHA-256: `899d24ba907c822a0809fdeba6d8ebd65b3d6f9aa83be52487b4d6408b056366`.
- An exact temporary byte copy was made outside the worktree before mutation.
- The intended, narrow guard mutation replaced only
  `if (band.practicalAdaptation !== undefined)` with `if (false)`, forcing the
  existing legacy branch while preserving the legacy positive-control path.
- `node scripts/item5ProjectionInheritanceAudit.mjs` exited `1`, emitted
  `verdict: "FAIL"`, and reported `checks.canonicalProblemsAreExclusive: false`.
  It also exposed the expected heuristic frame ids instead of the sole canonical
  problem id, proving that the audit is sensitive to the canonical guard.
- Restoration copied the exact temporary byte copy back into the target; it did
  not use `git reset` or `git checkout`. Post-restore SHA-256 is
  `899d24ba907c822a0809fdeba6d8ebd65b3d6f9aa83be52487b4d6408b056366`, and a
  byte comparison against the temporary copy exited `0`.
- `git diff -- src/sim/agents/problemPractice.ts` and
  `git status --short src/sim/agents/problemPractice.ts` were empty after
  restoration.

Certification note: an initial literal guard inversion was also restored from
the same exact copy. It made the legacy positive control call the canonical
adapter without canonical state and therefore threw before emitting JSON. It
was not accepted as the mutation proof; the `if (false)` guard mutant above was
the sole recorded sensitivity result for that earlier certification. The
2026-08-23 addendum records the later unresolved-provenance mutant.

## Compile, build, and focused audits

| Command | Exit | Semantic result |
| --- | ---: | --- |
| `npx tsc -p tsconfig.json --noEmit` | 0 | TypeScript project compiled. |
| `npx tsc -p tsconfig.node.json --noEmit` | 0 | Node TypeScript project compiled. |
| `npm run build` | 0 | Vite build completed. Existing advisory: chunks over 500 kB. |
| `node scripts/item5PhysicalEffectProvenanceAudit.mjs` | 0 | `verdict: "PASS"`; all 13 checks true. Material-required responses retain zero physical relief and no efficacy maturation without execution proof; adaptive-efficacy hash remains `ca2603250e1716886e2bb21db2d1c3bed5114d7ed8cf9213761747acbb72e919`. |
| `node scripts/item5ProjectionInheritanceAudit.mjs` | 0 | `verdict: "PASS"`; all 30 checks true, including canonical-only profiles, no projection mutation, daughter inherited-not-local truth, adaptive-human suppression, and UI execution-truth checks. |
| `node scripts/adaptationBoundaryAudit.mjs` | 0 | `verdict: "PASS"`; all 14 checks true. The canonical state is `band.practicalAdaptation`, with 26 public-boundary named exports and zero unauthorized deep imports. |
| `node scripts/expeditionAdaptationEfficacyAudit.mjs` | 0 | `verdict: "PASS"`; all 12 checks true. Adapted/unaltered relief is `0.27/0`, carrying capacity is `0.2976/0.24`, and the adapted expedition completes in 7 versus 8 days. |

## Item-4 freeze outputs

The command-generated JSON artifacts are retained alongside this record:

- [`fission-field-transfer.json`](./fission-field-transfer.json):
  `fixtures: 12`, `passing: 12`, `failing: 0`, `vacuous: 0`; 136 Band fields
  classified, with five permitted shared references. Its SHA-256 is
  `4f10cb0caefeb1b7b058edf23b766622c21457f50e2180543b7ace90e27830cd`.
- [`item4-whole-integration.json`](./item4-whole-integration.json):
  `total: 6`, `passed: 6`, `failed: 0`, `verdict: "PASS"`. Its SHA-256 is
  `d62fdd0ac9cba057f39dbd41540e02915e0196003e2e89d89886482d4983b575`.

Commands run:

```text
node scripts/fissionFieldTransferAudit.mjs --out docs/evidence/item5-pass3/fission-field-transfer.json
node scripts/item4WholeIntegrationFreezeAudit.mjs --out docs/evidence/item5-pass3/item4-whole-integration.json
```

Both exited `0`.

## Deterministic Map-2 comparison

`node scripts/demographicLongRunAudit.mjs --map map2 --years 50 --repeat`
exited `0` with `verdict: "PASS"`. All checks were true, including
`deterministic`, `stateCapsHeld`, and `survivorsNotAllStructurallyCapPinned`.
The first and repeated runs have the identical required fingerprint:

```text
f509b2f4d6e8a463b7505025afe22d151fd45a0598bd9550fbb84aac900da03c
```

Measured result: population `238 + 201 - 226 = 213`, nine active bands, zero
extinct bands, 1,092 movements, natural adaptations attempted/effective `8/3`,
and state caps held. Both repeat summaries report end population 213, nine
active bands, zero extinct bands, and matching decline-cap observations.

## Semantic benchmark inspection

All three benchmark commands exited `0`. Their JSON payloads were parsed after
the npm preamble; each has top-level `passed: true` and no false assertion.

| Benchmark | JSON suite / passed | Reported natural state and caps |
| --- | --- | --- |
| `npm run sim:benchmark -- --targeted-practical-adaptation-check` | `targeted_practical_adaptation_check` / `true` | Live scenarios reported no unearned confidence. Fresh JSON confirms that each unit state (`triggerState`, `comfortableState`, and `noMaterialState`) reports the identical `caps` object: `fragmentCap: 10`, `responseCap: 10`, `recordCap: 12` (the cap for `efficacyRecords`), `problemCap: 5`, `ideaCap: 8`, `experimentCap: 4`, `held: true`. The largest reported practical-state payload was 27,114 bytes (late-dry refuge); the five scenario payload maxima were 18,592, 20,990, 20,987, 24,698, and 27,114 bytes. |
| `npm run sim:benchmark -- --targeted-adaptive-efficacy-check` | `targeted_adaptive_efficacy_check` / `true` | 40-year harsh-dry live run: five bands, zero efficacy records, zero inconsistent records, zero unearned scout-probe clear successes, and zero decorative camp-care successes. This payload reports no numeric state-cap object. |
| `npm run sim:benchmark -- --targeted-routines-2-check` | `targeted_routines_2_check` / `true` | Reported caps: fragments 10; responses 10; raw/top variant candidates 6/3; animal patterns 12; management records 4; fauna stocks 260; influence tiles per stock 13. Its 30-year Map-2 run reported nine bands, 3 animal-pattern records, 2 management records, 260 routine dynamics, 4 feeding attempts, 1 holding attempt, max animal state 1,974 bytes, and fauna routine state 112,202 bytes. |

## Diff hygiene before documentation

Before this authored certification record, `git diff --check` exited `0` and
the tracked diff was empty. The exact required full-worktree command and output
were:

```text
$ git status --short
?? docs/evidence/item5-pass3/fission-field-transfer.json
?? docs/evidence/item5-pass3/item4-whole-integration.json
```

Those were the complete changed-file list at that point, and both files were
inspected before this document was authored. No tracked production file had a
certification edit. After commit `af766da80ff3fa3698dff1cdc512738f05564c59`,
the same full-worktree command produced no output (clean); after follow-up
commit `f488f3f0cc20c8b0f3d10d4e4c0459ef43befa50`, exact current
`git status --short` likewise produced no output (clean).

## Limits

This task makes no production correction, coefficient change, Item-4 mechanic
change, Item-5 freeze claim, merge, or push. The Vite large-chunk advisory is
observed but outside this evidence-only task.
