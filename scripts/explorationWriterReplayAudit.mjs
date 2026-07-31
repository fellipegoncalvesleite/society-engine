// CORRECTION-24B §8/§9/§10 — SINGLE-RECORD RETURN-WRITER REPLAY.
//
// WHY THE PREVIOUS TWO INSTRUMENTS ARE NOT THIS ONE.
//
//   GLOBAL-SNAPSHOT SENSITIVITY removed every record still carrying the exploration label from a
//   periodic snapshot. Biased: production overwrites the label on residential observation.
//
//   SCHEDULED READER-OUTPUT SENSITIVITY called readers on an audit cadence and deleted a tile from
//   five stores. It manufactured reads that production never performed, deleted independent facts
//   that merely named the same tile, and could not report a record as unread because it read every
//   record itself.
//
// This audit does neither. It forks the world at the EXACT return writer and changes exactly one
// thing: whether one tile is written. The party still departs, walks, takes its risk, eats its
// provisions and comes home identically in both arms — the divergence begins at the write and
// everything after it is derived NATURALLY by stepping both worlds normally. Nothing downstream is
// stripped, synchronised or hand-built.
//
// SOUNDNESS IS A PRECONDITION, NOT A FOOTNOTE. The control arm re-runs the same suppression
// machinery with nothing suppressed and must reproduce the baseline world day for day. A replay
// whose control does not reproduce the baseline is EXCLUDED and reported separately; sound and
// unsound rows are never averaged (§9).
//
// Usage:
//   node scripts/explorationWriterReplayAudit.mjs [--years 40] [--seeds s1,..] [--scenarios ..]
//                                                 [--follow 720] [--out path]
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt;
};

const YEARS = Number(arg("years", "40"));
const SEEDS = arg("seeds", "s1,s2,s3,s4,s5").split(",").filter(Boolean);
const SEED_PREFIX = arg("seed-prefix", "c24a:chain");
const FOLLOW_DAYS = Number(arg("follow", "720"));
const MAX_EVENTS = Number(arg("max-events", "6"));
const BINS = arg("bins", "");
const OUT = arg("out", `docs/evidence/correction24a/writer-replay-${YEARS}y.json`);

const ALL_SCENARIOS = [
  { name: "map1", map: "map1", fixture: "default" },
  { name: "map2", map: "map2", fixture: "default" },
  { name: "site_A_coast", map: "map2", site: "tile:204:72" },
  { name: "site_B_dry_plains", map: "map2", site: "tile:10:34" },
  { name: "site_C_dry_plains", map: "map2", site: "tile:100:23" },
  { name: "site_D_aquatic", map: "map2", site: "tile:119:116" },
  { name: "site_E_hills", map: "map2", site: "tile:139:41" },
  { name: "site_F_hills", map: "map2", site: "tile:45:28" },
  { name: "ordinary", map: "map2", site: "tile:62:108" },
  { name: "isolated_marginal", map: "map2", site: "tile:43:0" },
  { name: "hostile", map: "map2", site: "tile:150:12" },
];

const only = arg("scenarios", "");
const SCENARIOS = only === "" ? ALL_SCENARIOS : ALL_SCENARIOS.filter((s) => only.split(",").includes(s.name));

const r4 = (v) => (v === null || v === undefined ? null : Math.round(Number(v) * 10000) / 10000);

const CLASSES = [
  "WRITE_SUPPRESSED_NO_READER",
  "ACTUAL_READER_READ_BUT_INERT",
  "READER_VERDICT_CHANGED",
  "READER_RANKING_CHANGED",
  "SELECTED_ACTION_CHANGED",
  "PHYSICAL_ACTION_CHANGED",
  "RECEIPT_OR_SUPPORT_CHANGED",
  "DEMOGRAPHY_CHANGED",
  "CONTROL_REPLAY_UNSOUND",
];

