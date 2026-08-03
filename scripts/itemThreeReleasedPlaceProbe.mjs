// ROADMAP ITEM 3 — targeted probe: a place production labels `released_historical` whose
// behavioural contribution is nevertheless non-zero.
//
// The integrated natural run found ONE such place in 448 checked over 200 years on one seed.
// Either release is incomplete (a production defect that would block the freeze), or the probe's
// strip-the-ring instrument is measuring something other than release. This isolates it.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const OUT = arg("out", "docs/evidence/shared-range-item-3-final-freeze/released-place-probe.json");
const SEED = arg("seed", "audit27:natural:map2:s1");
const YEARS = Number(arg("years", "200"));
const ACCESS_EVERY_DAYS = 90;
const SOCIAL_EVIDENCE_ACTIVE_MIN_WEIGHT = 0.05;   // accessNorms.ts:57

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-item3-rel-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const accessNorms = await server.ssrLoadModule("/sim/agents/accessNorms.ts");

  let world = runner.initSimWorld({ kind: "map2" }, SEED);
  const days = YEARS * 360;
  const incidents = [];
  let releasedChecked = 0;

  for (let d = 0; d < days && incidents.length < 5; d += 1) {
    world = advance.advanceWorldByDays(world, 1);
    if (d % ACCESS_EVERY_DAYS !== 0) continue;
    for (const band of Object.values(world.bands)) {
      if (band.status === "dispersed" || band.viability?.status === "extinct" || band.viability?.status === "absorbed") continue;
      const access = accessNorms.advanceProtoAccessMemory(world, band);
      for (const p of Object.values(access.places ?? {})) {
        if (p.socialEvidencePhase !== "released_historical") continue;
        releasedChecked += 1;
        const strippedBand = { ...band, recentRangeFrictionEvents: undefined };
        const strippedWorld = { ...world, bands: { ...world.bands, [band.id]: strippedBand } };
        const without = accessNorms.advanceProtoAccessMemory(strippedWorld, strippedBand).places?.[p.tileId];
        const delta = {
          strangerCaution: (p.strangerCaution ?? 0) - (without?.strangerCaution ?? 0),
          sharedUsePressure: (p.sharedUsePressure ?? 0) - (without?.sharedUsePressure ?? 0),
          rememberedRefusalAvoidance: (p.rememberedRefusalAvoidance ?? 0) - (without?.rememberedRefusalAvoidance ?? 0),
        };
        const total = Math.abs(delta.strangerCaution) + Math.abs(delta.sharedUsePressure) + Math.abs(delta.rememberedRefusalAvoidance);
        if (total <= 1e-9) continue;

        // ── DECOMPOSITION ────────────────────────────────────────────────────────────────────
        // Is the place still tracked at all when the ring is stripped? If the STRIPPED derivation
        // no longer holds the place, the "delta" is not a residual influence — it is the
        // difference between a tracked place and an absent one, which is the bounded-memory
        // artefact CORRECTION-31 already recorded once.
        const placeStillTrackedWithoutRing = without !== undefined;
        // Do the tile's own records really all sit below the active threshold?
        const ringForThisTile = (band.recentRangeFrictionEvents ?? []).filter((e) => String(e.tileId) === String(p.tileId));
        // Strip ONLY this tile's records, leaving the rest of the ring intact. If the delta
        // survives that, the influence is not coming from this place's own evidence.
        const otherTilesOnly = (band.recentRangeFrictionEvents ?? []).filter((e) => String(e.tileId) !== String(p.tileId));
        const partialBand = { ...band, recentRangeFrictionEvents: otherTilesOnly };
        const partialWorld = { ...world, bands: { ...world.bands, [band.id]: partialBand } };
        const partial = accessNorms.advanceProtoAccessMemory(partialWorld, partialBand).places?.[p.tileId];
        const partialDelta = partial === undefined ? null : Math.abs((p.strangerCaution ?? 0) - (partial.strangerCaution ?? 0)) +
          Math.abs((p.sharedUsePressure ?? 0) - (partial.sharedUsePressure ?? 0)) +
          Math.abs((p.rememberedRefusalAvoidance ?? 0) - (partial.rememberedRefusalAvoidance ?? 0));

        incidents.push({
          day: d, band: String(band.id), tile: String(p.tileId),
          phase: p.socialEvidencePhase,
          activeEvidenceCount: p.activeEvidenceCount ?? null,
          activeEvidenceWeight: p.activeEvidenceWeight ?? null,
          historicalEvidenceCount: p.historicalEvidenceCount ?? null,
          maxWeightBelowActiveThreshold: (p.activeEvidenceWeight ?? 0) < SOCIAL_EVIDENCE_ACTIVE_MIN_WEIGHT,
          wholeRingStrippedDelta: { ...delta, total: Math.round(total * 1e6) / 1e6 },
          placeStillTrackedWhenWholeRingStripped: placeStillTrackedWithoutRing,
          recordsNamingThisTile: ringForThisTile.length,
          recordsNamingOtherTiles: otherTilesOnly.length,
          onlyThisTilesRecordsStrippedDelta: partialDelta === null ? null : Math.round(partialDelta * 1e6) / 1e6,
          placeStillTrackedWhenOnlyThisTileStripped: partial !== undefined,
        });
      }
    }
  }

  const artefactual = incidents.every((i) =>
    i.recordsNamingThisTile === 0 || i.placeStillTrackedWhenWholeRingStripped === false ||
    i.onlyThisTilesRecordsStrippedDelta === 0);

  out = {
    audit: "ROADMAP-ITEM-3-RELEASED-PLACE-PROBE",
    seed: SEED, yearsScanned: YEARS, accessSampledEveryDays: ACCESS_EVERY_DAYS,
    releasedPlacesChecked: releasedChecked,
    incidentsFound: incidents.length,
    incidents,
    interpretation: incidents.length === 0
      ? "no released place moved behaviour in the scanned window"
      : artefactual
        ? "EVERY incident is an INSTRUMENT ARTEFACT of the strip-the-ring counterfactual, not a residual influence of released evidence — see `classification` for which of the three artefact conditions each incident meets"
        : "AT LEAST ONE incident survives every artefact test and is a candidate PRODUCTION DEFECT: a place production calls released still moves behaviour through its own evidence",
    classification: {
      artefactConditions: [
        "recordsNamingThisTile === 0 — the whole-ring strip changed a place whose own evidence is empty, so the movement came from the ring's BAND-LEVEL effects, not from this place's released records",
        "placeStillTrackedWhenWholeRingStripped === false — the stripped derivation does not hold the place at all, so the 'delta' compares a tracked place against an absent one; CORRECTION-31 recorded this bounded-memory artefact",
        "onlyThisTilesRecordsStrippedDelta === 0 — removing exactly this tile's own records changes nothing, which is precisely what release means",
      ],
      allIncidentsArtefactual: artefactual,
    },
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
} finally {
  await server.close();
}

console.log(JSON.stringify(out, null, 2).slice(0, 4000));
