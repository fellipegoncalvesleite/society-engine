import type {
  BandId,
  Coord,
  DecisionId,
  RegionId,
  RiverId,
  Season,
  SeasonIndex,
  SimulationSeed,
  TickNumber,
  TileId,
  WorldTime,
} from "../core/types";
import type { Band } from "../agents/types";
import type { FaunaStockDynamic } from "../agents/faunaStock";
import type { ForestPatchState } from "../agents/forestPatches";
import type { PlantPatchState } from "../agents/plantStock";
import type { Decision, DecisionArchiveSummary } from "../rules/types";

export type TerrainKind =
  | "plains"
  | "forest"
  | "hills"
  | "mountains"
  | "wetlands"
  | "river_valley"
  | "coast"
  | "lake"
  | "desert"
  | "tundra";

export type BiomeKind =
  | "unknown"
  | "temperate_grassland"
  | "temperate_forest"
  | "boreal_forest"
  | "savanna"
  | "shrubland"
  | "floodplain"
  | "marsh"
  | "coastal"
  | "arid"
  | "alpine";

export type ClimateRegime =
  | {
      readonly kind: "stable";
      readonly seasonalHarshness: number;
      readonly aridity: number;
      readonly volatility: number;
    }
  | {
      readonly kind: "warming";
      readonly seasonalHarshness: number;
      readonly aridity: number;
      readonly volatility: number;
    }
  | {
      readonly kind: "cooling";
      readonly seasonalHarshness: number;
      readonly aridity: number;
      readonly volatility: number;
    }
  | {
      readonly kind: "drying";
      readonly seasonalHarshness: number;
      readonly aridity: number;
      readonly volatility: number;
    }
  | {
      readonly kind: "wetting";
      readonly seasonalHarshness: number;
      readonly aridity: number;
      readonly volatility: number;
    }
  | {
      readonly kind: "volatile";
      readonly seasonalHarshness: number;
      readonly aridity: number;
      readonly volatility: number;
    };

export interface TileResourceProfile {
  readonly baseRichness: number;
  readonly waterAccess: number;
  readonly aquaticPotential: number;
  readonly wildGrainPotential: number;
  readonly plantTendingPotential: number;
  readonly storageSuitability: number;
  readonly resourceRegenerationRate: number;
}

export interface SeasonalResourceProfile {
  readonly seasonalVariance: number;
  readonly peakSeasons: readonly Season[];
  readonly leanSeasons: readonly Season[];
  readonly reliability: number;
  readonly expectedWinterStress: number;
}

export interface EnvironmentalRiskProfile {
  readonly floodRisk: number;
  readonly droughtRisk: number;
  readonly diseaseRisk: number;
  readonly depletionRisk: number;
  readonly climateVolatility: number;
}

export type RiverKind =
  | "seasonal_stream"
  | "shallow_braided"
  | "meandering_channel"
  | "deep_channel"
  | "marsh_channel"
  | "estuary"
  | "rapid_gorge";

export type RiverWidthClass =
  | "narrow"
  | "medium"
  | "wide"
  | "very_wide";

export type RiverDepthClass =
  | "shallow"
  | "mixed"
  | "deep";

export type FlowStrength =
  | "weak"
  | "moderate"
  | "strong"
  | "dangerous";

export type RiverCrossingClass =
  | "ford"
  | "seasonal_ford"
  | "shallow_crossing"
  | "dangerous_crossing"
  | "impassable_without_watercraft"
  | "impassable_without_bridge_or_ferry";

export interface RiverSegmentProfile {
  readonly riverId: RiverId;
  readonly kind: RiverKind;
  readonly widthClass: RiverWidthClass;
  readonly depthClass: RiverDepthClass;
  readonly flowStrength: FlowStrength;
  readonly bankSteepness: number;
  readonly seasonalFlowVariance: number;
  readonly floodSeason?: Season;
  readonly fordability: number;
  readonly navigability: number;
  readonly aquaticReliabilityModifier: number;
  readonly floodplainFertilityModifier: number;
  readonly crossingRisk: number;
}

export interface RiverCrossingProfile {
  readonly fromTileId: TileId;
  readonly toTileId: TileId;
  readonly riverId: RiverId;
  readonly crossingClass: RiverCrossingClass;
  readonly baseCrossingCost: number;
  readonly seasonalCostModifier: number;
  readonly risk: number;
  readonly knownFord: boolean;
  readonly confidence: number;
}

