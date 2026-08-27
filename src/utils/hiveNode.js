// Central Hive RPC node manager.
//
// The candidate list lives ONLY in config (HIVE_API_NODES) — no node is
// hardcoded anywhere else. On app open we race every candidate with a cheap
// health probe, pick the first that answers, and pin it for the whole
// session (sessionStorage). All Hive access goes through the shared
// `hiveClient` proxy / `getHiveUrl()` so everything uses that one node, with
// the remaining nodes kept as fast dhive failover if it dies mid-session.

import { Client } from '@hiveio/dhive';
import { HIVE_API_NODES } from './config';

// v2: the probe now also requires hivemind, so old (possibly hivemind-less)
// pins from a previous build must not be trusted.
const SESSION_KEY = 'hive-rpc-node-v2';
const PROBE_TIMEOUT_MS = 2500;

const CLIENT_OPTS = { timeout: 3000, failoverThreshold: 2, consoleOnFailover: true };

// Ordered candidate list (de-duped). First entry is the provisional default
// until the health pick resolves.
const CANDIDATES = [...new Set(HIVE_API_NODES.filter(Boolean))];

function sessionNode() {
  try { return sessionStorage.getItem(SESSION_KEY) || null; } catch { return null; }
}

// The currently-chosen primary node (sticky for the session).
let chosen = sessionNode() || CANDIDATES[0];

function buildClient(primary) {
  const order = [primary, ...CANDIDATES.filter((n) => n !== primary)];
  return new Client(order, CLIENT_OPTS);
}

// One underlying dhive Client, swapped in place once the healthy node is
// known. Consumers hold the stable proxy, so the swap is transparent.
let _client = buildClient(chosen);

export const hiveClient = new Proxy({}, {
  get(_t, prop) {
    const v = _client[prop];
    return typeof v === 'function' ? v.bind(_client) : v;
  },
});

export function getHiveClient() {
  return hiveClient;
}

// Current session node URL (for raw axios JSON-RPC callers).
export function getHiveUrl() {
  return chosen;
}

async function rpcOk(url, body, check, signal) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, ...body }),
      signal,
    });
    if (!res.ok) return false;
    const j = await res.json();
    // Hive returns node-side failures in the body with HTTP 200.
    if (!j || j.error) return false;
    return check(j.result);
  } catch {
    return false;
  }
}

// A node is only usable if it answers BOTH layers:
//   - hived      → is it alive and synced (head block)
//   - hivemind   → do `bridge.*` / discussion calls work
// Checking only hived was letting a hivemind-less node (e.g. techcoderx.com,
// which serves hived but answers every bridge call with "Unable to parse
// endpoint data.") win the race and get pinned for the whole session. Every
// hivemind-backed feature then failed for that user until they reloaded —
// most visibly snap posting, which could not resolve its @peak.snaps parent.
async function probe(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const [hived, hivemind] = await Promise.all([
      rpcOk(url, {
        method: 'condenser_api.get_dynamic_global_properties',
        params: [],
      }, (r) => !!(r && r.head_block_number), ctrl.signal),
      rpcOk(url, {
        method: 'bridge.list_communities',
        params: { limit: 1 },
      }, (r) => Array.isArray(r) && r.length > 0, ctrl.signal),
    ]);
    return hived && hivemind;
  } finally {
    clearTimeout(t);
  }
}

let _ensure = null;

// Rebuild the dhive client so it only ever fails over to nodes that actually
// passed the probe. dhive surfaces a JSON-RPC error as a thrown RPCError
// instead of rotating to the next peer, so a hivemind-less node left in this
// list breaks every `bridge.*` call (profiles, spotlight, comment threads)
// the moment dhive rotates onto it.
function adoptHealthy(primary, healthyList) {
  const usable = healthyList && healthyList.length ? healthyList : CANDIDATES;
  const order = [primary, ...usable.filter((n) => n !== primary)];
  _client = new Client(order, CLIENT_OPTS);
}

// Probe every candidate exactly once and expose two views of the same run:
//   first   — resolves as soon as ANY node answers (fast pin, keeps boot snappy)
//   healthy — resolves once every probe settles (accurate failover list)
function probeAll() {
  const results = CANDIDATES.map((url) => probe(url).then((ok) => ({ url, ok })));
  let resolveFirst;
  const first = new Promise((r) => { resolveFirst = r; });
  results.forEach((p) => p.then(({ url, ok }) => { if (ok) resolveFirst(url); }));
  const healthy = Promise.all(results).then((rs) => rs.filter((r) => r.ok).map((r) => r.url));
  // Nothing healthy at all — unblock `first` rather than hanging the boot.
  healthy.then((ok) => resolveFirst(ok[0] || null));
  return { first, healthy };
}

// Idempotent: probes all candidates in parallel, pins the first healthy one
// for the session. Safe to call repeatedly — only runs once per load.
export function ensureHealthyNode() {
  if (_ensure) return _ensure;

  const { first, healthy } = probeAll();

  // Runs in the background — never blocks the first Hive call. Narrows the
  // failover list to hivemind-capable nodes, and re-pins if the node we
  // adopted (including one restored from sessionStorage) turns out unusable.
  healthy.then((ok) => {
    if (!ok.length) return;
    if (!ok.includes(chosen)) {
      chosen = ok[0];
      try { sessionStorage.setItem(SESSION_KEY, chosen); } catch { /* ignore */ }
    }
    adoptHealthy(chosen, ok);
  }).catch(() => { /* keep whatever we already have */ });

  _ensure = (async () => {
    // Already pinned earlier this session — adopt it immediately; the
    // background pass above still verifies it and corrects course if needed.
    const pinned = sessionNode();
    if (pinned) {
      chosen = pinned;
      adoptHealthy(chosen, null);
      return chosen;
    }
    const winner = await first;
    chosen = winner || CANDIDATES[0];
    try { sessionStorage.setItem(SESSION_KEY, chosen); } catch { /* ignore */ }
    adoptHealthy(chosen, null);
    return chosen;
  })();

  return _ensure;
}

// Kick off selection as soon as this module is imported (idempotent); the
// app bootstrap also calls it explicitly.
ensureHealthyNode();
