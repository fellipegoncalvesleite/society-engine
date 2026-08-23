// ROADMAP ITEM 4 §4/§5 — THE EXHAUSTIVE FIELD-TRANSFER POLICY, CHECKED THREE WAYS.
//
// The policy's whole claim is that a field cannot cross the fission boundary undecided. That claim
// rests on three independent mechanisms, and this audit exercises all three rather than trusting the
// one that is easiest to check:
//
//   (1) TYPE — `Record<keyof Band, ...>` fails to compile when a field is unclassified. Covered by
//       `tsc`, not here.
//   (2) STRUCTURE — this audit re-derives `keyof Band` from `types.ts` INDEPENDENTLY of the compiler
//       and fails if the two disagree. If someone ever weakens the annotation, this still fires.
//   (3) BEHAVIOUR — a real departure is performed and the CONSTRUCTED successor is measured field by
//       field. A policy nothing checks against a real object is a document.
//
// Every fixture asserts a non-vacuity predicate. A fixture whose subject is empty is relabelled
// VACUOUS and fails the run, because "the successor inherited no place memory" is worthless evidence
// when the parent had none either.
import { createServer } from "vite";
import { prepareAndDepart } from "./lib/preparedDeparture.mjs";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/dynamic-fission-daughter-viability-37";
const OUT = arg("out", `${EVIDENCE}/fission-field-transfer.json`);
const SEED = arg("seed", "audit27:natural:s1");
const WARM_DAYS = Number(arg("warm-days", "1800"));

/** Re-derive `keyof Band` from the source, independently of the TypeScript compiler. */
function parseBandFieldsFromTypes() {
  const text = readFileSync("src/sim/agents/types.ts", "utf8");
  const start = text.indexOf("export interface Band {");
  if (start < 0) throw new Error("Band interface not found");
  const end = text.indexOf("\n}", start);
  const body = text.slice(start, end);
  const re = /^ {2}readonly\s+([A-Za-z0-9_]+)\??:/gm;
  const fields = [];
  let m;
  while ((m = re.exec(body)) !== null) fields.push(m[1]);
  return fields;
}

/** Which fields `createDaughterBand` explicitly overrides after its `{ ...parent }` spread. LEXICAL. */
function parseLegacyDaughterOverrides() {
  const text = readFileSync("src/sim/agents/demography.ts", "utf8");
  const start = text.indexOf("const daughter: Band = {");
  if (start < 0) throw new Error("createDaughterBand's daughter literal not found");
  const end = text.indexOf("\n  };", start);
  const body = text.slice(start, end);
  const re = /^ {4}([A-Za-z0-9_]+):/gm;
  const keys = new Set();
  let m;
  while ((m = re.exec(body)) !== null) keys.add(m[1]);
  return keys;
}

