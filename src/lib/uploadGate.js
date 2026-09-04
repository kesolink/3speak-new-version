import { CHECKER_URL } from '../utils/config';

/**
 * Ask whether this account is being shown a pre-upload spot.
 *
 * Returns the ad, or null for every other outcome — not shown to this account, a Pro
 * subscriber, no campaign running, the checker unreachable, a malformed answer. The
 * caller treats null as "post immediately", so every failure has to look like null
 * rather than like an exception somebody might forget to catch.
 *
 * The request carries no video: the gate runs before anything is posted, which is the
 * whole reason the surface exists and why the server does not ask for an owner or a
 * permlink here.
 */
export async function fetchUploadGateAd(account) {
  if (!account) return null;
  try {
    const res = await fetch(`${CHECKER_URL}/m/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ surface: 'upload', viewer: String(account).toLowerCase() }),
    });
    if (!res.ok) return null;
    const body = await res.json();
    const ad = body && body.uploadAd;
    return ad && typeof ad.manifestUrl === 'string' ? ad : null;
  } catch {
    return null;
  }
}
