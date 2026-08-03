# Roadmap Item 3 — final freeze manifest

**Status: FINAL FREEZE CANDIDATE — awaiting Browser GPT acceptance.**
This executor does not declare Item 3 accepted or frozen.

---

## Exact state

| | |
|---|---|
| repository | `fellipegoncalvesleite/human-nomad-simulator` |
| branch | `checkpoint/shared-range-item-3-final-freeze-36` |
| candidate freeze HEAD | `706166892d40189fc56ac7458b9e90a8ffdbddd7` at audit start |
| accepted production tip | `706166892d40189fc56ac7458b9e90a8ffdbddd7` (CORRECTION-35) |
| previous final-integration audit | `742b567f9351ca3ef9eaafef05a620dbd2ff1db4` |
| frozen CORRECTION-34 | `df349eb60940d3ee3995fa6bccac7c902578fd3e` |
| main | `0a43083a3a9103bc6b8f693b8823a604ae2c6a8d` |
| merge base with main | `0a43083a3a9103bc6b8f693b8823a604ae2c6a8d` |

**main is untouched** — it is the merge base, so nothing in the Item 3 line has been merged into it.

**This checkpoint changes no production file.** `git diff 7061668..HEAD -- src/` is empty.

---

## Accepted sub-checkpoints — every one an ancestor of the freeze head

| Checkpoint | Branch | SHA |
|---|---|---|
| AUDIT-27 (diagnostic) | `checkpoint/crowding-shared-range-authority-27` | `b352c3195406fc9494c0b693a98eb0786f1a3780` |
| CORRECTION-28 | `checkpoint/crowding-physical-memory-separation-28` | `c5eb58a8f5ff7054665f9c376ac4ca856403efab` |
| CORRECTION-29 | `checkpoint/shared-range-encounter-provenance-29` | `a15d0a78a3a7ef57b87b22226190d6729ba9b9d7` |
| CORRECTION-30 | `checkpoint/shared-range-friction-provenance-30` | `1c6a3ed8d0a8360c8fe4648a83387a2bd4fa30b4` |
| CORRECTION-31 | `checkpoint/shared-range-release-lifecycle-31` | `3e2c1215b4ccef2beb799b3a7882247f6cd186cd` |
| CORRECTION-32 / -32A | `checkpoint/crowding-decision-pressure-authority-32` | `d11854153e76c2435bce9d53ffde49317e5e8f90` |
| CORRECTION-33 | `checkpoint/social-access-unrelated-risk-provenance-33` | `5ebb5e9887e36341f69350d4d3cff85f9493457c` |
| CORRECTION-34 … -34F | `checkpoint/shared-use-physical-presence-authority-34` | `df349eb60940d3ee3995fa6bccac7c902578fd3e` |
| Item 3 final integration audit | `checkpoint/shared-range-item-3-final-freeze` | `742b567f9351ca3ef9eaafef05a620dbd2ff1db4` |
| CORRECTION-35 | `checkpoint/shared-range-release-territorial-authority-35` | `706166892d40189fc56ac7458b9e90a8ffdbddd7` |

**Verified: all ten are ancestors of the freeze head.** The Item 3 line is linear from `main`.

Evidence directories, one per checkpoint, all present and all byte-unchanged by this audit:
`crowding-shared-range-authority-27`, `crowding-physical-memory-separation-28`,
`shared-range-encounter-provenance-29`, `shared-range-friction-provenance-30`,
`shared-range-release-lifecycle-31`, `crowding-decision-pressure-authority-32`,
`social-access-unrelated-risk-provenance-33`, `shared-use-physical-presence-authority-34`,
`shared-range-item-3-final-freeze`, `shared-range-release-territorial-authority-35`.

---

## Production surface

**20 files, +1,729 −405**, measured from the AUDIT-27 tip (the last commit before any Item 3
production change; AUDIT-27 itself was audit-only) to the freeze head. Full per-file numbers in
`freeze-manifest.json`.

The diff from `main` touches 50 files and is **not** the Item 3 surface — it also contains roadmap
items 1 and 2.

---

## Required audits and results

