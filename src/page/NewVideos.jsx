import React from 'react'
import "./FirstUploads.scss"
import { useInfiniteQuery } from '@tanstack/react-query'
import axios from 'axios'
import CardSkeleton from '../components/Cards/CardSkeleton'
import Card3 from "../components/Cards/Card3";

const fetchVideos = async ({ pageParam = 1 }) => {
  const res = await axios.get(`https://legacy.3speak.tv/apiv2/feeds/new?page=${pageParam}`);
  return res.data;
};

const NewVideos = () => {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ["new-content"],
    queryFn: fetchVideos,
    getNextPageParam: (lastPage, allPages) => {
      // If the last page has items, continue pagination
      if (lastPage && lastPage.length > 0) {
        return allPages.length + 1; // next page number
      }
      return undefined; // stop if no more data
    },
    initialPageParam: 1,
  });

  // Flatten all pages into a single array
  const videos = data?.pages.flat() || [];

  return (
    <div className='firstupload-container'>
      <div className='headers'>New VIDEOS</div>
      {isLoading ? (
        <CardSkeleton />
      ) : (
        <>
          <Card3 videos={videos} loading={isFetchingNextPage} />
          {hasNextPage && (
            <button 
              className="load-more-btn" 
              onClick={fetchNextPage}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? 'Loading...' : 'Load More'}
            </button>
          )}
        </>
      )}
      {isError && <p>Error fetching videos</p>}
    </div>
  );
};

export default NewVideos;
