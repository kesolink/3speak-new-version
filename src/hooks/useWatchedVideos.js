import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../lib/store';
import { getWatchHistoryCount, getWatchHistory } from '../utils/watchHistory';

/**
 * Hook to fetch the watched videos count for the current user
 * Used on the profile page to display a "Watched" pseudo-playlist
 */
export function useWatchedVideosCount() {
  const { user } = useAppStore();

  return useQuery({
    queryKey: ['watchedVideosCount', user],
    queryFn: () => getWatchHistoryCount(user),
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to fetch watched videos list with pagination
 * @param {number} limit - Items per page
 * @param {number} offset - Items to skip
 */
export function useWatchedVideos(limit = 50, offset = 0) {
  const { user } = useAppStore();

  return useQuery({
    queryKey: ['watchedVideos', user, limit, offset],
    queryFn: () => getWatchHistory(user, limit, offset),
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export default useWatchedVideosCount;
