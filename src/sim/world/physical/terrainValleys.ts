import type { WorldM0Result } from "./failures";
import { worldM0Failure } from "./failures";
import type { WorldM0PhysicalConstantsV1 } from "./physicalConstants";
import {
  compareTask9RingRegistryV1,
  normalizeTask9RasterRingFeatureV1,
  simplifyTask9NormalizedRasterRingFeatureV1,
} from "./terrainBasins";
import { comparePointM, formatTerrainHydroId } from "./terrainHydroNumeric";
import type {
  TerrainDrainageReach,
  TerrainFloodplainCandidate,
  TerrainValleyCandidate,
  WorldM0PointM,
} from "./terrainHydroTypes";
import type { TerrainScratchGrid } from "./terrainScratch";

export interface TerrainValleyGeometryResult {
  readonly valleys: readonly TerrainValleyCandidate[];
  readonly floodplainCandidates: readonly TerrainFloodplainCandidate[];
}

function invalid(path: string, detail: string): WorldM0Result<never> {
  return worldM0Failure("M02_CANDIDATE_INVALID", path, detail);
}
function bound(path: string, detail: string): WorldM0Result<never> {
  return worldM0Failure("M02_BOUND_EXCEEDED", path, detail);
}
function compareNumber(left: number, right: number): number { return left < right ? -1 : left > right ? 1 : 0; }
function comparePointSequence(left: readonly WorldM0PointM[], right: readonly WorldM0PointM[]): number {
  const common = Math.min(left.length, right.length);
  for (let index = 0; index < common; index += 1) {
    const order = comparePointM(left[index], right[index]);
    if (order !== 0) return order;
  }
  return compareNumber(left.length, right.length);
}
function rowOf(cell: number, width: number): number { return Math.floor(cell / width); }
function columnOf(cell: number, width: number): number { return cell - rowOf(cell, width) * width; }
function center(cell: number, scratch: TerrainScratchGrid): WorldM0PointM {
  return {
    xM: (columnOf(cell, scratch.width) + 0.5) * scratch.cellSizeMeters,
    yM: (scratch.height - rowOf(cell, scratch.width) - 0.5) * scratch.cellSizeMeters,
  };
}
function pointSegmentProjection(point: WorldM0PointM, first: WorldM0PointM, second: WorldM0PointM): { distanceSquared: number; t: number } {
  const dx = second.xM - first.xM;
  const dy = second.yM - first.yM;
  const len2 = dx * dx + dy * dy;
  if (!(len2 > 0)) return { distanceSquared: Number.POSITIVE_INFINITY, t: 0 };
  const raw = ((point.xM - first.xM) * dx + (point.yM - first.yM) * dy) / len2;
  const t = Math.min(1, Math.max(0, raw));
  const xM = first.xM + t * dx;
  const yM = first.yM + t * dy;
  const ex = point.xM - xM;
  const ey = point.yM - yM;
  return { distanceSquared: ex * ex + ey * ey, t };
}
function pointCell(point: WorldM0PointM, scratch: TerrainScratchGrid): number | undefined {
  const extentWidth = scratch.width * scratch.cellSizeMeters;
  const extentHeight = scratch.height * scratch.cellSizeMeters;
  if (point.xM < 0 || point.xM > extentWidth || point.yM < 0 || point.yM > extentHeight) return undefined;
  const column = Math.min(scratch.width - 1, Math.floor(point.xM / scratch.cellSizeMeters));
  const rowFromSouth = Math.min(scratch.height - 1, Math.floor(point.yM / scratch.cellSizeMeters));
  const row = scratch.height - 1 - rowFromSouth;
  if (row < 0 || row >= scratch.height || column < 0 || column >= scratch.width) return undefined;
  return row * scratch.width + column;
}
function sampleElevation(point: WorldM0PointM, scratch: TerrainScratchGrid): number | undefined {
  const cell = pointCell(point, scratch);
  return cell === undefined || scratch.landMask[cell] !== 1 ? undefined : scratch.elevationMeters[cell];
}
function localCardinalSlope(cell: number, scratch: TerrainScratchGrid): number {
  const row = rowOf(cell, scratch.width);
  const column = columnOf(cell, scratch.width);
  const elevation = scratch.elevationMeters[cell];
  let maximum = 0;
  const neighbors = [[-1,0],[0,1],[1,0],[0,-1]] as const;
  for (const [dr, dc] of neighbors) {
    const nr = row + dr;
    const nc = column + dc;
    if (nr < 0 || nr >= scratch.height || nc < 0 || nc >= scratch.width) continue;
    const neighbor = nr * scratch.width + nc;
    if (scratch.landMask[neighbor] !== 1) continue;
    maximum = Math.max(maximum, Math.abs(elevation - scratch.elevationMeters[neighbor]) / scratch.cellSizeMeters);
  }
  return maximum;
}

