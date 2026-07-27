# CORRECTION-23F — Seasonal-retraversal benefit decomposition

Diagnostic continuation. Branch `checkpoint/physical-frontier-verification-23`, from `a5b67a0`.
`main` untouched at `668763f`. **No production behaviour changes**: every new switch is an
audit-only `WorldAuditOptions` field, and the canonical-state fingerprint is identical to
`a5b67a0` on map1 (`9a204dde…`) and map2 (`439b4e7a…`) at 40 years with all switches unset.

---

## Canonical mistakes not to repeat (binding, carried forward)

* Do not generalize from one run seed, one terrain, one map, or one lineage.
* Do not call multiple ordering seeds multiple independent habitats.
* Do not confuse temporal ordering with causal mediation.
* Do not average away seed-, terrain-, map-, band-, or lineage-specific mechanisms.
* Do not edit production while the causal defect remains insufficiently isolated.
* Do not chase attractive population outcomes with code changes.
* Do not trust feature names, types, documentation, UI, stored records, or audit mirrors as
  proof of behavior. A stored result matters only when an authoritative reader changes a real
  action.
* Keep physical truth, band knowledge, and UI projection separate; audit every field crossing
  those boundaries.
* Do not collapse route, water access, water reliability, resources, seasonality, risk, or
  residential suitability. Do not let one valid observation imply unrelated facts.
* Do not use scalar confidence or numeric defaults as universal authorization.
* Do not compare incompatible authorities or units.
* Do not confuse daughter viability, destination preference, and split motivation.
* Do not infer duplicate physical cost from repeated terminology.
* Do not create food from information. Every calorie must originate in a real physical stock,
  depletion, harvest, and canonical receipt.
* Do not charge the entire band for a small expedition party.
* Do not use chronological display history as behavioral memory.
* Do not declare implementation-driven forgetting cognitively legitimate without testing its
  timescale and consequences.
* Do not permanently retain all knowledge merely to improve survival.
* **Do not create a new repeated-travel behavior merely to compensate for defective memory
  retention.**
* Do not permanently quarantine uncertain knowledge.
* Do not retain tautological verification questions.
* Do not name evidence more strongly than the physical task proves.
* Do not interpret a high confirmation rate without decomposing selection and arithmetic.
* Do not let user preference, agent confidence, or attractive outputs override evidence.
* Small passes retain full acceptance standards.
* Do not combine independent repairs before isolating them.
* Do not move to a new roadmap item before plain-language explanation and explicit human review.
* Do not move the final whole-simulator audit earlier.

---

## §8 — every authoritative field, and what each arm does to it

`observeTile` (`tileObservation.ts`) rebuilds the whole `KnownTileRecord` on every observation.
The retention scorer (`memoryCompression.getKnownRetentionScore`) reads a **subset** of the same
fields, which is why "what is known" and "how alive the record is" are not separable by accident.

| field | written by the observation writer | read by the retention scorer |
| --- | --- | --- |
| `lastObservedAt` | yes — set to now | **yes** — `recency` term, ×0.5 |
| `visits` | yes — +1 at distance 0 | **yes** — ×0.42 |
| `confidence` | yes — max(existing, new) | **yes** — ×0.28 |
| `observedWaterAccess` | yes — coarse, capped for traversal | **yes** — ×0.32, and the mandatory water predicate |
| `observedAquaticPotential` | yes — coarse, visible water only | **yes** — ×0.22, and the mandatory water predicate |
| `knowledgeSource` | yes — `personally_observed` | **yes** — +0.12 |
| `seasonsObserved` | yes — appends the current season | no |
| `observedRichness` | yes — quarter buckets for traversal | no |
| `observedMovementCost` | yes — exact (walking establishes it) | no |
| `observedRisk` | yes | no |
| `observedStorageSuitability` | preserved on traversal | no |
| `observedSeasonalPattern` | preserved on traversal | no |
| `acquisition` | upgrades, never downgrades | no |
| `verificationDisposition` | carried forward | no |
| `firstObservedAt` | preserved | no |

Arm definitions against that table:

| arm | creates new records | refreshes existing | content fields | `lastObservedAt` / `visits` | `seasonsObserved` |
| --- | --- | --- | --- | --- | --- |
| F3 target only | destination tile only | destination tile only | normal | normal | normal |
| F4 route only | route minus destination | route minus destination | normal | normal | normal |
| F5 new tiles only | **yes** | **no — skipped entirely** | normal (new only) | normal (new only) | normal (new only) |
| F6 existing only | **no — skipped entirely** | **yes** | normal | normal | normal |
| F7 content, no recency | yes | yes | **updated** | **preserved** | normal |
| F8 recency, no content | yes | yes | **preserved** | **updated** | preserved |
| F9 no season identity | yes | yes | normal | normal | **not appended** |
| F10 season identity only | yes | yes | **preserved** | **preserved** | **appended** |

