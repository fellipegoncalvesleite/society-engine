// CLOSURE-25 — resource investigation / temporary use authority observation.
//
// Observes the production chain
//   uncertainty -> investigation decision -> target -> workers leave -> route/time/
//   provisions/risk -> physical observation or use -> return/failure/loss -> memory ->
//   receipt -> later behaviour
// by stepping production day by day and reading only state production already writes.
//
// NO PRODUCTION INSTRUMENTATION IS USED. Every identity below is a field the simulation
// already persists: world.decisions, band.expeditions (ExpeditionRecord), band
// .recentIntraSeasonTrips (IntraSeasonTripRecord), band.campMovement.temporaryTaskCamps,
// band.seasonalFoodReceipts. Live expeditions are dropped at terminal, so parties are
// captured per day while they are still active and joined afterwards by expedition id.
//
// Usage:
//   node scripts/resourceInvestigationAuthorityAudit.mjs --years 20 \
//     --scenarios map1,map2,ordinary --seeds s1

import { dirname } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "vite";

/** Reads one `--name value` argument. */
const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined
    ? process.argv[index + 1]
    : fallback;
};

const YEARS = Number(arg("years", "20"));
const TOTAL_DAYS = YEARS * 360;
const SEEDS = arg("seeds", "s1").split(",").filter(Boolean);
const SEED_PREFIX = arg("seed-prefix", "c25:authority");
const OUT = arg(
  "out",
  "docs/evidence/resource-investigation-authority-25/natural-occurrence.json",
);
const RAW_CAP = Number(arg("raw-cap", "40"));

const ALL_SCENARIOS = [
  { name: "map1", map: "map1", fixture: "default" },
  { name: "map2", map: "map2", fixture: "default" },
  { name: "ordinary", map: "map2", site: "tile:62:108" },
  { name: "site_A_coast", map: "map2", site: "tile:204:72" },
  { name: "site_B_dry_plains", map: "map2", site: "tile:10:34" },
  { name: "site_C_dry_plains", map: "map2", site: "tile:100:23" },
  { name: "site_D_aquatic", map: "map2", site: "tile:119:116" },
  { name: "site_E_hills", map: "map2", site: "tile:139:41" },
  { name: "site_F_hills", map: "map2", site: "tile:45:28" },
  { name: "isolated_marginal", map: "map2", site: "tile:16:34" },
  { name: "hostile", map: "map2", site: "tile:45:120" },
];

const requested = arg("scenarios", "map1,map2,ordinary");
const SCENARIOS = ALL_SCENARIOS.filter((scenario) =>
  requested.split(",").includes(scenario.name),
);

