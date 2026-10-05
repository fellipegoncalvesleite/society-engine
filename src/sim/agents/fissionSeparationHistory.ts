import type { Band } from "./types";

/**
 * Latest tick on which bodies physically separated from this band through either
 * the retained legacy fission path or the Direction-D successor-departure seam.
 * Proposal, preparation, abandonment and supersession do not count because no
 * bodies have separated at those points.
 */
export function getLatestPhysicalSeparationTick(band: Band): number | undefined {
  let latest: number | undefined;

  for (const event of band.fissionEvents ?? []) {
    const tick = Number(event.tick);
    if (Number.isFinite(tick) && (latest === undefined || tick > latest)) {
      latest = tick;
    }
  }

  for (const record of band.successorDepartureRecords ?? []) {
    const tick = Number(record.tick);
    if (Number.isFinite(tick) && (latest === undefined || tick > latest)) {
      latest = tick;
    }
  }

  return latest;
}
