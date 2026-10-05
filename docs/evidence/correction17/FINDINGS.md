# CORRECTION-17 — Findings

**Verdict: PROGRESS — NOT ACCEPTED / DO NOT MERGE.**

The construction goal was met and measured: bands now physically explore far beyond the
~9-tile destination-knowledge horizon, with no hidden destination knowledge, no
teleportation, no enlarged omniscient radius, and no guaranteed expansion. The residential
knowledge horizon roughly quadruples.

The full causal chain does **not** close. It breaks at exactly one link on 5/5 controlled
seeds — `L09`, opportunity evaluation over the newly known country — and this document
names precisely why, with the measurement that rules out the two obvious explanations.

---

## 1. What was built

One new expedition task family, `frontier_exploration`, in
`src/sim/agents/frontierExploration.ts` (new) plus its lifecycle in
`src/sim/agents/expedition.ts`.

It is distinct from all four pre-existing families. `distant_plant_gathering`,
`distant_hunting`, `distant_fishing` and `distant_patch_verification` all select a
**remembered patch** out of `resourceKnowledgeState`. `route_reconnaissance` selects either
a tile a previous party failed to reach or a remembered patch whose *access* evidence is
weak. All five therefore require the band to already know the place, and a band cannot
remember a patch in country it has never entered — which is the mechanism behind the
measured horizon.

`frontier_exploration` has **no destination tile, no remembered patch, and no precomputed
route**:

| Property | Implementation |
| --- | --- |
| Trigger (§7) | `deriveFrontierExplorationEligibility` — range saturation, own return trend, own dispersal/fission pressure, absence of a known non-overlapping destination, exhausted known opportunity, own frontier intent. Band-known state only. |
| Direction (§8) | `deriveFrontierHeading` — five ordered band-known bases: corridor continuation, inherited/sustained intent, visible relief or water-margin cue, the outer edge of known country, bounded second-hand direction. |
| Plan (§8) | `FrontierExplorationPlan` = heading + broad 8-way sector + band-known anchor + return budget. Carries no target tile. |
| Movement (§9) | `chooseNextFrontierStep` — one 4-adjacent step per movement unit, chosen from the party's actual position using passability, already-walked trail, heading alignment, and visible local water/relief. |
| Return budget (§10) | `deriveOutwardTilesRemaining` — recomputed **at every step** against the cost of retracing the party's own trail. Binds before the deadline, never after. |
| Party-local knowledge (§11) | Observations accumulate in `carriedObservations`; residential knowledge is written only on physical return. |
| Breadcrumbs (§13) | `routeTileIds` capped at `FRONTIER_MAX_BREADCRUMB_TILES = 37`; observations capped at `FRONTIER_OBSERVATION_CAP = 12` under a "salient observations plus route endpoints" retention rule. |

### Documented caps (§13, §22)

```text
FRONTIER_MAX_BREADCRUMB_TILES            37   (origin + 36-tile walk = the existing envelope)
FRONTIER_OBSERVATION_CAP                 12   (first + last + salient middle, deterministic)
FRONTIER_STEP_BRANCHING                   4   (4-adjacency: constant-time local read)
FRONTIER_OUTBOUND_BUDGET_TILES           18   (strictly below EXPEDITION_MAX_ROUTE_TILES = 36)
FRONTIER_EXPLORATION_SUPPRESSION_TICKS   12   (one look per window, per band)
EXPEDITION_MAX_ROUTE_TILES               36   UNCHANGED
EXPEDITION_MAX_DURATION_DAYS             24   UNCHANGED
EXPEDITION_ACTIVE_CAP                     2   UNCHANGED
```

No existing cap was raised (§10). No demography, nutrition, yield, carrying-capacity or
fission coefficient was touched.

### One band field added

`Band.lastFrontierExplorationTick?: TickNumber`. The suppression window cannot be read off
`recentExpeditionOutcomes`, which is an LRU capped at 6 entries: six ordinary expeditions
concluding inside the window silently evict the frontier record and the band explores
again early. Measured before/after on the same seed: **288 → 153** explorations per
300 years, i.e. from above the theoretical per-band bound to inside it.

---

## 2. Headline result: the knowledge horizon is no longer the binding limit

