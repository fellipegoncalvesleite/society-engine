# CORRECTION-23J — TEMPORARY-USE PENDING-ACTION AUTHORITY / EXACT LAUNCH-TO-CAMP CONSUMPTION

Branch `checkpoint/physical-frontier-verification-23`, from `0955c87`.
Local `main` untouched at `668763f`; remote `main` untouched at `0a43083`.

---

## 1. What this pass repaired

CORRECTION-23I gated the `temporary_use` verification question on:

```text
a resource patch is remembered here
OR
some party is away toward this tile (prepared / outbound / operating / returning)
```

Neither disjunct proves a concrete camp-requiring operation is pending. A remembered patch is
memory, not intent. A `returning` party has already taken the camp decision an answer was
supposed to inform. The gate now names one operation the production activity selector actually
chose, and requires that operation's camp decision to still be reachable in time.

---

## 2. §7 — the ordering model is C, and it is measured

| Model | Verdict | Evidence |
| --- | --- | --- |
| A — operation reserved, then investigated | **absent** | `maybeLaunchExpedition` picks a candidate and calls `createPreparedExpedition`/`attachExpedition` in the same call. No selected-and-waiting state exists. **4,186,352** candidate evaluations refused for `no_selected_operation` against **27** that found a genuinely pending operation. |
| B — selector blocked by temporary-use evidence, re-evaluating | **absent** | `taskCampRefusedByEvidence` has exactly one production reader, `deriveTaskCampForOperating` (`expedition.ts:319`), and it runs on ARRIVAL. Candidate selection never consults it. |
| C — no valid pre-operation seam | **holds** | Of the 27 evaluations that reached a pending operation, **25** failed the physical-return test and 2 named an operation needing no camp. Zero passed. |

The arithmetic behind C, from fixture J4/J8 on a real warmed band and a real route: the operation
decides its camp **3 days** after it leaves; the verification party needs **8 days** out and back.
A camp is only decided when the outbound leg is at least a day, so the decision always falls
`legDays` after departure while the answer needs `2 · legDays + VERIFICATION_ON_SITE_DAYS`. The
second exceeds the first for every leg length there is.

---

## 3. §10 — A through H, measured separately

Eleven worlds × five shared seeds × 40 years, seed prefix `c23i:camps`. The before arm is
`0955c87`'s gate; the after arm differs **only** in the temporary-use block.

| | Quantity | Before (23I gate) | After (23J gate) |
| --- | --- | --- | --- |
| A | camp decisions blocked by any stored negative | 343 | 0 |
| B | distinct negative records that ever block a camp | 63 | 0 |
| C | temporary-use verification launches | 1,145 | **0** |
| D | launches tied to a selected operation | **0** | 0 |
| E | launches whose answer returned in time | 0 | 0 |
| F | launches whose named operation consumed the answer | **0** | 0 |
| G | launches useful only to unrelated operations | 0 | 0 |
| H | launches never consumed | 1,145 | 0 |
| | attempted camps | 3,672 | 2,429 |

**D = 0 is the finding.** Not one of 1,145 launches under the 23I gate had a selected operation
at the same tile whose camp decision was still ahead of it. A, therefore, cannot be read as
evidence for the launch: the 343 blocked camps were blocked by evidence that arrived through some
earlier, unrelated journey.

Only **378 of 1,145** launches (33%) were even at a place any work operation ever reached across
the whole 40 years. The other two-thirds were sent to country no work party ever visited.

A is reported split by who was refused: **343 for real work operations, 0 for verification
parties themselves**, so the 23I total is not inflated by the question governing its own parties.

---

## 4. §10 — the 18.09% versus 10.6% discrepancy, corrected

Both figures are wrong for the code they shipped with, and they disagree by more than arithmetic
because they describe different worlds.

* `docs/evidence/correction23i/temporary-use-camp-prevention.json` records
  **10,724 / 59,286 = 18.09%**.
