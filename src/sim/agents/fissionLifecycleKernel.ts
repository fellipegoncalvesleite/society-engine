/**
 * ROADMAP ITEM 4 — THE PURE DIRECTION-D LIFECYCLE KERNEL.
 *
 * The state machine only. No `Band`, no `WorldState`, no clock, no randomness — the same shape as
 * `fissionFounderAllocation.ts` and `fissionParentResidualViability.ts`, and for the same reason: a
 * leaf that takes explicit inputs cannot read hidden world truth, and every transition is separately
 * constructible in a fixture.
 *
 * WHY THE LIFECYCLE IS TWO MACHINES AND NOT ONE.
 *
 * `LIFECYCLE_SEMANTICS_DECISION.md` records the comparison. The short reason is that the parent's
 * attempt and the successor's provisional period are **different things living on different bands**:
 *
 *   - a `FissionAttempt` sits on the PARENT, is reversible, and **owns no bodies**;
 *   - a `ProvisionalSuccessor` sits on the SUCCESSOR, is physically real, and **owns its own bodies**.
 *
 * Merging them into one field would force every reader to destructure a role before it could ask its
 * question, and the question most readers actually ask — "is this band a provisional successor?" —
 * would stop being answerable by the presence of a field. Two fields make it structural.
 *
 * WHY NOT `Band.status`.
 *
 * `BandStatus` is already three kinds of thing wearing one name: residential activity (`foraging`,
 * `camped`, `moving`, `settled`, `stressed`), a transient fission marker (`splitting`, written to the
 * PARENT at `demography.ts:1160` after a fission completes), and one terminal lifecycle value
 * (`dispersed`). Adding lifecycle phases there would make one field answer a fourth question.
 * CORRECTION-35's finding was precisely that one name quietly answering two questions is a defect,
 * and this would be the same defect with more values.
 *
 * WHAT THIS KERNEL DELIBERATELY DOES NOT DO.
 *
 * It does not move bodies, allocate cohorts, decide viability, choose a destination, or know what a
 * day is. Departure is represented here only as the transition `departure_ready -> departed`, and the
 * actual transfer of population is the world adapter's job at a single seam. The kernel's whole
 * contribution is that **no phase can be reached except through a permitted transition, and every
 * action/decision phase is time-bounded.** A living condition that no clock can honestly resolve is
 * instead explicitly event-bounded.
 */

// ── phases ──────────────────────────────────────────────────────────────────────────────────────

/** The parent-side attempt. Reversible until it is not; holds no bodies at any phase. */
export type FissionAttemptPhase =
  /** Separation is being considered, and why. Freely abandonable. */
  | "proposed"
  /**
   * A founder configuration and a band-known destination have been NAMED. Planning content, not
   * consent.
   *
   * This phase was called `committed` and the name overstated it by exactly the distance this
   * checkpoint exists to close: nothing in production ever wrote it, its declared `fissionProposal`
   * adapter does not exist, `requestTransition` never inspects `history`, and the departure seam
   * asks only whether the attempt IS `departure_ready` — never whether it passed through here. A
   * phase that proves "who and where are written down" must not be named for a decision nobody made.
   *
   * The positive decision now lives in `fissionCommitment.ts` as an event with its own evidence and
   * its own binding, because a commitment has to say WHICH founders accepted WHAT, and a phase name
   * can say neither.
   */
  | "departure_planned"
  /** Everything is arranged; the next permitted step is the physical departure itself. */
  | "departure_ready"
  /** Terminal: the attempt ended without anyone leaving. */
  | "abandoned"
  /** Terminal: the attempt resolved into a provisional successor. Bodies moved exactly once. */
  | "departed";

