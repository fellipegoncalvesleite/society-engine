// ROADMAP ITEM 3 — SUPPLEMENTARY DETERMINISM: THE DERIVED LIFECYCLE, AND A PARTY AT A BOUNDARY.
//
// `itemThreeDeterminismAudit.mjs` compares a canonical projection that includes the friction RING.
// The social-evidence lifecycle (`socialEvidencePhase`, `activeEvidenceCount`,
// `historicalEvidenceCount`, `activeEvidenceWeight`) is DERIVED from that ring every tick, so it is
// identical by construction whenever the ring and the clock are. That is a sound argument, but it
// is an argument — §9 asks for a compared run that actually contains the cooling/release lifecycle,
// so this audit compares the derived fields THEMSELVES across all four step modes and refuses to
// pass unless the lifecycle genuinely occurs in the compared span.
//
// It also answers the one occurrence question the main determinism audit does not: was a party
// still physically away ON a demographic boundary day, so that the four-mode identity covers the
// interaction CORRECTION-34C and -34D were about?
//
// AUDIT ONLY.
import { createServer } from "vite";
import { createHash } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const OUT = arg("out", "artifacts/c36/lifecycle-determinism.json");
const SEED = arg("seed", "audit27:natural:s1");
const SPAN = Number(arg("span", "5040"));
const MODES = [["daily", 1], ["weekly", 7], ["monthly", 30], ["seasonal", 90]];

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c36ld-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const accessNorms = await server.ssrLoadModule("/sim/agents/accessNorms.ts");
  const mobility = await server.ssrLoadModule("/sim/agents/bandMobility.ts");
  const sha = (v) => createHash("sha256").update(v).digest("hex").slice(0, 32);

  // The derived lifecycle, for every band and every place it tracks.
  const lifecycleProjection = (w) => JSON.stringify(Object.values(w.bands)
    .filter((b) => b.status !== "dispersed" && b.viability?.status !== "extinct")
    .sort((x, y) => String(x.id).localeCompare(String(y.id)))
    .map((b) => {
      const acc = accessNorms.advanceProtoAccessMemory(w, b);
      return {
        band: String(b.id),
        places: Object.values(acc.places ?? {})
          .sort((x, y) => String(x.tileId).localeCompare(String(y.tileId)))
          .map((p) => [String(p.tileId), String(p.socialEvidencePhase ?? "-"),
            p.activeEvidenceCount ?? "-", p.historicalEvidenceCount ?? "-",
            p.activeEvidenceWeight ?? "-"].join("|")),
      };
    }));

  const phaseCounts = (w) => {
    const counts = { none: 0, active: 0, cooling: 0, released_historical: 0 };
    for (const b of Object.values(w.bands)) {
      if (b.status === "dispersed" || b.viability?.status === "extinct") continue;
      const acc = accessNorms.advanceProtoAccessMemory(w, b);
      for (const p of Object.values(acc.places ?? {})) {
        const ph = String(p.socialEvidencePhase ?? "none");
        counts[ph] = (counts[ph] ?? 0) + 1;
      }
    }
    return counts;
  };

  // ── four modes over the same span, sampled ALONG the trajectory ──
  //
  // An end-state comparison is the wrong instrument here. A place cools and releases and may be
  // dropped from bounded access memory long before the run ends, so an end-of-span sample can read
  // `none` everywhere while the lifecycle ran repeatedly in between — which is exactly what the
  // first form of this audit measured, and it reported VACUOUS honestly rather than passing.
  //
  // The whole trajectory is hashed instead, sampled on the 90-day grid, which is the coarsest
  // mode's own step and therefore the only boundary all four modes are guaranteed to share.
  const SAMPLE_EVERY = 90;
  const digests = {};
  let dailyCounts = null;
  const dailyTimeline = [];
  for (const [mode, days] of MODES) {
    let w = runner.initSimWorld({ kind: "map2" }, SEED);
    const samples = [];
    const totals = { none: 0, active: 0, cooling: 0, released_historical: 0 };
    let elapsed = 0;
    while (elapsed < SPAN) {
      const block = Math.min(SAMPLE_EVERY, SPAN - elapsed);
      let inBlock = 0;
      while (inBlock < block) {
        const step = Math.min(days, block - inBlock);
        w = advance.advanceWorldByDays(w, step);
        inBlock += step;
      }
      elapsed += block;
      samples.push(lifecycleProjection(w));
      if (mode === "daily") {
        const c = phaseCounts(w);
        for (const k of Object.keys(totals)) totals[k] += c[k] ?? 0;
        if (c.cooling > 0 || c.released_historical > 0 || c.active > 0) {
          dailyTimeline.push({ day: Number(w.time.day ?? elapsed), ...c });
        }
      }
    }
    digests[mode] = sha(samples.join("\n"));
    if (mode === "daily") dailyCounts = totals;
  }
  const allMatch = Object.values(digests).every((d) => d === digests.daily);

  // ── was a party still away ON a demographic boundary day? ──
  //
  // Demography runs annually in spring. Stepping DAILY is the only way to see it: CORRECTION-34A
  // and -34D both record that a season-boundary sample hides this entirely.
  let w = runner.initSimWorld({ kind: "map2" }, SEED);
  let boundaryDaysWithActiveParty = 0;
  let boundariesObserved = 0;
  let maxPartiesOnABoundaryDay = 0;
  let lastYear = Number(w.time.year);
  const boundarySamples = [];
  for (let d = 0; d < SPAN; d += 1) {
    w = advance.advanceWorldByDays(w, 1);
    const year = Number(w.time.year);
    if (year !== lastYear) {
      lastYear = year;
      boundariesObserved += 1;
      const away = Object.values(w.bands).reduce((n, b) => n + (b.expeditions ?? [])
        .filter((e) => mobility.isPhysicallyAwayPhase(e.phase)).length, 0);
      if (away > 0) {
        boundaryDaysWithActiveParty += 1;
        maxPartiesOnABoundaryDay = Math.max(maxPartiesOnABoundaryDay, away);
        if (boundarySamples.length < 8) {
          boundarySamples.push({ day: Number(w.time.day ?? d), year, partiesPhysicallyAway: away });
        }
      }
    }
  }

  const lifecycleOccurs = dailyCounts.cooling > 0 || dailyCounts.released_historical > 0;
  const verdict = !allMatch ? "MODES_DIVERGED"
    : !lifecycleOccurs ? "VACUOUS_NO_COOLING_OR_RELEASE_IN_THE_COMPARED_SPAN"
      : "ALL_FOUR_MODES_IDENTICAL_ON_THE_DERIVED_LIFECYCLE";

  out = {
    audit: "ITEM-3-LIFECYCLE-DETERMINISM",
    seed: SEED, spanDays: SPAN,
    verdict, allModesIdentical: allMatch, digests,
    sampledEveryDays: SAMPLE_EVERY,
    sampledAlongTheTrajectory: "the whole trajectory is hashed, not the end state. A place cools, releases and may drop out of bounded access memory long before the run ends, so an end-of-span sample can read `none` everywhere while the lifecycle ran repeatedly in between.",
    lifecycleOccurrenceSummedOverSamples: dailyCounts,
    lifecycleTimeline: dailyTimeline.slice(0, 40),
    nonVacuity: {
      predicate: "the compared trajectory must actually contain a cooling or released place, or the identity is an identity about nothing",
      lifecycleOccurs,
      coolingPlaceSamples: dailyCounts.cooling,
      releasedPlaceSamples: dailyCounts.released_historical,
      activePlaceSamples: dailyCounts.active,
    },
    activePartyAcrossADemographicBoundary: {
      question: "was a party still physically away on a day the annual demographic step ran?",
      annualBoundariesObserved: boundariesObserved,
      boundaryDaysWithAtLeastOnePartyAway: boundaryDaysWithActiveParty,
      maxPartiesAwayOnABoundaryDay: maxPartiesOnABoundaryDay,
      samples: boundarySamples,
      sampledDaily: true,
      note: "sampled DAILY on purpose. CORRECTION-34A and -34D both record that a season-boundary sample reports zero here and is a sampling artefact, not a fact about the world.",
      verdict: boundaryDaysWithActiveParty > 0
        ? "OBSERVED_A_PARTY_AWAY_ACROSS_AN_ANNUAL_DEMOGRAPHIC_BOUNDARY"
        : "NOT_OBSERVED_IN_THIS_SPAN_SEE_CONTROLLED_FIXTURE_I14",
    },
    publicTimeControlNote: "the public Day/Season simplification remains DEFERRED and unimplemented; all four modes are batch sizes over one daily kernel.",
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
} finally {
  await server.close();
}

console.log(JSON.stringify({
  verdict: out.verdict, digests: out.digests,
  lifecycleOccurrence: out.lifecycleOccurrenceInTheComparedSpan,
  boundary: out.activePartyAcrossADemographicBoundary.verdict,
  boundaryDays: out.activePartyAcrossADemographicBoundary.boundaryDaysWithAtLeastOnePartyAway,
  boundariesObserved: out.activePartyAcrossADemographicBoundary.annualBoundariesObserved,
}, null, 2));
if (!out.allModesIdentical || !out.nonVacuity.lifecycleOccurs) process.exitCode = 1;
