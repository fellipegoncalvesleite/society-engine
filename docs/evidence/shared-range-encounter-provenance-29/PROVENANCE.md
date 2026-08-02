# CORRECTION-29 — PROVENANCE

## Commit identity

| item | value |
| --- | --- |
| branch | `checkpoint/shared-range-encounter-provenance-29` |
| branched from | `c5eb58a8f5ff7054665f9c376ac4ca856403efab` (CORRECTION-28, frozen) |
| `origin/checkpoint/crowding-physical-memory-separation-28` at entry and exit | `c5eb58a8f5ff7054665f9c376ac4ca856403efab` |
| AUDIT-27 tip, frozen | `b352c3195406fc9494c0b693a98eb0786f1a3780` |
| CORRECTION-26 tip, frozen | `5f341648addcd4331e86d340f21d2a830b703095` |
| `origin/main` at entry and exit | `0a43083a3a9103bc6b8f693b8823a604ae2c6a8d` |
| `git merge-base HEAD origin/main` | `0a43083a3a9103bc6b8f693b8823a604ae2c6a8d` |
| working tree at entry | clean |
| worktrees at entry | one |
| stashes | none |

The commit hash of this checkpoint's own commit cannot appear inside it; it is reported in the
final checkpoint report.

## Production change

Exactly one file:

```
src/sim/agents/socialContext.ts   (+21 −60)
```

`git diff --stat c5eb58a -- src/` lists only that file. `src/ui/**` is untouched.

## Files added

```
scripts/encounterProvenanceFixturesAudit.mjs
scripts/encounterProvenanceNaturalAudit.mjs
scripts/encounterProvenanceCompare.mjs
docs/evidence/shared-range-encounter-provenance-29/ARCHITECTURE_DECISION.md
docs/evidence/shared-range-encounter-provenance-29/FINDINGS.md
docs/evidence/shared-range-encounter-provenance-29/PROVENANCE.md
docs/evidence/shared-range-encounter-provenance-29/before-after.json
docs/evidence/shared-range-encounter-provenance-29/controlled-fixtures.json
docs/evidence/shared-range-encounter-provenance-29/natural-occurrence.json
docs/evidence/shared-range-encounter-provenance-29/behavioral-comparison.json
docs/evidence/shared-range-encounter-provenance-29/provenance-chain.json
docs/evidence/shared-range-encounter-provenance-29/audit27-fixtures-rerun.json
docs/evidence/shared-range-encounter-provenance-29/audit27-release-timelines-rerun.json
docs/evidence/shared-range-encounter-provenance-29/correction28-fixtures-rerun.json
```

**Both prior evidence directories are preserved byte-for-byte:**
`docs/evidence/crowding-shared-range-authority-27/` and
`docs/evidence/crowding-physical-memory-separation-28/`. Verified with `git status --short` on both
paths — neither shows a modified file. Every rerun of an AUDIT-27 or CORRECTION-28 script was given
an explicit `--out` (and `--timeline-out`) into the CORRECTION-29 directory, because those scripts
default into their own checkpoints' directories.

## How the two arms were produced

Both arms run **the identical script files**. The before arm is a detached worktree at the
CORRECTION-28 tip with `node_modules` symlinked and the new scripts copied in:

```bash
git worktree add --detach /tmp/.../c29-before c5eb58a8f5ff7054665f9c376ac4ca856403efab
ln -s <repo>/node_modules /tmp/.../c29-before/node_modules
cp scripts/encounterProvenance*.mjs /tmp/.../c29-before/scripts/
```

Confirmed before running: the before worktree still contains both gates
(`grep -c memoryTileBands` = 4, `grep -c getSharedMemoryOverlap` = 2); the corrected tree contains
neither. The worktree was removed afterwards; **nothing was ever committed from it.**

## Commands

Run from the repository root. Node v24.18.0, darwin 25.5.0.

### Controlled fixtures P1–P12 (both arms)

```bash
node scripts/encounterProvenanceFixturesAudit.mjs --seasons 16 --arm after \
  --out       docs/evidence/shared-range-encounter-provenance-29/controlled-fixtures.json \
  --chain-out docs/evidence/shared-range-encounter-provenance-29/provenance-chain.json
```

| parameter | value |
| --- | --- |
| seed | `c29:fixtures` |
| map | `map2`, rich anchor `tile:195:90` (the anchor AUDIT-27 and CORRECTION-28 both used) |
| founders | population 30 each, `spawnCustomBands` at tick 0 |
| horizon | 16 seasons (1 season = 90 days) |

