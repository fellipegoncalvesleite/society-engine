# CORRECTION-24A — ORDINARY EXPLORATION AUTHORITY / LAUNCH-FUNNEL DIAGNOSIS

Branch `checkpoint/ordinary-exploration-capacity-24`, from CORRECTION-23's closure `59391d54`.
Local `main` untouched at `668763f`; remote `main` untouched at `0a43083`.
CORRECTION-23 frozen; remote still resolves to `59391d54` exactly.

**Diagnostic only.** Diagnostics-off canonical fingerprints are identical to `59391d54`:
map1 `7239c085…`, map2 `d748c78a…`.

---

## 1. The question

CORRECTION-23 removed verification travel that had been supplying known-country breadth by
accident. Ordinary `frontier_exploration` did not expand to replace it. Why not?

"Exploration launches rarely" is not an answer — it collapses at least eight distinct failures
into one number. §9 requires exactly one typed primary blocker per opportunity, with motive,
capacity, hypothesis, feasibility and scheduling kept apart.

---

## 2. What an "opportunity" is

Production considers launching only every `EXPEDITION_LAUNCH_CADENCE_DAYS = 6`. A first version of
this audit recorded every day and duly reported `OFF_LAUNCH_CADENCE` as the top blocker at 83% —
which was this audit's own sampling choice, not a finding. **Off-cadence days are not
opportunities and are no longer recorded.** Every number below has a denominator of real
production launch opportunities.

---

## 3. The funnel — eleven worlds × five shared seeds × 40 years

277,250 opportunities.

| Primary blocker | Count | Share |
| --- | --- | --- |
| `ALREADY_EXPLORING` | 247,073 | **89.12%** |
| `VALID_BUT_IDLE_SLOT_UNUSED` | 23,852 | **8.60%** |
| `NO_MOTIVE` | 4,775 | 1.72% |
| `SELECTED` | 1,342 | 0.48% |
| `DISPLACED_BY_URGENT_TASK` | 150 | 0.05% |
| `ACTIVE_CAP_FULL` | 32 | 0.01% |
| `DISPLACED_BY_NONURGENT_TASK` | 26 | 0.01% |
| `NO_HEADING` | **0** | 0 |
| `NO_BAND_KNOWN_FRONTIER` | **0** | 0 |
| `INSUFFICIENT_LABOR` | **0** | 0 |
| `ADEQUATE_KNOWN_ALTERNATIVE` | **0** | 0 |
| `POPULATION_TOO_SMALL` | **0** | 0 |

### What is NOT the blocker

* **Motive.** Eligibility is **99.4%** on nine of eleven worlds and 80.1% / 91.2% on map1 / map2.
  Mean evidence score 0.55 (map1) and 0.66 (map2) against a 0.50 threshold; on map1 **41,837 of
  60,280** opportunities score above 0.5 and **none at all** score below 0.3. Bands nearly always
  have a band-known reason to look.
* **Direction.** `headingAvailable` is **1.000 on every world**. On map2 the basis is
  `corridor_continuation` 83,173, `water_margin` 24,531, `known_edge` 750 — the five-branch
  precedence never runs dry. Mean known frontier-edge tiles 43.3.
* **Labour, provisions, risk, caps.** `INSUFFICIENT_LABOR` = 0. `ACTIVE_CAP_FULL` = 32 of 277,250.
* **Scheduler competition.** Both `DISPLACED_*` classes together are **176 of 277,250 (0.06%)**.
  Exploration essentially never loses a contest it entered.

### What IS the blocker

**(a) The 3-year suppression window — 89.1%.** `FRONTIER_EXPLORATION_SUPPRESSION_TICKS = 12`
ticks = 12 seasons = **3 simulated years**, and it is stamped the moment the party is *raised*,
not when it returns. A band therefore gets one look per three years regardless of what the look
found, how large it is, or how much pressure it is under. Measured launch rate matches exactly:
13 launches per 40-year run, one per 3.1 years.

**(b) Exploration is never offered the slot — 8.6%, and 100% of it is "never offered".**
Exploration competes last: it is called only when no retrieval, patch-verification or
reconnaissance candidate exists. Of the 23,852 opportunities where a complete valid proposal
existed and **nothing launched**, **23,852 never reached the exploration branch** and **0 were
offered and refused**. The claiming family then failed to launch anything:

| claimed by | count |
| --- | --- |
| `patch_verification` | 13,447 |
| `reconnaissance` | 4,621 |
| `retrieval` | 440 |

