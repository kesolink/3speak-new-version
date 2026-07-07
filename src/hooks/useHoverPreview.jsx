import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ThreeSpeakApi } from "@mantequilla-soft/3speak-player";
import { PLAYER_URL } from "../utils/config";
import { createLowResPreviewPlayer } from "../lib/lowResPreviewPlayer";
import { useAppStore } from "../lib/store";
import useSubtitles from "./useSubtitles";
import SubtitleOverlay from "../components/SubtitleOverlay/SubtitleOverlay";

// Statuses with no playable stream — never preview these.
const NON_PLAYABLE = new Set(["scheduled", "encoding", "draft", "failed", "deleted"]);

// Hover-to-play preview shared by any card grid (video cards, playlists, …).
// Desktop: plays the hovered card. Mobile (large mode only): auto-plays the card
// closest to the viewport centre as you scroll. Returns props to spread on the
// grid container + each card, plus the single reused <video>/Player overlay.
export default function useHoverPreview() {
  const previewEnabled = useAppStore((s) => s.previewEnabled !== false);
  const cardSize = useAppStore((s) => s.homeCardSize);

  const canHover = useMemo(
    () => typeof window !== "undefined" && window.matchMedia && window.matchMedia("(hover: hover)").matches,
    []
  );
  const isMobile = !canHover;
  // On mobile we only auto-play in large mode (full-width cards make it sensible).
  const mobileAutoplay = previewEnabled && isMobile && cardSize === "large";
  const active = previewEnabled && (canHover || mobileAutoplay);

  const containerRef = useRef(null);
  const overlayElRef = useRef(null);
  const videoElRef = useRef(null);
  const playerRef = useRef(null);
  const hoverTimer = useRef(null);
  const draggingRef = useRef(false);
  const [hover, setHover] = useState(null); // { key, author, permlink, thumb, source, rect }
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [curTime, setCurTime] = useState(0);
  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  // ── Preload visible tiles (lowest-res) + track card nodes for mobile centring ──
  const apiRef = useRef(null);
  if (!apiRef.current) apiRef.current = new ThreeSpeakApi(PLAYER_URL);
  const sourcesRef = useRef(new Map());
  const inflightRef = useRef(new Set());
  const cardNodesRef = useRef(new Set());
  const preload = useCallback((key, author, permlink) => {
    if (!key || !author || !permlink) return;
    const sources = sourcesRef.current;
    const inflight = inflightRef.current;
    if (sources.has(key) || inflight.has(key)) return;
    inflight.add(key);
    apiRef.current.fetchSource(author, permlink)
      .then((src) => { sources.set(key, src); apiRef.current.prefetchManifest(src.url).catch(() => {}); })
      .catch(() => {})
      .finally(() => inflight.delete(key));
  }, []);

  const observerRef = useRef(null);
  const observeCard = useCallback((node) => {
    if (!node || typeof IntersectionObserver === "undefined") return;
    cardNodesRef.current.add(node);
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const { postkey, author, permlink } = e.target.dataset;
            preload(postkey, author, permlink);
            observerRef.current.unobserve(e.target);
          }
        }
      }, { rootMargin: "300px" });
    }
    observerRef.current.observe(node);
  }, [preload]);
  useEffect(() => () => { observerRef.current?.disconnect(); cardNodesRef.current.clear(); }, []);

  // ── Single reused Player (only load() per active card) ──
  const ensurePlayer = useCallback(() => {
    if (playerRef.current) return playerRef.current;
    const el = videoElRef.current;
    if (!el) return null;
    // Shared lowest-rendition preview player (also used by the scrubber preview).
    const player = createLowResPreviewPlayer(el, { loop: true });
    playerRef.current = player;
    el.addEventListener("timeupdate", () => {
      if (!el.duration) return;
      if (!draggingRef.current) setProgress(el.currentTime / el.duration);
      setCurTime(el.currentTime);
    });
    // Reveal as soon as the first frame is decoded (snappier than waiting for 'playing').
    el.addEventListener("loadeddata", () => setReady(true));
    el.addEventListener("playing", () => setReady(true));
    return player;
  }, []);

  useEffect(() => {
    const player = hover ? ensurePlayer() : playerRef.current;
    if (!player) return;
    if (!hover) { try { player.pause(); } catch { /* ignore */ } return; }
    setReady(false);
    setProgress(0);
    setCurTime(0);
    player.load(hover.source || `${hover.author}/${hover.permlink}`)
      .then(() => { if (!player.destroyed) player.play().catch(() => {}); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hover?.key]);

  useEffect(() => () => { try { playerRef.current?.destroy(); } catch { /* ignore */ } }, []);

  // English subtitles for the active video (force 'en' if present, no persistence).
  const { cues, subtitleStyle } = useSubtitles(hover?.author, hover?.permlink, { autoEnglish: true });

  const rectOf = (node) => {
    const cont = containerRef.current;
    if (!node || !cont) return null;
    const r = node.getBoundingClientRect();
    const cr = cont.getBoundingClientRect();
    return { top: r.top - cr.top, left: r.left - cr.left, width: r.width, height: r.height };
  };

  // ── Mobile: auto-play the card nearest the viewport centre; keep the overlay
  //    positioned over it while scrolling. ──
  const mobileKeyRef = useRef(null);
  useEffect(() => {
    if (!mobileAutoplay) return;
    let raf = 0;
    const positionOverlay = (node) => {
      const el = overlayElRef.current;
      const rect = rectOf(node);
      if (!el || !rect) return;
      el.style.top = `${rect.top}px`;
      el.style.left = `${rect.left}px`;
      el.style.width = `${rect.width}px`;
      el.style.height = `${rect.height}px`;
    };
    const pick = () => {
      raf = 0;
      const vh = window.innerHeight;
      const mid = vh / 2;
      let best = null;
      let bestD = Infinity;
      // Only the card that straddles the viewport centre plays — so across the
      // page's separate row grids, just one video is ever active at a time.
      for (const node of cardNodesRef.current) {
        if (!node.isConnected) { cardNodesRef.current.delete(node); continue; }
        const r = node.getBoundingClientRect();
        if (r.height === 0 || r.top > mid || r.bottom < mid) continue;
        const d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestD) { bestD = d; best = node; }
      }
      if (!best) { mobileKeyRef.current = null; setHover(null); return; }
      // Position over the thumbnail only, not the whole card (title/meta).
      const thumbEl = best.querySelector(".img-wrap, .video-thumbnail") || best;
      positionOverlay(thumbEl);
      const key = best.dataset.postkey;
      if (key !== mobileKeyRef.current) {
        mobileKeyRef.current = key;
        setReady(false);
        setHover({
          key,
          author: best.dataset.author,
          permlink: best.dataset.permlink,
          thumb: best.dataset.thumb,
          source: sourcesRef.current.get(key),
          rect: rectOf(thumbEl),
        });
      }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(pick); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    // Retry a few times so late-loading cards get picked up without a scroll.
    const timers = [setTimeout(pick, 300), setTimeout(pick, 900), setTimeout(pick, 1800)];
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      timers.forEach(clearTimeout);
      if (raf) cancelAnimationFrame(raf);
      mobileKeyRef.current = null;
      setHover(null);
    };
  }, [mobileAutoplay]);

  // ── Scrub bar ──
  const seekFromEvent = (clientX, bar) => {
    const rect = bar.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    setProgress(frac);
    const el = videoElRef.current;
    if (el && el.duration) el.currentTime = frac * el.duration;
  };
  const onBarPointerDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const bar = e.currentTarget;
    draggingRef.current = true;
    seekFromEvent(e.clientX, bar);
    const move = (ev) => seekFromEvent(ev.clientX, bar);
    const up = () => {
      draggingRef.current = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // ── Desktop hover tracking ──
  const onCardEnter = (e, postKey, author, permlink, thumb) => {
    if (!canHover) return;
    clearTimeout(hoverTimer.current);
    const node = e.currentTarget;
    setHover((h) => (h && h.key !== postKey ? null : h));
    hoverTimer.current = setTimeout(() => {
      setReady(false);
      setHover({
        key: postKey,
        author,
        permlink,
        thumb,
        source: sourcesRef.current.get(postKey),
        rect: rectOf(node.querySelector(".img-wrap, .video-thumbnail") || node),
      });
    }, 500);
  };
  const onContainerLeave = () => {
    if (!canHover) return;
    clearTimeout(hoverTimer.current);
    setHover(null);
  };

  const getCardProps = (key, author, permlink, thumb, status) => {
    if (!active || NON_PLAYABLE.has(status)) return {};
    return {
      ref: observeCard,
      "data-postkey": key,
      "data-author": author,
      "data-permlink": permlink,
      "data-thumb": thumb,
      onMouseEnter: canHover ? (e) => onCardEnter(e, key, author, permlink, thumb) : undefined,
    };
  };

  const overlay = !active ? null : (
    <div
      className={`card-hover-overlay${hover ? " active" : ""}${ready ? " ready" : ""}`}
      ref={overlayElRef}
      // Desktop positions via state; mobile positions imperatively while scrolling.
      style={hover && !mobileAutoplay ? { top: hover.rect.top, left: hover.rect.left, width: hover.rect.width, height: hover.rect.height } : undefined}
      aria-hidden="true"
    >
      <video ref={videoElRef} className="card-hover-video" muted playsInline disablePictureInPicture />
      {hover?.thumb && <img className="card-hover-poster" src={hover.thumb} alt="" />}
      {ready && cues?.length > 0 && (
        <SubtitleOverlay currentTime={curTime} cues={cues} style={{ ...(subtitleStyle || {}), fontSize: "small" }} />
      )}
      {/* Scrub bar on desktop hover only — seeking stalls the tiny mobile autoplay. */}
      {!mobileAutoplay && (
        <div
          className="card-hover-bar"
          onPointerDown={onBarPointerDown}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
          <div className="card-hover-bar-fill" style={{ width: `${progress * 100}%` }} />
          <div className="card-hover-bar-handle" style={{ left: `${progress * 100}%` }} />
        </div>
      )}
    </div>
  );

  return {
    canHover,
    containerProps: { ref: containerRef, onMouseLeave: onContainerLeave },
    getCardProps,
    overlay,
  };
}
