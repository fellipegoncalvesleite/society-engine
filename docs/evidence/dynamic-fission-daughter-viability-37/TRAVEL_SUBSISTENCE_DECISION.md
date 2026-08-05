# Roadmap Item 4 — travel subsistence, embodied return, evidence-based resolution

Decisions, comparisons and measured evidence for the pass that turns "walking correctly" into
**living during the journey, interpreting what happened, and reaching a real physical resolution.**

Evidence: `travel-subsistence-reproduction.json`, `provisional-subsistence-lifecycle.json`,
`provisional-travel.json`, `provisional-reintegration.json`, `provisional-lifecycle-exit.json`.

---

## 1. The exact cause of the hunger relief

The previous pass published a defect it could not repair: a group walked with no camp, no receipts and
no way to forage, and its hunger fell to zero. The obvious reading is a missing floor. It is wrong.
Traced link by link on a real departure from a warmed map2 world (`travel-subsistence-reproduction.json`):

```text
the departure resets `seasonalSupport`
  — CORRECTLY: eight seasons of streaks and classifications belong to a camp this group never was
→ the group walks onto ground it has never observed
→ `deriveCarryingCapacity` REFUSES without an observed record of the band's own position
→ `updateSeasonalSupportState` returns its previous value, which is absent
→ `deriveCanonicalNutritionState(undefined)` returns every stress term at 0
→ five separate readers consume those zeros as comfort
```

`L7` is the link the previous pass did not have and it is what makes the repair aimable: **the group
was not measured as unhungry, it was never asked.** `L6` is its confirmation from the other side — the
food LEDGER was honest the whole time, reporting `rawSupportRatio: 0` and `foodStress: 1` against real
demand. Nothing ever turned that into a support history, because a travelling group's food does not
arrive in the unit the residential system measures.

Four quantities were being collapsed into one:

```text
current founder-experienced hunger
  != parent-wide seasonal support history
  != the successor's first unmeasured interval
  != zero stress
  != physical travel support
```

A hunger floor would have put a tuned number where the missing thing is a measurement.

## 2. The chosen travel-subsistence architecture

Four compared:

1. **Debited carried provisions from an existing real stock.** **REJECTED ON INSPECTION**, not on
   preference: there is no such stock. `consumeProvisions` only increments a counter, and
   CORRECTION-34B recorded in so many words that no residential store is decremented at launch and
   that full material conservation is explicitly NOT claimed for provisions. Debiting a store that
   does not exist is a background ration with a subtraction sign in front of it.
2. **Opportunistic traveller extraction along the route.** **CHOSEN.** The group forages the ground it
   is standing on through `resolvePlantFoodHarvest` — the canonical plant-harvest owner, which finds a
   real patch, bounds the take by its real current availability, and persists the real depletion.
3. **An explicit bounded combination of 1 and 2.** Rejected with 1: it inherits the invented stock and
   adds a second magnitude to justify.
4. **Readmit the group to ordinary same-day trips.** Rejected on physics: a same-day trip is a ROUND
   TRIP FROM A CAMP, sized by the adults who stayed home. A column on the move has no camp and nobody
   at home, and the quarantine removed it for exactly that reason.