interface GridVertex { readonly x: number; readonly y: number }
interface GridEdge { readonly cell: number; readonly side: number; readonly start: GridVertex; readonly end: GridVertex }
const NORTH=0, EAST=1, SOUTH=2, WEST=3;
function edge(cell: number, side: number, scratch: TerrainScratchGrid): GridEdge {
  const row = rowOf(cell, scratch.width);
  const column = columnOf(cell, scratch.width);
  const top = scratch.height - row;
  const bottom = top - 1;
  const start = side === NORTH ? {x:column+1,y:top} : side === EAST ? {x:column+1,y:bottom} :
    side === SOUTH ? {x:column,y:bottom} : {x:column,y:top};
  const end = side === NORTH ? {x:column,y:top} : side === EAST ? {x:column+1,y:top} :
    side === SOUTH ? {x:column+1,y:bottom} : {x:column,y:bottom};
  return { cell, side, start, end };
}
function toPoint(vertex: GridVertex, scratch: TerrainScratchGrid): WorldM0PointM {
  return { xM: vertex.x * scratch.cellSizeMeters, yM: vertex.y * scratch.cellSizeMeters };
}
function sameVertex(left: GridVertex, right: GridVertex): boolean { return left.x===right.x && left.y===right.y; }

interface CellWindow {
  readonly minRow: number;
  readonly maxRow: number;
  readonly minColumn: number;
  readonly maxColumn: number;
  readonly width: number;
  readonly height: number;
  readonly cellCount: number;
}
function makeWindow(minRow:number,maxRow:number,minColumn:number,maxColumn:number): CellWindow | undefined {
  if (minRow>maxRow || minColumn>maxColumn) return undefined;
  const width=maxColumn-minColumn+1;
  const height=maxRow-minRow+1;
  const cellCount=width*height;
  if (!Number.isSafeInteger(cellCount) || cellCount<=0) return undefined;
  return {minRow,maxRow,minColumn,maxColumn,width,height,cellCount};
}
function localIndex(row:number,column:number,window:CellWindow): number {
  return (row-window.minRow)*window.width + (column-window.minColumn);
}
function selectedAt(row:number,column:number,window:CellWindow,cellClass:Uint8Array,bit:number): boolean {
  if(row<window.minRow||row>window.maxRow||column<window.minColumn||column>window.maxColumn) return false;
  return (cellClass[localIndex(row,column,window)] & bit) !== 0;
}
function boundarySide(row:number,column:number,side:number,window:CellWindow,cellClass:Uint8Array,bit:number,scratch:TerrainScratchGrid): boolean {
  if(!selectedAt(row,column,window,cellClass,bit)) return false;
  const dr=side===NORTH?-1:side===SOUTH?1:0;
  const dc=side===EAST?1:side===WEST?-1:0;
  const nr=row+dr,nc=column+dc;
  if(nr<0||nr>=scratch.height||nc<0||nc>=scratch.width) return true;
  return !selectedAt(nr,nc,window,cellClass,bit);
}
function edgeVisited(row:number,column:number,side:number,window:CellWindow,visited:Uint8Array): boolean {
  return (visited[localIndex(row,column,window)] & (1<<side)) !== 0;
}
function markEdgeVisited(row:number,column:number,side:number,window:CellWindow,visited:Uint8Array): void {
  const index=localIndex(row,column,window);
  visited[index] |= 1<<side;
}
function edgeAt(row:number,column:number,side:number,scratch:TerrainScratchGrid): GridEdge {
  return edge(row*scratch.width+column,side,scratch);
}
function outgoingBoundaryCandidates(
  vertex:GridVertex,
  window:CellWindow,
  cellClass:Uint8Array,
  visited:Uint8Array,
  componentLabel:Int32Array,
  componentOrdinal:number,
  bit:number,
  scratch:TerrainScratchGrid,
): GridEdge[] {
  const candidates:GridEdge[]=[];
  const northRow=scratch.height-vertex.y;
  for(const row of [northRow,northRow-1]) for(const column of [vertex.x-1,vertex.x]) {
    if(row<window.minRow||row>window.maxRow||column<window.minColumn||column>window.maxColumn) continue;
    const local=localIndex(row,column,window);
    if(componentLabel[local]!==componentOrdinal) continue;
    for(let side=0;side<4;side+=1) {
      if(!boundarySide(row,column,side,window,cellClass,bit,scratch) || edgeVisited(row,column,side,window,visited)) continue;
      const candidate=edgeAt(row,column,side,scratch);
      if(sameVertex(candidate.start,vertex)) candidates.push(candidate);
    }
  }
  return candidates;
}
function chooseContinuation(current:GridEdge,candidates:GridEdge[]): GridEdge | undefined {
  if(candidates.length===0) return undefined;
  const pdx=current.end.x-current.start.x,pdy=current.end.y-current.start.y;
  candidates.sort((a,b)=>{
    const adx=a.end.x-a.start.x,ady=a.end.y-a.start.y;
    const bdx=b.end.x-b.start.x,bdy=b.end.y-b.start.y;
    const across=pdx*ady-pdy*adx,adot=pdx*adx+pdy*ady;
    const bcross=pdx*bdy-pdy*bdx,bdot=pdx*bdx+pdy*bdy;
    const at=across<0?3:adot>0?2:across>0?1:0;
    const bt=bcross<0?3:bdot>0?2:bcross>0?1:0;
    return bt-at || a.cell-b.cell || a.side-b.side;
  });
  return candidates[0];
}

