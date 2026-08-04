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

/**
 * Are these two bands the two halves of one current split?
 *
 * **Direct lifecycle provenance, not kinship.** At departure the pair stands on the same tile, and
 * CORRECTION-29 gates encounters on proximity — so without this the split would immediately
 * manufacture stranger friction between a band and the group that just walked out of it, and
 * CORRECTION-30's access expectation would carry that fiction forward. The relation is read off the
 * `lineageId` both records already carry; no kin model is consulted and none is invented.
 */
export function shareCurrentFissionLineage(left: Band, right: Band): boolean {
  const leftIds = [left.fissionAttempt?.lineageId, left.provisionalSuccessor?.lineageId].filter(
    (id): id is string => id !== undefined,
  );
  if (leftIds.length === 0) {
    return false;
  }
  const rightIds = new Set(
    [right.fissionAttempt?.lineageId, right.provisionalSuccessor?.lineageId].filter(
      (id): id is string => id !== undefined,
    ),
  );
  return leftIds.some((id) => rightIds.has(id));
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
