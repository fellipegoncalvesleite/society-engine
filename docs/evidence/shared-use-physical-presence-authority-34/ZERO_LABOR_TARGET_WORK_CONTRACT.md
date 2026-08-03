# CORRECTION-34F — ZERO-LABOUR TARGET-WORK CONTRACT CLOSURE

**Branch** `checkpoint/shared-use-physical-presence-authority-34`, continuing `e7d8de4`
(CORRECTION-34E tip). **Production behaviour changed — one file, one validation.**

This is a narrow contract closure. Nothing about target-work yield, expedition labour, same-day
activity, party composition, demography, fission or resource ecology was redesigned.

---

## 1. CORRECTION-34E's central repair stands

Supervising review accepted it and this pass reopens none of it. Re-verified here, unchanged:
expedition target work reads the productive labour physically present in that party; residential
workers no longer determine distant work; party labour propagates through record, request,
depletion, pressure, cargo and return; non-working members grant no target work; the same-day path
keeps its residential authority. T1–T14 rerun **14/14, 0 failing, 0 vacuous**, the after-arm proof
is **byte-identical**, and the cross-tree same-day digest is the **same sha256**
(`ac71f4f4…3911`, 2,034 records, 729 days).

## 2. The hole 34E left

34E made `options.partyWorkers` **required** and removed the residential fallback. It did not
constrain the **value**:

```ts
if (typeof w !== "number" || !Number.isFinite(w) || w < 0) throw …   // zero passes
…
productiveWorkers: Math.max(0, Math.round(w))                        // 0.4 -> 0, 1.6 -> 2
```

The builder's own comment asserted "a party of zero workers works none". Downstream, that was
false:

- the physically-present outcome test is `estimatedPeopleCount >= 2 ? "partial_success" : "target_found"`, so **zero workers are classified `target_found`**;
- `baseReturnValue = estimatedPeopleCount * 0.035 + yieldConfidence * 0.22 + presenceConfidence * 0.08` — **the confidence terms survive a zero labour term**;
- `resolvePhysicalFoodHarvest` takes that as `requestedAmount` and **removes stock**.

## 3. Reproduced on real production before any change (`zero-labor-target-work-before.json`)

Real world, real band, real harvestable patch, the real exported resolver, stock read by the
resolver's own `sourceId`:

| case | accepted | people | outcome | depletion | stock changed |
| --- | --- | --- | --- | --- | --- |
| **Z1 zero workers, exploitation** | **yes** | **0** | `target_found` | **0.0047** | **yes** |
| **Z2 zero workers, verification** | **yes** | 0 | — | 0 | no — but it **read the target** |
| **Z3a 0.4 workers** | **yes** | **0** (rounded) | `target_found` | 0.0047 | **yes** |
| **Z3b 1.6 workers** | **yes** | **2** (rounded) | `partial_success` | 0.0226 | yes |
| Z4 NaN / +∞ / −∞ / −1 | no | — | — | 0 | no |

Headline: **`ZERO LABOR REMOVES PHYSICAL STOCK`**, and
**`FRACTIONAL PEOPLE SILENTLY ROUNDED (0.4 -> 0, 1.6 -> 2)`**.

A party with nobody in it took food out of the world, and a person and a half became two people.
Committed as its own before-arm commit (`7d4dda3`) prior to any production edit.

## 4. The contract selected — Option A, strict positive integer

```ts
if (typeof w !== "number" || !Number.isInteger(w) || w < 1) throw …
…
productiveWorkers,        // passed through unaltered — the Math.round was the laundering step
```

and in `buildTripRecord`, `estimatedPeopleCount = partyWork.productiveWorkers` with no
`Math.max`/`Math.round`.

| Option | Verdict |
| --- | --- |
| **A — reject anything that is not a positive integer** | **SELECTED.** Smallest truthful design: an impossible exported call fails loudly at the boundary, and no clamp is left that could disguise a caller's mistake. |
| B — build a canonical "zero-work" record | REJECTED. It adds an outcome and a state to describe something no party can be, and it converts a broken caller into a silent no-op — the opposite of what §3 found. |
| C — caller-side phase/minimum validation only | REJECTED as the *primary* mechanism, because it leaves the exported authority untruthful for any future caller. Its substance is kept as **evidence**: §5 proves the canonical callers already cannot produce an invalid value, and the resolver rejects defensively on top. |
| D — clamp to 1 | REJECTED. Silently inventing a worker is the same class of error as silently rounding one. |

