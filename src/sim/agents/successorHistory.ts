/** Shared bound and append rules for the two-stage Direction-D history. */
import type {
  SuccessorDepartureRecord,
  SuccessorPostReturnEstablishmentEvent,
  SuccessorStabilizationEvent,
} from "./types";

export const SUCCESSOR_HISTORY_CAP = 12;

export function appendSuccessorDepartureRecord(
  prior: readonly SuccessorDepartureRecord[] | undefined,
  record: SuccessorDepartureRecord,
): readonly SuccessorDepartureRecord[] {
  const withoutDuplicate = (prior ?? []).filter((entry) => String(entry.id) !== String(record.id));
  return [...withoutDuplicate, record].slice(-SUCCESSOR_HISTORY_CAP);
}

export function appendSuccessorStabilizationEvent(
  prior: readonly SuccessorStabilizationEvent[] | undefined,
  event: SuccessorStabilizationEvent,
): readonly SuccessorStabilizationEvent[] {
  const withoutDuplicate = (prior ?? []).filter((entry) => String(entry.id) !== String(event.id));
  return [...withoutDuplicate, event].slice(-SUCCESSOR_HISTORY_CAP);
}

export function appendSuccessorPostReturnEstablishmentEvent(
  prior: readonly SuccessorPostReturnEstablishmentEvent[] | undefined,
  event: SuccessorPostReturnEstablishmentEvent,
): readonly SuccessorPostReturnEstablishmentEvent[] {
  const withoutDuplicate = (prior ?? []).filter((entry) => String(entry.id) !== String(event.id));
  return [...withoutDuplicate, event].slice(-SUCCESSOR_HISTORY_CAP);
}
