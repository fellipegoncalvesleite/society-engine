import type { WorldM0Result } from "./failures";
import { worldM0Failure } from "./failures";
import type { WorldM0PhysicalConstantsV1 } from "./physicalConstants";
import type { WorldM0SpatialGridIdentity } from "./spatialGrid";
import type { TerrainDrainageGraphResult } from "./terrainDrainage";
import {
  canonicalStrategicEdge,
  compareAscii,
  comparePointM,
  signedRingArea2,
} from "./terrainHydroNumeric";
import type {
  LandformProvenanceFamily,
  LandformProvenanceProvince,
  PhysicalCrossingCandidate,
  StrategicTerrainSummary,
  TerrainDepressionBasin,
  WorldM0PointM,
} from "./terrainHydroTypes";
import type { TerrainScratchGrid } from "./terrainScratch";
import type { TerrainValleyGeometryResult } from "./terrainValleys";

const ANALYSIS_CELL_METERS = 250;
const ANALYSIS_CELL_AREA_M2 = 62_500;
const PROVENANCE_FAMILIES: readonly LandformProvenanceFamily[] = [
  "stable_denudational",
  "orogenic_uplift",
  "volcanic_constructive",
  "sedimentary_basin",
];

type TerrainHydroNamespace =
  | "province"
  | "terminal"
  | "catchment"
  | "drainage-node"
  | "drainage-reach"
  | "depression-basin"
  | "valley"
  | "floodplain"
  | "crossing";

interface StrategicGeometry {
  readonly cellWidthM: number;
  readonly cellHeightM: number;
  readonly analysisColumnsPerCell: number;
  readonly analysisRowsPerCell: number;
  readonly cellAreaM2: number;
}

interface MutableStrategicSummary {
  readonly cell: { readonly row: number; readonly column: number };
  readonly landOceanClass: "land" | "ocean" | "mixed";
  readonly landAreaM2: number;
  readonly oceanAreaM2: number;
  readonly elevationMinMeters: number;
  readonly elevationMaxMeters: number;
  readonly elevationMeanMeters: number;
  readonly localReliefMeters: number;
  readonly slopeMean: number;
  coastlineLengthMeters: number;
  readonly provenanceFractions: { readonly provinceId: string; readonly areaFraction: number }[];
  readonly catchmentIds: string[];
  readonly reachIds: string[];
  readonly depressionBasinIds: string[];
  readonly valleyCandidateIds: string[];
  readonly floodplainCandidateIds: string[];
  readonly crossingCandidateIds: string[];
}

interface ProvinceMetric {
  readonly province: LandformProvenanceProvince;
  readonly cosine: number;
  readonly sine: number;
}

