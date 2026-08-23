// ROADMAP ITEM 5 PASS 4 — bounded compositional invention substrate.
// Human-known inputs only: practical problems/history, technical fragments,
// human material beliefs and inherited/revision hints. This module has no
// world, terrain or physical-stock authority.

import type { TickNumber } from "../core/types";
import type {
  HumanMaterialBelief,
  HumanMaterialBeliefProvenance,
  HumanMaterialHandlingDepth,
  NormalizedPracticalDesignHypothesis,
  PracticalDesignComponentRole,
  PracticalDesignHint,
  PracticalDesignOperationStep,
  PracticalDeploymentClass,
  PracticalFeedbackClass,
  PracticalFragment,
  PracticalFunctionalIntent,
  PracticalIdeaCandidate,
  PracticalIdeaSource,
  PracticalMaterialOperation,
  PracticalMaterialProperty,
  PracticalMaterialRoleBinding,
  PracticalObservedFeedback,
  PracticalProblemFamily,
  PracticalProblemFrame,
  PracticalResponseFamily,
  PracticalRevisionLesson,
} from "./types";

export const MATERIAL_BELIEF_CAP = 12;
export const MATERIAL_EVIDENCE_REF_CAP = 3;
export const MATERIAL_CONTEXT_CAP = 3;
export const DESIGN_HINT_CAP = 8;
export const REVISION_LESSON_CAP = 8;
export const RAW_CANDIDATE_PER_PROBLEM_CAP = 6;
export const RAW_CANDIDATE_GLOBAL_CAP = 18;
export const SHORTLIST_PER_PROBLEM_CAP = 3;

export const MATERIAL_PROPERTY_REGISTRY = [
  "edge_fracture", "impact_toughness", "abrasion", "flexibility", "tensile_fibrous",
  "interlacing_twisting", "structural_load", "formability_workability", "porosity_water_barrier",
  "coating_binding", "heat_response", "durability_weathering",
] as const satisfies readonly PracticalMaterialProperty[];

export const MATERIAL_OPERATION_REGISTRY = [
  "split", "abrade", "grind", "pound", "twist", "bind", "interlace", "layer",
  "coat", "heat", "dry", "soak", "haft", "brace", "dig", "line",
] as const satisfies readonly PracticalMaterialOperation[];

export interface MaterialBeliefSignal {
  readonly materialCategory: string;
  readonly publicLabel: string;
  readonly properties: readonly PracticalMaterialProperty[];
  readonly confidence: number;
  readonly evidenceRef: string;
  readonly contextKey: string;
  readonly provenance: HumanMaterialBeliefProvenance;
  readonly handlingDepth: HumanMaterialHandlingDepth;
}

export interface DesignHypothesisInput {
  readonly functionalIntent: PracticalFunctionalIntent;
  readonly mechanism: string;
  readonly componentRoles: readonly PracticalDesignComponentRole[];
  readonly operations: readonly PracticalDesignOperationStep[];
  readonly deploymentClass: PracticalDeploymentClass;
  readonly publicLabel: string;
}

export interface LocalReproducibility {
  readonly status: "supported" | "blocked" | "unknown";
  readonly bindings: readonly PracticalMaterialRoleBinding[];
  readonly missingRoles: readonly string[];
  readonly contextLimitedRoles: readonly string[];
}

export interface CompositionalCandidate {
  readonly family: PracticalResponseFamily;
  readonly persistenceVariantKey: string;
  readonly templateVariantKey?: string;
  readonly publicLabel: string;
  readonly mechanismBelief: string;
  readonly design: NormalizedPracticalDesignHypothesis;
  readonly fragmentIds: readonly string[];
  readonly materialBindings: readonly PracticalMaterialRoleBinding[];
  readonly score: number;
  readonly basisFloor: number;
  readonly source: PracticalIdeaSource;
  readonly localReproducibility: LocalReproducibility["status"];
  readonly changedDimension?: PracticalRevisionLesson["changedDimension"];
  readonly provenance: {
    readonly bandId: string;
    readonly problemId: string;
    readonly sourceKind: PracticalIdeaSource;
    readonly fragmentIds: readonly string[];
    readonly materialBeliefIds: readonly string[];
    readonly evidenceRefs: readonly string[];
    readonly priorIdeaId?: string;
    readonly designHintId?: string;
  };
}

export interface CandidateSet {
  readonly raw: readonly CompositionalCandidate[];
  readonly shortlist: readonly CompositionalCandidate[];
  readonly rawConsidered: number;
}

interface CandidateBlueprint extends DesignHypothesisInput {
  readonly id: string;
  readonly family: PracticalResponseFamily;
  readonly intent: PracticalFunctionalIntent;
  readonly requiredFragments: readonly string[];
  readonly optionalFragments?: readonly string[];
  readonly templateVariantKey?: string;
  readonly basisFloor: number;
}

function clamp01(value: number): number { return value < 0 ? 0 : value > 1 ? 1 : value; }
function round2(value: number): number { return Math.round(value * 100) / 100; }
function uniqSorted(values: readonly string[]): readonly string[] { return [...new Set(values)].sort((a, b) => a.localeCompare(b)); }
function fnv1a(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  hash ^= hash >>> 16; hash = Math.imul(hash, 2246822519); hash ^= hash >>> 13;
  return hash >>> 0;
}
function keyedUnit(key: string): number { return fnv1a(key) / 4294967295; }

function canonicalRoles(roles: readonly PracticalDesignComponentRole[]): readonly PracticalDesignComponentRole[] {
  return roles.map((entry) => ({
    role: entry.role, form: entry.form,
    requiredProperties: uniqSorted(entry.requiredProperties) as readonly PracticalMaterialProperty[],
  })).sort((a, b) => a.role.localeCompare(b.role) || a.form.localeCompare(b.form));
}
function canonicalOperations(operations: readonly PracticalDesignOperationStep[]): readonly PracticalDesignOperationStep[] {
  return operations.map((step) => ({
    id: step.id, operation: step.operation, inputRoles: uniqSorted(step.inputRoles), dependsOn: uniqSorted(step.dependsOn),
  })).sort((a, b) => a.id.localeCompare(b.id) || a.operation.localeCompare(b.operation));
}

export function normalizeDesignHypothesis(input: DesignHypothesisInput): NormalizedPracticalDesignHypothesis {
  const componentRoles = canonicalRoles(input.componentRoles);
  const operations = canonicalOperations(input.operations);
  const identity = JSON.stringify({ functionalIntent: input.functionalIntent, mechanism: input.mechanism, componentRoles, operations, deploymentClass: input.deploymentClass });
  return {
    signature: `design:${fnv1a(identity).toString(16).padStart(8, "0")}`,
    functionalIntent: input.functionalIntent, mechanism: input.mechanism, componentRoles, operations,
    deploymentClass: input.deploymentClass, publicLabel: input.publicLabel,
  };
}

