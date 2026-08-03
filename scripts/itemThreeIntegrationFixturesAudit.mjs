// ROADMAP ITEM 3 — FINAL INTEGRATION FIXTURES I1-I16.
//
// The individual Shared Range corrections are accepted. This audit asks a DIFFERENT question:
// do their authorities connect as ONE causal system, without duplicate pressure, hidden global
// knowledge, ghost or teleported bodies, residential labour acting at a distance, released
// history acting as current state, or support appearing before a return?
//
// AUDIT-ONLY. It imports production functions and reads what they return; it changes nothing.
//
// The load-bearing instrument for social contribution is CORRECTION-31's with-minus-without
// counterfactual: derive access twice on the SAME world, once as production does and once with
// the observer's friction ring stripped, and subtract. Reading raw scalars does not work — they
// also carry the band's own use pressure, and a released place drops out of the bounded memory
// entirely, so "absent" and "released" become indistinguishable. Subtraction is immune to both
// and is simultaneously the positive control.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/shared-range-item-3-final-freeze";
const OUT = arg("out", `${EVIDENCE}/integrated-controlled-fixtures.json`);
const SEED = arg("seed", "item3:integration");
const SEASON_DAYS = 90;
const RICH = { x: 195, y: 90 };

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-item3-fx-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const spawn = await server.ssrLoadModule("/sim/agents/spawn.ts");
  const crowding = await server.ssrLoadModule("/sim/agents/crowding.ts");
  const accessNorms = await server.ssrLoadModule("/sim/agents/accessNorms.ts");
  const socialContext = await server.ssrLoadModule("/sim/agents/socialContext.ts");
  const sharedCatchment = await server.ssrLoadModule("/sim/agents/sharedCatchment.ts");
  const expedition = await server.ssrLoadModule("/sim/agents/expedition.ts");
  const mobility = await server.ssrLoadModule("/sim/agents/bandMobility.ts");
  const trips = await server.ssrLoadModule("/sim/agents/intraSeasonTrips.ts");
  const contextCache = await server.ssrLoadModule("/sim/agents/contextCache.ts");

  const MIN = expedition.EXPEDITION_MIN_PARTY_WORKERS;
  const base = runner.initSimWorld({ kind: "map2" }, SEED);
  const byXY = new Map(Object.values(base.tiles).map((t) => [`${t.coord.x}:${t.coord.y}`, t]));
  const tileAt = (dx, dy = 0) => byXY.get(`${RICH.x + dx}:${RICH.y + dy}`)?.id;
  const round4 = (v) => (typeof v === "number" ? Math.round(v * 10000) / 10000 : v);

  const build = (sites) => {
    let w = spawn.removeInitialBands(base, Object.keys(base.bands));
    w = spawn.spawnCustomBands(w, sites.map((s, i) => ({
      tileId: s.tileId, population: s.population ?? 30, name: s.name ?? `B${i}`,
    })), SEED);
    const ids = Object.values(w.bands).map((b) => String(b.id)).sort();
    if (ids.length !== sites.length) {
      throw new Error(`spawnCustomBands produced ${ids.length} bands for ${sites.length} sites — the fixture refuses to run on a world it did not get (an unreachable or aquatic tile is the usual cause)`);
    }
    return { world: w, ids };
  };
  const step = (w, seasons) => {
    let x = w;
    for (let i = 0; i < seasons; i += 1) x = advance.advanceWorldByDays(x, SEASON_DAYS);
    return x;
  };
  const moveBand = (w, id, tileId) => ({ ...w, bands: { ...w.bands, [id]: { ...w.bands[id], position: tileId } } });
  const dist = (w, a, b) => {
    const ta = w.tiles[a]; const tb = w.tiles[b];
    return ta === undefined || tb === undefined ? null
      : Math.abs(ta.coord.x - tb.coord.x) + Math.abs(ta.coord.y - tb.coord.y);
  };

  // The CORRECTION-31 counterfactual, reused as the ONE social-contribution instrument.
  const frictionContribution = (w, observerId, tileId) => {
    const observer = w.bands[observerId];
    if (observer === undefined) return null;
    const stripped = { ...w, bands: { ...w.bands, [observerId]: { ...observer, recentRangeFrictionEvents: undefined } } };
    const withRing = accessNorms.advanceProtoAccessMemory(w, observer);
    const withoutRing = accessNorms.advanceProtoAccessMemory(stripped, stripped.bands[observerId]);
    const a = withRing.places?.[tileId];
    const b = withoutRing.places?.[tileId];
    const g = (o, k) => (o === undefined ? 0 : (o[k] ?? 0));
    return {
      strangerCaution: round4(g(a, "strangerCaution") - g(b, "strangerCaution")),
      sharedUsePressure: round4(g(a, "sharedUsePressure") - g(b, "sharedUsePressure")),
      rememberedRefusalAvoidance: round4(g(a, "rememberedRefusalAvoidance") - g(b, "rememberedRefusalAvoidance")),
      total: round4(
        Math.abs(g(a, "strangerCaution") - g(b, "strangerCaution")) +
        Math.abs(g(a, "sharedUsePressure") - g(b, "sharedUsePressure")) +
        Math.abs(g(a, "rememberedRefusalAvoidance") - g(b, "rememberedRefusalAvoidance"))),
      activeEvidenceWeight: a?.activeEvidenceWeight ?? null,
      activeEvidenceCount: a?.activeEvidenceCount ?? null,
      historicalEvidenceCount: a?.historicalEvidenceCount ?? null,
      socialEvidencePhase: a?.socialEvidencePhase ?? null,
      placeTracked: a !== undefined,
    };
  };

  const physical = (w, bandId, tileId) => {
    const band = w.bands[bandId];
    const tile = w.tiles[tileId ?? band.position];
    const nearby = crowding.getNearbyBandPressure(w, band, tile.id);
    return {
      weightedCrowding: round4(nearby.weightedCrowding),
      nearbyBandCount: nearby.pressureBandIds?.length ?? 0,
      contributors: [...(nearby.pressureBandIds ?? [])].map(String).sort(),
      crowdingPenalty: round4(crowding.getCrowdingPenalty(tile, nearby)),
    };
  };

  const presenceOf = (band) => {
    const sources = crowding.getBandPhysicalPresence(band);
    return {
      sources: sources.map((s) => ({ tile: String(s.tileId), people: s.people, kind: s.kind })),
      total: crowding.physicalPresencePeopleTotal(sources),
      population: band.demography?.population ?? band.size ?? 0,
    };
  };

  const fixtures = {};
  const add = (id, verdict, detail) => {
    if (detail.notConstructed === true) { fixtures[id] = { verdict, vacuous: false, ...detail }; return; }
    const vacuous = detail.nonVacuousPredicate !== true;
    fixtures[id] = { verdict: vacuous ? `VACUOUS:${verdict}` : verdict, vacuous, ...detail };
  };

  // ═══ I1 — two bands, no overlap ═════════════════════════════════════════════════════════════
  {
    // map2 spans x 0..219, y 0..139, and RICH.x + 10 is open water, so the far site goes -x/+y.
    const far = byXY.get(`${RICH.x - 40}:${RICH.y + 20}`)?.id;
    const { world: w0, ids } = build([{ tileId: tileAt(0) }, { tileId: far }]);
    const w = step(w0, 12);
    const [a, b] = ids;
    const pa = physical(w, a);
    const pb = physical(w, b);
    const contribA = frictionContribution(w, a, w.bands[a].position);
    const encounters = (w.bands[a].encounterRecords ?? []).length + (w.bands[b].encounterRecords ?? []).length;
    const friction = (w.bands[a].recentRangeFrictionEvents ?? []).length + (w.bands[b].recentRangeFrictionEvents ?? []).length;
    const contacts = Object.keys(w.bands[a].contactMemories ?? {}).length;
    const separation = dist(w, w.bands[a].position, w.bands[b].position);
    // The catchment index is memoized on a tick cache and keyed by BAND id, not by tile.
    const cacheI1 = contextCache.buildTickContextCache(w);
    const overlap = [...(sharedCatchment.getOverlappingBandIds(
      sharedCatchment.getSharedCatchmentIndex(w, cacheI1), a) ?? [])].map(String);
    add("I1_two_bands_no_overlap",
      encounters === 0 && friction === 0 && contacts === 0 && pa.nearbyBandCount === 0 && pb.nearbyBandCount === 0 &&
      contribA.total === 0
        ? "NO_ENCOUNTER_NO_FRICTION_NO_EXPECTATION_NO_CROWDING" : "UNEXPECTED",
      { separationTiles: separation, encounters, frictionRecords: friction, contactMemories: contacts,
        crowdingA: pa, crowdingB: pb, socialContributionA: contribA, catchmentOverlapAtA: overlap,
        nonVacuousPredicate: separation !== null && separation > 8 && Object.keys(w.bands).length === 2,
        nonVacuous: { predicate: "exactly two living bands genuinely far apart, so the all-zero result is a real separation and not an empty world",
          bands: Object.keys(w.bands).length, separationTiles: separation } });
  }

  // ═══ I2 — physical overlap without social evidence ══════════════════════════════════════════
  {
    const { world: w0, ids } = build([{ tileId: tileAt(0) }, { tileId: tileAt(2) }]);
    const w = step(w0, 8);
    const [a, b] = ids;
    const pa = physical(w, a);
    const contribA = frictionContribution(w, a, w.bands[a].position);
    // The hidden-census control: add remote records and re-read the SAME observer.
    const remoteIds = [];
    let withRemote = w;
    for (let k = 0; k < 6; k += 1) {
      const t = byXY.get(`${RICH.x - 45 + k * 2}:${RICH.y + 26}`)?.id;
      if (t === undefined) continue;
      const id = `ghost:${k}`;
      remoteIds.push(id);
      withRemote = { ...withRemote, bands: { ...withRemote.bands,
        [id]: { ...w.bands[b], id, name: `ghost${k}`, position: t,
          contactMemories: {}, encounterRecords: [], recentRangeFrictionEvents: [], expeditions: [] } } };
    }
    const paRemote = physical(withRemote, a);
    const contribRemote = frictionContribution(withRemote, a, withRemote.bands[a].position);
    const accessA = accessNorms.advanceProtoAccessMemory(w, w.bands[a]).places?.[w.bands[a].position];
    const accessRemote = accessNorms.advanceProtoAccessMemory(withRemote, withRemote.bands[a]).places?.[withRemote.bands[a].position];
    const censusInvariant = JSON.stringify(paRemote) === JSON.stringify(pa) &&
      round4(accessA?.strangerCaution ?? 0) === round4(accessRemote?.strangerCaution ?? 0) &&
      round4(accessA?.sharedUsePressure ?? 0) === round4(accessRemote?.sharedUsePressure ?? 0);
    add("I2_overlap_without_social_evidence",
      pa.nearbyBandCount > 0 && contribA.total === 0 && censusInvariant
        ? "PHYSICAL_CROWDING_WITHOUT_INVENTED_SOCIAL_RISK_AND_NO_GLOBAL_CENSUS" : "UNEXPECTED",
      { crowdingAtA: pa, socialContributionA: contribA,
        remoteRecordsAdded: remoteIds.length, crowdingWithRemoteRecords: paRemote,
        socialContributionWithRemoteRecords: contribRemote,
        strangerCaution: { before: round4(accessA?.strangerCaution ?? 0), withRemote: round4(accessRemote?.strangerCaution ?? 0) },
        censusInvariant,
        nonVacuousPredicate: pa.weightedCrowding > 0 && remoteIds.length >= 6,
        nonVacuous: { predicate: "real physical crowding exists (non-zero) AND six remote records were genuinely added, so both halves are measured",
          weightedCrowding: pa.weightedCrowding, remoteRecords: remoteIds.length } });
  }

  // ═══ I3/I4/I5/I6/I11/I16 — the social lifecycle on one adjacent pair ════════════════════════
  // One construction carries six questions because they are STAGES OF THE SAME CHAIN; splitting
  // them into six worlds would let each stage be proven on a different history.
  //
  // TWO INSTRUMENT DECISIONS, both forced by measurement and both stated:
  //
  // 1. The measurement place is the tile the observer's OWN friction records name, not wherever
  //    the observer happens to stand. A first version measured at the position captured when the
  //    pair was warmed; the observer then wandered, that place dropped out of its bounded access
  //    memory, and the contribution read 0 from season 1 — release "proven" on a pair that had
  //    never been active. That was an instrument artefact, not a finding.
  // 2. The observer is RE-PINNED to that tile after every step, so the only things changing are
  //    the other band's distance and the evidence's age. Without pinning, a band that walks away
  //    from its own remembered place produces exactly the same reading as one whose belief has
  //    been released, and the two are not the same claim.
  {
    const { world: w0, ids } = build([{ tileId: tileAt(0) }, { tileId: tileAt(1) }]);
    const [obs, other] = ids;
    let w = step(w0, 16);                                   // warm together -> co-presence

    const ring = w.bands[obs].recentRangeFrictionEvents ?? [];
    const tally = new Map();
    for (const e of ring) {
      if (e.tileId === undefined) continue;
      tally.set(String(e.tileId), (tally.get(String(e.tileId)) ?? 0) + 1);
    }
    const place = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
    if (place === undefined) {
      throw new Error("the warmed pair produced no friction record carrying a tile — the fixture refuses to measure release on a place no evidence names");
    }
    const pin = (world) => moveBand(world, obs, place);
    w = pin(w);

    const activeContribution = frictionContribution(w, obs, place);
    const encounterRecords = (w.bands[obs].encounterRecords ?? []).length;
    const contactCount = Object.values(w.bands[obs].contactMemories ?? {})[0]?.contactCount ?? 0;
    const frictionRecords = w.bands[obs].recentRangeFrictionEvents ?? [];
    // I3 — episode identity. Every record must name a real band, and no episode may appear twice.
    const episodeKeys = frictionRecords.map((e) => `${e.otherBandId}|${e.tileId}|${e.interpretation}|${e.tick}`);
    const duplicateEpisodes = episodeKeys.length - new Set(episodeKeys).size;
    const duplicateEventIds = frictionRecords.length - new Set(frictionRecords.map((e) => String(e.eventId))).size;
    const allNameAKnownBand = frictionRecords.every((e) => w.bands[String(e.otherBandId)] !== undefined);
    const recordIdsBefore = new Set(frictionRecords.map((e) => String(e.eventId)));

    // I4 — attributable, not omniscient: delete the other band from the world and re-derive.
    const withoutOther = { ...w, bands: Object.fromEntries(Object.entries(w.bands).filter(([k]) => k !== other)) };
    const contribWithoutOther = frictionContribution(withoutOther, obs, place);

    // I5 — one social path, and zero evidence means zero social pressure.
    const tile = w.tiles[place];
    const nearby = crowding.getNearbyBandPressure(w, w.bands[obs], place);
    const penalty = crowding.getCrowdingPenalty(tile, nearby);
    const zeroEvidenceBand = { ...w.bands[obs], recentRangeFrictionEvents: [], contactMemories: {}, encounterRecords: [] };
    const zeroEvidenceWorld = { ...w, bands: { ...w.bands, [obs]: zeroEvidenceBand } };
    const zeroEvidenceAccess = accessNorms.advanceProtoAccessMemory(zeroEvidenceWorld, zeroEvidenceBand).places?.[place];
    const zeroEvidenceContribution = frictionContribution(zeroEvidenceWorld, obs, place);

    // I6/I11 — release. The other band leaves; the observer stays at the remembered place.
    let released = pin(moveBand(w, other, byXY.get(`${RICH.x - 44}:${RICH.y + 24}`)?.id));
    const timeline = [];
    let releaseSeason = null;
    for (let s = 1; s <= 24; s += 1) {
      released = pin(step(released, 1));
      const c = frictionContribution(released, obs, place);
      const p = physical(released, obs, place);
      timeline.push({ season: s, socialTotal: c.total, activeEvidenceWeight: c.activeEvidenceWeight,
        activeCount: c.activeEvidenceCount, historicalCount: c.historicalEvidenceCount,
        phase: c.socialEvidencePhase, weightedCrowding: p.weightedCrowding,
        retainedRecords: (released.bands[obs].recentRangeFrictionEvents ?? []).length });
      if (releaseSeason === null && c.total === 0) releaseSeason = s;
    }
    const finalRecords = (released.bands[obs].recentRangeFrictionEvents ?? []).length;
    const finalContacts = Object.keys(released.bands[obs].contactMemories ?? {}).length;
    const finalEncounters = (released.bands[obs].encounterRecords ?? []).length;
    const finalContribution = frictionContribution(released, obs, place);
    const physicalReleaseSeason = timeline.find((r) => r.weightedCrowding === 0)?.season ?? null;

    add("I3_encounter_to_friction",
      encounterRecords > 0 && frictionRecords.length > 0 && duplicateEpisodes === 0 &&
      duplicateEventIds === 0 && allNameAKnownBand
        ? "CO_PRESENCE_PRODUCES_ATTRIBUTABLE_FRICTION_WITH_NO_DUPLICATE_EPISODE" : "UNEXPECTED",
      { measuredPlace: place, encounterRecords, contactCount, frictionRecords: frictionRecords.length,
        duplicateEpisodeKeys: duplicateEpisodes, duplicateEventIds,
        everyRecordNamesAKnownBand: allNameAKnownBand,
        interpretations: [...new Set(frictionRecords.map((e) => String(e.interpretation)))].sort(),
        nonVacuousPredicate: encounterRecords > 0 && frictionRecords.length > 0,
        nonVacuous: { predicate: "real encounters AND real friction records exist, so 'no duplicate episode' is measured over a non-empty set",
          encounters: encounterRecords, friction: frictionRecords.length } });

    add("I4_friction_to_access_expectation",
      activeContribution.total > 0 && contribWithoutOther.total === activeContribution.total
        ? "EXPECTATION_DERIVES_FROM_HELD_EVIDENCE_NOT_FROM_CURRENT_WORLD_TRUTH" : "UNEXPECTED",
      { measuredPlace: place, withOtherBandPresent: activeContribution,
        withOtherBandDeletedFromTheWorld: contribWithoutOther,
        nonVacuousPredicate: activeContribution.total > 0,
        nonVacuous: { predicate: "the friction ring genuinely contributes something at this place, so the invariance is a real comparison",
          contribution: activeContribution.total },
        note: "deleting the other band from the world entirely leaves the expectation unchanged: it is read off the observer's own held records, not off a live census" });

    add("I5_single_social_pressure_path",
      zeroEvidenceContribution.total === 0 && activeContribution.total > 0
        ? "ZERO_EVIDENCE_ZERO_SOCIAL_PRESSURE_AND_ONE_BOUNDED_CROWDING_COST" : "UNEXPECTED",
      { measuredPlace: place, withEvidence: activeContribution, withEvidenceStripped: zeroEvidenceContribution,
        zeroEvidenceStrangerCaution: round4(zeroEvidenceAccess?.strangerCaution ?? 0),
        physicalCrowdingPenalty: round4(penalty),
        crowdingDecisionAuthority: "CORRECTION-32 — weightedCrowding is evidence, crowdingPenalty is the ONE decision-facing cost at CROWDING_DECISION_COST_WEIGHT. The >=3-separately-named-charges bound (0) and the max-2-path bound are asserted by the CORRECTION-32 suite, rerun unchanged in this freeze.",
        nonVacuousPredicate: activeContribution.total > 0,
        nonVacuous: { predicate: "the social channel is non-zero on this pair, so 'stripping evidence gives zero' is a measured drop and not a pair with nothing to lose",
          socialContribution: activeContribution.total, crowdingPenalty: round4(penalty) } });

    add("I6_release_lifecycle",
      releaseSeason !== null && finalContribution.total === 0 && finalRecords > 0 && activeContribution.total > 0
        ? "ACTIVE_THEN_COOLING_THEN_RELEASED_WITH_RECORDS_RETAINED" : "UNEXPECTED",
      { measuredPlace: place, observerPinnedAtThePlace: true,
        physicalReleaseSeason, socialReleaseSeason: releaseSeason,
        startingContribution: activeContribution.total,
        retainedFrictionRecordsAfterRelease: finalRecords,
        retainedContactMemories: finalContacts, retainedEncounterRecords: finalEncounters,
        finalContribution, timeline,
        nonVacuousPredicate: activeContribution.total > 0 && releaseSeason !== null && finalRecords > 0,
        nonVacuous: { predicate: "the pair started with real active contribution, it genuinely reached zero, and the records genuinely survived — release is behavioural, not deletion",
          startingContribution: activeContribution.total, releaseSeason, retainedRecords: finalRecords } });

    add("I11_history_remains_while_state_is_inactive",
      finalRecords > 0 && finalContribution.total === 0 && activeContribution.total > 0
        ? "HISTORY_PRESERVED_CURRENT_STATE_INACTIVE" : "UNEXPECTED",
      { retainedFrictionRecords: finalRecords, retainedContactMemories: finalContacts,
        retainedEncounterRecords: finalEncounters,
        contributionWhenActive: activeContribution.total,
        contributionNow: finalContribution.total,
        socialEvidencePhase: finalContribution.socialEvidencePhase,
        nonVacuousPredicate: finalRecords > 0 && activeContribution.total > 0,
        nonVacuous: { predicate: "records that once DID move behaviour are still held and now move nothing",
          recordsHeld: finalRecords, contributionThen: activeContribution.total,
          contributionNow: finalContribution.total } });

    // ═══ I16 — reencounter after release ══════════════════════════════════════════════════════
    // The friction ring is capped at 8, so COUNTING records cannot detect a fresh episode on a
    // saturated ring — a new record silently replaces an old one. Episode IDENTITY is compared
    // instead. A first version of this fixture compared counts and would have reported
    // "reactivated without new evidence" purely because 8 stayed 8.
    let reenc = pin(moveBand(released, other, place));
    const reencTimeline = [];
    let reactivationSeason = null;
    let newEventIdsAtReactivation = null;
    for (let s = 1; s <= 16; s += 1) {
      reenc = pin(step(reenc, 1));
      const c = frictionContribution(reenc, obs, place);
      const p = physical(reenc, obs, place);
      const idsNow = (reenc.bands[obs].recentRangeFrictionEvents ?? []).map((e) => String(e.eventId));
      const fresh = idsNow.filter((id) => !recordIdsBefore.has(id));
      reencTimeline.push({ season: s, socialTotal: c.total, weightedCrowding: p.weightedCrowding,
        records: idsNow.length, newEventIds: fresh.length, phase: c.socialEvidencePhase });
      if (reactivationSeason === null && c.total > 0) {
        reactivationSeason = s;
        newEventIdsAtReactivation = fresh.length;
      }
    }
    const physicalReturned = reencTimeline.some((r) => r.weightedCrowding > 0);
    add("I16_release_then_reencounter",
      reactivationSeason === null
        ? "NOT_CONSTRUCTED_FUTURE_REACTIVATION_AUTHORITY_ABSENT"
        : (newEventIdsAtReactivation ?? 0) > 0
          ? "REACTIVATION_ONLY_THROUGH_FRESH_EVIDENCE"
          : "REACTIVATED_WITHOUT_NEW_EVIDENCE",
      { measuredPlace: place, reactivationSeason,
        newEventIdsAtReactivation, physicalCrowdingReturned: physicalReturned,
        recordsBeforeReencounter: finalRecords,
        recordsAfterReencounter: (reenc.bands[obs].recentRangeFrictionEvents ?? []).length,
        totalNewEventIdsByEnd: (reenc.bands[obs].recentRangeFrictionEvents ?? [])
          .filter((e) => !recordIdsBefore.has(String(e.eventId))).length,
        timeline: reencTimeline,
        notConstructed: reactivationSeason === null,
        futureAuthorityAbsentReason: reactivationSeason === null
          ? "CORRECTION-31 made release a WEIGHTING of evidence age rather than a stored state, so there is no reactivation authority to exercise: a returned band can only be noticed through a NEW episode. None was written in this window and nothing was faked to produce one."
          : undefined,
        nonVacuousPredicate: physicalReturned && activeContribution.total > 0,
        nonVacuous: { predicate: "the other band genuinely came back into physical range at a place that once carried active evidence, so the social answer is about reactivation and not about absence",
          physicalCrowdingReturned: physicalReturned, priorActiveContribution: activeContribution.total } });
  }

  // ═══ Target site shared by the expedition fixtures ══════════════════════════════════════════
  let expWorld = runner.initSimWorld({ kind: "map2" }, "c34e:targetwork");
  expWorld = advance.advanceWorldByDays(expWorld, 360 * 2);
  const expDay = Number(expWorld.time.day);
  const expTick = Number(expWorld.time.tick);
  const FOOD = ["generic_plant_food", "animal_food", "aquatic_food", "fallback_food"];
  const mkParty = (id, workers, nonWorking, t, route, over = {}) => ({
    id, phase: "operating", partyWorkers: workers,
    ...(nonWorking > 0 ? { nonWorkingPartyPeople: nonWorking } : {}),
    partyComposition: { limited: 0, typical: workers, high: 0 },
    positionTileId: t, routeTileIds: route, routeIndex: 1, targetTileId: t,
    taskKind: "distant_plant_gathering", injuryLoad: 0,
    travelDaysElapsed: 1, workDaysElapsed: 0, hardDeadlineDay: 9999,
    cargo: { harvestUnits: 0, carryCapacityUnits: 1, provisionUnitsConsumed: 0, lostUnits: 0 },
    ...over,
  });
  const mkExpBand = (b, workingAdults, exps, population) => ({
    ...b,
    demography: { ...b.demography, population: population ?? workingAdults + 20, workingAdults, elders: 10, dependents: 10 },
    expeditions: exps,
  });

  let site;
  outer:
  for (const b of Object.values(expWorld.bands).sort((x, y) => String(x.id).localeCompare(String(y.id)))) {
    if (b.status === "dispersed" || b.viability?.status === "extinct") continue;
    for (const m of (b.resourceKnowledgeState?.patchMemories ?? [])
      .filter((x) => FOOD.includes(x.resourceClassId) && expWorld.tiles[x.approximateTile] !== undefined)
      .sort((x, y) => String(x.patchId).localeCompare(String(y.patchId)))) {
      const t = m.approximateTile;
      const r0 = [b.position, t];
      const d = dist(expWorld, b.position, t);
      const probe = trips.resolveExpeditionTargetWork(
        expWorld, mkExpBand(b, 25, [mkParty("e:probe", 5, 0, t, r0)]), m, t, d, r0, expDay,
        "food_resource_check", { partyWorkers: 5 });
      const h = probe.record.physicalFoodHarvest;
      if (h?.physicalSourceFound === true && (h.physicalAvailability ?? 0) > 0) {
        site = { band: b, memory: m, t, route: r0, d, sourceId: h.sourceId };
        break outer;
      }
    }
  }
  if (site === undefined) throw new Error("no harvestable target found — the integration fixtures refuse to fabricate one");

  const work = (band, workers, opts = {}) => {
    const res = trips.resolveExpeditionTargetWork(
      expWorld, band, site.memory, site.t, site.d, site.route, expDay, "food_resource_check",
      { partyWorkers: workers, ...opts });
    const r = res.record; const h = r.physicalFoodHarvest;
    return { world: res.world, estimatedPeopleCount: r.estimatedPeopleCount,
      activityOutcome: r.activityOutcome, harvestedAmount: h?.harvestedAmount ?? 0,
      depletionApplied: h?.depletionApplied ?? 0, transportLoss: h?.transportLoss ?? 0,
      processingLoss: h?.processingLoss ?? 0, usableSupport: h?.usableSupport ?? 0,
      physicalAvailability: h?.physicalAvailability ?? 0,
      requestCappedByAvailability: Math.abs((h?.harvestedAmount ?? 0) - (h?.physicalAvailability ?? 0)) < 1e-9 };
  };
  const patchDepletion = (w) => {
    const e = w.plantPatchState?.[site.sourceId];
    return e === undefined ? null : round4(e.depletion);
  };

  // ═══ I7 — task camp inside another band's range ═════════════════════════════════════════════
  {
    const { world: w0, ids } = build([{ tileId: tileAt(0) }, { tileId: tileAt(-30, 30) }]);
    const w = step(w0, 8);
    const [parent, host] = ids;
    // The parent sends a party that stands INSIDE the host's neighbourhood.
    const campTile = w.bands[host].position;
    const party = mkParty("e:camp", 4, 0, campTile, [w.bands[parent].position, campTile]);
    const withParty = { ...w, bands: { ...w.bands, [parent]: { ...w.bands[parent], expeditions: [party] } } };
    const p = presenceOf(withParty.bands[parent]);
    const atHome = p.sources.find((s) => s.kind === "residential_remainder");
    const away = p.sources.find((s) => s.kind === "away_party");
    const accounting = expedition.getBandCommitmentAccounting(withParty.bands[parent]);
    // Does the host see a body where the party stands? The host reads foreign crowding at its
    // own tile; the party is a presence source of the parent band.
    const hostCrowdBefore = physical(w, host, campTile);
    const hostCrowdAfter = physical(withParty, host, campTile);
    const socialBefore = frictionContribution(w, host, campTile);
    const socialAfter = frictionContribution(withParty, host, campTile);
    add("I7_task_camp_inside_another_range",
      away !== undefined && away.tile === String(campTile) && away.people === 4 &&
      atHome.people === p.population - 4 && p.total === p.population && accounting.conserved &&
      socialAfter.total === socialBefore.total
        ? "PARTY_STANDS_WHERE_IT_IS_PARENT_NOT_GHOSTED_NO_INVENTED_SOCIAL_CONSEQUENCE" : "UNEXPECTED",
      { presence: p, accounting: { conserved: accounting.conserved, laborBounded: accounting.laborBounded,
          physicallyAwayPeople: accounting.physicallyAwayPeople, population: accounting.population },
        hostForeignCrowdingBefore: hostCrowdBefore, hostForeignCrowdingAfter: hostCrowdAfter,
        hostSocialContributionBefore: socialBefore, hostSocialContributionAfter: socialAfter,
        nonVacuousPredicate: p.population > 4 && away !== undefined && p.sources.length === 2,
        nonVacuous: { predicate: "the party is genuinely away from a genuinely larger band, so 'not ghosted at home' and 'not counted nowhere' are both real claims",
          population: p.population, awayPeople: away?.people, sources: p.sources.length },
        statedLimit: "the host's foreign-crowding reading is taken through the canonical reader; whether an away party SHOULD raise a host's crowding is the shared-use substrate seam AUDIT-27 left open and Item 3 did not close. What is proven here is that the body is at its own tile, the parent is not ghosted, nobody is counted nowhere, and NO social consequence is invented automatically." });
  }

  // ═══ I8 — two concurrent parties ════════════════════════════════════════════════════════════
  {
    const pA = mkParty("e:a", 2, 0, site.t, site.route);
    const pB = mkParty("e:b", 6, 0, site.t, site.route);
    const band = mkExpBand(site.band, 25, [pA, pB], 60);
    const p = presenceOf(band);
    const acct = expedition.getBandCommitmentAccounting(band);
    const rA = work(band, mobility.getExpeditionProductiveWorkers(pA));
    const rB = work(band, mobility.getExpeditionProductiveWorkers(pB));
    const residentialAdults = expedition.getResidentialWorkingAdults(band);
    add("I8_concurrent_parties",
      p.total === p.population && acct.conserved && acct.laborBounded &&
      rA.estimatedPeopleCount === 2 && rB.estimatedPeopleCount === 6 &&
      residentialAdults === 25 - 8
        ? "POPULATION_CONSERVED_HEADCOUNTS_AND_LABOR_INDEPENDENT" : "UNEXPECTED",
      { presence: p, committedAwayWorkers: acct.committedAwayWorkers,
        physicallyAwayPeople: acct.physicallyAwayPeople,
        residentialWorkingAdultsAfterCommitment: residentialAdults,
        partyA: { workers: 2, recordPeople: rA.estimatedPeopleCount, depletion: rA.depletionApplied },
        partyB: { workers: 6, recordPeople: rB.estimatedPeopleCount, depletion: rB.depletionApplied },
        neitherReadsTheSum: rA.estimatedPeopleCount !== 8 && rB.estimatedPeopleCount !== 8,
        neitherReadsTheResidence: rA.estimatedPeopleCount !== residentialAdults && rB.estimatedPeopleCount !== residentialAdults,
        nonVacuousPredicate: rA.depletionApplied > 0 && rB.depletionApplied > 0 && rA.estimatedPeopleCount !== rB.estimatedPeopleCount,
        nonVacuous: { predicate: "both parties did real work and read DIFFERENT counts",
          a: rA.estimatedPeopleCount, b: rB.estimatedPeopleCount, sumWouldBe: 8, residenceWouldBe: residentialAdults } });
  }

  // ═══ I9 — non-working party member ══════════════════════════════════════════════════════════
  {
    const pA = mkParty("e:n0", 5, 0, site.t, site.route);
    const pB = mkParty("e:n2", 5, 2, site.t, site.route);
    const bandA = mkExpBand(site.band, 25, [pA], 60);
    const bandB = mkExpBand(site.band, 25, [pB], 60);
    const presA = presenceOf(bandA); const presB = presenceOf(bandB);
    const rA = work(bandA, 5); const rB = work(bandB, 5);
    const capA = expedition.deriveCarryCapacityUnits(bandA, 5, 0, expTick);
    const capB = expedition.deriveCarryCapacityUnits(bandB, 5, 0, expTick);
    const bodiesA = mobility.getExpeditionPhysicalPeople(pA);
    const bodiesB = mobility.getExpeditionPhysicalPeople(pB);
    const paceA = mobility.derivePartyPaceFactor(pA.partyComposition, 0);
    const paceB = mobility.derivePartyPaceFactor(pB.partyComposition, 2);
    const residentialA = expedition.getResidentialWorkingAdults(bandA);
    const residentialB = expedition.getResidentialWorkingAdults(bandB);
    const awayB = presB.sources.find((s) => s.kind === "away_party");
    add("I9_non_working_party_member",
      rA.estimatedPeopleCount === rB.estimatedPeopleCount && rA.harvestedAmount === rB.harvestedAmount &&
      capA === capB && bodiesB === bodiesA + 2 && paceB < paceA &&
      residentialA === residentialB && awayB.people === 7
        ? "BODY_AWAY_NO_WORK_NO_CARRY_BUT_CONSUMES_AND_BURDENS" : "UNEXPECTED",
      { targetWork: { zeroNonWorking: rA.harvestedAmount, twoNonWorking: rB.harvestedAmount },
        carryCeiling: { zeroNonWorking: capA, twoNonWorking: capB },
        bodiesConsuming: { zeroNonWorking: bodiesA, twoNonWorking: bodiesB },
        paceFactor: { zeroNonWorking: round4(paceA), twoNonWorking: round4(paceB) },
        residentialWorkingAdults: { zeroNonWorking: residentialA, twoNonWorking: residentialB },
        awayPresence: awayB, presenceTotalsMatchPopulation: presA.total === presA.population && presB.total === presB.population,
        nonVacuousPredicate: rA.harvestedAmount > 0 && bodiesB === bodiesA + 2 && capA > 0,
        nonVacuous: { predicate: "real work was done, the two extra bodies are genuinely present, and the ceiling is non-zero so 'unchanged' is a real comparison",
          harvest: rA.harvestedAmount, bodies: `${bodiesA} -> ${bodiesB}`, capacity: capA },
        note: "residential extraction does not regain the body or its labour: getResidentialWorkingAdults is identical in both arms because the non-working member was never residential labour" });
  }

  // ═══ I10 — target removal to returned support, complete chain ═══════════════════════════════
  {
    const workers = 5; const nonWorking = 2;
    const party = mkParty("e:chain", workers, nonWorking, site.t, site.route);
    const band = mkExpBand(site.band, 25, [party], 60);
    const stockBefore = patchDepletion(expWorld);
    const r = work(band, workers);
    const stockAfter = patchDepletion(r.world);
    const bodies = mobility.getExpeditionPhysicalPeople(party);
    const capacity = expedition.deriveCarryCapacityUnits(band, workers, 0, expTick);
    const carried = Math.min(r.usableSupport, capacity);
    const abandoned = round4(Math.max(0, r.usableSupport - capacity));
    const provisionsPerDay = round4(bodies * expedition.EXPEDITION_PROVISION_UNITS_PER_WORKER_DAY);
    // No support before return: the band's food ledger must not have moved from a work day.
    const receiptsOnBand = (band.seasonalFoodReceipts?.totalUsableSupport ?? 0);
    const receiptsAfterWork = (r.world.bands?.[band.id]?.seasonalFoodReceipts?.totalUsableSupport ?? receiptsOnBand);
    add("I10_target_removal_to_returned_support",
      r.depletionApplied === r.harvestedAmount && r.usableSupport <= r.harvestedAmount + 1e-9 &&
      stockAfter !== null && stockBefore !== null && stockAfter > stockBefore &&
      receiptsAfterWork === receiptsOnBand
        ? "ONE_CHAIN_UNITS_DISTINCT_NO_SUPPORT_BEFORE_RETURN" : "UNEXPECTED",
      { units: {
          harvestedAmount: "physical stock units removed at the target",
          usableSupport: "human food support units after transport and processing losses",
          cargoUnits: "expedition cargo units — a DIFFERENT quantity from usableSupport, not equated",
          provisionUnits: "trip-local provision units; no residential store is decremented",
          patchDepletion: "normalised patch depletion 0..1" },
        chain: [
          { step: "productive party labour", value: workers },
          { step: "record estimatedPeopleCount", value: r.estimatedPeopleCount },
          { step: "physical availability at target", value: round4(r.physicalAvailability) },
          { step: "requested amount", value: r.requestCappedByAvailability ? null : round4(r.harvestedAmount),
            cappedByAvailability: r.requestCappedByAvailability,
            note: r.requestCappedByAvailability
              ? "availability capped the take, so the request is only bounded below by the removal"
              : "availability did not cap the take, so the request IS the removal" },
          { step: "target stock removal = depletionApplied", value: round4(r.harvestedAmount) },
          { step: "patch depletion before -> after", value: `${stockBefore} -> ${stockAfter}` },
          { step: "transport loss", value: round4(r.transportLoss) },
          { step: "processing loss", value: round4(r.processingLoss) },
          { step: "usable support after losses", value: round4(r.usableSupport) },
          { step: "carry ceiling from productive workers", value: round4(capacity) },
          { step: "carried within ceiling", value: round4(carried) },
          { step: "abandoned above ceiling", value: abandoned },
          { step: "physical people consuming provisions", value: bodies, perDay: provisionsPerDay },
          { step: "band food receipts on the WORK day", value: receiptsAfterWork, unchangedFrom: receiptsOnBand },
        ],
        noSupportBeforeReturn: receiptsAfterWork === receiptsOnBand,
        nonVacuousPredicate: r.harvestedAmount > 0 && r.usableSupport > 0 && stockAfter > stockBefore && bodies > workers,
        nonVacuous: { predicate: "every link carries a non-zero quantity, the patch genuinely moved, and the party genuinely holds more bodies than workers",
          removal: round4(r.harvestedAmount), support: round4(r.usableSupport),
          patch: `${stockBefore} -> ${stockAfter}`, bodies, workers },
        statedNonClaim: "abandonment reads 0 here and is NOT demonstrated: one work-day's take is far below the ceiling, and abandonment arises from cargo ACCUMULATED across work-days, measured by CORRECTION-34B (0.648 -> 0.6 carried + 0.048 lost). Nothing was fabricated to make it non-zero. The deposit-exactly-once half is asserted by the CORRECTION-34A closure and numeric-chain audits, rerun unchanged in this freeze." });
  }

  // ═══ I12 — remote-record isolation ══════════════════════════════════════════════════════════
  {
    const { world: w0, ids } = build([{ tileId: tileAt(0) }, { tileId: tileAt(2) }]);
    const w = step(w0, 10);
    const [a, b] = ids;
    const baseline = {
      crowding: physical(w, a), social: frictionContribution(w, a, w.bands[a].position),
      access: (() => { const p = accessNorms.advanceProtoAccessMemory(w, w.bands[a]).places?.[w.bands[a].position];
        return { strangerCaution: round4(p?.strangerCaution ?? 0), sharedUsePressure: round4(p?.sharedUsePressure ?? 0),
          accessState: p?.accessState ?? null, confidence: round4(p?.confidence ?? 0) }; })(),
    };
    let polluted = w;
    const added = { active: 0, extinct: 0, absorbed: 0, dispersed: 0, withParties: 0 };
    let k = 0;
    for (const kind of ["active", "extinct", "absorbed", "dispersed", "withParties"]) {
      for (let n = 0; n < 3; n += 1, k += 1) {
        const t = byXY.get(`${RICH.x - 40 - k}:${RICH.y + 28}`)?.id;
        if (t === undefined) continue;
        const id = `remote:${kind}:${n}`;
        const clone = { ...w.bands[b], id, name: id, position: t,
          contactMemories: {}, encounterRecords: [], recentRangeFrictionEvents: [], expeditions: [] };
        if (kind === "extinct") clone.viability = { ...(clone.viability ?? {}), status: "extinct" };
        if (kind === "absorbed") clone.viability = { ...(clone.viability ?? {}), status: "absorbed" };
        if (kind === "dispersed") clone.status = "dispersed";
        if (kind === "withParties") clone.expeditions = [mkParty(`e:${id}`, 3, 0, t, [t, t])];
        polluted = { ...polluted, bands: { ...polluted.bands, [id]: clone } };
        added[kind] += 1;
      }
    }
    const after = {
      crowding: physical(polluted, a), social: frictionContribution(polluted, a, polluted.bands[a].position),
      access: (() => { const p = accessNorms.advanceProtoAccessMemory(polluted, polluted.bands[a]).places?.[polluted.bands[a].position];
        return { strangerCaution: round4(p?.strangerCaution ?? 0), sharedUsePressure: round4(p?.sharedUsePressure ?? 0),
          accessState: p?.accessState ?? null, confidence: round4(p?.confidence ?? 0) }; })(),
    };
    const unchanged = JSON.stringify(baseline) === JSON.stringify(after);
    add("I12_remote_record_isolation",
      unchanged ? "FOCAL_RESULT_UNCHANGED_BY_FIFTEEN_REMOTE_RECORDS" : "UNEXPECTED",
      { recordsAdded: added, totalAdded: Object.values(added).reduce((s, n) => s + n, 0),
        baseline, after, unchanged,
        nonVacuousPredicate: Object.values(added).reduce((s, n) => s + n, 0) >= 12 &&
          (baseline.crowding.weightedCrowding > 0 || baseline.access.confidence > 0),
        nonVacuous: { predicate: "at least twelve remote records of five kinds were genuinely added AND the focal band has a non-trivial reading to disturb",
          added: Object.values(added).reduce((s, n) => s + n, 0),
          focalCrowding: baseline.crowding.weightedCrowding, focalConfidence: baseline.access.confidence },
        note: "CORRECTION-33 removed the world-band-count term; this fixture is its integrated restatement across crowding, friction weighting and access expectation at once" });
  }

  // ═══ I13 — prepared-party boundary ══════════════════════════════════════════════════════════
  {
    const prepared = mkParty("e:prep", 5, 0, site.t, site.route, { phase: "prepared", positionTileId: undefined });
    const band = mkExpBand(site.band, 25, [prepared], 60);
    const p = presenceOf(band);
    const acct = expedition.getBandCommitmentAccounting(band);
    const awaySources = p.sources.filter((s) => s.kind === "away_party");
    const residential = expedition.getResidentialWorkingAdults(band);
    const physicallyAway = mobility.derivePhysicallyAwayPartyPeople(band);
    const preparedCommitment = mobility.derivePreparedCommitmentPartyPeople(band);
    add("I13_prepared_party_boundary",
      awaySources.length === 0 && physicallyAway === 0 && preparedCommitment === 5 &&
      residential === 20 && p.total === p.population && acct.conserved
        ? "PREPARED_PEOPLE_ARE_RESIDENTIAL_THEIR_LABOR_IS_NOT" : "UNEXPECTED",
      { presence: p, physicallyAwayPeople: physicallyAway, preparedCommitmentPeople: preparedCommitment,
        residentialWorkingAdults: residential, committedAwayWorkers: acct.committedAwayWorkers,
        awaySources: awaySources.length,
        founderAvailabilityPolicy: "createDaughterBand caps the daughter at min(getDaughterPopulation(total), population - awayPartyPeople) and blocks below DAUGHTER_MIN_POPULATION; prepared people are counted as PRESENT for bodies and as COMMITTED for labour, and withholding them from founding is a stated POLICY, not a physical necessity (CORRECTION-34D §8).",
        itemFourNotImplemented: "no cancellation of a prepared party to free founders, no successor-group selection, no daughter viability model. Roadmap Item 4.",
        nonVacuousPredicate: preparedCommitment === 5 && p.population > 5,
        nonVacuous: { predicate: "a real prepared party of five exists inside a larger band, so 'physically residential' and 'labour committed' are both measured",
          preparedPeople: preparedCommitment, population: p.population } });
  }

  // ═══ I14 — annual cohort boundary with an active party ══════════════════════════════════════
  {
    // Aging reclassifies a cohort; it must not move a body. Drive the real reconciler.
    const party = mkParty("e:cohort", 6, 0, site.t, site.route);
    const before = mkExpBand(site.band, 6, [party], 26);
    const presBefore = presenceOf(before);
    const reconciled = expedition.reconcileExpeditionCommitment(before, expTick);
    const e = reconciled.expeditions[0];
    const presAfter = presenceOf(reconciled);
    const workersAfter = mobility.getExpeditionProductiveWorkers(e);
    const bodiesAfter = mobility.getExpeditionPhysicalPeople(e);
    // Aging: working adults fall while population holds.
    const aged = mkExpBand(site.band, 3, [party], 26);
    const agedReconciled = expedition.reconcileExpeditionCommitment(aged, expTick);
    const agedE = agedReconciled.expeditions[0];
    const agedPres = presenceOf(agedReconciled);
    const agedWork = agedE.phase === "operating"
      ? work(agedReconciled, mobility.getExpeditionProductiveWorkers(agedE)) : null;
    add("I14_annual_cohort_boundary_with_active_party",
      presBefore.total === presBefore.population && presAfter.total === presAfter.population &&
      agedPres.total === agedPres.population &&
      mobility.getExpeditionPhysicalPeople(agedE) === 6 &&
      mobility.getExpeditionProductiveWorkers(agedE) < 6
        ? "AGING_MOVES_NO_BODY_LABOR_FOLLOWS_THE_CONVENTION" : "UNEXPECTED",
      { unagedPresence: presBefore, unagedWorkers: workersAfter, unagedBodies: bodiesAfter,
        agedPresence: agedPres,
        agedWorkers: mobility.getExpeditionProductiveWorkers(agedE),
        agedBodies: mobility.getExpeditionPhysicalPeople(agedE),
        agedNonWorking: agedE.nonWorkingPartyPeople ?? 0,
        agedPhase: agedE.phase, agedOutcomeReason: agedE.outcomeReason ?? null,
        targetWorkAtReducedLabour: agedWork === null ? "party left the operating phase — target work is not reachable" : {
          people: agedWork.estimatedPeopleCount, depletion: round4(agedWork.depletionApplied) },
        fourWayEquivalence: "asserted by the CORRECTION-34D H12 active-annual-boundary fixture and the four-way audit, both rerun unchanged in this freeze",
        nonVacuousPredicate: mobility.getExpeditionPhysicalPeople(agedE) === 6 &&
          mobility.getExpeditionProductiveWorkers(agedE) < 6,
        nonVacuous: { predicate: "labour genuinely fell while all six bodies genuinely stayed away — both halves measured on the real reconciler",
          bodies: mobility.getExpeditionPhysicalPeople(agedE),
          workers: mobility.getExpeditionProductiveWorkers(agedE) } });
  }

  // ═══ I15 — invalid target-work contract ═════════════════════════════════════════════════════
  {
    const band = mkExpBand(site.band, 25, [mkParty("e:inv", 5, 0, site.t, site.route)], 60);
    const attempt = (workers, verifyOnly = false) => {
      const stockBefore = patchDepletion(expWorld);
      try {
        const res = trips.resolveExpeditionTargetWork(
          expWorld, band, site.memory, site.t, site.d, site.route, expDay, "food_resource_check",
          verifyOnly ? { verifyOnly: true, partyWorkers: workers } : { partyWorkers: workers });
        const h = res.record.physicalFoodHarvest;
        return { threw: false, people: res.record.estimatedPeopleCount,
          readTheTarget: h?.physicalSourceFound === true, depletion: h?.depletionApplied ?? 0,
          stockChanged: patchDepletion(res.world) !== stockBefore };
      } catch (error) {
        return { threw: true, message: String(error?.message ?? error).slice(0, 120),
          readTheTarget: false, depletion: 0, stockChanged: false };
      }
    };
    const control = attempt(5);
    const cases = {
      zero: attempt(0), zeroVerify: attempt(0, true), fractionalLow: attempt(0.4),
      fractionalHigh: attempt(1.6), nan: attempt(Number.NaN), infinity: attempt(Number.POSITIVE_INFINITY),
      negative: attempt(-1),
    };
    const allRejected = Object.values(cases).every((c) => c.threw && !c.readTheTarget && c.depletion === 0 && !c.stockChanged);
    add("I15_invalid_target_work_contract",
      allRejected ? "ZERO_FRACTIONAL_AND_NON_FINITE_FAIL_BEFORE_READING_THE_TARGET" : "UNEXPECTED",
      { control: { people: control.people, depletion: round4(control.depletion), stockChanged: control.stockChanged },
        cases, allRejected,
        nonVacuousPredicate: !control.threw && control.depletion > 0 && control.readTheTarget,
        nonVacuous: { predicate: "the SAME target with a valid five-worker party reads it and removes real stock, so every rejection is a refusal and not an absent patch",
          controlDepletion: round4(control.depletion) } });
  }

  const vacuous = Object.entries(fixtures).filter(([, v]) => v.vacuous === true);
  const notConstructed = Object.entries(fixtures).filter(([, v]) => v.notConstructed === true);
  const bad = Object.entries(fixtures).filter(([, v]) => String(v.verdict).includes("UNEXPECTED"));

  out = {
    audit: "ROADMAP-ITEM-3-INTEGRATION-FIXTURES",
    seed: SEED,
    summary: {
      fixtures: Object.keys(fixtures).length,
      failing: bad.length,
      vacuous: vacuous.length,
      notConstructed: notConstructed.length,
      failingIds: bad.map(([k]) => k),
      vacuousIds: vacuous.map(([k]) => k),
      notConstructedIds: notConstructed.map(([k]) => k),
    },
    verdicts: Object.fromEntries(Object.entries(fixtures).map(([k, v]) => [k, v.verdict])),
    fixtures,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
} finally {
  await server.close();
}

console.log(JSON.stringify({ summary: out.summary, verdicts: out.verdicts }, null, 2));
if (out.summary.failing > 0 || out.summary.vacuous > 0) process.exitCode = 1;
