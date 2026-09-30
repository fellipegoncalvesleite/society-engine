import type { NutritionExposureInterval, NutritionExposureSegment, SeasonalSupportSample } from "./types";

export const NUTRITION_HISTORY_DAYS = 720;
export const ANNUAL_NUTRITION_DAYS = 360;
export const CURRENT_NUTRITION_DAYS = 1;

export class NutritionExposureError extends Error {
  readonly code: "invalid_exposure" | "overlapping_exposure" | "unsupported_nutrition_migration";
  constructor(code: NutritionExposureError["code"], detail: string) {
    super(`${code}: ${detail}`);
    this.name = "NutritionExposureError";
    this.code = code;
  }
}

const fail = (detail: string): never => { throw new NutritionExposureError("invalid_exposure", detail); };
const near = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(a), Math.abs(b));
const normalized = (x: number): boolean => Number.isFinite(x) && x >= 0 && x <= 1;
// Normalize only the derived ratio, never physical quantities. Multiplying the same
// rate by different interval lengths must not move a threshold such as0.92 by one ULP.
export const segmentRatio = (s: NutritionExposureSegment): number => {
  const ratio = s.rawSupportRatio ?? (s.demandUnits === undefined ? 0 : (s.supportUnits ?? 0) / s.demandUnits);
  return Number(ratio.toPrecision(14));
};

export function validateNutritionExposure(e: NutritionExposureInterval): void {
  if (e.version !== 1 || !Number.isInteger(e.startDay) || e.startDay < 0 ||
    !Number.isInteger(e.endDay) || e.endDay <= e.startDay || e.durationDays !== e.endDay - e.startDay ||
    !e.producer || !e.provenance || e.segments.length === 0) fail("invalid physical span/provenance");
  if (e.open && e.durationDays > 90) fail("open interval exceeds90-day bound");
  let cursor = e.startDay;
  for (const s of e.segments) {
    if (s.startDay !== cursor || !Number.isInteger(s.endDay) || s.endDay <= s.startDay || s.endDay > e.endDay ||
      !normalized(s.knownPopulationFraction ?? 1) || (s.knownPopulationFraction ?? 1) <= 0 || !normalized(s.foodStress) || !normalized(s.waterStress) || !normalized(s.perCapitaReturn)) fail("invalid exposure segment");
    if (s.demandUnits === undefined) {
      if (s.supportUnits !== undefined || !Number.isFinite(s.rawSupportRatio) || (s.rawSupportRatio ?? -1) < 0 ||
        e.quantityBasis !== "legacy_ratio_only") fail("unsupported unmeasured quantities");
    } else if (!Number.isFinite(s.demandUnits) || s.demandUnits <= 0 || !Number.isFinite(s.supportUnits) ||
      (s.supportUnits ?? -1) < 0) fail("invalid actual support/demand");
    if (s.demandUnits !== undefined && s.rawSupportRatio !== undefined &&
      (!Number.isFinite(s.rawSupportRatio) || s.rawSupportRatio < 0 ||
        !near(s.rawSupportRatio, (s.supportUnits ?? 0) / s.demandUnits))) fail("inconsistent allocated ratio");
    cursor = s.endDay;
  }
  if (cursor !== e.endDay) fail("unrepresented interval gap");
  const totals = summarizeSegments(e.segments);
  for (const key of ["foodStressDays", "waterStressDays", "recoveryDays"] as const) {
    if (!Number.isFinite(e[key]) || !near(e[key], totals[key])) fail(`inconsistent ${key}`);
  }
  for (const key of ["supportUnits", "demandUnits"] as const) {
    if ((e[key] === undefined) !== (totals[key] === undefined) ||
      (e[key] !== undefined && !near(e[key] as number, totals[key] as number))) fail(`inconsistent ${key}`);
  }
}

// Neumaier compensation keeps physical measures insensitive to how the same elapsed
// course is partitioned. Naive daily summation can cross a two-decimal half-way boundary.
function sumMeasures(values: readonly number[]): number {
  let total = 0, correction = 0;
  for (const value of values) {
    const next = total + value;
    correction += Math.abs(total) >= Math.abs(value)
      ? (total - next) + value : (value - next) + total;
    total = next;
  }
  return total + correction;
}

