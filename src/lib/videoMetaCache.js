/**
 * Session-scoped cache for a video's player metadata (`/api/embed?v=author/permlink`,
 * the {owner, permlink, status, …} the player backend returns).
 *
 * The watch page resolves this SAME metadata from several independent places —
 * the view-count recorder and the watch-duration session both need the embed
 * ASSET's owner/permlink (the URL permlink is usually the Hive permlink, which
 * the backend doesn't match). Left alone, each fires its own /api/embed request
 * for the identical video, so the endpoint is hit 2x per watch on top of the
 * player SDK's own internal resolution during load().
 *
 * This memoizes the in-flight PROMISE (concurrent callers share one request) and
 * its result for the session. A video's owner/permlink mapping is immutable, so
 * there's no staleness concern. It lives at module scope on purpose: it survives
 * React StrictMode's dev mount→unmount→remount, unlike a per-component ref.
 *
 * A failed lookup is evicted so a later attempt can retry (callers fall back to
 * the URL author/permlink when this resolves to null).
 */
const cache = new Map(); // "author/permlink" -> Promise<meta|null>
const MAX = 200;

export function resolveVideoMeta(api, author, permlink) {
  const key = `${author}/${permlink}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const p = (async () => {
    try {
      return (await api?.fetchVideoMetadata?.(author, permlink)) || null;
    } catch {
      cache.delete(key); // transient failure — allow a retry later
      return null;
    }
  })();

  if (cache.size >= MAX) cache.delete(cache.keys().next().value);
  cache.set(key, p);
  return p;
}
