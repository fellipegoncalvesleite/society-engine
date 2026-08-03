// CORRECTION-35 — CROSS-TREE COMPARISON PROBE.
//
// A single tree cannot answer "did behaviour change?" or "what did this field used to do?". This
// script emits a canonical digest for a fixed world and a fixed seed so it can be run UNCHANGED in
// the parent tree (742b567), in the lifecycle-only tree (e5e3143) and at the tip, and the three
// compared field by field.
//
// It carries two arms:
//
//   ARM L — the LIFECYCLE arm, for L9. One warm world, every living band. It records the access
//   BEHAVIOUR scalars (which Part A must leave untouched), confidence, the decision, the candidate
//   set and the pressure state, alongside the lifecycle METADATA (which Part A is allowed to
//   change, because the parent's values were false).
//
//   ARM T — the TERRITORIAL arm, for T3. The same bands with `band.territorialPressure` set to
//   0, 0.12 (the spawn constant) and 0.8, everything else byte-identical. On the parent tree the
//   field moves real quantities; on the corrected tree it must move none.
//
// THREE INSTRUMENT CORRECTIONS OVER THE FIRST FORM OF THIS PROBE, EACH OF WHICH WOULD HAVE
// PRODUCED A CONFIDENT AND WRONG NUMBER:
//
//   (1) The access digest omitted `kinTolerance` and `familiarTolerance`. Those are two of the six
//       scalars the released-evidence incident actually moves, and `kinTolerance` is the one the
//       ORIGINAL Item 3 finding missed — it is why that finding reported a 0.02 delta where the
//       true figure is 0.04. A preservation proof that cannot see them is not a preservation proof.
//
//   (2) Candidate identity was read as `c.actionType` / `c.targetTileId`. `AlternativeConsidered`
//       has neither — it carries `action` (an `Action`) and `score` — so every candidate rendered
//       as `?:-:score` and the digest compared SCORES ONLY. Two different candidates at the same
//       score were indistinguishable. Read through `c.action` now.
//
//   (3) Reason pressure was read as `primaryReason.detail.pressure`. There is no `detail`; the
//       field is `pressure` directly on the reason. The old path returned the `-1` fallback in
//       EVERY arm, so "the attribution figure does not vary" was three unreadable sentinels being
//       compared with each other. Worse, `bandDecision.getMobilityPressure` only fills
//       `known_site_sufficient` and `low_mobility_pressure`, which are STAY reasons — no band in a
//       3600-day warm world produces one. The attribution arm therefore also samples an EARLY tick,
//       where bands do still stay, so the term is genuinely exercised.
//
//   (4) The decision score was read as `d.score`. `Decision` (rules/types.ts:1542) has no `score`
//       field — it carries `action`, the reasons, `alternativesConsidered` and
//       `coreDeliberationBreadth`. `round4(undefined)` is `undefined`, which `JSON.stringify`
//       DROPS, so the key vanished from the output and every "score unchanged" comparison was
//       between two absent values. The winning candidate's score is now recovered from
//       `alternativesConsidered` by matching the selected action, and `coreDeliberationBreadth` is
//       recorded alongside it.
import { createServer } from "vite";
import { createHash } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const OUT = arg("out", "artifacts/c35-crosstree.json");
const SEED = arg("seed", "audit27:natural:s1");
const WARM = Number(arg("warm-days", "3600"));
// Short warm-up for the attribution arm. `getMobilityPressure` fills only STAY reasons, and a band
// 3600 days into this world is always moving, scouting or probing.
const STAY_WARM = Number(arg("stay-warm-days", "180"));
const TERRITORIAL_VALUES = [0, 0.12, 0.8];

const server = await createServer({
  root: `${process.cwd()}/src`,
  cacheDir: `node_modules/.vite-c35x-${process.pid}`,
  configFile: false, appType: "custom",
  server: { middlewareMode: true, hmr: false }, logLevel: "error",
});

