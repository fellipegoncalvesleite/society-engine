/**
 * ROADMAP ITEM 4 — THE ONE ANSWER TO "WHAT MAY TRANSFER WHEN ONE HUMAN GROUP PHYSICALLY DIVIDES?"
 *
 * ── WHY THIS MODULE EXISTS, MEASURED RATHER THAN ARGUED ───────────────────────────────────────
 *
 * `performAtomicDeparture` builds the successor from `{ ...parent }` plus a hand-written list of
 * overrides. A per-field probe of a REAL departure — parent of 34 splitting 11 founders out — found
 * **86 of the 125 populated fields were still the parent's own object**. The overrides covered the
 * eighteen fields the author happened to think of; the spread silently handed over everything else:
 *
 *   - the parent's COMPLETE `knowledge`, `placeMemory`, `travelCorridors` and `crossingMemories` —
 *     the legacy daughter path inherits 13-15% of these, degraded and source-tagged, and the seam
 *     gave a perfect copy, which is free omniscience about country nobody in the new group walked;
 *   - `exploitationSkill`, `adaptiveHuman`, `practicalAdaptation`, `animalPatternKnowledge` and
 *     `frontierIntent` — every one of which the legacy path deliberately DEGRADES, because cultural
 *     transmission is lossy and a perfect copy is a claim nobody can support;
 *   - `verificationEvidence` and `frontierVerificationAttempts`, which CORRECTION-23B states in so
 *     many words a daughter must not inherit: it did not walk to those places and did not draw that
 *     water;
 *   - `carryingCapacity`, `populationDemand`, `perCapitaReturn`, `rangeSaturation`, `seasonalSupport`
 *     and `returnTrend` — all DERIVED FROM THE PARENT'S 34 PEOPLE while the group holds 11, which is
 *     the stale-derived-state defect L7 exists to prevent;
 *   - `residentialAnchor`, `anchorMemories`, `seasonalRound`, `campMovement` and `foragingRadiusState`
 *     — a camp, a catchment and an annual round the group does not have;
 *   - and `eventHistory`, `causalTraces`, `movementHistory`, `deepHistory`, `encounterRecords` and
 *     `contactMemories`: the parent's biography and its entire social world, claimed by a group that
 *     has existed for zero days.
 *
 * ── WHY A TABLE RATHER THAN A LIST IN A DOCUMENT ──────────────────────────────────────────────
 *
 * `SPLIT_STATE_INVENTORY.md` already recorded that `DAUGHTER_NON_CLONEABLE_FIELDS` registers ~60
 * fields "each with an explicit written policy". That list is real and it works — but it is a list
 * of what SOMEONE REMEMBERED, and counted exactly it covers **67 of `Band`'s 133 fields**. The other
 * 66 are not decided; they are unexamined, and the `{ ...parent }` spread decides them by default.
 *
 * So the policy is a `Record<keyof Band, ...>`. **Adding a field to `Band` without classifying it is
 * a TypeScript error**, because a `Record<keyof Band, X>` missing a key does not typecheck — and
 * `scripts/fissionFieldTransferAudit.mjs` independently re-derives `keyof Band` from `types.ts` and
 * fails if the two disagree, so the guarantee does not rest on one mechanism.
 *
 * ── ONE POLICY, TWO CONSUMERS ─────────────────────────────────────────────────────────────────
 *
 * `demography.ts`'s `DAUGHTER_NON_CLONEABLE_FIELDS` is now DERIVED from this table
 * (`deriveLegacyNonCloneableFields()`), so there is literally one source rather than two policies
 * that drift. The derived set is a SUPERSET of the 67-field literal by exactly two fields —
 * `pendingInvestigation` and `recentInvestigationOutcomes` — and that difference is provably inert
 * rather than merely believed to be: the clone guard fires only when
 * `parentValue !== undefined && daughter[field] === parentValue`, and `createDaughterBand` writes
 * `undefined` to both explicitly, so the second condition can hold only when the first is false.
 * The audit asserts the derived set against the retained literal on every run.
 *
 * The legacy path is otherwise **audited against** this table, not rewritten by it. Where the two
 * disagree — a field this policy says must not be copied wholesale that `createDaughterBand` copies
 * anyway — the disagreement is PUBLISHED as legacy debt by the audit rather than silently repaired,
 * because changing `createDaughterBand` changes ordinary ecology and that is a separate checkpoint
 * with its own before/after evidence.
 */
import type { Band } from "./types";

