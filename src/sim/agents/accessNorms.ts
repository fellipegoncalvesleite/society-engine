import type { BandId, ReasonId, TileId } from "../core/types";
import { getTile } from "../world/generate";
import type { Tile, WorldState } from "../world/types";
import { deriveFamiliarCountry } from "./familiarCountry";
import type {
  Band,
  ProtoAccessBehaviorEffectState,
  ProtoAccessEncounterTone,
  ProtoAccessMemory,
  ProtoAccessMemoryState,
  ProtoAccessPlaceType,
  ProtoAccessReason,
  ProtoAccessReasonFamily,
  ProtoAccessStateKind,
  ProtoCampPlaceMemory,
  RangeFrictionEvent,
  RangeFrictionRelation,
  WordOfMouthReport,
} from "./types";

const ACCESS_MEMORY_CAP = 8;
const MAX_CANDIDATE_TILE_IDS = 18;
const ACCESS_REASON_CAP = 6;
const FRICTION_RECENT_WINDOW_TICKS = 48;
const REPORT_RECENT_WINDOW_TICKS = 80;
const BEHAVIOR_HOOK_CAP = 0.08;

// CORRECTION-31 — the social-evidence lifecycle.
//
// Before this, a friction record either counted at FULL strength or not at all: the only age
// test in the whole chain was the binary `age <= FRICTION_RECENT_WINDOW_TICKS` below, and not
// one of the six functions that turn a record into pressure read `event.tick`. A group seen
// once governed a place for twelve simulated years and then vanished off a cliff — and because
// `confidence` counted retained records, the held evidence propped up the very confidence that
// would otherwise have let `staleness` mark it stale, so an episode could grow MORE severe
// after the other band left (AUDIT-27 C5).
//
// Evidence now has an age and a provenance, and its influence declines to nothing well before
// the record itself is evicted. The record, the contact memory and the place memory are all
// kept: release is behavioural, not amnesic.
//
// 1 tick = 1 season, 4 ticks = 1 year. The fresh window is the current annual round for every
// class, because seasonal dispersal and re-aggregation make the year the natural unit of
// "still current" (Mauss). The release horizons differ by how the episode felt and how it was
// learned; see docs/evidence/shared-range-release-lifecycle-31/ARCHITECTURE_DECISION.md §4.
const SOCIAL_EVIDENCE_FRESH_TICKS = 3;
const SOCIAL_EVIDENCE_RELEASE_TICKS_TOLERATED = 8;
const SOCIAL_EVIDENCE_RELEASE_TICKS_NEUTRAL = 12;
const SOCIAL_EVIDENCE_RELEASE_TICKS_TENSE = 16;
const SOCIAL_EVIDENCE_RELEASE_TICKS_REPORTED = 16;
// Hearsay is weaker per unit than a sighting but sticks around longer (Lewandowsky et al. on
// continued influence; Whallon on visiting as the information channel). Each relay step past
// the first degrades it further.
const REPORTED_EVIDENCE_WEIGHT_CAP = 0.7;
const REPORTED_EVIDENCE_HOP_PENALTY = 0.2;
// Below this an episode is historical: retained, inspectable, and behaviourally inert.
const SOCIAL_EVIDENCE_ACTIVE_MIN_WEIGHT = 0.05;
// The one contradiction channel this repository can support truthfully: the observer is
// standing at the place and the canonical proximity-only crowding scalar reads zero, so
// nobody is within DEFAULT_NEARBY_RADIUS. That is a real local observation and it makes an
// old sighting count as older. It proves nothing about where the other band went, and it is
// unavailable to a band that has not gone there (§10.6/§10.7).
const PRESENT_WITHOUT_OTHERS_AGE_BONUS_TICKS = 2;
const PRESENT_WITHOUT_OTHERS_SEASON_CAP = 8;

export function applyProtoAccessContext(world: WorldState): WorldState {
  const bands = Object.values(world.bands)
    .sort(compareBands)
    .reduce<Record<string, Band>>((bandsById, band) => {
      bandsById[String(band.id)] = {
        ...band,
        protoAccessMemory: advanceProtoAccessMemory(world, band),
      };

      return bandsById;
    }, {});

  return {
    ...world,
    bands: bands as Readonly<Record<BandId, Band>>,
  };
}

export function advanceProtoAccessMemory(world: WorldState, band: Band): ProtoAccessMemoryState {
  const prior = band.protoAccessMemory;
  const candidateIds = collectAccessCandidateTileIds(band);
  const memories = candidateIds
    .map((tileId) => deriveAccessMemory(world, band, tileId, prior?.places[tileId]))
    .filter((memory) => memory.accessState !== "none" || memory.tileId === band.position || memory.confidence >= 0.22)
    .sort(compareAccessMemories);
  const retained = retainBoundedAccessMemories(memories, band.position);
  const places = retained.reduce<Record<string, ProtoAccessMemory>>((records, memory) => {
    records[String(memory.tileId)] = memory;
    return records;
  }, {});
  const currentPlace = retained.find((memory) => memory.tileId === band.position);

  return {
    bandId: band.id,
    lastUpdatedTick: world.time.tick,
    currentPlace,
    topPlaces: retained,
    places: places as Readonly<Record<TileId, ProtoAccessMemory>>,
    memoryCap: ACCESS_MEMORY_CAP,
    candidateTileCap: MAX_CANDIDATE_TILE_IDS,
    reasonCap: ACCESS_REASON_CAP,
    droppedLowSalienceCount: Math.max(0, memories.length - retained.length) + (prior?.droppedLowSalienceCount ?? 0),
    behavior: deriveAccessBehavior(currentPlace),
    antiOmniscience: {
      derivedFromBandMemoryOnly: true,
      noHiddenMapTruth: true,
      noHiddenBandReaction: true,
    },
    reasonIds: uniqueReasonIds(retained.flatMap((memory) => memory.sourceReasonIds)).slice(0, 18),
  };
}

function collectAccessCandidateTileIds(band: Band): readonly TileId[] {
  const ids: TileId[] = [band.position];

  if (band.residentialAnchor?.anchorTileId !== undefined) {
    ids.push(band.residentialAnchor.anchorTileId);
  }
  if (band.residentialAnchor?.tetheringWaterTileId !== undefined) {
    ids.push(band.residentialAnchor.tetheringWaterTileId);
  }
  if (band.protoCampMemory?.currentPlace !== undefined) {
    ids.push(band.protoCampMemory.currentPlace.tileId);
  }
  for (const place of band.protoCampMemory?.topPlaces ?? []) {
    ids.push(place.tileId);
  }
  for (const place of band.protoAccessMemory?.topPlaces ?? []) {
    ids.push(place.tileId);
  }
  for (const place of Object.values(band.placeMemory)
    .filter((entry) => entry.isReturnPlace || entry.repeatedReturnCount >= 2 || entry.attachment >= 0.32)
    .sort(comparePlaceMemories)
    .slice(0, 8)) {
    ids.push(place.tileId);
  }
  for (const memory of Object.values(band.anchorMemories ?? {})
    .sort((left, right) => right.anchoredSeasonCount - left.anchoredSeasonCount || String(left.tileId).localeCompare(String(right.tileId)))
    .slice(0, 6)) {
    ids.push(memory.tileId);
    if (memory.tetheringWaterTileId !== undefined) {
      ids.push(memory.tetheringWaterTileId);
    }
  }
  for (const crossing of Object.values(band.crossingMemories).slice(0, 6)) {
    ids.push(crossing.crossingTileA, crossing.crossingTileB);
  }
  for (const event of band.recentRangeFrictionEvents ?? []) {
    if (event.tileId !== undefined) {
      ids.push(event.tileId);
    }
  }
  for (const report of band.reportedKnowledge?.reports ?? []) {
    if (isAccessSensitiveReport(report) && report.targetTileId !== undefined) {
      ids.push(report.targetTileId);
    }
  }
  for (const move of band.recentResidentialMoveEvents?.slice(0, 4) ?? []) {
    ids.push(move.fromTileId, move.toTileId);
    if (move.temporaryWatercraft?.sourceTileId !== undefined) {
      ids.push(move.temporaryWatercraft.sourceTileId);
    }
    if (move.temporaryWatercraft?.targetTileId !== undefined) {
      ids.push(move.temporaryWatercraft.targetTileId);
    }
  }
  for (const card of band.resourceEcology?.storageSuitabilityCards ?? []) {
    for (const tileId of card.sourceTileIds.slice(0, 2)) {
      ids.push(tileId);
    }
  }

  return uniqueTileIds(ids).slice(0, MAX_CANDIDATE_TILE_IDS);
}