Baseline, reproduced on this branch before any change
(`scripts/destinationKnowledgeHorizonProbe.mjs`, map2 `tile:188:92`, pop 34, 300 years):

```text
y 50 maxDist  7   y100 maxDist  7   y150 maxDist 11
y200 maxDist 10   y250 maxDist  7   y300 maxDist  8
beyond10_conf>=0.34 = 0 at every sample except y150 (3)
```

After, on the same physical envelope (`frontier-causal-chain.json`, 5 seeds × 260 years):

```text
mean residential max known distance, exploration ENABLED  : 40.4 tiles
mean residential max known distance, exploration DISABLED : 28.8 tiles
per-seed enabled range                                    : 39 – 44 tiles
```

The disabled arm is higher than the 7–11 baseline because the default multi-band worlds
roam more than the single-founder probe; the **enabled-vs-disabled delta on identical
seeds** is the controlled measurement, and it is unambiguous.

Every tile of that gain was physically walked and physically carried home. The median
exploratory journey walks its full 18-tile outbound budget and returns; the minimum is 0
(blocked immediately).

---

## 3. The chain, link by link (§16)

5 predeclared seeds × 5 control arms × 260 years, on a controlled map2 region with a
constructed richer ring at distance 18–24 (region construction, **not** destination
prepopulation — the band is given no knowledge of it and must walk there).

| Link | Production arm |
| --- | --- |
| L01 range/expansion pressure | PASS 5/5 |
| L02 frontier eligibility | PASS 5/5 |
| L03 task selection | PASS 5/5 |
| L04 party formation | PASS 5/5 |
| L05 physical outward path | PASS 5/5 |
| L06 party-local observations | PASS 5/5 |
| L07 physical return | PASS 5/5 |
| L08 residential knowledge beyond horizon | PASS 5/5 |
| **L09 opportunity evaluation on new country** | **FAIL 5/5 — first failed link** |
| L10–L15 | not reached |

### Control arms

| Arm | First failed link | Reading |
| --- | --- | --- |
| production | L09 | knowledge arrives, opportunity evaluation does not use it |
| exploration disabled | L03 | correct — no party is ever raised |
| blocked route | L09 | barrier works: residential horizon falls to 22–24 vs 39–44 |
| poor distant country | L09 | route open, parties walk, country not worth founding on |
| lost before transfer | L06 | **the §11 control: 129–152 parties lost, 0 completed, 0 observations transferred** |

The lost-party arm is the strongest single piece of evidence in this checkpoint: identical
worlds, identical journeys, and the *only* difference is whether anyone walked home. The
residential horizon in that arm collapses to 21–31 and no observation is ever applied.

---

## 4. Why L09 fails — and why it was NOT repaired (§15)

§15 asks whether fission prefers the parent catchment because **no alternatives exist** or
because **the scoring overvalues overlap**. Both were tested.

`scripts/frontierOpportunityIsolationAudit.mjs`, 5 seeds × 160 years, staged:

```text
S1 band KNOWS non-overlapping tiles              795 / 795 band-years
S2 they are admitted to the candidate domain     795 / 795
S3 they survive the candidate slice              795 / 795
S4 they pass consideredAsTarget                    0
S5 they win the score                              0
```

So alternatives **do** exist and **do** reach the evaluator. They simply never win.

The decisive measurement is the distribution, not the samples. Across **7,186
non-overlapping candidates**:

```text
frontierCandidateShouldHaveWon   : 0
maxHabitatAdvantageObserved      : 0.094
```

Not one non-overlapping candidate ever held a habitat advantage exceeding the travel+risk
penalty it was charged. Verdict recorded in the JSON:
`no_alternatives_materially_better_scoring_not_at_fault`.

This was then stress-tested directly. A **strictly superior** synthetic region (richness
1.0, water 1.0, risk 0) was placed first at distance 18–24 and then at 9–11, just past the
8-tile proximity cap. The band learned 51–69 of its tiles. The opportunity winner still
never moved past distance 8 — because the winner's *own* observed richness is 0.93–1.0:
**this catchment is already at the ecological ceiling, and travel cost correctly breaks the
tie toward staying.**

### A candidate-budget defect was found, and deliberately left unrepaired

