// RANGE-4 — shared-use / intrusion-tension notices, from OBSERVER evidence only.
//
// A notice is admitted by exactly two channels:
//   - CONTEMPORARY DIRECT OBSERVATION: the other band is inside the observer's current
//     physical proximity set (cache.nearbyBandsByBandId, DEFAULT_NEARBY_RADIUS = 4 —
//     the same canonical authority physical crowding and encounter candidacy use), AND
//     the place is inside the observer's own remembered country;
//   - SECOND-HAND REPORT: a WordOfMouthReport received from another band, kept
//     classified `reported_secondhand` with its source, trust basis and report id.
// Everything else the module reads is the observer's OWN state: familiar country,
// ford context, prior notices, contact memories (for RELATION only — they carry no
// position), and kinship.
//
// CORRECTION-30 — this module used to read another band's PRIVATE state directly:
// `other.position` became an "observed residential presence" whenever it fell on any
// tile the observer merely remembered, at ANY distance; `other.recentIntraSeasonTrips`
// became "inferred from recent activity"; and `countRecentTripsInRange` read the same
// private trip list a third time to inflate `recentOverlapCount`, which drives
// `repeated_outsider_use` and `moderate_placeholder` tension. A place being familiar to
// the observer is not evidence about anybody else, and a private trip record is not a
// witness. All three reads are gone. The activity channel is DEFERRED, not disabled by
// preference: this repository has no physical trace, no cross-band smoke and no
// long-range sighting authority to ground it (see
// docs/evidence/shared-range-friction-provenance-30/authority-ledger.md §3.1), and
// inventing one belongs to the Persistent Human Landscape pass.
//
// These records are NOT inert. Through accessNorms.ts they reach
// `ProtoAccessBehaviorEffectState`, which `pressure.ts:161` consumes as a real decision
// input, and `innerFission.ts:145` consumes as social tension. The previous header
// claimed no rule reads them; that was true of DIRECT readers only and is corrected here.

import type { BandId, ReasonId, TickNumber, TileId } from "../core/types";
import { getTile } from "../world/generate";
import type { Tile, WorldState } from "../world/types";
import type { TickContextCache } from "./contextCache";
import { deriveFamiliarCountry, type FamiliarCountrySummary } from "./familiarCountry";
import { deriveFordContext } from "./fordContext";
import type {
  Band,
  RangeFrictionConfidence,
  RangeFrictionEvent,
  RangeFrictionInterpretation,
  RangeFrictionObserverRangeTier,
  RangeFrictionOtherActivityKind,
  RangeFrictionRelation,
  RangeFrictionTensionLevel,
  WordOfMouthReport,
} from "./types";

const RANGE_FRICTION_RING_LIMIT = 8;
const RANGE_FRICTION_MAX_AGE_TICKS = 48;
const RANGE_FRICTION_CANDIDATE_LIMIT = 12;
const RANGE_FRICTION_EVENTS_PER_PAIR_LIMIT = 2;
const RANGE_FRICTION_NEW_EVENTS_PER_BAND_LIMIT = 5;

interface RangeMembership {
  readonly summary: FamiliarCountrySummary;
  readonly coreTiles: ReadonlySet<string>;
  readonly familiarTiles: ReadonlySet<string>;
  readonly edgeTiles: ReadonlySet<string>;
  readonly routeTiles: ReadonlySet<string>;
  readonly fordTiles: ReadonlySet<string>;
}

// CORRECTION-30 — `linkedActivityTripId` is gone from this shape. It could only ever be
// produced from another band's private trip record, so keeping the field would leave the
// door open. `RangeFrictionEvent.linkedActivityTripId` stays in types.ts: it is the right
// vocabulary for a future channel in which a party is actually witnessed or a physical
// trace is actually read. Nothing writes it today.
interface PairNotice {
  readonly tileId: TileId;
  readonly activityKind: RangeFrictionOtherActivityKind;
  readonly confidence: RangeFrictionConfidence;
  readonly recentOverlapCount: number;
  readonly reasonIds: readonly ReasonId[];
}

