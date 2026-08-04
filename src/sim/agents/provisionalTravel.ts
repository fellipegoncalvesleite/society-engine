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
import { getNeighborTiles, getTile } from "../world/generate";
import { isBandPassableDestination } from "../world/passability";
import type { Band, FissionLifecycleRecord } from "./types";
import type { BandId, TileId } from "../core/types";
import type { WorldState } from "../world/types";
import type { DailyAction } from "./dailyActions";

/** Bounded: a trail is for retracing a journey, not a log of one. */
export const TRAVEL_TRAIL_CAP = 64;

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

  for (const band of Object.values(world.bands).sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
    if (!isProvisionalSuccessor(band)) continue;
    const record = band.provisionalSuccessor as FissionLifecycleRecord;
    if (record.phase !== "travelling" && record.phase !== "returning") continue;

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
          bands[String(band.id)] = {
            ...band,
            provisionalSuccessor: {
              ...record,
              phase: transition.state.phase,
              phaseEnteredDay: transition.state.phaseEnteredDay,
              history: transition.state.history,
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
    const tilesPerTravelDay = Math.max(0, pace.tilesPerTravelDay);
    const kmPerActiveDay = Math.max(0, pace.kmPerTravelDay);
    // A column slower than a tile a day RESTS between steps rather than teleporting a fraction of one.
    const daysPerTile = tilesPerTravelDay <= 0 ? Number.POSITIVE_INFINITY : Math.max(1, Math.ceil(1 / tilesPerTravelDay));
    const daysInPhase = day - record.phaseEnteredDay;
    const paced = { ...base, kmPerActiveDay, daysPerTile, distanceRemaining: remaining };

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
