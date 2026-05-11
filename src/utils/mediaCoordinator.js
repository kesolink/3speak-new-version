/**
 * Cross-player coordination — when one media player starts, others pause.
 *
 * Tiny CustomEvent bus on `window`. Each player calls `notifyMediaPlay(type)`
 * when its playback transitions to playing, and subscribes via
 * `onMediaPlay(myType, handler)` to be notified when a *different* type
 * starts — that's the cue to pause itself.
 *
 * Types currently in use: 'audio' | 'video' | 'short'. Adding more is fine —
 * everyone listens for "anything that isn't me" so it scales without code
 * changes elsewhere.
 */

const EVENT_NAME = 'mantequilla-media-play';

export function notifyMediaPlay(type) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { type } }));
}

/**
 * Subscribe to "another player started" events.
 * Returns an unsubscribe function.
 *
 * @param {string} myType  The caller's own type — events with this type are ignored.
 * @param {(detail: { type: string }) => void} handler  Called when another type starts.
 */
export function onMediaPlay(myType, handler) {
  if (typeof window === 'undefined') return () => {};
  const fn = (e) => {
    if (e?.detail?.type && e.detail.type !== myType) handler(e.detail);
  };
  window.addEventListener(EVENT_NAME, fn);
  return () => window.removeEventListener(EVENT_NAME, fn);
}