/** The successor-side provisional period. Physically real from its first instant. */
export type ProvisionalSuccessorPhase =
  /** Walking. Contiguous physical steps from the parent's position toward the target. */
  | "travelling"
  /** Arrived or locally established; inside the bounded early-establishment window. */
  | "establishing"
  /** Establishment did not work. Must resolve to `returning` — it may not simply stop. */
  | "failed_early"
  /** Walking back, on knowledge it legitimately holds. */
  | "returning"
  /** Living and separate after the bounded return action failed; awaits a real physical/social event. */
  | "unresolved_after_failed_return"
  /** Terminal: rejoined the parent. The provisional entity is removed exactly once. */
  | "reintegrated"
  /** Terminal: bounded early functioning demonstrated. Becomes an ordinary band. */
  | "stabilized"
  /**
   * Terminal: every body in the provisional group died before it resolved.
   *
   * DISTINCT FROM `failed_early`, and the distinction is physical rather than bookkeeping. Early
   * failure means "this is not working, walk home" — it has people to walk. A group at zero
   * population has nobody to return and nothing to reintegrate, so routing it through `returning`
   * would transfer bodies that do not exist. It is also NOT ordinary extinction: Item 6 owns the
   * dissolution of established bands, and a provisional group that dies before establishing is the
   * fission lifecycle's outcome to record, not Item 6's.
   */
  | "provisional_extinguished";

export type FissionLifecyclePhase = FissionAttemptPhase | ProvisionalSuccessorPhase;

// ── who owns what, per phase ────────────────────────────────────────────────────────────────────

/**
 * Which entity is the canonical owner of a quantity while a phase is current.
 *
 * `parent` and `successor` are the two entities; `none` means the quantity does not exist yet or no
 * longer does. **This table is the anti-double-ownership device**: the §8 requirement that a
 * successor is never "counted in both parent and successor" is checked against it rather than
 * remembered, and `assertSingleOwnership` below is what an audit calls.
 */
export type LifecycleOwner = "parent" | "successor" | "none";

export interface PhaseContract {
  readonly phase: FissionLifecyclePhase;
  readonly side: "attempt" | "successor";
  /** True once the departure has happened for this lineage. */
  readonly bodiesHaveMoved: boolean;
  readonly bodyOwner: LifecycleOwner;
  readonly productiveLabourOwner: LifecycleOwner;
  readonly physicalLocationOwner: LifecycleOwner;
  /** Which module is permitted to write this transition. Recorded so authority is explicit. */
  readonly transitionWriter: string;
  readonly permittedNext: readonly FissionLifecyclePhase[];
  /** True when the phase ends the lifecycle and keeps only a bounded record. */
  readonly terminal: boolean;
  /**
   * Why this phase cannot silently persist.
   *
   * Decisions and actions are temporally bounded. A living physical condition may be event-bounded
   * when elapsed time cannot honestly manufacture commitment, stabilization, reintegration, or death.
   */
  readonly resolutionKind:
    | "temporally_bounded_action"
    | "event_bounded_living_condition"
    | "terminal";
  /**
   * How many days a temporally bounded action may remain current before it MUST resolve.
   * Undefined for event-bounded living conditions and terminal phases.
   */
  readonly maxDays?: number;
  /** Where the phase resolves if its bound expires. Terminal phases have none. */
  readonly onTimeout?: FissionLifecyclePhase;
  /** What must be cleared from current state when the phase is left. */
  readonly clearsOnExit: readonly string[];
  /**
   * ROADMAP ITEM 4 §3 — MAY ELAPSED TIME ALONE PUT THE LIFECYCLE INTO THIS PHASE?
   *
   * The measured defect this closes: `returning` timed out into `reintegrated`, whose own contract
   * says "rejoined the parent; the provisional entity is removed exactly once" — and nothing removed
   * it, because the reintegration writer does not exist. A group that had gone nowhere and come back
   * from nothing was promoted to ordinary status by a clock.
   *
   * It is the exact mirror of the property this table was already proud of: `establishing` routes its
   * timeout to `failed_early` precisely so a timer alone can never STABILIZE, and then a timer alone
   * was allowed to REINTEGRATE. Naming the requirement per phase is what makes the two symmetric.
   *
   * `physical_event` phases assert something happened in the world — bodies met, a group functioned.
   * Only an adapter that WITNESSED it may request them, and `assertSingleOwnership` additionally
   * refuses any contract whose `onTimeout` points at one, so the defect cannot be re-entered by
   * editing this table.
   */
  readonly entryRequires: "elapsed_time_permitted" | "physical_event";
}

