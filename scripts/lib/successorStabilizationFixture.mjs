// Shared controlled setup for Roadmap Item 4 positive-successor stabilization audits.
//
// The positive arm is intentionally narrow and fixed. It starts from a real warmed map2 world, uses
// a real established parent and a target that parent has actually observed, then passes through the
// canonical preparation/commitment/permit chain and the atomic departure seam. Nothing here writes
// operation history, lineage, deep history or a stabilization event.
import { prepareAndDepart } from "./preparedDeparture.mjs";

export const STABILIZATION_FIXTURE_SEED = "audit27:natural:s1";
export const STABILIZATION_FIXTURE_WARM_DAYS = 2100;
export const STABILIZATION_FIXTURE_PARENT_ID = "band:varied-estuary";
export const STABILIZATION_FIXTURE_TARGET_ID = "tile:193:87";
export const STABILIZATION_FIXTURE_FOUNDERS = 3;

export async function loadSuccessorStabilizationModules(server) {
  const [
    runner,
    advance,
    seam,
    preparation,
    travel,
    reintegration,
    subsistence,
    returnDecision,
    establishment,
    stabilization,
    separationCourse,
    lifecycle,
    lifecycleResolver,
    kernel,
    history,
    events,
    chronicle,
    identity,
    bandEvents,
    bandLife,
    generate,
    passability,
    plantStock,
    time,
    registry,
    viability,
    protoCamps,
    postReturn,
    nutrition,
  ] = await Promise.all([
    server.ssrLoadModule("/sim/runner/simRunner.ts"),
    server.ssrLoadModule("/sim/tick/advance.ts"),
    server.ssrLoadModule("/sim/agents/fissionDepartureSeam.ts"),
    server.ssrLoadModule("/sim/agents/fissionDeparturePreparation.ts"),
    server.ssrLoadModule("/sim/agents/provisionalTravel.ts"),
    server.ssrLoadModule("/sim/agents/provisionalReintegration.ts"),
    server.ssrLoadModule("/sim/agents/provisionalTravelSubsistence.ts"),
    server.ssrLoadModule("/sim/agents/provisionalReturnDecision.ts"),
    server.ssrLoadModule("/sim/agents/provisionalEstablishment.ts"),
    server.ssrLoadModule("/sim/agents/successorStabilization.ts"),
    server.ssrLoadModule("/sim/agents/provisionalSeparationCourse.ts"),
    server.ssrLoadModule("/sim/agents/bandLifecycle.ts"),
    server.ssrLoadModule("/sim/agents/provisionalLifecycleResolver.ts"),
    server.ssrLoadModule("/sim/agents/fissionLifecycleKernel.ts"),
    server.ssrLoadModule("/sim/agents/bandHistory.ts"),
    server.ssrLoadModule("/sim/agents/eventSystem.ts"),
    server.ssrLoadModule("/sim/agents/bandChronicle.ts"),
    server.ssrLoadModule("/sim/agents/bandIdentity.ts"),
    server.ssrLoadModule("/sim/agents/bandEvents.ts"),
    server.ssrLoadModule("/ui/bandLife.ts"),
    server.ssrLoadModule("/sim/world/generate.ts"),
    server.ssrLoadModule("/sim/world/passability.ts"),
    server.ssrLoadModule("/sim/agents/plantStock.ts"),
    server.ssrLoadModule("/sim/tick/time.ts"),
    server.ssrLoadModule("/sim/agents/dailyActionRegistry.ts"),
    server.ssrLoadModule("/sim/agents/viability.ts"),
    server.ssrLoadModule("/sim/agents/protoCamps.ts"),
    server.ssrLoadModule("/sim/agents/postReturnContinuation.ts"),
    server.ssrLoadModule("/sim/agents/seasonalSurvival.ts"),
  ]);
  return {
    runner,
    advance,
    seam,
    preparation,
    travel,
    reintegration,
    subsistence,
    returnDecision,
    establishment,
    stabilization,
    separationCourse,
    lifecycle,
    lifecycleResolver,
    kernel,
    history,
    events,
    chronicle,
    identity,
    bandEvents,
    bandLife,
    generate,
    passability,
    plantStock,
    time,
    registry,
    viability,
    protoCamps,
    postReturn,
    nutrition,
  };
}

