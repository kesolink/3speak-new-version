/**
 * Client half of server-side ad insertion, for the SDK-based watch page.
 *
 * Deliberately a near-copy of preview-player/src/adBreak.js rather than a shared
 * package: the two live in different services with different build chains, and a
 * new npm dependency between them costs more than this duplication does. If a
 * third player ever needs it, that is the moment to extract it.
 *
 * The spot is already inside the playlist by the time the player sees it, so
 * nothing here fetches an ad and there is no request for a blocker to match. What
 * this does is the bookkeeping the player cannot do alone:
 *
 *  1. ASK whether this playback carries a spot, and hand back a source to load.
 *  2. MAP the player's timeline back to content time. The important one: in a
 *     stitched stream currentTime includes the ad, so every ad second would
 *     otherwise be recorded as watch time against the creator's video — poisoning
 *     the retention data the ad forecast is itself built from.
 *  3. Say when the playhead is inside the break, so a Sponsored label can show.
 *
 * Every failure path returns "no ad". A video must never fail to play because the
 * ad system had a bad day.
 */
import { CHECKER_URL } from '../utils/config';

const AD_BASE = CHECKER_URL;

// The stitcher only learns where the cut fell when a variant playlist is fetched,
// a beat after the source is set. Retry briefly rather than guess — a wrong offset
// silently corrupts watch data, which is worse than no label.
const RESOLVE_TRIES = 6;
const RESOLVE_DELAY_MS = 700;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Frequency-cap id for a viewer we cannot name. Per page load, in memory only —
 * never localStorage, never a cookie. It dies with the tab, so one browsing session
 * is capped without any durable anonymous identifier existing.
 */
const CAP_ID = (() => {
  try {
    const a = new Uint8Array(12);
    (globalThis.crypto || {}).getRandomValues?.(a);
    return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
})();

export function createAdBreak() {
  let session = null;
  let window_ = null;
  let premium = false;

  return {
    get active() { return !!session; },
    get info() { return session; },
    get resolved() { return !!window_; },
    /** True when the server said this playback is ad-free because the viewer is Pro. */
    get isPremiumViewer() { return premium; },

    async request({ owner, permlink, viewer, manifestUrl }) {
      session = null;
      window_ = null;
      premium = false;
      if (!owner || !permlink || !manifestUrl) return null;
      try {
        const res = await fetch(`${AD_BASE}/m/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ owner, permlink, viewer: viewer || null, manifestUrl, capId: CAP_ID }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        premium = data?.premium === true;
        if (!data || !data.ad || !data.ad.manifestUrl) return null;
        const sid = (data.ad.manifestUrl.match(/\/m\/([0-9a-f]{32})\.m3u8/) || [])[1];
        if (!sid) return null;
        session = {
          sid,
          manifestUrl: data.ad.manifestUrl,
          position: data.ad.position,
          durationSeconds: data.ad.durationSeconds,
          label: data.ad.label || 'Sponsored',
          advertiser: data.ad.advertiser || null,
        };
        return session;
      } catch {
        return null;
      }
    },

    /** Learn where the break actually landed. Safe to call repeatedly. */
    async resolve() {
      if (!session || window_) return window_;
      for (let i = 0; i < RESOLVE_TRIES; i += 1) {
        try {
          const res = await fetch(`${AD_BASE}/m/${session.sid}/i`);
          if (res.ok) {
            const d = await res.json();
            if (typeof d.adStartAt === 'number' && d.adDurationSeconds) {
              window_ = { start: d.adStartAt, duration: d.adDurationSeconds };
              return window_;
            }
          }
        } catch { /* keep trying */ }
        await sleep(RESOLVE_DELAY_MS);
      }
      return null;
    },

    isInside(playerTime) {
      if (!window_ || !Number.isFinite(playerTime)) return false;
      return playerTime >= window_.start && playerTime < window_.start + window_.duration;
    },

    /**
     * Player time → content time. Inside the break the content has not advanced at
     * all, so it pins to the cut point; after it, the ad's length comes off. This
     * is what keeps ad seconds out of `view-durations`.
     */
    contentTime(playerTime) {
      if (!window_ || !Number.isFinite(playerTime)) return playerTime;
      const { start, duration } = window_;
      if (playerTime < start) return playerTime;
      if (playerTime < start + duration) return start;
      return playerTime - duration;
    },

    reset() { session = null; window_ = null; premium = false; },
  };
}
