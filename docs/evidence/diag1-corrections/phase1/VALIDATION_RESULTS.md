# Phase 1 validation results

Production commit: 9268d211e7d370911d3d8fd875429db4d4d06741. Tests below match the final production source bytes. Earlier failed/intermediate files remain preserved.

| Check | Exit | Seconds | Command evidence |
|---|---:|---:|---|
| Core conservation | 0 | 41.2 | [stabilized/commands.json](stabilized/commands.json) |
| Recovery food accounting | 0 | 335.4 | [stabilized/commands.json](stabilized/commands.json) |
| Numeric resource chain | 0 | 127.4 | [stabilized/commands.json](stabilized/commands.json) |
| Natural s1 observer on | 0 | 30.5 | [stabilized/commands.json](stabilized/commands.json) |
| Natural s2 observer on | 0 | 32.0 | [stabilized/commands.json](stabilized/commands.json) |
| Both TypeScript projects and production build | 0 | 16.3 | [stabilized/commands.json](stabilized/commands.json) |
| Import boundary | 0 | 0.3 | [stabilized/commands.json](stabilized/commands.json) |
| Architecture graph | 0 | 0.7 | [stabilized/commands.json](stabilized/commands.json) |
| Old mechanism mutant: cargo | 1 | 39.7 | [stabilized/commands.json](stabilized/commands.json) |
| Old mechanism mutant: absorption | 1 | 0.7 | [stabilized/commands.json](stabilized/commands.json) |
| Old mechanism mutant: cache | 1 | 2.0 | [stabilized/commands.json](stabilized/commands.json) |
| Old mechanism mutant: labor | 1 | 7.4 | [stabilized/commands.json](stabilized/commands.json) |
| provenance-final | 0 | 0.6 | [regression-repaired/provenance-final-command.json](regression-repaired/provenance-final-command.json) |
| living-stable | 0 | 12.0 | [regression-repaired/living-stable-command.json](regression-repaired/living-stable-command.json) |
| headcount-stable | 0 | 621.0 | [regression-repaired/headcount-stable-command.json](regression-repaired/headcount-stable-command.json) |
| fission-stable | 0 | 76.5 | [regression-repaired/fission-stable-command.json](regression-repaired/fission-stable-command.json) |
| away | 0 | 286.3 | [regression-repaired/away-command.json](regression-repaired/away-command.json) |
| target-labor | 0 | 39.5 | [regression-repaired/target-labor-command.json](regression-repaired/target-labor-command.json) |
| acute-risk | 0 | 549.6 | [regression-repaired/acute-risk-command.json](regression-repaired/acute-risk-command.json) |
| lifecycle | 0 | 1761.9 | [regression-repaired/lifecycle-command.json](regression-repaired/lifecycle-command.json) |
| item3-repaired | 0 | 216.6 | [regression-repaired/item3-repaired-command.json](regression-repaired/item3-repaired-command.json) |
| determinism-map2-isolated | 0 | 218.6 | [regression-repaired/determinism-map2-isolated-command.json](regression-repaired/determinism-map2-isolated-command.json) |
| natural-observer-off-s1 | 0 | 28.0 | [regression-repaired/natural-observer-off-s1-command.json](regression-repaired/natural-observer-off-s1-command.json) |
| natural-observer-off-s2 | 0 | 25.7 | [regression-repaired/natural-observer-off-s2-command.json](regression-repaired/natural-observer-off-s2-command.json) |
| presence | 0 | 101.9 | [regression-final/commands.json](regression-final/commands.json) |
| reader-admission | 0 | 84.8 | [regression-final/commands.json](regression-final/commands.json) |
| reader-semantic | 0 | 0.2 | [regression-final/commands.json](regression-final/commands.json) |
| reintegration | 0 | 87.8 | [regression-final/commands.json](regression-final/commands.json) |
| target-resolution | 0 | 230.7 | [regression-final/commands.json](regression-final/commands.json) |
| Mixed-map full-state stress matrix | 1 | 1219.9 | [regression-repaired/determinism-stable-command.json](regression-repaired/determinism-stable-command.json) |

Four mutant exit1 results are expected detected failures. Core62/62 plus expanded provenance10/10 (seven overlap) pass. Both maps compare the entire serialized world across daily/weekly/monthly/seasonal/repeat/fresh processes over1260days; all six digests agree within each separately controlled map. The default mixed-map same-process stress test remains FAIL and is retained; see DETERMINISM_SCOPE.json.

## Residuals and coverage

The mixed-map seasonal-memo defect, knowledge-choice expectation and Item4 fixed-history-fixture refusal reproduce on exact base and remain unresolved. Presence natural terminal/concurrent cases, zero natural acute sightings and14 inconclusive reader-admission observations are explicit limits. See [phase report](PHASE1_REPORT.md) and [machine-readable results](VALIDATION_RESULTS.json). No whole-game or historical-freeze acceptance is claimed.
