// CORRECTION-23H §4/§5/§6 — DECISION-CONTINGENT VERIFICATION / VALUE-OF-INFORMATION SEAM.
//
// AUDIT-ONLY and NON-PERSISTED. Nothing here enters `WorldState`, band state, snapshots, the
// worker, or the UI. Everything is a module-level slot an audit runner sets and clears in a
// `finally`. With nothing registered — every production, worker and UI path — the single seam
// costs one `undefined` comparison and canonical output is byte-identical to `ff48d29`.
//
// WHY THIS EXISTS
// ---------------
// CORRECTION-23G proved that a frontier-verification party's ANSWER changes nothing once its
// physical schedule is held fixed: replaying the exact journey with no question, no answer, no
// evidence and no disposition reproduced the positive control on all six sites, to four decimal
// places on every measured quantity. That says the answers are inert IN AGGREGATE. It does not
// say WHY, and it does not say whether any individual launch was ever justified.
//
// §4 states the contract a verification task must satisfy:
//
//     a specific current decision
//     is blocked or materially altered
//     by a specific unresolved evidence domain
//
// A question whose possible answers all lead to the same decision has zero current decision
// value, however interesting the place looks and however stressed the band is. This module
// measures that directly, at the moment of selection, by asking the production readers what
// they WOULD say under each legal answer.
//
// WHAT MAKES THIS ADMISSIBLE
// --------------------------
// CORRECTION-16's `AUDIT_ADMISSIBILITY.md` requires a mechanism claim to rest on a
// SAME-SNAPSHOT counterfactual — arms differing in exactly one field, evaluated through the
// real reader — never on a trajectory-mean ordering. So:
//
//   * the four arms differ ONLY in one `VerificationEvidenceRecord`, written by the real
//     `recordVerificationEvidence` writer, so every row is a shape production can actually
//     produce;
//   * each arm is evaluated by re-running the REAL production reader, never a copy of it;
//   * the reader input is CAPTURED at the production seam rather than reconstructed, because
//     two of the seven inputs to the opportunity reader are local intermediates that band state
//     does not carry, and an approximate counterfactual is not an orthogonal one;
//   * nothing here reads hidden world truth: the arms are SYMBOLIC possible answers, not the
//     answer the party would actually obtain. No physical stock, no future population, no
//     future ecology, no hidden success is consulted anywhere in this file.

import type { Band } from "../agents/types";
import type { WorldState } from "../world/types";

// ── the reader input, captured at the seam ───────────────────────────────────────────────
//
// `deriveKnownUnusedHabitat` takes seven inputs. Five are recoverable from canonical band
// state; `biomeCompetence` and `resourcePressure` are local intermediates that are not stored
// anywhere. Reconstructing them would make every water-access arm approximate, so the real
// values are captured instead. The capture is a plain assignment of an object production has
// already built, and it happens only while an audit has registered the slot.

export interface OpportunityReaderInput {
  readonly time: unknown;
  readonly biomeCompetence: number;
  readonly currentPerCapita: number;
  readonly demand: number;
  readonly sustainedOverCapacity: number;
  readonly nomadicScalePressure: number;
  readonly resourcePressure: number;
}

export interface CapturedOpportunityCall {
  readonly input: OpportunityReaderInput;
  /**
   * The tick context cache production passed. It is REQUIRED for an audit re-run to reproduce
   * production: `collectOpportunityCandidates` reads the salient-memory summary out of it, so
   * a re-run without it silently evaluates a smaller candidate set.
   */
  readonly cache: unknown;
  /** The tick this capture belongs to, so a stale capture is never used as a snapshot. */
  readonly tick: number;
}

let capturing = false;
const capturedInputs = new Map<string, CapturedOpportunityCall>();

/** Starts (or with `false`, stops and discards) opportunity-input capture. Audit runners only. */
export function setOpportunityInputCapture(enabled: boolean): void {
  capturing = enabled;
  capturedInputs.clear();
}

/** True while an audit is capturing. Production reads this once per band per tick. */
export function isCapturingOpportunityInput(): boolean {
  return capturing;
}

