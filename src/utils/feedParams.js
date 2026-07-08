import { useAppStore } from '../lib/store';

/**
 * Shared feed query params for every checker-backed discovery feed, so they all
 * behave the same way:
 *   - `interests=` — the user's selected interests (re-ranks matching videos up)
 *   - `currentuser=` — only when "Hide watched" is on (server drops seen videos)
 *
 * Returns a string like "&interests=a,b&currentuser=bob" (leading `&`), or "" when
 * neither applies — so it can be appended straight onto a feed URL. The checker
 * treats both as optional, so this is always safe to include.
 *
 * NOT used on the "new videos" feed, which must stay purely chronological.
 */
export function feedParams() {
  const st = useAppStore.getState();
  let p = '';
  const list = st.interests;
  if (Array.isArray(list) && list.length) p += `&interests=${encodeURIComponent(list.join(','))}`;
  if (st.hideWatched && st.user) p += `&currentuser=${encodeURIComponent(st.user)}`;
  return p;
}
