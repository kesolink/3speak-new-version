import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../lib/store';
import { batchCheckWatched } from '../utils/watchHistory';
import { WATCH_HISTORY_THRESHOLD_DAYS } from '../utils/config';

/**
 * Hook to batch check watch history for a list of videos
 * @param {Array} videos - Array of video objects with author/permlink
 * @returns {{ watchedData: Map, isWatched: Function, loading: boolean }}
 */
export function useWatchHistory(videos) {
  const { user } = useAppStore();
  const watchedDataRef = useRef(new Map());
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(new Set());

  useEffect(() => {
    if (!user || !videos || videos.length === 0) {
      return;
    }

    // Calculate threshold date based on config
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - WATCH_HISTORY_THRESHOLD_DAYS);

    // Filter videos we haven't checked yet AND are within threshold
    const newVideos = videos.filter(video => {
      const author = video.author?.username || video.author || video.owner;
      const permlink = video.permlink;
      if (!author || !permlink) return false;

      // Only query for videos within threshold
      const videoDate = new Date(video.created_at || video.created);
      if (videoDate < thresholdDate) return false;

      const key = `${author}/${permlink}`;
      return !fetchedRef.current.has(key);
    });

    if (newVideos.length === 0) {
      return;
    }

    const fetchWatchHistory = async () => {
      setLoading(true);

      // Prepare posts for batch request (max 50 at a time)
      const postsToFetch = newVideos.slice(0, 50).map(video => ({
        author: video.author?.username || video.author || video.owner,
        permlink: video.permlink,
      }));

      // Mark as fetched to avoid re-fetching
      postsToFetch.forEach(post => {
        fetchedRef.current.add(`${post.author}/${post.permlink}`);
      });

      try {
        const results = await batchCheckWatched(user, postsToFetch);

        // Merge new results with existing data in ref
        results.forEach((value, key) => {
          watchedDataRef.current.set(key, value);
        });
        
        // Trigger re-render without changing Map reference
        setVersion(v => v + 1);
      } catch (error) {
        console.error('Error fetching watch history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWatchHistory();
  }, [videos, user]);

  // Helper function to check if a video was watched
  const isWatched = useCallback((author, permlink) => {
    if (!user) return null; // null = unknown (not logged in)
    const key = `${author}/${permlink}`;
    return watchedDataRef.current.has(key);
  }, [user]);

  // Helper function to get watch data for a video
  const getWatchData = useCallback((author, permlink) => {
    const key = `${author}/${permlink}`;
    return watchedDataRef.current.get(key) || null;
  }, []);

  return {
    watchedData: watchedDataRef.current,
    isWatched,
    getWatchData,
    loading,
  };
}
