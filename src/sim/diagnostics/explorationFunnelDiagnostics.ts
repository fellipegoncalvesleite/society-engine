// CORRECTION-24A §4/§6/§7/§8/§9/§10/§11 — THE ORDINARY-EXPLORATION CAUSAL CHAIN.
//
// AUDIT-ONLY and NON-PERSISTED. Module-level slots an audit runner sets and clears in a `finally`.
// With nothing registered — every production, worker and UI path — the seam costs one boolean test
// and canonical output is unchanged.
//
// WHY A FUNNEL AND NOT A COUNTER. CORRECTION-23 removed verification travel that had been supplying
// known-country breadth by accident, and ordinary `frontier_exploration` did not expand to replace
// it. "Exploration launches rarely" is not a diagnosis: it collapses at least a dozen distinct
// failures into one number. A band with no reason to look, a band with a reason but no direction, a
// band that cannot take a first physical step, and a band with a complete physically valid proposal
// whose slot is claimed by a family that then fails to launch are four different defects with four
// different repairs.
//
// WHAT THE FIRST PASS GOT WRONG, AND WHAT §4 CORRECTS HERE.
//
//   (1) `ALREADY_EXPLORING` conflated a COOLDOWN with a CONCURRENT PARTY. The suppression window is
//       stamped when a party is RAISED and runs 12 ticks; the party itself is usually home long
//       before that. Those are different physical facts with different repairs, so they are now
//       `SUPPRESSION_WINDOW_ACTIVE` and `ACTIVE_FRONTIER_PARTY` and are recorded separately.
//
//   (2) `validProposal` was claimed on eligibility + heading + labour alone. Route, first step,
//       return reserve, provisions and risk were never instrumented, so the name asserted more than
//       the measurement supported. The partially evaluated state is now
//       `eligibleExplorationIntent`; only a row that clears the complete §6 contract is a
//       `physicallyValidExplorationProposal`.
//
//   (3) The scheduler recorded ACTIVE expeditions as `competingProposals` — a party already walking
//       is not a proposal competing for today's slot. §7 replaces that with the real same-decision
//       ledger: every family's candidate, its eligibility, and whether it launched.
//
//   (4) A family could claim the decision and then fail to launch, leaving the slot idle with a
//       valid exploration proposal in hand. The first pass could see that the slot went unused but
//       not WHY, so it could not distinguish scheduler ORDERING from scheduler FALLTHROUGH. §7's
//       typed post-claim failures close that.


import type { BandId } from "../core/types";

/**
 * §6/§9 — the typed primary blockers. Exactly one is authoritative per opportunity.
 *
 * `SELECTED` is not a blocker; it is the terminal success class, kept in the same union so a row
 * always carries a verdict and an audit can never silently drop an opportunity.
 *
 * `INSUFFICIENT_PROVISIONS` and `RISK_AUTHORITY_REFUSES` are DECLARED BUT NEVER PRODUCED in this
 * architecture, and that is a finding rather than a measured zero — see `ExplorationAuthorityPresence`.
 * Nothing may report them as "tested and never fired".
 */
export type ExplorationBlocker =
  // E0 motive
  | "NO_MOTIVE"
  | "ADEQUATE_KNOWN_ALTERNATIVE"
  // E1 hypothesis
  | "NO_BAND_KNOWN_FRONTIER"
  | "NO_HEADING"
  // E2 physical feasibility
  | "NO_PASSABLE_FIRST_STEP"
  | "NO_RETURN_RESERVE"
  | "INSUFFICIENT_DURATION_BUDGET"
  | "INSUFFICIENT_PROVISIONS"
  | "RISK_AUTHORITY_REFUSES"
  | "INSUFFICIENT_LABOR"
  | "ACTIVE_CAP_FULL"
  // §4.1 — a cooldown and a concurrent party are DIFFERENT physical facts.
  | "SUPPRESSION_WINDOW_ACTIVE"
  | "ACTIVE_FRONTIER_PARTY"
  | "POPULATION_TOO_SMALL"
  | "OFF_LAUNCH_CADENCE"
  // E3 scheduling
  | "DISPLACED_BY_URGENT_TASK"
  | "DISPLACED_BY_NONURGENT_TASK"
  | "VALID_BUT_IDLE_SLOT_UNUSED"
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

/** §7 — the five families that compete for one band's one scheduling decision. */
export type SchedulerFamily =
  | "distant_retrieval"
  | "frontier_water_verification"
  | "distant_patch_verification"
  | "route_reconnaissance"
  | "frontier_exploration";

/**
 * §7 — how a family fared AFTER it took the decision.
 *
 * These are the only ways `maybeLaunchExpeditionInner` can reach its end without attaching an
 * expedition once a candidate has been chosen. Each maps to exactly one production early-return.
 */
