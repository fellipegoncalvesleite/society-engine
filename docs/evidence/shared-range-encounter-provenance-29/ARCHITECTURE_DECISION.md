# CORRECTION-29 — ARCHITECTURE DECISION

Branch `checkpoint/shared-range-encounter-provenance-29`, from the accepted CORRECTION-28 tip
`c5eb58a8f5ff7054665f9c376ac4ca856403efab`.

**Decision: Option C**, whose production edit is identical to Option A. Option B is deferred to a
later checkpoint; Option D is not needed.

---

## 1. Where private memory becomes asserted direct contact

Traced through current code. The whole ghost chain lives in `socialContext.ts`, and it passes
through **two independent gates**, either of which alone is sufficient to produce a false
encounter.

**Gate 1 — candidacy.** `getEncounterCandidatePairs` (`socialContext.ts:1932-1986`) builds pairs
from two sources:

```ts
// (a) legitimate: current proximity <= 4, via cache.nearbyBandsByBandId
for (const nearbyId of getLocalEncounterCandidateIds(world, cache, band)) { … }

// (b) the defect: any two bands naming the same top return place, NO distance condition
for (const tileId of summary.topReturnPlaceIds.slice(0, 12)) { … }
for (const bandIds of memoryTileBands.values()) { /* pair them all */ }
```

**Gate 2 — admission.** `getEncounterKind` (`socialContext.ts:1718-1746`) distance-gates every
branch at `<= 3` **except one**:

```ts
if (memoryOverlap > 0.24 || distance <= 3) { … }   // admits ANY distance
```

and `memoryOverlap` comes from `getSharedMemoryOverlap` (`socialContext.ts:1774-1803`), which
reads **the other band's private `placeMemory` directly** — the omniscient read itself.

**The first point at which coincidence becomes asserted contact is Gate 1(b)**; Gate 2 is what
lets it survive `detectEncounter`. Both must close, or the repair is a half-state.

**What the false record then does.** `applyEncounterToBand` (`socialContext.ts:1134-1166`) is the
**only** production writer of `contactMemories` and `encounterRecords` outside spawn and fission
initialization. It calls `updateContactMemory`, which increments `contactCount`, stamps
`lastContactAt`, sets `firstContactAt` on the first one, and raises `familiarity` — a full direct
contact.

**And the record does not stay put.** `rangeFriction.deriveCandidateBands` (`rangeFriction.ts:478`)
adds **every band id in `observer.contactMemories`** to the friction candidate set, with no
distance condition. So one ghost contact makes a band 44 tiles away a permanent range-friction
candidate. `reportedKnowledge` and `accessNorms` read contact memories as well.

**This is why the repair belongs at the encounter gates and nowhere else:** closing them stops the
cascade at its source, so `rangeFriction.ts` needs no edit at all. §8 permits touching its
provenance only "where strictly necessary," and it is not necessary.

---

## 2. Options compared

### Option A — strict current-distance gate

Require current positions inside an encounter radius for direct-encounter candidacy.

| axis | assessment |
| --- | --- |
| would legitimate route/work encounters be lost? | **No — because production has none.** Every branch of `getEncounterKind` other than the memory disjunct is already distance-gated at `<= 3`. There is no route-encounter, work-party-encounter or shared-resource-visit authority anywhere in production; AUDIT-27 established that trips and expeditions feed no shared-use authority at all. Nothing physical is carried exclusively by the memory disjunct. |
| consistency with existing encounter kinds | **high.** `same_tile` (0), `adjacent_contact` (1), `parent_daughter_overlap` (≤3), `sibling_overlap` (≤3) and the unrelated/shared branch (≤3) all already speak distance. Removing the disjunct makes the function uniformly distance-based. |
| does the radius duplicate another authority? | **No new radius is introduced.** Candidacy already uses `cache.nearbyBandsByBandId` at distance ≤ 4, and admission already uses ≤ 3. The repair *deletes* conditions; it adds none. |

### Option B — current physical-contact evidence

Admit candidacy from current proximity **plus** real physical activity evidence — same-day trips,
expeditions, camp presence, route overlap — where that evidence genuinely proves possible contact.

**Deferred, not rejected on merit.** It is the right long-term shape, and it is exactly the
"physical shared-use substrate" AUDIT-27 recommended as its own checkpoint. It cannot be done here:

1. §8 explicitly excludes same-day trip overlap, expedition overlap and investigation-route overlap
   from this checkpoint.
2. AUDIT-27 measured that no crowding or shared-use authority reads `recentIntraSeasonTrips` or
   expedition routes today. Wiring them into encounters would be new substrate, not a provenance
   repair.
