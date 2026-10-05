# CORRECTION-31 — lifecycle authority ledger

Read directly from the tree at `1c6a3ed8d0a8360c8fe4648a83387a2bd4fa30b4`
(CORRECTION-30, CLOSED and FROZEN). Every file:line is a repository fact.

Two of the §7 inspection targets **do not exist as modules**: there is no
`src/sim/agents/contactMemory.ts` (contact memory is written by `updateContactMemory` in
`socialContext.ts:1168`) and no `src/sim/agents/placeMemory.ts` (place memory is written in
`memory.ts:199` and compacted in `memoryCompression.ts:81`). `bandLifecycle.ts` is 31 lines
and unrelated to social lifecycle.

---

## 1. The per-value ledger required by §7

| Value | Writer | Source evidence | Refresh condition | Decay / expiry | Behavioural reader | Historical reader | Sees physical departure? | Can absence contradict it? | Can reports recursively refresh it? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `recentRangeFrictionEvents` | `rangeFriction.ts:94` (only production writer) | proximity observation (`:150`) or received report (`:228`) | a new event is minted whenever the gate passes | ring 8; `mergeEventRing` drops age > `RANGE_FRICTION_MAX_AGE_TICKS` (48) | via `accessNorms`, `innerFission` | UI, `reportedKnowledge` | **only for creation** — an existing record is never revisited | **no** | **YES — see §3** |
| `RangeFrictionEvent.tick` | stamped at creation, `rangeFriction.ts:205` | — | never updated | — | **NONE.** `accessNorms` reads it only in the binary window test | — | no | no | — |
| `recurrenceCount` | `countPriorRecurrence`, `rangeFriction.ts:194` | observer's own prior ring entries at the same tile+interpretation | at creation only | inherits the ring's 48-tick horizon | `strongestFrictionRelation` `:880`, `cooperationFromFriction` `:914`, `avoidanceFromFriction` `:928` | — | no | no | yes (report events also carry it) |
| `recentOverlapCount` | `rangeFriction.ts:171` — after CORRECTION-30, `1 + countObserverNoticesOfBand` | observer's own prior `observed` notices of that band, **any tile** | at creation only | bounded 1..9 by the ring | `eventPressure` `:940` | — | no | no | no |
| `RANGE_FRICTION_MAX_AGE_TICKS` | const, `rangeFriction.ts:29` = 48 | — | — | ring eviction only | — | — | — | — | — |
| `FRICTION_RECENT_WINDOW_TICKS` | const, `accessNorms.ts:24` = 48 | — | — | **binary include/exclude**, `collectTileFrictionEvents:429` | all access derivations | — | no | no | — |
| `REPORT_RECENT_WINDOW_TICKS` | const, `accessNorms.ts:25` = 80 | — | — | **binary include/exclude**, `collectTileReports:444` | `strangerCaution`, `sharedUsePressure`, `rememberedRefusalAvoidance`, `familiarTolerance` | — | no | no | — |
| `reportedKnowledge.reports` | `advanceReportedKnowledge`, `reportedKnowledge.ts` | internal facts (incl. **friction**, `:648`) + inter-band transfer | new receipt | ring 16; `REPORT_MAX_AGE_TICKS = 160`; dropped at `freshness <= 0.08` (`:1303`) | `rangeFriction.ts:234`, `accessNorms.ts:440`, many others | UI | no | no | — |
| `ProtoAccessMemory` | `deriveAccessMemory`, `accessNorms.ts:143` | place memory, proto-camp, friction, reports, visible/storage signals | **recomputed from scratch every tick** | none of its own — it is a pure function of the inputs above | `deriveAccessBehavior` → `pressure.ts:161` | `bandChronicle`, `bandEvents`, `memoryReferents` | only through `nearbyBandPressure` when `current` (`:204`) | no | yes |
| `staleYears` | `getAccessStaleYears`, `accessNorms.ts:947` | max tick over place memory, proto camp, **friction**, reports | any of those | `floor((now − newestEvidence)/4)`; 0 when standing on the tile | only via `staleness` | UI | no | no | yes |
| `staleness` | `accessNorms.ts:235` = `clamp01(staleYears/12)` | — | — | — | `confidence` (−0.14), `classifyEncounterTone` (≥0.62), `classifyAccessState` | UI | no | no | yes |
| `accessState` | `classifyAccessState`, `accessNorms.ts:708` | the derived scalars | every tick | only via `staleness` **and only when `confidence < 0.36`** | `deriveAccessBehavior:341` gates on it | UI, chronicle | no | no | yes |
| `recentEncounterTone` | `classifyEncounterTone`, `accessNorms.ts:675` | the derived scalars | every tick | `staleness >= 0.62` → `stale_uncertain` | none (display) | UI | no | no | yes |
| `sharedUsePressure` | `accessNorms.ts:202` | `max(eventPressure)` × 0.42 + current nearby pressure × 0.22 + proto crowding × 0.26 + report count × 0.08 | every tick | **none** | `deriveAccessBehavior` → `pressure.ts`; `bodyCampLogistics.ts:831`; `relationshipMemory.ts:587/597` | UI | partially — only the 0.22 `current` term | no | yes |
| `strangerCaution` | `accessNorms.ts:196` | `strongestFrictionRelation` × 0.38 + report count × 0.12 + `tensionFromFriction` × 0.12–0.22 + report flag 0.12 | every tick | **none** | `placeSensitivity`, `sensitivePlaceCautionBias`, `relationshipMemory.ts:402` | UI | **no** | no | yes |
| `rememberedRefusalAvoidance` | `accessNorms.ts:215` | `avoidanceFromFriction` × 0.46 + report flag 0.18 + place valence 0.14 + death memory 0.18 | every tick | **none** | `contestedAvoidanceBias`, `sensitivePlaceCautionBias`, `classifyAccessState` (≥0.46 → `avoided_shared_use`) | `memoryReferents.ts:913` | **no** | no | yes |
| `rememberedCooperationTolerance` | `accessNorms.ts:221` | `cooperationFromFriction` × 0.32 + kin/familiar tolerance + contact peaceful counts | every tick | **none** | `classifyAccessState`, `kinToleranceReliefBias` | UI | no | no | yes |
| `ProtoAccessBehaviorEffectState` | `deriveAccessBehavior`, `accessNorms.ts:341` | the memory above | every tick | zeroed only when `accessState` is `none`/`stale_access_memory` | **`pressure.ts:161-166` → five real decision inputs at weights 0.16/0.08/0.18/0.06/0.20/0.08**; `foragingAdaptation.ts:1353`; `bodyCampLogistics.ts:998` | — | no | no | yes |
| `contactMemories` | `updateContactMemory`, `socialContext.ts:1168` (only writer outside spawn/fission) | a real encounter | new encounter | **never decays, never expires** | `rangeFriction.ts:556` (relation), `accessNorms.ts:893/225`, `relationshipMemory` | UI | no | no | no |
| `placeMemory` | `memory.ts:199`, compacted `memoryCompression.ts:81` | the band's own visits | own visit | compression eviction (72-record cap) | movement scoring, `accessNorms`, `familiarCountry` | UI | n/a | n/a | no |

