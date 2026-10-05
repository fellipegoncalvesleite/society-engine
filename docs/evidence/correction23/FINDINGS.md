# CORRECTION-23 — Findings

**Verdict: PROGRESS — NOT ACCEPTED / DO NOT MERGE.**

`frontier_verification` is **built and working end to end**. The bridge CORRECTION-22 proved
was missing now exists. But the acceptance matrices that would justify a PASS — E0–E5,
V1–V14, the ten-seed marginal tier, M0–M5 — were **not run**.

---

## 1. Ancestry and authorship

```text
49ecae9 → 8dc9d8a → dc86469 → f56735e → 97561a9 → 03c5caa → 21aa9ab → 6eec641 → … → 668763f
```

`97561a9` and `03c5caa` confirmed present. `main` untouched at `668763f`. Every new commit
`fellipegoncalvesleite`, **zero trailers**. One **inherited** violation: `d41c973` carries
author and committer name `Claude`; reported, not rewritten.

## 2. The bridge (§6–§9)

CORRECTION-22 proved every investigation family selects from
`resourceKnowledgeState.patchMemories`, while shallow frontier country lives only in
`knowledge.observedTiles`. `frontier_verification` reads **`observedTiles`** — that is the
whole point of it.

**Six questions**, each with its own eligibility, physical task, evidence output and failure
modes: `water_access`, `resource_presence`, `resource_usability`, `temporary_use`,
`route_repeatability`, `seasonal_persistence`.

**Three-state semantics (§8) are live and measured.** `classifyPlaceForQuestion` returns
`unknown` / `known_poor` / `promising_unverified` / `verified_inadequate` /
`verified_usable`. A **missing** field is `unknown` (an invitation to investigate), never
silently poor; a **low** field is `known_poor` (a reason not to go). Measured at y100 on
map2: 522 water / 559 resource / 653 temporary-use places `promising_unverified` against
131 / 94 `known_poor` — the states do not collapse.

## 3. Working end to end

Daily-stepped instrumentation, 18,000 band-days:

```text
verification parties created   1396
phases observed                outbound / operating / returning
attempts by question           resource_presence 32, water_access 24, route_repeatability 22,
                               resource_usability 14, temporary_use 5, seasonal_persistence 1
attempts by outcome            confirmed 95, negative 2, inconclusive 1
attempt-history length         12 (== cap; bound holds)
band-days at active cap        0.3%
```

All six questions fire, all three outcomes occur, and the bounded retry history saturates at
its cap rather than growing.

## 4. Deliberate boundary: no calories (§14)

`resource_usability` performs a real test and returns **evidence only**. It credits **zero
food**, deliberately.

The canonical path is a harvest resolved against a real depleting stock →
`IntraSeasonTripRecord.physicalFoodHarvest` → `buildReturnedRecord` → `depositFoodReceipts`.
Verification targets a **terrain** record, so it has no `targetPatchId` for
`resolveExpeditionTargetWork` to draw against. Synthesising a harvest record by hand would
credit food no stock ever gave up — the "free support" §28 classifies as FAIL. The calorie
path is recorded as unbuilt debt rather than faked. Gates 16–18 therefore hold, but partly
vacuously.

## 5. Two implementation errors worth recording

**The launch gate was wrong twice.** Placed behind
`verification === undefined && reconnaissance === undefined`, the launcher was unreachable:
a candidate existed in 1105 of 1352 sampled band-years and was launched zero times, because
the patch-memory families fire in almost every band-year. Then gating purely on
`noUsefulRetrieval` was *also* wrong — a failing band usually still has a worthwhile
retrieval target, which is what it is living on. The gate is now `noUsefulRetrieval ||
need >= 0.45`: two people asking whether there is anywhere better does not stop the rest of
the band foraging, and `EXPEDITION_ACTIVE_CAP` still bounds total parties.

**A silent patch failure cost several debugging cycles.** The return-side collection block
did not match its anchor and was never inserted, while the surrounding code compiled and ran
— parties completed with `verification_confirmed` and wrote nothing. Every subsequent edit
now asserts its anchor.

## 6. Honest concern: negatives are rare

Confirmed 95, negative 2, inconclusive 1. A ~97% confirmation rate suggests eligibility is
selecting places the band already had good coarse evidence for, so verification may be
confirming what was already believed rather than resolving genuine uncertainty. **This is
not yet the honest-failure profile §28 gate 11 wants**, and V1–V14 were not run to
characterise it.

## 7. What was NOT done

E0–E5 marginal matrix; V1–V14 controlled cases; M0–M5 default maps; ten-seed habitat ladder;
mediation traces (§18); UI verification states (§23); boundedness runs (§24); performance
(§25); most of §26.

**No claim is made that verification rescues the marginal tier.** §18 requires the full
physical chain and it was not traced. The mechanism exists; its consequences are unmeasured.

## 8. Preserved

Zero hidden-truth copies; coarsened shallow observations; no calendar from one visit; route
evidence intact; no food from observation; lost parties transfer nothing; step-mode
invariance both maps with full canonical state match; food capture **1.000**.

## 9. First remaining blocker

```text
The mechanism is unmeasured. E0-E5 and the ten-seed marginal tier decide whether physical
verification actually restores rational escape, and neither was run.
```

## 10. Merge recommendation

```text
PROGRESS — NOT ACCEPTED / DO NOT MERGE
```
