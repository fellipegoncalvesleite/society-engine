/**
 * ROADMAP ITEM 4 — WHAT A WALKING GROUP EATS AND DRINKS.
 *
 * ── THE DEFECT THIS CLOSES, AND WHY IT WAS NOT A NUMBER ──────────────────────────────────────────
 *
 * The previous pass measured a group whose hunger FELL TO ZERO while it walked with no camp, no
 * receipt and no food. It looked like a missing floor. It was not. Traced link by link
 * (`travel-subsistence-reproduction.json`):
 *
 *   the departure resets `seasonalSupport` — CORRECTLY, it is a history of seasons this group did not
 *     live as itself —
 *   → the group walks onto ground it has never observed
 *   → `deriveCarryingCapacity` REFUSES without an observed record of the band's own position
 *   → `updateSeasonalSupportState` returns its previous value, which is absent
 *   → `deriveCanonicalNutritionState(undefined)` returns every stress term at 0
 *   → five separate readers consume those zeros as comfort.
 *
 * So the group was not measured as unhungry. **It was never asked.** A hunger floor would have put a
 * tuned number where the missing thing is a measurement, and the measurement is missing because a
 * travelling group's food does not arrive in the unit the residential system measures.
 *
 * ── WHAT WAS COMPARED, AND WHY THIS IS THE SMALLEST HONEST ANSWER ────────────────────────────────
 *
 *   1. **Debited carried provisions from an existing real stock.** REJECTED ON INSPECTION, not on
 *      preference: there is no such stock. `consumeProvisions` only increments a counter and
 *      CORRECTION-34B recorded in so many words that "no residential store is decremented at launch"
 *      and that full material conservation is explicitly NOT claimed for provisions. Debiting a store
 *      that does not exist is a background ration with a subtraction sign in front of it.
 *   2. **Opportunistic traveller extraction along the route.** CHOSEN. The group forages the ground it
 *      is standing on, through the canonical plant-harvest owner, which finds a real patch, bounds the
 *      take by its real current availability, and persists the real depletion. Every unit is sourced.
 *   3. **An explicit bounded combination of 1 and 2.** REJECTED with 1, since it inherits 1's invented
 *      stock and adds a second magnitude to justify.
 *   4. **Readmit the group to ordinary same-day trips.** REJECTED on physics: a same-day trip is a
 *      ROUND TRIP FROM A CAMP, sized by the adults who stayed at home. A column on the move has no
 *      camp and nobody at home, so the trip authority would be answering a question about an
 *      arrangement that does not exist — and the quarantine removed it for exactly that reason.
 *
 * ── WHAT IS NEW HERE AND WHAT IS BORROWED ────────────────────────────────────────────────────────
 *
 * Borrowed, deliberately: the extraction itself (`resolvePlantFoodHarvest` — the same function every
 * ordinary gather goes through), the demand scale (`derivePopulationDemand`, the canonical
 * adult-equivalent), the per-worker day of gathering (production's existing `0.035` term), the
 * processing loss (the patch's own rate), the water term (production's own leading water-stress term)
 * and the carried-water authority (`deriveCarriedWaterRelief`, which grants nothing without a real
 * learned practice). The derived support state is written through the ONE writer,
 * `recordSupportInterval`.
 *
 * New, and only this: an INTERVAL. A residential band is measured once a season because that is the
 * unit its food arrives in; a walking group's interval is its own, and closing it is what turns "we
 * have not asked" into "we asked, and the answer is bad".
 */
import { isProvisionalSuccessor } from "./bandLifecycle";
import { derivePopulationDemand } from "./carryingCapacity";
import { deriveCarriedWaterRelief } from "./adaptationBoundary";
import { resolvePlantFoodHarvest } from "./plantStock";
import { recordSupportInterval } from "./seasonalSurvival";
import { getTile } from "../world/generate";
import { getWorldTimeForDay } from "../tick/time";
import type {
  Band,
  FissionLifecycleRecord,
  OpenSubsistenceAssessmentWindow,
  ProvisionalOperationHistory,
  SubsistenceAssessmentWindow,
  SeasonalSupportSample,
  SeasonalSupportState,
  TravelSubsistenceDay,
  TravelSubsistenceState,
} from "./types";
import type { BandId, DayNumber, TileId } from "../core/types";
import type { WorldState } from "../world/types";
import type { DailyAction } from "./dailyActions";

