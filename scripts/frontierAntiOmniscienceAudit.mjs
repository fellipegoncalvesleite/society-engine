// CORRECTION-17 §7/§8/§11/§12/§24.17 — FRONTIER EXPLORATION ANTI-OMNISCIENCE AUDIT.
//
// Proves, by STATIC SOURCE ANALYSIS plus a RUNTIME INVARIANT CHECK, that the new task
// family never reads hidden world truth to decide where to go, and never transfers
// knowledge that was not physically earned.
//
// STATIC (A): the eligibility trigger and the heading derivation must not touch any
// hidden-richness / stock / best-unseen-tile / future-fission field. The forbidden reads
// are enumerated below and matched against the actual source of the two functions.
//
// STATIC (B): the module must not import any stock/yield/harvest authority at all — the
// strongest possible form of "it cannot read what it cannot reach".
//
// RUNTIME (C): five invariants sampled across a real long run:
//   C1 at launch, the plan anchor must come from band-held observed/inferred/self knowledge
//      (never an unseen target pulled from world truth);
//   C2 while a party is away, NO tile it is standing on / has walked to exists in the
//      residential band's observedTiles (party-local knowledge, §11);
//   C3 a LOST party's tiles are never added to residential knowledge (§11);
//   C4 exploration never creates a resource memory directly (§12: observation is not
//      harvest; resource knowledge still requires observe/test/use);
//   C5 exploration never creates a food receipt (§12).
//
// RUNTIME (D): the step rule is LOCAL — every appended breadcrumb tile is 4-adjacent to
// the previous one. A party that ever "jumps" is teleporting.
//
// Usage: node scripts/frontierAntiOmniscienceAudit.mjs
import { createServer } from "vite";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src/sim/agents/frontierExploration.ts");
const source = readFileSync(SRC, "utf8");

// ── STATIC A — forbidden hidden-truth reads inside eligibility + heading. ──
// The functions are extracted by name so the check is about THOSE functions, not the
// whole file (the file legitimately reads local passability in the STEP rule).
function extractFunction(text, name) {
  const start = text.indexOf(`export function ${name}`);

  if (start < 0) return "";

  let depth = 0;
  let started = false;

  for (let i = start; i < text.length; i += 1) {
    if (text[i] === "{") {
      depth += 1;
      started = true;
    } else if (text[i] === "}") {
      depth -= 1;

      if (started && depth === 0) return text.slice(start, i + 1);
    }
  }

  return text.slice(start);
}

const eligibilitySrc = extractFunction(source, "deriveFrontierExplorationEligibility");
const headingSrc = extractFunction(source, "deriveFrontierHeading");

// Fields that ARE hidden world truth about country the band has not seen, or forward
// knowledge of outcomes. Reading any of these to decide WHETHER or WHERE to go is
// exactly the omniscience this checkpoint forbids.
const FORBIDDEN_READS = [
  "resourceProfile.foragingPotential",
  "resourceProfile.baseRichness",
  "resourceProfile.waterAccess",
  "resourceProfile.aquaticPotential",
  "plantPatches",
  "faunaStock",
  "aquaticStock",
  "plantStock",
  "getDepletionAdjustedRichness",
  "computeTileYield",
  "deriveSeasonalEffectiveYield",
  "deriveBaseHabitatPotential",
  "effectiveYield",
  "carryingCapacity",
  "shouldCreateDaughter",
  "fissionTarget",
];

const staticA = FORBIDDEN_READS.map((needle) => ({
  read: needle,
  inEligibility: eligibilitySrc.includes(needle),
  inHeading: headingSrc.includes(needle),
})).filter((r) => r.inEligibility || r.inHeading);

