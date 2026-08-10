// ROADMAP ITEM 4 §3 — WHICH PRODUCTION PATHS ACTUALLY ADMITTED THE PROVISIONAL SUCCESSOR.
//
// THIS AUDIT EXISTS BECAUSE THE PREVIOUS REPORT OVERCLAIMED.
//
// It said the departure vertical slice was "closed locally" on the strength of a successor being
// alive at the end of a season. That proves only that ordinary viability did not delete it. It does
// NOT prove truthful processing, and the things it did not prove — exactly-once consumption, receipt
// attribution, no free movement, demographic cadence — were precisely the ones left unconstructed.
//
// So this audit stops reasoning about the runner and instruments it. It advances a real world ONE
// DAY AT A TIME with a provisional successor in it, and after every single day records the
// successor's observable state. Any field that moves was moved by some production path that admitted
// it. Any field that never moves was either never reached or is genuinely inert, and the two are
// distinguished by running the identical instrument against an ORDINARY band in the same world —
// which is what stops "nothing happened" being read as "nothing may happen".
//
// A reader is NOT classified safe because the tested seed happened to take no action. Every "no
// change" line is reported next to the control band's line for the same field on the same days.
import { createServer } from "vite";
import { prepareAndDepart, bestKnownTargetAtDistance } from "./lib/preparedDeparture.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/dynamic-fission-daughter-viability-37";
const OUT = arg("out", `${EVIDENCE}/provisional-reader-admission.json`);
const SEED = arg("seed", "audit27:natural:s1");
const WARM_DAYS = Number(arg("warm-days", "1800"));
const OBSERVE_DAYS = Number(arg("observe-days", "200"));

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-i4adm-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const seam = await server.ssrLoadModule("/sim/agents/fissionDepartureSeam.ts");
  const generate = await server.ssrLoadModule("/sim/world/generate.ts");
  const passability = await server.ssrLoadModule("/sim/world/passability.ts");
  const prep = await server.ssrLoadModule("/sim/agents/fissionDeparturePreparation.ts");
  const lc = await server.ssrLoadModule("/sim/agents/bandLifecycle.ts");

  let world = runner.initSimWorld({ kind: "map2" }, SEED);
  world = advance.advanceWorldByDays(world, WARM_DAYS);

  const parent = Object.values(world.bands)
    .filter((b) => lc.isEstablishedBand(b) && b.demography.workingAdults >= 6 && b.demography.population >= 24)
    .sort((a, b) => b.demography.population - a.demography.population)[0];
  if (parent === undefined) throw new Error("no suitable parent");

  const dayD = Number(world.time.day ?? 0);
  const requested = Math.max(2, Math.floor(parent.demography.population * 0.35));
  // A REAL destination at distance, chosen from the tiles the parent knows best. The fixture used to
  // name the parent's own tile, which is a journey of zero days: the group arrived instantly, failed
  // to establish, walked home and reintegrated well inside the window, so the days it spent as a
  // live provisional group — the only days this audit's contract is about — were very few.
  const admTarget = bestKnownTargetAtDistance(generate, passability, world, parent, 4);
  if (admTarget === undefined) throw new Error("no known passable target at distance >= 4");
  const departure = prepareAndDepart({
    prep, seam, world: world, parentId: parent.id, today: dayD,
    lineageId: "LIN-ADM-1", requestedFounders: requested, targetTileId: String(admTarget.id),
    successorBandId: `${parent.id}:provisional:1`,
  }).departure;
  if (departure.ok !== true) throw new Error(`departure refused: ${departure.refusal}`);

  const succId = String(departure.successorId);
  // A CONTROL band: an ordinary established band in the same world, sampled with the identical
  // instrument on the identical days. Without it, "the successor never moved" is indistinguishable
  // from "nothing in this world moves", which is exactly the false-safe reading §3 forbids.
  const controlId = Object.values(departure.world.bands)
    .filter((b) => lc.isEstablishedBand(b) && String(b.id) !== String(parent.id))
    .sort((a, b) => b.demography.population - a.demography.population)[0]?.id;

  /** Every observable a production path could have moved. */
  const observe = (band) => {
    if (band === undefined) return null;
    return {
      position: String(band.position),
      population: Math.round(band.demography.population),
      workingAdults: band.demography.workingAdults,
      dependents: band.demography.dependents,
      elders: band.demography.elders,
      expeditions: (band.expeditions ?? []).length,
      trips: (band.recentIntraSeasonTrips ?? []).length,
      receipts: band.seasonalFoodReceipts === undefined ? 0 : 1,
      receiptPeriod: band.seasonalFoodReceipts?.periodTick ?? null,
      viability: band.viability?.status ?? null,
      acuteRisk: band.acuteRisk === undefined ? 0 : 1,
      fissionEvents: (band.fissionEvents ?? []).length,
      decisions: (band.decisionHistory ?? []).length,
      moveEvents: (band.recentResidentialMoveEvents ?? []).length,
      status: band.status,
      provisionalPhase: band.provisionalSuccessor?.phase ?? null,
      protoCamp: band.protoCampMemory === undefined ? 0 : 1,
    };
  };

  // ── advance ONE DAY AT A TIME and record every change ──
  let w = departure.world;
  const succSeries = [observe(w.bands[succId])];
  const ctrlSeries = [observe(w.bands[controlId])];
  const days = [Number(w.time.day ?? 0)];
  // SAMPLING STOPS WHEN THE ENTITY STOPS BEING A LIVE PROVISIONAL SUCCESSOR, AND THAT IS A REPAIR.
  //
  // The contract under test is "while this entity is a live provisional successor, ordinary-band
  // systems must not admit it". Sampling past its resolution measures the RESOLVER, not an ordinary
  // system: a reintegrated group is removed exactly once, which zeroes its cohorts and gives it a
  // terminal viability — and the old loop counted both as an ordinary system having claimed it.
  //
  // This only became visible now because the departure runs the canonical chain, which produces a
  // world in which the group actually resolves inside the window. The claim was never true of the
  // days after resolution; before, the window simply never reached them.
  let liveDays = 0;
  for (let i = 0; i < OBSERVE_DAYS; i += 1) {
    w = advance.advanceWorldByDays(w, 1);
    const band = w.bands[succId];
    if (band === undefined || !lc.isProvisionalSuccessor(band) || lc.isTerminalProvisionalPhase?.(band.provisionalSuccessor?.phase) === true) break;
    days.push(Number(w.time.day ?? 0));
    succSeries.push(observe(band));
    ctrlSeries.push(observe(w.bands[controlId]));
    liveDays += 1;
  }

  // Every distinct tile the successor stood on, and the travel authority's own record of the ground
  // it walked. `trail` is written only by `provisionalTravel`, so a position absent from it (and from
  // the departure tile the group started on) was reached by something with no authority to move it.
  const finalSuccessor = w.bands[succId];
  const occupiedPositions = [...new Set(succSeries.filter((e) => e !== null).map((e) => e.position))];
  const walkedGround = new Set([
    ...(finalSuccessor?.provisionalSuccessor?.trail ?? []).map(String),
    String(finalSuccessor?.provisionalSuccessor?.departureTileId ?? ""),
    String(finalSuccessor?.position ?? ""),
  ]);
  const accountedPositions = occupiedPositions.filter((id) => walkedGround.has(id));
  const unaccountedPositions = occupiedPositions.filter((id) => !walkedGround.has(id));

  /** Count how many days a field's value differed from the previous day. */
  const changeCount = (series, field) => {
    let n = 0;
    const at = [];
    for (let i = 1; i < series.length; i += 1) {
      if (series[i] === null || series[i - 1] === null) continue;
      if (JSON.stringify(series[i][field]) !== JSON.stringify(series[i - 1][field])) {
        n += 1;
        at.push({ day: days[i], from: series[i - 1][field], to: series[i][field] });
      }
    }
    return { changes: n, at: at.slice(0, 8) };
  };

  const FIELDS = ["position", "population", "workingAdults", "dependents", "elders", "expeditions",
    "trips", "receipts", "viability", "acuteRisk", "fissionEvents", "decisions", "moveEvents",
    "status", "provisionalPhase", "protoCamp"];

  const admission = FIELDS.map((field) => {
    const s = changeCount(succSeries, field);
    const c = changeCount(ctrlSeries, field);
    return {
      field,
      successorChanges: s.changes,
      controlChanges: c.changes,
      successorFirstChanges: s.at,
      // The classification that matters. A zero on the successor means something DIFFERENT depending
      // on whether the control also read zero.
      finding:
        s.changes > 0
          ? "ADMITTED — a production path moved this on the successor"
          : c.changes > 0
            ? "NOT ADMITTED — the control band moved on the same days, so this is a real exclusion rather than a quiet world"
            : "INCONCLUSIVE — neither the successor nor the control moved, so this seed exercises nothing here",
    };
  });

  const admitted = admission.filter((a) => a.finding.startsWith("ADMITTED"));
  const excluded = admission.filter((a) => a.finding.startsWith("NOT ADMITTED"));
  const inconclusive = admission.filter((a) => a.finding.startsWith("INCONCLUSIVE"));

  // ── the specific claims the previous report left unconstructed ──
  const posChanges = changeCount(succSeries, "position");
  const popChanges = changeCount(succSeries, "population");
  const receiptChanges = changeCount(succSeries, "receipts");
  const tripChanges = changeCount(succSeries, "trips");
  const expChanges = changeCount(succSeries, "expeditions");
  const ctrlPop = changeCount(ctrlSeries, "population");

  const claims = {
    // THE CLAIM IS UPDATED, AND THE UPDATE IS STATED. Its old form asserted the position must NEVER
    // change, on the grounds that "travel does not exist yet". Travel exists: `provisionalTravel.ts`
    // is the ONE writer permitted to move a provisional body, and it records every step it takes in
    // the group's own trail. So the truthful claim is not that the group never moves — it is that
    // every tile it stood on was put there by that authority and by nothing else.
    no_free_movement: {
      question: "was every position the successor occupied recorded by the provisional travel authority's own trail?",
      successorPositionChanges: posChanges.changes,
      controlPositionChanges: changeCount(ctrlSeries, "position").changes,
      positionsOccupied: occupiedPositions.length,
      positionsAccountedForByTheTrail: accountedPositions.length,
      unaccountedPositions,
      detail: posChanges.at,
      holds: unaccountedPositions.length === 0,
      note:
        "A position change is legitimate ONLY if the travel authority recorded that step. Anything else would be an ordinary movement path having claimed a provisional group. The control's count says whether bands in this world move at all over the observed span.",
    },
    demographic_cadence: {
      question: "how many times did the successor's population change over the observed span?",
      successorPopulationChanges: popChanges.changes,
      controlPopulationChanges: ctrlPop.changes,
      detail: popChanges.at,
      holds: popChanges.changes <= ctrlPop.changes,
      note:
        "Demography is annual and spring-gated. The claim is NOT that the successor was updated once; it is that it was not updated MORE OFTEN than an ordinary band in the same world over the same days.",
    },
    receipt_attribution: {
      question: "did the successor acquire food receipts, and did it inherit any?",
      inheritedAtBirth: succSeries[0].receipts,
      successorReceiptChanges: receiptChanges.changes,
      controlReceiptChanges: changeCount(ctrlSeries, "receipts").changes,
      detail: receiptChanges.at,
      holds: succSeries[0].receipts === 0,
      note: "Inheritance at birth is the L3 claim and is measured. Whether it EARNS receipts is a subsistence question the successor should not be answering before travel exists.",
    },
    ordinary_subsistence_trips: {
      question: "did the successor run ordinary same-day trips?",
      successorTripChanges: tripChanges.changes,
      controlTripChanges: changeCount(ctrlSeries, "trips").changes,
      detail: tripChanges.at,
      holds: null,
      note: "REPORTED, NOT ASSERTED. Whether a provisional group may forage where it stands is a §4 design question this audit measures rather than decides.",
    },
    expedition_launch: {
      question: "did the successor launch or inherit an expedition?",
      inheritedAtBirth: succSeries[0].expeditions,
      successorExpeditionChanges: expChanges.changes,
      controlExpeditionChanges: changeCount(ctrlSeries, "expeditions").changes,
      detail: expChanges.at,
      holds: succSeries[0].expeditions === 0,
      note: "Inheritance is the L3 claim. A LAUNCH would be an established-band behaviour and is what §4 must block.",
    },
    established_viability_never_claims_it: {
      question: "did Band.viability ever become defined on the successor?",
      successorViabilityChanges: changeCount(succSeries, "viability").changes,
      finalViability: succSeries[succSeries.length - 1]?.viability ?? null,
      controlViabilityChanges: changeCount(ctrlSeries, "viability").changes,
      holds: (succSeries[succSeries.length - 1]?.viability ?? null) === null,
      note: "The control's changes show established viability IS live in this world on the same days.",
    },
    never_fissions: {
      question: "did the successor record a fission event?",
      successorFissionChanges: changeCount(succSeries, "fissionEvents").changes,
      holds: changeCount(succSeries, "fissionEvents").changes === 0,
      note: "Its fissionEvents ring starts empty at construction.",
    },
  };

  out = {
    generatedAt: new Date().toISOString(),
    checkpoint: "ROADMAP ITEM 4 §3 — measured reader admission for a provisional successor",
    supersedes:
      'The previous report\'s claim that "the departure vertical slice is closed locally". A successor being alive at the end of a season proves only that ordinary viability did not delete it. This audit measures what actually touched it.',
    method:
      "A real warmed map2 world with a provisional successor created by the production seam, advanced ONE DAY AT A TIME through the real advanceWorldByDays. Every observable is sampled after every day. An ordinary established band in the same world is sampled with the identical instrument on the identical days, so a zero on the successor can be distinguished from a quiet world.",
    seed: SEED,
    warmDays: WARM_DAYS,
    observedDays: liveDays,
    observeDaysRequested: OBSERVE_DAYS,
    observationStoppedBecause: liveDays < OBSERVE_DAYS ? "the successor resolved and is no longer a live provisional group" : "window elapsed",
    successorId: succId,
    controlBandId: String(controlId),
    successorAtBirth: succSeries[0],
    successorAtEnd: succSeries[succSeries.length - 1],
    admission,
    claims,
    summary: {
      fieldsObserved: FIELDS.length,
      admitted: admitted.length,
      excluded: excluded.length,
      inconclusive: inconclusive.length,
      admittedFields: admitted.map((a) => a.field),
      excludedFields: excluded.map((a) => a.field),
      inconclusiveFields: inconclusive.map((a) => a.field),
      claimsHolding: Object.values(claims).filter((c) => c.holds === true).length,
      claimsFailing: Object.values(claims).filter((c) => c.holds === false).length,
      claimsReportedNotAsserted: Object.values(claims).filter((c) => c.holds === null).length,
    },
  };
} finally {
  await server.close();
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
console.log("ADMISSION BY FIELD (successor vs control):");
for (const a of out.admission) {
  console.log(`  ${a.field.padEnd(18)} succ=${String(a.successorChanges).padStart(3)}  ctrl=${String(a.controlChanges).padStart(3)}  ${a.finding.split(" —")[0]}`);
}
console.log("\nCLAIMS:");
for (const [k, v] of Object.entries(out.claims)) {
  console.log(`  ${v.holds === null ? "REPORTED" : v.holds ? "HOLDS   " : "FAILS   "} ${k}`);
}
console.log(`\nsummary: ${JSON.stringify(out.summary)}`);
console.log(`written: ${OUT}`);
if (out.summary.claimsFailing > 0) process.exitCode = 1;
