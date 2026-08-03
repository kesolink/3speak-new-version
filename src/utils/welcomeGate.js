import { useEffect, useState } from 'react';

// One-modal-at-a-time gate for the app-root prompts. The welcome flow claims
// the slot synchronously when it decides it may run, so InterestsPrompt (which
// pops on a 1.2s timer) waits instead of landing on top of it.

let active = false;
const subscribers = new Set();

export function setWelcomeActive(next) {
  const value = !!next;
  if (value === active) return;
  active = value;
  subscribers.forEach((fn) => fn(value));
}

export function isWelcomeActive() {
  return active;
}

/** Re-renders the caller whenever the welcome flow opens or finishes. */
export function useWelcomeActive() {
  const [value, setValue] = useState(active);
  useEffect(() => {
    subscribers.add(setValue);
    setValue(active);
    return () => { subscribers.delete(setValue); };
  }, []);
  return value;
}
