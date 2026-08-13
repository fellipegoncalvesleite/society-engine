/**
 * ROADMAP ITEM 4 — ORDINARY NATURAL PHYSICAL CUTOVER.
 *
 * This is the ONE ordinary-production caller of `performAtomicDeparture`.
 *
 * The parent-side lifecycle is daily and explicitly day-bounded, so a ready attempt is resolved on
 * the daily calendar rather than being held until the next annual demographic pass. The action is
 * registered LAST. A readiness fact written on day D can never execute on D, and a successor born on
 * its first legal later day therefore receives no travel, subsistence, return, stabilization or other
 * daily work for free on its birth day.
 *
 * There is one extra protection for a season boundary. `advanceWorldByDays` runs the in-season daily
 * span before the crossed-season pipeline. Creating a successor on that boundary would therefore let
 * it enter seasonal systems later on the same simulated day. The adapter defers such a departure to
 * the first non-boundary day. This is cadence protection, not an ecological decision.
 *
 * Capacity is arbitrated HERE, at physical execution, because proposal-time band counts may be stale.
 * Ready candidates are ordered by an explicit tuple independent of object insertion order. No slot is
 * reserved and no body moves until the canonical atomic seam succeeds.
 */

import { SEASON_LENGTH_DAYS, type BandId } from "../core/types";
import type { WorldState } from "../world/types";
import type { DailyAction } from "./dailyActions";
import { abandonPreparedDeparture } from "./fissionDeparturePreparation";
import {
  performAtomicDeparture,
  type DepartureLedger,
  type DepartureRefusal,
} from "./fissionDepartureSeam";
import { NOMADIC_MAX_MOBILE_BANDS_WARNING_COUNT } from "./nomadicScale";

export type NaturalPhysicalDepartureKind =
  | "departed"
  | "deferred_for_season_boundary"
  | "deferred_for_band_cap"
  | "stale_ready_terminalized"
  | "structural_refusal_left_for_deadline";

export interface NaturalPhysicalDepartureRecord {
  readonly parentId: string;
  readonly lineageId: string;
  readonly day: number;
  readonly kind: NaturalPhysicalDepartureKind;
  readonly successorId?: string;
  readonly refusal?: DepartureRefusal;
  readonly detail?: string;
  readonly ledger?: DepartureLedger;
}

export interface NaturalPhysicalDepartureResult {
  readonly world: WorldState;
  readonly records: readonly NaturalPhysicalDepartureRecord[];
}

/**
 * Natural successor identity is derived from the immutable attempt lineage rather than from the
 * current band count. Two runs reaching the same accepted attempt therefore name the same successor,
 * while unrelated parents/attempts cannot race on an incrementing global counter.
 */
export function makeNaturalSuccessorBandId(lineageId: string): BandId {
  return `successor:${lineageId}` as BandId;
}

const isStaleReadyRefusal = (refusal: DepartureRefusal): boolean =>
  refusal === "prepared_terms_are_stale" ||
  refusal === "prepared_cohort_is_no_longer_present_in_the_parent";

const compareReadyParents = (
  left: { readonly id: BandId; readonly phaseEnteredDay: number; readonly lineageId: string },
  right: { readonly id: BandId; readonly phaseEnteredDay: number; readonly lineageId: string },
): number =>
  left.phaseEnteredDay - right.phaseEnteredDay ||
  left.lineageId.localeCompare(right.lineageId) ||
  String(left.id).localeCompare(String(right.id));

/**
 * Resolve every ordinary natural `departure_ready` candidate that is legally executable today.
 *
 * A refusal from the atomic seam never triggers a silent re-fit. Stale/cohort-invalid accepted terms
 * terminate that exact attempt through the canonical abandonment writer, withdrawing its live permit;
 * a later departure must be a new attempt with current terms and new positive acceptance. Structural
 * corruption is left visible for the independent ready deadline rather than being re-labelled as a
 * human choice.
 */
export function advanceNaturalFissionPhysicalDeparture(
  world: WorldState,
  today: number,
): NaturalPhysicalDepartureResult {
  let current = world;
  const records: NaturalPhysicalDepartureRecord[] = [];
  const candidates = Object.values(world.bands)
    .flatMap((band) => {
      const attempt = band.fissionAttempt;
      return attempt?.phase === "departure_ready" && attempt.naturalProposal !== undefined
        ? [{
            id: band.id,
            phaseEnteredDay: attempt.phaseEnteredDay,
            lineageId: attempt.lineageId,
          }]
        : [];
    })
    .sort(compareReadyParents);

  for (const candidate of candidates) {
    const parent = current.bands[candidate.id];
    const attempt = parent?.fissionAttempt;
    if (
      parent === undefined ||
      attempt?.phase !== "departure_ready" ||
      attempt.naturalProposal === undefined ||
      attempt.lineageId !== candidate.lineageId
    ) {
      continue;
    }

    // Readiness written today is not executable today, even under re-entrant calls.
    if (today <= attempt.phaseEnteredDay) continue;

    // The seasonal pipeline follows the daily span on a crossed boundary. Birth here would grant a
    // same-day seasonal turn, so the first legal execution is the next non-boundary day.
    if (today % SEASON_LENGTH_DAYS === 0) {
      records.push({
        parentId: String(parent.id),
        lineageId: attempt.lineageId,
        day: today,
        kind: "deferred_for_season_boundary",
      });
      continue;
    }

    // Proposal-time capacity is advisory. This count is taken from the world after every preceding
    // accepted departure, so simultaneous ready attempts cannot collectively exceed the same cap.
    if (Object.keys(current.bands).length >= NOMADIC_MAX_MOBILE_BANDS_WARNING_COUNT) {
      records.push({
        parentId: String(parent.id),
        lineageId: attempt.lineageId,
        day: today,
        kind: "deferred_for_band_cap",
      });
      continue;
    }

    const successorId = makeNaturalSuccessorBandId(attempt.lineageId);
    const outcome = performAtomicDeparture({
      world: current,
      parentId: parent.id,
      today,
      successorBandId: successorId,
      lineageId: attempt.lineageId,
    });

    if (outcome.ok === true) {
      current = outcome.world;
      records.push({
        parentId: String(parent.id),
        lineageId: attempt.lineageId,
        day: today,
        kind: "departed",
        successorId: String(outcome.successorId),
        ledger: outcome.ledger,
      });
      continue;
    }

    if (isStaleReadyRefusal(outcome.refusal)) {
      const abandoned = abandonPreparedDeparture(current, parent.id, today);
      if (abandoned.ok === true) {
        current = abandoned.world;
        records.push({
          parentId: String(parent.id),
          lineageId: attempt.lineageId,
          day: today,
          kind: "stale_ready_terminalized",
          refusal: outcome.refusal,
          detail: outcome.detail,
        });
        continue;
      }
    }

    records.push({
      parentId: String(parent.id),
      lineageId: attempt.lineageId,
      day: today,
      kind: "structural_refusal_left_for_deadline",
      refusal: outcome.refusal,
      detail: outcome.detail,
    });
  }

  return { world: current, records };
}

/** Must remain the absolute LAST daily action; see `dailyActionRegistry.ts`. */
export const naturalFissionPhysicalDepartureDailyAction: DailyAction = {
  id: "natural_fission_physical_departure",
  firesOnDayOfSeason: () => true,
  apply: (world, day) => advanceNaturalFissionPhysicalDeparture(world, day).world,
};
