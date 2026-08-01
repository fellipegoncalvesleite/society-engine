// Audit-only production-event ledger for CORRECTION-24C.
//
// This module owns no simulation state and is inert unless explicitly enabled by an
// audit runner. Returned exploration observations receive identities here rather
// than in WorldState. Reader hooks are called only from real production functions,
// and action hooks are called only after real execution seams have selected or
// produced an action. Commit B removes this module and every caller.

export type ExplorationReaderFamily =
  | "movement_destination"
  | "camp_movement"
  | "resource_activity"
  | "daughter_fission";

export interface ReturnedExplorationRecordEvent {
  readonly recordEventId: string;
  readonly bandId: string;
  readonly tileId: string;
  readonly expeditionId: string;
  readonly returnDay: number;
  readonly newOrRefreshed: "new" | "refreshed";
  readonly writeSuppressed: boolean;
  readonly beforeRecordFingerprint?: string;
  readonly afterRecordFingerprint?: string;
}

export interface ReaderActionLink {
  readonly selectedActionId?: string;
  readonly selectedActionKind?: string;
  readonly selectedTarget?: string;
}

export interface ProductionReaderInvocation extends ReaderActionLink {
  readonly invocationKey: string;
  readonly readerFamily: ExplorationReaderFamily;
  readonly productionFunction: string;
  readonly bandId: string;
  readonly invocationDay: number;
  readonly invocationTick: number;
  readonly consultedRecordEventIds: readonly string[];
  readonly consultationRoles: Readonly<Record<string, string>>;
  readonly readerVerdict: string;
  readonly readerRanking: string;
}

export interface ProductionReaderEvent extends ReaderActionLink {
  readonly recordEventId: string;
  readonly readerFamily: ExplorationReaderFamily;
  readonly productionFunction: string;
  readonly invocationDay: number;
  readonly actualRecordConsulted: true;
  readonly consultationRole: string;
  readonly readerVerdict: string;
  readonly readerRanking: string;
}

export interface MovementActionEvent {
  readonly decisionId: string;
  readonly bandId: string;
  readonly day: number;
  readonly actionKind: string;
  readonly targetTileId: string;
  readonly movementRecordId?: string;
  readonly positionBefore: string;
  readonly positionAfter: string;
}

export interface CampActionEvent {
  readonly campActionId: string;
  readonly bandId: string;
  readonly day: number;
  readonly campActionKind: "local_shift" | "temporary_task_camp";
  readonly targetTileId: string;
  readonly campRecordId: string;
  readonly positionBefore: string;
  readonly positionAfter: string;
}

export interface ResourceActivityActionEvent {
  readonly activityActionId: string;
  readonly bandId: string;
  readonly day: number;
  readonly activityKind: string;
  readonly selectedPatchId?: string;
  readonly selectedTileId: string;
  readonly tripOrTaskId: string;
  readonly workers: number;
  readonly route: readonly string[];
  readonly physicalOutcomeId: string;
  readonly receiptId?: string;
  readonly usableSupportReturned: number;
}

export interface FissionActionEvent {
  readonly fissionActionId: string;
  readonly parentBandId: string;
  readonly day: number;
  readonly daughterBandId?: string;
  readonly selectedTargetTileId?: string;
  readonly daughterActuallyCreated: boolean;
  readonly daughterInitialPosition?: string;
}

export interface SuppressedReturnWrite {
  readonly expeditionId: string;
  readonly tileId: string;
  readonly day: number;
}

interface RecordIdentity {
  readonly recordEventId: string;
  readonly bandId: string;
  readonly tileId: string;
  readonly expeditionId: string;
  readonly returnDay: number;
}

interface MutableReaderInvocation {
  readonly invocationKey: string;
  readonly readerFamily: ExplorationReaderFamily;
  readonly productionFunction: string;
  readonly bandId: string;
  readonly invocationDay: number;
  readonly invocationTick: number;
  readonly consultedRecordEventIds: Set<string>;
  readonly consultationRoles: Map<string, string>;
  readerVerdict: string;
  readerRanking: string;
  selectedActionId?: string;
  selectedActionKind?: string;
  selectedTarget?: string;
}