export function warmStabilizationWorld(modules) {
  return modules.advance.advanceWorldByDays(
    modules.runner.initSimWorld({ kind: "map2" }, STABILIZATION_FIXTURE_SEED),
    STABILIZATION_FIXTURE_WARM_DAYS,
  );
}

export function makeCanonicalStabilizationDeparture(
  modules,
  warmWorld,
  {
    successorBandId = "band:successor-stabilization-positive",
    lineageId = "LIN-SUCCESSOR-STABILIZATION-POSITIVE",
  } = {},
) {
  const parent = warmWorld.bands[STABILIZATION_FIXTURE_PARENT_ID];
  const target = modules.generate.getTile(warmWorld, STABILIZATION_FIXTURE_TARGET_ID);
  if (parent === undefined) throw new Error("fixed stabilization parent is absent");
  if (target === undefined || !modules.passability.isBandPassableDestination(target)) {
    throw new Error("fixed stabilization target is absent or impassable");
  }
  if (parent.knowledge.observedTiles[target.id] === undefined) {
    throw new Error("fixed stabilization target is not in the parent's observed knowledge");
  }
  const today = Number(warmWorld.time.day ?? 0);
  const result = prepareAndDepart({
    prep: modules.preparation,
    seam: modules.seam,
    world: warmWorld,
    parentId: parent.id,
    today,
    lineageId,
    requestedFounders: STABILIZATION_FIXTURE_FOUNDERS,
    targetTileId: String(target.id),
    successorBandId,
    splitPressure: 1,
  });
  if (result.departure.ok !== true && modules.phase2MeasuredFixtures) {
    const refusals=[{parent:parent.id,target:target.id,refusal:result.departure.refusal,detail:result.departure.detail}];
    for(const candidate of Object.values(warmWorld.bands).filter(modules.lifecycle.isEstablishedBand).sort((a,b)=>b.demography.population-a.demography.population)){
      if(candidate.demography.workingAdults<6)continue;
      const home=warmWorld.tiles[candidate.position];
      const targets=Object.entries(candidate.knowledge.observedTiles).map(([id,r])=>({t:warmWorld.tiles[id],r}))
        .filter(x=>x.t&&modules.passability.isBandPassableDestination(x.t)&&Math.abs(x.t.coord.x-home.coord.x)+Math.abs(x.t.coord.y-home.coord.y)>=4)
        .sort((a,b)=>(b.r.visits??0)-(a.r.visits??0)||(b.r.seasonsObserved?.length??0)-(a.r.seasonsObserved?.length??0)||String(a.t.id).localeCompare(String(b.t.id))).slice(0,15);
      for(const {t} of targets){
        const next=prepareAndDepart({prep:modules.preparation,seam:modules.seam,world:warmWorld,parentId:candidate.id,today,lineageId,
          requestedFounders:STABILIZATION_FIXTURE_FOUNDERS,targetTileId:t.id,successorBandId,splitPressure:1});
        if(next.departure.ok){console.log(JSON.stringify({phase2MeasuredDeparture:{parent:candidate.id,target:t.id,refusals}}));return {
          parent:candidate,target:t,departureDay:today,successorId:String(next.departure.successorId),preparation:next.preparation,departure:next.departure,fixtureRefusals:refusals};}
        refusals.push({parent:candidate.id,target:t.id,refusal:next.departure.refusal,detail:next.departure.detail});
      }
    }
    throw new Error('bounded measured Phase2 setup refused '+JSON.stringify(refusals));
  }
  if (result.preparation.ok !== true) {
    throw new Error(`stabilization preparation refused: ${result.preparation.refusal} ${result.preparation.detail ?? ""}`);
  }
  if (result.departure.ok !== true) {
    throw new Error(`stabilization departure refused: ${result.departure.refusal} ${result.departure.detail ?? ""}`);
  }
  return {
    parent,
    target,
    departureDay: today,
    successorId: String(result.departure.successorId),
    preparation: result.preparation,
    departure: result.departure,
  };
}

