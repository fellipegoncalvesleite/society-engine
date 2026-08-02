// CORRECTION-34A §12 P27 — all FOUR internal step modes, not just daily vs seasonal.
//
// `stepModeInvarianceAudit.mjs` proves daily == seasonal with a full canonical-state match. P27
// asks for daily, weekly, monthly AND seasonal, because all four are supposed to be BATCH SIZES
// over the same daily kernel (advanceWorldByDays -> runDailyActions -> seasonal boundary), never
// separate behavioural models. This audit runs the identical world under all four and compares the
// canonical state, so the claim is measured rather than asserted from the call graph.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const OUT = arg("out", "docs/evidence/shared-use-physical-presence-authority-34/step-mode-four-way.json");
const YEARS = Number(arg("years", "6"));

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c34a-4way-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");

  // The canonical projection: everything a band physically IS, plus the presence-relevant state
  // this checkpoint touched. Deliberately not a narrow fingerprint — CORRECTION-16's admissibility
  // rule forbids calling a 10-field projection "canonical state".
  const canonical = (world) => JSON.stringify({
    tick: Number(world.time.tick),
    day: Number(world.time.day ?? 0),
    bands: Object.values(world.bands)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .map((b) => ({
        id: String(b.id),
        position: String(b.position),
        status: b.status,
        viability: b.viability?.status,
        population: b.demography?.population,
        workingAdults: b.demography?.workingAdults,
        dependents: b.demography?.dependents,
        elders: b.demography?.elders,
        expeditions: (b.expeditions ?? []).map((e) => ({
          id: String(e.id), phase: e.phase, partyWorkers: e.partyWorkers,
          positionTileId: String(e.positionTileId ?? ""), routeIndex: e.routeIndex,
          provisions: e.cargo?.provisionUnitsConsumed, harvest: e.cargo?.harvestUnits,
        })),
        outcomes: (b.recentExpeditionOutcomes ?? []).map((o) => String(o.id)).sort(),
        tripCount: (b.recentIntraSeasonTrips ?? []).length,
        seasonalReceipts: b.seasonalFoodReceipts?.periodTick ?? null,
      })),
    depletionKeys: Object.keys(world.depletion ?? {}).length,
  });

  // INSTRUMENT NOTE: `stepSim(world, steps, mode)` advances `steps` units OF THAT MODE, not days.
  // A first version of this probe passed the same step count to all four and compared 24 days
  // against 24 seasons — it reported DIVERGENT with ticks 0/1/8/24, which measured its own unequal
  // time spans, not production. The comparison must equalise SIMULATED DAYS.
  //
  // 630 is the LCM of the four mode lengths (daily 1, weekly 7, monthly 30, seasonal 90), so a
  // multiple of 630 days is expressible as a whole number of steps in every mode.
  const MODE_DAYS = { daily: 1, weekly: 7, monthly: 30, seasonal: 90 };
  const SPAN_DAYS = 630 * Math.max(1, Math.round((YEARS * 360) / 630));
  const modes = ["daily", "weekly", "monthly", "seasonal"];
  const results = {};
  for (const mode of modes) {
    const world = runner.initSimWorld({ kind: "map2" }, "c34a:stepmode");
    const steps = SPAN_DAYS / MODE_DAYS[mode];
    if (!Number.isInteger(steps)) throw new Error(`span ${SPAN_DAYS} not expressible in ${mode}`);
    const stepped = runner.stepSim(world, steps, mode);
    results[mode] = { canonical: canonical(stepped), tick: Number(stepped.time.tick), steps };
  }

  const reference = results.daily.canonical;
  const comparisons = modes.map((mode) => ({
    mode,
    steps: results[mode].steps,
    tick: results[mode].tick,
    matchesDaily: results[mode].canonical === reference,
    bytes: results[mode].canonical.length,
  }));
  const allMatch = comparisons.every((c) => c.matchesDaily);

  out = {
    audit: "CORRECTION-34A-P27-FOUR-WAY-STEP-MODE",
    years: YEARS, spanDays: SPAN_DAYS, scenario: "map2", seed: "c34a:stepmode",
    verdict: allMatch ? "ALL_FOUR_STEP_MODES_IDENTICAL" : "DIVERGENT",
    reference: "daily",
    comparisons,
    interpretation:
      "daily, weekly, monthly and seasonal are batch sizes over one daily kernel " +
      "(advanceWorldByDays -> runDailyActions -> seasonal boundary processing). Identical canonical " +
      "state under all four is what makes that a measured fact rather than a call-graph claim.",
    instrumentNote:
      "stepSim advances `steps` units OF THE GIVEN MODE, not days. A first version of this probe " +
      "passed the same step count to all four modes and compared 24 days against 24 seasons, " +
      "reporting DIVERGENT with ticks 0/1/8/24 — it was measuring its own unequal spans. The span " +
      "is now a multiple of 630 days, the LCM of the four mode lengths, so every mode runs the " +
      "identical simulated time.",
    projectionNote:
      "the compared projection includes band position, status, viability, full demography, every " +
      "expedition's phase/workers/position/route index/provisions/harvest, terminal outcome ids, " +
      "trip-record count, seasonal-receipt period and the depletion key count",
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
} finally {
  await server.close();
}

console.log(JSON.stringify({ verdict: out.verdict, comparisons: out.comparisons }, null, 2));
if (out.verdict !== "ALL_FOUR_STEP_MODES_IDENTICAL") process.exitCode = 1;
