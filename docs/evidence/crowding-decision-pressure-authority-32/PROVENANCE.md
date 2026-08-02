# CORRECTION-32 — PROVENANCE

Exactly what was run, on what tree, to produce each file in this directory. Every claim in
`FINDINGS.md` traces to a row here.

## 1. Trees

| Arm | Tree | How |
| --- | --- | --- |
| **before** | `3e2c1215b4ccef2beb799b3a7882247f6cd186cd` (CORRECTION-31 tip, frozen) | a detached `git worktree` at the scratchpad, with `node_modules` symlinked from the main checkout and the CORRECTION-32 audit scripts copied in |
| **after** | `checkpoint/crowding-decision-pressure-authority-32` | the working checkout |

Both arms ran the **same script files**. Every audit imports only functions exported by both
commits, and reads `rangeSaturation.saturationPressureExcludingCrowding` through a
`?? saturationPressure` fallback so the before arm is valid rather than crashing.

Preflight verified before any edit: HEAD `3e2c1215…`, clean tree, `main` local and remote at
`0a43083a…`, merge-base `0a43083a…`, one worktree, no stashes, and CORRECTION-27 → -31 branch tips
identical to their remotes (`b352c31`, `c5eb58a`, `a15d0a7`, `1c6a3ed`, `3e2c121`).

## 2. The instrument

