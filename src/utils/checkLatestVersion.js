import { APP_VERSION } from "../version";
import { APP_VERSION_STORAGE_KEY } from "./appVersion";

// The deployed site is built from the repo's `develop` branch, whose version.js
// is the source of truth for the latest released version. We read it raw from
// GitHub and compare it to the version baked into the running bundle, so a user
// on a stale (cached) build can be prompted to refresh.
const REMOTE_VERSION_URL =
  "https://raw.githubusercontent.com/Mantequilla-Soft/new-3speak-tv/develop/src/version.js";

// "export const APP_VERSION = '1.2.3';" → "1.2.3"
function parseVersion(text) {
  const m = String(text || "").match(/APP_VERSION\s*=\s*['"]([\d.]+)['"]/);
  return m ? m[1] : null;
}

// true when version `a` is newer than `b` (numeric dot-separated parts).
export function isNewerVersion(a, b) {
  const pa = String(a).split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}

// Returns the latest version string if GitHub's develop is newer than the
// running build, otherwise null (also null on any network error / offline).
export async function fetchNewerVersion() {
  try {
    const res = await fetch(`${REMOTE_VERSION_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const remote = parseVersion(await res.text());

    let stored = null;
    try { stored = localStorage.getItem(APP_VERSION_STORAGE_KEY); } catch { /* ignore */ }
    console.log(
      `[version] GitHub (develop): ${remote} | browser storage: ${stored} | running build: ${APP_VERSION}`
    );

    if (remote && isNewerVersion(remote, APP_VERSION)) return remote;
  } catch {
    // offline / blocked — ignore, no prompt
  }
  return null;
}

// Drop caches + service workers and reload, so the browser fetches the new build
// fresh instead of serving the cached (stale) one.
export async function reloadForUpdate() {
  try {
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    // ignore — reload anyway
  }
  window.location.reload();
}
