import "./Discover.scss";
import CardSkeleton from "../components/Cards/CardSkeleton";
import { useEffect, useRef, useState, useCallback } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import Card3 from "../components/Cards/Card3";
import { TRENDING_SORTED_URL } from '../utils/config';
import { useContentBatch } from "../hooks/useContentBatch";
import { useWatchHistory } from "../hooks/useWatchHistory";
import useViewCounts from "../hooks/useViewCounts";
import SearchList from "../components/nav/SearchList";
import PullToRefresh from "../components/PullToRefresh/PullToRefresh";

const LIMIT = 50;

const fetchVideos = async ({ pageParam = 1 }) => {
  const res = await axios.get(`${TRENDING_SORTED_URL}?page=${pageParam}&limit=${LIMIT}`);
  return res.data;
};

const Discover = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchBoxRef = useRef(null);
  const queryClient = useQueryClient();

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

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["trending"] });
  }, [queryClient]);

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="discover-container">
      <div className="discover-search-wrapper" ref={searchBoxRef}>
        <svg xmlns="http://www.w3.org/2000/svg" className="discover-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7"></circle>
          <path d="m16 16 4 4"></path>
        </svg>
        <input
          onFocus={() => setIsDropdownOpen(true)}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value.toLowerCase())}
          type="search"
          placeholder="Search users or communities..."
          className="discover-search-input"
        />
      </div>
      <div className="discover-search-results-anchor">
        <SearchList
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          searchBoxRef={searchBoxRef}
          isDropdownOpen={isDropdownOpen}
          setIsDropdownOpen={setIsDropdownOpen}
        />
      </div>

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
    </PullToRefresh>
  );
};

export default Discover;
