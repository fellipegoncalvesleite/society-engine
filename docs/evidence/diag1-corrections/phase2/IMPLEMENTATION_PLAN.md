# DIAG-1 Phase2 units, exposure and recency implementation plan

> **For agentic workers:** Use superpowers:executing-plans in this same session. The user selected one primary repository writer and a committed/pushed candidate followed by supervising independent review; implementation delegation and self-acceptance are excluded.

**Goal:** Make the same usable physical food mean the same support, make nutrition history describe elapsed physical time without competing producers, and let old residential-movement fatigue recover with actual rest time.

**Architecture:** Preserve the existing support owner and compatibility projections, replacing its record-count arithmetic with bounded physical intervals and exact exposure measures. One pure raw-food conversion is shared by residential and provisional consumers. A time-based movement component remains separate from other embodied burdens and is refreshed for actual daily mobility readers.

**Tech Stack:** Existing TypeScript pure reducers; Vite source-preserving Node audits; existing daily-action registry and physical clock.

**Spec:** `CONTINUATION_SPEC.txt`, Phase2 section. Exact reviewed base: `d8c6233872b6bcb76da5fe6c3747c889ec402eb9`, recorded before edits in `PHASE2_BASE.json`.

## Global constraints

- Production conversion: 1 usable raw harvest unit = 100 adult-equivalent-season support units. Physical extraction, losses, stock, requests and carrying limits remain raw.
- Nutrition retention: at most720 completed physical days plus one open interval; annual read: previous360 completed days. Physical clock remains unchanged.
- Use half-open exposure intervals `[startDay,endDay)`; daily action D represents `[D-1,D)`, matching the runner's completed `(start,end]` daily-action convention.
- Exact same interval/provenance revision can replace; distinct nonoverlapping intervals coexist; conflicting overlaps refuse explicitly. Unmeasured gaps remain unknown.
- Store experienced food/water stress and recovery exposure separately from pooled support/demand. A later surplus cannot repay an earlier hungry day.
- Movement contribution: latest four genuine displacements, existing amplitude0.2 each, `max(0,1-elapsedDays/7)`. Validate timestamps; zero displacement contributes0. Preserve the80-entry historical movement ring and all other fatigue components.
- No coefficient, fertility, mortality, yield, source density, action-score, trip-budget or route-distance tuning. No new stock, food, knowledge, permanent travel-nutrition authority, deposit-ID registry or unbounded diary.
- All six live provisional phases have exclusive provisional nutrition ownership. Release/return transitions close the outgoing interval once and establish an explicit next start boundary.
- Legacy migration is pure and typed. Known ordinary90-day abstractions remain honest90-day abstractions; provisional spans require retained chronology. Otherwise return unsupported migration with original input untouched.
- Task12 remains paused; Phase3 and every other later finding stay outside scope. Canonical bundle r11 remains byte-identical.
- The user's explicit conditional continuation already authorized native implementation after the clean independent gate. Default skill spec/plan approval prompts do not add another authorization gate to that instruction.

## Review focus

1. A saved provisional band can contain raw-unit open/operation/site values and ambiguous interval dates: migrate all supported owners together or refuse the untouched input.
2. A return can occur before today's subsistence action: account for the actual outgoing physical span without extending yesterday's observation or skipping the transition day.
3. Fission and reintegration carry embodied history without copying food inventory or pretending another season elapsed: preserve the existing aggregate-body condition boundary and actual chronological coverage.
4. A horizon can cut through an interval containing both hunger and surplus: retain enough piecewise exposure information to clip exactly, with ordinary seasonal records explicitly identified as coarse measurements.
5. Merely aging a pressure helper at seasonal calls leaves daily pace stale: verify the actual daily mobility/candidate reader after rest without creating a movement event.

## Task 1 — baseline and behavioral REDs

**Files:** create `scripts/diag1Phase2UnitsAndExposureAudit.mjs`, `scripts/diag1Phase2FatigueAudit.mjs`; evidence under this directory. Use the independently verified exact-head snapshot for baseline runs; never edit that snapshot's source.

