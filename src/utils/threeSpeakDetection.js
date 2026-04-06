/**
 * Detect 3Speak posts and cache the result across the app.
 *
 * A post is considered 3Speak content if ANY of the following is true:
 *   - json_metadata.app starts with "3speak"
 *   - json_metadata.tags includes "threespeak" or "3speak"
 *   - post.category === "hive-181335"  (3Speak community)
 *   - json_metadata.video.info.sourceMap has a 3speak-style entry
 *
 * We fetch posts via `bridge.get_post` with bounded concurrency to avoid
 * hammering the RPC, cache indefinitely, and expose a React hook.
 */

import { useEffect, useState } from 'react';
import axios from 'axios';
import { HIVE_API_URL } from './config';

// Global in-memory cache: "author/permlink" → boolean (is 3speak video)
const cache = new Map();
// Parallel cache of the fetched post object, so callers can inspect parents
const postCache = new Map();
// In-flight request promises so we never double-fetch the same post
const inFlight = new Map();
// Subscribers to cache updates
const listeners = new Set();

const MAX_CONCURRENT = 4;
let activeRequests = 0;
const queue = [];

function notify() {
  for (const fn of listeners) fn();
}

/**
 * Is this post a 3Speak *video* (not just a comment under one)?
 * A post is a 3Speak video only if:
 *   - It's a root post (no parent_author), AND
 *   - Its metadata carries video info (sourceMap / video_v2 / video.platform)
 *
 * Category alone isn't enough — comments inside hive-181335 share the
 * category but aren't videos. App tags alone aren't enough either: reblogs
 * and remixes use 3speak apps but may not carry video payloads.
 */
function isThreeSpeakFromPost(post) {
  if (!post) return false;

  // Comments (has parent_author) can never themselves be videos.
  if (post.parent_author) return false;

  let meta = {};
  try {
    meta = typeof post.json_metadata === 'string'
      ? JSON.parse(post.json_metadata || '{}')
      : (post.json_metadata || {});
  } catch { meta = {}; }

  const videoInfo = meta.video?.info;

  // Presence of a sourceMap with a video entry is the strongest signal
  if (Array.isArray(videoInfo?.sourceMap)) {
    const hasVideoSource = videoInfo.sourceMap.some((s) =>
      s && (s.type === 'video' || (typeof s.url === 'string' && s.url.includes('3speak')))
    );
    if (hasVideoSource) return true;
  }

  if (typeof videoInfo?.video_v2 === 'string' && videoInfo.video_v2.length > 0) return true;
  if (typeof videoInfo?.file === 'string' && videoInfo.file.length > 0) return true;

  // Fallback: if video.platform === '3speak' AND it has a duration, treat as video
  if (meta.video?.platform === '3speak' && (videoInfo?.duration || meta.video?.url)) return true;

  return false;
}

async function fetchPost(author, permlink) {
  const res = await axios.post(HIVE_API_URL, {
    jsonrpc: '2.0',
    method: 'bridge.get_post',
    params: { author, permlink, observer: '' },
    id: 1,
  });
  if (res.data?.error) throw new Error(res.data.error.message || 'RPC error');
  return res.data?.result || null;
}

function scheduleFetch(key) {
  const [author, permlink] = key.split('/');
  if (!author || !permlink) return Promise.resolve(false);
  if (inFlight.has(key)) return inFlight.get(key);

  const task = new Promise((resolve) => {
    const runner = async () => {
      activeRequests++;
      try {
        const post = await fetchPost(author, permlink);
        if (post) postCache.set(key, post);
        const isSpeak = isThreeSpeakFromPost(post);
        cache.set(key, isSpeak);
        resolve(isSpeak);
      } catch (err) {
        cache.set(key, false); // treat failures as "not 3speak" — safe default
        resolve(false);
      } finally {
        inFlight.delete(key);
        activeRequests--;
        notify();
        if (queue.length > 0) {
          const next = queue.shift();
          next();
        }
      }
    };

    if (activeRequests < MAX_CONCURRENT) {
      runner();
    } else {
      queue.push(runner);
    }
  });

  inFlight.set(key, task);
  return task;
}

/**
 * Request detection for a batch of author/permlink keys. Results land in the
 * global cache; subscribers get notified as each one resolves.
 * @param {string[]} keys
 */
export function prefetch3SpeakDetection(keys) {
  for (const key of keys) {
    if (!key || cache.has(key) || inFlight.has(key)) continue;
    scheduleFetch(key);
  }
}

export function get3SpeakStatus(key) {
  if (!key) return undefined;
  return cache.get(key); // boolean | undefined (unresolved)
}

/**
 * Ensure detection has run for a given author/permlink; returns the boolean.
 * Also primes the post cache so callers can walk up the comment tree.
 */
export async function ensure3SpeakStatus(key) {
  if (!key) return false;
  if (cache.has(key)) return cache.get(key);
  return scheduleFetch(key);
}

export function getCachedPost(key) {
  return postCache.get(key);
}

/**
 * Walk up a comment tree until we find the root post (no parent_author).
 * Returns "author/permlink" of the root. Caps at 6 hops to avoid loops.
 */
export async function resolveRootPost(key) {
  let current = key;
  for (let i = 0; i < 6; i++) {
    // Ensure the current post is fetched & cached
    await ensure3SpeakStatus(current);
    const post = postCache.get(current);
    if (!post || !post.parent_author) return current;
    const parentKey = `${post.parent_author}/${post.parent_permlink}`;
    if (!parentKey || parentKey === current) return current;
    current = parentKey;
  }
  return current;
}

/**
 * React hook: given a list of "author/permlink" keys, kick off a background
 * fetch for the unresolved ones and return the current known-status map.
 * Consumers can read `statusMap.get("author/permlink")`.
 */
export function use3SpeakDetection(keys) {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!keys || keys.length === 0) return;
    prefetch3SpeakDetection(keys);
    const listener = () => setVersion((v) => v + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, [keys]);

  // Return a Map snapshot using the current cache — version is the only
  // state we track so this recreates only when a cache entry resolves.
  const statusMap = new Map();
  for (const k of keys || []) {
    const v = cache.get(k);
    if (v !== undefined) statusMap.set(k, v);
  }
  // Touch version to satisfy linters that see it as unused
  void version;
  return statusMap;
}
