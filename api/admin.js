// Super-admin API. POST {action,...} with the admin's Supabase session token. Uses the service key.
const U=process.env.SUPABASE_URL,S=process.env.SUPABASE_SERVICE_KEY,K=process.env.SUPABASE_ANON_KEY;
const H={apikey:S,authorization:'Bearer '+S,'content-type':'application/json'};
async function rest(p,o={}){const r=await fetch(U+'/rest/v1/'+p,{...o,headers:{...H,prefer:'return=representation'}});const j=await r.json().catch(()=>null);if(!r.ok)throw new Error((j&&j.message)||'Database error');return j}
module.exports=async(req,res)=>{
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  if(!U||!S||!K)return res.status(500).json({error:'Set SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_KEY.'});
  const t=(req.headers.authorization||'').replace(/^Bearer /,'');
  const me=await fetch(U+'/auth/v1/user',{headers:{apikey:K,authorization:'Bearer '+t}}).then(r=>r.ok?r.json():null).catch(()=>null);
  if(!me)return res.status(401).json({error:'Sign in first.'});
  try{
    const [mp]=await rest(`profiles?id=eq.${me.id}&select=role`);
    if(!mp||mp.role!=='super_admin')return res.status(403).json({error:'Super admin only.'});
    const b=req.body||{},id=String(b.id||''),adj=async(uid,d,why)=>{
      const r=await fetch(U+'/rest/v1/rpc/adjust_credits',{method:'POST',headers:H,body:JSON.stringify({uid,d,why,who:me.email})});
      const j=await r.json();if(!r.ok||!(j>=0))throw new Error(j<0?'Balance cannot go below 0.':'Credit update failed');return j};
    if(!['list','create'].includes(b.action)&&!/^[0-9a-f-]{36}$/i.test(id))return res.status(400).json({error:'Bad user id.'});
    if(['block','role','delete'].includes(b.action)&&id===me.id)return res.status(400).json({error:"You can't do that to your own account."});
    switch(b.action){
      case'list':{
        const [users,log,ads]=await Promise.all([rest('profiles?select=*&order=created_at.desc&limit=1000'),rest('credit_log?select=*&order=created_at.desc&limit=100'),rest('campaigns?select=user_id&limit=10000')]);
        const n={};ads.forEach(a=>n[a.user_id]=(n[a.user_id]||0)+1);
        const em=Object.fromEntries(users.map(u=>[u.id,u.email]));
        return res.json({users,n,log:log.map(l=>({...l,email:em[l.user_id]||''}))})}
      case'create':{
        if(!b.email||String(b.password||'').length<8)return res.status(400).json({error:'Email and an 8+ character password are required.'});
        const r=await fetch(U+'/auth/v1/admin/users',{method:'POST',headers:H,body:JSON.stringify({email:b.email,password:b.password,email_confirm:true})});
        const j=await r.json();if(!r.ok)throw new Error(j.msg||j.message||'Could not create user');
        if(b.name)await rest(`profiles?id=eq.${j.id}`,{method:'PATCH',body:JSON.stringify({name:String(b.name).slice(0,80)})});
        if(Math.floor(+b.credits)>0)await adj(j.id,Math.floor(+b.credits),'Initial credits');
        return res.json({ok:true})}
      case'credit':{
        const n=Math.floor(+b.amount);if(!Number.isFinite(n)||n<0)return res.status(400).json({error:'Enter a valid number.'});
        let d=b.mode==='deduct'?-n:n;
        if(b.mode==='set'){const [p]=await rest(`profiles?id=eq.${id}&select=credits`);d=n-p.credits}
        return res.json({balance:await adj(id,d,b.note||b.mode)})}
      case'block':await rest(`profiles?id=eq.${id}`,{method:'PATCH',body:JSON.stringify({blocked:!!b.blocked})});return res.json({ok:true});
      case'role':await rest(`profiles?id=eq.${id}`,{method:'PATCH',body:JSON.stringify({role:b.role==='super_admin'?'super_admin':'user'})});return res.json({ok:true});
      case'password':{
        if(String(b.password||'').length<8)return res.status(400).json({error:'Password needs 8+ characters.'});
        const r=await fetch(`${U}/auth/v1/admin/users/${id}`,{method:'PUT',headers:H,body:JSON.stringify({password:b.password})});
        if(!r.ok)throw new Error('Could not change password');return res.json({ok:true})}
      case'delete':{const r=await fetch(`${U}/auth/v1/admin/users/${id}`,{method:'DELETE',headers:H});if(!r.ok)throw new Error('Could not delete user');return res.json({ok:true})}
      default:return res.status(400).json({error:'Unknown action.'})}
  }catch(e){res.status(500).json({error:e.message})}
};
