import { useRef, useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useQuery as useApolloQuery } from "@apollo/client";
import axios from "axios";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import "./HomeGrouped.scss";
import { NEW_CONTENT } from "../graphql/queries";
import CardSkeleton from "../components/Cards/CardSkeleton";
import Card3 from "../components/Cards/Card3";
import { FEED_URL } from "../utils/config";
import { useTVMode } from "../context/TVModeContext";

// Fetch functions for each feed
const fetchHome = async () => {
  const res = await axios.get(`${FEED_URL}/apiv2/feeds/home?page=0`);
  const data = res.data.trends || res.data;
  return Array.isArray(data) ? data : [];
};

const fetchFirstUploads = async () => {
  const res = await axios.get(`${FEED_URL}/apiv2/feeds/firstUploads?page=1`);
  return Array.isArray(res.data) ? res.data : [];
};

const fetchTrending = async () => {
  const res = await axios.get(`${FEED_URL}/apiv2/feeds/trending?limit=50`);
  return Array.isArray(res.data) ? res.data : [];
};

// Horizontal scrollable video row component
const VideoRow = ({ title, videos, linkTo, isLoading, rowIndex, isActiveRow, onCardSelect }) => {
  const scrollContainerRef = useRef(null);
  const [showLeftBtn, setShowLeftBtn] = useState(false);
  const [showRightBtn, setShowRightBtn] = useState(true);
  const [focusedCardIndex, setFocusedCardIndex] = useState(0);
  const { isTVMode } = useTVMode();

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

  // TV Navigation: Focus card by index within this row
  const focusCard = useCallback((index) => {
    if (!scrollContainerRef.current) return;
    const cards = scrollContainerRef.current.querySelectorAll('[data-tv-focusable="true"]');
    if (cards.length === 0) return;

    const clampedIndex = Math.max(0, Math.min(index, cards.length - 1));

    // Remove focus from all cards in this row
    cards.forEach(card => card.classList.remove('tv-focused'));

    // Add focus to target card
    const targetCard = cards[clampedIndex];
    if (targetCard) {
      targetCard.classList.add('tv-focused');
      setFocusedCardIndex(clampedIndex);

      // For first row in TV mode: scroll card into view horizontally only, then scroll page up
      if (rowIndex === 0 && isTVMode) {
        // First ensure the card is horizontally centered in the scroll container
        const container = scrollContainerRef.current;
        const cardRect = targetCard.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const scrollLeft = container.scrollLeft + (cardRect.left - containerRect.left) - (containerRect.width / 2) + (cardRect.width / 2);
        container.scrollTo({ left: scrollLeft, behavior: 'smooth' });

        // Then scroll page to top after a short delay to show the header
        setTimeout(() => {
          // Try multiple scroll methods to ensure it works
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;
          window.scrollTo(0, 0);
        }, 150);
      } else {
        // For other rows, use normal scrollIntoView
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [rowIndex, isTVMode]);

  // Handle navigation within row
  // The grid has 2 rows with column-flow, so DOM order is:
  // Index: 0  2  4  6  8  ...  (top row)
  //        1  3  5  7  9  ...  (bottom row)
  const GRID_ROWS = 2;

  const handleRowNavigation = useCallback((direction) => {
    const cards = scrollContainerRef.current?.querySelectorAll('[data-tv-focusable="true"]');
    if (!cards || cards.length === 0) return false;

    const currentIndex = focusedCardIndex;
    const isTopRow = currentIndex % GRID_ROWS === 0;
    const isBottomRow = currentIndex % GRID_ROWS === 1;
    let newIndex = currentIndex;

    switch (direction) {
      case 'left':
        // Move to previous column (same row)
        newIndex = currentIndex - GRID_ROWS;
        break;
      case 'right':
        // Move to next column (same row)
        newIndex = currentIndex + GRID_ROWS;
        break;
      case 'up':
        // Move to top row of same column
        if (isBottomRow) {
          newIndex = currentIndex - 1;
        } else {
          return false; // Already at top, let parent handle row change
        }
        break;
      case 'down':
        // Move to bottom row of same column
        if (isTopRow && currentIndex + 1 < cards.length) {
          newIndex = currentIndex + 1;
        } else {
          return false; // Already at bottom or no card below, let parent handle row change
        }
        break;
      default:
        return false;
    }

    // Check bounds
    if (newIndex >= 0 && newIndex < cards.length) {
      focusCard(newIndex);
      return true;
    }
    return false;
  }, [focusedCardIndex, focusCard]);

  // Get currently focused card link
  const getSelectedCardLink = useCallback(() => {
    const cards = scrollContainerRef.current?.querySelectorAll('[data-tv-focusable="true"]');
    if (cards && cards[focusedCardIndex]) {
      return cards[focusedCardIndex].getAttribute('href');
    }
    return null;
  }, [focusedCardIndex]);

  // When this row becomes active, focus the current card
  useEffect(() => {
    if (isActiveRow && isTVMode && !isLoading && videos.length > 0) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => focusCard(focusedCardIndex), 100);
      return () => clearTimeout(timer);
    } else if (!isActiveRow) {
      // Remove focus when row is not active
      const cards = scrollContainerRef.current?.querySelectorAll('[data-tv-focusable="true"]');
      cards?.forEach(card => card.classList.remove('tv-focused'));
    }
  }, [isActiveRow, isTVMode, isLoading, videos.length, focusCard, focusedCardIndex]);

  // Expose navigation methods to parent
  useEffect(() => {
    if (onCardSelect) {
      onCardSelect(rowIndex, { handleRowNavigation, getSelectedCardLink, focusCard });
    }
  }, [rowIndex, onCardSelect, handleRowNavigation, getSelectedCardLink, focusCard]);

  const TrendingIcon = () => (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M1.19628 1.19628C-9.73787e-08 2.39256 0 4.31794 0 8.16872C0 12.0194 -9.73787e-08 13.9449 1.19628 15.1411C2.39256 16.3374 4.31794 16.3374 8.16872 16.3374C12.0194 16.3374 13.9449 16.3374 15.1411 15.1411C16.3374 13.9449 16.3374 12.0194 16.3374 8.16872C16.3374 4.31794 16.3374 2.39256 15.1411 1.19628C13.9449 -9.73787e-08 12.0194 0 8.16872 0C4.31794 0 2.39256 -9.73787e-08 1.19628 1.19628ZM12.2531 8.71333C12.2531 12.1986 9.34861 13.0699 7.89645 13.0699C6.62573 13.0699 4.08436 12.1986 4.08436 8.71333C4.08436 7.19737 4.95263 6.23498 5.6821 5.75056C6.01561 5.5291 6.43042 5.67065 6.45199 6.07042C6.49916 6.94512 7.17328 7.64772 7.69534 6.94431C8.17313 6.30051 8.40896 5.42625 8.40896 4.90123C8.40896 4.12783 9.19185 3.63637 9.80311 4.11021C10.9945 5.03381 12.2531 6.58055 12.2531 8.71333Z" fill="red"/>
    </svg>
  );

  const NewContentIcon = () => (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M4.28863 0.316799C5.34951 0.0810337 6.63651 0 8.16872 0C9.70092 0 10.9879 0.0810337 12.0488 0.316799C13.119 0.554631 14.0084 0.960641 14.6926 1.64484C15.3768 2.32903 15.7828 3.21849 16.0206 4.28863C16.2564 5.34951 16.3374 6.63651 16.3374 8.16872C16.3374 9.70092 16.2564 10.9879 16.0206 12.0488C15.7828 13.119 15.3768 14.0084 14.6926 14.6926C14.0084 15.3768 13.119 15.7828 12.0488 16.0206C10.9879 16.2564 9.70092 16.3374 8.16872 16.3374C6.63651 16.3374 5.34951 16.2564 4.28863 16.0206C3.21849 15.7828 2.32903 15.3768 1.64484 14.6926C0.960641 14.0084 0.554631 13.119 0.316799 12.0488C0.0810337 10.9879 0 9.70092 0 8.16872C0 6.63651 0.0810337 5.34951 0.316799 4.28863C0.554631 3.21849 0.960641 2.32903 1.64484 1.64484C2.32903 0.960641 3.21849 0.554631 4.28863 0.316799ZM11.1064 6.80601C12.1609 7.40854 12.1609 8.92898 11.1064 9.5315L7.47764 11.6051C6.51169 12.1571 5.30983 11.4596 5.30983 10.3471V5.99044C5.30983 4.87792 6.51169 4.18044 7.47764 4.73241L11.1064 6.80601Z" fill="red"/>
    </svg>
  );

  const FirstUploadIcon = () => (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M0 8.35236C0 4.41501 0 2.44635 1.22318 1.22318C2.44635 0 4.41501 0 8.35236 0C12.2897 0 14.2584 0 15.4815 1.22318C16.7047 2.44635 16.7047 4.41501 16.7047 8.35236C16.7047 12.2897 16.7047 14.2584 15.4815 15.4815C14.2584 16.7047 12.2897 16.7047 8.35236 16.7047C4.41501 16.7047 2.44635 16.7047 1.22318 15.4815C0 14.2584 0 12.2897 0 8.35236ZM8.35236 13.155C8.69831 13.155 8.97878 12.8745 8.97878 12.5285V8.19425L10.4151 9.63052C10.6598 9.87516 11.0563 9.87516 11.301 9.63052C11.5456 9.38588 11.5456 8.98931 11.301 8.74467L8.79528 6.23893C8.67785 6.12146 8.51848 6.05546 8.35236 6.05546C8.18623 6.05546 8.02686 6.12146 7.90943 6.23893L5.4037 8.74467C5.15907 8.98931 5.15907 9.38588 5.4037 9.63052C5.64833 9.87516 6.04497 9.87516 6.2896 9.63052L7.72593 8.19425V12.5285C7.72593 12.8745 8.0064 13.155 8.35236 13.155ZM5.01141 4.8026C4.66545 4.8026 4.38499 4.52214 4.38499 4.17618C4.38499 3.83021 4.66545 3.54975 5.01141 3.54975H11.6933C12.0393 3.54975 12.3197 3.83021 12.3197 4.17618C12.3197 4.52214 12.0393 4.8026 11.6933 4.8026H5.01141Z"
        fill="red"
      />
    </svg>
  );

  const iconsByTitle = {
    "Home Feed": <TrendingIcon />,
    "New Content": <NewContentIcon />,
    "First Time Uploads": <FirstUploadIcon />,
    "Trending": <TrendingIcon />
  };

  return (
    <div className={`video-row ${isActiveRow && isTVMode ? 'tv-active-row' : ''}`} data-row-index={rowIndex}>
      <div className={`row-header ${isActiveRow && isTVMode ? 'tv-section-active' : ''}`}>
        <div className="wrap-title">
          {iconsByTitle[title]}
          <h2>{title}</h2>
        </div>
        {linkTo && !isTVMode && (
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
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={`skeleton-${index}`} className="skeleton-card-horizontal">
                  <div className="skeleton video-thumbnail-skeleton"></div>
                  <div className="skeleton line-skeleton"></div>
                  <div className="skeleton line-skeleton" style={{width: '60%'}}></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card-container-horizontal">
              <Card3 videos={videos.slice(0, 16)} loading={false} tooltipVariant="group" />
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
  const navigate = useNavigate();
  const { isTVMode, notifyNavigationState, tvSidebarVisible, setTvSidebarVisible, tvSidebarFocusIndex, setTvSidebarFocusIndex, tvFocusArea, setTvFocusArea, sidebarItemCount } = useTVMode();
  const [activeRowIndex, setActiveRowIndex] = useState(0);
  const rowHandlersRef = useRef({});
  const totalRows = 4;

  // Notify parent about navigation state - we're at root, so back should show exit dialog
  useEffect(() => {
    if (isTVMode) {
      notifyNavigationState(true); // At root - parent will show exit dialog on back
    }
  }, [isTVMode, notifyNavigationState]);

  const { data: homeData, isLoading: homeLoading, refetch: refetchHome } = useQuery({
    queryKey: ["home-grouped"],
    queryFn: fetchHome,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: firstUploadsData, isLoading: firstUploadsLoading, refetch: refetchFirstUploads } = useQuery({
    queryKey: ["firstuploads-grouped"],
    queryFn: fetchFirstUploads,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: trendingData, isLoading: trendingLoading, refetch: refetchTrending } = useQuery({
    queryKey: ["trending-grouped"],
    queryFn: fetchTrending,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: newContentData, loading: newContentLoading, refetch: refetchNewContent } = useApolloQuery(NEW_CONTENT, {
    variables: { limit: 50, skip: 0 },
  });

  // TV Mode: Refresh all videos
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshAllVideos = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchHome(),
        refetchFirstUploads(),
        refetchTrending(),
        refetchNewContent(),
      ]);
    } catch (err) {
      console.error('Error refreshing videos:', err);
    }
    setIsRefreshing(false);
  }, [isRefreshing, refetchHome, refetchFirstUploads, refetchTrending, refetchNewContent]);

  // Callback to receive row handlers from VideoRow components
  const handleCardSelect = useCallback((rowIndex, handlers) => {
    rowHandlersRef.current[rowIndex] = handlers;
  }, []);

  // When first row becomes active, scroll to top to ensure padding is visible
  useEffect(() => {
    if (isTVMode && activeRowIndex === 0) {
      setTimeout(() => {
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        window.scrollTo(0, 0);
      }, 150);
    }
  }, [isTVMode, activeRowIndex]);

  // TV Keyboard navigation
  useEffect(() => {
    if (!isTVMode) return;

    const handleKeyDown = (event) => {
      // If sidebar is open, handle sidebar navigation
      if (tvSidebarVisible && tvFocusArea === 'sidebar') {
        switch (event.keyCode) {
          case 38: // Up - move up in sidebar (wrap around)
            if (tvSidebarFocusIndex > 0) {
              setTvSidebarFocusIndex(tvSidebarFocusIndex - 1);
            } else {
              // At top, wrap to bottom
              setTvSidebarFocusIndex(sidebarItemCount - 1);
            }
            event.preventDefault();
            return;

          case 40: // Down - move down in sidebar (wrap around)
            if (tvSidebarFocusIndex < sidebarItemCount - 1) {
              setTvSidebarFocusIndex(tvSidebarFocusIndex + 1);
            } else {
              // At bottom, wrap to top
              setTvSidebarFocusIndex(0);
            }
            event.preventDefault();
            return;

          case 39: // Right - close sidebar and return to videos
            setTvSidebarVisible(false);
            setTvFocusArea('main');
            setTvSidebarFocusIndex(-1);
            event.preventDefault();
            return;

          case 13: // Enter - activate sidebar item
            const focusedEl = document.querySelector(`[data-tv-sidebar-index="${tvSidebarFocusIndex}"]`);
            if (focusedEl) {
              // Check if it's the search wrapper - open keyboard, don't close sidebar
              if (focusedEl.classList.contains('tv-search-wrapper')) {
                document.dispatchEvent(new CustomEvent('tv-open-keyboard'));
                event.preventDefault();
                return;
              }

              // Check if it's an action item (login, theme toggle) - don't close sidebar
              if (focusedEl.classList.contains('tv-action-item')) {
                focusedEl.click();
                // Don't close sidebar for action items (login opens modal on top, theme toggles in place)
                event.preventDefault();
                return;
              }

              // Navigation link - navigate and close sidebar
              const href = focusedEl.getAttribute('href');
              if (href) {
                navigate(href);
                setTvSidebarVisible(false);
                setTvFocusArea('main');
                setTvSidebarFocusIndex(-1);
              } else {
                focusedEl.click();
                setTvSidebarVisible(false);
                setTvFocusArea('main');
                setTvSidebarFocusIndex(-1);
              }
            }
            event.preventDefault();
            return;

          case 10009: // Samsung TV Back
          case 27: // Escape
            // Close sidebar
            setTvSidebarVisible(false);
            setTvFocusArea('main');
            setTvSidebarFocusIndex(-1);
            event.preventDefault();
            return;

          default:
            return;
        }
      }

      const currentHandlers = rowHandlersRef.current[activeRowIndex];

      switch (event.keyCode) {
        case 37: // Left
          if (currentHandlers?.handleRowNavigation) {
            const handled = currentHandlers.handleRowNavigation('left');
            // If we couldn't move left (at leftmost position), show sidebar
            if (!handled) {
              setTvSidebarVisible(true);
              setTvFocusArea('sidebar');
              setTvSidebarFocusIndex(0); // Start at search field
            }
          } else {
            // No handlers available, show sidebar
            setTvSidebarVisible(true);
            setTvFocusArea('sidebar');
            setTvSidebarFocusIndex(0);
          }
          event.preventDefault();
          break;

        case 39: // Right
          if (currentHandlers?.handleRowNavigation) {
            currentHandlers.handleRowNavigation('right');
          }
          event.preventDefault();
          break;

        case 38: // Up
          // First try to move within the row's grid (from bottom to top row)
          // If that returns false (already at top of grid), move to previous video row
          if (currentHandlers?.handleRowNavigation) {
            const handled = currentHandlers.handleRowNavigation('up');
            if (!handled && activeRowIndex > 0) {
              setActiveRowIndex(activeRowIndex - 1);
            } else if (!handled && activeRowIndex === 0) {
              // Already at the top row - scroll to top to show padding
              document.documentElement.scrollTop = 0;
              document.body.scrollTop = 0;
              window.scrollTo(0, 0);
              // Also refresh all videos
              refreshAllVideos();
            }
          } else if (activeRowIndex > 0) {
            setActiveRowIndex(activeRowIndex - 1);
          } else if (activeRowIndex === 0) {
            // Already at the top row - scroll to top to show padding
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
            window.scrollTo(0, 0);
            // Also refresh all videos
            refreshAllVideos();
          }
          event.preventDefault();
          break;

        case 40: // Down
          // First try to move within the row's grid (from top to bottom row)
          // If that returns false (already at bottom of grid), move to next video row
          if (currentHandlers?.handleRowNavigation) {
            const handled = currentHandlers.handleRowNavigation('down');
            if (!handled && activeRowIndex < totalRows - 1) {
              setActiveRowIndex(activeRowIndex + 1);
            }
          } else if (activeRowIndex < totalRows - 1) {
            setActiveRowIndex(activeRowIndex + 1);
          }
          event.preventDefault();
          break;

        case 13: // Enter
          if (currentHandlers?.getSelectedCardLink) {
            const link = currentHandlers.getSelectedCardLink();
            if (link) {
              navigate(link);
            }
          }
          event.preventDefault();
          break;

        case 10009: // Samsung TV Back
        case 27: // Escape
          // Back button is handled by parent (main.js) which shows the global ExitDialog
          // Don't handle it here to avoid duplicate dialogs
          break;

        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isTVMode, activeRowIndex, navigate, refreshAllVideos, tvSidebarVisible, tvFocusArea, tvSidebarFocusIndex, setTvSidebarVisible, setTvFocusArea, setTvSidebarFocusIndex, sidebarItemCount]);

  return (
    <div className="home-grouped-container">
      {isRefreshing && isTVMode && (
        <div className="tv-refresh-indicator">
          <span>Refreshing...</span>
        </div>
      )}
      <VideoRow
        title="Home Feed"
        videos={homeData || []}
        linkTo="/home-feed"
        isLoading={homeLoading}
        rowIndex={0}
        isActiveRow={activeRowIndex === 0}
        onCardSelect={handleCardSelect}
      />

      <VideoRow
        title="New Content"
        videos={newContentData?.socialFeed?.items || []}
        linkTo="/new"
        isLoading={newContentLoading}
        rowIndex={1}
        isActiveRow={activeRowIndex === 1}
        onCardSelect={handleCardSelect}
      />

      <VideoRow
        title="Trending"
        videos={trendingData || []}
        linkTo="/trend"
        isLoading={trendingLoading}
        rowIndex={2}
        isActiveRow={activeRowIndex === 2}
        onCardSelect={handleCardSelect}
      />

      <VideoRow
        title="First Time Uploads"
        videos={firstUploadsData || []}
        linkTo="/firstupload"
        isLoading={firstUploadsLoading}
        rowIndex={3}
        isActiveRow={activeRowIndex === 3}
        onCardSelect={handleCardSelect}
      />

    </div>
  );
};

export default HomeGrouped;