/** The twelve ways a field may cross the boundary. Exactly one applies to each field. */
export type FieldTransferClass =
  /** The successor's own identity. Never the parent's value; a shared identity is not an identity. */
  | "NEW_SUCCESSOR_IDENTITY"
  /** Bodies, allocated by subtraction from the parent's real composition. Never re-derived at ratios. */
  | "EXACT_COHORT_TRANSFER"
  /** The record of THIS split, on the side that owns it. */
  | "CURRENT_LINEAGE_PROVENANCE"
  /** Transmitted culturally: partial, lossy, re-earnable. A perfect copy is forbidden BY DEFINITION. */
  | "DEGRADED_OR_PARTIAL_INHERITANCE"
  /** True of both halves at the instant of division because it was true of the people. May be shared. */
  | "SHARED_HISTORICAL_FACT"
  /** Condition carried in the bodies that walked out. Travels, and may never IMPROVE by travelling. */
  | "FOUNDER_CARRIED_EMBODIED_BURDEN"
  /** Derived state that can be honestly recomputed NOW from what the successor already holds. */
  | "RECOMPUTE_FROM_SUCCESSOR_TRUTH"
  /** Derived state whose inputs do not exist yet. Absent until a later phase establishes them. */
  | "INVALIDATE_UNTIL_LATER_PHASE"
  /** A current commitment or pending action. The same bodies cannot be committed twice. */
  | "RESET_ACTIVE_COMMITMENT"
  /** Pure display/explanatory projection. Rebuilt by its own writer; never seeded. */
  | "REBUILD_READ_MODEL"
  /** Retained for schema/history with no lived writer, or a known-defective legacy behaviour. */
  | "LEGACY_COMPATIBILITY_GATED"
  /** A record of something that happened to the PARENT as an entity. It did not happen to this group. */
  | "FORBIDDEN_TO_COPY";

/** What the successor's value must be, so the runtime guard tests a value rather than a vibe. */
export type SuccessorValueShape =
  /** Must be `undefined`. */
  | "absent"
  /** Must be a distinct empty array. */
  | "empty_array"
  /** Must be a distinct empty record. */
  | "empty_record"
  /** Must be numeric zero. */
  | "zero"
  /** Supplied by the departure seam; must not be the parent's object. */
  | "computed"
  /** Carried from the parent, possibly by reference. Only `SHARED_HISTORICAL_FACT` may use this. */
  | "carried"
  /** Carried, and may not fall below the parent's value on any numeric term (no unearned relief). */
  | "carried_no_relief"
  /**
   * REQUIRED field whose honest recompute is not yet routed to the departure seam, so it still holds
   * the parent's derived value. Must equal the parent's, and is COUNTED AND PUBLISHED — a named open
   * item rather than an invisible copy.
   */
  | "carried_pending_recompute";

export interface FieldTransferPolicyEntry {
  readonly transferClass: FieldTransferClass;
  readonly successorValue: SuccessorValueShape;
  /**
   * Whether the legacy daughter clone guard covers this field. `deriveLegacyNonCloneableFields`
   * returns exactly the `true` set, and the audit asserts it against the retained 67-field literal.
   */
  readonly legacyGuardRegistered: boolean;
  /** Why. One line, and it must say something a reader could not derive from the field name. */
  readonly why: string;
}

const entry = (
  transferClass: FieldTransferClass,
  successorValue: SuccessorValueShape,
  legacyGuardRegistered: boolean,
  why: string,
): FieldTransferPolicyEntry => ({ transferClass, successorValue, legacyGuardRegistered, why });

/**
 * THE CANONICAL TABLE. Every `keyof Band`, exactly once.
 *
 * The `Record<keyof Band, ...>` annotation is the enforcement: a new field on `Band` fails to
 * typecheck here until it is classified, and a field removed from `Band` fails here too.
 */
