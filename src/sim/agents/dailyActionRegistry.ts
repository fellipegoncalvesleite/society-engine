// EXPEDITIONARY-2 (Slice A) — the neutral daily-action registry boundary.
//
// WHY THIS MODULE EXISTS: the registry used to live in `intraSeasonTrips.ts`. Adding
// the expedition daily action there would have created
//   intraSeasonTrips → expedition → intraSeasonTrips
// and because the registry is a module-initialization `const`, the cycle would hit a
// temporal-dead-zone at import time (the array would capture an undefined handler
// depending on which module the bundler initialized first). That is an import-ORDER
// dependent runtime bug, i.e. exactly the kind of nondeterminism this simulator
// forbids.
//
// The fix is a leaf module that depends on BOTH action owners and is depended on by
// NEITHER. `expedition.ts` may freely import `intraSeasonTrips.ts` (it reuses the trip
// record + physical harvest machinery), and `intraSeasonTrips.ts` imports nothing from
// `expedition.ts`. The dependency graph stays acyclic:
//
//   tick/advance.ts → dailyActionRegistry.ts → { intraSeasonTrips.ts, expedition.ts }
//                                              expedition.ts → intraSeasonTrips.ts
//
// Registration order is a fixed literal (never sorted at runtime, never mutated), so
// the daily reducers always run in the same deterministic sequence. Trips run BEFORE
// expeditions on a shared day: a departing party's workers are committed by the
// seasonal decision, so same-day trips that day already see the reduced camp labor,
// and a returning party's receipt lands after the day's ordinary foraging is recorded
// — a stable, explainable order rather than an emergent one.
import type { DailyAction } from "./dailyActions";
import { expeditionDailyAction } from "./expedition";
import { intraSeasonTripDailyAction } from "./intraSeasonTrips";
import { provisionalTravelDailyAction } from "./provisionalTravel";
import { provisionalReintegrationDailyAction } from "./provisionalReintegration";
import { provisionalSubsistenceDailyAction } from "./provisionalTravelSubsistence";
import { provisionalReturnDecisionDailyAction } from "./provisionalReturnDecision";
import { provisionalEstablishmentDailyAction } from "./provisionalEstablishment";
import { provisionalLifecycleDeadlineDailyAction } from "./provisionalLifecycleResolver";

/**
 * The default daily-action registry advanced by `advanceWorldByDays`.
 *
 * Fixed order, no runtime mutation, no UI/render/store dependency. Adding an action
 * here is the ONLY sanctioned way to run sub-season physical work.
 */
export const DEFAULT_DAILY_ACTIONS: readonly DailyAction[] = [
  intraSeasonTripDailyAction,
  expeditionDailyAction,
  // ROADMAP ITEM 4 — provisional travel runs LAST on a shared day, after ordinary trips and
  // expeditions, so a walking group's step is taken against a world whose ordinary activity for that
  // day has already resolved. It is a no-op for every band that is not a walking provisional
  // successor, and nothing in ordinary play creates one.
  provisionalTravelDailyAction,
  // ROADMAP ITEM 4 — the meeting is resolved on the day it happens, immediately after the step that
  // can create it and BEFORE anything else reads the group. Two consequences, both deliberate: the
  // positions compared are the ones today produced, and a group handed back to its parent does not
  // then spend the same evening foraging as an independent entity, closing an assessment window, or
  // gathering evidence about a site it no longer occupies. `performAtomicReintegration` leaves the
  // successor terminal and `isProvisionalSuccessor` is false for every terminal phase, so the three
  // actions below skip it structurally rather than by an added guard.
  provisionalReintegrationDailyAction,
  // ROADMAP ITEM 4 — subsistence runs AFTER the step, so the group feeds itself on the tile it
  // actually camps on rather than the one it left that morning. Same no-op property: it touches only
  // live provisional successors, and no natural path creates one.
  provisionalSubsistenceDailyAction,
  // ROADMAP ITEM 4 — then the group reads the day it has just lived. Giving up comes before trying
  // harder: a group that has decided to walk home does not spend the same day accumulating evidence
  // about a site it is leaving.
  provisionalReturnDecisionDailyAction,
  provisionalEstablishmentDailyAction,
  // ROADMAP ITEM 4 — LAST: a lifecycle bound declared in DAYS is evaluated every day. It used to be
  // evaluated only inside the seasonal tick, so a 180-day bound could bind at 269; measured lateness
  // was 41 and 76 days on one real run. Placed after the day's physical actions so a group that gives
  // up today still walked, ate and read its ground today. The seasonal call is RETAINED — it sits
  // immediately after viability, which is where a group emptied by the annual demographic step must
  // still be caught.
  provisionalLifecycleDeadlineDailyAction,
];