/**
 * Temporal action bounds, stated as AUTHORITY BOUNDARIES rather than calibrated magnitudes — the
 * CORRECTION-32 / -34E distinction. None is offered as a measured duration of a human condition.
 */
export const PROPOSAL_MAX_DAYS = 90;
export const DEPARTURE_PLANNED_MAX_DAYS = 90;
export const DEPARTURE_READY_MAX_DAYS = 30;
export const TRAVEL_MAX_DAYS = 180;
export const ESTABLISHMENT_MAX_DAYS = 360;
export const FAILED_EARLY_MAX_DAYS = 30;
export const RETURN_MAX_DAYS = 180;

const CONTRACTS: readonly PhaseContract[] = [
  {
    phase: "proposed",
    // nobody has moved; a proposal may arise and lapse on its own.
    entryRequires: "elapsed_time_permitted",
    side: "attempt",
    bodiesHaveMoved: false,
    bodyOwner: "parent",
    productiveLabourOwner: "parent",
    physicalLocationOwner: "parent",
    transitionWriter: "fissionProposal (world adapter)",
    permittedNext: ["departure_planned", "abandoned"],
    terminal: false,
    resolutionKind: "temporally_bounded_action",
    maxDays: PROPOSAL_MAX_DAYS,
    onTimeout: "abandoned",
    clearsOnExit: [],
  },
  {
    phase: "departure_planned",
    // still nobody moved, and still nobody has agreed to.
    entryRequires: "elapsed_time_permitted",
    side: "attempt",
    bodiesHaveMoved: false,
    bodyOwner: "parent",
    productiveLabourOwner: "parent",
    physicalLocationOwner: "parent",
    transitionWriter: "fissionProposal (world adapter)",
    // A plan may still be abandoned. `RESEARCH_CONSTRAINTS.md` §5 records that attempted moves are
    // abandoned and groups turn back; making a named plan irreversible would encode the opposite.
    permittedNext: ["departure_ready", "abandoned"],
    terminal: false,
    resolutionKind: "temporally_bounded_action",
    maxDays: DEPARTURE_PLANNED_MAX_DAYS,
    onTimeout: "abandoned",
    clearsOnExit: [],
  },
  {
    phase: "departure_ready",
    // the people are packed and still at home.
    entryRequires: "elapsed_time_permitted",
    side: "attempt",
    bodiesHaveMoved: false,
    bodyOwner: "parent",
    productiveLabourOwner: "parent",
    physicalLocationOwner: "parent",
    transitionWriter: "fissionDeparture (world adapter)",
    permittedNext: ["departed", "abandoned"],
    terminal: false,
    resolutionKind: "temporally_bounded_action",
    maxDays: DEPARTURE_READY_MAX_DAYS,
    onTimeout: "abandoned",
    clearsOnExit: [],
  },
  {
    phase: "abandoned",
    // abandoning a plan nobody acted on is exactly what elapsed time SHOULD produce.
    entryRequires: "elapsed_time_permitted",
    side: "attempt",
    bodiesHaveMoved: false,
    bodyOwner: "parent",
    productiveLabourOwner: "parent",
    physicalLocationOwner: "parent",
    transitionWriter: "fissionProposal (world adapter)",
    permittedNext: [],
    terminal: true,
    resolutionKind: "terminal",
    clearsOnExit: ["currentAttempt"],
  },
  {
    phase: "departed",
    // bodies physically leave a camp; a clock may never move people.
    entryRequires: "physical_event",
    side: "attempt",
    bodiesHaveMoved: true,
    // The attempt is over. The bodies that left are the SUCCESSOR's from this instant, and the
    // parent owns only what remained. Nothing is owned twice, and that is the invariant the
    // departure seam proves by measurement rather than by restating a before value.
    bodyOwner: "successor",
    productiveLabourOwner: "successor",
    physicalLocationOwner: "successor",
    transitionWriter: "fissionDeparture (world adapter)",
    permittedNext: [],
    terminal: true,
    resolutionKind: "terminal",
    clearsOnExit: ["currentAttempt"],
  },
  {
    phase: "travelling",
    // entered only as the consequence of a departure that already happened.
    entryRequires: "elapsed_time_permitted",
    side: "successor",
    bodiesHaveMoved: true,
    bodyOwner: "successor",
    productiveLabourOwner: "successor",
    physicalLocationOwner: "successor",
    transitionWriter: "provisionalTravel (world adapter)",
    permittedNext: ["establishing", "returning", "provisional_extinguished"],
    terminal: false,
    resolutionKind: "temporally_bounded_action",
    maxDays: TRAVEL_MAX_DAYS,
    // A journey that has run out of time turns for home. It does not arrive by expiry, and it does
    // not vanish — `RESEARCH_CONSTRAINTS.md` §5: departures fail and end in reintegration.
    onTimeout: "returning",
    clearsOnExit: [],
  },
  {
    phase: "establishing",
    // A bounded trial entered by physical arrival at the named destination. It is not reused after a
    // failed return: that would manufacture another establishment choice from elapsed time alone.
    entryRequires: "elapsed_time_permitted",
    side: "successor",
    bodiesHaveMoved: true,
    bodyOwner: "successor",
    productiveLabourOwner: "successor",
    physicalLocationOwner: "successor",
    transitionWriter: "provisionalEstablishment (world adapter)",
    // The table retains later positive outcomes as legal lifecycle vocabulary, but this cleanup
    // supplies no production stabilization writer. Any physical reintegration must still be witnessed
    // by the dedicated adapter; no timeout may point at it.
    permittedNext: ["stabilized", "failed_early", "returning", "reintegrated", "provisional_extinguished"],
    terminal: false,
    resolutionKind: "temporally_bounded_action",
    maxDays: ESTABLISHMENT_MAX_DAYS,
    // **A TIMER ALONE MAY NOT STABILIZE.** The window expiring without lived evidence is a failure,
    // not a success, and routing the timeout to `failed_early` is what makes that structural rather
    // than a rule someone has to remember.
    onTimeout: "failed_early",
    clearsOnExit: [],
  },
  {
    phase: "failed_early",
    // a window closing without evidence IS the failure; nothing is claimed.
    entryRequires: "elapsed_time_permitted",
    side: "successor",
    bodiesHaveMoved: true,
    bodyOwner: "successor",
    productiveLabourOwner: "successor",
    physicalLocationOwner: "successor",
    transitionWriter: "provisionalEstablishment (world adapter)",
    // Only one way out. A failed successor still holds living people who are somewhere, so it must
    // walk back; it may not stabilize, and it may not stop existing here.
    permittedNext: ["returning", "provisional_extinguished"],
    terminal: false,
    resolutionKind: "temporally_bounded_action",
    maxDays: FAILED_EARLY_MAX_DAYS,
    onTimeout: "returning",
    clearsOnExit: [],
  },
  {
    phase: "returning",
    // deciding to walk home is a decision, not an arrival.
    entryRequires: "elapsed_time_permitted",
    side: "successor",
    bodiesHaveMoved: true,
    bodyOwner: "successor",
    productiveLabourOwner: "successor",
    physicalLocationOwner: "successor",
    transitionWriter: "provisionalReturn (world adapter)",
    permittedNext: ["reintegrated", "unresolved_after_failed_return", "provisional_extinguished"],
    terminal: false,
    resolutionKind: "temporally_bounded_action",
    maxDays: RETURN_MAX_DAYS,
    // ── §4 — WHAT HAPPENS WHEN LIVING PEOPLE TRY TO GO HOME AND CANNOT. ────────────────────────
    //
    // This used to read `onTimeout: "reintegrated"`, and the comment justifying it said the ledger
    // could call it a reintegration and leave "where the bodies physically are" to the adapter. There
    // was no adapter. The measured result was a group promoted to ordinary status by a clock.
    //
    // Expiry ends only the return ACTION. It enters a named living condition and manufactures no
    // establishment attempt, commitment, success, reintegration, or death.
    onTimeout: "unresolved_after_failed_return",
    clearsOnExit: [],
  },
  {
    phase: "unresolved_after_failed_return",
    // A clock may truthfully establish that the bounded return action ended without reintegration. It
    // cannot decide what these living, separate people become next.
    entryRequires: "elapsed_time_permitted",
    side: "successor",
    bodiesHaveMoved: true,
    bodyOwner: "successor",
    productiveLabourOwner: "successor",
    physicalLocationOwner: "successor",
    transitionWriter: "provisionalLifecycleResolver (world adapter)",
    // Event-bounded: physical co-location can reintegrate; zero bodies can extinguish. A future real
    // positive-commitment writer may add a social exit, but none exists in this patch.
    permittedNext: ["reintegrated", "provisional_extinguished"],
    terminal: false,
    resolutionKind: "event_bounded_living_condition",
    clearsOnExit: [],
  },
  {
    phase: "reintegrated",
    // THE DEFECT THIS CLOSES — it asserts the people physically reached their parent and were handed back; a timer asserting it produced a group that had gone nowhere and come back from nothing.
    entryRequires: "physical_event",
    side: "successor",
    bodiesHaveMoved: true,
    // The people are the parent's again. The provisional entity is removed exactly once.
    bodyOwner: "parent",
    productiveLabourOwner: "parent",
    physicalLocationOwner: "parent",
    transitionWriter: "provisionalReturn (world adapter)",
    permittedNext: [],
    terminal: true,
    resolutionKind: "terminal",
    clearsOnExit: ["provisionalState"],
  },
  {
    phase: "provisional_extinguished",
    // zero bodies is itself the physical observation; the resolver WITNESSES it rather than waiting for it.
    entryRequires: "physical_event",
    side: "successor",
    bodiesHaveMoved: true,
    // Nobody is left to own anything. `none` is the honest owner, and it is what stops a resolver
    // trying to hand bodies back to the parent.
    bodyOwner: "none",
    productiveLabourOwner: "none",
    physicalLocationOwner: "none",
    transitionWriter: "provisionalZeroPopulation (world adapter)",
    permittedNext: [],
    terminal: true,
    resolutionKind: "terminal",
    clearsOnExit: ["provisionalState"],
  },
  {
    phase: "stabilized",
    // Reserved for a later positive-commitment plus physical-operation authority. No current
    // production adapter requests this transition.
    entryRequires: "physical_event",
    side: "successor",
    bodiesHaveMoved: true,
    bodyOwner: "successor",
    productiveLabourOwner: "successor",
    physicalLocationOwner: "successor",
    transitionWriter: "future positive-commitment authority (not implemented)",
    permittedNext: [],
    terminal: true,
    resolutionKind: "terminal",
    clearsOnExit: ["provisionalState"],
  },
];

