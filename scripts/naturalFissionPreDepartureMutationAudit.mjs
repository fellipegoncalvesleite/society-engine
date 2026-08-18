// ROADMAP ITEM 4 — NEGATIVE CONTROLS FOR NATURAL PRE-DEPARTURE AND PARENT DEADLINES.
//
// Each control temporarily removes one named production barrier, loads that mutant through an
// isolated Vite cache, and proves the corresponding production fixture would fail. Every source is
// restored in `finally`, and the run fails unless all touched files finish byte-identical to their
// starting SHA-256. These are mutation controls, not alternate implementations.
import { createServer } from "vite";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1] : fallback;
};

const EVIDENCE = "docs/evidence/dynamic-fission-daughter-viability-37";
const OUT = arg("out", `${EVIDENCE}/natural-fission-predeparture-mutations.json`);
const SEED = arg("seed", "audit27:natural:s1");
const WARM_DAYS = Number(arg("warm-days", "2100"));
const PARENT_ID = arg("parent-id", "band:varied-river-mid");

const NATURAL_SRC = "src/sim/agents/naturalFissionPreDeparture.ts";
const KERNEL_SRC = "src/sim/agents/fissionLifecycleKernel.ts";
const PREPARATION_SRC = "src/sim/agents/fissionDeparturePreparation.ts";
const RESOLVER_SRC = "src/sim/agents/parentFissionAttemptResolver.ts";
const DEMOGRAPHY_SRC = "src/sim/agents/demography.ts";
const LIFECYCLE_SRC = "src/sim/agents/bandLifecycle.ts";
const TOUCHED_FILES = [
  NATURAL_SRC,
  KERNEL_SRC,
  PREPARATION_SRC,
  RESOLVER_SRC,
  DEMOGRAPHY_SRC,
  LIFECYCLE_SRC,
];

const sha = (value) => createHash("sha256").update(value).digest("hex");
const originals = Object.fromEntries(TOUCHED_FILES.map((file) => [file, readFileSync(file, "utf8")]));
const startingHashes = Object.fromEntries(TOUCHED_FILES.map((file) => [file, sha(originals[file])]));

