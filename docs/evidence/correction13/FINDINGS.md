# DEMOGRAPHIC RESPONSE COMPRESSION CORRECTION-13

**Verdict: PASS CANDIDATE.**

Makes honest surplus produce growth and severe deficit produce real decline, by correcting the
one measured defect that compressed the demographic response. Narrow demographic checkpoint —
no change to ecology adequacy, Layer B, hydrology, map scale, mobility, adaptation, storage,
seasonal migration, culture, or fission. The RECOVERY-12 food-accounting pipeline is preserved
and authoritative (receipt capture remains `1.000`).

## Git integration note

Phase 1 (fast-forward RECOVERY-12 into public `main`) was completed and verified at
`32c6b905d8f2de1ff59ef8865473e588c8f6e18d` (pushed `e539813..32c6b90`). The maintainer then made
a small metadata commit on `main`; in the process the RECOVERY-12 commit is now `022f213`
(byte-identical tracked tree to `32c6b90`, same parent `e539813`) and `origin/main` is
`22123aa` ("chore: refresh repository metadata", tracked tree byte-identical to `32c6b90`,
containing RECOVERY-12 as `022f213`). CORRECTION-13 is based on the **current public `main` =
`22123aa`**, which contains RECOVERY-12.

- **Starting HEAD:** `22123aa` (current public `main`; contains RECOVERY-12 `022f213`).
- **Branch:** `checkpoint/demographic-response-compression-13`.
- **Commit message:** `checkpoint: correct demographic response compression`.

---

## 1. Measured first compression point (nutrition state)

Demography runs **annually** (spring-gated, `shouldRunAnnualDemography`), so `growthRate` is a
per-year rate. `computeBandDemography` composes it as:

```text
uncappedDemographicRate = survivalBaseline(0.002)
                        + fertilityPressure × 0.012      [fertilityPressure ∈ [0,1]]
                        − mortalityPressure × 0.014      [mortalityPressure ∈ [0,1]]
                        − direct/severe food penalties
growthRate = clamp(uncapped, maxDeclineRate[−0.018..−0.055], maxGrowthRate[0.004..0.014])
```

Reconciliation (`advancePopulationAccounting`) is a clean sign-gated single net rate with
fractional accumulators preserved across years (no rounding loss) — it is **not** the defect.

**The first compression point is the NUTRITION STATE.** `deriveCanonicalNutritionState`
(`seasonalSurvival.ts`) has:

```text
foodDemographicPressure = clamp01(current×0.38 + recent×0.26 + chronic×0.48 − recoveryRelief×0.14)
```

with `foodStress = clamp01(1 − rawSupportRatio) = 0` for any support ratio ≥ 1. The `clamp01`
**floors the food signal at 0**, and `recoveryRelief` can only cancel stress toward 0 — never
below. So the food→demography signal is **one-sided: it penalizes deficit but has no
representation of nutritional surplus.**

**Measured (controlled composition audit, `demographicCompositionAudit.mjs`), BEFORE fix:**

| arm | ratio | fertP | net rate/yr | 150y pop |
|---|---|---|---|---|
| A strong surplus | 1.5 | 0.54 | **+0.0074** | 34→**94** |
| B maintenance | 1.0 | 0.54 | **+0.0074** | 34→**94** |
| C moderate deficit | 0.72 | 0.40 | +0.0023 | 34→47 |
| D severe deficit | 0.32 | 0.18 | −0.0073 | 34→11 |

**Strong surplus (ratio 1.5) is byte-identical to bare maintenance (ratio 1.0)** — same nutrition
(both pressure 0), same fertility, same rate, same trajectory. `strongGtMaintenance: false`. This
is the "current surplus unable to repair physiological state" defect: genuine surplus cannot
produce recovery-driven growth beyond maintenance. (The vital-rate weights also keep the whole
response inside ≈ `[−1.2%, +1.4%]`/yr, matching the reported band.)

---

## 2. Production correction (the symmetric surplus signal — only the measured defect)

Added the positive counterpart the food signal was missing. **No** arbitrary fertility increase,
**no** global mortality change, **no** floor, **no** founder/habitat rule, **no** food-yield/demand
change.

- `seasonalSurvival.ts` — new bounded `nutritionalSurplus ∈ [0,1]` on the canonical nutrition
  state: `clamp01(clamp01((meanRawSupport − SURPLUS_ONSET) / SURPLUS_SPAN) × recoveryRelief)`,
  with `SURPLUS_ONSET = 1.12` (a band exactly at demand is stable, not growing) and
  `SURPLUS_SPAN = 0.6`. `meanRawSupport` is the UNCAPPED rolling mean raw support (the existing
  `rolling*SeasonSupport` fields use the clamped ratio ≤ 1, so surplus was invisible); it is
  cached once per season as `rolling8SeasonRawSupport` so the read stays O(1). The
  `recoveryRelief` gate (the existing sustained-recovery streak) means a single good season
  cannot manufacture growth.
- `demography.ts` — `deriveFoodDemographyRateTerms` adds `foodFertilitySurplusBonus =
  nutritionalSurplus × 0.22` (production/de-stacked only; **symmetric** with the existing
  `foodFertilitySuppression` 0.22 weight), wired into `fertilityPressure` in
  `computeBandDemography` and surfaced on `BandDemography` for Technical/audit attribution.

