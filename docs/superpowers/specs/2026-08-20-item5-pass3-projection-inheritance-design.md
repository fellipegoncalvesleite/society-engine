# Item 5 Pass 3 Canonical Projection and Inheritance Design

## Status and scope

This design implements Roadmap Item 5 Pass 3 from exact accepted Pass-2 base
`31363c4f8e19e1c4f536338ecd0ef59e3fa7082f` on
`checkpoint/item5-projection-inheritance-pass3`.

The pass consolidates read-model authority only. It does not add material
execution, inventory, crafting, production, or physical effects; change Item-4
fission mechanics or inheritance richness; tune physical or demographic
coefficients; start Item 6; freeze Item 5; or merge to `main`.

## Problem statement

`band.practicalAdaptation` is the canonical Item-5 problem → idea → experiment
→ response → efficacy history. The older `problemPractice.ts` and
`practiceFeedbackReadiness.ts` modules are described as read-only projections,
but they currently derive fresh problem frames, trial candidates, and readiness
statuses from ecology, material affordances, repetition, camp conditions, and
other context even when canonical state exists. Their downstream projections and
UI can therefore narrate a second adaptation history.

The same defect extends one level farther than the two named modules:
`deriveAdaptiveHumanProfile` still synthesizes legacy ideas for canonical bands,
and those ideas can enter public-story and knowledge-carrier projections even
though `IdeasSolutions.tsx` itself correctly prefers the canonical chain.

## Selected architecture: A — canonical adapter/read-model layer

Add one pure canonical projection adapter for the two existing public profile
shapes. The adapter consumes a `Band` with `practicalAdaptation` and current
display time; it maps persisted canonical facts without calling ecology,
affordance, repetition, camp, identity, event, or legacy-adaptive synthesis.

The existing entry points remain stable:

```text
deriveProblemPracticeProfile(world, band)
  practicalAdaptation present  -> canonical adapter
  practicalAdaptation absent   -> legacy heuristic projection

derivePracticeFeedbackReadinessProfile(world, band)
  practicalAdaptation present  -> canonical adapter
  practicalAdaptation absent   -> legacy heuristic projection
```

The adapter owns all canonical-to-read-model mapping, so problem and readiness
modules cannot drift into separate interpretations. Existing legacy algorithms
remain intact behind an explicit `legacy / pre-canonical / compatibility`
branch.

### Why B is rejected

A canonical-first rewrite independently inside both existing modules would keep
consumer churn low, but it would duplicate family, lifecycle, efficacy, and
execution-truth mapping. Two copies of that logic would recreate the authority
problem inside the projection layer.

### Why C is rejected

Migrating only the UI would fix the visible panels while leaving camp foothold,
social diffusion, adaptive-human profiles, public stories, and knowledge-carrier
read models able to consume independently synthesized history. The defect is a
projection graph problem, not only a React problem.

## Canonical projection contract

Every returned profile declares one of two authorities:

- `canonical_practical_adaptation`: every lifecycle fact is mapped from
  `band.practicalAdaptation`;
- `legacy_compatibility`: the pre-canonical heuristic projection is in use
  because canonical state is absent.

For canonical profiles:

- problem cards come only from `problems`;
- candidate cards come only from `ideas`, joined by stored identifiers to
  `experiments` and `responses`;
- experiment status and attempt count come only from `experiments`;
- response status comes only from `responses`;
- feedback type and quality come only from `efficacyRecords` and stored
  experiment conclusions;
- fragment basis comes only from `fragments`;
- physical-work proof comes only from matching persisted `waterWorks`;
- family/category mapping is presentation metadata and never claims another
  event or lifecycle transition.

Canonical projection metadata must retain the exact canonical IDs and statuses.
The older coarse family fields remain for stable icon/grouping consumers, but UI
and audits judge lifecycle truth through the exact canonical metadata.

