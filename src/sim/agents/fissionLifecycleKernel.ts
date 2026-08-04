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
 * contribution is that **no phase can be reached except through a permitted transition, and no
 * non-terminal phase can persist past its bound.**
 */

// ── phases ──────────────────────────────────────────────────────────────────────────────────────

/** The parent-side attempt. Reversible until it is not; holds no bodies at any phase. */
export type FissionAttemptPhase =
  /** Separation is being considered, and why. Freely abandonable. */
  | "proposed"
  /** Specific aggregate founders and a specific band-known destination are named. */
  | "committed"
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
   * How many days this phase may remain current before it MUST resolve. `undefined` only for
   * terminal phases. No non-terminal phase may be unbounded — that is the "no proposal may remain
   * unresolved indefinitely" requirement, made structural.
   */
  readonly maxDays?: number;
  /** Where the phase resolves if its bound expires. Terminal phases have none. */
  readonly onTimeout?: FissionLifecyclePhase;
  /** What must be cleared from current state when the phase is left. */
  readonly clearsOnExit: readonly string[];
}

/**
 * Bounds, stated as AUTHORITY BOUNDARIES rather than calibrated magnitudes — the CORRECTION-32 /
 * -34E distinction. They exist so that no state can persist indefinitely; none is offered as a
 * measured duration of anything, and no natural run was used to fit them.
 */
export const PROPOSAL_MAX_DAYS = 90;
export const COMMITMENT_MAX_DAYS = 90;
export const DEPARTURE_READY_MAX_DAYS = 30;
export const TRAVEL_MAX_DAYS = 180;
export const ESTABLISHMENT_MAX_DAYS = 360;
export const FAILED_EARLY_MAX_DAYS = 30;
export const RETURN_MAX_DAYS = 180;

