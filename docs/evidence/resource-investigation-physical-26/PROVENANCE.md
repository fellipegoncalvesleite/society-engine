# CORRECTION-26 — provenance

## Tree state

```text
branch            checkpoint/resource-investigation-physical-26
entry HEAD        b746b6883b0c475ba92eef34cb9d30944489aec6
                  ("docs: decide how a seasonal investigation should physically happen")
entry tree        clean (git status --short empty)
origin/main       0a43083a3a9103bc6b8f693b8823a604ae2c6a8d   (untouched, not merged, not rebased)
origin/checkpoint/resource-investigation-authority-25
                  f94755047b2ea2a47b9453f3917e8eaf67816ca3   (untouched)
```

Required starting invariant, run before any implementation:

```bash
git diff --exit-code f94755047b2ea2a47b9453f3917e8eaf67816ca3 -- src/sim
```

**PASSED** — `src/sim` was byte-identical to `f947550` at entry, so the previous executor's
reverted half-state left nothing behind.

## Production behaviour

**CHANGED.** No diagnostics-off fingerprint parity to `b746b68` or `f947550` is claimed or
possible: selection no longer observes and a new daily execution phase exists. This is the
point of the checkpoint.

## Files changed

### New production modules

| file | purpose |
| --- | --- |
| `src/sim/agents/pendingInvestigation.ts` | the bounded pending record, its outcome union, lifecycle helpers, caps. A **runtime leaf** — every import is type-only. |
| `src/sim/agents/resourceScoutObservation.ts` | the relocated execution-neutral domain half: scout observation interpretation, memory mutation, plant-use learning, debug projection, side-country memory formation and cautious test. |

### Modified production

| file | change |
| --- | --- |
| `src/sim/rules/bandDecision.ts` | selection stops observing (`collectProbeObservationTargets` removed); creates the pending record; captures decision-time selection evidence; the five moved functions deleted. −677/+ lines net. |
| `src/sim/agents/intraSeasonTrips.ts` | the sanctioned daily execution phase inside `applyTripDay`; the observation-target rule for an arrived party; the learning application. |
| `src/sim/agents/campMovement.ts` | `TemporaryTaskCampRecord` → `TemporaryTaskPartyRecord`, written only from a real departure. |
| `src/sim/agents/types.ts` | `Band.pendingInvestigation`, `Band.recentInvestigationOutcomes`, the reclassified party record type. |
| `src/sim/agents/viability.ts` | retire a pending record at absorption and at extinction (`band_no_longer_active`). |
| `src/sim/agents/demography.ts` | a daughter inherits neither the pending record nor the parent's outcome ring. |
| `src/sim/agents/landscapeVisibility.ts` | `markVisibleLandscapeCueProbeChecked`, moved out of `rules/candidates/` and re-gated on arrival. |
| `src/sim/agents/eventSystem.ts`, `src/sim/agents/publicHumanStory.ts` | truthful narration of a day party. |
| `src/sim/rules/candidates/visibleLandscapeCandidate.ts` | `updateVisibleLandscapeCueProbeUse` removed (moved). |
| `src/ui/band/CampMovement.tsx`, `src/ui/band/Technical.tsx` | party card and technical projection. |
| `scripts/simBenchmark.mjs` | two loader lines repointed to `resourceScoutObservation.ts`. No assertion changed. |

### New audit scripts

| file | purpose |
| --- | --- |
| `scripts/investigationPhysicalChainAudit.mjs` | natural occurrence; identity join `Decision.id → pending → execution → outcome`. |
| `scripts/investigationPhysicalFixturesAudit.mjs` | controlled fixtures P1–P13. |
| `scripts/investigationBeforeAfterAudit.mjs` | the §15 causal proof; runs unmodified on both trees. |

**No production instrumentation was added for any audit.** Every measurement reads state the
simulation already persists, or uses the pre-existing audit-only `decisionObserver`
(`tick/advance.ts:213-215`), which is present unchanged at `f947550`.

## Evidence files

| file | how produced |
| --- | --- |
| `ARCHITECTURE_DECISION.md` | written at `b746b68`; corrected in this pass (see below). |
| `FINDINGS.md` | this pass. |
| `PROVENANCE.md` | this file. |
| `fixtures.json` | `node scripts/investigationPhysicalFixturesAudit.mjs` |
| `natural-occurrence.json` | `node scripts/investigationPhysicalChainAudit.mjs --years 20 --scenarios map1,map2,ordinary --seeds s1,s2` |
| `behavioral-comparison-before.json` | `node scripts/investigationBeforeAfterAudit.mjs --label before --years 12 --seeds s1,s2 --scenarios map1,map2`, run in a git worktree at `f947550` |
| `behavioral-comparison-after.json` | same command, `--label after`, on this tree |
| `behavioral-comparison.json` | the merged before/after document, including the authority-ledger delta |
| `closure25-authority-rerun.json` | `node scripts/resourceInvestigationAuthorityAudit.mjs --years 20 --scenarios map1,map2,ordinary --seeds s1 --out <this path>` — CLOSURE-25's own audit, **unmodified**, with `--out` redirected |

