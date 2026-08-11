// ROADMAP ITEM 4 — NON-VACUOUS NEGATIVE SOURCE MUTATIONS FOR SUCCESSOR STABILIZATION.
//
// Each control removes one production barrier, loads the mutant through an isolated Vite cache and
// proves a named fixture changes verdict. Every touched file is restored byte-identically in finally.
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

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1] : fallback;
};
const EVIDENCE = "docs/evidence/dynamic-fission-daughter-viability-37";
const OUT = arg("out", `${EVIDENCE}/successor-stabilization-mutations.json`);
const STABILIZATION_SRC = "src/sim/agents/successorStabilization.ts";
const KERNEL_SRC = "src/sim/agents/fissionLifecycleKernel.ts";
const COURSE_SRC = "src/sim/agents/provisionalSeparationCourse.ts";
const TOUCHED = [STABILIZATION_SRC, KERNEL_SRC, COURSE_SRC];

const sha = (value) => createHash("sha256").update(value).digest("hex");
const originals = Object.fromEntries(TOUCHED.map((file) => [file, readFileSync(file, "utf8")]));
const startingHashes = Object.fromEntries(TOUCHED.map((file) => [file, sha(originals[file])]));
const replaceExactlyOnce = (source, needle, replacement, label) => {
  const count = source.split(needle).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one mutation anchor, found ${count}`);
  return source.replace(needle, replacement);
};
const makeServer = (label) => createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-i4-stabilization-mut-${process.pid}-${label}`,
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
const record = (id, barrier, baselineHeld, mutantViolated, detail) => {
  const nonVacuous = baselineHeld === true && mutantViolated === true;
  controls.push({
    id,
    barrier,
    verdict: nonVacuous ? "PASS" : "FAIL",
    nonVacuous,
    baselineHeld,
    mutantViolated,
    correspondingFixtureWouldFail: mutantViolated === true,
    detail,
  });
};

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
      throw new Error(`${id}: ${file} did not restore byte-identically`);
    }
  }
};

