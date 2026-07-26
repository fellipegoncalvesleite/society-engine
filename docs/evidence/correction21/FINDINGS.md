# CORRECTION-21 — Findings (including continuation)

**Verdict: PROGRESS — NOT ACCEPTED / DO NOT MERGE.**

A proven anti-omniscience defect was repaired at its exact seam, and the repair **does**
materially reduce the population regression — 75% of the harm removed on map 1, 39% on
map 2. But two of ten seeds got *worse*, the §11 mediation chain was not traced, and a
habitat-tier question raised by the repair was still resolving at write time.

---

## 1. Ancestry and authorship

```text
21aa9ab → 6eec641 → 038a0e0 → 730e21e → c99310f → 12b83fa → e347a62 → 4d20c98 → … → 668763f
```

`main` untouched at `668763f`. Every new commit is
`fellipegoncalvesleite <fellipe.16@aluno.cefetmg.br>`, **zero `Co-Authored-By` trailers**.
One **inherited** violation: `d41c973` (CORRECTION-15) carries author *and committer* name
`Claude` plus a trailer; `1faa7c9` carries the trailer. Both predate the rule; reported, not
rewritten.

## 2. The proven defect

CORRECTION-17 wrote an explicit contract in its own `RESEARCH_CONSTRAINTS.md` (lines 40–45):
walking through country teaches existence, distance, passability, broad terrain, visible
water/relief and approximate risk — and **does not** teach stock sizes, edibility,
processing, recovery rates, "or the seasonal calendar of a place seen once in one season".

It then justified the implementation with: *"returned exploration writes only
`KnownTileRecord`s through the canonical observation writer and creates no resource memory
and no food receipt."*

**That justification is false.** A `KnownTileRecord` is not a neutral existence marker. It
carries `observedRichness`, `observedWaterAccess`, `observedAquaticPotential`,
`observedStorageSuitability` and a full `observedSeasonalPattern`. Measured at the seam, one
two-person crossing produced ecological and seasonal knowledge **identical to twenty
residential observations**, at confidence 1.0, reproducing hidden world truth exactly. Only
`visits` and `acquisition` differed.

CORRECTION-17's anti-omniscience audit checked no-resource-memory (C4) and no-food-receipt
(C5) — both true — but **never inspected the field contents of the record it does create**.
That was the audit gap.

## 3. Surviving-change classification (§3)

Production diff is confined to `src/sim/agents/tileObservation.ts`.

| # | Change | Class | Kept? |
| --- | --- | --- | --- |
| 1 | `isShallowTraversal` narrowed to exclude route reconnaissance | **C — noise-driven** | **REVERTED** |
| 2 | shallow gate + residential-upgrade guard | A | kept |
| 3 | confidence no longer pinned at 1.0 by one walk-past | A | kept |
| 4 | richness coarsened to quarter buckets | A | kept |
| 5 | water and aquatic coarsened (not merely capped) | A | kept |
| 6 | storage + seasonal omitted, left **undefined** not empty | B | kept |

**Change 1 reverted.** It was introduced while chasing a single-seed habitat-ladder result
and had no deterministic seam-level proof. The code now records the residual §5 limitation
honestly: classifying a whole acquisition *family* as shallow is itself name-based, which
§5 forbids either way, because a recon party aims at remembered country while the tiles it
walks *through* may be new and the record carries no dwell time to separate them. Including
it is the non-leaking choice; the evidence-based replacement is unbuilt debt.

**Change 6 justified independently:** `habitatYield` defaults `reliability` to 0.46 and
returns a neutral 0.85 seasonal modifier for an **undefined** pattern, whereas a
defined-but-empty pattern asserts "no seasonal reliability" (modifier 0.75, reliability 0) —
a stronger claim than the evidence supports. Writing absence instead of uncertainty is a
distinct error, and this is a deterministic seam-level proof independent of any run.

## 4. Full field-content audit — and it caught an incomplete repair

Auditing **every** field rather than just richness and calendar found **69 remaining
hidden-truth copies** after the first revision: 33 `observedWaterAccess`, 36
`observedAquaticPotential`. The first fix *capped* water at a ceiling, which only bit on
high-water tiles; every low-water tile still passed its exact value through. **A ceiling is
not a coarsening.**

Both are now quantized to quarter buckets first and capped second, with aquatic presence
gated to visibly open water. The leak test was also sharpened: a coarsened value coinciding
with a bucket-aligned truth matches by arithmetic, not by carrying precision.

```text
tiles sampled                    12  (× 3 shallow evidence histories)
unsupported hidden-truth copies   0
per-field leak count             {}
```

All seven §7 conclusions pass: shallow differs from residence; repeated traversal raises
confidence without inventing a calendar or storage claim; real observation upgrades fully;
residential evidence is never downgraded by a passing party; passability survives.

## 5. Population effect (§9/§10/§11)

P0/P1/P2/P4 come from CORRECTION-20's reader-isolation audit on these exact five seeds with
identical methodology; only P3 was run fresh.

```text
map1   P0 disabled 244.6   P1 noTransfer 241.6   P2 preRepair 188.4
       P3 postRepair 228.2  P4 quarantine 181.4
       effect of repair (P3-P2) = +39.8
       harm 53.2 -> 13.4      75% of harm removed

map2   P0 disabled 226.0   P1 noTransfer 231.6   P2 preRepair 196.4
       P3 postRepair 210.2  P4 quarantine 201.2
       effect of repair (P3-P2) = +13.8
       harm 35.2 -> 21.4      39% of harm removed
```