const CONTRACTS: readonly PhaseContract[] = [
  {
    phase: "proposed",
    side: "attempt",
    bodiesHaveMoved: false,
    bodyOwner: "parent",
    productiveLabourOwner: "parent",
    physicalLocationOwner: "parent",
    transitionWriter: "fissionProposal (world adapter)",
    permittedNext: ["committed", "abandoned"],
    terminal: false,
    maxDays: PROPOSAL_MAX_DAYS,
    onTimeout: "abandoned",
    clearsOnExit: [],
  },
  {
    phase: "committed",
    side: "attempt",
    bodiesHaveMoved: false,
    bodyOwner: "parent",
    productiveLabourOwner: "parent",
    physicalLocationOwner: "parent",
    transitionWriter: "fissionProposal (world adapter)",
    // A commitment may still be abandoned. `RESEARCH_CONSTRAINTS.md` §5 records that attempted moves
    // are abandoned and groups turn back; making commitment irreversible would encode the opposite.
    permittedNext: ["departure_ready", "abandoned"],
    terminal: false,
    maxDays: COMMITMENT_MAX_DAYS,
    onTimeout: "abandoned",
    clearsOnExit: [],
  },
  {
    phase: "departure_ready",
    side: "attempt",
    bodiesHaveMoved: false,
    bodyOwner: "parent",
    productiveLabourOwner: "parent",
    physicalLocationOwner: "parent",
    transitionWriter: "fissionDeparture (world adapter)",
    permittedNext: ["departed", "abandoned"],
    terminal: false,
    maxDays: DEPARTURE_READY_MAX_DAYS,
    onTimeout: "abandoned",
    clearsOnExit: [],
  },
  {
    phase: "abandoned",
    side: "attempt",
    bodiesHaveMoved: false,
    bodyOwner: "parent",
    productiveLabourOwner: "parent",
    physicalLocationOwner: "parent",
    transitionWriter: "fissionProposal (world adapter)",
    permittedNext: [],
    terminal: true,
    clearsOnExit: ["currentAttempt"],
  },
  {
    phase: "departed",
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
    clearsOnExit: ["currentAttempt"],
  },
  {
    phase: "travelling",
    side: "successor",
    bodiesHaveMoved: true,
    bodyOwner: "successor",
    productiveLabourOwner: "successor",
    physicalLocationOwner: "successor",
    transitionWriter: "provisionalTravel (world adapter)",
    permittedNext: ["establishing", "returning", "provisional_extinguished"],
    terminal: false,
    maxDays: TRAVEL_MAX_DAYS,
    // A journey that has run out of time turns for home. It does not arrive by expiry, and it does
    // not vanish — `RESEARCH_CONSTRAINTS.md` §5: departures fail and end in reintegration.
    onTimeout: "returning",
    clearsOnExit: [],
  },
  {
    phase: "establishing",
    side: "successor",
    bodiesHaveMoved: true,
    bodyOwner: "successor",
    productiveLabourOwner: "successor",
    physicalLocationOwner: "successor",
    transitionWriter: "provisionalEstablishment (world adapter)",
    permittedNext: ["stabilized", "failed_early", "returning", "provisional_extinguished"],
    terminal: false,
    maxDays: ESTABLISHMENT_MAX_DAYS,
    // **A TIMER ALONE MAY NOT STABILIZE.** The window expiring without lived evidence is a failure,
    // not a success, and routing the timeout to `failed_early` is what makes that structural rather
    // than a rule someone has to remember.
    onTimeout: "failed_early",
    clearsOnExit: [],
  },
  {
    phase: "failed_early",
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
    maxDays: FAILED_EARLY_MAX_DAYS,
    onTimeout: "returning",
    clearsOnExit: [],
  },
  {
    phase: "returning",
    side: "successor",
    bodiesHaveMoved: true,
    bodyOwner: "successor",
    productiveLabourOwner: "successor",
    physicalLocationOwner: "successor",
    transitionWriter: "provisionalReturn (world adapter)",
    permittedNext: ["reintegrated", "provisional_extinguished"],
    terminal: false,
    maxDays: RETURN_MAX_DAYS,
    // A group that cannot reach its parent does not evaporate. Timing out of the return is still a
    // reintegration event for the ledger; where the bodies physically are when it happens is the
    // adapter's problem, and Item 6 owns anything worse than that.
    onTimeout: "reintegrated",
    clearsOnExit: [],
  },
  {
    phase: "reintegrated",
    side: "successor",
    bodiesHaveMoved: true,
    // The people are the parent's again. The provisional entity is removed exactly once.
    bodyOwner: "parent",
    productiveLabourOwner: "parent",
    physicalLocationOwner: "parent",
    transitionWriter: "provisionalReturn (world adapter)",
    permittedNext: [],
    terminal: true,
    clearsOnExit: ["provisionalState"],
  },
  {
    phase: "provisional_extinguished",
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
    clearsOnExit: ["provisionalState"],
  },
  {
    phase: "stabilized",
    side: "successor",
    bodiesHaveMoved: true,
    bodyOwner: "successor",
    productiveLabourOwner: "successor",
    physicalLocationOwner: "successor",
    transitionWriter: "provisionalEstablishment (world adapter)",
    permittedNext: [],
    terminal: true,
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
  | "stabilization_without_lived_evidence";

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
 * **This is what makes "no state may persist indefinitely" structural rather than aspirational.** It
 * is deterministic, it is driven by the contract table rather than by a second copy of the rules, and
 * it never invents a success: every timeout routes to abandonment, return or failure.
 */
export function resolveTimeout(current: LifecycleState, today: number): LifecycleTransitionResult {
  const contract = getPhaseContract(current.phase);
  if (contract.terminal || contract.maxDays === undefined || contract.onTimeout === undefined) {
    return { ok: false, rejection: "phase_is_terminal" };
  }
  if (today - current.phaseEnteredDay < contract.maxDays) {
    return { ok: true, state: current, timedOut: false };
  }
  return { ok: true, state: enter(current, contract.onTimeout, today), timedOut: true };
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
 * Checks that no quantity is owned by two entities at once in any phase, and that every non-terminal
 * phase has both a bound and somewhere to go when it expires. A structural check over the contract
 * table, so a future phase added without a bound fails the audit rather than shipping.
 */
export function assertSingleOwnership(): readonly string[] {
  const problems: string[] = [];
  for (const c of CONTRACTS) {
    if (!c.terminal && (c.maxDays === undefined || c.onTimeout === undefined)) {
      problems.push(`${c.phase}: non-terminal phase without a bound or a timeout destination`);
    }
    if (c.terminal && c.permittedNext.length > 0) {
      problems.push(`${c.phase}: terminal phase with permitted successors`);
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
