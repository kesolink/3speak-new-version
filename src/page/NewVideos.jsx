import React, { useState } from 'react'
import "./FirstUploads.scss"
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { NEW_CONTENT_URL } from '../utils/config'
import CardSkeleton from '../components/Cards/CardSkeleton'
import Card3 from "../components/Cards/Card3";
import { useContentBatch } from "../hooks/useContentBatch";
import { useWatchHistory } from "../hooks/useWatchHistory";
import useViewCounts from "../hooks/useViewCounts";

const VIDEOS_PER_PAGE = 50;

// Helper to deduplicate videos by author+permlink
const deduplicateVideos = (videos) => {
  const seen = new Set();
  return videos.filter(video => {
    const author = video.author?.username || video.author || video.owner;
    const key = `${author}-${video.permlink}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const NewVideos = () => {
  const [page, setPage] = useState(1);
  const [allVideos, setAllVideos] = useState([]);
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['new-content', page],
    queryFn: async () => {
      const res = await axios.get(`${NEW_CONTENT_URL}?page=${page}&limit=${VIDEOS_PER_PAGE}`);
      return res.data?.videos || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    onSuccess: (newVideos) => {
      if (page === 1) {
        setAllVideos(deduplicateVideos(newVideos));
      } else {
        setAllVideos(prev => {
          const existingKeys = new Set(prev.map(v => {
            const author = v.author?.username || v.author || v.owner;
            return `${author}-${v.permlink}`;
          }));
          const uniqueNew = newVideos.filter(video => {
            const author = video.author?.username || video.author || video.owner;
            const key = `${author}-${video.permlink}`;
            return !existingKeys.has(key);
          });
          return [...prev, ...deduplicateVideos(uniqueNew)];
        });
      }
    }
  });

  // Filter out internal re-encoding account
  const videos = allVideos.filter(video => {
    const author = video.author?.username || video.author || video.owner;
    return author !== 'threespeak-fixer';
  });

  const handleLoadMore = () => {
    setPage(prev => prev + 1);
  };

  const hasMore = data?.length === VIDEOS_PER_PAGE;

  // Batch fetch content data
  const { getContentForVideo } = useContentBatch(videos);

  // Batch check watch history
  const { isWatched } = useWatchHistory(videos);

  // Batch fetch view counts
  const { getViewCount } = useViewCounts(videos);

  return (
    <div className='firstupload-container'>
      <div className='headers'>New VIDEOS</div>
      {isLoading && page === 1 ? (
        <CardSkeleton />
      ) : (
        <>
          <Card3 videos={videos} loading={false} getContentForVideo={getContentForVideo} isWatched={isWatched} getViewCount={getViewCount} />
          {hasMore && (
            <button 
              className="load-more-btn" 
              onClick={handleLoadMore}
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : 'Load More'}
            </button>
          )}
        </>
      )}
      {error && <p>Error fetching videos</p>}
    </div>
  );
};

export default NewVideos;