interface RectM {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

interface BoundaryEvent {
  t: number;
  readonly kind: "vertical" | "horizontal";
  readonly coordinate: number;
}

function invalid(path: string, detail: string): WorldM0Result<never> {
  return worldM0Failure("M02_CANDIDATE_INVALID", path, detail);
}

function unsupported(path: string, detail: string): WorldM0Result<never> {
  return worldM0Failure("M02_ANALYSIS_GRID_UNSUPPORTED", path, detail);
}

function bound(path: string, detail: string): WorldM0Result<never> {
  return worldM0Failure("M02_BOUND_EXCEEDED", path, detail);
}

function canonicalNumber(value: number): boolean {
  return Number.isFinite(value) && !Object.is(value, -0);
}

function positiveNumber(value: number): boolean {
  return canonicalNumber(value) && value > 0;
}

function samePoint(left: WorldM0PointM, right: WorldM0PointM): boolean {
  return left.xM === right.xM && left.yM === right.yM;
}

function comparePointSequence(left: readonly WorldM0PointM[], right: readonly WorldM0PointM[]): number {
  const shared = Math.min(left.length, right.length);
  for (let index = 0; index < shared; index += 1) {
    const order = comparePointM(left[index], right[index]);
    if (order !== 0) return order;
  }
  return left.length < right.length ? -1 : left.length > right.length ? 1 : 0;
}

function canonicalId(value: string, namespace: TerrainHydroNamespace): boolean {
  const prefix = `${namespace}:`;
  if (typeof value !== "string" || value.length !== prefix.length + 16 || !value.startsWith(prefix)) return false;
  for (let index = prefix.length; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (!((code >= 48 && code <= 57) || (code >= 97 && code <= 102))) return false;
  }
  return true;
}

function pointInsideExtent(point: WorldM0PointM, widthM: number, heightM: number): boolean {
  return canonicalNumber(point.xM) && canonicalNumber(point.yM) &&
    point.xM >= 0 && point.xM <= widthM && point.yM >= 0 && point.yM <= heightM;
}

function canonicalRegistry<T extends { readonly id: string }>(
  items: readonly T[],
  namespace: TerrainHydroNamespace,
  path: string,
  maximum: number,
): WorldM0Result<readonly T[]> {
  if (!Array.isArray(items)) return invalid(path, "persistent registry must be an array");
  if (!Number.isSafeInteger(maximum) || maximum < 0 || items.length > maximum) {
    return bound(path, "persistent registry exceeds its verified bound");
  }
  const copy = [...items];
  const seen = new Set<string>();
  for (const item of copy) {
    if (!item || !canonicalId(item.id, namespace) || seen.has(item.id)) {
      return invalid(`${path}.id`, `registry contains an invalid or duplicate ${namespace} id`);
    }
    seen.add(item.id);
  }
  copy.sort((left, right) => compareAscii(left.id, right.id));
  return { ok: true, value: copy };
}

function validateSpatialAndScratch(
  scratch: TerrainScratchGrid,
  spatial: WorldM0SpatialGridIdentity,
  constants: WorldM0PhysicalConstantsV1,
): WorldM0Result<StrategicGeometry> {
  if (!scratch || !spatial || !constants || constants.analysis.cellSizeMeters !== ANALYSIS_CELL_METERS ||
      scratch.cellSizeMeters !== ANALYSIS_CELL_METERS || scratch.cellAreaM2 !== ANALYSIS_CELL_AREA_M2) {
    return unsupported("scratch", "Task-11 requires the exact verified 250 m physical basis");
  }
  const analysisCellCount = scratch.width * scratch.height;
  if (!Number.isSafeInteger(scratch.width) || scratch.width <= 0 ||
      !Number.isSafeInteger(scratch.height) || scratch.height <= 0 ||
      !Number.isSafeInteger(analysisCellCount) || analysisCellCount <= 0 ||
      analysisCellCount > constants.analysis.maxAnalysisCells) {
    return bound("analysis.maxAnalysisCells", "Task-11 scratch dimensions exceed the verified analysis-cell bound");
  }
  const arrays = [
    scratch.elevationMeters,
    scratch.landMask,
    scratch.routingElevationMeters,
    scratch.flatRank,
    scratch.terminalKindByCell,
    scratch.terminalOrdinalByCell,
  ];
  if (arrays.some((array) => array?.length !== analysisCellCount)) {
    return unsupported("scratch", "Task-11 scratch arrays are structurally inconsistent");
  }
  for (let cell = 0; cell < analysisCellCount; cell += 1) {
    if (!canonicalNumber(scratch.elevationMeters[cell])) {
      return invalid("scratch.elevationMeters", "strategic aggregation encountered a non-canonical elevation");
    }
    if (scratch.landMask[cell] !== 0 && scratch.landMask[cell] !== 1) {
      return invalid("scratch.landMask", "strategic aggregation requires a binary final land mask");
    }
  }

  const extentWidthMeters = scratch.width * ANALYSIS_CELL_METERS;
  const extentHeightMeters = scratch.height * ANALYSIS_CELL_METERS;
  if (spatial.gridSchema !== "world-m0-grid/v1" ||
      spatial.extentWidthMeters !== extentWidthMeters || spatial.extentHeightMeters !== extentHeightMeters ||
      !Number.isSafeInteger(spatial.columnCount) || spatial.columnCount <= 0 ||
      !Number.isSafeInteger(spatial.rowCount) || spatial.rowCount <= 0 ||
      spatial.spatialReference.coordinateFrame !== "cartesian_cell_centers" ||
      spatial.spatialReference.connectivity !== "cardinal_4") {
    return invalid("spatial", "Task-11 spatial identity does not match the final physical extent");
  }
  if (extentWidthMeters % spatial.columnCount !== 0 || extentHeightMeters % spatial.rowCount !== 0) {
    return unsupported("spatial", "strategic grid does not divide the physical extent exactly in integer metres");
  }
  const cellWidthM = extentWidthMeters / spatial.columnCount;
  const cellHeightM = extentHeightMeters / spatial.rowCount;
  if (cellWidthM % ANALYSIS_CELL_METERS !== 0 || cellHeightM % ANALYSIS_CELL_METERS !== 0) {
    return unsupported("spatial", "strategic dimensions must divide exactly by the 250 m physical basis");
  }
  if (spatial.spatialReference.cellWidthKm * 1000 !== cellWidthM ||
      spatial.spatialReference.cellHeightKm * 1000 !== cellHeightM) {
    return invalid("spatial.spatialReference", "strategic metric metadata disagrees with the integer physical grid");
  }
  const strategicCellCount = spatial.columnCount * spatial.rowCount;
  if (!Number.isSafeInteger(strategicCellCount) || strategicCellCount <= 0 || strategicCellCount > analysisCellCount) {
    return bound("spatial", "strategic cell cardinality exceeds the represented physical basis");
  }
  const cellAreaM2 = cellWidthM * cellHeightM;
  if (!Number.isSafeInteger(cellAreaM2) || cellAreaM2 <= 0) {
    return bound("spatial", "strategic physical cell area is not a positive safe integer square-metre value");
  }
  return {
    ok: true,
    value: {
      cellWidthM,
      cellHeightM,
      analysisColumnsPerCell: cellWidthM / ANALYSIS_CELL_METERS,
      analysisRowsPerCell: cellHeightM / ANALYSIS_CELL_METERS,
      cellAreaM2,
    },
  };
}

function validatePointSequence(
  points: readonly WorldM0PointM[],
  path: string,
  widthM: number,
  heightM: number,
  maximumVertices: number,
  closed: boolean,
): WorldM0Result<true> {
  const minimum = closed ? 4 : 2;
  if (!Array.isArray(points) || points.length < minimum || points.length > maximumVertices) {
    return invalid(path, `geometry must contain between ${minimum} and ${maximumVertices} points`);
  }
  if (closed !== samePoint(points[0], points[points.length - 1])) {
    return invalid(path, closed ? "polygon ring must have one exact closure" : "polyline may not be closed as a degenerate two-point registry");
  }
  for (let index = 0; index < points.length; index += 1) {
    if (!pointInsideExtent(points[index], widthM, heightM)) {
      return invalid(path, "geometry contains a non-canonical point outside the physical extent");
    }
    if (index > 0 && samePoint(points[index - 1], points[index])) {
      return invalid(path, "geometry contains a zero-length segment");
    }
  }
  return { ok: true, value: true };
}

function validateRings(
  rings: readonly (readonly WorldM0PointM[])[],
  path: string,
  widthM: number,
  heightM: number,
  maximumVertices: number,
): WorldM0Result<true> {
  if (!Array.isArray(rings) || rings.length === 0 || rings.length > maximumVertices) {
    return invalid(path, "polygon feature requires a bounded non-empty normalized ring registry");
  }
  let outerRingCount = 0;
  for (let index = 0; index < rings.length; index += 1) {
    const checked = validatePointSequence(rings[index], `${path}[${index}]`, widthM, heightM, maximumVertices, true);
    if (!checked.ok) return checked;
    const signed = signedRingArea2(rings[index]);
    if (!signed.ok) return signed;
    if (signed.value > 0) outerRingCount += 1;
  }
  if (outerRingCount === 0) return invalid(path, "polygon feature contains no normalized outer ring");
  return { ok: true, value: true };
}

function validatePhysicalRegistries(
  provincesInput: readonly LandformProvenanceProvince[],
  coastlineInput: readonly (readonly WorldM0PointM[])[],
  drainage: TerrainDrainageGraphResult,
  depressionBasinsInput: readonly TerrainDepressionBasin[],
  valleyGeometry: TerrainValleyGeometryResult,
  crossingCandidatesInput: readonly PhysicalCrossingCandidate[],
  constants: WorldM0PhysicalConstantsV1,
  widthM: number,
  heightM: number,
): WorldM0Result<{
  readonly provinces: readonly LandformProvenanceProvince[];
  readonly coastline: readonly (readonly WorldM0PointM[])[];
  readonly terminals: TerrainDrainageGraphResult["terminals"];
  readonly catchments: TerrainDrainageGraphResult["catchments"];
  readonly nodes: TerrainDrainageGraphResult["nodes"];
  readonly reaches: TerrainDrainageGraphResult["reaches"];
  readonly depressionBasins: readonly TerrainDepressionBasin[];
  readonly valleys: TerrainValleyGeometryResult["valleys"];
  readonly floodplains: TerrainValleyGeometryResult["floodplainCandidates"];
  readonly crossings: readonly PhysicalCrossingCandidate[];
}> {
  if (!drainage || !valleyGeometry) return invalid("physical", "Task-11 requires finalized Tasks 8-10 registries");
  const provinces = canonicalRegistry(
    provincesInput, "province", "provenanceProvinces", constants.analysis.maxAnalysisCells,
  );
  if (!provinces.ok) return provinces;
  if (provinces.value.length !== constants.terrain.provenanceProvinceCount || provinces.value.length === 0) {
    return invalid("provenanceProvinces", "province registry does not match verified physical constants");
  }
  for (const province of provinces.value) {
    if (!PROVENANCE_FAMILIES.includes(province.family) ||
        !pointInsideExtent(province.center, widthM, heightM) ||
        !positiveNumber(province.radiusXM) || !positiveNumber(province.radiusYM) ||
        province.radiusXM < constants.terrain.provinceMinRadiusMeters ||
        province.radiusXM > constants.terrain.provinceMaxRadiusMeters ||
        !canonicalNumber(province.axisAngleRadians) || !positiveNumber(province.influenceRadiusM) ||
        province.influenceRadiusM !== province.radiusXM || !canonicalNumber(province.elevationOffsetMeters) ||
        !positiveNumber(province.reliefMultiplier)) {
      return invalid("provenanceProvinces", "province physical geometry is invalid or outside verified bounds");
    }
  }

  if (!Array.isArray(coastlineInput)) return invalid("coastline", "final coastline must be an array");
  if (coastlineInput.length > constants.analysis.maxAnalysisCells) {
    return bound("coastline", "final coastline trace count exceeds the explicit analysis bound");
  }
  const coastline: (readonly WorldM0PointM[])[] = [];
  for (let index = 0; index < coastlineInput.length; index += 1) {
    const line: readonly WorldM0PointM[] = coastlineInput[index];
    const checked = validatePointSequence(
      line, `coastline[${index}]`, widthM, heightM, constants.geometry.maxPolylineVerticesPerFeature, false,
    );
    if (!checked.ok) return checked;
    coastline.push(line);
  }
  coastline.sort(comparePointSequence);
  for (let index = 1; index < coastline.length; index += 1) {
    if (comparePointSequence(coastline[index - 1], coastline[index]) === 0) {
      return invalid("coastline", "final coastline contains duplicate ordered geometry");
    }
  }

  const terminals = canonicalRegistry(drainage.terminals, "terminal", "drainage.terminals", constants.drainage.maxNodes);
  if (!terminals.ok) return terminals;
  const catchments = canonicalRegistry(drainage.catchments, "catchment", "drainage.catchments", constants.drainage.maxNodes);
  if (!catchments.ok) return catchments;
  const nodes = canonicalRegistry(drainage.nodes, "drainage-node", "drainage.nodes", constants.drainage.maxNodes);
  if (!nodes.ok) return nodes;
  const reaches = canonicalRegistry(drainage.reaches, "drainage-reach", "drainage.reaches", constants.drainage.maxReaches);
  if (!reaches.ok) return reaches;
  const depressionBasins = canonicalRegistry(
    depressionBasinsInput, "depression-basin", "depressionBasins", constants.depression.maxRetainedBasins,
  );
  if (!depressionBasins.ok) return depressionBasins;
  const valleys = canonicalRegistry(valleyGeometry.valleys, "valley", "valleys", constants.drainage.maxReaches);
  if (!valleys.ok) return valleys;
  const floodplains = canonicalRegistry(
    valleyGeometry.floodplainCandidates, "floodplain", "floodplainCandidates", constants.drainage.maxReaches,
  );
  if (!floodplains.ok) return floodplains;
  const crossings = canonicalRegistry(
    crossingCandidatesInput, "crossing", "crossingCandidates", constants.geometry.maxCrossingCandidates,
  );
  if (!crossings.ok) return crossings;

  const terminalById = new Map(terminals.value.map((item) => [item.id, item] as const));
  const catchmentById = new Map(catchments.value.map((item) => [item.id, item] as const));
  const nodeById = new Map(nodes.value.map((item) => [item.id, item] as const));
  const reachById = new Map(reaches.value.map((item) => [item.id, item] as const));

  for (const terminal of terminals.value) {
    if (!pointInsideExtent(terminal.point, widthM, heightM) || !catchmentById.has(terminal.catchmentId)) {
      return invalid("drainage.terminals", "terminal does not resolve to canonical physical point/catchment authority");
    }
  }
  for (const catchment of catchments.value) {
    if (!positiveNumber(catchment.areaM2) || !terminalById.has(catchment.terminalId) ||
        terminalById.get(catchment.terminalId)?.catchmentId !== catchment.id) {
      return invalid("drainage.catchments", "catchment does not resolve to its reciprocal terminal authority");
    }
    const rings = validateRings(
      catchment.boundaryRings, "drainage.catchments.boundaryRings", widthM, heightM,
      constants.geometry.maxPolygonVerticesPerFeature,
    );
    if (!rings.ok) return rings;
  }
  for (const node of nodes.value) {
    if (!pointInsideExtent(node.point, widthM, heightM) ||
        (node.terminalId !== null && !terminalById.has(node.terminalId))) {
      return invalid("drainage.nodes", "drainage node has invalid physical point or terminal reference");
    }
  }
  for (const reach of reaches.value) {
    if (!nodeById.has(reach.upstreamNodeId) || !nodeById.has(reach.downstreamNodeId) ||
        (reach.downstreamReachId !== null && !reachById.has(reach.downstreamReachId)) ||
        !catchmentById.has(reach.catchmentId) || !terminalById.has(reach.terminalId) ||
        !positiveNumber(reach.lengthMeters) || !positiveNumber(reach.contributingAreaM2) ||
        !positiveNumber(reach.localContributingAreaM2) || !canonicalNumber(reach.meanTerrainGradient) ||
        !canonicalNumber(reach.localReliefMeters) || !canonicalNumber(reach.channelIncisionMeters)) {
      return invalid("drainage.reaches", "reach references or physical scalars are invalid");
    }
    const geometry = validatePointSequence(
      reach.geometry, "drainage.reaches.geometry", widthM, heightM,
      constants.geometry.maxPolylineVerticesPerFeature, false,
    );
    if (!geometry.ok) return geometry;
    let representedLength = 0;
    for (let index = 0; index + 1 < reach.geometry.length; index += 1) {
      representedLength += Math.hypot(
        reach.geometry[index + 1].xM - reach.geometry[index].xM,
        reach.geometry[index + 1].yM - reach.geometry[index].yM,
      );
    }
    if (Math.abs(representedLength - reach.lengthMeters) > constants.validation.finiteTolerance * Math.max(1, reach.lengthMeters)) {
      return invalid("drainage.reaches.lengthMeters", "reach length disagrees with its finalized physical geometry");
    }
  }
  for (const basin of depressionBasins.value) {
    if (!catchmentById.has(basin.catchmentId) || !positiveNumber(basin.areaM2) ||
        !canonicalNumber(basin.floorElevationMeters) ||
        (basin.spillElevationMeters !== null && !canonicalNumber(basin.spillElevationMeters)) ||
        (basin.outletTerminalId !== null && !terminalById.has(basin.outletTerminalId))) {
      return invalid("depressionBasins", "depression basin references or physical scalars are invalid");
    }
    const rings = validateRings(
      basin.boundaryRings, "depressionBasins.boundaryRings", widthM, heightM,
      constants.geometry.maxPolygonVerticesPerFeature,
    );
    if (!rings.ok) return rings;
  }
  for (const valley of valleys.value) {
    if (!reachById.has(valley.reachId) || !positiveNumber(valley.areaM2) || !canonicalNumber(valley.localReliefMeters)) {
      return invalid("valleys", "valley references or physical scalars are invalid");
    }
    const rings = validateRings(
      valley.boundaryRings, "valleys.boundaryRings", widthM, heightM,
      constants.geometry.maxPolygonVerticesPerFeature,
    );
    if (!rings.ok) return rings;
  }
  for (const floodplain of floodplains.value) {
    if (!reachById.has(floodplain.reachId) || !positiveNumber(floodplain.areaM2) || !canonicalNumber(floodplain.terrainSlope)) {
      return invalid("floodplainCandidates", "floodplain references or physical scalars are invalid");
    }
    const rings = validateRings(
      floodplain.boundaryRings, "floodplainCandidates.boundaryRings", widthM, heightM,
      constants.geometry.maxPolygonVerticesPerFeature,
    );
    if (!rings.ok) return rings;
  }
  for (const crossing of crossings.value) {
    const edge = canonicalStrategicEdge(crossing.strategicEdge.first, crossing.strategicEdge.second);
    if (!edge.ok || edge.value.first.row !== crossing.strategicEdge.first.row ||
        edge.value.first.column !== crossing.strategicEdge.first.column ||
        edge.value.second.row !== crossing.strategicEdge.second.row ||
        edge.value.second.column !== crossing.strategicEdge.second.column ||
        !reachById.has(crossing.reachId) || !pointInsideExtent(crossing.intersection, widthM, heightM) ||
        !pointInsideExtent(crossing.leftBank, widthM, heightM) || !pointInsideExtent(crossing.rightBank, widthM, heightM) ||
        !canonicalNumber(crossing.channelIncisionMeters) || !canonicalNumber(crossing.firstApproachSlope) ||
        !canonicalNumber(crossing.secondApproachSlope)) {
      return invalid("crossingCandidates", "crossing candidate is not finalized canonical physical authority");
    }
  }

  return {
    ok: true,
    value: {
      provinces: provinces.value,
      coastline,
      terminals: terminals.value,
      catchments: catchments.value,
      nodes: nodes.value,
      reaches: reaches.value,
      depressionBasins: depressionBasins.value,
      valleys: valleys.value,
      floodplains: floodplains.value,
      crossings: crossings.value,
    },
  };
}

function localTerrainSlope(row: number, column: number, scratch: TerrainScratchGrid): number {
  const cell = row * scratch.width + column;
  const elevation = scratch.elevationMeters[cell];
  let maximum = 0;
  const neighbors = [[-1, 0], [0, 1], [1, 0], [0, -1]] as const;
  for (const [dr, dc] of neighbors) {
    const neighborRow = row + dr;
    const neighborColumn = column + dc;
    if (neighborRow < 0 || neighborRow >= scratch.height || neighborColumn < 0 || neighborColumn >= scratch.width) continue;
    const neighbor = neighborRow * scratch.width + neighborColumn;
    maximum = Math.max(maximum, Math.abs(elevation - scratch.elevationMeters[neighbor]) / scratch.cellSizeMeters);
  }
  return maximum;
}

function provinceMetrics(provinces: readonly LandformProvenanceProvince[]): readonly ProvinceMetric[] {
  return provinces.map((province) => ({
    province,
    cosine: Math.cos(province.axisAngleRadians),
    sine: Math.sin(province.axisAngleRadians),
  }));
}

/**
 * Province geometry is the only persisted provenance-space authority available
 * at Task 11. Give each exact 250 m physical cell to the nearest normalized
 * rotated province geometry, with canonical province ID as the exact tie order.
 * Strategic fractions are then integrated physical cell areas, not a dominant
 * strategic enum and not a new persistent provenance raster.
 */
function nearestProvinceOrdinal(xM: number, yM: number, metrics: readonly ProvinceMetric[]): number {
  let best = 0;
  let bestRho2 = Number.POSITIVE_INFINITY;
  for (let index = 0; index < metrics.length; index += 1) {
    const metric = metrics[index];
    const dx = xM - metric.province.center.xM;
    const dy = yM - metric.province.center.yM;
    const u = metric.cosine * dx + metric.sine * dy;
    const v = -metric.sine * dx + metric.cosine * dy;
    const rho2 = (u / metric.province.radiusXM) ** 2 + (v / metric.province.radiusYM) ** 2;
    if (rho2 < bestRho2) {
      bestRho2 = rho2;
      best = index;
    }
  }
  return best;
}

function createBaseSummaries(
  scratch: TerrainScratchGrid,
  spatial: WorldM0SpatialGridIdentity,
  geometry: StrategicGeometry,
  provinces: readonly LandformProvenanceProvince[],
): MutableStrategicSummary[] {
  const summaries: MutableStrategicSummary[] = [];
  const metrics = provinceMetrics(provinces);
  const groupCellCount = geometry.analysisColumnsPerCell * geometry.analysisRowsPerCell;
  const provinceCellCounts = new Int32Array(provinces.length);
  for (let strategicRow = 0; strategicRow < spatial.rowCount; strategicRow += 1) {
    const analysisRowStart = strategicRow * geometry.analysisRowsPerCell;
    for (let strategicColumn = 0; strategicColumn < spatial.columnCount; strategicColumn += 1) {
      const analysisColumnStart = strategicColumn * geometry.analysisColumnsPerCell;
      let landCells = 0;
      let elevationMinimum = Number.POSITIVE_INFINITY;
      let elevationMaximum = Number.NEGATIVE_INFINITY;
      let elevationSum = 0;
      let slopeSum = 0;
      provinceCellCounts.fill(0);
      for (let rowOffset = 0; rowOffset < geometry.analysisRowsPerCell; rowOffset += 1) {
        const analysisRow = analysisRowStart + rowOffset;
        const yM = scratch.height * scratch.cellSizeMeters - (analysisRow + 0.5) * scratch.cellSizeMeters;
        for (let columnOffset = 0; columnOffset < geometry.analysisColumnsPerCell; columnOffset += 1) {
          const analysisColumn = analysisColumnStart + columnOffset;
          const cell = analysisRow * scratch.width + analysisColumn;
          const elevation = scratch.elevationMeters[cell];
          if (scratch.landMask[cell] === 1) landCells += 1;
          elevationMinimum = Math.min(elevationMinimum, elevation);
          elevationMaximum = Math.max(elevationMaximum, elevation);
          elevationSum += elevation;
          slopeSum += localTerrainSlope(analysisRow, analysisColumn, scratch);
          const xM = (analysisColumn + 0.5) * scratch.cellSizeMeters;
          provinceCellCounts[nearestProvinceOrdinal(xM, yM, metrics)] += 1;
        }
      }
      const landAreaM2 = landCells * scratch.cellAreaM2;
      const oceanAreaM2 = geometry.cellAreaM2 - landAreaM2;
      const provenanceFractions: { provinceId: string; areaFraction: number }[] = [];
      for (let index = 0; index < provinces.length; index += 1) {
        if (provinceCellCounts[index] === 0) continue;
        provenanceFractions.push({
          provinceId: provinces[index].id,
          areaFraction: provinceCellCounts[index] / groupCellCount,
        });
      }
      summaries.push({
        cell: { row: strategicRow, column: strategicColumn },
        landOceanClass: landAreaM2 === 0 ? "ocean" : oceanAreaM2 === 0 ? "land" : "mixed",
        landAreaM2,
        oceanAreaM2,
        elevationMinMeters: elevationMinimum,
        elevationMaxMeters: elevationMaximum,
        elevationMeanMeters: elevationSum / groupCellCount,
        localReliefMeters: elevationMaximum - elevationMinimum,
        slopeMean: slopeSum / groupCellCount,
        coastlineLengthMeters: 0,
        provenanceFractions,
        catchmentIds: [],
        reachIds: [],
        depressionBasinIds: [],
        valleyCandidateIds: [],
        floodplainCandidateIds: [],
        crossingCandidateIds: [],
      });
    }
  }
  return summaries;
}

function pointToStrategicCell(
  point: WorldM0PointM,
  spatial: WorldM0SpatialGridIdentity,
  geometry: StrategicGeometry,
): number {
  const column = Math.min(spatial.columnCount - 1, Math.max(0, Math.floor(point.xM / geometry.cellWidthM)));
  const rowFromSouth = Math.min(spatial.rowCount - 1, Math.max(0, Math.floor(point.yM / geometry.cellHeightM)));
  const row = spatial.rowCount - 1 - rowFromSouth;
  return row * spatial.columnCount + column;
}

function boundaryEvents(
  first: WorldM0PointM,
  second: WorldM0PointM,
  spatial: WorldM0SpatialGridIdentity,
  geometry: StrategicGeometry,
): BoundaryEvent[] {
  const events: BoundaryEvent[] = [];
  const dx = second.xM - first.xM;
  const dy = second.yM - first.yM;
  if (dx !== 0) {
    const minimum = Math.min(first.xM, second.xM);
    const maximum = Math.max(first.xM, second.xM);
    const start = Math.max(1, Math.floor(minimum / geometry.cellWidthM) + 1);
    const end = Math.min(spatial.columnCount - 1, Math.ceil(maximum / geometry.cellWidthM) - 1);
    for (let boundary = start; boundary <= end; boundary += 1) {
      const xM = boundary * geometry.cellWidthM;
      const t = (xM - first.xM) / dx;
      if (t > 0 && t < 1) events.push({ t, kind: "vertical", coordinate: xM });
    }
  }
  if (dy !== 0) {
    const minimum = Math.min(first.yM, second.yM);
    const maximum = Math.max(first.yM, second.yM);
    const start = Math.max(1, Math.floor(minimum / geometry.cellHeightM) + 1);
    const end = Math.min(spatial.rowCount - 1, Math.ceil(maximum / geometry.cellHeightM) - 1);
    for (let boundary = start; boundary <= end; boundary += 1) {
      const yM = boundary * geometry.cellHeightM;
      const t = (yM - first.yM) / dy;
      if (t > 0 && t < 1) events.push({ t, kind: "horizontal", coordinate: yM });
    }
  }
  // Collapse a mathematically exact grid-corner event by cross multiplication,
  // not by epsilon snapping. A legitimate near-corner crossing therefore keeps
  // its two distinct physical intervals.
  if (dx !== 0 && dy !== 0) {
    const vertical = events.filter((event) => event.kind === "vertical");
    const horizontal = events.filter((event) => event.kind === "horizontal");
    for (const v of vertical) {
      for (const h of horizontal) {
        if ((v.coordinate - first.xM) * dy === (h.coordinate - first.yM) * dx) h.t = v.t;
      }
    }
  }
  events.sort((left, right) => left.t - right.t || (left.kind === "vertical" ? -1 : 1));
  return events;
}

function forEachLinePiece(
  points: readonly WorldM0PointM[],
  spatial: WorldM0SpatialGridIdentity,
  geometry: StrategicGeometry,
  visit: (cell: number, lengthMeters: number) => void,
): void {
  for (let segment = 0; segment + 1 < points.length; segment += 1) {
    const first = points[segment];
    const second = points[segment + 1];
    const dx = second.xM - first.xM;
    const dy = second.yM - first.yM;
    const segmentLength = Math.hypot(dx, dy);
    const events = boundaryEvents(first, second, spatial, geometry);
    const breakpoints = [0];
    for (const event of events) {
      if (event.t !== breakpoints[breakpoints.length - 1]) breakpoints.push(event.t);
    }
    breakpoints.push(1);
    for (let index = 0; index + 1 < breakpoints.length; index += 1) {
      const firstT = breakpoints[index];
      const secondT = breakpoints[index + 1];
      if (!(secondT > firstT)) continue;
      const middleT = (firstT + secondT) / 2;
      const middle = { xM: first.xM + middleT * dx, yM: first.yM + middleT * dy };
      visit(pointToStrategicCell(middle, spatial, geometry), segmentLength * (secondT - firstT));
    }
  }
}

function collectLineCells(
  points: readonly WorldM0PointM[],
  spatial: WorldM0SpatialGridIdentity,
  geometry: StrategicGeometry,
): Set<number> {
  const result = new Set<number>();
  forEachLinePiece(points, spatial, geometry, (cell, lengthMeters) => {
    if (lengthMeters > 0) result.add(cell);
  });
  return result;
}

function clipPolygonSide(
  input: readonly WorldM0PointM[],
  inside: (point: WorldM0PointM) => boolean,
  intersect: (first: WorldM0PointM, second: WorldM0PointM) => WorldM0PointM,
): WorldM0PointM[] {
  if (input.length === 0) return [];
  const output: WorldM0PointM[] = [];
  let previous = input[input.length - 1];
  let previousInside = inside(previous);
  for (const current of input) {
    const currentInside = inside(current);
    if (currentInside !== previousInside) output.push(intersect(previous, current));
    if (currentInside) output.push(current);
    previous = current;
    previousInside = currentInside;
  }
  return output;
}

function clipRingToRect(ring: readonly WorldM0PointM[], rect: RectM): WorldM0PointM[] {
  let points = ring.slice(0, -1);
  points = clipPolygonSide(
    points,
    (point) => point.xM >= rect.minX,
    (first, second) => {
      const t = (rect.minX - first.xM) / (second.xM - first.xM);
      return { xM: rect.minX, yM: first.yM + t * (second.yM - first.yM) };
    },
  );
  points = clipPolygonSide(
    points,
    (point) => point.xM <= rect.maxX,
    (first, second) => {
      const t = (rect.maxX - first.xM) / (second.xM - first.xM);
      return { xM: rect.maxX, yM: first.yM + t * (second.yM - first.yM) };
    },
  );
  points = clipPolygonSide(
    points,
    (point) => point.yM >= rect.minY,
    (first, second) => {
      const t = (rect.minY - first.yM) / (second.yM - first.yM);
      return { xM: first.xM + t * (second.xM - first.xM), yM: rect.minY };
    },
  );
  points = clipPolygonSide(
    points,
    (point) => point.yM <= rect.maxY,
    (first, second) => {
      const t = (rect.maxY - first.yM) / (second.yM - first.yM);
      return { xM: first.xM + t * (second.xM - first.xM), yM: rect.maxY };
    },
  );
  return points;
}

function signedOpenArea(points: readonly WorldM0PointM[]): number {
  if (points.length < 3) return 0;
  let area2 = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = (index + 1) % points.length;
    area2 += points[index].xM * points[next].yM - points[next].xM * points[index].yM;
  }
  return area2 / 2;
}