function labelWindowComponents(
  window:CellWindow,
  cellClass:Uint8Array,
  componentLabel:Int32Array,
  componentQueue:Int32Array,
  bit:number,
): number {
  componentLabel.fill(-1);
  let nextComponent=0;
  for(let row=window.minRow;row<=window.maxRow;row++) for(let column=window.minColumn;column<=window.maxColumn;column++) {
    const seed=localIndex(row,column,window);
    if((cellClass[seed]&bit)===0||componentLabel[seed]>=0) continue;
    let head=0,tail=0;
    componentQueue[tail++]=seed;
    componentLabel[seed]=nextComponent;
    while(head<tail) {
      const local=componentQueue[head++];
      const localRow=Math.floor(local/window.width);
      const localColumn=local-localRow*window.width;
      for(const [dr,dc] of [[-1,0],[0,1],[1,0],[0,-1]] as const) {
        const nr=localRow+dr,nc=localColumn+dc;
        if(nr<0||nr>=window.height||nc<0||nc>=window.width) continue;
        const next=nr*window.width+nc;
        if((cellClass[next]&bit)===0||componentLabel[next]>=0) continue;
        componentLabel[next]=nextComponent;
        componentQueue[tail++]=next;
      }
    }
    nextComponent+=1;
  }
  return nextComponent;
}

