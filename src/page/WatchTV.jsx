import React, { useState, useEffect, useCallback, useRef } from 'react';
import './WatchTV.scss';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useWatchData } from '../hooks/useWatchData';
import { useTVMode } from '../context/TVModeContext';
import { useTVKeyboard } from '../context/TVKeyboardContext';
import { useAppStore } from '../lib/store';
import { followWithAioha, transferWithAioha } from '../hive-api/aioha';
import { toast } from 'react-toastify';
import BarLoader from '../components/Loader/BarLoader';
import TVProgressBar from '../components/tv/TVProgressBar';
import TVContextMenu from '../components/tv/TVContextMenu';
import TVTipOverlay from '../components/tv/TVTipOverlay';
import TVScrollIndicator from '../components/tv/TVScrollIndicator';
import TVRecommendedSidebar from '../components/tv/TVRecommendedSidebar';
import { FaEye } from 'react-icons/fa';
import { LuTimer } from 'react-icons/lu';
import { BiLike } from 'react-icons/bi';
import { GiTwoCoins } from 'react-icons/gi';
import BlogContent from '../components/playVideo/BlogContent';
import CommentSection from '../components/playVideo/CommentSection';

// Format relative time (e.g., "2 days ago")
function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 0) return `${diffDay}d ago`;
  if (diffHour > 0) return `${diffHour}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  return 'Just now';
}

function WatchTV() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    notifyNavigationState,
    tvSidebarVisible,
    setTvSidebarVisible,
    tvFocusArea: globalTvFocusArea,
    setTvFocusArea: setGlobalTvFocusArea,
    tvSidebarFocusIndex,
    setTvSidebarFocusIndex: setGlobalTvSidebarFocusIndex,
    sidebarItemCount
  } = useTVMode();
  const { user, authenticated } = useAppStore();
  const { isOpen: isKeyboardOpen } = useTVKeyboard();

  const v = searchParams.get('v');
  const [author, permlink] = (v ?? 'unknown/unknown').split('/');

  // Shared data fetching
  const { videoDetails, suggestedVideos, isLoading, videoError, isNetworkError } = useWatchData(author, permlink);

  // TV-specific state
  const [focusArea, setFocusArea] = useState('progressbar'); // 'progressbar' | 'sidebar' | 'video' | 'tabs' | 'tabContent'
  const [sidebarFocusIndex, setSidebarFocusIndex] = useState(0);
  const [tabFocusIndex, setTabFocusIndex] = useState(0); // 0 = comments tab, 1 = description tab
  const [commentFocusIndex, setCommentFocusIndex] = useState(-1); // Index of focused comment in tabContent
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showTipOverlay, setShowTipOverlay] = useState(false);
  const [tipLoading, setTipLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('description'); // 'comments' | 'description'
  const [commentInputFocused, setCommentInputFocused] = useState(false); // Focus on "Add comment" box
  const [commentModalOpen, setCommentModalOpen] = useState(false); // Track if comment context menu/vote overlay is open

  const sidebarRef = useRef(null);
  const videoAreaRef = useRef(null);
  const tabsRef = useRef(null);
  const tabContentRef = useRef(null);

  // Notify parent we're not at root (for back button)
  useEffect(() => {
    notifyNavigationState(false);
  }, [notifyNavigationState]);

  // Set default tab based on whether there are comments
  useEffect(() => {
    if (videoDetails?.stats?.num_comments > 0) {
      setActiveTab('comments');
    } else {
      setActiveTab('description');
    }
  }, [videoDetails?.stats?.num_comments]);

  // Player communication
  const sendPlayerCommand = useCallback((command) => {
    const iframe = document.querySelector('.watch-tv__video iframe');
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: command }, '*');
    }
  }, []);

  const triggerPlay = useCallback(() => {
    sendPlayerCommand('play');
    setIsPlaying(true);
  }, [sendPlayerCommand]);

  const triggerPause = useCallback(() => {
    sendPlayerCommand('pause');
    setIsPlaying(false);
  }, [sendPlayerCommand]);

  const triggerTogglePlay = useCallback(() => {
    sendPlayerCommand('toggle-play');
    setIsPlaying(prev => !prev);
  }, [sendPlayerCommand]);

  const triggerSeekBackward = useCallback(() => {
    const iframe = document.querySelector('.watch-tv__video iframe');
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'seekBackward', seconds: 10 }, '*');
    }
  }, []);

  const triggerSeekForward = useCallback(() => {
    const iframe = document.querySelector('.watch-tv__video iframe');
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'seekForward', seconds: 10 }, '*');
    }
  }, []);

  const triggerFullscreen = useCallback(() => {
    // For Tizen TV, communicate with parent iframe
    if (window.self !== window.top) {
      if (isFullscreen) {
        window.parent.postMessage({ type: 'request-exit-fullscreen' }, '*');
      } else {
        window.parent.postMessage({ type: 'request-fullscreen' }, '*');
      }
    } else {
      // CSS fullscreen toggle
      const newFullscreen = !isFullscreen;
      setIsFullscreen(newFullscreen);
      // Notify player iframe to rescale
      sendPlayerCommand(newFullscreen ? 'fullscreen-entered' : 'fullscreen-exited');
    }
  }, [isFullscreen, sendPlayerCommand]);

  // Open the main navigation sidebar (Home, Trending, etc.)
  const openMainSidebar = useCallback(() => {
    setTvSidebarVisible(true);
    setGlobalTvFocusArea('sidebar');
    setGlobalTvSidebarFocusIndex(0);
  }, [setTvSidebarVisible, setGlobalTvFocusArea, setGlobalTvSidebarFocusIndex]);

  // Navigation callbacks for TVProgressBar
  const handleProgressBarNavigateLeft = useCallback(() => {
    // Open the main navigation sidebar when pressing left from leftmost control
    openMainSidebar();
  }, [openMainSidebar]);

  const handleProgressBarNavigateRight = useCallback(() => {
    if (suggestedVideos.length > 0) {
      setFocusArea('sidebar');
      setSidebarFocusIndex(0);
    }
  }, [suggestedVideos.length]);

  const handleProgressBarNavigateDown = useCallback(() => {
    // In fullscreen, exit fullscreen first
    if (isFullscreen) {
      triggerFullscreen();
    }
    // Otherwise navigate to video info area
    setFocusArea('video');
  }, [isFullscreen, triggerFullscreen]);

  // Handle sidebar navigation
  const handleSidebarNavigateLeft = useCallback(() => {
    setFocusArea('progressbar');
  }, []);

  const handleSidebarSelect = useCallback((video) => {
    const videoAuthor = video?.author?.username || video?.author?.id || video?.author || video?.owner;
    navigate(`/watch?v=${videoAuthor}/${video.permlink}`);
  }, [navigate]);

  // Context menu actions (defined before keyboard navigation that uses them)
  const handleFollow = useCallback(async () => {
    if (!authenticated) {
      toast.error('Please login to follow');
      return;
    }
    try {
      await followWithAioha(user, author);
      toast.success(`Now following @${author}`);
    } catch (err) {
      toast.error('Failed to follow');
    }
    setShowContextMenu(false);
  }, [authenticated, user, author]);

  const handleVote = useCallback(() => {
    // TODO: Open vote overlay
    setShowContextMenu(false);
  }, []);

  const handleTip = useCallback(async (amount, asset, memo) => {
    if (!authenticated) {
      toast.error('Please login to tip');
      return;
    }
    setTipLoading(true);
    try {
      await transferWithAioha(user, author, amount, asset, memo);
      toast.success(`Sent ${amount} ${asset} to @${author}`);
      setShowTipOverlay(false);
    } catch (err) {
      toast.error('Failed to send tip');
    } finally {
      setTipLoading(false);
    }
  }, [authenticated, user, author]);

  // Listen for messages from player iframe
  useEffect(() => {
    const handleMessage = (event) => {
      const { type, data, currentTime, duration, playing } = event.data || {};

      switch (type) {
        case '3speak-player-ready':
          setIsPlayerReady(true);
          // Auto-enter fullscreen after a short delay
          setTimeout(() => {
            if (window.self !== window.top) {
              window.parent.postMessage({ type: 'request-fullscreen' }, '*');
            } else {
              setIsFullscreen(true);
              // Notify player iframe to rescale (non-iframe mode)
              sendPlayerCommand('fullscreen-entered');
              // Play video after fullscreen
              setTimeout(() => triggerPlay(), 300);
            }
          }, 500);
          break;
        case '3speak-timeupdate':
          if (typeof currentTime === 'number') setVideoCurrentTime(currentTime);
          if (typeof duration === 'number') setVideoDuration(duration);
          break;
        case '3speak-playstate':
          if (typeof playing === 'boolean') setIsPlaying(playing);
          break;
        case '3speak-durationchange':
          if (typeof duration === 'number') setVideoDuration(duration);
          break;
        case 'fullscreen-entered':
          setIsFullscreen(true);
          // Notify player iframe to rescale
          sendPlayerCommand('fullscreen-entered');
          // Play video after fullscreen
          setTimeout(() => triggerPlay(), 300);
          break;
        case 'fullscreen-exited':
          setIsFullscreen(false);
          // Notify player iframe to rescale
          sendPlayerCommand('fullscreen-exited');
          break;
        case 'navigate-back':
          if (isFullscreen) {
            setIsFullscreen(false);
          } else {
            navigate(-1);
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate, isFullscreen, triggerPlay, sendPlayerCommand]);

  // Close the main sidebar and restore focus
  const closeMainSidebar = useCallback(() => {
    setTvSidebarVisible(false);
    setGlobalTvFocusArea('main');
    setGlobalTvSidebarFocusIndex(-1);
  }, [setTvSidebarVisible, setGlobalTvFocusArea, setGlobalTvSidebarFocusIndex]);

  // Keyboard navigation (when not handled by child components)
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Don't handle if context menu, tip overlay, comment modal, or keyboard is open
      if (showContextMenu || showTipOverlay || commentModalOpen || isKeyboardOpen) return;

      // Handle main navigation sidebar when it's open
      if (tvSidebarVisible && globalTvFocusArea === 'sidebar') {
        switch (event.keyCode) {
          case 38: // Up - move up in sidebar
            if (tvSidebarFocusIndex > 0) {
              setGlobalTvSidebarFocusIndex(tvSidebarFocusIndex - 1);
            }
            event.preventDefault();
            event.stopPropagation();
            return;

          case 40: // Down - move down in sidebar
            if (tvSidebarFocusIndex < sidebarItemCount - 1) {
              setGlobalTvSidebarFocusIndex(tvSidebarFocusIndex + 1);
            }
            event.preventDefault();
            event.stopPropagation();
            return;

          case 39: // Right - close sidebar and return to watch page
            closeMainSidebar();
            event.preventDefault();
            event.stopPropagation();
            return;

          case 13: // Enter - activate sidebar item
            const focusedEl = document.querySelector(`[data-tv-sidebar-index="${tvSidebarFocusIndex}"]`);
            if (focusedEl) {
              const href = focusedEl.getAttribute('href');
              if (href) {
                navigate(href);
                closeMainSidebar();
              } else {
                focusedEl.click();
              }
            }
            event.preventDefault();
            event.stopPropagation();
            return;

          case 10009: // Samsung TV Back
          case 27: // Escape
            closeMainSidebar();
            event.preventDefault();
            event.stopPropagation();
            return;

          default:
            return;
        }
      }

      // Don't handle if progress bar has focus (it handles its own keys)
      if (focusArea === 'progressbar') return;

      switch (event.keyCode) {
        case 37: // Left arrow
          if (focusArea === 'sidebar') {
            setFocusArea('progressbar');
            event.preventDefault();
          } else if (focusArea === 'tabs') {
            if (tabFocusIndex > 0) {
              // Move to previous tab
              setTabFocusIndex(prev => prev - 1);
            } else {
              // At leftmost tab, open main navigation sidebar
              openMainSidebar();
            }
            event.preventDefault();
          } else if (focusArea === 'tabContent') {
            // From tab content, open main navigation sidebar
            openMainSidebar();
            event.preventDefault();
          } else if (focusArea === 'video') {
            // From author container, open main navigation sidebar
            openMainSidebar();
            event.preventDefault();
          }
          break;
        case 39: // Right arrow
          if (focusArea === 'video' && suggestedVideos.length > 0) {
            setFocusArea('sidebar');
            setSidebarFocusIndex(0);
            event.preventDefault();
          } else if (focusArea === 'tabs') {
            if (tabFocusIndex < 1) {
              // Move to next tab
              setTabFocusIndex(prev => prev + 1);
            }
            // Stay on description tab when pressing right (don't go to sidebar)
            event.preventDefault();
          }
          // Don't allow right arrow from tabContent to sidebar
          break;
        case 38: // Up arrow
          if (focusArea === 'video') {
            setFocusArea('progressbar');
            event.preventDefault();
          } else if (focusArea === 'tabs') {
            setFocusArea('video');
            event.preventDefault();
          } else if (focusArea === 'tabContent') {
            if (activeTab === 'comments') {
              if (commentInputFocused) {
                // At comment input, go back to tab headers
                setCommentInputFocused(false);
                setFocusArea('tabs');
              } else if (commentFocusIndex === 0) {
                // At first comment, go back to comment input box
                setCommentFocusIndex(-1);
                setCommentInputFocused(true);
                // Scroll comment input into view
                setTimeout(() => {
                  const commentInput = tabContentRef.current?.querySelector('.add-comment-wrap');
                  commentInput?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 50);
              } else if (commentFocusIndex > 0) {
                // Navigate to previous comment
                setCommentFocusIndex(prev => prev - 1);
                // Scroll the comment into view
                setTimeout(() => {
                  const comments = tabContentRef.current?.querySelectorAll('.comment-container');
                  comments?.[commentFocusIndex - 1]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 50);
              } else {
                // No focus on any item, go to tabs
                setFocusArea('tabs');
              }
            } else {
              // Description tab - scroll or go back
              if (tabContentRef.current && tabContentRef.current.scrollTop > 0) {
                tabContentRef.current.scrollBy({ top: -100, behavior: 'smooth' });
              } else {
                setFocusArea('tabs');
              }
            }
            event.preventDefault();
          } else if (focusArea === 'sidebar' && sidebarFocusIndex > 0) {
            setSidebarFocusIndex(prev => prev - 1);
            event.preventDefault();
          }
          break;
        case 40: // Down arrow
          if (focusArea === 'video') {
            setFocusArea('tabs');
            setTabFocusIndex(0);
            // Scroll tabs into view
            setTimeout(() => {
              tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 50);
            event.preventDefault();
          } else if (focusArea === 'tabs') {
            // Go into tab content
            setFocusArea('tabContent');
            if (activeTab === 'comments') {
              // Focus the "Add comment" input box first
              setCommentInputFocused(true);
              setCommentFocusIndex(-1);
            }
            setTimeout(() => {
              tabContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 50);
            event.preventDefault();
          } else if (focusArea === 'tabContent') {
            if (activeTab === 'comments') {
              if (commentInputFocused) {
                // Move from comment input to first comment
                setCommentInputFocused(false);
                setCommentFocusIndex(0);
                setTimeout(() => {
                  const comments = tabContentRef.current?.querySelectorAll('.comment-container');
                  comments?.[0]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 50);
              } else {
                // Navigate to next comment (count all comments including replies)
                const comments = tabContentRef.current?.querySelectorAll('.comment-container');
                const commentCount = comments?.length || 0;
                if (commentFocusIndex < commentCount - 1) {
                  setCommentFocusIndex(prev => prev + 1);
                  // Scroll the comment into view
                  setTimeout(() => {
                    comments?.[commentFocusIndex + 1]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                  }, 50);
                }
              }
            } else {
              // Description tab - just scroll
              tabContentRef.current?.scrollBy({ top: 100, behavior: 'smooth' });
            }
            event.preventDefault();
          } else if (focusArea === 'sidebar' && sidebarFocusIndex < suggestedVideos.length - 1) {
            setSidebarFocusIndex(prev => prev + 1);
            event.preventDefault();
          }
          break;
        case 13: // Enter
          if (focusArea === 'video') {
            // Trigger follow when Enter is pressed on author container
            handleFollow();
            event.preventDefault();
          } else if (focusArea === 'sidebar') {
            const video = suggestedVideos[sidebarFocusIndex];
            if (video) handleSidebarSelect(video);
            event.preventDefault();
          } else if (focusArea === 'tabs') {
            // Activate the focused tab
            setActiveTab(tabFocusIndex === 0 ? 'comments' : 'description');
            event.preventDefault();
          }
          break;
        case 10009: // Samsung Back button
        case 27: // Escape
          if (isFullscreen) {
            triggerFullscreen();
            event.preventDefault();
          } else {
            navigate(-1);
          }
          break;
        case 10135: // Samsung Menu button
        case 457: // Info button
          setShowContextMenu(true);
          event.preventDefault();
          break;
        // Media keys
        case 10252: // Samsung Play/Pause
        case 415: // Play
        case 19: // Pause
        case 179: // Play/Pause
          triggerTogglePlay();
          event.preventDefault();
          break;
      }
    };

    // Register Tizen TV keys
    if (typeof window.tizen !== 'undefined' && window.tizen.tvinputdevice) {
      try {
        ['MediaPlay', 'MediaPause', 'MediaPlayPause', 'MediaStop', 'MediaRewind', 'MediaFastForward', 'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue', 'Info'].forEach(key => {
          window.tizen.tvinputdevice.registerKey(key);
        });
      } catch (e) {
        console.warn('Failed to register Tizen keys:', e);
      }
    }

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [focusArea, sidebarFocusIndex, tabFocusIndex, activeTab, commentFocusIndex, commentInputFocused, videoDetails, suggestedVideos, showContextMenu, showTipOverlay, commentModalOpen, isKeyboardOpen, isFullscreen, navigate, triggerTogglePlay, triggerFullscreen, handleSidebarSelect, openMainSidebar, closeMainSidebar, handleFollow, tvSidebarVisible, globalTvFocusArea, tvSidebarFocusIndex, sidebarItemCount, setGlobalTvSidebarFocusIndex]);

  // Loading and error states
  if (isLoading) return <BarLoader />;
  if (videoError) {
    return (
      <div className="watch-tv watch-tv--error">
        <h2>Error loading video</h2>
        <p>{isNetworkError ? 'Network error. Please check your connection.' : 'Video not found.'}</p>
        <button onClick={() => navigate('/')}>Go Home</button>
      </div>
    );
  }

  const playerUrl = `${import.meta.env.VITE_PLAYER_URL || 'https://play.3speak.tv'}/watch?v=${author}/${permlink}&layout=desktop&mode=iframe&debug=1&tvmode=true&controls=0`;

  return (
    <div className={`watch-tv ${isFullscreen ? 'watch-tv--fullscreen' : ''}`}>
      {/* Scroll indicator (hidden in fullscreen) */}
      {!isFullscreen && <TVScrollIndicator />}

      {/* Main layout */}
      <div className="watch-tv__layout">
        {/* Video area - 70% */}
        <div className="watch-tv__main" ref={videoAreaRef}>
          {/* Video player */}
          <div className="watch-tv__video">
            <iframe
              src={playerUrl}
              frameBorder="0"
              scrolling="no"
              allowFullScreen
              allow="autoplay; encrypted-media; fullscreen"
            />
            {/* Progress bar overlay on video (when not fullscreen) */}
            {!isFullscreen && (
              <TVProgressBar
                currentTime={videoCurrentTime}
                duration={videoDuration}
                isVisible={true}
                overlay={true}
                showControls={true}
                isPlaying={isPlaying}
                isFullscreen={false}
                onSeekBackward={triggerSeekBackward}
                onTogglePlay={triggerTogglePlay}
                onSeekForward={triggerSeekForward}
                onToggleFullscreen={triggerFullscreen}
                onNavigateLeft={handleProgressBarNavigateLeft}
                onNavigateRight={handleProgressBarNavigateRight}
                onNavigateDown={handleProgressBarNavigateDown}
                hasFocus={focusArea === 'progressbar'}
              />
            )}
          </div>

          {/* Title row: 2-column layout */}
          {!isFullscreen && (
            <div className="watch-tv__info">
              {/* Left: Title, stats */}
              <div className="watch-tv__info-left">
                <h1 className="watch-tv__title">{videoDetails?.title}</h1>
                <div className="watch-tv__stats">
                  <span className="watch-tv__stat">
                    <FaEye />
                    {videoDetails?.stats?.num_views || 0} views
                  </span>
                  <span className="watch-tv__stat">
                    <LuTimer />
                    {formatRelativeTime(videoDetails?.created_at)}
                  </span>
                  <span className="watch-tv__stat">
                    <BiLike />
                    {videoDetails?.stats?.num_votes || 0}
                  </span>
                  <span className="watch-tv__stat">
                    <GiTwoCoins />
                    ${videoDetails?.stats?.total_hive_reward?.toFixed(2) || '0.00'}
                  </span>
                </div>
              </div>

              {/* Right: Author info */}
              <div className={`watch-tv__info-right ${focusArea === 'video' ? 'watch-tv__info-right--focused' : ''}`}>
                <img
                  className="watch-tv__avatar"
                  src={`https://images.hive.blog/u/${author}/avatar`}
                  alt={author}
                />
                <div className="watch-tv__author-info">
                  <span className="watch-tv__author-name">@{author}</span>
                  <span className="watch-tv__followers">
                    {videoDetails?.author?.follower_count || 0} Followers
                  </span>
                </div>
                {author !== user && (
                  <button className="watch-tv__follow-btn">Follow</button>
                )}
              </div>
            </div>
          )}

          {/* Tabs: Comments / Description */}
          {!isFullscreen && (
            <div className="watch-tv__tabs" ref={tabsRef}>
              <div className="watch-tv__tab-buttons">
                <button
                  className={`watch-tv__tab-btn ${activeTab === 'comments' ? 'watch-tv__tab-btn--active' : ''} ${focusArea === 'tabs' && tabFocusIndex === 0 ? 'watch-tv__tab-btn--focused' : ''}`}
                  onClick={() => setActiveTab('comments')}
                >
                  Comments ({videoDetails?.stats?.num_comments || 0})
                </button>
                <button
                  className={`watch-tv__tab-btn ${activeTab === 'description' ? 'watch-tv__tab-btn--active' : ''} ${focusArea === 'tabs' && tabFocusIndex === 1 ? 'watch-tv__tab-btn--focused' : ''}`}
                  onClick={() => setActiveTab('description')}
                >
                  Description
                </button>
              </div>
              <div
                className={`watch-tv__tab-content ${focusArea === 'tabContent' ? 'watch-tv__tab-content--focused' : ''}`}
                ref={tabContentRef}
              >
                {activeTab === 'comments' ? (
                  <CommentSection
                    videoDetails={videoDetails}
                    author={author}
                    permlink={permlink}
                    tvFocusedIndex={focusArea === 'tabContent' ? commentFocusIndex : -1}
                    tvCommentInputFocused={focusArea === 'tabContent' && commentInputFocused}
                    onModalStateChange={setCommentModalOpen}
                  />
                ) : (
                  <div className="watch-tv__description">
                    <BlogContent author={author} permlink={permlink} disableCollapse={true} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - 30% (hidden in fullscreen) */}
        {!isFullscreen && (
          <TVRecommendedSidebar
            ref={sidebarRef}
            videos={suggestedVideos}
            focusedIndex={focusArea === 'sidebar' ? sidebarFocusIndex : -1}
            onFocusChange={setSidebarFocusIndex}
            onNavigateLeft={handleSidebarNavigateLeft}
            onSelect={handleSidebarSelect}
          />
        )}
      </div>

      {/* Fullscreen progress bar */}
      {isFullscreen && (
        <TVProgressBar
          currentTime={videoCurrentTime}
          duration={videoDuration}
          isVisible={true}
          showControls={true}
          isPlaying={isPlaying}
          isFullscreen={true}
          onSeekBackward={triggerSeekBackward}
          onTogglePlay={triggerTogglePlay}
          onSeekForward={triggerSeekForward}
          onToggleFullscreen={triggerFullscreen}
          hasFocus={true}
        />
      )}

      {/* Context Menu */}
      <TVContextMenu
        isOpen={showContextMenu}
        onClose={() => setShowContextMenu(false)}
        onFollow={handleFollow}
        onVote={handleVote}
        onTip={() => {
          setShowContextMenu(false);
          setShowTipOverlay(true);
        }}
        creatorName={author}
        tags={videoDetails?.tags || []}
      />

      {/* Tip Overlay */}
      <TVTipOverlay
        isOpen={showTipOverlay}
        onClose={() => setShowTipOverlay(false)}
        onTip={handleTip}
        isLoading={tipLoading}
        creatorName={author}
      />
    </div>
  );
}

export default WatchTV;