const baselineServer = await makeServer("baseline");
let baseline;
try {
  const modules = await loadSuccessorStabilizationModules(baselineServer);
  const warm = warmStabilizationWorld(modules);
  const departure = makeCanonicalStabilizationDeparture(modules, warm);
  const qualifying = buildQualifyingPreReleaseWorld(modules, departure);
  const successorId = departure.successorId;
  const band = qualifying.world.bands[successorId];
  const positive = modules.stabilization.advanceSuccessorStabilization(qualifying.world, qualifying.day);
  const stableBand = positive.world.bands[successorId];
  const event = stableBand.successorStabilizationEvents?.[0];

  const windows = band.provisionalSuccessor.operationHistory.recentAssessmentWindows;
  const lastWindow = windows[windows.length - 1];
  const noPhysicalTakeWorld = replaceBand(qualifying.world, successorId, (current) => ({
    ...current,
    provisionalSuccessor: {
      ...current.provisionalSuccessor,
      operationHistory: {
        ...current.provisionalSuccessor.operationHistory,
        recentAssessmentWindows: [
          ...windows.slice(0, -1),
          {
            ...lastWindow,
            hadAnyOwnPhysicalTake: false,
            daysWithAnyPhysicalTake: 0,
            depletionApplied: 0,
            tileIdsWithAnyPhysicalTake: [],
          },
        ],
      },
    },
  }));
  const noTakeBaseline = modules.stabilization.advanceSuccessorStabilization(
    noPhysicalTakeWorld,
    qualifying.day,
  );

  const fullProof = {
    independentOperationProven: true,
    consumedDepartureProvenanceProven: true,
    neverEnteredReturnPathProven: true,
    quarantineReleaseInitialized: true,
  };
  const missingProvenanceBaseline = modules.kernel.requestTransition({
    current: { phase: "establishing", phaseEnteredDay: 0, history: ["travelling"] },
    to: "stabilized",
    today: qualifying.day,
    cause: "physical_event",
    stabilizationProof: { ...fullProof, consumedDepartureProvenanceProven: false },
  });

  const returnTrigger = replaceBand(qualifying.world, successorId, (current) => ({
    ...current,
    demography: { ...current.demography, workingAdults: 1 },
  }));
  const returned = modules.returnDecision.advanceProvisionalReturnDecisions(returnTrigger, qualifying.day);
  const returnedCourse = returned.world.bands[successorId].provisionalSuccessor.separationCourse;
  const staleAfterReturn = replaceBand(qualifying.world, successorId, (current) => ({
    ...current,
    provisionalSuccessor: {
      ...current.provisionalSuccessor,
      history: Array.from(
        { length: modules.kernel.LIFECYCLE_HISTORY_CAP },
        (_, index) => index % 2 === 0 ? "travelling" : "establishing",
      ),
      separationCourse: returnedCourse,
    },
  }));
  const returnedBaseline = modules.stabilization.advanceSuccessorStabilization(
    staleAfterReturn,
    qualifying.day,
  );

  const timerBaseline = modules.kernel.requestTransition({
    current: { phase: "establishing", phaseEnteredDay: 0, history: ["travelling"] },
    to: "stabilized",
    today: qualifying.day,
    cause: "elapsed_time",
    stabilizationProof: fullProof,
  });
  const prematureBaseline = modules.stabilization.applySuccessorQuarantineRelease({
    world: qualifying.world,
    successor: band,
    transitionState: {
      phase: "establishing",
      phaseEnteredDay: band.provisionalSuccessor.phaseEnteredDay,
      history: band.provisionalSuccessor.history,
    },
    lineage: stableBand.lineage,
    event,
    deepHistory: stableBand.deepHistory,
    operationHistory: stableBand.provisionalSuccessor.operationHistory,
  });

  baseline = {
    qualifying,
    successorId,
    noPhysicalTakeWorld,
    staleAfterReturn,
    fullProof,
    positive,
    stableBand,
    event,
    noTakeHeld:
      noTakeBaseline.stabilized.length === 0 &&
      noTakeBaseline.refusals[0]?.refusal === "independent_operation_contract_not_met",
    missingProvenanceHeld:
      missingProvenanceBaseline.ok === false &&
      missingProvenanceBaseline.rejection === "stabilization_without_consumed_departure_provenance",
    returnedHeld:
      returned.decisions.length === 1 &&
      returnedBaseline.stabilized.length === 0 &&
      returnedBaseline.refusals[0]?.refusal === "never_returned_proof_not_satisfied",
    timerHeld:
      timerBaseline.ok === false &&
      timerBaseline.rejection === "terminal_outcome_requires_a_physical_event",
    releaseHeld: positive.stabilized.length === 1,
    historyHeld:
      prematureBaseline.ok === false &&
      prematureBaseline.refusal === "historical_completion_before_stabilization",
  };
} finally {
  await baselineServer.close();
}

// ── M1 — lived physical take/depletion really matters ───────────────────────────────────────────
{
  const result = await runMutation({
    id: "M1_lived_operation_requirement",
    file: STABILIZATION_SRC,
    mutate: (source) => replaceExactlyOnce(
      source,
      `    realFoodWasTakenAndDepleted:\n      window.hadAnyOwnPhysicalTake &&\n      window.daysWithAnyPhysicalTake > 0 &&\n      window.supportUnits > 0 &&\n      window.depletionApplied > 0,`,
      `    realFoodWasTakenAndDepleted: true,`,
      "M1",
    ),
    probe: async (server) => {
      const stabilization = await server.ssrLoadModule("/sim/agents/successorStabilization.ts");
      return stabilization.advanceSuccessorStabilization(
        baseline.noPhysicalTakeWorld,
        baseline.qualifying.day,
      );
    },
  });
  record(
    "M1_lived_operation_requirement",
    "removing the real-take/depletion conjunct makes N1/N3's fabricated-support arm stabilize",
    baseline.noTakeHeld,
    result.stabilized.length === 1,
    { mutantStabilized: result.stabilized, mutantRefusals: result.refusals },
  );
}

