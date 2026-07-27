// CORRECTION-23G §5/§6/§7/§11 — EXACT PHYSICAL SCHEDULE REPLAY SEAM.
//
// AUDIT-ONLY and NON-PERSISTED. Nothing here enters `WorldState`, band state, snapshots,
// the worker, or the UI. Everything is a module-level slot the audit runner sets and clears
// in a `finally`. When nothing is registered — every production, worker and UI path — the
// only cost is one `undefined` check at each seam, and canonical output is byte-identical
// to `ca9e3b8`.
//
// WHY THIS EXISTS
// ---------------
// CORRECTION-23F's F13 was meant to be the architectural counterfactual: F1's exact target
// schedule and routes with the verification question removed. The implemented seam
// suppressed the returned RESULT, which also suppressed the durable DISPOSITION — so
// `mayAskAgain` answered "never asked here" forever and the production selector collapsed
// onto one nearby place. F13 measured lost retry memory, not the absence of a question, and
// is inadmissible.
//
// A valid arm cannot let the production selector run at all, because the selector is exactly
// what the removed semantics perturb. It needs a SCHEDULE recorded from a donor run and
// replayed physically. That is what this module carries:
//
//   stage 1  a donor recorder is registered and the positive control (F1) is run. Every
//            frontier-verification launch the BAND-KNOWN PRODUCTION SELECTOR makes is
//            recorded in full. Nothing here reads hidden world truth: every field is either
//            the band's own choice or the physical route the band's own route builder
//            produced from its own position.
//
//   stage 2  the same initial state and the same seeds are run again with the schedule
//            registered for replay. On a scheduled day the party is raised to the recorded
//            target with the recorded composition, walks physically, pays the same labour,
//            provisions, time, route and risk, makes the same legal ordinary observations —
//            and carries no question, records no result, writes no evidence and writes no
//            disposition.
//
// DIVERGENCE IS RECORDED, NEVER PAPERED OVER. The paired world diverges the moment any
// replay party's observations differ from the donor's, which is the point of the arm. When a
// scheduled launch cannot physically happen — the band is gone, the workers are committed,
// the active cap is full, or no route exists — the ledger records the failure and NO party is
// raised. Nothing is teleported and no completion is forced.

import type { Band, ExpeditionPartyComposition } from "../agents/types";
import type { TileId } from "../core/types";

/**
 * The audit arms this seam serves. Each replaces the production frontier-verification
 * launcher for the duration of one run; none of them is reachable from production.
 *
 *   G1  exact physical schedule replay without verification semantics
 *   G2  as G1, plus the bounded target-rotation disposition (§6) and nothing else
 *   G3  donor cadence, ordinary broad-exploration target family (§7)
 *   G4  donor cadence, nearest legal band-known uncertain frontier target (§7)
 *   G5  donor cadence, deterministic rotating band-known frontier sectors (§7)
 *   G6  no replay parties at all — donor-schedule PLACES are protected from eviction (§11)
 */
export type ScheduleReplayArm = "G1" | "G2" | "G3" | "G4" | "G5" | "G6";

/**
 * One recorded donor launch. §5 stage 1 names the required fields; every one of them is
 * either the band's own decision or a physical quantity the band's own planner computed.
 */
export interface DonorScheduleEntry {
  readonly bandId: string;
  /** Absolute simulation day the donor party was raised. */
  readonly launchDay: number;
  /** Ordinal of this launch within the donor band's own sequence of launches. */
  readonly taskSlot: number;
  /** Where the donor band physically stood when it launched. */
  readonly originTileId: string;
  readonly targetTileId: string;
  /** The route the donor's own route builder produced, origin first, target last. */
  readonly plannedRoute: readonly string[];
  readonly partyWorkers: number;
  readonly partyComposition?: ExpeditionPartyComposition;
  /** The question the donor party carried. Recorded for reporting; never replayed. */
  readonly question: string;
  /** The donor selector's own reason for choosing this target. */
  readonly reasonSelected: string;
  /** Physical feasibility inputs the donor launcher actually evaluated. */
  readonly feasibility: {
    readonly distanceTiles: number;
    readonly routeTiles: number;
    readonly legDays: number;
    readonly onSiteDays: number;
    readonly departableWorkers: number;
    readonly need: number;
    readonly score: number;
  };
}

/** Why a scheduled launch did not physically happen in the paired world. */
export type ReplayFailureReason =
  | "band_absent"
  | "active_cap_or_workers"
  | "no_party_composition"
  | "target_record_absent"
  | "no_physical_route"
  | "route_over_budget"
  | "duration_budget_exceeded"
  | "no_arm_target";