/**
 * Run the physical successor writers for one day but deliberately omit only stabilization.
 *
 * This is the controlled seam used by negative and mutation fixtures: movement, co-location,
 * extraction/depletion, return choice and descriptive establishment all run through production. It
 * merely stops immediately before the adapter under test, so the evidence can be inspected or one
 * barrier can be perturbed without rewinding a successful transition.
 */
export function advancePhysicalSuccessorDayWithoutStabilization(modules, world, day) {
  let current = modules.nutrition.advanceResidentialNutritionDemand(world, day);
  current = modules.travel.advanceProvisionalTravel(current, day).world;
  current = modules.reintegration.advanceProvisionalReintegrations(current, day).world;
  current = modules.subsistence.advanceProvisionalSubsistence(current, day).world;
  current = modules.returnDecision.advanceProvisionalReturnDecisions(current, day).world;
  current = modules.establishment.advanceProvisionalEstablishment(current, day).world;
  return { ...current, time: modules.time.getWorldTimeForDay(day) };
}

export function buildQualifyingPreReleaseWorld(modules, departureFixture, maxDays = 80) {
  let world = departureFixture.departure.world;
  const trace = [];
  for (let offset = 1; offset <= maxDays; offset += 1) {
    const day = departureFixture.departureDay + offset;
    world = advancePhysicalSuccessorDayWithoutStabilization(modules, world, day);
    const band = world.bands[departureFixture.successorId];
    const evidence = band === undefined
      ? undefined
      : modules.stabilization.deriveSuccessorIndependentOperationEvidence(band, day);
    trace.push({
      day,
      phase: band?.provisionalSuccessor?.phase ?? "absent",
      position: band === undefined ? "absent" : String(band.position),
      operationReady: evidence?.allRequirementsMet === true,
    });
    if (band?.provisionalSuccessor?.phase === "establishing" && evidence?.allRequirementsMet === true) {
      return { world, day, evidence, trace };
    }
    if (
      band === undefined ||
      ["returning", "reintegrated", "provisional_extinguished", "unresolved_after_failed_return", "continuing_after_failed_return", "established_after_failed_return"].includes(
        band.provisionalSuccessor?.phase,
      )
    ) {
      throw new Error(`positive setup left the success path at ${band?.provisionalSuccessor?.phase ?? "absent"}`);
    }
  }
  throw new Error(`positive setup did not earn operation evidence within ${maxDays} days`);
}

export function runRegisteredPositiveStabilization(modules, departureFixture, maxDays = 80) {
  let world = departureFixture.departure.world;
  const trace = [];
  let previousPosition = String(world.bands[departureFixture.successorId].position);
  for (let offset = 1; offset <= maxDays; offset += 1) {
    world = modules.advance.advanceWorldByDays(world, 1);
    const band = world.bands[departureFixture.successorId];
    const position = band === undefined ? "absent" : String(band.position);
    trace.push({
      offset,
      day: Number(world.time.day ?? 0),
      phase: band?.provisionalSuccessor?.phase ?? "absent",
      position,
      moved: position !== previousPosition,
      population: band?.demography.population ?? 0,
      workingAdults: band?.demography.workingAdults ?? 0,
    });
    previousPosition = position;
    if (band?.provisionalSuccessor?.phase === "stabilized") {
      return { world, day: Number(world.time.day ?? 0), band, trace };
    }
    if (
      band === undefined ||
      ["returning", "reintegrated", "provisional_extinguished", "unresolved_after_failed_return", "continuing_after_failed_return", "established_after_failed_return"].includes(
        band.provisionalSuccessor?.phase,
      )
    ) {
      throw new Error(`registered positive arm left the success path at ${band?.provisionalSuccessor?.phase ?? "absent"}`);
    }
  }
  throw new Error(`registered positive arm did not stabilize within ${maxDays} days`);
}

export function totalWorldPopulation(world) {
  return Object.values(world.bands).reduce(
    (sum, band) => sum + Math.max(0, Math.round(band.demography.population)),
    0,
  );
}
