import type {
  Band,
  DaughterDispersalPressure,
  NearbyBandPressure,
  PlaceMemoryRecord,
} from "./types";
import {
  getSalientMemorySummary,
  type TickContextCache,
} from "./contextCache";
import type { BandId, TileId } from "../core/types";
import { getTile, getTileAtCoord } from "../world/generate";
import type { Tile, WorldState } from "../world/types";

const CROWDING_RADIUS = 4;

export function getNearbyBandPressure(
  world: WorldState,
  band: Band,
  tileId: TileId,
  cache?: TickContextCache,
): NearbyBandPressure {
  const cacheKey = `${band.id}|${tileId}`;
  const cached = cache?.nearbyBandPressureByBandTileKey.get(cacheKey);

  if (cached !== undefined) {
    return cached;
  }

  const tile = getTile(world, tileId);

  if (tile === undefined) {
    const empty = emptyNearbyBandPressure(tileId);
    cache?.nearbyBandPressureByBandTileKey.set(cacheKey, empty);

    return empty;
  }

  // With a cache, read crowding from the per-tick scatter field (2J.2B) in
  // O(local kin); without one (isolated unit calls) fall back to the direct scan.
  const pressure = cache === undefined
    ? computePressureFromScan(world, band, tile)
    : computePressureFromField(world, band, tile, cache);

  cache?.nearbyBandPressureByBandTileKey.set(cacheKey, pressure);

  return pressure;
}

// CORRECTION-34 — WHERE A BAND'S BODIES ACTUALLY ARE.
//
// Physical crowding used to scatter `demography.population` from `band.position` and nothing
// else, so a band with a party three days' walk away projected those people at HOME (ghost
// bodies) and projected nothing where the party was actually standing (missing bodies). Measured
// at daily resolution on map2:s1 over 3 years: 69 party-days, of which **34 (49.3%) were beyond
// CROWDING_RADIUS from their own residence** — bodies that existed nowhere.
//
// This is the one authority for that question. It REPORTS canonical expedition state: the
// residential remainder is the population minus everyone physically away, and every away party is
// represented exactly once at its own `positionTileId`. Whether the sources sum to the whole
// population therefore depends on that canonical state being VALID — it is not a property this
// function establishes on its own. Validity is maintained upstream by
// `reconcileExpeditionCommitment`, and this function never silently resizes a party to make the
// arithmetic work. See the note on the clamp inside `getBandPhysicalPresence`.
//
// PHASE SEMANTICS ARE PRODUCTION'S, NOT THE NAMES'. `prepared` means "labor committed at camp,
// NOT yet departed" (types.ts:933), so a prepared party is still physically AT HOME and is NOT
// subtracted here — even though `isExpeditionAway` counts it as away for LABOUR. The two
// questions are different and are answered differently. `completed`, `aborted` and `lost` are
// terminal: they contribute no body anywhere, so a lost party leaves no immortal presence.
//
// Party SIZE carries through the existing population weight, so a 2-worker party scatters roughly
// 1/15 of a 30-person band's weight and mostly falls under the 0.02 contribution floor beyond
// distance 1. No new radius and no new constant is introduced for scale.
const PHYSICALLY_AWAY_PHASES: ReadonlySet<string> = new Set(["outbound", "operating", "returning"]);

export interface PhysicalPresenceSource {
  readonly tileId: TileId;
  /** People physically standing here. Residential remainder, or one away party's workers. */
  readonly people: number;
  readonly kind: "residential_remainder" | "away_party";
  /** Present only for `away_party`, so a consumer can trace the body back to its expedition. */
  readonly expeditionId?: string;
}

/**
 * Every place this band currently has bodies, with the people at each.
 *
 * Reads only the band's own record — no world scan, no cache, bounded by the active-expedition
 * cap.
 *
 * `sum(people)` equals `demography.population` **for valid canonical expedition state**, i.e.
 * whenever `sum(away partyWorkers) <= population`. That precondition is maintained upstream by
 * `reconcileExpeditionCommitment`, which runs daily; it is NOT established here. A band assembled
 * directly by a test or a future caller that never ran a day can still be overcommitted, and this
 * function will report that faithfully rather than disguise it. Assert with
 * `getBandCommitmentAccounting(band).conserved`.
 */
