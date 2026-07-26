// CORRECTION-21 continuation §13 — PLACE EVIDENCE READ MODEL.
//
// The epistemic distinctions this correction introduced are causal: a shallow traversal now
// writes materially different `KnownTileRecord` contents from a residential observation, and
// downstream readers behave differently as a result. §13 requires that any such distinction
// be visible in a selected-band projection rather than existing only inside audit JSON.
//
// STRICT PROJECTION CONTRACT:
//   - derives ONLY from canonical band state (`band.knowledge.observedTiles`);
//   - never reads `world.tiles` ecology, so it cannot leak hidden truth into the UI;
//   - never mutates and is never read by any decision path;
//   - distinguishes UNKNOWN (the band has no record of this domain) from LOW CONFIDENCE
//     (the band has a weak record), which are different epistemic states and must not
//     render identically;
//   - names the uses a record does and does not authorise, with the reason.
//
// It takes the world only for tile identity/coordinates so distances can be reported; it
// reads no resource, seasonal or hydrological truth from it.
import type { TileId } from "../core/types";
import type { KnownTileRecord, KnowledgeAcquisitionKind } from "../knowledge/types";
import { getTile } from "../world/generate";
import type { WorldState } from "../world/types";
import type { Band } from "./types";

/** How well a single evidence domain is established for one place. */
export type PlaceEvidenceStrength =
  // The band holds no record for this domain at all — distinct from "weak".
  | "unknown"
  // Seen in passing; a coarse impression only.
  | "glimpsed"
  // Physically established by being there.
  | "observed"
  // Established and corroborated by repeated experience.
  | "experienced";

export interface PlaceEvidenceDomain {
  readonly domain:
    | "terrain_existence"
    | "passability"
    | "water_presence"
    | "water_reliability"
    | "resource_presence"
    | "risk"
    | "seasonal_coverage"
    | "residential_adequacy";
  readonly strength: PlaceEvidenceStrength;
  /** What the band actually holds, in words. Never a hidden-truth number. */
  readonly basis: string;
}

export interface PlaceEvidenceEntry {
  readonly tileId: TileId;
  readonly distanceTiles?: number;
  readonly acquisition: KnowledgeAcquisitionKind;
  readonly provenance: string;
  readonly visits: number;
  readonly seasonsObserved: number;
  readonly generalConfidence: number;
  readonly domains: readonly PlaceEvidenceDomain[];
  /** Uses this record supports, and uses it explicitly does not. */
  readonly permittedUses: readonly string[];
  readonly blockedUses: readonly { readonly use: string; readonly reason: string }[];
  /** Whether better evidence has already upgraded this record. */
  readonly upgradedFromTraversal: boolean;
}

export interface PlaceEvidenceProjection {
  readonly totalKnownPlaces: number;
  readonly byAcquisition: Readonly<Record<string, number>>;
  readonly shallowTraversalPlaces: number;
  readonly residentiallyKnownPlaces: number;
  /** Bounded sample, farthest-first, so frontier country is what the panel shows. */
  readonly entries: readonly PlaceEvidenceEntry[];
  readonly noHiddenTruthRead: true;
  readonly projectionOnly: true;
}

const MAX_ENTRIES = 24;

const PROVENANCE_LABEL: Readonly<Record<string, string>> = {
  residential_observation: "lived in or worked from",
  returned_frontier_exploration: "walked through by an exploring party",
  returned_route_reconnaissance: "walked through on a route reading",
  inherited_memory: "inherited from the parent band",
  reported_or_inferred: "reported or inferred, never seen",
};

function isShallow(acquisition: KnowledgeAcquisitionKind | undefined): boolean {
  return (
    acquisition === "returned_frontier_exploration" ||
    acquisition === "returned_route_reconnaissance"
  );
}

function strengthFromVisits(visits: number, shallow: boolean): PlaceEvidenceStrength {
  if (shallow) {
    return visits >= 3 ? "observed" : "glimpsed";
  }

  return visits >= 4 ? "experienced" : "observed";
}

