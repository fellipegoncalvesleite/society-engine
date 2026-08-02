# CORRECTION-28 — PROVENANCE

## Commit identity

| item | value |
| --- | --- |
| branch | `checkpoint/crowding-physical-memory-separation-28` |
| branched from | `b352c3195406fc9494c0b693a98eb0786f1a3780` (AUDIT-27, frozen) |
| `origin/checkpoint/crowding-shared-range-authority-27` at entry and exit | `b352c3195406fc9494c0b693a98eb0786f1a3780` |
| CORRECTION-26 tip | `5f341648addcd4331e86d340f21d2a830b703095`, frozen |
| `origin/main` at entry and exit | `0a43083a3a9103bc6b8f693b8823a604ae2c6a8d` |
| `git merge-base HEAD origin/main` | `0a43083a3a9103bc6b8f693b8823a604ae2c6a8d` |
| working tree at entry | clean |
| worktrees at entry | one |
| stashes | none |

The commit hash of this checkpoint's own commit cannot appear inside it; it is reported in the
final checkpoint report.

## Production change

Exactly one production file:

```
src/sim/agents/crowding.ts
```

`git diff --stat b352c31 -- src/` lists only that file. `src/ui/**` is untouched.

## Files added

```
scripts/crowdingMemorySeparationFixturesAudit.mjs
scripts/crowdingMemorySeparationBehaviorTrace.mjs
scripts/crowdingMemorySeparationCompare.mjs
docs/evidence/crowding-physical-memory-separation-28/ARCHITECTURE_DECISION.md
docs/evidence/crowding-physical-memory-separation-28/FINDINGS.md
docs/evidence/crowding-physical-memory-separation-28/PROVENANCE.md
docs/evidence/crowding-physical-memory-separation-28/before-after.json
docs/evidence/crowding-physical-memory-separation-28/controlled-fixtures.json
docs/evidence/crowding-physical-memory-separation-28/natural-occurrence.json
docs/evidence/crowding-physical-memory-separation-28/behavioral-comparison.json
docs/evidence/crowding-physical-memory-separation-28/field-scan-parity.json
docs/evidence/crowding-physical-memory-separation-28/audit27-fixtures-rerun.json
docs/evidence/crowding-physical-memory-separation-28/audit27-release-timelines-rerun.json
docs/evidence/crowding-physical-memory-separation-28/audit27-double-counting-rerun.json
```

**`docs/evidence/crowding-shared-range-authority-27/` is preserved byte-for-byte.** Every AUDIT-27
script rerun in this pass was given an explicit `--out` (and `--timeline-out`) into the
CORRECTION-28 directory. Verified with `git status --short` — no file under the AUDIT-27 directory
appears as modified.

## How the before/after arms were produced

The two arms run **the identical script files**. The before arm is a detached worktree at the
AUDIT-27 tip, with `node_modules` symlinked from the main checkout and the three new scripts copied
in:

```bash
git worktree add --detach /tmp/.../c28-before b352c3195406fc9494c0b693a98eb0786f1a3780
ln -s <repo>/node_modules /tmp/.../c28-before/node_modules
cp scripts/crowdingMemorySeparation*.mjs /tmp/.../c28-before/scripts/
```

Confirmed before running: the before worktree's `crowding.ts` still contains the memory channel
(`grep -c memoryOverlap` = 9); the corrected tree contains it only inside `getParentCoreOverlap`
(the deferred kin seam) and the explanatory header comment.

The worktree was removed after the evidence was collected; **nothing was ever committed from it.**

## Commands

Run from the repository root. Node v24.18.0, darwin 25.5.0.

### Controlled fixtures P1–P12 (both arms)

```bash
node scripts/crowdingMemorySeparationFixturesAudit.mjs --seasons 16 --arm after \
  --parity-out docs/evidence/crowding-physical-memory-separation-28/field-scan-parity.json
```

| parameter | value |
| --- | --- |
| seed | `c28:fixtures` |
| map | `map2`, rich anchor `tile:195:90` (the same anchor AUDIT-27 used, so the packages are comparable) |
| founders | population 30 each, `spawnCustomBands` at tick 0 |
| horizon | 16 seasons (1 season = 90 days) |
| before-arm output | scratch `c28-before-fixtures.json` (merged into `before-after.json`) |

### Behaviour trace (both arms)

```bash
node scripts/crowdingMemorySeparationBehaviorTrace.mjs \
  --years 20 --scenarios map1,map2,ordinary --seeds s1,s2 --arm after --out <trace>.json
```

