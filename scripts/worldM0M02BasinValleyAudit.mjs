import { existsSync, readFileSync } from "node:fs";
import { createServer } from "vite";
import { clonePhysicalConstants } from "./lib/worldM0M02Fixture.mjs";

const ROOT = process.cwd();
const BASINS_PATH = `${ROOT}/src/sim/world/physical/terrainBasins.ts`;
const VALLEYS_PATH = `${ROOT}/src/sim/world/physical/terrainValleys.ts`;
const CELL = 250;
const AREA = 62_500;

async function loadModules(suffix = "") {
  const server = await createServer({ root: `${ROOT}/src`, configFile: false, appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false }, logLevel: "error" });
  const loaded = {};
  try {
    loaded.scratch = await server.ssrLoadModule("/sim/world/physical/terrainScratch.ts");
    if (existsSync(BASINS_PATH)) loaded.basins = await server.ssrLoadModule(`/sim/world/physical/terrainBasins.ts${suffix}`);
    if (existsSync(VALLEYS_PATH)) loaded.valleys = await server.ssrLoadModule(`/sim/world/physical/terrainValleys.ts${suffix}`);
  } catch (error) { loaded.loadError = error instanceof Error ? error.message : String(error); }
  finally { await server.close(); }
  return loaded;
}
const modules = await loadModules();
const ok = (r) => r?.ok === true ? r.value : undefined;
const err = (r) => r?.ok === false ? r.error : undefined;
const point = (xM, yM) => ({ xM, yM });
const id = (ns, n) => `${ns}:${n.toString(16).padStart(16, "0")}`;
const ring = (...xy) => xy.map(([xM,yM]) => point(xM,yM));
const F_RING = ring([500,500],[1000,500],[1000,750],[500,750],[500,500]);
function area2(points) { let a=0; for(let i=0;i+1<points.length;i++) a += points[i].xM*points[i+1].yM-points[i+1].xM*points[i].yM; return a; }
function pointInRing(p, points) {
  let inside=false;
  for(let i=0,j=points.length-2;i<points.length-1;j=i++) {
    const a=points[i],b=points[j];
    if((a.yM>p.yM)!==(b.yM>p.yM)) {
      const x=a.xM+((p.yM-a.yM)*(b.xM-a.xM))/(b.yM-a.yM);
      if(x>p.xM) inside=!inside;
    }
  }
  return inside;
}
function interiorProbe(points) {
  const a=area2(points), p=points[0], n=points[1], dx=n.xM-p.xM, dy=n.yM-p.yM, len=Math.hypot(dx,dy);
  if(!a||!len) return undefined;
  const side=Math.sign(a);
  return point((p.xM+n.xM)/2+side*(-dy/len),(p.yM+n.yM)/2+side*(dx/len));
}
function ringRoleAreaExact(rings, expectedAreaM2) {
  if(!Array.isArray(rings)||rings.length===0) return false;
  let signedPhysicalArea=0;
  for(let i=0;i<rings.length;i++) {
    const probe=interiorProbe(rings[i]);
    if(!probe) return false;
    let depth=0;
    for(let j=0;j<rings.length;j++) if(i!==j&&pointInRing(probe,rings[j])) depth++;
    const a=area2(rings[i]);
    if(((depth&1)===0&&a<=0)||((depth&1)===1&&a>=0)) return false;
    signedPhysicalArea += a/2;
  }
  return signedPhysicalArea===expectedAreaM2;
}
function exactKeys(value, keys) { return value && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()); }
function bytes(v) { return Buffer.from(JSON.stringify(v), "utf8"); }
function sameBytes(a,b) { return bytes(a).equals(bytes(b)); }