export interface ReplayLedgerRow {
  readonly bandId: string;
  readonly day: number;
  readonly donorTargetTileId: string;
  readonly launched: boolean;
  readonly targetTileId?: string;
  /** True only when the donor's own planned route was replayed tile for tile. */
  readonly exactRoute?: boolean;
  /** True when the replay band stood where the donor band stood. */
  readonly originMatched?: boolean;
  /** G2 only: the exact target was unreachable and rotation chose an unused donor place. */
  readonly rotationRetarget?: boolean;
  readonly failureReason?: ReplayFailureReason;
}

// ── stage 1: donor recording ─────────────────────────────────────────────────────────────

export type DonorScheduleRecorder = (entry: DonorScheduleEntry) => void;

let activeRecorder: DonorScheduleRecorder | undefined;

/** Registers (or with `undefined`, clears) the donor recorder. Audit runners only. */
export function setDonorScheduleRecorder(recorder: DonorScheduleRecorder | undefined): void {
  activeRecorder = recorder;
}

/** True when a donor run is currently recording its schedule. */
export function isRecordingDonorSchedule(): boolean {
  return activeRecorder !== undefined;
}

/** Records one donor launch. No-op — and one `undefined` comparison — when unregistered. */
export function recordDonorLaunch(entry: DonorScheduleEntry): void {
  if (activeRecorder === undefined) {
    return;
  }

  activeRecorder(entry);
}

// ── stage 2: schedule replay ─────────────────────────────────────────────────────────────

interface ReplayState {
  readonly arm: ScheduleReplayArm;
  /** `bandId|day` -> entry. A band launches at most once per day (VERIFICATION_ACTIVE_CAP=1). */
  readonly byBandDay: Map<string, DonorScheduleEntry>;
  /** bandId -> donor targets in schedule order, for the §6 rotation reader. */
  readonly donorTargetsByBand: Map<string, readonly string[]>;
  /** Every tile any donor party was sent to, for the §11 G6 protection set. */
  readonly donorPlaces: ReadonlySet<string>;
  /**
   * §6 — the ONLY durable state G2 keeps. It asserts nothing about water, resources,
   * temporary usability, seasonal persistence, or any physical answer. It asserts exactly
   * "this audit activity already used this target under this replay schedule", and is read
   * at exactly one place: choosing a substitute when the exact scheduled target cannot be
   * reached. Diagnostic-only; it must never become production epistemic state.
   */
  readonly rotationUsed: Map<string, Set<string>>;
  /** Per-band count of replay launches so far, for G5's deterministic sector rotation. */
  readonly launchOrdinal: Map<string, number>;
  readonly ledger: ReplayLedgerRow[];
}

let activeReplay: ReplayState | undefined;

/** Registers (or with `undefined`, clears) a schedule replay. Audit runners only. */
export function setScheduleReplay(
  config: { readonly arm: ScheduleReplayArm; readonly schedule: readonly DonorScheduleEntry[] } | undefined,
): void {
  if (config === undefined) {
    activeReplay = undefined;
    return;
  }

  const byBandDay = new Map<string, DonorScheduleEntry>();
  const targets = new Map<string, string[]>();
  const donorPlaces = new Set<string>();

  for (const entry of config.schedule) {
    const key = `${entry.bandId}|${entry.launchDay}`;

    // A band cannot raise two verification parties on one day (VERIFICATION_ACTIVE_CAP = 1);
    // keep the first, so a malformed donor file cannot silently multiply the party budget.
    if (!byBandDay.has(key)) {
      byBandDay.set(key, entry);
    }

    const list = targets.get(entry.bandId);

    if (list === undefined) {
      targets.set(entry.bandId, [entry.targetTileId]);
    } else if (!list.includes(entry.targetTileId)) {
      list.push(entry.targetTileId);
    }

    donorPlaces.add(entry.targetTileId);
  }

  activeReplay = {
    arm: config.arm,
    byBandDay,
    donorTargetsByBand: new Map([...targets].map(([bandId, list]) => [bandId, [...list]])),
    donorPlaces,
    rotationUsed: new Map(),
    launchOrdinal: new Map(),
    ledger: [],
  };
}

/**
 * The active replay arm, or `undefined` in every normal world. Production reads this at one
 * seam to decide whether the ordinary frontier-verification launcher runs at all.
 */
export function getScheduleReplayArm(): ScheduleReplayArm | undefined {
  return activeReplay?.arm;
}

/** The donor entry scheduled for this band on this day, if any. */
export function getScheduledLaunch(bandId: string, day: number): DonorScheduleEntry | undefined {
  return activeReplay?.byBandDay.get(`${bandId}|${day}`);
}

