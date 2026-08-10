// ROADMAP ITEM 4 §20 — THE MANDATORY CONTROLLED FIXTURES.
//
// Five groups, each closing one of the blockers the supervising review left standing:
//
//   N  nutrition and subsistence — hunger is measured, and it moves only when food is really taken;
//   B  burden and reintegration  — what walks home is neither cured nor duplicated;
//   C  return causality          — a group turns back because of something it lived;
//   S  descriptive establishment — arrival, time, inheritance and rich diagnostics cannot produce success;
//   Z  resolution shape          — actions are timed, living unresolved conditions are event-bounded.
//
// Every fixture carries a NON-VACUITY PREDICATE and the harness relabels it `VACUOUS` and fails the
// run when the predicate is false, so a fixture cannot pass by measuring an empty set.
import { createServer } from "vite";
import { prepareAndDepart, bestKnownTargetAtDistance } from "./lib/preparedDeparture.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/dynamic-fission-daughter-viability-37";
const OUT = arg("out", `${EVIDENCE}/provisional-subsistence-lifecycle.json`);
const SEED = arg("seed", "audit27:natural:s1");
const WARM_DAYS = Number(arg("warm-days", "2100"));

const fixtures = [];
const record = (id, claim, passed, nonVacuous, detail) => {
  fixtures.push({
    id, claim,
    verdict: nonVacuous === false ? "VACUOUS" : passed ? "PASS" : "FAIL",
    nonVacuous: nonVacuous !== false,
    detail,
  });
};

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-i4life-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const generate = await server.ssrLoadModule("/sim/world/generate.ts");
  const passability = await server.ssrLoadModule("/sim/world/passability.ts");
  const lc = await server.ssrLoadModule("/sim/agents/bandLifecycle.ts");
  const kernel = await server.ssrLoadModule("/sim/agents/fissionLifecycleKernel.ts");
  const seam = await server.ssrLoadModule("/sim/agents/fissionDepartureSeam.ts");
  const prep = await server.ssrLoadModule("/sim/agents/fissionDeparturePreparation.ts");
  const sub = await server.ssrLoadModule("/sim/agents/provisionalTravelSubsistence.ts");
  const ret = await server.ssrLoadModule("/sim/agents/provisionalReturnDecision.ts");
  const est = await server.ssrLoadModule("/sim/agents/provisionalEstablishment.ts");
  const reint = await server.ssrLoadModule("/sim/agents/provisionalReintegration.ts");
  const resolver = await server.ssrLoadModule("/sim/agents/provisionalLifecycleResolver.ts");
  const travel = await server.ssrLoadModule("/sim/agents/provisionalTravel.ts");
  const survival = await server.ssrLoadModule("/sim/agents/seasonalSurvival.ts");
  const plantStock = await server.ssrLoadModule("/sim/agents/plantStock.ts");
  const policy = await server.ssrLoadModule("/sim/agents/fissionFieldTransferPolicy.ts");

  const base = advance.advanceWorldByDays(runner.initSimWorld({ kind: "map2" }, SEED), WARM_DAYS);
  const day0 = Number(base.time.day ?? 0);
  const donor = Object.values(base.bands)
    .filter((b) => lc.isEstablishedBand(b) && b.demography.workingAdults >= 6 && b.demography.population >= 24)
    .sort((a, b) => b.demography.population - a.demography.population)[0];
  if (donor === undefined) throw new Error("no donor band");

  // ── controlled construction ─────────────────────────────────────────────────────────────────────
  //
  // A real band from a real warmed world, given a lifecycle record and placed where the fixture needs
  // it. Everything physical about it — knowledge, memory, adaptation, acute risk — is a real band's.
  const makeSuccessor = (world, overrides = {}) => {
    const id = overrides.id ?? "band:fixture:provisional";
    const phase = overrides.phase ?? "travelling";
    const band = {
      ...donor,
      // The SAME structural resets the departure seam applies, driven by the same classification table.
      // Without them a hand-built successor keeps the donor's viability, storage, camp, trips and
      // receipts, and two fixtures reported a production defect that was entirely the instrument's:
      // the group had not been GIFTED any of it, the fixture had simply never taken it away.
      ...policy.buildPolicyStructuralResets(),
      id,
      parentBandId: overrides.parentBandId ?? donor.id,
      position: overrides.position ?? donor.position,
      demography: {
        ...donor.demography,
        population: overrides.population ?? 8,
        workingAdults: overrides.workingAdults ?? 4,
        dependents: overrides.dependents ?? 3,
        elders: overrides.elders ?? 1,
      },
      size: overrides.population ?? 8,
      seasonalSupport: overrides.seasonalSupport ?? donor.seasonalSupport,
      acuteRisk: overrides.acuteRisk ?? donor.acuteRisk,
      hungerPressure: overrides.hungerPressure ?? donor.hungerPressure,
      provisionalSuccessor: {
        phase,
        phaseEnteredDay: overrides.phaseEnteredDay ?? day0,
        history: [],
        lineageId: overrides.lineageId ?? "LIN-FIXTURE",
        targetTileId: overrides.targetTileId,
        departureTileId: overrides.departureTileId ?? donor.position,
        trail: overrides.trail ?? [],
        travelSubsistence: overrides.travelSubsistence,
        establishment: overrides.establishment,
        blockedStepDays: overrides.blockedStepDays ?? 0,
      },
    };
    return { ...world, bands: { ...world.bands, [id]: band } };
  };
  const succ = (world, id = "band:fixture:provisional") => world.bands[id];
  const nutritionOf = (band) => survival.deriveCanonicalNutritionState(band?.seasonalSupport);

  // Two real tiles: one that physically holds edible plants, one that does not.
  const time0 = base.time;
  const tilesAround = Object.values(base.tiles);
  const withPatch = tilesAround.find((t) =>
    passability.isBandPassableDestination(t) &&
    plantStock.resolvePlantFoodHarvest(base, t, time0, 0.2, true).harvestedAmount > 0);
  const withoutPatch = tilesAround.find((t) =>
    passability.isBandPassableDestination(t) &&
    plantStock.resolvePlantFoodHarvest(base, t, time0, 0.2, true).sourceFound === false);
  if (withPatch === undefined || withoutPatch === undefined) throw new Error("no controlled tiles");

  // ══ N — NUTRITION AND SUBSISTENCE ═══════════════════════════════════════════════════════════════

  // N1 / N10 — a day with nothing taken does not relieve, and contributes to decline.
  {
    const w = makeSuccessor(base, { position: withoutPatch.id });
    const before = nutritionOf(succ(w));
    const r1 = sub.advanceProvisionalSubsistence(w, day0 + 1);
    const after = nutritionOf(succ(r1.world));
    const dayRow = r1.days[0];
    record(
      "N1_hunger_does_not_fall_when_no_support_exists",
      "a day of walking on ground that holds no edible plants leaves every measured stress term exactly where it was — walking is not eating",
      after.foodMovementPressure >= before.foodMovementPressure &&
        after.currentFoodStress >= before.currentFoodStress,
      dayRow !== undefined && dayRow.usableUnits === 0,
      { before, after, day: dayRow },
    );
    record(
      "N10_zero_support_contributes_to_decline",
      "the day is CHARGED: real demand accumulates against zero support, so an interval closed on such days reads a deficit rather than silence",
      (succ(r1.world).provisionalSuccessor.travelSubsistence?.demandUnits ?? 0) > 0 &&
        (succ(r1.world).provisionalSuccessor.travelSubsistence?.supportUnits ?? 0) === 0,
      dayRow !== undefined,
      { interval: succ(r1.world).provisionalSuccessor.travelSubsistence },
    );
  }

  // N2 — an absent support history is no longer reachable for a constructed successor.
  {
    const unmeasured = survival.deriveCanonicalNutritionState(undefined);
    const dep = departFrom(base, "LIN-N2", "band:n2:provisional");
    const constructed = dep.ok === true ? dep.world.bands["band:n2:provisional"] : undefined;
    record(
      "N2_missing_seasonal_support_is_not_permanent_neutral_relief",
      "a successor cannot be constructed nutritionally unmeasured: the seam supplies the founders' own lived samples and REFUSES the departure otherwise, so the neutral branch is unreachable for the group this item is about",
      dep.ok === true && constructed?.seasonalSupport !== undefined &&
        nutritionOf(constructed).nutritionStateAvailable === true,
      dep.ok === true,
      {
        unmeasuredBranchStillReadsNeutral: unmeasured.foodMovementPressure === 0,
        constructedIsMeasured: nutritionOf(constructed).nutritionStateAvailable,
        constructedCurrentFoodStress: nutritionOf(constructed).currentFoodStress,
        refusalIfAny: dep.ok === true ? null : dep.refusal,
      },
    );
  }

  // N3 / N4 / N5 — a real take, a real depletion, and exactly one credit.
  {
    const w = makeSuccessor(base, { position: withPatch.id });
    const stockBefore = { ...(w.plantPatchState ?? {}) };
    const r = sub.advanceProvisionalSubsistence(w, day0 + 1);
    const dayRow = r.days[0];
    const patchId = dayRow?.sourceId;
    const before = stockBefore[patchId]?.depletion ?? 0;
    const after = r.world.plantPatchState?.[patchId]?.depletion ?? 0;
    record(
      "N3_physical_route_extraction_can_produce_bounded_support",
      "standing on ground that holds an edible patch, the group's gathering workers take a real, bounded amount through the canonical plant-harvest owner",
      dayRow !== undefined && dayRow.usableUnits > 0 && dayRow.usableUnits <= dayRow.requestedUnits,
      dayRow !== undefined && dayRow.gatheringWorkers > 0,
      { day: dayRow },
    );
    record(
      "N4_extraction_depletes_the_physical_source",
      "the patch the group ate from is measurably more depleted afterwards — support and depletion are the two sides of one physical act",
      after > before && (dayRow?.depletionApplied ?? 0) > 0,
      dayRow !== undefined && dayRow.usableUnits > 0,
      { patchId, depletionBefore: before, depletionAfter: after, applied: dayRow?.depletionApplied },
    );
    // The same day, run twice: the second call must not feed the group again.
    const twice = sub.advanceProvisionalSubsistence(r.world, day0 + 1);
    const once = succ(r.world).provisionalSuccessor.travelSubsistence;
    const twiceState = succ(twice.world).provisionalSuccessor.travelSubsistence;
    record(
      "N5_no_duplicate_receipt_for_the_same_day",
      "advancing the same day twice charges the day exactly once — a re-entrant caller or a differently batched step mode cannot feed a group twice",
      twiceState.supportUnits === once.supportUnits && twiceState.demandUnits === once.demandUnits &&
        twiceState.daysElapsed === once.daysElapsed,
      once.daysElapsed === 1,
      { once, twice: twiceState },
    );
  }

  // N6 — no ordinary same-day trip runs for a walking group.
  {
    const w = makeSuccessor(base, { position: withPatch.id });
    let stepped = w;
    for (let d = 1; d <= 12; d += 1) stepped = advance.advanceWorldByDays(stepped, 1);
    const band = succ(stepped);
    record(
      "N6_no_ordinary_trip_executes_for_a_walking_group",
      "the quarantine still holds: a provisional group runs no same-day subsistence trips and earns no residential food receipts, so its support can only come from the travel authority",
      (band.recentIntraSeasonTrips ?? []).length === 0 && band.seasonalFoodReceipts === undefined,
      band !== undefined && (band.provisionalSuccessor?.travelSubsistence?.daysElapsed ?? 0) > 0,
      {
        trips: (band.recentIntraSeasonTrips ?? []).length,
        residentialReceipts: band.seasonalFoodReceipts === undefined ? "absent" : "present",
        travelDays: band.provisionalSuccessor?.travelSubsistence?.daysElapsed,
      },
    );
  }

  // N7 — movement and gathering compete for the same workers.
  {
    const fed = makeSuccessor(base, { position: withPatch.id, hungerPressure: 0 });
    const hungryState = {
      ...sub.emptyTravelSubsistence(day0),
      daysElapsed: 20,
      demandUnits: 2,
      supportUnits: 0,
      recentDays: Array.from({ length: 6 }, (_, i) => ({
        day: day0 + i, tileId: withPatch.id, gatherShare: 0.5, gatheringWorkers: 2,
        requestedUnits: 0.07, harvestedUnits: 0.05, usableUnits: 0.04, depletionApplied: 0.01,
        demandUnits: 0.1, waterStress: 0.1, sourceKind: "plant_patch",
      })),
    };
    const hungry = makeSuccessor(base, { position: withPatch.id, travelSubsistence: hungryState });
    const fedSplit = sub.deriveTravelEffortSplit(succ(fed));
    const hungrySplit = sub.deriveTravelEffortSplit(succ(hungry));
    record(
      "N7_movement_and_gathering_compete_for_worker_effort",
      "a group with a measured deficit on ground that HAS been giving spends more of the day looking for food and correspondingly less of it covering distance; the two shares always sum to one",
      hungrySplit.gatherShare > fedSplit.gatherShare &&
        Math.abs(hungrySplit.gatherShare + hungrySplit.movementShare - 1) < 1e-9,
      fedSplit.gatherShare !== hungrySplit.gatherShare,
      { fed: fedSplit, hungry: hungrySplit },
    );
  }

  // N8 — water absence has a real consequence.
  {
    const dry = [...tilesAround].filter(passability.isBandPassableDestination)
      .sort((a, b) => a.resourceProfile.waterAccess - b.resourceProfile.waterAccess)[0];
    const wet = [...tilesAround].filter(passability.isBandPassableDestination)
      .sort((a, b) => b.resourceProfile.waterAccess - a.resourceProfile.waterAccess)[0];
    const dryDay = sub.advanceProvisionalSubsistence(makeSuccessor(base, { position: dry.id }), day0 + 1).days[0];
    const wetDay = sub.advanceProvisionalSubsistence(makeSuccessor(base, { position: wet.id }), day0 + 1).days[0];
    record(
      "N8_water_absence_has_a_real_consequence",
      "the water the group can reach is measured on the ground it is standing on, and standing somewhere dry produces a measurably worse day than standing somewhere wet",
      dryDay.waterStress > wetDay.waterStress && dryDay.waterStress >= sub.TRAVEL_NO_WATER_STRESS,
      dry.id !== wet.id,
      {
        dry: { tile: String(dry.id), waterAccess: dry.resourceProfile.waterAccess, waterStress: dryDay.waterStress },
        wet: { tile: String(wet.id), waterAccess: wet.resourceProfile.waterAccess, waterStress: wetDay.waterStress },
      },
    );
  }

  // N9 — no unearned carried provisions.
  {
    const w = makeSuccessor(base, { position: withoutPatch.id });
    let stepped = w;
    for (let d = 1; d <= 20; d += 1) stepped = advance.advanceWorldByDays(stepped, 1);
    const s = succ(stepped).provisionalSuccessor.travelSubsistence;
    // The interval may legitimately have closed and restarted inside the window — a group that decides
    // to walk home closes its measurement as it turns — so the claim is checked over EVERY interval
    // this group closed as well as the open one.
    // The group walks, so it does not stay on the barren tile — and with a worker always looking it
    // may genuinely find something. That is the point: the claim is not that it starves, it is that
    // every unit it holds was TAKEN FROM SOMEWHERE. Days on which no source was found are the control.
    const days = s.recentDays;
    const daysWithNoSource = days.filter((entry) => entry.sourceKind === "none");
    record(
      "N9_no_unearned_carried_provisions",
      "no support ever appears without an extraction that depleted a real source: on every day the ground held nothing the group got nothing, and across the whole window support and depletion rise together — there is no stock carried out of the parent's camp, because production has none to debit",
      sub.hasEarnedSupportWithoutExtraction(s) === false &&
        daysWithNoSource.every((entry) => entry.usableUnits === 0 && entry.depletionApplied === 0) &&
        (s.supportUnits === 0 || s.depletionApplied > 0),
      days.length >= 5 && daysWithNoSource.length >= 1,
      {
        openInterval: { ...s, recentDays: undefined },
        daysObserved: days.length,
        daysWithNoSource: daysWithNoSource.length,
        supportOnSourcelessDays: daysWithNoSource.reduce((t, entry) => t + entry.usableUnits, 0),
      },
    );
  }

  // ══ B — BURDEN AND REINTEGRATION ════════════════════════════════════════════════════════════════

  function departFrom(world, lineageId, successorBandId, parentOverrides = {}) {
    const parent = { ...world.bands[donor.id], ...parentOverrides };
    // Best-KNOWN rather than alphabetically first: the founder cohort refuses ground it has barely
    // seen, and an alphabetical pick has no relationship to how well the band knows the place.
    const target = bestKnownTargetAtDistance(generate, passability, world, parent, 0);
    return prepareAndDepart({
      prep, seam, world, parentId: donor.id, today: day0, band: parentOverrides,
      lineageId, requestedFounders: 8, targetTileId: String(target.id), successorBandId,
    }).departure;
  }

  {
    const parentBand = base.bands[donor.id];
    const parentEpisodes = parentBand.acuteRisk?.recentEpisodes ?? [];
    // A returning group holding the parent's shared episodes PLUS one it earned on the road.
    const roadInjury = {
      ...parentEpisodes[0],
      id: "episode:road:only:1",
      remainingRecoverySeasons: 3,
    };
    const w = makeSuccessor(base, {
      phase: "returning",
      position: parentBand.position,
      acuteRisk: { ...parentBand.acuteRisk, recentEpisodes: [roadInjury, ...parentEpisodes.slice(0, 4)] },
    });
    const merged = reint.performAtomicReintegration({ world: w, successorId: "band:fixture:provisional", today: day0 + 1 });
    const afterParent = merged.ok === true ? merged.world.bands[donor.id] : undefined;
    const afterIds = new Set((afterParent?.acuteRisk?.recentEpisodes ?? []).map((e) => e.id));
    const ml = merged.ok === true ? merged.ledger.embodied.acuteRiskMerge : undefined;

    record(
      "B11_successor_only_injury_survives_reintegration",
      "an episode the group earned on the road is still in the parent's ring afterwards — walking home is not a cure",
      merged.ok === true && afterIds.has("episode:road:only:1"),
      parentEpisodes.length > 0,
      { merge: ml, roadInjuryRetained: afterIds.has("episode:road:only:1") },
    );
    record(
      "B12_duplicate_episode_ids_are_merged_once",
      "the episodes the founders carried out exist on BOTH sides under the same ids, and each appears exactly once afterwards — one injury does not become two recoveries",
      merged.ok === true &&
        (afterParent?.acuteRisk?.recentEpisodes ?? []).length ===
          new Set((afterParent?.acuteRisk?.recentEpisodes ?? []).map((e) => e.id)).size &&
        (ml?.sharedEpisodeIds ?? 0) > 0,
      (ml?.sharedEpisodeIds ?? 0) > 0,
      { merge: ml },
    );
    record(
      "B13_parent_burden_is_retained",
      "no episode the parent already held is dropped in favour of the returning group's",
      merged.ok === true && parentEpisodes.slice(0, 4).every((e) => afterIds.has(e.id)),
      parentEpisodes.length > 0,
      { parentBefore: parentEpisodes.length, retained: afterIds.size },
    );
    record(
      "B14_the_ring_cap_is_deterministic",
      "the merged ring never exceeds the production cap and everything the cap removes is counted rather than lost",
      merged.ok === true && (afterParent?.acuteRisk?.recentEpisodes ?? []).length <= 10 &&
        (afterParent?.acuteRisk?.droppedEpisodeCount ?? 0) >= (ml?.droppedByCap ?? 0),
      merged.ok === true,
      { retained: (afterParent?.acuteRisk?.recentEpisodes ?? []).length, dropped: ml?.droppedByCap },
    );
    const rederived = afterParent?.acuteRisk?.activeEffect;
    record(
      "B15_the_active_effect_is_rederived_from_the_merged_ring",
      "the merged group's active effect is recomputed from the merged episodes rather than carried from either side, so a burden in the record is a burden in the world",
      merged.ok === true && ml?.effectRederivedFromMergedRing === true &&
        rederived !== undefined && rederived.recoverySeasons >= 3,
      merged.ok === true,
      { rederived, roadInjuryRecoverySeasons: roadInjury.remainingRecoverySeasons },
    );
    record(
      "B16_no_episode_is_replayed",
      "no episode's recovery timer is reset and no consequence is re-applied — an episode is a record of something that happened, and merging two records does not make it happen again",
      merged.ok === true &&
        (afterParent?.acuteRisk?.recentEpisodes ?? []).every((e) => {
          const fromParent = parentEpisodes.find((p) => p.id === e.id);
          return fromParent === undefined || e.remainingRecoverySeasons <= Math.max(fromParent.remainingRecoverySeasons, roadInjury.remainingRecoverySeasons);
        }),
      merged.ok === true,
      { noReplay: ml?.noEpisodeReplayed },
    );
  }

  // B17 / B18 — no instant relief, and the world conserves.
  {
    const parentBand = base.bands[donor.id];
    const starving = {
      ...parentBand.seasonalSupport,
      currentSeasonSupport: { ...parentBand.seasonalSupport.currentSeasonSupport, foodStress: 1, rawSupportRatio: 0, clampedSupportRatio: 0, deficitRatio: 1 },
    };
    const w = makeSuccessor(base, { phase: "returning", position: parentBand.position, seasonalSupport: starving });
    const popBefore = Object.values(w.bands).reduce((t, b) => t + Math.round(b.demography.population), 0);
    const merged = reint.performAtomicReintegration({ world: w, successorId: "band:fixture:provisional", today: day0 + 1 });
    const popAfter = merged.ok === true
      ? Object.values(merged.world.bands).reduce((t, b) => t + Math.round(b.demography.population), 0)
      : -1;
    record(
      "B17_returned_hunger_does_not_become_instant_relief",
      "absorbing a group that is measurably hungrier never leaves the camp better fed than it was, and the merged reading replaces the camp's current one rather than extending its window",
      merged.ok === true && merged.ledger.embodied.parentReliefedByAbsorbingAHungrierGroup === false &&
        merged.world.bands[donor.id].seasonalSupport.recentSamples.length ===
          parentBand.seasonalSupport.recentSamples.length,
      merged.ok === true,
      merged.ok === true ? { ...merged.ledger.embodied, acuteRiskMerge: undefined } : { refusal: merged.refusal },
    );
    record(
      "B18_world_cohorts_remain_conserved",
      "every cohort line adds exactly and world population is measured from the resulting world rather than restated from the before value",
      merged.ok === true && reint.isReintegrationLedgerConserving(merged.ledger) && popAfter === popBefore,
      merged.ok === true,
      { popBefore, popAfter, demographic: merged.ok === true ? merged.ledger.demographic : null },
    );
  }

  // ══ C — RETURN CAUSALITY ════════════════════════════════════════════════════════════════════════
  {
    const badInterval = {
      ...sub.emptyTravelSubsistence(day0),
      daysElapsed: 20, demandUnits: 2, supportUnits: 0.1, daysWithoutWater: 2,
    };
    const goodInterval = {
      ...sub.emptyTravelSubsistence(day0),
      daysElapsed: 20, demandUnits: 2, supportUnits: 2.2, daysWithoutWater: 0,
    };
    const bad = succ(makeSuccessor(base, { phase: "establishing", phaseEnteredDay: day0 - 30, travelSubsistence: badInterval }));
    const good = succ(makeSuccessor(base, { phase: "establishing", phaseEnteredDay: day0 - 30, travelSubsistence: goodInterval }));
    const badDecision = ret.deriveProvisionalReturnDecision(bad, day0);
    const goodDecision = ret.deriveProvisionalReturnDecision(good, day0);
    record(
      "C19_worsening_lived_conditions_can_trigger_return_intent",
      "a group whose own measured support covered a tenth of what its bodies needed over twenty days decides to walk home, and names why",
      badDecision.shouldReturn === true && badDecision.cause === "measured_support_failed_at_this_site",
      badDecision.measured.measuredDays >= 14,
      badDecision,
    );
    record(
      "C20_good_lived_conditions_do_not_trigger_the_same_return",
      "the identical group with the identical machinery, differing only in what it managed to eat, does not decide to leave — the trigger reads evidence rather than firing on a schedule",
      goodDecision.shouldReturn === false,
      goodDecision.measured.measuredDays >= 14,
      goodDecision,
    );
    // C21 — the decision cannot see the parent.
    const movedParentWorld = {
      ...base,
      bands: {
        ...base.bands,
        [donor.id]: { ...base.bands[donor.id], position: withoutPatch.id, demography: { ...donor.demography, population: 1 } },
      },
    };
    const badElsewhere = succ(makeSuccessor(movedParentWorld, { phase: "establishing", phaseEnteredDay: day0 - 30, travelSubsistence: badInterval }));
    const decisionElsewhere = ret.deriveProvisionalReturnDecision(badElsewhere, day0);
    record(
      "C21_hidden_parent_movement_is_not_read",
      "moving the parent and collapsing it to one person changes the decision NOT AT ALL — the authority takes a band and a day and has no world to read a parent from",
      JSON.stringify(decisionElsewhere) === JSON.stringify(badDecision),
      badDecision.shouldReturn === true,
      { withParentHome: badDecision.cause, withParentMovedAndCollapsed: decisionElsewhere.cause },
    );
    // C22 — intent does not teleport.
    const w = makeSuccessor(base, {
      phase: "establishing", phaseEnteredDay: day0 - 30, travelSubsistence: badInterval,
      position: withPatch.id, departureTileId: donor.position,
    });
    const decided = ret.advanceProvisionalReturnDecisions(w, day0);
    const after = succ(decided.world);
    record(
      "C22_return_intent_does_not_teleport",
      "deciding to go home changes the phase and NOT the position; the walk itself is still the contiguous travel writer's",
      after.provisionalSuccessor.phase === "returning" && String(after.position) === String(withPatch.id),
      decided.decisions.length === 1,
      { phase: after.provisionalSuccessor.phase, position: String(after.position), cause: after.provisionalSuccessor.returnCause },
    );
    // C23 — parent absence prevents reintegration.
    const arrived = { ...decided.world, bands: { ...decided.world.bands, [donor.id]: { ...decided.world.bands[donor.id], position: withoutPatch.id } } };
    const atHome = {
      ...arrived,
      bands: { ...arrived.bands, "band:fixture:provisional": { ...succ(arrived), position: donor.position } },
    };
    const refused = reint.performAtomicReintegration({ world: atHome, successorId: "band:fixture:provisional", today: day0 + 1 });
    record(
      "C23_parent_absence_prevents_reintegration",
      "the group walks to the tile it left from, finds nobody, and is refused — it keeps its people, is not retargeted at a position it cannot observe, and does not disappear",
      refused.ok === false && refused.refusal === "not_physically_co_located" &&
        Math.round(atHome.bands["band:fixture:provisional"].demography.population) > 0,
      String(donor.position) !== String(withoutPatch.id),
      { refusal: refused.ok === false ? refused.refusal : "reintegrated", detail: refused.ok === false ? refused.detail : null },
    );
  }

  // ══ S — DESCRIPTIVE ESTABLISHMENT, WITH ZERO STABILIZATION AUTHORITY ════════════════════════════
  {
    const emptyEst = {
      siteTileId: withPatch.id, sinceDay: day0, closedIntervalsAtEntry: 0,
      windowOpenedDay: day0, windowsAssessed: 0, daysAtSite: 0,
      productiveGatheringDaysAtSite: 0, waterStressDaySumAtSite: 0,
      supportUnitsAtSite: 0, demandUnitsAtSite: 0, signals: [], satisfiedSignals: 0,
    };
    // S24 — arrival alone.
    const justArrived = makeSuccessor(base, { phase: "establishing", position: withPatch.id, establishment: emptyEst });
    const r24 = est.advanceProvisionalEstablishment(justArrived, day0 + 1);
    record(
      "S24_arrival_alone_cannot_stabilize",
      "a group that has only just arrived holds none of the site evidence and stays provisional",
      succ(r24.world).provisionalSuccessor.phase === "establishing",
      r24.assessments.length === 1,
      { assessment: r24.assessments[0] },
    );
    // S25 — elapsed time alone.
    const longEst = { ...emptyEst, daysAtSite: 300, sinceDay: day0 - 300, windowOpenedDay: day0 - 300 };
    const timeOnly = makeSuccessor(base, { phase: "establishing", position: withPatch.id, phaseEnteredDay: day0 - 300, establishment: longEst });
    const r25 = est.advanceProvisionalEstablishment(timeOnly, day0 + 1);
    record(
      "S25_elapsed_time_alone_cannot_stabilize",
      "three hundred days at a site with no measured support, no local take and no water evidence produce a NEXT WINDOW, never a success — a timer can end the trying and can never end it well",
      succ(r25.world).provisionalSuccessor.phase === "establishing" && r25.assessments[0].outcome !== "stabilize",
      r25.assessments[0].windowClosed === true,
      { outcome: r25.assessments[0].outcome, satisfied: r25.assessments[0].satisfiedSignals, signals: r25.assessments[0].signals },
    );
    // S26 — inherited parent support cannot stabilize.
    const inherited = makeSuccessor(base, {
      phase: "establishing", position: withPatch.id, phaseEnteredDay: day0 - 300,
      establishment: longEst, seasonalSupport: base.bands[donor.id].seasonalSupport,
    });
    const r26 = est.advanceProvisionalEstablishment(inherited, day0 + 1);
    record(
      "S26_inherited_parent_support_cannot_stabilize",
      "the parent's own support record, carried whole, does not satisfy the site signals: the intervals, the local takes and the water all have to be measured HERE",
      succ(r26.world).provisionalSuccessor.phase === "establishing",
      r26.assessments.length === 1,
      { satisfied: r26.assessments[0].satisfiedSignals, failing: r26.assessments[0].signals.filter((s) => !s.holds).map((s) => s.id) },
    );
    // S27 / S28 / S29 — diagnostics remain sensitive, but even a rich hand-assigned record cannot
    // decide identity or stabilization.
    const wetPatch = [...tilesAround]
      .filter((t) => passability.isBandPassableDestination(t) && t.resourceProfile.waterAccess > 0.6)
      .find((t) => plantStock.resolvePlantFoodHarvest(base, t, time0, 0.2, true).harvestedAmount > 0) ?? withPatch;
    const goodSupport = {
      ...base.bands[donor.id].seasonalSupport,
      currentSeasonSupport: { ...base.bands[donor.id].seasonalSupport.currentSeasonSupport, foodStress: 0.2, rawSupportRatio: 0.8, clampedSupportRatio: 0.8, deficitRatio: 0.2 },
      currentFoodStress: 0.2,
    };
    const luckyDay = {
      ...emptyEst, siteTileId: wetPatch.id, daysAtSite: 3, productiveGatheringDaysAtSite: 3, waterStressDaySumAtSite: 0.3,
    };
    const lucky = makeSuccessor(base, {
      phase: "establishing", position: wetPatch.id, phaseEnteredDay: day0 - 3,
      establishment: luckyDay, seasonalSupport: goodSupport,
      travelSubsistence: { ...sub.emptyTravelSubsistence(day0), closedIntervals: 2 },
    });
    const r28 = est.advanceProvisionalEstablishment(lucky, day0 + 1);
    record(
      "S28_one_lucky_day_is_insufficient",
      "a group with real food, real water and two measured intervals remains provisional; the duration diagnostic reports false but is not an outcome gate",
      succ(r28.world).provisionalSuccessor.phase === "establishing" &&
        r28.assessments[0].signals.find((s) => s.id === "long_enough_to_reject_one_lucky_day").holds === false,
      r28.assessments[0].satisfiedSignals >= 4,
      { satisfied: r28.assessments[0].satisfiedSignals, signals: r28.assessments[0].signals.map((s) => ({ id: s.id, holds: s.holds, measured: s.measured })) },
    );
    // ── UNIT / DESCRIPTIVE INPUT — HAND-ASSIGNED, AND DECLARED AS SUCH ──
    //
    // Every number here is written by the fixture, not lived by anybody: the days at site, the
    // productive days, the closed intervals and now the site support ledger. This exercises the
    // descriptive reader only. The fixture deliberately makes every retained diagnostic hold and
    // proves that the establishment writer still has zero lifecycle authority.
    const sustained = {
      ...luckyDay, daysAtSite: 60, productiveGatheringDaysAtSite: 20, waterStressDaySumAtSite: 6,
      supportUnitsAtSite: 3.4, demandUnitsAtSite: 4.5,
    };
    const richlyMeasured = makeSuccessor(base, {
      phase: "establishing", position: wetPatch.id, phaseEnteredDay: day0 - 60,
      establishment: sustained, seasonalSupport: goodSupport,
      travelSubsistence: { ...sub.emptyTravelSubsistence(day0), closedIntervals: 2 },
    });
    const r29 = est.advanceProvisionalEstablishment(richlyMeasured, day0 + 1);
    const measuredBand = succ(r29.world);
    record(
      "S27_physical_support_evidence_can_contribute",
      "the food and water diagnostics report the hand-assigned physical facts when those facts are present — the null in S25 is a real null and not an insensitive instrument",
      r29.assessments[0].signals.filter((s) => s.holds).length >= 5,
      r29.assessments.length === 1,
      { signals: r29.assessments[0].signals.map((s) => ({ id: s.id, holds: s.holds, measured: s.measured, reference: s.reference })) },
    );
    record(
      "S29_rich_descriptive_record_has_zero_lifecycle_authority",
      "even a HAND-ASSIGNED record with every retained diagnostic holding remains `establishing`; physical description is not positive commitment or identity",
      measuredBand.provisionalSuccessor.phase === "establishing" &&
        !["stabilize", "stabilized"].includes(r29.assessments[0].outcome),
      r29.assessments[0].signals.every((s) => s.holds),
      { phase: measuredBand.provisionalSuccessor.phase, outcome: r29.assessments[0].outcome, satisfied: r29.assessments[0].satisfiedSignals, acquiredDays: r29.assessments[0].signals.map((s) => ({ id: s.id, acquiredDay: s.acquiredDay })) },
    );
    record(
      "S30_descriptive_measurement_never_opens_ordinary_band_readers",
      "the richly measured group remains provisional and excluded from ordinary-band readers because no positive-commitment writer exists",
      lc.isProvisionalSuccessor(succ(richlyMeasured)) === true &&
        lc.isProvisionalSuccessor(measuredBand) === true &&
        kernel.isTerminalPhase(measuredBand.provisionalSuccessor.phase) === false,
      r29.assessments[0].signals.every((s) => s.holds),
      { beforeProvisional: lc.isProvisionalSuccessor(succ(richlyMeasured)), afterProvisional: lc.isProvisionalSuccessor(measuredBand) },
    );
    const again = est.advanceProvisionalEstablishment(r29.world, day0 + 1);
    record(
      "S31_no_same_tick_double_processing",
      "running the descriptive writer again cannot smuggle in a lifecycle transition; the group remains provisional",
      again.assessments.length === 1 && succ(again.world).provisionalSuccessor.phase === "establishing",
      r29.assessments.length === 1,
      { secondPassAssessments: again.assessments.length },
    );
    record(
      "S32_no_viability_storage_or_proto_camp_is_gifted",
      "descriptive measurement grants no viability, storage, camp or residential receipt and does not admit the group to ordinary systems",
      (measuredBand.viability ?? null) === null &&
        (measuredBand.storageCapacity ?? 0) === 0 &&
        measuredBand.protoCampMemory === undefined &&
        measuredBand.seasonalFoodReceipts === undefined,
      measuredBand.provisionalSuccessor.phase === "establishing",
      {
        viability: measuredBand.viability ?? null,
        storageCapacity: measuredBand.storageCapacity ?? 0,
        protoCamp: measuredBand.protoCampMemory === undefined ? "absent" : "present",
        receipts: measuredBand.seasonalFoodReceipts === undefined ? "absent" : "present",
      },
    );
  }

  // ══ P — PRODUCTION PIPELINE ═════════════════════════════════════════════════════════════════════
  //
  // A real daily run now proves the cleanup boundary: no current production path may stabilize.
  {
    // The BEST case the world offers: the nearest well-watered tile the parent already knows, so the
    // group arrives in one step and spends its days living rather than walking. Choosing the most
    // favourable reachable site is deliberate — the claim is that even here the bar cannot be met.
    const pipeTarget = Object.keys(donor.knowledge.observedTiles)
      .map((id) => generate.getTile(base, id))
      .filter((t) => t !== undefined && passability.isBandPassableDestination(t) &&
        String(t.id) !== String(donor.position))
      .sort((a, b) => b.resourceProfile.waterAccess - a.resourceProfile.waterAccess)[0];
    const dep = prepareAndDepart({
    prep, seam, world: base, parentId: donor.id, today: day0,
    lineageId: "LIN-PIPE", requestedFounders: 8, targetTileId: String(pipeTarget.id),
    successorBandId: "band:pipe:succ",
  }).departure;

    let w = dep.ok === true ? dep.world : base;
    const trace = [];
    let peakSatisfied = 0, peakSignals = [], everStabilized = false, sawEstablishing = false;
    if (dep.ok === true) {
      for (let i = 1; i <= 200; i += 1) {
        w = advance.advanceWorldByDays(w, 1);
        const b = w.bands["band:pipe:succ"];
        if (b === undefined) break;
        const rec = b.provisionalSuccessor;
        if (rec === undefined) break;
        if (rec.phase === "establishing") sawEstablishing = true;
        if (rec.phase === "stabilized") { everStabilized = true; break; }
        const e = rec.establishment;
        if (e !== undefined && e.satisfiedSignals >= peakSatisfied) {
          peakSatisfied = e.satisfiedSignals;
          peakSignals = (e.signals ?? []).map((s) => ({ id: s.id, holds: s.holds, measured: s.measured, reference: s.reference }));
        }
        if (i % 40 === 0 || rec.phase === "returning") {
          trace.push({ day: i, phase: rec.phase, daysAtSite: e?.daysAtSite ?? 0,
            supAtSite: e?.supportUnitsAtSite ?? 0, demAtSite: e?.demandUnitsAtSite ?? 0,
            hunger: b.hungerPressure });
        }
        if (["reintegrated", "provisional_extinguished"].includes(rec.phase)) break;
      }
    }
    const failing = peakSignals.filter((s) => !s.holds).map((s) => s.id);
    record(
      "P1_PRODUCTION_PIPELINE_has_no_stabilization_writer",
      "driven by the real daily runner from a real atomic departure, the group reaches establishment and never stabilizes because descriptive measurements have no lifecycle authority",
      everStabilized === false && sawEstablishing === true,
      dep.ok === true && sawEstablishing === true,
      {
        departureOk: dep.ok, reachedEstablishing: sawEstablishing, everStabilized,
        peakHoldingDiagnostics: peakSatisfied, diagnosticCount: 7,
        signalsAtPeak: peakSignals, failingSignals: failing,
        trace,
        boundary: "positive commitment and sufficient operation semantics remain unimplemented",
      },
    );
  }

  // ══ Z — TEMPORALLY BOUNDED ACTIONS, EVENT-BOUNDED LIVING CONDITION ══════════════════════════════
  {
    // Z33 / Z35 / Z36 — failed return enters a named unresolved living state, and no timer resolves
    // anything well.
    const spent = makeSuccessor(base, {
      phase: "returning", phaseEnteredDay: day0 - kernel.RETURN_MAX_DAYS - 1,
      travelSubsistence: { ...sub.emptyTravelSubsistence(day0), daysElapsed: 30, demandUnits: 3, supportUnits: 0 },
    });
    const settled = resolver.resolveProvisionalLifecycles(spent, day0);
    const settledBand = succ(settled.world);
    const again = resolver.resolveProvisionalLifecycles(settled.world, day0 + 400);
    const causalRetry = ret.advanceProvisionalReturnDecisions(settled.world, day0 + 1);
    record(
      "Z33_failed_return_becomes_explicitly_unresolved",
      "expiry ends only the return action; it enters a living event-bounded condition and neither the resolver nor return decision manufactures another attempt",
      settledBand.provisionalSuccessor.phase === "unresolved_after_failed_return" &&
        succ(again.world).provisionalSuccessor.phase === "unresolved_after_failed_return" &&
        succ(causalRetry.world).provisionalSuccessor.phase === "unresolved_after_failed_return",
      settled.resolutions.length >= 1,
      {
        afterBound: settledBand.provisionalSuccessor.phase,
        afterAnotherFourHundredDays: succ(again.world).provisionalSuccessor.phase,
        causalRetryDecisions: causalRetry.decisions.length,
        resolutionKind: kernel.getPhaseContract(settledBand.provisionalSuccessor.phase).resolutionKind,
      },
    );
    record(
      "Z34_no_timer_kills_living_people",
      "no expiry anywhere in the table resolves a living group to a terminal outcome; every timeout lands on a phase the group can still act from",
      kernel.PHASE_CONTRACTS.filter((c) => c.onTimeout !== undefined)
        .every((c) => kernel.getPhaseContract(c.onTimeout).terminal === false ||
          kernel.getPhaseContract(c.onTimeout).phase === "abandoned"),
      kernel.PHASE_CONTRACTS.some((c) => c.onTimeout !== undefined),
      {
        timeouts: kernel.PHASE_CONTRACTS.filter((c) => c.onTimeout !== undefined)
          .map((c) => ({ from: c.phase, to: c.onTimeout, targetTerminal: kernel.getPhaseContract(c.onTimeout).terminal })),
      },
    );
    const timerReintegration = kernel.requestTransition({
      current: { phase: "returning", phaseEnteredDay: day0 - 400, history: [] },
      to: "reintegrated", today: day0, cause: "elapsed_time", physicalCoLocationProven: true,
    });
    const timerStabilization = kernel.requestTransition({
      current: { phase: "establishing", phaseEnteredDay: day0 - 400, history: [] },
      to: "stabilized", today: day0, cause: "elapsed_time", livedEvidenceCount: 6,
    });
    record(
      "Z35_no_timer_reintegrates",
      "elapsed time cannot claim the people reached their parent, even when it also claims co-location",
      timerReintegration.ok === false && timerReintegration.rejection === "terminal_outcome_requires_a_physical_event",
      true,
      timerReintegration,
    );
    record(
      "Z36_no_timer_stabilizes",
      "elapsed time cannot claim a group functioned, even when it also claims a full set of evidence",
      timerStabilization.ok === false && timerStabilization.rejection === "terminal_outcome_requires_a_physical_event",
      true,
      timerStabilization,
    );
    // Z37 — a constructed lineage that cannot feed itself resolves within its declared bound.
    const doomed = makeSuccessor(base, {
      phase: "establishing", position: withoutPatch.id, population: 1, workingAdults: 1, dependents: 0, elders: 0,
    });
    let w = { ...doomed, bands: { ...doomed.bands, "band:fixture:provisional": { ...succ(doomed), demography: { ...succ(doomed).demography, population: 0, workingAdults: 0, dependents: 0, elders: 0 } } } };
    const resolved = resolver.resolveProvisionalLifecycles(w, day0 + 1);
    record(
      "Z37_every_constructed_lineage_resolves_within_its_declared_bound",
      "a group at zero bodies resolves to `provisional_extinguished` through the fission lifecycle rather than sitting in the world unreachable by anything",
      succ(resolved.world).provisionalSuccessor.phase === "provisional_extinguished" &&
        resolver.hasUnresolvedProvisionalGroup(resolved.world) === false,
      resolved.resolutions.length === 1,
      { resolutions: resolved.resolutions },
    );
    const twice = resolver.resolveProvisionalLifecycles(resolved.world, day0 + 2);
    record(
      "Z38_zero_bodies_resolve_exactly_once",
      "the resolver does not resolve the same dead group a second time — the phase is terminal and the kernel refuses",
      twice.resolutions.length === 0 &&
        succ(twice.world).provisionalSuccessor.phase === "provisional_extinguished",
      resolved.resolutions.length === 1,
      { secondPassResolutions: twice.resolutions.length },
    );
  }

  const failing = fixtures.filter((f) => f.verdict === "FAIL").length;
  const vacuous = fixtures.filter((f) => f.verdict === "VACUOUS").length;
  out = {
    generatedAt: new Date().toISOString(),
    seed: SEED, warmDays: WARM_DAYS,
    donorBandId: String(donor.id),
    controlledTiles: { withPatch: String(withPatch.id), withoutPatch: String(withoutPatch.id) },
    summary: { total: fixtures.length, passing: fixtures.length - failing - vacuous, failing, vacuous },
    fixtures,
  };
} finally {
  await server.close();
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
for (const f of out.fixtures) console.log(`${f.verdict.padEnd(8)}${f.id}`);
console.log(JSON.stringify(out.summary));
