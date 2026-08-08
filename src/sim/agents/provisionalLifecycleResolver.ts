/**
 * ROADMAP ITEM 4 — THE PROVISIONAL LIFECYCLE RESOLVER.
 *
 * The authority that keeps a provisional successor from becoming immortal.
 *
 * WHY THIS EXISTS, AND WHY A FILTER ON `viability.ts` WOULD HAVE BEEN A DEFECT.
 *
 * `updateBandViabilityStates` does five separable things, and only the first three belong to
 * established bands:
 *
 *   1. derive `Band.viability` for every band;
 *   2. absorb a nonviable band into a neighbour;
 *   3. collapse a nonviable band on low population or thin labour;
 *   4. **terminalize a band whose derived viability reads `extinct`** — the zero-body detector;
 *   5. publish the established-band fate.
 *
 * Excluding provisional successors from all five — the obvious `.filter(isEstablishedBand)` — would
 * stop Item 6 killing a newborn group, which is correct, **and would simultaneously remove the only
 * thing in production that notices a group has reached zero people.** A provisional successor whose
 * last member died would sit in `world.bands` forever: living by the predicate, resolved by nobody,
 * unreachable by cleanup. That is trading "Item 6 kills the daughter too early" for "nothing can ever
 * kill or resolve the daughter", which is the worse of the two.
 *
 * So responsibilities 1-3 and 5 become established-only, and responsibility 4 — the physical fact
 * that nobody is left — is re-homed HERE, where it resolves through the fission lifecycle instead of
 * through ordinary extinction.
 *
 * WHAT THIS IS NOT.
 *
 * It is not Item 6. It does not dissolve, absorb or archive established bands, it has no long-term
 * collapse rule, and it applies to exactly one situation: a group that departed and reached zero
 * people before it resolved. `RESEARCH_CONSTRAINTS.md` §5 records that a failed departure normally
 * ends in REINTEGRATION rather than death — this is the case where there is nobody left to reintegrate,
 * which is why it is a distinct terminal and not a variety of early failure.
 */

import { isProvisionalSuccessor } from "./bandLifecycle";
import { getPhaseContract, MAX_RETURN_ESTABLISH_CYCLES, requestTransition } from "./fissionLifecycleKernel";
import type { DailyAction } from "./dailyActions";
import type { Band, FissionLifecycleRecord } from "./types";
import type { BandId } from "../core/types";
import type { WorldState } from "../world/types";

export interface ProvisionalResolution {
  readonly bandId: string;
  readonly lineageId: string;
  readonly fromPhase: string;
  readonly toPhase: string;
  readonly populationAtResolution: number;
  readonly reason: "zero_physical_population" | "phase_bound_expired" | "cycle_bound_reached_every_remaining_exit_is_physical";
  /** How many return/establish cycles this lineage had completed at the moment of the resolution. */
  readonly resolutionCycles: number;
}

export interface ProvisionalResolverResult {
  readonly world: WorldState;
  readonly resolutions: readonly ProvisionalResolution[];
}

/**
 * Resolve every provisional successor that can no longer continue.
 *
 * Two causes, both physical rather than editorial:
 *
 *   - **zero bodies** — everybody died; the lifecycle ends at `provisional_extinguished`;
 *   - **an expired phase bound** — the kernel's own timeout, which never produces a success.
 *
 * Deterministic: bands are processed in a canonical id sort, and every transition goes through the
 * kernel rather than being written here. A band already in a terminal phase is skipped, so the
 * resolution happens exactly once.
 */
