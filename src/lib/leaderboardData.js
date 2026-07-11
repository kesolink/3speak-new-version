// Leaderboard data layer — talks to the checker's /leaderboard endpoints, which
// serve the pre-aggregated `leaderboard` collection (one row per window+user,
// carrying all five metrics).
import { CHECKER_URL } from '../utils/config';

export const WINDOWS = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '365d', label: 'Year' },
  { id: 'all', label: 'All time' },
];

// `watch` metrics are only tracked from the checker's WATCH_TRACKED_SINCE date;
// the board response flags that per metric via partial_watch_data.
export const METRICS = [
  { id: 'video_uploads', label: 'Videos', unit: 'count', blurb: 'Videos uploaded' },
  { id: 'short_uploads', label: 'Shorts', unit: 'count', blurb: 'Shorts uploaded' },
  { id: 'video_watch_secs', label: 'Video watch time', unit: 'duration', blurb: 'Seconds their videos were watched' },
  { id: 'short_watch_secs', label: 'Shorts watch time', unit: 'duration', blurb: 'Seconds their shorts were watched' },
  { id: 'tags_given', label: 'Tags', unit: 'count', blurb: 'Tags given to other videos' },
];

// The metric tabs are the SAME list whether or not a topic is selected — the
// labels must never change under the user. The four content metrics exist on
// both the overall board and the per-topic boards (same field names), so picking
// a topic just re-points the query, it doesn't redefine the choices.
//
// `tags_given` is the exception: tags aren't tracked per topic, so when it's the
// selected metric there is no topic board to show and the topic row hides.
const TOPIC_CAPABLE = new Set([
  'video_uploads',
  'short_uploads',
  'video_watch_secs',
  'short_watch_secs',
]);

export function metricSupportsTopics(id) {
  return TOPIC_CAPABLE.has(id);
}

export const DEFAULT_WINDOW = '7d';
export const DEFAULT_METRIC = 'video_uploads';

export function metricById(id) {
  return METRICS.find((m) => m.id === id) || METRICS[0];
}

async function get(path) {
  const r = await fetch(`${CHECKER_URL}${path}`);
  if (!r.ok) throw new Error(`leaderboard ${path} → ${r.status}`);
  const data = await r.json();
  if (data && data.success === false) throw new Error(data.error || 'leaderboard error');
  return data;
}

// One ranked board. Returns { entries: [{ rank, user, ...all five metrics }], … }.
export function fetchLeaderboard({ window = DEFAULT_WINDOW, metric = DEFAULT_METRIC, limit = 50, page = 1 } = {}) {
  return get(`/leaderboard?window=${window}&metric=${metric}&limit=${limit}&page=${page}`);
}

// A creator's stat line + rank per metric. Users with no activity in a rolling
// window have no row at all, so the checker reports them as zeros with null
// ranks rather than 404 — callers can render the result unconditionally.
export function fetchUserLeaderboardStats(username, window = DEFAULT_WINDOW) {
  return get(`/leaderboard/user/${encodeURIComponent(username)}?window=${window}`);
}

// The 16 topics the tagger assigns. Rarely changes, so it's cached hard.
export function fetchTopics() {
  return get('/leaderboard/topics');
}

// One topic's board. Same window/paging contract and the same metric field names
// as the main board, so only the collection behind it differs.
export function fetchTopicLeaderboard({ topic, window = DEFAULT_WINDOW, metric = DEFAULT_METRIC, limit = 50, page = 1 }) {
  return get(`/leaderboard/topic?topic=${encodeURIComponent(topic)}&window=${window}&metric=${metric}&limit=${limit}&page=${page}`);
}

// Profile badges: the user's best standing per metric across all windows,
// already tiered by the checker (#1 / Top 3 / Top 10 / Top 50 / Top 100).
export function fetchLeaderboardBadges(username) {
  return get(`/leaderboard/badges/${encodeURIComponent(username)}`);
}

// Badges sit in a crowded profile header next to the follower count and social
// links, so the label stays terse ("#1 Videos") and the icon carries the topic.
// The full sentence lives in the hover title.
const BADGE_NOUNS = {
  video_uploads: 'Videos',
  short_uploads: 'Shorts',
  video_watch_secs: 'Watched',
  short_watch_secs: 'Shorts Watched',
  tags_given: 'Tagger',
};

// "Top 100" is too easy to earn to be worth a badge (a few uploads gets you
// there on a quiet window), so profiles only show Top 50 and better.
const BADGE_TIERS = ['top1', 'top3', 'top10', 'top50'];
export const MAX_PROFILE_BADGES = 3;

export function badgeLabel(badge) {
  return `${badge.tier_label} ${BADGE_NOUNS[badge.metric] || badge.metric}`;
}

export function badgeTitle(badge) {
  const w = WINDOWS.find((x) => x.id === badge.window);
  const scope = badge.window === 'all' ? 'all time' : `the last ${w ? w.label.toLowerCase() : badge.window}`;
  return `Ranked #${badge.rank} for ${metricById(badge.metric).blurb.toLowerCase()} over ${scope}`;
}

// Strongest first, capped — a profile shows a highlight reel, not a résumé.
export function visibleBadges(badges) {
  return (badges || [])
    .filter((b) => BADGE_TIERS.includes(b.tier))
    .slice(0, MAX_PROFILE_BADGES);
}

// Compact duration for watch-time columns: 4h 12m / 12m 30s / 45s.
export function formatDuration(secs) {
  const s = Math.max(0, Math.round(secs || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function formatMetric(value, unit) {
  if (unit === 'duration') return formatDuration(value);
  return Number(value || 0).toLocaleString();
}
