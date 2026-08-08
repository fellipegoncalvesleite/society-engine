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
import { deriveTravelPace } from "./bandMobility";
import { closeOpenTravelInterval, deriveTravelEffortSplit } from "./provisionalTravelSubsistence";
import { getNeighborTiles, getTile } from "../world/generate";
import { isBandPassableDestination } from "../world/passability";
import type { Band, FissionLifecycleRecord, ProvisionalActionRelativeToDeparture } from "./types";
import type { BandId, TileId } from "../core/types";
import type { WorldState } from "../world/types";
import type { DailyAction } from "./dailyActions";

/** Bounded: a trail is for retracing a journey, not a log of one. */
export const TRAVEL_TRAIL_CAP = 64;

/**
 * Consecutive days a group must have physically worked its current ground and taken NOTHING before it
 * will move on.
 *
 * TWO, and the number is the ecology's rather than a preference: the measured patch behaviour is a
 * real take on the first day, a small one on the second, and `physically_exhausted` from the third.
 * So two barren days is the earliest a group can honestly know the place is finished rather than
 * merely poor today. Below this a group would abandon ground on one bad day; far above it, the group
 * starves on ground it has already proved is empty.
 */
export const RELOCATION_BARREN_DAYS = 2;

/** Why a group that should be walking did not move today. Measured, never inferred. */
export type TravelRefusal =
  | "no_destination_known"
  | "already_at_destination"
  | "resting_on_this_day_at_current_pace"
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
  readonly daysPerTile: number;
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
  // `establishing` has no named destination. A group that is trying to live somewhere is not walking
  // to anywhere — but it may still MOVE, one contiguous step, when the ground it is on has stopped
  // giving. That is `relocationStepFor`, below, and it is a different question from "where is this
  // group headed", which is why it is not answered here.
  return undefined;
}

/**
 * ROADMAP ITEM 4 — WHY AN ESTABLISHING GROUP IS ALLOWED TO MOVE AT ALL.
 *
 * It was not, and that was the defect. The model asked a group to prove independence by remaining on
 * one strategic tile for thirty days, and a production-pipeline fixture showed the best patch the
 * parent knows is `physically_exhausted` after two days. Staying was not a way to demonstrate
 * competence; it was a way to starve while a record filled up.
 *
 * So a group whose locality has stopped giving takes ONE CONTIGUOUS STEP to adjacent ground, through
 * the same writer every other provisional move goes through. This is not an activity range and not a
 * catchment: the whole group moves, together, one tile, and there is no split of bodies between an
 * anchor and a foray. Item 13 may later generalise that; this pass does not need it and does not
 * invent it.
 *
 * The destination uses only what the group can legitimately see: adjacent, passable, and preferring
 * ground it has not already stripped. It reads no hidden richness and no other band.
 */