function materialBeliefId(bandId: string, category: string): string { return `material-belief:${bandId}:${category}`; }
function depthRank(depth: HumanMaterialHandlingDepth): number { return depth === "transformed_tested" ? 3 : depth === "handled" ? 2 : 1; }

export function advanceHumanMaterialBeliefs(input: {
  readonly bandId: string;
  readonly prior: readonly HumanMaterialBelief[];
  readonly signals: readonly MaterialBeliefSignal[];
  readonly protectedBeliefIds: readonly string[];
  readonly currentTick: TickNumber;
}): readonly HumanMaterialBelief[] {
  const byId = new Map(input.prior.map((belief) => [belief.id, belief]));
  for (const signal of input.signals) {
    if (signal.confidence < 0.18 || signal.properties.length === 0) continue;
    const id = materialBeliefId(input.bandId, signal.materialCategory);
    const existing = byId.get(id);
    const properties = new Map((existing?.properties ?? []).map((property) => [property.property, property]));
    for (const property of signal.properties) {
      const priorProperty = properties.get(property);
      properties.set(property, {
        property,
        confidence: round2(clamp01((priorProperty?.confidence ?? 0.12) + signal.confidence * (priorProperty === undefined ? 0.5 : 0.18))),
        evidenceRefs: [signal.evidenceRef, ...(priorProperty?.evidenceRefs ?? []).filter((ref) => ref !== signal.evidenceRef)].slice(0, MATERIAL_EVIDENCE_REF_CAP),
        contradictionRefs: (priorProperty?.contradictionRefs ?? []).slice(0, MATERIAL_EVIDENCE_REF_CAP),
      });
    }
    const priorDepth = existing?.handlingDepth ?? "encountered";
    byId.set(id, {
      id, materialCategory: signal.materialCategory, publicLabel: signal.publicLabel,
      properties: [...properties.values()].sort((a, b) => a.property.localeCompare(b.property)),
      knownContexts: [signal.contextKey, ...(existing?.knownContexts ?? []).filter((key) => key !== signal.contextKey)].slice(0, MATERIAL_CONTEXT_CAP),
      provenance: existing !== undefined && existing.provenance !== "inherited" && existing.provenance !== "copied" ? existing.provenance : signal.provenance,
      handlingDepth: depthRank(signal.handlingDepth) >= depthRank(priorDepth) ? signal.handlingDepth : priorDepth,
      contradictionRefs: (existing?.contradictionRefs ?? []).slice(0, MATERIAL_EVIDENCE_REF_CAP),
      lastReinforcedTick: input.currentTick,
      originalContext: existing?.originalContext ?? { contextKey: signal.contextKey, sourceBandId: input.bandId as never },
    });
  }
  const protectedIds = new Set(input.protectedBeliefIds);
  const tick = Number(input.currentTick);
  return [...byId.values()].sort((a, b) => {
    const protectedGap = Number(protectedIds.has(b.id)) - Number(protectedIds.has(a.id));
    if (protectedGap !== 0) return protectedGap;
    const depthGap = depthRank(b.handlingDepth) - depthRank(a.handlingDepth); if (depthGap !== 0) return depthGap;
    const confidence = (belief: HumanMaterialBelief) => Math.max(0, ...belief.properties.map((property) => property.confidence));
    const score = (belief: HumanMaterialBelief) => confidence(belief) * 0.75 + Math.max(0, 1 - Math.max(0, tick - Number(belief.lastReinforcedTick)) / 40) * 0.25;
    return score(b) - score(a) || a.id.localeCompare(b.id);
  }).slice(0, MATERIAL_BELIEF_CAP);
}

export function inheritMaterialBeliefsForDaughter(parent: readonly HumanMaterialBelief[], daughterBandId: string, parentBandId: string, currentTick: TickNumber): readonly HumanMaterialBelief[] {
  return [...parent].sort((a, b) => Math.max(...b.properties.map((p) => p.confidence), 0) - Math.max(...a.properties.map((p) => p.confidence), 0) || a.id.localeCompare(b.id))
    .slice(0, 8).map((belief) => ({
      ...belief, id: materialBeliefId(daughterBandId, belief.materialCategory), provenance: "inherited" as const,
      properties: belief.properties.map((property) => ({ ...property, confidence: round2(property.confidence * 0.62), evidenceRefs: [`inherited:${parentBandId}:${belief.id}`] })),
      lastReinforcedTick: currentTick,
      originalContext: { ...belief.originalContext, inheritedFromBandId: parentBandId as never },
    }));
}

function roleBinding(role: PracticalDesignComponentRole, beliefs: readonly HumanMaterialBelief[], localContextKey: string): PracticalMaterialRoleBinding | undefined {
  if (role.requiredProperties.length === 0) return undefined;
  const matches = beliefs.filter((belief) => role.requiredProperties.every((required) => belief.properties.some((property) => property.property === required && property.confidence >= 0.24)))
    .sort((a, b) => Number(b.knownContexts.includes(localContextKey)) - Number(a.knownContexts.includes(localContextKey)) || a.id.localeCompare(b.id));
  const match = matches[0];
  return match === undefined ? undefined : { role: role.role, materialBeliefId: match.id, requiredProperties: role.requiredProperties, localSupport: match.knownContexts.includes(localContextKey) ? "supported" : "context_unproven" };
}

export function deriveLocalReproducibility(design: NormalizedPracticalDesignHypothesis, beliefs: readonly HumanMaterialBelief[], localContextKey: string): LocalReproducibility {
  if (design.deploymentClass === "practice_only") return { status: "supported", bindings: [], missingRoles: [], contextLimitedRoles: [] };
  const materialRoles = design.componentRoles.filter((entry) => entry.requiredProperties.length > 0);
  const bindings = materialRoles.flatMap((entry) => { const binding = roleBinding(entry, beliefs, localContextKey); return binding === undefined ? [] : [binding]; });
  const bound = new Set(bindings.map((entry) => entry.role));
  const missingRoles = materialRoles.filter((entry) => !bound.has(entry.role)).map((entry) => entry.role);
  const contextLimitedRoles = bindings.filter((entry) => entry.localSupport === "context_unproven").map((entry) => entry.role);
  return { status: missingRoles.length > 0 ? "unknown" : contextLimitedRoles.length > 0 ? "blocked" : "supported", bindings, missingRoles, contextLimitedRoles };
}

