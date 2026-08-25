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
/**
 * When this viewer should next be offered an ad, whoever the advertiser is.
 *
 * 🚨 This is a TIMESTAMP, not an identifier, and the distinction is the whole reason
 * it is allowed to be durable at all. CAP_ID below is deliberately per page load
 * because a persistent random id is a viewing profile in all but name. An expiry is
 * not: it is one number, identical for everyone who saw an ad at the same moment,
 * with no history behind it and nothing to correlate across visits.
 *
 * It exists so the quiet period survives navigating to the next video — the whole
 * point being that five videos should not carry five different advertisers in a row.
 * Server-side is authoritative for anyone signed in; this is what covers the rest.
 *
 * Read and written through try/catch: storage throws outright in some privacy modes,
 * and an ad decision must never be the thing that breaks a page.
 */
const COOLDOWN_KEY = '3speak-ad-last-seen';
export function lastAdSeenAt() {
  try {
    const n = Number(localStorage.getItem(COOLDOWN_KEY));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch { return null; }
}
export function rememberAdSeen(at = Date.now()) {
  try { localStorage.setItem(COOLDOWN_KEY, String(Math.round(at))); }
  catch { /* storage unavailable — the server still caps a signed-in viewer */ }
}

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
  // The banner is a SEPARATE placement, from a separate advertiser, that can be
  // present with or without a spot. It is not a second kind of break: it adds no
  // time to the timeline, so it never affects contentTime() — the picture changes,
  // the clock does not.
  let banner = null;
  let bannerWindow = null;
  // A banner-only playback still has a session to ask /i about, and it is the same
  // sid — both placements ride one session — but it is read from the banner's own
  // manifest URL because that is the only one present in that case.
  let bannerSid = null;

  return {
    get active() { return !!session; },
    get info() { return session; },
    get resolved() { return !!window_; },

    /** The banner running on this playback, or null. */
    get bannerInfo() { return banner; },

    /**
     * Is the banner on screen at this moment?
     *
     * Measured in CONTENT time, because that is what the banner's position is a
     * percentage of and what the stitcher burned it against. On a playback that also
     * carries a spot, player time runs ahead of content time by the length of the
     * break, so comparing raw player time would put the click target in the wrong
     * place for exactly as long as the spot lasted.
     */
    isBannerVisible(playerTime) {
      if (!bannerWindow || !Number.isFinite(playerTime)) return false;
      const t = this.contentTime(playerTime);
      return t >= bannerWindow.start && t < bannerWindow.start + bannerWindow.duration;
    },
    /** True when the server said this playback is ad-free because the viewer is Pro. */
    get isPremiumViewer() { return premium; },

    async request({ owner, permlink, viewer, manifestUrl }) {
      session = null;
      window_ = null;
      banner = null;
      bannerWindow = null;
      bannerSid = null;
      premium = false;
      if (!owner || !permlink || !manifestUrl) return null;
      try {
        const res = await fetch(`${AD_BASE}/m/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // `lastAdAt` is the quiet period travelling with the viewer rather than
          // with an identity we refuse to keep. The server treats it as a reason to
          // withhold an ad, never as a reason to grant one.
          body: JSON.stringify({
            owner, permlink, viewer: viewer || null, manifestUrl, capId: CAP_ID,
            lastAdAt: lastAdSeenAt(),
          }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        premium = data?.premium === true;
        // Stamped as soon as the server hands one over, not when it finishes playing:
        // a viewer who skips away mid-spot has still had their ad for this window.
        if (data?.ad?.manifestUrl || data?.banner?.manifestUrl) rememberAdSeen();

        // Kept whether or not there is also a spot: a playback can carry a banner
        // alone, and then the banner's manifest is the one to load.
        if (data?.banner?.manifestUrl) {
          bannerSid = (data.banner.manifestUrl.match(/\/m\/([0-9a-f]{32})\.m3u8/) || [])[1] || null;
          banner = {
            positionPercent: data.banner.positionPercent,
            durationSeconds: data.banner.durationSeconds,
            advertiser: data.banner.advertiser || null,
            brand: data.banner.brand || null,
            // Where the server burned it, in frame percentages. Never assumed here.
            placement: data.banner.placement || null,
            manifestUrl: data.banner.manifestUrl,
          };
        }

        if (!data || !data.ad || !data.ad.manifestUrl) {
          // No spot, but a banner still needs its manifest loaded and its window
          // resolved — so report the banner as the thing to play.
          return banner ? { bannerOnly: true, manifestUrl: banner.manifestUrl } : null;
        }
        const sid = (data.ad.manifestUrl.match(/\/m\/([0-9a-f]{32})\.m3u8/) || [])[1];
        if (!sid) return null;
        session = {
          sid,
          manifestUrl: data.ad.manifestUrl,
          position: data.ad.position,
          durationSeconds: data.ad.durationSeconds,
          label: data.ad.label || 'Sponsored',
          advertiser: data.ad.advertiser || null,
          // Who the ad is from, for the overlay. Absent fields are fine: the
          // overlay renders what is there and omits what is not.
          brand: data.ad.brand || null,
        };
        return session;
      } catch {
        return null;
      }
    },

    /** Learn where the break actually landed. Safe to call repeatedly. */
    async resolve() {
      // A banner-only playback has no session sid of its own here, so the id comes
      // from whichever placement produced the manifest.
      const sid = session?.sid || bannerSid;
      if (!sid) return window_;
      if (window_ && (!banner || bannerWindow)) return window_;
      for (let i = 0; i < RESOLVE_TRIES; i += 1) {
        try {
          const res = await fetch(`${AD_BASE}/m/${sid}/i`);
          if (res.ok) {
            const d = await res.json();
            if (banner && !bannerWindow
              && typeof d.bannerStartAt === 'number' && d.bannerDurationSeconds) {
              bannerWindow = { start: d.bannerStartAt, duration: d.bannerDurationSeconds };
            }
            if (session && !window_
              && typeof d.adStartAt === 'number' && d.adDurationSeconds) {
              window_ = { start: d.adStartAt, duration: d.adDurationSeconds };
            }
            // Done once everything present has been located.
            const spotDone = !session || !!window_;
            const bannerDone = !banner || !!bannerWindow;
            if (spotDone && bannerDone) return window_;
          }
        } catch { /* keep trying */ }
        await sleep(RESOLVE_DELAY_MS);
      }
      return null;
    },

    /**
     * Seconds until the break starts, or null when that is not a useful question
     * (no spot, not resolved yet, or the playhead is already past the cut).
     *
     * Drives the "ad in 3… 2… 1" hint. A break that arrives unannounced is the part
     * of mid-roll advertising people hate most; a few seconds of warning costs the
     * advertiser nothing and is the difference between an interruption and a beat.
     */
    secondsUntil(playerTime) {
      if (!window_ || !Number.isFinite(playerTime)) return null;
      const left = window_.start - playerTime;
      return left > 0 ? left : null;
    },

    /**
     * Seconds until the content resumes, or null when not inside the break.
     *
     * Derived from the SAME window the disclosure and the watch tracker use, so the
     * number on screen can never disagree with when the video actually comes back.
     */
    secondsRemaining(playerTime) {
      if (!window_ || !Number.isFinite(playerTime)) return null;
      const { start, duration } = window_;
      if (playerTime < start || playerTime >= start + duration) return null;
      return Math.max(0, start + duration - playerTime);
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

    reset() { session = null; window_ = null; banner = null; bannerWindow = null; bannerSid = null; premium = false; },
  };
}
