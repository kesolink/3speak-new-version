// Viewer-tag: the topic a user picks in the vote dialog. It's broadcast on-chain
// in the same transaction as the vote (a 3speak-viewer-tag custom_json — see
// voteWithAioha), and ALSO written here to the checker so it's queryable per video.
//
// The winning tag for a video is the one with the highest COMBINED vote weight
// (summed across voters), computed server-side — see GET /viewer-tags/:a/:p.
import axios from 'axios';
import { CHECKER_URL } from './config';
import { INTERESTS } from './interests';

// The only tags a viewer may assign — the interest taxonomy, for the dropdown.
export const VIEWER_TAG_OPTIONS = INTERESTS;

/** Mirror the on-chain choice into the checker's queryable index. Best-effort. */
export async function recordViewerTag(username, author, permlink, tag, weight) {
  if (!username || !author || !permlink || !tag) return false;
  try {
    await axios.post(`${CHECKER_URL}/viewer-tag`, { username, author, permlink, tag, weight });
    return true;
  } catch (err) {
    // The authoritative record is the signed on-chain custom_json; a failed mirror
    // write must never make the vote look failed.
    console.error('recordViewerTag failed:', err);
    return false;
  }
}

/** Crowd tally for a video (winner = highest combined vote weight). */
export async function getViewerTags(author, permlink) {
  try {
    const res = await axios.get(
      `${CHECKER_URL}/viewer-tags/${encodeURIComponent(author)}/${encodeURIComponent(permlink)}`
    );
    return res.data;
  } catch (err) {
    return null;
  }
}

/** Has this user already tagged the video? → { tagged, tag }. For the one-shot
 *  tag-only path after the payout window closes. */
export async function getMyViewerTag(username, author, permlink) {
  if (!username || !author || !permlink) return { tagged: false, tag: null };
  try {
    const res = await axios.get(
      `${CHECKER_URL}/viewer-tag/mine/${encodeURIComponent(username)}/${encodeURIComponent(author)}/${encodeURIComponent(permlink)}`
    );
    return res.data;
  } catch (err) {
    return { tagged: false, tag: null };
  }
}
