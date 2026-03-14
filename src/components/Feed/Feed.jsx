
import "./Feed.scss"
import CommunitiesTags from "../communities-tags/CommunitiesTags"
import { useEffect, useState } from "react"
import { has3SpeakPostAuth } from '../../utils/hiveUtils';
import { useAppStore } from '../../lib/store';
import CardSkeleton from "../Cards/CardSkeleton"
import axios from "axios"
import { FEED_URL, FOLLOW_FEED_URL, appendNsfw } from '../../utils/config'
import { useInfiniteQuery } from "@tanstack/react-query"
import Card3 from "../Cards/Card3"
import { useContentBatch } from "../../hooks/useContentBatch"
import { useWatchHistory } from "../../hooks/useWatchHistory"
import useViewCounts from "../../hooks/useViewCounts"



const FOLLOW_LIMIT = 50;

const fetchFollowFeedVideos = async ({ pageParam = 1 }, username) => {
  const url = appendNsfw(`${FOLLOW_FEED_URL}/${username}?page=${pageParam}&limit=${FOLLOW_LIMIT}`, useAppStore.getState().showNsfw);
  const res = await axios.get(url);
  return res.data;
};

const fetchHomeVideos = async ({ pageParam = 0 }) => {
  let url;

  if (pageParam === 0) {
    url = `${FEED_URL}/apiv2/feeds/home?page=${pageParam}`;
  } else {
    url = `${FEED_URL}/api/feed/more?skip=${pageParam}`;
  }

  const res = await axios.get(url);
  return res.data.trends || res.data;
};

function Feed() {
  const [isOpen, setIsOpen] = useState(false)
  const {authenticated, user} = useAppStore();

  useEffect(()=>{
    checkPostAuth(user);
  },[])

   const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  isLoading,
  isError,
} = useInfiniteQuery({
  queryKey: authenticated ? ["follow-feed", user] : ["home"],
  queryFn: authenticated
    ? (ctx) => fetchFollowFeedVideos(ctx, user)
    : fetchHomeVideos,
  getNextPageParam: authenticated
    ? (lastPage) => {
        if (!lastPage || lastPage.page >= lastPage.totalPages) return undefined;
        return lastPage.page + 1;
      }
    : (lastPage, allPages) => {
        const nextSkips = [64, 128];
        const next = nextSkips[allPages.length - 1];
        return next || undefined;
      },
  initialPageParam: authenticated ? 1 : 0,
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
  
    // Flatten all pages into a single array
    const videos = authenticated
      ? data?.pages.flatMap(page => page.videos || []) || []
      : data?.pages.flat() || [];

    // Batch fetch content data (payout, voters) for all videos
    const { getContentForVideo } = useContentBatch(videos);

    // Batch check watch history for all videos
    const { isWatched } = useWatchHistory(videos);

    // Batch fetch view counts
    const { getViewCount } = useViewCounts(videos);

    async function checkPostAuth(username) {
      if(!authenticated){
        return
      }
      const hasAuth = await has3SpeakPostAuth(username);
      if (!hasAuth) {
        setIsOpen(true);
      }
    }

  return (
    <>
    <>
    <CommunitiesTags />

    {isLoading ? <CardSkeleton /> :  <Card3 videos={videos} loading={isFetchingNextPage} getContentForVideo={getContentForVideo} isWatched={isWatched} getViewCount={getViewCount} />}
    {isError && <p>Error fetching videos</p>}
      {isFetchingNextPage && (
        <p style={{ textAlign: "center" }}>Loading more...</p>
      )}
    </>
    {/* {isOpen && <Auth_modal  isOpen={isOpen} close={toggleUploadModal} />} */}
    </>
  );
}

export default Feed