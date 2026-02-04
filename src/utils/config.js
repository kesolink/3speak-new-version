// Check if we're in development mode
const isDev = import.meta.env.DEV;

const API_URL_FROM_WEST = import.meta.env.VITE_API_URL_FROM_WEST;
const GRAPHQL_API_URL = import.meta.env.VITE_GRAPHQL_API_URL;
const VIDEO_CDN_DOMAIN = import.meta.env.VITE_APP_VIDEO_CDN_DOMAIN;
const UPLOAD_TOKEN = import.meta.env.VITE_UPLOAD_TOKEN;
const UPLOAD_URL = import.meta.env.VITE_UPLOAD_URL;
const PLAYER_URL = import.meta.env.VITE_PLAYER_URL;

// Use proxy paths in development to avoid CORS issues
const HIVE_API_URL = isDev
  ? '/api/hive'
  : (import.meta.env.VITE_HIVE_API_URL || 'https://techcoderx.com');

const FEED_URL = isDev
  ? '/api/feed'
  : import.meta.env.VITE_FEED_URL;

const VIEWS_URL = isDev
  ? '/api/views'
  : import.meta.env.VITE_VIEWS_URL;

const TAG_FEED_URL = isDev
  ? '/api/feed'
  : import.meta.env.VITE_THREESPEAK_TAG_FEED_URL;

const PLAYLISTS_API_URL = import.meta.env.VITE_PLAYLISTS_API_URL || 'https://3speak-playlists.okinoko.io/api';

// Watch history threshold - number of days to show unwatched indicator
const WATCH_HISTORY_THRESHOLD_DAYS = parseInt(import.meta.env.VITE_WATCH_HISTORY_THRESHOLD_DAYS || '14', 10);

// Hive API nodes - in dev mode, only use the proxy
const HIVE_API_NODES = isDev
  ? ['/api/hive']
  : [
      import.meta.env.VITE_HIVE_API_URL || 'https://techcoderx.com',
      'https://api.deathwing.me',
      'https://api.openhive.network'
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
  WATCH_HISTORY_THRESHOLD_DAYS
};
