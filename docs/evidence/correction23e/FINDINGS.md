# CORRECTION-23E — Retry-suppression population mediation / place-memory retention authority

Diagnostic checkpoint. Branch `checkpoint/physical-frontier-verification-23`, continued from
`6258c97`. `main` untouched at `668763f`. **No production behaviour is changed by this pass** —
every new switch is an audit-only `WorldAuditOptions` field, undefined in every normal world.

---

## 0. What the seeds are, and what they are not

Every "ten shared seeds" run below is ten `runSeed` values on **one physical site**. `initSimWorld(init, runSeed)`
hashes the string into `world.runSeed`, and VAR-1's contract (`simRunner.ts:83-86`) is explicit:
the run seed **perturbs only near-tie decision ordering — never terrain**. So the ten seeds are ten
jitter variants of the same habitat, not ten independent habitats. They are a legitimate control for
"is this one lucky trajectory?", and they are **not** a control for "does this depend on the map".
Independent habitat variation comes from §15's default maps and the isolated / hostile / ordinary
tiers, which use different sites.

This is stated first because the canonical-mistake list forbids generalising from one seed, and ten
jitter variants of one site are closer to one seed than the phrase "ten seeds" suggests.

---

## 1. §4 — the regression reproduces

Controlled `marginal_escapable` founder, 34 people, `tile:204:72`, map2, 200 years, ten shared seeds,
daily observation.

| arm | commit | survival | mean final population |
| --- | --- | --- | --- |
| **R0** | `76893be` (before the durable retry disposition) | **0.9** | **35.6** |
| **R1** | `6258c97` (production today) | **0.7** | **21.5** |

Per seed (final population, `-` = extinct):

| seed | s1 | s2 | s3 | s4 | s5 | s6 | s7 | s8 | s9 | s10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R0 | 41 | 38 | 42 | 44 | 33 | – | 32 | 46 | 40 | 40 |
| R1 | 31 | – | – | 26 | 38 | 31 | 17 | 32 | 40 | – |

The regression is real, it is not one seed, and R1 loses three seeds R0 keeps while keeping one R0
loses (s6). Mean support 1.29 → 0.92, physical receipts 269.1 → 166.2.

---

## 2. §5 — component isolation: which part of CORRECTION-23D caused it

All arms are audit-only switches on `6258c97`, same seeds, same site, same 200 years.

| arm | what it restores | survival | mean pop |
| --- | --- | --- | --- |
| R0 | (reference) `76893be` | 0.90 | 35.6 |
| R1 | (reference) production | 0.70 | 21.5 |
| **R2** | durable disposition still WRITTEN, old eligibility READ | **0.90** | **35.6** |
| R3 | 23D gate + hardship reopens again | 0.60 | 18.7 |
| **R4** | 23D gate + the old season comparison only | **1.00** | **36.9** |
| R5 | 23D gate, settled-answer suppression disabled | 0.70 | 14.1 |
| R6 | production, verification party writes no route observation | 0.10 | 2.1 |
| R7 | exploration scheduled independently of verification | 0.70 | 24.0 |

Three results decide the question.

**R2 reproduces R0 exactly — seed for seed, on every metric.** Population, extinction year,
verification launches, tiles visited and eviction counts are identical on all ten seeds. R2 still
writes the durable disposition onto the place record, still resets it for daughters, still carries
it through `observeTile`; only the *eligibility read* is the pre-23D one. So **none of 23D's storage
or authority changes cause the regression.** It is entirely inside `mayAskAgain`.

**R4 restores it, and slightly exceeds it (1.00 / 36.9), by restoring one term.** That term is the
season comparison CORRECTION-23D deleted:

```ts
if (seasonChanged && (question === "water_access" || question === "resource_presence")) {
  return { allowed: true, reason: "a different season may give a different answer" };
}
```

23D removed it because it was measured as 45.8% of all verification launches and the engine of
linear repeat growth. That measurement was correct. What 23D did not measure is that **the same term
was carrying the marginal tier's survival.**

