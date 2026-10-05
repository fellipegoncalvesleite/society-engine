# CORRECTION-23I — Reader-aligned verification closure

Branch `checkpoint/physical-frontier-verification-23`, from `dc08b2d`. `main` untouched.
Production behaviour intentionally changes relative to `dc08b2d`.

## What the closure does

Every production verification launch now requires a typed decision dependency: a specific
unresolved question, a concrete pending or blocked physical action, an authoritative reader,
and one possible answer that changes that action within one season. A place being interesting,
uncertain, distant or highly ranked is not a reason to spend two people and a week of walking.

Three questions are suspended because nothing physical reads them:
`resource_presence` (its only consumer is the selector's own `resource_test_possible` gate,
which terminates in nothing), `resource_test_possible` (no production function distinguishes
confirmed from negative), `seasonal_persistence` (no reader; returns inconclusive by
construction). Types and physical resolvers are retained, dormant. `temporary_use` is RETAINED
and gated, because §7.1's trace measured it preventing **10,724 of 59,286 actually attempted**
camps — attempts counted only where every physical precondition already passed.

## Launch counts

| question | 40 y before | 40 y after | 200 y before | 200 y after |
| --- | --- | --- | --- | --- |
| `water_access` | 7,274 | **99** | 27,162 | **161** |
| `resource_presence` | 23,070 | **0** | 75,293 | **0** |
| `resource_test_possible` | 6,008 | **0** | 17,962 | **0** |
| `temporary_use` | 11,769 | **1,185** | 40,354 | **1,855** |
| `seasonal_persistence` | 9,458 | **0** | 26,307 | **0** |
| **total** | **57,579** | **1,284** (−97.8%) | 187,078 | **2,016** (−98.9%) |

## The consequence, traced and not tuned away

At 40 years the effect is small and mixed. At 200 years it is material and mostly negative,
and the chain is identical on every harmed world:

```
launch suspension → total parties collapse → unique tiles known collapse
→ physical receipts collapse → support → births and deaths → population
```

| world (200 y) | survival | population | unique tiles | receipts | support |
| --- | --- | --- | --- | --- | --- |
| ordinary | 0.60 → **0.00** | 5.4 → **0.0** | 169 → 132 | 48.8 → 37.7 | 0.479 → 0.429 |
| site_A_coast | 0.60 → 0.20 | 17.6 → 3.6 | 271 → 153 | 152.2 → **39.5** | 0.883 → **0.248** |
| isolated_marginal | 0.80 → 0.60 | 14.2 → 6.8 | 600 → 499 | 85.8 → 59.0 | 0.678 → 0.592 |
| site_D_aquatic | 0.80 → 0.60 | 10.4 → 6.6 | 73 → 51 | 81.3 → 69.1 | 0.613 → 0.557 |
| map1 | 1.00 → 1.00 | 220.2 → 210.6 | 1109 → 999 | 1615 → 1568 | 1.231 → 1.217 |
| map2 | 1.00 → 1.00 | 206.6 → 200.2 | — | — | — |
| site_F_hills | 1.00 → 1.00 | 29.4 → **32.4** | — | — | — |

**The ordinary tier goes extinct**: 3 of 5 seeds survived at `dc08b2d`, 0 of 5 survive now.

**Broad exploration did not compensate.** It launches slightly LESS, not more: ordinary
53.4 → 46.0, site_A 45.4 → 34.0, isolated 54.8 → 53.8. The ordinary exploration family remains
independently operational (I11) but it does not expand to fill the gap.

This is the CORRECTION-23F prediction arriving: verification travel was supplying known-country
breadth that nothing else supplies. Removing the inert questions is correct — they answered
nothing — but the simulation was structurally leaning on them for exploration. Per §10 and §16
this is reported, not tuned away, and no inert launch is restored to recover the old numbers.

500-year bounded-state check on the default maps is healthy: map1 250.4, map2 240.8, survival
1.00 both, launches bounded at 178 water and 1,881 temporary-use.

## Honest measurement caveats

* `campsAttempted` reads 0 in every `dc08b2d` row because the counter is NEW instrumentation,
  not because camps were absent. Only the after-side camp counts are meaningful.
* The freed-labour mechanism (fewer committed away-workers) is INFERRED. The rows carry no
  labour data; only the known-country → receipts link is measured directly.
