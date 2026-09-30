// Full serialized causal state, both map providers, internal modes and fresh processes.
import { createServer } from 'vite';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync,writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import assert from 'node:assert/strict';
const arg=(key,fallback)=>process.argv.includes('--'+key)?process.argv[process.argv.indexOf('--'+key)+1]:fallback;
const child=process.argv.includes('--child'),out=arg('out','artifacts/diag1-phase1/determinism.json'),span=1260;
const server=await createServer({root:process.cwd()+'/src',configFile:false,cacheDir:`node_modules/.vite-diag1-det-${process.pid}`,appType:'custom',server:{middlewareMode:true,hmr:false,watch:null,ws:false},logLevel:'error'});
const hash=w=>createHash('sha256').update(JSON.stringify(w)).digest('hex');
try {
 const runner=await server.ssrLoadModule('/sim/runner/simRunner.ts');
 const run=(kind,mode)=>runner.stepSim(runner.initSimWorld({kind},'diag1-phase1:determinism:'+kind),span/({daily:1,weekly:7,monthly:30,seasonal:90}[mode]),mode);
 if(child){process.stdout.write(hash(run(arg('map','map1'),'daily')));}
 else {
  const rows=[];
  // Default deliberately retains the cross-map same-process stress case. A
  // named map permits an isolated-map control without deleting that evidence.
  for(const kind of process.argv.includes('--map')?[arg('map')]:['map1','map2']){
   const digests={},elapsed={};let occurrence;
   for(const mode of ['daily','weekly','monthly','seasonal','repeat']){
    const start=performance.now(),w=run(kind,mode==='repeat'?'daily':mode);digests[mode]=hash(w);elapsed[mode]=(performance.now()-start)/1000;
    if(mode==='daily')occurrence={bands:Object.keys(w.bands).length,population:Object.values(w.bands).reduce((s,b)=>s+b.demography.population,0),activeParties:Object.values(w.bands).reduce((s,b)=>s+(b.expeditions??[]).length,0),returnOutcomes:Object.values(w.bands).reduce((s,b)=>s+(b.recentExpeditionOutcomes??[]).length,0),plantDepletionEntries:Object.keys(w.plantPatchState??{}).length};
   }
   digests.fresh=execFileSync(process.execPath,[process.argv[1],'--child','--map',kind],{encoding:'utf8',maxBuffer:4e6}).trim();
   rows.push({kind,seed:'diag1-phase1:determinism:'+kind,span,projection:'Entire JSON world including time, tiles, all bands, cargo, knowledge, plant/fauna state and bounded receipts',digests,elapsed,occurrence,pass:Object.values(digests).every(d=>d===digests.daily)});
   mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify({command:process.argv,rows},null,2)+'\n');console.log(kind,rows.at(-1).pass);
  }
  assert.ok(rows.every(r=>r.pass),'full serialized worlds must agree');
 }
}finally{await server.close();}
