# ROADMAP ITEM 4 — WHAT MAY TRANSFER WHEN ONE HUMAN GROUP PHYSICALLY DIVIDES

Branch `checkpoint/dynamic-fission-provisional-successor-38`. Closes the **provisional quarantine
contract**: the exhaustive field-transfer policy, the embodied-burden rule, bodily-process admission
and cadence, positive controls for every blocked ordinary system, and the phase-complete reader
classification. **Travel is not started.**

---

## 1. The measurement that forced this

`performAtomicDeparture` built the successor from `{ ...parent }` plus eighteen hand-written
overrides. A per-field probe of a **real** departure — a parent of 34 sending 11 founders out —
found:

> **86 of the 125 populated `Band` fields were still the parent's own object.**

Not similar values. The same objects, by reference. Among them:

| what the spread handed over | why it is wrong |
|---|---|
| complete `knowledge`, `placeMemory`, `travelCorridors`, `crossingMemories` | the legacy daughter inherits 13–15%, degraded and source-tagged; a perfect copy is free omniscience about country nobody in the group walked |
| `exploitationSkill`, `adaptiveHuman`, `practicalAdaptation`, `animalPatternKnowledge`, `frontierIntent` | every one is deliberately DEGRADED by the legacy path, because cultural transmission is lossy |
| `verificationEvidence`, `frontierVerificationAttempts` | CORRECTION-23B states in so many words that a daughter inherits none: it did not walk there and did not draw that water |
| `carryingCapacity`, `populationDemand`, `perCapitaReturn`, `rangeSaturation`, `seasonalSupport`, `returnTrend` | all derived from the parent's 34 people while the group holds 11 — the stale-derived-state defect L7 exists to prevent |
| `residentialAnchor`, `anchorMemories`, `seasonalRound`, `campMovement`, `foragingRadiusState` | a camp, a catchment and an annual round the group does not have |
| `eventHistory`, `causalTraces`, `movementHistory`, `deepHistory`, `encounterRecords`, `contactMemories` | the parent's biography and its entire social world, claimed by a group zero days old |
| `color` | the successor was given **the parent's own colour**, making the two halves indistinguishable at the exact moment a viewer most needs to tell them apart |

Enumerating those 86 would have fixed 86 fields and left the eighty-seventh to whoever adds the next
`Band` field.

---

## 2. Why a table and not a list

`DAUGHTER_NON_CLONEABLE_FIELDS` is real, works, and is a list of **what someone remembered**. Counted
exactly it covers **67 of `Band`'s 133 fields**. The other 66 are not decided — they are unexamined,
and the spread decides them by default.

`src/sim/agents/fissionFieldTransferPolicy.ts` is a `Record<keyof Band, FieldTransferPolicyEntry>`.
Three independent mechanisms enforce it:

1. **Type** — a missing key does not typecheck. *This fired on its first compile and caught a field I
   had genuinely missed (`position`).*
2. **Structure** — `fissionFieldTransferAudit.mjs` re-derives `keyof Band` from `types.ts`
   independently of the compiler, so weakening the annotation still fails the run.
3. **Behaviour** — a real departure is performed and the constructed successor is checked field by
   field. A violation **refuses the departure**; it does not warn.

### The twelve classes, as measured

| class | fields |
|---|---:|
| FORBIDDEN_TO_COPY | 40 |
| INVALIDATE_UNTIL_LATER_PHASE | 33 |
| RESET_ACTIVE_COMMITMENT | 16 |
| DEGRADED_OR_PARTIAL_INHERITANCE | 13 |
| REBUILD_READ_MODEL | 8 |
| SHARED_HISTORICAL_FACT | 7 |
| NEW_SUCCESSOR_IDENTITY | 4 |
| FOUNDER_CARRIED_EMBODIED_BURDEN | 3 |
| RECOMPUTE_FROM_SUCCESSOR_TRUTH | 3 |
| CURRENT_LINEAGE_PROVENANCE | 2 |
| EXACT_COHORT_TRANSFER | 2 |
| LEGACY_COMPATIBILITY_GATED | 2 |
| **total** | **133** |

