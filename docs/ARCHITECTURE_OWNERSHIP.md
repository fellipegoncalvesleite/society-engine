# Architecture Ownership

<!-- DIAG1_PHASE3_CANDIDATE_START -->
## Current authority — Phase3 implemented; independent review pending (2026-10-03)

Phase2 is supervisor-accepted at production `80bb005f6bf9856720ac07d3acbae9e4a57c677f`, reviewed publication `fd8ef2674ad193e61535688b1edeb20d0841596d`. Acceptance was committed/pushed first as `96126be8484b23725fc9977c0527c9e8178feb3a`, the Phase3 base. This block supersedes older execution-status text below without rewriting historical evidence.

Phase3 candidate implements B005 generic current fauna availability with exact provenance, B006 food-family eligibility before ranking, B007 canonical plant/scout identity, and B009/I1 honest noncausal diagnostics/UI. Evidence: `docs/evidence/diag1-corrections/phase3/PHASE3_REPORT.md`, `VALIDATION_RESULTS.md`, `FINAL_FINDING_MATRIX.md`. Opportunity26/26, diagnostics5/5, integrated7/7;4required plus16retained mutants behaviorally detected/restored; both-map1260-day whole-state daily/weekly/monthly/seasonal/repeat/fresh equivalence, both TypeScript projects, build/import/graph PASS. Natural first divergence is Map1 day519; B006 remains0/2640 new selections per arm (historical0/600 preserved), B007 natural action effect unobserved. Diagnostic on/off worlds agree, including stable1080-day Map1 source-preserving rerun.

F3/B008 remains structurally OPEN, `DEFERRED_EXPLICIT_OWNER`: M0.4 realization, M0.5 physical-area/scaling/bounds certification, M0.7 migration. B010 ruling B: omitted SCALE1 reader, `OPEN_UNRESOLVED`, separate physical-distance authorization needed; no kilometer threshold was guessed. Both M0.2 blockers remain OPEN_UNRESOLVED and Task12 PAUSED. Canonical r11 remains byte-identical; existing roadmap ownership is reinforced, not changed.

Next: coherent production/tests/evidence commit and push, later SHA documentation, ONE fresh read-only combined reviewer from `73cc38b916e236339897c59686638efafd569b6e` through production HEAD, record recommendation and STOP. Exact publication SHAs belong in subsequent `phase3/PUBLICATION.json`. No self-acceptance, main/M0.2 merge, formal freeze, Task12 resumption or portable-pair export before final supervisory acceptance.
<!-- DIAG1_PHASE3_CANDIDATE_END -->


<!-- DIAG1_PHASE2_SUPERVISOR_ACCEPTANCE_START -->
## Current authority — Phase 2 accepted; Phase 3 authorized (2026-10-03)

Last verified against commit: `fd8ef2674ad193e61535688b1edeb20d0841596d` on `fix/diag1-human-support`, matching origin before this documentation-only update. Last updated: 2026-10-03. Current active checkpoint: bounded DIAG-1 Phase 3 implementation, then one independent combined review and STOP.

The supervisor explicitly **ACCEPTED Phase 2**. Accepted production authority: `80bb005f6bf9856720ac07d3acbae9e4a57c677f`; reviewed/evidence publication HEAD: `fd8ef2674ad193e61535688b1edeb20d0841596d`. Independent verdict supplied with that acceptance: SPEC COMPLIANCE PASS; CODE QUALITY PASS; Critical 0, Important 0, Minor 0; PHASE 2 ACCEPTANCE RECOMMENDATION YES. This records the supervisor's decision, not implementer self-acceptance. Exact disposition and limitations: `docs/evidence/diag1-corrections/phase2/SUPERVISING_ACCEPTANCE.md` (repository-relative).