function deriveAccessMemory(
  world: WorldState,
  band: Band,
  tileId: TileId,
  prior: ProtoAccessMemory | undefined,
): ProtoAccessMemory {
  const tile = getTile(world, tileId);
  const current = tileId === band.position;
  const place = band.placeMemory[tileId];
  const anchor = band.anchorMemories?.[tileId];
  const proto = band.protoCampMemory?.places[tileId];
  const range = deriveFamiliarCountry(band, world.time.tick);
  // CORRECTION-31 — the one legitimate contradiction channel. `nearbyBandPressure` is the
  // post-CORRECTION-28 proximity-only crowding scalar, so zero means no band within
  // DEFAULT_NEARBY_RADIUS of where this band is standing. Counted only while the band is
  // actually AT the place; a band that has not gone there learns nothing (§10.7). Bounded.
  const presentWithoutOthers = current && (band.pressureState?.nearbyBandPressure ?? 0) === 0;
  const presentWithoutOthersSeasons = presentWithoutOthers
    ? Math.min(PRESENT_WITHOUT_OTHERS_SEASON_CAP, (prior?.presentWithoutOthersSeasons ?? 0) + 1)
    : 0;
  const friction = collectTileFrictionEvidence(world, band, tileId, presentWithoutOthersSeasons);
  const reports = collectTileReports(world, band, tileId);
  const activeEvidence = friction.filter((entry) => entry.weight >= SOCIAL_EVIDENCE_ACTIVE_MIN_WEIGHT);
  const activeEvidenceWeight = round2(friction.reduce((max, entry) => Math.max(max, entry.weight), 0));
  // CORRECTION-31 — several relayed copies of one story are one piece of evidence with
  // several voices. Reports are counted by ORIGINAL episode and weighted by their own
  // freshness, never by `.length` (§10.9).
  const reportEpisodes = weighReportEpisodes(reports);
  const storageSignals = collectStorageSignals(world, band, tileId, tile);
  const visibleSignals = collectVisibleSignals(world, band, tileId, tile);
  const crossingSignal = getCrossingSignal(band, tileId);

  const repeatedReturnStrength = round2(clamp01(
    Math.min(1, (place?.repeatedReturnCount ?? 0) / 4) * 0.34 +
      Math.min(1, (proto?.visitCount ?? 0) / 8) * 0.34 +
      Math.min(1, (anchor?.anchoredSeasonCount ?? 0) / 6) * 0.2 +
      (place?.isReturnPlace === true ? 0.12 : 0),
  ));
  const familiarUseStrength = round2(clamp01(
    (place?.attachment ?? 0) * 0.34 +
      (place?.confidence ?? 0) * 0.2 +
      repeatedReturnStrength * 0.28 +
      (range.coreTiles.includes(tileId) ? 0.18 : range.familiarTiles.includes(tileId) ? 0.1 : 0),
  ));
  const waterImportance = getWaterImportance(tile, place, anchor, proto);
  const placeImportance = round2(clamp01(
    waterImportance * 0.24 +
      (proto?.campLikeScore ?? 0) * 0.28 +
      (proto?.storageProcessingScore ?? 0) * 0.18 +
      (proto?.crossingUseScore ?? 0) * 0.18 +
      storageSignals.importance * 0.16 +
      crossingSignal.importance * 0.18 +
      visibleSignals.importance * 0.12 +
      (place?.valences.includes("return_place") === true ? 0.08 : 0),
  ));
  const kinTolerance = round2(clamp01(
    strongestFrictionRelation(friction, (relation) => isKinRelation(relation)) * 0.46 +
      Math.max(0, proto?.knownKinContactNearby ?? 0) * 0.24 +
      bestContactTolerance(band, friction, true) * 0.22 +
      cooperationFromFriction(friction) * 0.12,
  ));
  const familiarTolerance = round2(clamp01(
    strongestFrictionRelation(friction, (relation) => relation === "familiar_neighbor") * 0.36 +
      bestContactTolerance(band, friction, false) * 0.28 +
      cooperationFromFriction(friction) * 0.18 +
      weighedReportTopics(reportEpisodes, (report) => report.trustBasis === "familiar_neighbor" || report.trustBasis === "repeated_contact") * 0.06,
  ));
  const strangerCaution = round2(clamp01(
    strongestFrictionRelation(friction, (relation) => relation === "stranger_or_unrecognized" || relation === "weak_contact") * 0.38 +
      weighedReportTopics(reportEpisodes, (report) => report.topic === "outsider_use_warning" || report.sourceBasis === "unknown_band_nearby") * 0.12 +
      (placeImportance >= 0.45 ? tensionFromFriction(friction) * 0.22 : tensionFromFriction(friction) * 0.12) +
      weighedReportFlag(reportEpisodes, (report) => report.topic === "bad_water_warning" || report.topic === "avoid_place") * 0.12,
  ));
  const sharedUsePressure = round2(clamp01(
    friction.reduce((max, entry) => Math.max(max, eventPressure(entry)), 0) * 0.42 +
      (current ? band.pressureState?.nearbyBandPressure ?? 0 : 0) * 0.22 +
      (proto?.socialCrowdingPressureNearby ?? 0) * 0.26 +
      weighedReportTopics(reportEpisodes, (report) => report.topic === "crowded_water_warning" || report.topic === "crowded_range_warning") * 0.08,
  ));
  const crowdingResourcePressure = round2(clamp01(
    (band.usePressure[tileId]?.recentUseIntensity ?? 0) * 0.28 +
      (proto?.ecologicalPressure ?? 0) * 0.28 +
      visibleSignals.pressure * 0.22 +
      storageSignals.pressure * 0.1 +
      sharedUsePressure * 0.18,
  ));
  // NOTE — the last two terms are deliberately NOT weighted by the social lifecycle. A place
  // valenced `avoid_place`/`risky` and a death memory nearby are the band's own non-social
  // reasons to be careful, and they must not release because another band left (§10.12, P15).
  const rememberedRefusalAvoidance = round2(clamp01(
    avoidanceFromFriction(friction) * 0.46 +
      weighedReportFlag(reportEpisodes, (report) => report.topic === "avoid_place" || report.topic === "bad_water_warning") * 0.18 +
      (place?.valences.includes("avoid_place") === true || place?.valences.includes("risky") === true ? 0.14 : 0) +
      (proto?.deathMemoryNearby ?? 0) * 0.18,
  ));
  const rememberedCooperationTolerance = round2(clamp01(
    cooperationFromFriction(friction) * 0.32 +
      kinTolerance * 0.22 +
      familiarTolerance * 0.18 +
      Math.max(0, ...Object.values(band.contactMemories).map((contact) => Math.min(0.14, contact.peacefulContactCount * 0.025 + contact.sharedUseCount * 0.02))),
  ));
  const placeSensitivity = round2(clamp01(
    placeImportance * 0.42 +
      strangerCaution * 0.24 +
      sharedUsePressure * 0.18 +
      rememberedRefusalAvoidance * 0.18 +
      crowdingResourcePressure * 0.14,
  ));
  const staleYears = getAccessStaleYears(world, current, prior, place, proto, friction, reports);
  const staleness = round2(clamp01(staleYears / 12));
  // CORRECTION-31 — confidence counts ACTIVE evidence and weighted report episodes, not
  // retained record counts. Before this, held records propped up the very confidence that
  // `classifyAccessState` needs to fall below 0.36 before `staleness` can mark the memory
  // stale — so old evidence defended itself and the memory could never go stale while it sat
  // in the ring.
  const confidence = round2(clamp01(
    (place?.confidence ?? 0) * 0.18 +
      (proto?.confidence ?? 0) * 0.22 +
      familiarUseStrength * 0.16 +
      Math.min(1, activeEvidence.length / 3) * 0.16 +
      Math.min(1, reportEpisodes.reduce((sum, entry) => sum + entry.weight, 0) / 3) * 0.1 +
      storageSignals.confidence * 0.08 +
      visibleSignals.confidence * 0.06 +
      (current ? 0.08 : 0) -
      staleness * 0.14,
  ));
  const placeType = classifyAccessPlaceType(tile, proto, storageSignals, visibleSignals, crossingSignal, waterImportance);
  const recentEncounterTone = classifyEncounterTone({
    kinTolerance,
    familiarTolerance,
    strangerCaution,
    sharedUsePressure,
    rememberedRefusalAvoidance,
    rememberedCooperationTolerance,
    staleness,
  });
  const accessState = classifyAccessState({
    confidence,
    staleness,
    placeImportance,
    placeSensitivity,
    familiarUseStrength,
    repeatedReturnStrength,
    kinTolerance,
    familiarTolerance,
    strangerCaution,
    sharedUsePressure,
    crowdingResourcePressure,
    rememberedRefusalAvoidance,
    rememberedCooperationTolerance,
  });
  const positiveReasons = buildPositiveReasons({
    repeatedReturnStrength,
    familiarUseStrength,
    kinTolerance,
    familiarTolerance,
    rememberedCooperationTolerance,
    placeImportance,
    storageSignals,
    crossingSignal,
    proto,
  });
  const negativeReasons = buildNegativeReasons({
    strangerCaution,
    sharedUsePressure,
    crowdingResourcePressure,
    rememberedRefusalAvoidance,
    placeSensitivity,
    staleness,
    storageSignals,
    crossingSignal,
    proto,
    reports,
  });

  return {
    tileId,
    bandId: band.id,
    placeType,
    accessState,
    accessImportance: placeImportance,
    placeSensitivity,
    familiarUseStrength,
    repeatedReturnStrength,
    kinTolerance,
    familiarTolerance,
    strangerCaution,
    sharedUsePressure,
    crowdingResourcePressure,
    recentEncounterTone,
    rememberedRefusalAvoidance,
    rememberedCooperationTolerance,
    confidence,
    staleness,
    staleYears,
    // CORRECTION-31 — the lifecycle, DERIVED not stored. `activeEvidenceWeight` is how much
    // the strongest surviving episode still counts; `historicalEvidenceCount` is how many
    // records the band still holds that no longer move anything. Together they are the
    // active/historical separation §8.3-§8.4 asks for, without a second store.
    activeEvidenceWeight,
    activeEvidenceCount: activeEvidence.length,
    historicalEvidenceCount: friction.length - activeEvidence.length,
    socialEvidencePhase:
      friction.length === 0
        ? "none"
        : activeEvidence.length === 0
          ? "released_historical"
          : activeEvidenceWeight >= 1
            ? "active"
            : "cooling",
    presentWithoutOthersSeasons,
    positiveReasons,
    negativeReasons,
    topReasons: [
      ...positiveReasons.slice(0, 3).map((reason) => `+ ${reason.reason}`),
      ...negativeReasons.slice(0, 3).map((reason) => `- ${reason.reason}`),
    ].slice(0, ACCESS_REASON_CAP),
    sourceReasonIds: uniqueReasonIds([
      ...(place?.reasonIds ?? []),
      ...(proto?.reasonIds ?? []),
      ...friction.flatMap((entry) => entry.event.reasonIds),
      ...reports.flatMap((report) => report.reasonIds),
      ...storageSignals.reasonIds,
      ...visibleSignals.reasonIds,
      ...crossingSignal.reasonIds,
    ]).slice(0, 14),
    antiOmniscience: {
      fromBandKnownPlaceMemory: place !== undefined || proto !== undefined || current,
      fromObservedSocialEvidenceOnly: friction.length > 0 || reports.length > 0 || kinTolerance === 0 || strangerCaution === 0,
      noHiddenBands: true,
      noHiddenResources: true,
      noFixedAccessRule: true,
    },
  };
}

