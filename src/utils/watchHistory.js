import axios from 'axios';
import { PLAYLISTS_API_URL } from './config';

/**
 * Record that a user watched a video
 * @param {string} username - The user who watched
 * @param {string} author - Video author
 * @param {string} permlink - Video permlink
 */
export async function recordWatch(username, author, permlink) {
  if (!username || !author || !permlink) {
    return null;
  }

  try {
    const response = await axios.put(`${PLAYLISTS_API_URL}/watch-history`, {
      username,
      author,
      permlink,
    });
    return response.data;
  } catch (error) {
    console.error('Failed to record watch:', error);
    return null;
  }
}

/**
 * Batch check which videos a user has watched
 * @param {string} username - The user to check
 * @param {Array<{author: string, permlink: string}>} videos - Videos to check
 * @returns {Promise<Map<string, {watched_at: number, last_watched_at: number, watch_count: number}>>}
 */
export async function batchCheckWatched(username, videos) {
  if (!username || !videos || videos.length === 0) {
    return new Map();
  }

  try {
    const response = await axios.post(`${PLAYLISTS_API_URL}/watch-history/batch`, {
      username,
      videos: videos.map(v => ({
        author: v.author,
        permlink: v.permlink,
      })),
    });

    const result = new Map();
    for (const item of response.data.watched || []) {
      const key = `${item.author}/${item.permlink}`;
      result.set(key, {
        watched_at: item.watched_at,
        last_watched_at: item.last_watched_at,
        watch_count: item.watch_count,
      });
    }
    return result;
  } catch (error) {
    console.error('Failed to batch check watch history:', error);
    return new Map();
  }
}

/**
 * Get a user's watch history
 * @param {string} username - The user
 * @param {number} limit - Max items to return
 * @param {number} offset - Items to skip
 */
export async function getWatchHistory(username, limit = 50, offset = 0) {
  if (!username) {
    return [];
  }

  try {
    const response = await axios.get(
      `${PLAYLISTS_API_URL}/watch-history/${username}?limit=${limit}&offset=${offset}`
    );
    return response.data.history || [];
  } catch (error) {
    console.error('Failed to get watch history:', error);
    return [];
  }
}

/**
 * Get the count of watched videos for a user
 * @param {string} username - The user
 * @returns {Promise<number>} The count of watched videos
 */
export async function getWatchHistoryCount(username) {
  if (!username) {
    return 0;
  }

  try {
    const response = await axios.get(
      `${PLAYLISTS_API_URL}/watch-history/${username}/count`
    );
    return response.data.count || 0;
  } catch (error) {
    console.error('Failed to get watch history count:', error);
    return 0;
  }
}
