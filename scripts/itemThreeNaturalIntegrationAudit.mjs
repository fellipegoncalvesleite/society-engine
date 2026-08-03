// ROADMAP ITEM 3 — natural integrated occurrence, sampled DAILY.
//
// One pass over a real production run, counting every Item 3 quantity together so that a
// conservation failure in one authority cannot hide behind another's clean sheet.
//
// A natural ZERO here is a NULL OBSERVATION, never a proof. The controlled I1-I16 fixtures are
// the proof; this measures how often the integrated machinery runs at all and whether anything
// unexpected appears when it does.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/shared-range-item-3-final-freeze";
const YEARS = Number(arg("years", "20"));
const SEED = arg("seed", "audit27:natural:map2:s1");
const MAP = arg("map", "map2");
const OUT = arg("out", `${EVIDENCE}/integrated-natural-${YEARS}y.json`);
// Access-memory derivation is the expensive read; sample it on a season cadence rather than daily.
const ACCESS_EVERY_DAYS = Number(arg("access-every", "90"));
// accessNorms.ts:57 — the weight below which a surviving record no longer counts as active.
const SOCIAL_EVIDENCE_ACTIVE_MIN_WEIGHT = 0.05;

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-item3-nat-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const crowding = await server.ssrLoadModule("/sim/agents/crowding.ts");
  const accessNorms = await server.ssrLoadModule("/sim/agents/accessNorms.ts");
  const expedition = await server.ssrLoadModule("/sim/agents/expedition.ts");
  const mobility = await server.ssrLoadModule("/sim/agents/bandMobility.ts");

  const MIN = expedition.EXPEDITION_MIN_PARTY_WORKERS;
  let world = runner.initSimWorld({ kind: MAP }, SEED);
  const days = YEARS * 360;
  const started = Date.now();

  const a = {
    bandDays: 0, livingBandsAtEnd: 0, maxLivingBands: 0,
    // shared range
    encounterRecordsAtEnd: 0, encountersObservedNew: 0,
    frictionRecordsAtEnd: 0, frictionRecordsObservedNew: 0,
    contactMemoriesAtEnd: 0,
    bandSeasonsWithForeignCrowding: 0, foreignCrowdingSum: 0, maxForeignCrowding: 0,
    maxCrowdingContributorsOnOneTile: 0,
    accessSamples: 0, activeAccessExpectations: 0, releasedAccessExpectations: 0,
    coolingAccessExpectations: 0, retainedButInertRecords: 0,
    // expedition physical
    activePartyDays: 0, preparedPartyDays: 0, outboundPartyDays: 0,
    operatingPartyDays: 0, returningPartyDays: 0, taskCampDays: 0,
    awayPeopleDays: 0, awayWorkerDays: 0, nonWorkingAwayPersonDays: 0,
    targetWorkDays: 0, targetWorkDepletionSum: 0, targetWorkSupportSum: 0,
    // conservation / adverse
    physicalConservationFailures: 0, laborBoundFailures: 0,
    presenceSumMismatches: 0, ghostBodyBandDays: 0, bodiesRepresentedNowhereBandDays: 0,
    targetWorkLaborMismatches: 0, invalidTargetWorkLaborCalls: 0,
    catchmentEffortNegativeBandDays: 0,
    receiptsBeforeReturn: 0, duplicateReceipts: 0, supportWithoutSource: 0,
    releasedRecordsActingAsCurrentState: 0,
    releasedPlacesBehaviourallyChecked: 0, releasedPlacesStillMovingBehaviour: 0,
    sameDayPresenceObservations: 0,
    fissionsWithActiveParties: 0, preparedCommitmentsAtFission: 0,
    // bounds
    maxPresenceSourcesPerBand: 0, maxTripRecordsPerBand: 0, maxOutcomeRecordsPerBand: 0,
    maxFrictionRecordsPerBand: 0, maxEncounterRecordsPerBand: 0, maxActivePartiesPerBand: 0,
    maxAccessPlacesPerBand: 0,
  };

  const seenWorkDay = new Set();
  const seenReceipt = new Set();
  const seenEncounter = new Set();
  const seenFriction = new Set();
  let priorBandCount = null;

  for (let d = 0; d < days; d += 1) {
    world = advance.advanceWorldByDays(world, 1);
    const sampleAccess = d % ACCESS_EVERY_DAYS === 0;
    const living = Object.values(world.bands).filter((b) =>
      b.status !== "dispersed" && b.viability?.status !== "extinct" && b.viability?.status !== "absorbed");
    a.maxLivingBands = Math.max(a.maxLivingBands, living.length);
    if (priorBandCount !== null && living.length > priorBandCount) {
      // A new living band appeared: a fission. Record what the parents' parties looked like.
      for (const band of living) {
        const active = (band.expeditions ?? []).filter((e) => mobility.isPhysicallyAwayPhase(e.phase));
        if (active.length > 0) a.fissionsWithActiveParties += 1;
        a.preparedCommitmentsAtFission += mobility.derivePreparedCommitmentPartyPeople(band);
      }
    }
    priorBandCount = living.length;

    for (const band of living) {
      a.bandDays += 1;

      // ── physical presence and conservation ──────────────────────────────────────────────────
      const sources = crowding.getBandPhysicalPresence(band);
      const total = crowding.physicalPresencePeopleTotal(sources);
      const population = band.demography?.population ?? band.size ?? 0;
      const acct = expedition.getBandCommitmentAccounting(band);
      if (!acct.conserved) a.physicalConservationFailures += 1;
      if (!acct.laborBounded) a.laborBoundFailures += 1;
      if (total !== population) a.presenceSumMismatches += 1;
      a.maxPresenceSourcesPerBand = Math.max(a.maxPresenceSourcesPerBand, sources.length);

      // A GHOST body is an away party's people counted at the residence; a body represented
      // NOWHERE is an away party missing from the presence set. Both are structurally impossible
      // after CORRECTION-34, and both are checked rather than assumed.
      const awayPeople = mobility.derivePhysicallyAwayPartyPeople(band);
      const residential = sources.find((s) => s.kind === "residential_remainder")?.people ?? 0;
      const awayRepresented = sources.filter((s) => s.kind === "away_party")
        .reduce((n, s) => n + s.people, 0);
      if (awayPeople > 0 && residential === population) a.ghostBodyBandDays += 1;
      if (awayPeople !== awayRepresented) a.bodiesRepresentedNowhereBandDays += 1;
      a.awayPeopleDays += awayPeople;

      // Residential extraction effort must never claim more adults than the band has at camp.
      if (expedition.getResidentialWorkingAdults(band) < 0) a.catchmentEffortNegativeBandDays += 1;

      // ── expedition phases and target work ───────────────────────────────────────────────────
      const parties = band.expeditions ?? [];
      a.maxActivePartiesPerBand = Math.max(a.maxActivePartiesPerBand,
        parties.filter((e) => mobility.isPhysicallyAwayPhase(e.phase)).length);
      for (const e of parties) {
        if (e.phase === "prepared") a.preparedPartyDays += 1;
        if (e.phase === "outbound") a.outboundPartyDays += 1;
        if (e.phase === "operating") a.operatingPartyDays += 1;
        if (e.phase === "returning") a.returningPartyDays += 1;
        if (mobility.isPhysicallyAwayPhase(e.phase)) {
          a.activePartyDays += 1;
          a.awayWorkerDays += mobility.getExpeditionProductiveWorkers(e);
          a.nonWorkingAwayPersonDays += Math.max(0, e.nonWorkingPartyPeople ?? 0);
        }
        if (e.taskCamp !== undefined) a.taskCampDays += 1;

        // The exact argument the target-work call site would pass on this record's next advance.
        if (e.phase === "operating") {
          const w = mobility.getExpeditionProductiveWorkers(e);
          if (!Number.isFinite(w) || !Number.isInteger(w) || w < 1) a.invalidTargetWorkLaborCalls += 1;
        }

        const record = e.pendingReturnRecord ?? e.pendingKnowledgeRecord;
        if (record !== undefined && (e.workDaysElapsed ?? 0) > 0) {
          const key = `${band.id}|${e.id}|${e.workDaysElapsed}`;
          if (!seenWorkDay.has(key)) {
            seenWorkDay.add(key);
            a.targetWorkDays += 1;
            if ((record.estimatedPeopleCount ?? -1) !== mobility.getExpeditionProductiveWorkers(e)) {
              a.targetWorkLaborMismatches += 1;
            }
            const h = record.physicalFoodHarvest;
            a.targetWorkDepletionSum += h?.depletionApplied ?? 0;
            a.targetWorkSupportSum += h?.usableSupport ?? 0;
            if ((h?.usableSupport ?? 0) > (h?.harvestedAmount ?? 0) + 1e-9) a.supportWithoutSource += 1;
            // A receipt may only exist AFTER the party physically returns. A record still held on
            // a walking party must not already be in the band's seasonal food receipts.
            if (e.phase !== "completed" && (h?.usableSupport ?? 0) > 0) {
              const deposited = (band.recentIntraSeasonTrips ?? [])
                .some((t) => String(t.id ?? "") === String(record.id ?? "@none"));
              if (deposited) a.receiptsBeforeReturn += 1;
            }
          }
        }
      }

      for (const o of band.recentExpeditionOutcomes ?? []) {
        const key = `${band.id}|${o.id}`;
        if (seenReceipt.has(key)) continue;
        seenReceipt.add(key);
      }
      const ringIds = (band.recentExpeditionOutcomes ?? []).map((o) => String(o.id));
      a.duplicateReceipts += ringIds.length - new Set(ringIds).size;

      // ── shared-range social state ───────────────────────────────────────────────────────────
      for (const e of band.encounterRecords ?? []) {
        const k = `${band.id}|${e.id ?? `${e.tick}:${e.otherBandId}:${e.kind}`}`;
        if (!seenEncounter.has(k)) { seenEncounter.add(k); a.encountersObservedNew += 1; }
      }
      for (const e of band.recentRangeFrictionEvents ?? []) {
        const k = `${band.id}|${e.eventId}`;
        if (!seenFriction.has(k)) { seenFriction.add(k); a.frictionRecordsObservedNew += 1; }
      }
      a.maxFrictionRecordsPerBand = Math.max(a.maxFrictionRecordsPerBand, (band.recentRangeFrictionEvents ?? []).length);
      a.maxEncounterRecordsPerBand = Math.max(a.maxEncounterRecordsPerBand, (band.encounterRecords ?? []).length);
      a.maxTripRecordsPerBand = Math.max(a.maxTripRecordsPerBand, (band.recentIntraSeasonTrips ?? []).length);
      a.maxOutcomeRecordsPerBand = Math.max(a.maxOutcomeRecordsPerBand, (band.recentExpeditionOutcomes ?? []).length);

      if (sampleAccess) {
        a.accessSamples += 1;
        const nearby = crowding.getNearbyBandPressure(world, band, band.position);
        const foreign = nearby.weightedCrowding ?? 0;
        if (foreign > 0) {
          a.bandSeasonsWithForeignCrowding += 1;
          a.foreignCrowdingSum += foreign;
          a.maxForeignCrowding = Math.max(a.maxForeignCrowding, foreign);
        }
        a.maxCrowdingContributorsOnOneTile = Math.max(a.maxCrowdingContributorsOnOneTile,
          (nearby.pressureBandIds ?? []).length);

        const access = accessNorms.advanceProtoAccessMemory(world, band);
        const places = Object.values(access.places ?? {});
        a.maxAccessPlacesPerBand = Math.max(a.maxAccessPlacesPerBand, places.length);
        for (const p of places) {
          const phase = p.socialEvidencePhase;
          if (phase === "active") a.activeAccessExpectations += 1;
          else if (phase === "cooling") a.coolingAccessExpectations += 1;
          else if (phase === "released_historical") {
            a.releasedAccessExpectations += 1;
            // INSTRUMENT CORRECTION (recorded, not hidden). The first version of this check
            // flagged any `activeEvidenceWeight > 0` on a released place and fired ONCE in a
            // 200-year run. It was wrong, and production was right: `activeEvidenceWeight` is the
            // max weight over ALL surviving records including sub-threshold ones, while
            // `released_historical` means every record sits BELOW
            // SOCIAL_EVIDENCE_ACTIVE_MIN_WEIGHT (accessNorms.ts:57 = 0.05). A released place whose
            // strongest record still reads 0.03 is exactly what release looks like — a record that
            // is retained and no longer counts.
            //
            // The real question is whether anything RELEASED still counts, so the predicate is now
            // the threshold and the active count, and a behavioural spot-check is run on top.
            if ((p.activeEvidenceCount ?? 0) > 0) a.releasedRecordsActingAsCurrentState += 1;
            if ((p.activeEvidenceWeight ?? 0) >= SOCIAL_EVIDENCE_ACTIVE_MIN_WEIGHT) {
              a.releasedRecordsActingAsCurrentState += 1;
            }
            a.releasedPlacesBehaviourallyChecked += 1;
            // Behavioural confirmation on the released place itself: strip the observer's friction
            // ring and re-derive. A released place must move by nothing.
            const strippedBand = { ...band, recentRangeFrictionEvents: undefined };
            const strippedWorld = { ...world, bands: { ...world.bands, [band.id]: strippedBand } };
            const without = accessNorms.advanceProtoAccessMemory(strippedWorld, strippedBand).places?.[p.tileId];
            const delta =
              Math.abs((p.strangerCaution ?? 0) - (without?.strangerCaution ?? 0)) +
              Math.abs((p.sharedUsePressure ?? 0) - (without?.sharedUsePressure ?? 0)) +
              Math.abs((p.rememberedRefusalAvoidance ?? 0) - (without?.rememberedRefusalAvoidance ?? 0));
            if (delta > 1e-9) {
              a.releasedPlacesStillMovingBehaviour += 1;
              a.releasedRecordsActingAsCurrentState += 1;
            }
          }
          a.retainedButInertRecords += p.historicalEvidenceCount ?? 0;
        }
      }
    }
  }

  const finalLiving = Object.values(world.bands).filter((b) =>
    b.status !== "dispersed" && b.viability?.status !== "extinct" && b.viability?.status !== "absorbed");
  a.livingBandsAtEnd = finalLiving.length;
  a.encounterRecordsAtEnd = finalLiving.reduce((n, b) => n + (b.encounterRecords ?? []).length, 0);
  a.frictionRecordsAtEnd = finalLiving.reduce((n, b) => n + (b.recentRangeFrictionEvents ?? []).length, 0);
  a.contactMemoriesAtEnd = finalLiving.reduce((n, b) => n + Object.keys(b.contactMemories ?? {}).length, 0);
  for (const k of ["foreignCrowdingSum", "maxForeignCrowding", "targetWorkDepletionSum", "targetWorkSupportSum"]) {
    a[k] = Math.round(a[k] * 10000) / 10000;
  }

  const elapsedMs = Date.now() - started;
  const adverse = {
    physicalConservationFailures: a.physicalConservationFailures,
    laborBoundFailures: a.laborBoundFailures,
    presenceSumMismatches: a.presenceSumMismatches,
    ghostBodyBandDays: a.ghostBodyBandDays,
    bodiesRepresentedNowhereBandDays: a.bodiesRepresentedNowhereBandDays,
    targetWorkLaborMismatches: a.targetWorkLaborMismatches,
    invalidTargetWorkLaborCalls: a.invalidTargetWorkLaborCalls,
    catchmentEffortNegativeBandDays: a.catchmentEffortNegativeBandDays,
    receiptsBeforeReturn: a.receiptsBeforeReturn,
    duplicateReceipts: a.duplicateReceipts,
    supportWithoutSource: a.supportWithoutSource,
    releasedRecordsActingAsCurrentState: a.releasedRecordsActingAsCurrentState,
    releasedPlacesStillMovingBehaviour: a.releasedPlacesStillMovingBehaviour,
  };

  out = {
    audit: "ROADMAP-ITEM-3-NATURAL-INTEGRATION",
    map: MAP, seed: SEED, years: YEARS, days,
    accessSampledEveryDays: ACCESS_EVERY_DAYS,
    ...a,
    adverse,
    adverseTotal: Object.values(adverse).reduce((s, n) => s + n, 0),
    performance: {
      elapsedMs,
      msPerSimulatedDay: Math.round((elapsedMs / days) * 10000) / 10000,
      machineNote: "wall clock on a shared developer machine; comparable within this file, not across machines",
    },
    sameDayPresence: {
      observations: a.sameDayPresenceObservations,
      reason: "0 BY DESIGN — same-day party CURRENT presence is formally deferred (CORRECTION-34A scope amendment). No within-day consumer of physical presence exists, so there is nothing to observe and nothing was invented to observe it.",
    },
    nullObservationWarning: "every zero above is a NULL OBSERVATION, not a proof. The controlled I1-I16 fixtures are the proof; this run measures how often the integrated machinery runs and whether anything unexpected appears when it does.",
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
} finally {
  await server.close();
}

