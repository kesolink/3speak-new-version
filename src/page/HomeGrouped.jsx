import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { Link } from "react-router-dom";
import "./HomeGrouped.scss";
import CardSkeleton from "../components/Cards/CardSkeleton";
import Card3 from "../components/Cards/Card3";
import { FEED_URL, TRENDING_SORTED_URL, FOLLOW_FEED_URL, NEW_CONTENT_URL, CHECKER_URL, appendNsfw } from "../utils/config";
import { useContentBatch } from "../hooks/useContentBatch";
import { useWatchHistory } from "../hooks/useWatchHistory";
import useViewCounts from "../hooks/useViewCounts";
import { useAppStore } from "../lib/store";
import ShortsStories from "../components/ShortsStories/ShortsStories";
import OpenPodsLiveStrip from "../components/OpenPod/OpenPodsLiveStrip";
import PullToRefresh from "../components/PullToRefresh/PullToRefresh";
import { TrendingIcon, NewContentIcon } from "../components/FeedIcons";
import { Rocket } from "lucide-react";

// Extra feed params for the logged-in user: interests (checker weights the feed
// toward them) and, when "Hide watched" is on, currentuser (checker skips seen
// videos server-side). Empty string when neither applies.
const feedParams = () => {
  const st = useAppStore.getState();
  let p = '';
  const list = st.interests;
  if (Array.isArray(list) && list.length) p += `&interests=${encodeURIComponent(list.join(','))}`;
  if (st.hideWatched && st.user) p += `&currentuser=${encodeURIComponent(st.user)}`;
  return p;
};

// Fetch functions for each feed
const fetchHome = async () => {
  // Use the checker's trendingSorted feed for the "home" group — the older
  // /apiv2/feeds/home path on legacy is gone now that FEED_URL points at the
  // checker. trendingSorted is the broadest curated set the checker exposes
  // (more videos than /feeds/trending).
  const res = await axios.get(`${TRENDING_SORTED_URL}?page=1&limit=50${feedParams()}`);
  return res.data.videos || res.data.trends || [];
};

const fetchFollowFeed = async (username) => {
  const res = await axios.get(appendNsfw(`${FOLLOW_FEED_URL}/${username}?page=1&limit=50${feedParams()}`, useAppStore.getState().showNsfw));
  return res.data?.videos || [];
};

const fetchTrending = async () => {
  const res = await axios.get(appendNsfw(`${TRENDING_SORTED_URL}?page=1&limit=50${feedParams()}`, useAppStore.getState().showNsfw));
  return res.data?.videos || [];
};