function makeGrid(width, height, elevations, landMask = Array(width*height).fill(1), constants = clonePhysicalConstants()) {
  const budget = ok(modules.scratch?.createTerrainScratchBudget?.(constants.analysis.maxScratchBytes));
  const grid = budget && ok(modules.scratch?.allocateTerrainScratchGrid?.(width*CELL,height*CELL,constants,budget));
  if (grid) { grid.elevationMeters.set(elevations); grid.landMask.set(landMask); }
  return { constants, budget, grid };
}
function releaseGrid(grid) {
  if (!grid) return false;
  return ["elevationMeters","landMask","routingElevationMeters","flatRank","terminalKindByCell","terminalOrdinalByCell"]
    .every((label) => grid.budget.release(label)?.ok === true);
}
function drainageFor(kind, terminalPoint = point(625,625)) {
  const terminalId=id("terminal",0), catchmentId=id("catchment",0);
  return {
    terminals:[{id:terminalId,kind,point:terminalPoint,catchmentId}],
    catchments:[{id:catchmentId,terminalId,areaM2:125000,boundaryRings:[F_RING]}],
    nodes:[], reaches:[],
    retainedDepressionLinks:[{depressionToken:"depression-analysis:0000000000000000",catchmentId,terminalId}],
  };
}
const retainedBase = {
  token:"depression-analysis:0000000000000000", canonicalFloorCell:12, floorElevationMeters:1,
  physicalSpillElevationMeters:4, areaM2:125000, boundaryRings:[F_RING],
};
const f5Grid = makeGrid(5,5,Array(25).fill(9));
const f5 = modules.basins?.finalizeDepressionBasins?.(f5Grid.grid,
  {retainedDepressions:[],terminalOwners:{terminalKindByCell:f5Grid.grid?.terminalKindByCell,terminalOrdinalByCell:f5Grid.grid?.terminalOrdinalByCell,terminalOwnerCells:new Int32Array(0),terminalCount:0},conditionedDepressionCount:1,repairOperationCount:0},
  {terminals:[],catchments:[],nodes:[],reaches:[],retainedDepressionLinks:[]},f5Grid.constants);

const f6Grid = makeGrid(5,5,Array(25).fill(9));
const f6Dep = {...retainedBase,persistentSpillElevationMeters:null,protectedIntentToken:"protected-basin:0000000000000000",closedEndorheic:true};
const f6 = modules.basins?.finalizeDepressionBasins?.(f6Grid.grid,
  {retainedDepressions:[f6Dep],terminalOwners:{terminalKindByCell:f6Grid.grid?.terminalKindByCell,terminalOrdinalByCell:f6Grid.grid?.terminalOrdinalByCell,terminalOwnerCells:new Int32Array(0),terminalCount:0},conditionedDepressionCount:1,repairOperationCount:0},
  drainageFor("retained_closed_basin"),f6Grid.constants);
const f6Bad = modules.basins?.finalizeDepressionBasins?.(f6Grid.grid,
  {retainedDepressions:[{...f6Dep,persistentSpillElevationMeters:4}],terminalOwners:{terminalKindByCell:f6Grid.grid?.terminalKindByCell,terminalOrdinalByCell:f6Grid.grid?.terminalOrdinalByCell,terminalOwnerCells:new Int32Array(0),terminalCount:0},conditionedDepressionCount:1,repairOperationCount:0},
  drainageFor("retained_closed_basin"),f6Grid.constants);

const f7Grid = makeGrid(5,5,Array(25).fill(9));
const f7Dep = {...retainedBase,persistentSpillElevationMeters:4,protectedIntentToken:null,closedEndorheic:false};
const f7Drain = drainageFor("external_domain_outlet",point(1250,125));
const f7 = modules.basins?.finalizeDepressionBasins?.(f7Grid.grid,
  {retainedDepressions:[f7Dep],terminalOwners:{terminalKindByCell:f7Grid.grid?.terminalKindByCell,terminalOrdinalByCell:f7Grid.grid?.terminalOrdinalByCell,terminalOwnerCells:new Int32Array(0),terminalCount:0},conditionedDepressionCount:1,repairOperationCount:0},f7Drain,f7Grid.constants);

const twoGrid = makeGrid(5,5,Array(25).fill(9));
const ringB = ring([0,0],[250,0],[250,250],[0,250],[0,0]);
const ringC = ring([1000,0],[1250,0],[1250,250],[1000,250],[1000,0]);
const depB = {token:"depression-analysis:0000000000000001",canonicalFloorCell:20,floorElevationMeters:2,
  physicalSpillElevationMeters:5,persistentSpillElevationMeters:5,protectedIntentToken:null,closedEndorheic:false,areaM2:125000,boundaryRings:[ringB,ringC]};
