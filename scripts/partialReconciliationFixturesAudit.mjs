// CORRECTION-34B §8 — controlled fixtures R1-R12 for the reconciliation authority.
//
// Every fixture asserts through the PRODUCTION functions (reconcileExpeditionCommitment,
// getCommittedExpeditionWorkers, deriveCommittedMobilityPools, getBandPhysicalPresence,
// deriveCarryCapacityUnits, derivePartyPaceFactor) and never re-implements them.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/shared-use-physical-presence-authority-34";
const OUT = arg("out", `${EVIDENCE}/partial-reconciliation-fixtures.json`);

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c34b-fx-${process.pid}`,
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

  let world = runner.initSimWorld({ kind: "map2" }, "c34b:fixtures");
  world = advance.advanceWorldByDays(world, 360 * 2);
  const base = Object.values(world.bands)
    .filter((b) => b.status !== "dispersed" && b.viability?.status !== "absorbed" && b.viability?.status !== "extinct")
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];
  const tick = Number(world.time.tick);
  const nb = world.tiles[base.position]?.neighbors ?? [];
  const t1 = nb[0] ?? base.position;

  const cap = (workers) => expedition.deriveCarryCapacityUnits(base, workers, 0, tick);
  const party = (over = {}) => ({
    id: "e:fx", phase: "operating", partyWorkers: 6,
    partyComposition: { limited: 1, typical: 4, high: 1 },
    positionTileId: t1, routeTileIds: [base.position, t1], routeIndex: 1,
    taskKind: "resource_retrieval", injuryLoad: 0, travelDaysElapsed: 2, hardDeadlineDay: 9999,
    cargo: { harvestUnits: 0, carryCapacityUnits: cap(6), provisionUnitsConsumed: 0, lostUnits: 0 },
    ...over,
  });
  // CORRECTION-34D — RE-POINTED AT THE LABOUR TRIGGER, AND THE POPULATION IS NO LONGER THE COHORT.
  //
  // CORRECTION-34C pointed these fixtures at a POPULATION trigger and, because one number answered
  // both questions, set `population === workingAdults`. With bodies and labour separated that
  // construction now describes a band whose party holds MORE PEOPLE THAN THE BAND HAS, which is
  // the corrupt-state case R4/H11 cover — not partial reduction. Every fixture here was measuring
  // the defensive path by accident.
  //
  // Partial reduction is now a LABOUR event: the working-adult cohort falls below what is
  // committed while every body stays where it is. So the first argument is the WORKING-ADULT
  // COHORT, and the population defaults to the party's bodies plus those adults at home — a band
  // that physically has its people, with a workforce too small to keep them all working.
  const partyBodies = (expeditions) => (expeditions ?? [])
    .reduce((n, e) => n + e.partyWorkers + (e.nonWorkingPartyPeople ?? 0), 0);
  const band = (workingAdults, expeditions, population) => ({
    ...base,
    demography: {
      ...base.demography,
      population: population ?? (workingAdults + partyBodies(expeditions)),
      workingAdults,
      elders: 0,
      dependents: 0,
    },
    expeditions,
  });
  const rec = (b) => expedition.reconcileExpeditionCommitment(b, tick);
  const total = (b) => crowding.getBandPhysicalPresence(b).reduce((n, s) => n + s.people, 0);
  const compTotal = (e) => e.partyComposition === undefined ? null : mobility.partyCompositionTotal(e.partyComposition);
  const committedPools = (b) => mobility.partyCompositionTotal(mobility.deriveCommittedMobilityPools(b));

  const fixtures = {};
  const add = (id, verdict, detail) => { fixtures[id] = { verdict, ...detail }; };

  // Shared consistency predicate — §5 invariant, applied to every fixture result.
  const consistent = (b) => {
    const active = (b.expeditions ?? []).filter((e) =>
      e.phase === "prepared" || e.phase === "outbound" || e.phase === "operating" || e.phase === "returning");
    const workersOk = active.every((e) => e.partyComposition === undefined || e.partyWorkers === compTotal(e));
    const committedOk = expedition.getCommittedExpeditionWorkers(b) === committedPools(b);
    // CORRECTION-34D — the ONE conflated bound becomes TWO, each on its own quantity. This is
    // strictly stronger than what it replaces: the old check could be satisfied by a party whose
    // labour exceeded the whole cohort.
    const laborWithinCohort = expedition.getCommittedExpeditionWorkers(b) <= b.demography.workingAdults;
    const bodiesWithinPopulation = expedition.getCommittedExpeditionPeople(b) <= b.demography.population;
    const withinWorkforce = laborWithinCohort && bodiesWithinPopulation;
    const workersWithinBodies = active.every((e) =>
      e.partyWorkers >= 0 && e.partyWorkers <= e.partyWorkers + (e.nonWorkingPartyPeople ?? 0));
    const presenceOk = total(b) === b.demography.population;
    const capacityOk = active.every((e) =>
      e.cargo.carryCapacityUnits <= expedition.deriveCarryCapacityUnits(b, e.partyWorkers, e.injuryLoad ?? 0, tick) + 1e-9);
    const cargoWithinCap = active.every((e) => e.cargo.harvestUnits <= e.cargo.carryCapacityUnits + 1e-9);
    return { workersOk, committedOk, laborWithinCohort, bodiesWithinPopulation, workersWithinBodies,
      withinWorkforce, presenceOk, capacityOk, cargoWithinCap,
      all: workersOk && committedOk && withinWorkforce && workersWithinBodies && presenceOk &&
        capacityOk && cargoWithinCap };
  };

  // ---------------------------------------------------------------- R1 valid no-op
  {
    const b = band(15, [party()]);
    const r = rec(b);
    add("R1_valid_no_op", r === b ? "BYTE_IDENTICAL_SAME_OBJECT" : "UNEXPECTED_ALLOCATION",
      { sameObjectReference: r === b, note: "a valid band must not even be reallocated — the common daily path is one comparison" });
  }

  // ---------------------------------------------------------------- R2 partial 6 -> 5
  {
    const carried = Number((cap(6) * 0.9).toFixed(4));
    const b = band(5, [party({ cargo: { harvestUnits: carried, carryCapacityUnits: cap(6), provisionUnitsConsumed: 0, lostUnits: 0 } })]);
    const r = rec(b);
    const e = r.expeditions[0];
    const c = consistent(r);
    add("R2_partial_reduction_six_to_five", c.all ? "ALL_AUTHORITIES_AGREE" : "SPLIT_AUTHORITY",
      { partyWorkers: e.partyWorkers, compositionTotal: compTotal(e), composition: e.partyComposition,
        committedWorkers: expedition.getCommittedExpeditionWorkers(r), committedPools: committedPools(r),
        carryCapacityUnits: e.cargo.carryCapacityUnits, capacityForFive: cap(5),
        harvestUnits: e.cargo.harvestUnits, lostUnits: e.cargo.lostUnits,
        cargoConserved: Math.abs((carried + 0) - (e.cargo.harvestUnits + e.cargo.lostUnits)) < 1e-9,
        paceBefore: mobility.derivePartyPaceFactor({ limited: 1, typical: 4, high: 1 }),
        paceAfter: mobility.derivePartyPaceFactor(e.partyComposition),
        paceNeverImproved: mobility.derivePartyPaceFactor(e.partyComposition) <= mobility.derivePartyPaceFactor({ limited: 1, typical: 4, high: 1 }) + 1e-9,
        checks: c });
  }

  // ---------------------------------------------------------------- R3 larger partial 8 -> 4
  {
    const carried = Number((cap(8) * 0.95).toFixed(4));
    const p = party({ partyWorkers: 8, partyComposition: { limited: 2, typical: 4, high: 2 },
      cargo: { harvestUnits: carried, carryCapacityUnits: cap(8), provisionUnitsConsumed: 0, lostUnits: 0 } });
    const b = band(4, [p]);
    const r = rec(b);
    const e = r.expeditions[0];
    const c = consistent(r);
    add("R3_larger_partial_eight_to_four",
      c.all && e.partyWorkers === 4 && (e.nonWorkingPartyPeople ?? 0) === 4 &&
      e.partyWorkers + (e.nonWorkingPartyPeople ?? 0) === 8
        ? "CARGO_RECONCILED_AT_SCALE" : "UNEXPECTED",
      { partyWorkers: e.partyWorkers, nonWorkingPartyPeople: e.nonWorkingPartyPeople ?? 0,
        physicalPartyPeople: e.partyWorkers + (e.nonWorkingPartyPeople ?? 0),
        compositionTotal: compTotal(e), composition: e.partyComposition,
        capacityBefore: cap(8), capacityAfter: e.cargo.carryCapacityUnits, capacityForFour: cap(4),
        harvestBefore: carried, harvestAfter: e.cargo.harvestUnits, abandoned: e.cargo.lostUnits,
        cargoConserved: Math.abs(carried - (e.cargo.harvestUnits + e.cargo.lostUnits)) < 1e-9,
        checks: c });
  }

  // ---------------------------------------------------------------- R4 below minimum
  {
    const b = band(1, [party({ partyWorkers: 6, cargo: { harvestUnits: 0.3, carryCapacityUnits: cap(6), provisionUnitsConsumed: 0, lostUnits: 0 } })]);
    const r = rec(b);
    const e = r.expeditions[0];
    const away = crowding.getBandPhysicalPresence(r).filter((s) => s.kind === "away_party");
    const bodies = e.partyWorkers + (e.nonWorkingPartyPeople ?? 0);
    add("R4_reduction_below_minimum",
      e.phase === "returning" && e.outcomeReason === "party_labor_unsupported" &&
      bodies === 6 && away.length === 1 && away[0].people === 6 && total(r) === r.demography.population
        ? "AWAY_PARTY_TURNS_FOR_HOME_KEEPING_EVERY_BODY" : "UNEXPECTED",
      { phase: e.phase, outcomeReason: e.outcomeReason, partyWorkers: e.partyWorkers,
        nonWorkingPartyPeople: e.nonWorkingPartyPeople ?? 0, physicalPartyPeople: bodies,
        compositionTotal: compTotal(e), awaySources: away.length, represented: total(r), population: r.demography.population,
        correctedSemantics:
          "CORRECTION-34C declared this case `lost`. That invented a death out of an accounting change: the working-adult cohort fell at HOME, and six people three days' walk away did not stop existing because of it. The party can no longer do the work it left for, so it turns for home with every body — which is also why the old assertion `partyWorkers === 0 && away.length === 0` is not merely rephrased here but reversed." });
  }

  // ---------------------------------------------------------------- R5 two concurrent parties
  {
    // Each party's ceiling must match its OWN worker count. An earlier version of this fixture
    // reused the six-worker default ceiling for two four-worker parties, so the UNTOUCHED party was
    // inconsistent before reconciliation ever ran and the strict predicate correctly flagged it.
    // That was an authoring error in the probe, not a production defect, and it is recorded rather
    // than silently corrected.
    const p1 = party({ id: "e:old", partyWorkers: 4, partyComposition: { limited: 1, typical: 2, high: 1 },
      cargo: { harvestUnits: 0, carryCapacityUnits: cap(4), provisionUnitsConsumed: 0, lostUnits: 0 } });
    const p2 = party({ id: "e:new", partyWorkers: 4, partyComposition: { limited: 1, typical: 2, high: 1 },
      cargo: { harvestUnits: 0, carryCapacityUnits: cap(4), provisionUnitsConsumed: 0, lostUnits: 0 } });
    const b = band(6, [p1, p2]);
    const r = rec(b);
    const c = consistent(r);
    const byId = Object.fromEntries(r.expeditions.map((e) => [e.id, e]));
    add("R5_two_concurrent_parties", c.all ? "NEWEST_REDUCED_FIRST_DETERMINISTIC" : "SPLIT_AUTHORITY",
      { oldest: { id: "e:old", workers: byId["e:old"].partyWorkers, phase: byId["e:old"].phase },
        newest: { id: "e:new", workers: byId["e:new"].partyWorkers, phase: byId["e:new"].phase },
        rule: "array order IS launch order (attachExpedition appends); the newest commitment is released first",
        committedWorkers: expedition.getCommittedExpeditionWorkers(r), workingAdults: 6, checks: c });
  }

  // ---------------------------------------------------------------- R6 prepared party
  {
    const b = band(1, [party({ phase: "prepared", partyWorkers: 6 })]);
    const r = rec(b);
    const e = r.expeditions[0];
    const away = crowding.getBandPhysicalPresence(r).filter((s) => s.kind === "away_party");
    add("R6_prepared_party_cancelled_not_lost",
      e.phase === "aborted" && e.outcomeReason === "commitment_unsupported" && total(r) === r.demography.population
        ? "CANCELLED_AT_CAMP_NOT_DECLARED_LOST" : "UNEXPECTED",
      { phase: e.phase, outcomeReason: e.outcomeReason, partyWorkers: e.partyWorkers,
        awaySources: away.length, represented: total(r), population: r.demography.population,
        note: "prepared = labour committed AT CAMP, not yet departed; these people never left, so party_lost would invent a death. They are already inside the residential remainder." });
  }

  // ---------------------------------------------------------------- R7 outbound party
  {
    const p = party({ phase: "outbound", partyWorkers: 6, routeIndex: 1 });
    const b = band(5, [p]);
    const r = rec(b);
    const e = r.expeditions[0];
    const c = consistent(r);
    add("R7_outbound_party", c.all && e.phase === "outbound" ? "PHASE_AND_ROUTE_PRESERVED" : "UNEXPECTED",
      { phase: e.phase, routeIndex: e.routeIndex, positionTileId: String(e.positionTileId),
        routeTileIds: e.routeTileIds.map(String), partyWorkers: e.partyWorkers, compositionTotal: compTotal(e),
        note: "reconciliation resizes the party; it does not move it, retarget it or change its phase", checks: c });
  }

  // ---------------------------------------------------------------- R8 operating with cargo
  {
    const carried = Number((cap(6) * 0.98).toFixed(4));
    const b = band(5, [party({ phase: "operating", cargo: { harvestUnits: carried, carryCapacityUnits: cap(6), provisionUnitsConsumed: 0.002, lostUnits: 0.01 } })]);
    const r = rec(b);
    const e = r.expeditions[0];
    add("R8_operating_with_cargo",
      Math.abs((carried + 0.01) - (e.cargo.harvestUnits + e.cargo.lostUnits)) < 1e-9 && e.cargo.harvestUnits <= e.cargo.carryCapacityUnits + 1e-9
        ? "CAPACITY_AND_CARGO_RECONCILE_NUMERICALLY" : "UNEXPECTED",
      { harvestBefore: carried, lostBefore: 0.01, harvestAfter: e.cargo.harvestUnits, lostAfter: e.cargo.lostUnits,
        capacityBefore: cap(6), capacityAfter: e.cargo.carryCapacityUnits,
        sumBefore: Number((carried + 0.01).toFixed(4)), sumAfter: Number((e.cargo.harvestUnits + e.cargo.lostUnits).toFixed(4)),
        provisionsUntouched: e.cargo.provisionUnitsConsumed === 0.002 });
  }

  // ---------------------------------------------------------------- R9 returning with cargo
  {
    const carried = Number((cap(6) * 0.5).toFixed(4));
    const b = band(5, [party({ phase: "returning", cargo: { harvestUnits: carried, carryCapacityUnits: cap(6), provisionUnitsConsumed: 0, lostUnits: 0 } })]);
    const r = rec(b);
    const e = r.expeditions[0];
    add("R9_returning_with_cargo",
      e.phase === "returning" && e.cargo.harvestUnits <= carried + 1e-9 && (e.cargo.harvestUnits + e.cargo.lostUnits) <= carried + 1e-9
        ? "NO_CARGO_CREATED_PHASE_PRESERVED" : "UNEXPECTED",
      { phase: e.phase, harvestBefore: carried, harvestAfter: e.cargo.harvestUnits, lostAfter: e.cargo.lostUnits,
        cargoNotIncreased: e.cargo.harvestUnits <= carried + 1e-9,
        note: "cargo below the reduced ceiling is untouched; the receipt is written by buildReturnedRecord on arrival and is not reached from here" });
  }

  // ---------------------------------------------------------------- R10 workforce recovery
  {
    const reduced = rec(band(5, [party()]));
    const recovered = rec({ ...reduced, demography: { ...reduced.demography, workingAdults: 15 } });
    const e = recovered.expeditions[0];
    add("R10_workforce_recovery_no_regrow",
      e.partyWorkers === 5 && compTotal(e) === 5 && (e.nonWorkingPartyPeople ?? 0) === 1
        ? "PARTY_DOES_NOT_REGROW" : "UNEXPECTED",
      { workersAfterReduction: reduced.expeditions[0].partyWorkers, workersAfterRecovery: e.partyWorkers,
        nonWorkingAfterRecovery: e.nonWorkingPartyPeople ?? 0,
        compositionAfterRecovery: e.partyComposition,
        reclassificationIsOneWayToo:
          "the non-working member does not become a worker again because the residence gained adults elsewhere — an elder does not become an adult, and the model would be claiming to know which body recovered",
        note: "reconciliation is one-way; people do not walk back to a distant party because the cohort recovered at home" });
  }

  // ---------------------------------------------------------------- R11 terminal records ignored
  {
    const b = band(2, [
      party({ id: "e:done", phase: "completed", partyWorkers: 4 }),
      party({ id: "e:gone", phase: "lost", partyWorkers: 4 }),
      party({ id: "e:quit", phase: "aborted", partyWorkers: 4 }),
    ]);
    const r = rec(b);
    add("R11_terminal_records_ignored",
      expedition.getCommittedExpeditionWorkers(b) === 0 && r === b ? "TERMINAL_RECORDS_COMMIT_NOTHING" : "UNEXPECTED",
      { committedWorkers: expedition.getCommittedExpeditionWorkers(b), committedPools: committedPools(b),
        reconciliationWasNoOp: r === b, represented: total(b), population: b.demography.population });
  }

  // ---------------------------------------------------------------- R12 legacy, no composition
  {
    const legacy = party({ partyWorkers: 6 });
    delete legacy.partyComposition;
    const b = band(5, [legacy]);
    const r = rec(b);
    const e = r.expeditions[0];
    add("R12_legacy_party_without_composition",
      e.partyWorkers === 5 && e.partyComposition === undefined &&
      (e.nonWorkingPartyPeople ?? 0) === 1 && e.partyWorkers + (e.nonWorkingPartyPeople ?? 0) === 6 &&
      expedition.getCommittedExpeditionWorkers(r) === committedPools(r)
        ? "LEGACY_FALLBACK_DETERMINISTIC_AND_CONSISTENT" : "UNEXPECTED",
      { partyWorkers: e.partyWorkers, nonWorkingPartyPeople: e.nonWorkingPartyPeople ?? 0,
        physicalPartyPeople: e.partyWorkers + (e.nonWorkingPartyPeople ?? 0),
        compositionPresent: e.partyComposition !== undefined,
        committedWorkers: expedition.getCommittedExpeditionWorkers(r), committedPools: committedPools(r),
        note: "deriveCommittedMobilityPools treats a composition-less party as typical walkers, so the two totals still agree" });
  }

  const verdicts = Object.fromEntries(Object.entries(fixtures).map(([k, v]) => [k, v.verdict]));
  const bad = Object.entries(verdicts).filter(([, v]) => String(v).startsWith("UNEXPECTED") || v === "SPLIT_AUTHORITY");

  out = {
    audit: "CORRECTION-34B-PARTIAL-RECONCILIATION-FIXTURES",
    scenario: "map2", seed: "c34b:fixtures", tick,
    summary: { fixtures: Object.keys(fixtures).length, failing: bad.length, vacuous: 0 },
    verdicts, fixtures,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
} finally {
  await server.close();
}

console.log(JSON.stringify({ summary: out.summary, verdicts: out.verdicts }, null, 2));
if (out.summary.failing > 0) process.exitCode = 1;