/** The authority-ledger families this audit counts. */
const FAMILIES = [
  "resource_scout",
  "logistical_probe",
  "same_day_water_check",
  "same_day_resource_trip",
  "distant_patch_verification",
  "route_reconnaissance",
  "frontier_exploration",
  "distant_physical_gathering",
  "expedition_task_camp",
  "camp_movement_temporary_record",
  "frontier_verification_temporary_use",
  "returned_physical_food_receipt",
];

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c25-authority-${process.pid}`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const spawn = await server.ssrLoadModule("/sim/agents/spawn.ts");
  const receipts = await server.ssrLoadModule(
    "/sim/agents/seasonalFoodReceipts.ts",
  );

  /** Builds one deterministic production world. */
  const buildWorld = (scenario, seed) => {
    let world = runner.initSimWorld(
      { kind: scenario.map },
      `${SEED_PREFIX}:${seed}`,
    );

    if (scenario.fixture !== "default") {
      world = spawn.removeInitialBands(world, Object.keys(world.bands));
      world = spawn.spawnCustomBands(
        world,
        [{ tileId: scenario.site, population: 34, name: scenario.name }],
        `${SEED_PREFIX}:${seed}`,
      );
    }

    return world;
  };

  /** Classifies one same-day trip record into its ledger family. */
  const tripFamily = (trip) => {
    if (trip.physicalFoodHarvest !== undefined) {
      return "same_day_resource_trip";
    }
    if (String(trip.cause) === "water_check") {
      return "same_day_water_check";
    }
    return "same_day_information_trip";
  };

  /** Classifies one expedition record into its ledger family. */
  const expeditionFamily = (expedition) => {
    switch (String(expedition.taskKind)) {
      case "frontier_exploration":
        return "frontier_exploration";
      case "frontier_verification":
        return "distant_patch_verification";
      case "route_reconnaissance":
        return "route_reconnaissance";
      default:
        return "distant_physical_gathering";
    }
  };

  const runs = [];
  const totals = Object.fromEntries(
    [...FAMILIES, "same_day_information_trip"].map((family) => [family, 0]),
  );
  const rawSamples = Object.fromEntries(
    [...FAMILIES, "same_day_information_trip"].map((family) => [family, []]),
  );

  /** Keeps a bounded, deterministic raw sample per family. */
  const sample = (family, row) => {
    totals[family] = (totals[family] ?? 0) + 1;
    if (rawSamples[family].length < RAW_CAP) {
      rawSamples[family].push(row);
    }
  };

  for (const scenario of SCENARIOS) {
    for (const seed of SEEDS) {
      let world = buildWorld(scenario, seed);

      const seenDecisions = new Set();
      const seenTrips = new Set();
      const seenCamps = new Set();
      const seenExpeditionCamps = new Set();
      const seenReceiptPeriods = new Set();
      // expeditionId -> the last per-day physical snapshot we saw while it was alive.
      const expeditionTrace = new Map();
      const runCounts = Object.fromEntries(
        [...FAMILIES, "same_day_information_trip"].map((f) => [f, 0]),
      );
      const bump = (family) => {
        runCounts[family] = (runCounts[family] ?? 0) + 1;
      };

      for (let day = 1; day <= TOTAL_DAYS; day += 1) {
        world = advance.advanceWorldByDays(world, 1);
        const currentDay = Number(world.time.day ?? day);

        // --- seasonal decisions -------------------------------------------------
        for (const decision of Object.values(world.decisions ?? {})) {
          const id = String(decision.id);
          if (seenDecisions.has(id)) continue;
          seenDecisions.add(id);

          const type = String(decision.action?.type ?? "");
          if (type !== "resource_scout" && type !== "logistical_probe") continue;

          const band = world.bands?.[decision.bandId];
          bump(type);
          sample(type, {
            family: type,
            scenario: scenario.name,
            seed,
            decisionId: id,
            bandId: String(decision.bandId ?? ""),
            tick: Number(decision.time?.tick ?? 0),
            day: currentDay,
            originTileId: String(decision.action.originTileId ?? ""),
            targetTileId: String(decision.action.targetTileId ?? ""),
            scoutKind: decision.action.scoutKind ?? null,
            targetResourceClass: decision.action.targetResourceClass ?? null,
            // Physical fields the action does NOT carry. Recorded as explicit
            // absences rather than left out, so the ledger cannot read silence
            // as "present but unmeasured".
            partyOrExpeditionId: null,
            workers: null,
            routeTileIds: null,
            durationDays: null,
            provisionsLoaded: null,
            riskEpisodeIds: null,
            stockDrawn: null,
            cargo: null,
            receiptId: null,
            bandPositionAfter: band === undefined ? null : String(band.position),
          });
        }

        // --- live expeditions, captured while still joinable ---------------------
        for (const band of Object.values(world.bands ?? {})) {
          for (const expedition of band.expeditions ?? []) {
            const id = String(expedition.id);
            const prior = expeditionTrace.get(id);
            const snapshot = {
              family: expeditionFamily(expedition),
              scenario: scenario.name,
              seed,
              expeditionId: id,
              bandId: String(expedition.bandId ?? band.id),
              taskKind: String(expedition.taskKind),
              lastPhase: String(expedition.phase),
              originTileId: String(expedition.originTileId ?? ""),
              targetTileId: String(expedition.targetTileId ?? ""),
              positionTileId: String(expedition.positionTileId ?? ""),
              departedDay: Number(expedition.departedDay ?? 0),
              lastSeenDay: currentDay,
              partyWorkers: Number(expedition.partyWorkers ?? 0),
              partyComposition: expedition.partyComposition ?? null,
              routeTileIds: [...(expedition.routeTileIds ?? [])].map(String),
              routeLength: (expedition.routeTileIds ?? []).length,
              provisionUnitsConsumed:
                expedition.cargo?.provisionUnitsConsumed ?? null,
              riskEpisodeIds: [...(expedition.riskEpisodeIds ?? [])].map(String),
              taskCamp: expedition.taskCamp
                ? {
                    tileId: String(expedition.taskCamp.tileId),
                    establishedDay: Number(expedition.taskCamp.establishedDay),
                    expiresOnDay: Number(expedition.taskCamp.expiresOnDay),
                    reason: String(expedition.taskCamp.reason),
                    usedDays: Number(expedition.taskCamp.usedDays),
                    noResidentialRelocation:
                      expedition.taskCamp.noResidentialRelocation === true,
                    noStorage: expedition.taskCamp.noStorage === true,
                    noTerritoryClaim:
                      expedition.taskCamp.noTerritoryClaim === true,
                  }
                : null,
              outcomeReason: expedition.outcomeReason ?? null,
            };
            expeditionTrace.set(id, { ...(prior ?? {}), ...snapshot });

            if (
              expedition.taskCamp !== undefined &&
              !seenExpeditionCamps.has(id)
            ) {
              seenExpeditionCamps.add(id);
              bump("expedition_task_camp");
              sample("expedition_task_camp", {
                family: "expedition_task_camp",
                scenario: scenario.name,
                seed,
                expeditionId: id,
                bandId: String(band.id),
                taskKind: String(expedition.taskKind),
                campTileId: String(expedition.taskCamp.tileId),
                establishedDay: Number(expedition.taskCamp.establishedDay),
                reason: String(expedition.taskCamp.reason),
                partyWorkers: Number(expedition.partyWorkers ?? 0),
                routeLength: (expedition.routeTileIds ?? []).length,
                bandPositionAtEstablish: String(band.position),
                noResidentialRelocation:
                  expedition.taskCamp.noResidentialRelocation === true,
                noStorage: expedition.taskCamp.noStorage === true,
                noTerritoryClaim:
                  expedition.taskCamp.noTerritoryClaim === true,
              });
            }
          }

          // --- same-day trips ---------------------------------------------------
          for (const trip of band.recentIntraSeasonTrips ?? []) {
            const key = `${band.id}:${trip.day}:${trip.targetTileId}:${trip.cause}:${trip.objective}`;
            if (seenTrips.has(key)) continue;
            seenTrips.add(key);

            const family = tripFamily(trip);
            bump(family);
            const credited = receipts.isCreditedFoodReceipt(trip);
            sample(family, {
              family,
              scenario: scenario.name,
              seed,
              tripKey: key,
              bandId: String(band.id),
              day: Number(trip.day),
              tick: Number(trip.tick),
              originTileId: String(trip.originTileId),
              targetTileId: String(trip.targetTileId),
              cause: String(trip.cause),
              objective: String(trip.objective),
              taskGroupType: String(trip.taskGroupType),
              estimatedPeopleCount: Number(trip.estimatedPeopleCount ?? 0),
              pathTiles: [...(trip.pathTiles ?? [])].map(String),
              tilesCrossed: Number(trip.tilesCrossed ?? 0),
              distanceTiles: Number(trip.distanceTiles ?? 0),
              activityDaysRepresented: Number(trip.activityDaysRepresented ?? 0),
              outcome: String(trip.outcome),
              activityResult: String(trip.activityResult),
              inspectionOnly: trip.inspectionOnly === true,
              returnedResourceKind:
                trip.resourceReturn?.returnedResourceKind ?? null,
              consumedByEconomy:
                trip.resourceReturn?.consumedByEconomy ?? null,
              physicalFoodHarvest: trip.physicalFoodHarvest
                ? {
                    sourceKind: String(trip.physicalFoodHarvest.sourceKind),
                    sourceId: trip.physicalFoodHarvest.sourceId ?? null,
                    harvestedAmount:
                      trip.physicalFoodHarvest.harvestedAmount ?? 0,
                    transportLoss: trip.physicalFoodHarvest.transportLoss ?? 0,
                    processingLoss:
                      trip.physicalFoodHarvest.processingLoss ?? 0,
                    usableSupport: trip.physicalFoodHarvest.usableSupport ?? 0,
                  }
                : null,
              plantPatchTrace: trip.plantPatchTrace ? true : false,
              animalActivityTrace: trip.animalActivityTrace ? true : false,
              aquaticActivityTrace: trip.aquaticActivityTrace ? true : false,
              creditedFoodReceipt: credited,
            });

            if (credited) {
              bump("returned_physical_food_receipt");
              sample("returned_physical_food_receipt", {
                family: "returned_physical_food_receipt",
                scenario: scenario.name,
                seed,
                bandId: String(band.id),
                day: Number(trip.day),
                receiptPeriodTick: Number(trip.tick),
                sourceKind: String(trip.physicalFoodHarvest.sourceKind),
                usableSupport: trip.physicalFoodHarvest.usableSupport,
                consumedByEconomy: trip.resourceReturn.consumedByEconomy,
                returnedResourceKind:
                  trip.resourceReturn.returnedResourceKind,
                targetTileId: String(trip.targetTileId),
              });
            }
          }

          // --- campMovement temporary task camps --------------------------------
          for (const camp of band.campMovement?.temporaryTaskCamps ?? []) {
            const id = String(camp.id);
            if (seenCamps.has(id)) continue;
            seenCamps.add(id);
            bump("camp_movement_temporary_record");
            sample("camp_movement_temporary_record", {
              family: "camp_movement_temporary_record",
              scenario: scenario.name,
              seed,
              campRecordId: id,
              bandId: String(band.id),
              tick: Number(camp.tick),
              originTileId: String(camp.originTileId),
              targetTileId: String(camp.targetTileId),
              purpose: String(camp.purpose),
              status: String(camp.status),
              confidence: camp.confidence,
              expiresAfterTick: Number(camp.expiresAfterTick),
              evidenceRefCount: (camp.evidenceRefs ?? []).length,
              noSettlement: camp.noSettlement === true,
              noInventory: camp.noInventory === true,
              // JOIN ATTEMPT (A2). These are the physical identities an
              // ExpeditionTaskCamp carries. The record does not carry them.
              joinExpeditionId: camp.expeditionId ?? null,
              joinPartyWorkers: camp.partyWorkers ?? null,
              joinRouteTileIds: camp.routeTileIds ?? null,
              joinPhysicalOccupancyDay: camp.establishedDay ?? null,
              joinTaskWork: camp.workDays ?? null,
              joinReceiptId: camp.receiptId ?? null,
            });
          }

          // --- receipt accumulator periods --------------------------------------
          const acc = band.seasonalFoodReceipts;
          if (acc !== undefined) {
            const key = `${band.id}:${acc.periodTick}`;
            if (!seenReceiptPeriods.has(key)) {
              seenReceiptPeriods.add(key);
            }
          }
        }
      }

      // Terminal expedition snapshots, joined by id after the run.
      for (const trace of expeditionTrace.values()) {
        bump(trace.family);
        sample(trace.family, trace);
      }

      runs.push({
        scenario: scenario.name,
        seed,
        years: YEARS,
        counts: { ...runCounts },
        distinctExpeditions: expeditionTrace.size,
        distinctCampMovementRecords: seenCamps.size,
        distinctReceiptPeriods: seenReceiptPeriods.size,
      });

      console.log(
        `${scenario.name.padEnd(18)} ${seed} scout=${String(runCounts.resource_scout).padStart(4)} ` +
          `probe=${String(runCounts.logistical_probe).padStart(4)} ` +
          `foodTrip=${String(runCounts.same_day_resource_trip).padStart(5)} ` +
          `water=${String(runCounts.same_day_water_check).padStart(5)} ` +
          `exped=${String(expeditionTrace.size).padStart(4)} ` +
          `taskCamp=${String(runCounts.expedition_task_camp).padStart(3)} ` +
          `campRec=${String(runCounts.camp_movement_temporary_record).padStart(4)} ` +
          `receipts=${String(runCounts.returned_physical_food_receipt).padStart(5)}`,
      );
    }
  }

  const requiredPresent = {
    resource_scout: totals.resource_scout > 0,
    same_day_resource_trip: totals.same_day_resource_trip > 0,
    information_only_trip:
      totals.same_day_water_check + totals.same_day_information_trip > 0,
    multi_day_information_expedition:
      totals.distant_patch_verification + totals.route_reconnaissance +
        totals.frontier_exploration >
      0,
    multi_day_physical_retrieval: totals.distant_physical_gathering > 0,
    expedition_task_camp: totals.expedition_task_camp > 0,
    camp_movement_temporary_record:
      totals.camp_movement_temporary_record > 0,
    returned_physical_food_receipt:
      totals.returned_physical_food_receipt > 0,
  };

  const document = {
    instrument:
      "CLOSURE-25 — RESOURCE INVESTIGATION / TEMPORARY USE NATURAL OCCURRENCE",
    productionInstrumentation:
      "NONE. Every field is read from state production already persists.",
    years: YEARS,
    scenarios: SCENARIOS.map((s) => s.name),
    seeds: SEEDS,
    seedPrefix: SEED_PREFIX,
    rawSampleCapPerFamily: RAW_CAP,
    totals,
    requiredPresent,
    allRequiredPresent: Object.values(requiredPresent).every(Boolean),
    runs,
    rawSamples,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(document, null, 2)}\n`, "utf8");

  console.log("");
  for (const [key, value] of Object.entries(totals)) {
    console.log(`${key.padEnd(36)} ${value}`);
  }
  console.log("");
  for (const [key, value] of Object.entries(requiredPresent)) {
    console.log(`${value ? "PRESENT" : "ABSENT "} ${key}`);
  }
  console.log(`wrote ${OUT}`);
} finally {
  await server.close();
}
