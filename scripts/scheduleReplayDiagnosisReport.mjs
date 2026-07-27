// CORRECTION-23G §8/§10/§12/§13 — turn the raw matrix into the required diagnosis.
//
// This script computes NOTHING new about the world. It reads the matrix and the site
// phenotypes and applies the classification rules §12 and §13 specify, so the verdicts are
// derived by a stated rule rather than by narration:
//
//   §8   the seasonal-information accounting, SPLIT into existing-record season additions and
//        new-record creations, with the behavioural reader counts beside them;
//   §10  the matched comparisons — pairs of sites alike on one phenotype axis and different
//        on another, so a difference can be attributed to the axis rather than to the site;
//   §12  per-site effect classification and per-site mechanism classification;
//   §13  the mediation chain, reported as a chain and refused when a link is missing.
//
// Usage: node scripts/scheduleReplayDiagnosisReport.mjs [--matrix PATH] [--phenotypes PATH]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt;
};

const MATRIX = arg("matrix", "docs/evidence/correction23g/g-matrix.json");
const PHENOTYPES = arg("phenotypes", "docs/evidence/correction23g/site-phenotypes.json");
const OUT = arg("out", "docs/evidence/correction23g/diagnosis.json");

const matrix = JSON.parse(readFileSync(MATRIX, "utf8"));
const phenotypes = JSON.parse(readFileSync(PHENOTYPES, "utf8"));
const labelOf = Object.fromEntries(phenotypes.sites.map((site) => [site.tileId, site.label]));
const phenotypeOf = Object.fromEntries(phenotypes.sites.map((site) => [site.tileId, site]));

const r2 = (v) => (v === undefined || v === null ? null : Math.round(v * 100) / 100);

// §12 — the effect classification rule, stated once and applied uniformly. "Material" is
// defined on BOTH axes because survival and population can move independently: an arm that
// keeps every seed alive at half the population has changed something real.
const classifyEffect = (base, arm) => {
  if (base === undefined || arm === undefined) return "not_run";

  const survivalDelta = arm.survival - base.survival;
  const populationRatio = base.meanFinalPopulation === 0 ? null : arm.meanFinalPopulation / base.meanFinalPopulation;
  const strong = survivalDelta >= 0.3 || (populationRatio !== null && populationRatio >= 1.5);
  const weak = survivalDelta >= 0.1 || (populationRatio !== null && populationRatio >= 1.15);
  const strongHarm = survivalDelta <= -0.3 || (populationRatio !== null && populationRatio <= 0.667);
  const weakHarm = survivalDelta <= -0.1 || (populationRatio !== null && populationRatio <= 0.87);

  if (strong) return "strongly beneficial";
  if (weak) return "weakly beneficial";
  if (strongHarm) return "strongly harmful";
  if (weakHarm) return "weakly harmful";
  return "neutral";
};

/** Is this difference big enough to be worth attributing at all? */
const material = (left, right) =>
  left !== undefined &&
  right !== undefined &&
  (Math.abs(left.survival - right.survival) >= 0.2 ||
    (right.meanFinalPopulation > 0 &&
      Math.abs(left.meanFinalPopulation - right.meanFinalPopulation) / Math.max(1, right.meanFinalPopulation) >= 0.2));

const report = { matrix: MATRIX, phenotypes: PHENOTYPES, sites: {}, matchedComparisons: [], conditional: null };

