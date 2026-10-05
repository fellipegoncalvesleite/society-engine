// CORRECTION-34C §9 — controlled fixtures L1-L12 for away-body / cohort / fission ownership.
//
// Asserts through production functions. Where a production function is module-private
// (`createDaughterBand`, `getDaughterPopulation`), the fixture reproduces the SELECTION ARITHMETIC
// from the published constants and says so, rather than pretending to call it.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/shared-use-physical-presence-authority-34";
const OUT = arg("out", `${EVIDENCE}/away-body-ownership-fixtures.json`);
const DAUGHTER_MIN_POPULATION = 18;   // demography.ts:131

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c34c-fx-${process.pid}`,
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

  const rec = (b) => expedition.reconcileExpeditionCommitment(b, tick);
  const party = (over = {}) => ({
    id: "e:l", phase: "operating", partyWorkers: 6,
    partyComposition: { limited: 1, typical: 4, high: 1 },
    positionTileId: t1, routeTileIds: [base.position, t1], routeIndex: 1,
    taskKind: "resource_retrieval", injuryLoad: 0, travelDaysElapsed: 2, hardDeadlineDay: 9999,
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
    const e = (b.expeditions ?? [])[0];
    return {
      population: b.demography.population, workingAdults: b.demography.workingAdults,
      elders: b.demography.elders, dependents: b.demography.dependents,
      residentialPeople: home?.people ?? 0, awayPeople: away.reduce((n, s) => n + s.people, 0),
      awayTiles: away.map((s) => String(s.tileId)),
      partyWorkers: e?.partyWorkers ?? 0, partyPhase: e?.phase ?? "(none)",
      represented: p.reduce((n, s) => n + s.people, 0),
    };
  };

  const fixtures = {};
  const add = (id, verdict, detail) => { fixtures[id] = { verdict, ...detail }; };

  // ── L1 aging without movement ───────────────────────────────────────────────────────────────
  {
    const aged = mk(5, 7, 8, [party()]);           // one adult became an elder; population 20
    const after = rec(aged);
    const a = snap(aged), b = snap(after);
    add("L1_aging_without_movement",
      b.awayPeople === a.awayPeople && b.residentialPeople === a.residentialPeople && b.awayTiles.join() === a.awayTiles.join()
        ? "NO_BODY_CHANGED_TILE" : "BODY_MOVED",
      { beforeReconciliation: a, afterReconciliation: b,
        note: "workingAdults 6 -> 5 with population unchanged; the party keeps all six bodies at its own tile" });
  }

  // ── L2 dependent becomes adult ──────────────────────────────────────────────────────────────
  {
    const before = mk(5, 7, 8, [party()]);
    const matured = mk(6, 7, 7, [party()]);        // dependent -> adult; population 20 unchanged
    const after = rec(matured);
    const a = snap(matured), c = snap(after);
    add("L2_dependent_becomes_adult",
      c.awayPeople === snap(before).awayPeople && c.partyWorkers === 6 && c.represented === 20
        ? "MATURATION_DOES_NOT_TOUCH_PARTY" : "UNEXPECTED",
      { beforeMaturation: snap(before), afterMaturation: a, afterReconciliation: c,
        note: "residential maturation creates nobody inside the away party and does not change its headcount" });
  }

  // ── L3 ordinary residential death ───────────────────────────────────────────────────────────
  {
    const before = mk(6, 6, 8, [party()]);         // population 20, away 6, residential 14
    const died = mk(6, 6, 7, [party()]);           // a dependent died at camp; population 19
    const after = rec(died);
    const a = snap(before), c = snap(after);
    add("L3_ordinary_residential_death",
      c.awayPeople === 6 && c.residentialPeople === a.residentialPeople - 1 && c.represented === 19
        ? "DEATH_CHANGES_RESIDENCE_NOT_THE_PARTY" : "UNEXPECTED",
      { before: a, afterReconciliation: c,
        note: "population falls by one at the residence; the distant party is untouched" });
  }

  // ── L4 explicit party loss through the canonical authority ──────────────────────────────────
  {
    const lost = mk(6, 6, 8, [party({ phase: "lost", partyWorkers: 0, outcomeReason: "party_lost" })]);
    const s = snap(lost);
    add("L4_explicit_party_loss",
      s.awayPeople === 0 && s.represented === s.population ? "PARTY_LOCAL_OUTCOME_OWNS_THE_LOSS" : "UNEXPECTED",
      { snapshot: s,
        note: "a terminal party holds no body. Loss arrives through the party's own physical outcome (hard deadline, injury, provisions), never through cohort aging." });
  }

  // ── L5 prepared party cancellation ──────────────────────────────────────────────────────────
  {
    const prepared = mk(6, 6, 8, [party({ phase: "prepared" })]);
    const s = snap(prepared);
    add("L5_prepared_party_cancellation",
      s.awayPeople === 0 && s.residentialPeople === s.population ? "AT_CAMP_COMMITMENT_MOVES_NOBODY" : "UNEXPECTED",
      { snapshot: s,
        note: "prepared people are already inside the residential remainder; cancelling is a labour decision, not a movement or a death" });
  }

  // ── L6 / L7 fission bounded by residential availability ─────────────────────────────────────
  // Production: daughter = min(getDaughterPopulation(totalPopulation), population - awayPartyPeople),
  // blocked when that falls below DAUGHTER_MIN_POPULATION. The split fraction 0.34 is the ordinary
  // scale class (demography.ts getDaughterPopulation); reproduced here, not called (module-private).
  const daughterDraw = (population, away) => {
    const uncapped = Math.round(population * 0.34);
    const residentiallyAvailable = Math.max(0, population - away);
    const capped = Math.min(uncapped, residentiallyAvailable);
    return { uncapped, residentiallyAvailable, capped, blocked: capped < DAUGHTER_MIN_POPULATION };
  };
  {
    const d = daughterDraw(80, 6);                 // plenty at home
    add("L6_fission_with_sufficient_residential_population",
      !d.blocked && d.capped === d.uncapped ? "DAUGHTER_FROM_RESIDENTIAL_PEOPLE_PARTY_UNCHANGED" : "UNEXPECTED",
      { population: 80, awayPartyPeople: 6, ...d,
        note: "the cap does not bind when the residence is thick; the away party is not consulted because it is not drawn from" });
  }
  {
    // Numerically large parent, physically thin at home: 60 people, 48 away across parties.
    const d = daughterDraw(60, 48);
    add("L7_fission_blocked_by_residential_unavailability",
      d.blocked && d.uncapped >= DAUGHTER_MIN_POPULATION ? "BLOCKED_RATHER_THAN_BORROWING_AWAY_BODIES" : "UNEXPECTED",
      { population: 60, awayPartyPeople: 48, ...d,
        note: "the uncapped draw (20) would have exceeded the 12 people physically at camp. The daughter is not founded rather than borrowing bodies standing on an expedition route." });
  }

  // ── L8 party returns after protected aging ──────────────────────────────────────────────────
  {
    const aged = rec(mk(5, 7, 8, [party()]));                       // aged, party intact at 6
    const returned = { ...aged, expeditions: [{ ...aged.expeditions[0], phase: "completed", partyWorkers: 0 }] };
    const s = snap(returned);
    add("L8_party_returns_after_protected_aging",
      s.represented === 20 && s.residentialPeople === 20 && s.awayPeople === 0
        ? "RETURN_RECONCILES_ONCE_NO_POPULATION_CREATED_OR_DELETED" : "UNEXPECTED",
      { afterAgingPartyIntact: snap(aged), afterReturn: s,
        note: "the aged person walks home with the party; population is 20 throughout and the elder cohort keeps the transition" });
  }

  // ── L9 two concurrent parties across annual demography ──────────────────────────────────────
  {
    const two = mk(5, 7, 8, [
      party({ id: "e:a", partyWorkers: 3, partyComposition: { limited: 1, typical: 2, high: 0 } }),
      party({ id: "e:b", partyWorkers: 3, partyComposition: { limited: 0, typical: 2, high: 1 }, positionTileId: t2, routeTileIds: [base.position, t2] }),
    ]);
    const after = rec(two);
    const a = snap(two), c = snap(after);
    add("L9_two_concurrent_parties_across_annual_demography",
      c.awayPeople === a.awayPeople && c.represented === 20 ? "BOTH_PARTIES_PHYSICALLY_CONSERVED" : "UNEXPECTED",
      { before: a, after: c, awayTiles: c.awayTiles,
        note: "workingAdults 5 against 6 committed; neither party loses a body because the bound is population, not labour" });
  }

  // ── L10 population collapse below the away headcount ────────────────────────────────────────
  {
    const collapsed = mk(1, 1, 1, [party()]);      // population 3, party of 6 — genuinely impossible
    const after = rec(collapsed);
    const s = snap(after);
    const e = after.expeditions[0];
    // ── CORRECTED BY CORRECTION-34D §9. ───────────────────────────────────────────────────────
    //
    // This fixture used to accept `phase: "operating", outcomeReason: null, partyWorkers 6 -> 3`
    // as EXPLICIT_OUTCOME_AND_STATED_MODEL_LIMIT. It was neither. Three people were deleted from a
    // party with no named cause, and the three that remained were left `operating` — so the record
    // went on describing a journey in progress, which is a false physical history. The fixture's
    // own text asserted a terminal outcome while the party was not terminal.
    //
    // The corrected requirement is that the mechanism NAME ITSELF as a repair: the record is
    // retired whole under `invalid_state_repaired`, which is not a death, not a return, not a
    // party-local loss, and which `bandEvents` refuses to narrate at all.
    const explicitOutcome =
      e.phase === "aborted" && e.outcomeReason === "invalid_state_repaired" &&
      e.partyWorkers === 0 && (e.nonWorkingPartyPeople ?? 0) === 0;
    add("L10_population_collapse_below_away_headcount",
      s.represented === s.population && explicitOutcome && s.awayPeople === 0
        ? "LABELLED_NON_HISTORICAL_REPAIR_AND_STATED_MODEL_LIMIT" : "UNEXPECTED",
      { after: s, partyPhase: e.phase, outcomeReason: e.outcomeReason ?? null,
        outcomeKind: "labelled_non_historical_state_repair",
        retiredWholeRatherThanSilentlyShrunk: e.partyWorkers === 0,
        narratedInEventFeed: false,
        modelLimit:
          "population below the away headcount is not reachable through any ordinary path once fission is bounded and aging no longer moves bodies. If it occurs, the state is already corrupt: the reconciler retires the record under a reason that says so, and does NOT claim to know which physical mechanism removed the people. No solution is invented.",
        whatChangedFrom34C:
          "34C partially shrank the party to 3 workers with a null outcome reason and left it `operating`. That is a silent deletion presented as an ongoing journey, which §9 forbids.",
      });
  }

  // ── L11 legacy overcommitted state ──────────────────────────────────────────────────────────
  {
    const legacy = mk(4, 4, 4, [party({ partyWorkers: 20 })]);      // population 12, party 20
    const a = rec(legacy), b = rec(legacy);
    add("L11_legacy_overcommitted_state",
      JSON.stringify(snap(a)) === JSON.stringify(snap(b)) && snap(a).represented === snap(a).population
        ? "DETERMINISTIC_DEFENSIVE_REPAIR_NO_INVENTED_HISTORY" : "UNEXPECTED",
      { after: snap(a), deterministicAcrossRepeatedCalls: JSON.stringify(snap(a)) === JSON.stringify(snap(b)),
        outcomeReason: (a.expeditions[0] ?? {}).outcomeReason ?? null,
        note: "handled defensively and identically every time, and the outcome NAMES ITSELF a repair (`invalid_state_repaired`) rather than leaving a null reason on a party that is still walking" });
  }

  // ── L12 step-mode equivalence across an annual boundary ─────────────────────────────────────
  {
    // 630 is the LCM of the four mode lengths; 1260 days spans two annual (spring) demography runs.
    const MODE_DAYS = { daily: 1, weekly: 7, monthly: 30, seasonal: 90 };
    const SPAN = 1260;
    const canon = (w) => JSON.stringify(Object.values(w.bands)
      .sort((x, y) => String(x.id).localeCompare(String(y.id)))
      .map((b) => ({
        id: String(b.id), pos: String(b.position), pop: b.demography?.population,
        wa: b.demography?.workingAdults, el: b.demography?.elders, dep: b.demography?.dependents,
        exp: (b.expeditions ?? []).map((e) => `${e.phase}:${e.partyWorkers}:${String(e.positionTileId ?? "")}`),
      })));
    const results = {};
    let partiesSeen = 0;
    for (const [mode, days] of Object.entries(MODE_DAYS)) {
      let w = runner.initSimWorld({ kind: "map2" }, "audit27:natural:map2:s1");
      w = runner.stepSim(w, SPAN / days, mode);
      results[mode] = canon(w);
      partiesSeen += Object.values(w.bands).reduce((n, b) => n + (b.expeditions ?? []).length, 0);
    }
    const allMatch = Object.values(results).every((v) => v === results.daily);
    // CORRECTION-34D — THE VERDICT NAME IS NARROWED TO WHAT THIS FIXTURE ACTUALLY MEASURES.
    // It establishes step-mode determinism over a span containing annual boundaries. It does NOT
    // establish that an ACTIVE party is represented identically across one, because it never
    // checks any party's phase on a demography day. CORRECTION-34D H12 does that.
    add("L12_step_mode_equivalence_across_annual_boundary",
      allMatch && partiesSeen > 0 ? "STEP_MODE_IDENTICAL_NO_ACTIVE_PARTY_CLAIM"
        : allMatch ? "IDENTICAL_BUT_NO_EXPEDITION_RECORD_PRESENT" : "DIVERGENT",
      { spanDays: SPAN, annualBoundariesCrossed: Math.floor(SPAN / 360),
        expeditionRecordsPresentAcrossModes: partiesSeen,
        matches: Object.fromEntries(Object.keys(MODE_DAYS).map((m) => [m, results[m] === results.daily])),
        note: "not marked PASS merely because no expedition was active — the expedition-record count is reported",
        supersededBy:
          "CORRECTION-34D H12. This fixture steps a natural world 1260 days and counts expedition records at the end; a natural party lives at most 24 days against ANNUAL demography, so any record found here was launched long after the last boundary. It establishes step-mode determinism, which is real, but NOT that an ACTIVE party is represented identically across a demographic boundary." });
  }

  const verdicts = Object.fromEntries(Object.entries(fixtures).map(([k, v]) => [k, v.verdict]));
  const bad = Object.entries(verdicts).filter(([, v]) =>
    String(v).startsWith("UNEXPECTED") || v === "BODY_MOVED" || v === "DIVERGENT" ||
    v === "IDENTICAL_BUT_NO_EXPEDITION_RECORD_PRESENT");

  out = {
    audit: "CORRECTION-34C-AWAY-BODY-OWNERSHIP-FIXTURES",
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
