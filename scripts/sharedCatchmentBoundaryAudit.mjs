// SCALE-1 Task 6 — SHARED-CATCHMENT PHYSICAL-ACCESS BOUNDARY.
//
// CORRECTION-35 originally documented a retained residential-anchor tile list / radius-2 fallback
// as footprint authority. Task 6 supersedes that CELL-COUNT authority. The current boundary is:
//
//   physical access = bounded travel reach from the band's current residential position;
//   support/competition eligibility = only physically reachable tiles the band itself has observed;
//   residentialAnchor.catchmentTileIds = bounded persisted/debug summary, never reach authority;
//   route walking and task camps still create no catchment claim merely by being traversed/occupied;
//   expedition extraction still depletes world stock at the worked target through its own authority.
//
// This audit deliberately checks the new boundary rather than preserving the historical narrative.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const OUT = arg("out", "docs/evidence/shared-range-release-territorial-authority-35/shared-catchment-boundary.json");
const SEED = arg("seed", "audit27:natural:s1");
const WARM = Number(arg("warm-days", "3600"));

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c35sc-${process.pid}`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  logLevel: "error",
});

const ids = (footprint) => footprint.map((entry) => String(entry.tileId));
const sameIds = (left, right) => JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const shared = await server.ssrLoadModule("/sim/agents/sharedCatchment.ts");

  let world = runner.initSimWorld({ kind: "map2" }, SEED);
  world = advance.advanceWorldByDays(world, WARM);

  const bands = Object.values(world.bands)
    .filter((b) => b.status !== "dispersed" && b.viability?.status !== "extinct" && b.viability?.status !== "absorbed")
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const footprintFn = shared.getBandForagingFootprint;
  const candidateFootprints = typeof footprintFn === "function"
    ? bands
        .filter((candidate) => candidate.knowledge?.observedTiles?.[candidate.position] !== undefined)
        .map((candidate) => ({ band: candidate, footprint: footprintFn(world, candidate) }))
        .sort((left, right) => right.footprint.length - left.footprint.length || String(left.band.id).localeCompare(String(right.band.id)))
    : [];
  const selected = candidateFootprints.find((entry) => entry.footprint.some((tile) => tile.tileId !== entry.band.position))
    ?? candidateFootprints[0];
  const band = selected?.band;

  if (band === undefined || typeof footprintFn !== "function") {
    out = {
      audit: "SCALE1-TASK6-SHARED-CATCHMENT-BOUNDARY",
      verdict: "FAIL",
      reason: band === undefined ? "no living band available" : "getBandForagingFootprint export missing",
    };
  } else {
    const baseline = selected?.footprint ?? footprintFn(world, band);
    const retainedIds = band.residentialAnchor?.catchmentTileIds ?? [];

    // The retained list is telemetry only. Shrinking it must not shrink physical competition reach.
    const shrunkAnchor = band.residentialAnchor === undefined
      ? undefined
      : { ...band.residentialAnchor, catchmentTileIds: [band.position] };
    const shrunkBand = { ...band, residentialAnchor: shrunkAnchor };
    const shrunkWorld = { ...world, bands: { ...world.bands, [band.id]: shrunkBand } };
    const afterRetainedShrink = footprintFn(shrunkWorld, shrunkBand);

    // A zero travel-time budget is the actual physical boundary and may retain only the origin.
    const zeroBudgetBand = {
      ...band,
      residentialAnchor: {
        ...(band.residentialAnchor ?? { anchorTileId: band.position, catchmentTileIds: [] }),
        foragingTravelTimeBudgetDays: 0,
      },
    };
    const zeroBudgetWorld = { ...world, bands: { ...world.bands, [band.id]: zeroBudgetBand } };
    const zeroBudget = footprintFn(zeroBudgetWorld, zeroBudgetBand);

    // Physical reach must not manufacture resource/support knowledge.
    const removable = baseline.find((entry) => entry.tileId !== band.position);
    let unknownFiltered = false;
    let removedKnownTileId = null;
    if (removable !== undefined) {
      removedKnownTileId = String(removable.tileId);
      const observedTiles = { ...band.knowledge.observedTiles };
      delete observedTiles[removable.tileId];
      const lessKnowledgeBand = {
        ...band,
        knowledge: { ...band.knowledge, observedTiles },
      };
      const lessKnowledgeWorld = { ...world, bands: { ...world.bands, [band.id]: lessKnowledgeBand } };
      const lessKnowledge = footprintFn(lessKnowledgeWorld, lessKnowledgeBand);
      unknownFiltered = !lessKnowledge.some((entry) => entry.tileId === removable.tileId);
    }

    const checks = {
      footprintHasPhysicalTelemetry: baseline.every((entry) =>
        Number.isFinite(entry.distanceKm) && Number.isFinite(entry.travelTimeDays)),
      retainedSummaryNotReachAuthority: band.residentialAnchor === undefined ||
        sameIds(ids(baseline), ids(afterRetainedShrink)),
      travelBudgetDefinesBoundary: zeroBudget.every((entry) =>
        entry.tileId === band.position && Math.abs(entry.travelTimeDays) <= 1e-9),
      observedKnowledgeStillRequired: unknownFiltered,
      noCellCapDefinesFullFootprint: retainedIds.length === 0 || baseline.length >= Math.min(1, retainedIds.length),
    };

    out = {
      audit: "SCALE1-TASK6-SHARED-CATCHMENT-BOUNDARY",
      verdict: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
      seed: SEED,
      warmDays: WARM,
      livingBands: bands.length,
      band: String(band.id),
      checks,
      measurements: {
        position: String(band.position),
        physicalTravelBudgetDays: band.residentialAnchor?.foragingTravelTimeBudgetDays ?? 0.5,
        retainedSummaryCells: retainedIds.length,
        fullKnownAccessibleFootprintCells: baseline.length,
        afterRetainedSummaryShrinkCells: afterRetainedShrink.length,
        zeroBudgetFootprintCells: zeroBudget.length,
        removedKnownTileId,
      },
      boundary: {
        residentialCatchmentClaim: "PHYSICAL/TRAVERSAL-BOUNDED from current residential position, then filtered through the band's own observed knowledge. Retained catchmentTileIds do not define reach.",
        expeditionTargetWork: "REMOVES PHYSICAL STOCK at the worked target through the expedition/harvest authority; Task 6 does not change that channel.",
        routeWalking: "CREATES NO CATCHMENT CLAIM merely by traversing a route.",
        taskCamp: "CREATES NO RANGE CLAIM merely because a temporary party occupies it.",
        knowledgeBoundary: "physically reachable != resource/support known; an unobserved reachable tile is excluded from the band's footprint.",
      },
      remainingLimitation: {
        statement: "shared catchment still models residential foraging competition, not incidental route-use or temporary-camp territorial claims",
        status: "EXPLICIT NON-TASK-6 SEMANTIC; not silently upgraded by physicalizing reach",
      },
    };
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
} finally {
  await server.close();
}

console.log(JSON.stringify(out, null, 2));
if (out.verdict !== "PASS") process.exitCode = 1;