function traceWindowMaskRings(
  window:CellWindow,
  cellClass:Uint8Array,
  visited:Uint8Array,
  componentLabel:Int32Array,
  componentQueue:Int32Array,
  bit:number,
  scratch:TerrainScratchGrid,
  path:string,
  maxVertices:number,
): WorldM0Result<readonly (readonly WorldM0PointM[])[]> {
  visited.fill(0);
  const componentCount=labelWindowComponents(window,cellClass,componentLabel,componentQueue,bit);
  if(componentCount===0) return invalid(path,"cell union is empty");
  const rawRings:WorldM0PointM[][]=[];
  let totalVertices=0;
  while(true) {
    let start:GridEdge|undefined;
    for(let row=window.minRow;row<=window.maxRow && !start;row++) for(let column=window.minColumn;column<=window.maxColumn && !start;column++) {
      if(!selectedAt(row,column,window,cellClass,bit)) continue;
      for(let side=0;side<4;side+=1) {
        if(boundarySide(row,column,side,window,cellClass,bit,scratch) && !edgeVisited(row,column,side,window,visited)) {
          start=edgeAt(row,column,side,scratch); break;
        }
      }
    }
    if(!start) break;
    const startRow=rowOf(start.cell,scratch.width),startColumn=columnOf(start.cell,scratch.width);
    const componentOrdinal=componentLabel[localIndex(startRow,startColumn,window)];
    if(componentOrdinal<0) return invalid(path,"boundary edge lacks a cardinal component label");
    const points:WorldM0PointM[]=[toPoint(start.start,scratch)];
    let current=start;
    let walked=0;
    const maximumBoundaryEdges=window.cellCount*4;
    while(true) {
      const row=rowOf(current.cell,scratch.width),column=columnOf(current.cell,scratch.width);
      if(edgeVisited(row,column,current.side,window,visited)) return invalid(path,"cell-union boundary edge was reused");
      markEdgeVisited(row,column,current.side,window,visited);
      if(totalVertices+points.length+1>maxVertices) return bound("geometry.maxPolygonVerticesPerFeature","polygon feature exceeds final vertex bound before JS geometry materialization");
      points.push(toPoint(current.end,scratch));
      walked+=1;
      if(walked>maximumBoundaryEdges) return bound(path,"cell-union trace exceeded bounded window edge count");
      if(sameVertex(current.end,start.start)) break;
      const next=chooseContinuation(current,outgoingBoundaryCandidates(
        current.end,window,cellClass,visited,componentLabel,componentOrdinal,bit,scratch));
      if(!next) return invalid(path,"cell-union boundary failed to close");
      current=next;
    }
    const open=points.slice(0,-1);
    let first=0;
    for(let i=1;i<open.length;i++) if(comparePointM(open[i],open[first])<0) first=i;
    const normalized=open.slice(first).concat(open.slice(0,first));
    normalized.push(normalized[0]);
    totalVertices+=normalized.length;
    if(totalVertices>maxVertices) return bound("geometry.maxPolygonVerticesPerFeature","polygon feature exceeds final vertex bound");
    rawRings.push(normalized);
  }
  if(rawRings.length===0) return invalid(path,"cell union is empty");
  return normalizeTask9RasterRingFeatureV1(rawRings,scratch,path);
}

function releaseLabels(scratch:TerrainScratchGrid,labels:readonly string[]): WorldM0Result<true> {
  for(let index=labels.length-1;index>=0;index-=1) {
    const released=scratch.budget.release(labels[index]);
    if(!released.ok) return released;
  }
  return {ok:true,value:true};
}

