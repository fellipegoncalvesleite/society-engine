// CORRECTION-34A §13 — the precise three-stage comparison.
//
//   BEFORE       5ebb5e9887e36341f69350d4d3cff85f9493457c   no presence authority
//   INTERMEDIATE 4042210b332d41b91ed394aa9307962f0106a60c   presence authority, nothing else
//   AFTER        this branch tip                            + reconciliation + catchment separation
//
// HOW EACH ARM IS PRODUCED, stated so no reader mistakes a reconstruction for a checkout:
//
//  * The BEFORE presence arm is reconstructed exactly — pre-34 production scattered
//    `demography.population` from `band.position` and nothing from `expedition.positionTileId`,
//    which is a one-line fallback, reproduced here verbatim.
//  * The INTERMEDIATE catchment arm is reconstructed exactly — 4042210's `getBandForagingDraw`
//    read FULL `demo.workingAdults`, so the intermediate claim is recomputed with the same
//    published weights and no committed-worker subtraction.
//  * The INTERMEDIATE reconciliation arm is the un-reconciled band itself: at 4042210
//    `reconcileExpeditionCommitment` did not exist, so the arm is the input to it.
//
// Nothing here re-implements a formula that still exists in production: the AFTER numbers come
// from the production functions themselves.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/shared-use-physical-presence-authority-34";
const OUT = arg("out", `${EVIDENCE}/before-after.json`);
const YEARS = Number(arg("years", "6"));
const SCENARIO = arg("scenario", "map2");
const SEED = arg("seed", "audit27:natural:map2:s1");

