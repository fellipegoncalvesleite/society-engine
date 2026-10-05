# CORRECTION-31 — architecture decision

**Decision: Option A + Option C + a bounded Option D, implemented as a derived weighting layer
with no new stored state. Options B and E rejected.**

> Social evidence gains an **age** and a **provenance-specific influence curve**. The records,
> the contact memory and the place memory are all retained exactly as they are; what changes is
> that an old episode stops *counting*. Report-linked friction is stamped with the report's own
> receipt tick so it ages like everything else instead of being reminted fresh every tick, and
> several relayed copies of one episode count as one. The one contradiction channel the
> repository can honestly support — the observer standing at the place with nobody nearby —
> cools it faster.

Written after `authority-ledger.md` and `RESEARCH_AND_CAUSAL_MODEL.md`.

---

## 1. The fact that decides the architecture

**`ProtoAccessMemory` stores nothing.** `advanceProtoAccessMemory` (`accessNorms.ts:46`)
recomputes every field from scratch each tick out of place memory, proto-camp memory, friction
records, reports and visible signals. The prior state is consulted only for `staleYears`
smoothing and the dropped-count tally.

That means a lifecycle does **not** need a new store. Creation, reinforcement, cooling,
release and reactivation are all expressible as *how the inputs are weighted*, and the
"historical" layer already exists — it is the retained record that no longer carries weight.

---

## 2. Options compared

### Option A — provenance-specific age weighting — **ADOPTED as the core**

Replace the binary `age <= FRICTION_RECENT_WINDOW_TICKS` inclusion with a continuous influence
curve over age, provenance, tone and contradiction.

- **For:** it is exactly where the defect is. `authority-ledger.md` §2 shows **every** one of the
  six friction→pressure functions reads only fields stamped at creation and **none** reads
  `event.tick`. Age is currently invisible; making it visible is the repair.
- **For:** it needs no new state, no new writer, no daughter-inheritance question, no
  boundedness question.
- **Against, and answered:** on its own it does not *represent* the difference between "current
  expectation" and "historical memory" — it only makes the second weak. That is what Option C
  adds.

### Option B — an explicit pair/place lifecycle state machine — **REJECTED**

A stored `active | cooling | uncertain | released | historical | reactivated` keyed by
(observer, other band, place).

- **Against — duplication.** It would restate what `recentRangeFrictionEvents` +
  `contactMemories` + `placeMemory` already hold. `ProtoAccessMemory` is *already* the
  per-place derived view; a second per-pair-per-place store is a fifth home for the same facts,
  the exact anti-pattern CORRECTION-28 rejected when it refused a typed second crowding channel.
- **Against — boundedness.** Pair × place is quadratic in the thing this repository is most
  careful about. §10.15 forbids an unbounded ledger, and every bound I could pick (cap by
  recency? by importance?) would itself be an unjustified policy.
- **Against — writer authority.** It would need a new writer in the tick chain and a daughter
  inheritance rule, neither of which the evidence requires.
- **Against — the state names are not observable.** "Cooling" is not something a band knows; it
  is an analyst's description of a declining weight. Storing it would reify a description.
- The checkpoint itself warns (§3) not to adopt the listed names automatically. They are
  **derived and reported** instead (§4 below), so every semantic distinction §3 asks for is
  representable and testable without being stored.

### Option C — separate active expectation from historical memory — **ADOPTED, as derivation**

- **For:** it is the cleanest causal boundary and it is what §10.5 requires — release without
  deletion.
- **Implemented as:** four read-only derived fields on `ProtoAccessMemory`
  (`activeEvidenceWeight`, `activeEvidenceCount`, `historicalEvidenceCount`,
  `socialEvidencePhase`) plus the rule that **only weighted evidence feeds the pressure
  scalars**, while the records themselves stay in the ring until the existing 48-tick eviction.
  The band's memory is unchanged; only its influence is gated.

### Option D — explicit contradiction / supersession evidence — **ADOPTED in one bounded form**

