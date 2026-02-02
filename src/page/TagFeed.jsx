import { useEffect, useState, useRef, useCallback } from 'react';
import CardSkeleton from '../components/Cards/CardSkeleton';
import { useQuery } from '@apollo/client';
import { GET_TRENDING_TAGS } from '../graphql/queries';
import Cards from '../components/Cards/Cards';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import Card3 from '../components/Cards/Card3';
import { TAG_FEED_URL } from '../utils/config';
import { useTVSidebarNavigation } from '../hooks/useTVSidebarNavigation';
// import './App.css';

function TagFeed() {
  const { tag } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { state } = useLocation();
  const containerRef = useRef(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
    refetch,
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
  console.log(videos);

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
      await queryClient.invalidateQueries({ queryKey: ['homeCommunityFeed'] });
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
    if (isTVMode && videos.length > 0 && !loading) {
      setTimeout(() => focusCard(0), 100);
    }
  }, [isTVMode, videos.length, loading, focusCard]);

  return (
    <div className="firstupload-container" ref={containerRef}>
      {/* <div className='headers'>{state.commuintyName}</div> */}
      {isRefreshing && (
        <div className="tv-refresh-indicator">Refreshing...</div>
      )}
      {loading ? (
        <CardSkeleton />
      ) : (
        <Card3
          videos={videos}
          error={isError ? 'Failed to load videos' : ''}
          loading={isFetchingNextPage}
          className="custom-video-feed"
        />
      )}
    </div>
  );
}

export default TagFeed;