export function advanceRangeFriction(world: WorldState, cache: TickContextCache): WorldState {
  const activeBands = cache.activeBandIds
    .map((bandId) => world.bands[bandId])
    .filter((band): band is Band => band !== undefined)
    .sort(compareBands);
  const activeById = new Map<BandId, Band>();
  for (const band of activeBands) {
    activeById.set(band.id, band);
  }
  const childrenByParent = buildChildrenByParent(activeBands);
  let changed = false;
  const bands: Record<string, Band> = { ...world.bands };

  for (const observer of activeBands) {
    const membership = buildRangeMembership(observer, world);
    // CORRECTION-30 — the ONE contemporary-observation authority. Current physical
    // proximity, computed by buildTickContextCache from real positions at
    // DEFAULT_NEARBY_RADIUS = 4. The candidate list below stays wider (it also holds
    // kin and remembered contacts) because it is a SELECTION set, not an evidence
    // claim; nothing becomes a direct notice unless it is in this set.
    const nearbyBandIds = new Set<BandId>(cache.nearbyBandsByBandId.get(observer.id) ?? []);
    const candidates = deriveCandidateBands(observer, activeById, childrenByParent, cache)
      .filter((candidate) => candidate.id !== observer.id)
      .slice(0, RANGE_FRICTION_CANDIDATE_LIMIT);
    const freshEvents: RangeFrictionEvent[] = [];

    for (const other of candidates) {
      if (freshEvents.length >= RANGE_FRICTION_NEW_EVENTS_PER_BAND_LIMIT) {
        break;
      }

      const pairEvents = derivePairEvents(world, observer, other, membership, nearbyBandIds.has(other.id))
        .slice(0, RANGE_FRICTION_EVENTS_PER_PAIR_LIMIT);
      freshEvents.push(...pairEvents);
    }

    if (freshEvents.length < RANGE_FRICTION_NEW_EVENTS_PER_BAND_LIMIT) {
      freshEvents.push(
        ...deriveReportLinkedEvents(world, observer, activeById, membership)
          .slice(0, RANGE_FRICTION_NEW_EVENTS_PER_BAND_LIMIT - freshEvents.length),
      );
    }

    const previous = observer.recentRangeFrictionEvents ?? [];
    const ring = mergeEventRing(previous, freshEvents, world.time.tick);

    if (!sameEventRing(previous, ring)) {
      bands[observer.id] = {
        ...observer,
        recentRangeFrictionEvents: ring.length > 0 ? ring : undefined,
      };
      changed = true;
    }
  }

  return changed ? { ...world, bands: bands as Readonly<Record<BandId, Band>> } : world;
}

function derivePairEvents(
  world: WorldState,
  observer: Band,
  other: Band,
  membership: RangeMembership,
  observerIsPhysicallyNear: boolean,
): readonly RangeFrictionEvent[] {
  const notices = derivePairNotices(world, observer, other, membership, observerIsPhysicallyNear);
  const relation = deriveRelation(world, observer, other);

  return notices
    .map((notice) => makePairEvent(world, observer, other, membership, notice, relation))
    .filter((event): event is RangeFrictionEvent => event !== undefined)
    .sort(compareEvents);
}

function derivePairNotices(
  world: WorldState,
  observer: Band,
  other: Band,
  membership: RangeMembership,
  observerIsPhysicallyNear: boolean,
): readonly PairNotice[] {
  // CORRECTION-30 — no contemporary evidence, no notice. `other.position` is the other
  // band's PRIVATE state; the observer may only read it about a band it is physically
  // beside. Without this the observer learned where a band forty tiles away was living
  // purely because the tile happened to be one it remembered.
  if (!observerIsPhysicallyNear) {
    return [];
  }

  const notices: PairNotice[] = [];
  const currentTier = classifyRangeTier(membership, other.position);

  if (currentTier !== "unknown_to_observer") {
    notices.push({
      tileId: other.position,
      activityKind: "residential_presence",
      confidence: "observed",
      recentOverlapCount: 1 + countObserverNoticesOfBand(observer, other.id, world.time.tick),
      reasonIds: [
        makeReasonId(world, observer.id, other.id, "observed_residential_presence", other.position),
      ],
    });
  }

  // The activity channel is DEFERRED, not disabled by preference. It previously read
  // `other.recentIntraSeasonTrips` — a private record — and called the result
  // "inferred_from_recent_activity". Grounding it honestly needs a physical trace, a
  // witnessed departure, or positional history none of which exist here: trip records
  // carry a tick and a day, but no band's position is stored per day, so co-presence
  // at the time of the trip is unrecoverable. See ARCHITECTURE_DECISION.md §2 Option C.

  return notices
    .sort(compareNotices)
    .filter((notice, index, all) => {
      const firstIndex = all.findIndex(
        (candidate) =>
          candidate.tileId === notice.tileId &&
          candidate.activityKind === notice.activityKind &&
          candidate.confidence === notice.confidence,
      );
      return firstIndex === index;
    });
}

