// CORRECTION-18 §6 — FIRST-DIVERGENCE AUDIT.
//
// §6 forbids starting from the final population difference and reasoning backward. This
// audit runs the enabled and disabled arms IN LOCKSTEP on the same seed and reports the
// FIRST tick at which they differ, per field, per category — so the causal ORDER of the
// divergence is observed rather than assumed.
//
// The first divergence overall is expected and uninformative: the enabled arm raises an
// exploratory party, so `expeditions` / `lastFrontierExplorationTick` differ immediately.
// What matters is the first divergence in each DOWNSTREAM category, because that ordering
// is what distinguishes:
//
//   expedition LABOR   — the party's absence changes same-day work before any knowledge
//                        comes home, so activity/support/receipts diverge FIRST and
//                        residential knowledge diverges LATER (or not at all);
//   returned KNOWLEDGE — residential knowledge diverges FIRST (at a physical return) and
//                        movement/opportunity/activity divergence follows it.
//
// Categories are exactly the §6 list. Every compared field names its authoritative writer.
//
// Usage: node scripts/frontierFirstDivergenceAudit.mjs
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const WARMUP_YEARS = 0;
const DAILY_DAYS = 5400; // ~15 years of daily steps from a common origin
const SEEDS = ["c18:a", "c18:b", "c18:c"];
const MAPS = ["map1", "map2"];

const r4 = (v) => Math.round((v ?? 0) * 10000) / 10000;

// field -> { category, writer }. The writer is the authoritative production module that
// owns the field, recorded so the report can name a writer/reader chain rather than a hash.
const FIELDS = [
  // exploration lifecycle
  ["frontierExpeditionCount", "exploration_lifecycle", "expedition.ts maybeLaunchFrontierExploration"],
  ["anyExpeditionCount", "exploration_lifecycle", "expedition.ts applyExpeditionDay"],
  ["lastFrontierExplorationTick", "exploration_lifecycle", "expedition.ts maybeLaunchFrontierExploration"],
  ["expeditionOutcomeCount", "exploration_lifecycle", "expedition.ts applyExpeditionDay"],
  ["committedExpeditionWorkers", "exploration_lifecycle", "expedition.ts getCommittedExpeditionWorkers"],
  // residential knowledge
  ["observedTileCount", "residential_knowledge", "tileObservation.ts observeTileAndNearby"],
  ["observedTileMaxDistance", "residential_knowledge", "tileObservation.ts observeTileAndNearby"],
  // resource knowledge
  ["patchMemoryCount", "resource_knowledge", "resourceKnowledge.ts"],
  ["patchMemoryMaxDistance", "resource_knowledge", "resourceKnowledge.ts"],
  // movement decision
  ["position", "movement_decision", "bandDecision.ts / campMovement.ts"],
  ["travelCorridorCount", "movement_decision", "bandDecision.ts"],
  // activity selection
  ["intraSeasonTripCount", "activity_selection", "intraSeasonTrips.ts"],
  ["walkedKmTotal", "activity_selection", "bandMobility.ts recordWalkingDay"],
  // pressure
  ["foodStress", "pressure", "pressure.ts / seasonalSurvival.ts"],
  ["rangeSaturation", "pressure", "carryingCapacity.ts"],
  // support
  ["rawSupportRatio", "support", "carryingCapacity.ts deriveCarryingCapacity"],
  ["receiptUsableSupport", "support", "seasonalFoodReceipts.ts"],
  ["receiptCount", "support", "seasonalFoodReceipts.ts"],
  // demography
  ["population", "demography", "demography.ts updateBandsDemographyAndFission"],
  ["netDemographicRate", "demography", "demography.ts"],
  ["workingAdults", "demography", "demography.ts"],
  // fission
  ["fissionEventCount", "fission", "demography.ts"],
  ["daughterCount", "fission", "demography.ts"],
  ["opportunityCandidateTile", "fission", "carryingCapacity.ts deriveKnownUnusedHabitat"],
  ["daughterColonizationPressure", "fission", "carryingCapacity.ts deriveDaughterColonization"],
  // viability
  ["viabilityStatus", "viability", "viability.ts"],
];