for (const site of matrix.sites) {
  const arms = matrix.summary[site] ?? {};
  const { F0, F1, G1, G2, G3, G4, G5, G6 } = arms;
  const label = labelOf[site] ?? site;

  // ── §12 effect of the F1 positive control, against production ────────────────────────
  const f1Effect = classifyEffect(F0, F1);

  // ── §12 mechanism, decided by the G arms rather than by argument ─────────────────────
  //
  //   F1 vs G1  total contribution of verification SEMANTICS plus disposition
  //   G1 vs G2  contribution of target ROTATION alone
  //   F1 vs G3  cadence held, ordinary broad-exploration target family
  //   F1 vs G4  cadence held, nearest legal uncertain target
  //   F1 vs G5  cadence held, deterministic geographic rotation
  //   F0 vs G6  value of RETAINING the donor places without travelling
  //   F1 vs G6  value of the physical travel BEYOND retention
  const semanticsMatters = material(F1, G1);
  const rotationMatters = material(G1, G2);
  const targetFamilyMatters = material(F1, G3) || material(F1, G4) || material(F1, G5);
  const retentionSubstitutes = material(G6, F0) && !material(F1, G6);
  const retentionPartial = material(G6, F0) && material(F1, G6);

  let mechanism;

  if (f1Effect === "neutral" || f1Effect === "not_run") {
    mechanism = "no effect to attribute";
  } else if (semanticsMatters) {
    mechanism = "verification answer";
  } else if (!semanticsMatters && targetFamilyMatters && !rotationMatters) {
    // The physical schedule reproduces the control with every trace of the question removed,
    // and holding the CADENCE while changing the TARGET RULE destroys it. The mechanism is
    // therefore the specific set of places walked to, not the asking and not the pace.
    mechanism = retentionPartial
      ? "target family (route-country observation), partly substitutable by memory retention"
      : "target family (route-country observation)";
  } else if (!semanticsMatters && !targetFamilyMatters) {
    mechanism = "party cadence";
  } else if (rotationMatters) {
    mechanism = "target rotation";
  } else {
    mechanism = "interaction-dependent";
  }

  if (retentionSubstitutes) mechanism = "memory retention";

  // ── §13 mediation chain. A link that did not move is reported as not moving; a chain
  // with a broken link is refused rather than narrated over.
  const chain = (base, armName, arm) => {
    if (base === undefined || arm === undefined) return null;
    if (!material(arm, base)) return { arm: armName, material: false };

    const links = {
      launchSchedule: { base: base.meanTotalParties, arm: arm.meanTotalParties },
      target: { base: base.meanUniqueInformationTargets, arm: arm.meanUniqueInformationTargets },
      actualRoute: { base: base.meanUniqueTilesVisited, arm: arm.meanUniqueTilesVisited },
      newRecords: { base: base.meanNewRecordCreations, arm: arm.meanNewRecordCreations },
      refreshedRecords: { base: base.meanPlaceRefreshes, arm: arm.meanPlaceRefreshes },
      seasonsAdded: { base: base.meanExistingRecordSeasonAdditions, arm: arm.meanExistingRecordSeasonAdditions },
      recordsRetained: { base: base.meanPlaceEvictions, arm: arm.meanPlaceEvictions },
      laterReader: {
        base: base.seasonIdentityReads?.destination_season_modifier?.consequential ?? 0,
        arm: arm.seasonIdentityReads?.destination_season_modifier?.consequential ?? 0,
      },
      changedMovementAction: {
        base: base.meanResidentialMovesOntoRouteCountry,
        arm: arm.meanResidentialMovesOntoRouteCountry,
      },
      physicalReceipt: { base: base.meanReceiptsFromRouteCountry, arm: arm.meanReceiptsFromRouteCountry },
      support: { base: base.meanSupport, arm: arm.meanSupport },
      demography: { base: base.meanFinalPopulation, arm: arm.meanFinalPopulation },
    };

    const moved = Object.entries(links).filter(([, v]) => {
      const b = v.base ?? 0;
      const a = v.arm ?? 0;
      return Math.abs(a - b) / Math.max(1, Math.abs(b)) >= 0.1;
    });

    return {
      arm: armName,
      material: true,
      links,
      movedLinks: moved.map(([name]) => name),
      // A chain is COMPLETE only if the whole path moved: schedule/target/route → records →
      // a later reader or a changed action → a physical receipt → support → demography.
      complete:
        moved.some(([n]) => ["launchSchedule", "target", "actualRoute"].includes(n)) &&
        moved.some(([n]) => ["newRecords", "refreshedRecords", "seasonsAdded", "recordsRetained"].includes(n)) &&
        moved.some(([n]) => ["laterReader", "changedMovementAction"].includes(n)) &&
        moved.some(([n]) => ["physicalReceipt", "support"].includes(n)) &&
        moved.some(([n]) => n === "demography"),
    };
  };

  report.sites[site] = {
    label,
    structureClass: phenotypeOf[site]?.structureClass,
    terrainKind: phenotypeOf[site]?.terrainKind,
    qualifies: phenotypeOf[site]?.qualifies,
    qualifyConditions: phenotypeOf[site]?.qualifyConditions,
    arms: Object.fromEntries(
      Object.entries(arms).map(([name, a]) => [
        name,
        { survival: a.survival, meanFinalPopulation: a.meanFinalPopulation, meanSupport: a.meanSupport },
      ]),
    ),
    f1EffectVsProduction: f1Effect,
    comparisons: {
      "F1 vs G1 (verification semantics + disposition)": {
        material: semanticsMatters,
        survival: [F1?.survival, G1?.survival],
        population: [F1?.meanFinalPopulation, G1?.meanFinalPopulation],
      },
      "G1 vs G2 (target rotation alone)": {
        material: rotationMatters,
        survival: [G1?.survival, G2?.survival],
        population: [G1?.meanFinalPopulation, G2?.meanFinalPopulation],
        rotationRetargetsFired: G2?.replayFidelity?.rotationRetargets ?? 0,
      },
      "F1 vs G3 (cadence held, broad-exploration targets)": {
        material: material(F1, G3),
        survival: [F1?.survival, G3?.survival],
        population: [F1?.meanFinalPopulation, G3?.meanFinalPopulation],
      },
      "F1 vs G4 (cadence held, nearest uncertain target)": {
        material: material(F1, G4),
        survival: [F1?.survival, G4?.survival],
        population: [F1?.meanFinalPopulation, G4?.meanFinalPopulation],
      },
      "F1 vs G5 (cadence held, rotating sectors)": {
        material: material(F1, G5),
        survival: [F1?.survival, G5?.survival],
        population: [F1?.meanFinalPopulation, G5?.meanFinalPopulation],
      },
      "F0 vs G6 (retain donor places, no travel)": {
        material: material(G6, F0),
        survival: [F0?.survival, G6?.survival],
        population: [F0?.meanFinalPopulation, G6?.meanFinalPopulation],
      },
      "F1 vs G6 (travel beyond retention)": {
        material: material(F1, G6),
        survival: [F1?.survival, G6?.survival],
        population: [F1?.meanFinalPopulation, G6?.meanFinalPopulation],
      },
    },
    mechanism,
    // §8 — the split accounting, never pooled.
    seasonInformationAccounting: Object.fromEntries(
      Object.entries(arms).map(([name, a]) => [
        name,
        {
          existingRecordSeasonAdditions: a.meanExistingRecordSeasonAdditions,
          newRecordCreations: a.meanNewRecordCreations,
          newRecordsWithBaseContent: a.meanNewRecordsWithBaseContent,
          newRecordShareOfObservations: a.meanNewRecordShare,
          seasonIdentityReaders: a.seasonIdentityReads,
        },
      ]),
    ),
    mediation: [
      chain(arms.F0, "F1", arms.F1),
      chain(arms.F1, "G1", arms.G1),
      chain(arms.F1, "G3", arms.G3),
      chain(arms.F1, "G4", arms.G4),
      chain(arms.F1, "G5", arms.G5),
      chain(arms.F0, "G6", arms.G6),
    ].filter((c) => c !== null),
    semanticSuppressionProof: Object.fromEntries(
      Object.entries(arms).map(([name, a]) => [name, a.semanticSuppression]),
    ),
  };
}