**R3 and R5 exclude the alternatives.** Restoring hardship invalidation makes things *worse* than
production (0.60 / 18.7), so §8's removal of hardship is not the cause. Disabling settled-answer
suppression entirely produces the *most* verification launches of any arm (4,634 vs 2,787) and the
*second worst* population (0.70 / 14.1) — so "more verification is better" is false. The benefit is
specifically **seasonal re-visiting of a bounded set of places**, not volume.

---

## 3. §6 — first divergence, seed by seed

Traced in lockstep from tick zero, daily, on the three seeds where R0 survives and R1 dies
(s2, s3, s10). The chain is unbroken and identical in ordering on all three.

| link | s2 / s3 | s10 |
| --- | --- | --- |
| retry-policy difference → **different target chosen** | day 384 (y2) | day 522 (y2) |
| → **different physical route walked** | day 396 (y2) | day 522 (y2) |
| → **different place records refreshed** | day 399 (y2) | day 525 (y2) |
| → **different known-tile count** | day 551 (y2) | day 555 (y2) |
| → different launch schedule | day 732 (y3) | day 648 (y2) |
| → different exploration schedule | day 1266 (y4) | day 1284 (y4) |
| → different position / receipts | day 2070 / 3078 | day 3420 / 2193 |
| → **support** | day 3150 (y9) | day 2610 (y8) |
| → **demography** | day 13320 (y37) | day 14760 (y41) |

Example, s2 day 384: R0 sends the party to `tile:202:72` to ask `resource_test_possible` on a 6-tile
route; R1 sends it to `tile:204:74` to ask `water_access` on an 11-tile route. Three days later R0
refreshes six place records and R1 refreshes none.

**The first divergence is not the number of parties — it is which place the party goes to.** Every
§14 mediation link is present: a physical activity changes, canonical knowledge changes, support
changes before demography, no demographic coefficient was touched, and the same chain appears on
three seeds.

---

## 4. §7 — exploration substitution

R6 answers this directly. It leaves verification fully intact — the party is raised, walks the same
route, and hands over its answer — and suppresses only the ordinary tile observation of the route
it walked (`returnedReconRouteTiles`).

**Survival collapses from 0.70 to 0.10; mean population from 21.5 to 2.1; place refreshes from
29,124 to 4,572.**

So the survival value of a frontier-verification party is overwhelmingly the **ordinary knowledge of
the country it walks through**, not the answer it brings home. That is the exploration-substitution
hypothesis, confirmed on the strongest available instrument.

R7 tests the other half — whether verification crowds exploration out of the schedule. Offering
exploration the same single slot first (party budget unchanged, `EXPEDITION_ACTIVE_CAP` unchanged)
moves survival 0.70 → 0.70 and population 21.5 → 24.0. Real but small, and it does not explain the
regression.

Per §7's closing instruction: this is **not** an argument for keeping redundant verification. It is a
report that the *exploration* behaviour is what matters and is currently reachable only as a
side-effect of a verification party.

---

## 5. §9 — the time unit, verified

Measured against the clock rather than assumed:

| quantity | value |
| --- | --- |
| `SEASON_LENGTH_DAYS` | 90 |
| `SEASONS_PER_YEAR` | 4 |
| `DAYS_PER_YEAR` | 360 |
| conversion | `getWorldTimeForDay(day)`: `tick = floor(day / SEASON_LENGTH_DAYS)` |
| one `stepSim(world, 1, "daily")` | advances `day` by exactly 1, `tick` by 0 — **verified in-run** |
| ninety daily steps | advance `tick` by exactly 1 — **verified in-run** |
| `world.time.tick` | a **season** tick |
| `compressBandMemoryState` | runs on `tick % 4 === 0` → **once per simulated year** |

**The CORRECTION-23D label "282 days" is correct as a unit.** Days are days. In other units that is
3.1 seasons / 0.78 years. Re-measured here over 100 years with the same instrument, the median
completed place-record lifetime is **324 days = 3.6 seasons = 0.9 years**.

---

## 6. §10 — the retention authority, inventoried

`src/sim/agents/memoryCompression.ts`, read directly and then measured through
`deriveKnownRetentionAuditView` (which calls the production scorer, not a copy of it).