A separate real finding: `collectOpportunityCandidates` appends `knownFrontierTileIds` —
the only candidate path with no distance cap — into the same set as the ≤8-tile path and
then slices the union. Modelled on real band state, the ≤8-tile path alone supplies a mean
**15.99** candidates against the budget, and **0 of 120** band-years had a beyond-8
candidate survive the slice.

A reserved-slot repair was implemented and measured. It changed **no outcome**: the winner
distance distribution was unchanged, because (per above) the near country genuinely scores
higher. The repair was therefore **reverted**. A production change that alters candidate
ordering for every band on every map, with no demonstrated effect, is exactly the
"threshold tuning without isolation" this checkpoint classifies as FAIL. The defect is
recorded here as characterised, isolated, unrepaired debt.

---

## 5. Anti-omniscience (§24.17) — PASS

`scripts/frontierAntiOmniscienceAudit.mjs`, 3 seeds, 60 seasonal warm-up years then 12
years of **daily** stepping (daily stepping is what actually catches parties mid-journey).

```text
static A  forbidden hidden-truth reads in trigger + heading : CLEAN (16 fields checked)
static B  stock/yield/harvest imports in the module         : CLEAN (9 specifiers checked)

C1 plan names a tile the band does not know                 : 0
C2 party-local tile leaked to residential while away        : 0
C3 lost party transferred knowledge                         : 0
C4 exploration created a resource memory                    : 0
C5 exploration created a food receipt                       : 0
D  non-adjacent breadcrumb step (teleport)                  : 0

anchor provenance: observed 28, inferred 28, self 0, UNKNOWN 0
observed: 56 plans, 622 breadcrumb steps checked
```

The module cannot read a stock or a yield because it does not import one. Every heading
anchor traced to either an observed tile or the band's own bounded corridor **inference**
(existence-only, direction never value — the accepted M0.7/M0.8/M0.12 precedent). Every one
of 622 walked steps was 4-adjacent to its predecessor.

---

## 6. Regression matrix executed on this branch

| Check | Result |
| --- | --- |
| build | PASS |
| TypeScript | PASS (exit 0, clean) |
| graph validation | PASS — graph 217/754, 0 dup, 0 dangling |
| import boundary | PASS — `simLayerViolations: []` (83 internal back-edges, informational, unchanged) |
| adaptation boundary | PASS — `boundaryMatchesInternal`, `adaptationObserverParity` |
| context lifecycle | PASS — stale-read-free, deterministic, observer parity |
| season-order invariance | PASS |
| deterministic benchmark | PASS |
| fresh-process determinism | PASS — identical across separate processes (timing fields excluded) |
| step-mode invariance map1 | PASS — `fullCanonicalStateMatch: true`, `firstDivergence: null` |
| step-mode invariance map2 | PASS — `fullCanonicalStateMatch: true`, `firstDivergence: null` |
| food-receipt capture | PASS — capture ratio **1.000**, per-founder and per-season |
| annual nutrition like-for-like (§4) | PASS — 905 comparisons, 0 mismatches |
| death-memory same-snapshot (C16) | PASS — 5/5 seeds |
| social exact-seam (C16) | PRESERVED — 5/6 arms causal; C16 retraction stands |
| all-map living ecology | executed |
| habitat ladder | PASS — gradient intact; `isolated_marginal` founder still dies (survival 0), `hostile` still caps at pop 10 |
| fission population conservation | PASS — 0 mismatches (3 fissions checked across tiers) |
| fission cohort conservation | PASS — 0 cohort mismatches, 0 world-population mismatches |
| candidate repairs A–D | claim A superseded by §7 (like-for-like); B–D unchanged from C16 |
| default map1 / map2 A/B | executed — see §9 (confirmed regression) |
| performance | executed — see §9b |
| knowledge-horizon audit | executed — §2 above |
| frontier exploration lifecycle | executed — §3 above |
| lost-party no-knowledge control | PASS — §3 above |
| anti-omniscience | PASS — §5 above |

---

## 7. §4 — the annual-nutrition measurement debt is closed

`candidateRepairIsolationAudit.mjs` claim A compares annual mean seasonal food stress (one
term) against `foodDemographicPressure` (a four-term composite). Those are different
quantities by construction, so their numeric difference is **not** evidence of demographic
overstatement and must not be cited as such.