**Per-seed classification (§10 forbids averaging this away):**

```text
repair_removes_most_harm        5
repair_removes_a_minority       2
repair_has_no_population_effect 1
repair_introduces_new_regression 2
```

**Two of ten seeds got worse.** That is reported, not smoothed. The repair is a clear net
improvement in aggregate and on the majority of seeds, but it is not uniformly beneficial.

### §11 threshold — partially met

| Condition | Status |
| --- | --- |
| 1. harmful P2 gap reproduced | **met** |
| 2. P3 materially reduces it across multiple seeds | **met** (7/10 seeds improve) |
| 3. changed population path follows a changed non-fission decision | **NOT TRACED** |
| 4. changed decision follows the corrected field semantics | **NOT TRACED** |
| 5. food/support or movement changes before demography | **NOT TRACED** |
| 6. no demographic coefficient changed | **met** |

Because 3–5 were not traced, this is recorded as **an independently valid anti-omniscience
repair with a large measured population effect**, not as a proven causal explanation of the
regression. §11 is explicit that the seam repair may stand on its own merits in that case.

## 6. Habitat ladder — the single-seed interpretation is retired

The previous single-seed ladder was used to attribute a tier extinction to a production
edit. That was invalid: `lineageExpansionAudit` defaults to **one seed per tier**, so tier
survival is a single Bernoulli outcome a chaotic simulator reshuffles under any
perturbation. Two production edits were made on that basis; one has been reverted.

The audit already supported `--seeds s1,s2,s3,s4,s5`; it was simply never invoked with them.
Post-repair, five seeds per tier:

```text
exceptionally_rich  survival 1.0   median pop 107   median bands 4
good                survival 1.0   median pop  66   median bands 2
ordinary            survival 1.0   median pop  24   median bands 1
marginal_escapable  survival 0.0   median pop   0   median bands 0
isolated_marginal   survival 0.0   median pop   0   median bands 0
hostile             survival 1.0   median pop  19   median bands 1
```

`marginal_escapable` at **0/5** is not noise. Whether the repair caused it, or whether that
tier was always fragile and the old single-seed draw was lucky, requires the pre-repair
five-seed baseline — which was **still running at write time** and is therefore **not
claimed in either direction**. `isolated_marginal` remaining extinct is the intended honest
extinction.

## 7. Preservation (§14) — proven

- real observation **upgrades** a shallow record to full ecological and seasonal knowledge;
- repeated traversal raises confidence 0.40 → 0.72 while still claiming no calendar;
- route/passability survive a shallow crossing intact;
- residential evidence is never downgraded by a party walking past;
- anti-omniscience PASS (607 breadcrumb steps, 0 leaks, 0 unknown anchors);
- lost parties still transfer nothing; observation still creates no food.

## 8. Read model (§13)

`derivePlaceEvidenceProjection` reads **only** canonical band state, never world ecology, and
is read by no decision path. Verified live on a 60-year map2 band: 72 known places, 59
residential and 13 frontier-derived. A frontier tile 23 tiles out reports terrain and
passability *observed*, water/resource/risk *glimpsed*, and water reliability, seasonal
coverage and residential adequacy **`unknown`** — distinguished from low confidence — with
four blocked uses named and reasoned. The serialized projection contains none of the tile's
raw richness or reliability figures.

## 9. Regression matrix

| Check | Result |
| --- | --- |
| build, TypeScript | PASS |
| graph validation | PASS — 220/761, 0 dup, 0 dangling |
| import boundary | PASS — `simLayerViolations: []` |
| adaptation boundary | PASS |
| annual nutrition like-for-like | PASS |
| frontier anti-omniscience | PASS |
| full KnownTileRecord field content | PASS — 0 hidden-truth copies |
| writer-seam equivalence | PASS |
| step-mode invariance map1 + map2 | PASS — full canonical state match |
| food-receipt capture | PASS — **1.000** |
| population conservation | PASS — 0 mismatches |
| cohort conservation | PASS — 0 mismatches |
| multi-seed habitat ladder | executed (see §6) |
| five-seed P0–P4 | executed (see §5) |

**Not run:** candidate repairs A–D, social exact-seam, death-memory counterfactual,
breadcrumb adjacency as a standalone, expedition labour accounting, candidate masking,
season-order invariance, deterministic benchmark, fresh-process determinism, fresh
performance, and the pre-repair ladder baseline.

## 10. Retracted / prohibited claims

- **Retracted:** "exploring bands are better fed (+12.4% support)" — one seed, one map.
- **Retracted:** the single-seed habitat-ladder attribution of tier extinction to a
  production edit.
- **Prohibited until traced:** that this seam repair *explains* the population regression.
  It measurably reduces it; the §11 mediation chain is untraced.
- **Prohibited:** that richness and calendar were the only hidden-truth leaks — water and
  aquatic potential were leaking too and were only caught by auditing every field.

## 11. First remaining blocker

```text
The §11 mediation chain (3-5): which non-fission decision changed, what physical action
followed, and how support moved before demography. The seam is corrected and the
population effect is measured, but the path between them is not traced.
```

## 12. Merge recommendation

```text
PROGRESS — NOT ACCEPTED / DO NOT MERGE
```
