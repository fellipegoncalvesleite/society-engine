# AUDIT-27 — PROVENANCE

## Commit identity

| item | value |
| --- | --- |
| branch | `checkpoint/crowding-shared-range-authority-27` |
| branched from | `5f341648addcd4331e86d340f21d2a830b703095` (CORRECTION-26 tip, frozen) |
| `origin/checkpoint/resource-investigation-physical-26` at entry | `5f341648addcd4331e86d340f21d2a830b703095` |
| `origin/main` at entry and exit | `0a43083a3a9103bc6b8f693b8823a604ae2c6a8d` |
| `git merge-base HEAD origin/main` | `0a43083a3a9103bc6b8f693b8823a604ae2c6a8d` |
| working tree at entry | clean (`git status --short` empty) |
| worktrees | one (`/Users/…/Developer/human-nomad-simulator`) |
| stashes | none |
| production files changed | **none** — `src/sim/**` and `src/ui/**` untouched |

The commit hash of this audit's own commit cannot appear inside it; it is reported in the
checkpoint report.

## Files added

```
scripts/crowdingSharedRangeNaturalOccurrenceAudit.mjs
scripts/crowdingControlledFixturesAudit.mjs
scripts/crowdingDoubleCountingTraceAudit.mjs
docs/evidence/crowding-shared-range-authority-27/AUTHORITY_LEDGER.md
docs/evidence/crowding-shared-range-authority-27/FINDINGS.md
docs/evidence/crowding-shared-range-authority-27/PROVENANCE.md
docs/evidence/crowding-shared-range-authority-27/causal-maps.md
docs/evidence/crowding-shared-range-authority-27/controlled-fixtures.json
docs/evidence/crowding-shared-range-authority-27/natural-occurrence.json
docs/evidence/crowding-shared-range-authority-27/release-timelines.json
docs/evidence/crowding-shared-range-authority-27/double-counting-trace.json
```

No prior evidence directory was altered. Before running any pre-existing audit, its default
output path was inspected; see §"Existing audits rerun" below.

## Production instrumentation

**None.** No production module was modified and no new seam was added to `src/sim`. Every
quantity in this evidence package is either:

1. a field production already persists on the band or the world
   (`pressureState`, `rangeSaturation`, `protoAccessMemory`, `recentRangeFrictionEvents`,
   `usePressure`, `contactMemories`, `carryingCapacity`, `placeMemory`, `world.tileDepletion`,
   `world.decisions`); or
2. the return value of an **already-exported** production function called read-only, outside the
   tick, on a post-tick world
   (`buildTickContextCache`, `buildSharedCatchmentIndex`, `getTileSupportShare`,
   `getOverlappingBandIds`, `getNearbyBandPressure`, `getCrowdingPenalty`,
   `getDaughterDispersalPressure`, `deriveBandPressureState`, `getLocalUsePressureValue`,
   `applyRangeSaturationContext`).

No existing audit seam was found insufficient, so nothing was added to production.

## Commands

Run from the repository root. Node v24.18.0, darwin 25.5.0.

### 1. Natural occurrence (§10)

```bash
node scripts/crowdingSharedRangeNaturalOccurrenceAudit.mjs \
  --years 20 --scenarios map1,map2,ordinary --seeds s1,s2
```

| parameter | value |
| --- | --- |
| seed prefix | `audit27:natural` (so world seeds are `audit27:natural:s1`, `audit27:natural:s2`) |
| scenarios | `map1` (default founders), `map2` (default founders), `ordinary` (single custom founder, pop 30, `tile:62:108`) |
| duration | 20 simulated years = 7,200 days per run, stepped one day at a time |
| samples | taken at every season-boundary tick change |
| totals | 480 season samples, 2,400 band-seasons, 7,360 active band-pair-seasons |
| output | `natural-occurrence.json` |

`ordinary` contributes 0 pair-seasons by construction (one band); it is included so per-band
authority counts are not drawn only from multi-band maps.

### 2. Controlled fixtures C1–C10b (§9)

```bash
node scripts/crowdingControlledFixturesAudit.mjs --seasons 16
```

| parameter | value |
| --- | --- |
| seed | `audit27:fixtures` |
| map | `map2` |
| rich anchor | `tile:195:90` (`river_valley`, non-aquatic, richness 1.000, waterAccess 1.000) |
| marginal anchor | `tile:155:12` (`plains`, non-aquatic) |
| founders | population 30 each, placed with `spawnCustomBands` at tick 0 |
| duration | 16 seasons per arm (a season = 90 days) |
| output | `controlled-fixtures.json`, `release-timelines.json` |

**Anchor selection.** Both anchors were chosen by a scan over every non-aquatic `map2` tile with
`movementCost ≤ 1.6`, scoring the 7×7 neighbourhood by
`mean(baseRichness + waterAccess × 0.6)` over qualifying neighbours and requiring ≥ 30 (rich) or
≥ 40 (marginal) qualifying neighbours. The scan probe was temporary and is not retained; the two
resulting tile ids are hard-coded in the fixture script and are re-derivable from
`initSimWorld({kind:"map2"}, "audit27:fixtures").tiles`.

