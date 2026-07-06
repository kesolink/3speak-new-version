// Replacements for the retired union GraphQL API (union.us-02.infra.3speak.tv).
// Video metadata now comes from Hive (post + account), suggestions from the
// checker REST API, and the HLS source from play.3speak.tv — the same sources
// the rest of the app and the player SDK already use. Shapes mirror what the
// old `socialPost` / `profile` / feed queries returned so callers are unchanged.
import { getHiveClient } from '../utils/hiveNode';
import { useAppStore } from './store';

// Extra feed params: interests (checker weights the feed toward them) and, when
// "Hide watched" is on, currentuser (checker skips already-seen videos).
function feedParams() {
  let p = '';
  try {
    const st = useAppStore.getState();
    const list = st.interests;
    if (Array.isArray(list) && list.length) p += `&interests=${encodeURIComponent(list.join(','))}`;
    if (st.hideWatched && st.user) p += `&currentuser=${encodeURIComponent(st.user)}`;
  } catch (_) { /* ignore */ }
  return p;
}

const hiveClient = getHiveClient();
const CHECKER_URL = import.meta.env.VITE_CHECKER_URL || 'https://checker.3speak.tv';
const PLAYER_URL = import.meta.env.VITE_PLAYER_URL || 'https://play.3speak.tv';

function parseMeta(jm) {
  if (!jm) return {};
  if (typeof jm === 'object') return jm;
  try { return JSON.parse(jm); } catch { return {}; }
}

// Hive profile — replaces GET_PROFILE / USER_DETAILS.
export async function fetchHiveProfile(username) {
  if (!username) return null;
  let account = null;
  try {
    const accounts = await hiveClient.call('condenser_api', 'get_accounts', [[username]]);
    account = accounts?.[0] || null;
  } catch (_) { /* fall through to a minimal profile */ }

  const meta = parseMeta(account?.posting_json_metadata);
  const legacy = parseMeta(account?.json_metadata);
  const p = meta.profile || legacy.profile || {};
  return {
    id: username,
    did: username,
    username,
    name: p.name || username,
    about: p.about || '',
    images: {
      avatar: p.profile_image || `https://images.hive.blog/u/${username}/avatar`,
      cover: p.cover_image || '',
    },
  };
}

// HLS play source — replaces GET_VIDEO.spkvideo. play.3speak.tv resolves the
// manifest from author/permlink (embed assets first, then legacy videos), the
// same path the player SDK's load()/fetchSource() takes.
export async function fetchPlaySource(author, permlink) {
  if (!author || author === 'unknown' || !permlink) return null;
  const tryPath = async (path) => {
    try {
      const r = await fetch(`${PLAYER_URL}${path}?v=${author}/${permlink}`);
      if (!r.ok) return null;
      const j = await r.json();
      if (!j || j.success === false || !j.videoUrl) return null;
      return j;
    } catch (_) { return null; }
  };
  const data = (await tryPath('/api/embed')) || (await tryPath('/api/watch'));
  if (!data) return null;
  return {
    play_url: data.videoUrl,
    thumbnail_url: data.thumbnail || data.thumbnailUrl || null,
    duration: data.duration || 0,
  };
}

// Video post details — replaces GET_VIDEO_DETAILS. Built straight from the Hive
// post (the player loads its own source via author/permlink, so the spkvideo
// here is only a hint for the editor/clip feature). Same shape the old
// `socialPost` HivePost returned.
export async function fetchVideoDetails(author, permlink) {
  if (!author || author === 'unknown' || !permlink) return null;
  const post = await hiveClient.call('condenser_api', 'get_content', [author, permlink]);
  if (!post || !post.author) return null;

  const meta = parseMeta(post.json_metadata);
  const videoInfo = meta.video?.info || {};

  let thumbnail_url = null;
  if (videoInfo.sourceMap) {
    const t = videoInfo.sourceMap.find((s) => s.type === 'thumbnail');
    if (t) thumbnail_url = t.url;
  }
  if (!thumbnail_url && meta.image?.[0]) thumbnail_url = meta.image[0];

  let play_url = videoInfo.video_v2 || videoInfo.file || null;
  if (!play_url && videoInfo.sourceMap) {
    const v = videoInfo.sourceMap.find((s) => s.type === 'video');
    if (v) play_url = v.url;
  }

  const payout =
    parseFloat(post.total_payout_value) +
    parseFloat(post.curator_payout_value) +
    parseFloat(post.pending_payout_value || '0');

  let spkvideo = null;
  if (play_url) spkvideo = { play_url, thumbnail_url, duration: videoInfo.duration || 0 };
  else if (thumbnail_url) spkvideo = { play_url: null, thumbnail_url, duration: videoInfo.duration || 0 };

  return {
    title: post.title,
    body: post.body,
    author: {
      id: post.author,
      username: post.author,
      profile: {
        name: post.author,
        images: { avatar: `https://images.hive.blog/u/${post.author}/avatar` },
      },
    },
    stats: {
      num_comments: post.children || 0,
      num_votes: post.active_votes?.length || 0,
      total_hive_reward: payout,
    },
    community: post.category ? { _id: post.category, title: post.category } : null,
    created_at: post.created,
    tags: meta.tags || [],
    parent_permlink: post.parent_permlink,
    spkvideo,
  };
}

// Suggestion feeds — replace TRENDING_FEED / GET_AUTHOR_VIDEOS / GET_RELATED.
// Checker feed items already carry spkvideo/stats/images and are the shape Card3
// (and filterValidVideos) consume, so no remapping is needed.
export async function fetchTrendingFeed(limit = 20) {
  try {
    const r = await fetch(`${CHECKER_URL}/feeds/trendingSorted?limit=${limit}${feedParams()}`);
    const j = await r.json();
    return j?.videos || [];
  } catch (_) { return []; }
}

export async function fetchAuthorVideos(author, limit = 10) {
  if (!author || author === 'unknown') return [];
  try {
    const r = await fetch(
      `${CHECKER_URL}/api/my-videos?username=${encodeURIComponent(author)}&limit=${limit}&offset=0&status=published&sort=newest`,
    );
    const j = await r.json();
    // Shape: { success, data: { total, videos: [...] } }
    return j?.data?.videos || j?.videos || [];
  } catch (_) { return []; }
}
