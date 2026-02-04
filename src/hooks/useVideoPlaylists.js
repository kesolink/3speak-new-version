import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const PLAYLISTS_API_URL = 'https://3speak-playlists.okinoko.io';

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
        `${PLAYLISTS_API_URL}/api/video/${author}/${permlink}/playlists/public`
      );

      // API returns { count, playlists: [...] }
      return response.data?.playlists || [];
    },
    enabled: !!author && !!permlink,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export default useVideoPlaylists;