const BY_PHASE = new Map<FissionLifecyclePhase, PhaseContract>(CONTRACTS.map((c) => [c.phase, c]));

/** Exported so audits read the PRODUCTION table rather than re-declaring it. */
export const PHASE_CONTRACTS: readonly PhaseContract[] = CONTRACTS;

export function getPhaseContract(phase: FissionLifecyclePhase): PhaseContract {
  const contract = BY_PHASE.get(phase);
  if (contract === undefined) {
    throw new Error(`No lifecycle contract for phase ${String(phase)}`);
  }
  return contract;
}

// ── transitions ─────────────────────────────────────────────────────────────────────────────────

export type LifecycleRejection =
  /** The requested phase is not reachable from the current one. */
  | "transition_not_permitted"
  /** The current phase is terminal; nothing follows it. */
  | "phase_is_terminal"
  /** A provisional successor may not itself begin a fission. */
  | "provisional_successor_cannot_propose"
  /** The parent already holds a current attempt. */
  | "parent_already_has_a_current_attempt"
  /** Departure requires an endorsed founder count from the residual authority. */
  | "departure_without_endorsed_founder_count"
  /** Establishment may not conclude in stabilization without lived evidence. */
  | "stabilization_without_lived_evidence"
  /** §3 — elapsed time may not produce a phase that asserts something happened in the world. */
  | "terminal_outcome_requires_a_physical_event"
  /** Reintegration asserts the bodies physically reached the parent. Nothing else may assert it. */
  | "reintegration_without_proven_co_location"
  /**
   * `departure_ready` was requested without the adapter claiming a completed preparation.
   *
   * The phase asserts that the exact departure terms were assessed, positively accepted and given a
   * live one-use permit. The kernel holds no world and cannot check any of that, so — exactly as for
   * `reintegration_without_proven_co_location` — it checks that the caller claims to have checked,
   * and `fissionDeparturePreparation` is the only module that can honestly make the claim.
   */
  | "departure_ready_without_completed_preparation"
  /** Event-bounded living conditions have no honest timeout transition. */
  | "event_bounded_phase_has_no_timeout";