export const FISSION_FIELD_TRANSFER_POLICY: Record<keyof Band, FieldTransferPolicyEntry> = {
  // ── identity ────────────────────────────────────────────────────────────────────────────────
  id: entry("NEW_SUCCESSOR_IDENTITY", "computed", false, "two entities sharing one id are one entity"),
  name: entry("NEW_SUCCESSOR_IDENTITY", "computed", false, "the group is named as a successor, not as the parent"),
  color: entry("NEW_SUCCESSOR_IDENTITY", "computed", false, "the legacy path derives a distinct colour; the seam copied the parent's, making the two halves indistinguishable on the map"),
  parentBandId: entry("CURRENT_LINEAGE_PROVENANCE", "computed", false, "who this group came out of"),
  lineage: entry("FORBIDDEN_TO_COPY", "absent", false, "the parent's `BandLineageLink` describes a DIFFERENT pair, and the successor's own link records a COMPLETED split — which this one is not yet; provenance is carried by `parentBandId` and the lineage id on the lifecycle record until stabilization"),
  daughterBandIds: entry("NEW_SUCCESSOR_IDENTITY", "empty_array", true, "a group that has existed for zero days has produced no daughters"),
  initialSpawnReason: entry("FORBIDDEN_TO_COPY", "absent", false, "this group was not spawned at world creation; claiming a spawn reason is a false origin"),

  // ── the split itself ────────────────────────────────────────────────────────────────────────
  fissionAttempt: entry("FORBIDDEN_TO_COPY", "absent", false, "the attempt is the PARENT's record and is terminal after departure; a successor holding it would be a second body owner"),
  provisionalSuccessor: entry("CURRENT_LINEAGE_PROVENANCE", "computed", false, "the successor's own lifecycle record — the field that makes it provisional at all"),
  fissionEvents: entry("FORBIDDEN_TO_COPY", "empty_array", true, "the parent's earlier splits happened to a group this one is not — and `BandFissionEvent` describes an INSTANTANEOUS completed fission, the exact shape Direction D exists to replace, so the successor writes none at departure"),
  successorDepartureRecords: entry("CURRENT_LINEAGE_PROVENANCE", "computed", false, "the successor receives only the immutable physical-departure record that produced it; prior departures belong to the parent and are not inherited"),
  successorStabilizationEvents: entry("FORBIDDEN_TO_COPY", "empty_array", false, "no positive completion event is true at departure; the stabilization authority appends one only after lived independent operation"),

  // ── bodies ──────────────────────────────────────────────────────────────────────────────────
  //
  // `position` is the one field where carrying the parent's value is not laundering but the whole
  // point. These people were standing here a moment ago, so this is where they are. Reading
  // `attempt.targetTileId` here is defect 2 — the daughter that appeared 5 and 7 tiles away in one
  // day — and this entry is the field-level statement of why the seam does not consult it.
  position: entry("SHARED_HISTORICAL_FACT", "carried", false, "bodies do not teleport: at departure the successor stands exactly where the parent stands, and the target is somewhere it must WALK to"),
  demography: entry("EXACT_COHORT_TRANSFER", "computed", false, "cohorts move by SUBTRACTION from the parent's real composition — the re-derivation at fixed ratios is what manufactured dependents in 0 of 2 measured fissions"),
  size: entry("EXACT_COHORT_TRANSFER", "computed", false, "the allocated headcount, kept equal to the demography total"),

  // ── embodied condition: travels with the people, never improves by travelling ───────────────
  health: entry("FOUNDER_CARRIED_EMBODIED_BURDEN", "carried_no_relief", false, "disease, injury and mortality risk are in the bodies that walked out; resetting them would cure people by moving them"),
  hungerPressure: entry("FOUNDER_CARRIED_EMBODIED_BURDEN", "carried_no_relief", false, "L2 — walking away is not eating; the legacy path applies parent x 0.86, so its daughter starts 14% less hungry than the camp it left"),
  acuteRisk: entry("FOUNDER_CARRIED_EMBODIED_BURDEN", "computed", true, "L5 — acute hardship travels, but the record must be RE-IDENTIFIED to this band: the parent's object carries the parent's id and the parent's episode bookkeeping"),

  // ── dispositional facts true of both halves at the instant of division ──────────────────────
  cohesion: entry("SHARED_HISTORICAL_FACT", "carried", false, "how well this group held together was true of all of them a moment ago; the legacy path's parent x 0.94 + 0.04 is an unearned improvement"),
  mobilityCostTolerance: entry("SHARED_HISTORICAL_FACT", "carried", false, "a learned willingness to bear travel cost, held by the people rather than by the camp"),
  mobilityStrategy: entry("SHARED_HISTORICAL_FACT", "carried", false, "the practice both halves were following when they divided"),
  subsistenceModes: entry("SHARED_HISTORICAL_FACT", "carried", false, "what these people know how to live on; not a per-band resource"),
  deathMemory: entry("SHARED_HISTORICAL_FACT", "carried", true, "L6 — the same remembered deaths, not two independent bereavements; carried by reference PRECISELY so one death cannot become two events"),

  // ── culturally transmitted: partial and lossy, never a perfect copy ─────────────────────────
  knowledge: entry("DEGRADED_OR_PARTIAL_INHERITANCE", "computed", true, "the legacy path transmits 13-15% of observed tiles; a perfect copy hands the group country nobody in it has walked"),
  placeMemory: entry("DEGRADED_OR_PARTIAL_INHERITANCE", "computed", true, "places are remembered by the people who returned to them, and only some of those people left"),
  travelCorridors: entry("DEGRADED_OR_PARTIAL_INHERITANCE", "computed", true, "routes transmit as told routes, bounded by what the successor still knows"),
  crossingMemories: entry("DEGRADED_OR_PARTIAL_INHERITANCE", "computed", true, "a crossing is remembered by whoever made it"),
  resourceKnowledgeState: entry("DEGRADED_OR_PARTIAL_INHERITANCE", "computed", true, "2K.1D — partial, degraded and source-tagged, never the wholesale parent copy"),
  animalPatternKnowledge: entry("DEGRADED_OR_PARTIAL_INHERITANCE", "computed", true, "bounded degraded observations, never the parent's current hidden-stock reading"),
  exploitationSkill: entry("DEGRADED_OR_PARTIAL_INHERITANCE", "computed", true, "2K.6 — competence halved and processing_learned re-earned; a perfect copy is a claim that skill transmits without practice"),
  adaptiveHuman: entry("DEGRADED_OR_PARTIAL_INHERITANCE", "computed", true, "partial hints only — never the parent's tested attempts or established routines"),
  practicalAdaptation: entry("DEGRADED_OR_PARTIAL_INHERITANCE", "computed", false, "INVENTION-1 — weakened fragments that must be re-proven locally; composed responses never travel"),
  technologies: entry("DEGRADED_OR_PARTIAL_INHERITANCE", "computed", true, "display tags are not inherited as complex competence"),
  frontierIntent: entry("DEGRADED_OR_PARTIAL_INHERITANCE", "absent", true, "M0.3 hands a degraded drift only on a FRONTIER-DRIVEN split, and the attempt record carries no such flag — inventing one would fabricate the motive; a pressure split hands over no intent, which is the conservative reading"),
  deepHistory: entry("DEGRADED_OR_PARTIAL_INHERITANCE", "absent", true, "`createDaughterDeepHistory` requires a completed `BandFissionEvent` to found on, and Direction D writes none at departure; a founding snapshot is written when the group is actually founded, which is stabilization"),
  mobility: entry("DEGRADED_OR_PARTIAL_INHERITANCE", "absent", false, "conditioning IS in the legs that walked out, but the stored state also holds the parent's REALIZED kilometre history and no degrading transfer exists for it; withheld rather than copied, and the group re-earns conditioning by walking"),

  // ── derived: recomputable now, from what the successor already holds ────────────────────────
  socialPressure: entry("RECOMPUTE_FROM_SUCCESSOR_TRUTH", "carried_pending_recompute", false, "a function of population, and the two halves now have DIFFERENT populations — but `applyDemographyToSocialPressure` is module-private to `demography.ts` and routing it is a separate change, so the parent's value is carried and PUBLISHED as an open item rather than copied silently"),
  biomeAdaptation: entry("SHARED_HISTORICAL_FACT", "carried", false, "at departure both halves stand on the SAME tile, so competence in that biome is one fact about the same people; it diverges only once they are in different country, which is a travel-phase question"),
  inheritanceProfile: entry("RECOMPUTE_FROM_SUCCESSOR_TRUTH", "computed", false, "a measurement OF this transfer; the parent's profile reports someone else's inheritance"),
  compressedCorridorSummaries: entry("RECOMPUTE_FROM_SUCCESSOR_TRUTH", "absent", false, "a compression of corridors the successor does not have yet"),

  // ── derived: the inputs do not exist yet ────────────────────────────────────────────────────
  viability: entry("INVALIDATE_UNTIL_LATER_PHASE", "absent", false, "L4 — asserting viability at departure decides the very question Item 4 exists to test"),
  storageCapacity: entry("INVALIDATE_UNTIL_LATER_PHASE", "zero", false, "L3 — material capability is earned; the legacy path's hardcoded 0.16 creates storage from nothing"),
  carryingCapacity: entry("INVALIDATE_UNTIL_LATER_PHASE", "absent", false, "derived from the PARENT's 34 people while the group holds 11"),
  populationDemand: entry("INVALIDATE_UNTIL_LATER_PHASE", "absent", false, "the parent's demand describes the parent's population"),
  perCapitaReturn: entry("INVALIDATE_UNTIL_LATER_PHASE", "absent", false, "a return per head the successor has not yet earned a single unit of"),
  rangeSaturation: entry("INVALIDATE_UNTIL_LATER_PHASE", "absent", false, "saturation of a range the group has not yet used"),
  // ROADMAP ITEM 4 — RECLASSIFIED, and the reason is a measured defect rather than a preference.
  //
  // As `absent` this was right about the HISTORY and wrong about the BODIES. Eight seasons of streaks
  // and classifications belong to a camp this group never was, so inheriting them is an unearned
  // inheritance — but resetting the whole field to absent made `deriveCanonicalNutritionState` return
  // every stress term at 0, so a group walked out of a starving camp measurably comfortable and
  // stayed that way, because a group standing on unobserved ground never closes another interval.
  // The reset that prevented an unearned INHERITANCE produced an unearned IMPROVEMENT.
  //
  // The seam now supplies ONE sample — the season these bodies just lived, re-identified, with no
  // streaks and no window — and refuses the departure if the result is unmeasured or less hungry than
  // the camp it left.
  seasonalSupport: entry("FOUNDER_CARRIED_EMBODIED_BURDEN", "computed", true, "the support HISTORY is a camp's and does not travel; the bodies' current condition is not history and does not improve by walking"),
  returnTrend: entry("INVALIDATE_UNTIL_LATER_PHASE", "absent", false, "a trend over returns nobody in this group made"),
  resourceEcology: entry("INVALIDATE_UNTIL_LATER_PHASE", "absent", true, "recomputed from current support, activity and inherited knowledge, none of which the successor has yet"),
  visibleNature: entry("INVALIDATE_UNTIL_LATER_PHASE", "absent", true, "visible animals and plants require the group's own known range and its own trips"),
  nearbyOpportunity: entry("INVALIDATE_UNTIL_LATER_PHASE", "absent", false, "an opportunity gradient read from the parent's position and knowledge"),
  foragingRadiusState: entry("INVALIDATE_UNTIL_LATER_PHASE", "absent", false, "a radius around a camp the group does not have"),
  pressureState: entry("INVALIDATE_UNTIL_LATER_PHASE", "absent", false, "every pressure term is derived from the parent's population, camp and catchment"),
  conditionProfile: entry("INVALIDATE_UNTIL_LATER_PHASE", "absent", true, "a summary of current-band state, not an inherited identity"),
  bodyCampLogistics: entry("INVALIDATE_UNTIL_LATER_PHASE", "absent", true, "L7 — weather, sickness, carry and camp-waste pressure must follow honest cohorts, condition and location"),
  protoAccessMemory: entry("INVALIDATE_UNTIL_LATER_PHASE", "absent", true, "access expectations require the group's own observed place and contact memory"),
  campRumors: entry("INVALIDATE_UNTIL_LATER_PHASE", "absent", true, "readability of a camp the group does not have"),
  socialTension: entry("INVALIDATE_UNTIL_LATER_PHASE", "absent", true, "tension belongs to the group's own contacts and range"),
  innerFission: entry("INVALIDATE_UNTIL_LATER_PHASE", "absent", true, "internal subgroup pressure is current-band state — and this group IS the outcome of the parent's"),
  foragingAdaptation: entry("INVALIDATE_UNTIL_LATER_PHASE", "absent", true, "empirical learning and desperation are current-band lived experience"),
  dryMarginContext: entry("INVALIDATE_UNTIL_LATER_PHASE", "absent", false, "a water-margin reading taken from the parent's residence"),
  ecologicalStressCauses: entry("INVALIDATE_UNTIL_LATER_PHASE", "absent", false, "a cause summary for stress this group has not experienced"),
  nomadicScalePressure: entry("INVALIDATE_UNTIL_LATER_PHASE", "absent", false, "scale pressure computed at the parent's scale"),
  daughterColonization: entry("INVALIDATE_UNTIL_LATER_PHASE", "absent", false, "colonisation pressure about the PARENT's daughters"),
  frontierDispersal: entry("INVALIDATE_UNTIL_LATER_PHASE", "absent", false, "dispersal pressure read off the parent's crowding and kin overlap"),
  intraSeasonActivity: entry("INVALIDATE_UNTIL_LATER_PHASE", "absent", false, "a summary of activity days the successor has not had"),
  disposition: entry("INVALIDATE_UNTIL_LATER_PHASE", "absent", false, "a stance toward neighbours the group has not met as itself"),
  relationshipMemory: entry("INVALIDATE_UNTIL_LATER_PHASE", "absent", true, "practice, reputation, route and place-character memory is current-band lived relationship state"),
  animalManagement: entry("INVALIDATE_UNTIL_LATER_PHASE", "absent", true, "management depends on the group's own contact, labour, water and camp"),
  frontierKnowledge: entry("INVALIDATE_UNTIL_LATER_PHASE", "absent", true, "M0.6 — shoreline knowledge is FORMED by presence, never inherited"),
  frontierResidence: entry("INVALIDATE_UNTIL_LATER_PHASE", "absent", true, "M0.4 — retention is EARNED at the group's own locus"),
  temporarySeparation: entry("INVALIDATE_UNTIL_LATER_PHASE", "absent", false, "a separation pressure about the parent's own internal splitting"),
  exhaustedRangeAudit: entry("INVALIDATE_UNTIL_LATER_PHASE", "absent", false, "an exhaustion reading over a range the group has not worked"),

  // ── current commitments: the same bodies cannot be in two places ────────────────────────────
  expeditions: entry("RESET_ACTIVE_COMMITMENT", "empty_array", false, "an away party is made of bodies; duplicating the record duplicates the people"),
  pendingInvestigation: entry("RESET_ACTIVE_COMMITMENT", "absent", true, "CORRECTION-26 — the parent took that decision and the successor cannot execute it"),
  currentIntent: entry("RESET_ACTIVE_COMMITMENT", "absent", false, "a `MobilityIntent` is a RESIDENTIAL plan; a provisional group's intent is its lifecycle phase, and holding both would give it two conflicting statements about where it is going"),
  intentHistory: entry("RESET_ACTIVE_COMMITMENT", "empty_array", true, "residential intents the parent formed, most of them before this group existed"),
  seasonalRoute: entry("RESET_ACTIVE_COMMITMENT", "empty_array", true, "a planned round the group has not agreed and cannot yet walk"),
  seasonalRound: entry("RESET_ACTIVE_COMMITMENT", "absent", false, "the parent's annual round, anchored on the parent's camps"),
  seasonalRoundState: entry("RESET_ACTIVE_COMMITMENT", "absent", false, "a decision state inside a round the successor is not on"),
  roundCatchmentRotation: entry("RESET_ACTIVE_COMMITMENT", "absent", false, "a rotation through catchments belonging to the parent's round"),
  residentialAnchor: entry("RESET_ACTIVE_COMMITMENT", "absent", false, "the parent's camp and catchment — the single field most responsible for a departed group behaving as though it were still at home"),
  preDecisionAnchor: entry("RESET_ACTIVE_COMMITMENT", "absent", false, "the same camp, one step earlier"),
  anchorDecision: entry("RESET_ACTIVE_COMMITMENT", "absent", false, "a comparison of anchors the successor did not make"),
  campMovement: entry("RESET_ACTIVE_COMMITMENT", "absent", true, "camp-shift and old-anchor state tested by the parent"),
  currentCampTileId: entry("RESET_ACTIVE_COMMITMENT", "absent", false, "the group has left; it holds no camp until establishment"),
  currentSettlementId: entry("RESET_ACTIVE_COMMITMENT", "absent", false, "a settlement is a residence, and this group has none"),
  consecutiveSeasonsOnTile: entry("RESET_ACTIVE_COMMITMENT", "zero", false, "seasons the PARENT sat on that tile; the successor has sat nowhere"),
  receivedSmokeSignals: entry("RESET_ACTIVE_COMMITMENT", "absent", false, "signals physically received AT the parent's camp by people who may not have left"),

  // ── read models: rebuilt by their own writers, never seeded ─────────────────────────────────
  activityLaborSummary: entry("REBUILD_READ_MODEL", "absent", true, "a current-day parent snapshot, not inherited history"),
  activityOutcomeSummary: entry("REBUILD_READ_MODEL", "absent", true, "the parent's recent activity outcomes"),
  activityShadowSubsistenceSummary: entry("REBUILD_READ_MODEL", "absent", false, "a shadow projection over the parent's subsistence day"),
  activityMemoryUpdateSummary: entry("REBUILD_READ_MODEL", "absent", true, "activity-derived memory effects over the parent's patches"),
  lineageReadability: entry("REBUILD_READ_MODEL", "absent", true, "the display projection is rebuilt from the successor's own lineage metadata"),
  seasonalTimeline: entry("REBUILD_READ_MODEL", "absent", false, "a timeline of seasons the successor did not live"),
  anchorActionTrace: entry("REBUILD_READ_MODEL", "absent", false, "an explanation of an anchor decision the successor did not take"),
  lastResourceScout: entry("REBUILD_READ_MODEL", "absent", true, "2K.5 — the parent's latest scout debug, which carries patch-return guidance"),

  // ── records of things that happened to the PARENT as an entity ──────────────────────────────
  decisionHistory: entry("FORBIDDEN_TO_COPY", "empty_array", true, "a group that has existed for zero days has not deliberated twenty times"),
  movementHistory: entry("FORBIDDEN_TO_COPY", "empty_array", true, "journeys made by the parent, some of them before any founder was born"),
  causalTraces: entry("FORBIDDEN_TO_COPY", "empty_array", true, "traces of the parent's own causal history; the successor's founding trace belongs with the founding event, which Direction D does not write at departure"),
  eventHistory: entry("FORBIDDEN_TO_COPY", "absent", true, "the parent's selected-band history"),
  recentIntraSeasonTrips: entry("FORBIDDEN_TO_COPY", "empty_array", true, "trips run from the parent's camp, by a labour pool that included people who stayed"),
  lastIntraSeasonTrip: entry("FORBIDDEN_TO_COPY", "absent", true, "the parent's own most recent trip"),
  seasonalFoodReceipts: entry("FORBIDDEN_TO_COPY", "absent", true, "RECOVERY-12 — food physically returned to the parent's camp; inheriting it is eating twice"),
  recentExpeditionOutcomes: entry("FORBIDDEN_TO_COPY", "absent", false, "outcomes of parties the successor did not send and did not receive"),
  recentResidentialMoveEvents: entry("FORBIDDEN_TO_COPY", "empty_array", true, "RESIDENTIAL-MOVE-1 — relocations of the parent's residence"),
  residentialMovementIntentOutcomes: entry("FORBIDDEN_TO_COPY", "absent", true, "movement-intent outcomes the successor has not lived"),
  recentInvestigationOutcomes: entry("FORBIDDEN_TO_COPY", "empty_array", true, "terminal outcomes of the parent's investigations"),
  recentScoutLearning: entry("FORBIDDEN_TO_COPY", "absent", true, "2K.1I-A — the parent's scout-learning ring"),
  lastPlantUseTest: entry("FORBIDDEN_TO_COPY", "absent", true, "2K.2E — a plant test performed by the parent"),
  recentPlantUseTests: entry("FORBIDDEN_TO_COPY", "absent", true, "2K.2E — cautious-testing history is not inherited competence"),
  lastCauseSpecificEvent: entry("FORBIDDEN_TO_COPY", "absent", true, "2K.3A — a poisoning or illness event in the parent's camp"),
  recentCauseSpecificEvents: entry("FORBIDDEN_TO_COPY", "absent", true, "2K.3A — the parent's caution ring"),
  encounterRecords: entry("FORBIDDEN_TO_COPY", "empty_array", true, "meetings the parent had, some with bands the successor will never see"),
  contactMemories: entry("FORBIDDEN_TO_COPY", "empty_record", true, "CORRECTION-29 — a contact memory is the ONLY thing that makes a distant band a friction candidate; copying them hands the successor the parent's whole social world"),
  encounterPerceptions: entry("FORBIDDEN_TO_COPY", "empty_array", true, "perceptions formed by people at the parent's camp"),
  encounterResponses: entry("FORBIDDEN_TO_COPY", "empty_array", true, "response distributions measured on the parent"),
  reportedKnowledge: entry("FORBIDDEN_TO_COPY", "absent", true, "reports are receiver-specific; the successor was not the receiver"),
  visibleLandscapeCues: entry("FORBIDDEN_TO_COPY", "absent", true, "current-horizon cues seen from the parent's camp"),
  recentRangeFrictionEvents: entry("FORBIDDEN_TO_COPY", "absent", true, "CORRECTION-30 — observer-specific notices; the successor observed none of them"),
  verificationEvidence: entry("FORBIDDEN_TO_COPY", "absent", false, "CORRECTION-23B — it did not walk to those places and did not draw that water"),
  frontierVerificationAttempts: entry("FORBIDDEN_TO_COPY", "absent", false, "retry memory for questions the successor never asked"),
  probeMemory: entry("FORBIDDEN_TO_COPY", "absent", true, "2K.1G — the parent's probe history and diminishing returns"),
  sideProbeMemory: entry("FORBIDDEN_TO_COPY", "absent", true, "M0.16B — a cooldown and a lifetime budget the successor did not spend"),
  proactiveInfoMemory: entry("FORBIDDEN_TO_COPY", "absent", true, "2K.6B — a learning rhythm the successor has not established"),
  corridorRelocation: entry("FORBIDDEN_TO_COPY", "absent", true, "M0.8-A — the parent's settle-then-step cooldown"),
  frontierProbeCadence: entry("FORBIDDEN_TO_COPY", "absent", true, "M0.8-B — the parent's burst-then-rest rhythm"),
  corridorHeading: entry("FORBIDDEN_TO_COPY", "absent", true, "M0.9 — a bearing EARNED from the parent's realized motion"),
  lastFrontierExplorationTick: entry("FORBIDDEN_TO_COPY", "absent", false, "CORRECTION-17 §20 — a suppression window opened by a party the parent sent; inheriting it silences the successor's first honest look"),
  seasonalEcologyMemory: entry("FORBIDDEN_TO_COPY", "absent", true, "ECO-SEASON-1 — learned by the parent's own observation"),
  usePressure: entry("FORBIDDEN_TO_COPY", "empty_record", true, "the parent's own accrued pressure on the parent's tiles"),
  protoCampMemory: entry("FORBIDDEN_TO_COPY", "absent", true, "camp-like places require the group's own repeated use — and it describes a residence this group does not have"),
  anchorMemories: entry("FORBIDDEN_TO_COPY", "absent", false, "remembered anchors are the parent's camps"),

  // ── retained for schema and history, with no lived writer ───────────────────────────────────
  territorialPressure: entry("LEGACY_COMPATIBILITY_GATED", "carried", false, "CORRECTION-35 — behaviourally inert, written once at spawn and once at daughter creation, with all three behavioural readers removed; carried so serialized worlds stay readable"),
  status: entry("LEGACY_COMPATIBILITY_GATED", "carried", false, "BandStatus mixes residential activity with a sticky `splitting` marker and one terminal value; the provisional phase lives in `provisionalSuccessor`, and re-deriving status here would give the marker a second writer"),
} satisfies Record<keyof Band, FieldTransferPolicyEntry>;