**Structural resets are driven by the classification, not by a list in the seam.** A field classified
`absent`/`empty`/`zero` is reset by virtue of being classified, with no edit to
`fissionDepartureSeam.ts` at all. That is the difference between a policy and a set of overrides
someone has to remember to extend.

---

## 3. Result — 86 → 5

| | before | after |
|---|---:|---:|
| populated fields still the parent's own object | **86** | **5** |
| policy violations | not checked | **0** |

The five are `health`, `subsistenceModes`, `deathMemory`, `biomeAdaptation` (all
`SHARED_HISTORICAL_FACT`) and `socialPressure` (the one published `carried_pending_recompute`).
`deathMemory` is shared **by reference deliberately** — L6, so one remembered death cannot become two
independent bereavements.

Measured on the constructed successor:

| quantity | parent | successor |
|---|---:|---:|
| observed tiles | 58 | **15** |
| place memory | 42 | **5** |
| travel corridors | 9 | **2** |
| resource patches | 48 | **12** |
| technologies | 3 | **1** |
| storage capacity | 0.16 | **0** |
| residential anchor | present | **none** |
| carrying capacity | present | **none** |
| hunger pressure | 0.62 | **0.62** (no L2 relief) |
| `acuteRisk.bandId` | parent | **the successor's own** |

Knowledge is partial **through the same canonical inheritors the legacy daughter path uses** —
re-implementing the degradation here would be a second answer to a question that already has one.

---

## 4. Embodied burden

`FOUNDER_CARRIED_EMBODIED_BURDEN` covers `health`, `hungerPressure`, `acuteRisk`. Two rules:

- **It may never improve by travelling.** Scalars compare directly; `health` compares **term by
  term**, so a burden cannot be softened on one axis while another rises to hide it in an average.
  The legacy path's `parent * 0.86` hunger and its `acuteRisk: undefined` reset are both refused.
- **It is re-identified.** `acuteRisk` is retained (L5 — clearing it is cure-by-reset) but rebuilt
  with the successor's own `bandId`: the parent's object stamps every episode the successor holds
  with another band's identity.

---

## 5. One policy, two consumers

`demography.ts` now **derives** its registry from the table. The derived set is a superset of the
retained 67-field literal by exactly two fields — `pendingInvestigation`,
`recentInvestigationOutcomes` — and that difference is **provably inert**: the clone guard fires only
when `parentValue !== undefined && daughter[field] === parentValue`, and `createDaughterBand` writes
`undefined` to both explicitly, so the second condition can hold only when the first is false.

### Published legacy debt — 33 fields

The policy forbids copying 44 fields wholesale that the legacy clone guard does not register; of
those, **33 are also not overridden by `createDaughterBand`**, so its daughter receives them by
reference. Method is **lexical** — parsed from that function's own object literal — and it cannot see
a field handled by a helper it calls.

The debt includes `residentialAnchor`, `currentCampTileId`, `anchorMemories`, `carryingCapacity`,
`populationDemand`, `perCapitaReturn`, `rangeSaturation`, `seasonalRound` — and **`expeditions`**.
`demography.ts` contains **zero occurrences of the word `expeditions`**, so a legacy daughter holds
the parent's away-party records by reference, which is a shared-body condition of the class
CORRECTION-34 removed elsewhere. It is reachable — CORRECTION-34D measured 18 band-days at 20 years
where an active party crosses an annual boundary — and its **natural frequency is NOT MEASURED here.**

**Not repaired.** Changing `createDaughterBand` changes ordinary ecology on every natural fission and
needs its own before/after evidence.

---

## 6. The quarantine contract — with the control inside the experiment

The previous admission audit compared the successor against an **unrelated** ordinary band, which
leaves open that the successor would not have acted anyway. This uses a **with-minus-without**
counterfactual: two worlds identical but for the successor's `provisionalSuccessor` record — the only
thing every gate reads — advanced over the same days.

**11 fields blocked by the gate**, each a positive control: `decisions`, `expeditions`, `knownTiles`,
`moveEvents`, `position`, `protoCamp`, `receipts`, `status`, `storageCapacity`, `trips`, `viability`.
The only field moving in the quarantined arm and not the released one is `provisionalPhase`, written
by the provisional resolver — the one authority permitted to touch a quarantined group.

