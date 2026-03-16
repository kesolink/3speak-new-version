// Debug endpoint: /api/og-debug?author=X&permlink=Y
// Returns JSON with the computed Open Graph values for a given video.

const HIVE_API = 'https://api.hive.blog';
const BUNNY_IPFS_CDN = 'https://hotipfs-3speak-1.b-cdn.net';
const BASE_URL = 'https://3speak.tv';
const FALLBACK_THUMBNAIL = `${BASE_URL}/3speak.jpeg`;

function fixThumbnail(thumbnail) {
  if (!thumbnail || typeof thumbnail !== 'string' || thumbnail.trim() === '') {
    return FALLBACK_THUMBNAIL;
  }
  const t = thumbnail.trim();

  if (t.includes('/ipfs/http')) {
    const match = t.match(/\/ipfs\/(https?:\/\/.+)/);
    if (match?.[1]) return match[1];
  }
  if (t.includes('ipfs://')) {
    const hash = t.replace('ipfs://', '').trim();
    if (!hash) return FALLBACK_THUMBNAIL;
    return `${BUNNY_IPFS_CDN}/ipfs/${hash}`;
  }
  if (t.includes('ipfs-3speak.b-cdn.net')) {
    return t.replace('https://ipfs-3speak.b-cdn.net', BUNNY_IPFS_CDN);
  }
  if (t.includes('images.hive.blog') || t.includes('files.peakd.com') || t.includes('images.3speak.tv')) {
    return t;
  }
  if (t.includes('media.3speak.tv')) {
    return FALLBACK_THUMBNAIL;
  }
  if (t.startsWith('http')) {
    return `https://images.hive.blog/0x0/${t}`;
  }
  return t;
}

function extractDescription(body) {
  if (!body) return '';
  let text = body
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_~`>]/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length > 200) text = text.slice(0, 197) + '...';
  return text;
}

export default async function handler(req, res) {
  const { author, permlink } = req.query;

  if (!author || !permlink) {
    return res.status(400).json({ error: 'Missing author or permlink query parameter' });
  }

  try {
    const hiveRes = await fetch(HIVE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'condenser_api.get_content',
        params: [author, permlink],
        id: 1,
      }),
    });

    if (!hiveRes.ok) {
      return res.status(502).json({ error: 'Hive API request failed', status: hiveRes.status });
    }

    const data = await hiveRes.json();
    const post = data?.result;

    if (!post || !post.author || post.author === '') {
      return res.status(404).json({ error: 'Post not found' });
    }

    let meta = {};
    try { meta = JSON.parse(post.json_metadata || '{}'); } catch (_) {}

    const videoInfo = meta.video?.info || {};

    let thumbnail = null;
    if (videoInfo.sourceMap) {
      const thumbSource = videoInfo.sourceMap.find((s) => s.type === 'thumbnail');
      if (thumbSource) thumbnail = thumbSource.url;
    }
    if (!thumbnail && meta.image?.[0]) thumbnail = meta.image[0];

    const image = fixThumbnail(thumbnail);
    const title = post.title || `Video by @${author}`;
    const description = extractDescription(post.body);
    const canonicalUrl = `${BASE_URL}/watch?v=${author}/${permlink}`;
    const duration = videoInfo.duration || null;

    return res.status(200).json({
      og: {
        title,
        description,
        image,
        url: canonicalUrl,
        type: 'video.other',
        site_name: '3Speak',
        duration,
      },
      twitter: {
        card: 'summary_large_image',
        site: '@3speaktv',
        title,
        description,
        image,
      },
      _debug: {
        raw_thumbnail: thumbnail,
        resolved_thumbnail: image,
        json_metadata_image: meta.image || null,
        video_info: videoInfo,
        post_title: post.title,
        post_author: post.author,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal error', message: err.message });
  }
}
