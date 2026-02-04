import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { PLAYLISTS_API_URL } from '../utils/config';

/**
 * Fetch public playlists that contain a specific video
 * @param {string} author - Video author
 * @param {string} permlink - Video permlink
 * @returns {object} React Query result with playlists data
 */
export function useVideoPlaylists(author, permlink) {
  return useQuery({
    queryKey: ['videoPlaylists', author, permlink],
    queryFn: async () => {
      if (!author || !permlink) return [];

      const response = await axios.get(
        `${PLAYLISTS_API_URL}/video/${author}/${permlink}/playlists/public`
      );

      // API returns { count, playlists: [...] }
      return response.data?.playlists || [];
    },
    enabled: !!author && !!permlink,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export default useVideoPlaylists;
