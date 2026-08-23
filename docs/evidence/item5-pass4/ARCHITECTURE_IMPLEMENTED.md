# Roadmap Item 5 Pass 4 — Architecture Implemented

Status: closure-candidate implementation record. This document describes the implemented Pass-4 architecture; it does not declare Roadmap Item 5 accepted or frozen.

## Canonical authority

`band.practicalAdaptation` remains the sole canonical Item-5 causal/history authority. `band.adaptiveHuman` remains legacy compatibility/read-model state. `Band.technologies` remains legacy only and receives no new causal authority. `materialAffordance` remains a projection/read model, not canonical human knowledge.

The implemented causal chain is:

```text
lived / inherited human-known evidence
→ practical problem
→ technical fragments
→ human material beliefs
→ bounded compositional design hypothesis
→ selected idea
→ experiment plan
→ physical execution only where independently proven
→ typed observed result
→ localized interpretation
→ success / partial / failure / ambiguity
→ revision / dead end / dormancy
→ practical response
→ efficacy
→ degraded inheritance / future transmission
```

An idea is not an experiment; an experiment plan is not execution; execution is not success; success is not durable competence; and no Item-5 knowledge state manufactures inventory or an artifact.

## Human material knowledge

`HumanMaterialBelief` is now canonical band-level epistemic state. It carries a coarse material category/public label, bounded property beliefs with confidence and evidence/contradiction refs, known contexts, handling depth, provenance, and original-context provenance.

The temporary material-evidence adapter in `materialEvidence.ts` only translates already-legitimate band-known observations into weak human evidence. It does not scan raw terrain or hidden geology. In particular, wooded context may produce weak `encountered_woody_plant` evidence; it does not grant resin, shaft, frame, membrane, cordage, or other technical competence.

Material beliefs are bounded at 12 per band. Inherited beliefs are degraded, retain their origin/context provenance, and are not local occurrence or execution proof.

## Compositional design

`compositionalInvention.ts` implements normalized design identity over causal dimensions rather than labels or array order:

- functional intent;
- mechanism;
- component/form roles;
- required material-property predicates;
- operations/process structure;
- deployment class.

Semantically irrelevant insertion/array order is normalized. Public labels and discovery order do not define identity. Meaningfully different mechanism/process/deployment consequences remain distinct.

All historical Item-5 variants remain represented as bootstrap/compatibility templates and, where already supported, physical-effect adapters. They are not the whole invention universe. Generic bounded blueprints can generate non-template hypotheses without assigning them fabricated physical coefficients.

## Candidate generation

Generation consumes only human-known Item-5 state: practical problems/history, technical fragments, `HumanMaterialBelief`, design hints, revision/dead-end lessons, and explicit known-context evidence already held by the band.

Fixed budgets are:

- raw candidates per problem: 6;
- raw candidates globally per update/band: 18;
- shortlisted candidates per problem: 3.

Ranking uses deterministic keyed tie-breaking. Candidate generation supports many-to-many coupling between practical problems and functional intents. It does not enumerate a world/material Cartesian product and does not query raw terrain, hidden geology, or WORLD-M0 state.

## Typed feedback, revisions, and dead ends

Experiment feedback is typed and attribution is localized. Known component/material/operation implications can update the implicated evidence; ambiguous failure remains ambiguous and cannot invent precise blame. The previous blanket rule in which a failure weakened every supporting fragment has been removed.

Canonical state now carries bounded design hints and revision/dead-end lessons. Failed or partial paths can create revision hypotheses without removing the functional family from the invention universe. Dormant knowledge can remain recorded without being current local proof.

## Physical execution boundary

Existing Pass-2 execution provenance remains authoritative. `practice_only` responses can retain their legitimate bounded effects. `existing_physical_work` remains tied to its existing physical authority. `material_execution_required` designs have zero physical effect and zero efficacy maturation without execution proof.

Existing `waterWorks` remains a narrow physical-work authority. Pass 4 does not generalize it into crafting, construction, inventory, or production. A novel compositional design without an execution/effect adapter may exist as an idea, plan, revision, blocked experiment, or interpreted history but receives no invented physical coefficient.

## Inheritance and locality

Daughter inheritance may carry degraded:

- practical problem framing;
- technical fragments;
- human material beliefs;
- design hints.

It does not copy parent execution, efficacy, practical success, waterworks, objects, current local material occurrence, or local competence. Parent-place provenance remains explicit. Local reproducibility is derived from current band-known contexts/beliefs and can lapse after relocation while knowledge persists.

## Projection and UI

`practicalAdaptationProjection.ts` remains a pure projection over canonical state. The selected-band diagnostic UI exposes the design signature, provenance, functional intent, mechanism, component roles, operations, material beliefs/contexts, uncertainty, local reproducibility, plan requirements, execution proof, result/attribution, revisions/dead ends/dormancy, and inherited-versus-local status.

No UI-owned Item-5 state machine or simulation writer was added.

## Scope exclusions preserved

Pass 4 does not own or manufacture inventory, material stock, extracted quantity, components, produced objects, generic crafting, ownership, construction labor, fuel consumption, wear, maintenance stock, physical trade, culture/adoption, or WORLD-M0 material truth.
