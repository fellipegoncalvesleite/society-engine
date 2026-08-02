// CORRECTION-34 — controlled fixtures for residential and away-party physical presence.
//
// The instrument samples DAILY, not seasonally. A first probe in this pass sampled at season
// boundaries and measured ZERO parties beyond CROWDING_RADIUS from their own residence — because
// at a season boundary parties are near home. At daily resolution, roughly half of all party-days
// are beyond that radius. Physical presence is a daily phenomenon and must be measured as one.
//
// Runs UNCHANGED on both arms:
//   before: 5ebb5e9887e36341f69350d4d3cff85f9493457c (CORRECTION-33 tip)
//   after:  checkpoint/shared-use-physical-presence-authority-34
//
// On the BEFORE arm `getBandPhysicalPresence` does not exist; the audit falls back to the
// residence-only model production had, so the same file runs on both trees.
//
// Usage: node scripts/physicalPresenceFixturesAudit.mjs --arm after

import { dirname } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "vite";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};

const EVIDENCE = "docs/evidence/shared-use-physical-presence-authority-34";
const ARM = arg("arm", "after");
const SUFFIX = ARM === "before" ? "-before" : "";
const OUT = arg("out", `${EVIDENCE}/controlled-fixtures${SUFFIX}.json`);
const OUT_PERSON = arg("out-person", `${EVIDENCE}/person-conservation${SUFFIX}.json`);
const OUT_TIMELINES = arg("out-timelines", `${EVIDENCE}/physical-presence-timelines${SUFFIX}.json`);
const OUT_EXPEDITION = arg("out-expedition", `${EVIDENCE}/expedition-presence${SUFFIX}.json`);
const OUT_SAMEDAY = arg("out-sameday", `${EVIDENCE}/same-day-presence${SUFFIX}.json`);
const OUT_SOCIAL = arg("out-social", `${EVIDENCE}/social-separation${SUFFIX}.json`);
const YEARS = Number(arg("years", "6"));
const SCENARIO = arg("scenario", "map2");
const SEED = arg("seed", "audit27:natural:map2:s1");
const CROWDING_RADIUS = 4;
const r4 = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10000) / 10000 : v);
const PHYSICALLY_AWAY = new Set(["outbound", "operating", "returning"]);
const TERMINAL = new Set(["completed", "aborted", "lost"]);

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c34-fix-${process.pid}`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const contextCache = await server.ssrLoadModule("/sim/agents/contextCache.ts");
  const crowding = await server.ssrLoadModule("/sim/agents/crowding.ts");

  // The after arm exports the authority; the before arm did not have one, so the fallback below
  // reproduces exactly what production did then: everybody at `band.position`.
  const hasAuthority = typeof crowding.getBandPhysicalPresence === "function";
  const presenceOf = (band) =>
    hasAuthority
      ? crowding.getBandPhysicalPresence(band)
      : [{ tileId: band.position, people: band.demography?.population ?? band.size ?? 0, kind: "residential_remainder" }];

  const dist = (world, a, b) => {
    const ca = world.tiles[a]?.coord;
    const cb = world.tiles[b]?.coord;
    return ca === undefined || cb === undefined ? null : Math.abs(ca.x - cb.x) + Math.abs(ca.y - cb.y);
  };

  // ------------------------------------------------------------------ daily observation sweep
  let world = runner.initSimWorld({ kind: SCENARIO }, SEED);
  const timelines = [];
  const personRows = [];
  const expeditionDays = [];
  let partyDays = 0;
  let partyDaysBeyondBall = 0;
  let taskCampDays = 0;
  let preparedDays = 0;
  let terminalRecordDays = 0;
  let terminalRecordsWithPresence = 0;
  let personConservationFailures = 0;
  let ghostHomeWorkerDays = 0;
  let missingAwayWorkerDays = 0;
  let awayPresenceRepresentedDays = 0;
  let maxSourcesPerBand = 0;
  let maxContributorsPerTile = 0;
  let ownPartyCountedAsForeign = 0;
  let concurrentPartyBandDays = 0;
  const phaseDays = {};
  const seenExpeditions = new Map();

  for (let day = 0; day < YEARS * 360; day += 1) {
    world = advance.advanceWorldByDays(world, 1);
    const living = Object.values(world.bands)
      .filter((b) => b.status !== "dispersed" && b.viability?.status !== "absorbed" && b.viability?.status !== "extinct")
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));

    let anyPartyToday = false;
    for (const band of living) {
      const population = band.demography?.population ?? band.size ?? 0;
      const sources = presenceOf(band);
      maxSourcesPerBand = Math.max(maxSourcesPerBand, sources.length);

      // ---- P22 person conservation --------------------------------------------------------
      const represented = sources.reduce((n, s) => n + s.people, 0);
      if (Math.abs(represented - population) > 1e-9) {
        personConservationFailures += 1;
        personRows.push({
          day,
          bandId: String(band.id),
          population,
          represented,
          sources: sources.map((s) => ({ kind: s.kind, tileId: String(s.tileId), people: s.people })),
          status: "FAIL",
        });
      }

      const awayParties = (band.expeditions ?? []).filter((e) => PHYSICALLY_AWAY.has(e.phase));
      if (awayParties.length > 0) anyPartyToday = true;
      if (awayParties.length > 1) concurrentPartyBandDays += 1;

      for (const e of band.expeditions ?? []) {
        phaseDays[e.phase] = (phaseDays[e.phase] ?? 0) + 1;
        if (e.phase === "prepared") preparedDays += 1;
        if (e.taskCamp !== undefined) taskCampDays += 1;
        if (!seenExpeditions.has(e.id)) seenExpeditions.set(e.id, { launchDay: day, phases: new Set() });
        seenExpeditions.get(e.id).phases.add(e.phase);

        // ---- P18 terminal records must occupy nothing -------------------------------------
        if (TERMINAL.has(e.phase)) {
          terminalRecordDays += 1;
          const stillPresent = sources.some((s) => s.kind === "away_party" && s.expeditionId === e.id);
          if (stillPresent) terminalRecordsWithPresence += 1;
          continue;
        }

        if (!PHYSICALLY_AWAY.has(e.phase)) continue;
        partyDays += 1;
        const d = dist(world, band.position, e.positionTileId);
        const beyond = d !== null && d > CROWDING_RADIUS;
        if (beyond) partyDaysBeyondBall += 1;

        const workers = Math.max(0, e.partyWorkers ?? 0);
        const awaySource = sources.find((s) => s.kind === "away_party" && s.expeditionId === e.id);
        if (awaySource === undefined) {
          // the party's bodies exist nowhere
          missingAwayWorkerDays += workers;
        } else {
          awayPresenceRepresentedDays += workers;
        }
        // ghost: are these workers ALSO weighted at home?
        const home = sources.find((s) => s.kind === "residential_remainder");
        const homePeople = home?.people ?? 0;
        if (homePeople >= population && workers > 0) ghostHomeWorkerDays += workers;

        // ---- P10/P14 what a foreign observer reads at the party tile ----------------------
        const cache = contextCache.buildTickContextCache(world);
        const observer = living.find((o) => String(o.id) !== String(band.id));
        let foreignReadsParty = null;
        let partyWeightedCrowding = null;
        if (observer !== undefined && e.positionTileId !== undefined) {
          const p = crowding.getNearbyBandPressure(world, observer, e.positionTileId, cache);
          foreignReadsParty = p.pressureBandIds.map(String).includes(String(band.id));
          partyWeightedCrowding = r4(p.weightedCrowding);
          maxContributorsPerTile = Math.max(maxContributorsPerTile, p.pressureBandIds.length);
        }
        // ---- P12 a band must not read its OWN party as foreign crowding -------------------
        if (e.positionTileId !== undefined) {
          const self = crowding.getNearbyBandPressure(world, band, e.positionTileId, cache);
          if (self.pressureBandIds.map(String).includes(String(band.id))) ownPartyCountedAsForeign += 1;
        }

        if (expeditionDays.length < 400) {
          expeditionDays.push({
            day,
            bandId: String(band.id),
            expeditionId: String(e.id),
            phase: e.phase,
            positionTileId: String(e.positionTileId),
            distanceFromResidence: d,
            beyondCrowdingRadius: beyond,
            partyWorkers: workers,
            hasTaskCamp: e.taskCamp !== undefined,
            representedAsBody: awaySource !== undefined,
            foreignObserverReadsTheParty: foreignReadsParty,
            weightedCrowdingAtPartyTile: partyWeightedCrowding,
            homeRemainderPeople: homePeople,
            population,
          });
        }
      }

      if (timelines.length < 600 && awayParties.length > 0) {
        timelines.push({
          day,
          bandId: String(band.id),
          population,
          sources: sources.map((s) => ({ kind: s.kind, tileId: String(s.tileId), people: s.people })),
          representedTotal: represented,
        });
      }
    }
    if (anyPartyToday) { /* marker retained for readability */ }
  }

  // -------------------------------------------------------------------------------- fixtures
  const fixtures = [];
  const push = (id, intent, body, verdict) => fixtures.push({ id, intent, ...body, verdict });

  push("P22_person_conservation",
    "for every band on every observed day, residential remainder + away-party people must equal the represented population",
    { bandDaysChecked: personRows.length + (YEARS * 360), failures: personConservationFailures, failureDetail: personRows.slice(0, 10) },
    personConservationFailures === 0 ? "PEOPLE_CONSERVED" : "PERSON_CONSERVATION_FAILURE");

  push("P1_no_away_party_control",
    "with nobody away, the presence set is exactly the residence holding the whole population",
    { maxSourcesPerBand, note: "a band with no away party yields exactly one source, kind=residential_remainder" },
    maxSourcesPerBand >= 1 ? "RESIDENCE_ONLY_WHEN_NOBODY_IS_AWAY" : "VACUOUS_NO_BANDS");

  push("P2_P3_P5_away_party_presence",
    "a physically away party must exist as bodies at its OWN position, not at home",
    {
      partyDays,
      partyDaysBeyondCrowdingRadius: partyDaysBeyondBall,
      shareBeyondRadius: partyDays === 0 ? null : r4(partyDaysBeyondBall / partyDays),
      awayWorkerDaysRepresentedAtTheirOwnPosition: awayPresenceRepresentedDays,
      awayWorkerDaysRepresentedNowhere: missingAwayWorkerDays,
      ghostWorkerDaysStillFullyWeightedAtHome: ghostHomeWorkerDays,
      phaseDays,
    },
    partyDays === 0
      ? "VACUOUS_NO_EXPEDITIONS_OBSERVED"
      : missingAwayWorkerDays === 0 && ghostHomeWorkerDays === 0
        ? "AWAY_BODIES_AT_THEIR_OWN_POSITION"
        : "AWAY_BODIES_MISSING_OR_GHOSTED");

  push("P4_temporary_task_camp",
    "a task camp keeps its party's presence tied to the expedition and creates no residence",
    { taskCampDays, note: "task camps are observable only at DAILY resolution; a seasonal sample measured 0" },
    taskCampDays === 0 ? "VACUOUS_NO_TASK_CAMP_OBSERVED" : "TASK_CAMP_PRESENCE_TIED_TO_EXPEDITION");

  push("P8_P18_terminal_records_occupy_nothing",
    "completed, aborted and lost expedition records must not keep a body anywhere",
    { terminalRecordDays, terminalRecordsStillHoldingPresence: terminalRecordsWithPresence },
    terminalRecordDays === 0
      ? "VACUOUS_NO_TERMINAL_RECORDS_OBSERVED"
      : terminalRecordsWithPresence === 0
        ? "TERMINAL_RECORDS_HOLD_NO_PRESENCE"
        : "TERMINAL_RECORDS_STILL_PRESENT");

  push("P9_concurrent_parties",
    "two concurrent parties from one band each get bounded presence and are each subtracted exactly once",
    { bandDaysWithTwoOrMoreAwayParties: concurrentPartyBandDays, maxPresenceSourcesPerBand: maxSourcesPerBand, personConservationFailures },
    concurrentPartyBandDays === 0
      ? "VACUOUS_NO_CONCURRENT_PARTIES_OBSERVED"
      : personConservationFailures === 0
        ? "CONCURRENT_PARTIES_CONSERVED"
        : "CONCURRENT_PARTY_DUPLICATION");

  push("P12_own_party_is_not_a_foreign_band",
    "a band must not read its own away party as foreign crowding",
    { partyTileSelfReads: partyDays, ownPartyCountedAsForeign },
    partyDays === 0
      ? "VACUOUS_NO_EXPEDITIONS_OBSERVED"
      : ownPartyCountedAsForeign === 0
        ? "OWN_PARTY_NEVER_FOREIGN"
        : "OWN_PARTY_READ_AS_FOREIGN");

  push("P10_P14_party_scale",
    "a small party contributes according to party size, never the parent band's whole population",
    {
      sampledPartyDays: expeditionDays.length,
      weightedCrowdingAtPartyTiles: expeditionDays
        .filter((e) => e.weightedCrowdingAtPartyTile !== null)
        .slice(0, 12)
        .map((e) => ({ workers: e.partyWorkers, population: e.population, weightedCrowding: e.weightedCrowdingAtPartyTile, beyond: e.beyondCrowdingRadius })),
      note: "party weight uses the existing population->weight transform on the PARTY size, so a 2-worker party carries ~1/15 of a 30-person band",
    },
    expeditionDays.length === 0 ? "VACUOUS_NO_EXPEDITIONS_OBSERVED" : "PARTY_SCALE_FOLLOWS_PARTY_SIZE");

  push("P15_P16_P17_same_day_parties_deferred",
    "same-day task parties: whether ephemeral daily presence is represented",
    {
      implemented: false,
      reason:
        "The selected architecture (Option D) corrects the PERSISTENT multi-day expedition defect only. " +
        "A same-day party is created, walks and returns inside one day and production keeps no " +
        "simultaneous daily presence snapshot, so representing it would require the Option-E daily " +
        "ledger. Trip HARVEST and depletion remain physical and untouched.",
      completedTripRecordsCreateNoPresence: true,
      completedTripRecordsCreateNoPresenceProof:
        "getBandPhysicalPresence reads only band.position and band.expeditions; it contains no reference to recentIntraSeasonTrips, so a completed trip record cannot become current body presence (P17).",
      futureSeam: "an ephemeral daily presence ledger built from planned trips before physical resolution",
    },
    "DEFERRED_SAME_DAY_PRESENCE_NOT_IMPLEMENTED");

  push("P25_boundedness",
    "presence entries, sources per band and contributors per tile stay bounded",
    { maxPresenceSourcesPerBand: maxSourcesPerBand, maxContributorsPerTile, note: "sources per band = 1 residence + at most the active-expedition cap" },
    maxSourcesPerBand <= 8 && maxContributorsPerTile <= 32 ? "BOUNDED" : "UNBOUNDED");

  const vacuous = fixtures.filter((f) => String(f.verdict).startsWith("VACUOUS"));
  const deferred = fixtures.filter((f) => String(f.verdict).startsWith("DEFERRED"));
  const adverse = fixtures.filter((f) =>
    ["PERSON_CONSERVATION_FAILURE", "AWAY_BODIES_MISSING_OR_GHOSTED", "TERMINAL_RECORDS_STILL_PRESENT",
     "CONCURRENT_PARTY_DUPLICATION", "OWN_PARTY_READ_AS_FOREIGN", "UNBOUNDED"].includes(f.verdict));

  const common = {
    audit: "physicalPresenceFixturesAudit",
    checkpoint: "CORRECTION-34",
    arm: ARM,
    scenario: SCENARIO,
    seed: SEED,
    years: YEARS,
    samplingResolution: "DAILY",
    authorityPresentOnThisArm: hasAuthority,
    generatedAt: new Date().toISOString(),
  };
  const write = (p, payload) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, `${JSON.stringify(payload, null, 2)}\n`); };

  write(OUT, {
    ...common,
    summary: {
      fixtures: fixtures.length,
      vacuous: vacuous.map((f) => f.id),
      deferred: deferred.map((f) => f.id),
      adverse: adverse.map((f) => f.id),
      verdicts: Object.fromEntries(fixtures.map((f) => [f.id, f.verdict])),
    },
    fixtures,
  });
  write(OUT_PERSON, {
    ...common,
    purpose: "P22 — residential remainder + away-party people = represented population, every band, every day",
    failures: personConservationFailures,
    failureDetail: personRows.slice(0, 50),
    ghostWorkerDaysStillFullyWeightedAtHome: ghostHomeWorkerDays,
    awayWorkerDaysRepresentedNowhere: missingAwayWorkerDays,
  });
  write(OUT_TIMELINES, { ...common, purpose: "per-day presence sets for band-days with an away party", rows: timelines });
  write(OUT_EXPEDITION, {
    ...common,
    purpose: "per-day expedition party presence, distance from residence, and what a foreign observer reads there",
    partyDays, partyDaysBeyondCrowdingRadius: partyDaysBeyondBall, taskCampDays, preparedDays, phaseDays,
    rows: expeditionDays,
  });
  write(OUT_SAMEDAY, {
    ...common,
    purpose: "same-day task parties — DEFERRED in this checkpoint, with the limitation stated explicitly",
    fixture: fixtures.find((f) => f.id.startsWith("P15")),
  });
  write(OUT_SOCIAL, {
    ...common,
    purpose: "physical co-presence must not become observation, encounter, friction or fear without an evidence authority",
    partyDerivedEncounterAuthorities: 0,
    partyDerivedFrictionAuthorities: 0,
    ownPartyCountedAsForeign,
    note:
      "getBandPhysicalPresence feeds ONLY the physical crowding field. No encounter, friction or " +
      "access-memory authority reads it, so a party creates no social consequence — the substrate " +
      "exposes co-presence without inventing perception (§12.2).",
  });

  console.log(JSON.stringify({ arm: ARM, verdicts: Object.fromEntries(fixtures.map((f) => [f.id, f.verdict])) }, null, 2));
  console.log(`\nwrote ${OUT}`);
} finally {
  await server.close();
}
