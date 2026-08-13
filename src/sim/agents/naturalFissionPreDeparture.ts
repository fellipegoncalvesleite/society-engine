/**
 * ROADMAP ITEM 4 — ORDINARY ECOLOGY'S TRUTHFUL PRE-DEPARTURE ADAPTER.
 *
 * `computeBandDemography` remains the one producer of natural separation pressure, crisis pressure,
 * cooldown eligibility, founder sizing and a band-known viable frontier. This module consumes that
 * evidence and owns the lifecycle writes. It deliberately advances at most ONE semantic phase for a
 * parent per simulated day:
 *
 *   annual evidence -> proposed
 *   a later day      -> departure_planned
 *   a later day      -> canonical prepareFissionDeparture -> departure_ready or a real refusal
 *
 * It never calls `performAtomicDeparture`, never moves a body, never creates a successor and never
 * writes a `BandFissionEvent`. A proposal is not a physical fission. The separate registered
 * `naturalFissionPhysicalDeparture` action is the only ordinary caller of the atomic transfer seam.
 */

import { isEstablishedBand, isFissionEligibleParent } from "./bandLifecycle";
import type { DailyAction } from "./dailyActions";
import { abandonPreparedDeparture, prepareFissionDeparture, type DeparturePreparationRefusal } from "./fissionDeparturePreparation";
import { allocateFounderCohorts } from "./fissionFounderAllocation";
import { beginAttempt, requestTransition } from "./fissionLifecycleKernel";
import {
  derivePhysicallyAwayPartyPeople,
  derivePreparedCommitmentPartyPeople,
} from "./bandMobility";
import type { Band, NaturalFissionProposalEvidence } from "./types";
import type { BandId, ReasonId, TickNumber, TileId } from "../core/types";
import type { WorldState } from "../world/types";

const MIN_KNOWN_TARGET_CONFIDENCE = 0.34;
const MAX_PROPOSAL_REASON_IDS = 8;

export interface NaturalFissionProposalInput {
  readonly cause: NaturalFissionProposalEvidence["cause"];
  readonly splitPressure: number;
  readonly ecologicalFounderRequest: number;
  readonly minimumFounderRequest: number;
  readonly targetTileId: TileId;
  readonly targetScore: number;
  readonly targetReason: NaturalFissionProposalEvidence["proposedTargetReason"];
  readonly reasonIds: readonly ReasonId[];
}

export type NaturalFissionProposalRefusal =
  | "parent_not_found"
  | "parent_not_eligible"
  | "proposal_evidence_invalid"
  | "proposal_target_not_known"
  | "founder_cohort_not_physically_available";

export type NaturalFissionProposalOutcome =
  | { readonly ok: true; readonly world: WorldState; readonly evidence: NaturalFissionProposalEvidence }
  | { readonly ok: false; readonly refusal: NaturalFissionProposalRefusal };

export interface BeginNaturalFissionProposalRequest {
  readonly world: WorldState;
  readonly parentId: BandId;
  readonly today: number;
  readonly input: NaturalFissionProposalInput;
}

const populationOf = (band: Band): number =>
  band.demography.workingAdults + band.demography.dependents + band.demography.elders;

const makeLineageId = (parentId: BandId, tick: TickNumber, targetTileId: TileId): string =>
  `fission-lineage:${String(parentId)}:${Number(tick)}:${String(targetTileId)}`;

const knownProposalTarget = (band: Band, targetTileId: TileId): boolean => {
  const record = band.knowledge.observedTiles[targetTileId];
  return record !== undefined && record.tileId !== band.position && record.confidence >= MIN_KNOWN_TARGET_CONFIDENCE;
};