// ── M2 — consumed departure provenance is a separate kernel claim ──────────────────────────────
{
  const result = await runMutation({
    id: "M2_consumed_departure_provenance",
    file: KERNEL_SRC,
    mutate: (source) => replaceExactlyOnce(
      source,
      `    if (proof.consumedDepartureProvenanceProven !== true) {`,
      `    if (false) {`,
      "M2",
    ),
    probe: async (server) => {
      const kernel = await server.ssrLoadModule("/sim/agents/fissionLifecycleKernel.ts");
      return kernel.requestTransition({
        current: { phase: "establishing", phaseEnteredDay: 0, history: ["travelling"] },
        to: "stabilized",
        today: baseline.qualifying.day,
        cause: "physical_event",
        stabilizationProof: { ...baseline.fullProof, consumedDepartureProvenanceProven: false },
      });
    },
  });
  record(
    "M2_consumed_departure_provenance",
    "removing the consumed-provenance kernel claim makes K6's named missing-provenance fixture succeed",
    baseline.missingProvenanceHeld,
    result.ok === true && result.state.phase === "stabilized",
    result,
  );
}

// ── M3 — never-returned proof cannot be reconstructed from the bounded phase ring ──────────────
{
  const result = await runMutation({
    id: "M3_monotonic_never_returned_proof",
    file: COURSE_SRC,
    mutate: (source) => replaceExactlyOnce(
      source,
      `  return record.separationCourse?.status === "outbound_trial" &&`,
      `  return true || record.separationCourse?.status === "outbound_trial" &&`,
      "M3",
    ),
    probe: async (server) => {
      const stabilization = await server.ssrLoadModule("/sim/agents/successorStabilization.ts");
      return stabilization.advanceSuccessorStabilization(
        baseline.staleAfterReturn,
        baseline.qualifying.day,
      );
    },
  });
  record(
    "M3_monotonic_never_returned_proof",
    "forcing the monotonic predicate true makes N6's real-return/overflow arm stabilize on stale evidence",
    baseline.returnedHeld,
    result.stabilized.length === 1,
    { mutantStabilized: result.stabilized, mutantRefusals: result.refusals },
  );
}

// ── M4 — a timer may never enter stabilized ────────────────────────────────────────────────────
{
  const result = await runMutation({
    id: "M4_timer_success_prohibition",
    file: KERNEL_SRC,
    mutate: (source) => {
      const phaseIndex = source.indexOf(`    phase: "stabilized",`);
      if (phaseIndex < 0) throw new Error("M4: stabilized contract not found");
      const entryIndex = source.indexOf(`    entryRequires: "physical_event",`, phaseIndex);
      if (entryIndex < 0) throw new Error("M4: stabilized entry requirement not found");
      return `${source.slice(0, entryIndex)}    entryRequires: "elapsed_time_permitted",${source.slice(entryIndex + `    entryRequires: "physical_event",`.length)}`;
    },
    probe: async (server) => {
      const kernel = await server.ssrLoadModule("/sim/agents/fissionLifecycleKernel.ts");
      return kernel.requestTransition({
        current: { phase: "establishing", phaseEnteredDay: 0, history: ["travelling"] },
        to: "stabilized",
        today: baseline.qualifying.day,
        cause: "elapsed_time",
        stabilizationProof: baseline.fullProof,
      });
    },
  });
  record(
    "M4_timer_success_prohibition",
    "reclassifying stabilized as elapsed-time-permitted makes N2/E3's full-proof timer request succeed",
    baseline.timerHeld,
    result.ok === true && result.state.phase === "stabilized",
    result,
  );
}

