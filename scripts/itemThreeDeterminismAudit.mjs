// ROADMAP ITEM 3 — determinism and time-mode equivalence, with the Item 3 systems ACTUALLY
// OCCURRING in the compared window.
//
// Four-way agreement over a span containing none of the behaviour under audit is an identity
// claim about nothing. This audit therefore reports, for the compared daily run, how much
// expedition target work, how many active party-days and how much friction/release activity
// actually happened — and refuses to call the result non-vacuous without them.
//
// Fresh-process determinism is delegated to a child process so it is a genuinely separate
// process, not a second call inside this one.
import { createServer } from "vite";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/shared-range-item-3-final-freeze";
const OUT = arg("out", `${EVIDENCE}/integrated-four-way.json`);
const OUT_FRESH = arg("out-fresh", `${EVIDENCE}/integrated-fresh-process-determinism.json`);
const SEED = arg("seed", "audit27:natural:map2:s1");
// 2520 = 4 x 630, the smallest multiple of every mode stride at which this world's expeditions
// have actually exploited a target (CORRECTION-34E measured the first one after day 720).
const SPAN = Number(arg("span", "2520"));
const CHILD = process.argv.includes("--child");

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-item3-det-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
let fresh;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const mobility = await server.ssrLoadModule("/sim/agents/bandMobility.ts");

  // The canonical projection compared across modes and processes. Deliberately includes the
  // Item 3 quantities: presence-bearing expedition state, friction and encounter rings, contact
  // memory, and the outcome ring — not just position and population.
  const canon = (w) => JSON.stringify(Object.values(w.bands)
    .sort((x, y) => String(x.id).localeCompare(String(y.id)))
    .map((b) => ({
      id: String(b.id), pos: String(b.position), status: String(b.status ?? ""),
      viability: String(b.viability?.status ?? ""),
      pop: b.demography?.population, wa: b.demography?.workingAdults,
      elders: b.demography?.elders, deps: b.demography?.dependents,
      exp: (b.expeditions ?? []).map((e) =>
        `${e.phase}:${e.partyWorkers}:${e.nonWorkingPartyPeople ?? 0}:${e.positionTileId ?? "-"}:${e.workDaysElapsed ?? 0}`),
      out: (b.recentExpeditionOutcomes ?? []).map((o) =>
        `${o.outcomeReason}:${o.deliveredHarvestUnits}:${o.partyWorkers}:${o.partyPeople ?? "-"}`),
      friction: (b.recentRangeFrictionEvents ?? []).map((e) =>
        `${e.eventId}:${e.interpretation}:${e.tensionLevel}`),
      encounters: (b.encounterRecords ?? []).length,
      contacts: Object.keys(b.contactMemories ?? {}).sort().join(","),
      trips: (b.recentIntraSeasonTrips ?? []).length,
    })));

  const occurrence = (w) => {
    const bands = Object.values(w.bands);
    return {
      exploitationOutcomes: bands.reduce((n, b) => n + (b.recentExpeditionOutcomes ?? [])
        .filter((o) => o.taskKind !== "frontier_exploration" && o.taskKind !== "frontier_verification").length, 0),
      outcomesDeliveringHarvest: bands.reduce((n, b) => n + (b.recentExpeditionOutcomes ?? [])
        .filter((o) => (o.deliveredHarvestUnits ?? 0) > 0).length, 0),
      activePartiesAtEnd: bands.reduce((n, b) => n + (b.expeditions ?? [])
        .filter((e) => mobility.isPhysicallyAwayPhase(e.phase)).length, 0),
      frictionRecords: bands.reduce((n, b) => n + (b.recentRangeFrictionEvents ?? []).length, 0),
      encounterRecords: bands.reduce((n, b) => n + (b.encounterRecords ?? []).length, 0),
      contactMemories: bands.reduce((n, b) => n + Object.keys(b.contactMemories ?? {}).length, 0),
      livingBands: bands.filter((b) => b.status !== "dispersed" && b.viability?.status !== "extinct").length,
    };
  };

  if (CHILD) {
    // Fresh-process arm: emit only the digest so the parent can compare across process boundaries.
    let w = runner.initSimWorld({ kind: "map2" }, SEED);
    w = runner.stepSim(w, SPAN, "daily");
    process.stdout.write(createHash("sha256").update(canon(w)).digest("hex"));
    await server.close();
    process.exit(0);
  }

  // ── four-way time-mode equivalence ──────────────────────────────────────────────────────────
  const MODE_DAYS = { daily: 1, weekly: 7, monthly: 30, seasonal: 90 };
  const digests = {};
  let dailyOccurrence = null;
  for (const [mode, stride] of Object.entries(MODE_DAYS)) {
    if (SPAN % stride !== 0) throw new Error(`span ${SPAN} is not divisible by the ${mode} stride ${stride}`);
    let w = runner.initSimWorld({ kind: "map2" }, SEED);
    w = runner.stepSim(w, SPAN / stride, mode);
    digests[mode] = createHash("sha256").update(canon(w)).digest("hex");
    if (mode === "daily") dailyOccurrence = occurrence(w);
  }
  const allMatch = Object.values(digests).every((d) => d === digests.daily);

  // ── daily repeat determinism, same process ──────────────────────────────────────────────────
  const repeat = (() => {
    let w = runner.initSimWorld({ kind: "map2" }, SEED);
    w = runner.stepSim(w, SPAN, "daily");
    return createHash("sha256").update(canon(w)).digest("hex");
  })();

  const occurred = dailyOccurrence.exploitationOutcomes > 0 &&
    dailyOccurrence.activePartiesAtEnd + dailyOccurrence.outcomesDeliveringHarvest > 0;

  out = {
    audit: "ROADMAP-ITEM-3-TIME-MODE-EQUIVALENCE",
    seed: SEED, spanDays: SPAN,
    digests,
    allFourModesIdentical: allMatch,
    dailyRepeatIdentical: repeat === digests.daily,
    occurrenceInTheComparedRun: dailyOccurrence,
    verdict: !allMatch ? "DIVERGENT"
      : occurred ? "ALL_FOUR_MODES_IDENTICAL_WITH_ITEM_3_BEHAVIOUR_PRESENT"
        : "IDENTICAL_BUT_ITEM_3_BEHAVIOUR_ABSENT_FROM_THE_SPAN",
    nonVacuousPredicate: occurred,
    nonVacuity: {
      predicate: "the compared daily run must actually contain expedition target work and active parties, or a four-way identity is a claim about nothing",
      exploitationOutcomes: dailyOccurrence.exploitationOutcomes,
      outcomesDeliveringHarvest: dailyOccurrence.outcomesDeliveringHarvest,
      activePartiesAtEnd: dailyOccurrence.activePartiesAtEnd,
      frictionRecords: dailyOccurrence.frictionRecords,
      encounterRecords: dailyOccurrence.encounterRecords,
    },
    canonicalProjectionIncludes: [
      "band position, status, viability", "population and every cohort",
      "every expedition's phase, productive workers, non-working members, position and work days",
      "the outcome ring including delivered harvest and party people",
      "the friction ring by event id, interpretation and tension",
      "encounter record count, contact-memory identities, trip record count",
    ],
    publicTimeControlNote: "the eventual public Day/Season simplification remains DEFERRED and is not implemented; all four internal modes are retained as batch sizes over the same daily kernel.",
  };

  // ── fresh-process determinism ───────────────────────────────────────────────────────────────
  let childDigest = null;
  let childError = null;
  try {
    childDigest = execFileSync(process.execPath,
      [process.argv[1], "--child", "--seed", SEED, "--span", String(SPAN)],
      { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, timeout: 30 * 60 * 1000 }).trim();
  } catch (error) {
    childError = String(error?.message ?? error).slice(0, 300);
  }
  fresh = {
    audit: "ROADMAP-ITEM-3-FRESH-PROCESS-DETERMINISM",
    seed: SEED, spanDays: SPAN,
    parentProcessDigest: digests.daily,
    freshProcessDigest: childDigest,
    identical: childDigest !== null && childDigest === digests.daily,
    childError,
    method: "the same script re-invoked as a genuinely separate OS process via execFileSync --child, which builds its own Vite SSR module graph and its own world",
    occurrenceInTheComparedRun: dailyOccurrence,
    nonVacuousPredicate: occurred && childDigest !== null,
    nonVacuity: { predicate: "the compared run contains real Item 3 behaviour and the child process actually produced a digest",
      exploitationOutcomes: dailyOccurrence.exploitationOutcomes, childProduced: childDigest !== null },
    verdict: childError !== null ? "NOT_RUN_CHILD_PROCESS_FAILED"
      : childDigest === digests.daily ? "FRESH_PROCESS_IDENTICAL" : "FRESH_PROCESS_DIVERGED",
  };

  for (const [p, data] of [[OUT, out], [OUT_FRESH, fresh]]) {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  }
} finally {
  await server.close();
}

console.log(JSON.stringify({
  fourWay: { verdict: out.verdict, allMatch: out.allFourModesIdentical,
    dailyRepeatIdentical: out.dailyRepeatIdentical, occurrence: out.occurrenceInTheComparedRun },
  freshProcess: { verdict: fresh.verdict, identical: fresh.identical },
}, null, 2));
if (!out.allFourModesIdentical || !out.dailyRepeatIdentical || fresh.identical !== true || out.nonVacuousPredicate !== true) {
  process.exitCode = 1;
}
