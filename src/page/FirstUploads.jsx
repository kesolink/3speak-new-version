import { useCallback } from 'react'
import "./FirstUploads.scss"
import CardSkeleton from "../components/Cards/CardSkeleton";
import axios from 'axios'
import Card3 from '../components/Cards/Card3';
import { FEED_URL } from '../utils/config';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useContentBatch } from '../hooks/useContentBatch';
import { useWatchHistory } from '../hooks/useWatchHistory';
import useViewCounts from '../hooks/useViewCounts';
import PullToRefresh from '../components/PullToRefresh/PullToRefresh';
import { FirstUploadIcon } from '../components/FeedIcons';

const fetchVideos = async ({ pageParam = 1 }) => {
  const res = await axios.get(
    `${FEED_URL}/apiv2/feeds/firstUploads?page=${pageParam}`
  );
  return res.data;
};

const FirstUploads = () => {
  const queryClient = useQueryClient();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ["firstupload"],
    queryFn: fetchVideos,
    getNextPageParam: (lastPage, allPages) => {
    if (lastPage.length > 0) {
      return allPages.flat().length;
    }
    return undefined;
    },
  });

    const videos = data?.pages.flat() || [];
    const { getContentForVideo } = useContentBatch(videos);
    const { isWatched } = useWatchHistory(videos);
    const { getViewCount } = useViewCounts(videos);

    const handleRefresh = useCallback(async () => {
      await queryClient.invalidateQueries({ queryKey: ["firstupload"] });
    }, [queryClient]);

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className='firstupload-container'>
        <div className='feed-page-header'>
          <FirstUploadIcon />
          <h2>First Time Uploads</h2>
        </div>
        {isLoading ? <CardSkeleton /> :  <Card3 videos={videos} loading={isFetchingNextPage} getContentForVideo={getContentForVideo} isWatched={isWatched} getViewCount={getViewCount} />}
    {isError && <p>Error fetching videos</p>}
      {isFetchingNextPage && (
        <p style={{ textAlign: "center" }}>Loading more...</p>
      )}
    </div>
    </PullToRefresh>
  )
}

export default FirstUploads