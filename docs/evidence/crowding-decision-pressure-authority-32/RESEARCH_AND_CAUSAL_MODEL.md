# CORRECTION-32 — RESEARCH AND CAUSAL MODEL

Crowding / shared range / range release — roadmap item 3.
Branch `checkpoint/crowding-decision-pressure-authority-32` from CORRECTION-31's frozen tip
`3e2c1215b4ccef2beb799b3a7882247f6cd186cd`.

This document is written **before** any coefficient was inspected for the purpose of changing it, and
before the architecture was chosen. It answers §3 (causal brainstorming from the human phenomenon)
and §4 (academic research requirement). Every claim is tagged with one of the six required classes:

| Tag | Meaning |
| --- | --- |
| **[SUPPORTED]** | Mechanism supported across multiple ethnographic/archaeological contexts |
| **[VARIATION]** | Real, documented between-society variation — must not be encoded as a universal |
| **[CONTESTED]** | Interpretation genuinely disputed in the literature |
| **[ABSTRACTION]** | A simulator abstraction that stands in for a mechanism it cannot yet represent |
| **[CALIBRATION]** | A number chosen by the implementer; research constrains its sign and bound, not its value |
| **[FUTURE]** | Depends on a system this repository does not have |

---

## 1. Why does another human group's nearby presence matter?

Answered from the phenomenon first. The literature below is used to decide **which of these are
distinct causes**, not to supply numbers.

### 1.1 Because the same physical resources are being taken

