// ROADMAP ITEM 4 — NATURAL PRE-DEPARTURE REACHABILITY AND PARENT DEADLINES.
//
// This is the durable A–M audit for the cutover-preparation subpass. The natural arm starts from an
// untouched seeded world and waits for ordinary ecology to open an attempt. The acceptance arm
// deterministically constructs a valid high-pressure demographic condition on a warmed ordinary
// band, but never writes a fissionAttempt: production annual demography, daily planning and the
// canonical preparation authority must create every lifecycle fact themselves.
//
// No fixture in this PRE-DEPARTURE audit calls performAtomicDeparture directly. Ordinary production
// now has one later daily caller, but the evidence worlds below stop at proposal/plan/ready/timeout so
// this suite still proves preparation and deadline semantics rather than physical transfer.
import { createServer } from "vite";
import ts from "typescript";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1] : fallback;
};

const EVIDENCE = "docs/evidence/dynamic-fission-daughter-viability-37";
const OUT = arg("out", `${EVIDENCE}/natural-fission-predeparture.json`);
const NATURAL_SEED = arg("natural-seed", "audit27:natural:s1");
const NATURAL_MAX_DAYS = Number(arg("natural-max-days", "45000"));
const CONTROL_SEED = arg("control-seed", "audit27:natural:s1");
const CONTROL_WARM_DAYS = Number(arg("control-warm-days", "2100"));
const STEP_SPAN_DAYS = Number(arg("step-span-days", "630"));

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

const stableHash = (value) =>
  createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");

const withoutFissionAttempts = (world) => ({
  ...world,
  bands: Object.fromEntries(
    Object.entries(world.bands).map(([id, band]) => {
      const { fissionAttempt: _attempt, ...rest } = band;
      return [id, rest];
    }),
  ),
});

const bodyProjection = (world) =>
  Object.values(world.bands)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map((band) => ({
      id: String(band.id),
      position: String(band.position),
      size: band.size,
      status: band.status,
      viability: band.viability?.status ?? null,
      population: band.demography.population,
      cohorts: {
        workingAdults: band.demography.workingAdults,
        dependents: band.demography.dependents,
        elders: band.demography.elders,
      },
      parentBandId: band.parentBandId === undefined ? null : String(band.parentBandId),
      daughterBandIds: band.daughterBandIds.map(String),
      fissionEventIds: band.fissionEvents.map((event) => String(event.id)),
      provisionalPhase: band.provisionalSuccessor?.phase ?? null,
    }));

const totalPopulation = (world) =>
  Object.values(world.bands).reduce((sum, band) => sum + Math.round(band.demography.population), 0);

const listSourceFiles = (root) => {
  const files = [];
  const visit = (path) => {
    for (const name of readdirSync(path).sort()) {
      const child = `${path}/${name}`;
      const stat = statSync(child);
      if (stat.isDirectory()) visit(child);
      else if (/\.tsx?$/.test(name)) files.push(child);
    }
  };
  visit(root);
  return files;
};

const sourceFiles = listSourceFiles("src");
const sourceRows = sourceFiles.map((file) => ({ file, source: readFileSync(file, "utf8") }));

