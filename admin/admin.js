'use strict';
const $=id=>document.getElementById(id);
let config=null,accessToken='',cars=[],editingId=null,photos=[];
const status=(message,ok=false)=>{ $('status').textContent=message; $('status').classList.toggle('ok',ok); };
const fullSrc=p=>p.src.startsWith('https://')?p.src:'/'+p.src.replace(/^\//,'');
const cash=n=>'₦'+Number(n).toLocaleString('en-NG');
function setBusy(busy){$('save').disabled=busy;$('save').textContent=busy?'Saving…':'Publish changes';}
async function jsonFetch(url,options={}){
 const response=await fetch(url,{...options,cache:'no-store'});
 let data;try{data=await response.json();}catch{data={};}
 if(!response.ok)throw Error(data.error || 'Request failed ('+response.status+')');
 return data;
}
const authHeaders=()=>({'Authorization':'Bearer '+accessToken});
async function load(){
 cars=await jsonFetch('/api/admin-inventory',{headers:authHeaders()});
 renderCars();
}
function create(tag,content='',cls=''){
 const el=document.createElement(tag);if(cls)el.className=cls;
 el.textContent=content;return el;
}
function renderPhotos(){
 const container=$('photoList');container.replaceChildren();
 photos.forEach((photo,index)=>{
  const card=create('div','','photo'),img=document.createElement('img');
  img.src=fullSrc(photo);img.alt=photo.label||'Vehicle photo';
  const remove=create('button','Remove','secondary');remove.type='button';
  remove.addEventListener('click',()=>{photos.splice(index,1);renderPhotos();});
  card.append(img,remove);container.append(card);
 });
}
function clearForm(){
 editingId=null;photos=[];$('carForm').reset();$('formTitle').textContent='Add a vehicle';$('save').textContent='Publish new car';renderPhotos();
}
function edit(car){
 editingId=car.id;photos=JSON.parse(JSON.stringify(car.photos||[]));$('formTitle').textContent='Edit '+car.make+' '+car.model;
 for(const name of ['make','model','year','price','type','condition','color','status','tag','instagramSource','note']){
  const field=$('carForm').elements.namedItem(name);
  if(field) field.value=car[name]??'';
 }
 renderPhotos();$('save').textContent='Save changes';window.scrollTo({top:0,behavior:'smooth'});
 $('carForm').querySelector('[name="make"]').focus({preventScroll:true});
}
function renderCars(){
 const box=$('cars');box.replaceChildren();
 if(!cars.length){box.append(create('p','No vehicles found. Add your first car above.'));return;}
 for(const car of cars){
  const row=create('div','','car');
  if(car.photos?.length){
   const image=document.createElement('img');image.src=fullSrc(car.photos[0]);image.alt='Photo of '+car.make+' '+car.model;row.append(image);
  } else row.append(create('div','NO PHOTO','car-placeholder'));
  const info=create('div','','car-info'),label=create('strong',car.make+' '+car.model+' '+(car.year||'')),details=create('small',cash(car.price)+' · '+car.status);
  info.append(label,details);const btn=create('button','Edit','secondary');btn.type='button';btn.addEventListener('click',()=>edit(car));
  const sold=create('button',car.status==='sold'?'Sold ✓':'Mark sold','secondary');
  sold.type='button';sold.disabled=car.status==='sold';
  sold.addEventListener('click',async()=>{
   if(!window.confirm('Mark '+car.make+' '+car.model+' as sold? It will leave the public available inventory.'))return;
   sold.disabled=true;
   try{await saveCar({...car,status:'sold'});status('Car marked sold and removed from public inventory.',true);await load();}
   catch(err){status(err.message);sold.disabled=false;}
  });
  row.append(info,btn,sold);box.append(row);
 }
}
async function saveCar(car){
 return jsonFetch('/api/admin-inventory',{method:'POST',headers:{...authHeaders(),'Content-Type':'application/json'},body:JSON.stringify(car)});
}
async function fileAsCompressedJpeg(file){
 const image=await createImageBitmap(file).catch(()=>null);
 if(!image)throw Error('This photo format cannot be opened on this device. Choose JPEG or PNG.');
 const max=1700,scale=Math.min(1,max/Math.max(image.width,image.height));
 const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);
 const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,canvas.width,canvas.height);image.close?.();
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.78));
 if(!blob||blob.size>2_600_000)throw Error('Image too large after compression. Choose a smaller image.');
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onerror=()=>reject(Error('Could not read photo.'));
  reader.onload=()=>resolve(String(reader.result).split(',')[1]);
  reader.readAsDataURL(blob);
 });
}
$('loginForm').addEventListener('submit',async event=>{
 event.preventDefault();const button=$('loginForm').querySelector('button');button.disabled=true;
 status('Signing in…');
 try{
  config=config||await jsonFetch('/api/admin-config');
  const data=await jsonFetch(config.supabaseUrl+'/auth/v1/token?grant_type=password',{
   method:'POST',headers:{apikey:config.anonKey,'Content-Type':'application/json'},
   body:JSON.stringify({email:$('email').value.trim(),password:$('password').value})
  });
  accessToken=data.access_token;
  await load();
  $('password').value='';$('login').hidden=true;$('workspace').hidden=false;$('logout').hidden=false;
  status('Signed in. Changes to vehicles are published without a redeployment.',true);
 }catch(err){accessToken='';status('Sign in failed: '+err.message);}
 finally{button.disabled=false;}
});
$('logout').addEventListener('click',()=>{accessToken='';cars=[];photos=[];editingId=null;$('login').hidden=false;$('workspace').hidden=true;$('logout').hidden=true;$('password').value='';status('Signed out.');});
$('newCar').addEventListener('click',clearForm);
$('reset').addEventListener('click',clearForm);
$('photoPicker').addEventListener('change',async event=>{
 const files=[...event.target.files];event.target.value='';
 if(photos.length+files.length>16){status('Maximum 16 photos per car');return;}
 for(const file of files){
  try{
   status('Uploading '+file.name+'…');
   const base64=await fileAsCompressedJpeg(file);
   const uploaded=await jsonFetch('/api/upload-photo',{method:'POST',headers:{...authHeaders(),'Content-Type':'application/json'},body:JSON.stringify({base64})});
   photos.push(uploaded);renderPhotos();
   status('Uploaded '+photos.length+' photo(s). Tap Publish changes to save the listing.',true);
  }catch(err){status('Upload failed for '+file.name+': '+err.message);break;}
 }
});
$('carForm').addEventListener('submit',async event=>{
 event.preventDefault();setBusy(true);
 try{
  const form=new FormData($('carForm')),value=name=>String(form.get(name)||'').trim();
  const record={
   id:editingId||undefined,make:value('make'),model:value('model'),year:value('year')||null,
   price:Number(value('price')),type:value('type'),condition:value('condition'),color:value('color'),
   status:value('status'),tag:value('tag'),instagramSource:value('instagramSource'),note:value('note'),photos:photos.slice()
  };
  if(!record.make||!record.model||!Number.isSafeInteger(record.price)||record.price<=0)throw Error('Make, model and a valid price are required');
  await saveCar(record);
  clearForm();await load();status('Car saved. It is now in the live inventory database.',true);
 }catch(err){status('Could not save: '+err.message);}
 finally{setBusy(false);}
});
jsonFetch('/api/admin-config').then(value=>{config=value;status('Sign in to manage inventory.');}).catch(err=>status(err.message+' — see the setup instructions in GitHub.'));
