const { ghGetJson } = require('./_lib/github');
const { requireAdmin } = require('./_lib/auth');

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const pending = await ghGetJson('data/pending.json', []);
    res.status(200).json(pending.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