function snapshot(world) {
  const out = new Map();

  for (const band of Object.values(world.bands)) {
    const here = world.tiles[band.position];
    const dist = (tid) => {
      const t = world.tiles[tid];
      return t === undefined || here === undefined
        ? 0
        : Math.abs(t.coord.x - here.coord.x) + Math.abs(t.coord.y - here.coord.y);
    };
    const observed = Object.values(band.knowledge.observedTiles);
    const patches = band.resourceKnowledgeState?.patchMemories ?? [];
    const expeditions = band.expeditions ?? [];

    out.set(String(band.id), {
      frontierExpeditionCount: expeditions.filter((e) => e.taskKind === "frontier_exploration").length,
      anyExpeditionCount: expeditions.length,
      lastFrontierExplorationTick: Number(band.lastFrontierExplorationTick ?? -1),
      expeditionOutcomeCount: (band.recentExpeditionOutcomes ?? []).length,
      committedExpeditionWorkers: expeditions
        .filter((e) => e.phase !== "completed" && e.phase !== "aborted" && e.phase !== "lost")
        .reduce((s, e) => s + e.partyWorkers, 0),

      observedTileCount: observed.length,
      observedTileMaxDistance: observed.reduce((mx, r) => Math.max(mx, dist(r.tileId)), 0),

      patchMemoryCount: patches.length,
      patchMemoryMaxDistance: patches.reduce((mx, p) => Math.max(mx, dist(p.approximateTile)), 0),

      position: String(band.position),
      travelCorridorCount: Object.keys(band.travelCorridors ?? {}).length,

      intraSeasonTripCount: (band.recentIntraSeasonTrips ?? []).length,
      walkedKmTotal: r4(band.mobility?.history?.totalKmWalked ?? 0),

      foodStress: r4(band.pressureState?.foodStress),
      rangeSaturation: r4(band.rangeSaturation?.saturationPressure),

      rawSupportRatio: r4(band.carryingCapacity?.perCapitaReturn?.supportDebug?.rawSupportRatio),
      receiptUsableSupport: r4(band.seasonalFoodReceipts?.totalUsableSupport),
      receiptCount: band.seasonalFoodReceipts?.receiptCount ?? 0,

      population: band.demography.population,
      netDemographicRate: r4(band.demography.netDemographicRate),
      workingAdults: band.demography.workingAdults,

      fissionEventCount: (band.fissionEvents ?? []).length,
      daughterCount: (band.daughterBandIds ?? []).length,
      opportunityCandidateTile: String(
        band.daughterColonization?.bestKnownUnusedHabitatOpportunity?.candidateTileId ?? "none",
      ),
      daughterColonizationPressure: r4(band.daughterColonization?.pressure),

      viabilityStatus: String(band.viability?.status ?? "active"),
    });
  }

  return out;
}

