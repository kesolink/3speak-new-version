const API_URL_FROM_WEST = import.meta.env.VITE_API_URL_FROM_WEST;
const VIDEO_CDN_DOMAIN = import.meta.env.VITE_APP_VIDEO_CDN_DOMAIN;
const UPLOAD_TOKEN = import.meta.env.VITE_UPLOAD_TOKEN;
const UPLOAD_URL = import.meta.env.VITE_UPLOAD_URL;
const PLAYER_URL = import.meta.env.VITE_PLAYER_URL;

const HIVE_API_URL = import.meta.env.VITE_HIVE_API_URL || 'https://api.hive.blog';
const FEED_URL = import.meta.env.VITE_FEED_URL || 'https://legacy.3speak.tv';
const CHECKER_URL = import.meta.env.VITE_CHECKER_URL || 'https://3speak-checker.okinoko.io';
const TAG_FEED_URL = CHECKER_URL;
const PLAYLISTS_API_URL = import.meta.env.VITE_PLAYLISTS_API_URL || 'https://3speak-playlists.okinoko.io/api';

// All derived from CHECKER_URL
const VIEWS_URL = CHECKER_URL;
const MY_VIDEOS_URL = CHECKER_URL;
const TRENDING_SORTED_URL = `${CHECKER_URL}/feeds/trendingSorted`;
const FOLLOW_FEED_URL = `${CHECKER_URL}/feed`;
// Discovery feed: interest + retention driven, ignores votes/views entirely.
const DISCOVER_FEED_URL = `${CHECKER_URL}/feeds/discover`;
const NEW_CONTENT_URL = `${CHECKER_URL}/feeds/new`;
const FIRST_UPLOADS_URL = `${CHECKER_URL}/feeds/firstUploads`;
const SHORTS_STORIES_URL = `${CHECKER_URL}/shorts/stories`;
const SHORTS_API_URL = `${CHECKER_URL}/shortssorted`;
const USER_SHORTS_API_URL = `${CHECKER_URL}/shorts`;

// Editor URLs — comma-separated list; a random reachable one is selected at runtime
const EDITOR_URLS = (import.meta.env.VITE_EDITOR_URLS || import.meta.env.VITE_EDITOR_URL || 'https://editor.3speak.tv')
  .split(',')
  .map(u => u.trim())
  .filter(Boolean);

/**
 * Pick a random reachable editor URL from the configured list.
 * Shuffles the list, then HEAD-requests each until one responds non-404.
 * Returns the first working URL, or null if none are reachable.
 */
async function getEditorUrl() {
  const shuffled = [...EDITOR_URLS].sort(() => Math.random() - 0.5);
  for (const url of shuffled) {
    try {
      const res = await fetch(url, { method: 'HEAD', mode: 'no-cors', cache: 'no-store' });
      // mode: 'no-cors' returns opaque response (status 0) which is fine —
      // it means the server responded. A network error would throw instead.
      return url;
    } catch {
      // Network error — server unreachable, try next
    }
  }
  return null;
}

// Feature flags
const FEATURE_EDITOR = import.meta.env.VITE_FEATURE_EDITOR === 'true';
const COMPACT_SIDEBAR = import.meta.env.VITE_COMPACT_SIDEBAR === 'true';

// 3Speak Embed upload (for video reactions)
const EMBED_UPLOAD_URL = import.meta.env.VITE_EMBED_UPLOAD_URL || 'https://embed.3speak.tv/uploads';
const EMBED_API_URL = import.meta.env.VITE_EMBED_API_URL || 'https://embed.3speak.tv';
const EMBED_API_KEY = import.meta.env.VITE_EMBED_API_KEY || '';