### The lower bound is ONE, not `EXPEDITION_MIN_PARTY_WORKERS`, and that is deliberate

One person can physically do a day's work. The two-worker minimum is an **expedition policy** about
what is worth sending and what turns for home — not a statement about physical possibility. It
lives in `expedition.ts`, enforced twice: the launch gate (`partyWorkers < 2 → return band`, with
`deriveDepartableWorkers` returning an integer, and the verification/reconnaissance/exploration
families hardcoding 2) and `reconcileExpeditionLabor` (a party reduced below the minimum becomes
`returning` or `aborted` before it can operate).

Putting that policy in the resolver would also **close a dependency cycle**: `expedition.ts` imports
`intraSeasonTrips.ts` and never the reverse, so reaching for the constant would invert the one-way
direction the module header protects. §5 of the prompt forbids exactly that, and it is the right
call for its own reasons.

**Consequence, stated plainly:** the resolver alone would accept a one-worker party. Canonical
production never hands it one, and Z11/Z12 measure that. A future caller that legitimately wants a
solo worker gets one; a future caller that wants a party gets the expedition module's minimum.

## 5. Canonical production call-order proof (`Z0`, measured, not asserted)

Each step is a real production predicate, and the reconciler branches are driven on constructed
states rather than described:

```text
expeditionDailyAction, per band, in this order:
  1. reconcileExpeditionCommitment          <- FIRST, before anything reads or extends a commitment
  2. maybeLaunchExpedition
  3. advanceExpeditionOneDay, per expedition
```

| Production predicate | Measured |
| --- | --- |
| an OPERATING party its band can no longer staff leaves the operating phase | phase `operating` → **`returning`**, labour 6 → **3**, **bodies kept at 6** |
| a PREPARED party in the same position is cancelled, never departed | phase → **`aborted`** |
| a healthy operating party is untouched | phase `operating`, labour **5** |
| the launch gate | refuses below **2**; `deriveDepartableWorkers` is integer-valued |
| target work is reachable only from `phase === "operating"` | the verification branch and the exploitation branch both sit under it |

Every write to `partyWorkers` anywhere in `src/sim`, enumerated:

- `createPreparedExpedition(partyWorkers: chosen.workers)` — integer ≥ 2;
- frontier verification / frontier exploration launches — hardcoded 2;
- `applyReducedProductiveLabor(partyWorkers: reducedWorkers)` — integer, because `workingAdults` is `Math.round`ed, and below the minimum the record is moved out of `operating` in the same step;
- `reconcileExpeditionLabor` / `repairInvalidPhysicalCommitment` set 0 **only together with a terminal phase**.

So no canonical caller needed repairing. The contract is a guard against a *future* caller and
against a state a test or a migration could assemble — which is precisely the class of hole
CORRECTION-34A found in the launch authority and CORRECTION-34C found in the reconciler.

## 6. After (`zero-labor-target-work-after.json`, fixtures `Z1–Z12`)

**14 → 8 of 12 probe cases now rejected; the four valid ones are unchanged.**

| | before | after |
| --- | --- | --- |
| zero, exploitation | accepted, `target_found`, **0.0047 removed** | **rejected, nothing removed** |
| zero, verification | accepted, **read the target** | **rejected, read nothing** |
| 0.4 workers | rounded to 0, **0.0047 removed** | **rejected** |
| 1.6 workers | rounded to 2 | **rejected** |
| NaN / ±∞ / −1 | rejected | rejected |
| 1 worker | 1 person, 0.0086 removed | **1 person, 0.0086 removed (unchanged)** |
| 2 workers | 2 | **2 (unchanged)** |
| 5 workers | 5 | **5 (unchanged)** |
| 5 workers, verify-only | reads, removes nothing | **unchanged** |