function deriveAccessBehavior(memory: ProtoAccessMemory | undefined): ProtoAccessBehaviorEffectState {
  if (
    memory === undefined ||
    memory.accessState === "none" ||
    memory.accessState === "stale_access_memory"
  ) {
    return emptyAccessBehavior(memory?.tileId);
  }

  const sensitivePlaceCautionBias = round2(Math.min(
    BEHAVIOR_HOOK_CAP,
    memory.strangerCaution * 0.1 + memory.placeSensitivity * 0.04 + memory.rememberedRefusalAvoidance * 0.04,
  ));
  const toleranceReductionBias = memory.accessState === "crowded_use" ||
    memory.accessState === "contested_use" ||
    memory.accessState === "sensitive_place"
    ? round2(Math.min(BEHAVIOR_HOOK_CAP, memory.sharedUsePressure * 0.11 + memory.crowdingResourcePressure * 0.08))
    : 0;
  const kinToleranceReliefBias = memory.accessState === "kin_tolerated"
    ? round2(Math.min(BEHAVIOR_HOOK_CAP, memory.kinTolerance * 0.1 + memory.rememberedCooperationTolerance * 0.04))
    : 0;
  const contestedAvoidanceBias = memory.accessState === "contested_use" || memory.accessState === "avoided_shared_use"
    ? round2(Math.min(BEHAVIOR_HOOK_CAP, memory.rememberedRefusalAvoidance * 0.1 + memory.sharedUsePressure * 0.06))
    : 0;
  const supportSeekingHesitationBias = memory.placeSensitivity >= 0.45 && memory.sharedUsePressure >= 0.35
    ? round2(Math.min(BEHAVIOR_HOOK_CAP, memory.sharedUsePressure * 0.08 + memory.strangerCaution * 0.04))
    : 0;
  const expectedReturnBias = memory.accessState === "expected_return" || memory.accessState === "familiar_use"
    ? round2(Math.min(BEHAVIOR_HOOK_CAP, memory.repeatedReturnStrength * 0.08 + memory.familiarUseStrength * 0.05 - memory.sharedUsePressure * 0.04))
    : 0;
  const maxBehaviorHook = Math.max(
    sensitivePlaceCautionBias,
    toleranceReductionBias,
    kinToleranceReliefBias,
    contestedAvoidanceBias,
    supportSeekingHesitationBias,
    expectedReturnBias,
  );

  return {
    currentTileId: memory.tileId,
    sensitivePlaceCautionBias,
    toleranceReductionBias,
    kinToleranceReliefBias,
    contestedAvoidanceBias,
    supportSeekingHesitationBias,
    expectedReturnBias,
    maxBehaviorHook: round2(maxBehaviorHook),
    topBehaviorReasons: memory.topReasons.slice(0, 4),
    reversible: true,
    noConflict: true,
    noExpulsion: true,
    noFixedBorders: true,
    noProperty: true,
    noLaw: true,
    noWar: true,
  };
}

