# CORRECTION-33 — RESEARCH AND CAUSAL MODEL

How a real human band could come to be cautious about strangers at a water place, what sustains
that belief, what weakens it — and why none of it can come from counting the world's bands.

---

## 1. The causal brainstorming, answered before any code was read

### How could a human band learn that many unfamiliar groups exist?

Through **experience that travels with people**: meeting them, visiting them, being told about
them, marrying into them, walking through their country, or gathering with them at seasonal
aggregation sites. Every route runs through a person the band has actually met or a place the band
has actually been. There is no channel by which a band learns the *size of the world*.

### What direct experiences could create generalized stranger caution?

Repeated encounters with unfamiliar people, especially ones that went badly; being refused access;
arriving at a place and finding it already occupied; hearing consistent warnings from people whose
reports have proved reliable; and — where such things exist — finding recent traces of use by
someone unknown.

### Could reports or stories create it?

Yes, and this is one of the better-supported channels: mobile societies move information along
kinship and visiting networks, and reputational knowledge about groups can arrive long before the
groups do. But a report has a **source, an age and a number of hops**, and its weight should fall
with all three.

### Could repeated unidentified traces create it?

In principle yes. **In this repository, no**: CORRECTION-30 established by inspection that
production has no trace authority of any kind — no tracks, no trails as world features, no camp
remains (`TemporaryTaskPartyRecord` asserts `noCamp: true`), no trace freshness, no cross-band
smoke, and no band or person cue in `landscapeVisibility.ts`. Inventing one to justify a
coefficient would be fabrication.

### Does having no known contacts indicate danger, or isolation?

**Isolation.** This is the exact inversion the old code made. A band with no contacts is a band
that has met nobody — which is evidence of an *empty* neighbourhood at least as much as a
dangerous one. Treating "I know no one" as "therefore many unknown others are near" is not a human
inference; it is the simulator's population leaking through a gap in the band's knowledge.

### Why might unfamiliar people be treated cautiously — or not?

Both are attested and the ethnographic record varies substantially. Caution and avoidance of
border zones are documented, and non-kin can be treated as outsiders. But so are intermarriage,
alliance, communal feasting, ritual exchange and long-distance transfer of songs, objects and
emblems across whole continents. Unfamiliarity is also **opportunity**: network studies of living
foragers find that links between *unrelated* individuals are what make information networks
efficient, and that constant inter-camp visiting is how innovation spreads. A model that makes
unfamiliarity automatically mean danger encodes one tail of the distribution as a law.

### How does water scarcity alter the importance of social access?

It raises the stakes rather than creating hostility. The economic-defendability tradition predicts
territorial or exclusionary behaviour where a resource is **dense, predictable and cheap to
defend**, and predicts sharing or tolerated access where it is not. A scarce but concentrated
water source is exactly the case where access is likely to be *negotiated* — which is a property of
that place and its users, not of how many groups exist somewhere.

### How is general uncertainty different from evidence about a specific place?

General uncertainty is "I have not verified this place." It is flat, low, and applies everywhere
equally. Place evidence is "**this** water was being used by people I do not know" — it is
indexed to a place, has a source, and should fade.

### How is knowing many groups exist different from knowing who uses this place?

Completely. The first is regional demography; the second is local access. A band can know of a
dozen groups and still have no reason to expect any of them at this spring.

### How can caution weaken?

Through contact, tolerated shared use, reliable reports of absence, and simply standing at the
place repeatedly and finding nobody there. CORRECTION-31 already implements the last of these.

---

## 2. Classification of every mechanism considered

| Mechanism | Status |
| --- | --- |
| Repeated direct encounters with unfamiliar groups create caution | **Well-supported mechanism** |
| Reports along kinship/visiting networks carry group reputation | **Well-supported mechanism** |
| Peaceful repeated interaction lowers expected risk | **Well-supported mechanism** |
| Scarce, defendable, predictable resources invite access negotiation | **Well-supported mechanism** (economic defendability) |
| Unfamiliar people mean danger | **Ethnographic variation** — attested alongside hospitality, intermarriage and exchange; not a law |
| Absence of contact implies a dense social surround | **Contested to the point of inversion** — it is at least as good evidence of isolation |
| "More than eight groups exist" as a behavioural input | **Not a human belief at all** — hidden simulator population |
| Regional social awareness (named groups, travel, exchange, inherited information) | **Future-system dependency** — requires authorities this repository does not have |
| Unidentified physical traces (tracks, camps, smoke) | **Future-system dependency** — CORRECTION-30 proved no trace authority exists |
| Base caution about an unverified place | **Simulator abstraction** — the existing `0.28` |
| The magnitude `0.26` on remembered access caution, and `0.08` per known contact | **Calibration choice** — inspected, unchanged, not defended here |