const fixtures = [];
const record = (id, claim, passed, nonVacuous, detail) => {
  fixtures.push({
    id,
    claim,
    verdict: nonVacuous === false ? "VACUOUS" : passed ? "PASS" : "FAIL",
    nonVacuous: nonVacuous !== false,
    detail,
  });
};

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-i4xfer-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const seam = await server.ssrLoadModule("/sim/agents/fissionDepartureSeam.ts");
  const prep = await server.ssrLoadModule("/sim/agents/fissionDeparturePreparation.ts");
  const policy = await server.ssrLoadModule("/sim/agents/fissionFieldTransferPolicy.ts");
  const demography = await server.ssrLoadModule("/sim/agents/demography.ts");
  const lc = await server.ssrLoadModule("/sim/agents/bandLifecycle.ts");

  const TABLE = policy.FISSION_FIELD_TRANSFER_POLICY;
  const policyKeys = Object.keys(TABLE);

  // ── T1 — the table covers exactly `keyof Band`, derived from the source, not from the compiler ──
  const sourceFields = parseBandFieldsFromTypes();
  const missing = sourceFields.filter((f) => !policyKeys.includes(f));
  const extra = policyKeys.filter((f) => !sourceFields.includes(f));
  record(
    "T1_policy_covers_every_band_field",
    "every keyof Band parsed from types.ts has exactly one classification, and the table names no field Band does not have",
    missing.length === 0 && extra.length === 0,
    sourceFields.length > 100,
    { bandFieldsInSource: sourceFields.length, classified: policyKeys.length, missing, extra },
  );

  // ── T2 — every entry is a real decision, not a placeholder ──
  const CLASSES = new Set([
    "NEW_SUCCESSOR_IDENTITY", "EXACT_COHORT_TRANSFER", "CURRENT_LINEAGE_PROVENANCE",
    "DEGRADED_OR_PARTIAL_INHERITANCE", "SHARED_HISTORICAL_FACT", "FOUNDER_CARRIED_EMBODIED_BURDEN",
    "RECOMPUTE_FROM_SUCCESSOR_TRUTH", "INVALIDATE_UNTIL_LATER_PHASE", "RESET_ACTIVE_COMMITMENT",
    "REBUILD_READ_MODEL", "LEGACY_COMPATIBILITY_GATED", "FORBIDDEN_TO_COPY",
  ]);
  const badEntries = policyKeys.filter((k) => {
    const e = TABLE[k];
    return !CLASSES.has(e.transferClass) || typeof e.why !== "string" || e.why.trim().length < 20;
  });
  const classHistogram = {};
  for (const k of policyKeys) classHistogram[TABLE[k].transferClass] = (classHistogram[TABLE[k].transferClass] ?? 0) + 1;
  record(
    "T2_every_field_carries_a_class_and_a_reason",
    "each entry names one of the twelve classes and states a reason a reader could not derive from the field name",
    badEntries.length === 0,
    policyKeys.length > 100,
    { badEntries, classHistogram, classesUsed: Object.keys(classHistogram).length },
  );

  // ── T3 — one policy, two consumers: the derived legacy list against the retained literal ──
  const derived = policy.deriveLegacyNonCloneableFields().map(String);
  const literal = demography.DAUGHTER_NON_CLONEABLE_FIELDS_HISTORICAL_LITERAL.map(String);
  const addedByPolicy = derived.filter((f) => !literal.includes(f));
  const droppedByPolicy = literal.filter((f) => !derived.includes(f));
  const EXPECTED_ADDITIONS = ["pendingInvestigation", "recentInvestigationOutcomes"];
  const legacyOverrides = parseLegacyDaughterOverrides();
  // Provably inert: each addition is EXPLICITLY overridden by createDaughterBand, so the guard's
  // `daughter[field] === parentValue` can only hold when parentValue is undefined, which its own
  // first condition already excludes.
  const additionsExplicitlyOverridden = addedByPolicy.every((f) => legacyOverrides.has(f));
  record(
    "T3_derived_legacy_registry_matches_the_retained_literal",
    "the derived registry drops nothing from the literal and adds only fields createDaughterBand already resets explicitly, so consolidating the two policies changes no legacy behaviour",
    droppedByPolicy.length === 0 &&
      addedByPolicy.length === EXPECTED_ADDITIONS.length &&
      EXPECTED_ADDITIONS.every((f) => addedByPolicy.includes(f)) &&
      additionsExplicitlyOverridden,
    literal.length > 50,
    { literalCount: literal.length, derivedCount: derived.length, addedByPolicy, droppedByPolicy, additionsExplicitlyOverridden },
  );

  // ── T4 — published legacy debt, measured lexically against createDaughterBand's own overrides ──
  const debtCandidates = policy.legacyUnregisteredNonTransferableFields().map(String);
  const realDebt = debtCandidates.filter((f) => !legacyOverrides.has(f));
  record(
    "T4_legacy_debt_is_published_not_silently_repaired",
    "fields this policy forbids copying wholesale that createDaughterBand neither registers nor overrides are ENUMERATED as legacy debt; repairing them changes ordinary ecology and needs its own before/after evidence",
    true, // a finding, not a gate
    debtCandidates.length > 0,
    {
      method: "LEXICAL — parsed from createDaughterBand's own object literal; it cannot see a field handled by a helper it calls",
      unregisteredByPolicyClass: debtCandidates.length,
      alsoNotOverriddenByTheLegacyPath: realDebt.length,
      fields: realDebt,
    },
  );

  // ── perform ONE real departure and measure the constructed successor ──
  let world = runner.initSimWorld({ kind: "map2" }, SEED);
  world = advance.advanceWorldByDays(world, WARM_DAYS);
  const parent = Object.values(world.bands)
    .filter((b) => lc.isEstablishedBand(b) && b.demography.workingAdults >= 6 && b.demography.population >= 24)
    .sort((a, b) => b.demography.population - a.demography.population)[0];
  if (parent === undefined) throw new Error("no suitable parent band in the warmed world");

  const dayD = Number(world.time.day ?? 0);
  const requested = Math.max(2, Math.floor(parent.demography.population * 0.35));
  // The whole canonical chain, because a hand-built `departure_ready` record no longer departs.
  const makeDeparture = (successorBandId, lineageId) => prepareAndDepart({
    prep, seam, world, parentId: parent.id, today: dayD,
    lineageId, requestedFounders: requested, targetTileId: String(parent.position), successorBandId,
  }).departure;

  const departure = makeDeparture(`${parent.id}:provisional:1`, "LIN-XFER-1");
  if (departure.ok !== true) throw new Error(`departure refused: ${departure.refusal} ${departure.detail ?? ""}`);
  const successor = departure.world.bands[departure.successorId];
  const transfer = departure.ledger.transfer;

  // ── T5 — the constructed successor satisfies the whole table ──
  const permittedShared = new Set(
    policyKeys.filter((k) => TABLE[k].successorValue === "carried" || TABLE[k].successorValue === "carried_no_relief" || TABLE[k].successorValue === "carried_pending_recompute"),
  );
  const unpermittedShared = transfer.sharedByReferenceFields.filter((f) => !permittedShared.has(f));
  record(
    "T5_constructed_successor_violates_nothing_and_shares_only_what_is_permitted",
    "a real departure produces zero policy violations, and every field still holding the parent's own object is one the table explicitly permits to be carried",
    transfer.policyViolations.length === 0 && unpermittedShared.length === 0,
    transfer.bandFieldsClassified > 100,
    {
      violations: transfer.policyViolations,
      stillTheParentsObject: transfer.fieldsStillHoldingTheParentsObject,
      sharedFields: transfer.sharedByReferenceFields,
      unpermittedShared,
      pendingRecomputeFields: transfer.pendingRecomputeFields,
    },
  );

  // ── T6 — knowledge transfers PARTIALLY, through the canonical helpers ──
  const size = (o) => (o === undefined ? 0 : Object.keys(o).length);
  const knowledge = {
    observedTiles: { parent: size(parent.knowledge?.observedTiles), successor: size(successor.knowledge?.observedTiles) },
    placeMemory: { parent: size(parent.placeMemory), successor: size(successor.placeMemory) },
    travelCorridors: { parent: size(parent.travelCorridors), successor: size(successor.travelCorridors) },
    resourcePatches: { parent: parent.resourceKnowledgeState?.patchMemories?.length ?? 0, successor: successor.resourceKnowledgeState?.patchMemories?.length ?? 0 },
    technologies: { parent: (parent.technologies ?? []).length, successor: (successor.technologies ?? []).length },
  };
  const strictlyPartial = Object.values(knowledge).every((k) => k.successor < k.parent);
  record(
    "T6_knowledge_transfers_partially_not_perfectly",
    "the successor's observed tiles, place memory, corridors, resource patches and technologies are each STRICTLY FEWER than the parent's — a perfect copy would hand it country nobody in it has walked",
    strictlyPartial,
    // non-vacuity: the parent must actually hold each of these, or "fewer" proves nothing
    Object.values(knowledge).every((k) => k.parent > 0),
    knowledge,
  );

  // ── T7 — no free material capability (L3) ──
  const material = {
    storageCapacity: { parent: parent.storageCapacity, successor: successor.storageCapacity },
    expeditions: (successor.expeditions ?? []).length,
    receipts: successor.seasonalFoodReceipts === undefined ? 0 : 1,
    residentialAnchor: successor.residentialAnchor === undefined ? 0 : 1,
    carryingCapacity: successor.carryingCapacity === undefined ? 0 : 1,
    decisionHistory: (successor.decisionHistory ?? []).length,
  };
  record(
    "T7_no_free_material_or_residential_capability",
    "storage is zero rather than the legacy path's hardcoded 0.16, and the successor holds no camp, no catchment, no committed party and no deliberation history",
    successor.storageCapacity === 0 && material.expeditions === 0 && material.receipts === 0 &&
      material.residentialAnchor === 0 && material.carryingCapacity === 0 && material.decisionHistory === 0,
    // non-vacuity: the PARENT must have had these, otherwise their absence is not a transfer decision
    parent.storageCapacity > 0 && parent.residentialAnchor !== undefined && (parent.decisionHistory ?? []).length > 0,
    material,
  );

  // ── T8 — embodied burden travels, re-identified, and never softens ──
  const healthTerms = Object.keys(parent.health ?? {});
  const healthSoftened = healthTerms.filter((t) => successor.health[t] < parent.health[t]);
  const burden = {
    hunger: { parent: parent.hungerPressure, successor: successor.hungerPressure },
    healthTermsCompared: healthTerms.length,
    healthTermsSoftened: healthSoftened,
    acuteRiskPresent: successor.acuteRisk !== undefined,
    acuteRiskBandId: { parent: String(parent.acuteRisk?.bandId ?? "none"), successor: String(successor.acuteRisk?.bandId ?? "none") },
    acuteRiskIsTheParentsObject: successor.acuteRisk === parent.acuteRisk,
  };
  record(
    "T8_embodied_burden_travels_re_identified_and_never_softens",
    "hunger is carried unchanged (the legacy path applies parent x 0.86), no health term falls, and acuteRisk is retained but RE-IDENTIFIED — the parent's object stamps every episode with another band's id",
    successor.hungerPressure >= parent.hungerPressure && healthSoftened.length === 0 &&
      burden.acuteRiskPresent && !burden.acuteRiskIsTheParentsObject &&
      burden.acuteRiskBandId.successor === String(successor.id),
    parent.acuteRisk !== undefined && healthTerms.length > 0,
    burden,
  );

  // ── T9 — identity is genuinely new ──
  const identity = {
    id: { parent: String(parent.id), successor: String(successor.id) },
    name: { parent: parent.name, successor: successor.name },
    color: { parent: parent.color, successor: successor.color },
    position: { parent: String(parent.position), successor: String(successor.position) },
  };
  record(
    "T9_identity_is_new_but_location_is_not",
    "id, name and colour all differ — the seam previously gave the successor the PARENT'S OWN COLOUR, making the two halves indistinguishable at the moment a viewer most needs to tell them apart — while position is deliberately identical, because bodies do not teleport",
    identity.id.parent !== identity.id.successor && identity.name.parent !== identity.name.successor &&
      identity.color.parent !== identity.color.successor && identity.position.parent === identity.position.successor,
    true,
    identity,
  );

  // ── T10 — NEGATIVE CONTROL: the guard catches a laundered field in every enforcing class ──
  const negatives = [];
  const tryLaunder = (field, value, label) => {
    const laundered = { ...successor, [field]: value };
    const found = policy.auditSuccessorTransfer(parent, laundered);
    negatives.push({ label, field, caught: found.length > 0, defect: found[0]?.defect ?? null });
  };
  tryLaunder("residentialAnchor", parent.residentialAnchor, "INVALIDATE_UNTIL_LATER_PHASE: the parent's camp");
  tryLaunder("decisionHistory", parent.decisionHistory, "FORBIDDEN_TO_COPY: the parent's deliberations");
  tryLaunder("contactMemories", parent.contactMemories, "FORBIDDEN_TO_COPY: the parent's social world");
  tryLaunder("storageCapacity", 0.16, "INVALIDATE_UNTIL_LATER_PHASE: the legacy path's free storage");
  tryLaunder("hungerPressure", parent.hungerPressure * 0.86, "FOUNDER_CARRIED: the legacy path's 14% hunger relief");
  tryLaunder("health", { ...parent.health, injuryBurden: 0 }, "FOUNDER_CARRIED: curing an injury by splitting");
  tryLaunder("knowledge", parent.knowledge, "DEGRADED: a perfect copy of the parent's knowledge");
  tryLaunder("color", parent.color, "NEW_SUCCESSOR_IDENTITY: the parent's own colour");
  record(
    "T10_negative_control_the_guard_catches_a_laundered_field_in_every_enforcing_class",
    "deliberately re-introducing each historical defect into an otherwise valid successor is CAUGHT by the same function the seam gates on — so the zero in T5 is a real zero and not an insensitive instrument",
    negatives.every((n) => n.caught),
    negatives.length >= 8,
    { cases: negatives },
  );

  // ── T11 — resets are driven BY CLASSIFICATION, so a new field cannot bypass the seam ──
  const absentByPolicy = policyKeys.filter((k) => TABLE[k].successorValue === "absent");
  const absentButPresent = absentByPolicy.filter((k) => successor[k] !== undefined);
  const emptyByPolicy = policyKeys.filter((k) => TABLE[k].successorValue === "empty_array" || TABLE[k].successorValue === "empty_record");
  const notEmpty = emptyByPolicy.filter((k) => {
    const v = successor[k];
    return v === undefined || (Array.isArray(v) ? v.length > 0 : Object.keys(v).length > 0);
  });
  const resets = policy.buildPolicyStructuralResets();
  record(
    "T11_structural_resets_come_from_the_table_not_from_a_hand_written_list",
    "every field classified absent/empty is reset on the constructed successor, and the reset object is produced from the table itself — so classifying a NEW field resets it with no edit to the departure seam at all",
    absentButPresent.length === 0 && notEmpty.length === 0 && Object.keys(resets).length === absentByPolicy.length + emptyByPolicy.length + policyKeys.filter((k) => TABLE[k].successorValue === "zero").length,
    absentByPolicy.length > 20 && emptyByPolicy.length > 3,
    { absentByPolicy: absentByPolicy.length, absentButPresent, emptyByPolicy: emptyByPolicy.length, notEmpty, resetKeys: Object.keys(resets).length },
  );

  // ── T12 — determinism ──
  const again = makeDeparture(`${parent.id}:provisional:1`, "LIN-XFER-1");
  if (again.ok !== true) throw new Error("second departure refused");
  const digest = (b) => JSON.stringify(b, (k, v) => (v === undefined ? "<undefined>" : v));
  record(
    "T12_the_constructed_successor_is_deterministic",
    "two identical departure requests produce a byte-identical successor",
    digest(again.world.bands[again.successorId]) === digest(successor),
    digest(successor).length > 1000,
    { successorDigestLength: digest(successor).length },
  );

  out = {
    generatedAt: new Date().toISOString(),
    seed: SEED,
    warmDays: WARM_DAYS,
    parentId: String(parent.id),
    successorId: String(departure.successorId),
    summary: {
      fixtures: fixtures.length,
      passing: fixtures.filter((f) => f.verdict === "PASS").length,
      failing: fixtures.filter((f) => f.verdict === "FAIL").length,
      vacuous: fixtures.filter((f) => f.verdict === "VACUOUS").length,
      bandFieldsClassified: policyKeys.length,
      fieldsStillHoldingTheParentsObject: transfer.fieldsStillHoldingTheParentsObject,
    },
    transferLedger: transfer,
    classHistogram,
    fixtures,
  };
} finally {
  await server.close();
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify(out.summary, null, 2));
for (const f of out.fixtures) console.log(`${f.verdict.padEnd(7)} ${f.id}`);
if (out.summary.failing > 0 || out.summary.vacuous > 0) process.exitCode = 1;