`scripts/annualNutritionLikeForLikeAudit.mjs` replaces it with a like-for-like
reconstruction over the same four intended seasonal samples, measuring independently:
annual mean `currentFoodStress`, annual mean raw support ratio, recovery share, nutritional
surplus, chronic food stress under the exact production formula, and
`foodDemographicPressure` rebuilt from those exact components — including the production's
own rounding asymmetry (two operands enter unrounded, two rounded).

```text
comparisons  905  (map2 rich 166, map2 rich small 124, map1 default 615)
mismatches     0
reconstruction EXACT
annual consumers  ["src/sim/agents/demography.ts"]   (demography-only: true)
seasonal consumers 11
VERDICT PASS
```

No production coefficient was changed to make this pass.

---

## 8. Unmet gates

Of the 25 gates in §24:

**Met:** 1–14, 16, 17, 20, 21, 22, 23, 25 — exact ancestry, `main` untouched, C16 evidence
intact, like-for-like nutrition, band-known-only exploration, no hidden destination
quality, successive physical travel, reserved return, party-local knowledge, lost parties
transfer nothing, canonical writers, no food from observation, bounded state, horizon
extended, unchanged fission thresholds, anti-omniscience, honest failure (14–18 barrier
terminations per 300-year run), determinism, step-mode convergence, receipt capture 1.000,
documentation separating the four knowledge classes.

**Not met:**

- **Gate 15** — non-overlapping destinations become *known* through exploration (S1–S3 pass
  795/795) but never become *selected*. See §4.
- **Gate 19** — 0/5 controlled rich seeds complete daughter survival + second-generation
  eligibility. The chain stops at L09.
- **Gate 18** — see §9: a measured default-map effect is unresolved.
- **Gate 24** — performance was measured for the new family and for default-map runs, but a
  fresh whole-simulator performance closure at 500/1000 years was not completed.

## 9. CONFIRMED REGRESSION: frontier exploration costs population on the default maps

This is the finding that blocks merge, and it is **not** seed noise. Measured as a strict
A/B — identical seed, identical map, identical everything, the single difference being
`frontierExplorationEnabled` undefined (production) vs `false` — over 300 years, 3 seeds per
map (`scripts/frontierDefaultMapAndBoundsAudit.mjs`).

```text
map1   ENABLED   bands 8 / pop 192    8 / 226    7 / 220     mean  7.7 bands, 212.7 pop
map1   DISABLED  bands 10 / pop 235  10 / 292    9 / 229     mean  9.7 bands, 252.0 pop
                                                    delta   -2.0 bands, -39.3 pop  (-15.6%)

map2   ENABLED   bands 10 / pop 151  11 / 192   11 / 180     mean 10.7 bands, 174.3 pop
map2   DISABLED  bands 11 / pop 226  11 / 208   11 / 208     mean 11.0 bands, 214.0 pop
                                                    delta   -0.3 bands, -39.7 pop  (-18.5%)
```

The direction is the same on **6/6 enabled runs against 6/6 disabled runs, on both maps**.
Enabling exploration consistently produces fewer bands and a smaller total population.

The horizon gain is equally consistent, so the two effects are real and opposite:

```text
map1  residential horizon  ENABLED 43 / 54 / 36   DISABLED 37 / 36 / 38   delta  +7.3
map2  residential horizon  ENABLED 37 / 45 / 34   DISABLED 18 / 27 / 21   delta +16.7
```

The rest of §20 passes cleanly on both maps: no extinction was eliminated (the habitat
ladder's `isolated_marginal` founder still dies, survival rate 0, and `hostile` still tops
out at population 10), no population or band-count inflation, no lineage convergence, and no
expedition spam (0.21–0.25 journeys per band-year, inside the one-look-per-window bound).
Every band does take at least one look across 300 years, which is reported as a
trigger-permissiveness signal — but band counts *fall*, so it is not expansion.

**The mechanism is NOT the labour cost.** Exploration runs at 0.21–0.25 journeys per
band-year, each ~10–20 days with a 2-person party: on the order of 5–10 worker-days per
band-year against roughly 3,600 available. That is a few tenths of one percent of the labour
budget and cannot produce a 15–20% population effect.

The remaining candidate mechanism — untested here — is that the **extended knowledge itself
changes downstream decisions for the worse**: newly known distant tiles enter movement
target selection, `knownFrontierTileIds`, range-saturation and carrying-capacity candidate
sets, and bands may relocate toward country that is known but not better. That would mean
the cost is not exploration but the *use* of what exploration returns, which is a different
and more interesting defect. It was not root-caused in this checkpoint and must not be
guessed at in the report.