export type PostClaimFailure =
  | "PARTY_COMPOSITION_FAILED"
  | "SAME_TARGET_CONFLICT"
  | "ROUTE_BUILD_FAILED"
  | "DURATION_FAILED"
  | "TARGET_STALE"
  | "OTHER_TYPED_FAILURE";

/**
 * §6 — does production HAVE the authority this class names, at launch time?
 *
 * Recorded per audit run and asserted by the runner. A class with `false` here must be reported as
 * "no launch-time authority", never as a measured zero. This exists specifically to stop an unused
 * enum value from being read as evidence that a gate was tested and passed.
 */
export interface ExplorationAuthorityPresence {
  readonly firstStep: boolean;
  readonly returnReserve: boolean;
  readonly durationBudget: boolean;
  readonly provisions: boolean;
  readonly risk: boolean;
  readonly labor: boolean;
  readonly activeCap: boolean;
}

/**
 * The measured authority presence for `frontier_exploration` at `d865beec`, read from production
 * rather than assumed. `maybeLaunchFrontierExploration` gates on suppression, worker count,
 * eligibility, heading and party composition and nothing else; provisions are consumed per day IN
 * FLIGHT (`consumeProvisions`) against a budget derived from the duration cap, and risk episodes are
 * generated in flight by the acute-risk system. Neither is consulted before the party is raised.
 */
export const EXPLORATION_LAUNCH_AUTHORITIES: ExplorationAuthorityPresence = {
  firstStep: true,
  returnReserve: true,
  durationBudget: true,
  provisions: false,
  risk: false,
  labor: true,
  activeCap: true,
};

/** §7 — one family's line in one band's one same-decision ledger. */
export interface SchedulerFamilyLedgerRow {
  readonly family: SchedulerFamily;
  readonly candidateExists: boolean;
  /** Target tile for a destination family; the band-known ANCHOR for exploration. */
  readonly candidateTarget?: string;
  readonly eligible: boolean;
  /**
   * `claimed` — this family took the decision.
   * `considered` — it was evaluated and passed over.
   * `not_reached` — an earlier family took the decision before this one was evaluated at all.
   */
  readonly priorityStatus: "claimed" | "considered" | "not_reached";
  readonly workersRequired: number;
  readonly partyCompositionAvailable: boolean;
  readonly routeFeasible?: boolean;
  readonly durationFeasible?: boolean;
  readonly reasonSelected?: string;
  readonly reasonRejectedBeforeSelection?: string;
  readonly reasonFailedAfterSelection?: PostClaimFailure;
  readonly actualLaunch: boolean;
}

/**
 * One production launch opportunity for one band on one day.
 *
 * E0 motive, E1 hypothesis, E2 feasibility and E3 scheduling are all present on the same row so the
 * four can never be conflated when the matrix is aggregated. Every field is band-known state or a
 * production decision output; nothing here reads hidden ecology.
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

  // ── E2 physical feasibility (§6) ───────────────────────────────────────────────────────
  readonly partyCompositionAvailable: boolean;
  readonly activeParties: number;
  readonly activeCapFull: boolean;
  readonly onLaunchCadence: boolean;
  /** §4.1 — the 12-tick COOLDOWN, stamped when a party was raised. */
  readonly suppressionWindowActive: boolean;
  readonly ticksSinceLastExploration?: number;
  /** §4.1 — a frontier party physically away RIGHT NOW. Distinct from the cooldown above. */
  readonly activeFrontierParty: boolean;
  /**
   * §6 — ordinary exploration discovers its route incrementally, so a hidden full route is never
   * required. What IS required is that the party can physically leave: a passable, heading-aligned,
   * unwalked first step from the band's own position.
   */
  readonly canBeginPhysicalExploration: boolean;
  /** §6 — normally FALSE for frontier exploration, and never required. */
  readonly fullRouteKnown: boolean;
  readonly firstStepOutcome: "step" | "blocked" | "budget_reached" | "no_plan";
  readonly returnReserveTiles: number;
  readonly durationBudgetDays: number;

  // ── E2/E3 verdicts (§4.2) ──────────────────────────────────────────────────────────────
  /** Motive + hypothesis + labour + slot. NOT a proposal: route and reserve are not in it. */
  readonly eligibleExplorationIntent: boolean;
  /** The complete §6 contract, every authority that EXISTS in production having passed. */
  readonly physicallyValidExplorationProposal: boolean;

  // ── E3 scheduling ──────────────────────────────────────────────────────────────────────
  /** §7 — the real same-decision ledger. Never active expeditions. */
  readonly proposalLedger: readonly SchedulerFamilyLedgerRow[];
  /** Kinds of parties already away. Recorded as CONTEXT, explicitly not as competing proposals. */
  readonly activePartyKinds: readonly string[];
  readonly retrievalWorthwhile: boolean;
  /** Food stress at or above this is treated as urgent for the DISPLACED_BY_* split. */
  readonly retrievalUrgent: boolean;
  readonly schedulerOutcome: SchedulerOutcome;

  /**
   * §7/§10 — was the exploration branch of the scheduler even REACHED on this opportunity?
   *
   * Exploration competes last: `maybeLaunchExpedition` offers it the slot only when no retrieval,
   * patch-verification or reconnaissance candidate wants it. So a slot can go unused with a complete
   * valid exploration proposal in hand simply because an earlier family claimed the decision and
   * then failed to launch. Distinguishing "not offered" from "offered and refused" is the difference
   * between scheduler ORDERING and scheduler FALLTHROUGH.
   */
  readonly explorationOffered: boolean;
  /** Which earlier family held the decision when exploration was not offered. */
  readonly claimedBy?: SchedulerFamily;
  /** §7 — and what happened to that claiming family afterwards. Absent when it launched. */
  readonly claimFailure?: PostClaimFailure;
  /** The claiming family's own candidate, so a fallthrough trace can name it. */
  readonly claimedCandidateTarget?: string;
  /**
   * §7 — the complete fallthrough condition: a physically valid exploration proposal existed, an
   * earlier family claimed the decision, that family then failed to launch, and the slot went unused
   * without exploration ever being reconsidered.
   */
  readonly fallthroughOpportunity: boolean;

  /** §9 — the ONE authoritative class for this opportunity. */
  readonly primaryBlocker: ExplorationBlocker;
  /** Everything else that also would have refused. Reported separately, never as primary. */
  readonly secondaryBlockers: readonly ExplorationBlocker[];
}