// ── §10 matched comparisons — pairs alike on one axis and different on another ──────────
const axes = [
  {
    name: "similar baseline survival, different terrain structure",
    same: (a, b) => Math.abs((matrix.summary[a.tileId]?.F0?.survival ?? 0) - (matrix.summary[b.tileId]?.F0?.survival ?? 0)) <= 0.2,
    differ: (a, b) => a.structureClass !== b.structureClass,
  },
  {
    name: "similar opportunity distance, different route branching",
    same: (a, b) => Math.abs(a.opportunity.distanceToBestAlternative - b.opportunity.distanceToBestAlternative) <= 2,
    differ: (a, b) => Math.abs(a.route.routeBranching - b.route.routeBranching) >= 0.2,
  },
  {
    name: "similar seasonal pressure, different aquatic contribution",
    same: (a, b) => Math.abs(a.seasonal.leanSeasonSeverity - b.seasonal.leanSeasonSeverity) <= 0.08,
    differ: (a, b) => Math.abs(a.aquaticContribution.aquaticFoodShare - b.aquaticContribution.aquaticFoodShare) >= 0.15,
  },
  {
    name: "similar memory pressure, different observation sensitivity",
    same: (a, b) =>
      Math.abs(
        (matrix.summary[a.tileId]?.F0?.meanMandatorySetPressure ?? 0) -
          (matrix.summary[b.tileId]?.F0?.meanMandatorySetPressure ?? 0),
      ) <= 0.15,
    differ: (a, b) =>
      Math.abs(
        (matrix.summary[a.tileId]?.F1?.survival ?? 0) - (matrix.summary[a.tileId]?.F0?.survival ?? 0),
      ) -
        Math.abs(
          (matrix.summary[b.tileId]?.F1?.survival ?? 0) - (matrix.summary[b.tileId]?.F0?.survival ?? 0),
        ) >=
      0.3,
  },
];

