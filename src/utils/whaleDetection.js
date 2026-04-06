/**
 * Detect "whale" and "orca" Hive accounts based on effective vesting shares.
 *
 * Tiers:
 *   - whale:  >= 500,000 VESTS (~100k HP)
 *   - orca:   >= 50,000 VESTS  (~10k HP)
 *   - null:   below orca threshold
 *
 * Uses the same version-counter + global-cache pattern as threeSpeakDetection.js
 * so React components re-render lazily as results arrive.
 */

import { useEffect, useState } from 'react';
import axios from 'axios';
import { HIVE_API_URL } from './config';

// ---- Thresholds (in VESTS) ----
// 1 HP ≈ ~1900 VESTS (current ratio). These thresholds are approximate.
export const WHALE_THRESHOLD = 190_000_000;  // ~100k HP
export const ORCA_THRESHOLD = 19_000_000;    // ~10k HP

// ---- Global cache & subscriber machinery ----
// username -> { vests: number, tier: 'whale' | 'orca' | null }
const cache = new Map();
// Set of usernames currently being fetched (to avoid double-fetches)
const pending = new Set();
// Listeners notified whenever a batch resolves
const listeners = new Set();

function notify() {
  for (const fn of listeners) fn();
}

/**
 * Parse a VESTS string like "123456.789012 VESTS" into a number.
 */
function parseVests(str) {
  if (!str) return 0;
  return parseFloat(str.split(' ')[0]) || 0;
}

/**
 * Determine tier from effective vesting shares.
 */
function tierFromVests(vests) {
  if (vests >= WHALE_THRESHOLD) return 'whale';
  if (vests >= ORCA_THRESHOLD) return 'orca';
  return null;
}

/**
 * Fetch effective vesting shares for a single account.
 * Effective = vesting_shares + received_vesting_shares - delegated_vesting_shares
 *
 * @param {string} username
 * @returns {Promise<number>} effective vests
 */
export async function fetchAccountVests(username) {
  const res = await axios.post(HIVE_API_URL, {
    jsonrpc: '2.0',
    method: 'condenser_api.get_accounts',
    params: [[username]],
    id: 1,
  });

  const accounts = res.data?.result;
  if (!accounts || accounts.length === 0) return 0;

  const acct = accounts[0];
  const own = parseVests(acct.vesting_shares);
  const received = parseVests(acct.received_vesting_shares);
  const delegated = parseVests(acct.delegated_vesting_shares);

  return own + received - delegated;
}

/**
 * Fetch a batch of usernames (max 10 per Hive API call) and populate the cache.
 */
async function fetchBatch(usernames) {
  try {
    const res = await axios.post(HIVE_API_URL, {
      jsonrpc: '2.0',
      method: 'condenser_api.get_accounts',
      params: [usernames],
      id: 1,
    });

    const accounts = res.data?.result || [];
    const accountMap = new Map();
    for (const acct of accounts) {
      accountMap.set(acct.name, acct);
    }

    for (const name of usernames) {
      const acct = accountMap.get(name);
      if (acct) {
        const own = parseVests(acct.vesting_shares);
        const received = parseVests(acct.received_vesting_shares);
        const delegated = parseVests(acct.delegated_vesting_shares);
        const vests = own + received - delegated;
        cache.set(name, { vests, tier: tierFromVests(vests) });
      } else {
        cache.set(name, { vests: 0, tier: null });
      }
      pending.delete(name);
    }
  } catch {
    // On error, mark all as resolved with zero to avoid infinite retries
    for (const name of usernames) {
      if (!cache.has(name)) cache.set(name, { vests: 0, tier: null });
      pending.delete(name);
    }
  }

  notify();
}

/**
 * Kick off fetches for any uncached usernames, batched in groups of 10.
 */
function prefetch(usernames) {
  const toFetch = [];
  for (const name of usernames) {
    if (!name || cache.has(name) || pending.has(name)) continue;
    pending.add(name);
    toFetch.push(name);
  }

  // Chunk into batches of 10
  for (let i = 0; i < toFetch.length; i += 10) {
    const batch = toFetch.slice(i, i + 10);
    fetchBatch(batch);
  }
}

/**
 * React hook: given an array of usernames, lazily fetch their vesting info
 * and return a Map of username -> { vests, tier }.
 *
 * Re-renders as results arrive (version-counter pattern).
 *
 * @param {string[]} usernames
 * @returns {Map<string, {vests: number, tier: 'whale'|'orca'|null}>}
 */
export function useWhaleDetection(usernames) {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!usernames || usernames.length === 0) return;
    prefetch(usernames);
    const listener = () => setVersion((v) => v + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, [usernames]);

  // Build a snapshot from the cache for the requested usernames
  const resultMap = new Map();
  for (const name of usernames || []) {
    const entry = cache.get(name);
    if (entry !== undefined) resultMap.set(name, entry);
  }

  // Touch version so linters don't flag it as unused
  void version;

  return resultMap;
}
