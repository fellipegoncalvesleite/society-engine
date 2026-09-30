import { phase2Mutation } from './diag1Phase2Mutants.mjs';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export async function phase2Harness(audit, plugins = []) {
  const arg=(k,d)=>process.argv.includes('--'+k)?process.argv[process.argv.indexOf('--'+k)+1]:d;
  const out=arg('out'),mutant=arg('mutant','none'),mutation=phase2Mutation(mutant);
  assert.ok(out && !existsSync(out), 'fresh explicit --out required');
  const paths=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','src'],{encoding:'utf8'}).trim().split('\n');
  const hashes=()=>Object.fromEntries(paths.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]));
  const before=hashes(),rows=[],observations={};
  const server=await createServer({root:resolve('src'),configFile:false,cacheDir:resolve(`node_modules/.vite-phase2-${process.pid}`),appType:'custom',server:{middlewareMode:true,hmr:false,watch:null,ws:false},logLevel:'error',plugins:[mutation.plugin,...plugins]});
  const check=(name,fn)=>{try{fn();rows.push({name,pass:true});}catch(e){rows.push({name,pass:false,error:e.message});}};
  return {arg,rows,observations,check,loadModule:p=>server.ssrLoadModule(p),load:p=>server.ssrLoadModule(`/sim/${p}.ts`),async finish(extra={}){
    const after=hashes();check('production source byte preservation',()=>assert.deepEqual(after,before));
    const loaded=mutation.loaded,executed=globalThis.__diag2MutantHits;
    if(mutant!=='none')check('mutant target loaded and actually executed',()=>{assert.ok(Object.keys(loaded).length>0);for(const key of Object.keys(loaded))assert.ok(executed[key]>0,key);});
    const result={audit,mutant,loaded,executed,behaviorallyDetected:mutant!=='none'&&rows.some(r=>!r.pass&&r.name!=='mutant target loaded and actually executed'),head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceBefore:before,sourceAfter:after,restored:JSON.stringify(before)===JSON.stringify(after),...extra,rows,observations,pass:rows.every(r=>r.pass)};
    mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(result,null,2)+'\n');
    console.log(JSON.stringify({audit,mutant,loaded,executed,...extra,passed:rows.filter(r=>r.pass).length,total:rows.length,failed:rows.filter(r=>!r.pass).map(r=>({name:r.name,error:r.error.slice(0,260)}))}));
    await server.close();if(!result.pass)process.exitCode=1;
  }};
}