export interface LifecycleState {
  readonly phase: FissionLifecyclePhase;
  /** Day the phase became current. The kernel compares days; it does not know what a day is. */
  readonly phaseEnteredDay: number;
  /** Bounded record of phases passed through, newest last. Never unbounded. */
  readonly history: readonly FissionLifecyclePhase[];
}

/** Bounded so a long-lived lineage cannot grow an unbounded ledger. */
export const LIFECYCLE_HISTORY_CAP = 12;

export type LifecycleTransitionResult =
  | { readonly ok: true; readonly state: LifecycleState; readonly timedOut: boolean }
  | { readonly ok: false; readonly rejection: LifecycleRejection };

export interface TransitionRequest {
  readonly current: LifecycleState;
  readonly to: FissionLifecyclePhase;
  readonly today: number;
  /**
   * Required for `departure_ready -> departed`. The count the parent residual authority ENDORSED —
   * which is the revised one whenever a revision was required. Absent or non-positive is a refusal,
   * so a caller cannot depart on a request the authority did not endorse.
   */
  readonly endorsedFounderCount?: number;
  /**
   * Required for `establishing -> stabilized`. **A timer alone may not stabilize**, so the kernel
   * refuses the transition unless the adapter passes lived evidence it gathered.
   */
  readonly livedEvidenceCount?: number;
  /**
   * §3 — WHAT IS ASKING FOR THIS TRANSITION: something that happened in the world, or a clock.
   *
   * **Required, with no default.** A default would silently restore the defect for every caller that
   * forgot, which is precisely how `returning -> reintegrated` survived: it needed nothing, so it got
   * nothing, and the absence read as permission. Making it required makes the invariant structural
   * rather than a rule someone has to remember — the same reasoning CORRECTION-34E used for the
   * target-work labour count.
   */
  readonly cause: "physical_event" | "elapsed_time";
  /**
   * Required for `returning -> reintegrated`. The adapter must have PHYSICALLY OBSERVED the successor
   * and a valid receiving parent at the same place. The kernel cannot check a position — it holds no
   * world — so it checks that the caller claims to have checked, and `provisionalReturn` is the only
   * module that can honestly make the claim.
   */
  readonly physicalCoLocationProven?: boolean;
  /**
   * Required for `departure_planned -> departure_ready`. The adapter must have run the whole
   * preparation chain — final endorsed allocation, parent-separation consequence, a POSITIVE founder
   * cohort commitment on those exact terms, and a live one-use permit — and written it canonically.
   *
   * Same construction and same reason as `physicalCoLocationProven`: required, no default, because a
   * default silently restores the defect for any caller that forgets. Before this, `departure_ready`
   * was reachable by elapsed time alone, which is how a phase named for a settled plan could be
   * entered by a record that had settled nothing.
   */
  readonly preparedDepartureProven?: boolean;
}