/** Every field in one class, in declaration order. */
export function fieldsInTransferClass(transferClass: FieldTransferClass): readonly (keyof Band)[] {
  return (Object.keys(FISSION_FIELD_TRANSFER_POLICY) as (keyof Band)[]).filter(
    (key) => FISSION_FIELD_TRANSFER_POLICY[key].transferClass === transferClass,
  );
}

/**
 * The legacy clone guard's registry, DERIVED so `demography.ts` and this table cannot drift apart.
 *
 * `createDaughterBand` spreads `{ ...parent }` and must explicitly handle every field a daughter may
 * not inherit wholesale. That set is a property of the field, not of the code that happens to handle
 * it, so it belongs here — and `scripts/fissionFieldTransferAudit.mjs` asserts the derived list is
 * SET-EQUAL to the 78-field literal it replaced, which is what makes this consolidation
 * behaviour-free rather than merely intended to be.
 */
export function deriveLegacyNonCloneableFields(): readonly (keyof Band)[] {
  return (Object.keys(FISSION_FIELD_TRANSFER_POLICY) as (keyof Band)[]).filter(
    (key) => FISSION_FIELD_TRANSFER_POLICY[key].legacyGuardRegistered,
  );
}

/**
 * Fields this policy forbids copying wholesale that the legacy clone guard does NOT register.
 *
 * **This is published legacy debt, not a repair.** Every field here is one `createDaughterBand`
 * hands its daughter by reference through the spread while this table says it may not be. Repairing
 * them changes ordinary ecology on every natural fission and needs its own before/after evidence, so
 * the disagreement is named and measured rather than quietly closed.
 */
