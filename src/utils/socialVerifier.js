import axios from 'axios';
import aioha, { KeyTypes } from '../hive-api/aioha';
import { SOCIAL_VERIFIER_URL } from './config';

const client = axios.create({ baseURL: SOCIAL_VERIFIER_URL });

function buildMessage({ action, hive_username, platform, platform_username, timestamp }) {
  return [
    '3speak-social-verifier',
    action,
    String(hive_username || '').toLowerCase(),
    String(platform || ''),
    String(platform_username || ''),
    String(timestamp),
  ].join('|');
}

async function signedParams({ action, hive_username, platform, platform_username }) {
  const timestamp = Date.now();
  const message = buildMessage({ action, hive_username, platform, platform_username, timestamp });
  const result = await aioha.signMessage(message, KeyTypes.Posting);
  if (!result || result.error || !result.result) {
    throw new Error(result?.error || 'Signing was cancelled');
  }
  return { signature: result.result, timestamp };
}

export async function getHash(hive_username) {
  const { data } = await client.get(`/verify/hash/${encodeURIComponent(hive_username)}`);
  return data;
}

export async function getLinks(hive_username, { includePending = false } = {}) {
  const { data } = await client.get(`/verify/links/${encodeURIComponent(hive_username)}`, {
    params: includePending ? { include_pending: 'true' } : undefined,
  });
  return data?.links || [];
}

export async function listPlatforms() {
  const { data } = await client.get('/verify/platforms');
  return data?.platforms || [];
}

export async function checkLink({ hive_username, platform, platform_username }) {
  const { signature, timestamp } = await signedParams({
    action: 'check', hive_username, platform, platform_username,
  });
  const { data } = await client.get('/verify/check', {
    params: { hive_username, platform, platform_username, timestamp, signature },
  });
  return data;
}

export async function unlinkLink({ hive_username, platform, platform_username }) {
  const { signature, timestamp } = await signedParams({
    action: 'unlink', hive_username, platform, platform_username,
  });
  const { data } = await client.get('/verify/unlink', {
    params: { hive_username, platform, platform_username, timestamp, signature },
  });
  return data;
}

// Client-side metadata for each supported platform: how to render a clickable
// outbound link, what to call it, and what to tell the user to type in.
export const PLATFORMS = {
  youtube: {
    label: 'YouTube',
    profileUrl: (canonical) => `https://www.youtube.com/channel/${canonical}`,
    inputPlaceholder: '@handle or UCxxxxxxxxxxxxxxxxxxxxxx',
    inputHelp: 'Paste your YouTube @handle or your UC… channel ID. We canonicalize to the channel ID.',
  },
};

export function platformProfileUrl(platform, canonical) {
  const p = PLATFORMS[platform];
  return p?.profileUrl ? p.profileUrl(canonical) : null;
}

export function platformLabel(platform) {
  return PLATFORMS[platform]?.label || platform;
}