/** Trace the normalized UNSIMPLIFIED §§8-9 cell-union ring registry. */
export function traceTask9CellUnionRingsV1(
  selectedCells: readonly number[],
  scratch: TerrainScratchGrid,
  path: string,
): WorldM0Result<readonly (readonly WorldM0PointM[])[]> {
  if(!Array.isArray(selectedCells)||selectedCells.length===0) return invalid(path,"cell union is empty");
  let minRow=scratch.height,maxRow=-1,minColumn=scratch.width,maxColumn=-1;
  for(const cell of selectedCells) {
    if(!Number.isSafeInteger(cell)||cell<0||cell>=scratch.width*scratch.height) return invalid(path,"cell union contains an invalid analysis cell");
    const row=rowOf(cell,scratch.width),column=columnOf(cell,scratch.width);
    minRow=Math.min(minRow,row);maxRow=Math.max(maxRow,row);minColumn=Math.min(minColumn,column);maxColumn=Math.max(maxColumn,column);
  }
  const window=makeWindow(minRow,maxRow,minColumn,maxColumn);
  if(!window) return invalid(path,"cell union has no valid bounded window");
  const labels=["task9TraceCellClass","task9TraceEdgeVisit","task9TraceComponentLabel","task9TraceComponentQueue"] as const;
  const allocated=scratch.budget.allocateBatch([
    {label:labels[0],kind:"u8",length:window.cellCount},
    {label:labels[1],kind:"u8",length:window.cellCount},
    {label:labels[2],kind:"i32",length:window.cellCount},
    {label:labels[3],kind:"i32",length:window.cellCount},
  ]);
  if(!allocated.ok) return allocated;
  const [classBuffer,visitBuffer,componentBuffer,queueBuffer]=allocated.value;
  let outcome:WorldM0Result<readonly (readonly WorldM0PointM[])[]>;
  if(!(classBuffer instanceof Uint8Array)||!(visitBuffer instanceof Uint8Array)||
     !(componentBuffer instanceof Int32Array)||!(queueBuffer instanceof Int32Array)) {
    outcome=invalid(path,"scratch allocator returned unexpected Task-9 trace arrays");
  } else {
    let duplicate=false;
    for(const cell of selectedCells) {
      const row=rowOf(cell,scratch.width),column=columnOf(cell,scratch.width),index=localIndex(row,column,window);
      if(classBuffer[index]!==0){duplicate=true;break;}
      classBuffer[index]=1;
    }
    outcome=duplicate?invalid(path,"cell union contains a duplicate analysis cell"):
      traceWindowMaskRings(window,classBuffer,visitBuffer,componentBuffer,queueBuffer,1,scratch,path,Math.max(4,selectedCells.length*5));
  }
  if(outcome===undefined) outcome=invalid("terrainValleys","Task-9 reach derivation produced no outcome");
  const released=releaseLabels(scratch,labels);
  return released.ok?outcome:released;
}

function reachBoundingWindow(reach: TerrainDrainageReach, scratch: TerrainScratchGrid, radius: number): CellWindow|undefined {
  if (reach.geometry.length < 2) return undefined;
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const p of reach.geometry){
    if(!Number.isFinite(p.xM)||!Number.isFinite(p.yM)||Object.is(p.xM,-0)||Object.is(p.yM,-0)) return undefined;
    minX=Math.min(minX,p.xM);maxX=Math.max(maxX,p.xM);minY=Math.min(minY,p.yM);maxY=Math.max(maxY,p.yM);
  }
  const minColumn=Math.max(0,Math.floor((minX-radius)/scratch.cellSizeMeters));
  const maxColumn=Math.min(scratch.width-1,Math.floor((maxX+radius)/scratch.cellSizeMeters));
  const minRow=Math.max(0,scratch.height-1-Math.floor((maxY+radius)/scratch.cellSizeMeters));
  const maxRow=Math.min(scratch.height-1,scratch.height-1-Math.floor((minY-radius)/scratch.cellSizeMeters));
  return makeWindow(minRow,maxRow,minColumn,maxColumn);
}
function segmentBoundingWindow(first:WorldM0PointM,second:WorldM0PointM,scratch:TerrainScratchGrid,radius:number,outer:CellWindow):CellWindow|undefined {
  const minColumn=Math.max(outer.minColumn,Math.floor((Math.min(first.xM,second.xM)-radius)/scratch.cellSizeMeters));
  const maxColumn=Math.min(outer.maxColumn,Math.floor((Math.max(first.xM,second.xM)+radius)/scratch.cellSizeMeters));
  const minRow=Math.max(outer.minRow,scratch.height-1-Math.floor((Math.max(first.yM,second.yM)+radius)/scratch.cellSizeMeters));
  const maxRow=Math.min(outer.maxRow,scratch.height-1-Math.floor((Math.min(first.yM,second.yM)-radius)/scratch.cellSizeMeters));
  return makeWindow(minRow,maxRow,minColumn,maxColumn);
}
function representedReachCellBound(reach:TerrainDrainageReach,scratch:TerrainScratchGrid):number|undefined {
  let count=1;
  for(let segment=0;segment+1<reach.geometry.length;segment+=1) {
    const first=reach.geometry[segment],second=reach.geometry[segment+1];
    const length=Math.hypot(second.xM-first.xM,second.yM-first.yM);
    if(!Number.isFinite(length)||!(length>0)) return undefined;
    count+=Math.ceil(length/scratch.cellSizeMeters);
    if(!Number.isSafeInteger(count)) return undefined;
  }
  return count;
}

