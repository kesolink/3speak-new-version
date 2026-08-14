import { useEffect, useState } from 'react';

const GATE_URL = import.meta.env.VITE_GATE_URL || 'https://gate.3speak.tv';

/**
 * 🔐 Resolves playback for a supporters-only (gated) video.
 *
 * Gated videos are AES-128 encrypted on IPFS. The gate decides whether this
 * viewer may watch, and if so returns a manifest URL whose key requests carry a
 * short-lived session token. Segments still stream straight from the CDN, so
 * this call is a few hundred bytes, once, before playback starts.
 *
 * The credentials matter: entitlement is read from the viewer's
 * `threespeak_wsession` cookie, so the request must be made with
 * `credentials: 'include'` or every viewer looks anonymous.
 *
 * States:
 *   idle      not a gated video, play normally
 *   loading   asking the gate
 *   entitled  play `manifestUrl`
 *   locked    show the paywall, optionally playing `previewUrl`
 *   error     gate unreachable — treated as locked, never as open
 *
 * @param {string|null} videoId  gate's id for the asset (the embed permlink)
 * @param {boolean} isGated      whether the post is marked supporters-only
 */
export function useGatedPlayback(videoId, isGated) {
  const [state, setState] = useState(() => (isGated && videoId ? 'loading' : 'idle'));
  const [manifestUrl, setManifestUrl] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [creator, setCreator] = useState(null);

  useEffect(() => {
    if (!isGated || !videoId) {
      setState('idle');
      setManifestUrl(null);
      setPreviewUrl(null);
      return undefined;
    }

    let cancelled = false;
    setState('loading');

    (async () => {
      try {
        const resp = await fetch(`${GATE_URL}/v1/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // Entitlement is decided from the wallet-session cookie.
          credentials: 'include',
          body: JSON.stringify({ videoId }),
        });

        if (cancelled) return;

        // 402 is the paywall: a price, not a prohibition. The body carries the
        // preview so the page has something to play behind the lock.
        if (resp.status === 402) {
          const data = await resp.json().catch(() => ({}));
          if (cancelled) return;
          setPreviewUrl(data.previewUrl || null);
          setCreator(data.creator || null);
          setState('locked');
          return;
        }

        if (!resp.ok) throw new Error(`gate returned ${resp.status}`);

        const data = await resp.json();
        if (cancelled) return;

        if (data.entitled && data.manifestUrl) {
          setManifestUrl(data.manifestUrl);
          setState('entitled');
        } else {
          setState('locked');
        }
      } catch (err) {
        if (cancelled) return;
        // Fail closed, matching the gate itself: if we cannot confirm access we
        // show the paywall rather than an error the viewer cannot act on.
        console.warn('[gated] session lookup failed:', err?.message || err);
        setState('error');
      }
    })();

    return () => { cancelled = true; };
  }, [videoId, isGated]);

  return {
    state,
    manifestUrl,
    previewUrl,
    creator,
    isLocked: state === 'locked' || state === 'error',
    isEntitled: state === 'entitled',
  };
}

export default useGatedPlayback;