An underway experiment with no qualifying execution proof is rendered as a plan.
For a `material_execution_required` variant it is explicitly
`blocked_material_execution`, regardless of planned materials, procedure, labor,
risk, or opportunity cost. The adapter must not call physical relief readers or
infer execution from response confidence. Practice-only attempts may be shown as
attempted when canonical `attemptSeasons` or efficacy proves practice. Existing
physical work may be shown as executed only when matching persisted `waterWorks`
exists.

The response states `forming`, `active`, `dormant`, and `abandoned` are preserved
verbatim. An active or forming response is never synthesized from an idea or an
inherited fragment; it must already exist canonically.

## Inheritance contract

The two Item-4 daughter creation paths remain unchanged:

- `demography.ts` calls `inheritPracticalAdaptationForDaughter` through
  `adaptationBoundary.ts`;
- `fissionDepartureSeam.ts` calls the same canonical inheritor;
- `fissionFieldTransferPolicy.ts` continues to classify
  `practicalAdaptation` as degraded/partial inheritance.

The inherited canonical state already contains weakened `basis: "inherited"`
fragments and at most limited inherited problem framing, while resetting
responses, efficacy records, ideas, experiments, and waterworks. The new adapter
projects that state as inherited knowledge not tested here. It does not enrich
the daughter to make the UI fuller and does not turn inherited fragments into a
candidate, attempt, conclusion, response, efficacy record, artifact, or physical
work.

## Caller and authority inventory

| Module/caller | Classification | Pass-3 treatment |
| --- | --- | --- |
| `practicalResponses.ts` | canonical behavior and writer | Unchanged except a read-only execution-class query if needed by the adapter; Pass-2 gates remain authoritative. |
| `adaptationBoundary.ts` | canonical behavior boundary | Unchanged unless the internal adapter needs an explicitly curated read-only helper; no new writer. |
| `demography.ts` | canonical inheritance behavior | Unchanged. |
| `fissionDepartureSeam.ts` | canonical inheritance behavior | Unchanged. |
| `fissionFieldTransferPolicy.ts` | canonical inheritance gate | Unchanged. |
| `problemPractice.ts` | projection/read model | Becomes canonical-first; current heuristic body is explicit legacy fallback. |
| `practiceFeedbackReadiness.ts` | projection/read model | Becomes canonical-first; current heuristic body is explicit legacy fallback. |
| `campFoothold.ts` | projection/read model | Continues to consume the stable problem profile; canonical bands receive canonical frames/ideas only. It may explain camp context but cannot create adaptation history. |
| `socialEcologicalDiffusion.ts` | projection/read model | Consumes canonical readiness for canonical bands; only actually attempted/proven canonical practice is eligible for a visible-practice trace. Plans remain plans. |
| `adaptiveHuman.ts` advance/support functions | legacy compatibility behavior | Existing production guards remain. They advance or influence only when canonical state is absent. |
| `deriveAdaptiveHumanProfile` | legacy projection with a canonical leak | Returns no synthesized legacy lifecycle for canonical bands; legacy synthesis remains available when canonical state is absent. |
| `legacyAdaptiveHumanCompatibility.ts` | legacy compatibility boundary | Remains explicitly non-canonical and is not promoted into the adapter. |
| `knowledgeCarriers.ts` | projection/read model | Stops receiving synthesized legacy ideas/attempts for canonical bands through the profile guard; canonical fragment/response facts may be explained only when directly mapped. |
| `publicHumanStory.ts` | projection/read model | Stops receiving synthesized legacy ideas/attempts for canonical bands through the profile guard; no speculative adaptation stories are backfilled. |
| `campMovement.ts` profile function | technical/read-model projection | Its foothold references remain display-only. `advanceCampMovementState` does not call either old projection module. |
| `ProblemsAndTrials.tsx` | UI | Displays canonical problems and idea/plan statuses when canonical, explicit legacy language otherwise. |
| `PracticeFeedback.tsx` | UI | Displays canonical plan/attempt/response/efficacy truth, including blocked material execution and inherited-not-tested state. |
| `IdeasSolutions.tsx` | UI | Keeps direct canonical preference; wording distinguishes plans from execution and does not call every experiment a physical test. |
| `Technical.tsx` | technical/debug UI | Shows adapter authority and exact canonical joins instead of hiding the canonical projection details or labeling plans as physical experiments. |
| `BandMarkdownExport.tsx` | UI/export wrapper | Inherits corrected panels; no independent lifecycle logic. |
| `BandPanel.tsx` | UI wrapper | Inherits corrected panels; no independent lifecycle logic. |
| `architecture/graphData.ts` | documentation/discovery | Update descriptions only if needed to stop claiming the old heuristic lifecycle is current authority. |

