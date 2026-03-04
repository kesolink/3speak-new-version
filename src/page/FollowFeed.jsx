import "./FirstUploads.scss";
import CardSkeleton from "../components/Cards/CardSkeleton";
import { useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import axios from "axios";
import Card3 from "../components/Cards/Card3";
import { FOLLOW_FEED_URL } from "../utils/config";
import { useContentBatch } from "../hooks/useContentBatch";
import { useWatchHistory } from "../hooks/useWatchHistory";
import useViewCounts from "../hooks/useViewCounts";
import { useAppStore } from "../lib/store";

const LIMIT = 50;

const fetchVideos = async ({ pageParam = 1 }, username) => {
  const res = await axios.get(`${FOLLOW_FEED_URL}/${username}?page=${pageParam}&limit=${LIMIT}`);
  return res.data;
};

const FollowFeed = () => {
  const { user } = useAppStore();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ["follow-feed-page", user],
    queryFn: (ctx) => fetchVideos(ctx, user),
    getNextPageParam: (lastPage) => {
      if (!lastPage || lastPage.page >= lastPage.totalPages) return undefined;
      return lastPage.page + 1;
    },
    initialPageParam: 1,
    enabled: !!user,
  });

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

  const videos = data?.pages.flatMap(page => page.videos || []) || [];

  const { getContentForVideo } = useContentBatch(videos);
  const { isWatched } = useWatchHistory(videos);
  const { getViewCount } = useViewCounts(videos);

  return (
    <div className="firstupload-container">
      <div className="headers">Follow Feed</div>

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

export default FollowFeed;
