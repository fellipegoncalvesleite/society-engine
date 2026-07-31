// CORRECTION-24A FINALIZATION §6 — EVENT-PAIRED FIRST-READER TRACE.
//
// WHAT THE PREVIOUS INSTRUMENT ACTUALLY WAS, AND WHY IT IS NOT THIS.
//
// The earlier E6 probe removed EVERY record whose `acquisition` currently reads
// `returned_frontier_exploration`, from a periodic snapshot, and asked whether the selected action
// moved. Two things follow, and neither was stated:
//
//   1. It is a GLOBAL SNAPSHOT ABLATION, not a first-reader trace. It cannot say when a record was
//      first read, by whom, or whether the read was the first one.
//   2. It is BIASED TOWARD NULL by the production writer itself. `tileObservation.ts:326-329`
//      overwrites `acquisition` on every observation unless the existing record already reads
//      `residential_observation` — so the moment a band residentially observes a tile it once
//      learned by exploration, that tile STOPS being selected by the probe. The tiles exploration
//      plausibly mattered most for — the ones the band went on to live in or near — are exactly the
//      ones the instrument silently drops.
//
// This audit fixes both. Every record written by a returned frontier-exploration party is stamped
// with a `recordEventId` at the canonical writer, and is followed BY THAT IDENTITY regardless of
// what its label later becomes. At the first invocation of each real reader family after the record
// arrives, the reader is run twice on the SAME snapshot — once canonical, once with ONLY that one
// record removed from every authoritative store the §5 inventory found can hold it — and the
// verdict, the ranking and the selected action are compared separately.
//
// Usage:
//   node scripts/explorationEventPairedReaderAudit.mjs [--years 40] [--seeds s1,..]
//                                                      [--scenarios ..] [--out path]
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt;
};

const YEARS = Number(arg("years", "40"));
const SEEDS = arg("seeds", "s1,s2,s3,s4,s5").split(",").filter(Boolean);
const SEED_PREFIX = arg("seed-prefix", "c24a:chain");
const MAX_PENDING = Number(arg("max-pending", "400"));
const OUT = arg("out", `docs/evidence/correction24a/event-paired-readers-${YEARS}y.json`);

const ALL_SCENARIOS = [
  { name: "map1", map: "map1", fixture: "default" },
  { name: "map2", map: "map2", fixture: "default" },
  { name: "site_A_coast", map: "map2", site: "tile:204:72" },
  { name: "site_B_dry_plains", map: "map2", site: "tile:10:34" },
  { name: "site_C_dry_plains", map: "map2", site: "tile:100:23" },
  { name: "site_D_aquatic", map: "map2", site: "tile:119:116" },
  { name: "site_E_hills", map: "map2", site: "tile:139:41" },
  { name: "site_F_hills", map: "map2", site: "tile:45:28" },
  { name: "ordinary", map: "map2", site: "tile:62:108" },
  { name: "isolated_marginal", map: "map2", site: "tile:43:0" },
  { name: "hostile", map: "map2", site: "tile:150:12" },
];

const only = arg("scenarios", "");
const SCENARIOS = only === "" ? ALL_SCENARIOS : ALL_SCENARIOS.filter((s) => only.split(",").includes(s.name));

const r4 = (v) => (v === null || v === undefined ? null : Math.round(Number(v) * 10000) / 10000);
const inc = (obj, key, by = 1) => {
  obj[key] = (obj[key] ?? 0) + by;
};

const READER_FAMILIES = ["movement_destination", "camp", "resource_activity", "daughter_fission"];