const callSites = (symbol) => {
  const sites = [];
  for (const row of sourceRows) {
    const sourceFile = ts.createSourceFile(row.file, row.source, ts.ScriptTarget.Latest, true);
    const visit = (node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === symbol) {
        const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        sites.push({ file: relative(process.cwd(), row.file), line: position.line + 1 });
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return sites;
};

const functionDefinitions = (symbol) => {
  const sites = [];
  for (const row of sourceRows) {
    const sourceFile = ts.createSourceFile(row.file, row.source, ts.ScriptTarget.Latest, true);
    const visit = (node) => {
      if (ts.isFunctionDeclaration(node) && node.name?.text === symbol) {
        const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        sites.push({ file: relative(process.cwd(), row.file), line: position.line + 1 });
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return sites;
};

const fissionAttemptSurface = (() => {
  const writers = [];
  const readers = [];
  for (const row of sourceRows) {
    const sourceFile = ts.createSourceFile(row.file, row.source, ts.ScriptTarget.Latest, true);
    const visit = (node) => {
      if (ts.isPropertyAssignment(node) && node.name.getText(sourceFile).replace(/["']/g, "") === "fissionAttempt") {
        const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        writers.push({ file: relative(process.cwd(), row.file), line: position.line + 1 });
      }
      if (ts.isPropertyAccessExpression(node) && node.name.text === "fissionAttempt") {
        const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        readers.push({ file: relative(process.cwd(), row.file), line: position.line + 1 });
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return { writers, readers };
})();

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-i4-natural-${process.pid}`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  logLevel: "error",
});

let output;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const demography = await server.ssrLoadModule("/sim/agents/demography.ts");
  const natural = await server.ssrLoadModule("/sim/agents/naturalFissionPreDeparture.ts");
  const resolver = await server.ssrLoadModule("/sim/agents/parentFissionAttemptResolver.ts");
  const kernel = await server.ssrLoadModule("/sim/agents/fissionLifecycleKernel.ts");
  const lifecycle = await server.ssrLoadModule("/sim/agents/bandLifecycle.ts");
  const diagnostics = await server.ssrLoadModule("/sim/diagnostics/fissionDiagnostics.ts");
  const time = await server.ssrLoadModule("/sim/tick/time.ts");
  const preparation = await server.ssrLoadModule("/sim/agents/fissionDeparturePreparation.ts");

  // ── untouched natural occurrence ───────────────────────────────────────────────────────────
  let naturalBeforeBoundary = runner.initSimWorld({ kind: "map2" }, NATURAL_SEED);
  const naturalInitial = naturalBeforeBoundary;
  let naturalProposalWorld;
  let naturalParentId;
  let naturalSeasonSteps = 0;
  while (Number(naturalBeforeBoundary.time.day ?? 0) < NATURAL_MAX_DAYS) {
    const candidate = advance.advanceWorldByDays(naturalBeforeBoundary, 90);
    const opening = Object.values(candidate.bands)
      .filter((band) =>
        band.fissionAttempt?.phase === "proposed" &&
        band.fissionAttempt.naturalProposal !== undefined &&
        band.fissionAttempt.phaseEnteredDay === Number(candidate.time.day ?? 0),
      )
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];
    naturalSeasonSteps += 1;
    if (opening !== undefined) {
      naturalProposalWorld = candidate;
      naturalParentId = opening.id;
      break;
    }
    naturalBeforeBoundary = candidate;
  }
  if (naturalProposalWorld === undefined || naturalParentId === undefined) {
    throw new Error(`no natural proposal by day ${NATURAL_MAX_DAYS} on seed ${NATURAL_SEED}`);
  }

  const naturalProposalParent = naturalProposalWorld.bands[naturalParentId];
  const naturalProposal = naturalProposalParent.fissionAttempt;
  const naturalEvidence = naturalProposal.naturalProposal;
  const naturalProposalDay = naturalProposal.phaseEnteredDay;
  const naturalIdsBefore = Object.keys(naturalBeforeBoundary.bands).sort();
  const naturalIdsAfter = Object.keys(naturalProposalWorld.bands).sort();

  // Counterfactual only: suppress the proposal write at the existing diagnostic seam. Everything
  // except fissionAttempt must be byte-identical, which attributes zero body/event deltas to the
  // proposal itself despite the annual demographic step legitimately changing births/deaths.
  diagnostics.setFissionSuppressedForAudit(true);
  let naturalSuppressed;
  try {
    naturalSuppressed = advance.advanceWorldByDays(naturalBeforeBoundary, 90);
  } finally {
    diagnostics.setFissionSuppressedForAudit(false);
  }
  const naturalOnlyAttemptDelta =
    JSON.stringify(withoutFissionAttempts(naturalProposalWorld)) ===
    JSON.stringify(withoutFissionAttempts(naturalSuppressed));

  const naturalPlanDirect = natural.advanceNaturalFissionPreDeparture(
    naturalProposalWorld,
    naturalProposalDay + 1,
  );
  const naturalPlanProduction = advance.advanceWorldByDays(naturalProposalWorld, 1);
  const naturalPlannedParent = naturalPlanProduction.bands[naturalParentId];
  const naturalPlan = naturalPlannedParent.fissionAttempt;
  const naturalPlanMatchesDailyRegistry =
    JSON.stringify(naturalPlanDirect.world.bands[naturalParentId]?.fissionAttempt) ===
    JSON.stringify(naturalPlanProduction.bands[naturalParentId]?.fissionAttempt);

  const naturalRefusalDirect = natural.advanceNaturalFissionPreDeparture(
    naturalPlanProduction,
    naturalProposalDay + 2,
  );
  const naturalRefusalProduction = advance.advanceWorldByDays(naturalPlanProduction, 1);
  const naturalRefusalParent = naturalRefusalProduction.bands[naturalParentId];
  const naturalRefusal = naturalRefusalParent.fissionAttempt;
  const naturalRefusalRecord = naturalRefusalDirect.advances.find(
    (row) => row.parentId === String(naturalParentId),
  );
  const naturalRefusalMatchesDailyRegistry =
    JSON.stringify(naturalRefusalDirect.world.bands[naturalParentId]?.fissionAttempt) ===
    JSON.stringify(naturalRefusalProduction.bands[naturalParentId]?.fissionAttempt);

  // ── deterministic accepted natural preparation condition ───────────────────────────────────
  const controlBase = advance.advanceWorldByDays(
    runner.initSimWorld({ kind: "map2" }, CONTROL_SEED),
    CONTROL_WARM_DAYS,
  );
  const controlDay = Math.ceil((Number(controlBase.time.day ?? 0) + 1) / 360) * 360;
  const annualTime = time.getWorldTimeForDay(controlDay);
  const controlCandidates = Object.values(controlBase.bands)
    .filter((band) =>
      lifecycle.isFissionEligibleParent(band) &&
      band.fissionAttempt === undefined &&
      band.fissionEvents.length === 0 &&
      Object.values(band.knowledge.observedTiles).some(
        (known) => String(known.tileId) !== String(band.position) && known.confidence >= 0.34,
      ),
    )
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));

  const makeArmedWorld = (parentId) => {
    const parent = controlBase.bands[parentId];
    return {
      ...controlBase,
      time: annualTime,
      bands: {
        ...controlBase.bands,
        [parentId]: {
          ...parent,
          size: 60,
          demography: {
            ...parent.demography,
            population: 60,
            workingAdults: 30,
            dependents: 20,
            elders: 10,
            splitPressure: 0.95,
          },
        },
      },
    };
  };

  const controlSweep = [];
  let controlled;
  for (const candidate of controlCandidates) {
    const inputWorld = makeArmedWorld(candidate.id);
    const proposedWorld = demography.updateBandsDemographyAndFission(inputWorld);
    const proposedAttempt = proposedWorld.bands[candidate.id]?.fissionAttempt;
    if (proposedAttempt?.phase !== "proposed" || proposedAttempt.naturalProposal === undefined) {
      controlSweep.push({ parentId: String(candidate.id), proposal: "not_created" });
      continue;
    }
    const plannedWorld = advance.advanceWorldByDays(proposedWorld, 1);
    const resolvedWorld = advance.advanceWorldByDays(plannedWorld, 1);
    const finalAttempt = resolvedWorld.bands[candidate.id]?.fissionAttempt;
    controlSweep.push({
      parentId: String(candidate.id),
      proposal: "created",
      afterPlanning: plannedWorld.bands[candidate.id]?.fissionAttempt?.phase ?? null,
      afterPreparation: finalAttempt?.phase ?? null,
      permit: finalAttempt?.preparedDeparture?.authorization.status ?? null,
    });
    if (finalAttempt?.phase === "departure_ready" && finalAttempt.preparedDeparture?.authorization.status === "live") {
      controlled = { parentId: candidate.id, inputWorld, proposedWorld, plannedWorld, readyWorld: resolvedWorld };
      break;
    }
  }
  if (controlled === undefined) {
    throw new Error(`no accepted controlled natural preparation; sweep=${JSON.stringify(controlSweep)}`);
  }

  const controlledParentId = controlled.parentId;
  const controlledProposalParent = controlled.proposedWorld.bands[controlledParentId];
  const controlledProposal = controlledProposalParent.fissionAttempt;
  const controlledEvidence = controlledProposal.naturalProposal;
  const controlledPlannedParent = controlled.plannedWorld.bands[controlledParentId];
  const controlledPlan = controlledPlannedParent.fissionAttempt;
  const controlledReadyParent = controlled.readyWorld.bands[controlledParentId];
  const controlledReady = controlledReadyParent.fissionAttempt;
  const prepared = controlledReady.preparedDeparture;

  diagnostics.setFissionSuppressedForAudit(true);
  let controlledSuppressed;
  try {
    controlledSuppressed = demography.updateBandsDemographyAndFission(controlled.inputWorld);
  } finally {
    diagnostics.setFissionSuppressedForAudit(false);
  }
  const controlledOnlyAttemptDelta =
    JSON.stringify(withoutFissionAttempts(controlled.proposedWorld)) ===
    JSON.stringify(withoutFissionAttempts(controlledSuppressed));

  const controlledPlanDirect = natural.advanceNaturalFissionPreDeparture(
    controlled.proposedWorld,
    controlledProposal.phaseEnteredDay + 1,
  );
  const controlledReadyDirect = natural.advanceNaturalFissionPreDeparture(
    controlled.plannedWorld,
    controlledPlan.phaseEnteredDay + 1,
  );
  const controlledDailyMatches =
    JSON.stringify(controlledPlanDirect.world.bands[controlledParentId]?.fissionAttempt) ===
      JSON.stringify(controlled.plannedWorld.bands[controlledParentId]?.fissionAttempt) &&
    JSON.stringify(controlledReadyDirect.world.bands[controlledParentId]?.fissionAttempt) ===
      JSON.stringify(controlled.readyWorld.bands[controlledParentId]?.fissionAttempt);

  // ── deadline arms ───────────────────────────────────────────────────────────────────────────
  const proposalBeforeDeadline = resolver.resolveParentFissionAttemptDeadlines(
    naturalProposalWorld,
    naturalProposal.phaseEnteredDay + kernel.PROPOSAL_MAX_DAYS - 1,
  );
  const proposalExpired = resolver.resolveParentFissionAttemptDeadlines(
    naturalProposalWorld,
    naturalProposal.phaseEnteredDay + kernel.PROPOSAL_MAX_DAYS,
  );
  const plannedBeforeDeadline = resolver.resolveParentFissionAttemptDeadlines(
    naturalPlanProduction,
    naturalPlan.phaseEnteredDay + kernel.DEPARTURE_PLANNED_MAX_DAYS - 1,
  );
  const plannedExpired = resolver.resolveParentFissionAttemptDeadlines(
    naturalPlanProduction,
    naturalPlan.phaseEnteredDay + kernel.DEPARTURE_PLANNED_MAX_DAYS,
  );
  const readyBeforeDeadline = resolver.resolveParentFissionAttemptDeadlines(
    controlled.readyWorld,
    controlledReady.phaseEnteredDay + kernel.DEPARTURE_READY_MAX_DAYS - 1,
  );
  const readyExpired = resolver.resolveParentFissionAttemptDeadlines(
    controlled.readyWorld,
    controlledReady.phaseEnteredDay + kernel.DEPARTURE_READY_MAX_DAYS,
  );
  const proposalExpiredAttempt = proposalExpired.world.bands[naturalParentId].fissionAttempt;
  const plannedExpiredAttempt = plannedExpired.world.bands[naturalParentId].fissionAttempt;
  const readyExpiredAttempt = readyExpired.world.bands[controlledParentId].fissionAttempt;

  // ── four step modes over one common daily-kernel span ───────────────────────────────────────
  const MODE_DAYS = { daily: 1, weekly: 7, monthly: 30, seasonal: 90 };
  if (Object.values(MODE_DAYS).some((days) => STEP_SPAN_DAYS % days !== 0)) {
    throw new Error(`step span ${STEP_SPAN_DAYS} must be divisible by 1, 7, 30 and 90`);
  }
  const stepModeRows = [];
  let stepReference;
  for (const mode of Object.keys(MODE_DAYS)) {
    const steps = STEP_SPAN_DAYS / MODE_DAYS[mode];
    const stepped = runner.stepSim(controlled.readyWorld, steps, mode);
    const canonical = JSON.stringify(stepped);
    if (stepReference === undefined) stepReference = canonical;
    const attempt = stepped.bands[controlledParentId]?.fissionAttempt;
    stepModeRows.push({
      mode,
      steps,
      finalDay: Number(stepped.time.day ?? 0),
      finalTick: Number(stepped.time.tick),
      hash: stableHash(canonical),
      matchesDaily: canonical === stepReference,
      finalAttemptPhase: attempt?.phase ?? null,
      finalAttemptPhaseEnteredDay: attempt?.phaseEnteredDay ?? null,
      finalPermitStatus: attempt?.preparedDeparture?.authorization.status ?? null,
    });
  }

  // ── static caller/writer map ───────────────────────────────────────────────────────────────
  const callers = {
    beginNaturalFissionProposal: callSites("beginNaturalFissionProposal"),
    prepareFissionDeparture: callSites("prepareFissionDeparture"),
    performAtomicDeparture: callSites("performAtomicDeparture"),
    createDaughterBand: callSites("createDaughterBand"),
    resolveTimeout: callSites("resolveTimeout"),
    resolveParentFissionAttemptDeadlines: callSites("resolveParentFissionAttemptDeadlines"),
  };
  const definitions = {
    createDaughterBand: functionDefinitions("createDaughterBand"),
    performAtomicDeparture: functionDefinitions("performAtomicDeparture"),
    prepareFissionDeparture: functionDefinitions("prepareFissionDeparture"),
  };
  const writerReaderMap = {
    fissionAttemptPropertyWriters: fissionAttemptSurface.writers,
    fissionAttemptReaders: fissionAttemptSurface.readers,
    phaseAuthorities: {
      proposed: ["naturalFissionPreDeparture.beginNaturalFissionProposal -> kernel.beginAttempt"],
      departure_planned: ["naturalFissionPreDeparture.advanceNaturalFissionPreDeparture -> kernel.requestTransition"],
      departure_ready: ["fissionDeparturePreparation.prepareFissionDeparture -> kernel.requestTransition"],
      abandoned: [
        "naturalFissionPreDeparture -> fissionDeparturePreparation.abandonPreparedDeparture",
        "parentFissionAttemptResolver -> fissionDeparturePreparation.abandonPreparedDeparture",
      ],
      departed: ["naturalFissionDeparture -> fissionDepartureSeam.performAtomicDeparture (one ordinary production caller)"],
    },
    preparedAuthorizationAuthorities: {
      live: ["fissionDeparturePreparation.prepareFissionDeparture -> openDepartureAuthorization"],
      withdrawn_before_departure: ["fissionDeparturePreparation.abandonPreparedDeparture -> endDepartureAuthorization"],
      superseded_by_revised_terms: ["fissionDeparturePreparation.supersedePreparedDeparture -> endDepartureAuthorization"],
      consumed_by_departure: ["fissionDepartureSeam.performAtomicDeparture -> endDepartureAuthorization"],
    },
    legacyDaughter: {
      implementationDefinitions: definitions.createDaughterBand,
      productionCallers: callers.createDaughterBand,
    },
    callers,
  };

  // ── provisional proposal quarantine from both sides ─────────────────────────────────────────
  const {
    fissionAttempt: _controlledAttempt,
    provisionalSuccessor: _controlledProvisional,
    ...eligibleControlledParent
  } = controlledProposalParent;
  const proposalInput = {
    cause: controlledEvidence.cause,
    splitPressure: controlledEvidence.splitPressure,
    ecologicalFounderRequest: controlledEvidence.ecologicalFounderRequest,
    minimumFounderRequest: controlledEvidence.minimumFounderRequest,
    targetTileId: controlledEvidence.proposedTargetTileId,
    targetScore: controlledEvidence.proposedTargetScore,
    targetReason: controlledEvidence.proposedTargetReason,
    reasonIds: controlledEvidence.reasonIds,
  };
  const eligibleProposalWorld = {
    ...controlled.proposedWorld,
    bands: {
      ...controlled.proposedWorld.bands,
      [controlledParentId]: eligibleControlledParent,
    },
  };
  const eligibleProposal = natural.beginNaturalFissionProposal({
    world: eligibleProposalWorld,
    parentId: controlledParentId,
    today: controlledProposal.phaseEnteredDay,
    input: proposalInput,
  });
  const provisionalBand = {
    ...eligibleControlledParent,
    provisionalSuccessor: {
      phase: "travelling",
      phaseEnteredDay: controlledProposal.phaseEnteredDay - 1,
      history: [],
      lineageId: "audit-natural-provisional-quarantine",
    },
  };
  const provisionalProposalWorld = {
    ...eligibleProposalWorld,
    bands: { ...eligibleProposalWorld.bands, [controlledParentId]: provisionalBand },
  };
  const provisionalProposal = natural.beginNaturalFissionProposal({
    world: provisionalProposalWorld,
    parentId: controlledParentId,
    today: controlledProposal.phaseEnteredDay,
    input: proposalInput,
  });

  // ── deterministic replay of proposal -> plan -> accepted preparation -> ready expiry ─────────
  const replay = () => {
    const proposedWorld = demography.updateBandsDemographyAndFission(controlled.inputWorld);
    const plannedWorld = advance.advanceWorldByDays(proposedWorld, 1);
    const readyWorld = advance.advanceWorldByDays(plannedWorld, 1);
    const attempt = readyWorld.bands[controlledParentId].fissionAttempt;
    const expired = resolver.resolveParentFissionAttemptDeadlines(
      readyWorld,
      attempt.phaseEnteredDay + kernel.DEPARTURE_READY_MAX_DAYS,
    );
    return JSON.stringify({
      proposed: proposedWorld.bands[controlledParentId].fissionAttempt,
      planned: plannedWorld.bands[controlledParentId].fissionAttempt,
      ready: attempt,
      expired: expired.world.bands[controlledParentId].fissionAttempt,
      resolution: expired.resolutions,
    });
  };
  const replayA = replay();
  const replayB = replay();

  // ══ A–M fixtures ═════════════════════════════════════════════════════════════════════════════
  record(
    "A_real_ecology_can_create_a_proposal",
    "an untouched seeded world reaches proposed through ordinary annual ecology; the proposal's only delta is fissionAttempt, so it creates no daughter, event, population transfer or positional move",
    naturalProposal?.phase === "proposed" &&
      naturalEvidence?.authority === "annual_demography" &&
      lifecycle.isEstablishedBand(naturalProposalParent) &&
      naturalIdsBefore.join("|") === naturalIdsAfter.join("|") &&
      naturalProposalParent.fissionEvents.length === naturalBeforeBoundary.bands[naturalParentId]?.fissionEvents.length &&
      naturalProposalParent.daughterBandIds.length === naturalBeforeBoundary.bands[naturalParentId]?.daughterBandIds.length &&
      naturalOnlyAttemptDelta,
    naturalProposalDay > 0 && naturalSeasonSteps > 1,
    {
      seed: NATURAL_SEED,
      proposalDay: naturalProposalDay,
      proposalTick: Number(naturalEvidence.evidenceTick),
      parentId: String(naturalParentId),
      cause: naturalEvidence.cause,
      splitPressure: naturalEvidence.splitPressure,
      targetTileId: String(naturalEvidence.proposedTargetTileId),
      targetConfidence: naturalProposalParent.knowledge.observedTiles[naturalEvidence.proposedTargetTileId]?.confidence ?? null,
      parentPopulationBeforeAnnual: naturalBeforeBoundary.bands[naturalParentId]?.demography.population ?? null,
      parentPopulationAfterAnnual: naturalProposalParent.demography.population,
      totalPopulationBeforeAnnual: totalPopulation(naturalBeforeBoundary),
      totalPopulationAfterAnnual: totalPopulation(naturalProposalWorld),
      note: "annual births/deaths may change population; the suppressed counterfactual proves the proposal itself changes only fissionAttempt",
    },
  );

  record(
    "B_natural_proposal_becomes_a_real_plan",
    "the next production day names a deterministic lineage, bounded founder count and target from the parent's own observed record, without claiming commitment",
    naturalPlan?.phase === "departure_planned" &&
      naturalPlan.requestedFounders === naturalEvidence.proposedFounders &&
      String(naturalPlan.targetTileId) === String(naturalEvidence.proposedTargetTileId) &&
      naturalPlannedParent.knowledge.observedTiles[naturalPlan.targetTileId]?.confidence >= 0.34 &&
      naturalPlan.preparedDeparture === undefined &&
      naturalPlan.phaseEnteredDay === naturalProposalDay + 1 &&
      naturalPlanMatchesDailyRegistry,
    naturalPlanDirect.advances.some((row) => row.kind === "proposal_became_plan"),
    {
      lineageId: naturalPlan?.lineageId ?? null,
      requestedFounders: naturalPlan?.requestedFounders ?? null,
      targetTileId: naturalPlan?.targetTileId ?? null,
      targetConfidence: naturalPlan?.targetTileId === undefined
        ? null
        : naturalPlannedParent.knowledge.observedTiles[naturalPlan.targetTileId]?.confidence ?? null,
      history: naturalPlan?.history ?? null,
      directAdapterMatchesRegisteredDailyAction: naturalPlanMatchesDailyRegistry,
    },
  );

  const preparedFresh = preparation.deriveCurrentPreparedFingerprint(prepared, controlledReadyParent);
  record(
    "C_natural_positive_commitment_is_reachable",
    "production annual evidence, next-day planning and the following day's canonical preparation reach departure_ready with exact allocation, positive commitment, live one-use permit and current-parent residual evidence, while moving nobody",
    controlledReady?.phase === "departure_ready" &&
      prepared?.allocation.exact === true &&
      preparation.isPreparedDepartureCoherent(prepared) &&
      prepared.authorization.status === "live" &&
      String(controlledReady.targetTileId) === String(prepared.commitment.targetTileId) &&
      String(controlledReady.targetTileId) === String(prepared.authorization.targetTileId) &&
      prepared.residualInputFingerprint === preparedFresh &&
      controlledOnlyAttemptDelta &&
      controlledDailyMatches &&
      JSON.stringify(bodyProjection(controlled.proposedWorld)) === JSON.stringify(bodyProjection(controlled.readyWorld)),
    prepared !== undefined && controlledPlan?.phase === "departure_planned",
    {
      parentId: String(controlledParentId),
      proposalDay: controlledProposal.phaseEnteredDay,
      plannedDay: controlledPlan.phaseEnteredDay,
      readyDay: controlledReady.phaseEnteredDay,
      requestedFounders: prepared?.requestedFounders ?? null,
      endorsedFounders: prepared?.endorsedFounders ?? null,
      exactAllocation: prepared?.allocation ?? null,
      commitmentId: prepared?.commitment.commitmentId ?? null,
      commitmentDecisionDay: prepared?.commitment.decisionDay ?? null,
      permitStatus: prepared?.authorization.status ?? null,
      targetTileId: controlledReady?.targetTileId ?? null,
      storedResidualFingerprint: prepared?.residualInputFingerprint ?? null,
      currentResidualFingerprint: preparedFresh,
      controlledCandidateSweep: controlSweep,
    },
  );

  record(
    "D_real_decline_remains_real",
    "an untouched-seed natural plan whose represented founders decline is abandoned without a manufactured commitment, permit or readiness",
    naturalRefusal?.phase === "abandoned" &&
      naturalRefusal.preparedDeparture === undefined &&
      naturalRefusalRecord?.kind === "attempt_abandoned_after_founder_decline" &&
      naturalRefusalMatchesDailyRegistry &&
      JSON.stringify(withoutFissionAttempts(naturalRefusalDirect.world)) ===
        JSON.stringify(withoutFissionAttempts(naturalPlanProduction)),
    naturalRefusalRecord !== undefined && naturalPlan?.phase === "departure_planned",
    {
      response: naturalRefusalRecord ?? null,
      finalPhase: naturalRefusal?.phase ?? null,
      preparedDeparturePresent: naturalRefusal?.preparedDeparture !== undefined,
      directAdapterMatchesRegisteredDailyAction: naturalRefusalMatchesDailyRegistry,
    },
  );

  record(
    "E_proposed_timeout",
    "the canonical parent resolver abandons proposed exactly at its production kernel bound without moving bodies",
    proposalExpiredAttempt?.phase === "abandoned" &&
      proposalExpired.resolutions.length === 1 &&
      proposalExpired.resolutions[0].day === naturalProposal.phaseEnteredDay + kernel.PROPOSAL_MAX_DAYS &&
      JSON.stringify(withoutFissionAttempts(proposalExpired.world)) === JSON.stringify(withoutFissionAttempts(naturalProposalWorld)),
    naturalProposal?.phase === "proposed",
    { boundDays: kernel.PROPOSAL_MAX_DAYS, resolution: proposalExpired.resolutions[0] ?? null },
  );

  record(
    "F_planned_timeout",
    "the same parent resolver abandons departure_planned exactly at its production kernel bound without moving bodies",
    plannedExpiredAttempt?.phase === "abandoned" &&
      plannedExpired.resolutions.length === 1 &&
      plannedExpired.resolutions[0].day === naturalPlan.phaseEnteredDay + kernel.DEPARTURE_PLANNED_MAX_DAYS &&
      JSON.stringify(withoutFissionAttempts(plannedExpired.world)) === JSON.stringify(withoutFissionAttempts(naturalPlanProduction)),
    naturalPlan?.phase === "departure_planned",
    { boundDays: kernel.DEPARTURE_PLANNED_MAX_DAYS, resolution: plannedExpired.resolutions[0] ?? null },
  );

  record(
    "G_ready_timeout_withdraws_live_permit",
    "an actually prepared live-permitted ready attempt expires to abandoned with its immutable commitment/allocation retained and its permit terminally withdrawn, with no successor or cohort movement",
    readyExpiredAttempt?.phase === "abandoned" &&
      readyExpiredAttempt.preparedDeparture?.authorization.status === "withdrawn_before_departure" &&
      readyExpiredAttempt.preparedDeparture.authorization.endedBecause === "attempt_abandoned_before_departure" &&
      JSON.stringify(readyExpiredAttempt.preparedDeparture.commitment) === JSON.stringify(prepared.commitment) &&
      JSON.stringify(readyExpiredAttempt.preparedDeparture.allocation) === JSON.stringify(prepared.allocation) &&
      JSON.stringify(bodyProjection(readyExpired.world)) === JSON.stringify(bodyProjection(controlled.readyWorld)) &&
      readyExpired.resolutions.length === 1,
    controlledReady?.phase === "departure_ready" && prepared?.authorization.status === "live",
    {
      boundDays: kernel.DEPARTURE_READY_MAX_DAYS,
      resolution: readyExpired.resolutions[0] ?? null,
      commitmentRetained: readyExpiredAttempt?.preparedDeparture?.commitment ?? null,
      allocationRetained: readyExpiredAttempt?.preparedDeparture?.allocation ?? null,
      permitAfter: readyExpiredAttempt?.preparedDeparture?.authorization ?? null,
    },
  );

  const earlyRows = [
    ["proposed", proposalBeforeDeadline, naturalProposalWorld],
    ["departure_planned", plannedBeforeDeadline, naturalPlanProduction],
    ["departure_ready", readyBeforeDeadline, controlled.readyWorld],
  ].map(([phase, result, source]) => ({
    phase,
    unchanged: JSON.stringify(result.world) === JSON.stringify(source),
    resolutions: result.resolutions.length,
  }));
  record(
    "H_one_day_before_deadline_does_nothing",
    "one day before each parent-side bound the production resolver is a byte-identical no-op",
    earlyRows.every((row) => row.unchanged && row.resolutions === 0),
    earlyRows.length === 3,
    { earlyRows },
  );

  record(
    "I_step_mode_equivalence",
    "daily, weekly, monthly and seasonal stepping over the same 630-day span produce byte-identical complete worlds from a real ready attempt, proving the daily resolver keeps one calendar authority",
    stepModeRows.every((row) => row.matchesDaily) &&
      new Set(stepModeRows.map((row) => row.finalDay)).size === 1 &&
      new Set(stepModeRows.map((row) => row.finalTick)).size === 1,
    stepModeRows.length === 4 && stepModeRows.every((row) => row.steps > 0),
    { spanDays: STEP_SPAN_DAYS, rows: stepModeRows },
  );

  const noProvisionalInNaturalEvidence = [
    naturalProposalWorld,
    naturalPlanProduction,
    naturalRefusalProduction,
    controlled.proposedWorld,
    controlled.plannedWorld,
    controlled.readyWorld,
    readyExpired.world,
  ].every((world) => Object.values(world.bands).every((band) => band.provisionalSuccessor === undefined));
  record(
    "J_predeparture_evidence_still_creates_no_successor",
    "performAtomicDeparture has exactly one ordinary natural production caller, while proposal/plan/ready/timeout evidence worlds still contain no provisional successor before the legal departure day",
    callers.performAtomicDeparture.length === 1 &&
      callers.performAtomicDeparture[0]?.file === "src/sim/agents/naturalFissionDeparture.ts" &&
      definitions.performAtomicDeparture.length === 1 &&
      noProvisionalInNaturalEvidence,
    controlledReady?.phase === "departure_ready" && naturalProposal?.phase === "proposed",
    {
      performAtomicDepartureDefinitions: definitions.performAtomicDeparture,
      performAtomicDepartureProductionCallers: callers.performAtomicDeparture,
      noProvisionalInEvidenceWorlds: noProvisionalInNaturalEvidence,
    },
  );

  const controlledNewIds = Object.keys(controlled.proposedWorld.bands).filter(
    (id) => controlled.inputWorld.bands[id] === undefined,
  );
  record(
    "K_no_legacy_new_duplicate",
    "the same armed causal split creates exactly the new proposal and no legacy daughter/event/body delta; createDaughterBand still exists but has zero production call sites",
    controlledProposal?.phase === "proposed" &&
      controlledNewIds.length === 0 &&
      controlledProposalParent.fissionEvents.length === controlled.inputWorld.bands[controlledParentId].fissionEvents.length &&
      controlledProposalParent.daughterBandIds.length === controlled.inputWorld.bands[controlledParentId].daughterBandIds.length &&
      controlledOnlyAttemptDelta &&
      definitions.createDaughterBand.length === 1 &&
      callers.createDaughterBand.length === 0,
    controlledProposal?.naturalProposal !== undefined,
    {
      newBandIds: controlledNewIds,
      parentFissionEventCount: controlledProposalParent.fissionEvents.length,
      parentDaughterIds: controlledProposalParent.daughterBandIds.map(String),
      createDaughterBandDefinitions: definitions.createDaughterBand,
      createDaughterBandProductionCallers: callers.createDaughterBand,
    },
  );

  record(
    "L_provisional_successor_cannot_propose",
    "the production eligibility boundary refuses the same valid proposal on a live provisional successor while accepting the established positive control",
    eligibleProposal.ok === true &&
      provisionalProposal.ok === false &&
      provisionalProposal.refusal === "parent_not_eligible" &&
      lifecycle.isProvisionalSuccessor(provisionalBand) &&
      lifecycle.isFissionEligibleParent(provisionalBand) === false,
    eligibleProposal.ok === true && lifecycle.isProvisionalSuccessor(provisionalBand),
    {
      establishedControl: eligibleProposal.ok === true ? "proposal_created" : eligibleProposal.refusal,
      provisionalResult: provisionalProposal.ok === true ? "proposal_created" : provisionalProposal.refusal,
      provisionalPhase: provisionalBand.provisionalSuccessor.phase,
    },
  );

  record(
    "M_deterministic_replay",
    "the same seed/state produces byte-identical proposal, plan, real commitment, live permit and ready-timeout result",
    replayA === replayB,
    replayA.length > 0 && replayB.length > 0,
    { bytes: replayA.length, hashA: stableHash(replayA), hashB: stableHash(replayB) },
  );

  const eventHistoryAudit = {
    proposalAndPlanWriteNoBandFissionEvent:
      naturalProposalParent.fissionEvents.length === naturalBeforeBoundary.bands[naturalParentId].fissionEvents.length &&
      controlledProposalParent.fissionEvents.length === controlled.inputWorld.bands[controlledParentId].fissionEvents.length,
    proposalAndPlanWriteNoDaughterLineage:
      naturalProposalParent.daughterBandIds.length === naturalBeforeBoundary.bands[naturalParentId].daughterBandIds.length &&
      controlledProposalParent.daughterBandIds.length === controlled.inputWorld.bands[controlledParentId].daughterBandIds.length,
    commitmentStoredOnlyInsidePreparedAttempt: prepared.commitment,
    physicalFissionEventWritersRemainInsideUncalledLegacyImplementation:
      callers.createDaughterBand.length === 0,
    historyReadersContinueToReadCompletedFissionEvents: [
      "src/sim/agents/bandHistory.ts",
      "src/sim/agents/bandChronicle.ts",
      "src/sim/agents/eventSystem.ts",
      "src/ui/band/History.tsx",
    ],
  };

  const failing = fixtures.filter((fixture) => fixture.verdict === "FAIL");
  const vacuous = fixtures.filter((fixture) => fixture.verdict === "VACUOUS");
  output = {
    audit: "ROADMAP-ITEM-4-NATURAL-PRE-DEPARTURE-AND-PARENT-DEADLINES",
    generatedAt: new Date().toISOString(),
    naturalRun: {
      seed: NATURAL_SEED,
      maxDays: NATURAL_MAX_DAYS,
      observedProposalDay: naturalProposalDay,
      observedParentId: String(naturalParentId),
      seasonSteps: naturalSeasonSteps,
      startedWithAttempt: Object.values(naturalInitial.bands).some((band) => band.fissionAttempt !== undefined),
    },
    controlledRun: {
      seed: CONTROL_SEED,
      warmDays: CONTROL_WARM_DAYS,
      annualDay: controlDay,
      selectedParentId: String(controlledParentId),
      candidateSweep: controlSweep,
    },
    phaseOrdering: {
      proposalDay: controlledProposal.phaseEnteredDay,
      planDay: controlledPlan.phaseEnteredDay,
      readyDay: controlledReady.phaseEnteredDay,
      maximumOnePhasePerParentPerDay: true,
      deadlineRunsBeforeProgression: true,
    },
    writerReaderMap,
    eventHistoryAudit,
    summary: {
      total: fixtures.length,
      passed: fixtures.filter((fixture) => fixture.verdict === "PASS").length,
      failed: failing.length,
      vacuous: vacuous.length,
    },
    fixtures,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(output, null, 2)}\n`, "utf8");
} finally {
  await server.close();
}

console.log(JSON.stringify({
  out: OUT,
  summary: output?.summary ?? null,
  naturalRun: output?.naturalRun ?? null,
  controlledRun: output?.controlledRun ?? null,
}, null, 2));

if (output === undefined || output.summary.failed > 0 || output.summary.vacuous > 0) {
  process.exitCode = 1;
}
