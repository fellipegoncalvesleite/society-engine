// Cross-world physical-input isolation. All mutations are in-memory Vite overlays.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
const arg=(k,d)=>process.argv.includes('--'+k)?process.argv[process.argv.indexOf('--'+k)+1]:d;
const out=arg('out'),mutant=arg('mutant','none'),child=process.argv.includes('--child');
assert.ok(child || (out && !existsSync(out)), 'fresh explicit --out required');
const paths=['src/sim/world/seasonal.ts','src/sim/world/hydrography.ts'];
const hashes=()=>Object.fromEntries(paths.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]));
const before=hashes(),rows=[],observations={};let loaded=0;
globalThis.__diag1bHits=0;
const entries={tile:['seasonal','getSeasonalTileConditions'],crossing:['hydrography','getSeasonalRiverCrossingState'],movement:['hydrography','getRiverCrossingForMovement']};
const server=await createServer({root:resolve('src'),configFile:false,cacheDir:resolve(`node_modules/.vite-diag1b-${process.pid}`),appType:'custom',server:{middlewareMode:true,hmr:false,watch:null,ws:false},logLevel:'error',plugins:[{name:'old-world-blind-cache',enforce:'pre',transform(code,id){
 if(mutant==='none'||!id.endsWith(`/world/${entries[mutant][0]}.ts`))return;
 code=execFileSync('git',['show',`d5fc9f5:src/sim/world/${entries[mutant][0]}.ts`],{encoding:'utf8'});
 const start=code.indexOf(`export function ${entries[mutant][1]}(`),body=code.indexOf('{',code.indexOf('):',start));
 assert.ok(start>=0&&body>start,'mutant target exists');loaded++;
 return code.slice(0,body+1)+'\n(globalThis as any).__diag1bHits++;'+code.slice(body+1);
}}]});
const check=(name,fn)=>{try{fn();rows.push({name,pass:true});}catch(e){rows.push({name,pass:false,error:e.message});}};
try{
 const generate=await server.ssrLoadModule('/sim/world/generate.ts');
 const tile=await server.ssrLoadModule('/sim/world/seasonal.ts');
 const hydro=await server.ssrLoadModule('/sim/world/hydrography.ts');
 const id='tile:1:1';
 // Small complete generated worlds keep mutant execution focused. The original
 // full Map1/Map2 witness is retained and rerun by diag1Phase1CrossWorldCacheAudit.
 const river={riverId:'river:fixture',kind:'shallow_braided',widthClass:'narrow',depthClass:'shallow',flowStrength:'weak',bankSteepness:.1,seasonalFlowVariance:.8,floodSeason:'spring',fordability:.8,navigability:.2,aquaticReliabilityModifier:.1,floodplainFertilityModifier:.2,crossingRisk:.1};
 const crossing={fromTileId:id,toTileId:'tile:2:1',riverId:river.riverId,crossingClass:'ford',baseCrossingCost:2,seasonalCostModifier:.3,risk:.2,knownFord:true,confidence:1};
 const make=(seed,water)=>{const w=generate.createWorld({...generate.DEFAULT_WORLD_CONFIG,width:4,height:4},seed);const t=w.tiles[id];return {...w,tiles:{...w.tiles,[id]:{...t,riverSegmentId:river.riverId,resourceProfile:{...t.resourceProfile,waterAccess:water}}},rivers:{[river.riverId]:river},riverCrossings:{[hydro.makeRiverCrossingKey(crossing.fromTileId,crossing.toTileId)]:crossing}};};
 const originalA=make('diag1b:a',.1),originalB=make('diag1b:b',.9);
 assert.equal(originalA.time,originalB.time,'natural INITIAL_TIME collision');
 const cap={canUseFords:true,canUseShallowCrossings:false,canAttemptBasicRaftCrossing:false};
 for(const reverse of [false,true]){
  const time={...originalA.time};
  const a={...(reverse?originalB:originalA),time},b={...(reverse?originalA:originalB),time};
  const label=reverse?'B-A':'A-B';
  const first=tile.getSeasonalTileConditions(a,a.tiles[id]);
  const warm=tile.getSeasonalTileConditions(b,b.tiles[id]);
  const cold=tile.getSeasonalTileConditions({...b,time:{...time}},b.tiles[id]);
  observations['tile-'+label]={first,warm,cold};
  check('tile '+label+' distinct physical inputs',()=>assert.notDeepEqual(first,cold));
  check('tile '+label+' every field warm equals cold',()=>assert.deepEqual(warm,cold));
  check('tile '+label+' same-world cached retrieval',()=>assert.equal(tile.getSeasonalTileConditions(b,b.tiles[id]),warm));
  const crossing=Object.values(a.riverCrossings)[0];assert.ok(crossing,'physical crossing fixture');
  const changed={...crossing,baseCrossingCost:crossing.baseCrossingCost+9,risk:.91,seasonalCostModifier:.8};
  const river=a.rivers[crossing.riverId];assert.ok(river,'physical river fixture');
  const c1={...a,rivers:{...a.rivers,[river.riverId]:{...river,floodSeason:time.season,crossingRisk:.1}}};
  const c2={...a,rivers:{...a.rivers,[river.riverId]:{...river,floodSeason:'winter',crossingRisk:.9}}};
  const pair=reverse?[[c2,changed],[c1,crossing]]:[[c1,crossing],[c2,changed]];
  const prior=hydro.getSeasonalRiverCrossingState(...pair[0],cap);
  const got=hydro.getSeasonalRiverCrossingState(...pair[1],cap);
  const expected=hydro.getSeasonalRiverCrossingState({...pair[1][0],time:{...time}},pair[1][1],cap);
  observations['crossing-'+label]={prior,warm:got,cold:expected};
  check('crossing '+label+' distinct physical inputs',()=>assert.notDeepEqual(prior,expected));
  check('crossing '+label+' every field warm equals cold',()=>assert.deepEqual(got,expected));
  check('crossing '+label+' same-world cached retrieval',()=>assert.equal(hydro.getSeasonalRiverCrossingState(...pair[1],cap),got));
  const key=hydro.makeRiverCrossingKey(crossing.fromTileId,crossing.toTileId);
  const m1={...a,tiles:{...a.tiles},riverCrossings:{...a.riverCrossings,[key]:crossing}};
  const m2={...m1,riverCrossings:{...m1.riverCrossings,[key]:changed}};
  const mp=reverse?[m2,m1]:[m1,m2];
  const read=w=>hydro.getRiverCrossingForMovement(w,crossing.fromTileId,crossing.toTileId);
  const p=read(mp[0]),g=read(mp[1]),e=read({...mp[1],tiles:{...mp[1].tiles}});
  observations['movement-'+label]={prior:p,warm:g,cold:e};
  check('movement '+label+' different crossing container with shared tiles',()=>assert.notDeepEqual(p,e));
  check('movement '+label+' warm equals cold',()=>assert.deepEqual(g,e));
  check('movement '+label+' same-world cached retrieval',()=>assert.equal(read(mp[1]),g));
 }
 // Sharing the exact tile/crossing object is legal when another immutable
 // physical input changes. These controls require the outer world-owned key.
 const sharedTime={...originalA.time},sharedTile=originalA.tiles[id];
 const sharedCrossing=Object.values(originalA.riverCrossings)[0];
 const riverWorldA={...originalA,time:sharedTime};
 const riverWorldB={...riverWorldA,rivers:{...riverWorldA.rivers,[sharedCrossing.riverId]:{...riverWorldA.rivers[sharedCrossing.riverId],floodSeason:'winter',crossingRisk:.95,aquaticReliabilityModifier:-.5}}};
 const sharedTileFirst=tile.getSeasonalTileConditions(riverWorldA,sharedTile);
 const sharedTileWarm=tile.getSeasonalTileConditions(riverWorldB,sharedTile);
 const sharedTileCold=tile.getSeasonalTileConditions({...riverWorldB,time:{...sharedTime}},sharedTile);
 check('tile shared object changed river is causal',()=>assert.notDeepEqual(sharedTileFirst,sharedTileCold));
 check('tile shared object changed river warm equals cold',()=>assert.deepEqual(sharedTileWarm,sharedTileCold));
 const sharedCrossingFirst=hydro.getSeasonalRiverCrossingState(riverWorldA,sharedCrossing,cap);
 const sharedCrossingWarm=hydro.getSeasonalRiverCrossingState(riverWorldB,sharedCrossing,cap);
 const sharedCrossingCold=hydro.getSeasonalRiverCrossingState({...riverWorldB,time:{...sharedTime}},sharedCrossing,cap);
 check('crossing shared object changed river is causal',()=>assert.notDeepEqual(sharedCrossingFirst,sharedCrossingCold));
 check('crossing shared object changed river warm equals cold',()=>assert.deepEqual(sharedCrossingWarm,sharedCrossingCold));
 // Same world/time, distinct actual input objects: IDs are labels, not input identity.
 const w={...originalA,time:{...originalA.time}},t=w.tiles[id];
 const first=tile.getSeasonalTileConditions(w,t),t2={...t,movementCost:t.movementCost+10};
 const second=tile.getSeasonalTileConditions(w,t2),cold=tile.getSeasonalTileConditions({...w,time:{...w.time}},t2);
 check('tile object replacement warm equals cold',()=>assert.deepEqual(second,cold));
 check('tile object replacement is causal',()=>assert.notDeepEqual(first,cold));
 const c=Object.values(w.riverCrossings)[0],c2={...c,baseCrossingCost:c.baseCrossingCost+10};
 hydro.getSeasonalRiverCrossingState(w,c,cap);
 check('crossing object replacement warm equals cold',()=>assert.deepEqual(hydro.getSeasonalRiverCrossingState(w,c2,cap),hydro.getSeasonalRiverCrossingState({...w,time:{...w.time}},c2,cap)));
 const after=hashes();check('source byte preservation',()=>assert.deepEqual(after,before));
 if(child){console.log(JSON.stringify(observations));}
 else{
  if(mutant==='none'){
   const fresh=JSON.parse(execFileSync(process.execPath,[process.argv[1],'--child'],{encoding:'utf8',maxBuffer:4e6}));
   check('fresh-process parity',()=>assert.deepEqual(observations,fresh));
  }else{
   check('mutant loaded and executed',()=>assert.ok(loaded>0&&globalThis.__diag1bHits>0));
  }
  const detected=rows.some(r=>!r.pass&&r.name.includes('warm equals cold')&&(mutant==='none'||r.name.startsWith(mutant+' ')));
  const result={auditSha256:createHash('sha256').update(readFileSync(process.argv[1])).digest('hex'),head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),mutant,loaded,executed:globalThis.__diag1bHits,behaviorallyDetected:detected,restored:JSON.stringify(before)===JSON.stringify(after),sourceBefore:before,sourceAfter:after,rows,observations,pass:rows.every(r=>r.pass)};
  mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({mutant,loaded,executed:result.executed,detected,passed:rows.filter(r=>r.pass).length,total:rows.length,failed:rows.filter(r=>!r.pass).map(r=>r.name)}));
  if(!result.pass)process.exitCode=1;
 }
}finally{await server.close();delete globalThis.__diag1bHits;}