function polygonBounds(rings: readonly (readonly WorldM0PointM[])[]): RectM {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const ring of rings) for (const point of ring) {
    minX = Math.min(minX, point.xM);
    minY = Math.min(minY, point.yM);
    maxX = Math.max(maxX, point.xM);
    maxY = Math.max(maxY, point.yM);
  }
  return { minX, minY, maxX, maxY };
}

function forEachPolygonCell(
  rings: readonly (readonly WorldM0PointM[])[],
  spatial: WorldM0SpatialGridIdentity,
  geometry: StrategicGeometry,
  areaToleranceM2: number,
  visit: (cell: number) => void,
): void {
  const bounds = polygonBounds(rings);
  const minimumColumn = Math.max(0, Math.floor(bounds.minX / geometry.cellWidthM));
  const maximumColumn = Math.min(spatial.columnCount - 1, Math.floor(bounds.maxX / geometry.cellWidthM));
  const minimumSouthRow = Math.max(0, Math.floor(bounds.minY / geometry.cellHeightM));
  const maximumSouthRow = Math.min(spatial.rowCount - 1, Math.floor(bounds.maxY / geometry.cellHeightM));
  for (let southRow = minimumSouthRow; southRow <= maximumSouthRow; southRow += 1) {
    const row = spatial.rowCount - 1 - southRow;
    const minY = southRow * geometry.cellHeightM;
    const maxY = minY + geometry.cellHeightM;
    for (let column = minimumColumn; column <= maximumColumn; column += 1) {
      const minX = column * geometry.cellWidthM;
      const maxX = minX + geometry.cellWidthM;
      const rect = { minX, minY, maxX, maxY };
      let areaM2 = 0;
      for (const ring of rings) areaM2 += signedOpenArea(clipRingToRect(ring, rect));
      if (areaM2 > areaToleranceM2) visit(row * spatial.columnCount + column);
    }
  }
}

