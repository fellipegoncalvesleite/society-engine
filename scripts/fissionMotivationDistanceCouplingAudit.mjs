// CORRECTION-18 §9.3/§13 — DISTANCE DOUBLE-COUNTING IN SPLIT MOTIVATION.
//
// §9.3: "Distance and risk affect preference and feasibility. They must not be counted
// repeatedly in: viability; motivation; destination ranking; daughter-colonization
// pressure."
//
// Production counts distance TWICE, in two different conceptual roles:
//
//   1. DESTINATION RANKING (deriveKnownUnusedHabitat)
//        score = ... - travelCost * 0.2          , travelCost = clamp01(distance / 12)
//      i.e. "of the places I know, which is the better destination".
//
//   2. SPLIT MOTIVATION (deriveDaughterColonization)
//        travelRiskPenalty = clamp01(travelCost * 0.6 + riskPenalty * 0.4)
//        pressure          = ... - travelRiskPenalty * 0.2
//      i.e. "should a subgroup leave at all".
//
// The second is the defect. Whether a crowded band has reason to divide is a fact about
// the PARENT — its saturation, crowding, per-capita stress, return decline, cohort
// viability. It is not a fact about how far away the best known destination happens to
// be. Under (2), a band that DISCOVERS a good distant destination becomes LESS motivated
// to split than one that knows nothing but its own doorstep, because the discovery raises
// travelCost. Exploration therefore suppresses the very expansion it exists to enable.
//
// Magnitude: travelCost saturates at distance 12. A near winner (d=2) contributes
// 0.17*0.6 = 0.10 to travelRiskPenalty; a distant winner (d>=12) contributes 0.60. The
// resulting pressure difference is up to (0.60-0.10)*0.2 = 0.10, against a
// SPLIT_PRESSURE_THRESHOLD of 0.64 — large enough to gate fission on its own.
//
// This audit measures, per arm, the opportunity winner's distance and the resulting
// daughterColonization pressure, and reports whether the enabled arm's winners are
// farther and its pressure correspondingly lower.
//
// Usage: node scripts/fissionMotivationDistanceCouplingAudit.mjs
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const YEARS = 200;
const SEEDS = ["c18:a", "c18:b", "c18:c"];
const MAPS = ["map1", "map2"];
const r3 = (v) => Math.round(v * 1000) / 1000;
const mean = (xs) => (xs.length === 0 ? 0 : xs.reduce((s, v) => s + v, 0) / xs.length);

