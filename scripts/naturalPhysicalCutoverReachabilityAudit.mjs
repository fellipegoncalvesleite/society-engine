import assert from "node:assert/strict";
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const OUT = "docs/evidence/item4-natural-physical-cutover/untouched-natural-reachability.json";
const SEED = "audit27:natural:s1";
const PRE_PROPOSAL_DAY = 44279;

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-i4-cutover-reach-${process.pid}`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  logLevel: "error",
});

const cohorts = (band) => ({
  workingAdults: Number(band.demography.workingAdults),
  dependents: Number(band.demography.dependents),
  elders: Number(band.demography.elders),
  population: Number(band.demography.population),
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const lifecycle = await server.ssrLoadModule("/sim/agents/bandLifecycle.ts");

  // Untouched production world. The only inputs are the standard map and deterministic seed.
  let world = runner.initSimWorld({ kind: "map2" }, SEED);
  world = advance.advanceWorldByDays(world, PRE_PROPOSAL_DAY);

  const snapshots = [];
  const pushSnapshot = (label, current) => {
    const natural = Object.values(current.bands)
      .filter((band) => band.fissionAttempt?.naturalProposal !== undefined)
      .map((band) => ({
        parentId: String(band.id),
        phase: band.fissionAttempt.phase,
        phaseEnteredDay: band.fissionAttempt.phaseEnteredDay,
        lineageId: band.fissionAttempt.lineageId,
        targetTileId: String(band.fissionAttempt.targetTileId ?? ""),
        prepared: band.fissionAttempt.preparedDeparture !== undefined,
        authorizationStatus: band.fissionAttempt.preparedDeparture?.authorization.status ?? null,
      }));
    const provisional = Object.values(current.bands)
      .filter((band) => band.provisionalSuccessor !== undefined)
      .map((band) => ({
        successorBandId: String(band.id),
        parentBandId: String(band.parentBandId),
        phase: band.provisionalSuccessor.phase,
        phaseEnteredDay: band.provisionalSuccessor.phaseEnteredDay,
        lineageId: band.provisionalSuccessor.lineageId,
        trailLength: band.provisionalSuccessor.trail?.length ?? 0,
        position: String(band.position),
        targetTileId: String(band.provisionalSuccessor.targetTileId ?? ""),
      }));
    snapshots.push({ label, day: Number(current.time.day ?? 0), natural, provisional });
  };

  pushSnapshot("before_proposal", world);
  const day44280 = advance.advanceWorldByDays(world, 1);
  pushSnapshot("proposal", day44280);
  const proposalParent = Object.values(day44280.bands).find((band) => band.fissionAttempt?.naturalProposal !== undefined);
  assert.ok(proposalParent, "ordinary annual demography must naturally create the proposal on day 44280");
  assert.equal(proposalParent.fissionAttempt.phase, "proposed");
  assert.equal(proposalParent.fissionAttempt.phaseEnteredDay, 44280);
  assert.equal(Object.values(day44280.bands).some((band) => band.provisionalSuccessor !== undefined), false, "proposal day must move no bodies");

  const parentId = proposalParent.id;
  const lineageId = proposalParent.fissionAttempt.lineageId;

  const day44281 = advance.advanceWorldByDays(day44280, 1);
  pushSnapshot("planned", day44281);
  assert.equal(day44281.bands[parentId].fissionAttempt.lineageId, lineageId);
  assert.equal(day44281.bands[parentId].fissionAttempt.phase, "departure_planned");
  assert.equal(day44281.bands[parentId].fissionAttempt.phaseEnteredDay, 44281);
  assert.equal(Object.values(day44281.bands).some((band) => band.provisionalSuccessor !== undefined), false, "planning day must move no bodies");

  const day44282 = advance.advanceWorldByDays(day44281, 1);
  pushSnapshot("ready", day44282);
  const readyParent = day44282.bands[parentId];
  const ready = readyParent.fissionAttempt;
  assert.equal(ready.lineageId, lineageId);
  assert.equal(ready.phase, "departure_ready");
  assert.equal(ready.phaseEnteredDay, 44282);
  assert.ok(ready.preparedDeparture, "canonical preparation must exist before readiness");
  assert.equal(ready.preparedDeparture.authorization.status, "live");
  assert.equal(Object.values(day44282.bands).some((band) => band.provisionalSuccessor !== undefined), false, "readiness day must not depart retroactively");

  const beforeCohorts = cohorts(readyParent);
  const beforeWorldPopulation = Object.values(day44282.bands)
    .filter(lifecycle.isLivingBand)
    .reduce((sum, band) => sum + Number(band.demography.population), 0);

  const day44283 = advance.advanceWorldByDays(day44282, 1);
  pushSnapshot("departed", day44283);
  const departedParent = day44283.bands[parentId];
  assert.equal(departedParent.fissionAttempt.lineageId, lineageId);
  assert.equal(departedParent.fissionAttempt.phase, "departed");
  assert.equal(departedParent.fissionAttempt.preparedDeparture.authorization.status, "consumed_by_departure");

  const successor = Object.values(day44283.bands).find((band) => band.provisionalSuccessor?.lineageId === lineageId);
  assert.ok(successor, "ordinary production must create the provisional successor on day 44283");
  assert.equal(successor.provisionalSuccessor.phase, "travelling");
  assert.equal(successor.provisionalSuccessor.phaseEnteredDay, 44283);
  assert.equal(successor.provisionalSuccessor.trail?.length ?? 0, 0, "successor must receive no same-day travel");
  assert.equal(successor.position, readyParent.position, "physical departure must begin at the parent origin");
  assert.equal(successor.provisionalSuccessor.targetTileId, ready.targetTileId, "successor target must remain the accepted target");
  assert.equal(successor.viability, undefined, "departure must not fabricate a successor viability status");
  assert.equal(successor.fissionEvents.length, 0, "Direction-D successor must carry no fabricated legacy BandFissionEvent");

  const afterParentCohorts = cohorts(departedParent);
  const successorCohorts = cohorts(successor);
  const afterWorldPopulation = Object.values(day44283.bands)
    .filter(lifecycle.isLivingBand)
    .reduce((sum, band) => sum + Number(band.demography.population), 0);
  for (const key of ["workingAdults", "dependents", "elders", "population"]) {
    assert.equal(beforeCohorts[key], afterParentCohorts[key] + successorCohorts[key], `exact ${key} conservation across untouched natural departure`);
  }
  assert.equal(beforeWorldPopulation, afterWorldPopulation, "whole-world living population must be conserved across the physical split day");

  // Cutover-causal step-mode equivalence. The repository has a separate whole-simulator invariance
  // audit; this focused proof compares only the physical-fission authority state so unrelated
  // observation/read-model timestamps cannot masquerade as a departure divergence.
  const cutoverProjection = (candidateWorld) => {
    const candidateParent = candidateWorld.bands[parentId];
    const candidateSuccessor = Object.values(candidateWorld.bands).find(
      (band) => band.provisionalSuccessor?.lineageId === lineageId,
    );
    const candidateRecord = candidateParent.successorDepartureRecords?.find((entry) => entry.lineageId === lineageId);
    return {
      day: Number(candidateWorld.time.day ?? 0),
      tick: Number(candidateWorld.time.tick),
      parent: {
        phase: candidateParent.fissionAttempt?.phase,
        phaseEnteredDay: candidateParent.fissionAttempt?.phaseEnteredDay,
        lineageId: candidateParent.fissionAttempt?.lineageId,
        targetTileId: String(candidateParent.fissionAttempt?.targetTileId ?? ""),
        authorizationStatus: candidateParent.fissionAttempt?.preparedDeparture?.authorization.status,
        cohorts: cohorts(candidateParent),
      },
      successor: candidateSuccessor === undefined ? null : {
        id: String(candidateSuccessor.id),
        phase: candidateSuccessor.provisionalSuccessor?.phase,
        phaseEnteredDay: candidateSuccessor.provisionalSuccessor?.phaseEnteredDay,
        lineageId: candidateSuccessor.provisionalSuccessor?.lineageId,
        position: String(candidateSuccessor.position),
        targetTileId: String(candidateSuccessor.provisionalSuccessor?.targetTileId ?? ""),
        trailLength: candidateSuccessor.provisionalSuccessor?.trail?.length ?? 0,
        cohorts: cohorts(candidateSuccessor),
        departedOnDay: candidateSuccessor.provisionalSuccessor?.departureProvenance?.departedOnDay,
        departureTick: Number(candidateSuccessor.provisionalSuccessor?.departureProvenance?.departureTick ?? -1),
      },
      record: candidateRecord === undefined ? null : {
        id: String(candidateRecord.id),
        successorBandId: String(candidateRecord.successorBandId),
        departedOnDay: candidateRecord.departedOnDay,
        tick: Number(candidateRecord.tick),
        originTileId: String(candidateRecord.originTileId),
        targetTileId: String(candidateRecord.targetTileId),
        parentPopulationBefore: candidateRecord.parentPopulationBefore,
        parentPopulationAfter: candidateRecord.parentPopulationAfter,
        successorPopulationAtDeparture: candidateRecord.successorPopulationAtDeparture,
      },
    };
  };
  const chunkedCutover = advance.advanceWorldByDays(world, 4);
  const replayedCutover = advance.advanceWorldByDays(world, 4);
  assert.deepEqual(cutoverProjection(chunkedCutover), cutoverProjection(day44283), "untouched physical cutover must be causally step-mode equivalent across chunked vs daily execution");
  assert.deepEqual(cutoverProjection(replayedCutover), cutoverProjection(chunkedCutover), "untouched physical cutover must replay deterministically from the same input");

  const record = departedParent.successorDepartureRecords?.find((entry) => entry.lineageId === lineageId);
  assert.ok(record, "parent must retain the durable physical-separation record");
  assert.equal(record.departedOnDay, 44283);
  assert.equal(String(record.successorBandId), String(successor.id));
  assert.equal(record.authorizationStatus, "consumed_by_departure");
  assert.equal(record.parentPopulationBefore, beforeCohorts.population);
  assert.equal(record.parentPopulationAfter, afterParentCohorts.population);
  assert.equal(record.successorPopulationAtDeparture, successorCohorts.population);

  let postDepartureWorld = day44283;
  let firstPostDepartureWorkDay;
  const birthPosition = String(successor.position);
  const birthPhase = successor.provisionalSuccessor.phase;
  const birthTrailLength = successor.provisionalSuccessor.trail?.length ?? 0;
  for (let offset = 1; offset <= 90; offset += 1) {
    postDepartureWorld = advance.advanceWorldByDays(postDepartureWorld, 1);
    const current = postDepartureWorld.bands[successor.id];
    assert.ok(current, "successor must remain represented until its lifecycle resolves");
    const phase = current.provisionalSuccessor?.phase;
    const trailLength = current.provisionalSuccessor?.trail?.length ?? 0;
    const changed = String(current.position) !== birthPosition || phase !== birthPhase || trailLength !== birthTrailLength;
    if (changed) {
      firstPostDepartureWorkDay = Number(postDepartureWorld.time.day ?? 0);
      break;
    }
  }
  assert.ok(firstPostDepartureWorkDay !== undefined, "ordinary downstream lifecycle must perform work or change state within the bounded observation window");
  assert.ok(firstPostDepartureWorkDay > 44283, "first post-departure successor work must occur strictly after the physical birth day");

  const evidence = {
    audit: "ROADMAP ITEM 4 — untouched natural physical cutover reachability",
    seed: SEED,
    map: "map2",
    snapshots,
    chain: {
      proposalDay: 44280,
      plannedDay: 44281,
      readyDay: 44282,
      departureDay: 44283,
      firstPostDepartureWorkDay,
      parentId: String(parentId),
      lineageId,
      successorBandId: String(successor.id),
      originTileId: String(record.originTileId),
      targetTileId: String(record.targetTileId),
    },
    conservation: {
      beforeParent: beforeCohorts,
      afterParent: afterParentCohorts,
      successor: successorCohorts,
      worldPopulationBefore: beforeWorldPopulation,
      worldPopulationAfter: afterWorldPopulation,
    },
    verdict: "PASS",
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence, null, 2));
  console.log(`written: ${OUT}`);
} finally {
  await server.close();
}
