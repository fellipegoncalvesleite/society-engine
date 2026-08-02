# Default Expedition Carrying Rule — validated against production

**Status: the rule is ALREADY the implemented architecture, with one named gap that is deferred.**

No production change was made for this rule in CORRECTION-34A. §4 excludes transport technology and
food storage from this checkpoint's scope, and §10 records transport technologies as a deferred
expedition-realism debt. This document records the rule, the verification, and the single gap, so
neither the rule nor the gap is lost.

---

## 1. The rule as stated

> A human task party begins with only minimal bodily carrying capacity: hands, arms, improvised
> wrapping and whatever ordinary personal objects the group already possesses.
>
> Containers, packs, baskets, slings, storage vessels, sledges and other transport aids are not
> automatic properties of an expedition.
>
> Greater carrying capacity and longer viable expeditions require: recognizing that
> transport/storage is limiting returns; having access to suitable materials; experimenting with a
> carrying or containment method; acquiring the necessary craft knowledge; producing the object
> with real labor; testing it successfully; maintaining or replacing it; transmitting the practice
> to later parties.
>
> ```
> ordinary party
> -> short range, low carry capacity, frequent return
>
> repeated transport problem + suitable materials + experimentation + successful learned practice
> -> improved container/carrying technology
> -> more provisions carried outward
> -> more cargo returned
> -> potentially longer or more productive expeditions
> ```

## 2. Verification against production

Read at `4042210b332d41b91ed394aa9307962f0106a60c`; unchanged by CORRECTION-34A.

### 2.1 The bodily baseline is the default

```ts
export const EXPEDITION_CARRY_UNITS_PER_WORKER = 0.12;          // expedition.ts:137

export function deriveCarryCapacityUnits(band, partyWorkers, injuryLoad, currentTick) {
  const carryingRelief = deriveCarryingRelief(band, currentTick);
  const reliefFactor = 1 + Math.max(0, Math.min(0.24, carryingRelief.relief ?? 0));
  const injuryFactor = Math.max(0.35, 1 - injuryLoad);
  return round4(partyWorkers * EXPEDITION_CARRY_UNITS_PER_WORKER * reliefFactor * injuryFactor);
}                                                                // expedition.ts:195-205
```

With no learned practice the relief is `0`, the factor is exactly `1`, and the party carries
`workers x 0.12` — hands and arms.

### 2.2 Nothing grants the multiplier automatically

`deriveCarryingRelief` (`practicalResponses.ts:965-971`) resolves through `reliefFromResponse`
(`:908-949`), which returns relief `0` in four distinct cases:

| Case | Reason string | Rule clause satisfied |
| --- | --- | --- |
| no `carrying_load` response exists | "no matching practical response" | not automatic |
| `status === "abandoned"` | "response abandoned after repeated failure" | testing can fail |
| `status === "dormant"` | "response dormant — its condition has not recurred" | **maintenance / recurrence** |
| basis below `spec.basisFloor` | "material/technique basis faded — practice cannot operate" | **suitable materials** |

### 2.3 The variants require real material knowledge

`VARIANT_SPECS` (`practicalResponses.ts:255-278`, `:331-349`):

| Variant | `requiredSubjects` | Relief cap |
| --- | --- | --- |
| `fiber_sling` | `fiber_cordage` | `CARRYING_RELIEF_CAP_SIMPLE` 0.3 |
| `load_staging` | — (technique, not object) | 0.3 |
| `carrying_frame` | `fiber_cordage`, `load_binding` | `CARRYING_RELIEF_CAP_COMPOSITE` 0.4 |
| water vessels | `container_holding`, `fiber_cordage` / `seal_coating` | per-spec |

These are material/technique fragments the band must actually hold, not flags.

### 2.4 Experiment precedes benefit, and success is earned

```ts
const relief = response.status === "forming"
  ? round2(spec.reliefCap * 0.25)                                       // probe-level
  : round2(Math.min(spec.reliefCap, spec.reliefCap * (0.35 + 0.65 * response.confidence)));
```

