# CORRECTION-30 — Research and causal model

**How does one human group come to know that another group used a place?**

Branch `checkpoint/shared-range-friction-provenance-30`, base
`a15d0a78a3a7ef57b87b22226190d6729ba9b9d7` (CORRECTION-29, CLOSED and FROZEN).

This document is written BEFORE the implementation choice, from the human phenomenon
outwards. It deliberately does not start from `rangeFriction.ts`'s current structure and
makes no attempt to preserve its event frequency.

---

## 1. The question, stated as a human problem

A band walks its country. Somewhere in that country, another band is living, or has walked,
or has fished, or has taken firewood. The **ecological** consequence of that is real whether
or not anybody notices: the plants are picked, the game is disturbed, the fish are fewer.

The **social** consequence is a completely different thing. It requires that somebody *knew*.
A band cannot be wary of neighbours it has never detected. It cannot avoid a water place
"because outsiders use it" unless somebody saw them, found their leavings, or was told.

The defect this checkpoint repairs is the collapse of those two into one. Below is the causal
model, then the literature, then what the repository can and cannot honestly represent.

---

## 2. Mandatory causal brainstorming (answered before any code was read for design)

### 2.1 How would one human group know that another group used a place?

Six routes, in descending evidential strength:

1. **Co-presence.** The two groups are physically in the same place at the same time. This is
   the only route that gives certainty about *who*, *where*, and *now* simultaneously.
2. **Visual observation at a distance.** Seeing a camp, a fire, smoke, a line of people, dogs,
   drying racks. Gives *where* and *now*; gives *who* only if the observer already knows them
   by sight, and gives *what they are doing* only coarsely.
3. **Physical traces.** Footprints, a hearth, cut stumps, a stripped patch, discarded bone,
   a windbreak, a path worn into grass. Gives *where* with certainty, *when* only through
   freshness, *who* only through style/track recognition, and *what* through inference.
4. **Hearsay / report.** Somebody tells you. Gives *what somebody claims*, at one or more
   removes, with the reporter's interest and error attached.
5. **Inference from absence or change.** The reeds are cut; the fish are not running where
   they ran; the game is skittish. Gives *that something happened*, and almost never *who*.
6. **Nothing.** The most common case. Two groups use overlapping country and never learn it.

### 2.2 What can be learned through direct co-presence?

Identity (if previously known), rough numbers, apparent activity, disposition, and — through
talk, if they talk — intentions and plans. Co-presence is also the moment at which *permission*
becomes a live question: in most documented forager systems, access is negotiated face to face
or through kin ties, not asserted at a boundary.

### 2.3 What can be learned through visual observation?

Presence and rough location; smoke, fire and camp structures are visible far beyond speaking
distance. Activity type is legible only in broad terms (people at the water, people on the
ridge). Identity usually is not legible at distance unless the observer already knows the group.
Visibility is strongly terrain-dependent: ridges, water margins and open plains carry far;
forest, gullies and marsh channels do not.

### 2.4 What can be learned from physical traces?

A great deal, but not automatically and not by everyone. Expert trackers can read number,
direction, gait, age class and sex from human spoor, and can do so for individuals they have
never met (Pastoors, Lenssen-Erz et al. — see §4). But this is a **skill applied to a
persistent physical thing.** It requires: (a) that the trace exists, (b) that it survives long
enough, (c) that somebody physically goes where it is, (d) that they look, and (e) that they
can interpret it. Freshness is the axis that converts "somebody used this" into "somebody is
using this **now**" — and freshness decays, differently on sand, snow, mud, grass and rock.

### 2.5 What can be learned through hearsay or reports?

That somebody claims something. Reports are the dominant channel for country beyond a group's
own walking range, and inter-camp visiting is frequent and structurally important (Migliano
et al.; Dyble et al. — §4). But a report is second-hand by construction: it carries the
reporter's freshness, the reporter's interest, and accumulated distortion across hops. It is
categorically not observation, and treating it as observation is a specific, nameable error.

### 2.6 What remains unknowable without investigation?

- Whether anyone is at a distant place *right now*.
- Which specific group is there, if you have not seen them.
- What they intend to do next.
- Where their parties went yesterday.
- Whether a place you remember well is currently occupied.

