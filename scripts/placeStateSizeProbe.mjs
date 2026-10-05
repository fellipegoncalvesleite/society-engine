// CORRECTION-23E §18 — STATE-SIZE MEASUREMENT.
//
// §13's boundedness constraints apply to any eventual retention repair, so the size of what is
// currently retained has to be on record before anything is proposed. Serialized bytes, not
// estimates.
//
// Usage: node scripts/placeStateSizeProbe.mjs [--years 200] [--arm K0]
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt;
};

const YEARS = Number(arg("years", "200"));
const ARM = arg("arm", "K0");
const OUT = arg("out", `docs/evidence/correction23e/state-size-${ARM}.json`);

const ARM_OPTIONS = {
  K0: undefined,
  K1: { placeRetentionArm: "protect_settled_verification" },
  K4: { placeRetentionArm: "capacity_only", placeRetentionCapacity: 288 },
};

const bytes = (value) => Buffer.byteLength(JSON.stringify(value ?? null), "utf8");

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

  const samples = [];

  for (const years of [25, 50, 100, YEARS]) {
    let world = runner.initSimWorld({ kind: "map2" }, "c23e:state-size");
    world = spawn.removeInitialBands(world, Object.keys(world.bands));
    world = spawn.spawnCustomBands(
      world,
      [{ tileId: "tile:204:72", population: 34, name: "marginal_escapable" }],
      "c23e:state-size",
    );
    const options = ARM_OPTIONS[ARM];
    if (options !== undefined) world = { ...world, auditOptions: options };

    world = runner.stepSim(world, years * 360, "daily");

    const living = Object.values(world.bands).filter(
      (band) => band.viability?.status !== "extinct" && (band.demography?.population ?? 0) > 0,
    );

    if (living.length === 0) {
      samples.push({ years, extinct: true });
      continue;
    }

    let observedTiles = 0;
    let dispositionRows = 0;
    let dispositionBytes = 0;
    let knowledgeBytes = 0;
    let bandBytes = 0;
    let evidenceRows = 0;
    let attemptRows = 0;

    for (const band of living) {
      const records = Object.values(band.knowledge?.observedTiles ?? {});
      observedTiles += records.length;
      for (const record of records) {
        const rows = record.verificationDisposition ?? [];
        dispositionRows += rows.length;
        dispositionBytes += bytes(rows);
      }
      knowledgeBytes += bytes(band.knowledge);
      bandBytes += bytes(band);
      evidenceRows += (band.verificationEvidence ?? []).length;
      attemptRows += (band.frontierVerificationAttempts ?? []).length;
    }

    samples.push({
      years,
      bands: living.length,
      population: living.reduce((acc, band) => acc + (band.demography?.population ?? 0), 0),
      observedTilesPerBand: Math.round((observedTiles / living.length) * 10) / 10,
      dispositionRowsPerBand: Math.round((dispositionRows / living.length) * 10) / 10,
      dispositionKbPerBand: Math.round((dispositionBytes / living.length / 1024) * 100) / 100,
      knowledgeKbPerBand: Math.round((knowledgeBytes / living.length / 1024) * 100) / 100,
      bandKbTotal: Math.round((bandBytes / living.length / 1024) * 100) / 100,
      chronologicalEvidenceRowsPerBand: Math.round((evidenceRows / living.length) * 10) / 10,
      displayRingRowsPerBand: Math.round((attemptRows / living.length) * 10) / 10,
    });
    console.log(JSON.stringify(samples[samples.length - 1]));
  }

  mkdirSync(OUT.slice(0, OUT.lastIndexOf("/")), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ arm: ARM, samples }, null, 2));
  console.log(`wrote ${OUT}`);
} finally {
  await server.close();
}
