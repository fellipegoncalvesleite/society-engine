# CORRECTION-35 — provenance

Who produced which evidence, on which tree, and which instrument errors were found on the way.
Recorded because a reader of the freeze decision needs to know how much of this was inherited from
an interrupted session and how much was re-derived.

---

## Trees

| tree | commit | role |
|---|---|---|
| parent | `742b567` | Item 3 final-integration candidate freeze head. The **before** arm for both parts. |
| lifecycle only | `e5e3143` | Part A applied, Part B not. The arm that **isolates** Part A. |
| tip | `427d953` | both parts. |

Both non-tip trees were measured in **temporary detached worktrees** under `artifacts/`
(gitignored), created with `git worktree add --detach` and removed afterwards. No branch was
checked out in the primary worktree at any point.

---

## Inherited vs successor work

### Inherited from the interrupted session, verified and kept

| commit | content | verdict |
|---|---|---|
| `9c44786` | Part A before arm | kept — reproduces the defect on real production |
| `dc36ae4` | Part B before arm | kept — reproduces the causal effect on real production |
| `e5e3143` | Part A production | kept — architecture verified correct |
| `427d953` | Part B production | kept — architecture verified correct; inventory confirms 3 readers removed, 0 remaining |

The four commits were **not** amended, squashed or rebased. The production diff was read in full
and independently checked against a fresh inventory of every `territorialPressure` occurrence.

### Successor work in this session

- completed the interrupted cross-tree comparison (L9, T3) and its two evidence files;
- rewrote `releaseTerritorialCrossTreeProbe.mjs` after finding four instrument defects in it;
- corrected the `T9` fixture, which was measuring nothing;
- added the **zero-divergence control**, which is what actually proves no reader survives;
- added natural instrumentation at 20 / 50 / 200 years for both parts;
- re-measured the Item 3 incident across all six access scalars on the tree where it exists;
- added the shared-catchment boundary audit;
- ran the regression matrix.

---

## Instrument errors found in this checkpoint's own probes

Recorded rather than quietly fixed, because each would have produced a confident and wrong number.

### 1. The cross-tree probe could not see the scalar the whole question turns on

The access digest read `strangerCaution`, `sharedUsePressure`, `rememberedRefusalAvoidance` and
`rememberedCooperationTolerance` — but **not** `kinTolerance` or `familiarTolerance`. `kinTolerance`
is the largest single component of the natural incident (0.02 of 0.04). A preservation proof blind
to it is not a preservation proof. **All six are now compared.**

### 2. Candidate identity was never actually compared

Candidates were read as `c.actionType` / `c.targetTileId`. `AlternativeConsidered` has neither — it
carries `action` (an `Action`) and `score`. Every candidate rendered as `?:-:score`, so the digest
compared **scores only** and two different candidates at one score were indistinguishable. Now read
through `c.action`.

### 3. The attribution channel was three unreadable sentinels compared with each other

`T9` read `primaryReason.detail.pressure`. There is no `detail`; the field is `pressure` directly on
the reason. The probe therefore returned its own `-1` fallback in all three arms and reported that
"the attribution figure no longer varies with an unprovenanced field" — a conclusion drawn from
`-1 === -1 === -1`.

Worse, `bandDecision.getMobilityPressure` fills only `known_site_sufficient` and
`low_mobility_pressure`, which are **stay** reasons. No band 3600 days into this world produces one,
so the channel was unobservable at that horizon regardless of the path.

Corrected on both counts: read at `reason.pressure`, and sampled on a 180-day world where bands
still stay. The term is now genuinely measured — **0.1523 → 0.1691 → 0.2643** on the parent as the
field goes 0 → 0.12 → 0.8, and constant at 0.1523 on the tip. The fixture refuses to pass unless it
can see the reason it is judging.

### 4. The decision score was compared between two absent values

Both probes read `d.score`. `Decision` (`rules/types.ts:1542`) has no `score` field.
`round4(undefined)` is `undefined`, which `JSON.stringify` **drops**, so the key vanished and every
"score unchanged" claim compared nothing. The selected action's score is now recovered from the
matching alternative, and `coreDeliberationBreadth` is recorded beside it. With this fixed, the
parent's territorial arm shows `score` moving on **12** further band-measurements that were
previously invisible.

### 5. The natural audit reported 16 contradictions that were its own

The first natural counter compared `activeEvidenceCount + historicalEvidenceCount` against **every**
record in the ring naming the tile. Production does not consider every such record:
`collectTileFrictionEvidence` keeps only those inside `FRICTION_RECENT_WINDOW_TICKS = 48` and then
takes the strongest six. The counts were right and the instrument was wrong. After replicating the
window and the cap: **0 contradictions at 20, 50 and 200 years.**

### 6. A stale output was read as a result

While checking background progress, a 200-year natural result was read as `16 contradictions` after
the counter had already been corrected. The cause was the progress check itself: `>` creates the log
file at launch, so "the log exists" was treated as "the run finished", and the file on disk was
still the previous job's. Two independent reruns of the corrected audit agree at **0**, with
identical place and phase counts. No conclusion was drawn from the stale read.

### 7. The shared-catchment anchor test moved the wrong thing

The first form moved `band.position` and observed the footprint stay put — which, published alone,
would have read as "the catchment does not follow the residence". It does.
`collectFootprintCandidateIds` prefers `band.residentialAnchor.catchmentTileIds` and only falls back
to a ring around `band.position` when no anchor exists. The audit now runs **both** arms and says so.

---

## Frozen-evidence incident — reported, not hidden

During the regression rerun, three audits wrote into **frozen** evidence directories:

| file | written by |
|---|---|
| `crowding-physical-memory-separation-28/controlled-fixtures.json` | `crowdingMemorySeparationFixturesAudit.mjs` (`--out`) |
| `shared-range-encounter-provenance-29/controlled-fixtures.json` | `encounterProvenanceFixturesAudit.mjs` (`--out`) |
| `shared-use-physical-presence-authority-34/natural-target-work-contract-20y.json` | `zeroLaborContractFixturesAudit.mjs` (`--out-natural-20`) |
| `shared-use-physical-presence-authority-34/natural-target-work-contract-50y.json` | `zeroLaborContractFixturesAudit.mjs` (`--out-natural-50`) |

**Cause.** The flag enumeration used a single-line pattern (`arg("out"`). The first two scripts
declare `--out` across **multiple lines**, so the primary output flag was missed while the secondary
one was correctly redirected. The third declares two natural-horizon outputs that the pattern did
not match at all.

**Response.** The run was stopped. All four files were restored with `git checkout` **before any
commit**. `git status` and `git diff` over `docs/evidence/` are both empty, so the restoration is
byte-exact against the committed version. Every affected audit was rerun with **every** flag
redirected into `artifacts/`, and the frozen directories were re-verified clean afterwards.

**No frozen-evidence commit exists.** This is the same trap CORRECTION-32A and CORRECTION-34D each
recorded once; it is recorded a third time rather than treated as solved.

---

## Deliberate non-regeneration

The Item 3 final-freeze evidence directory is **not** regenerated. Its report stays checkable
against its own numbers. Where CORRECTION-35 moves one of them — the incident's true magnitude — the
movement is recorded in `ITEM_3_INCIDENT_CORRECTION.md` as a superseding addendum, not by
overwriting history.
