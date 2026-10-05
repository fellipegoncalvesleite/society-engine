# CORRECTION-31 — provenance and conceptual separations

The eight separations §8 requires, as they exist after this checkpoint. Each states its
authority, what it proves, what it does **not** prove, and which fixture holds it.

---

## 8.1 Physical occupancy — where another group actually is now

**Authority:** band positions → `crowding.getNearbyBandPressure` (proximity-only since
CORRECTION-28) and `sharedCatchment.buildSharedCatchmentIndex`, both rebuilt every tick.

**Proves:** current physical competition. **Does not prove:** that anybody noticed.

**Unchanged by this checkpoint, and released immediately on departure** — measured at season 0
in every timeline, identical in both arms. Physical release is never delayed to match social
memory (§10.1). Natural, 20 y and 50 y: `weightedCrowdingSum`, `catchmentClaimTileSeasons`,
`contestedCatchmentTileSeasons`, `tileDepletionSum`, `sharedReachableSupportSum`,
`perCapitaReturnSum`, `tripRecordSeasons`, `moves`, `finalPopulation` **all identical**.

## 8.2 Contemporary observed presence — what the observer has legitimately perceived

**Authority:** `rangeFriction.advanceRangeFriction`, gated on
`cache.nearbyBandsByBandId` (CORRECTION-30). Stamped `confidence: "observed"`, `tick: now`.

**Proves:** the observer was beside them. **Does not prove:** what they did, or that they are
still there tomorrow.

**Natural: `directFrictionCreated` 28 → 28.** Creation is untouched; only the afterlife changed.

## 8.3 Current social expectation — what the observer believes now

**Authority:** the age- and provenance-weighted view of the friction ring inside
`accessNorms.deriveAccessMemory`, exposed as `activeEvidenceWeight` /
`activeEvidenceCount` / `socialEvidencePhase`. **Derived every tick; stored nowhere.**

**May be uncertain and may outlive observation** — that is the point of the cooling curve.

**Fixtures:** P1 (releases at season 8 vs 18 before), P3 (cools without contradiction),
P6/P7 (reactivates only on fresh evidence).

## 8.4 Historical social memory — what happened before

**Authority:** the retained `RangeFrictionEvent` records themselves, to the existing 48-tick
eviction, plus chronicle and event history.

**Does not imply current presence.** Once weight falls below 0.05 the records are inert:
`socialEvidencePhase: "released_historical"`.

**Natural, 20 y:** band-seasons carrying **retained but inert** records **13 → 21**, while
band-seasons with an active contribution **12 → 4**. Records are kept; influence is not.

## 8.5 Relationship memory — who they are

**Authority:** `Band.contactMemories` / `KnownBandContactMemory`. Never decays, and **carries
no tile and no coordinate**, so it structurally cannot locate anybody.

**Untouched.** Fixture P17: `BAND_STILL_KNOWN_AFTER_RELEASE`, contact count unchanged across
release in both arms.

## 8.6 Place familiarity and attachment — what the observer knows about the ground

**Authority:** `Band.placeMemory`, `familiarCountry`, `protoCampMemory`.

**Untouched**, and independent of the other group. `placeMemoryHeldThroughout: true` in every
timeline.

## 8.7 Physical ecological legacy — depletion and disturbance

**Authority:** `world.tileDepletion`, plant/fauna/aquatic stocks, `usePressure`.

**Not social knowledge, and on its own clock.** Fixture P16:
`THREE_INDEPENDENT_CLOCKS_PHYS_S0_SOCIAL_S8` — physical release at season 0, social release at
season 8, depletion varying independently of both.

## 8.8 Reported belief — what somebody said

**Authority:** `Band.reportedKnowledge.reports` / `WordOfMouthReport`, with `sourceBandId`,
`originalObserverBandId`, `hops`, `freshness`, `trustBasis`, `distortionLevel`.

**Neither direct observation nor necessarily current truth.** Three rules now hold:

1. **It ages.** The friction record it produces is stamped with `report.tickReceived`, so it
   ages like everything else. Before, it was re-minted at the current tick on every pass and was
   permanently age 0 — one report kept a record alive for up to `REPORT_MAX_AGE_TICKS = 160`
   (forty simulated years) at constant strength. Fixture P12:
   `SECONDHAND_BUT_DOES_NOT_FADE` → **`SECONDHAND_AND_FADES`**.
2. **It stays second-hand.** `confidence: "reported_secondhand"` is never upgraded; capped at
   0.7 of a first-hand sighting and degraded by hop depth.
3. **Retelling is not confirmation.** Copies are keyed on
   `(originalObserverBandId, topic, targetTileId)`, the triple that survives relay. Fixture P13
   (five copies through two different relayers): `TREATED_AS_2_INDEPENDENT_CONFIRMATIONS` →
   **`ONE_EPISODE_ONE_RECORD`**. Fixture P14 (two genuinely different original observers):
   `INDEPENDENT_SOURCES_NOT_DISTINGUISHED` → **`INDEPENDENT_SOURCES_REINFORCE`**.

**Natural, 20 y: `reportFrictionCreated` 33 → 3 (−91%)**, with `reportsReceived` essentially
unchanged (2,649 → 2,639). The reports still arrive; they no longer manufacture a fresh
friction record every season forever.

---

## The loop that is now cut

```text
friction record
  -> reportedKnowledge.ts:648 republishes it as outsider_use_warning
  -> another band receives it
  -> rangeFriction.ts:228 mints report-linked friction, fresh every tick
  -> that band republishes it
  -> ... indefinitely
```

Two cuts, both minimal and both required for release to mean anything:

- report-linked friction is **not republished** — a band passes on what it saw, not what it
  heard (`rangeFriction.ts:250` already blocked a band's *own* reports; a neighbour's rumour
  returning was not blocked);
- **released** friction is not republished — a belief the band has stopped acting on is not
  current news.

The reporting system is otherwise untouched (§10.10).

---

## What is still NOT representable, and was not invented

| channel | status |
| --- | --- |
| `observed_departure` as an event | **no authority.** No per-day positional history, no departure event; a band would have to compare two hidden positions. Fixture **P5 is deliberately not constructed** and says so. |
| `credible_move_report` | **no authority.** `ReportedKnowledgeTopic` has no band-movement topic, and inventing one means inventing knowledge of where they went. |
| physical traces, trails, camp remains, trace freshness | **no authority** (recorded at CORRECTION-30 and unchanged) |
| cross-band smoke, long-range sighting, visibility or barriers | **no authority** |
| seasonal rounds for *other* bands | not modelled; cooling is time-based, not season-aware |