const role = (name: string, form: string, properties: readonly PracticalMaterialProperty[]): PracticalDesignComponentRole => ({ role: name, form, requiredProperties: properties });
const op = (id: string, operation: PracticalMaterialOperation, inputRoles: readonly string[], dependsOn: readonly string[] = []): PracticalDesignOperationStep => ({ id, operation, inputRoles, dependsOn });
const NO_ROLES: readonly PracticalDesignComponentRole[] = [];
const NO_OPS: readonly PracticalDesignOperationStep[] = [];

function template(input: Omit<CandidateBlueprint, "id"> & { readonly templateVariantKey: string }): CandidateBlueprint {
  return { ...input, id: `template:${input.templateVariantKey}` };
}
function generic(input: Omit<CandidateBlueprint, "id" | "templateVariantKey"> & { readonly id: string }): CandidateBlueprint { return input; }

// Historical names are compatibility/template labels only; generic primitives
// below are an independent bounded possibility source.
export const HISTORICAL_VARIANT_BLUEPRINTS: readonly CandidateBlueprint[] = [
  template({ templateVariantKey: "fiber_sling", family: "carrying_load", intent: "load_transport", functionalIntent: "load_transport", mechanism: "distributed_tension", publicLabel: "fiber sling and wrap carrying response", deploymentClass: "portable_material_construction", componentRoles: [role("support", "flexible_band", ["tensile_fibrous", "flexibility"])], operations: [op("twist", "twist", ["support"]), op("bind", "bind", ["support"], ["twist"])], requiredFragments: ["fiber_cordage"], basisFloor: 0.25 }),
  template({ templateVariantKey: "load_staging", family: "carrying_load", intent: "load_transport", functionalIntent: "load_transport", mechanism: "staged_load_distribution", publicLabel: "staged-load carrying response", deploymentClass: "practice_only", componentRoles: NO_ROLES, operations: NO_OPS, requiredFragments: ["load_staging"], basisFloor: 0.25 }),
  template({ templateVariantKey: "carrying_frame", family: "carrying_load", intent: "load_transport", functionalIntent: "load_transport", mechanism: "rigid_frame_load_distribution", publicLabel: "rough carrying-frame response", deploymentClass: "portable_material_construction", componentRoles: [role("frame", "braced_frame", ["structural_load", "formability_workability"]), role("binding", "lashings", ["tensile_fibrous"])], operations: [op("brace", "brace", ["frame"]), op("bind", "bind", ["frame", "binding"], ["brace"])], requiredFragments: ["fiber_cordage", "load_binding"], basisFloor: 0.5 }),
  template({ templateVariantKey: "stage_known_water", family: "dry_route_water", intent: "water_access_transport", functionalIntent: "water_access_transport", mechanism: "route_staging_between_known_water", publicLabel: "stage travel between remembered watered places", deploymentClass: "practice_only", componentRoles: NO_ROLES, operations: NO_OPS, requiredFragments: ["watered_route_reading"], basisFloor: 0.25 }),
  template({ templateVariantKey: "crude_bundle_float", family: "engineering_structure", intent: "route_crossing_transport", functionalIntent: "route_crossing_transport", mechanism: "bound_buoyant_bundle", publicLabel: "crude bound-bundle crossing response", deploymentClass: "temporary_structure_or_work", componentRoles: [role("body", "bundle", ["structural_load"]), role("binding", "lashings", ["tensile_fibrous"])], operations: [op("bind", "bind", ["body", "binding"])], requiredFragments: ["buoyancy_under_load", "binding_under_load", "staged_shuttle_crossing"], basisFloor: 0.25 }),
  template({ templateVariantKey: "braced_load_raft", family: "engineering_structure", intent: "route_crossing_transport", functionalIntent: "route_crossing_transport", mechanism: "braced_buoyant_load_distribution", publicLabel: "braced load-distributing crossing response", deploymentClass: "temporary_structure_or_work", componentRoles: [role("body", "distributed_bundle", ["structural_load"]), role("binding", "lashings", ["tensile_fibrous"])], operations: [op("brace", "brace", ["body"]), op("bind", "bind", ["body", "binding"], ["brace"])], requiredFragments: ["buoyancy_under_load", "binding_under_load", "load_distribution", "staged_shuttle_crossing"], basisFloor: 0.5 }),
  template({ templateVariantKey: "membrane_water_bag", family: "water_storage", intent: "containment_storage_transport", functionalIntent: "containment_storage_transport", mechanism: "folded_flexible_barrier", publicLabel: "plugged membrane water bag", deploymentClass: "portable_material_construction", componentRoles: [role("barrier", "folded_membrane", ["flexibility", "porosity_water_barrier"])], operations: [op("layer", "layer", ["barrier"]), op("bind", "bind", ["barrier"], ["layer"])], requiredFragments: ["membrane_folding"], basisFloor: 0.25 }),
  template({ templateVariantKey: "woven_lined_carrier", family: "water_storage", intent: "containment_storage_transport", functionalIntent: "containment_storage_transport", mechanism: "interlaced_container_with_lining", publicLabel: "woven lined water carrier", deploymentClass: "portable_material_construction", componentRoles: [role("body", "interlaced_body", ["interlacing_twisting", "tensile_fibrous"]), role("lining", "flexible_lining", ["flexibility", "porosity_water_barrier"])], operations: [op("twist", "twist", ["body"]), op("interlace", "interlace", ["body"], ["twist"]), op("line", "line", ["body", "lining"], ["interlace"])], requiredFragments: ["container_holding", "fiber_cordage"], basisFloor: 0.25 }),
  template({ templateVariantKey: "sealed_water_carrier", family: "water_storage", intent: "containment_storage_transport", functionalIntent: "containment_storage_transport", mechanism: "coated_seam_barrier", publicLabel: "gum-sealed water carrier", deploymentClass: "portable_material_construction", componentRoles: [role("body", "worked_container", ["interlacing_twisting"]), role("coating", "seam_coating", ["coating_binding", "heat_response", "porosity_water_barrier"])], operations: [op("heat", "heat", ["coating"]), op("coat", "coat", ["body", "coating"], ["heat"])], requiredFragments: ["container_holding", "seal_coating"], basisFloor: 0.5 }),
  template({ templateVariantKey: "seep_scrape", family: "groundwater_seek", intent: "water_access_transport", functionalIntent: "water_access_transport", mechanism: "shallow_groundwater_access", publicLabel: "scraped seep hollow", deploymentClass: "place_bound_work", componentRoles: NO_ROLES, operations: [op("dig", "dig", [])], requiredFragments: ["groundwater_reading"], basisFloor: 0.25 }),
  template({ templateVariantKey: "lined_seep_pit", family: "groundwater_seek", intent: "water_access_transport", functionalIntent: "water_access_transport", mechanism: "supported_groundwater_access", publicLabel: "lined and deepened seep pit", deploymentClass: "place_bound_work", componentRoles: [role("lining", "wall_lining", ["structural_load", "durability_weathering"])], operations: [op("dig", "dig", []), op("line", "line", ["lining"], ["dig"])], requiredFragments: ["groundwater_reading", "pit_support"], basisFloor: 0.5 }),
  template({ templateVariantKey: "brush_windbreak", family: "temporary_shelter", intent: "shelter_environmental_protection", functionalIntent: "shelter_environmental_protection", mechanism: "weather_side_barrier", publicLabel: "brush windbreak", deploymentClass: "temporary_structure_or_work", componentRoles: [role("barrier", "banked_brush", ["structural_load"])], operations: [op("layer", "layer", ["barrier"])], requiredFragments: ["camp_ground_reading"], basisFloor: 0.25 }),
  template({ templateVariantKey: "shade_screen", family: "temporary_shelter", intent: "shelter_environmental_protection", functionalIntent: "shelter_environmental_protection", mechanism: "raised_shade_barrier", publicLabel: "raised shade screen", deploymentClass: "temporary_structure_or_work", componentRoles: [role("cover", "layered_cover", ["flexibility", "durability_weathering"])], operations: [op("layer", "layer", ["cover"])], requiredFragments: ["cover_layering"], basisFloor: 0.25 }),
  template({ templateVariantKey: "covered_rain_shelter", family: "temporary_shelter", intent: "shelter_environmental_protection", functionalIntent: "shelter_environmental_protection", mechanism: "braced_frame_shedding_cover", publicLabel: "framed and covered rain shelter", deploymentClass: "temporary_structure_or_work", componentRoles: [role("frame", "braced_frame", ["structural_load", "formability_workability"]), role("cover", "layered_cover", ["flexibility", "durability_weathering"])], operations: [op("brace", "brace", ["frame"]), op("layer", "layer", ["frame", "cover"], ["brace"])], requiredFragments: ["cover_layering", "frame_shaping"], basisFloor: 0.5 }),
  template({ templateVariantKey: "thrown_reach_hunting", family: "hunting_distance", intent: "hunting_trapping_capture", functionalIntent: "hunting_trapping_capture", mechanism: "thrown_reach", publicLabel: "trued throwing-shaft hunting", deploymentClass: "portable_material_construction", componentRoles: [role("shaft", "straight_shaft", ["structural_load", "formability_workability"])], operations: [op("abrade", "abrade", ["shaft"])], requiredFragments: ["shaft_truing"], basisFloor: 0.25 }),
  template({ templateVariantKey: "hafted_point_hunting", family: "hunting_distance", intent: "hunting_trapping_capture", functionalIntent: "hunting_trapping_capture", mechanism: "hafted_piercing_reach", publicLabel: "gum-hafted point hunting", deploymentClass: "portable_material_construction", componentRoles: [role("shaft", "shaft", ["structural_load", "formability_workability"]), role("point", "point", ["edge_fracture", "impact_toughness"]), role("binding", "joint", ["tensile_fibrous", "coating_binding"])], operations: [op("haft", "haft", ["shaft", "point", "binding"])], requiredFragments: ["shaft_truing", "seal_coating"], basisFloor: 0.5 }),
  template({ templateVariantKey: "tensioned_snare_line", family: "hunting_distance", intent: "hunting_trapping_capture", functionalIntent: "hunting_trapping_capture", mechanism: "tension_trigger_capture", publicLabel: "tensioned snare lines", deploymentClass: "temporary_structure_or_work", componentRoles: [role("line", "tension_line", ["tensile_fibrous", "flexibility"])], operations: [op("twist", "twist", ["line"]), op("bind", "bind", ["line"], ["twist"])], requiredFragments: ["fiber_cordage", "tension_release"], basisFloor: 0.5 }),
  template({ templateVariantKey: "wound_binding_care", family: "care_treatment", intent: "care_treatment", functionalIntent: "care_treatment", mechanism: "clean_bind_rest", publicLabel: "cleaned and bound wound care", deploymentClass: "portable_material_construction", componentRoles: [role("binding", "wound_wrap", ["tensile_fibrous", "flexibility"])], operations: [op("bind", "bind", ["binding"])], requiredFragments: ["wound_care"], basisFloor: 0.25 }),
  template({ templateVariantKey: "plant_poultice_care", family: "care_treatment", intent: "care_treatment", functionalIntent: "care_treatment", mechanism: "prepared_plant_application", publicLabel: "prepared plant poultice care", deploymentClass: "portable_material_construction", componentRoles: [role("preparation", "plant_mass", ["formability_workability", "heat_response"])], operations: [op("pound", "pound", ["preparation"]), op("heat", "heat", ["preparation"], ["pound"])], requiredFragments: ["wound_care", "plant_preparation"], basisFloor: 0.5 }),
  template({ templateVariantKey: "load_tally_reckoning", family: "proto_measure", intent: "measurement_marking_pacing", functionalIntent: "measurement_marking_pacing", mechanism: "one_to_one_mark_matching", publicLabel: "load-and-vessel tally reckoning", deploymentClass: "practice_only", componentRoles: NO_ROLES, operations: NO_OPS, requiredFragments: ["one_to_one_count"], basisFloor: 0.25 }),
  template({ templateVariantKey: "journey_pacing_reckoning", family: "proto_measure", intent: "measurement_marking_pacing", functionalIntent: "measurement_marking_pacing", mechanism: "day_stage_reckoning", publicLabel: "day-stage journey reckoning", deploymentClass: "practice_only", componentRoles: NO_ROLES, operations: NO_OPS, requiredFragments: ["journey_pacing", "one_to_one_count"], basisFloor: 0.5 }),
];