let funnelRows: ExplorationFunnelRow[] | undefined;
let scenarioLabel: string | undefined;

// ── §8 — OFFER STATE, KEYED AND SELF-CHECKED ────────────────────────────────────────────────
//
// The first pass used a single module-global slot. It was in fact safe — `maybeLaunchExpedition`
// calls the inner scheduler and the recorder back to back inside one synchronous call, and
// `applyExpeditionDay` walks bands strictly sequentially, so no second band can interleave. But
// "safe if you trace the whole call graph" is not the same as "provably scoped", and a module-global
// slot that silently associates one band's decision with another band is exactly the instrument
// error this pass exists to rule out.
//
// So the slot is now KEYED BY bandId AND day. A mismatched read returns the unset default instead of
// another band's answer, and the pairing counters below make a leak observable rather than
// assumable: every recorded opportunity consumes exactly one state, and nothing may be left over at
// the end of a day.

interface OfferState {
  readonly bandId: string;
  readonly day: number;
  readonly offered: boolean;
  readonly claimedBy?: SchedulerFamily;
  readonly claimFailure?: PostClaimFailure;
  readonly claimedCandidateTarget?: string;
}

let offerState: OfferState | undefined;

/** §8 — pairing self-check. Every counter is audit-only and reset with the recording slots. */
const pairing = {
  written: 0,
  consumed: 0,
  /** A read whose key did not match the writer's key. Must be zero. */
  keyMismatch: 0,
  /** A state written and then never consumed (overwritten or abandoned). Must be zero. */
  overwritten: 0,
};

/** Called by the scheduler when the exploration branch is reached. */
export function noteExplorationOffered(bandId: BandId, day: number): void {
  if (funnelRows === undefined) {
    return;
  }

  if (offerState !== undefined) {
    pairing.overwritten += 1;
  }

  pairing.written += 1;
  offerState = { bandId: String(bandId), day, offered: true };
}

/** Called by the scheduler when an earlier family claimed the decision instead. */
export function noteExplorationNotOffered(
  bandId: BandId,
  day: number,
  claimedBy: SchedulerFamily,
  claimedCandidateTarget?: string,
): void {
  if (funnelRows === undefined) {
    return;
  }

  if (offerState !== undefined) {
    pairing.overwritten += 1;
  }

  pairing.written += 1;
  offerState = {
    bandId: String(bandId),
    day,
    offered: false,
    claimedBy,
    ...(claimedCandidateTarget === undefined ? {} : { claimedCandidateTarget }),
  };
}

/**
 * §7 — the claiming family reached one of the scheduler's typed early returns instead of launching.
 *
 * Called from each post-selection exit in `maybeLaunchExpeditionInner`. Without this the audit can
 * see that a slot went unused but not whether the cause was ordering (the claiming family launched,
 * exploration simply lost) or FALLTHROUGH (the claiming family launched nothing and the day was
 * wasted). Those have different repairs, so they may not be collapsed.
 */
export function noteClaimFailure(failure: PostClaimFailure): void {
  if (funnelRows === undefined || offerState === undefined) {
    return;
  }

  offerState = { ...offerState, claimFailure: failure };
}