---

## 3. The causal model this checkpoint implements

```text
a place the band has not verified
  → a small, flat baseline caution                         [base 0.28, unchanged]

the band's OWN evidence about THIS place
  (proximity → range friction → protoAccessMemory)
  → strangerCaution / rememberedRefusalAvoidance
  → additional caution at that place                       [x0.26, unchanged]
  → cools with age and RELEASES                            [CORRECTION-31 lifecycle]

groups the band has actually met
  → known-contact relief                                   [x0.08 per contact, unchanged]

the number of band records the simulator holds
  → NOTHING                                                [CORRECTION-33]
```

What arises the belief: the band's own experience at a place. What sustains it: active evidence
still inside its lifecycle window. What weakens it: age, contradiction (standing there and finding
nobody), and contact. What it requires: evidence with provenance. Why it cannot reveal hidden
groups: every input is a record the band itself holds.

---

## 4. What this checkpoint deliberately does NOT model

Territory, property, generalized xenophobia, cultural stranger attitudes, hospitality norms,
warfare, conflict escalation, tracks, camp remains, smoke, language, trade, diplomacy and regional
political awareness are all **out of scope** and none was implemented. Regional social awareness is
a real human mechanism and a legitimate future system; it needs named groups, travel, exchange and
inherited information, and building a proxy for it out of an array length would be worse than
having nothing.

---

## 5. Bibliography

Standard references, cited from the established literature and used **only** to constrain the
causal model — no coefficient in this repository was chosen or changed from them.

- Dyson-Hudson, R. & Smith, E. A. (1978). *Human Territoriality: An Ecological Reassessment.*
  American Anthropologist 80(1). — economic defendability; territoriality follows resource density
  and predictability, not group counts.
- Wobst, H. M. (1974). *Boundary Conditions for Paleolithic Social Systems.* American Antiquity
  39(2). — mating/information networks set the scale at which distant groups matter.
- Wiessner, P. (1982). *Risk, reciprocity and social influences on !Kung San economics.* — exchange
  partnerships as the channel through which distant relationships are maintained.
- Hill, K. R., Walker, R. S., et al. (2011). *Co-residence patterns in hunter-gatherer societies
  show unique human social structure.* Science 331. — bands are composed largely of unrelated
  individuals; "stranger" is not the default relation.
- Migliano, A. B., et al. (2020). *Hunter-gatherer multilevel sociality accelerates cumulative
  cultural evolution.* Science Advances. — inter-camp visiting and links between unrelated people
  are what make forager information networks efficient.
- Apicella, C. L., Marlowe, F. W., Fowler, J. H. & Christakis, N. A. (2012). *Social networks and
  cooperation in hunter-gatherers.* Nature 481. — network structure among the Hadza.
- Fry, D. P. & Söderberg, P. (2013). *Lethal aggression in mobile forager bands.* Science 341. —
  intergroup lethal violence is far rarer in nomadic forager bands than the "war" framing implies.
- Cashdan, E. (1983). *Territoriality among Human Foragers.* Current Anthropology 24(1). —
  perimeter defence versus social boundary defence; access is negotiated, not automatic.
- Kelly, R. L. (2013). *The Lifeways of Hunter-Gatherers: The Foraging Spectrum* (2nd ed.). —
  the standard synthesis on mobility, territoriality and ethnographic variation.

**Provenance note:** these are long-established works cited from the established literature. Two
web searches were run in this pass to check that the framing above matches current summaries of
intergroup encounter variation and forager network structure; the individual citations were not
re-verified page-by-page online. They are used as methodological constraints, never as calibration.