Two bands within foraging reach of one another draw on overlapping patches. Each unit of plant
food, game or water taken by one is not available to the other. **[SUPPORTED]** — this is the
uncontroversial core of resource-competition ecology as applied to foragers, and it is the axis on
which the **ideal free distribution** (IFD) operates: foragers settle the best habitat first, and as
density rises the *marginal* suitability of that habitat declines until it equals the next-ranked
habitat, at which point settlement spreads
([Ideal Distribution Model and Archaeological Settlement Patterning](https://www.tandfonline.com/doi/full/10.1080/14614103.2020.1803015)).

**Repository consequence.** The simulator already measures this fact physically and separately:
`sharedCatchment.ts` splits reachable support between overlapping bands (AUDIT-27 measured one
neighbour costing 31.6% of reachable support, symmetric and order-invariant, and
`catchmentInvariants.mjs` independently confirms the 0.5/0.5 split), and `depletion.ts` /
`plantStock.ts` / `faunaStock.ts` advance real stocks against real harvest. **Therefore the presence
of bodies must not be converted a second time into an inferred resource loss inside the decision
score.** That would be charging the same competition twice — once where it physically happens and
once where it is guessed at.

### 1.2 Because there is less usable room, and rooms differ

Physical density is not felt equally everywhere. The same two bands are a serious problem at one
waterhole in a dry corridor and a non-event on a wide well-watered floodplain. **[SUPPORTED]** —
this is the standard reading of density effects being *habitat-conditioned* rather than absolute;
IFD's whole structure is that suitability is a property of (habitat × density), not of density.
**[VARIATION]** — what counts as "room" is ecology-specific (water in arid systems, defensible
littoral in coastal systems, passable ground in mountains).

**Repository consequence.** The terrain conditioning is legitimate and belongs to **exactly one**
transformation. It exists: `getCrowdingPenalty(tile, nearby)` = `weightedCrowding × dryAmplifier ×
(1 − spatialCapacityBuffer × 0.48)`. What is *not* legitimate is applying the untransformed
`weightedCrowding` **and** its terrain transform as two separately weighted costs on the same
candidate, which is what production does today (§5 of FINDINGS).

### 1.3 Because movement, noise, waste and disturbance degrade local use

Neighbours disturb game, foul water, occupy the good sleeping ground, and make quiet stalking
harder. **[SUPPORTED]** in the general sense that co-residence has real nuisance costs.
**[FUTURE]** in the specific sense: this repository has **no** disturbance authority — no tracks,
no trails as world features, no camp remains (`TemporaryTaskPartyRecord` asserts `noCamp: true`), no
trace freshness, no cross-band smoke, and no band/person cue in `landscapeVisibility.ts`
(established and deliberately left unfilled by CORRECTION-29 and CORRECTION-30). Disturbance is
therefore **not** a channel CORRECTION-32 may invent. It is folded, honestly and by admission, into
the single physical crowding cost as part of what "nearby people make this place worse to use"
means. **[ABSTRACTION]**

### 1.4 Because the other group may be socially dangerous — but only if there is evidence

Strangers may raid, may refuse access, may retaliate. **[SUPPORTED]** that inter-group hostility
occurs. **[CONTESTED]** and strongly so: the frequency and default character of forager inter-group
relations is one of the most disputed questions in the literature, with positions ranging from
routine lethal raiding to overwhelmingly peaceful multi-band networks. Any simulator that makes
proximity *itself* produce hostility has silently taken the most contested position in the field and
encoded it as physics.

**Repository consequence, and a hard invariant (§12.6).** Physical presence must **never** create
encounter tension, social danger, refusal or a territorial claim. Those already have honest
authorities with provenance rules established by the three preceding checkpoints:
`socialContext.ts` encounters (CORRECTION-29 — proximity ≤3 required), `rangeFriction.ts` (CORRECTION-30
— current physical proximity or a real report required), and `protoAccessMemory` with a real
lifecycle (CORRECTION-31 — evidence cools and releases). **CORRECTION-32 must not touch any of
them, and must not reproduce any of them from a body count.**

### 1.5 Because the place becomes harder to hold

Economic defendability (Dyson-Hudson & Smith 1978) predicts territorial defence when resources are
dense **and** predictable, and dispersal/mobility with no territorial behaviour when they are sparse
or unpredictable ([Human Territoriality: An Ecological
Reassessment](https://anthrosource.onlinelibrary.wiley.com/doi/abs/10.1525/aa.1978.80.1.02a00020);
[When to defend? Optimal territoriality across the Numic
homeland](https://www.sciencedirect.com/science/article/abs/pii/S1040618217309886);
[Storage defense](https://www.sciencedirect.com/science/article/abs/pii/S1040618218300855)).
**[SUPPORTED]** as a conditional model; **[VARIATION]** in outcome — the same model predicts
*opposite* behaviour in different habitats, which is precisely why it must not be reduced to "more
neighbours ⇒ more defence".

**Repository consequence.** `band.territorialPressure` exists, has **three live readers**
(`pressure.ts:277`, `mobilityIntent.ts:930`, `bandDecision.ts:5531`) and **no writer** other than
spawn constants and fission inheritance (AUDIT-27). Defendability is therefore **[FUTURE]** — a real
territorial authority is a separate checkpoint, explicitly out of scope here (§6). CORRECTION-32
must not begin writing `territorialPressure` and must not let crowding leak into it.

### 1.6 Because a larger aggregation can be *good*

This is the half that a pure "crowding = cost" model gets wrong. Aggregation buys risk pooling,
information, exchange partners, mates and ritual occasion. The !Kung *hxaro* system is the canonical
case: delayed non-equivalent gift exchange that extends a household's claim on support across
hundreds of kilometres and functions as social insurance against local failure
([Hxaro](https://www.researchgate.net/publication/35396474_Hxaro_A_regional_system_of_reciprocity_for_reducing_risk_among_the_Kung_San)).
Foraging networks measurably promote information transmission
([Hunter–gatherer foraging networks promote information
transmission](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8692955/)), and repeated coalescence and
dispersal of core units is itself the structure that creates learning and mating opportunity
([Modelling mechanisms of social network maintenance in
hunter-gatherers](https://pmc.ncbi.nlm.nih.gov/articles/PMC4157219/)). **[SUPPORTED]**

**Repository consequence.** The benefit side exists only in thin form —
`relationshipAggregationToleranceBias`, `encounterTolerance`, `accessKinToleranceReliefBias`,
`kinSafety`. CORRECTION-32 **must not** build a new aggregation-benefit system (that is
item 7 of the roadmap), but it **must not destroy the existing benefit terms either**, and it must
not make crowding so dominant that tolerated aggregation becomes structurally impossible. Fixture
P12 exists to prove that physical crowding and social tolerance can coexist.

---

## 2. When should nearby people encourage departure, and when aggregation?

**[SUPPORTED]** The seasonal aggregation/dispersal cycle is one of the best-attested patterns in the
ethnographic record: where productivity varies seasonally, larger camps are sustainable in the rich
season and bands disperse in the lean one, and bands periodically fuse at locations where resources
are locally plentiful
([Scaling of Hunter-Gatherer Camp Size and Human
Sociality](https://discovery.ucl.ac.uk/10122277/1/SSRN-id3399729.pdf);
[Hunter-Gatherer Movement Patterns: Causes and
Constraints](https://www.researchgate.net/publication/222157123_Hunter-Gatherer_Movement_Patterns_Causes_and_Constraints)).

**[VARIATION]** There is *not one* aggregation/dispersion pattern. Duration, location, cyclicity,
extent, personnel and activities all vary greatly, and the social/ritual component of aggregation is
not reducible to the ecological one.

**[SUPPORTED]** Habitat quality is the best single predictor of move distance among foragers, with
occupation duration mattering additionally for hunting-dependent groups; most terrestrial foragers
move camp several times a year *because local patches deplete*
([The ecological and evolutionary energetics of hunter-gatherer residential
mobility](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5094510/)).

**The operative causal reading for this checkpoint:** departure is driven by **realized local
return falling**, of which other people's presence is one contributing cause among several
(seasonality, own depletion, water, risk). Crowding is therefore correctly a **contributor to a
move motive**, not an independent second motive that stacks on top of the depletion it helps cause.

---

## 3. How should kinship alter the response?

**[SUPPORTED]** Kin proximity reduces the *social* cost of co-residence — kin are the default
sharing and aggregation partners in nearly every documented forager system.
**[SUPPORTED and non-negotiable]** Kin do **not** reduce the *physical* cost: a kin band eats,
drinks and occupies ground exactly like any other band of the same size.

**Repository consequence, invariant §12.7.** Production applies a single kin factor `0.72×` inside
`crowding.ts` at the moment of accumulating a contribution. That is a physical-layer discount for a
social fact, and it is at the edge of defensible. CORRECTION-32 **does not redesign it** (§6 forbids
kin/fission redesign, and AUDIT-27 measured `kinOverlapPairs = 0` naturally, so there is no evidence
to recalibrate against). It is documented, measured on every fixture, and left in place.
**[CALIBRATION, inherited and not revisited]**

---

## 4. How is physical crowding different from the four things it is repeatedly confused with?

This section is the working definition the architecture must satisfy.

| Fact | What it is | Authority in this repository | May it be inferred from bodies? |
| --- | --- | --- | --- |
| **Physical co-presence** | Other people are physically here, now | `NearbyBandPressure.weightedCrowding` (proximity ball, radius 4, population-weighted, kin-discounted) | It *is* the bodies |
| **Local physical capacity** | How much co-presence this ground absorbs | `getCrowdingPenalty` — `dryAmplifier` × `spatialCapacityBuffer` | Legitimately transforms it, **once** |
| **Actual resource pressure** | Return per person is actually falling | `usePressure`, `depletion`, `perCapitaReturn`, `sharedCatchment` | **No.** Measured physically already (§1.1) |
| **Social danger / tolerance** | This group is hostile, or is a partner | encounters, `rangeFriction`, `protoAccessMemory`, `contactMemories` | **No.** Requires evidence (§1.4) |
| **Remembered friction** | We have had trouble here before | `protoAccessMemory` with the CORRECTION-31 lifecycle | **No.** Historical, ages and releases |

Two further distinctions the spec names and the repository currently blurs:

- **Target crowding ≠ residence crowding** (§10.6). A crowded destination should be less attractive.
  A crowded residence should make *leaving* more attractive. These are different signs on different
  objects and must not be produced by the same term.
- **Response ≠ evidence** (§10.5). "This band is now more inclined to explore" is a *consequence* of
  crowding. Re-reading that consequence as though it were new evidence of crowding is the
  double-count this checkpoint exists to remove.

---

## 5. What the simulator cannot yet represent, and therefore must not claim

- **No visibility, route or barrier rule for social perception at all.** Bands separated by water
  still perceive each other. (CORRECTION-29 §P3, CORRECTION-30.) **[FUTURE]**
- **No physical-trace authority.** No tracks, trails, camp remains, trace freshness, cross-band
  smoke or human cue in landscape visibility. **[FUTURE]**
- **No activity-party footprint.** `sharedCatchment` is residence-anchored, so real trips,
  expedition routes and investigation walks compete for nothing. (AUDIT-27, still open.) **[FUTURE]**
- **No territorial authority.** `territorialPressure` has readers and no writer. **[FUTURE]**
- **No seasonal aggregation cycle.** Aggregation/dispersal is the best-attested pattern in §2 and
  the simulator has no mechanism that produces it; crowding here is a per-season scalar with no
  cyclic structure. **[FUTURE]**
- **No conflict, law, property or storage-defence.** **[FUTURE]**

**Nothing in this list may be simulated by making the crowding scalar larger.** A missing mechanism
must read as a missing mechanism, not as an inflated coefficient on the one mechanism that exists.

---

## 6. The causal model CORRECTION-32 implements

Derived from §1–§4, expressed as the smallest set of *distinct* claims:

```text
Other bands are physically here          →  NearbyBandPressure.weightedCrowding   [evidence]
This ground absorbs co-presence poorly   →  × capacity transform                  [one transform]
                                         =  ONE physical crowding cost

Applied to a PLACE the band is judging   →  that place is worse to occupy         [target cost]
Applied to the place it is STANDING ON   →  reason to look elsewhere              [dispersal motive]
                                             counted ONCE, bounded

Return per person is actually falling    →  depletion / catchment / perCapita     [separate fact]
This group has given us trouble          →  friction / access memory (CORR-29/30/31) [separate fact]
This group is kin or a partner           →  tolerance terms                       [separate fact]
```

The three "separate fact" lines already have authorities, already have provenance rules, and are
**not** in scope. The repair is confined to the first block: making *one* physical fact produce *one*
bounded decision influence with an explicit sign that depends on whether the tile being judged is
the residence or a destination.

---

## 7. What research does **not** license

Stated explicitly so a later reader cannot mistake the section above for a mandate:

- No ethnographic observation was converted into a game coefficient. Research constrains the **sign**
  of an effect, whether two effects are **distinct**, and whether a mechanism **exists**. Every
  numeric weight in this repository is **[CALIBRATION]**.
- The literature does **not** say how much a neighbouring band should reduce a tile's attractiveness.
  It says the effect is real, habitat-conditioned, sometimes positive, and never automatically
  hostile.
- The literature is **[CONTESTED]** on default inter-group relations (§1.4) and gives **[VARIATION]**
  rather than a rule on aggregation patterns (§2). Both are reasons to keep the mechanism small and
  explicit, not reasons to add channels.

---

## Sources

- [Human Territoriality: An Ecological Reassessment — Dyson-Hudson & Smith 1978](https://anthrosource.onlinelibrary.wiley.com/doi/abs/10.1525/aa.1978.80.1.02a00020)
- [When to defend? Optimal territoriality across the Numic homeland](https://www.sciencedirect.com/science/article/abs/pii/S1040618217309886)
- [Storage defense: Expansive and intensive territorialism in hunter-gatherer delayed return economies](https://www.sciencedirect.com/science/article/abs/pii/S1040618218300855)
- [The Ideal Distribution Model and Archaeological Settlement Patterning](https://www.tandfonline.com/doi/full/10.1080/14614103.2020.1803015)
- [Ideal free settlement of California's Northern Channel Islands](https://www.researchgate.net/publication/222573526_Ideal_free_settlement_of_California's_Northern_Channel_Islands)
- [Scaling of Hunter-Gatherer Camp Size and Human Sociality](https://discovery.ucl.ac.uk/10122277/1/SSRN-id3399729.pdf)
- [Hunter-Gatherer Movement Patterns: Causes and Constraints](https://www.researchgate.net/publication/222157123_Hunter-Gatherer_Movement_Patterns_Causes_and_Constraints)
- [The ecological and evolutionary energetics of hunter-gatherer residential mobility](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5094510/)
- [Hxaro: A regional system of reciprocity for reducing risk among the !Kung San](https://www.researchgate.net/publication/35396474_Hxaro_A_regional_system_of_reciprocity_for_reducing_risk_among_the_Kung_San)
- [Hunter–gatherer foraging networks promote information transmission](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8692955/)
- [Modelling mechanisms of social network maintenance in hunter-gatherers](https://pmc.ncbi.nlm.nih.gov/articles/PMC4157219/)
