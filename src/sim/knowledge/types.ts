import type {
  BandId,
  RegionId,
  RouteId,
  Season,
  SettlementId,
  TickNumber,
  TileId,
  WorldTime,
} from "../core/types";
import type { FrontierVerificationQuestion, WaterAccessFailureKind } from "../agents/types";

export type ContactKind =
  | "direct"
  | "tracks"
  | "smoke"
  | "rumor"
  | "refugee"
  | "artifact";

export type RumorSubject =
  | "tile"
  | "band"
  | "settlement"
  | "route"
  | "risk"
  | "resource";

export interface TileObservation {
  readonly tileId: TileId;
  readonly observedAt: WorldTime;
  readonly season: Season;
  readonly observedRichness: number;
  readonly observedAquaticPotential: number;
  readonly observedRisk: number;
  readonly observerBandId?: BandId;
}

export interface ObservedSeasonalPattern {
  readonly peakSeasons: readonly Season[];
  readonly leanSeasons: readonly Season[];
  readonly reliability: number;
  readonly confidence: number;
}

export type KnowledgeSourceKind =
  | "personally_observed"
  | "physically_seen_on_spawn"
  | "inherited_memory"
  | "inherited_rumor"
  | "inherited_route_hint";

/**
 * CORRECTION-18 §8 — HOW a known tile record was acquired.
 *
 * Distinct from `KnowledgeSourceKind`, which answers "whose knowledge is this" (mine vs
 * inherited vs rumour). This answers "by what physical act did it enter the band's
 * knowledge", which `KnowledgeSourceKind` cannot express: a residential observation and a
 * tile glimpsed once by a returning exploratory party are BOTH `personally_observed`, yet
 * they are epistemically very different — one is lived country the band works every
 * season, the other is a single traversal by two people who walked past it.
 *
 * It is a typed field rather than a reason-id substring search (§8 forbids the latter
 * where a typed field will do). It carries NO physical truth and never changes what a
 * tile is; it exists to
 *   - audit which downstream consumers read shallow-traversal knowledge,
 *   - let confidence and retention treat traversal and residence differently,
 *   - support bounded, purpose-aware memory compression (§14).
 */
export type KnowledgeAcquisitionKind =
  // Observed from the residential camp / ordinary same-day range. Lived country.
  | "residential_observation"
  // Walked once by a returning frontier-exploration party (§12 shallow traversal).
  | "returned_frontier_exploration"
  // Walked by a returning route-reconnaissance party (a known route, re-read).
  | "returned_route_reconnaissance"
  // Carried from a parent band at fission.
  | "inherited_memory"
  // Second-hand report or bounded inference; never personally stood upon.
  | "reported_or_inferred";

export interface KnownTileRecord {
  readonly tileId: TileId;
  readonly firstObservedAt: WorldTime;
  readonly lastObservedAt: WorldTime;
  readonly seasonsObserved: readonly Season[];
  readonly visits: number;
  readonly observedRichness: number;
  /**
   * CORRECTION-23D §6 — THE DURABLE VERIFICATION DISPOSITION, attached to the place it is
   * about.
   *
   * Retry memory lived on the band before this: first a 12-entry display ring, then a
   * 48-entry evidence collection. Both were CAPS, and a cap that evicts silently turns
   * "we settled this" back into "we have never asked" — measured at 18.1% of all launches,
   * with the cap under pressure on 75.3% of band-days.
   *
   * A conclusion about a PLACE belongs to the band's record OF that place. This is sparse
   * (only attempted places carry it), bounded (at most one entry per question), and it is
   * forgotten exactly when the place itself is forgotten — which is the only thing that
   * should ever make a settled question genuinely unknown again.
   */
  readonly verificationDisposition?: readonly PlaceQuestionDisposition[];
  readonly observedWaterAccess?: number;
  readonly observedAquaticPotential: number;
  readonly observedMovementCost?: number;
  readonly observedRisk?: number;
  readonly observedStorageSuitability?: number;
  readonly observedSeasonalPattern?: ObservedSeasonalPattern;
  readonly confidence: number;
  readonly knowledgeSource: KnowledgeSourceKind;
  /**
   * CORRECTION-18 §8 — how this record was physically acquired. Optional so every
   * pre-existing record and every snapshot written before this checkpoint stays valid;
   * absent is read as `residential_observation` (the historical default).
   */
  readonly acquisition?: KnowledgeAcquisitionKind;
}

export type MemoryInfluenceMode = "decision_relevant" | "ui_debug_only";

