/**
 * Multi-endpoint OpenPods routing.
 *
 * `VITE_HANGOUTS_API_URLS` is a comma-separated list of "apiBase|livekitWsUrl"
 * pairs — each hangouts deployment has its OWN LiveKit, so they travel together.
 * Falls back to the single VITE_HANGOUTS_API_URL / VITE_LIVEKIT_URL pair, so
 * nothing changes until the list is configured.
 *
 * Two very different questions, deliberately separate:
 *   - CREATING a session → `pickLeastLoadedEndpoint()` (spread the load)
 *   - JOINING/WATCHING one → `findRoomEndpoint(room)` (a room lives on exactly
 *     ONE server; picking the least-loaded one would just 404)
 */

const FALLBACK_API = (import.meta.env.VITE_HANGOUTS_API_URL || '').replace(/\/$/, '');
const FALLBACK_LK = import.meta.env.VITE_LIVEKIT_URL || 'wss://livekit.3speak.tv';

/** All configured endpoints, in declaration order. */
export function getHangoutsEndpoints() {
  const raw = import.meta.env.VITE_HANGOUTS_API_URLS || '';
  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const [api, lk] = pair.split('|').map((x) => (x || '').trim());
      return { api: (api || '').replace(/\/$/, ''), lk: lk || FALLBACK_LK };
    })
    .filter((e) => e.api);
  if (list.length) return list;
  return FALLBACK_API ? [{ api: FALLBACK_API, lk: FALLBACK_LK }] : [];
}

/** The first configured endpoint — the safe default before any probing. */
export function defaultEndpoint() {
  return getHangoutsEndpoints()[0] || { api: FALLBACK_API, lk: FALLBACK_LK };
}

async function fetchJson(url, timeoutMs = 4000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ac.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// --- least-loaded selection (for CREATING a session) ----------------------
let loadPick = { at: 0, endpoint: null };
const LOAD_TTL_MS = 30000;

/**
 * Pick the endpoint reporting the lightest load from its `/health`
 * (fewest sessions, then fewest viewers). Unreachable endpoints are skipped;
 * if none answer we fall back to the first configured one rather than block.
 */
export async function pickLeastLoadedEndpoint() {
  const endpoints = getHangoutsEndpoints();
  if (endpoints.length <= 1) return endpoints[0] || defaultEndpoint();

  if (loadPick.endpoint && Date.now() - loadPick.at < LOAD_TTL_MS) return loadPick.endpoint;

  const scored = await Promise.all(endpoints.map(async (ep) => {
    const health = await fetchJson(`${ep.api}/health`);
    if (!health || health.ok !== true) return null;
    return {
      ep,
      sessions: Number(health.sessions?.total ?? 0),
      viewers: Number(health.viewers ?? 0),
    };
  }));

  const alive = scored.filter(Boolean);
  if (!alive.length) return defaultEndpoint();

  alive.sort((a, b) => (a.sessions - b.sessions) || (a.viewers - b.viewers));
  loadPick = { at: Date.now(), endpoint: alive[0].ep };
  return alive[0].ep;
}

// --- room → endpoint (for JOINING / WATCHING) -----------------------------
const roomCache = new Map(); // roomName -> { at, endpoint }
const ROOM_TTL_MS = 5 * 60 * 1000;

/**
 * Find which endpoint actually hosts `roomName`. Probes every endpoint's
 * `GET /rooms/:name` in parallel and takes the first that knows it. Cached,
 * because a room never migrates between servers.
 */
export async function findRoomEndpoint(roomName) {
  if (!roomName) return defaultEndpoint();
  const endpoints = getHangoutsEndpoints();
  if (endpoints.length <= 1) return endpoints[0] || defaultEndpoint();

  const hit = roomCache.get(roomName);
  if (hit && Date.now() - hit.at < ROOM_TTL_MS) return hit.endpoint;

  const results = await Promise.all(endpoints.map(async (ep) => {
    const room = await fetchJson(`${ep.api}/rooms/${encodeURIComponent(roomName)}`);
    return room && room.name ? ep : null;
  }));

  const found = results.find(Boolean);
  if (found) roomCache.set(roomName, { at: Date.now(), endpoint: found });
  // Not found anywhere (ended room) → default, so callers still render their
  // own "stream has ended" state instead of throwing.
  return found || defaultEndpoint();
}

/**
 * GET `path` from EVERY endpoint and concatenate the arrays — for listings
 * (live streams, room lists) that should span all servers. Failures are
 * skipped so one dead endpoint can't empty the feed.
 */
export async function fetchAllEndpoints(path) {
  const endpoints = getHangoutsEndpoints();
  const lists = await Promise.all(endpoints.map(async (ep) => {
    const data = await fetchJson(`${ep.api}${path}`);
    if (!Array.isArray(data)) return [];
    // Tag each item so callers know where to reach it.
    return data.map((item) => ({ ...item, _endpoint: ep }));
  }));
  return lists.flat();
}