function makePairEvent(
  world: WorldState,
  observer: Band,
  other: Band,
  membership: RangeMembership,
  notice: PairNotice,
  relation: RangeFrictionRelation,
): RangeFrictionEvent | undefined {
  const tier = classifyRangeTier(membership, notice.tileId);
  if (tier === "unknown_to_observer") {
    return undefined;
  }

  const tile = getTile(world, notice.tileId);
  const interpretation = deriveInterpretation(tier, notice.activityKind, relation, tile, notice.recentOverlapCount);
  const tensionLevel = deriveTensionLevel(interpretation, relation, tier, notice.recentOverlapCount);
  const priorRecurrence = countPriorRecurrence(
    observer.recentRangeFrictionEvents ?? [],
    other.id,
    notice.tileId,
    interpretation,
    world.time.tick,
  );

  return {
    eventId: makeEventId(world.time.tick, observer.id, other.id, notice.tileId, interpretation, notice.activityKind),
    tick: world.time.tick,
    season: world.time.season,
    observerBandId: observer.id,
    otherBandId: other.id,
    tileId: notice.tileId,
    observerRangeTier: tier,
    otherActivityKind: notice.activityKind,
    relation,
    interpretation,
    tensionLevel,
    confidence: notice.confidence,
    recurrenceCount: priorRecurrence + 1,
    recentOverlapCount: notice.recentOverlapCount,
    noConflictChange: true,
    noMovementChange: true,
    noPopulationChange: true,
    noStressChange: true,
    noYieldChange: true,
    noTerritoryClaim: true,
    reasonIds: notice.reasonIds,
  };
}

// CORRECTION-31 — the identity of the ORIGINAL episode a report describes, not of the
// copy that happened to arrive. `originalObserverBandId` survives relay
// (reportedKnowledge.ts:1027 sets it to `report.originalObserverBandId ?? report.sourceBandId`
// and increments `hops`), so every relayed copy of one story shares this triple. Several
// retellings are one piece of evidence with several voices, and must not behave like
// several independent confirmations.
function reportEpisodeKey(report: WordOfMouthReport): string {
  return [
    String(report.originalObserverBandId ?? report.sourceBandId),
    String(report.topic),
    String(report.targetTileId ?? "untiled"),
  ].join("|");
}