| item | value |
| --- | --- |
| hard capacity | `MAX_EXACT_KNOWN_TILES = 72` |
| cadence | `tick % 4 === 0`, and only if any of the three counts exceeds its cap |
| mandatory set | band position; **the full 2-ring around it**; every river-crossing endpoint; every "important water" record; every place memory valenced `isReturnPlace` / `avoid_place` / `risky` / `depleted` |
| recency term | `clamp01((96 − (tick − lastObservedAt.tick)) / 96)` × 0.5 |
| visit term | `visits × 0.42` |
| confidence term | `confidence × 0.28` |
| water term | `observedWaterAccess × 0.32 + observedAquaticPotential × 0.22`, plus `+0.5` for a high-value water tile |
| provenance term | `personally_observed` `+0.12`, otherwise `−0.08` |
| place-memory term | attachment ×0.52, return place +0.42, risky +0.34, avoid +0.38, depleted +0.32 |
| mandatory bonus | `+10` |
| route relevance | **none** |
| candidate relevance | **none** |
| verification-evidence relevance | **none** |
| deterministic tie-break | yes — `String(tileId).localeCompare` |
| newly written records protected | **no** |
| actionable records protected | **no** |

Then the measurement that matters, over 100 years of the marginal fixture:

- the band is over the 72-record cap on **90% of band-days**;
- **the mandatory set alone is 161% of capacity** (mean, measured at every compression).

That second figure changes the reading of the whole algorithm. The retention loop is

```ts
for (const record of sorted) {
  if (mandatory.has(record.tileId) || retained.size < capacity) retained.add(record.tileId);
}
```

Mandatory records carry `+10` and therefore sort first. By the time the first non-mandatory record is
considered, `retained.size` is already ≈116 against a capacity of 72, so **`retained.size < capacity`
is never true for a scored record.** In production the retained set *is* the mandatory set, and every
scoring term above — recency, visits, confidence, water, provenance, attachment — **has no effect on
what is kept.**

Two of §10's questions therefore resolve differently than they were posed:

- *does a low-value but recently touched tile displace an old verified place?* — measured **0 times**,
  because no low-value non-mandatory tile is ever retained at all.
- *do inherited mandatory records consume most capacity?* — they consume **all of it and 61% more**.

A verified place survives compression only if it happens to fall in the mandatory set (inside the
2-ring, a crossing endpoint, important water, or valenced). Its verification evidence is never
consulted.

---

## 7. §8 — lifetime distribution by evidence class

100 years, marginal fixture, production retention (K0). `ever` counts distinct band–place records
that ever held the class; `evicted` counts eviction **events** (a place can be forgotten and
re-learned repeatedly).

| class | ever | evicted | median | q1 | q3 | p90 | used within 1y at eviction |
| --- | --- | --- | --- | --- | --- | --- | --- |
| traversed only | 223 | 531 | 359d | 269 | 629 | 989 | 503 |
| frontier exploration | 36 | 3 | 89d | 89 | 89 | 89 | 3 |
| verification target | 129 | 328 | 262d | 160 | 346 | 354 | 328 |
| confirmed water access | 32 | **0** | – | – | – | – | – |
| negative verification | 72 | 242 | 300d | 168 | 348 | 354 | 242 |
| resource presence | 101 | 257 | 264d | 166 | 346 | 354 | 257 |
| temporary use | 91 | 220 | 306d | 222 | 348 | 354 | 220 |
| residentially experienced | 159 | 338 | 262d | 162 | 346 | 353 | 338 |
| active route | 176 | 29 | 258d | 166 | 342 | 354 | 29 |
| current candidate | 22 | 1 | 179d | – | – | – | 1 |
| used within one year | 223 | 862 | 315d | 179 | 359 | 719 | 862 |
| inherited or reported | 0 | 0 | – | – | – | – | – |

Eviction cause is `memory_compression` for every completed lifetime; no other path removes a place
record. **Confirmed water access is never evicted** — those records satisfy `isImportantWaterRecord`
and are mandatory. Everything else churns.

One retention contract does **not** fit all evidence: a confirmed water place is immortal by accident
of the water predicate, while a confirmed `resource_presence` place lives a median 264 days.

