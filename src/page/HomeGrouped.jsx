import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { Link } from "react-router-dom";
import "./HomeGrouped.scss";
import CardSkeleton from "../components/Cards/CardSkeleton";
import Card3 from "../components/Cards/Card3";
import { FEED_URL, TRENDING_SORTED_URL, FOLLOW_FEED_URL, NEW_CONTENT_URL, FIRST_UPLOADS_URL, appendNsfw } from "../utils/config";
import { useContentBatch } from "../hooks/useContentBatch";
import { useWatchHistory } from "../hooks/useWatchHistory";
import useViewCounts from "../hooks/useViewCounts";
import { useAppStore } from "../lib/store";
import ShortsStories from "../components/ShortsStories/ShortsStories";
import PullToRefresh from "../components/PullToRefresh/PullToRefresh";
import { TrendingIcon, NewContentIcon, FirstUploadIcon } from "../components/FeedIcons";

// Fetch functions for each feed
const fetchHome = async () => {
  const res = await axios.get(`${FEED_URL}/apiv2/feeds/home?page=0`);
  const data = res.data.trends || res.data;
  return Array.isArray(data) ? data : [];
};

const fetchFollowFeed = async (username) => {
  const res = await axios.get(appendNsfw(`${FOLLOW_FEED_URL}/${username}?page=1&limit=50`, useAppStore.getState().showNsfw));
  return res.data?.videos || [];
};

const fetchFirstUploads = async () => {
  const res = await axios.get(appendNsfw(`${FIRST_UPLOADS_URL}?page=1&limit=50`, useAppStore.getState().showNsfw));
  return res.data?.videos || [];
};

const fetchTrending = async () => {
  const res = await axios.get(appendNsfw(`${TRENDING_SORTED_URL}?page=1&limit=50`, useAppStore.getState().showNsfw));
  return res.data?.videos || [];
};

const fetchNewContent = async () => {
  const res = await axios.get(appendNsfw(`${NEW_CONTENT_URL}?page=1&limit=50`, useAppStore.getState().showNsfw));
  return res.data?.videos || [];
};

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

