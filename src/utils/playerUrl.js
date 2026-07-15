// Player-backend selection with automatic fallback.
//
// VITE_PLAYER_URLS is an ORDERED, comma-separated list (primary first) — e.g. on
// prod `https://play.3speak.tv,https://preview-player.okinoko.io`. On app open we
// probe them IN ORDER and pin the first that answers for the session, so when the
// primary is down (play.3speak.tv 502s when out) playback automatically falls back
// to the next URL with no code change. Back-compat: a single VITE_PLAYER_URL still
// works (one-element list, nothing to fall back to).
//
// main.jsx blocks first render on ensurePlayerUrl() so every player/preview the app
// creates reads the resolved URL via getPlayerUrl() — no module captures the primary
// before the health check runs.

import { PLAYER_URLS } from './config';

const SESSION_KEY = 'player-backend';
const PROBE_TIMEOUT_MS = 2000;

// Ordered, de-duped candidate list. First entry is the provisional default until
// the health pick resolves.
const CANDIDATES = [...new Set((PLAYER_URLS || []).filter(Boolean))];

function sessionUrl() {
  try { return sessionStorage.getItem(SESSION_KEY) || null; } catch { return null; }
}
function pin(url) {
  try { sessionStorage.setItem(SESSION_KEY, url); } catch { /* storage disabled */ }
}

// The chosen backend, sticky for the session. Read at USE-time by getPlayerUrl().
let chosen = sessionUrl() || CANDIDATES[0] || '';

export function getPlayerUrl() {
  return chosen;
}

export function getPlayerUrls() {
  return CANDIDATES.slice();
}

// Is this backend answering? ANY HTTP reply — even a 404 — means the server is up;
// a 5xx / timeout / network error means it's down (a downed play.3speak.tv 502s via
// its nginx). `/api/embed?v=…` is a cheap, always-present endpoint.
async function isUp(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`${url}/api/embed?v=health/probe`, { signal: ctrl.signal, cache: 'no-store' });
    return res.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

let _ensure = null;

// Idempotent. Probe the candidates IN ORDER and pin the first that answers. A sticky
// session pick short-circuits it (one probe per session). With 0/1 candidates there's
// nothing to choose. If every candidate fails the probe we keep the primary and let
// normal error handling (the watch page's "unavailable" hint) take over.
export function ensurePlayerUrl() {
  if (_ensure) return _ensure;
  _ensure = (async () => {
    if (sessionUrl() || CANDIDATES.length <= 1) return chosen;
    for (const url of CANDIDATES) {
      // Sequential on purpose: prefer the primary, only try the next if it's down.
      // eslint-disable-next-line no-await-in-loop
      if (await isUp(url)) {
        chosen = url;
        pin(url);
        return url;
      }
    }
    return chosen;
  })();
  return _ensure;
}
