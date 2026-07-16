/**
 * Hide comments authored by HIDDEN creators (contentcreators.hidden on the checker).
 *
 * Comments are fetched straight from Hive, not the checker, so — exactly like the
 * low-reputation filter in utils/reputation.js — the hide has to happen client-side.
 * This mirrors that file's shape: collect every author (incl. nested replies), resolve
 * them in one call, then tag each node with `isHidden` so each render site can
 * short-circuit next to its existing `isLowReputation` guard.
 *
 * Resolution goes through a single bulk endpoint (POST /check-hidden) rather than
 * dumping the whole ban list to the client — the client only learns the status of the
 * authors actually on the page. Cached per-username (5 min); fail-open on any error
 * (a checker hiccup must never blank out a comment thread).
 */
import { CHECKER_URL } from './config';

const cache = new Map(); // username(lc) -> { hidden: bool, at: ms }
const CACHE_MS = 5 * 60 * 1000;

/**
 * Given a list of usernames, return a Set (lowercased) of those that are hidden.
 * Only the un-cached ones hit the network, in one request.
 */
export async function batchCheckHidden(usernames) {
  const uniq = [...new Set((usernames || [])
    .map((u) => (typeof u === 'string' ? u : u?.username))
    .filter(Boolean)
    .map((u) => u.toLowerCase()))];

  const now = Date.now();
  const need = uniq.filter((u) => {
    const c = cache.get(u);
    return !(c && now - c.at < CACHE_MS);
  });

  if (need.length > 0) {
    try {
      const res = await fetch(`${CHECKER_URL}/check-hidden`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: need }),
      });
      const data = await res.json().catch(() => ({}));
      const hiddenSet = new Set((data?.hidden || []).map((u) => String(u).toLowerCase()));
      // Cache both hits and misses so a page of non-hidden authors isn't re-checked.
      need.forEach((u) => cache.set(u, { hidden: hiddenSet.has(u), at: now }));
    } catch {
      need.forEach((u) => cache.set(u, { hidden: false, at: now })); // fail-open
    }
  }

  const out = new Set();
  uniq.forEach((u) => { if (cache.get(u)?.hidden) out.add(u); });
  return out;
}

// Collect every author across a comment tree (both {author:'x'} and
// {author:{username:'x'}}, and both children/replies nesting) — same shape as
// utils/reputation.js so it drops onto the same data.
function collectAuthors(content) {
  const authors = [];
  const walk = (items) => {
    for (const item of items || []) {
      const name = typeof item.author === 'string' ? item.author : item.author?.username;
      if (name) authors.push(name);
      const nested = item.children || item.replies;
      if (nested && nested.length) walk(nested);
    }
  };
  walk(content);
  return authors;
}

/**
 * Tag each comment (recursively) with `isHidden` for authors that are hidden
 * creators. Does not remove anything — render sites drop `isHidden` nodes, matching
 * how `isLowReputation` is handled.
 */
export async function markByHidden(content) {
  if (!content || content.length === 0) return content || [];
  const hiddenSet = await batchCheckHidden(collectAuthors(content));
  if (hiddenSet.size === 0) return content; // nothing hidden on this page — untouched

  const mark = (items) => items.map((item) => {
    const name = (typeof item.author === 'string' ? item.author : item.author?.username) || '';
    const marked = { ...item, isHidden: hiddenSet.has(name.toLowerCase()) };
    const nested = item.children || item.replies;
    if (nested && nested.length) {
      if (item.children) marked.children = mark(nested);
      else if (item.replies) marked.replies = mark(nested);
    }
    return marked;
  });

  return mark(content);
}

/** Is a single username a hidden creator? (used by the profile gate) */
export async function isCreatorHidden(username) {
  if (!username) return false;
  const set = await batchCheckHidden([username]);
  return set.has(String(username).toLowerCase());
}