for (const axis of axes) {
  for (let i = 0; i < phenotypes.sites.length; i += 1) {
    for (let j = i + 1; j < phenotypes.sites.length; j += 1) {
      const a = phenotypes.sites[i];
      const b = phenotypes.sites[j];

      if (matrix.summary[a.tileId] === undefined || matrix.summary[b.tileId] === undefined) continue;

      try {
        if (axis.same(a, b) && axis.differ(a, b)) {
          report.matchedComparisons.push({
            axis: axis.name,
            pair: [a.label, b.label],
            tiles: [a.tileId, b.tileId],
            f1EffectA: report.sites[a.tileId]?.f1EffectVsProduction,
            f1EffectB: report.sites[b.tileId]?.f1EffectVsProduction,
            mechanismA: report.sites[a.tileId]?.mechanism,
            mechanismB: report.sites[b.tileId]?.mechanism,
          });
        }
      } catch {
        // A phenotype field may be missing on a degenerate site; skip rather than invent.
      }
    }
  }
}

// ── the replicated conditional, or an explicit refusal to state one ─────────────────────
const sensitive = Object.entries(report.sites).filter(
  ([, s]) => s.f1EffectVsProduction === "strongly beneficial" || s.f1EffectVsProduction === "weakly beneficial",
);
const insensitive = Object.entries(report.sites).filter(([, s]) => s.f1EffectVsProduction === "neutral");
const harmed = Object.entries(report.sites).filter(([, s]) => String(s.f1EffectVsProduction).includes("harmful"));

const share = (rows, pick) => (rows.length === 0 ? null : rows.reduce((acc, [tile]) => acc + pick(phenotypeOf[tile]), 0) / rows.length);

