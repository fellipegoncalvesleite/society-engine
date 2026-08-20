# Item 5 Pass 3 Canonical Projection and Inheritance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every Item-5 read model project `band.practicalAdaptation` when present, retain an explicit pre-canonical fallback, and prove daughter inheritance never becomes local experimental proof.

**Architecture:** Add one pure `practicalAdaptationProjection.ts` adapter that maps canonical state into the two established profile APIs. The existing modules become canonical-first routers and retain their heuristic implementations only as legacy compatibility; downstream projection and UI consumers receive exact canonical lifecycle and execution metadata without simulation-state writes.

**Tech Stack:** TypeScript 6, React 19, Vite SSR audit scripts, Node.js audit tooling, Git worktrees.

**Spec:** `docs/superpowers/specs/2026-08-20-item5-pass3-projection-inheritance-design.md`

## Global Constraints

- Base is exactly `31363c4f8e19e1c4f536338ecd0ef59e3fa7082f`.
- Work only on `checkpoint/item5-projection-inheritance-pass3`.
- Do not change Item-4 physical fission mechanics or daughter transfer richness.
- Do not add material execution, inventory, crafting, production, or physical-effect compensation.
- Do not tune physical, demographic, fertility, or mortality coefficients.
- Do not start Item 6, freeze Item 5, merge `main`, or perform unrelated cleanup.
- Every production edit is covered by the already-failing Pass-3 runtime audit before implementation.
- Preserve exact accepted Map-2 50-year fingerprint `f509b2f4d6e8a463b7505025afe22d151fd45a0598bd9550fbb84aac900da03c`.
- Commits use the repository's configured human author and committer identity with no AI attribution.

---

### Task 1: Reproduce parallel projection history

**Files:**
- Create: `scripts/item5ProjectionInheritanceAudit.mjs`
- Create: `docs/evidence/item5-pass3/red.command`
- Create: `docs/evidence/item5-pass3/red.exit`
- Create: `docs/evidence/item5-pass3/red.stdout`
- Create: `docs/evidence/item5-pass3/red.stderr`

**Interfaces:**
- Consumes: `initSimWorld`, `deriveProblemPracticeProfile`, `derivePracticeFeedbackReadinessProfile`, `inheritPracticalAdaptationForDaughter`, and canonical state shapes from `types.ts`.
- Produces: one JSON payload named `ITEM5-PROJECTION-INHERITANCE-PASS3` with `verdict`, named boolean `checks`, controlled `runtime`, `callerInventory`, and `behaviorIsolation`.

- [x] **Step 1: Create a runtime fixture with contradictory canonical and heuristic evidence**

Use Vite SSR to load real modules and construct a band whose canonical IDs are literal audit values:

```js
const canonicalProblem = {
  id: "problem:audit:canonical-water",
  family: "camp_water_shortage",
  publicLabel: "Canonical water shortage",
  interpretation: "the camp lacks dependable water",
  misread: false,
  severity: 0.72,
  confidence: 0.81,
  repetitionCount: 3,
  origin: "lived",
  status: "active",
  evidenceRefs: ["audit:canonical-water"],
  framedAtTick: world.time.tick,
  lastEvidenceTick: world.time.tick,
};
const canonicalIdea = {
  id: "idea:audit:load-staging",
  problemId: canonicalProblem.id,
  family: "carrying_load",
  variantKey: "load_staging",
  publicLabel: "Canonical load staging idea",
  mechanismBelief: "divide loads before travel",
  basisFragmentIds: ["fragment:audit:staging"],
  basisScore: 0.75,
  status: "selected",
  statusReason: "selected by the canonical chain",
  source: "local_inference",
  consideredAtTick: world.time.tick,
};
```

Retain the initialized band's ecology, memories, demography, and affordances so the accepted implementation synthesizes additional unrelated frames/candidates.

- [x] **Step 2: Add controlled experiment, response, efficacy, and material-plan cases**

