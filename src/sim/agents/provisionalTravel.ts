/**
 * ROADMAP ITEM 4 — THE PROVISIONAL TRAVEL AUTHORITY.
 *
 * The one writer permitted to move a provisional successor's body. Until this module existed the
 * group was quarantined and INERT: excluded from residential movement, with nothing to replace it, so
 * it stood on its parent's tile and called that a journey.
 *
 * ── WHY LOCAL STEPS AND A TRAIL, RATHER THAN A ROUTE ─────────────────────────────────────────────
 *
 * Four representations were compared:
 *
 *   - **a precomputed route** — needs a passability search over ground nobody has walked, which is
 *     omniscience wearing the word "pathfinding". Rejected;
 *   - **a known corridor plus local correction** — the honest long-term answer, but a newborn group's
 *     inherited `travelCorridors` are the two the degrading transfer gave it, so it would fall back to
 *     local stepping in almost every case anyway;
 *   - **bounded local next-step planning** — the group knows a DIRECTION and takes one step at a time,
 *     discovering what is walkable as it arrives. Chosen;
 *   - **a retained breadcrumb trail** — chosen ALONGSIDE it, because a return has to retrace ground
 *     the group actually covered rather than re-deriving a route it never had.
 *
 * ── WHAT IS WORLD TRUTH AND WHY IT IS ALLOWED ───────────────────────────────────────────────────
 *
 * Exactly one world-truth read reaches a decision here, and it is a PHYSICAL EXECUTION CONSTRAINT
 * rather than evidence: `isBandPassableDestination` may REFUSE a step. People cannot walk into open
 * water whether or not they knew it was there, and being refused is how the group finds out. It never
 * grants information: a refused step is recorded as a contradiction, not as knowledge of what lies
 * beyond.
 *
 * Direction is geometry over the group's OWN believed destination — knowing which way is closer is
 * what having a destination means. Nothing here reads target richness, hidden support, other bands,
 * or whether the journey will succeed.
 */
import { isProvisionalSuccessor } from "./bandLifecycle";
import { getPhaseContract, requestTransition } from "./fissionLifecycleKernel";
import { deriveTravelPace, recordWalkingDay } from "./bandMobility";
import { closeOpenTravelInterval, deriveTravelEffortSplit } from "./provisionalTravelSubsistence";
import { getNeighborTiles, getTile } from "../world/generate";
import { isBandPassableDestination } from "../world/passability";
import { advanceTraversalAlongRoute } from "./traversal";
import { getBandRiverCrossingCapability } from "../rules/decisionEdgeContext";
import type { Band, FissionLifecycleRecord, ProvisionalActionRelativeToDeparture } from "./types";
import type { BandId, DayNumber, TileId } from "../core/types";
import type { WorldState } from "../world/types";
import type { DailyAction } from "./dailyActions";

/** Bounded: a trail is for retracing a journey, not a log of one. */
export const TRAVEL_TRAIL_CAP = 64;

/** Why a group that should be walking did not move today. Measured, never inferred. */
export type TravelRefusal =
  | "no_destination_known"
  | "already_at_destination"
  | "edge_travel_incomplete"
  | "every_step_toward_the_destination_is_impassable";

export interface TravelStepRecord {
  readonly bandId: string;
  readonly lineageId: string;
  readonly phase: string;
  readonly fromTileId: string;
  readonly toTileId: string;
  readonly destinationTileId: string;
  readonly moved: boolean;
  readonly refusal?: TravelRefusal;
  readonly kmPerActiveDay: number;
  /** Share of the day's workers spent looking for food instead of covering ground. */
  readonly gatherShare: number;
  readonly travelDaysConsumed: number;
  readonly edgeTravelTimeRemainingDays?: number;
  readonly completedPhysicalKm: number;
  readonly distanceRemaining: number;
  readonly impassableNeighboursRefused: number;
  readonly arrived: boolean;
}

export interface ProvisionalTravelResult {
  readonly world: WorldState;
  readonly steps: readonly TravelStepRecord[];
}

const manhattan = (a: { readonly x: number; readonly y: number }, b: { readonly x: number; readonly y: number }): number =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/**
 * Where is this group trying to get to, using only what it legitimately holds?
 *
 * `travelling` walks to the destination the attempt named. `returning` walks to the tile the founders
 * physically LEFT FROM — the last place they actually saw their parent — and deliberately NOT to the
 * parent's current position, which the travellers have no channel to observe.
 */
function destinationFor(record: FissionLifecycleRecord): TileId | undefined {
  if (record.phase === "travelling") return record.targetTileId;
  if (record.phase === "returning") return record.departureTileId;
  if (record.phase === "continuing_after_failed_return") return record.postReturnCommitment?.targetTileId;
  // `establishing` and unresolved-before-disposition have no named destination.
  return undefined;
}