- [x] Build source-preserving harnesses with explicit fresh output paths, real source hashes, exact source HEAD and actual module/call counters for mutants.
- [x] Execute a real plant extraction and route identical usable raw food/demand through ordinary and provisional paths. Assert matched1.2 support /0.12 ratio for the0.013 take,0.001 loss,0.012 usable,10 demand discriminator when the real fixture yields those values; record actual source/depletion independently.
- [x] Execute existing interval writer/readers with180 deficit days then180 adequate days in30/90/mixed partitions. Assert equal annual exposure, demand-weighted pooled support, retained hungry-day exposure, exact revisions/coexisting intervals, overlap refusal and explicit gaps. Baseline must fail behaviorally, not at module load.
- [x] Execute pressure/pace with identical actual movement history at ages0,3,7,14 and after actual idle daily steps. Assert decay with unchanged history, recent-repeat burden, separate injury and explicit invalid/future timestamp refusal. Baseline stale movement mechanism must fail.
- [x] Preserve pre-edit outputs and the source identity before implementing production changes.

## Task 2 — one food unit bridge through every provisional consumer

**Files:** `humanFoodSupport.ts`, `provisionalTravelSubsistence.ts`, `provisionalEstablishment.ts`, `postReturnContinuation.ts`, relevant declarations in `types.ts`; audit above.

**Interfaces:** `convertUsableRawFoodToSupportUnits(usableRaw:number,scale=100):number`; a versioned support-unit value on the existing daily travel record; existing physical `usableUnits` stays raw.

- [x] Export the pure named conversion from the existing food-support owner and route its own ledger through it without changing sensitivity support or production scale.
- [x] Convert actual usable daily harvest once as it enters human support. Feed that value to travel totals, open/completed operation windows, site measures and return/continuation readers; preserve raw extraction/loss/depletion and raw work-efficiency denominators.
- [x] Add zero-source/depletion, partial/30/90-day, return/establishment/reintegration controls, plus a loaded/executed old-unit mutant.
- [x] Define coherent typed migration of supported legacy unit-bearing records; prove input preservation on refusal and no mixed old/new unit owners.

## Task 3 — bounded exposure algebra and compatibility projections

**Files:** create `src/sim/agents/nutritionExposure.ts`; modify `types.ts`, `seasonalSurvival.ts`, `demography.ts`; audit above.

**Interfaces:** `NutritionExposureInterval` with physical span, producer/provenance, actual support/integrated demand and bounded piecewise food/water/recovery exposure; `queryNutritionExposure(history,endDay,horizonDays)` returning coverage/gaps, pooled quantities and experienced exposure; `migrateNutritionExposureHistory(input,retainedChronology)` returning supported or typed unsupported result.

- [x] Represent interval information inside the existing seasonal-support authority, with completed history and at most one open interval. `recentSamples` and existing season-valued fields remain compatibility views of this same authority, never competing producers.
- [x] Implement validated ordered append/exact revision, explicit overlap refusal, gap reporting, exact clipping and720-day trimming. Consecutive identical-rate segments may coalesce; no clipping assumes that a heterogeneous interval was uniformly comfortable.
- [x] Derive duration-based deficit/water/recovery streaks and compatibility season values as days/90, preserving existing thresholds and pressure coefficients. Separate experienced stress from pooled support and surplus.
- [x] Make annual nutrition and the diagnostic annual raw-support reader use explicit prior360-day queries at the actual annual simulation day. Current/recent/chronic queries declare their physical horizon and availability.
- [x] Cover all specification partitions, unequal demand, surplus-after-hunger, revisions, gaps, overlaps, unknown history and ordinary90-day equivalence. Restore old record-count logic in memory and require behavioral detection.
- [x] Prove legacy ordinary chronology and supported retained provisional chronology; ambiguous/inconsistent histories return typed unsupported results without mutation. Add a migration mutant that is actually exercised.

## Task 4 — exclusive producer ownership and lifecycle continuity

**Files:** `provisionalTravelSubsistence.ts`, `seasonalSurvival.ts`, `socialContext.ts`, `fissionDepartureSeam.ts`, `provisionalReintegration.ts`, `successorStabilization.ts`, `postReturnContinuation.ts`, and only the necessary daily registry/producer boundary adapter.

**Interfaces:** explicit open/update/close operations on the same nutrition authority; completed-day ownership and transition boundaries passed from the actual lifecycle event, never inferred from record count or the last tick alone.

