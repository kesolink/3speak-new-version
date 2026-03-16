// Vercel Edge Middleware — serves Open Graph / Twitter Card meta tags to social media bots.
// Regular users pass through to the SPA unchanged.

const BOT_USER_AGENTS = [
  'facebookexternalhit',
  'Facebot',
  'Twitterbot',
  'Discordbot',
  'TelegramBot',
  'WhatsApp',
  'LinkedInBot',
  'Slackbot',
  'Embedly',
  'Pinterest',
  'vkShare',
  'Applebot',
  'Googlebot',
  'bingbot',
];

const HIVE_API = 'https://api.hive.blog';
const BUNNY_IPFS_CDN = 'https://hotipfs-3speak-1.b-cdn.net';
const BASE_URL = 'https://3speak.tv';
const FALLBACK_THUMBNAIL = `${BASE_URL}/3speak.jpeg`;

/**
 * Parse video author/permlink from the URL.
 * Supports:
 *   /watch?v=author/permlink
 *   /@author/permlink  (skip if permlink is "shorts")
 * Returns { author, permlink } or null.
 */
function parseVideoUrl(url) {
  const { pathname, searchParams } = url;

  // /watch?v=author/permlink
  if (pathname === '/watch') {
    const v = searchParams.get('v');
    if (v && v.includes('/')) {
      const [author, ...rest] = v.split('/');
      const permlink = rest.join('/');
      if (author && permlink) return { author, permlink };
    }
    return null;
  }

  // /@author/permlink
  const atMatch = pathname.match(/^\/@([^/]+)\/(.+)$/);
  if (atMatch) {
    const [, author, permlink] = atMatch;
    if (permlink === 'shorts') return null; // shorts listing page, not a video
    return { author, permlink };
  }

  return null;
}

/**
 * Detect social media bot from User-Agent header.
 */
function isBot(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some((bot) => ua.includes(bot.toLowerCase()));
}

/**
 * Fetch post data from the Hive blockchain.
 */
async function fetchHivePost(author, permlink) {
  const res = await fetch(HIVE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'condenser_api.get_content',
      params: [author, permlink],
      id: 1,
    }),
  });

  if (!res.ok) return null;

  const data = await res.json();
  const post = data?.result;
  if (!post || !post.author || post.author === '') return null;
  return post;
}

/**
 * Resolve thumbnail URL — simplified port of src/utils/fixThumbnails.js
 * (Edge-compatible: no Buffer/bs58 dependency)
 */
function fixThumbnail(thumbnail) {
  if (!thumbnail || typeof thumbnail !== 'string' || thumbnail.trim() === '') {
    return FALLBACK_THUMBNAIL;
  }

  const t = thumbnail.trim();

  // Handle malformed double-embedded URLs
  if (t.includes('/ipfs/http')) {
    const match = t.match(/\/ipfs\/(https?:\/\/.+)/);
    if (match?.[1]) return match[1];
  }

  // IPFS URLs → CDN
  if (t.includes('ipfs://')) {
    const hash = t.replace('ipfs://', '').trim();
    if (!hash) return FALLBACK_THUMBNAIL;
    return `${BUNNY_IPFS_CDN}/ipfs/${hash}`;
  }

  // Deprecated CDN replacement
  if (t.includes('ipfs-3speak.b-cdn.net')) {
    return t.replace('https://ipfs-3speak.b-cdn.net', BUNNY_IPFS_CDN);
  }

  // Already proxied — return as-is
  if (
    t.includes('images.hive.blog') ||
    t.includes('files.peakd.com') ||
    t.includes('images.3speak.tv')
  ) {
    return t;
  }

  // Dead CDN → fallback
  if (t.includes('media.3speak.tv')) {
    return FALLBACK_THUMBNAIL;
  }

  // Regular HTTP URLs — proxy through images.hive.blog (simple width proxy, no bs58 needed)
  if (t.startsWith('http')) {
    return `https://images.hive.blog/0x0/${t}`;
  }

  return t;
}

/**
 * Extract a plain-text description from a Hive post body (markdown/HTML).
 */
function extractDescription(body) {
  if (!body) return '';
  let text = body
    // Remove HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Remove markdown images
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    // Remove markdown links but keep text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // Remove markdown formatting
    .replace(/[#*_~`>]/g, '')
    // Remove URLs
    .replace(/https?:\/\/\S+/g, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length > 200) {
    text = text.slice(0, 197) + '...';
  }
  return text;
}

/**
 * HTML-entity-escape a string to prevent XSS in meta tags.
 */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Build the minimal HTML page with OG / Twitter Card meta tags.
 */
function buildOgHtml({ title, description, image, url, duration, author }) {
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const safeImage = escapeHtml(image);
  const safeUrl = escapeHtml(url);
  const safeAuthor = escapeHtml(author);

  const durationMeta = duration
    ? `<meta property="og:video:duration" content="${Math.round(duration)}" />`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${safeTitle} - 3Speak</title>

  <!-- Open Graph -->
  <meta property="og:type" content="video.other" />
  <meta property="og:site_name" content="3Speak" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDesc}" />
  <meta property="og:image" content="${safeImage}" />
  <meta property="og:url" content="${safeUrl}" />
  ${durationMeta}

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@3speaktv" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDesc}" />
  <meta name="twitter:image" content="${safeImage}" />

  <link rel="canonical" href="${safeUrl}" />
</head>
<body>
  <p><a href="${safeUrl}">${safeTitle}</a> by @${safeAuthor} on <a href="${escapeHtml(BASE_URL)}">3Speak</a></p>
</body>
</html>`;
}

// ── Middleware entry point ─────────────────────────────────────────────

export const config = {
  matcher: ['/watch', '/@:path*'],
};

export default async function middleware(request) {
  const userAgent = request.headers.get('user-agent') || '';
  if (!isBot(userAgent)) return; // pass through to SPA

  const url = new URL(request.url);
  const video = parseVideoUrl(url);
  if (!video) return; // not a video URL, pass through

  try {
    const post = await fetchHivePost(video.author, video.permlink);
    if (!post) return; // post not found, fall through to SPA

    let meta = {};
    try {
      meta = JSON.parse(post.json_metadata || '{}');
    } catch (_) {
      // invalid JSON, continue with empty meta
    }

    const videoInfo = meta.video?.info || {};

    // Resolve thumbnail: try sourceMap → json_metadata image → fallback
    let thumbnail = null;
    if (videoInfo.sourceMap) {
      const thumbSource = videoInfo.sourceMap.find((s) => s.type === 'thumbnail');
      if (thumbSource) thumbnail = thumbSource.url;
    }
    if (!thumbnail && meta.image?.[0]) thumbnail = meta.image[0];
    const image = fixThumbnail(thumbnail);

    const title = post.title || `Video by @${video.author}`;
    const description = extractDescription(post.body);
    const canonicalUrl = `${BASE_URL}/watch?v=${video.author}/${video.permlink}`;
    const duration = videoInfo.duration || null;

    const html = buildOgHtml({
      title,
      description,
      image,
      url: canonicalUrl,
      duration,
      author: video.author,
    });

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (err) {
    // On any error, fall through to the normal SPA behavior — no worse than today
    console.error('OG middleware error:', err);
    return;
  }
}
