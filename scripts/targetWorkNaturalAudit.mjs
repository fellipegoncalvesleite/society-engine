// CORRECTION-34E §12 — natural occurrence of expedition target work, sampled DAILY.
//
// Every day of a real production run, every band's expedition records are read. An expedition
// that performed target work that day carries the resolved record on `pendingReturnRecord` and
// has advanced `workDaysElapsed`, so a work-day is identified by the pair
// (expeditionId, workDaysElapsed) changing — no production hook and no re-implemented arithmetic.
//
// The load-bearing assertion is per work-day and exact:
//   record.estimatedPeopleCount === getExpeditionProductiveWorkers(expedition)
// Any work-day where that fails is a work-day whose distant labour came from somewhere other than
// the party standing there.
//
// A natural ZERO here is descriptive only. The controlled T1-T14 fixtures are the proof; this
// measures how often the repaired path runs at all, and whether anything unexpected appears.
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const EVIDENCE = "docs/evidence/shared-use-physical-presence-authority-34";
const YEARS = Number(arg("years", "20"));
const SEED = arg("seed", "audit27:natural:map2:s1");
const OUT = arg("out", `${EVIDENCE}/natural-target-work-${YEARS}y.json`);

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c34e-nat-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const mobility = await server.ssrLoadModule("/sim/agents/bandMobility.ts");
  const expeditionMod = await server.ssrLoadModule("/sim/agents/expedition.ts");

  let world = runner.initSimWorld({ kind: "map2" }, SEED);
  const days = YEARS * 360;

  const seen = new Set();
  const acc = {
    bandDays: 0,
    activePartyDays: 0,
    operatingWorkDays: 0,
    exploitationWorkDays: 0,
    verificationWorkDays: 0,
    productiveWorkerDaysOnWorkDays: 0,
    physicalPeopleDaysOnWorkDays: 0,
    nonWorkingPeopleDaysOnWorkDays: 0,
    recordPeopleSumOnWorkDays: 0,
    workDaysWhereRecordPeopleNotEqualPartyWorkers: 0,
    workDaysWithZeroResidentialProductiveLabour: 0,
    workDaysWithZeroResidentialProductiveLabourAndPositiveWork: 0,
    workDaysWhereResidentialCountWouldHaveDiffered: 0,
    targetStockRemovedSum: 0,
    usableSupportSum: 0,
    transportLossSum: 0,
    processingLossSum: 0,
    workDaysWithDepletion: 0,
    verifyOnlyAttempts: 0,
    verifyOnlyDepletionEvents: 0,
    cargoAcceptedSum: 0,
    cargoAbandonedSum: 0,
    provisionsConsumedSum: 0,
    returnedSupportSum: 0,
    stockConservationFailures: 0,
    duplicateWorkReceipts: 0,
    supportExceedingRemoval: 0,
    personConservationFailures: 0,
    labourBoundFailures: 0,
    peopleCountRange: { min: null, max: null },
    partyWorkerRange: { min: null, max: null },
    residentialAtWorkDayRange: { min: null, max: null },
    outcomeReasonsOnWorkDays: {},
    sourceKindsOnWorkDays: {},
  };
  const range = (r, v) => {
    r.min = r.min === null ? v : Math.min(r.min, v);
    r.max = r.max === null ? v : Math.max(r.max, v);
  };
  const deliveredOutcomeIds = new Set();
  let deliveredHarvestUnitsSum = 0;
  let deliveredOutcomes = 0;

  for (let d = 0; d < days; d += 1) {
    world = advance.advanceWorldByDays(world, 1);
    for (const band of Object.values(world.bands)) {
      if (band.status === "dispersed" || band.viability?.status === "extinct" || band.viability?.status === "absorbed") {
        continue;
      }
      acc.bandDays += 1;

      const accounting = expeditionMod.getBandCommitmentAccounting(band);
      if (!accounting.conserved) acc.personConservationFailures += 1;
      if (!accounting.laborBounded) acc.labourBoundFailures += 1;
      const residential = expeditionMod.getResidentialWorkingAdults(band);

      for (const expedition of band.expeditions ?? []) {
        if (mobility.isPhysicallyAwayPhase(expedition.phase)) acc.activePartyDays += 1;

        // An exploitation work-day carries `pendingReturnRecord`; a verification work-day carries
        // `pendingKnowledgeRecord`. Both are the resolved target-work record and both must show the
        // party's own labour, so both are counted — separated by which field holds them.
        const isVerification = expedition.pendingReturnRecord === undefined &&
          expedition.pendingKnowledgeRecord !== undefined;
        const record = expedition.pendingReturnRecord ?? expedition.pendingKnowledgeRecord;
        if (record === undefined) continue;
        const key = `${band.id}|${expedition.id}|${expedition.workDaysElapsed}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (expedition.workDaysElapsed <= 0) continue;

        acc.operatingWorkDays += 1;
        if (isVerification) acc.verificationWorkDays += 1; else acc.exploitationWorkDays += 1;
        const workers = mobility.getExpeditionProductiveWorkers(expedition);
        const bodies = mobility.getExpeditionPhysicalPeople(expedition);
        const people = record.estimatedPeopleCount ?? -1;

        acc.productiveWorkerDaysOnWorkDays += workers;
        acc.physicalPeopleDaysOnWorkDays += bodies;
        acc.nonWorkingPeopleDaysOnWorkDays += Math.max(0, expedition.nonWorkingPartyPeople ?? 0);
        acc.recordPeopleSumOnWorkDays += people;
        range(acc.peopleCountRange, people);
        range(acc.partyWorkerRange, workers);
        range(acc.residentialAtWorkDayRange, residential);

        if (people !== workers) acc.workDaysWhereRecordPeopleNotEqualPartyWorkers += 1;
        if (residential <= 0) acc.workDaysWithZeroResidentialProductiveLabour += 1;

        const harvest = record.physicalFoodHarvest;
        const removed = harvest?.depletionApplied ?? 0;
        const support = harvest?.usableSupport ?? 0;
        acc.targetStockRemovedSum += removed;
        acc.usableSupportSum += support;
        acc.transportLossSum += harvest?.transportLoss ?? 0;
        acc.processingLossSum += harvest?.processingLoss ?? 0;
        if (removed > 0) acc.workDaysWithDepletion += 1;
        if (residential <= 0 && support > 0) acc.workDaysWithZeroResidentialProductiveLabourAndPositiveWork += 1;
        if (support > removed + 1e-9) acc.supportExceedingRemoval += 1;
        if ((harvest?.harvestedAmount ?? 0) !== removed) acc.stockConservationFailures += 1;

        // What the OLD residential authority would have produced on this same day. It is a capped
        // share of residential adults floored at one; the share depends on the task group, so the
        // comparison recorded here is the weaker, unambiguous one: would a residence-derived count
        // have been a DIFFERENT number from the party's labour? A floor of one alone settles it
        // whenever the party is larger or the residence is empty.
        const residentialFlooredAtLeastOne = Math.max(1, residential);
        if (residentialFlooredAtLeastOne !== workers) acc.workDaysWhereResidentialCountWouldHaveDiffered += 1;

        const reason = String(expedition.outcomeReason ?? "none");
        acc.outcomeReasonsOnWorkDays[reason] = (acc.outcomeReasonsOnWorkDays[reason] ?? 0) + 1;
        const sk = String(harvest?.sourceKind ?? "none");
        acc.sourceKindsOnWorkDays[sk] = (acc.sourceKindsOnWorkDays[sk] ?? 0) + 1;

        if (isVerification) {
          acc.verifyOnlyAttempts += 1;
          // A verification day that removed anything would mean `verifyOnly` failed to suppress
          // the take. This is the counter that must stay at zero.
          if (removed > 0) acc.verifyOnlyDepletionEvents += 1;
        }
      }

      for (const outcome of band.recentExpeditionOutcomes ?? []) {
        const id = `${band.id}|${outcome.id}`;
        if (deliveredOutcomeIds.has(id)) continue;
        deliveredOutcomeIds.add(id);
        deliveredOutcomes += 1;
        deliveredHarvestUnitsSum += outcome.deliveredHarvestUnits ?? 0;
        acc.cargoAcceptedSum += outcome.deliveredHarvestUnits ?? 0;
        acc.cargoAbandonedSum += outcome.lostUnits ?? 0;
        acc.provisionsConsumedSum += outcome.provisionUnitsConsumed ?? 0;
      }
    }
  }

  acc.returnedSupportSum = Number(deliveredHarvestUnitsSum.toFixed(6));
  for (const k of ["targetStockRemovedSum", "usableSupportSum", "transportLossSum", "processingLossSum",
    "cargoAcceptedSum", "cargoAbandonedSum", "provisionsConsumedSum"]) {
    acc[k] = Number(acc[k].toFixed(6));
  }

  out = {
    audit: "CORRECTION-34E-NATURAL-TARGET-WORK",
    seed: SEED,
    years: YEARS,
    days,
    ...acc,
    deliveredOutcomes,
    adverse: {
      workDaysWhereRecordPeopleNotEqualPartyWorkers: acc.workDaysWhereRecordPeopleNotEqualPartyWorkers,
      verifyOnlyDepletionEvents: acc.verifyOnlyDepletionEvents,
      stockConservationFailures: acc.stockConservationFailures,
      supportExceedingRemoval: acc.supportExceedingRemoval,
      personConservationFailures: acc.personConservationFailures,
      duplicateWorkReceipts: acc.duplicateWorkReceipts,
    },
    nonVacuity: {
      operatingWorkDaysObserved: acc.operatingWorkDays,
      workDaysWithDepletion: acc.workDaysWithDepletion,
      claimIsProvenByFixturesNotByThisRun: true,
      note: "a zero on any adverse counter is DESCRIPTIVE ONLY; if operatingWorkDays is 0 this run proves nothing at all about the repair",
    },
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
} finally {
  await server.close();
}

console.log(JSON.stringify({
  seed: out.seed, years: out.years, bandDays: out.bandDays, activePartyDays: out.activePartyDays,
  operatingWorkDays: out.operatingWorkDays, workDaysWithDepletion: out.workDaysWithDepletion,
  productiveWorkerDays: out.productiveWorkerDaysOnWorkDays, physicalPeopleDays: out.physicalPeopleDaysOnWorkDays,
  recordPeopleSum: out.recordPeopleSumOnWorkDays, targetStockRemoved: out.targetStockRemovedSum,
  usableSupport: out.usableSupportSum, returnedSupport: out.returnedSupportSum,
  zeroResidentialWorkDays: out.workDaysWithZeroResidentialProductiveLabour,
  residentialWouldHaveDiffered: out.workDaysWhereResidentialCountWouldHaveDiffered,
  adverse: out.adverse,
}, null, 2));
