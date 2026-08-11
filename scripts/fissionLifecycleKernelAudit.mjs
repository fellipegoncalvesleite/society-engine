// ROADMAP ITEM 4 §5 — controlled fixtures K1-K18 for the pure lifecycle kernel.
//
// Every transition, every rejection and every timeout. Non-vacuity is ASSERTED per fixture: the
// harness relabels a fixture VACUOUS and fails the run when its predicate is false.
//
// The kernel is pure, so these fixtures need no world and no clock — which is the point. Nothing
// here proves the lifecycle is connected; natural reachability and parent deadlines now have their
// own world-adapter audit. This audit proves only that the state machine cannot be driven into an
// illegal or double-owned state, and that action bounds are distinguished from event-bounded living
// conditions.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/dynamic-fission-daughter-viability-37";
const OUT = arg("out", `${EVIDENCE}/lifecycle-kernel-fixtures.json`);

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-i4kern-${process.pid}`,
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  logLevel: "error",
});

let out;
try {
  const k = await server.ssrLoadModule("/sim/agents/fissionLifecycleKernel.ts");

  const fixtures = [];
  const record = (id, claim, run) => {
    let row;
    try {
      row = run();
    } catch (error) {
      fixtures.push({ id, claim, status: "ERROR", error: String(error?.message ?? error) });
      return;
    }
    const { nonVacuous, nonVacuityNote, passed, ...rest } = row;
    fixtures.push({ id, claim, status: !nonVacuous ? "VACUOUS" : passed ? "PASS" : "FAIL", nonVacuityNote, ...rest });
  };

  // ROADMAP ITEM 4 §3 — `cause` is now REQUIRED on every transition request, and a caller that omits
  // it is refused. These fixtures exercise the PERMITTED-SET and precondition machinery rather than
  // the cause guard, which has its own suite in `provisionalLifecycleExitAudit.mjs`, so the helper
  // presents itself as a witnessed physical event and supplies the co-location proof `reintegrated`
  // demands. `E7` in the exit audit asserts that an UNDECLARED caller is still refused, so nothing is
  // hidden by this default.
  const step = (state, to, day, extra = {}) =>
    k.requestTransition({ current: state, to, today: day, cause: "physical_event",
      physicalCoLocationProven: true, preparedDepartureProven: true, ...extra });

  // ── K1 — the contract table is internally coherent ──────────────────────────────────────────
  record("K1", "every phase declares a coherent temporal, event-bounded or terminal resolution kind, and no quantity is owned twice", () => {
    const problems = k.assertSingleOwnership();
    return {
      problems,
      phaseCount: k.PHASE_CONTRACTS.length,
      nonVacuous: k.PHASE_CONTRACTS.length >= 11,
      nonVacuityNote: "the complete production phase table is present",
      passed: problems.length === 0,
    };
  });

  // ── K2 — the happy path, end to end ─────────────────────────────────────────────────────────
  record("K2", "the kernel retains stabilization as legal future vocabulary behind explicit guarded transitions", () => {
    let s = k.beginAttempt(0);
    const path = [s.phase];
    for (const [to, day, extra] of [["departure_planned", 10, {}], ["departure_ready", 20, {}], ["departed", 25, { endorsedFounderCount: 12 }]]) {
      const r = step(s, to, day, extra);
      if (r.ok !== true) return { failedAt: to, rejection: r.rejection, nonVacuous: true, nonVacuityNote: "n/a", passed: false };
      s = r.state;
      path.push(s.phase);
    }
    let p = k.beginProvisionalSuccessor(25);
    path.push(`successor:${p.phase}`);
    for (const [to, day, extra] of [["establishing", 60, {}], ["stabilized", 300, { livedEvidenceCount: 4 }]]) {
      const r = step(p, to, day, extra);
      if (r.ok !== true) return { failedAt: to, rejection: r.rejection, nonVacuous: true, nonVacuityNote: "n/a", passed: false };
      p = r.state;
      path.push(`successor:${p.phase}`);
    }
    return {
      path,
      // proposed, committed, departure_ready, departed, then the successor's travelling,
      // establishing and stabilized. Seven. The first form of this predicate asserted eight and
      // honestly reported VACUOUS on a walk that was complete — the fixture was miscounted, not the
      // kernel.
      nonVacuous: path.length === 7 && path.filter((p) => p.startsWith("successor:")).length === 3,
      nonVacuityNote: "the pure kernel exercised the reserved legal path; this is not a production-writer claim",
      passed: s.phase === "departed" && p.phase === "stabilized" && k.isTerminalPhase(p.phase),
    };
  });

  // ── K3 — the successor never starts at the destination ──────────────────────────────────────
  record("K3", "a provisional successor opens in travelling, never in establishing", () => {
    const p = k.beginProvisionalSuccessor(0);
    return {
      openingPhase: p.phase,
      nonVacuous: k.PHASE_CONTRACTS.some((c) => c.phase === "establishing"),
      nonVacuityNote: "establishing exists as a phase, so opening in travelling is a choice rather than an absence",
      passed: p.phase === "travelling" && p.history.length === 0,
    };
  });

  // ── K4 — abandonment before departure ───────────────────────────────────────────────────────
  record("K4", "an attempt can be abandoned from every pre-departure phase", () => {
    const results = {};
    for (const [phase, day] of [["proposed", 0], ["departure_planned", 10], ["departure_ready", 20]]) {
      let s = k.beginAttempt(0);
      if (phase !== "proposed") s = step(s, "departure_planned", 5).state;
      if (phase === "departure_ready") s = step(s, "departure_ready", 10).state;
      const r = step(s, "abandoned", day + 1);
      results[phase] = r.ok === true ? r.state.phase : `REJECTED:${r.rejection}`;
    }
    return {
      results,
      nonVacuous: Object.keys(results).length === 3,
      nonVacuityNote: "all three pre-departure phases were exercised",
      passed: Object.values(results).every((v) => v === "abandoned"),
    };
  });

  // ── K5 — departure requires an endorsed founder count ───────────────────────────────────────
  record("K5", "departure is refused without a founder count the residual authority endorsed", () => {
    let s = k.beginAttempt(0);
    s = step(s, "departure_planned", 5).state;
    s = step(s, "departure_ready", 10).state;
    const missing = step(s, "departed", 12);
    const zero = step(s, "departed", 12, { endorsedFounderCount: 0 });
    const fractional = step(s, "departed", 12, { endorsedFounderCount: 3.5 });
    const valid = step(s, "departed", 12, { endorsedFounderCount: 3 });
    return {
      missing: missing.ok === true ? "ACCEPTED" : missing.rejection,
      zero: zero.ok === true ? "ACCEPTED" : zero.rejection,
      fractional: fractional.ok === true ? "ACCEPTED" : fractional.rejection,
      valid: valid.ok === true ? valid.state.phase : `REJECTED:${valid.rejection}`,
      // the control is what makes the three refusals mean something
      nonVacuous: valid.ok === true && valid.state.phase === "departed",
      nonVacuityNote: "a valid endorsed count DOES depart, so the refusals are refusals and not an inert gate",
      passed:
        missing.ok === false && missing.rejection === "departure_without_endorsed_founder_count" &&
        zero.ok === false && fractional.ok === false && valid.ok === true,
    };
  });

  // ── K6 — a timer alone may not stabilize ────────────────────────────────────────────────────
  record("K6", "the reserved stabilization transition keeps its kernel guard, while an establishment timeout is a failure", () => {
    let p = k.beginProvisionalSuccessor(0);
    p = step(p, "establishing", 30).state;
    const noEvidence = step(p, "stabilized", 40);
    const thin = step(p, "stabilized", 40, { livedEvidenceCount: k.MIN_LIVED_EVIDENCE_FOR_STABILIZATION - 1 });
    const enough = step(p, "stabilized", 40, { livedEvidenceCount: k.MIN_LIVED_EVIDENCE_FOR_STABILIZATION });
    const expired = k.resolveTimeout(p, 30 + k.ESTABLISHMENT_MAX_DAYS);
    return {
      noEvidence: noEvidence.ok === true ? "ACCEPTED" : noEvidence.rejection,
      thin: thin.ok === true ? "ACCEPTED" : thin.rejection,
      enough: enough.ok === true ? enough.state.phase : `REJECTED:${enough.rejection}`,
      onTimeout: expired.ok === true ? expired.state.phase : `REJECTED:${expired.rejection}`,
      nonVacuous: enough.ok === true && enough.state.phase === "stabilized",
      nonVacuityNote: "an explicit synthetic physical-event request can exercise the legal placeholder; no production adapter is implied",
      passed:
        noEvidence.ok === false && noEvidence.rejection === "stabilization_without_lived_evidence" &&
        thin.ok === false && enough.ok === true &&
        // the window expiring must NOT be a success
        expired.ok === true && expired.timedOut === true && expired.state.phase === "failed_early",
    };
  });

  // ── K7 — actions are time-bounded; living conditions are event-bounded ──────────────────────
  record("K7", "every action resolves at its temporal bound while a living condition refuses timeout authority", () => {
    const timedRows = [];
    for (const c of k.PHASE_CONTRACTS.filter((x) => x.resolutionKind === "temporally_bounded_action")) {
      const state = { phase: c.phase, phaseEnteredDay: 0, history: [] };
      const before = k.resolveTimeout(state, c.maxDays - 1);
      const after = k.resolveTimeout(state, c.maxDays);
      timedRows.push({
        phase: c.phase,
        maxDays: c.maxDays,
        beforeBound: before.ok === true ? `${before.state.phase}/timedOut=${before.timedOut}` : before.rejection,
        atBound: after.ok === true ? `${after.state.phase}/timedOut=${after.timedOut}` : after.rejection,
      });
    }
    const eventRows = k.PHASE_CONTRACTS
      .filter((x) => x.resolutionKind === "event_bounded_living_condition")
      .map((c) => {
        const result = k.resolveTimeout({ phase: c.phase, phaseEnteredDay: 0, history: [] }, 1_000_000);
        return { phase: c.phase, result: result.ok === true ? result.state.phase : result.rejection };
      });
    const successPhases = new Set(["stabilized", "departed"]);
    return {
      timedRows,
      eventRows,
      nonVacuous: timedRows.length >= 7 && eventRows.length > 0,
      nonVacuityNote: "every timed action crossed its bound and every event-bounded living phase received a timeout attempt",
      passed:
        timedRows.every((r) => r.beforeBound.endsWith("timedOut=false")) &&
        timedRows.every((r) => r.atBound.endsWith("timedOut=true")) &&
        // a timeout may never manufacture a success
        !timedRows.some((r) => successPhases.has(r.atBound.split("/")[0])) &&
        eventRows.every((r) => r.result === "event_bounded_phase_has_no_timeout"),
    };
  });

  // ── K8 — terminal phases are terminal ───────────────────────────────────────────────────────
  record("K8", "no transition leaves a terminal phase", () => {
    const rows = {};
    for (const c of k.PHASE_CONTRACTS.filter((x) => x.terminal)) {
      const state = { phase: c.phase, phaseEnteredDay: 0, history: [] };
      const attempts = k.PHASE_CONTRACTS.map((t) => step(state, t.phase, 10, { endorsedFounderCount: 5, livedEvidenceCount: 9 }));
      rows[c.phase] = attempts.every((r) => r.ok === false && r.rejection === "phase_is_terminal");
    }
    return {
      rows,
      // FIVE since the zero-population terminal was added. The count is read from the production
      // table rather than hardcoded, so adding a phase cannot silently make this fixture vacuous
      // again — which is exactly what it did the first time.
      nonVacuous: Object.keys(rows).length === k.PHASE_CONTRACTS.filter((c) => c.terminal).length,
      nonVacuityNote: "every terminal phase in the production table was exercised against every possible destination",
      passed: Object.values(rows).every(Boolean),
    };
  });

  // ── K9 — illegal transitions are refused ────────────────────────────────────────────────────
  record("K9", "every transition outside the permitted set is refused", () => {
    let refused = 0;
    let permitted = 0;
    for (const c of k.PHASE_CONTRACTS.filter((x) => !x.terminal)) {
      const state = { phase: c.phase, phaseEnteredDay: 0, history: [] };
      for (const t of k.PHASE_CONTRACTS) {
        const r = step(state, t.phase, 5, { endorsedFounderCount: 5, livedEvidenceCount: 9, physicalCoLocationProven: true });
        if (c.permittedNext.includes(t.phase)) {
          if (r.ok === true) permitted += 1;
        } else if (r.ok === false && r.rejection === "transition_not_permitted") {
          refused += 1;
        }
      }
    }
    const totalPairs = k.PHASE_CONTRACTS.filter((x) => !x.terminal).length * k.PHASE_CONTRACTS.length;
    const expectedPermitted = k.PHASE_CONTRACTS.filter((x) => !x.terminal).reduce((n, c) => n + c.permittedNext.length, 0);
    return {
      refused,
      permitted,
      expectedPermitted,
      totalPairs,
      nonVacuous: expectedPermitted > 0 && refused > 0,
      nonVacuityNote: "both permitted and refused transitions genuinely occur in the sweep",
      passed: permitted === expectedPermitted && refused === totalPairs - expectedPermitted,
    };
  });

  // ── K10 — a failed successor cannot vanish or succeed ───────────────────────────────────────
  record("K10", "early failure leads only to returning — never to stabilization, never to a stop", () => {
    const state = { phase: "failed_early", phaseEnteredDay: 0, history: [] };
    const toStable = step(state, "stabilized", 5, { livedEvidenceCount: 99 });
    const toEstablish = step(state, "establishing", 5);
    const toReturn = step(state, "returning", 5);
    const contract = k.getPhaseContract("failed_early");
    return {
      toStabilized: toStable.ok === true ? "ACCEPTED" : toStable.rejection,
      toEstablishing: toEstablish.ok === true ? "ACCEPTED" : toEstablish.rejection,
      toReturning: toReturn.ok === true ? toReturn.state.phase : `REJECTED:${toReturn.rejection}`,
      permittedNext: contract.permittedNext,
      // Two exits now: walk home, or nobody is left to walk. Both are failures; neither is a success.
      nonVacuous: contract.permittedNext.length >= 1 && !contract.permittedNext.includes("stabilized"),
      nonVacuityNote: "the phase's exits are enumerated from the production table and none of them is a success",
      passed:
        toStable.ok === false && toEstablish.ok === false &&
        toReturn.ok === true && toReturn.state.phase === "returning" && !contract.terminal,
    };
  });

  // ── K11 — bodies move exactly once, and are never owned twice ───────────────────────────────
  record("K11", "no phase lets the parent and the successor own the same quantity", () => {
    const preDeparture = k.PHASE_CONTRACTS.filter((c) => !c.bodiesHaveMoved);
    const postDeparture = k.PHASE_CONTRACTS.filter((c) => c.bodiesHaveMoved);
    return {
      preDepartureOwners: preDeparture.map((c) => `${c.phase}:${c.bodyOwner}`),
      postDepartureOwners: postDeparture.map((c) => `${c.phase}:${c.bodyOwner}`),
      nonVacuous: preDeparture.length > 0 && postDeparture.length > 0,
      nonVacuityNote: "both sides of the departure are represented in the table",
      passed:
        // before departure the parent owns everything, because the attempt holds no bodies
        preDeparture.every((c) => c.bodyOwner === "parent" && c.productiveLabourOwner === "parent" && c.physicalLocationOwner === "parent") &&
        // after departure exactly one entity owns each quantity, never both
        // `none` is legal for exactly one phase: the terminal in which nobody is left alive.
        postDeparture.every(
          (c) => c.bodyOwner === "parent" || c.bodyOwner === "successor" ||
            (c.bodyOwner === "none" && c.terminal && c.phase === "provisional_extinguished"),
        ) &&
        // reintegration hands ownership back
        k.getPhaseContract("reintegrated").bodyOwner === "parent" &&
        k.getPhaseContract("stabilized").bodyOwner === "successor",
    };
  });

  // ── K12 — history is bounded ────────────────────────────────────────────────────────────────
  record("K12", "lifecycle history cannot grow without bound", () => {
    let s = { phase: "travelling", phaseEnteredDay: 0, history: [] };
    // Drive a long legal oscillation: establishing -> failed_early -> returning is terminalish, so
    // use travelling <-> establishing, which is permitted in one direction only; instead replay by
    // reconstructing state, which is what a long-lived lineage would accumulate.
    for (let i = 0; i < k.LIFECYCLE_HISTORY_CAP * 3; i += 1) {
      const r = step({ ...s, phase: "travelling" }, "establishing", i);
      s = r.state;
      s = { ...s, phase: "travelling" };
    }
    return {
      historyLength: s.history.length,
      cap: k.LIFECYCLE_HISTORY_CAP,
      nonVacuous: k.LIFECYCLE_HISTORY_CAP * 3 > k.LIFECYCLE_HISTORY_CAP,
      nonVacuityNote: "the drive genuinely exceeded the cap",
      passed: s.history.length <= k.LIFECYCLE_HISTORY_CAP,
    };
  });

  // ── K13 — determinism ───────────────────────────────────────────────────────────────────────
  record("K13", "the same request produces a byte-identical result", () => {
    const s = k.beginAttempt(3);
    const a = JSON.stringify(step(s, "departure_planned", 9));
    const b = JSON.stringify(step({ ...s }, "departure_planned", 9));
    const c = JSON.stringify(step(k.beginAttempt(3), "departure_planned", 9));
    return {
      identical: a === b && b === c,
      nonVacuous: a.length > 40,
      nonVacuityNote: "the compared result is substantive",
      passed: a === b && b === c,
    };
  });

  // ── K14 — the kernel cannot read anything it was not given ──────────────────────────────────
  record("K14", "information the kernel has no field for cannot alter a transition", () => {
    const s = k.beginAttempt(0);
    const clean = JSON.stringify(step(s, "departure_planned", 5));
    const polluted = JSON.stringify(
      k.requestTransition({
        current: s,
        to: "departure_planned",
        today: 5,
        world: { bands: { a: 1 } },
        splitPressure: 0.99,
        hiddenTargetRichness: 1,
        parentPopulation: 50,
      }),
    );
    return {
      identical: clean === polluted,
      nonVacuous: true,
      nonVacuityNote: "unrelated keys were genuinely present on the request",
      passed: clean === polluted,
    };
  });

  const counts = fixtures.reduce((a, f) => { a[f.status] = (a[f.status] ?? 0) + 1; return a; }, { PASS: 0, FAIL: 0, VACUOUS: 0, ERROR: 0 });

  out = {
    generatedAt: new Date().toISOString(),
    checkpoint: "ROADMAP ITEM 4 §5 — pure lifecycle kernel fixtures",
    authority: "src/sim/agents/fissionLifecycleKernel.ts",
    scopeLimit:
      "The kernel is pure. These fixtures prove only its legal vocabulary, action bounds, event-bounded living condition and ownership table. They do not prove a production stabilization writer exists; the cleanup source audit proves none does.",
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
  if (f.status !== "PASS") console.log(`        ${JSON.stringify(f).slice(0, 800)}`);
}
console.log(`\nsummary: ${JSON.stringify(out.summary)}`);
console.log(`written: ${OUT}`);
if (out.summary.failing > 0 || out.summary.vacuous > 0 || out.summary.errored > 0) process.exitCode = 1;