const GENERIC_BLUEPRINTS: readonly CandidateBlueprint[] = [
  generic({ id: "generic:flexible-carry", family: "carrying_load", intent: "load_transport", functionalIntent: "load_transport", mechanism: "flexible_load_distribution", publicLabel: "distributed flexible carrying hypothesis", deploymentClass: "portable_material_construction", componentRoles: [role("support", "flexible_support", ["tensile_fibrous", "flexibility"])], operations: [op("twist", "twist", ["support"]), op("bind", "bind", ["support"], ["twist"])], requiredFragments: ["load_binding"], basisFloor: 0.25 }),
  generic({ id: "generic:rigid-carry", family: "carrying_load", intent: "load_transport", functionalIntent: "load_transport", mechanism: "rigid_load_distribution", publicLabel: "rigid load-support hypothesis", deploymentClass: "portable_material_construction", componentRoles: [role("frame", "rigid_support", ["structural_load", "formability_workability"])], operations: [op("brace", "brace", ["frame"])], requiredFragments: ["load_binding"], basisFloor: 0.25 }),
  generic({ id: "generic:flexible-container", family: "water_storage", intent: "containment_storage_transport", functionalIntent: "containment_storage_transport", mechanism: "flexible_containment", publicLabel: "flexible containment hypothesis", deploymentClass: "portable_material_construction", componentRoles: [role("body", "flexible_body", ["flexibility", "porosity_water_barrier"])], operations: [op("layer", "layer", ["body"]), op("bind", "bind", ["body"], ["layer"])], requiredFragments: ["container_holding"], basisFloor: 0.25 }),
  generic({ id: "generic:interlaced-container", family: "water_storage", intent: "containment_storage_transport", functionalIntent: "containment_storage_transport", mechanism: "interlaced_containment", publicLabel: "interlaced containment hypothesis", deploymentClass: "portable_material_construction", componentRoles: [role("body", "interlaced_body", ["interlacing_twisting", "tensile_fibrous"])], operations: [op("twist", "twist", ["body"]), op("interlace", "interlace", ["body"], ["twist"])], requiredFragments: [], optionalFragments: ["container_holding"], basisFloor: 0.24 }),
  generic({ id: "generic:weather-barrier", family: "temporary_shelter", intent: "shelter_environmental_protection", functionalIntent: "shelter_environmental_protection", mechanism: "braced_weather_barrier", publicLabel: "braced weather-barrier hypothesis", deploymentClass: "temporary_structure_or_work", componentRoles: [role("frame", "braced_frame", ["structural_load"]), role("cover", "flexible_cover", ["flexibility", "durability_weathering"])], operations: [op("brace", "brace", ["frame"]), op("layer", "layer", ["frame", "cover"], ["brace"])], requiredFragments: ["camp_ground_reading"], basisFloor: 0.25 }),
  generic({ id: "generic:worked-edge", family: "hunting_distance", intent: "cut_scrape_pierce_pound_grind_dig", functionalIntent: "cut_scrape_pierce_pound_grind_dig", mechanism: "worked_edge", publicLabel: "worked-edge hypothesis", deploymentClass: "portable_material_construction", componentRoles: [role("edge", "worked_edge", ["edge_fracture", "abrasion"])], operations: [op("split", "split", ["edge"]), op("abrade", "abrade", ["edge"], ["split"])], requiredFragments: [], basisFloor: 0.24 }),
  generic({ id: "generic:hafted-reach", family: "hunting_distance", intent: "hunting_trapping_capture", functionalIntent: "hunting_trapping_capture", mechanism: "hafted_reach", publicLabel: "hafted reach hypothesis", deploymentClass: "portable_material_construction", componentRoles: [role("shaft", "shaft", ["structural_load", "formability_workability"]), role("point", "point", ["edge_fracture", "impact_toughness"]), role("binding", "joint", ["tensile_fibrous"])], operations: [op("haft", "haft", ["shaft", "point", "binding"])], requiredFragments: [], optionalFragments: ["binding_under_load"], basisFloor: 0.28 }),
  generic({ id: "generic:lined-dig", family: "groundwater_seek", intent: "water_access_transport", functionalIntent: "water_access_transport", mechanism: "lined_excavation", publicLabel: "lined excavation hypothesis", deploymentClass: "place_bound_work", componentRoles: [role("lining", "wall_lining", ["structural_load", "durability_weathering"])], operations: [op("dig", "dig", []), op("line", "line", ["lining"], ["dig"])], requiredFragments: ["groundwater_reading"], basisFloor: 0.25 }),
  generic({ id: "generic:prepared-care", family: "care_treatment", intent: "care_treatment", functionalIntent: "care_treatment", mechanism: "prepared_application", publicLabel: "prepared treatment hypothesis", deploymentClass: "portable_material_construction", componentRoles: [role("preparation", "worked_material", ["formability_workability"])], operations: [op("pound", "pound", ["preparation"])], requiredFragments: ["wound_care"], basisFloor: 0.25 }),
  generic({ id: "generic:mark-pace", family: "proto_measure", intent: "measurement_marking_pacing", functionalIntent: "measurement_marking_pacing", mechanism: "mark_and_stage_comparison", publicLabel: "mark-and-stage reckoning hypothesis", deploymentClass: "practice_only", componentRoles: NO_ROLES, operations: NO_OPS, requiredFragments: ["one_to_one_count"], optionalFragments: ["journey_pacing"], basisFloor: 0.25 }),
];

