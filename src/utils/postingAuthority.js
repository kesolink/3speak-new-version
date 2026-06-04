// Helpers for checking and granting an "authorized poster" on a user's
// posting authority. Used by the scheduled-posts flow: the @threespeak
// account needs to be in the user's posting account_auths so the server
// cron can broadcast posts on the user's behalf (signed with @threespeak's
// posting key — accepted because that key is now authorized for the user).

import { Client } from '@hiveio/dhive';
import { getHiveUrl } from './hiveNode';
import { broadcastWithAioha, KeyTypes } from '../hive-api/aioha';

const THREESPEAK_AUTHORITY = 'threespeak';

let _client;
function getClient() {
  if (!_client) _client = new Client(getHiveUrl());
  return _client;
}

async function fetchAccount(username) {
  const accounts = await getClient().database.getAccounts([username]);
  const account = accounts && accounts[0];
  if (!account) throw new Error(`Hive account @${username} not found`);
  return account;
}

/**
 * @returns {Promise<boolean>} true if @threespeak is in the user's posting account_auths.
 */
export async function hasThreespeakPostingAuth(username) {
  if (!username) return false;
  const account = await fetchAccount(username);
  const auths = (account.posting && account.posting.account_auths) || [];
  return auths.some(([acc]) => acc === THREESPEAK_AUTHORITY);
}

/**
 * Add @threespeak to the user's posting account_auths, preserving the existing
 * authority structure (other auths, key auths, weight_threshold) verbatim.
 *
 * Uses `account_update2` so the change can be signed with the user's ACTIVE key
 * (account_update would require the OWNER key — much scarier UX). aioha is
 * asked to sign and broadcast the op.
 */
export async function addThreespeakToPostingAuth(username, opts = {}) {
  const weight = opts.weight || 1;
  const account = await fetchAccount(username);
  const posting = account.posting || { weight_threshold: 1, account_auths: [], key_auths: [] };

  // No-op (and don't pop a wallet) if it's already there.
  if (posting.account_auths.some(([acc]) => acc === THREESPEAK_AUTHORITY)) {
    return { alreadyAuthorized: true };
  }

  const newPosting = {
    weight_threshold: posting.weight_threshold,
    account_auths: [...posting.account_auths, [THREESPEAK_AUTHORITY, weight]],
    key_auths: posting.key_auths || [],
  };

  // account_update2 — signed with active key. Only the `posting` field is set;
  // omitted fields are left untouched. extensions is required (empty).
  const op = [
    'account_update2',
    {
      account: username,
      posting: newPosting,
      json_metadata: account.json_metadata || '',
      posting_json_metadata: account.posting_json_metadata || '',
      extensions: [],
    },
  ];

  const result = await broadcastWithAioha([op], KeyTypes.Active);
  if (!result || !result.success) {
    throw new Error('Failed to add @threespeak to posting authority');
  }
  return { alreadyAuthorized: false, tx: result.result };
}