Add an underway `load_staging` practice-only experiment with attempts and an abandoned response, plus an underway `membrane_water_bag` experiment with `attemptSeasons: 0`, no efficacy, and no `waterWorks`. Assert literal canonical IDs and statuses rather than recomputing expectations through production helpers.

```js
const checks = {
  canonicalProblemsAreExclusive:
    projected.problemFrames.map((item) => item.id).join("|") === canonicalProblem.id,
  canonicalIdeasAreExclusive:
    projected.practiceCandidates.map((item) => item.canonical?.ideaId).join("|") === canonicalIdea.id,
  materialPlanRemainsUnexecuted:
    materialItem.canonical?.executionTruth === "blocked_material_execution" &&
    materialItem.canonical?.attemptSeasons === 0 &&
    materialItem.canonical?.efficacyRecordIds.length === 0,
};
```

- [x] **Step 3: Add the canonical daughter case through the real inheritor**

Call `inheritPracticalAdaptationForDaughter(parentState, daughterId, tick)` and assert inherited fragments/problem origin survive while `responses`, `ideas`, `experiments`, `efficacyRecords`, and `waterWorks` are empty/absent. Project the daughter and require `authority === "canonical_practical_adaptation"`, no trial/readiness items, and inherited-not-local labels.

- [x] **Step 4: Add the legacy positive control and no-mutation control**

Delete only `practicalAdaptation` from a controlled band and require `authority === "legacy_compatibility"` with at least one heuristic frame/candidate. Serialize the canonical band and world before and after every projection call and require byte identity.

- [x] **Step 5: Add the caller/behavior inventory**

Walk `src/**/*.ts(x)`, find production call sites for both derive functions, classify the known caller allowlist, and fail if either function appears in `src/sim/rules`, a writer/advance path, or any unclassified production module. Record the indirect canonical leak through `deriveAdaptiveHumanProfile` as a failing check until Task 3.

- [x] **Step 6: Run the audit and capture a meaningful RED**

Run:

```bash
node scripts/item5ProjectionInheritanceAudit.mjs
```

Expected: exit 1 and JSON `verdict: "FAIL"`; canonical problem/idea exclusivity and canonical readiness truth are false because the accepted base runs heuristic synthesis for canonical bands. Legacy positive control and no-mutation checks must already be true.

- [x] **Step 7: Commit the RED audit and evidence**

```bash
git add scripts/item5ProjectionInheritanceAudit.mjs docs/evidence/item5-pass3/red.*
git commit -m "test: reproduce item5 projection authority drift"
```

---

### Task 2: Add the canonical projection adapter and canonical-first routers

**Files:**
- Create: `src/sim/agents/practicalAdaptationProjection.ts`
- Modify: `src/sim/agents/problemPractice.ts`
- Modify: `src/sim/agents/practiceFeedbackReadiness.ts`
- Modify: `src/sim/agents/practicalResponses.ts`
- Modify: `scripts/adaptationBoundaryAudit.mjs`

**Interfaces:**
- Consumes: `PracticalAdaptationState` and its canonical child records.
- Produces:
  - `deriveCanonicalProblemPracticeProfile(world, band): ProblemPracticeProfile`
  - `deriveCanonicalPracticeFeedbackReadinessProfile(world, band): PracticeFeedbackReadinessProfile`
  - `derivePracticalVariantExecutionClass(family, variantKey): VariantExecutionClass | undefined`
  - profile field `authority: "canonical_practical_adaptation" | "legacy_compatibility"`
  - exact optional `canonical` lifecycle metadata on frame/candidate/readiness items.

- [x] **Step 1: Add explicit projection authority and canonical metadata types**

Add these shapes to the established profile modules:

```ts
export type Item5ProjectionAuthority =
  | "canonical_practical_adaptation"
  | "legacy_compatibility";

export type CanonicalExecutionTruth =
  | "idea_only"
  | "planned_unexecuted"
  | "practice_attempted"
  | "existing_physical_work_executed"
  | "blocked_material_execution"
  | "concluded_from_canonical_history";

export interface CanonicalCandidateProjection {
  readonly ideaId: string;
  readonly ideaStatus: PracticalIdeaStatus;
  readonly experimentId?: string;
  readonly experimentStatus?: PracticalExperimentStatus;
  readonly attemptSeasons: number;
  readonly responseId?: string;
  readonly responseStatus?: PracticalResponseStatus;
  readonly efficacyRecordIds: readonly string[];
  readonly executionTruth: CanonicalExecutionTruth;
}
```

