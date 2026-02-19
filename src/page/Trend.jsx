import "./FirstUploads.scss";
import CardSkeleton from "../components/Cards/CardSkeleton";
import { useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import axios from "axios";
import Card3 from "../components/Cards/Card3";
import { TRENDING_SORTED_URL } from '../utils/config';
import { useContentBatch } from "../hooks/useContentBatch";
import { useWatchHistory } from "../hooks/useWatchHistory";
import useViewCounts from "../hooks/useViewCounts";

const LIMIT = 50;

const fetchVideos = async ({ pageParam = 1 }) => {
  const res = await axios.get(`${TRENDING_SORTED_URL}?page=${pageParam}&limit=${LIMIT}`);
  return res.data;
};

const Trend = () => {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ["trending"],
    queryFn: fetchVideos,
    getNextPageParam: (lastPage) => {
      if (!lastPage || lastPage.page >= lastPage.totalPages) return undefined;
      return lastPage.page + 1;
    },
  });

  // Infinite scroll effect
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >=
          document.body.offsetHeight - 200 &&
        !isFetchingNextPage &&
        hasNextPage
      ) {
        fetchNextPage();
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isFetchingNextPage, hasNextPage, fetchNextPage]);

  // Flatten all pages into one list
  const videos = data?.pages.flatMap(page => page.videos || []) || [];

  // Batch fetch content data
  const { getContentForVideo } = useContentBatch(videos);

  // Batch check watch history
  const { isWatched } = useWatchHistory(videos);

  // Batch fetch view counts
  const { getViewCount } = useViewCounts(videos);

  return (
    <div className="firstupload-container">
      <div className="headers">TRENDING</div>

      {isLoading ? (
        <CardSkeleton />
      ) : (
        <Card3 videos={videos} loading={isFetchingNextPage} getContentForVideo={getContentForVideo} isWatched={isWatched} getViewCount={getViewCount} />
      )}

      {isError && <p>Error fetching videos</p>}

      {isFetchingNextPage && (
        <p style={{ textAlign: "center" }}>Loading more...</p>
      )}
    </div>
  );
};

export default Trend;