// Pool of embed-upload server BASE hosts (no trailing /uploads), e.g.
// "https://embed2.3speak.tv,https://embed3.3speak.tv". The uploader picks the
// least-busy reachable one per upload (see utils/embedEndpoints.js). Leave unset
// to use the single EMBED_API_URL host. Each host must share the same MongoDB +
// EMBED_API_KEY so any can serve the post-upload /video/* writes.
const parseHosts = (v) => (v ? v.split(/[\s,]+/) : [])
  .map((h) => h.trim().replace(/\/+$/, '').replace(/\/uploads$/, ''))
  .filter(Boolean);
const EMBED_UPLOAD_HOSTS = parseHosts(import.meta.env.VITE_EMBED_UPLOAD_URLS);
// Slow / last-resort upload hosts (e.g. the legacy embed.3speak.tv). These are
// used ONLY when no primary EMBED_UPLOAD_HOSTS host is reachable, so the fast
// servers (embed2 / embed-okinoko) stay the prominent choice. See
// utils/embedEndpoints.js.
const EMBED_UPLOAD_FALLBACK_HOSTS = parseHosts(import.meta.env.VITE_EMBED_UPLOAD_FALLBACK_URLS);
const EMBED_DEBUG = import.meta.env.VITE_EMBED_DEBUG === 'true';
const THREESPEAK_AUDIO_API_URL = import.meta.env.VITE_3SPEAK_AUDIO_API_URL || 'https://audio.3speak.tv';
const THREESPEAK_API_KEY = import.meta.env.VITE_3SPEAK_API_KEY || '';
// Account that receives 100% beneficiaries when an audio post is published in
// "pay-per-listen" mode. Temporary value until the per-listen payout program
// ships — override with VITE_PPL_BENEFICIARY.
const PPL_BENEFICIARY = import.meta.env.VITE_PPL_BENEFICIARY || 'tibfox';
// Optional shared key to obfuscate audio listen heartbeats. Must equal the
// checker's LISTEN_BEAT_KEY. Empty → plaintext beats (still server-measured).
const LISTEN_BEAT_KEY = import.meta.env.VITE_LISTEN_BEAT_KEY || '';

// 3Speak Image Upload Service (thumbnail uploads)
const IMAGE_UPLOAD_URL = import.meta.env.VITE_IMAGE_UPLOAD_URL || 'https://images.3speak.tv';
const IMAGE_UPLOAD_KEY = import.meta.env.VITE_IMAGE_UPLOAD_KEY || '';

// Translation API (LibreTranslate)
const TRANSLATE_API_URL = import.meta.env.VITE_TRANSLATE_API_URL || 'https://3speak-translator.okinoko.io';

// Social verifier (mantequilla-social-verifier) — md5-hash ownership proof for web2 socials
// Social-link verifier was merged into the checker — it now serves /verify
// at the checker host. (Env still overrides for local/testnet.)
const SOCIAL_VERIFIER_URL = (import.meta.env.VITE_SOCIAL_VERIFIER_URL || 'https://3speak-checker.okinoko.io').replace(/\/$/, '');

// Watch history threshold - number of days to show unwatched indicator
const WATCH_HISTORY_THRESHOLD_DAYS = parseInt(import.meta.env.VITE_WATCH_HISTORY_THRESHOLD_DAYS || '14', 10);

// Optional manual override for the Resource Credit cost we require before letting
// a user start an upload (in raw RC units). Leave unset to estimate it live from
// the chain's rc_api params — see src/utils/rcCheck.js. Set a number to pin it.
const POST_RC_COST = import.meta.env.VITE_POST_RC_COST
  ? Number(import.meta.env.VITE_POST_RC_COST)
  : null;

// Hive RPC candidate pool — primary first, then fallbacks. Both env vars are
// optional; leave them unset to use these defaults. VITE_HIVE_API_FALLBACKS is
// comma- or whitespace-separated.
const DEFAULT_HIVE_PRIMARY = 'https://api.hive.blog';
const DEFAULT_HIVE_FALLBACKS = [
  'https://api.deathwing.me',
  'https://api.openhive.network',
  'https://techcoderx.com',
];
const parseList = (s) => (s || '')
  .split(/[\s,]+/)
  .map((x) => x.trim())
  .filter(Boolean);