/** Begin one natural attempt through the kernel's canonical beginning semantics. */
export function beginNaturalFissionProposal(
  request: BeginNaturalFissionProposalRequest,
): NaturalFissionProposalOutcome {
  const parent = request.world.bands[request.parentId];
  if (parent === undefined) return { ok: false, refusal: "parent_not_found" };
  if (!isFissionEligibleParent(parent)) return { ok: false, refusal: "parent_not_eligible" };

  const input = request.input;
  if (
    !Number.isFinite(input.splitPressure) ||
    input.splitPressure < 0 ||
    input.splitPressure > 1 ||
    !Number.isInteger(input.ecologicalFounderRequest) ||
    !Number.isInteger(input.minimumFounderRequest) ||
    input.ecologicalFounderRequest <= 0 ||
    input.minimumFounderRequest <= 0 ||
    input.minimumFounderRequest > input.ecologicalFounderRequest ||
    !Number.isFinite(input.targetScore)
  ) {
    return { ok: false, refusal: "proposal_evidence_invalid" };
  }
  if (!knownProposalTarget(parent, input.targetTileId)) {
    return { ok: false, refusal: "proposal_target_not_known" };
  }

  // The same two authorities the legacy path already reads: bodies physically elsewhere are not at
  // this camp, and bodies promised to a prepared expedition are present but not silently reusable.
  const physicallyAway = derivePhysicallyAwayPartyPeople(parent);
  const preparedCommitment = derivePreparedCommitmentPartyPeople(parent);
  const foundersAvailableAtProposal = Math.max(0, populationOf(parent) - physicallyAway - preparedCommitment);
  const proposedFounders = Math.min(input.ecologicalFounderRequest, foundersAvailableAtProposal);
  if (proposedFounders < input.minimumFounderRequest) {
    return { ok: false, refusal: "founder_cohort_not_physically_available" };
  }

  const evidence: NaturalFissionProposalEvidence = {
    authority: "annual_demography",
    cause: input.cause,
    proposedOnDay: request.today,
    evidenceTick: request.world.time.tick,
    splitPressure: input.splitPressure,
    ecologicalFounderRequest: input.ecologicalFounderRequest,
    proposedFounders,
    foundersAvailableAtProposal,
    minimumFounderRequest: input.minimumFounderRequest,
    proposedTargetTileId: input.targetTileId,
    proposedTargetScore: input.targetScore,
    proposedTargetReason: input.targetReason,
    reasonIds: input.reasonIds.map(String).slice(0, MAX_PROPOSAL_REASON_IDS),
  };
  const state = beginAttempt(request.today);
  const nextParent: Band = {
    ...parent,
    fissionAttempt: {
      ...state,
      lineageId: makeLineageId(parent.id, request.world.time.tick, input.targetTileId),
      naturalProposal: evidence,
      reasonIds: evidence.reasonIds,
    },
  };

  return {
    ok: true,
    evidence,
    world: {
      ...request.world,
      bands: { ...request.world.bands, [parent.id]: nextParent },
    },
  };
}

export type NaturalFissionAdvanceKind =
  | "proposal_became_plan"
  | "preparation_accepted"
  | "attempt_abandoned_after_incoherent_plan"
  | "attempt_abandoned_after_residual_block"
  | "attempt_abandoned_after_founder_decline"
  | "unexpected_preparation_refusal_left_for_deadline";

export interface NaturalFissionAdvanceRecord {
  readonly parentId: string;
  readonly lineageId: string;
  readonly day: number;
  readonly fromPhase: string;
  readonly toPhase: string;
  readonly kind: NaturalFissionAdvanceKind;
  readonly detail?: string;
}

export interface NaturalFissionAdvanceResult {
  readonly world: WorldState;
  readonly advances: readonly NaturalFissionAdvanceRecord[];
}

const abandon = (
  world: WorldState,
  parent: Band,
  today: number,
  kind: NaturalFissionAdvanceKind,
  detail: string,
): { readonly world: WorldState; readonly record?: NaturalFissionAdvanceRecord } => {
  const attempt = parent.fissionAttempt;
  if (attempt === undefined) return { world };
  const result = abandonPreparedDeparture(world, parent.id, today);
  if (result.ok !== true) return { world };
  return {
    world: result.world,
    record: {
      parentId: String(parent.id),
      lineageId: attempt.lineageId,
      day: today,
      fromPhase: attempt.phase,
      toPhase: "abandoned",
      kind,
      detail,
    },
  };
};

const refusalKind = (refusal: DeparturePreparationRefusal): NaturalFissionAdvanceKind | undefined => {
  if (refusal === "founder_cohort_declined") return "attempt_abandoned_after_founder_decline";
  if (refusal === "residual_authority_blocked_the_departure") return "attempt_abandoned_after_residual_block";
  if (
    refusal === "attempt_names_no_requested_founders" ||
    refusal === "attempt_names_no_target" ||
    refusal === "allocation_refused" ||
    refusal === "destination_not_known_to_the_band"
  ) {
    return "attempt_abandoned_after_incoherent_plan";
  }
  return undefined;
};

/**
 * Advance natural attempts, deterministically and by no more than one phase per parent per call.
 *
 * A real decline ends the exact named attempt: asking the same represented cohort again until it
 * says yes would manufacture acceptance. A residual block ends the plan because the canonical
 * authority already searched every permitted smaller cohort down to the natural floor. Structural
 * or unexpected adapter refusals are not re-labelled as human decisions; they remain planned until
 * the independent deadline resolver bounds them.
 */
