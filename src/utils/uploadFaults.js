/**
 * Upload fault injection — a test harness for the upload failure modes we cannot
 * reproduce on a normal connection.
 *
 * The bugs that bite real users live on networks we can't borrow: a carrier that
 * silently eats the TUS PATCH method, or a middlebox that accepts an upload POST
 * and then black-holes it. Both are invisible on a healthy line. This lets us
 * trigger them on demand.
 *
 * WHO: badadib only (hardcoded — no env var, nothing to misconfigure). Every entry
 * point re-checks; there is no way to arm this as another user.
 *
 * HOW: both upload paths ultimately run on XMLHttpRequest — tus-js-client uses it
 * for PATCH, and the chunked fallback's postForm uses it directly — so one XHR
 * patch reaches both. It is installed lazily (only once a fault is actually armed)
 * and only ever alters requests to the upload endpoints; everything else on the
 * page goes through untouched.
 *
 * Flags live in sessionStorage so they survive the navigation between the upload
 * steps, and die with the tab.
 */

const FAULT_USER = 'badadib';
const KEY = '3speak_upload_faults';

export function canUseUploadFaults(user) {
  return String(user || '').toLowerCase() === FAULT_USER;
}

const DEFAULTS = {
  blockPatch: false,       // carrier eats the TUS PATCH → should trip the watchdog → auto-fallback
  blackholeChunks: false,  // middlebox swallows the fallback's chunk POSTs → should trip the stall watchdog
  chunkFailRate: 0,        // 0..1 — flaky link: fail this share of chunk POSTs → should retry + resync
};

export function getUploadFaults() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setUploadFaults(user, patch) {
  if (!canUseUploadFaults(user)) return getUploadFaults();
  const next = { ...getUploadFaults(), ...patch };
  try { sessionStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  if (isArmed(next)) installUploadFaults();
  return next;
}

export function clearUploadFaults() {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}

function isArmed(f) {
  return !!(f.blockPatch || f.blackholeChunks || f.chunkFailRate > 0);
}

// Only ever touch the upload endpoints — never the rest of the app's traffic.
const isTusUrl = (url) => /\/uploads(\/|$)/.test(url);
const isChunkUrl = (url) => /\/upload\/(chunk|simple)/.test(url);

const log = (...a) => console.warn('[upload-faults]', ...a);

let installed = false;

/**
 * Patch XHR once. The patch is inert unless a fault is armed AND the request is an
 * upload request, so leaving it installed after the flags are cleared is harmless.
 */
export function installUploadFaults() {
  if (installed || typeof XMLHttpRequest === 'undefined') return;
  installed = true;

  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function patchedOpen(method, url, ...rest) {
    this.__fault = { method: String(method || '').toUpperCase(), url: String(url || '') };
    return origOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function patchedSend(body) {
    const f = getUploadFaults();
    const { method = '', url = '' } = this.__fault || {};

    if (isArmed(f) && (isTusUrl(url) || isChunkUrl(url))) {
      // A black hole: the request leaves and NOTHING ever comes back. No response,
      // no error, no timeout — the case that hangs a naive uploader forever.
      const blackhole =
        (f.blockPatch && method === 'PATCH') ||
        (f.blackholeChunks && method === 'POST' && isChunkUrl(url));

      if (blackhole) {
        log(`black-holed ${method} ${url}`);
        // We never call the real send(), so per spec the send() flag stays unset and
        // a later abort() would fire NO event — which would leave the caller's
        // promise pending and make it look like the app is broken when it isn't.
        // Re-dispatch abort ourselves so the caller's stall watchdog can still cut
        // this request loose. Without this the harness would be testing a fiction.
        this.abort = () => {
          try { this.dispatchEvent(new ProgressEvent('abort')); } catch { /* ignore */ }
        };
        return undefined;
      }

      // A flaky link: the request dies mid-flight with a bare network error, the way
      // a dropped mobile connection does. Exercises the retry + /status resync path.
      if (f.chunkFailRate > 0 && method === 'POST' && isChunkUrl(url) && Math.random() < f.chunkFailRate) {
        log(`failed ${method} ${url} (chunkFailRate ${f.chunkFailRate})`);
        setTimeout(() => {
          try { this.dispatchEvent(new ProgressEvent('error')); } catch { /* ignore */ }
        }, 250);
        return undefined;
      }
    }

    return origSend.call(this, body);
  };
}

// Re-arm on a fresh page load if the flags survived in sessionStorage (e.g. the
// tester reloaded mid-upload to check that resume works).
export function initUploadFaults(user) {
  if (!canUseUploadFaults(user)) return;
  if (isArmed(getUploadFaults())) installUploadFaults();
}
