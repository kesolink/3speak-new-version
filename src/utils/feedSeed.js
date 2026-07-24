/**
 * One shuffle seed per PAGE LOAD, shared by every seeded feed (discover,
 * interests, trending, shorts).
 *
 * Why module state and nothing else:
 *   - It's created once when the bundle is evaluated, so it stays the SAME across
 *     every SPA navigation — go to a video, come back, switch tabs: same order.
 *   - A real browser refresh re-evaluates the module, so you get a NEW order.
 * That is exactly "stable for my session, reshuffled when I hit reload".
 *
 * Deliberately NOT sessionStorage/localStorage: those SURVIVE a refresh, so the
 * seed would never change. And deliberately not the server's default 5-minute
 * time bucket, which reshuffles under you every 5 minutes even if you never touch
 * anything (that's what the discover/interests feeds were doing — they sent no
 * seed at all).
 *
 * Bonus: the checker caches its sorted shorts list keyed by seed. Regenerating the
 * seed on every visit to /shorts (the old behaviour) minted a fresh cache entry and
 * re-ran the full pipeline each time. A stable per-session seed reuses it.
 */
let SESSION_SEED = Math.floor(Math.random() * 1_000_000);

/** The current session's seed. Stable until the page is reloaded. */
export function getFeedSeed() {
  return SESSION_SEED;
}

/**
 * Force a new shuffle WITHOUT a page reload. Only for explicit "give me something
 * new" gestures (e.g. pull-to-refresh) — never on navigation or component mount,
 * which is what made the feed reshuffle behind the user's back.
 */
export function regenerateFeedSeed() {
  SESSION_SEED = Math.floor(Math.random() * 1_000_000);
  return SESSION_SEED;
}

/**
 * Refetch the home-page feeds IN PLACE (no page reload) with a fresh shuffle and
 * the current store state — the feeds read `interests`/`showNsfw`/etc. live from
 * the store at fetch time, so this is what makes newly-picked interests take
 * effect. Shared by HomeGrouped's pull-to-refresh AND the interests prompt's save.
 * `queryClient` is the app-wide react-query client; keys mirror HomeGrouped's.
 */
export async function refreshHomeFeeds(queryClient, { authenticated, user } = {}) {
  if (!queryClient) return;
  regenerateFeedSeed();
  await queryClient.invalidateQueries({ queryKey: authenticated ? ['follow-feed', user] : ['home-grouped'] });
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['discover-grouped'] }),
    queryClient.invalidateQueries({ queryKey: ['interests-grouped'] }),
    queryClient.invalidateQueries({ queryKey: ['newcontent-grouped'] }),
  ]);
}