function emptyAccessBehavior(tileId?: TileId): ProtoAccessBehaviorEffectState {
  return {
    currentTileId: tileId,
    sensitivePlaceCautionBias: 0,
    toleranceReductionBias: 0,
    kinToleranceReliefBias: 0,
    contestedAvoidanceBias: 0,
    supportSeekingHesitationBias: 0,
    expectedReturnBias: 0,
    maxBehaviorHook: 0,
    topBehaviorReasons: [],
    reversible: true,
    noConflict: true,
    noExpulsion: true,
    noFixedBorders: true,
    noProperty: true,
    noLaw: true,
    noWar: true,
  };
}

// CORRECTION-31 — a friction record together with how much it still counts.
export interface WeightedSocialEvidence {
  readonly event: RangeFrictionEvent;
  readonly ageTicks: number;
  readonly weight: number;
}

/** How long an episode of this kind keeps any behavioural influence at all. */
function socialEvidenceReleaseTicks(event: RangeFrictionEvent): number {
  if (event.confidence === "reported_secondhand") {
    return SOCIAL_EVIDENCE_RELEASE_TICKS_REPORTED;
  }
  if (
    isKinRelation(event.relation) ||
    event.interpretation === "tolerated_kin_presence" ||
    event.interpretation === "noticed_shared_use"
  ) {
    return SOCIAL_EVIDENCE_RELEASE_TICKS_TOLERATED;
  }
  if (
    (event.tensionLevel === "mild" || event.tensionLevel === "moderate_placeholder") &&
    (event.relation === "stranger_or_unrecognized" || event.relation === "weak_contact")
  ) {
    return SOCIAL_EVIDENCE_RELEASE_TICKS_TENSE;
  }
  return SOCIAL_EVIDENCE_RELEASE_TICKS_NEUTRAL;
}

/** Full inside the current annual round, then a straight decline to nothing. */
function socialEvidenceAgeWeight(ageTicks: number, releaseTicks: number): number {
  if (ageTicks < 0) {
    // A record stamped in the future is not evidence. Guards the negative-age case §22 asks for.
    return 0;
  }
  if (ageTicks <= SOCIAL_EVIDENCE_FRESH_TICKS) {
    return 1;
  }
  if (ageTicks >= releaseTicks) {
    return 0;
  }
  return clamp01((releaseTicks - ageTicks) / (releaseTicks - SOCIAL_EVIDENCE_FRESH_TICKS));
}

function weighSocialEvidence(
  world: WorldState,
  band: Band,
  event: RangeFrictionEvent,
  presentWithoutOthersSeasons: number,
): WeightedSocialEvidence {
  const rawAge = Number(world.time.tick) - Number(event.tick);
  // Being at the place and seeing nobody makes an old sighting count as older. Bounded, and
  // available only to a band that actually went there.
  const contradictionBonus = Math.min(
    PRESENT_WITHOUT_OTHERS_SEASON_CAP,
    presentWithoutOthersSeasons,
  ) * PRESENT_WITHOUT_OTHERS_AGE_BONUS_TICKS;
  const ageTicks = rawAge < 0 ? rawAge : rawAge + contradictionBonus;
  let weight = socialEvidenceAgeWeight(ageTicks, socialEvidenceReleaseTicks(event));

  if (event.confidence === "reported_secondhand") {
    const report = (band.reportedKnowledge?.reports ?? []).find(
      (entry) => entry.reportId === event.linkedReportId,
    );
    const hops = report?.hops ?? 1;
    const hopFactor = clamp01(1 - REPORTED_EVIDENCE_HOP_PENALTY * Math.max(0, hops - 1));
    // The report's own decay is wired in rather than given a second invented clock. When the
    // report has already left the ring, the age curve alone carries it out.
    const freshness = report === undefined ? 1 : clamp01(report.freshness);
    weight = weight * REPORTED_EVIDENCE_WEIGHT_CAP * hopFactor * freshness;
  }

  return { event, ageTicks: rawAge, weight: round2(clamp01(weight)) };
}

/**
 * CORRECTION-31 — is this episode still current enough to act on, or to pass on as news?
 *
 * Exported for `reportedKnowledge.ts`, which republishes a band's friction as outgoing
 * warnings. Without this, a released belief kept being broadcast as though it were current.
 * Pure: takes the band's own state and the tick, reads no other band and no hidden truth.
 * The contradiction bonus is deliberately NOT applied here — that is per-place state, and
 * this predicate answers the weaker, place-independent question "has this aged out?".
 */
export function isSocialEvidenceActive(
  world: WorldState,
  band: Band,
  event: RangeFrictionEvent,
): boolean {
  return weighSocialEvidence(world, band, event, 0).weight >= SOCIAL_EVIDENCE_ACTIVE_MIN_WEIGHT;
}

function collectTileFrictionEvidence(
  world: WorldState,
  band: Band,
  tileId: TileId,
  presentWithoutOthersSeasons: number,
): readonly WeightedSocialEvidence[] {
  return (band.recentRangeFrictionEvents ?? [])
    .filter((event) =>
      event.tileId === tileId &&
      Number(world.time.tick) - Number(event.tick) <= FRICTION_RECENT_WINDOW_TICKS,
    )
    .map((event) => weighSocialEvidence(world, band, event, presentWithoutOthersSeasons))
    .sort(compareWeightedEvidence)
    .slice(0, 6);
}

function collectTileReports(
  world: WorldState,
  band: Band,
  tileId: TileId,
): readonly WordOfMouthReport[] {
  return (band.reportedKnowledge?.reports ?? [])
    .filter((report) =>
      report.targetTileId === tileId &&
      isAccessSensitiveReport(report) &&
      Number(world.time.tick) - Number(report.tickReceived) <= REPORT_RECENT_WINDOW_TICKS,
    )
    .sort((left, right) => Number(right.tickReceived) - Number(left.tickReceived) || String(left.reportId).localeCompare(String(right.reportId)))
    .slice(0, 5);
}

