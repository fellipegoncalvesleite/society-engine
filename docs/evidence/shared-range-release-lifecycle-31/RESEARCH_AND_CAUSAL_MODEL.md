# CORRECTION-31 — Research and causal model

**What happens to a band's belief about another group's use of a place, after the evidence
stops arriving?**

Branch `checkpoint/shared-range-release-lifecycle-31`, base
`1c6a3ed8d0a8360c8fe4648a83387a2bd4fa30b4` (CORRECTION-30, CLOSED and FROZEN).

Written before the architecture decision, from the human phenomenon outwards. It does not
begin from the current code and does not try to preserve any current number.

---

## 1. The question, stated as a human problem

CORRECTION-28, -29 and -30 fixed how social knowledge is **acquired**. None of them touched
what happens to it **afterwards**.

A band correctly sees another group at an important water place. The other group leaves.
Physically, everything releases at once: no crowding, no shared catchment, depletion recovers.
Socially, nothing releases at all. The observer's records still name that group, its access
expectations still carry the same weight, and — because the observer keeps using the place and
so keeps raising its importance — the classification can drift *toward* avoidance months after
the other group has gone.

That is not a memory model. It is a memory that never learns anything after the first day.

---

## 2. Mandatory causal brainstorming

### 2.1 Human awareness

**How does a mobile group decide another group is still using a place?**
Mostly it does not decide — it *assumes*, on the strength of the last thing it saw, and
revises when it next goes there. Between visits the belief is a standing bet, not a
measurement.

**How does it distinguish current presence from old use?**
By recency of its own evidence, by the season, by whether the other group is the kind that
returns, and by whether anybody has been past recently. "They were at the delta in spring" is
a different claim from "they are at the delta."

**When does absence become meaningful evidence?**
Only when somebody was in a position to notice presence. Going to the place and finding
nobody is evidence. Not going is not. This asymmetry — *absence of evidence is not evidence of
absence unless you looked* — is the single most important thing in this checkpoint.

**When is absence merely uncertainty because nobody checked?**
Almost always, for places outside the current round. Uncertainty should grow with time, but it
should grow toward *"I don't know"*, not toward *"they've gone"* and not toward *"they're
still there."*

**How does seasonal return complicate "departure"?**
Enormously. A group that leaves the summer fishing place in autumn has not abandoned it.
Mauss's Eskimo material is the classic statement: the same population disperses and
re-aggregates on an annual rhythm, and the winter absence from a summer site carries no
information about next summer. A band that treats seasonal absence as abandonment will be
wrong every year. A band that treats it as continuing presence will be wrong for two thirds of
the year.

**Why might people remain cautious after others leave?**
Because the cost of being wrong is asymmetric; because they expect a return; because the place
matters enough to be worth caution; because the last encounter was unpleasant; because a
warning circulates independently of the fact.

**Why might they rapidly resume use?**
Because they need the food; because the relationship was good; because they have their own
long claim on the place; because someone went and saw it was free.

**How do kinship and peaceful history change release?**
They change what release *means*. Between kin or long-tolerant neighbours, "they were here" is
not a threat at all — it may be an opportunity. Peterson's Australian material describes
access as socially negotiated and normally granted; the appropriate residue of repeated
peaceful sharing is familiarity, not suspicion. Release for those cases should leave
*recognition and tolerance*, not a decayed hostility.

**How does a refusal or a threatening encounter change release?**
It persists longer and is remembered as being about the *people*, not only the place. But it
still stops governing daily movement eventually — otherwise nobody could ever share ground
again.

**How can a report stay socially relevant after its physical claim is stale?**
Because it is a fact about what people say, not about what is there. "The delta is crowded" can
circulate for years after the crowd left, and it keeps shaping where people go.

**How can retelling falsely preserve an outdated belief?**
By making one event look like many. Three people repeating one story is one piece of evidence
with three voices; the human tendency is to treat it as three. The continued-influence
literature (Lewandowsky et al.) shows corrected misinformation keeps influencing judgment, and
that repetition strengthens the residue. A simulator that lets one episode's echoes refresh
each other has built an immortal belief.

### 2.2 Interaction with other systems

- **Social release vs physical recovery.** Different clocks entirely. Depletion recovers on the
  ecology's schedule and is not knowledge. A place can be socially "clear" and still poor.