export function getBandPhysicalPresence(band: Band): readonly PhysicalPresenceSource[] {
  const population = band.demography?.population ?? band.size ?? 0;
  const sources: PhysicalPresenceSource[] = [];
  let awayPeople = 0;

  for (const expedition of band.expeditions ?? []) {
    if (!PHYSICALLY_AWAY_PHASES.has(expedition.phase)) {
      continue;
    }

    const workers = Math.max(0, expedition.partyWorkers ?? 0);

    if (workers <= 0 || expedition.positionTileId === undefined) {
      continue;
    }

    awayPeople += workers;
    sources.push({
      tileId: expedition.positionTileId,
      people: workers,
      kind: "away_party",
      expeditionId: expedition.id,
    });
  }

  // CORRECTION-34A §6 — WHAT THIS FUNCTION DOES AND DOES NOT GUARANTEE.
  //
  // This read model is NOT self-conserving and does not claim to be. It reports what the
  // expedition records say, and the sum below equals `population` only when the canonical
  // expedition state handed to it is VALID — that is, when `sum(away partyWorkers) <= population`.
  //
  // Validity is maintained UPSTREAM by `reconcileExpeditionCommitment` (expedition.ts), which runs
  // at the head of the daily expedition action and shrinks or loses any party the band can no
  // longer staff. That covers every band-day produced by the daily kernel, which is the only way
  // production advances a world. It does NOT cover a band object assembled directly by a test,
  // fixture or future caller that never ran a day — such a band can still be overcommitted, and
  // this function will faithfully render that overcommitment rather than disguise it.
  //
  // The clamp below therefore keeps the residential remainder non-negative and nothing more. It
  // deliberately does NOT shrink the away sources: proportionally shrinking an already-launched
  // party inside the read model would hide an invalid upstream state rather than conserve people,
  // and §6 forbids exactly that. Callers that need the guarantee must assert
  // `getBandCommitmentAccounting(band).conserved`, which is the predicate production maintains.
  const residentialRemainder = Math.max(0, population - Math.min(awayPeople, population));

  return [
    { tileId: band.position, people: residentialRemainder, kind: "residential_remainder" },
    ...sources,
  ];
}

/** The people this presence set represents. Equals `demography.population` when no party is away. */
export function physicalPresencePeopleTotal(sources: readonly PhysicalPresenceSource[]): number {
  return sources.reduce((total, source) => total + source.people, 0);
}

/** The existing population→weight transform, applied to ONE presence source rather than the band. */
function presenceWeight(people: number): number {
  return Math.min(1.6, people / 36);
}

// Direct per-tile scan (the pre-2J.2B path), retained for cache-less unit calls.
function computePressureFromScan(
  world: WorldState,
  band: Band,
  tile: Tile,
): NearbyBandPressure {
  let weightedCrowding = 0;
  let parentOverlap = 0;
  let daughterOverlap = 0;
  const pressureBandIds: BandId[] = [];

  for (const otherBand of getCrowdingCandidateBands(world, band)) {
    if (
      otherBand.id === band.id ||
      otherBand.status === "dispersed" ||
      otherBand.viability?.status === "absorbed" ||
      otherBand.viability?.status === "extinct"
    ) {
      continue;
    }

    const descriptor = computeCrowdingContribDescriptor(world, tile, otherBand, undefined);

    if (descriptor.skip) {
      continue;
    }

    const kinFactor = isKinOverlap(band, otherBand) ? 0.72 : 1;
    const contribution = clamp01(descriptor.basePreclamp * kinFactor);

    if (contribution <= 0.02) {
      continue;
    }

    weightedCrowding += contribution;
    pressureBandIds.push(otherBand.id);

    if (otherBand.id === band.parentBandId) {
      parentOverlap += contribution;
    }

    if (band.daughterBandIds.includes(otherBand.id) || otherBand.parentBandId === band.id) {
      daughterOverlap += contribution;
    }
  }

  return buildPressureResult(
    tile,
    weightedCrowding,
    parentOverlap,
    daughterOverlap,
    pressureBandIds.sort(compareBandIds),
    pressureBandIds.length,
  );
}

