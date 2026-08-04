/**
 * THE CANONICAL BAND-LIFECYCLE BOUNDARY.
 *
 * Every question of the form "what kind of band is this, for my purposes?" is answered here and
 * nowhere else. Before Roadmap Item 4 this module held only terminality, was imported by three
 * modules, and everyone else inlined `band.status === "dispersed" || band.viability?.status === ...`
 * by hand — with a fourth private spelling, `isActiveBand`, living inside `contextCache.ts` as a
 * literal alias of `isLivingBand`.
 *
 * That was survivable while there was ONE distinction to make. Item 4 introduces a band that is
 * physically real but not yet an ordinary daughter, and at that point an inlined test stops being a
 * duplicate and becomes a reader silently answering the wrong question. So the module becomes the
 * boundary, in the same sense and enforced by the same mechanism as `adaptationBoundary.ts`:
 * `scripts/bandLifecycleBoundaryAudit.mjs` fails the run when a migrated module re-inlines one.
 *
 * WHY THERE ARE SEVERAL PREDICATES AND NOT ONE.
 *
 * `PROVISIONAL_READER_MATRIX.md` classifies the 41 true enumerations of the band set, and they do
 * not all ask the same thing. A depletion reader wants every group with bodies on a tile; a fission
 * gate wants a settled band that has proved it can function; the extinction pass wants neither.
 * Collapsing them into one `isActiveBand` is exactly how a provisional successor ends up quietly
 * treated as an ordinary daughter — the decorative-state failure `CLAUDE.md` §18 forbids. **The
 * predicate names below ARE the reader's intent, and that is their whole point.**
 */
import { isTerminalPhase } from "./fissionLifecycleKernel";
import type { Band } from "./types";
import type { BandId } from "../core/types";
import type { WorldState } from "../world/types";

/**
 * Archival. The band's story is over: dispersed, absorbed, or extinct.
 *
 * Unchanged from before Item 4, deliberately. A provisional successor is NOT terminal.
 */
export function isBandTerminal(band: Band): boolean {
  return band.status === "dispersed" ||
    band.viability?.status === "absorbed" ||
    band.viability?.status === "extinct";
}

/**
 * There are people here, and they are not archived.
 *
 * **A provisional successor IS a living band, and this predicate must keep saying so.** It holds
 * bodies at a tile; it eats, crowds, depletes, falls ill and dies. Redefining `isLivingBand` to mean
 * "established" would hide those bodies from the physical layer and recreate the ghosts
 * CORRECTION-34 removed — which is why "established" is a separate question below rather than a
 * tightening of this one.
 */
export function isLivingBand(band: Band): boolean {
  return band.demography.population > 0 && !isBandTerminal(band);
}

/**
 * This band is currently a provisional successor: it has physically departed and has not yet either
 * stabilized or rejoined its parent.
 *
 * The record is cleared exactly once, at `stabilized` or `reintegrated`, so a terminal phase never
 * leaves a band looking provisional. The `isTerminalPhase` guard covers a record observed
 * mid-transition.
 */
export function isProvisionalSuccessor(band: Band): boolean {
  const record = band.provisionalSuccessor;
  return record !== undefined && !isTerminalPhase(record.phase);
}

/**
 * This band is currently trying to split, before anyone has left.
 *
 * The attempt owns no bodies at any phase, so this says nothing about the band physically. It is the
 * question "is a separation already under way here?".
 */
export function hasCurrentFissionAttempt(band: Band): boolean {
  const record = band.fissionAttempt;
  return record !== undefined && !isTerminalPhase(record.phase);
}

/**
 * An ordinary, established residential band.
 *
 * Living, not archived, and **not currently a provisional successor**. This is the predicate for
 * every reader that assumes a settled band with a camp, a history and a demonstrated ability to
 * function: ordinary daughter events, stable-residence systems, Item 6 cleanup, long-term
 * commitments.
 *
 * It is deliberately NOT the predicate for the physical layer. Presence, depletion, consumption,
 * health and demography all want `isLivingBand`.
 */