- **Access memory vs place attachment.** Attachment is about the observer's own relationship to
  the ground. It must survive the social episode completely.
- **Access memory vs contact memory.** Contact memory says *who*; access memory says *what I
  expect at this place*. Releasing the second must not touch the first.
- **Reports.** They should be able to sustain a *reported* belief and nothing more.
- **Movement and support seeking.** This is where release actually matters: a band that keeps
  hesitating at its best water place because of a group that left three years ago is
  mismodelled.
- **Later systems.** Trails, camps, culture and territorial norms all attach here — a place
  with a long history of tolerated sharing is the seed of a customary arrangement. Nothing of
  that is built now; the architecture only has to avoid making it impossible.

**What the present simulator lacks:** any per-day positional history, any trace, any smoke or
long-range sighting, any way to observe another band's departure as an event, and any notion of
"I went and looked."

### 2.3 Reversibility

- **Can a released place become sensitive again?** Yes — on fresh evidence, and faster if the
  band is remembered.
- **Can an old rival become tolerated?** Yes; repeated uneventful sharing is how.
- **Can tolerated access become tense?** Yes, on new evidence.
- **Can a group remember a dispute without avoiding the place?** Yes, and this is the normal
  case. Grievance and avoidance are separable.

---

## 3. Literature consulted

Prior-checkpoint sources (Binford 1980; Dyson-Hudson & Smith 1978; Kelly 2013; Migliano et al.
2017/2020; Pastoors et al. 2015; Rockman & Steele 2003) are carried forward from
`docs/evidence/shared-range-friction-provenance-30/RESEARCH_AND_CAUSAL_MODEL.md` and not
repeated. New for this checkpoint:

### 3.1 Access as social convention, not exclusion

- **Peterson, N. (1975).** "Hunter-Gatherer Territoriality: The Perspective from Australia."
  *American Anthropologist* 77(1): 53–68. DOI: 10.1525/aa.1975.77.1.02a00040.
  *Used for:* the argument that hunter-gatherer spacing is largely **conventional** — managed
  through greeting, asking and social recognition rather than exclusion — and that the normal
  outcome of a request is access. **Contested:** the population-regulation function Peterson
  proposes is much debated; the checkpoint uses only the conventional-spacing observation.
  *Consequence:* the default residue of an observed shared-use episode should be **recognition
  and mild caution**, not standing avoidance. Avoidance should require something more.

- **Peterson, N. (2011).** "Is the Aboriginal landscape sentient? Animism, the life force and a
  place for non-humans." Australian material on classical land tenure.
  *Used only as context* for the point that attachment to place and social claims over people
  are different registers.

### 3.2 Why monitoring is not free

- **Dyson-Hudson, R. and Smith, E. A. (1978).** *American Anthropologist* 80(1): 21–41.
  DOI: 10.1525/aa.1978.80.1.02a00020.
  *Used here for the second half of the argument*, not the first: territoriality appears where
  monitoring **repays its cost**. Where resources are sparse and unpredictable, groups do not
  monitor — so they simply do not know who is where, and their beliefs go stale.
  *Consequence:* staleness is the default, and confident current knowledge is the thing that
  needs justifying.

### 3.3 Seasonal absence is not abandonment

- **Mauss, M., with Beuchat, H. (1979 [1904–05]).** *Seasonal Variations of the Eskimo: A Study
  in Social Morphology.* Trans. J. J. Fox. London: Routledge & Kegan Paul. ISBN 9780415866583.
  *Used for:* the demonstration that social life has "regular, successive phases of increased
  and decreased intensity" — aggregation and dispersal on an annual cycle.
  *Consequence:* a departure must not be modelled as an ending. Cooling should be gradual and
  reactivation cheap.
  **Simulator abstraction:** this repository has no seasonal-round model for *other* bands, so
  the model expresses the insight only as "cool slowly, reactivate on any fresh evidence."

### 3.4 Social networks keep beliefs alive

- **Whallon, R. (2006).** "Social networks and information: Non-'utilitarian' mobility among
  hunter-gatherers." *Journal of Anthropological Archaeology* 25(2): 259–270.
  DOI: 10.1016/j.jaa.2006.03.004.
  *Used for:* movement undertaken for social and informational reasons — visiting maintains a
  safety net and circulates news. **Consequence:** the report channel is real and should not be
  suppressed; what must be fixed is that a report is *one voice*, however often it is repeated.

