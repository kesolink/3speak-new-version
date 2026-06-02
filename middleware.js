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
// Same service the SPA uses (see src/utils/config.js / .env VITE_TRANSLATE_API_URL).
const TRANSLATE_API_URL =
  (typeof process !== 'undefined' && process.env && process.env.TRANSLATE_API_URL) ||
  'https://translate.3speak.tv';
// Cap the transcript we inline so a long video can't bloat the bot response.
const MAX_TRANSCRIPT_CHARS = 20000;

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
 *
 * Uses bridge.get_post (not condenser_api.get_content) because bridge also
 * returns the moderation signals we need for the indexability decision:
 *   - stats.gray  → downvoted / low-reputation / muted by community
 *   - stats.hide  → hidden by community moderation
 *   - blacklists  → author present on abuse blacklists
 * Note: bridge returns json_metadata as an object; condenser returned a string.
 */
async function fetchHivePost(author, permlink) {
  const res = await fetch(HIVE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'bridge.get_post',
      params: { author, permlink, observer: '' },
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
 * Parse json_metadata defensively — bridge returns an object, but some posts
 * carry a stringified value, and a few carry invalid JSON.
 */
function parseMeta(jsonMetadata) {
  if (!jsonMetadata) return {};
  if (typeof jsonMetadata === 'object') return jsonMetadata;
  try {
    return JSON.parse(jsonMetadata);
  } catch (_) {
    return {};
  }
}

/**
 * Conservative title heuristic for legacy adult posts that deliberately omit
 * the `nsfw` tag — mirrors Ecency's approach. Kept narrow to avoid false
 * positives on ordinary titles.
 */
function isAdultByTitle(title) {
  if (!title) return false;
  return /(\bporn\b|\bxxx\b|\bnsfw\b|\bnude[sd]?\b|\bnaked\b|sex\s*tape|onlyfans|\bhentai\b|camgirl|\bescort\b)/i.test(
    title,
  );
}

/**
 * Decide whether this page should be indexed by search engines.
 *
 * Mirrors the "reduce the low-quality footprint" lever: NSFW, community-muted
 * /blacklisted, and effectively-empty pages get `noindex` so they don't drag
 * down the domain's site-level quality assessment. We still emit `follow` so
 * link equity continues to flow.
 *
 * Returns { index: boolean, reason?: string }.
 */
function getIndexability(post, meta) {
  const tags = Array.isArray(meta?.tags)
    ? meta.tags.map((t) => String(t).toLowerCase())
    : [];

  // NSFW — explicit tags, then conservative title heuristic.
  if (tags.includes('nsfw') || tags.includes('xxx') || tags.includes('porn')) {
    return { index: false, reason: 'nsfw-tag' };
  }
  if (isAdultByTitle(post.title)) {
    return { index: false, reason: 'nsfw-title' };
  }

  // Abuse / community moderation (bridge stats).
  if (post.stats?.gray === true || post.stats?.hide === true) {
    return { index: false, reason: 'muted' };
  }
  if (Array.isArray(post.blacklists) && post.blacklists.length > 0) {
    return { index: false, reason: 'blacklist' };
  }

  // Effectively-empty: not a recognizable video AND no meaningful body.
  // Errs toward indexing — only noindex when we're confident there's nothing.
  const videoInfo = meta?.video?.info || {};
  const hasVideo = !!(
    videoInfo.duration ||
    videoInfo.ipfs ||
    videoInfo.filename ||
    (Array.isArray(videoInfo.sourceMap) &&
      videoInfo.sourceMap.some((s) => s && s.type && s.type !== 'thumbnail'))
  );
  const appIsSpeak = String(meta?.app || '').toLowerCase().includes('speak');
  const bodyLen = (post.body || '').trim().length;
  if (!hasVideo && !appIsSpeak && bodyLen < 50) {
    return { index: false, reason: 'empty' };
  }

  return { index: true };
}

/**
 * Resolve the canonical URL. Honors an explicit author-declared
 * `canonical_url` (genuine syndication intent — respected first, matching
 * Ecency's stance), otherwise self-canonicalizes to the clean 3Speak URL.
 */
function resolveCanonical(meta, selfUrl) {
  const declared = meta?.canonical_url;
  if (typeof declared === 'string') {
    const trimmed = declared.trim();
    if (/^https?:\/\/[^\s"'<>]+$/i.test(trimmed)) return trimmed;
  }
  return selfUrl;
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
 * Convert a duration in seconds to an ISO-8601 duration (e.g. PT1H2M3S),
 * the format schema.org VideoObject.duration expects.
 */
function secondsToISO8601(sec) {
  const total = Math.round(Number(sec) || 0);
  if (total <= 0) return null;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `PT${h ? `${h}H` : ''}${m ? `${m}M` : ''}${s ? `${s}S` : ''}` || 'PT0S';
}

/**
 * Hive timestamps are naive UTC ("2026-05-18T18:13:27"). schema.org wants a
 * valid ISO-8601 instant — append Z if there's no timezone designator.
 */
function toIsoDate(created) {
  if (!created || typeof created !== 'string') return null;
  return /[zZ]|[+-]\d{2}:?\d{2}$/.test(created) ? created : `${created}Z`;
}

/**
 * Strip an SRT file down to plain transcript text: drop index and timestamp
 * lines, join cues, collapse whitespace, and drop consecutive duplicate lines
 * (auto-captions repeat a lot). Capped to MAX_TRANSCRIPT_CHARS.
 */
function srtToText(srt) {
  if (!srt || typeof srt !== 'string') return '';
  const out = [];
  let last = '';
  for (const block of srt.trim().replace(/\r\n/g, '\n').split(/\n\n+/)) {
    const lines = block.split('\n');
    const tsIdx = lines.findIndex((l) => l.includes('-->'));
    if (tsIdx === -1) continue;
    const text = lines
      .slice(tsIdx + 1)
      .join(' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text && text !== last) {
      out.push(text);
      last = text;
    }
  }
  let joined = out.join(' ').replace(/\s+/g, ' ').trim();
  if (joined.length > MAX_TRANSCRIPT_CHARS) {
    joined = joined.slice(0, MAX_TRANSCRIPT_CHARS).replace(/\s+\S*$/, '') + '…';
  }
  return joined;
}

/**
 * Fetch the video transcript from the translate service (same contract as the
 * SPA's useSubtitles hook): list subtitles, prefer English, then pull the SRT
 * from the IPFS CDN. Best-effort and time-boxed — never blocks the bot
 * response; returns { text, lang } or null.
 */
async function fetchTranscript(author, permlink) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2500);
  try {
    const listRes = await fetch(
      `${TRANSLATE_API_URL}/subtitles/${author}/${permlink}`,
      { signal: ctrl.signal },
    );
    if (!listRes.ok) return null;
    const list = await listRes.json();
    if (!Array.isArray(list) || list.length === 0) return null;

    const entry = list.find((l) => l && l.lang === 'en') || list[0];
    if (!entry || !entry.cid) return null;

    const srtRes = await fetch(`${BUNNY_IPFS_CDN}/ipfs/${entry.cid}`, {
      signal: ctrl.signal,
    });
    if (!srtRes.ok) return null;
    const text = srtToText(await srtRes.text());
    if (!text) return null;
    return { text, lang: entry.lang || 'en' };
  } catch (_) {
    return null; // timeout / network / parse — transcript is optional
  } finally {
    clearTimeout(timer);
  }
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
function buildOgHtml({
  title,
  description,
  image,
  url,
  duration,
  author,
  noindex,
  uploadDate,
  embedUrl,
  transcript,
}) {
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const safeImage = escapeHtml(image);
  const safeUrl = escapeHtml(url);
  const safeAuthor = escapeHtml(author);

  const durationMeta = duration
    ? `<meta property="og:video:duration" content="${Math.round(duration)}" />`
    : '';

  const robotsMeta = noindex
    ? '<meta name="robots" content="noindex, follow" />'
    : '<meta name="robots" content="index, follow" />';

  // schema.org VideoObject — drives Google Video results / rich results.
  // JSON.stringify safely escapes values for a <script type=ld+json> block.
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: title,
    description: description || title,
    thumbnailUrl: image,
    contentUrl: url,
    embedUrl,
    url,
    author: { '@type': 'Person', name: `@${author}`, url: `${BASE_URL}/user/${author}` },
    publisher: {
      '@type': 'Organization',
      name: '3Speak',
      logo: { '@type': 'ImageObject', url: FALLBACK_THUMBNAIL },
    },
  };
  if (uploadDate) ld.uploadDate = uploadDate;
  const isoDuration = secondsToISO8601(duration);
  if (isoDuration) ld.duration = isoDuration;
  if (transcript) ld.transcript = transcript;
  const jsonLd = `<script type="application/ld+json">${JSON.stringify(ld).replace(
    /</g,
    '\\u003c',
  )}</script>`;

  const transcriptSection = transcript
    ? `\n  <section>\n    <h2>Transcript</h2>\n    <p>${escapeHtml(transcript)}</p>\n  </section>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${safeTitle} - 3Speak</title>
  ${robotsMeta}

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

  ${jsonLd}
</head>
<body>
  <h1>${safeTitle}</h1>
  <p><a href="${safeUrl}">${safeTitle}</a> by @${safeAuthor} on <a href="${escapeHtml(BASE_URL)}">3Speak</a></p>
  <p>${safeDesc}</p>${transcriptSection}
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
    // Transcript only needs author/permlink, so fetch it in parallel with the
    // post to avoid adding latency to the bot response.
    const [post, transcriptResult] = await Promise.all([
      fetchHivePost(video.author, video.permlink),
      fetchTranscript(video.author, video.permlink),
    ]);
    if (!post) return; // post not found, fall through to SPA

    const meta = parseMeta(post.json_metadata);

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
    const selfUrl = `${BASE_URL}/watch?v=${video.author}/${video.permlink}`;
    const canonicalUrl = resolveCanonical(meta, selfUrl);
    const duration = videoInfo.duration || null;
    const { index } = getIndexability(post, meta);

    const html = buildOgHtml({
      title,
      description,
      image,
      url: canonicalUrl,
      duration,
      author: video.author,
      noindex: !index,
      uploadDate: toIsoDate(post.created),
      embedUrl: `${BASE_URL}/embed?v=${video.author}/${video.permlink}`,
      // Skip the transcript on noindexed pages — no SEO value there.
      transcript: index ? transcriptResult?.text || null : null,
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
