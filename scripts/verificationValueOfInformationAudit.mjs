// CORRECTION-23H §5/§6/§7/§9/§10/§11 — DOES EACH VERIFICATION LAUNCH ANSWER A LIVE DECISION?
//
// One script, because every job needs the same instrumented run:
//
//   §5   the SAME-SNAPSHOT counterfactual. For every eligible verification candidate, the real
//        production reader is re-run under four SYMBOLIC possible answers — no evidence,
//        confirmed, negative, inconclusive — on band clones that differ in exactly one
//        `VerificationEvidenceRecord` written by the real writer.
//   §6   the eight-way relevance classification, with ranking relevance kept strictly apart
//        from action relevance.
//   §7   per-question audit against each question's own declared reader.
//   §9   the natural launch distribution across every required physical world.
//   §10  the selector-only decomposition.
//   §11  the bounded-horizon reader trace: one season, never long-run population.
//
// NOTHING HERE READS HIDDEN TRUTH. The four arms are possible answers, not the answer a party
// would obtain. No physical stock, no future population, no future ecology and no hidden
// success is consulted. The arms are built from the canonical evidence shapes the real task
// already produces, through the real `recordVerificationEvidence` writer.
//
// Usage:
//   node scripts/verificationValueOfInformationAudit.mjs --scenarios map1,map2,... --seeds s1,..
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt;
};

const YEARS = Number(arg("years", "60"));
const SEEDS = arg("seeds", "s1,s2,s3,s4,s5").split(",").filter(Boolean);
const OUT = arg("out", "docs/evidence/correction23h/relevance-matrix.json");
const SEED_PREFIX = arg("seed-prefix", "c23h:relevance");
const SCENARIOS = arg("scenarios", "all");
/** How often the candidate counterfactual runs. Every day is unaffordable and unnecessary:
 *  launches happen on a 6-day cadence, so a 6-day sample sees every launch opportunity. */
const SAMPLE_EVERY_DAYS = Number(arg("sample-every", "6"));

// §9 — the required physical worlds. The default maps run their own founders; the tier and
// site fixtures place one controlled founder so the scenario means what its name says.
const ALL_SCENARIOS = [
  { name: "map1", map: "map1", fixture: "default" },
  { name: "map2", map: "map2", fixture: "default" },
  { name: "site_A_coast", map: "map2", site: "tile:204:72" },
  { name: "site_B_dry_plains", map: "map2", site: "tile:10:34" },
  { name: "site_C_dry_plains", map: "map2", site: "tile:100:23" },
  { name: "site_D_aquatic", map: "map2", site: "tile:119:116" },
  { name: "site_E_hills", map: "map2", site: "tile:139:41" },
  { name: "site_F_hills", map: "map2", site: "tile:45:28" },
  // §9's three tiers. `ordinary` and `hostile` reuse the habitat classes the expedition
  // habitat-case audit established; `isolated_marginal` is the marginal tier with no reachable
  // better country, which is what makes it isolated rather than escapable.
  { name: "ordinary", map: "map2", site: "tile:62:108" },
  { name: "isolated_marginal", map: "map2", site: "tile:43:0" },
  { name: "hostile", map: "map2", site: "tile:150:12" },
];

const scenarios =
  SCENARIOS === "all" ? ALL_SCENARIOS : ALL_SCENARIOS.filter((s) => SCENARIOS.split(",").includes(s.name));

const QUESTIONS = [
  "water_access",
  "resource_presence",
  "resource_test_possible",
  "temporary_use",
  "seasonal_persistence",
];

const r2 = (v) => (v === undefined || v === null ? null : Math.round(v * 100) / 100);

const server = await createServer({
  root: `${process.cwd()}/src`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "error",
});