/** Zero-based ordinal of this band's next replay launch, for G5's sector rotation. */
export function getReplayLaunchOrdinal(bandId: string): number {
  return activeReplay?.launchOrdinal.get(bandId) ?? 0;
}

/**
 * §6 — the donor targets this band has NOT yet used under this replay schedule, in schedule
 * order. Read only when the exact scheduled target is physically unreachable.
 */
export function getUnusedDonorTargets(bandId: string): readonly string[] {
  if (activeReplay === undefined) {
    return [];
  }

  const used = activeReplay.rotationUsed.get(bandId);
  const all = activeReplay.donorTargetsByBand.get(bandId) ?? [];

  return used === undefined ? all : all.filter((tileId) => !used.has(tileId));
}

/** Records that this audit activity used this target under this replay schedule. */
export function noteRotationUse(bandId: string, tileId: string): void {
  if (activeReplay === undefined) {
    return;
  }

  const used = activeReplay.rotationUsed.get(bandId);

  if (used === undefined) {
    activeReplay.rotationUsed.set(bandId, new Set([tileId]));
    return;
  }

  used.add(tileId);
}

/** Appends one ledger row and, on a launch, advances the band's launch ordinal. */
export function recordReplayOutcome(row: ReplayLedgerRow): void {
  if (activeReplay === undefined) {
    return;
  }

  activeReplay.ledger.push(row);

  if (row.launched) {
    activeReplay.launchOrdinal.set(row.bandId, (activeReplay.launchOrdinal.get(row.bandId) ?? 0) + 1);
  }
}

/** The full replay ledger — launches, substitutions and every recorded failure. */
export function getReplayLedger(): readonly ReplayLedgerRow[] {
  return activeReplay?.ledger ?? [];
}

// ── §6 supplement: rotation in the configuration where it can actually decide ────────────
//
// Under an exact schedule replay the target comes from the schedule, so the rotation state
// has no choice to make and G1 and G2 are identical BY CONSTRUCTION. §6's stated purpose —
// "prevent repeated collapse onto one nearby target" — describes the F13 configuration, where
// the PRODUCTION SELECTOR still runs with the answer suppressed and therefore collapses.
//
// This gate is that test, and nothing else. When it is on, the production selector skips a
// place this band has already used for this audit activity. It asserts nothing about water,
// resources, temporary usability, seasonal persistence, or any physical answer — only "this
// audit activity already used this target under this replay schedule". Audit-only; it must
// never become production epistemic state.

let selectorRotationEnabled = false;
const selectorRotationUsed = new Map<string, Set<string>>();

/** Turns the §6 selector rotation gate on or off. Audit runners only. */
export function setSelectorRotationGate(enabled: boolean): void {
  selectorRotationEnabled = enabled;
  selectorRotationUsed.clear();
}

/** True when the audit rotation gate is filtering the production selector. */
export function hasSelectorRotationGate(): boolean {
  return selectorRotationEnabled;
}

/** False only when this band already used this target under the audit rotation state. */
export function selectorRotationAllows(bandId: string, tileId: TileId): boolean {
  if (!selectorRotationEnabled) {
    return true;
  }

  return selectorRotationUsed.get(bandId)?.has(String(tileId)) !== true;
}

/** Records that the audit activity used this target. No-op when the gate is off. */
export function noteSelectorRotationUse(bandId: string, tileId: TileId): void {
  if (!selectorRotationEnabled) {
    return;
  }

  const used = selectorRotationUsed.get(bandId);

  if (used === undefined) {
    selectorRotationUsed.set(bandId, new Set([String(tileId)]));
    return;
  }

  used.add(String(tileId));
}

// ── §11 G6: donor-place retention, without launching anything ────────────────────────────

let protectedDonorPlaces: ReadonlySet<string> | undefined;

/**
 * Registers (or with `undefined`, clears) the sparse §11 G6 protection set: exactly the
 * places the F1 donor schedule selected, and nothing else. It is read at one seam in
 * `memoryCompression` and is absent from every normal world. It is independent of hidden
 * ecology — the set is a list of places the DONOR BAND itself chose to walk to.
 */
export function setProtectedDonorPlaces(places: readonly string[] | undefined): void {
  protectedDonorPlaces = places === undefined ? undefined : new Set(places);
}

/** True when this place is in the audit-only donor-schedule protection set. */
export function isProtectedDonorPlace(tileId: TileId): boolean {
  return protectedDonorPlaces !== undefined && protectedDonorPlaces.has(String(tileId));
}

/** True when a G6 protection set is registered. */
export function hasProtectedDonorPlaces(): boolean {
  return protectedDonorPlaces !== undefined;
}