interface GeometryCandidate {
  readonly reach: TerrainDrainageReach;
  readonly unsimplifiedRings: readonly (readonly WorldM0PointM[])[];
  readonly areaM2: number;
  readonly localReliefMeters: number;
  readonly terrainSlope: number;
  readonly boundaryRings?: readonly (readonly WorldM0PointM[])[];
}

export function compareTask9ReachPhysicalKeyV1(left: TerrainDrainageReach, right: TerrainDrainageReach): number {
  const leftFirst=left.geometry[0], rightFirst=right.geometry[0];
  const leftLast=left.geometry[left.geometry.length-1], rightLast=right.geometry[right.geometry.length-1];
  if(!leftFirst||!rightFirst||!leftLast||!rightLast) return compareNumber(left.geometry.length,right.geometry.length);
  const upstream=comparePointM(leftFirst,rightFirst);
  if(upstream!==0) return upstream;
  const downstream=comparePointM(leftLast,rightLast);
  if(downstream!==0) return downstream;
  return comparePointSequence(left.geometry,right.geometry);
}
function compareGeometryPreKey(left: GeometryCandidate, right: GeometryCandidate): number {
  const reach=compareTask9ReachPhysicalKeyV1(left.reach,right.reach);
  return reach!==0?reach:compareTask9RingRegistryV1(left.unsimplifiedRings,right.unsimplifiedRings);
}
function finalizeGeometryDomain(
  domain: readonly GeometryCandidate[],
  scratch: TerrainScratchGrid,
  constants: WorldM0PhysicalConstantsV1,
  path: string,
): WorldM0Result<readonly GeometryCandidate[]> {
  const ordered=[...domain].sort(compareGeometryPreKey);
  for(let i=1;i<ordered.length;i++) if(compareGeometryPreKey(ordered[i-1],ordered[i])===0) return invalid(path,"duplicate complete M03 pre-key");
  const final: GeometryCandidate[]=[];
  for(let i=0;i<ordered.length;i++) {
    const simplified=simplifyTask9NormalizedRasterRingFeatureV1(ordered[i].unsimplifiedRings,scratch,constants,`${path}[${i}].boundaryRings`);
    if(!simplified.ok) return simplified;
    final.push({...ordered[i],boundaryRings:simplified.value});
  }
  return {ok:true,value:final};
}

