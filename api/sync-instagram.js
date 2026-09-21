const { adminClient } = require('./_lib/supabase');
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
    const supabase = adminClient();
    const media = await fetchMediaList(igUserId, igToken);

    const { data: syncedRows } = await supabase.from('synced_instagram_posts').select('post_id');
    const processedIds = new Set((syncedRows || []).map(r => r.post_id));
    const newMedia = media.filter(m => !processedIds.has(m.id) && m.media_type !== 'VIDEO');

    if (newMedia.length === 0) {
      res.status(200).json({ ok: true, newPosts: 0 });
      return;
    }

    const [{ data: existingVehicles }, { data: existingPending }] = await Promise.all([
      supabase.from('vehicles').select('id'),
      supabase.from('pending_vehicles').select('id'),
    ]);
    const usedIds = new Set([...(existingVehicles || []), ...(existingPending || [])].map(v => v.id));

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
        await supabase.from('synced_instagram_posts').insert({ post_id: item.id });
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
        const path = `pending/${slug}-${i + 1}.jpg`;
        const { error: uploadError } = await supabase.storage.from('vehicle-photos').upload(path, buffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage.from('vehicle-photos').getPublicUrl(path);
        photos.push({ src: publicUrlData.publicUrl, label: i === 0 ? 'Front view' : `Photo ${i + 1}` });
      }

      const { error: insertError } = await supabase.from('pending_vehicles').insert({
        id: slug,
        make: parsed.make,
        model: parsed.model,
        year: parsed.year,
        price: parsed.price,
        type: parsed.type,
        condition: parsed.condition,
        color: parsed.color,
        paint: parsed.paint,
        tag: parsed.tag,
        note: parsed.note,
        photos,
        instagram_source: item.permalink,
        instagram_post_id: item.id,
        raw_caption: caption,
      });
      if (insertError) throw insertError;

      await supabase.from('synced_instagram_posts').insert({ post_id: item.id });
      addedCount += 1;
    }

    res.status(200).json({ ok: true, newPosts: addedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