`getNearbyBandPressure` (`agents/crowding.ts:24`) reads
`cache.nearbyBandPressureByBandTileKey` **first** and returns the memo when present. Every
counterfactual arm therefore builds a real `TickContextCache` and replaces that one `Map` with a
`Map`-like that answers "no nearby band" (`weightedCrowding 0`, `nearbyBandCount 0`,
`confidence 0.48` — `buildPressureResult`'s own value for an empty neighbourhood) for every key.
Real production code then re-derives everything downstream with the physical-crowding input at
zero:

```text
deriveBandPressureState        → riskPressure, mobilityPressure, placeAttachmentPull, netMovePressure
applyRangeSaturationContext    → rangeSaturation AND carryingCapacity
getDaughterDispersalPressure   → parentCoreOverlap, safeFrontierPull, daughterDispersalPressure
evaluateBandDecision           → every candidate's ScoreBreakdown and score
```

**No production formula is re-implemented in any audit.** This is CORRECTION-31's
with-minus-without shape applied to the decision score instead of to access pressure.

Two attribution levels, never blurred:

- **TOTAL** — `evaluateBandDecision` run twice on the same world and subtracted. Captures every
  path, including those nested inside `explorationValue`, `expectedFutureValue`, `recoveryBenefit`
  and `badSiteStuckResidencePenalty`.
- **DIRECT** — one field group substituted in the real `ScoreBreakdown`, then the exported pure
  `scoreDecision` re-run. Exact, because `scoreDecision` is linear in its fields.
- **RESIDUAL** = TOTAL − Σ DIRECT, reported per candidate.

Composite fields are substituted with the value the **same production function** returns when
crowding is zero, scaled by whatever candidate-local factor the builder applied (recovered as the
observed ratio). Where that ratio is second-order — `netMovePressure`'s `groundedRelief` factor
itself contains `recoveryBenefit ⊃ netMovePressure × 0.32` — the DIRECT figure is first-order and
the TOTAL is exact. This is stated rather than hidden.

## 3. Commands

```bash
# attribution matrix (§13)
node scripts/crowdingDecisionAttributionAudit.mjs --arm before --seasons 14 \
  --out docs/evidence/crowding-decision-pressure-authority-32/counterfactual-matrix-before.json   # in the before worktree
node scripts/crowdingDecisionAttributionAudit.mjs --arm after  --seasons 14 \
  --out docs/evidence/crowding-decision-pressure-authority-32/counterfactual-matrix.json

# controlled fixtures P1-P21 (§14)
node scripts/crowdingDecisionAuthorityFixturesAudit.mjs --arm before --seasons 14 \
  --out .../controlled-fixtures-before.json                                                        # in the before worktree
node scripts/crowdingDecisionAuthorityFixturesAudit.mjs --arm after  --seasons 14 \
  --out .../controlled-fixtures.json

# natural occurrence (§16) — same maps/seeds/scenarios/durations as AUDIT-27 .. CORRECTION-31
node scripts/crowdingDecisionAuthorityNaturalAudit.mjs --years 20 --arm {before,after}
node scripts/crowdingDecisionAuthorityNaturalAudit.mjs --years 50 --arm {before,after}
#   scenarios map1,map2,ordinary   seeds s1,s2   seed-prefix audit27:natural

# behavioural first-divergence trace
node scripts/crowdingDecisionAuthorityBehaviorTrace.mjs --arm {before,after} --years 20

# validation (§18)
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.node.json --noEmit
npm run build
node scripts/checkGraph.mjs
node scripts/importBoundaryAudit.mjs
node scripts/seasonOrderInvarianceAudit.mjs
node scripts/stepModeInvarianceAudit.mjs      # captured as step-mode-equivalence.json
node scripts/catchmentInvariants.mjs
node scripts/livingEcologyFoodPipelineAudit.mjs
node scripts/mobilityAuthorityAudit.mjs
node scripts/socialCausalityAudit.mjs         # run on BOTH arms and diffed

# prior checkpoints, rerun on BOTH arms with EXPLICIT --out into the scratchpad
node scripts/crowdingControlledFixturesAudit.mjs        --out … --timeline-out …
node scripts/crowdingMemorySeparationFixturesAudit.mjs  --out …
node scripts/encounterProvenanceFixturesAudit.mjs       --out …
node scripts/rangeFrictionProvenanceFixturesAudit.mjs   --out …
node scripts/rangeReleaseLifecycleFixturesAudit.mjs     --out … --timelines …
```

**Frozen evidence.** `docs/evidence/crowding-shared-range-authority-27/`,
`crowding-physical-memory-separation-28/`, `shared-range-encounter-provenance-29/`,
`shared-range-friction-provenance-30/` and `shared-range-release-lifecycle-31/` are preserved
byte-for-byte. One mistyped flag (`--timeline` instead of `--timeline-out`) overwrote
`crowding-shared-range-authority-27/release-timelines.json`; it was restored with
`git checkout --` and the audit rerun with the correct flag. `git status docs/evidence/` shows only
this checkpoint's new directory.

## 4. Fixture constructions and their synthetic content

Bands **drift** during a warm-up. Every geometric fixture therefore warms on real ground first —
so memory, knowledge, use pressure and depletion are genuine — and only then writes `position`
directly, the construction CORRECTION-28's fixtures established. All such fixtures carry
`syntheticState: true`.

| Fixture | Synthetic content |
| --- | --- |
| P1–P10, P12–P21 | band `position` only |
| P5 | plus the target chosen so one neighbour sits at Manhattan 2 from **both** residence and target |
| P11 | **plus a lineage link** (`parentBandId`, `daughterBandIds`) written with production's own fields, because **no natural fission occurs in 30 simulated years** and AUDIT-27 measured `kinOverlapPairs = 0`. Flagged, and claimed as **no** natural evidence |
| P14, P18, F5, F6 | plus **removal** of the band's 4-neighbour `observedTiles` records, so the `explore_unknown_neighbor` family is generable after a warm-up. Knowledge is only ever removed, never invented |

The natural-occurrence audit and the behaviour trace place **nothing**: they run ordinary
production worlds forward and observe.

## 5. Files

| File | Produced by |
| --- | --- |
| `RESEARCH_AND_CAUSAL_MODEL.md` | §3 causal brainstorming + §4 literature review; hand-written, sources listed inside |
| `ARCHITECTURE_DECISION.md` | hand-written after the before-arm attribution matrix |
| `authority-ledger.md` | §8 inspection of every writer/reader; hand-written from production |
| `influence-graph.md` | hand-written from the two attribution matrices and the natural audits |
| `influence-attribution.json` | assembled from `counterfactual-matrix{,-before}.json` |
| `counterfactual-matrix-before.json` / `counterfactual-matrix.json` | `crowdingDecisionAttributionAudit.mjs` |
| `controlled-fixtures-before.json` / `controlled-fixtures.json` | `crowdingDecisionAuthorityFixturesAudit.mjs` |
| `natural-occurrence-20y{,-before}.json`, `natural-occurrence-50y{,-before}.json` | `crowdingDecisionAuthorityNaturalAudit.mjs` |
| `behavioral-comparison.json` | diff of `crowdingDecisionAuthorityBehaviorTrace.mjs` on both arms |
| `before-after.json` | assembled from all of the above |
| `step-mode-equivalence.json` | `stepModeInvarianceAudit.mjs` verbatim |
| `FINDINGS.md`, `PROVENANCE.md` | hand-written |

## 6. What this evidence does NOT prove

- It does not show that the repair improves survival, population or any outcome. It shows that one
  physical fact now charges a decision once. `crowdedSeasonsWhereCrowdingFlippedSelection` is **0
  in both arms**.
- The 50-year crowding totals are **not** like-for-like: the worlds diverge behaviourally, so the
  two arms sample different crowding events.
- The map2 physical divergences from tick 17/23 are explained **in kind** but **not traced
  decision-by-decision**.
- The single crowding weight `0.96` follows a stated consolidation rule; it is **not** shown to be
  the physically correct magnitude, and no attempt was made to establish one.
- Nothing here tests the `getSocialAccessRisk` replacement against a world that actually has range
  friction at the tile in question; `P10` has 0 friction records in both arms.
