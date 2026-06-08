import { APP_VERSION } from '../version';

export const APP_VERSION_STORAGE_KEY = '3speak_app_version';

// Read the stored version and decide whether to show the "what's new" popup.
// Returns { previousVersion, shouldPrompt }.
//
// IMPORTANT ordering: for an UPGRADE we do NOT write the new version here — the
// stored value is advanced only AFTER the popup has actually been shown (see
// markVersionSeen, called on close). That way the popup reliably appears (and keeps
// appearing on reload) until the user has seen it.
//
// First-time visitors (no stored version) are recorded immediately and never
// prompted, so the "what's new" message doesn't pop up for someone with no history.
export function readAppVersion() {
  try {
    const stored = localStorage.getItem(APP_VERSION_STORAGE_KEY);
    if (!stored) {
      localStorage.setItem(APP_VERSION_STORAGE_KEY, APP_VERSION);
      return { previousVersion: null, shouldPrompt: false };
    }
    if (stored !== APP_VERSION) {
      return { previousVersion: stored, shouldPrompt: true };
    }
    return { previousVersion: null, shouldPrompt: false };
  } catch {
    return { previousVersion: null, shouldPrompt: false };
  }
}

// Advance the stored version to the current one. Call this once the "what's new"
// popup has actually been shown to (and dismissed by) the user.
export function markVersionSeen() {
  try {
    localStorage.setItem(APP_VERSION_STORAGE_KEY, APP_VERSION);
  } catch {
    // localStorage unavailable — ignore.
  }
}

export { APP_VERSION };