const term0={id:id("terminal",0),kind:"retained_closed_basin",point:point(625,625),catchmentId:id("catchment",0)};
const term1={id:id("terminal",1),kind:"external_domain_outlet",point:point(0,125),catchmentId:id("catchment",1)};
const twoDrain={terminals:[term0,term1],catchments:[
  {id:id("catchment",0),terminalId:term0.id,areaM2:125000,boundaryRings:[F_RING]},
  {id:id("catchment",1),terminalId:term1.id,areaM2:125000,boundaryRings:[ringB,ringC]}],nodes:[],reaches:[],retainedDepressionLinks:[
  {depressionToken:f6Dep.token,catchmentId:id("catchment",0),terminalId:term0.id},
  {depressionToken:depB.token,catchmentId:id("catchment",1),terminalId:term1.id}]};
const depAnalysis=(items)=>({retainedDepressions:items,terminalOwners:{terminalKindByCell:twoGrid.grid?.terminalKindByCell,terminalOrdinalByCell:twoGrid.grid?.terminalOrdinalByCell,terminalOwnerCells:new Int32Array(0),terminalCount:0},conditionedDepressionCount:2,repairOperationCount:0});
const d3Forward=modules.basins?.finalizeDepressionBasins?.(twoGrid.grid,depAnalysis([f6Dep,depB]),twoDrain,twoGrid.constants);
const d3Reverse=modules.basins?.finalizeDepressionBasins?.(twoGrid.grid,depAnalysis([{...depB,boundaryRings:[...depB.boundaryRings].reverse()},f6Dep]),{...twoDrain,retainedDepressionLinks:[...twoDrain.retainedDepressionLinks].reverse()},twoGrid.constants);

const vc=clonePhysicalConstants(); vc.geometry.valleySearchRadiusMeters=500; vc.geometry.valleyRelativeReliefMeters=30; vc.geometry.floodplainCandidateMaxSlope=0.03;
const w=7,h=7; const elevations=[];
for(let r=0;r<h;r++) for(let c=0;c<w;c++) {
  const corridor=Math.abs(r-3)<=1;
  elevations.push(corridor ? 20 + Math.abs(r-3)*2 + (6-c)*0.5 : 90);
}
elevations[0]=20;
const valleyGrid=makeGrid(w,h,elevations,Array(w*h).fill(1),vc);
const reachA={id:id("drainage-reach",0),upstreamNodeId:id("drainage-node",0),downstreamNodeId:id("drainage-node",1),downstreamReachId:null,
  catchmentId:id("catchment",0),terminalId:id("terminal",0),geometry:[point(375,875),point(875,875),point(1375,875)],lengthMeters:1000,
  contributingAreaM2:500000,localContributingAreaM2:500000,meanTerrainGradient:0.01,localReliefMeters:70,channelIncisionMeters:20};
const reachB={...reachA,id:id("drainage-reach",1),geometry:[point(375,375),point(875,375),point(1375,375)]};
const valleyBudgetBefore=valleyGrid.budget?.snapshot?.();
const valleysForward=modules.valleys?.deriveTerrainValleyGeometry?.(valleyGrid.grid,[reachA,reachB],vc);
const valleysReverse=modules.valleys?.deriveTerrainValleyGeometry?.(valleyGrid.grid,[reachB,reachA],vc);
const valleyBudgetAfter=valleyGrid.budget?.snapshot?.();
const vv=ok(valleysForward); const vvRev=ok(valleysReverse);

const reachPhysicalIdWitness=vv?.valleys?.find((v)=>v.reachId===reachB.id)?.id===id("valley",0) &&
  vv?.floodplainCandidates?.find((v)=>v.reachId===reachB.id)?.id===id("floodplain",0);

const rawCells=[8,16];
const rawForward=modules.valleys?.traceTask9CellUnionRingsV1?.(rawCells,valleyGrid.grid,"audit.rawRings");
const rawReverse=modules.valleys?.traceTask9CellUnionRingsV1?.([...rawCells].reverse(),valleyGrid.grid,"audit.rawRings");

