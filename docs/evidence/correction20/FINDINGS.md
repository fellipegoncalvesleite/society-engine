# CORRECTION-20 — Findings

**Verdict: PROGRESS — NOT ACCEPTED / DO NOT MERGE.**

This checkpoint delivered the §8 semantic contracts, the §9 distance term ledger, and the
§6 reader-isolation instrumentation. The two mandatory measurement runs (§5 cross-seed
completion and §6 arm matrix) were **still executing when this report was written** and
their results are recorded as pending, not inferred. No production behaviour was changed.

---

## 1. §2 — Ancestry and authorship

Verified exactly as specified:

```text
4d20c98 → 4cbf360 → 8504b76 → 8c9ef15 → 4b1f363 → b4dec95 → febbdc2 → 1faa7c9 → d41c973 → 668763f
```

`main` is exactly `668763f`. Branch `checkpoint/frontier-opportunity-fission-closure-20`
created from `4d20c98`.

**Authorship, separated as §2.7 requires:**

- **New commits (`febbdc2..HEAD`, six commits):** all
  `fellipegoncalvesleite <fellipe.16@aluno.cefetmg.br>`, author and committer. **Zero**
  `Co-Authored-By` trailers. The single keyword hit in a commit message is the filename
  `CLAUDE.md`, not an attribution.
- **Inherited violation (one):** `d41c973` (CORRECTION-15) carries author *and committer*
  name `Claude` plus a `Co-Authored-By: Claude Opus 5` trailer. `1faa7c9` (CORRECTION-16)
  carries the trailer. Both predate this rule.

Per §1's amendment, inherited history is **reported, not rewritten**.

## 2. §8 — The five semantic contracts

Documented here as the reference the code should be measured against. **These are
specifications, not implemented types** — production still blends several of them into one
score, which is the defect class this checkpoint exists to characterise.

### 8.1 Physical feasibility — *can a subgroup get there and be supplied?*
Inputs: passability, known route existence, route length, crossing feasibility, a
safe relocation path, water access en route and at the destination, acute risk.
**Output type: boolean-ish feasibility. Never a preference weight.**
Current production: route construction only; no scored penalty. Distance does **not**
appear here as a score. This contract is effectively honoured.

### 8.2 Epistemic adequacy — *does the band know enough to act?*
Inputs: provenance (direct vs traversed vs inferred), confidence, seasonal coverage,
route confidence, water confidence, observed risk.
**Output type: confidence / uncertainty. Never physical richness.**
Current production: `confidence = clamp01(record.confidence * 0.8 + 0.1)` and a
`low_confidence` rejection reason. The §8 typed provenance
(`KnowledgeAcquisitionKind`) exists but is **not yet read** by the adequacy test — a
tile traversed once by two people and a tile the band has worked for seasons are
treated identically. Recorded as debt.

### 8.3 Daughter ecological viability — *could the daughter maintain itself there?*
Required outputs: `projectedDaughterUsableSupport`, `projectedDaughterDemand`,
`projectedDaughterSupportRatio`, `supportConfidence`, `viableAtMaintenance`.
Current production: **violates this contract.** `consideredAsTarget` compares a
normalized per-tile yield fraction against the parent's realized catchment support
ratio (CORRECTION-18 established the units are incommensurable, candidate side
understated ~5–6×), and it does so as a *parent-superiority* test rather than a
daughter-maintenance test. Not repaired here — §17 requires counterfactual isolation
first, and §12's projection model was not built.

### 8.4 Split motivation — *why should a viable subgroup leave?*
Inputs: population scale, crowding, shared-catchment pressure, sustained range
saturation, chronic return decline, existing internal fission pressure, and the
*existence* of a known viable alternative.
**Must not be synonymous with destination quality.**
Current production: `daughterColonization.pressure` mixes genuine parent-side terms
(saturation, per-capita stress, shared saturation) with destination-derived terms
(`opportunityScore`, `travelRiskPenalty`). See the ledger below — this is where the
contract is most clearly breached.

### 8.5 Destination preference — *among feasible, viable options, which is better?*
Inputs: support margin, uncertainty, water, risk, distance, non-overlap, route
familiarity, inherited familiarity.
Current production: implemented twice, in two subsystems with different
normalizations (`deriveKnownUnusedHabitat` score, and `scoreFissionTarget`).

## 3. §9 — Distance term ledger

Full machine-readable form: `distance-term-ledger.json`. Five distance-derived terms reach
the decision:

