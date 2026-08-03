# CORRECTION-34 — PROVENANCE

## Trees

| Arm | Tree |
| --- | --- |
| before | `5ebb5e9887e36341f69350d4d3cff85f9493457c` (CORRECTION-33 tip, frozen) — detached worktree, `node_modules` symlinked, audit scripts copied in |
| after | `checkpoint/shared-use-physical-presence-authority-34` |

Both arms ran the **same script files**. The fixtures audit detects whether
`crowding.getBandPhysicalPresence` exists and, on the before arm, falls back to the residence-only
model production actually had — so the same file is valid on both trees.

Preflight verified: HEAD `5ebb5e98`, clean tree, `main` at `0a43083a`, one worktree, no stashes,
all seven prior checkpoint tips identical to their remotes.

## Production change

One file, `src/sim/agents/crowding.ts`: `getBandPhysicalPresence` + `physicalPresencePeopleTotal`
added; `buildCrowdingField` and `computeCrowdingContribDescriptor` rewired to iterate presence
sources. No new module, store, type, constant or import edge.

## Commands

```bash
node scripts/physicalPresenceCurrentStateAudit.mjs --years 20            # §7, on the unmodified tree
node scripts/physicalPresenceFixturesAudit.mjs --arm after  --years 6
node scripts/physicalPresenceFixturesAudit.mjs --arm before --years 6 \
  --out <s>/c34-fix-before.json --out-person <s>/c34-person-before.json \
  --out-timelines <s>/c34-tl-before.json --out-expedition <s>/c34-exp-before.json \
  --out-sameday <s>/c34-sd-before.json --out-social <s>/c34-soc-before.json
```

Regressions were rerun with **every** output flag redirected outside the repository, including the
`--timeline-out` and `--timelines` second outputs that a previous pass overwrote.

## Sampling

**Daily.** A seasonal probe measured 0 parties beyond `CROWDING_RADIUS` and 0 task-camp days;
daily sampling measures 60.9% and 27 respectively. The seasonal figure was an artifact of sampling
at a boundary where parties are near home, and is recorded as an instrument error caught in this
pass.

## Files NOT produced in this pass

`natural-occurrence-20y.json`, `natural-occurrence-50y.json`, `behavioral-comparison.json`,
`resource-accounting.json`, `performance.json`, `step-mode-equivalence.json`, `before-after.json`
and `FINDINGS.md`'s natural sections were **not** produced. The §19 evidence package is therefore
incomplete, which is the primary reason this checkpoint reports PROGRESS rather than PASS.

---

## CORRECTION-34D — provenance

| Arm | Tree |
| --- | --- |
| before | `e9b9655631088e090c38097b095c4e899e81123d` (CORRECTION-34C tip) |
| after | `checkpoint/shared-use-physical-presence-authority-34` |

Preflight verified: branch exact, tree clean, local and remote HEAD both `e9b9655`, `origin/main`
`0a43083a3a9103bc6b8f693b8823a604ae2c6a8d`, merge-base = `origin/main`, one worktree, no stashes,
`git diff e9b9655..HEAD` empty.

**Both arms ran the SAME script file.** `scripts/headcountLaborAuthorityAudit.mjs` reads
`nonWorkingPartyPeople` with `?? 0` and passes an extra argument to `derivePartyPaceFactor` that the
before arm ignores, so it is valid on both trees. The before arm was measured by stashing `src/`,
running, and restoring; `git stash list` was verified empty afterwards and the tree returned to the
committed state.

### Production change — eleven files

| File | Change |
| --- | --- |
| `agents/types.ts` | `ExpeditionRecord.nonWorkingPartyPeople`, `ExpeditionOutcomeSummary.partyPeople`, two outcome reasons |
| `agents/bandMobility.ts` | the two derivations, the physically-away / prepared split, pace burden |
| `agents/expedition.ts` | labour bound + defensive body bound split, consumption on headcount, outcome summary |
| `agents/crowding.ts` | presence counts people; phase test moved to the leaf |
| `agents/demography.ts` | fission founder availability |
| `agents/sharedCatchment.ts` | elder term read rather than inferred |
| `agents/acuteRisk.ts` | provision budget on headcount |
| `agents/bandEvents.ts` | human-facing counts are bodies; repairs are never narrated |
| `agents/intraSeasonTrips.ts` | documentation only — both labour readers were already correct |
| `ui/band/Mobility.tsx` | shows bodies, and workers when they differ |