const fetchPromoted = async () => {
  const res = await axios.get(appendNsfw(`${CHECKER_URL}/feeds/promoted?limit=20`, useAppStore.getState().showNsfw));
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
const VideoRow = ({ title, videos, linkTo, isLoading, getContentForVideo, isWatched, getViewCount, priority = false }) => {
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
    "Trending": <TrendingIcon />,
    "Promoted": <Rocket size={18} />
  };

  // Hide the section entirely once it has finished loading with no videos,
  // instead of showing perpetual skeletons (e.g. an empty follow feed).
  if (!isLoading && videos.length === 0) return null;

  // Adaptive row count: fill up to 3 rows, but collapse to 1–2 rows when there
  // are only enough videos to fill them so sparse sections don't render
  // half-empty 3-row grids. ~6 videos comfortably fill one row.
  const ROW_FILL_TARGET = 6;
  const rowCount = Math.min(3, Math.max(1, Math.ceil(videos.length / ROW_FILL_TARGET)));

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

      <div className={`scroll-wrapper${showLeftBtn ? ' has-left-fade' : ''}${showRightBtn ? ' has-right-fade' : ''}`}>
        {showLeftBtn && (
          <button className="scroll-btn left" onClick={() => scroll("left")}>
            <FaChevronLeft />
          </button>
        )}

        <div className="video-scroll-container-horizontal" ref={scrollContainerRef}>
          {isLoading ? (
            <div className="skeleton-horizontal-container">
              {Array.from({ length: 18 }).map((_, index) => (
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
            <div className="card-container-horizontal" style={{ "--vr-rows": rowCount }}>
              <Card3 videos={videos.slice(0, 36)} loading={false} getContentForVideo={getContentForVideo} isWatched={isWatched} getViewCount={getViewCount} priority={priority} />
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
  const { authenticated, user, showNsfw, homeCardSize, hideWatched } = useAppStore();
  const queryClient = useQueryClient();

  // On mobile/tablet the stacked section rows become tabs (one section at a time).
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.matchMedia('(max-width: 1024px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1024px)');
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const [activeTab, setActiveTab] = useState(0);

  const { data: homeData, isLoading: homeLoading } = useQuery({
    queryKey: authenticated ? ["follow-feed", user, showNsfw, hideWatched] : ["home-grouped", showNsfw, hideWatched, user],
    queryFn: authenticated ? () => fetchFollowFeed(user) : fetchHome,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Trending row is only shown for logged-in users; skip the fetch entirely
  // when anonymous so we don't pay the request cost.
  const { data: trendingData, isLoading: trendingLoading } = useQuery({
    queryKey: ["trending-grouped", showNsfw, hideWatched, user],
    queryFn: fetchTrending,
    enabled: authenticated,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: newContentData, isLoading: newContentLoading } = useQuery({
    queryKey: ["newcontent-grouped", showNsfw],
    queryFn: fetchNewContent,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Promoted videos. Logged-in viewers get a dedicated "Promoted" row; logged-out
  // viewers see them mixed into the top of the Home Feed (no badge either way).
  const { data: promotedData, isLoading: promotedLoading } = useQuery({
    queryKey: ["promoted-grouped", showNsfw],
    queryFn: fetchPromoted,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // For logged-out viewers, prepend promoted videos into the Home Feed (deduped).
  const homeFeedVideos = useMemo(() => {
    if (authenticated) return homeData || [];
    return deduplicateVideos([...(promotedData || []), ...(homeData || [])]);
  }, [authenticated, homeData, promotedData]);

  // Combine all videos for batch content loading
  const allVideos = useMemo(() => [
    ...(homeData || []).slice(0, 16),
    ...deduplicateVideos(newContentData || []).slice(0, 16),
    ...(trendingData || []).slice(0, 16),
  ], [homeData, newContentData, trendingData]);

  const { getContentForVideo } = useContentBatch(allVideos);

  // Batch check watch history for all videos
  const { isWatched } = useWatchHistory(allVideos);

  // Batch fetch view counts
  const { getViewCount } = useViewCounts(allVideos);

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: authenticated ? ["follow-feed", user] : ["home-grouped"] });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["trending-grouped"] }),
      queryClient.invalidateQueries({ queryKey: ["newcontent-grouped"] }),
    ]);
  }, [queryClient, authenticated, user]);

  // Section descriptors — shared by the desktop stack and the mobile tabs.
  const renderRow = (s) => (
    <VideoRow
      key={s.key}
      title={s.title}
      videos={s.videos}
      linkTo={s.linkTo}
      isLoading={s.isLoading}
      getContentForVideo={getContentForVideo}
      isWatched={isWatched}
      getViewCount={getViewCount}
      priority={s.priority}
    />
  );

  const promotedSection = (authenticated && promotedData?.length > 0)
    ? { key: 'promoted', title: 'Promoted', videos: promotedData, isLoading: false, priority: true }
    : null;
  const contentSections = [
    { key: 'home', title: authenticated ? 'Follow Feed' : 'Home Feed', videos: homeFeedVideos, linkTo: authenticated ? '/follow-feed' : '/home-feed', isLoading: homeLoading, priority: true },
    { key: 'new', title: 'New Content', videos: deduplicateVideos(newContentData || []), linkTo: '/new', isLoading: newContentLoading },
  ];
  if (authenticated) {
    contentSections.push({ key: 'trending', title: 'Trending', videos: trendingData || [], linkTo: '/trend', isLoading: trendingLoading });
  }
  const tabSections = promotedSection ? [promotedSection, ...contentSections] : contentSections;
  const safeTab = Math.min(Math.max(activeTab, 0), tabSections.length - 1);

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="home-grouped-container" data-card-size={homeCardSize || 'large'}>
      <ShortsStories />
      <OpenPodsLiveStrip />

      {isMobile ? (
        <>
          <div className="home-tabs" role="tablist">
            {tabSections.map((s, i) => (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={safeTab === i}
                className={`home-tab${safeTab === i ? ' active' : ''}`}
                onClick={() => setActiveTab(i)}
              >
                {s.title}
              </button>
            ))}
          </div>
          {tabSections[safeTab] && renderRow(tabSections[safeTab])}
        </>
      ) : (
        <>
          {promotedSection && renderRow(promotedSection)}
          {contentSections.map(renderRow)}
        </>
      )}
    </div>
    </PullToRefresh>
  );
};

export default HomeGrouped;