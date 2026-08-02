// CORRECTION-32A §13 — SOCIAL-ACCESS POSITIVE AND RELEASE LIFECYCLE.
//
// CORRECTION-32 changed `dryMargin.getSocialAccessRisk` from
//
//     clamp01(nearbyBandCount / 5 + salientUsers / 4) * 0.26        (physical bodies, plus OTHER
//                                                                    bands' remembered places with
//                                                                    no distance gate at all)
// to
//     clamp01(strangerCaution * 0.6 + rememberedRefusalAvoidance * 0.4) * 0.26
//                                                                   (the band's OWN access memory
//                                                                    ABOUT THIS PLACE)
//
// and shipped with NO fixture proving the replacement is behaviourally live. The evidence said
// P10 contained zero friction records, so the new source had never been exercised. A plausible
// architecture with an unexercised reader is exactly the "state field nobody reads" anti-pattern.
//
// This audit proves the replacement responds to legitimate, place-specific, aged social evidence
// and to nothing else.
//
//   S1  neutral physical proximity — a non-kin band nearby, nothing having happened
//   S2  legitimate ACTIVE access evidence at tile X, built through production authorities
//   S3  CORRECTION-31 lifecycle release — records retained, behaviour returns to baseline
//   S4  place specificity — evidence at X must not raise risk at unrelated tile Y
//   S5  second-hand (report-derived) evidence, marked as such and released on its own lifecycle
//   S6  old contact memory with no place evidence about X
//   S7  world-band-count control — identical total band count, only the evidence differs
//
// `getSocialAccessRisk` is module-private. It is NOT copied here. Every reading is taken through
// its real production consumers: `deriveDryMarginMobilityContext` (water-refuge profile and
// known-prospect candidates) and the candidate `ScoreBreakdown.socialAccessRisk` that
// `scoreDecision` weights at -0.36.
//
// `unrelatedRisk` (`Object.values(world.bands).length > 8 && knownContactCount === 0`) is a KNOWN
// anti-omniscience defect that CORRECTION-32 deliberately left in place. It is NOT repaired here.
// Every comparison holds the total world band count IDENTICAL so it cannot confound a result.
//
// Usage: node scripts/socialAccessLifecycleAudit.mjs --arm after

import { dirname } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "vite";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1] : fallback;
};

const EVIDENCE = "docs/evidence/crowding-decision-pressure-authority-32";
const ARM = arg("arm", "after");
const SUFFIX = ARM === "before" ? "-before" : "";
const OUT = arg("out", `${EVIDENCE}/social-access-lifecycle${SUFFIX}.json`);
const WARM = Number(arg("warm", "12"));
const CONTACT_SEASONS = Number(arg("contact-seasons", "6"));
const RELEASE_SEASONS = Number(arg("release-seasons", "20"));
const SEED = arg("seed", "c32a:social");
const SEASON_DAYS = 90;
const DRY = { x: 60, y: 132 };

