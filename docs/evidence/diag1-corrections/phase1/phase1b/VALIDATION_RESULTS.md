# Phase 1B validation results

Full commands and before/after source hashes are in each command manifest. RED and detected-mutant exit1 results are required negative controls; load errors do not count. Every positive final audit exits0. No whole-repository PASS is claimed.

| Check | Exit | Seconds | Source preserved | Evidence |
|---|---:|---:|---|---|
| build | 0 | 30.38 | True | [build-command.json](build-command.json) |
| conservation | 0 | 64.20 | True | [conservation-command.json](conservation-command.json) |
| determinism-map1 | 0 | 1810.16 | True | [determinism-map1-command.json](determinism-map1-command.json) |
| determinism-map2 | 0 | 606.90 | True | [determinism-map2-command.json](determinism-map2-command.json) |
| determinism-mixed | 0 | 2435.30 | True | [determinism-mixed-command.json](determinism-mixed-command.json) |
| graph | 0 | 1.09 | True | [graph-command.json](graph-command.json) |
| green | 0 | 1.93 | True | [green-command.json](green-command.json) |
| green-expanded | 0 | 1.74 | True | [green-expanded-command.json](green-expanded-command.json) |
| import | 0 | 0.44 | True | [import-command.json](import-command.json) |
| living-ecology | 0 | 25.52 | True | [living-ecology-command.json](living-ecology-command.json) |
| mutant-crossing | 1 | 1.33 | True | [mutant-crossing-command.json](mutant-crossing-command.json) |
| mutant-crossing-expanded | 1 | 1.44 | True | [mutant-crossing-expanded-command.json](mutant-crossing-expanded-command.json) |
| mutant-movement | 1 | 1.34 | True | [mutant-movement-command.json](mutant-movement-command.json) |
| mutant-movement-expanded | 1 | 1.44 | True | [mutant-movement-expanded-command.json](mutant-movement-expanded-command.json) |
| mutant-tile | 1 | 1.34 | True | [mutant-tile-command.json](mutant-tile-command.json) |
| mutant-tile-expanded | 1 | 1.44 | True | [mutant-tile-expanded-command.json](mutant-tile-expanded-command.json) |
| natural-cache | 0 | 239.31 | True | [natural-cache-command.json](natural-cache-command.json) |
| natural-s1 | 0 | 46.56 | True | [natural-s1-command.json](natural-s1-command.json) |
| natural-s2 | 0 | 41.52 | True | [natural-s2-command.json](natural-s2-command.json) |
| numeric-chain | 0 | 183.82 | True | [numeric-chain-command.json](numeric-chain-command.json) |
| phase1-mutant-absorption | 1 | 1.32 | True | [phase1-mutant-absorption-command.json](phase1-mutant-absorption-command.json) |
| phase1-mutant-cache | 1 | 4.59 | True | [phase1-mutant-cache-command.json](phase1-mutant-cache-command.json) |
| phase1-mutant-cargo | 1 | 63.56 | True | [phase1-mutant-cargo-command.json](phase1-mutant-cargo-command.json) |
| phase1-mutant-labor | 1 | 11.42 | True | [phase1-mutant-labor-command.json](phase1-mutant-labor-command.json) |
| provenance | 0 | 0.93 | True | [provenance-command.json](provenance-command.json) |
| recovery-food | 0 | 461.58 | True | [recovery-food-command.json](recovery-food-command.json) |
| red-confirmed | 1 | 1.80 | True | [red-confirmed-command.json](red-confirmed-command.json) |
| type-app | 0 | 18.59 | True | [type-app-command.json](type-app-command.json) |
| type-node | 0 | 1.43 | True | [type-node-command.json](type-node-command.json) |

- map1: six-way full-world hash `aefbd140b31865046eb4733098e1f10b48bf1b881fcaad60cb93a4700a451ab3`; bands5, population155, active parties2, plant-depletion entries1313.
- map2: six-way full-world hash `77dd1326d901188055a1dc6c34a369084212e9938a43111df514b8c60f469a79`; bands9, population235, active parties8, plant-depletion entries1303.

Both isolated matrices equal the original mixed-process matrix. Complete serialized worlds, not selected projections, are compared. Long tests used Node24.18.0; focused cache controls used Node26.7.0. Wall times include concurrent process load and are not isolated performance benchmarks.
