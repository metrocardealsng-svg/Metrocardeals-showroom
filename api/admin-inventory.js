const {merged,db,requireAdmin,validate} = require('./_lib/supabase');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(!await requireAdmin(req,res))return;
 try{
  if(req.method==='GET')return res.status(200).json(await merged());
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const vehicle=validate(req.body);
  const saved=await db('POST','vehicles?on_conflict=id', vehicle, {'Prefer':'resolution=merge-duplicates,return=representation'});
  return res.status(200).json(saved[0]);
 }catch(err){return res.status(err.message?.startsWith('Invalid')||/required|Maximum|valid year|Upload images/.test(err.message||'')?400:err.status||500).json({error:err.status?'Inventory service unavailable':err.message||'Save failed'});}
};