export interface SubsistenceModeCapacity {
  readonly sustainablePopulation: number;
  readonly foodPerTick: number;
  readonly reliability: number;
  readonly depletionSensitivity: number;
  readonly seasonalPressure: number;
}

export interface CarryingCapacityProfile {
  readonly foraging: SubsistenceModeCapacity;
  readonly aquatic: SubsistenceModeCapacity;
  readonly plantTending: SubsistenceModeCapacity;
  readonly earlyAgriculture: SubsistenceModeCapacity;
  readonly irrigatedAgriculture: SubsistenceModeCapacity;
}

export interface SubsistenceYieldBreakdown {
  readonly aquaticYield: number;
  readonly wildPlantYield: number;
  readonly plantTendingYield: number;
  readonly earlyAgricultureYield: number;
  readonly irrigatedAgricultureYield: number;
  readonly storageModifiedYield: number;
  readonly storageLoss: number;
}

export interface ResourceYieldEstimate extends SubsistenceYieldBreakdown {
  readonly tileId: TileId;
  readonly expectedFood: number;
  readonly foodReliability: number;
  readonly leanSeasonRisk: number;
  readonly movementCostToAccess: number;
  readonly expectedFutureValue: number;
  readonly planningHorizonTicks: TickNumber;
}

export interface SeasonalYieldEstimate {
  readonly season: Season;
  readonly seasonIndex: SeasonIndex;
  readonly estimate: ResourceYieldEstimate;
}

export interface Tile {
  readonly id: TileId;
  readonly coord: Coord;
  readonly regionId: RegionId;
  readonly terrainKind: TerrainKind;
  readonly biomeKind?: BiomeKind;
  readonly resourceProfile: TileResourceProfile;
  readonly seasonalProfile: SeasonalResourceProfile;
  readonly riskProfile: EnvironmentalRiskProfile;
  readonly carryingCapacity: CarryingCapacityProfile;
  readonly movementCost: number;
  readonly elevation: number;
  readonly isRiver: boolean;
  readonly isCoastal: boolean;
  readonly isAquatic: boolean;
  readonly riverSegmentId?: RiverId;
  readonly isFloodplain: boolean;
  readonly isRiverbank: boolean;
  readonly isConfluence: boolean;
  readonly isEstuary: boolean;
  readonly isMarshChannel: boolean;
  // MAP2-R: marks tiles on a sub-tile creek/small-stream influence corridor
  // (debug/render visibility only — creeks act on the sim through the tile's
  // resource/risk profiles, never through this flag). Unset on maps without
  // authored creeks.
  readonly hasCreek?: boolean;
  readonly neighbors: readonly TileId[];
}

export interface WorldConfig {
  readonly width: number;
  readonly height: number;
  readonly seasonsPerYear: number;
  readonly yearsPerGeneration: number;
  readonly ticksPerGeneration: number;
}

export interface WorldRegion {
  readonly id: RegionId;
  readonly name?: string;
  readonly tileIds: readonly TileId[];
  readonly climateRegime?: ClimateRegime;
}

export interface ClimateStressSnapshot {
  readonly label: string;
  readonly severity: number;
  readonly affectedRegionIds: readonly RegionId[];
  readonly observedAt: WorldTime;
}

