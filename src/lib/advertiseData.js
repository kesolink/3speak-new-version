// Advertiser intake data layer — talks to the checker's /advertise/* endpoints
// (3speakchecks/routes/advertise.js). The inventory numbers are the cleaned
// forecast written by services/adInventory.js, not raw view counts: sessions too
// short to be a viewer, traffic from accounts that behave like autoplay bots, and
// videos whose creator opted out are all removed before anything is offered here.
//
// Admin endpoints are deliberately NOT reachable from this file. They are gated by
// a server-only secret precisely because every VITE_ variable ends up in the
// browser bundle, so an approval queue driven from the frontend would not be a gate.
import {
  signMessageWithAioha,
  getCurrentProvider,
  isManteAuthLogin,
  KeyTypes,
  Providers,
} from '../hive-api/aioha';
import { CHECKER_URL, EMBED_API_KEY, EMBED_API_URL } from '../utils/config';
import { uploadThumbnail } from '../utils/uploadThumbnail';

// preview-3speak's own backend — same base aioha and the chat client use.
const THREESPEAK_API = import.meta.env.VITE_THREESPEAK_API || '/api';

const BASE = `${CHECKER_URL}/advertise`;

// The categories the backend accepts (utils/config.js AD_CATEGORIES). Kept in the
// same order so the select reads sensibly rather than alphabetically.
export const AD_CATEGORIES = [
  { id: 'defi', label: 'DeFi' },
  { id: 'exchange', label: 'Exchange' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'nft', label: 'NFT' },
  { id: 'infrastructure', label: 'Infrastructure' },
  { id: 'dao', label: 'DAO / community' },
  { id: 'media', label: 'Media' },
  { id: 'education', label: 'Education' },
  { id: 'event', label: 'Event' },
  { id: 'tooling', label: 'Tooling' },
  { id: 'other', label: 'Something else' },
];

async function readJson(res) {
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON error page */ }
  if (!res.ok) {
    const err = new Error((body && body.error) || `Request failed (${res.status})`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

/** Live inventory forecast. Throws with status 503 before the job has ever run. */
export async function fetchInventory() {
  return readJson(await fetch(`${BASE}/inventory`));
}

export async function submitApplication(payload) {
  return readJson(await fetch(`${BASE}/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }));
}

export async function fetchApplication(reference) {
  return readJson(await fetch(`${BASE}/application/${encodeURIComponent(reference)}`));
}

export async function fetchCreatorAdPrefs(account) {
  return readJson(await fetch(`${BASE}/creator/prefs/${encodeURIComponent(account)}`));
}

/* ─── turning ads off ─────────────────────────────────────────────────── */

// Wallets that can sign an arbitrary message in the browser. HiveSigner cannot
// sign buffers, and Butter Auth / ManteAuth sessions hold no client-side key at
// all — they publish through @threespeak. Same set the chat login uses.
const SIGN_CAPABLE_PROVIDERS = new Set([
  Providers.Keychain,
  Providers.HiveAuth,
  Providers.PeakVault,
  Providers.Ledger,
]);

function canSignLocally() {
  if (isManteAuthLogin()) return false;
  return SIGN_CAPABLE_PROVIDERS.has(getCurrentProvider());
}

// Must match prefsMessage() in 3speakchecks/routes/advertise.js exactly. The
// community share is part of it because that field decides where money goes — a
// signature made for one split must not be reusable on another.
const prefsMessage = (account, adsEnabled, communitySharePct, timestamp) =>
  ['3speak-ads', 'creator-prefs', account, adsEnabled ? 'on' : 'off',
    String(communitySharePct), String(timestamp)].join('|');

/**
 * Ask our own backend to sign the preference with @threespeak's posting key,
 * under the authority the creator already granted it.
 *
 * This exists so the setting works for every login. A creator on HiveSigner or
 * Butter Auth has no key in the browser, so demanding a local signature would
 * leave exactly those people unable to turn ads off on their own videos — the
 * wrong group to lock out of a consent control. We send only a boolean; the
 * backend builds and signs the message itself, so it can never be talked into
 * signing arbitrary bytes.
 */
async function signViaThreespeak(adsEnabled, communitySharePct, account) {
  const provider = getCurrentProvider();
  const headers = { 'Content-Type': 'application/json' };
  const body = { adsEnabled, communitySharePct };

  if (provider === Providers.HiveSigner) {
    const token = localStorage.getItem('hivesignerToken');
    if (!token) throw new Error('Your HiveSigner session expired — reconnect and try again.');
    headers.Authorization = `Bearer ${token}`;
  } else if (!isManteAuthLogin()) {
    headers['X-API-Key'] = EMBED_API_KEY;
    body.username = account;
  }

  const res = await fetch(`${THREESPEAK_API}/ads/opt-out-signature`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.signature) {
    throw new Error(data.error || 'Could not save the setting. Please try again.');
  }
  return { signature: data.signature, timestamp: data.timestamp };
}

async function signLocally(account, adsEnabled, communitySharePct) {
  const timestamp = Date.now();
  const res = await signMessageWithAioha(
    prefsMessage(account, adsEnabled, communitySharePct, timestamp),
    KeyTypes.Posting,
    adsEnabled ? 'Save your ad settings' : 'Turn ads off on your videos',
  );
  if (!res?.success || !res.result) throw new Error('Signature was rejected.');
  return { signature: res.result, timestamp };
}

/**
 * Save this creator's ad settings: whether their videos carry ads, and how much of
 * the creator pool goes to the community they posted in. Signs locally when the
 * wallet can, and falls back to the delegated backend signature otherwise.
 *
 * Both fields go in one signed message, so saving is one signature rather than one
 * per field — which matters when the wallet shows a prompt for each.
 */
export async function setCreatorAdPrefs(account, { adsEnabled, communitySharePct }) {
  // No default here on purpose: the platform default lives on the server, and a
  // second copy in the browser is a copy that can drift out of step with the
  // message being signed. Omitting the field lets the server decide; passing 0
  // means the creator chose zero.
  const { signature, timestamp } = canSignLocally()
    ? await signLocally(account, adsEnabled, communitySharePct)
    : await signViaThreespeak(adsEnabled, communitySharePct, account);

  return readJson(await fetch(`${BASE}/creator/prefs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account, adsEnabled, communitySharePct, signature, timestamp }),
  }));
}

