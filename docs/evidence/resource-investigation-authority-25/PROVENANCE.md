# CLOSURE-25 — provenance

## Preflight

Executed before any edit; all four required results matched exactly.

```text
origin/main                                        0a43083a3a9103bc6b8f693b8823a604ae2c6a8d
origin/checkpoint/ordinary-exploration-capacity-24 ce723b3f1973e4f3f2c54a424a614e723a14558a
main is an ancestor of the checkpoint              YES
working tree                                       clean (0 changes)
```

Branch `checkpoint/resource-investigation-authority-25` was created from
`ce723b3f1973e4f3f2c54a424a614e723a14558a` exactly. `main` was never checked out,
merged, reset, rebased, or pushed.

Frozen authorities, unmodified by this pass:

```text
main                  0a43083a3a9103bc6b8f693b8823a604ae2c6a8d
CORRECTION-23 closure f87b98b513e22477cb21c9e70084e715340322ca
CORRECTION-24 closure ce723b3f1973e4f3f2c54a424a614e723a14558a
```

## No production instrumentation was used

This is the pass's most important methodological fact. The checkpoint permits
temporary production instrumentation **only** when no existing seam can expose the
required identity. No such case arose: every identity in the ledger is a field the
simulation already persists.

| identity needed | already persisted at |
| --- | --- |
| selected decision + action | `world.decisions` (`Decision.id`, `Decision.action`) |
| same-day trip, route, workers, harvest | `band.recentIntraSeasonTrips` (`IntraSeasonTripRecord`) |
| party, route, provisions, risk, cargo, camp | `band.expeditions` (`ExpeditionRecord`) |
| camp-movement temporary record | `band.campMovement.temporaryTaskCamps` |
| receipt accumulator | `band.seasonalFoodReceipts` |
| resource belief | `band.resourceKnowledgeState.patchMemories` |

Live expeditions are dropped at terminal and compacted into
`recentExpeditionOutcomes`, so parties are captured **per day while still active**
and joined afterwards by expedition id. The audits therefore step production one day
at a time and read state; they never write to it.

**Consequence for the commit structure.** The checkpoint specifies Commit A
(instrumentation + evidence) then Commit B (remove instrumentation, prove tree
equality). Because no production line was ever added, Commit B's removal step is
vacuous. Rather than manufacture an empty commit, this pass makes **one commit** and
proves the same gate directly:

```bash
git diff --exit-code ce723b3f1973e4f3f2c54a424a614e723a14558a -- src/sim
```

This deviation is deliberate and is reported rather than hidden.

## Instrument validation order

Performed in the order the checkpoint requires, before the natural sample was
accepted:

1. **Classifier smoke** — 3 years, `map1`, one seed. Families separated correctly.
2. **Manual identity verification** — one row per family read by hand: a same-day
   food trip (`tile:126:56 → tile:125:56`, 4 people, contiguous `pathTiles`, source
   `plant:tile:125:56:wetland_plant`), a water check (returned kind `none`, not
   consumed, no harvest), a frontier party
   (`expedition:band:dry-margin-foragers:96:frontier_exploration:742566b`, 2 workers,
   19 route tiles, 0.0128 provisions), and a camp-movement record (every physical
   join column `null`).
3. **Selected vs executed** — confirmed distinct throughout; `resource_scout` has a
   selected identity and **no** executed identity, which is finding §3.
4. **Receipt arithmetic by hand** — 40 rows; `usable = harvested − transport −
   processing` exact on 29 and within 1e-4 on 11 (`round4`), max deviation
   0.0001.
5. **Diagnostics-off** — not applicable; nothing was registered into production.
6. **Small smoke sample** — the 3-year run above, before the 20-year sample.

## Runs

| artifact | scope |
| --- | --- |
| `natural-occurrence.json` | 20 years, `map1` / `map2` / `ordinary`, seed `s1`, prefix `c25:authority` |
| `fixtures.json` | A1/A2, first natural `resource_scout` found by deterministic search over `map2:s1` then `map1:s1` |

Raw rows are preserved per family (cap 40 each), not only summaries, and each carries
enough identity to join band → decision → action → party → target → route → camp →
physical work → memory → receipt → support period.

Expansion allowance was **not used**: every required event kind occurred at the
minimum specified scope.

## A3–A10 are covered by existing repository audits

The checkpoint requires verifying script names against the repository rather than
inventing replacements. A1 and A2 state contracts no existing audit states and were
written here. Everything else was **run**, not reimplemented:

| contract | repository audit | result |
| --- | --- | --- |
| A3 same-day physical food trip | `livingEcologyFoodPipelineAudit.mjs` | PASS |
| A4 information-only trip | measured in `natural-occurrence.json` (1,101 rows, 0 credited) | PASS |
| A5 multi-day verification | `expeditionKnowledgeLatencyAudit.mjs`, `verificationClosureFixturesAudit.mjs` I12 | PASS |
| A6 retrieval with task camp | `taskCampComparisonAudit.mjs` | PASS |
| A7 campless control | `taskCampComparisonAudit.mjs` (same run, both arms) | PASS |
| A8 lost party | `pendingOperationFixturesAudit.mjs` J9, `verificationClosureFixturesAudit.mjs` I12 | PASS |
| A9 dormant `temporary_use` ordering | `pendingOperationFixturesAudit.mjs` J8, J11 | PASS |
| A10 receipt freshness | `recoveryFoodAccountingAudit.mjs` | PASS |
| Gate 6 anti-omniscience | `frontierAntiOmniscienceAudit.mjs` | PASS |
| expedition lifecycle | `expeditionLifecycleAudit.mjs`, `expeditionNaturalOccurrenceAudit.mjs` | PASS |

## Prior-checkpoint evidence was protected

Three of those audits write to their own default output paths inside **earlier**
checkpoints' evidence directories:

```text
pendingOperationFixturesAudit    → docs/evidence/correction23j/
verificationClosureFixturesAudit → docs/evidence/correction23i/
frontierAntiOmniscienceAudit     → docs/evidence/correction17/
```

Running them modified two committed files. Both were reverted with
`git checkout --`, and their results are recorded in this pass's own documents as
text. No earlier checkpoint's evidence is altered by this commit. This is the same
hazard CORRECTION-24 recorded, and it recurred exactly as documented.

## Authorship

Commit author and committer are the human repository owner. No attribution trailer,
generated-by notice, or AI name appears in any commit message, source file,
document, script, or generated evidence produced by this pass.

Inherited violations, reported and **not** rewritten: `d41c973` carries a non-human
author/committer identity and a prohibited trailer; `1faa7c9` carries the trailer.
Both predate the current rule and are ancestors of published history.
