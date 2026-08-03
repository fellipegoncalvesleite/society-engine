# Roadmap Item 4 §3 — split policy matrix

Every field in `SPLIT_STATE_INVENTORY.md` classified into exactly one of the nine kinds, with the
policy that kind licenses. **Published before implementation choices, as §3 requires.**

The governing rule this matrix exists to enforce:

> **Do not impose additive conservation on non-additive intensities.**

Cohorts are people and must add up exactly. Hunger is not people and cannot be halved by halving a
band — but it also may not improve because a group walked out of a hard camp. Those are different
failures needing different policies, and the current code applies the wrong one to both.

---

## The nine kinds and what each licenses

| Kind | Policy | Conservation claim |
|---|---|---|
| additive physical quantity | allocate exactly | **exact additive** |
| additive demographic quantity | allocate exactly | **exact additive** |
| non-additive embodied intensity | conservative aggregate projection | **no unearned improvement**; no exactness claimed |
| material capability | physical allocation, or honest zero | **exact, or nothing** |
| learned capability | partial / degraded transmission | none — transmission, not conservation |
| current commitment | explicit reset or ownership transfer | **never duplicated** |
| memory / historical record | reset with retained lineage, or bounded shared provenance | none — identity, not quantity |
| derived summary | recompute **last** | follows its inputs |
| debug / read-model | reset | none |

---

## The matrix

| Field | Kind | Current | Required policy | Why |
|---|---|---|---|---|
| `population` | additive demographic | allocated then re-derived | **allocate exactly** | people |
| `workingAdults` | additive demographic | **re-derived at 55%** | **allocate exactly** | L1 |
| `dependents` | additive demographic | **re-derived at 35%** | **allocate exactly** | L1 — currently manufactured |
| `elders` | additive demographic | **re-derived at 10%** | **allocate exactly** | L1 |
| `householdCount` | derived summary | derived from population | recompute last | not a household model |
| `hungerPressure` | **non-additive embodied intensity** | `parent × 0.86` | **carry forward, no discount** | L2 — walking away is not eating. A ×0.86 is an unearned improvement; a ÷2 would be an equally false exactness claim |
| `seasonalSupport` | derived summary | reset, re-derived same day | recompute last, from the successor's own receipts | correct already — see the support correction |
| `seasonalFoodReceipts` | **additive physical** | reset | **honest zero** | a successor has earned nothing yet |
| `nutrition` state | derived summary | via `seasonalSupport` | recompute last | follows receipts |
| `acuteRisk` | **non-additive embodied intensity** | **reset** | **conservative aggregate projection** | L5 — founders do not leave injuries behind |
| `conditionProfile` | derived summary | reset/recompute | recompute last | honest once L1–L7 hold |
| `chronicHardship` | non-additive embodied intensity | reset | conservative projection | same class as `acuteRisk` |
| `deathMemory` | **memory / historical record** | **reset** | **bounded shared provenance, same source event IDs** | L6 — memory transmission, *not* conservation; both sides may remember one death without it becoming two deaths |
| `bodyCampLogistics` | derived summary over embodied + material | **reset then recomputed from clean** | recompute **last**, after honest cohorts, condition, material and location | L7 |
| `mobility` composition | derived summary | derived | recompute last | follows cohorts |
| `fatigue` / movement history | memory / record | reset | reset, retain lineage | history |
| `cohesion` | non-additive social intensity | `× 0.94 + 0.04` | carry forward; **the `+0.04` floor is unexplained and must go or be justified** | L9 |
| `socialTension` | derived summary | reset/recompute | recompute last | follows contacts |
| `storageCapacity` | **material capability** | **hardcoded `0.16`** | **allocate physically, or honest zero** | L3 — currently capability from nothing |
| `technologies` | material / learned | not inherited | keep; verify no unearned capability | correct |
| `carryingCapacity` | derived summary | derived from cohorts | recompute last | follows cohorts |
| `placeMemory`, `observedTiles`, corridors, crossings | **learned capability** | partial + degraded | keep unchanged | already correct — 13.4% / 14.8% |
| `resourceKnowledge` | learned capability | degraded, `detailLoss` recorded | keep unchanged | correct |
| `exploitationSkill` | learned capability | halved, `processing_learned` re-earned | keep unchanged | correct |
| `currentIntent` | **current commitment** | dispersal intent | **transfer or reset once** | never duplicated |
| `expeditions` | **current commitment** | reset | **honest zero** | bodies cannot be in two parties |
| prepared commitments | current commitment | withheld from founding | explicit recorded policy | §7 |
| `probeMemory`, investigations | current commitment | reset | reset | correct |
| `practicalAdaptation` attempts | current commitment | inherit hints only | keep unchanged | correct |
| `viability.status` | **derived summary** | **`"viable"` at creation** | **not set at departure — provisional lifecycle owns it** | L4 |
| `lineage`, `fissionEvents` | memory / record | own founding record | keep; extend with attempt identity | §16 |
| `eventHistory`, debug rings | debug / read-model | reset | reset | correct |
| `territorialPressure` | inert legacy | carried inert | **stays inert** | Item 3 frozen |

---

## Consequences that constrain the implementation

1. **Two different conservation claims must be published separately.** The cohort ledger claims
   **exact additive equality**. The embodied-condition ledger claims only **no unearned improvement**.
   Publishing one number for both would be the false precision this matrix exists to prevent.

2. **`recomputeDemographicCounts` must not touch either side of a split.** It is the mechanism of
   L1. It remains correct for ordinary demographic advance.

3. **Derived summaries must be recomputed last**, in dependency order: cohorts → embodied condition
   → material capability → location and travel state → `bodyCampLogistics`, `conditionProfile`,
   `carryingCapacity`, `mobility`. Recomputing any of them from laundered inputs reintroduces L7
   silently.

4. **`deathMemory` is the one field where "conserve" is the wrong instinct.** It is memory, not
   substance. The policy is bounded shared provenance carrying the **same source event IDs**, so one
   remembered death cannot become two independent deaths.

5. **Where no truthful allocation authority exists, the honest value is zero, not a default.**
   `storageCapacity: 0.16` is the counterexample: a default that was never earned, on either side.

---

## What this matrix cannot decide, and why

Partitioning embodied intensity truthfully — which founders carry which injury, which fatigue —
requires **individuals**, which do not exist. Every policy in the "non-additive embodied intensity"
rows is therefore an **aggregate accounting convention**, exactly as the cohort allocation is, and
must be named as one in the implementation rather than presented as a measurement.

The same applies to `deathMemory`: without individuals there is no fact of the matter about who
grieves. Bounded shared provenance is a convention chosen because it cannot double-count, not
because it is true.