/** Reads and clears the offer state for one opportunity. Key-checked. */
export function takeExplorationOfferState(
  bandId: BandId,
  day: number,
): {
  readonly offered: boolean;
  readonly claimedBy?: SchedulerFamily;
  readonly claimFailure?: PostClaimFailure;
  readonly claimedCandidateTarget?: string;
} {
  const state = offerState;
  offerState = undefined;

  if (state === undefined) {
    // The scheduler returned before reaching either marker — active cap full, off cadence, or too
    // few departable workers. Not a leak: nothing was written, so nothing is consumed.
    return { offered: false };
  }

  pairing.consumed += 1;

  if (state.bandId !== String(bandId) || state.day !== day) {
    pairing.keyMismatch += 1;
    return { offered: false };
  }

  return {
    offered: state.offered,
    ...(state.claimedBy === undefined ? {} : { claimedBy: state.claimedBy }),
    ...(state.claimFailure === undefined ? {} : { claimFailure: state.claimFailure }),
    ...(state.claimedCandidateTarget === undefined ? {} : { claimedCandidateTarget: state.claimedCandidateTarget }),
  };
}

/**
 * §7 — what the scheduler ACTUALLY had in front of it on this one decision.
 *
 * Pushed by the scheduler rather than re-derived by the recorder. A re-derivation would have to
 * replicate the gating order exactly (`verification` is only computed when retrieval is unworthwhile,
 * and so on), and a drift between the replica and production would be invisible — it would look like
 * a finding. Recording what the scheduler held removes that whole class of instrument error.
 */
export interface ProposalCandidateSnapshot {
  readonly retrievalExists: boolean;
  readonly retrievalTarget?: string;
  readonly retrievalWorthwhile: boolean;
  readonly verifyBeforeRetrieving: boolean;
  readonly waterVerificationGateOpen: boolean;
  readonly patchVerificationExists: boolean;
  readonly patchVerificationTarget?: string;
  readonly reconnaissanceExists: boolean;
  readonly reconnaissanceTarget?: string;
  readonly partyWorkers: number;
}

let candidateSnapshot: (ProposalCandidateSnapshot & { readonly bandId: string; readonly day: number }) | undefined;

export function noteProposalCandidates(bandId: BandId, day: number, snapshot: ProposalCandidateSnapshot): void {
  if (funnelRows === undefined) {
    return;
  }

  candidateSnapshot = { ...snapshot, bandId: String(bandId), day };
}

export function takeProposalCandidates(bandId: BandId, day: number): ProposalCandidateSnapshot | undefined {
  const snapshot = candidateSnapshot;
  candidateSnapshot = undefined;

  if (snapshot === undefined || snapshot.bandId !== String(bandId) || snapshot.day !== day) {
    return undefined;
  }

  return snapshot;
}

/**
 * §8 — the self-check an audit runner asserts after every simulated day.
 *
 * `leftover` is the state written by a scheduler call whose recorder never ran. On a correct day it
 * is zero: the recorder runs unconditionally after the inner scheduler for every band.
 */