* The source comment in `frontierVerification.ts` said **492 / 4,626 = 10.6%**.
* Running 23I's own audit script, **unmodified**, on the commit that evidence file shipped in
  (`0955c87`) gives **343 / 3,672 = 9.34%**. A second seed prefix on the same commit gives
  **363 / 3,816 = 9.51%** — a 4% spread, so neither published figure is inside seed jitter.

The 23I evidence file therefore describes an intermediate dirty-tree state, not committed
behaviour, under a filename that implies otherwise. It could not have come from `dc08b2d` either
— the diagnostics module it depends on did not exist there.

**The 10.6% figure is removed from the source.** The 23I evidence file is preserved unaltered per
§14 and corrected here and in the change log. The shipped-code figure is **9.34%**, and by §3.3
it is not grounds for retention in any case.

---

## 5. §5 — the operation identity

`src/sim/agents/pendingOperation.ts`. Every field comes from the expedition record the production
selector wrote; nothing is reconstructed from patch memory, richness, hidden stock, a hypothetical
task, or candidate-list membership. The module takes a band, never the world.

```text
operationId              expedition.id
bandId                   expedition.bandId
activityKind             expedition.taskKind
targetTileId             expedition.targetTileId
selectedDay              expedition.departedDay
expectedLaunchDay        expedition.departedDay   (identical — see below)
expectedOperatingDay     departedDay + outbound leg days, by the reader's own arithmetic
requiresMultiDayOperation
requiresTaskCampDecision
partyOrTaskIdentity      `${id}:${workers}w`
authoritativeSelector    "expedition.maybeLaunchExpedition"
phase
```

`selectedDay === expectedLaunchDay` is a finding, not a shortcut: it is precisely why Model A does
not exist.

Excluded from operation identity: `frontier_exploration` (no destination — its `targetTileId` is
an anchor it walks past) and `frontier_verification` (letting one verification party justify
another would make the gate self-referential).

Admitted phases: `prepared` and `outbound` only. `operating` is already too late — the camp is
decided on the step that puts a party there.

---

## 6. §6 — the eight conditions, and which one binds

| Refusal reason | Count (40 y, 11 worlds × 5 seeds) |
| --- | --- |
| `no_selected_operation` | 4,186,352 |
| `answer_cannot_return_before_camp_decision` | 25 |
| `operation_needs_no_camp_decision` | 2 |
| **launches admitted** | **0** |

---

## 7. §9 — J1..J12

11 passed, 1 vacuous, 0 failed.

| | Intent | Status |
| --- | --- | --- |
| J1 | a remembered multi-day patch with no selected operation does not launch | PASS |
| J2 | admission to a candidate list is not selection | PASS |
| J3 | a selected same-day operation does not launch | PASS |
| J4 | a real selected multi-day operation produces a complete typed identity | PASS |
| J5 | an operation at tile A does not justify verification at tile B | PASS |
| J6 | returning, terminal and already-arrived parties can never be pending | PASS |
| J7 | a negative that reaches the reader changes the exact operation's camp outcome | PASS |
| J8 | an answer that cannot arrive in time is not credited with informing the decision | PASS |
| J9 | a lost verification party transfers no answer and no disposition | PASS |
| J10 | a confirmation grants nothing beyond the camp | PASS |
| J11 | with no exact consumption seam, production launches are zero | PASS |
| J12 | every natural launch names one operation and consumes it in time | **VACUOUS** |

J12 is recorded as vacuous, not as a pass. Its assertions hold over an empty set because there
are no natural launches; it states the contract, it does not demonstrate the behaviour exists.
Counting it would be exactly the vacuous pass `AUDIT_ADMISSIBILITY.md` forbids.

J2 was rewritten after a first version passed on an empty candidate list — it now installs a live
water candidate at the same place so "admitted but not selected" is a real distinction.