No production simulation decision path currently calls
`deriveProblemPracticeProfile` or `derivePracticeFeedbackReadinessProfile`.
`advanceAdaptiveHumanState` derives its own legacy direct ideas but is guarded by
`band.practicalAdaptation === undefined`; canonical decision shaping also returns
before applying legacy influence. Pass 3 preserves those guards and turns their
isolation into an executable audit.

## UI behavior

The UI remains compact and keeps the current panels. It changes wording and card
grouping only where required for truth:

- Problems & Trials: perceived canonical problems, considered/selected/
  postponed/rejected ideas, and joined experiment plan status;
- Practice Feedback: planned, attempted practice, concluded experiment,
  forming/active/dormant/abandoned response, and interpreted efficacy;
- Ideas & Solutions: the raw canonical causal chain with planned requirements
  separated from observed outcomes and execution proof;
- Technical: exact authority mode, canonical IDs/status joins, inheritance basis,
  and execution-truth classification.

Legacy panels retain their current heuristic cards but label the authority as
compatibility projection. A band cannot show canonical and legacy adaptation
histories as peers.

## RED-first audit and mutation

Create `scripts/item5ProjectionInheritanceAudit.mjs` before production edits.
It loads real production modules through the existing Vite SSR audit pattern and
constructs controlled bands for these checks:

1. a canonical problem and idea remain the only projected problem/candidate even
   when ecology and other context would synthesize extras;
2. experiment, response, and efficacy statuses remain exact, including an
   underway plan and a dormant or abandoned response;
3. a `material_execution_required` plan remains unexecuted, pays no cost, creates
   no physical work/capability, and matures no efficacy;
4. the real canonical daughter inheritor yields degraded inherited fragments and
   limited framing, with no responses, ideas, experiments, efficacy, or
   waterworks, and the read model says untested here;
5. a band with no canonical state still receives a non-empty legitimate legacy
   compatibility projection;
6. serializing the band/world before and after projection is byte-identical, and
   caller/source checks confirm the projection functions are absent from
   production decision writers.

The initial audit must fail against the accepted base for the authority drift,
not from setup errors. After GREEN, reversibly bypass the canonical branch or
force a canonical band through heuristic synthesis. The audit must fail on the
intended invariant. Restore the changed source byte-identically and record the
same SHA-256 before and after.

## Verification and acceptance

Run the complete command battery specified by the Pass-3 request. Inspect every
benchmark JSON payload for `passed: true`; exit zero alone is insufficient. The
50-year Map-2 repeat must remain deterministic, identical across both repeats,
and exactly equal to Pass 2 fingerprint
`f509b2f4d6e8a463b7505025afe22d151fd45a0598bd9550fbb84aac900da03c`.

Any trajectory change is a stop condition unless a real behavioral caller leak
is proven and reported before accepting the change. No coefficient tuning may be
used to recover parity.

Final evidence lives in `docs/evidence/item5-pass3/`, including
`PASS3_EVIDENCE.md`, the two required Item-4 JSON audit outputs, RED/GREEN and
mutation evidence, semantic benchmark verdicts, exact fingerprint, caller
inventory, commit identities, and parity/cleanliness results. `AGENTS.md`,
`CLAUDE.md`, and `docs/HANDOFF.md` are updated only to reflect implemented Pass-3
reality. Item 5 remains open and unfrozen.