Of the three candidate events §9 names:

| candidate | verdict |
| --- | --- |
| `revisited_without_presence` | **ADOPTED.** Fully supported today: `deriveAccessMemory` already knows `current = tileId === band.position`, and `band.pressureState.nearbyBandPressure` is the post-CORRECTION-28 **proximity-only** crowding scalar, so "I am standing here and nobody is within the proximity radius" is a real, band-known local observation. |
| `observed_departure` | **REJECTED — cannot be represented truthfully.** There is no per-day positional history and no event for "the other band left"; a band would have to compare two hidden positions. §9 says do not invent this. Recorded in `FINDINGS.md` as the reason fixture **P5 is not fabricated**. |
| `credible_move_report` | **REJECTED — no such topic exists.** `ReportedKnowledgeTopic` has no "band moved" member, and inventing one would mean inventing knowledge of where they went, which §9 forbids explicitly. |

The adopted form proves nothing about where the other group went (§10.6) and is available only
when the observer is actually there (§10.7).

### Option E — a shorter fixed expiration — **REJECTED**

Changing `48` to a smaller number does not model a lifecycle: it moves the cliff. It would
still give full pressure up to the cliff, still let a record defend its own confidence, still
leave report-linked friction immortal, and still make no distinction between a tolerated kin
episode and a tense stranger one. **No constant in `authority-ledger.md` §6 is changed by this
checkpoint.**

### Option F — other inspected designs considered and dropped

- **Decay `RangeFrictionEvent` in place** (mutate tension downward each tick). Rejected: it
  destroys the historical record, breaking §10.5, and makes the event id unstable.
- **Move the lifecycle into `rangeFriction.ts`** (emit pre-weighted events). Rejected: the
  weight depends on the *reader's* context (which place, whether the observer is standing
  there), so it belongs at the read seam, not the write seam — the same reasoning
  CORRECTION-16's admissibility rules apply to derived fields.

---

## 3. The three production changes

### 3.1 `accessNorms.ts` — the weighting layer

- `collectTileFrictionEvents` returns `WeightedFrictionEvidence[]`: the event, its age, its
  provenance class, its episode key, and a weight in `[0,1]`.
- **Weight curve** (`socialEvidenceWeight`): full inside the *fresh* horizon, then a smooth
  cosine-free linear decline to zero at the *release* horizon. Horizons are provenance- and
  tone-specific (§4).
- All six conversion functions (`eventPressure`, `strongestFrictionRelation`,
  `tensionFromFriction`, `cooperationFromFriction`, `avoidanceFromFriction`,
  `bestContactTolerance`) multiply their contribution by the weight.
- **`confidence` counts only active evidence.** This closes the self-defence loop
  (`authority-ledger.md` §2): retained records currently prop up the confidence that would
  otherwise let `staleness` classify them stale.
- **Reports are counted by distinct episode and weighted by their own `freshness`**, not by
  `.length` (§10.9).
- Four derived read-only fields expose the lifecycle.

### 3.2 `rangeFriction.ts` — report-linked events must age

- `deriveReportLinkedEvents` stamps `tick: report.tickReceived` instead of `world.time.tick`,
  and `makeEventId` uses that tick. The id therefore becomes **stable across ticks**, so
  `mergeEventRing` refreshes one record in place instead of minting a new one every tick, and
  the 48-tick eviction finally applies to it.
- Report-linked events are **deduplicated by episode** — `(originalObserverBandId ??
  sourceBandId, topic, targetTileId)`, the triple that survives relay
  (`reportedKnowledge.ts:1027`) — so five relayed copies of one story produce one record.
- Nothing else in that function changes: the self-report exclusion, the trust basis, the
  `reported_secondhand` classification and the relation derivation are untouched.

### 3.3 `reportedKnowledge.ts` — stop laundering rumour as observation

