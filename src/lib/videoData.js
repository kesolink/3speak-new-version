// Replacements for the retired union GraphQL API (union.us-02.infra.3speak.tv).
// Video metadata now comes from Hive (post + account), suggestions from the
// checker REST API, and the HLS source from play.3speak.tv — the same sources
// the rest of the app and the player SDK already use. Shapes mirror what the
// old `socialPost` / `profile` / feed queries returned so callers are unchanged.
import { getHiveClient } from '../utils/hiveNode';
import { getPlayerUrl } from '../utils/playerUrl';
import { useAppStore } from './store';

// Extra feed params: interests (checker weights the feed toward them), currentuser
// (needed for BOTH the always-on dismissals and hide-watched), and the
// hide-watched preference itself.
function feedParams() {
  let p = '';
  try {
    const st = useAppStore.getState();
    const list = st.interests;
    if (Array.isArray(list) && list.length) p += `&interests=${encodeURIComponent(list.join(','))}`;
    if (st.user) {
      p += `&currentuser=${encodeURIComponent(st.user)}`;
      p += `&hidewatched=${st.hideWatched ? '1' : '0'}`;
    }
  } catch (_) { /* ignore */ }
  return p;
}

const hiveClient = getHiveClient();
const CHECKER_URL = import.meta.env.VITE_CHECKER_URL || 'https://checker.3speak.tv';
// Read the player backend at USE-time (getPlayerUrl) so it reflects the health-picked
// fallback, not the primary captured at module load.

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
      avatar: p.profile_image || `https://images.hive.blog/u/${username}/avatar/small`,
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
      const r = await fetch(`${getPlayerUrl()}${path}?v=${author}/${permlink}`);
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
    // A finished OpenPods stream gets its recording published as a VOD under
    // the SAME owner/permlink. The Hive post keeps `video.live: true` forever,
    // so the watch page needs this to know the stream is over and a real
    // video is ready. `isPlaceholder` is the encoder's "still processing" card.
    status: data.status || null,
    published: data.status === 'published' && data.isPlaceholder !== true,
  };
}

// Video post details — replaces GET_VIDEO_DETAILS. Built straight from the Hive
// post (the player loads its own source via author/permlink, so the spkvideo
// here is only a hint for the editor/clip feature). Same shape the old
// `socialPost` HivePost returned.
export async function fetchVideoDetails(author, permlink) {
  if (!author || author === 'unknown' || !permlink) return null;
  let post;
  try {
    post = await hiveClient.call('condenser_api', 'get_content', [author, permlink]);
  } catch (err) {
    // Newer Hive nodes throw a JSON-RPC assertion error ("Post a/p does not
    // exist", code -32602) for a missing post instead of returning an empty
    // object. That's "not found" (→ null), NOT a network problem — only genuine
    // transport failures should bubble up and show the "Network error" screen.
    const msg = String(err?.message || err || '').toLowerCase();
    if (msg.includes('does not exist') || msg.includes('-32602') || msg.includes('assert')) {
      return null;
    }
    throw err;
  }
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

  // Live OpenPods session announced via a full post (see openpodAnnounce):
  // `video.live` marks it, and the room name doubles as the permlink. The
  // watch page renders the live player in place of the VOD one, but keeps all
  // the real-post features (details, voting, commenting).
  const live = !!meta.video?.live;
  const roomName = live ? (meta.openpodRoom || videoInfo.permlink || permlink) : null;

  return {
    live,
    roomName,
    title: post.title,
    body: post.body,
    author: {
      id: post.author,
      username: post.author,
      profile: {
        name: post.author,
        images: { avatar: `https://images.hive.blog/u/${post.author}/avatar/small` },
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

// Sidebar recommendations for a watch page: biased toward the current video's
// topic, the user's interests, and the same creator (see /feeds/related).
//
// Returns `currentTopic` alongside the videos — the winning topic the checker
// resolved for THIS video. The recommended-shorts rail reuses it to ask for shorts
// about the same thing, so that costs no extra round trip.
const EMPTY_RELATED = { videos: [], currentTopic: null };

export async function fetchRelatedFeed(author, permlink, limit = 24) {
  if (!author || !permlink || author === 'unknown') return EMPTY_RELATED;
  try {
    const r = await fetch(
      `${CHECKER_URL}/feeds/related/${encodeURIComponent(author)}/${encodeURIComponent(permlink)}?limit=${limit}${feedParams()}`
    );
    const j = await r.json();
    return { videos: j?.videos || [], currentTopic: j?.currentTopic || null };
  } catch (_) { return EMPTY_RELATED; }
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