interface CausalAuditState {
  readonly recordEvents: ReturnedExplorationRecordEvent[];
  readonly recordIdentityByBandTile: Map<string, RecordIdentity>;
  readonly activeReaderByToken: Map<string, MutableReaderInvocation>;
  readonly activeReaderTokensByFamilyBand: Map<string, string[]>;
  readonly readerInvocationCounters: Map<string, number>;
  readonly readerInvocations: MutableReaderInvocation[];
  readonly readerInvocationsByBandTick: Map<string, MutableReaderInvocation[]>;
  readonly readerInvocationsByBandDay: Map<string, MutableReaderInvocation[]>;
  readonly seasonalActionByBandTick: Map<string, ReaderActionLink>;
  readonly dailyActionByBandDay: Map<string, ReaderActionLink>;
  readonly movementActions: MovementActionEvent[];
  readonly campActions: CampActionEvent[];
  readonly resourceActions: ResourceActivityActionEvent[];
  readonly fissionActions: FissionActionEvent[];
}

let auditState: CausalAuditState | undefined;
let suppressedReturnWrite: SuppressedReturnWrite | undefined;
let retainEmptyReaderInvocations = false;

function createAuditState(): CausalAuditState {
  return {
    recordEvents: [],
    recordIdentityByBandTile: new Map(),
    activeReaderByToken: new Map(),
    activeReaderTokensByFamilyBand: new Map(),
    readerInvocationCounters: new Map(),
    readerInvocations: [],
    readerInvocationsByBandTick: new Map(),
    readerInvocationsByBandDay: new Map(),
    seasonalActionByBandTick: new Map(),
    dailyActionByBandDay: new Map(),
    movementActions: [],
    campActions: [],
    resourceActions: [],
    fissionActions: [],
  };
}

function bandTileKey(bandId: string, tileId: string): string {
  return `${bandId}|${tileId}`;
}

function familyBandKey(family: ExplorationReaderFamily, bandId: string): string {
  return `${family}|${bandId}`;
}

function bandTickKey(bandId: string, tick: number): string {
  return `${bandId}|${tick}`;
}

function bandDayKey(bandId: string, day: number): string {
  return `${bandId}|${day}`;
}

function fingerprint(value: unknown): string | undefined {
  return value === undefined ? undefined : JSON.stringify(value);
}

function toReaderInvocation(row: MutableReaderInvocation): ProductionReaderInvocation {
  const consultationRoles = Object.fromEntries(
    [...row.consultationRoles.entries()].sort(([left], [right]) => left.localeCompare(right)),
  );

  return {
    invocationKey: row.invocationKey,
    readerFamily: row.readerFamily,
    productionFunction: row.productionFunction,
    bandId: row.bandId,
    invocationDay: row.invocationDay,
    invocationTick: row.invocationTick,
    consultedRecordEventIds: [...row.consultedRecordEventIds].sort(),
    consultationRoles,
    readerVerdict: row.readerVerdict,
    readerRanking: row.readerRanking,
    ...(row.selectedActionId === undefined ? {} : { selectedActionId: row.selectedActionId }),
    ...(row.selectedActionKind === undefined ? {} : { selectedActionKind: row.selectedActionKind }),
    ...(row.selectedTarget === undefined ? {} : { selectedTarget: row.selectedTarget }),
  };
}

function applyActionLink(row: MutableReaderInvocation, action: ReaderActionLink): void {
  row.selectedActionId = action.selectedActionId;
  row.selectedActionKind = action.selectedActionKind;
  row.selectedTarget = action.selectedTarget;
}