function deriveReportLinkedEvents(
  world: WorldState,
  observer: Band,
  activeById: ReadonlyMap<BandId, Band>,
  membership: RangeMembership,
): readonly RangeFrictionEvent[] {
  const reports = observer.reportedKnowledge?.reports ?? [];
  const events: RangeFrictionEvent[] = [];
  const seenEpisodes = new Set<string>();

  for (const report of reports) {
    if (!isFrictionReport(report) || report.targetTileId === undefined) {
      continue;
    }
    // CORRECTION-31 — one record per ORIGINAL episode. Before this, five relayed copies
    // of one warning produced five friction events, and accessNorms then counted them by
    // `.length` — so a single story could be louder than five independent sightings.
    const episodeKey = reportEpisodeKey(report);
    if (seenEpisodes.has(episodeKey)) {
      continue;
    }
    // RUMOR-LOOP FIX (2026-07-10): a band's OWN report is not evidence of
    // another band. Without this exclusion, a band's internally generated
    // avoid_place / bad_water_warning reports became friction events with
    // otherBandId === itself (the self falls through every kin check →
    // stranger-tier tension), which reportedKnowledge then re-published as
    // "outsider_use_warning" — so even a LONE band heard perpetual rumors of
    // outsiders, and multi-band worlds carried permanent phantom friction.
    // Only reports that actually arrived from ANOTHER band may seed
    // report-linked friction.
    if (report.sourceBandId === observer.id) {
      continue;
    }

    const tier = classifyRangeTier(membership, report.targetTileId);
    if (tier === "unknown_to_observer") {
      continue;
    }

    seenEpisodes.add(episodeKey);

    const sourceBand = activeById.get(report.sourceBandId);
    const relation = sourceBand !== undefined
      ? deriveRelation(world, observer, sourceBand)
      : relationFromReportTrust(report);
    const tile = getTile(world, report.targetTileId);
    const interpretation = interpretationFromReport(report, tile);
    // CORRECTION-31 — the event is stamped with the tick the REPORT ARRIVED, not the tick
    // this derivation happens to run. Before this it was re-minted at `world.time.tick`
    // every tick, and because `makeEventId` embeds the tick, each pass created a NEW id
    // rather than refreshing one record. A report-linked record was therefore always age 0:
    // the 48-tick ring eviction could never reach it, and accessNorms' recency window never
    // expired it, so one report kept a friction record alive for as long as the report
    // lived — up to REPORT_MAX_AGE_TICKS = 160 (forty simulated years) at constant strength.
    // Stamping the receipt tick makes the id STABLE, so mergeEventRing refreshes the same
    // record in place and the record ages like every other kind of evidence.
    const eventTick = report.tickReceived;
    events.push({
      eventId: makeEventId(
        eventTick,
        observer.id,
        report.sourceBandId,
        report.targetTileId,
        interpretation,
        "unknown_activity",
      ),
      tick: eventTick,
      season: world.time.season,
      observerBandId: observer.id,
      otherBandId: report.sourceBandId,
      tileId: report.targetTileId,
      observerRangeTier: tier,
      otherActivityKind: "unknown_activity",
      relation,
      interpretation,
      tensionLevel: relation === "parent" || relation === "daughter" || relation === "sibling" ? "none" : "watchful",
      confidence: "reported_secondhand",
      recurrenceCount: countPriorRecurrence(
        observer.recentRangeFrictionEvents ?? [],
        report.sourceBandId,
        report.targetTileId,
        interpretation,
        world.time.tick,
      ) + 1,
      recentOverlapCount: 1,
      linkedReportId: report.reportId,
      noConflictChange: true,
      noMovementChange: true,
      noPopulationChange: true,
      noStressChange: true,
      noYieldChange: true,
      noTerritoryClaim: true,
      reasonIds: [
        makeReasonId(world, observer.id, report.sourceBandId, "secondhand_report_linked", report.targetTileId),
        ...report.reasonIds.slice(0, 2),
      ],
    });
  }

  return events.sort(compareEvents);
}

function isFrictionReport(report: WordOfMouthReport): boolean {
  return (
    report.topic === "crowded_range_warning" ||
    report.topic === "avoid_place" ||
    report.topic === "bad_water_warning"
  );
}

function interpretationFromReport(
  report: WordOfMouthReport,
  tile: Tile | undefined,
): RangeFrictionInterpretation {
  if (report.topic === "avoid_place" || report.topic === "bad_water_warning") {
    return "avoid_warning_remembered";
  }

  if (isWaterOrDeltaTile(tile)) {
    return "crowded_water_place";
  }

  return "uncertain_presence";
}

function deriveInterpretation(
  tier: RangeFrictionObserverRangeTier,
  activityKind: RangeFrictionOtherActivityKind,
  relation: RangeFrictionRelation,
  tile: Tile | undefined,
  recentOverlapCount: number,
): RangeFrictionInterpretation {
  if (isKinRelation(relation)) {
    return tier === "ford_or_crossing" ? "ford_overlap" : "tolerated_kin_presence";
  }

  if (tier === "ford_or_crossing" || activityKind === "crossing_or_route_use") {
    return "ford_overlap";
  }

  if (tier === "route_or_corridor") {
    return "route_overlap";
  }

  if (isWaterOrDeltaTile(tile) && recentOverlapCount >= 2) {
    return "crowded_water_place";
  }

  if (recentOverlapCount >= 3) {
    return "repeated_outsider_use";
  }

  if (tier === "camp_core" || tier === "water_core" || tier === "familiar_core") {
    return "possible_intrusion";
  }

  return relation === "familiar_neighbor" ? "noticed_shared_use" : "uncertain_presence";
}

