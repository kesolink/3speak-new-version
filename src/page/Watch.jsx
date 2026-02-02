import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import './Watch.scss';
import PlayVideo from '../components/playVideo/PlayVideo';
import Recommended from '../components/recommended/Recommended';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { GET_RELATED, GET_VIDEO_DETAILS, TRENDING_FEED, GET_AUTHOR_VIDEOS } from '../graphql/queries';
import { useQuery } from '@apollo/client';
import BarLoader from '../components/Loader/BarLoader';
import { useTVMode } from '../context/TVModeContext';
import { useTVSidebarNavigation } from '../hooks/useTVSidebarNavigation';
import TVContextMenu from '../components/tv/TVContextMenu';
import TVProgressBar from '../components/tv/TVProgressBar';
import { followWithAioha } from '../hive-api/aioha';
import { toast } from 'react-toastify';
import { useAppStore } from '../lib/store';

// Number of author videos to show at the top of recommendations
const AUTHOR_VIDEOS_COUNT = 4;

// Filter out videos older than December 2023 (old videos may not exist on CDN)
const MIN_VIDEO_DATE = new Date('2023-12-01T00:00:00.000Z');

function filterValidVideos(videos) {
  if (!videos || !Array.isArray(videos)) return [];
  return videos.filter(video => {
    // Must have created_at date
    if (!video?.created_at) return false;
    
    // Filter out old videos
    const videoDate = new Date(video.created_at);
    if (videoDate < MIN_VIDEO_DATE) return false;
    
    // Filter out videos without a valid play_url (likely deleted)
    if (!video?.spkvideo?.play_url) return false;
    
    return true;
  });
}