// CORRECTION-31 — one entry per ORIGINAL episode, weighted by that episode's freshness and
// degraded by relay depth. Before this, every access scalar counted reports with `.length`,
// so five relayed copies of one warning were five times as loud as the story deserved.
// `originalObserverBandId` survives relay (reportedKnowledge.ts:1027), which is what makes
// "same episode" answerable at all; two reports with DIFFERENT original observers are
// genuinely independent and do reinforce each other.
interface WeightedReportEpisode {
  readonly report: WordOfMouthReport;
  readonly weight: number;
}

function weighReportEpisodes(reports: readonly WordOfMouthReport[]): readonly WeightedReportEpisode[] {
  const byEpisode = new Map<string, WeightedReportEpisode>();
  for (const report of reports) {
    const key = [
      String(report.originalObserverBandId ?? report.sourceBandId),
      String(report.topic),
      String(report.targetTileId ?? "untiled"),
    ].join("|");
    const hopFactor = clamp01(1 - REPORTED_EVIDENCE_HOP_PENALTY * Math.max(0, report.hops - 1));
    const weight = round2(clamp01(report.freshness) * hopFactor);
    const existing = byEpisode.get(key);
    // Keep the strongest single voice for an episode, never the sum of its echoes.
    if (existing === undefined || weight > existing.weight) {
      byEpisode.set(key, { report, weight });
    }
  }
  return [...byEpisode.values()].sort(
    (left, right) => right.weight - left.weight || String(left.report.reportId).localeCompare(String(right.report.reportId)),
  );
}

/** Summed weight of the distinct episodes matching a predicate — the old `.length` term. */
function weighedReportTopics(
  episodes: readonly WeightedReportEpisode[],
  predicate: (report: WordOfMouthReport) => boolean,
): number {
  return episodes.reduce((sum, entry) => (predicate(entry.report) ? sum + entry.weight : sum), 0);
}

/** Strongest single episode matching a predicate — the old `.some() ? 1 : 0` term. */
function weighedReportFlag(
  episodes: readonly WeightedReportEpisode[],
  predicate: (report: WordOfMouthReport) => boolean,
): number {
  return episodes.reduce((max, entry) => (predicate(entry.report) ? Math.max(max, entry.weight) : max), 0);
}

function isAccessSensitiveReport(report: WordOfMouthReport): boolean {
  return (
    report.topic === "bad_water_warning" ||
    report.topic === "crowded_range_warning" ||
    report.topic === "crowded_water_warning" ||
    report.topic === "outsider_use_warning" ||
    report.topic === "ford_or_crossing" ||
    report.topic === "ford_or_crossing_known" ||
    report.topic === "good_camp_region" ||
    report.topic === "return_to_known_place" ||
    report.topic === "avoid_place"
  );
}

function collectStorageSignals(
  world: WorldState,
  band: Band,
  tileId: TileId,
  tile: Tile | undefined,
): {
  readonly importance: number;
  readonly pressure: number;
  readonly confidence: number;
  readonly bestLabel?: string;
  readonly hasProcessingPlace: boolean;
  readonly hasCrossingMaterial: boolean;
  readonly reasonIds: readonly ReasonId[];
} {
  let importance = 0;
  let pressure = 0;
  let confidence = 0;
  let bestLabel: string | undefined;
  let hasProcessingPlace = false;
  let hasCrossingMaterial = false;
  const reasonIds: string[] = [];

  for (const card of (band.resourceEcology?.storageSuitabilityCards ?? [])
    .filter((entry) => entry.sourceTileIds.length === 0 || entry.sourceTileIds.some((sourceTileId) => isNearTile(world, tile, sourceTileId, 2)))
    .slice(0, 6)) {
    reasonIds.push(...card.sourceIds.map((sourceId) => `reason:access-storage:${sourceId}`));
    const cardImportance =
      (card.seasonalBufferValue === "high" ? 0.18 : card.seasonalBufferValue === "medium" ? 0.1 : 0) +
      (card.storageSuitability === "excellent" || card.storageSuitability === "good" ? 0.12 : 0) +
      (card.protoCampRelevance === "processing_place" || card.protoCampRelevance === "cache_place" ? 0.12 : 0);
    if (cardImportance > importance) {
      bestLabel = card.label;
    }
    importance = Math.max(importance, cardImportance);
    pressure = Math.max(pressure, card.spoilageRisk === "high" || card.carryBurden === "high" || card.processingLabor === "high" ? 0.34 : 0);
    confidence = Math.max(confidence, card.storageConfidence);
    hasProcessingPlace = hasProcessingPlace || card.protoCampRelevance === "processing_place" || card.protoCampRelevance === "cache_place";
    hasCrossingMaterial = hasCrossingMaterial || card.crossingMaterialUse !== "none";
  }

  return {
    importance: round2(clamp01(importance)),
    pressure: round2(clamp01(pressure)),
    confidence: round2(clamp01(confidence)),
    bestLabel,
    hasProcessingPlace,
    hasCrossingMaterial,
    reasonIds: uniqueReasonIds(reasonIds.map((reason) => reason as ReasonId)).slice(0, 6),
  };
}

function collectVisibleSignals(
  world: WorldState,
  band: Band,
  tileId: TileId,
  tile: Tile | undefined,
): {
  readonly importance: number;
  readonly pressure: number;
  readonly confidence: number;
  readonly plant: boolean;
  readonly aquatic: boolean;
  readonly fauna: boolean;
  readonly forest: boolean;
  readonly reasonIds: readonly ReasonId[];
} {
  let importance = 0;
  let pressure = 0;
  let confidence = 0;
  let plant = false;
  let aquatic = false;
  let fauna = false;
  let forest = false;
  const reasonIds: string[] = [];

  for (const card of (band.visibleNature?.plantCards ?? []).filter((entry) => isNearTile(world, tile, entry.tileId, 2)).slice(0, 3)) {
    plant = true;
    importance = Math.max(importance, card.plantPatchEffect === "seasonal_pulse" || card.reliability >= 0.5 ? 0.3 : 0.18);
    pressure = Math.max(pressure, card.pressure, card.depletion);
    confidence = Math.max(confidence, card.confidence);
    reasonIds.push(`reason:access-visible-plant:${card.patchId}`);
  }
  for (const card of (band.visibleNature?.aquaticCards ?? []).filter((entry) => isCardNearTile(world, tile, entry.anchorTileId, entry.seenTileIds, 2)).slice(0, 3)) {
    aquatic = true;
    importance = Math.max(importance, card.reliability >= 0.5 || card.aquaticEffect === "wetland_buffer" || card.aquaticEffect === "winter_buffer" ? 0.34 : 0.2);
    pressure = Math.max(pressure, card.pressure, card.riskDifficulty * 0.7);
    confidence = Math.max(confidence, card.confidence);
    reasonIds.push(`reason:access-visible-aquatic:${card.stockId}`);
  }
  for (const card of (band.visibleNature?.faunaCards ?? []).filter((entry) => isCardNearTile(world, tile, entry.anchorTileId, entry.seenTileIds, 3)).slice(0, 3)) {
    fauna = true;
    importance = Math.max(importance, card.routeReliability >= 0.5 || card.usefulness === "high_value" ? 0.26 : 0.14);
    pressure = Math.max(pressure, card.huntingOrFishingPressure, card.wariness);
    confidence = Math.max(confidence, card.confidence);
    reasonIds.push(`reason:access-visible-fauna:${card.stockId}`);
  }
  for (const card of (band.visibleNature?.forestCards ?? []).filter((entry) => isNearTile(world, tile, entry.tileId, 2)).slice(0, 3)) {
    forest = true;
    importance = Math.max(importance, Math.max(card.shadeRefugeValue, card.woodFuelMaterialHook) >= 0.35 ? 0.26 : 0.14);
    pressure = Math.max(pressure, card.pressure, card.diebackTrend);
    confidence = Math.max(confidence, card.confidence);
    reasonIds.push(`reason:access-visible-forest:${card.patchId}`);
  }

  return {
    importance: round2(clamp01(importance)),
    pressure: round2(clamp01(pressure)),
    confidence: round2(clamp01(confidence)),
    plant,
    aquatic,
    fauna,
    forest,
    reasonIds: uniqueReasonIds(reasonIds.map((reason) => reason as ReasonId)).slice(0, 8),
  };
}

