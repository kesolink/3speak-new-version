/**
 * The shorts surface's half of server-side ad insertion.
 *
 * A shorts spot is NOT stitched into anybody's short — it is its own item, a
 * full-screen vertical video played between one short and the next. So there is no
 * timeline to map and no break to detect: this asks whether it is time, and hands
 * back a manifest to play. See utils/adFormats.js `shorts_roll` for why the format
 * works that way rather than as a pre-roll.
 *
 * ⚠️ The cadence is counted in SHORTS WATCHED, not minutes. Someone swiping the feed
 * clears ten shorts well inside any sane time-based cooldown, so a minutes rule would
 * either silence the surface or fire constantly depending on how fast they swipe. The
 * count lives here, in memory, for the length of one visit — it is not a profile and
 * is not written to the device.
 *
 * Every failure path returns "no ad". A short must never fail to play because the ad
 * system had a bad day.
 */
import { CHECKER_URL } from '../utils/config';
import { rememberAdSeen } from './adBreak';

let watchedSinceAd = 0;

/** Count one short as watched. Called when the feed advances, not when it is opened. */
export function countShortWatched() {
  watchedSinceAd += 1;
}

/** How many have gone by since the last spot. Exposed for the cadence check and tests. */
export function shortsSinceAd() {
  return watchedSinceAd;
}

/**
 * Ask whether this viewer is due a spot.
 *
 * `owner`/`permlink` are the short they just FINISHED: that creator is the reason the
 * viewer was there for the slot, and is who the creator half of the revenue is owed
 * to. Returns null for "not yet", "nothing booked", or anything going wrong.
 */
export async function requestShortsAd({ owner, permlink, viewer }) {
  try {
    const res = await fetch(`${CHECKER_URL}/m/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        surface: 'shorts',
        owner: owner || null,
        permlink: permlink || null,
        viewer: viewer || null,
        shortsWatched: watchedSinceAd,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.shortsAd || !data.shortsAd.manifestUrl) return null;

    // The counter resets on a SPOT SERVED, not on a request. A run of "not yet"
    // answers must keep counting up, or the cadence never arrives.
    watchedSinceAd = 0;
    // A spot here also counts as this viewer's most recent ad for the watch page's
    // quiet period — one shared notion of "you have just seen an ad".
    rememberAdSeen();
    return data.shortsAd;
  } catch {
    return null;
  }
}

/** Forget the count — a fresh visit starts over. */
export function resetShortsAdCount() {
  watchedSinceAd = 0;
}
