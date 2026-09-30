import os,subprocess,json,time,hashlib
from pathlib import Path
root=Path(__file__).resolve().parent;snapshot=root/'snapshot'; evidence=root/'evidence'
env={**os.environ,'GIT_DIR':'/Users/fellipegoncalvesleite/society-engine/.git/worktrees/diag1-human-support','GIT_OPTIONAL_LOCKS':'0'}
node='/opt/homebrew/bin/node'
base=['scripts/diag1Phase1BCacheAudit.mjs']; core=['scripts/diag1Phase1ConservationAudit.mjs']
jobs=[('cache',base),*[(f'cache-mutant-{m}',base+['--mutant',m]) for m in ['tile','crossing','movement']],('core',core),('provenance',core+['--scope','provenance']),*[(f'core-mutant-{m}',core+['--scope',s,'--mutant',m]) for m,s in [('cargo','cargo'),('absorption','absorption'),('cache','cache'),('labor','labor')]]]
for name,args in jobs:
 cmd=[node,*args,'--out',str(evidence/(name+'.json'))]; start=time.time()
 with open(evidence/(name+'.log'),'w') as f: p=subprocess.run(cmd,cwd=snapshot,env=env,stdout=f,stderr=subprocess.STDOUT)
 metadata={'command':cmd,'cwd':str(snapshot),'exitCode':p.returncode,'seconds':time.time()-start,'exactHead':'d8c6233872b6bcb76da5fe6c3747c889ec402eb9'}
 (evidence/(name+'-command.json')).write_text(json.dumps(metadata,indent=2)+'\n')
 print(json.dumps(metadata),flush=True)