function summarizeSegments(segments: readonly NutritionExposureSegment[]) {
  const actual = segments.every(s => s.demandUnits !== undefined);
  return {
    supportUnits: actual ? sumMeasures(segments.map(s => s.supportUnits ?? 0)) : undefined,
    demandUnits: actual ? sumMeasures(segments.map(s => s.demandUnits ?? 0)) : undefined,
    foodStressDays: sumMeasures(segments.map(s => (s.endDay - s.startDay) * (s.knownPopulationFraction ?? 1) * s.foodStress)),
    waterStressDays: sumMeasures(segments.map(s => (s.endDay - s.startDay) * (s.knownPopulationFraction ?? 1) * s.waterStress)),
    recoveryDays: sumMeasures(segments.map(s => s.recoveryEligible ? (s.endDay - s.startDay) * (s.knownPopulationFraction ?? 1) : 0)),
  };
}

/** Build one measured interval; equal-rate adjacent runs can share one segment. */
export function makeNutritionExposure(
  producer: NutritionExposureInterval["producer"],
  provenance: string,
  segments: readonly NutritionExposureSegment[],
  open = false,
  quantityBasis: NutritionExposureInterval["quantityBasis"] = "actual",
): NutritionExposureInterval {
  if (!segments.length) return fail("empty measured interval");
  const compact: NutritionExposureSegment[] = [];
  for (const segment of segments) {
    const last = compact[compact.length - 1];
    const days = segment.endDay - segment.startDay;
    const lastDays = last === undefined ? 0 : last.endDay - last.startDay;
    if (last && last.endDay === segment.startDay && last.foodStress === segment.foodStress &&
      last.waterStress === segment.waterStress && last.perCapitaReturn === segment.perCapitaReturn &&
      last.recoveryEligible === segment.recoveryEligible && last.knownPopulationFraction === segment.knownPopulationFraction && last.rawSupportRatio === segment.rawSupportRatio &&
      last.demandUnits !== undefined && segment.demandUnits !== undefined &&
      last.demandUnits / lastDays === segment.demandUnits / days &&
      (last.supportUnits ?? 0) / lastDays === (segment.supportUnits ?? 0) / days) {
      compact[compact.length - 1] = { ...last, endDay: segment.endDay,
        supportUnits: (last.supportUnits ?? 0) + (segment.supportUnits ?? 0),
        demandUnits: last.demandUnits + segment.demandUnits };
    } else compact.push(segment);
  }
  const startDay = compact[0].startDay, endDay = compact[compact.length - 1].endDay;
  const result: NutritionExposureInterval = { version: 1, startDay, endDay, durationDays: endDay - startDay,
    producer, provenance, quantityBasis, ...(open ? { open: true } : {}), segments: compact, ...summarizeSegments(compact) };
  validateNutritionExposure(result);
  return result;
}

export function clipNutritionExposure(e: NutritionExposureInterval, start: number, end: number): NutritionExposureInterval | undefined {
  const segments = e.segments.flatMap(s => {
    const a = Math.max(start, s.startDay), b = Math.min(end, s.endDay);
    if (a >= b) return [];
    const fraction = (b - a) / (s.endDay - s.startDay);
    return [{ ...s, startDay: a, endDay: b,
      supportUnits: s.supportUnits === undefined ? undefined : s.supportUnits * fraction,
      demandUnits: s.demandUnits === undefined ? undefined : s.demandUnits * fraction }];
  });
  return segments.length ? makeNutritionExposure(e.producer, e.provenance, segments, e.open, e.quantityBasis) : undefined;
}

