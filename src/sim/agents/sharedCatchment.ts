import { deriveCommittedMobilityPools, deriveTravelPace, partyCompositionTotal } from "./bandMobility";
import { deriveBandRiverCrossingCapability } from "./crossingCapability";
import { expandBoundedTravelReach } from "./physicalAccess";
import type { TickContextCache } from "./contextCache";
import type { Band } from "./types";
import type { BandId, TileId } from "../core/types";
import { getTile } from "../world/generate";
import type { WorldState } from "../world/types";

// Shared catchment pressure (checkpoint 2J.1).
//
// Overlapping bands draw from the same reachable support tiles, so a rich
// delta/coast/wetland is NOT a private infinite food bubble for every band that
// sits on it. This module builds, once per TickContextCache, a deterministic and
// bounded per-tile "claim" index: each active band projects a bounded foraging
// footprint (its persisted anchor catchment, or a small ring-walk over its OWN
// known tiles), weighted by its foraging draw and distance decay. A tile's support
// is then divided among its claimants in proportion to their claim weight.
//
// Anti-omniscient: a band never reads other bands' identities or memories here —
// it simply experiences a smaller share of a contested patch (real exploitation
// competition), exactly as overlapping foragers would. Bounded: each footprint is
// capped, and the index is memoized on the cache (built at most once per cache).

// No cell-count cap is allowed to define the exploited/contested land. The travel-time
// budget bounds graph expansion physically; residentialAnchor keeps its own 16-cell
// persisted summary purely as a TECHNICAL retention cap.
// PROVENANCE C — MODEL / PROVISIONAL SCALE-1 CALIBRATION. This fallback matches the provisional
// ordinary residential-anchor budget for legacy states that do not yet carry the physical field.
// It is a compatibility default, not a research-backed foraging law.
const DEFAULT_FORAGING_TRAVEL_BUDGET_DAYS = 0.5;

export interface TileClaim {
  readonly totalWeight: number;
  readonly claimantBandIds: readonly BandId[];
}

export interface FootprintTile {
  readonly tileId: TileId;
  /** Physical route distance in km (legacy `distance` consumers now receive physical units). */
  readonly distance: number;
  readonly distanceKm: number;
  readonly travelTimeDays: number;
  readonly weight: number;
}

export interface SharedCatchmentIndex {
  readonly claimsByTileId: ReadonlyMap<TileId, TileClaim>;
  readonly footprintByBandId: ReadonlyMap<BandId, readonly FootprintTile[]>;
}

// The band's bounded foraging footprint: the tiles it actually draws support from,
// each with a distance (from the band's current position) and a claim weight. This
// is the single source of truth shared by the shared-catchment index AND the
// carrying-capacity yield sum, so "what the band forages" and "what it competes
// for" never diverge.
export function getBandForagingFootprint(
  world: WorldState,
  band: Band,
): readonly FootprintTile[] {
  const originTile = getTile(world, band.position);

  if (originTile === undefined) {
    return [];
  }

  const draw = getBandForagingDraw(band);
  const travelTimeBudgetDays = Math.max(
    0,
    band.residentialAnchor?.foragingTravelTimeBudgetDays ?? DEFAULT_FORAGING_TRAVEL_BUDGET_DAYS,
  );
  const pace = deriveTravelPace(band, "resource_expedition").kmPerTravelDay;
  const access = expandBoundedTravelReach(
    world, band.position, pace, travelTimeBudgetDays, deriveBandRiverCrossingCapability(band),
  );
  const tiles: FootprintTile[] = [];

  // Physical reach is deliberately broader than retained anchor summaries. Resource/support
  // eligibility is then filtered through THIS band's observed records, preserving the knowledge
  // boundary even though traversal itself can cross unknown country.
  for (const reachable of access.reachable) {
    const record = band.knowledge.observedTiles[reachable.tileId];
    const tile = getTile(world, reachable.tileId);

    if (record === undefined || tile === undefined || tile.isAquatic) {
      continue;
    }

    const decay = travelTimeDecay(reachable.travelTimeDays, travelTimeBudgetDays);
    tiles.push({
      tileId: reachable.tileId,
      distance: reachable.physicalDistanceKm,
      distanceKm: reachable.physicalDistanceKm,
      travelTimeDays: reachable.travelTimeDays,
      weight: round4(draw * decay),
    });
  }

  return tiles.sort((left, right) =>
    left.travelTimeDays === right.travelTimeDays
      ? String(left.tileId).localeCompare(String(right.tileId))
      : left.travelTimeDays - right.travelTimeDays,
  );
}