---

## 8. §11 — is this forgetting legitimate?

Against the spec's own criteria, on production retention:

| criterion | measured |
| --- | --- |
| not used or considered for a substantial period | **fails** — 862 of 890 evicted records (96.9%) had been observed within the previous year |
| not part of an active route | 29 evictions were on an active route |
| not an active or promising candidate | 1 eviction was the current candidate |
| no high-value direct evidence | 328 evictions carried a verification disposition |
| no current decision depends on it | not separable from the above |
| capacity pressure is real | **true** — over cap on 90% of band-days |
| another record has greater justified salience | **cannot be true** — salience is never consulted (§6 above) |
| forgetting does not produce immediate repetitive reacquisition | **fails** — 821 of 890 evictions (92.2%) were followed by reacquisition, median gap 540 days; 299 of those places carried a disposition, and **250 verification questions were re-asked after reacquisition** |

The distinctions §11 asks for, resolved: this is not "chronological display forgotten", not
"observation detail forgotten", and not "route familiarity weakened". It is **place existence
forgotten — all knowledge of the place removed** — applied to places the band used within the year,
on a capacity rule whose ranking never executes.

A deterministic capacity eviction is not automatically cognitively legitimate, and this one is not.

---

## 9. §12 — K0–K5 retention counterfactuals

Ten shared seeds, 200 years, marginal fixture. Lifetime figures from the 100-year lifetime probe.

| arm | survival | mean pop | evictions | verification launches | reacquired verified places | questions re-asked after reacquisition | mandatory as % of capacity |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **K0** production | 0.70 | 21.5 | 1039 | 2787 | 299 | 250 | 161% |
| **K1** protect settled verification | 0.70 | 23.5 | 657 | 2041 | 9 | 7 | 152% |
| **K2** protect actionable verified | 0.70 | 23.5 | 657 | 2041 | 11 | 9 | 152% |
| **K3** protect active-route/recent verified | 0.70 | 23.7 | 688 | 2012 | 9 | 7 | 152% |
| **K4** capacity 72 → 288, priorities untouched | **0.20** | **7.6** | 57 | 1828 | 4 | 3 | 31% |
| **K5** no inherited mandatory set | **0.10** | **3.7** | 1399 | 2577 | 50 | 35 | 1.4% |

Read carefully, because the obvious repair is the one this refutes.

- **K1/K2/K3 remove the forget-relearn-reverify loop almost entirely** (verified reacquisitions
  299 → 9, repeated questions 250 → 7) and buy **+2 people**. They do not restore R0.
- **K4 — simply giving the band more memory — is catastrophic** (0.20 survival, 7.6 people), even
  though it produces the least forgetting of any arm (57 evictions). More retained places is *worse*.
- **K5 — removing the inherited mandatory pressure so the scoring actually runs — is worse still**
  (0.10 / 3.7).

So §12's question ("bad prioritisation or raw capacity pressure?") has a third answer: **neither is
the population lever.** Capacity pressure is real and the prioritisation is inert, but changing
either in isolation moves population the wrong way. Why K4 and K5 hurt is **not attributed here** —
no mediation trace was run for them, and this pass will not name a cause it has not traced.

§16's rule is exactly right and is honoured: no production retention policy is selected.

---

## 10. §14 — the mediation threshold

| requirement | met? |
| --- | --- |
| 1. paired regression reproduced | **yes** — R0 0.9/35.6 vs R1 0.7/21.5, ten seeds |
| 2. an isolation arm identifies the changed component | **yes** — R4 (season comparison) restores 1.0/36.9; R2 shows storage is innocent |
| 3. a physical activity or route changes | **yes** — different target and route length, day 384 |
| 4. canonical knowledge or receipts change | **yes** — refreshes day 399, known-tile count day 551, receipts day 3078 |
| 5. support changes before demography | **yes** — support day 3150, demography day 13320 |
| 6. no demographic coefficient changed | **yes** — this pass changed no production behaviour at all |
| 7. the same chain appears in multiple seeds | **yes** — identical ordering on s2, s3, s10 |