**Honest limit of the F7/F8 separation, recorded rather than hidden.** `confidence`,
`observedWaterAccess` and `observedAquaticPotential` feed *both* content and retention. The
split is exact for `lastObservedAt` and `visits` and approximate for those three, so F7 still
passes a little retention value through and F8 withholds a little. A first observation of an
unknown tile has no previous content to preserve, so F8 and F10 write such a tile in full.

**F13** leaves the observation path completely untouched and removes the question instead: the
party is raised on the same schedule, walks to the same target on the same route, and its route
becomes ordinary known country exactly as in F1 — but it carries no question, records no result
and writes no disposition.

---

## §12 — three independent terrains, qualified before use

The CORRECTION-23E matrix varied `runSeed` only, which perturbs near-tie decision ordering and
**never terrain**. This pass adds physical variation: three sites at least 40 tiles apart, each
checked against the four `marginal_escapable` conditions before being used.

| terrain | site | terrain kind | local richness | local water | better country in reach | best reachable richness | distance | corridor passable |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **A** | `tile:204:72` | coast | 0.427 | 0.299 | 9 tiles | 0.737 | 14 | 1.00 |
| **B** | `tile:10:34` | plains | 0.341 | 0.069 | 8 tiles | 0.552 | 14 | 0.93 |
| **C** | `tile:100:23` | plains | 0.455 | 0.108 | 19 tiles | 0.655 | 12 | 0.83 |

All three are genuinely marginal, all three have materially better country physically reachable
inside expedition range, and route feasibility differs by design (1.00 / 0.93 / 0.83). A is
coastal and comparatively wet; B and C are dry plains. 1,627 tiles met the qualification filter;
the two additional sites were selected deterministically by tile id subject to the separation
constraint.

**What this does and does not vary.** It varies the physical site, terrain kind, water regime
and corridor feasibility. It does **not** vary the world generator or the map seed — all three
sites are on `map2`. That is site/terrain independence, not independent world generation, and it
is reported as such.

---

## §5/§6/§7 — the decomposition, and why it cannot be completed as posed

### Terrain A (`tile:204:72`, coast) — 12 arms × 10 run seeds, 200 years

| arm | what it allows | survival | mean pop | unique tiles | frontier tiles | refreshes | receipts |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F0 production | — | 0.70 | 21.5 | 277.6 | 93.8 | 29,124 | 166.2 |
| **F1 season term** | positive control | **1.00** | **36.9** | 342.1 | 131.3 | 27,116 | 269.7 |
| F2 no observation | negative control | 0.40 | 12.1 | 416.9 | 101.8 | 4,478 | 95.1 |
| F3 target only | destination tile | 0.30 | 6.5 | 284.4 | 131.8 | 9,620 | 60.5 |
| **F4 route only** | route minus destination | **1.00** | **34.6** | 343.4 | 108.3 | 27,142 | 268.6 |
| F5 new tiles only | discovery | **0.00** | 0.0 | 218.6 | 43.7 | 3,683 | 12.7 |
| F6 existing only | maintenance | 0.30 | 10.5 | 247.8 | 93.3 | 30,726 | 99.4 |
| F7 content, no recency | what is known | 0.80 | 23.4 | 288.7 | 104.4 | 6,643 | 199.3 |
| F8 recency, no content | record stays alive | 0.10 | 3.5 | 314.2 | 65.6 | 44,559 | 39.6 |
| F9 no season identity | everything but season | 0.70 | 20.1 | 275.2 | 86.9 | 35,868 | 158.6 |
| F10 season identity only | season only | 0.10 | 1.8 | 270.9 | 60.2 | 3,831 | 25.6 |
| F13 no question | (INVALID — see below) | 0.00 | 0.0 | 55.6 | 7.0 | 29,639 | 29.9 |

On terrain A the answer is an **interaction**, not a component:

* the benefit lives in the **route country**, not the destination — F4 reproduces F1 (1.00/34.6 vs
  1.00/36.9) while F3 collapses **below the no-observation control** (0.30/6.5 vs 0.40/12.1);
