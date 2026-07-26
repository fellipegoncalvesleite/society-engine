// CORRECTION-21 §18 — post-repair five-seed matrix, enabled vs disabled, both maps.
import { createServer } from "vite";
const server = await createServer({ root: `${process.cwd()}/src`, configFile: false, appType: "custom", server: { middlewareMode: true }, logLevel: "error" });
try {
  const runner = await server.ssrLoadModule("/sim/runner/simRunner.ts");
  const out = [];
  for (const map of ["map1","map2"]) {
    for (const seed of ["c18:a","c18:b","c18:c","c18:d","c18:e"]) {
      for (const en of [true,false]) {
        let w = runner.initSimWorld({ kind: map }, seed);
        if (!en) w = { ...w, auditOptions: { ...(w.auditOptions??{}), frontierExplorationEnabled: false } };
        let sup=0,n=0,ba=0,fis=0,ff=null,prev=new Set(Object.keys(w.bands));
        for (let y=1;y<=300;y++){
          w=runner.stepSim(w,4,"seasonal");
          const now=new Set(Object.keys(w.bands));
          for(const id of now) if(!prev.has(id)){fis++; if(ff===null)ff=y;}
          prev=now;
          for(const b of Object.values(w.bands)){ba++;const sd=b.carryingCapacity?.perCapitaReturn?.supportDebug; if(sd){sup+=sd.rawSupportRatio??0;n++;}}
        }
        const bands=Object.values(w.bands);
        const pop=bands.reduce((s,b)=>s+b.demography.population,0);
        out.push({map,seed,en,pop,bands:bands.length,ppb:pop/bands.length,sup:sup/Math.max(1,n),fis,ff});
        console.log(`[${map}][${seed}][${en?"ON ":"OFF"}] pop=${pop} bands=${bands.length} pop/band=${(pop/bands.length).toFixed(2)} support=${(sup/Math.max(1,n)).toFixed(4)} fis=${fis}@y${ff??"-"}`);
      }
    }
  }
  for (const map of ["map1","map2"]) {
    const on=out.filter(r=>r.map===map&&r.en), off=out.filter(r=>r.map===map&&!r.en);
    const m=(a,k)=>a.reduce((s,v)=>s+v[k],0)/a.length;
    const lower=on.filter((v,i)=>v.pop<off[i].pop).length;
    console.log(`${map}: pop ON=${m(on,'pop').toFixed(1)} OFF=${m(off,'pop').toFixed(1)} delta=${(m(on,'pop')-m(off,'pop')).toFixed(1)} (${(((m(on,'pop')-m(off,'pop'))/m(off,'pop'))*100).toFixed(2)}%) | pop/band ${m(on,'ppb').toFixed(2)}/${m(off,'ppb').toFixed(2)} | support ${m(on,'sup').toFixed(4)}/${m(off,'sup').toFixed(4)} | bands ${m(on,'bands').toFixed(1)}/${m(off,'bands').toFixed(1)} | fis ${m(on,'fis').toFixed(1)}/${m(off,'fis').toFixed(1)} first y${m(on,'ff').toFixed(0)}/y${m(off,'ff').toFixed(0)} | seedsLower ${lower}/${on.length}`);
  }
} finally { await server.close(); }
