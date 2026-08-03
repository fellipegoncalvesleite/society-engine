// CORRECTION-34D §13 — natural instrumentation of the headcount/labour split.
//
// Daily sampling (CORRECTION-34's own finding: physical presence is a daily fact and a
// season-boundary sample hides it entirely). Every counter below is reported whether or not it is
// zero, and a natural zero is stated AS a zero rather than presented as a proof.
//
// A TRAP THIS AUDIT AVOIDS, recorded because a previous pass fell into it: a terminal party is
// PRUNED from `band.expeditions` into `recentExpeditionOutcomes`, so a probe that watches only the
// first store reads every ordinary return as an unexplained disappearance. Both stores are
// consulted, and a headcount fall matched by an outcome record is classified as a PHYSICAL RETURN.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/shared-use-physical-presence-authority-34";
const YEARS = Number(arg("years", "20"));
const OUT = arg("out", `${EVIDENCE}/natural-headcount-labor-${YEARS}y.json`);
const SEED = arg("seed", "audit27:natural:map2:s1");
const AWAY = new Set(["outbound", "operating", "returning"]);
const COMMITTED = new Set(["prepared", "outbound", "operating", "returning"]);

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c34d-nat-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const expedition = await server.ssrLoadModule("/sim/agents/expedition.ts");
  const crowding = await server.ssrLoadModule("/sim/agents/crowding.ts");
  const mobility = await server.ssrLoadModule("/sim/agents/bandMobility.ts");

  const c = {
    bandDays: 0, activePartyDays: 0,
    physicalPartyPeopleDays: 0, productivePartyWorkerDays: 0, nonWorkingAwayPeopleDays: 0,
    partyDaysCarryingANonWorkingMember: 0,
    annualBoundariesCrossedWhileActive: 0,
    cohortTransitionsWhileActive: 0,
    productiveLaborReductions: 0, productiveLaborReducedWorkers: 0,
    physicalHeadcountReductions: 0, physicalHeadcountReducedPeople: 0,
    partyLocalLosses: 0,
    preparedCommitmentsAtFission: 0, physicallyAwayPeopleAtFission: 0,
    fissionsObserved: 0, fissionsBlockedByPhysicalUnavailability: 0,
    consumptionMismatches: 0, carryingMismatches: 0, catchmentMismatches: 0,
    unexplainedPhysicalMovements: 0,
    populationConservationFailures: 0, cohortConservationFailures: 0,
    laborBoundFailures: 0, compositionMismatches: 0, workersExceedingPeople: 0,
    invalidStateRepairs: 0, laborUnsupportedReturns: 0,
  };
  const examples = [];
  const note = (kind, detail) => { if (examples.length < 12) examples.push({ kind, ...detail }); };

  let world = runner.initSimWorld({ kind: "map2" }, SEED);
  const living = (w) => Object.values(w.bands).filter(
    (b) => b.status !== "dispersed" && b.viability?.status !== "absorbed" && b.viability?.status !== "extinct");

  const readBand = (b) => {
    const parties = (b.expeditions ?? []);
    const away = parties.filter((e) => AWAY.has(e.phase));
    return {
      pop: b.demography?.population ?? 0,
      wa: b.demography?.workingAdults ?? 0,
      el: b.demography?.elders ?? 0,
      dep: b.demography?.dependents ?? 0,
      awayPeople: away.reduce((n, e) => n + e.partyWorkers + (e.nonWorkingPartyPeople ?? 0), 0),
      awayWorkers: parties.filter((e) => COMMITTED.has(e.phase)).reduce((n, e) => n + e.partyWorkers, 0),
      awayNonWorking: away.reduce((n, e) => n + (e.nonWorkingPartyPeople ?? 0), 0),
      preparedPeople: parties.filter((e) => e.phase === "prepared")
        .reduce((n, e) => n + e.partyWorkers + (e.nonWorkingPartyPeople ?? 0), 0),
      partyIds: new Set(parties.map((e) => e.id)),
      outcomeIds: new Set((b.recentExpeditionOutcomes ?? []).map((o) => o.id)),
      daughters: (b.daughterBandIds ?? []).length,
      byId: new Map(parties.map((e) => [e.id, e])),
    };
  };

  let prev = new Map(living(world).map((b) => [String(b.id), readBand(b)]));

  for (let day = 0; day < YEARS * 360; day += 1) {
    const beforeSeason = world.time.season;
    world = runner.stepSim(world, 1, "daily");
    const crossedAnnual = beforeSeason !== "spring" && world.time.season === "spring";

    const next = new Map();

    for (const b of living(world)) {
      const id = String(b.id);
      const now = readBand(b);
      next.set(id, now);
      c.bandDays += 1;

      const activeParties = (b.expeditions ?? []).filter((e) => AWAY.has(e.phase));
      if (activeParties.length > 0) {
        c.activePartyDays += activeParties.length;
        c.physicalPartyPeopleDays += now.awayPeople;
        c.nonWorkingAwayPeopleDays += now.awayNonWorking;
        c.partyDaysCarryingANonWorkingMember +=
          activeParties.filter((e) => (e.nonWorkingPartyPeople ?? 0) > 0).length;
        if (crossedAnnual) {
          c.annualBoundariesCrossedWhileActive += 1;
          note("annual_boundary_crossed_while_active", { band: id, day,
            season: world.time.season, activeParties: activeParties.length,
            awayPeople: now.awayPeople, awayWorkers: now.awayWorkers,
            phases: activeParties.map((e) => e.phase) });
        }
      }
      c.productivePartyWorkerDays += now.awayWorkers;

      // ── §11 invariants, every band-day ──────────────────────────────────────────────────────
      const acc = expedition.getBandCommitmentAccounting(b);
      if (!acc.conserved) {
        c.populationConservationFailures += 1;
        note("population_conservation_failure", { band: id, day, away: now.awayPeople, pop: now.pop });
      }
      if (!acc.laborBounded) {
        c.laborBoundFailures += 1;
        note("labor_bound_failure", { band: id, day, awayWorkers: now.awayWorkers, workingAdults: now.wa });
      }
      for (const e of b.expeditions ?? []) {
        const people = e.partyWorkers + (e.nonWorkingPartyPeople ?? 0);
        if (e.partyWorkers > people || e.partyWorkers < 0) {
          c.workersExceedingPeople += 1;
          note("workers_exceed_people", { band: id, day, party: e.id });
        }
        if (e.partyComposition !== undefined &&
            mobility.partyCompositionTotal(e.partyComposition) !== e.partyWorkers) {
          c.compositionMismatches += 1;
          note("composition_mismatch", { band: id, day, party: e.id, workers: e.partyWorkers,
            compositionTotal: mobility.partyCompositionTotal(e.partyComposition) });
        }
        // Carrying: a non-working member may never raise the ceiling above what the productive
        // workers justify. Compared against the production derivation on the same band/tick.
        if (AWAY.has(e.phase)) {
          const justified = expedition.deriveCarryCapacityUnits(
            b, e.partyWorkers, e.injuryLoad ?? 0, Number(world.time.tick));
          if (e.cargo.carryCapacityUnits > justified + 1e-9) {
            c.carryingMismatches += 1;
            note("carrying_mismatch", { band: id, day, party: e.id,
              ceiling: e.cargo.carryCapacityUnits, justifiedByWorkers: justified });
          }
        }
      }
      // Presence must sum to population.
      const presence = crowding.getBandPhysicalPresence(b);
      const represented = presence.reduce((n, s) => n + s.people, 0);
      if (represented !== now.pop) {
        c.cohortConservationFailures += 1;
        note("presence_sum_mismatch", { band: id, day, represented, population: now.pop });
      }
      // Catchment: the away people must be exactly the workers plus the non-working, so the
      // catchment's two subtrahends can neither miss nor double-count a body.
      if (now.awayPeople !== (now.awayWorkers - now.preparedPeople) + now.awayNonWorking) {
        c.catchmentMismatches += 1;
        note("catchment_decomposition_mismatch", { band: id, day,
          awayPeople: now.awayPeople, awayWorkers: now.awayWorkers,
          prepared: now.preparedPeople, awayNonWorking: now.awayNonWorking });
      }

      // ── Day-over-day changes ────────────────────────────────────────────────────────────────
      const was = prev.get(id);
      if (was === undefined) continue;

      if (crossedAnnual && (was.wa !== now.wa || was.el !== now.el || was.dep !== now.dep) &&
          was.awayPeople > 0) {
        c.cohortTransitionsWhileActive += 1;
        note("cohort_transition_while_active", { band: id, day,
          cohorts: `${was.wa}/${was.el}/${was.dep} -> ${now.wa}/${now.el}/${now.dep}`,
          awayPeople: `${was.awayPeople} -> ${now.awayPeople}` });
      }

      // Per-party labour and headcount changes, attributed.
      for (const [pid, before] of was.byId) {
        const after = now.byId.get(pid);
        const beforePeople = before.partyWorkers + (before.nonWorkingPartyPeople ?? 0);

        if (after === undefined) {
          // Pruned. An outcome record for the same id is an ORDINARY PHYSICAL RETURN, not a
          // disappearance — this is the classification the previous pass's probe got wrong.
          if (!now.outcomeIds.has(pid) && AWAY.has(before.phase) && beforePeople > 0) {
            c.unexplainedPhysicalMovements += 1;
            note("party_vanished_without_outcome", { band: id, day, party: pid, people: beforePeople });
          }
          continue;
        }

        const afterPeople = after.partyWorkers + (after.nonWorkingPartyPeople ?? 0);
        if (after.partyWorkers < before.partyWorkers) {
          c.productiveLaborReductions += 1;
          c.productiveLaborReducedWorkers += before.partyWorkers - after.partyWorkers;
        }
        if (afterPeople < beforePeople) {
          c.physicalHeadcountReductions += 1;
          c.physicalHeadcountReducedPeople += beforePeople - afterPeople;
          if (!["lost", "aborted", "completed"].includes(after.phase)) {
            c.unexplainedPhysicalMovements += 1;
            note("headcount_fell_without_terminal_phase", { band: id, day, party: pid,
              people: `${beforePeople} -> ${afterPeople}`, phase: after.phase,
              outcomeReason: after.outcomeReason ?? null });
          }
        }
        if (after.phase === "lost" && before.phase !== "lost") c.partyLocalLosses += 1;
        if (after.outcomeReason === "invalid_state_repaired" && before.outcomeReason !== "invalid_state_repaired") {
          c.invalidStateRepairs += 1;
          note("invalid_state_repair", { band: id, day, party: pid });
        }
        if (after.outcomeReason === "party_labor_unsupported" && before.outcomeReason !== "party_labor_unsupported") {
          c.laborUnsupportedReturns += 1;
          note("labor_unsupported_return", { band: id, day, party: pid });
        }
        // Consumption: provisions must rise by the PHYSICAL headcount's daily draw while away.
        if (AWAY.has(before.phase) && AWAY.has(after.phase)) {
          const eaten = after.cargo.provisionUnitsConsumed - before.cargo.provisionUnitsConsumed;
          const expected = afterPeople * expedition.EXPEDITION_PROVISION_UNITS_PER_WORKER_DAY;
          // A day may also charge task-camp setup or campless shuttle provisions, so the test is
          // that consumption is never LESS than the whole party eating — never that it is exact.
          if (eaten > 0 && eaten + 1e-9 < expected) {
            c.consumptionMismatches += 1;
            note("consumption_below_headcount", { band: id, day, party: pid, eaten, expectedAtLeast: expected });
          }
        }
      }

      // Fission: measured at the instant a daughter id appears.
      if (now.daughters > was.daughters) {
        c.fissionsObserved += 1;
        c.preparedCommitmentsAtFission += was.preparedPeople;
        c.physicallyAwayPeopleAtFission += was.awayPeople;
        note("fission", { band: id, day, physicallyAway: was.awayPeople, prepared: was.preparedPeople,
          populationBefore: was.pop });
      } else if (was.awayPeople > 0 && was.pop >= 36 && now.daughters === was.daughters) {
        // A band physically thin at home that did not fission: counted only when the away
        // headcount is what makes the founder draw impossible, so this is a bound, not a claim.
        const uncapped = Math.round(was.pop * 0.34);
        const available = Math.max(0, was.pop - was.awayPeople - was.preparedPeople);
        if (uncapped >= 18 && available < 18) c.fissionsBlockedByPhysicalUnavailability += 1;
      }
    }

    prev = next;
  }

  const naturalNulls = Object.entries(c).filter(([, v]) => v === 0).map(([k]) => k);
  const adverse = [
    "consumptionMismatches", "carryingMismatches", "catchmentMismatches",
    "unexplainedPhysicalMovements", "populationConservationFailures", "cohortConservationFailures",
    "laborBoundFailures", "compositionMismatches", "workersExceedingPeople",
  ];
  const adverseTotal = adverse.reduce((n, k) => n + c[k], 0);

  out = {
    audit: "CORRECTION-34D-NATURAL-HEADCOUNT-LABOR",
    years: YEARS, seed: SEED, map: "map2", sampling: "daily",
    counters: c,
    adverseTotal,
    verdict: adverseTotal === 0 ? "NO_ADVERSE_OBSERVATIONS" : "ADVERSE_OBSERVATIONS_PRESENT",
    naturalNulls,
    nullHonesty:
      "Counters reading zero are NATURAL ZEROS and are stated as such. A party lives at most 24 days against ANNUAL demography, so cohort transitions and labour reductions while a party is away do not occur naturally in this world. These zeros therefore prove NOTHING about the correctness of the reduction path — the controlled H1-H14 fixtures are that proof, and they were built regardless of natural frequency.",
    examples,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
} finally {
  await server.close();
}

console.log(JSON.stringify({ years: out.years, verdict: out.verdict, adverseTotal: out.adverseTotal, counters: out.counters }, null, 2));
if (out.adverseTotal > 0) process.exitCode = 1;
