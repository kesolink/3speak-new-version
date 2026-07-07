import { getAccounts } from '../hive-api/hiveApi';
import { broadcastWithAioha, KeyTypes } from '../hive-api/aioha';

// The selectable interest taxonomy — mirrors the tags the transcription/subtitles
// pipeline assigns to videos (the distinct set in the checker's `subtitles-tags`
// collection, minus the `general` catch-all). Used later to bias the content a
// user is served. Keep the ids in sync with the transcription taxonomy.
export const INTERESTS = [
  { id: 'news', label: 'News', emoji: '📰' },
  { id: 'travel', label: 'Travel', emoji: '✈️' },
  { id: 'health', label: 'Health', emoji: '🩺' },
  { id: 'technology', label: 'Technology', emoji: '💻' },
  { id: 'art', label: 'Art', emoji: '🎨' },
  { id: 'music', label: 'Music', emoji: '🎵' },
  { id: 'tutorial', label: 'Tutorial', emoji: '🛠️' },
  { id: 'nature', label: 'Nature', emoji: '🌿' },
  { id: 'education', label: 'Education', emoji: '🎓' },
  { id: 'vlog', label: 'Vlog', emoji: '🎥' },
  { id: 'gaming', label: 'Gaming', emoji: '🎮' },
  { id: 'cryptocurrency', label: 'Cryptocurrency', emoji: '🪙' },
  { id: 'finance', label: 'Finance', emoji: '💰' },
  { id: 'food', label: 'Food', emoji: '🍔' },
  { id: 'sports', label: 'Sports', emoji: '⚽' },
  { id: 'science', label: 'Science', emoji: '🔬' },
];

export const INTEREST_IDS = INTERESTS.map((i) => i.id);
const INTEREST_ID_SET = new Set(INTEREST_IDS);

// Where interests live inside the account's posting_json_metadata. Namespaced
// under `3speak` so it sits alongside — not on top of — the standard `profile`
// object other Hive apps read/write.
const META_NS = '3speak';

const clean = (u) => String(u || '').trim().replace(/^@/, '').toLowerCase();

function parsePostingMeta(account) {
  if (!account) return {};
  const raw = account.posting_json_metadata;
  try {
    if (typeof raw === 'string') return JSON.parse(raw || '{}') || {};
    if (raw && typeof raw === 'object') return raw;
  } catch { /* malformed metadata — treat as empty */ }
  return {};
}

// Pull the saved interests out of an already-fetched account object.
export function readInterestsFromAccount(account) {
  const meta = parsePostingMeta(account);
  const arr = meta && meta[META_NS] && meta[META_NS].interests;
  return Array.isArray(arr) ? arr.filter((t) => INTEREST_ID_SET.has(t)) : [];
}

// Fetch a user's saved interests from Hive. Returns an array, or null on a
// lookup failure (so callers can distinguish "no interests" from "couldn't read").
export async function fetchUserInterests(username) {
  const u = clean(username);
  if (!u) return null;
  try {
    const [account] = await getAccounts([u]);
    if (!account) return null;
    return readInterestsFromAccount(account);
  } catch {
    return null;
  }
}

// Persist a user's interests into their Hive posting_json_metadata via an
// account_update2. Merges into the existing metadata so the `profile` object and
// any other keys are preserved. Broadcasts with posting authority — routed
// through @threespeak for delegated logins, or the user's wallet otherwise.
export async function saveInterestsToHive(username, interests) {
  const u = clean(username);
  if (!u) throw new Error('Not logged in');
  const list = [...new Set((interests || []).map((t) => String(t).trim().toLowerCase()))]
    .filter((t) => INTEREST_ID_SET.has(t));

  // Merge into current metadata (fetch fresh so we don't clobber the profile).
  const [account] = await getAccounts([u]);
  const meta = parsePostingMeta(account);
  meta[META_NS] = { ...(meta[META_NS] || {}), interests: list };

  // json_metadata must be a string for dhive to serialize the op; an empty
  // string means "leave json_metadata unchanged" on-chain, so only
  // posting_json_metadata is actually written (and posting auth suffices).
  const op = ['account_update2', {
    account: u,
    json_metadata: '',
    posting_json_metadata: JSON.stringify(meta),
    extensions: [],
  }];
  const result = await broadcastWithAioha([op], KeyTypes.Posting);
  if (!result || !result.success) throw new Error('Could not save interests to Hive');
  return list;
}
