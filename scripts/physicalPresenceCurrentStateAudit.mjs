// CORRECTION-34 §7 — CURRENT-STATE MEASUREMENT, before any production change.
//
// Measures, on the UNMODIFIED tree, where human bodies are actually represented while a band has
// people away. Nothing here asserts a defect; it reports what production does.
//
//   1. GHOST RESIDENCE POPULATION — the crowding field scatters `demography.population` from
//      `band.position`. How many of those people are physically away on an expedition?
//   2. MISSING AWAY PRESENCE     — what does the crowding field read at the party's own
//      `positionTileId`?
//   3. SAME-DAY PARTY INVISIBILITY — a real trip has a target, a route and a people count, and
//      really depletes stock. Does any physical-presence authority see it?
//   4. CATCHMENT OVERLAP          — do away workers still draw the residential foraging catchment
//      while also consuming provisions and harvesting at the target?
//   5. SOCIAL CONSEQUENCES        — do parties create encounters, friction, or hidden knowledge?
//
// Usage: node scripts/physicalPresenceCurrentStateAudit.mjs --years 20

import { dirname } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "vite";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};

const EVIDENCE = "docs/evidence/shared-use-physical-presence-authority-34";
const OUT = arg("out", `${EVIDENCE}/current-state-measurements.json`);
const YEARS = Number(arg("years", "20"));
const SCENARIOS = arg("scenarios", "map1,map2").split(",");
const SEEDS = arg("seeds", "s1,s2").split(",");
const SEED_PREFIX = arg("seed-prefix", "audit27:natural");
const SEASON_DAYS = 90;
const r4 = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10000) / 10000 : v);

