// ROADMAP ITEM 4 — C1-C12: CLEANUP BACK TO TRUTHFUL PHYSICAL EVIDENCE.
//
// These fixtures distinguish physical measurement from lifecycle authority. Pure controls exercise
// the bounded assessment instrument; world controls use real departure, plant depletion,
// reintegration, demography and extinction writers. Every fixture carries a positive non-vacuity
// predicate, and VACUOUS fails the run exactly like FAIL.
import { createServer } from "vite";
import { prepareAndDepart } from "./lib/preparedDeparture.mjs";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};

const OUT = arg("out", "docs/evidence/dynamic-fission-daughter-viability-37/provisional-evidence-cleanup.json");
const SEED = arg("seed", "audit27:natural:s1");
const WARM_DAYS = Number(arg("warm-days", "2100"));

const fixtures = [];
const record = (id, claim, passed, nonVacuous, detail) => {
  fixtures.push({
    id,
    claim,
    verdict: nonVacuous === false ? "VACUOUS" : passed ? "PASS" : "FAIL",
    nonVacuous: nonVacuous !== false,
    detail,
  });
};

function sourceFilesUnder(root) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...sourceFilesUnder(path));
    else if (entry.isFile() && path.endsWith(".ts")) files.push(path);
  }
  return files;
}

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-item4-cleanup-${process.pid}`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const generate = await server.ssrLoadModule("/sim/world/generate.ts");
  const passability = await server.ssrLoadModule("/sim/world/passability.ts");
  const lifecycle = await server.ssrLoadModule("/sim/agents/bandLifecycle.ts");
  const kernel = await server.ssrLoadModule("/sim/agents/fissionLifecycleKernel.ts");
  const seam = await server.ssrLoadModule("/sim/agents/fissionDepartureSeam.ts");
  const prep = await server.ssrLoadModule("/sim/agents/fissionDeparturePreparation.ts");
  const subsistence = await server.ssrLoadModule("/sim/agents/provisionalTravelSubsistence.ts");
  const establishment = await server.ssrLoadModule("/sim/agents/provisionalEstablishment.ts");
  const resolver = await server.ssrLoadModule("/sim/agents/provisionalLifecycleResolver.ts");
  const reintegration = await server.ssrLoadModule("/sim/agents/provisionalReintegration.ts");
  const travel = await server.ssrLoadModule("/sim/agents/provisionalTravel.ts");
  const plantStock = await server.ssrLoadModule("/sim/agents/plantStock.ts");
  const transferPolicy = await server.ssrLoadModule("/sim/agents/fissionFieldTransferPolicy.ts");

  const base = advance.advanceWorldByDays(runner.initSimWorld({ kind: "map2" }, SEED), WARM_DAYS);
  const day0 = Number(base.time.day ?? 0);
  const donor = Object.values(base.bands)
    .filter((band) =>
      lifecycle.isEstablishedBand(band) &&
      band.demography.workingAdults >= 6 &&
      band.demography.population >= 24 &&
      (band.acuteRisk?.activeEffect?.mortalityRiskBump ?? 0) <= 0.3)
    .sort((a, b) => b.demography.population - a.demography.population)[0];
  if (donor === undefined) throw new Error("HARNESS HARD FAIL: no suitable donor band");

  const tiles = Object.values(base.tiles);
  const withPatch = tiles.find((tile) =>
    String(tile.id) !== String(donor.position) &&
    passability.isBandPassableDestination(tile) &&
    plantStock.resolvePlantFoodHarvest(base, tile, base.time, 0.2, true).harvestedAmount > 0);
  if (withPatch === undefined) throw new Error("HARNESS HARD FAIL: no non-parent passable tile with food");

  const home = generate.getTile(base, donor.position);
  const distanceFromHome = (tile) =>
    Math.abs(tile.coord.x - home.coord.x) + Math.abs(tile.coord.y - home.coord.y);
  const target = Object.keys(donor.knowledge.observedTiles)
    .map((id) => generate.getTile(base, id))
    .filter((tile) => tile !== undefined && passability.isBandPassableDestination(tile) && distanceFromHome(tile) >= 4)
    .sort((a, b) => distanceFromHome(a) - distanceFromHome(b) || String(a.id).localeCompare(String(b.id)))[0];
  if (target === undefined) throw new Error("HARNESS HARD FAIL: no known passable target at distance >= 4");

  const populationShape = (population, workingAdults, dependents) => ({
    population,
    workingAdults,
    dependents,
    elders: population - workingAdults - dependents,
  });

  const makeSuccessor = (world, overrides = {}) => {
    const id = overrides.id ?? "band:cleanup:successor";
    const population = overrides.population ?? 8;
    const workingAdults = overrides.workingAdults ?? 4;
    const dependents = overrides.dependents ?? 3;
    const band = {
      ...donor,
      ...transferPolicy.buildPolicyStructuralResets(),
      id,
      parentBandId: donor.id,
      position: overrides.position ?? withPatch.id,
      size: population,
      demography: {
        ...donor.demography,
        ...populationShape(population, workingAdults, dependents),
      },
      seasonalSupport: overrides.seasonalSupport ?? donor.seasonalSupport,
      acuteRisk: overrides.acuteRisk ?? donor.acuteRisk,
      hungerPressure: overrides.hungerPressure ?? donor.hungerPressure,
      provisionalSuccessor: {
        phase: overrides.phase ?? "establishing",
        phaseEnteredDay: overrides.phaseEnteredDay ?? day0,
        history: overrides.history ?? ["travelling"],
        lineageId: overrides.lineageId ?? "LIN-CLEANUP",
        targetTileId: overrides.targetTileId ?? target.id,
        departureTileId: donor.position,
        trail: overrides.trail ?? [],
        blockedStepDays: overrides.blockedStepDays ?? 0,
        travelSubsistence: overrides.travelSubsistence,
        operationHistory: overrides.operationHistory,
        establishment: overrides.establishment,
      },
    };
    return { ...world, bands: { ...world.bands, [id]: band } };
  };

  const emptyEstablishment = (tileId, openedDay = day0) => ({
    siteTileId: tileId,
    sinceDay: openedDay,
    closedIntervalsAtEntry: 0,
    windowOpenedDay: openedDay,
    windowsAssessed: 0,
    daysAtSite: 0,
    productiveGatheringDaysAtSite: 0,
    waterStressDaySumAtSite: 0,
    supportUnitsAtSite: 0,
    demandUnitsAtSite: 0,
    signals: [],
    satisfiedSignals: 0,
  });

  const richEstablishment = (tileId) => ({
    ...emptyEstablishment(tileId, day0 - 60),
    daysAtSite: 60,
    productiveGatheringDaysAtSite: 20,
    waterStressDaySumAtSite: 6,
    supportUnitsAtSite: 3.4,
    demandUnitsAtSite: 4.5,
  });

  const dayRecord = (day, tileId, support, depletion, demand = 0.1) => ({
    day,
    tileId,
    gatherShare: 0.5,
    gatheringWorkers: 2,
    requestedUnits: support,
    harvestedUnits: support,
    usableUnits: support,
    depletionApplied: depletion,
    demandUnits: demand,
    waterStress: 0.2,
    sourceKind: support > 0 ? "plant_patch" : "none",
    ...(support > 0 ? { sourceId: `fixture:${String(tileId)}` } : { failureReason: "no_source" }),
  });

  const buildHistory = (tileIds, supportForDay = () => 0.02) => {
    let state;
    for (let i = 0; i < 10; i += 1) {
      const support = supportForDay(i);
      state = subsistence.advanceOperationHistory(
        state,
        dayRecord(day0 + i + 1, tileIds[i % tileIds.length], support, support > 0 ? support : 0),
        2,
        9,
      );
    }
    return state;
  };

  const RESIDUAL = {
    physicallyAwayPeople: 0,
    physicallyAwayWorkers: 0,
    preparedCommitmentWorkers: 0,
    foodDemographicPressure: 0,
    chronicFoodStress: 0,
    chronicDeficitStreak: 0,
    nutritionMeasured: true,
    acuteRiskSeverity: 0,
    sicknessBurden: 0,
    careTravelBurden: 0,
    embodiedConditionMeasured: true,
    ecologicalRisk: 0,
    ecologicalPositionMeasured: true,
    mobilityCapabilityBefore: 1,
    mobilityCapabilityAfter: 1,
    minimumFounderRequest: 2,
  };

  const depart = (successorBandId, lineageId) => {
    const requested = Math.max(2, Math.floor(donor.demography.population * 0.35));
    const result = prepareAndDepart({
      prep, seam, world: base, parentId: donor.id, today: day0,
      lineageId, requestedFounders: requested, targetTileId: String(target.id), successorBandId,
    }).departure;
    if (result.ok !== true) throw new Error(`HARNESS HARD FAIL: departure refused: ${result.refusal}`);
    return result;
  };

  // C1 — source proof plus an adversarial rich record.
  const productionFiles = sourceFilesUnder(join(process.cwd(), "src"));
  const productionSources = productionFiles.map((path) => ({ path, text: readFileSync(path, "utf8") }));
  const stabilizationCallSites = productionSources.flatMap(({ path, text }) =>
    [...text.matchAll(/to\s*:\s*["']stabilized["']/g)].map((match) => ({ path, offset: match.index })));
  const richState = makeSuccessor(base, {
    id: "band:cleanup:c1",
    position: target.id,
    phase: "establishing",
    phaseEnteredDay: day0 - 60,
    establishment: richEstablishment(target.id),
    travelSubsistence: { ...subsistence.emptyTravelSubsistence(day0), closedIntervals: 2 },
    acuteRisk: {
      ...(donor.acuteRisk ?? { recentEpisodes: [] }),
      activeEffect: { ...(donor.acuteRisk?.activeEffect ?? {}), mortalityRiskBump: 0 },
    },
  });
  const richResult = establishment.advanceProvisionalEstablishment(richState, day0 + 1);
  const richBand = richResult.world.bands["band:cleanup:c1"];
  const stabilizationAuthorityPath = join("src", "sim", "agents", "successorStabilization.ts");
  record(
    "C1_only_the_dedicated_positive_authority_can_request_stabilized",
    "the sole production request for `stabilized` belongs to the dedicated successor authority; descriptive establishment remains unable to graduate even a rich diagnostic record",
    stabilizationCallSites.length === 1 &&
      stabilizationCallSites[0].path.endsWith(stabilizationAuthorityPath) &&
      kernel.PHASE_CONTRACTS.every((contract) => contract.onTimeout !== "stabilized") &&
      richBand.provisionalSuccessor.phase === "establishing" &&
      richResult.assessments[0].signals.every((signal) => signal.holds),
    productionFiles.length > 100 && richResult.assessments.length === 1,
    {
      productionTypeScriptFilesSearched: productionFiles.length,
      stabilizationCallSites,
      richRecord: {
        phase: richBand.provisionalSuccessor.phase,
        outcome: richResult.assessments[0].outcome,
        holdingDiagnostics: richResult.assessments[0].signals.filter((signal) => signal.holds).length,
        diagnosticCount: richResult.assessments[0].signals.length,
      },
    },
  );

  // C2 — a closed window retains the actual numerator, denominator and depletion.
  const measuredHistory = buildHistory([withPatch.id]);
  const measuredWindow = measuredHistory.recentAssessmentWindows[0];
  record(
    "C2_assessment_windows_record_physical_quantities_without_lifecycle_authority",
    "the uniform demand window closes with real support, demand and depletion totals but contains no phase or outcome field",
    measuredHistory.lifetimeAssessmentWindows === 1 &&
      measuredWindow.supportUnits > 0 && measuredWindow.demandUnits > 0 && measuredWindow.depletionApplied > 0 &&
      measuredWindow.closedBy === "demand_window_complete" &&
      !("phase" in measuredWindow) && !("outcome" in measuredWindow),
    measuredWindow !== undefined && measuredWindow.days >= 10,
    { history: measuredHistory, window: measuredWindow },
  );

  // C3 — the boolean says only that some physical take occurred.
  const microscopic = buildHistory([withPatch.id], (i) => i === 0 ? 0.0001 : 0);
  const microscopicWindow = microscopic.recentAssessmentWindows[0];
  const microscopicWorld = makeSuccessor(base, {
    id: "band:cleanup:c3",
    phase: "establishing",
    operationHistory: microscopic,
    establishment: emptyEstablishment(withPatch.id),
  });
  const microscopicResult = establishment.advanceProvisionalEstablishment(microscopicWorld, day0 + 20);
  record(
    "C3_microscopic_take_records_only_the_truthful_fact",
    "a microscopic extracted amount sets `hadAnyOwnPhysicalTake`, while its tiny support share has no stabilization effect",
    microscopicWindow.hadAnyOwnPhysicalTake === true &&
      microscopicWindow.supportUnits / microscopicWindow.demandUnits < 0.001 &&
      microscopicResult.world.bands["band:cleanup:c3"].provisionalSuccessor.phase === "establishing",
    microscopicWindow.depletionApplied > 0 && microscopicWindow.supportUnits > 0,
    { window: microscopicWindow, resultingPhase: microscopicResult.world.bands["band:cleanup:c3"].provisionalSuccessor.phase },
  );

  // C4 — locality cardinality remains descriptive.
  const neighbour = generate.getNeighborTiles(base, withPatch.id)
    .filter((tile) => passability.isBandPassableDestination(tile))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];
  if (neighbour === undefined) throw new Error("HARNESS HARD FAIL: no adjacent passable locality");
  const oneLocality = buildHistory([withPatch.id]);
  const twoLocalities = buildHistory([withPatch.id, neighbour.id]);
  const oneWorld = makeSuccessor(base, {
    id: "band:cleanup:c4:one",
    operationHistory: oneLocality,
    establishment: emptyEstablishment(withPatch.id),
  });
  const twoWorld = makeSuccessor(base, {
    id: "band:cleanup:c4:two",
    operationHistory: twoLocalities,
    establishment: emptyEstablishment(withPatch.id),
  });
  const oneResult = establishment.advanceProvisionalEstablishment(oneWorld, day0 + 20);
  const twoResult = establishment.advanceProvisionalEstablishment(twoWorld, day0 + 20);
  record(
    "C4_locality_count_is_descriptive_only",
    "one-locality and multi-locality histories retain different physical provenance and neither decides group identity",
    oneLocality.lifetimeTileIdsWithAnyPhysicalTake.length === 1 &&
      twoLocalities.lifetimeTileIdsWithAnyPhysicalTake.length === 2 &&
      oneResult.world.bands["band:cleanup:c4:one"].provisionalSuccessor.phase === "establishing" &&
      twoResult.world.bands["band:cleanup:c4:two"].provisionalSuccessor.phase === "establishing",
    String(withPatch.id) !== String(neighbour.id),
    {
      oneLocality: oneLocality.lifetimeTileIdsWithAnyPhysicalTake,
      twoLocalities: twoLocalities.lifetimeTileIdsWithAnyPhysicalTake,
      phases: [
        oneResult.world.bands["band:cleanup:c4:one"].provisionalSuccessor.phase,
        twoResult.world.bands["band:cleanup:c4:two"].provisionalSuccessor.phase,
      ],
    },
  );

  // C5 — no speculative parent-support state or writer.
  const forbiddenSupportNames = [
    "receivedParentSupport",
    "everReceivedParentSupport",
    "receivedParentSupportDuringAttempt",
  ];
  const supportNameHits = productionSources.flatMap(({ path, text }) =>
    forbiddenSupportNames.filter((name) => text.includes(name)).map((name) => ({ path, name })));
  const typeSource = readFileSync(join(process.cwd(), "src/sim/agents/types.ts"), "utf8");
  record(
    "C5_parent_support_gate_is_gone_without_a_fictitious_writer",
    "no speculative parent-support field exists; the future comment distinguishes lifetime history from a real committed-attempt fact",
    supportNameHits.length === 0 &&
      typeSource.includes("lifetime support history") &&
      typeSource.includes("support during a real committed attempt"),
    productionSources.some(({ text }) => text.includes("operationHistory")),
    { forbiddenSupportNames, supportNameHits },
  );

  // C6 — elapsed time ends only the return action.
  const kernelFailedReturn = kernel.resolveTimeout(
    { phase: "returning", phaseEnteredDay: 0, history: ["travelling", "establishing", "failed_early"] },
    kernel.RETURN_MAX_DAYS,
  );
  const resolverInput = makeSuccessor(base, {
    id: "band:cleanup:c6",
    phase: "returning",
    phaseEnteredDay: day0 - kernel.RETURN_MAX_DAYS,
  });
  const resolverResult = resolver.resolveProvisionalLifecycles(resolverInput, day0);
  const c6Band = resolverResult.world.bands["band:cleanup:c6"];
  record(
    "C6_failed_return_cannot_become_establishing_from_time",
    "both the pure kernel and world resolver route an expired return into the named unresolved living condition, never attempt #2",
    kernelFailedReturn.ok === true && kernelFailedReturn.state.phase === "unresolved_after_failed_return" &&
      c6Band.provisionalSuccessor.phase === "unresolved_after_failed_return" &&
      !resolverResult.resolutions.some((entry) => entry.toPhase === "establishing"),
    resolverResult.resolutions.some((entry) => entry.fromPhase === "returning"),
    { kernelFailedReturn, resolutions: resolverResult.resolutions },
  );

  // C7 — unresolved people still eat, deplete, feel water/hunger, and pass through demography.
  const unresolvedWorld = makeSuccessor(base, {
    id: "band:cleanup:c7",
    phase: "unresolved_after_failed_return",
    position: withPatch.id,
    population: 40,
    workingAdults: 24,
    dependents: 12,
  });
  const physicalDay = subsistence.advanceProvisionalSubsistence(unresolvedWorld, day0 + 1);
  const c7Day = physicalDay.days.find((entry) => entry.bandId === undefined || String(entry.tileId) === String(withPatch.id));
  const c7AfterDay = physicalDay.world.bands["band:cleanup:c7"];
  const patchBefore = c7Day?.sourceId === undefined ? 0 : (unresolvedWorld.plantPatchState?.[c7Day.sourceId]?.cumulativeUse ?? 0);
  const patchAfter = c7Day?.sourceId === undefined ? 0 : (physicalDay.world.plantPatchState?.[c7Day.sourceId]?.cumulativeUse ?? 0);
  const daysToNextSpring = 360 - (day0 % 360);
  const afterAnnual = advance.advanceWorldByDays(unresolvedWorld, daysToNextSpring);
  const c7AfterAnnual = afterAnnual.bands["band:cleanup:c7"];
  const demographicDayBefore = Number(unresolvedWorld.bands["band:cleanup:c7"].demography.lastDemographicUpdate?.day ?? -1);
  const demographicDayAfter = Number(c7AfterAnnual?.demography.lastDemographicUpdate?.day ?? -1);
  record(
    "C7_unresolved_living_group_keeps_physical_body_processing",
    "the unresolved group takes and depletes real food, accrues demand/water/hunger history, remains living, and receives the next annual demographic update",
    c7Day !== undefined && c7Day.usableUnits > 0 && c7Day.depletionApplied > 0 && patchAfter > patchBefore &&
      c7AfterDay.provisionalSuccessor.operationHistory.lifetimeDaysWithAnyPhysicalTake === 1 &&
      c7AfterDay.provisionalSuccessor.travelSubsistence.demandUnits > 0 &&
      Number.isFinite(c7AfterDay.hungerPressure) && lifecycle.isLivingBand(c7AfterDay) &&
      c7AfterAnnual !== undefined && demographicDayAfter > demographicDayBefore,
    c7Day !== undefined && daysToNextSpring > 0 && daysToNextSpring <= 360,
    {
      physicalDay: c7Day,
      patchCumulativeUse: { before: patchBefore, after: patchAfter },
      hungerPressure: c7AfterDay.hungerPressure,
      demographicUpdateDay: { before: demographicDayBefore, after: demographicDayAfter },
      phaseAfterAnnual: c7AfterAnnual?.provisionalSuccessor?.phase ?? null,
      populationAfterAnnual: c7AfterAnnual?.demography.population ?? null,
    },
  );

  // C8 — a later real meeting can still hand bodies back.
  const c8Departure = depart("band:cleanup:c8", "LIN-CLEANUP-C8");
  const c8World = {
    ...c8Departure.world,
    bands: {
      ...c8Departure.world.bands,
      "band:cleanup:c8": {
        ...c8Departure.world.bands["band:cleanup:c8"],
        provisionalSuccessor: {
          ...c8Departure.world.bands["band:cleanup:c8"].provisionalSuccessor,
          phase: "unresolved_after_failed_return",
          phaseEnteredDay: day0,
        },
      },
    },
  };
  const c8Population = c8World.bands["band:cleanup:c8"].demography.population;
  const c8Reintegration = reintegration.performAtomicReintegration({
    world: c8World,
    successorId: "band:cleanup:c8",
    today: day0 + 1,
  });
  record(
    "C8_unresolved_group_can_physically_reintegrate",
    "a genuinely co-located unresolved successor is handed back through the same conserving physical writer",
    c8Reintegration.ok === true &&
      c8Reintegration.world.bands["band:cleanup:c8"].provisionalSuccessor.phase === "reintegrated" &&
      c8Reintegration.world.bands["band:cleanup:c8"].demography.population === 0 &&
      reintegration.isReintegrationLedgerConserving(c8Reintegration.ledger),
    c8Population > 0 && String(c8World.bands[donor.id].position) === String(c8World.bands["band:cleanup:c8"].position),
    c8Reintegration.ok === true ? { ledger: c8Reintegration.ledger } : c8Reintegration,
  );

  // C9 — zero bodies still terminalize through the fission lifecycle.
  const c9Departure = depart("band:cleanup:c9", "LIN-CLEANUP-C9");
  const c9World = {
    ...c9Departure.world,
    bands: {
      ...c9Departure.world.bands,
      "band:cleanup:c9": {
        ...c9Departure.world.bands["band:cleanup:c9"],
        size: 0,
        demography: {
          ...c9Departure.world.bands["band:cleanup:c9"].demography,
          population: 0,
          workingAdults: 0,
          dependents: 0,
          elders: 0,
        },
        provisionalSuccessor: {
          ...c9Departure.world.bands["band:cleanup:c9"].provisionalSuccessor,
          phase: "unresolved_after_failed_return",
        },
      },
    },
  };
  const c9Result = resolver.resolveProvisionalLifecycles(c9World, day0 + 1);
  record(
    "C9_unresolved_zero_population_reaches_provisional_extinction",
    "zero bodies in the event-bounded state are physically observed and terminalized exactly once",
    c9Result.world.bands["band:cleanup:c9"].provisionalSuccessor.phase === "provisional_extinguished" &&
      c9Result.world.bands["band:cleanup:c9"].status === "dispersed" &&
      c9Result.resolutions.length === 1,
    resolver.hasUnresolvedProvisionalGroup(c9World) === true,
    { resolutions: c9Result.resolutions },
  );

  // C10 — the retired two-barren-day relocation cannot move establishment.
  const c10Departure = depart("band:cleanup:c10", "LIN-CLEANUP-C10");
  const barrenDays = [
    dayRecord(day0 - 1, withPatch.id, 0, 0),
    dayRecord(day0, withPatch.id, 0, 0),
  ];
  const c10World = {
    ...c10Departure.world,
    bands: {
      ...c10Departure.world.bands,
      "band:cleanup:c10": {
        ...c10Departure.world.bands["band:cleanup:c10"],
        position: withPatch.id,
        provisionalSuccessor: {
          ...c10Departure.world.bands["band:cleanup:c10"].provisionalSuccessor,
          phase: "establishing",
          phaseEnteredDay: day0 - 10,
          blockedStepDays: 20,
          travelSubsistence: {
            ...subsistence.emptyTravelSubsistence(day0 - 2),
            daysElapsed: 2,
            demandUnits: 0.2,
            lastAdvancedDay: day0,
            recentDays: barrenDays,
          },
        },
      },
    },
  };
  const c10Before = String(c10World.bands["band:cleanup:c10"].position);
  const c10Result = travel.advanceProvisionalTravel(c10World, day0 + 1);
  record(
    "C10_establishing_no_longer_relocates_after_two_barren_days",
    "even an adversarial establishing record with two barren days and many blocked steps remains on the same tile",
    String(c10Result.world.bands["band:cleanup:c10"].position) === c10Before &&
      c10Result.world.bands["band:cleanup:c10"].provisionalSuccessor.phase === "establishing" &&
      c10Result.steps.every((step) => step.bandId !== "band:cleanup:c10") &&
      JSON.stringify(travel.TRAVEL_PHASES_THAT_MOVE) === JSON.stringify(["travelling", "returning"]),
    barrenDays.length === 2 && c10World.bands["band:cleanup:c10"].provisionalSuccessor.blockedStepDays > 2,
    { before: c10Before, after: String(c10Result.world.bands["band:cleanup:c10"].position), steps: c10Result.steps },
  );

  // C11 — V4: a real arrival remains an arrival trial.
  const c11Departure = depart("band:cleanup:c11", "LIN-CLEANUP-C11");
  let c11World = c11Departure.world;
  const c11Phases = [c11World.bands["band:cleanup:c11"].provisionalSuccessor.phase];
  let c11ArrivalDay = null;
  for (let i = 1; i <= 60; i += 1) {
    c11World = advance.advanceWorldByDays(c11World, 1);
    const band = c11World.bands["band:cleanup:c11"];
    if (band === undefined) break;
    const phase = band.provisionalSuccessor?.phase ?? null;
    if (phase !== c11Phases[c11Phases.length - 1]) c11Phases.push(phase);
    if (c11ArrivalDay === null && String(band.position) === String(target.id)) c11ArrivalDay = i;
    // The physical step onto the target and the next pass that recognises "already there" are two
    // separately observable boundaries. Continue through the latter before judging V4.
    if (c11ArrivalDay !== null && phase === "establishing") break;
  }
  const c11Band = c11World.bands["band:cleanup:c11"];
  record(
    "C11_V4_arrival_never_false_stabilizes",
    "a real contiguous journey reaches the target and the same daily runner leaves it `establishing`, never `stabilized`",
    c11ArrivalDay !== null && c11Band.provisionalSuccessor.phase === "establishing" && !c11Phases.includes("stabilized"),
    c11ArrivalDay !== null && c11Phases.includes("travelling"),
    { arrivalDay: c11ArrivalDay, phases: c11Phases, target: String(target.id), finalPosition: String(c11Band?.position ?? "gone") },
  );

  // C12 — V9: even rich diagnostics cannot open residential accounting.
  const c12Departure = depart("band:cleanup:c12", "LIN-CLEANUP-C12");
  const c12Before = c12Departure.world.bands["band:cleanup:c12"];
  const c12World = {
    ...c12Departure.world,
    bands: {
      ...c12Departure.world.bands,
      "band:cleanup:c12": {
        ...c12Before,
        position: target.id,
        acuteRisk: {
          ...(c12Before.acuteRisk ?? { recentEpisodes: [] }),
          activeEffect: { ...(c12Before.acuteRisk?.activeEffect ?? {}), mortalityRiskBump: 0 },
        },
        provisionalSuccessor: {
          ...c12Before.provisionalSuccessor,
          phase: "establishing",
          phaseEnteredDay: day0 - 60,
          establishment: richEstablishment(target.id),
          operationHistory: twoLocalities,
          travelSubsistence: { ...subsistence.emptyTravelSubsistence(day0), closedIntervals: 2 },
        },
      },
    },
  };
  const c12Result = establishment.advanceProvisionalEstablishment(c12World, day0 + 1);
  const c12Band = c12Result.world.bands["band:cleanup:c12"];
  record(
    "C12_V9_no_residential_receipt_or_storage_leak",
    "all descriptive signals may hold and the group still stays provisional with zero residential storage and no residential food receipts",
    c12Result.assessments[0].signals.every((signal) => signal.holds) &&
      c12Band.provisionalSuccessor.phase === "establishing" && lifecycle.isProvisionalSuccessor(c12Band) &&
      c12Band.seasonalFoodReceipts === undefined && (c12Band.storageCapacity ?? 0) === 0,
    c12Result.assessments.length === 1 && c12Result.assessments[0].signals.length > 0,
    {
      phase: c12Band.provisionalSuccessor.phase,
      outcome: c12Result.assessments[0].outcome,
      holdingDiagnostics: c12Result.assessments[0].signals.filter((signal) => signal.holds).length,
      diagnosticCount: c12Result.assessments[0].signals.length,
      seasonalFoodReceipts: c12Band.seasonalFoodReceipts ?? null,
      storageCapacity: c12Band.storageCapacity ?? 0,
    },
  );

  const failing = fixtures.filter((fixture) => fixture.verdict === "FAIL");
  const vacuous = fixtures.filter((fixture) => fixture.verdict === "VACUOUS");
  out = {
    generatedAt: new Date().toISOString(),
    seed: SEED,
    warmDays: WARM_DAYS,
    donorBandId: String(donor.id),
    targetTileId: String(target.id),
    physicalPatchTileId: String(withPatch.id),
    summary: {
      total: fixtures.length,
      passing: fixtures.length - failing.length - vacuous.length,
      failing: failing.length,
      vacuous: vacuous.length,
    },
    fixtures,
  };
} finally {
  await server.close();
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify({ summary: out.summary, fixtures: out.fixtures.map(({ id, verdict }) => ({ id, verdict })) }, null, 2));
if (out.summary.failing > 0 || out.summary.vacuous > 0) process.exitCode = 1;
