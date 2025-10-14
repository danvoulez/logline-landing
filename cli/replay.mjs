import fs from 'fs';
function parseNDJSON(path){return fs.readFileSync(path,'utf8').split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));}
function applyPatch(state, pre, post){return { ...post };}
export function replay(path){
  const spans=parseNDJSON(path).sort((a,b)=> new Date(a.timestamp)-new Date(b.timestamp));
  let state={}; let prevHash=null; const stats={total:0,committed:0,rejected:0};
  for(const s of spans){
    stats.total++;
    if(prevHash && s.pre_state_hash && s.pre_state_hash !== prevHash){ console.error(`STATE_CONFLICT em span ${s.span_id}`); continue; }
    if(s.receipt?.status==='committed'){ state=applyPatch(state,s.pre_state,s.post_state); stats.committed++; prevHash=s.post_state_hash||prevHash; }
    else { stats.rejected++; }
  }
  return { state, stats };
}
if (process.argv[1] && process.argv[1].endsWith('replay.mjs')){
  const p=process.argv[2]||'./ledger.ndjson'; console.log(JSON.stringify(replay(p),null,2));
}