function getCrossingSignal(
  band: Band,
  tileId: TileId,
): {
  readonly importance: number;
  readonly risk: number;
  readonly known: boolean;
  readonly reasonIds: readonly ReasonId[];
} {
  let importance = 0;
  let risk = 0;
  let known = false;
  const reasonIds: ReasonId[] = [];

  for (const crossing of Object.values(band.crossingMemories).slice(0, 8)) {
    if (crossing.crossingTileA !== tileId && crossing.crossingTileB !== tileId) {
      continue;
    }
    known = true;
    importance = Math.max(importance, 0.24 + crossing.successConfidence * 0.18 + crossing.seasonalReliability * 0.12);
    risk = Math.max(risk, crossing.riskMemory);
    reasonIds.push(...crossing.reasonIds);
  }

  for (const move of band.recentResidentialMoveEvents?.slice(0, 6) ?? []) {
    const craft = move.temporaryWatercraft;
    if (
      craft === undefined ||
      (
        move.fromTileId !== tileId &&
        move.toTileId !== tileId &&
        craft.sourceTileId !== tileId &&
        craft.targetTileId !== tileId
      )
    ) {
      continue;
    }
    known = true;
    importance = Math.max(importance, 0.22 + craft.materialConfidence * 0.16);
    risk = Math.max(risk, craft.riverRisk);
    reasonIds.push(...craft.reasonIds);
  }

  return {
    importance: round2(clamp01(importance)),
    risk: round2(clamp01(risk)),
    known,
    reasonIds: uniqueReasonIds(reasonIds).slice(0, 8),
  };
}

function classifyAccessPlaceType(
  tile: Tile | undefined,
  proto: ProtoCampPlaceMemory | undefined,
  storageSignals: ReturnType<typeof collectStorageSignals>,
  visibleSignals: ReturnType<typeof collectVisibleSignals>,
  crossingSignal: ReturnType<typeof getCrossingSignal>,
  waterImportance: number,
): ProtoAccessPlaceType {
  if (proto?.campLikeState === "crossing_camp" || proto?.crossingUseScore !== undefined && proto.crossingUseScore >= 0.08 || crossingSignal.known) {
    return "ford_crossing";
  }
  if (proto?.campLikeState === "storage_processing_candidate" || storageSignals.hasProcessingPlace) {
    return "storage_processing_candidate";
  }
  if (proto?.campLikeState === "activity_base") {
    return "activity_base";
  }
  if (proto?.campLikeState === "refuge_anchor" || proto?.seasonalIdentity === "dry_refuge_return") {
    return "dry_refuge";
  }
  if (proto?.campLikeState === "seasonal_return_place") {
    return "seasonal_return_place";
  }
  if (proto?.campLikeState === "persistent_camp_candidate" || proto?.campLikeState === "repeated_stop") {
    return "persistent_camp";
  }
  if (visibleSignals.aquatic || tile?.terrainKind === "wetlands" || tile?.terrainKind === "lake" || tile?.terrainKind === "coast") {
    return "wetland_fish_place";
  }
  if (visibleSignals.plant) {
    return "plant_patch";
  }
  if (visibleSignals.fauna) {
    return "hunting_route";
  }
  if (visibleSignals.forest || tile?.terrainKind === "forest") {
    return "forest_refuge";
  }
  if (waterImportance >= 0.34 || (tile?.resourceProfile.waterAccess ?? 0) >= 0.56) {
    return "water_source";
  }
  return "activity_base";
}

function classifyEncounterTone(input: {
  readonly kinTolerance: number;
  readonly familiarTolerance: number;
  readonly strangerCaution: number;
  readonly sharedUsePressure: number;
  readonly rememberedRefusalAvoidance: number;
  readonly rememberedCooperationTolerance: number;
  readonly staleness: number;
}): ProtoAccessEncounterTone {
  if (input.staleness >= 0.62) {
    return "stale_uncertain";
  }
  if (input.rememberedRefusalAvoidance >= 0.34) {
    return "avoidance_remembered";
  }
  if (input.strangerCaution >= 0.34) {
    return "stranger_watchful";
  }
  if (input.sharedUsePressure >= 0.38) {
    return "crowded_shared";
  }
  if (input.kinTolerance >= 0.34) {
    return "kin_tolerant";
  }
  if (input.familiarTolerance >= 0.3) {
    return "familiar_tolerant";
  }
  if (input.rememberedCooperationTolerance >= 0.28) {
    return "cooperation_remembered";
  }
  return "none";
}

function classifyAccessState(input: {
  readonly confidence: number;
  readonly staleness: number;
  readonly placeImportance: number;
  readonly placeSensitivity: number;
  readonly familiarUseStrength: number;
  readonly repeatedReturnStrength: number;
  readonly kinTolerance: number;
  readonly familiarTolerance: number;
  readonly strangerCaution: number;
  readonly sharedUsePressure: number;
  readonly crowdingResourcePressure: number;
  readonly rememberedRefusalAvoidance: number;
  readonly rememberedCooperationTolerance: number;
}): ProtoAccessStateKind {
  if (input.confidence < 0.16 && input.staleness >= 0.5) {
    return "stale_access_memory";
  }
  if (input.placeImportance < 0.14 && input.familiarUseStrength < 0.18 && input.sharedUsePressure < 0.2 && input.strangerCaution < 0.2) {
    return "none";
  }
  if (input.staleness >= 0.62 && input.confidence < 0.36) {
    return "stale_access_memory";
  }
  if (input.rememberedRefusalAvoidance >= 0.46 && input.placeImportance >= 0.28) {
    return "avoided_shared_use";
  }
  if (
    input.sharedUsePressure >= 0.56 &&
    input.crowdingResourcePressure >= 0.38 &&
    input.placeImportance >= 0.3
  ) {
    return "contested_use";
  }
  if (input.strangerCaution >= 0.46 && (input.placeSensitivity >= 0.46 || input.rememberedRefusalAvoidance >= 0.28)) {
    return "sensitive_place";
  }
  if (input.sharedUsePressure >= 0.44 && input.placeImportance >= 0.28) {
    return "crowded_use";
  }
  if (input.kinTolerance >= 0.38 && input.crowdingResourcePressure < 0.5) {
    return "kin_tolerated";
  }
  if (input.familiarTolerance >= 0.34 && (input.sharedUsePressure >= 0.18 || input.rememberedCooperationTolerance >= 0.24)) {
    return "tolerated_shared_use";
  }
  if (input.strangerCaution >= 0.3 && input.placeImportance >= 0.28) {
    return "stranger_watchful";
  }
  if (input.repeatedReturnStrength >= 0.5 && input.placeImportance >= 0.34) {
    return "expected_return";
  }
  if (input.familiarUseStrength >= 0.28) {
    return "familiar_use";
  }
  return "none";
}