/** Enables or disables the audit ledger. Disabled is the production default. */
export function setExplorationCausalAuditRecording(enabled: boolean): void {
  auditState = enabled ? createAuditState() : undefined;
}

/** Keeps empty invocations only for short paired replay windows that must match a missing read. */
export function setRetainEmptyExplorationReaderInvocations(enabled: boolean): void {
  retainEmptyReaderInvocations = enabled;
}

/** Returns whether any causal audit is currently collecting events. */
export function isExplorationCausalAuditRecording(): boolean {
  return auditState !== undefined;
}

/** Cheap writer-count probe used to retain immutable pre-return checkpoints. */
export function getExplorationRecordEventCount(): number {
  return auditState?.recordEvents.length ?? 0;
}

/** Clears every audit-only identity, event, action, and suppression target. */
export function clearExplorationCausalAudit(): void {
  auditState = undefined;
  suppressedReturnWrite = undefined;
  retainEmptyReaderInvocations = false;
}

/** Configures the one exact return write suppressed by a writer replay. */
export function setSuppressedExplorationReturnWrite(
  target: SuppressedReturnWrite | undefined,
): void {
  suppressedReturnWrite = target;
}

/** Tests the exact writer identity without consulting or mutating WorldState. */
export function shouldSuppressExplorationReturnWrite(
  expeditionId: string,
  tileId: string,
  day: number,
): boolean {
  return (
    suppressedReturnWrite !== undefined &&
    suppressedReturnWrite.expeditionId === expeditionId &&
    suppressedReturnWrite.tileId === tileId &&
    suppressedReturnWrite.day === day
  );
}

/**
 * Records one canonical return-writer event and, when the write happened, makes
 * that event the audit identity of the tile record subsequently consulted.
 */
export function recordReturnedExplorationObservation(input: {
  readonly bandId: string;
  readonly tileId: string;
  readonly expeditionId: string;
  readonly returnDay: number;
  readonly isNewRecord: boolean;
  readonly writeSuppressed: boolean;
  readonly beforeRecord?: unknown;
  readonly afterRecord?: unknown;
}): string {
  const recordEventId =
    `exploration-record:${input.bandId}:${input.expeditionId}:${input.tileId}:${input.returnDay}`;

  if (auditState === undefined) {
    return recordEventId;
  }

  const event: ReturnedExplorationRecordEvent = {
    recordEventId,
    bandId: input.bandId,
    tileId: input.tileId,
    expeditionId: input.expeditionId,
    returnDay: input.returnDay,
    newOrRefreshed: input.isNewRecord ? "new" : "refreshed",
    writeSuppressed: input.writeSuppressed,
    ...(fingerprint(input.beforeRecord) === undefined
      ? {}
      : { beforeRecordFingerprint: fingerprint(input.beforeRecord) }),
    ...(fingerprint(input.afterRecord) === undefined
      ? {}
      : { afterRecordFingerprint: fingerprint(input.afterRecord) }),
  };
  auditState.recordEvents.push(event);

  if (!input.writeSuppressed && input.afterRecord !== undefined) {
    auditState.recordIdentityByBandTile.set(bandTileKey(input.bandId, input.tileId), {
      recordEventId,
      bandId: input.bandId,
      tileId: input.tileId,
      expeditionId: input.expeditionId,
      returnDay: input.returnDay,
    });
  }

  return recordEventId;
}

/**
 * Restores a prior event identity when a replay starts from an immutable
 * pre-return checkpoint rather than from day zero.
 */
export function seedExplorationRecordIdentity(input: {
  readonly recordEventId: string;
  readonly bandId: string;
  readonly tileId: string;
  readonly expeditionId: string;
  readonly returnDay: number;
}): void {
  auditState?.recordIdentityByBandTile.set(bandTileKey(input.bandId, input.tileId), {
    recordEventId: input.recordEventId,
    bandId: input.bandId,
    tileId: input.tileId,
    expeditionId: input.expeditionId,
    returnDay: input.returnDay,
  });
}

