import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '../lib/store';
import { PLAYLISTS_API_URL } from '../utils/config';

/**
 * Fetch ALL playlists for the authenticated user (public + private)
 * Ordered by modification date descending
 * @param {object} options - Query options
 * @returns {object} React Query result with playlists data
 */
export function useMyPlaylists(options = {}) {
  const { user } = useAppStore();

  return useQuery({
    queryKey: ['myPlaylists', user],
    queryFn: async () => {
      if (!user) return [];

      const response = await axios.get(`${PLAYLISTS_API_URL}/playlists`, {
        params: {
          owner: user,
          limit: options.limit || 100,
          offset: options.offset || 0,
        },
      });

      // API returns { count, playlists: [...] }
      const playlists = response.data?.playlists || [];

      // Sort by updated_at descending (most recently modified first)
      return playlists.sort((a, b) => {
        const dateA = new Date(a.updated_at || a.created_at || 0);
        const dateB = new Date(b.updated_at || b.created_at || 0);
        return dateB - dateA;
      });
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
    ...options,
  });
}

/**
 * Check if a video is already in a playlist
 * @param {object} playlist - The playlist object
 * @param {string} author - Video author
 * @param {string} permlink - Video permlink
 * @returns {boolean} True if video is in playlist
 */
export function isVideoInPlaylist(playlist, author, permlink) {
  if (!playlist?.items || !Array.isArray(playlist.items)) return false;
  return playlist.items.some(
    (item) => item.author === author && item.permlink === permlink
  );
}

export default useMyPlaylists;