function relocationStepFor(world: WorldState, band: Band, record: FissionLifecycleRecord): TileId | undefined {
  if (record.phase !== "establishing") return undefined;
  const subsistence = record.travelSubsistence;
  if (subsistence === undefined) return undefined;
  // "Stopped giving" is measured, not assumed: the group has actually tried here, on consecutive days,
  // and taken nothing. A group that is feeding itself has no reason to move and does not.
  const recent = subsistence.recentDays.filter((entry) => String(entry.tileId) === String(band.position));
  if (recent.length < RELOCATION_BARREN_DAYS) return undefined;
  const lastN = recent.slice(-RELOCATION_BARREN_DAYS);
  if (lastN.some((entry) => entry.usableUnits > 0)) return undefined;

  const alreadyWorked = new Set((record.independence?.lifetimeProvisioningTileIds ?? []).map((id: TileId) => String(id)));
  if (getTile(world, band.position) === undefined) return undefined;
  const neighbours = getNeighborTiles(world, band.position)
    .filter((tile) => isBandPassableDestination(tile))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  // Unworked ground first, then anything passable. Deterministic on tile id in both arms.
  return neighbours.find((tile) => !alreadyWorked.has(String(tile.id)))?.id ?? neighbours[0]?.id;
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
    // `establishing` is admitted ONLY when its locality has measurably stopped giving, and then only
    // for one contiguous step. A group that is feeding itself never reaches `relocationStepFor`.
    const relocation = record.phase === "establishing" ? relocationStepFor(world, band, record) : undefined;
    if (record.phase !== "travelling" && record.phase !== "returning" && relocation === undefined) continue;

    const destination = relocation ?? destinationFor(record);
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
      daysPerTile: 0,
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
      // ARRIVAL IS NOT SUCCESS. Reaching the place only earns the right to try to live there, and
      // `establishing` is a trial: `stabilized` still demands lived evidence. A `returning` group that
      // has arrived is NOT resolved here — reintegration is a separate writer with its own
      // preconditions, because being at the right tile is not the same as your parent being there.
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
      steps.push({ ...base, refusal: "already_at_destination", distanceRemaining: 0, arrived: record.phase === "travelling" });
      continue;
    }

    // ── pace, through the canonical authority rather than a second model ──
    //
    // `whole_band_residential_move` is the right context and that is a finding rather than a
    // convenience: a provisional group is not a selected party of chosen walkers, it is EVERYBODY —
    // dependents, elders and all — moving as a column, which is exactly what that context describes.
    // Injury load comes from the band's own acute-risk state, so a hurt group walks slower.
    // `movementCautionBump` is the MOVEMENT term of the acute-risk effect — the one that says a hurt
    // group travels worse. The other terms describe work efficiency, stress and mortality and would be
    // the wrong quantity here.
    const injuryLoad = Math.min(1, Math.max(0, band.acuteRisk?.activeEffect?.movementCautionBump ?? 0));
    const pace = deriveTravelPace(band, "whole_band_residential_move", { injuryLoad });
    // ── THE TRADEOFF, APPLIED TO THE GROUND ACTUALLY COVERED ──
    //
    // A day has one set of workers in it. Whatever share of them spends the day looking for food is
    // not spending it covering distance, so a group that stops to gather genuinely travels slower and
    // a group that presses on genuinely arrives hungrier. The split is derived from the group's own
    // measured condition by the subsistence authority; this module only spends it.
    const effort = deriveTravelEffortSplit(band);
    const tilesPerTravelDay = Math.max(0, pace.tilesPerTravelDay * effort.movementShare);
    const kmPerActiveDay = Math.max(0, pace.kmPerTravelDay * effort.movementShare);
    // A column slower than a tile a day RESTS between steps rather than teleporting a fraction of one.
    const daysPerTile = tilesPerTravelDay <= 0 ? Number.POSITIVE_INFINITY : Math.max(1, Math.ceil(1 / tilesPerTravelDay));
    const daysInPhase = day - record.phaseEnteredDay;
    const paced = { ...base, kmPerActiveDay, gatherShare: effort.gatherShare, daysPerTile, distanceRemaining: remaining };

    if (!Number.isFinite(daysPerTile) || daysInPhase < 0 || daysInPhase % daysPerTile !== 0) {
      steps.push({ ...paced, refusal: "resting_on_this_day_at_current_pace" });
      continue;
    }

    // ── one contiguous step ──
    //
    // Candidates are the CURRENT TILE'S OWN NEIGHBOURS, so a step is contiguous by construction rather
    // than by assertion. Among those that physically admit people, the one that reduces the distance
    // to the believed destination wins; ties break on tile id so replay is exact.
    let impassable = 0;
    const candidates = getNeighborTiles(world, band.position)
      .filter((tile) => {
        if (isBandPassableDestination(tile)) return true;
        impassable += 1;
        return false;
      })
      .map((tile) => ({ tile, distance: manhattan(tile.coord, target.coord) }))
      .filter((c) => c.distance < remaining)
      .sort((l, r) => (l.distance - r.distance) || String(l.tile.id).localeCompare(String(r.tile.id)));

    const next = candidates[0];
    if (next === undefined) {
      // A real contradiction: the group wanted to go that way and the ground refused. It is recorded
      // rather than routed around, because "there is no way forward from here" is exactly the evidence
      // a later return decision needs, and inventing a detour would be inventing knowledge.
      //
      // It is now RETAINED as well as recorded, because a refusal the group forgets by tomorrow cannot
      // become a reason for anything. The counter is the group's own experience of being stopped; it
      // says nothing about what lies beyond the tiles that refused it.
      changed = true;
      bands[String(band.id)] = {
        ...band,
        provisionalSuccessor: { ...record, blockedStepDays: (record.blockedStepDays ?? 0) + 1 },
      };
      steps.push({ ...paced, refusal: "every_step_toward_the_destination_is_impassable", impassableNeighboursRefused: impassable });
      continue;
    }

    changed = true;
    const trail = [...(record.trail ?? []), band.position];
    bands[String(band.id)] = {
      ...band,
      position: next.tile.id,
      provisionalSuccessor: {
        ...record,
        trail: trail.length > TRAVEL_TRAIL_CAP ? trail.slice(trail.length - TRAVEL_TRAIL_CAP) : trail,
      },
    };
    steps.push({
      ...paced,
      toTileId: String(next.tile.id),
      moved: true,
      distanceRemaining: next.distance,
      impassableNeighboursRefused: impassable,
    });
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
    // Attempt-active phases only. A `returning` group is already walking home, so asking whether it
    // could is not a question about an alternative; and a terminal group is not standing anywhere.
    const attemptActive = record.phase === "travelling" || record.phase === "establishing";
    const distanceBefore = manhattan(beforeTile.coord, departureTile.coord);
    const distanceNow = manhattan(standingTile.coord, departureTile.coord);
    const homewardAvailable = attemptActive
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
 * It is a no-op for every band that is not a walking provisional successor, so an ordinary world is
 * untouched — and no natural path creates a provisional successor, so it cannot fire in ordinary play
 * at all.
 */
export const provisionalTravelDailyAction: DailyAction = {
  id: "provisional_travel",
  firesOnDayOfSeason: () => true,
  apply: (world, day) => advanceProvisionalTravel(world, day).world,
};

/** Exported so audits assert the PRODUCTION bound rather than re-declaring it. */
export const TRAVEL_PHASES_THAT_MOVE: readonly string[] = ["travelling", "returning"];

/** Exported so the boundary audit can assert this module owns the write. */
export function isTravelPhase(phase: string): boolean {
  return TRAVEL_PHASES_THAT_MOVE.includes(phase) && !getPhaseContract(phase as never).terminal;
}