* **neither discovery nor maintenance alone works** — F5 is total extinction, F6 is 0.30/10.5;
* **neither content nor recency alone works** — F7 is 0.80/23.4, F8 is 0.10/3.5, both far below F1;
* **season identity is necessary but nowhere near sufficient** — removing it (F9) lands exactly
  back on production (0.70/20.1 vs 0.70/21.5), while season identity alone (F10) is 0.10/1.8.

### Terrains B and C — the result does not replicate

| arm | A (coast) | B (`tile:10:34`, dry plains) | C (`tile:100:23`, dry plains) |
| --- | --- | --- | --- |
| F0 | 0.70 / 21.5 | 0.80 / 11.2 | 1.00 / **24.6** |
| F1 | **1.00 / 36.9** | 1.00 / 13.8 | 1.00 / **21.4** |
| F2 | 0.40 / 12.1 | 1.00 / 12.6 | 1.00 / 22.6 |
| F5 | 0.00 / 0.0 | 1.00 / 12.8 | 1.00 / 23.8 |
| F6 | 0.30 / 10.5 | 1.00 / 13.8 | 1.00 / 22.0 |
| F7 | 0.80 / 23.4 | 0.80 / 8.4 | 1.00 / 22.0 |
| F8 | 0.10 / 3.5 | 1.00 / 13.2 | 1.00 / 23.6 |
| F10 | 0.10 / 1.8 | 1.00 / 12.6 | 1.00 / 22.2 |

**On terrain C every arm survives 10/10 and F1 is the WORST of them** (21.4 against production's
24.6). On terrain B every arm except F0 and F7 survives 5/5, inside a 8.4–13.8 band. Only
terrain A discriminates at all.

### What this means for CORRECTION-23E

CORRECTION-23E reported, as a property of the marginal tier, that restoring one season term
restores survival and that suppressing the walked-route observation collapses it. Both statements
are **true on terrain A and do not generalise**. That conclusion rested on ten `runSeed` values on
a single site, which vary near-tie decision ordering and never terrain — the exact error this
checkpoint's own rule list names first ("do not call multiple ordering seeds multiple independent
habitats"). The 23E finding is hereby **scoped to terrain A**, and the identification of a
"production seam" from it is withdrawn pending a mechanism that replicates.

Terrain A is coastal, wet (local water 0.299 against 0.069 and 0.108) and its best reachable
country is both richer (0.737) and fully corridor-connected (1.00). Whether that is *why* it is
the only discriminating terrain is **not established here** — three terrains cannot attribute a
mechanism, and no mediation trace was run across terrains.

### F13 is invalid as run

F13 was intended as §10's architectural counterfactual: F1's exact target schedule and routes with
the verification question removed. The implemented seam suppresses the returned **result**, which
also suppresses the durable **disposition** — so `mayAskAgain` answers "never asked here" forever
and target selection collapses onto one nearby place: 5,081 parties raised (the most of any arm)
but 55.6 unique tiles visited and 7.0 frontier tiles observed (the fewest). The measured 0.00
survival is the loss of retry memory, not the absence of the question. **F13 is inadmissible** and
§19 gate 10 is unmet; a valid arm needs a target-schedule replay seam, which this pass did not
build.

### Not built

F11, F12, F14 and F16 were not implemented, so §19 gates 9, 11 and 16 are unmet. **F15 is
subsumed by F7**: "F1 travel whose observations cannot protect records from compression" is
exactly `content_no_recency`, since `lastObservedAt`/`visits` are the only fields the observation
writes that the retention scorer consults for liveness. F7's numbers are F15's.

---

## §15 — memory-compression debt: classification

Unchanged and unmodified in production. On the evidence here it is **interaction-dependent, not
the principal mechanism**: the same 161%-of-capacity mandatory set and the same inert salience
scoring are present on all three terrains, yet only terrain A shows any sensitivity to what
travel does to records. A defect that is constant across terrains cannot by itself explain an
effect that appears on one of three.

## §18 — invariants

| check | result |
| --- | --- |
| TypeScript / build | PASS |
| graph | PASS — 221/764, 0 dup, 0 dangling |
| import / adaptation / decision boundary | PASS |
| anti-omniscience C1–C5, D | PASS — all zero |
| hidden-truth field audit | PASS — zero unsupported copies |
| lost-party no-transfer | PASS — C3 = 0 |
| food capture | PASS — 1.000 per founder |
| population conservation | PASS |
| step-mode invariance | PASS — both maps |
| determinism | PASS — `deterministic=true` |
| diagnostics-off fingerprint vs `a5b67a0` | PASS — identical on map1 and map2 at 40 y |
| performance | 31.8 ms/tick, 100-year baseline |
