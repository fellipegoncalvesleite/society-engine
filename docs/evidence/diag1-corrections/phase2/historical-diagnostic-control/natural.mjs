import {createServer} from '/Users/fellipegoncalvesleite/.worktrees/society-engine-world-m0-m01-integration-freeze/node_modules/vite/dist/node/index.js';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const repo='/Users/fellipegoncalvesleite/.worktrees/society-engine-world-m0-m01-integration-freeze';
const here='/Users/fellipegoncalvesleite/Documents/Codex/2026-09-29/files-mentioned-by-the-user-society-2';
const [tier='exceptionally_rich',seed='s1',popText='34',yearsText='30',mode='actual']=process.argv.slice(2);
const pop=Number(popText),years=Number(yearsText);
const sites=JSON.parse(readFileSync(here+'/work/diag1/sites.json','utf8')).map2;
const server=await createServer({root:repo+'/src',cacheDir:here+'/work/diag1/vite-cache',plugins:mode==='cache_fresh'?[{name:'diag1-isolate-year-cache',enforce:'pre',transform(code,id){if(!id.endsWith('/sim/agents/plantStock.ts'))return;const needle='const cached = bySeasonMemo.get(time.season);';if(code.split(needle).length!==2)throw Error('Cache isolation did not match exactly once');return {code:code.replace(needle,'const cached = undefined; // DIAG1 in-memory no-cache counterfactual'),map:null};}}]:mode==='fatigue_off'?[{name:'diag1-isolate-movement-fatigue',enforce:'pre',transform(code,id){if(!id.endsWith('/sim/agents/pressure.ts'))return;const needle='return clamp01(recentMovementCount / 5);';if(code.split(needle).length!==2)throw Error('Fatigue isolation did not match exactly once');return {code:code.replace(needle,'return 0; // DIAG1 isolate entire movement-fatigue contribution; not a proposed fix'),map:null};}}]:[],configFile:false,appType:'custom',server:{middlewareMode:true,hmr:false},logLevel:'error'});
const started=Date.now();
try {
 const runner=await server.ssrLoadModule('/sim/runner/simRunner.ts');
 const spawn=await server.ssrLoadModule('/sim/agents/spawn.ts');
 const receipts=await server.ssrLoadModule('/sim/agents/seasonalFoodReceipts.ts');
 // Identical seed string across tiers and population arms. Placement is the varied input;
 // subsequent causal trajectories (including moving away) remain unrestricted production.
 const simSeed='diag1:'+seed;
 let world=runner.initSimWorld({kind:'map2'},simSeed);
 world=spawn.removeInitialBands(world,Object.keys(world.bands));
 world=spawn.spawnCustomBands(world,[{tileId:sites.sites[tier].tileId,population:pop,name:'DIAG1'}],simSeed);
 const founderId=Object.keys(world.bands)[0]; if(!founderId)throw Error('No founder');
 const rows=[],seenChurn=new Set(),seenTerminal=new Set();
 let births=0,deaths=0,terminalRemoved=0,cohortErrors=0;
 for(let s=1;s<=years*4;s++){
   world=runner.stepSim(world,1,'seasonal',undefined,mode==='adequate'?{foodMode:'canonically_adequate'}:undefined);
   for(const b of Object.values(world.bands)){
     for(const c of b.demography.demographicChurn?.records??[]){const key=b.id+':'+c.year;if(!seenChurn.has(key)){seenChurn.add(key);births+=c.births;deaths+=c.deaths;}}
     if((b.viability?.populationRemoved??0)>0&&!seenTerminal.has(b.id)){seenTerminal.add(b.id);terminalRemoved+=b.viability.populationRemoved;}
     const d=b.demography;if(d.population!==d.workingAdults+d.dependents+d.elders)cohortErrors++;
     if(d.population<=0||b.viability?.status==='absorbed')continue;
     const ledger=b.carryingCapacity?.perCapitaReturn?.supportDebug?.humanFoodLedger;
     const acc=receipts.readFreshAccumulator(b.seasonalFoodReceipts,world.time.tick);
     rows.push({s,year:Number(world.time.year),season:world.time.season,tick:Number(world.time.tick),id:b.id,pop:d.population,adults:d.workingAdults,pos:b.position,
       ratio:ledger?.rawSupportRatio??null,demand:ledger?.populationDemand??null,support:ledger?.totalUsableSupport??null,rawHarvest:ledger?.rawUsableHarvest??null,
       sourceTick:ledger?.sourceSeasonTick??null,receipts:acc?.receiptCount??0,accRaw:acc?.totalUsableSupport??0,
       plant:acc?.physicalPlantHarvest??0,fauna:acc?.physicalFaunaHarvest??0,aquatic:acc?.aquaticHarvest??0,
       transportLoss:acc?.transportLoss??0,processingLoss:acc?.processingLoss??0,
       hunger:b.seasonalSupport?.hungerClassification??null,foodStress:b.seasonalSupport?.currentSeasonSupport?.foodStress??null,
       waterStress:b.seasonalSupport?.currentSeasonSupport?.waterStress??null,deficitStreak:b.seasonalSupport?.chronicDeficitStreak??null,
       extinctionScore:b.viability?.extinctionRisk??null,rate:d.netDemographicRate??null,fertility:d.fertilityPressure,mortality:d.mortalityPressure,
       knowledge:Object.keys(b.knowledge.observedTiles).length,decision:world.decisions?.[b.id]?.action??null});
   }
 }
 const living=Object.values(world.bands).filter(b=>b.demography.population>0&&b.viability?.status!=='absorbed');
 const endPopulation=living.reduce((a,b)=>a+b.demography.population,0);
 const summarize=xs=>{const numeric=(k)=>xs.map(r=>r[k]).filter(v=>typeof v==='number');const avg=k=>{const a=numeric(k);return a.length?a.reduce((s,v)=>s+v,0)/a.length:null;};return {bandSeasons:xs.length,meanRatio:avg('ratio'),meanSupport:avg('support'),meanDemand:avg('demand'),pooledSupportDemand:numeric('support').reduce((a,b)=>a+b,0)/Math.max(1e-12,numeric('demand').reduce((a,b)=>a+b,0)),deficitSeasons:xs.filter(r=>r.ratio!==null&&r.ratio<0.92).length,zeroSeasons:xs.filter(r=>r.ratio===0).length,meanExtinctionScore:avg('extinctionScore'),meanWaterStress:avg('waterStress'),creditedReceipts:xs.reduce((a,r)=>a+r.receipts,0),plantRaw:xs.reduce((a,r)=>a+r.plant,0),faunaRaw:xs.reduce((a,r)=>a+r.fauna,0),aquaticRaw:xs.reduce((a,r)=>a+r.aquatic,0)};};
 const out={source:'73cc38b916e236339897c59686638efafd569b6e',tier,seed:simSeed,pop,years,mode,site:sites.sites[tier],siteDescriptorWarning:'Inherited Manhattan radius-10 plant proxy; not measured path-feasible support nor empirical habitat class.',founderId,endPopulation,livingBands:living.length,births,deaths,terminalRemoved,bodyConservation:pop+births-deaths-terminalRemoved===endPopulation,cohortErrors,all:summarize(rows),startup:summarize(rows.filter(r=>r.s<=8)),later:summarize(rows.filter(r=>r.s>8)),rows,finalBands:Object.values(world.bands).map(b=>({id:b.id,pop:b.demography.population,viability:b.viability,deepHistory:b.deepHistory})),fingerprint:createHash('sha256').update(JSON.stringify(runner.takeDynamicSnapshot(world))).digest('hex'),runtimeMs:Date.now()-started};
 const path=here+`/outputs/DIAG1/evidence/natural-${tier}-${seed}-p${pop}-y${years}-${mode}${process.env.DIAG1_TAG??''}.json`;
 writeFileSync(path,JSON.stringify(out,null,2));console.log(JSON.stringify({...out,rows:undefined,finalBands:undefined,path}));
}finally{await server.close();}