| Audit | Result |
|---|---|
| freeze certification (A1–A8, B1–B4) | **12 claims, 0 failing, 0 vacuous, 0 not-constructed** |
| integrated controlled fixtures I1–I16 | **16, 0 failing, 0 vacuous, 0 not-constructed** |
| CORRECTION-35 lifecycle L1–L12 | 12, 0 failing, 0 vacuous, **1 NOT_CONSTRUCTED (L3)** |
| CORRECTION-35 territorial T1–T12 | 12, 0 failing, 0 vacuous |
| CORRECTION-35 combined C1–C8 | 8, 0 failing, 0 vacuous |
| natural integrated 20 / 50 / 200 y | adverse total **0** at every horizon |
| natural integrated 200 y, incident seed | adverse total **0** |
| four-way, expedition arm | `ALL_FOUR_MODES_IDENTICAL_WITH_ITEM_3_BEHAVIOUR_PRESENT` |
| four-way, shared-range arm | `ALL_FOUR_MODES_IDENTICAL_WITH_ITEM_3_BEHAVIOUR_PRESENT` (48 encounters, 16 friction records, 3 active parties, 26 exploitation outcomes in the compared span) |
| fresh-process, both arms | `FRESH_PROCESS_IDENTICAL` |
| lifecycle determinism, 50 y | identical; 29 active + 6 cooling place-samples, **0 released** |
| lifecycle determinism, 200 y | identical; **420 active + 388 cooling + 198 released** place-samples |
| active party across an annual demographic boundary | **180 of 200 boundaries**, sampled daily |
| AUDIT-27 | 11/11, every accepted verdict reproduced |
| CORRECTION-28 | 12 fixtures, field/scan parity **0 mismatches** |
| CORRECTION-29 / -30 / -31 | 12 / 15 / 22 |
| CORRECTION-32 + zero controls | 21, 0 vacuous + 6, 0 violating |
| CORRECTION-33 | 20, 0 vacuous, 0 adverse |
| CORRECTION-34 presence (50 y) | 0 adverse; `P9_concurrent_parties` = `CONCURRENT_PARTIES_CONSERVED` |
| CORRECTION-34A closure | 12, 0 unexpected, 5 deferred by scope reduction |
| 34B R1–R12 / 34C L1–L12 / 34D H1–H14 / 34E T1–T14 / 34F Z0–Z12 | 12 / 12 / 14 / 14 / 13, all 0 failing 0 vacuous |
| person conservation | 9, 0 unexpected |
| numeric resource chain | `RECONCILED` |
| tsc (both), build | PASS |
| graph | 221/764, 0 duplicate, 0 dangling |
| import boundary | **85 internal back-edges — unchanged since CORRECTION-28** |
| season order, step mode, four-way step mode | PASS / PASS / `ALL_FOUR_STEP_MODES_IDENTICAL` |
| catchment invariants, food pipeline, mobility authority, socialCausality | PASS |

---

## Deterministic seeds and maps

Map `map2`. Two seeds, **both reported because they disagree**:

- `audit27:natural:s1` — the shared-range seed, socially rich.
- `audit27:natural:map2:s1` — the incident seed, on which the Item 3 blocker was originally found.

The same machinery produces materially different social histories on the two. That is the
divergent-history property Item 3 wanted, and it is why neither seed alone is treated as the answer.

---

## Performance and state bounds

| horizon | band-days | ms / simulated day |
|---|---|---|
| 20 y | 64,800 | 0.91 |
| 50 y | 162,000 | 0.99 |
| 200 y | 627,479 | 1.02 |
| 200 y, incident seed | 628,919 | 1.00 |

Per-day cost is flat from 20 to 200 years. Every store sits at or below its production cap at every
horizon: presence sources per band 3, trip records 24, outcome records 6, friction records 8,
access places 8, active parties 2, crowding contributors per tile 1.

Wall clock on a shared developer machine. **No performance claim is made against any earlier
checkpoint.**

---

## The six carried-forward seams

Copied **verbatim** from the single carry-forward block in `docs/HANDOFF.md`. Full text and
classification in `ITEM_3_LIMITATIONS_AND_SEAMS.md`.

> 1. **the physical shared-use substrate** — `sharedCatchment`'s footprint is residence-anchored, so
>    real trips, expedition routes and investigation walks compete for nothing. Measured and
>    published in `shared-catchment-boundary.json`; **unchanged by CORRECTION-35**.
> 2. **activity-party crowding / expedition overlap / temporary task-party footprints.**
> 3. **no visibility, route or barrier rule** for social perception of any kind.
> 4. **no physical-trace authority** — no tracks, trails, camp remains, trace freshness or cross-band
>    smoke. Belongs to the Persistent Human Landscape pass.
> 5. **`SocialPressureProfile.territorialPressure`** — a second orphan, documented by CORRECTION-35
>    as having **zero readers repository-wide**. Inert, therefore not a blocker; it must not be wired
>    up by a future system without its own lived writer.
> 6. **no UI surfaces the social-evidence lifecycle**, unchanged from Item 3.

**Freezing Item 3 closes none of these.**

---

## Deferrals preserved

- **Same-day party current presence** — formally descoped by CORRECTION-34A: production has no
  within-day consumer, `runDailyActions` builds no `TickContextCache`, and a day-scoped ledger would
  be empty at every instant its only consumer runs. The seam is documented; no dead ledger exists.
- **The residence-anchored catchment boundary** — carried-forward seam 1, OPEN.
- **The public Day/Season simplification** — deferred and unimplemented. All four internal step
  modes are retained as batch sizes over one daily kernel, never as alternate behaviour.

---

## Roadmap Item 4 — explicitly absent

Not started. Absent: dynamic fission driven by shared-range pressure, daughter viability,
successor-group selection, cancelling a prepared party to free founders, founder-policy change.

`createDaughterBand` is untouched by CORRECTION-35; the production diff from the previous audit head
touches six files, none of them fission. Controlled fixtures `I13` and `C8` assert the boundary.

---

## Integrity statements

- **main was untouched.** It is the merge base of this branch.
- **Accepted evidence was untouched.** sha256 over **all 607 files** under `docs/evidence/`
  (excluding this checkpoint's own directory) was taken before the regression began and again after
  every suite had run. The two manifests are **identical**. See `frozen-evidence-integrity.json`.
- **No temporary overwrite incident occurred in this pass.** Output flags were enumerated with a
  parser-aware extractor that also reports each script's hardcoded `docs/evidence` defaults —
  written because CORRECTION-35 recorded an incident caused by a single-line pattern missing
  multi-line `arg(` declarations.