function buildPressureResult(
  tile: Tile,
  rawWeightedCrowding: number,
  parentOverlap: number,
  daughterOverlap: number,
  pressureBandIds: readonly BandId[],
  nearbyBandCount: number,
): NearbyBandPressure {
  const spatialCapacityBuffer = getSpatialCapacityBuffer(tile);
  const aridityAmplifier = clamp01(0.82 + tile.riskProfile.droughtRisk * 0.42 - spatialCapacityBuffer * 0.28);

  return {
    tileId: tile.id,
    nearbyBandCount,
    weightedCrowding: round2(clamp01((rawWeightedCrowding / 2.2) * aridityAmplifier)),
    parentOverlap: round2(clamp01(parentOverlap / 1.4)),
    daughterOverlap: round2(clamp01(daughterOverlap / 1.4)),
    pressureBandIds,
    confidence: round2(nearbyBandCount === 0 ? 0.48 : 0.72 + Math.min(0.2, nearbyBandCount * 0.04)),
  };
}

// ---------------------------------------------------------------------------
// Deterministic per-tick crowding field (2J.2B).
//
// Each band scatters its crowding influence into nearby tiles ONCE per cache,
// from the fixed band snapshot, through ONE channel:
//   - proximity: tiles within CROWDING_RADIUS of the band's CURRENT position
// Per tile it stores each contributor's pre-clamp base weight (kin factor NOT yet
// applied), the kin-factor=1 crowding sum/count, and the sorted contributor ids.
// A query for a deciding band then reads its tile entry and applies self-exclusion
// + kin (0.72x) corrections in O(local kin), instead of iterating nearby bands.
//
// CORRECTION-28 — there is no memory channel, deliberately. This field used to
// ALSO scatter into the radius-2 ball around each band's salient return /
// high-attachment places, independent of where that band currently was, and add
// `memoryOverlap * 0.24` to the weight. AUDIT-27 measured the consequence: a band
// 35 tiles away still produced crowding, a contributor identity and downstream
// saturation at a place it merely remembered, and memory-only overlap outnumbered
// real physical overlap 27 to 25 across 7,360 pair-seasons. Physical crowding is
// now created ONLY by current physical proximity. Remembered range keeps its own
// authorities — placeMemory, familiarCountry, socialRangeRecognition and
// protoAccessMemory — and none of them is a physical crowding source.
//
// Drift vs. the per-query scan is bounded and intended: (1) tiny float-add order
// differences in the crowding sum (the field accumulates kf=1 in sorted order and
// applies kin/self as deltas, rather than per-band inline), mostly absorbed by the
// round2; (2) in the decision loop the field reflects the fixed pre-decision
// snapshot rather than mid-loop moved positions. basePreclamp is reproduced
// exactly, and nearbyBandCount / confidence stay exact (debug pressureBandIds are
// bounded).
const MAX_DEBUG_PRESSURE_IDS = 32;

interface CrowdingFieldTile {
  readonly weights: Map<BandId, number>;
  sumKf1: number;
  countKf1: number;
  readonly contributorIds: BandId[];
}

export interface CrowdingField {
  readonly byTile: ReadonlyMap<TileId, CrowdingFieldTile>;
  readonly childrenByParent: ReadonlyMap<BandId, readonly BandId[]>;
}

function getCrowdingField(world: WorldState, cache: TickContextCache): CrowdingField {
  if (cache.crowdingFieldMemo.value === undefined) {
    cache.crowdingFieldMemo.value = buildCrowdingField(world, cache);
  }

  return cache.crowdingFieldMemo.value;
}

