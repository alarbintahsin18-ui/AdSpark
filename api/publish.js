// POST -> creates Campaign > Ad Set > Creative > Ad via Meta Marketing API (paused by default).
const G=`https://graph.facebook.com/${process.env.META_GRAPH_VERSION||'v23.0'}`;
const CTAS=['SHOP_NOW','LEARN_MORE','SIGN_UP','ORDER_NOW','CONTACT_US','GET_OFFER'];
async function call(path,token,body,method='POST'){
  const r=await fetch(G+path,{method,headers:{'content-type':'application/json',authorization:'Bearer '+token},body:method==='POST'?JSON.stringify(body):undefined});
  const j=await r.json();
  if(j.error){const e=new Error(j.error.error_user_msg||j.error.message);e.code=j.error.code;throw e}
  return j;
}
module.exports=async(req,res)=>{
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  if(!await require('./_auth')(req,res))return;
  const b=req.body||{};
  if(!b.token||!b.page||!b.link||!b.account)return res.status(400).json({error:'Token, ad account, Page ID and landing link are required.'});
  const acct='act_'+String(b.account).replace(/\D/g,''),status=b.active?'ACTIVE':'PAUSED';
  const cta=CTAS.includes(b.cta)?b.cta:'SHOP_NOW',nm=`${b.name||'AdSpark'} ${new Date().toISOString().slice(0,10)}`;
  try{
    const camp=await call(`/${acct}/campaigns`,b.token,{name:nm,objective:'OUTCOME_TRAFFIC',status,special_ad_categories:[]});
    const set=await call(`/${acct}/adsets`,b.token,{name:nm,campaign_id:camp.id,daily_budget:Math.round((+b.budget||500)*100),
      billing_event:'IMPRESSIONS',optimization_goal:'LINK_CLICKS',bid_strategy:'LOWEST_COST_WITHOUT_CAP',destination_type:'WEBSITE',
      targeting:{geo_locations:{countries:[b.country||'BD']},age_min:18,age_max:55},status});
    let spec;
    if(b.video){
      if(!b.image)return res.status(400).json({error:'Video ads need a thumbnail. Analyze a page that has a preview image.'});
      const v=await call(`/${acct}/advideos`,b.token,{file_url:b.video});
      let ready=false;
      for(let i=0;i<8&&!ready;i++){await new Promise(r=>setTimeout(r,4000));ready=(await call(`/${v.id}?fields=status`,b.token,null,'GET')).status?.video_status==='ready'}
      if(!ready)return res.status(202).json({error:`Video is still processing at Meta. Campaign ${camp.id} was created; try publishing again in a minute.`});
      spec={page_id:b.page,video_data:{video_id:v.id,image_url:b.image,message:b.body,title:b.headline,call_to_action:{type:cta,value:{link:b.link}}}};
    }else spec={page_id:b.page,link_data:{link:b.link,message:b.body,name:b.headline,picture:b.image||undefined,call_to_action:{type:cta}}};
    const cr=await call(`/${acct}/adcreatives`,b.token,{name:nm,object_story_spec:spec});
    const ad=await call(`/${acct}/ads`,b.token,{name:nm,adset_id:set.id,creative:{creative_id:cr.id},status});
    res.json({campaign:camp.id,adset:set.id,creative:cr.id,ad:ad.id,status});
  }catch(e){
    const c=e.code;
    res.status(c===190?401:[4,17,32,613].includes(c)?429:502).json({error:c===190?'Meta rejected the access token. Generate a new one with ads_management permission.':e.message});
  }
};