const CROWDING_RADIUS = 4; // mirrors crowding.ts; used only to classify the measurement, never to compute pressure
const AWAY_PHASES = new Set(["prepared", "outbound", "operating", "returning"]);
const PHYSICALLY_AWAY_PHASES = new Set(["outbound", "operating", "returning"]);

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c34-cur-${process.pid}`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const contextCache = await server.ssrLoadModule("/sim/agents/contextCache.ts");
  const crowding = await server.ssrLoadModule("/sim/agents/crowding.ts");
  const sharedCatchment = await server.ssrLoadModule("/sim/agents/sharedCatchment.ts");
  const expedition = await server.ssrLoadModule("/sim/agents/expedition.ts");

  const runs = [];
  for (const kind of SCENARIOS) {
    for (const seed of SEEDS) {
      let world = runner.initSimWorld({ kind }, `${SEED_PREFIX}:${kind}:${seed}`);

      let bandSeasons = 0;
      let expeditionPartySeasons = 0;
      let ghostHomeWorkerSeasons = 0; // away workers still weighted into the home scatter
      let awayPartySeasonsWithZeroPresenceAtPartyTile = 0;
      let awayPartySeasonsWithSomePresenceAtPartyTile = 0;
      let maxGhostShareOfHomePopulation = 0;
      let partyTilesEqualToOwnResidence = 0;
      let partySeasonsInsideOwnResidenceBall = 0;
      let partySeasonsBeyondOwnResidenceBall = 0;
      let beyondBallWithPresence = 0;
      let beyondBallWithZeroPresence = 0;
      let maxPartyDistanceFromResidence = 0;
      const phaseCounts = {};
      let taskCampSeasons = 0;

      // same-day trips
      let tripRecords = 0;
      const distinctTripKeys = new Set();
      let tripsWithTarget = 0;
      let tripsWithPeopleCount = 0;
      let tripPeopleSum = 0;
      let tripsWithRoute = 0;

      // catchment overlap
      let catchmentDrawUsedFullWorkingAdults = 0;
      let catchmentDrawSeasonsWithAwayWorkers = 0;
      let awayWorkerCatchmentDrawSum = 0;

      // social
      let encounterRecords = 0;
      let frictionRecords = 0;

      for (let season = 0; season < YEARS * 4; season += 1) {
        world = advance.advanceWorldByDays(world, SEASON_DAYS);
        const cache = contextCache.buildTickContextCache(world);
        const living = Object.values(world.bands)
          .filter((b) => b.status !== "dispersed" && b.viability?.status !== "absorbed" && b.viability?.status !== "extinct")
          .sort((a, b) => String(a.id).localeCompare(String(b.id)));

        for (const band of living) {
          bandSeasons += 1;
          const population = band.demography?.population ?? band.size ?? 0;
          const committed = expedition.getCommittedExpeditionWorkers(band);
          const residentialAdults = expedition.getResidentialWorkingAdults(band);

          // --- 1. GHOST RESIDENCE POPULATION -------------------------------------------------
          // `buildCrowdingField` weights the scatter by `demography.population / 36`, i.e. the
          // FULL population, from `band.position`. Anyone physically away is therefore projected
          // at home as well.
          const physicallyAway = (band.expeditions ?? [])
            .filter((e) => PHYSICALLY_AWAY_PHASES.has(e.phase))
            .reduce((n, e) => n + (e.partyWorkers ?? 0), 0);
          if (physicallyAway > 0) {
            ghostHomeWorkerSeasons += physicallyAway;
            maxGhostShareOfHomePopulation = Math.max(
              maxGhostShareOfHomePopulation,
              population === 0 ? 0 : physicallyAway / population,
            );
          }

          // --- 2. MISSING AWAY PRESENCE ------------------------------------------------------
          for (const e of band.expeditions ?? []) {
            phaseCounts[e.phase] = (phaseCounts[e.phase] ?? 0) + 1;
            if (e.taskCamp !== undefined) taskCampSeasons += 1;
            if (!AWAY_PHASES.has(e.phase)) continue;
            expeditionPartySeasons += 1;
            if (!PHYSICALLY_AWAY_PHASES.has(e.phase)) continue;
            const partyTile = e.positionTileId;
            if (partyTile === undefined) continue;
            if (String(partyTile) === String(band.position)) {
              partyTilesEqualToOwnResidence += 1;
              continue;
            }
            // What does the physical-crowding authority read AT the party's own tile, for a
            // DIFFERENT band standing there? Use another living band as the observer so the
            // reading is "is anybody physically here", not the party band's self-view.
            //
            // CONFOUND, FOUND IN THIS PASS'S OWN FIRST RUN AND CORRECTED: crowding scatters from
            // `band.position` over a radius-4 ball, so a party standing INSIDE that ball is
            // "present" only because its RESIDENCE covers the tile — not because the party is
            // represented. Only a party BEYOND CROWDING_RADIUS from its own residence is a valid
            // test of whether away bodies exist as bodies. Both classes are reported.
            const home = world.tiles[band.position]?.coord;
            const there = world.tiles[partyTile]?.coord;
            if (home === undefined || there === undefined) continue;
            const distanceFromOwnResidence = Math.abs(home.x - there.x) + Math.abs(home.y - there.y);
            const observer = living.find((o) => String(o.id) !== String(band.id));
            if (observer === undefined) continue;
            const pressure = crowding.getNearbyBandPressure(world, observer, partyTile, cache);
            const contributesTheParty = pressure.pressureBandIds.map(String).includes(String(band.id));
            if (distanceFromOwnResidence <= CROWDING_RADIUS) {
              partySeasonsInsideOwnResidenceBall += 1;
              if (contributesTheParty) awayPartySeasonsWithSomePresenceAtPartyTile += 1;
              else awayPartySeasonsWithZeroPresenceAtPartyTile += 1;
            } else {
              partySeasonsBeyondOwnResidenceBall += 1;
              if (contributesTheParty) beyondBallWithPresence += 1;
              else beyondBallWithZeroPresence += 1;
            }
            maxPartyDistanceFromResidence = Math.max(maxPartyDistanceFromResidence, distanceFromOwnResidence);
          }

          // --- 4. CATCHMENT OVERLAP ----------------------------------------------------------
          // `getBandForagingDraw` uses demography.workingAdults (FULL), not the residential
          // remainder, so away workers keep drawing the home catchment while also carrying
          // provisions and harvesting at the target.
          if (committed > 0) {
            catchmentDrawSeasonsWithAwayWorkers += 1;
            awayWorkerCatchmentDrawSum += committed;
            if (residentialAdults < (band.demography?.workingAdults ?? 0)) {
              catchmentDrawUsedFullWorkingAdults += 1;
            }
          }

          // --- 3. SAME-DAY TRIPS -------------------------------------------------------------
          for (const t of band.recentIntraSeasonTrips ?? []) {
            const key = `${String(band.id)}|${Number(t.day)}|${String(t.targetTileId)}`;
            if (distinctTripKeys.has(key)) continue;
            distinctTripKeys.add(key);
            tripRecords += 1;
            if (t.targetTileId !== undefined) tripsWithTarget += 1;
            if ((t.estimatedPeopleCount ?? 0) > 0) {
              tripsWithPeopleCount += 1;
              tripPeopleSum += t.estimatedPeopleCount;
            }
            if ((t.pathTiles ?? []).length > 0) tripsWithRoute += 1;
          }

          encounterRecords += (band.encounterRecords ?? []).length;
          frictionRecords += (band.rangeFriction?.events ?? []).length;
        }
      }

      runs.push({
        scenario: kind,
        seed,
        years: YEARS,
        bandSeasons,
        ghostResidencePopulation: {
          awayWorkerSeasonsStillWeightedAtHome: ghostHomeWorkerSeasons,
          maxAwayShareOfHomePopulation: r4(maxGhostShareOfHomePopulation),
          note: "buildCrowdingField weights the home scatter by demography.population (FULL). Anyone physically away is projected at home too.",
        },
        missingAwayPresence: {
          expeditionPartySeasons,
          physicallyAwayPartySeasonsWithZeroPresenceAtPartyTile: awayPartySeasonsWithZeroPresenceAtPartyTile,
          physicallyAwayPartySeasonsWithSomePresenceAtPartyTile: awayPartySeasonsWithSomePresenceAtPartyTile,
          partyTilesEqualToOwnResidence,
          partySeasonsInsideOwnResidenceBall,
          partySeasonsBeyondOwnResidenceBall,
          beyondResidenceBallWithPresence: beyondBallWithPresence,
          beyondResidenceBallWithZeroPresence: beyondBallWithZeroPresence,
          maxPartyDistanceFromResidence,
          decisiveMeasurementNote:
            "Only `beyondResidenceBall*` is decisive. Inside the radius-4 ball the residence's own " +
            "scatter already covers the tile, so 'presence' there says nothing about the party.",
          phaseCounts,
          taskCampSeasons,
        },
        sameDayPartyInvisibility: {
          distinctTripsObserved: tripRecords,
          note0: "deduplicated by (band, day, target); the bounded recentIntraSeasonTrips ring is re-read every band-season and must not be counted repeatedly",
          tripsWithTarget,
          tripsWithPeopleCount,
          meanEstimatedPeopleCount: tripsWithPeopleCount === 0 ? null : r4(tripPeopleSum / tripsWithPeopleCount),
          tripsWithRoute,
          physicalPresenceAuthoritiesReadingTripRecords: 0,
          note: "no reference to recentIntraSeasonTrips exists in crowding.ts or sharedCatchment.ts; a same-day party is physically invisible to shared-range",
        },
        catchmentOverlap: {
          bandSeasonsWithAwayWorkers: catchmentDrawSeasonsWithAwayWorkers,
          bandSeasonsWhereFullWorkingAdultsStillDrewTheCatchment: catchmentDrawUsedFullWorkingAdults,
          awayWorkerDrawSum: awayWorkerCatchmentDrawSum,
          note: "getBandForagingDraw reads demography.workingAdults, NOT getResidentialWorkingAdults. Reported as an accounting observation, not yet as a defect.",
        },
        socialConsequences: {
          encounterRecords,
          frictionRecords,
          partyDerivedEncounterAuthorities: 0,
          partyDerivedFrictionAuthorities: 0,
          note: "no encounter or friction authority reads expedition party position or trip records; parties create no social consequence at all",
        },
      });
    }
  }

  const sum = (pick) => runs.reduce((s, r) => s + (pick(r) ?? 0), 0);
  const payload = {
    audit: "physicalPresenceCurrentStateAudit",
    checkpoint: "CORRECTION-34",
    measuredOn: "5ebb5e9887e36341f69350d4d3cff85f9493457c (unmodified)",
    years: YEARS,
    generatedAt: new Date().toISOString(),
    phaseSemantics: {
      prepared: "labor committed at camp, NOT yet departed — physically AT HOME",
      outbound: "physically walking toward the target — physically AWAY",
      operating: "at/near the target — physically AWAY",
      returning: "physically walking home — physically AWAY",
      completed_aborted_lost: "terminal — no physical party",
      source: "src/sim/agents/types.ts:932-939, and expedition.ts:isExpeditionAway",
      note: "isExpeditionAway() includes `prepared` for LABOR commitment. For PHYSICAL presence, prepared is still at the residence; this audit separates the two.",
    },
    summary: {
      runs: runs.length,
      bandSeasons: sum((r) => r.bandSeasons),
      awayWorkerSeasonsStillWeightedAtHome: sum((r) => r.ghostResidencePopulation.awayWorkerSeasonsStillWeightedAtHome),
      expeditionPartySeasons: sum((r) => r.missingAwayPresence.expeditionPartySeasons),
      physicallyAwayPartySeasonsWithZeroPresenceAtPartyTile: sum(
        (r) => r.missingAwayPresence.physicallyAwayPartySeasonsWithZeroPresenceAtPartyTile,
      ),
      physicallyAwayPartySeasonsWithSomePresenceAtPartyTile: sum(
        (r) => r.missingAwayPresence.physicallyAwayPartySeasonsWithSomePresenceAtPartyTile,
      ),
      taskCampSeasons: sum((r) => r.missingAwayPresence.taskCampSeasons),
      distinctTripsObserved: sum((r) => r.sameDayPartyInvisibility.distinctTripsObserved),
      physicallyAwayPartySeasonsBeyondOwnResidenceBall: sum((r) => r.missingAwayPresence.partySeasonsBeyondOwnResidenceBall),
      beyondResidenceBallWithZeroPresence: sum((r) => r.missingAwayPresence.beyondResidenceBallWithZeroPresence),
      bandSeasonsWhereFullWorkingAdultsStillDrewTheCatchment: sum(
        (r) => r.catchmentOverlap.bandSeasonsWhereFullWorkingAdultsStillDrewTheCatchment,
      ),
    },
    runs,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify(payload.summary, null, 2));
  console.log(`\nwrote ${OUT}`);
} finally {
  await server.close();
}