function buildCrowdingField(world: WorldState, cache: TickContextCache): CrowdingField {
  const byTile = new Map<TileId, CrowdingFieldTile>();
  const childrenByParent = new Map<BandId, BandId[]>();

  // cache.activeBandIds is sorted, so accumulation + contributorIds order is
  // deterministic and matches the scan's sorted candidate order for the kf=1 sum.
  for (const bandId of cache.activeBandIds) {
    const band = world.bands[bandId];

    if (band === undefined) {
      continue;
    }

    if (band.parentBandId !== undefined) {
      const siblings = childrenByParent.get(band.parentBandId);
      if (siblings === undefined) {
        childrenByParent.set(band.parentBandId, [bandId]);
      } else {
        siblings.push(bandId);
      }
    }

    // CORRECTION-34 — scatter from EVERY place this band has bodies, not only from its
    // residence: the residential remainder from `band.position`, and each physically-away party
    // from its own `positionTileId`. The band's total physical weight is unchanged when nobody is
    // away and is redistributed — never duplicated — when somebody is, for valid canonical
    // expedition state (maintained upstream by `reconcileExpeditionCommitment`, not here).
    const presence = getBandPhysicalPresence(band);
    const sources: { readonly tile: Tile; readonly weight: number }[] = [];

    for (const source of presence) {
      const sourceTile = getTile(world, source.tileId);

      if (sourceTile === undefined || source.people <= 0) {
        continue;
      }

      sources.push({ tile: sourceTile, weight: presenceWeight(source.people) });
    }

    if (sources.length === 0) {
      continue;
    }

    // Footprint = the union of each source's proximity ball (distance <= CROWDING_RADIUS).
    // CORRECTION-28: the band no longer scatters into the country it merely
    // remembers, so a band that has walked away stops crowding the place it
    // still values.
    const footprint = new Set<TileId>();
    for (const source of sources) {
      scatterBall(world, source.tile.coord.x, source.tile.coord.y, CROWDING_RADIUS, (reachedTileId) => {
        footprint.add(reachedTileId);
      });
    }

    for (const tileId of footprint) {
      const tile = getTile(world, tileId);

      if (tile === undefined) {
        continue;
      }

      // One band, one weight per tile — summed across its own presence sources, because two
      // groups of the same band standing near one tile really are more bodies near that tile.
      let basePreclamp = 0;

      for (const source of sources) {
        const distance = getGridDistance(source.tile, tile);

        if (distance > CROWDING_RADIUS) {
          continue;
        }

        const distanceWeight = distance <= CROWDING_RADIUS
          ? Math.max(0, (CROWDING_RADIUS + 1 - distance) / (CROWDING_RADIUS + 1))
          : 0;
        const samePatchWeight =
          distance === 0 ? 1 : distance === 1 ? 0.74 : distance === 2 ? 0.48 : 0;

        basePreclamp += (distanceWeight * 0.58 + samePatchWeight * 0.34) * source.weight;
      }

      if (basePreclamp <= 0) {
        continue;
      }

      let entry = byTile.get(tileId);

      if (entry === undefined) {
        entry = { weights: new Map<BandId, number>(), sumKf1: 0, countKf1: 0, contributorIds: [] };
        byTile.set(tileId, entry);
      }

      entry.weights.set(bandId, basePreclamp);

      const kf1 = clamp01(basePreclamp);

      if (kf1 > 0.02) {
        entry.sumKf1 += kf1;
        entry.countKf1 += 1;
        entry.contributorIds.push(bandId);
      }
    }
  }

  return { byTile, childrenByParent };
}

// Manhattan-ball walk over grid coordinates (bounded O(radius^2)); visits each
// existing tile within `radius` of (cx, cy) once.
function scatterBall(
  world: WorldState,
  cx: number,
  cy: number,
  radius: number,
  visit: (tileId: TileId) => void,
): void {
  for (let dy = -radius; dy <= radius; dy += 1) {
    const remaining = radius - Math.abs(dy);

    for (let dx = -remaining; dx <= remaining; dx += 1) {
      const tile = getTileAtCoord(world, { x: cx + dx, y: cy + dy });

      if (tile !== undefined) {
        visit(tile.id);
      }
    }
  }
}

function computePressureFromField(
  world: WorldState,
  band: Band,
  tile: Tile,
  cache: TickContextCache,
): NearbyBandPressure {
  const field = getCrowdingField(world, cache);
  const entry = field.byTile.get(tile.id);

  if (entry === undefined) {
    return buildPressureResult(tile, 0, 0, 0, [], 0);
  }

  let rawSum = entry.sumKf1;
  let count = entry.countKf1;
  let parentOverlap = 0;
  let daughterOverlap = 0;
  const droppedKin = new Set<BandId>();

  // Self-exclusion: remove the deciding band's own kf=1 contribution.
  const selfWeight = entry.weights.get(band.id);

  if (selfWeight !== undefined) {
    const selfKf1 = clamp01(selfWeight);

    if (selfKf1 > 0.02) {
      rawSum -= selfKf1;
      count -= 1;
    }
  }

  // Kin correction: kin contributors use a 0.72x factor; swap each in-range kin's
  // kf=1 term for its kf=0.72 term, and accumulate parent/daughter overlap.
  for (const kinId of getKinAndDaughterBandIds(field, band)) {
    if (kinId === band.id) {
      continue;
    }

    const weight = entry.weights.get(kinId);

    if (weight === undefined) {
      continue;
    }

    const kinBand = world.bands[kinId];
    const isKin = kinBand !== undefined && isKinOverlap(band, kinBand);
    const kinFactor = isKin ? 0.72 : 1;
    const contribution = clamp01(weight * kinFactor);

    if (isKin) {
      const kf1 = clamp01(weight);

      if (kf1 > 0.02) {
        rawSum -= kf1;
        count -= 1;
      }

      if (contribution > 0.02) {
        rawSum += contribution;
        count += 1;
      } else if (kf1 > 0.02) {
        droppedKin.add(kinId);
      }
    }

    if (contribution > 0.02) {
      if (kinId === band.parentBandId) {
        parentOverlap += contribution;
      }

      if (band.daughterBandIds.includes(kinId) || (kinBand !== undefined && kinBand.parentBandId === band.id)) {
        daughterOverlap += contribution;
      }
    }
  }

  const pressureBandIds: BandId[] = [];

  for (const contributorId of entry.contributorIds) {
    if (contributorId === band.id || droppedKin.has(contributorId)) {
      continue;
    }

    pressureBandIds.push(contributorId);

    if (pressureBandIds.length >= MAX_DEBUG_PRESSURE_IDS) {
      break;
    }
  }

  return buildPressureResult(tile, rawSum, parentOverlap, daughterOverlap, pressureBandIds, count);
}