This block supersedes the older Phase-2-pending/Phase-3-unstarted authorization statements below, retained as historical evidence. No whole-game certification, formal checkpoint freeze, main merge or WORLD-M0 Task 12 resumption follows. Phase 3 covers B-005/B-006/B-007 and B-009/I1 only, integrated Phases 1–3 verification, B-010 adjudication and explicit future ownership. Global fauna realization and demographic calibration remain outside production scope. Canonical r11 remains byte-identical; protected Task12 WIP remains untouched. Phase 3 and the combined DIAG-1 program require final supervisory acceptance after independent review; the implementer must not self-accept.

Known stale or unverified sections: historical pending-review/current-status headlines below are superseded only to the extent stated here; prior limited or blocked evidence is not retroactively promoted to PASS.
<!-- DIAG1_PHASE2_SUPERVISOR_ACCEPTANCE_END -->


This document defines the permanent working contract between supervising architects and implementation agents for architecture-heavy work in this repository. It is project-wide governance, not checkpoint evidence, and it applies whenever a task can materially change subsystem boundaries, canonical authority, causal ownership, simulation semantics, persistence, migration, or cross-system behavior.

## Architect authority

The supervising architect owns most consequential architectural decisions. Before prescribing a change, the architect is expected to inspect the actual Git state, production code, relevant audits, and current evidence rather than designing from summaries alone. The architect should read and reason about the whole roadmap, not only the active item, so a local change does not accidentally pre-empt or contradict a later system.

The architect decides, or explicitly delegates within a bounded design, questions such as:

- subsystem and authority boundaries;
- canonical state and causal ownership;
- cross-system integration;
- migration, back-propagation, and compatibility strategy;
- whether an existing system must be expanded, migrated, replaced, or left behind an explicit future seam;
- what must be implemented now versus what must remain a future extension point;
- major RED/GREEN certification strategy and acceptance criteria;
- whether a subsystem needs a substantial brainstorming/design phase before implementation;
- major refactors or behavior changes that alter simulation semantics.

The architect should actively make these decisions rather than routinely delegating them to an implementer because the implementation is inconvenient or ambiguous. For architecture-heavy systems, a substantial design/brainstorm phase should normally happen first, and the resulting implementation specification may be large and prescriptive when that is what correctness requires.

Architecture-heavy examples include events, invention diversity, geology and materials, architecture, culture, social systems, institutions, economy, production, settlements, warfare, and historical periods. These examples are illustrative, not exhaustive.

## Implementer authority

The implementer primarily owns execution of the approved architecture. The implementer should inspect the actual code, implement the specified design, make ordinary local engineering choices, write and run tests, find hidden defects, identify conflicts with existing architecture, and report discoveries with evidence.

Normal local implementation decisions include helper placement, function decomposition, local naming, test-fixture structure, narrow type representation, and equivalent low-level implementation choices that do not change architectural ownership or simulation meaning.

Ambiguity is not permission to redesign major project architecture. The implementer must not silently change canonical authorities, causal models, persistent state ownership, migration policy, roadmap responsibility, or simulation behavior simply because a different design would be easier to implement.

## Architectural escalation

When implementation reveals an unresolved question, classify it before acting.

**LOCAL IMPLEMENTATION DECISION** means the approved architecture already determines the important semantics and the remaining choice is an equivalent engineering detail. The implementer may decide it and proceed.

**ARCHITECTURAL DECISION** means the answer can change authority, persistence, causality, cross-system responsibility, migration, compatibility, or simulation behavior. The architect should decide it.

Examples of architectural questions include:

- which state is canonical;
- whether something is physical state or a projection/read model;
- whether a new persistent state field should exist;
- whether Roadmap Item N should absorb responsibility from Item M;
- whether a new physical subsystem is required;
- whether behavior should change;
- how inheritance or transfer semantics work;
- whether a future system should replace the current abstraction;
- whether an existing subsystem must be migrated or back-propagated.

If implementation uncovers a consequential unresolved architectural question, preserve the evidence and state the contradiction precisely. Implement only a clearly safe bounded correction when it follows already-established authority rules. Otherwise stop at that architectural boundary for architect review rather than inventing a new architecture locally.

## Local and weaker implementation models

