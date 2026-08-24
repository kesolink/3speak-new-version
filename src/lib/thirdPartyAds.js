/**
 * The single door every third-party ad script has to walk through.
 *
 * WHY THIS EXISTS AS A MODULE rather than a `if (consent) { … }` at each call site:
 * there will eventually be more than one of these (a rewarded SDK on the upload
 * gate, a VAST tag on the watch page, whatever replaces them when we switch
 * networks), and the failure mode is that one of them ships without the check. A
 * loader that refuses is harder to get wrong than a convention that has to be
 * remembered. Nothing in the app should ever write `document.createElement('script')`
 * for an ad network; it should call loadAdScript() and let this decide.
 *
 * TWO SOURCES OF TRUTH, deliberately:
 *
 *   1. Our own banner's `advertising` category (lib/consent.js). Covers everyone,
 *      including the majority of our audience who are nowhere near GDPR.
 *   2. An IAB TCF v2.2 CMP, when one is present. Ad networks read the TC string
 *      directly and price EU inventory on it; ayeT-Studios in particular warns that
 *      fill and eCPM degrade sharply without a compliant CMP.
 *
 * While both exist, BOTH must say yes. That is the conservative reading and it is
 * the correct one during the transition: our banner is the thing the user actually
 * saw and clicked, and the TC string is the thing the ad network acts on.
 *
 * INTENDED END STATE, once the CMP is configured: the CMP becomes the only surface
 * that asks about advertising, our banner keeps only the playback-position choice,
 * and adConsentState() below simply reflects the TC string. The shape here does not
 * need to change for that; only which of the two sources is present.
 */
import { ENABLE_THIRDPARTY_ADS } from '../utils/config';
import { hasConsent } from './consent';

/**
 * Is a TCF CMP on the page at all? InMobi CMP (and every other certified one)
 * exposes __tcfapi. Absent means we are on our own banner alone, which is the
 * state today and the permanent state if the CMP is never installed.
 */
function cmpPresent() {
  return typeof window !== 'undefined' && typeof window.__tcfapi === 'function';
}

// Last TC decision we were told about. `null` means the CMP has not answered yet,
// which is NOT the same as a refusal and must not be treated as one: pre-answer we
// simply do not load, and we re-check when it does answer.
let tcState = null;

/**
 * Subscribe to the CMP once, if there is one.
 *
 * Purpose 1 is "Store and/or access information on a device", which is precisely
 * the permission an ad SDK needs before it may exist on the page. Vendor-level and
 * purpose 2-10 checks are the ad network's problem, not ours: they read the same TC
 * string we do and will decline to serve if it does not cover them. Gating on
 * purpose 1 keeps this from silently diverging from what the networks enforce.
 *
 * gdprApplies === false means the visitor is outside the TCF's scope, which is the
 * common case for us given the audience mix. The CMP has still spoken, so that is a
 * decision and not an unknown.
 */
let cmpSubscribed = false;
export function subscribeToCmp() {
  if (cmpSubscribed || !cmpPresent()) return;
  cmpSubscribed = true;
  try {
    window.__tcfapi('addEventListener', 2, (tcData, success) => {
      if (!success || !tcData) return;
      const settled = tcData.eventStatus === 'tcloaded'
        || tcData.eventStatus === 'useractioncomplete';
      if (!settled) return;
      tcState = tcData.gdprApplies === false
        ? true
        : !!tcData.purpose?.consents?.[1];
      notify();
    });
  } catch {
    // A CMP that throws on subscribe is a CMP we cannot trust to have granted
    // anything. Leaving tcState null keeps the door shut.
  }
}

/**
 * 'granted' | 'denied' | 'pending'
 *
 * 'pending' is its own answer on purpose. Callers must not collapse it into
 * 'denied' and give up: the CMP resolves a beat after page load, and a gate that
 * decided "no ads" during that beat would report a false no-fill for every first
 * page view.
 */
export function adConsentState() {
  if (!ENABLE_THIRDPARTY_ADS) return 'denied';
  if (!hasConsent('advertising')) return 'denied';
  if (!cmpPresent()) return 'granted';
  if (tcState === null) return 'pending';
  return tcState ? 'granted' : 'denied';
}

/** Convenience predicate. Anything not an outright yes is a no. */
export function canLoadAdScripts() {
  return adConsentState() === 'granted';
}

// --- change notification -----------------------------------------------------
//
// Consent can flip mid-session: the banner is answered, or the CMP resolves, and a
// gate that already rendered "ads unavailable" should be able to recover without a
// reload.

const listeners = new Set();
function notify() {
  listeners.forEach((fn) => {
    try { fn(adConsentState()); } catch { /* a bad listener must not break the rest */ }
  });
}

/** Returns an unsubscribe function. */
export function onAdConsentChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Called by the consent banner after the user answers, so listeners re-evaluate. */
export function notifyAdConsentChanged() {
  notify();
}

// --- the loader --------------------------------------------------------------

const loaded = new Map(); // src -> Promise<void>

/**
 * Inject a third-party ad script, or refuse.
 *
 * Rejects rather than resolving-with-false so a caller cannot accidentally carry on
 * as though the SDK were there. The rejection reason is stable and worth branching
 * on: 'consent' means try again if the user changes their mind, 'network' means the
 * script itself failed and the caller should treat it as no-fill.
 */
export function loadAdScript(src, { attrs = {} } = {}) {
  const state = adConsentState();
  if (state !== 'granted') {
    return Promise.reject(Object.assign(new Error(`ad script blocked: ${state}`), {
      reason: 'consent',
      state,
    }));
  }
  if (loaded.has(src)) return loaded.get(src);

  const p = new Promise((resolve, reject) => {
    try {
      const el = document.createElement('script');
      el.src = src;
      el.async = true;
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      el.onload = () => resolve();
      el.onerror = () => {
        // Drop the memo so a later attempt can retry. An adblocker and a flaky CDN
        // look identical here, and both are worth one more try on the next upload.
        loaded.delete(src);
        reject(Object.assign(new Error(`ad script failed: ${src}`), { reason: 'network' }));
      };
      document.head.appendChild(el);
    } catch (e) {
      loaded.delete(src);
      reject(Object.assign(e, { reason: 'network' }));
    }
  });

  loaded.set(src, p);
  return p;
}
