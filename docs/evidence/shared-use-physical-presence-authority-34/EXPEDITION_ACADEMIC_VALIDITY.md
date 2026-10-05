# Expedition system — academic validity assessment

CORRECTION-34A §2. Assessed at `4042210b332d41b91ed394aa9307962f0106a60c` plus this checkpoint's
two repairs. Every classification below is a judgement about **this simulator's current
implementation**, not a claim about foragers in general.

## 0. Method and epistemic warnings

**No single ethnographic society is treated as representative.** Binford's forager/collector
contrast is a *continuum of organisational responses to resource structure*, not a taxonomy of
peoples, and Kelly's synthesis is explicit that mobility varies enormously within and between
groups, across seasons, and over a single lifetime. Where this document cites a regularity it
names it as a regularity, and where the literature is contested it says so.

Claim types are kept apart throughout:

| Tag | Meaning |
| --- | --- |
| `research-supported mechanism` | a broad regularity across many documented cases |
| `ethnographic variation` | real, but varies so widely that no single value is defensible |
| `contested interpretation` | specialists actively disagree |
| `implementation abstraction` | a modelling choice standing in for something finer |
| `deliberate simplification` | knowingly coarse, with the cost understood |
| `future dependency` | cannot be modelled until an earlier system exists |

## 1. The organising literature

- **Binford, "Willow Smoke and Dogs' Tails" (1980).** The residential/logistical distinction:
  *foragers* move consumers to resources with frequent residential moves and little storage;
  *collectors* move resources to consumers via task-specific parties, field camps, stations and
  caches. Critically, these are **poles of a continuum** responding to spatial and temporal
  incongruity in resource structure, not two kinds of society.
- **Kelly, "Hunter-Gatherer Mobility Strategies" (1983) and *The Lifeways of Hunter-Gatherers*.**
  Systematises mobility as a set of interacting variables — residential move frequency and
  distance, logistical radius, foraging radius, effective temperature, resource density and
  predictability — and demonstrates the spread is continuous rather than clustered.
- **Central-place foraging.** Returns decline with distance because travel is a cost paid twice;
  transport capacity and field processing shape what is worth carrying home. Predicts field
  processing of bulky/low-utility parts and selective transport.
- **Logistical radius.** Day-trip foraging radii commonly cited around 6–10 km around a residential
  base, with logistical trips reaching substantially further and lasting days. The **structure**
  is well supported; the **numbers** are highly environment-dependent.
- **Task-group size and composition.** Party size responds to task, expected return, skill,
  economies of scale, risk and childcare compatibility. Divisions of labour by age and sex are
  common but their content varies and is *not* universal — encoding one pattern as natural law is
  precisely what §3.8 of this project forbids.
- **GPS / time-allocation work.** Direct tracking shows individual daily paths, childcare
  constraints on range, and pronounced within-group variation that aggregate models flatten.

## 2. The matrix

