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

const SESSION_KEY = 'hive-rpc-node';
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

async function probe(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'condenser_api.get_dynamic_global_properties', params: [], id: 1 }),
      signal: ctrl.signal,
    });
    if (!res.ok) return false;
    const j = await res.json();
    return !!(j && j.result && j.result.head_block_number);
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

let _ensure = null;

// Idempotent: probes all candidates in parallel, pins the first healthy one
// for the session. Safe to call repeatedly — only runs once per load.
export function ensureHealthyNode() {
  if (_ensure) return _ensure;
  _ensure = (async () => {
    // Already pinned earlier this session — trust it (and make sure the
    // client is ordered with it first).
    if (sessionNode()) {
      chosen = sessionNode();
      _client = buildClient(chosen);
      return chosen;
    }
    const healthy = await new Promise((resolve) => {
      let pending = CANDIDATES.length;
      let settled = false;
      CANDIDATES.forEach(async (url) => {
        const ok = await probe(url);
        if (ok && !settled) { settled = true; resolve(url); }
        else if (--pending === 0 && !settled) { settled = true; resolve(null); }
      });
    });
    chosen = healthy || CANDIDATES[0];
    try { sessionStorage.setItem(SESSION_KEY, chosen); } catch { /* ignore */ }
    _client = buildClient(chosen);
    return chosen;
  })();
  return _ensure;
}

// Kick off selection as soon as this module is imported (idempotent); the
// app bootstrap also calls it explicitly.
ensureHealthyNode();