export function isEstablishedBand(band: Band): boolean {
  return isLivingBand(band) && !isProvisionalSuccessor(band);
}

/**
 * May this band begin a fission?
 *
 * Established, and not already attempting one. **A provisional successor may not propose a split of
 * its own** — it has not demonstrated that it can function, so a split of a split would be a claim
 * about a group whose own viability is the open question.
 */
export function isFissionEligibleParent(band: Band): boolean {
  return isEstablishedBand(band) && !hasCurrentFissionAttempt(band);
}

/**
 * Is this band on a journey it cannot interrupt — walking out, or walking home?
 *
 * For readers that assume a band is at a camp it can work from: same-day trips, expeditions and
 * proto-camp formation. A group days from anywhere cannot also run residential day-trips from a camp
 * it does not have, and letting it would put the same bodies in two places.
 */
export function isProvisionalGroupInTransit(band: Band): boolean {
  const record = band.provisionalSuccessor;
  return record !== undefined && (record.phase === "travelling" || record.phase === "returning");
}

/** Every lineage id a band carries, whether as provenance or as a current provisional record. */
function lineageIdsOn(band: Band): readonly string[] {
  return [band.fissionAttempt?.lineageId, band.provisionalSuccessor?.lineageId].filter(
    (id): id is string => id !== undefined,
  );
}

/**
 * Are these two bands the two halves of one split that is STILL UNDER WAY?
 *
 * **Direct lifecycle provenance, not kinship.** At departure the pair stands on the same tile, and
 * CORRECTION-29 gates encounters on proximity — so without this the split would immediately
 * manufacture stranger friction between a band and the group that just walked out of it, and
 * CORRECTION-30's access expectation would carry that fiction forward. The relation is read off the
 * `lineageId` both records already carry; no kin model is consulted and none is invented.
 *
 * **THE DURATION IS THE HARD PART, AND ITS FIRST FORM WAS WRONG.** That form asked only whether the
 * two bands shared a lineage id anywhere. But §3 requires the parent to RETAIN its attempt record as
 * bounded provenance after departure, and the `departed` phase is terminal — so a retained record
 * would have matched forever and granted the pair **permanent immunity from ordinary inter-band
 * rules**, which is exactly what §5 forbids. A stabilized daughter would never have become a
 * stranger to its parent, at any distance, for the rest of the run.
 *
 * **The bounded end condition, chosen over the alternatives:** protection holds only while a
 * **CURRENT provisional successor record** exists on one side and its lineage matches the other.
 * That gives precisely the four cases §5 requires it to cover — immediate co-residence, travel,
 * return and reintegration — and ends it at both exits, because the kernel clears the provisional
 * record at `stabilized` and the entity is removed at `reintegrated`. The parent keeps its
 * provenance, and provenance alone confers nothing.
 *
 * A short post-stabilization familiarity window was considered and REJECTED for Item 4: the
 * repository already has a lived channel for exactly that — direct contact memory, earned through
 * CORRECTION-29's proximity gate — and inventing a second, lineage-derived one would be a social
 * fact nobody observed. After stabilization the pair meets on ordinary terms and builds ordinary
 * contact memory, which is the truthful outcome.
 */
export function shareCurrentFissionLineage(left: Band, right: Band): boolean {
  const leftCurrent = isProvisionalSuccessor(left) ? left.provisionalSuccessor?.lineageId : undefined;
  const rightCurrent = isProvisionalSuccessor(right) ? right.provisionalSuccessor?.lineageId : undefined;
  if (leftCurrent === undefined && rightCurrent === undefined) {
    return false;
  }
  if (leftCurrent !== undefined && lineageIdsOn(right).includes(leftCurrent)) {
    return true;
  }
  return rightCurrent !== undefined && lineageIdsOn(left).includes(rightCurrent);
}

