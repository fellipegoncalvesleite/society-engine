// CORRECTION-24A §8/§9 — THE ORDINARY-EXPLORATION LAUNCH FUNNEL.
//
// AUDIT-ONLY and NON-PERSISTED. A module-level slot an audit runner sets and clears in a
// `finally`. With nothing registered — every production, worker and UI path — the seam costs one
// boolean test and canonical output is unchanged.
//
// WHY A FUNNEL AND NOT A COUNTER. CORRECTION-23 removed verification travel that had been
// supplying known-country breadth by accident, and ordinary `frontier_exploration` did not expand
// to replace it. "Exploration launches rarely" is not a diagnosis: it collapses at least eight
// distinct failures into one number. A band that has no reason to look, a band that has a reason
// but no direction, a band with both that cannot raise two walkers, and a band with a complete
// valid proposal that loses its slot to a gathering party every single time are four different
// defects with four different repairs — and §9 forbids reporting any of them as "not eligible".
//
// So every launch opportunity is classified into exactly ONE primary blocker, evaluated in the
// physical order production itself applies, with the scheduling outcome recorded separately from
// the eligibility outcome. The critical case the production code cannot show on its own is
// DISPLACED: `maybeLaunchFrontierExploration` is only CALLED when no other family wants the slot,
// so on every day another family wins, production never asks whether exploration was eligible.
// This module asks, using the same pure production functions, and records the answer.

import type { BandId } from "../core/types";

/**
 * §9 — the typed primary blockers. Exactly one is authoritative per opportunity.
 *
 * `SELECTED` is not a blocker; it is the terminal success class, kept in the same union so a row
 * always carries a verdict and an audit can never silently drop an opportunity.
 */
export type ExplorationBlocker =
  | "NO_MOTIVE"
  | "ADEQUATE_KNOWN_ALTERNATIVE"
  | "NO_BAND_KNOWN_FRONTIER"
  | "NO_HEADING"
  | "ROUTE_INFEASIBLE"
  | "RISK_TOO_HIGH"
  | "INSUFFICIENT_LABOR"
  | "INSUFFICIENT_PROVISIONS"
  | "ACTIVE_CAP_FULL"
  | "DISPLACED_BY_URGENT_TASK"
  | "DISPLACED_BY_NONURGENT_TASK"
  | "VALID_BUT_IDLE_SLOT_UNUSED"
  | "ALREADY_EXPLORING"
  | "POPULATION_TOO_SMALL"
  | "OFF_LAUNCH_CADENCE"
  | "OTHER_TYPED_REASON"
  | "SELECTED";

/** What the scheduler actually did with the slot on this opportunity. */
export type SchedulerOutcome =
  | "exploration"
  | "distant_plant_gathering"
  | "distant_hunting"
  | "distant_fishing"
  | "distant_patch_verification"
  | "route_reconnaissance"
  | "frontier_verification"
  | "nothing";

/**
 * One production launch opportunity for one band on one day.
 *
 * E0 motive, E1 hypothesis, E2 feasibility and E3 scheduling are all present on the same row so
 * the four can never be conflated when the matrix is aggregated. Every field is band-known state
 * or a production decision output; nothing here reads hidden ecology.
 */
export interface ExplorationFunnelRow {
  readonly bandId: string;
  readonly day: number;
  readonly scenario?: string;

  // ── E0 motive ──────────────────────────────────────────────────────────────────────────
  readonly foodStress: number;
  readonly waterStress: number;
  readonly rangeSaturation: number;
  readonly lowReturnPressure: number;
  readonly dispersalPressure: number;
  readonly noKnownNonOverlappingDestination: boolean;
  readonly exhaustedKnownOpportunity: boolean;
  readonly evidenceScore: number;
  readonly willingness: number;
  readonly eligible: boolean;
  readonly population: number;
  readonly departableWorkers: number;

  // ── E1 frontier hypothesis ─────────────────────────────────────────────────────────────
  readonly headingAvailable: boolean;
  readonly headingBasis?: string;
  readonly headingConfidence?: number;
  readonly knownEdgeTiles: number;

  // ── E2 physical feasibility ────────────────────────────────────────────────────────────
  readonly partyCompositionAvailable: boolean;
  readonly activeParties: number;
  readonly activeCapFull: boolean;
  readonly onLaunchCadence: boolean;
  readonly suppressionWindowActive: boolean;
  readonly ticksSinceLastExploration?: number;

  // ── E3 scheduling ──────────────────────────────────────────────────────────────────────
  /** True when E0..E2 all passed: production could have launched exploration here. */
  readonly validProposal: boolean;
  readonly competingProposals: readonly string[];
  readonly retrievalWorthwhile: boolean;
  /** Food stress at or above this is treated as urgent for the DISPLACED_BY_* split. */
  readonly retrievalUrgent: boolean;
  readonly schedulerOutcome: SchedulerOutcome;

