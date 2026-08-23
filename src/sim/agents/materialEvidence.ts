// ROADMAP ITEM 5 PASS 4 — temporary physical-evidence → human-material-belief adapter.
//
// This seam may translate observations already available to the band into
// weak human technical beliefs. It never grants quantities, ownership,
// artifacts, recipes or competence. Future material-substrate work replaces
// this provider without replacing the canonical HumanMaterialBelief state.

import type { TickNumber } from "../core/types";
import type { MaterialBeliefSignal } from "./compositionalInvention";
import type { FragmentResidenceContext, FragmentSignal } from "./practicalFragments";

export interface MaterialBeliefEvidenceInput {
  readonly bandId: string;
  readonly currentTick: TickNumber;
  readonly localContextKey: string;
  readonly residenceContext?: FragmentResidenceContext;
  readonly fragmentSignals: readonly FragmentSignal[];
}

function signal(
  materialCategory: string,
  publicLabel: string,
  properties: MaterialBeliefSignal["properties"],
  confidence: number,
  evidenceRef: string,
  contextKey: string,
  handlingDepth: MaterialBeliefSignal["handlingDepth"],
  provenance: MaterialBeliefSignal["provenance"] = "lived",
): MaterialBeliefSignal {
  return { materialCategory, publicLabel, properties, confidence, evidenceRef, contextKey, handlingDepth, provenance };
}

/**
 * Bounded adapter over evidence already gathered by Item 5 / existing
 * observation channels. No full-map lookup and no material availability scan.
 */
export function deriveMaterialBeliefSignals(input: MaterialBeliefEvidenceInput): readonly MaterialBeliefSignal[] {
  const output: MaterialBeliefSignal[] = [];
  const context = input.residenceContext;

  // A lived wooded residence is enough for a weak encounter claim about woody
  // plant material. It is NOT resin, cordage, frame-building or shaft-making.
  if (context?.isWoodedContext === true) {
    output.push(signal(
      "encountered_woody_plant",
      "woody plant material encountered around this place",
      ["structural_load", "formability_workability"],
      0.26,
      `observed_context:${context.tileId}:woody_plant`,
      input.localContextKey,
      "encountered",
      "inferred",
    ));
  }

  for (const fragment of input.fragmentSignals) {
    const depth = fragment.inferred === true ? "encountered" as const : "handled" as const;
    switch (fragment.subject) {
      case "fiber_cordage":
        output.push(signal(
          "worked_plant_fiber",
          "worked plant fiber",
          ["tensile_fibrous", "interlacing_twisting", "flexibility"],
          fragment.signal,
          fragment.evidenceRef,
          fragment.contextKey,
          depth,
          fragment.inferred === true ? "inferred" : "lived",
        ));
        break;
      case "load_binding":
      case "binding_under_load":
        output.push(signal(
          "handled_binding_material",
          "handled binding material",
          ["tensile_fibrous", "flexibility"],
          fragment.signal,
          fragment.evidenceRef,
          fragment.contextKey,
          fragment.inferred === true ? "encountered" : "transformed_tested",
          fragment.inferred === true ? "inferred" : "lived",
        ));
        break;
      case "buoyancy_under_load":
        output.push(signal(
          "tested_floating_bundle_material",
          "material tested while carrying a load on water",
          ["structural_load", "durability_weathering"],
          fragment.signal,
          fragment.evidenceRef,
          fragment.contextKey,
          "transformed_tested",
        ));
        break;
      case "pit_support":
        output.push(signal(
          "tested_pit_support_material",
          "material used while supporting a dug wall",
          ["structural_load", "durability_weathering"],
          fragment.signal,
          fragment.evidenceRef,
          fragment.contextKey,
          "transformed_tested",
        ));
        break;
      case "plant_preparation":
        output.push(signal(
          "handled_preparation_plant",
          "plant material handled during preparation",
          ["formability_workability", "heat_response"],
          fragment.signal,
          fragment.evidenceRef,
          fragment.contextKey,
          fragment.inferred === true ? "handled" : "transformed_tested",
          fragment.inferred === true ? "inferred" : "lived",
        ));
        break;
      default:
        break;
    }
  }

  // Deterministic de-duplication. Several legitimate observations of the same
  // category remain separate signals only when they carry a different evidence
  // reference; the belief merger owns bounded evidence retention.
  return output
    .filter((entry, index, all) => all.findIndex((other) =>
      other.materialCategory === entry.materialCategory && other.evidenceRef === entry.evidenceRef) === index)
    .sort((a, b) => a.materialCategory.localeCompare(b.materialCategory) || a.evidenceRef.localeCompare(b.evidenceRef));
}