/** Starts one real production reader invocation and returns its audit token. */
export function beginExplorationReaderInvocation(input: {
  readonly readerFamily: ExplorationReaderFamily;
  readonly productionFunction: string;
  readonly bandId: string;
  readonly invocationDay: number;
  readonly invocationTick: number;
}): string | undefined {
  if (auditState === undefined) {
    return undefined;
  }

  const counterKey =
    `${input.readerFamily}|${input.productionFunction}|${input.bandId}|${input.invocationDay}`;
  const ordinal = (auditState.readerInvocationCounters.get(counterKey) ?? 0) + 1;
  auditState.readerInvocationCounters.set(counterKey, ordinal);
  const invocationKey = `${counterKey}|${ordinal}`;
  const row: MutableReaderInvocation = {
    invocationKey,
    readerFamily: input.readerFamily,
    productionFunction: input.productionFunction,
    bandId: input.bandId,
    invocationDay: input.invocationDay,
    invocationTick: input.invocationTick,
    consultedRecordEventIds: new Set(),
    consultationRoles: new Map(),
    readerVerdict: "not_finished",
    readerRanking: "",
  };
  const activeKey = familyBandKey(input.readerFamily, input.bandId);
  const tokens = auditState.activeReaderTokensByFamilyBand.get(activeKey) ?? [];

  auditState.activeReaderByToken.set(invocationKey, row);
  auditState.activeReaderTokensByFamilyBand.set(activeKey, [...tokens, invocationKey]);
  return invocationKey;
}

/**
 * Marks the exact exploration-returned tile record a production reader touched.
 * A re-learned record whose first observation post-dates the exploration event is
 * deliberately not attributed to that event.
 */
export function noteExplorationRecordConsulted(input: {
  readonly readerFamily: ExplorationReaderFamily;
  readonly bandId: string;
  readonly tileId: string;
  readonly consultationRole: string;
  readonly recordFirstObservedDay?: number;
  readonly recordLastObservedDay?: number;
}): void {
  if (auditState === undefined) {
    return;
  }

  const identity = auditState.recordIdentityByBandTile.get(
    bandTileKey(input.bandId, input.tileId),
  );

  if (
    identity === undefined ||
    (input.recordFirstObservedDay !== undefined &&
      input.recordFirstObservedDay > identity.returnDay) ||
    (input.recordLastObservedDay !== undefined &&
      input.recordLastObservedDay < identity.returnDay)
  ) {
    return;
  }

  const activeKey = familyBandKey(input.readerFamily, input.bandId);
  const tokens = auditState.activeReaderTokensByFamilyBand.get(activeKey) ?? [];
  const token = tokens[tokens.length - 1];
  const row = token === undefined ? undefined : auditState.activeReaderByToken.get(token);

  if (row === undefined) {
    return;
  }

  row.consultedRecordEventIds.add(identity.recordEventId);
  const existingRole = row.consultationRoles.get(identity.recordEventId);
  const roles = new Set(
    existingRole?.split("+").filter((role) => role.length > 0) ?? [],
  );
  roles.add(input.consultationRole);
  row.consultationRoles.set(
    identity.recordEventId,
    [...roles].join("+"),
  );
}