export interface WorldAuditOptions {
  // Benchmark-only switch used to compare activity-memory coupling ON/OFF.
  // Normal worlds leave this undefined.
  readonly activityMemoryCouplingDisabled?: boolean;
  // AG11: benchmark/experimental switch for the tiny activity-subsistence
  // supplement. Undefined/false is the normal default and must stay byte-identical
  // to the abstract economy floor.
  readonly activitySubsistenceSupplementEnabled?: boolean;
  // 2K.12: enable the seasonal-ecology MEMORY READERS — bands read their own learned
  // `seasonalEcologyMemory` to put a small, bounded, selection-only bias on
  // residence-unchanged target choices (resource scout / known-patch recheck, activity
  // target, water-check target) plus a record-only reasonId annotation on residential
  // moves. Undefined/false is the normal default and stays byte-identical to baseline;
  // no economy/yield/carrying-capacity/hidden-truth coupling either way.
  readonly seasonalEcologyMemoryReadersEnabled?: boolean;
  // RANGE-3B: daughter-colonization founder/fission bias override. Undefined is
  // normal MVP behaviour (enabled); benchmark audits set false to compare the old
  // conservative path. The bias only scores band-known underused-habitat opportunities
  // with route/ford/edge/side-country evidence. Never reads truth richness.
  readonly daughterColonizationFissionBiasEnabled?: boolean;
  // CORRECTION-17 §17 — control-arm switches for the frontier-exploration matrix. BOTH
  // are undefined in every normal world, and both are read at exactly one place each in
  // `expedition.ts`, so with them undefined the production path is byte-identical to a
  // build without them (the §22 "audit hooks inert when disabled" requirement).
  //
  // false => the band never raises an exploratory party. This is the control arm that
  // isolates whether the enabled arm's advantage comes from RETURNED KNOWLEDGE: nothing
  // else about the world, the yields, the demography or the fission thresholds differs.
  readonly frontierExplorationEnabled?: boolean;
  // true => every exploratory party is declared lost at the moment it would otherwise
  // begin its return. It walked, it observed, and none of it ever reaches the band. This
  // is the §11 control proving that a lost party transfers no knowledge.
  readonly frontierExplorationAlwaysLost?: boolean;
  // CORRECTION-18 §7 ARM A — run frontier exploration PHYSICALLY but suppress the
  // residential knowledge hand-off at return. The party departs, commits its workers, eats
  // its provisions and walks every step; only the transfer is withheld. This isolates the
  // DIRECT EXPEDITION COST from everything the returned knowledge subsequently causes.
  // Undefined in every normal world; read at exactly one seam in `expedition.ts`.
  readonly frontierKnowledgeTransferDisabled?: boolean;
  // CORRECTION-20 §6 — FRONTIER READER ISOLATION. Frontier-derived knowledge is written
  // and retained normally (so residential movement, resource selection, camps and seasonal
  // rounds all still read it), but tiles whose `acquisition` is
  // `returned_frontier_exploration` are withheld from the OPPORTUNITY and FISSION path
  // only. Combined with `frontierKnowledgeTransferDisabled` (which withholds it from
  // everything) this decomposes the knowledge effect:
  //
  //   production - hiddenFromFission = the fission-only contribution
  //   production - transferDisabled  = the total knowledge contribution
  //   hiddenFromFission - transferDisabled = the non-fission contribution
  //
  // §6 requires this because map 2 loses population while its final band count is
  // unchanged, which a fission-only story cannot explain on its own.
  // Undefined in every normal world; read at exactly two seams.
  readonly frontierKnowledgeHiddenFromFission?: boolean;
  // CORRECTION-22 §6 — audit-only. Switches ONE component of the CORRECTION-21
  // shallow-traversal repair back off so a habitat-tier loss can be attributed to a
  // specific field. Undefined in every normal world.
  readonly shallowObservationRestore?:
    | "richness"
    | "water"
    | "seasonal"
    | "storage"
    | "confidence"
    | "all";
  // CORRECTION-23 CONTINUATION §9/§12 — control-arm switches for the E0-E5 marginal matrix
  // and the M0-M5 default-map matrix. All undefined in every normal world, each read at
  // exactly one seam, so with them undefined the production path is byte-identical.
  //
  // E3 / M5 — the band never raises a frontier-verification party. Isolates whether the
  // effect comes from LAUNCHING THE PHYSICAL PARTIES at all.
  readonly frontierVerificationDisabled?: boolean;
  // E4 — parties are raised, walk, work and come home; only the returned domain evidence
  // is withheld at the hand-off seam. Isolates the value of the EVIDENCE from the cost and
  // displacement of the journey.
  readonly frontierVerificationKnowledgeDisabled?: boolean;
  // E5 — parties run and return normally, but an affirmative on-site result is downgraded
  // to `inconclusive`. Isolates the value of AFFIRMATIVE ANSWERS from the value of having
  // asked at all.
  readonly frontierVerificationConfirmationDisabled?: boolean;
  // §8 — launch-policy decomposition. The production gate is
  // `noUsefulRetrieval || need >= 0.45`; these arms run exactly one disjunct so the two
  // launch causes can be counted separately instead of inferred.
  readonly frontierVerificationLaunchArm?: "no_useful_retrieval_only" | "need_only";
  // CORRECTION-23C §11 — arm C2. Water-access evidence is written and displayed normally but
  // withheld from the feasibility reader, so the access effect can be isolated from the cost
  // and displacement of the journey. Undefined in every normal world; read at one seam.
  readonly waterAccessEvidenceHiddenFromDestination?: boolean;
  // ───────────────────────────────────────────────────────────────────────────────────────
  // CORRECTION-23E — DIAGNOSTIC ISOLATION ARMS. Every one is undefined in every normal
  // world and read at exactly one seam. This checkpoint is a DIAGNOSIS: none of these may
  // become a production default, and none of them is selected by any production code path.
  // ───────────────────────────────────────────────────────────────────────────────────────
  //
  // §5 R2-R5 — decompose the CORRECTION-23D retry repair into its components so the
  // marginal regression can be attributed to one of them rather than to "the repair".
  //
  //   legacy_eligibility        R2 — durable disposition is still WRITTEN, but eligibility
  //                                  is read from the capped chronological collection with
  //                                  the pre-23D gate. Isolates STORAGE from SUPPRESSION.
  //   hardship_reopens          R3 — 23D gate, but hardship movement reopens a settled
  //                                  question again (§8's removed term).
  //   legacy_season_comparison  R4 — 23D gate, but `lastSeason !== currentSeason` reopens
  //                                  water/resource questions again (§7's removed term).
  //   suppression_disabled      R5 — 23D gate, but a settled confirmed/negative answer no
  //                                  longer blocks a repeat.
  readonly verificationRetryArm?:
    | "legacy_eligibility"
    | "hardship_reopens"
    | "legacy_season_comparison"
    | "suppression_disabled";
  // §5 R6 — a returning frontier-verification party hands over its ANSWER but not its
  // walked route, so the route never becomes ordinary known country. Isolates how much of
  // verification's value was EXPLORATION rather than verification.
  readonly verificationPartyRouteObservationDisabled?: boolean;
  // §5 R7 — broad exploration is scheduled on its OWN eligibility instead of only when no
  // verification candidate exists. The party budget is unchanged (one task per call,
  // EXPEDITION_ACTIVE_CAP unchanged): only the order in which the two families are offered
  // the same single slot changes. Isolates whether verification CROWDS OUT exploration.
  readonly explorationSchedulingIndependent?: boolean;
  // §12 K1-K5 — place-retention counterfactuals, read only by `memoryCompression`. They
  // distinguish bad PRIORITISATION from raw CAPACITY pressure. §16 forbids selecting any of
  // them as production in this pass.
  //
  //   protect_settled_verification  K1 — any record carrying a settled disposition is kept.
  //   protect_actionable_verified   K2 — only currently promising/candidate verified places.
  //   protect_active_route_verified K3 — only verified places on an active route or used
  //                                      recently.
  //   capacity_only                 K4 — priorities untouched; capacity raised.
  //   no_inherited_mandatory        K5 — the inherited mandatory-retention set (local ring,
  //                                      crossings, important water) stops consuming
  //                                      capacity, so scored records compete for all of it.
  readonly placeRetentionArm?:
    | "protect_settled_verification"
    | "protect_actionable_verified"
    | "protect_active_route_verified"
    | "capacity_only"
    | "no_inherited_mandatory";
  // K4 — exact known-tile capacity for the capacity arm. Undefined ⇒ the production 72.
  readonly placeRetentionCapacity?: number;
  // ───────────────────────────────────────────────────────────────────────────────────────
  // CORRECTION-23F — SEASONAL-RETRAVERSAL BENEFIT DECOMPOSITION. Audit-only, undefined in
  // every normal world. CORRECTION-23E proved that restoring ONE deleted season term
  // restores marginal survival and that suppressing the walked-route observation collapses
  // it — but "walking" is not an answer. These arms split the walk into the things it
  // actually does to band knowledge.
  // ───────────────────────────────────────────────────────────────────────────────────────
  //
  // §7/§8/§9 — what a returning verification party's observation is allowed to do. Applied
  // ONLY to the verification-return seam, by an explicit parameter, so no other observation
  // producer is affected.
  //
  //   target_only          F3  — only the destination tile is observed
  //   route_only           F4  — only the intermediate route tiles are observed
  //   new_tiles_only       F5  — may create unknown records; never touches an existing one
  //   existing_only        F6  — may refresh known records; never creates one
  //   content_no_recency   F7  — content fields update; `lastObservedAt`/`visits` preserved
  //   recency_no_content   F8  — only `lastObservedAt`/`visits` refresh; content preserved
  //   no_season_identity   F9  — refreshes normally but does not add the current season
  //   season_identity_only F10 — adds the current season only; nothing else changes
  readonly verificationObservationPolicy?:
    | "target_only"
    | "route_only"
    | "new_tiles_only"
    | "existing_only"
    | "content_no_recency"
    | "recency_no_content"
    | "no_season_identity"
    | "season_identity_only";
  // §10 F11/F12/F13 — separate the PARTY COUNT and the TARGET CHOICE from the question.
  //
  //   broad_exploration_targets F11 — same launch schedule, ordinary exploration selector
  //   nearest_legal_frontier    F12 — same launch schedule, nearest legal frontier target
  //   no_verification_question  F13 — the old seasonal target schedule and the same physical
  //                                   route, but the party carries NO question, records NO
  //                                   result and writes NO disposition. The single most
  //                                   important architectural counterfactual in this pass.
  readonly verificationTargetArm?:
    | "broad_exploration_targets"
    | "nearest_legal_frontier"
    | "no_verification_question";
  // §11 F14/F15/F16 — memory-retention interaction, without changing production retention.
  //
  //   protect_verification_targets F14 — places a verification party WOULD have visited are
  //                                      protected from eviction, and no extra travel occurs
  //   observation_cannot_protect   F15 — the travel happens, but its observations do not
  //                                      refresh retention state, so they cannot defeat
  //                                      eviction
  //   protect_active_candidates    F16 — sparse protection for behaviourally active frontier
  //                                      candidates only
  readonly retentionInteractionArm?:
    | "protect_verification_targets"
    | "observation_cannot_protect"
    | "protect_active_candidates";
}