/* ─── formatting ──────────────────────────────────────────────────────── */

const nf = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

/**
 * Counts, rounded to whole numbers — except below 10, where a decimal is kept.
 * Rounding 0.2 to "0" reads as a broken page rather than a small number, and the
 * difference between "none" and "a fifth of one a day" is exactly what a small
 * slot's figures need to convey.
 */
export const formatCount = (n) => {
  if (!Number.isFinite(n)) return '—';
  if (n > 0 && n < 10 && !Number.isInteger(n)) return String(Math.round(n * 10) / 10);
  return nf.format(Math.round(n));
};

/** "30s in" / "Before the video" — how a slot reads to someone buying it. */
export function slotLabel(slot) {
  if (!slot || slot.position === 0) return 'Before the video';
  if (slot.position < 60) return `${slot.position} seconds in`;
  const mins = slot.position / 60;
  const shown = Number.isInteger(mins) ? mins : mins.toFixed(1);
  return `${shown} ${String(shown) === '1' ? 'minute' : 'minutes'} in`;
}

// Region names from the browser, falling back to the raw code. Avoids shipping a
// country-name table for the fifteen codes we actually show.
const regionNames = typeof Intl !== 'undefined' && Intl.DisplayNames
  ? new Intl.DisplayNames(undefined, { type: 'region' })
  : null;

export function countryName(code) {
  if (!code || code === 'unknown') return 'Unplaced';
  try { return (regionNames && regionNames.of(code)) || code; } catch { return code; }
}

/* ─── the spot itself ─────────────────────────────────────────────────── */

/**
 * Read a video's duration in the browser, before uploading it.
 *
 * Worth the extra step: a spot that is too long is rejected by the backend anyway,
 * and finding that out after waiting for an upload is a much worse way to learn it.
 */
export function readVideoDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    const done = (d) => { URL.revokeObjectURL(url); resolve(d); };
    v.onloadedmetadata = () => done(Number.isFinite(v.duration) ? Math.round(v.duration) : 0);
    v.onerror = () => done(0);          // unreadable → let the backend decide
    v.src = url;
  });
}