All seven are met, so the marginal regression **is** attributed to retry suppression — specifically
to the removal of the seasonal reopening term, mediated by which place the party walks to and what
it therefore observes.

---

## 11. §4 vitals — births and deaths, from the canonical churn record

`growthAccumulator` / `mortalityAccumulator` retain only the fractional remainder after whole
births and deaths are taken off them (`demography.ts:2415-2420`), so they are not counts of
anything. The real per-year figures are on `band.demography.demographicChurn.records`, which is
what the table below sums. (An earlier pass of this audit read the accumulators and reported
zero births and zero deaths on every seed; that was a wrong field path, not a finding.)

| seed | R0 pop | R0 births | R0 deaths | R0 receipts | R1 pop | R1 births | R1 deaths | R1 receipts |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| s1 | 41 | 124 | 117 | 289.1 | 31 | 94 | 97 | 230.0 |
| s2 | 38 | 114 | 110 | 269.6 | – (y98) | 32 | 57 | 36.5 |
| s3 | 42 | 124 | 116 | 312.7 | – (y98) | 32 | 57 | 31.6 |
| s4 | 44 | 133 | 123 | 335.2 | 26 | 84 | 92 | 210.2 |
| s5 | 33 | 103 | 104 | 218.9 | 38 | 113 | 109 | 297.1 |
| s6 | – (y98) | 32 | 57 | 30.3 | 31 | 98 | 101 | 209.6 |
| s7 | 32 | 97 | 99 | 219.7 | 17 | 64 | 81 | 134.1 |
| s8 | 46 | 132 | 120 | 329.6 | 32 | 97 | 99 | 212.1 |
| s9 | 40 | 115 | 109 | 341.5 | 40 | 117 | 111 | 277.2 |
| s10 | 40 | 118 | 112 | 344.7 | – (y98) | 32 | 57 | 23.6 |
| **total** | | **1092** | **1067** | | | **763** | **861** | |

R0 is net positive over 200 years (+25); R1 is net negative (−98). Births fall 30% and deaths
fall 19% — deaths fall because dead bands stop dying, not because R1 is safer.

---

## 12. §15 — the regression is confined to one habitat tier

R0 (`76893be`) vs R1 (`6258c97`) vs R4 (the season term restored), survival / mean final
population. Default maps: 5 shared seeds, 120 years, the maps' own founders. Tiers: 10 shared
seeds, 150 years, one controlled founder.

| tier | site | R0 | R1 | R4 |
| --- | --- | --- | --- | --- |
| **marginal escapable** | `tile:204:72` | **0.90 / 35.6** | **0.70 / 21.5** | **1.00 / 36.9** |
| map 1 default | own founders | 1.00 / 188.2 | 1.00 / 184.8 | 1.00 / 183.4 |
| map 2 default | own founders | 1.00 / 200.0 | 1.00 / 200.6 | 1.00 / 198.2 |
| ordinary | `tile:140:124` | 1.00 / 31.1 | 1.00 / 31.8 | 1.00 / 30.3 |
| hostile | `tile:112:104` | 1.00 / 17.3 | 1.00 / 15.5 | 1.00 / 17.1 |
| isolated marginal | `tile:92:112` | 0.10 / 1.1 | 0.10 / 1.1 | 0.10 / 1.1 |

**Every tier except `marginal_escapable` is within ±2%.** Both default maps, the ordinary tier
and the hostile tier are unaffected; hostile is −10% and R4 restores it. The regression bites
exactly where a band is close to escaping a marginal habitat — the tier the whole CORRECTION-23
line exists to move.

**Map-1 mechanism vs map-2 mechanism:** neither map shows a mechanism to report. Map 1 is −1.8%,
map 2 is +0.3%, both with 5/5 survival in every arm; verification launches move (map 1
5,601 → 4,716; map 2 16,475 → 10,715) without moving the population. On established multi-band
default worlds the retry policy changes how often parties go out and does not change who lives.

### The isolated-marginal survivor

One seed (`s7`) survives in every arm. It is **identical across R0, R1 and R4** — final
population 11, receipts 39.84, mean support 0.5308, 267 residential moves, one band, all three
arms. It is deterministic, it is not a terminal-state accounting artefact (a band of 11 with real
receipts and real movement), and **verification did not cause it**: it survives with the old
policy, the new policy and the restored season term alike. The other nine seeds die between
years 89 and 97 in every arm.