/** Completes a real reader invocation with the output production actually returned. */
export function finishExplorationReaderInvocation(
  token: string | undefined,
  output: {
    readonly readerVerdict: string;
    readonly readerRanking: string;
  },
): void {
  if (auditState === undefined || token === undefined) {
    return;
  }

  const row = auditState.activeReaderByToken.get(token);

  if (row === undefined) {
    return;
  }

  row.readerVerdict = output.readerVerdict;
  row.readerRanking = output.readerRanking;
  const action =
    row.readerFamily === "resource_activity"
      ? auditState.dailyActionByBandDay.get(bandDayKey(row.bandId, row.invocationDay))
      : auditState.seasonalActionByBandTick.get(bandTickKey(row.bandId, row.invocationTick));

  if (action !== undefined) {
    applyActionLink(row, action);
  }

  if (row.consultedRecordEventIds.size > 0 || retainEmptyReaderInvocations) {
    auditState.readerInvocations.push(row);
    const tickKey = bandTickKey(row.bandId, row.invocationTick);
    const dayKey = bandDayKey(row.bandId, row.invocationDay);
    auditState.readerInvocationsByBandTick.set(tickKey, [
      ...(auditState.readerInvocationsByBandTick.get(tickKey) ?? []),
      row,
    ]);
    auditState.readerInvocationsByBandDay.set(dayKey, [
      ...(auditState.readerInvocationsByBandDay.get(dayKey) ?? []),
      row,
    ]);
  }
  auditState.activeReaderByToken.delete(token);
  const activeKey = familyBandKey(row.readerFamily, row.bandId);
  const tokens = auditState.activeReaderTokensByFamilyBand.get(activeKey) ?? [];
  auditState.activeReaderTokensByFamilyBand.set(
    activeKey,
    tokens.filter((current) => current !== token),
  );
}

/**
 * Records the seasonal action production selected and the movement/camp actions
 * it actually materialized.
 */
export function recordSeasonalAction(input: {
  readonly bandId: string;
  readonly day: number;
  readonly tick: number;
  readonly decisionId: string;
  readonly actionKind: string;
  readonly targetTileId: string;
  readonly positionBefore: string;
  readonly positionAfter: string;
  readonly moved: boolean;
  readonly movementRecordDecisionId?: string;
  readonly newLocalShift?: {
    readonly id: string;
    readonly targetTileId: string;
  };
  readonly newTemporaryTaskCamp?: {
    readonly id: string;
    readonly targetTileId: string;
  };
}): void {
  if (auditState === undefined) {
    return;
  }

  const action: ReaderActionLink = {
    selectedActionId: input.decisionId,
    selectedActionKind: input.actionKind,
    selectedTarget: input.targetTileId,
  };
  auditState.seasonalActionByBandTick.set(bandTickKey(input.bandId, input.tick), action);

  for (const row of auditState.readerInvocationsByBandTick.get(
    bandTickKey(input.bandId, input.tick),
  ) ?? []) {
    if (
      row.bandId === input.bandId &&
      row.invocationTick === input.tick &&
      row.readerFamily !== "resource_activity"
    ) {
      applyActionLink(row, action);
    }
  }

  if (input.actionKind === "move_to_tile" || input.actionKind === "explore_unknown_neighbor") {
    auditState.movementActions.push({
      decisionId: input.decisionId,
      bandId: input.bandId,
      day: input.day,
      actionKind: input.actionKind,
      targetTileId: input.targetTileId,
      ...(input.moved
        ? {
            movementRecordId:
              `movement-record:${input.bandId}:${input.tick}:${input.movementRecordDecisionId ?? input.decisionId}`,
          }
        : {}),
      positionBefore: input.positionBefore,
      positionAfter: input.positionAfter,
    });
  }

  if (input.newLocalShift !== undefined) {
    auditState.campActions.push({
      campActionId: `camp-action:${input.decisionId}:${input.newLocalShift.id}`,
      bandId: input.bandId,
      day: input.day,
      campActionKind: "local_shift",
      targetTileId: input.newLocalShift.targetTileId,
      campRecordId: input.newLocalShift.id,
      positionBefore: input.positionBefore,
      positionAfter: input.positionAfter,
    });
  }

  if (input.newTemporaryTaskCamp !== undefined) {
    auditState.campActions.push({
      campActionId: `camp-action:${input.decisionId}:${input.newTemporaryTaskCamp.id}`,
      bandId: input.bandId,
      day: input.day,
      campActionKind: "temporary_task_camp",
      targetTileId: input.newTemporaryTaskCamp.targetTileId,
      campRecordId: input.newTemporaryTaskCamp.id,
      positionBefore: input.positionBefore,
      positionAfter: input.positionAfter,
    });
  }
}