function deriveTensionLevel(
  interpretation: RangeFrictionInterpretation,
  relation: RangeFrictionRelation,
  tier: RangeFrictionObserverRangeTier,
  recentOverlapCount: number,
): RangeFrictionTensionLevel {
  if (interpretation === "tolerated_kin_presence" || isKinRelation(relation)) {
    return "none";
  }

  if (
    interpretation === "repeated_outsider_use" &&
    recentOverlapCount >= 4 &&
    (tier === "camp_core" || tier === "water_core" || tier === "familiar_core")
  ) {
    return "moderate_placeholder";
  }

  if (
    interpretation === "possible_intrusion" ||
    interpretation === "crowded_water_place" ||
    interpretation === "repeated_outsider_use" ||
    interpretation === "avoid_warning_remembered"
  ) {
    return "mild";
  }

  return relation === "stranger_or_unrecognized" || relation === "weak_contact" ? "watchful" : "none";
}

function deriveCandidateBands(
  observer: Band,
  activeById: ReadonlyMap<BandId, Band>,
  childrenByParent: ReadonlyMap<BandId, readonly Band[]>,
  cache: TickContextCache,
): readonly Band[] {
  const candidates = new Map<BandId, Band>();
  const add = (bandId: BandId | undefined) => {
    if (bandId === undefined || bandId === observer.id || candidates.size >= RANGE_FRICTION_CANDIDATE_LIMIT) {
      return;
    }
    const band = activeById.get(bandId);
    if (band !== undefined) {
      candidates.set(band.id, band);
    }
  };

  for (const bandId of cache.nearbyBandsByBandId.get(observer.id) ?? []) {
    add(bandId);
  }
  add(observer.parentBandId);
  for (const daughterId of observer.daughterBandIds) {
    add(daughterId);
  }
  if (observer.parentBandId !== undefined) {
    for (const sibling of childrenByParent.get(observer.parentBandId) ?? []) {
      add(sibling.id);
    }
  }
  for (const bandId of Object.keys(observer.contactMemories).sort()) {
    add(bandId as BandId);
  }

  return [...candidates.values()].sort(compareBands);
}

function buildRangeMembership(band: Band, world: WorldState): RangeMembership {
  const summary = deriveFamiliarCountry(band, world.time.tick);
  const knownFords = deriveFordContext(band, world).knownFords;
  const fordTileIds: string[] = [];
  for (const ford of knownFords) {
    fordTileIds.push(String(ford.fromTileId), String(ford.toTileId));
  }

  return {
    summary,
    coreTiles: new Set(summary.coreTiles.map(String)),
    familiarTiles: new Set(summary.familiarTiles.map(String)),
    edgeTiles: new Set(summary.edgeTiles.map(String)),
    routeTiles: new Set(summary.corePlaces.routeCorridorTiles.map(String)),
    fordTiles: new Set(fordTileIds),
  };
}

function classifyRangeTier(
  membership: RangeMembership,
  tileId: TileId,
): RangeFrictionObserverRangeTier {
  const key = String(tileId);

  if (membership.summary.corePlaces.campCore === tileId) {
    return "camp_core";
  }
  if (membership.summary.corePlaces.waterCore === tileId) {
    return "water_core";
  }
  if (membership.fordTiles.has(key)) {
    return "ford_or_crossing";
  }
  if (membership.routeTiles.has(key)) {
    return "route_or_corridor";
  }
  if (membership.coreTiles.has(key)) {
    return "familiar_core";
  }
  if (membership.familiarTiles.has(key)) {
    return "familiar_country";
  }
  if (membership.edgeTiles.has(key)) {
    return "edge";
  }

  return "unknown_to_observer";
}

