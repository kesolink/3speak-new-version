import { useCallback, useEffect, useRef } from 'react';
import { commentWithAioha } from '../hive-api/aioha';
import { useAppStore } from '../lib/store';

/**
 * Hive hands back timestamps as `2026-07-19T12:34:56` — ISO-shaped but with NO
 * timezone, which `new Date()` reads as LOCAL time. Left alone that shifts the
 * stream's start by the viewer's UTC offset, so a chat line two minutes in was
 * stamped `123:02` from UTC+2 and its `parentTimestamp` marker landed hours past
 * the end of the video, where the timeline never draws it. Same normalisation
 * the rest of the app does (see notificationHelpers, PostView).
 */
function parseHiveDate(value) {
  if (!value) return null;
  if (typeof value !== 'string') return new Date(value).getTime();
  const t = new Date(/[Z+]|-\d\d:\d\d$/.test(value) ? value : `${value}Z`).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Mirror each live-chat line to Hive as a timecoded comment on the stream's post.
 *
 * Signed-in Hive users ONLY, authored by the user themselves via the normal
 * broadcast path — so attribution is right and Hive's ~3s per-account comment
 * interval spreads across chatters instead of bottlenecking one service
 * account. Guests chat in-stream only; nothing of theirs goes on-chain.
 *
 * Returns a callback that never throws and is never awaited: mirroring is slow
 * and must not hold up the in-stream message.
 */
export function useStreamChatMirror({ author, permlink, startedAt, hasPost }) {
  const authenticated = useAppStore((s) => s.authenticated);

  const startRef = useRef(null);
  useEffect(() => {
    // A start time in the FUTURE means the parse went wrong (or clocks differ);
    // fall back to "now" rather than emitting a negative-turned-zero timecode
    // for every message.
    const parsed = parseHiveDate(startedAt);
    startRef.current = parsed && parsed <= Date.now() ? parsed : Date.now();
  }, [startedAt]);

  return useCallback((text) => {
    if (!authenticated || !author || !permlink) return;
    // Only when the stream actually HAS a Hive post. Unannounced and unlisted
    // streams have no parent to comment on, and every message was failing with
    // "Comment with id/permlink … not found" against a post that never existed.
    if (!hasPost) return;
    const started = startRef.current || Date.now();
    const seconds = Math.max(0, Math.floor((Date.now() - started) / 1000));
    const mmss = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    const baseUrl = window.location.origin;
    // Same shape the watch-page comment box uses, so these render and sort
    // identically to ordinary comments (see CommentSection.handlePostComment).
    const metadata = { app: '3speak/new-version', parentTimestamp: seconds };
    const body = `${text}\n<br><sup>said at [${mmss}](${baseUrl}/watch?v=${author}/${permlink}) during the live stream</sup>`;
    commentWithAioha(author, permlink, `re-${permlink}-${Date.now()}`, '', body, metadata)
      .catch((err) => console.warn('[stream chat] Hive comment failed:', err?.message || err));
  }, [authenticated, author, permlink, hasPost]);
}
