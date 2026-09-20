const {enabled,URL_ENV} = require('./_lib/supabase');
module.exports=(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 if(!enabled())return res.status(503).json({error:'Configure Supabase to enable dashboard'});
 return res.status(200).json({supabaseUrl:URL_ENV(),anonKey:process.env.SUPABASE_ANON_KEY});
};
