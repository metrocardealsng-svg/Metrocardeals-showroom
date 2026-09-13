function requireAdmin(req, res) {
  const key = process.env.ADMIN_KEY;
  if (!key) {
    res.status(500).json({ error: 'ADMIN_KEY not configured' });
    return false;
  }
  if (req.headers['x-admin-key'] !== key) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

module.exports = { requireAdmin };