### Audits added

`headcountLaborAuthorityAudit.mjs`, `headcountLaborFixturesAudit.mjs`,
`naturalHeadcountLaborAudit.mjs`.

### Evidence-output incidents — both recorded in full, neither minimised

**Incident 1 — CORRECTION-33 frozen directory.**
`socialAccessUnrelatedRiskFixturesAudit.mjs` has **six** output flags (`--out`, `--out-threshold`,
`--out-terminal`, `--out-preserve`, `--out-water`, `--out-score`). The first rerun redirected only
`--out`, so five files were written into `docs/evidence/social-access-unrelated-risk-provenance-33/`:
`candidate-score-comparison.json`, `social-access-preservation.json`,
`terminal-record-isolation.json`, `threshold-isolation.json`, `water-refuge-comparison.json`.

Restored with `git checkout -- docs/evidence/social-access-unrelated-risk-provenance-33/` **before
any commit**, then the audit was re-run with all six flags pointed at a scratch directory. Verified
per file: each is **byte-identical to both `e9b9655` and `HEAD`**. No frozen-evidence commit exists;
`git diff --name-only e9b9655..HEAD -- docs/evidence/ ':(exclude)docs/evidence/shared-use-physical-presence-authority-34/**'`
returns nothing.

**Incident 2 — this checkpoint's own directory (not frozen).**
`physicalPresenceFixturesAudit.mjs` defaults to `--years 6`; the committed data files held a
twenty-year run. Running the default overwrote six files. They were restored with `git checkout --`
and the audit was re-run at `--years 20`. The outcome is **not** a byte restore and is not
described as one:

| file | state now |
| --- | --- |
| `expedition-presence.json` | differs from the pre-run committed version **by the `generatedAt` line only** — NOT byte-restored |
| `person-conservation.json` | same — `generatedAt` only |
| `physical-presence-timelines.json` | same — `generatedAt` only |
| `same-day-presence.json` | same — `generatedAt` only |
| `social-separation.json` | same — `generatedAt` only |
| `performance.json` | restored at that point, then **legitimately re-run in final validation** — see the correction below; it is **NOT** byte-identical to `e9b9655` |
| `controlled-fixtures.json` | **intentionally regenerated at 20 years instead of 6**, which promotes `P9_concurrent_parties` out of vacuous |

All measured quantities in the five timestamp-only files are unchanged; only the run stamp moved.
This is a legitimate regeneration of current-checkpoint evidence at its recorded horizon, and the
provenance record above is the reason it is acceptable. No frozen evidence was modified to make any
report read more cleanly.

**Correction to this table, made after the final validation run.** `performance.json` was restored
untouched at the time of the incident, but the final validation re-ran
`presenceEvidenceClosureAudit.mjs`, which regenerates it. It is therefore **no longer byte-identical
to `e9b9655`**, and saying so would be false. What moved:

| figure | `e9b9655` | now | reading |
| --- | ---: | ---: | --- |
| state, 20 y | 76,896,969 B | 76,898,193 B | **+1,224 B** |
| state, 50 y | 78,013,849 B | 78,015,181 B | **+1,332 B** |
| ms per simulated day, 20 y | 0.8622 | 1.5172 | not a controlled comparison |
| ms per simulated day, 50 y | 0.8247 | 1.4854 | not a controlled comparison |

The **state growth is attributable and bounded**: `ExpeditionOutcomeSummary.partyPeople` is now
written on every terminal outcome, the outcome ring is capped at 6 records per band, and 9 bands
live at both horizons — 54 records at roughly 22 bytes of JSON each predicts ~1,188 B against 1,224
and 1,332 observed. That is the whole cost of this checkpoint's state, and every cap in the file is
unchanged (presence sources per band 3, trips 24, outcomes 6, stale terminal presence 0, person
conservation failures 0, duplicate receipts 0).

The **wall-clock figures are NOT a controlled comparison and no performance claim is made in either
direction.** The file's own header says the timings are comparable within a file and not across
machines; these two rows were produced on a machine that had been running audits continuously for
hours, and no before/after timing arm was constructed. Reporting the rise as a regression, or
dismissing it as noise, would both be unsupported.

---

## CORRECTION-34E — provenance