/** How many independent lived-evidence signals stabilization requires. An authority boundary. */
export const MIN_LIVED_EVIDENCE_FOR_STABILIZATION = 3;

export function requestTransition(request: TransitionRequest): LifecycleTransitionResult {
  const contract = getPhaseContract(request.current.phase);

  if (contract.terminal) {
    return { ok: false, rejection: "phase_is_terminal" };
  }
  if (!contract.permittedNext.includes(request.to)) {
    return { ok: false, rejection: "transition_not_permitted" };
  }
  if (request.to === "departed") {
    const endorsed = request.endorsedFounderCount;
    if (endorsed === undefined || !Number.isInteger(endorsed) || endorsed <= 0) {
      return { ok: false, rejection: "departure_without_endorsed_founder_count" };
    }
  }
  if (request.to === "stabilized") {
    const evidence = request.livedEvidenceCount ?? 0;
    if (evidence < MIN_LIVED_EVIDENCE_FOR_STABILIZATION) {
      return { ok: false, rejection: "stabilization_without_lived_evidence" };
    }
  }
  // ── §3 — THE CENTRAL GUARD. ──
  //
  // Checked for EVERY target phase, not only the two that happen to be terminal today, so a future
  // phase classified `physical_event` is protected the moment it is added to the table.
  if (getPhaseContract(request.to).entryRequires === "physical_event" && request.cause !== "physical_event") {
    return { ok: false, rejection: "terminal_outcome_requires_a_physical_event" };
  }
  if (request.to === "reintegrated" && request.physicalCoLocationProven !== true) {
    return { ok: false, rejection: "reintegration_without_proven_co_location" };
  }
  if (request.to === "departure_ready" && request.preparedDepartureProven !== true) {
    return { ok: false, rejection: "departure_ready_without_completed_preparation" };
  }

  return { ok: true, state: enter(request.current, request.to, request.today), timedOut: false };
}