Familiarity with a place is knowledge of the **place**, not surveillance of it.

### 2.7 How does previous familiarity affect interpretation without creating knowledge of
contemporary activity?

This is the crux. Familiarity does three legitimate things:

- **It sets the baseline.** You know what this place normally looks like, so a change is
  legible to you that would not be legible to a stranger. Cut reeds mean something only if
  you knew the reeds.
- **It sets the stakes.** Use of your camp core matters to you in a way that use of the far
  edge does not. Familiarity changes the *interpretation and tension* of a noticed event.
- **It sets the visiting rate.** You go there often, so you are more likely to be present
  when something is visible.

What familiarity does **not** do is deliver the observation. Remembering a place does not
place you at it. This is the exact error being repaired.

### 2.8 How can real ecological competition occur without either group knowing who caused it?

Easily, and it is probably the normal case. Two bands drawing on the same fish run, the same
tuber ground, the same herd, from residences ten days apart, will each experience declining
returns and neither will meet the other. The correct model outcome is: **physical support
falls, depletion rises, and no social record is created at all.** A band in that situation
frames the problem ecologically ("this ground is tired"), not socially ("outsiders").

The repository already contains exactly this distinction and gets it right in one place —
`reportedKnowledge.ts` reframes range pressure as `poor_return_region` rather than
`crowded_range_warning` when the band has no grounded evidence of other bands. That is the
correct pattern, and this checkpoint's job is to stop `rangeFriction.ts` from manufacturing
the "grounded evidence" that flips it.

### 2.9 How do uncertainty, trace freshness, distance and prior contact affect interpretation?

- **Uncertainty must survive.** "Somebody was here" is a different record from "the Reed
  people are camped here." Collapsing them is the same class of error as collapsing report
  into observation.
- **Freshness** governs whether a trace is contemporary evidence or history.
- **Distance** governs whether observation is possible at all, and degrades confidence within
  the possible range.
- **Prior contact** governs *identification*, not *detection*. Having met a group before lets
  you name them when you see them; it does not tell you where they are.

---

## 3. Consequences for the simulator, stated as rules

From §2, five rules follow that do not depend on any particular implementation:

- **R1.** A place being familiar to the observer is not evidence about anybody else.
- **R2.** Reading another band's private state (its position, its trips, its plans) is only
  admissible where a physical or social channel in the model delivers that information.
- **R3.** Physical ecological competition must be able to occur with zero social records.
- **R4.** Reports stay reports; encounters stay encounters; observation stays observation.
- **R5.** Prior contact identifies, it does not locate.

---

## 4. Literature consulted

### 4.1 Mobility, camps and the archaeology of activity traces

- **Binford, L. R. (1980).** "Willow Smoke and Dogs' Tails: Hunter-Gatherer Settlement Systems
  and Archaeological Site Formation." *American Antiquity* 45(1): 4–20.
  DOI: 10.2307/279653.
  *Used for:* the residential/logistical distinction, and — critically here — the fact that
  different activities leave **structurally different traces**. Residential bases, field camps,
  stations and caches are not equally visible. A logistical task party leaves far less than a
  residential base. **Society variation:** Binford himself insists forager and collector are
  strategy mixes, not types, and that the mix shifts seasonally within one group.
  *Consequence for this checkpoint:* "another band walked here on a trip" and "another band
  lives here" are not equally detectable. Modelling them with one rule is wrong in the
  direction that matters — trips should be **harder** to detect, not equally easy.

- **Rockman, M. and Steele, J., eds. (2003).** *Colonization of Unfamiliar Landscapes: The
  Archaeology of Adaptation.* Routledge. ISBN 9780415256070.
  *Used for:* landscape learning as a **process with a cost** — knowledge of country is
  acquired by going there, over time, and is not a free function of proximity or of interest.

### 4.2 Reading human traces

- **Pastoors, A., Lenssen-Erz, T., Ciqae, T., Kxunta, U., Thao, T., Bégouën, R., Biesele, M.,
  Clottes, J. (2015).** "Tracking in Caves: Experience Based Reading of Pleistocene Human
  Footprints in French Caves." *Cambridge Archaeological Journal* 25(3): 551–564.
  DOI: 10.1017/S0959774315000050.
