// ROADMAP ITEM 4 §3 — THE PROVISIONAL QUARANTINE CONTRACT, WITH THE CONTROL INSIDE THE EXPERIMENT.
//
// The previous admission audit compared the successor against an UNRELATED ordinary band. That is a
// weak control: the two bands differ in position, size, knowledge and history, so "the control moved
// and the successor did not" leaves open that the successor would not have moved anyway.
//
// This audit uses a WITH-MINUS-WITHOUT counterfactual instead — the same instrument CORRECTION-31
// used for social evidence. Two worlds are built from the SAME departure:
//
//   QUARANTINED — exactly what the seam produced;
//   RELEASED    — byte-identical except that the successor's `provisionalSuccessor` record is
//                 removed, which is the ONLY thing every gate reads.
//
// Both advance the same number of days from the same state. A field that moves in RELEASED and not
// in QUARANTINED was blocked BY THE GATE, on this band, on this day — which is a positive control, not
// an absence. A field that moves in NEITHER is reported as such and claims nothing.
//
// It then asks the second half of the contract, which the admission audit never asked at all: WHICH
// BODILY PROCESSES STILL REACH THE GROUP? A quarantine that also stops people ageing, eating, falling
// ill and dying is not a quarantine, it is a freezer — and a group that cannot die cannot fail, which
// is defect 5 restored under a new name.
import { createServer } from "vite";
import { prepareAndDepart, bestKnownTargetAtDistance } from "./lib/preparedDeparture.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/dynamic-fission-daughter-viability-37";
const OUT = arg("out", `${EVIDENCE}/provisional-quarantine-contract.json`);
const SEED = arg("seed", "audit27:natural:s1");
// 2100 rather than 1800, and the reason is a HORIZON ARTEFACT this audit first walked into. At 1800
// the annual demographic step falls on day 360 — ONE DAY AFTER the quarantine ends — so Q4 could
// observe no ageing at all and its claim rested on hunger alone. At 2100 the boundary falls on day 60,
// inside the quarantine, so "bodily processes still reach the group" is measured rather than assumed.
// CORRECTION-34D and -34A both record the same class of error: a cadence sampled outside its period
// reports a structural zero.
// The departure day is CHOSEN so the quarantine window spans the annual demographic boundary at day
// 2160. That matters now and did not before: the old fixture left the successor motionless on its
// parent's tile, so the quarantine lasted 359 days and swallowed a demographic step by accident. A
// real separated successor resolves its lifecycle in roughly twenty-five days, so if the window does
// not cross the boundary, Q4's "demography still reaches a quarantined group" has nothing to observe
// and is honestly VACUOUS. Selecting the day is scenario choice through production; no state is
// manufactured, no phase is assigned, and nothing is held open artificially.
const WARM_DAYS = Number(arg("warm-days", "2150"));
// 400 rather than 200: demography is ANNUAL (360 days), so a shorter window cannot observe a
// quarantined group ageing or dying at all, and Q4 would pass on hunger alone — which would be a
// weak basis for the claim that failure is still possible.
const OBSERVE_DAYS = Number(arg("observe-days", "400"));

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
  cacheDir: `node_modules/.vite-i4quar-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const seam = await server.ssrLoadModule("/sim/agents/fissionDepartureSeam.ts");
  const prep = await server.ssrLoadModule("/sim/agents/fissionDeparturePreparation.ts");
  const kernel = await server.ssrLoadModule("/sim/agents/fissionLifecycleKernel.ts");
  const lc = await server.ssrLoadModule("/sim/agents/bandLifecycle.ts");
  const generate = await server.ssrLoadModule("/sim/world/generate.ts");
  const passability = await server.ssrLoadModule("/sim/world/passability.ts");
  const scoring = await server.ssrLoadModule("/sim/rules/decisionScoring.ts");

  let world = runner.initSimWorld({ kind: "map2" }, SEED);
  world = advance.advanceWorldByDays(world, WARM_DAYS);
  const parent = Object.values(world.bands)
    .filter((b) => lc.isEstablishedBand(b) && b.demography.workingAdults >= 6 && b.demography.population >= 24)
    .sort((a, b) => b.demography.population - a.demography.population)[0];
  if (parent === undefined) throw new Error("no suitable parent band");

  const dayD = Number(world.time.day ?? 0);
  const requested = Math.max(2, Math.floor(parent.demography.population * 0.35));
  // ── FIXTURE REPAIR — A QUARANTINE FIXTURE MUST OBSERVE A REAL PROVISIONAL SUCCESSOR. ──
  //
  // This arm departed to `parent.position`, so the successor was co-located with its living parent
  // from birth. That was inert while nothing could act on co-location; once `provisional_reintegration`
  // was wired into the daily runner the group reached a rejoinable phase on day 1 and was CORRECTLY
  // handed back, collapsing the quarantine window to ZERO days and making five arms vacuous.
  //
  // The contract under test is "while this entity is a live provisional successor, ordinary-band
  // systems must not admit it" — never "the successor must sit motionless on its parent's tile". So
  // the target is a real place at distance and the window is however long the group is genuinely
  // provisional, which is what the window was always supposed to be.
  const quarHome = generate.getTile(world, parent.position);
  // The BEST-KNOWN tile at distance, not the farthest. Sorting by distance picked ground the band had
  // barely seen, and the founder cohort refused it by name (`destination_barely_known`) — a real
  // decision, not a gate to work around, so the fixture asks for a departure a group would take.
  const quarTarget = bestKnownTargetAtDistance(generate, passability, world, parent, 4);
  void quarHome;
  if (quarTarget === undefined) throw new Error("no known passable target at distance >= 4");
  const departure = prepareAndDepart({
    prep, seam, world: world, parentId: parent.id, today: dayD,
    lineageId: "LIN-QUAR-1", requestedFounders: requested, targetTileId: String(quarTarget.id),
    successorBandId: `${parent.id}:provisional:1`,
  }).departure;
  if (departure.ok !== true) throw new Error(`departure refused: ${departure.refusal} ${departure.detail ?? ""}`);
  const succId = String(departure.successorId);

  /** Everything a production path could have moved on this band. */
  const observe = (band) => {
    if (band === undefined) return null;
    return {
      position: String(band.position),
      population: Math.round(band.demography.population),
      workingAdults: band.demography.workingAdults,
      dependents: band.demography.dependents,
      elders: band.demography.elders,
      status: band.status,
      hungerPressure: band.hungerPressure,
      diseaseBurden: band.health?.diseaseBurden ?? null,
      injuryBurden: band.health?.injuryBurden ?? null,
      mortalityRisk: band.health?.mortalityRisk ?? null,
      acuteRisk: band.acuteRisk === undefined ? 0 : 1,
      acuteRiskEpisodes: band.acuteRisk?.recentEpisodes?.length ?? 0,
      deathMemory: band.deathMemory === undefined ? 0 : 1,
      viability: band.viability?.status ?? null,
      decisions: (band.decisionHistory ?? []).length,
      trips: (band.recentIntraSeasonTrips ?? []).length,
      expeditions: (band.expeditions ?? []).length,
      receipts: band.seasonalFoodReceipts === undefined ? 0 : 1,
      moveEvents: (band.recentResidentialMoveEvents ?? []).length,
      protoCamp: band.protoCampMemory === undefined ? 0 : 1,
      residentialAnchor: band.residentialAnchor === undefined ? 0 : 1,
      knownTiles: Object.keys(band.knowledge?.observedTiles ?? {}).length,
      storageCapacity: band.storageCapacity,
      provisionalPhase: band.provisionalSuccessor?.phase ?? null,
      isLivingBand: lc.isLivingBand(band),
      isBandTerminal: lc.isBandTerminal(band),
    };
  };

  // ── the two arms ──
  const quarantinedStart = departure.world;
  const releasedStart = {
    ...departure.world,
    bands: {
      ...departure.world.bands,
      // The ONLY difference between the arms. Every gate in production reads exactly this record, so
      // removing it is precisely "the same band without the quarantine".
      [succId]: { ...departure.world.bands[succId], provisionalSuccessor: undefined },
    },
  };

  // ── AN INSTRUMENT ERROR IN THIS AUDIT'S OWN FIRST FORM IS RECORDED HERE. ────────────────────
  //
  // The first version accumulated changes across a fixed 400-day window and reported trips,
  // receipts, proto-camp memory and knowledge as ADMITTED — a leak, apparently. They were not. The
  // provisional lifecycle RESOLVED mid-window (`travelling` timed out to `returning`, which timed
  // out to the terminal `reintegrated`), and from that day on the band is correctly no longer
  // provisional, so ordinary behaviour resuming is the gates working rather than failing.
  //
  // Measuring a quarantine over days the group was not quarantined would have reported a defect that
  // does not exist. The window is therefore the QUARANTINE ITSELF: both arms observe exactly the
  // days on which the quarantined band is still `isProvisionalSuccessor`, so the comparison is
  // like-for-like and the released arm gets no extra days to move in.
  const runArm = (startWorld, dayBudget, stopWhenNoLongerProvisional) => {
    let w = startWorld;
    const first = observe(w.bands[succId]);
    const changedFields = new Set();
    let previous = first;
    let days = 0;
    for (let day = 0; day < dayBudget; day += 1) {
      w = advance.advanceWorldByDays(w, 1);
      const now = observe(w.bands[succId]);
      if (now === null) break;
      // Tested AFTER the step, not before it. An earlier form tested before, so on the single day the
      // resolver ended the quarantine the loop still recorded that day's diff — and picked up the
      // proto-camp memory the band legitimately acquired once it was no longer provisional. That read
      // as a leak and was not one; the band was ordinary by the time proto-camps ran.
      if (stopWhenNoLongerProvisional && !lc.isProvisionalSuccessor(w.bands[succId])) break;
      days += 1;
      for (const key of Object.keys(now)) {
        if (JSON.stringify(now[key]) !== JSON.stringify(previous[key])) changedFields.add(key);
      }
      previous = now;
    }
    return { first, last: previous, changed: [...changedFields].sort(), world: w, days };
  };

  const quarantined = runArm(quarantinedStart, OBSERVE_DAYS, true);
  // Exactly the same number of days, so a field moving only in RELEASED cannot be an artefact of a
  // longer window.
  const released = runArm(releasedStart, quarantined.days, false);

  const blockedByTheGate = released.changed.filter((f) => !quarantined.changed.includes(f));
  const movedInBoth = released.changed.filter((f) => quarantined.changed.includes(f));
  const movedOnlyWhileQuarantined = quarantined.changed.filter((f) => !released.changed.includes(f));

  // ── Q1 — the ordinary residential systems are blocked, and the block is a REAL refusal ──
  // `position` is deliberately NOT in this list. It was, when a provisional successor had no way to
  // move and any movement therefore had to come from an ordinary residential writer. `provisionalTravel`
  // is now the ONE authority permitted to move a provisional body, and §10 of the quarantine contract
  // is explicit that the boundary is against ORDINARY GROUP BEHAVIOUR, not against being alive and on
  // the move. Provisional movement is asserted separately, as a positive control, in Q3.
  const ORDINARY_RESIDENTIAL = ["decisions", "trips", "moveEvents", "protoCamp", "residentialAnchor", "viability", "expeditions", "receipts"];
  // The three things a LIVE provisional successor's own authorities write: its lifecycle phase
  // (`provisionalLifecycleResolver`), its position (`provisionalTravel`) and its nutritional condition
  // (`provisionalTravelSubsistence`). A quarantine that stopped any of these would be blocking
  // physiology and movement rather than ordinary group behaviour, which §10 forbids.
  const PROVISIONAL_PHYSICAL = ["provisionalPhase", "position", "hungerPressure"];
  const ordinaryAdmitted = ORDINARY_RESIDENTIAL.filter((f) => quarantined.changed.includes(f));
  const ordinaryProvenBlocked = ORDINARY_RESIDENTIAL.filter((f) => blockedByTheGate.includes(f));
  record(
    "Q1_ordinary_residential_systems_are_blocked",
    "no ordinary residential field moves on the quarantined successor across the observed window",
    ordinaryAdmitted.length === 0,
    // Non-vacuity: the RELEASED arm must move at least one of them, or the instrument is dead.
    ordinaryProvenBlocked.length > 0,
    { quarantinedDays: quarantined.days, ordinaryAdmitted, ordinaryProvenBlocked, releasedMoved: released.changed, quarantinedMoved: quarantined.changed },
  );

  // ── Q2 — POSITIVE CONTROL: each block is proven on THIS band, on THESE days ──
  record(
    "Q2_each_block_is_a_positive_control_not_an_absence",
    "removing ONLY the provisional record — changing nothing else about the band, the world, the seed or the days — lets these fields move, so each block is a measured refusal rather than a system that would have done nothing anyway",
    blockedByTheGate.length > 0 && ordinaryAdmitted.length === 0,
    blockedByTheGate.length > 0,
    {
      blockedByTheGate,
      movedInBothArms: movedInBoth,
      movedOnlyWhileQuarantined,
      note: "movedOnlyWhileQuarantined SHOULD contain provisionalPhase and nothing else: the provisional lifecycle resolver is the one authority permitted to touch a quarantined group.",
    },
  );

  // ── Q3 — only provisional authorities may change provisional movement/lifecycle state ──
  // SCALE-1 Task 4 allows the released comparison arm to move physically as well, so “changed only
  // in the quarantined arm” is no longer a valid positive control. Q1 already proves ordinary
  // residential writers are excluded; Q3 now positively requires a provisional-owned field to move.
  const provisionalOwnedChanges = quarantined.changed.filter((f) => PROVISIONAL_PHYSICAL.includes(f));
  record(
    "Q3_only_the_provisional_authorities_move_a_quarantined_group",
    "the quarantined group has live provisional-owned lifecycle/physical changes while ordinary residential writers remain excluded",
    provisionalOwnedChanges.length > 0 && ordinaryAdmitted.length === 0,
    provisionalOwnedChanges.length > 0,
    { provisionalOwnedChanges, provisionalPhysicalWriters: PROVISIONAL_PHYSICAL,
      finalPhase: quarantined.last.provisionalPhase,
      startPosition: quarantined.first.position, endPosition: quarantined.last.position,
      provisionalGroupPhysicallyMoved: quarantined.first.position !== quarantined.last.position },
  );

  // ── Q4 — BODILY PROCESSES: a quarantine is not a freezer ──
  //
  // These are the processes that must keep reaching the group, because they are what make failure
  // possible at all. If none of them moves, the group cannot fail, and defect 5 — "failure is
  // impossible" — has been restored under a new name.
  const BODILY = ["population", "workingAdults", "dependents", "elders", "hungerPressure", "diseaseBurden", "injuryBurden", "mortalityRisk", "acuteRisk", "acuteRiskEpisodes", "deathMemory"];
  // The decisive one: did the ANNUAL demographic step actually run on the group while it was still
  // quarantined? Measured by the demography object being REPLACED — a new object means the writer ran,
  // whether or not the population happened to move that year.
  let dw = quarantinedStart;
  let prevDemography = dw.bands[succId].demography;
  let demographyRanWhileProvisional = false;
  let demographyRunDayOffset = null;
  for (let day = 1; day <= quarantined.days; day += 1) {
    dw = advance.advanceWorldByDays(dw, 1);
    const b = dw.bands[succId];
    if (b === undefined) break;
    if (b.demography !== prevDemography) {
      prevDemography = b.demography;
      if (lc.isProvisionalSuccessor(b)) {
        demographyRanWhileProvisional = true;
        demographyRunDayOffset = day;
        break;
      }
    }
  }
  const bodilyAdmitted = BODILY.filter((f) => quarantined.changed.includes(f));
  const bodilyAdmittedWhenReleased = BODILY.filter((f) => released.changed.includes(f));
  const bodilyBlockedByQuarantine = bodilyAdmittedWhenReleased.filter((f) => !bodilyAdmitted.includes(f));
  record(
    "Q4_bodily_processes_still_reach_a_quarantined_group",
    "the ANNUAL demographic step runs on the group while it is still quarantined, and its hunger moves — the quarantine excludes RESIDENTIAL BEHAVIOUR, not physiology, and a group nothing can harm is a group that cannot fail, which is defect 5 restored under a new name",
    bodilyAdmitted.length > 0 && demographyRanWhileProvisional,
    // Non-vacuity: the released arm must show these processes are live in this world at all.
    bodilyAdmittedWhenReleased.length > 0,
    {
      bodilyAdmittedWhileQuarantined: bodilyAdmitted,
      bodilyAdmittedWhenReleased,
      bodilyBlockedByQuarantine,
      populationOverWindow: { first: quarantined.first.population, last: quarantined.last.population },
      demographyRanWhileProvisional,
      demographyRunDayOffset,
    },
  );

  // ── Q5 — CADENCE: bodily change happens on the demographic cadence, not daily ──
  //
  // Measured as the number of distinct days on which population moved. Demography is ANNUAL, so a
  // quarantined group changing size on many days would mean some second writer is reaching it.
  let w = quarantinedStart;
  let prevPop = observe(w.bands[succId]).population;
  const populationChangeDays = [];
  for (let day = 0; day < quarantined.days; day += 1) {
    w = advance.advanceWorldByDays(w, 1);
    const now = observe(w.bands[succId]);
    if (now === null) break;
    if (now.population !== prevPop) {
      populationChangeDays.push({ dayOffset: day + 1, from: prevPop, to: now.population });
      prevPop = now.population;
    }
  }
  record(
    "Q5_bodily_change_follows_the_demographic_cadence",
    "population moves on at most one day per simulated year, which is the annual demographic step — more would mean a second writer is reaching the quarantined group",
    populationChangeDays.length <= Math.ceil(quarantined.days / 360) + 1,
    quarantined.days > 0,
    { quarantinedDays: quarantined.days, populationChangeDays, allowedChanges: Math.ceil(quarantined.days / 360) + 1 },
  );

  // ── Q6 — the embodied burden is not quietly cleared by living through the window ──
  record(
    "Q6_the_embodied_burden_is_not_cleared_by_the_quarantine",
    "the successor still holds the acute-risk record and its hunger has not been silently zeroed by a system that skipped it",
    quarantined.last.acuteRisk === 1 && quarantined.last.hungerPressure !== null,
    quarantined.first.acuteRisk === 1,
    {
      acuteRisk: { first: quarantined.first.acuteRisk, last: quarantined.last.acuteRisk },
      hungerPressure: { first: quarantined.first.hungerPressure, last: quarantined.last.hungerPressure },
    },
  );

  // ── Q7 — PHASE-COMPLETE: the gate holds in EVERY live phase, not just travelling ──
  //
  // `isProvisionalGroupInTransit` is true during outbound/return travel and during post-return
  // continuation only while the group is short of its committed target. Gating ordinary systems on
  // it would readmit stationary live phases through the same doors.
  // This constructs each live phase and asks the production predicates directly.
  const LIVE_PHASES = [
    "travelling",
    "establishing",
    "failed_early",
    "returning",
    "unresolved_after_failed_return",
    "continuing_after_failed_return",
  ];
  const TERMINAL_PHASES = [
    "reintegrated",
    "stabilized",
    "established_after_failed_return",
    "provisional_extinguished",
  ];
  const phaseRows = [];
  for (const phase of [...LIVE_PHASES, ...TERMINAL_PHASES]) {
    const band = {
      ...departure.world.bands[succId],
      provisionalSuccessor: { ...departure.world.bands[succId].provisionalSuccessor, phase },
    };
    phaseRows.push({
      phase,
      terminal: kernel.isTerminalPhase(phase),
      isProvisionalSuccessor: lc.isProvisionalSuccessor(band),
      isProvisionalGroupInTransit: lc.isProvisionalGroupInTransit(band),
      isEstablishedBand: lc.isEstablishedBand(band),
      isLivingBand: lc.isLivingBand(band),
      isFissionEligibleParent: lc.isFissionEligibleParent(band),
    });
  }
  const liveRows = phaseRows.filter((r) => LIVE_PHASES.includes(r.phase));
  const gateHoldsInEveryLivePhase = liveRows.every((r) => r.isProvisionalSuccessor && !r.isEstablishedBand && r.isLivingBand && !r.isFissionEligibleParent);
  const transitWouldHaveMissed = liveRows.filter((r) => !r.isProvisionalGroupInTransit).map((r) => r.phase);
  record(
    "Q7_the_gate_holds_in_every_live_phase_not_only_in_transit",
    "the predicate the production gates read is true in every live phase and false in every terminal one — and the transit predicate would have READMITTED the phases listed, which is why the gates do not use it",
    gateHoldsInEveryLivePhase && TERMINAL_PHASES.every((p) => {
      const r = phaseRows.find((x) => x.phase === p);
      return !r.isProvisionalSuccessor && r.isEstablishedBand === r.isLivingBand;
    }),
    liveRows.length === LIVE_PHASES.length && transitWouldHaveMissed.length > 0,
    { phaseRows, transitPredicateWouldHaveReadmitted: transitWouldHaveMissed },
  );

  // ── Q8 — a quarantined group is still physically present ──
  //
  // CORRECTION-34 removed ghost bodies by making presence read real positions. Hiding a quarantined
  // group from the physical layer would put them straight back.
  // FIXTURE REPAIR — this read `quarantined.world`, the world AFTER the arm stopped, which is one step
  // past the end of the quarantine. That was harmless while the lifecycle could not resolve; now the
  // group legitimately reintegrates on the step that ends the arm, so the old read reported a
  // terminal, emptied band and called it a quarantine failure. The subject is the last day the group
  // was STILL a live provisional successor, which is exactly what `runArm` retains as `last`.
  const lastQuarantinedDay = quarantined.last;
  record(
    "Q8_a_quarantined_group_is_still_physically_present",
    "on every day it is quarantined the successor is a LIVING band holding bodies at a tile — excluding it from presence would recreate the ghosts CORRECTION-34 removed",
    lastQuarantinedDay !== null && lastQuarantinedDay.isLivingBand === true &&
      lastQuarantinedDay.isBandTerminal === false && lastQuarantinedDay.population > 0,
    quarantined.days > 0,
    {
      quarantinedDays: quarantined.days,
      population: lastQuarantinedDay?.population ?? 0,
      position: lastQuarantinedDay?.position ?? "none",
      isLivingBand: lastQuarantinedDay?.isLivingBand ?? false,
      isBandTerminal: lastQuarantinedDay?.isBandTerminal ?? null,
      phaseOnLastQuarantinedDay: lastQuarantinedDay?.provisionalPhase ?? null,
    },
  );

  // ── Q9 — FINDING: A GROUP CAN LEAVE QUARANTINE ON A TIMER, INTO ORDINARY STATUS. ────────────
  //
  // Found by this audit's own corrected window rather than by reading the code. Advanced far enough,
  // the successor runs `travelling` -> (timeout) `returning` -> (timeout) `reintegrated`. The kernel
  // contract states `reintegrated` means "rejoined the parent; the provisional entity is REMOVED
  // exactly once" — and nothing removes it, because the physical return and reintegration writers do
  // not exist yet. So the band stays in the world, stops being provisional, and resumes ordinary
  // behaviour with its people never having gone anywhere or come back.
  //
  // This is the exact mirror of the property the kernel is proud of. `establishing` routes its
  // timeout to `failed_early` precisely so that A TIMER ALONE CAN NEVER STABILIZE — but `returning`
  // routes its timeout to a terminal phase with no writer behind it, so a timer alone DOES
  // reintegrate, and the result is a group promoted to ordinary status having demonstrated nothing.
  //
  // NOT REPAIRED HERE, and the reason is the stopping boundary rather than difficulty: reintegration
  // is the return vertical, which this pass is explicitly forbidden to begin. It is published so the
  // return pass inherits a measured statement rather than rediscovering it.
  const longRun = runArm(quarantinedStart, OBSERVE_DAYS, false);
  const finalBand = longRun.world.bands[succId];
  const escapedByTimeout =
    finalBand !== undefined &&
    !lc.isProvisionalSuccessor(finalBand) &&
    lc.isEstablishedBand(finalBand) &&
    finalBand.provisionalSuccessor?.phase === "reintegrated";
  record(
    "Q9_CLOSED_a_group_can_no_longer_leave_quarantine_on_a_timer_into_ordinary_status",
    "the escape this audit published is CLOSED: `reintegrated` is now reachable only through the physical writer, which requires a living co-located parent and REMOVES the entity — so no band reaches that phase while still holding bodies and reading as an ordinary established band",
    escapedByTimeout === false,
    finalBand !== undefined,
    {
      status: escapedByTimeout ? "STILL_REPRODUCED" : "CLOSED_NOT_REPRODUCED",
      closedBy: "provisional_reintegration daily action + performAtomicReintegration; a timer can no longer reach `reintegrated` because the kernel demands physicalCoLocationProven",
      quarantineEndedAfterDays: quarantined.days,
      windowDays: OBSERVE_DAYS,
      finalPhase: finalBand?.provisionalSuccessor?.phase ?? null,
      stillInTheWorld: finalBand !== undefined,
      isEstablishedBandNow: finalBand === undefined ? false : lc.isEstablishedBand(finalBand),
      populationStillHeld: Math.round(finalBand?.demography.population ?? 0),
      contractSays: "reintegrated — terminal: rejoined the parent. The provisional entity is removed exactly once.",
      populationHeldIfStillProvisionalEscape: Math.round(finalBand?.demography.population ?? 0),
    },
  );

  out = {
    generatedAt: new Date().toISOString(),
    seed: SEED, warmDays: WARM_DAYS, observeDays: OBSERVE_DAYS,
    parentId: String(parent.id), successorId: succId,
    method:
      "WITH-MINUS-WITHOUT: two worlds identical but for the successor's `provisionalSuccessor` record, advanced day by day over the same window. A field moving in RELEASED and not in QUARANTINED was blocked by the gate on this band on these days.",
    arms: {
      quarantined: { first: quarantined.first, last: quarantined.last, changedFields: quarantined.changed },
      released: { first: released.first, last: released.last, changedFields: released.changed },
      blockedByTheGate,
      movedInBothArms: movedInBoth,
      movedOnlyWhileQuarantined,
    },
    summary: {
      fixtures: fixtures.length,
      passing: fixtures.filter((f) => f.verdict === "PASS").length,
      failing: fixtures.filter((f) => f.verdict === "FAIL").length,
      vacuous: fixtures.filter((f) => f.verdict === "VACUOUS").length,
      fieldsBlockedByTheGate: blockedByTheGate.length,
    },
    fixtures,
  };
} finally {
  await server.close();
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify(out.summary, null, 2));
console.log("blockedByTheGate:", out.arms.blockedByTheGate.join(", ") || "(none)");
console.log("movedInBothArms:", out.arms.movedInBothArms.join(", ") || "(none)");
console.log("movedOnlyWhileQuarantined:", out.arms.movedOnlyWhileQuarantined.join(", ") || "(none)");
for (const f of out.fixtures) console.log(`${f.verdict.padEnd(7)} ${f.id}`);
if (out.summary.failing > 0 || out.summary.vacuous > 0) process.exitCode = 1;
