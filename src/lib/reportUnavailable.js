import { CHECKER_URL } from '../utils/config';
import { markVideoDead } from './deadVideos';

/**
 * Report a video whose media appears to be GONE.
 *
 * A dead video is worse than no video: it takes a feed slot and plays nothing. When
 * a manifest comes back as a hard 404 — from a card's hover preload or from a fatal
 * player error on the watch page — we tell the checker, which (if it agrees) drops
 * the video from every feed permanently.
 *
 * This signal is deliberately allowed to be SLOPPY. The client never decides
 * anything: the checker re-fetches the manifest itself across every gateway and bans
 * only on a unanimous, definite 404. That matters because 3Speak migrates content off
 * the hot IPFS zone after a while, so a healthy old video 404s on hotipfs while
 * ipfs.3speak.tv still serves it fine — a client-side verdict would quietly gut the
 * archive. A false report here costs one server-side re-check and nothing else.
 *
 * Fire-and-forget: the user's view never changes and errors are swallowed. Reported
 * at most once per video per page load, since every card in a feed preloads its own
 * manifest and a dead one would otherwise report on every scroll-by.
 */
const reported = new Set();

export function reportVideoUnavailable(author, permlink, url) {
  if (!author || !permlink || author === 'unknown') return;

  const key = `${author}/${permlink}`;
  if (reported.has(key)) return;
  reported.add(key);

  try {
    fetch(`${CHECKER_URL}/video/report-unavailable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author, permlink, url: url || null }),
      keepalive: true,   // survives the navigation away from a dead watch page
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        // Pull the card out of the grid on screen — but ONLY on the server's verdict.
        // Acting on the 404 the browser saw would yank healthy videos: a hot-zone miss
        // 404s in the browser while the video is perfectly alive elsewhere. The server
        // has checked every gateway by this point.
        if (j?.banned) markVideoDead(author, permlink);
      })
      .catch(() => { /* best effort */ });
  } catch { /* best effort */ }
}
