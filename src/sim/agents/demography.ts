import type {
  Band,
  BandDemography,
  BandFissionEvent,
  BandLineageLink,
  CausalTrace,
  DeathCauseKind,
  DeathMemoryState,
  DemographicChurnRecord,
  DemographicChurnState,
  KnownCrossingMemory,
  NoDeathAuditState,
  PlaceMemoryRecord,
  PopulationAccountingState,
  SeasonalHungerClassification,
  SocialPressureProfile,
  SeasonalSupportState,
  TravelCorridorMemory,
} from "./types";
// CORRECTION-34C — the away-party headcount, read from the same leaf authority
// `deriveAvailableMobilityPools` and the shared-catchment effort term use, so a fission cannot
// disagree with them about who is physically at camp. `bandMobility` imports only types.
import {
  derivePhysicallyAwayPartyPeople,
  derivePreparedCommitmentPartyPeople,
} from "./bandMobility";
import { isFissionEligibleParent } from "./bandLifecycle";
import { beginNaturalFissionProposal } from "./naturalFissionPreDeparture";
import { createDaughterDeepHistory } from "./bandHistory";
import {
  inheritAdaptiveHumanForDaughter,
  inheritPracticalAdaptationForDaughter,
} from "./adaptationBoundary";
import { inheritAnimalPatternKnowledgeForDaughter } from "./animalLearning";
import { inheritResourceKnowledgeForDaughter } from "./resourceKnowledge";
import { deriveReportedKnowledgeTargetBias } from "./reportedKnowledge";
import { deriveDaughterColor } from "./lineageColor";
import { deriveLegacyNonCloneableFields } from "./fissionFieldTransferPolicy";
import { getLocalUsePressureValue } from "./pressure";
import {
  getCrowdingPenalty,
  getNearbyBandPressure,
} from "./crowding";
import { inheritBiomeAdaptation } from "./biomeAdaptation";
import { degradeInheritedExploitationSkill } from "./exploitationSkill";
import {
  inheritFrontierIntentForDaughter,
  parentFrontierIntentAlignment,
} from "./frontierIntent";
import {
  getSalientMemorySummary,
  type TickContextCache,
} from "./contextCache";
import type {
  BandId,
  Coord,
  EventId,
  ReasonId,
  RouteId,
  TickNumber,
  TileId,
  WorldTime,
} from "../core/types";
import type {
  KnowledgeState,
  KnownBandRecord,
  KnownTileRecord,
  PlaceAttachment,
  TileObservation,
} from "../knowledge/types";
import type { MobilityIntent, Reason } from "../rules/types";
import { getNeighborTiles, getTile } from "../world/generate";
import { FISSION_TIEBREAK_EPSILON, seededTieBreakJitter } from "../core/seededVariation";
import { getDepletionAdjustedRichness } from "../world/depletion";
import { getNomadicScaleClass, NOMADIC_MAX_MOBILE_BANDS_WARNING_COUNT } from "./nomadicScale";
import {
  deriveAnnualNutritionState,
  type CanonicalNutritionState,
} from "./seasonalSurvival";
import type {
  DiagnosticDeathMemoryMode,
  DiagnosticDemographyMode,
  FoodDemographyDiagnostics,
} from "../diagnostics/foodDemographyDiagnostics";
import {
  getFissionEvaluationObserver,
  isFissionSuppressedForAudit,
} from "../diagnostics/fissionDiagnostics";
import {
  getRiverCrossingForMovement,
  makeRiverCrossingKey,
} from "../world/hydrography";
import { isBandPassableDestination } from "../world/passability";
import type { Tile, WorldState } from "../world/types";

interface DemographyComputation {
  readonly demography: BandDemography;
  readonly deathMemory?: DeathMemoryState;
  readonly primaryReason: Reason;
  readonly localUsePressure: number;
  readonly comfortablePopulation: number;
  readonly viableFrontier: FissionTargetCandidate | undefined;
  readonly shouldCreateDaughter: boolean;
  readonly deferredReason: Reason | undefined;
  readonly naturalFissionCause: "accumulated_split_pressure" | "crisis_breakaway_pressure" | undefined;
}

interface FissionTargetCandidate {
  readonly tileId: TileId;
  readonly score: number;
  readonly frontierValue: number;
  readonly corridorValue: number;
  readonly aquaticValue: number;
  readonly knownBandSpacingPenalty: number;
  readonly knownBandsConsidered: number;
  readonly closestKnownBandDistanceTiles?: number;
  readonly crossingMemory?: KnownCrossingMemory;
  readonly reasonType:
    | "frontier_split"
    | "river_corridor_split"
    | "coastal_split"
    | "crossing_enabled_split";
}

