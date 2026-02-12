import axios from 'axios';
import { PLAYLISTS_API_URL } from './config';

/**
 * Record a reshare (idempotent — duplicates are ignored)
 */
export async function recordReshare(username, author, permlink) {
  if (!username || !author || !permlink) return null;
  try {
    const response = await axios.put(`${PLAYLISTS_API_URL}/reshares`, {
      username,
      author,
      permlink,
    });
    return response.data;
  } catch (error) {
    console.error('Failed to record reshare:', error);
    return null;
  }
}

/**
 * Get all reshares for a video
 * @returns {Promise<{reshares: Array<{username: string, reshared_at: number}>, count: number}>}
 */
export async function getResharesForVideo(author, permlink, limit = 50, offset = 0) {
  if (!author || !permlink) return { reshares: [], count: 0 };
  try {
    const response = await axios.get(
      `${PLAYLISTS_API_URL}/reshares/${author}/${permlink}?limit=${limit}&offset=${offset}`
    );
    return {
      reshares: response.data.reshares || [],
      count: response.data.count || 0,
    };
  } catch (error) {
    console.error('Failed to get reshares:', error);
    return { reshares: [], count: 0 };
  }
}

/**
 * Get reshare count for a video
 */
export async function getReshareCount(author, permlink) {
  if (!author || !permlink) return 0;
  try {
    const response = await axios.get(
      `${PLAYLISTS_API_URL}/reshares/${author}/${permlink}/count`
    );
    return response.data.count || 0;
  } catch (error) {
    console.error('Failed to get reshare count:', error);
    return 0;
  }
}

/**
 * Check if a user has reshared a video
 * @returns {Promise<{reshared: boolean, reshared_at?: number}>}
 */
export async function hasUserReshared(username, author, permlink) {
  if (!username || !author || !permlink) return { reshared: false };
  try {
    const response = await axios.get(
      `${PLAYLISTS_API_URL}/reshares/${username}/${author}/${permlink}`
    );
    return {
      reshared: response.data.reshared || false,
      reshared_at: response.data.reshared_at,
    };
  } catch (error) {
    console.error('Failed to check reshare:', error);
    return { reshared: false };
  }
}

/**
 * Delete a reshare
 */
export async function deleteReshare(username, author, permlink) {
  if (!username || !author || !permlink) return false;
  try {
    await axios.delete(
      `${PLAYLISTS_API_URL}/reshares/${username}/${author}/${permlink}`
    );
    return true;
  } catch (error) {
    console.error('Failed to delete reshare:', error);
    return false;
  }
}