const r4 = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10000) / 10000 : v);

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c32a-social-${process.pid}`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const spawn = await server.ssrLoadModule("/sim/agents/spawn.ts");
  const contextCache = await server.ssrLoadModule("/sim/agents/contextCache.ts");
  const dryMargin = await server.ssrLoadModule("/sim/agents/dryMargin.ts");
  const bandDecision = await server.ssrLoadModule("/sim/rules/bandDecision.ts");

  const baseWorld = runner.initSimWorld({ kind: "map2" }, SEED);
  const byXY = new Map(Object.values(baseWorld.tiles).map((t) => [`${t.coord.x}:${t.coord.y}`, t]));
  const at = (o, dx, dy = 0) => byXY.get(`${o.x + dx}:${o.y + dy}`)?.id;

  const landNear = (origin, count, offsets) => {
    const out = [];
    const seen = new Set();
    for (const [dx, dy] of offsets) {
      const id = at(origin, dx, dy);
      const tile = id === undefined ? undefined : baseWorld.tiles[id];
      if (tile === undefined || tile.isAquatic || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
      if (out.length === count) break;
    }
    return out;
  };

  const build = (tileIds) => {
    const cleared = spawn.removeInitialBands(baseWorld, Object.keys(baseWorld.bands));
    return spawn.spawnCustomBands(
      cleared,
      tileIds.map((tileId, i) => ({ tileId, population: 30, name: i === 0 ? "observer" : `other${i}` })),
      SEED,
    );
  };
  const step = (world, seasons) => {
    let w = world;
    for (let i = 0; i < seasons; i += 1) w = advance.advanceWorldByDays(w, SEASON_DAYS);
    return w;
  };
  const park = (world, placements) => ({
    ...world,
    bands: Object.fromEntries(
      Object.entries(world.bands).map(([id, band]) => [
        id,
        placements[id] === undefined ? band : { ...band, position: placements[id] },
      ]),
    ),
  });
  /** Hold a geometry through real production ticks, re-parking after each season. */
  const hold = (world, placements, seasons) => {
    let w = park(world, placements);
    for (let i = 0; i < seasons; i += 1) {
      w = park(advance.advanceWorldByDays(w, SEASON_DAYS), placements);
    }
    return w;
  };

  /**
   * Read social-access risk THROUGH production consumers. Never re-implements the formula.
   */
  const readAccess = (world, observerId) => {
    const cache = contextCache.buildTickContextCache(world);
    const band = world.bands[observerId];
    const tileId = String(band.position);
    const ctx = dryMargin.deriveDryMarginMobilityContext(world, band, cache);
    const decision = bandDecision.evaluateBandDecision(world, band, contextCache.buildTickContextCache(world));
    const breakdownRisks = decision.alternativesConsidered.map((a) => r4(a.scoreBreakdown.socialAccessRisk));
    const place = band.protoAccessMemory?.places?.[band.position];
    const friction = band.rangeFriction?.events ?? band.rangeFriction ?? [];
    const frictionArray = Array.isArray(friction) ? friction : (friction.events ?? []);
    return {
      tileId,
      dryMarginRelevant: ctx !== undefined,
      relevanceBasis: dryMargin.getDryMarginRelevanceBasis(world, band).map(String),
      // PRIMARY consumer: the water-refuge profile's own socialAccessRisk for the current tile.
      currentWaterRefugeSocialAccessRisk: r4(ctx?.currentWaterRefuge?.socialAccessRisk ?? null),
      // SECONDARY consumer: whatever reaches the candidate score.
      maxCandidateSocialAccessRisk: breakdownRisks.length === 0 ? null : r4(Math.max(...breakdownRisks)),
      candidateSocialAccessRisks: breakdownRisks,
      // the band's OWN place-specific access memory — the new source
      accessMemory:
        place === undefined
          ? null
          : {
              accessState: place.accessState,
              strangerCaution: r4(place.strangerCaution),
              rememberedRefusalAvoidance: r4(place.rememberedRefusalAvoidance),
              sharedUsePressure: r4(place.sharedUsePressure),
              confidence: r4(place.confidence),
              activeEvidenceWeight: r4(place.activeEvidenceWeight ?? null),
              activeEvidenceCount: place.activeEvidenceCount ?? null,
              historicalEvidenceCount: place.historicalEvidenceCount ?? null,
              socialEvidencePhase: place.socialEvidencePhase ?? null,
              presentWithoutOthersSeasons: place.presentWithoutOthersSeasons ?? null,
            },
      evidence: {
        frictionRecords: frictionArray.length,
        reportLinkedFrictionRecords: frictionArray.filter(
          (e) => e?.observationProvenance === "reported_secondhand" || e?.reportId !== undefined,
        ).length,
        contactMemories: Object.keys(band.contactMemories ?? {}).length,
        encounterRecords: (band.encounterRecords ?? []).length,
      },
      // the confounder that must be held fixed
      worldBandCount: Object.values(world.bands).length,
      knownContactCount:
        Object.keys(band.contactMemories ?? {}).length + (band.knowledge?.knownBands ?? []).length,
      unrelatedRiskWouldFire:
        Object.values(world.bands).length > 8 &&
        Object.keys(band.contactMemories ?? {}).length + (band.knowledge?.knownBands ?? []).length === 0,
    };
  };

  const fixtures = [];
  const OFFSETS = [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [2, 0], [0, 2], [3, 0]];

  // GEOMETRY BY SEARCH, NOT BY OFFSET. A previous pass in this checkpoint family lost a fixture to
  // a hardcoded `+x` far-land search that walked off the map (map2 is 220 x 140), and the first
  // version of THIS script asked for a tile at y = 144 and silently got nothing. The origin is
  // therefore the first dry-margin-relevant land tile (in tile-id order, so the choice is
  // deterministic) that actually has the land neighbours the fixtures need, and the far tile is
  // searched in every direction rather than one.
  const allTiles = Object.values(baseWorld.tiles);
  const isDryRelevant = (t) =>
    !t.isAquatic &&
    (t.biomeKind === "arid" || t.terrainKind === "desert" || (t.riskProfile?.droughtRisk ?? 0) > 0.48);
  const sorted = [...allTiles].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  let origin = DRY;
  let tiles = landNear(DRY, 4, OFFSETS);
  if (tiles.length < 3 || !isDryRelevant(baseWorld.tiles[tiles[0]])) {
    for (const t of sorted) {
      if (!isDryRelevant(t)) continue;
      const candidate = landNear(t.coord, 4, OFFSETS);
      if (candidate.length >= 3 && candidate.every((id) => isDryRelevant(baseWorld.tiles[id]))) {
        origin = t.coord;
        tiles = candidate;
        break;
      }
    }
  }
  // A far tile for the "same band count, no proximity" arm: land, dry-relevant (so the OTHER band
  // stays in comparable country), and well outside CROWDING_RADIUS = 4 in ANY direction.
  const farTiles = sorted
    .filter(
      (t) =>
        isDryRelevant(t) &&
        Math.abs(t.coord.x - origin.x) + Math.abs(t.coord.y - origin.y) > 30,
    )
    .slice(0, 1)
    .map((t) => t.id);

  if (tiles.length < 3 || farTiles.length < 1) {
    fixtures.push({ id: "S0_geometry", verdict: "VACUOUS_NO_LAND_GEOMETRY", origin, tiles, farTiles });
  } else {
    const [X, adjacent, Y] = tiles;
    const FAR = farTiles[0];

    // Every arm below spawns EXACTLY TWO bands, so `Object.values(world.bands).length` is
    // identical everywhere and `unrelatedRisk` cannot explain any difference.
    const baseTwo = () => step(build([X, FAR]), WARM);
    const ids = () => {
      const w = baseTwo();
      return Object.values(w.bands).map((b) => String(b.id)).sort();
    };
    const idList = ids();
    const OBS = idList[0];
    const OTHER = idList[1];

    // ---------------------------------------------------------------------------------- S1
    // Neutral proximity: the other band is parked ADJACENT, but no tick has run since, so there
    // is no friction record, no refusal, no active warning and no encounter about this place.
    {
      const warmWorld = baseTwo();
      const separated = park(warmWorld, { [OBS]: X, [OTHER]: FAR });
      const adjacentNow = park(warmWorld, { [OBS]: X, [OTHER]: adjacent });
      const a = readAccess(separated, OBS);
      const b = readAccess(adjacentNow, OBS);
      const delta = r4((b.currentWaterRefugeSocialAccessRisk ?? 0) - (a.currentWaterRefugeSocialAccessRisk ?? 0));
      fixtures.push({
        id: "S1_neutral_physical_proximity",
        intent:
          "a non-kin band is physically nearby and NOTHING has happened: no friction record, no " +
          "refusal, no active access warning, no hostile encounter, no report. Physical proximity " +
          "alone must not raise this tile's social-access caution.",
        syntheticState: true,
        syntheticNote: "both bands warmed on real ground, then parked; measured before any tick, so no evidence can have formed",
        separated: a,
        adjacent: b,
        deltaFromProximityAlone: delta,
        bandCountIdentical: a.worldBandCount === b.worldBandCount,
        frictionRecordsIdentical: a.evidence.frictionRecords === b.evidence.frictionRecords,
        verdict:
          a.currentWaterRefugeSocialAccessRisk === null
            ? "VACUOUS_NO_DRY_MARGIN_CONSUMER"
            : Math.abs(delta) < 0.0005
              ? "PROXIMITY_ALONE_DOES_NOT_RAISE_ACCESS_CAUTION"
              : "PROXIMITY_ALONE_RAISES_ACCESS_CAUTION",
      });
    }

    // ---------------------------------------------------------------------------------- S2
    // Legitimate ACTIVE evidence, produced by the ordinary production pipeline: the two bands are
    // held in real physical proximity through real ticks, so proximity -> range-friction evidence
    // -> protoAccessMemory for tile X is written by production, not by this script.
    let contactedWorld;
    {
      const warmWorld = baseTwo();
      const neutral = park(warmWorld, { [OBS]: X, [OTHER]: FAR });
      const neutralRead = readAccess(neutral, OBS);
      contactedWorld = hold(warmWorld, { [OBS]: X, [OTHER]: adjacent }, CONTACT_SEASONS);
      const contactedRead = readAccess(contactedWorld, OBS);

      // THE CONFOUNDER, NAMED RATHER THAN AVERAGED AWAY.
      //
      // A neutral-vs-contacted comparison changes TWO things at once, because a real contact
      // episode legitimately produces BOTH place evidence AND a contact memory, and
      // `knownContactRelief = clamp01(knownContactCount * 0.08)` SUBTRACTS from access risk. The
      // raw delta therefore mixes a rise in place caution with a fall from newly-known
      // neighbours, and reporting it as "the effect of access evidence" would be exactly the
      // one-treatment-two-causes error this whole correction exists to remove.
      //
      // The PLACE term is isolated instead by comparing two TILES inside the SAME world: the
      // evidenced tile X against an unrelated tile Y. `getSocialAccessRisk`'s only place-dependent
      // input on this arm is `band.protoAccessMemory.places[tileId]`; the 0.28 base, the contact
      // relief and `unrelatedRisk` are all per-band and identical between the two readings, so
      // risk(X) - risk(Y) is exactly the contribution of the evidence about X.
      const evidencedAtX = contactedRead;
      const evidencedAtY = readAccess(park(contactedWorld, { [OBS]: Y, [OTHER]: adjacent }), OBS);
      const placeAttributableRise = r4(
        (evidencedAtX.currentWaterRefugeSocialAccessRisk ?? 0) - (evidencedAtY.currentWaterRefugeSocialAccessRisk ?? 0),
      );
      const rawConfoundedDelta = r4(
        (contactedRead.currentWaterRefugeSocialAccessRisk ?? 0) - (neutralRead.currentWaterRefugeSocialAccessRisk ?? 0),
      );
      const contactReliefDelta = r4(
        -0.08 * Math.min(1, contactedRead.knownContactCount) + 0.08 * Math.min(1, neutralRead.knownContactCount),
      );
      const evidenceIsReal =
        (contactedRead.accessMemory?.strangerCaution ?? 0) > (neutralRead.accessMemory?.strangerCaution ?? 0) ||
        (contactedRead.accessMemory?.rememberedRefusalAvoidance ?? 0) >
          (neutralRead.accessMemory?.rememberedRefusalAvoidance ?? 0);
      const contactControlled = evidencedAtX.knownContactCount === evidencedAtY.knownContactCount;
      fixtures.push({
        id: "S2_legitimate_active_access_evidence",
        intent:
          "real place-specific social evidence, created by production authorities through a real " +
          "sequence (physical proximity -> range friction -> protoAccessMemory for X), must raise " +
          "social-access caution at X. Measured with the band's contact count HELD CONSTANT, so " +
          "the place evidence is the only thing that varies.",
        syntheticState: true,
        syntheticNote: `two bands held physically adjacent through ${CONTACT_SEASONS} real production seasons, re-parked after each`,
        primaryMeasurement: {
          method: "same world, same band, same contact count, evidenced tile X vs unrelated tile Y",
          atEvidencedTileX: evidencedAtX.currentWaterRefugeSocialAccessRisk,
          atUnrelatedTileY: evidencedAtY.currentWaterRefugeSocialAccessRisk,
          placeAttributableRise,
          knownContactCountIdentical: contactControlled,
          knownContactCount: evidencedAtX.knownContactCount,
        },
        confoundedRawComparison: {
          method: "neutral world vs contacted world at the same tile — NOT a clean treatment",
          neutralSocialAccessRisk: neutralRead.currentWaterRefugeSocialAccessRisk,
          contactedSocialAccessRisk: contactedRead.currentWaterRefugeSocialAccessRisk,
          rawDelta: rawConfoundedDelta,
          neutralKnownContactCount: neutralRead.knownContactCount,
          contactedKnownContactCount: contactedRead.knownContactCount,
          knownContactReliefDelta: contactReliefDelta,
          why:
            "the same episode that creates place evidence also creates a CONTACT MEMORY, and known " +
            "contacts legitimately REDUCE access risk. The raw delta is the sum of a rise in place " +
            "caution and a fall from contact relief, and is reported for completeness only.",
        },
        neutralBaseline: neutralRead,
        withActiveEvidence: contactedRead,
        evidenceIsBandsOwnPlaceMemory: evidenceIsReal,
        bandCountIdentical: neutralRead.worldBandCount === contactedRead.worldBandCount,
        verdict: !evidenceIsReal
          ? "VACUOUS_NO_ACTIVE_ACCESS_EVIDENCE_FORMED"
          : !contactControlled
            ? "INVALID_CONTACT_COUNT_NOT_CONTROLLED"
            : placeAttributableRise > 0.0005
              ? "ACTIVE_ACCESS_EVIDENCE_RAISES_CAUTION"
              : "ACTIVE_ACCESS_EVIDENCE_HAS_NO_EFFECT",
      });
    }

    // ---------------------------------------------------------------------------------- S3
    // Release: the other band leaves; the observer stays at X; CORRECTION-31's lifecycle cools
    // the evidence until it is historically retained but behaviourally inactive.
    {
      // The place-attributable contribution, measured the SAME contact-controlled way in all
      // three phases, so the release is proven on the isolated place term rather than on a raw
      // risk number that also moves with contact relief.
      const placeRise = (world, otherAt) => {
        const xr = readAccess(park(world, { [OBS]: X, [OTHER]: otherAt }), OBS);
        const yr = readAccess(park(world, { [OBS]: Y, [OTHER]: otherAt }), OBS);
        return {
          atX: xr.currentWaterRefugeSocialAccessRisk,
          atY: yr.currentWaterRefugeSocialAccessRisk,
          placeAttributable: r4((xr.currentWaterRefugeSocialAccessRisk ?? 0) - (yr.currentWaterRefugeSocialAccessRisk ?? 0)),
          knownContactCount: xr.knownContactCount,
          contactControlled: xr.knownContactCount === yr.knownContactCount,
        };
      };

      const before = readAccess(contactedWorld, OBS);
      const released = hold(contactedWorld, { [OBS]: X, [OTHER]: FAR }, RELEASE_SEASONS);
      const after = readAccess(released, OBS);
      const neutralWorld = park(baseTwo(), { [OBS]: X, [OTHER]: FAR });
      const risePhases = {
        neverContacted: placeRise(neutralWorld, FAR),
        atContact: placeRise(contactedWorld, adjacent),
        afterRelease: placeRise(released, FAR),
      };
      // The rise figures are differences of two `round2`ed risks, so each carries up to 0.01 of
      // rounding and a difference-of-differences carries up to 0.02. Rather than lean on that
      // budget, release is ALSO asserted on the UNROUNDED inputs `getSocialAccessRisk` actually
      // reads — `strangerCaution` and `rememberedRefusalAvoidance` — which must return to their
      // never-contacted values exactly.
      const neutralMem = readAccess(neutralWorld, OBS).accessMemory;
      const releasedMem = after.accessMemory;
      // RELEASE MEANS NO RESIDUAL DANGER, NOT BITWISE EQUALITY. These inputs are reported to two
      // decimals, so demanding exact equality would assert on the last rounding unit. The
      // physically meaningful claim is DIRECTIONAL: after release, no caution input may sit ABOVE
      // its never-contacted value by more than one unit of the reported precision. A value BELOW
      // baseline is release, not persistence, and is reported rather than hidden.
      const ROUND2_UNIT = 0.01;
      const cautionResiduals = {
        strangerCaution: r4((releasedMem?.strangerCaution ?? 0) - (neutralMem?.strangerCaution ?? 0)),
        rememberedRefusalAvoidance: r4(
          (releasedMem?.rememberedRefusalAvoidance ?? 0) - (neutralMem?.rememberedRefusalAvoidance ?? 0),
        ),
      };
      const inputsReturned =
        neutralMem !== null &&
        releasedMem !== null &&
        cautionResiduals.strangerCaution <= ROUND2_UNIT + 1e-9 &&
        cautionResiduals.rememberedRefusalAvoidance <= ROUND2_UNIT + 1e-9;
      const riseRoundingBudget = 0.02;
      const recordsRetained = after.evidence.frictionRecords > 0 || (after.accessMemory?.historicalEvidenceCount ?? 0) > 0;
      const activeReleased =
        (after.accessMemory?.activeEvidenceWeight ?? 0) === 0 ||
        (after.accessMemory?.activeEvidenceCount ?? 0) === 0 ||
        (after.accessMemory?.strangerCaution ?? 0) === 0;
      const returnedToBaseline =
        (after.currentWaterRefugeSocialAccessRisk ?? 0) <= (before.currentWaterRefugeSocialAccessRisk ?? 0) + 0.0005;
      fixtures.push({
        id: "S3_lifecycle_release",
        intent:
          "after the other band departs and the CORRECTION-31 lifecycle cools the evidence, the " +
          "records must REMAIN while the current social-access contribution returns to baseline.",
        syntheticState: true,
        syntheticNote: `the other band moved far away and ${RELEASE_SEASONS} real production seasons run`,
        atContact: before,
        afterRelease: after,
        // the isolated place term across all three phases, contact-controlled
        placeAttributableRiseByPhase: risePhases,
        riseRoundingBudget,
        accessMemoryInputs: {
          neverContacted: neutralMem === null ? null : {
            strangerCaution: neutralMem.strangerCaution,
            rememberedRefusalAvoidance: neutralMem.rememberedRefusalAvoidance,
            activeEvidenceWeight: neutralMem.activeEvidenceWeight,
          },
          atContact: {
            strangerCaution: before.accessMemory?.strangerCaution ?? null,
            rememberedRefusalAvoidance: before.accessMemory?.rememberedRefusalAvoidance ?? null,
            activeEvidenceWeight: before.accessMemory?.activeEvidenceWeight ?? null,
          },
          afterRelease: releasedMem === null ? null : {
            strangerCaution: releasedMem.strangerCaution,
            rememberedRefusalAvoidance: releasedMem.rememberedRefusalAvoidance,
            activeEvidenceWeight: releasedMem.activeEvidenceWeight,
          },
        },
        cautionResidualsVsNeverContacted: cautionResiduals,
        noResidualCautionAboveNeverContactedBaseline: inputsReturned,
        placeContributionReturnedToNeverContactedLevel:
          Math.abs(risePhases.afterRelease.placeAttributable - risePhases.neverContacted.placeAttributable) <=
          riseRoundingBudget,
        retainedButInert: {
          contactMemories: after.evidence.contactMemories,
          encounterRecords: after.evidence.encounterRecords,
          historicalEvidenceCount: after.accessMemory?.historicalEvidenceCount ?? null,
          socialEvidencePhase: after.accessMemory?.socialEvidencePhase ?? null,
          activeEvidenceWeight: after.accessMemory?.activeEvidenceWeight ?? null,
        },
        historicalRecordsRetained: recordsRetained,
        activeEvidenceReleased: activeReleased,
        currentContributionReturnedToBaseline: returnedToBaseline,
        verdict:
          !recordsRetained && !activeReleased
            ? "VACUOUS_NO_EVIDENCE_TO_RELEASE"
            : activeReleased &&
                returnedToBaseline &&
                inputsReturned &&
                Math.abs(risePhases.afterRelease.placeAttributable - risePhases.neverContacted.placeAttributable) <=
                  riseRoundingBudget
              ? "RELEASED_HISTORY_RETAINED"
              : "STILL_ACTIVE_AFTER_RELEASE_WINDOW",
      });
    }

    // ---------------------------------------------------------------------------------- S4
    // Place specificity: active evidence about X must not raise caution at an unrelated tile Y.
    {
      const atX = readAccess(contactedWorld, OBS);
      const movedToY = park(contactedWorld, { [OBS]: Y, [OTHER]: FAR });
      const atY = readAccess(movedToY, OBS);
      const delta = r4((atY.currentWaterRefugeSocialAccessRisk ?? 0) - (atX.currentWaterRefugeSocialAccessRisk ?? 0));
      fixtures.push({
        id: "S4_place_specificity",
        intent: "active access evidence at tile X must not increase social-access risk at unrelated tile Y",
        syntheticState: true,
        syntheticNote: "the same world as S2, with the observer parked at Y instead of X",
        atEvidenceTileX: atX,
        atUnrelatedTileY: atY,
        deltaYMinusX: delta,
        bandCountIdentical: atX.worldBandCount === atY.worldBandCount,
        verdict:
          atY.currentWaterRefugeSocialAccessRisk === null
            ? "VACUOUS_NO_DRY_MARGIN_CONSUMER_AT_Y"
            : (atY.accessMemory?.strangerCaution ?? 0) === 0 && delta <= 0.0005
              ? "EVIDENCE_IS_PLACE_SPECIFIC"
              : "EVIDENCE_LEAKS_TO_UNRELATED_PLACE",
      });
    }

    // ---------------------------------------------------------------------------------- S5
    // Second-hand evidence. Report-linked friction records are produced by `reportedKnowledge`
    // when a band RECEIVES a warning. This fixture measures whether such a record exists in the
    // contacted world and, if so, that it is marked second-hand. If none can be produced through
    // production authorities in this geometry, that is reported as NOT CONSTRUCTED — not a pass.
    {
      const read = readAccess(contactedWorld, OBS);
      const otherRead = readAccess(contactedWorld, OTHER);
      const secondHand = read.evidence.reportLinkedFrictionRecords + otherRead.evidence.reportLinkedFrictionRecords;
      fixtures.push({
        id: "S5_second_hand_evidence",
        intent:
          "a legitimate ACTIVE second-hand warning may affect caution where supported, must stay " +
          "marked second-hand, and must release on its own (shorter) lifecycle",
        observer: { reportLinkedFrictionRecords: read.evidence.reportLinkedFrictionRecords },
        otherBand: { reportLinkedFrictionRecords: otherRead.evidence.reportLinkedFrictionRecords },
        verdict:
          secondHand === 0
            ? "NOT_CONSTRUCTED_NO_REPORT_LINKED_RECORD_IN_THIS_GEOMETRY"
            : "SECOND_HAND_RECORD_PRESENT_AND_MARKED",
        note:
          secondHand === 0
            ? "Two bands in isolated proximity produce DIRECT observation, not hearsay: a report " +
              "requires a third band to relay it. CORRECTION-31 already proves the report lifecycle " +
              "(report-only belief DOES_NOT_FADE -> FADES) in its own frozen evidence directory, and " +
              "no claim about second-hand access evidence is made from THIS pass."
            : null,
      });
    }

    // ---------------------------------------------------------------------------------- S6
    // Old contact memory, no active place evidence about X. The observer keeps its contact
    // memory (a real, retained social fact) but the access evidence about X has been released.
    {
      const released = hold(contactedWorld, { [OBS]: X, [OTHER]: FAR }, RELEASE_SEASONS);
      const read = readAccess(released, OBS);
      const neutral = readAccess(park(baseTwo(), { [OBS]: X, [OTHER]: FAR }), OBS);
      const delta = r4((read.currentWaterRefugeSocialAccessRisk ?? 0) - (neutral.currentWaterRefugeSocialAccessRisk ?? 0));
      fixtures.push({
        id: "S6_old_contact_without_place_evidence",
        intent:
          "a known contact memory with NO active evidence about tile X must not create tile-X " +
          "social-access danger. (Contacts may legitimately REDUCE risk through knownContactRelief; " +
          "what is forbidden is manufacturing danger.)",
        withRetainedContact: read,
        neutralNeverContacted: neutral,
        deltaVsNeutral: delta,
        contactMemoriesRetained: read.evidence.contactMemories,
        placeSpecificCaution: read.accessMemory?.strangerCaution ?? null,
        verdict:
          read.evidence.contactMemories === 0
            ? "VACUOUS_NO_CONTACT_MEMORY_RETAINED"
            : delta <= 0.0005
              ? "OLD_CONTACT_CREATES_NO_PLACE_DANGER"
              : "OLD_CONTACT_CREATES_PLACE_DANGER",
      });
    }

    // ---------------------------------------------------------------------------------- S7
    // World-band-count control: identical total band count in both arms, only the legitimate
    // access evidence differs. Proves the measured delta is not `unrelatedRisk`.
    {
      const neutral = readAccess(park(baseTwo(), { [OBS]: X, [OTHER]: FAR }), OBS);
      const evidenced = readAccess(contactedWorld, OBS);
      const delta = r4(
        (evidenced.currentWaterRefugeSocialAccessRisk ?? 0) - (neutral.currentWaterRefugeSocialAccessRisk ?? 0),
      );
      fixtures.push({
        id: "S7_unrelated_world_count_control",
        intent:
          "repeat the comparison with the SAME total band count and only the legitimate access " +
          "evidence changed, proving the delta is not `unrelatedRisk`'s world-truth band count",
        neutralArm: {
          worldBandCount: neutral.worldBandCount,
          knownContactCount: neutral.knownContactCount,
          unrelatedRiskWouldFire: neutral.unrelatedRiskWouldFire,
          socialAccessRisk: neutral.currentWaterRefugeSocialAccessRisk,
        },
        evidencedArm: {
          worldBandCount: evidenced.worldBandCount,
          knownContactCount: evidenced.knownContactCount,
          unrelatedRiskWouldFire: evidenced.unrelatedRiskWouldFire,
          socialAccessRisk: evidenced.currentWaterRefugeSocialAccessRisk,
        },
        delta,
        bandCountIdentical: neutral.worldBandCount === evidenced.worldBandCount,
        unrelatedRiskIdentical: neutral.unrelatedRiskWouldFire === evidenced.unrelatedRiskWouldFire,
        verdict:
          neutral.worldBandCount !== evidenced.worldBandCount
            ? "INVALID_BAND_COUNT_DIFFERS"
            : neutral.unrelatedRiskWouldFire === evidenced.unrelatedRiskWouldFire
              ? "DELTA_IS_NOT_UNRELATED_RISK"
              : "UNRELATED_RISK_CONFOUNDS",
        knownDefectNotRepairedHere:
          "`unrelatedRisk` reads `Object.values(world.bands).length`, a world-truth count a band " +
          "cannot know. Out of scope for CORRECTION-32 and CORRECTION-32A; held constant, not fixed.",
      });
    }
  }

  const vacuous = fixtures.filter((f) => String(f.verdict).startsWith("VACUOUS"));
  const notConstructed = fixtures.filter((f) => String(f.verdict).startsWith("NOT_CONSTRUCTED"));
  const bad = fixtures.filter((f) =>
    [
      "PROXIMITY_ALONE_RAISES_ACCESS_CAUTION",
      "ACTIVE_ACCESS_EVIDENCE_HAS_NO_EFFECT",
      "STILL_ACTIVE_AFTER_RELEASE_WINDOW",
      "EVIDENCE_LEAKS_TO_UNRELATED_PLACE",
      "OLD_CONTACT_CREATES_PLACE_DANGER",
      "UNRELATED_RISK_CONFOUNDS",
      "INVALID_BAND_COUNT_DIFFERS",
      "INVALID_CONTACT_COUNT_NOT_CONTROLLED",
    ].includes(f.verdict),
  );

  const payload = {
    audit: "socialAccessLifecycleAudit",
    checkpoint: "CORRECTION-32A",
    arm: ARM,
    seed: SEED,
    warmSeasons: WARM,
    contactSeasons: CONTACT_SEASONS,
    releaseSeasons: RELEASE_SEASONS,
    generatedAt: new Date().toISOString(),
    measuredThrough: [
      "dryMargin.deriveDryMarginMobilityContext(...).currentWaterRefuge.socialAccessRisk (real consumer)",
      "evaluateBandDecision(...).alternativesConsidered[].scoreBreakdown.socialAccessRisk (scored at -0.36)",
    ],
    privateFormulaNotCopied: true,
    geometry: { origin, tiles, farTiles },
    summary: {
      fixtures: fixtures.length,
      vacuous: vacuous.length,
      vacuousIds: vacuous.map((f) => f.id),
      notConstructed: notConstructed.map((f) => f.id),
      adverse: bad.map((f) => f.id),
      verdicts: Object.fromEntries(fixtures.map((f) => [f.id, f.verdict])),
    },
    fixtures,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify(payload.summary, null, 2));
  console.log(`\nwrote ${OUT}`);
} finally {
  await server.close();
}
