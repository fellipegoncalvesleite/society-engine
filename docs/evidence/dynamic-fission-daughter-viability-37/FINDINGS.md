# Roadmap Item 4 — findings

**Branch** `checkpoint/dynamic-fission-daughter-viability-37`, from the Item 3 final freeze audit
head `ef76971bd66a7413313183349b9468a879405970`.

**AUDIT AND ARCHITECTURE ONLY — `git diff ef76971..HEAD -- src/` is empty.**

**Verdict: PROGRESS. Roadmap Item 4 remains active.**

---

## 1. What fission does today

Measured over 200 simulated years on two seeds, before anything was changed. Two fissions occurred
naturally.

> **CURRENT FISSION CREATES A PERMANENT DAUGHTER SEVEN TILES AWAY IN A SINGLE DAY, WITH NO JOURNEY,
> NO ESTABLISHMENT AND NO POSSIBILITY OF FAILURE — AND THE SPLIT MANUFACTURES DEPENDENTS WHILE
> DESTROYING WORKING ADULTS AND ELDERS ON BOTH SIDES.**

Six defects, each measured:

| # | Defect | Measurement |
|---|---|---|
| 1 | instantaneous — no proposal, commitment, preparation or journey | no fission-specific attempt state exists in `Band` |
| 2 | **the daughter teleports** | both daughters appeared 5 and 7 tiles from their parent; 0 co-resident |
| 3 | **cohorts are re-derived, not allocated** | conserved in **0 of 2** on all three counts; dependents **+4 and +3**, working adults **−1 and −2**, elders **−2 and −1**; every daughter has the identical `0.3333` / `0.1111` structure |
| 4 | viability is one inequality | only `daughterPopulation ≥ DAUGHTER_MIN_POPULATION`; no parent residual test, no successor test |
| 5 | failure is impossible | 2 of 2 daughters are ordinary bands immediately and permanently |
| 6 | the event's conservation flag is a restatement | both events report `conserved: true`; one of them created a person (world 197 → 198) |

**Defect 3 is the one most likely to be missed.** A band that has just aged badly splits into two
groups *both* of which look healthy. The split launders composition — and it does not merely
redistribute, it **manufactures dependents from nothing**.

## 2. Was that credible?

No, in five of six respects. People appeared five to seven tiles away without walking; a group's
age structure was rewritten by the act of separating; nobody could ever try to leave and fail; and
the record that was supposed to prove nobody was created reported success while a person was
created.

The parts that *were* credible are named and preserved: founder availability genuinely excludes
away and prepared people and blocks rather than borrowing (CORRECTION-34C/-34D); destination
selection genuinely reads only band-known tiles; knowledge inheritance is genuinely partial —
13.4% and 14.8% of the parent's observed tiles, 0 clones, with a clone guard.

## 3. Research constraints

`RESEARCH_CONSTRAINTS.md`. Fission–fusion is ordinary and multi-causal; there is **no** universal
band size and **no** universal threshold; a departing group is constrained by *composition* rather
than headcount; departures fail and end in **reintegration** rather than death; knowledge bounds
destination. Seven encodings are explicitly forbidden, including Dunbar's number, one optimal band
size, one inevitable threshold, and any sex-ratio rule — this simulator has no sex composition at
all, and inventing one remains a separate prerequisite.

## 4–5. Architecture

Four directions compared in `ARCHITECTURE_DECISION.md`. **Direction D selected**: a reversible
attempt on the parent that holds no bodies, resolving at a single departure event into a
**provisional successor** that must travel, establish, and then either stabilize or return.

Direction C — the smallest diff, a bounded extension of `createDaughterBand` — was **rejected**
because it cannot fix defects 1, 2 or 5: creation stays instantaneous, the daughter still appears
at the target, and "post-creation stabilization" on an already-ordinary band is a label rather than
a state. It would produce the decorative state §3.2 forbids.

Direction D was chosen because it is the smallest architecture that is *causally truthful about all
six defects* — not because it changes the fewest files.

## 6–18. The remaining questions

Proposal causes, support and opposition without fake households, founder availability, parent
residual viability, destination and route authority, physical departure, material support,
knowledge inheritance, provisional behaviour, early viability, abandonment and return,
stabilization, and the Item 6 boundary are **designed** in `ARCHITECTURE_DECISION.md` §3 and **not
implemented**.

## 19–21. Fixtures, natural occurrence, divergence

**Not run.** F1–F26 require the implementation they would test. The before-audit does establish that
a natural arm is feasible: **2 fissions in 400 simulated band-years**, so ordinary ecology and
demography do reach the system without injection.

## 22. Limitations

**The implementation is not started, and that is the finding of this checkpoint rather than a
shortfall hidden inside it.** Direction D is one coherent change — attempt state, provisional
lifecycle, cohort allocation, physical departure, establishment window, and the audit of every
reader that would see a provisional band — and this repository requires 26 fixtures, three natural
horizons on multiple seeds, four-way and fresh-process determinism over a span containing a real
attempt, and the full Item 3 regression before a change of that size is credible.

Shipping half would leave the half-state `CLAUDE.md` §18 forbids: an attempt nothing resolves, or a
provisional band every other system already treats as ordinary. Either would be worse than the
measured defect, because it would look finished.

**One instrument error is recorded**: `daughterHasProvisionalState` first matched pre-existing
unrelated keys and reported `true` for every daughter — it would have claimed the very state whose
absence is this audit's central finding. Corrected and re-run.

## 23–25. Realism, performance, regression

`REALISM_CHECKLIST.md` scores the **current** system, which is what exists. No performance or state
measurement was taken because no state was added. The Item 3 regression was not re-run: no
production file changed, so there is nothing for it to regress against — and accepted evidence was
hashed before and after and is unchanged.

## 26. What Browser GPT must decide

Whether to authorise the Direction D implementation as its own checkpoint, on this branch, from
this measured baseline — or to redirect the architecture before any code is written.

**Roadmap Item 5 was not started and was not prepared.**
