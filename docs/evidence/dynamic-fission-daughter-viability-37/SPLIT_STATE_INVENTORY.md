# Roadmap Item 4 §5 — split-state inventory

Every current-state family affected by the `{ ...parent }` spread or an explicit daughter override,
read from production at `ab29864`.

**The governing principle:**

> Separation must not make either side healthier, younger, better equipped, more knowledgeable or
> more viable merely because a split occurred.

---

## 1. The discipline that already exists

`DAUGHTER_NON_CLONEABLE_FIELDS` registers **~60 fields**, each with an explicit written policy —
reset, inherit-degraded, or recompute — and `assertDaughterFissionStateNotCloned` fails loudly if
any still points at the parent's object. Knowledge, memory, social records, debug rings, frontier
cadences and skill are all handled, and the before-audit confirms the behaviour: 13.4% / 14.8%
knowledge inheritance, 0 clones, 0 inherited receipts, 0 inherited expeditions.

**That machinery is sound and must be preserved.** The gap is not in *learned* or *historical*
state. It is in **demographic and embodied-condition** state, where "reset" is not neutral — it is
an improvement.

---

## 2. Laundering paths that survive

| # | Field | Current behaviour | Class | Effect | Verdict |
|---|---|---|---|---|---|
| **L1** | `demography` cohorts | both sides passed through `recomputeDemographicCounts`, which re-derives from population at 35% / 10% / remainder | demographic | **dependents manufactured (+4, +3), working adults and elders destroyed**; conserved 0 of 2 on all three counts | **LAUNDERS — must become ALLOCATION** |
| **L2** | `hungerPressure` | `clamp01(parent.hungerPressure * 0.86)` | embodied condition | the daughter begins **14% less hungry than the camp it walked out of** | **LAUNDERS — walking away is not eating** |
| **L3** | `storageCapacity` | hardcoded `0.16` — the spawn default | material capability | assigned by construction regardless of the parent's value; feeds `baseComfort` at ×8. A parent below 0.16 yields a daughter that is *better equipped* | **LAUNDERS — material capability from nothing** |
| **L4** | `viability.status` | set to `"viable"` at creation, with `viabilityPressure: 0.08`, `extinctionRisk: 0` | derived status | declares the outcome Item 4 exists to test, at the moment of departure | **FORBIDDEN by §16 — must not be set at departure** |
| **L5** | `acuteRisk` | reset | embodied condition | accumulated short-run hardship discarded; founders leave their injuries behind | **LAUNDERS — needs a partition or an explicit conservative convention** |
| **L6** | `deathMemory` | reset | embodied / social | bereavement erased for the leavers | **LAUNDERS — a group that just lost people still remembers** |
| **L7** | `bodyCampLogistics` | reset/recompute | embodied logistics | carry burden, sickness and camp-waste pressure discarded | **LAUNDERS** |
| **L8** | `conditionProfile` | reset/recompute | derived summary | recomputed from state that has itself been laundered | **DERIVED — correct once L1–L7 are fixed** |
| **L9** | `cohesion` | `clamp01(parent.cohesion * 0.94 + 0.04)` | social | a small unexplained adjustment in both directions | **REVIEW — the `+0.04` floor is unexplained** |
| **L10** | `technologies` | "legacy display tags are not inherited" | material | correct not to inherit complex competence — but nothing verifies the daughter has no capability it never earned | **ACCEPTABLE, verify** |

**L1–L4 are the blocking set.** L5–L7 are the embodied-condition family §17 requires a stated
convention for. L8–L10 follow.

## 3. Correct, and to be preserved unchanged

| Field family | Policy | Evidence |
|---|---|---|
| observed tiles, place memory, corridors, crossings | partial and degraded | 13.4% / 14.8%, 0 clones |
| resource knowledge | degraded with `detailLoss` recorded | `inheritResourceKnowledgeForDaughter` |
| `exploitationSkill` | inherited degraded — competence halved, `processing_learned` re-earned | registry |
| `seasonalFoodReceipts` | reset | 0 inherited in both fissions |
| `seasonalSupport` | reset at creation, re-derived same-day from the daughter's own state — reads **0** against the parent's 1.12 | `FISSION_BEFORE_SUPPORT_CORRECTION.md` |
| expeditions, trips, pending tasks | reset | 0 and 0 |
| social records — encounters, contacts, friction, access memory, reports | reset | registry |
| debug and event rings | reset | registry |
| `territorialPressure` | carried as inert legacy | Item 3 frozen; **must stay inert** |

## 4. The rule the implementation must apply

Not every field takes the same policy, and "reset" is the wrong default for one whole class:

| class | correct default | why |
|---|---|---|
| **demographic cohorts** | **ALLOCATE** | people are conserved; they cannot be re-derived |
| **embodied condition** | **PARTITION or carry a stated conservative aggregate** | bodies bring their hunger, injury and fatigue with them |
| **material capability** | **ALLOCATE or start at nothing** | never assign a default that was not earned |
| **learned knowledge** | **DEGRADE** | already correct |
| **history and records** | **RESET, retaining lineage** | already correct |
| **derived summaries** | **RECOMPUTE last** | correct once inputs are honest |

**Fixing L1 alone would leave a system that no longer manufactures dependents but still hands the
founders a 14% hunger discount, a free storage capacity and a `viable` badge.** That is why this
inventory exists before the implementation rather than inside it.

## 5. Dependencies stated

Partitioning embodied condition truthfully — which founders carry which injury, which fatigue —
requires the **individual/household layer** that does not exist. Until it does, every policy chosen
here is an **aggregate accounting convention** and must be named as one, exactly as the cohort
allocation must be.
