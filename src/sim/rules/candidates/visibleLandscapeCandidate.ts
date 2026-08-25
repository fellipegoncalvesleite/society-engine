// CORE-PIPELINE-DECOMPOSITION-2 — visible-landscape probe candidate family.
//
// A residence-unchanged probe toward a band-KNOWN visible landscape cue (an
// uncertain distant hint the band can see but has not observed). Owns its own
// eligibility (a fresh, confident, unobserved cue inside the same-day physical
// lower bound), evidence (the cue only), benefits/risks (water urgency and perceptual
// uncertainty), and contribution (the scored logistical_probe candidate). Route and
// crossing feasibility remain owned by physical execution; this family never invents
// a synthetic current->target movement edge for a distant cue.
import { LANDSCAPE_VISIBILITY_MAX_RANGE_KM } from "../../agents/landscapeVisibility";
import { deriveInvestigationSameDayLowerBound } from "../../agents/intraSeasonTrips";
import { deriveProbeDiminishingReturn } from "../../agents/probeMemory";
import { getLocalUsePressureValue } from "../../agents/pressure";
import { getAnchorHoldBonus } from "../../agents/residentialAnchor";
import type { Band } from "../../agents/types";
import type { TileId } from "../../core/types";
import { getTile } from "../../world/generate";
import type { WorldState } from "../../world/types";
import type {
  CandidateDecision,
  CandidateEvaluationCache,
} from "../decisionCandidateTypes";
import {
  PROBE_DIMINISHING_RETURN_SCORE_WEIGHT,
  VISIBLE_LANDSCAPE_PROBE_SCORE_WEIGHT,
} from "../decisionConstants";
import {
  clamp01,
  emptyScoreBreakdown,
  makeReason,
  numericTileIdPart,
  round2,
  scoreDecision,
} from "../decisionScoring";
import type { Action, ScoreBreakdown } from "../types";

import type { DecisionId } from "../../core/types";

