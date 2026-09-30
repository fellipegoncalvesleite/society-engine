// Identical source-preserving observations for reviewed Phase1 and Phase2.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
const arg=(k,d)=>process.argv.includes('--'+k)?process.argv[process.argv.indexOf('--'+k)+1]:d;
const root=resolve(arg('root','.')),out=arg('out'),tier=arg('tier','good'),seed=arg('seed','s1'),years=Number(arg('years','30'));
const ref=arg('ref','working-tree'),siteFile=arg('sites');
assert.ok(out&&!existsSync(out)&&!existsSync(out+'.gz')&&siteFile,'fresh --out and fixed --sites required');
const site=JSON.parse(readFileSync(siteFile)).map2.sites[tier];
let paths;
if(ref!=='working-tree'){
 const files=execFileSync('git',['ls-tree','-r',ref,'src'],{encoding:'utf8'}).trim().split('\n').map(line=>{const [meta,path]=line.split('\t');return {path,blob:meta.split(' ')[2]};});
 for(const f of files){const bytes=readFileSync(resolve(root,f.path));assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),f.blob,'exact baseline '+f.path);}
 paths=files.map(f=>f.path);
}else paths=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','src'],{encoding:'utf8'}).trim().split('\n');
const sourceHashes=()=>Object.fromEntries(paths.map(p=>[p,createHash('sha256').update(readFileSync(resolve(root,p))).digest('hex')]));
const before=sourceHashes(),seasonRows=[],dailyRows=[],seenChurn=new WeakSet(),seenTerminal=new Set();
let births=0,deaths=0,terminalRemoved=0,bodyResidual=0,rawTake=0,rawReturned=0,receiptCount=0,tripCalls=0,candidates=0,foodCandidates=0,foodTripExecutions=0;
let observedDay=0,loaded=0,executed=0;
const dayEvents=[];
globalThis.__diag2Observe=(kind,result,args)=>{
 executed++;
 if(kind==='plant'||kind==='fauna'){
  if(args[args.length-1]===true&&result.harvestedAmount>0){rawTake+=result.harvestedAmount;dayEvents.push({kind,take:result.harvestedAmount,sourceId:result.sourceId,depletion:result.depletionApplied});}
 }else if(kind==='receipt'){
  const [prev,record]=args;
  if(result!==prev&&record.physicalFoodHarvest?.usableSupport>0){rawReturned+=record.physicalFoodHarvest.usableSupport;receiptCount++;dayEvents.push({kind,usable:record.physicalFoodHarvest.usableSupport,sourceId:record.physicalFoodHarvest.sourceId});}
 }else if(kind==='food_trip'){
  if(['generic_plant_food','aquatic_food','animal_food','fallback_food'].includes(args[1]?.memory?.resourceClassId)){foodTripExecutions++;dayEvents.push({kind,bandId:args[0].id,target:result.targetTileId,harvest:result.physicalFoodHarvest??null});}
 }else if(kind==='candidate'){
  tripCalls++;if(result){candidates++;if(['generic_plant_food','aquatic_food','animal_food','fallback_food'].includes(result.memory?.resourceClassId))foodCandidates++;}
  dayEvents.push({kind,bandId:args[0].id,selected:result?{target:result.targetTileId,cause:result.cause,objective:result.objective,resourceClassId:result.memory?.resourceClassId,distanceKm:result.physicalDistanceKm}:null});
 }
};
const modules={plantStock:['resolvePlantFoodHarvest','plant'],faunaStock:['resolveFaunaFoodHarvest','fauna'],seasonalFoodReceipts:['depositFoodReceipt','receipt']};
const server=await createServer({root:resolve(root,'src'),configFile:false,cacheDir:resolve(dirname(out),`natural-cache-${tier}-${seed}-${process.pid}`),appType:'custom',server:{middlewareMode:true,hmr:false,watch:null,ws:false},logLevel:'error',plugins:[{name:'phase2-read-only-natural-observer',enforce:'pre',transform(code,id){
 for(const [module,[fn,kind]]of Object.entries(modules))if(id.endsWith(`/agents/${module}.ts`)){
  const needle=`export function ${fn}(`;assert.equal(code.split(needle).length,2,'observer target '+fn);loaded++;
  return code.replace(needle,`function ${fn}Observed(`)+`\nexport function ${fn}(...args: Parameters<typeof ${fn}Observed>): ReturnType<typeof ${fn}Observed> { const result=${fn}Observed(...args); (globalThis as any).__diag2Observe('${kind}',result,args); return result; }\n`;
 }
 if(id.endsWith('/agents/intraSeasonTrips.ts')){const needle='const candidate = selectTripCandidate(currentWorld, band, day, undefined, false, true);';assert.equal(code.split(needle).length,2,'actual daily candidate observer');loaded++;const resolved='const resolvedRecord = physicalResolution.record;';assert.equal(code.split(resolved).length,2,'resolved food trip observer');return code.replace(needle,needle+"\n(globalThis as any).__diag2Observe('candidate',candidate,[band]);").replace(resolved,resolved+"\n(globalThis as any).__diag2Observe('food_trip',resolvedRecord,[band,candidate]);");}
}}]});
const start=Date.now();let summary;
try{
 const runner=await server.ssrLoadModule('/sim/runner/simRunner.ts'),spawn=await server.ssrLoadModule('/sim/agents/spawn.ts'),mobility=await server.ssrLoadModule('/sim/agents/bandMobility.ts');
 const simSeed='diag1:'+seed;let w=runner.initSimWorld({kind:'map2'},simSeed);w=spawn.removeInitialBands(w,Object.keys(w.bands));w=spawn.spawnCustomBands(w,[{tileId:site.tileId,population:34,name:'DIAG1'}],simSeed);
 assert.equal(Object.values(w.bands).reduce((n,b)=>n+b.demography.population,0),34);
 let maxSamples=0,maxSegments=0,maxSupportBytes=0,maxMovement=0,maxCompletedSpan=0;
 for(let day=1;day<=years*360;day++){
  observedDay=day;dayEvents.length=0;w=runner.stepSim(w,1,'daily');
  const bands=[];
  for(const b of Object.values(w.bands)){
   for(const c of b.demography.demographicChurn?.records??[])if(!seenChurn.has(c)){seenChurn.add(c);births+=c.births;deaths+=c.deaths;}
   if((b.viability?.populationRemoved??0)>0&&!seenTerminal.has(b.id)){seenTerminal.add(b.id);terminalRemoved+=b.viability.populationRemoved;}
   assert.equal(b.demography.population,b.demography.workingAdults+b.demography.dependents+b.demography.elders,'cohort conservation');
   if(b.demography.population<=0)continue;
   const ledger=b.carryingCapacity?.perCapitaReturn?.supportDebug?.humanFoodLedger;
   const support=b.seasonalSupport,samples=support?.recentSamples??[],completed=samples.filter(s=>s.exposure&&!s.exposure.open);
   maxSamples=Math.max(maxSamples,samples.length);maxSegments=Math.max(maxSegments,samples.reduce((n,s)=>n+(s.exposure?.segments.length??1),0));maxSupportBytes=Math.max(maxSupportBytes,Buffer.byteLength(JSON.stringify(support??null)));maxMovement=Math.max(maxMovement,b.movementHistory.length);
   if(completed.length)maxCompletedSpan=Math.max(maxCompletedSpan,completed.at(-1).exposure.endDay-completed[0].exposure.startDay);
   const row={id:b.id,pop:b.demography.population,workers:b.demography.workingAdults,position:b.position,phase:b.provisionalSuccessor?.phase??'residential',fatigue:b.pressureState?.fatiguePressure??null,pace:mobility.deriveTravelPace(b,'resource_expedition').kmPerTravelDay,support:ledger?.totalUsableSupport??null,demand:ledger?.populationDemand??null,foodStress:support?.currentSeasonSupport.foodStress??null,experiencedStress:support?.recentFoodStress??null,tripRecords:(b.recentIntraSeasonTrips??[]).length,knowledge:Object.keys(b.knowledge.observedTiles).length};
   bands.push(row);if(day%90===0)seasonRows.push({day,...row,receiptRaw:ledger?.rawUsableHarvest??null,samples:samples.length,segments:samples.reduce((n,s)=>n+(s.exposure?.segments.length??1),0)});
  }
  const population=Object.values(w.bands).reduce((n,b)=>n+b.demography.population,0);bodyResidual=population-(34+births-deaths-terminalRemoved);assert.equal(bodyResidual,0,'world body flow');
  dailyRows.push({day,population,births,deaths,terminalRemoved,rawTake,rawReturned,receiptCount,tripCalls,candidates,foodCandidates,foodTripExecutions,bands,events:[...dayEvents]});
  if(day%360===0){writeFileSync(out+'.progress.json',JSON.stringify({day,population,runtimeMs:Date.now()-start,source:ref,tier,seed}));console.log(JSON.stringify({year:day/360,population,elapsedSeconds:Math.round((Date.now()-start)/1000)}));}
 }
 const after=sourceHashes();assert.deepEqual(after,before,'source preserved');assert.equal(loaded,4);assert.ok(executed>0);
 summary={instrumentVersion:3,auditSha256:createHash('sha256').update(readFileSync(process.argv[1])).digest('hex'),source:ref,root,tier,seed:'diag1:'+seed,startingPopulation:34,years,site,siteDescriptor:'Inherited DIAG1 site proxy, not calibrated path-feasible habitat classification',loaded,executed,rawTake,rawReturned,receiptCount,tripCalls,candidates,foodCandidates,foodTripExecutions,births,deaths,terminalRemoved,finalPopulation:dailyRows.at(-1).population,bodyResidual,bounds:{maxSamples,maxSegments,maxSupportBytes,maxMovement,maxCompletedSpan},runtimeMs:Date.now()-start,finalSnapshotHash:createHash('sha256').update(JSON.stringify(runner.takeDynamicSnapshot(w))).digest('hex'),sourceBefore:before,sourceAfter:after,restored:true,seasonRows,dailyRows};
 mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({...summary,sourceBefore:undefined,sourceAfter:undefined,seasonRows:undefined,dailyRows:undefined}));
}finally{await server.close();delete globalThis.__diag2Observe;}
