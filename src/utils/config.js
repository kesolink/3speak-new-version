const API_URL_FROM_WEST = import.meta.env.VITE_API_URL_FROM_WEST;
const GRAPHQL_API_URL = import.meta.env.VITE_GRAPHQL_API_URL;
const VIDEO_CDN_DOMAIN = import.meta.env.VITE_APP_VIDEO_CDN_DOMAIN;
const UPLOAD_TOKEN = import.meta.env.VITE_UPLOAD_TOKEN;
const UPLOAD_URL = import.meta.env.VITE_UPLOAD_URL;
const PLAYER_URL = import.meta.env.VITE_PLAYER_URL;

const HIVE_API_URL = import.meta.env.VITE_HIVE_API_URL || 'https://techcoderx.com';
const FEED_URL = import.meta.env.VITE_FEED_URL || 'https://legacy.3speak.tv';
const VIEWS_URL = import.meta.env.VITE_VIEWS_URL || 'https://views.3speak.tv';
const TAG_FEED_URL = import.meta.env.VITE_THREESPEAK_TAG_FEED_URL || 'https://legacy.3speak.tv';
const PLAYLISTS_API_URL = import.meta.env.VITE_PLAYLISTS_API_URL || 'https://3speak-playlists.okinoko.io/api';

const TRENDING_SORTED_URL = import.meta.env.VITE_TRENDING_SORTED_URL || 'https://tags.3speak.tv/feeds/trendingSorted';
const FOLLOW_FEED_URL = import.meta.env.VITE_FOLLOW_FEED_URL || 'https://tags.3speak.tv/feed';

const EDITOR_URL = import.meta.env.VITE_EDITOR_URL || 'https://editor.3speak.tv';

// Feature flags
const FEATURE_EDITOR = import.meta.env.VITE_FEATURE_EDITOR === 'true';

// 3Speak Embed upload (for video reactions)
const EMBED_UPLOAD_URL = import.meta.env.VITE_EMBED_UPLOAD_URL || 'https://embed.3speak.tv/uploads';
const EMBED_API_URL = import.meta.env.VITE_EMBED_API_URL || 'https://embed.3speak.tv';
const EMBED_API_KEY = import.meta.env.VITE_EMBED_API_KEY || '';

// Watch history threshold - number of days to show unwatched indicator
const WATCH_HISTORY_THRESHOLD_DAYS = parseInt(import.meta.env.VITE_WATCH_HISTORY_THRESHOLD_DAYS || '14', 10);

const HIVE_API_NODES = [
  import.meta.env.VITE_HIVE_API_URL || 'https://techcoderx.com',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];

export {
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
  PLAYER_URL,
  PLAYLISTS_API_URL,
  WATCH_HISTORY_THRESHOLD_DAYS,
  EMBED_UPLOAD_URL,
  EMBED_API_URL,
  EMBED_API_KEY,
  TRENDING_SORTED_URL,
  FOLLOW_FEED_URL,
  EDITOR_URL,
  FEATURE_EDITOR,
};
