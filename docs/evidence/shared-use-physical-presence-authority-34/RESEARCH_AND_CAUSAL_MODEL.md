# CORRECTION-34 — RESEARCH AND CAUSAL MODEL

## 1. Causal brainstorming, answered before the architecture was chosen

**When some people leave camp, who remains?** Nearly everyone. A logistical party is a small
task-specific group — commonly two to a handful of adults — drawn from a residential group of
tens. Children, elders, caregivers and the injured stay. The measured repository case matches: a
2-worker party from a 22-person band, leaving a remainder of 20.

**Same-day trip vs multi-day expedition.** The first returns before the day ends and never
transfers residence; the second physically occupies distant ground across days and may sleep at a
field camp. The repository already models both, with different records.

**Temporary task camp vs residence.** A field camp is an operating base for one task: it has no
storage institution, no territorial claim and no permanence. Production already asserts this
(`TemporaryTaskPartyRecord`, `noCamp: true`; `ExpeditionTaskCamp` expires with its operation).

**When is a party physically at a target rather than headed there?** Only in `operating`.
`outbound` and `returning` are *route* positions, and the repository does track a real
`positionTileId` for them — which is why they can be represented as bodies at all.

**Does a residential catchment represent where residents stand, or where task groups obtain
resources?** The second. That is exactly why the catchment was **not** collapsed into body
presence here (§8.9): they answer different questions, and conflating them would destroy
central-place foraging.

**Can two parties deplete the same stock without meeting?** Yes — and this repository already
represents the depletion physically while representing no perception at all. Co-presence must
therefore stay separate from observation.

**How should party size affect physical pressure?** Proportionally to people. A six-person party
is not a band.

## 2. Classification

| Mechanism | Status |
| --- | --- |
| Residential/logistical mobility as distinct strategies; residential bases vs locations vs field camps | **Well-supported mechanism** (Binford 1980; Kelly 1983, 2013) |
| Task groups are small, task-specific, and drawn from a larger residential group | **Well-supported mechanism** |
| Central-place foraging: acquisition organised around a residence, not around each body | **Well-supported mechanism** (Orians & Pearson 1979) |
| Interference competition among central-place foragers at concentrated patches | **Well-supported mechanism**, but distinct from realised depletion |
| Group foraging can *facilitate* as well as compete | **Ethnographic and behavioural-ecology variation** — deliberately NOT implemented (§11.6); it needs coordination this repository does not represent |
| Whether co-presence is perceived at all | **Contested / unrepresentable here** — no visibility, route-timing or barrier authority exists |
| `CROWDING_RADIUS = 4` and the population→weight transform | **Simulator abstraction**, inherited unchanged |
| Party weight = `min(1.6, workers/36)` | **Calibration choice**, reusing the existing transform rather than inventing a party constant |
| Same-day ephemeral presence; party-to-party encounters; tracks; fear/trauma | **Future-system dependencies**, explicitly deferred |

## 3. The model implemented

```text
band population
  → residential remainder at band.position        (population - away workers)
  → one bounded body group per away party at its own positionTileId
  → terminal expeditions contribute nothing
  → people conserved exactly, every day
```

Physical bodies only. No perception, no fear, no claim, no norm.

## 4. Bibliography

Standard references, used to constrain the causal model; **no coefficient was chosen from them**.

- Binford, L. R. (1980). *Willow Smoke and Dogs' Tails: Hunter-Gatherer Settlement Systems and
  Archaeological Site Formation.* American Antiquity 45(1) — residential bases, locations, field
  camps; foragers vs collectors.
- Kelly, R. L. (1983). *Hunter-Gatherer Mobility Strategies.* Journal of Anthropological Research
  39(3); and Kelly (2013), *The Lifeways of Hunter-Gatherers* (2nd ed.) — variation between
  residential and logistical mobility.
- Orians, G. H. & Pearson, N. E. (1979). *On the theory of central place foraging.* — the formal
  basis for organising acquisition around a residence.
- Kelly, R. L. et al., and the broader logistical-mobility literature on long-range task groups.
- Behavioural-ecology work on interference competition and on facilitation in group foraging —
  cited to establish that a universal crowding cost is **not** supported.

**Provenance note:** these are long-established works cited from the established literature; they
were not re-verified page-by-page in this pass, and none was used as calibration.
