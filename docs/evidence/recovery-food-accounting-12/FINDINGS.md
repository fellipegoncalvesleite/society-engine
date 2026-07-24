# LOST-LINEAGE RECOVERY — FOOD RECEIPT ACCOUNTING (RECOVERY-12)

**Verdict: PASS CANDIDATE.**

Reconstructs the two food-accounting corrections from the lost CORRECTION-10/11 sessions:
receipt eviction and stale-receipt persistence. The former local lineage ending at
`f27f3f1` was unavailable and treated as lost (its commits `fe0a788`/`301fc11`/`f27f3f1`
and branches `checkpoint/ecology-human-food-conversion-10`/`…-surplus-growth-correction-11`
were not fetched, referenced, or cherry-picked). This checkpoint reconstructs only the
already-measured production fixes.

- **Starting HEAD:** `e539813ab40f14075b3701f56566a9f3095e4291` (public `main`, "checkpoint:
  complete ecology viability correction"), clean tree.
- **Branch:** `checkpoint/recover-food-receipt-accounting-12`.
- **Commit message:** `checkpoint: recover physical food receipt accounting`.

---

## 1. Defects reconstructed

Both defects had a single root: `deriveHumanFoodSupportLedger` reconstructed a season's food
from `Band.recentIntraSeasonTrips`, a **bounded 24-record behaviour/UI memory**
(`RECENT_TRIP_RECORD_CAP = 24`, `intraSeasonTrips.ts`).

### Defect 1 — receipt eviction (capture < 1.000)

A season runs **28 trip-days** (`FIRST_TRIP_DAY_OF_SEASON = 6`, `TRIP_DAY_CADENCE = 3`, over
`SEASON_LENGTH_DAYS = 90` → days 6,9,…,87). 28 > 24, so a full season already overflows the
window, and most trips are non-food (water checks / scouting). The ledger reads at end of
season, by which point the minority food-harvest records — especially early-season ones —
have been evicted from the window, even though the ecology stock was already depleted at
harvest. Physically harvested food silently vanished before nutrition saw it. The expedition
return path fed the same window, so carried-home cargo was evicted identically.

Measured on the identical trip history the production still records (`recoveryFoodAccountingAudit`,
`oldWindowCaptureRatio`): the old mainline algorithm credited only **0.79 / 0.80 / 0.72 / 0.61 /
0.49** of physically returned food for Delta Reed / Green River / Lake Marsh / Pass Edge /
Dry Margin — the harder the habitat, the worse the loss.

### Defect 2 — stale-receipt persistence

The old ledger selected `sourceSeasonTick = max retained food-trip tick` with **no proof it
belonged to the current accounting period** (`deriveHumanFoodSupportLedger` had no `currentTick`
parameter). A band that stopped harvesting kept being fed by whatever prior-season food record
survived the window, across zero-harvest seasons.

---

## 2. Reconstructed architecture — authoritative per-period accumulator

New file `src/sim/agents/seasonalFoodReceipts.ts` + `Band.seasonalFoodReceipts`
(`SeasonalFoodReceiptAccumulator`). The canonical pipeline is now:

```text
PhysicalFoodHarvestRecord
→ successful physical return/deposit (same-day trip OR expedition cargo)
→ seasonal receipt accumulator (bounded, per accounting period)
→ human food support ledger (freshness-gated read)
→ nutrition
→ demography
```

- **Written only** at the two credited-food return sites: `applyTripDay`
  (`intraSeasonTrips.ts`) and the expedition return deposit (`expedition.ts`). Non-food trips,
  attempts, projections, verification, observations, materials, and water/route information are
  a no-op (`isCreditedFoodReceipt` matches the ledger's historical credited-food filter exactly).
- **Creates no food.** It sums the SAME `PhysicalFoodHarvestRecord.usableSupport` (and
  per-source-kind harvest + transport/processing losses) the ledger already trusted, preserving
  every loss and resource-class attribution. Running sums ⇒ O(1) per receipt and per read;
  `topReceipts` is a bounded (≤16) display projection only.
- **Freshness (`readFreshAccumulator`):** verified against `tick/advance.ts` and the existing
  trophic invariant `sourceSeasonTick + 1 === decision.time.tick`. Season-N food is deposited at
  tick N but the ONLY consumer (the seasonal ledger read inside `runSeasonalCompatibilityTick`)
  runs at the boundary tick N+1. So the food current for a decision at `currentTick` is the season
  that just ended (`periodTick === currentTick − 1`). A zero-harvest season leaves `periodTick`
  stale ⇒ credits exactly zero, and old food can feed only the single immediately-following
  boundary — never many later zero-harvest seasons.
- **`recentIntraSeasonTrips` is unchanged** and remains for its ~35 behaviour/UI readers; it is
  simply no longer authoritative for food accounting.
- **Fission daughters** reset the accumulator (added to `DAUGHTER_NON_CLONEABLE_FIELDS` clone
  guard + explicit `seasonalFoodReceipts: undefined`); founders start clean (optional field).

Files changed (production): `types.ts`, `seasonalFoodReceipts.ts` (new), `intraSeasonTrips.ts`,
`expedition.ts`, `humanFoodSupport.ts`, `carryingCapacity.ts` (passes `time.tick`),
`demography.ts`, `architecture/graphData.ts` (new `seasonalFoodReceipts` node + re-routed edges).

---

## 3. Controlled verification — `scripts/recoveryFoodAccountingAudit.mjs` (PASS, 18/18)

Ground truth ("physically returned usable food") is measured INDEPENDENTLY of the accumulator:
each season is replayed one day at a time with `runDailyActions` on a throwaway copy, and every
new credited trip record is captured by object identity BEFORE the 24-cap can evict it (filtered
to the current period tick).

| Founder | maxTrips/season | eviction seasons | returned | credited | **capture** | old-window capture |
|---|---|---|---|---|---|---|
| Delta Reed | 29 | 22 | 8.3826 | 8.3826 | **1.000** | 0.795 |
| Green River | 28 | 20 | 10.0306 | 10.0306 | **1.000** | 0.805 |
| Lake Marsh | 29 | 24 | 7.9918 | 7.9918 | **1.000** | 0.720 |
| Pass Edge | 28 | 24 | 4.5236 | 4.5236 | **1.000** | 0.611 |
| Dry Margin | 28 | 24 | 2.0592 | 2.0592 | **1.000** | 0.494 |

- **Capture = 1.000** for every founder; per-season capture always complete; `receiptCountScanned
  === receiptCountAccumulator` (each receipt once); conservation `credited ≤ returned` holds.
- **Eviction is real** (28–29 trips/season > 24) and the **old algorithm reproduces the loss** on
  the same history (a mechanistic reproduction of the mainline defect).
- **Freshness:** a productive season credited (0.5, foodStress < 1) at the boundary; the first and
  later zero-harvest seasons credit exactly 0 with foodStress = 1; a later harvest resets the
  period (not accumulated across seasons).
- **Same-day and expedition paths** both credit once; non-food returns rejected; both production
  wiring sites confirmed; the ledger reads the accumulator, not `band.recentIntraSeasonTrips`.

---

## 4. Default-map before/after (150 years, identical seeds s1/s2/s3)

`scripts/founderTrajectoryAudit.mjs`, run unchanged against a `main` (e539813) git worktree
(BEFORE) and this branch (AFTER). Final population per seed.

### Map 1

| Founder | start | BEFORE (s1/s2/s3) | AFTER (s1/s2/s3) | mean B→A | lost reference (broken→corrected) |
|---|---|---|---|---|---|
| Delta Reed | 34 | 31 / 33 / **0** | 29 / 38 / 40 | 21.3 → 35.7 | 28 → 30 |
| Green River | 38 | 27 / 32 / 27 | 31 / 32 / 33 | 28.7 → 32.0 | 24 → 33 |
| Lake Marsh | 31 | 24 / 27 / 23 | 31 / 27 / 30 | 24.7 → 29.3 | 23 → 25 |
| Pass Edge | 27 | 17 / 14 / 13 | 16 / 17 / 17 | 14.7 → 16.7 | 15 → 20 |
| Dry Margin | 25 | 10 / **0** / **0** | 15 / 12 / 12 | 3.3 → 13.0 | 12 → ~17–19 |

The improvement is proportional to how much food the band was previously losing to eviction. No
floors, no founder-specific rescue. **Dry Margin materially improves** (extinct in 2/3 seeds →
survives all 3). Reference values were investigated as guidance, not hardcoded; the reconstruction
is in the corrected direction for every founder without matching the lost environment exactly.

### Map 2

| Founder | start | BEFORE (s1/s2/s3) | AFTER (s1/s2/s3) | mean B→A |
|---|---|---|---|---|
| Estuary | 30 | 30 / 27 / 30 | 35 / 33 / 33 | 29.0 → 33.7 (**grows above founding**) |
| Long River | 34 | 23 / 24 / 24 | 27 / 25 / 25 | 23.7 → 25.7 |
| Basin Crowd East | 28 | 19 / 20 / 20 | 22 / 23 / 20 | 19.7 → 21.7 |
| Creek Plains | 24 | 19 / 16 / 17 | 21 / 14 / 21 | 17.3 → 18.7 |
| Rich Basin | 31 | 13 / 14 / 12 | 18 / 18 / 17 | 13.0 → 17.7 |
| Basin Crowd West | 28 | 10 / 12 / 11 | 12 / 15 / 11 | 11.0 → 12.7 |
| North Frontier | 16 | **0 / 0 / 0** | 9 / 9 / 9 | 0.0 → 9.0 (**rescued**) |
| Upper Corridor | 22 | 0 / 0 / 0 | 0 / 0 / 0 | 0.0 → 0.0 (**stays extinct**) |
| Yellow Corridor | 25 | 0 / 0 / 0 | 0 / 0 / 0 | 0.0 → 0.0 (**stays extinct**) |

Qualitative controls all hold: Estuary remains capable of growth (now above founding), North
Frontier is rescued from extinction, Upper/Yellow Corridor remain extinct (hostile controls still
die — no universal survival floor).

---

## 5. Step-mode invariance — `scripts/stepModeInvarianceAudit.mjs` (PASS)

Daily vs seasonal stepping, 20 years, each map in its own fresh child process (the sim memoizes
some derivations at module/process scope; production runs one world per process). Using the
population authority `band.demography.population`:

- **map1:** daily ≡ seasonal — populations match (150/150), tick 80/80, full canonical band state
  byte-identical.
- **map2:** daily ≡ seasonal — populations match (215/215), tick 80/80, full canonical state
  byte-identical (after excluding non-causal JSON property-insertion order, which reflects
  `{...band}` rebuild count, not values).

---

## 6. Regression (all executed on this branch)

| Gate | Result |
|---|---|
| `livingEcologyFoodPipelineAudit` | PASS (20/20; adapted to feed the accumulator, not weakened) |
| `postEcologyReturnKindAudit` | PASS |
| `postEcologyTerminalExtinctionAudit` | PASS |
| `foodDemographySeparationAudit` | PASS (incl. diagnostics-off parity) |
| `demographicPersistenceAudit` | PASS |
| `importBoundaryAudit` / `decisionBoundaryAudit` / `adaptationBoundaryAudit` | PASS |
| `livingEcologyTrophicAudit` | PASS (receipt-source invariant re-pointed to accumulator + ledger) |
| `checkGraph` | pass (new node, no dangling links) |
| `stepModeInvarianceAudit` (both maps) | PASS |
| `npx tsc -p tsconfig.json --noEmit` | exit 0 |
| `npm run build` | exit 0 |
| `npm run sim:benchmark -- --deterministic --json` | `matched: true` (fresh-process determinism) |

Four audits that called `deriveHumanFoodSupportLedger` directly were updated for the new
`currentTick` parameter and to build the authoritative accumulator input — assertions preserved,
not weakened (one stale source-text invariant re-pointed to the accumulator module, which is
stronger).

---

## 7. Performance and bounds (see `performance.txt`)

`npm run sim:benchmark -- --json` (baseline, 100y = 400 ticks), avgMsPerTick, 3 reps:

- BEFORE (e539813): 21.50 / 22.35 / 22.42 (mean ~22.1)
- AFTER (fix): 23.85 / 22.97 / 23.42 (mean ~23.4)

Delta ~+1.3 ms/tick (~+6%) — a bounded O(1) constant (running sums + a ≤16-receipt display list
per band, carried in the per-band spread). Retained state: one accumulator per band, reset each
season, bounded independently of simulation age; no full-map scans, no unbounded receipt history;
deterministic. maxMsPerTick 56.2 → 57.1.

---

## 8. Remaining demographic-growth work (out of scope here)

This checkpoint only reconstructs food-receipt accounting. It did NOT investigate demographic
growth compression, and did not touch fertility, mortality, demographic clamps, fission, ecology
density, hydrology, map scale, food yields/demand, movement selection, adaptation, storage, or
seasonal migration. Better-fed bands now survive/recover materially better, but several founders
still finish below founding population and the corridors remain honestly extinct — the demographic
net-rate response and the standing same-day practical-reach limitation remain the next targets, to
be addressed by the separate demographic-response checkpoint. Ecology and human-survival programs
are NOT marked complete.
