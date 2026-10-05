// Proxy so the browser never calls Higgsfield directly (avoids CORS). Key travels in the Authorization header.
module.exports=async(req,res)=>{
  const base=process.env.HIGGSFIELD_API_BASE;
  if(!base)return res.status(500).json({error:'Set HIGGSFIELD_API_BASE on the server.'});
  const p=[].concat(req.query.path||[]).map(encodeURIComponent).join('/');
  try{
    const r=await fetch(`${base.replace(/\/$/,'')}/${p}`,{method:req.method,headers:{'content-type':'application/json',authorization:req.headers.authorization||''},
      body:req.method==='GET'?undefined:JSON.stringify(req.body),signal:AbortSignal.timeout(25000)});
    const ra=r.headers.get('retry-after');if(ra)res.setHeader('retry-after',ra);
    res.status(r.status).setHeader('content-type','application/json').send(await r.text());
  }catch{res.status(504).json({error:'Video service timed out.'})}
};