/**
 * Advance every provisional group that is physically walking, by at most one tile.
 *
 * Deterministic: bands in a canonical id sort, neighbours in the world's own order, ties broken by
 * tile id. No randomness, no wall clock, no iteration-order dependence.
 */
export function advanceProvisionalTravel(world: WorldState, day: number): ProvisionalTravelResult {
  const steps: TravelStepRecord[] = [];
  const bands: Record<string, Band> = { ...world.bands };
  let changed = false;

  // Captured for EVERY live provisional successor, including the ones this loop skips — a group that
  // did not move is exactly the `stayed` observation, and it would be invisible if only movers were
  // recorded.
  const positionsBefore = new Map<string, { readonly position: TileId }>();

  for (const band of Object.values(world.bands).sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
    if (!isProvisionalSuccessor(band)) continue;
    positionsBefore.set(String(band.id), { position: band.position });
    const record = band.provisionalSuccessor as FissionLifecycleRecord;
    if (
      record.phase !== "travelling" &&
      record.phase !== "returning" &&
      record.phase !== "continuing_after_failed_return"
    ) continue;

    const destination = destinationFor(record);
    const here = getTile(world, band.position);
    const target = destination === undefined ? undefined : getTile(world, destination);

    const base = {
      bandId: String(band.id),
      lineageId: record.lineageId,
      phase: record.phase,
      fromTileId: String(band.position),
      toTileId: String(band.position),
      destinationTileId: String(destination ?? "none"),
      moved: false,
      kmPerActiveDay: 0,
      gatherShare: 0,
      travelDaysConsumed: 0,
      completedPhysicalKm: 0,
      distanceRemaining: -1,
      impassableNeighboursRefused: 0,
      arrived: false,
    };

    if (destination === undefined || here === undefined || target === undefined) {
      steps.push({ ...base, refusal: "no_destination_known" });
      continue;
    }

    const remaining = manhattan(here.coord, target.coord);
    if (remaining === 0) {
      // ARRIVAL IS NOT SUCCESS. Reaching the place only earns the right to try to live there; it does
      // not supply the positive commitment or operation contract a future stabilization writer would
      // require. A `returning` group that has arrived is NOT resolved here — reintegration is a
      // separate writer with its own preconditions, because being at the right tile is not the same as
      // your parent being there.
      if (record.phase === "travelling") {
        const transition = requestTransition({
          current: { phase: record.phase, phaseEnteredDay: record.phaseEnteredDay, history: record.history },
          to: "establishing",
          today: day,
          cause: "physical_event",
        });
        if (transition.ok === true) {
          changed = true;
          // The journey's interval closes at the journey's end. What the group learned about eating
          // while WALKING says nothing about whether it can eat HERE, and carrying the walk's deficit
          // into the site's record would condemn the site for the road's failures.
          const arrived = closeOpenTravelInterval(band, day);
          bands[String(band.id)] = {
            ...arrived,
            provisionalSuccessor: {
              ...(arrived.provisionalSuccessor as FissionLifecycleRecord),
              phase: transition.state.phase,
              phaseEnteredDay: transition.state.phaseEnteredDay,
              history: transition.state.history,
              blockedStepDays: 0,
            },
          };
        }
      }
      steps.push({
        ...base,
        refusal: "already_at_destination",
        distanceRemaining: 0,
        arrived: record.phase === "travelling" || record.phase === "continuing_after_failed_return",
      });
      continue;
    }

    // ── physical pace + available travel time ──
    // A provisional group is a whole residential column. Gathering consumes time from the
    // same day; the physical pace itself remains km/travel-day and edge geometry/cost lives
    // exclusively in traversal.ts.
    const injuryLoad = Math.min(1, Math.max(0, band.acuteRisk?.activeEffect?.movementCautionBump ?? 0));
    const pace = deriveTravelPace(band, "whole_band_residential_move", { injuryLoad });
    const effort = deriveTravelEffortSplit(band);
    let availableTravelDays = Math.max(0, effort.movementShare);
    let position = band.position;
    let edgeRemainder = record.travelEdgeRemainder;
    let completedPhysicalKm = 0;
    let travelDaysConsumed = 0;
    let impassable = 0;
    let trail = [...(record.trail ?? [])];
    let blockedStepDays = record.blockedStepDays ?? 0;
    let wroteStep = false;

    while (availableTravelDays > 1e-9) {
      const current = getTile(world, position);
      if (current === undefined) break;
      const currentRemaining = manhattan(current.coord, target.coord);
      if (currentRemaining === 0) break;

      let refusedHere = 0;
      const candidates = getNeighborTiles(world, position)
        .filter((tile) => {
          if (isBandPassableDestination(tile)) return true;
          refusedHere += 1;
          return false;
        })
        .map((tile) => ({ tile, distance: manhattan(tile.coord, target.coord) }))
        .filter((candidate) => candidate.distance < currentRemaining)
        .sort((left, right) => (left.distance - right.distance) || String(left.tile.id).localeCompare(String(right.tile.id)));
      impassable += refusedHere;
      const next = candidates[0];

      if (next === undefined) {
        blockedStepDays += 1;
        edgeRemainder = undefined;
        steps.push({
          ...base,
          fromTileId: String(position),
          toTileId: String(position),
          kmPerActiveDay: pace.kmPerTravelDay,
          gatherShare: effort.gatherShare,
          travelDaysConsumed,
          completedPhysicalKm,
          distanceRemaining: currentRemaining,
          refusal: "every_step_toward_the_destination_is_impassable",
          impassableNeighboursRefused: impassable,
        });
        wroteStep = true;
        break;
      }

      const advanced = advanceTraversalAlongRoute({
        world,
        routeTileIds: [position, next.tile.id],
        routeIndex: 0,
        kmPerTravelDay: pace.kmPerTravelDay,
        availableTravelDays,
        edgeRemainder,
        crossingCapability: getBandRiverCrossingCapability(band),
      });
      travelDaysConsumed += advanced.travelDaysConsumed;
      availableTravelDays = advanced.unusedTravelDays;

      if (advanced.blocked) {
        blockedStepDays += 1;
        edgeRemainder = undefined;
        steps.push({
          ...base,
          fromTileId: String(position),
          toTileId: String(position),
          kmPerActiveDay: pace.kmPerTravelDay,
          gatherShare: effort.gatherShare,
          travelDaysConsumed: advanced.travelDaysConsumed,
          completedPhysicalKm: 0,
          distanceRemaining: currentRemaining,
          refusal: "every_step_toward_the_destination_is_impassable",
          impassableNeighboursRefused: impassable + 1,
        });
        wroteStep = true;
        break;
      }

      if (advanced.completedEdges === 0) {
        edgeRemainder = advanced.edgeRemainder;
        steps.push({
          ...base,
          fromTileId: String(position),
          toTileId: String(position),
          kmPerActiveDay: pace.kmPerTravelDay,
          gatherShare: effort.gatherShare,
          travelDaysConsumed: advanced.travelDaysConsumed,
          edgeTravelTimeRemainingDays: edgeRemainder?.remainingTravelDays,
          completedPhysicalKm: 0,
          distanceRemaining: currentRemaining,
          refusal: "edge_travel_incomplete",
          impassableNeighboursRefused: impassable,
        });
        wroteStep = true;
        break;
      }

      changed = true;
      trail.push(position);
      if (trail.length > TRAVEL_TRAIL_CAP) trail = trail.slice(trail.length - TRAVEL_TRAIL_CAP);
      const from = position;
      position = next.tile.id;
      edgeRemainder = undefined;
      completedPhysicalKm += advanced.completedPhysicalKm;
      blockedStepDays = 0;
      steps.push({
        ...base,
        fromTileId: String(from),
        toTileId: String(position),
        moved: true,
        kmPerActiveDay: pace.kmPerTravelDay,
        gatherShare: effort.gatherShare,
        travelDaysConsumed: advanced.travelDaysConsumed,
        completedPhysicalKm: advanced.completedPhysicalKm,
        distanceRemaining: next.distance,
        impassableNeighboursRefused: impassable,
        arrived: next.distance === 0,
      });
      wroteStep = true;
    }

    if (!wroteStep) {
      steps.push({
        ...base,
        kmPerActiveDay: pace.kmPerTravelDay,
        gatherShare: effort.gatherShare,
        distanceRemaining: remaining,
        refusal: "edge_travel_incomplete",
      });
    }

    if (position !== band.position || edgeRemainder !== record.travelEdgeRemainder || travelDaysConsumed > 0) {
      changed = true;
      bands[String(band.id)] = {
        ...band,
        position,
        mobility: recordWalkingDay(band.mobility, {
          day: day as DayNumber,
          km: completedPhysicalKm,
          loadedKm: 0,
          activeTravel: travelDaysConsumed > 0,
          source: "provisional_travel",
        }),
        provisionalSuccessor: {
          ...record,
          trail,
          blockedStepDays,
          travelEdgeRemainder: edgeRemainder,
        },
      };
    }
  }

  // ── THE TWO PHYSICAL CHOICE OBSERVATIONS ──────────────────────────────────────────────────────
  //
  // Written in ONE pass, after the movement loop, deliberately: interleaving them with the movement
  // branches would have meant touching six `continue` paths and would have made it easy for a future
  // edit to let an observation change a step. Here they can only READ what movement already decided.
  //
  // They reuse the movement authority's own geometry — `getNeighborTiles`, `isBandPassableDestination`
  // and the same `manhattan` — because a second passability or distance implementation is how two
  // readers start disagreeing about the same ground.
  //
  // The world is legitimately visible HERE: this module is the physical mover and already holds the
  // grid. What is stored is bounded and band-local, so the later disposition authority can read it
  // without a `world` parameter and without gaining any world truth beyond "the ground answered this".
  for (const [bandId, before] of positionsBefore) {
    const after = bands[bandId];
    if (after === undefined || !isProvisionalSuccessor(after)) continue;
    const record = after.provisionalSuccessor as FissionLifecycleRecord;
    const departure = record.departureTileId;
    if (departure === undefined) continue;
    const departureTile = getTile(world, departure);
    const beforeTile = getTile(world, before.position);
    const standingTile = getTile(world, after.position);
    if (departureTile === undefined || beforeTile === undefined || standingTile === undefined) continue;

    // ── observation 1 — does the ground admit ONE step homeward FROM WHERE THE GROUP NOW STANDS? ──
    //
    // Measured at the position the group occupies at the END of this day, which is what the field name
    // says and the only thing a later reader can act on. An earlier form of this measured the position
    // the group stood on BEFORE its step — a fact about a place it no longer occupies — and the audit
    // caught it on the one day the two disagree: the departure day itself, where the group starts ON
    // its departure tile (no step can reduce a distance of zero) and ends one tile out (where a step
    // home plainly exists). A field called "from here" must mean here.
    //
    // Outbound travel and the arrival trial only. A `returning` group is already walking home, so
    // asking whether it could is not a question about an alternative; this classification creates no
    // social attempt or credit.
    const outboundOrArrivalTrial = record.phase === "travelling" || record.phase === "establishing";
    const distanceBefore = manhattan(beforeTile.coord, departureTile.coord);
    const distanceNow = manhattan(standingTile.coord, departureTile.coord);
    const homewardAvailable = outboundOrArrivalTrial
      ? getNeighborTiles(world, after.position).some(
          (tile) => isBandPassableDestination(tile) && manhattan(tile.coord, departureTile.coord) < distanceNow,
        )
      : undefined;

    // ── observation 2 — what did the group physically DO, measured against home? ──
    const distanceAfter = distanceNow;
    const action: ProvisionalActionRelativeToDeparture =
      String(after.position) === String(before.position)
        ? "stayed"
        : distanceAfter < distanceBefore
          ? "toward_departure"
          : distanceAfter > distanceBefore
            ? "away_from_departure"
            : "lateral_to_departure";

    // BOTH observations are re-stamped every day they are taken, and the homeward pair is CLEARED on
    // any day it is not. An earlier form wrote only when a value changed, which froze the day stamp:
    // a group that walked for a fortnight with a step home open throughout carried a fourteen-day-old
    // `observedOnDay` on a field describing right now, so a reader could not tell a current
    // observation from a stale one. The invariant is therefore structural — IF the homeward field is
    // present, it was measured TODAY — and the clearing is what stops a `travelling` group's last
    // reading surviving into `returning` as though it still described the ground.
    //
    // No counters. Two current-state values and two day stamps is the whole representation; a running
    // total here would be a `>= N` gate waiting for somebody to write it.
    changed = true;
    bands[bandId] = {
      ...after,
      provisionalSuccessor: {
        ...record,
        homewardStepFromHereWasAvailable: homewardAvailable,
        homewardStepObservedOnDay: homewardAvailable === undefined ? undefined : day,
        lastActionRelativeToDeparture: action,
        lastActionRelativeToDepartureDay: day,
      },
    };
  }

  return { world: changed ? { ...world, bands: bands as Readonly<Record<BandId, Band>> } : world, steps };
}

/**
 * The daily action. Fires every day: a journey is a daily fact, and a group that only walked on
 * scheduled trip days would be moving on the residential system's cadence rather than its own.
 *
 * It is a no-op for every band that is not a walking provisional successor. Natural physical fission
 * can now create such a successor, but the departure action is registered after this mover, so the
 * newborn cannot walk until a later simulated day.
 */
export const provisionalTravelDailyAction: DailyAction = {
  id: "provisional_travel",
  firesOnDayOfSeason: () => true,
  apply: (world, day) => advanceProvisionalTravel(world, day).world,
};

/** Exported so audits assert the PRODUCTION bound rather than re-declaring it. */
export const TRAVEL_PHASES_THAT_MOVE: readonly string[] = [
  "travelling",
  "returning",
  "continuing_after_failed_return",
];

/** Exported so the boundary audit can assert this module owns the write. */
export function isTravelPhase(phase: string): boolean {
  return TRAVEL_PHASES_THAT_MOVE.includes(phase) && !getPhaseContract(phase as never).terminal;
}
