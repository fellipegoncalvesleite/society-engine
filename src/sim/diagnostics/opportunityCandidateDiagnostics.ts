// CORRECTION-18 §11 — opportunity candidate-ledger instrumentation.
//
// AUDIT-ONLY and NON-PERSISTED, following the CORRECTION-16/-14 hook convention: a
// module-level slot an audit runner sets and clears in a `finally`. Nothing here enters
// `WorldState`, band state, snapshots, the worker or the UI. With no observer registered
// — every production, worker and UI path — the cost is one `undefined` check per band per
// carrying-capacity derivation, and canonical output is byte-identical.
//
// WHY THIS EXISTS
// ---------------
// `deriveKnownUnusedHabitat` collects a bounded candidate list, then walks it keeping a
// single best-by-score winner, and evaluates the viability predicate (`consideredAsTarget`:
// expected per-capita margin, water reliability, risk ceiling) ONLY for that winner. Three
// distinct failure modes are indistinguishable from the outside, and §11 requires proving
// which of them actually occurs:
//
//   (a) STARVATION       — frontier-derived candidates never reach the list at all,
//                          because the 18-slot cap is filled by nearer families first;
//   (b) MASKING          — they reach the list, but a higher-SCORING candidate wins and
//                          the winner then fails viability, so a viable lower-scoring
//                          candidate is discarded without ever being tested;
//   (c) HONEST LOSS      — they reach the list, are evaluated, and genuinely lose.
//
// The observer records the WHOLE evaluated ledger, so (a), (b) and (c) are separable and
// the "eligibility before ranking" repair can be justified or refused on evidence.
//
// Every value below is read from the same locals the production loop already computed, so
// this reports the real decision rather than a reconstruction of it.

import type { BandId, TickNumber, TileId } from "../core/types";
import type { KnowledgeAcquisitionKind } from "../knowledge/types";

/** One candidate as production actually evaluated it. */
export interface OpportunityCandidateRecord {
  readonly tileId: TileId;
  readonly distanceTiles: number;
  /** §8 provenance of the band's own record for this tile. */
  readonly acquisition: KnowledgeAcquisitionKind;
  readonly confidence: number;
  /** The ranking score the production loop used to pick its single winner. */
  readonly score: number;
  /** The viability inputs, whether or not production got as far as testing them. */
  readonly expectedPerCapita: number;
  readonly waterReliability: number;
  readonly riskPenalty: number;
  readonly usePressure: number;
  readonly travelCost: number;
  /** Would this candidate have passed the production viability predicate? */
  readonly wouldPassViability: boolean;
  /** Did production actually select this one as its score winner? */
  readonly isScoreWinner: boolean;
}

export interface OpportunityCandidateLedger {
  readonly tick: TickNumber;
  readonly bandId: BandId;
  readonly currentPerCapita: number;
  readonly competitionMargin: number;
  readonly candidateIdsCollected: number;
  readonly candidatesEvaluated: number;
  readonly candidates: readonly OpportunityCandidateRecord[];
  /** The production outcome: which tile won, and whether it passed viability. */
  readonly winnerTileId?: TileId;
  readonly winnerPassedViability: boolean;
}

export type OpportunityCandidateObserver = (ledger: OpportunityCandidateLedger) => void;

let observer: OpportunityCandidateObserver | undefined;

/** Registers (or with `undefined`, clears) the audit observer. Audit runners only. */
export function setOpportunityCandidateObserver(next: OpportunityCandidateObserver | undefined): void {
  observer = next;
}

export function getOpportunityCandidateObserver(): OpportunityCandidateObserver | undefined {
  return observer;
}
