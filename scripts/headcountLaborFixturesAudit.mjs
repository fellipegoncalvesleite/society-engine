// CORRECTION-34D §10 — controlled fixtures H1-H14 for the physical-headcount / productive-labour
// split, prepared-commitment semantics, fission founder availability and legacy-state handling.
//
// Asserts through production functions. Where a production function is module-private
// (`createDaughterBand`, `getDaughterPopulation`, `getBandForagingDraw`), the fixture reproduces
// the SELECTION ARITHMETIC from the published constants and says so, rather than pretending to
// call it. Every fixture reports the numbers it judged on, so none can pass silently on an empty
// set: `nonVacuous` records what was actually observed.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/shared-use-physical-presence-authority-34";
const OUT = arg("out", `${EVIDENCE}/headcount-labor-fixtures.json`);
const DAUGHTER_MIN_POPULATION = 18;   // demography.ts:135

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c34d-fx-${process.pid}`,
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
  const nb = world.tiles[base.position]?.neighbors ?? [];
  const t1 = nb[0] ?? base.position;
  const t2 = nb[1] ?? t1;

  const RATE = expedition.EXPEDITION_PROVISION_UNITS_PER_WORKER_DAY;
  const rec = (b) => expedition.reconcileExpeditionCommitment(b, tick);
  const party = (over = {}) => ({
    id: "e:h", phase: "operating", partyWorkers: 6,
    partyComposition: { limited: 1, typical: 4, high: 1 },
    positionTileId: t1, routeTileIds: [base.position, t1], routeIndex: 1,
    taskKind: "resource_retrieval", injuryLoad: 0, travelDaysElapsed: 2, workDaysElapsed: 0,
    hardDeadlineDay: 9999,
    cargo: { harvestUnits: 0, carryCapacityUnits: expedition.deriveCarryCapacityUnits(base, 6, 0, tick), provisionUnitsConsumed: 0, lostUnits: 0 },
    ...over,
  });
  const mk = (workingAdults, elders, dependents, expeditions) => ({
    ...base,
    demography: { ...base.demography, population: workingAdults + elders + dependents, workingAdults, elders, dependents },
    expeditions,
  });
  const snap = (b) => {
    const p = crowding.getBandPhysicalPresence(b);
    const away = p.filter((s) => s.kind === "away_party");
    const home = p.find((s) => s.kind === "residential_remainder");
    const acc = expedition.getBandCommitmentAccounting(b);
    return {
      population: b.demography.population, workingAdults: b.demography.workingAdults,
      elders: b.demography.elders, dependents: b.demography.dependents,
      residentialPeople: home?.people ?? 0,
      awayPeople: away.reduce((n, s) => n + s.people, 0),
      awayTiles: away.map((s) => String(s.tileId)),
      parties: (b.expeditions ?? []).map((e) => ({
        id: e.id, phase: e.phase, outcomeReason: e.outcomeReason ?? null,
        workers: e.partyWorkers, nonWorking: e.nonWorkingPartyPeople ?? 0,
        people: e.partyWorkers + (e.nonWorkingPartyPeople ?? 0),
        composition: e.partyComposition,
        compositionTotal: e.partyComposition === undefined ? null : mobility.partyCompositionTotal(e.partyComposition),
        carryCapacityUnits: e.cargo.carryCapacityUnits,
        paceFactor: Number(mobility.derivePartyPaceFactor(e.partyComposition, e.nonWorkingPartyPeople ?? 0).toFixed(6)),
        provisionsPerDay: Number(((e.partyWorkers + (e.nonWorkingPartyPeople ?? 0)) * RATE).toFixed(6)),
      })),
      represented: p.reduce((n, s) => n + s.people, 0),
      conserved: acc.conserved, laborBounded: acc.laborBounded,
      committedAwayWorkers: acc.committedAwayWorkers,
      physicallyAwayPeople: acc.physicallyAwayPeople,
      preparedCommitmentPeople: acc.preparedCommitmentPeople,
      awayNonWorkingPeople: acc.awayNonWorkingPeople,
    };
  };
  // §11 invariants, asserted on every fixture snapshot rather than only where convenient.
  const invariants = (s) => ({
    workersWithinPeople: s.parties.every((p) => p.workers >= 0 && p.workers <= p.people),
    compositionEqualsWorkers: s.parties.every((p) => p.compositionTotal === null || p.compositionTotal === p.workers),
    awayWithinPopulation: s.physicallyAwayPeople <= s.population,
    presenceSumsToPopulation: s.represented === s.population,
    preparedAreResidential: s.preparedCommitmentPeople === 0 || s.awayPeople === s.physicallyAwayPeople,
  });
  const allHold = (s) => Object.values(invariants(s)).every(Boolean);

  // Production drops a terminal party from `band.expeditions` and compacts it into
  // `recentExpeditionOutcomes` (expedition.ts:2696-2701), releasing its workers exactly there.
  // An earlier version of these fixtures hand-built a `completed` record that STAYED in
  // `expeditions` with its counts zeroed but its composition left standing, and then failed its
  // own `compositionTotal === workers` invariant. That was the fixture, not production; the
  // return is now modelled the way production performs it.
  const returnHome = (b, expeditionId) => ({
    ...b,
    expeditions: (b.expeditions ?? []).filter((e) => e.id !== expeditionId),
    recentExpeditionOutcomes: [
      ...(b.recentExpeditionOutcomes ?? []),
      ...(b.expeditions ?? []).filter((e) => e.id === expeditionId).map((e) => ({
        id: e.id, phase: "completed", outcomeReason: "returned_with_cargo",
        partyWorkers: e.partyWorkers,
        partyPeople: e.partyWorkers + (e.nonWorkingPartyPeople ?? 0),
      })),
    ],
  });

  const fixtures = {};
  const add = (id, verdict, detail) => { fixtures[id] = { verdict, ...detail }; };

  // ── H1 ordinary valid party — headcount and labour equal at launch ──────────────────────────
  {
    const b = rec(mk(12, 4, 6, [party()]));          // population 22, 12 adults, party of 6
    const s = snap(b);
    const p = s.parties[0];
    add("H1_ordinary_valid_party",
      p.workers === 6 && p.people === 6 && p.nonWorking === 0 && p.compositionTotal === 6 &&
      s.awayPeople === 6 && s.residentialPeople === 16 && allHold(s) && s.laborBounded && s.conserved
        ? "ALL_AUTHORITIES_AGREE" : "UNEXPECTED",
      { snapshot: s, invariants: invariants(s), nonVacuous: { partyPeople: p.people, partyWorkers: p.workers },
        note: "at launch headcount IS labour; every authority reads 6 and no reconciliation fires" });
  }

  // ── H2 aging allocated to residence ─────────────────────────────────────────────────────────
  {
    // §7's own counterexample: a large cohort, a small party, one adult ages. The party must not
    // be touched — the residence absorbs it, and the model claims no knowledge of who aged.
    const before = rec(mk(20, 3, 6, [party()]));     // population 29
    const aged = rec(mk(19, 4, 6, [party()]));       // one adult -> elder, population 29
    const a = snap(before), c = snap(aged);
    add("H2_aging_allocated_to_residence",
      c.parties[0].people === a.parties[0].people && c.parties[0].workers === a.parties[0].workers &&
      c.awayPeople === a.awayPeople && c.residentialPeople === a.residentialPeople &&
      c.awayNonWorkingPeople === 0 && allHold(c)
        ? "RESIDENCE_ABSORBS_THE_TRANSITION_PARTY_UNTOUCHED" : "UNEXPECTED",
      { before: a, afterAging: c, invariants: invariants(c),
        nonVacuous: { workingAdultsFell: `${a.workingAdults} -> ${c.workingAdults}`, partyWorkersUnchanged: c.parties[0].workers },
        allocationRule:
          "AGGREGATE CONVENTION, NOT AN OBSERVATION. With 19 adults still holding 6 committed away, the reduction is charged to the 13 residential adults. The model has cohorts, not people, and does NOT claim to know whether the person who aged was at camp or in the party.",
      });
  }

  // ── H3 forced away labour reduction ─────────────────────────────────────────────────────────
  {
    const b = mk(5, 7, 8, [party()]);                // CORRECTION-34C's accepted state
    const a = snap(b), c = snap(rec(b));
    add("H3_forced_away_labor_reduction",
      c.awayPeople === a.awayPeople && c.residentialPeople === a.residentialPeople &&
      c.parties[0].people === 6 && c.parties[0].workers === 5 && c.parties[0].nonWorking === 1 &&
      c.parties[0].compositionTotal === 5 && c.parties[0].composition.high === 0 &&
      c.parties[0].carryCapacityUnits < a.parties[0].carryCapacityUnits &&
      c.parties[0].paceFactor < a.parties[0].paceFactor && c.laborBounded && allHold(c)
        ? "LABOR_REDUCES_THROUGH_ONE_AUTHORITY_NO_BODY_MOVES" : "UNEXPECTED",
      { before: a, after: c, invariants: invariants(c),
        nonVacuous: {
          headcount: `${a.awayPeople} -> ${c.awayPeople}`,
          labour: `${a.parties[0].workers} -> ${c.parties[0].workers}`,
          carry: `${a.parties[0].carryCapacityUnits} -> ${c.parties[0].carryCapacityUnits}`,
          pace: `${a.parties[0].paceFactor} -> ${c.parties[0].paceFactor}`,
        },
        note: "workers, composition, carry ceiling and pace move together through one function; the high pool is emptied first so a loss can never make the party faster" });
  }

  // ── H4 non-working person remains with the party ────────────────────────────────────────────
  {
    const b = mk(5, 7, 8, [party()]);
    const a = snap(b), c = snap(rec(b));
    const p0 = a.parties[0], p1 = c.parties[0];
    // Return: the whole party comes home exactly once, and nothing is created or deleted.
    const reconciled = rec(b);
    const returned = returnHome(reconciled, "e:h");
    const r = snap(returned);
    add("H4_non_working_person_remains_with_party",
      p1.people === p0.people && p1.nonWorking === 1 &&
      p1.provisionsPerDay === p0.provisionsPerDay &&                       // still eats
      p1.carryCapacityUnits < p0.carryCapacityUnits &&                     // grants no carrying
      p1.compositionTotal === 5 &&                                         // grants no work
      p1.paceFactor <= p0.paceFactor &&                                    // not silently faster
      r.represented === 20 && r.residentialPeople === 20 && r.awayPeople === 0 && allHold(r)
        ? "PRESENT_AND_CONSUMING_WITHOUT_GRANTING_LABOR" : "UNEXPECTED",
      { before: a, after: c, afterReturn: r, invariants: invariants(c),
        nonVacuous: {
          presenceUnchanged: `${p0.people} -> ${p1.people}`,
          provisionsUnchanged: `${p0.provisionsPerDay} -> ${p1.provisionsPerDay}`,
          carryFell: `${p0.carryCapacityUnits} -> ${p1.carryCapacityUnits}`,
          paceNotImproved: p1.paceFactor <= p0.paceFactor,
          returnedOnce: `${r.residentialPeople} residential, ${r.awayPeople} away`,
        },
        carryingRule: "ZERO PRODUCTIVE CARRYING was selected over a partial share or an explicit burden on the remaining workers: the alternatives need per-person physiology this architecture has no state for. Stated, not hidden." });
  }

  // ── H5 two concurrent parties ───────────────────────────────────────────────────────────────
  {
    const two = mk(5, 7, 8, [
      party({ id: "e:a", partyWorkers: 3, partyComposition: { limited: 1, typical: 2, high: 0 } }),
      party({ id: "e:b", partyWorkers: 3, partyComposition: { limited: 0, typical: 2, high: 1 }, positionTileId: t2, routeTileIds: [base.position, t2] }),
    ]);
    const a = snap(two), c = snap(rec(two));
    const first = rec(two), second = rec(two);
    add("H5_two_concurrent_parties",
      c.awayPeople === a.awayPeople && c.represented === 20 &&
      c.parties.every((p, i) => p.people === a.parties[i].people) &&
      c.committedAwayWorkers === 5 && c.laborBounded &&
      JSON.stringify(snap(first)) === JSON.stringify(snap(second)) && allHold(c)
        ? "LABOR_ALLOCATED_DETERMINISTICALLY_WITHOUT_MOVING_BODIES" : "UNEXPECTED",
      { before: a, after: c, invariants: invariants(c),
        nonVacuous: {
          totalHeadcountUnchanged: `${a.awayPeople} -> ${c.awayPeople}`,
          perPartyWorkers: c.parties.map((p) => `${p.id}:${p.workers}w+${p.nonWorking}nw`),
          deterministicAcrossRepeatedCalls: JSON.stringify(snap(first)) === JSON.stringify(snap(second)),
        },
        note: "6 committed against 5 adults; the NEWEST party absorbs the reduction (array order is launch order) and both parties keep every body at their own tiles" });
  }

  // ── H6 prepared party ───────────────────────────────────────────────────────────────────────
  {
    const prepared = rec(mk(12, 4, 6, [party({ phase: "prepared" })]));   // population 22
    const s = snap(prepared);
    add("H6_prepared_party",
      s.awayPeople === 0 && s.residentialPeople === s.population &&
      s.physicallyAwayPeople === 0 && s.preparedCommitmentPeople === 6 &&
      s.committedAwayWorkers === 6 && allHold(s)
        ? "RESIDENTIAL_BODY_COMMITTED_LABOR_UNAVAILABLE_FOUNDER" : "UNEXPECTED",
      { snapshot: s, invariants: invariants(s),
        nonVacuous: {
          physicalResidence: s.residentialPeople, physicallyAway: s.physicallyAwayPeople,
          labourCommitment: s.committedAwayWorkers, preparedCommitment: s.preparedCommitmentPeople,
        },
        threeDistinctFacts: {
          physicalResidence: "all 22 people are standing at the camp; the party has not departed",
          labourCommitment: "6 of them have promised their hands to this party, so no other party or task group may staff them",
          foundingAvailability: "those 6 are withheld from founding a daughter as a PRIOR LABOUR COMMITMENT — a named policy, not a claim that they are elsewhere",
        } });
  }

  // ── H7 / H8 fission founder availability ────────────────────────────────────────────────────
  // Production: daughter = min(getDaughterPopulation(totalPopulation),
  //                            population - physicallyAwayPeople - preparedCommitmentPeople),
  // blocked below DAUGHTER_MIN_POPULATION. Split fraction 0.34 is the ordinary scale class
  // (demography.ts getDaughterPopulation); reproduced here, not called (module-private).
  const draw = (population, physicallyAway, preparedCommitted) => {
    const uncapped = Math.round(population * 0.34);
    const residentialPhysical = Math.max(0, population - physicallyAway);
    const available = Math.max(0, residentialPhysical - preparedCommitted);
    const capped = Math.min(uncapped, available);
    return { uncapped, residentialPhysical, preparedCommitted, available, capped, blocked: capped < DAUGHTER_MIN_POPULATION };
  };
  {
    const d = draw(60, 48, 0);
    add("H7_fission_with_an_away_party",
      d.blocked && d.uncapped >= DAUGHTER_MIN_POPULATION && d.residentialPhysical === 12
        ? "FOUNDERS_ONLY_FROM_PHYSICALLY_RESIDENTIAL_PEOPLE" : "UNEXPECTED",
      { population: 60, physicallyAwayPeople: 48, ...d,
        nonVacuous: { uncappedDrawWouldHaveBeen: d.uncapped, physicallyAtCamp: d.residentialPhysical },
        awayUnchanged: "createDaughterBand reads the away headcount and never writes to an expedition; the party's headcount and productive labour are untouched by a blocked or an allowed fission alike",
        note: "the parent is numerically large and physically thin at home. The daughter is not founded rather than borrowing bodies standing on an expedition route." });
  }
  {
    // Same 48 people committed, but PREPARED: every one of them is standing in the camp.
    const d = draw(60, 0, 48);
    const asIfAway = draw(60, 48, 0);
    add("H8_fission_with_a_prepared_party",
      d.blocked && d.residentialPhysical === 60 && d.available === 12 && d.capped === asIfAway.capped
        ? "PREPARED_WITHHELD_AS_LABOR_COMMITMENT_NOT_CLASSIFIED_AS_ABSENT" : "UNEXPECTED",
      { population: 60, preparedCommitmentPeople: 48, ...d,
        nonVacuous: {
          residentialPhysicalHeadcount: d.residentialPhysical,
          foundersActuallyAvailable: d.available,
          sameOutcomeAsIfAway: d.capped === asIfAway.capped,
        },
        policy:
          "SELECTED POLICY: a prepared commitment blocks founding as a PRIOR LABOUR COMMITMENT. The two alternatives §8 permits — cancelling the party before founding, or another justified rule — both require a fission that can take decisions about parties, which is Roadmap Item 4. Nothing here cancels a party as a side effect of a demographic step.",
        distinction:
          "The founding outcome is numerically the same as H7, and the REASON is not: in H7 the 48 are not here, in H8 they are here and spoken for. Physical residence reads 60, not 12.",
      });
  }

  // ── H9 catchment after a cohort transition ──────────────────────────────────────────────────
  {
    // getBandForagingDraw is module-private; its published arithmetic is reproduced and labelled.
    const b = rec(mk(5, 7, 8, [party()]));
    const e = b.expeditions[0];
    const awayWorkers = mobility.partyCompositionTotal(mobility.deriveCommittedMobilityPools(b));
    const awayNonWorking = Math.max(0, e.nonWorkingPartyPeople ?? 0);
    const adults = Math.max(0, b.demography.workingAdults - awayWorkers);
    const elders = Math.max(0, b.demography.elders - awayNonWorking);
    const dependents = Math.max(0, b.demography.dependents);
    const localBodies = adults + elders + dependents;
    const s = snap(b);
    add("H9_catchment_after_cohort_transition",
      adults === 0 && elders === 6 && dependents === 8 &&
      localBodies === s.population - s.awayPeople &&
      awayWorkers + awayNonWorking === s.awayPeople
        ? "NO_AWAY_PERSON_DRAWS_LOCALLY_AND_NO_COHORT_IS_SUBTRACTED_TWICE" : "UNEXPECTED",
      { awayWorkers, awayNonWorking, catchmentAdults: adults, catchmentElders: elders, catchmentDependents: dependents,
        localExtractionBodies: localBodies, residentialPhysicalPeople: s.population - s.awayPeople,
        foragingDraw: Number(Math.max(1, adults * 1.0 + dependents * 0.65 + elders * 0.85).toFixed(4)),
        nonVacuous: { eldersBefore: b.demography.elders, eldersCounted: elders, subtracted: awayNonWorking },
        privateReader: "sharedCatchment.getBandForagingDraw — module-private; arithmetic published in its own comment block and reproduced here",
        allocation: "the away non-working person is removed from ELDERS by the stated aggregate convention (the only cohort the annual step can move an adult into), and is READ from the record rather than inferred from a cohort comparison" });
  }

  // ── H10 return after labour reduction ───────────────────────────────────────────────────────
  {
    const reduced = rec(mk(5, 7, 8, [party()]));
    const beforeReturn = snap(reduced);
    const returned = returnHome(reduced, "e:h");
    const afterReturn = snap(returned);
    // Reconciling the returned band again must be a no-op: the body came home exactly once.
    const twice = snap(rec(returned));
    const outcome = (returned.recentExpeditionOutcomes ?? []).find((o) => o.id === "e:h");
    add("H10_return_after_labor_reduction",
      afterReturn.represented === 20 && afterReturn.residentialPeople === 20 && afterReturn.awayPeople === 0 &&
      afterReturn.population === beforeReturn.population &&
      afterReturn.elders === beforeReturn.elders && afterReturn.workingAdults === beforeReturn.workingAdults &&
      JSON.stringify(twice) === JSON.stringify(afterReturn) && allHold(afterReturn) &&
      outcome?.partyPeople === 6 && outcome?.partyWorkers === 5
        ? "HEADCOUNT_RETURNS_EXACTLY_ONCE_NO_COHORT_CREATED_OR_DELETED" : "UNEXPECTED",
      { beforeReturn, afterReturn, invariants: invariants(afterReturn),
        nonVacuous: {
          awayBefore: beforeReturn.awayPeople, awayAfter: afterReturn.awayPeople,
          residentialBefore: beforeReturn.residentialPeople, residentialAfter: afterReturn.residentialPeople,
          cohortsUnchanged: `${beforeReturn.workingAdults}/${beforeReturn.elders}/${beforeReturn.dependents} -> ${afterReturn.workingAdults}/${afterReturn.elders}/${afterReturn.dependents}`,
          idempotentOnRepeatedReconciliation: JSON.stringify(twice) === JSON.stringify(afterReturn),
          outcomeRecordsBodiesAndLabourSeparately: `${outcome?.partyPeople} people, ${outcome?.partyWorkers} working`,
        },
        note: "the reduced worker and the non-working member both walk home inside the same six bodies; the elder cohort keeps the transition it was given and no cohort is reconciled twice" });
  }

  // ── H11 corrupt legacy state ────────────────────────────────────────────────────────────────
  {
    const legacy = mk(4, 4, 4, [party({ partyWorkers: 20 })]);   // population 12, party of 20
    const a = rec(legacy), b = rec(legacy);
    const s = snap(a);
    const e = a.expeditions[0];
    const narrated = e.outcomeReason === "invalid_state_repaired";
    add("H11_corrupt_legacy_state",
      s.represented === s.population && s.awayPeople === 0 && s.conserved &&
      e.phase === "aborted" && narrated && e.partyWorkers === 0 && (e.nonWorkingPartyPeople ?? 0) === 0 &&
      JSON.stringify(snap(a)) === JSON.stringify(snap(b)) && allHold(s)
        ? "LABELLED_NON_HISTORICAL_REPAIR_NO_SILENT_DELETION" : "UNEXPECTED",
      { after: s, partyPhase: e.phase, outcomeReason: e.outcomeReason ?? null,
        deterministicAcrossRepeatedCalls: JSON.stringify(snap(a)) === JSON.stringify(snap(b)),
        nonVacuous: { populationHeld: 12, partyClaimed: 20, retiredWhole: e.partyWorkers === 0 },
        whatTheMechanismDoes:
          "The record described 20 people away from a band of 12, which no ordinary path can produce once fission is bounded by residential availability and cohort transitions no longer move bodies. The record is RETIRED WHOLE under `invalid_state_repaired`, and `bandEvents` refuses to narrate that reason at all — no journey, no loss, no homecoming.",
        whatItIsNot:
          "not a death, not a return, not a party-local loss, not a historical outcome. CORRECTION-34C partially shrank such a party to 3 workers with `outcomeReason: null` while it stayed `operating`, which deleted people and then presented the survivors as an ongoing journey.",
      });
  }

  // ── H12 active annual-boundary equivalence ──────────────────────────────────────────────────
  {
    // The old L12 stepped a natural world and merely COUNTED expedition records found at the end.
    // Natural parties last at most 24 days against ANNUAL demography, so a record existing after
    // 1260 days proves nothing about a party that was ACTIVE while the boundary was crossed. This
    // fixture instead INJECTS a party immediately before a spring demography run and confirms it
    // is still represented immediately after, in all four step modes.
    const MODE_DAYS = { daily: 1, weekly: 7, monthly: 30, seasonal: 90 };
    // The setup walk is IDENTICAL in all four arms (`advanceWorldByDays` is the daily kernel every
    // mode routes through), so it introduces no mode difference and does not need to sit on the
    // mode grid. Only the COMPARED span must, and 630 is the LCM of 1/7/30/90.
    //
    // Annual demography runs at each spring season boundary — days 360, 720, 1080, ... — and a
    // party lives at most EXPEDITION_MAX_DURATION_DAYS = 24 days.
    //
    // AN INSTRUMENT ERROR IS RECORDED HERE. The first version injected at day 1070, ten days
    // before the boundary, and PASSED — but it only checked that a party existed at injection and
    // resolved by the end of the span. Adding a direct measurement of the party's phase ON the
    // demography day showed 0 parties still walking: an `operating` party one tile out finishes
    // its three work days and walks home in roughly five, so it was already terminal at day 1080
    // and the fixture had been claiming a boundary crossing that never happened.
    //
    // The party is now injected TWO DAYS before the boundary, `outbound` along a multi-tile route
    // so it is still walking out when demography runs, and the fixture asserts the measured phase
    // rather than inferring it.
    const SETUP_DAYS = 1078;
    const SPAN = 630;                      // crosses the boundaries at 1080 and 1440
    const canon = (w) => JSON.stringify(Object.values(w.bands)
      .sort((x, y) => String(x.id).localeCompare(String(y.id)))
      .map((b) => ({
        id: String(b.id), pos: String(b.position), pop: b.demography?.population,
        wa: b.demography?.workingAdults, el: b.demography?.elders, dep: b.demography?.dependents,
        exp: (b.expeditions ?? []).map((e) =>
          `${e.phase}:${e.partyWorkers}:${e.nonWorkingPartyPeople ?? 0}:${String(e.positionTileId ?? "")}`),
      })));
    const results = {};
    const activeAcrossBoundary = {};
    for (const [mode, days] of Object.entries(MODE_DAYS)) {
      let w = runner.initSimWorld({ kind: "map2" }, "audit27:natural:map2:s1");
      w = advance.advanceWorldByDays(w, SETUP_DAYS);
      // Inject an identical operating party into every living band, deterministically.
      const injected = {};
      for (const [id, b] of Object.entries(w.bands)) {
        if (b.status === "dispersed" || b.viability?.status === "absorbed" || b.viability?.status === "extinct") {
          injected[id] = b; continue;
        }
        // A route long enough that the party is still walking OUT when demography runs. Built by
        // walking distinct neighbours deterministically from the band's own tile.
        const route = [b.position];
        while (route.length < 8) {
          const next = (w.tiles[route[route.length - 1]]?.neighbors ?? [])
            .filter((t) => !route.includes(t))
            .sort((x, y) => String(x).localeCompare(String(y)))[0];
          if (next === undefined) break;
          route.push(next);
        }
        if (route.length < 3) { injected[id] = b; continue; }
        injected[id] = {
          ...b,
          expeditions: [...(b.expeditions ?? []), {
            id: `expedition:h12:${String(b.id)}`, phase: "outbound", partyWorkers: 2,
            partyComposition: { limited: 0, typical: 2, high: 0 },
            positionTileId: route[1], routeTileIds: route, routeIndex: 1,
            targetTileId: route[route.length - 1], taskKind: "resource_retrieval", injuryLoad: 0,
            travelDaysElapsed: 1, workDaysElapsed: 0,
            departedDay: w.time.day, departedTick: w.time.tick,
            plannedReturnDay: (Number(w.time.day) + 200), hardDeadlineDay: (Number(w.time.day) + 400),
            cargo: { harvestUnits: 0, carryCapacityUnits: 0.24, provisionUnitsConsumed: 0, lostUnits: 0 },
            riskEpisodeIds: [], carriedObservations: [], reasonIds: [],
            noResidentialRelocation: true,
          }],
        };
      }
      w = { ...w, bands: injected };
      const injectedCount = Object.values(w.bands)
        .reduce((n, b) => n + (b.expeditions ?? []).filter((e) => String(e.id).includes("h12")).length, 0);
      const dayAtInjection = Number(w.time.day);
      // NON-VACUITY, MEASURED RATHER THAN ASSUMED. Existing at injection and resolving later does
      // NOT establish that a party was still walking when demography ran. The daily arm therefore
      // steps one day at a time and records the injected party's phase on the day BEFORE the
      // season turns to spring and on the transition day ITSELF. The coarser modes cannot be
      // sampled mid-span by construction — that is what a step mode IS — so the daily arm carries
      // the non-vacuity proof and the four-way comparison carries the equivalence proof.
      let activeImmediatelyBefore = 0;
      let activeImmediatelyAfter = 0;
      let boundaryDay = null;
      const countInjectedAway = (x) => Object.values(x.bands).reduce((n, b) =>
        n + (b.expeditions ?? []).filter((e) =>
          String(e.id).includes("h12") &&
          ["outbound", "operating", "returning"].includes(e.phase)).length, 0);

      if (mode === "daily") {
        for (let step = 0; step < SPAN; step += 1) {
          const seasonBefore = w.time.season;
          const awayBefore = countInjectedAway(w);
          w = runner.stepSim(w, 1, mode);
          if (seasonBefore !== "spring" && w.time.season === "spring" && boundaryDay === null) {
            boundaryDay = Number(w.time.day);
            activeImmediatelyBefore = awayBefore;
            activeImmediatelyAfter = countInjectedAway(w);
          }
        }
      } else {
        w = runner.stepSim(w, SPAN / days, mode);
      }
      const survivingCount = Object.values(w.bands)
        .reduce((n, b) => n + (b.expeditions ?? []).filter((e) => String(e.id).includes("h12")).length, 0);
      const outcomeCount = Object.values(w.bands)
        .reduce((n, b) => n + (b.recentExpeditionOutcomes ?? []).filter((o) => String(o.id).includes("h12")).length, 0);
      results[mode] = canon(w);
      activeAcrossBoundary[mode] = {
        dayAtInjection, daysToNextAnnualBoundary: 1080 - dayAtInjection, routeTiles: 8,
        injectedParties: injectedCount, stillOnRecord: survivingCount, resolvedToOutcome: outcomeCount,
        ...(mode === "daily"
          ? {
              annualBoundaryDay: boundaryDay,
              injectedPartiesStillWalkingTheDayBeforeDemography: activeImmediatelyBefore,
              injectedPartiesStillWalkingOnTheDemographyDay: activeImmediatelyAfter,
            }
          : { sampledMidSpan: false, reason: "a coarser step mode cannot be sampled between its own steps" }),
      };
    }
    const allMatch = Object.values(results).every((v) => v === results.daily);
    const d = activeAcrossBoundary.daily;
    // The fixture may only claim the boundary was crossed BY AN ACTIVE PARTY if a party was
    // measured still walking on both sides of the demographic step.
    const genuinelyActiveAcrossBoundary =
      d.injectedPartiesStillWalkingTheDayBeforeDemography > 0 &&
      d.injectedPartiesStillWalkingOnTheDemographyDay > 0;
    const representedThroughout = Object.values(activeAcrossBoundary).every(
      (v) => v.injectedParties > 0 && (v.stillOnRecord + v.resolvedToOutcome) > 0);
    add("H12_active_annual_boundary_equivalence",
      allMatch && representedThroughout && genuinelyActiveAcrossBoundary
        ? "IDENTICAL_ACROSS_ALL_FOUR_MODES_WITH_AN_ACTIVE_PARTY"
        : allMatch ? "IDENTICAL_BUT_NO_ACTIVE_PARTY_CROSSED_THE_BOUNDARY" : "DIVERGENT",
      { setupDaysBeforeInjection: SETUP_DAYS, comparedSpanDays: SPAN,
        annualBoundariesInsideComparedSpan: [1080, 1440],
        boundaryCrossedWhileTheInjectedPartyWasWalking: 1080,
        activeAcrossBoundary,
        matches: Object.fromEntries(Object.keys(MODE_DAYS).map((m) => [m, results[m] === results.daily])),
        nonVacuous: {
          ...activeAcrossBoundary.daily,
          partyMeasuredWalkingOnBothSidesOfDemography: genuinelyActiveAcrossBoundary,
        },
        instrumentErrorRecorded:
          "The first version of this fixture stepped the SETUP span with `stepSim(w, 1080/days, mode)`. 1080/7 is 154.29, so the weekly arm was handed a fractional step count and landed on a different day from the other three — it reported DIVERGENT, and the divergence was the audit's own arithmetic, not production. The setup now runs through `advanceWorldByDays` (identical in every arm) and only the compared span sits on the 630-day grid.",
        whyTheOldFixtureWasInsufficient:
          "L12 stepped a natural world 1260 days and counted expedition records at the end. A natural party lasts at most 24 days against ANNUAL demography, so any record it found had been launched long after the last boundary. It proved step-mode determinism, which is real, but not that an ACTIVE party is represented identically across a demographic boundary — which is the property this checkpoint changes.",
      });
  }

  // ── H13 no natural overlap control ──────────────────────────────────────────────────────────
  {
    let w = runner.initSimWorld({ kind: "map2" }, "audit27:natural:map2:s1");
    let naturalActiveAtBoundary = 0;
    let boundariesObserved = 0;
    let partyDaysObserved = 0;
    // The boundary is detected as the SEASON TRANSITION INTO SPRING, which is the condition
    // `shouldRunAnnualDemography` itself tests — not an assumed day number. An earlier version of
    // this fixture stepped 359 days and then one more, assuming the boundary sat at day 360k, and
    // reported zero while a daily season-transition probe over the same world reported crossings.
    const activeParties = (x) => Object.values(x.bands)
      .reduce((n, b) => n + (b.expeditions ?? []).filter((e) =>
        ["outbound", "operating", "returning"].includes(e.phase)).length, 0);
    for (let day = 0; day < 20 * 360; day += 1) {
      const before = w.time.season;
      const activeBefore = activeParties(w);
      w = runner.stepSim(w, 1, "daily");
      if (before !== "spring" && w.time.season === "spring") {
        boundariesObserved += 1;
        const activeAfter = activeParties(w);
        partyDaysObserved += activeBefore + activeAfter;
        if (activeBefore > 0 || activeAfter > 0) naturalActiveAtBoundary += 1;
      }
    }
    add("H13_no_natural_overlap_control",
      naturalActiveAtBoundary === 0
        ? "NATURAL_ZERO_REPORTED_NOT_SUBSTITUTED"
        : "NATURAL_FREQUENCY_REPORTED_NOT_SUBSTITUTED",
      { boundariesObserved, naturalBoundariesCrossedByAnActiveParty: naturalActiveAtBoundary,
        partyRecordsSeenAtSampledBoundaries: partyDaysObserved,
        nonVacuous: { boundariesObserved, sampledDaily: true, horizonYears: 20 },
        correctsAPriorClaim:
          "CORRECTION-34C reported `0 annual boundaries crossed by active parties` at 20 and 50 years. Sampled DAILY on the season transition into spring — the condition `shouldRunAnnualDemography` itself tests — the figure is not zero. The prior zero is best explained by the instrument artefact CORRECTION-34A already identified once: a season-boundary sample cannot see a party, because presence is a daily fact.",
        denominatorNote:
          "Counted over the SAME 20-year horizon as the natural sweep so the two numbers are comparable. This counts WORLD boundaries (one per year); the natural sweep counts BAND-days, so its figure is larger by construction and the two are not in conflict.",
        statement:
          naturalActiveAtBoundary === 0
            ? "ZERO natural overlap in the sampled window. This is REPORTED, and it is explicitly NOT evidence that the behaviour is correct — a party lives at most 24 days against an annual step, so the overlap is structurally rare. H12 constructs the case; this fixture only measures how often nature reaches it."
            : `${naturalActiveAtBoundary} of ${boundariesObserved} annual boundaries were crossed with a party active. This is a FREQUENCY, not a proof: an overlap occurring says nothing about whether the reduction path is correct, because these worlds never drive a cohort below a committed party. H12 constructs that case deterministically and is the proof.`,
      });
  }

  // ── H14 legacy record migration ─────────────────────────────────────────────────────────────
  {
    // A record written before this checkpoint: `partyWorkers` present, `nonWorkingPartyPeople`
    // absent, and — the harder case — `partyComposition` absent too (the pre-EXPEDITIONARY-4 shape
    // `deriveCommittedMobilityPools` still has a fallback for).
    const legacyFull = mk(12, 4, 6, [party({ partyWorkers: 4, partyComposition: undefined, nonWorkingPartyPeople: undefined })]);
    const s = snap(rec(legacyFull));
    const p = s.parties[0];
    const legacyPools = mobility.deriveCommittedMobilityPools(legacyFull);
    // The same record under a cohort fall, to prove the upgrade is conservative rather than lossy.
    const legacyStressed = mk(3, 10, 9, [party({ partyWorkers: 4, partyComposition: undefined, nonWorkingPartyPeople: undefined })]);
    const t = snap(rec(legacyStressed));
    const q = t.parties[0];
    add("H14_legacy_record_migration",
      p.people === 4 && p.workers === 4 && p.nonWorking === 0 && s.awayPeople === 4 &&
      mobility.partyCompositionTotal(legacyPools) === 4 &&
      q.people === 4 && q.workers === 3 && q.nonWorking === 1 && t.awayPeople === 4 &&
      allHold(s) && allHold(t)
        ? "UPGRADED_DETERMINISTICALLY_AND_CONSERVATIVELY" : "UNEXPECTED",
      { untouchedLegacy: s, legacyUnderCohortFall: t,
        invariants: { untouched: invariants(s), stressed: invariants(t) },
        nonVacuous: {
          absentFieldReadsAsZero: p.nonWorking === 0,
          headcountEqualsLabourOnUntouchedLegacy: p.people === p.workers,
          legacyCompositionFallbackTotal: mobility.partyCompositionTotal(legacyPools),
          underCohortFall: `${q.workers} working + ${q.nonWorking} not = ${q.people} bodies`,
        },
        rule:
          "An absent `nonWorkingPartyPeople` reads as ZERO, which is exactly what every pre-split record meant: headcount and labour were equal at launch and nothing could separate them. No record is reinterpreted, no body is invented, and a legacy party with no composition at all still reconciles — its workers fall to 3 and the fourth body stays with it.",
      });
  }

  const verdicts = Object.fromEntries(Object.entries(fixtures).map(([k, v]) => [k, v.verdict]));
  const bad = Object.entries(verdicts).filter(([, v]) =>
    String(v).startsWith("UNEXPECTED") || v === "DIVERGENT" ||
    v === "IDENTICAL_BUT_NO_ACTIVE_PARTY_CROSSED_THE_BOUNDARY");

  out = {
    audit: "CORRECTION-34D-HEADCOUNT-LABOR-FIXTURES",
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