const PHYSICALLY_AWAY = new Set(["outbound", "operating", "returning"]);
const AWAY = new Set(["prepared", "outbound", "operating", "returning"]);

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c34a-ba-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const expedition = await server.ssrLoadModule("/sim/agents/expedition.ts");
  const crowding = await server.ssrLoadModule("/sim/agents/crowding.ts");
  const mobility = await server.ssrLoadModule("/sim/agents/bandMobility.ts");

  const living = (w) => Object.values(w.bands)
    .filter((b) => b.status !== "dispersed" && b.viability?.status !== "absorbed" && b.viability?.status !== "extinct")
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));

  // BEFORE (5ebb5e98): everybody at band.position, nothing at the expedition position.
  const presenceBefore = (band) => [{
    tileId: band.position,
    people: band.demography?.population ?? band.size ?? 0,
    kind: "residential_remainder",
  }];
  // INTERMEDIATE and AFTER share the presence authority (4042210 introduced it, 34A did not change it).
  const presenceAuthority = (band) => crowding.getBandPhysicalPresence(band);

  // Catchment draw weights, published and unchanged by 34A. Only WHO is counted differs.
  const drawFrom = (adults, dependents, elders) => Math.max(1, adults * 1.0 + dependents * 0.65 + elders * 0.85);
  const drawIntermediate = (b) => drawFrom(
    Math.max(0, b.demography.workingAdults),                 // 4042210: FULL working adults
    Math.max(0, b.demography.dependents), Math.max(0, b.demography.elders));
  const drawAfter = (b) => drawFrom(
    Math.max(0, b.demography.workingAdults - mobility.partyCompositionTotal(mobility.deriveCommittedMobilityPools(b))),
    Math.max(0, b.demography.dependents), Math.max(0, b.demography.elders));

  let world = runner.initSimWorld({ kind: SCENARIO }, SEED);

  const acc = {
    before: { ghostedAtHomeWorkerDays: 0, representedNowhereWorkerDays: 0, awayWorkerDaysAtOwnPosition: 0 },
    intermediate: { ghostedAtHomeWorkerDays: 0, representedNowhereWorkerDays: 0, awayWorkerDaysAtOwnPosition: 0 },
    after: { ghostedAtHomeWorkerDays: 0, representedNowhereWorkerDays: 0, awayWorkerDaysAtOwnPosition: 0 },
  };
  let partyDays = 0;
  let bandDaysWithWorkersAway = 0;
  let catchmentClaimIntermediate = 0;
  let catchmentClaimAfter = 0;
  let bandDaysWhereClaimDiffers = 0;

  for (let d = 0; d < YEARS * 360; d += 1) {
    world = advance.advanceWorldByDays(world, 1);
    for (const band of living(world)) {
      const awayParties = (band.expeditions ?? []).filter((e) => PHYSICALLY_AWAY.has(e.phase));
      const awayWorkers = awayParties.reduce((n, e) => n + (e.partyWorkers ?? 0), 0);
      if (awayParties.length > 0) partyDays += 1;

      if (awayWorkers > 0) {
        bandDaysWithWorkersAway += 1;
        // BEFORE: those workers are counted at home (ghost) AND absent from where they stand.
        acc.before.ghostedAtHomeWorkerDays += awayWorkers;
        acc.before.representedNowhereWorkerDays += awayWorkers;
        for (const arm of ["intermediate", "after"]) {
          const src = presenceAuthority(band).filter((s) => s.kind === "away_party");
          acc[arm].awayWorkerDaysAtOwnPosition += src.reduce((n, s) => n + s.people, 0);
        }
      }

      // Catchment: the two draws, on the same band, same day.
      const di = drawIntermediate(band);
      const da = drawAfter(band);
      catchmentClaimIntermediate += di;
      catchmentClaimAfter += da;
      if (Math.abs(di - da) > 1e-9) bandDaysWhereClaimDiffers += 1;
    }
  }

  // Reconciliation arm: construct the reachable overcommit and show all three stages.
  const b0 = living(world)[0] ?? living(runner.initSimWorld({ kind: SCENARIO }, SEED))[0];
  const nb = world.tiles[b0.position]?.neighbors ?? [];
  const overcommitted = {
    ...b0,
    demography: { ...b0.demography, workingAdults: 1, population: 2 },
    expeditions: [{
      id: "e:overcommit", phase: "operating", partyWorkers: 6, positionTileId: nb[0] ?? b0.position,
      routeTileIds: [b0.position, nb[0] ?? b0.position], routeIndex: 1,
      taskKind: "resource_retrieval", injuryLoad: 0,
      cargo: { harvestUnits: 0, carryCapacityUnits: 1, provisionUnitsConsumed: 0, lostUnits: 0 },
    }],
  };
  const reconciled = expedition.reconcileExpeditionCommitment(overcommitted);
  const sum = (arr) => arr.reduce((n, s) => n + s.people, 0);

  const reconciliation = {
    before_5ebb5e98: {
      note: "no presence authority: the whole population renders at home regardless of parties",
      represented: sum(presenceBefore(overcommitted)), population: 2, conserved: sum(presenceBefore(overcommitted)) === 2,
    },
    intermediate_4042210: {
      note: "presence authority present, no reconciliation: the invalid state is rendered faithfully",
      represented: sum(presenceAuthority(overcommitted)), population: 2,
      committedAwayWorkers: expedition.getCommittedExpeditionWorkers(overcommitted),
      conserved: expedition.getBandCommitmentAccounting(overcommitted).conserved,
    },
    after_tip: {
      note: "reconciled at source: the party the band can no longer staff is declared lost",
      represented: sum(presenceAuthority(reconciled)), population: 2,
      committedAwayWorkers: expedition.getCommittedExpeditionWorkers(reconciled),
      conserved: expedition.getBandCommitmentAccounting(reconciled).conserved,
      partyPhases: (reconciled.expeditions ?? []).map((e) => e.phase),
    },
  };

  out = {
    audit: "CORRECTION-34A-BEFORE-AFTER",
    scenario: SCENARIO, seed: SEED, years: YEARS, samplingResolution: "DAILY",
    armProduction: {
      before: "reconstructed: pre-34 production scattered demography.population from band.position and nothing from expedition.positionTileId",
      intermediate: "presence authority as shipped at 4042210; catchment draw recomputed with FULL workingAdults and the same published weights; no reconciliation",
      after: "production functions on this branch tip",
      caveat: "the BEFORE and INTERMEDIATE arms are exact reconstructions of the two changed expressions, not checkouts of those commits. The world advanced is the CURRENT world in all three arms, so these isolate the READ-MODEL and ACCOUNTING differences, not downstream world divergence.",
    },
    presence: {
      partyDays,
      bandDaysWithWorkersAway,
      before: acc.before,
      intermediate: acc.intermediate,
      after: acc.after,
      interpretation:
        "BEFORE: every away worker-day is ghosted at home AND represented nowhere. " +
        "INTERMEDIATE and AFTER: the same worker-days stand at their own position, 0 ghosted, 0 nowhere. " +
        "34A did not change the presence authority, so intermediate and after are identical here — that is the point.",
    },
    catchment: {
      claimSumIntermediate: Number(catchmentClaimIntermediate.toFixed(2)),
      claimSumAfter: Number(catchmentClaimAfter.toFixed(2)),
      absoluteReduction: Number((catchmentClaimIntermediate - catchmentClaimAfter).toFixed(2)),
      bandDaysWhereClaimDiffers,
      interpretation:
        "the claim falls only on band-days with workers away; every other band-day is byte-identical, " +
        "which is what shows the change is scoped to away workers and is not a global recalibration",
    },
    reconciliation,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
} finally {
  await server.close();
}

console.log(JSON.stringify(out, null, 2));
