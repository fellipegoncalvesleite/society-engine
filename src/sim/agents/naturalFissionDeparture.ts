import type { DailyAction } from "./dailyActions";
import { performAtomicDeparture, type DepartureRefusal } from "./fissionDepartureSeam";
import { abandonPreparedDeparture, supersedePreparedDeparture } from "./fissionDeparturePreparation";
import { NOMADIC_MAX_MOBILE_BANDS_WARNING_COUNT } from "./nomadicScale";
import type { BandId } from "../core/types";
import type { WorldState } from "../world/types";

export type NaturalFissionDepartureKind = "departed" | "refused" | "capacity_deferred";

export interface NaturalFissionDepartureRecord {
  readonly parentId: BandId;
  readonly lineageId: string;
  readonly successorBandId: BandId;
  readonly day: number;
  readonly kind: NaturalFissionDepartureKind;
  readonly refusal?: DepartureRefusal;
}

/** Stable identity of the physical successor produced by one natural attempt. */
export const makeNaturalSuccessorBandId = (lineageId: string): BandId =>
  `successor:${lineageId}` as BandId;

/**
 * Execute already-accepted natural departures. This adapter chooses only WHEN and
 * in which deterministic order ready attempts are offered to the atomic seam.
 * Founder allocation, residual viability, accepted target, authorization, body
 * transfer, successor construction and provenance remain owned by the seam and
 * the preparation authorities it consumes.
 */
export function advanceNaturalFissionDepartures(
  world: WorldState,
  today: number,
): { readonly world: WorldState; readonly records: readonly NaturalFissionDepartureRecord[] } {
  let current = world;
  const records: NaturalFissionDepartureRecord[] = [];
  const ready = Object.values(world.bands)
    .filter((band) =>
      band.fissionAttempt?.naturalProposal !== undefined &&
      band.fissionAttempt.phase === "departure_ready",
    )
    .map((band) => ({
      parentId: band.id,
      lineageId: band.fissionAttempt!.lineageId,
      phaseEnteredDay: band.fissionAttempt!.phaseEnteredDay,
    }))
    .sort((left, right) =>
      left.phaseEnteredDay - right.phaseEnteredDay ||
      left.lineageId.localeCompare(right.lineageId) ||
      String(left.parentId).localeCompare(String(right.parentId)),
    );

  for (const candidate of ready) {
    const parent = current.bands[candidate.parentId];
    const attempt = parent?.fissionAttempt;
    if (
      parent === undefined ||
      attempt?.naturalProposal === undefined ||
      attempt.phase !== "departure_ready" ||
      today <= attempt.phaseEnteredDay
    ) {
      continue;
    }

    const successorBandId = makeNaturalSuccessorBandId(attempt.lineageId);
    if (Object.keys(current.bands).length >= NOMADIC_MAX_MOBILE_BANDS_WARNING_COUNT) {
      records.push({
        parentId: parent.id,
        lineageId: attempt.lineageId,
        successorBandId,
        day: today,
        kind: "capacity_deferred",
      });
      continue;
    }

    const outcome = performAtomicDeparture({
      world: current,
      parentId: parent.id,
      today,
      successorBandId,
      lineageId: attempt.lineageId,
    });
    if (outcome.ok === true) {
      current = outcome.world;
      records.push({
        parentId: parent.id,
        lineageId: attempt.lineageId,
        successorBandId,
        day: today,
        kind: "departed",
      });
    } else {
      if (
        outcome.refusal === "prepared_terms_are_stale" ||
        outcome.refusal === "prepared_cohort_is_no_longer_present_in_the_parent" ||
        outcome.refusal === "attempt_names_a_different_destination_than_the_commitment"
      ) {
        const supersessionCause = outcome.refusal === "attempt_names_a_different_destination_than_the_commitment"
          ? "destination_changed"
          : "founder_allocation_changed";
        const superseded = supersedePreparedDeparture(current, parent.id, supersessionCause, today);
        if (superseded.ok === true) {
          const abandoned = abandonPreparedDeparture(superseded.world, parent.id, today);
          if (abandoned.ok === true) {
            current = abandoned.world;
          }
        }
      }
      records.push({
        parentId: parent.id,
        lineageId: attempt.lineageId,
        successorBandId,
        day: today,
        kind: "refused",
        refusal: outcome.refusal,
      });
    }
  }

  return { world: current, records };
}

/**
 * Physical departure is the final action of an ordinary day. Boundary days are
 * excluded because `advanceWorldByDays` runs the seasonal pipeline immediately
 * after that day's daily actions; a newborn must not receive same-day seasonal
 * decision/demography/viability/ecology work.
 */
export const naturalFissionDepartureDailyAction: DailyAction = {
  id: "natural_fission_departure",
  firesOnDayOfSeason: (dayOfSeason) => dayOfSeason !== 0,
  apply: (world, day) => advanceNaturalFissionDepartures(world, day).world,
};