`ProblemPracticeProfile` and `PracticeFeedbackReadinessProfile` receive required `authority`; legacy return objects set `legacy_compatibility`.

- [x] **Step 2: Expose the existing execution classification as a read-only query**

Make `VariantExecutionClass` exported and add:

```ts
export function derivePracticalVariantExecutionClass(
  family: PracticalResponseFamily,
  variantKey: string,
): VariantExecutionClass | undefined {
  return VARIANT_SPECS.find(
    (entry) => entry.family === family && entry.variantKey === variantKey,
  )?.executionClass;
}
```

Do not change `VARIANT_SPECS`, `hasPhysicalExecutionProof`, any coefficient, or any effect/efficacy gate.

- [x] **Step 3: Implement one pure canonical adapter**

Map canonical problems and ideas in stored order under the existing caps. Join strictly by `problemId`, `ideaId`, `experimentId`, and `responseId`. Map old family fields only for stable display grouping. Evidence references use canonical IDs and fragment IDs; no call to material-affordance, camp, ecology, repetition, identity, event, or legacy modules is permitted.

Execution truth follows this order:

```ts
if (executionClass === "material_execution_required") return "blocked_material_execution";
if (executionClass === "existing_physical_work" && matchingWaterWorks) return "existing_physical_work_executed";
if (experiment?.status.startsWith("concluded_") || experiment?.status === "abandoned") return "concluded_from_canonical_history";
if ((experiment?.attemptSeasons ?? 0) > 0 || efficacyRecords.length > 0) return "practice_attempted";
if (experiment !== undefined) return "planned_unexecuted";
return "idea_only";
```

For material-required canonical contradictions, execution remains blocked even if a stale fixture claims attempts; the adapter reports the lack of physical proof rather than laundering the claim.

- [x] **Step 4: Route existing public functions canonical-first**

At the first line of each derive function:

```ts
if (band.practicalAdaptation !== undefined) {
  return deriveCanonicalProblemPracticeProfile(world, band);
}
```

and equivalently for readiness. The readiness canonical branch must return before calling `deriveProblemPracticeProfile`, `deriveMaterialAffordanceProfile`, or `deriveCampFootholdProfile`.

- [x] **Step 5: Extend the adaptation-boundary audit internal allowlist**

Add only `practicalAdaptationProjection` to `INTERNAL_PRACTICAL_MODULES`, because it read-imports the existing execution classification inside the internal subsystem. Do not add it to the public behavior boundary.

- [x] **Step 6: Run focused GREEN checks**

```bash
node scripts/item5ProjectionInheritanceAudit.mjs
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.node.json --noEmit
node scripts/item5PhysicalEffectProvenanceAudit.mjs
node scripts/adaptationBoundaryAudit.mjs
```

Expected: the Pass-3 audit may still fail only on the adaptive-human/social projection leak reserved for Task 3; canonical exclusivity, status, material-plan, daughter, legacy, and no-mutation checks pass. All inherited Pass-2/boundary checks pass.

- [x] **Step 7: Commit the adapter**

```bash
git add src/sim/agents/practicalAdaptationProjection.ts src/sim/agents/problemPractice.ts src/sim/agents/practiceFeedbackReadiness.ts src/sim/agents/practicalResponses.ts scripts/adaptationBoundaryAudit.mjs
git commit -m "refactor: project item5 history from canonical adaptation"
```

---

### Task 3: Close downstream legacy projection leaks and align the UI

