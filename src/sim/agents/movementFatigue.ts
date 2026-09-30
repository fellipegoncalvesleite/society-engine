import type { BandMovementRecord } from "./types";
import { getCalendarDay } from "../tick/time";
import { SEASON_LENGTH_DAYS } from "../core/types";

// Provisional aggregate model parameter, not an empirical universal recovery constant.
export const MOVEMENT_FATIGUE_RECOVERY_DAYS = 7;
export const MOVEMENT_FATIGUE_EVENT_AMPLITUDE = 0.2;

/** Historical moves remain historical; only their current fatigue interpretation decays. */
export function deriveRecentMovementFatigue(
  history: readonly BandMovementRecord[],
  currentDay: number,
  horizonDays = MOVEMENT_FATIGUE_RECOVERY_DAYS,
): number {
  if (!Number.isInteger(currentDay) || currentDay < 0 || !Number.isFinite(horizonDays) || horizonDays <= 0) {
    throw new RangeError("Invalid movement fatigue day or recovery horizon");
  }
  const displacements: number[] = [];
  for (const movement of history) {
    if (!movement.time) throw new RangeError("Invalid movement timestamp");
    const day = getCalendarDay(movement.time);
    if (!Number.isInteger(day) || day < 0 || day > currentDay ||
      Number(movement.tick) !== Number(movement.time.tick) ||
      Math.floor(day / SEASON_LENGTH_DAYS) !== Number(movement.tick)) {
      throw new RangeError("Invalid or future movement timestamp");
    }
    if (!Number.isFinite(movement.distanceKm) || movement.distanceKm < 0) {
      throw new RangeError("Invalid movement distance");
    }
    if (movement.fromTileId !== movement.toTileId && movement.distanceKm > 0) displacements.push(day);
  }
  return displacements.sort((a, b) => b - a).slice(0, 4).reduce((sum, day) =>
    sum + MOVEMENT_FATIGUE_EVENT_AMPLITUDE * Math.max(0, 1 - (currentDay - day) / horizonDays), 0);
}