### Earlier checkpoint evidence was not overwritten

`resourceInvestigationAuthorityAudit.mjs` and `resourceInvestigationFixturesAudit.mjs`
default their output to `docs/evidence/resource-investigation-authority-25/`. Both output
paths were inspected before running and `--out` was passed. `git status` confirms no file
under `docs/evidence/resource-investigation-authority-25/` is modified.

## ADR correction

`ARCHITECTURE_DECISION.md` named `route_time_infeasible` as a production primitive. It is
not one: it exists only in `scripts/sameDayFailureGateProbe.mjs:44,47`, which maps
production's own results onto an audit label. The corrected text names the real production
type `IntraSeasonTripActivityResult` (`agents/types.ts:332`) and the member actually reused,
`failed_due_to_distance`. The outcome-class list was rewritten to the production
`PendingInvestigationOutcome` members, and
`transferred_to_existing_expedition_authority` was removed with the reason it is not
implemented. Two sections were added: the observation-distance trade and the acquisition-kind
decision.

## Verification runs

| check | command | result |
| --- | --- | --- |
| typecheck | `npx tsc -p tsconfig.json --noEmit` | clean |
| production build | `npm run build` | built |
| graph integrity | `node scripts/checkGraph.mjs` | 221/764, 0 dup, 0 dangling |
| import boundary | `node scripts/importBoundaryAudit.mjs` | **PASS**; internal back edges 84 → **85** (type-only, see below) |
| runtime cycle check | value-import graph over all 143 `src/sim` files | **0 runtime cycles**, **0 `agents → rules` runtime edges** |
| decision boundary | `node scripts/decisionBoundaryAudit.mjs` | PASS |
| adaptation boundary | `node scripts/adaptationBoundaryAudit.mjs` | PASS |
| context lifecycle | `node scripts/contextLifecycleAudit.mjs` | PASS |
| season order invariance | `node scripts/seasonOrderInvarianceAudit.mjs` | PASS |
| step-mode invariance | `node scripts/stepModeInvarianceAudit.mjs` | **PASS** both maps, `fullCanonicalStateMatch: true` (map1 152/152, map2 227/227) — **failed on the first implementation; see FINDINGS §7** |
| determinism | `npm run sim:benchmark -- --deterministic` | `deterministic=true` |
| resource anti-omniscience | `npm run sim:benchmark -- --targeted-resource-anti-omniscience-audit` | pass |
| fauna anti-omniscience | `npm run sim:benchmark -- --targeted-fauna-stocks-audit` | pass, `hiddenKnowledgeViolations: 0` |
| food receipt accounting | `node scripts/recoveryFoodAccountingAudit.mjs` | PASS, conservation holds |
| terminal extinction | `node scripts/postEcologyTerminalExtinctionAudit.mjs` | PASS |
| return kinds | `node scripts/postEcologyReturnKindAudit.mjs` | PASS |
| hardship outcome | `node scripts/postEcologyHardshipOutcomeAudit.mjs` | PASS |
| expedition knowledge latency | `node scripts/expeditionKnowledgeLatencyAudit.mjs` | PASS |
| expedition lifecycle | `node scripts/expeditionLifecycleAudit.mjs` | **FAIL — and FAILS IDENTICALLY on `f947550`** with the same flags. Pre-existing, not a regression from this work, not repaired here. |
| fixtures P1–P13 | `node scripts/investigationPhysicalFixturesAudit.mjs` | 35/35 |
| fixture negative control | P13 with the step-mode bug deliberately reintroduced | 3/3 fail, confirming P13 is not vacuous |

### The back-edge increase

`importBoundaryAudit`'s `internalSimBackEdges` counts textual imports **including
`import type`** (its regex is `(?:import|export)\s+(?:type\s+)?…`). The new edge is the
type-only `types.ts ⇄ pendingInvestigation.ts` pair, the same shape as the existing
`resourceScout.ts ⇄ types.ts` pair. A value-import-only graph reports zero cycles anywhere
in `src/sim`, so no runtime cycle was created. Reported as an increase rather than argued
away.

## Not run

- No long-horizon (200 y / 500 y) matrix. Nothing in this pass claims a long-run effect.
- No population, survival or fitness comparison. No such claim is made.
- No counterfactual over the mobility boundary (FINDINGS §9).
- The full `simBenchmark --all` sweep was not run; the targeted audits above were.

## Git

Commits on this branch, in order:

```text
b746b68  architecture decision (pre-existing, unmodified)
<a>      domain extraction and pending lifecycle
<b>      physical execution and truthful projection
<c>      audits, evidence and handoff
```

`main` was not merged, rebased, reset or modified. No AI attribution or `Co-authored-by`
trailer is present on any commit. Only
`checkpoint/resource-investigation-physical-26` is pushed.