| Term | Site | Role | Verdict |
| --- | --- | --- | --- |
| T1 `travelCost` | `deriveKnownUnusedHabitat` | destination preference | legitimate |
| T2 `travelRiskPenalty` | `deriveDaughterColonization` | **split motivation** | **suspected duplication** |
| T3 `distancePenalty` | `scoreFissionTarget` | destination preference (different subsystem) | distinct formula, not a defect |
| T4 `parentCoreProximityPenalty` | `scoreFissionTarget` | non-overlap (opposite sign) | legitimate, conceptually distinct |
| T5 `travelCost` | catchment support | parent's own foraging accessibility | unrelated; shares a name only |

**The finding, stated with the caution §9 demands.** T2 has *no physical quantity of its
own*: it reads `input.opportunity.travelCost` — the exact normalized number T1 already used
to discount that destination — and applies it to a different conceptual stage. Maximum
motivation swing is 0.10 against `SPLIT_PRESSURE_THRESHOLD = 0.64`.

That is the pattern §9 describes as likely-invalid. **It is not declared proven.** §9
forbids calling it double-counting without demonstrating mediation, and the D0–D5
counterfactual arms that would demonstrate it were **not run**. T3 is explicitly *not*
counted as duplication: it uses a different normalization (zero inside 8 tiles, saturating
at 26, versus saturating at 12) over a different candidate set in a different authority,
and §9 permits distance to affect both feasibility and preference.

## 4. §6 — Reader-isolation instrumentation (built; measurement pending)

Two audit-only seams added, both undefined in every normal world:

```text
carryingCapacity.collectOpportunityCandidates   hideFrontierDerived
demography.getFissionTargetRecordIds            hideFrontierDerived
```

They drop tiles whose §8 provenance is `returned_frontier_exploration` from the opportunity
and fission path only, leaving movement, resource selection, camps and seasonal rounds
reading them normally. With the inherited `frontierKnowledgeTransferDisabled` this gives the
§6 decomposition:

```text
D - C = fission-only contribution
D - A = total knowledge contribution
C - A = non-fission contribution
```

**Status: the 40-run arm matrix (2 maps × 5 seeds × 4 arms × 300 years) was still executing
when this report was written.** Results are not stated because they are not yet known. This
is the experiment §6 calls mandatory and it is the only thing that can explain map 2, whose
band count is unchanged while its population per band falls.

## 5. §5 — Cross-seed completion (pending)

The CORRECTION-19 waterfall (20 runs, 5 seeds × 2 maps × enabled/disabled) was also still
executing. Partial results available at write time, map 1 only:

```text
map1 c18:a  ON pop 204 bands 7  pop/band 29.14  food/AY 0.0050  support 0.3019  fis 2 @ y102
            OFF pop 265 bands 10 pop/band 26.50 food/AY 0.0049  support 0.2686  fis 5 @ y80
map1 c18:b  ON pop 206 bands 8  pop/band 25.75  food/AY 0.0039  support 0.2209  fis 3 @ y70
            OFF pop 217 bands 8  pop/band 27.13 food/AY 0.0050  support 0.2420  fis 3 @ y78
```

Seed `c18:a` is first-fission-delay dominated (y102 vs y80, 2 vs 5 fissions, bands larger
and better supported). Seed `c18:b` shows equal band counts and equal fission counts with a
lower per-band population — a different mechanism on the same map. **Two seeds on one map
already disagree**, which is itself a result: the §5 per-seed classification cannot be
collapsed to one mechanism per map, let alone one overall.

## 6. What was NOT done

- §5 and §6 measurement runs incomplete at write time.
- §7 full fission-pipeline waterfall (candidate → pressure → actual fission) not built.
- §10 D0–D5 distance counterfactuals **not run** — so the T1→T2 duplication stays suspected.
- §11 parent-superiority cases P1–P6 not built.
- §12 candidate-viability projection model not implemented.
- §14 final fission-gate consumer audit not built.
- §15/§16 map-specific decompositions not completed.
- §18 controlled expansion matrix, §20 long runs, §21 performance, most of §22 not run.
- **No production repair was made**, which is correct: §17 permits one only after
  counterfactual isolation, and no counterfactual was completed.

## 7. Retractions and corrections carried forward

- CORRECTION-18's "the blocker is ecological" is **withdrawn** (superseded by its own
  candidate-ledger evidence).
- CORRECTION-19's inherited framing that expedition labour caused the regression is
  **withdrawn**: labour accounting is singular and ~0.12% of working-adult days, and
  exploring bands are equally or better fed.
- This checkpoint adds no claim that distance is double-counted. It records the suspicion
  with the exact mediation that would prove it.

## 8. First remaining blocker

```text
The T1 -> T2 mediation is unproven, and the §6 arm matrix that would separate the
fission and non-fission halves of the knowledge effect had not finished.
```

Both are measurement, not design: the instrumentation for each now exists.

## 9. Merge recommendation

```text
PROGRESS — NOT ACCEPTED / DO NOT MERGE
```