// The bounded set of bands whose crowding contribution for `band` differs from the
// kf=1 baseline OR feeds parent/daughter overlap: parent, siblings, children, and
// explicit daughter ids. Looked up via the field's children-by-parent index so the
// query stays O(local kin) rather than scanning all bands.
function getKinAndDaughterBandIds(field: CrowdingField, band: Band): readonly BandId[] {
  const ids = new Set<BandId>();

  if (band.parentBandId !== undefined) {
    ids.add(band.parentBandId);

    for (const sibling of field.childrenByParent.get(band.parentBandId) ?? []) {
      ids.add(sibling);
    }
  }

  for (const child of field.childrenByParent.get(band.id) ?? []) {
    ids.add(child);
  }

  for (const daughterId of band.daughterBandIds) {
    ids.add(daughterId);
  }

  return [...ids];
}

export function getDaughterDispersalPressure(
  world: WorldState,
  band: Band,
  tileId: TileId,
  cache?: TickContextCache,
): DaughterDispersalPressure {
  const nearby = getNearbyBandPressure(world, band, tileId, cache);
  const tile = getTile(world, tileId);
  const parentBand = band.parentBandId === undefined ? undefined : world.bands[band.parentBandId];
  const parentCoreOverlap = parentBand === undefined || tile === undefined
    ? 0
    : getParentCoreOverlap(world, parentBand, tile, cache);
  const inheritedFamiliarityPull = getInheritedFamiliarityPull(band, tileId);
  const kinSafety = getKinSafety(world, band);
  const earlyDispersalUrgency = getEarlyDispersalUrgency(world, band);
  const kinCoreCrowding = clamp01(parentCoreOverlap * 0.62 + nearby.parentOverlap * 0.28 + nearby.daughterOverlap * 0.18);
  const kinTolerance = kinSafety;
  const safeFrontierPull = tile === undefined ? 0 : getSafeFrontierPull(world, band, tile);
  const localUsePressure = getLocalUsePressureValue(band.usePressure[tileId]);
  // CAUSAL-REPAIR-1: founders are no longer exempt from dispersal pressure.
  // A founding lineage in a saturating basin previously read 0 here forever
  // while its daughters ringed it in. Founder pressure is gated on SUSTAINED
  // evidence (the M0.11 over-capacity signal needs ≥2 consecutive derivations,
  // or already-substantial weighted crowding), built only from parent-free
  // terms, and scaled to 0.7× so founders stay more rooted than daughters.
  const sustainedOverCapacity =
    band.carryingCapacity?.perCapitaReturn.sustainedOverCapacity ??
    band.perCapitaReturn?.sustainedOverCapacity ??
    0;
  const founderPressureGate = sustainedOverCapacity > 0 || nearby.weightedCrowding > 0.3;
  const daughterDispersalPressure = band.parentBandId === undefined
    ? (founderPressureGate
        ? clamp01(
            (nearby.weightedCrowding * 0.3 +
              nearby.daughterOverlap * 0.2 +
              localUsePressure * 0.16 +
              safeFrontierPull * 0.14 +
              Math.min(1, sustainedOverCapacity) * 0.34) * 0.7,
          )
        : 0)
    : clamp01(
        nearby.weightedCrowding * 0.36 +
          parentCoreOverlap * 0.42 +
          kinCoreCrowding * 0.32 +
          earlyDispersalUrgency * 0.28 +
          localUsePressure * 0.18 +
          safeFrontierPull * 0.16 -
          inheritedFamiliarityPull * 0.22 -
          kinSafety * 0.08,
      );

  return {
    tileId,
    parentCoreOverlap: round2(parentCoreOverlap),
    daughterDispersalPressure: round2(daughterDispersalPressure),
    inheritedFamiliarityPull: round2(inheritedFamiliarityPull),
    safeFrontierPull: round2(safeFrontierPull),
    kinTolerance: round2(kinTolerance),
    kinSafety: round2(kinSafety),
    kinCoreCrowding: round2(kinCoreCrowding),
    earlyDispersalUrgency: round2(earlyDispersalUrgency),
    pressureBandIds: nearby.pressureBandIds,
    confidence: nearby.confidence,
  };
}