/** One thing that is structurally wrong about how a split's two sides reference each other. */
export type FissionOwnershipDefect =
  /** Two bands hold a current provisional record for the same lineage. */
  | "two_current_successors_for_one_lineage"
  /** One band holds two current lifecycle records that both claim to own its bodies. */
  | "duplicate_current_ownership_on_one_band"
  /** A band is a provisional successor and no band anywhere carries the matching provenance. */
  | "successor_without_parent_provenance"
  /** A parent's attempt reached `departed` and no current successor exists for that lineage. */
  | "departed_attempt_without_a_successor"
  /** A parent holds more than one current attempt. */
  | "two_current_attempts_for_one_parent";

export interface FissionOwnershipFinding {
  readonly defect: FissionOwnershipDefect;
  readonly lineageId: string;
  readonly bandIds: readonly string[];
}

/**
 * Audit how a whole band set references its in-flight splits.
 *
 * Exported so audits assert the PRODUCTION invariant rather than re-implementing it, and so the
 * departure seam can call it on the state it just wrote instead of trusting itself. The §3
 * requirement that "no body belongs to both records" and "no current lifecycle transition is
 * independently writable by both" is expressed here, over real state, rather than left as prose.
 *
 * It is a pure function of the bands it is handed. It reads no world truth.
 */
export function auditFissionLineageOwnership(bands: readonly Band[]): readonly FissionOwnershipFinding[] {
  const findings: FissionOwnershipFinding[] = [];
  const currentSuccessorsByLineage = new Map<string, string[]>();
  const provenanceByLineage = new Map<string, string[]>();
  const departedAttemptsByLineage = new Map<string, string[]>();

  for (const band of bands) {
    const id = String(band.id);
    const attempt = band.fissionAttempt;
    const successor = band.provisionalSuccessor;

    // A band that is both mid-attempt and mid-provisional would have two records each claiming to
    // own its bodies. The kernel's contract table forbids it; this catches it in state.
    if (attempt !== undefined && successor !== undefined && !isTerminalPhase(attempt.phase) && !isTerminalPhase(successor.phase)) {
      findings.push({
        defect: "duplicate_current_ownership_on_one_band",
        lineageId: successor.lineageId,
        bandIds: [id],
      });
    }

    if (attempt !== undefined) {
      const list = provenanceByLineage.get(attempt.lineageId) ?? [];
      list.push(id);
      provenanceByLineage.set(attempt.lineageId, list);
      if (attempt.phase === "departed") {
        const departed = departedAttemptsByLineage.get(attempt.lineageId) ?? [];
        departed.push(id);
        departedAttemptsByLineage.set(attempt.lineageId, departed);
      }
    }
    if (successor !== undefined && !isTerminalPhase(successor.phase)) {
      const list = currentSuccessorsByLineage.get(successor.lineageId) ?? [];
      list.push(id);
      currentSuccessorsByLineage.set(successor.lineageId, list);
    }
  }

  for (const [lineageId, ids] of currentSuccessorsByLineage) {
    if (ids.length > 1) {
      findings.push({ defect: "two_current_successors_for_one_lineage", lineageId, bandIds: ids });
    }
    if (!provenanceByLineage.has(lineageId)) {
      findings.push({ defect: "successor_without_parent_provenance", lineageId, bandIds: ids });
    }
  }
  for (const [lineageId, ids] of departedAttemptsByLineage) {
    if (!currentSuccessorsByLineage.has(lineageId)) {
      findings.push({ defect: "departed_attempt_without_a_successor", lineageId, bandIds: ids });
    }
  }
  for (const [lineageId, ids] of provenanceByLineage) {
    if (ids.length > 1) {
      findings.push({ defect: "two_current_attempts_for_one_parent", lineageId, bandIds: ids });
    }
  }

  return findings;
}

// Behavioral context reducers are intentionally broad compositions. This final
// boundary makes terminality structural: archival bands keep their exact frozen
// behavioral snapshot while ecology/history outside the band may continue.
export function preserveTerminalBandSnapshots(
  before: WorldState,
  after: WorldState,
): WorldState {
  const terminal = Object.values(before.bands).filter(isBandTerminal);
  if (terminal.length === 0) {
    return after;
  }
  const bands = { ...after.bands } as Record<BandId, Band>;
  for (const band of terminal) {
    bands[band.id] = band;
  }
  return { ...after, bands };
}
