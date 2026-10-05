// CORRECTION-19 §5/§10/§11 — LABOR / RECEIPT / SUPPORT WATERFALL AND FISSION AMPLIFICATION.
//
// §5 forbids using total world trip count without normalizing for living-band count, and
// §11 forbids describing a 20% world-population gap as a 20% direct food cost when most of
// it comes from a delayed or missing fission. A first pass over the CORRECTION-18 numbers
// already shows why both rules matter — and shows that THE TWO DEFAULT MAPS DIFFER:
//
//   map1  pop/band  ON 28.85  OFF 27.65   bands 7,8,6  vs 10,8,9
//         -> bands are individually LARGER with exploration; the world gap is FEWER BANDS
//   map2  pop/band  ON 17.09  OFF 20.24   bands 11,12,11 vs 11,11,11
//         -> band counts are IDENTICAL; the world gap is a genuine PER-BAND cost
//
// So map1's gap is fission amplification and map2's is a within-band effect. A single
// aggregate would have hidden both. This audit measures, per seed and per map:
//
//   (a) the labor -> activity -> receipt -> support waterfall, normalized per band-year AND
//       per working-adult-year, so "less total activity because there are fewer bands" can
//       never be mistaken for "each band forages less";
//   (b) expedition person-days actually reserved, so the direct labor cost is a measured
//       quantity rather than an inference from walked kilometres;
//   (c) the fission decomposition §11 requires: first-fission date, parent population at
//       fission, split pressure, daughter founding population, descendant counts, and
//       root-lineage population including all descendants.
//
// Nothing here changes production. Arms differ only by `frontierExplorationEnabled`.
//
// Usage: node scripts/expeditionLaborWaterfallAudit.mjs
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const YEARS = 300;
const SEEDS = ["c18:a", "c18:b", "c18:c", "c18:d", "c18:e"];
const MAPS = ["map1", "map2"];

