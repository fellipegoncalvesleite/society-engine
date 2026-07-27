// EXPEDITIONARY-4 §11 — the canonical known-tile observation writer, extracted from the
// decision orchestrator so DOMAIN systems can apply physically-earned observation
// through the same single pipeline. Two producers exist:
//   - the residential decision path (movement/probe observation, unchanged semantics);
//   - a returned expedition party applying the tiles it PHYSICALLY walked (knowledge
//     latency: those observations become band knowledge only at return).
// Behaviour is byte-identical to the pre-extraction bandDecision implementation.
import type { BandId, TileId } from "../core/types";
import type {
  KnowledgeAcquisitionKind,
  KnownTileRecord,
  KnowledgeState,
  TileObservation,
} from "../knowledge/types";
import { getDepletionAdjustedRichness } from "../world/depletion";
import type { Tile, WorldState } from "../world/types";

export const RECENT_TILE_OBSERVATION_HISTORY_LIMIT = 180;

export interface ObservationTarget {
  readonly tile: Tile;
  readonly distance: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Band-perceived tile risk: a bounded blend of the tile's own risk profile. */
export function getObservedRisk(tile: Tile): number {
  return clamp01(
    tile.riskProfile.floodRisk * 0.34 +
      tile.riskProfile.droughtRisk * 0.34 +
      tile.riskProfile.diseaseRisk * 0.32,
  );
}

/**
 * Apply a bounded set of physical observation targets to a band's knowledge state.
 * Confidence falls with observation distance; a visited tile (distance 0) counts a
 * visit. This is band-perception, not hidden truth: everything recorded is what a
 * person standing there (or nearby) can see.
 */
/**
 * CORRECTION-23F §7/§8/§9 — AUDIT-ONLY observation policy.
 *
 * CORRECTION-23E proved that suppressing the walked-route observation of a verification
 * party collapses marginal survival, and that restoring one season term restores it. Neither
 * result says WHICH part of the observation matters. This type names the parts so they can
 * be measured one at a time.
 *
 * It is passed EXPLICITLY, only at the verification-return seam, so no other observation
 * producer is touched. Undefined everywhere else, including every normal world.
 */
export type ObservationPolicy = NonNullable<WorldState["auditOptions"]>["verificationObservationPolicy"];

export function observeTileAndNearby(
  world: WorldState,
  knowledge: KnowledgeState,
  targets: readonly ObservationTarget[],
  // CORRECTION-18 §8 — how these observations were acquired. Defaults to the historical
  // behaviour (a residential observation) so every existing caller is unchanged.
  acquisition: KnowledgeAcquisitionKind = "residential_observation",
  // CORRECTION-23F — audit-only; undefined for every production caller.
  observationPolicy?: ObservationPolicy,
): KnowledgeState {
  const observedTiles: Record<string, KnownTileRecord> = {
    ...knowledge.observedTiles,
  };
  const tileObservationHistory: TileObservation[] = [
    ...knowledge.tileObservationHistory.slice(-RECENT_TILE_OBSERVATION_HISTORY_LIMIT),
  ];
  const restore = deriveShallowRestore(world);

  for (const target of targets) {
    observeTile(
      world,
      observedTiles,
      tileObservationHistory,
      knowledge.selfBandId,
      target,
      acquisition,
      restore,
      observationPolicy,
    );
  }

  return {
    ...knowledge,
    observedTiles: observedTiles as Readonly<Record<TileId, KnownTileRecord>>,
    tileObservationHistory: tileObservationHistory.slice(-RECENT_TILE_OBSERVATION_HISTORY_LIMIT),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CORRECTION-21 §5/§14 — DOMAIN-SPECIFIC ADEQUACY FOR SHALLOW TRAVERSAL.
//
// THE DEFECT THIS REPAIRS. CORRECTION-17 wrote an explicit contract
// (docs/evidence/correction17/RESEARCH_CONSTRAINTS.md §2): walking through country teaches
// existence, distance, passability, broad terrain, visible water/relief and approximate
// risk — and does NOT teach stock sizes, edibility, processing, recovery rates, "or the
// seasonal calendar of a place seen once in one season". It then justified routing frontier
// returns through this unmodified writer on the grounds that doing so "creates no resource
// memory and no food receipt".
//
// That justification did not hold, and CORRECTION-21 measured the consequence at this exact
// seam: a single two-person crossing produced `observedRichness`, `observedWaterAccess`,
// `observedAquaticPotential`, `observedStorageSuitability` and the COMPLETE seasonal
// calendar (peakSeasons, leanSeasons, reliability) IDENTICAL to twenty residential
// observations, at identical confidence 1.0 — and reproducing hidden world truth exactly.
// Only `visits` and `acquisition` distinguished the two. See
// docs/evidence/correction21/epistemic-equivalence.json.
//
// THE REPAIR. A shallow traversal now writes what a walker can actually perceive, and
// leaves the rest for the observe/test/use paths that already model it:
//
//   terrain existence, passability, movement cost   unchanged — a walker establishes these
//   approximate risk                                unchanged — terrain hazard is visible
//   broad richness impression                       COARSENED to quarter buckets: a walker
//                                                   sees "lush" vs "sparse", not an exact
//                                                   productivity figure
//   water                                           VISIBLE PRESENCE only. Reliability
//                                                   requires use or repeated seasonal
//                                                   observation (§14), so the exact profile
//                                                   number is not copied
//   aquatic potential                               only where visibly aquatic
//   storage suitability                             NOT recorded — unobservable in passing
//   seasonal calendar                               NOT claimed. Only the season actually
//                                                   experienced is recorded, at low
//                                                   confidence; no peak/lean/reliability
//
// This is NOT a global confidence multiplier (§14/§23.11 forbid that). Each field is
// treated according to what its own domain of evidence supports, and every value remains
// UPGRADABLE: a later residential observation, resource scout or harvest overwrites the
// shallow record with full values, and repeated traversal raises traversal confidence.
// ─────────────────────────────────────────────────────────────────────────────

/** A traversal-quality acquisition: the party walked through, it did not live there. */
function isShallowTraversal(acquisition: KnowledgeAcquisitionKind): boolean {
  // CORRECTION-21 continuation §3 — this returned to including route reconnaissance after
  // the narrowing was classified CATEGORY C (introduced while chasing a single-seed habitat
  // ladder result that cannot attribute causality). The narrowing had no deterministic
  // seam-level proof, so it does not survive the cleanup.
  //
  // §5 KNOWN LIMITATION, recorded rather than hidden: classifying a whole acquisition FAMILY
  // as shallow is itself name-based, which §5 forbids ("its output must depend on what was
  // actually done"). Neither including nor excluding reconnaissance satisfies that. A
  // reconnaissance party aims at country the band already remembers, but the tiles it walks
  // THROUGH en route may be entirely new, and the record carries no dwell time to tell them
  // apart. Including it is the non-leaking choice, and the existing-record guard below means
  // a tile that already carries better evidence is never downgraded by a party walking past.
  // The evidence-based replacement (per-observation dwell//purpose rather than family name)
  // is unbuilt debt.
  return (
    acquisition === "returned_frontier_exploration" ||
    acquisition === "returned_route_reconnaissance"
  );
}

/**
 * Broad terrain impression: quarter buckets, never the exact hidden productivity figure.
 *
 * ROUNDED, not floored. An earlier revision floored this to guarantee a traversal could
 * never overstate country — but flooring is a SYSTEMATIC DOWNWARD BIAS, not honest
 * uncertainty, and it measurably suppressed legitimate behaviour: the habitat ladder's
 * `marginal_escapable` tier, which exists to test a band escaping poor land for better,
 * went from surviving with 4 bands and population 98 to EXTINCT. Coarsening removes the
 * false precision; biasing the estimate downward removes real information. Rounding keeps
 * the impression unbiased and still upgradable by a scout, harvest or residence.
 */
function coarseRichnessImpression(richness: number): number {
  return Math.round(clamp01(richness) * 4) / 4;
}

/**
 * What a walker can see of water: that it is THERE, not how dependable it is across
 * seasons. §14's water contract — "visible water may support presence; reliability
 * requires use or repeated seasonal observation".
 *
 * This CAPS the claim rather than gating on visible surface hydrography. An earlier
 * revision wrote 0 whenever no river/wetland/coast was adjacent, which asserts "there is no
 * water here" — a far stronger claim than the evidence supports, and stronger than saying
 * nothing. It also collided with the viability gate (`waterReliability > 0.32`,
 * carryingCapacity.ts:919), so every frontier tile without adjacent surface water became
 * permanently ineligible as a destination. That is what extinguished the habitat ladder's
 * `marginal_escapable` tier.
 *
 * Capping instead of zeroing keeps the honest part of the correction — a passing party
 * cannot certify a place as dependably watered — without inventing an absence it did not
 * observe. Real use or repeated seasonal observation lifts the cap.
 */
const TRAVERSAL_WATER_CONFIDENCE_CEILING = 0.5;
/**
 * CORRECTION-21 continuation §4 — coarse buckets for everything a walker only GLIMPSES.
 *
 * The first revision of this repair capped water at a ceiling but otherwise passed the
 * exact hydrological figure through. The full field-content audit measured the
 * consequence: 33 exact `observedWaterAccess` copies and 36 exact
 * `observedAquaticPotential` copies of hidden truth across 12 sampled tiles, because the
 * cap only bit on high-water tiles and every low-water tile leaked its precise value. A
 * ceiling is not a coarsening.
 */
function coarseImpression(value: number): number {
  return Math.round(clamp01(value) * 4) / 4;
}

function visibleWaterPresence(tile: Tile): number {
  // A walker sees "there is water here" or "this is dry", not a hydrological measurement.
  // Coarsened first, then capped: presence may be noted, reliability may not be claimed.
  return Math.min(
    TRAVERSAL_WATER_CONFIDENCE_CEILING,
    coarseImpression(tile.resourceProfile.waterAccess),
  );
}

/** Visible open water only, and only as a coarse impression. */
function visibleAquaticPresence(tile: Tile): number {
  if (tile.isAquatic !== true && tile.isRiver !== true) {
    return 0;
  }

  return Math.min(
    TRAVERSAL_WATER_CONFIDENCE_CEILING,
    coarseImpression(tile.resourceProfile.aquaticPotential),
  );
}

/**
 * CORRECTION-22 §6 — AUDIT-ONLY component isolation. Names which components of the
 * CORRECTION-21 shallow-traversal repair to switch back OFF, so a habitat-tier loss can be
 * attributed to a specific field rather than to "the repair" as a whole. Every flag is
 * false in every normal world; the object is built once from `world.auditOptions`.
 */
interface ShallowRestoreSwitches {
  readonly richness: boolean;
  readonly water: boolean;
  readonly seasonal: boolean;
  readonly storage: boolean;
  readonly confidence: boolean;
}

function deriveShallowRestore(world: WorldState): ShallowRestoreSwitches {
  const which = world.auditOptions?.shallowObservationRestore;
  const all = which === "all";

  return {
    richness: all || which === "richness",
    water: all || which === "water",
    seasonal: all || which === "seasonal",
    storage: all || which === "storage",
    confidence: all || which === "confidence",
  };
}

function observeTile(
  world: WorldState,
  observedTiles: Record<string, KnownTileRecord>,
  tileObservationHistory: TileObservation[],
  observerBandId: BandId,
  target: ObservationTarget,
  acquisition: KnowledgeAcquisitionKind,
  restore: ShallowRestoreSwitches,
  policy?: ObservationPolicy,
): void {
  const existingRecord = observedTiles[target.tile.id];

  // CORRECTION-23F §7 — DISCOVERY versus MAINTENANCE. F5 may only create; F6 may only
  // refresh. Both skip the observation history push as well, because a suppressed
  // observation did not happen as far as the band is concerned.
  if (policy === "new_tiles_only" && existingRecord !== undefined) {
    return;
  }

  if (policy === "existing_only" && existingRecord === undefined) {
    return;
  }
  // CORRECTION-21 §14 — a traversal is treated shallowly ONLY while the band has nothing
  // better. Once a residential observation, scout or harvest has established real evidence
  // for this tile, a later party walking past neither downgrades it nor re-coarsens it.
  const shallow =
    isShallowTraversal(acquisition) && existingRecord?.acquisition !== "residential_observation";
  // Existence and passability are fully established by standing on the tile. What a single
  // crossing does NOT establish is ecological adequacy, so the general-purpose confidence
  // for a shallow traversal sits below a residential observation and rises with repeat
  // visits rather than being pinned at 1.0 by one walk-past.
  const baseConfidence = target.distance === 0 ? 1 : target.distance === 1 ? 0.68 : 0.34;
  const priorVisits = existingRecord?.visits ?? 0;
  const confidence = shallow && !restore.confidence
    ? Math.min(0.72, 0.4 + priorVisits * 0.08) * (target.distance === 0 ? 1 : baseConfidence)
    : baseConfidence;
  const existingSeasons = existingRecord?.seasonsObserved ?? [];
  const seasonsObserved = existingSeasons.includes(world.time.season)
    ? existingSeasons
    : [...existingSeasons, world.time.season];
  const visits = (existingRecord?.visits ?? 0) + (target.distance === 0 ? 1 : 0);
  const observedRisk = getObservedRisk(target.tile);
  const record: KnownTileRecord = {
    tileId: target.tile.id,
    firstObservedAt: existingRecord?.firstObservedAt ?? world.time,
    lastObservedAt: world.time,
    seasonsObserved,
    visits,
    // §14 resource contract — a walker sees broad terrain, not stock. Coarsened to quarter
    // buckets for a traversal; exact for real observation.
    observedRichness: shallow && !restore.richness
      ? Math.max(
          existingRecord?.observedRichness ?? 0,
          coarseRichnessImpression(getDepletionAdjustedRichness(world, target.tile)),
        )
      : getDepletionAdjustedRichness(world, target.tile),
    // §14 water contract — visible presence for a traversal; reliability must be earned.
    observedWaterAccess: shallow && !restore.water
      ? Math.max(existingRecord?.observedWaterAccess ?? 0, visibleWaterPresence(target.tile))
      : target.tile.resourceProfile.waterAccess,
    observedAquaticPotential: shallow && !restore.water
      ? Math.max(existingRecord?.observedAquaticPotential ?? 0, visibleAquaticPresence(target.tile))
      : target.tile.resourceProfile.aquaticPotential,
    // Passability IS established by walking.
    observedMovementCost: target.tile.movementCost,
    observedRisk,
    // §14 — storage suitability is not observable in passing. Preserved if already known.
    ...(shallow && !restore.storage
      ? existingRecord?.observedStorageSuitability === undefined
        ? {}
        : { observedStorageSuitability: existingRecord.observedStorageSuitability }
      : { observedStorageSuitability: target.tile.resourceProfile.storageSuitability }),
    // §14 seasonal contract — one crossing in one season cannot establish a calendar. A
    // shallow traversal keeps whatever calendar was already earned and claims none of its
    // own; `seasonsObserved` still records the season actually experienced.
    // A shallow traversal makes NO seasonal claim. Crucially it leaves the field
    // UNDEFINED rather than writing an empty pattern: the readers already model "unknown"
    // correctly (habitatYield.ts:68 defaults reliability to 0.46, and
    // getSeasonResourceModifier returns a neutral 0.85 for an undefined pattern), whereas a
    // DEFINED pattern with empty peak/lean arrays and reliability 0 asserts "this place has
    // no seasonal reliability" — a stronger claim than the evidence supports, and worse
    // than saying nothing (modifier 0.75, reliability 0). Writing absence instead of
    // uncertainty is what extinguished the habitat ladder's `marginal_escapable` tier.
    ...(shallow && !restore.seasonal
      ? existingRecord?.observedSeasonalPattern === undefined
        ? {}
        : { observedSeasonalPattern: existingRecord.observedSeasonalPattern }
      : { observedSeasonalPattern: {
          peakSeasons: target.tile.seasonalProfile.peakSeasons,
          leanSeasons: target.tile.seasonalProfile.leanSeasons,
          reliability: target.tile.seasonalProfile.reliability,
          confidence: Math.max(existingRecord?.observedSeasonalPattern?.confidence ?? 0, confidence),
        } }),
    confidence: Math.max(existingRecord?.confidence ?? 0, confidence),
    knowledgeSource: "personally_observed",
    // CORRECTION-18 §8 — provenance UPGRADES but never downgrades: once a band has
    // actually lived in a place, a later traversal by a passing party must not relabel it
    // as shallow. Residential observation therefore always wins over traversal.
    acquisition:
      existingRecord?.acquisition === "residential_observation"
        ? "residential_observation"
        : acquisition,
    // CORRECTION-23D §6/§9 — CARRY THE DURABLE VERIFICATION DISPOSITION FORWARD.
    //
    // This writer rebuilds the record as a fresh literal on every observation, so any field
    // not named here is silently dropped. Walking past a place must not delete what a party
    // physically established there: without this line the conclusion vanished the next time
    // any route crossed the tile, and the settled question reopened — the same class of
    // defect as the capped-list eviction this correction exists to remove.
    ...(existingRecord?.verificationDisposition === undefined
      ? {}
      : { verificationDisposition: existingRecord.verificationDisposition }),
  };

  tileObservationHistory.push({
    tileId: target.tile.id,
    observedAt: world.time,
    season: world.time.season,
    observedRichness: getDepletionAdjustedRichness(world, target.tile),
    observedAquaticPotential: target.tile.resourceProfile.aquaticPotential,
    observedRisk,
    observerBandId,
  });

  observedTiles[target.tile.id] = applyObservationPolicy(record, existingRecord, world, policy);
}

/**
 * CORRECTION-23F §8/§9 — split WHAT IS KNOWN from HOW ALIVE THE RECORD IS.
 *
 * The writer above changes both at once. `memoryCompression.getKnownRetentionScore` reads
 * `lastObservedAt.tick` (recency), `visits`, `confidence`, `observedWaterAccess`,
 * `observedAquaticPotential` and `knowledgeSource`; the decision layer reads the content
 * fields. Two of those — `lastObservedAt` and `visits` — are purely "this record is alive",
 * and they are the ones these arms move.
 *
 * HONEST LIMIT OF THE SEPARATION, recorded rather than hidden: `confidence` and the two
 * water fields feed BOTH content and retention, so `content_no_recency` still lets a small
 * amount of retention value through, and `recency_no_content` withholds a small amount. The
 * split is clean for recency and visits and approximate for the rest. A first observation of
 * an unknown tile has no previous content to preserve, so `recency_no_content` and
 * `season_identity_only` write it in full and are reported as such.
 */
function applyObservationPolicy(
  record: KnownTileRecord,
  existingRecord: KnownTileRecord | undefined,
  world: WorldState,
  policy?: ObservationPolicy,
): KnownTileRecord {
  if (policy === undefined || policy === "target_only" || policy === "route_only") {
    // The target/route arms filter WHICH tiles reach this writer; they do not change what a
    // reached tile records.
    return record;
  }

  if (policy === "no_season_identity") {
    // F9 — physically revisited, but the visit adds no seasonal coverage.
    return { ...record, seasonsObserved: existingRecord?.seasonsObserved ?? record.seasonsObserved };
  }

  if (existingRecord === undefined) {
    return record;
  }

  if (policy === "content_no_recency") {
    // F7 — everything the band LEARNS updates; the record does not become any more alive.
    return {
      ...record,
      lastObservedAt: existingRecord.lastObservedAt,
      visits: existingRecord.visits,
    };
  }

  if (policy === "recency_no_content") {
    // F8 — the record stays alive; the band learns nothing new from the visit.
    return {
      ...existingRecord,
      lastObservedAt: record.lastObservedAt,
      visits: record.visits,
    };
  }

  if (policy === "season_identity_only") {
    // F10 — the ONLY thing the visit establishes is that this place was seen this season.
    return {
      ...existingRecord,
      seasonsObserved: existingRecord.seasonsObserved.includes(world.time.season)
        ? existingRecord.seasonsObserved
        : [...existingRecord.seasonsObserved, world.time.season],
    };
  }

  return record;
}