// Memoized accessor: builds the index on first use for a given cache and reuses it
// thereafter. The cache is a fixed per-pass world snapshot, so the index is stable.
export function getSharedCatchmentIndex(
  world: WorldState,
  cache: TickContextCache,
): SharedCatchmentIndex {
  if (cache.sharedCatchmentMemo.value === undefined) {
    cache.sharedCatchmentMemo.value = buildSharedCatchmentIndex(world, cache);
  }

  return cache.sharedCatchmentMemo.value;
}

export function buildSharedCatchmentIndex(
  world: WorldState,
  cache: TickContextCache,
): SharedCatchmentIndex {
  const footprintByBandId = new Map<BandId, readonly FootprintTile[]>();
  const claims = new Map<TileId, { totalWeight: number; claimantBandIds: BandId[] }>();

  // cache.activeBandIds is already sorted, so accumulation order is deterministic.
  for (const bandId of cache.activeBandIds) {
    const band = world.bands[bandId];

    if (band === undefined) {
      continue;
    }

    const footprint = getBandForagingFootprint(world, band);
    footprintByBandId.set(bandId, footprint);

    for (const tile of footprint) {
      const existing = claims.get(tile.tileId);

      if (existing === undefined) {
        claims.set(tile.tileId, { totalWeight: tile.weight, claimantBandIds: [bandId] });
      } else {
        existing.totalWeight += tile.weight;
        existing.claimantBandIds.push(bandId);
      }
    }
  }

  const claimsByTileId = new Map<TileId, TileClaim>();

  for (const [tileId, claim] of claims) {
    claimsByTileId.set(tileId, {
      totalWeight: round4(claim.totalWeight),
      claimantBandIds: claim.claimantBandIds.slice().sort(compareBandIds),
    });
  }

  return { claimsByTileId, footprintByBandId };
}

// The fraction of a tile's support this band receives: its own claim weight over
// the total claim on that tile. 1.0 when it is the sole claimant (private tile).
export function getTileSupportShare(
  index: SharedCatchmentIndex,
  tileId: TileId,
  ownWeight: number,
): number {
  const claim = index.claimsByTileId.get(tileId);

  if (claim === undefined || claim.totalWeight <= 0 || ownWeight <= 0) {
    return 1;
  }

  return clamp01(ownWeight / claim.totalWeight);
}

// All other active bands that share at least one footprint tile with this band.
export function getOverlappingBandIds(
  index: SharedCatchmentIndex,
  bandId: BandId,
): readonly BandId[] {
  const own = index.footprintByBandId.get(bandId);

  if (own === undefined) {
    return [];
  }

  const overlapping = new Set<BandId>();

  for (const tile of own) {
    const claim = index.claimsByTileId.get(tile.tileId);

    if (claim === undefined) {
      continue;
    }

    for (const otherId of claim.claimantBandIds) {
      if (otherId !== bandId) {
        overlapping.add(otherId);
      }
    }
  }

  return [...overlapping].sort(compareBandIds);
}

function travelTimeDecay(travelTimeDays: number, travelTimeBudgetDays: number): number {
  if (travelTimeDays <= 0 || travelTimeBudgetDays <= 0) {
    return 1;
  }

  // Physical/travel-time decay: the edge of the usable budget retains a modest
  // claim, matching the old qualitative taper without tying it to cell count.
  const fraction = clamp01(travelTimeDays / travelTimeBudgetDays);
  return 1 - fraction * 0.7;
}


