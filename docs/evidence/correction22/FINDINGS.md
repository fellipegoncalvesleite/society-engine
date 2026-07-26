# CORRECTION-22 — Findings

**Verdict: PROGRESS — NOT ACCEPTED / DO NOT MERGE.**

The diagnosis is complete and the missing mechanism is precisely identified. **No production
behaviour was changed** beyond adding one audit-only switch. The verification pathway §11
authorises was **not implemented**.

---

## 1. Ancestry and authorship

```text
dc86469 → f56735e → 97561a9 → 03c5caa → 21aa9ab → 6eec641 → … → 668763f
```

The spec's expected chain lists `dc86469 → f56735e → 21aa9ab`; the actual chain contains two
additional commits of mine from the CORRECTION-21 continuation (`97561a9` place-evidence read
model, `03c5caa` water/aquatic coarsening). All present, all verified.

`main` untouched at `668763f`. Every new commit `fellipegoncalvesleite`, **zero
`Co-Authored-By` trailers**. One **inherited** violation: `d41c973` carries author and
committer name `Claude`; reported, not rewritten.

## 2. The obvious hypothesis is REFUTED (§7/§8)

The natural explanation for the tier loss — that coarsening made every frontier destination
look identical or uniformly mediocre — **does not hold**. Measured across 60 sampled
candidates at the reader seam:

```text
distinct TRUTH richness values           59
distinct SHALLOW observed values           4      <- heavy quantization, as designed
distinct SHALLOW effective yields          7
distinct RESIDENTIAL effective yields     29

rank concordance shallow vs truth      0.856
rank concordance residential vs truth  0.947

poorest tile   truth 0.052   shallow yield 0.03   residential yield 0.04
richest tile   truth 0.794   shallow yield 0.38   residential yield 0.46
signal retention (rich-vs-poor gap)     83%
mean shallow / residential yield ratio  0.951
```

**Promising remains distinguishable from poor.** The ordering largely survives quantization,
and shallow yields sit only ~5% below residential. The tier is not dying because the gradient
was destroyed.

## 3. No single repair component explains the loss (§6)

An audit-only `shallowObservationRestore` switch (typed through `WorldAuditOptions`, not
`process.env`, so `src/sim` stays pure) turns one component back off at a time. On a
marginal-escapable analogue, five seeds each:

```text
restore=none        survived 0/5      (full repair)
restore=richness    survived 0/5
restore=water       survived 0/5
restore=seasonal    survived 0/5
restore=storage     survived 0/5
restore=confidence  survived 0/5
restore=all         survived 2/5      (fully pre-repair)
```

**No single component restores survival; only restoring all of them together does.** The
effect is a *conjunction*. There is no one-field fix and no single coefficient to blame — the
marginal band was relying on the entire ecological picture being handed to it for free.

### The mandatory ten-seed reproduction (§5)

Both arms, real tier construction, ten predeclared shared seeds:

```text
                        survival   median pop   median bands
6eec641 pre-repair          0.7         78          2.5
dc86469 post-repair         0.0          0          0
```

**7/10 → 0/10.** The regression is fully reproduced at the ten-seed scale required by
acceptance gate 5, and it is unambiguous: not one seed survives after the repair.

## 4. The actual missing mechanism (§10) — and it is not a coefficient

§10 asks whether the simulator already has an activity that can answer:

> *"This country looks potentially better. Is it actually usable?"*

**It does not.** Every existing investigation selector reads
`resourceKnowledgeState.patchMemories` — remembered *resource patches*:

| Activity | Selects from | Can target a shallow terrain record? |
| --- | --- | --- |
| `distant_plant_gathering` / `hunting` / `fishing` | patch memories | no |
| `distant_patch_verification` | patch memories | **no** — verifies a remembered *patch* |
| `route_reconnaissance` | patch memories + prior failed targets | no |
| `frontier_exploration` | a band-known *heading* | no — walks a direction, targets no place |

Shallow frontier knowledge lives in `knowledge.observedTiles`. **Nothing in the simulator
bridges `observedTiles` → targeted investigation → domain-specific upgrade.** A band can
discover that country exists and roughly what it looks like, and then has no way to go back
and find out whether it is actually usable.

That is the missing link the checkpoint set out to find, and it is a structural gap rather
than a tuning error. It also explains §3: the repair did not break a mechanism, it removed
free information that was standing in for a mechanism that was never built.

## 5. What was NOT done

**The `frontier_verification` pathway §11 authorises was not implemented.** Neither were the
A1–A12 controlled cases, the M0–M5 default-map matrix, the ten-seed acceptance matrix, the
temporary-use connection (§13), the UI states for verification (§19), or most of §21.

This is a deliberate stop, not an oversight. Implementing a new physical task family
properly requires a trigger, target selection from band-known uncertainty, a party, a route,
labour and provision accounting, risk, failure modes, domain-specific knowledge output, and
its own acceptance matrix. A half-built version would be worse than none — and this project
has repeatedly had to retract exactly that kind of speculative half-measure. The diagnosis is
what this checkpoint could complete honestly.

## 6. Retained from CORRECTION-21

Zero unsupported hidden-truth copies; coarsened shallow observations; no seasonal calendar
from one visit; route/passability evidence intact; repeat-traversal confidence growth;
residential upgrade always wins; no food from observation; lost parties transfer nothing.
**None of this was reverted**, and restoring hidden truth to rescue the tier was never
considered — §24 classifies that as FAIL.

## 7. First remaining blocker

```text
No activity can convert a shallow terrain record into tested, domain-specific evidence.
Until one exists, a pressured band can see that better country might be out there and has
no physical means of finding out.
```

## 8. Merge recommendation

```text
PROGRESS — NOT ACCEPTED / DO NOT MERGE
```
