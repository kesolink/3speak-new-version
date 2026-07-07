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

import { EMBED_UPLOAD_HOSTS, EMBED_UPLOAD_FALLBACK_HOSTS, EMBED_API_URL } from './config';

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

// Among reachable probe results, pick the least-busy server, SPREADING across
// ties. Under light load every host reports activeUploads: 0, so a deterministic
// tie-break (e.g. latency) would always land on the same host and never use the
// others. Candidate pool = load-reporting hosts at the lowest activeUploads, PLUS
// any reachable host that can't report load (older /health). Then pick at random:
//   - among reporters, a genuinely busier host is avoided;
//   - a healthy non-reporting host still participates (spread to blindly).
// Returns the chosen base, or null when nothing was reachable.
function chooseFromResults(results) {
  if (!results.length) return null;
  const reporters = results.filter((r) => r.activeUploads != null);
  let pool = results;
  if (reporters.length) {
    const min = Math.min(...reporters.map((r) => r.activeUploads));
    pool = results.filter((r) => r.activeUploads == null || r.activeUploads === min);
  }
  return pool[Math.floor(Math.random() * pool.length)].base;
}

async function probeAndChoose(hosts) {
  if (!hosts || !hosts.length) return null;
  const results = (await Promise.all(hosts.map(probe))).filter((r) => r.ok);
  return chooseFromResults(results);
}

/**
 * Choose an embed endpoint. Returns { base, uploadUrl }.
 * Tiered: prefer a reachable PRIMARY host (embed2 / embed-okinoko — fast, load
 * spread among them); only drop to the FALLBACK tier (slow legacy embed.3speak.tv)
 * when NO primary answers healthily. Never blocks: any failure → first configured.
 */
export async function pickEmbedEndpoint() {
  const primary = getEmbedHosts();
  const fallbackHosts = EMBED_UPLOAD_FALLBACK_HOSTS || [];
  const ultimate = primary[0] || fallbackHosts[0] || (EMBED_API_URL || '').replace(/\/+$/, '');

  // Fast path: a single primary and no fallback tier → nothing to choose/probe.
  if (primary.length <= 1 && !fallbackHosts.length) {
    return { base: ultimate, uploadUrl: uploadUrlFor(ultimate) };
  }

  let chosen = await probeAndChoose(primary);          // fast tier first
  if (!chosen) chosen = await probeAndChoose(fallbackHosts); // only if no primary is up
  const base = chosen || ultimate;
  return { base, uploadUrl: uploadUrlFor(base) };
}