// ── authority boundaries, stated as such ────────────────────────────────────────────────────────
//
// None of these is a measured duration or a calibrated magnitude, and no natural run was used to fit
// one. They exist so that a physical quantity has a bound; where production already owned the number,
// it is reused rather than re-chosen.

/**
 * One worker's day of gathering, in support units.
 *
 * PRODUCTION'S OWN MAGNITUDE, not a new one: `buildTripRecord` sizes an ordinary gathering trip's
 * request as `estimatedPeopleCount * 0.035 + yieldConfidence * 0.22 + presenceConfidence * 0.08`. The
 * per-person term is the labour term; the other two are CONFIDENCE IN A REMEMBERED PATCH, which a
 * group walking through country it has never seen does not have. Taking the labour term alone is the
 * conservative half of an existing equation, and it is why a traveller gathers LESS per worker-day
 * than a band working a patch it knows.
 */
export const TRAVEL_GATHER_PER_WORKER_DAY = 0.035;

/** Days a group may walk before its condition is re-read. The interval also closes at a phase change. */
export const TRAVEL_SUPPORT_INTERVAL_DAYS = 30;

/** Bounded evidence ring. A journey is not a log of itself. */
export const TRAVEL_SUBSISTENCE_DAY_CAP = 12;

/**
 * The share of a day's worker effort that goes to finding food even when nobody is hungry, and the
 * span need can add to it. People eat every day; the ceiling is below 1 because a group that stopped
 * moving entirely would not be travelling, and its phase would be a lie.
 */
export const TRAVEL_GATHER_BASE_SHARE = 0.2;
export const TRAVEL_GATHER_NEED_SPAN = 0.6;

/** Production's own leading water-stress term, `(1 - waterAccess) * 0.52` (`pressure.ts`). */
const WATER_ACCESS_STRESS_WEIGHT = 0.52;
/** Above this measured stress the group stood somewhere it could not drink. */
export const TRAVEL_NO_WATER_STRESS = 0.4;

const SEASON_LENGTH_DAYS = 90;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const round4 = (value: number): number => Math.round(value * 10000) / 10000;

/** The phases in which a group is physically out in the country, feeding itself or failing to. */
export const SUBSISTENCE_PHASES: readonly string[] = [
  "travelling",
  "establishing",
  "failed_early",
  "returning",
  "unresolved_after_failed_return",
];

export function isSubsistencePhase(phase: string): boolean {
  return SUBSISTENCE_PHASES.includes(phase);
}

export function emptyTravelSubsistence(day: number): TravelSubsistenceState {
  return {
    intervalStartDay: day,
    lastAdvancedDay: day,
    daysElapsed: 0,
    demandUnits: 0,
    supportUnits: 0,
    harvestUnits: 0,
    processingLossUnits: 0,
    depletionApplied: 0,
    gatheringDays: 0,
    gatheringDaysWithAnyTake: 0,
    waterStressDaySum: 0,
    daysWithoutWater: 0,
    recentDays: [],
    closedIntervals: 0,
  };
}

/**
 * THE MOVEMENT-VERSUS-SUBSISTENCE TRADEOFF.
 *
 * A day has one set of workers in it. Ground covered and food found compete for them, and need may
 * change WILLINGNESS without creating labour or food: a hungry column stops more often to look, and
 * finds whatever is actually there — which on bad ground is nothing.
 *
 * It reads only state the group owns: its own measured condition and its own bodies. It never reads
 * the destination's richness, the parent, or whether the journey will work.
 *
 * There is no universally optimal choice here because the choice does not decide the outcome: the same
 * share on rich ground feeds the group and on bare ground returns nothing, and slowing down to gather
 * lengthens the journey whether or not it pays.
 */