function deriveRelation(
  world: WorldState,
  observer: Band,
  other: Band,
): RangeFrictionRelation {
  if (observer.parentBandId === other.id) {
    return "parent";
  }
  if (observer.daughterBandIds.includes(other.id) || other.parentBandId === observer.id) {
    return "daughter";
  }
  if (
    observer.parentBandId !== undefined &&
    other.parentBandId !== undefined &&
    observer.parentBandId === other.parentBandId
  ) {
    return "sibling";
  }
  if (isLineageKin(world, observer, other)) {
    return "lineage_kin";
  }

  const contact = observer.contactMemories[other.id];
  if (contact !== undefined) {
    if (
      contact.familiarity >= 0.42 ||
      contact.sharedUseCount >= 2 ||
      contact.peacefulContactCount >= 2 ||
      contact.trustLikeTolerance >= 0.45
    ) {
      return "familiar_neighbor";
    }
    return "weak_contact";
  }

  return "stranger_or_unrecognized";
}

function isLineageKin(world: WorldState, left: Band, right: Band): boolean {
  return isAncestor(world, left.id, right) || isAncestor(world, right.id, left);
}

function isAncestor(world: WorldState, ancestorId: BandId, descendant: Band): boolean {
  let currentParentId = descendant.parentBandId;
  for (let depth = 0; depth < 8; depth += 1) {
    if (currentParentId === undefined) {
      return false;
    }
    if (currentParentId === ancestorId) {
      return true;
    }
    currentParentId = world.bands[currentParentId]?.parentBandId;
  }
  return false;
}

function relationFromReportTrust(report: WordOfMouthReport): RangeFrictionRelation {
  if (report.trustBasis === "parent") return "parent";
  if (report.trustBasis === "daughter") return "daughter";
  if (report.trustBasis === "sibling") return "sibling";
  if (report.trustBasis === "lineage_kin") return "lineage_kin";
  if (report.trustBasis === "familiar_neighbor" || report.trustBasis === "repeated_contact") {
    return "familiar_neighbor";
  }
  if (report.trustBasis === "shared_water" || report.trustBasis === "residential_proximity") {
    return "familiar_neighbor";
  }
  if (report.trustBasis === "range_friction") {
    return "weak_contact";
  }
  if (report.trustBasis === "weak_contact") {
    return "weak_contact";
  }
  return "stranger_or_unrecognized";
}

function buildChildrenByParent(activeBands: readonly Band[]): ReadonlyMap<BandId, readonly Band[]> {
  const children = new Map<BandId, readonly Band[]>();

  for (const band of activeBands) {
    if (band.parentBandId === undefined) {
      continue;
    }
    const existing = children.get(band.parentBandId) ?? [];
    children.set(band.parentBandId, [...existing, band].sort(compareBands));
  }

  return children;
}

// CORRECTION-30 — replaces `countRecentTripsInRange`, which read the OTHER band's private
// `recentIntraSeasonTrips` to inflate `recentOverlapCount` (and so drove
// `repeated_outsider_use` at >= 3 and `moderate_placeholder` tension at >= 4 off state the
// observer could not see). This counts the observer's OWN prior direct notices of this band
// inside its own country — "how many times have I recently seen them here" — so repeated
// legitimate observation still escalates, from the observer's own memory. Bounded by the
// 8-slot ring, so the value cannot exceed 1 + RANGE_FRICTION_RING_LIMIT.
function countObserverNoticesOfBand(
  observer: Band,
  otherBandId: BandId,
  currentTick: TickNumber,
): number {
  return (observer.recentRangeFrictionEvents ?? []).filter((event) => {
    const age = Number(currentTick) - Number(event.tick);
    return (
      age >= 0 &&
      age <= RANGE_FRICTION_MAX_AGE_TICKS &&
      event.otherBandId === otherBandId &&
      event.confidence === "observed"
    );
  }).length;
}

function countPriorRecurrence(
  previousEvents: readonly RangeFrictionEvent[],
  otherBandId: BandId,
  tileId: TileId,
  interpretation: RangeFrictionInterpretation,
  currentTick: TickNumber,
): number {
  return previousEvents.filter((event) => {
    const age = Number(currentTick) - Number(event.tick);
    return (
      age >= 0 &&
      age <= RANGE_FRICTION_MAX_AGE_TICKS &&
      event.otherBandId === otherBandId &&
      event.tileId === tileId &&
      event.interpretation === interpretation
    );
  }).length;
}

