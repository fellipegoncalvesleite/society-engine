# Roadmap Item 4 §4 — where a physically departed provisional successor lives

Decided before any lifecycle field is written, because every later layer depends on it.

**Selected: Representation A, on the condition that the canonical lifecycle predicate module becomes
mandatory — which makes it Representation E in substance.** The reasoning is below, and the decision
turns on a measurement that reversed the expected answer.

---

## 1. The measurement that decided it

`provisionalBandReaderSurfaceAudit.mjs` reported **160 enumeration sites, 144 apparently unguarded**.
Taken at face value that is an argument for keeping the provisional successor *out* of `world.bands`,
because 144 unaudited readers is not a surface anyone can honestly claim to have checked.

**Those counts are inflated 3.9×, and the semantic audit says so.**
`provisionalReaderSemanticAudit.mjs` separates three things the lexical scan conflated:

| | lexical | semantic |
|---|---|---|
| "enumeration sites" | 160 | **41 true enumerations** of the band set, across 23 files |
| — of which route through the canonical predicate | — | 2 |
| — of which inline a status test by hand | — | 8 |
| — of which apply no lifecycle filter at all | 144 | **31** |
| keyed lookups `world.bands[id]` (caller already holds the id) | counted as enumerations | **29, and irrelevant** |

The inflation has three specific causes, each checkable: a multi-line
`Object.values(world.bands).filter(...).reduce((bandsById, band) => {...})` is **one** enumeration and
was counted as four or five; `world.bands[someId]` is a **keyed lookup** of an id the caller already
holds, which a provisional successor cannot wander into; and `bandsById[band.id] = ...` is a write
into a **local accumulator**, not a read of the world.

**41 decisions is an auditable surface. 144 was not.** That is the whole difference.

## 2. The finding that made Representation A cheap

**`src/sim/agents/bandLifecycle.ts` already exists, and already owns exactly this question.**

```ts
export function isBandTerminal(band: Band): boolean   // dispersed | absorbed | extinct
export function isLivingBand(band: Band): boolean     // population > 0 && !terminal
export function preserveTerminalBandSnapshots(before, after): WorldState
```

It is the canonical answer to "is this still an ordinary living band?", and a provisional state is
the same *kind* of question. **It is imported by three modules** — `contextCache.ts`,
`faunaStock.ts`, `socialContext.ts` — while everyone else inlines the same test by hand, and a
fourth spelling (`isActiveBand`) lives privately inside `contextCache.ts`.

So the work Representation A implies is not "invent a way to mark a band provisional and hope every
reader notices". It is **route 41 enumerations through a predicate module that already exists and
already means the right thing**, and then make that routing structural with a boundary audit — the
pattern this repository already uses for `adaptationBoundary.ts`, enforced by
`adaptationBoundaryAudit.mjs`, which fails on any unauthorised deep import including sibling `./`
ones.

That is a known, previously executed, mechanically checkable migration in this codebase. It is not a
new architecture.

## 3. The representations compared

| | design | readers genuinely needing change | risk of accidental ordinary-band behaviour | risk of duplicated physical authority | verdict |
|---|---|---|---|---|---|
| **A** | flagged `Band` in `world.bands` | 41, of which ~14 need a real decision | **real, and it is the whole risk** — mitigated by making the predicate module mandatory and audited | **none** — one owner for bodies, cohorts, labour, position, consumption, health, route | **SELECTED** |
| **B** | separate `ProvisionalSuccessor` collection | few, superficially | none | **severe** — presence, consumption, mortality, demography and movement each need a second implementation or an adapter that re-derives them | rejected |
| **C** | provisional party promoted to `Band` at stabilization | few | none | **severe and specific** | rejected |
| **D** | shared physical-group interface over both | all 41, plus every signature | low | low | rejected *for now* |
| **E** | A + mandatory canonical predicate + boundary audit | 41 | **structural**, not merely tested | none | **this is what A becomes, and is what is selected** |

**Why B is rejected, concretely.** The brief asks for one canonical owner of bodies, cohorts,
productive labour, daily position, consumption, health and mortality, route, lifecycle, and eventual
promotion. `Band` already owns all nine. A separate collection owns none of them and must either
duplicate them — which is the two-implementations-of-one-rule defect CORRECTION-28 had to unpick in
`buildCrowdingField` versus `computeCrowdingContribDescriptor` — or adapt back into `Band` anyway, at
which point it is A with extra indirection. **It also fails the honesty test the brief sets: choosing
a separate collection to avoid auditing readers is explicitly forbidden, and avoiding the audit is
its main attraction.**

**Why C is rejected, concretely.** The party model genuinely cannot carry this. `ExpeditionRecord`
holds `partyWorkers` and `nonWorkingPartyPeople` and no cohort structure at all — it has no
dependents/elders split, so **L1's cohort conservation could not even be expressed inside it**.
Demography, births, deaths, food demand, receipts and residential activity are all `Band`-level.
CORRECTION-34D deliberately made a party's physical headcount a *derived* quantity bounded by the
band's population; promoting a party into the owner of population would invert that.

**Why D is rejected for now.** It is the right long-run shape and the wrong change today: it touches
all 41 sites plus every signature between them, for a benefit — explicit reader intent — that the
predicate module delivers at a fraction of the cost. **Recorded as the natural successor if a third
kind of physical group ever appears** (Item 6's absorbed/dissolving groups are the likely trigger).

**Why the fewest-files argument was not used.** B and C touch fewer files. Both were rejected. The
selection is the same discipline `ARCHITECTURE_DECISION.md` applied when it chose Direction D over
the smaller Direction C: **the smallest architecture that is causally truthful, not the smallest
diff.**

## 4. What Representation A commits to

1. A provisional successor **is** a `Band` in `world.bands`, with real bodies at a real tile.
2. Its lifecycle state lives in one new bounded field, and `bandLifecycle.ts` gains the predicates
   that read it — `isProvisionalBand`, `isEstablishedBand` — beside the terminal ones.
3. **`isLivingBand` keeps its current meaning** (a provisional successor *is* living: it eats,
   crowds, gets sick and dies). The new question is a *different* one, and conflating them would
   reproduce the defect CORRECTION-35 found in the released-evidence labels — one name quietly
   answering two questions.
4. Every one of the 41 enumerations is decided in `PROVISIONAL_READER_MATRIX.md`, and a boundary
   audit makes the routing structural rather than remembered.
5. `world.bands` therefore continues to be the one place bodies live, which keeps conservation
   provable at a single seam — the property `ARCHITECTURE_DECISION.md` §3 named as Direction D's
   main advantage.

## 5. Risks accepted, and how each is answered

| risk | answer |
|---|---|
| an unaudited reader treats a provisional group as an ordinary band | the boundary audit fails the run on an enumeration that does not route through the predicate module; this is `adaptationBoundaryAudit.mjs`'s exact mechanism |
| the predicate module becomes a barrel | `adaptationBoundaryAudit.mjs` already checks curated-not-barrel and the same check applies |
| `MAX_BANDS` is consumed by provisional entities | decided explicitly in the matrix (`demography.ts:402/526`), not left to fall out |
| a provisional successor is caught by Item 6 cleanup | `viability.ts:24` is **blocked**; its failure mode is return and reintegration, which is a different outcome from dissolution |
| serialization grows | one bounded field per band; measured at the three horizons before any push |

## 6. Status

**The decision is made. No reader has been edited.** The matrix is the specification the lifecycle
must satisfy, and Layer 1 of §5 begins from it.