export function getCrowdingPenalty(
  tile: Tile,
  nearby: NearbyBandPressure,
): number {
  const spatialCapacityBuffer = getSpatialCapacityBuffer(tile);
  const dryAmplifier = clamp01(0.72 + tile.riskProfile.droughtRisk * 0.46);

  return round2(
    clamp01(
      nearby.weightedCrowding * dryAmplifier * (1 - spatialCapacityBuffer * 0.48),
    ),
  );
}

function getParentCoreOverlap(
  world: WorldState,
  parentBand: Band,
  tile: Tile,
  cache: TickContextCache | undefined,
): number {
  const parentTile = getTile(world, parentBand.position);
  const directOverlap =
    parentTile === undefined
      ? 0
      : clamp01((5 - Math.min(5, getGridDistance(parentTile, tile))) / 5);
  const memoryOverlap = getSalientPlaceMemories(parentBand, cache)
    .filter((memory) => memory.isReturnPlace || memory.attachment > 0.46)
    .map((memory) => {
      const memoryTile = getTile(world, memory.tileId);

      return memoryTile === undefined || getGridDistance(memoryTile, tile) > 2
        ? 0
        : clamp01(memory.attachment * 0.72 + (memory.isReturnPlace ? 0.18 : 0));
    })
    .sort((left, right) => right - left)[0] ?? 0;

  return clamp01(Math.max(directOverlap, memoryOverlap));
}

function getInheritedFamiliarityPull(band: Band, tileId: TileId): number {
  const memory = band.placeMemory[tileId];
  const lineagePull = band.lineage?.contactMemory ?? 0;
  const inheritedMemoryPull = memory === undefined
    ? 0
    : clamp01(memory.attachment * 0.48 + memory.confidence * 0.18);

  return band.parentBandId === undefined
    ? inheritedMemoryPull
    : clamp01(inheritedMemoryPull + lineagePull * 0.18);
}

function getKinSafety(world: WorldState, band: Band): number {
  if (band.lineage === undefined) {
    return 0;
  }

  const ageTicks = Math.max(0, world.time.tick - band.lineage.createdAt.tick);
  const renewedContact = band.parentBandId === undefined
    ? 0
    : band.contactMemories[band.parentBandId]?.trustLikeTolerance ?? 0;
  const lineageDecay = clamp01(1 - ageTicks / 240);

  return clamp01(
    band.lineage.contactMemory * 0.18 * lineageDecay +
      renewedContact * 0.34 +
      0.16,
  );
}

function getEarlyDispersalUrgency(world: WorldState, band: Band): number {
  if (band.lineage === undefined) {
    return 0;
  }

  const ageTicks = Math.max(0, world.time.tick - band.lineage.createdAt.tick);

  return clamp01(1 - ageTicks / 80);
}