function mergeEventRing(
  previous: readonly RangeFrictionEvent[],
  fresh: readonly RangeFrictionEvent[],
  currentTick: TickNumber,
): readonly RangeFrictionEvent[] {
  const byId = new Map<string, RangeFrictionEvent>();

  for (const event of [...fresh, ...previous]) {
    const age = Number(currentTick) - Number(event.tick);
    if (age < 0 || age > RANGE_FRICTION_MAX_AGE_TICKS) {
      continue;
    }
    if (!byId.has(event.eventId)) {
      byId.set(event.eventId, event);
    }
  }

  return [...byId.values()].sort(compareEvents).slice(0, RANGE_FRICTION_RING_LIMIT);
}

function sameEventRing(
  left: readonly RangeFrictionEvent[],
  right: readonly RangeFrictionEvent[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((event, index) => event.eventId === right[index]?.eventId);
}

function isKinRelation(relation: RangeFrictionRelation): boolean {
  return (
    relation === "parent" ||
    relation === "daughter" ||
    relation === "sibling" ||
    relation === "lineage_kin"
  );
}

function isWaterOrDeltaTile(tile: Tile | undefined): boolean {
  return (
    tile !== undefined &&
    (tile.isAquatic ||
      tile.isRiver ||
      tile.isRiverbank === true ||
      tile.isFloodplain === true ||
      tile.isEstuary === true ||
      tile.isMarshChannel === true ||
      tile.terrainKind === "wetlands" ||
      tile.terrainKind === "river_valley" ||
      tile.terrainKind === "coast" ||
      tile.terrainKind === "lake")
  );
}

// CORRECTION-31 — takes the EVENT's tick rather than the world's. A direct observation is
// stamped now (so it is a new record each tick it recurs, which is what recurrence means);
// a report-linked record is stamped with the report's receipt tick, which makes its id
// stable so the ring refreshes one record instead of minting a fresh one every tick.
function makeEventId(
  eventTick: TickNumber,
  observerBandId: BandId,
  otherBandId: BandId,
  tileId: TileId | undefined,
  interpretation: RangeFrictionInterpretation,
  activityKind: RangeFrictionOtherActivityKind,
): string {
  return [
    "range-friction",
    Number(eventTick),
    String(observerBandId),
    String(otherBandId),
    tileId === undefined ? "untiled" : String(tileId),
    interpretation,
    activityKind,
  ].join(":");
}

function makeReasonId(
  world: WorldState,
  observerBandId: BandId,
  otherBandId: BandId,
  reason: string,
  tileId: TileId,
): ReasonId {
  return `reason:range-friction:${Number(world.time.tick)}:${observerBandId}:${otherBandId}:${reason}:${tileId}` as ReasonId;
}

function compareEvents(left: RangeFrictionEvent, right: RangeFrictionEvent): number {
  return (
    Number(right.tick) - Number(left.tick) ||
    compareTension(right.tensionLevel, left.tensionLevel) ||
    right.recentOverlapCount - left.recentOverlapCount ||
    String(left.otherBandId).localeCompare(String(right.otherBandId)) ||
    String(left.tileId ?? "").localeCompare(String(right.tileId ?? "")) ||
    left.eventId.localeCompare(right.eventId)
  );
}

function compareTension(left: RangeFrictionTensionLevel, right: RangeFrictionTensionLevel): number {
  return tensionRank(left) - tensionRank(right);
}

function tensionRank(tension: RangeFrictionTensionLevel): number {
  if (tension === "moderate_placeholder") return 3;
  if (tension === "mild") return 2;
  if (tension === "watchful") return 1;
  return 0;
}

function compareNotices(left: PairNotice, right: PairNotice): number {
  return (
    right.recentOverlapCount - left.recentOverlapCount ||
    confidenceRank(right.confidence) - confidenceRank(left.confidence) ||
    String(left.tileId).localeCompare(String(right.tileId)) ||
    left.activityKind.localeCompare(right.activityKind)
  );
}

function confidenceRank(confidence: RangeFrictionConfidence): number {
  if (confidence === "observed") return 3;
  if (confidence === "inferred_from_recent_activity") return 2;
  if (confidence === "reported_secondhand") return 1;
  return 0;
}

function compareBands(left: Band, right: Band): number {
  return String(left.id).localeCompare(String(right.id));
}