// An unchanged physical prefix need not have identical floating serialization after
// equal-rate runs coalesce and are clipped again. Compare their piecewise measures,
// allowing only numerical roundoff, never a changed stress/eligibility observation.
function sameExposurePrefix(a: NutritionExposureInterval, b: NutritionExposureInterval): boolean {
  if (a.startDay !== b.startDay || a.endDay !== b.endDay) return false;
  const boundaries = [...new Set([...a.segments, ...b.segments].flatMap(s => [s.startDay, s.endDay]))].sort((x, y) => x - y);
  for (let i = 1; i < boundaries.length; i++) {
    const x = clipNutritionExposure(a, boundaries[i - 1], boundaries[i])?.segments[0];
    const y = clipNutritionExposure(b, boundaries[i - 1], boundaries[i])?.segments[0];
    if (!x || !y || x.foodStress !== y.foodStress || x.waterStress !== y.waterStress ||
      x.perCapitaReturn !== y.perCapitaReturn || x.recoveryEligible !== y.recoveryEligible ||
      (x.knownPopulationFraction ?? 1) !== (y.knownPopulationFraction ?? 1)) return false;
    for (const key of ["supportUnits", "demandUnits", "rawSupportRatio"] as const) {
      if ((x[key] === undefined) !== (y[key] === undefined) ||
        (x[key] !== undefined && !near(x[key] as number, y[key] as number))) return false;
    }
  }
  return true;
}

/** Exact revisions replace; an open interval can grow only by retaining its already measured prefix. */
export function insertNutritionExposure(
  samples: readonly SeasonalSupportSample[], sample: SeasonalSupportSample,
): readonly SeasonalSupportSample[] {
  const incoming = sample.exposure;
  if (!incoming) return fail("missing explicit interval");
  validateNutritionExposure(incoming);
  const kept = samples.filter(existing => {
    const e = existing.exposure;
    if (!e) return fail("unmigrated history");
    validateNutritionExposure(e);
    if (e.endDay <= incoming.startDay || e.startDay >= incoming.endDay) return true;
    const sameOwner = e.producer === incoming.producer && e.provenance === incoming.provenance;
    if (sameOwner && e.startDay === incoming.startDay && e.endDay === incoming.endDay) return false;
    if (sameOwner && e.open && e.startDay === incoming.startDay && e.endDay < incoming.endDay) {
      const prefix = clipNutritionExposure(incoming, e.startDay, e.endDay);
      if (prefix && sameExposurePrefix(prefix, e)) return false;
    }
    throw new NutritionExposureError("overlapping_exposure", `${e.producer}[${e.startDay},${e.endDay}) vs ${incoming.producer}[${incoming.startDay},${incoming.endDay})`);
  });
  const ordered = [...kept, sample].sort((a, b) => a.exposure!.startDay - b.exposure!.startDay);
  const open = ordered.filter(s => s.exposure!.open);
  if (open.length > 1 || (open.length && ordered[ordered.length - 1] !== open[0])) fail("more than one or nonterminal open interval");
  const completedEnd = Math.max(0, ...ordered.filter(s => !s.exposure!.open).map(s => s.exposure!.endDay));
  const cutoff = Math.max(0, completedEnd - NUTRITION_HISTORY_DAYS);
  return ordered.flatMap(s => {
    const exposure = clipNutritionExposure(s.exposure!, cutoff, Infinity);
    return exposure ? [{ ...s, exposure }] : [];
  });
}

