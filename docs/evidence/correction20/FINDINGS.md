# CORRECTION-20 — Findings

**Verdict: PROGRESS — NOT ACCEPTED / DO NOT MERGE.**

This checkpoint delivered the §8 semantic contracts, the §9 distance term ledger, the §6
reader-isolation instrumentation, and the **completed §5 cross-seed decomposition**. The §6
arm matrix **completed on both maps** and **overturned the leading hypothesis**: both maps
are NON_FISSION_DOMINATED. **No production behaviour was changed.**

The headline result is that the two default maps are driven by quantitatively different
mechanisms — map 1 is **88.8% descendant amplification**, map 2 is **95.7% direct
within-band effect** — and that a claim I made in the previous checkpoint from a single
seed does not survive the full seed set (see §5b).

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

## 4. §6 — Reader isolation: COMPLETE on both maps, and it overturns the leading hypothesis

Two audit-only seams (`collectOpportunityCandidates`, `getFissionTargetRecordIds`) drop
tiles whose §8 provenance is `returned_frontier_exploration` from the opportunity and
fission path only, leaving movement, resource selection, camps and seasonal rounds reading
them normally. Both options are undefined in every normal world.

**map 1, all five seeds, four arms:**

```text
arm                          pop     bands  pop/band  fissions  1st fission  support
ARM_0 exploration disabled  244.6     8.8    27.748      3.8       y79.8      0.254
ARM_A no transfer           241.6     8.6    28.332      3.6       y67.6      0.273
ARM_C hidden from fission   181.4     7.2    25.138      2.2       y97.0      0.239
ARM_D production            188.4     7.0    27.082      2.0      y107.6      0.253

fission-only  (D - C) =  +7.0     POSITIVE
non-fission   (C - A) = -60.2     DOMINANT
total         (D - A) = -53.2
```

**Two results, both decisive.**

**(1) The fission path is not the culprit — it is mildly beneficial.** Letting frontier
knowledge reach opportunity evaluation and fission target selection is worth **+7.0**
population, not a loss. This directly contradicts the leading hypothesis carried in from
CORRECTION-18 and restated in §3 above: the suspected T1→T2 distance duplication in split
motivation predicted the fission path would be where the damage occurs. It is not. The
structural duplication in the ledger remains real as a *contract* violation, but **it is
not the mechanism for map 1's population loss.**

**(2) The damage is done by the NON-FISSION readers, and it is large.** Frontier knowledge
reaching movement, resource selection, camp and seasonal-round systems costs **−60.2**
population. ARM_A (the party physically walks, commits workers, eats provisions, but
transfers nothing) sits at 241.6 against a disabled control of 244.6 — statistically
indistinguishable, with *better* support (0.273 vs 0.254) and an *earlier* first fission
(y67.6 vs y79.8). So the physical expedition is close to free, exactly as CORRECTION-19
concluded, and confirmed here on the full five-seed set. **Everything harmful happens when
that knowledge is read by ordinary residential behaviour.**

This connects directly to the §8.2 gap documented above: the typed provenance
`KnowledgeAcquisitionKind` exists but **is not read by any adequacy test**. A tile crossed
once by two people carries the same confidence as country the band has worked for seasons,
and it enters movement targeting, resource selection and camp/anchor systems on that basis.
That is now the leading, evidence-backed mechanism — and it is a *different defect* from the
one this checkpoint set out expecting to find.

**map 2, all five seeds, four arms — the same answer:**

```text
arm                          pop     bands  pop/band  fissions
ARM_0 exploration disabled  226.0    11.0    20.546      2.0
ARM_A no transfer           231.6    11.2    20.680      2.2
ARM_C hidden from fission   201.2    11.0    18.360      2.0
ARM_D production            196.4    11.0    17.970      2.0

fission-only  (D - C) =  -4.8
non-fission   (C - A) = -30.4     DOMINANT
total         (D - A) = -35.2
```

**Both maps classify as NON_FISSION_DOMINATED.** §16 required map 2 to be traced separately
rather than assumed to match map 1; it was, and it reaches the same conclusion by its own
evidence. On map 2 the fission contribution is a small negative (-4.8) rather than map 1's
small positive (+7.0), but on neither map is it the mechanism.

**ARM_A beats or matches the disabled control on both maps** — 241.6 vs 244.6 on map 1, and
**231.6 vs 226.0 on map 2**, i.e. physically exploring while transferring nothing is
*better* than not exploring at all there. Band counts under ARM_A also return to the
disabled level (8.6 vs 8.8 on map 1; 11.2 vs 11.0 on map 2). The expedition itself is not
merely cheap, it is close to costless, across both maps and all ten seeds.

### How this reconciles with the §5 decomposition