interface ReachDerivedGeometry {
  readonly valley?: GeometryCandidate;
  readonly floodplain?: GeometryCandidate;
}
function deriveReachGeometry(
  reach:TerrainDrainageReach,
  scratch:TerrainScratchGrid,
  constants:WorldM0PhysicalConstantsV1,
):WorldM0Result<ReachDerivedGeometry> {
  const radius=constants.geometry.valleySearchRadiusMeters;
  const radiusSquared=radius*radius;
  const window=reachBoundingWindow(reach,scratch,radius);
  const represented=representedReachCellBound(reach,scratch);
  if(!window||represented===undefined) return invalid("reaches.geometry","reach has no finite bounded physical corridor");
  const maximumSide=2*Math.ceil(radius/scratch.cellSizeMeters)+3;
  if(window.cellCount>maximumSide*maximumSide*represented) return bound("geometry.valleySearchRadiusMeters","bounded reach corridor exceeded v1 physical-radius envelope");
  const labels=["task9NearestDistance","task9ReferenceElevation","task9CellClass","task9EdgeVisit","task9ComponentLabel","task9ComponentQueue"] as const;
  const allocated=scratch.budget.allocateBatch([
    {label:labels[0],kind:"f64",length:window.cellCount},
    {label:labels[1],kind:"f64",length:window.cellCount},
    {label:labels[2],kind:"u8",length:window.cellCount},
    {label:labels[3],kind:"u8",length:window.cellCount},
    {label:labels[4],kind:"i32",length:window.cellCount},
    {label:labels[5],kind:"i32",length:window.cellCount},
  ]);
  if(!allocated.ok) return allocated;
  const [distanceBuffer,elevationBuffer,classBuffer,visitBuffer,componentBuffer,queueBuffer]=allocated.value;
  let outcome:WorldM0Result<ReachDerivedGeometry>|undefined;
  if(!(distanceBuffer instanceof Float64Array)||!(elevationBuffer instanceof Float64Array)||!(classBuffer instanceof Uint8Array)||
     !(visitBuffer instanceof Uint8Array)||!(componentBuffer instanceof Int32Array)||!(queueBuffer instanceof Int32Array)) {
    outcome=invalid("scratch","scratch allocator returned unexpected Task-9 corridor arrays");
  } else {
    distanceBuffer.fill(Number.POSITIVE_INFINITY);
    let derivationFailure:WorldM0Result<never>|undefined;
    for(let segment=0;segment+1<reach.geometry.length && derivationFailure===undefined;segment+=1) {
      const first=reach.geometry[segment],second=reach.geometry[segment+1];
      const firstElevation=sampleElevation(first,scratch),secondElevation=sampleElevation(second,scratch);
      if(firstElevation===undefined||secondElevation===undefined) continue;
      const localWindow=segmentBoundingWindow(first,second,scratch,radius,window);
      if(!localWindow) continue;
      for(let row=localWindow.minRow;row<=localWindow.maxRow;row++) for(let column=localWindow.minColumn;column<=localWindow.maxColumn;column++) {
        const cell=row*scratch.width+column;
        if(scratch.landMask[cell]!==1) continue;
        const projection=pointSegmentProjection(center(cell,scratch),first,second);
        if(projection.distanceSquared>radiusSquared) continue;
        const index=localIndex(row,column,window);
        if(projection.distanceSquared>=distanceBuffer[index]) continue;
        distanceBuffer[index]=projection.distanceSquared;
        elevationBuffer[index]=firstElevation+projection.t*(secondElevation-firstElevation);
      }
    }
    if(derivationFailure) {
      outcome=derivationFailure;
    } else {
      let valleyCount=0,floodCount=0,minElevation=Infinity,maxElevation=-Infinity,maxFloodSlope=0;
      for(let row=window.minRow;row<=window.maxRow;row++) for(let column=window.minColumn;column<=window.maxColumn;column++) {
        const index=localIndex(row,column,window);
        if(!Number.isFinite(distanceBuffer[index])) continue;
        const cell=row*scratch.width+column;
        const elevation=scratch.elevationMeters[cell];
        if(elevation>elevationBuffer[index]+constants.geometry.valleyRelativeReliefMeters) continue;
        classBuffer[index]|=1;
        valleyCount+=1;
        minElevation=Math.min(minElevation,elevation);maxElevation=Math.max(maxElevation,elevation);
        const slope=localCardinalSlope(cell,scratch);
        if(slope<=constants.geometry.floodplainCandidateMaxSlope) {
          classBuffer[index]|=2;
          floodCount+=1;
          maxFloodSlope=Math.max(maxFloodSlope,slope);
        }
      }
      let valley:GeometryCandidate|undefined;
      let floodplain:GeometryCandidate|undefined;
      if(valleyCount>0) {
        const rings=traceWindowMaskRings(window,classBuffer,visitBuffer,componentBuffer,queueBuffer,1,scratch,"valleys.boundaryRings",constants.geometry.maxPolygonVerticesPerFeature);
        if(!rings.ok) outcome=rings;
        else valley={reach,unsimplifiedRings:rings.value,areaM2:valleyCount*scratch.cellAreaM2,localReliefMeters:maxElevation-minElevation,terrainSlope:0};
      }
      if(outcome===undefined && floodCount>0) {
        const rings=traceWindowMaskRings(window,classBuffer,visitBuffer,componentBuffer,queueBuffer,2,scratch,"floodplainCandidates.boundaryRings",constants.geometry.maxPolygonVerticesPerFeature);
        if(!rings.ok) outcome=rings;
        else floodplain={reach,unsimplifiedRings:rings.value,areaM2:floodCount*scratch.cellAreaM2,localReliefMeters:0,terrainSlope:maxFloodSlope};
      }
      if(outcome===undefined) outcome={ok:true,value:{valley,floodplain}};
    }
  }
  if(outcome===undefined) outcome=invalid("terrainValleys","Task-9 reach derivation produced no outcome");
  const released=releaseLabels(scratch,labels);
  return released.ok?outcome:released;
}