### 3.5 Repetition is not confirmation

- **Lewandowsky, S., Ecker, U. K. H., Seifert, C. M., Schwarz, N., Cook, J. (2012).**
  "Misinformation and Its Correction: Continued Influence and Successful Debiasing."
  *Psychological Science in the Public Interest* 13(3): 106–131.
  DOI: 10.1177/1529100612451018.
- **Ecker, U. K. H., Lewandowsky, S., Cook, J., et al. (2022).** "The psychological drivers of
  misinformation belief and its resistance to correction." *Nature Reviews Psychology* 1: 13–29.
  DOI: 10.1038/s44159-021-00006-y.
  *Used for:* corrected claims keep influencing judgment, and repeated exposure strengthens the
  residue. **Contested/limited:** this is laboratory work on individuals in literate societies,
  not ethnography of forager information flow; it is used only to justify (a) that a belief
  should outlive its evidence *somewhat*, and (b) that repetition of one story must not count
  as independent confirmation.

### 3.6 When shared places become defended

- **Testart, A. (1982).** "The Significance of Food Storage Among Hunter-Gatherers: Residence
  Patterns, Population Densities, and Social Inequalities." *Current Anthropology* 23(5):
  523–537. DOI: 10.1086/202894.
  *Used for:* the finding that intensive storage covaries with sedentism, density and stronger
  claims over place. **Explicitly used as a boundary marker, not a mechanism:** this repository
  has no storage-driven tenure and this checkpoint builds none. It is recorded because it names
  the condition under which the lifecycle designed here would eventually need to change.

---

## 4. Classification of every claim used

| Claim | Status |
| --- | --- |
| Beliefs about others' use go stale when nobody looks | **well-supported mechanism** (Dyson-Hudson & Smith; general) |
| Absence is evidence only if the observer was positioned to notice | **well-supported mechanism** |
| Seasonal absence ≠ abandonment | **well-supported mechanism** (Mauss) |
| Access is normally socially negotiated and granted | **ethnographic variation** (Peterson: Australia; Kelly: not universal) |
| Repeated peaceful sharing yields familiarity, not suspicion | **ethnographic variation** |
| Tense episodes persist longer than neutral ones | **contested interpretation** — plausible and widely assumed, not cleanly measured |
| A story repeated by three people is still one piece of evidence | **well-supported mechanism** (Lewandowsky/Ecker; also basic provenance logic) |
| Beliefs outlive their corrections | **well-supported mechanism**, from a different literature (cognitive psychology, not ethnography) |
| Storage makes places defended | **future-system dependency** — recorded, not implemented |
| The exact number of seasons for each phase | **simulator abstraction** — no literature fixes it; chosen for legibility and tested |
| Proximity = detection | **deliberate simplification**, inherited from CORRECTION-30 |
| No trace, smoke or sighting channel | **future-system dependency** (Persistent Human Landscape) |

**No part of this research is used to justify territory, property, law, ownership or conflict,
and none is implemented here.**

---

## 5. The lifecycle adopted, in human terms

```text
CREATION      a legitimate channel produces evidence
              (proximity observation, encounter, or a received report)

ACTIVATION    the observer holds a current expectation about the place

REINFORCEMENT fresh evidence about the SAME group at the SAME place renews it;
              repeated retelling of ONE episode does not

SATURATION    renewal is bounded — long recurring use reads as "they keep coming",
              never as unbounded alarm

EVIDENCE LOSS when nothing new arrives, the expectation is no longer renewed;
              its age begins to matter

COOLING       influence declines continuously with the age of the freshest evidence,
              at a rate that depends on how the evidence arrived and how the
              episode felt

CONTRADICTION being present at the place and seeing nobody counts as evidence,
              and cools it faster — but proves nothing about where they went

RELEASE       below a threshold the episode stops moving behaviour at all

HISTORY       the band still knows the group, still knows the place, still knows
              this happened; it simply no longer acts on it

REACTIVATION  fresh evidence restores a current expectation; prior contact makes
              recognition immediate, but never announces the return in advance
```

**What is deliberately NOT introduced:** no new enum of lifecycle states stored on the band.
§3 of the checkpoint warns against adopting the listed names automatically, and the phases
above are all derivable from evidence age, provenance and the observer's own presence. The
architecture decision explains why a derived phase beats a stored one here.
