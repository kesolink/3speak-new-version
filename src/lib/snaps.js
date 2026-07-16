// Community "snaps" — short WRITTEN posts a creator publishes to their followers.
//
// A snap is a real Hive comment under @peak.snaps' latest container (the same
// Snaps/threads pattern 3Speak shorts use — just text, no video). After it's
// broadcast we index the permlink in the checker so the profile's Community tab
// loads fast from Mongo. The checker re-verifies the post on-chain, so this is a
// best-effort "please index it" call, not a source of truth.

import axios from 'axios';
import { CHECKER_URL } from '../utils/config';
import { getHiveUrl } from '../utils/hiveNode';
import { commentWithAioha } from '../hive-api/aioha';

// Must match SNAP_APP in the checker's routes/snaps.js — it's how a snap is told
// apart from any other comment the account has under @peak.snaps.
const SNAP_APP = '3speak/snap';
const SNAP_CONTAINER = 'peak.snaps';
// Built-in tag on every community snap (in addition to the user's own tags).
export const SNAP_TAG = 'community';
export const MAX_USER_TAGS = 9; // + the built-in `community` = Hive's practical 10-tag limit

/** The owner's snaps, newest first (for the Community tab). */
export async function fetchSnaps(owner, page = 1, limit = 20) {
  const { data } = await axios.get(
    `${CHECKER_URL}/snaps/${encodeURIComponent(owner)}?page=${page}&limit=${limit}`,
  );
  return data; // { success, snaps, page, limit, total, hasMore }
}

/**
 * Cross-author community-post feed for the home sections (fresh <7d, excludes the
 * viewer's hidden + already-engaged snaps server-side).
 * @param {{ scope?: 'all'|'following', currentuser?: string, page?: number, limit?: number }} opts
 */
export async function fetchCommunityFeed({ scope = 'all', currentuser = '', page = 1, limit = 10 } = {}) {
  const params = new URLSearchParams({ scope, page: String(page), limit: String(limit) });
  if (currentuser) params.set('currentuser', currentuser);
  const { data } = await axios.get(`${CHECKER_URL}/snaps-feed?${params.toString()}`);
  return data; // { success, snaps, page, limit, hasMore }
}

/** Fire-and-forget: mark that `user` voted/commented on a snap (drops it from their feed). */
export function recordSnapInteraction(user, author, permlink) {
  if (!user || !author || !permlink) return;
  axios.post(`${CHECKER_URL}/snaps/interaction`, { user, author, permlink }).catch(() => {});
}

// Per-user snap hides (separate from video hides). Undo-able.
export function hideSnap(user, author, permlink) {
  return axios.post(`${CHECKER_URL}/snaps/hide`, { user, author, permlink });
}
export function unhideSnap(user, author, permlink) {
  return axios.delete(`${CHECKER_URL}/snaps/hide`, { data: { user, author, permlink } });
}
export function hideSnapCreator(user, author) {
  return axios.post(`${CHECKER_URL}/snaps/hide-creator`, { user, author });
}
export function unhideSnapCreator(user, author) {
  return axios.delete(`${CHECKER_URL}/snaps/hide-creator`, { data: { user, author } });
}

// The @peak.snaps container is one long-running "daily" post; we reply under its
// newest one, exactly like the shorts uploader does.
async function getSnapsContainer() {
  const res = await axios.post(getHiveUrl(), {
    jsonrpc: '2.0',
    method: 'bridge.get_account_posts',
    params: { sort: 'posts', account: SNAP_CONTAINER, start_author: '', start_permlink: '', limit: 1 },
    id: 1,
  });
  const latest = res.data?.result?.[0];
  if (!latest?.author || !latest?.permlink) {
    throw new Error('Could not find a snaps container to post under — try again shortly');
  }
  return { author: latest.author, permlink: latest.permlink };
}

function makePermlink(body) {
  const slug = String(body || '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 27)
    .replace(/-+$/, '');
  return `${slug || 'snap'}-${Date.now() % 100000}`;
}

// Build comment_options from the rewards choice + user beneficiaries. MUST include
// author + permlink: the client-side (Keychain) path hands this object straight to
// aioha.comment, which serializes it — a missing author/permlink there surfaces as
// "can't access property toString, y is undefined". (Matches the shorts uploader.)
function buildOptions(author, permlink, rewards, beneficiaries) {
  const benes = (beneficiaries || [])
    .filter((b) => b && b.account && Number(b.weight) > 0)
    .map((b) => ({ account: String(b.account).toLowerCase().replace(/^@/, '').trim(), weight: Math.round(Number(b.weight)) }))
    .sort((a, b) => a.account.localeCompare(b.account)); // chain requires ascending account order

  return {
    author,
    permlink,
    max_accepted_payout: rewards === 'decline' ? '0.000 HBD' : '1000000.000 HBD',
    percent_hbd: rewards === 'powerup' ? 0 : 10000, // 0 = 100% power-up, 10000 = default 50/50
    allow_votes: true,
    allow_curation_rewards: true,
    extensions: benes.length ? [[0, { beneficiaries: benes }]] : [],
  };
}

/**
 * Publish a written snap, then index it in the checker.
 * @param {{ user:string, body:string, tags?:string[], rewards?:'default'|'powerup'|'decline',
 *           beneficiaries?:{account:string,weight:number}[], nsfw?:boolean }} opts
 * @returns {{ author:string, permlink:string, indexed:object|null }}
 */
export async function publishSnap({ user, body, tags = [], rewards = 'default', beneficiaries = [], nsfw = false }) {
  if (!user) throw new Error('Please log in first');
  const text = String(body || '').trim();
  if (!text) throw new Error('Write something first');

  const parent = await getSnapsContainer();
  const permlink = makePermlink(text);

  // Every snap carries the built-in `community` tag, so users get at most 9 of their
  // own — 1 + 9 = 10, Hive's practical tag limit. `nsfw` is a content flag on top.
  const userTags = [...new Set(
    (tags || [])
      .map((t) => String(t).toLowerCase().replace(/^#/, '').trim())
      .filter((t) => t && t !== SNAP_TAG),
  )].slice(0, 9);
  const cleanTags = [SNAP_TAG, ...userTags];
  if (nsfw) cleanTags.push('nsfw');
  const finalTags = cleanTags.slice(0, 10);

  const jsonMetadata = {
    app: SNAP_APP,
    format: 'markdown',
    tags: finalTags,
    type: 'snap',
  };

  const options = buildOptions(user, permlink, rewards, beneficiaries);

  const result = await commentWithAioha(parent.author, parent.permlink, permlink, '', text, jsonMetadata, options);
  if (result && result.success === false) throw new Error('Publishing the snap was rejected');

  // Index it (the checker re-verifies on-chain). Retry across the block time — the
  // RPC may not have the fresh comment yet.
  let indexed = null;
  for (let i = 0; i < 4; i++) {
    try {
      const { data } = await axios.post(`${CHECKER_URL}/snaps`, { author: user, permlink });
      if (data?.success) { indexed = data.snap; break; }
    } catch (_) { /* propagation delay — retry */ }
    if (i < 3) await new Promise((r) => setTimeout(r, 2500));
  }

  return { author: user, permlink, indexed };
}