function touchingAxisOrdinals(coordinate: number, cellSizeM: number, count: number, extentM: number): number[] {
  if (coordinate === 0) return [0];
  if (coordinate === extentM) return [count - 1];
  const ordinal = coordinate / cellSizeM;
  if (Number.isInteger(ordinal)) return [ordinal - 1, ordinal];
  return [Math.floor(ordinal)];
}

function crossingTouchedCells(
  point: WorldM0PointM,
  spatial: WorldM0SpatialGridIdentity,
  geometry: StrategicGeometry,
): readonly number[] {
  const columns = touchingAxisOrdinals(point.xM, geometry.cellWidthM, spatial.columnCount, spatial.extentWidthMeters);
  const southRows = touchingAxisOrdinals(point.yM, geometry.cellHeightM, spatial.rowCount, spatial.extentHeightMeters);
  const result: number[] = [];
  for (const southRow of southRows) {
    const row = spatial.rowCount - 1 - southRow;
    for (const column of columns) result.push(row * spatial.columnCount + column);
  }
  result.sort((left, right) => left - right);
  return result;
}

function finalizeSummaries(summaries: MutableStrategicSummary[]): readonly StrategicTerrainSummary[] {
  const keys: readonly (keyof Pick<MutableStrategicSummary,
    "catchmentIds" | "reachIds" | "depressionBasinIds" | "valleyCandidateIds" |
    "floodplainCandidateIds" | "crossingCandidateIds">)[] = [
    "catchmentIds", "reachIds", "depressionBasinIds", "valleyCandidateIds",
    "floodplainCandidateIds", "crossingCandidateIds",
  ];
  for (const summary of summaries) {
    summary.provenanceFractions.sort((left, right) => compareAscii(left.provinceId, right.provinceId));
    for (const key of keys) summary[key].sort(compareAscii);
  }
  return summaries.map((summary) => ({
    cell: summary.cell,
    landOceanClass: summary.landOceanClass,
    landAreaM2: summary.landAreaM2,
    oceanAreaM2: summary.oceanAreaM2,
    elevationMinMeters: summary.elevationMinMeters,
    elevationMaxMeters: summary.elevationMaxMeters,
    elevationMeanMeters: summary.elevationMeanMeters,
    localReliefMeters: summary.localReliefMeters,
    slopeMean: summary.slopeMean,
    coastlineLengthMeters: summary.coastlineLengthMeters,
    provenanceFractions: summary.provenanceFractions,
    catchmentIds: summary.catchmentIds,
    reachIds: summary.reachIds,
    depressionBasinIds: summary.depressionBasinIds,
    valleyCandidateIds: summary.valleyCandidateIds,
    floodplainCandidateIds: summary.floodplainCandidateIds,
    crossingCandidateIds: summary.crossingCandidateIds,
  }));
}

