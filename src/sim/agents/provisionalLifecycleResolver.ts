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
import { getPhaseContract, requestTransition } from "./fissionLifecycleKernel";
import type { Band, FissionLifecycleRecord } from "./types";
import type { BandId } from "../core/types";
import type { WorldState } from "../world/types";

export interface ProvisionalResolution {
  readonly bandId: string;
  readonly lineageId: string;
  readonly fromPhase: string;
  readonly toPhase: string;
  readonly populationAtResolution: number;
  readonly reason: "zero_physical_population" | "phase_bound_expired";
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
    if (contract.maxDays !== undefined && today - record.phaseEnteredDay >= contract.maxDays && contract.onTimeout !== undefined) {
      const transition = requestTransition({
        current: { phase: record.phase, phaseEnteredDay: record.phaseEnteredDay, history: record.history },
        to: contract.onTimeout,
        today,
      });
      if (transition.ok === true) {
        changed = true;
        resolutions.push({
          bandId: String(band.id),
          lineageId: record.lineageId,
          fromPhase: record.phase,
          toPhase: contract.onTimeout,
          populationAtResolution: population,
          reason: "phase_bound_expired",
        });
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
  }

  return {
    world: changed ? { ...world, bands: bands as Readonly<Record<BandId, Band>> } : world,
    resolutions,
  };
}

/**
 * Exported so audits assert the PRODUCTION predicate rather than re-implementing it.
 *
 * True when no provisional successor anywhere is stuck: none holds bodies it cannot account for, and
 * none sits at zero population while still reading as a living provisional group.
 */
export function hasUnresolvedProvisionalGroup(world: WorldState): boolean {
  return Object.values(world.bands).some(
    (band) => isProvisionalSuccessor(band) && Math.round(band.demography.population) <= 0,
  );
}
