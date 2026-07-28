import * as tus from 'tus-js-client';
import { EMBED_API_KEY, EMBED_UPLOAD_FALLBACK_HOSTS } from './config';
import { pickEmbedEndpoint, getEmbedHosts } from './embedEndpoints';

/**
 * Upload a video file to the embed service and return the finished asset.
 *
 * This is the same TUS pipeline the embed studio uses, minus the wizard: pick a
 * healthy embed host, PUT the file, and read the canonical
 * `https://play.3speak.tv/embed?v=owner/permlink` URL back out of the
 * `X-Embed-URL` response header.
 *
 * Extracted so flows OTHER than "publish a brand new post" can upload a file —
 * currently "replace the video on an existing post" in EditVideoModal. The
 * studio's own uploader lives inside EmbedUploadContext and is bound to that
 * wizard's step/progress state, so it can't be called from elsewhere.
 *
 * No Hive broadcast happens here. The caller decides what to do with the
 * resulting asset (publish a new post, or repoint an existing one).
 *
 * @param {File|Blob} file
 * @param {object}    opts
 * @param {string}    opts.owner               Hive account the asset belongs to
 * @param {number}   [opts.duration]           seconds, best-effort metadata
 * @param {(pct:number) => void} [opts.onProgress]
 * @param {(u:tus.Upload) => void} [opts.onStart]  receives the upload so callers can abort
 * @returns {Promise<{embedUrl:string, owner:string, permlink:string}>}
 */
export async function uploadVideoAsset(file, { owner, duration = 0, onProgress, onStart } = {}) {
  if (!file) throw new Error('No file given.');
  if (!owner) throw new Error('No owner given.');
  if (!EMBED_API_KEY) throw new Error('Uploads are not configured (missing embed API key).');

  const { uploadUrl } = await pickEmbedEndpoint();

  let embedUrl = '';
  await new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: uploadUrl,
      // Sequential 8MB chunks, matching the studio: large parallel chunks
      // contend for bandwidth and trip tusd's lock handling.
      chunkSize: 8 * 1024 * 1024,
      retryDelays: [0, 3000, 5000, 10000, 20000, 30000],
      removeFingerprintOnSuccess: true,
      // Retry network drops and the transient 5xx tusd returns for stalled
      // bodies, but never retry auth/4xx — those will fail identically forever.
      onShouldRetry: (err) => {
        const status = err?.originalResponse?.getStatus?.() ?? 0;
        return status === 0 || status === 409 || status === 423 || status === 429 || status >= 500;
      },
      headers: { 'X-API-Key': EMBED_API_KEY },
      metadata: {
        filename: file.name || 'video.mp4',
        filetype: file.type || 'video/mp4',
        frontend_app: '3speak-tv',
        owner,
        short: 'false',
        duration: String(Math.round(duration || 0)),
        // Deliberately NO `permlink`: the service mints a fresh asset id. A
        // replacement must become its own asset — reusing the old permlink
        // would overwrite media that existing embeds still point at.
      },
      onProgress: (sent, total) => {
        if (onProgress && total) onProgress(Math.round((sent / total) * 100));
      },
      onAfterResponse: (req, res) => {
        const header = res.getHeader('X-Embed-URL') || res.getHeader('x-embed-url');
        if (header) embedUrl = header;
      },
      onError: reject,
      onSuccess: resolve,
    });
    onStart?.(upload);
    upload.start();
  });

  if (!embedUrl) {
    throw new Error('Upload finished but the server did not return a video URL.');
  }

  // …/embed?v=owner/permlink — the pair the post's `video.info` block needs.
  let assetOwner = owner;
  let assetPermlink = '';
  try {
    const vParam = new URL(embedUrl).searchParams.get('v') || '';
    const [o, p] = vParam.split('/');
    if (o) assetOwner = o;
    if (p) assetPermlink = p;
  } catch { /* keep the caller's owner, leave permlink empty */ }

  return { embedUrl, owner: assetOwner, permlink: assetPermlink };
}

/**
 * Register a freshly-uploaded asset as the replacement for an existing video.
 *
 * Nothing swaps immediately: the new asset still has to encode. Once it does,
 * the embed service copies its manifest onto the ORIGINAL entry, so that entry
 * keeps its permlink, upload date, view count, Hive association and its place in
 * every feed. The Hive post is never edited.
 *
 * @param {string} newPermlink       the just-uploaded asset
 * @param {string} originalPermlink  the asset whose media it should replace
 */
export async function registerMediaReplacement(newPermlink, originalPermlink) {
  if (!newPermlink || !originalPermlink || !EMBED_API_KEY) return;
  return postToAnyEmbedHost(
    `/video/${encodeURIComponent(newPermlink)}/replaces`,
    { replaces: originalPermlink },
  );
}

/**
 * POST to the first embed host that accepts it.
 *
 * These are DATABASE writes, and every embed host shares the same MongoDB — so a
 * call only has to reach ONE host, and picking the "least busy" one (which is
 * what pickEmbedEndpoint optimises for, correctly, for uploads) is meaningless
 * here. Worse, the hosts are deployed independently and run different builds, so
 * a load-balanced pick can land on one that predates the route. A 404/501 means
 * "this host is too old", not "the video doesn't exist" — try the next.
 */
async function postToAnyEmbedHost(path, body) {
  const hosts = [...getEmbedHosts(), ...(EMBED_UPLOAD_FALLBACK_HOSTS || [])]
    .map((h) => (h || '').replace(/\/+$/, ''))
    .filter(Boolean);
  const tried = new Set();

  let lastErr = null;
  for (const apiBase of hosts) {
    if (tried.has(apiBase)) continue;
    tried.add(apiBase);
    try {
      const res = await fetch(`${apiBase}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': EMBED_API_KEY },
        body: JSON.stringify(body),
      });
      if (res.ok) return await res.json().catch(() => ({}));
      lastErr = new Error(`${path} failed on ${apiBase} (${res.status})`);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error(`${path} failed: no embed host reachable`);
}

/** Read a video file's duration (seconds) without uploading it. Best-effort: resolves 0. */
export function probeVideoDuration(file) {
  return new Promise((resolve) => {
    try {
      const el = document.createElement('video');
      el.preload = 'metadata';
      const url = URL.createObjectURL(file);
      const done = (v) => { URL.revokeObjectURL(url); resolve(v); };
      el.onloadedmetadata = () => done(Number.isFinite(el.duration) ? el.duration : 0);
      el.onerror = () => done(0);
      el.src = url;
    } catch {
      resolve(0);
    }
  });
}
