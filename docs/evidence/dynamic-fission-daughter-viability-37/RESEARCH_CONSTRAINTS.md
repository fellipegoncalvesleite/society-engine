# Roadmap Item 4 — research constraints

What the literature does and does not license this simulator to encode. Each claim is classified:

- **supported mechanism** — broadly converged across independent lines of evidence;
- **plausible interpretation** — reasonable reading, not settled;
- **contested theory** — actively disputed;
- **implementation abstraction** — a modelling convention with no direct empirical claim;
- **deliberate simplification** — knowingly cruder than reality, for a stated reason.

**Research constrains the architecture. It does not dictate a formula.** Nothing below is turned
into a universal constant, and §7 lists what is explicitly forbidden.

---

## 1. Fission–fusion is ordinary, not exceptional

**Supported mechanism.** Residential groups in mobile foraging societies change composition
routinely — seasonally, and within seasons. Camp membership is fluid rather than fixed, and people
move between camps for many reasons. The classic descriptions (Turnbull on the Mbuti; Lee and the
Marshalls on the Ju/'hoansi; Woodburn's immediate-return framing) converge on this even where they
disagree about causes. Later syntheses of hunter-gatherer residence patterns reinforce that
co-residence is not principally organised around a single fixed unit.

**Architectural consequence:** separation must be a *process a group can enter and leave*, not a
one-way event that fires when a number is exceeded.

## 2. There is no universal band size, and no universal fission threshold

**Contested theory** in its strong form. Reported "typical" camp sizes cluster loosely in the low
tens, but the spread is wide, the reporting conditions vary enormously, and much of the classic
data comes from groups already displaced onto marginal land. Any single number is an artefact of
the sample.

**Explicitly refused here.** Dunbar's number, one optimal band size, and one inevitable fission
threshold are all **forbidden** — see §7. Size may be *one* pressure among several; it may not be
the gate.

## 3. Fission usually has several concurrent causes

**Supported mechanism.** Ethnographic accounts rarely attribute a split to one factor. Recurring
co-occurring causes: local resource decline; the pull of a known opportunity elsewhere; unresolved
interpersonal conflict; the burden of provisioning dependents; and simple accumulated friction of
living close together. Conflict-driven and opportunity-driven departures are both attested, and
neither subsumes the other.

**Architectural consequence:** the model must support **multiple sufficient routes** to a proposal,
including a route with **no intergroup conflict at all** (fixture F6), and conflict must **not**
guarantee a split (F5).

## 4. A departing group must be able to work, travel and feed itself

**Supported mechanism.** Human behavioural ecology on central-place foraging and on the energetics
of mobile groups converges on the constraint rather than on a magic number: a group that leaves
must contain enough productive foragers relative to its dependents to feed itself while moving, and
must be able to carry what it needs on bodies.

**Plausible interpretation:** dependent-heavy groups are more constrained in how far and how fast
they can move, and cooperative childcare (alloparenting — Hrdy, and the broader
cooperative-breeding literature) partly relaxes but does not remove that constraint.

**Architectural consequence:** viability is a *composition* question, not a headcount question.
Dependents and elders must consume and burden travel without contributing productive labour or
carrying. **No magic balanced founder population.**

## 5. Departures fail, and failure is not extinction

**Supported mechanism.** Attempted moves are abandoned, groups turn back, and separated groups
rejoin. Fluid membership means a failed departure typically ends in **reintegration**, not death.
Founder-effect and early-establishment literature (small-population demography, colonisation
ecology) independently supports the general point that the earliest period after establishment
carries the highest failure risk.

**Architectural consequence:** the model needs **abandonment, return and reintegration** as
first-class outcomes, distinct from band dissolution or extinction — which belong to Roadmap Item 6.

## 6. Knowledge is a real constraint on where a group can go

**Supported mechanism.** Landscape knowledge — routes, water, seasonal availability — is learned,
transmitted unevenly, and is a genuine limit on movement. Groups move toward country somebody
knows, and knowing *of* a place is not the same as knowing how to reach or exploit it.

**Architectural consequence:** destination selection must read only band-known information, and
"remembered", "reachable" and "exploitable" must stay distinct. This is already the standing
anti-omniscience rule and Item 4 does not weaken it.

## 7. What is explicitly forbidden

Per the brief, and consistent with §3.8 of the project's design philosophy, this checkpoint does
**not** encode:

| forbidden | why |
|---|---|
| Dunbar's number | a contested cognitive-limit extrapolation, not a residential rule |
| one optimal band size | the empirical spread does not support it |
| one inevitable fission threshold | fission is multi-causal; a single gate is the thing being replaced |
| a universal male/female founder ratio | this simulator has **no sex composition at all**; inventing one is forbidden by the standing prerequisite |
| a mandatory social stage | §3.1 — civilisation is not a ladder |
| progression toward Bronze Age organisation | same |
| culturally specific family or marriage rules | no kinship system exists to attach them to |

## 8. What this simulator cannot represent, and must say so

**Deliberate simplifications**, each named as one:

1. **No individuals.** Bands are aggregate cohorts. "Who leaves" cannot mean "which people".
2. **No households, marriage or descent.** Any founder-composition rule is an **accounting
   convention**, not a kinship claim.
3. **No sex composition.** Absent from canonical state; adding it is a separate demographic
   checkpoint and a stated prerequisite for any sex-specific claim.
4. **No individual relationships or factions.** Disagreement can only be represented through
   existing aggregate social state, not through who sided with whom.
5. **No culture, law or institutions.** "Successor group" therefore cannot mean succession in any
   legal or political sense — see the boundary in §13 of the brief.

## 9. Constraints this research actually places on the architecture

Distilled to what the implementation must honour:

1. Separation is a **process with phases**, reversible until it is not.
2. **Several independent causal routes**, none of them a lone threshold.
3. Viability is about **composition and material capability**, not population.
4. **Failure and reintegration** are normal outcomes.
5. **Knowledge bounds destination.**
6. Every founder-composition rule is an **abstraction that must name what it cannot know**.

---

## Sources consulted, by tradition

Ethnography of mobile foragers (Turnbull; Lee; Marshall; Woodburn; Kelly's synthesis of the
forager spectrum). Human behavioural ecology (central-place foraging; energetics of mobility;
Winterhalder and Smith's framing). Cooperative breeding and dependent burden (Hrdy; Kramer on
juvenile dependency). Small-population demography and founder effects (branching-process and
colonisation-risk literature). Hunter-gatherer demography (Gurven and Kaplan on mortality; Walker
et al. on life history).

**No figure from any of these is used as a constant.** They are used to decide *which quantities
are allowed to matter* and *which distinctions must exist* — nothing more.