function Watch() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isTVMode, notifyNavigationState } = useTVMode();
  const { authenticated } = useAppStore();
  const v = searchParams.get('v'); // Extract the "v" query parameter
  const [author, permlink] = (v ?? 'unknown/unknown').split('/');

  // TV Mode state
  const [tvFocusArea, setTvFocusArea] = useState('video'); // 'video' or 'sidebar'
  const [sidebarFocusIndex, setSidebarFocusIndex] = useState(0);
  const [mainFocusIndex, setMainFocusIndex] = useState(0); // 0 = player, 1+ = other focusable items
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [isCssFullscreen, setIsCssFullscreen] = useState(false); // Track CSS fullscreen state from Tizen parent
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const playerIframeRef = useRef(null);
  const recommendedRef = useRef(null);
  const mainContentRef = useRef(null);

  // Notify parent that we're NOT at root (for back button behavior)
  // Also initialize focus on the player when entering Watch page in TV mode
  useEffect(() => {
    if (isTVMode) {
      notifyNavigationState(false); // We're not at root, back should navigate
      // Initialize focus on the player after a short delay
      setTimeout(() => {
        const playerWrapper = mainContentRef.current?.querySelector('.video-iframe-wrapper');
        if (playerWrapper) {
          playerWrapper.classList.add('tv-focused');
        }
      }, 200);
      // Note: Fullscreen is now triggered after player-ready event in message handler
    }
  }, [isTVMode, notifyNavigationState]);

  // Send play/pause command to the player iframe
  const sendPlayerCommand = useCallback((command) => {
    const iframe = document.querySelector('.video-iframe-wrapper iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: command }, '*');
    }
  }, []);

  // Focus the iframe to allow keyboard interaction with the player
  const focusPlayerIframe = useCallback(() => {
    const iframe = document.querySelector('.video-iframe-wrapper iframe');
    if (iframe) {
      iframe.focus();
    }
  }, []);

  const triggerPlay = useCallback(() => {
    sendPlayerCommand('play');
  }, [sendPlayerCommand]);

  const triggerPause = useCallback(() => {
    sendPlayerCommand('pause');
  }, [sendPlayerCommand]);

  const triggerTogglePlay = useCallback(() => {
    sendPlayerCommand('toggle-play');
  }, [sendPlayerCommand]);

  const triggerFullscreen = useCallback(() => {
    // In TV mode (iframe context), request fullscreen from parent Tizen app
    // The parent will handle CSS fullscreen and send back fullscreen-entered/exited
    if (isTVMode && window.parent !== window) {
      console.log('[Watch.jsx] TV Mode: Requesting fullscreen from parent, current state:', isCssFullscreen);
      if (isCssFullscreen) {
        window.parent.postMessage({ type: 'request-exit-fullscreen' }, '*');
      } else {
        window.parent.postMessage({ type: 'request-fullscreen' }, '*');
      }
      return;
    }

    // Non-TV mode: use browser fullscreen API
    // First try to send command to player
    sendPlayerCommand('fullscreen');

    // Also use browser fullscreen API on the iframe/wrapper
    const iframe = document.querySelector('.video-iframe-wrapper iframe');
    const wrapper = document.querySelector('.video-iframe-wrapper');
    const target = iframe || wrapper;

    if (target) {
      if (document.fullscreenElement) {
        // Already in fullscreen, exit
        console.log('[Watch.jsx] Exiting fullscreen');
        document.exitFullscreen?.().catch(err => console.error('[Watch.jsx] Exit fullscreen error:', err));
      } else {
        // Enter fullscreen
        console.log('[Watch.jsx] Requesting fullscreen on:', target.tagName);
        const requestFullscreen = target.requestFullscreen ||
                                   target.webkitRequestFullscreen ||
                                   target.mozRequestFullScreen ||
                                   target.msRequestFullscreen;
        if (requestFullscreen) {
          requestFullscreen.call(target)
            .then(() => console.log('[Watch.jsx] Fullscreen activated'))
            .catch(err => console.error('[Watch.jsx] Fullscreen error:', err));
        } else {
          console.log('[Watch.jsx] No fullscreen API available');
        }
      }
    } else {
      console.log('[Watch.jsx] No target element found for fullscreen');
    }
  }, [sendPlayerCommand, isTVMode, isCssFullscreen]);

  // Listen for media control events from parent Tizen wrapper
  useEffect(() => {
    if (!isTVMode) return;

    const handleMediaControl = (event) => {
      const action = event.detail?.action;
      switch (action) {
        case 'toggle-play':
          triggerTogglePlay();
          break;
        case 'play':
          triggerPlay();
          break;
        case 'pause':
          triggerPause();
          break;
        default:
          break;
      }
    };

    document.addEventListener('tv-media-control', handleMediaControl);
    return () => document.removeEventListener('tv-media-control', handleMediaControl);
  }, [isTVMode, triggerPlay, triggerPause, triggerTogglePlay]);

  // Handle TV-specific keys: Back button and Play/Pause
  useEffect(() => {
    if (!isTVMode) return;

    // Register TV keys with Tizen API if available
    try {
      if (window.tizen && window.tizen.tvinputdevice) {
        const keysToRegister = ['MediaPlay', 'MediaPause', 'MediaPlayPause', 'MediaStop', 'Menu', 'Tools', 'Info', 'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue'];
        keysToRegister.forEach(key => {
          try {
            window.tizen.tvinputdevice.registerKey(key);
          } catch (e) {
            // Key registration failed
          }
        });
      }
    } catch (e) {
      // Tizen API not available
    }

    const handleTVKeys = (event) => {
      switch (event.keyCode) {
        // Enter key on video player - trigger fullscreen
        case 13: // Enter
          // Only handle if video is focused
          if (tvFocusArea === 'video') {
            console.log('[Watch.jsx] Enter key - sending fullscreen command and focusing iframe');
            // Send fullscreen command to player
            sendPlayerCommand('fullscreen');
            // Focus the iframe so it receives the Enter key for user gesture
            focusPlayerIframe();
            // Don't preventDefault - let the Enter key reach the player for user gesture context
          }
          break;

        // Left/Right arrow keys - seek in fullscreen mode
        case 37: // Left arrow - seek backward
          if (isCssFullscreen) {
            console.log('[Watch.jsx] Seeking backward 10s');
            const iframe = document.querySelector('.video-iframe-wrapper iframe');
            if (iframe && iframe.contentWindow) {
              iframe.contentWindow.postMessage({ type: 'seekBackward', seconds: 10 }, '*');
            }
            event.preventDefault();
            event.stopPropagation();
          }
          break;

        case 39: // Right arrow - seek forward
          if (isCssFullscreen) {
            console.log('[Watch.jsx] Seeking forward 10s');
            const iframe = document.querySelector('.video-iframe-wrapper iframe');
            if (iframe && iframe.contentWindow) {
              iframe.contentWindow.postMessage({ type: 'seekForward', seconds: 10 }, '*');
            }
            event.preventDefault();
            event.stopPropagation();
          }
          break;

        // Play/Pause media keys
        case 10252: // Samsung MediaPlayPause
        case 415:   // MediaPlay
        case 19:    // MediaPause (Pause key)
        case 179:   // MediaPlayPause (standard)
        case 10254: // Samsung MediaPause
          triggerTogglePlay();
          event.preventDefault();
          event.stopPropagation();
          break;

        // Context menu / Options key - use color buttons or menu keys
        case 10135: // Samsung Tools/More
        case 10133: // Samsung Menu
        case 10253: // Samsung Menu (emulator)
        case 457:   // Info key
        case 93:    // Context menu key (keyboard)
        case 403:   // Red color button (F0)
        case 404:   // Green color button (F1)
        case 405:   // Yellow color button (F2)
        case 406:   // Blue color button (F3)
          // Exit fullscreen first before showing the context menu
          if (isCssFullscreen) {
            window.parent.postMessage({ type: 'request-exit-fullscreen' }, '*');
            // Delay showing menu to allow fullscreen exit to complete
            setTimeout(() => setShowContextMenu(true), 300);
          } else {
            setShowContextMenu(true);
          }
          event.preventDefault();
          event.stopPropagation();
          break;

        default:
          break;
      }
    };

    // Use capture phase to handle before other handlers
    document.addEventListener('keydown', handleTVKeys, true);
    return () => document.removeEventListener('keydown', handleTVKeys, true);
  }, [isTVMode, navigate, triggerTogglePlay, triggerFullscreen, tvFocusArea, isCssFullscreen]);

  // Listen for TV back button event (from TVModeContext)
  useEffect(() => {
    const handleBackButton = (event) => {
      if (showContextMenu) {
        setShowContextMenu(false);
        event.preventDefault();
      }
    };

    document.addEventListener('tv-back-button', handleBackButton);
    return () => document.removeEventListener('tv-back-button', handleBackButton);
  }, [showContextMenu]);

  // Listen for messages from parent frame and player iframe
  useEffect(() => {
    const handleMessage = (event) => {
      // Handle navigate-back from parent (when parent decides not to exit)
      if (event.data && event.data.type === 'navigate-back') {
        if (window.history.length > 1) {
          navigate(-1);
        } else {
          navigate('/');
        }
        return;
      }

      // Handle player-ready for auto-play and fullscreen
      if (event.data && event.data.type === '3speak-player-ready') {
        console.log('[Watch.jsx] Player ready received');
        setIsPlayerReady(true);
        // Small delay to ensure player is fully ready, then play
        setTimeout(() => {
          triggerPlay();
        }, 100);
        // In TV mode, enter fullscreen after player is ready
        if (isTVMode && window.parent !== window) {
          setTimeout(() => {
            console.log('[Watch.jsx] Auto-requesting fullscreen after player ready');
            window.parent.postMessage({ type: 'request-fullscreen' }, '*');
          }, 300);
        }
      }

      // Handle timeupdate from player (for TV progress bar)
      if (event.data && event.data.type === '3speak-timeupdate') {
        setVideoCurrentTime(event.data.currentTime || 0);
        setVideoDuration(event.data.duration || 0);
      }

      // Handle duration change from player
      if (event.data && event.data.type === '3speak-durationchange') {
        setVideoDuration(event.data.duration || 0);
      }

      // Handle CSS fullscreen events from Tizen parent
      if (event.data && event.data.type === 'fullscreen-entered') {
        console.log('[Watch.jsx] Received fullscreen-entered from parent');
        setIsCssFullscreen(true);
        // Forward to player iframe
        sendPlayerCommand('fullscreen-entered');
      }

      if (event.data && event.data.type === 'fullscreen-exited') {
        console.log('[Watch.jsx] Received fullscreen-exited from parent');
        setIsCssFullscreen(false);
        // Forward to player iframe
        sendPlayerCommand('fullscreen-exited');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [triggerPlay, navigate, sendPlayerCommand, isTVMode]);

  const { data: videoData, loading: videoLoading, error: videoError } = useQuery(GET_VIDEO_DETAILS, {
    variables: { author, permlink },
  });

  const videoDetails = videoData?.socialPost;

  // Fetch related videos
  const { data: suggestionsData, loading: suggestionsLoading } = useQuery(GET_RELATED, {
    variables: { author, permlink },
  });

  // Fetch trending as fallback
  const { data: trendingData, loading: trendingLoading } = useQuery(TRENDING_FEED);

  // Fetch videos from the same author
  const { data: authorVideosData, loading: authorVideosLoading } = useQuery(GET_AUTHOR_VIDEOS, {
    variables: { id: author },
    skip: !author || author === 'unknown',
  });

  // Smart recommendation logic:
  // 1. Show up to 4 videos from the same author first
  // 2. Then show related/recommended videos
  // 3. Fall back to trending if not enough related videos
  // 4. Exclude the current video from all lists
  const suggestedVideos = useMemo(() => {
    const authorItems = authorVideosData?.socialFeed?.items || [];
    const relatedItems = suggestionsData?.relatedFeed?.items || [];
    const trendingItems = trendingData?.trendingFeed?.items || [];
    
    // Track permlinks to avoid duplicates
    const usedPermlinks = new Set();
    usedPermlinks.add(permlink); // Exclude current video
    
    // 1. Get up to AUTHOR_VIDEOS_COUNT valid videos from the same author
    const authorVideos = filterValidVideos(authorItems)
      .filter(v => {
        if (usedPermlinks.has(v.permlink)) return false;
        usedPermlinks.add(v.permlink);
        return true;
      })
      .slice(0, AUTHOR_VIDEOS_COUNT);
    
    // 2. Get related/recommended videos (excluding author's videos and current)
    let recommendations = filterValidVideos(relatedItems)
      .filter(v => {
        if (usedPermlinks.has(v.permlink)) return false;
        usedPermlinks.add(v.permlink);
        return true;
      });
    
    // 3. If not enough related videos, supplement with trending
    if (recommendations.length < 5) {
      const validTrending = filterValidVideos(trendingItems);
      for (const video of validTrending) {
        if (!usedPermlinks.has(video.permlink) && recommendations.length < 16) {
          recommendations.push(video);
          usedPermlinks.add(video.permlink);
        }
      }
    }
    
    // Combine: author videos first, then recommendations
    return [...authorVideos, ...recommendations];
  }, [authorVideosData, suggestionsData, trendingData, author, permlink]);
  
  const isNetworkError = videoError && videoError.networkError;
  const isLoading = videoLoading || (suggestionsLoading && trendingLoading && authorVideosLoading);

  // Focus a recommended video card
  const focusSidebarItem = useCallback((index) => {
    if (!recommendedRef.current) return;
    const items = recommendedRef.current.querySelectorAll('[data-tv-focusable="true"]');
    if (items.length === 0) return;

    const clampedIndex = Math.max(0, Math.min(index, items.length - 1));

    // Remove focus from all
    items.forEach(item => item.classList.remove('tv-focused'));

    // Focus target item
    const target = items[clampedIndex];
    if (target) {
      target.classList.add('tv-focused');
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setSidebarFocusIndex(clampedIndex);
    }
  }, []);

  // Focus a main content item (player, description toggle, etc.)
  const focusMainItem = useCallback((index) => {
    if (!mainContentRef.current) return;

    // Get all focusable items in main content area
    // Index 0 is the video player (special case)
    // Index 1+ are other focusable elements like description toggle
    const focusableItems = mainContentRef.current.querySelectorAll('[data-tv-main-focusable="true"]');
    const totalItems = 1 + focusableItems.length; // +1 for player

    const clampedIndex = Math.max(0, Math.min(index, totalItems - 1));

    // Remove focus from all main items
    const playerWrapper = mainContentRef.current.querySelector('.video-iframe-wrapper');
    if (playerWrapper) playerWrapper.classList.remove('tv-focused');
    focusableItems.forEach(item => item.classList.remove('tv-focused'));

    if (clampedIndex === 0) {
      // Focus the player
      if (playerWrapper) {
        playerWrapper.classList.add('tv-focused');
        playerWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      // Focus other focusable item
      const target = focusableItems[clampedIndex - 1];
      if (target) {
        target.classList.add('tv-focused');
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    setMainFocusIndex(clampedIndex);
  }, []);

  // Handle navigation for TV sidebar hook
  const handleNavigate = useCallback((direction) => {
    if (direction === 'left') {
      if (tvFocusArea === 'sidebar') {
        // Currently in recommendations sidebar, switch to video area
        setTvFocusArea('video');
        const items = recommendedRef.current?.querySelectorAll('[data-tv-focusable="true"]');
        items?.forEach(item => item.classList.remove('tv-focused'));
        return true;
      }
      // In video area, let menu sidebar open
      return false;
    }

    if (direction === 'right') {
      if (tvFocusArea === 'video' && suggestedVideos.length > 0) {
        setTvFocusArea('sidebar');
        setTimeout(() => focusSidebarItem(sidebarFocusIndex), 100);
      }
      return true;
    }

    if (direction === 'up') {
      if (tvFocusArea === 'sidebar' && sidebarFocusIndex > 0) {
        focusSidebarItem(sidebarFocusIndex - 1);
      } else if (tvFocusArea === 'video' && mainFocusIndex > 0) {
        focusMainItem(mainFocusIndex - 1);
      }
      return true;
    }

    if (direction === 'down') {
      if (tvFocusArea === 'sidebar') {
        const items = recommendedRef.current?.querySelectorAll('[data-tv-focusable="true"]');
        if (items && sidebarFocusIndex < items.length - 1) {
          focusSidebarItem(sidebarFocusIndex + 1);
        }
      } else if (tvFocusArea === 'video') {
        const focusableItems = mainContentRef.current?.querySelectorAll('[data-tv-main-focusable="true"]');
        const totalItems = 1 + (focusableItems?.length || 0);
        if (mainFocusIndex < totalItems - 1) {
          focusMainItem(mainFocusIndex + 1);
        }
      }
      return true;
    }

    return false;
  }, [tvFocusArea, sidebarFocusIndex, mainFocusIndex, suggestedVideos.length, focusSidebarItem, focusMainItem]);

  // Handle selection for TV sidebar hook
  const handleSelect = useCallback(() => {
    if (tvFocusArea === 'video') {
      if (mainFocusIndex === 0) {
        // In TV mode, Enter on video player triggers fullscreen
        triggerFullscreen();
        focusPlayerIframe();
      } else {
        const focusableItems = mainContentRef.current?.querySelectorAll('[data-tv-main-focusable="true"]');
        if (focusableItems && focusableItems[mainFocusIndex - 1]) {
          focusableItems[mainFocusIndex - 1].click();
        }
      }
    } else if (tvFocusArea === 'sidebar') {
      const items = recommendedRef.current?.querySelectorAll('[data-tv-focusable="true"]');
      if (items && items[sidebarFocusIndex]) {
        const link = items[sidebarFocusIndex].getAttribute('href');
        if (link) {
          navigate(link);
        }
      }
    }
  }, [tvFocusArea, mainFocusIndex, sidebarFocusIndex, triggerFullscreen, focusPlayerIframe, navigate]);

  // Context menu action handlers
  const handleFollow = useCallback(async () => {
    console.log('[handleFollow] Follow action triggered for:', author);

    if (!authenticated) {
      toast.error('Login to follow users');
      return;
    }

    try {
      console.log('[handleFollow] Calling followWithAioha...');
      await followWithAioha(author, true);
      console.log('[handleFollow] Follow successful');
      toast.success(`Successfully followed @${author}`);
    } catch (error) {
      console.error('[handleFollow] Follow failed:', error);
      toast.error(`Failed to follow: ${error.message}`);
    }
  }, [author, authenticated]);

  const handleVote = useCallback(() => {
    console.log('Watch.jsx: Vote action triggered');
    // Find and click the upvote button in PlayVideo component to open TV upvote overlay
    const voteBtn = document.querySelector('[data-tv-focusable-type="upvote"]');
    if (voteBtn) {
      voteBtn.click();
    }
  }, []);

  const handleJumpToComment = useCallback(() => {
    console.log('Watch.jsx: Jump to comment action triggered');
    // Find the comment wrapper (which has the enterTvInputMode onClick handler)
    const commentWrapper = document.querySelector('.add-comment-wrap[data-tv-custom-keyboard="true"]');
    if (commentWrapper) {
      commentWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // In TV mode, click the wrapper to trigger enterTvInputMode which opens the keyboard
      if (isTVMode) {
        setTimeout(() => {
          commentWrapper.click();
        }, 25);
      } else {
        // Non-TV mode: just focus the textarea
        const textarea = commentWrapper.querySelector('textarea');
        if (textarea) textarea.focus();
      }
    }
  }, [isTVMode]);

  const handleExpandDescription = useCallback(() => {
    console.log('Watch.jsx: Expand description action triggered');
    // Find and click the description expand button or scroll to description
    const descriptionToggle = document.querySelector('.description-toggle, [data-action="expand-description"], .show-more-btn');
    if (descriptionToggle) {
      descriptionToggle.click();
      descriptionToggle.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      // Just scroll to description area
      const descriptionArea = document.querySelector('.video-description, .description-section');
      if (descriptionArea) {
        descriptionArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, []);

  // Use TV sidebar navigation hook
  useTVSidebarNavigation({
    onNavigate: handleNavigate,
    onSelect: handleSelect,
    onLeftAtEdge: () => {
      // When in video area and Left is pressed, return false to open menu sidebar
      if (tvFocusArea === 'video') {
        return false;
      }
      return true;
    }
  });

  if (isLoading) {
    return <BarLoader />;
  }

  if (videoError) {
    return <div>Error loading data. Please try again.</div>;
  }

  if (isNetworkError) {
    return <div>network error</div>;
  }

  return (
    <div className={`play-container ${isTVMode ? 'tv-mode-watch' : ''} ${isCssFullscreen ? 'css-fullscreen-mode' : ''}`}>

      <div
        ref={mainContentRef}
        className={`video-area ${isTVMode ? 'tv-mode-video-area' : ''}`}
      >
        <PlayVideo
          videoDetails={videoDetails}
          author={author}
          permlink={permlink}
          tvProgressBar={isTVMode && !isCssFullscreen ? {
            currentTime: videoCurrentTime,
            duration: videoDuration,
            isVisible: true,
          } : null}
        />
      </div>

      {suggestedVideos.length > 0 && (
        <div ref={recommendedRef} className={tvFocusArea === 'sidebar' && isTVMode ? 'tv-sidebar-focused' : ''}>
          <Recommended suggestedVideos={suggestedVideos} />
        </div>
      )}

      {/* TV Context Menu */}
      {isTVMode && (
        <TVContextMenu
          isOpen={showContextMenu}
          onClose={() => setShowContextMenu(false)}
          onFollow={handleFollow}
          onVote={handleVote}
          onJumpToComment={handleJumpToComment}
          onExpandDescription={handleExpandDescription}
          creatorName={author}
        />
      )}

      {/* TV Progress Bar - shown in fullscreen mode */}
      {isTVMode && isCssFullscreen && (
        <TVProgressBar
          currentTime={videoCurrentTime}
          duration={videoDuration}
          isVisible={true}
        />
      )}
    </div>
  );
}

export default Watch;
