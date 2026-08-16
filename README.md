# Society Engine

Society Engine is a deterministic human-society simulation built to explore how larger social patterns can emerge from physical conditions and accumulated experience rather than scripted civilization stages.

The **current implementation** starts with small mobile human bands. They move through a seasonal world, search for food and water, learn and remember useful or dangerous places, respond to risk and demographic pressure, split into new groups, and accumulate histories from the simulation itself. The browser interface makes those systems inspectable through the map, band views, Chronicle, and architecture tools.

That starting point is deliberately narrower than the project's intended scope. The longer-term direction is to let human groups develop through interacting systems for movement, resources, memory, relationships, population dynamics, settlement, social organization, culture, technology, institutions, and history. Those systems are planned to emerge from earlier causal conditions rather than appear as fixed unlocks or labels.

## Implemented now

- Deterministic TypeScript simulation core with seeded, reproducible runs.
- Mobile bands interacting with terrain, seasonal ecology, resource knowledge, risk, labor, movement, and demography.
- Band-local knowledge and memory rather than omniscient access to world state.
- Expeditionary/logistical movement, task camps, observations, and physical resource returns.
- Generated band histories and a Chronicle view derived from simulated events.
- Editable maps plus architecture/debug views for inspecting how the simulation works.

## Planned scope

Society Engine is intended to grow beyond mobile bands into a broader human and societal simulation. Planned systems include richer inter-group relationships and exchange, culture and identity, persistent routes and settlements, deeper social organization, technology and institutions, and longer-run historical change.

These are roadmap goals, **not claims about the current build**. The project treats settlement, culture, and later social complexity as outcomes that should become viable because of preceding ecological, demographic, behavioral, and social conditions.

## How it works

The simulation core lives in `src/sim` and is written in TypeScript. It does not depend on React or the DOM. A seeded generator controls variation, so the same seed produces the same history.

The interface uses React, Vite, and Zustand. The world is drawn on canvas, and a worker keeps the simulation moving without blocking the main screen.

## Running it

```bash
npm install
npm run dev        # development server
npm run build      # type check and production build
```

## Benchmark CLI

The simulation can also run without the browser for performance and behavior checks:

```bash
npm run sim:benchmark
```

Scenarios cover crowded deltas, overloaded core areas, daughter-band expansion, dry margins, and other cases. The benchmark script also supports reproducible checks when you want to confirm that the same setup gives the same run.

## Status

Actively developed. The current codebase focuses on making the physical, behavioral, and demographic foundations robust enough for later social complexity to emerge causally rather than be scripted on top.