export function deriveTravelEffortSplit(band: Band): {
  readonly gatherShare: number;
  readonly gatheringWorkers: number;
  readonly movementShare: number;
  readonly measuredNeed: number;
} {
  const workers = Math.max(0, Math.round(band.demography.workingAdults));
  const subsistence = band.provisionalSuccessor?.travelSubsistence;
  // Need is the group's OWN running measurement, plus the condition its bodies left with. Both are
  // things it has lived; neither is a forecast.
  const runningDeficit = subsistence === undefined || subsistence.demandUnits <= 0
    ? clamp01(band.hungerPressure ?? 0)
    : clamp01(1 - subsistence.supportUnits / subsistence.demandUnits);
  const thirst = subsistence === undefined || subsistence.daysElapsed <= 0
    ? 0
    : clamp01(subsistence.waterStressDaySum / subsistence.daysElapsed);
  const measuredNeed = clamp01(Math.max(runningDeficit, thirst));
  // ── AND WHETHER THIS GROUND IS GIVING ANYTHING ──
  //
  // Need alone would make a starving group spend most of every day searching bare country, which is
  // the opposite of what hunger should produce: more hours on ground that has returned nothing is not
  // more food, it is fewer miles. So the group's OWN recent days scale its willingness. Ground it has
  // not tested yet reads neutral — an untested place is neither promising nor barren, and treating it
  // as either would be knowledge it does not have.
  const recent = subsistence?.recentDays ?? [];
  const attempted = recent.filter((entry) => entry.gatheringWorkers > 0).length;
  const productive = recent.filter((entry) => entry.usableUnits > 0).length;
  const groundIsGiving = attempted === 0 ? 0.5 : productive / attempted;
  const gatherShare = clamp01(TRAVEL_GATHER_BASE_SHARE + measuredNeed * TRAVEL_GATHER_NEED_SPAN * groundIsGiving);
  return {
    gatherShare: round4(gatherShare),
    // Workers, not bodies. CORRECTION-34D's rule: consumption is charged on bodies and work on
    // productive labour, so dependents and elders eat here and gather nothing.
    //
    // Rounded rather than floored, with a floor of one for any group that has a worker at all: a
    // fixture caught `Math.floor` allocating ZERO gatherers to a group of four at a fifth of a day,
    // so a small comfortable group walked past every patch it stood on without anyone looking. People
    // walking through country keep an eye out; what varies is how much of the day goes to it.
    gatheringWorkers: workers <= 0 ? 0 : Math.max(1, Math.round(workers * gatherShare)),
    movementShare: round4(1 - gatherShare),
    measuredNeed: round4(measuredNeed),
  };
}

/**
 * The day's demand, in the same adult-equivalent units the support ratio is measured against.
 *
 * `derivePopulationDemand` is the canonical demand authority and returns a SEASON's demand, so a day
 * is one ninetieth of it. Charged on BODIES: dependents and elders eat while walking.
 */
export function deriveTravelDailyDemand(band: Band): number {
  return round4(Math.max(0, derivePopulationDemand(band).adultEquivalentDemand) / SEASON_LENGTH_DAYS);
}

export interface TravelSubsistenceResult {
  readonly world: WorldState;
  readonly days: readonly TravelSubsistenceDay[];
  readonly closedIntervals: readonly SeasonalSupportSample[];
}

/**
 * Advance one physical day of subsistence for every provisional group that is out in the country.
 *
 * Deterministic: bands in a canonical id sort, one take per group per day, no randomness, no wall
 * clock. A day is charged exactly once — `lastAdvancedDay` is the guard, so a re-entrant caller or a
 * differently batched step mode cannot feed a group twice or starve it twice.
 */
