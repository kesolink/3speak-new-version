import axios from 'axios';
import { CHECKER_URL } from './config';

// Reads a creator's moderation settings from the checker.
// GET /check/:username -> { canPost, banned, canUpload, reason }
// Returns null on any error / unreachable so callers fail OPEN (never block a
// user because the check itself failed).
export async function getCreatorSettings(username) {
  if (!username) return null;
  try {
    const { data } = await axios.get(
      `${CHECKER_URL.replace(/\/$/, '')}/check/${encodeURIComponent(username)}`,
      { timeout: 8000 },
    );
    return data || null;
  } catch {
    return null;
  }
}

// Explicit-only checks: only treat as blocked when the flag is literally set.
// Users not in the contentcreators collection (banned/canUpload undefined) are
// NOT blocked.
export const isBanned = (s) => s?.banned === true;
export const isUploadBlocked = (s) => s?.canUpload === false;
