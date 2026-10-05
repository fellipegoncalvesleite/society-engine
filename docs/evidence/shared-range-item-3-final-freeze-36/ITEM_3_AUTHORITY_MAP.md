# Roadmap Item 3 — authority map at the candidate freeze head

Candidate freeze head `706166892d40189fc56ac7458b9e90a8ffdbddd7`.

One question per row: **what fact does a band act on, who is allowed to write it, and what would be
a lie?** Every authority below was read from production on this tree, not from documentation.

---

## The chain, stage by stage

| # | Stage | Canonical authority | Written by | Read by | The lie it forbids |
|---|---|---|---|---|---|
| 1 | **physical co-presence** | `crowding.getBandPhysicalPresence` — residential remainder at `band.position` plus one bounded body group per physically-away party at its own `positionTileId` | daily reconciliation in `expedition.ts` | crowding field, cache-less scan, conservation audits | a party three days' walk away being projected at home, or standing nowhere |
| 2 | **crowding** | `crowdingPenalty`, the single decision-facing cost at `CROWDING_DECISION_COST_WEIGHT = 0.96` | `crowding.ts` from **current physical proximity only** | `pressure.ts` once, exploration boost once | a remembered place creating physical crowding (closed by CORRECTION-28) |
| 3 | **encounter opportunity** | `socialContext.getEncounterCandidatePairs` + `getEncounterKind`, gated on `distance <= 3` | co-presence | contact memory, encounter records | two bands meeting because their private place memories happened to name one tile (closed by CORRECTION-29) |
| 4 | **attributable friction** | `RangeFrictionEvent` in `band.recentRangeFrictionEvents`, requiring the other band in the observer's **current proximity set** | `rangeFriction.ts` | access norms, inner fission, outgoing reports | reading another band's private position or trip list as evidence (closed by CORRECTION-30) |
| 5 | **remembered access expectation** | `ProtoAccessMemory`, **recomputed every tick, stored nowhere** | `accessNorms.deriveAccessMemory` from the band's OWN held records | `pressure.ts` (five decision inputs) | an expectation read off a live census rather than off held records |
| 6 | **cooling and release** | `activeEvidenceWeight` / `activeEvidenceCount` / `historicalEvidenceCount` / `socialEvidencePhase` | derived from `contributingEvidence = weight > 0` | read model, audits | **a record labelled historical while still moving behaviour (closed by CORRECTION-35)** |
| 7 | **decision pressure** | `pressureState.mobilityPressure` → `netMovePressure` → candidate scores | `pressure.ts` | `bandDecision.ts` | one physical fact charged under several names (closed by CORRECTION-32) |
| 8 | **residential extraction** | `sharedCatchment.getBandForagingFootprint`, anchored on `residentialAnchor.catchmentTileIds` | residence | carrying capacity, shared-catchment index | away workers foraging at home while also harvesting away (closed by CORRECTION-34A) |
| 9 | **expeditionary presence** | `ExpeditionRecord.partyWorkers` + `nonWorkingPartyPeople`, physical headcount **derived** as their sum | `bandMobility` | presence, pace, carrying, provisioning | productive labour and bodies being one number (closed by CORRECTION-34D) |
| 10 | **productive target work** | `getExpeditionProductiveWorkers`, a **required positive integer** | the party itself | `resolveExpeditionTargetWork` | people at home deciding distant work (34E); nobody doing a day's work (34F) |
| 11 | **physical cargo and return** | `physicalFoodHarvest` → cargo → `seasonalFoodReceipts` | `intraSeasonTrips.ts`, `expedition.ts` | human food support | support credited before the party physically returns |
| 12 | **historical persistence** | retained friction records, contact memories, encounter records, place memory | never deleted on release | inspection and future re-earning | release implemented as deletion |

---

## What creates social movement pressure — the complete list

Exactly three, each with lived provenance:

1. **`crowdingPenalty`** — another band is physically within `CROWDING_RADIUS` now.
2. **`recentRangeFrictionEvents`** — this band witnessed something, at a place, at a time, and the
   record names the episode.
3. **`protoAccessMemory`** — what this band expects at a place, derived from the records it holds,
   with a lifecycle that cools and releases.

**Nothing else.** Certified on this tree by `B3`: with zero social evidence the access channel
contributes exactly zero, while fresh friction and real physical crowding both still fire.

---

## Territorial authority — three names, zero live readers

| name | status |
|---|---|
| `Band.territorialPressure` | **behaviourally inert.** Written at spawn (`0.12`) and daughter creation (`clamp01(parent * 0.72 + 0.04)`). Retained in state, the decision-context snapshot and the UI projection. Its three former readers — `pressure.ts` ×0.08, `mobilityIntent.ts` ×0.12, `bandDecision.ts` ×0.14 — were removed by CORRECTION-35. |
| `SocialPressureProfile.territorialPressure` | **never had a reader.** `0.08` at spawn, carried forward by a spread. A different field from the one above, and the differing constants are themselves proof they were never one authority. Carried-forward seam 5. |
| `Reason<"territorial_pressure">` | **declared with zero producers.** `rules/types.ts:1291` declares the reason type; `grep` over `src/` finds only the declaration. **Found by this audit** and recorded so a future system cannot wire it up by accident. |

Certified by `B1` (varying the field across `0 / 0.12 / 0.8` moves nothing across eighteen
band-measurements), `B2` (the field enters no arithmetic or conditional expression anywhere; the
seven surviving sites are four record copies/declarations, two constant writers and one daughter
writer) and `B4` (no reason names territory and no reported pressure varies with the field).

**A future cultural or institutional territoriality must arrive with its own lived writer.** All
three names are available to claim; none may be re-attached to behaviour without one.

---

## Anti-omniscience boundary

| a band may read | a band may not read |
|---|---|
| its own observations and place memory | any other band's `placeMemory`, `position` or `recentIntraSeasonTrips` |
| its own friction ring | the world's band count or roster |
| reports it has received, weighted by hops and freshness | hidden stock, other bands' knowledge |
| current physical proximity within the canonical radius | anything beyond it |

Certified on this tree by `I2`, `I4` and `I12`: fifteen remote records of five kinds leave the
focal reading byte-identical, and deleting the other band from the world entirely leaves a held
expectation unchanged — it is read off records, not off a census.

---

## Deliberately deferred, with the seam preserved

- **same-day party current presence** — no within-day consumer exists; `runDailyActions` builds no
  `TickContextCache`. Formally descoped by CORRECTION-34A; the seam is documented, and no dead
  ledger was introduced.
- **the public Day/Season simplification** — deferred and unimplemented. All four internal step
  modes are retained as batch sizes over the same daily kernel, never as alternate behaviour.
