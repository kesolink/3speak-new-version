const API_URL_FROM_WEST = import.meta.env.VITE_API_URL_FROM_WEST;
const GRAPHQL_API_URL = import.meta.env.VITE_GRAPHQL_API_URL;
const VIDEO_CDN_DOMAIN = import.meta.env.VITE_APP_VIDEO_CDN_DOMAIN;
const UPLOAD_TOKEN = import.meta.env.VITE_UPLOAD_TOKEN;
const UPLOAD_URL = import.meta.env.VITE_UPLOAD_URL;
const PLAYER_URL = import.meta.env.VITE_PLAYER_URL;

const HIVE_API_URL = import.meta.env.VITE_HIVE_API_URL || 'https://techcoderx.com';
const FEED_URL = import.meta.env.VITE_FEED_URL || 'https://legacy.3speak.tv';
const CHECKER_URL = import.meta.env.VITE_CHECKER_URL || 'https://3speak-checker.okinoko.io';
const TAG_FEED_URL = CHECKER_URL;
const PLAYLISTS_API_URL = import.meta.env.VITE_PLAYLISTS_API_URL || 'https://3speak-playlists.okinoko.io/api';

// All derived from CHECKER_URL
const VIEWS_URL = CHECKER_URL;
const MY_VIDEOS_URL = CHECKER_URL;
const TRENDING_SORTED_URL = `${CHECKER_URL}/feeds/trendingSorted`;
const FOLLOW_FEED_URL = `${CHECKER_URL}/feed`;
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
const EMBED_DEBUG = import.meta.env.VITE_EMBED_DEBUG === 'true';

// 3Speak Image Upload Service (thumbnail uploads)
const IMAGE_UPLOAD_URL = import.meta.env.VITE_IMAGE_UPLOAD_URL || 'https://images.3speak.tv';
const IMAGE_UPLOAD_KEY = import.meta.env.VITE_IMAGE_UPLOAD_KEY || '';

// Translation API (LibreTranslate)
const TRANSLATE_API_URL = import.meta.env.VITE_TRANSLATE_API_URL || 'https://3speak-translator.okinoko.io';

// Watch history threshold - number of days to show unwatched indicator
const WATCH_HISTORY_THRESHOLD_DAYS = parseInt(import.meta.env.VITE_WATCH_HISTORY_THRESHOLD_DAYS || '14', 10);

const HIVE_API_NODES = [
  import.meta.env.VITE_HIVE_API_URL || 'https://techcoderx.com',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];

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

export {
  appendNsfw,
  API_URL_FROM_WEST,
  GRAPHQL_API_URL,
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
  EMBED_UPLOAD_URL,
  EMBED_API_URL,
  EMBED_API_KEY,
  TRANSLATE_API_URL,
  TRENDING_SORTED_URL,
  FOLLOW_FEED_URL,
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
};
