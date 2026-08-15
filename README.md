# Society Engine

**Society Engine** is a broader human and societal simulation system built around the idea that large-scale history should emerge from the behavior, constraints, memory, and relationships of smaller groups rather than from a fixed script.

The long-term direction is to model how human groups move through environments, use resources, remember places and events, interact with one another, change demographically, form more persistent settlements and social structures, and accumulate culture and history over time. The goal is an inspectable simulation where complex social patterns can emerge from understandable underlying systems.

## Current implementation

The project currently starts at a deliberately small scale: **mobile/nomadic human groups living in a seasonal environment**. This is the first implemented layer of Society Engine, not the final scope of the project.

Right now, the simulation includes systems for:

- seasonal ecology, food and water pressure;
- group movement, migration, scouting, and changing residential locations;
- memory and knowledge about places, resources, risks, and other groups;
- population and demographic dynamics;
- relationships and encounters between groups;
- group splitting, persistence, absorption, and extinction;
- generated events, histories, identities, and readable chronicles;
- deterministic, seeded runs for reproducible behavior checks.

The interface is designed to make those systems readable. You can inspect technical state when needed, but the main experience also presents the run as a developing human history rather than only as raw simulation output.

## Larger direction

Society Engine is intended to grow beyond the current mobile-band phase. Planned areas of exploration include more persistent settlement, richer social organization, longer-term population structure, relationships between communities, cultural transmission, institutions and collective memory, and emergent historical change.

Those are **planned directions, not claims about the current implementation**. The present codebase is focused on establishing a robust simulation foundation for small human groups before expanding the social scale.

## What you can do now

1. Pick a group and inspect what it is doing, where it is living, what it knows, who it has met, and what risks it faces.
2. Open the Chronicle view to read a wiki-style history generated from that group's actual run.
3. Paint the map before starting a run to create terrain for different scenarios.
4. Watch groups move through seasons on the canvas map.
5. Open the architecture view to inspect how the simulation systems connect.

## Architecture

The simulation core lives in `src/sim` and is written in TypeScript. It does not depend on React or the DOM. A seeded generator controls variation, so the same configuration and seed can reproduce the same history.

The interface uses React, Vite, and Zustand. The world is rendered on canvas, and a Web Worker keeps simulation work off the main UI thread.

## Running locally

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

Scenarios cover crowded deltas, overloaded core areas, daughter-group expansion, dry margins, and other cases. The benchmark tooling also supports reproducible checks for confirming that identical setups produce identical runs.

## Status

Actively developed. The current implementation is the early mobile-group layer of the broader Society Engine direction, with ongoing work on simulation behavior, reproducibility, performance, and readable generated histories.