**Files:**
- Modify: `src/sim/agents/adaptiveHuman.ts`
- Modify: `src/sim/agents/socialEcologicalDiffusion.ts`
- Modify: `src/ui/band/ProblemsAndTrials.tsx`
- Modify: `src/ui/band/PracticeFeedback.tsx`
- Modify: `src/ui/band/IdeasSolutions.tsx`
- Modify: `src/ui/band/Technical.tsx`
- Modify: `src/architecture/graphData.ts` only if current labels remain false after code changes.
- Modify: `scripts/item5ProjectionInheritanceAudit.mjs`

**Interfaces:**
- Consumes: authority and canonical lifecycle metadata from Task 2.
- Produces: truthful canonical UI/read-model wording and empty legacy adaptive lifecycle projection when canonical state exists.

- [x] **Step 1: Suppress legacy adaptive profile synthesis for canonical bands**

Add an early canonical branch to `deriveAdaptiveHumanProfile` that projects no legacy ideas, responses, attempts, routines, adaptations, or variants. Preserve the profile caps/integrity shape and mark the mode/overview as canonical suppression rather than behavior-active legacy history. Do not change `advanceAdaptiveHumanState`, `deriveAdaptiveDecisionSupport`, or selection logic.

- [x] **Step 2: Prevent plans from becoming visible-practice diffusion**

In `buildPracticeTraceDiffusionItems`, canonical readiness items are eligible only when their exact metadata proves `practice_attempted`, `existing_physical_work_executed`, or a canonical conclusion/response. `planned_unexecuted` and `blocked_material_execution` yield no visible-practice trace. Legacy compatibility items retain current behavior.

- [x] **Step 3: Update Problems & Trials rendering**

Use `profile.authority` to render canonical wording. Canonical cards show exact problem origin/status and idea/experiment/response statuses from `candidate.canonical`; legacy cards retain existing text with an explicit compatibility note. Never label canonical ideas as independently plausible trials.

- [x] **Step 4: Update Practice Feedback rendering**

For canonical profiles, group items by exact lifecycle facts rather than heuristic readiness buckets. Render planned experiment, attempted practice, response state, efficacy IDs/outcomes, and execution truth. A material plan displays “material execution not proven” and never “tried”, “successful”, “paid”, or “learned”. Daughter fragments/problems display an inherited-not-tested note even when there are no items.

- [x] **Step 5: Correct Ideas & Solutions and Technical wording**

Change “physical test” to “planned or recorded test”; keep planned material/procedure/cost labels. Technical always mounts Problem/Practice projection details, labels their authority, displays canonical IDs/statuses/execution truth, and renames “canonical physical experiments” to “canonical experiment plans and outcomes”. Legacy adaptive details remain conditional on canonical absence.

- [x] **Step 6: Run the complete focused audit**

```bash
node scripts/item5ProjectionInheritanceAudit.mjs
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.node.json --noEmit
npm run build
```

Expected: Pass-3 audit `verdict: "PASS"`; no TypeScript/build failures.

- [x] **Step 7: Commit downstream truth consolidation**

```bash
git add scripts/item5ProjectionInheritanceAudit.mjs src/sim/agents/adaptiveHuman.ts src/sim/agents/socialEcologicalDiffusion.ts src/ui/band/ProblemsAndTrials.tsx src/ui/band/PracticeFeedback.tsx src/ui/band/IdeasSolutions.tsx src/ui/band/Technical.tsx src/architecture/graphData.ts
git commit -m "test: certify item5 projection inheritance"
```

---

### Task 4: Prove mutation sensitivity and run the full regression battery

**Files:**
- Create/modify only evidence files under `docs/evidence/item5-pass3/`.

**Interfaces:**
- Consumes: completed production tree and Pass-3 audit.
- Produces: byte-identical mutation restoration proof, semantic benchmark summary, Item-4 JSON evidence, and deterministic fingerprint evidence.

- [x] **Step 1: Perform the reversible mutation**

Record SHA-256 of `problemPractice.ts`, replace the canonical guard condition with a forced legacy branch using a narrowly targeted reversible edit, run the Pass-3 audit, and require exit 1 with `canonicalProblemsAreExclusive: false`. Restore from an exact temporary byte copy, recompute SHA-256, and require equality. Do not use Git reset/checkout for restoration.

