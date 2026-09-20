const crypto=require('node:crypto');
const {URL_ENV,requireAdmin}=require('./_lib/supabase');
module.exports=async(req,res)=>{
 if(!await requireAdmin(req,res))return;
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 try {
  const b64=req.body?.base64;
  if(typeof b64!=='string'||b64.length>3_800_000||!/^[A-Za-z0-9+/=]+$/.test(b64))return res.status(400).json({error:'Upload a compressed JPEG under 2.5 MB'});
  const bytes=Buffer.from(b64,'base64');
  if(bytes.length>2_600_000||bytes.length<100||bytes[0]!==0xff||bytes[1]!==0xd8||bytes[2]!==0xff)return res.status(400).json({error:'Only compressed JPEG photos under 2.5 MB are allowed'});
  const filename=crypto.randomUUID()+'.jpg';
  const upload=await fetch(URL_ENV()+'/storage/v1/object/car-images/'+filename,{
   method:'POST',
   headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'image/jpeg','Cache-Control':'3600','x-upsert':'false'},
   body:bytes
  });
  if(!upload.ok)return res.status(502).json({error:'Photo storage failed'});
  return res.status(201).json({src:URL_ENV()+'/storage/v1/object/public/car-images/'+filename,label:'Vehicle photo'});
 }catch{return res.status(502).json({error:'Could not upload photo. Try again.'});}
};
