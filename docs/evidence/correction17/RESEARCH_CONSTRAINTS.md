# CORRECTION-17 — Research and anthropological constraints

This checkpoint added one production behaviour — an exploratory expedition family that can
enter country the band does not know — and changed **no coefficient in demography,
nutrition, yield, carrying capacity or fission**. The constraints below are the ones that
bound the *design* of that behaviour, and the ones that bind the scope still unbuilt.

---

## 1. Exploration is a real, costly, ordinary activity — not a special mode

Ethnographic and archaeological evidence on mobile foragers supports a small number of
strong claims that this checkpoint treated as binding:

- **Foragers routinely walk beyond their working range, and they do it on a heading, not to
  a coordinate.** Logistical and exploratory trips are organised around a direction, a
  drainage, a visible landform, or a remembered route — not around a destination whose
  quality is known in advance. This is why `FrontierExplorationPlan` carries a heading, a
  broad sector and a band-known anchor, and deliberately carries no target tile.
- **The party discovers its route as it walks.** Route knowledge is built incrementally from
  what is visible at each stand. This is why the outbound leg appends one 4-adjacent step at
  a time from the party's actual position, instead of running a path-finder to a chosen end
  point. A precomputed optimal route through unseen country is an omniscience artefact, not
  a model of wayfinding.
- **Return is the binding physical constraint, not distance.** What limits an exploratory
  journey is provisions, water, fatigue, season, and the requirement to get home — not an
  abstract range. This is why the outward budget is re-derived at every step against the
  cost of retracing the trail, and why the party turns back when the reserve binds rather
  than when a distance cap is hit.
- **Information travels at walking speed.** A party's observations are worth nothing to the
  residential group until someone carries them home. This is the strongest anti-omniscience
  constraint in the whole design and it is the one the `lost_before_transfer` control arm
  exists to verify: a party that does not return teaches its band nothing at all.

## 2. What returned exploration may and may not teach

The distinction that matters ethnographically, and which §12 encodes, is between **knowing
that a place exists and what it broadly looks like** and **knowing how to live there**.

Walking through country reliably teaches: that it exists, roughly how far it is, whether it
was passable, broad terrain, whether there was visible water or wetland or relief, and
roughly how dangerous the crossing felt. It does **not** teach stock sizes, which plants are
edible, how to process them, recovery rates after harvest, or the seasonal calendar of a
place seen once in one season. Those require repeated visits, experiment, failure and
transmission — which the existing observe/test/use paths already model.

This is why returned exploration writes only `KnownTileRecord`s through the canonical
observation writer and creates **no resource memory and no food receipt**. Observation is
not harvest. The anti-omniscience audit checks both as runtime invariants.

## 3. Need changes willingness, never capability

A hungry band may be more willing to gamble labour on a speculative journey. A hungry band
is not faster, cannot see further, does not carry more, and does not become better at
reading country. This asymmetry is a hard constraint (§7) and it is why `willingness` in
`deriveFrontierExplorationEligibility` is applied to the eligibility threshold and to
nothing else, and why the frontier family uses the same canonical travel-pace authority as
every other information party.

**Open question this checkpoint did not settle.** The current model makes hunger *increase*
willingness to explore. There is a defensible opposing reading: a band under acute
subsistence stress cannot spare the labour and should explore *less*, with exploration
instead a behaviour of bands with a modest surplus and a structural reason to move. The
measured default-map effect (§4 of FINDINGS) means this is not a neutral modelling choice
and should be settled with evidence, not preference, before the family is merged.

## 4. Expansion must not be guaranteed

The literature does not support a model in which groups reliably find better country by
looking for it. Exploration frequently returns nothing useful, and range expansion in the
archaeological record is episodic, often slow, and often reversed. A system in which
exploration always succeeds would be a worse model than one in which it usually does not.

This is why honest failure modes are first-class outcomes (`frontier_barrier_blocked`,
`frontier_return_budget_reached`, `party_lost`) and why §18 requires at least one seed to
fail. Measured: 14–18 of ~150 journeys per 300-year run terminate on a physical barrier.

## 5. Constraints binding the scope still unbuilt

- **A newly seen place is not a viable destination.** Founding a daughter group requires
  water, refuge, a feasible route, and an expectation of support based only on what is
  actually known — plus enough people, enough pressure, and time since the last split. None
  of those thresholds were touched here and none should be relaxed to make expansion happen.
- **Distance is a one-time cost for a colonist and a recurring cost for a forager.** The
  opportunity score currently charges a saturating per-distance penalty that reaches its
  maximum at 12 tiles and is used for both questions. Whether that is correct for a
  colonisation decision is a real open modelling question — but this checkpoint measured
  7,186 non-overlapping candidates and found **zero** cases where a genuinely better distant
  candidate lost to a nearer one, so there is currently **no evidence** justifying a change.
  Changing it without such evidence would be threshold tuning, which this checkpoint forbids.
- **Second-hand and inherited directional knowledge is bounded and degrades.** Directions
  learned from others are usable as a heading and never as a map. The `second_hand_direction`
  and `inherited_heading` bases carry low confidence for this reason.

## 6. Explicitly NOT calibrated here

No empirical claim is made about: exploration frequency in any real forager population;
realistic party size for an exploratory trip; the true distance distribution of such trips;
or the rate at which distant country becomes usable habitat. The bounds used
(`FRONTIER_OUTBOUND_BUDGET_TILES = 18`, `FRONTIER_EXPLORATION_SUPPRESSION_TICKS = 12`,
2-person parties) are **engineering bounds chosen to stay inside the existing physical
expedition envelope**, not calibrated ethnographic quantities. They must not be cited as
such, and they must not be raised to make a run succeed.