function enter(current: LifecycleState, to: FissionLifecyclePhase, today: number): LifecycleState {
  const history = [...current.history, current.phase];
  return {
    phase: to,
    phaseEnteredDay: today,
    history: history.length > LIFECYCLE_HISTORY_CAP ? history.slice(history.length - LIFECYCLE_HISTORY_CAP) : history,
  };
}

/**
 * Resolve a phase that has outlived its bound.
 *
 * This applies only to temporally bounded action/decision phases. Event-bounded living conditions are
 * deliberately not resolved by a clock because time alone cannot witness their honest exits.
 */
export function resolveTimeout(current: LifecycleState, today: number): LifecycleTransitionResult {
  const contract = getPhaseContract(current.phase);
  if (contract.terminal) {
    return { ok: false, rejection: "phase_is_terminal" };
  }
  if (contract.resolutionKind === "event_bounded_living_condition") {
    return { ok: false, rejection: "event_bounded_phase_has_no_timeout" };
  }
  if (contract.maxDays === undefined || contract.onTimeout === undefined) {
    return { ok: false, rejection: "phase_is_terminal" };
  }
  if (today - current.phaseEnteredDay < contract.maxDays) {
    return { ok: true, state: current, timedOut: false };
  }
  // Routed through `requestTransition` rather than calling `enter` directly. The old form bypassed
  // every guard in this module — including the lived-evidence check — so a contract pointing its
  // timeout at a success phase would have produced one silently. It cannot now: the request carries
  // `cause: "elapsed_time"`, which is exactly what the §3 guard refuses.
  const result = requestTransition({ current, to: contract.onTimeout, today, cause: "elapsed_time" });
  return result.ok === true ? { ok: true, state: result.state, timedOut: true } : result;
}

