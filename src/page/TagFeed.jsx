import { useEffect } from 'react';
import CardSkeleton from '../components/Cards/CardSkeleton';
import { useLocation, useParams } from 'react-router-dom';
import axios from 'axios';
import { useInfiniteQuery } from '@tanstack/react-query';
import Card3 from '../components/Cards/Card3';
import { TAG_FEED_URL } from '../utils/config';
import { useContentBatch } from '../hooks/useContentBatch';
import { useWatchHistory } from '../hooks/useWatchHistory';

function TagFeed() {
  const { tag } = useParams(); 
  const { state } = useLocation();

  // ---------------------------
  // FETCH COMMUNITY VIDEOS
  // ---------------------------
  const fetchVideos = async ({ pageParam = 1 }) => {
    const LIMIT = 100;
    const trend = false;
    let url;

    if (trend) {
      // 🔥 Trending feed
      url = `${TAG_FEED_URL}/videos/tag/${tag}?page=${pageParam}&limit=${LIMIT}`;
    } else {
      // 🆕 New feed
      url = `${TAG_FEED_URL}/videos/tag/${tag}?page=${pageParam}&limit=${LIMIT}`;
    }

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

  // Infinite scroll
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

  // Batch fetch content data
  const { getContentForVideo } = useContentBatch(videos);

  // Batch check watch history
  const { isWatched } = useWatchHistory(videos);

  return (
    <div className="firstupload-container">
      {/* <div className='headers'>{state.commuintyName}</div> */}

      {loading ? (
        <CardSkeleton />
      ) : (
        <Card3
          videos={videos}
          error={isError ? 'Failed to load videos' : ''}
          loading={isFetchingNextPage}
          getContentForVideo={getContentForVideo}
          isWatched={isWatched}
        />
      )}
    </div>
  );
}

export default TagFeed;
