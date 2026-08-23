# Architecture Ownership

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