- [x] **Step 2: Run required compile/build and focused audits**

```bash
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.node.json --noEmit
npm run build
node scripts/item5PhysicalEffectProvenanceAudit.mjs
node scripts/item5ProjectionInheritanceAudit.mjs
node scripts/adaptationBoundaryAudit.mjs
node scripts/expeditionAdaptationEfficacyAudit.mjs
```

- [x] **Step 3: Run Item-4 freeze audits**

```bash
node scripts/fissionFieldTransferAudit.mjs --out docs/evidence/item5-pass3/fission-field-transfer.json
node scripts/item4WholeIntegrationFreezeAudit.mjs --out docs/evidence/item5-pass3/item4-whole-integration.json
```

- [x] **Step 4: Run deterministic Map-2 comparison**

```bash
node scripts/demographicLongRunAudit.mjs --map map2 --years 50 --repeat
```

Require deterministic true, identical repeats, and exact fingerprint
`f509b2f4d6e8a463b7505025afe22d151fd45a0598bd9550fbb84aac900da03c`.

- [x] **Step 5: Run and semantically inspect all three benchmarks**

```bash
npm run sim:benchmark -- --targeted-practical-adaptation-check
npm run sim:benchmark -- --targeted-adaptive-efficacy-check
npm run sim:benchmark -- --targeted-routines-2-check
```

Parse the JSON payloads and require their top-level or targeted verdict fields to report `passed: true`. Record natural adaptation attempts/effective counts and all reported state caps.

- [x] **Step 6: Run diff hygiene**

```bash
git diff --check
git status --short
```

Inspect the complete diff and exact changed-file list before documentation.

---

### Task 5: Record evidence, update handoff truth, commit, and push

**Files:**
- Create: `docs/evidence/item5-pass3/PASS3_EVIDENCE.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `docs/HANDOFF.md`
- Modify: `docs/superpowers/plans/2026-08-20-item5-pass3-projection-inheritance.md` to mark completed checkboxes.

**Interfaces:**
- Consumes: exact command outputs and Git history from Tasks 1–4.
- Produces: durable Pass-3 handoff with Item 5 still open/unfrozen.

- [x] **Step 1: Write `PASS3_EVIDENCE.md` from measured outputs**

Include exact base/branch/worktree; RED failure; complete caller classifications; alternatives and selected hierarchy; canonical/legacy/inheritance/UI/no-behavior proofs; Pass-2 preservation; mutation hashes; full command verdicts; semantic benchmark booleans; Map-2 fingerprint; natural attempt/effective counts; caps; Item-4 verdicts; exact changed files; remaining portable-material and later Item-5 debt.

- [x] **Step 2: Update current status documents only**

Add a concise current-authority block to `AGENTS.md`, `CLAUDE.md`, and `docs/HANDOFF.md`. State Pass 3 implemented/pending independent architect review, Item 5 open/not frozen, no merge, and no Item-4 or behavior change. Do not rewrite cumulative frozen checkpoint history.

- [x] **Step 3: Commit documentation and evidence**

```bash
git add AGENTS.md CLAUDE.md docs/HANDOFF.md docs/evidence/item5-pass3 docs/superpowers/plans/2026-08-20-item5-pass3-projection-inheritance.md
git commit -m "docs: record item5 projection consolidation pass3"
```

- [x] **Step 4: Run final fresh verification on the committed tree**

Repeat the complete Task-4 battery plus `git diff --check`. Inspect every JSON payload again. Run the required author/committer log command and `git status --short`; status must be empty.

- [ ] **Step 5: Push only the checkpoint branch and verify parity**

```bash
git push origin checkpoint/item5-projection-inheritance-pass3
git rev-parse HEAD
git rev-parse @{upstream}
git rev-list --left-right --count HEAD...@{upstream}
```

Required parity: `0 0`. Stop after the Pass-3 report; do not start another pass, freeze Item 5, or merge `main`.