const PROBLEM_INTENTS: Readonly<Record<PracticalProblemFamily, readonly PracticalFunctionalIntent[]>> = {
  carrying_burden: ["load_transport", "containment_storage_transport"],
  water_route_shortage: ["water_access_transport", "containment_storage_transport", "measurement_marking_pacing"],
  camp_water_shortage: ["water_access_transport", "cut_scrape_pierce_pound_grind_dig"],
  vessel_water_loss: ["containment_storage_transport"],
  camp_exposure: ["shelter_environmental_protection"],
  hunting_danger: ["hunting_trapping_capture", "cut_scrape_pierce_pound_grind_dig"],
  sickness_injury: ["care_treatment", "food_material_processing_preservation"],
  journey_misjudgment: ["measurement_marking_pacing", "water_access_transport", "load_transport"],
  crossing_blocked: ["route_crossing_transport", "load_transport"],
};

function fragmentStrength(fragment: PracticalFragment, currentTick: number): number {
  const age = Math.max(0, currentTick - Number(fragment.lastReinforcedTick));
  const freshness = clamp01(1 - Math.max(0, age - 8) / 24);
  const failure = clamp01(1 - fragment.failureCount * 0.15);
  const transmission = fragment.basis === "lived" ? 1 : 0.7;
  return round2(fragment.strength * freshness * failure * transmission);
}

