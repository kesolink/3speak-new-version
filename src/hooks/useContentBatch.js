import { useState, useEffect, useRef, useCallback } from 'react';
import { batchGetContent } from '../utils/hiveUtils';
import { useAppStore } from '../lib/store';

/**
 * Hook to batch fetch content data (payout, voters, vote status, comment count) for multiple videos
 * @param {Array} videos - Array of video objects with author and permlink
 * @returns {Object} - { contentData: Map, loading: boolean, error: Error|null }
 */
export function useContentBatch(videos) {
  const { user } = useAppStore();
  const contentDataRef = useRef(new Map());
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Track which posts we've already fetched to avoid refetching
  const fetchedRef = useRef(new Set());

  useEffect(() => {
    if (!videos || videos.length === 0) return;

    // Videos the checker already answered (stats.has_stats) need no Hive call at
    // all — payout/votes/comments came down with the feed, and Card3 reads them
    // through its existing `video.stats` fallback. Anything not cached server-side
    // yet still falls back to fetching here, so this degrades gracefully while the
    // cache warms (and is inert until the checker's VIDEO_STATS_ENABLED is on).
    const postsToFetch = videos
      .filter((video) => video?.stats?.has_stats !== true)
      .map((video) => ({
        author: video.author?.username || video.author?.id || video.author || video.owner,
        permlink: video.permlink,
      }))
      .filter((post) => {
        const key = `${post.author}/${post.permlink}`;
        return post.author && post.permlink && !fetchedRef.current.has(key);
      });

    if (postsToFetch.length === 0) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const results = await batchGetContent(postsToFetch, user);

        // Mark these as fetched
        for (const post of postsToFetch) {
          fetchedRef.current.add(`${post.author}/${post.permlink}`);
        }

        // Merge with existing data in ref
        for (const [key, value] of results) {
          contentDataRef.current.set(key, value);
        }
        
        // Trigger re-render without changing Map reference
        setVersion(v => v + 1);
      } catch (err) {
        console.error('useContentBatch error:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [videos, user]);

  /**
   * Get content data for a specific video
   * @param {string} author
   * @param {string} permlink
   * @returns {Object|null} - { payout, voters, isVoted, children } or null if not loaded
   */
  const getContentForVideo = useCallback((author, permlink) => {
    const key = `${author}/${permlink}`;
    return contentDataRef.current.get(key) || null;
  }, []); // Empty deps - always stable!

  return {
    contentData: contentDataRef.current,
    getContentForVideo,
    loading,
    error,
  };
}

export default useContentBatch;
