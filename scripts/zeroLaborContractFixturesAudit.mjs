// CORRECTION-34F §8 — controlled fixtures Z1-Z12 for the target-work labour CONTRACT,
// plus the §7 canonical production call-order proof.
//
// Z1-Z10 exercise the real exported resolver. Z11/Z12 measure the natural call domain: every
// expedition that will be handed to `advanceExpeditionOneDay` in a phase that reaches target work,
// with the exact labour value the call site would pass.
//
// Non-vacuity is ASSERTED per fixture: the harness relabels a fixture VACUOUS and fails the run
// when its predicate is false.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/shared-use-physical-presence-authority-34";
const OUT = arg("out", `${EVIDENCE}/zero-labor-target-work-fixtures.json`);
const OUT_NAT_20 = arg("out-natural-20", `${EVIDENCE}/natural-target-work-contract-20y.json`);
const OUT_NAT_50 = arg("out-natural-50", `${EVIDENCE}/natural-target-work-contract-50y.json`);
const NAT_YEARS_A = Number(arg("years-a", "20"));
const NAT_YEARS_B = Number(arg("years-b", "50"));

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c34f-fx-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
let nat20;
let nat50;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const trips = await server.ssrLoadModule("/sim/agents/intraSeasonTrips.ts");
  const expedition = await server.ssrLoadModule("/sim/agents/expedition.ts");
  const mobility = await server.ssrLoadModule("/sim/agents/bandMobility.ts");

  const MIN = expedition.EXPEDITION_MIN_PARTY_WORKERS;

  let world = runner.initSimWorld({ kind: "map2" }, "c34e:targetwork");
  world = advance.advanceWorldByDays(world, 360 * 2);
  const day = Number(world.time.day);

  const living = Object.values(world.bands)
    .filter((b) => b.status !== "dispersed" && b.viability?.status !== "absorbed" && b.viability?.status !== "extinct")
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const FOOD_CLASSES = ["generic_plant_food", "animal_food", "aquatic_food", "fallback_food"];

  const mkBand = (b, t, route, workers) => ({
    ...b,
    demography: { ...b.demography, population: 45, workingAdults: 25, elders: 10, dependents: 10 },
    expeditions: [{
      id: "e:zf", phase: "operating", partyWorkers: workers,
      partyComposition: { limited: 0, typical: Math.max(0, Math.round(Number(workers)) || 0), high: 0 },
      positionTileId: t, routeTileIds: route, routeIndex: 1, targetTileId: t,
      taskKind: "distant_plant_gathering", injuryLoad: 0,
      travelDaysElapsed: 1, workDaysElapsed: 0, hardDeadlineDay: 9999,
      cargo: { harvestUnits: 0, carryCapacityUnits: 1, provisionUnitsConsumed: 0, lostUnits: 0 },
    }],
  });

  let base; let memory; let targetTileId; let route; let distanceTiles;
  outer:
  for (const b of living) {
    const mems = (b.resourceKnowledgeState?.patchMemories ?? [])
      .filter((x) => FOOD_CLASSES.includes(x.resourceClassId) && world.tiles[x.approximateTile] !== undefined)
      .sort((x, y) => String(x.patchId).localeCompare(String(y.patchId)));
    for (const m of mems) {
      const t = m.approximateTile;
      const r0 = [b.position, t];
      const d = Math.abs(world.tiles[t].coord.x - world.tiles[b.position].coord.x) +
        Math.abs(world.tiles[t].coord.y - world.tiles[b.position].coord.y);
      const probe = trips.resolveExpeditionTargetWork(
        world, mkBand(b, t, r0, 5), m, t, d, r0, day, "food_resource_check", { partyWorkers: 5 });
      const h = probe.record.physicalFoodHarvest;
      if (h?.physicalSourceFound === true && (h.physicalAvailability ?? 0) > 0 &&
          (probe.record.resourceReturn?.estimatedReturnValue ?? 0) > 0) {
        base = b; memory = m; targetTileId = t; route = r0; distanceTiles = d;
        break outer;
      }
    }
  }
  if (base === undefined) {
    throw new Error("no band holds a remembered patch that production physically harvests — the fixtures refuse to fabricate one");
  }

  const referenceSourceId = trips.resolveExpeditionTargetWork(
    world, mkBand(base, targetTileId, route, 5), memory, targetTileId, distanceTiles, route, day,
    "food_resource_check", { partyWorkers: 5 }).record.physicalFoodHarvest?.sourceId;

  const stockForSource = (w) => {
    const pick = (store) => {
      if (store === undefined || store === null || referenceSourceId === undefined) return undefined;
      const entry = Array.isArray(store)
        ? store.find((x) => String(x?.patchId ?? x?.id ?? x?.sourceId) === String(referenceSourceId))
        : store[referenceSourceId];
      return entry === undefined ? undefined : JSON.stringify(entry);
    };
    return {
      plantPatchState: pick(w.plantPatchState) ?? null,
      faunaStockState: pick(w.faunaStockState) ?? null,
      aquaticStockState: pick(w.aquaticStockState) ?? null,
    };
  };

  const attempt = (workers, verifyOnly = false) => {
    const before = stockForSource(world);
    try {
      const res = trips.resolveExpeditionTargetWork(
        world, mkBand(base, targetTileId, route, workers), memory, targetTileId, distanceTiles,
        route, day, "food_resource_check",
        verifyOnly ? { verifyOnly: true, partyWorkers: workers } : { partyWorkers: workers },
      );
      const r = res.record;
      const h = r.physicalFoodHarvest;
      const after = stockForSource(res.world);
      return {
        threw: false,
        estimatedPeopleCount: r.estimatedPeopleCount ?? null,
        activityOutcome: r.activityOutcome ?? null,
        returnedResourceKind: r.resourceReturn?.returnedResourceKind ?? null,
        returnValueAfterHarvest: r.resourceReturn?.estimatedReturnValue ?? 0,
        physicalSourceFound: h?.physicalSourceFound ?? null,
        physicalAvailability: h?.physicalAvailability ?? 0,
        harvestedAmount: h?.harvestedAmount ?? 0,
        depletionApplied: h?.depletionApplied ?? 0,
        usableSupport: h?.usableSupport ?? 0,
        readTheTarget: h?.physicalSourceFound === true || (h?.physicalAvailability ?? 0) > 0,
        stockChangedAtTarget: JSON.stringify(before) !== JSON.stringify(after),
      };
    } catch (error) {
      return {
        threw: true,
        errorMessage: String(error?.message ?? error).slice(0, 200),
        estimatedPeopleCount: null, activityOutcome: null, returnedResourceKind: null,
        returnValueAfterHarvest: 0, physicalSourceFound: null, physicalAvailability: 0,
        harvestedAmount: 0, depletionApplied: 0, usableSupport: 0,
        readTheTarget: false, stockChangedAtTarget: false,
      };
    }
  };

  const fixtures = {};
  const add = (id, verdict, detail) => {
    const vacuous = detail.nonVacuousPredicate !== true;
    fixtures[id] = { verdict: vacuous ? `VACUOUS:${verdict}` : verdict, vacuous, ...detail };
  };

  // A control the whole suite leans on: this exact target, with a valid party, DOES real work.
  // Without it every "no stock removed" verdict below could be an absent patch.
  const validControl = attempt(5);

  // ── Z1 zero exploitation ────────────────────────────────────────────────────────────────────
  {
    const r = attempt(0);
    add("Z1_zero_exploitation",
      r.threw && r.depletionApplied === 0 && !r.stockChangedAtTarget
        ? "ZERO_LABOR_REJECTED_BEFORE_WORK"
        : r.stockChangedAtTarget || r.depletionApplied > 0 ? "ZERO_LABOR_REMOVES_PHYSICAL_STOCK" : "UNEXPECTED",
      { result: r,
        nonVacuousPredicate: !validControl.threw && validControl.depletionApplied > 0,
        nonVacuous: { predicate: "the SAME target with a valid five-worker party removes real stock, so a zero-labour refusal is a refusal and not an empty patch",
          controlDepletion: validControl.depletionApplied, controlAvailability: validControl.physicalAvailability },
        before: "accepted, classified target_found, requested from the confidence terms alone, removed 0.0047 of stock" });
  }

  // ── Z2 zero verification ────────────────────────────────────────────────────────────────────
  {
    const r = attempt(0, true);
    const validVerify = attempt(5, true);
    add("Z2_zero_verification",
      r.threw && !r.readTheTarget && r.depletionApplied === 0
        ? "ZERO_LABOR_CANNOT_INSPECT_THE_TARGET"
        : r.readTheTarget ? "ZERO_LABOR_READS_THE_TARGET" : "UNEXPECTED",
      { result: r, validPartyVerification: validVerify,
        nonVacuousPredicate: !validVerify.threw && validVerify.readTheTarget === true && validVerify.depletionApplied === 0,
        nonVacuous: { predicate: "a VALID party verifying the same target DOES read it and removes nothing, so the zero-labour refusal is not a target that cannot be read",
          validPartyReadTheTarget: validVerify.readTheTarget, validPartyDepletion: validVerify.depletionApplied },
        note: "an observation is what a verification party carries home; the target-work authority produces its raw material, so a party with nobody in it must not reach it" });
  }

  // ── Z3 negative ─────────────────────────────────────────────────────────────────────────────
  {
    const r = attempt(-1);
    add("Z3_negative_labor",
      r.threw ? "NEGATIVE_LABOR_REJECTED" : "UNEXPECTED",
      { result: r,
        nonVacuousPredicate: !validControl.threw,
        nonVacuous: { predicate: "the resolver does resolve for a valid party, so the rejection is a rejection of the value and not of the fixture",
          errorMessage: r.errorMessage ?? null } });
  }

  // ── Z4 NaN and infinities ───────────────────────────────────────────────────────────────────
  {
    const nan = attempt(Number.NaN);
    const inf = attempt(Number.POSITIVE_INFINITY);
    const ninf = attempt(Number.NEGATIVE_INFINITY);
    add("Z4_non_finite_labor",
      nan.threw && inf.threw && ninf.threw ? "NON_FINITE_LABOR_REJECTED" : "UNEXPECTED",
      { nan, infinity: inf, negativeInfinity: ninf,
        nonVacuousPredicate: !validControl.threw,
        nonVacuous: { predicate: "the resolver resolves for a valid party, so all three rejections are about the value",
          allThrew: nan.threw && inf.threw && ninf.threw } });
  }

  // ── Z5 fractional ───────────────────────────────────────────────────────────────────────────
  {
    const low = attempt(0.4);
    const high = attempt(1.6);
    add("Z5_fractional_labor",
      low.threw && high.threw ? "FRACTIONAL_PEOPLE_REJECTED_NOT_ROUNDED" : "UNEXPECTED",
      { zeroPointFour: low, oneCommaSix: high,
        nonVacuousPredicate: !validControl.threw,
        nonVacuous: { predicate: "the resolver resolves for a valid integer party, so the two rejections are about fractional people specifically" },
        before: "0.4 was silently rounded to 0 (and still removed stock); 1.6 was silently rounded to 2 — a person and a half became two people" });
  }

  // ── Z6 one valid positive worker ────────────────────────────────────────────────────────────
  {
    const r = attempt(1);
    add("Z6_one_worker",
      !r.threw && r.estimatedPeopleCount === 1
        ? "ONE_WORKER_ACCEPTED_BY_THE_RESOLVER_AND_WORKS_AS_ONE"
        : "UNEXPECTED",
      { result: r,
        resolverLowerBound: 1,
        expeditionMinimumPartyWorkers: MIN,
        nonVacuousPredicate: !r.threw && r.depletionApplied > 0,
        nonVacuous: { predicate: "one worker actually removed stock, so 'accepted' means it did work and not merely that it did not throw",
          people: r.estimatedPeopleCount, depletion: r.depletionApplied },
        statedHonestly: `The RESOLVER's lower bound is 1, not EXPEDITION_MIN_PARTY_WORKERS (${MIN}). One person can physically work a day. The two-worker minimum is an EXPEDITION POLICY about what is worth sending and what turns for home; it is enforced in expedition.ts by the launch gate and by reconcileExpeditionLabor, and it is measured separately by Z11/Z12. Putting it in this module would also close a dependency cycle: expedition.ts imports intraSeasonTrips.ts and never the reverse.` });
  }

  // ── Z7 / Z8 valid parties unchanged from 34E ────────────────────────────────────────────────
  {
    const two = attempt(2);
    const five = attempt(5);
    add("Z7_two_worker_expedition",
      !two.threw && two.estimatedPeopleCount === 2 ? "UNCHANGED_FROM_34E" : "UNEXPECTED",
      { result: two,
        nonVacuousPredicate: !two.threw && two.depletionApplied > 0,
        nonVacuous: { predicate: "the two-worker party did real work", people: two.estimatedPeopleCount, depletion: two.depletionApplied } });
    add("Z8_five_worker_expedition",
      !five.threw && five.estimatedPeopleCount === 5 && five.depletionApplied > two.depletionApplied
        ? "UNCHANGED_FROM_34E" : "UNEXPECTED",
      { result: five,
        nonVacuousPredicate: !five.threw && five.depletionApplied > 0 && two.depletionApplied > 0,
        nonVacuous: { predicate: "both valid parties did real work and the larger removed strictly more, so party labour is still live",
          depletion: `${two.depletionApplied} -> ${five.depletionApplied}` } });
  }

  // ── Z9 same-day control ─────────────────────────────────────────────────────────────────────
  {
    // The same-day path passes no party context and therefore never enters this contract. Proven
    // by behaviour: same-day records still exist and still track their band's residential cohort.
    let w = runner.initSimWorld({ kind: "map2" }, "c34e:sameday");
    w = advance.advanceWorldByDays(w, 400);
    const perBand = Object.values(w.bands)
      .filter((b) => b.status !== "dispersed" && b.viability?.status !== "extinct")
      .map((b) => ({
        workingAdults: b.demography?.workingAdults ?? 0,
        counts: (b.recentIntraSeasonTrips ?? []).map((r) => r.estimatedPeopleCount).filter((n) => typeof n === "number"),
      }))
      .filter((x) => x.counts.length > 0);
    const all = perBand.flatMap((x) => x.counts);
    const withinCohort = perBand.every((x) => x.counts.every((n) => n <= Math.max(1, x.workingAdults)));
    const allIntegers = all.every((n) => Number.isInteger(n));
    add("Z9_same_day_control",
      all.length > 0 && withinCohort && allIntegers && all.every((n) => n >= 1)
        ? "SAME_DAY_PATH_NEVER_ENTERS_THIS_CONTRACT" : "UNEXPECTED",
      { sameDayRecords: all.length, bands: perBand.length,
        peopleRange: { min: Math.min(...all), max: Math.max(...all) },
        allWithinResidentialCohort: withinCohort, allIntegers,
        nonVacuousPredicate: all.length > 0 && perBand.length > 1,
        nonVacuous: { predicate: "more than one band produced same-day records, so the claim is measured over a real non-empty set",
          records: all.length, bands: perBand.length },
        note: "same-day trips pass no `partyWork` object at all, so `buildTripRecord` takes the estimateTaskGroupPeople branch and the CORRECTION-34F validation is never reached" });
  }

  // ── Z10 verify-only valid party ─────────────────────────────────────────────────────────────
  {
    const r = attempt(5, true);
    add("Z10_verify_only_valid_party",
      !r.threw && r.estimatedPeopleCount === 5 && r.depletionApplied === 0 && !r.stockChangedAtTarget
        ? "VALID_PARTY_VERIFIES_WITH_ZERO_REMOVAL" : "UNEXPECTED",
      { result: r,
        nonVacuousPredicate: !r.threw && r.readTheTarget === true && !validControl.threw && validControl.depletionApplied > 0,
        nonVacuous: { predicate: "the party genuinely read a target that a non-verifying party of the same size DOES deplete, so zero removal is suppression and not absence",
          readTheTarget: r.readTheTarget, exploitationDepletionAtSameTarget: validControl.depletionApplied } });
  }

  // ── §7 canonical production call-order proof ────────────────────────────────────────────────
  // Not asserted from fixture construction: each step is a real production predicate, checked by
  // driving the actual reconciler on constructed states.
  const callOrder = (() => {
    const mkParty = (workers, phase) => ({
      id: `e:co:${phase}`, phase, partyWorkers: workers,
      partyComposition: { limited: 0, typical: workers, high: 0 },
      positionTileId: targetTileId, routeTileIds: route, routeIndex: 1, targetTileId,
      taskKind: "distant_plant_gathering", injuryLoad: 0,
      travelDaysElapsed: 1, workDaysElapsed: 0, hardDeadlineDay: 9999,
      cargo: { harvestUnits: 0, carryCapacityUnits: 1, provisionUnitsConsumed: 0, lostUnits: 0 },
    });
    const bandWith = (workingAdults, exps) => ({
      ...base,
      demography: { ...base.demography, population: workingAdults + 20, workingAdults, elders: 10, dependents: 10 },
      expeditions: exps,
    });
    const tick = Number(world.time.tick);

    // An OPERATING party whose band can no longer staff it: the reconciler must move it out of the
    // operating phase before any target work can be attempted.
    const operatingStarved = expedition.reconcileExpeditionCommitment(bandWith(1, [mkParty(6, "operating")]), tick);
    const opAfter = operatingStarved.expeditions[0];
    // A PREPARED party in the same position: cancelled, never departed.
    const preparedStarved = expedition.reconcileExpeditionCommitment(bandWith(1, [mkParty(6, "prepared")]), tick);
    const prepAfter = preparedStarved.expeditions[0];
    // A healthy operating party is left alone.
    const healthy = expedition.reconcileExpeditionCommitment(bandWith(25, [mkParty(5, "operating")]), tick);
    const healthyAfter = healthy.expeditions[0];

    return {
      order: [
        "expeditionDailyAction iterates bands and calls reconcileExpeditionCommitment FIRST, before maybeLaunchExpedition and before advanceExpeditionOneDay (expedition.ts, the CORRECTION-34A ordering)",
        "reconcileExpeditionLabor turns a physically-away party reduced below EXPEDITION_MIN_PARTY_WORKERS into `returning` (`party_labor_unsupported`), and a `prepared` one into `aborted` (`commitment_unsupported`), setting its labour to 0 only on that terminal record",
        "repairInvalidPhysicalCommitment retires an over-committed record whole as `aborted` (`invalid_state_repaired`), again terminal",
        "maybeLaunchExpedition refuses below 2 (`deriveDepartableWorkers` returns an integer and the gate is `partyWorkers < 2 -> return band`); the verification, reconnaissance and exploration families hardcode 2",
        "advanceExpeditionOneDay reaches target work ONLY from `phase === 'operating'` — the verification branch at the frontier/patch cases and the exploitation branch — so a `returning`/`aborted` record never calls it",
        "therefore every target-work call carries an integer >= EXPEDITION_MIN_PARTY_WORKERS",
      ],
      measuredPredicates: {
        operatingStarvedPhase: opAfter.phase,
        operatingStarvedWorkers: mobility.getExpeditionProductiveWorkers(opAfter),
        operatingStarvedKeptItsBodies: mobility.getExpeditionPhysicalPeople(opAfter),
        operatingStarvedLeavesOperatingPhase: opAfter.phase !== "operating",
        preparedStarvedPhase: prepAfter.phase,
        preparedStarvedIsTerminal: prepAfter.phase === "aborted",
        healthyOperatingUntouched: healthyAfter.phase === "operating" &&
          mobility.getExpeditionProductiveWorkers(healthyAfter) === 5,
        launchLowerBound: 2,
        expeditionMinPartyWorkers: MIN,
      },
      writesToPartyWorkersInProduction: [
        "maybeLaunchExpedition -> createPreparedExpedition(partyWorkers: chosen.workers) — integer >= 2",
        "frontier verification / frontier exploration launches — hardcoded 2",
        "applyReducedProductiveLabor(partyWorkers: reducedWorkers) — integer, because workingAdults is Math.round()ed; below the minimum the record is simultaneously moved out of `operating`",
        "reconcileExpeditionLabor / repairInvalidPhysicalCommitment set 0 ONLY together with a terminal phase",
      ],
    };
  })();

  add("Z0_canonical_call_order",
    callOrder.measuredPredicates.operatingStarvedLeavesOperatingPhase &&
    callOrder.measuredPredicates.preparedStarvedIsTerminal &&
    callOrder.measuredPredicates.healthyOperatingUntouched
      ? "RECONCILIATION_REMOVES_AN_UNSTAFFABLE_PARTY_FROM_THE_OPERATING_PHASE_BEFORE_WORK"
      : "UNEXPECTED",
    { ...callOrder,
      nonVacuousPredicate: callOrder.measuredPredicates.operatingStarvedWorkers < 6 &&
        callOrder.measuredPredicates.healthyOperatingUntouched,
      nonVacuous: { predicate: "the reconciler genuinely acted on the starved party (labour fell from 6) and genuinely left the healthy one alone, so neither result is a no-op",
        starvedWorkers: callOrder.measuredPredicates.operatingStarvedWorkers,
        starvedPhase: callOrder.measuredPredicates.operatingStarvedPhase } });

  // ── Z11 / Z12 natural call-domain ───────────────────────────────────────────────────────────
  // THE STRONGEST STATEMENT AVAILABLE, and it is structural: after CORRECTION-34F an invalid
  // labour count THROWS. A natural run that completes therefore proves no invalid call was made.
  // The domain counts below say how much work that proof covers.
  const naturalDomain = (years) => {
    let w = runner.initSimWorld({ kind: "map2" }, "audit27:natural:map2:s1");
    const days = years * 360;
    const acc = {
      years, days, bandDays: 0,
      operatingPartyDaysReachingTargetWork: 0,
      zeroLaborCalls: 0, fractionalLaborCalls: 0, nonFiniteLaborCalls: 0,
      belowExpeditionMinimumCalls: 0, validCalls: 0,
      minObservedLabor: null, maxObservedLabor: null,
      completedWithoutThrowing: false,
    };
    for (let d = 0; d < days; d += 1) {
      w = advance.advanceWorldByDays(w, 1);
      for (const band of Object.values(w.bands)) {
        if (band.status === "dispersed" || band.viability?.status === "extinct" || band.viability?.status === "absorbed") continue;
        acc.bandDays += 1;
        for (const e of band.expeditions ?? []) {
          // The call site is `getExpeditionProductiveWorkers(withProvisions)` inside the
          // `phase === "operating"` branches; provisioning does not touch partyWorkers, so this IS
          // the argument that would be passed on the next advance of this record.
          if (e.phase !== "operating") continue;
          const workers = mobility.getExpeditionProductiveWorkers(e);
          acc.operatingPartyDaysReachingTargetWork += 1;
          acc.minObservedLabor = acc.minObservedLabor === null ? workers : Math.min(acc.minObservedLabor, workers);
          acc.maxObservedLabor = acc.maxObservedLabor === null ? workers : Math.max(acc.maxObservedLabor, workers);
          if (!Number.isFinite(workers)) acc.nonFiniteLaborCalls += 1;
          else if (!Number.isInteger(workers)) acc.fractionalLaborCalls += 1;
          else if (workers <= 0) acc.zeroLaborCalls += 1;
          else if (workers < MIN) acc.belowExpeditionMinimumCalls += 1;
          else acc.validCalls += 1;
        }
      }
    }
    acc.completedWithoutThrowing = true;
    return {
      audit: "CORRECTION-34F-NATURAL-TARGET-WORK-CALL-DOMAIN",
      seed: "audit27:natural:map2:s1",
      expeditionMinPartyWorkers: MIN,
      ...acc,
      structuralProof: "after CORRECTION-34F an invalid labour count throws inside resolveExpeditionTargetWork. This run completed, so canonical production made no zero, fractional or non-finite target-work call anywhere in it.",
      nonVacuity: {
        operatingPartyDaysObserved: acc.operatingPartyDaysReachingTargetWork,
        note: "if this is 0 the run proves nothing about the call domain, only that nothing was called",
      },
    };
  };

  nat20 = naturalDomain(NAT_YEARS_A);
  nat50 = naturalDomain(NAT_YEARS_B);

  for (const [id, nat, years] of [["Z11", nat20, NAT_YEARS_A], ["Z12", nat50, NAT_YEARS_B]]) {
    add(`${id}_natural_call_domain_${years}y`,
      nat.zeroLaborCalls === 0 && nat.fractionalLaborCalls === 0 && nat.nonFiniteLaborCalls === 0 &&
      nat.belowExpeditionMinimumCalls === 0 && nat.completedWithoutThrowing
        ? "EVERY_NATURAL_TARGET_WORK_CALL_CARRIES_A_VALID_PARTY"
        : "UNEXPECTED",
      { years, bandDays: nat.bandDays,
        operatingPartyDaysReachingTargetWork: nat.operatingPartyDaysReachingTargetWork,
        zeroLaborCalls: nat.zeroLaborCalls, fractionalLaborCalls: nat.fractionalLaborCalls,
        nonFiniteLaborCalls: nat.nonFiniteLaborCalls,
        belowExpeditionMinimumCalls: nat.belowExpeditionMinimumCalls,
        validCalls: nat.validCalls,
        observedLaborRange: { min: nat.minObservedLabor, max: nat.maxObservedLabor },
        nonVacuousPredicate: nat.operatingPartyDaysReachingTargetWork > 0,
        nonVacuous: { predicate: "real operating parties existed in this run, so the all-valid result is measured over a non-empty domain",
          operatingPartyDays: nat.operatingPartyDaysReachingTargetWork },
        structuralProof: nat.structuralProof });
  }

  const vacuous = Object.entries(fixtures).filter(([, v]) => v.vacuous === true);
  const bad = Object.entries(fixtures).filter(([, v]) => String(v.verdict).includes("UNEXPECTED") ||
    String(v.verdict).includes("REMOVES_PHYSICAL_STOCK") || String(v.verdict).includes("READS_THE_TARGET"));

  out = {
    audit: "CORRECTION-34F-ZERO-LABOR-CONTRACT-FIXTURES",
    summary: {
      fixtures: Object.keys(fixtures).length,
      failing: bad.length,
      vacuous: vacuous.length,
      vacuousIds: vacuous.map(([k]) => k),
      failingIds: bad.map(([k]) => k),
    },
    contract: {
      resolverLowerBound: 1,
      resolverRequiresInteger: true,
      expeditionMinPartyWorkers: MIN,
      whereTheMinimumLives: "expedition.ts — the launch gate and reconcileExpeditionLabor. NOT in the resolver, because one person can physically work and because expedition.ts imports intraSeasonTrips.ts and never the reverse.",
    },
    target: { tile: String(targetTileId), band: String(base.id), sourceId: String(referenceSourceId) },
    verdicts: Object.fromEntries(Object.entries(fixtures).map(([k, v]) => [k, v.verdict])),
    fixtures,
  };

  for (const [p, data] of [[OUT, out], [OUT_NAT_20, nat20], [OUT_NAT_50, nat50]]) {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  }
} finally {
  await server.close();
}

console.log(JSON.stringify({ summary: out.summary, contract: out.contract, verdicts: out.verdicts }, null, 2));
if (out.summary.failing > 0 || out.summary.vacuous > 0) process.exitCode = 1;
