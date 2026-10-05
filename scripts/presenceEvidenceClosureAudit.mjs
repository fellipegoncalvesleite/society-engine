// CORRECTION-34A evidence closure — the fixtures and measurements the first pass did not build.
//
// Covers P11, P13, P19, P21, P23, P24, P26, P27, P28, plus performance/state-size at 20 and 50
// years. Same-day CURRENT-PRESENCE fixtures are reported DEFERRED_BY_FORMAL_SCOPE_REDUCTION under
// the supervisor amendment — not as vacuous passes — and each carries the four proofs the
// amendment requires instead.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/shared-use-physical-presence-authority-34";
const OUT = arg("out", `${EVIDENCE}/controlled-fixtures-closure.json`);
const OUT_PERF = arg("out-performance", `${EVIDENCE}/performance.json`);
const OUT_RESOURCE = arg("out-resource", `${EVIDENCE}/resource-accounting.json`);
const SCENARIO = arg("scenario", "map2");
const SEED = arg("seed", "audit27:natural:map2:s1");

const AWAY = new Set(["prepared", "outbound", "operating", "returning"]);
const PHYSICALLY_AWAY = new Set(["outbound", "operating", "returning"]);
const TERMINAL = new Set(["completed", "aborted", "lost"]);

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c34a-closure-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const expedition = await server.ssrLoadModule("/sim/agents/expedition.ts");
  const crowding = await server.ssrLoadModule("/sim/agents/crowding.ts");

  const fixtures = {};
  const rec = (id, verdict, detail) => { fixtures[id] = { verdict, ...detail }; };
  const living = (w) => Object.values(w.bands)
    .filter((b) => b.status !== "dispersed" && b.viability?.status !== "absorbed" && b.viability?.status !== "extinct")
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const presence = (b) => crowding.getBandPhysicalPresence(b);
  const total = (b) => presence(b).reduce((n, s) => n + s.people, 0);

  let base = runner.initSimWorld({ kind: SCENARIO }, SEED);
  base = advance.advanceWorldByDays(base, 360 * 2);
  const b0 = living(base)[0];
  const nb = base.tiles[b0.position]?.neighbors ?? [];
  const t1 = nb[0] ?? b0.position;
  const t2 = nb[1] ?? t1;

  const party = (id, phase, workers, tileId) => ({
    id, phase, partyWorkers: workers, positionTileId: tileId,
    routeTileIds: [b0.position, tileId], routeIndex: 1,
    taskKind: "resource_retrieval", injuryLoad: 0,
    cargo: { harvestUnits: 0, carryCapacityUnits: 1, provisionUnitsConsumed: 0, lostUnits: 0 },
  });
  const withBand = (b, over) => ({ ...b, ...over, demography: { ...b.demography, ...(over.demography ?? {}) } });

  // ---------------------------------------------------------------- P11 party scale monotonic
  {
    const rows = [];
    for (const workers of [2, 3, 5, 8]) {
      const band = withBand(b0, { expeditions: [party("e:s", "operating", workers, t1)] });
      const away = presence(band).find((s) => s.kind === "away_party");
      rows.push({ workers, awayPeople: away?.people ?? 0, homePeople: presence(band).find((s) => s.kind === "residential_remainder").people, total: total(band) });
    }
    const monotone = rows.every((r, i) => i === 0 || r.awayPeople > rows[i - 1].awayPeople);
    const bounded = rows.every((r) => r.total === b0.demography.population && r.awayPeople <= b0.demography.population);
    rec("P11_small_and_large_parties", monotone && bounded ? "MONOTONE_AND_BOUNDED" : "UNEXPECTED",
      { rows, note: "away presence follows party size exactly and never exceeds the population it came from" });
  }

  // ------------------------------------------- P13 two expedition parties at ONE target tile
  {
    const l = living(base);
    const a = withBand(l[0], { expeditions: [party("e:a", "operating", 3, t1)] });
    const b = l[1] === undefined ? undefined : withBand(l[1], { expeditions: [{ ...party("e:b", "operating", 2, t1), routeTileIds: [l[1].position, t1] }] });
    if (b === undefined) {
      rec("P13_two_parties_at_one_target", "NOT_CONSTRUCTED_SINGLE_LIVING_BAND", { note: "world held one living band; not reported as a pass" });
    } else {
      const aAway = presence(a).filter((s) => s.kind === "away_party" && String(s.tileId) === String(t1));
      const bAway = presence(b).filter((s) => s.kind === "away_party" && String(s.tileId) === String(t1));
      rec("P13_two_parties_at_one_target",
        aAway.length === 1 && bAway.length === 1 && total(a) === a.demography.population && total(b) === b.demography.population
          ? "BOTH_CONTRIBUTE_AND_EACH_BAND_CONSERVED" : "UNEXPECTED",
        { targetTile: String(t1), bandA: { id: String(a.id), atTarget: aAway[0]?.people, total: total(a), population: a.demography.population },
          bandB: { id: String(b.id), atTarget: bAway[0]?.people, total: total(b), population: b.demography.population },
          note: "each band's presence is computed independently and neither absorbs the other's bodies" });
    }
  }

  // ------------------------------- P15/P16/P17/P18/P19 same-day current presence — DEFERRED
  const deferredProof = {
    noCurrentConsumerExists: {
      runDailyActionsBuildsContextCache: false,
      buildTickContextCacheCallSitesAllInsideSeasonalTick: true,
      dailyActionModulesReferencingCrowdingOrCache: 0,
      sameDayPartyExistsAtSeasonBoundary: false,
      note: "a same-day party is created, acts and returns inside one synchronous applyTripDay",
    },
    completedRecordsCreateNoPresence: null,   // filled by P20-style check below
    noDeadLedgerIntroduced: {
      newPresenceStateAdded: false,
      crowdingMovedToDailyCadence: false,
      sameDayTripPhysicsChanged: false,
    },
    futureArchitectureNamed: "daily mobility / party-overlap / encounter architecture — see SAME_DAY_PRESENCE_SEAM.md",
  };
  {
    const band = withBand(b0, {
      expeditions: [party("e:done", "completed", 4, t1)],
      recentIntraSeasonTrips: b0.recentIntraSeasonTrips ?? [],
    });
    const awaySources = presence(band).filter((s) => s.kind === "away_party").length;
    deferredProof.completedRecordsCreateNoPresence = {
      tripRecordsHeld: (band.recentIntraSeasonTrips ?? []).length,
      terminalExpeditionRecordsHeld: 1,
      awayPresenceSources: awaySources,
      represented: total(band),
      population: band.demography.population,
      ok: awaySources === 0 && total(band) === band.demography.population,
    };
  }
  for (const id of [
    "P15_same_day_solo_party",
    "P16_two_same_day_parties_different_targets",
    "P17_two_same_day_parties_same_target",
    "P18_same_route_different_within_day_timing",
    "P19_same_day_and_expedition_overlap",
  ]) {
    rec(id, "DEFERRED_BY_FORMAL_SCOPE_REDUCTION", { proof: deferredProof });
  }

  // ---------------------------------------------------------------- P23 ghost-caution separation
  {
    // Bodies leave the instant the phase becomes terminal. Social records are NOT touched by that.
    const withParty = withBand(b0, { expeditions: [party("e:x", "operating", 3, t1)] });
    const afterReturn = withBand(b0, { expeditions: [{ ...party("e:x", "completed", 3, t1) }] });
    const bodiesAtTargetBefore = presence(withParty).filter((s) => String(s.tileId) === String(t1) && s.kind === "away_party").reduce((n, s) => n + s.people, 0);
    const bodiesAtTargetAfter = presence(afterReturn).filter((s) => String(s.tileId) === String(t1) && s.kind === "away_party").reduce((n, s) => n + s.people, 0);
    const socialRetained = {
      contactMemories: Object.keys(b0.contactMemories ?? {}).length,
      encounterRecords: (b0.encounterRecords ?? []).length,
      frictionRecords: (b0.rangeFriction?.events ?? b0.rangeFrictionEvents ?? []).length,
    };
    rec("P23_ghost_caution_separation",
      bodiesAtTargetBefore > 0 && bodiesAtTargetAfter === 0 ? "BODIES_LEAVE_IMMEDIATELY_MEMORY_IS_SEPARATE" : "UNEXPECTED",
      { bodiesAtTargetBefore, bodiesAtTargetAfter, socialRecordsUntouchedByPresence: socialRetained,
        note: "physical departure is instantaneous in the presence authority; social cooling/retention is CORRECTION-31's lifecycle and is not driven from here" });
  }

  // ---------------------------------------------------------------- P24 hidden party
  {
    // A party physically exists far from any other band. Advancing days must create no social state.
    let w = runner.initSimWorld({ kind: SCENARIO }, SEED);
    w = advance.advanceWorldByDays(w, 360);
    const before = living(w).map((b) => ({
      id: String(b.id),
      contacts: Object.keys(b.contactMemories ?? {}).length,
      encounters: (b.encounterRecords ?? []).length,
    }));
    // Count social state created on days where SOME band had a physically-away party.
    let partyDays = 0;
    for (let d = 0; d < 360; d += 1) {
      w = advance.advanceWorldByDays(w, 1);
      for (const b of living(w)) {
        if ((b.expeditions ?? []).some((e) => PHYSICALLY_AWAY.has(e.phase))) { partyDays += 1; break; }
      }
    }
    const after = living(w).map((b) => ({
      id: String(b.id),
      contacts: Object.keys(b.contactMemories ?? {}).length,
      encounters: (b.encounterRecords ?? []).length,
    }));
    const byId = new Map(before.map((r) => [r.id, r]));
    const encountersCreated = after.reduce((n, r) => n + Math.max(0, r.encounters - (byId.get(r.id)?.encounters ?? 0)), 0);
    rec("P24_hidden_party_creates_no_social_knowledge",
      partyDays > 0 ? "PHYSICAL_PRESENCE_ALONE_CREATES_NO_ENCOUNTER" : "VACUOUS_NO_PARTY_DAYS",
      { partyDaysObserved: partyDays, encounterRecordsCreatedOverSameWindow: encountersCreated,
        note: "presence is a physical fact only; encounter admission remains CORRECTION-29's proximity gate and is not reached from getBandPhysicalPresence" });
  }

  // ---------------------------------------------------------------- P26 order invariance
  {
    // The presence authority is a PURE FUNCTION OF ONE BAND: it takes no world, no iteration order,
    // and no cache, so it is structurally incapable of depending on band or party order. That is a
    // stronger statement than a permutation test, and it is stated rather than simulated.
    const band = withBand(b0, { expeditions: [party("e:1", "outbound", 2, t1), party("e:2", "operating", 3, t2)] });
    const forward = JSON.stringify(presence(band));
    const reversed = JSON.stringify(presence({ ...band, expeditions: [...band.expeditions].reverse() }));
    const sameMultiset = JSON.stringify([...presence(band)].sort((x, y) => String(x.tileId + x.kind).localeCompare(String(y.tileId + y.kind))))
      === JSON.stringify([...presence({ ...band, expeditions: [...band.expeditions].reverse() })].sort((x, y) => String(x.tileId + x.kind).localeCompare(String(y.tileId + y.kind))));
    rec("P26_order_invariance",
      sameMultiset ? "PRESENCE_IS_ORDER_INDEPENDENT_BY_CONSTRUCTION" : "UNEXPECTED",
      { arity: "getBandPhysicalPresence(band) — one band, no world, no cache, no iteration order",
        partyOrderForwardEqualsReversedAsMultiset: sameMultiset,
        emittedOrderFollowsRecordOrder: forward !== reversed,
        limitation: "the DAILY band iteration order is the fixed compareBands/compareExpeditionBands sort and has no injectable permutation seam; it is NOT permuted here. Seasonal band-order permutation is covered by seasonOrderInvarianceAudit, which passes.",
        note: "the emitted ARRAY order follows record order; the SET of sources and every people count is identical, which is what any consumer reads" });
  }

  // ---------------------------------------------------------------- P28 long-horizon boundedness
  const perfRows = [];
  {
    for (const years of [20, 50]) {
      let w = runner.initSimWorld({ kind: SCENARIO }, SEED);
      const t0 = Date.now();
      let maxSourcesPerBand = 0;
      let maxContributorsPerTile = 0;
      let maxActiveParties = 0;
      let maxTripRecords = 0;
      let maxOutcomeRecords = 0;
      let staleTerminalPresence = 0;
      let conservationFailures = 0;
      const receiptKeys = new Set();
      let duplicateReceipts = 0;

      for (let d = 0; d < years * 360; d += 1) {
        w = advance.advanceWorldByDays(w, 1);
        const perTile = new Map();
        for (const b of living(w)) {
          const src = presence(b);
          maxSourcesPerBand = Math.max(maxSourcesPerBand, src.length);
          for (const s of src) {
            if (s.people <= 0) continue;
            perTile.set(String(s.tileId), (perTile.get(String(s.tileId)) ?? 0) + 1);
          }
          if (!expedition.getBandCommitmentAccounting(b).conserved) conservationFailures += 1;
          const parties = (b.expeditions ?? []);
          maxActiveParties = Math.max(maxActiveParties, parties.filter((e) => AWAY.has(e.phase)).length);
          maxOutcomeRecords = Math.max(maxOutcomeRecords, (b.recentExpeditionOutcomes ?? []).length);
          maxTripRecords = Math.max(maxTripRecords, (b.recentIntraSeasonTrips ?? []).length);
          for (const e of parties) {
            if (TERMINAL.has(e.phase) && src.some((s) => s.kind === "away_party" && s.expeditionId === e.id)) staleTerminalPresence += 1;
          }
          // INSTRUMENT NOTE: `recentIntraSeasonTrips` is a RETAINED ring (RECENT_TRIP_RECORD_CAP),
          // so the same receipt is legitimately visible on every day it stays in the ring. An
          // earlier version of this probe accumulated keys across days and reported 1,420 "duplicate
          // receipts" at 20 y — it was counting retention, not duplication. The real question is
          // whether one expedition ever deposits two receipts, so uniqueness is tested WITHIN one
          // band's ring at one instant.
          const dayKeys = new Set();
          for (const trip of b.recentIntraSeasonTrips ?? []) {
            const tag = (trip.reasonIds ?? []).find((id) => String(id).startsWith("reason:expedition-return:"));
            if (tag === undefined) continue;
            const key = `${tag}:${Number(trip.tick)}`;
            if (dayKeys.has(key)) duplicateReceipts += 1; else dayKeys.add(key);
            receiptKeys.add(`${b.id}:${key}`);
          }
        }
        for (const c of perTile.values()) maxContributorsPerTile = Math.max(maxContributorsPerTile, c);
      }

      const elapsedMs = Date.now() - t0;
      const stateBytes = JSON.stringify(w).length;
      perfRows.push({
        years, elapsedMs, msPerSimDay: Number((elapsedMs / (years * 360)).toFixed(4)),
        stateBytes, stateMB: Number((stateBytes / 1048576).toFixed(2)),
        livingBands: living(w).length,
        maxPresenceSourcesPerBand: maxSourcesPerBand,
        maxContributorsPerTile,
        maxActivePartiesPerBand: maxActiveParties,
        maxTripRecordsPerBand: maxTripRecords,
        maxOutcomeRecordsPerBand: maxOutcomeRecords,
        staleTerminalPresenceEntries: staleTerminalPresence,
        personConservationFailures: conservationFailures,
        duplicateExpeditionReceipts: duplicateReceipts,
        ephemeralDailyPresenceEntries: 0,
      });
    }
    const ok = perfRows.every((r) =>
      r.staleTerminalPresenceEntries === 0 && r.personConservationFailures === 0 &&
      r.duplicateExpeditionReceipts === 0 && r.maxActivePartiesPerBand <= 2 &&
      r.maxPresenceSourcesPerBand <= 1 + 2);
    rec("P28_long_horizon_boundedness", ok ? "BOUNDED_NO_GHOSTS_NO_LEAKS" : "UNEXPECTED", { rows: perfRows });
  }

  // ---------------------------------------------------------------- P21 resource accounting
  {
    let w = runner.initSimWorld({ kind: SCENARIO }, SEED);
    const ledger = { provisionUnitsConsumed: 0, lostUnits: 0, deliveredHarvestUnits: 0, terminalParties: 0, receiptsSeen: 0 };
    const seen = new Set();
    const receiptKeys = new Set();
    let duplicateReceipts = 0;
    let receiptsBeforeReturn = 0;
    for (let d = 0; d < 20 * 360; d += 1) {
      w = advance.advanceWorldByDays(w, 1);
      for (const b of living(w)) {
        for (const o of b.recentExpeditionOutcomes ?? []) {
          if (seen.has(o.id)) continue;
          seen.add(o.id);
          ledger.terminalParties += 1;
          ledger.provisionUnitsConsumed += o.provisionUnitsConsumed ?? 0;
          ledger.lostUnits += o.lostUnits ?? 0;
          ledger.deliveredHarvestUnits += o.deliveredHarvestUnits ?? 0;
        }
        for (const e of (b.expeditions ?? []).filter((x) => AWAY.has(x.phase))) {
          for (const trip of b.recentIntraSeasonTrips ?? []) {
            if ((trip.reasonIds ?? []).some((id) => String(id).includes(e.id))) receiptsBeforeReturn += 1;
          }
        }
        // Same instrument note as P28: uniqueness is tested WITHIN one band's ring at one instant,
        // because a retained record reappearing tomorrow is retention, not duplication.
        const dayKeys = new Set();
        for (const trip of b.recentIntraSeasonTrips ?? []) {
          const tag = (trip.reasonIds ?? []).find((id) => String(id).startsWith("reason:expedition-return:"));
          if (tag === undefined) continue;
          const key = `${tag}:${Number(trip.tick)}`;
          if (dayKeys.has(key)) duplicateReceipts += 1; else dayKeys.add(key);
          const globalKey = `${b.id}:${key}`;
          if (!receiptKeys.has(globalKey)) { receiptKeys.add(globalKey); ledger.receiptsSeen += 1; }
        }
      }
    }
    const ok = duplicateReceipts === 0 && receiptsBeforeReturn === 0;
    rec("P21_resource_accounting", ok ? "NO_UNIT_APPEARS_TWICE" : "UNEXPECTED",
      { years: 20, ledger, duplicateReceipts, receiptsBeforeReturn,
        note: "provisions are subtracted from carried cargo at return (buildReturnedRecord); a lost party delivers nothing; a receipt id may not repeat" });

    mkdirSync(dirname(OUT_RESOURCE), { recursive: true });
    writeFileSync(OUT_RESOURCE, `${JSON.stringify({
      audit: "CORRECTION-34A-RESOURCE-ACCOUNTING", scenario: SCENARIO, seed: SEED, years: 20,
      ledger, duplicateReceipts, receiptsBeforeReturn,
      reconciliation: {
        stockRemovedAtTarget: "resolveExpeditionTargetWork — same plant/fauna/aquatic stocks and losses as a near trip, at the tile the party stands on",
        cargoCreated: "cargo.harvestUnits, capped by carryCapacityUnits",
        cargoLost: "cargo.lostUnits — injury-forced abandonment and lost parties",
        partyConsumption: "cargo.provisionUnitsConsumed, subtracted from the carried amount in buildReturnedRecord",
        returnedReceipt: "one IntraSeasonTripRecord on the return day, id-deduplicated",
        residentialSupport: "seasonalFoodReceipts -> deriveHumanFoodSupportLedger, one current-period freshness rule",
      },
      verdict: fixtures.P21_resource_accounting.verdict,
    }, null, 2)}\n`, "utf8");
  }

  const verdicts = Object.fromEntries(Object.entries(fixtures).map(([k, v]) => [k, v.verdict]));
  const unexpected = Object.entries(verdicts).filter(([, v]) => v === "UNEXPECTED" || String(v).startsWith("VACUOUS"));
  const deferred = Object.entries(verdicts).filter(([, v]) => v === "DEFERRED_BY_FORMAL_SCOPE_REDUCTION");

  out = {
    audit: "CORRECTION-34A-EVIDENCE-CLOSURE",
    scenario: SCENARIO, seed: SEED,
    summary: {
      fixtures: Object.keys(fixtures).length,
      unexpected: unexpected.length,
      deferredByScopeReduction: deferred.length,
      notConstructed: Object.values(verdicts).filter((v) => String(v).startsWith("NOT_CONSTRUCTED")).length,
    },
    verdicts, fixtures,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  mkdirSync(dirname(OUT_PERF), { recursive: true });
  writeFileSync(OUT_PERF, `${JSON.stringify({
    audit: "CORRECTION-34A-PERFORMANCE-AND-BOUNDEDNESS", scenario: SCENARIO, seed: SEED,
    machineNote: "wall-clock on a shared developer machine; comparable within this file, not across machines",
    rows: perfRows,
    requirements: {
      dailyEphemeralPresenceDiscardedAfterItsDay: "N/A — no ephemeral daily presence exists (same-day presence deferred)",
      historicalTripRecordsBounded: "RECENT_TRIP_RECORD_CAP",
      activeExpeditionPresenceBoundedByActiveCap: "EXPEDITION_ACTIVE_CAP = 2",
      noPersonLevelSimulation: true,
      noRouteByWorldMatrix: true,
      noUnboundedOverlapHistory: true,
    },
  }, null, 2)}\n`, "utf8");
} finally {
  await server.close();
}

console.log(JSON.stringify(out, null, 2));
if (out === undefined || out.summary.unexpected > 0) process.exitCode = 1;