export function legacyUnregisteredNonTransferableFields(): readonly (keyof Band)[] {
  const forbiddenClasses: readonly FieldTransferClass[] = [
    "FORBIDDEN_TO_COPY",
    "INVALIDATE_UNTIL_LATER_PHASE",
    "RESET_ACTIVE_COMMITMENT",
    "REBUILD_READ_MODEL",
    "DEGRADED_OR_PARTIAL_INHERITANCE",
  ];
  return (Object.keys(FISSION_FIELD_TRANSFER_POLICY) as (keyof Band)[]).filter((key) => {
    const policy = FISSION_FIELD_TRANSFER_POLICY[key];
    return !policy.legacyGuardRegistered && forbiddenClasses.includes(policy.transferClass);
  });
}

/**
 * Every reset the policy demands, as a partial `Band` to spread over `{ ...parent }`.
 *
 * **This is what stops a NEW field from bypassing the seam.** A field classified `absent`,
 * `empty_array`, `empty_record` or `zero` is reset by virtue of being classified, with no edit to
 * `fissionDepartureSeam.ts` at all — which is the difference between a policy and a list of
 * overrides someone has to remember to extend.
 *
 * The cast is confined to this one function: the shapes are chosen per field in the table above and
 * checked against the real value by `auditSuccessorTransfer` on the constructed band, so a wrong
 * shape is caught on the object rather than trusted here.
 */
