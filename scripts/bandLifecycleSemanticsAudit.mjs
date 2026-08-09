// ROADMAP ITEM 4 §3 + §5 — lifecycle ownership invariants and lineage-protection duration.
//
// LP* fixtures: exactly when the parent/successor pair gets special treatment, and — the part that
// matters — exactly when it STOPS. O* fixtures: the ownership defects the departure seam must be
// unable to write.
//
// These use minimal Band-shaped objects rather than a stepped world. That is deliberate and its
// limit is stated: they prove the PREDICATES are right, not that any production reader calls them.
// No production reader calls them yet.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/dynamic-fission-daughter-viability-37";
const OUT = arg("out", `${EVIDENCE}/lifecycle-semantics-fixtures.json`);

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-i4sem-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const lc = await server.ssrLoadModule("/sim/agents/bandLifecycle.ts");

  const rec = (phase, lineageId, day = 0) => ({ phase, phaseEnteredDay: day, history: [], lineageId });
  /** A minimal band carrying only what the lifecycle boundary reads. */
  const band = (id, opts = {}) => ({
    id,
    status: opts.status ?? "foraging",
    demography: { population: opts.population ?? 20 },
    viability: opts.viability,
    fissionAttempt: opts.attempt,
    provisionalSuccessor: opts.successor,
  });

  const fixtures = [];
  const record = (id, claim, run) => {
    let row;
    try { row = run(); } catch (e) { fixtures.push({ id, claim, status: "ERROR", error: String(e?.message ?? e) }); return; }
    const { nonVacuous, nonVacuityNote, passed, ...rest } = row;
    fixtures.push({ id, claim, status: !nonVacuous ? "VACUOUS" : passed ? "PASS" : "FAIL", nonVacuityNote, ...rest });
  };

  const LIVE_SUCCESSOR_PHASES = ["travelling", "establishing", "failed_early", "returning", "unresolved_after_failed_return"];

  // ── LP1 — protected through every phase the split is actually under way ─────────────────────
  record("LP1", "the parent and its successor are recognised as one split through travel, failure, return and the unresolved living condition", () => {
    const rows = {};
    for (const phase of LIVE_SUCCESSOR_PHASES) {
      const parent = band("parent", { attempt: rec("departed", "L1") });
      const succ = band("succ", { successor: rec(phase, "L1") });
      rows[phase] = lc.shareCurrentFissionLineage(parent, succ) && lc.shareCurrentFissionLineage(succ, parent);
    }
    return {
      rows,
      nonVacuous: Object.keys(rows).length === LIVE_SUCCESSOR_PHASES.length,
      nonVacuityNote: "every live successor phase was exercised",
      passed: Object.values(rows).every(Boolean),
    };
  });

  // ── LP2 — an unrelated band is never protected ──────────────────────────────────────────────
  record("LP2", "a band with no lifecycle relationship is not protected", () => {
    const parent = band("parent", { attempt: rec("departed", "L1") });
    const succ = band("succ", { successor: rec("travelling", "L1") });
    const stranger = band("stranger");
    return {
      strangerVsParent: lc.shareCurrentFissionLineage(stranger, parent),
      strangerVsSuccessor: lc.shareCurrentFissionLineage(stranger, succ),
      // the control proves the instrument is sensitive rather than always-false
      controlPairProtected: lc.shareCurrentFissionLineage(parent, succ),
      nonVacuous: lc.shareCurrentFissionLineage(parent, succ) === true,
      nonVacuityNote: "the real pair IS protected in the same run, so a false here is a real negative",
      passed: !lc.shareCurrentFissionLineage(stranger, parent) && !lc.shareCurrentFissionLineage(stranger, succ),
    };
  });

  // ── LP3 — a different lineage id is not protected ───────────────────────────────────────────
  record("LP3", "a band carrying a DIFFERENT lineage id is not protected", () => {
    const parent = band("parent", { attempt: rec("departed", "L1") });
    const otherSucc = band("other", { successor: rec("travelling", "L2") });
    const ownSucc = band("succ", { successor: rec("travelling", "L1") });
    return {
      wrongLineage: lc.shareCurrentFissionLineage(parent, otherSucc),
      rightLineage: lc.shareCurrentFissionLineage(parent, ownSucc),
      nonVacuous: lc.shareCurrentFissionLineage(parent, ownSucc) === true,
      nonVacuityNote: "the matching lineage IS protected in the same run",
      passed: !lc.shareCurrentFissionLineage(parent, otherSucc),
    };
  });

  // ── LP4 — protection ENDS at stabilization ──────────────────────────────────────────────────
  //
  // THE FIXTURE THAT FOUND A REAL DEFECT. The first form of `shareCurrentFissionLineage` asked only
  // whether the two bands shared a lineage id anywhere. Because §3 requires the parent to RETAIN its
  // attempt record as provenance, that form matched FOREVER — permanent immunity from ordinary
  // inter-band rules, which §5 explicitly forbids.
  record("LP4", "a stabilized daughter meets its parent on ordinary terms — provenance alone confers nothing", () => {
    const parent = band("parent", { attempt: rec("departed", "L1") });
    const travelling = band("succ", { successor: rec("travelling", "L1") });
    // At `stabilized` the kernel clears the provisional record; the parent keeps its provenance.
    const stabilized = band("succ", { successor: undefined });
    // And even if a terminal record were observed mid-transition, it must not protect.
    const stabilizedRecordStillPresent = band("succ", { successor: rec("stabilized", "L1") });
    return {
      whileTravelling: lc.shareCurrentFissionLineage(parent, travelling),
      afterStabilizationRecordCleared: lc.shareCurrentFissionLineage(parent, stabilized),
      afterStabilizationRecordPresent: lc.shareCurrentFissionLineage(parent, stabilizedRecordStillPresent),
      parentStillCarriesProvenance: parent.fissionAttempt?.lineageId,
      nonVacuous: lc.shareCurrentFissionLineage(parent, travelling) === true && parent.fissionAttempt !== undefined,
      nonVacuityNote: "the pair WAS protected while travelling, and the parent still carries the provenance afterwards — so the false is an ending, not an absence",
      passed:
        lc.shareCurrentFissionLineage(parent, travelling) === true &&
        lc.shareCurrentFissionLineage(parent, stabilized) === false &&
        lc.shareCurrentFissionLineage(parent, stabilizedRecordStillPresent) === false,
    };
  });

  // ── LP5 — a reintegrated successor is no longer an interaction candidate ────────────────────
  record("LP5", "a reintegrated successor is not a separate interaction candidate", () => {
    const parent = band("parent", { attempt: rec("departed", "L1") });
    const reintegrated = band("succ", { successor: rec("reintegrated", "L1") });
    return {
      protectedWhileReintegrated: lc.shareCurrentFissionLineage(parent, reintegrated),
      isProvisional: lc.isProvisionalSuccessor(reintegrated),
      nonVacuous: lc.isProvisionalSuccessor(band("x", { successor: rec("returning", "L1") })) === true,
      nonVacuityNote: "a RETURNING successor does read as provisional, so the reintegrated false is a real ending",
      // reintegrated is terminal: the entity is removed by the resolver, and until it is, it is not
      // provisional and so is not protected
      passed: lc.isProvisionalSuccessor(reintegrated) === false && lc.shareCurrentFissionLineage(parent, reintegrated) === false,
    };
  });

  // ── LP6 — the predicate set answers different questions ─────────────────────────────────────
  record("LP6", "a provisional successor is living, is not established, and cannot fission", () => {
    const succ = band("succ", { successor: rec("travelling", "L1") });
    const ordinary = band("ord");
    return {
      successor: {
        living: lc.isLivingBand(succ),
        established: lc.isEstablishedBand(succ),
        fissionEligible: lc.isFissionEligibleParent(succ),
        provisional: lc.isProvisionalSuccessor(succ),
        inTransit: lc.isProvisionalGroupInTransit(succ),
        terminal: lc.isBandTerminal(succ),
      },
      ordinary: {
        living: lc.isLivingBand(ordinary),
        established: lc.isEstablishedBand(ordinary),
        fissionEligible: lc.isFissionEligibleParent(ordinary),
      },
      nonVacuous: lc.isEstablishedBand(ordinary) === true,
      nonVacuityNote: "an ordinary band IS established in the same run, so the successor's false is discriminating",
      passed:
        lc.isLivingBand(succ) === true &&
        lc.isEstablishedBand(succ) === false &&
        lc.isFissionEligibleParent(succ) === false &&
        lc.isBandTerminal(succ) === false &&
        lc.isProvisionalGroupInTransit(succ) === true &&
        lc.isFissionEligibleParent(ordinary) === true,
    };
  });

  // ── LP7 — a parent mid-attempt cannot start a second one ────────────────────────────────────
  record("LP7", "a parent already attempting a split is not fission-eligible", () => {
    const attempting = band("p", { attempt: rec("departure_planned", "L1") });
    const finished = band("p", { attempt: rec("abandoned", "L1") });
    return {
      whileAttempting: lc.isFissionEligibleParent(attempting),
      afterAbandonment: lc.isFissionEligibleParent(finished),
      nonVacuous: lc.hasCurrentFissionAttempt(attempting) === true,
      nonVacuityNote: "the attempt is genuinely current",
      // an abandoned attempt is terminal, so the parent may try again — the record is provenance
      passed: lc.isFissionEligibleParent(attempting) === false && lc.isFissionEligibleParent(finished) === true,
    };
  });

  // ── O* — the ownership defects the departure seam must be unable to write ───────────────────
  const ownershipCases = [
    {
      id: "O1",
      claim: "two current successors for one lineage are detected",
      bands: [band("p", { attempt: rec("departed", "L1") }), band("a", { successor: rec("travelling", "L1") }), band("b", { successor: rec("travelling", "L1") })],
      expect: "two_current_successors_for_one_lineage",
    },
    {
      id: "O2",
      claim: "one band holding two current lifecycle records is detected",
      bands: [band("x", { attempt: rec("departure_planned", "L1"), successor: rec("travelling", "L1") })],
      expect: "duplicate_current_ownership_on_one_band",
    },
    {
      id: "O3",
      claim: "a successor with no parent provenance anywhere is detected",
      bands: [band("orphan", { successor: rec("travelling", "L9") })],
      expect: "successor_without_parent_provenance",
    },
    {
      id: "O4",
      claim: "a departed attempt with no current successor is detected",
      bands: [band("p", { attempt: rec("departed", "L1") })],
      expect: "departed_attempt_without_a_successor",
    },
    {
      id: "O5",
      claim: "two parents carrying the same lineage are detected",
      bands: [band("p1", { attempt: rec("departed", "L1") }), band("p2", { attempt: rec("departed", "L1") }), band("s", { successor: rec("travelling", "L1") })],
      expect: "two_current_attempts_for_one_parent",
    },
  ];
  for (const c of ownershipCases) {
    record(c.id, c.claim, () => {
      const findings = lc.auditFissionLineageOwnership(c.bands);
      const healthy = lc.auditFissionLineageOwnership([
        band("p", { attempt: rec("departed", "L1") }),
        band("s", { successor: rec("travelling", "L1") }),
      ]);
      return {
        findings: findings.map((f) => f.defect),
        healthyPairFindings: healthy.map((f) => f.defect),
        nonVacuous: healthy.length === 0,
        nonVacuityNote: "a correctly-formed parent/successor pair produces ZERO findings in the same run, so a detection is a detection and not a permanently-firing check",
        passed: findings.some((f) => f.defect === c.expect),
      };
    });
  }

  // ── O6 — a terminal record influences nothing current ───────────────────────────────────────
  record("O6", "terminal lifecycle records do not make a band provisional or ineligible", () => {
    const afterAbandon = band("p", { attempt: rec("abandoned", "L1") });
    const afterStabilize = band("s", { successor: rec("stabilized", "L1") });
    const afterReintegrate = band("s", { successor: rec("reintegrated", "L1") });
    return {
      abandonedParentEligible: lc.isFissionEligibleParent(afterAbandon),
      stabilizedIsProvisional: lc.isProvisionalSuccessor(afterStabilize),
      stabilizedIsEstablished: lc.isEstablishedBand(afterStabilize),
      reintegratedIsProvisional: lc.isProvisionalSuccessor(afterReintegrate),
      nonVacuous: lc.isProvisionalSuccessor(band("x", { successor: rec("establishing", "L1") })) === true,
      nonVacuityNote: "a non-terminal record DOES read as provisional in the same run",
      passed:
        lc.isFissionEligibleParent(afterAbandon) === true &&
        lc.isProvisionalSuccessor(afterStabilize) === false &&
        lc.isEstablishedBand(afterStabilize) === true &&
        lc.isProvisionalSuccessor(afterReintegrate) === false,
    };
  });

  const counts = fixtures.reduce((a, f) => { a[f.status] = (a[f.status] ?? 0) + 1; return a; }, { PASS: 0, FAIL: 0, VACUOUS: 0, ERROR: 0 });
  out = {
    generatedAt: new Date().toISOString(),
    checkpoint: "ROADMAP ITEM 4 §3 + §5 — lifecycle ownership and lineage-protection duration",
    authority: "src/sim/agents/bandLifecycle.ts",
    scopeLimit:
      "These prove the PREDICATES are right. They do NOT prove any production reader calls them — none does yet. Minimal Band-shaped objects, no stepped world.",
    lineageProtectionPolicy:
      "Protection holds only while a CURRENT provisional successor record exists whose lineage matches the other band. It covers immediate co-residence, travel, failure and return, and ends at BOTH exits: the record is cleared at stabilized, and the entity is removed at reintegrated. The parent retains its attempt record as provenance, and provenance alone confers nothing — LP4 is the proof, and an earlier form of the predicate failed it by granting permanent immunity.",
    fixtures,
    summary: { total: fixtures.length, passing: counts.PASS, failing: counts.FAIL, vacuous: counts.VACUOUS, errored: counts.ERROR },
  };
} finally {
  await server.close();
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
for (const f of out.fixtures) {
  console.log(`${f.status.padEnd(7)} ${f.id}  ${f.claim}`);
  if (f.status !== "PASS") console.log(`        ${JSON.stringify(f).slice(0, 700)}`);
}
console.log(`\nsummary: ${JSON.stringify(out.summary)}`);
console.log(`written: ${OUT}`);
if (out.summary.failing > 0 || out.summary.vacuous > 0 || out.summary.errored > 0) process.exitCode = 1;
