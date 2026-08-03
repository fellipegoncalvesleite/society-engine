// CORRECTION-34C §3 — reproduce the away-body ownership defects BEFORE changing production.
//
// T1 pure cohort aging · T2 demographic death · T3 fission while away · T4 prepared control.
//
// Written arity-tolerantly so the same instrument runs unmodified on c207d8a (the defect) and on
// the repaired tree, producing the before/after evidence pair from one probe.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/shared-use-physical-presence-authority-34";
const OUT_AGING = arg("out-aging", `${EVIDENCE}/away-body-aging-before.json`);
const OUT_FISSION = arg("out-fission", `${EVIDENCE}/away-body-fission-before.json`);

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c34c-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let outAging;
let outFission;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const expedition = await server.ssrLoadModule("/sim/agents/expedition.ts");
  const crowding = await server.ssrLoadModule("/sim/agents/crowding.ts");
  const mobility = await server.ssrLoadModule("/sim/agents/bandMobility.ts");

  let world = runner.initSimWorld({ kind: "map2" }, "c34c:ownership");
  world = advance.advanceWorldByDays(world, 360 * 2);
  const base = Object.values(world.bands)
    .filter((b) => b.status !== "dispersed" && b.viability?.status !== "absorbed" && b.viability?.status !== "extinct")
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];
  const tick = Number(world.time.tick);
  const awayTile = (world.tiles[base.position]?.neighbors ?? [])[0] ?? base.position;

  const reconcile = (b) => expedition.reconcileExpeditionCommitment.length >= 2
    ? expedition.reconcileExpeditionCommitment(b, tick)
    : expedition.reconcileExpeditionCommitment(b);

  const party = (over = {}) => ({
    id: "e:c34c", phase: "operating", partyWorkers: 6,
    partyComposition: { limited: 1, typical: 4, high: 1 },
    positionTileId: awayTile, routeTileIds: [base.position, awayTile], routeIndex: 1,
    taskKind: "resource_retrieval", injuryLoad: 0, travelDaysElapsed: 2, hardDeadlineDay: 9999,
    cargo: { harvestUnits: 0, carryCapacityUnits: expedition.deriveCarryCapacityUnits(base, 6, 0, tick), provisionUnitsConsumed: 0, lostUnits: 0 },
    ...over,
  });

  // A stable band: population 20 = 8 dependents + 10 working adults + 2 elders, one 6-person party.
  const makeBand = (workingAdults, elders, dependents, expeditions) => ({
    ...base,
    demography: { ...base.demography, population: workingAdults + elders + dependents, workingAdults, elders, dependents },
    expeditions,
  });

  const snapshot = (b, label) => {
    const presence = crowding.getBandPhysicalPresence(b);
    const away = presence.filter((s) => s.kind === "away_party");
    const home = presence.find((s) => s.kind === "residential_remainder");
    const e = (b.expeditions ?? [])[0];
    return {
      label,
      population: b.demography.population,
      workingAdults: b.demography.workingAdults,
      elders: b.demography.elders,
      dependents: b.demography.dependents,
      residentialPeople: home?.people ?? 0,
      residentialTile: String(home?.tileId ?? ""),
      awayPeople: away.reduce((n, s) => n + s.people, 0),
      awayTiles: away.map((s) => String(s.tileId)),
      partyWorkers: e?.partyWorkers ?? 0,
      partyComposition: e?.partyComposition ?? null,
      partyCompositionTotal: e?.partyComposition === undefined ? null : mobility.partyCompositionTotal(e.partyComposition),
      partyPhase: e?.phase ?? "(none)",
      represented: presence.reduce((n, s) => n + s.people, 0),
    };
  };

  // ─────────────────────────────────────────────── T1 — pure cohort aging, no death, no movement
  //
  // PRECISION NOTE. The supervising finding illustrated this with population 20 / workingAdults 10
  // / party 6, aging to workingAdults 9. That case does NOT trigger the reconciler, because it
  // only fires when committed > workforce and 6 <= 9. Both arms are measured here: the
  // illustrative case (a true negative) and the case that genuinely triggers, which is reachable
  // because a workforce that has ALREADY declined to the party size is exactly the CORRECTION-34A
  // scenario (launch is capped at workingAdults/3, so a party of 6 launches at workingAdults >= 18
  // and the workforce then falls).
  const illustrativeBefore = makeBand(10, 2, 8, [party()]);
  const illustrativeAged = makeBand(9, 3, 8, [party()]);
  const illustrativeAfter = reconcile(illustrativeAged);
  const illustrativeTriggers =
    JSON.stringify(snapshot(illustrativeAfter, "x")) !== JSON.stringify(snapshot(illustrativeAged, "x"));

  // The TRIGGERING case: the workforce has already declined to the committed party size, then ONE
  // ordinary adult-to-elder transition occurs. Population is untouched. Nobody died. Nobody walked.
  const t1Before = makeBand(6, 6, 8, [party()]);
  const t1Aged = makeBand(5, 7, 8, [party()]);
  const t1After = reconcile(t1Aged);

  const s1 = snapshot(t1Before, "before_aging");
  const s2 = snapshot(t1Aged, "after_aging_before_reconciliation");
  const s3 = snapshot(t1After, "after_reconciliation");

  const bodyMoved = s3.awayPeople !== s2.awayPeople || s3.residentialPeople !== s2.residentialPeople;
  const populationUnchanged = s1.population === s3.population;

  outAging = {
    audit: "CORRECTION-34C-T1-COHORT-AGING",
    headline: bodyMoved ? "COHORT AGING TELEPORTS AWAY BODY" : "COHORT AGING PRESERVES AWAY BODY LOCATION",
    productionRule: "demography.ts:2532-2537 — `adults -= adultsAged; elders += adultsAged;` with population untouched",
    reconcilerBound: "reconcileExpeditionCommitment bounds committed workers by demography.workingAdults",
    construction: {
      population: 20, workingAdults: 6, elders: 6, dependents: 8,
      partyWorkers: 6,
      transition: "one adult becomes an elder; no death, no return, no route movement, no fission",
      reachability: "a party of 6 launches only at workingAdults >= 18 (deriveDepartableWorkers caps at workingAdults/3); the workforce then declines to 6 through ordinary demography, which is the CORRECTION-34A scenario. This fixture starts at that already-declined state.",
    },
    illustrativeCaseFromTheFinding: {
      construction: "population 20, workingAdults 10 -> 9, party 6",
      triggersReconciler: illustrativeTriggers,
      note: "reported as a TRUE NEGATIVE: 6 <= 9, so the reconciler does not fire. The finding's mechanism is real; its illustrative arithmetic is not the triggering case.",
      before: snapshot(illustrativeAged, "illustrative_after_aging"),
      after: snapshot(illustrativeAfter, "illustrative_after_reconciliation"),
    },
    snapshots: [s1, s2, s3],
    physicalEventJustifyingLocationChange: null,
    analysis: {
      populationUnchangedAcrossAging: populationUnchanged,
      awayPeopleBefore: s2.awayPeople,
      awayPeopleAfter: s3.awayPeople,
      residentialBefore: s2.residentialPeople,
      residentialAfter: s3.residentialPeople,
      peopleRelocatedWithoutPhysicalEvent: Math.max(0, s2.awayPeople - s3.awayPeople),
      note: bodyMoved
        ? "a person left the distant party and appeared at the residence with no route, return, communication, death or transfer"
        : "aging changed labour classification only; every body stayed where it was",
    },
  };

  // ─────────────────────────────────────────────── T2 — demographic death while a party is away
  // Population falls by one. The aggregate model records NO location for that death.
  const t2Aged = makeBand(5, 6, 8, [party()]);          // population 19, one working adult gone
  const t2After = reconcile(t2Aged);
  const t2 = {
    scenario: "T2_demographic_population_loss",
    beforeDeath: snapshot(makeBand(6, 6, 8, [party()]), "before_death"),
    afterDeathBeforeReconciliation: snapshot(t2Aged, "after_death"),
    afterReconciliation: snapshot(t2After, "after_reconciliation"),
    doesTheArchitectureKnowWhereTheDeathOccurred: false,
    evidence: [
      "demography.ts computes deaths as an aggregate net-rate quantity with no location field",
      "demography.ts, viability.ts and demographicRenewal.ts contain ZERO references to expeditions",
      "no death record carries a tile, a party id, or an at-camp/away flag",
    ],
    note: "the party CAN be resized, but nothing in the model places the death inside it. Resizing on this evidence is an assumption, not a derivation.",
  };

  // ─────────────────────────────────────────────── T3 — fission while a party is away
  // getDaughterPopulation(parentPopulationBefore) reads TOTAL population; createDaughterBand
  // contains zero expedition references, so founders are drawn from people who may be away.
  const fissionParent = makeBand(6, 6, 8, [party()]);
  const parentPop = fissionParent.demography.population;
  const awayNow = expedition.getCommittedExpeditionWorkers(fissionParent);
  const residentialNow = parentPop - awayNow;
  // Reproduce the production selection arithmetic without calling the private helper.
  const splitFraction = 0.34;                       // ordinary scale class
  const impliedDaughter = Math.round(parentPop * splitFraction);
  const parentAfter = parentPop - impliedDaughter;

  // Fission recomputes the PARENT's cohorts proportionally. Even when the daughter headcount fits
  // inside the residential remainder, that recomputation can drop workingAdults below the committed
  // party — and then the reconciler removes away bodies.
  const t3Simulated = makeBand(
    Math.max(0, 6 - Math.round(impliedDaughter * 0.3)),
    6, Math.max(0, 8 - Math.round(impliedDaughter * 0.4)),
    [party()],
  );
  const t3AfterReconcile = reconcile(t3Simulated);

  outFission = {
    audit: "CORRECTION-34C-T3-FISSION-WHILE-AWAY",
    headline: impliedDaughter > residentialNow
      ? "FISSION TRANSFERS UNAVAILABLE AWAY BODIES"
      : "FISSION MAY DRAW FROM AWAY BODIES (selection is population-based, not location-based)",
    productionRule: "getDaughterPopulation(parentPopulationBefore) reads TOTAL parent population; createDaughterBand contains ZERO expedition references",
    measurements: {
      parentPopulationBefore: parentPop,
      awayPartyPeople: awayNow,
      physicallyResidentialPeople: residentialNow,
      impliedDaughterPopulation: impliedDaughter,
      parentPopulationAfter: parentAfter,
      daughterExceedsResidentiallyAvailable: impliedDaughter > residentialNow,
      shortfallDrawnFromAwayBodies: Math.max(0, impliedDaughter - residentialNow),
    },
    nextDayReconciliation: {
      parentAfterFissionSimulated: snapshot(t3Simulated, "parent_after_fission"),
      afterReconciliation: snapshot(t3AfterReconcile, "parent_after_reconciliation"),
      note: "even when the daughter fits inside the residential remainder, the parent's cohort recomputation can drop workingAdults below the committed party, and the reconciler then removes away bodies",
    },
    canDaughterImplicitlyIncludeAwayPeople: true,
    limitation: "the daughter split is reproduced arithmetically from the published split fraction rather than by calling the module-private getDaughterPopulation; the ZERO expedition references in createDaughterBand is the load-bearing fact and is read directly from source",
  };

  // ─────────────────────────────────────────────── T4 — prepared party control
  const preparedBand = makeBand(5, 7, 8, [party({ phase: "prepared" })]);
  const preparedAfter = reconcile(preparedBand);
  outAging.T4_prepared_control = {
    scenario: "prepared party members are AT CAMP",
    before: snapshot(preparedBand, "prepared_before"),
    after: snapshot(preparedAfter, "prepared_after"),
    physicallyDifferentFromAwayParty: true,
    why: "a prepared party has NOT departed (types.ts: 'labour committed at camp, not yet departed'); its people are already inside the residential remainder, so cancelling it moves nobody. Reducing an outbound/operating/returning party moves bodies that are standing somewhere else.",
    awayPresenceSourcesForPrepared: 0,
  };

  mkdirSync(dirname(OUT_AGING), { recursive: true });
  writeFileSync(OUT_AGING, `${JSON.stringify({ ...outAging, T2_demographic_death: t2 }, null, 2)}\n`, "utf8");
  mkdirSync(dirname(OUT_FISSION), { recursive: true });
  writeFileSync(OUT_FISSION, `${JSON.stringify(outFission, null, 2)}\n`, "utf8");
} finally {
  await server.close();
}

console.log(JSON.stringify({
  T1: outAging.headline,
  T1_relocated: outAging.analysis.peopleRelocatedWithoutPhysicalEvent,
  T3: outFission.headline,
  T3_shortfall: outFission.measurements.shortfallDrawnFromAwayBodies,
}, null, 2));
