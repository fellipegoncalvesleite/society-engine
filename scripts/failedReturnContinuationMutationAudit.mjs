// ROADMAP ITEM 4 — SOURCE MUTATION CONTROLS FOR FAILED-RETURN RESOLUTION.
import { createServer } from "vite";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  loadSuccessorStabilizationModules,
  warmStabilizationWorld,
  makeCanonicalStabilizationDeparture,
  buildQualifyingPreReleaseWorld,
} from "./lib/successorStabilizationFixture.mjs";
import {
  makeGenuineUnresolvedFailedReturn,
  runRegisteredPostReturnContinuation,
} from "./lib/failedReturnContinuationFixture.mjs";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1] : fallback;
};
const OUT = arg("out", "docs/evidence/dynamic-fission-daughter-viability-38/failed-return-mutations.json");
const POST_RETURN_SRC = "src/sim/agents/postReturnContinuation.ts";
const KERNEL_SRC = "src/sim/agents/fissionLifecycleKernel.ts";
const REINTEGRATION_SRC = "src/sim/agents/provisionalReintegration.ts";
const TOUCHED = [POST_RETURN_SRC, KERNEL_SRC, REINTEGRATION_SRC];
const sha = (value) => createHash("sha256").update(value).digest("hex");
const originals = Object.fromEntries(TOUCHED.map((file) => [file, readFileSync(file, "utf8")]));
const startingHashes = Object.fromEntries(TOUCHED.map((file) => [file, sha(originals[file])]));

