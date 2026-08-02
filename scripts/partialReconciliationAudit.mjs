// CORRECTION-34B §3 — the mandatory current-state measurement.
//
// Supervising review found that CORRECTION-34A's `reconcileExpeditionCommitment` reduces
// `partyWorkers` but may leave every quantity DERIVED from it untouched: partyComposition, carry
// capacity, cargo, pace inputs, mobility-pool commitments and the residential catchment draw.
//
// This probe constructs the exact reachable case — six workers, composition total six, workforce
// falling to five, party still above EXPEDITION_MIN_PARTY_WORKERS — and measures every authority
// before and after the reconciliation that production currently performs.
//
// It is written to run UNMODIFIED against both fd868d6 (the defect) and the repaired tree, so the
// before/after evidence pair is produced by one instrument.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/shared-use-physical-presence-authority-34";
const OUT = arg("out", `${EVIDENCE}/partial-reconciliation-before.json`);
const SCENARIO = arg("scenario", "map2");
const SEED = arg("seed", "c34b:partial");

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c34b-${process.pid}`,
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
  const catchment = await server.ssrLoadModule("/sim/agents/sharedCatchment.ts");

  let world = runner.initSimWorld({ kind: SCENARIO }, SEED);
  world = advance.advanceWorldByDays(world, 360 * 2);
  const base = Object.values(world.bands)
    .filter((b) => b.status !== "dispersed" && b.viability?.status !== "absorbed" && b.viability?.status !== "extinct")
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];
  if (base === undefined) throw new Error("VACUOUS: no living band");

  const tick = Number(world.time.tick);
  const awayTile = (world.tiles[base.position]?.neighbors ?? [])[0] ?? base.position;

  // The controlled party: six workers, composition total six, real cargo below capacity-for-six.
  const CAPACITY_FOR_SIX = expedition.deriveCarryCapacityUnits(base, 6, 0, tick);
  const HARVEST = Number((CAPACITY_FOR_SIX * 0.9).toFixed(4)); // fits six, will NOT fit five
  const composition = { limited: 1, typical: 4, high: 1 };     // total 6

  const party = {
    id: "expedition:c34b:partial", phase: "operating", partyWorkers: 6,
    partyComposition: composition,
    positionTileId: awayTile, routeTileIds: [base.position, awayTile], routeIndex: 1,
    taskKind: "resource_retrieval", injuryLoad: 0,
    travelDaysElapsed: 2, hardDeadlineDay: 9999,
    cargo: {
      harvestUnits: HARVEST,
      carryCapacityUnits: CAPACITY_FOR_SIX,
      provisionUnitsConsumed: 0,
      lostUnits: 0,
    },
  };

  // Workforce falls to five while the party is away. Population falls by the same one person, so
  // the demographic change itself is internally consistent and only the PARTY is in question.
  const band = {
    ...base,
    demography: {
      ...base.demography,
      workingAdults: 5,
      population: Math.max(5, base.demography.population - (base.demography.workingAdults - 5)),
    },
    expeditions: [party],
  };

  const measure = (b, label) => {
    const e = (b.expeditions ?? [])[0];
    const presence = crowding.getBandPhysicalPresence(b);
    const away = presence.filter((s) => s.kind === "away_party");
    const home = presence.find((s) => s.kind === "residential_remainder");
    const committedPools = mobility.deriveCommittedMobilityPools(b);
    const footprint = catchment.getBandForagingFootprint(world, b);
    const claim = footprint.reduce((n, t) => n + (t.claimWeight ?? t.weight ?? 0), 0);
    const cap = e?.cargo?.carryCapacityUnits ?? 0;
    const carried = e?.cargo?.harvestUnits ?? 0;
    return {
      label,
      partyWorkers: e?.partyWorkers ?? 0,
      phase: e?.phase ?? "(none)",
      outcomeReason: e?.outcomeReason ?? null,
      partyComposition: e?.partyComposition ?? null,
      partyCompositionTotal: e?.partyComposition === undefined ? null : mobility.partyCompositionTotal(e.partyComposition),
      committedViaGetCommittedExpeditionWorkers: expedition.getCommittedExpeditionWorkers(b),
      committedViaDeriveCommittedMobilityPools: mobility.partyCompositionTotal(committedPools),
      committedPools,
      availableMobilityPools: mobility.deriveAvailableMobilityPools(b),
      physicalAwayPeople: away.reduce((n, s) => n + s.people, 0),
      residentialPhysicalPeople: home?.people ?? 0,
      representedPopulation: presence.reduce((n, s) => n + s.people, 0),
      population: b.demography.population,
      workingAdults: b.demography.workingAdults,
      residentialCatchmentDraw: Number(claim.toFixed(4)),
      carryCapacityUnits: cap,
      capacityForCurrentWorkers: e === undefined ? 0 : expedition.deriveCarryCapacityUnits(b, e.partyWorkers, e.injuryLoad ?? 0, tick),
      harvestUnits: carried,
      lostUnits: e?.cargo?.lostUnits ?? 0,
      provisionUnitsConsumed: e?.cargo?.provisionUnitsConsumed ?? 0,
      loadRatio: cap <= 0 ? null : Number(Math.min(1, carried / cap).toFixed(4)),
      partyPaceFactor: e?.partyComposition === undefined ? null : Number(mobility.derivePartyPaceFactor(e.partyComposition).toFixed(4)),
      nextDayProvisionConsumption: Number(((e?.partyWorkers ?? 0) * expedition.EXPEDITION_PROVISION_UNITS_PER_WORKER_DAY).toFixed(6)),
      cargoBeyondCapacity: Number(Math.max(0, carried - cap).toFixed(4)),
    };
  };

  // CORRECTION-34B gave the reconciliation a `currentTick` so it can recompute the carry ceiling.
  // Called arity-tolerantly so this one instrument runs unmodified on both trees.
  const reconcile = (b) => expedition.reconcileExpeditionCommitment.length >= 2
    ? expedition.reconcileExpeditionCommitment(b, tick)
    : expedition.reconcileExpeditionCommitment(b);

  const before = measure(band, "before_reconciliation");
  const after = measure(reconcile(band), "after_current_reconciliation");

  // The consistency questions §5/§6/§7 require.
  const checks = {
    partyWorkersEqualsCompositionTotal:
      after.partyCompositionTotal === null || after.partyWorkers === after.partyCompositionTotal,
    committedTotalsAgree:
      after.committedViaGetCommittedExpeditionWorkers === after.committedViaDeriveCommittedMobilityPools,
    capacityMatchesCurrentWorkers:
      after.carryCapacityUnits === after.capacityForCurrentWorkers,
    cargoWithinCapacity: after.harvestUnits <= after.carryCapacityUnits + 1e-9,
    cargoConserved:
      Math.abs((before.harvestUnits + before.lostUnits) - (after.harvestUnits + after.lostUnits)) < 1e-9,
    cargoNotIncreased: after.harvestUnits <= before.harvestUnits + 1e-9,
    capacityNotIncreased: after.carryCapacityUnits <= before.carryCapacityUnits + 1e-9,
    committedWithinWorkforce: after.committedViaGetCommittedExpeditionWorkers <= after.workingAdults,
    awayWithinPopulation: after.physicalAwayPeople <= after.population,
    presenceConserved: after.representedPopulation === after.population,
    catchmentAgreesWithCommittedWorkers: null, // filled below
  };
  // §7: residential extraction adults must equal workingAdults - canonically committed away workers.
  const expectedEffortAdults = after.workingAdults - after.committedViaGetCommittedExpeditionWorkers;
  const actualEffortAdults = after.workingAdults - after.committedViaDeriveCommittedMobilityPools;
  checks.catchmentAgreesWithCommittedWorkers = expectedEffortAdults === actualEffortAdults;

  const failing = Object.entries(checks).filter(([, v]) => v === false).map(([k]) => k);
  const headline = failing.length === 0 ? "PARTIAL RECONCILIATION CONSISTENT" : "PARTIAL RECONCILIATION SPLIT AUTHORITY";

  out = {
    audit: "CORRECTION-34B-PARTIAL-RECONCILIATION",
    headline,
    scenario: SCENARIO, seed: SEED, tick,
    construction: {
      bandId: String(base.id),
      partyWorkers: 6, partyCompositionTotal: 6,
      workingAdultsAfterDemographicChange: 5,
      minPartyWorkers: expedition.EXPEDITION_MIN_PARTY_WORKERS,
      note: "the party stays above the minimum, so the whole-party-loss path is NOT the one under test",
    },
    before, after, checks,
    failingChecks: failing,
    effortAdults: { expectedFromPartyWorkers: expectedEffortAdults, actualFromMobilityPools: actualEffortAdults },
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
} finally {
  await server.close();
}

console.log(JSON.stringify({ headline: out.headline, failingChecks: out.failingChecks }, null, 2));
