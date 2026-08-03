// CORRECTION-34D §3 — reproduce the headcount/labour split on the state CORRECTION-34C accepts.
//
// Constructs the exact controlled state CORRECTION-34C's L1/L9 accept as valid:
//   population 20, workingAdults 5, elders 7, dependents 8, one operating party of 6.
// and reads EVERY authority §3 names, through production functions wherever they are exported.
// Where a reader is module-private (`getBandForagingDraw`, `estimateTaskGroupPeople`) the audit
// reproduces its published arithmetic and SAYS SO rather than pretending to call it.
//
// This audit is arm-neutral: it runs identically before and after the repair. `--phase` only
// labels the output file.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/shared-use-physical-presence-authority-34";
const PHASE = arg("phase", "before");
const OUT = arg("out", `${EVIDENCE}/headcount-labor-${PHASE}.json`);

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c34d-hl-${process.pid}`,
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

  let world = runner.initSimWorld({ kind: "map2" }, "c34c:fixtures");
  world = advance.advanceWorldByDays(world, 360 * 2);
  const base = Object.values(world.bands)
    .filter((b) => b.status !== "dispersed" && b.viability?.status !== "absorbed" && b.viability?.status !== "extinct")
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];
  const tick = Number(world.time.tick);
  const t1 = (world.tiles[base.position]?.neighbors ?? [])[0] ?? base.position;

  // The exact CORRECTION-34C accepted state.
  const party = {
    id: "e:d", phase: "operating", partyWorkers: 6,
    partyComposition: { limited: 1, typical: 4, high: 1 },
    positionTileId: t1, routeTileIds: [base.position, t1], routeIndex: 1,
    taskKind: "resource_retrieval", injuryLoad: 0, travelDaysElapsed: 2, workDaysElapsed: 0,
    hardDeadlineDay: 9999,
    cargo: {
      harvestUnits: 0,
      carryCapacityUnits: expedition.deriveCarryCapacityUnits(base, 6, 0, tick),
      provisionUnitsConsumed: 0, lostUnits: 0,
    },
  };
  const band = {
    ...base,
    demography: { ...base.demography, population: 20, workingAdults: 5, elders: 7, dependents: 8 },
    expeditions: [party],
  };

  // ── Every authority §3 names ────────────────────────────────────────────────────────────────
  const presence = crowding.getBandPhysicalPresence(band);
  const awayPresence = presence.filter((s) => s.kind === "away_party");
  const homePresence = presence.find((s) => s.kind === "residential_remainder");
  const e = band.expeditions[0];

  const committedPools = mobility.deriveCommittedMobilityPools(band);
  const availablePools = mobility.deriveAvailableMobilityPools(band);
  const paceFactor = mobility.derivePartyPaceFactor(e.partyComposition);
  const pace = mobility.deriveTravelPace(band, "resource_expedition", {
    loadRatio: 0, urgency: 0, injuryLoad: 0, partyComposition: e.partyComposition,
  });

  // Physical headcount authority: what production reads to place bodies (crowding.ts:109).
  const physicalAwayHeadcount = awayPresence.reduce((n, s) => n + s.people, 0);
  // Productive-labour authority: what production reads for work/pace/carrying.
  const productivePartyWorkers = mobility.partyCompositionTotal(e.partyComposition);

  // Provisions: expedition.ts consumeProvisions / provisionsExhausted (module-private, published
  // arithmetic — the constant itself is exported).
  const RATE = expedition.EXPEDITION_PROVISION_UNITS_PER_WORKER_DAY;
  const MAX_DAYS = expedition.EXPEDITION_MAX_DURATION_DAYS;

  // Catchment: sharedCatchment.getBandForagingDraw is module-private; its arithmetic is
  // published in its own comment block and reproduced here, labelled as such.
  const committedAway = mobility.partyCompositionTotal(mobility.deriveCommittedMobilityPools(band));
  const catchmentAdults = Math.max(0, band.demography.workingAdults - committedAway);
  const agedAwayOverflow = Math.max(0, committedAway - Math.max(0, band.demography.workingAdults));
  const catchmentElders = Math.max(0, Math.max(0, band.demography.elders) - agedAwayOverflow);
  const catchmentDependents = Math.max(0, band.demography.dependents);
  const catchmentDraw = Math.max(1, catchmentAdults * 1.0 + catchmentDependents * 0.65 + catchmentElders * 0.85);

  // Target work labour: the expedition's on-site work resolves through `resolveExpeditionTargetWork`
  // -> `buildTripRecord`, whose task-group size comes from `estimateTaskGroupPeople`
  // (intraSeasonTrips.ts:3004, module-private): workingAdults MINUS away partyWorkers.
  const awayWorkersAsReadByTripLabour = (band.expeditions ?? [])
    .filter((x) => ["prepared", "outbound", "operating", "returning"].includes(x.phase))
    .reduce((n, x) => n + x.partyWorkers, 0);
  const residentialLabourForTargetWork = Math.max(
    0, Math.round(band.demography.workingAdults - awayWorkersAsReadByTripLabour),
  );

  const measurements = {
    physicalAwayHeadcount,
    residentialPhysicalHeadcount: homePresence?.people ?? 0,
    totalWorkingAdults: band.demography.workingAdults,
    partyWorkers: e.partyWorkers,
    partyComposition: e.partyComposition,
    partyCompositionTotal: productivePartyWorkers,
    committedMobilityPoolTotal: mobility.partyCompositionTotal(committedPools),
    availableMobilityPoolTotal: availablePools.limited + availablePools.typical + availablePools.high,
    travelPaceTilesPerDay: pace.tilesPerTravelDay,
    travelPacePartyFactor: paceFactor,
    carryCapacityUnits: expedition.deriveCarryCapacityUnits(band, e.partyWorkers, 0, tick),
    provisionConsumptionPerDay: Number((e.partyWorkers * RATE).toFixed(6)),
    maximumProvisionBudget: Number((e.partyWorkers * RATE * MAX_DAYS).toFixed(6)),
    targetWorkResidentialLabour: residentialLabourForTargetWork,
    catchmentAdults, catchmentElders, catchmentDependents,
    catchmentAgedAwayOverflow: agedAwayOverflow,
    catchmentForagingDraw: Number(catchmentDraw.toFixed(4)),
    totalRepresentedPopulation: presence.reduce((n, s) => n + s.people, 0),
    commitmentAccounting: expedition.getBandCommitmentAccounting(band),
  };

  // ── The §3 headline ─────────────────────────────────────────────────────────────────────────
  //
  // The split is present when a party is granted MORE productive labour than the whole band's
  // working-adult cohort holds. `partyCompositionTotal` IS the productive-labour authority every
  // work/pace/carrying reader consumes, so it exceeding `workingAdults` means the party performs
  // labour nobody in the band can supply.
  const labourExceedsCohort = productivePartyWorkers > band.demography.workingAdults;
  // Distinctness would mean the two authorities can differ. They cannot: both read `partyWorkers`
  // / `partyComposition`, and no field separates them.
  const distinctAuthorities =
    physicalAwayHeadcount !== productivePartyWorkers ||
    // or: a named field exists that separates them
    e.physicalPartyPeople !== undefined || e.nonWorkingPartyPeople !== undefined;

  const headline = !labourExceedsCohort || distinctAuthorities
    ? "PHYSICAL HEADCOUNT AND PRODUCTIVE LABOR ARE DISTINCT"
    : "PARTY HEADCOUNT STILL ACTS AS IMPOSSIBLE LABOR";

  out = {
    audit: "CORRECTION-34D-PARTY-HEADCOUNT-LABOR-AUTHORITY",
    phase: PHASE,
    constructedState: {
      population: band.demography.population, workingAdults: band.demography.workingAdults,
      elders: band.demography.elders, dependents: band.demography.dependents,
      parties: 1, partyPhase: e.phase,
    },
    headline,
    split: {
      labourGrantedToParty: productivePartyWorkers,
      bandWorkingAdultCohort: band.demography.workingAdults,
      impossibleLabourGranted: Math.max(0, productivePartyWorkers - band.demography.workingAdults),
      physicalHeadcountAndLabourSeparableInState: distinctAuthorities,
      fieldsPresentOnRecord: {
        partyWorkers: e.partyWorkers !== undefined,
        physicalPartyPeople: e.physicalPartyPeople !== undefined,
        nonWorkingPartyPeople: e.nonWorkingPartyPeople !== undefined,
      },
    },
    measurements,
    privateReaderArithmeticReproduced: [
      "sharedCatchment.getBandForagingDraw (module-private; arithmetic published in its own comment)",
      "intraSeasonTrips.estimateTaskGroupPeople (module-private; reads workingAdults minus away partyWorkers)",
      "expedition.consumeProvisions / provisionsExhausted (module-private; the rate constant is exported)",
    ],
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
} finally {
  await server.close();
}

console.log(JSON.stringify({ phase: out.phase, headline: out.headline, split: out.split, measurements: out.measurements }, null, 2));
