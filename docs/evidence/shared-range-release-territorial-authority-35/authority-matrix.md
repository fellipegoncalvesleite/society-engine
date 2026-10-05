# CORRECTION-35 — `territorialPressure` authority matrix

Derived by enumerating **every** occurrence of the identifier in `src/`, not from memory and not
from documentation. The command is reproducible:

```bash
grep -rn "territorialPressure" src/
```

There are **two different fields with the same name**. Conflating them is the first mistake
available here, so they are separated before anything else is said.

---

## A. `Band.territorialPressure`

The field the correction is about.

| # | Site | Role | Cadence | Provenance | Behavioural consequence | Class |
|---|---|---|---|---|---|---|
| 1 | `agents/spawn.ts:922` | **WRITER** — `territorialPressure: 0.12` | once, at band creation | a hardcoded constant | none directly | writer |
| 2 | `agents/demography.ts:1008` | **WRITER** — `clamp01(parent.territorialPressure * 0.72 + 0.04)` | once, at daughter creation | a share of the parent's copy of the same constant | none directly | writer |
| 3 | `agents/pressure.ts:293` | *was* `band.territorialPressure * 0.08` into `mobilityPressure` | every derivation | — | **moved `mobilityPressure`, `netMovePressure`, candidate scores, selected action** | **REMOVED behavioural reader** |
| 4 | `rules/mobilityIntent.ts:930` | *was* `band.territorialPressure * 0.12` into the intent-context mobility pressure | every intent build | — | **opened and scored movement intents** | **REMOVED behavioural reader** |
| 5 | `rules/bandDecision.ts:5544` | *was* `band.territorialPressure * 0.14` inside `getMobilityPressure` | every stay reason | — | **the `pressure` figure a `known_site_sufficient` / `low_mobility_pressure` reason reports about itself** | **REMOVED attribution reader** |
| 6 | `rules/bandDecision.ts:5225` | copy into `DecisionContextSnapshot` | per decision | mirrors the field | none — no reader | inert record copy |
| 7 | `agents/campMovement.ts:1708` | copy into `DecisionContextSnapshot` | per camp decision | mirrors the field | none — no reader | inert record copy |
| 8 | `runner/simRunner.ts:331,480` | copy into the selected-band UI projection | per projection | mirrors the field | none — display only | inert projection copy |
| 9 | `agents/types.ts:6594` | declaration | — | — | — | type |

**Behavioural readers before this correction: 3. After: 0.**

The original brief named two. The third — `mobilityIntent.ts` — was found by the inventory rather
than inherited from the brief, and it is the one that scores movement intents.

### Does lived evidence ever change it?

No. Sites 1 and 2 are the only writers, and neither reads crowding, encounters, friction, access
expectation, contested use, resource sharing or culture. Measured over a natural world:

- 64,800 band-days at 20 years and 162,000 at 50: the field takes **exactly one distinct value,
  0.12**, and changes **zero times** outside daughter creation.

So the field is a constant stamped at birth. A band that has never met another band, never been
crowded and never been refused anything carried the same territorial motive as one that had been
in friction for decades.

### Is the consequence already owned by an authority with real provenance?

Yes, and that is why removal is the correct repair rather than finding it a writer:

| consequence | the authority that legitimately owns it |
|---|---|
| another band is physically here | `crowdingPenalty` — `CORRECTION-28` / `-32`, current physical proximity only |
| we have had trouble with them over this place | `recentRangeFrictionEvents` — `CORRECTION-30`, observer-grounded provenance |
| I expect difficulty using this place | `protoAccessMemory` — `CORRECTION-31`, with a lifecycle and release |

---

## B. `SocialPressureProfile.territorialPressure`

**A different field. It has never had a reader.**

| # | Site | Role |
|---|---|---|
| 1 | `agents/spawn.ts:1266` | **WRITER** — `territorialPressure: 0.08` at spawn |
| 2 | `agents/demography.ts:742,1011` | carried forward unchanged by `applyDemographyToSocialPressure`'s spread |
| 3 | `agents/types.ts:99` | declaration |

`grep -rn "socialPressure\." src/ \| grep -i territorial` returns **nothing**. There is no read
site anywhere in the repository.

The two fields hold **different constants** — `0.08` here against `0.12` on `Band` — which is by
itself proof they were never one authority.

**Classification: a second orphan, but an inert one.** It has never reached behaviour, so it is not
a blocker and nothing was removed. It is documented in `types.ts` so a future reader cannot mistake
it for a live signal, and so that a future territoriality system does not wire it up by accident.

---

## What was NOT done, deliberately

- **No lived territorial writer was added.** Inventing one would be a new social system, and
  cultural or institutional territoriality belongs to a later roadmap item with its own evidence.
- **No accepted signal was rebranded.** Crowding, friction and access expectation were not renamed
  or re-weighted to absorb the removed term. `CROWDING_DECISION_COST_WEIGHT` is untouched.
- **The field was not deleted from state.** Serialized worlds, the UI projection and the decision
  context stay readable, and a future system has a name to claim — provided it arrives with its own
  writer.
