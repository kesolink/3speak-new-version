const API_URL_FROM_WEST = import.meta.env.VITE_API_URL_FROM_WEST;
const VIDEO_CDN_DOMAIN = import.meta.env.VITE_APP_VIDEO_CDN_DOMAIN;
const UPLOAD_TOKEN = import.meta.env.VITE_UPLOAD_TOKEN;
const UPLOAD_URL = import.meta.env.VITE_UPLOAD_URL;
// Ordered player backends (primary first). VITE_PLAYER_URLS is a comma-separated list
// used for automatic fallback (see utils/playerUrl.js); a single VITE_PLAYER_URL still
// works. PLAYER_URL is the provisional primary — prefer getPlayerUrl() at use-time so
// callers pick up the health-resolved backend.
const PLAYER_URLS = (import.meta.env.VITE_PLAYER_URLS || import.meta.env.VITE_PLAYER_URL || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const PLAYER_URL = PLAYER_URLS[0] || '';

const HIVE_API_URL = import.meta.env.VITE_HIVE_API_URL || 'https://api.hive.blog';
const FEED_URL = import.meta.env.VITE_FEED_URL || 'https://legacy.3speak.tv';
const CHECKER_URL = import.meta.env.VITE_CHECKER_URL || 'https://checker.3speak.tv';
const TAG_FEED_URL = CHECKER_URL;
const PLAYLISTS_API_URL = import.meta.env.VITE_PLAYLISTS_API_URL || 'https://3speak-playlists.okinoko.io/api';
// Playlist READS go through the 3speak server proxy (/api/pl/*), which holds the
// secret token server-side and forwards to the playlists API — the token is never
// shipped to the browser. Falls back to the direct API when unset (e.g. local dev
// with no proxy). Watch-history and reshares stay on PLAYLISTS_API_URL (ungated).
const PLAYLISTS_READ_URL = import.meta.env.VITE_PLAYLISTS_READ_URL || PLAYLISTS_API_URL;

// All derived from CHECKER_URL
const VIEWS_URL = CHECKER_URL;
const MY_VIDEOS_URL = CHECKER_URL;
const TRENDING_SORTED_URL = `${CHECKER_URL}/feeds/trendingSorted`;
const FOLLOW_FEED_URL = `${CHECKER_URL}/feed`;
// Discovery feed: interest + retention driven, ignores votes/views entirely.
const DISCOVER_FEED_URL = `${CHECKER_URL}/feeds/discover`;
// Dedicated interests feed. It has its OWN topic-stratified pool — the old
// `/feeds/discover?interestsOnly=1` filtered the discover pool, which is a uniform
// sample of the catalogue, so a single-topic filter starved it (science: 1 page).
const INTERESTS_FEED_URL = `${CHECKER_URL}/feeds/interests`;
// "Follow these" creator suggestions — interest-matched creators ranked by recent
// engagement (views+comments+reshares). Backs the rail on the discover/interests tabs.
const SUGGESTED_CREATORS_URL = `${CHECKER_URL}/feeds/suggested-creators`;
const NEW_CONTENT_URL = `${CHECKER_URL}/feeds/new`;
const FIRST_UPLOADS_URL = `${CHECKER_URL}/feeds/firstUploads`;
// Max length of a Short, in seconds. Every encoder node supports 2 minutes; keep
// this as the single source of truth for the upload gate, the react-video
// classifier and the user-facing hints so they can never drift apart.
const SHORTS_MAX_DURATION_SEC = parseInt(import.meta.env.VITE_SHORTS_MAX_DURATION_SEC, 10) || 120;

/** "2 minutes" / "90 seconds" — for hint + error copy. */
const shortsMaxDurationLabel = () => (
  SHORTS_MAX_DURATION_SEC % 60 === 0
    ? `${SHORTS_MAX_DURATION_SEC / 60} minute${SHORTS_MAX_DURATION_SEC === 60 ? '' : 's'}`
    : `${SHORTS_MAX_DURATION_SEC} seconds`
);

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
const SOCIAL_VERIFIER_URL = (import.meta.env.VITE_SOCIAL_VERIFIER_URL || 'https://checker.3speak.tv').replace(/\/$/, '');

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
// Default-on: only disabled when explicitly set to "false". A hidden soft-launch
// "unlock" (5 taps on the RPC node line in the profile menu) writes
// butrauth_unlocked=true to localStorage to force it on even when the env flag
// is off, so testers can reveal the Butter Auth login + signup before launch.
const ENABLE_BUTRAUTH = import.meta.env.VITE_ENABLE_BUTRAUTH !== 'false'
  || (typeof localStorage !== 'undefined' && localStorage.getItem('butrauth_unlocked') === 'true');
const ENABLE_SUBS = import.meta.env.VITE_ENABLE_SUBS === 'true';
// Pay-per-listen reward controls in the audio uploader. Enabled by
// default; set VITE_ENABLE_PPL=false to hide the earn-mode chooser and
// never attach the PPL beneficiary op.
const ENABLE_PPL = import.meta.env.VITE_ENABLE_PPL !== 'false';

// The standalone livestream studio as an OpenPods mode. Enabled by default;
// set VITE_OPENPODS_STANDALONE=false to hide the Room/Standalone tiles in the
// create dialog entirely, leaving OpenPods as conference rooms only.
const OPENPODS_STANDALONE = import.meta.env.VITE_OPENPODS_STANDALONE !== 'false';

// Gates the OpenPods live-streaming options in the create/share menu (the whole
// "Live" category). OFF by default — set VITE_ENABLE_OPENPODS=true to show it.
const ENABLE_OPENPODS = import.meta.env.VITE_ENABLE_OPENPODS === 'true';

// Hosts whose live streams / rooms are kept OUT of the discovery feeds
// (discover, follow, new). Same spirit as the checker's LEADERBOARD_EXCLUDED_USERS
// — the account still works normally and its streams stay reachable by direct
// link; they just don't get surfaced in the feeds. Comma-separated override.
const FEED_EXCLUDED_HOSTS = new Set(
  (import.meta.env.VITE_FEED_EXCLUDED_HOSTS ?? 'badadib')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);

// Mobile-only in-browser camera recorder with a voice-driven teleprompter
// (prototype). When on, the video upload step shows a "Record" button on phones
// that opens a front-camera recording page. Off unless explicitly "true".
const ENABLE_CAMERA_RECORD = import.meta.env.VITE_ENABLE_CAMERA_RECORD === 'true';

// Self-hosted streaming speech-to-text WebSocket for the teleprompter. Empty =
// use the browser Web Speech API only (which can't share the mic with the audio
// recording). When set, recording taps the SINGLE recording audio track and
// streams it here, so voice-scroll works DURING recording. See the STT plan.
const STT_WS_URL = import.meta.env.VITE_STT_WS_URL || '';

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
  PLAYER_URLS,
  PLAYLISTS_API_URL,
  PLAYLISTS_READ_URL,
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
  INTERESTS_FEED_URL,
  SUGGESTED_CREATORS_URL,
  NEW_CONTENT_URL,
  FIRST_UPLOADS_URL,
  SHORTS_MAX_DURATION_SEC,
  shortsMaxDurationLabel,
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
  OPENPODS_STANDALONE,
  ENABLE_OPENPODS,
  FEED_EXCLUDED_HOSTS,
  ENABLE_CAMERA_RECORD,
  STT_WS_URL,
  ENABLE_PPL,
  THREESPEAK_AUDIO_API_URL,
  THREESPEAK_API_KEY,
  SOCIAL_VERIFIER_URL,
};