export function advanceProvisionalSubsistence(world: WorldState, day: number): TravelSubsistenceResult {
  const days: TravelSubsistenceDay[] = [];
  const closed: SeasonalSupportSample[] = [];
  let current = world;
  const bands: Record<string, Band> = { ...world.bands };
  let changed = false;

  for (const band of Object.values(world.bands).sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
    if (!isProvisionalSuccessor(band)) continue;
    const record = band.provisionalSuccessor as FissionLifecycleRecord;
    if (!isSubsistencePhase(record.phase)) continue;
    if (Math.round(band.demography.population) <= 0) continue;

    const previous = record.travelSubsistence ?? emptyTravelSubsistence(day);
    // A day may be charged exactly once. Without this a second caller on the same day would take
    // twice from the same patch and credit the take twice.
    if (previous.daysElapsed > 0 && previous.lastAdvancedDay >= day) continue;

    const live = bands[String(band.id)] ?? band;
    const split = deriveTravelEffortSplit(live);
    const demandUnits = deriveTravelDailyDemand(live);
    const tile = getTile(current, live.position);

    // ── WATER, measured where the group is standing ──
    //
    // The ground's own water access is a PHYSICAL EXECUTION CONSTRAINT of the same kind as passability:
    // people find out whether they can drink here by being here. It grants no knowledge of anywhere
    // else. Carried water relieves it ONLY through the existing learned-practice authority, which
    // returns nothing to a group that never learned to carry water — so no vessel is invented.
    const waterAccess = clamp01(tile?.resourceProfile.waterAccess ?? 0);
    const carriedWater = deriveCarriedWaterRelief(live, Number(getWorldTimeForDay(day as DayNumber).tick ?? 0), {
      routeDurationSteps: Math.min(8, Math.max(1, previous.daysElapsed)),
    });
    const waterStress = clamp01((1 - waterAccess) * WATER_ACCESS_STRESS_WEIGHT - (carriedWater.relief ?? 0));

    // ── FOOD, taken from a real source at the tile the group is standing on ──
    const requestedUnits = round4(split.gatheringWorkers * TRAVEL_GATHER_PER_WORKER_DAY);
    let harvestedUnits = 0;
    let usableUnits = 0;
    let depletionApplied = 0;
    let sourceKind: TravelSubsistenceDay["sourceKind"] = "none";
    let sourceId: string | undefined;
    let failureReason: TravelSubsistenceDay["failureReason"] | undefined;

    if (tile === undefined || split.gatheringWorkers <= 0 || requestedUnits <= 0) {
      failureReason = "no_workers_allocated";
    } else {
      const time = getWorldTimeForDay(day as DayNumber);
      const harvest = resolvePlantFoodHarvest(current, tile, time, requestedUnits, true);
      current = harvest.world;
      sourceKind = harvest.sourceFound ? "plant_patch" : "none";
      sourceId = harvest.sourceId;
      harvestedUnits = round4(harvest.harvestedAmount);
      depletionApplied = round4(harvest.depletionApplied);
      failureReason = harvest.failureReason;
      // The group is STANDING on the source, so there is no transport leg and no transport loss —
      // the same `min(0.25, roundTripTiles * 0.012)` rule production applies, at zero tiles. The
      // patch's own processing loss is charged in full.
      const processingLoss = harvestedUnits * harvest.processingLossRate;
      usableUnits = round4(Math.max(0, harvestedUnits - processingLoss));
    }

    const dayRecord: TravelSubsistenceDay = {
      day,
      tileId: live.position,
      gatherShare: split.gatherShare,
      gatheringWorkers: split.gatheringWorkers,
      requestedUnits,
      harvestedUnits,
      usableUnits,
      depletionApplied,
      demandUnits,
      waterStress: round4(waterStress),
      sourceKind,
      ...(sourceId === undefined ? {} : { sourceId }),
      ...(failureReason === undefined ? {} : { failureReason }),
    };
    days.push(dayRecord);

    const recentDays = [...previous.recentDays, dayRecord];
    const advanced: TravelSubsistenceState = {
      ...previous,
      lastAdvancedDay: day,
      daysElapsed: previous.daysElapsed + 1,
      demandUnits: round4(previous.demandUnits + demandUnits),
      supportUnits: round4(previous.supportUnits + usableUnits),
      harvestUnits: round4(previous.harvestUnits + harvestedUnits),
      processingLossUnits: round4(previous.processingLossUnits + Math.max(0, harvestedUnits - usableUnits)),
      depletionApplied: round4(previous.depletionApplied + depletionApplied),
      gatheringDays: previous.gatheringDays + (split.gatheringWorkers > 0 ? 1 : 0),
      gatheringDaysWithAnyTake: previous.gatheringDaysWithAnyTake + (usableUnits > 0 ? 1 : 0),
      waterStressDaySum: round4(previous.waterStressDaySum + waterStress),
      daysWithoutWater: previous.daysWithoutWater + (waterStress >= TRAVEL_NO_WATER_STRESS ? 1 : 0),
      recentDays: recentDays.length > TRAVEL_SUBSISTENCE_DAY_CAP
        ? recentDays.slice(recentDays.length - TRAVEL_SUBSISTENCE_DAY_CAP)
        : recentDays,
      closedIntervals: previous.closedIntervals,
    };

    // ── close the interval when its bound expires ──
    const shouldClose = advanced.daysElapsed >= TRAVEL_SUPPORT_INTERVAL_DAYS;
    let seasonalSupport: SeasonalSupportState | undefined = live.seasonalSupport;
    let subsistence = advanced;
    let closedSample: SeasonalSupportSample | undefined;
    if (shouldClose) {
      const closure = closeTravelSupportInterval(live, advanced, day);
      seasonalSupport = closure.support;
      subsistence = closure.next;
      closedSample = closure.sample;
      closed.push(closure.sample);
    }

    changed = true;
    bands[String(band.id)] = {
      ...live,
      seasonalSupport,
      // The compatibility mirror `socialContext.ts` maintains for every ordinary band, maintained here
      // for the one kind of band that never reaches that writer. It is a mirror, not a second state.
      hungerPressure: deriveTravelHunger({ ...live, seasonalSupport }, subsistence),
      provisionalSuccessor: {
        ...record,
        travelSubsistence: subsistence,
        // The same physically charged day also advances bounded descriptive history. This history has
        // no attempt or lifecycle authority; every living subsistence phase is measured alike.
        operationHistory: advanceOperationHistory(
          record.operationHistory, dayRecord, split.gatheringWorkers,
          Math.max(0, derivePopulationDemand(live).adultEquivalentDemand),
        ),
      },
    };
  }

  return {
    world: changed
      ? { ...current, bands: { ...current.bands, ...bands } as Readonly<Record<BandId, Band>> }
      : current,
    days,
    closedIntervals: closed,
  };
}