I6 was rewritten per §14: it used to strip the patch memory and the party list and assert nothing
was asked, which tested the weak assumption itself. It now asserts that a band holding **both** a
remembered patch and a returning party at the target still does not ask.

I5's caveat, which cited the stale 18.09%, is corrected in place.

---

## 8. §11/§12 — the natural matrix

Eleven worlds × five shared seeds, 40 and 200 years, seed prefix `c23j:acc`. Both arms measured
on this pass; the 23I acceptance files were not reused, because §4 above shows 23I's evidence
cannot be assumed to describe `0955c87`.

### Launches by question, 40 years

| Question | Before | After |
| --- | --- | --- |
| `water_access` | 103 | 109 |
| `resource_presence` | 0 | 0 |
| `resource_test_possible` | 0 | 0 |
| `temporary_use` | 1,142 | **0** |
| `seasonal_persistence` | 0 | 0 |

Water is +6. The water gate's code is untouched; the difference is downstream world divergence —
with 1,142 fewer parties raised, bands know slightly different country and their destination
authority reaches slightly different verdicts. It is not a change in water launch policy.

### 40 years, per world

| world | population | exploration parties | total parties | unique tiles | support |
| --- | --- | --- | --- | --- | --- |
| map1 | 161.4 → 162.4 | 62.2 → 60.6 | 226.6 → 188.6 | 437.8 → 457.4 | 1.08 → 1.07 |
| map2 | 214.0 → 218.8 | 108.0 → 109.2 | 356.2 → 258.8 | 838.6 → 757.6 | 0.72 → 0.75 |
| site_A_coast | 20.0 → 20.0 | 13 → 13 | 49.0 → 48.2 | 67.2 → 137.8 | 0.01 → 0.05 |
| site_B_dry_plains | 21.0 → 20.4 | 5.0 → 3.0 | 10.4 → 3.8 | 45.2 → 32.8 | 0.26 → 0.24 |
| site_C_dry_plains | 30.0 → 28.8 | 13 → 13 | 79.6 → 47.2 | 84.6 → 67.8 | 0.62 → 0.58 |
| site_D_aquatic | 23.8 → 24.8 | 6.2 → 8.8 | 39.2 → 43.4 | 23.8 → 30.4 | 0.47 → 0.51 |
| site_E_hills | 27.0 → 27.6 | 13 → 13 | 58.2 → 39.2 | 85.4 → 117.4 | 0.45 → 0.46 |
| site_F_hills | 30.4 → 29.4 | 13 → 13 | 49.2 → 36.6 | 132.8 → 141.0 | 0.63 → 0.62 |
| ordinary | 19.4 → 20.4 | 11.8 → 12.4 | 52.4 → 48.4 | 83.6 → 88.0 | 0.22 → 0.26 |
| isolated_marginal | 21.0 → 21.0 | 13 → 13 | 45.4 → 33.2 | 286.2 → 236.2 | 0.26 → 0.26 |
| hostile | 21.2 → 20.4 | 13 → 13 | 43.8 → 42.4 | 194.0 → 204.8 | 0.28 → 0.27 |

Exploration is materially unchanged — most worlds are identical at 13 parties, and the two that
move (site_B −2, site_D +2.6) move in opposite directions. No exploration eligibility rule,
target rule or cadence was touched.

### Launches by question, 200 years

| Question | Before | After |
| --- | --- | --- |
| `water_access` | 165 | 188 |
| `resource_presence` | 0 | 0 |
| `resource_test_possible` | 0 | 0 |
| `temporary_use` | 1,801 | **0** |
| `seasonal_persistence` | 0 | 0 |

### 200 years, per world

