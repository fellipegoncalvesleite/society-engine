# CORRECTION-34 — ARCHITECTURE DECISION

> **SUPERSEDED IN PART BY CORRECTION-34D.** `getBandPhysicalPresence` still returns one source per away party, but the count it places is the party's PHYSICAL HEADCOUNT (`partyWorkers + nonWorkingPartyPeople`), not `partyWorkers`. The Option-D decision recorded below is unchanged; what changed is which quantity feeds it. CORRECTION-34D's own architecture choice (Option B + Option C) is recorded in `PARTY_HEADCOUNT_LABOR_AUTHORITY.md` §3.
> See `PARTY_HEADCOUNT_LABOR_AUTHORITY.md`.

**Selected: Option D — the expedition-only correction, expressed as one shared presence authority.**

## What was built

`getBandPhysicalPresence(band)` in `src/sim/agents/crowding.ts` returns every place the band
currently has bodies:

```ts
{ tileId: band.position,          people: population - awayPeople, kind: "residential_remainder" }
{ tileId: expedition.positionTileId, people: partyWorkers,         kind: "away_party", expeditionId }
```

Both crowding computation paths — the cached `buildCrowdingField` and the cache-less
`computeCrowdingContribDescriptor` scan — iterate the same sources, so the field/scan parity
CORRECTION-28 audits is preserved (verified: `P8 = FIELD_SCAN_PARITY`).

## Why Option D

| Option | Decision | Reason |
| --- | --- | --- |
| **D — expedition-only correction** | **SELECTED** | It is the smallest change that fixes a *measured* defect: 505 away-worker-days represented nowhere while simultaneously ghosted at home. Multi-day expeditions carry a real `positionTileId` that persists across days, so no new temporal machinery is needed. |
| A — canonical physical-presence index (new read model) | REJECTED for now | The authority exists (as a pure function) but a separate cached index would be a second band simulator for 202 party-days per 6 years. The function is O(active expeditions), needs no cache, and can be promoted to an index later without changing its contract. |
| B — extend the crowding field | **ADOPTED as the mechanism**, but with scale corrected | The field is extended, but party weight uses the existing population→weight transform on the **party size**, so a 2-worker party carries ~1/15 of a 30-person band. A six-person party does not produce a residential footprint. |
| C — separate residence pressure from party overlap | REJECTED | A new narrower authority would duplicate the distance/same-patch semantics already present, and nothing yet consumes a party-specific overlap distinct from bodies. |
| E — daily ephemeral presence ledger | **DEFERRED, and named as the seam** | This is what same-day task parties need. Production keeps no simultaneous daily presence snapshot, and building one is a separate checkpoint. |
| F — use recent trip records as current presence | REJECTED | A completed trip is history, not proof anyone is still there. `getBandPhysicalPresence` contains no reference to `recentIntraSeasonTrips` at all, which makes P17 structural. |

## Semantics

- **Phase truth, not phase names.** `prepared` means "labor committed at camp, NOT yet departed"
  (`types.ts:933`), so a prepared party is physically **at home** and is not subtracted. Note that
  `isExpeditionAway` counts `prepared` as away for **labour** — the two questions are different and
  are answered differently. Measured `preparedDays: 0`: the phase never survives to a day boundary.
- **Terminal phases hold nothing.** `completed`, `aborted` and `lost` contribute no body anywhere,
  so a lost party leaves no immortal presence.
- **People are conserved.** `residentialRemainder + Σ partyWorkers = population`, exactly, asserted
  every band-day (P22, 0 failures).
- **A band's own party is not a foreigner.** The field stores one weight per band per tile, so the
  existing self-exclusion removes the band's own away party from its own reading (P12, 0 cases).
- **Daily, not seasonal.** Physical presence is a daily fact. A seasonal probe measured **0** parties
  beyond `CROWDING_RADIUS`; daily sampling measures **60.9%**.

## What was deliberately NOT changed

- **`getBandForagingDraw` still uses full `demography.workingAdults`**, so away workers keep drawing
  the residential catchment while also consuming provisions and harvesting at the target. This was
  measured (226 band-seasons) and is understood, but §11.7 forbids rewriting the catchment without
  proof that it is an accounting defect rather than legitimate central-place organisation. It is
  **named as the next seam**, not fixed here.
- Same-day task parties (Option E).
- No encounter, friction or access authority reads the new presence set — co-presence is exposed,
  perception is not invented (§12.2).

---

## CORRECTION-34A amendment — Option E is not merely deferred, it is non-actionable

The table above deferred Option E (a daily ephemeral presence ledger) as "a separate checkpoint".
CORRECTION-34A audited whether it could be built at all and found a stronger result: **there is no
within-day consumer of physical presence in production**, so such a ledger would have no reader.

- `runDailyActions` builds no `TickContextCache`; every `buildTickContextCache` call site is inside
  `runSeasonalCompatibilityTick`.
- `intraSeasonTrips.ts` and `expedition.ts` reference `crowding` / `nearbyBand` / `TickContextCache`
  **zero times**.
- A same-day party never exists at a season boundary: it is created, acts and returns inside one
  synchronous `applyTripDay`.

A day-scoped ledger would therefore be **empty at every instant its only consumer runs** — the
state-field-nobody-reads pattern §3.2 and §18.1 forbid. Making it live requires moving the
shared-use substrate to a daily cadence, which the checkpoint scope excludes.

