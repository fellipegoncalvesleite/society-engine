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
