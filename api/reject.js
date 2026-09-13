const { ghGetJson, ghPutJson, ghGetFileRaw, ghDeleteFile } = require('./_lib/github');
const { requireAdmin } = require('./_lib/auth');

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { id } = req.body || {};
    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }

    const pending = await ghGetJson('data/pending.json', []);
    const entry = pending.data.find(v => v.id === id);
    if (!entry) {
      res.status(404).json({ error: 'Pending listing not found' });
      return;
    }

    for (const photo of entry.photos || []) {
      const file = await ghGetFileRaw(photo.src);
      if (file) await ghDeleteFile(photo.src, `Discard rejected photo for ${id}`, file.sha);
    }

    const nextPending = pending.data.filter(v => v.id !== id);
    await ghPutJson('data/pending.json', nextPending, `Reject pending listing ${id}`, pending.sha);

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