function describeDomains(record: KnownTileRecord): readonly PlaceEvidenceDomain[] {
  const shallow = isShallow(record.acquisition);
  const visits = record.visits ?? 0;
  const base = strengthFromVisits(visits, shallow);
  const seasons = record.seasonsObserved?.length ?? 0;

  return [
    {
      domain: "terrain_existence",
      strength: base === "glimpsed" ? "observed" : base,
      basis: "the band has physically been here",
    },
    {
      domain: "passability",
      strength: record.observedMovementCost === undefined ? "unknown" : base === "glimpsed" ? "observed" : base,
      basis:
        record.observedMovementCost === undefined
          ? "no crossing recorded"
          : "walked; the going is known from experience",
    },
    {
      domain: "water_presence",
      strength: record.observedWaterAccess === undefined ? "unknown" : shallow ? "glimpsed" : base,
      basis:
        record.observedWaterAccess === undefined
          ? "no water observation"
          : shallow
            ? "water seen in passing; a coarse impression only"
            : "water observed from use of this place",
    },
    {
      domain: "water_reliability",
      // Reliability is NEVER established by traversal — it needs repeated seasons.
      strength: shallow || seasons < 2 ? "unknown" : seasons >= 3 ? "experienced" : "observed",
      basis:
        shallow || seasons < 2
          ? "not established — reliability needs repeated seasonal experience"
          : `observed across ${seasons} seasons`,
    },
    {
      domain: "resource_presence",
      strength: record.observedRichness === undefined ? "unknown" : shallow ? "glimpsed" : base,
      basis: shallow
        ? "broad impression of how lush the country looked in passing"
        : "productivity known from working this place",
    },
    {
      domain: "risk",
      strength: record.observedRisk === undefined ? "unknown" : shallow ? "glimpsed" : base,
      basis: shallow
        ? "terrain hazard visible on one crossing; an uneventful passage is not proof of safety"
        : "hazard known from repeated presence",
    },
    {
      domain: "seasonal_coverage",
      strength:
        record.observedSeasonalPattern === undefined ? "unknown" : seasons >= 3 ? "experienced" : "observed",
      basis:
        record.observedSeasonalPattern === undefined
          ? "no seasonal knowledge — the place has only been crossed"
          : `seasonal pattern held from ${seasons} observed season(s)`,
    },
    {
      domain: "residential_adequacy",
      strength: shallow ? "unknown" : base,
      basis: shallow
        ? "not established — passing through is not living here"
        : "the band has camped or dwelt here",
    },
  ];
}

function describeUses(record: KnownTileRecord): {
  readonly permitted: readonly string[];
  readonly blocked: readonly { readonly use: string; readonly reason: string }[];
} {
  const shallow = isShallow(record.acquisition);

  if (!shallow) {
    return {
      permitted: [
        "route planning",
        "resource expectation",
        "water planning",
        "camp and anchor choice",
        "seasonal planning",
        "daughter destination evaluation",
      ],
      blocked: [],
    };
  }

  return {
    permitted: [
      "route planning and further exploration",
      "knowing this country exists and roughly what it looks like",
    ],
    blocked: [
      { use: "confident resource exploitation", reason: "no resource was tested or harvested here" },
      { use: "water reliability planning", reason: "water was seen, not used across seasons" },
      { use: "seasonal planning", reason: "the place was crossed in one season only" },
      { use: "camp or residential anchoring", reason: "passing through is not residential experience" },
    ],
  };
}

/**
 * Build the selected-band place-evidence projection. Pure, bounded, and behaviourally inert.
 */
export function derivePlaceEvidenceProjection(
  world: WorldState,
  band: Band,
): PlaceEvidenceProjection {
  const records = Object.values(band.knowledge.observedTiles);
  const here = getTile(world, band.position);
  const byAcquisition: Record<string, number> = {};
  let shallowCount = 0;
  let residentialCount = 0;

  for (const record of records) {
    const key = String(record.acquisition ?? "unspecified");
    byAcquisition[key] = (byAcquisition[key] ?? 0) + 1;

    if (isShallow(record.acquisition)) {
      shallowCount += 1;
    } else if (record.acquisition === "residential_observation") {
      residentialCount += 1;
    }
  }

  const distanceOf = (tileId: TileId): number | undefined => {
    const tile = getTile(world, tileId);

    return tile === undefined || here === undefined
      ? undefined
      : Math.abs(tile.coord.x - here.coord.x) + Math.abs(tile.coord.y - here.coord.y);
  };

  // Farthest-first: the interesting rows are the frontier ones, and the panel is bounded.
  const entries = [...records]
    .sort((left, right) => {
      const dl = distanceOf(left.tileId) ?? 0;
      const dr = distanceOf(right.tileId) ?? 0;

      return dr === dl ? String(left.tileId).localeCompare(String(right.tileId)) : dr - dl;
    })
    .slice(0, MAX_ENTRIES)
    .map((record): PlaceEvidenceEntry => {
      const uses = describeUses(record);
      const distance = distanceOf(record.tileId);

      return {
        tileId: record.tileId,
        ...(distance === undefined ? {} : { distanceTiles: distance }),
        acquisition: record.acquisition ?? "residential_observation",
        provenance: PROVENANCE_LABEL[String(record.acquisition)] ?? String(record.acquisition),
        visits: record.visits ?? 0,
        seasonsObserved: record.seasonsObserved?.length ?? 0,
        generalConfidence: record.confidence,
        domains: describeDomains(record),
        permittedUses: uses.permitted,
        blockedUses: uses.blocked,
        // A record that is residentially acquired but was first reached by a party carries
        // the upgrade; the writer's provenance rule keeps residential once earned.
        upgradedFromTraversal:
          record.acquisition === "residential_observation" && (record.visits ?? 0) > 1,
      };
    });

  return {
    totalKnownPlaces: records.length,
    byAcquisition,
    shallowTraversalPlaces: shallowCount,
    residentiallyKnownPlaces: residentialCount,
    entries,
    noHiddenTruthRead: true,
    projectionOnly: true,
  };
}
