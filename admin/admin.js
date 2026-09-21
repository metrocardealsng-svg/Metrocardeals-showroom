const sb = () => window.metroSupabase();
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const money = n => '₦' + Number(n || 0).toLocaleString('en-NG');

const VEHICLE_TYPES = ['SUV', 'Sedan'];
const CONDITIONS = ['Nigerian used', 'Foreign used', 'Brand new', 'Confirm condition'];

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('visible');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('visible'), 2800);
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function escapeAttr(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }
function escapeHtml(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function displayPhotoUrl(src) { const s = String(src || ''); if (!s) return ''; if (/^https?:\/\//i.test(s) || s.startsWith('/')) return s; return '/' + s.replace(/^\.\//, ''); }

function photoStoragePath(url) {
  const marker = '/vehicle-photos/';
  const i = (url || '').indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length));
}

async function deleteStoragePathsFromPhotos(photos) {
  const paths = (photos || []).map(p => photoStoragePath(p.src)).filter(Boolean);
  if (paths.length) await sb().storage.from('vehicle-photos').remove(paths);
}

async function uploadPhoto(file, folder) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb().storage.from('vehicle-photos').upload(path, file, { contentType: file.type || 'image/jpeg' });
  if (error) throw error;
  const { data } = sb().storage.from('vehicle-photos').getPublicUrl(path);
  return { src: data.publicUrl, label: 'Photo' };
}

function photoGridHtml(photos) {
  return (photos || []).map((p, i) => `<div class="photo-item" data-idx="${i}"><img src="${displayPhotoUrl(p.src)}" alt=""><button type="button" data-remove-photo>×</button></div>`).join('');
}

function wirePhotoGridRemovals(gridEl, photosArr, onChange) {
  gridEl.querySelectorAll('[data-remove-photo]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.closest('.photo-item').dataset.idx);
      photosArr.splice(idx, 1);
      gridEl.innerHTML = photoGridHtml(photosArr);
      wirePhotoGridRemovals(gridEl, photosArr, onChange);
      onChange();
    });
  });
}

// ---------- Auth ----------

async function isAdminUser() {
  const { data: { user } } = await sb().auth.getUser();
  if (!user) return false;
  const { data, error } = await sb().from('app_admins').select('user_id').eq('user_id', user.id).maybeSingle();
  return !error && !!data;
}

function showGateError(msg) {
  $('#gateError').textContent = msg;
  $('#gateError').hidden = false;
}

function showApp() {
  $('#gate').hidden = true;
  $('#app').hidden = false;
  loadInventory();
  loadPending();
}

async function trySignIn() {
  const email = $('#email').value.trim();
  const password = $('#password').value;
  $('#gateError').hidden = true;
  try {
    if (!window.supabase) throw new Error('Supabase library did not load (check your internet connection and reload).');
    const { error } = await sb().auth.signInWithPassword({ email, password });
    if (error) { showGateError(error.message); return; }
    if (!(await isAdminUser())) {
      await sb().auth.signOut();
      showGateError('This account is not authorized as an admin.');
      return;
    }
    showApp();
  } catch (err) {
    showGateError('Unexpected error: ' + err.message);
  }
}

$('#signInBtn').addEventListener('click', trySignIn);
$('#password').addEventListener('keydown', e => { if (e.key === 'Enter') trySignIn(); });
$('#signOutBtn').addEventListener('click', async () => { await sb().auth.signOut(); location.reload(); });

(async function init() {
  try {
    if (!window.supabase) return;
    const { data: { session } } = await sb().auth.getSession();
    if (session && (await isAdminUser())) showApp();
  } catch (err) {
    console.error('Session restore failed:', err);
  }
})();

// ---------- Tabs ----------