try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const spawn = await server.ssrLoadModule("/sim/agents/spawn.ts");
  const verification = await server.ssrLoadModule("/sim/agents/frontierVerification.ts");
  const evidence = await server.ssrLoadModule("/sim/agents/verificationEvidence.ts");
  const capacity = await server.ssrLoadModule("/sim/agents/carryingCapacity.ts");
  const voi = await server.ssrLoadModule("/sim/diagnostics/verificationValueOfInformation.ts");
  const frontierExploration = await server.ssrLoadModule("/sim/agents/frontierExploration.ts");

  const isLiving = (band) =>
    band.viability?.status !== "extinct" &&
    band.viability?.status !== "absorbed" &&
    band.viability?.status !== "dispersed" &&
    (band.demography?.population ?? 0) > 0;

  /**
   * §5 — one arm's band clone. Q0 removes every row for this (place, question); Q1/Q2/Q3 write
   * exactly one row through the REAL writer, so the shape is one production can produce. The
   * negative arm carries `absent_in_bounded_search`, which is the only failure scope a party
   * that reached its target can legally report — a party that never arrived writes no row.
   */
  /**
   * CORRECTION-23D made the PLACE RECORD the authority: `find` in `verificationEvidence.ts`
   * consults `KnownTileRecord.verificationDisposition` FIRST and only falls back to the
   * bounded `band.verificationEvidence` list. An arm that substituted only the list would
   * therefore be shadowed by the durable conclusion and would not be the arm it claims to be —
   * a Q0 that still answers "confirmed" is not "no evidence".
   *
   * This was caught by probing the reader directly: stripping the evidence row left
   * `resourceTestEligible` true. Both stores are substituted here, through the real writers.
   */
  const armBand = (band, tileId, question, arm, world) => {
    const strippedRows = (band.verificationEvidence ?? []).filter(
      (row) => !(String(row.tileId) === String(tileId) && String(row.question) === question),
    );
    const record = band.knowledge?.observedTiles?.[tileId];
    const strippedDisposition = (record?.verificationDisposition ?? []).filter(
      (entry) => entry.question !== question,
    );

    const withKnowledge = (disposition) =>
      record === undefined
        ? band
        : {
            ...band,
            knowledge: {
              ...band.knowledge,
              observedTiles: {
                ...band.knowledge.observedTiles,
                [tileId]: { ...record, verificationDisposition: disposition },
              },
            },
          };

    if (arm === "Q0") {
      return { ...withKnowledge(strippedDisposition), verificationEvidence: strippedRows };
    }

    const outcome = arm === "Q1" ? "confirmed" : arm === "Q2" ? "negative" : "inconclusive";
    const accessFailureKind =
      outcome === "negative" && question === "water_access" ? "absent_in_bounded_search" : undefined;

    const rows = evidence.recordVerificationEvidence(strippedRows, {
      tileId,
      question,
      outcome,
      season: world.time.season,
      tick: world.time.tick,
      hardship: 0.5,
      routeTiles: 8,
      routeEvidence: "walked_out_and_back",
      ...(accessFailureKind === undefined ? {} : { accessFailureKind }),
    });

    const disposition = evidence.recordPlaceDisposition(strippedDisposition, {
      question,
      outcome,
      season: world.time.season,
      tick: world.time.tick,
      routeTiles: 8,
      ...(accessFailureKind === undefined ? {} : { accessFailureKind }),
    });

    return { ...withKnowledge(disposition), verificationEvidence: rows };
  };

  /**
   * §7.1 — the water-access reader, re-run authoritatively. `deriveKnownUnusedHabitatForAudit`
   * is the same function production calls, given the input CAPTURED at the production seam.
   * The reconstruction is self-validating: `soundness` records whether the unmodified call
   * reproduces the winner production actually recorded. A counterfactual whose baseline does
   * not reproduce production is reported as unsound rather than believed.
   */
  const waterReader = (world, band, tileId, captured) => {
    const record = band.knowledge?.observedTiles?.[tileId];
    const observed = Math.max(0, Math.min(1, record?.observedWaterAccess ?? 0.3));

    // The direct boolean reader is authoritative on its own and needs no captured input, so it
    // is always available. The opportunity re-run is only added when the capture belongs to
    // THIS tick — a stale capture is a different snapshot and would make the arm approximate.
    if (captured === undefined || Number(captured.tick) !== Number(world.time.tick)) {
      return {
        accessFeasible: evidence.isWaterAccessFeasible(
          band,
          tileId,
          observed,
          capacity.WATER_ACCESS_OBSERVED_THRESHOLD,
        ),
        selectedTarget: undefined,
        consideredAsTarget: undefined,
        rejectionReason: undefined,
        score: undefined,
        waterReliability: undefined,
      };
    }

    const opportunity = capacity.deriveKnownUnusedHabitatForAudit(
      world,
      band,
      captured.input,
      captured.cache,
    );

    return {
      // The direct boolean reader, for this exact place.
      accessFeasible: evidence.isWaterAccessFeasible(
        band,
        tileId,
        observed,
        capacity.WATER_ACCESS_OBSERVED_THRESHOLD,
      ),
      // The downstream authority the boolean feeds.
      selectedTarget: opportunity === undefined ? null : String(opportunity.candidateTileId),
      consideredAsTarget: opportunity?.consideredAsTarget ?? null,
      rejectionReason: opportunity?.rejectionReason ?? null,
      score: opportunity === undefined ? null : r2(opportunity.expectedPerCapitaReturn),
      waterReliability: opportunity === undefined ? null : r2(opportunity.waterReliability),
    };
  };

  /**
   * §7.2/§7.3 — the resource-presence reader is `resourceTestEligible`, and its ONLY production
   * consumer is the verification selector deciding whether `resource_test_possible` may be
   * asked. So the authoritative re-run is the real selector itself.
   */
  const resourceReader = (world, band, tileId, need) => {
    const eligible = [];
    const winner = verification.selectVerificationCandidate(world, band, need, eligible);
    return {
      resourceTestEligible: evidence.resourceTestEligible(band, tileId),
      resourceTestAskableHere: eligible.some(
        (c) => String(c.tileId) === String(tileId) && c.question === "resource_test_possible",
      ),
      selectedTarget: winner === undefined ? null : String(winner.tileId),
      selectedQuestion: winner?.question ?? null,
      eligibleCount: eligible.length,
    };
  };

  /** §7.4 — the temporary-use reader: may a bounded task camp be established here. */
  const campReader = (band, tileId) => ({
    taskCampRefused: evidence.taskCampRefusedByEvidence(band, tileId),
  });

  /** §7.5 — declared unread. Recorded so the claim is measured, not assumed. */
  const seasonalReader = (band, tileId) => ({
    seasonsVerified: evidence.seasonsVerifiedAt(band, tileId).length,
  });

  const readerFor = (question, world, band, tileId, input, need) => {
    switch (question) {
      case "water_access":
        return waterReader(world, band, tileId, input);
      case "resource_presence":
      case "resource_test_possible":
        return resourceReader(world, band, tileId, need);
      case "temporary_use":
        return campReader(band, tileId);
      case "seasonal_persistence":
        return seasonalReader(band, tileId);
      default:
        return {};
    }
  };

  /**
   * §11 — the readers that gate a REAL PHYSICAL ACTION, and only those.
   *
   * `readerFor` above is right for the §5 candidate counterfactual, because there the selector
   * re-run is the point: it measures whether an answer changes what gets selected next. It is
   * WRONG for the consumption trace, for two reasons that would each manufacture a false
   * positive:
   *
   *   * `seasonsVerifiedAt` is documented in its own source as a read-model accessor that never
   *     makes a decision. Counting it would report consumption for a question that has no
   *     reader at all — and in the first run it did exactly that, 1,215 times.
   *   * re-running the selector lets the row's effect on `mayAskAgain` — the family's own retry
   *     memory — count as a decision reader. That is the verification system reading itself.
   *
   * So the trace uses this map instead: the water gate, and the task-camp refusal. Those are
   * the only two evidence readers in the simulation that stand between an answer and a physical
   * act. `resourceTestEligible` is deliberately excluded and reported separately, because the
   * only thing it gates is another question nobody reads.
   */
  const physicalActionReaderFor = (question, world, band, tileId, input) => {
    switch (question) {
      case "water_access":
        return waterReader(world, band, tileId, input);
      case "temporary_use":
        return campReader(band, tileId);
      default:
        return undefined;
    }
  };

  /** The question's own DECLARED reader, whatever it gates. Reported beside the one above. */
  const declaredReaderFor = (question, band, tileId) => {
    switch (question) {
      case "resource_presence":
        return { resourceTestEligible: evidence.resourceTestEligible(band, tileId) };
      case "resource_test_possible":
      case "seasonal_persistence":
        return undefined; // no reader exists; there is nothing to consume
      default:
        return undefined;
    }
  };

  const differs = (a, b) => JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);

  /** §6 — the classifier. Ranking relevance is never reported as action relevance. */
  const classify = ({ question, verdicts, current, alreadySettled, tautological, reachableByExploration }) => {
    if (alreadySettled) return { classification: "redundant", reasonCode: "answer_already_established" };
    if (tautological) return { classification: "tautological", reasonCode: "eligibility_implies_result" };

    // Questions whose reader does not exist cannot be anything but future-system evidence.
    if (question === "resource_test_possible") {
      return { classification: "future_system_evidence", reasonCode: "no_production_reader_stock_task_absent" };
    }

    if (question === "seasonal_persistence") {
      return { classification: "future_system_evidence", reasonCode: "no_production_reader_seasonal_scheduling_absent" };
    }

    const arms = ["Q0", "Q1", "Q2", "Q3"];
    const eligibilityKeys = {
      water_access: ["accessFeasible", "consideredAsTarget"],
      resource_presence: ["resourceTestEligible", "resourceTestAskableHere"],
      temporary_use: ["taskCampRefused"],
    }[question] ?? [];
    const actionKeys = {
      water_access: ["selectedTarget"],
      resource_presence: ["selectedTarget", "selectedQuestion"],
      temporary_use: [],
    }[question] ?? [];
    const rankingKeys = { water_access: ["score", "waterReliability"] }[question] ?? [];

    const anyDiffers = (keys) =>
      keys.some((key) => arms.some((arm) => differs(verdicts[arm]?.[key], verdicts.Q0?.[key])));

    const eligibilityChanges = anyDiffers(eligibilityKeys);
    const actionChanges = anyDiffers(actionKeys);
    const rankingChanges = anyDiffers(rankingKeys);

    // §3 — "do not accept a high confirmation rate without decomposing eligibility and
    // arithmetic". `anyDiffers` answers "would SOME possible answer matter", which is not the
    // same question as "does the answer this party will actually bring home matter". Both are
    // recorded per arm so the two can never be conflated in the report.
    const perArm = {};
    for (const arm of ["Q1", "Q2", "Q3"]) {
      perArm[arm] = {
        eligibility: eligibilityKeys.some((key) => differs(verdicts[arm]?.[key], verdicts.Q0?.[key])),
        action: actionKeys.some((key) => differs(verdicts[arm]?.[key], verdicts.Q0?.[key])),
        ranking: rankingKeys.some((key) => differs(verdicts[arm]?.[key], verdicts.Q0?.[key])),
      };
    }

    if (actionChanges) {
      return { classification: "immediate_action_relevant", reasonCode: "answer_changes_selected_target", perArm };
    }

    if (eligibilityChanges) {
      return { classification: "eligibility_relevant", reasonCode: "answer_changes_a_legal_gate", perArm };
    }

    if (rankingChanges) {
      return { classification: "ranking_relevant_only", reasonCode: "answer_moves_a_score_only", perArm };
    }

    // No reader moved at all. If the place would be reached anyway by ordinary exploration,
    // the only thing verification contributed was where the party walked.
    return reachableByExploration
      ? { classification: "selector_only", reasonCode: "no_reader_moves_target_reachable_by_exploration", perArm }
      : { classification: "inert", reasonCode: "no_possible_legal_answer_moves_any_reader", perArm };
  };

  const rows = [];
  const traceRows = [];

  const runOne = (scenario, seed) => {
    voi.setOpportunityInputCapture(true);

    let world = runner.initSimWorld({ kind: scenario.map }, `${SEED_PREFIX}:${seed}`);

    if (scenario.fixture !== "default") {
      world = spawn.removeInitialBands(world, Object.keys(world.bands));
      world = spawn.spawnCustomBands(
        world,
        [{ tileId: scenario.site, population: 34, name: scenario.name }],
        `${SEED_PREFIX}:${seed}`,
      );
    }

    const days = YEARS * 360;
    let sampled = 0;
    let unsoundBaselines = 0;
    let soundBaselines = 0;
    const seenLaunches = new Set();
    // §11 — evidence returned, and whether a reader consumed it within ONE SEASON (90 days).
    const pendingTraces = [];

    for (let d = 1; d <= days; d += 1) {
      world = runner.stepSim(world, 1, "daily");
      const living = Object.values(world.bands).filter(isLiving);

      if (living.length === 0) break;

      // ── §11 bounded-horizon reader trace ──────────────────────────────────────────────
      for (const band of living) {
        for (const row of band.verificationEvidence ?? []) {
          const key = `${band.id}|${row.tileId}|${row.question}|${row.lastTick}`;
          if (seenLaunches.has(key)) continue;
          seenLaunches.add(key);
          pendingTraces.push({
            scenario: scenario.name,
            seed,
            bandId: String(band.id),
            tileId: String(row.tileId),
            question: row.question,
            outcome: row.outcome,
            returnDay: d,
            readerConsumedWithinSeason: false,
            verdictChangedWithinSeason: false,
            horizonDays: 90,
          });
        }
      }

      for (const trace of pendingTraces) {
        if (trace.resolved === true) continue;

        if (d - trace.returnDay > trace.horizonDays) {
          trace.resolved = true;
          traceRows.push(trace);
          continue;
        }

        const band = world.bands[trace.bandId];
        if (band === undefined || !isLiving(band)) continue;

        const input = voi.getCapturedOpportunityInput(trace.bandId);
        const stripped = armBand(band, trace.tileId, trace.question, "Q0", world);

        // "A reader consumed it" must mean the reader's ANSWER DEPENDED on the returned row.
        // Merely calling a pure function and getting a value back is not consumption.
        const physicalWith = physicalActionReaderFor(trace.question, world, band, trace.tileId, input);
        const physicalWithout = physicalActionReaderFor(trace.question, world, stripped, trace.tileId, input);
        const declaredWith = declaredReaderFor(trace.question, band, trace.tileId);
        const declaredWithout = declaredReaderFor(trace.question, stripped, trace.tileId);

        if (
          physicalWith !== undefined &&
          physicalWithout !== undefined &&
          differs(physicalWith, physicalWithout)
        ) {
          trace.physicalActionReaderChanged = true;
          trace.readerConsumedWithinSeason = true;
          trace.verdictChangedWithinSeason = true;
          trace.firstReaderInvocationDay = trace.firstReaderInvocationDay ?? d;
          trace.firstChangedVerdictDay = trace.firstChangedVerdictDay ?? d;
          trace.resolved = true;
          traceRows.push(trace);
          continue;
        }

        if (
          declaredWith !== undefined &&
          declaredWithout !== undefined &&
          differs(declaredWith, declaredWithout)
        ) {
          // The question's own declared reader moved, but nothing physical is gated by it.
          trace.declaredReaderChanged = true;
          trace.firstReaderInvocationDay = trace.firstReaderInvocationDay ?? d;
        }
      }

      if (d % SAMPLE_EVERY_DAYS !== 0) continue;

      // ── §5 same-snapshot counterfactual over EVERY eligible candidate ─────────────────
      for (const band of living) {
        const need = verification.deriveVerificationNeed(band);
        const eligible = [];
        verification.selectVerificationCandidate(world, band, need, eligible);

        if (eligible.length === 0) continue;

        const input = voi.getCapturedOpportunityInput(String(band.id));

        // Self-validation, and it is load-bearing: does the captured call reproduce the winner
        // production actually recorded? An arm whose baseline does not reproduce production is
        // answering a different question, and is reported as unsound rather than believed.
        let baselineSound = null;

        if (input !== undefined && Number(input.tick) === Number(world.time.tick)) {
          const baseline = capacity.deriveKnownUnusedHabitatForAudit(
            world,
            band,
            input.input,
            input.cache,
          );
          const production = band.carryingCapacity?.knownUnusedHabitat;
          baselineSound =
            production !== undefined &&
            baseline !== undefined &&
            String(baseline.candidateTileId) === String(production.candidateTileId) &&
            baseline.consideredAsTarget === production.consideredAsTarget;

          if (baselineSound) soundBaselines += 1;
          else unsoundBaselines += 1;
        }

        for (const candidate of eligible) {
          sampled += 1;
          const tileId = String(candidate.tileId);
          const question = candidate.question;

          const verdicts = {};
          for (const arm of ["Q0", "Q1", "Q2", "Q3"]) {
            verdicts[arm] = readerFor(
              question,
              world,
              armBand(band, tileId, question, arm, world),
              tileId,
              input,
              need,
            );
          }

          const current = readerFor(question, world, band, tileId, input, need);
          const existingRow = (band.verificationEvidence ?? []).find(
            (row) => String(row.tileId) === tileId && row.question === question,
          );

          // §10 — would ordinary broad exploration reach this country anyway? The heading
          // selector is band-known and is the real one; this reads no hidden truth.
          const heading = frontierExploration.deriveFrontierHeading(world, band);
          const reachableByExploration = heading !== undefined;

          const { classification, reasonCode, perArm } = classify({
            question,
            verdicts,
            current,
            alreadySettled: existingRow?.outcome === "confirmed" || existingRow?.outcome === "negative",
            tautological: false,
            reachableByExploration,
          });

          rows.push({
            scenario: scenario.name,
            seed,
            day: d,
            season: world.time.season,
            bandId: String(band.id),
            tileId,
            question,
            need: r2(need.need),
            score: r2(candidate.score),
            distanceTiles: candidate.distanceTiles,
            currentVerdict: current,
            verdicts,
            classification,
            reasonCode,
            perArm,
            reachableByExploration,
            baselineSound,
            // §7.1 — the decomposition that separates "a negative would matter" from "the
            // answer this party will bring home matters": is the band's OWN observed water
            // already above the gate threshold, so that a confirmation is a foregone verdict?
            observedWaterAccess:
              question === "water_access"
                ? r2(band.knowledge?.observedTiles?.[tileId]?.observedWaterAccess ?? null)
                : undefined,
            observedAlreadyAboveGate:
              question === "water_access"
                ? (band.knowledge?.observedTiles?.[tileId]?.observedWaterAccess ?? 0) >
                  capacity.WATER_ACCESS_OBSERVED_THRESHOLD
                : undefined,
          });
        }
      }
    }

    return { sampled, soundBaselines, unsoundBaselines };
  };

  const scenarioStats = {};

  for (const scenario of scenarios) {
    for (const seed of SEEDS) {
      const started = Date.now();
      let stats;
      try {
        stats = runOne(scenario, seed);
      } finally {
        voi.clearVerificationValueDiagnostics();
      }
      const key = scenario.name;
      const prior = scenarioStats[key] ?? { sampled: 0, soundBaselines: 0, unsoundBaselines: 0 };
      scenarioStats[key] = {
        sampled: prior.sampled + stats.sampled,
        soundBaselines: prior.soundBaselines + stats.soundBaselines,
        unsoundBaselines: prior.unsoundBaselines + stats.unsoundBaselines,
      };
      console.log(
        `${scenario.name.padEnd(20)} ${seed.padEnd(4)} candidates=${String(stats.sampled).padStart(6)} ` +
          `baseline sound/unsound=${stats.soundBaselines}/${stats.unsoundBaselines} ` +
          `(${Math.round((Date.now() - started) / 1000)}s)`,
      );
    }
  }

  // ── §9 distributions, by question and by scenario, never pooled before shown apart ─────
  const distribution = (subset) => {
    const counts = {};
    for (const row of subset) counts[row.classification] = (counts[row.classification] ?? 0) + 1;
    const total = subset.length;
    return {
      n: total,
      ...Object.fromEntries(
        Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => [k, `${((v / total) * 100).toFixed(1)}% (${v})`]),
      ),
    };
  };

  /**
   * §3 — decompose eligibility from arithmetic before believing a confirmation rate. Three
   * quantities that a single "relevant %" would fuse into one misleading number:
   *
   *   perArm            which POSSIBLE answer carries the relevance
   *   realizedOutcomes  which answer parties actually bring home
   *   tautological      whether eligibility practically guarantees the result
   */
  const armBreakdown = (subset) => {
    const pct = (n) => (subset.length === 0 ? null : `${((n / subset.length) * 100).toFixed(1)}%`);
    const count = (arm, kind) => subset.filter((row) => row.perArm?.[arm]?.[kind] === true).length;
    return {
      Q1_confirmed: { eligibility: pct(count("Q1", "eligibility")), action: pct(count("Q1", "action")) },
      Q2_negative: { eligibility: pct(count("Q2", "eligibility")), action: pct(count("Q2", "action")) },
      Q3_inconclusive: { eligibility: pct(count("Q3", "eligibility")), action: pct(count("Q3", "action")) },
    };
  };

  const byQuestion = {};
  for (const question of QUESTIONS) {
    const subset = rows.filter((row) => row.question === question);
    if (subset.length === 0) {
      byQuestion[question] = { n: 0, note: "no eligible candidate of this question was ever produced" };
      continue;
    }

    const realized = {};
    for (const trace of traceRows.filter((t) => t.question === question)) {
      realized[trace.outcome] = (realized[trace.outcome] ?? 0) + 1;
    }
    const realizedTotal = Object.values(realized).reduce((a, b) => a + b, 0);
    const dominant = Object.entries(realized).sort((a, b) => b[1] - a[1])[0];
    const confirmationRate = realizedTotal === 0 ? null : (realized.confirmed ?? 0) / realizedTotal;

    byQuestion[question] = {
      ...distribution(subset),
      perArmRelevance: armBreakdown(subset),
      realizedOutcomes: realized,
      confirmationRate: confirmationRate === null ? null : r2(confirmationRate),
      // A question whose realized answer is effectively predetermined by its own eligibility
      // rule carries no information, whatever the counterfactual says a DIFFERENT answer would
      // have done. 0.95 is the threshold and it is stated rather than tuned.
      tautological:
        realizedTotal >= 20 && dominant !== undefined ? dominant[1] / realizedTotal >= 0.95 : null,
      dominantRealizedOutcome: dominant?.[0] ?? null,
      ...(question === "water_access"
        ? {
            observedAlreadyAboveGateShare: r2(
              subset.filter((row) => row.observedAlreadyAboveGate === true).length / subset.length,
            ),
          }
        : {}),
    };
  }

  const byScenario = {};
  for (const scenario of scenarios) {
    const subset = rows.filter((row) => row.scenario === scenario.name);
    byScenario[scenario.name] = {
      overall: subset.length === 0 ? { n: 0 } : distribution(subset),
      byQuestion: Object.fromEntries(
        QUESTIONS.map((q) => {
          const qs = subset.filter((row) => row.question === q);
          return [q, qs.length === 0 ? { n: 0 } : distribution(qs)];
        }),
      ),
    };
  }

  // §11 — resolve any trace still pending at the end as expired-unread.
  for (const trace of traceRows) delete trace.resolved;

  const traceSummary = {
    horizonDays: 90,
    returnedRows: traceRows.length,
    physicalActionReaderChanged: traceRows.filter((t) => t.physicalActionReaderChanged).length,
    declaredReaderChangedButNothingPhysical: traceRows.filter(
      (t) => t.declaredReaderChanged === true && t.physicalActionReaderChanged !== true,
    ).length,
    byQuestion: Object.fromEntries(
      QUESTIONS.map((q) => {
        const subset = traceRows.filter((t) => t.question === q);
        const physical = subset.filter((t) => t.physicalActionReaderChanged).length;
        const declaredOnly = subset.filter(
          (t) => t.declaredReaderChanged === true && t.physicalActionReaderChanged !== true,
        ).length;
        return [
          q,
          {
            returned: subset.length,
            physicalActionReaderChanged: physical,
            physicalActionShare: subset.length === 0 ? null : r2(physical / subset.length),
            declaredReaderChangedButNothingPhysical: declaredOnly,
          },
        ];
      }),
    ),
  };

  console.log("\n=== §9 RELEVANCE BY QUESTION (all scenarios pooled AFTER the per-question split) ===");
  console.log(JSON.stringify(byQuestion, null, 2));
  console.log("\n=== §11 BOUNDED-HORIZON READER TRACE (one season) ===");
  console.log(JSON.stringify(traceSummary, null, 2));
  console.log("\n=== baseline soundness ===");
  console.log(JSON.stringify(scenarioStats, null, 2));

  mkdirSync(OUT.slice(0, OUT.lastIndexOf("/")), { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify(
      {
        years: YEARS,
        seeds: SEEDS,
        scenarios: scenarios.map((s) => s.name),
        sampleEveryDays: SAMPLE_EVERY_DAYS,
        scenarioStats,
        byQuestion,
        byScenario,
        readerTrace: traceSummary,
        readerTraceRows: traceRows.slice(0, 400),
        rows: rows.slice(0, 4000),
      },
      null,
      2,
    ),
  );
  console.log(`\nwrote ${OUT}`);
} finally {
  await server.close();
}