---

## 2. Defect 1 — friction evidence has no age, only a cliff

**Every** function converting a friction record into pressure reads only fields stamped at
creation:

| Function | `accessNorms.ts` | Reads | Reads `event.tick`? |
| --- | --- | --- | --- |
| `eventPressure` | `:934` | `tensionLevel`, `recentOverlapCount` | **no** |
| `strongestFrictionRelation` | `:873` | `relation`, `eventPressure`, `recurrenceCount` | **no** |
| `tensionFromFriction` | `:906` | `eventPressure` | **no** |
| `cooperationFromFriction` | `:910` | `interpretation`, `recurrenceCount` | **no** |
| `avoidanceFromFriction` | `:920` | `interpretation`, `eventPressure`, `recurrenceCount` | **no** |
| `bestContactTolerance` | `:886` | `contactMemories` | **no** |

The only age test in the whole chain is
`Number(world.time.tick) - Number(event.tick) <= FRICTION_RECENT_WINDOW_TICKS` at `:429` —
**binary**. A 47-tick-old record contributes exactly what a fresh one does; at 49 it vanishes.
Twelve simulated years at full strength, then a cliff.

**Why staleness does not save it.** `staleness` can only produce `stale_access_memory` /
`stale_uncertain` when `confidence < 0.36` (`:723`, `:729`). But `confidence` (`:236`) adds
`Math.min(1, friction.length / 3) * 0.16` — **the retained friction records prop up the very
confidence that would otherwise mark them stale.** Held evidence defends itself.

**Why it can escalate.** `avoided_shared_use` needs `rememberedRefusalAvoidance >= 0.46 &&
placeImportance >= 0.28` (`:732`). The first term is frozen at the episode's creation; the
second **keeps rising while the observer goes on using its own place**. So the classification
can cross into avoidance *after* the other band has left, with no new social evidence at all —
which is exactly AUDIT-27's C5 finding, reproduced fresh on this tip in
`baseline/audit27-fixtures-baseline.json` (`PHYSICAL_RELEASES_PERCEPTION_DOES_NOT`).

---

## 3. Defect 2 — report-linked friction never ages at all

`deriveReportLinkedEvents` (`rangeFriction.ts:228-308`) iterates the observer's reports and,
for every friction-topic report whose target is in familiar country, mints an event with
`tick: world.time.tick` — **the current tick, every tick**. `makeEventId` includes the tick, so
each pass creates a *new* id rather than refreshing an old one.