const replaceExactly = (source, needle, replacement, expected, label) => {
  const count = source.split(needle).length - 1;
  if (count !== expected) throw new Error(`${label}: expected ${expected} anchors, found ${count}`);
  return source.split(needle).join(replacement);
};
const makeServer = (label) => createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-i4-failed-return-mut-${process.pid}-${label}`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  logLevel: "error",
});
const replaceBand = (world, bandId, change) => ({
  ...world,
  bands: { ...world.bands, [bandId]: change(world.bands[bandId]) },
});
const controls = [];
const record = (id, barrier, baselineHeld, mutantViolated, detail) => controls.push({
  id,
  barrier,
  verdict: baselineHeld && mutantViolated ? "PASS" : "FAIL",
  nonVacuous: baselineHeld && mutantViolated,
  baselineHeld,
  mutantViolated,
  detail,
});

const runMutation = async ({ id, file, mutate, probe }) => {
  const original = originals[file];
  const mutant = mutate(original);
  if (mutant === original) throw new Error(`${id}: mutation made no source change`);
  writeFileSync(file, mutant, "utf8");
  let server;
  try {
    server = await makeServer(id);
    return await probe(server);
  } finally {
    if (server !== undefined) await server.close();
    writeFileSync(file, original, "utf8");
    const restored = readFileSync(file, "utf8");
    if (restored !== original || sha(restored) !== startingHashes[file]) {
      throw new Error(`${id}: ${file} was not restored byte-identically`);
    }
  }
};

const baselineServer = await makeServer("baseline");
let baseline;
try {
  const modules = await loadSuccessorStabilizationModules(baselineServer);
  const warm = warmStabilizationWorld(modules);
  const unresolved = makeGenuineUnresolvedFailedReturn(modules, warm);
  const positive = runRegisteredPostReturnContinuation(modules, unresolved);
  const successorId = unresolved.successorId;
  const commitment = positive.band.provisionalSuccessor.postReturnCommitment;
  const event = positive.band.successorPostReturnEstablishmentEvents.at(-1);
  const readyWorld = replaceBand(unresolved.world, successorId, (band) => ({
    ...band,
    position: positive.band.position,
    provisionalSuccessor: {
      ...band.provisionalSuccessor,
      phase: "continuing_after_failed_return",
      phaseEnteredDay: commitment.decisionDay,
      history: positive.band.provisionalSuccessor.history.slice(0, -1),
      postReturnCommitment: commitment,
      operationHistory: positive.band.provisionalSuccessor.operationHistory,
      travelSubsistence: positive.band.provisionalSuccessor.travelSubsistence,
    },
  }));
  const fabricatedWorld = replaceBand(readyWorld, successorId, (band) => ({
    ...band,
    provisionalSuccessor: {
      ...band.provisionalSuccessor,
      postReturnCommitment: {
        ...band.provisionalSuccessor.postReturnCommitment,
        commitmentId: `${commitment.commitmentId}:fabricated`,
      },
    },
  }));
  const oldDeparture = makeCanonicalStabilizationDeparture(modules, warm, {
    successorBandId: "band:failed-return-mutation-old-window",
    lineageId: "LIN-FAILED-RETURN-MUTATION-OLD-WINDOW",
  });
  const oldQualifying = buildQualifyingPreReleaseWorld(modules, oldDeparture);
  const staleWindowWorld = replaceBand(readyWorld, successorId, (band) => ({
    ...band,
    provisionalSuccessor: {
      ...band.provisionalSuccessor,
      operationHistory: oldQualifying.world.bands[oldDeparture.successorId].provisionalSuccessor.operationHistory,
    },
  }));
  const forgottenCourseWorld = replaceBand(readyWorld, successorId, (band) => ({
    ...band,
    provisionalSuccessor: {
      ...band.provisionalSuccessor,
      separationCourse: {
        status: "outbound_trial",
        initializedOnDay: band.provisionalSuccessor.departureProvenance.departedOnDay,
      },
    },
  }));
  const dirtyReleaseWorld = replaceBand(readyWorld, successorId, (band) => ({ ...band, currentCampTileId: band.position }));
  const fabricated = modules.postReturn.advancePostReturnEstablishment(fabricatedWorld, positive.day);
  const stale = modules.postReturn.advancePostReturnEstablishment(staleWindowWorld, positive.day);
  const forgotten = modules.postReturn.advancePostReturnEstablishment(forgottenCourseWorld, positive.day);
  const dirty = modules.postReturn.advancePostReturnEstablishment(dirtyReleaseWorld, positive.day);
  const away = modules.reintegration.performAtomicReintegration({
    world: unresolved.world,
    successorId,
    today: unresolved.unresolvedDay + 1,
  });
  const timer = modules.kernel.requestTransition({
    current: { phase: "continuing_after_failed_return", phaseEnteredDay: 0, history: ["unresolved_after_failed_return"] },
    to: "established_after_failed_return",
    today: 10_000,
    cause: "elapsed_time",
    postReturnEstablishmentProof: {
      freshCommitmentProven: true,
      postCommitmentOperationProven: true,
      quarantineReleaseInitialized: true,
    },
  });
  baseline = {
    positiveDay: positive.day,
    successorId,
    fabricatedWorld,
    staleWindowWorld,
    forgottenCourseWorld,
    dirtyReleaseWorld,
    awayWorld: unresolved.world,
    timerRequest: {
      current: { phase: "continuing_after_failed_return", phaseEnteredDay: 0, history: ["unresolved_after_failed_return"] },
      to: "established_after_failed_return",
      today: 10_000,
      cause: "elapsed_time",
      postReturnEstablishmentProof: {
        freshCommitmentProven: true,
        postCommitmentOperationProven: true,
        quarantineReleaseInitialized: true,
      },
    },
    freshDecisionHeld: fabricated.established.length === 0 && fabricated.refusals[0]?.refusal === "fresh_commitment_not_canonical",
    freshEvidenceHeld: stale.established.length === 0 && stale.refusals[0]?.refusal === "no_fresh_operation_window",
    monotonicHeld: forgotten.established.length === 0 && forgotten.refusals[0]?.refusal === "fresh_commitment_not_canonical",
    coLocationHeld: away.ok === false && away.refusal === "not_physically_co_located",
    timerHeld: timer.ok === false && timer.rejection === "terminal_outcome_requires_a_physical_event",
    releaseHeld: dirty.established.length === 0 && dirty.refusals[0]?.refusal === "quarantine_release_preconditions_not_met",
    oldWindow: oldQualifying.evidence.assessmentWindow,
    freshWindow: event.independentOperation.assessmentWindow,
  };
} finally {
  await baselineServer.close();
}

{
  const mutant = await runMutation({
    id: "M1_fresh_post_failure_decision",
    file: POST_RETURN_SRC,
    mutate: (source) => replaceExactly(
      source,
      `commitmentIsCanonical(successor, record)`,
      `true`,
      2,
      "M1",
    ),
    probe: async (server) => {
      const module = await server.ssrLoadModule("/sim/agents/postReturnContinuation.ts");
      return module.advancePostReturnEstablishment(baseline.fabricatedWorld, baseline.positiveDay);
    },
  });
  record(
    "M1_fresh_post_failure_decision",
    "removing canonical fresh-commitment validation makes the hand-built commitment complete",
    baseline.freshDecisionHeld,
    mutant.established.length === 1,
    { mutantEstablished: mutant.established, mutantRefusals: mutant.refusals },
  );
}

{
  const mutant = await runMutation({
    id: "M2_fresh_post_commitment_evidence",
    file: POST_RETURN_SRC,
    mutate: (source) => replaceExactly(
      source,
      `window.startDay > commitment.decisionDay`,
      `window.startDay >= (record.departureProvenance?.departedOnDay ?? 0)`,
      2,
      "M2",
    ),
    probe: async (server) => {
      const module = await server.ssrLoadModule("/sim/agents/postReturnContinuation.ts");
      return module.advancePostReturnEstablishment(baseline.staleWindowWorld, baseline.positiveDay);
    },
  });
  record(
    "M2_fresh_post_commitment_evidence",
    "dating evidence from departure instead of after the new decision replays the old outbound window",
    baseline.freshEvidenceHeld,
    mutant.established.length === 1,
    { oldWindow: baseline.oldWindow, freshWindow: baseline.freshWindow, mutantEstablished: mutant.established },
  );
}

{
  const mutant = await runMutation({
    id: "M3_monotonic_return_history",
    file: POST_RETURN_SRC,
    mutate: (source) => replaceExactly(
      source,
      `record.separationCourse?.status === "return_path_entered"`,
      `true`,
      2,
      "M3",
    ),
    probe: async (server) => {
      const module = await server.ssrLoadModule("/sim/agents/postReturnContinuation.ts");
      return module.advancePostReturnEstablishment(baseline.forgottenCourseWorld, baseline.positiveDay);
    },
  });
  record(
    "M3_monotonic_return_history",
    "removing the absorbing return-course join lets a record that forgot the failed return complete",
    baseline.monotonicHeld,
    mutant.established.length === 1,
    { mutantEstablished: mutant.established, mutantRefusals: mutant.refusals },
  );
}

{
  const mutant = await runMutation({
    id: "M4_physical_co_location",
    file: REINTEGRATION_SRC,
    mutate: (source) => replaceExactly(
      source,
      `  if (String(parent.position) !== String(successor.position)) {`,
      `  if (false) {`,
      1,
      "M4",
    ),
    probe: async (server) => {
      const module = await server.ssrLoadModule("/sim/agents/provisionalReintegration.ts");
      return module.performAtomicReintegration({
        world: baseline.awayWorld,
        successorId: baseline.successorId,
        today: Number(baseline.awayWorld.time.day) + 1,
      });
    },
  });
  record(
    "M4_physical_co_location",
    "removing the position check produces remote reintegration",
    baseline.coLocationHeld,
    mutant.ok === true,
    { mutantOk: mutant.ok, mutantRefusal: mutant.ok ? undefined : mutant.refusal },
  );
}

{
  const mutant = await runMutation({
    id: "M5_no_timer_positive_outcome",
    file: KERNEL_SRC,
    mutate: (source) => replaceExactly(
      source,
      `  if (getPhaseContract(request.to).entryRequires === "physical_event" && request.cause !== "physical_event") {`,
      `  if (false) {`,
      1,
      "M5",
    ),
    probe: async (server) => {
      const module = await server.ssrLoadModule("/sim/agents/fissionLifecycleKernel.ts");
      return module.requestTransition(baseline.timerRequest);
    },
  });
  record(
    "M5_no_timer_positive_outcome",
    "removing the physical-event entry guard lets elapsed time create the established outcome",
    baseline.timerHeld,
    mutant.ok === true,
    mutant,
  );
}

{
  const mutant = await runMutation({
    id: "M6_cross_system_release_initialization",
    file: POST_RETURN_SRC,
    mutate: (source) => replaceExactly(
      source,
      `    successor.currentCampTileId === undefined &&\n`,
      ``,
      1,
      "M6",
    ),
    probe: async (server) => {
      const module = await server.ssrLoadModule("/sim/agents/postReturnContinuation.ts");
      return module.advancePostReturnEstablishment(baseline.dirtyReleaseWorld, baseline.positiveDay);
    },
  });
  record(
    "M6_cross_system_release_initialization",
    "removing one clean-release precondition lets a half-initialized established surface be overwritten",
    baseline.releaseHeld,
    mutant.established.length === 1,
    { mutantEstablished: mutant.established, mutantRefusals: mutant.refusals },
  );
}

const restoredHashes = Object.fromEntries(TOUCHED.map((file) => [file, sha(readFileSync(file, "utf8"))]));
const restorationHeld = TOUCHED.every((file) => restoredHashes[file] === startingHashes[file]);
const failures = controls.filter((control) => control.verdict !== "PASS");
const output = {
  audit: "ROADMAP ITEM 4 — failed-return mutation controls",
  verdict: failures.length === 0 && restorationHeld ? "PASS" : "FAIL",
  counts: { total: controls.length, passing: controls.length - failures.length, failing: failures.length, vacuous: controls.filter((c) => !c.nonVacuous).length },
  restoration: { byteIdentical: restorationHeld, startingHashes, restoredHashes },
  controls,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output, null, 2));
if (output.verdict !== "PASS") process.exitCode = 1;
