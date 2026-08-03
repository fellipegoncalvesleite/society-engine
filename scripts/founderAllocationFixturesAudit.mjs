// ROADMAP ITEM 4 — FOUNDER COHORT ALLOCATION FIXTURES (defect L1).
//
// Exercises the PRODUCTION allocation authority directly. It asserts the production predicate
// `isFounderAllocationConserving` rather than re-implementing conservation, so a fixture cannot
// pass against a rule the audit invented for itself.
//
// The headline cases are the two REAL parent compositions from the natural fissions measured in
// `fission-before.json`, so this is not an abstract arithmetic test: it is the same input that
// previously manufactured four dependents from nothing.
//
// Every fixture carries an explicit non-vacuity predicate. Summaries report passing, failing,
// vacuous and not-constructed in SEPARATE fields.
import { createServer } from "vite";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const OUT = arg("out", "artifacts/c38/founder-conservation-ledger.json");

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c38fa-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const mod = await server.ssrLoadModule("/sim/agents/fissionFounderAllocation.ts");
  const { allocateFounderCohorts, isFounderAllocationConserving } = mod;

  const fixtures = {};
  const add = (id, verdict, detail) => {
    if (detail.notConstructed === true) { fixtures[id] = { verdict, vacuous: false, ...detail }; return; }
    const vacuous = detail.nonVacuousPredicate !== true;
    fixtures[id] = { verdict: vacuous ? `VACUOUS:${verdict}` : verdict, vacuous, ...detail };
  };
  const tot = (c) => c.workingAdults + c.dependents + c.elders;

  // ══════════════ A1/A2 — the two REAL natural fissions ══════════════
  //
  // Parent composition and requested founder count taken verbatim from fission-before.json.
  // Under the OLD code these produced dependents +4 and +3.
  const natural = [
    { id: "A1_real_fission_seed_s1", seed: "audit27:natural:s1",
      parent: { workingAdults: 29, dependents: 14, elders: 7 }, request: 18,
      oldOutcome: { successor: { workingAdults: 10, dependents: 6, elders: 2 },
        parentAfter: { workingAdults: 18, dependents: 12, elders: 3 },
        dependentsManufactured: 4, workingAdultsDestroyed: 1, eldersDestroyed: 2 } },
    { id: "A2_real_fission_seed_map2_s1", seed: "audit27:natural:map2:s1",
      parent: { workingAdults: 29, dependents: 14, elders: 6 }, request: 18,
      oldOutcome: { successor: { workingAdults: 10, dependents: 6, elders: 2 },
        parentAfter: { workingAdults: 17, dependents: 11, elders: 3 },
        dependentsManufactured: 3, workingAdultsDestroyed: 2, eldersDestroyed: 1 } },
  ];

  for (const n of natural) {
    const r = allocateFounderCohorts(n.parent, n.request);
    const ok = r.ok === true;
    const conserving = ok && isFounderAllocationConserving(n.parent, r.allocation.parentRemainder, r.allocation.successor);
    add(n.id,
      ok && conserving && r.allocation.exact
        ? "EVERY_COHORT_LINE_BALANCES_ON_THE_REAL_PARENT_COMPOSITION" : "UNEXPECTED",
      { seed: n.seed, parentBefore: n.parent, requestedFounders: n.request,
        successor: ok ? r.allocation.successor : null,
        parentRemainder: ok ? r.allocation.parentRemainder : null,
        allocatedFounders: ok ? r.allocation.allocatedFounders : null,
        exact: ok ? r.allocation.exact : false,
        productionPredicateSaysConserving: conserving,
        whatTheOldCodeDid: n.oldOutcome,
        nonVacuousPredicate: ok && n.oldOutcome.dependentsManufactured > 0,
        nonVacuous: { predicate: "this exact parent composition and request previously MANUFACTURED dependents, so a balanced result here is a repair rather than an empty check",
          dependentsPreviouslyManufactured: n.oldOutcome.dependentsManufactured } });
  }

  // ══════════════ A3 — an aged parent is not laundered healthy ══════════════
  {
    const parent = { workingAdults: 6, dependents: 8, elders: 16 }; // 30 people, elder-heavy
    const r = allocateFounderCohorts(parent, 10);
    const ok = r.ok === true;
    const s = ok ? r.allocation.successor : null;
    // The OLD code would have given the successor the textbook 35%/10% structure regardless.
    const oldWouldHaveGiven = { dependents: Math.round(10 * 0.35), elders: Math.round(10 * 0.1) };
    add("A3_aged_parent_is_not_laundered_healthy",
      ok && s.elders > oldWouldHaveGiven.elders && isFounderAllocationConserving(parent, r.allocation.parentRemainder, s)
        ? "THE_SUCCESSOR_LOOKS_LIKE_THE_BAND_IT_CAME_FROM" : "UNEXPECTED",
      { parentBefore: parent, requestedFounders: 10, successor: s,
        parentRemainder: ok ? r.allocation.parentRemainder : null,
        oldFixedRatioWouldHaveGiven: oldWouldHaveGiven,
        nonVacuousPredicate: ok && s.elders > oldWouldHaveGiven.elders,
        nonVacuous: { predicate: "the parent is genuinely elder-heavy and the allocation genuinely carries that forward, so this is not a comparison of similar structures",
          successorElders: s?.elders, fixedRatioElders: oldWouldHaveGiven.elders } });
  }

  // ══════════════ A4 — exhaustive conservation sweep ══════════════
  {
    let checked = 0; let conserving = 0; const failures = [];
    for (let wa = 1; wa <= 14; wa += 1) {
      for (let dep = 0; dep <= 14; dep += 3) {
        for (let eld = 0; eld <= 14; eld += 3) {
          const parent = { workingAdults: wa, dependents: dep, elders: eld };
          const p = wa + dep + eld;
          for (let req = 1; req < p; req += 1) {
            const r = allocateFounderCohorts(parent, req);
            if (r.ok !== true) continue;
            checked += 1;
            const okc = isFounderAllocationConserving(parent, r.allocation.parentRemainder, r.allocation.successor)
              && r.allocation.exact && r.allocation.allocatedFounders === req;
            if (okc) conserving += 1;
            else if (failures.length < 6) failures.push({ parent, req, allocation: r.allocation });
          }
        }
      }
    }
    add("A4_exhaustive_conservation_sweep",
      checked > 0 && conserving === checked ? "EVERY_ACCEPTED_ALLOCATION_BALANCES" : "UNEXPECTED",
      { allocationsChecked: checked, conserving, failures,
        nonVacuousPredicate: checked > 500,
        nonVacuous: { predicate: "a large space of real compositions and requests was accepted and checked", checked } });
  }

  // ══════════════ A5 — refusal rather than silent repair ══════════════
  {
    const cases = [
      { name: "parent_left_without_labour", parent: { workingAdults: 1, dependents: 9, elders: 9 }, req: 18,
        expect: "parent_would_have_no_productive_labour" },
      // NOT the successor refusal: with one working adult in the whole band, the working-adults-first
      // draw gives it to the SUCCESSOR, so the PARENT is the side left unable to forage. The fixture
      // that expected the successor refusal here was wrong; see A7 for the measured reachability.
      { name: "single_worker_band_leaves_parent_without_labour", parent: { workingAdults: 1, dependents: 30, elders: 0 }, req: 3,
        expect: "parent_would_have_no_productive_labour" },
      { name: "request_equals_population", parent: { workingAdults: 5, dependents: 5, elders: 5 }, req: 15,
        expect: "request_out_of_range" },
      { name: "request_zero", parent: { workingAdults: 5, dependents: 5, elders: 5 }, req: 0,
        expect: "request_out_of_range" },
      { name: "fractional_request", parent: { workingAdults: 5, dependents: 5, elders: 5 }, req: 2.5,
        expect: "request_out_of_range" },
      { name: "negative_cohort", parent: { workingAdults: -1, dependents: 5, elders: 5 }, req: 3,
        expect: "parent_cohorts_inconsistent" },
    ];
    const rows = cases.map((c) => {
      const r = allocateFounderCohorts(c.parent, c.req);
      return { ...c, refused: r.ok === false, refusal: r.ok === false ? r.refusal : null,
        matched: r.ok === false && r.refusal === c.expect };
    });
    add("A5_refuses_rather_than_repairing_silently",
      rows.every((x) => x.matched) ? "EVERY_INFEASIBLE_CASE_IS_REFUSED_BY_ITS_OWN_NAME" : "UNEXPECTED",
      { rows,
        note: "a refusal returns NO allocation. A caller that wanted a departure must revise its request explicitly and record why; it may not quietly take a different group than the one it asked for.",
        nonVacuousPredicate: rows.length >= 6 && rows.every((x) => x.refused),
        nonVacuous: { predicate: "six distinct infeasible shapes were each genuinely refused" } });
  }

  // ══════════════ A7 — is the successor-labour refusal reachable at all? ══════════════
  //
  // A refusal reason that reads zero must be a MEASURED zero, not an unused enum value. This sweeps
  // the whole practical composition space and reports which refusals actually fire.
  {
    const hits = { parent_would_have_no_productive_labour: 0, successor_would_have_no_productive_labour: 0 };
    let accepted = 0;
    for (let wa = 0; wa <= 24; wa += 1)
      for (let dep = 0; dep <= 36; dep += 1)
        for (let eld = 0; eld <= 12; eld += 1) {
          const p = wa + dep + eld; if (p < 2) continue;
          for (let req = 1; req < p; req += 1) {
            const r = allocateFounderCohorts({ workingAdults: wa, dependents: dep, elders: eld }, req);
            if (r.ok === true) { accepted += 1; continue; }
            if (hits[r.refusal] !== undefined) hits[r.refusal] += 1;
          }
        }
    add("A7_successor_labour_refusal_is_a_measured_zero",
      hits.successor_would_have_no_productive_labour === 0 && hits.parent_would_have_no_productive_labour > 0
        ? "STRUCTURALLY_UNREACHABLE_UNDER_THE_CURRENT_DRAW_ORDER_AND_MEASURED_AS_SUCH" : "UNEXPECTED",
      { allocationsSwept: accepted + hits.parent_would_have_no_productive_labour + hits.successor_would_have_no_productive_labour,
        accepted, refusalHits: hits,
        finding: "the remainder is drawn working-adults-first, so whenever the parent holds a working adult and the proportional floor rounds the successor's share to zero, the remainder immediately restores one. The successor is protected BY CONSTRUCTION, not by the check.",
        whyTheCheckIsKept: "the guarantee is a property of the current draw order, not of the type. A future allocation convention that changed that order would need this check on its first day.",
        nonVacuousPredicate: hits.parent_would_have_no_productive_labour > 0 && accepted > 1000,
        nonVacuous: { predicate: "the sweep genuinely accepted many allocations AND genuinely fired the other refusal, so the zero is specific rather than an inert instrument",
          accepted, parentRefusals: hits.parent_would_have_no_productive_labour } });
  }

  // ══════════════ A6 — determinism ══════════════
  {
    const parent = { workingAdults: 29, dependents: 14, elders: 7 };
    const a = JSON.stringify(allocateFounderCohorts(parent, 18));
    const b = JSON.stringify(allocateFounderCohorts(parent, 18));
    const c = JSON.stringify(allocateFounderCohorts({ ...parent }, 18));
    add("A6_deterministic",
      a === b && b === c ? "IDENTICAL_ON_REPEAT_AND_ON_A_FRESH_OBJECT" : "UNEXPECTED",
      { identical: a === b && b === c,
        nonVacuousPredicate: JSON.parse(a).ok === true,
        nonVacuous: { predicate: "the repeated call genuinely produced an allocation rather than a refusal" } });
  }

  const list = Object.entries(fixtures);
  const failing = list.filter(([, v]) => String(v.verdict).includes("UNEXPECTED"));
  const vacuous = list.filter(([, v]) => v.vacuous === true);
  const notConstructed = list.filter(([, v]) => v.notConstructed === true);

  out = {
    audit: "ITEM-4-FOUNDER-COHORT-ALLOCATION-FIXTURES",
    defectClosed: "L1 — cohorts were re-derived from fixed ratios on both sides; they are now allocated from the parent's actual composition",
    summary: {
      total: list.length,
      passing: list.length - failing.length - vacuous.length - notConstructed.length,
      failing: failing.length, failingIds: failing.map(([k]) => k),
      vacuous: vacuous.length, vacuousIds: vacuous.map(([k]) => k),
      notConstructed: notConstructed.length, notConstructedIds: notConstructed.map(([k]) => k),
      deferred: 0, unsupported: 0,
    },
    verdicts: Object.fromEntries(list.map(([k, v]) => [k, v.verdict])),
    scopeNote: "this suite proves the ALLOCATION AUTHORITY only. It does not prove that production calls it — that is the departure seam, and it is not yet wired. No production behaviour has changed.",
    fixtures,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
} finally {
  await server.close();
}

console.log(JSON.stringify({ summary: out.summary, verdicts: out.verdicts }, null, 2));
if (out.summary.failing > 0 || out.summary.vacuous > 0) process.exitCode = 1;
