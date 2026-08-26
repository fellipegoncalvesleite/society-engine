// CORRECTION-17 — FRONTIER EXPLORATION: the band-known directional hypothesis, the
// successive physical step, the return reserve, and the bounded breadcrumb trail.
//
// WHY THIS EXISTS. Every pre-existing expedition family aims at a REMEMBERED PLACE:
// `distant_plant_gathering`/`distant_hunting`/`distant_fishing` draw a remembered patch,
// `distant_patch_verification` re-reads one, and `route_reconnaissance` walks toward a
// remembered patch whose ACCESS evidence is weak (or re-reads a route a party already
// failed on). All five therefore select a target out of `resourceKnowledgeState`, and a
// band cannot remember a patch in country it has never entered. That is the mechanism
// behind the measured ~9-tile destination-knowledge horizon: on the richest map2
// catchment a founder's maximum known-tile distance is 7-11 tiles at every 50-year
// sample across 300 years, so a daughter destination can only ever be chosen inside the
// parent's own foraging catchment.
//
// WHAT THIS MODULE ADDS. A party that sets out on a DIRECTION instead of a destination.
//
//   eligibility  — band-known pressure/saturation/opportunity-exhaustion state only
//   heading      — a band-known directional hypothesis (corridor head, known edge,
//                  visible relief/water cue, inherited heading, second-hand direction)
//   stepping     — one physical 4-adjacent step per movement unit, chosen from what a
//                  person STANDING THERE can see; the route is discovered, never planned
//   reserve      — at every outward step, enough capacity is held back to walk home
//   breadcrumbs  — a bounded trail of walked tiles plus a bounded salient-observation set
//
// WHAT THIS MODULE MUST NEVER DO (the anti-omniscience contract, audited):
//   - read hidden richness, water access, plant/fauna stocks, or "the best unseen tile";
//   - read future fission success or a precomputed optimal route through unseen country;
//   - let food stress buy movement speed, visibility, stamina, duration, carry capacity,
//     observation precision or physical yield. NEED CHANGES WILLINGNESS AND PRIORITY ONLY.
//
// The one world-truth read in the stepping rule is PHYSICAL ADJACENCY AND PASSABILITY of
// the FOUR TILES TOUCHING THE PARTY'S FEET, plus what the party can see from that stand.
// A person standing on a hillside genuinely knows whether the next step is a cliff, a
// river, or walkable ground. That is physical perception, not omniscience — and it is
// exactly the read `deriveArrivalViewshedObservation` already makes for arriving parties.
//
// Determinism: no randomness anywhere. Every tie is broken on tile id.
import type { Coord, ReasonId, TickNumber, TileId } from "../core/types";
import { getTile } from "../world/generate";
import { isBandPassableDestination } from "../world/passability";
import type { Tile, WorldState } from "../world/types";
import { LANDSCAPE_VISIBILITY_MAX_RANGE_KM } from "./landscapeVisibility";
import { getManhattanPhysicalDistanceKm } from "../world/spatialGeometry";
import { deriveResidentialForagingAccessForBand } from "./residentialAnchor";
import type {
  Band,
  ExpeditionObservation,
  ExpeditionRecord,
  FrontierExplorationBasis,
  FrontierExplorationPlan,
  FrontierExplorationSector,
  VisibleLandscapeCue,
} from "./types";

// ── Bounds. Hard caps on state and search; never tuning dials. ────────────────────

/**
 * §13 — bounded carried observations for an exploratory route. The shared
 * `EXPEDITION_OBSERVATION_CAP` of 6 is sized for a there-and-back task with one target;
 * an exploratory route of up to 36 tiles has more than six things worth remembering. The
 * retention rule below is "salient observations plus route endpoints", NOT an unbounded
 * array: at the cap the least salient MIDDLE observation is dropped, while the first
 * (the known edge the party crossed), the last (its deepest reach) and every barrier are
 * always kept. State stays bounded across centuries.
 */