export function buildVisibleLandscapeProbeCandidate(
  world: WorldState,
  band: Band,
  decisionId: DecisionId,
  decisionCache: CandidateEvaluationCache,
): CandidateDecision | undefined {
  const currentTile = getTile(world, band.position);
  const currentRecord = band.knowledge.observedTiles[band.position];

  if (currentTile === undefined || currentRecord === undefined) {
    return undefined;
  }

  const cue = (band.visibleLandscapeCues ?? [])
    .filter((entry) =>
      entry.status !== "stale" &&
      entry.confidence >= 0.38 &&
      band.knowledge.observedTiles[entry.approximateTileId] === undefined,
    )
    .sort((left, right) =>
      right.confidence - left.confidence ||
      left.distanceKm - right.distanceKm ||
      left.cueId.localeCompare(right.cueId),
    )[0];

  if (cue === undefined) {
    return undefined;
  }

  const targetTile = getTile(world, cue.approximateTileId);
  if (targetTile === undefined) {
    return undefined;
  }

  const distanceKm = cue.distanceKm;
  if (!Number.isFinite(distanceKm) || distanceKm <= 0 || distanceKm > LANDSCAPE_VISIBILITY_MAX_RANGE_KM) {
    return undefined;
  }

  // A distant visual cue is not route knowledge. The candidate may only rule out a
  // probe that is physically impossible even under an ideal straight-line round trip.
  // Route topology, passability and crossings remain unknown until the executor builds
  // and walks the real route. This keeps perception != route feasibility.
  const sameDayLowerBound = deriveInvestigationSameDayLowerBound(band, distanceKm);
  if (!sameDayLowerBound.sameDayPossible) {
    return undefined;
  }

  const currentUsePressure = getLocalUsePressureValue(band.usePressure[currentTile.id]);
  const targetKindPull = visibleCueProbeKindPull(cue.kind);
  // PERCEPTION-MOBILITY-1C — a chronically poor band that can clearly see nearby
  // WATER should not ignore it forever. This boosts the SCOUT/PROBE value (never a
  // relocation) so the band investigates the cue; observing the shore then feeds
  // the existing, fully-gated residential scorer. Anti-omniscient: the cue is an
  // uncertain visible hint, the probe legitimately observes it, and no hidden water
  // truth, exact target, or direct relocation is used.
  const isWaterCue =
    cue.kind === "visible_water" ||
    cue.kind === "visible_wetland" ||
    cue.kind === "lake_shore_visible" ||
    cue.kind === "delta_like_area" ||
    cue.kind === "river_or_tributary_corridor";
  const probeSupportDebug = band.perCapitaReturn?.supportDebug ?? band.carryingCapacity?.perCapitaReturn?.supportDebug;
  const bandPoorness = clamp01(
    Math.max(
      decisionCache.pressureSnapshot.bandPressureState.foodStress,
      probeSupportDebug?.deficitRatio ?? 0,
    ) + (band.returnTrend?.chronicDecline === true ? 0.2 : 0),
  );
  const nearbyWaterUrgency =
    isWaterCue && !cue.blockedByTerrain ? clamp01(bandPoorness * (distanceKm <= 9 ? 1 : 0.5)) : 0;
  // Route confidence is intentionally zero at this stage: visibility says where an
  // approximate feature is, not that the band knows a passable route or crossing to it.
  const routeConfidence = 0;
  const scoreBreakdown: ScoreBreakdown = {
    ...emptyScoreBreakdown(),
    foodValue: clamp01((currentRecord.observedRichness ?? 0.35) * 0.16),
    waterValue: clamp01((currentRecord.observedWaterAccess ?? 0.35) * 0.16 + (cue.kind === "visible_water" ? cue.confidence * 0.16 : 0) + nearbyWaterUrgency * 0.22),
    memoryConfidence: cue.confidence,
    movementCost: clamp01(distanceKm / LANDSCAPE_VISIBILITY_MAX_RANGE_KM),
    riskCost: clamp01(
      (band.pressureState?.riskPressure ?? 0) * 0.12 +
        (cue.blockedByTerrain ? 0.12 : 0),
    ),
    routeValue: routeConfidence,
    explorationValue: clamp01(cue.confidence * 0.5 + targetKindPull * 0.22 + nearbyWaterUrgency * 0.12),
    frontierProbeValue: clamp01(cue.confidence * 0.62 + targetKindPull * 0.22 + nearbyWaterUrgency * 0.18),
    localSurvivalValue: clamp01((currentRecord.observedRichness ?? 0.35) * 0.18 + (currentRecord.observedWaterAccess ?? 0.35) * 0.14 + nearbyWaterUrgency * 0.3),
    localUsePressure: clamp01(currentUsePressure * 0.14),
    foodStress: decisionCache.pressureSnapshot.bandPressureState.foodStress,
    waterStress: decisionCache.pressureSnapshot.bandPressureState.waterStress,
    mobilityPressure: decisionCache.pressureSnapshot.bandPressureState.mobilityPressure,
    riverCrossingCost: 0,
    riverCrossingRisk: 0,
    riverCorridorValue: 0,
    knownFordValue: 0,
    blockedCrossingPenalty: 0,
    scoutValue: cue.confidence,
    logisticalProbeValue: cue.confidence,
  };
  const action: Action = {
    type: "logistical_probe",
    originTileId: currentTile.id,
    targetTileId: targetTile.id,
    prospectTileIds: [targetTile.id],
  };
  const basis = [`visible_landscape:${cue.kind}:${cue.direction}`];
  const primaryReason = makeReason(decisionId, "primary", numericTileIdPart(targetTile.id), {
    type: "logistical_probe_selected",
    strength: cue.confidence,
    confidence: routeConfidence,
    relatedTileIds: [currentTile.id, targetTile.id],
    bandId: band.id,
    currentTileId: currentTile.id,
    targetTileId: targetTile.id,
    prospectTileIds: [targetTile.id],
    scoutValue: cue.confidence,
    uncertainty: round2(1 - cue.confidence),
    crossingRisk: 0,
    travelCost: sameDayLowerBound.minimumTotalDays,
    basis,
  });
  const diminishingReturn = deriveProbeDiminishingReturn(band.probeMemory, targetTile.id, Number(world.time.tick), {
    waterStress: decisionCache.pressureSnapshot.bandPressureState.waterStress,
    routeConfidence,
    hasAlternativeTarget: (band.visibleLandscapeCues ?? []).length > 1,
    resourceBeliefRelevant: false,
    exhaustedRangeStress: band.exhaustedRangeAudit?.stressLevel ?? 0,
  });
  const probeDiminishingReturnPull = diminishingReturn.probeDiminishingReturnPenalty * PROBE_DIMINISHING_RETURN_SCORE_WEIGHT;

  return {
    action,
    scoreBreakdown,
    score: round2(
      scoreDecision(scoreBreakdown) +
        cue.confidence * VISIBLE_LANDSCAPE_PROBE_SCORE_WEIGHT +
        getAnchorHoldBonus(decisionCache.anchorContext) -
        probeDiminishingReturnPull,
    ),
    primaryReason,
    secondaryReasons: [
      makeReason(decisionId, "secondary", 1, {
        type: "scout_before_relocation",
        strength: cue.confidence,
        confidence: routeConfidence,
        relatedTileIds: [currentTile.id, targetTile.id],
        bandId: band.id,
        currentTileId: currentTile.id,
        targetTileId: targetTile.id,
        prospectTileIds: [targetTile.id],
        scoutValue: cue.confidence,
        uncertainty: round2(1 - cue.confidence),
        crossingRisk: 0,
        travelCost: sameDayLowerBound.minimumTotalDays,
        basis,
      }),
    ],
  };
}

export function visibleCueProbeKindPull(kind: NonNullable<Band["visibleLandscapeCues"]>[number]["kind"]): number {
  switch (kind) {
    case "visible_water":
    case "visible_wetland":
    case "lake_shore_visible":
    case "delta_like_area":
    case "river_or_tributary_corridor":
      return 0.22;
    case "greener_lowland":
    case "open_valley":
      return 0.16;
    case "pass_or_saddle":
    case "opposite_bank":
      return 0.12;
    case "higher_ground":
    case "dry_or_barren_country":
      return 0.06;
  }
}
