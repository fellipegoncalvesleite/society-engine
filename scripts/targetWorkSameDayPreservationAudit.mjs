// CORRECTION-34E §9 T7 (cross-tree half) — did the ORDINARY SAME-DAY path change?
//
// WHAT THIS CAN AND CANNOT COMPARE, stated before the numbers.
//
// A whole-world byte comparison across the two trees is NOT a valid preservation test past the
// first expedition work day, and running one would be dishonest. CORRECTION-34E deliberately
// changes what an expedition party's target-work record says — including a VERIFICATION party's,
// whose `estimatedPeopleCount` feeds its own outcome classification and therefore the observation
// it carries home. From that day on the two worlds legitimately differ, and any divergence found
// afterwards says nothing about the same-day path.
//
// So this audit compares the PREFIX: it steps one day at a time and digests every same-day trip
// record produced, stopping at the first day on which any expedition holds a resolved target-work
// record (`pendingReturnRecord` or `pendingKnowledgeRecord`). Over that prefix the two trees have
// no legitimate source of divergence at all, so a byte-identical digest is a real preservation
// proof over a real, non-empty set — and a differing digest would be a real regression.
//
// Run on both trees with the SAME arguments and diff the two files.
import { createServer } from "vite";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const OUT = arg("out", "docs/evidence/shared-use-physical-presence-authority-34/same-day-preservation.json");
const SEED = arg("seed", "audit27:natural:map2:s1");
const MAX_DAYS = Number(arg("max-days", "1440"));

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c34e-sd-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");

  let world = runner.initSimWorld({ kind: "map2" }, SEED);
  const digest = createHash("sha256");
  let records = 0;
  let peopleSum = 0;
  let daysCompared = 0;
  let stoppedBecause = "max_days_reached";
  const seenRecord = new Set();

  for (let d = 0; d < MAX_DAYS; d += 1) {
    world = advance.advanceWorldByDays(world, 1);

    const targetWorkPresent = Object.values(world.bands).some((b) =>
      (b.expeditions ?? []).some((e) =>
        e.pendingReturnRecord !== undefined || e.pendingKnowledgeRecord !== undefined));
    if (targetWorkPresent) {
      stoppedBecause = "first_expedition_target_work_day";
      break;
    }

    for (const band of Object.values(world.bands).sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
      for (const r of band.recentIntraSeasonTrips ?? []) {
        const key = `${band.id}|${r.id ?? `${r.day}:${r.targetTileId}:${r.cause}`}`;
        if (seenRecord.has(key)) continue;
        seenRecord.add(key);
        records += 1;
        peopleSum += r.estimatedPeopleCount ?? 0;
        digest.update([
          String(band.id), String(r.day), String(r.cause), String(r.taskGroupType),
          String(r.targetTileId), String(r.estimatedPeopleCount),
          String(r.activityOutcome), String(r.resourceReturn?.returnedResourceKind),
          String(r.resourceReturn?.estimatedReturnValue),
          String(r.physicalFoodHarvest?.harvestedAmount),
          String(r.physicalFoodHarvest?.depletionApplied),
          String(r.physicalFoodHarvest?.usableSupport),
        ].join("|"));
        digest.update("\n");
      }
    }
    daysCompared = d + 1;
  }

  out = {
    audit: "CORRECTION-34E-SAME-DAY-PREFIX-PRESERVATION",
    seed: SEED,
    maxDays: MAX_DAYS,
    daysCompared,
    stoppedBecause,
    sameDayTripRecordsDigested: records,
    sameDayPeopleCountSum: peopleSum,
    digest: digest.digest("hex"),
    scope: "same-day trip records only, over the prefix with no expedition target work — the only window in which the two trees have no legitimate source of divergence",
    doesNotClaim: "byte identity of the whole world, or identity past the first expedition work day; CORRECTION-34E intentionally changes what an expedition party's own record says, verification parties included",
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
} finally {
  await server.close();
}

console.log(JSON.stringify(out, null, 2));