| Arm | Tree |
| --- | --- |
| before | `12716a68dfd0ca4c21a59174f5f604de1d7f31bd` — the pass's own before-arm commit, which contains the probe and the pre-repair production. Run through a **temporary detached worktree** with `node_modules` symlinked and the corrected probe copied in; the worktree was removed immediately afterwards and no second implementation was created there. |
| parent (regressions, same-day preservation) | `c8df1eaa927ce0c7779ed6b184eeea40568a6a5e` — same mechanism, same removal. |
| after | `checkpoint/shared-use-physical-presence-authority-34` |

Both arms ran the **same probe file**. It is arm-neutral by construction: it passes
`{ partyWorkers }` in every call, which the pre-repair resolver ignores as an unknown property and
the repaired resolver requires, and it detects which tree it is on **by behaviour** — resolving once
without the option and recording whether the resolver ignores it (before) or refuses (after) —
rather than by arity or by assumption.

### Ownership

This pass began with an explicit exclusive-ownership transfer from the interrupted Claude App
session. Preflight confirmed one worktree, no stashes, no in-progress merge/rebase/cherry-pick, no
index lock, branch exact, `origin/main` unchanged at `0a43083a`. The two inherited commits
(`12716a6`, `d36bc87`) were preserved unmodified; nothing was reset, amended, squashed or discarded.

### Commands

```bash
# before arm, in a temporary detached worktree at 12716a6
node scripts/targetWorkLaborAudit.mjs --phase before --out <scratch>/before.json
# after arm
node scripts/targetWorkLaborAudit.mjs --phase after  --out <scratch>/after.json

node scripts/targetWorkFixturesAudit.mjs \
  --out <evidence>/target-work-labor-fixtures.json \
  --out-matrix <evidence>/target-work-caller-matrix.json \
  --out-chain  <evidence>/target-work-numeric-chain.json

node scripts/targetWorkNaturalAudit.mjs --years 20 --out <evidence>/natural-target-work-20y.json
node scripts/targetWorkNaturalAudit.mjs --years 50 --out <evidence>/natural-target-work-50y.json

# run on BOTH trees, digests compared
node scripts/targetWorkSameDayPreservationAudit.mjs --out <scratch>/sameday-<tree>.json
```

Every frozen-checkpoint regression was run with **every** output flag redirected outside the
repository — including `--timeline-out` (AUDIT-27), `--timelines` (CORRECTION-31), `--parity-out`,
`--chain-out`, `--cascade-out`, and CORRECTION-33's **six** output flags. `git diff --name-only
c8df1ea..HEAD -- docs/evidence/ ':(exclude)…authority-34/**'` returns nothing, and no working-tree
change exists outside the current checkpoint's directory. **No frozen-evidence incident occurred in
this pass.**

### Why regressions were compared rerun-to-rerun, not rerun-to-committed-file

Several committed fixture files predate CORRECTION-28..-32 and legitimately differ from any current
run (AUDIT-27's C4 and C10b have been flipped since CORRECTION-28/-29). Comparing this tree's rerun
against the *committed* file would therefore attribute inherited, documented differences to this
pass. Each suite was instead run on the parent commit and on this tree with identical arguments, and
the two runs compared. Result: **verdicts identical in all nine suites**; five suites byte-identical
once the `generatedAt` line is ignored; four show small numeric drift with no verdict change, which
is the expected downstream consequence of a distant party now removing a different amount of stock.
See `target-work-regression-delta.json`.

### 34D artifacts were NOT regenerated

`performance.json`, `controlled-fixtures.json`, `expedition-presence.json` and the other
CORRECTION-34D artifacts describe CORRECTION-34D's tree and are left as they are, so that report
stays checkable against its own evidence. Where CORRECTION-34E's production change moves those
numbers, the movement is recorded in `target-work-regression-delta.json` rather than by overwriting
history.

### Instrument corrections in this pass

Five, all listed in §10 of `EXPEDITION_TARGET_WORK_LABOR_PROVENANCE.md`. The most serious: the
before/after probe's stock reading keyed the world's stores by tile id when `plantPatchState` is
keyed by patch id, so `stockChangedAtTarget` read `false` in **every arm of both trees** and the
field measured nothing. Both arms were regenerated with the corrected probe; the superseded pair is
preserved in git history at `12716a6` and `d36bc87`.
