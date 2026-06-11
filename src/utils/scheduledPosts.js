// Shared client for the checker's scheduled-posts API.
//
// Scheduled posts are videos whose file is already uploaded to the embed service
// but whose Hive broadcast is deferred — the checker stores the fully-built post
// and a 5-minute cron broadcasts it as @threespeak at the due time. Until then
// the post is NOT on Hive, so it can only be read/edited through these endpoints.
//
// Endpoints (all on the checker, VITE_SCHEDULED_POSTS_API_URL):
//   GET  /scheduled-posts/:owner?status=scheduled   → { scheduled_posts: [...] }
//   POST /scheduled-posts/update                     (used by EditScheduledPost)
//   POST /scheduled-posts/cancel                     (used by EditScheduledPost)

import axios from 'axios';

export const SCHEDULED_CHECKER_BASE = (
  import.meta.env.VITE_SCHEDULED_POSTS_API_URL || 'https://prod-checker.okinoko.io'
).replace(/\/$/, '');

/** All of a user's still-scheduled posts (most are a handful; cap at 100). */
export async function fetchScheduledPosts(owner) {
  if (!owner) return [];
  try {
    const res = await axios.get(
      `${SCHEDULED_CHECKER_BASE}/scheduled-posts/${encodeURIComponent(owner)}`,
      { params: { status: 'scheduled', limit: 100 } },
    );
    return Array.isArray(res.data?.scheduled_posts) ? res.data.scheduled_posts : [];
  } catch (err) {
    console.warn('[scheduledPosts] fetch list failed', err);
    return [];
  }
}

/** A single scheduled post by (owner, permlink), or null. */
export async function fetchScheduledPost(owner, permlink) {
  if (!owner || !permlink) return null;
  const all = await fetchScheduledPosts(owner);
  return all.find((p) => p.permlink === permlink) || null;
}

/**
 * The playable embed reference (owner/permlink) for a scheduled post.
 *
 * The player resolves the embed *asset*, not the Hive post (which isn't linked
 * until publish). For embed-studio uploads the asset is created with the SAME
 * permlink as the Hive post (`generatedPermlink` is used for both — see
 * EmbedUploadContext), so the Hive permlink resolves the asset. We still prefer
 * the explicit embed URL / embedPermlink when the full doc carries them (e.g. a
 * future single-doc endpoint), then fall back to owner/permlink — the only
 * fields the list endpoint returns.
 *
 * @returns {{ owner: string, permlink: string } | null}
 */
export function getScheduledEmbedRef(doc) {
  if (!doc) return null;
  const url = doc.jsonMetadata?.video?.url || doc.embedUrl || null;
  if (url) {
    try {
      const v = new URL(url).searchParams.get('v');
      if (v && v.includes('/')) {
        const [owner, permlink] = v.split('/');
        if (owner && permlink) return { owner, permlink };
      }
    } catch { /* fall through */ }
  }
  if (doc.embedPermlink && doc.owner) {
    return { owner: doc.owner, permlink: doc.embedPermlink };
  }
  // List-endpoint fallback: embed asset permlink === Hive permlink for these uploads.
  if (doc.owner && doc.permlink) {
    return { owner: doc.owner, permlink: doc.permlink };
  }
  return null;
}

/**
 * Shape a scheduled doc into the object Card3 expects. Reuses Card3's existing
 * scheduled status badge (`status==='scheduled' && publish_type==='schedule'`)
 * and the `_scheduled` marker so Card3 can point the card at the watch page in
 * scheduled mode.
 */
export function normalizeScheduledForCard(doc) {
  return {
    _id: `scheduled:${doc.id ?? doc.permlink}`,
    _scheduled: true,
    id: doc.id,
    owner: doc.owner,
    author: doc.owner,
    permlink: doc.permlink,
    title: doc.title || '(untitled)',
    description: doc.description || '',
    thumbnail: doc.thumbnail || null,
    // Card3 reads spkvideo for the thumbnail + duration overlay.
    spkvideo: { thumbnail_url: doc.thumbnail || null, duration: 0 },
    status: 'scheduled',
    publish_type: 'schedule',     // triggers Card3's scheduled badge
    publish_data: doc.scheduledOn, // badge shows this date
    scheduledOn: doc.scheduledOn,
    created_at: doc.createdAt,
  };
}