// ── §8: who actually consumes a season identity ──────────────────────────────────────────
//
// §8 forbids reporting a "season only" result as if season identity had been tested cleanly,
// and requires the READERS to be counted rather than assumed. `seasonsObserved` has exactly
// four non-projection read sites in the simulation, and each of them calls the counter below.
// The projection sites (`placeEvidenceProjection`, the compressed summary) are deliberately
// NOT counted: a read model is not a behavioural reader, and counting it would inflate the
// number in exactly the way this checkpoint's rule list forbids.

/**
 * The behavioural read sites, named so the ledger says WHO consumed the identity. These are
 * the four places a `KnownTileRecord.seasonsObserved` reaches a production decision:
 *
 *   destination_season_modifier  `bandDecision.buildKnownTileScoreBreakdown` — the current
 *                                season being absent from the record costs the destination
 *                                0.06 of its seasonal food modifier. The only DIRECT
 *                                movement-scoring consumer.
 *   place_memory_merge           `memory.ts` folds the record's seasons into
 *                                `PlaceMemory.seasonsObserved`, which `protoCamps` then
 *                                scores ("used across multiple seasons", up to 0.14).
 *   verification_classification  `classifyPlaceForQuestion` — season count decides whether
 *                                `seasonal_persistence` is unknown / open / already settled.
 *   verification_gap             `describeVerificationGap` — season count sets the promise
 *                                and the information deficit for that question.
 *
 * Everything else that touches `seasonsObserved` is a read model, a Chronicle string, a
 * compressed summary, or a different record type entirely (fauna). Those are NOT counted: a
 * projection is not a behavioural reader, and counting one would overstate the evidence in
 * exactly the way this checkpoint's rule list forbids.
 */
export type SeasonIdentityReader =
  | "destination_season_modifier"
  | "place_memory_merge"
  | "verification_classification"
  | "verification_gap";

interface SeasonIdentityReadCount {
  reads: number;
  consequential: number;
}

let seasonIdentityReads: Map<SeasonIdentityReader, SeasonIdentityReadCount> | undefined;

/** Starts (or with `false`, stops and discards) season-identity read counting. */
export function setSeasonIdentityReadCounting(enabled: boolean): void {
  seasonIdentityReads = enabled ? new Map() : undefined;
}

/**
 * Counts one behavioural consumption of a record's season identity. A no-op — and one
 * `undefined` comparison — when no audit is counting, which is every production path.
 *
 * `consequential` is the part §8 actually asks for: not how often the field was LOOKED at,
 * but how often looking at it CHANGED the reader's answer. A read whose result would have
 * been identical with an empty season list is counted as a read and not as a consequence.
 */
export function countSeasonIdentityRead(
  reader: SeasonIdentityReader,
  seasons: number,
  consequential: boolean,
): void {
  if (seasonIdentityReads === undefined) {
    return;
  }

  const current = seasonIdentityReads.get(reader);

  if (current === undefined) {
    seasonIdentityReads.set(reader, { reads: 1, consequential: consequential ? 1 : 0 });
    return;
  }

  current.reads += 1;

  if (consequential) {
    current.consequential += 1;
  }

  // `seasons` is carried for callers that want it in future ledgers; it is deliberately not
  // summed here, because a mean season count per read is not a quantity §8 asks for.
  void seasons;
}

/** Per-reader counts of behavioural season-identity consumption since counting started. */
export function getSeasonIdentityReads(): Record<string, SeasonIdentityReadCount> {
  return seasonIdentityReads === undefined
    ? {}
    : Object.fromEntries([...seasonIdentityReads].map(([reader, count]) => [reader, { ...count }]));
}

/** Clears every slot in this module. Audit runners call this in a `finally`. */
export function clearScheduleReplayDiagnostics(): void {
  activeRecorder = undefined;
  activeReplay = undefined;
  protectedDonorPlaces = undefined;
  seasonIdentityReads = undefined;
  selectorRotationEnabled = false;
  selectorRotationUsed.clear();
}

/**
 * True when any slot in this module is registered. Used by the parity audit to assert that
 * a diagnostics-off run touched none of them.
 */
export function hasScheduleReplayDiagnostics(): boolean {
  return activeRecorder !== undefined || activeReplay !== undefined || protectedDonorPlaces !== undefined;
}

/** Convenience for audit runners: the donor places a replay is currently carrying. */
export function getDonorPlacesFromActiveReplay(): readonly string[] {
  return activeReplay === undefined ? [] : [...activeReplay.donorPlaces];
}

/** Narrow re-export so callers need not import `Band` just to key the maps. */
export function bandKey(band: Band): string {
  return String(band.id);
}