function buildPositiveReasons(input: {
  readonly repeatedReturnStrength: number;
  readonly familiarUseStrength: number;
  readonly kinTolerance: number;
  readonly familiarTolerance: number;
  readonly rememberedCooperationTolerance: number;
  readonly placeImportance: number;
  readonly storageSignals: ReturnType<typeof collectStorageSignals>;
  readonly crossingSignal: ReturnType<typeof getCrossingSignal>;
  readonly proto: ProtoCampPlaceMemory | undefined;
}): readonly ProtoAccessReason[] {
  const reasons: ProtoAccessReason[] = [];
  if (input.repeatedReturnStrength >= 0.24) {
    reasons.push(accessReason("repeated return makes this place familiar", input.repeatedReturnStrength * 0.34, "familiar_use", "PlaceMemory + ProtoCampMemory"));
  }
  if (input.placeImportance >= 0.34) {
    reasons.push(accessReason("water, work, or refuge makes the place socially noticeable", input.placeImportance * 0.28, "place_importance", "Band-known place/resource memory"));
  }
  if (input.kinTolerance >= 0.28) {
    reasons.push(accessReason("kin signs are easier to tolerate here", input.kinTolerance * 0.32, "kin_tolerance", "RangeFrictionEvent + contact memory"));
  }
  if (input.familiarTolerance >= 0.28) {
    reasons.push(accessReason("familiar shared use has been tolerated before", input.familiarTolerance * 0.26, "kin_tolerance", "KnownBandContactMemory + shared-use notices"));
  }
  if (input.rememberedCooperationTolerance >= 0.28) {
    reasons.push(accessReason("previous tolerance keeps shared use from feeling hostile", input.rememberedCooperationTolerance * 0.24, "kin_tolerance", "RangeFrictionEvent.interpretation"));
  }
  if (input.storageSignals.hasProcessingPlace) {
    reasons.push(accessReason(`${input.storageSignals.bestLabel ?? "known food/material"} makes a processing place worth noticing`, Math.max(0.08, input.storageSignals.importance * 0.36), "storage_processing", "Band.resourceEcology.storageSuitabilityCards"));
  }
  if (input.crossingSignal.known || (input.proto?.crossingUseScore ?? 0) >= 0.08) {
    reasons.push(accessReason("known crossing use makes this place watched during movement", Math.max(0.08, Math.max(input.crossingSignal.importance, input.proto?.crossingUseScore ?? 0) * 0.32), "crossing_mobility", "KnownCrossingMemory / ResidentialMoveEvent"));
  }

  return reasons.sort(compareAccessReasons).slice(0, ACCESS_REASON_CAP);
}

function buildNegativeReasons(input: {
  readonly strangerCaution: number;
  readonly sharedUsePressure: number;
  readonly crowdingResourcePressure: number;
  readonly rememberedRefusalAvoidance: number;
  readonly placeSensitivity: number;
  readonly staleness: number;
  readonly storageSignals: ReturnType<typeof collectStorageSignals>;
  readonly crossingSignal: ReturnType<typeof getCrossingSignal>;
  readonly proto: ProtoCampPlaceMemory | undefined;
  readonly reports: readonly WordOfMouthReport[];
}): readonly ProtoAccessReason[] {
  const reasons: ProtoAccessReason[] = [];
  if (input.strangerCaution >= 0.24) {
    reasons.push(accessReason("unknown signs make this place watchful", input.strangerCaution * 0.32, "stranger_caution", "RangeFrictionEvent / reported signs"));
  }
  if (input.sharedUsePressure >= 0.28) {
    reasons.push(accessReason("repeated shared use is raising social pressure", input.sharedUsePressure * 0.3, "shared_use_pressure", "RangeFrictionEvent recurrence/crowding"));
  }
  if (input.crowdingResourcePressure >= 0.28) {
    reasons.push(accessReason("resource pressure makes sharing harder here", input.crowdingResourcePressure * 0.28, "shared_use_pressure", "LocalUsePressure / visible resource pressure"));
  }
  if (input.rememberedRefusalAvoidance >= 0.24) {
    reasons.push(accessReason("old avoidance or bad-place warning still matters", input.rememberedRefusalAvoidance * 0.3, "risk_hardship", "PlaceMemory / reports / friction warnings"));
  }
  if (input.storageSignals.pressure >= 0.24) {
    reasons.push(accessReason("keeping or carrying burden makes this place touchier", input.storageSignals.pressure * 0.22, "storage_processing", "Storage suitability burden"));
  }
  if (input.crossingSignal.risk >= 0.28 || (input.proto?.crossingUseScore ?? 0) > 0 && input.reports.some((report) => report.topic === "bad_water_warning")) {
    reasons.push(accessReason("crossing or water warning makes shared use uneasy", Math.max(0.08, input.crossingSignal.risk * 0.24), "crossing_mobility", "KnownCrossingMemory / reports"));
  }
  if (input.placeSensitivity >= 0.5) {
    reasons.push(accessReason("the place is important enough that people notice other use", input.placeSensitivity * 0.2, "place_importance", "combined access sensitivity score"));
  }
  if (input.staleness >= 0.45) {
    reasons.push(accessReason("old access memory is fading", input.staleness * 0.18, "knowledge_confidence", "prior ProtoAccessMemory"));
  }

  return reasons.sort(compareAccessReasons).slice(0, ACCESS_REASON_CAP);
}

function accessReason(
  reason: string,
  strength: number,
  family: ProtoAccessReasonFamily,
  rawSource: string,
): ProtoAccessReason {
  return {
    reason,
    strength: round2(clamp01(strength)),
    family,
    rawSource,
  };
}

function getWaterImportance(
  tile: Tile | undefined,
  place: Band["placeMemory"][TileId] | undefined,
  anchor: NonNullable<Band["anchorMemories"]>[TileId] | undefined,
  proto: ProtoCampPlaceMemory | undefined,
): number {
  return round2(clamp01(
      (tile?.resourceProfile.waterAccess ?? 0) * 0.34 +
      (place?.lastKnownWaterStress === undefined ? 0 : (1 - place.lastKnownWaterStress) * 0.22) +
      (anchor?.drySeasonReliability ?? 0) * 0.28 +
      (proto?.waterRefugeReliability ?? 0) * 0.28 +
      (place?.valences.includes("reliable") === true ? 0.1 : 0),
  ));
}

// CORRECTION-31 — every one of these six used to read only fields stamped at the episode's
// creation, so age was invisible and an old episode pushed exactly as hard as a fresh one.
// Each now scales its contribution by the evidence weight, which is what makes cooling and
// behavioural release happen at all.
function strongestFrictionRelation(
  evidence: readonly WeightedSocialEvidence[],
  predicate: (relation: RangeFrictionRelation) => boolean,
): number {
  let strongest = 0;
  for (const entry of evidence) {
    if (predicate(entry.event.relation)) {
      const raw = 0.3 + eventPressure(entry) * 0.45 + Math.min(0.18, entry.event.recurrenceCount * 0.04);
      strongest = Math.max(strongest, raw * entry.weight);
    }
  }
  return clamp01(strongest);
}