/** Records one actually selected and executed same-day resource activity. */
export function recordResourceActivityAction(input: ResourceActivityActionEvent): void {
  if (auditState === undefined) {
    return;
  }

  auditState.resourceActions.push(input);
  const action: ReaderActionLink = {
    selectedActionId: input.activityActionId,
    selectedActionKind: input.activityKind,
    selectedTarget: input.selectedTileId,
  };
  auditState.dailyActionByBandDay.set(bandDayKey(input.bandId, input.day), action);

  for (const row of auditState.readerInvocationsByBandDay.get(
    bandDayKey(input.bandId, input.day),
  ) ?? []) {
    if (
      row.bandId === input.bandId &&
      row.invocationDay === input.day &&
      row.readerFamily === "resource_activity"
    ) {
      applyActionLink(row, action);
    }
  }
}

/** Records the actual daughter-creation seam, including an honest no-create row. */
export function recordFissionAction(input: FissionActionEvent & { readonly tick: number }): void {
  if (auditState === undefined) {
    return;
  }

  const { tick, ...event } = input;
  auditState.fissionActions.push(event);
  const action: ReaderActionLink = {
    selectedActionId: event.fissionActionId,
    selectedActionKind: event.daughterActuallyCreated ? "daughter_created" : "daughter_not_created",
    selectedTarget: event.selectedTargetTileId,
  };
  auditState.seasonalActionByBandTick.set(bandTickKey(event.parentBandId, tick), action);

  for (const row of auditState.readerInvocationsByBandTick.get(
    bandTickKey(event.parentBandId, tick),
  ) ?? []) {
    if (
      row.bandId === event.parentBandId &&
      row.invocationTick === tick &&
      row.readerFamily === "daughter_fission"
    ) {
      applyActionLink(row, action);
    }
  }
}

/** Returns immutable copies of every audit ledger. */
export function getExplorationCausalAuditSnapshot(): {
  readonly recordEvents: readonly ReturnedExplorationRecordEvent[];
  readonly readerInvocations: readonly ProductionReaderInvocation[];
  readonly readerEvents: readonly ProductionReaderEvent[];
  readonly movementActions: readonly MovementActionEvent[];
  readonly campActions: readonly CampActionEvent[];
  readonly resourceActions: readonly ResourceActivityActionEvent[];
  readonly fissionActions: readonly FissionActionEvent[];
} {
  const readerInvocations = (auditState?.readerInvocations ?? []).map(toReaderInvocation);
  const readerEvents = readerInvocations.flatMap((invocation) =>
    invocation.consultedRecordEventIds.map((recordEventId) => ({
      recordEventId,
      readerFamily: invocation.readerFamily,
      productionFunction: invocation.productionFunction,
      invocationDay: invocation.invocationDay,
      actualRecordConsulted: true as const,
      consultationRole: invocation.consultationRoles[recordEventId] ?? "record_consulted",
      readerVerdict: invocation.readerVerdict,
      readerRanking: invocation.readerRanking,
      ...(invocation.selectedActionId === undefined
        ? {}
        : { selectedActionId: invocation.selectedActionId }),
      ...(invocation.selectedActionKind === undefined
        ? {}
        : { selectedActionKind: invocation.selectedActionKind }),
      ...(invocation.selectedTarget === undefined
        ? {}
        : { selectedTarget: invocation.selectedTarget }),
    })),
  );

  return {
    recordEvents: [...(auditState?.recordEvents ?? [])],
    readerInvocations,
    readerEvents,
    movementActions: [...(auditState?.movementActions ?? [])],
    campActions: [...(auditState?.campActions ?? [])],
    resourceActions: [...(auditState?.resourceActions ?? [])],
    fissionActions: [...(auditState?.fissionActions ?? [])],
  };
}
