// CORRECTION-34A §6/§9/§12 — controlled fixtures for the two repairs this checkpoint made, plus
// the terminal and overcommit cases 40 years of natural map1 does not reach.
//
// These are deliberately CONSTRUCTED rather than waited for. The natural sweep in
// physicalPresenceFixturesAudit.mjs already proves the phases that DO occur naturally
// (outbound/operating/returning/task camp/concurrent parties); §11 requires the rest be proven by
// fixture rather than marked successful on zero observations.
//
// Every fixture asserts through the PRODUCTION predicate (`getBandCommitmentAccounting`,
// `getBandPhysicalPresence`, `getBandForagingFootprint`) and never re-implements it.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/shared-use-physical-presence-authority-34";
const OUT = arg("out", `${EVIDENCE}/person-conservation-fixtures.json`);
const OUT_CATCHMENT = arg("out-catchment", `${EVIDENCE}/catchment-expedition-accounting.json`);
const SCENARIO = arg("scenario", "map2");
const SEED = arg("seed", "c34a:fixtures");

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c34a-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const expedition = await server.ssrLoadModule("/sim/agents/expedition.ts");
  const crowding = await server.ssrLoadModule("/sim/agents/crowding.ts");
  const catchment = await server.ssrLoadModule("/sim/agents/sharedCatchment.ts");

  // A real warmed world and a real band — fixtures perturb production state, never invent a world.
  let world = runner.initSimWorld({ kind: SCENARIO }, SEED);
  world = advance.advanceWorldByDays(world, 360 * 2);
  const baseBand = Object.values(world.bands)
    .filter((b) => b.status !== "dispersed" && b.viability?.status !== "absorbed" && b.viability?.status !== "extinct")
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];

  if (baseBand === undefined) throw new Error("VACUOUS: no living band in the warmed world");

  const neighbours = world.tiles[baseBand.position]?.neighbors ?? [];
  const awayTile = neighbours[0] ?? baseBand.position;
  const awayTile2 = neighbours[1] ?? awayTile;

  // Minimal party record carrying exactly the fields the presence/commitment authorities read.
  const party = (id, phase, workers, tileId) => ({
    id, phase, partyWorkers: workers, positionTileId: tileId,
    routeTileIds: [baseBand.position, tileId], routeIndex: 1,
    taskKind: "resource_retrieval", injuryLoad: 0,
    cargo: { harvestUnits: 0, carryCapacityUnits: 1, provisionUnitsConsumed: 0, lostUnits: 0 },
  });

  const withBand = (over) => ({
    ...baseBand,
    ...over,
    demography: { ...baseBand.demography, ...(over.demography ?? {}) },
  });

  const presenceTotal = (band) =>
    crowding.getBandPhysicalPresence(band).reduce((n, s) => n + s.people, 0);
  const presenceAt = (band, kind) =>
    crowding.getBandPhysicalPresence(band).filter((s) => s.kind === kind);

  const fixtures = {};
  const record = (id, verdict, detail) => { fixtures[id] = { verdict, ...detail }; };

  const pop = baseBand.demography.population;
  const adults = baseBand.demography.workingAdults;

  // ---------------------------------------------------------------- P1 residence-only control
  {
    const band = withBand({ expeditions: [] });
    const acc = expedition.getBandCommitmentAccounting(band);
    record("P1_residence_only_control",
      presenceTotal(band) === pop && acc.committedAwayWorkers === 0 && acc.conserved
        ? "FULL_RESIDENTIAL_POPULATION" : "UNEXPECTED",
      { population: pop, represented: presenceTotal(band), committedAway: 0 });
  }

  // ---------------------------------------------------------------- P2 prepared = bodies at home
  {
    const band = withBand({ expeditions: [party("e:prep", "prepared", 2, awayTile)] });
    const away = presenceAt(band, "away_party");
    const home = presenceAt(band, "residential_remainder")[0];
    // `prepared` is labour committed at camp, NOT yet departed (types.ts:933): it must consume
    // labour but leave NO body away.
    record("P2_prepared_labor_committed_bodies_home",
      away.length === 0 && home.people === pop && expedition.getCommittedExpeditionWorkers(band) === 2
        ? "LABOR_COMMITTED_BODIES_AT_HOME" : "UNEXPECTED",
      { awaySources: away.length, homePeople: home.people, committedLabour: expedition.getCommittedExpeditionWorkers(band),
        note: "committed labour and physical absence are different questions; prepared answers only the first" });
  }

  // ---------------------------------------------------------------- P3/P5 away party is away
  {
    const band = withBand({ expeditions: [party("e:out", "outbound", 3, awayTile)] });
    const away = presenceAt(band, "away_party");
    const home = presenceAt(band, "residential_remainder")[0];
    record("P3_outbound_party_at_its_own_position",
      away.length === 1 && away[0].people === 3 && String(away[0].tileId) === String(awayTile)
        && home.people === pop - 3 && presenceTotal(band) === pop
        ? "WORKERS_AT_ROUTE_POSITION" : "UNEXPECTED",
      { awayTile: String(awayTile), awayPeople: away[0]?.people, homePeople: home.people, total: presenceTotal(band) });
  }

  // ---------------------------------------------------------------- P7/P8 terminal = no bodies
  for (const [id, phase] of [["P7_aborted_holds_no_body", "aborted"], ["P8_lost_holds_no_body", "lost"]]) {
    const band = withBand({ expeditions: [party(`e:${phase}`, phase, 3, awayTile)] });
    const away = presenceAt(band, "away_party");
    record(id,
      away.length === 0 && presenceTotal(band) === pop ? "TERMINAL_OCCUPIES_NOTHING" : "UNEXPECTED",
      { phase, awaySources: away.length, represented: presenceTotal(band), population: pop,
        note: "a terminal record is history; it holds no immortal body and restores the residential remainder" });
  }

  // ---------------------------------------------------------------- P9 two concurrent parties
  {
    const band = withBand({ expeditions: [party("e:a", "outbound", 2, awayTile), party("e:b", "operating", 2, awayTile2)] });
    const away = presenceAt(band, "away_party");
    const home = presenceAt(band, "residential_remainder")[0];
    const acc = expedition.getBandCommitmentAccounting(band);
    record("P9_two_concurrent_parties",
      away.length === 2 && away.every((s) => s.people === 2) && home.people === pop - 4
        && presenceTotal(band) === pop && acc.conserved
        ? "EACH_PARTY_ONCE_REMAINDER_CORRECT" : "UNEXPECTED",
      { parties: away.length, perParty: away.map((s) => s.people), homePeople: home.people,
        represented: presenceTotal(band), population: pop, conserved: acc.conserved });
  }

  // ------------------------------------------- P10 the §6 defect: population falls while away
  {
    // A LEGAL launch, then the workforce collapses beneath it — the only reachable route to
    // sum(away) > population, since demography/viability/fission never see expeditions.
    const committed = Math.max(4, Math.min(adults, 6));
    const collapsed = withBand({
      expeditions: [party("e:big", "operating", committed, awayTile)],
      demography: { workingAdults: 1, population: 2 },
    });

    const before = {
      committedAwayWorkers: expedition.getCommittedExpeditionWorkers(collapsed),
      conserved: expedition.getBandCommitmentAccounting(collapsed).conserved,
      represented: presenceTotal(collapsed),
      population: 2,
    };

    const after = expedition.reconcileExpeditionCommitment(collapsed);
    const accAfter = expedition.getBandCommitmentAccounting(after);
    const afterParties = (after.expeditions ?? []);
    const stillAway = afterParties.filter((e) => e.phase === "outbound" || e.phase === "operating" || e.phase === "returning" || e.phase === "prepared");

    record("P10_overcommit_after_population_loss_is_reconciled",
      before.conserved === false && accAfter.conserved === true && presenceTotal(after) === 2
        ? "INVALID_STATE_REPAIRED_AT_SOURCE" : "UNEXPECTED",
      {
        before, after: {
          committedAwayWorkers: accAfter.committedAwayWorkers,
          conserved: accAfter.conserved,
          represented: presenceTotal(after),
          partyPhases: afterParties.map((e) => e.phase),
          stillAwayParties: stillAway.length,
        },
        note: "the party shrinks or is declared lost; the read model neither invents nor deletes people",
      });
  }

  // ---------------------------------------------------------------- P20 history is not presence
  {
    const band = withBand({
      expeditions: [party("e:done", "completed", 4, awayTile)],
      recentIntraSeasonTrips: baseBand.recentIntraSeasonTrips ?? [],
    });
    record("P20_completed_history_creates_no_bodies",
      presenceAt(band, "away_party").length === 0 && presenceTotal(band) === pop
        ? "HISTORY_IS_NOT_OCCUPANCY" : "UNEXPECTED",
      { tripRecords: (band.recentIntraSeasonTrips ?? []).length, represented: presenceTotal(band), population: pop });
  }

  // ------------------------------------------------- P22 catchment: effort vs demand separated
  const catchmentRows = [];
  {
    // Two bands, IDENTICAL demography, differing ONLY in how many workers are away.
    const home = withBand({ id: baseBand.id, expeditions: [] });
    const awayHalf = withBand({ id: baseBand.id, expeditions: [party("e:c", "operating", 3, awayTile)] });

    const footHome = catchment.getBandForagingFootprint(world, home);
    const footAway = catchment.getBandForagingFootprint(world, awayHalf);
    const claimHome = footHome.reduce((n, t) => n + (t.claimWeight ?? t.weight ?? 0), 0);
    const claimAway = footAway.reduce((n, t) => n + (t.claimWeight ?? t.weight ?? 0), 0);

    // Demand is deliberately untouched: both bands still have to feed everyone.
    const demandHome = home.demography.population;
    const demandAway = awayHalf.demography.population;

    catchmentRows.push(
      { arm: "all_workers_home", awayWorkers: 0, catchmentClaim: claimHome, consumptionDemand: demandHome },
      { arm: "three_workers_away", awayWorkers: 3, catchmentClaim: claimAway, consumptionDemand: demandAway },
    );

    record("P22_catchment_effort_vs_demand",
      claimAway < claimHome && demandAway === demandHome
        ? "EFFORT_FALLS_DEMAND_HOLDS" : (claimAway === claimHome ? "EFFORT_UNCHANGED_STILL_CONFLATED" : "UNEXPECTED"),
      {
        catchmentClaim: { allHome: claimHome, threeAway: claimAway },
        consumptionDemand: { allHome: demandHome, threeAway: demandAway },
        note: "local extraction effort must fall when bodies leave; consumption demand must not, because an away worker still eats",
      });
  }

  const verdicts = Object.fromEntries(Object.entries(fixtures).map(([k, v]) => [k, v.verdict]));
  const unexpected = Object.entries(verdicts).filter(([, v]) => v === "UNEXPECTED" || v === "EFFORT_UNCHANGED_STILL_CONFLATED");

  out = {
    audit: "CORRECTION-34A-PERSON-CONSERVATION-CATCHMENT-FIXTURES",
    scenario: SCENARIO, seed: SEED,
    band: { id: String(baseBand.id), population: pop, workingAdults: adults },
    summary: { fixtures: Object.keys(fixtures).length, unexpected: unexpected.length, vacuous: 0 },
    verdicts,
    fixtures,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  mkdirSync(dirname(OUT_CATCHMENT), { recursive: true });
  writeFileSync(OUT_CATCHMENT, `${JSON.stringify({
    audit: "CORRECTION-34A-CATCHMENT-EXPEDITION-ACCOUNTING",
    scenario: SCENARIO, seed: SEED,
    decision: "Option C — separate local extraction effort from consumption demand",
    changed: "sharedCatchment.getBandForagingDraw now counts adults physically at camp",
    unchanged: "carryingCapacity.derivePopulationDemand still counts the whole band",
    rows: catchmentRows,
    verdict: fixtures.P22_catchment_effort_vs_demand?.verdict,
  }, null, 2)}\n`, "utf8");
} finally {
  await server.close();
}

console.log(JSON.stringify(out, null, 2));
if (out === undefined || out.summary.unexpected > 0) process.exitCode = 1;