/** Distinct positive-take tiles retained as bounded physical history, never as an identity rule. */
export const PHYSICAL_TAKE_TILE_CAP = 16;

/**
 * Exactly the physical fact written by the boolean retained on an assessment window.
 *
 * Positive usable support plus positive depletion proves that some real food was taken. It proves no
 * share of demand, no self-sufficiency, no independence, and no lifecycle outcome.
 */
export function assessmentHadAnyOwnPhysicalTake(subsistence: TravelSubsistenceState): boolean {
  return subsistence.supportUnits > 0 && subsistence.depletionApplied > 0;
}

/** Recent assessment windows retained as bounded descriptive history, newest last. */
export const RECENT_ASSESSMENT_WINDOW_CAP = 8;

/**
 * THE MEASUREMENT UNIT: one assessment closes when the group has incurred this fraction of a
 * season's adult-equivalent demand.
 *
 * ── WHY DEMAND AND NOT DAYS ─────────────────────────────────────────────────────────────────────
 *
 * The question an assessment answers is "what did these people obtain against what their bodies
 * needed", so the denominator is the honest thing to measure the window in. A day count answers it
 * only for one group size; eleven people and four people accumulate need at different rates, and a
 * fixed day window would sample them unequally while claiming to compare them.
 *
 * STATED HONESTLY: because daily demand is seasonal demand / 90 and this target is seasonal demand /
 * 9, the same demand algebraically cancels for a stable composition. The window is therefore about
 * ten days (ten or eleven under four-decimal accumulation). That makes it a useful uniform measuring
 * cadence and gives it ZERO lifecycle authority: closing one or many windows proves no outcome.
 *
 * ONE NINTH, because `derivePopulationDemand` returns a SEASON and a season is the cadence at which
 * the residential system asks the same question. A ninth of it is short enough that a group gets
 * several readings before the return decision acts at fourteen days, and long enough that a single
 * day's luck cannot fill it.
 *
 * It closes a SAMPLE, never an outcome: a rich window and a sterile window close by the same rule and
 * produce the same schema. The separate stabilization authority may consume a completed window, but
 * the closer remains outcome-blind and has no lifecycle authority of its own.
 */
export const ASSESSMENT_DEMAND_FRACTION_OF_SEASON = 1 / 9;

export function emptyOperationHistory(): ProvisionalOperationHistory {
  return {
    lifetimeDaysWithAnyPhysicalTake: 0,
    lifetimeAssessmentWindows: 0,
    lifetimeWindowsWithAnyPhysicalTake: 0,
    lifetimeTileIdsWithAnyPhysicalTake: [],
    recentAssessmentWindows: [],
  };
}