function supportForBlueprint(
  blueprint: CandidateBlueprint,
  fragments: readonly PracticalFragment[],
  beliefs: readonly HumanMaterialBelief[],
  localContextKey: string,
  currentTick: number,
): { readonly compatible: boolean; readonly score: number; readonly fragmentIds: readonly string[]; readonly reproduction: LocalReproducibility } {
  const design = normalizeDesignHypothesis(blueprint);
  const reproduction = deriveLocalReproducibility(design, beliefs, localContextKey);
  const required = blueprint.requiredFragments.map((subject) =>
    fragments.filter((fragment) => fragment.subject === subject)
      .sort((a, b) => fragmentStrength(b, currentTick) - fragmentStrength(a, currentTick) || a.id.localeCompare(b.id))[0]);
  const requiredPresent = required.every((entry) => entry !== undefined && fragmentStrength(entry, currentTick) >= blueprint.basisFloor);
  const requiredIds = required.filter((entry): entry is PracticalFragment => entry !== undefined).map((entry) => entry.id);
  const optional = (blueprint.optionalFragments ?? []).flatMap((subject) => {
    const found = fragments.find((fragment) => fragment.subject === subject);
    return found === undefined ? [] : [found];
  });
  const fragmentBasis = required.length === 0
    ? optional.length === 0 ? 0.28 : Math.max(...optional.map((entry) => fragmentStrength(entry, currentTick)))
    : requiredPresent
      ? Math.min(...required.filter((entry): entry is PracticalFragment => entry !== undefined).map((entry) => fragmentStrength(entry, currentTick)))
      : 0;
  const materialRoles = design.componentRoles.filter((entry) => entry.requiredProperties.length > 0);
  const materialSupported = materialRoles.length === 0 || reproduction.bindings.length > 0;
  const localBonus = reproduction.status === "supported" ? 0.12 : reproduction.status === "blocked" ? -0.08 : -0.14;
  return {
    compatible: requiredPresent && materialSupported,
    score: round2(clamp01(fragmentBasis * 0.58 + Math.min(0.32, reproduction.bindings.length * 0.11) + localBonus + 0.18)),
    fragmentIds: uniqSorted([...requiredIds, ...optional.map((entry) => entry.id)]),
    reproduction,
  };
}

function sourceFor(
  fragments: readonly PracticalFragment[],
  fragmentIds: readonly string[],
  beliefs: readonly HumanMaterialBelief[],
  bindings: readonly PracticalMaterialRoleBinding[],
  hint: PracticalDesignHint | undefined,
): PracticalIdeaSource {
  if (hint?.source === "inherited") return "inherited";
  if (hint?.source === "copied") return "copied";
  const usedFragments = fragments.filter((fragment) => fragmentIds.includes(fragment.id));
  if (usedFragments.some((fragment) => fragment.basis === "inherited")) return "inherited";
  if (usedFragments.some((fragment) => fragment.basis === "copied")) return "copied";
  const usedBeliefs = beliefs.filter((belief) => bindings.some((binding) => binding.materialBeliefId === belief.id));
  if (usedBeliefs.some((belief) => belief.provenance === "inherited")) return "inherited";
  if (usedBeliefs.some((belief) => belief.provenance === "copied")) return "copied";
  if (usedBeliefs.some((belief) => belief.provenance === "inferred") ||
      usedFragments.some((fragment) => fragment.evidenceRefs.some((ref) => ref.startsWith("accidental:")))) return "accident";
  if (usedFragments.length + usedBeliefs.length >= 2) return "recombination";
  return "local_inference";
}

function lessonPenalty(signature: string, lessons: readonly PracticalRevisionLesson[], currentTick: number): number {
  return lessons.reduce((sum, lesson) => {
    if (lesson.designSignature !== signature) return sum;
    const fade = clamp01(1 - Math.max(0, currentTick - Number(lesson.lastReinforcedTick)) / 32);
    return sum + lesson.strength * fade * (lesson.status === "dormant" ? 0.2 : 0.32);
  }, 0);
}

function revisedDesign(parent: NormalizedPracticalDesignHypothesis, dimension: PracticalRevisionLesson["changedDimension"]): NormalizedPracticalDesignHypothesis {
  if (dimension === undefined || dimension === "material_binding") return parent;
  switch (dimension) {
    case "joining":
      return normalizeDesignHypothesis({ ...parent, operations: [...parent.operations, op("revision-brace", "brace", parent.componentRoles.slice(0, 1).map((entry) => entry.role))] });
    case "operation":
      return normalizeDesignHypothesis({ ...parent, operations: [...parent.operations, op("revision-abrade", "abrade", parent.componentRoles.slice(0, 1).map((entry) => entry.role))] });
    case "component":
      return normalizeDesignHypothesis({ ...parent, componentRoles: parent.componentRoles.map((entry, index) => index === 0 ? { ...entry, form: `${entry.form}_reinforced` } : entry) });
    case "scale":
      return normalizeDesignHypothesis({ ...parent, mechanism: `${parent.mechanism}:reduced_scale_trial` });
    case "deployment":
      return normalizeDesignHypothesis({ ...parent, deploymentClass: parent.deploymentClass === "portable_material_construction" ? "temporary_structure_or_work" : parent.deploymentClass });
  }
}

function revisionCandidates(input: {
  readonly bandId: string;
  readonly runSeed: string;
  readonly problem: PracticalProblemFrame;
  readonly fragments: readonly PracticalFragment[];
  readonly materialBeliefs: readonly HumanMaterialBelief[];
  readonly priorIdeas: readonly PracticalIdeaCandidate[];
  readonly revisionLessons: readonly PracticalRevisionLesson[];
  readonly currentTick: number;
  readonly localContextKey: string;
}): readonly CompositionalCandidate[] {
  const lessons = input.revisionLessons
    .filter((lesson) => lesson.problemFamily === input.problem.family && lesson.status === "active")
    .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id));
  const output: CompositionalCandidate[] = [];
  for (const lesson of lessons.slice(0, 2)) {
    const parent = input.priorIdeas.find((idea) => idea.designSignature === lesson.designSignature && idea.design !== undefined);
    if (parent?.design === undefined) continue;
    const design = revisedDesign(parent.design, lesson.changedDimension);
    const reproduction = deriveLocalReproducibility(design, input.materialBeliefs, input.localContextKey);
    const materialRequired = design.deploymentClass !== "practice_only";
    if (materialRequired && reproduction.bindings.length === 0) continue;
    const evidenceRefs = uniqSorted([parent.id, lesson.id, ...lesson.evidenceRefs, ...reproduction.bindings.map((entry) => entry.materialBeliefId)]).slice(0, 8);
    const novelty = keyedUnit(`${input.runSeed}:${input.bandId}:${input.problem.id}:${design.signature}:revision:${evidenceRefs.join("|")}`) * 0.03;
    output.push({
      family: parent.family,
      persistenceVariantKey: design.signature === parent.design.signature ? parent.variantKey : `composed:${design.signature.slice("design:".length)}`,
      publicLabel: `revision of ${parent.publicLabel}`,
      mechanismBelief: design.mechanism,
      design,
      fragmentIds: parent.basisFragmentIds,
      materialBindings: reproduction.bindings,
      score: round2(clamp01(parent.basisScore * 0.72 + input.problem.severity * 0.12 + novelty)),
      basisFloor: 0.24,
      source: "revision",
      localReproducibility: reproduction.status,
      ...(lesson.changedDimension === undefined ? {} : { changedDimension: lesson.changedDimension }),
      provenance: {
        bandId: input.bandId,
        problemId: input.problem.id,
        sourceKind: "revision",
        fragmentIds: parent.basisFragmentIds,
        materialBeliefIds: uniqSorted(reproduction.bindings.map((entry) => entry.materialBeliefId)),
        evidenceRefs,
        priorIdeaId: parent.id,
      },
    });
  }
  return output;
}

