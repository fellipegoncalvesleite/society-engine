# CORRECTION-33 — PROVENANCE

Exactly what was run, on what tree, to produce each file here.

## 1. Trees

| Arm | Tree | How |
| --- | --- | --- |
| **before** | `d11854153e76c2435bce9d53ffde49317e5e8f90` (CORRECTION-32 tip, frozen) | detached `git worktree` in the scratchpad, `node_modules` symlinked from the main checkout, the CORRECTION-33 audit scripts copied in |
| **after** | `checkpoint/social-access-unrelated-risk-provenance-33` | the working checkout |

Both arms ran the **same script files**. Every audit imports only functions exported by both
commits and reads nothing that exists on one arm only.

Preflight verified before any edit: HEAD `d1185415…`, clean tree, `main` local and remote at
`0a43083a…`, merge-base `0a43083a…`, one worktree, no stashes, and every prior checkpoint tip
identical to its remote (`b352c31`, `c5eb58a`, `a15d0a7`, `1c6a3ed`, `3e2c121`, `d118541`).

## 2. Production change

One file, `src/sim/agents/dryMargin.ts`. `unrelatedRisk` deleted from `getSocialAccessRisk`, and
the now-unused `world` parameter deleted with it; both call sites updated. No new constant, module,
store, type or import edge. The base `0.28`, the access-memory coefficient `0.26` and the
known-contact relief `0.08` are untouched.

## 3. The instrument

The decisive isolation needs the observer to be **identical** while only the hidden count varies.
One world containing the observer and 20 remote bands is built and warmed **once**, so every remote
band is genuinely warmed in place with its own catchment, memory and use pressure around its own
distant tile (≥ 30 tiles away, far outside `CROWDING_RADIUS = 4`). Each arm is then a **subset** of
that finished world's `bands` map, so the observer's band object is byte-identical across arms by
construction — asserted as `observerStateIdenticalToBase` on every row.

A first version manufactured remote records by **cloning the observer**; every clone inherited the
observer's catchment and `getOverlappingBandIds` listed all of them. The fixture's own physical
controls caught it. That attempt is recorded in `FINDINGS.md` §7, not hidden.

## 4. Commands

```bash
# controlled fixtures P1-P20 (§11)
node scripts/socialAccessUnrelatedRiskFixturesAudit.mjs --arm after
node scripts/socialAccessUnrelatedRiskFixturesAudit.mjs --arm before \
  --out            <scratch>/c33-controlled-fixtures-before.json \
  --out-threshold  <scratch>/c33-threshold-before.json \
  --out-terminal   <scratch>/c33-terminal-before.json \
  --out-preserve   <scratch>/c33-preserve-before.json \
  --out-water      <scratch>/c33-water-before.json \
  --out-score      <scratch>/c33-score-before.json      # in the before worktree

# natural occurrence (§13) — same maps, seeds and scenario shape as CORRECTION-32
node scripts/socialAccessUnrelatedRiskNaturalAudit.mjs --arm {before,after} --years 20
node scripts/socialAccessUnrelatedRiskNaturalAudit.mjs --arm {before,after} --years 50
#   scenarios map1,map2   seeds s1,s2   seed-prefix audit27:natural

# validation (§17)
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.node.json --noEmit
npm run build
node scripts/checkGraph.mjs
node scripts/importBoundaryAudit.mjs
node scripts/seasonOrderInvarianceAudit.mjs
node scripts/stepModeInvarianceAudit.mjs
node scripts/catchmentInvariants.mjs
node scripts/livingEcologyFoodPipelineAudit.mjs
node scripts/mobilityAuthorityAudit.mjs
node scripts/socialCausalityAudit.mjs
```

## 5. Regressions — EVERY output flag redirected

`--out` alone is **not** sufficient. Two audits carry a second default output path that writes
directly into a frozen evidence directory, and CORRECTION-32A overwrote both by missing them. Every
regression here redirects all of them:

```bash
node scripts/crowdingControlledFixturesAudit.mjs        --out <r>/a27.json --timeline-out <r>/a27-tl.json
node scripts/crowdingMemorySeparationFixturesAudit.mjs  --out <r>/c28.json
node scripts/encounterProvenanceFixturesAudit.mjs       --out <r>/c29.json
node scripts/rangeFrictionProvenanceFixturesAudit.mjs   --out <r>/c30.json
node scripts/rangeReleaseLifecycleFixturesAudit.mjs     --out <r>/c31.json --timelines <r>/c31-tl.json
node scripts/crowdingAttributionInstrumentAudit.mjs --arm after \
  --out-pairing <r>/c32-pair.json --out-fixed <r>/c32-fixed.json \
  --out-response <r>/c32-resp.json --out-partition <r>/c32-part.json
node scripts/crowdingZeroControlsAudit.mjs   --arm after --out <r>/c32-zero.json
node scripts/socialAccessLifecycleAudit.mjs  --arm after --out <r>/c32a-social.json
node scripts/crowdingDecisionAuthorityFixturesAudit.mjs --arm after --seasons 14 --out <r>/c32-fix.json
```

`git status --short docs/evidence/` was checked after the run and showed **only** the CORRECTION-33
directory modified.

## 6. File map

| File | Produced by |
| --- | --- |
| `controlled-fixtures{,-before}.json` | fixtures audit, P1–P20 |
| `threshold-isolation{,-before}.json` | fixtures audit — the decisive §14 behavioural isolation |
| `terminal-record-isolation{,-before}.json` | fixtures audit — P3 |
| `social-access-preservation{,-before}.json` | fixtures audit — P6/P7/P8/P10/P11/P16 |
| `water-refuge-comparison{,-before}.json` | fixtures audit — P12/P13/P14 |
| `candidate-score-comparison{,-before}.json` | fixtures audit — P15/P16 |
| `natural-occurrence-{20,50}y{,-before}.json` | natural audit |
| `behavioral-comparison.json` | derived from the four natural files; every divergence classified |
| `step-mode-equivalence.json` | fixtures P18/P19 plus `stepModeInvarianceAudit` |
| `before-after.json` | derived from the threshold, fixture and natural files |
| `RESEARCH_AND_CAUSAL_MODEL.md`, `ARCHITECTURE_DECISION.md`, `authority-ledger.md`, `FINDINGS.md` | written in this pass |

## 7. Known instrument limitations

- `depletionSum` reads 0 on both arms — the field path used does not resolve. Reported as **NOT
  MEASURED**, never as zero.
- The natural audit evaluates the removed expression as a **detector** on both arms; it describes
  world state, not behaviour, and on the after arm it fires while reaching no decision. That is the
  point of the metric, not a contradiction.
- P9 was NOT CONSTRUCTED and is not counted as a pass.
