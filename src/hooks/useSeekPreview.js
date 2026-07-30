import { useCallback, useEffect, useRef, useState } from 'react';
import { createLowResPreviewPlayer } from '../lib/lowResPreviewPlayer';

/**
 * Scrub-preview thumbnails with ZERO extra storage — the same low-res technique
 * as the homepage hover cards (see lowResPreviewPlayer + useHoverPreview): a
 * detached SDK Player pinned to the LOWEST HLS rendition on a hidden <video>.
 * Instead of playing it (cards) we seek it to the hovered timestamp, so the tiny
 * low-res frame under the cursor becomes the preview — no storyboard/GIF needed.
 *
 * Returns:
 *   videoRef      → attach to the hidden <video> inside the preview box
 *   preview       → { visible, leftPx, time } for positioning + timestamp
 *   previewWidth  → box width (px), used for clamping
 *   showAt(clientX), hide()  → drive from the scrubber's hover/drag handlers
 *   fmtTime(s)    → mm:ss / h:mm:ss label formatter
 */
const PREVIEW_W = 168;

function fmtTime(s) {
  s = Math.max(0, Math.floor(Number(s) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function useSeekPreview({ videoId, trackRef, duration, getPlaybackHeight }) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const readyRef = useRef(false);
  const loadedRef = useRef(false); // lazy: only load the stream on first interaction
  const pendingRef = useRef(null); // latest requested preview time
  const [preview, setPreview] = useState({ visible: false, leftPx: 0, time: 0 });
  // Kept for the callers' "timestamp only" styling. Nothing sets it any more — the
  // rung-based suppression that did is gone (see the createLowResPreviewPlayer note
  // below) — but the flag stays so a future cheap-preview policy can reuse it.
  const [frameless, setFrameless] = useState(false);

  // Apply the pending seek only when the element is idle; the 'seeked' handler
  // re-fires this so we always chase the LATEST requested time without a backlog.
  const applySeek = useCallback(() => {
    const v = videoRef.current;
    const t = pendingRef.current;
    if (!v || !readyRef.current || t == null) return;
    if (v.seeking) return;
    if (Math.abs(v.currentTime - t) < 0.2) return;
    try { v.currentTime = t; } catch { /* not seekable yet */ }
  }, []);

  // Attach the detached low-res player for this video (no stream loaded yet).
  useEffect(() => {
    readyRef.current = false;
    loadedRef.current = false;
    pendingRef.current = null;
    setFrameless(false);
    const el = videoRef.current;
    if (!videoId || !el) return undefined;

    // NOTE: deliberately NOT passing requirePreviewRung. 3Speak videos ship a SINGLE
    // 480p rung, so "is the lowest rung smaller than what playback uses?" is never
    // true and that guard suppressed the frame on effectively every video. Instead we
    // bound the cost by only loading while the user is actually scrubbing (below).
    const player = createLowResPreviewPlayer(el, {
      loop: false,
      getPlaybackHeight,
    });
    playerRef.current = player;

    const onReady = () => { readyRef.current = true; applySeek(); };
    el.addEventListener('loadeddata', onReady);
    el.addEventListener('seeked', applySeek);

    return () => {
      el.removeEventListener('loadeddata', onReady);
      el.removeEventListener('seeked', applySeek);
      try { player.destroy(); } catch { /* noop */ }
      playerRef.current = null;
    };
  }, [videoId, applySeek]);

  // Lazily load the lowest rendition on the first scrub interaction — no
  // bandwidth spent for viewers who never touch the timeline.
  const ensureLoaded = useCallback(() => {
    const player = playerRef.current;
    if (!player || loadedRef.current) return;
    loadedRef.current = true;
    // Just load + buffer the lowest rendition — no play() (that trips the
    // autoplay policy). Seeking an HLS-buffered <video> paints the frame on its
    // own; readyRef flips on 'loadeddata' and applySeek() runs the pending seek.
    player.load(videoId).catch(() => { loadedRef.current = false; });
  }, [videoId]);

  // Position + seek the preview to the timestamp under clientX.
  const showAt = useCallback((clientX) => {
    const track = trackRef.current;
    if (!track || !duration) return;
    ensureLoaded();
    const rect = track.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const t = frac * duration;
    pendingRef.current = t;
    applySeek();
    let leftPx = frac * rect.width - PREVIEW_W / 2;
    leftPx = Math.max(0, Math.min(Math.max(0, rect.width - PREVIEW_W), leftPx));
    setPreview({ visible: true, leftPx, time: t });
  }, [trackRef, duration, applySeek, ensureLoaded]);

  const hide = useCallback(() => {
    // Only hide the box. Do NOT stop the underlying stream: tearing segment loading
    // down on mouseleave left the element half-buffered (a black frame) and it did
    // not recover on the next hover. The stream is lazy, pinned to the lowest rung
    // and capped at a 10s buffer, so leaving it alone is the cheap, working state.
    setPreview((p) => (p.visible ? { ...p, visible: false } : p));
  }, []);

  return { videoRef, preview, previewWidth: PREVIEW_W, frameless, showAt, hide, fmtTime };
}