Consequences, all verified:

- a report-linked record is **always age 0** to `collectTileFrictionEvents`, so the 48-tick
  window never expires it;
- it persists for as long as the report does — up to `REPORT_MAX_AGE_TICKS = 160` (**40
  simulated years**);
- `deriveReportLinkedEvents` **does not read `report.freshness`, `hops`, `tickCreated` or
  `originalObserverBandId`** (all present on `WordOfMouthReport`, `types.ts:4761-4791`), so the
  report's own decay is invisible to the friction it generates;
- `accessNorms` then counts reports by `.length` (`:198`, `:206`) with no freshness weight
  either, so two relayed copies of one story count double.

**Measured on this tip.** Instrumenting AUDIT-27's own C10b fixture at 24 warm seasons: the
observer's ring holds **two** events naming a band **40 tiles away**, both
`confidence: "reported_secondhand"`, `interpretation: "avoid_warning_remembered"`, both with a
`linkedReportId`, both stamped at the **current** tick 25 while the reports were received at
ticks 20 and 25.

**This also corrects an instrument reading.** AUDIT-27's C10b flips to
`SOCIAL_KNOWLEDGE_FROM_MEMORY_OVERLAP_WITHOUT_PROXIMITY` at 24 seasons on this tip. That is
**not** a CORRECTION-30 leak: its `frictionNamesB` test does not look at provenance, and what
it catches is the legitimate second-hand report channel CORRECTION-30 deliberately kept. The
same fixture at its default 16 seasons reads `NO_SOCIAL_KNOWLEDGE_WITHOUT_PROXIMITY`. Recorded
in `FINDINGS.md`; the fixture is **not** edited here (it is frozen AUDIT-27 evidence).
Separately, C10b tests `aAfter.recentEncounters`, a field that **does not exist on `Band`**
(the real field is `encounterRecords`), so that half of its check reads an empty array in every
arm.

---

## 4. Defect 3 — the friction → report → friction loop

```text
rangeFriction.ts:94        writes a friction record
  -> reportedKnowledge.ts:648  publishes the top 3 as outsider_use_warning / crowded_water_warning
  -> inter-band transfer       another band receives it
  -> rangeFriction.ts:228      that band mints report-linked friction (fresh tick, every tick)
  -> reportedKnowledge.ts:648  which it republishes...
```

`rangeFriction.ts:250` blocks only **self-sourced** reports (the 2026-07-10 rumour-loop fix).
A record that travels to a neighbour and returns is not blocked. Combined with §3 (report
events never age) this is a structurally immortal belief.

---

## 5. What already works and must not be broken

- **Physical release is already immediate and correct.** `crowding.ts` uses current positions
  only (CORRECTION-28); `sharedCatchment.ts` rebuilds per tick; AUDIT-27 C5's own rows show
  `weightedCrowding` and `overlappingBandIds` going to zero the season after departure. §10.1
  needs no work — only proof.
- **`contactMemories` never decays**, which is correct for §10.5/§10.11: knowing a band is not
  a claim about where it is. It carries **no position field**, so it cannot leak location.
- **`placeMemory` is independent of the social layer** and is governed by `memoryCompression`.
- **`ProtoAccessMemory` is recomputed from scratch every tick** — it stores no state of its own.
  That is the single most important architectural fact for this checkpoint: **a lifecycle can be
  expressed entirely in how the inputs are weighted, with no new stored state.**

---

## 6. Constants in scope

| Constant | File:line | Value | Changed here? |
| --- | --- | --- | --- |
| `RANGE_FRICTION_MAX_AGE_TICKS` | `rangeFriction.ts:29` | 48 | **no** |
| `RANGE_FRICTION_RING_LIMIT` | `rangeFriction.ts:28` | 8 | **no** |
| `FRICTION_RECENT_WINDOW_TICKS` | `accessNorms.ts:24` | 48 | **no** |
| `REPORT_RECENT_WINDOW_TICKS` | `accessNorms.ts:25` | 80 | **no** |
| `ACCESS_MEMORY_CAP` | `accessNorms.ts:21` | 8 | **no** |
| `BEHAVIOR_HOOK_CAP` | `accessNorms.ts:26` | 0.08 | **no** |
| `REPORT_MAX_AGE_TICKS` | `reportedKnowledge.ts:34` | 160 | **no** |
| `REPORT_RING_LIMIT` | `reportedKnowledge.ts:33` | 16 | **no** |
| `DEFAULT_NEARBY_RADIUS` | `contextCache.ts:26` | 4 | **no** |

§9 Option E (change 48 to another number) is rejected: none of these constants is the defect,
and none is altered.