Implementers may be weaker or more local models than the supervising architect. Project correctness therefore must not depend on the implementer independently rediscovering the intended architecture from partial context.

Architect specifications should be explicit enough to make the intended architecture executable. For consequential work they should state, as applicable:

- invariants;
- scope and non-scope;
- canonical authorities;
- forbidden shortcuts;
- required RED/GREEN tests and negative controls;
- migration and back-propagation rules;
- expected behavior and non-behavior;
- acceptance and stop conditions.

The goal is not to remove implementation judgment. It is to keep local judgment local and keep architectural ownership explicit.

## No blind obedience

Architectural ownership does not require the implementer to hide evidence or knowingly implement a broken design. If actual code, runtime behavior, tests, or repository evidence proves an architect assumption unsafe, contradictory, or impossible, the implementer must surface that conflict clearly.

Do not implement architecture known to be bad merely because it appeared in a prompt. Preserve the evidence, explain which assumption failed, make only a bounded correction that is already authorized by existing rules when one is unambiguous, and otherwise escalate the architectural decision.

## Cross-system evolution

The final post-Item-5 roadmap rewrite is expected to strengthen a permanent rule for future roadmap work: every new roadmap item begins with whole-roadmap reading, past-system impact analysis, future-system dependency analysis, and migration/expansion review. That process is intended to prevent a new subsystem from being designed as though earlier and later systems do not exist.

This document records that governance direction only. It does not perform, pre-empt, or substitute for the post-Item-5 roadmap rewrite.

## DIAG-1 Phase2 candidate: food, nutrition time and movement recency

Status: IMPLEMENTED / PENDING SUPERVISING INDEPENDENT REVIEW. The bounded F1/F4/F5 instruction follows the clean independent Phase1 gate at `d8c6233872b6bcb76da5fe6c3747c889ec402eb9`. This is no formal freeze and grants no authority for Phase3 or paused WORLD-M0 Task12.

- `humanFoodSupport.ts` owns the named usable-raw-food→support conversion. Scale100 is inherited model semantics. Requests, physical stock/take, carrying limits, depletion and losses remain raw. Provisional running/operation/site/return consumers use the same bridge.
- `nutritionExposure.ts` defines validated half-open physical intervals, exact clipping, overlap refusal and720 completed-day retention plus one bounded open interval. `seasonalSurvival.ts` remains the sole writer of existing `seasonalSupport`; current/recent/chronic queries are1/360/720 physical days. Pooled support/demand and experienced stress/recovery remain distinct. `currentSeasonSupport` projects one completed day; `recentSamples` retains full intervals.
- Residential demand is an integrated, bounded scalar meter. Its receipt cursor subtracts already measured totals within the same physical receipt period; it is not an inventory or deposit-ID set. Departure/release/reunion close the outgoing producer exactly once. Six live provisional phases exclusively own provisional daily nutrition.
- Founder allocation preserves intensive historical condition and apportions recorded support/demand between disjoint bodies. Reintegration recomposes dated aggregate condition and quantities with explicit unknown-population coverage. This boundary does not implement individual life-course demography, stored provisions or new physical transfers.
- `nutritionMigration.ts` is pure and atomic: known ordinary90-day abstractions remain coarse; reconstructible retained provisional daily chronology migrates active units together. Ambiguous spans and old completed decision evidence without a defined causal/unit migration refuse with a typed result, preserving the original save.
- `movementFatigue.ts` interprets the latest four genuine displacements without deleting history. `pressure.ts` refreshes only the movement component daily before mobility readers and preserves the uncapped separate nonmovement burden. Amplitude0.2 and linear7-day decay follow the supplied ruling;3/7/14 sensitivity is evidence, not parameter selection by population outcome.

Future health, provisioning, task-group and life-course owners must explicitly migrate these aggregate semantics. They may not silently reinterpret support units, erase unknown history, overlap producers or replay past decisions under new units. No new nutrition cache, physical-stock authority or unbounded history is introduced.