console.log(JSON.stringify({
  map: out.map, years: out.years, bandDays: out.bandDays, livingBandsAtEnd: out.livingBandsAtEnd,
  encountersNew: out.encountersObservedNew, frictionNew: out.frictionRecordsObservedNew,
  contactMemoriesAtEnd: out.contactMemoriesAtEnd,
  foreignCrowdingBandSeasons: out.bandSeasonsWithForeignCrowding,
  accessActive: out.activeAccessExpectations, accessCooling: out.coolingAccessExpectations,
  accessReleased: out.releasedAccessExpectations,
  activePartyDays: out.activePartyDays, taskCampDays: out.taskCampDays,
  targetWorkDays: out.targetWorkDays, nonWorkingAwayPersonDays: out.nonWorkingAwayPersonDays,
  awayPeopleDays: out.awayPeopleDays, awayWorkerDays: out.awayWorkerDays,
  adverse: out.adverse, adverseTotal: out.adverseTotal,
  caps: { presenceSources: out.maxPresenceSourcesPerBand, trips: out.maxTripRecordsPerBand,
    outcomes: out.maxOutcomeRecordsPerBand, friction: out.maxFrictionRecordsPerBand,
    encounters: out.maxEncounterRecordsPerBand, parties: out.maxActivePartiesPerBand,
    accessPlaces: out.maxAccessPlacesPerBand },
  performance: out.performance,
}, null, 2));
