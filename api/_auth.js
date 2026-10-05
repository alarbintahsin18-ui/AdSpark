// Verifies the Supabase session, blocks suspended users, and charges `cost` credits atomically (super admins are free).
module.exports=async function requireUser(req,res,cost=0,why='usage'){
  const U=process.env.SUPABASE_URL,K=process.env.SUPABASE_ANON_KEY,S=process.env.SUPABASE_SERVICE_KEY,t=(req.headers.authorization||'').replace(/^Bearer /,'');
  if(!U||!K||!S){res.status(500).json({error:'Set SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_KEY on the server.'});return null}
  if(!t){res.status(401).json({error:'Please sign in first.'});return null}
  try{
    const r=await fetch(U+'/auth/v1/user',{headers:{apikey:K,authorization:'Bearer '+t},signal:AbortSignal.timeout(5000)});
    if(!r.ok){res.status(401).json({error:'Your session expired. Sign in again.'});return null}
    const u=await r.json(),h={apikey:S,authorization:'Bearer '+S,'content-type':'application/json'};
    const p=(await (await fetch(`${U}/rest/v1/profiles?id=eq.${u.id}&select=role,blocked`,{headers:h})).json())[0];
    if(!p||p.blocked){res.status(403).json({error:'Your account is suspended. Contact the admin.'});return null}
    if(cost>0&&p.role!=='super_admin'){
      const b=await (await fetch(U+'/rest/v1/rpc/adjust_credits',{method:'POST',headers:h,body:JSON.stringify({uid:u.id,d:-cost,why,who:'system'})})).json();
      if(!(b>=0)){res.status(402).json({error:`Not enough credits (this needs ${cost}). Ask the admin to top up.`});return null}
    }
    return u;
  }catch{res.status(502).json({error:'Could not verify your session.'});return null}
};