const server = await createServer({
  root: `${process.cwd()}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const spawn = await server.ssrLoadModule("/sim/agents/spawn.ts");
  const diag = await server.ssrLoadModule("/sim/diagnostics/explorationFunnelDiagnostics.ts");

  const isLiving = (band) =>
    band.viability?.status !== "extinct" &&
    band.viability?.status !== "absorbed" &&
    band.viability?.status !== "dispersed" &&
    (band.demography?.population ?? 0) > 0;

  const build = (scenario, seed) => {
    let w = runner.initSimWorld({ kind: scenario.map }, `${SEED_PREFIX}:${seed}`);

    if (scenario.fixture !== "default") {
      w = spawn.removeInitialBands(w, Object.keys(w.bands));
      w = spawn.spawnCustomBands(
        w,
        [{ tileId: scenario.site, population: 34, name: scenario.name }],
        `${SEED_PREFIX}:${seed}`,
      );
    }

    return w;
  };

  /**
   * The per-day physical/causal state used both for the soundness check and for locating the
   * counterfactual's first divergence. Deliberately WIDE — CORRECTION-16's rule is that a narrow
   * projection must never be called canonical state.
   */
  const dayState = (world) =>
    Object.values(world.bands)
      .filter(isLiving)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .map((b) => [
        String(b.id),
        String(b.position),
        Number(b.demography?.population ?? 0),
        Object.keys(b.knowledge?.observedTiles ?? {}).length,
        Object.keys(b.placeMemory ?? {}).length,
        Object.keys(b.travelCorridors ?? {}).length,
        (b.expeditions ?? []).map((e) => `${e.id}:${e.taskKind}:${e.phase}`).sort().join(","),
        r4(b.seasonalFoodReceipts?.totalUsableSupport ?? 0),
        r4(b.seasonalSupport?.rolling4SeasonSupport ?? 0),
        (b.fissionEvents ?? []).length,
        (b.daughterBandIds ?? []).length,
      ]);

  /** The exact production decision identities taken on a day — for §10's physical-action proof. */
  const decisionIdentities = (world) =>
    Object.values(world.decisions ?? {})
      .map((d) => `${d.id}|${JSON.stringify(d.action ?? null)}`)
      .sort();

  /**
   * Run a world for `days`, optionally suppressing ONE return-write event, capturing a per-day
   * trace. `suppress` is undefined for the control arm.
   */
  const runWithSuppression = (scenario, seed, days, suppress, collectRecords) => {
    if (collectRecords) {
      diag.setExplorationRecordRecording(true);
      diag.setExplorationJourneyRecording(true);
    }
    diag.setSuppressedReturnWrite(suppress);

    try {
      let world = build(scenario, seed);
      const trace = [];
      const decisions = [];

      for (let d = 1; d <= days; d += 1) {
        world = runner.stepSim(world, 1, "daily");
        trace.push(JSON.stringify(dayState(world)));
        decisions.push(JSON.stringify(decisionIdentities(world)));
        if (Object.values(world.bands).filter(isLiving).length === 0) break;
      }

      const records = collectRecords ? [...diag.getExplorationRecords()] : [];
      const journeys = collectRecords ? [...diag.getExplorationJourneys()] : [];

      return { world, trace, decisions, records, journeys };
    } finally {
      diag.setSuppressedReturnWrite(undefined);
      if (collectRecords) diag.clearExplorationDiagnostics();
    }
  };

  const totals = { events: 0, sound: 0, unsound: 0, byClass: {} };
  for (const c of CLASSES) totals.byClass[c] = 0;

  const rows = [];
  const perScenario = {};

  for (const scenario of SCENARIOS) {
    const acc = { events: 0, sound: 0, unsound: 0, byClass: {} };
    for (const c of CLASSES) acc.byClass[c] = 0;

    for (const seed of SEEDS) {
      // Pass 1 — the BASELINE. Find the real return-write events and keep the day trace so the
      // control replay can be checked against it.
      const baseline = runWithSuppression(scenario, seed, YEARS * 360, undefined, true);

      if (baseline.records.length === 0) {
        continue;
      }

      // §12 — deterministic sample, using only information available at or before the return.
      const byExpedition = new Map();
      for (const rec of baseline.records) {
        const key = `${rec.expeditionId}|${rec.createdDay}`;
        if (!byExpedition.has(key)) byExpedition.set(key, []);
        byExpedition.get(key).push(rec);
      }

      const sorted = [...baseline.records].sort(
        (a, b) => a.createdDay - b.createdDay || String(a.tileId).localeCompare(String(b.tileId)),
      );
      const firstNew = sorted.find((r) => r.isNewRecord);
      const firstRefresh = sorted.find((r) => !r.isNewRecord);

      let chosen = [firstNew, firstRefresh].filter(Boolean);

      // Temporal bins for the long horizons (§12).
      if (BINS !== "") {
        chosen = [];
        for (const bin of BINS.split(";")) {
          const [lo, hi] = bin.split("-").map(Number);
          const inBin = sorted.filter((r) => r.createdDay >= lo * 360 && r.createdDay < hi * 360);
          if (inBin.find((r) => r.isNewRecord)) chosen.push(inBin.find((r) => r.isNewRecord));
          if (inBin.find((r) => !r.isNewRecord)) chosen.push(inBin.find((r) => !r.isNewRecord));
        }
      }

      chosen = chosen.filter(Boolean).slice(0, MAX_EVENTS);

      for (const rec of chosen) {
        const followTo = Math.min(YEARS * 360, rec.createdDay + FOLLOW_DAYS);

        // §9 — CONTROL: same machinery, nothing suppressed. Must reproduce the baseline exactly.
        const control = runWithSuppression(scenario, seed, followTo, undefined, false);
        let soundThrough = 0;
        for (let i = 0; i < Math.min(control.trace.length, baseline.trace.length); i += 1) {
          if (control.trace[i] !== baseline.trace[i]) break;
          soundThrough = i + 1;
        }
        const sound = soundThrough >= Math.min(control.trace.length, baseline.trace.length);

        acc.events += 1;
        totals.events += 1;

        if (!sound) {
          acc.unsound += 1;
          totals.unsound += 1;
          acc.byClass.CONTROL_REPLAY_UNSOUND += 1;
          totals.byClass.CONTROL_REPLAY_UNSOUND += 1;
          rows.push({
            scenario: scenario.name,
            seed,
            recordEventId: rec.recordEventId,
            tileId: rec.tileId,
            expeditionId: rec.expeditionId,
            returnDay: rec.createdDay,
            newOrRefreshed: rec.isNewRecord ? "new" : "refreshed",
            classification: "CONTROL_REPLAY_UNSOUND",
            soundThroughDay: soundThrough,
          });
          continue;
        }

        acc.sound += 1;
        totals.sound += 1;

        // §8.3 — COUNTERFACTUAL: suppress exactly this one write and let everything else follow.
        const cf = runWithSuppression(
          scenario,
          seed,
          followTo,
          { expeditionId: String(rec.expeditionId), tileId: String(rec.tileId), day: Number(rec.createdDay) },
          false,
        );

        let firstDivergenceDay = null;
        const n = Math.min(control.trace.length, cf.trace.length);
        for (let i = 0; i < n; i += 1) {
          if (control.trace[i] !== cf.trace[i]) { firstDivergenceDay = i + 1; break; }
        }

        let firstDecisionDivergenceDay = null;
        for (let i = 0; i < n; i += 1) {
          if (control.decisions[i] !== cf.decisions[i]) { firstDecisionDivergenceDay = i + 1; break; }
        }

        const cBand = Object.values(control.world.bands).filter(isLiving);
        const fBand = Object.values(cf.world.bands).filter(isLiving);
        const cPop = cBand.reduce((t, b) => t + (b.demography?.population ?? 0), 0);
        const fPop = fBand.reduce((t, b) => t + (b.demography?.population ?? 0), 0);
        const cReceipts = r4(cBand.reduce((t, b) => t + Number(b.seasonalFoodReceipts?.totalUsableSupport ?? 0), 0));
        const fReceipts = r4(fBand.reduce((t, b) => t + Number(b.seasonalFoodReceipts?.totalUsableSupport ?? 0), 0));
        const cFission = cBand.reduce((t, b) => t + (b.fissionEvents ?? []).length, 0);
        const fFission = fBand.reduce((t, b) => t + (b.fissionEvents ?? []).length, 0);

        // §10 — exactly one terminal class, most consequential wins in the report.
        let classification = "WRITE_SUPPRESSED_NO_READER";

        if (firstDivergenceDay !== null) {
          classification = "ACTUAL_READER_READ_BUT_INERT";
        }
        if (firstDecisionDivergenceDay !== null) {
          // A DIFFERENT production decision identity/action — not a candidate set, not an
          // influence array, not a ranking. This is the exact production event §10 requires.
          classification = "SELECTED_ACTION_CHANGED";
        }
        if (
          firstDecisionDivergenceDay !== null &&
          control.trace[control.trace.length - 1] !== cf.trace[cf.trace.length - 1]
        ) {
          classification = "PHYSICAL_ACTION_CHANGED";
        }
        if (cReceipts !== fReceipts) classification = "RECEIPT_OR_SUPPORT_CHANGED";
        if (cPop !== fPop || cFission !== fFission) classification = "DEMOGRAPHY_CHANGED";

        acc.byClass[classification] += 1;
        totals.byClass[classification] += 1;

        rows.push({
          scenario: scenario.name,
          seed,
          recordEventId: rec.recordEventId,
          tileId: rec.tileId,
          expeditionId: rec.expeditionId,
          returnDay: rec.createdDay,
          newOrRefreshed: rec.isNewRecord ? "new" : "refreshed",
          followedToDay: followTo,
          controlSound: true,
          firstDivergenceDay,
          firstDecisionDivergenceDay,
          population: [cPop, fPop],
          receipts: [cReceipts, fReceipts],
          fissions: [cFission, fFission],
          classification,
        });
      }
    }

    perScenario[scenario.name] = acc;
    console.log(
      `${scenario.name.padEnd(20)} events=${String(acc.events).padStart(3)} sound=${String(acc.sound).padStart(3)} ` +
        CLASSES.filter((c) => acc.byClass[c] > 0).map((c) => `${c}=${acc.byClass[c]}`).join(" "),
    );
  }

  const result = {
    instrument: "SINGLE-RECORD RETURN-WRITER REPLAY",
    note:
      "One write event suppressed at the canonical writer; everything downstream derived naturally. No store manually stripped. Control arm must reproduce the baseline day for day.",
    years: YEARS,
    seeds: SEEDS,
    followDays: FOLLOW_DAYS,
    bins: BINS === "" ? null : BINS,
    scenarios: SCENARIOS.map((s) => s.name),
    totals,
    perScenario,
    rows,
  };

  mkdirSync(OUT.split("/").slice(0, -1).join("/"), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);

  console.log("");
  console.log(`replay events                : ${totals.events}`);
  console.log(`control replay SOUND         : ${totals.sound}`);
  console.log(`control replay UNSOUND       : ${totals.unsound}  (excluded, never averaged in)`);
  for (const c of CLASSES) {
    if (totals.byClass[c] > 0 || c === "PHYSICAL_ACTION_CHANGED") {
      console.log(`  ${c.padEnd(32)} ${totals.byClass[c]}`);
    }
  }
  console.log(`wrote ${OUT}`);
} finally {
  await server.close();
}