/** Close a running measurement. Zero support closes as measured zero, not silence. */
export function closeOpenAssessmentWindow(
  open: OpenSubsistenceAssessmentWindow,
  endDay: number,
  closedBy: SubsistenceAssessmentWindow["closedBy"],
): SubsistenceAssessmentWindow {
  return {
    tileIds: open.tileIds,
    tileIdsWithAnyPhysicalTake: open.tileIdsWithAnyPhysicalTake,
    startDay: open.startDay,
    endDay,
    days: open.days,
    supportUnits: round4(open.supportUnits),
    demandUnits: round4(open.demandUnits),
    daysWithAnyPhysicalTake: open.daysWithAnyPhysicalTake,
    waterStressDaySum: round4(open.waterStressDaySum),
    workerDays: open.workerDays,
    depletionApplied: round4(open.depletionApplied),
    closedBy,
    hadAnyOwnPhysicalTake: open.supportUnits > 0 && open.depletionApplied > 0,
  };
}

/** Fold one closed window into bounded descriptive history. */
function foldAssessmentWindow(
  base: ProvisionalOperationHistory,
  window: SubsistenceAssessmentWindow,
): ProvisionalOperationHistory {
  const tiles = window.hadAnyOwnPhysicalTake
    ? [...new Set([...base.lifetimeTileIdsWithAnyPhysicalTake, ...window.tileIdsWithAnyPhysicalTake])]
      .slice(-PHYSICAL_TAKE_TILE_CAP)
    : base.lifetimeTileIdsWithAnyPhysicalTake;
  return {
    ...base,
    lifetimeAssessmentWindows: base.lifetimeAssessmentWindows + 1,
    lifetimeWindowsWithAnyPhysicalTake:
      base.lifetimeWindowsWithAnyPhysicalTake + (window.hadAnyOwnPhysicalTake ? 1 : 0),
    lifetimeTileIdsWithAnyPhysicalTake: tiles,
    recentAssessmentWindows: [...base.recentAssessmentWindows, window].slice(-RECENT_ASSESSMENT_WINDOW_CAP),
  };
}

/**
 * Close the bounded physical-operation measurement when provisional life ends.
 *
 * This preserves the final partial sample without pretending it completed the outcome-blind demand
 * window. Stabilization eligibility is derived before this close and accepts only
 * `demand_window_complete`, so a lifecycle end can never manufacture its own positive evidence.
 */
export function closeOperationHistoryForLifecycleEnd(
  history: ProvisionalOperationHistory | undefined,
  endDay: number,
): ProvisionalOperationHistory | undefined {
  const open = history?.openAssessmentWindow;
  if (history === undefined || open === undefined) return history;
  const folded = foldAssessmentWindow(history, closeOpenAssessmentWindow(open, endDay, "lifecycle_ended"));
  return { ...folded, openAssessmentWindow: undefined };
}

/**
 * Accumulate one physically lived day into bounded history, regardless of provisional phase.
 *
 * This function receives no phase because a phase is not an attempt authority. It measures travelling,
 * establishing, returning, failed, and unresolved living days alike and cannot request a transition.
 */
