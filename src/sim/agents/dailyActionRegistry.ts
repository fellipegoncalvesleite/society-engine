import type { DailyAction } from "./dailyActions";
import { ordinaryTripDailyAction } from "./ordinaryTrips";
import { expeditionDailyAction } from "./expeditions";
import { parentFissionAttemptDeadlineDailyAction } from "./parentFissionAttemptResolver";
import { naturalFissionPreDepartureDailyAction } from "./naturalFissionPreDeparture";
import { provisionalTravelDailyAction } from "./provisionalTravel";
import { reintegrationDailyAction } from "./provisionalReintegration";
import { provisionalSubsistenceDailyAction } from "./provisionalTravelSubsistence";
import { provisionalReturnDecisionDailyAction } from "./provisionalReturnDecision";
import { postReturnReconsiderationDailyAction } from "./postReturnReconsideration";
import { provisionalDispositionDailyAction } from "./provisionalDisposition";
import { provisionalEstablishmentDailyAction } from "./provisionalEstablishment";
import { successorStabilizationDailyAction } from "./successorStabilization";
import { postReturnEstablishmentDailyAction } from "./postReturnEstablishment";
import { provisionalLifecycleDeadlineDailyAction } from "./provisionalLifecycleResolver";
import { naturalFissionPhysicalDepartureDailyAction } from "./naturalFissionPhysicalDeparture";

/**
 * TIME-1C — the one central registry for in-season daily actions.
 *
 * ORDER IS PART OF THE CAUSAL MODEL, not an implementation detail:
 *
 * 1. ordinary trips and expedition parties resolve their current-day work;
 * 2. parent fission deadlines can terminate stale parent-side consideration before progression;
 * 3. natural pre-departure may advance at most one proposal/preparation phase;
 * 4. already-existing provisional successors then receive their ordinary physical/lifecycle day;
 * 5. the provisional deadline resolver closes any still-current bounded successor action;
 * 6. natural physical departure runs ABSOLUTELY LAST.
 *
 * Step 6 is deliberately last. A successor created there did not exist for steps 1–5 and therefore
 * receives no free travel, subsistence, return decision, establishment, stabilization, reintegration
 * or deadline work on its physical departure day. `naturalFissionPhysicalDeparture` additionally
 * refuses a season-boundary birth because the seasonal compatibility pipeline follows this daily span.
 *
 * A registered reducer is pure and receives the explicit simulated `day`; none may consult wall time
 * or infer its execution day from a stale `world.time` snapshot.
 */
export const DAILY_ACTIONS: readonly DailyAction[] = [
  ordinaryTripDailyAction,
  expeditionDailyAction,
  parentFissionAttemptDeadlineDailyAction,
  naturalFissionPreDepartureDailyAction,
  provisionalTravelDailyAction,
  reintegrationDailyAction,
  provisionalSubsistenceDailyAction,
  provisionalReturnDecisionDailyAction,
  postReturnReconsiderationDailyAction,
  provisionalDispositionDailyAction,
  provisionalEstablishmentDailyAction,
  successorStabilizationDailyAction,
  postReturnEstablishmentDailyAction,
  provisionalLifecycleDeadlineDailyAction,
  naturalFissionPhysicalDepartureDailyAction,
];

/**
 * A cheap import-time invariant. Moving the cutover action earlier would grant newborn successors a
 * same-day turn and silently change physical truth, so fail loudly instead of relying on a comment.
 */
if (DAILY_ACTIONS[DAILY_ACTIONS.length - 1]?.id !== "natural_fission_physical_departure") {
  throw new Error("natural_fission_physical_departure must remain the last daily action");
}