- **Lenssen-Erz, T., Pastoors, A., et al. (2023).** "Animal tracks and human footprints in
  prehistoric hunter-gatherer rock art of the Doro! nawas mountains (Namibia), analysed by
  present-day indigenous tracking experts." *PLOS ONE* 18(8): e0289560.
  DOI: 10.1371/journal.pone.0289560.
  *Used for:* trace reading is **real, rich and expert** — Ju/'hoansi trackers read age, sex,
  number and gait from spoor, including of people they have never met. **Contested/variable:**
  this is a trained skill with wide individual and cultural variation, not a species-universal
  automatic sense; and it operates on a *physical, persisting* thing.
  *Consequence:* trace-based knowledge is legitimate **if and only if the model has a physical
  trace to read.** This repository has none (§5). Fabricating trace inference without the trace
  would be inventing evidence, which §9.9 of the checkpoint forbids.

### 4.3 Territoriality, shared range and access

- **Dyson-Hudson, R. and Smith, E. A. (1978).** "Human Territoriality: An Ecological
  Reassessment." *American Anthropologist* 80(1): 21–41.
  DOI: 10.1525/aa.1978.80.1.02a00020.
  *Used for:* the economic defendability model — exclusive use and defence appear where
  resources are dense and predictable enough to repay the cost of monitoring them.
  **Directly relevant here:** *monitoring is a cost.* Knowing who is on your ground is work.
  Where resources are sparse and unpredictable, groups do not monitor, do not exclude, and
  routinely do not know. **Contested:** the model's explanatory reach is debated, and it
  predicts variation rather than a universal.

- **Kelly, R. L. (2013).** *The Lifeways of Hunter-Gatherers: The Foraging Spectrum*, 2nd ed.
  Cambridge University Press. ISBN 9781107607613.
  *Used for:* the range of documented land-tenure arrangements — some foragers are territorial,
  many are not, and access is very often negotiated through kin ties, friendship and asking,
  rather than through boundary defence. **Explicitly used as an anti-universal:** there is no
  single forager territorial script to encode.

### 4.4 Information transmission between groups

- **Migliano, A. B., Page, A. E., Gómez-Gardeñes, J., et al. (2017).** "Characterization of
  hunter-gatherer networks and implications for cumulative culture." *Nature Human Behaviour*
  1: 0043. DOI: 10.1038/s41562-016-0043.
- **Migliano, A. B., Battiston, F., Viguier, S., et al. (2020).** "Hunter-gatherer multilevel
  sociality accelerates cumulative cultural evolution." *Science Advances* 6(9): eaax5913.
  DOI: 10.1126/sciadv.aax5913.
- **Dyble, M., Thompson, J., Smith, D., et al. (2016).** "Networks of Food Sharing Reveal the
  Functional Significance of Multilevel Sociality." *Current Biology* 26(15): 2017–2021.
  DOI: 10.1016/j.cub.2016.05.064.
  *Used for:* inter-camp visiting is frequent (Agta and BaYaka data show near-daily movement
  between camps) and is a primary channel for information about country and people.
  *Consequence:* the **report** channel is well supported and should stay. But everything it
  carries arrives as somebody's account, at one or more removes — exactly the
  `reported_secondhand` classification the repository already has.

### 4.5 Perception, signalling and detection

