// Picks which embed-upload server to use for a given upload, when more than one
// is configured (VITE_EMBED_UPLOAD_URLS). Goal: send the upload to the least-busy
// reachable server so concurrent uploads spread across hosts.
//
// "Free" needs a real signal. We GET each host's /health and read OPTIONAL load
// fields if the server exposes them:
//   - activeUploads (number)  — lower = freer   (primary)
//   - freeDiskPct  (0..100)   — skip hosts under FULL_DISK_PCT, prefer more free
// If a server doesn't expose load (current /health only returns {status:'ok'}),
// we fall back to probe latency (a saturated host answers slower), then random.
// The pick NEVER blocks an upload: any failure falls back to the default host.

import { EMBED_UPLOAD_HOSTS, EMBED_API_URL } from './config';

const PROBE_TIMEOUT_MS = 2500;
const FULL_DISK_PCT = 3; // treat a host with <3% free disk as unavailable

/** Configured base hosts (no trailing slash / /uploads), or the single default. */
export function getEmbedHosts() {
  const base = (EMBED_API_URL || '').replace(/\/+$/, '');
  return EMBED_UPLOAD_HOSTS.length ? EMBED_UPLOAD_HOSTS : [base].filter(Boolean);
}

function uploadUrlFor(base) {
  return `${base.replace(/\/+$/, '')}/uploads`;
}

async function probe(base) {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/health`, { signal: controller.signal, cache: 'no-store' });
    const latency = performance.now() - started;
    if (!res.ok) return { base, ok: false };
    let body = {};
    try { body = await res.json(); } catch { /* health may not be JSON */ }
    const activeUploads = Number.isFinite(body.activeUploads) ? body.activeUploads : null;
    const freeDiskPct = Number.isFinite(body.freeDiskPct) ? body.freeDiskPct : null;
    const tooFull = freeDiskPct != null && freeDiskPct < FULL_DISK_PCT;
    return { base, ok: !tooFull, latency, activeUploads, freeDiskPct };
  } catch {
    return { base, ok: false };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Choose an embed endpoint. Returns { base, uploadUrl }.
 * Selection order: fewest activeUploads → lowest latency → (fallback) random/first.
 */
export async function pickEmbedEndpoint() {
  const hosts = getEmbedHosts();
  const fallback = { base: hosts[0] || (EMBED_API_URL || '').replace(/\/+$/, ''), get uploadUrl() { return uploadUrlFor(this.base); } };

  // Single host (or none configured) → nothing to choose.
  if (hosts.length <= 1) return { base: fallback.base, uploadUrl: uploadUrlFor(fallback.base) };

  const results = (await Promise.all(hosts.map(probe))).filter((r) => r.ok);
  if (!results.length) {
    // Nothing answered healthily — don't block; use the first configured host.
    return { base: fallback.base, uploadUrl: uploadUrlFor(fallback.base) };
  }

  // Pick the least-busy server, but SPREAD across ties. Under light load every
  // host reports activeUploads: 0, so a deterministic tie-break (e.g. latency)
  // would always land on the same (closest) host and never use the others.
  // Candidate pool = the load-reporting hosts at the lowest activeUploads, PLUS
  // any reachable host that can't report load (older build with the old /health).
  // Then pick one at random. This means:
  //   - among reporters, a genuinely busier host is avoided;
  //   - a healthy non-reporting host still participates (spread to blindly,
  //     since we can't read its load) instead of being permanently skipped.
  const reporters = results.filter((r) => r.activeUploads != null);
  let pool = results;
  if (reporters.length) {
    const min = Math.min(...reporters.map((r) => r.activeUploads));
    pool = results.filter((r) => r.activeUploads == null || r.activeUploads === min);
  }

  const chosen = pool[Math.floor(Math.random() * pool.length)].base;
  return { base: chosen, uploadUrl: uploadUrlFor(chosen) };
}
