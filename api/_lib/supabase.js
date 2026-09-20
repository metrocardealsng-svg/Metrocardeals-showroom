// Supabase-backed inventory. Server-only credentials: never return SUPABASE_SERVICE_ROLE_KEY.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const URL_ENV = () => (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const enabled = () => !!(URL_ENV() && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_ADMIN_USER_ID);
const seed = () => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/vehicles.json'), 'utf8'));
function safeText(v, limit=500) { return String(v ?? '').trim().slice(0,limit); }
function html(v) { return String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
const keys = ['id','make','model','year','price','type','condition','color','paint','tag','note','instagram_source','photos','status'];
function fromRow(row) {
 return {id:row.id,make:row.make,model:row.model,year:row.year,price:Number(row.price),type:row.type,condition:row.condition,
 color:row.color,paint:row.paint,tag:row.tag,note:row.note,instagramSource:row.instagram_source,photos:row.photos||[],status:row.status};
}
function seedRow(v) {return {...v, status:'available', instagramSource:v.instagramSource || null, photos:v.photos || []};}
async function db(method, endpoint, body, extraHeaders={}) {
 if (!enabled()) throw Object.assign(new Error('Supabase not configured'),{status:503});
 const res = await fetch(URL_ENV() + '/rest/v1/' + endpoint, {
 method, headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY,
 'Content-Type':'application/json',...extraHeaders},body:body === undefined ? undefined : JSON.stringify(body)
 });
 if (!res.ok) throw Object.assign(new Error('Inventory database request failed ('+res.status+')'),{status:502});
 return res.status === 204 ? null : res.json();
}
async function merged() {
 const base=seed().map(seedRow);
 if (!enabled()) return base;
 const rows = await db('GET','vehicles?select=*&limit=500');
 const merged=new Map(base.map(v=>[v.id,v]));
 rows.forEach(row=>merged.set(row.id,fromRow(row)));
 return [...merged.values()];
}
async function requireAdmin(req,res) {
 if (!enabled()) {res.status(503).json({error:'Supabase is not configured yet'});return false;}
 const bearer=req.headers.authorization || '';
 if (!/^Bearer [A-Za-z0-9_\-.]+$/.test(bearer)) {res.status(401).json({error:'Sign in required'});return false;}
 try {
 const response=await fetch(URL_ENV()+'/auth/v1/user',{headers:{apikey:process.env.SUPABASE_ANON_KEY,Authorization:bearer},cache:'no-store'});
 if (!response.ok) {res.status(401).json({error:'Session expired; sign in again'});return false;}
 const user=await response.json();
 const a=Buffer.from(String(user.id||'')),b=Buffer.from(String(process.env.SUPABASE_ADMIN_USER_ID||''));
 if (!a.length || a.length!==b.length || !crypto.timingSafeEqual(a,b)) {res.status(403).json({error:'Account not authorized for inventory'});return false;}
 return true;
 } catch {res.status(503).json({error:'Authentication service unavailable'});return false;}
}
function validate(raw) {
 if (!raw || typeof raw!=='object' || Array.isArray(raw)) throw new Error('Invalid vehicle details');
 const id=raw.id ? safeText(raw.id,100) : crypto.randomUUID();
 if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(id)) throw new Error('Invalid vehicle ID');
 const make=safeText(raw.make,60), model=safeText(raw.model,100);
 const price=Number(raw.price),year=raw.year === null || raw.year === '' || raw.year === undefined ? null:Number(raw.year);
 if (!make||!model||!Number.isSafeInteger(price)||price<=0) throw new Error('Make, model and positive price are required');
 if (year!==null && (!Number.isInteger(year)||year<1900||year>2100)) throw new Error('Enter a valid year');
 const status=safeText(raw.status || 'available',20);
 if (!['available','reserved','sold'].includes(status)) throw new Error('Invalid stock status');
 const photos=raw.photos || [];
 if (!Array.isArray(photos)||photos.length>16) throw new Error('Maximum 16 photos');
 const base=URL_ENV()+'/storage/v1/object/public/car-images/';
 const validPhotos=photos.map(p=>{
 const src=safeText(p.src,800),label=safeText(p.label||'Vehicle photo',80);
 if (!(src.startsWith(base)&&/^https:\/\//.test(src) || /^assets\/cars\/[a-zA-Z0-9_./-]+\.(jpg|jpeg|png|webp)$/i.test(src) && !src.includes('..'))) throw new Error('Upload images through the dashboard');
 return {src,label};
 });
 return {id,make,model,year,price,type:safeText(raw.type||'SUV',40),condition:safeText(raw.condition||'Confirm condition',90),
 color:safeText(raw.color||'Confirm colour',70),paint:safeText(raw.paint||'#6d727b',30),tag:safeText(raw.tag||'',60),
 note:safeText(raw.note||'',1000),instagram_source:safeText(raw.instagramSource||'',300),status,photos:validPhotos};
}
function publicVehicle(v) {
 return {...v,make:html(v.make),model:html(v.model),type:html(v.type),condition:html(v.condition),color:html(v.color),
 tag:html(v.tag),note:html(v.note),paint:/^#[0-9a-f]{6}$/i.test(v.paint||'')?v.paint:'#6d727b',
 photos:(v.photos||[]).map(p=>({src:p.src,label:html(p.label)})),
 instagramSource: /^https:\/\/www\.instagram\.com\//.test(v.instagramSource||'') ? v.instagramSource : ''};
}
module.exports={enabled,URL_ENV,db,merged,requireAdmin,validate,publicVehicle};