| world | survival | population | exploration | total parties | unique tiles | receipts |
| --- | --- | --- | --- | --- | --- | --- |
| map1 | 1.00 → 1.00 | 210.4 → 204.2 | 366.8 → 357.2 | 1766.0 → 1570.6 | 1008.2 → 957.4 | 1563.8 → 1523.2 |
| map2 | 1.00 → 1.00 | 202.8 → 207.4 | 528.2 → 517.2 | 1507.6 → 1317.6 | 1302.4 → 1198.0 | 1466.6 → 1483.6 |
| site_A_coast | 0.00 → **0.20** | 0.0 → **2.8** | 27.4 → 34.2 | 83.6 → 110.4 | 100.0 → 218.8 | 13.8 → 38.9 |
| site_B_dry_plains | 0.80 → 0.80 | 10.4 → 10.0 | 36.4 → 32.2 | 100.4 → 81.0 | 102.4 → 125.6 | 71.6 → 69.3 |
| site_C_dry_plains | 1.00 → 1.00 | 23.4 → 23.6 | 62.0 → 62.0 | 307.4 → 221.4 | 126.4 → 139.2 | 146.2 → 144.5 |
| site_D_aquatic | 1.00 → 1.00 | 10.4 → 11.4 | 19.8 → 16.6 | 232.8 → 129.4 | 46.2 → 63.8 | 78.5 → 84.5 |
| site_E_hills | 1.00 → 1.00 | 18.0 → 18.0 | 62.0 → 62.0 | 173.8 → 141.8 | 192.6 → 244.4 | 129.6 → 127.1 |
| site_F_hills | 1.00 → 1.00 | 32.4 → 31.6 | 62.0 → 62.0 | 117.8 → 111.8 | 158.8 → 164.4 | 183.7 → 178.5 |
| ordinary | 0.00 → 0.00 | 0.0 → 0.0 | 39.6 → 35.2 | 207.2 → 165.4 | 125.0 → 108.0 | 30.3 → 27.2 |
| isolated_marginal | 0.80 → **1.00** | 15.4 → **19.4** | 54.0 → 61.2 | 271.8 → 319.2 | 499.8 → 384.8 | 95.3 → 112.7 |
| hostile | 0.40 → 0.40 | 3.8 → 3.6 | 48.2 → 47.2 | 186.0 → 151.8 | 431.8 → 411.2 | 44.6 → 40.7 |

**No tier loses survival.** Two gain: site_A_coast 0.00 → 0.20 and isolated_marginal 0.80 → 1.00.
Populations are flat to slightly up; the largest fall is map1 at −3%.

**`ordinary` is extinct at 200 years in BOTH arms.** That is the CORRECTION-23I
ordinary-exploration deficit, present before this pass and unchanged by it — not a 23J
regression. §12 requires it recorded and not repaired, and it is.

Camps prevented by evidence go to zero everywhere (278/168/148/741/134/16/99/187 → 0), which is
the arithmetic consequence of no temporary-use party ever being raised: with no launches there is
no evidence, so nothing is prevented. Camps ATTEMPTED remain substantial (5,432 on map1, 3,431 on
map2), so the reader is still reached — it simply has nothing to read.

### §12 — the recorded, unrepaired boundary

The CORRECTION-23I finding stands and is not repaired here:

```text
removing inert verification
→ less known-country breadth
→ lower receipts and survival in some thin habitats
```

CORRECTION-23J does **not**: restore any suspended question's launches; add generic exploration;
add seasonal patrols; alter exploration eligibility, target selection or cadence. The
ordinary-exploration deficit remains the next blocker.

---

## 9. §13 — production outcome

**Outcome B — temporary use suspended until a real operation reader exists.**

Not because the evidence is useless, and not by adding the question to `SUSPENDED_QUESTIONS`. The
reader is real and a held negative genuinely refuses a camp. The suspension is a physical
consequence of the §6 gate: nothing can satisfy condition 7 in this architecture, so the gate
admits nothing. Written that way rather than as a policy name, the question becomes askable by
itself the moment a pre-operation seam exists, with no rule to revisit.

The type, the physical resolver, the evidence shape and the reader are all retained and dormant,
documented at the gate. The reservation seam belongs to Resource Investigation / Temporary Use
Closure and is deliberately not built here.