const server = await createServer({
  root: `${process.cwd()}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const runs = [];

  for (const map of MAPS) {
    for (const seed of SEEDS) {
      let on = runner.initSimWorld({ kind: map }, seed);
      let off = runner.initSimWorld({ kind: map }, seed);
      off = { ...off, auditOptions: { ...(off.auditOptions ?? {}), frontierExplorationEnabled: false } };

      // firstByField / firstByCategory record the earliest tick each thing diverged.
      const firstByField = new Map();
      const firstByCategory = new Map();
      let bandSetDivergedTick = null;

      // SAMPLING GRANULARITY IS THE WHOLE POINT HERE.
      //
      // Under seasonal stepping a 90-day batch resolves an entire ~10-day exploratory
      // journey — departure AND return — inside ONE step, so launch-vs-return ordering is
      // unobservable and every category appears to diverge on the same tick. That is a
      // measurement artefact, not a finding.
      //
      // So: warm both arms up seasonally to just before the first launch, then step DAILY.
      // A party departs on day D (its workers leave the residential pool immediately) and
      // returns on ~D+10 (its observations reach residential knowledge only then). Daily
      // sampling is the only granularity at which "labor first" and "knowledge first" are
      // distinguishable. Step-mode invariance (verified with full canonical state match)
      // is what makes mixing the two step modes legitimate.
      // WARMUP_YEARS is 0 deliberately. An earlier version warmed up seasonally for 40
      // years and only then began daily sampling — by which point both arms had already
      // diverged in every category, so everything trivially reported day 1. The arms are
      // identical only at tick zero, so that is where daily sampling has to start.
      for (let year = 1; year <= WARMUP_YEARS; year += 1) {
        on = runner.stepSim(on, 4, "seasonal");
        off = runner.stepSim(off, 4, "seasonal");
      }

      for (let day = 1; day <= DAILY_DAYS; day += 1) {
        on = runner.stepSim(on, 1, "daily");
        off = runner.stepSim(off, 1, "daily");

        const tick = day; // day index since the daily window opened — monotonic and readable
        const sOn = snapshot(on);
        const sOff = snapshot(off);

        if (bandSetDivergedTick === null) {
          const idsOn = [...sOn.keys()].sort().join(",");
          const idsOff = [...sOff.keys()].sort().join(",");
          if (idsOn !== idsOff) bandSetDivergedTick = tick;
        }

        // Compare only bands present in BOTH arms — once the band sets differ, a missing
        // band is a consequence, not a new field divergence.
        if (firstByCategory.size >= 10) break;

        for (const [id, a] of sOn) {
          const b = sOff.get(id);
          if (b === undefined) continue;

          for (const [field, category, writer] of FIELDS) {
            if (a[field] === b[field]) continue;
            if (firstByField.has(field)) continue;

            firstByField.set(field, {
              field,
              category,
              writer,
              tick,
              day,
              bandId: id,
              enabledValue: a[field],
              disabledValue: b[field],
            });

            if (!firstByCategory.has(category)) {
              firstByCategory.set(category, { category, tick, day, field, bandId: id, writer });
            }
          }
        }
      }

      const ordered = [...firstByField.values()].sort((x, y) => x.tick - y.tick);
      const categoriesOrdered = [...firstByCategory.values()].sort((x, y) => x.tick - y.tick);

      // §6 attribution: did the FIRST physical/behavioural divergence precede or follow
      // the first residential-knowledge divergence?
      const knowledgeTick = firstByCategory.get("residential_knowledge")?.tick ?? Infinity;
      const physicalCategories = ["activity_selection", "support", "movement_decision"];
      const physicalTick = Math.min(
        ...physicalCategories.map((c) => firstByCategory.get(c)?.tick ?? Infinity),
      );
      const attribution =
        physicalTick === Infinity && knowledgeTick === Infinity
          ? "no_downstream_divergence"
          : physicalTick < knowledgeTick
            ? "EXPEDITION_LABOR — physical/behavioural divergence precedes any residential knowledge divergence"
            : knowledgeTick < physicalTick
              ? "RETURNED_KNOWLEDGE — residential knowledge diverges before any physical/behavioural divergence"
              : "SIMULTANEOUS — both diverge on the same tick; not separable by ordering alone";

      runs.push({
        map,
        seed,
        firstDivergenceOverall: ordered[0] ?? null,
        firstByCategory: categoriesOrdered,
        firstByField: ordered,
        bandSetDivergedTick,
        firstResidentialKnowledgeTick: knowledgeTick === Infinity ? null : knowledgeTick,
        firstPhysicalOrBehaviouralTick: physicalTick === Infinity ? null : physicalTick,
        attribution,
      });

      console.log(
        `[${map}][${seed}] first=${ordered[0]?.field ?? "none"}@t${ordered[0]?.tick ?? "-"} ` +
          `knowledge@t${knowledgeTick === Infinity ? "-" : knowledgeTick} ` +
          `physical@t${physicalTick === Infinity ? "-" : physicalTick} ` +
          `bandSet@t${bandSetDivergedTick ?? "-"} => ${attribution.split(" —")[0]}`,
      );
    }
  }

  const tally = {};
  for (const r of runs) {
    const k = r.attribution.split(" —")[0];
    tally[k] = (tally[k] ?? 0) + 1;
  }

  const result = {
    audit: "frontierFirstDivergence",
    checkpoint: "CORRECTION-18 §6",
    warmupYears: WARMUP_YEARS,
    dailyDaysSampled: DAILY_DAYS,
    tickEncoding: "day index since the daily sampling window opened (after the seasonal warm-up)",
    seeds: SEEDS,
    maps: MAPS,
    method:
      "Enabled and disabled arms stepped in lockstep on the same seed; the first tick each " +
      "field and each category diverges is recorded. The final population difference is " +
      "never used as an input.",
    categories: [
      "exploration_lifecycle",
      "residential_knowledge",
      "resource_knowledge",
      "movement_decision",
      "activity_selection",
      "pressure",
      "support",
      "demography",
      "fission",
      "viability",
      "read_model_only",
    ],
    runs,
    attributionTally: tally,
  };

  mkdirSync(join(process.cwd(), "docs/evidence/correction18"), { recursive: true });
  writeFileSync(
    join(process.cwd(), "docs/evidence/correction18/first-divergence.json"),
    `${JSON.stringify(result, null, 2)}\n`,
  );

  console.log("");
  console.log("── §6 FIRST DIVERGENCE ──");
  console.log(`attribution tally: ${JSON.stringify(tally)}`);
  const sample = runs[0];
  if (sample !== undefined) {
    console.log(`sample [${sample.map}][${sample.seed}] category order:`);
    for (const c of sample.firstByCategory) {
      console.log(`   t${String(c.tick).padStart(4)}  ${c.category.padEnd(24)} first field: ${c.field}  (${c.writer})`);
    }
  }
} finally {
  await server.close();
}