report.conditional = {
  sensitiveSites: sensitive.map(([tile, s]) => `${s.label} (${tile})`),
  insensitiveSites: insensitive.map(([tile, s]) => `${s.label} (${tile})`),
  harmedSites: harmed.map(([tile, s]) => `${s.label} (${tile})`),
  replicatesWithinAClass:
    sensitive.length >= 2 &&
    new Set(sensitive.map(([tile]) => phenotypeOf[tile]?.structureClass)).size === 1 &&
    // The class must have BOTH its sites sensitive, or the class is not what is doing the work.
    phenotypes.sites.filter((s) => s.structureClass === phenotypeOf[sensitive[0][0]]?.structureClass).length ===
      sensitive.length,
  candidateAxes: {
    aquaticFoodShare: {
      sensitive: r2(share(sensitive, (p) => p?.aquaticContribution?.aquaticFoodShare ?? 0)),
      insensitive: r2(share(insensitive, (p) => p?.aquaticContribution?.aquaticFoodShare ?? 0)),
    },
    waterAccess: {
      sensitive: r2(share(sensitive, (p) => p?.waterProfile?.waterAccess ?? 0)),
      insensitive: r2(share(insensitive, (p) => p?.waterProfile?.waterAccess ?? 0)),
    },
    distinctViableAlternatives: {
      sensitive: r2(share(sensitive, (p) => p?.opportunity?.distinctViableAlternatives ?? 0)),
      insensitive: r2(share(insensitive, (p) => p?.opportunity?.distinctViableAlternatives ?? 0)),
    },
    distanceToBestAlternative: {
      sensitive: r2(share(sensitive, (p) => p?.opportunity?.distanceToBestAlternative ?? 0)),
      insensitive: r2(share(insensitive, (p) => p?.opportunity?.distanceToBestAlternative ?? 0)),
    },
    corridorObstacles: {
      sensitive: r2(share(sensitive, (p) => p?.route?.obstacleCount ?? 0)),
      insensitive: r2(share(insensitive, (p) => p?.route?.obstacleCount ?? 0)),
    },
    baselineSurvival: {
      sensitive: r2(sensitive.length === 0 ? null : sensitive.reduce((a, [t]) => a + (matrix.summary[t]?.F0?.survival ?? 0), 0) / sensitive.length),
      insensitive: r2(insensitive.length === 0 ? null : insensitive.reduce((a, [t]) => a + (matrix.summary[t]?.F0?.survival ?? 0), 0) / insensitive.length),
    },
    memoryMandatoryPressure: {
      sensitive: r2(sensitive.length === 0 ? null : sensitive.reduce((a, [t]) => a + (matrix.summary[t]?.F0?.meanMandatorySetPressure ?? 0), 0) / sensitive.length),
      insensitive: r2(insensitive.length === 0 ? null : insensitive.reduce((a, [t]) => a + (matrix.summary[t]?.F0?.meanMandatorySetPressure ?? 0), 0) / insensitive.length),
    },
  },
};

console.log("=== §12 PER-SITE CLASSIFICATION ===");
for (const [tile, s] of Object.entries(report.sites)) {
  console.log(
    `${String(s.label).padEnd(2)} ${tile.padEnd(15)} ${String(s.structureClass).padEnd(16)} ` +
      `F1=${String(s.f1EffectVsProduction).padEnd(20)} mechanism=${s.mechanism}`,
  );
}

console.log("\n=== §5/§6/§7/§11 COMPARISONS (material?) ===");
for (const [tile, s] of Object.entries(report.sites)) {
  console.log(`${s.label} ${tile}`);
  for (const [name, c] of Object.entries(s.comparisons)) {
    console.log(`   ${c.material ? "MATERIAL " : "no change"}  ${name}  ${JSON.stringify(c.survival)} ${JSON.stringify(c.population)}`);
  }
}

console.log("\n=== §10 MATCHED COMPARISONS ===");
for (const row of report.matchedComparisons) {
  console.log(`${row.axis}: ${row.pair.join(" vs ")} -> ${row.f1EffectA} / ${row.f1EffectB}`);
}

console.log("\n=== REPLICATED CONDITIONAL ===");
console.log(JSON.stringify(report.conditional, null, 2));

mkdirSync(OUT.slice(0, OUT.lastIndexOf("/")), { recursive: true });
writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(`\nwrote ${OUT}`);
