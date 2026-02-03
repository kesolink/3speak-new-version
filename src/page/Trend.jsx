import "./FirstUploads.scss";
import CardSkeleton from "../components/Cards/CardSkeleton";
import { useEffect, useState, useRef, useCallback } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import Card3 from "../components/Cards/Card3";
import { FEED_URL } from '../utils/config';
import { useNavigate } from 'react-router-dom';
import { useTVSidebarNavigation } from '../hooks/useTVSidebarNavigation';
import TVScrollIndicator from '../components/tv/TVScrollIndicator';

const LIMIT = 500;

const fetchVideos = async ({ pageParam = 0 }) => {
  let url;

  // On first load, use /feeds/trending
  if (pageParam === 0) {
    url = `${FEED_URL}/apiv2/feeds/trending?limit=${LIMIT}`;
  } 
  // On later loads, use /feeds/trending/more with skip
  else {
    url = `${FEED_URL}/apiv2/feeds/trending/more?skip=${pageParam}`;
  }

  const res = await axios.get(url);
  // Notice: trending returns an array, while /more returns { trends: [...] }
  return res.data.trends || res.data;
};

const Trend = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const containerRef = useRef(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["trending"],
    queryFn: fetchVideos,
    getNextPageParam: (lastPage, allPages) => {
      // If lastPage returned data, calculate new skip
      const currentTotal = allPages.flat().length;
      if (lastPage && lastPage.length > 0) return currentTotal;
      return undefined; // Stop when no more data
    },
  });

  console.log(data)

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
  const videos = data?.pages.flat() || [];
  console.log(videos)

  // TV Navigation - calculate grid dimensions
  const getGridInfo = useCallback(() => {
    if (!containerRef.current) return { columns: 4, totalCards: 0 };
    const cards = containerRef.current.querySelectorAll('[data-tv-focusable="true"]');
    const totalCards = cards.length;
    // Estimate columns based on container width (cards are ~280px wide)
    const containerWidth = containerRef.current.offsetWidth;
    const columns = Math.max(1, Math.floor(containerWidth / 300));
    return { columns, totalCards };
  }, []);

  // Focus a card by index
  const focusCard = useCallback((index) => {
    if (!containerRef.current) return;
    const cards = containerRef.current.querySelectorAll('[data-tv-focusable="true"]');
    if (cards.length === 0) return;

    const clampedIndex = Math.max(0, Math.min(index, cards.length - 1));

    // Remove focus from all cards
    cards.forEach(card => card.classList.remove('tv-focused'));

    // Add focus to target card
    const targetCard = cards[clampedIndex];
    if (targetCard) {
      targetCard.classList.add('tv-focused');
      targetCard.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      setFocusedIndex(clampedIndex);
    }
  }, []);

  // Handle refresh when pressing up in first row
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['trending'] });
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, queryClient, refetch]);

  // Handle navigation
  const handleNavigate = useCallback((direction) => {
    const { columns, totalCards } = getGridInfo();
    if (totalCards === 0) return false;

    let newIndex = focusedIndex;

    switch (direction) {
      case 'left':
        if (focusedIndex % columns === 0) {
          return false; // At left edge, let sidebar open
        }
        newIndex = focusedIndex - 1;
        break;
      case 'right':
        if ((focusedIndex + 1) % columns === 0 || focusedIndex >= totalCards - 1) {
          return true; // At right edge, but handled
        }
        newIndex = focusedIndex + 1;
        break;
      case 'up':
        if (focusedIndex < columns) {
          // At top row, trigger refresh
          handleRefresh();
          return true;
        }
        newIndex = focusedIndex - columns;
        break;
      case 'down':
        if (focusedIndex + columns >= totalCards) {
          return true; // At bottom edge
        }
        newIndex = focusedIndex + columns;
        break;
      default:
        return false;
    }

    if (newIndex >= 0 && newIndex < totalCards) {
      focusCard(newIndex);
      return true;
    }
    return false;
  }, [focusedIndex, getGridInfo, focusCard, handleRefresh]);

  // Handle selection (Enter key)
  const handleSelect = useCallback(() => {
    if (!containerRef.current) return;
    const cards = containerRef.current.querySelectorAll('[data-tv-focusable="true"]');
    if (cards[focusedIndex]) {
      const href = cards[focusedIndex].getAttribute('href');
      if (href) {
        navigate(href);
      }
    }
  }, [focusedIndex, navigate]);

  // Use TV sidebar navigation hook
  const { isTVMode, tvSidebarVisible, closeSidebar } = useTVSidebarNavigation({
    onNavigate: handleNavigate,
    onSelect: handleSelect,
    onLeftAtEdge: () => handleNavigate('left')
  });

  // Handle TV back button - navigate back to previous page
  useEffect(() => {
    if (!isTVMode) return;

    const handleBackButton = (event) => {
      if (tvSidebarVisible) {
        closeSidebar();
        event.preventDefault();
        return;
      }

      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/');
      }
      event.preventDefault();
    };

    document.addEventListener('tv-back-button', handleBackButton);
    return () => document.removeEventListener('tv-back-button', handleBackButton);
  }, [isTVMode, tvSidebarVisible, closeSidebar, navigate]);

  // Focus first card when data loads in TV mode
  useEffect(() => {
    if (isTVMode && videos.length > 0 && !isLoading) {
      setTimeout(() => focusCard(0), 100);
    }
  }, [isTVMode, videos.length, isLoading, focusCard]);

  return (
    <div className="firstupload-container" ref={containerRef}>
      {/* TV Mode: Vertical scroll indicator */}
      <TVScrollIndicator />

      <div className="headers">TRENDING</div>
      {isRefreshing && (
        <div className="tv-refresh-indicator">Refreshing...</div>
      )}

      {isLoading ? (
        <CardSkeleton />
      ) : (
        <Card3 videos={videos} loading={isFetchingNextPage} />
      )}

      {isError && <p>Error fetching videos</p>}

      {isFetchingNextPage && (
        <p style={{ textAlign: "center" }}>Loading more...</p>
      )}
    </div>
  );
};

export default Trend;