The term is **exactly 0 at maintenance and below**, so maintenance and every deficit arm are
unchanged; it only decompresses the surplus end the clamp-at-zero food pressure could not
represent.

---

## 3. Controlled before/after response (`composition_arms.json`)

Realistic fixed non-food baseline (waterStress 0.34 / riskPressure 0.42), identical starting
structure and deterministic inputs for all arms; food fed through the real
`updateSeasonalSupportState` interface; population never written directly.

| arm | net rate/yr | 150y pop | |
|---|---|---|---|
| A strong surplus | **+0.0062** | 34→**80** | visible growth |
| B maintenance | +0.0045 | 34→64 | mild/stable (unchanged by fix) |
| C moderate deficit | −0.0006 | 34→32 | gradual decline |
| D severe deficit | **−0.0102** | 34→**7** | materially faster decline |
| E surplus + one hazard | +0.0040 | 34→61 | growth reduced, attributed to the hazard |

Ordering now holds in raw/net rate and in the trajectory:
`strong(+0.0062) > maintenance(+0.0045) > moderate(−0.0006) > severe(−0.0102)`
(`strongGtMaintenance: true`, `maintenanceGtModerate: true`, `moderateGtSevere: true`,
`severeMateriallyWorseThanModerate: true`, span 0.0164/yr).

**Transients:** one severe season amid maintenance → population delta 0 (not fatal); one strong
season amid maintenance → `nutritionalSurplus` stays 0 and delta 0 (no explosive growth — the
recovery gate requires sustained surplus).

---

## 4. Production validation (150y, `founder_*` evidence) — no regression

Real default founders live in **persistent food pressure** (measured meanFoodDemographicPressure
0.40–0.99, mean raw ledger ratio 0.16–0.48): they are **not genuinely surplus** (season-level, not
a misleading average), so they correctly stay marginal — the surplus term fires rarely and does
not rescue them. Every RECOVERY-12 control is preserved:

- **Dry Margin** (Map 1): 15/12/12 → 13/12/12 — RECOVERY-12 resilience preserved (no hidden rescue).
- **Estuary** (Map 2): 35/33/33 → 35/33/33 — remains capable of growth (above founding 30).
- **North Frontier** (Map 2): 9/9/9 → 9/9/9 — survival rescue preserved.
- **Upper Corridor / Yellow Corridor** (Map 2): 0/0/0 → 0/0/0 — hostile controls still extinct
  (no universal survival floor; severe insufficiency remains lethal).
- Other Map 1/Map 2 founders: within noise of RECOVERY-12; small deterministic shifts where the
  surplus term occasionally fires, then density-dependent feedback rebalances (honest).

The primary user-visible defect (surplus === maintenance) is fixed at the mechanism level and
proven in the controlled arms; default founders don't grow because they are genuinely
food-limited (an ecology/reach limitation that is explicitly OUT OF SCOPE here), not because of
the demographic compression.

---

## 5. Fission observation (not implemented)

Thresholds: `SPLIT_PRESSURE_THRESHOLD = 0.64` (crisis breakaway at ≥ 0.48), growth-viable split
requires population ≥ 32 (`DAUGHTER_MIN_POPULATION + 14`) + fission cooldown + `bands < MAX_BANDS`.
In the controlled surplus arm a single band reached ~80–117 (single-band audit, no fission path).
In production the default founders remain marginal (peaks near/at founding), so `splitPressure`
does not reach the threshold and no eligible fission is observed or missed. Fission was neither
implemented nor used as an explanation for zero growth.

---

## 6. Conservation, capture, step-mode, regression, determinism, performance

- **Reconciliation:** `demographicLongRunAudit` `reconciles: true` (start + births − deaths = end);
  reconciliation code unchanged by this fix; cohorts reconcile to the integer population.
- **Receipt capture 1.000 + freshness:** `recoveryFoodAccountingAudit` PASS (unchanged food pipeline).
- **Step-mode invariance (both maps):** `stepModeInvarianceAudit` PASS (the cached raw-support field
  is built per-season, identically in daily/seasonal stepping).
- **Regression (all executed, PASS):** recovery food-accounting, living-ecology food pipeline,
  food-demography separation, demographic persistence, terminal extinction, post-ecology return
  kind, import/decision/adaptation boundaries, trophic, graph integrity, tsc, production build.
  One defensive guard was added (`recentSamples`/`rolling8SeasonRawSupport` may be absent in audit
  fixtures / legacy snapshots) after a fixture surfaced it — no assertion weakened.
- **Determinism:** `sim:benchmark --deterministic` `matched: true`.
- **Performance:** BEFORE (22123aa) ≈ 23.55 → AFTER ≈ 25.49 ms/tick (~+8%), a bounded O(1)
  constant (O(1) per band per demographic read; rolling raw support cached once per season; no
  full-map scans; no unbounded history). See `performance.txt`.

---

## 7. Remaining architecture debt (unchanged, not marked complete)

Ecology/human-survival is **not** complete. The default founders' marginality is a
food-reach/ecology-adequacy limitation (Layer B / logistical range / climate), explicitly out of
scope here. The single net-rate demographic model and reconciled age cohorts remain. Fission,
seasonal migration, adaptation depth, and culture remain roadmap items.