function bestContactTolerance(
  band: Band,
  evidence: readonly WeightedSocialEvidence[],
  kinOnly: boolean,
): number {
  let best = 0;
  for (const entry of evidence) {
    const contact = band.contactMemories[entry.event.otherBandId];
    if (contact === undefined) {
      continue;
    }
    const kin = contact.relation === "parent_daughter" || contact.relation === "siblings";
    if (kinOnly !== kin) {
      continue;
    }
    const raw = contact.trustLikeTolerance * 0.45 + contact.familiarity * 0.28 + Math.min(0.2, contact.sharedUseCount * 0.04);
    best = Math.max(best, raw * entry.weight);
  }
  return clamp01(best);
}

function tensionFromFriction(evidence: readonly WeightedSocialEvidence[]): number {
  return evidence.reduce((max, entry) => Math.max(max, eventPressure(entry)), 0);
}

function cooperationFromFriction(evidence: readonly WeightedSocialEvidence[]): number {
  let strongest = 0;
  for (const entry of evidence) {
    if (
      entry.event.interpretation === "tolerated_kin_presence" ||
      entry.event.interpretation === "noticed_shared_use"
    ) {
      const raw = 0.24 + Math.min(0.2, entry.event.recurrenceCount * 0.04);
      strongest = Math.max(strongest, raw * entry.weight);
    }
  }
  return clamp01(strongest);
}

function avoidanceFromFriction(evidence: readonly WeightedSocialEvidence[]): number {
  let strongest = 0;
  for (const entry of evidence) {
    if (
      entry.event.interpretation === "avoid_warning_remembered" ||
      entry.event.interpretation === "possible_intrusion" ||
      entry.event.interpretation === "repeated_outsider_use"
    ) {
      const raw = 0.2 + eventPressure(entry) * 0.46 + Math.min(0.2, entry.event.recurrenceCount * 0.04);
      strongest = Math.max(strongest, raw * entry.weight);
    }
  }
  return clamp01(strongest);
}

function eventPressure(entry: WeightedSocialEvidence): number {
  const event = entry.event;
  const tension =
    event.tensionLevel === "moderate_placeholder" ? 0.66 :
    event.tensionLevel === "mild" ? 0.42 :
    event.tensionLevel === "watchful" ? 0.28 :
    0;
  return clamp01((tension + Math.min(0.24, event.recentOverlapCount * 0.04)) * entry.weight);
}

function isKinRelation(relation: RangeFrictionRelation): boolean {
  return relation === "parent" || relation === "daughter" || relation === "sibling" || relation === "lineage_kin";
}

function getAccessStaleYears(
  world: WorldState,
  current: boolean,
  prior: ProtoAccessMemory | undefined,
  place: Band["placeMemory"][TileId] | undefined,
  proto: ProtoCampPlaceMemory | undefined,
  friction: readonly WeightedSocialEvidence[],
  reports: readonly WordOfMouthReport[],
): number {
  if (current) {
    return 0;
  }

  let evidenceTick = prior === undefined ? Number(world.time.tick) - 16 : Number(world.time.tick) - prior.staleYears * 4;
  if (place?.lastObservedAt !== undefined) {
    evidenceTick = Math.max(evidenceTick, Number(place.lastObservedAt.tick));
  }
  if (proto !== undefined) {
    evidenceTick = Math.max(evidenceTick, Number(proto.lastUsedTick));
  }
  for (const entry of friction) {
    evidenceTick = Math.max(evidenceTick, Number(entry.event.tick));
  }
  for (const report of reports) {
    evidenceTick = Math.max(evidenceTick, Number(report.tickReceived));
  }

  return Math.max(0, Math.floor((Number(world.time.tick) - evidenceTick) / 4));
}

function retainBoundedAccessMemories(
  memories: readonly ProtoAccessMemory[],
  currentTileId: TileId,
): readonly ProtoAccessMemory[] {
  const current = memories.find((memory) => memory.tileId === currentTileId);
  const ranked = memories.filter((memory) => memory.tileId !== currentTileId).slice(0, ACCESS_MEMORY_CAP - (current === undefined ? 0 : 1));
  return current === undefined ? ranked : [current, ...ranked];
}

function compareAccessMemories(left: ProtoAccessMemory, right: ProtoAccessMemory): number {
  const current = (right.accessState !== "none" ? 1 : 0) - (left.accessState !== "none" ? 1 : 0);
  if (current !== 0) {
    return current;
  }
  const sensitivity = right.placeSensitivity - left.placeSensitivity;
  if (sensitivity !== 0) {
    return sensitivity;
  }
  const importance = right.accessImportance - left.accessImportance;
  if (importance !== 0) {
    return importance;
  }
  const confidence = right.confidence - left.confidence;
  if (confidence !== 0) {
    return confidence;
  }
  return String(left.tileId).localeCompare(String(right.tileId));
}

function compareAccessReasons(left: ProtoAccessReason, right: ProtoAccessReason): number {
  const strength = right.strength - left.strength;
  if (strength !== 0) {
    return strength;
  }
  const family = left.family.localeCompare(right.family);
  if (family !== 0) {
    return family;
  }
  return left.reason.localeCompare(right.reason);
}

function compareWeightedEvidence(left: WeightedSocialEvidence, right: WeightedSocialEvidence): number {
  const pressure = eventPressure(right) - eventPressure(left);
  if (pressure !== 0) {
    return pressure;
  }
  const recurrence = right.event.recurrenceCount - left.event.recurrenceCount;
  if (recurrence !== 0) {
    return recurrence;
  }
  return String(left.event.eventId).localeCompare(String(right.event.eventId));
}

function comparePlaceMemories(
  left: Band["placeMemory"][TileId],
  right: Band["placeMemory"][TileId],
): number {
  const attachment = right.attachment - left.attachment;
  if (attachment !== 0) {
    return attachment;
  }
  const visits = right.visitCount - left.visitCount;
  if (visits !== 0) {
    return visits;
  }
  return String(left.tileId).localeCompare(String(right.tileId));
}

function compareBands(left: Band, right: Band): number {
  return String(left.id).localeCompare(String(right.id));
}

function isNearTile(world: WorldState, source: Tile | undefined, targetTileId: TileId, maxDistance: number): boolean {
  const target = getTile(world, targetTileId);
  return source !== undefined && target !== undefined && gridDistance(source, target) <= maxDistance;
}

function isCardNearTile(
  world: WorldState,
  source: Tile | undefined,
  anchorTileId: TileId,
  seenTileIds: readonly TileId[],
  maxDistance: number,
): boolean {
  return isNearTile(world, source, anchorTileId, maxDistance) || seenTileIds.some((tileId) => isNearTile(world, source, tileId, maxDistance));
}

function gridDistance(left: Tile, right: Tile): number {
  return Math.max(Math.abs(left.coord.x - right.coord.x), Math.abs(left.coord.y - right.coord.y));
}

function uniqueTileIds(ids: readonly TileId[]): readonly TileId[] {
  const seen = new Set<string>();
  const unique: TileId[] = [];
  for (const id of ids) {
    const key = String(id);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(id);
  }
  return unique;
}

function uniqueReasonIds(ids: readonly ReasonId[]): readonly ReasonId[] {
  const seen = new Set<string>();
  const unique: ReasonId[] = [];
  for (const id of ids) {
    const key = String(id);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(id);
  }
  return unique;
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