export function queryNutritionExposure(samples: readonly SeasonalSupportSample[], endDay: number, horizonDays: number) {
  if (!Number.isInteger(endDay) || endDay < 0 || !Number.isInteger(horizonDays) || horizonDays <= 0) fail("invalid query horizon");
  const startDay = Math.max(0, endDay - horizonDays);
  const clipped = samples.flatMap(s => {
    if (!s.exposure) return fail("unmigrated nutrition query");
    const e = clipNutritionExposure(s.exposure, startDay, endDay);
    return e ? [e] : [];
  }).sort((a, b) => a.startDay - b.startDay);
  let cursor = startDay;
  const gaps: [number, number][] = [];
  for (const e of clipped) {
    if (e.startDay < cursor) throw new NutritionExposureError("overlapping_exposure", "query contains overlapping producers");
    if (e.startDay > cursor) gaps.push([cursor, e.startDay]);
    cursor = e.endDay;
  }
  if (cursor < endDay) gaps.push([cursor, endDay]);
  const segments = clipped.flatMap(e => e.segments);
  const coveredDays = segments.reduce((n, s) => n + s.endDay - s.startDay, 0);
  const totals = summarizeSegments(segments);
  const knownPopulationDays = sumMeasures(segments.map(s => (s.endDay - s.startDay) * (s.knownPopulationFraction ?? 1)));
  const weighted = (fn: (s: NutritionExposureSegment) => number): number => knownPopulationDays === 0 ? 0 :
    sumMeasures(segments.map(s => (s.endDay - s.startDay) * (s.knownPopulationFraction ?? 1) * fn(s))) / knownPopulationDays;
  return { startDay, endDay, coveredDays, unknownDays: endDay - startDay - coveredDays, gaps,
    knownPopulationDays, unknownPopulationDays: endDay - startDay - knownPopulationDays,
    available: knownPopulationDays > 0, ...totals,
    pooledSupportRatio: knownPopulationDays === coveredDays && totals.demandUnits && totals.demandUnits > 0 ? (totals.supportUnits ?? 0) / totals.demandUnits : undefined,
    foodStress: weighted(s => s.foodStress), waterStress: weighted(s => s.waterStress),
    clampedSupport: weighted(s => Math.min(1, segmentRatio(s))), rawSupport: weighted(segmentRatio),
    perCapitaReturn: weighted(s => s.perCapitaReturn), recoveryFraction: weighted(s => s.recoveryEligible ? 1 : 0),
    segments };
}

export function trailingExposureDays(segments: readonly NutritionExposureSegment[], endDay: number,
  predicate: (s: NutritionExposureSegment) => boolean): number {
  let cursor = endDay, days = 0;
  for (let i = segments.length - 1; i >= 0; i--) {
    const s = segments[i];
    if (s.endDay !== cursor || !predicate(s)) break;
    days += (s.endDay - s.startDay) * (s.knownPopulationFraction ?? 1); cursor = s.startDay;
  }
  return days;
}

export type NutritionMigrationResult =
  | { readonly ok: true; readonly samples: readonly SeasonalSupportSample[] }
  | { readonly ok: false; readonly code: "unsupported_nutrition_migration"; readonly reason: string };

/** Pure migration: old ordinary samples are coarse90-day measurements, never reconstructed daily truth.
 * Variable provisional history requires a retained, independently dated interval for EVERY old sample.
 * Old ratios alone cannot recover actual support/demand: those quantities remain explicitly unknown.
 */
export function migrateNutritionExposureHistory(samples: readonly SeasonalSupportSample[], context:
  { readonly kind: "ordinary" } | { readonly kind: "provisional"; readonly intervals?: readonly NutritionExposureInterval[] },
): NutritionMigrationResult {
  try {
    let result: readonly SeasonalSupportSample[] = [];
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      let exposure = s.exposure;
      if (!exposure && context.kind === "provisional") {
        exposure = context.intervals?.[i];
        if (!exposure || exposure.producer !== "provisional") throw new Error("retained provisional chronology is insufficient");
      }
      if (!exposure) {
        const endDay = Number(s.tick) * 90;
        if (!Number.isInteger(endDay) || endDay < 90) throw new Error("ordinary sample has no completed90-day chronology");
        exposure = makeNutritionExposure("residential", "legacy_90_day_abstraction", [{ startDay: endDay - 90, endDay,
          rawSupportRatio: s.rawSupportRatio, foodStress: s.foodStress, waterStress: s.waterStress,
          perCapitaReturn: s.perCapitaReturn, recoveryEligible: s.rawSupportRatio >= .98 && s.perCapitaReturn >= .48 &&
            s.foodStress < .32 && s.waterStress < .42 }], false, "legacy_ratio_only");
      }
      result = insertNutritionExposure(result, { ...s, exposure });
    }
    return { ok: true, samples: result };
  } catch (error) {
    return { ok: false, code: "unsupported_nutrition_migration", reason: error instanceof Error ? error.message : String(error) };
  }
}