/**
 * Upload a spot and register it for review.
 *
 * Goes through the ordinary embed upload pipeline, so the spot is encoded to the
 * same HLS ladder as every other video on the platform — a creative encoded any
 * other way would stall the splice on a codec or resolution change.
 *
 * `frontend_app: '3speak-ads'` is what keeps it out of the site: the embed backend
 * only sets `listed_on_3speak` for uploads from '3speak-tv', and nothing here
 * broadcasts to Hive, so the spot has no post, earns no rewards and appears in no
 * feed. It exists only to be reviewed and then played inside a break.
 */
/**
 * Upload a still (logo, frame, key art) and register it as an asset.
 *
 * Goes through the same image host everything else on 3Speak uses. It is NOT a
 * playable spot — the stitcher splices HLS and a still is not something HLS can
 * express — so it is stored for a human to build a spot around, and the server
 * refuses to serve it. The UI says so rather than letting an advertiser assume.
 */
export async function uploadImageAsset({ file, reference }) {
  // Reuses the thumbnail uploader's fallback chain rather than calling one host
  // directly: @threespeak signs first, then the 3Speak image server. That matters
  // right now — the @threespeak path has been returning `quota_exceeded` from
  // images.hive.blog, and going straight at it meant every ad image upload failed
  // when the platform already had a working second route.
  //
  // `preferStatic` skips the middle, user-signed step on purpose: it would put a
  // wallet-signing prompt in front of someone uploading a logo, and it cannot run
  // at all for the logins that have no client-side key.
  const url = await uploadThumbnail(file, null, { preferStatic: true });
  if (!url) throw new Error('Image upload failed');

  return readJson(await fetch(`${BASE}/creatives`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reference, imageUrl: url }),
  }));
}

export async function uploadCreative({ file, account, reference, durationSeconds }) {
  const form = new FormData();
  form.append('owner', account);
  form.append('frontend_app', '3speak-ads');
  form.append('filename', file.name || 'spot.mp4');
  if (durationSeconds) form.append('duration', String(durationSeconds));
  form.append('file', file, file.name || 'spot.mp4');

  const up = await fetch(`${EMBED_API_URL}/upload/simple`, {
    method: 'POST',
    headers: { 'X-API-Key': EMBED_API_KEY },
    body: form,
  });
  const upJson = await up.json().catch(() => ({}));
  if (!up.ok || !upJson.permlink) {
    throw new Error(upJson.error || `Upload failed (${up.status})`);
  }

  // Claim the upload as an ad creative. Separate call on purpose: the upload
  // endpoint belongs to the embed service and knows nothing about advertising.
  return readJson(await fetch(`${BASE}/creatives`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reference, embedId: upJson.permlink }),
  }));
}

export async function fetchCreatives(reference) {
  return readJson(await fetch(`${BASE}/creatives?reference=${encodeURIComponent(reference)}`));
}

/** Rate card + where to send payment. */
export async function fetchPricing() {
  return readJson(await fetch(`${BASE}/pricing`));
}

/* ─── campaigns ───────────────────────────────────────────────────────── */

export async function createCampaign({ reference, name, days, slotPosition, markets, startAt, production }) {
  return readJson(await fetch(`${BASE}/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reference, name, days, slotPosition, markets, startAt, production }),
  }));
}

export async function fetchCampaigns(reference) {
  return readJson(await fetch(`${BASE}/campaigns?reference=${encodeURIComponent(reference)}`));
}

/**
 * Ask the server to look for the on-chain payment.
 *
 * Nothing about the money is asserted from here — the backend reads the payment
 * account's own transfer history and matches the memo. The button is a nudge to go
 * and check, not a claim that anything was paid.
 */
export async function claimCampaign(campaignId) {
  return readJson(await fetch(`${BASE}/campaigns/${encodeURIComponent(campaignId)}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  }));
}

export async function attachCreative({ reference, campaignId, embedId }) {
  return readJson(await fetch(`${BASE}/campaigns/${encodeURIComponent(campaignId)}/creative`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reference, embedId }),
  }));
}

/** Plain-English answer to "why isn't my campaign running". */
export const BLOCKED_REASON = {
  unpaid: 'Waiting for your payment',
  no_creative: 'No spot attached yet',
  creative_pending: 'Your spot is still encoding',
  creative_review: 'Waiting for us to review your spot',
  creative_rejected: 'Your spot was not accepted',
  creative_not_encoded: 'Your spot is still encoding',
  not_started: 'Scheduled, not started yet',
  ended: 'This flight has ended',
  paused: 'Paused',
  cancelled: 'Cancelled',
  complete: 'Finished',
  not_submitted: 'Not submitted',
};