// ── M5 — release initialization is part of success, not a follow-up best effort ─────────────────
{
  const result = await runMutation({
    id: "M5_quarantine_release_initialization",
    file: STABILIZATION_SRC,
    mutate: (source) => replaceExactlyOnce(
      source,
      `    currentCampTileId: input.successor.position,`,
      `    currentCampTileId: undefined,`,
      "M5",
    ),
    probe: async (server) => {
      const stabilization = await server.ssrLoadModule("/sim/agents/successorStabilization.ts");
      return stabilization.advanceSuccessorStabilization(
        baseline.qualifying.world,
        baseline.qualifying.day,
      );
    },
  });
  record(
    "M5_quarantine_release_initialization",
    "removing the release camp initialization makes S7's real qualifying positive fixture refuse instead of publishing half-initialized established state",
    baseline.releaseHeld,
    result.stabilized.length === 0 &&
      result.refusals[0]?.refusal === "quarantine_release_initialization_failed",
    { mutantStabilized: result.stabilized, mutantRefusals: result.refusals },
  );
}

// ── M6 — completed history may be written only after the kernel transition ─────────────────────
{
  const result = await runMutation({
    id: "M6_historical_completion_timing",
    file: STABILIZATION_SRC,
    mutate: (source) => {
      const guardRemoved = replaceExactlyOnce(
        source,
        `  return phase === "stabilized";`,
        `  return true;`,
        "M6 phase guard",
      );
      return replaceExactlyOnce(
        guardRemoved,
        `      phase: input.transitionState.phase,`,
        `      phase: "stabilized",`,
        "M6 hidden transition",
      );
    },
    probe: async (server) => {
      const stabilization = await server.ssrLoadModule("/sim/agents/successorStabilization.ts");
      const band = baseline.qualifying.world.bands[baseline.successorId];
      return stabilization.applySuccessorQuarantineRelease({
        world: baseline.qualifying.world,
        successor: band,
        transitionState: {
          phase: "establishing",
          phaseEnteredDay: band.provisionalSuccessor.phaseEnteredDay,
          history: band.provisionalSuccessor.history,
        },
        lineage: baseline.stableBand.lineage,
        event: baseline.event,
        deepHistory: baseline.stableBand.deepHistory,
        operationHistory: baseline.stableBand.provisionalSuccessor.operationHistory,
      });
    },
  });
  record(
    "M6_historical_completion_timing",
    "removing the phase guard and hiding a stabilized write inside release makes N9's establishing-state call create completed history",
    baseline.historyHeld,
    result.ok === true && result.successor.provisionalSuccessor.phase === "stabilized",
    result.ok === true
      ? {
          phase: result.successor.provisionalSuccessor.phase,
          lineage: result.successor.lineage !== undefined,
          deepHistory: result.successor.deepHistory !== undefined,
          completionEvents: result.successor.successorStabilizationEvents?.length,
        }
      : result,
  );
}

const restoration = Object.fromEntries(TOUCHED.map((file) => {
  const current = readFileSync(file, "utf8");
  return [file, {
    startingSha256: startingHashes[file],
    endingSha256: sha(current),
    byteIdentical: current === originals[file] && sha(current) === startingHashes[file],
  }];
}));
const summary = {
  total: controls.length,
  passing: controls.filter((control) => control.verdict === "PASS").length,
  failing: controls.filter((control) => control.verdict !== "PASS").length,
  vacuous: controls.filter((control) => control.nonVacuous !== true).length,
  productionRestoredByteIdentically: Object.values(restoration).every((entry) => entry.byteIdentical),
};
const output = {
  generatedAt: new Date().toISOString(),
  checkpoint: "ROADMAP ITEM 4 — successor stabilization mutation controls",
  controls,
  restoration,
  summary,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(output, null, 2)}\n`);
for (const control of controls) {
  console.log(`${control.verdict.padEnd(7)} ${control.id}  ${control.barrier}`);
  if (control.verdict !== "PASS") console.log(`        ${JSON.stringify(control).slice(0, 1_200)}`);
}
console.log(`\nsummary: ${JSON.stringify(summary)}`);
console.log(`written: ${OUT}`);
if (summary.failing > 0 || summary.vacuous > 0 || !summary.productionRestoredByteIdentically) process.exitCode = 1;