**Synthetic states.** C4, C5, C6, C7 and C10b write state directly onto band objects, using the
same fields production writes, because the natural path to those states takes far longer than the
fixture horizon. Every such row carries `syntheticState: true` in the JSON. Specifically:

| case | synthetic write | production field it imitates |
| --- | --- | --- |
| C4 | `band.position` moved; the other band placed on a remembered tile | a band that walked away |
| C5 | `band.position` moved 34 tiles | a band that relocated |
| C6 | `band.status = "dispersed"` / `band.viability.status = "absorbed" \| "extinct"` | `viability.ts` terminal transition |
| C7 | `parentBandId` / `daughterBandIds` set | `demography.ts` fission |
| C10b | one `placeMemory` record copied between bands; `contactMemories`/`recentEncounters`/`recentRangeFrictionEvents` cleared | two bands that had both used one place |

**Admissibility.** Every geometry-sensitive case is measured as a **season series**, not at a
single endpoint. An earlier version of this script measured only the endpoint and produced four
false negatives (C1 `NO_PHYSICAL_COST`, C4 `NO_OBSOLETE_CROWDING`, C5 released at season 0)
because the two bands had drifted apart during the warm-up. That instrument error is recorded in
§"Instrument errors" below. Each case now declares a precondition and reports `VACUOUS_*` when the
condition it tests never occurred.

### 3. Double-counting trace (§7.4)

```bash
node scripts/crowdingDoubleCountingTraceAudit.mjs --seasons 8
```

| parameter | value |
| --- | --- |
| seed | `audit27:doublecount` |
| method | **same-snapshot counterfactual**, per `docs/evidence/correction16/AUDIT_ADMISSIBILITY.md` |
| construction | two founders at `tile:195:90` / `tile:196:90`; warmed until the first season with non-zero crowding (season 0); the world is then frozen and the second band is removed from `world.bands`; the observer's entire derived context is recomputed from the identical snapshot in both arms |
| stepping between arms | **none** — every delta is attributable to the crowding source alone |
| output | `double-counting-trace.json` |

The `analyticChannels` section of the output is a **code-supported architectural fact, not a
measurement**: it lists the literal coefficient each crowding-derived quantity carries into
`computeCandidateScore`, cited to `rules/decisionScoring.ts` and `agents/pressure.ts`.

## Instrument errors caught in this pass

Recorded rather than dropped, per the repository's own rule.

1. **Endpoint measurement hid the effect.** The first fixtures script measured C1/C4/C5 after a
   fixed warm-up. Bands drift apart, so it measured two separated bands and returned four false
   negatives. Fixed by measuring a season series and gating each case on an explicit precondition.
2. **A late `spawnCustomBands` call silently did nothing.** C4's first version spawned the second
   band *after* stepping. `spawn.isInitialSetupWorld` (`spawn.ts:822-828`) requires
   `time.tick === 0` and an empty decision archive, so the call returned the world unchanged and
   the case read `afterB: null`. Fixed by spawning both founders at tick 0 and relocating instead.
3. **`sharedPressurePenalty` is not a clean crowding metric and was initially used as one.** It is
   `clamp01(1 - sharedReachableSupport / rawReachableSupport)`, and `sharedReachableSupport`
   carries the fauna and plant multipliers while `rawReachableSupport` does not — so a **solo**
   band reads 0.07. The measurements now use `getTileSupportShare` / `getOverlappingBandIds`
   directly. Do not read `sharedPressurePenalty` as shared-catchment pressure.
4. **C10 is not the test it was written to be.** It was intended as an unseen-band probe, but the
   two bands are adjacent, so the contact memory that appears at season 1 is legitimate. C10 is
   reported as an ecology-effect measurement only; **C10b** is the authoritative perception-boundary
   probe.
5. **C3's fixture verdict is withdrawn.** The fixture reported `NOT_REPRESENTABLE_IN_FIXTURE`
   across separations 5–10, but the natural-occurrence audit found 4 real cases. The natural
   measurement is the authority; the fixture was too narrow.

## Validation

```bash
npm run typecheck
npm run build
node scripts/graphAudit.mjs          # see note below
node scripts/importBoundaryAudit.mjs
node scripts/seasonOrderInvarianceAudit.mjs
node scripts/stepModeInvarianceAudit.mjs
```

Results are recorded in the checkpoint report and in `FINDINGS.md` §Validation.

**`scripts/graphAudit.mjs` does not exist in this tree.** The graph-integrity audit is
`scripts/checkGraph.mjs` (it loads `src/architecture/graphData.ts` via Vite SSR and asserts 0
duplicate node ids and 0 dangling links). `checkGraph.mjs` was run in its place and the
substitution is reported rather than silently made.

### Existing audits rerun

Output paths were inspected before running. Two pre-existing scripts overwrite **other
checkpoints'** evidence as a side effect of their default output paths and were therefore run
with an explicit `--out` into a scratch path, or not run:

- `scripts/frontierAntiOmniscienceAudit.mjs` → defaults to `docs/evidence/correction17/`
- `scripts/placeStateSizeProbe.mjs` → defaults to `docs/evidence/correction23e/`

No pre-existing evidence file was modified by this pass.