/**
 * Records the exact input production is about to pass to the opportunity reader. A no-op —
 * and one boolean test — when no audit is capturing, which is every production path.
 */
export function captureOpportunityInput(
  bandId: string,
  input: OpportunityReaderInput,
  cache: unknown,
  tick: number,
): void {
  if (!capturing) {
    return;
  }

  capturedInputs.set(bandId, { input, cache, tick });
}

/** The most recent captured call for this band, or `undefined` if none was captured. */
export function getCapturedOpportunityInput(bandId: string): CapturedOpportunityCall | undefined {
  return capturedInputs.get(bandId);
}

// ── §6 relevance taxonomy ────────────────────────────────────────────────────────────────

/**
 * The eight classes §6 defines. They are mutually exclusive by construction, and the two that
 * are most easily conflated are kept apart on purpose: a question that only moves a SCORE is
 * never reported as one that changes an ACTION.
 */
export type RelevanceClass =
  /** At least one possible answer changes the action selected now. */
  | "immediate_action_relevant"
  /** An answer changes whether a specific later physical task is legally eligible. */
  | "eligibility_relevant"
  /** An answer changes a score but changes neither eligibility nor the selected action. */
  | "ranking_relevant_only"
  /** The result has no current reader because its downstream system does not exist yet. */
  | "future_system_evidence"
  /** The answer is already established by existing evidence. */
  | "redundant"
  /** Eligibility itself practically guarantees the result. */
  | "tautological"
  /** The question does not matter, but membership of the verification family moves scheduling. */
  | "selector_only"
  /** No possible legal result changes any current reader. */
  | "inert";

/**
 * The four symbolic arms. These are POSSIBLE answers, never the answer the party would get.
 *
 *   Q0  no verification evidence at all
 *   Q1  a legally confirmed result
 *   Q2  a legally negative result
 *   Q3  a legally inconclusive result
 */
export type CounterfactualArm = "Q0" | "Q1" | "Q2" | "Q3";

export const COUNTERFACTUAL_ARMS: readonly CounterfactualArm[] = ["Q0", "Q1", "Q2", "Q3"];

/** One candidate's full counterfactual record, as §5 requires it be reported. */
export interface CandidateRelevanceRecord {
  readonly bandId: string;
  readonly tileId: string;
  readonly question: string;
  readonly day: number;
  readonly season: string;
  /** What the reader says right now, with the band's real evidence. */
  readonly currentVerdict: Record<string, unknown>;
  /** What the reader would say under each symbolic answer. */
  readonly hypotheticalVerdicts: Record<CounterfactualArm, Record<string, unknown>>;
  readonly eligibilityChanges: boolean;
  readonly rankingChanges: boolean;
  readonly selectedTargetChanges: boolean;
  readonly selectedActionChanges: boolean;
  readonly classification: RelevanceClass;
  readonly reasonCode: string;
  /** True when the same target would be reachable by ordinary broad exploration. */
  readonly reachableByOrdinaryExploration?: boolean;
}

// ── the observer slot ────────────────────────────────────────────────────────────────────

export type VerificationCandidateObserver = (record: CandidateRelevanceRecord) => void;

let observer: VerificationCandidateObserver | undefined;

/** Registers (or with `undefined`, clears) the candidate observer. Audit runners only. */
export function setVerificationCandidateObserver(o: VerificationCandidateObserver | undefined): void {
  observer = o;
}

/** True when an audit is observing candidate relevance. */
export function hasVerificationCandidateObserver(): boolean {
  return observer !== undefined;
}

/** Emits one record. No-op when unregistered. */
export function emitCandidateRelevance(record: CandidateRelevanceRecord): void {
  if (observer === undefined) {
    return;
  }

  observer(record);
}

// ── §11 bounded-horizon reader trace ─────────────────────────────────────────────────────
//
// The same-snapshot counterfactual above is authoritative for IMMEDIATE relevance. §11 asks
// separately whether the evidence a party actually brought home reached a reader, and whether
// any verdict or selected action changed, WITHIN ONE SEASON. Long-run population divergence is
// explicitly not the definition of relevance and is not used as one.

