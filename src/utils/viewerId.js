/**
 * Stable, pseudonymous per-browser viewer id for watch-duration tracking.
 *
 * Generated once on first visit and persisted, so the same browser counts as ONE
 * viewer across visits — which is what "distinct viewers" / "new vs returning"
 * need. It's more privacy-preserving than an IP (no cross-site meaning, not tied
 * to your network/location) AND more accurate (an IP is shared across a household
 * / behind NAT). It's sent on every watch session:
 *   - Private Mode ON  → the server stores ONLY this id and drops the IP entirely.
 *   - Private Mode OFF → sent alongside the IP; the id is the viewer key, the IP is
 *     kept just for coarse country demographics.
 */
const KEY = '3speak_viewer_id';

export function getViewerId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      const rnd = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
      id = String(rnd).replace(/[^a-zA-Z0-9]/g, '').slice(0, 40);
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null; // private-browsing with storage disabled → server falls back to IP
  }
}