let out;
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const advance = await server.ssrLoadModule("/sim/tick/advance.ts");
  const bandDecision = await server.ssrLoadModule("/sim/rules/bandDecision.ts");
  const pressure = await server.ssrLoadModule("/sim/agents/pressure.ts");
  const accessNorms = await server.ssrLoadModule("/sim/agents/accessNorms.ts");
  const contextCache = await server.ssrLoadModule("/sim/agents/contextCache.ts");

  const r4 = (v) => (typeof v === "number" ? Math.round(v * 10000) / 10000 : v);
  const sha = (v) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 32);
  const living = (w) => Object.values(w.bands)
    .filter((b) => b.status !== "dispersed" && b.viability?.status !== "extinct")
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));

  // Every ProtoAccessMemory scalar that carries social BEHAVIOUR. Part A must leave all six and
  // `confidence` numerically identical to the parent tree.
  const ACCESS_SCALARS = ["strangerCaution", "sharedUsePressure", "rememberedRefusalAvoidance",
    "rememberedCooperationTolerance", "kinTolerance", "familiarTolerance", "confidence"];
  // The lifecycle metadata Part A is correcting. The parent's values here are the DEFECT.
  const LIFECYCLE_FIELDS = ["socialEvidencePhase", "activeEvidenceCount", "historicalEvidenceCount",
    "activeEvidenceWeight"];

  const candidateOf = (c) =>
    `${String(c.action?.type ?? "?")}:${String(c.action?.targetTileId ?? "-")}:${r4(c.score)}`;

  // `Decision` carries no score of its own. The selected action's score is the score of the
  // alternative that matches it; ties are resolved by taking the best, which is what selection did.
  const selectedScore = (d) => {
    const want = `${String(d.action?.type ?? "?")}:${String(d.action?.targetTileId ?? "-")}`;
    const matches = (d.alternativesConsidered ?? [])
      .filter((c) => `${String(c.action?.type ?? "?")}:${String(c.action?.targetTileId ?? "-")}` === want)
      .map((c) => c.score)
      .filter((s) => typeof s === "number");
    return matches.length === 0 ? null : r4(Math.max(...matches));
  };

  // Reason pressures, read at the CORRECT path and collected from every reason a decision carries.
  // `mobility_pressure` (secondary) reports the `pressure.ts` channel; `known_site_sufficient` and
  // `low_mobility_pressure` report the `bandDecision.getMobilityPressure` ATTRIBUTION channel.
  const reasonPressures = (d) => {
    const rows = [];
    const scan = (r, where) => {
      if (r !== undefined && r !== null && typeof r.pressure === "number") {
        rows.push(`${where}:${String(r.type)}=${r4(r.pressure)}`);
      }
    };
    scan(d.primaryReason, "primary");
    (d.secondaryReasons ?? []).forEach((r, i) => scan(r, `sec${i}`));
    (d.alternativesConsidered ?? []).forEach((a, i) => scan(a.rejectionReason, `alt${i}rej`));
    return rows;
  };

  // ─────────────────── ARM L — lifecycle preservation (L9) ───────────────────
  let world = runner.initSimWorld({ kind: "map2" }, SEED);
  world = advance.advanceWorldByDays(world, WARM);
  const cache = contextCache.buildTickContextCache(world);

  const lifecycleRows = living(world).map((b) => {
    const st = pressure.deriveBandPressureState(world, b, cache);
    const d = bandDecision.evaluateBandDecision(world, b, cache);
    const acc = accessNorms.advanceProtoAccessMemory(world, b);
    const places = Object.values(acc.places ?? {})
      .sort((x, y) => String(x.tileId).localeCompare(String(y.tileId)));
    return {
      band: String(b.id),
      action: String(d.action?.type ?? "?"),
      target: String(d.action?.targetTileId ?? "-"),
      score: selectedScore(d),
      deliberationBreadth: d.coreDeliberationBreadth ?? null,
      candidates: (d.alternativesConsidered ?? []).map(candidateOf).sort(),
      mobilityPressure: r4(st.mobilityPressure),
      netMovePressure: r4(st.netMovePressure),
      reasonPressures: reasonPressures(d),
      accessBehaviour: places.map((p) =>
        [String(p.tileId), ...ACCESS_SCALARS.map((k) => r4(p[k] ?? 0))].join("|")),
      lifecycleMetadata: places.map((p) =>
        [String(p.tileId), ...LIFECYCLE_FIELDS.map((k) => String(p[k] ?? "-"))].join("|")),
      places: places.length,
    };
  });

  // ─────────────────── ARM T — territorial field isolation (T3) ───────────────────
  const territorialArm = (w, c, label) => {
    const rows = living(w).map((b) => {
      const perValue = TERRITORIAL_VALUES.map((v) => {
        const band = { ...b, territorialPressure: v };
        const varied = { ...w, bands: { ...w.bands, [b.id]: band } };
        const vc = contextCache.buildTickContextCache(varied);
        const st = pressure.deriveBandPressureState(varied, band, vc);
        const d = bandDecision.evaluateBandDecision(varied, band, vc);
        return {
          territorialPressure: v,
          mobilityPressure: r4(st.mobilityPressure),
          netMovePressure: r4(st.netMovePressure),
          crowdingPenalty: r4(st.crowdingPenalty ?? 0),
          action: String(d.action?.type ?? "?"),
          target: String(d.action?.targetTileId ?? "-"),
          score: selectedScore(d),
          deliberationBreadth: d.coreDeliberationBreadth ?? null,
          candidates: (d.alternativesConsidered ?? []).map(candidateOf).sort(),
          reasonPressures: reasonPressures(d),
        };
      });
      const baseline = JSON.stringify({ ...perValue[0], territorialPressure: null });
      const inert = perValue.every((r) => JSON.stringify({ ...r, territorialPressure: null }) === baseline);
      // Which named quantities actually move with the field, so the parent tree names its own
      // causal path rather than merely reporting "something differs".
      const movedKeys = [];
      for (const key of ["mobilityPressure", "netMovePressure", "score", "deliberationBreadth", "action", "target"]) {
        if (new Set(perValue.map((r) => JSON.stringify(r[key]))).size > 1) movedKeys.push(key);
      }
      if (new Set(perValue.map((r) => JSON.stringify(r.candidates))).size > 1) movedKeys.push("candidates");
      if (new Set(perValue.map((r) => JSON.stringify(r.reasonPressures))).size > 1) movedKeys.push("reasonPressures");
      // The attribution channel on its own — the STAY reasons `getMobilityPressure` fills.
      const attribution = perValue.map((r) =>
        r.reasonPressures.filter((s) => s.includes("known_site_sufficient") || s.includes("low_mobility_pressure")));
      return {
        band: String(b.id), label, rows: perValue, inert, movedKeys,
        attributionReasons: attribution,
        attributionObserved: attribution.some((a) => a.length > 0),
        attributionMoved: new Set(attribution.map((a) => JSON.stringify(a))).size > 1,
      };
    });
    return rows;
  };

  const territorialLate = territorialArm(world, cache, `warm_${WARM}d`);

  // The attribution arm needs a world young enough that bands still STAY.
  let stayWorld = runner.initSimWorld({ kind: "map2" }, SEED);
  stayWorld = advance.advanceWorldByDays(stayWorld, STAY_WARM);
  const stayCache = contextCache.buildTickContextCache(stayWorld);
  const territorialEarly = territorialArm(stayWorld, stayCache, `warm_${STAY_WARM}d`);

  const allTerritorial = [...territorialLate, ...territorialEarly];

  // ─────────────────── ZERO-DIVERGENCE CONTROL ───────────────────
  //
  // At a long warm-up the parent and the corrected tree hold GENUINELY DIFFERENT WORLDS: the term
  // was live for every one of those 3600 days on the parent, and `netMovePressure` reads
  // accumulated band state (`chronicHardship`, `protoCamp*`, `access*`, `mobilityCostTolerance`),
  // so their histories have diverged. That divergence IS the production change and must not be
  // mistaken for a surviving reader.
  //
  // This arm removes the confound: warm 0 days, so both trees see the identical freshly-spawned
  // world, with every band's `territorialPressure` pinned to 0. If removing the term is exactly
  // equivalent to holding the field at zero, the two trees must agree BIT FOR BIT here.
  let controlWorld = runner.initSimWorld({ kind: "map2" }, SEED);
  {
    const pinned = {};
    for (const [k, b] of Object.entries(controlWorld.bands)) pinned[k] = { ...b, territorialPressure: 0 };
    controlWorld = { ...controlWorld, bands: pinned };
  }
  const controlCache = contextCache.buildTickContextCache(controlWorld);
  const controlRows = Object.values(controlWorld.bands)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map((b) => {
      const st = pressure.deriveBandPressureState(controlWorld, b, controlCache);
      const d = bandDecision.evaluateBandDecision(controlWorld, b, controlCache);
      return {
        band: String(b.id),
        // full float precision on purpose — this arm is a bit-for-bit claim
        mobilityPressure: st.mobilityPressure, netMovePressure: st.netMovePressure,
        action: String(d.action?.type ?? "?"), target: String(d.action?.targetTileId ?? "-"),
        score: selectedScore(d), deliberationBreadth: d.coreDeliberationBreadth ?? null,
        candidates: (d.alternativesConsidered ?? []).map(candidateOf).sort(),
        reasonPressures: reasonPressures(d),
      };
    });

  out = {
    audit: "CORRECTION-35-CROSS-TREE-PROBE",
    seed: SEED, warmDays: WARM, stayWarmDays: STAY_WARM, bands: lifecycleRows.length,
    // ── digests intended to be compared BETWEEN trees ──
    digests: {
      // Must be IDENTICAL between parent and Part A. This is the L9 gate.
      accessBehaviour: sha(lifecycleRows.map((r) => [r.band, r.accessBehaviour])),
      decision: sha(lifecycleRows.map((r) => [r.band, r.action, r.target, r.score, r.candidates])),
      pressureState: sha(lifecycleRows.map((r) => [r.band, r.mobilityPressure, r.netMovePressure])),
      reasonPressures: sha(lifecycleRows.map((r) => [r.band, r.reasonPressures])),
      // EXPECTED TO DIFFER between parent and Part A — the parent's values are the defect.
      lifecycleMetadata: sha(lifecycleRows.map((r) => [r.band, r.lifecycleMetadata])),
      // Must be IDENTICAL between parent and tip. This is the T3 zero-divergence control.
      zeroDivergenceControl: sha(controlRows),
    },
    lifecycleArm: { rows: lifecycleRows },
    territorialArm: {
      summary: {
        bandsMeasured: allTerritorial.length,
        bandsInert: allTerritorial.filter((r) => r.inert).length,
        bandsMoved: allTerritorial.filter((r) => !r.inert).length,
        movedKeyCounts: allTerritorial.reduce((acc, r) => {
          for (const k of r.movedKeys) acc[k] = (acc[k] ?? 0) + 1;
          return acc;
        }, {}),
        attributionObservedBands: allTerritorial.filter((r) => r.attributionObserved).length,
        attributionMovedBands: allTerritorial.filter((r) => r.attributionMoved).length,
      },
      rows: allTerritorial,
    },
    zeroDivergenceControl: {
      note: "warm 0 days, every band's territorialPressure pinned to 0. Parent and corrected tree must agree bit for bit; any difference here would be a surviving reader rather than world divergence.",
      bands: controlRows.length, rows: controlRows,
    },
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
} finally {
  await server.close();
}

console.log(JSON.stringify({
  seed: out.seed, bands: out.bands,
  digests: out.digests,
  territorial: out.territorialArm.summary,
  zeroDivergenceControlBands: out.zeroDivergenceControl.bands,
}, null, 2));