This also sharpens the open modelling question in `RESEARCH_CONSTRAINTS.md` §3: the current
model makes hunger *increase* willingness to explore, which is the opposite of what a
labour-budget argument predicts, and the wrong sign here would compound the effect above.

**Consequence for merge: blocking.** A feature that removes the knowledge horizon but costs
15–20% of population on both default maps is not mergeable as-is, regardless of how sound
the mobility machinery is.

## 9b. State bounds and performance (§22)

Per-band exploration state, measured across 300-year default-map runs (6 enabled runs):

```text
maxRetainedOutcomes              6      == EXPEDITION_OUTCOME_CAP (unchanged)
maxActiveFrontierPartiesPerBand  1      one exploratory party at a time, per band
maxResourceMemories             48      == RESOURCE_KNOWLEDGE_CAP (unchanged)
maxKnownTileRecords        147 – 223    plateaus; see below
```

Breadcrumb-trail and carried-observation maxima read 1 and 0 in the seasonal-stepping runs
because a ~10-day journey begins and ends inside one 90-day step and is never sampled
mid-flight. The real bounds come from the daily-stepping anti-omniscience run and the
lifecycle smoke run: **622 breadcrumb steps observed, carried observations peaking at
exactly 12** — the `FRONTIER_OBSERVATION_CAP`, i.e. the retention rule binds as designed.

**Known-tile state grows and must be watched.** Baseline peak known-tile records over 200
years were 125 (map1) and 98 (map2); with exploration they reach 183–223 and 147–182 over
300 years. The growth is a *pre-existing* property, not one this checkpoint introduced:
`memoryCompression.selectRetainedKnownTileIds` marks every visited high-value water tile as
`mandatory` and exempts it from `MAX_EXACT_KNOWN_TILES = 72`, so on river-rich maps the
"cap" never binds. Compression already fired at baseline (peaks were already above 72).
Exploration walks more river country and so surfaces the same unbounded-mandatory-set issue
more sharply. It plateaus within a run (geography is finite) but there is no explicit cap,
and that is recorded here as debt.

Cost:

```text
default map1  ~49–59 ms/season enabled   vs ~50–59 ms/season disabled
default map2  ~87–95 ms/season enabled   vs ~89–98 ms/season disabled
```

Frontier exploration is not measurably more expensive per season than the disabled arm — the
route search is 4-adjacency (constant-time per step, `FRONTIER_STEP_BRANCHING = 4`) and does
no BFS at all, unlike the other families. Audit hooks are inert when their options are
undefined. Not done: a fresh whole-simulator 500/1000-year performance closure.

## 10. First remaining causal blocker

```text
L09 — opportunity evaluation over newly known country.
```

Newly explored, genuinely non-overlapping country is known (S1), admitted (S2) and survives
the candidate slice (S3), but never wins the opportunity score — and, on the evidence
gathered here, **it should not**, because on this fixture the parent catchment is already at
the ecological ceiling and pays no travel cost.

The next checkpoint therefore should **not** start by tuning the travel-cost term. It should
start by establishing whether a controlled region exists in which a genuinely superior
distant candidate loses — and if one does, repair that in isolation. If none does, the real
blocker is upstream of fission entirely: it is that the simulator's ecology does not
currently produce reachable country that is materially better than an established
catchment, which is an ecology question, not a mobility or fission question.

## 11. Scope explicitly not built

Per §3, none of the following was attempted: generic cooperation, households, individuals,
population genetics, independent age hazards, the whole-viability cause taxonomy, the
adaptation-cascade audit, culture/language/religion/norms, climate architecture, the
whole-simulator missing-threads audit, public-experience polish. All remain tracked debt.

## 12. Merge recommendation

```text
PROGRESS — NOT ACCEPTED / DO NOT MERGE
```

Keep the branch local. The exploration machinery is sound, bounded, deterministic,
step-mode invariant and anti-omniscient, and it demonstrably removes the knowledge horizon
as the binding constraint. It should not merge until §9 is resolved and gate 15/19 either
close or are consciously accepted as a different checkpoint's scope.