const server = await createServer({
  root: `${process.cwd()}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const rows = [];

  for (const map of MAPS) {
    for (const seed of SEEDS) {
      for (const enabled of [true, false]) {
        let world = runner.initSimWorld({ kind: map }, seed);
        if (!enabled) {
          world = {
            ...world,
            auditOptions: { ...(world.auditOptions ?? {}), frontierExplorationEnabled: false },
          };
        }

        const winnerTravelCosts = [];
        const winnerDistances = [];
        const pressures = [];
        const travelRiskPenalties = [];
        let pressureBlockedByDistanceAlone = 0;
        let samples = 0;

        for (let year = 1; year <= YEARS; year += 1) {
          world = runner.stepSim(world, 4, "seasonal");

          for (const band of Object.values(world.bands)) {
            const dc = band.daughterColonization;
            const opp = dc?.bestKnownUnusedHabitatOpportunity;
            if (dc === undefined || opp === undefined) continue;

            const here = world.tiles[band.position];
            const t = world.tiles[opp.candidateTileId];
            if (here === undefined || t === undefined) continue;

            const distance = Math.abs(t.coord.x - here.coord.x) + Math.abs(t.coord.y - here.coord.y);
            samples += 1;
            winnerTravelCosts.push(opp.travelCost);
            winnerDistances.push(distance);
            pressures.push(dc.pressure);
            travelRiskPenalties.push(dc.travelRiskPenalty);

            // Would this band's pressure have crossed the split threshold if the
            // DISTANCE half of travelRiskPenalty had not been charged to motivation?
            // (risk stays; only the distance term is removed.)
            const distanceHalf = Math.min(1, opp.travelCost * 0.6);
            const pressureWithoutDistance = Math.min(1, dc.pressure + distanceHalf * 0.2);
            if (dc.pressure < 0.64 && pressureWithoutDistance >= 0.64) {
              pressureBlockedByDistanceAlone += 1;
            }
          }
        }

        rows.push({
          map,
          seed,
          explorationEnabled: enabled,
          samples,
          meanWinnerDistance: r3(mean(winnerDistances)),
          meanWinnerTravelCost: r3(mean(winnerTravelCosts)),
          meanTravelRiskPenalty: r3(mean(travelRiskPenalties)),
          meanColonizationPressure: r3(mean(pressures)),
          bandYearsWherePressureBlockedByDistanceAlone: pressureBlockedByDistanceAlone,
          blockedShare: r3(pressureBlockedByDistanceAlone / Math.max(1, samples)),
          finalBands: Object.keys(world.bands).length,
          finalPopulation: Object.values(world.bands).reduce((s, b) => s + b.demography.population, 0),
        });

        console.log(
          `[${map}][${seed}][${enabled ? "ON " : "OFF"}] winnerDist=${r3(mean(winnerDistances))} ` +
            `travelCost=${r3(mean(winnerTravelCosts))} travelRiskPen=${r3(mean(travelRiskPenalties))} ` +
            `pressure=${r3(mean(pressures))} blockedByDistance=${pressureBlockedByDistanceAlone} ` +
            `bands=${Object.keys(world.bands).length}`,
        );
      }
    }
  }

  const perMap = {};
  for (const map of MAPS) {
    const on = rows.filter((r) => r.map === map && r.explorationEnabled);
    const off = rows.filter((r) => r.map === map && !r.explorationEnabled);
    const f = (a, k) => mean(a.map((r) => r[k]));
    perMap[map] = {
      meanWinnerDistance: { on: r3(f(on, "meanWinnerDistance")), off: r3(f(off, "meanWinnerDistance")) },
      meanTravelRiskPenalty: { on: r3(f(on, "meanTravelRiskPenalty")), off: r3(f(off, "meanTravelRiskPenalty")) },
      meanColonizationPressure: { on: r3(f(on, "meanColonizationPressure")), off: r3(f(off, "meanColonizationPressure")) },
      finalBands: { on: r3(f(on, "finalBands")), off: r3(f(off, "finalBands")) },
      blockedByDistanceAlone: { on: r3(f(on, "bandYearsWherePressureBlockedByDistanceAlone")), off: r3(f(off, "bandYearsWherePressureBlockedByDistanceAlone")) },
      winnersAreFartherWhenExploring: f(on, "meanWinnerDistance") > f(off, "meanWinnerDistance"),
      pressureIsLowerWhenExploring: f(on, "meanColonizationPressure") < f(off, "meanColonizationPressure"),
    };
  }

  const confirmed = Object.values(perMap).every(
    (p) => p.winnersAreFartherWhenExploring && p.pressureIsLowerWhenExploring,
  );

  const result = {
    audit: "fissionMotivationDistanceCoupling",
    checkpoint: "CORRECTION-18 §9.3/§13",
    prohibition:
      "§9.3 — distance must not be counted repeatedly across viability, motivation, destination ranking and daughter-colonization pressure",
    doubleCount: {
      role1_destinationRanking: "deriveKnownUnusedHabitat: score -= travelCost * 0.2",
      role2_splitMotivation:
        "deriveDaughterColonization: travelRiskPenalty = clamp01(travelCost * 0.6 + riskPenalty * 0.4); pressure -= travelRiskPenalty * 0.2",
      sameInput: "travelCost = clamp01(distance / 12), computed once and consumed in both roles",
      maximumMotivationSwing: 0.1,
      splitPressureThreshold: 0.64,
    },
    perMap,
    rows,
    confirmed,
    verdict: confirmed
      ? "CONFIRMED — exploration moves the opportunity winner farther, which raises travelRiskPenalty, which lowers split motivation. Discovering a good distant destination makes a band LESS willing to divide."
      : "NOT_CONFIRMED_ON_THESE_ARMS",
  };

  mkdirSync(join(process.cwd(), "docs/evidence/correction18"), { recursive: true });
  writeFileSync(
    join(process.cwd(), "docs/evidence/correction18/fission-motivation-distance-coupling.json"),
    `${JSON.stringify(result, null, 2)}\n`,
  );

  console.log("");
  console.log("── §9.3 DISTANCE DOUBLE-COUNTING ──");
  for (const map of MAPS) {
    const p = perMap[map];
    console.log(
      `${map}: winnerDist ON=${p.meanWinnerDistance.on} OFF=${p.meanWinnerDistance.off} | ` +
        `travelRiskPen ON=${p.meanTravelRiskPenalty.on} OFF=${p.meanTravelRiskPenalty.off} | ` +
        `pressure ON=${p.meanColonizationPressure.on} OFF=${p.meanColonizationPressure.off} | ` +
        `bands ON=${p.finalBands.on} OFF=${p.finalBands.off}`,
    );
  }
  console.log(`VERDICT: ${result.verdict}`);
} finally {
  await server.close();
}