export function aggregateStrategicTerrain(
  scratch: TerrainScratchGrid,
  spatial: WorldM0SpatialGridIdentity,
  provinces: readonly LandformProvenanceProvince[],
  coastline: readonly (readonly WorldM0PointM[])[],
  drainage: TerrainDrainageGraphResult,
  depressionBasins: readonly TerrainDepressionBasin[],
  valleyGeometry: TerrainValleyGeometryResult,
  crossingCandidates: readonly PhysicalCrossingCandidate[],
  constants: WorldM0PhysicalConstantsV1,
): WorldM0Result<readonly StrategicTerrainSummary[]> {
  const strategicGeometry = validateSpatialAndScratch(scratch, spatial, constants);
  if (!strategicGeometry.ok) return strategicGeometry;
  const geometry = strategicGeometry.value;
  const physical = validatePhysicalRegistries(
    provinces, coastline, drainage, depressionBasins, valleyGeometry, crossingCandidates,
    constants, spatial.extentWidthMeters, spatial.extentHeightMeters,
  );
  if (!physical.ok) return physical;

  const summaries = createBaseSummaries(scratch, spatial, geometry, physical.value.provinces);

  for (const line of physical.value.coastline) {
    forEachLinePiece(line, spatial, geometry, (cell, lengthMeters) => {
      summaries[cell].coastlineLengthMeters += lengthMeters;
    });
  }

  for (const catchment of physical.value.catchments) {
    forEachPolygonCell(
      catchment.boundaryRings, spatial, geometry, constants.validation.areaToleranceM2,
      (cell) => summaries[cell].catchmentIds.push(catchment.id),
    );
  }
  for (const reach of physical.value.reaches) {
    for (const cell of collectLineCells(reach.geometry, spatial, geometry)) summaries[cell].reachIds.push(reach.id);
  }
  for (const basin of physical.value.depressionBasins) {
    forEachPolygonCell(
      basin.boundaryRings, spatial, geometry, constants.validation.areaToleranceM2,
      (cell) => summaries[cell].depressionBasinIds.push(basin.id),
    );
  }
  for (const valley of physical.value.valleys) {
    forEachPolygonCell(
      valley.boundaryRings, spatial, geometry, constants.validation.areaToleranceM2,
      (cell) => summaries[cell].valleyCandidateIds.push(valley.id),
    );
  }
  for (const floodplain of physical.value.floodplains) {
    forEachPolygonCell(
      floodplain.boundaryRings, spatial, geometry, constants.validation.areaToleranceM2,
      (cell) => summaries[cell].floodplainCandidateIds.push(floodplain.id),
    );
  }
  for (const crossing of physical.value.crossings) {
    for (const cell of crossingTouchedCells(crossing.intersection, spatial, geometry)) {
      summaries[cell].crossingCandidateIds.push(crossing.id);
    }
  }

  return { ok: true, value: finalizeSummaries(summaries) };
}
