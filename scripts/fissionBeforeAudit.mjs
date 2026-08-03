// ROADMAP ITEM 4 — BEFORE ARCHITECTURE AUDIT.
//
// Reproduces what fission ACTUALLY does today, on real production, before anything is changed.
// The headline is written from the measurement, not before it.
//
// It answers the §15 list one question at a time: trigger, threshold, target selection, people and
// labour transferred, cohort composition on both sides, where the daughter physically appears,
// where its destination belief comes from, what support and knowledge it starts with, which
// commitments it inherits, whether viability is checked, whether failure or return is possible,
// whether creation is instantaneous, whether the daughter is permanently an ordinary band, whether
// away or prepared people can be borrowed, and whether the two populations reconcile.
//
// AUDIT ONLY.
import { createServer } from "vite";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const OUT = arg("out", "artifacts/c37/fission-before.json");
const SEEDS = arg("seeds", "audit27:natural:s1,audit27:natural:map2:s1").split(",");
const YEARS = Number(arg("years", "200"));

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c37before-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const mobility = await server.ssrLoadModule("/sim/agents/bandMobility.ts");
  const r4 = (v) => (typeof v === "number" ? Math.round(v * 10000) / 10000 : v);

  const gridDistance = (w, a, b) => {
    const ta = w.tiles[a]; const tb = w.tiles[b];
    if (ta === undefined || tb === undefined) return null;
    return Math.abs(ta.coord.x - tb.coord.x) + Math.abs(ta.coord.y - tb.coord.y);
  };

  const runs = [];
  for (const seed of SEEDS) {
    let world = runner.initSimWorld({ kind: "map2" }, seed);
    const known = new Map();
    for (const b of Object.values(world.bands)) known.set(String(b.id), b);
    const events = [];
    let worldPopulationSeries = [];
    let previousWorld = world;

    for (let day = 0; day < YEARS * 360; day += 1) {
      previousWorld = world;
      world = advance.advanceWorldByDays(world, 1);

      // A daughter appearing is the only observable moment of fission.
      for (const b of Object.values(world.bands)) {
        const id = String(b.id);
        if (known.has(id)) continue;
        known.set(id, b);
        if (b.parentBandId === undefined) continue;

        const parentBefore = previousWorld.bands[b.parentBandId];
        const parentAfter = world.bands[b.parentBandId];
        if (parentBefore === undefined || parentAfter === undefined) continue;

        const ev = (b.fissionEvents ?? [])[0];
        const popBefore = Object.values(previousWorld.bands)
          .reduce((n, x) => n + (x.demography?.population ?? 0), 0);
        const popAfter = Object.values(world.bands)
          .reduce((n, x) => n + (x.demography?.population ?? 0), 0);

        events.push({
          seed, day: Number(world.time.day ?? day), year: Number(world.time.year),
          parent: String(b.parentBandId), daughter: id,

          // ── trigger and threshold ──
          parentSplitPressureBefore: r4(parentBefore.demography?.splitPressure),
          parentSplitPressureAfter: r4(parentAfter.demography?.splitPressure),

          // ── people and labour transferred ──
          parentPopulationBefore: parentBefore.demography?.population,
          parentPopulationAfter: parentAfter.demography?.population,
          daughterPopulation: b.demography?.population,
          populationSum: (parentAfter.demography?.population ?? 0) + (b.demography?.population ?? 0),
          populationConservedAcrossThePair:
            (parentAfter.demography?.population ?? 0) + (b.demography?.population ?? 0)
            === (parentBefore.demography?.population ?? 0),
          worldPopulationBefore: popBefore, worldPopulationAfter: popAfter,
          worldPopulationConserved: Math.abs(popBefore - popAfter) < 1e-9,

          // ── cohort composition: allocated, or re-derived? ──
          parentCohortsBefore: { workingAdults: parentBefore.demography?.workingAdults,
            dependents: parentBefore.demography?.dependents, elders: parentBefore.demography?.elders },
          parentCohortsAfter: { workingAdults: parentAfter.demography?.workingAdults,
            dependents: parentAfter.demography?.dependents, elders: parentAfter.demography?.elders },
          daughterCohorts: { workingAdults: b.demography?.workingAdults,
            dependents: b.demography?.dependents, elders: b.demography?.elders },
          cohortSums: {
            workingAdults: (parentAfter.demography?.workingAdults ?? 0) + (b.demography?.workingAdults ?? 0),
            dependents: (parentAfter.demography?.dependents ?? 0) + (b.demography?.dependents ?? 0),
            elders: (parentAfter.demography?.elders ?? 0) + (b.demography?.elders ?? 0),
          },
          cohortsConserved: {
            workingAdults: (parentAfter.demography?.workingAdults ?? 0) + (b.demography?.workingAdults ?? 0)
              === (parentBefore.demography?.workingAdults ?? 0),
            dependents: (parentAfter.demography?.dependents ?? 0) + (b.demography?.dependents ?? 0)
              === (parentBefore.demography?.dependents ?? 0),
            elders: (parentAfter.demography?.elders ?? 0) + (b.demography?.elders ?? 0)
              === (parentBefore.demography?.elders ?? 0),
          },
          daughterDependentShare: b.demography?.population
            ? r4((b.demography.dependents ?? 0) / b.demography.population) : null,
          daughterElderShare: b.demography?.population
            ? r4((b.demography.elders ?? 0) / b.demography.population) : null,

          // ── physical location: did anybody walk? ──
          parentPosition: String(parentAfter.position),
          daughterPosition: String(b.position),
          targetTileId: ev === undefined ? null : String(ev.targetTileId ?? "-"),
          distanceParentToDaughterOnCreation: gridDistance(world, parentAfter.position, b.position),
          daughterCoResidentWithParent: String(b.position) === String(parentAfter.position),

          // ── destination knowledge ──
          daughterKnewItsOwnPositionBeforeMoving:
            parentBefore.knowledge?.observedTiles?.[b.position] !== undefined,
          parentConfidenceInTarget:
            r4(parentBefore.knowledge?.observedTiles?.[b.position]?.confidence ?? null),

          // ── initial support and commitments ──
          daughterSeasonalFoodReceipts: b.seasonalFoodReceipts === undefined ? "reset" : "INHERITED",
          daughterSeasonalSupport: b.seasonalSupport === undefined ? "reset" : "INHERITED",
          daughterExpeditions: (b.expeditions ?? []).length,
          daughterRecentTrips: (b.recentIntraSeasonTrips ?? []).length,

          // ── inherited knowledge ──
          parentObservedTiles: Object.keys(parentBefore.knowledge?.observedTiles ?? {}).length,
          daughterObservedTiles: Object.keys(b.knowledge?.observedTiles ?? {}).length,
          knowledgeInheritedShare: Object.keys(parentBefore.knowledge?.observedTiles ?? {}).length
            ? r4(Object.keys(b.knowledge?.observedTiles ?? {}).length
              / Object.keys(parentBefore.knowledge?.observedTiles ?? {}).length) : null,
          daughterIsAKnowledgeClone:
            Object.keys(b.knowledge?.observedTiles ?? {}).length
            === Object.keys(parentBefore.knowledge?.observedTiles ?? {}).length,

          // ── away / prepared at the moment of fission ──
          parentPhysicallyAwayBefore: (parentBefore.expeditions ?? [])
            .filter((e) => mobility.isPhysicallyAwayPhase(e.phase))
            .reduce((n, e) => n + (e.partyWorkers ?? 0) + (e.nonWorkingPartyPeople ?? 0), 0),
          parentPreparedBefore: (parentBefore.expeditions ?? [])
            .filter((e) => e.phase === "prepared")
            .reduce((n, e) => n + (e.partyWorkers ?? 0) + (e.nonWorkingPartyPeople ?? 0), 0),

          // ── the event record's own conservation claim ──
          eventReportedConserved: ev?.fissionPopulationConserved ?? null,
          eventWorldPopulationBefore: ev?.worldPopulationBeforeFission ?? null,
          eventWorldPopulationAfter: ev?.worldPopulationAfterFission ?? null,

          // ── status ──
          daughterStatus: String(b.status),
          daughterIsOrdinaryBandImmediately: b.status === "foraging",
          // INSTRUMENT CORRECTION. The first form asked whether ANY band key matched
          // /provisional|attempt|establish/i and reported `true` for every daughter — a false
          // positive on pre-existing unrelated keys (`attempts`, `attempted`, `careAttempted`,
          // and the adaptation state's `attemptIndex` / `attemptSeasons`). None of those has
          // anything to do with fission. The question is whether a FISSION-SPECIFIC provisional
          // state exists, so the named fields are checked instead.
          daughterHasFissionProvisionalState:
            b.fissionAttempt !== undefined || b.provisionalSuccessor !== undefined
            || b.establishment !== undefined,
        });
      }
      if (day % 3600 === 0) {
        worldPopulationSeries.push({ day: Number(world.time.day ?? day),
          worldPopulation: r4(Object.values(world.bands).reduce((n, x) => n + (x.demography?.population ?? 0), 0)),
          bands: Object.values(world.bands).filter((x) => x.status !== "dispersed" && x.viability?.status !== "extinct").length });
      }
    }
    runs.push({ seed, years: YEARS, fissionsObserved: events.length, events, worldPopulationSeries });
  }

  const all = runs.flatMap((r) => r.events);
  const sum = (fn) => all.filter(fn).length;

  out = {
    audit: "ITEM-4-FISSION-BEFORE-ARCHITECTURE",
    tree: "ef76971bd66a7413313183349b9468a879405970",
    seeds: SEEDS, years: YEARS,
    headline: all.length === 0
      ? "NO FISSION OCCURRED NATURALLY IN THE MEASURED SPAN — the before-behaviour must be read from the controlled arm"
      : "MEASURED — see measuredBehaviour",
    measuredBehaviour: {
      fissionsObserved: all.length,
      instantaneous: "a daughter appears complete within ONE simulated day of the annual demographic step; there is no attempt, proposal, preparation or journey state at any point",
      daughterCoResidentWithParent: sum((e) => e.daughterCoResidentWithParent),
      daughterPlacedAtADistantTile: sum((e) => !e.daughterCoResidentWithParent),
      maxDistanceTeleported: all.reduce((m, e) => Math.max(m, e.distanceParentToDaughterOnCreation ?? 0), 0),
      populationConservedAcrossThePair: sum((e) => e.populationConservedAcrossThePair),
      populationNotConserved: sum((e) => !e.populationConservedAcrossThePair),
      cohortsConservedWorkingAdults: sum((e) => e.cohortsConserved.workingAdults),
      cohortsConservedDependents: sum((e) => e.cohortsConserved.dependents),
      cohortsConservedElders: sum((e) => e.cohortsConserved.elders),
      daughterDependentShares: [...new Set(all.map((e) => e.daughterDependentShare))],
      daughterElderShares: [...new Set(all.map((e) => e.daughterElderShare))],
      awayPeopleAtFission: all.map((e) => e.parentPhysicallyAwayBefore),
      preparedPeopleAtFission: all.map((e) => e.parentPreparedBefore),
      knowledgeClones: sum((e) => e.daughterIsAKnowledgeClone),
      knowledgeInheritedShares: all.map((e) => e.knowledgeInheritedShare),
      inheritedFoodReceipts: sum((e) => e.daughterSeasonalFoodReceipts === "INHERITED"),
      inheritedExpeditions: sum((e) => e.daughterExpeditions > 0),
      ordinaryBandImmediately: sum((e) => e.daughterIsOrdinaryBandImmediately),
      anyFissionProvisionalState: sum((e) => e.daughterHasFissionProvisionalState),
    },
    structuralFindingsReadFromProduction: {
      viabilityCheck: "the ONLY viability test is `daughterPopulation >= DAUGHTER_MIN_POPULATION` inside createDaughterBand. There is no parent residual viability test, no successor early viability test and no establishment window.",
      failurePath: "NONE. createDaughterBand either returns a complete daughter or returns undefined before creating anything. Once created, a daughter is an ordinary band forever; there is no return, reintegration or failed establishment.",
      cohortAllocation: "NOT ALLOCATED. Both the parent-after and the daughter are passed through recomputeDemographicCounts, which DERIVES cohorts from population at fixed ratios (dependents 35%, elders 10%, remainder working adults). Whatever composition the parent actually had is destroyed on both sides by the split.",
      founderAvailability: "CHECKED. CORRECTION-34C and -34D cap the founding draw at population minus physically-away minus prepared-commitment people, and BLOCK below DAUGHTER_MIN_POPULATION rather than borrowing.",
      destinationKnowledge: "BAND-KNOWN. selectFissionTarget reads band.knowledge.observedTiles gated at confidence >= 0.34; no hidden richness is read.",
      physicalTransition: "NONE. The daughter is constructed with `position: target.tileId` — it appears AT the destination without travelling, and no movement authority is consulted.",
      supportAtBirth: "seasonalFoodReceipts, seasonalSupport, recentIntraSeasonTrips and expeditions are all explicitly reset to undefined, so the daughter starts with NO support and NO inherited commitments.",
      knowledgeInheritance: "PARTIAL and degraded (2K.1D), with a clone guard (assertDaughterFissionStateNotCloned) over a registered non-cloneable field list.",
      eventConservationClaim: "the BandFissionEvent records `worldPopulationAfterFission` by ASSIGNING it `worldPopulationBeforeFission`, so `fissionPopulationConserved` is structurally incapable of being false. It is a restatement, not a measurement.",
    },
    runs,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
} finally {
  await server.close();
}

console.log(JSON.stringify({ headline: out.headline, measured: out.measuredBehaviour }, null, 2));
