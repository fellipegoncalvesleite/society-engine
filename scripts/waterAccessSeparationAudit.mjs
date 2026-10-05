// CORRECTION-23C §4/§9/§10 — WATER-FIELD AUTHORITY LEDGER AND W1-W10.
//
// §4 first: enumerate every authoritative water field, its writer, its physical and epistemic
// meaning, and whether it drives FEASIBILITY, RANKING, or both. That inventory is what proved
// CORRECTION-23B's defect — `waterReliability` drove both, so a physical-access answer
// silently became a preference.
//
// Then W1-W10, each at an authoritative production seam. The central test is W1/W2/W4
// together: one evidence row must flip the access verdict, must NOT move the ranking term,
// and removing it must restore the exact prior decision.
//
// Usage: node scripts/waterAccessSeparationAudit.mjs
import { createServer } from "vite";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";

const server = await createServer({
  root: `${process.cwd()}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

const r3 = (v) => (v === undefined || v === null ? undefined : Math.round(v * 1000) / 1000);

// ── §4 — the authority ledger, read from the code that defines it. ────────────────
const LEDGER = [
  {
    field: "tile.resourceProfile.waterAccess",
    writer: "world generation (hydrography)",
    physicalMeaning: "how reachable water is at this tile",
    epistemicMeaning: "HIDDEN TRUTH — never read by a decision",
    range: "0..1",
    readers: "tileObservation (coarsened), on-site verification (party is standing there)",
    oneVisitMayChange: false,
    drives: "neither — it is truth, not knowledge",
  },
  {
    field: "KnownTileRecord.observedWaterAccess",
    writer: "tileObservation.observeTile",
    physicalMeaning: "the band's impression of water at a place",
    epistemicMeaning: "coarsened to quarter buckets and capped at 0.5 for a shallow traversal; exact for residential observation",
    range: "0..1, optional (undefined = never observed)",
    readers: "carryingCapacity, habitatYield, mobilityIntent, bandDecision, campMovement, dryMargin, pressure, memory, crowding, residentialAnchor, seasonalRound, contextCache, socialContext, foragingAdaptation, demography, migrationWalk, memoryCompression, ecologicalProjection",
    oneVisitMayChange: true,
    drives: "RANKING in most readers; the destination FEASIBILITY gate reads it only as a fallback",
  },
  {
    field: "KnownTileRecord.observedAquaticPotential",
    writer: "tileObservation.observeTile",
    physicalMeaning: "visible open water as a food context",
    epistemicMeaning: "0 unless the tile is visibly aquatic/river; coarsened and capped for a traversal",
    range: "0..1",
    readers: "foragingAdaptation, memoryCompression, habitatYield",
    oneVisitMayChange: true,
    drives: "RANKING",
  },
  {
    field: "KnownTileRecord.confidence",
    writer: "tileObservation.observeTile",
    physicalMeaning: "n/a",
    epistemicMeaning: "general strength of the record; rises with repeat visits, capped at 0.72 for shallow",
    range: "0..1",
    readers: "carryingCapacity (rejection reason), campMovement, many scorers",
    oneVisitMayChange: true,
    drives: "RANKING and a low-confidence rejection reason",
  },
  {
    field: "KnownTileRecord.seasonsObserved",
    writer: "tileObservation.observeTile",
    physicalMeaning: "seasons the place was physically experienced in",
    epistemicMeaning: "coverage, never a calendar",
    range: "list of seasons",
    readers: "frontierVerification (seasonal_persistence), placeEvidenceProjection",
    oneVisitMayChange: true,
    drives: "neither",
  },
  {
    field: "KnownTileRecord.observedSeasonalPattern.reliability",
    writer: "tileObservation.observeTile (residential/scout only; NEVER a shallow traversal)",
    physicalMeaning: "how dependable the place is across seasons",
    epistemicMeaning: "left UNDEFINED by a traversal so readers use a neutral default",
    range: "0..1, optional",
    readers: "habitatYield",
    oneVisitMayChange: false,
    drives: "RANKING",
  },
  {
    field: "KnownUnusedHabitatOpportunity.waterReliability",
    writer: "carryingCapacity.deriveKnownUnusedHabitat",
    physicalMeaning: "the band's observed water level at a candidate",
    epistemicMeaning: "AFTER 23C: exactly `observedWaterAccess`. BEFORE: floored at 0.55 by a confirmed access",
    range: "0..1",
    readers: "score term (x0.24), side-country margin relaxation (>0.36), suspicious-ignored diagnostic (>0.4), UI",
    oneVisitMayChange: false,
    drives: "RANKING ONLY (23C removed its feasibility role)",
  },
  {
    field: "KnownUnusedHabitatOpportunity.waterAccessFeasible",
    writer: "carryingCapacity.deriveKnownUnusedHabitat via verificationEvidence.isWaterAccessFeasible",
    physicalMeaning: "is reaching water here physically possible",
    epistemicMeaning: "direct physical answer if one exists, else the observation against the 0.32 threshold",
    range: "boolean",
    readers: "consideredAsTarget gate, rejectionReason, audit ledger wouldPassViability",
    oneVisitMayChange: true,
    drives: "FEASIBILITY ONLY — a boolean has no magnitude to leak into a score",
  },
  {
    field: "VerificationEvidenceRecord (question = water_access)",
    writer: "expedition return seam via verificationEvidence.recordVerificationEvidence",
    physicalMeaning: "a party stood at the place and did or did not reach water",
    epistemicMeaning: "season-scoped, route-scoped, acquisition-tagged; proves neither reliability nor other seasons",
    range: "confirmed | negative | inconclusive",
    readers: "isWaterAccessFeasible, deriveDirectWaterAccess, the read model, the retry gate",
    oneVisitMayChange: true,
    drives: "FEASIBILITY ONLY",
  },
  {
    field: "seasonalRound REFUGE_VIABLE_MIN_WATER gate",
    writer: "n/a (reader)",
    physicalMeaning: "whether a refuge has enough water",
    epistemicMeaning: "reads `provenReliable` OR observedWaterAccess",
    range: "boolean",
    readers: "seasonalRound",
    oneVisitMayChange: true,
    drives: "FEASIBILITY — untouched by this pass; it already had its own proven-reliability path",
  },
];

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const evidenceMod = await server.ssrLoadModule("/sim/agents/verificationEvidence.ts");
  const capacity = await server.ssrLoadModule("/sim/agents/carryingCapacity.ts");
  const projection = await server.ssrLoadModule("/sim/agents/placeEvidenceProjection.ts");

  const world = runner.initSimWorld({ kind: "map2" }, "c23c:water");
  const templateBand = Object.values(world.bands)[0];
  const home = world.tiles["tile:98:4"];
  const dist = (a, b) => Math.abs(a.coord.x - b.coord.x) + Math.abs(a.coord.y - b.coord.y);

  const cases = [];
  const record = (id, title, expectation, observed, pass, detail = {}) =>
    cases.push({ id, title, expectation, observed, pass, ...detail });

  const mkRecord = (tile, fields) => {
    const rec = {
      tileId: tile.id,
      firstObservedAt: world.time,
      lastObservedAt: world.time,
      seasonsObserved: [world.time.season],
      visits: 1,
      observedMovementCost: tile.movementCost,
      observedRisk: 0.3,
      observedAquaticPotential: 0,
      confidence: 0.5,
      knowledgeSource: "personally_observed",
      acquisition: "returned_frontier_exploration",
      ...fields,
    };
    for (const k of Object.keys(rec)) if (rec[k] === undefined) delete rec[k];
    return rec;
  };

  const mkEvidence = (tile, outcome, extra = {}) => ({
    tileId: tile.id,
    question: "water_access",
    outcome,
    seasonsAnswered: [world.time.season],
    lastSeason: world.time.season,
    lastTick: world.time.tick,
    attempts: 1,
    hardshipAtLastAttempt: 0.5,
    routeTilesAtLastAttempt: 8,
    routeEvidence: "walked_out_and_back",
    acquisition: "returned_frontier_exploration",
    ...(outcome === "negative" ? { accessFailureKind: "absent_in_bounded_search" } : {}),
    ...extra,
  });

  const mkBand = (records, evidence) => ({
    ...templateBand,
    position: home.id,
    knowledge: {
      ...templateBand.knowledge,
      observedTiles: Object.fromEntries(records.map((r) => [r.tileId, r])),
    },
    ...(evidence === undefined ? {} : { verificationEvidence: evidence }),
  });

  // A candidate whose OBSERVED water sits below the 0.32 physical-access threshold.
  const target = Object.values(world.tiles)
    .filter((t) => t.isAquatic !== true && t.movementCost < 3 && t.resourceProfile.baseRichness > 0.3)
    .filter((t) => dist(t, home) >= 4 && dist(t, home) <= 8)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];
  const homeRec = mkRecord(home, {
    observedWaterAccess: home.resourceProfile.waterAccess,
    observedRichness: home.resourceProfile.baseRichness,
    acquisition: "residential_observation",
    confidence: 1,
    visits: 20,
  });
  const rec = mkRecord(target, { observedWaterAccess: 0.25, observedRichness: 0.6 });

  // ── The production destination evaluation, through the real seasonal tick. ──────
  const stepAndRead = (evidence) => {
    const band = {
      ...mkBand([homeRec, rec], evidence),
      ...(templateBand.pressureState === undefined
        ? {}
        : { pressureState: { ...templateBand.pressureState, foodStress: 0.9, waterStress: 0.4 } }),
    };
    let current = { ...world, bands: { [band.id]: band } };
    current = runner.stepSim(current, 1, "seasonal");
    const after = current.bands[band.id];
    const o = after?.carryingCapacity?.knownUnusedHabitat;
    return {
      candidateTileId: o?.candidateTileId === undefined ? null : String(o.candidateTileId),
      consideredAsTarget: o?.consideredAsTarget ?? null,
      rejectionReason: o?.rejectionReason ?? null,
      waterReliability: r3(o?.waterReliability),
      waterAccessFeasible: o?.waterAccessFeasible ?? null,
      directWaterAccessState: o?.directWaterAccessState ?? null,
      directWaterAccessSeason: o?.directWaterAccessSeason ?? null,
    };
  };

  const noEvidence = stepAndRead(undefined);
  const confirmed = stepAndRead([mkEvidence(target, "confirmed")]);
  const negative = stepAndRead([mkEvidence(target, "negative")]);
  const inconclusive = stepAndRead([mkEvidence(target, "inconclusive")]);

  // ── W1 — confirmed access removes the access blocker. ───────────────────────────
  record(
    "W1",
    "confirmed access removes the access blocker",
    "without evidence the gate rejects on water; with evidence the physical-access gate passes",
    {
      withoutEvidence: { feasible: noEvidence.waterAccessFeasible, rejection: noEvidence.rejectionReason },
      withConfirmed: { feasible: confirmed.waterAccessFeasible, rejection: confirmed.rejectionReason },
    },
    noEvidence.waterAccessFeasible === false &&
      noEvidence.rejectionReason === "insufficient_water_reliability" &&
      confirmed.waterAccessFeasible === true &&
      confirmed.rejectionReason !== "insufficient_water_reliability",
    { target: target.id },
  );

  // ── W2 — the ranking term does NOT move. THE CENTRAL TEST. ─────────────────────
  record(
    "W2",
    "the ranking term remains unchanged",
    "waterReliability is identical with and without the access answer",
    {
      withoutEvidence: noEvidence.waterReliability,
      withConfirmed: confirmed.waterReliability,
      withNegative: negative.waterReliability,
      identical:
        noEvidence.waterReliability === confirmed.waterReliability &&
        noEvidence.waterReliability === negative.waterReliability,
      previousBehaviour: "CORRECTION-23B floored this at 0.55 on a confirmed access",
    },
    noEvidence.waterReliability === confirmed.waterReliability &&
      noEvidence.waterReliability === negative.waterReliability,
  );

  // ── W3 — a low-reliability place stays low. ─────────────────────────────────────
  record(
    "W3",
    "confirmed access does not floor reliability",
    "the reported reliability equals the band's observation, not a floor",
    {
      observedWaterAccess: 0.25,
      reportedReliabilityWithConfirmedAccess: confirmed.waterReliability,
      flooredAt055: confirmed.waterReliability === 0.55,
    },
    confirmed.waterReliability === 0.25,
  );

  // ── W4 — evidence destroyed restores the exact prior decision. ─────────────────
  const restored = stepAndRead(undefined);
  record(
    "W4",
    "evidence destroyed restores the exact prior feasibility decision",
    "removing the row reproduces the no-evidence verdict field for field",
    { first: noEvidence, restored, identical: JSON.stringify(noEvidence) === JSON.stringify(restored) },
    JSON.stringify(noEvidence) === JSON.stringify(restored),
  );

  // ── W5 — a negative is scoped to the area searched. ─────────────────────────────
  {
    const other = Object.values(world.tiles)
      .filter((t) => t.isAquatic !== true && t.movementCost < 3)
      .filter((t) => dist(t, home) >= 4 && dist(t, home) <= 8 && t.id !== target.id)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];
    const otherRec = mkRecord(other, { observedWaterAccess: 0.5, observedRichness: 0.5 });
    const band = mkBand([homeRec, rec, otherRec], [mkEvidence(target, "negative")]);
    const direct = evidenceMod.deriveDirectWaterAccess(band, target.id);

    record(
      "W5",
      "a negative blocks the searched place only",
      "the failure keeps its physical scope and no other place is claimed dry",
      {
        failureKind: direct.failureKind,
        thisPlaceFeasible: evidenceMod.isWaterAccessFeasible(band, target.id, 0.25, 0.32),
        otherPlaceFeasible: evidenceMod.isWaterAccessFeasible(band, other.id, 0.5, 0.32),
        otherPlaceObservedUnchanged: otherRec.observedWaterAccess === 0.5,
      },
      direct.failureKind === "absent_in_bounded_search" &&
        evidenceMod.isWaterAccessFeasible(band, target.id, 0.25, 0.32) === false &&
        evidenceMod.isWaterAccessFeasible(band, other.id, 0.5, 0.32) === true,
      { note: "a party that never reaches its target writes NO row at all — a route failure cannot become a destination claim." },
    );
  }

  // ── W6 — inconclusive is neutral in both directions. ───────────────────────────
  record(
    "W6",
    "an inconclusive result is neutral",
    "no feasibility confirmation, no permanent failure, no reliability change, no ranking change",
    {
      feasible: inconclusive.waterAccessFeasible,
      sameAsNoEvidence: inconclusive.waterAccessFeasible === noEvidence.waterAccessFeasible,
      reliability: inconclusive.waterReliability,
      reliabilityUnchanged: inconclusive.waterReliability === noEvidence.waterReliability,
      rejection: inconclusive.rejectionReason,
    },
    inconclusive.waterAccessFeasible === noEvidence.waterAccessFeasible &&
      inconclusive.waterReliability === noEvidence.waterReliability,
  );

  // ── W7 / W8 — seasonality. ─────────────────────────────────────────────────────
  {
    let evidence = [mkEvidence(target, "confirmed")];
    const oneSeason = evidenceMod.deriveDirectWaterAccess(mkBand([rec], evidence), target.id);

    for (let i = 0; i < 3; i += 1) {
      evidence = evidenceMod.recordVerificationEvidence(evidence, {
        tileId: target.id,
        question: "water_access",
        outcome: "confirmed",
        season: world.time.season,
        tick: world.time.tick,
        hardship: 0.5,
        routeTiles: 8,
        routeEvidence: "walked_out_and_back",
      });
    }
    const repeated = evidenceMod.deriveDirectWaterAccess(mkBand([rec], evidence), target.id);

    record(
      "W7",
      "one-season confirmation does not establish annual reliability",
      "the evidence asserts its own season and refuses reliability by construction",
      {
        season: String(oneSeason.season),
        seasonsObserved: oneSeason.seasonsObserved.map(String),
        provesReliability: oneSeason.provesReliability,
        provesOtherSeasons: oneSeason.provesOtherSeasons,
        rankingTermWithConfirmedAccess: confirmed.waterReliability,
      },
      oneSeason.provesReliability === false &&
        oneSeason.provesOtherSeasons === false &&
        oneSeason.seasonsObserved.length === 1 &&
        confirmed.waterReliability === 0.25,
    );

    record(
      "W8",
      "repeated same-season confirmation still proves no other season",
      "four confirmations in one season give one season of coverage and four attempts",
      {
        attempts: repeated.attempts,
        seasonsObserved: repeated.seasonsObserved.map(String),
        provesOtherSeasons: repeated.provesOtherSeasons,
      },
      repeated.attempts === 4 &&
        repeated.seasonsObserved.length === 1 &&
        repeated.provesOtherSeasons === false,
    );
  }

  // ── W9 — water access does not upgrade ecology. ────────────────────────────────
  {
    const bandWith = mkBand([homeRec, rec], [mkEvidence(target, "confirmed")]);
    const bandWithout = mkBand([homeRec, rec]);
    const fieldsOf = (b) => {
      const r = b.knowledge.observedTiles[target.id];
      return {
        observedRichness: r3(r.observedRichness),
        observedAquaticPotential: r3(r.observedAquaticPotential),
        observedStorageSuitability: r3(r.observedStorageSuitability),
        observedSeasonalPattern: r.observedSeasonalPattern === undefined ? "undefined" : "DEFINED",
        acquisition: r.acquisition,
        visits: r.visits,
        confidence: r3(r.confidence),
      };
    };
    record(
      "W9",
      "water access changes no ecology, resource or residential field",
      "every other field of the record is byte-identical with and without the answer",
      { with: fieldsOf(bandWith), without: fieldsOf(bandWithout) },
      JSON.stringify(fieldsOf(bandWith)) === JSON.stringify(fieldsOf(bandWithout)) &&
        evidenceMod.resourceTestEligible(bandWith, target.id) === false,
    );
  }

  // ── W10 — the UI states presence, access and reliability separately. ───────────
  {
    const band = mkBand([homeRec, rec], [mkEvidence(target, "confirmed")]);
    const proj = projection.derivePlaceEvidenceProjection(world, band);
    const row = proj.verification.water.find((w) => String(w.tileId) === String(target.id));
    const text = JSON.stringify(proj.verification.water);

    record(
      "W10",
      "UI truth safety",
      "presence, physical access, reliability and unobserved seasons are separate statements; no reliability number is shown",
      {
        row,
        showsNoReliabilityNumber: !/reliability["\s:]*0?\.\d/i.test(text),
        noHiddenTruthRead: proj.verification.noHiddenTruthRead,
      },
      row !== undefined &&
        row.presence === "observed" &&
        row.physicalAccess.startsWith("confirmed in ") &&
        row.reliability.startsWith("uncertain") &&
        row.otherSeasons.startsWith("unobserved:") &&
        row.destinationEffect.includes("ranking unchanged") &&
        !/reliability["\s:]*0?\.\d/i.test(text),
    );
  }

  const passed = cases.filter((c) => c.pass === true).length;
  const failed = cases.filter((c) => c.pass === false);

  console.log("\n=== §4 WATER-FIELD AUTHORITY LEDGER ===\n");
  for (const row of LEDGER) {
    console.log(`${row.field}`);
    console.log(`    writer      : ${row.writer}`);
    console.log(`    physical    : ${row.physicalMeaning}`);
    console.log(`    epistemic   : ${row.epistemicMeaning}`);
    console.log(`    range       : ${row.range}`);
    console.log(`    one visit?  : ${row.oneVisitMayChange}`);
    console.log(`    drives      : ${row.drives}`);
  }

  console.log(`\n=== W1-W10: ${passed} pass / ${failed.length} fail ===\n`);
  for (const c of cases) {
    console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.id}  ${c.title}`);
    console.log(`      expect: ${c.expectation}`);
    console.log(`      got   : ${JSON.stringify(c.observed)}`);
    if (c.note !== undefined) console.log(`      note  : ${c.note}`);
  }

  mkdirSync("docs/evidence/correction23c", { recursive: true });
  writeFileSync(
    "docs/evidence/correction23c/water-separation.json",
    JSON.stringify({ ledger: LEDGER, passed, failed: failed.length, cases }, null, 2),
  );
  console.log("\nwrote docs/evidence/correction23c/water-separation.json");
} finally {
  await server.close();
}
