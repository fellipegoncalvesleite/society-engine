/**
 * ROADMAP ITEM 4 — THE CANONICAL PARENT-ATTEMPT DEADLINE ADAPTER.
 *
 * The pure lifecycle kernel declares parent-side bounds in DAYS. This world adapter evaluates those
 * bounds daily, in deterministic band-id order. Its only job is termination: it never plans, commits,
 * moves bodies, creates a successor, stabilizes or reintegrates anything.
 *
 * A timeout delegates the actual world write to `abandonPreparedDeparture`. That existing authority
 * is deliberately used even for unprepared proposals because it owns the load-bearing operation:
 * when a `departure_ready` attempt expires, the historical commitment and exact allocation remain,
 * while the live one-use permit becomes `withdrawn_before_departure`. Permit-ending semantics are
 * therefore defined once, not copied here.
 */

import type { DailyAction } from "./dailyActions";
import { abandonPreparedDeparture } from "./fissionDeparturePreparation";
import { resolveTimeout } from "./fissionLifecycleKernel";
import type { Band, FissionLifecycleRecord } from "./types";
import type { BandId } from "../core/types";
import type { WorldState } from "../world/types";

export interface ParentAttemptDeadlineResolution {
  readonly parentId: string;
  readonly lineageId: string;
  readonly fromPhase: "proposed" | "departure_planned" | "departure_ready";
  readonly toPhase: "abandoned";
  readonly day: number;
  readonly permitStatusBefore?: string;
  readonly permitStatusAfter?: string;
}

export interface ParentAttemptResolverResult {
  readonly world: WorldState;
  readonly resolutions: readonly ParentAttemptDeadlineResolution[];
}

const isBoundedParentPhase = (
  record: FissionLifecycleRecord,
): record is FissionLifecycleRecord & {
  readonly phase: "proposed" | "departure_planned" | "departure_ready";
} => record.phase === "proposed" || record.phase === "departure_planned" || record.phase === "departure_ready";

/** Resolve expired current parent attempts and nothing else. */
export function resolveParentFissionAttemptDeadlines(
  world: WorldState,
  today: number,
): ParentAttemptResolverResult {
  let current = world;
  const resolutions: ParentAttemptDeadlineResolution[] = [];
  const parentIds = Object.values(world.bands)
    .filter((band) => band.fissionAttempt !== undefined && isBoundedParentPhase(band.fissionAttempt))
    .map((band) => band.id)
    .sort((a, b) => String(a).localeCompare(String(b)));

  for (const parentId of parentIds) {
    const parent: Band | undefined = current.bands[parentId];
    const attempt = parent?.fissionAttempt;
    if (parent === undefined || attempt === undefined || !isBoundedParentPhase(attempt)) continue;

    const timeout = resolveTimeout(
      { phase: attempt.phase, phaseEnteredDay: attempt.phaseEnteredDay, history: attempt.history },
      today,
    );
    if (timeout.ok !== true || timeout.timedOut !== true || timeout.state.phase !== "abandoned") continue;

    const permitStatusBefore = attempt.preparedDeparture?.authorization.status;
    const abandoned = abandonPreparedDeparture(current, parent.id, today);
    if (abandoned.ok !== true) continue;
    current = abandoned.world;
    const permitStatusAfter = current.bands[parent.id]?.fissionAttempt?.preparedDeparture?.authorization.status;
    resolutions.push({
      parentId: String(parent.id),
      lineageId: attempt.lineageId,
      fromPhase: attempt.phase,
      toPhase: "abandoned",
      day: today,
      ...(permitStatusBefore === undefined ? {} : { permitStatusBefore }),
      ...(permitStatusAfter === undefined ? {} : { permitStatusAfter }),
    });
  }

  return { world: current, resolutions };
}

/**
 * Registered before natural progression. On the exact deadline day the old phase is abandoned
 * before it can advance or prepare, so a phase cannot evade its declared maximum by transitioning
 * first.
 */
export const parentFissionAttemptDeadlineDailyAction: DailyAction = {
  id: "parent_fission_attempt_deadline",
  firesOnDayOfSeason: () => true,
  apply: (world, day) => resolveParentFissionAttemptDeadlines(world, day).world,
};