// ── STATIC B — the module must not import a stock/yield/harvest authority at all. ──
const FORBIDDEN_IMPORTS = [
  "./plantStock",
  "./faunaStock",
  "./plantPatches",
  "./habitatYield",
  "./carryingCapacity",
  "./humanFoodSupport",
  "./seasonalFoodReceipts",
  "../world/depletion",
  "./resourceEcologyFoundation",
];
const importLines = source.split("\n").filter((l) => /^\s*import\s|from\s+"/.test(l));
const staticB = FORBIDDEN_IMPORTS.filter((spec) => importLines.some((l) => l.includes(`"${spec}"`)));

const server = await createServer({
  root: `${ROOT}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const spawn = await server.ssrLoadModule("/sim/agents/spawn.ts");

  const violations = {
    C1_plan_names_unobserved_tile: 0,
    C2_party_local_tile_leaked_to_residential: 0,
    C3_lost_party_knowledge_transferred: 0,
    C4_exploration_created_resource_memory: 0,
    C5_exploration_created_food_receipt: 0,
    D_non_adjacent_breadcrumb_step: 0,
  };
  const anchorProvenance = { observed: 0, inferred: 0, self: 0, unknown: [] };
  const observed = {
    plansInspected: 0,
    awayPartySamples: 0,
    breadcrumbStepsChecked: 0,
    lostPartiesObserved: 0,
  };

  for (const seed of ["c17:omni:s1", "c17:omni:s2", "c17:omni:s3"]) {
    let world = runner.initSimWorld({ kind: "map2" }, seed);
    world = spawn.removeInitialBands(world, Object.keys(world.bands));
    world = spawn.spawnCustomBands(world, [{ tileId: "tile:188:92", population: 34, name: "founder" }], seed);

    // Track, per away expedition, the tiles it has walked and whether it was lost.
    const awayTrail = new Map();
    const lostTrails = new Map();
    // C1 is a launch-time provenance invariant. Check each plan once: a legitimate
    // inferred anchor may expire from bounded frontier memory while the party is still away.
    const inspectedPlans = new Set();

    // Warm the band up seasonally until it is under enough range/dispersal pressure to
    // start exploring, then switch to DAILY stepping. Daily stepping is what actually
    // catches parties mid-journey: an exploratory round trip is ~10 days, so under
    // seasonal (90-day) stepping a party launches and finishes inside one step and its
    // growing breadcrumb trail is never observable. C2 and D are only meaningful on a
    // party that is genuinely still away.
    for (let year = 1; year <= 60; year += 1) {
      world = runner.stepSim(world, 4, "seasonal");
    }

    for (let day = 1; day <= 360 * 12; day += 1) {
      const priorWorld = world;
      world = runner.stepSim(world, 1, "daily");

      for (const band of Object.values(world.bands)) {
        const residential = band.knowledge.observedTiles;
        const priorBand = priorWorld.bands[band.id];

        for (const x of band.expeditions ?? []) {
          if (x.taskKind !== "frontier_exploration") continue;

          observed.awayPartySamples += 1;

          // C1 — the plan's anchor must be a tile the band ALREADY knows AT LAUNCH.
          // Check each expedition plan once. The audit samples after a daily step, while
          // frontier-memory TTL pruning may occur in that same step, so accept provenance
          // from either side of that one-step boundary. Rechecking an old plan against
          // today's bounded memory would falsely turn normal forgetting into omniscience.
          const plan = x.frontierPlan;
          const planKey = `${String(band.id)}:${x.id}`;

          if (plan !== undefined && !inspectedPlans.has(planKey)) {
            inspectedPlans.add(planKey);
            observed.plansInspected += 1;

            // The anchor must be BAND-KNOWN. Band-known has two legitimate forms:
            //   - an OBSERVED tile (`knowledge.observedTiles`), or
            //   - an INFERRED tile (`frontierKnowledge.inferredTiles`) — the band's own
            //     bounded, existence-only corridor-continuation belief, which §7 and §8
            //     explicitly allow as a heading source ("low-confidence inferred
            //     continuation of known terrain"). An inference is a thing the band
            //     holds, not a lookup of hidden truth: it is derived from terrain the
            //     band HAS seen, and it carries direction only, never value.
            // Anything else would be a tile pulled out of world truth.
            const inferred = band.frontierKnowledge?.inferredTiles ?? {};
            const priorInferred = priorBand?.frontierKnowledge?.inferredTiles ?? {};
            const anchorIsObserved = residential[plan.anchorTileId] !== undefined;
            const anchorIsInferred = inferred[plan.anchorTileId] !== undefined;
            const anchorIsSelf = plan.anchorTileId === band.position;
            const anchorWasObserved = priorBand?.knowledge.observedTiles[plan.anchorTileId] !== undefined;
            const anchorWasInferred = priorInferred[plan.anchorTileId] !== undefined;
            const anchorWasSelf = priorBand !== undefined && plan.anchorTileId === priorBand.position;
            const anchorKnownAcrossLaunchBoundary =
              anchorIsObserved || anchorIsInferred || anchorIsSelf ||
              anchorWasObserved || anchorWasInferred || anchorWasSelf;

            if (!anchorKnownAcrossLaunchBoundary) {
              violations.C1_plan_names_unobserved_tile += 1;
              anchorProvenance.unknown.push({ basis: plan.basis, tileId: String(plan.anchorTileId) });
            } else {
              anchorProvenance[
                anchorIsObserved || anchorWasObserved
                  ? "observed"
                  : anchorIsInferred || anchorWasInferred
                    ? "inferred"
                    : "self"
              ] += 1;
            }

            // The plan object must not contain any tile field other than anchorTileId.
            const tileFields = Object.entries(plan).filter(
              ([k, v]) => typeof v === "string" && String(v).startsWith("tile:") && k !== "anchorTileId",
            );

            if (tileFields.length > 0) violations.C1_plan_names_unobserved_tile += 1;
          }

          // D — every breadcrumb step must be 4-adjacent to its predecessor.
          for (let i = 1; i < x.routeTileIds.length; i += 1) {
            const a = world.tiles[x.routeTileIds[i - 1]];
            const b = world.tiles[x.routeTileIds[i]];

            if (a === undefined || b === undefined) continue;

            observed.breadcrumbStepsChecked += 1;

            if (Math.abs(a.coord.x - b.coord.x) + Math.abs(a.coord.y - b.coord.y) !== 1) {
              violations.D_non_adjacent_breadcrumb_step += 1;
            }
          }

          // C2 — while AWAY, tiles the party walked beyond the residence must not yet be
          // residential knowledge. (Tiles inside the band's ordinary catchment are
          // legitimately already known, so only NEW deep tiles are checked.)
          const origin = world.tiles[x.originTileId];
          const newlyWalked = x.routeTileIds.filter((tid) => {
            const t = world.tiles[tid];
            if (t === undefined || origin === undefined) return false;
            const d = Math.abs(t.coord.x - origin.coord.x) + Math.abs(t.coord.y - origin.coord.y);
            return d > 11;
          });
          const priorTrail = awayTrail.get(x.id) ?? { known: new Set(), deep: [] };

          for (const tid of newlyWalked) {
            // Only a violation if the tile was NOT residential knowledge when the party
            // set out and IS now, while the party is still away.
            if (residential[tid] !== undefined && !priorTrail.known.has(tid)) {
              violations.C2_party_local_tile_leaked_to_residential += 1;
            }
          }

          awayTrail.set(x.id, {
            known: new Set(Object.keys(residential)),
            deep: newlyWalked,
            bandId: band.id,
          });
        }

        // C3 — a party recorded LOST must never have contributed its tiles.
        for (const o of band.recentExpeditionOutcomes ?? []) {
          if (o.taskKind !== "frontier_exploration" || o.phase !== "lost") continue;

          if (!lostTrails.has(o.id)) {
            lostTrails.set(o.id, true);
            observed.lostPartiesObserved += 1;

            // A lost party must carry no observations home at all.
            if ((o.observations ?? []).length > 0) {
              violations.C3_lost_party_knowledge_transferred += 1;
            }
          }
        }

        // C4/C5 — exploration must never mint a resource memory or a food receipt.
        // Any patch memory or receipt whose provenance names frontier_exploration is a
        // violation: observation is not harvest.
        for (const m of band.resourceKnowledgeState?.patchMemories ?? []) {
          if ((m.reasonIds ?? []).some((r) => String(r).includes("frontier_exploration"))) {
            violations.C4_exploration_created_resource_memory += 1;
          }
        }

        for (const trip of band.recentIntraSeasonTrips ?? []) {
          const rids = [...(trip.reasonIds ?? []), ...(trip.physicalFoodHarvest?.reasonIds ?? [])];

          if (
            rids.some((r) => String(r).includes("frontier_exploration")) &&
            (trip.physicalFoodHarvest?.usableSupport ?? 0) > 0
          ) {
            violations.C5_exploration_created_food_receipt += 1;
          }
        }
      }
    }
  }

  const staticPass = staticA.length === 0 && staticB.length === 0;
  const runtimePass = Object.values(violations).every((v) => v === 0);
  const pass = staticPass && runtimePass;

  const result = {
    audit: "frontierAntiOmniscience",
    checkpoint: "CORRECTION-17 §7/§8/§11/§12, gate 24.17",
    staticA_forbiddenHiddenTruthReadsInTriggerAndHeading: {
      checked: FORBIDDEN_READS,
      violations: staticA,
      pass: staticA.length === 0,
    },
    staticB_forbiddenStockOrYieldImports: {
      checked: FORBIDDEN_IMPORTS,
      violations: staticB,
      pass: staticB.length === 0,
      note:
        "The module imports only core types, world generate/passability and agent types. " +
        "It cannot read a stock or a yield because it cannot reach one.",
    },
    runtimeInvariants: violations,
    // Where every exploratory party's heading ANCHOR came from. Each category is a
    // band-held record; `unknown` would mean a tile pulled from world truth.
    anchorProvenance: { ...anchorProvenance, unknown: anchorProvenance.unknown.slice(0, 20) },
    observed,
    verdict: pass ? "PASS" : "FAIL",
  };

  mkdirSync(join(ROOT, "docs/evidence/correction17"), { recursive: true });
  writeFileSync(
    join(ROOT, "docs/evidence/correction17/frontier-anti-omniscience.json"),
    `${JSON.stringify(result, null, 2)}\n`,
  );

  console.log("── §24.17 ANTI-OMNISCIENCE ──");
  console.log(`static A (hidden-truth reads in trigger/heading): ${staticA.length === 0 ? "CLEAN" : JSON.stringify(staticA)}`);
  console.log(`static B (stock/yield imports)                  : ${staticB.length === 0 ? "CLEAN" : JSON.stringify(staticB)}`);
  console.log(`runtime invariants                              : ${JSON.stringify(violations)}`);
  console.log(`anchor provenance                               : observed=${anchorProvenance.observed} inferred=${anchorProvenance.inferred} self=${anchorProvenance.self} unknown=${anchorProvenance.unknown.length}`);
  if (anchorProvenance.unknown.length > 0) console.log(`  unknown anchors sample: ${JSON.stringify(anchorProvenance.unknown.slice(0, 5))}`);
  console.log(`observed                                        : ${JSON.stringify(observed)}`);
  console.log(`VERDICT                                         : ${result.verdict}`);

  if (!pass) process.exitCode = 1;
} finally {
  await server.close();
}