---

## 4. Terrain heterogeneity — the failure is not the same everywhere

| world | eligible | heading | valid proposal | launches | idle-never-offered | top blocker |
| --- | --- | --- | --- | --- | --- | --- |
| map1 | 0.801 | 1.000 | 0.034 | 303 | 1,725 | `ALREADY_EXPLORING` |
| map2 | 0.912 | 1.000 | 0.080 | 532 | 8,026 | `ALREADY_EXPLORING` |
| site_A_coast | 0.994 | 1.000 | 0.006 | 65 | 7 | `ALREADY_EXPLORING` |
| **site_B_dry_plains** | 0.994 | 1.000 | **0.592** | **27** | **7,077** | **`VALID_BUT_IDLE_SLOT_UNUSED`** |
| site_C_dry_plains | 0.994 | 1.000 | 0.007 | 65 | 13 | `ALREADY_EXPLORING` |
| **site_D_aquatic** | 0.994 | 1.000 | **0.562** | **27** | **6,698** | **`VALID_BUT_IDLE_SLOT_UNUSED`** |
| site_E_hills | 0.994 | 1.000 | 0.007 | 65 | 12 | `ALREADY_EXPLORING` |
| site_F_hills | 0.991 | 1.000 | 0.006 | 65 | 0 | `ALREADY_EXPLORING` |
| ordinary | 0.994 | 1.000 | 0.029 | 63 | 277 | `ALREADY_EXPLORING` |
| isolated_marginal | 0.994 | 1.000 | 0.006 | 65 | 3 | `ALREADY_EXPLORING` |
| hostile | 0.994 | 1.000 | 0.007 | 65 | 14 | `ALREADY_EXPLORING` |

Nine worlds are bound by the suppression window. **Two — site_B and site_D — are bound by the
ordering gate instead**, and they are the two worlds that launch *least* (27 against 63–65). On
those two, a valid proposal exists on ~57–59% of all opportunities and a patch-verification
candidate takes the decision and launches nothing, ~7,000 times each.

---

## 5. Defect classification (§15)

**I — interaction-dependent**, decomposing into:

* **C (a cap, not a physical limit)** on nine of eleven worlds: the 12-tick suppression window is
  the authoritative blocker at 89.1% overall.
* **E — idle-capacity policy failure** on site_B and site_D, and 8.6% overall: a valid proposal
  exists, no urgent work competes, the slot is free, and exploration is never asked because an
  earlier family claimed the decision and then failed.

**A (no motive authority) is refuted** — eligibility 99.4%/0.55–0.66 mean score.
**B (heading failure) is refuted** — heading availability 1.000 everywhere.
**D (scheduler competition) is refuted** — 0.06%. Note this is *distinct* from E: exploration does
not lose contests, it is not entered into them.

---

## 6. NOT BUILT in this pass — gates unmet

Reported plainly rather than implied complete:

* **§10 O0–O5 counterfactuals** — not built. The blocker is isolated from the funnel alone, but
  the causal weight of each arm (competition, idle capacity, withheld knowledge, one-cycle
  retention, reader isolation) is **not measured**.
* **§11 X1–X16 controlled fixtures** — not built. Gate 18 unmet.
* **§12** 200-year and 500-year horizons — not run; only 40 years.
* **§13 historical `dc08b2d` vs `59391d54` comparison** — not run.
* **§14 feedback-loop first-divergence traces** — not run. The loops in §14 are **not** claimed.
* **§17 read-only debug projection** — not built.
* **E4/E5/E6** journey and returned-knowledge rows — the diagnostics module carries the shape and
  the accessors, but no production seam writes them yet, so **returned-record counts, one-year
  eviction, first-reader traces and changed physical actions are NOT measured in this pass.**

Because §21 gates 13–18 are unmet, this is a **partial** diagnosis: the launch-side blocker is
isolated and replicated across eleven worlds, and nothing downstream of the launch is measured.

---

## 7. What must NOT be concluded yet

The suppression window being the top blocker does **not** license shortening it. §3 forbids
assuming the answer is more exploration, and nothing here shows that additional launches would
produce durable knowledge — the retention debt (CORRECTION-23E: 72-record capacity, mandatory set
at 161%, median record lifetime 0.9 years) is untouched and could erase every extra return.
Whether a shorter window helps is exactly what O4 and the 200-year matrix would have to show, and
they were not run.