// CORRECTION-32 — this no longer subtracts `nearby.weightedCrowding * 0.22`.
//
// `safeFrontierPull` is scored DIRECTLY at +0.62 in scoreDecision, on the same move and
// exploration candidates whose `crowdingPenalty` already charges that tile's crowding. The
// subtraction was therefore a second (and, through daughterDispersalPressure, a third) charge
// of one physical fact on one candidate. What the pull is FOR — unknown-neighbour ratio,
// corridor value, band-known suitability — is untouched, and no fission, kin or dispersal rule
// is redesigned here (that remains out of scope).
function getSafeFrontierPull(
  world: WorldState,
  band: Band,
  tile: Tile,
): number {
  if (tile.isAquatic || tile.terrainKind === "mountains" || tile.movementCost > 2.45) {
    return 0;
  }

  const unknownNeighborRatio =
    tile.neighbors.filter((neighborId) => band.knowledge.observedTiles[neighborId] === undefined).length /
    Math.max(1, tile.neighbors.length);
  const corridorValue = clamp01(
    (tile.isRiverbank || tile.isFloodplain ? 0.24 : 0) +
      (tile.isCoastal ? 0.22 : 0) +
      (tile.terrainKind === "wetlands" || tile.isMarshChannel ? 0.2 : 0) +
      (isPassCorridor(tile) ? 0.18 : 0) +
      getKnownCrossingContext(band, tile.id) * 0.18,
  );
  const knownRecord = band.knowledge.observedTiles[tile.id];
  const knownSuitability = knownRecord === undefined
    ? 0.35
    : clamp01(
        knownRecord.observedRichness * 0.36 +
          (knownRecord.observedWaterAccess ?? 0.35) * 0.26 +
          knownRecord.observedAquaticPotential * 0.18 +
          (1 - (knownRecord.observedRisk ?? 0.35)) * 0.2,
      );

  return clamp01(
    unknownNeighborRatio * 0.34 +
      corridorValue +
      knownSuitability * 0.28,
  );
}

function getKnownCrossingContext(band: Band, tileId: TileId): number {
  return Object.values(band.crossingMemories).some(
    (memory) =>
      (memory.crossingTileA === tileId || memory.crossingTileB === tileId) &&
      memory.successConfidence > 0.42,
  )
    ? 1
    : 0;
}

// The band-independent half of a crowding contribution for one (otherBand, tile)
// pair: whether the band is skipped for this tile, and the pre-clamp base weight
// (distance + same-patch + remembered-area, scaled by population) BEFORE the
// deciding band's kin factor is applied. 2J.2.
export interface CrowdingContribDescriptor {
  readonly skip: boolean;
  readonly basePreclamp: number;
}

const SKIPPED_CROWDING_CONTRIB: CrowdingContribDescriptor = { skip: true, basePreclamp: 0 };

// Memoized per (otherBand object, tile) on the tick cache. Keyed by the band
// SNAPSHOT (object identity), so a band that moves/mutates mid-pass becomes a
// fresh key and is recomputed — preserving the live-read semantics the per-band
// pressure cache already relied on, while collapsing the repeated per-deciding-band
// recomputation to once per snapshot. Bypassed when no cache is supplied.
function computeCrowdingContribDescriptor(
  world: WorldState,
  tile: Tile,
  otherBand: Band,
  cache: TickContextCache | undefined,
): CrowdingContribDescriptor {
  // CORRECTION-34 — the same presence sources the field uses, so the cache-less scan path and
  // the cached field path stay byte-identical (the parity CORRECTION-28 audits).
  let basePreclamp = 0;

  for (const source of getBandPhysicalPresence(otherBand)) {
    if (source.people <= 0) {
      continue;
    }

    const sourceTile = getTile(world, source.tileId);

    if (sourceTile === undefined) {
      continue;
    }

    const distance = getGridDistance(tile, sourceTile);

    if (distance > CROWDING_RADIUS) {
      continue;
    }

    const distanceWeight = distance <= CROWDING_RADIUS
      ? Math.max(0, (CROWDING_RADIUS + 1 - distance) / (CROWDING_RADIUS + 1))
      : 0;
    const samePatchWeight =
      distance === 0 ? 1 : distance === 1 ? 0.74 : distance === 2 ? 0.48 : 0;

    basePreclamp += (distanceWeight * 0.58 + samePatchWeight * 0.34) * presenceWeight(source.people);
  }

  if (basePreclamp <= 0) {
    return SKIPPED_CROWDING_CONTRIB;
  }

  return { skip: false, basePreclamp };
}

function isKinOverlap(band: Band, otherBand: Band): boolean {
  return (
    band.parentBandId === otherBand.id ||
    otherBand.parentBandId === band.id ||
    (band.parentBandId !== undefined && band.parentBandId === otherBand.parentBandId)
  );
}

function getSpatialCapacityBuffer(tile: Tile): number {
  // Crowding may reflect water, passability, and physical room, but static food
  // richness must not make a depleted camp behave as though it still has food.
  return clamp01(
    tile.resourceProfile.waterAccess * 0.44 +
      clamp01(1 - Math.max(0, tile.movementCost - 1) / 2.5) * 0.28 +
      (tile.terrainKind === "plains" || tile.terrainKind === "river_valley" ? 0.16 : 0) +
      (tile.isFloodplain || tile.isRiverbank ? 0.12 : 0),
  );
}