export function resolveProvisionalLifecycles(world: WorldState, today: number): ProvisionalResolverResult {
  const resolutions: ProvisionalResolution[] = [];
  let changed = false;
  const bands: Record<string, Band> = { ...world.bands };

  for (const band of Object.values(world.bands).sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
    if (!isProvisionalSuccessor(band)) {
      continue;
    }
    const record = band.provisionalSuccessor as FissionLifecycleRecord;
    const population = Math.round(band.demography.population);

    // ── zero bodies ──
    //
    // Checked BEFORE the timeout, because a group with nobody left must not be sent home to walk a
    // route: `returning` would hand the parent bodies that do not exist, which is the conservation
    // defect this whole checkpoint exists to close.
    if (population <= 0) {
      const transition = requestTransition({
        current: { phase: record.phase, phaseEnteredDay: record.phaseEnteredDay, history: record.history },
        to: "provisional_extinguished",
        today,
        // A PHYSICAL OBSERVATION, not a clock: this resolver has just read that nobody is left. It is
        // not waiting for a bound to expire, so it is entitled to claim the event.
        cause: "physical_event",
      });
      if (transition.ok === true) {
        changed = true;
        resolutions.push({
          bandId: String(band.id),
          lineageId: record.lineageId,
          fromPhase: record.phase,
          toPhase: "provisional_extinguished",
          populationAtResolution: population,
          reason: "zero_physical_population",
          resolutionCycles: record.resolutionCycles ?? 0,
        });
        bands[String(band.id)] = {
          ...band,
          // The entity stops being a living band exactly once. `dispersed` is the existing terminal
          // marker every reader already understands; the lifecycle record is what says WHY, and it is
          // retained so the attempt, lineage and route provenance survive the death.
          status: "dispersed",
          size: 0,
          provisionalSuccessor: {
            ...record,
            phase: transition.state.phase,
            phaseEnteredDay: transition.state.phaseEnteredDay,
            history: transition.state.history,
          },
        };
        continue;
      }
    }

    // ── an expired bound ──
    const contract = getPhaseContract(record.phase);
    const expired =
      contract.maxDays !== undefined &&
      today - record.phaseEnteredDay >= contract.maxDays &&
      contract.onTimeout !== undefined;
    if (!expired) {
      continue;
    }
    const cycles = record.resolutionCycles ?? 0;

    // ── §4 — THE BOUND IS ON THE CHURN, NOT ON THE GROUP. ──────────────────────────────────────
    //
    // Removing timer-only reintegration leaves a real question: what happens to living people who
    // tried to walk home and could not? They may not be killed by a timer, declared home, declared
    // established, or left cycling forever. So the cycling is what is bounded.
    //
    // Once the bound is reached this resolver STOPS ADVANCING THE PHASE and says so. The group is
    // still alive, still physically somewhere, and still has three exits — **reaching its parent,
    // demonstrating establishment, or dying** — every one of which is a physical event witnessed by a
    // real writer. What it no longer has is a clock shuffling it between phases on no new evidence.
    //
    // It is reported rather than silent: `hasUnresolvedProvisionalGroup` counts it, so an immortal
    // provisional group is a VISIBLE finding instead of an invisible one.
    // ── ROADMAP ITEM 4 §18 — WHAT ACTUALLY HAPPENS AT THE BOUND. ────────────────────────────────
    //
    // The bound used to freeze the group wherever it stood, and a smoke run showed what that means in
    // practice: a group that had spent its attempts sat in `returning` for nineteen hundred days,
    // walking nowhere, unable to stabilize because `stabilized` is only reachable from `establishing`,
    // and resolving only by starving at the decline cap. "Every remaining exit is physical" was true
    // and one of the exits was unreachable.
    //
    // So the bound now permits EXACTLY ONE more transition, and only one that lands the group in
    // `establishing` — the bounded establishment reassessment §18 requires. It is not a reprieve and it
    // is not a success: `establishing` is a trial, `stabilized` still demands lived evidence, and after
    // this the resolver advances nothing at all. The group's exits are then real and all reachable:
    // demonstrate it can live here, be found by its parent, or die.
    const atBound = cycles >= MAX_RETURN_ESTABLISH_CYCLES;
    const settleHere = atBound && record.phase !== "establishing" && contract.onTimeout === "establishing";
    if (atBound) {
      if (!settleHere) {
        resolutions.push({
          bandId: String(band.id),
          lineageId: record.lineageId,
          fromPhase: record.phase,
          toPhase: record.phase,
          populationAtResolution: population,
          reason: "cycle_bound_reached_every_remaining_exit_is_physical",
          resolutionCycles: cycles,
        });
        continue;
      }
    }

    const transition = requestTransition({
      current: { phase: record.phase, phaseEnteredDay: record.phaseEnteredDay, history: record.history },
      to: contract.onTimeout as NonNullable<typeof contract.onTimeout>,
      today,
      // A bound expired. That is elapsed time and nothing else, and the kernel refuses any target
      // phase that asserts something happened in the world.
      cause: "elapsed_time",
    });
    if (transition.ok === true) {
      changed = true;
      // One completed cycle is a return attempt that ended without reaching anybody. Counted at that
      // exact edge so an ordinary arrival, failure or death does not consume the budget — and NOT on
      // the settle-here transition, which is the END of the attempts rather than another one. Counting
      // it there pushed the ledger to four against a bound of three, which E6 caught.
      const completedCycle = !settleHere && record.phase === "returning" && transition.state.phase === "establishing";
      resolutions.push({
        bandId: String(band.id),
        lineageId: record.lineageId,
        fromPhase: record.phase,
        toPhase: transition.state.phase,
        populationAtResolution: population,
        reason: "phase_bound_expired",
        resolutionCycles: completedCycle ? cycles + 1 : cycles,
      });
      bands[String(band.id)] = {
        ...band,
        provisionalSuccessor: {
          ...record,
          phase: transition.state.phase,
          phaseEnteredDay: transition.state.phaseEnteredDay,
          history: transition.state.history,
          resolutionCycles: completedCycle ? cycles + 1 : cycles,
        },
      };
    }
  }

  return {
    world: changed ? { ...world, bands: bands as Readonly<Record<BandId, Band>> } : world,
    resolutions,
  };
}

