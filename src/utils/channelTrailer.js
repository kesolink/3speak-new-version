import axios from 'axios';
import { CHECKER_URL, CHECKER_API_KEY } from './config';
import { getAccounts } from '../hive-api/hiveApi';
import { broadcastWithAioha, KeyTypes } from '../hive-api/aioha';

// The channel trailer is stored in TWO places on purpose:
//
//  1. the checker (`embed-users.channel_trailer`) — what the profile reads, and
//     the only one that has to be fast;
//  2. the creator's Hive posting_json_metadata under `3speak.channel_trailer` —
//     redundancy. If this database is ever rebuilt or replaced, the choice is
//     still on chain, signed by the creator, and can be re-imported.
//
// The Hive write is best-effort: it costs a broadcast, and failing it must not
// undo a successful publish.

const META_NS = '3speak';
const clean = (u) => String(u || '').trim().replace(/^@/, '').toLowerCase();

// The checker verifies the permlink belongs to this creator, and right after a
// publish the video doc is still being linked to the Hive post — badadib's first
// attempt was rejected 12 seconds before the doc settled. So a 404 means "not
// indexed YET" as often as "not yours": retry a few times before believing it.
const RETRY_DELAYS_MS = [3000, 6000, 10000, 15000];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Point a creator's trailer at one of their videos (null clears it). */
export async function setChannelTrailer(username, permlink, { author } = {}) {
  const u = clean(username);
  if (!u) throw new Error('Not logged in');

  const body = { username: u, permlink: permlink || null, author: clean(author) || u };
  const headers = { Authorization: `Bearer ${CHECKER_API_KEY}`, 'Content-Type': 'application/json' };

  let lastErr;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      await axios.put(`${CHECKER_URL}/user/trailer`, body, { headers });
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
      // Only a 404 is worth waiting on; anything else won't fix itself.
      if (e?.response?.status !== 404 || attempt === RETRY_DELAYS_MS.length) break;
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
  if (lastErr) throw lastErr;

  // Mirror it on chain. Merged into the existing metadata so `profile`,
  // `3speak.interests` and the spotlight block all survive.
  try {
    const [account] = await getAccounts([u]);
    let meta = {};
    try { meta = JSON.parse(account?.posting_json_metadata || '{}') || {}; } catch { meta = {}; }
    const ns = { ...(meta[META_NS] || {}) };
    if (permlink) ns.channel_trailer = `${clean(author) || u}/${permlink}`;
    else delete ns.channel_trailer;
    meta[META_NS] = ns;

    await broadcastWithAioha([['account_update2', {
      account: u,
      json_metadata: '',
      posting_json_metadata: JSON.stringify(meta),
      extensions: [],
    }]], KeyTypes.Posting);
  } catch (e) {
    // The profile already reads the checker copy, so this is a redundancy miss,
    // not a failure the creator needs to act on.
    console.warn('Channel trailer: on-chain mirror failed:', e?.message);
  }

  return true;
}
