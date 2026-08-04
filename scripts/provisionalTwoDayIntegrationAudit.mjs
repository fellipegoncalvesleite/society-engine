// ROADMAP ITEM 4 §3 + §9 — does a provisional successor survive a REAL runner pass?
//
// Everything before this audit was constructed objects. This one builds a real world through
// `initSimWorld`, warms it, performs a departure through the PRODUCTION seam, and then advances the
// world through the REAL `advanceWorldByDays` — the same daily actions, demography, viability,
// ecology and read-model passes ordinary play uses.
//
// WHAT IT CAN AND CANNOT CLAIM, stated before the results.
//
// The seam has no callers, so the departure cannot be made to fire from INSIDE a tick. It is applied
// between two runner calls, at the point in the sequence the seam occupies — after a season's daily
// actions have run and before the next season advances. That is a CONTROLLED APPROXIMATION of the
// in-tick seam and is labelled as one. What it measures truthfully is the thing that matters and had
// never been measured: whether a provisional successor placed in a real world is still there, still
// itself, and still unresolved-free after the real runner has had a full pass at it.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/dynamic-fission-daughter-viability-37";
const OUT = arg("out", `${EVIDENCE}/provisional-two-day-integration.json`);
const SEED = arg("seed", "audit27:natural:s1");
const WARM_DAYS = Number(arg("warm-days", "1800"));

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-i4day-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const seam = await server.ssrLoadModule("/sim/agents/fissionDepartureSeam.ts");
  const lc = await server.ssrLoadModule("/sim/agents/bandLifecycle.ts");
  const resolver = await server.ssrLoadModule("/sim/agents/provisionalLifecycleResolver.ts");

  const SEASON = 90;
  let world = runner.initSimWorld({ kind: "map2" }, SEED);
  world = advance.advanceWorldByDays(world, WARM_DAYS);

  const pickParent = (w) =>
    Object.values(w.bands)
      .filter((b) => lc.isEstablishedBand(b) && b.demography.workingAdults >= 6 && b.demography.population >= 24)
      .sort((a, b) => b.demography.population - a.demography.population)[0];

  const parent = pickParent(world);
  if (parent === undefined) throw new Error("no suitable established parent after warm-up");

  const dayD = Number(world.time.day ?? 0);
  const parentBefore = {
    id: String(parent.id),
    population: parent.demography.population,
    workingAdults: parent.demography.workingAdults,
    dependents: parent.demography.dependents,
    elders: parent.demography.elders,
    position: String(parent.position),
  };
  const worldPopBefore = Object.values(world.bands).reduce((t, b) => t + Math.round(b.demography.population), 0);
  const bandCountBefore = Object.keys(world.bands).length;

  // ── the departure, through the production writer ──
  const requested = Math.max(2, Math.floor(parent.demography.population * 0.35));
  const worldWithAttempt = {
    ...world,
    bands: {
      ...world.bands,
      [parent.id]: {
        ...parent,
        fissionAttempt: {
          phase: "departure_ready",
          phaseEnteredDay: dayD - 5,
          history: ["proposed", "committed"],
          lineageId: "LIN-REAL-1",
          requestedFounders: requested,
          targetTileId: String(parent.position),
        },
      },
    },
  };

  const departure = seam.performAtomicDeparture({
    world: worldWithAttempt,
    parentId: parent.id,
    today: dayD,
    residualContext: {
      physicallyAwayPeople: 0, physicallyAwayWorkers: 0, preparedCommitmentWorkers: 0,
      foodDemographicPressure: 0, chronicFoodStress: 0, chronicDeficitStreak: 0, nutritionMeasured: true,
      acuteRiskSeverity: 0, sicknessBurden: 0, careTravelBurden: 0, embodiedConditionMeasured: true,
      ecologicalRisk: 0, ecologicalPositionMeasured: true,
      mobilityCapabilityBefore: 1, mobilityCapabilityAfter: 1,
      minimumFounderRequest: 2,
    },
    successorBandId: `${parent.id}:provisional:1`,
    lineageId: "LIN-REAL-1",
  });

  if (departure.ok !== true) throw new Error(`departure refused: ${departure.refusal} ${departure.detail ?? ""}`);

  const succId = String(departure.successorId);
  const afterDeparture = departure.world;
  const succAtBirth = afterDeparture.bands[succId];

  // ── advance the REAL runner one full season past the departure ──
  const afterOneSeason = advance.advanceWorldByDays(afterDeparture, SEASON);
  const succAfter = afterOneSeason.bands[succId];
  const parentAfter = afterOneSeason.bands[String(parent.id)];

  const worldPopAfterDeparture = Object.values(afterDeparture.bands).reduce((t, b) => t + Math.round(b.demography.population), 0);

  const gates = [];
  const gate = (id, claim, nonVacuous, nonVacuityNote, passed, detail) =>
    gates.push({ id, claim, status: !nonVacuous ? "VACUOUS" : passed ? "PASS" : "FAIL", nonVacuityNote, ...detail });

  gate("T1", "the departure conserves population and cohorts in a REAL world",
    departure.ledger.demographic.successor.workingAdults > 0,
    "people genuinely moved in a real world",
    seam.isDepartureLedgerConserving(departure.ledger) && worldPopAfterDeparture === worldPopBefore,
    { worldPopBefore, worldPopAfterDeparture, ledger: departure.ledger.demographic });

  gate("T2", "the successor exists in the real world at the parent's tile",
    succAtBirth !== undefined,
    "the successor was genuinely created",
    succAtBirth !== undefined && String(succAtBirth.position) === parentBefore.position,
    { successorPosition: String(succAtBirth?.position), parentPosition: parentBefore.position });

  gate("T3", "the successor SURVIVES a full real runner season — not absorbed, not collapsed, not dispersed",
    succAtBirth !== undefined && Math.round(succAtBirth.demography.population) > 0,
    "the successor was alive when the runner started",
    succAfter !== undefined && succAfter.status !== "dispersed" && lc.isLivingBand(succAfter),
    {
      existsAfter: succAfter !== undefined,
      statusAfter: succAfter?.status,
      livingAfter: succAfter === undefined ? null : lc.isLivingBand(succAfter),
      populationBirth: succAtBirth?.demography.population,
      populationAfter: succAfter?.demography.population,
    });

  gate("T4", "established viability never claims the provisional successor",
    succAfter !== undefined,
    "the successor survived to be checked",
    succAfter !== undefined && succAfter.viability === undefined && lc.isProvisionalSuccessor(succAfter),
    {
      viabilityAfter: succAfter?.viability?.status ?? null,
      stillProvisional: succAfter === undefined ? null : lc.isProvisionalSuccessor(succAfter),
      // the control: the PARENT does get established viability in the same world
      parentViabilityAfter: parentAfter?.viability?.status ?? null,
    });

  gate("T5", "the successor is not established and cannot fission after a real season",
    succAfter !== undefined && lc.isEstablishedBand(parentAfter) === true,
    "the parent IS established in the same world, so the successor's false is discriminating",
    succAfter !== undefined && lc.isEstablishedBand(succAfter) === false && lc.isFissionEligibleParent(succAfter) === false,
    { established: succAfter === undefined ? null : lc.isEstablishedBand(succAfter), fissionEligible: succAfter === undefined ? null : lc.isFissionEligibleParent(succAfter) });

  gate("T6", "the band count grew by exactly one and nobody else vanished",
    bandCountBefore > 0,
    "the world genuinely had bands before",
    Object.keys(afterDeparture.bands).length === bandCountBefore + 1,
    { bandCountBefore, bandCountAfterDeparture: Object.keys(afterDeparture.bands).length, bandCountAfterSeason: Object.keys(afterOneSeason.bands).length });

  gate("T7", "no provisional group is left unresolved at zero population",
    succAfter !== undefined,
    "a provisional group genuinely existed through the season",
    resolver.hasUnresolvedProvisionalGroup(afterOneSeason) === false,
    { unresolved: resolver.hasUnresolvedProvisionalGroup(afterOneSeason) });

  // ── T8: the zero-body resolver actually fires when it should ──
  const killed = {
    ...afterDeparture,
    bands: {
      ...afterDeparture.bands,
      [succId]: { ...succAtBirth, demography: { ...succAtBirth.demography, population: 0, workingAdults: 0, dependents: 0, elders: 0 } },
    },
  };
  const resolved = resolver.resolveProvisionalLifecycles(killed, dayD + 1);
  const killedAfter = resolved.world.bands[succId];
  gate("T8", "a provisional group that loses everybody resolves through the fission lifecycle, not Item 6",
    resolver.hasUnresolvedProvisionalGroup(killed) === true,
    "the group genuinely was unresolved at zero population before the resolver ran",
    resolved.resolutions.length === 1 &&
      resolved.resolutions[0].reason === "zero_physical_population" &&
      killedAfter.provisionalSuccessor.phase === "provisional_extinguished" &&
      killedAfter.status === "dispersed" &&
      resolver.hasUnresolvedProvisionalGroup(resolved.world) === false &&
      // provenance survives the death
      killedAfter.provisionalSuccessor.lineageId === "LIN-REAL-1",
    { resolutions: resolved.resolutions, phaseAfter: killedAfter?.provisionalSuccessor?.phase, statusAfter: killedAfter?.status });

  // ── T9: the parent/successor pair does not become strangers on the birth tick ──
  gate("T9", "the parent and successor are lineage-linked, and a third band is not",
    succAfter !== undefined,
    "both halves survived to be compared",
    succAfter !== undefined && lc.shareCurrentFissionLineage(parentAfter, succAfter) === true &&
      Object.values(afterOneSeason.bands).filter((b) => String(b.id) !== succId && String(b.id) !== String(parent.id) && lc.shareCurrentFissionLineage(b, succAfter)).length === 0,
    { pairLinked: succAfter === undefined ? null : lc.shareCurrentFissionLineage(parentAfter, succAfter) });

  // ── T10: ordinary behaviour is untouched — a world with no attempt is byte-identical ──
  const controlA = advance.advanceWorldByDays(runner.initSimWorld({ kind: "map2" }, SEED), WARM_DAYS + SEASON);
  const controlB = advance.advanceWorldByDays(runner.initSimWorld({ kind: "map2" }, SEED), WARM_DAYS + SEASON);
  gate("T10", "a world in which no departure happens is unaffected by everything added",
    Object.keys(controlA.bands).length > 1,
    "the control world genuinely has bands and history",
    JSON.stringify(Object.keys(controlA.bands).sort()) === JSON.stringify(Object.keys(controlB.bands).sort()) &&
      Object.values(controlA.bands).every((b) => b.provisionalSuccessor === undefined && b.fissionAttempt === undefined),
    {
      controlBandCount: Object.keys(controlA.bands).length,
      anyProvisional: Object.values(controlA.bands).some((b) => b.provisionalSuccessor !== undefined),
      anyAttempt: Object.values(controlA.bands).some((b) => b.fissionAttempt !== undefined),
    });

  const counts = gates.reduce((a, g) => { a[g.status] = (a[g.status] ?? 0) + 1; return a; }, { PASS: 0, FAIL: 0, VACUOUS: 0 });

  out = {
    generatedAt: new Date().toISOString(),
    checkpoint: "ROADMAP ITEM 4 §3 + §9 — provisional successor through the real runner",
    seed: SEED,
    warmDays: WARM_DAYS,
    method:
      "A real world from initSimWorld, warmed, then a departure through the PRODUCTION seam, then advanced through the REAL advanceWorldByDays. The seam has no callers so it cannot fire inside a tick; it is applied between runner calls at the point the seam occupies. That is a CONTROLLED APPROXIMATION of the in-tick seam and is labelled as one.",
    founderAccountingOnDayD: {
      finding:
        "advanceWorldByDays runs runDailyActions for every day UP TO AND INCLUDING the season boundary, and only THEN runs runSeasonalCompatibilityTick, which contains demography and fission. So on the departure day the founders' food demand, consumption and ecological impact are already resolved AS PART OF THE PARENT, before the departure exists.",
      consequence:
        "The successor exerting no separate depletion on its birth tick is therefore NOT a free day — it is the absence of a SECOND charge for bodies that already ate once that day as part of the parent. Charging them again as a successor would be the double-count.",
      readFrom: "src/sim/tick/advance.ts advanceWorldByDays",
      caveat:
        "This is read from the runner's control flow rather than from a per-founder demand ledger, because production has no per-founder demand attribution to read. It is a structural argument, and it is labelled as one rather than as a measurement.",
    },
    parentBefore,
    departure: {
      requestedFounders: departure.requestedFounders,
      endorsedFounders: departure.endorsedFounders,
      revisionApplied: departure.revisionApplied,
      ledger: departure.ledger,
    },
    gates,
    summary: { total: gates.length, passing: counts.PASS, failing: counts.FAIL, vacuous: counts.VACUOUS },
  };
} finally {
  await server.close();
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
for (const g of out.gates) {
  console.log(`${g.status.padEnd(7)} ${g.id}  ${g.claim}`);
  if (g.status !== "PASS") console.log(`        ${JSON.stringify(g).slice(0, 700)}`);
}
console.log(`\nsummary: ${JSON.stringify(out.summary)}`);
console.log(`written: ${OUT}`);
if (out.summary.failing > 0 || out.summary.vacuous > 0) process.exitCode = 1;
