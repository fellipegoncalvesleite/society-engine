import type { WorldM0Result } from "./failures";
import { worldM0Failure } from "./failures";
import type { WorldM0PhysicalConstantsV1 } from "./physicalConstants";
import type { TerrainDrainageGraphResult } from "./terrainDrainage";
import {
  compareTask9RingRegistryV1,
  normalizeTask9RasterRingFeatureV1,
  simplifyTask9NormalizedRasterRingFeatureV1,
} from "./terrainBasins";
import { comparePointM, formatTerrainHydroId } from "./terrainHydroNumeric";
import type {
  TerrainCatchment,
  TerrainDrainageNode,
  TerrainDrainageReach,
  TerrainHydroTerminal,
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
function samePoint(left: WorldM0PointM, right: WorldM0PointM): boolean { return left.xM===right.xM && left.yM===right.yM; }
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

function neighborCell(cell:number,side:number,scratch:TerrainScratchGrid):number|undefined {
  const row=rowOf(cell,scratch.width),column=columnOf(cell,scratch.width);
  const nr=row+(side===NORTH?-1:side===SOUTH?1:0);
  const nc=column+(side===EAST?1:side===WEST?-1:0);
  return nr<0||nr>=scratch.height||nc<0||nc>=scratch.width?undefined:nr*scratch.width+nc;
}
function findCellIndex(cellIds:Int32Array,count:number,cell:number):number {
  let low=0,high=count-1;
  while(low<=high){
    const middle=(low+high)>>1,value=cellIds[middle];
    if(value===cell)return middle;
    if(value<cell)low=middle+1;else high=middle-1;
  }
  return -1;
}
function selectedIndex(cellIds:Int32Array,count:number,cellClass:Uint8Array,bit:number,cell:number):number {
  const index=findCellIndex(cellIds,count,cell);
  return index>=0&&(cellClass[index]&bit)!==0?index:-1;
}
function sparseBoundarySide(cellIds:Int32Array,count:number,cellClass:Uint8Array,bit:number,index:number,side:number,scratch:TerrainScratchGrid):boolean {
  if((cellClass[index]&bit)===0)return false;
  const neighbor=neighborCell(cellIds[index],side,scratch);
  return neighbor===undefined||selectedIndex(cellIds,count,cellClass,bit,neighbor)<0;
}
function sparseEdgeVisited(index:number,side:number,visited:Uint8Array):boolean { return (visited[index]&(1<<side))!==0; }
function sparseMarkEdgeVisited(index:number,side:number,visited:Uint8Array):void { visited[index]|=1<<side; }
function edgeAt(row:number,column:number,side:number,scratch:TerrainScratchGrid):GridEdge { return edge(row*scratch.width+column,side,scratch); }
function outgoingSparseBoundaryCandidates(
  vertex:GridVertex,cellIds:Int32Array,count:number,cellClass:Uint8Array,visited:Uint8Array,
  componentLabel:Int32Array,componentOrdinal:number,bit:number,scratch:TerrainScratchGrid,
):GridEdge[]{
  const candidates:GridEdge[]=[];
  const northRow=scratch.height-vertex.y;
  for(const row of [northRow,northRow-1]) for(const column of [vertex.x-1,vertex.x]) {
    if(row<0||row>=scratch.height||column<0||column>=scratch.width)continue;
    const cell=row*scratch.width+column,index=selectedIndex(cellIds,count,cellClass,bit,cell);
    if(index<0||componentLabel[index]!==componentOrdinal)continue;
    for(let side=0;side<4;side+=1){
      if(!sparseBoundarySide(cellIds,count,cellClass,bit,index,side,scratch)||sparseEdgeVisited(index,side,visited))continue;
      const candidate=edgeAt(row,column,side,scratch);
      if(sameVertex(candidate.start,vertex))candidates.push(candidate);
    }
  }
  return candidates;
}
function chooseContinuation(current:GridEdge,candidates:GridEdge[]):GridEdge|undefined {
  if(candidates.length===0)return undefined;
  const pdx=current.end.x-current.start.x,pdy=current.end.y-current.start.y;
  candidates.sort((a,b)=>{
    const adx=a.end.x-a.start.x,ady=a.end.y-a.start.y,bdx=b.end.x-b.start.x,bdy=b.end.y-b.start.y;
    const across=pdx*ady-pdy*adx,adot=pdx*adx+pdy*ady,bcross=pdx*bdy-pdy*bdx,bdot=pdx*bdx+pdy*bdy;
    const at=across<0?3:adot>0?2:across>0?1:0,bt=bcross<0?3:bdot>0?2:bcross>0?1:0;
    return bt-at||a.cell-b.cell||a.side-b.side;
  });
  return candidates[0];
}
function labelSparseComponents(
  cellIds:Int32Array,count:number,cellClass:Uint8Array,componentLabel:Int32Array,componentQueue:Int32Array,bit:number,scratch:TerrainScratchGrid,
):number {
  componentLabel.fill(-1,0,count);
  let nextComponent=0;
  for(let seed=0;seed<count;seed+=1){
    if((cellClass[seed]&bit)===0||componentLabel[seed]>=0)continue;
    let head=0,tail=0;componentQueue[tail++]=seed;componentLabel[seed]=nextComponent;
    while(head<tail){
      const index=componentQueue[head++],cell=cellIds[index];
      for(let side=0;side<4;side+=1){
        const nextCell=neighborCell(cell,side,scratch);if(nextCell===undefined)continue;
        const next=selectedIndex(cellIds,count,cellClass,bit,nextCell);
        if(next<0||componentLabel[next]>=0)continue;
        componentLabel[next]=nextComponent;componentQueue[tail++]=next;
      }
    }
    nextComponent+=1;
  }
  return nextComponent;
}
function traceSparseMaskRings(
  cellIds:Int32Array,count:number,cellClass:Uint8Array,visited:Uint8Array,componentLabel:Int32Array,componentQueue:Int32Array,
  bit:number,scratch:TerrainScratchGrid,path:string,maxVertices:number,
):WorldM0Result<readonly (readonly WorldM0PointM[])[]> {
  visited.fill(0,0,count);
  const componentCount=labelSparseComponents(cellIds,count,cellClass,componentLabel,componentQueue,bit,scratch);
  if(componentCount===0)return invalid(path,"cell union is empty");
  const rawRings:WorldM0PointM[][]=[];let totalVertices=0;
  while(true){
    let start:GridEdge|undefined,startIndex=-1;
    for(let index=0;index<count&&!start;index+=1){
      if((cellClass[index]&bit)===0)continue;
      const cell=cellIds[index],row=rowOf(cell,scratch.width),column=columnOf(cell,scratch.width);
      for(let side=0;side<4;side+=1){
        if(sparseBoundarySide(cellIds,count,cellClass,bit,index,side,scratch)&&!sparseEdgeVisited(index,side,visited)){
          start=edgeAt(row,column,side,scratch);startIndex=index;break;
        }
      }
    }
    if(!start)break;
    const componentOrdinal=componentLabel[startIndex];
    if(componentOrdinal<0)return invalid(path,"boundary edge lacks a cardinal component label");
    const points:WorldM0PointM[]=[toPoint(start.start,scratch)];let current=start,walked=0;
    const maximumBoundaryEdges=count*4;
    while(true){
      const index=findCellIndex(cellIds,count,current.cell);
      if(index<0||sparseEdgeVisited(index,current.side,visited))return invalid(path,"cell-union boundary edge was reused");
      sparseMarkEdgeVisited(index,current.side,visited);
      if(totalVertices+points.length+1>maxVertices)return bound("geometry.maxPolygonVerticesPerFeature","polygon feature exceeds final vertex bound before JS geometry materialization");
      points.push(toPoint(current.end,scratch));walked+=1;
      if(walked>maximumBoundaryEdges)return bound(path,"cell-union trace exceeded sparse corridor edge bound");
      if(sameVertex(current.end,start.start))break;
      const next=chooseContinuation(current,outgoingSparseBoundaryCandidates(
        current.end,cellIds,count,cellClass,visited,componentLabel,componentOrdinal,bit,scratch));
      if(!next)return invalid(path,"cell-union boundary failed to close");
      current=next;
    }
    const open=points.slice(0,-1);let first=0;
    for(let index=1;index<open.length;index+=1)if(comparePointM(open[index],open[first])<0)first=index;
    const normalized=open.slice(first).concat(open.slice(0,first));normalized.push(normalized[0]);
    totalVertices+=normalized.length;
    if(totalVertices>maxVertices)return bound("geometry.maxPolygonVerticesPerFeature","polygon feature exceeds final vertex bound");
    rawRings.push(normalized);
  }
  if(rawRings.length===0)return invalid(path,"cell union is empty");
  return normalizeTask9RasterRingFeatureV1(rawRings,scratch,path);
}
function releaseLabels(scratch:TerrainScratchGrid,labels:readonly string[]):WorldM0Result<true>{
  for(let index=labels.length-1;index>=0;index-=1){const released=scratch.budget.release(labels[index]);if(!released.ok)return released;}
  return {ok:true,value:true};
}

/** Trace normalized UNSIMPLIFIED §§8-9 rings from a bounded sparse cell registry. */
export function traceTask9CellUnionRingsV1(
  selectedCells:readonly number[],scratch:TerrainScratchGrid,path:string,
):WorldM0Result<readonly (readonly WorldM0PointM[])[]> {
  if(!Array.isArray(selectedCells)||selectedCells.length===0)return invalid(path,"cell union is empty");
  const labels=["task9TraceCellIds","task9TraceCellClass","task9TraceEdgeVisit","task9TraceComponentLabel","task9TraceComponentQueue"] as const;
  const allocated=scratch.budget.allocateBatch([
    {label:labels[0],kind:"i32",length:selectedCells.length},{label:labels[1],kind:"u8",length:selectedCells.length},
    {label:labels[2],kind:"u8",length:selectedCells.length},{label:labels[3],kind:"i32",length:selectedCells.length},
    {label:labels[4],kind:"i32",length:selectedCells.length},
  ]);
  if(!allocated.ok)return allocated;
  const [cellIds,cellClass,visited,componentLabel,componentQueue]=allocated.value;
  let outcome:WorldM0Result<readonly (readonly WorldM0PointM[])[]>;
  if(!(cellIds instanceof Int32Array)||!(cellClass instanceof Uint8Array)||!(visited instanceof Uint8Array)||
     !(componentLabel instanceof Int32Array)||!(componentQueue instanceof Int32Array)){
    outcome=invalid(path,"scratch allocator returned unexpected Task-9 sparse trace arrays");
  }else{
    let bad=false;
    for(let index=0;index<selectedCells.length;index+=1){
      const cell=selectedCells[index];if(!Number.isSafeInteger(cell)||cell<0||cell>=scratch.width*scratch.height){bad=true;break;}cellIds[index]=cell;
    }
    cellIds.sort();
    for(let index=1;index<selectedCells.length;index+=1)if(cellIds[index]===cellIds[index-1])bad=true;
    cellClass.fill(1);
    const maxVertices=selectedCells.length<=Math.floor((Number.MAX_SAFE_INTEGER-4)/5)?Math.max(4,selectedCells.length*5):0;
    outcome=bad||maxVertices===0?invalid(path,"cell union contains an invalid or duplicate analysis cell"):
      traceSparseMaskRings(cellIds,selectedCells.length,cellClass,visited,componentLabel,componentQueue,1,scratch,path,maxVertices);
  }
  const released=releaseLabels(scratch,labels);return released.ok?outcome:released;
}

interface SegmentNeighborhoodPlan { readonly steps:number; readonly side:number; }
function segmentNeighborhoodPlan(first:WorldM0PointM,second:WorldM0PointM,scratch:TerrainScratchGrid,radius:number):SegmentNeighborhoodPlan|undefined {
  if(!Number.isFinite(first.xM)||!Number.isFinite(first.yM)||!Number.isFinite(second.xM)||!Number.isFinite(second.yM)||
     Object.is(first.xM,-0)||Object.is(first.yM,-0)||Object.is(second.xM,-0)||Object.is(second.yM,-0))return undefined;
  const length=Math.hypot(second.xM-first.xM,second.yM-first.yM);if(!Number.isFinite(length)||!(length>0))return undefined;
  const steps=Math.max(1,Math.ceil(length/scratch.cellSizeMeters));
  const offset=Math.ceil((radius+scratch.cellSizeMeters)/scratch.cellSizeMeters);
  const side=2*offset+1;
  return Number.isSafeInteger(steps)&&Number.isSafeInteger(side)&&side>0?{steps,side}:undefined;
}
function reachNeighborhoodOccurrenceBound(reach:TerrainDrainageReach,scratch:TerrainScratchGrid,radius:number):number|undefined {
  let total=0;
  for(let segment=0;segment+1<reach.geometry.length;segment+=1){
    const plan=segmentNeighborhoodPlan(reach.geometry[segment],reach.geometry[segment+1],scratch,radius);if(!plan)return undefined;
    const sampleCount=plan.steps+1,cellsPerSample=plan.side*plan.side;
    if(!Number.isSafeInteger(cellsPerSample)||sampleCount>Math.floor(Number.MAX_SAFE_INTEGER/cellsPerSample))return undefined;
    const amount=sampleCount*cellsPerSample;if(total>Number.MAX_SAFE_INTEGER-amount)return undefined;total+=amount;
  }
  return total;
}
function forEachReachNeighborhood(
  reach:TerrainDrainageReach,scratch:TerrainScratchGrid,radius:number,
  visit:(cell:number,distanceSquared:number,referenceElevation:number)=>void,
):WorldM0Result<true>{
  const radiusSquared=radius*radius;
  for(let segment=0;segment+1<reach.geometry.length;segment+=1){
    const first=reach.geometry[segment],second=reach.geometry[segment+1];
    const plan=segmentNeighborhoodPlan(first,second,scratch,radius);if(!plan)return invalid("reaches.geometry","reach segment is not a finite represented geometry");
    const firstElevation=sampleElevation(first,scratch),secondElevation=sampleElevation(second,scratch);if(firstElevation===undefined||secondElevation===undefined)continue;
    const offset=(plan.side-1)/2;
    for(let sample=0;sample<=plan.steps;sample+=1){
      const t=sample/plan.steps,sampleX=first.xM+t*(second.xM-first.xM),sampleY=first.yM+t*(second.yM-first.yM);
      const baseColumn=Math.min(scratch.width-1,Math.max(0,Math.floor(sampleX/scratch.cellSizeMeters)));
      const southRow=Math.min(scratch.height-1,Math.max(0,Math.floor(sampleY/scratch.cellSizeMeters)));
      const baseRow=scratch.height-1-southRow;
      for(let dr=-offset;dr<=offset;dr+=1)for(let dc=-offset;dc<=offset;dc+=1){
        const row=baseRow+dr,column=baseColumn+dc;if(row<0||row>=scratch.height||column<0||column>=scratch.width)continue;
        const cell=row*scratch.width+column;if(scratch.landMask[cell]!==1)continue;
        const projection=pointSegmentProjection(center(cell,scratch),first,second);if(projection.distanceSquared>radiusSquared)continue;
        visit(cell,projection.distanceSquared,firstElevation+projection.t*(secondElevation-firstElevation));
      }
    }
  }
  return {ok:true,value:true};
}

interface ReachPhysicalAuthority {
  readonly reach: TerrainDrainageReach;
  readonly upstreamNode: TerrainDrainageNode;
  readonly downstreamNode: TerrainDrainageNode;
  readonly terminal: TerrainHydroTerminal;
  readonly catchment: TerrainCatchment;
}
interface GeometryCandidate {
  readonly authority: ReachPhysicalAuthority;
  readonly unsimplifiedRings: readonly (readonly WorldM0PointM[])[];
  readonly areaM2: number;
  readonly localReliefMeters: number;
  readonly terrainSlope: number;
  readonly boundaryRings?: readonly (readonly WorldM0PointM[])[];
}
function terminalKindOrder(kind:TerrainHydroTerminal["kind"]):number { return kind==="retained_closed_basin"?0:kind==="ocean_outlet"?1:2; }
function nodeKindOrder(kind:TerrainDrainageNode["kind"]):number { return kind==="source"?0:kind==="confluence"?1:2; }
function compareTerminalPhysical(left:TerrainHydroTerminal,right:TerrainHydroTerminal):number {
  return terminalKindOrder(left.kind)-terminalKindOrder(right.kind)||comparePointM(left.point,right.point);
}
function compareNodePhysical(
  left:TerrainDrainageNode,leftTerminal:TerrainHydroTerminal,right:TerrainDrainageNode,rightTerminal:TerrainHydroTerminal,
):number {
  return comparePointM(left.point,right.point)||nodeKindOrder(left.kind)-nodeKindOrder(right.kind)||compareTerminalPhysical(leftTerminal,rightTerminal);
}
function compareReachAuthority(left:ReachPhysicalAuthority,right:ReachPhysicalAuthority):number {
  return compareNodePhysical(left.upstreamNode,left.terminal,right.upstreamNode,right.terminal)||
    compareNodePhysical(left.downstreamNode,left.terminal,right.downstreamNode,right.terminal)||
    compareTerminalPhysical(left.terminal,right.terminal)||comparePointSequence(left.reach.geometry,right.reach.geometry);
}
function compareGeometryPreKey(left:GeometryCandidate,right:GeometryCandidate):number {
  return compareReachAuthority(left.authority,right.authority)||compareTask9RingRegistryV1(left.unsimplifiedRings,right.unsimplifiedRings);
}
function compareGeometryFinalKey(left:GeometryCandidate,right:GeometryCandidate):number {
  return compareReachAuthority(left.authority,right.authority)||compareTask9RingRegistryV1(left.boundaryRings??[],right.boundaryRings??[]);
}
function finalizeGeometryDomain(
  domain:readonly GeometryCandidate[],scratch:TerrainScratchGrid,constants:WorldM0PhysicalConstantsV1,path:string,
):WorldM0Result<readonly GeometryCandidate[]> {
  // M03 domains 4/5: collect every unsimplified feature before this sort and before
  // the first deletion. Reach IDs are linkage only and never participate here.
  const ordered=[...domain].sort(compareGeometryPreKey);
  for(let index=1;index<ordered.length;index+=1){
    if(compareGeometryPreKey(ordered[index-1],ordered[index])===0)return invalid(path,"duplicate complete M03 pre-key");
  }
  const finalized:GeometryCandidate[]=[];
  for(let index=0;index<ordered.length;index+=1){
    const item=ordered[index];
    const reach=item.authority.reach;
    const simplified=simplifyTask9NormalizedRasterRingFeatureV1(
      item.unsimplifiedRings,scratch,constants,`${path}[${index}].boundaryRings`,
      {references:[{originalGeometry:reach.geometry,currentGeometry:reach.geometry}],preserveRasterClassification:true});
    if(!simplified.ok)return simplified;
    finalized.push({...item,boundaryRings:simplified.value});
  }
  // The complete domain is final. Only now may the persistent feature-ID order be
  // materialized from the final physical key.
  finalized.sort(compareGeometryFinalKey);
  for(let index=1;index<finalized.length;index+=1){
    if(compareGeometryFinalKey(finalized[index-1],finalized[index])===0)return invalid(path,"duplicate complete final geometry key");
  }
  return {ok:true,value:finalized};
}

interface ReachDerivedGeometry { readonly valley?:GeometryCandidate; readonly floodplain?:GeometryCandidate; }
function deriveReachGeometry(
  authority:ReachPhysicalAuthority,scratch:TerrainScratchGrid,constants:WorldM0PhysicalConstantsV1,
):WorldM0Result<ReachDerivedGeometry> {
  const reach=authority.reach,radius=constants.geometry.valleySearchRadiusMeters;
  const occurrenceBound=reachNeighborhoodOccurrenceBound(reach,scratch,radius);
  if(occurrenceBound===undefined||occurrenceBound<=0)return invalid("reaches.geometry","reach has no finite bounded represented corridor");
  const occurrenceLabel="task9CorridorCellOccurrences";
  const occurrenceAllocation=scratch.budget.allocateBatch([{label:occurrenceLabel,kind:"i32",length:occurrenceBound}]);
  if(!occurrenceAllocation.ok)return occurrenceAllocation;
  const corridorCells=occurrenceAllocation.value[0];
  if(!(corridorCells instanceof Int32Array)){
    const released=scratch.budget.release(occurrenceLabel);return released.ok?invalid("scratch","scratch allocator returned an unexpected Task-9 corridor registry"):released;
  }
  let occurrenceCount=0,overflow=false;
  const discovery=forEachReachNeighborhood(reach,scratch,radius,(cell)=>{
    if(occurrenceCount>=corridorCells.length){overflow=true;return;}corridorCells[occurrenceCount++]=cell;
  });
  if(!discovery.ok||overflow){
    const released=scratch.budget.release(occurrenceLabel);
    return released.ok?(discovery.ok?bound("geometry.valleySearchRadiusMeters","represented reach corridor exceeded its verified occurrence bound"):discovery):released;
  }
  if(occurrenceCount===0){
    const released=scratch.budget.release(occurrenceLabel);return released.ok?{ok:true,value:{}}:released;
  }
  corridorCells.subarray(0,occurrenceCount).sort();
  let uniqueCount=1;
  for(let index=1;index<occurrenceCount;index+=1){
    if(corridorCells[index]!==corridorCells[uniqueCount-1])corridorCells[uniqueCount++]=corridorCells[index];
  }
  if(uniqueCount>scratch.width*scratch.height||uniqueCount>constants.analysis.maxAnalysisCells){
    const released=scratch.budget.release(occurrenceLabel);return released.ok?bound("analysis.maxAnalysisCells","Task-9 sparse corridor exceeds analysis-cell bound"):released;
  }
  const labels=["task9NearestDistance","task9ReferenceElevation","task9CellClass","task9EdgeVisit","task9ComponentLabel","task9ComponentQueue"] as const;
  const allocated=scratch.budget.allocateBatch([
    {label:labels[0],kind:"f64",length:uniqueCount},{label:labels[1],kind:"f64",length:uniqueCount},
    {label:labels[2],kind:"u8",length:uniqueCount},{label:labels[3],kind:"u8",length:uniqueCount},
    {label:labels[4],kind:"i32",length:uniqueCount},{label:labels[5],kind:"i32",length:uniqueCount},
  ]);
  if(!allocated.ok){const released=scratch.budget.release(occurrenceLabel);return released.ok?allocated:released;}
  const [distanceBuffer,elevationBuffer,classBuffer,visitBuffer,componentBuffer,queueBuffer]=allocated.value;
  let outcome:WorldM0Result<ReachDerivedGeometry>|undefined;
  if(!(distanceBuffer instanceof Float64Array)||!(elevationBuffer instanceof Float64Array)||!(classBuffer instanceof Uint8Array)||
     !(visitBuffer instanceof Uint8Array)||!(componentBuffer instanceof Int32Array)||!(queueBuffer instanceof Int32Array)){
    outcome=invalid("scratch","scratch allocator returned unexpected Task-9 sparse corridor arrays");
  }else{
    distanceBuffer.fill(Number.POSITIVE_INFINITY);
    const measured=forEachReachNeighborhood(reach,scratch,radius,(cell,distanceSquared,referenceElevation)=>{
      const index=findCellIndex(corridorCells,uniqueCount,cell);
      if(index>=0&&distanceSquared<distanceBuffer[index]){distanceBuffer[index]=distanceSquared;elevationBuffer[index]=referenceElevation;}
    });
    if(!measured.ok)outcome=measured;
    else{
      let valleyCount=0,floodCount=0,minElevation=Infinity,maxElevation=-Infinity,maxFloodSlope=0;
      for(let index=0;index<uniqueCount;index+=1){
        if(!Number.isFinite(distanceBuffer[index]))continue;
        const cell=corridorCells[index],elevation=scratch.elevationMeters[cell];
        if(elevation>elevationBuffer[index]+constants.geometry.valleyRelativeReliefMeters)continue;
        classBuffer[index]|=1;valleyCount+=1;minElevation=Math.min(minElevation,elevation);maxElevation=Math.max(maxElevation,elevation);
        const slope=localCardinalSlope(cell,scratch);
        if(slope<=constants.geometry.floodplainCandidateMaxSlope){classBuffer[index]|=2;floodCount+=1;maxFloodSlope=Math.max(maxFloodSlope,slope);}
      }
      let valley:GeometryCandidate|undefined,floodplain:GeometryCandidate|undefined;
      if(valleyCount>0){
        const rings=traceSparseMaskRings(corridorCells,uniqueCount,classBuffer,visitBuffer,componentBuffer,queueBuffer,1,scratch,"valleys.boundaryRings",constants.geometry.maxPolygonVerticesPerFeature);
        if(!rings.ok)outcome=rings;else valley={authority,unsimplifiedRings:rings.value,areaM2:valleyCount*scratch.cellAreaM2,localReliefMeters:maxElevation-minElevation,terrainSlope:0};
      }
      if(outcome===undefined&&floodCount>0){
        const rings=traceSparseMaskRings(corridorCells,uniqueCount,classBuffer,visitBuffer,componentBuffer,queueBuffer,2,scratch,"floodplainCandidates.boundaryRings",constants.geometry.maxPolygonVerticesPerFeature);
        if(!rings.ok)outcome=rings;else floodplain={authority,unsimplifiedRings:rings.value,areaM2:floodCount*scratch.cellAreaM2,localReliefMeters:0,terrainSlope:maxFloodSlope};
      }
      if(outcome===undefined)outcome={ok:true,value:{valley,floodplain}};
    }
  }
  if(outcome===undefined)outcome=invalid("terrainValleys","Task-9 reach derivation produced no outcome");
  const releasedSecondary=releaseLabels(scratch,labels);
  const releasedOccurrence=scratch.budget.release(occurrenceLabel);
  return !releasedSecondary.ok?releasedSecondary:!releasedOccurrence.ok?releasedOccurrence:outcome;
}

function uniqueMap<T extends {readonly id:string}>(items:readonly T[],path:string):WorldM0Result<Map<string,T>> {
  const map=new Map<string,T>();
  for(const item of items){if(map.has(item.id))return invalid(path,"persistent registry contains a duplicate id");map.set(item.id,item);}
  return {ok:true,value:map};
}
function resolveReachAuthority(
  reach:TerrainDrainageReach,nodeById:ReadonlyMap<string,TerrainDrainageNode>,terminalById:ReadonlyMap<string,TerrainHydroTerminal>,
  catchmentById:ReadonlyMap<string,TerrainCatchment>,
):WorldM0Result<ReachPhysicalAuthority> {
  const upstreamNode=nodeById.get(reach.upstreamNodeId),downstreamNode=nodeById.get(reach.downstreamNodeId),terminal=terminalById.get(reach.terminalId),catchment=catchmentById.get(reach.catchmentId);
  const first=reach.geometry[0],last=reach.geometry[reach.geometry.length-1];
  if(!upstreamNode||!downstreamNode||!terminal||!catchment||!first||!last||catchment.terminalId!==terminal.id||terminal.catchmentId!==catchment.id||
     !samePoint(first,upstreamNode.point)||!samePoint(last,downstreamNode.point)||upstreamNode.kind==="terminal"||upstreamNode.terminalId!==null||
     (downstreamNode.kind==="terminal"?downstreamNode.terminalId!==terminal.id:downstreamNode.terminalId!==null)){
    return invalid("reaches","reach does not resolve to the exact finalized Task-8 node/terminal/catchment authority");
  }
  for(const point of reach.geometry){if(!Number.isFinite(point.xM)||!Number.isFinite(point.yM)||Object.is(point.xM,-0)||Object.is(point.yM,-0))return invalid("reaches.geometry","reach geometry contains a non-canonical point");}
  return {ok:true,value:{reach,upstreamNode,downstreamNode,terminal,catchment}};
}

export function deriveTerrainValleyGeometry(
  scratch:TerrainScratchGrid,drainage:TerrainDrainageGraphResult,constants:WorldM0PhysicalConstantsV1,
):WorldM0Result<TerrainValleyGeometryResult> {
  if(!drainage||!Array.isArray(drainage.reaches)||!Array.isArray(drainage.nodes)||!Array.isArray(drainage.terminals)||!Array.isArray(drainage.catchments)){
    return invalid("drainage","Task-9 requires the finalized Task-8 drainage graph authority");
  }
  if(drainage.reaches.length>constants.drainage.maxReaches)return bound("drainage.maxReaches","valley input reach count exceeds bound");
  const nodeMap=uniqueMap(drainage.nodes,"drainage.nodes"),terminalMap=uniqueMap(drainage.terminals,"drainage.terminals"),catchmentMap=uniqueMap(drainage.catchments,"drainage.catchments");
  if(!nodeMap.ok)return nodeMap;if(!terminalMap.ok)return terminalMap;if(!catchmentMap.ok)return catchmentMap;
  const reachIds=new Set<string>(),authorities:ReachPhysicalAuthority[]=[];
  for(const reach of drainage.reaches){
    if(reachIds.has(reach.id)||!/^drainage-reach:[0-9a-f]{16}$/.test(reach.id))return invalid("reaches.id","reach id is invalid or duplicated");
    if(reach.geometry.length<2)return invalid("reaches.geometry","reach geometry must have at least two points");
    reachIds.add(reach.id);
    const authority=resolveReachAuthority(reach,nodeMap.value,terminalMap.value,catchmentMap.value);if(!authority.ok)return authority;authorities.push(authority.value);
  }
  // Prove the exact final reach physical key is unique without using IDs or ID ordinals.
  const orderedAuthorities=[...authorities].sort(compareReachAuthority);
  for(let index=1;index<orderedAuthorities.length;index+=1)if(compareReachAuthority(orderedAuthorities[index-1],orderedAuthorities[index])===0)return invalid("reaches","distinct reaches have duplicate final physical keys");

  // Derive every UNSIMPLIFIED feature first, in producer order. No domain-4/5
  // simplification is allowed until these two complete registries exist.
  const valleyDomain:GeometryCandidate[]=[],floodDomain:GeometryCandidate[]=[];
  for(const authority of authorities){
    const derived=deriveReachGeometry(authority,scratch,constants);if(!derived.ok)return derived;
    if(derived.value.valley){valleyDomain.push(derived.value.valley);if(valleyDomain.length>constants.drainage.maxReaches)return bound("drainage.maxReaches","valley candidate count exceeds one-per-reach bound");}
    if(derived.value.floodplain){floodDomain.push(derived.value.floodplain);if(floodDomain.length>constants.drainage.maxReaches)return bound("drainage.maxReaches","floodplain candidate count exceeds one-per-reach bound");}
  }
  const finalizedValleys=finalizeGeometryDomain(valleyDomain,scratch,constants,"valleys");if(!finalizedValleys.ok)return finalizedValleys;
  const finalizedFloodplains=finalizeGeometryDomain(floodDomain,scratch,constants,"floodplainCandidates");if(!finalizedFloodplains.ok)return finalizedFloodplains;
  if(finalizedValleys.value.length>constants.drainage.maxReaches||finalizedFloodplains.value.length>constants.drainage.maxReaches){
    return bound("drainage.maxReaches","Task-9 output registry exceeds explicit one-per-reach bound");
  }
  const valleys:TerrainValleyCandidate[]=[];
  for(let index=0;index<finalizedValleys.value.length;index+=1){
    const item=finalizedValleys.value[index];if(!item.boundaryRings)return invalid("valleys","domain-4 geometry did not cross the ID barrier");
    const ident=formatTerrainHydroId("valley",index);if(!ident.ok)return ident;
    valleys.push({id:ident.value,reachId:item.authority.reach.id,boundaryRings:item.boundaryRings,areaM2:item.areaM2,localReliefMeters:item.localReliefMeters});
  }
  const floodplainCandidates:TerrainFloodplainCandidate[]=[];
  for(let index=0;index<finalizedFloodplains.value.length;index+=1){
    const item=finalizedFloodplains.value[index];if(!item.boundaryRings)return invalid("floodplainCandidates","domain-5 geometry did not cross the ID barrier");
    const ident=formatTerrainHydroId("floodplain",index);if(!ident.ok)return ident;
    floodplainCandidates.push({id:ident.value,reachId:item.authority.reach.id,boundaryRings:item.boundaryRings,areaM2:item.areaM2,terrainSlope:item.terrainSlope});
  }
  return {ok:true,value:{valleys,floodplainCandidates}};
}