export function generateCompositionalCandidateSet(input: {
  readonly bandId: string;
  readonly runSeed: string;
  readonly problem: PracticalProblemFrame;
  readonly fragments: readonly PracticalFragment[];
  readonly materialBeliefs: readonly HumanMaterialBelief[];
  readonly priorIdeas: readonly PracticalIdeaCandidate[];
  readonly designHints: readonly PracticalDesignHint[];
  readonly revisionLessons: readonly PracticalRevisionLesson[];
  readonly currentTick: number;
  readonly localContextKey: string;
  readonly rawBudget?: number;
}): CandidateSet {
  const intents = PROBLEM_INTENTS[input.problem.family];
  const maxRaw = Math.max(0, Math.min(input.rawBudget ?? RAW_CANDIDATE_PER_PROBLEM_CAP, RAW_CANDIDATE_PER_PROBLEM_CAP, RAW_CANDIDATE_GLOBAL_CAP));
  const raw: CompositionalCandidate[] = [...revisionCandidates(input)].slice(0, maxRaw);
  const seenSignatures = new Set(raw.map((entry) => entry.design.signature));
  const blueprints = [...HISTORICAL_VARIANT_BLUEPRINTS, ...GENERIC_BLUEPRINTS]
    .filter((entry) => intents.includes(entry.intent))
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const blueprint of blueprints) {
    if (raw.length >= maxRaw) break;
    const design = normalizeDesignHypothesis(blueprint);
    if (seenSignatures.has(design.signature)) continue;
    const support = supportForBlueprint(blueprint, input.fragments, input.materialBeliefs, input.localContextKey, input.currentTick);
    const hint = input.designHints.find((entry) => entry.designSignature === design.signature || entry.mechanism === design.mechanism);
    if (!support.compatible && hint === undefined) continue;
    const evidenceSource = sourceFor(input.fragments, support.fragmentIds, input.materialBeliefs, support.reproduction.bindings, hint);
    const source = blueprint.templateVariantKey !== undefined && hint === undefined &&
      (evidenceSource === "local_inference" || evidenceSource === "recombination")
      ? "template_recognition" as const
      : evidenceSource;
    const evidenceRefs = uniqSorted([
      ...input.problem.evidenceRefs,
      ...support.fragmentIds,
      ...support.reproduction.bindings.map((entry) => entry.materialBeliefId),
      ...(hint === undefined ? [] : [hint.id]),
    ]).slice(0, 8);
    const novelty = keyedUnit(`${input.runSeed}:${input.bandId}:${input.problem.id}:${Math.floor(input.currentTick / 4)}:${design.signature}:${source}:${evidenceRefs.join("|")}`) * 0.04;
    const score = round2(clamp01(
      support.score + input.problem.severity * 0.12 + (hint?.confidence ?? 0) * 0.08 + novelty - lessonPenalty(design.signature, input.revisionLessons, input.currentTick),
    ));
    raw.push({
      family: blueprint.family,
      persistenceVariantKey: blueprint.templateVariantKey ?? `composed:${design.signature.slice("design:".length)}`,
      ...(blueprint.templateVariantKey === undefined ? {} : { templateVariantKey: blueprint.templateVariantKey }),
      publicLabel: blueprint.publicLabel,
      mechanismBelief: blueprint.mechanism,
      design,
      fragmentIds: support.fragmentIds,
      materialBindings: support.reproduction.bindings,
      score,
      basisFloor: blueprint.basisFloor,
      source,
      localReproducibility: support.reproduction.status,
      provenance: {
        bandId: input.bandId,
        problemId: input.problem.id,
        sourceKind: source,
        fragmentIds: support.fragmentIds,
        materialBeliefIds: uniqSorted(support.reproduction.bindings.map((entry) => entry.materialBeliefId)),
        evidenceRefs,
        ...(hint === undefined ? {} : { designHintId: hint.id }),
      },
    });
    seenSignatures.add(design.signature);
  }
  const ranked = raw.sort((a, b) => b.score - a.score || a.design.signature.localeCompare(b.design.signature));
  return { raw: ranked, shortlist: ranked.slice(0, SHORTLIST_PER_PROBLEM_CAP), rawConsidered: ranked.length };
}

export function generateCompositionalCandidates(input: Parameters<typeof generateCompositionalCandidateSet>[0]): readonly CompositionalCandidate[] {
  return generateCompositionalCandidateSet(input).shortlist;
}

function adjustFragment(fragment: PracticalFragment, delta: number, failure: boolean): PracticalFragment {
  return {
    ...fragment,
    strength: round2(clamp01(fragment.strength + delta)),
    failureCount: fragment.failureCount + (failure ? 1 : 0),
    contradictionCount: (fragment.contradictionCount ?? 0) + (failure ? 1 : 0),
    knowledgeState: failure && fragment.strength + delta < 0.25 ? "contradicted" : fragment.knowledgeState,
  };
}

function adjustBelief(belief: HumanMaterialBelief, delta: number, feedback: PracticalObservedFeedback, currentTick: TickNumber): HumanMaterialBelief {
  const failure = delta < 0;
  return {
    ...belief,
    properties: belief.properties.map((property) => ({
      ...property,
      confidence: round2(clamp01(property.confidence + delta)),
      evidenceRefs: failure ? property.evidenceRefs : [...feedback.evidenceRefs, ...property.evidenceRefs].slice(0, MATERIAL_EVIDENCE_REF_CAP),
      contradictionRefs: failure ? [...feedback.evidenceRefs, ...property.contradictionRefs].slice(0, MATERIAL_EVIDENCE_REF_CAP) : property.contradictionRefs,
    })),
    contradictionRefs: failure ? [...feedback.evidenceRefs, ...belief.contradictionRefs].slice(0, MATERIAL_EVIDENCE_REF_CAP) : belief.contradictionRefs,
    lastReinforcedTick: failure ? belief.lastReinforcedTick : currentTick,
  };
}

