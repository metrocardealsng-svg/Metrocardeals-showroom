const { ghGetJson, ghPutJson, ghMoveFile } = require('./_lib/github');
const { requireAdmin } = require('./_lib/auth');

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { id, edits } = req.body || {};
    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }

    const [pending, vehicles] = await Promise.all([
      ghGetJson('data/pending.json', []),
      ghGetJson('data/vehicles.json', []),
    ]);

    const entry = pending.data.find(v => v.id === id);
    if (!entry) {
      res.status(404).json({ error: 'Pending listing not found' });
      return;
    }

    const merged = { ...entry, ...(edits || {}) };

    const movedPhotos = [];
    for (const photo of merged.photos || []) {
      const filename = photo.src.split('/').pop();
      const toPath = `assets/cars/${filename}`;
      await ghMoveFile(photo.src, toPath, `Publish photo for ${merged.id}`);
      movedPhotos.push({ src: toPath, label: photo.label });
    }

    const published = {
      id: merged.id,
      make: merged.make,
      model: merged.model,
      year: merged.year,
      price: merged.price,
      type: merged.type,
      condition: merged.condition,
      color: merged.color,
      paint: merged.paint || '#83938c',
      tag: merged.tag || 'NEW LISTING',
      note: merged.note || '',
      instagramSource: merged.instagramSource,
      photos: movedPhotos,
    };

    const nextVehicles = [...vehicles.data, published];
    const nextPending = pending.data.filter(v => v.id !== id);

    await ghPutJson('data/vehicles.json', nextVehicles, `Publish ${published.make} ${published.model}`, vehicles.sha);
    await ghPutJson('data/pending.json', nextPending, `Remove approved listing ${id} from pending`, pending.sha);

    res.status(200).json({ ok: true, published });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