export function advanceOperationHistory(
  previous: ProvisionalOperationHistory | undefined,
  day: TravelSubsistenceDay,
  workersToday: number,
  /** A season's adult-equivalent demand for THIS group, so the window scales with the bodies in it. */
  seasonalDemand: number,
): ProvisionalOperationHistory {
  const assessmentWindowDemand = Math.max(1e-6, seasonalDemand * ASSESSMENT_DEMAND_FRACTION_OF_SEASON);
  const base = previous ?? emptyOperationHistory();
  const hadPhysicalTake = day.usableUnits > 0 && day.depletionApplied > 0;
  const withLifetime: ProvisionalOperationHistory = {
    ...base,
    lifetimeDaysWithAnyPhysicalTake:
      base.lifetimeDaysWithAnyPhysicalTake + (hadPhysicalTake ? 1 : 0),
  };

  // ── RELOCATION NO LONGER CLOSES THE MEASUREMENT ──────────────────────────────────────────────
  //
  // It used to, and that made the whole instrument answer a different question than it claimed.
  // An assessment closed on relocation, and relocation only happens after two barren days — so a
  // locality that FAILED produced a closed measurement every 3-4 days while a locality that WORKED
  // produced one only when the 10-day cap expired. Failure was sampled three times as often as
  // success, and the adversarial matrix showed the endpoint of that: rich localities A-D closed no
  // measurements at all inside the group's lifespan while the sterile arm E closed seven.
  //
  // "This place is finished" is a fact about the GROUND. "Here is what these people obtained against
  // what their bodies needed" is a fact about the GROUP. Closing the second whenever the first
  // happened is what tied the measurement unit to failure.
  //
  // So the locality is now recorded ON the assessment (`tileIds`) rather than bounding it, and the
  // assessment closes on one uniform rule below that does not care whether the ground was good.
  const open = withLifetime.openAssessmentWindow;
  if (open === undefined) {
    return { ...withLifetime, openAssessmentWindow: openAssessmentWindowAt(day, workersToday) };
  }
  const spannedTiles = open.tileIds.includes(day.tileId) ? open.tileIds : [...open.tileIds, day.tileId];

  const advanced: OpenSubsistenceAssessmentWindow = {
    ...open,
    tileIds: spannedTiles,
    tileIdsWithAnyPhysicalTake:
      hadPhysicalTake && !open.tileIdsWithAnyPhysicalTake.includes(day.tileId)
        ? [...open.tileIdsWithAnyPhysicalTake, day.tileId]
        : open.tileIdsWithAnyPhysicalTake,
    days: open.days + 1,
    supportUnits: round4(open.supportUnits + day.usableUnits),
    demandUnits: round4(open.demandUnits + day.demandUnits),
    daysWithAnyPhysicalTake: open.daysWithAnyPhysicalTake + (hadPhysicalTake ? 1 : 0),
    waterStressDaySum: round4(open.waterStressDaySum + day.waterStress),
    workerDays: open.workerDays + workersToday,
    depletionApplied: round4(open.depletionApplied + day.depletionApplied),
  };
  // One uniform, outcome-blind closer. A rich window and a sterile window both end here.
  if (advanced.demandUnits >= assessmentWindowDemand) {
    const folded = foldAssessmentWindow(
      withLifetime,
      closeOpenAssessmentWindow(advanced, day.day, "demand_window_complete"),
    );
    return { ...folded, openAssessmentWindow: undefined };
  }
  return { ...withLifetime, openAssessmentWindow: advanced };
}

function openAssessmentWindowAt(
  day: TravelSubsistenceDay,
  workersToday: number,
): OpenSubsistenceAssessmentWindow {
  const hadPhysicalTake = day.usableUnits > 0 && day.depletionApplied > 0;
  return {
    tileIds: [day.tileId],
    tileIdsWithAnyPhysicalTake: hadPhysicalTake ? [day.tileId] : [],
    startDay: day.day,
    days: 1,
    supportUnits: round4(day.usableUnits),
    demandUnits: round4(day.demandUnits),
    daysWithAnyPhysicalTake: hadPhysicalTake ? 1 : 0,
    waterStressDaySum: round4(day.waterStress),
    workerDays: workersToday,
    depletionApplied: round4(day.depletionApplied),
  };
}

/**
 * Turn a running interval into ONE measured sample and hand it to the single support-interval writer.
 *
 * `rawSupportRatio` is exactly what it is for a residential band: usable support over adult-equivalent
 * demand. The difference is only which physical arrangement produced the numerator. Zero support over
 * real demand is a ratio of zero, which is a food stress of one — the group is starving, and that is a
 * measurement rather than a penalty.
 */
export function closeTravelSupportInterval(
  band: Band,
  subsistence: TravelSubsistenceState,
  day: number,
): { readonly support: SeasonalSupportState; readonly sample: SeasonalSupportSample; readonly next: TravelSubsistenceState } {
  const time = getWorldTimeForDay(day as DayNumber);
  const demand = Math.max(0.0001, subsistence.demandUnits);
  const rawSupportRatio = round4(subsistence.supportUnits / demand);
  const waterStress = subsistence.daysElapsed <= 0
    ? 0
    : round4(clamp01(subsistence.waterStressDaySum / subsistence.daysElapsed));
  const sample: SeasonalSupportSample = {
    tick: time.tick,
    year: time.year,
    season: time.season,
    rawSupportRatio,
    clampedSupportRatio: clamp01(rawSupportRatio),
    // What one worker-day of gathering actually returned, on the same 0..1 scale the residential
    // per-capita return uses. It is measured, not projected.
    perCapitaReturn: clamp01(
      subsistence.gatheringDays <= 0
        ? 0
        : subsistence.supportUnits / (subsistence.gatheringDays * TRAVEL_GATHER_PER_WORKER_DAY),
    ),
    seasonalModifier: 1,
    foodStress: clamp01(1 - rawSupportRatio),
    waterStress,
    deficitRatio: clamp01(1 - rawSupportRatio),
    // The existing seasonal vocabulary, used for what it already means. `dry` when the binding
    // constraint was water rather than food, so a group that starved and a group that could not drink
    // are not filed under one word.
    mode: waterStress >= TRAVEL_NO_WATER_STRESS && waterStress > clamp01(1 - rawSupportRatio)
      ? "dry"
      : rawSupportRatio >= 1
        ? "neutral"
        : "lean",
  };
  const support = recordSupportInterval(band.seasonalSupport, sample, band, time, {
    topSeasonalSupportReasons: [
      `travel interval of ${subsistence.daysElapsed} days`,
      `${subsistence.gatheringDaysWithAnyTake} of ${subsistence.gatheringDays} gathering days took anything`,
      `${subsistence.daysWithoutWater} days standing where the group could not drink`,
    ],
    // A travel interval is its own unit. Replacing a same-tick sample would delete a real measurement
    // whenever two intervals happened to close inside one season.
    replaceSameTickSample: false,
  });
  return {
    support,
    sample,
    next: { ...emptyTravelSubsistence(day), closedIntervals: subsistence.closedIntervals + 1 },
  };
}

