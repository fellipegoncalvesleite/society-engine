# CORRECTION-31 — the lifecycle model, as implemented

Every phase below is **derived** from evidence age, provenance and the observer's own presence.
Nothing here is a stored state machine, and no constant listed in `authority-ledger.md` §6 was
changed. 1 tick = 1 season, 4 ticks = 1 year.

---

## 1. The states, and what each means

`ProtoAccessSocialEvidencePhase` (`types.ts`) is a **description**, recomputed every tick by
`accessNorms.deriveAccessMemory`, never written as an authority:

| phase | meaning | how it is reached |
| --- | --- | --- |
| `none` | the band holds no friction evidence about this place | no records at this tile |
| `active` | the freshest episode is inside the current annual round | freshest evidence ≤ 3 ticks old |
| `cooling` | evidence still counts, but is losing influence with age | past the fresh window, before the release horizon |
| `released_historical` | records are still held and no longer move any behaviour | every record at this place weighs below 0.05 |

Alongside it: `activeEvidenceWeight` (0–1, the strongest surviving episode),
`activeEvidenceCount`, `historicalEvidenceCount`, and `presentWithoutOthersSeasons`.

---

## 2. Creation

A record is written by `rangeFriction.advanceRangeFriction` — the only production writer —
through the two channels CORRECTION-30 left standing:

- **contemporary direct observation**: the other band is inside the observer's current
  proximity set (`cache.nearbyBandsByBandId`, radius 4) and the place is in the observer's own
  familiar country. Stamped `confidence: "observed"`, `tick: now`.
- **second-hand report**: a friction-topic `WordOfMouthReport` received from another band about
  a tile in familiar country. Stamped `confidence: "reported_secondhand"`, and — new in this
  checkpoint — **`tick: report.tickReceived`**, so it ages from when the band heard it.

A physical trace or smoke channel would attach here. Neither exists; neither was invented.

---

## 3. Reinforcement, and what does not count as reinforcement

| repetition | treated as | why |
| --- | --- | --- |
| the same band observed again at the same place | **new evidence** — a new record at age 0 | a fresh sighting is a fresh fact |
| the same band observed again elsewhere in the observer's range | new evidence at **that** place; raises `recentOverlapCount`, which is **pair-wide** | "they keep turning up in my country" is a real impression |
| a second report from a **different** original observer | **independent** — a separate record | different witnesses are different evidence |
| further relayed copies of the **same** original episode | **one record**, keyed on `(originalObserverBandId, topic, targetTileId)` | three people repeating one story is one story |
| more hops on the same story | **weaker**, ×(1 − 0.2·(hops−1)) | each retelling degrades independence and accuracy |

Place scoping is enforced by `collectTileFrictionEvidence` filtering on `event.tileId`, so
pair-wide recurrence never moves a place the pair was not seen at (fixture P8).

---

## 4. Saturation

`recentOverlapCount` is `1 + countObserverNoticesOfBand`, bounded by the 8-slot ring, so it
cannot exceed **9**; `recurrenceCount` is bounded by the same ring; `eventPressure` caps its
overlap term at 0.24. **Measured:** both the one-season and the ten-season contact arms reach
the cap of 9 (fixture P2), so ten times the contact produces no further escalation at all.
Saturation is demonstrated; "longer contact persists measurably longer" is **not**, because the
counter has no headroom left to express it. That ceiling predates this checkpoint.

---

## 5. Evidence loss and cooling

`socialEvidenceAgeWeight(age, release)` — full inside the fresh window, then a straight line to
zero:

```text
weight = 1                                        age <= 3
       = (release - age) / (release - 3)          3 < age < release
       = 0                                        age >= release
       = 0                                        age < 0   (a record stamped in the future is not evidence)
```

Release horizons, by provenance and tone:

| evidence | release | justification |
| --- | ---: | --- |
| direct, kin or tolerated (`tolerated_kin_presence`, `noticed_shared_use`, kin relation) | **8 ticks (2 y)** | Peterson: access is normally granted, so a peaceful episode's residue is recognition, not caution |
| direct, neutral | **12 ticks (3 y)** | three complete annual cycles with no re-sighting, in a band actively working its own range |
| direct, tense (`mild`/`moderate_placeholder` with a stranger or weak-contact relation) | **16 ticks (4 y)** | an unpleasant episode is remembered as being about people; still bounded |
| second-hand report | **16 ticks**, ×0.7 cap, ×hop factor, ×the report's own `freshness` | hearsay is weaker per unit but stickier (Lewandowsky/Ecker on continued influence; Whallon on visiting), and the report's existing decay is wired in rather than given a second clock |