**A quarantine is not a freezer.** The annual demographic step **runs on the group while it is still
quarantined** (measured, day offset 60), its cohorts move, and its hunger rises. A group nothing can
harm is a group that cannot fail, which is defect 5 restored under a new name.

### Phase-complete classification

| phase | terminal | `isProvisionalSuccessor` | `isProvisionalGroupInTransit` | `isEstablishedBand` | `isLivingBand` |
|---|---|---|---|---|---|
| travelling | no | **true** | true | false | true |
| establishing | no | **true** | **false** | false | true |
| failed_early | no | **true** | **false** | false | true |
| returning | no | **true** | true | false | true |
| reintegrated | yes | false | false | true | true |
| stabilized | yes | false | false | true | true |
| provisional_extinguished | yes | false | false | — | — |

The two `false` cells in the transit column are the measured justification for the canonical rule:
**gating on `isProvisionalGroupInTransit` would have readmitted `establishing` and `failed_early`
through the same doors.**

---

## 7. FINDING — a group can leave quarantine on a timer, into ordinary status

Found by this audit's own corrected window, not by reading code. Advanced past the return bound, the
successor runs `travelling` → (timeout) `returning` → (timeout) `reintegrated`. The kernel contract
states `reintegrated` means *"rejoined the parent; the provisional entity is removed exactly once"* —
and **nothing removes it**, because the physical return and reintegration writers do not exist yet.
Reproduced: quarantine ends after 359 days, the band stays in the world holding 11 people, stops
being provisional, and resumes ordinary behaviour with its people never having gone anywhere or come
back.

This is the exact mirror of the property the kernel is proud of. `establishing` routes its timeout to
`failed_early` precisely so **a timer alone can never stabilize** — but `returning` routes its timeout
to a terminal phase with no writer behind it, so **a timer alone does reintegrate**, promoting a group
to ordinary status having demonstrated nothing.

**Not repaired here**, and the reason is the stopping boundary rather than difficulty: reintegration
is the return vertical, which this pass is forbidden to begin.

---

## 8. Instrument errors in this pass's own audits

Three, each of which would have produced a confident wrong number:

1. **The quarantine window was measured over days the group was not quarantined.** A fixed 400-day
   window reported trips, receipts, proto-camp memory and knowledge as ADMITTED — a leak, apparently.
   The lifecycle had resolved mid-window and ordinary behaviour resuming was the gates working. The
   window is now the quarantine itself.
2. **Off-by-one at the quarantine boundary.** The gate was tested *before* each step and the diff
   recorded *after*, so the single day the resolver ended the quarantine was still counted — picking
   up proto-camp memory the band legitimately acquired once ordinary. Now tested after the step.
3. **A horizon artefact hid the bodily-process claim.** At warm-up 1800 the annual demographic step
   falls on day 360, **one day after** the quarantine ends, so Q4 could observe no ageing at all and
   its claim rested on hunger alone. At 2100 the boundary falls inside the window. Same class of
   error CORRECTION-34D and -34A both recorded.

A fourth error was in a **fixture**, not an instrument: `fissionDepartureSeamAudit`'s synthetic world
had no `tiles` map and its parent no knowledge stores, so the seam's new canonical inheritors crashed.
The fixture was completed rather than the seam weakened — a world with no tiles is not a world, and
the fixture passed before only because the seam had never needed to look. Its band colour `#111` is
4-digit shorthand that `hexToHsl` cannot parse, so `deriveDaughterColor`'s non-hex guard returned the
parent's colour verbatim and the transfer policy refused the departure as
`color:identical_to_the_parent`. **The guard was right.**

---

## 9. Evidence

- `fission-field-transfer.json` — T1–T12, **12 passing, 0 failing, 0 vacuous**
- `provisional-quarantine-contract.json` — Q1–Q9, **9 passing, 0 failing, 0 vacuous**

## 10. What this does NOT claim

- **No travel.** The successor still cannot walk; it is quarantined and inert, and this pass does not
  change that.
- **No natural occurrence.** Nothing in production calls the departure seam; there is no natural-run
  evidence for any of it.
- **The legacy debt is measured lexically** and its natural frequency is unmeasured.
- **`socialPressure` still holds the parent's derived value**, published rather than hidden.
- **Reintegration is unbuilt**, and §7 is the consequence.