3. It would **add** encounters. This checkpoint's job is to stop asserting contact that did not
   happen, not to discover contact that production currently misses. Mixing the two would make the
   before/after proof unreadable — a rise in encounters could be either the new evidence path or a
   failure to close the ghost path.
4. Update-phase ordering would need its own analysis: `applyEncounterContext` runs inside
   `updateBandContextStates` before `advanceRangeFriction`, and trip records are written in the
   daily phase, so "could this band have observed that one" is a real question requiring its own
   evidence.

Recorded as the natural successor.

### Option C — split direct encounter from social-range recognition — **SELECTED**

Remove private-memory overlap from direct encounters, preserving it only in an explicitly
non-contact recognition path, **provided that path is band-known and non-omniscient**.

Inspected `socialRangeRecognition.ts` before considering anything new, as §6 requires:

- It derives recognised neighbours from the **observer's own** contact memories, lineage fields and
  familiar country — never from another band's private stores.
- AUDIT-27 verified its "NEVER called inside stepSim" header is **true**: it is reached only via
  `socialEcologicalDiffusion` → `adaptiveHuman.deriveAdaptiveHumanProfile`, whose only importers
  are `publicHumanStory.ts`, `knowledgeCarriers.ts` and UI panels — and the first two are imported
  **only** by `src/ui/`.

**So the preservation clause needs no new code — and, examined honestly, it needs no code at all.**
Two bands that have never met and merely happen to remember the same tile do not *know* anything
about each other. §5(D) states this exactly: coincident private place memories "prove nothing about
whether either band currently knows the other is there." The correct outcome is that **no**
authority represents it, not that it is relocated to a softer one. Moving it into a recognition
model would preserve the omniscience and only rename it.

Option C is therefore selected as A's edit **plus** the verified finding that nothing legitimate
requires preservation.

### Option D — another minimal architecture

Not required. D is admissible only if A/B/C would break a legitimate direct-contact chain, and §1
shows the memory disjunct is the only non-distance-gated path in the entire encounter system.

---

## 3. Selected change, exactly

Three edits in one file, `src/sim/agents/socialContext.ts`:

1. **`getEncounterCandidatePairs`** — delete the `memoryTileBands` block that pairs bands by shared
   `topReturnPlaceIds`. Candidacy becomes current proximity only (`getLocalEncounterCandidateIds`,
   distance ≤ 4, unchanged).
2. **`getEncounterKind`** — drop the `memoryOverlap` parameter and the `memoryOverlap > 0.24`
   disjunct; the branch becomes `distance <= 3`. Every remaining branch is unchanged.
3. **`detectEncounter`** — drop the `getSharedMemoryOverlap` call, and delete
   `getSharedMemoryOverlap` itself. It is the direct read of another band's private `placeMemory`
   and has exactly one caller.

Nothing else changes. `updateContactMemory`, `applyEncounterToBand`, encounter outcomes,
tolerance, tension, disposition, perception and response distributions are untouched — a
legitimate encounter still does precisely what it did.

---

## 4. Expected consequences, declared before measurement

1. Two distant bands sharing a remembered place produce **no** candidate pair, **no**
   `BandEncounterRecord`, **no** contact memory, and therefore no downstream friction candidacy
   through `rangeFriction.ts:478`.
2. Bands within the existing radii still encounter each other exactly as before — same kinds, same
   outcomes, same counters.
3. Pre-existing contact memories are **not** deleted. A pair that genuinely met and then separated
   keeps its record; it simply stops refreshing `contactCount` / `lastContactAt`.
4. Reports remain reports: `advanceReportedKnowledge` is untouched.
5. Physical ecology is untouched: crowding, shared catchment, depletion and support cannot move for
   a frozen physical world.
6. CORRECTION-28's memory-only crowding result is untouched and must still read zero.
7. Production behaviour changes, so no fingerprint parity to `c5eb58a` is claimed or possible.

---

## 5. Deferred seams, recorded not repaired

`rangeFriction.ts` retains its **own** independent provenance defect, unrelated to encounters:
`derivePairNotices` reads another band's private `recentIntraSeasonTrips` and admits a notice
whenever the trip's target tile falls inside the observer's own familiar country — a gate on
*place*, not on whether anything was observed. Closing the encounter chain does not close that, and
§8 forbids repairing it here.

Also unchanged and deferred: range-friction expiration and release; access-memory decay; crowding
score double-counting; `nearbyBandPressure` and `crowdingPenalty` weights; range-saturation
formulas; shared-catchment footprint expansion; same-day trip, expedition and investigation-route
overlap; kin crowding factors; parent-memory dispersal pressure (`getParentCoreOverlap`);
`territorialPressure`; mobility-distance limits; property, territory, borders, warfare and law;
Daughter Viability.