/**
 * Close whatever interval a group has open, because its journey has ended.
 *
 * An interval is a unit of measurement, and the natural end of one is the end of the situation it was
 * measuring. A group that reaches its parent, or stabilizes where it stands, has finished a stretch of
 * living out in the country, and leaving that stretch unmeasured is the same defect at a smaller
 * scale: the days would have been lived and never asked about. A group with nothing to close is
 * returned untouched.
 */
export function closeOpenTravelInterval(band: Band, day: number): Band {
  const record = band.provisionalSuccessor;
  const subsistence = record?.travelSubsistence;
  if (record === undefined || subsistence === undefined || subsistence.daysElapsed <= 0) return band;
  const closure = closeTravelSupportInterval(band, subsistence, day);
  return {
    ...band,
    seasonalSupport: closure.support,
    hungerPressure: deriveTravelHunger({ ...band, seasonalSupport: closure.support }, closure.next),
    provisionalSuccessor: { ...record, travelSubsistence: closure.next },
  };
}

/**
 * The group's current embodied hunger: the worse of what its last CLOSED measurement said and what its
 * RUNNING interval is saying now.
 *
 * Taking the worse of the two is the L2 rule in one line — a running deficit may make a group hungrier
 * before its interval closes, and a running surplus may not make it less hungry until the food has
 * actually been eaten over a measured interval. It never falls below what has been physically earned.
 */
export function deriveTravelHunger(band: Band, subsistence: TravelSubsistenceState | undefined): number {
  const measured = band.seasonalSupport?.foodMovementPressure ?? band.hungerPressure ?? 0;
  if (subsistence === undefined || subsistence.demandUnits <= 0) return round4(clamp01(measured));
  const runningDeficit = clamp01(1 - subsistence.supportUnits / subsistence.demandUnits);
  return round4(clamp01(Math.max(measured, runningDeficit)));
}

/**
 * The daily action.
 *
 * Registered AFTER travel so a day's step is taken first and the group then feeds itself where it
 * actually ends up standing — the tile it camps on, not the one it left. It is a no-op for every band
 * that is not a live provisional successor, and nothing in ordinary play creates one.
 */
export const provisionalSubsistenceDailyAction: DailyAction = {
  id: "provisional_travel_subsistence",
  firesOnDayOfSeason: () => true,
  apply: (world, day) => advanceProvisionalSubsistence(world, day).world,
};

/** Exported so audits assert the PRODUCTION predicate rather than re-implementing it. */
export function hasEarnedSupportWithoutExtraction(subsistence: TravelSubsistenceState): boolean {
  return subsistence.supportUnits > 0 && subsistence.depletionApplied <= 0;
}

/** Exported so a return trigger and establishment diagnostics read the same measured quantity. */
export function measuredTravelSupportRatio(subsistence: TravelSubsistenceState | undefined): number | undefined {
  if (subsistence === undefined || subsistence.demandUnits <= 0) return undefined;
  return round4(subsistence.supportUnits / subsistence.demandUnits);
}

/** The tile a day was spent on, for a probe that needs to prove the group foraged where it stood. */
export function lastSubsistenceTile(subsistence: TravelSubsistenceState | undefined): TileId | undefined {
  return subsistence?.recentDays[subsistence.recentDays.length - 1]?.tileId;
}