| # | Box | Classification | Evidence in this repository |
| --- | --- | --- | --- |
| 1 | residential vs logistical mobility | **well represented** | Two genuinely distinct paths: same-day trips (`intraSeasonTrips.ts`) and a multi-day logistical lifecycle (`expedition.ts`), separated by a real physical test — `deriveSameDayRoundTripFeasible` / `deriveTripDurationDays > 1` — not by a label. Residential movement is a third, separate authority. |
| 2 | task-specific party formation | **partially represented** | `ExpeditionTaskKind` distinguishes retrieval, patch verification, route reconnaissance and frontier exploration, each with its own selection gate. Party *composition* comes from mobility-role pools, not from task-specific skill. |
| 3 | party size | **partially represented** | Bounded and physically justified: `deriveDepartableWorkers` = `min(residential adults - 2, workingAdults/3)`; information families are fixed at 2. Size responds to available labour, not to expected return or economies of scale. |
| 4 | party composition | **partially represented** — `implementation abstraction` | Three mobility-role pools (limited/typical/high) conserved against the workforce, with composition recorded per party and shaping pace. Deliberately not sex- or age-structured: canonical demography has **no sex composition**, so any sex-specific party rule would be fabricated. Recorded as a future dependency, not a defect. |
| 5 | daily vs multi-day trips | **well represented** | The split is enforced by the round-trip budget, and CORRECTION-26 removed the path that let multi-day work credit food on the departure day. |
| 6 | routes | **well represented** | Real passable paths via `buildOutboundPathTiles`/`findPassablePath`, bounded by `EXPEDITION_MAX_ROUTE_TILES = 36`; position must equal the route tile at the party's index (audited: `positionOffRouteViolations = 0`). |
| 7 | travel duration | **well represented** | Days elapse; pace comes from one authority (`bandMobility`) across seven travel contexts, with load, injury and party composition as inputs. Audited `travelDaysSeen >= 2`. |
| 8 | target work | **well represented** | `resolveExpeditionTargetWork` reuses the same physical harvest machinery as near trips, drawing from the same stocks with the same losses. Depletion occurs where the party stands. |
| 9 | temporary camps | **well represented** | `deriveTaskCampForOperating` establishes a camp only when the walk home exceeds a day *and* the ground can host one; setup costs provisions; it holds nothing and expires. 375 task-camp days observed daily over 40 y. Explicitly not a settlement. |
| 10 | provisions | **partially represented** | Consumed per worker-day, forcing an early return when exhausted (`provisions_ran_out`), and subtracted from the cargo at return — a real cost, drawn against the carried budget rather than a phantom store. **Gap:** the budget is a constant and carries no carrying-capability term. See `DEFAULT_EXPEDITION_CARRYING_RULE.md`. |
| 11 | carrying | **well represented** for the bodily baseline and the learned improvement | `EXPEDITION_CARRY_UNITS_PER_WORKER = 0.12` is bare bodily capacity; improvement requires a learned, materially-grounded, maintained practice (four independent zero-relief cases). Matches the Default Expedition Carrying Rule. Sledges, boats and pack animals are absent — `future dependency`. |
| 12 | injury and fatigue | **partially represented** | Injury slows pace, reduces the carry ceiling and can force return with cargo abandonment; exposure generates canonical acute-risk episodes. Cumulative fatigue across trips is not modelled. |
| 13 | return-only delivery | **well represented** | Cargo becomes food only on physical return, exactly once. Audited: `receiptsBeforeReturn = 0`, no duplicate receipt ids. A lost party delivers nothing. |
| 14 | information return | **well represented** | Observations stay party-local until the party physically walks home, then apply through the canonical writer. This is the CORRECTION-26 repair; a lost party's observations never arrive. |
| 15 | failure and loss | **well represented** *mechanically*, **measured zero** naturally | `lost` past the hard deadline; `aborted`; typed outcome reasons. 0 aborted and 0 lost in 40 y of map1, so both are proven by controlled fixture (P7/P8) rather than marked successful on zero observations. |
| 16 | storage and caching | **missing and deferred** | Parties only return or lose cargo. Binford's collectors cache and intercept; that requires material, property and economic systems that do not exist. Recorded as a debt, deliberately not built. |
| 17 | care and dependent constraints | **missing and deferred** | Dependents and elders exist demographically and weight consumption, but no childcare constraint shapes who may leave or how far. Requires households/care systems. `future dependency`. |
| 18 | social encounters | **deliberately absent at the party level** | Physical co-presence of *expedition* parties is now represented; it creates **no** encounter, caution or knowledge. CORRECTION-29/30/31 established that social effects need observation provenance. Party-to-party encounters are explicitly out of scope. |
| 19 | seasonality | **partially represented** | Seasonal stocks, seasonal conditions and seasonal decision cadence exist. Logistical *strategy* does not shift seasonally the way the collector model implies — there is no seasonal round. Awaits the migration checkpoint, which itself awaits climate. |
| 20 | learning | **partially represented** | Carrying and water practices are learned, material-dependent, testable, and inheritable by daughters. Route/landscape learning exists through place and corridor memory. Skill-specific *party selection* does not read it. |
| 21 | resource accounting | **well represented after this checkpoint** | Stock removed at the target, cargo created, cargo lost, provisions consumed, receipt returned exactly once. CORRECTION-34A closed the remaining leak: away workers no longer claim the residential catchment while extracting elsewhere. |

### Summary counts

| Classification | Count | Boxes |
| --- | --- | --- |
| well represented | 9 | 1, 5, 6, 7, 8, 9, 11, 13, 14, 21 (10 with 21) |
| partially represented | 8 | 2, 3, 4, 10, 12, 19, 20, and 15 mechanically |
| missing but required now | **0** | — |
| missing and deferred | 3 | 16, 17, and 18 by deliberate scope |
| unsupported simulator abstraction | **0** identified | — |

**No box is classified "missing but required now."** The two that CORRECTION-34A judged actionable
were resource accounting (box 21, repaired) and person conservation (a correctness precondition
for boxes 3/4/21, repaired).

## 3. Where the simulator is honest about its own coarseness

- **Party composition is role-based, not demographic.** This is an `implementation abstraction`
  chosen because adding sex composition means sex-aware aging, mortality, fertility, fission and
  absorption surgery on a single-net-rate demographic core. Fabricating `adultMen = adults / 2`
  in a downstream checkpoint is explicitly forbidden.
- **Logistical radius is bounded by physical budgets, not by a distance constant.**
  `EXPEDITION_MAX_ROUTE_TILES = 36` is documented as a technical bound that must never be what
  blocks a long journey — provisions, pace and value gates are.
- **The provisions constant is calibration, not measurement.** `0.0008` units/worker/day was chosen
  so a party cannot mathematically eat its entire cargo, with the reasoning written at the constant.
  It is not derived from energetics data and does not claim to be.

## 4. What this assessment does not establish

- It does not validate any **magnitude**. That `0.12` carry units or a 24-day maximum are
  physically right is not tested by anything here.
- It does not claim the expedition system produces realistic *rates* of logistical mobility. Only
  161 expeditions launched in 40 years on map1; whether that is plausible for the modelled ecology
  is untested.
- It compares against the literature's **structural claims**, not against any quantitative dataset.
- One world (map1) and one seed underlie the lifecycle counts; the natural sweeps use map2.