export function buildPolicyStructuralResets(): Partial<Band> {
  const resets: Record<string, unknown> = {};

  for (const key of Object.keys(FISSION_FIELD_TRANSFER_POLICY) as (keyof Band)[]) {
    switch (FISSION_FIELD_TRANSFER_POLICY[key].successorValue) {
      case "absent":
        resets[key] = undefined;
        break;
      case "empty_array":
        resets[key] = [];
        break;
      case "empty_record":
        resets[key] = {};
        break;
      case "zero":
        resets[key] = 0;
        break;
      default:
        break;
    }
  }

  return resets as Partial<Band>;
}

/**
 * Fields the successor holds the parent's derived value for because the honest recompute or degrading
 * transfer is not routed to this seam yet.
 *
 * Published so the gap is an enumerable fact rather than a silent copy. Every entry is an open item
 * for the phase that gives it a real writer.
 */
export function pendingRecomputeFields(): readonly (keyof Band)[] {
  return (Object.keys(FISSION_FIELD_TRANSFER_POLICY) as (keyof Band)[]).filter(
    (key) => FISSION_FIELD_TRANSFER_POLICY[key].successorValue === "carried_pending_recompute",
  );
}

/** One field the constructed successor got wrong, named with the rule it broke. */
export interface TransferPolicyViolation {
  readonly field: keyof Band;
  readonly transferClass: FieldTransferClass;
  readonly expected: SuccessorValueShape;
  readonly defect:
    | "still_the_parents_object"
    | "identical_to_the_parent"
    | "should_be_absent"
    | "should_be_an_empty_array"
    | "should_be_an_empty_record"
    | "should_be_zero"
    | "improved_on_the_parent"
    | "should_still_be_the_parents_value_until_recompute_is_routed";
}