The **fresh window is one year for every class**, because seasonal dispersal and re-aggregation
make the annual round the natural unit of "still current" (Mauss).

**Confidence now counts only active evidence.** Before, `confidence` counted retained records,
and `classifyAccessState` needs confidence below 0.36 before `staleness` can mark a memory
stale — so held evidence propped up the confidence that would have retired it, and an episode
could grow *more* severe after the other band left. That loop is closed.

---

## 6. Contradiction

One channel, and only one, because only one is supportable:

```text
the observer is standing at the place
AND band.pressureState.nearbyBandPressure === 0   (the proximity-only crowding scalar)
-> presentWithoutOthersSeasons += 1, capped at 8
-> every episode about that place counts as 2 ticks older per season of that
```

It proves only that nobody is here now. It creates no knowledge of where the other band went,
and it is unavailable to a band that has not gone there (§10.6, §10.7). **Measured:** release
at season 6 with the contradiction against season 8 without (fixture P4).

`observed_departure` and `credible_move_report` were **rejected as unrepresentable** — there is
no positional history and no band-movement report topic. Fixture P5 records that rather than
fabricating it.

---

## 7. Behavioural release

Below weight 0.05 an episode contributes nothing to `sharedUsePressure`, `strangerCaution`,
`rememberedRefusalAvoidance`, `rememberedCooperationTolerance`, `kinTolerance`,
`familiarTolerance` or `placeSensitivity`, and therefore nothing to
`ProtoAccessBehaviorEffectState` or to the five decision inputs `pressure.ts:161-166` consumes.

It also stops being **broadcast**: `reportedKnowledge.ts:648` now republishes only friction that
is still active *and* is not itself report-derived, which is what stops a released belief
re-entering circulation and returning as somebody else's fresh warning.

---

## 8. Historical retention — what survives release

| survives | authority |
| --- | --- |
| the friction record itself, to the existing 48-tick eviction | `Band.recentRangeFrictionEvents` |
| that the other band is known, and how contact went | `Band.contactMemories` — never decays, and carries **no position** |
| the place, its familiarity and its attachment | `Band.placeMemory` |
| avoidance for **non-social** reasons — `avoid_place`/`risky` valences, death memory | the unweighted terms of `rememberedRefusalAvoidance` |
| chronicle and event history | `bandChronicle`, `bandEvents` |

**Measured:** contact memory and place memory are held across release in every timeline
(fixtures P17, P1, P10, P11), and an `avoid_place` valence still produces avoidance 40 ticks
after the social episode has released (fixture P15).

---

## 9. Reactivation

No special case exists, and that is deliberate: fresh evidence is age 0, therefore weight 1.
A returning band is detected by the ordinary proximity gate, identified immediately if contact
memory survives, and interpreted through whatever relation that memory carries.

Nothing can anticipate a return: the observer has no channel that reads another band's
position. **Measured:** reactivation both while cooling (P6) and after full release (P7), with
no change in any season before the return.

---

## 10. Transformation, and what is deliberately not built

Repeated tolerated use leaves `rememberedCooperationTolerance` and a `kin_tolerated` /
`tolerated_shared_use` access state rather than suspicion, and a released place returns to
`familiar_use` — so "contested place → formerly shared place → familiar place with historical
social memory" is expressible. `socialEvidencePhase` gives a later culture, trail or tenure
system somewhere to attach.

**No culture, ownership, territory, law, conflict or expulsion is implemented here**, and none
of the research is used to justify any of them.

---

## 11. Forgetting and compression

Three distinct fates, all already bounded:

| fate | mechanism |
| --- | --- |
| **not behaviour-active** | weight below 0.05 — the record remains |
| **forgotten by this band** | ring eviction at 48 ticks; access-memory eviction at 8 places; report ring at 16, `REPORT_MAX_AGE_TICKS` 160 |
| **retained as compressed history** | `bandChronicle` / `bandEvents` / `deepHistory`, untouched here |

No new store, no pair-place ledger, no per-day positional archive. **Measured over 80 further
seasons:** ring ≤ 8, reports ≤ 16, access places ≤ 8, zero negative ages (fixture P22).