/**
 * ROADMAP ITEM 4 — THE DEADLINE CADENCE, AND WHY A DAY-BOUND MUST BE RESOLVED DAILY.
 *
 * ── THE DEFECT THIS CLOSES ──────────────────────────────────────────────────────────────────────
 *
 * Every bound in `PHASE_CONTRACTS` is declared in DAYS — `TRAVEL_MAX_DAYS = 180`,
 * `ESTABLISHMENT_MAX_DAYS = 360`, `RETURN_MAX_DAYS = 180`, `FAILED_EARLY_MAX_DAYS = 30`. This resolver
 * was called from exactly one place, `runSeasonalCompatibilityTick`, which runs at SEASON BOUNDARIES,
 * 90 days apart. So `today - phaseEnteredDay >= contract.maxDays` was only ever EVALUATED on one day in
 * ninety, and a bound expiring on day 2,299 was not noticed until day 2,340.
 *
 * Measured on a real lifecycle, twice in one run: a 180-day return bound resolved **41 days late**
 * (entered day+19, due day+199, fired day+240) and again **76 days late** (entered day+254, due
 * day+434, fired day+510). The declared maximum lateness of the old cadence is 89 days — a bound
 * labelled 180 days could bind at 269, which is not the same contract wearing a rounding error.
 *
 * ── WHY THE FULL RESOLVER, AND WHY THE SEASONAL CALL STAYS ──────────────────────────────────────
 *
 * Three architectures were compared.
 *
 *   A — move the whole resolver to the daily tick and delete the seasonal call. REJECTED: the
 *       zero-population branch exists precisely because provisional successors are excluded from
 *       `updateBandViabilityStates`, and the seasonal call sits immediately AFTER that pass so a group
 *       emptied by the annual demographic step is resolved in the same tick. Daily actions run BEFORE
 *       `runSeasonalCompatibilityTick` on a boundary day, so deleting the seasonal call would push that
 *       detection a full day past the step that caused it, for no gain.
 *   B — SELECTED. Register the SAME authority as an additional daily action and keep the seasonal
 *       call. Deadlines then resolve within one daily tick of their declared day, the post-demography
 *       zero-population detection keeps its exact existing position, and there is one implementation.
 *   C — a separate day-scale deadline-only resolver. REJECTED as a second authority for a question
 *       this module already owns: two functions deciding when a phase expires is the split authority
 *       CORRECTION-34B removed elsewhere, and the duplicate would be free to drift.
 *
 * Running twice on a boundary day is safe by construction rather than by luck: every transition writes
 * a fresh `phaseEnteredDay`, so the second evaluation measures zero elapsed days against the new
 * contract and cannot advance a second phase; and a terminal phase declares `permittedNext: []`, so a
 * re-entered zero-population branch is refused by the kernel and falls through unchanged.
 *
 * ── WHAT THIS DOES NOT TOUCH ────────────────────────────────────────────────────────────────────
 *
 * This resolver never writes `stabilized`. Establishment is evaluated by
 * `provisionalEstablishmentDailyAction`, which ALREADY ran daily before this change and is not
 * reordered by it, so no stabilization predicate runs more often than it did. The one real consequence
 * is stated rather than buried: a truthful `returning` bound puts a group into `establishing` EARLIER,
 * so a group that was going to stabilize does so earlier by the lateness that has been removed. That
 * moves an existing outcome to its correct day; it does not create one.
 */
export const provisionalLifecycleDeadlineDailyAction: DailyAction = {
  id: "provisional_lifecycle_deadline",
  firesOnDayOfSeason: () => true,
  // LAST in the provisional block: a bound is checked against a day that has physically happened, so a
  // group that gives up today still walked, ate and read its ground today. The remaining lag is at most
  // one daily tick, against the 89 days the seasonal-only cadence permitted.
  apply: (world, day) => resolveProvisionalLifecycles(world, day).world,
};

/**
 * Exported so audits assert the PRODUCTION predicate rather than re-implementing it.
 *
 * True when no provisional successor anywhere is stuck: none holds bodies it cannot account for, and
 * none sits at zero population while still reading as a living provisional group.
 */
export function hasUnresolvedProvisionalGroup(world: WorldState): boolean {
  return Object.values(world.bands).some(
    (band) =>
      isProvisionalSuccessor(band) &&
      (Math.round(band.demography.population) <= 0 ||
        // §4 — a group that has exhausted its return/establish budget. It is not stuck by accident:
        // it is alive somewhere with only physical exits left, and saying so out loud is the point.
        (band.provisionalSuccessor?.resolutionCycles ?? 0) >= MAX_RETURN_ESTABLISH_CYCLES),
  );
}