export const FRONTIER_OBSERVATION_CAP = 12;
/**
 * §9 — how many tiles the party may sample as candidate next steps. Four-adjacency, so
 * this is a constant-time local read by construction. Named so the bound is explicit.
 */
export const FRONTIER_STEP_BRANCHING = 4;
/** Eligibility floor: below this blended band-known evidence no party is raised. */
const FRONTIER_ELIGIBILITY_THRESHOLD = 0.5;
// PROVENANCE D — provisional physical compatibility calibration: the former two-cell heading
// anchor on the canonical raster represented about 3 km of displacement.
const MIN_ANCHOR_DISTANCE_KM = 3;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const round2 = (value: number): number => Math.round(value * 100) / 100;

// ─────────────────────────────────────────────────────────────────────────────
// §7 — ELIGIBILITY. Band-known state only.
// ─────────────────────────────────────────────────────────────────────────────

export interface FrontierExplorationEligibility {
  readonly eligible: boolean;
  readonly evidenceScore: number;
  /** Willingness multiplier from need. Affects THRESHOLD only — never any physical capability. */
  readonly willingness: number;
  readonly rangeSaturation: number;
  readonly lowReturnPressure: number;
  readonly dispersalPressure: number;
  readonly noKnownNonOverlappingDestination: boolean;
  readonly exhaustedKnownOpportunity: boolean;
  readonly reasonIds: readonly ReasonId[];
  /** Literal non-claims, asserted by construction and checked by the anti-omniscience audit. */
  readonly noHiddenRichnessRead: true;
  readonly noBestUnseenTileRead: true;
  readonly noFutureFissionRead: true;
}

/**
 * Does the band have a band-known REASON to look beyond what it knows?
 *
 * Every input below is the band's own derived state — its range saturation, its own
 * return trend, its own dispersal/fission pressure, its own known-opportunity set, its
 * own probe history. None of them is a property of unseen country.
 *
 * `noKnownNonOverlappingDestination` is the specific trigger this checkpoint exists for:
 * the band wants to send a daughter somewhere, and every destination it knows about lies
 * inside the range it is already working.
 */
