# DIAG-1 Phase 1 bounded reopening — before production edits

Authority: explicit user Phase 1 instruction. Status: IMPLEMENTATION IN PROGRESS; no acceptance.
Base: 73cc38b916e236339897c59686638efafd569b6e (tree dcbedbed81f70a6ffc6e3c7ffb245e039a9254c6).
Implementation owner: this correction worktree's single implementation engineer. Acceptance owner: independent reviewer and supervising architect.

## B-001 — expedition cargo provenance
Invariant: every admitted raw usable food unit ends in remaining cargo, delivered food, applied provision charge, or explicit post-admission loss. Extraction, processing, transport and overflow remain upstream. No source invented, no return implies no residential receipt.
Causal owner: expedition lifecycle and its bounded cargo authority; seasonalFoodReceipts remains the deposit owner without formula changes.
Blast radius: expedition work/capacity/injury/return/loss, scalar/read-model projections, legacy resumed-party admission, numeric cargo oracle. Three work operations maximum; one actual physical source per current resolveExpeditionTargetWork call. Full stores and provision rates excluded.
RED: baseline/nutrition/expedition-controls-results.json records .0377 + .0148 + 0 - .022 = .0305 versus delivered 0. Natural diag1b:s1 and s2 record .0638 + .0302 + .0199 - .036 = .0779 versus .0199. Real owners executed; independent arithmetic never clamps to final receipt.

## B-002 — established absorption transaction
Invariant: current bodies before = current bodies after + declared removals; transfers add zero. Incoming bodies/traces survive later roles; eligibility derives from committed current state.
Causal owner: updateBandViabilityStates, deterministic one-pass sorted-ID sweep.
Blast radius: established-band absorption and affected viability projections only. Existing distance, risk/collapse thresholds, aggregate recomputeDemographicCounts cohort policy and provisional exclusion retained. Cohort redistribution remains Item 6 debt.
RED: baseline/integration/absorption-minimal.json actual A8/B8/C30 sweep loses 8 of 46 bodies with zero declared removals; fresh-object diagnostic counterfactual conserves them. Correct live eligibility may stop B at 16.

## B-003 / F2 — plant cache dependencies
Invariant: identical physical state and causal time yield identical descriptions, take and depletion independently of cache/observer history. Cache is derived, bounded and never the dynamic stock authority.
Causal owner: plantStock's per-tile memo of plantPatches materialization.
Blast radius: memo key/storage only, preserving formulas, top-three realization and coefficients. Include year/season/seasonIndex/tick and verify tile dependencies; guard in-place tile mutations through a structural causal-input revision. Current depletion always read from world.
RED: baseline/cache-controls.json and baseline/logs/cache-controls.log (exit 1) compare same year-1 clocks after year-0 priming; summer .0389 vs .0583 and .0605 vs .0538; all seasons included. Input immutability controls passed.

## B-004 / F6 — residential labor admission
Invariant: no productive worker implies no performed work, take/depletion, receipt, journey/arrival or observation learning. Prepared/away commitments and already-used same-day labor cannot be spent twice.
Causal owner: bandMobility available pools, intraSeasonTrips selection/execution and remaining-investigation admission.
Blast radius: local same-day staffing and investigation remainder; positive shares/caps, body-based provision rates and nonworking-person distinctions unchanged. Pending investigations do not reserve in advance (existing priority is ordinary trip then investigation).
RED: baseline/extra-controls.json actual zero-adult band has canonical available pools 0, yet creates one worker and .0148 usable food (.017 raw take); matched 20-adult positive control works.