`buildInternalFacts` (`:648`) republishes the observer's top-3 friction events as
`outsider_use_warning` / `crowded_water_warning`. Two filters are added:

- skip events that are themselves **report-derived** (`linkedReportId !== undefined`) — a band
  must not retell a rumour as its own knowledge, which is what closes the
  friction → report → friction → report cycle (`authority-ledger.md` §4);
- skip events that are **no longer behaviourally active** — a released belief is not current
  news.

The reporting system is otherwise untouched (§10.10).

---

## 4. The lifecycle horizons, and why

1 tick = 1 season, 4 ticks = 1 year.

| provenance / tone | fresh (full weight) | released (zero weight) | justification |
| --- | ---: | ---: | --- |
| direct observation, tolerated or kin | 3 ticks | **8** (2 y) | Peterson: access is normally granted, so a peaceful episode's residue is recognition, not caution |
| direct observation, neutral | 3 ticks | **12** (3 y) | three complete annual cycles with no re-sighting, in a band actively working its own range |
| direct observation, tense (`mild` / `moderate_placeholder` with a non-kin relation) | 3 ticks | **16** (4 y) | §10.13/§10.14: an unpleasant episode is remembered as being about people; still bounded |
| second-hand report | 3 ticks | **the report's own `freshness`**, ×0.7 cap | the report already decays over `REPORT_MAX_AGE_TICKS`; wiring that in rather than inventing a second clock. The 0.7 cap keeps hearsay below first-hand |
| observer present, nobody nearby | — | halves the remaining weight per season | the one contradiction channel that exists (§Option D) |

**The fresh window is one year (3 ticks + the current one) for every class**, because Mauss's
seasonal cycle makes the annual round the natural unit of "still current".

**The ring keeps records to 48 ticks regardless.** Release is behavioural, not amnesic.

---

## 5. How the decision answers §9's required questions

- **Why the state comes into being:** a legitimate channel produced evidence — proximity
  observation, encounter (subsumed by proximity, CORRECTION-30) or a received report.
- **What sustains it:** fresh evidence about the same band, resetting age to 0. Recurrence and
  overlap counts, already bounded by the 8-slot ring, set its initial strength.
- **What weakens it:** age alone, through the weight curve.
- **What contradicts it:** being at the place with nobody within the proximity radius.
- **What remains after release:** the friction record itself (to 48 ticks), the contact memory
  (permanently), the place memory, the attachment, the chronicle. Only the weight is gone.
- **How fresh evidence reactivates it:** a new observation is age 0 and therefore full weight;
  no special case is needed, which is why reactivation cannot be forgotten.
- **How it connects to later systems:** `socialEvidencePhase` gives trails, camps, culture and
  territorial norms a place to attach — a place with long tolerated recurrence is
  distinguishable from one with a single tense episode — **without any of them being built
  here**.

---

## 6. Scope

Three production files: `accessNorms.ts`, `rangeFriction.ts`, `reportedKnowledge.ts`, plus
four derived optional fields on `ProtoAccessMemory` in `types.ts`.

**Not touched:** physical crowding, shared catchment, depletion, use pressure, the report
transfer/relay system, encounters, contact memory, place memory, memory compression, kin
weights, `territorialPressure`, fission, mobility, settlement — and **no constant listed in
`authority-ledger.md` §6**.

---

## 7. Predictions, stated before measurement

- AUDIT-27 C5 should stop reading `PHYSICAL_RELEASES_PERCEPTION_DOES_NOT`.
- Retained friction record counts should be roughly **unchanged** (the ring is untouched) while
  their behavioural influence falls to zero on the horizons above.
- Report-linked friction records should **fall sharply** in a long run — one per episode rather
  than one per tick — and should now expire.
- Access pressure should fall, most visibly at long horizons.
- Physical crowding, catchment, depletion, support and trips should be **unchanged** in any
  world where the pressure change does not alter a decision.
- Some behavioural drift is expected through `pressure.ts:161` and is to be measured, not
  suppressed.
