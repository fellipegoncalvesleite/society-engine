# Catchment / expedition accounting ledger

CORRECTION-34A §9. **Decision: Option C — separate local extraction effort from consumption
demand.** The previous formula could not be retained, because the acceptance condition ("away
workers are not counted twice as extractors or consumers") is false as measured.

---

## 1. Term-by-term decomposition

Each state is classified as exactly one of: consumption demand, labor/extraction capacity, physical
stock removal, transport cost, accounting abstraction.

| Term | Where | Classification | Counts away workers? (before) | (after) |
| --- | --- | --- | --- | --- |
| residential food demand | `carryingCapacity.derivePopulationDemand` | **consumption demand** | yes — correct, they still eat | yes (unchanged) |
| residential extraction effort | `sharedCatchment.getBandForagingDraw` | **labor/extraction capacity** | **yes — the defect** | **no (repaired)** |
| residential catchment claim | `getBandForagingFootprint` claim weights | **labor/extraction capacity** | yes, via the draw | no |
| away workers | `getCommittedExpeditionWorkers` | labor/extraction capacity | — | — |
| away-party provisions | `EXPEDITION_PROVISION_UNITS_PER_WORKER_DAY` | **transport cost** | trip-local; never a band store | unchanged |
| target extraction | `resolveExpeditionTargetWork` | **physical stock removal** | at the target tile, once | unchanged |
| carried harvest | `cargo.harvestUnits` | accounting abstraction (in transit) | — | unchanged |
| transit loss | `cargo.lostUnits` | transport cost | — | unchanged |
| party consumption | `cargo.provisionUnitsConsumed` | transport cost | subtracted from cargo at return | unchanged |
| returned receipt | `buildReturnedRecord` → `IntraSeasonTripRecord` | physical stock removal realised as food | once, on physical return | unchanged |
| `humanFoodSupport` | `deriveHumanFoodSupportLedger` | accounting abstraction | reads `seasonalFoodReceipts` | unchanged |
| per-capita support | ledger ÷ demand | accounting abstraction | — | unchanged |

## 2. The defect, stated exactly

`getBandForagingDraw` divides a **contested physical catchment** between bands — it decides how
much of a shared tile's support each band draws. That makes it an extraction-effort term.

Its own comment described it as something else:

> Foraging draw approximates how hard the band pulls on its catchment. **Matches the
> adult-equivalent demand formula in carryingCapacity.derivePopulationDemand** so the shared
> division and the demand denominator are on the same scale.

Naming a quantity extraction effort while calibrating it to consumption demand is the §9
conflation verbatim, and it had a physical consequence, because `demo.workingAdults` is the full
count:

```
a band with 3 of 9 adults away
  claims the residential catchment as though all 9 forage locally   <- extraction #1
  while those same 3 are removing stock at a different tile          <- extraction #2
     (resolveExpeditionTargetWork, same plant/fauna/aquatic stocks, same losses)
  and are provisioned from the party's own carried budget
```

One worker, two extractions. The consumption side was *not* double-counted — provisions come out
of the party's carried cargo, not from a band store — so the repair is confined to the effort side.

## 3. Options considered

| Option | Verdict |
| --- | --- |
| **A — the claim is total residential demand** | **Rejected.** It cannot be, because the value divides a contested *physical* catchment. If it were demand, two bands with identical demand and different local labour would compete identically, which is not physical. |
| **B — the claim is local extraction effort** | **Adopted in substance.** |
| **C — separate effort and demand** | **SELECTED.** Effort counts adults physically at camp; demand keeps counting the whole band. |
| **D — expedition provision transfer** | Rejected for now. Modelling a bounded allocation from residential support to the party at launch requires a stock authority that does not exist; §9 forbids inventing storage. The current trip-local provisioning is already the honest abstraction. |
| **E — trip-local subsistence abstraction** | Retained *alongside* C, and now stated precisely: provisions replace the away worker's residential ration **for the days away**, drawn against the party's carried budget and subtracted from the receipt at return. |
| **F — another design** | Not required. |

## 4. The change

```ts
function getBandForagingDraw(band: Band): number {
  const demo = band.demography;
  const committedAway = partyCompositionTotal(deriveCommittedMobilityPools(band));
  const adults = Math.max(0, demo.workingAdults - committedAway);   // <- the only change
  const dependents = Math.max(0, demo.dependents);
  const elders = Math.max(0, demo.elders);
  return Math.max(1, adults * 1.0 + dependents * 0.65 + elders * 0.85);
}
```

**Authority changed, strength deliberately not tuned.** The dependent (0.65) and elder (0.85)
weights are untouched. They are the existing calibration, and §9 forbids preserving aggregate
output by adjusting unrelated terms — so this changes *who* is counted, never *how strongly* each
person counts. The committed count comes from `deriveCommittedMobilityPools`, the same authority
`deriveAvailableMobilityPools` uses, so "who is at camp" cannot diverge between the two readers.

`carryingCapacity.derivePopulationDemand` is **untouched**: an away worker still has to be fed.

## 5. Measured effect — fixture P22

Two bands, identical demography, differing only in how many workers are away:

| Arm | away workers | catchment claim | consumption demand |
| --- | --- | --- | --- |
| all workers home | 0 | **127.02** | 25 |
| three workers away | 3 | **109.62** | 25 |

Verdict: `EFFORT_FALLS_DEMAND_HOLDS`. Local extraction effort falls when bodies leave; consumption
demand does not, because those bodies still eat.

## 6. Acceptance condition

> The checkpoint may retain the present catchment formula only if controlled evidence proves that
> away workers are not counted twice as extractors or consumers.

**It could not be proven, because it was false.** The authority was therefore repaired rather than
retained. No unrelated yield was tuned to preserve aggregate output; `catchmentInvariants.mjs`
passes unchanged (0.5/0.5 symmetric split, per-capita 1.5 → 1.2 under contest), as do the food
pipeline (`verdict: PASS`), step-mode invariance (`fullCanonicalStateMatch: true`,
`firstDivergence: null`) and season-order invariance.

## 7. Residual, stated not buried

- Whether `0.65` and `1.0` are the right *extraction* weights is **untested**. As demand weights
  they were ordinary; as effort weights, dependents at 0.65 of a working adult is arguably high.
  The authority is now correct; the magnitude is inherited and unproven, exactly as CORRECTION-32
  fixed the crowding authority without tuning its strength.
- A band whose whole party is away still claims a floor of `Math.max(1, ...)`. That floor predates
  this checkpoint and is retained.

---

## CORRECTION-34B addendum — the committed count the catchment reads must be true

CORRECTION-34A re-sourced `getBandForagingDraw` to `partyCompositionTotal(deriveCommittedMobilityPools(band))`.
That is the right authority, but it was only as correct as the composition behind it — and
CORRECTION-34A's partial reduction left composition stale.

Measured at `fd868d6` with six workers reduced to five:

```
workingAdults                                   5
getCommittedExpeditionWorkers                   5
partyCompositionTotal(deriveCommittedMobilityPools)   6   <- stale
residential effort adults = 5 - 6              -1   <- negative extraction effort
```

The draw *value* read 32.085 in both arms because `Math.max(0, ...)` clamps −1 to 0. **The clamp hid
the defect in the output while the input was wrong**, which is why the audit reports `effortAdults`
separately rather than trusting the draw.

After CORRECTION-34B the composition is reduced with the workers, so effort adults read **0** and
the two committed totals agree. Natural sweep: **0 catchment/worker mismatches in 64,800 band-days
at 20 y and 162,000 at 50 y**. Consumption demand is untouched throughout.