export function deriveFrontierExplorationEligibility(
  world: WorldState,
  band: Band,
): FrontierExplorationEligibility {
  const saturation = clamp01(band.rangeSaturation?.saturationPressure ?? 0);
  const returnTrend = band.returnTrend;
  // Repeated LOW RETURNED SUPPORT — the band's own physical receipts, not a habitat read.
  const lowReturnPressure = clamp01(
    returnTrend === undefined
      ? 0
      : Math.max(
          returnTrend.chronicDecline ? 0.45 : 0,
          Math.max(0, -returnTrend.shortLongDelta) * 0.7,
          Math.max(0, 0.45 - returnTrend.mean8) * 1.3,
        ),
  );
  const dispersalPressure = clamp01(
    Math.max(
      band.daughterColonization?.pressure ?? 0,
      band.frontierDispersal?.pressure ?? 0,
      band.innerFission?.pressureScore ?? 0,
    ),
  );

  // Does the band already know a viable destination OUTSIDE the range it works? This
  // reads the band's OWN opportunity record and its OWN position — never world truth.
  const opportunity = band.daughterColonization?.bestKnownUnusedHabitatOpportunity;
  const parentCatchment = deriveResidentialForagingAccessForBand(world, band);
  const opportunityInsideParentCatchment =
    opportunity === undefined
      ? undefined
      : parentCatchment.reachable.some((entry) => entry.tileId === opportunity.candidateTileId);
  const noKnownNonOverlappingDestination =
    opportunity === undefined || opportunityInsideParentCatchment !== false;
  // Exhausted known opportunity: the band holds an opportunity record that its own
  // criteria already REJECTED, or holds none at all while under real pressure.
  const exhaustedKnownOpportunity =
    opportunity === undefined || opportunity.consideredAsTarget !== true;

  // §7 — NEED CHANGES WILLINGNESS AND PRIORITY ONLY. `willingness` is applied to the
  // eligibility THRESHOLD below and to nothing else. It is deliberately not returned
  // into any pace, viewshed, duration, carry or yield computation anywhere in this file.
  const foodStress = clamp01(band.pressureState?.foodStress ?? 0);
  const willingness = round2(1 + foodStress * 0.35);

  const evidenceScore = clamp01(
    saturation * 0.34 +
      lowReturnPressure * 0.26 +
      dispersalPressure * 0.34 +
      (noKnownNonOverlappingDestination ? 0.22 : 0) +
      (exhaustedKnownOpportunity ? 0.14 : 0) +
      (band.frontierIntent === undefined ? 0 : band.frontierIntent.strength * 0.2),
  );

  const eligible = evidenceScore * willingness >= FRONTIER_ELIGIBILITY_THRESHOLD;
  const reasonIds: ReasonId[] = [];

  if (eligible) {
    reasonIds.push(
      `reason:${String(band.id)}:${String(world.time.tick)}:frontier_exploration_eligible` as ReasonId,
    );
  }

  if (noKnownNonOverlappingDestination && dispersalPressure > 0.4) {
    reasonIds.push(
      `reason:${String(band.id)}:${String(world.time.tick)}:frontier_no_known_nonoverlapping_destination` as ReasonId,
    );
  }

  return {
    eligible,
    evidenceScore: round2(evidenceScore),
    willingness,
    rangeSaturation: round2(saturation),
    lowReturnPressure: round2(lowReturnPressure),
    dispersalPressure: round2(dispersalPressure),
    noKnownNonOverlappingDestination,
    exhaustedKnownOpportunity,
    reasonIds,
    noHiddenRichnessRead: true,
    noBestUnseenTileRead: true,
    noFutureFissionRead: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// §8 — DIRECTION, NOT DESTINATION.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the band-known directional hypothesis, in a fixed evidence precedence.
 *
 * Each branch reads ONE kind of band-known evidence and produces a HEADING plus the
 * band-known ANCHOR the heading was read from. No branch reads, ranks, or even looks at
 * a tile the band has not observed or been told about — including the `visible_relief`
 * and `water_margin` branches, which read `band.visibleLandscapeCues`: a bounded,
 * decaying, already-accepted viewshed record of what is SEEN from camp (its own
 * `noObservedTileCreated`/`noResourceUnlock` contract), not a richness lookup.
 */
export function deriveFrontierHeading(
  world: WorldState,
  band: Band,
): {
  readonly heading: Coord;
  readonly basis: FrontierExplorationBasis;
  readonly anchorTileId: TileId;
  readonly headingConfidence: number;
} | undefined {
  const origin = getTile(world, band.position);

  if (origin === undefined) {
    return undefined;
  }

  // (a) Continuation of a remembered/inferred corridor — the band's own M0.12 chain.
  const corridorAnchor = farthestCorridorInferredTile(world, band, origin);

  if (corridorAnchor !== undefined) {
    const heading = unitVector(origin.coord, corridorAnchor.coord);

    if (heading !== undefined) {
      return {
        heading,
        basis: "corridor_continuation",
        anchorTileId: corridorAnchor.id,
        headingConfidence: 0.6,
      };
    }
  }

  // (b) An INHERITED / sustained directional memory: the band's own frontier intent.
  const intent = band.frontierIntent;

  if (intent?.directionVector !== undefined && intent.strength > 0.15) {
    const anchor = intent.targetTileId ?? band.position;
    return {
      heading: intent.directionVector,
      basis: band.parentBandId !== undefined ? "inherited_heading" : "corridor_continuation",
      anchorTileId: anchor,
      headingConfidence: round2(clamp01(intent.confidence)),
    };
  }

  // (c) A broad relief / water-margin cue physically VISIBLE from camp. Bounded viewshed
  //     only; the cue records a direction and a distance band, never a resource.
  const cue = selectDirectionalCue(band);

  if (cue !== undefined) {
    const cueTile = getTile(world, cue.approximateTileId);
    const heading = cueTile === undefined ? undefined : unitVector(origin.coord, cueTile.coord);

    if (heading !== undefined) {
      return {
        heading,
        basis: isWaterCue(cue.kind) ? "water_margin" : "visible_relief",
        // The anchor is the CAMP: the cue is a direction on the horizon, and the band
        // has not observed the tile it points at (the cue system excludes observed tiles).
        anchorTileId: band.position,
        headingConfidence: round2(clamp01(cue.confidence * 0.8)),
      };
    }
  }

  // (d) The outer EDGE of the band's own known country — a known tile whose neighbours
  //     are unknown, farthest from camp. Existence-only: direction, never worth.
  const edge = farthestKnownEdgeTile(world, band, origin);

  if (edge !== undefined) {
    const heading = unitVector(origin.coord, edge.coord);

    if (heading !== undefined) {
      return { heading, basis: "known_edge", anchorTileId: edge.id, headingConfidence: 0.45 };
    }
  }

  // (e) Bounded SECOND-HAND direction: a reported/inherited tile record the band never
  //     personally observed. Low confidence, direction only.
  const secondHand = farthestSecondHandTile(world, band, origin);

  if (secondHand !== undefined) {
    const heading = unitVector(origin.coord, secondHand.coord);

    if (heading !== undefined) {
      return {
        heading,
        basis: "second_hand_direction",
        anchorTileId: secondHand.id,
        headingConfidence: 0.3,
      };
    }
  }

  return undefined;
}

/** Build the plan. A heading, a sector, an anchor, and a return budget — nothing else. */
export function buildFrontierPlan(params: {
  readonly heading: Coord;
  readonly basis: FrontierExplorationBasis;
  readonly anchorTileId: TileId;
  readonly headingConfidence: number;
  readonly outboundBudgetTiles: number;
  readonly returnReserveTiles: number;
}): FrontierExplorationPlan {
  return {
    headingX: round2(params.heading.x),
    headingY: round2(params.heading.y),
    sector: sectorOf(params.heading),
    basis: params.basis,
    anchorTileId: params.anchorTileId,
    headingConfidence: round2(clamp01(params.headingConfidence)),
    outboundBudgetTiles: params.outboundBudgetTiles,
    returnReserveTiles: params.returnReserveTiles,
    noHiddenDestination: true,
    noUnseenTargetTile: true,
    noHiddenRichness: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// §9 — SUCCESSIVE PHYSICAL MOVEMENT. One local step, from where the party stands.
// ─────────────────────────────────────────────────────────────────────────────

export type FrontierStepOutcome =
  | { readonly kind: "step"; readonly tileId: TileId }
  | { readonly kind: "blocked" };

/**
 * Choose the party's next physical step. Reads ONLY:
 *   - the already-walked trail (to avoid re-walking and to know the way back);
 *   - the four tiles physically touching the party's feet (existence + passability);
 *   - broad relief/hydrography visible from those adjacent tiles;
 *   - the plan's heading.
 * Physical return capacity is enforced by the expedition lifecycle before this local step chooser runs.
 *
 * It NEVER reads a distant tile, a stock, a richness value, or any property of country
 * more than one step away. A tile's `resourceProfile.waterAccess` is deliberately NOT
 * consulted: only whether the adjacent tile is aquatic/wetland/river, which is what a
 * person standing on the bank physically sees.
 */
export function chooseNextFrontierStep(
  world: WorldState,
  expedition: ExpeditionRecord,
): FrontierStepOutcome {
  const plan = expedition.frontierPlan;
  const stand = getTile(world, expedition.positionTileId);

  if (plan === undefined || stand === undefined) {
    return { kind: "blocked" };
  }

  const walked = new Set(expedition.routeTileIds);
  const heading: Coord = { x: plan.headingX, y: plan.headingY };
  let best: { readonly tile: Tile; readonly score: number } | undefined;
  let considered = 0;

  // Four-adjacency, sorted for determinism. Bounded by FRONTIER_STEP_BRANCHING.
  for (const neighborId of [...stand.neighbors].sort((a, b) => String(a).localeCompare(String(b)))) {
    if (considered >= FRONTIER_STEP_BRANCHING) {
      break;
    }

    const neighbor = getTile(world, neighborId);

    if (neighbor === undefined || gridDistance(stand.coord, neighbor.coord) !== 1) {
      continue;
    }

    considered += 1;

    // Physical passability of the ground under the next step. A person standing here
    // can see whether that is walkable land.
    if (!isBandPassableDestination(neighbor) || walked.has(neighbor.id)) {
      continue;
    }

    const step = unitVector(stand.coord, neighbor.coord);

    if (step === undefined) {
      continue;
    }

    // Alignment with the band-known heading is the primary term: the party is trying to
    // keep going the way it set out. A step that reverses the heading is never taken.
    const alignment = step.x * heading.x + step.y * heading.y;

    if (alignment <= 0) {
      continue;
    }

    // §9 local course correction: a broad water/wetland margin or easier ground visible
    // from THIS stand nudges the next step. These are perceptual facts about a tile the
    // party is about to set foot on, not a resource lookup.
    const visibleMargin =
      neighbor.terrainKind === "wetlands" || neighbor.isRiver === true ? 0.12 : 0;
    const easierGround = clamp01(1 - neighbor.movementCost) * 0.1;
    const score = alignment + visibleMargin + easierGround;

    if (best === undefined || score > best.score || (score === best.score && String(neighbor.id) < String(best.tile.id))) {
      best = { tile: neighbor, score };
    }
  }

  return best === undefined ? { kind: "blocked" } : { kind: "step", tileId: best.tile.id };
}

// ─────────────────────────────────────────────────────────────────────────────
// §10 — RETURN-BUDGET AUTHORITY.
// ─────────────────────────────────────────────────────────────────────────────
// §13 — BOUNDED BREADCRUMB / OBSERVATION REPRESENTATION.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retain a bounded, deterministic observation set: SALIENT OBSERVATIONS PLUS ROUTE
 * ENDPOINTS (one of the §13-permitted designs).
 *
 * Always kept: the FIRST observation (the known edge the party crossed), the LAST (its
 * deepest reach), and every barrier/hazard (the evidence that distinguishes a blocked
 * direction from a successful one). At the cap the least salient MIDDLE observation is
 * dropped — so the set never grows past `FRONTIER_OBSERVATION_CAP` no matter how long the
 * simulation runs, while still reconstructing a passable corridor and preserving the
 * blocked-vs-successful distinction.
 *
 * It deliberately does NOT pretend every crossed tile was studied deeply: the trail
 * (`routeTileIds`) records that the party WALKED there; only these bounded records claim
 * the party LOOKED.
 */
export function retainFrontierObservations(
  observations: readonly ExpeditionObservation[],
): readonly ExpeditionObservation[] {
  if (observations.length <= FRONTIER_OBSERVATION_CAP) {
    return observations;
  }

  const first = observations[0];
  const last = observations[observations.length - 1];
  const middle = observations.slice(1, -1);
  const salience = (observation: ExpeditionObservation): number =>
    (observation.kind === "frontier_barrier" || observation.kind === "route_hazard" ? 2 : 0) +
    (observation.kind === "distant_feature" ? 1 : 0) +
    observation.confidence;

  // Keep the highest-salience middle observations, restored to walked order so the
  // corridor reconstruction stays monotonic. Deterministic: salience then day then tile.
  const keptMiddle = [...middle]
    .sort((left, right) => {
      const delta = salience(right) - salience(left);

      if (delta !== 0) {
        return delta;
      }

      const dayDelta = Number(left.observedDay) - Number(right.observedDay);

      return dayDelta === 0 ? String(left.tileId).localeCompare(String(right.tileId)) : dayDelta;
    })
    .slice(0, FRONTIER_OBSERVATION_CAP - 2);
  const keptIds = new Set(keptMiddle.map((observation) => `${observation.tileId}:${observation.observedDay}`));

  return [
    first,
    ...middle.filter((observation) => keptIds.has(`${observation.tileId}:${observation.observedDay}`)),
    last,
  ];
}

/**
 * §12 — what a party physically standing on an unknown tile learns. Existence, broad
 * terrain, broad water/relief visibility, passability experience. Confidence is a
 * function of PHYSICAL PRESENCE ONLY: a party either stood there or it did not. Nothing
 * here scales with the band's hunger, and nothing here reads a stock.
 */
export function buildFrontierCountryObservation(
  world: WorldState,
  tileId: TileId,
  observedDay: number,
): ExpeditionObservation | undefined {
  const tile = getTile(world, tileId);

  if (tile === undefined) {
    return undefined;
  }

  // A broad water/wetland margin adjacent to the stand is the one thing a person on the
  // ground cannot miss; it raises the confidence of the SIGHTING, not of any resource.
  const nearBroadWater = tile.neighbors.some((neighborId) => {
    const neighbor = getTile(world, neighborId);

    return (
      neighbor !== undefined &&
      (neighbor.isAquatic === true || neighbor.terrainKind === "wetlands" || neighbor.isRiver === true)
    );
  });

  return {
    tileId,
    kind: "frontier_country_seen",
    confidence: nearBroadWater ? 0.8 : 0.7,
    observedDay: observedDay as ExpeditionObservation["observedDay"],
  };
}

// ── Local helpers. All band-known or strictly-local physical reads. ───────────────

function isWaterCue(kind: string): boolean {
  return (
    kind === "visible_water" ||
    kind === "visible_wetland" ||
    kind === "lake_shore_visible" ||
    kind === "delta_like_area" ||
    kind === "river_or_tributary_corridor" ||
    kind === "opposite_bank"
  );
}

/** The band's own strongest fresh directional cue. Bounded viewshed record, deterministic. */
function selectDirectionalCue(band: Band): VisibleLandscapeCue | undefined {
  const cues = (band.visibleLandscapeCues ?? []).filter(
    (cue) => cue.status !== "stale" && !cue.blockedByTerrain && Number.isFinite(cue.distanceKm),
  );
  const cueScore = (cue: VisibleLandscapeCue): number =>
    cue.confidence +
    (isWaterCue(cue.kind) ? 0.15 : 0) +
    clamp01(cue.distanceKm / LANDSCAPE_VISIBILITY_MAX_RANGE_KM) * 0.1;
  let best: VisibleLandscapeCue | undefined;

  for (const cue of cues) {
    if (
      best === undefined ||
      cueScore(cue) > cueScore(best) ||
      (cueScore(cue) === cueScore(best) && String(cue.cueId) < String(best.cueId))
    ) {
      best = cue;
    }
  }

  return best;
}

function farthestCorridorInferredTile(world: WorldState, band: Band, origin: Tile): Tile | undefined {
  const inferred = band.frontierKnowledge?.inferredTiles;

  if (inferred === undefined) {
    return undefined;
  }

  let best: Tile | undefined;
  let bestDistanceKm = MIN_ANCHOR_DISTANCE_KM - 1e-9;

  for (const record of Object.values(inferred)) {
    if (record.source !== "corridor_continuation_inference") {
      continue;
    }

    const tile = getTile(world, record.tileId);

    if (tile === undefined) {
      continue;
    }

    const distanceKm = getManhattanPhysicalDistanceKm(world.config, origin.coord, tile.coord);

    if (
      distanceKm > bestDistanceKm ||
      (distanceKm === bestDistanceKm && best !== undefined && String(tile.id) < String(best.id))
    ) {
      best = tile;
      bestDistanceKm = distanceKm;
    }
  }

  return best;
}

/** A KNOWN tile with at least one UNKNOWN neighbour, farthest from camp. Existence only. */
function farthestKnownEdgeTile(world: WorldState, band: Band, origin: Tile): Tile | undefined {
  let best: Tile | undefined;
  let bestDistanceKm = MIN_ANCHOR_DISTANCE_KM - 1e-9;

  for (const record of Object.values(band.knowledge.observedTiles)) {
    const tile = getTile(world, record.tileId);

    if (tile === undefined || !isBandPassableDestination(tile)) {
      continue;
    }

    const hasUnknownNeighbor = tile.neighbors.some(
      (neighborId) => band.knowledge.observedTiles[neighborId] === undefined,
    );

    if (!hasUnknownNeighbor) {
      continue;
    }

    const distanceKm = getManhattanPhysicalDistanceKm(world.config, origin.coord, tile.coord);

    if (
      distanceKm > bestDistanceKm ||
      (distanceKm === bestDistanceKm && best !== undefined && String(tile.id) < String(best.id))
    ) {
      best = tile;
      bestDistanceKm = distanceKm;
    }
  }

  return best;
}

/** A tile the band knows only SECOND HAND (inherited/reported), farthest from camp. */
function farthestSecondHandTile(world: WorldState, band: Band, origin: Tile): Tile | undefined {
  let best: Tile | undefined;
  let bestDistanceKm = MIN_ANCHOR_DISTANCE_KM - 1e-9;

  for (const record of Object.values(band.knowledge.observedTiles)) {
    if (record.knowledgeSource === "personally_observed" || record.knowledgeSource === "physically_seen_on_spawn") {
      continue;
    }

    const tile = getTile(world, record.tileId);

    if (tile === undefined) {
      continue;
    }

    const distanceKm = getManhattanPhysicalDistanceKm(world.config, origin.coord, tile.coord);

    if (
      distanceKm > bestDistanceKm ||
      (distanceKm === bestDistanceKm && best !== undefined && String(tile.id) < String(best.id))
    ) {
      best = tile;
      bestDistanceKm = distanceKm;
    }
  }

  return best;
}

export function deriveFrontierPhysicalClassifiersForAudit(
  world: WorldState,
  band: Band,
  targetTileId: TileId,
): { readonly insideParentCatchment: boolean; readonly anchorFarEnough: boolean; readonly physicalDistanceKm: number } | undefined {
  const origin = getTile(world, band.position);
  const target = getTile(world, targetTileId);
  if (origin === undefined || target === undefined) return undefined;
  const physicalDistanceKm = getManhattanPhysicalDistanceKm(world.config, origin.coord, target.coord);
  const parentCatchment = deriveResidentialForagingAccessForBand(world, band);
  return {
    insideParentCatchment: parentCatchment.reachable.some((entry) => entry.tileId === targetTileId),
    anchorFarEnough: physicalDistanceKm >= MIN_ANCHOR_DISTANCE_KM,
    physicalDistanceKm,
  };
}

function unitVector(from: Coord, to: Coord): Coord | undefined {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const magnitude = Math.hypot(dx, dy);

  if (magnitude <= 0.0001) {
    return undefined;
  }

  return { x: dx / magnitude, y: dy / magnitude };
}

function gridDistance(from: Coord, to: Coord): number {
  return Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
}

export function gridDistanceBetween(
  world: WorldState,
  fromTileId: TileId,
  toTileId: TileId,
): number | undefined {
  const from = getTile(world, fromTileId);
  const to = getTile(world, toTileId);

  return from === undefined || to === undefined ? undefined : gridDistance(from.coord, to.coord);
}

function sectorOf(heading: Coord): FrontierExplorationSector {
  // Screen coords: +y is south. Sector boundaries every 45°, deterministic.
  const angle = Math.atan2(heading.y, heading.x);
  const index = Math.round(angle / (Math.PI / 4));
  const sectors: readonly FrontierExplorationSector[] = ["e", "se", "s", "sw", "w", "nw", "n", "ne"];

  return sectors[((index % 8) + 8) % 8];
}

/** Deterministic reason id for a launched exploration. */
export function makeFrontierExplorationReasonId(
  bandId: string,
  tick: TickNumber,
  sector: FrontierExplorationSector,
  basis: FrontierExplorationBasis,
): ReasonId {
  return `reason:${bandId}:${String(tick)}:frontier_exploration:${basis}:${sector}` as ReasonId;
}