**Borrowed rather than invented:** the extraction, the demand scale (`derivePopulationDemand`), the
per-worker day of gathering (production's own `0.035` labour term, taken WITHOUT the two
remembered-patch confidence terms a traveller does not have), the processing loss (the patch's own
rate), the water term (production's own `(1 - waterAccess) * 0.52`), and the carried-water authority.
**New, and only this: an INTERVAL** — the unit a walking group's condition is measured in.

The support ratio needed no new definition: `carryingCapacity` already computes
`rawSupportRatio = humanFoodLedger.totalUsableSupport / adultEquivalentDemand`, so a travel interval
uses the same ratio over the same units, and `recordSupportInterval` — extracted from
`updateSeasonalSupportState` — is the ONE writer of derived support state for both producers.

## 3. The physical food and water chain

```text
worker effort allocated to gathering (bodies eat, labour works)
→ requested units = gathering workers x TRAVEL_GATHER_PER_WORKER_DAY
→ resolvePlantFoodHarvest at the tile the group is standing on
→ take bounded by the patch's real current availability
→ the patch's depletion is persisted in the world
→ processing loss at the patch's own rate; NO transport loss, because the group is standing on it
→ usable units into the successor's own interval
→ interval closes into ONE measured sample: support / demand
→ recordSupportInterval -> the canonical nutrition state -> exactly one bodily consequence
```

Water: the standing tile's own `waterAccess`, a physical execution constraint of the same class as
`isBandPassableDestination` — you find out whether you can drink here by being here, and it grants
nothing about anywhere else. Carried water relieves it **only** through
`deriveCarriedWaterRelief`, which returns nothing to a group with no learned water-storage practice,
so no vessel is invented (`N8`, `N9`).

## 4. The movement-versus-subsistence tradeoff

One set of workers, two demands on it. `gatherShare = 0.2 + need x 0.6 x groundIsGiving`, where `need`
is the group's own measured deficit or thirst and `groundIsGiving` is the share of its own recent
gathering days that took anything. Untested ground reads neutral.

The second term is what makes the outcomes plural rather than one optimum: a starving group on bare
country **presses on hungry**, and a group that finds a patch **stops, takes what is there, and
exhausts it** (both observed in the daily ledger). `movementShare = 1 - gatherShare` scales pace, so
slowing to gather genuinely lengthens the journey — arrival in the travel fixture moved from day 4 to
day 10 once the tradeoff was real.

A fixture caught `Math.floor` allocating ZERO gatherers to a group of four at a fifth of a day, so a
small comfortable group walked past every patch it stood on. Corrected to a floor of one for any group
with a worker: people walking through country keep an eye out, and what varies is how much of the day
goes to it.

## 5. Burden merge (L5)

Two bounded rings become one in `acuteRisk.ts`, the module that owns the ring, the cap and the effect.
Union **by episode id** — the founders left carrying the parent's episodes, so the same event exists on
both sides and appending would give one injury two recoveries. Nothing about an episode is touched; the
active effect is **rederived** from the merged ring. Retention policy, stated rather than implied: an
episode still in recovery outranks one that is only remembered, then newest first, then by id. Whatever
the cap removes is counted into `droppedEpisodeCount`.

Everything else that comes home is classified once, in `REINTEGRATION_FIELD_TREATMENTS`: cohorts and the
demographic accumulators merge exactly; the returning group's condition is weighted into the camp's
**current** reading rather than extending its window; the group's own travel interval closes because its
journey has ended; everything derived from a headcount that just changed is left for its own writer.

**R5 caught a defect in the first version of this**: appending the merged sample let a parent at hunger
0.14 read 0.01 after absorbing a group at 0.99, because a ninth sample pushed the oldest bad season out
of the eight-slot ring. A reintegration is not another season lived; it is a re-reading of the season
the camp is in, by a camp that now has more people in it.

## 6. Return causality, and the anti-omniscience boundary

`deriveProvisionalReturnDecision(band, day)` takes **a band and a day and no world**, so it cannot read
the parent's position, the parent's condition, the destination's real richness, another group, or the
future. `C21` proves it by measurement: moving the parent and collapsing it to one person changes the
decision NOT AT ALL.

Five named causes, each with its own bound rather than one score, because a score would let plentiful
food pay for the absence of water. Measured causes additionally require a record made **in the current
phase**, which is what stopped a group arriving somewhere and condemning it the same day on evidence
made entirely of walking.

Desire is not possibility: the decision writes a phase, the existing contiguous writer walks the
retained trail, and arriving to find nobody remains a real outcome (`C22`, `C23`).

## 7. Establishment evidence and the stabilization writer

Seven named signals, each with a source authority, a measured quantity, a required quantity and the day
it was first earned. **Every one must hold** — a smoke run stabilized a group with no food and no water
on "still has working adults", "not badly hurt" and "has been here a while", which describes a group
that has not died yet rather than one that is operating.

The measured-support signal uses `RETURN_SUPPORT_RATIO_FLOOR` — **the same number that would send the
group home** — so a group can never be simultaneously established and starving enough to leave.

Stabilization grants exactly one thing: admission to the ordinary systems the group was quarantined
from. No viability, no storage, no camp, no receipt (`S32`). The record is retained terminal so the
lineage stays readable and the pair protection ends.

## 8. Bounded resolution, and what happens at the bound

Three smoke findings, each fixed:

- the causal trigger could push a group round the return/establish loop forever without touching the
  timed bound. The bound now binds on both paths and is counted at one edge each;
- at the bound the group was **frozen in `returning`**, where `stabilized` is unreachable, so its only
  exit was starvation. It now gets exactly ONE more transition — into trying to live where it stands —
  and after that the resolver advances nothing;
- a stranded group could not be found by its parent, because a meeting was only recognised from
  `returning`. `establishing -> reintegrated` is now permitted, still requiring a physical event and
  proven co-location, so a parent that walks up to it can take it back.

Measured on a real world (`travel-subsistence-reproduction.json`, 3,600-day arm): departed → travelled →
arrived → tried → gave up → walked home → found nobody → tried again → spent its attempts → settled where
it stood → **and did not stabilize**, because the ground there gives nothing. It sits at hunger 1.0 and
declines on demography's own cadence. That is the honest terminal for a group that chose badly.

## 9. What is NOT done, and is not claimed

- **The reader migration is INCOMPLETE**: 5/12 load-bearing readers, seven pending and named.
- **No history or read-model projection exists** for any of it — no Chronicle line, no band event, no
  UI surface. The lifecycle is fully readable in state and invisible in the product.
- **The selected-band panel projection carries no lifecycle field at all.**
- **Nothing calls the departure seam.** There is no natural-occurrence evidence for any of this, and
  none is claimed.
- **Fauna and aquatic travel extraction are not built.** A travelling group gathers plants only; hunting
  and fishing on the road need a party/target model this pass did not build, and faking them through the
  plant path would be a second answer.
- **The bounds are authority boundaries, not calibrated magnitudes.** No natural run was used to fit one.
