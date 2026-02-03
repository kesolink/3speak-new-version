import React, { useState, useRef, useCallback, useEffect } from 'react'
import "./FirstUploads.scss"
import { useQuery, useApolloClient } from '@apollo/client'
import { NEW_CONTENT } from '../graphql/queries'
import CardSkeleton from '../components/Cards/CardSkeleton'
import Card3 from "../components/Cards/Card3";
import { useNavigate } from 'react-router-dom';
import { useTVSidebarNavigation } from '../hooks/useTVSidebarNavigation';
import TVScrollIndicator from '../components/tv/TVScrollIndicator';

const VIDEOS_PER_PAGE = 50;

const NewVideos = () => {
  const navigate = useNavigate();
  const apolloClient = useApolloClient();
  const containerRef = useRef(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [skip, setSkip] = useState(0);
  const [allVideos, setAllVideos] = useState([]);

  const { data, loading, error, refetch } = useQuery(NEW_CONTENT, {
    variables: { limit: VIDEOS_PER_PAGE, skip },
    fetchPolicy: 'network-only', // Prevent cache from causing duplicate onCompleted calls
    onCompleted: (newData) => {
      const newItems = newData?.socialFeed?.items || [];
      
      // Helper to deduplicate items by author+permlink
      const deduplicateItems = (items) => {
        const seen = new Set();
        return items.filter(item => {
          const key = `${item.author?.username || item.author}-${item.permlink}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      };
      
      if (skip === 0) {
        // Deduplicate even the first batch (API returns duplicates)
        setAllVideos(deduplicateItems(newItems));
      } else {
        // Deduplicate against existing + new items
        setAllVideos(prev => {
          const existingKeys = new Set(prev.map(v => `${v.author?.username || v.author}-${v.permlink}`));
          const uniqueNew = newItems.filter(item => {
            const key = `${item.author?.username || item.author}-${item.permlink}`;
            return !existingKeys.has(key);
          });
          return [...prev, ...deduplicateItems(uniqueNew)];
        });
      }
    }
  });

  // Transform GraphQL response to match Card3 expected format
  const videos = allVideos.map(item => ({
    ...item,
    author: item.author?.username || item.author,
    duration: item.spkvideo?.duration,
    created_at: item.created_at,
  }));

  const handleLoadMore = () => {
    setSkip(prev => prev + VIDEOS_PER_PAGE);
  };

  const hasMore = data?.socialFeed?.items?.length === VIDEOS_PER_PAGE;

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
      // Reset to first page and clear existing videos
      setSkip(0);
      setAllVideos([]);
      await apolloClient.refetchQueries({ include: [NEW_CONTENT] });
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, apolloClient]);

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
    <div className='firstupload-container' ref={containerRef}>
      {/* TV Mode: Vertical scroll indicator */}
      <TVScrollIndicator />

      <div className='headers'>New VIDEOS</div>
      {isRefreshing && (
        <div className="tv-refresh-indicator">Refreshing...</div>
      )}
      {loading && skip === 0 ? (
        <CardSkeleton />
      ) : (
        <>
          <Card3 videos={videos} loading={false} />
          {hasMore && (
            <button
              className="load-more-btn"
              onClick={handleLoadMore}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Load More'}
            </button>
          )}
        </>
      )}
      {error && <p>Error fetching videos</p>}
    </div>
  );
};

export default NewVideos;