export function beginAttempt(today: number): LifecycleState {
  return { phase: "proposed", phaseEnteredDay: today, history: [] };
}

/**
 * The successor's opening state, immediately after departure.
 *
 * It starts `travelling` and never `establishing`, which is how "the successor never appears at the
 * destination" is expressed in the kernel rather than only in the adapter.
 */
export function beginProvisionalSuccessor(today: number): LifecycleState {
  return { phase: "travelling", phaseEnteredDay: today, history: [] };
}

export function isTerminalPhase(phase: FissionLifecyclePhase): boolean {
  return getPhaseContract(phase).terminal;
}

/** True while the lineage is still owed a resolution. */
export function isUnresolved(state: LifecycleState): boolean {
  return !isTerminalPhase(state.phase);
}

/**
 * Exported so audits assert the PRODUCTION predicate rather than re-implementing it.
 *
 * Checks ownership and the declared resolution kind. Temporal actions require a bound and timeout;
 * event-bounded living conditions forbid both; terminal phases permit neither.
 */
export function assertSingleOwnership(): readonly string[] {
  const problems: string[] = [];
  for (const c of CONTRACTS) {
    if (c.resolutionKind === "temporally_bounded_action" &&
      (c.terminal || c.maxDays === undefined || c.onTimeout === undefined)) {
      problems.push(`${c.phase}: temporally bounded action lacks a bound and timeout destination`);
    }
    if (c.resolutionKind === "event_bounded_living_condition" &&
      (c.terminal || c.maxDays !== undefined || c.onTimeout !== undefined)) {
      problems.push(`${c.phase}: event-bounded living condition declares terminality or a timeout`);
    }
    if (c.resolutionKind === "terminal" &&
      (!c.terminal || c.maxDays !== undefined || c.onTimeout !== undefined)) {
      problems.push(`${c.phase}: terminal resolution kind disagrees with terminal/bound fields`);
    }
    if (c.terminal !== (c.resolutionKind === "terminal")) {
      problems.push(`${c.phase}: terminal flag disagrees with resolution kind`);
    }
    if (c.terminal && c.permittedNext.length > 0) {
      problems.push(`${c.phase}: terminal phase with permitted successors`);
    }
    // §3 — THE INVARIANT THAT MAKES THE DEFECT UNRE-ENTERABLE BY EDITING THIS TABLE. A timeout is
    // elapsed time by definition, so pointing one at a phase that asserts a world event is the
    // `returning -> reintegrated` defect regardless of which phases are involved.
    if (c.onTimeout !== undefined && BY_PHASE.get(c.onTimeout)?.entryRequires === "physical_event") {
      problems.push(
        `${c.phase}: times out into ${String(c.onTimeout)}, which requires a physical event — a clock cannot witness one`,
      );
    }
    // `none` is legal only for a terminal phase in which nobody is left alive.
    if (c.bodyOwner === "none" && (!c.terminal || c.phase !== "provisional_extinguished")) {
      problems.push(`${c.phase}: claims no body owner but is not the zero-population terminal`);
    }
    if (!c.bodiesHaveMoved && c.bodyOwner !== "parent") {
      problems.push(`${c.phase}: bodies have not moved but the parent does not own them`);
    }
    for (const next of c.permittedNext) {
      if (!BY_PHASE.has(next)) {
        problems.push(`${c.phase}: permits unknown phase ${String(next)}`);
      }
    }
  }
  return problems;
}
