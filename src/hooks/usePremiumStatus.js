import { useEffect, useState } from 'react';

const CHECKER_URL = import.meta.env.VITE_CHECKER_URL || 'https://checker.3speak.tv';

// Module-level cache so the same username isn't refetched across every
// AuthorBadge mount. Entries expire after `CACHE_TTL_MS`; failed lookups
// are remembered as `false` for the same window so a 500 doesn't hammer
// the endpoint.
const cache = new Map();
const inflight = new Map();
const CACHE_TTL_MS = 60 * 1000;

async function fetchPremium(username) {
  const key = username.toLowerCase();
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expires > now) return cached.value;

  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const resp = await fetch(`${CHECKER_URL}/premium/${encodeURIComponent(key)}`);
      if (!resp.ok) return { premium: false, expiresAt: null };
      const data = await resp.json();
      return {
        premium: !!data.premium,
        expiresAt: data.premium_expires_at || null,
        source: data.premium_source || null,
        // testing_started is sticky — set the first time the user
        // claims their Pro trial, never cleared. Consumers use it to
        // hide the "Try Pro free" button after the first claim.
        testingStarted: data.testing_started || null,
      };
    } catch {
      return { premium: false, expiresAt: null, source: null, testingStarted: null };
    }
  })();

  inflight.set(key, promise);
  const value = await promise;
  inflight.delete(key);
  cache.set(key, { value, expires: now + CACHE_TTL_MS });
  return value;
}

/**
 * Hook: returns the premium status for a Hive username, fetched from
 * the 3speak-checker premium endpoint and cached for 60s. Returns
 * `null` while loading; `{ premium, expiresAt }` once resolved.
 */
export function usePremiumStatus(username) {
  const [state, setState] = useState(() => {
    if (!username) return null;
    const cached = cache.get(username.toLowerCase());
    return cached && cached.expires > Date.now() ? cached.value : null;
  });

  useEffect(() => {
    if (!username) {
      setState(null);
      return;
    }
    let cancelled = false;
    fetchPremium(username).then((value) => {
      if (!cancelled) setState(value);
    });
    return () => { cancelled = true; };
  }, [username]);

  return state;
}
