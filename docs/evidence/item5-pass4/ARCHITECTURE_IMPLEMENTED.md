# Roadmap Item 5 Pass 4 — Architecture Implemented

Status: final closure-correction implementation record pending independent architect review. This document does not accept or freeze Roadmap Item 5.

## Canonical authority

`band.practicalAdaptation` remains the sole canonical Item-5 causal/history authority. `band.adaptiveHuman` remains legacy compatibility/read-model state. `Band.technologies` remains legacy only. `materialAffordance` and the selected-band diagnostic UI remain projections/read models and do not write simulation truth.

The implemented causal separation is:

```text
human-known evidence
→ practical problem
→ technical/material primitives
→ bounded compositional design hypothesis
→ optional historical recognition
→ selected idea
→ experiment plan
→ physical execution only where independently proven
→ physical result
→ typed interpretation / localized feedback
→ practical response
→ efficacy
→ durable/degraded knowledge history
```

Permanent distinction:

```text
knowledge
!= plan
!= execution
!= physical result
!= efficacy
!= durable competence
!= artifact
```

## Closure correction 1 — primitive composition precedes recognition

Candidate construction no longer begins from a complete catalog of generic designs. `compositionalInvention.ts` builds normalized designs from bounded reusable inputs:

- functional intent;
- mechanism primitives;
- component/form primitives;
- process/operation primitives;
- technical fragments;
- current actionable human material-property beliefs;
- compatibility constraints;
- revision/history constraints.

The complete historical design set is not the discovery universe. Historical designs are consulted after a design has been composed, for recognition/compatibility and for already-existing physical-effect adapters.

The controlled closure audit produces uncatalogued normalized `design:ee8231c9` with `historicalMatch: false`. Its fixture also requires the relevant primitive basis; removing the required primitive removes that composition. A non-template persistence key by itself is not treated as proof of composition.

Primitive candidate work is bounded: mechanism inputs 12, component/form inputs 32, process inputs 36, raw candidates 6/problem and 18 globally, shortlist 3/problem.

## Closure correction 2 — historical material memory is not perpetual current actionability

`HumanMaterialBelief` stores history/provenance separately from its current effective epistemic strength. Stored property confidence is not deleted merely because time passes. Instead, `effectiveMaterialPropertyConfidence` applies current-evidence freshness when a role is being bound.

Controlled evidence proves the same belief identity moves:

```text
fresh observation → supported
stale without reinforcement → unknown
fresh re-observation → supported again
```

The identity remains `material-belief:band:audit:A:worked_plant_fiber`; re-observation reinforces/reactivates that belief rather than fabricating an unrelated one. Inherited knowledge is degraded and does not count as fresh local occurrence/execution evidence.

## Closure correction 3 — localized binding failure changes later binding

Specific material-binding failure can now record a bounded `failedMaterialBinding` scoped to the implicated design/role/material/property/context evidence. Candidate binding consults that localized lesson rather than globally poisoning a material category.

Controlled evidence starts with material A and B both plausible for the same support role. A specifically attributed failure changes later binding to `material:audit:B-binding`. The unknown-failure negative control keeps `material:audit:A-binding` eligible. Only the implicated A property is weakened in the fixture (`tensile_fibrous` 0.78 → 0.69); A `flexibility`, A `heat_response`, and B remain unaffected. A later reinforcement newer than the localized lesson can make the prior binding eligible again.

## Closure correction 4 — no-executor plans are blocked, not falsely underway

A novel design with no existing execution/effect adapter may exist as human knowledge and a plan, but its experiment starts as `blocked_by_execution`, not `underway`.

`blocked_by_execution` is part of the existing canonical experiment/history authority; no second plan ledger was added. Such plans:

- accumulate zero attempt seasons;
- carry no execution occurrence/evidence;
- create no physical response/effect;
- mature no efficacy;
- remain bounded by the existing experiment cap;
- rank below genuinely `underway` experiments.

The controlled fixture retains one real `underway` experiment ahead of three blocked plans inside the cap of four.

Long-run inspection exposed a second-order defect in the bounded history: once an unchanged blocked experiment was evicted from the cap-4 experiment store, the same non-template design could be immediately planned again. The correction reuses the existing bounded selected-idea history as a 32-tick reconsideration memory for composed plans. This adds no second plan authority and no permanent blacklist: recent unchanged blocked designs are suppressed, then become reconsiderable after the bounded cooldown. Historical executable variants are not suppressed by this rule.

## Physical execution boundary

Pass-2 execution provenance remains authoritative. `practice_only` responses keep only their already-justified practice/measurement effects. `existing_physical_work` remains tied to existing narrow physical authorities such as `waterWorks`. `material_execution_required` designs have zero material physical effect and zero efficacy maturation without independent execution proof.

A composed design with no historical effect adapter therefore stays knowledge/plan state. Pass 4 adds no inventory, extraction stock, generic crafting, produced-object, construction-labor, ownership, fuel, wear, maintenance, metallurgy, or WORLD-M0 authority.

## Feedback, revision and inheritance

Typed feedback permits precise change only when the evidence is precise. Unknown failure cannot invent role/property/material blame. Revision/dead-end lessons and design hints remain bounded.

Daughter inheritance may carry degraded problem framing, technical fragments, human material beliefs, and design hints with origin provenance. It does not copy parent execution, efficacy, physical success, waterworks, objects, current local occurrence, or local competence.

## Projection truth correction

`practicalAdaptationProjection.ts` remains read-only. The selected-band UI may display stored history, but an unproven stored lifecycle label such as `concluded_success` is not presented as admitted canonical execution/success truth when execution proof is absent.

```text
stored historical claim != admitted canonical execution truth
```

## Scope exclusions preserved

No Item-4 physical redesign, Item 6, WORLD-M0, geology, extraction, inventory, craft/production, construction, metallurgy, culture/adoption, or roadmap rewrite is implemented by this closure correction.