const isEmptyArray = (value: unknown): boolean => Array.isArray(value) && value.length === 0;
const isEmptyRecord = (value: unknown): boolean =>
  typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length === 0;

/**
 * Check a constructed successor against the table, field by field, over EVERY `keyof Band`.
 *
 * This is the runtime half of the guarantee. The type system stops a new field being unclassified;
 * this stops a classified field being constructed wrongly — including by a future `{ ...parent }`
 * spread that quietly starts carrying something new.
 *
 * Pure. It reads the two bands it is handed and nothing else.
 */
export function auditSuccessorTransfer(parent: Band, successor: Band): readonly TransferPolicyViolation[] {
  const violations: TransferPolicyViolation[] = [];

  for (const key of Object.keys(FISSION_FIELD_TRANSFER_POLICY) as (keyof Band)[]) {
    const policy = FISSION_FIELD_TRANSFER_POLICY[key];
    const parentValue = parent[key];
    const successorValue = successor[key];
    const report = (defect: TransferPolicyViolation["defect"]): void => {
      violations.push({ field: key, transferClass: policy.transferClass, expected: policy.successorValue, defect });
    };

    switch (policy.successorValue) {
      case "absent":
        if (successorValue !== undefined) report("should_be_absent");
        break;
      case "empty_array":
        if (!isEmptyArray(successorValue)) report("should_be_an_empty_array");
        else if (successorValue === parentValue) report("still_the_parents_object");
        break;
      case "empty_record":
        if (!isEmptyRecord(successorValue)) report("should_be_an_empty_record");
        else if (successorValue === parentValue) report("still_the_parents_object");
        break;
      case "zero":
        if (successorValue !== 0) report("should_be_zero");
        break;
      case "computed":
        // The whole point of the class: whatever the seam produced, it must not BE the parent's.
        if (parentValue !== undefined && successorValue === parentValue && typeof parentValue === "object") {
          report("still_the_parents_object");
        } else if (typeof parentValue === "string" && successorValue === parentValue) {
          report("identical_to_the_parent");
        }
        break;
      case "carried_no_relief":
        // Scalar burdens compare directly; object-valued ones (`health`) compare TERM BY TERM, so a
        // burden cannot be softened on one axis while another rises to hide it in an average.
        if (typeof parentValue === "number" && typeof successorValue === "number") {
          if (successorValue < parentValue) report("improved_on_the_parent");
        } else if (
          typeof parentValue === "object" && parentValue !== null &&
          typeof successorValue === "object" && successorValue !== null
        ) {
          const p = parentValue as Record<string, unknown>;
          const s = successorValue as Record<string, unknown>;
          for (const term of Object.keys(p)) {
            const pt = p[term];
            const st = s[term];
            if (typeof pt === "number" && typeof st === "number" && st < pt) {
              report("improved_on_the_parent");
              break;
            }
          }
        }
        break;
      case "carried_pending_recompute":
        // Deliberately the STRICT test: while the recompute is unrouted the value must still be the
        // parent's, so a half-finished recompute cannot appear as a quiet partial improvement.
        if (successorValue !== parentValue) {
          report("should_still_be_the_parents_value_until_recompute_is_routed");
        }
        break;
      case "carried":
        break;
    }
  }

  return violations;
}