**Under the supervisor scope amendment, same-day current presence is formally removed from
CORRECTION-34's acceptance requirements** and deferred to the future daily mobility /
party-overlap / encounter architecture. Same-day trips remain physically real through labor, route,
target, depletion, result and return. No dead ledger was introduced. See
`SAME_DAY_PRESENCE_SEAM.md` for the missing consumer, why completed trip history cannot represent
current bodies, the six requirements of the future authority, and the roadmap entry.

---

## CORRECTION-34B — partial reconciliation: Option B, one authority

Supervising review found that CORRECTION-34A's reconciliation reduced `partyWorkers` alone.
Reproduced before any change: **`PARTIAL RECONCILIATION SPLIT AUTHORITY`**, with residential effort
adults reading **−1**.

| Option | Decision |
| --- | --- |
| A — whole-party cancellation only | Rejected: destroying a six-person party because the band lost one adult is disproportionate, and discards cargo and information with it. |
| **B — canonical deterministic partial reconciliation** | **SELECTED.** Workers, composition, carry ceiling and cargo move together in one function. |
| C — protect away commitments upstream in demography/fission | **Deferred, and recorded as architecturally superior.** It requires demography to own away-worker accounting — a demographic-ownership change beyond a presence correction. Not refuted. |
| D — return/abort instead of resizing | Rejected: turning a party for home requires the residential band to know something it has no channel to learn (CORRECTION-30 established there is no communication authority). |
| E — another design | Not required. |

**Removal order is high → typical → limited**, under the rule that *reconciliation may never improve
a party's capability*: `derivePartyPaceFactor = 1 + (high*0.15 − limited*0.20)/total`, so dropping
`limited` members would make a party that just lost people move faster.

**Cargo above the reduced ceiling is abandoned to `lostUnits`**, with `harvest + lost` invariant and
capacity wrapped in `Math.min` so it can never rise. No transport aid is granted.

**One new outcome reason, `commitment_unsupported`**, for a `prepared` party only — every existing
reason describes something that happened on a journey, and a prepared party has none. Its people are
at camp and must not be declared lost.

**The aggregate-model limit is stated, not hidden:** cohorts have no individual identity, so a
workforce decline cannot reveal who was lost. The removal order is a deterministic accounting
convention chosen for monotonicity, not an anthropological claim.

---

## CORRECTION-34C — away-body ownership: Option A, minimal

34B bounded the party by `workingAdults`. That is labour, not bodies, and it falls on ordinary
aging — reproduced as `COHORT AGING TELEPORTS AWAY BODY`.

| Option | Decision |
| --- | --- |
| **A — protect away people upstream** | **SELECTED, minimal form.** Fission draws only from physically residential people; cohort reclassification never touches a party; the headcount bound is population. |
| B — party people as new state distinct from party workers | Rejected here. The distinction is now *expressed* (headcount ← population, labour ← workingAdults) without adding a party-cohort model, which is Item 4 scope. |
| C — suspend cohort/fission while parties are away | Rejected: coarse, and freezing demography because one small party exists is a hidden behavioural artifact. |
| D — allocate demographic change by location | Rejected for now: needs party age cohorts, i.e. individual-ish structure this checkpoint must not invent. |

Three changes: the reconciler bounds on `population`; `createDaughterBand` caps the daughter by
residential availability and blocks below `DAUGHTER_MIN_POPULATION`; `getBandForagingDraw` removes
the aged-away overflow from elders so an away person who aged stops contributing local effort.

**Roadmap Item 4 remains unstarted.** This set only the ownership boundary.

---

## CORRECTION-34E — target-work labour: Option A, at the seam that already knows the party

### The choice

| Option | Verdict |
| --- | --- |
| **A — an explicit productive-group-size input at the existing record-building seam, required, no default** | **SELECTED** |
| B — make `estimateTaskGroupPeople` expedition-aware | REJECTED. It is a residential authority answering a residential question; teaching it about parties would give one function two incompatible meanings and put the branch further from the caller that knows the answer. |
| C — hand `buildTripRecord` a synthetic band whose `workingAdults` equals the party | REJECTED. It fabricates demography that does not exist, and every other field read off that band (dependents, adaptation, memory, position) would silently be a lie too. |
| D — scale the resulting cargo after the fact | REJECTED. The stock is removed inside the resolver, so a post-hoc scale would leave the record, the depletion and the cargo describing three different amounts of work — exactly the split CORRECTION-34B closed elsewhere. |
| E — a second harvest resolver for expeditions | REJECTED. There must remain exactly one physical harvest equation. |

### Why the parameter is required rather than optional

An optional `partyWorkers` with a residential fallback would keep the defect one forgotten argument
away, and the fallback would be invisible in review. Making it required converts the invariant from
something tests check into something the type system and the runtime refuse to violate: an
expedition that cannot say how many of its people are working cannot resolve work at all.

### Why no floor of one on the party branch

`estimateTaskGroupPeople` ends in `Math.max(1, ...)` because a residence always has somebody in it.
A party does not: reconciliation can reduce its productive labour to zero while its bodies stay at
the target. Importing that floor would let a party with no working members still request a person's
work — the same class of error, in the other direction.

### What was deliberately NOT changed

- The harvest equation `estimatedPeopleCount * 0.035 + yieldConfidence * 0.22 + presenceConfidence * 0.08`.
  The AUTHORITY was wrong; the STRENGTH is untested and was left alone.
- The same-day residential path, including its floor and its task-group shares.
- `resolvePhysicalFoodHarvest`, which stays labour-blind by design so that one equation removes stock.
- Carrying, provisions, pace, presence and fission — all settled by CORRECTION-34D and untouched.
- Who *within* a party does the work. A party remains an aggregate; skill, age and injury inside it
  need the future individual/household layer.
