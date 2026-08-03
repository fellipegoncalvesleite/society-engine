# ROADMAP ITEM 3 — FREEZE MANIFEST

**Status: CANDIDATE FOR CLOSURE — NOT FROZEN.**
One blocker found (`ITEM_3_LIMITATIONS.md` §B1). The executor may not declare the item frozen;
Browser GPT decides.

Machine-readable form: `freeze-manifest.json`.

## Repository and branches

| | |
| --- | --- |
| repository | `fellipegoncalvesleite/human-nomad-simulator` |
| audit branch | `checkpoint/shared-range-item-3-final-freeze` |
| branched from | `df349eb60940d3ee3995fa6bccac7c902578fd3e` (CORRECTION-34F, accepted and frozen) |
| main | `0a43083a3a9103bc6b8f693b8823a604ae2c6a8d` — **untouched** |
| merge base with main | `0a43083a3a9103bc6b8f693b8823a604ae2c6a8d` |

## Accepted sub-checkpoints

Every SHA below was derived from Git (`git branch -a --format`) and cross-checked against
`docs/HANDOFF.md` and `CLAUDE.md`. None was taken from a prompt. Ancestry was verified with
`git merge-base --is-ancestor`: the chain is strictly linear and main is an ancestor of the tip.

| Checkpoint | SHA | Status |
| --- | --- | --- |
| AUDIT-27 crowding / shared range authority (diagnostic) | `b352c3195406fc9494c0b693a98eb0786f1a3780` | FROZEN |
| CORRECTION-28 physical vs remembered crowding | `c5eb58a8f5ff7054665f9c376ac4ca856403efab` | FROZEN |
| CORRECTION-29 direct encounter provenance | `a15d0a78a3a7ef57b87b22226190d6729ba9b9d7` | FROZEN |
| CORRECTION-30 range-friction observation provenance | `1c6a3ed8d0a8360c8fe4648a83387a2bd4fa30b4` | FROZEN |
| CORRECTION-31 friction / access-expectation lifecycle | `3e2c1215b4ccef2beb799b3a7882247f6cd186cd` | FROZEN |
| CORRECTION-32 + 32A crowding decision-pressure authority | `d11854153e76c2435bce9d53ffde49317e5e8f90` | ACCEPTED (32 shipped PROGRESS; 32A repaired its instrument) |
| CORRECTION-33 global band-count social omniscience | `5ebb5e9887e36341f69350d4d3cff85f9493457c` | FROZEN |
| CORRECTION-34 away-party physical presence | `4042210b332d41b91ed394aa9307962f0106a60c` | sub-tip |
| CORRECTION-34A daily presence + catchment effort | `f875738b10b0ffc5edef3a89fd2c763eb06f1043` (closure `4f296442af62153a74001a5305f71108fa1c3e10`) | sub-tip |
| CORRECTION-34B partial reconciliation consistency | `fd868d6877fa17646a6186b2a358b08f27c8adf2` | sub-tip |
| CORRECTION-34C away-body / cohort / fission ownership | `e9b9655631088e090c38097b095c4e899e81123d` | sub-tip |
| CORRECTION-34D headcount vs productive labour | `c8df1eaa927ce0c7779ed6b184eeea40568a6a5e` | sub-tip |
| CORRECTION-34E target-work labour provenance | `e7d8de44fd78c8e15308a3bc47a3b346cffd1668` | sub-tip |
| CORRECTION-34F zero-labour target-work contract | `df349eb60940d3ee3995fa6bccac7c902578fd3e` | **ACCEPTED AND FROZEN — the base of this audit** |

## Production surface

18 files, `+1654 −402` across `b352c31..df349eb`. Listed in `freeze-manifest.json`.
**This checkpoint changed none of them**: `git diff df349eb..HEAD -- src/` is empty.

## Audits and results

`frozen-regression-summary.json` — 17 suites, **222 fixtures, 0 failing**, every output flag
redirected, 21 of 21 comparable outputs byte-identical to the CORRECTION-34F run.

New in this checkpoint:

| Audit | Result |
| --- | --- |
| `itemThreeIntegrationFixturesAudit.mjs` (I1–I16) | 16 / 0 failing / 0 vacuous / 0 not-constructed |
| `itemThreeNaturalIntegrationAudit.mjs` (20 y, 50 y, 200 y) | 0 adverse on the shared-range seed at all three horizons |
| `itemThreeDeterminismAudit.mjs` | four-way identical and fresh-process identical **on both arms**, with Item 3 behaviour present in each |
| `itemThreeReleasedPlaceProbe.mjs` | **1 incident in 448** — the §B1 blocker |

## State caps, seeds, performance

`performance-and-state-bounds.json`. Per-day cost flat 20 → 200 years; every store at or below its
production cap.

Seeds and maps: integration fixtures `map2 / item3:integration`; natural `map2 /
audit27:natural:s1` at 20, 50 and 200 years; second natural arm `map2 / audit27:natural:map2:s1`;
time-mode spans 2,520 d and 5,040 d.

## Deferrals and exclusions

- **Same-day current expedition presence remains formally deferred** (CORRECTION-34A scope
  amendment). Unchanged and not re-litigated.
- **Roadmap Item 4 is explicitly unimplemented**: dynamic fission, daughter viability, successor-group
  selection, cancelling a prepared party to free founders, and any change to the founder-availability
  policy.
- The public Day/Season time-control simplification remains deferred.

## Integrity statements

- **No frozen evidence changed.** `git diff --name-only df349eb..HEAD -- docs/evidence/` excluding
  this new directory returns nothing, and no working-tree change exists outside it.
- **Main was untouched** and remains `0a43083a`.
- **No production file changed.**
- One writer throughout; one worktree; no stash; no amend, reset, rebase, merge or force push.