const server = await createServer({
  root: `${process.cwd()}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const spawn = await server.ssrLoadModule("/sim/agents/spawn.ts");
  const diag = await server.ssrLoadModule("/sim/diagnostics/explorationFunnelDiagnostics.ts");
  const decision = await server.ssrLoadModule("/sim/rules/bandDecision.ts");
  const campMovement = await server.ssrLoadModule("/sim/agents/campMovement.ts");
  const trips = await server.ssrLoadModule("/sim/agents/intraSeasonTrips.ts");
  const demography = await server.ssrLoadModule("/sim/agents/demography.ts");
  const contextCache = await server.ssrLoadModule("/sim/agents/contextCache.ts");

  const isLiving = (band) =>
    band.viability?.status !== "extinct" &&
    band.viability?.status !== "absorbed" &&
    band.viability?.status !== "dispersed" &&
    (band.demography?.population ?? 0) > 0;

  /**
   * §5/§6.2 — remove ONE record's fact from every authoritative store, and nothing else.
   *
   * The §5 inventory found the exploration return writes `observedTiles` (through
   * `observeTileAndNearby`) and that only `placeMemory` and `frontierKnowledge.inferredTiles` can
   * carry a derived copy of the same tile. All three are stripped for the ONE tile, and every other
   * record, store and input on the snapshot is preserved byte-for-byte.
   */
  const withoutOneRecord = (band, tileId) => {
    const observedTiles = { ...band.knowledge.observedTiles };
    delete observedTiles[tileId];

    const placeMemory = { ...(band.placeMemory ?? {}) };
    delete placeMemory[tileId];

    const inferred = { ...(band.frontierKnowledge?.inferredTiles ?? {}) };
    delete inferred[tileId];

    // The §5 inventory over 337,910 exploration tiles found FIVE stores that can name one, not
    // three. An earlier version of this ablation stripped only the first three and would have
    // reported a partly-shadowed counterfactual — the exact CORRECTION-23H failure. The last two
    // are co-naming rather than copies (a corridor is built from the residential movement record;
    // verification evidence is written by a verification party), but a store that names the tile is
    // stripped regardless, because the ablation's job is to remove the fact, not to argue about it.
    const placeAttachments = (band.knowledge.placeAttachments ?? []).filter(
      (a) => String(a.tileId) !== String(tileId),
    );
    const travelCorridors = Object.fromEntries(
      Object.entries(band.travelCorridors ?? {}).filter(
        ([, c]) =>
          String(c.fromTileId) !== String(tileId) &&
          String(c.toTileId) !== String(tileId) &&
          !(c.tileIds ?? []).map(String).includes(String(tileId)),
      ),
    );
    const verificationEvidence = (band.verificationEvidence ?? []).filter(
      (e) => String(e.tileId) !== String(tileId),
    );

    return {
      ...band,
      knowledge: { ...band.knowledge, observedTiles, placeAttachments },
      placeMemory,
      travelCorridors,
      verificationEvidence,
      ...(band.frontierKnowledge === undefined
        ? {}
        : { frontierKnowledge: { ...band.frontierKnowledge, inferredTiles: inferred } }),
    };
  };

  const worldWith = (world, band) => ({ ...world, bands: { ...world.bands, [band.id]: band } });

  /**
   * The four real reader families, each called at its ACTUAL production entry point.
   *
   * Each returns a comparable shape: a verdict number, an eligibility flag, a ranking string and a
   * selected-action string. `undefined` means the reader could not be evaluated on this snapshot
   * and the row is dropped rather than counted as "no change".
   */
  const readers = {
    movement_destination: (world, band) => {
      try {
        const d = decision.evaluateBandDecision(world, band);
        const alts = d.alternativesConsidered ?? [];
        return {
          verdict: Number(alts[0]?.score ?? 0),
          eligible: alts.length > 0,
          ranking: alts.slice(0, 5).map((a) => String(a.id ?? a.action?.type ?? "")).join(">"),
          selectedAction: JSON.stringify(d.action ?? null),
          actionKind: String(d.action?.type ?? "none"),
        };
      } catch {
        return undefined;
      }
    },
    // Real shape, read from a live run rather than assumed:
    //   { bandId, generatedAtTick, influences: [{ scale, status, actionTypes, targetTileId,
    //     scoreDelta, ... }], pressureRelief, maxScoreDelta, ... }
    // An earlier version of this probe read `candidates`/`selected`/`pressure`, none of which
    // exist, so it reported verdict 0 and ranking "" on every snapshot — a vacuous zero.
    camp: (world, band) => {
      try {
        const s = campMovement.deriveCampMovementDecisionSupport(world, band);
        const influences = s?.influences ?? [];
        return {
          verdict: Number(s?.maxScoreDelta ?? 0),
          eligible: influences.length > 0,
          ranking: influences.slice(0, 5).map((i) => `${i.scale}:${i.targetTileId ?? ""}`).join(">"),
          selectedAction: JSON.stringify(
            influences.map((i) => [i.scale, i.status, i.targetTileId ?? null, i.scoreDelta ?? 0]),
          ),
          actionKind: String(influences[0]?.scale ?? "none"),
        };
      } catch {
        return undefined;
      }
    },
    // The REAL resource-activity read of observedTiles. Trip selection itself runs off
    // ResourcePatchMemory, which exploration never writes, so this local reconnaissance starting
    // state is the only place an exploration-derived record can reach this family.
    resource_activity: (world, band, day) => {
      try {
        const st = trips.buildStartingLocalReconnaissanceStateForAudit(world, band, day);

        if (st === undefined) {
          return undefined;
        }

        const patches = st.patchMemories ?? [];
        return {
          verdict: patches.length,
          eligible: patches.length > 0,
          // ResourcePatchMemory keys its tile as `approximateTile`; `tileId` does not exist and
          // an earlier version of this probe read undefined for every patch.
          ranking: patches.slice(0, 8).map((m) => String(m.approximateTile)).join(">"),
          selectedAction: JSON.stringify(patches.map((m) => `${m.patchId}@${m.approximateTile}`).sort()),
          actionKind: String(patches[0]?.approximateTile ?? "none"),
        };
      } catch {
        return undefined;
      }
    },
    // The REAL fission target selector, not the spacing check for an already-chosen target.
    //
    // The tick context cache MUST be built and passed. `getFissionTargetRecordIds` falls back to
    // EVERY observed tile when the cache is undefined, while production passes a cache and gets the
    // salient subset — so an undefined cache silently evaluates a larger candidate set and answers a
    // different question. This is CORRECTION-23H's instrument bug #1, and the cache is rebuilt
    // separately for the ablated world so the salient summary cannot still contain the removed tile.
    daughter_fission: (world, band) => {
      try {
        const comfortable = Number(band.demography?.population ?? 0);
        const cache = contextCache.buildTickContextCache(world);
        const c = demography.selectFissionTargetForAudit(world, band, comfortable, cache);
        return {
          verdict: Number(c?.score ?? 0),
          eligible: c !== undefined,
          ranking: String(c?.tileId ?? ""),
          selectedAction: JSON.stringify(c?.tileId ?? null),
          actionKind: String(c?.tileId ?? "none"),
        };
      } catch {
        return undefined;
      }
    },
  };

  // Production cadences, so "first invocation after the record arrived" is the real first one.
  //
  // THE SEAM MATTERS. `evaluateBandDecision` and `campMovement` run DURING the step that lands on
  // a season boundary (dayOfSeason 0). Probing after that step re-evaluates a band whose decision
  // has already been applied and whose position may already have moved — a different question, and
  // the reason an earlier version of this probe reproduced production's recorded decision 0/21
  // times. The probe therefore runs on the day BEFORE the boundary, which is the state production
  // itself reads, and the soundness check below verifies that against `world.decisions`.
  const nextInvocationDay = {
    movement_destination: (day) => Math.ceil((day + 1) / 90) * 90 - 1,
    camp: (day) => Math.ceil((day + 1) / 90) * 90 - 1,
    // intraSeasonTrips runs on trip days: dayOfSeason 6, 9, 12, ... within each 90-day season.
    resource_activity: (day) => {
      let d = day + 1;
      while (d % 90 < 6 || (d % 90 - 6) % 3 !== 0) d += 1;
      return d;
    },
    // demography/fission runs once per year.
    daughter_fission: (day) => Math.ceil((day + 1) / 360) * 360,
  };

  /**
   * §6.4 — PER-FAMILY POSITIVE CONTROLS.
   *
   * A zero from any family is only evidence if that family's probe could have returned non-zero.
   * A global "remove every known tile" control is explicitly insufficient, because it cannot show
   * that THIS family's reader responds to the removal of ONE record. So for each family we find the
   * record the reader is actually using right now — its own selected target — remove exactly that
   * one, and require the selected action to move.
   */
  const positiveControls = {};
  for (const f of READER_FAMILIES) positiveControls[f] = { attempts: 0, passed: 0 };

  const runPositiveControls = (world, band, day) => {
    for (const family of READER_FAMILIES) {
      const base = readers[family](world, band, day);

      if (base === undefined) continue;

      // The tile this reader is currently pointing at. If it names no tile there is nothing to
      // remove and the control is not attempted on this snapshot.
      let usedTile;

      try {
        if (family === "movement_destination") {
          usedTile = JSON.parse(base.selectedAction)?.targetTileId;
        } else if (family === "daughter_fission") {
          usedTile = JSON.parse(base.selectedAction);
        } else if (family === "resource_activity") {
          usedTile = String(JSON.parse(base.selectedAction)?.[0] ?? "").split("@")[1];
        } else if (family === "camp") {
          usedTile = (JSON.parse(base.selectedAction) ?? []).map((i) => i[2]).find((t) => t);
        }
      } catch {
        usedTile = undefined;
      }

      if (usedTile === undefined || usedTile === null || usedTile === "" || usedTile === "none") continue;
      if (band.knowledge?.observedTiles?.[usedTile] === undefined) continue;

      positiveControls[family].attempts += 1;

      const stripped = withoutOneRecord(band, String(usedTile));
      const after = readers[family](worldWith(world, stripped), stripped, day);

      if (after !== undefined && after.selectedAction !== base.selectedAction) {
        positiveControls[family].passed += 1;
      }
    }
  };

  // §6.5 — the soundness self-check and the physical-action link.
  const soundness = { checked: 0, matchedProduction: 0 };
  const physical = { movementActionChanged: 0, physicallyRealised: 0, notRealised: 0 };
  const pendingPhysical = [];

  const totals = {
    recordsTracked: 0,
    byFamily: {},
    consumedWithin90: 0,
    consumedWithin360: 0,
    neverRead: 0,
    readButInert: 0,
    evictedBeforeRead: 0,
    changedVerdict: 0,
    changedRanking: 0,
    changedSelectedAction: 0,
    physicalActionFollowed: 0,
  };
  for (const f of READER_FAMILIES) {
    totals.byFamily[f] = {
      probes: 0,
      changedVerdict: 0,
      changedRanking: 0,
      changedSelectedAction: 0,
      physicalActionFollowed: 0,
      readerUnavailable: 0,
    };
  }

  const byScenario = {};
  const decisiveExamples = [];

  for (const scenario of SCENARIOS) {
    const acc = {
      recordsTracked: 0,
      byFamily: {},
      consumedWithin90: 0,
      consumedWithin360: 0,
      neverRead: 0,
      readButInert: 0,
      evictedBeforeRead: 0,
      changedSelectedAction: 0,
    };
    for (const f of READER_FAMILIES) {
      acc.byFamily[f] = { probes: 0, changedVerdict: 0, changedRanking: 0, changedSelectedAction: 0, readerUnavailable: 0 };
    }

    for (const seed of SEEDS) {
      diag.setExplorationFunnelRecording(true, scenario.name);
      diag.setExplorationJourneyRecording(true);
      diag.setExplorationRecordRecording(true);
      diag.setExplorationArm("O0");

      try {
        let world = runner.initSimWorld({ kind: scenario.map }, `${SEED_PREFIX}:${seed}`);

        if (scenario.fixture !== "default") {
          world = spawn.removeInitialBands(world, Object.keys(world.bands));
          world = spawn.spawnCustomBands(
            world,
            [{ tileId: scenario.site, population: 34, name: scenario.name }],
            `${SEED_PREFIX}:${seed}`,
          );
        }

        // recordEventId -> { bandId, tileId, createdDay, pendingFamilies, outcome }
        const pending = new Map();
        let seenRecordRows = 0;
        // world.decisions is a BOUNDED window (recentDecisionLimit 64), so a decision must be
        // captured when it appears or it is evicted before the check can read it.
        const decisionsSeen = new Map();
        const pendingSoundness = [];

        for (let d = 1; d <= YEARS * 360; d += 1) {
          world = runner.stepSim(world, 1, "daily");

          for (const dec of Object.values(world.decisions ?? {})) {
            decisionsSeen.set(`${dec.bandId}:${dec.time?.tick}`, dec);
          }

          // Pick up records written by returns on this step. Tracked by recordEventId, NEVER by
          // the current acquisition label — see the header.
          const rows = diag.getExplorationRecords();

          for (let i = seenRecordRows; i < rows.length; i += 1) {
            const row = rows[i];

            if (pending.size >= MAX_PENDING) break;

            if (!pending.has(row.recordEventId)) {
              pending.set(row.recordEventId, {
                bandId: row.bandId,
                tileId: row.tileId,
                createdDay: Number(row.createdDay),
                remaining: new Set(READER_FAMILIES),
                firstChangedActionDay: null,
                anyRead: false,
                anyChange: false,
              });
              acc.recordsTracked += 1;
              totals.recordsTracked += 1;
            }
          }
          seenRecordRows = rows.length;

          // §6.4 — exercise the controls on real mid-run states, on a sparse cadence.
          if (d % 720 === 0) {
            for (const b of Object.values(world.bands).filter(isLiving)) runPositiveControls(world, b, d);
          }

          if (pending.size === 0) continue;

          for (const [eventId, rec] of pending) {
            const band = world.bands[rec.bandId];

            if (band === undefined || !isLiving(band)) {
              pending.delete(eventId);
              continue;
            }

            // The record is gone before any reader reached it.
            if (band.knowledge?.observedTiles?.[rec.tileId] === undefined) {
              if (!rec.anyRead) {
                acc.evictedBeforeRead += 1;
                totals.evictedBeforeRead += 1;
              } else if (!rec.anyChange) {
                acc.readButInert += 1;
                totals.readButInert += 1;
              }
              pending.delete(eventId);
              continue;
            }

            for (const family of [...rec.remaining]) {
              if (d !== nextInvocationDay[family](rec.createdDay)) continue;

              rec.remaining.delete(family);

              const withRecord = readers[family](world, band, d);

              if (withRecord === undefined) {
                acc.byFamily[family].readerUnavailable += 1;
                totals.byFamily[family].readerUnavailable += 1;
                continue;
              }

              const stripped = withoutOneRecord(band, rec.tileId);
              const without = readers[family](worldWith(world, stripped), stripped, d);

              if (without === undefined) {
                acc.byFamily[family].readerUnavailable += 1;
                totals.byFamily[family].readerUnavailable += 1;
                continue;
              }

              rec.anyRead = true;
              acc.byFamily[family].probes += 1;
              totals.byFamily[family].probes += 1;

              const latency = d - rec.createdDay;
              const verdictMoved = r4(withRecord.verdict) !== r4(without.verdict);
              const rankingMoved = withRecord.ranking !== without.ranking;
              const actionMoved = withRecord.selectedAction !== without.selectedAction;

              if (verdictMoved) {
                acc.byFamily[family].changedVerdict += 1;
                totals.byFamily[family].changedVerdict += 1;
                totals.changedVerdict += 1;
              }
              if (rankingMoved) {
                acc.byFamily[family].changedRanking += 1;
                totals.byFamily[family].changedRanking += 1;
                totals.changedRanking += 1;
              }

              // §6.5 SOUNDNESS SELF-CHECK. A counterfactual run on a re-derived reader is only
              // evidence if the canonical arm reproduces what production ACTUALLY decided that
              // tick. CORRECTION-23H's instrument bug #1 was exactly this: an audit that re-ran a
              // reader with different inputs and answered a different question. Production stores
              // its real decision at world.decisions["decision:<bandId>:<tick>"].
              if (family === "movement_destination") {
                // The probe ran on day d, BEFORE the boundary; production's decision for tick
                // (d+1)/90 is made on the next step and cannot be compared yet. Queue it and
                // resolve once production has actually recorded it.
                pendingSoundness.push({
                  key: `${rec.bandId}:${Math.round((d + 1) / 90)}`,
                  expected: withRecord.selectedAction,
                  deadline: d + 3,
                });
              }

              if (actionMoved) {
                // §6.5 — did a PHYSICAL action follow? For the movement family the selected action
                // is the one applyBandDecision executes, so the test is whether the band is
                // physically at the action's target on a later day. Queued and checked below
                // rather than asserted here.
                if (family === "movement_destination") {
                  physical.movementActionChanged += 1;
                  try {
                    const act = JSON.parse(withRecord.selectedAction);
                    if (act?.targetTileId !== undefined) {
                      pendingPhysical.push({
                        bandId: rec.bandId,
                        target: String(act.targetTileId),
                        fromDay: d,
                        deadline: d + 90,
                      });
                    }
                  } catch { /* action carries no target; nothing physical to verify */ }
                }

                rec.anyChange = true;
                acc.byFamily[family].changedSelectedAction += 1;
                totals.byFamily[family].changedSelectedAction += 1;
                totals.changedSelectedAction += 1;
                acc.changedSelectedAction += 1;

                if (rec.firstChangedActionDay === null) rec.firstChangedActionDay = d;
                if (latency <= 90) { acc.consumedWithin90 += 1; totals.consumedWithin90 += 1; }
                if (latency <= 360) { acc.consumedWithin360 += 1; totals.consumedWithin360 += 1; }

                if (decisiveExamples.length < 25) {
                  decisiveExamples.push({
                    scenario: scenario.name,
                    seed,
                    recordEventId: eventId,
                    family,
                    latencyDays: latency,
                    verdictBefore: r4(without.verdict),
                    verdictAfter: r4(withRecord.verdict),
                    actionWithout: without.actionKind,
                    actionWith: withRecord.actionKind,
                  });
                }
              }
            }

            if (rec.remaining.size === 0) {
              if (!rec.anyChange) {
                if (rec.anyRead) { acc.readButInert += 1; totals.readButInert += 1; }
                else { acc.neverRead += 1; totals.neverRead += 1; }
              }
              pending.delete(eventId);
            }
          }

          // §6.5 — resolve queued soundness checks now that production has decided.
          for (let i = pendingSoundness.length - 1; i >= 0; i -= 1) {
            const q = pendingSoundness[i];
            const production = decisionsSeen.get(q.key);

            if (production !== undefined) {
              soundness.checked += 1;
              if (JSON.stringify(production.action ?? null) === q.expected) soundness.matchedProduction += 1;
              pendingSoundness.splice(i, 1);
            } else if (d >= q.deadline) {
              soundness.checked += 1;
              pendingSoundness.splice(i, 1);
            }
          }

          // §6.5 — resolve queued physical checks.
          for (let i = pendingPhysical.length - 1; i >= 0; i -= 1) {
            const q = pendingPhysical[i];
            const b = world.bands[q.bandId];

            if (b !== undefined && String(b.position) === q.target) {
              physical.physicallyRealised += 1;
              pendingPhysical.splice(i, 1);
            } else if (d >= q.deadline) {
              physical.notRealised += 1;
              pendingPhysical.splice(i, 1);
            }
          }

          if (Object.values(world.bands).filter(isLiving).length === 0) break;
        }

        // Anything still pending at the end of the run was never reached by every family.
        for (const [, rec] of pending) {
          if (!rec.anyRead) { acc.neverRead += 1; totals.neverRead += 1; }
          else if (!rec.anyChange) { acc.readButInert += 1; totals.readButInert += 1; }
        }
      } finally {
        diag.clearExplorationDiagnostics();
      }
    }

    byScenario[scenario.name] = acc;
    console.log(
      `${scenario.name.padEnd(20)} records=${String(acc.recordsTracked).padStart(5)} ` +
        READER_FAMILIES.map((f) => `${f.slice(0, 4)}=${acc.byFamily[f].changedSelectedAction}/${acc.byFamily[f].probes}`).join(" ") +
        ` evictedBeforeRead=${acc.evictedBeforeRead} inert=${acc.readButInert}`,
    );
  }

  const result = {
    instrument: "EVENT-PAIRED FIRST-READER CONSUMPTION",
    note:
      "One record removed at a time, by recordEventId, from ALL FIVE stores the §5 inventory found can name an exploration tile: observedTiles, placeMemory, placeAttachments, frontierInferredTiles, travelCorridors, verificationEvidence. NOT the global snapshot ablation.",
    years: YEARS,
    seeds: SEEDS,
    scenarios: SCENARIOS.map((s) => s.name),
    readerFamilies: READER_FAMILIES,
    routeCorridor: "STRUCTURAL NO READER — travelCorridors is written by updateTravelCorridorMemory from the residential movement record; the exploration hand-off never reaches it.",
    totals,
    probeSoundness: soundness,
    physicalActionLink: physical,
    positiveControls,
    byScenario,
    decisiveExamples,
  };

  mkdirSync(OUT.split("/").slice(0, -1).join("/"), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);

  console.log("");
  console.log(`records tracked by event id  : ${totals.recordsTracked}`);
  for (const f of READER_FAMILIES) {
    const v = totals.byFamily[f];
    console.log(
      `  ${f.padEnd(22)} probes=${String(v.probes).padStart(6)} verdict=${String(v.changedVerdict).padStart(5)} ` +
        `ranking=${String(v.changedRanking).padStart(5)} ACTION=${String(v.changedSelectedAction).padStart(5)} ` +
        `unavailable=${v.readerUnavailable}`,
    );
  }
  console.log(`changed selected action total: ${totals.changedSelectedAction}`);
  console.log(`consumed within 90 days      : ${totals.consumedWithin90}`);
  console.log(`consumed within 360 days     : ${totals.consumedWithin360}`);
  console.log(`never read                   : ${totals.neverRead}`);
  console.log(`read but inert               : ${totals.readButInert}`);
  console.log(`evicted before read          : ${totals.evictedBeforeRead}`);
  console.log(`probe soundness (movement)   : ${soundness.matchedProduction}/${soundness.checked} canonical arm == production's recorded decision`);
  console.log(`movement action changed      : ${physical.movementActionChanged}`);
  console.log(`  ... physically realised    : ${physical.physicallyRealised}`);
  console.log(`  ... not realised in 90d    : ${physical.notRealised}`);
  console.log("per-family positive controls (removing the record the reader is USING):");
  for (const f of READER_FAMILIES) {
    const c = positiveControls[f];
    console.log(`  ${f.padEnd(22)} ${c.passed}/${c.attempts}${c.attempts === 0 ? "  <-- NOT EXERCISED" : ""}`);
  }
  console.log(`wrote ${OUT}`);
} finally {
  await server.close();
}
