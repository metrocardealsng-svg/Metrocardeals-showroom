const {merged,publicVehicle} = require('./_lib/supabase');
module.exports=async(req,res)=>{
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 res.setHeader('Cache-Control','no-store, max-age=0');
 try {
  const cars=(await merged()).filter(v=>v.status==='available').map(publicVehicle);
  return res.status(200).json(cars);
 } catch {return res.status(503).json({error:'Live inventory is temporarily unavailable. Please try again.'});}
};