- **Binford (1980)**, again, for the title's point: *willow smoke* is what you see of a camp
  from far off. Smoke and fire are the classic long-range human detection cue.
  *Consequence:* smoke would be the single most defensible long-range detection channel to
  build. This repository's `fireSignals.ts` implements **deliberate same-band signalling only**
  (a band's own party signalling its own camp) — there is no cross-band smoke detection. That
  is recorded as an absence, not filled in here.

---

## 5. What this repository can and cannot represent

Inspected directly (see `authority-ledger.md` for the full trace).

### 5.1 Present and usable

| Human channel | Repository authority | Status |
| --- | --- | --- |
| Co-presence / short-range visual | `TickContextCache.nearbyBandsByBandId` — active bands within `DEFAULT_NEARBY_RADIUS = 4` of the observer's **current** tile, Chebyshev, from real positions | **Canonical, physical, already used by crowding (CORRECTION-28) and encounter candidacy (CORRECTION-29)** |
| Meeting | `Band.encounterRecords` / `BandEncounterRecord`, written only by `applyEncounterToBand` at distance ≤ 3 after CORRECTION-29 | Canonical |
| Prior contact (identification) | `Band.contactMemories` / `KnownBandContactMemory` | Canonical — and **carries no position**, so it cannot locate anybody |
| Hearsay | `Band.reportedKnowledge.reports` / `WordOfMouthReport` with `sourceBandId`, `trustBasis`, `hops`, `distortionLevel`, `freshness` | Canonical, and already classified `reported_secondhand` in friction |

### 5.2 Absent — and therefore not usable

| Human channel | Repository status |
| --- | --- |
| Footprints, spoor, tracks | **No authority exists.** No trace state, no freshness, no reader. |
| Trails worn by repeated passage | `Band.travelCorridors` is the band's own memory of its own routes; it is not a physical mark on the world and no other band can read it. |
| Abandoned camp remains | **No authority exists.** `TemporaryTaskPartyRecord` (CORRECTION-26) explicitly asserts `noCamp: true`; `ExpeditionTaskCamp` is party-local. |
| Cross-band smoke detection | `fireSignals.ts` is same-band deliberate signalling only (`resolveSmokeSignal` takes one band and its own party). |
| Long-range visual detection of people | `landscapeVisibility.ts` classifies **terrain** cues only (water, valleys, passes). It has no band/person cue kind at all. |
| Line-of-sight for social perception | `isSmokeLineOccluded` exists for smoke; nothing applies it to bands. CORRECTION-29 already recorded that encounters have no visibility, route or barrier rule. |

**Therefore:** the trace, smoke and long-range-sighting channels the literature supports
**cannot be used in this checkpoint without inventing them.** They belong to the future
Persistent Human Landscape pass. Building a trace system here to preserve event frequency
would be exactly the failure mode §8/Option D warns against.

---

## 6. The causal model adopted

```text
PHYSICAL LAYER (unchanged by this checkpoint)
  another band harvests / depletes / occupies / disturbs
    -> tile depletion, fauna stocks, plant patches, shared catchment
    -> the observer's realized support falls
    -> the observer frames it ECOLOGICALLY (poor_return_region)
  ...whether or not anybody is detected.

SOCIAL LAYER (repaired by this checkpoint)
  detection channel fires
    |- current physical proximity (canonical, present)      -> observed
    |- meeting                    (canonical, present)      -> observed
    |- report                     (canonical, present)      -> reported_secondhand
    |- physical trace             (ABSENT — deferred)       -> (nothing)
    |- long-range sighting/smoke  (ABSENT — deferred)       -> (nothing)
    -> AND the place is inside the observer's familiar country
    -> range-friction record, carrying its own provenance
    -> access memory / social tension / onward report
```

Familiar country stays in the chain — but as the **interpretive** term (§2.7), gating what a
noticed presence *means* and how much tension it carries. It is no longer allowed to act as
the *detector*.

---

## 7. Simplifications made, stated plainly

1. **Proximity is treated as detection.** Two bands within 4 tiles are treated as mutually
   detectable. Real detection depends on terrain, vegetation, weather, time of day, fire and
   whether anyone was looking. The repository has no such rule for bands, and inventing one
   would be fabricating visibility. Radius 4 is not a new constant — it is the canonical
   `DEFAULT_NEARBY_RADIUS` already used for crowding and encounter candidacy, reused rather
   than reinvented.
2. **Detection is symmetric.** In reality one group can be seen while not seeing.
3. **Identity is free once detected.** Real recognition of a group at distance depends on
   prior acquaintance and on how much of them you can see. The model has no partial-identity
   state, and `RangeFrictionEvent` requires a concrete `otherBandId`.
4. **Activity is inferred coarsely or not at all.** With the private-trip read removed,
   activity is reported as residential presence rather than as a specific task. This is
   deliberately less specific than before, and honestly so — a distant band's fishing party
   is not something the observer had any way to see.
5. **No decay model for evidence quality.** Friction ages out on the existing 48-tick clock,
   which §14 of the checkpoint forbids changing here.

---

## 8. Variation between societies — what is *not* claimed

The literature does not support, and this model does not encode:

- that all groups monitor their range (Dyson-Hudson & Smith: monitoring is conditional on
  resource density and predictability);
- that all groups exclude outsiders (Kelly: territoriality is one option among several);
- that all groups can track (Lenssen-Erz et al.: tracking is a trained, variable skill);
- that noticing outsiders produces hostility (the repository's own tension ceiling is
  `moderate_placeholder`, and kin relations produce `none`; that is retained).

---

## 9. What the repository still cannot represent (recorded, not fixed)

- Any physical human trace, and therefore any trace-based inference.
- Any cross-band visual or smoke detection.
- Asymmetric detection, partial identification, or "somebody, unknown" as a friction subject.
- Negotiated access, permission asking, or refusal as a social act (the repository has
  `rememberedRefusalAvoidance` as a **derived** quantity, with no act of refusal behind it).
- Any consequence of a group knowing it was seen.

---

## Bibliography

1. Binford, L. R. 1980. "Willow Smoke and Dogs' Tails: Hunter-Gatherer Settlement Systems and
   Archaeological Site Formation." *American Antiquity* 45(1): 4–20. DOI: 10.2307/279653.
2. Dyble, M., Thompson, J., Smith, D., Salali, G. D., Chaudhary, N., Page, A. E., Vinicius, L.,
   Mace, R., Migliano, A. B. 2016. "Networks of Food Sharing Reveal the Functional Significance
   of Multilevel Sociality." *Current Biology* 26(15): 2017–2021.
   DOI: 10.1016/j.cub.2016.05.064.
3. Dyson-Hudson, R., Smith, E. A. 1978. "Human Territoriality: An Ecological Reassessment."
   *American Anthropologist* 80(1): 21–41. DOI: 10.1525/aa.1978.80.1.02a00020.
4. Kelly, R. L. 2013. *The Lifeways of Hunter-Gatherers: The Foraging Spectrum*, 2nd edition.
   Cambridge: Cambridge University Press. ISBN 9781107607613.
5. Lenssen-Erz, T., Pastoors, A., Ciqae, T., Kxunta, U., Thao, T., Bégouën, R., Uthmeier, T.,
   Clottes, J. 2023. "Animal tracks and human footprints in prehistoric hunter-gatherer rock art
   of the Doro! nawas mountains (Namibia), analysed by present-day indigenous tracking experts."
   *PLOS ONE* 18(8): e0289560. DOI: 10.1371/journal.pone.0289560.
6. Migliano, A. B., Battiston, F., Viguier, S., Page, A. E., Dyble, M., Schlaepfer, R., Smith,
   D., Astete, L., Ngales, M., Gomez-Gardenes, J., Latora, V., Vinicius, L. 2020.
   "Hunter-gatherer multilevel sociality accelerates cumulative cultural evolution."
   *Science Advances* 6(9): eaax5913. DOI: 10.1126/sciadv.aax5913.
7. Migliano, A. B., Page, A. E., Gómez-Gardeñes, J., Salali, G. D., Viguier, S., Dyble, M.,
   Thompson, J., Chaudhary, N., Smith, D., Strods, J., Mace, R., Thomas, M. G., Latora, V.,
   Vinicius, L. 2017. "Characterization of hunter-gatherer networks and implications for
   cumulative culture." *Nature Human Behaviour* 1: 0043. DOI: 10.1038/s41562-016-0043.
8. Pastoors, A., Lenssen-Erz, T., Ciqae, T., Kxunta, U., Thao, T., Bégouën, R., Biesele, M.,
   Clottes, J. 2015. "Tracking in Caves: Experience Based Reading of Pleistocene Human Footprints
   in French Caves." *Cambridge Archaeological Journal* 25(3): 551–564.
   DOI: 10.1017/S0959774315000050.
9. Rockman, M., Steele, J. (eds.) 2003. *Colonization of Unfamiliar Landscapes: The Archaeology
   of Adaptation*. London: Routledge. ISBN 9780415256070.
