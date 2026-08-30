import { useEffect, useState } from 'react';

// One-modal-at-a-time gate for the app-root prompts. A flow claims its slot
// synchronously when it decides it may run, so the others wait instead of landing
// on top of it.
//
// This started as a single boolean for the welcome flow, which was enough while
// there were two prompts and a fixed order. With the ads prompts added there are
// four, and "is anything else on screen" is the question each of them actually
// needs to ask — a chain of pairwise booleans gets one case wrong the moment a
// fifth is added. Claims are keyed, and the welcome helpers below are kept as thin
// wrappers so the existing callers read the same as they always did.

const claims = new Set();
const subscribers = new Set();

const notify = () => { subscribers.forEach((fn) => fn(new Set(claims))); };

export function setPromptActive(key, next) {
  const had = claims.has(key);
  if (next) {
    if (had) return;
    claims.add(key);
  } else {
    if (!had) return;
    claims.delete(key);
  }
  notify();
}

/** Is any prompt other than `exceptKey` holding the slot right now? */
export function isAnyPromptActive(exceptKey) {
  for (const key of claims) if (key !== exceptKey) return true;
  return false;
}

/**
 * Re-renders the caller whenever some OTHER prompt opens or finishes. Pass your
 * own key so your own claim does not read as a reason to wait for yourself.
 */
export function usePromptsActive(exceptKey) {
  const [value, setValue] = useState(() => isAnyPromptActive(exceptKey));
  useEffect(() => {
    const fn = () => setValue(isAnyPromptActive(exceptKey));
    subscribers.add(fn);
    fn();
    return () => { subscribers.delete(fn); };
  }, [exceptKey]);
  return value;
}

/* ─── the original welcome-only API, unchanged for its callers ─────────── */

export const setWelcomeActive = (next) => setPromptActive('welcome', !!next);

export const isWelcomeActive = () => claims.has('welcome');

/** Re-renders the caller whenever the welcome flow opens or finishes. */
export function useWelcomeActive() {
  const [value, setValue] = useState(isWelcomeActive);
  useEffect(() => {
    const fn = () => setValue(isWelcomeActive());
    subscribers.add(fn);
    fn();
    return () => { subscribers.delete(fn); };
  }, []);
  return value;
}
