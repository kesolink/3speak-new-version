import React, { useState } from 'react'
import "./FirstUploads.scss"
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import CardSkeleton from '../components/Cards/CardSkeleton'
import Card3 from "../components/Cards/Card3";

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
      const res = await axios.get(`https://legacy.3speak.tv/apiv2/feeds/new?page=${page}&limit=${VIDEOS_PER_PAGE}`);
      return res.data || [];
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

  return (
    <div className='firstupload-container'>
      <div className='headers'>New VIDEOS</div>
      {isLoading && page === 1 ? (
        <CardSkeleton />
      ) : (
        <>
          <Card3 videos={videos} loading={false} />
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
