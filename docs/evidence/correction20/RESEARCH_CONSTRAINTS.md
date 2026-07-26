# CORRECTION-20 — Research and anthropological constraints

This checkpoint is about the five conceptual stages between "the band knows a place exists"
and "a daughter group is living there". Its central constraint is that those stages are
*different questions*, and that a simulator which answers them with one blended score
cannot be reasoned about — not because blending is inelegant, but because a defect in one
stage becomes untraceable once it is summed with the others.

---

## 1. The five contracts are five different questions (§8)

| Stage | Question | Output type |
| --- | --- | --- |
| Physical feasibility | Can a subgroup physically get there and be supplied? | feasible / not — never a preference |
| Epistemic adequacy | Does the band know enough to act on this? | confidence / uncertainty — never richness |
| Daughter viability | Could the intended daughter maintain itself there? | projected support ratio + uncertainty |
| Split motivation | Why should a viable subgroup leave? | a fact about the PARENT |
| Destination preference | Among feasible, viable options, which is better? | a ranking, applied last |

The ethnographic warrant for keeping these apart is straightforward. Groups fission for
reasons internal to the group — size, crowding, declining returns, dispute, the labour a
splinter can carry. Where they go is constrained by what they know and can reach. Those two
things vary independently: a crowded band with nowhere good to go still has the motive, and
a band with excellent country next door and no internal pressure still has no reason to
divide. A model that multiplies destination quality into split motivation cannot represent
either case.

## 2. Split motivation must not be a proxy for destination quality

The specific inversion to avoid: a band that *discovers* good distant country becoming
*less* willing to divide because the discovery raised a travel-cost term feeding its
motivation. That is not a defensible model of anything. Exploration would then be
self-defeating by construction.

The defensible shape is a gate, not a product of qualities:

```text
motive to divide (a fact about the parent)
  × existence of at least one feasible, viable destination (a fact about the world as known)
  → willingness to execute
```

with distance affecting *which* destination and *whether it can be reached*, not *whether
the group wants to divide*.

## 3. A repeated term is not automatically a defect

This constraint runs the other way and matters just as much. Distance legitimately affects
route feasibility and legitimately affects preference among reachable places; those are
distinct physical consequences and charging both is correct. What is not correct is
charging the *same* consequence twice under two names.

The distinction is empirical, not rhetorical: it requires showing that neutralizing one
occurrence changes the outcome while the other occurrence still does its job. Declaring
"double-count" because a variable appears twice is exactly the reasoning §9 forbids, and it
is how a plausible-sounding label becomes an unjustified coefficient change.

## 4. Viability is about the daughter, not about the parent's core

Requiring a destination to beat the land the parent already occupies has no support in the
record. Splinter groups routinely settle poorer country — often precisely *because* the
parent core is full or contested. The question a viable-destination test must answer is
whether the projected daughter can maintain itself there, on evidence the band actually
holds.

Parent-superiority may legitimately inform *preference* between two viable options. It must
not be a hard gate on viability.

## 5. A projection is not a receipt

Parent support is receipt-derived: it is what the band physically brought home. Candidate
support is a projection from remembered terrain. Comparing them directly because both
happen to be bounded in [0,1] is a category error, and its behavioural sign is not
predictable in advance — CORRECTION-18 measured that the same error made a gate *too
permissive*, the opposite of what was expected.

So a candidate viability contract must state its own units: projected daughter population,
projected demand, projected support from known catchment, a confidence discount, and the
resulting maintenance ratio — and must never be described as a food receipt.

## 6. Fewer bands is not automatically a worse simulation

A world of fewer, larger, better-fed bands and a world of more, smaller, hungrier bands are
different outcomes, not better and worse ones. The defect exists only if the fission chain
behaves inconsistently with the physical and demographic state that produced it — for
instance if a band with genuine crowding, a viable reachable destination and no cooldown
still does not divide, or if it divides toward a place its own evidence says is unviable.

This is why §19 forbids defining PASS as "more fissions than the disabled control". The
acceptance behaviours are about *consistency*, not about counts.

## 7. Two maps may legitimately differ

CORRECTION-19's normalization showed map 1 and map 2 diverging through apparently different
mechanisms — fewer-but-larger bands versus equal-count-but-smaller bands. The constraint is
that this must be traced separately on each map rather than explained once and generalized.
An average across maps that conceals opposite mechanisms is worse than reporting neither.

## 8. Explicitly NOT calibrated here

No empirical claim is made about real fission rates, daughter founding sizes, dispersal
distances, or the frequency with which forager groups settle poorer land. The thresholds
(`MINIMUM_SPLIT_POPULATION`, `SPLIT_PRESSURE_THRESHOLD`, `DAUGHTER_MIN_POPULATION`,
cooldowns) are inherited and were not touched. This checkpoint changed no coefficient, no
threshold, and no habitat richness.
