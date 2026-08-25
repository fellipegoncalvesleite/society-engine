import type { RiverCrossingCapability } from "../world/hydrography";
import type { Band } from "./types";

/**
 * Canonical band-specific river-crossing capability authority.
 *
 * This leaf derives only what the band has actually earned through crossing/aquatic
 * practice or its current engineering knowledge/response state. Traversal consumers
 * use the returned capability; they do not reconstruct these rules independently.
 */
export function deriveBandRiverCrossingCapability(band: Band): RiverCrossingCapability {
  const crossingPractice = Object.values(band.crossingMemories ?? {}).some((memory) =>
    memory.useCount >= 2 && memory.successConfidence >= 0.5);
  const aquaticPractice = (band.recentIntraSeasonTrips ?? []).filter((trip) =>
    trip.taskGroupType === "fishing_group" || trip.taskGroupType === "water_group").length >= 3;
  const engineeringResponse = (band.practicalAdaptation?.responses ?? []).some((response) =>
    response.family === "engineering_structure" &&
    (response.status === "forming" || response.status === "active"));
  const fragments = band.practicalAdaptation?.fragments ?? [];
  const componentSubjects = new Set(fragments
    .filter((fragment) => fragment.knowledgeState !== "incorrect" && fragment.knowledgeState !== "dormant")
    .map((fragment) => fragment.subject));
  const componentBasis = componentSubjects.has("buoyancy_under_load") &&
    componentSubjects.has("binding_under_load") &&
    componentSubjects.has("staged_shuttle_crossing");

  return {
    canUseFords: true,
    canUseShallowCrossings: crossingPractice || aquaticPractice || engineeringResponse,
    canAttemptBasicRaftCrossing: engineeringResponse && componentBasis,
  };
}
