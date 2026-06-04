import { APP_VERSION } from '../version';

export const APP_VERSION_STORAGE_KEY = '3speak_app_version';

// Run once on app startup. Returns the PREVIOUS version string only when the user
// actually upgraded (they had a stored version AND it differs from the current one).
// First-time visitors have no stored version: we store the current one silently and
// return null, so no "what's new" message ever pops up for them. Always advances the
// stored version to the current one.
export function checkAppVersion() {
  let previousVersion = null;
  try {
    const stored = localStorage.getItem(APP_VERSION_STORAGE_KEY);
    if (stored && stored !== APP_VERSION) {
      previousVersion = stored;
    }
    if (stored !== APP_VERSION) {
      localStorage.setItem(APP_VERSION_STORAGE_KEY, APP_VERSION);
    }
  } catch {
    // localStorage unavailable (private mode / blocked) — skip silently.
  }
  return previousVersion;
}

export { APP_VERSION };
