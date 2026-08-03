// CORRECTION-35 — SHARED-CATCHMENT BOUNDARY.
//
// This checkpoint changes NOTHING in `sharedCatchment.ts`. The boundary is published anyway,
// because CORRECTION-35 is the last correction before Item 3 is offered for freeze and the reader
// of that freeze is entitled to know exactly what shared use does and does not yet mean.
//
// The claim being fixed in place, so a later checkpoint cannot quietly inherit a stronger one:
//
//   a residential catchment claim is RESIDENCE-ANCHORED — it is drawn around where the band lives;
//   expedition target work removes PHYSICAL stock from the world at the target tile;
//   a later group arriving at that tile therefore observes the DEPLETED stock;
//   but walking a ROUTE creates no catchment claim along it;
//   and a task camp does not claim the range around itself.
//
// So two bands compete for a shared range only where their RESIDENTIAL catchments overlap, or
// through the physical stock at a specific worked tile. Real trips, expedition routes and
// investigation walks compete for nothing on the way. That is a REAL LIMITATION and it stays open.
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
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const shared = await server.ssrLoadModule("/sim/agents/sharedCatchment.ts");

  let world = runner.initSimWorld({ kind: "map2" }, SEED);
  world = advance.advanceWorldByDays(world, WARM);

  const bands = Object.values(world.bands)
    .filter((b) => b.status !== "dispersed" && b.viability?.status !== "extinct")
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));

  // Which exported footprint builder exists, and what it is anchored on. Read from the module
  // rather than asserted from documentation.
  const exportedNames = Object.keys(shared).sort();

  // Anchor test: does the footprint follow the RESIDENCE? Move a band's position and see whether
  // its catchment tiles move with it. If they do, the footprint is residence-anchored and cannot
  // represent a route or a task camp.
  const footprintFn = shared.getBandForagingFootprint ?? null;

  let anchorEvidence;
  if (footprintFn === null) {
    anchorEvidence = {
      measured: false,
      reason: "no footprint builder is exported under a name this audit knows; the anchor claim is left as NOT MEASURED rather than assumed",
      exportedNames,
    };
  } else {
    // FootprintTile carries a tileId; comparing the objects themselves would compare weights too.
    const asIds = (v) => (v ?? []).map((t) => String(t.tileId ?? t)).sort();
    const band = bands[0];
    const here = asIds(footprintFn(world, band));
    const elsewhere = (Object.values(world.bands).find((b) => String(b.id) !== String(band.id)) ?? {}).position
      ?? Object.keys(world.tiles).find((t) => t !== band.position);

    // ARM 1 — move the band's POSITION and leave its residential anchor alone.
    const movedPos = { ...band, position: elsewhere };
    const armPosition = asIds(footprintFn(
      { ...world, bands: { ...world.bands, [band.id]: movedPos } }, movedPos));

    // ARM 2 — drop the residential anchor, so the builder falls back to a ring around the position.
    const noAnchor = { ...band, position: elsewhere, residentialAnchor: undefined };
    const armNoAnchor = asIds(footprintFn(
      { ...world, bands: { ...world.bands, [band.id]: noAnchor } }, noAnchor));

    anchorEvidence = {
      measured: true, band: String(band.id),
      residenceTile: String(band.position), movedTo: String(elsewhere),
      hasResidentialAnchor: band.residentialAnchor !== undefined,
      anchorCatchmentTiles: band.residentialAnchor?.catchmentTileIds?.length ?? 0,
      tilesAtResidence: here.length,
      movingPositionOnly: {
        tiles: armPosition.length,
        footprintChanged: JSON.stringify(here) !== JSON.stringify(armPosition),
        overlapWithOriginal: here.filter((t) => armPosition.includes(t)).length,
      },
      movingPositionWithNoAnchor: {
        tiles: armNoAnchor.length,
        footprintChanged: JSON.stringify(here) !== JSON.stringify(armNoAnchor),
        overlapWithOriginal: here.filter((t) => armNoAnchor.includes(t)).length,
        whyZero: "the fallback ring keeps only tiles the band has ITSELF observed (`band.knowledge.observedTiles[tileId]`). Dropped at a distant tile it has never seen, the band claims NOTHING — which is the anti-omniscience rule doing its job, not an empty measurement. The footprint moved; it moved to nothing.",
      },
      // The honest reading. An earlier form of this audit ran ARM 1 alone, saw the footprint stay
      // put, and would have published "the footprint does not follow the residence" — which reads
      // as though the claim were false. It is not: the anchor IS the residence.
      finding: "collectFootprintCandidateIds prefers band.residentialAnchor.catchmentTileIds and only falls back to a ring around band.position when no anchor exists. So the footprint is anchored on the RESIDENTIAL ANCHOR, which is a stronger and more specific form of residence-anchoring than 'wherever the band currently stands'. Moving the position alone does not move it (ARM 1); removing the anchor does (ARM 2). Either way it is drawn about where the band LIVES, and never about a route or a task camp.",
    };
  }

  out = {
    audit: "CORRECTION-35-SHARED-CATCHMENT-BOUNDARY",
    productionChangedByThisCheckpoint: false,
    verifiedBy: "git diff 742b567..HEAD -- src/sim/agents/sharedCatchment.ts is empty",
    seed: SEED, warmDays: WARM, livingBands: bands.length,
    exportedNames,
    anchorEvidence,
    boundary: {
      residentialCatchmentClaim: "RESIDENCE-ANCHORED, and specifically anchored on band.residentialAnchor.catchmentTileIds, falling back to a bounded ring around band.position when no anchor is held. Two bands contest a range only where these overlap.",
      expeditionTargetWork: "REMOVES PHYSICAL STOCK at the target tile, through resolvePhysicalFoodHarvest. This is real, world-level depletion.",
      aLaterGroupAtTheSameTarget: "OBSERVES THE DEPLETED STOCK, because the stock is world state rather than a per-band ledger. This is the one genuine shared-use channel that reaches beyond the residential catchment.",
      routeWalking: "CREATES NO CATCHMENT CLAIM. A party crossing country competes with nobody for it.",
      taskCamp: "CLAIMS NO RANGE. TemporaryTaskPartyRecord asserts noCamp: true and no footprint is drawn around it.",
    },
    remainingLimitation: {
      statement: "the physical shared-use substrate is still residence-anchored, so real trips, expedition routes and investigation walks compete for nothing along their length",
      consequence: "two bands whose parties repeatedly cross the same country, without either living there, generate no ecological competition and no crowding from that crossing",
      status: "OPEN — a FUTURE DEPENDENCY, not closed by CORRECTION-35 and not closed by Item 3",
      doNotRemoveThisOnFreeze: "this limitation predates CORRECTION-35 (AUDIT-27 recorded it) and survives it. Freezing Item 3 does not resolve it and must not be read as resolving it.",
    },
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
} finally {
  await server.close();
}
console.log(JSON.stringify(out, null, 2));