$$('.tabs button').forEach(btn => btn.addEventListener('click', () => {
  $$('.tabs button').forEach(b => b.classList.toggle('active', b === btn));
  $$('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + btn.dataset.tab));
}));

// ---------- Inventory ----------

let inventoryCache = [];

async function loadInventory() {
  const { data, error } = await sb().from('vehicles').select('*').order('sort_order');
  if (error) { $('#inventoryList').innerHTML = `<p class="empty">Could not load: ${escapeHtml(error.message)}</p>`; return; }
  inventoryCache = data || [];
  renderInventory();
}

function cardHtml(v) {
  const thumb = v.photos && v.photos[0] ? v.photos[0].src : '';
  return `
    <div class="card" data-id="${v.id}">
      <div class="card-top">
        ${thumb ? `<img class="card-thumb" src="${displayPhotoUrl(thumb)}" alt="">` : `<div class="card-thumb"></div>`}
        <div class="card-info">
          <h3>${escapeHtml(v.make)} ${escapeHtml(v.model)} ${v.year || ''}</h3>
          <div class="price">${money(v.price)}</div>
          <span class="status-pill ${v.status === 'sold' ? 'status-sold' : 'status-active'}">${v.status === 'sold' ? 'SOLD' : 'ACTIVE'}</span>
        </div>
      </div>
      <div class="card-actions">
        <button data-act="edit">Edit</button>
        <button data-act="toggle-status">${v.status === 'sold' ? 'Mark active' : 'Mark sold'}</button>
        <button data-act="delete" class="danger">Delete</button>
      </div>
      <div class="edit-panel" hidden></div>
    </div>
  `;
}

function renderInventory() {
  const list = $('#inventoryList');
  if (!inventoryCache.length) { list.innerHTML = '<p class="empty">No cars yet. Add one in the "Add listing" tab.</p>'; return; }
  list.innerHTML = inventoryCache.map(cardHtml).join('');
  inventoryCache.forEach(wireCard);
}

function editFormHtml(v) {
  return `
    <div class="field-row">
      <label><span class="field-label">Make</span><input data-f="make" value="${escapeAttr(v.make)}"></label>
      <label><span class="field-label">Model</span><input data-f="model" value="${escapeAttr(v.model)}"></label>
    </div>
    <div class="field-row">
      <label><span class="field-label">Year</span><input data-f="year" type="number" value="${v.year ?? ''}"></label>
      <label><span class="field-label">Price (₦)</span><input data-f="price" type="number" value="${v.price}"></label>
    </div>
    <div class="field-row">
      <label><span class="field-label">Type</span><select data-f="type">${VEHICLE_TYPES.map(t => `<option ${t === v.type ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label><span class="field-label">Condition</span><select data-f="condition">${CONDITIONS.map(c => `<option ${c === v.condition ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
    </div>
    <div class="field-row">
      <label><span class="field-label">Colour</span><input data-f="color" value="${escapeAttr(v.color || '')}"></label>
      <label><span class="field-label">Tag</span><input data-f="tag" value="${escapeAttr(v.tag || '')}"></label>
    </div>
    <label><span class="field-label">Note</span><textarea data-f="note" rows="2">${escapeHtml(v.note || '')}</textarea></label>
    <label><span class="field-label">Instagram link</span><input data-f="instagram_source" value="${escapeAttr(v.instagram_source || '')}"></label>
    <label><span class="field-label">Photos</span>
      <div class="photo-grid" data-photo-grid>${photoGridHtml(v.photos)}</div>
      <label class="upload-btn">+ Add photos<input type="file" accept="image/*" multiple data-photo-input></label>
    </label>
    <div class="save-row"><button data-act="save" class="save">Save changes</button><button data-act="cancel" class="cancel">Cancel</button></div>
  `;
}

function wireCard(v) {
  const card = $(`.card[data-id="${v.id}"]`);
  if (!card) return;
  card.querySelector('[data-act="edit"]').addEventListener('click', () => toggleEdit(card, v));
  card.querySelector('[data-act="toggle-status"]').addEventListener('click', () => toggleStatus(v));
  card.querySelector('[data-act="delete"]').addEventListener('click', () => deleteVehicle(v));
}

function toggleEdit(card, v) {
  const panel = card.querySelector('.edit-panel');
  if (!panel.hidden) { panel.hidden = true; panel.innerHTML = ''; return; }
  panel.innerHTML = editFormHtml(v);
  panel.hidden = false;

  let localPhotos = JSON.parse(JSON.stringify(v.photos || []));
  const grid = panel.querySelector('[data-photo-grid]');
  wirePhotoGridRemovals(grid, localPhotos, () => {});

  panel.querySelector('[data-photo-input]').addEventListener('change', async e => {
    const files = [...e.target.files];
    toast('Uploading photos…');
    try {
      for (const f of files) localPhotos.push(await uploadPhoto(f, `cars/${v.id}`));
      grid.innerHTML = photoGridHtml(localPhotos);
      wirePhotoGridRemovals(grid, localPhotos, () => {});
      toast('Photos added');
    } catch (err) { toast('Upload failed: ' + err.message); }
    e.target.value = '';
  });

  panel.querySelector('[data-act="cancel"]').addEventListener('click', () => { panel.hidden = true; panel.innerHTML = ''; });

  panel.querySelector('[data-act="save"]').addEventListener('click', async () => {
    const fields = {};
    panel.querySelectorAll('[data-f]').forEach(el => { fields[el.dataset.f] = el.value; });
    const updates = {
      make: fields.make, model: fields.model,
      year: fields.year ? Number(fields.year) : null,
      price: Number(fields.price),
      type: fields.type, condition: fields.condition,
      color: fields.color, tag: fields.tag, note: fields.note,
      instagram_source: fields.instagram_source || null,
      photos: localPhotos,
    };
    const { error } = await sb().from('vehicles').update(updates).eq('id', v.id);
    if (error) { toast('Save failed: ' + error.message); return; }
    toast('Saved');
    loadInventory();
  });
}

async function toggleStatus(v) {
  const newStatus = v.status === 'sold' ? 'active' : 'sold';
  const { error } = await sb().from('vehicles').update({ status: newStatus }).eq('id', v.id);
  if (error) { toast('Failed: ' + error.message); return; }
  toast(newStatus === 'sold' ? 'Marked as sold' : 'Marked active');
  loadInventory();
}

async function deleteVehicle(v) {
  if (!confirm(`Delete ${v.make} ${v.model}? This cannot be undone.`)) return;
  await deleteStoragePathsFromPhotos(v.photos);
  const { error } = await sb().from('vehicles').delete().eq('id', v.id);
  if (error) { toast('Delete failed: ' + error.message); return; }
  toast('Deleted');
  loadInventory();
}

// ---------- Add listing ----------

let addPhotos = [];

$('#addPhotoInput').addEventListener('change', async e => {
  const files = [...e.target.files];
  toast('Uploading photos…');
  try {
    for (const f of files) addPhotos.push(await uploadPhoto(f, 'cars/new'));
    renderAddPhotoGrid();
    toast('Photos added');
  } catch (err) { toast('Upload failed: ' + err.message); }
  e.target.value = '';
});

function renderAddPhotoGrid() {
  const grid = $('#addPhotoGrid');
  grid.innerHTML = photoGridHtml(addPhotos);
  wirePhotoGridRemovals(grid, addPhotos, () => {});
}

$('#addForm').addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const make = fd.get('make').trim(), model = fd.get('model').trim();
  if (!make || !model) return;

  let baseSlug = slugify(`${make}-${model}`) || 'listing';
  let slug = baseSlug, suffix = 1;
  const existingIds = new Set(inventoryCache.map(v => v.id));
  while (existingIds.has(slug)) { slug = `${baseSlug}-${suffix}`; suffix += 1; }

  const maxSort = inventoryCache.reduce((m, v) => Math.max(m, v.sort_order || 0), 0);

  const row = {
    id: slug, make, model,
    year: fd.get('year') ? Number(fd.get('year')) : null,
    price: Number(fd.get('price')),
    type: fd.get('type'),
    condition: fd.get('condition'),
    color: fd.get('color') || 'Colour to confirm',
    tag: fd.get('tag') || 'NEW LISTING',
    note: fd.get('note') || '',
    instagram_source: fd.get('instagram_source') || null,
    photos: addPhotos,
    status: 'active',
    sort_order: maxSort + 1,
  };

  const { error } = await sb().from('vehicles').insert(row);
  if (error) { toast('Publish failed: ' + error.message); return; }
  toast('Listing published');
  e.target.reset();
  addPhotos = [];
  renderAddPhotoGrid();
  loadInventory();
  $('.tabs button[data-tab="inventory"]').click();
});

// ---------- Instagram pending queue ----------

let pendingCache = [];

async function loadPending() {
  const { data, error } = await sb().from('pending_vehicles').select('*').order('added_at', { ascending: false });
  if (error) { $('#pendingList').innerHTML = `<p class="empty">Could not load: ${escapeHtml(error.message)}</p>`; return; }
  pendingCache = data || [];
  $('#pendingBadge').hidden = pendingCache.length === 0;
  $('#pendingBadge').textContent = pendingCache.length;
  renderPending();
}

function pendingCardHtml(v) {
  return `
    <div class="card" data-pending-id="${v.id}">
      <div class="card-top" style="flex-wrap:wrap">
        <div class="photo-grid">${(v.photos || []).map(p => `<img class="card-thumb" src="${displayPhotoUrl(p.src)}" alt="" style="width:70px;height:70px">`).join('')}</div>
      </div>
      <div style="padding:0 14px 14px">
        <div class="field-row">
          <label><span class="field-label">Make</span><input data-f="make" value="${escapeAttr(v.make)}"></label>
          <label><span class="field-label">Model</span><input data-f="model" value="${escapeAttr(v.model)}"></label>
        </div>
        <div class="field-row">
          <label><span class="field-label">Year</span><input data-f="year" type="number" value="${v.year ?? ''}"></label>
          <label><span class="field-label">Price (₦)</span><input data-f="price" type="number" value="${v.price ?? ''}"></label>
        </div>
        <div class="field-row">
          <label><span class="field-label">Type</span><select data-f="type">${VEHICLE_TYPES.map(t => `<option ${t === v.type ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          <label><span class="field-label">Condition</span><select data-f="condition">${CONDITIONS.map(c => `<option ${c === v.condition ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
        </div>
        <label><span class="field-label">Colour</span><input data-f="color" value="${escapeAttr(v.color || '')}"></label>
        <div class="caption-box">${escapeHtml(v.raw_caption || '')}</div>
        ${v.instagram_source ? `<p style="margin:0 0 14px"><a href="${v.instagram_source}" target="_blank" rel="noopener" style="color:#8fb8ff;font-size:12px">View original post ↗</a></p>` : ''}
        <div class="card-actions">
          <button data-act="approve" class="primary">Approve &amp; publish</button>
          <button data-act="reject" class="danger">Reject</button>
        </div>
      </div>
    </div>
  `;
}

function renderPending() {
  const list = $('#pendingList');
  if (!pendingCache.length) { list.innerHTML = '<p class="empty">Nothing waiting for review.</p>'; return; }
  list.innerHTML = pendingCache.map(pendingCardHtml).join('');
  pendingCache.forEach(wirePendingCard);
}

function wirePendingCard(v) {
  const card = $(`.card[data-pending-id="${v.id}"]`);
  if (!card) return;

  card.querySelector('[data-act="approve"]').addEventListener('click', async () => {
    const fields = {};
    card.querySelectorAll('[data-f]').forEach(el => { fields[el.dataset.f] = el.value; });
    const maxSort = inventoryCache.reduce((m, x) => Math.max(m, x.sort_order || 0), 0);
    const row = {
      id: v.id, make: fields.make, model: fields.model,
      year: fields.year ? Number(fields.year) : null,
      price: Number(fields.price) || 0,
      type: fields.type, condition: fields.condition, color: fields.color,
      paint: v.paint, tag: v.tag, note: v.note,
      instagram_source: v.instagram_source,
      photos: v.photos, status: 'active', sort_order: maxSort + 1,
    };
    const { error: insertError } = await sb().from('vehicles').insert(row);
    if (insertError) { toast('Approve failed: ' + insertError.message); return; }
    await sb().from('pending_vehicles').delete().eq('id', v.id);
    toast('Published to the site');
    loadPending();
    loadInventory();
  });

  card.querySelector('[data-act="reject"]').addEventListener('click', async () => {
    if (!confirm('Discard this listing?')) return;
    await deleteStoragePathsFromPhotos(v.photos);
    const { error } = await sb().from('pending_vehicles').delete().eq('id', v.id);
    if (error) { toast('Reject failed: ' + error.message); return; }
    toast('Rejected');
    loadPending();
  });
}