// Horizontal scrollable video row component
const VideoRow = ({ title, videos, linkTo, isLoading, getContentForVideo, isWatched, getViewCount }) => {
  const scrollContainerRef = useRef(null);
  const [showLeftBtn, setShowLeftBtn] = useState(false);
  const [showRightBtn, setShowRightBtn] = useState(true);

  const checkScrollButtons = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      
      // Show left button if scrolled away from start
      setShowLeftBtn(scrollLeft > 10);
      
      // Show right button if not at the end
      setShowRightBtn(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      // Check initial state
      checkScrollButtons();
      
      // Add scroll event listener
      scrollContainer.addEventListener('scroll', checkScrollButtons);
      
      // Cleanup
      return () => {
        scrollContainer.removeEventListener('scroll', checkScrollButtons);
      };
    }
  }, [videos, isLoading]);

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const scrollAmount = 600;
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const iconsByTitle = {
    "Home Feed": <TrendingIcon />,
    "Follow Feed": <TrendingIcon />,
    "New Content": <NewContentIcon />,
    "First Time Uploads": <FirstUploadIcon />,
    "Trending": <TrendingIcon />
  };

  return (
    <div className="video-row">
      <div className="row-header">
        <div className="wrap-title">
          {iconsByTitle[title]}
          <h2>{title}</h2>
        </div>
        {linkTo && (
          <Link to={linkTo} className="view-all">
            View All
          </Link>
        )}
      </div>

      <div className="scroll-wrapper">
        {showLeftBtn && (
          <button className="scroll-btn left" onClick={() => scroll("left")}>
            <FaChevronLeft />
          </button>
        )}

        <div className="video-scroll-container-horizontal" ref={scrollContainerRef}>
          {isLoading || videos.length === 0 ? (
            <div className="skeleton-horizontal-container">
              {Array.from({ length: 12 }).map((_, index) => (
                <div key={`skeleton-${index}`} className="skeleton-card-horizontal">
                  <div className="skeleton video-thumbnail-skeleton"></div>
                  <div className="skeleton line-skeleton title-skeleton"></div>
                  <div className="skeleton-profile-row">
                    <div className="skeleton profile-avatar-skeleton"></div>
                    <div className="skeleton profile-name-skeleton"></div>
                  </div>
                  <div className="skeleton-bottom-row">
                    <div className="skeleton bottom-skeleton"></div>
                    <div className="skeleton bottom-skeleton"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card-container-horizontal">
              <Card3 videos={videos.slice(0, 16)} loading={false} getContentForVideo={getContentForVideo} isWatched={isWatched} getViewCount={getViewCount} />
            </div>
          )}
        </div>

        {showRightBtn && (
          <button className="scroll-btn right" onClick={() => scroll("right")}>
            <FaChevronRight />
          </button>
        )}
      </div>
    </div>
  );
};

const HomeGrouped = () => {
  const { authenticated, user } = useAppStore();
  const queryClient = useQueryClient();

  const { data: homeData, isLoading: homeLoading } = useQuery({
    queryKey: authenticated ? ["follow-feed", user] : ["home-grouped"],
    queryFn: authenticated ? () => fetchFollowFeed(user) : fetchHome,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: firstUploadsData, isLoading: firstUploadsLoading } = useQuery({
    queryKey: ["firstuploads-grouped"],
    queryFn: fetchFirstUploads,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: trendingData, isLoading: trendingLoading } = useQuery({
    queryKey: ["trending-grouped"],
    queryFn: fetchTrending,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: newContentData, isLoading: newContentLoading } = useQuery({
    queryKey: ["newcontent-grouped"],
    queryFn: fetchNewContent,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Combine all videos for batch content loading
  const allVideos = useMemo(() => [
    ...(homeData || []).slice(0, 16),
    ...deduplicateVideos(newContentData || []).slice(0, 16),
    ...(trendingData || []).slice(0, 16),
    ...(firstUploadsData || []).slice(0, 16),
  ], [homeData, newContentData, trendingData, firstUploadsData]);

  const { getContentForVideo } = useContentBatch(allVideos);

  // Batch check watch history for all videos
  const { isWatched } = useWatchHistory(allVideos);

  // Batch fetch view counts
  const { getViewCount } = useViewCounts(allVideos);

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: authenticated ? ["follow-feed", user] : ["home-grouped"] });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["firstuploads-grouped"] }),
      queryClient.invalidateQueries({ queryKey: ["trending-grouped"] }),
      queryClient.invalidateQueries({ queryKey: ["newcontent-grouped"] }),
    ]);
  }, [queryClient, authenticated, user]);

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="home-grouped-container">
      <ShortsStories />

      <VideoRow
        title={authenticated ? "Follow Feed" : "Home Feed"}
        videos={homeData || []}
        linkTo={authenticated ? "/follow-feed" : "/home-feed"}
        isLoading={homeLoading}
        getContentForVideo={getContentForVideo}
        isWatched={isWatched}
        getViewCount={getViewCount}
      />

      <VideoRow
        title="New Content"
        videos={deduplicateVideos(newContentData || [])}
        linkTo="/new"
        isLoading={newContentLoading}
        getContentForVideo={getContentForVideo}
        isWatched={isWatched}
        getViewCount={getViewCount}
      />

      <VideoRow
        title="Trending"
        videos={trendingData || []}
        linkTo="/trend"
        isLoading={trendingLoading}
        getContentForVideo={getContentForVideo}
        isWatched={isWatched}
        getViewCount={getViewCount}
      />

      <VideoRow
        title="First Time Uploads"
        videos={firstUploadsData || []}
        linkTo="/firstupload"
        isLoading={firstUploadsLoading}
        getContentForVideo={getContentForVideo}
        isWatched={isWatched}
        getViewCount={getViewCount}
      />
    </div>
    </PullToRefresh>
  );
};

export default HomeGrouped;