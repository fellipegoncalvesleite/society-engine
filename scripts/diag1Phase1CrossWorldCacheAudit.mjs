// Diagnostic only: the unassigned legacy seasonal memo can reuse a different
// world's tile when both worlds share INITIAL_TIME. No production mutation.
import {createServer} from 'vite';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,existsSync,readFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
const out=process.argv[process.argv.indexOf('--out')+1];
assert.ok(process.argv.includes('--out') && out && !existsSync(out),'fresh explicit --out required');
const server=await createServer({root:process.cwd()+'/src',configFile:false,appType:'custom',server:{middlewareMode:true,hmr:false,watch:null,ws:false},logLevel:'error'});
try {
 const runner=await server.ssrLoadModule('/sim/runner/simRunner.ts'),seasonal=await server.ssrLoadModule('/sim/world/seasonal.ts');
 const first=runner.initSimWorld({kind:'map1'},'diag1-phase1:cross-world-cache'),id='tile:88:81';
 assert.ok(first.tiles[id]);
 const firstConditions=seasonal.getSeasonalTileConditions(first,first.tiles[id]);
 const second=runner.initSimWorld({kind:'map2'},'diag1-phase1:cross-world-cache');
 assert.ok(second.tiles[id]);assert.equal(first.time,second.time,'actual initial-world time identity collision');
 const warm=seasonal.getSeasonalTileConditions(second,second.tiles[id]);
 const cold=seasonal.getSeasonalTileConditions({...second,time:{...second.time}},second.tiles[id]);
 const fields=['currentFoodEstimate','currentWaterStress','currentFloodStress','currentDroughtStress','currentAquaticReliability','currentMovementDifficulty'];
 const differing=fields.filter(k=>warm[k]!==cold[k]);
 const result={kind:'INHERITED UNASSIGNED CACHE DIAGNOSTIC, NOT PHASE1 GREEN',cwd:process.cwd(),tileId:id,sharedInitialTime:first.time===second.time,firstConditions,warm,cold,differing,sourceSha256:createHash('sha256').update(readFileSync('src/sim/world/seasonal.ts')).digest('hex'),invariantHolds:differing.length===0};
 mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({differing,invariantHolds:result.invariantHolds}));
 assert.deepEqual(differing,[],'same Map2 physical inputs/time must not depend on a previous Map1 reader');
}finally{await server.close();}
