/**
 * ROADMAP ITEM 4 — MONOTONIC RETURN-PATH MEMORY.
 *
 * The lifecycle phase history is deliberately capped. It is useful narrative context, but it cannot
 * prove that a group NEVER entered `returning`: enough later transitions can evict that entry. This
 * leaf owns the bounded answer. The first return-path crossing is one absorbing record; subsequent
 * calls preserve it byte-for-byte.
 */
import type { FissionLifecycleRecord, ProvisionalSeparationCourse } from "./types";
import type { FissionLifecyclePhase } from "./fissionLifecycleKernel";

export type ReturnPathTrigger = Extract<
  ProvisionalSeparationCourse,
  { readonly status: "return_path_entered" }
>["trigger"];

export function beginProvisionalSeparationCourse(departedOnDay: number): ProvisionalSeparationCourse {
  return { status: "outbound_trial", initializedOnDay: departedOnDay };
}

export function markProvisionalReturnPathEntered(
  record: FissionLifecycleRecord,
  today: number,
  enteredFromPhase: FissionLifecyclePhase,
  trigger: ReturnPathTrigger,
): ProvisionalSeparationCourse {
  const current = record.separationCourse;
  if (current?.status === "return_path_entered") {
    return current;
  }

  return {
    status: "return_path_entered",
    initializedOnDay:
      current?.initializedOnDay ?? record.departureProvenance?.departedOnDay ?? record.phaseEnteredDay,
    firstEnteredOnDay: today,
    enteredFromPhase,
    trigger,
  };
}

/**
 * Strict by design: absence is not proof. The physical seam initializes the course on every real
 * successor; older/hand-built records remain readable but cannot acquire a successful identity.
 */
export function provesNeverEnteredReturnPath(record: FissionLifecycleRecord): boolean {
  return record.separationCourse?.status === "outbound_trial" &&
    record.departureProvenance !== undefined &&
    record.separationCourse.initializedOnDay === record.departureProvenance.departedOnDay;
}