export function getOfferStatePairing(): {
  readonly written: number;
  readonly consumed: number;
  readonly keyMismatch: number;
  readonly overwritten: number;
  readonly leftover: number;
} {
  return { ...pairing, leftover: offerState === undefined ? 0 : 1 };
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

/**
 * CORRECTION-24A COMPLETION §15 — hand back everything recorded so far and start a fresh buffer,
 * WITHOUT touching the recording flags, the arm, the scenario label or the pairing counters.
 *
 * The 200- and 500-year matrices produce hundreds of thousands of opportunities per seed, and
 * holding them all to the end of a run is a memory bound on the AUDIT, not on the simulation. The
 * long-horizon scripts drain and aggregate once per simulated year instead. Draining is
 * behaviourally identical to reading at the end — the rows are append-only and nothing in
 * production ever reads them back.
 */
export function drainExplorationFunnel(): readonly ExplorationFunnelRow[] {
  if (funnelRows === undefined) {
    return [];
  }

  const drained = funnelRows;
  funnelRows = [];

  return drained;
}

// NO equivalent drain exists for the E4 journey rows or the E5 record rows, DELIBERATELY. Both are
// AMENDED after they are first written — a journey by `amendExplorationJourney` when the party gets
// home, a record by `amendExplorationRecordFirstCompression` at the first annual compression it
// meets — and a drain that removed a row before its amendment arrived would silently drop the
// eviction verdict and leave a smaller, quieter number in its place. That is exactly the vacuous
// measurement AUDIT_ADMISSIBILITY.md forbids. They are also two orders of magnitude smaller than the
// funnel rows, so there is nothing to gain by risking it.

// ── §9 E4 — WHAT A LAUNCHED PARTY PHYSICALLY DID ────────────────────────────────────────────

/**
 * One ordinary frontier-exploration journey, recorded from the physical lifecycle rather than
 * reconstructed from final known-tile counts.
 *
 * A LOST party must record zero transferred observations. That is asserted by the runner, not
 * assumed here: the fields are written at the canonical return seam, which a lost party never
 * reaches.
 */
export interface ExplorationJourneyRow {
  readonly expeditionId: string;
  readonly bandId: string;
  readonly scenario?: string;
  readonly departureDay: number;
  readonly returnDay?: number;
  readonly lost: boolean;
  readonly forcedReturn: boolean;
  readonly durationDays?: number;
  readonly partyWorkers: number;
  readonly headingX: number;
  readonly headingY: number;
  readonly headingBasis: string;
  readonly anchorTileId: string;
  /** The trail the party actually walked, one 4-adjacent physical step per entry. */
  readonly routeTileIds: readonly string[];
  readonly routeSteps: number;
  readonly routeStepsByDay: readonly number[];
  readonly deepestReachTiles: number;
  /** Tiles the party physically entered that the BAND did not already know. */
  readonly newTilesEntered: number;
  readonly knownTilesRevisited: number;
  readonly partyLocalObservations: number;
  readonly provisionsConsumed: number;
  readonly riskEpisodes: number;
  /** E5 — what actually reached the canonical writer. Zero for a lost party. */
  readonly newRecordsCreated: number;
  readonly existingRecordsRefreshed: number;
}

let journeyRows: ExplorationJourneyRow[] | undefined;

/**
 * §9 — physical steps per day, accumulated while the party walks.
 *
 * `routeStepsByDay` cannot be derived from the finished record: `routeTileIds` is the whole trail
 * and `travelDaysElapsed` is a count, so a 12-tile trail over 4 days could be 3/3/3/3 or 9/1/1/1.
 * The distinction matters — a party that covers its whole budget on day one and then turns round is
 * a different journey from one that walks steadily — so it is recorded as it happens rather than
 * reconstructed. Audit-only and non-persisted: the expedition record itself is untouched.
 */
const stepsByExpedition = new Map<string, number[]>();

export function noteFrontierStepDay(expeditionId: string, steps: number): void {
  if (journeyRows === undefined) {
    return;
  }

  const existing = stepsByExpedition.get(expeditionId);

  if (existing === undefined) {
    stepsByExpedition.set(expeditionId, [steps]);
    return;
  }

  existing.push(steps);
}

export function takeFrontierStepDays(expeditionId: string): readonly number[] {
  const steps = stepsByExpedition.get(expeditionId) ?? [];
  stepsByExpedition.delete(expeditionId);
  return steps;
}

export function setExplorationJourneyRecording(enabled: boolean): void {
  journeyRows = enabled ? [] : undefined;

  if (!enabled) {
    stepsByExpedition.clear();
  }
}

export function isRecordingExplorationJourneys(): boolean {
  return journeyRows !== undefined;
}

export function recordExplorationJourney(row: ExplorationJourneyRow): void {
  if (journeyRows === undefined) {
    return;
  }

  journeyRows.push(scenarioLabel === undefined ? row : { ...row, scenario: scenarioLabel });
}

export function getExplorationJourneys(): readonly ExplorationJourneyRow[] {
  return journeyRows ?? [];
}

/** Fills in E5 totals once the return seam has run for this journey. */
export function amendExplorationJourney(expeditionId: string, patch: Partial<ExplorationJourneyRow>): void {
  if (journeyRows === undefined) {
    return;
  }

  for (let i = journeyRows.length - 1; i >= 0; i -= 1) {
    const row = journeyRows[i];

    if (row !== undefined && row.expeditionId === expeditionId) {
      journeyRows[i] = { ...row, ...patch };
      return;
    }
  }
}

// ── §10 E5 — RETURNED KNOWLEDGE AND RETENTION ───────────────────────────────────────────────

/**
 * One `KnownTileRecord` created or refreshed by an ordinary exploration return, followed to its
 * first annual compression.
 *
 * §10 forbids collapsing "the party returned observations" into "the band has usable knowledge".
 * They are different events separated by up to a year of compression, so they are different fields:
 * `createdAt` is the return, `evictedAtFirstCompression` is whether it survived to be read.
 */
export interface ExplorationRecordRow {
  readonly bandId: string;
  readonly scenario?: string;
  readonly tileId: string;
  readonly expeditionId: string;
  readonly createdDay: number;
  readonly isNewRecord: boolean;
  readonly acquisitionKind?: string;
  readonly confidence: number;
  readonly seasonsObserved: number;
  readonly firstObservedDay: number;
  readonly lastObservedDay: number;
  readonly nextCompressionDay?: number;
  readonly evictedAtFirstCompression?: boolean;
  readonly evictionDay?: number;
  /** Days from creation to eviction; undefined while the record still lives. */
  readonly lifetimeDays?: number;
  readonly reacquiredLaterDay?: number;
}

let recordRows: ExplorationRecordRow[] | undefined;

export function setExplorationRecordRecording(enabled: boolean): void {
  recordRows = enabled ? [] : undefined;
}

export function isRecordingExplorationRecords(): boolean {
  return recordRows !== undefined;
}

export function recordExplorationRecord(row: ExplorationRecordRow): void {
  if (recordRows === undefined) {
    return;
  }

  recordRows.push(scenarioLabel === undefined ? row : { ...row, scenario: scenarioLabel });
}

/**
 * Amends an already-recorded row at the FIRST annual compression it meets, and only then.
 *
 * Compression runs once a year over every surviving record, so an unconditional amend would keep
 * overwriting the verdict and a record that survived its first compression and was evicted at its
 * third would be reported as evicted-at-first. Guarding on `evictedAtFirstCompression` being unset
 * keeps the field meaning what its name says.
 */
export function amendExplorationRecordFirstCompression(
  bandId: string,
  tileId: string,
  patch: Partial<ExplorationRecordRow>,
): void {
  if (recordRows === undefined) {
    return;
  }

  for (let i = recordRows.length - 1; i >= 0; i -= 1) {
    const row = recordRows[i];

    if (row !== undefined && row.bandId === bandId && row.tileId === tileId) {
      if (row.evictedAtFirstCompression === undefined) {
        recordRows[i] = { ...row, ...patch };
      }

      return;
    }
  }
}

export function getExplorationRecords(): readonly ExplorationRecordRow[] {
  return recordRows ?? [];
}

// ── §11 E6 — FIRST READER AND PHYSICAL-ACTION CONSUMPTION ───────────────────────────────────

/**
 * The families that can read a returned exploration record and take a physical action on it.
 *
 * §11 excludes UI reads, projection reads, score computation with no selected-action difference,
 * retry-memory changes, and a reader merely returning a value. Only a CHANGED SELECTED ACTION
 * counts, which is why every row carries the verdict and the action on both sides.
 */
export type ReaderFamily =
  | "movement_destination"
  | "resource_activity"
  | "route_corridor"
  | "camp"
  | "daughter_fission";

export interface ExplorationReaderRow {
  readonly bandId: string;
  readonly scenario?: string;
  readonly tileId: string;
  readonly recordCreatedDay: number;
  readonly readDay: number;
  readonly readerFamily: ReaderFamily;
  /** Ticks between the record arriving and this read. Bounded to one year by the runner. */
  readonly latencyDays: number;
  readonly verdictBefore: number;
  readonly verdictAfter: number;
  readonly selectedActionBefore: string;
  readonly selectedActionAfter: string;
  /** The physical action the band actually took. Empty when the read changed nothing physical. */
  readonly actualPhysicalAction?: string;
  /** TRUE only when the selected action differs AND that difference is physical. */
  readonly changedPhysicalAction: boolean;
}

let readerRows: ExplorationReaderRow[] | undefined;

export function setExplorationReaderRecording(enabled: boolean): void {
  readerRows = enabled ? [] : undefined;
}

export function isRecordingExplorationReaders(): boolean {
  return readerRows !== undefined;
}

export function recordExplorationReader(row: ExplorationReaderRow): void {
  if (readerRows === undefined) {
    return;
  }

  readerRows.push(scenarioLabel === undefined ? row : { ...row, scenario: scenarioLabel });
}

export function getExplorationReaders(): readonly ExplorationReaderRow[] {
  return readerRows ?? [];
}

// ── §12 — AUDIT-ONLY COUNTERFACTUAL ARMS (O0–O5) ────────────────────────────────────────────

/**
 * The O arms. Every one is audit-only and unset in every normal world, so production behaviour is
 * exactly `d865beec` unless a runner deliberately selects an arm.
 *
 *   O0  production.
 *   O1  a physically valid exploration proposal wins over a NONURGENT competitor.
 *   O2  scheduler-fallthrough repair: reconsider exploration when the claiming family failed to
 *       launch and the slot is still free. Isolates the idle-fallthrough defect and nothing else.
 *   O3  the journey happens; only the residential knowledge handoff after physical return is
 *       suppressed.
 *   O4  records returned by ordinary exploration survive their FIRST annual compression.
 *   O5  one downstream reader family is suppressed at a time.
 */
export type ExplorationArm = "O0" | "O1" | "O2" | "O3" | "O4" | "O5";

let arm: ExplorationArm = "O0";
let suppressedReader: ReaderFamily | undefined;

export function setExplorationArm(next: ExplorationArm, reader?: ReaderFamily): void {
  arm = next;
  suppressedReader = reader;
}

export function getExplorationArm(): ExplorationArm {
  return arm;
}

/** O1 — may a valid exploration proposal take the slot from a nonurgent competitor? */
export function isExplorationPriorityArm(): boolean {
  return arm === "O1";
}

/** O2 — may the scheduler reconsider exploration after a claiming family failed to launch? */
export function isFallthroughRepairArm(): boolean {
  return arm === "O2";
}

/** O3 — suppress the residential knowledge handoff after a physical return. */
export function isKnowledgeWithheldArm(): boolean {
  return arm === "O3";
}

/** O4 — protect exploration-returned records from their first annual compression. */
export function isSparseRetentionArm(): boolean {
  return arm === "O4";
}

/** O5 — is this reader family suppressed on this arm? */
export function isReaderSuppressed(family: ReaderFamily): boolean {
  return arm === "O5" && suppressedReader === family;
}

/**
 * O5 — hide one reader family's view of exploration-returned records, and only that family's.
 *
 * §12 requires the journeys and the returned records to be PRESERVED and exactly one downstream
 * reader suppressed at a time, so this filters at the reader's own entry point rather than at the
 * writer: the record still exists, still occupies retention capacity, and every other family still
 * sees it. `isReaderSuppressed` is false on every arm but O5 and false for every family but the one
 * named, so this is the identity function in every normal world and on all five other arms.
 *
 * The structural type is deliberate — the diagnostics module must not import the knowledge types
 * (that would make an audit module a dependency of the knowledge graph).
 */
export function hideExplorationRecordsFromReader<T extends { readonly acquisition?: string }>(
  family: ReaderFamily,
  records: Readonly<Record<string, T>>,
): Readonly<Record<string, T>> {
  if (!isReaderSuppressed(family)) {
    return records;
  }

  const kept: Record<string, T> = {};

  for (const [tileId, record] of Object.entries(records)) {
    if (record.acquisition !== "returned_frontier_exploration") {
      kept[tileId] = record;
    }
  }

  return kept;
}

/** O5, single-record form for readers that look one tile up rather than scanning. */
export function hideExplorationRecordFromReader<T extends { readonly acquisition?: string }>(
  family: ReaderFamily,
  record: T | undefined,
): T | undefined {
  if (record === undefined || !isReaderSuppressed(family)) {
    return record;
  }

  return record.acquisition === "returned_frontier_exploration" ? undefined : record;
}

// ── SHARED ──────────────────────────────────────────────────────────────────────────────────

/** Convenience for callers keying by band without importing the branded type. */
export function bandKey(bandId: BandId): string {
  return String(bandId);
}

/**
 * §6/§9 — classify one opportunity into exactly ONE primary blocker, in the physical order
 * production itself applies, and derive the two §4.2 verdicts and the §7 fallthrough condition.
 *
 * Pure. Kept here rather than in `expedition.ts` so the production module carries the derivation of
 * physical facts and none of the audit's taxonomy.
 */
export function classifyExplorationOpportunity(facts: {
  readonly activeCapFull: boolean;
  readonly onLaunchCadence: boolean;
  readonly departableWorkers: number;
  readonly suppressionWindowActive: boolean;
  readonly activeFrontierParty: boolean;
  readonly eligible: boolean;
  readonly noKnownNonOverlappingDestination: boolean;
  readonly knownEdgeTiles: number;
  readonly headingAvailable: boolean;
  readonly partyCompositionAvailable: boolean;
  readonly firstStepOutcome: ExplorationFunnelRow["firstStepOutcome"];
  readonly returnReserveTiles: number;
  readonly durationBudgetDays: number;
  readonly schedulerOutcome: SchedulerOutcome;
  readonly retrievalUrgent: boolean;
  readonly explorationOffered: boolean;
  readonly claimFailure?: PostClaimFailure;
}): {
  readonly primaryBlocker: ExplorationBlocker;
  readonly secondaryBlockers: readonly ExplorationBlocker[];
  readonly eligibleExplorationIntent: boolean;
  readonly physicallyValidExplorationProposal: boolean;
  readonly canBeginPhysicalExploration: boolean;
  readonly fallthroughOpportunity: boolean;
} {
  const canBegin = facts.firstStepOutcome === "step" && facts.returnReserveTiles > 0;

  // §4.2 — motive, hypothesis, labour and a free slot. Route and reserve are NOT in this.
  const eligibleExplorationIntent =
    !facts.activeCapFull &&
    facts.onLaunchCadence &&
    facts.departableWorkers >= 2 &&
    !facts.suppressionWindowActive &&
    facts.eligible &&
    facts.headingAvailable &&
    facts.partyCompositionAvailable;

  // §4.2/§6 — the complete contract. Provisions and risk have NO launch-time authority in this
  // architecture, so they are absent from the conjunction rather than silently passing it; the
  // absence is reported through EXPLORATION_LAUNCH_AUTHORITIES and must be read with it.
  const physicallyValidExplorationProposal =
    eligibleExplorationIntent && canBegin && facts.durationBudgetDays > 0;

  const secondary: ExplorationBlocker[] = [];
  const note = (blocker: ExplorationBlocker, condition: boolean): void => {
    if (condition) secondary.push(blocker);
  };

  note("ACTIVE_CAP_FULL", facts.activeCapFull);
  note("OFF_LAUNCH_CADENCE", !facts.onLaunchCadence);
  note("POPULATION_TOO_SMALL", facts.departableWorkers < 2);
  note("SUPPRESSION_WINDOW_ACTIVE", facts.suppressionWindowActive);
  note("ACTIVE_FRONTIER_PARTY", facts.activeFrontierParty);
  note("NO_MOTIVE", !facts.eligible);
  note("ADEQUATE_KNOWN_ALTERNATIVE", !facts.noKnownNonOverlappingDestination);
  note("NO_BAND_KNOWN_FRONTIER", facts.knownEdgeTiles === 0);
  note("NO_HEADING", !facts.headingAvailable);
  note("INSUFFICIENT_LABOR", !facts.partyCompositionAvailable);
  note("NO_PASSABLE_FIRST_STEP", facts.firstStepOutcome === "blocked");
  note("NO_RETURN_RESERVE", facts.returnReserveTiles <= 0);
  note("INSUFFICIENT_DURATION_BUDGET", facts.durationBudgetDays <= 0);

  const primaryBlocker: ExplorationBlocker = facts.activeCapFull
    ? "ACTIVE_CAP_FULL"
    : !facts.onLaunchCadence
      ? "OFF_LAUNCH_CADENCE"
      : facts.departableWorkers < 2
        ? "POPULATION_TOO_SMALL"
        : // §4.1 — the cooldown is checked first because production checks it first, but a
          // CONCURRENT party is reported as its own class when the cooldown is not what binds.
          facts.suppressionWindowActive
          ? "SUPPRESSION_WINDOW_ACTIVE"
          : facts.activeFrontierParty
            ? "ACTIVE_FRONTIER_PARTY"
            : !facts.eligible
              ? // A band that already knows a viable destination outside its range is not failing to
                // explore — it has nowhere it needs to look. That is a different finding from having
                // no motive at all, and §9 keeps them apart.
                !facts.noKnownNonOverlappingDestination
                ? "ADEQUATE_KNOWN_ALTERNATIVE"
                : "NO_MOTIVE"
              : facts.knownEdgeTiles === 0
                ? "NO_BAND_KNOWN_FRONTIER"
                : !facts.headingAvailable
                  ? "NO_HEADING"
                  : !facts.partyCompositionAvailable
                    ? "INSUFFICIENT_LABOR"
                    : facts.firstStepOutcome === "blocked"
                      ? "NO_PASSABLE_FIRST_STEP"
                      : facts.returnReserveTiles <= 0
                        ? "NO_RETURN_RESERVE"
                        : facts.durationBudgetDays <= 0
                          ? "INSUFFICIENT_DURATION_BUDGET"
                          : facts.schedulerOutcome === "exploration"
                            ? "SELECTED"
                            : facts.schedulerOutcome === "nothing"
                              ? "VALID_BUT_IDLE_SLOT_UNUSED"
                              : facts.retrievalUrgent
                                ? "DISPLACED_BY_URGENT_TASK"
                                : "DISPLACED_BY_NONURGENT_TASK";

  // §7 — the complete fallthrough condition. Every clause is required: a valid proposal existed, an
  // earlier family took the decision, that family then FAILED to launch, and nothing left.
  const fallthroughOpportunity =
    physicallyValidExplorationProposal &&
    !facts.explorationOffered &&
    facts.claimFailure !== undefined &&
    facts.schedulerOutcome === "nothing";

  return {
    primaryBlocker,
    secondaryBlockers: secondary.filter((blocker) => blocker !== primaryBlocker),
    eligibleExplorationIntent,
    physicallyValidExplorationProposal,
    canBeginPhysicalExploration: canBegin,
    fallthroughOpportunity,
  };
}

/** Clears every slot here. Audit runners call this in a `finally`. */
export function clearExplorationDiagnostics(): void {
  funnelRows = undefined;
  journeyRows = undefined;
  recordRows = undefined;
  readerRows = undefined;
  scenarioLabel = undefined;
  offerState = undefined;
  candidateSnapshot = undefined;
  stepsByExpedition.clear();
  arm = "O0";
  suppressedReader = undefined;
  pairing.written = 0;
  pairing.consumed = 0;
  pairing.keyMismatch = 0;
  pairing.overwritten = 0;
}

/** True when any slot is registered — asserted zero by the diagnostics-off parity audit. */
export function hasExplorationDiagnostics(): boolean {
  return (
    funnelRows !== undefined ||
    journeyRows !== undefined ||
    recordRows !== undefined ||
    readerRows !== undefined ||
    arm !== "O0"
  );
}