export function advanceNaturalFissionPreDeparture(
  world: WorldState,
  today: number,
): NaturalFissionAdvanceResult {
  let current = world;
  const advances: NaturalFissionAdvanceRecord[] = [];
  const parentIds = Object.values(world.bands)
    .filter((band) => band.fissionAttempt?.naturalProposal !== undefined)
    .map((band) => band.id)
    .sort((a, b) => String(a).localeCompare(String(b)));

  for (const parentId of parentIds) {
    const parent = current.bands[parentId];
    const attempt = parent?.fissionAttempt;
    const proposal = attempt?.naturalProposal;
    if (parent === undefined || attempt === undefined || proposal === undefined) continue;

    // Phase ordering is structural. A phase written today cannot be consumed again today even if a
    // caller invokes this reducer repeatedly.
    if (today <= attempt.phaseEnteredDay) continue;

    if (attempt.phase === "proposed") {
      const stillEstablished = isEstablishedBand(parent);
      const targetStillKnown = knownProposalTarget(parent, proposal.proposedTargetTileId);
      const allocation = allocateFounderCohorts(
        {
          workingAdults: parent.demography.workingAdults,
          dependents: parent.demography.dependents,
          elders: parent.demography.elders,
        },
        proposal.proposedFounders,
      );
      if (!stillEstablished || !targetStillKnown || allocation.ok !== true) {
        const ended = abandon(
          current,
          parent,
          today,
          "attempt_abandoned_after_incoherent_plan",
          !stillEstablished
            ? "parent_no_longer_established"
            : !targetStillKnown
              ? "proposal_target_no_longer_known"
              : `allocation:${allocation.ok === true ? "accepted" : allocation.refusal}`,
        );
        current = ended.world;
        if (ended.record !== undefined) advances.push(ended.record);
        continue;
      }

      const transition = requestTransition({
        current: {
          phase: attempt.phase,
          phaseEnteredDay: attempt.phaseEnteredDay,
          history: attempt.history,
        },
        to: "departure_planned",
        today,
        cause: "elapsed_time",
      });
      if (transition.ok !== true) continue;
      current = {
        ...current,
        bands: {
          ...current.bands,
          [parent.id]: {
            ...parent,
            fissionAttempt: {
              ...attempt,
              phase: transition.state.phase,
              phaseEnteredDay: transition.state.phaseEnteredDay,
              history: transition.state.history,
              requestedFounders: proposal.proposedFounders,
              targetTileId: proposal.proposedTargetTileId,
            },
          },
        },
      };
      advances.push({
        parentId: String(parent.id),
        lineageId: attempt.lineageId,
        day: today,
        fromPhase: "proposed",
        toPhase: "departure_planned",
        kind: "proposal_became_plan",
      });
      continue;
    }

    if (attempt.phase !== "departure_planned") continue;
    const prepared = prepareFissionDeparture({
      world: current,
      parentId: parent.id,
      today,
      policy: { minimumFounderRequest: proposal.minimumFounderRequest },
    });
    if (prepared.ok === true) {
      current = prepared.world;
      advances.push({
        parentId: String(parent.id),
        lineageId: attempt.lineageId,
        day: today,
        fromPhase: "departure_planned",
        toPhase: "departure_ready",
        kind: "preparation_accepted",
      });
      continue;
    }

    const kind = refusalKind(prepared.refusal);
    if (kind === undefined) {
      advances.push({
        parentId: String(parent.id),
        lineageId: attempt.lineageId,
        day: today,
        fromPhase: "departure_planned",
        toPhase: "departure_planned",
        kind: "unexpected_preparation_refusal_left_for_deadline",
        detail: `${prepared.refusal}${prepared.detail === undefined ? "" : `:${prepared.detail}`}`,
      });
      continue;
    }
    const ended = abandon(
      current,
      parent,
      today,
      kind,
      `${prepared.refusal}${prepared.detail === undefined ? "" : `:${prepared.detail}`}`,
    );
    current = ended.world;
    if (ended.record !== undefined) advances.push(ended.record);
  }

  return { world: current, advances };
}

/** Daily production reachability up to accepted readiness; physical transfer is a separate last action. */
export const naturalFissionPreDepartureDailyAction: DailyAction = {
  id: "natural_fission_pre_departure",
  firesOnDayOfSeason: () => true,
  apply: (world, day) => advanceNaturalFissionPreDeparture(world, day).world,
};
