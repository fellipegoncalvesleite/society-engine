/**
 * ROADMAP ITEM 4 — ONE COOLDOWN CLOCK FOR A REAL PHYSICAL SEPARATION.
 *
 * Legacy daughters recorded their birth in `fissionEvents`. Direction-D successors deliberately do
 * not fabricate that legacy event; their durable physical fact is `successorDepartureRecords`.
 * Proposal eligibility must therefore read BOTH histories or a parent can fragment again as though
 * the Direction-D departure never happened.
 *
 * The same departure record is written to parent and successor. That is intentional: after a real
 * separation neither side gets an immediate second fragmentation merely because one side later
 * stabilizes, reintegrates, survives a failed return, or becomes established by the post-return path.
 * Pre-departure abandonment writes no departure record and therefore starts no physical cooldown.
 */

import type { Band } from "./types";
import type { TickNumber, WorldTime } from "../core/types";

export const FISSION_SEPARATION_COOLDOWN_TICKS = 60;
export const LARGE_BAND_FISSION_SEPARATION_COOLDOWN_TICKS = 28;
export const MEGA_BAND_FISSION_SEPARATION_COOLDOWN_TICKS = 16;

export function getRequiredFissionSeparationCooldownTicks(population: number): number {
  return population >= 300
    ? MEGA_BAND_FISSION_SEPARATION_COOLDOWN_TICKS
    : population >= 150
      ? LARGE_BAND_FISSION_SEPARATION_COOLDOWN_TICKS
      : FISSION_SEPARATION_COOLDOWN_TICKS;
}

export function getLatestFissionSeparationTick(band: Band): TickNumber | undefined {
  let latest: number | undefined;

  for (const event of band.fissionEvents) {
    const tick = Number(event.tick);
    latest = latest === undefined ? tick : Math.max(latest, tick);
  }

  for (const record of band.successorDepartureRecords ?? []) {
    const tick = Number(record.tick);
    latest = latest === undefined ? tick : Math.max(latest, tick);
  }

  return latest === undefined ? undefined : latest as TickNumber;
}

export function hasFissionSeparationCooldownElapsed(
  time: WorldTime,
  band: Band,
  population: number,
): boolean {
  const latest = getLatestFissionSeparationTick(band);
  if (latest === undefined) return true;
  return Number(time.tick) - Number(latest) >= getRequiredFissionSeparationCooldownTicks(population);
}