**This corrects the CORRECTION-23D report.** That report described this as "one seed at
population 1". The `1.1` figure was the ten-seed *mean*; the survivor is at **population 11**.
The survival rate (0.1) was right; the "knife-edge of one person" reading was wrong.

---

## 13. §18 — state size, performance and regressions

### State size (marginal fixture, production retention, serialized bytes)

| after | known places / band | disposition rows / band | disposition KB | knowledge KB | band total KB | chronological evidence rows | display ring |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 25 y | 82 | 174 | 30.0 | 198.0 | 1537 | 48 | 12 |
| 50 y | 156 | 397 | 67.7 | 332.7 | 1816 | 48 | 12 |
| 100 y | 203 | 415 | 71.0 | 374.4 | 1899 | 48 | 12 |
| 300 y | 167 | 316 | 53.2 | 330.3 | 1981 | 48 | 12 |

Bounded: place count and disposition rows peak around 100 years and fall back; the capped
collections stay pinned at 48 and 12. Nothing here grows with run length.

### Performance (fresh process, 100-year baseline, deterministic)

42.93 and 43.11 ms/tick across two reps (0.4% spread), max 106.4 / 82.5 ms. No measurable cost
from this pass — every added switch is an undefined-option branch.

### Regressions executed on this branch

| check | result |
| --- | --- |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| graph integrity | PASS — 221 nodes / 764 links, 0 duplicate, 0 dangling |
| import boundary | PASS — 0 sim-layer violations |
| adaptation boundary | PASS |
| decision boundary | PASS |
| anti-omniscience (C1–C5, D) | PASS — all zero; 704 breadcrumb steps, 62 plans, 0 leaks |
| hidden-truth field audit | PASS — zero unsupported hidden-truth copies, 7/7 conclusions |
| lost-party no-transfer | PASS — C3 = 0 |
| food-receipt capture | PASS — capture ratio 1.000 per founder |
| population conservation (per lineage) | PASS |
| step-mode invariance | PASS — both maps, `fullCanonicalStateMatch` |
| determinism | PASS — `deterministic=true` |
| diagnostics-off byte identity vs `6258c97` | PASS — identical canonical-state fingerprint on map1 (`9a204dde…`) and map2 (`439b4e7a…`) at 40 years |
| CORRECTION-23B R1–R12 | 13 / 13 PASS |
| CORRECTION-23C W1–W10 | 10 / 10 PASS |
| CORRECTION-23D B1–B15 | 15 / 15 PASS |

---

## 14. §17 — what was added to the panel

`PlaceRetentionProjection` on the selected-band Knowledge panel, read-only, derived from
`deriveKnownRetentionAuditView` — the same scorer and the same mandatory predicate
`compressBandMemoryState` uses, so the panel cannot drift from the algorithm it describes. It
shows, per place at risk: salience, retention rank, mandatory status, whether the next
compression would keep it, the eviction reason in the algorithm's own terms, evidence class,
active-route and current-candidate status, seasons since last use, and — the point of the
section — **whether a settled conclusion will disappear with the record, and which questions
will have to be asked again**. When the mandatory set exceeds capacity the panel says so
directly, because in that state nothing else survives however useful it is.

No hidden tile truth is read; the projection takes the world only for tile coordinates.

---

## 15. What this pass did NOT do

- No production behaviour changed. Every switch is an audit-only `WorldAuditOptions` field,
  undefined in every normal world.
- No retention policy was selected, no capacity was raised in production, no eviction weight was
  changed, no retry was restored, no exploration was increased, no party slot was changed.
- **K4 and K5 are not attributed.** Raising capacity and removing the mandatory set both make the
  marginal tier much worse (0.20 / 7.6 and 0.10 / 3.7). No mediation trace was run for either, so
  this pass records the measurement and names no cause.
- The ten marginal seeds are ten run-variation seeds on **one site** (see §0). Habitat variation
  comes from §12's tiers, not from them.