A `forming` response gets a quarter of the cap — the first real attempts. An `active` response
scales with earned confidence and never reaches the full constraint. Each variant carries a
`procedure` describing the physical test (e.g. *"weave a tight carrier, press in a wet lining, fill
it, and watch the seams through a short carry"*).

### 2.5 Improved carrying also lengthens the journey

Practiced carrying raises travel pace, not just the ceiling (`expedition.ts:247-253`):

```ts
const reliefFactor = 1
  + Math.max(0, Math.min(0.2, carryingRelief.relief ?? 0))
  + Math.max(0, Math.min(0.1, waterRelief.relief ?? 0));
```

### 2.6 Rule-to-implementation map

| Rule clause | Implemented | Where |
| --- | --- | --- |
| minimal bodily capacity by default | yes | `EXPEDITION_CARRY_UNITS_PER_WORKER = 0.12` |
| aids are not automatic | yes | four zero-relief cases |
| recognizing transport limits returns | yes | `carrying_load` condition source |
| access to suitable materials | yes | `requiredSubjects`, `basisFloor` |
| experimentation | yes | `forming` = cap x 0.25, `procedure` |
| craft knowledge | yes | material/technique fragments |
| real labor to produce | partial | fragments accrue through lived practice |
| testing successfully | yes | confidence-scaled relief |
| maintaining or replacing | yes | `dormant` and basis-fade both zero the relief |
| transmitting to later parties | yes | `inheritPracticalAdaptationForDaughter` |
| -> more cargo returned | yes | `deriveCarryCapacityUnits` relief factor |
| -> longer/more productive trips | partial | pace only — see the gap |
| -> **more provisions carried outward** | **NO** | **the gap** |

---

## 3. The gap — provisions carry no carrying term

```ts
function provisionsExhausted(expedition) {
  const budget = round4(
    expedition.partyWorkers * EXPEDITION_PROVISION_UNITS_PER_WORKER_DAY * EXPEDITION_MAX_DURATION_DAYS,
  );
  return expedition.cargo.provisionUnitsConsumed > budget;
}                                                                // expedition.ts:374-378
```

`EXPEDITION_PROVISION_UNITS_PER_WORKER_DAY = 0.0008` and `EXPEDITION_MAX_DURATION_DAYS = 24` are
both constants. A band that has learned the carrying frame therefore brings **more home** and
**walks faster**, but cannot **carry more food out**, and its viable trip length is bounded by a
constant rather than by its own carrying capability. The rule's middle arrow — *more provisions
carried outward* — has no representation.

One half of the rule *is* honest here: provisions are drawn against the same physical budget as
cargo, not from a phantom store. `buildReturnedRecord` subtracts what was eaten from what was
carried (`expedition.ts:395-396`), and the header at `:139-149` states plainly that this is
"trip-local provisioning; never a store".

### Why it is not fixed here

Coupling provisions to carrying capability is a transport-technology change. §4 of CORRECTION-34A
excludes `transport technology` and `food storage`; §13 requires provisions be preserved "unless
deliberately repaired"; and §10 records transport technologies as a deferred debt. Making the
change would alter viable expedition range and duration and needs its own before/after evidence —
it is not a physical-presence repair.

### The shape of the future repair

1. Derive an outbound provisioning ceiling from `deriveCarryCapacityUnits` rather than from
   `EXPEDITION_MAX_DURATION_DAYS`, so what a party can take out is bounded by what it can carry.
2. Let viable duration follow from that ceiling instead of from a constant.
3. Keep provisions drawn against the carried budget, so eating still competes with bringing home.
4. Prove the loop the rule describes: a band that has *not* learned a carrying practice must show
   shorter viable range than one that has, on the same ground.

**Owning checkpoint:** the future material / craft / transport-technology pass. Recorded in
`docs/HANDOFF.md` so it is not lost.