export type BroadWaterRole =
  | "river"
  | "coast"
  | "lake"
  | "wetland"
  | "dry"
  | "unknown";

export interface CompressedKnownTileSummary {
  readonly id: string;
  readonly tileCount: number;
  readonly sourceKnowledgeTypes: readonly KnowledgeSourceKind[];
  readonly confidence: number;
  readonly lastObservedAt: WorldTime;
  readonly seasonsObserved: readonly Season[];
  readonly broadTerrainRoles: readonly string[];
  readonly broadWaterRoles: readonly BroadWaterRole[];
  readonly canInfluenceDecisions: boolean;
  readonly influenceMode: MemoryInfluenceMode;
}

export interface KnownAreaSummary {
  readonly id: string;
  readonly tileCount: number;
  readonly sourceKnowledgeTypes: readonly KnowledgeSourceKind[];
  readonly confidence: number;
  readonly lastObservedAt: WorldTime;
  readonly seasonsObserved: readonly Season[];
  readonly broadTerrainRoles: readonly string[];
  readonly broadWaterRoles: readonly BroadWaterRole[];
  readonly canInfluenceDecisions: boolean;
  readonly influenceMode: MemoryInfluenceMode;
}

export interface KnownBandRecord {
  readonly bandId?: BandId;
  readonly firstObservedAt: WorldTime;
  readonly lastObservedAt: WorldTime;
  readonly confidence: number;
  readonly estimatedSize: number;
  readonly lastKnownTileId: TileId;
  readonly contactKind: ContactKind;
}

export interface KnownSettlementRecord {
  readonly settlementId?: SettlementId;
  readonly tileId: TileId;
  readonly firstObservedAt: WorldTime;
  readonly lastObservedAt: WorldTime;
  readonly confidence: number;
  readonly estimatedPopulation: number;
  readonly apparentPermanence: number;
  readonly observedStorage: number;
  readonly contactKind: ContactKind;
}

export interface PlaceAttachment {
  readonly tileId: TileId;
  readonly seasonsKnown: number;
  readonly practicalWeight: number;
  readonly ritualOrSymbolicWeight: number;
  readonly burialOrAncestorWeight: number;
  readonly claimStrength: number;
}

export interface RouteMemory {
  readonly routeId?: RouteId;
  readonly tileIds: readonly TileId[];
  readonly firstUsedAt: WorldTime;
  readonly lastUsedAt: WorldTime;
  readonly usualSeasons: readonly Season[];
  readonly expectedFoodValue: number;
  readonly expectedRisk: number;
  readonly confidence: number;
}

export interface RumorRecord {
  readonly subject: RumorSubject;
  readonly receivedAt: WorldTime;
  readonly sourceContactKind: ContactKind;
  readonly confidence: number;
  readonly tileId?: TileId;
  readonly bandId?: BandId;
  readonly settlementId?: SettlementId;
  readonly routeId?: RouteId;
  readonly regionId?: RegionId;
}

export interface KnowledgeState {
  readonly selfBandId: BandId;
  readonly observedTiles: Readonly<Record<TileId, KnownTileRecord>>;
  readonly compressedKnownTileSummaries: readonly CompressedKnownTileSummary[];
  readonly knownAreaSummaries: readonly KnownAreaSummary[];
  readonly knownBands: readonly KnownBandRecord[];
  readonly knownSettlements: readonly KnownSettlementRecord[];
  readonly knownRoutes: readonly RouteMemory[];
  readonly placeAttachments: readonly PlaceAttachment[];
  readonly tileObservationHistory: readonly TileObservation[];
  readonly rumors: readonly RumorRecord[];
}

/**
 * CORRECTION-23D §6 — the minimum causal summary a future eligibility decision needs.
 *
 * Deliberately NOT a log. One entry per question actually attempted at this place, upserted,
 * so repetition cannot grow state and no dense band x tile x question matrix exists.
 */
export interface PlaceQuestionDisposition {
  readonly question: FrontierVerificationQuestion;
  readonly outcome: "confirmed" | "negative" | "inconclusive";
  /** Seasons this question was PHYSICALLY answered in here. Never a calendar. */
  readonly seasonsAnswered: readonly Season[];
  readonly attempts: number;
  readonly lastSeason: Season;
  readonly lastTick: TickNumber;
  /** Route length walked last time — a materially different way there is a real change. */
  readonly routeTilesAtLastAttempt: number;
  /** §7.2 — the physical scope of a negative, so it never becomes global absence. */
  readonly accessFailureKind?: WaterAccessFailureKind;
}
