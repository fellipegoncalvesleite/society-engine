// CORRECTION-35 PART B — does `Band.territorialPressure` move behaviour, and where does it come
// from?
//
// The field is written at spawn as a constant and inherited by daughters. No lived shared-range
// process writes it. This probe does not infer impact from the existence of a coefficient: it
// varies ONLY that field on an otherwise byte-identical band and measures what production returns.
//
// Arm-neutral: the identical file runs on both trees.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/shared-range-release-territorial-authority-35";
const PHASE = arg("phase", "before");
const OUT = arg("out", `${EVIDENCE}/territorial-pressure-${PHASE}.json`);
const SEED = arg("seed", "audit27:natural:s1");
const WARM_DAYS = Number(arg("warm-days", "3600"));
const VALUES = arg("values", "0,0.12,0.8").split(",").map(Number);

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c35b-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const pressure = await server.ssrLoadModule("/sim/agents/pressure.ts");
  const bandDecision = await server.ssrLoadModule("/sim/rules/bandDecision.ts");
  const mobilityIntent = await server.ssrLoadModule("/sim/rules/mobilityIntent.ts");
  const contextCache = await server.ssrLoadModule("/sim/agents/contextCache.ts");

  const round4 = (v) => (typeof v === "number" ? Math.round(v * 10000) / 10000 : v);

  let world = runner.initSimWorld({ kind: "map2" }, SEED);
  world = advance.advanceWorldByDays(world, WARM_DAYS);

  const living = Object.values(world.bands)
    .filter((b) => b.status !== "dispersed" && b.viability?.status !== "extinct" && b.viability?.status !== "absorbed")
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  if (living.length === 0) throw new Error("no living band to measure");

  // Everything except the one field is held identical: the same world, the same band object, the
  // same tick cache. Only `territorialPressure` is substituted.
  const measure = (band, value) => {
    const probeBand = { ...band, territorialPressure: value };
    const probeWorld = { ...world, bands: { ...world.bands, [band.id]: probeBand } };
    const cache = contextCache.buildTickContextCache(probeWorld);
    const state = pressure.deriveBandPressureState(probeWorld, probeBand, cache);
    const decision = bandDecision.evaluateBandDecision(probeWorld, probeBand, cache);
    const intent = mobilityIntent.evaluateMobilityIntent(probeWorld, probeBand);
    const candidates = (decision.alternativesConsidered ?? []).map((c) => ({
      type: String(c.actionType ?? c.action?.type ?? "?"),
      target: String(c.targetTileId ?? c.action?.targetTileId ?? "-"),
      score: round4(c.score),
    })).sort((a, b) => a.type.localeCompare(b.type) || a.target.localeCompare(b.target));
    return {
      territorialPressure: value,
      mobilityPressure: round4(state.mobilityPressure),
      netMovePressure: round4(state.netMovePressure),
      riskPressure: round4(state.riskPressure),
      crowdingPenalty: round4(state.crowdingPenalty ?? 0),
      nearbyBandPressure: round4(state.nearbyBandPressure ?? 0),
      selectedAction: String(decision.action?.type ?? "?"),
      selectedTarget: String(decision.action?.targetTileId ?? "-"),
      decisionScore: round4(decision.score),
      candidateCount: candidates.length,
      candidates,
      primaryReasonType: String(decision.primaryReason?.detail?.type ?? decision.primaryReason?.type ?? "?"),
      primaryReasonPressure: round4(decision.primaryReason?.detail?.pressure ?? 0),
      // `MobilityContext` is module-private, so its mobilityPressure cannot be read directly. The
      // OBSERVABLE surface is used instead: the lifecycle reason production stamps with
      // `context.mobilityPressure`, plus the intent status and the intent it opened.
      intentStatus: String(intent?.status ?? "?"),
      intentKind: String(intent?.activeIntent?.kind ?? "-"),
      intentReasonPressure: round4(intent?.lifecycleReason?.detail?.pressure ?? -1),
    };
  };

  const perBand = living.slice(0, 4).map((band) => {
    const rows = VALUES.map((v) => measure(band, v));
    const base = rows[0];
    const varies = (key) => rows.some((r) => r[key] !== base[key]);
    return {
      band: String(band.id),
      spawnValue: round4(band.territorialPressure),
      rows,
      movesMobilityPressure: varies("mobilityPressure"),
      movesNetMovePressure: varies("netMovePressure"),
      movesDecisionScore: varies("decisionScore"),
      movesSelectedAction: varies("selectedAction") || varies("selectedTarget"),
      movesCandidateScores: rows.some((r) => JSON.stringify(r.candidates) !== JSON.stringify(base.candidates)),
      movesReasonAttribution: varies("primaryReasonPressure"),
      movesIntentPressure: varies("intentReasonPressure") || varies("intentStatus") || varies("intentKind"),
    };
  });

  const anyBehaviour = perBand.some((b) =>
    b.movesMobilityPressure || b.movesNetMovePressure || b.movesDecisionScore ||
    b.movesSelectedAction || b.movesCandidateScores || b.movesIntentPressure);

  // ── the field inventory, read from the tree rather than remembered ──────────────────────────
  const inventory = [
    { field: "Band.territorialPressure", writers: ["spawn.ts:922 — constant 0.12 at band creation",
        "demography.ts:1008 — daughter inheritance clamp01(parent * 0.72 + 0.04)"],
      cadence: "once at spawn; once more at fission", provenance: "NONE — no lived shared-range process writes it",
      readers: [
        "pressure.ts:293 — mobilityPressure += territorialPressure * 0.08  (DECISION: -> netMovePressure -> candidate score)",
        "rules/mobilityIntent.ts:930 — mobilityPressure += territorialPressure * 0.12  (DECISION: -> intent candidate scores and the 0.44 expansion threshold)",
        "rules/bandDecision.ts:5544 — getMobilityPressure += territorialPressure * 0.14  (ATTRIBUTION: fills a reason record's `pressure` field only)",
        "rules/bandDecision.ts:5225 — copied into DecisionContextSnapshot (record only, no reader)",
        "agents/campMovement.ts:1708 — copied into a DecisionContextSnapshot (record only, no reader)",
        "runner/simRunner.ts:480 — copied into the UI projection (read-only)",
      ],
      changesFromLivedEvidence: false,
      alreadyOwnedByAnAcceptedSignal: "yes — crowding (getCrowdingPenalty), friction (rangeFriction) and access expectation (accessNorms) already own every shared-range consequence Item 3 recognises" },
    { field: "SocialPressureProfile.territorialPressure", writers: ["spawn.ts:1266 — constant 0.08 inside getInitialSocialPressure()",
        "demography.ts:2300 applyDemographyToSocialPressure spreads ...socialPressure, so it is carried forward unchanged forever"],
      cadence: "once at spawn", provenance: "NONE",
      readers: [], changesFromLivedEvidence: false,
      alreadyOwnedByAnAcceptedSignal: "n/a — it has no reader at all" },
    { field: "DecisionContextSnapshot.territorialPressure", writers: ["copied from Band.territorialPressure at bandDecision.ts:5225 and campMovement.ts:1708"],
      cadence: "per decision record", provenance: "copy", readers: [],
      changesFromLivedEvidence: false, alreadyOwnedByAnAcceptedSignal: "n/a — projection" },
  ];

  out = {
    audit: "CORRECTION-35B-TERRITORIAL-PRESSURE-AUTHORITY",
    phase: PHASE, seed: SEED, warmDays: WARM_DAYS, valuesTested: VALUES,
    headline: anyBehaviour ? "ORPHAN TERRITORIAL PRESSURE MOVES BEHAVIOR" : "TERRITORIAL PRESSURE IS BEHAVIORALLY INERT",
    inventory,
    inventoryNote: "the prompt named two behavioural readers; there are THREE, and they are not equivalent. pressure.ts and mobilityIntent.ts reach the DECISION; bandDecision.ts:5544 only fills a reason record's `pressure` field and is ATTRIBUTION. The two copies and the UI projection have no reader at all.",
    perBand,
    anyBehaviouralEffect: anyBehaviour,
    heldConstant: ["world", "band object except the one field", "tick context cache", "crowding", "encounters", "friction", "access memory", "population", "food", "water", "ecology", "place memory", "known tiles"],
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
} finally {
  await server.close();
}

console.log(JSON.stringify({
  phase: out.phase, headline: out.headline,
  perBand: out.perBand.map((b) => ({ band: b.band, spawn: b.spawnValue,
    mobility: b.rows.map((r) => r.mobilityPressure), netMove: b.rows.map((r) => r.netMovePressure),
    intent: b.rows.map((r) => r.intentReasonPressure), intentStatus: b.rows.map((r) => r.intentStatus),
    score: b.rows.map((r) => r.decisionScore), action: b.rows.map((r) => r.selectedAction),
    reasonPressure: b.rows.map((r) => r.primaryReasonPressure),
    moves: { mobility: b.movesMobilityPressure, netMove: b.movesNetMovePressure,
      score: b.movesDecisionScore, action: b.movesSelectedAction,
      candidates: b.movesCandidateScores, intent: b.movesIntentPressure,
      attribution: b.movesReasonAttribution } })),
}, null, 2));
