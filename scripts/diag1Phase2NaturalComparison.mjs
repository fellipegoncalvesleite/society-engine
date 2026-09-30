import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const arg=(key,fallback)=>process.argv.includes('--'+key)?process.argv[process.argv.indexOf('--'+key)+1]:fallback;
const dir=arg('dir','docs/evidence/diag1-corrections/phase2/natural'),out=arg('out');assert.ok(out&&!existsSync(out));
const rows=[];
const storedFile=f=>existsSync(f)?f:f+'.gz';
const readRun=f=>JSON.parse(f.endsWith('.gz')?gunzipSync(readFileSync(f)):readFileSync(f));
const sum=(xs,k)=>xs.reduce((n,x)=>n+(x[k]??0),0);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function metrics(run,start=0,end=run.years*360){
 const seasons=run.seasonRows.filter(x=>x.day>start&&x.day<=end),days=run.dailyRows.filter(x=>x.day>start&&x.day<=end);
 const first=run.dailyRows.find(x=>x.day===start),last=days.at(-1),counter=k=>(last?.[k]??0)-(first?.[k]??0);
 assert.ok(days.flatMap(d=>d.bands).every(b=>b.phase==='residential'),'natural accounting assumes observed resident-only courses');
 const bands=days.flatMap(d=>d.bands);
 return {physicalFoodTaken:counter('rawTake'),returnedUsableRawFood:counter('rawReturned'),support:sum(seasons,'support'),integratedDemand:sum(seasons,'demand'),
  experiencedStressDayEquivalents:sum(seasons,'foodStress')*90,stressCoverageDays:seasons.filter(s=>s.foodStress!==null).length*90,
  meanPaceKmPerTravelDay:sum(bands,'pace')/bands.length,meanMovementAndOtherFatigue:sum(bands,'fatigue')/bands.length,
  candidateCalls:counter('tripCalls'),selectedCandidates:counter('candidates'),selectedFoodCandidates:counter('foodCandidates'),foodTripExecutions:counter('foodTripExecutions'),
  zeroFoodSeasons:seasons.filter(s=>s.support===0).length,measuredSeasons:seasons.length,
  births:counter('births'),deaths:counter('deaths'),terminalRemoved:counter('terminalRemoved'),population:last.population};
}
for(const tier of ['good','exceptionally_rich'])for(const seed of ['s1','s2','s3']){
 const baselineFile=storedFile(`${dir}/baseline-v3-${tier}-${seed}.json`),candidateFile=storedFile(`${dir}/${arg('candidate-prefix','phase2-final3')}-${tier}-${seed}.json`);
 const a=readRun(baselineFile),b=readRun(candidateFile);
 for(const key of ['tier','seed','site','years','startingPopulation'])assert.deepEqual(a[key],b[key]);
 assert.equal(a.source,'d8c6233872b6bcb76da5fe6c3747c889ec402eb9');assert.ok(a.restored&&b.restored);assert.equal(a.bodyResidual,0);assert.equal(b.bodyResidual,0);
 const firstMetric={};
 for(const k of ['fatigue','pace','support','demand','foodStress','experiencedStress','population','rawTake','rawReturned','candidates','foodCandidates','foodTripExecutions','births','deaths']){
  for(let i=0;i<a.dailyRows.length;i++){
   const left=a.dailyRows[i],right=b.dailyRows[i];
   const av=k in left?left[k]:left.bands[0]?.[k],bv=k in right?right[k]:right.bands[0]?.[k];
   if(!same(av,bv)){firstMetric[k]={day:left.day,baseline:av,candidate:bv,baselinePosition:left.bands[0]?.position,candidatePosition:right.bands[0]?.position};break;}
  }
 }
 const firstAction=a.dailyRows.findIndex((d,i)=>!same(d.events,b.dailyRows[i].events));
 rows.push({tier,seed,baselineFile,candidateFile,baseline:metrics(a),candidate:metrics(b),firstMetricDivergence:firstMetric,
  firstObservedActionDivergence:firstAction<0?null:{day:a.dailyRows[firstAction].day,baseline:a.dailyRows[firstAction],candidate:b.dailyRows[firstAction]},
  years2to6:tier==='good'?Array.from({length:5},(_,i)=>({year:i+2,baseline:metrics(a,(i+1)*360,(i+2)*360),candidate:metrics(b,(i+1)*360,(i+2)*360)})):undefined,
  bounds:{baseline:a.bounds,candidate:b.bounds},runtimeMs:{baseline:a.runtimeMs,candidate:b.runtimeMs},bodyResidual:{baseline:a.bodyResidual,candidate:b.bodyResidual},
  finalSnapshotHash:{baseline:a.finalSnapshotHash,candidate:b.finalSnapshotHash}});
}
const result={baseline:'d8c6233872b6bcb76da5fe6c3747c889ec402eb9',candidate:'sourceBefore/sourceAfter in each final run',
 notes:['Population is an observation, never a pass condition.','Site labels are inherited DIAG1 proxies, not calibrated habitat classes.','These six executed courses remained residential: F4/provisional occurrence is proven separately by controlled actual-source lifecycle audits.','Experienced stress here integrates the represented90-day resident measurements at season boundaries, not invented historical daily detail.','Elapsed runtimes include concurrent load and are not an isolated benchmark.','First divergence is reported explicitly; initial pressure absence and unrelated condition fields are preserved by focused guards.'],rows};
writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(rows.map(r=>({tier:r.tier,seed:r.seed,baseline:r.baseline,candidate:r.candidate,first:r.firstMetricDivergence}))));