§5 found map 1 is 88.8% *amplification* (fewer bands) and map 2 is 95.7% *direct* (smaller
bands). §6 finds both are caused by *non-fission readers*. These answer different questions
and are consistent: §5 describes **where the population difference materialises**, §6
describes **which reader causes it**. On map 1, hiding knowledge from fission does not
restore the band count (7.2 under ARM_C vs 7.0 production, against 8.8 disabled) — but
withholding transfer entirely does (8.6). So the band-count loss is produced upstream, by
the non-fission readers, and only *shows up* as missing daughters.

## 5. §5 — Cross-seed completion: COMPLETE, and the two maps differ quantitatively

All 20 runs finished (5 seeds x 2 maps x enabled/disabled, 300 years).

```text
map1   population       ON 188.4   OFF 244.6   (-22.98%)
       bands            ON 7.0     OFF 8.8
       pop / band       ON 27.082  OFF 27.748  (-2.4%)
       raw support      ON 0.2529  OFF 0.2537  (-0.33%)
       fissions         ON 2.0     OFF 3.8     first @ y107.6 vs y79.8
       DECOMPOSITION    gap 56.2 = amplification 49.92 (88.8%) + direct 6.28 (11.2%)

map2   population       ON 196.4   OFF 226.0   (-13.10%)
       bands            ON 11.0    OFF 11.0    (IDENTICAL)
       pop / band       ON 17.970  OFF 20.546  (-12.54%)
       raw support      ON 0.1487  OFF 0.1636  (-9.09%)
       fissions         ON 2.0     OFF 2.0     first @ y151.4 vs y110.4
       DECOMPOSITION    gap 29.6 = amplification 1.27 (4.3%) + direct 28.33 (95.7%)
```

**map1 is 88.8% descendant amplification.** Bands are the same size (-2.4%) and equally
well supported (-0.33%); there are simply fewer of them, and the first fission arrives 28
years late.

**map2 is 95.7% direct within-band effect.** Band count and fission count are identical,
but every band is 12.5% smaller and 9.1% worse supported. Amplification explains almost
nothing there.

Expedition labour is 0.39% (map1) and 0.28% (map2) of working-adult days, and the
terminal-phase labour leak is **0** on both maps — confirming CORRECTION-19's accounting
result on the full seed set.

**First fission is delayed on BOTH maps** — +27.8 years on map1, +41.0 years on map2 — even
where the eventual fission count is unchanged. That is the one signal common to both, and
it is consistent with the T1→T2 split-motivation suspicion, though still not proof.

### Per-seed classification (§5)

| map1 seed | mechanism |
| --- | --- |
| `c18:a` | first-fission delay + missing daughters (2@y102 vs 5@y80; bands larger, better supported) |
| `c18:b` | within-band (equal bands and fissions; pop/band 25.75 vs 27.13) |
| `c18:c` | missing daughters (1@y156 vs 4@y54) — the most extreme delay measured |
| `c18:d` | mixed — both fewer bands AND much lower pop/band (19.71 vs 30.78) |
| `c18:e` | fission-count only; pop/band HIGHER with exploration (29.14 vs 25.0), population effectively equal (204 vs 200) |

| map2 seed | mechanism |
| --- | --- |
| `c18:a` | within-band (11/11 bands, 2/2 fissions, support 0.1397 vs 0.1713) |
| `c18:b` | within-band despite MORE bands and MORE fissions with exploration (12/11, 3/2) |
| `c18:c` | within-band, mild; fission slightly EARLIER with exploration (y94 vs y99) |
| `c18:d` | within-band; support essentially equal (0.1585 vs 0.1571) yet pop/band lower |
| `c18:e` | mixed; support HIGHER with exploration (0.1538 vs 0.1360) yet population lower |

**Seeds disagree within each map.** `c18:e` on map1 shows essentially no population effect
and larger bands; `c18:b` on map2 shows more bands and more fissions with exploration
enabled. No single mechanism describes either map, which is exactly why §5 requires
per-seed classification rather than a per-map verdict.

## 5b. CORRECTION to my earlier single-seed claim

My CORRECTION-19 report stated, from map1 seed `c18:a` alone, that "exploring bands are
better fed — raw support ratio +12.4%". **That does not survive the full seed set and is
withdrawn.** Across five seeds:

```text
map1 support ratio  ON 0.2529  OFF 0.2537   -0.33%   (essentially identical)
map2 support ratio  ON 0.1487  OFF 0.1636   -9.09%   (meaningfully WORSE)
```

`c18:a` was the most favourable seed on the most favourable map. Generalizing it was
precisely the single-seed over-reach §5 exists to prevent, and I made it. The corrected
statement is: **exploration leaves support unchanged on map1 and degrades it ~9% on map2.**

The parts of the CORRECTION-19 conclusion that DO survive: labour accounting is singular
(leak 0 across all seeds), expedition person-days are well under half a percent of
working-adult time, and the map1 gap is overwhelmingly amplification rather than
subsistence.

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