const HIVE_API_NODES = (() => {
  const primary = import.meta.env.VITE_HIVE_API_URL || DEFAULT_HIVE_PRIMARY;
  const fallbacks = import.meta.env.VITE_HIVE_API_FALLBACKS
    ? parseList(import.meta.env.VITE_HIVE_API_FALLBACKS)
    : DEFAULT_HIVE_FALLBACKS;
  return [...new Set([primary, ...fallbacks])];
})();

/**
 * Append nsfw=true to a URL when NSFW content is enabled.
 * @param {string} url - The URL to modify
 * @param {boolean} showNsfw - Whether NSFW content should be shown
 */
function appendNsfw(url, showNsfw) {
  if (!showNsfw) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}nsfw=true`;
}

const REPORT_API_URL = import.meta.env.VITE_REPORT_API_URL;
const REPORT_API_SECRET = import.meta.env.VITE_REPORT_API_SECRET;
// Bearer key for the checker's protected PUT /video/thumbnail (Pancreas
// API). Empty → the immediate-Mongo-update is skipped (Hive→Mongo sync
// still reconciles it). Must equal the checker's API_SECRET_KEY.
const CHECKER_API_KEY = import.meta.env.VITE_CHECKER_API_KEY || '';

// Feature flags for MetaMask Snap login and 3Speak Pro subscriptions
const ENABLE_METAMASK_SNAP = import.meta.env.VITE_ENABLE_METAMASK_SNAP === 'true';
// Default-on: only disabled when explicitly set to "false".
const ENABLE_BUTRAUTH = import.meta.env.VITE_ENABLE_BUTRAUTH !== 'false';
const ENABLE_SUBS = import.meta.env.VITE_ENABLE_SUBS === 'true';
// Pay-per-listen reward controls in the audio uploader. Enabled by
// default; set VITE_ENABLE_PPL=false to hide the earn-mode chooser and
// never attach the PPL beneficiary op.
const ENABLE_PPL = import.meta.env.VITE_ENABLE_PPL !== 'false';

export {
  appendNsfw,
  API_URL_FROM_WEST,
  VIDEO_CDN_DOMAIN,
  HIVE_API_URL,
  HIVE_API_NODES,
  UPLOAD_TOKEN,
  UPLOAD_URL,
  TAG_FEED_URL,
  FEED_URL,
  VIEWS_URL,
  MY_VIDEOS_URL,
  CHECKER_URL,
  PLAYER_URL,
  PLAYLISTS_API_URL,
  WATCH_HISTORY_THRESHOLD_DAYS,
  POST_RC_COST,
  EMBED_UPLOAD_URL,
  EMBED_API_URL,
  EMBED_UPLOAD_HOSTS,
  EMBED_UPLOAD_FALLBACK_HOSTS,
  EMBED_API_KEY,
  TRANSLATE_API_URL,
  TRENDING_SORTED_URL,
  FOLLOW_FEED_URL,
  DISCOVER_FEED_URL,
  NEW_CONTENT_URL,
  FIRST_UPLOADS_URL,
  SHORTS_STORIES_URL,
  SHORTS_API_URL,
  USER_SHORTS_API_URL,
  EDITOR_URLS,
  getEditorUrl,
  FEATURE_EDITOR,
  COMPACT_SIDEBAR,
  EMBED_DEBUG,
  IMAGE_UPLOAD_URL,
  IMAGE_UPLOAD_KEY,
  REPORT_API_URL,
  REPORT_API_SECRET,
  CHECKER_API_KEY,
  PPL_BENEFICIARY,
  LISTEN_BEAT_KEY,
  ENABLE_METAMASK_SNAP,
  ENABLE_BUTRAUTH,
  ENABLE_SUBS,
  ENABLE_PPL,
  THREESPEAK_AUDIO_API_URL,
  THREESPEAK_API_KEY,
  SOCIAL_VERIFIER_URL,
};
