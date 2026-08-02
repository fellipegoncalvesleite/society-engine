# CORRECTION-33 — ARCHITECTURE DECISION

**Selected: Option A — remove `unrelatedRisk`, and remove the `world` parameter with it.**

---

## 1. What was removed

```ts
const unrelatedRisk =
  Object.values(world.bands).length > 8 && knownContactCount === 0 ? 0.08 : 0;

return clamp01(0.28 + rememberedAccessCaution * 0.26 + unrelatedRisk - knownContactRelief);
```

becomes

```ts
return clamp01(0.28 + rememberedAccessCaution * 0.26 - knownContactRelief);
```

and the signature drops `world` entirely:

```ts
function getSocialAccessRisk(band: Band, tileId: TileId): number
```

Both call sites (`buildWaterRefugeProfile`, `buildKnownProspectCandidate`) were updated. Nothing
else changed: the base `0.28`, the access-memory coefficient `0.26` and the known-contact relief
`0.08` are **untouched**, and no other formula in `dryMargin.ts` was inspected-and-adjusted to
compensate for the removal.

## 2. Why dropping the parameter matters

`getSocialAccessRisk` was the **only** reader of `world.bands` in `dryMargin.ts` — every other use
of `world` in the module is `world.time`. Removing the parameter therefore converts the invariant
"this function must not read global state" from something a test asserts into something the type
signature enforces. Fixture **P17** measures the runtime behaviour; the signature is the structural
guarantee behind it.

## 3. The alternatives, and why each was rejected

| Option | Decision | Reason |
| --- | --- | --- |
| **A — remove `unrelatedRisk`** | **SELECTED** | Generic uncertainty about an unverified place is exactly what the base `0.28` already is. Nothing legitimate is lost, because nothing legitimate was being expressed. |
| **B — derive generalized social uncertainty from band-known evidence** (distinct encountered groups, active reports, contact diversity) | REJECTED for this checkpoint | This is **regional social awareness** — a real mechanism, and explicitly out of scope in §6. Doing it properly needs named groups, travel, exchange and inherited information; doing it improperly means picking whichever band-known scalar happens to reproduce `0.08`, which is the same defect with better manners. §9 warns against prematurely creating this system and the warning is correct. |
| **C — derive it from active reports** | REJECTED | No current report topic asserts "unfamiliar groups are numerous in this region". The only honest way to build it would be to invent a topic **specifically to preserve the coefficient**, which §9 forbids in as many words. The report → access-evidence path that *does* exist is untouched and still works. |
| **D — derive it from local unidentified evidence** (tracks, camps, smoke, unexplained depletion) | REJECTED | CORRECTION-30 established by inspection that production has **no physical-trace authority of any kind**. §9 says reject unless a canonical authority already exists. It does not. Fabricating traces is forbidden. |
| **E — retain a generic constant independent of world size** | REJECTED | The base `0.28` already performs precisely this role. A second world-size-independent baseline would be an unexplained constant sitting beside an explained one, and §6 forbids adding it. |
| **F — another minimal design** | Considered, none better | The only remaining candidates either re-introduce a global proxy (forbidden by §10.11) or amount to B/C/D under another name. |

## 4. The belief this leaves in the model

- **How it arises:** the band stands somewhere it has not verified, or acquires its own evidence
  about that place through physical proximity to another band.
- **What sustains it:** active evidence inside the CORRECTION-31 lifecycle window.
- **What weakens it:** age, contradiction (standing at the place and finding nobody), and known
  contacts.
- **What evidence it requires:** a record the band itself holds, with provenance (CORRECTION-30)
  and a lifecycle (CORRECTION-31).
- **How it relates to place-specific access memory:** it *is* place-specific access memory, plus a
  flat baseline.
- **Why it cannot reveal hidden groups:** every input is band-local. The function cannot see the
  world.

## 5. Behavioural consequence, stated plainly

Removing the term **lowers** `socialAccessRisk` by exactly `0.08` for any band with zero known
contacts in a world holding more than eight band records. In the default map2 world that condition
is not rare — the record count is a **constant 9** across 80 seasons — so the term was permanently
armed for uninformed bands rather than firing at an occasional edge case.

That is a real behaviour change and it is not claimed to be an improvement. It is claimed to be
**truthful**: bands stop reacting to a number they cannot perceive.

## 6. What was inspected and deliberately not changed

- the base `0.28` — its meaning and calibration are recorded as an adjacent finding, not adjusted;
- the access-memory coefficient `0.26`;
- known-contact relief `0.08` per contact and its `clamp01` saturation;
- `getFallbackRank`'s `socialAccessRisk * 1.8`;
- the water-source comparator's `* 0.18`, the seasonal-mode `* 0.14`, the prospect `* 0.16`/`* 0.08`;
- `scoreDecision`'s `socialAccessRisk * 0.36` and `getBadSiteStuckResidencePenalty`'s `* 0.08`;
- `Object.keys(band.contactMemories).length + band.knowledge.knownBands.length`, which can plausibly
  count one known band twice — recorded as an adjacent finding, not repaired, because CORRECTION-33
  does not depend on it.