const replaceExactlyOnce = (source, needle, replacement, label) => {
  const count = source.split(needle).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one mutation anchor, found ${count}`);
  return source.replace(needle, replacement);
};

const makeServer = (label) => createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-i4-natural-mut-${process.pid}-${label}`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  logLevel: "error",
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
  const mutated = mutate(original);
  if (mutated === original) throw new Error(`${id}: mutation made no change`);
  writeFileSync(file, mutated, "utf8");
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

// Build the shared evidence once through unmodified production. It contains a real annual proposal,
// a real next-day plan and a real accepted preparation. No mutation reuses a module instance.
const baselineServer = await makeServer("baseline");
let baseline;
try {
  const runner = await baselineServer.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await baselineServer.ssrLoadModule("/sim/tick/advance.ts");
  const demography = await baselineServer.ssrLoadModule("/sim/agents/demography.ts");
  const natural = await baselineServer.ssrLoadModule("/sim/agents/naturalFissionPreDeparture.ts");
  const resolver = await baselineServer.ssrLoadModule("/sim/agents/parentFissionAttemptResolver.ts");
  const kernel = await baselineServer.ssrLoadModule("/sim/agents/fissionLifecycleKernel.ts");
  const nomadic = await baselineServer.ssrLoadModule("/sim/agents/nomadicScale.ts");
  const time = await baselineServer.ssrLoadModule("/sim/tick/time.ts");

  const warm = advance.advanceWorldByDays(runner.initSimWorld({ kind: "map2" }, SEED), WARM_DAYS);
  const parent = warm.bands[PARENT_ID];
  if (parent === undefined) throw new Error(`baseline parent ${PARENT_ID} not found`);
  const annualDay = Math.ceil((Number(warm.time.day ?? 0) + 1) / 360) * 360;
  const inputWorld = {
    ...warm,
    time: time.getWorldTimeForDay(annualDay),
    bands: {
      ...warm.bands,
      [parent.id]: {
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
  const proposedWorld = demography.updateBandsDemographyAndFission(inputWorld);
  const proposal = proposedWorld.bands[parent.id]?.fissionAttempt;
  if (proposal?.phase !== "proposed" || proposal.naturalProposal === undefined) {
    throw new Error("baseline did not create the expected production proposal");
  }
  const plannedWorld = advance.advanceWorldByDays(proposedWorld, 1);
  const plan = plannedWorld.bands[parent.id]?.fissionAttempt;
  if (plan?.phase !== "departure_planned") throw new Error("baseline did not create a production plan");
  const readyWorld = advance.advanceWorldByDays(plannedWorld, 1);
  const ready = readyWorld.bands[parent.id]?.fissionAttempt;
  if (ready?.phase !== "departure_ready" || ready.preparedDeparture?.authorization.status !== "live") {
    throw new Error("baseline did not create a real live-permitted preparation");
  }

  const evidence = proposal.naturalProposal;
  const proposalInput = {
    cause: evidence.cause,
    splitPressure: evidence.splitPressure,
    ecologicalFounderRequest: evidence.ecologicalFounderRequest,
    minimumFounderRequest: evidence.minimumFounderRequest,
    targetTileId: evidence.proposedTargetTileId,
    targetScore: evidence.proposedTargetScore,
    targetReason: evidence.proposedTargetReason,
    reasonIds: evidence.reasonIds,
  };
  const { fissionAttempt: _attempt, provisionalSuccessor: _provisional, ...eligibleParent } =
    proposedWorld.bands[parent.id];
  const eligibleWorld = {
    ...proposedWorld,
    bands: { ...proposedWorld.bands, [parent.id]: eligibleParent },
  };
  const provisionalBand = {
    ...eligibleParent,
    provisionalSuccessor: {
      phase: "travelling",
      phaseEnteredDay: proposal.phaseEnteredDay - 1,
      history: [],
      lineageId: "mutation-control-provisional",
    },
  };
  const provisionalWorld = {
    ...eligibleWorld,
    bands: { ...eligibleWorld.bands, [parent.id]: provisionalBand },
  };

  const currentAttemptBaseline = natural.beginNaturalFissionProposal({
    world: proposedWorld,
    parentId: parent.id,
    today: proposal.phaseEnteredDay,
    input: proposalInput,
  });
  const observed = proposedWorld.bands[parent.id].knowledge.observedTiles;
  const { [evidence.proposedTargetTileId]: _removedTarget, ...remainingObserved } = observed;
  const targetRemovedWorld = {
    ...proposedWorld,
    bands: {
      ...proposedWorld.bands,
      [parent.id]: {
        ...proposedWorld.bands[parent.id],
        knowledge: { ...proposedWorld.bands[parent.id].knowledge, observedTiles: remainingObserved },
      },
    },
  };
  const missingTargetBaseline = natural.advanceNaturalFissionPreDeparture(
    targetRemovedWorld,
    proposal.phaseEnteredDay + 1,
  );
  const readyGuardBaseline = kernel.requestTransition({
    current: { phase: "departure_planned", phaseEnteredDay: 10, history: ["proposed"] },
    to: "departure_ready",
    today: 11,
    cause: "elapsed_time",
  });
  const permitBaseline = resolver.resolveParentFissionAttemptDeadlines(
    readyWorld,
    ready.phaseEnteredDay + kernel.DEPARTURE_READY_MAX_DAYS,
  );

  // Physical cutover now executes a legitimate ready attempt on the next legal day, so a deadline
  // mutation is only non-vacuous if the attempt is truthfully prevented from departing. Fill the
  // world to the same execution-time band cap production uses; the natural adapter then keeps this
  // attempt capacity-deferred while the independent parent deadline remains responsible for bounding
  // it. This tests the deadline rather than racing it against successful physical execution.
  const capacityBands = { ...readyWorld.bands };
  const fillerSource = Object.values(readyWorld.bands).find((band) => String(band.id) !== String(parent.id));
  if (fillerSource === undefined) throw new Error("deadline mutation fixture needs a filler band");
  for (let index = 0; Object.keys(capacityBands).length < nomadic.NOMADIC_MAX_MOBILE_BANDS_WARNING_COUNT; index += 1) {
    const id = `band:deadline-cap-filler-${String(index).padStart(2, "0")}`;
    capacityBands[id] = {
      ...fillerSource,
      id,
      name: id,
      parentBandId: undefined,
      daughterBandIds: [],
      fissionEvents: [],
      successorDepartureRecords: [],
      fissionAttempt: undefined,
      provisionalSuccessor: undefined,
      knowledge: { ...fillerSource.knowledge, selfBandId: id },
    };
  }
  const capacityReadyWorld = { ...readyWorld, bands: capacityBands };
  const deadlineBaseline = advance.advanceWorldByDays(capacityReadyWorld, kernel.DEPARTURE_READY_MAX_DAYS + 1);
  const duplicateBaseline = demography.updateBandsDemographyAndFission(inputWorld);
  const provisionalBaseline = natural.beginNaturalFissionProposal({
    world: provisionalWorld,
    parentId: parent.id,
    today: proposal.phaseEnteredDay,
    input: proposalInput,
  });

  baseline = {
    advance,
    inputWorld,
    proposedWorld,
    plannedWorld,
    readyWorld,
    capacityReadyWorld,
    targetRemovedWorld,
    provisionalWorld,
    proposalInput,
    proposalDay: proposal.phaseEnteredDay,
    readyDay: ready.phaseEnteredDay,
    readyMaxDays: kernel.DEPARTURE_READY_MAX_DAYS,
    currentAttemptBarrier:
      currentAttemptBaseline.ok === false && currentAttemptBaseline.refusal === "parent_not_eligible",
    realPlanBarrier:
      missingTargetBaseline.world.bands[parent.id]?.fissionAttempt?.phase === "abandoned",
    readyPreparationBarrier:
      readyGuardBaseline.ok === false &&
      readyGuardBaseline.rejection === "departure_ready_without_completed_preparation",
    permitWithdrawalBarrier:
      permitBaseline.world.bands[parent.id]?.fissionAttempt?.preparedDeparture?.authorization.status ===
      "withdrawn_before_departure",
    dailyResolverBarrier:
      deadlineBaseline.bands[parent.id]?.fissionAttempt?.phase === "abandoned" &&
      deadlineBaseline.bands[parent.id]?.fissionAttempt?.preparedDeparture?.authorization.status ===
        "withdrawn_before_departure",
    noDuplicateBarrier:
      Object.keys(duplicateBaseline.bands).length === Object.keys(inputWorld.bands).length &&
      duplicateBaseline.bands[parent.id]?.fissionAttempt?.phase === "proposed" &&
      duplicateBaseline.bands[parent.id]?.fissionEvents.length === inputWorld.bands[parent.id].fissionEvents.length,
    provisionalBarrier:
      provisionalBaseline.ok === false && provisionalBaseline.refusal === "parent_not_eligible",
  };
} finally {
  await baselineServer.close();
}

// 1 — remove the adapter's parent eligibility check. An existing current attempt can be silently
// replaced by a second proposal, so the one-attempt fixture must fail.
const currentAttemptMutant = await runMutation({
  id: "bypass-parent-eligibility",
  file: NATURAL_SRC,
  mutate: (source) => replaceExactlyOnce(
    source,
    '  if (!isFissionEligibleParent(parent)) return { ok: false, refusal: "parent_not_eligible" };',
    '  if (false && !isFissionEligibleParent(parent)) return { ok: false, refusal: "parent_not_eligible" };',
    "bypass parent eligibility",
  ),
  probe: async (server) => {
    const natural = await server.ssrLoadModule("/sim/agents/naturalFissionPreDeparture.ts");
    return natural.beginNaturalFissionProposal({
      world: baseline.proposedWorld,
      parentId: PARENT_ID,
      today: baseline.proposalDay,
      input: baseline.proposalInput,
    });
  },
});
record(
  "MUT1_parent_eligibility_gate",
  "bypassing the natural adapter's parent gate lets a parent with a current attempt silently receive another proposal",
  baseline.currentAttemptBarrier,
  currentAttemptMutant.ok === true,
  { baseline: "parent_not_eligible", mutant: currentAttemptMutant.ok === true ? "proposal_replaced_current_attempt" : currentAttemptMutant.refusal },
);

// 2 — skip the plan's target/allocation revalidation. A target removed from the band's own record is
// still promoted into departure_planned, manufacturing the plan contract.
const planMutant = await runMutation({
  id: "manufacture-plan",
  file: NATURAL_SRC,
  mutate: (source) => replaceExactlyOnce(
    source,
    "      if (!stillEstablished || !targetStillKnown || allocation.ok !== true) {",
    "      if (false && (!stillEstablished || !targetStillKnown || allocation.ok !== true)) {",
    "manufacture departure_planned",
  ),
  probe: async (server) => {
    const natural = await server.ssrLoadModule("/sim/agents/naturalFissionPreDeparture.ts");
    return natural.advanceNaturalFissionPreDeparture(baseline.targetRemovedWorld, baseline.proposalDay + 1);
  },
});
record(
  "MUT2_real_plan_required",
  "bypassing plan revalidation promotes a destination no longer present in the band's observed record into departure_planned",
  baseline.realPlanBarrier,
  planMutant.world.bands[PARENT_ID]?.fissionAttempt?.phase === "departure_planned",
  {
    baselinePhase: "abandoned",
    mutantPhase: planMutant.world.bands[PARENT_ID]?.fissionAttempt?.phase ?? null,
    targetStillKnown: false,
  },
);

// 3 — remove the kernel's explicit preparation proof. A bare lifecycle request reaches ready with no
// commitment, allocation or permit behind it.
const readyMutant = await runMutation({
  id: "manufacture-ready",
  file: KERNEL_SRC,
  mutate: (source) => replaceExactlyOnce(
    source,
    '  if (request.to === "departure_ready" && request.preparedDepartureProven !== true) {',
    '  if (false && request.to === "departure_ready" && request.preparedDepartureProven !== true) {',
    "manufacture departure_ready",
  ),
  probe: async (server) => {
    const kernel = await server.ssrLoadModule("/sim/agents/fissionLifecycleKernel.ts");
    return kernel.requestTransition({
      current: { phase: "departure_planned", phaseEnteredDay: 10, history: ["proposed"] },
      to: "departure_ready",
      today: 11,
      cause: "elapsed_time",
    });
  },
});
record(
  "MUT3_completed_preparation_required_for_ready",
  "removing the kernel proof admits departure_ready without a prepared allocation, positive commitment or live permit",
  baseline.readyPreparationBarrier,
  readyMutant.ok === true && readyMutant.state.phase === "departure_ready",
  { baseline: "departure_ready_without_completed_preparation", mutant: readyMutant },
);

// 4 — leave the old live permit in the abandoned record. The phase becomes terminal while the exact
// one-use authority remains live, which is the load-bearing timeout defect.
const permitMutant = await runMutation({
  id: "leave-ready-permit-live",
  file: PREPARATION_SRC,
  mutate: (source) => replaceExactlyOnce(
    source,
    ": { preparedDeparture: { ...prepared, authorization: withdrawn } }),",
    ": { preparedDeparture: { ...prepared, authorization: prepared.authorization } }),",
    "leave ready permit live",
  ),
  probe: async (server) => {
    const resolver = await server.ssrLoadModule("/sim/agents/parentFissionAttemptResolver.ts");
    return resolver.resolveParentFissionAttemptDeadlines(
      baseline.readyWorld,
      baseline.readyDay + baseline.readyMaxDays,
    );
  },
});
const permitMutantAttempt = permitMutant.world.bands[PARENT_ID]?.fissionAttempt;
record(
  "MUT4_ready_timeout_must_withdraw_permit",
  "replacing the withdrawn authorization with the old authorization leaves an abandoned attempt's permit live",
  baseline.permitWithdrawalBarrier,
  permitMutantAttempt?.phase === "abandoned" &&
    permitMutantAttempt.preparedDeparture?.authorization.status === "live",
  {
    baselinePermit: "withdrawn_before_departure",
    mutantPhase: permitMutantAttempt?.phase ?? null,
    mutantPermit: permitMutantAttempt?.preparedDeparture?.authorization.status ?? null,
  },
);

// 5 — disable the registered daily deadline action. After the complete 30-day bound plus one day,
// the real ready attempt and its permit remain live.
const deadlineMutant = await runMutation({
  id: "disable-parent-deadline",
  file: RESOLVER_SRC,
  mutate: (source) => replaceExactlyOnce(
    source,
    "  apply: (world, day) => resolveParentFissionAttemptDeadlines(world, day).world,",
    "  apply: (world, _day) => world,",
    "disable parent deadline resolver",
  ),
  probe: async (server) => {
    const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
    return advance.advanceWorldByDays(baseline.capacityReadyWorld, baseline.readyMaxDays + 1);
  },
});
const deadlineMutantAttempt = deadlineMutant.bands[PARENT_ID]?.fissionAttempt;
record(
  "MUT5_daily_deadline_resolver_is_load_bearing",
  "disabling the registered resolver lets a live-permitted ready attempt outlive its declared daily maximum",
  baseline.dailyResolverBarrier,
  deadlineMutantAttempt?.phase === "departure_ready" &&
    deadlineMutantAttempt.preparedDeparture?.authorization.status === "live",
  {
    boundDays: baseline.readyMaxDays,
    elapsedDays: baseline.readyMaxDays + 1,
    mutantPhase: deadlineMutantAttempt?.phase ?? null,
    mutantPermit: deadlineMutantAttempt?.preparedDeparture?.authorization.status ?? null,
  },
);

// 6 — deliberately call the retained legacy implementation after opening the new proposal and merge
// both results. This recreates the duplicate reality the cutover boundary prevents.
const originalBandWrite = `    bandsById = {
      ...bandsById,
      [bandWithDemography.id]: proposed?.ok === true
        ? proposed.world.bands[bandWithDemography.id] ?? bandWithDemography
        : bandWithDemography,
    };`;
const duplicateBandWrite = `    const duplicateLegacy =
      proposed?.ok === true
        ? createDaughterBand(worldWithUpdatedParent, bandWithDemography, computation)
        : undefined;
    const proposalAttempt =
      proposed?.ok === true
        ? proposed.world.bands[bandWithDemography.id]?.fissionAttempt
        : undefined;
    bandsById = {
      ...bandsById,
      ...(duplicateLegacy === undefined ? {} : { [duplicateLegacy.daughter.id]: duplicateLegacy.daughter }),
      [bandWithDemography.id]: duplicateLegacy === undefined
        ? proposed?.ok === true
          ? proposed.world.bands[bandWithDemography.id] ?? bandWithDemography
          : bandWithDemography
        : {
            ...duplicateLegacy.parent,
            ...(proposalAttempt === undefined ? {} : { fissionAttempt: proposalAttempt }),
          },
    };`;
const duplicateMutant = await runMutation({
  id: "duplicate-legacy-and-new",
  file: DEMOGRAPHY_SRC,
  mutate: (source) => replaceExactlyOnce(
    source,
    originalBandWrite,
    duplicateBandWrite,
    "allow legacy daughter plus new attempt",
  ),
  probe: async (server) => {
    const demography = await server.ssrLoadModule("/sim/agents/demography.ts");
    return demography.updateBandsDemographyAndFission(baseline.inputWorld);
  },
});
const duplicateNewIds = Object.keys(duplicateMutant.bands).filter((id) => baseline.inputWorld.bands[id] === undefined);
const duplicateParent = duplicateMutant.bands[PARENT_ID];
record(
  "MUT6_legacy_and_new_paths_must_not_both_fire",
  "reconnecting the retained legacy daughter body-transfer under the same causal branch creates both a proposal and a completed daughter/event",
  baseline.noDuplicateBarrier,
  duplicateParent?.fissionAttempt?.phase === "proposed" &&
    duplicateNewIds.length > 0 &&
    duplicateParent.fissionEvents.length > baseline.inputWorld.bands[PARENT_ID].fissionEvents.length,
  {
    mutantAttemptPhase: duplicateParent?.fissionAttempt?.phase ?? null,
    mutantNewBandIds: duplicateNewIds,
    mutantFissionEventCount: duplicateParent?.fissionEvents.length ?? null,
  },
);

// 7 — weaken only the canonical parent predicate from established to living. A provisional group is
// living, so it can now open a split of a split.
const provisionalMutant = await runMutation({
  id: "allow-provisional-proposal",
  file: LIFECYCLE_SRC,
  mutate: (source) => replaceExactlyOnce(
    source,
    "  return isEstablishedBand(band) && !hasCurrentFissionAttempt(band);",
    "  return isLivingBand(band) && !hasCurrentFissionAttempt(band);",
    "allow provisional successor to propose",
  ),
  probe: async (server) => {
    const natural = await server.ssrLoadModule("/sim/agents/naturalFissionPreDeparture.ts");
    return natural.beginNaturalFissionProposal({
      world: baseline.provisionalWorld,
      parentId: PARENT_ID,
      today: baseline.proposalDay,
      input: baseline.proposalInput,
    });
  },
});
record(
  "MUT7_provisional_successor_quarantine",
  "weakening fission eligibility from established to merely living lets a provisional successor propose its own fission",
  baseline.provisionalBarrier,
  provisionalMutant.ok === true,
  { baseline: "parent_not_eligible", mutant: provisionalMutant.ok === true ? "proposal_created" : provisionalMutant.refusal },
);

const endingHashes = Object.fromEntries(
  TOUCHED_FILES.map((file) => [file, sha(readFileSync(file, "utf8"))]),
);
const restoredByteIdentically = TOUCHED_FILES.every(
  (file) => endingHashes[file] === startingHashes[file] && readFileSync(file, "utf8") === originals[file],
);
const failed = controls.filter((control) => control.verdict === "FAIL");
const output = {
  audit: "ROADMAP-ITEM-4-NATURAL-PRE-DEPARTURE-MUTATION-CONTROLS",
  generatedAt: new Date().toISOString(),
  seed: SEED,
  warmDays: WARM_DAYS,
  parentId: PARENT_ID,
  restoration: { restoredByteIdentically, startingHashes, endingHashes },
  summary: {
    total: controls.length,
    passed: controls.filter((control) => control.verdict === "PASS").length,
    failed: failed.length,
    vacuous: controls.filter((control) => control.nonVacuous !== true).length,
  },
  controls,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ out: OUT, summary: output.summary, restoredByteIdentically }, null, 2));

if (!restoredByteIdentically || output.summary.failed > 0 || output.summary.vacuous > 0) {
  process.exitCode = 1;
}