Headlines flip to **`ZERO LABOR REJECTED BEFORE WORK`**,
**`ZERO LABOR CANNOT INSPECT THE TARGET`**, **`FRACTIONAL PEOPLE REJECTED`**, and
`casesRemovingStockWithoutAValidPositiveIntegerParty` goes **3 → 0**.

### Fixtures Z0–Z12: 13/13, 0 failing, 0 vacuous

Non-vacuity is **asserted** per fixture and the harness fails the run on any vacuous one. The
predicate that carries most of the suite: **the same target, with a valid five-worker party, removes
real stock** — so every "nothing was removed" verdict is a refusal and not an empty patch. Z2 carries
the mirror control: a *valid* party verifying the same target **does** read it and removes nothing,
so the zero-labour refusal is not a target that cannot be read.

## 7. Natural call domain (`natural-target-work-contract-20y/50y.json`)

Daily sampling, map2, seed `audit27:natural:map2:s1`. Every expedition in `phase === "operating"` is
recorded with the exact value the call site would pass (`getExpeditionProductiveWorkers`;
provisioning does not touch `partyWorkers`).

| | 20 y | 50 y |
| --- | --- | --- |
| band-days | 64,800 | 162,000 |
| operating party-days reaching target work | **94** | **225** |
| zero-labour calls | **0** | **0** |
| fractional-labour calls | **0** | **0** |
| non-finite-labour calls | **0** | **0** |
| below `EXPEDITION_MIN_PARTY_WORKERS` calls | **0** | **0** |
| valid calls | **94** | **225** |
| observed labour range | **2 .. 7** | **2 .. 7** |

**The strongest statement here is structural, not statistical.** After CORRECTION-34F an invalid
labour count *throws*. These runs completed, so canonical production made **no** zero, fractional or
non-finite target-work call anywhere in 20 or 50 simulated years. The counts say how much work that
proof covers; the throw is what makes it a proof.

Observed labour never falls below 2, which independently confirms §5: the resolver's bound of 1 is
never the thing standing between production and an invalid call.

## 8. Everything else is inert

Rerun on this tree and compared against the CORRECTION-34E tree, **byte-identical modulo
`generatedAt`** in every case:

- 34E T1–T14, caller matrix, numeric chain, after-arm proof — **identical files**;
- 34E natural target-work 20 y and 50 y — **byte-identical**;
- same-day preservation digest — **same sha256 as both trees in 34E**;
- 34 presence fixtures (20 y), 34A closure, person conservation, R1–R12, L1–L12, H1–H14, numeric resource chain, four-way — **identical**;
- AUDIT-27, CORRECTION-28, -29, -30, -31, -32, -32A (both), -33 — **identical**, including every second output (`--timeline-out`, `--timelines`, `--parity-out`, `--chain-out`, `--cascade-out`, and CORRECTION-33's six).

That is the expected shape of a contract closure: it changes what happens to calls that cannot occur,
and nothing else.

## 9. What is claimed, and what is not

**Claimed.** The exported target-work authority now requires a positive integer count of productive
people. Zero, fractional and non-finite labour cannot produce an observation, a physical request,
stock removal, cargo or support. Valid parties are unchanged. The same-day path never enters this
contract. Canonical production is proven — by call-order inspection, by driving the reconciler, and
by two long runs that would have thrown — never to make an invalid call.

**Not claimed.**

- **That one worker is a sensible expedition.** The resolver permits it because one person can
  physically work; whether a party of one should ever be *sent* is expedition policy, unchanged here
  and measured to never occur (labour range 2..7).
- **That this fixed a bug ordinary play was hitting.** Natural occurrence of the defect is **zero**
  at both horizons. This closes an **exported contract**, not an observed misbehaviour, and the
  before-arm evidence is the proof that the hole was real.
- **Anything about the harvest equation.** `* 0.035` and the confidence terms are untouched.
- **Any outcome improvement, or any performance conclusion.** No timing arm; behaviour for valid
  parties is identical.
- **No 200-year matrix** was run.

## 10. Scope

Roadmap Item 3 stays active. **Roadmap Item 4 remains unstarted** — nothing here cancels, staffs or
selects a party, and no minimum-party policy was modified. The CORRECTION-34A same-day
current-presence deferral is preserved exactly.