const r2 = (v) => Math.round(v * 100) / 100;
const r4 = (v) => Math.round(v * 10000) / 10000;
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

  function run(map, seed, explorationEnabled) {
    let world = runner.initSimWorld({ kind: map }, seed);

    if (!explorationEnabled) {
      world = {
        ...world,
        auditOptions: { ...(world.auditOptions ?? {}), frontierExplorationEnabled: false },
      };
    }

    const rootOf = new Map();
    for (const id of Object.keys(world.bands)) rootOf.set(id, id);

    // Accumulators. Every activity quantity is accompanied by the exposure that produced
    // it (band-years, working-adult-years) so it can be normalized.
    let bandYears = 0;
    let workingAdultYears = 0;
    let tripsCompleted = 0;
    let receiptSeasons = 0;
    let usableSupportSum = 0;
    let grossHarvestSum = 0;
    let transportLossSum = 0;
    let processingLossSum = 0;
    let demandSum = 0;
    let supportRatioSum = 0;
    let supportSamples = 0;
    // §6/§12 — expedition labor actually reserved, in person-days.
    let expeditionPersonDays = 0;
    let expeditionsSeen = 0;
    let expeditionsCompleted = 0;
    let expeditionsAborted = 0;
    let expeditionsLost = 0;
    let provisionUnitsConsumed = 0;
    let injuryLoadSum = 0;
    // Reservation leak detector: person-days held by a party already in a terminal phase.
    let terminalPhasePersonDaysHeld = 0;

    const countedExpeditions = new Set();
    const countedTrips = new Set();
    const fissions = [];
    let previousIds = new Set(Object.keys(world.bands));
    const previousPopulation = new Map(
      Object.entries(world.bands).map(([id, b]) => [id, b.demography.population]),
    );

    for (let year = 1; year <= YEARS; year += 1) {
      // Sample expedition reservation BEFORE stepping, once per year, using the party's
      // own recorded elapsed days so person-days are measured, not modelled.
      for (const band of Object.values(world.bands)) {
        for (const x of band.expeditions ?? []) {
          const away =
            x.phase === "prepared" || x.phase === "outbound" || x.phase === "operating" || x.phase === "returning";

          if (!away && x.partyWorkers > 0) {
            // A terminal-phase party still sitting in the active list holds labor it
            // should have released. Counted so a leak cannot hide.
            terminalPhasePersonDaysHeld += x.partyWorkers;
          }
        }
      }

      const before = new Map(
        Object.entries(world.bands).map(([id, b]) => [
          id,
          {
            population: b.demography.population,
            splitPressure: b.demography.splitPressure,
            workingAdults: b.demography.workingAdults,
          },
        ]),
      );

      world = runner.stepSim(world, 4, "seasonal");
      const nowIds = new Set(Object.keys(world.bands));

      // §11 — fission events, with the parent state immediately before the split.
      for (const id of nowIds) {
        if (previousIds.has(id)) continue;

        const b = world.bands[id];
        const parentId = b.parentBandId;
        const parentBefore = parentId === undefined ? undefined : before.get(parentId);
        const root = parentId === undefined ? id : rootOf.get(parentId) ?? id;
        rootOf.set(id, root);

        fissions.push({
          year,
          daughterId: String(id),
          parentId: parentId === undefined ? null : String(parentId),
          rootLineage: String(root),
          parentPopulationBefore: parentBefore?.population ?? null,
          parentSplitPressureBefore: parentBefore?.splitPressure ?? null,
          daughterFoundingPopulation: b.demography.population,
          destinationTileId: String(b.position),
          generation: parentId === undefined || rootOf.get(parentId) === parentId ? 1 : 2,
        });
      }

      previousIds = nowIds;

      for (const band of Object.values(world.bands)) {
        bandYears += 1;
        workingAdultYears += band.demography.workingAdults;

        const receipts = band.seasonalFoodReceipts;
        if (receipts !== undefined && (receipts.receiptCount ?? 0) > 0) {
          receiptSeasons += 1;
          usableSupportSum += receipts.totalUsableSupport ?? 0;
          grossHarvestSum +=
            (receipts.physicalPlantHarvest ?? 0) +
            (receipts.physicalFaunaHarvest ?? 0) +
            (receipts.aquaticHarvest ?? 0);
          transportLossSum += receipts.transportLoss ?? 0;
          processingLossSum += receipts.processingLoss ?? 0;
        }

        const support = band.carryingCapacity?.perCapitaReturn?.supportDebug;
        if (support !== undefined) {
          supportSamples += 1;
          supportRatioSum += support.rawSupportRatio ?? 0;
          demandSum += support.adultEquivalentDemand ?? 0;
        }

        for (const t of band.recentIntraSeasonTrips ?? []) {
          const k = `${band.id}:${t.day}:${t.targetTileId ?? "x"}:${t.taskGroupType ?? "x"}`;
          if (countedTrips.has(k)) continue;
          countedTrips.add(k);
          tripsCompleted += 1;
        }

        for (const o of band.recentExpeditionOutcomes ?? []) {
          if (countedExpeditions.has(o.id)) continue;
          countedExpeditions.add(o.id);
          expeditionsSeen += 1;
          // §6 — person-days is the authoritative direct-labor unit.
          expeditionPersonDays += o.partyWorkers * o.totalDays;
          provisionUnitsConsumed += o.provisionUnitsConsumed ?? 0;
          injuryLoadSum += o.injuryLoad ?? 0;
          if (o.phase === "completed") expeditionsCompleted += 1;
          if (o.phase === "aborted") expeditionsAborted += 1;
          if (o.phase === "lost") expeditionsLost += 1;
        }
      }
    }

    const finalBands = Object.values(world.bands);
    const population = finalBands.reduce((s, b) => s + b.demography.population, 0);
    const bands = finalBands.length;

    // Root-lineage roll-up including every descendant.
    const byRoot = new Map();
    for (const b of finalBands) {
      const root = rootOf.get(b.id) ?? b.id;
      const cur = byRoot.get(root) ?? { population: 0, bands: 0 };
      cur.population += b.demography.population;
      cur.bands += 1;
      byRoot.set(root, cur);
    }

    const firstFission = fissions.length === 0 ? null : fissions[0];
    const secondGeneration = fissions.filter((f) => f.generation === 2).length;

    return {
      map,
      seed,
      explorationEnabled,
      world: { population, bands, populationPerBand: r2(population / Math.max(1, bands)) },
      exposure: { bandYears, workingAdultYears: r2(workingAdultYears) },
      // §10 waterfall, normalized BOTH ways.
      waterfall: {
        tripsCompleted,
        tripsPerBandYear: r4(tripsCompleted / Math.max(1, bandYears)),
        tripsPerWorkingAdultYear: r4(tripsCompleted / Math.max(1, workingAdultYears)),
        grossHarvest: r2(grossHarvestSum),
        transportLoss: r2(transportLossSum),
        processingLoss: r2(processingLossSum),
        usableSupport: r2(usableSupportSum),
        usableSupportPerBandYear: r4(usableSupportSum / Math.max(1, bandYears)),
        usableSupportPerWorkingAdultYear: r4(usableSupportSum / Math.max(1, workingAdultYears)),
        receiptSeasons,
        meanAdultEquivalentDemand: r2(demandSum / Math.max(1, supportSamples)),
        meanRawSupportRatio: r4(supportRatioSum / Math.max(1, supportSamples)),
      },
      // §6 direct expedition cost, never collapsed into one scalar.
      expeditionCost: {
        expeditions: expeditionsSeen,
        completed: expeditionsCompleted,
        aborted: expeditionsAborted,
        lost: expeditionsLost,
        personDays: expeditionPersonDays,
        personDaysPerBandYear: r4(expeditionPersonDays / Math.max(1, bandYears)),
        // The share of ALL available working-adult time the expeditions consumed.
        shareOfWorkingAdultDays: r4(expeditionPersonDays / Math.max(1, workingAdultYears * 360)),
        provisionUnitsConsumed: r4(provisionUnitsConsumed),
        meanInjuryLoad: r4(injuryLoadSum / Math.max(1, expeditionsSeen)),
        terminalPhasePersonDaysHeld,
        expeditionsPerBandYear: r4(expeditionsSeen / Math.max(1, bandYears)),
      },
      // §11 fission decomposition.
      fission: {
        count: fissions.length,
        firstFissionYear: firstFission?.year ?? null,
        firstFissionParentPopulation: firstFission?.parentPopulationBefore ?? null,
        firstFissionParentSplitPressure: firstFission?.parentSplitPressureBefore ?? null,
        secondGenerationFissions: secondGeneration,
        meanDaughterFoundingPopulation: r2(mean(fissions.map((f) => f.daughterFoundingPopulation))),
        rootLineages: [...byRoot.entries()]
          .map(([root, v]) => ({ root: String(root), ...v }))
          .sort((a, b) => a.root.localeCompare(b.root)),
        events: fissions,
      },
    };
  }

  const results = [];

  for (const map of MAPS) {
    for (const seed of SEEDS) {
      for (const enabled of [true, false]) {
        const r = run(map, seed, enabled);
        results.push(r);
        console.log(
          `[${map}][${seed}][${enabled ? "ON " : "OFF"}] pop=${r.world.population} bands=${r.world.bands} ` +
            `pop/band=${r.world.populationPerBand} trips/AY=${r.waterfall.tripsPerWorkingAdultYear} ` +
            `food/AY=${r.waterfall.usableSupportPerWorkingAdultYear} ` +
            `support=${r.waterfall.meanRawSupportRatio} ` +
            `fis=${r.fission.count}@y${r.fission.firstFissionYear ?? "-"} ` +
            `expPD=${r.expeditionCost.personDays} share=${r.expeditionCost.shareOfWorkingAdultDays}`,
        );
      }
    }
  }

  const perMap = {};

  for (const map of MAPS) {
    const on = results.filter((r) => r.map === map && r.explorationEnabled);
    const off = results.filter((r) => r.map === map && !r.explorationEnabled);
    const g = (arr, path) => mean(arr.map((r) => path.split(".").reduce((o, k) => o[k], r)));
    const cmp = (path) => {
      const a = g(on, path);
      const b = g(off, path);
      return { on: r4(a), off: r4(b), delta: r4(a - b), pct: b === 0 ? null : r2(((a - b) / b) * 100) };
    };

    const popGap = g(off, "world.population") - g(on, "world.population");
    const bandGap = g(off, "world.bands") - g(on, "world.bands");
    const onPerBand = g(on, "world.populationPerBand");
    // Counterfactual: if the enabled arm had the DISABLED arm's band count but its own
    // per-band population, what would the world population be? The remainder is the
    // per-band (direct) effect; the rest is band-count (amplification).
    const popIfSameBandCount = onPerBand * g(off, "world.bands");
    const amplification = popIfSameBandCount - g(on, "world.population");
    const direct = popGap - amplification;

    perMap[map] = {
      population: cmp("world.population"),
      bands: cmp("world.bands"),
      populationPerBand: cmp("world.populationPerBand"),
      tripsPerWorkingAdultYear: cmp("waterfall.tripsPerWorkingAdultYear"),
      usableSupportPerWorkingAdultYear: cmp("waterfall.usableSupportPerWorkingAdultYear"),
      meanRawSupportRatio: cmp("waterfall.meanRawSupportRatio"),
      meanAdultEquivalentDemand: cmp("waterfall.meanAdultEquivalentDemand"),
      fissionCount: cmp("fission.count"),
      firstFissionYear: cmp("fission.firstFissionYear"),
      expeditionPersonDays: r2(g(on, "expeditionCost.personDays")),
      expeditionShareOfWorkingAdultDays: r4(g(on, "expeditionCost.shareOfWorkingAdultDays")),
      terminalPhasePersonDaysHeld: r2(g(on, "expeditionCost.terminalPhasePersonDaysHeld")),
      // §11 required split.
      decomposition: {
        totalPopulationGap: r2(popGap),
        bandCountGap: r2(bandGap),
        attributableToBandCount_amplification: r2(amplification),
        attributableToPerBandPopulation_direct: r2(direct),
        amplificationSharePct: popGap === 0 ? null : r2((amplification / popGap) * 100),
        directSharePct: popGap === 0 ? null : r2((direct / popGap) * 100),
      },
    };
  }

  const summary = {
    audit: "expeditionLaborWaterfall",
    checkpoint: "CORRECTION-19 §5/§10/§11",
    years: YEARS,
    seeds: SEEDS,
    normalizationRule:
      "§5 — world totals are never used without dividing by living-band count and working-adult exposure",
    decompositionMethod:
      "amplification = (enabled pop/band x disabled band count) - enabled population; direct = total gap - amplification",
    perMap,
    results,
  };

  mkdirSync(join(process.cwd(), "docs/evidence/correction19"), { recursive: true });
  writeFileSync(
    join(process.cwd(), "docs/evidence/correction19/labor-waterfall.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );

  console.log("");
  console.log("── §10/§11 WATERFALL AND DECOMPOSITION ──");
  for (const map of MAPS) {
    const p = perMap[map];
    console.log(`${map}:`);
    console.log(`  population        ON ${p.population.on} OFF ${p.population.off} (${p.population.pct}%)`);
    console.log(`  bands             ON ${p.bands.on} OFF ${p.bands.off}`);
    console.log(`  pop / band        ON ${p.populationPerBand.on} OFF ${p.populationPerBand.off} (${p.populationPerBand.pct}%)`);
    console.log(`  trips / adult-yr  ON ${p.tripsPerWorkingAdultYear.on} OFF ${p.tripsPerWorkingAdultYear.off} (${p.tripsPerWorkingAdultYear.pct}%)`);
    console.log(`  food  / adult-yr  ON ${p.usableSupportPerWorkingAdultYear.on} OFF ${p.usableSupportPerWorkingAdultYear.off} (${p.usableSupportPerWorkingAdultYear.pct}%)`);
    console.log(`  raw support ratio ON ${p.meanRawSupportRatio.on} OFF ${p.meanRawSupportRatio.off} (${p.meanRawSupportRatio.pct}%)`);
    console.log(`  fissions          ON ${p.fissionCount.on} OFF ${p.fissionCount.off} | first@ ON y${p.firstFissionYear.on} OFF y${p.firstFissionYear.off}`);
    console.log(`  expedition PD     ${p.expeditionPersonDays}  = ${(p.expeditionShareOfWorkingAdultDays * 100).toFixed(3)}% of working-adult days`);
    console.log(`  labor leak (terminal-phase person-days held): ${p.terminalPhasePersonDaysHeld}`);
    console.log(`  DECOMPOSITION gap=${p.decomposition.totalPopulationGap} ` +
      `amplification=${p.decomposition.attributableToBandCount_amplification} (${p.decomposition.amplificationSharePct}%) ` +
      `direct=${p.decomposition.attributableToPerBandPopulation_direct} (${p.decomposition.directSharePct}%)`);
  }
} finally {
  await server.close();
}
