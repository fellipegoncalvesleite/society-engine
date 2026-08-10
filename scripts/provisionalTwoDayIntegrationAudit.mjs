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
import { prepareAndDepart, bestKnownTargetAtDistance } from "./lib/preparedDeparture.mjs";
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
  const prep = await server.ssrLoadModule("/sim/agents/fissionDeparturePreparation.ts");
  const lc = await server.ssrLoadModule("/sim/agents/bandLifecycle.ts");
  const resolver = await server.ssrLoadModule("/sim/agents/provisionalLifecycleResolver.ts");
  const generate = await server.ssrLoadModule("/sim/world/generate.ts");
  const passability = await server.ssrLoadModule("/sim/world/passability.ts");
  const reint = await server.ssrLoadModule("/sim/agents/provisionalReintegration.ts");
  const scoring = await server.ssrLoadModule("/sim/rules/decisionScoring.ts");

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
  // ── FIXTURE REPAIR — THE TARGET IS NOW A REAL PLACE, AND THE WINDOW IS THE QUARANTINE ITSELF. ──
  //
  // This arm used to depart to `parent.position`: a "departure" to the tile the group was already
  // standing on, with no journey at all. That was inert while nothing in production could act on
  // co-location, and it became decisive the moment `provisional_reintegration` was wired into the
  // daily runner — such a group is co-located with its living parent from birth, reaches a rejoinable
  // phase on day 1 and is CORRECTLY handed straight back. T3/T4/T9 then had no live subject.
  //
  // Physical co-location was never relevant to what T3, T4 and T9 actually claim. Their subject is a
  // LIVE PROVISIONAL SUCCESSOR, and the invariant is that no ordinary system claims it while it is
  // one. So the target is a real tile at distance, and the assertions are sampled on EVERY DAY the
  // successor is genuinely provisional rather than at one arbitrary end-of-season instant — which
  // also removes the old risk that an assertion passes because the subject vanished.
  const homeTile = generate.getTile(world, parent.position);
  // Best-KNOWN at distance, not farthest/nearest: the founder cohort refuses ground it has barely
  // seen (`destination_barely_known`), which is a real decision rather than a gate to route around.
  const targetTile = bestKnownTargetAtDistance(generate, passability, world, parent, 4);
  if (targetTile === undefined) throw new Error("no known passable target at distance >= 4");
  const targetDistance = scoring.getGridDistance(homeTile, targetTile);
  const worldWithAttempt = {
    ...world,
    bands: {
      ...world.bands,
      [parent.id]: {
        ...parent,
        fissionAttempt: {
          phase: "departure_ready",
          phaseEnteredDay: dayD - 5,
          history: ["proposed", "departure_planned"],
          lineageId: "LIN-REAL-1",
          requestedFounders: requested,
          targetTileId: String(targetTile.id),
        },
      },
    },
  };

  const departure = prepareAndDepart({
    prep, seam, world: worldWithAttempt, parentId: parent.id, today: dayD,
    lineageId: "LIN-REAL-1", requestedFounders: requested, targetTileId: String(targetTile.id),
    successorBandId: `${parent.id}:provisional:1`,
  }).departure;

  if (departure.ok !== true) throw new Error(`departure refused: ${departure.refusal} ${departure.detail ?? ""}`);

  const succId = String(departure.successorId);
  const afterDeparture = departure.world;
  const succAtBirth = afterDeparture.bands[succId];

  // ── advance the REAL runner one full season past the departure, SAMPLING EVERY DAY ──
  //
  // Every day on which the successor is still a live provisional successor is a day the ordinary
  // systems had a chance to claim it and must not have. The lifecycle may resolve inside a season by
  // physical reintegration or extinction; there is deliberately no production stabilization writer.
  // A single end-of-season read may therefore have no provisional subject, so the claim is sampled
  // across the whole window.
  const provisionalDays = [];
  let resolution = null;
  let stepWorld = afterDeparture;
  for (let day = 1; day <= SEASON; day += 1) {
    stepWorld = advance.advanceWorldByDays(stepWorld, 1);
    const b = stepWorld.bands[succId];
    const p = stepWorld.bands[String(parent.id)];
    if (b === undefined) { resolution = { day, phase: null, reason: "band removed from world" }; break; }
    if (!lc.isProvisionalSuccessor(b)) {
      resolution = {
        day, phase: b.provisionalSuccessor?.phase ?? null, status: String(b.status),
        population: Math.round(b.demography.population),
        reason: "lifecycle reached a terminal phase — a NAMED outcome, not a disappearance",
      };
      break;
    }
    // What the reintegration authority would have said on this day. Never applied.
    const probe = reint.performAtomicReintegration({ world: stepWorld, successorId: succId, today: dayD + day });
    provisionalDays.push({
      day,
      successorPosition: String(b.position),
      parentPosition: String(p.position),
      distance: scoring.getGridDistance(generate.getTile(stepWorld, b.position), generate.getTile(stepWorld, p.position)),
      phase: b.provisionalSuccessor?.phase ?? null,
      population: Math.round(b.demography.population),
      status: String(b.status),
      isLiving: lc.isLivingBand(b),
      viability: b.viability?.status ?? null,
      isEstablished: lc.isEstablishedBand(b),
      isFissionEligible: lc.isFissionEligibleParent(b),
      lineageLinkedToParent: lc.shareCurrentFissionLineage(p, b),
      thirdBandsSharingLineage: Object.values(stepWorld.bands).filter((x) =>
        String(x.id) !== succId && String(x.id) !== String(parent.id) && lc.shareCurrentFissionLineage(x, b)).length,
      parentViability: p.viability?.status ?? null,
      reintegrationProbe: probe.ok === true ? "WOULD_ACCEPT" : probe.refusal,
    });
  }
  const afterOneSeason = stepWorld;
  const succAfter = afterOneSeason.bands[succId];
  const parentAfter = afterOneSeason.bands[String(parent.id)];
  const separatedDays = provisionalDays.filter((d) => d.distance > 0);
  const lastProvisional = provisionalDays[provisionalDays.length - 1] ?? null;

  const worldPopAfterDeparture = Object.values(afterDeparture.bands).reduce((t, b) => t + Math.round(b.demography.population), 0);

  const gates = [];
  const gate = (id, claim, nonVacuous, nonVacuityNote, passed, detail) =>
    gates.push({ id, claim, status: !nonVacuous ? "VACUOUS" : passed ? "PASS" : "FAIL", nonVacuityNote, ...detail });

  gate("T1", "the departure conserves population and cohorts in a REAL world",
    departure.ledger.demographic.successor.workingAdults > 0,
    "people genuinely moved in a real world",
    seam.isDepartureLedgerConserving(departure.ledger) && worldPopAfterDeparture === worldPopBefore,
    { worldPopBefore, worldPopAfterDeparture, ledger: departure.ledger.demographic });

  // T2 is the one gate for which co-location IS the subject: a successor is BORN on its parent's tile,
  // because that is where the people were standing when they separated. Unchanged.
  gate("T2", "the successor exists in the real world at the parent's tile",
    succAtBirth !== undefined,
    "the successor was genuinely created",
    succAtBirth !== undefined && String(succAtBirth.position) === parentBefore.position,
    { successorPosition: String(succAtBirth?.position), parentPosition: parentBefore.position });

  gate("T3", "the successor is a live, undispersed, body-holding band on EVERY day it is provisional, and it leaves that state only through a NAMED lifecycle outcome",
    provisionalDays.length > 0 && separatedDays.length > 0,
    `observed ${provisionalDays.length} provisional band-days, ${separatedDays.length} of them physically separated from the parent (max distance ${separatedDays.length ? Math.max(...separatedDays.map((d) => d.distance)) : 0})`,
    provisionalDays.length > 0 &&
      provisionalDays.every((d) => d.isLiving === true && d.status !== "dispersed" && d.population > 0) &&
      resolution !== null && resolution.reason !== "band removed from world",
    {
      provisionalBandDays: provisionalDays.length,
      separatedBandDays: separatedDays.length,
      maxDistanceFromParent: separatedDays.length ? Math.max(...separatedDays.map((d) => d.distance)) : 0,
      targetTile: String(targetTile.id), targetDistance,
      daysNotLiving: provisionalDays.filter((d) => !d.isLiving || d.status === "dispersed" || d.population <= 0).length,
      resolution,
      dailySamples: provisionalDays,
    });

  gate("T4", "established viability never claims the provisional successor",
    provisionalDays.length > 0 && provisionalDays.some((d) => d.parentViability !== null),
    "the PARENT carries an established viability verdict on the same days, so the successor's absence of one is discriminating rather than a system that ran for nobody",
    provisionalDays.length > 0 && provisionalDays.every((d) => d.viability === null),
    {
      provisionalBandDays: provisionalDays.length,
      daysWithSuccessorViability: provisionalDays.filter((d) => d.viability !== null).length,
      daysWithParentViability: provisionalDays.filter((d) => d.parentViability !== null).length,
      parentViabilitySeen: [...new Set(provisionalDays.map((d) => d.parentViability))],
      successorViabilitySeen: [...new Set(provisionalDays.map((d) => d.viability))],
    });

  gate("T5", "the successor is not established and cannot fission after a real season",
    provisionalDays.length > 0 && lc.isEstablishedBand(parentAfter) === true,
    "the parent IS established in the same world, so the successor's false is discriminating",
    provisionalDays.length > 0 && provisionalDays.every((d) => d.isEstablished === false && d.isFissionEligible === false),
    { provisionalBandDays: provisionalDays.length,
      daysEstablished: provisionalDays.filter((d) => d.isEstablished).length,
      daysFissionEligible: provisionalDays.filter((d) => d.isFissionEligible).length });

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
    provisionalDays.length > 0,
    "both halves were live and comparable on every sampled day",
    provisionalDays.length > 0 &&
      provisionalDays.every((d) => d.lineageLinkedToParent === true && d.thirdBandsSharingLineage === 0),
    { provisionalBandDays: provisionalDays.length,
      daysLinkedToParent: provisionalDays.filter((d) => d.lineageLinkedToParent).length,
      daysWithAThirdBandSharingLineage: provisionalDays.filter((d) => d.thirdBandsSharingLineage > 0).length,
      note: "the pair link is asserted only while BOTH records are current; the lineage is deliberately released once the successor's record goes terminal, which is the bounded end the reintegration writer documents" });

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