// CORRECTION-34A §9 — LOCAL EXTRACTION EFFORT. Read the history before changing this.
//
// This quantity divides a CONTESTED PHYSICAL CATCHMENT between bands: it decides how much of a
// tile's support each competing band draws. It is therefore an extraction-effort term, and the
// previous comment here said something different — it said the value "Matches the adult-equivalent
// demand formula in carryingCapacity.derivePopulationDemand so the shared division and the demand
// denominator are on the same scale." Naming a quantity extraction effort while calibrating it to
// consumption demand is the §9 conflation, and it had a physical consequence: `demo.workingAdults`
// is the FULL count, so a band with three of nine adults away kept claiming the residential
// catchment as though all nine were foraging locally, while those same three were provisioned from
// the party's own carried budget and were removing stock at a DIFFERENT tile through
// `resolveExpeditionTargetWork`. One worker, two extractions.
//
// The repair is Option C — separate effort from demand — applied to the AUTHORITY only:
//   * effort (here) counts the adults PHYSICALLY AT CAMP, so an away worker extracts in exactly
//     one place, the place where their body is;
//   * demand (carryingCapacity.derivePopulationDemand) is deliberately UNTOUCHED and still counts
//     the whole band, because an away worker still has to be fed.
//
// The dependent/elder weights are deliberately NOT retuned. They are the existing calibration, and
// §9 forbids preserving aggregate output by adjusting unrelated terms — so this changes WHO is
// counted, never how strongly each person counts. Committed adults come from the same authority
// `deriveAvailableMobilityPools` uses, so "who is at camp" cannot diverge between the two readers.
function getBandForagingDraw(band: Band): number {
  const demo = band.demography;

  // ── CORRECTION-34D — THE AWAY NON-WORKING COUNT IS READ, NOT INFERRED. ──────────────────────
  //
  // CORRECTION-34C derived the non-working away people as `max(0, committedAway - workingAdults)`.
  // That expression only detects the case where the WHOLE cohort has fallen below the committed
  // total, so a band with twenty adults and a party of six saw an adult age and inferred an
  // overflow of zero — correct arithmetic, but it was being presented as knowledge about where a
  // person was, which it never was.
  //
  // The party now records its own non-working members, so both quantities are READ from the
  // record. Away productive workers come out of the adult cohort; away non-working people come out
  // of `elders`, which is the only cohort an away adult can be reclassified into by the ordinary
  // annual step (`adults -= adultsAged; elders += adultsAged;`). That allocation is an AGGREGATE
  // CONVENTION and is named as one — the model has cohorts, not people, and cannot observe which
  // cohort an away individual now belongs to.
  //
  // Dependents are never reduced: a party is not staffed from them, so an away person can never be
  // one. The 0.65/0.85 weights are deliberately NOT retuned — this changes WHO is counted, never
  // how strongly each person counts.
  const awayWorkers = partyCompositionTotal(deriveCommittedMobilityPools(band));
  let awayNonWorking = 0;

  for (const expedition of band.expeditions ?? []) {
    if (isAwayPhaseForEffort(expedition.phase)) {
      awayNonWorking += Math.max(0, expedition.nonWorkingPartyPeople ?? 0);
    }
  }

  const adults = Math.max(0, demo.workingAdults - awayWorkers);
  const elders = Math.max(0, Math.max(0, demo.elders) - awayNonWorking);
  const dependents = Math.max(0, demo.dependents);

  return Math.max(1, adults * 1.0 + dependents * 0.65 + elders * 0.85);
}

/**
 * The LABOUR-committed phases, matching `deriveCommittedMobilityPools`, so the worker term and the
 * non-working term are drawn over exactly the same set of parties.
 */
function isAwayPhaseForEffort(phase: string): boolean {
  return phase === "prepared" || phase === "outbound" || phase === "operating" || phase === "returning";
}


function compareBandIds(left: BandId, right: BandId): number {
  return String(left).localeCompare(String(right));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
