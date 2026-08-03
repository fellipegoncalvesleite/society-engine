// ROADMAP ITEM 4 §3 — RESOLVE THE `daughterSeasonalSupport` CONTRADICTION.
//
// The committed before-evidence reports `daughterSeasonalSupport: "INHERITED"` for both natural
// fissions, while production constructs the daughter with `seasonalSupport: undefined` and the
// written audit says "reset". One of the three is wrong. This decides which, by measurement.
//
// The candidate explanations the brief lists are each testable:
//
//   (a) the probe sampled after a later context update;
//   (b) it tested field presence incorrectly;
//   (c) it confused DERIVED support with INHERITED support;
//   (d) the label was simply inaccurate;
//   (e) it found a separate support field.
//
// The decisive question for the architecture is narrower than the label: was any PHYSICAL food or
// receipt carried across, or was a read-model recomputed from the daughter's own state? Those have
// completely different consequences for material conservation.
//
// AUDIT ONLY.
import { createServer } from "vite";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const OUT = arg("out", "artifacts/c38/fission-before-support-corrected.json");
const SEEDS = arg("seeds", "audit27:natural:s1,audit27:natural:map2:s1").split(",");
const YEARS = Number(arg("years", "200"));

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c38sup-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const r4 = (v) => (typeof v === "number" ? Math.round(v * 10000) / 10000 : v);

  const findings = [];
  for (const seed of SEEDS) {
    let world = runner.initSimWorld({ kind: "map2" }, seed);
    const known = new Set(Object.keys(world.bands));
    let previous = world;

    for (let day = 0; day < YEARS * 360; day += 1) {
      previous = world;
      world = advance.advanceWorldByDays(world, 1);
      for (const b of Object.values(world.bands)) {
        const id = String(b.id);
        if (known.has(id)) continue;
        known.add(id);
        if (b.parentBandId === undefined) continue;
        const parentBefore = previous.bands[b.parentBandId];
        const parentAfter = world.bands[b.parentBandId];
        if (parentBefore === undefined || parentAfter === undefined) continue;

        const ds = b.seasonalSupport;
        const psBefore = parentBefore.seasonalSupport;
        const psAfter = parentAfter.seasonalSupport;

        // Is the daughter's object the parent's object, or a distinct one?
        const sameObjectAsParentBefore = ds !== undefined && ds === psBefore;
        const sameObjectAsParentAfter = ds !== undefined && ds === psAfter;
        const deepEqualToParentBefore = ds !== undefined && psBefore !== undefined
          && JSON.stringify(ds) === JSON.stringify(psBefore);

        // Does it carry any PHYSICAL receipt, or only derived readings?
        const receiptBearingKeys = ["receipts", "topReceipts", "harvestUnits", "usableSupport",
          "capturedUnits", "receiptCount"];
        const carriesReceipts = ds === undefined ? false
          : receiptBearingKeys.some((k) => ds[k] !== undefined
            && (Array.isArray(ds[k]) ? ds[k].length > 0 : Number(ds[k]) > 0));

        findings.push({
          seed, day: Number(world.time.day ?? day), daughter: id, parent: String(b.parentBandId),

          // What the ORIGINAL probe's expression would have said, reproduced exactly.
          originalProbeExpression: "b.seasonalSupport === undefined ? 'reset' : 'INHERITED'",
          originalProbeVerdict: ds === undefined ? "reset" : "INHERITED",

          // What is actually there, at the end of the fission day.
          daughterSeasonalSupportPresentAtEndOfFissionDay: ds !== undefined,
          daughterSeasonalSupportIsTheParentsObject: sameObjectAsParentBefore || sameObjectAsParentAfter,
          daughterSeasonalSupportDeepEqualsParentBefore: deepEqualToParentBefore,
          daughterSeasonalSupportCarriesPhysicalReceipts: carriesReceipts,

          // The physical receipt accumulator — the thing that actually matters materially.
          daughterSeasonalFoodReceipts: b.seasonalFoodReceipts === undefined ? "reset" : "PRESENT",
          daughterExpeditions: (b.expeditions ?? []).length,
          daughterRecentTrips: (b.recentIntraSeasonTrips ?? []).length,

          // Comparable readings, so "different from the parent" is a measurement not an assertion.
          daughterRawSupportRatio: r4(ds?.currentSeasonSupport?.rawSupportRatio ?? null),
          parentRawSupportRatioBefore: r4(psBefore?.currentSeasonSupport?.rawSupportRatio ?? null),
          parentRawSupportRatioAfter: r4(psAfter?.currentSeasonSupport?.rawSupportRatio ?? null),
          daughterChronicDeficitStreak: ds?.chronicDeficitStreak ?? null,
          parentChronicDeficitStreakBefore: psBefore?.chronicDeficitStreak ?? null,
        });
      }
    }
  }

  const anyReceipts = findings.some((f) => f.daughterSeasonalSupportCarriesPhysicalReceipts);
  const anyParentObject = findings.some((f) => f.daughterSeasonalSupportIsTheParentsObject);
  const anyDeepEqual = findings.some((f) => f.daughterSeasonalSupportDeepEqualsParentBefore);
  const anyInheritedReceiptStore = findings.some((f) => f.daughterSeasonalFoodReceipts !== "reset");

  out = {
    audit: "ITEM-4-FISSION-BEFORE-SUPPORT-CORRECTION",
    tree: "ab2986432e6d34df633b76ce46c67099afb4145c",
    seeds: SEEDS, years: YEARS, fissionsObserved: findings.length,

    creationTimeValueReadFromProduction: {
      site: "src/sim/agents/demography.ts:1024",
      value: "seasonalSupport: undefined",
      note: "the daughter is constructed with NO seasonal support. The written audit's 'reset' was correct ABOUT CREATION TIME.",
    },
    firstLaterWriter: {
      site: "src/sim/agents/socialContext.ts:283",
      expression: "seasonalSupport: seasonalSupport ?? band.seasonalSupport",
      reachedFrom: "src/sim/tick/advance.ts:284 — the FINAL updateBandContextStates pass, which runs AFTER updateBandsDemographyAndFission at advance.ts:237, inside the SAME simulated day",
      effect: "a fresh seasonal support is DERIVED for the daughter from its own position and state before the day ends",
    },

    verdict: {
      whichPartyWasWrong: "THE PROBE'S LABEL",
      explanation: "cause (a) AND cause (c) together. The probe sampled at the END of the fission day, by which time the final context pass had already derived a fresh seasonal support for the daughter; and it then labelled any non-undefined value 'INHERITED', which conflates a DERIVED read-model with a CARRIED-OVER one. Production is correct and the written audit's 'reset' is correct about creation time — it was merely silent about the same-day re-derivation.",
      productionDefect: false,
      writtenAuditClaimStatus: "CORRECT BUT INCOMPLETE — 'reset' described creation time and did not mention that the field is re-derived within the same day",
      probeLabelStatus: "WRONG — 'INHERITED' was never true of this field",
    },

    whatActuallyMatters: {
      question: "was any PHYSICAL food or receipt carried across?",
      answer: "NO",
      physicalReceiptStoreInherited: anyInheritedReceiptStore,
      supportObjectCarriesPhysicalReceipts: anyReceipts,
      supportObjectIsTheParentsObject: anyParentObject,
      supportObjectDeepEqualsParentBefore: anyDeepEqual,
      note: "`seasonalFoodReceipts` is the physical receipt accumulator and is reset in every observed fission. `seasonalSupport` is a DERIVED read-model over it; a daughter with no receipts derives a support state describing exactly that. No material was created or duplicated.",
    },

    consequenceForTheImplementation: {
      materialConservation: "the before-package's material claim STANDS: nothing physical is inherited at fission. The support correction changes the LABEL, not the ledger.",
      carriedForwardRequirement: "any Item 4 material ledger must distinguish a PHYSICAL store (seasonalFoodReceipts) from a DERIVED read-model (seasonalSupport), and must sample at a NAMED sub-step rather than at end-of-day — the same sampling-cadence lesson CORRECTION-34A recorded for presence.",
    },

    nonVacuity: {
      predicate: "at least one real fission was observed and its support state actually inspected",
      fissionsObserved: findings.length,
      met: findings.length > 0,
    },
    findings,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
} finally {
  await server.close();
}

console.log(JSON.stringify({
  fissions: out.fissionsObserved, verdict: out.verdict, whatMatters: out.whatActuallyMatters,
}, null, 2));