export interface WorldState {
  readonly config: WorldConfig;
  readonly time: WorldTime;
  readonly seed: SimulationSeed;
  // VAR-1 — run-variation seed (numeric hash). DISTINCT from `seed` (which is
  // the map-generation/terrain seed): runSeed perturbs only near-tie decision
  // ordering, never terrain/economy/demography. undefined = legacy (zero
  // jitter, byte-identical to pre-VAR-1 baselines). Set by the runner/UI.
  readonly runSeed?: number;
  readonly tiles: Readonly<Record<TileId, Tile>>;
  // M0.14 — persistent local depletion: SPARSE per-tile ecological wear
  // (0..0.85), advanced once per season from the shared-catchment extraction
  // index, recovering at the tile's own regeneration rate when unused.
  // Physical truth (not knowledge); lives here because the tiles record is
  // immutable and reference-stable (caches key on it). Optional so synthetic
  // fixture worlds and older constructors need no change.
  readonly tileDepletion?: Readonly<Record<TileId, number>>;
  // FAUNA/AQUATIC-1 — persistent finite fauna/aquatic stock dynamics: SPARSE
  // per-stock abundance (fraction of carrying capacity) + disturbance/avoidance.
  // Physical truth (not knowledge); placement geography is a pure function of the
  // tiles record (derived/memoized separately, never stored). Advanced once per
  // season from catchment occupation + in-season hunting/fishing trip depletion,
  // recovering when rested. Absent entry ⇒ baseline (full); whole field optional
  // so synthetic/fixture worlds and older constructors need no change.
  readonly faunaStocks?: Readonly<Record<string, FaunaStockDynamic>>;
  // ECO-BIOME-1 — sparse human-use depletion overlay on the plant-patch geography
  // (plant mirror of faunaStocks / tileDepletion). Physical truth; absent ⇒ no
  // human depletion. Advanced once per season from gathering trips + catchment
  // occupation, recovering at class-specific regrowth rates. Optional.
  readonly plantPatchState?: Readonly<Record<string, PlantPatchState>>;
  // TREE-FOREST-PATCHES-1 — sparse pressure/health overlay on deterministic
  // tree/forest patch summaries. Physical truth, not band knowledge; absent
  // means baseline forest health. Advanced once per season from local occupation
  // pressure and slow recovery. No per-tree agents or dense forest grid.
  readonly forestPatchState?: Readonly<Record<string, ForestPatchState>>;
  readonly climateRegime: ClimateRegime;
  readonly currentClimateStress: ClimateStressSnapshot | null;
  readonly auditOptions?: WorldAuditOptions;
  readonly regions: Readonly<Record<RegionId, WorldRegion>>;
  readonly rivers: Readonly<Record<RiverId, RiverSegmentProfile>>;
  readonly riverCrossings: Readonly<Record<string, RiverCrossingProfile>>;
  readonly bands: Readonly<Record<BandId, Band>>;
  readonly decisions: Readonly<Record<DecisionId, Decision>>;
  readonly decisionArchive: DecisionArchiveSummary;
}