export function deriveTerrainValleyGeometry(
  scratch: TerrainScratchGrid,
  reaches: readonly TerrainDrainageReach[],
  constants: WorldM0PhysicalConstantsV1,
): WorldM0Result<TerrainValleyGeometryResult> {
  if (reaches.length > constants.drainage.maxReaches) return bound("drainage.maxReaches","valley input reach count exceeds bound");
  const reachIds=new Set<string>();
  const physicalReaches=[...reaches];
  for(const reach of physicalReaches){
    if(reachIds.has(reach.id)||!/^drainage-reach:[0-9a-f]{16}$/.test(reach.id)) return invalid("reaches.id","reach id is invalid or duplicated");
    if(reach.geometry.length<2) return invalid("reaches.geometry","reach geometry must have at least two points");
    reachIds.add(reach.id);
  }
  physicalReaches.sort(compareTask9ReachPhysicalKeyV1);
  for(let i=1;i<physicalReaches.length;i++) if(compareTask9ReachPhysicalKeyV1(physicalReaches[i-1],physicalReaches[i])===0) return invalid("reaches.geometry","distinct reaches have duplicate physical keys");

  const valleyDomain:GeometryCandidate[]=[];
  const floodDomain:GeometryCandidate[]=[];
  for(const reach of physicalReaches) {
    const derived=deriveReachGeometry(reach,scratch,constants);
    if(!derived.ok) return derived;
    if(derived.value.valley) {
      valleyDomain.push(derived.value.valley);
      if(valleyDomain.length>constants.drainage.maxReaches) return bound("drainage.maxReaches","valley candidate count exceeds explicit reach-derived bound");
    }
    if(derived.value.floodplain) {
      floodDomain.push(derived.value.floodplain);
      if(floodDomain.length>constants.drainage.maxReaches) return bound("drainage.maxReaches","floodplain candidate count exceeds explicit reach-derived bound");
    }
  }

  const finalizedValleys=finalizeGeometryDomain(valleyDomain,scratch,constants,"valleys");
  if(!finalizedValleys.ok) return finalizedValleys;
  const finalizedFloodplains=finalizeGeometryDomain(floodDomain,scratch,constants,"floodplainCandidates");
  if(!finalizedFloodplains.ok) return finalizedFloodplains;

  const valleys:TerrainValleyCandidate[]=[];
  for(let i=0;i<finalizedValleys.value.length;i++){
    const item=finalizedValleys.value[i];
    if(!item.boundaryRings) return invalid("valleys","domain-4 geometry did not cross the finalization barrier");
    const ident=formatTerrainHydroId("valley",i);if(!ident.ok)return ident;
    valleys.push({id:ident.value,reachId:item.reach.id,boundaryRings:item.boundaryRings,areaM2:item.areaM2,localReliefMeters:item.localReliefMeters});
  }
  const floodplainCandidates:TerrainFloodplainCandidate[]=[];
  for(let i=0;i<finalizedFloodplains.value.length;i++){
    const item=finalizedFloodplains.value[i];
    if(!item.boundaryRings) return invalid("floodplainCandidates","domain-5 geometry did not cross the finalization barrier");
    const ident=formatTerrainHydroId("floodplain",i);if(!ident.ok)return ident;
    floodplainCandidates.push({id:ident.value,reachId:item.reach.id,boundaryRings:item.boundaryRings,areaM2:item.areaM2,terrainSlope:item.terrainSlope});
  }
  return {ok:true,value:{valleys,floodplainCandidates}};
}
