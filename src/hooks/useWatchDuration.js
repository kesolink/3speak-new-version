import { useEffect, useRef } from 'react';
import { getPlayerUrl } from '../utils/playerUrl';
import { useAppStore } from '../lib/store';
import { resolveVideoMeta } from '../lib/videoMetaCache';

/**
 * Drives the snapievideoplayer watch-duration heartbeat against the player
 * backend (getPlayerUrl()) from an SDK usePlayer() instance.
 *
 *   POST /api/watch/start → opens a server-side session (HMAC token bound to
 *     sid.owner.permlink.ip), returns a beat interval.
 *   POST /api/watch/beat  → sent (throttled) while the video is really playing,
 *     plus a final beat on pause / tab-hide / unmount. The server credits only
 *     the wall-clock gap it measures between beats, so watch time can't be
 *     forged with a single request.
 *
 * Records watched seconds + % of duration (with the viewer IP + video) into the
 * backend's `view-durations` collection. This is the "non-polluting" path — it
 * NEVER increments the view counter (mirrors the /play route), so preview
 * playback doesn't inflate production view counts.
 *
 * @param {object}  args
 * @param {object}  args.api          ThreeSpeakApi instance (to resolve the embed asset owner/permlink)
 * @param {string}  args.author       URL author
 * @param {string}  args.permlink     URL permlink
 * @param {object}  args.playerState  usePlayer() state ({ paused, currentTime, duration })
 * @param {boolean} args.enabled      gate (e.g. false for scheduled/unpublished posts)
 */
export default function useWatchDuration({ api, author, permlink, playerState, enabled = true }) {
  const sessionRef = useRef({ sid: null, token: null, beatMs: 5000, lastBeatAt: 0 });
  const startingRef = useRef(false);
  const key = author && author !== 'unknown' && permlink ? `${author}/${permlink}` : null;

  // Latest playback position + rate, kept in refs so the stable beat() reads the
  // current values (position → timeline-coverage/heatmap; rate → avg-speed stat).
  const posRef = useRef(0);
  posRef.current = Number(playerState?.currentTime) || 0;
  const rateRef = useRef(1);
  rateRef.current = Number(playerState?.playbackRate) || 1;

  // Reset session state whenever the video changes.
  useEffect(() => {
    sessionRef.current = { sid: null, token: null, beatMs: 5000, lastBeatAt: 0 };
    startingRef.current = false;
  }, [key]);

  const beat = () => {
    const s = sessionRef.current;
    if (!s.sid) return;
    s.lastBeatAt = Date.now(); // throttle before the async call so we don't double-fire
    // fetch(keepalive) — not sendBeacon: the beat is CROSS-origin to PLAYER_URL
    // with a JSON body (not CORS-safelisted), which a beacon can drop. keepalive
    // survives unload and does a proper CORS request.
    try {
      fetch(`${getPlayerUrl()}/api/watch/beat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sid: s.sid, token: s.token, position: posRef.current, rate: rateRef.current }),
        keepalive: true,
      }).catch(() => {});
    } catch { /* best-effort — never disrupt playback */ }
  };

  // Open a measured session on first real play.
  useEffect(() => {
    if (!enabled || !key) return;
    if (playerState?.paused !== false) return;         // only once genuinely playing
    if (sessionRef.current.sid || startingRef.current) return;
    startingRef.current = true;

    (async () => {
      // Resolve the embed ASSET owner/permlink (the URL permlink is often the
      // Hive permlink; the backend matches the embed asset). Fall back to the
      // URL values when metadata isn't available (legacy videos).
      let owner = author;
      let vPermlink = permlink;
      // Shared session cache — the view recorder resolves the same /api/embed
      // metadata; this dedupes both into one request per video.
      const meta = await resolveVideoMeta(api, author, permlink);
      if (meta?.owner) owner = meta.owner;
      if (meta?.permlink) vPermlink = meta.permlink;

      // Prefer the STORED duration from the embed metadata we just resolved
      // over playerState.duration. Under HLS/MSE the player's own duration,
      // read at first play, can transiently report only the buffered-so-far
      // segment span instead of the full manifest total — that race is what
      // recorded 6s for a 120s video and poisoned retention/heatmap data.
      // The live reading stays as the fallback for anything the metadata
      // doesn't cover (e.g. legacy videos with no stored duration).
      const storedDuration = Number(meta?.duration);
      const duration = (Number.isFinite(storedDuration) && storedDuration > 0)
        ? storedDuration
        : (Number(playerState?.duration) || undefined);
      // A video lives in exactly one collection — try embed (also matches
      // hive_permlink) then legacy; whichever owns it opens the session.
      for (const type of ['embed', 'legacy']) {
        try {
          const res = await fetch(`${getPlayerUrl()}/api/watch/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ owner, permlink: vPermlink, type, duration, position: posRef.current, source: '3speak', private: !!useAppStore.getState().privateMode }),
          });
          if (!res.ok) continue;                       // 404 for the wrong collection → try the next
          const data = await res.json().catch(() => null);
          if (data?.sid) {
            sessionRef.current = {
              sid: data.sid,
              token: data.token,
              beatMs: (data.beatSeconds || 5) * 1000,
              lastBeatAt: Date.now(),                  // first beat one interval from now
            };
            break;
          }
          if (data && data.tracked === false) break;   // no measurable duration
        } catch { /* try the next type */ }
      }
      startingRef.current = false;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, playerState?.paused]);

  // Beat while playing — driven (throttled) by the SDK's currentTime updates,
  // which only advance while the video is genuinely playing.
  useEffect(() => {
    const s = sessionRef.current;
    if (!enabled || !s.sid || playerState?.paused) return;
    if (Date.now() - s.lastBeatAt >= s.beatMs) beat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, playerState?.currentTime, playerState?.paused]);

  // Final measured beat when playback pauses.
  useEffect(() => {
    if (playerState?.paused && sessionRef.current.sid) beat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerState?.paused]);

  // Flush the tail on tab-hide / unmount (sendBeacon survives unload).
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') beat(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
      beat();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