  /**
   * §10 — was the exploration branch of the scheduler even REACHED on this opportunity?
   *
   * Exploration competes last: `maybeLaunchExpedition` offers it the slot only when no retrieval,
   * patch-verification or reconnaissance candidate wants it. So a slot can go unused with a
   * complete valid exploration proposal in hand simply because an earlier family claimed the
   * decision and then failed to launch. Distinguishing "not offered" from "offered and refused"
   * is the difference between defect class D/E and class C, and it cannot be inferred from the
   * outcome alone.
   */
  readonly explorationOffered: boolean;
  /** Which earlier family held the decision when exploration was not offered. */
  readonly claimedBy?: "retrieval" | "patch_verification" | "reconnaissance" | "frontier_verification";

  /** §9 — the ONE authoritative class for this opportunity. */
  readonly primaryBlocker: ExplorationBlocker;
  /** Everything else that also would have refused. Reported separately, never as primary. */
  readonly secondaryBlockers: readonly ExplorationBlocker[];
}

let funnelRows: ExplorationFunnelRow[] | undefined;
let scenarioLabel: string | undefined;

// The scheduler writes this on its way through; the recorder reads it once and clears it. Only
// ever touched while recording is on.
let offerState: { offered: boolean; claimedBy?: ExplorationFunnelRow["claimedBy"] } | undefined;

/** Called by the scheduler when the exploration branch is reached. */
export function noteExplorationOffered(): void {
  if (funnelRows === undefined) {
    return;
  }

  offerState = { offered: true };
}

/** Called by the scheduler when an earlier family claimed the decision instead. */
export function noteExplorationNotOffered(claimedBy: ExplorationFunnelRow["claimedBy"]): void {
  if (funnelRows === undefined) {
    return;
  }

  offerState = { offered: false, claimedBy };
}

/** Reads and clears the offer state for one opportunity. */
export function takeExplorationOfferState(): {
  offered: boolean;
  claimedBy?: ExplorationFunnelRow["claimedBy"];
} {
  const state = offerState ?? { offered: false };
  offerState = undefined;
  return state;
}

/** Starts (or with `false`, stops and discards) funnel recording. */
export function setExplorationFunnelRecording(enabled: boolean, scenario?: string): void {
  funnelRows = enabled ? [] : undefined;
  scenarioLabel = enabled ? scenario : undefined;
}

/** True while an audit is recording the funnel. The only cost on the production path. */
export function isRecordingExplorationFunnel(): boolean {
  return funnelRows !== undefined;
}

/** Records one launch opportunity. No-op when recording is off. */
export function recordExplorationFunnel(row: ExplorationFunnelRow): void {
  if (funnelRows === undefined) {
    return;
  }

  funnelRows.push(scenarioLabel === undefined ? row : { ...row, scenario: scenarioLabel });
}

/** Every recorded opportunity. */
export function getExplorationFunnel(): readonly ExplorationFunnelRow[] {
  return funnelRows ?? [];
}

// ── E4/E5/E6 — what a launched party physically did, brought home, and whether it mattered ──

export interface ExplorationJourneyRow {
  readonly expeditionId: string;
  readonly bandId: string;
  readonly departureDay: number;
  readonly returnDay?: number;
  readonly lost: boolean;
  readonly partyWorkers: number;
  readonly routeSteps: number;
  readonly deepestReachTiles: number;
  /** Tiles the party physically entered that the BAND did not already know. */
  readonly newTilesEntered: number;
  readonly knownTilesRevisited: number;
  readonly partyLocalObservations: number;
  /** E5 — what actually reached the canonical writer. Zero for a lost party. */
  readonly newRecordsCreated: number;
  readonly existingRecordsRefreshed: number;
}

let journeyRows: ExplorationJourneyRow[] | undefined;

export function setExplorationJourneyRecording(enabled: boolean): void {
  journeyRows = enabled ? [] : undefined;
}

export function isRecordingExplorationJourneys(): boolean {
  return journeyRows !== undefined;
}

export function recordExplorationJourney(row: ExplorationJourneyRow): void {
  if (journeyRows === undefined) {
    return;
  }

  journeyRows.push(row);
}

export function getExplorationJourneys(): readonly ExplorationJourneyRow[] {
  return journeyRows ?? [];
}

/** Convenience for callers keying by band without importing the branded type. */
export function bandKey(bandId: BandId): string {
  return String(bandId);
}

/** Clears every slot here. Audit runners call this in a `finally`. */
export function clearExplorationDiagnostics(): void {
  funnelRows = undefined;
  journeyRows = undefined;
  scenarioLabel = undefined;
  offerState = undefined;
}

/** True when any slot is registered — asserted zero by the diagnostics-off parity audit. */
export function hasExplorationDiagnostics(): boolean {
  return funnelRows !== undefined || journeyRows !== undefined;
}