const f6Value=ok(f6)?.[0]; const f7Value=ok(f7)?.[0];
const forbidden=/\b(season|frequency|wetland|waterDepth|discharge|rainfall|runoff|precipitation)\b/i;
const basinSource=existsSync(BASINS_PATH)?readFileSync(BASINS_PATH,"utf8"):"";
const valleySource=existsSync(VALLEYS_PATH)?readFileSync(VALLEYS_PATH,"utf8"):"";
const checks={
  authorityPresent: typeof modules.basins?.finalizeDepressionBasins === "function" && typeof modules.valleys?.deriveTerrainValleyGeometry === "function",
  f5Absent: Array.isArray(ok(f5)) && ok(f5).length===0,
  f6ClosedExact: f6Value?.id===id("depression-basin",0) && f6Value?.catchmentId===id("catchment",0) && f6Value?.floorElevationMeters===1 &&
    f6Value?.spillElevationMeters===null && f6Value?.outletTerminalId===null && f6Value?.closedEndorheic===true && f6Value?.areaM2===125000 &&
    ringRoleAreaExact(f6Value?.boundaryRings,125000),
  f6ContradictionRejected: err(f6Bad)?.code==="M02_CANDIDATE_INVALID" && /spill/i.test(err(f6Bad)?.path??err(f6Bad)?.detail??""),
  f7ExorheicExact: f7Value?.spillElevationMeters===4 && f7Value?.outletTerminalId===id("terminal",0) && f7Value?.closedEndorheic===false && f7Value?.areaM2===125000,
  domain3OrderAndRingRegistryInvariant: ok(d3Forward) && ok(d3Reverse) && sameBytes(ok(d3Forward),ok(d3Reverse)),
  domain3IdsAfterGeometry: ok(d3Forward)?.every((b,i)=>b.id===id("depression-basin",i)),
  valleyProduced: Array.isArray(vv?.valleys) && vv.valleys.length>=1 && vv.valleys.every(v=>v.areaM2>0 && v.boundaryRings.length>0),
  floodplainProducedNearReach: Array.isArray(vv?.floodplainCandidates) && vv.floodplainCandidates.length>=1,
  isolatedFlatExcluded: vv?.floodplainCandidates?.every(fp=>fp.boundaryRings.every(r=>!r.some(p=>p.xM===0 && p.yM===1750))) ?? false,
  domains45InputOrderInvariant: vv && vvRev && sameBytes(vv,vvRev),
  domains45UseReachPhysicalPreKey: reachPhysicalIdWitness===true,
  domains45RawRingProducerOrderInvariant: ok(rawForward)?.length===2 && sameBytes(ok(rawForward),ok(rawReverse)) && ok(rawForward)?.every((r)=>area2(r)>0),
  candidateKeysExact: vv?.valleys?.every(v=>exactKeys(v,["id","reachId","boundaryRings","areaM2","localReliefMeters"])) &&
    vv?.floodplainCandidates?.every(v=>exactKeys(v,["id","reachId","boundaryRings","areaM2","terrainSlope"])),
  noHydraulicEpistemicFields: !forbidden.test(basinSource) && !forbidden.test(valleySource),
  task9DenseAnalysisUsesScratchBudget: Boolean(valleyBudgetBefore && valleyBudgetAfter && valleyBudgetAfter.liveBytes===valleyBudgetBefore.liveBytes && valleyBudgetAfter.peakBytes>valleyBudgetBefore.peakBytes),
  noJsPerCellMembership: !/new\s+Set<number>|(?:valleyCells|floodCells)\s*:\s*number\[\]/.test(valleySource),
  polygonBoundFailure: (()=>{ const c=structuredClone(vc); c.geometry.maxPolygonVerticesPerFeature=4; const r=modules.valleys?.deriveTerrainValleyGeometry?.(valleyGrid.grid,[reachA],c); return err(r)?.code==="M02_BOUND_EXCEEDED"; })(),
};
const passed=Object.values(checks).every(Boolean);
console.log(JSON.stringify({audit:"WORLD-M0 M0.2 Task 9 basin/valley geometry",checks,loadError:modules.loadError,verdict:passed?"PASS":"FAIL"},null,2));
for(const g of [f5Grid.grid,f6Grid.grid,f7Grid.grid,twoGrid.grid,valleyGrid.grid]) releaseGrid(g);
if(!passed) process.exitCode=1;
