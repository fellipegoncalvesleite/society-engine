# CORRECTION-24C — repository and detached-worktree provenance

## The checkpoint SHAs changed under this pass

On **2026-07-31**, between the CORRECTION-24C brief being written and this pass
completing, every trace of non-human attribution was stripped from the public
repository. Four live commits were rewritten, and because they are ancestors of
this checkpoint, **every SHA the brief names has been superseded**. The rewrite
changed no tree: each new commit is byte-identical in content to the one it
replaces.

| brief SHA (pre-strip) | current SHA | tree |
| --- | --- | --- |
| `6a093d948f03e204b12d597c8b8929ca58b08d56` | `2d41131e48608224a066b3eecf6b6855f203edfc` | identical |
| `2644245e` | `6645d7a` | identical |
| `e338beb` | `1311002` | identical |
| `9e317647b3ab8d4a36ae905a567a46b7a4845e1f` | `5f04c96` | identical |
| `4c440794` | `0372b99` | identical |
| `d865beec` | `dda44c5` | identical |
| `59391d54f6553f7cd05170ce7889b4bd72a43055` | `f87b98b513e22477cb21c9e70084e715340322ca` | identical |
| `668763f` | `0a43083` | identical |

Each pairing was verified by `git rev-parse <sha>^{tree}` equality, not by
subject matching alone. The pre-strip objects still resolve locally as
unreachable objects, which is why the audit worktrees below could be created at
their original SHAs.

**CORRECTION-23 remains frozen.** Its content is unchanged; its identity is now
`f87b98b513e22477cb21c9e70084e715340322ca`.

## Checkpoint preflight

The pass began on:

```text
branch: checkpoint/ordinary-exploration-capacity-24
local HEAD:  2d41131e48608224a066b3eecf6b6855f203edfc  (= brief's 6a093d9)
remote HEAD: 2d41131e48608224a066b3eecf6b6855f203edfc
working tree: clean
CORRECTION-23 frozen: f87b98b513e22477cb21c9e70084e715340322ca  (= brief's 59391d54)
local main:  0a43083a3a9103bc6b8f693b8823a604ae2c6a8d
remote main: 0a43083a3a9103bc6b8f693b8823a604ae2c6a8d
```

The checkpoint HEAD passed `git merge-base --is-ancestor` for every required
ancestor in its current identity:

```text
6645d7a   (brief 2644245e)
5f04c96   (brief 9e317647)
0372b99   (brief 4c440794)
dda44c5   (brief d865beec)
f87b98b   (brief 59391d54)
0a43083   (brief 668763f)
```

The configured commit identity was the human repository owner. **This pass
rewrote no history**; the attribution strip above was a separate, earlier
operation. Neither local nor remote `main` was checked out, merged, reset,
rebased, modified, or pushed.

## Where the evidence was generated

The audit runs were executed in a second clone that still carried the pre-strip
history, at `6a093d9` — the exact tree of the current `2d41131`. The completed
work was then transferred onto the canonical clean history for committing,
because committing from the pre-strip clone would have force-pushed the stripped
attribution back onto the public branch. Tree equality between the two
checkpoints is what makes the transfer exact rather than a merge.

## Inherited authorship debt

Two pre-existing commits violate the current human-only policy:

- `d41c97326eacde27442db9bcd15e308dc8c08cb1` has a non-human author and
  committer identity and a prohibited attribution trailer;
- `1faa7c9314b666b5bc799c064f73043c21a5fe87` has a human author and committer
  identity but retains a prohibited attribution trailer.

They are reported as inherited debt only. This pass does not rewrite history,
and no new attribution trailer or non-human identity is introduced.

## O2 long-horizon source

The O0/O2 matrix and three-run mediation used:

```text
worktree label: work/correction24c-o2-clean
detached HEAD: 9e317647b3ab8d4a36ae905a567a46b7a4845e1f
git status --short at launch: empty
```

This is the required clean source revision where the O2 arm remains available.
Its current identity on the rewritten history is `5f04c96`, with an identical
tree. The matrix runner lives on the checkpoint branch, but Vite loads all
simulation modules for those runs from the detached worktree's `src`.

### Shard provenance

The five 500-year O2 shards were not all produced by the same build of the
runner: `o2-500y-part3.json` predated the `metricDefinitions` block, so the merge
refused to combine them. That shard was **re-run with the current script**, not
patched. It reproduces every population difference of the superseded shard
exactly and differs only in `firstDivergenceDay` on the `site_E`/`site_F` rows,
which a third fresh-process run confirmed is a script-version difference rather
than nondeterminism. All 55 admitted pairs now come from one script version.

## O3 physical-stream source

The O3 parity audit used a separate detached worktree at the same commit:

```text
worktree label: work/correction24c-o2
detached HEAD: 9e317647b3ab8d4a36ae905a567a46b7a4845e1f
```

That worktree contains exactly 20 uncommitted, audit-only inserted lines:

- 11 lines in `src/sim/agents/expedition.ts`;
- 9 lines in
  `src/sim/diagnostics/explorationFunnelDiagnostics.ts`.

They expose party composition, provisions loaded, risk-episode identities,
terminal outcome, and terminal position in the non-persisted journey ledger.
They do not modify the world or either O0/O3 arm. The parity evidence therefore
identifies `9e317647` as its production source and separately discloses the
read-only audit projection.

### The projection is now durable (CORRECTION-24D)

Disclosing the projection in prose was not enough to reproduce it — the lines
lived only in an uncommitted worktree. They are now committed as a patch:

```text
artifact     docs/evidence/correction24c/o3-physical-stream-projection.patch
sha256       c6479f81ef81da1e0e0635f9f15909842007bdb932882ca65f3f745376949a6c
base commit  5f04c96827f90ea39e193d3294835a48550947bb
base tree    3fac2f72960f6ce37959b4c343758db0589fa8c9
scope        2 files, +20 / -0
```

Reproduced end to end from a **fresh clean detached worktree** at the base
commit: `git apply --check` OK → applied → applied scope matched the declaration
exactly (`+11` / `+9`, no deletions) → TypeScript PASS → O3 audit rerun
**55/55 exact, 0 mismatch** → **0 semantic differences** against the committed
evidence. `sourceRoot` is a fixed label string rather than an absolute path, so
no field actually required normalization. Recorded in
`o3-projection-reproduction.json`.

The projected `src/sim` lines are **not** committed to the checkpoint branch —
only the patch artifact, the reproduction record, and the documentation.
