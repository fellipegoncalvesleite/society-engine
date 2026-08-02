# CORRECTION-33 — AUTHORITY LEDGER

Every writer and reader on the path from the hidden global band count to a movement decision, read
from production at `d1185415` (before) and at the branch tip (after).

## 1. The defect chain, exactly

```text
Object.values(world.bands).length          world truth, includes terminal records
  > 8  AND  knownContactCount === 0
    → unrelatedRisk = 0.08
      → getSocialAccessRisk                dryMargin.ts
        → WaterRefugeProfile.socialAccessRisk
        → KnownProspectCandidate.socialAccessRisk
          → getFallbackRank                        x1.8   (fallback ordering)
          → water-source comparator                x0.18  (which water is "best")
          → deriveSeasonalMobilityMode             x0.14
          → RiverCorridorProspect.socialAccessRisk x0.16 / x0.08
          → StayMoveScoutComparison.socialAccessRisk
            → ScoreBreakdown.socialAccessRisk
              → scoreDecision                      -0.36
              → getBadSiteStuckResidencePenalty    x0.08
              → prospect candidate socialCost      -0.70
                → selected action → movement
```

**Runtime proof, not source reading.** Fixture P1 holds the observer's band object byte-identical
(`observerStateIdenticalToBase: true`) and varies only the number of records in `world.bands`:

| records | socialAccessRisk | fallbackRank | max candidate socialAccessRisk |
| --- | --- | --- | --- |
| 8 (before) | 0.29 | 11 | 0.29 |
| 9 (before) | **0.37** | **12** | **0.37** |
| 8 (after) | 0.29 | 11 | 0.29 |
| 9 (after) | **0.29** | **11** | **0.29** |

**What the count includes.** `world.bands` retains extinct, absorbed and dispersed records —
verified at runtime in `terminal-record-isolation{,-before}.json`, where the record count is
identical across the active/extinct/absorbed/dispersed arms while the living-band count is not. On
the before arm the observer's risk is the same in all four, i.e. **dead bands counted exactly like
live ones**.

## 2. Source ledger

| Source | Band-known | Place-specific | Current or historical | Provenance | Lifecycle | Affects decisions | Reads hidden world state | Terminal bands can influence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `unrelatedRisk` **(before)** | **NO** | **NO** | neither | **none** | **none** | **YES** | **YES** — `world.bands.length` | **YES** |
| `unrelatedRisk` **(after)** | — | — | — | — | — | **removed** | **removed** | **no** |
| base `0.28` | n/a (constant) | no | n/a | n/a — abstraction | none | yes | no | no |
| `knownContactCount` (`contactMemories` + `knowledge.knownBands`) | yes | no | historical | encounter-written (CORRECTION-29 gates it on proximity) | none | yes (relief only) | no | only via a contact the band really made |
| `ProtoAccessMemory.strangerCaution` | yes | **yes** | current, cooling | CORRECTION-30 | CORRECTION-31 | yes | no | no |
| `ProtoAccessMemory.rememberedRefusalAvoidance` | yes | **yes** | current, cooling | CORRECTION-30 | CORRECTION-31 | yes | no | no |
| `ProtoAccessMemory.sharedUsePressure` | yes | yes | current, cooling | CORRECTION-30 | CORRECTION-31 | yes (elsewhere) | no | no |
| `activeEvidenceWeight` / `socialEvidencePhase` | yes | yes | derived each tick | CORRECTION-31 | **is** the lifecycle | yes | no | no |
| `rangeFriction` events | yes | yes | current, ageing | CORRECTION-30 | CORRECTION-31 | yes | no | no |
| reported access evidence | yes | yes | ageing, hop-discounted | CORRECTION-30/-31 | CORRECTION-31 | yes | no | no |
| `WaterRefugeProfile.socialAccessRisk` | derived | yes | current | inherits | inherits | yes | **no (after)** | **no (after)** |
| `fallbackRank` | derived | yes | current | inherits | inherits | yes | **no (after)** | **no (after)** |
| `RiverCorridorProspect.socialAccessRisk` | derived | yes | current | inherits | inherits | yes | **no (after)** | **no (after)** |
| `StayMoveScoutComparison.socialAccessRisk` | derived | yes | current | inherits | inherits | yes | **no (after)** | **no (after)** |
| `ScoreBreakdown.socialAccessRisk` | derived | yes | current | inherits | inherits | yes | **no (after)** | **no (after)** |

## 3. Global band-count reads elsewhere in `src/sim`

Inspected and **left alone** — none is decision-facing social inference, and §11's P17 explicitly
does not ban global counts from simulation-management code:

| Site | Purpose | Verdict |
| --- | --- | --- |
| `demography.ts:395,519` (`MAX_BANDS`) | simulation-management cap on how many bands may exist | legitimate — not a band belief |
| `demography.ts:148,695,3315,3359` | band ordering, diagnostics, world aggregates | legitimate |
| `viability.ts:24,330,474` | lifecycle orchestration and kin lookup | legitimate |
| `spawn.ts`, `world/mapEdits.ts`, `world/depletion.ts`, `faunaStock.ts` | world construction and physical ecology | legitimate |
| `relationshipMemory.ts:53`, `foragingAdaptation.ts:63`, `visibleNature.ts:376`, `resourceEcologyFoundation.ts:259`, `bandHistory.ts:315` | iterate bands to build per-band state | **inspected, not audited in depth** — each iterates rather than counting, and none was found feeding a global scalar into a decision; a full anti-omniscience sweep of these is NOT claimed |

**After the repair, `dryMargin.ts` contains no `world.bands` reference at all** outside the
explanatory comment.

## 4. Adjacent finding, recorded and NOT repaired

`knownContactCount = Object.keys(band.contactMemories).length + band.knowledge.knownBands.length`
can plausibly **count one known band twice**, if a band appears in both stores. That would make
known-contact relief up to twice as strong as intended for such bands. CORRECTION-33 does not
depend on it in either direction — the term is identical in both arms and cancels in every
comparison — so it is recorded here and deliberately left for its own checkpoint.