export interface KnownBandSpacingForFission {
  readonly knownBandsConsidered: number;
  readonly closestKnownBandDistanceTiles?: number;
  readonly trustedKinTolerance: number;
  readonly crowdedContactPressure: number;
  readonly knownBandSpacingPenalty: number;
  readonly hiddenUnknownBandAvoidance: 0;
  readonly reasonIds: readonly ReasonId[];
}

interface DaughterCreation {
  readonly parent: Band;
  readonly daughter: Band;
}

const MINIMUM_SPLIT_POPULATION = 46;
const SPLIT_PRESSURE_THRESHOLD = 0.64;
const DAUGHTER_MIN_POPULATION = 18;
const DAUGHTER_MAX_POPULATION = 64;
const MAX_BANDS = NOMADIC_MAX_MOBILE_BANDS_WARNING_COUNT;
const FISSION_COOLDOWN_TICKS = 60;
const LARGE_BAND_FISSION_COOLDOWN_TICKS = 28;
const MEGA_BAND_FISSION_COOLDOWN_TICKS = 16;

export function updateBandsDemographyAndFission(
  world: WorldState,
  contextCache?: TickContextCache,
  diagnostics?: FoodDemographyDiagnostics,
): WorldState {
  if (!shouldRunAnnualDemography(world)) {
    return world;
  }

  let bandsById: Readonly<Record<BandId, Band>> = world.bands;
  const bandOrder = Object.values(world.bands).sort(compareBands);

  for (const orderedBand of bandOrder) {
    const band = bandsById[orderedBand.id];

    if (band === undefined) {
      continue;
    }

    if (
      band.status === "dispersed" ||
      band.viability?.status === "absorbed" ||
      band.viability?.status === "extinct"
    ) {
      bandsById = {
        ...bandsById,
        [band.id]: band,
      };
      continue;
    }

    const currentWorld = {
      ...world,
      bands: bandsById,
    };
    const computation = computeBandDemography(currentWorld, band, contextCache, diagnostics);
    const bandWithDemography = applyDemographyUpdate(currentWorld, band, computation);
    // ROADMAP ITEM 4 — CUTOVER PREPARATION, NOT PHYSICAL CUTOVER.
    //
    // This exact legacy eligibility boundary used to call `createDaughterBand` and immediately move
    // bodies into an ordinary daughter. It now opens ONE parent-side proposal through the dedicated
    // natural adapter. `createDaughterBand` remains in source unchanged as compatibility/debt, but
    // ordinary ecology no longer calls it. No daughter, event or population transfer is produced.
    const worldWithUpdatedParent: WorldState = {
      ...currentWorld,
      bands: { ...currentWorld.bands, [bandWithDemography.id]: bandWithDemography },
    };
    const proposed =
      computation.shouldCreateDaughter &&
      computation.viableFrontier !== undefined &&
      computation.naturalFissionCause !== undefined &&
      Object.keys(bandsById).length < MAX_BANDS
        ? beginNaturalFissionProposal({
            world: worldWithUpdatedParent,
            parentId: bandWithDemography.id,
            today: Number(world.time.day ?? Number(world.time.tick) * 90),
            input: {
              cause: computation.naturalFissionCause,
              splitPressure: computation.demography.splitPressure,
              ecologicalFounderRequest: getDaughterPopulation(computation.demography.population),
              minimumFounderRequest: DAUGHTER_MIN_POPULATION,
              targetTileId: computation.viableFrontier.tileId,
              targetScore: computation.viableFrontier.score,
              targetReason: computation.viableFrontier.reasonType,
              reasonIds: [computation.primaryReason.id],
            },
          })
        : undefined;

    bandsById = {
      ...bandsById,
      [bandWithDemography.id]: proposed?.ok === true
        ? proposed.world.bands[bandWithDemography.id] ?? bandWithDemography
        : bandWithDemography,
    };
  }

  return {
    ...world,
    bands: bandsById,
  };
}

export function updateBandDemography(
  world: WorldState,
  band: Band,
  diagnostics?: FoodDemographyDiagnostics,
): BandDemography {
  return computeBandDemography(world, band, undefined, diagnostics).demography;
}

function shouldRunAnnualDemography(world: WorldState): boolean {
  return world.time.tick > 0 && world.time.season === "spring";
}