function getLocalUsePressureValue(record: Band["usePressure"][TileId] | undefined): number {
  if (record === undefined) {
    return 0;
  }

  return clamp01(
    Math.max(
      record.foragingPressure * 0.82,
      record.waterPressure * 0.86,
      record.aquaticPressure * 0.72,
      record.recentUseIntensity * 0.28,
      record.foragingPressure * 0.46 +
        record.waterPressure * 0.26 +
        record.aquaticPressure * 0.16 +
        record.recentUseIntensity * 0.18,
    ),
  );
}

function isPassCorridor(tile: Tile): boolean {
  return (
    !tile.isAquatic &&
    tile.terrainKind === "hills" &&
    tile.elevation >= 0.28 &&
    tile.elevation <= 0.58 &&
    tile.movementCost <= 1.38
  );
}

function emptyNearbyBandPressure(tileId: TileId): NearbyBandPressure {
  return {
    tileId,
    nearbyBandCount: 0,
    weightedCrowding: 0,
    parentOverlap: 0,
    daughterOverlap: 0,
    pressureBandIds: [],
    confidence: 0,
  };
}

function getGridDistance(first: Tile, second: Tile): number {
  return Math.abs(first.coord.x - second.coord.x) + Math.abs(first.coord.y - second.coord.y);
}

// Cache-less candidate scan used only by computePressureFromScan (isolated unit
// calls without a tick cache). The cache path reads the scatter field instead.
function getCrowdingCandidateBands(
  world: WorldState,
  band: Band,
): readonly Band[] {
  return Object.values(world.bands)
    .filter((candidate) =>
      candidate.id !== band.id &&
      candidate.status !== "dispersed" &&
      candidate.viability?.status !== "absorbed" &&
      candidate.viability?.status !== "extinct",
    )
    .sort((left, right) => compareBandIds(left.id, right.id));
}

function getSalientPlaceMemories(
  band: Band,
  cache: TickContextCache | undefined,
): readonly PlaceMemoryRecord[] {
  // The salient sort is a pure function of the immutable band snapshot (its
  // placeMemory) plus the cache-frozen salient summary, yet crowding pressure and
  // parent-overlap reads invoke it once per (band x candidate tile x nearby band)
  // each tick. Memoize by band-object identity so the SAME snapshot is sorted at
  // most once per cache. Only consulted when a cache is present (the production
  // path), so the memo can only ever hold summary-derived results and is never
  // read on the cache-less fallback used by isolated unit calls.
  if (cache === undefined) {
    return computeSalientPlaceMemories(band, undefined);
  }

  const memoized = cache.salientPlaceMemoByBand.get(band);

  if (memoized !== undefined) {
    return memoized;
  }

  const computed = computeSalientPlaceMemories(band, cache);
  cache.salientPlaceMemoByBand.set(band, computed);

  return computed;
}

function computeSalientPlaceMemories(
  band: Band,
  cache: TickContextCache | undefined,
): readonly PlaceMemoryRecord[] {
  const summary = getSalientMemorySummary(cache, band.id);

  if (summary !== undefined) {
    const salientIds = new Set<TileId>([
      ...summary.topReturnPlaceIds,
      ...summary.topAnchorPlaceIds,
    ]);

    return [...salientIds]
      .map((tileId) => band.placeMemory[tileId])
      .filter((memory): memory is PlaceMemoryRecord => memory !== undefined)
      .sort(comparePlaceMemoryImportance)
      .slice(0, 16);
  }

  return Object.values(band.placeMemory)
    .filter((memory) => memory.isReturnPlace || memory.attachment > 0.4)
    .sort(comparePlaceMemoryImportance)
    .slice(0, 16);
}

function comparePlaceMemoryImportance(
  left: PlaceMemoryRecord,
  right: PlaceMemoryRecord,
): number {
  const leftScore = left.attachment + (left.isReturnPlace ? 0.35 : 0) + left.confidence * 0.18;
  const rightScore = right.attachment + (right.isReturnPlace ? 0.35 : 0) + right.confidence * 0.18;

  return rightScore === leftScore
    ? String(left.tileId).localeCompare(String(right.tileId))
    : rightScore - leftScore;
}

function compareBandIds(left: BandId, right: BandId): number {
  return String(left).localeCompare(String(right));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
