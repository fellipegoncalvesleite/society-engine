# Roadmap Item 4 — provenance

What was done in this checkpoint, on which tree, and what was deliberately **not** done.

---

## Tree

| | |
|---|---|
| branch | `checkpoint/dynamic-fission-daughter-viability-37` |
| branched from | `ef76971bd66a7413313183349b9468a879405970` (Item 3 final freeze audit) |
| Item 3 production authority | `706166892d40189fc56ac7458b9e90a8ffdbddd7` |
| main | `0a43083a3a9103bc6b8f693b8823a604ae2c6a8d` |

**`git diff ef76971..HEAD -- src/` is EMPTY.** No production file, constant or schema changed.

---

## What this checkpoint completed

1. **The current fission chain read from production**, symbol by symbol, rather than inferred:
   the annual gate, `splitPressure`, `selectFissionTarget`, `getSplitDeferredReason`,
   `createDaughterBand`, `createDaughterDemography`, `recomputeDemographicCounts`,
   `getDaughterPopulation`, and the founder-availability caps CORRECTION-34C and -34D added.
2. **`RESEARCH_CONSTRAINTS.md`** — what the literature licenses and, more importantly, what it does
   not. Every claim classified. The seven forbidden encodings listed explicitly.
3. **`BEFORE_ARCHITECTURE_AUDIT.md` and `fission-before.json`** — 200 simulated years on two seeds,
   two natural fissions, measured against the §15 list.
4. **`ARCHITECTURE_DECISION.md`** — four directions compared, one selected with reasons, and the
   rejected ones recorded with why.

---

## What this checkpoint did NOT do, and why

**The implementation is not started.**

Direction D requires, as one coherent change: a bounded attempt state; a provisional-successor
lifecycle; a cohort-**allocation** authority to replace the current re-derivation; a physical
departure transition; an establishment window with resolution into stabilization or return; and an
audit of every reader that would see a provisional band. Alongside it, this repository requires
twenty-six controlled fixtures with non-vacuity predicates, natural runs at three horizons on
multiple seeds, four-way and fresh-process determinism over a span containing a real attempt, and
the full Item 3 regression with hashed evidence integrity — before a production change of that size
is credible here.

Delivering part of that would leave precisely the half-state `CLAUDE.md` §18 forbids: an attempt
state that nothing resolves, or a provisional band that every other system already treats as
ordinary. Either would be worse than the measured defect it replaced, because it would *look*
finished.

The audit and the architecture are therefore committed on their own. The next session starts from a
measured baseline and a decided design rather than from a fresh reading of the same code.

---

## Instrument error recorded

One, in this checkpoint's own probe.

`daughterHasProvisionalState` first asked whether **any** band key matched
`/provisional|attempt|establish/i`. It reported `true` for every daughter — a false positive on
pre-existing unrelated keys (`attempts`, `attempted`, `careAttempted`, and the adaptation state's
`attemptIndex` / `attemptSeasons`), none of which concerns fission.

Uncorrected, it would have claimed the existence of the very provisional state whose **absence** is
this audit's central finding. Corrected to test the named fission-specific fields, and the probe
was re-run rather than patched in place.

---

## Accepted evidence integrity

All accepted evidence under `docs/evidence/` was hashed before this checkpoint began
(`artifacts/c37/accepted-baseline.txt`, 635 files) and verified unchanged afterwards. No accepted
evidence file changed. No temporary overwrite incident occurred — no audit in this checkpoint writes
outside `artifacts/` and this checkpoint's own evidence directory.

---

## Item 3 remains frozen and untouched

No Item 3 branch was modified. The six carried-forward seams are unchanged and uncloseable by this
checkpoint. The three inert territorial names remain inert; nothing here gives any of them a writer.

**Roadmap Item 5 was not started and was not prepared.**

---

## `.probe-tmp.mjs` — what it proved, and its disposition

An untracked, ad-hoc 53-line probe left behind by the interrupted implementation pass. It drove the
then-uncommitted `fissionParentResidualViability.ts` over twelve constructed parents and printed a
one-line summary per case. It is recorded here so it is never an unexplained file.

**What it proved, and it is the finding that reshaped the module:** the interrupted single-aggregate
model refused a struggling parent on a score dominated by hardship the split did not cause, and the
refusal was invariant to the founder count. Its `all-bad` and `all-bad-small-min` rows — identical
`strain 0.92`, identical `blocked: true`, with the minimum founder request differing 18 against 2 —
are the raw evidence for that claim.

**Where its content now lives, so nothing rests on the temporary file:**

- its raw output for the decisive rows is quoted verbatim in `PARENT_RESIDUAL_DECISION.md` §2;
- its arithmetic is reconstructed constant-for-constant, and its `0.92` reproduced to the digit as
  `0.9213`, by `scripts/fissionParentResidualReproductionAudit.mjs` →
  `parent-residual-prior-strain-reproduction.json`;
- its twelve constructed parents are superseded by the twenty controlled fixtures in
  `scripts/fissionParentResidualFixturesAudit.mjs` →
  `parent-residual-controlled-fixtures.json`.

**Disposition: it is retained during active work as the brief requires, and carries no remaining
evidential load.** It is deleted normally before the final candidate; nothing cites it, and this
entry is the record that survives the deletion.
