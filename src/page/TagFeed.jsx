import { useEffect, useCallback } from 'react';
import CardSkeleton from '../components/Cards/CardSkeleton';
import { useLocation, useParams } from 'react-router-dom';
import axios from 'axios';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import Card3 from '../components/Cards/Card3';
import { TAG_FEED_URL } from '../utils/config';
import { useContentBatch } from '../hooks/useContentBatch';
import { useWatchHistory } from '../hooks/useWatchHistory';
import useViewCounts from '../hooks/useViewCounts';
import PullToRefresh from '../components/PullToRefresh/PullToRefresh';

function TagFeed() {
  const { tag } = useParams();
  const { state } = useLocation();
  const queryClient = useQueryClient();

  const fetchVideos = async ({ pageParam = 1 }) => {
    const LIMIT = 100;
    const url = `${TAG_FEED_URL}/videos/tag/${tag}?page=${pageParam}&limit=${LIMIT}`;
    const res = await axios.get(url);
    return res.data;
  };

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: loading,
    isError,
  } = useInfiniteQuery({
    queryKey: ['homeCommunityFeed', tag],
    queryFn: fetchVideos,
    getNextPageParam: (lastPage) => {
      if (!lastPage) return undefined;
      if (lastPage.page >= lastPage.totalPages) return undefined;
      return lastPage.page + 1;
    },
  });

  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 200 &&
        !isFetchingNextPage &&
        hasNextPage
      ) {
        fetchNextPage();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isFetchingNextPage, hasNextPage, fetchNextPage]);

  const videos = data?.pages.flatMap(page => page.videos) || [];
  const { getContentForVideo } = useContentBatch(videos);
  const { isWatched } = useWatchHistory(videos);
  const { getViewCount } = useViewCounts(videos);

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['homeCommunityFeed', tag] });
  }, [queryClient, tag]);

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="firstupload-container">
      {loading ? (
        <CardSkeleton />
      ) : (
        <Card3
          videos={videos}
          error={isError ? 'Failed to load videos' : ''}
          loading={isFetchingNextPage}
          getContentForVideo={getContentForVideo}
          isWatched={isWatched}
          getViewCount={getViewCount}
        />
      )}
    </div>
    </PullToRefresh>
  );
}

export default TagFeed;