export interface ReaderTraceRow {
  readonly bandId: string;
  readonly tileId: string;
  readonly question: string;
  readonly outcome: string;
  readonly returnDay: number;
  /** Day the reader for this question was first invoked on this place after the return. */
  firstReaderInvocationDay?: number;
  /** Day the reader's verdict first differed from what it said before the return. */
  firstChangedVerdictDay?: number;
  /** Day a selected action first differed as a result. */
  firstChangedActionDay?: number;
  /** True once the one-season horizon has elapsed with no reader invocation. */
  expiredUnread?: boolean;
}

let traceRows: ReaderTraceRow[] | undefined;

/** Starts (or with `false`, stops and discards) the bounded-horizon reader trace. */
export function setReaderTracing(enabled: boolean): void {
  traceRows = enabled ? [] : undefined;
}

/** True while an audit is tracing readers. */
export function isReaderTracing(): boolean {
  return traceRows !== undefined;
}

/** Appends one returned-evidence row to the trace. No-op when tracing is off. */
export function recordReaderTraceReturn(row: ReaderTraceRow): void {
  if (traceRows === undefined) {
    return;
  }

  traceRows.push(row);
}

/**
 * Notes that the reader for (band, place, question) ran on this day, and whether its verdict
 * differed from the pre-return verdict. Only the FIRST occurrence of each is kept, because the
 * question §11 asks is when a reader first consumed the answer, not how often.
 */
export function noteReaderInvocation(
  bandId: string,
  tileId: string,
  question: string,
  day: number,
  verdictChanged: boolean,
  actionChanged: boolean,
): void {
  if (traceRows === undefined) {
    return;
  }

  for (const row of traceRows) {
    if (row.bandId !== bandId || row.tileId !== tileId || row.question !== question) {
      continue;
    }

    if (day < row.returnDay) {
      continue;
    }

    if (row.firstReaderInvocationDay === undefined) {
      row.firstReaderInvocationDay = day;
    }

    if (verdictChanged && row.firstChangedVerdictDay === undefined) {
      row.firstChangedVerdictDay = day;
    }

    if (actionChanged && row.firstChangedActionDay === undefined) {
      row.firstChangedActionDay = day;
    }
  }
}

/** The trace so far. */
export function getReaderTrace(): readonly ReaderTraceRow[] {
  return traceRows ?? [];
}

// ── shared helpers for audit runners ─────────────────────────────────────────────────────

/**
 * A band clone carrying exactly one synthetic evidence row, or — for Q0 — carrying no evidence
 * for that place and question at all. The row is built by the audit runner through the REAL
 * `recordVerificationEvidence` writer, so this function only performs the substitution.
 *
 * Nothing is mutated: the original band is untouched and the clone is discarded by the caller.
 */
export function withSubstitutedEvidence(
  band: Band,
  tileId: string,
  question: string,
  rows: readonly unknown[] | undefined,
): Band {
  void tileId;
  void question;
  return { ...band, verificationEvidence: rows } as Band;
}

/** Strips every evidence row for one (place, question) pair — the Q0 arm. */
export function withoutEvidenceFor(band: Band, tileId: string, question: string): Band {
  const rows = (band.verificationEvidence ?? []).filter(
    (row) => !(String(row.tileId) === tileId && String(row.question) === question),
  );
  return { ...band, verificationEvidence: rows } as Band;
}

/** Clears every slot in this module. Audit runners call this in a `finally`. */
export function clearVerificationValueDiagnostics(): void {
  capturing = false;
  capturedInputs.clear();
  observer = undefined;
  traceRows = undefined;
}

/** True when any slot here is registered — asserted zero by the diagnostics-off parity audit. */
export function hasVerificationValueDiagnostics(): boolean {
  return capturing || observer !== undefined || traceRows !== undefined;
}

/** Convenience for audit runners that need the world without importing the type twice. */
export type AuditWorld = WorldState;