export function applyTypedFeedback(input: {
  readonly fragments: readonly PracticalFragment[];
  readonly materialBeliefs: readonly HumanMaterialBelief[];
  readonly feedback: PracticalObservedFeedback;
  readonly currentTick: TickNumber;
}): { readonly fragments: readonly PracticalFragment[]; readonly materialBeliefs: readonly HumanMaterialBelief[]; readonly designConfidenceDelta: number } {
  const feedback = input.feedback;
  if (feedback.attributionQuality === "unknown" || feedback.attributionQuality === "design_level") {
    return {
      fragments: input.fragments,
      materialBeliefs: input.materialBeliefs,
      designConfidenceDelta: feedback.feedbackClass === "context_specific_success" ? 0.08 : feedback.feedbackClass === "partial_success" ? 0.03 : -0.12,
    };
  }
  const failure = feedback.feedbackClass !== "partial_success" && feedback.feedbackClass !== "context_specific_success";
  const fragmentDelta = failure ? -0.08 : feedback.feedbackClass === "partial_success" ? 0.025 : 0.05;
  const materialDelta = failure ? -0.09 : feedback.feedbackClass === "partial_success" ? 0.02 : 0.045;
  const fragmentIds = new Set(feedback.implicatedFragmentIds);
  const beliefIds = new Set(feedback.implicatedMaterialBeliefIds);
  return {
    fragments: input.fragments.map((entry) => fragmentIds.has(entry.id) ? adjustFragment(entry, fragmentDelta, failure) : entry),
    materialBeliefs: input.materialBeliefs.map((entry) => beliefIds.has(entry.id) ? adjustBelief(entry, materialDelta, feedback, input.currentTick) : entry),
    designConfidenceDelta: failure ? -0.1 : feedback.feedbackClass === "partial_success" ? 0.035 : 0.08,
  };
}

export function feedbackClassChangedDimension(feedbackClass: PracticalFeedbackClass): PracticalRevisionLesson["changedDimension"] {
  switch (feedbackClass) {
    case "material_property_mismatch":
    case "acquisition_material_unavailable": return "material_binding";
    case "joining_construction_failure": return "joining";
    case "transformation_process_failure": return "operation";
    case "durability_maintenance_failure": return "component";
    case "environmental_mismatch": return "deployment";
    case "functional_underperformance": return "scale";
    default: return undefined;
  }
}

export function recordRevisionLesson(input: {
  readonly prior: readonly PracticalRevisionLesson[];
  readonly problemFamily: PracticalProblemFamily;
  readonly feedback: PracticalObservedFeedback;
  readonly currentTick: TickNumber;
}): readonly PracticalRevisionLesson[] {
  if (input.feedback.feedbackClass === "partial_success" || input.feedback.feedbackClass === "context_specific_success") return input.prior.slice(0, REVISION_LESSON_CAP);
  const id = `revision-lesson:${input.problemFamily}:${input.feedback.designSignature}:${input.feedback.feedbackClass}`;
  const existing = input.prior.find((entry) => entry.id === id);
  const changedDimension = feedbackClassChangedDimension(input.feedback.feedbackClass);
  const lesson: PracticalRevisionLesson = {
    id,
    designSignature: input.feedback.designSignature,
    problemFamily: input.problemFamily,
    feedbackClass: input.feedback.feedbackClass,
    confidence: round2(clamp01((existing?.confidence ?? 0.35) + 0.12)),
    strength: round2(clamp01((existing?.strength ?? 0.35) + 0.1)),
    ...(changedDimension === undefined ? {} : { changedDimension }),
    evidenceRefs: uniqSorted([...input.feedback.evidenceRefs, ...(existing?.evidenceRefs ?? [])]).slice(0, MATERIAL_EVIDENCE_REF_CAP),
    status: "active",
    lastReinforcedTick: input.currentTick,
  };
  return [lesson, ...input.prior.filter((entry) => entry.id !== id)]
    .map((entry) => Number(input.currentTick) - Number(entry.lastReinforcedTick) >= 32 ? { ...entry, status: "dormant" as const, strength: round2(entry.strength * 0.7) } : entry)
    .sort((a, b) => Number(b.status === "active") - Number(a.status === "active") || b.strength - a.strength || a.id.localeCompare(b.id))
    .slice(0, REVISION_LESSON_CAP);
}

export function deriveDesignHintsFromIdeas(ideas: readonly PracticalIdeaCandidate[], prior: readonly PracticalDesignHint[], currentTick: TickNumber): readonly PracticalDesignHint[] {
  const bySignature = new Map(prior.map((hint) => [hint.designSignature, hint]));
  for (const idea of ideas) {
    if (idea.design === undefined || idea.designSignature === undefined || idea.status === "rejected") continue;
    const existing = bySignature.get(idea.designSignature);
    bySignature.set(idea.designSignature, {
      id: existing?.id ?? `design-hint:${idea.designSignature}`,
      designSignature: idea.designSignature,
      functionalIntent: idea.design.functionalIntent,
      mechanism: idea.design.mechanism,
      source: idea.source === "inherited" ? "inherited" : idea.source === "copied" ? "copied" : "lived",
      confidence: round2(clamp01(Math.max(existing?.confidence ?? 0, idea.basisScore * 0.85))),
      sourceContextKey: existing?.sourceContextKey,
      sourceBandId: existing?.sourceBandId,
      lastReinforcedTick: currentTick,
    });
  }
  return [...bySignature.values()].sort((a, b) => b.confidence - a.confidence || a.id.localeCompare(b.id)).slice(0, DESIGN_HINT_CAP);
}

export function inheritDesignHintsForDaughter(parentHints: readonly PracticalDesignHint[], daughterBandId: string, parentBandId: string, currentTick: TickNumber): readonly PracticalDesignHint[] {
  return [...parentHints].sort((a, b) => b.confidence - a.confidence || a.id.localeCompare(b.id)).slice(0, 5).map((hint) => ({
    ...hint,
    id: `design-hint:${daughterBandId}:${hint.designSignature}`,
    source: "inherited" as const,
    confidence: round2(hint.confidence * 0.58),
    sourceBandId: parentBandId as never,
    lastReinforcedTick: currentTick,
  }));
}