export interface FoodDemographyRateTerms {
  readonly mode: DiagnosticDemographyMode;
  readonly currentFoodStress: number;
  readonly recentFoodStress: number;
  readonly chronicFoodStress: number;
  readonly foodPerPersonStress: number;
  readonly foodFertilityBaseBonus: number;
  readonly foodFertilitySuppression: number;
  readonly foodFertilitySurplusBonus: number;
  readonly severeChronicFoodHazard: number;
  readonly foodMortalityContribution: number;
  readonly survivalBaseline: number;
  readonly directChronicDeficitRatePenalty: number;
  readonly severeRepeatedSeasonalBite: number;
  readonly severeChronicFoodRatePenalty: number;
  readonly fertilityRatePenaltyFromFood: number;
  readonly mortalityRatePenaltyFromFood: number;
  readonly survivalBaselineRatePenaltyFromFood: number;
  readonly totalFoodRatePenalty: number;
}

export function deriveFoodDemographyRateTerms(
  nutrition: CanonicalNutritionState,
  support: SeasonalSupportState | undefined,
  mode: DiagnosticDemographyMode = "actual",
): FoodDemographyRateTerms {
  const useDeStackedFoodDemography = mode !== "legacy_stacked";
  const currentFoodStress = nutrition.currentFoodStress;
  const recentFoodStress = nutrition.recentFoodStress;
  const chronicFoodStress = nutrition.chronicFoodStress;
  const foodPerPersonStress = nutrition.foodDemographicPressure;
  const actualSevereRepeatedSeasonalBite =
    support?.hungerClassification === "crisis_deficit"
      ? 0.006
      : support?.hungerClassification === "chronic_plus_seasonal_stress"
        ? 0.0035
        : support?.chronicDeficitStreak !== undefined && support.chronicDeficitStreak >= 4
          ? 0.002
          : 0;
  const foodFertilityBaseBonus = useDeStackedFoodDemography
    ? 0.14
    : (1 - foodPerPersonStress) * 0.14;
  const severeChronicFoodHazard = useDeStackedFoodDemography
    ? clamp01((Math.max(0, foodPerPersonStress - 0.72) / 0.28) * chronicFoodStress)
    : 0;
  const foodFertilitySuppression = useDeStackedFoodDemography
    ? clamp01(foodPerPersonStress * 0.22 + severeChronicFoodHazard * 0.22)
    : clamp01(foodPerPersonStress * 0.22 + chronicFoodStress * 0.2 + recentFoodStress * 0.1);
  const foodFertilitySurplusBonus = useDeStackedFoodDemography
    ? nutrition.nutritionalSurplus * 0.22
    : 0;
  const foodMortalityContribution = useDeStackedFoodDemography
    ? clamp01(foodPerPersonStress * 0.36)
    : clamp01(foodPerPersonStress * 0.36 + chronicFoodStress * 0.28);
  const survivalBaseline = useDeStackedFoodDemography ? 0.002 : chronicFoodStress > 0.2 ? 0.0014 : 0.002;
  const directChronicDeficitRatePenalty = useDeStackedFoodDemography ? 0 : chronicFoodStress * 0.006;
  const severeRepeatedSeasonalBite = useDeStackedFoodDemography ? 0 : actualSevereRepeatedSeasonalBite;
  const severeChronicFoodRatePenalty = useDeStackedFoodDemography ? severeChronicFoodHazard * 0.008 : 0;
  const fertilityRatePenaltyFromFood = ((0.14 - foodFertilityBaseBonus) + foodFertilitySuppression) * 0.012;
  const mortalityRatePenaltyFromFood = foodMortalityContribution * 0.014;
  const survivalBaselineRatePenaltyFromFood = 0.002 - survivalBaseline;

  return {
    mode,
    currentFoodStress,
    recentFoodStress,
    chronicFoodStress,
    foodPerPersonStress,
    foodFertilityBaseBonus,
    foodFertilitySuppression,
    foodFertilitySurplusBonus,
    severeChronicFoodHazard,
    foodMortalityContribution,
    survivalBaseline,
    directChronicDeficitRatePenalty,
    severeRepeatedSeasonalBite,
    severeChronicFoodRatePenalty,
    fertilityRatePenaltyFromFood,
    mortalityRatePenaltyFromFood,
    survivalBaselineRatePenaltyFromFood,
    totalFoodRatePenalty:
      fertilityRatePenaltyFromFood + mortalityRatePenaltyFromFood + survivalBaselineRatePenaltyFromFood +
      directChronicDeficitRatePenalty + severeRepeatedSeasonalBite + severeChronicFoodRatePenalty,
  };
}

// Exact checkpoint source continues here. Whole-file restoration through Editor v3 is not safely
// expressible without reproducing the complete 139,070-byte file; this branch is staging-only.