### Natural occurrence / provenance classes (both arms)

```bash
node scripts/encounterProvenanceNaturalAudit.mjs \
  --years 20 --scenarios map1,map2,ordinary --seeds s1,s2 --arm after \
  --out docs/evidence/shared-range-encounter-provenance-29/natural-occurrence.json
```

Seed prefix `audit27:natural` — the same prefix AUDIT-27 and CORRECTION-28 used, so all three
checkpoints describe the same worlds. 480 season samples, 2,400 living band-seasons per arm.

### Behaviour trace

The **before** trace was not re-run: `c28-after-trace.json` was produced by
`crowdingMemorySeparationBehaviorTrace.mjs` **on `c5eb58a`**, which is exactly this checkpoint's
before commit, with the same script, years, scenarios, seeds and seed prefix. The after trace uses
the same script on the corrected branch:

```bash
node scripts/crowdingMemorySeparationBehaviorTrace.mjs \
  --years 20 --scenarios map1,map2,ordinary --seeds s1,s2 --arm after-c29 --out <trace>.json
```

### Merge

```bash
node scripts/encounterProvenanceCompare.mjs \
  --before-fixtures … --after-fixtures … --before-natural … --after-natural … \
  --before-trace … --after-trace … \
  --out-before-after docs/evidence/shared-range-encounter-provenance-29/before-after.json \
  --out-behavior     docs/evidence/shared-range-encounter-provenance-29/behavioral-comparison.json
```

Pure file processing; runs no simulation.

### Required reruns, all with explicit output paths

```bash
node scripts/crowdingControlledFixturesAudit.mjs --seasons 16 \
  --out          docs/evidence/shared-range-encounter-provenance-29/audit27-fixtures-rerun.json \
  --timeline-out docs/evidence/shared-range-encounter-provenance-29/audit27-release-timelines-rerun.json
node scripts/crowdingMemorySeparationFixturesAudit.mjs --seasons 16 --arm c29 \
  --out docs/evidence/shared-range-encounter-provenance-29/correction28-fixtures-rerun.json
node scripts/socialCausalityAudit.mjs
```

### Validation

```bash
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
```

All ten passed. Results in `FINDINGS.md` §9.

Carried forward from AUDIT-27: `scripts/graphAudit.mjs` does not exist in this tree; the
graph-integrity audit is `scripts/checkGraph.mjs`, which is what §14 names and what was run.

## Production instrumentation

**None.** No audit seam, diagnostic flag, observer or counter was added to `src/sim`. Every
measurement is a field production already persists, or the return value of an **already-exported**
production function called read-only outside the tick: `buildTickContextCache`,
`buildSharedCatchmentIndex`, `getTileSupportShare`, `getOverlappingBandIds`,
`getNearbyBandPressure`, `getCrowdingPenalty`, `deriveSocialRangeRecognition`.

Every function the fixtures call exists with the same signature on **both** commits, which is why
one script file runs unchanged in both arms.

## Synthetic states

Fixtures that write band state directly use the same fields production writes, and every such row
carries `syntheticState: true`:

| fixture | synthetic write | what it imitates |
| --- | --- | --- |
| P1, P6, P9 | one `placeMemory` record copied between two bands that were spawned far apart and never met | two bands that had both used the same place |
| P4 | `band.position` moved beyond every radius | a band that relocated |
| P8 | `parentBandId` / `daughterBandIds` set | `demography.ts` fission |

## Instrument limits, stated rather than buried

1. **The "encounters beyond the admission radius" counter is an upper bound.** It measures the two
   bands' distance at the **end of the tick** in which the record first appears, but
   `applyEncounterContext` runs before the decision loop moves bands. The after arm therefore shows
   5, not 0; all five are `unrelated_overlap` and three appear identically in the before arm. The
   categorical claim rests instead on the code fact that `getEncounterKind` returns `undefined` for
   every `distance > 3`, plus the 42- and 44-tile fixtures.
2. **P9 does not measure the friction cascade closing.** Its bands are 42 tiles apart and therefore
   never shared familiar country, so no friction event named the other band in **either** arm.
   AUDIT-27's C10b saw friction because its bands were warmed adjacent first. This is reported as an
   unchanged pass, not as a repair.
3. **P3 reports what production does, not what it should do.** Bands separated by water still
   encounter each other, because production has no visibility, route or barrier rule. No such rule
   was invented here.

## What the evidence does not cover

No long-horizon (200 y / 500 y) matrix. No performance re-measurement. No claim that the corrected
behaviour improves any outcome. See `FINDINGS.md` §11.
