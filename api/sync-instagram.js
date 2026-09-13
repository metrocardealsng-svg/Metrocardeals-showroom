const { ghGetJson, ghPutJson, ghPutFile } = require('./_lib/github');
const { parseCaption } = require('./_lib/parse-caption');

const GRAPH = 'https://graph.facebook.com/v21.0';

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function fetchMediaList(igUserId, token) {
  const url = `${GRAPH}/${igUserId}/media?fields=id,caption,media_type,media_url,permalink,timestamp&limit=25&access_token=${token}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Instagram media list failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.data || [];
}

async function fetchCarouselChildren(mediaId, token) {
  const url = `${GRAPH}/${mediaId}/children?fields=id,media_type,media_url&access_token=${token}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.data || []).filter(c => c.media_type === 'IMAGE');
}

async function downloadImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

module.exports = async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers['authorization'] !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const igUserId = process.env.IG_USER_ID;
  const igToken = process.env.IG_ACCESS_TOKEN;
  if (!igUserId || !igToken) {
    res.status(500).json({ error: 'IG_USER_ID or IG_ACCESS_TOKEN not configured' });
    return;
  }

  try {
    const [media, synced, pending, vehicles] = await Promise.all([
      fetchMediaList(igUserId, igToken),
      ghGetJson('data/synced-posts.json', { processedIds: [] }),
      ghGetJson('data/pending.json', []),
      ghGetJson('data/vehicles.json', []),
    ]);

    const processedIds = new Set(synced.data.processedIds || []);
    const newMedia = media.filter(m => !processedIds.has(m.id) && m.media_type !== 'VIDEO');

    if (newMedia.length === 0) {
      res.status(200).json({ ok: true, newPosts: 0 });
      return;
    }

    const usedIds = new Set([...vehicles.data, ...pending.data].map(v => v.id));
    const pendingList = pending.data;
    let addedCount = 0;

    for (const item of newMedia) {
      const caption = item.caption || '';
      const parsed = parseCaption(caption);

      let imageUrls = [];
      if (item.media_type === 'CAROUSEL_ALBUM') {
        const children = await fetchCarouselChildren(item.id, igToken);
        imageUrls = children.map(c => c.media_url);
      } else if (item.media_type === 'IMAGE') {
        imageUrls = [item.media_url];
      }
      if (imageUrls.length === 0) {
        processedIds.add(item.id);
        continue;
      }

      let baseSlug = slugify(`${parsed.make}-${parsed.model}`) || 'listing';
      let slug = baseSlug;
      let suffix = 1;
      while (usedIds.has(slug)) {
        slug = `${baseSlug}-${suffix}`;
        suffix += 1;
      }
      usedIds.add(slug);

      const photos = [];
      for (let i = 0; i < imageUrls.length; i++) {
        const buffer = await downloadImage(imageUrls[i]);
        const path = `assets/cars/pending/${slug}-${i + 1}.jpg`;
        await ghPutFile(path, buffer, `Stage photo for pending listing ${slug}`, null);
        photos.push({ src: path, label: i === 0 ? 'Front view' : `Photo ${i + 1}` });
      }

      pendingList.push({
        id: slug,
        ...parsed,
        photos,
        instagramSource: item.permalink,
        instagramPostId: item.id,
        rawCaption: caption,
        addedAt: new Date().toISOString(),
      });

      processedIds.add(item.id);
      addedCount += 1;
    }

    await ghPutJson('data/pending.json', pendingList, `Stage ${addedCount} new listing(s) from Instagram`, pending.sha);
    await ghPutJson('data/synced-posts.json', { processedIds: [...processedIds] }, 'Update synced Instagram post IDs', synced.sha);

    res.status(200).json({ ok: true, newPosts: addedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