- [x] Residential measurements cover only actual residential intervals and integrated demand. All six active provisional phases refuse the residential writer, including spring annual/context refreshes.
- [x] Daily provisional measurement updates the one open exposure with actual support/demand and that day's experienced stress; close on actual30-day/phase boundary, retaining partial intervals exactly once.
- [x] Close outgoing producer and start incoming producer on departure, stabilization, failed-return changes and reintegration. Preserve embodied-condition inheritance/merge without appending a fictional season or moving physical food/people twice.
- [x] Rerun the real canonical2100/2130 courses and inspect annual inputs, producer spans and transitions. Both now legitimately stabilize before2160 after the unit correction. The explicitly later2150 controlled departure supplies the live annual crossing; this date deviation remains disclosed for supervising review.
- [x] Restore the residential/provisional overlap mechanism in memory and demonstrate a loaded/executed ownership failure. No weakened lifecycle gate or fabricated natural occurrence.

## Task 5 — actual physical-time movement fatigue

**Files:** create `src/sim/agents/movementFatigue.ts`; modify `pressure.ts`, `types.ts`, `dailyActionRegistry.ts`; audit above.

**Interfaces:** `deriveRecentMovementFatigue(history,currentDay,horizonDays=7):number`; pressure-owned daily refresh of only this component, using the existing daily registry before mobility readers.

- [x] Validate finite nonnegative real timestamps and reject future/inconsistent values; retain only the latest four genuine displacement contributions for current fatigue, keeping history intact.
- [x] Apply the selected7-day linear decay. Keep an explicit uncapped nonmovement fatigue component so daily replacement cannot erase injury/sickness or lose information through a previous clamp.
- [x] Refresh the actual fatigue/pace input during idle daily advancement. Derive legacy pressure decomposition through the existing pressure owner when necessary, without inventing a past component.
- [x] Verify ages0/3/7/14, production daily rest, repeated recent movement, zero displacement, health persistence, clone/save parity, no food/knowledge creation and physical-route invariance. Execute the old permanent-fatigue mutant and3/7/14 sensitivity without choosing by population outcome.

## Task 6 — coherent validation, natural comparison and bounds

**Files:** focused audits and a reproducible natural comparison harness; relevant existing audits; architecture graph owner metadata for newly introduced modules; evidence/validation manifest.

- [x] Run all required Phase1/1B safety regressions on the complete Phase2 candidate, plus affected departure/subsistence/operation/return/stabilization/failed-continuation/reintegration/annual/ordinary/surplus/body/food/mobility/SCALE-1/context checks. Preserve both explicitly inherited residuals and prove duplicated hunger penalties remain absent.
- [x] Compare exact reviewed Phase1 baseline versus final Phase2 on identical good/exceptional Map2 sites, seeds, populations and30-year horizons, with good-site years2–6 traces. Report first causal divergence and separate food taken/returned/support/demand/experienced stress/pace/candidates/trips/births/deaths/population. Preserve whole-fatigue-removal only as historical diagnostic evidence.
- [x] Measure retained exposure count, serialized bytes, long-horizon bounds, existing mobility-history size, relevant caches and bounded-population runtime. No population-growth pass condition.
- [x] Run source-stable daily/weekly/monthly/seasonal/repeat/fresh-process complete-state comparisons, both TypeScript projects, production build, import boundary and graph integrity. Record real commands, configurations, hashes, durations and limitations.

## Task 7 — publish review candidate and stop

- [x] Write final Phase2 report, RED/GREEN/mutants, natural causal comparison, bounds/performance, validation and future-evolution contract; update complete cumulative record/current instructions without inventing acceptance or freeze.
- [x] Recheck canonicalr11, protected Task12 HEAD/status/three dirty files/full diff, exact reviewed base, human Git author, clean staged scope and recorded test-source identity.
- [x] Make coherent new production/evidence and documentation commits, push only `fix/diag1-human-support`, verify exact remote parity and clean worktree. No reset/rebase/amend/force push/merge.
- [x] Export complete portable record and unchanged canonical bundle plus the25-item human-readable report. STOP for supervising independent Phase2 review. PHASE3 NOT STARTED; WORLD-M0 TASK12 NOT RESUMED.

Publication bookkeeping: source and focused evidence are committed as `369362c5b51757407e34493d9f9dcbeae86abdac`. Final documentation commit, branch-only push, clean remote parity and portable export verification are attested after commit by the exported `PUBLICATION.json` and package manifest. No acceptance/freeze is inferred from completed implementation tasks. Required regressions were executed; their refused/inconclusive cases remain explicit, not relabeled PASS.
