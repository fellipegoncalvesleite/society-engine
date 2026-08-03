# ROADMAP ITEM 3 — LIMITATIONS, CLASSIFIED

Four classes, and not every limitation is automatically non-blocking.

- **ACCEPTED ABSTRACTION** — a deliberate simplification the architecture stands behind.
- **CURRENT LIMITATION** — real, bounded, and known; does not block the freeze.
- **FUTURE DEPENDENCY** — cannot be resolved until a later system exists.
- **BLOCKER** — prevents an unqualified freeze.

---

| # | Limitation | Class | Why |
| --- | --- | --- | --- |
| 1 | **a place labelled `released_historical` can still move behaviour** | **BLOCKER** | `types.ts:2522` states historical records "no longer move anything". Measured: a record at weight 0.04, counted in `historicalEvidenceCount`, still moves `strangerCaution` and `rememberedRefusalAvoidance` by 0.01 each. 1 of 448 released samples over 200 y on one seed, 0 of 193 on the other. The **quantity** is correct, continuous and monotone to zero; the **label** flips at the 0.05 activity threshold instead of at zero, so it leads its own quantity. See `released-place-probe.json` and B1 below. |
| 2 | same-day current expedition presence remains formally deferred | ACCEPTED ABSTRACTION | CORRECTION-34A supervisor scope amendment. No within-day consumer of physical presence exists in production, so a day-scoped ledger would be empty at every instant its only consumer runs. Unchanged and not re-litigated here. |
| 3 | release horizons (8 / 12 / 16 ticks, reports × 0.7 × hop × freshness) are abstractions | ACCEPTED ABSTRACTION | justified but not calibrated against data. The shape (decline to zero) is the claim; the exact horizon is not. |
| 4 | cooling is time-based, not season-aware | CURRENT LIMITATION | a belief cools at the same rate in a season the band is present as in one it is absent, except through the single `presentWithoutOthersSeasons` contradiction channel. |
| 5 | immutable episode identity is absent | CURRENT LIMITATION | episodes are identified by `(observer, other, tile, interpretation, tick)` plus `eventId`. Measured 0 duplicates (I3), but there is no durable episode object that survives ring eviction. |
| 6 | mortality location is bounded, not individually located | ACCEPTED ABSTRACTION | deaths are an aggregate net-rate quantity with no location field; a death cannot be placed inside a party. CORRECTION-34C established this and refused to infer it. |
| 7 | cohort transitions use an aggregate residence-first allocation convention | ACCEPTED ABSTRACTION | the model does **not** claim to know who aged. I14 confirms aging moves no body and labour follows the convention. |
| 8 | non-working pace burden reuses the existing limited-walker penalty | ACCEPTED ABSTRACTION | a bounded choice, not a measured magnitude; no elder/child physiology exists to derive one. |
| 9 | target-work magnitude is not anthropologically calibrated | ACCEPTED ABSTRACTION | `estimatedPeopleCount * 0.035` — CORRECTION-34E fixed the **authority**, deliberately not the **strength**. |
| 10 | trip-local provisions are not full residential-store conservation | ACCEPTED ABSTRACTION | no residential store is decremented at launch; `consumeProvisions` increments a counter. The **cargo** chain is what conserves, and it does (I10). |
| 11 | the prepared-party founder policy is provisional | CURRENT LIMITATION | withholding prepared people from founding is a **policy**, not a physical necessity. Named in I13; revisiting it is Item 4. |
| 12 | full dynamic fission remains Item 4 | FUTURE DEPENDENCY | who leaves, daughter viability, successor groups, prepared-party cancellation. None implemented. |
| 13 | individual and household identity remain future systems | FUTURE DEPENDENCY | required to locate a person, an injury or a skill inside a party or a band. |
| 14 | crowding never decides an action by itself in these worlds | CURRENT LIMITATION | CORRECTION-32 measured `crowdingFlippedSelection` = 0 in both arms. The path is live and bounded; it is rarely decisive. Reported, not sold as a success. |
| 15 | the shared-use substrate is still residence-anchored | CURRENT LIMITATION | `sharedCatchment`'s footprint is anchored at the residence, so real trips, expedition routes and investigation walks compete for nothing. AUDIT-27 named it; Item 3 did **not** close it. I7 states this explicitly rather than implying a host band reacts to a visiting party. |
| 16 | `territorialPressure` is a spawn constant with readers and no writer | CURRENT LIMITATION | inherited from AUDIT-27, untouched by every Item 3 correction. |
| 17 | no visibility, route or barrier rule for social perception | CURRENT LIMITATION | bands separated by water can still meet. CORRECTION-29 recorded it and deliberately invented nothing. |
| 18 | no physical-trace authority of any kind | FUTURE DEPENDENCY | no tracks, trails, camp remains, trace freshness or cross-band smoke. Belongs to the Persistent Human Landscape pass; CORRECTION-30 rejected inventing it. |

---

## B1 — the one blocker, stated precisely

**What production claims.** `src/sim/agents/types.ts:2522` — "`historicalEvidenceCount` is how many
records the band still holds that **no longer move anything**."

**What production does.** `accessNorms.ts` derives `socialEvidencePhase` as:

```ts
friction.length === 0 ? "none"
  : activeEvidence.length === 0 ? "released_historical"      // every record below 0.05
  : activeEvidenceWeight >= 1 ? "active" : "cooling"
```

while every contribution is scaled by `entry.weight`, a **continuous** factor that reaches zero only
at the release horizon. Between weight 0 and `SOCIAL_EVIDENCE_ACTIVE_MIN_WEIGHT = 0.05` a record is
therefore **labelled released while still contributing**.

**What was measured.** Band `band:varied-estuary:daughter:1:t412`, tile `tile:194:90`, day 44,640:
phase `released_historical`, `activeEvidenceCount` 0, `activeEvidenceWeight` 0.04,
`historicalEvidenceCount` 1. Removing **only that tile's own record** moves `strangerCaution` by
+0.01 and `rememberedRefusalAvoidance` by +0.01. It survives all three artefact tests: the tile has
its own record, the place is still tracked when the ring is stripped, and stripping just this tile
still moves the numbers.

**Why it blocks the unqualified freeze.** The freeze verdict asserts "released history is preserved
without acting as current state". A record production itself counts as historical is acting on
current state — minimally, boundedly, and vanishingly, but non-zero.

**Why it is small.** Nothing revives; the contribution is monotone and does reach exactly zero;
magnitude ≤ 0.02 on two access scalars; frequency 1 in 448 released samples over 200 simulated
years, and 0 in 193 on the other seed. No accepted correction is invalidated: CORRECTION-31's
lifecycle, its 22 fixtures and its natural results are all unaffected and were rerun unchanged.

**Smallest correction.** Derive `released_historical` only when the max surviving weight is exactly
0, and keep `0 < weight < SOCIAL_EVIDENCE_ACTIVE_MIN_WEIGHT` labelled `cooling`. This is a **derived
read-model field only** — the contribution curve is already correct, so no behaviour changes and no
constant moves. The alternative (flooring sub-threshold weights to zero so behaviour matches the
label) changes production behaviour and would need its own before/after arm; it is larger and is not
recommended.

**Not patched here.** This checkpoint is audit-only by instruction: evidence preserved, correction
named, production untouched, Item 3 not frozen.