Seed prefix `audit27:natural` — deliberately the same prefix AUDIT-27's natural audit used, so the
trace and the natural-occurrence comparison describe the same worlds.

### Natural occurrence (both arms, AUDIT-27's script unmodified)

```bash
node scripts/crowdingSharedRangeNaturalOccurrenceAudit.mjs \
  --years 20 --scenarios map1,map2,ordinary --seeds s1,s2 \
  --out docs/evidence/crowding-physical-memory-separation-28/natural-occurrence.json
```

Same maps, same seeds, same 20-year duration, same definitions as AUDIT-27 — §11's requirement.
480 season samples, 2,400 band-seasons, 7,360 active band-pair-seasons per arm.

### Merge

```bash
node scripts/crowdingMemorySeparationCompare.mjs \
  --before-fixtures … --after-fixtures … --before-trace … --after-trace … \
  --before-natural … --after-natural … \
  --out-before-after docs/evidence/crowding-physical-memory-separation-28/before-after.json \
  --out-behavior    docs/evidence/crowding-physical-memory-separation-28/behavioral-comparison.json
```

Pure file processing; runs no simulation.

### AUDIT-27 instruments rerun on the corrected tree

```bash
node scripts/crowdingControlledFixturesAudit.mjs --seasons 16 \
  --out          docs/evidence/crowding-physical-memory-separation-28/audit27-fixtures-rerun.json \
  --timeline-out docs/evidence/crowding-physical-memory-separation-28/audit27-release-timelines-rerun.json
node scripts/crowdingDoubleCountingTraceAudit.mjs --seasons 8 \
  --out docs/evidence/crowding-physical-memory-separation-28/audit27-double-counting-rerun.json
```

**Output paths were inspected before running.** Both scripts default to the AUDIT-27 directory, so
both were given explicit paths.

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

All ten passed. Results in `FINDINGS.md` §10.

Note carried forward from AUDIT-27: **`scripts/graphAudit.mjs` does not exist in this tree** — the
graph-integrity audit is `scripts/checkGraph.mjs`, which is what §14's list names and what was run.

## Production instrumentation

**None.** No audit seam, diagnostic flag, observer or counter was added to `src/sim`. Every
measurement is either a field production already persists on the band or the world, or the return
value of an **already-exported** production function called read-only, outside the tick:
`buildTickContextCache`, `buildSharedCatchmentIndex`, `getTileSupportShare`,
`getOverlappingBandIds`, `getNearbyBandPressure`, `getCrowdingPenalty`,
`getDaughterDispersalPressure`, `deriveFamiliarCountry`.

Every function the fixtures call exists with the same signature on **both** commits, which is why
one script file runs unchanged in both arms.

## Synthetic states

Fixtures that write band state directly do so with the same fields production writes, and every
such row carries `syntheticState: true`:

| fixture | synthetic write | what it imitates |
| --- | --- | --- |
| P1, P6 | `band.position` moved; observer placed on a remembered tile | a band that walked away |
| P4 | observer parked on one of the other band's warmed salient tiles, that band one step away | a neighbour whose range the observer has entered |
| P7 | `band.status = "dispersed"` / `band.viability.status = "absorbed" \| "extinct"` | `viability.ts` terminal transition |
| P11 | `band.position` moved 40 tiles | a band that relocated |

## Instrument errors caught in this pass

Recorded rather than dropped.

1. **P4 was vacuous in its first two forms.** Version 1 relied on drift and reported
   `VACUOUS_NOT_NEARBY` (bands had separated during the warm-up). Version 2 parked the *other*
   band next to the observer, which fixed proximity but left that band's memories around its old
   home — `VACUOUS_NO_REMEMBERED_OVERLAP`. The accepted version parks the **observer** on one of
   the other band's genuinely warmed salient tiles, which is the only construction that holds both
   halves of the precondition at once. Both earlier verdicts were honest vacuous reports, not false
   negatives — the fixture refused to claim a result it had not created.
2. **The `--parity-out` path had to be explicit.** `crowdingControlledFixturesAudit.mjs` and
   `crowdingDoubleCountingTraceAudit.mjs` default their outputs into
   `docs/evidence/crowding-shared-range-authority-27/`. Running either without `--out` would have
   overwritten AUDIT-27 evidence — the exact hazard `human-nomad-codex-clone-prestrip-trap`
   records for two other scripts. Both were given explicit paths.

## What the evidence does not cover

No long-horizon (200 y / 500 y) matrix. No performance re-measurement. No claim that the corrected
behaviour improves any outcome. See `FINDINGS.md` §11.
