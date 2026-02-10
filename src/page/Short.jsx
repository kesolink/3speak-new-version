import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import "./Short.scss";
import {
  Heart,
  MessageSquare,
  Share2,
  RefreshCw,
  Music2,
  ArrowUp,
  ArrowDown,
  X,
  SlidersHorizontal,
  MoreVertical,
  Loader2,
  Play,
  Pause,
  Send,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
  ExternalLink,
  Video,
  MessageSquareText,
  Camera,
  Volume2,
  VolumeX
} from 'lucide-react';
import { GiTwoCoins } from 'react-icons/gi';

// Custom Hive Icon Component
const HiveIcon = ({ size = 24, className = '' }) => (
  <svg
    role="img"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    className={className}
    fill="currentColor"
  >
    <path d="M6.076 1.637a.103.103 0 00-.09.05L.014 11.95a.102.102 0 000 .104l6.039 10.26c.04.068.14.068.18 0l5.972-10.262a.102.102 0 00-.002-.104L6.166 1.687a.103.103 0 00-.09-.05zm2.863 0c-.079 0-.13.085-.09.154l5.186 8.967a.105.105 0 00.09.053h3.117c.08 0 .13-.088.09-.157l-5.186-8.966a.104.104 0 00-.09-.051H8.94zm5.891 0a.102.102 0 00-.088.154L20.656 12l-5.914 10.209a.102.102 0 00.088.154h3.123a.1.1 0 00.088-.05l5.945-10.262a.1.1 0 000-.102L18.041 1.688a.1.1 0 00-.088-.051H14.83zm-.79 11.7a.1.1 0 00-.089.052l-5.101 8.82c-.04.069.01.154.09.154h3.117a.104.104 0 00.09-.05l5.1-8.82a.103.103 0 00-.09-.155h-3.118z" />
  </svg>
);
import hiveApi, { regenerateShortsSeed, consumePreloadedShorts, hasShortsPreloaded, preloadShorts, fetchUserShortsWithDetails } from '../hive-api/hiveApi';
import { useAppStore } from '../lib/store';
import axios from 'axios';
import { toast } from 'sonner';
import CommentVoteTooltip from '../components/tooltip/CommentVoteTooltip';
import { PLAYER_URL } from '../utils/config';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { fixVideoThumbnail } from '../utils/fixThumbnails';
import AuthorBadge from '../components/AuthorBadge/AuthorBadge';

// Lazy-loaded Hive markdown renderer (same as CommentSection)
let rendererPromise = null;
const getRenderer = async () => {
  if (!rendererPromise) {
    rendererPromise = import('@snapie/renderer').then(({ createHiveRenderer }) => {
      return createHiveRenderer({
        ipfsGateway: 'https://ipfs-3speak.b-cdn.net',
        convertHiveUrls: true,
        usertagUrlFn: (account) => `/p/${account}`,
        hashtagUrlFn: (tag) => `/t/${tag}`,
      });
    });
  }
  return rendererPromise;
};

/* ================= COMPONENT ================= */
const VideoShort = () => {
  const { user, authenticated } = useAppStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [videos, setVideos] = useState([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [parentCardVisible, setParentCardVisible] = useState(true);
  const [expandedChainCard, setExpandedChainCard] = useState(null);
  const [shortNavLoading, setShortNavLoading] = useState(false);
  const [firstPlayerReady, setFirstPlayerReady] = useState(false);
  const shortHistoryRef = useRef([]); // Stack of {author, permlink} for back navigation
  const isNavigatingBackRef = useRef(false); // Prevents URL-change effect from pushing to history on back

  // Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(() => {
    const cookie = document.cookie.split('; ').find(c => c.startsWith('shorts_muted='));
    return cookie ? cookie.split('=')[1] !== '0' : false;
  });
  // currentTime/duration as refs instead of state to avoid re-renders on every timeupdate (~4x/sec)
  // Progress bar is updated directly via DOM refs
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  const progressFillRef = useRef(null);
  const progressHandleRef = useRef(null);
  const updateProgressBar = useCallback(() => {
    const pct = durationRef.current > 0 ? (currentTimeRef.current / durationRef.current) * 100 : 0;
    if (progressFillRef.current) progressFillRef.current.style.width = `${pct}%`;
    if (progressHandleRef.current) progressHandleRef.current.style.left = `${pct}%`;
  }, []);
  const [showPlayPauseIcon, setShowPlayPauseIcon] = useState(false);
  const [showMuteIcon, setShowMuteIcon] = useState(false);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [postingComment, setPostingComment] = useState(false);

  // Vote tooltip state
  const [showTooltip, setShowTooltip] = useState(false);
  const [activeTooltipPermlink, setActiveTooltipPermlink] = useState(null);
  const [selectedComment, setSelectedComment] = useState({ author: '', permlink: '' });
  const [weight, setWeight] = useState(100);
  const [voteValue, setVoteValue] = useState(0.0);
  const [accountData, setAccountData] = useState(null);

  // Rendered comment bodies (permlink -> HTML string)
  const [renderedBodies, setRenderedBodies] = useState({});

  // Reply state
  const [activeReply, setActiveReply] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [captionExpanded, setCaptionExpanded] = useState(false);

  // Touch/swipe state for mobile navigation
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState(null); // 'up' | 'down' | null
  const [swipeDragY, setSwipeDragY] = useState(0); // live drag offset in px
  const swipeAnimRef = useRef(null);
  const touchStartYRef = useRef(null); // Synchronous mirror of touchStart for gesture detection

  const progressBarRef = useRef(null);
  const playPauseTimeoutRef = useRef(null);
  const commentsFetchedRef = useRef(new Set());
  const videoContainerRef = useRef(null);
  const iframeRefs = useRef({}); // Store refs to all iframes by video id
  const keyboardRef = useRef(null); // capture keyboard events on mobile when focused
  const prevIndexRef = useRef(0); // Track previous index
  const prevVideoIdRef = useRef(null); // Track previous video id to avoid re-running play on enrichment
  const readyPlayers = useRef(new Set()); // Track which players have sent 3speak-player-ready
  const [readyPlayerIds, setReadyPlayerIds] = useState(new Set()); // State mirror for render gating
  const pendingPlayRef = useRef(null); // Track video waiting to be played
  const chainPreloadDataRef = useRef(new Map()); // Chain short metadata for instant navigation
  const loadingMoreRef = useRef(false); // Prevent concurrent loadMore calls

  // Gesture detection refs
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const gestureHandledRef = useRef(false); // Prevent touch + click double-fire
  const muteIconTimeoutRef = useRef(null);
  const heartAnimTimeoutRef = useRef(null);
  const isMutedRef = useRef(isMuted); // Mirror of isMuted for use inside message handler closure
  const mouseLongPressRef = useRef(null); // Timer for desktop mouse long-press
  const mouseLongPressHandledRef = useRef(false); // Tracks whether mouse long-press fired
  const recentTouchRef = useRef(false); // Guards click handler from firing after touch events
  const wasPlayingBeforePopupRef = useRef(false); // Tracks play state before vote popup opens

  const commentsDragStartY = useRef(null); // Drag handle touch start Y
  const commentsPanelRef = useRef(null); // Ref for comments panel element

  const accessToken = localStorage.getItem("access_token");
  const navigate = useNavigate();
  const location = useLocation();

  // User-specific feed mode: when ?user=username is in the URL, load from the per-user endpoint
  const feedUser = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('user') || null;
  }, [location.search]);
  const feedUserRef = useRef(feedUser);
  feedUserRef.current = feedUser;

  // Minimum swipe distance to trigger navigation (in pixels)
  const minSwipeDistance = 50;

  // Get shared video from URL parameter
  const getSharedVideoFromUrl = useCallback(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const videoParam = urlParams.get('v');
    if (videoParam) {
      const [author, permlink] = videoParam.split('/');
      if (author && permlink) {
        return { author, permlink };
      }
    }
    return null;
  }, []);

  // Update URL when current video changes (without page reload)
  const updateUrlWithCurrentVideo = useCallback((video) => {
    if (!video) return;
    const newUrl = `${window.location.pathname}?v=${video.author}/${video.permlink}`;
    window.history.replaceState({}, '', newUrl);
  }, []);

  /* ---------- 3SPEAK POSTMESSAGE API ---------- */

  // Get stable iframe id for a video
  const getPlayerId = useCallback((video) => `player-${video?.id}`, []);

  // Send command to a specific video's iframe
  const sendCommandToVideo = useCallback((video, command, data = {}) => {
    if (!video) return;
    const iframe = iframeRefs.current[video.id];
    if (iframe?.contentWindow) {
      console.log(`[VideoShort] Sending "${command}" to video ${video.id}`);
      iframe.contentWindow.postMessage({ type: command, ...data }, '*');
    } else {
      console.log(`[VideoShort] No iframe found for video ${video.id}`);
    }
  }, []);

  // Send command to current video
  const sendCommand = useCallback((command, data = {}) => {
    const currentVid = videos[currentIndex];
    sendCommandToVideo(currentVid, command, data);
  }, [videos, currentIndex, sendCommandToVideo]);

  // Play an iframe with correct mute state.
  // mute=1 in URL doesn't survive player.load() after user activation,
  // so we always explicitly sync mute state via postMessage before playing.
  // Play an iframe with correct mute state.
  // Sends mute/unmute before play so the player's intendedMuted flag is set correctly.
  const playIframeWithMuteSync = useCallback((iframe) => {
    if (!iframe?.contentWindow) return;
    const muteCmd = isMutedRef.current ? 'mute' : 'unmute';
    iframe.contentWindow.postMessage({ type: muteCmd }, '*');
    iframe.contentWindow.postMessage({ type: 'play' }, '*');
  }, []);

  const togglePlayPause = useCallback(() => {
    sendCommand('toggle-play');
    setShowPlayPauseIcon(true);
    if (playPauseTimeoutRef.current) clearTimeout(playPauseTimeoutRef.current);
    playPauseTimeoutRef.current = setTimeout(() => setShowPlayPauseIcon(false), 500);
  }, [sendCommand]);

  // Toggle mute: only send to current (active) iframe — background iframes ignore postMessage.
  // Other iframes get mute synced when they become current via playIframeWithMuteSync.
  const toggleMute = useCallback(() => {
    const newMuted = !isMuted;
    const command = newMuted ? 'mute' : 'unmute';
    // Only the current iframe is active and will receive this
    sendCommand(command);
    setIsMuted(newMuted);
    isMutedRef.current = newMuted;
    document.cookie = `shorts_muted=${newMuted ? '1' : '0'}; path=/; max-age=${365 * 24 * 3600}`;
    // Show mute/unmute icon feedback
    setShowMuteIcon(true);
    if (muteIconTimeoutRef.current) clearTimeout(muteIconTimeoutRef.current);
    muteIconTimeoutRef.current = setTimeout(() => setShowMuteIcon(false), 600);
  }, [isMuted, sendCommand]);

  // Pause video while vote popup is open, resume when it closes (only if was playing)
  useEffect(() => {
    if (showTooltip) {
      wasPlayingBeforePopupRef.current = isPlaying;
      if (isPlaying) sendCommand('pause');
    } else {
      if (wasPlayingBeforePopupRef.current) {
        sendCommand('play');
        wasPlayingBeforePopupRef.current = false;
      }
    }
  }, [showTooltip]); // eslint-disable-line react-hooks/exhaustive-deps

  // Quick upvote via double-tap — opens vote popup (same as sidebar heart button)
  const quickUpvote = useCallback(() => {
    const video = videos[currentIndex];
    if (!video) return;
    // Open the vote tooltip (same as clicking the heart in the sidebar)
    if (!authenticated) {
      toast.error('Login to vote');
      return;
    }
    setSelectedComment({ author: video.author, permlink: video.hivePermlink });
    setShowTooltip(true);
    setActiveTooltipPermlink(video.hivePermlink);
  }, [videos, currentIndex, authenticated]);

  // Desktop mouse handlers: mouseDown starts a long-press timer (mute/unmute), mouseUp cancels it,
  // click fires the single/double-click gesture (play/pause or upvote).
  // Touch devices suppress click via e.preventDefault() in onTouchEnd, so no double-fire.
  const handleOverlayMouseDown = useCallback((e) => {
    if (showComments) return;
    mouseLongPressHandledRef.current = false;
    mouseLongPressRef.current = setTimeout(() => {
      mouseLongPressHandledRef.current = true;
      toggleMute();
    }, 700); // Longer threshold for mouse (700ms vs 500ms touch)
  }, [showComments, toggleMute]);

  const handleOverlayMouseUp = useCallback(() => {
    if (mouseLongPressRef.current) {
      clearTimeout(mouseLongPressRef.current);
      mouseLongPressRef.current = null;
    }
  }, []);

  const handleOverlayClick = useCallback((e) => {
    e.stopPropagation();
    // Skip click if it was synthesized from a recent touch (touch handler already processed it)
    if (recentTouchRef.current) return;
    if (showComments || mouseLongPressHandledRef.current) return;

    tapCountRef.current += 1;
    if (tapCountRef.current === 1) {
      tapTimerRef.current = setTimeout(() => {
        if (tapCountRef.current === 1) {
          togglePlayPause();
        }
        tapCountRef.current = 0;
      }, 300);
    } else if (tapCountRef.current >= 2) {
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      tapCountRef.current = 0;
      quickUpvote();
    }
  }, [showComments, togglePlayPause, quickUpvote]);

  const seekTo = useCallback((time) => {
    sendCommand('seek', { time });
  }, [sendCommand]);

  const handleProgressBarInteraction = useCallback((e) => {
    if (!progressBarRef.current || durationRef.current === 0) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percentage * durationRef.current;

    seekTo(newTime);
    currentTimeRef.current = newTime;
    updateProgressBar();
  }, [seekTo, updateProgressBar]);

  const handleProgressMouseDown = useCallback((e) => {
    e.stopPropagation();
    setIsScrubbing(true);
    handleProgressBarInteraction(e);
  }, [handleProgressBarInteraction]);

  const handleProgressMouseMove = useCallback((e) => {
    if (!isScrubbing) return;
    handleProgressBarInteraction(e);
  }, [isScrubbing, handleProgressBarInteraction]);

  const handleProgressMouseUp = useCallback(() => {
    setIsScrubbing(false);
  }, []);

  // Global mouse listeners for scrubbing
  useEffect(() => {
    if (isScrubbing) {
      window.addEventListener('mouseup', handleProgressMouseUp);
      window.addEventListener('mousemove', handleProgressMouseMove);
      return () => {
        window.removeEventListener('mouseup', handleProgressMouseUp);
        window.removeEventListener('mousemove', handleProgressMouseMove);
      };
    }
  }, [isScrubbing, handleProgressMouseUp, handleProgressMouseMove]);

  // Listen for messages from iframe player
  useEffect(() => {
    const handleMessage = (event) => {
      const data = event.data;
      if (!data || !data.type) return;

      // Find which iframe sent this message
      let sourceVideoId = null;
      for (const [videoId, iframe] of Object.entries(iframeRefs.current)) {
        if (iframe?.contentWindow === event.source) {
          sourceVideoId = videoId;
          break;
        }
      }

      const currentVid = videos[currentIndex];
      const isFromCurrentVideo = currentVid && sourceVideoId === currentVid.id;

      switch (data.type) {
        case '3speak-player-ready':
          console.log(`[VideoShort] Player ready for video: ${sourceVideoId}, current: ${currentVid?.id}`);
          
          // Mark this player as ready
          if (sourceVideoId) {
            readyPlayers.current.add(sourceVideoId);
            setReadyPlayerIds(prev => {
              if (prev.has(sourceVideoId)) return prev;
              const next = new Set(prev);
              next.add(sourceVideoId);
              return next;
            });
            // Dismiss the initial "Loading shorts..." overlay once any player is ready
            setFirstPlayerReady(true);
          }
          
          // Apply orientation styles to the source iframe
          const sourceIframe = sourceVideoId ? iframeRefs.current[sourceVideoId] : null;
          if (sourceIframe && data.isVertical !== undefined) {
            if (data.isVertical) {
              sourceIframe.style.position = 'absolute';
              sourceIframe.style.top = '0';
              sourceIframe.style.left = '50%';
              sourceIframe.style.transform = 'translateX(-50%)';
              sourceIframe.style.width = 'auto';
              sourceIframe.style.height = '100%';
              sourceIframe.style.aspectRatio = '9 / 16';
            } else {
              sourceIframe.style.position = 'absolute';
              sourceIframe.style.top = '50%';
              sourceIframe.style.left = '0';
              sourceIframe.style.transform = 'translateY(-50%)';
              sourceIframe.style.width = '100%';
              sourceIframe.style.height = 'auto';
              sourceIframe.style.aspectRatio = '16 / 9';
            }
          }

          // If this is the current video (or pending), sync mute + play.
          // Background iframes ignore postMessage, so we only sync when becoming current.
          if (isFromCurrentVideo || pendingPlayRef.current === sourceVideoId) {
            console.log(`[VideoShort] Player ready - now playing: ${sourceVideoId}`);
            pendingPlayRef.current = null;
            setTimeout(() => playIframeWithMuteSync(sourceIframe), 50);
          }
          break;

        case '3speak-timeupdate':
          // Only update if from current video — use refs (not state) to avoid re-renders
          if (isFromCurrentVideo && !isScrubbing && data.duration > 0) {
            currentTimeRef.current = data.currentTime || 0;
            durationRef.current = data.duration;
            updateProgressBar(); // Direct DOM update, no React re-render
            if (data.paused !== undefined) {
              setIsPlaying(!data.paused);
            }
            // NOTE: We intentionally do NOT sync muted state from the player.
            // Our React state (isMuted / isMutedRef) is the source of truth.
            // Looping is handled natively by the player via loop=1 param.
          }
          break;

        case '3speak-durationchange':
          if (isFromCurrentVideo) {
            durationRef.current = data.duration || 0;
          }
          break;

        case '3speak-play':
          if (isFromCurrentVideo) {
            setIsPlaying(true);
          }
          break;

        case '3speak-pause':
          if (isFromCurrentVideo) {
            setIsPlaying(false);
          }
          break;

        case '3speak-ended':
          // Looping is handled natively by the player via loop=1 param.
          // The player should not fire this event when loop=1 is set,
          // but if it does, no action needed.
          break;

        case '3speak-state':
          console.log(`[MuteSync] STATE from ${sourceVideoId}: muted=${data.muted}, intendedMuted=${data.intendedMuted}, paused=${data.paused}, volume=${data.volume}`);
          break;

        case '3speak-volumechange':
          console.log(`[MuteSync] VOLUMECHANGE from ${sourceVideoId}: muted=${data.muted}, volume=${data.volume}`);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isScrubbing, videos, currentIndex]);

  // Handle video change - pause previous, play current
  // Only react to actual index changes (not videos enrichment re-renders)
  useEffect(() => {
    const currentVid = videos[currentIndex];
    if (!currentVid) return;

    // Skip if index hasn't actually changed (e.g. videos array updated by enrichment)
    if (prevIndexRef.current === currentIndex && currentVid.id === prevVideoIdRef.current) return;

    const prevIndex = prevIndexRef.current;
    const prevVid = videos[prevIndex];

    console.log(`[VideoShort] Index changed: ${prevIndex} -> ${currentIndex}, video: ${currentVid.id}`);

    // Always clear pending play from previous navigation
    pendingPlayRef.current = null;

    // Update URL with current video (without page reload)
    updateUrlWithCurrentVideo(currentVid);

    // Reset player state
    setIsPlaying(false);
    currentTimeRef.current = 0;
    durationRef.current = 0;
    updateProgressBar();
    setParentCardVisible(true);
    setCaptionExpanded(false);

    // Pause ALL other players (not just previous) to free up connections on mobile
    Object.entries(iframeRefs.current).forEach(([id, iframe]) => {
      if (id !== currentVid.id && iframe?.contentWindow) {
        try {
          iframe.contentWindow.postMessage({ type: 'pause' }, '*');
        } catch (e) { /* ignore */ }
      }
    });

    // Update tracking refs
    prevIndexRef.current = currentIndex;
    prevVideoIdRef.current = currentVid.id;

    // Check if the player is already ready
    const isPlayerReady = readyPlayers.current.has(currentVid.id);
    console.log(`[VideoShort] Player ready status for ${currentVid.id}: ${isPlayerReady}`);

    if (isPlayerReady) {
      // Player is ready, play immediately (small delay for DOM to settle)
      const iframe = iframeRefs.current[currentVid.id];
      if (iframe?.contentWindow) {
        console.log(`[VideoShort] Playing immediately (player ready): ${currentVid.id}`);
        setTimeout(() => playIframeWithMuteSync(iframe), 50);
      }
    } else {
      // Player not ready yet, set as pending and wait for 3speak-player-ready
      console.log(`[VideoShort] Player not ready, setting pending play: ${currentVid.id}`);
      pendingPlayRef.current = currentVid.id;

      // Also set up a fallback with retries in case the ready event was missed
      const timeouts = [];
      const playIfReady = (attempt) => {
        // Check if still the current video and still pending
        if (pendingPlayRef.current !== currentVid.id) {
          console.log(`[VideoShort] Skipping retry - no longer pending: ${currentVid.id}`);
          return;
        }

        // Check if player became ready
        if (readyPlayers.current.has(currentVid.id)) {
          const iframe = iframeRefs.current[currentVid.id];
          if (iframe?.contentWindow) {
            console.log(`[VideoShort] Playing on retry ${attempt} (player now ready): ${currentVid.id}`);
            pendingPlayRef.current = null;
            playIframeWithMuteSync(iframe);
          }
        } else {
          console.log(`[VideoShort] Retry ${attempt}: Player still not ready: ${currentVid.id}`);
        }
      };

      // Retry at longer intervals to catch late ready events
      [500, 1000, 1500, 2000, 3000, 4000, 5000].forEach((delay, idx) => {
        const timeout = setTimeout(() => playIfReady(idx + 1), delay);
        timeouts.push(timeout);
      });

      // Cleanup
      return () => {
        timeouts.forEach(t => clearTimeout(t));
      };
    }
  }, [currentIndex, videos, sendCommandToVideo]);

  // Force-show fallback: if the player hasn't sent ready after 6s, show it anyway and try playing
  useEffect(() => {
    const currentVid = videos[currentIndex];
    if (!currentVid || readyPlayers.current.has(currentVid.id)) return;

    const timer = setTimeout(() => {
      if (!readyPlayers.current.has(currentVid.id)) {
        console.log(`[VideoShort] Force-showing player after timeout: ${currentVid.id}`);
        readyPlayers.current.add(currentVid.id);
        setReadyPlayerIds(prev => {
          const next = new Set(prev);
          next.add(currentVid.id);
          return next;
        });
        setFirstPlayerReady(true);
        // Try playing — the iframe may be functional, just didn't fire the ready event
        const iframe = iframeRefs.current[currentVid.id];
        playIframeWithMuteSync(iframe);
      }
    }, 6000);

    return () => clearTimeout(timer);
  }, [currentIndex, videos]);

  // Lazy enrichment: when a short becomes visible and hasn't been enriched yet,
  // fetch full Hive data (vote status, reaction chain, child reactions) in background
  useEffect(() => {
    const currentVid = videos[currentIndex];
    if (!currentVid || currentVid._enriched !== false) return;

    // Mark as enriching to prevent duplicate calls
    setVideos(prev => prev.map((v, i) => i === currentIndex ? { ...v, _enriched: 'loading' } : v));

    const videoId = currentVid.id;
    (async () => {
      try {
        const shortItem = {
          owner: currentVid.author,
          permlink: currentVid.permlink,
          embed_url: currentVid.embedUrl || `@${currentVid.author}/${currentVid.hivePermlink}`,
          thumbnail_url: currentVid.thumbnailUrl || '',
          views: currentVid.stats?.views || currentVid.views || 0,
          createdAt: currentVid.createdAt || '',
          embed_title: currentVid.caption || '',
        };
        const enriched = await hiveApi.fetchCompleteShortData(shortItem, user);

        setVideos(prev => prev.map(v => {
          if (v.id !== videoId) return v;
          return {
            ...v,
            isLiked: enriched.isLiked || false,
            isDisliked: enriched.isDisliked || false,
            parentVideo: enriched.parentVideo || null,
            parentTimestamp: enriched.parentTimestamp || null,
            parentComment: enriched.parentComment || null,
            parentShort: enriched.parentShort || null,
            reactionChain: enriched.reactionChain || null,
            childReactions: enriched.childReactions || null,
            _enriched: true,
          };
        }));
      } catch (err) {
        console.warn('Failed to enrich short:', err);
        setVideos(prev => prev.map(v => v.id === videoId ? { ...v, _enriched: true } : v));
      }
    })();
  }, [currentIndex, videos, user]);

  // Cleanup on unmount — preload fresh shorts for the next visit
  useEffect(() => {
    return () => {
      if (playPauseTimeoutRef.current) {
        clearTimeout(playPauseTimeoutRef.current);
      }
      preloadShorts(10);
    };
  }, []);

  /* ---------- FETCH SHORTS DATA ---------- */
  useEffect(() => {
    const formatShorts = (shorts) => shorts.map(short => ({
      id: short.id,
      author: short.author,
      permlink: short.permlink,
      hivePermlink: short.hivePermlink,
      embedUrl: short.embedUrl || null,
      thumbnailUrl: short.thumbnailUrl || null,
      user: {
        username: short.user.username,
        avatar: short.user.avatar,
        isSubscribed: false,
        followersCount: short.user.followersCount ?? null,
        reputation: short.user.reputation ?? null,
      },
      caption: short.caption || short.title || '',
      tags: short.tags || [],
      audio: `${short.user.username} - Original Audio`,
      albumArt: short.user.avatar,
      stats: {
        likes: short.stats.likes,
        dislikes: short.stats.dislikes,
        comments: short.stats.comments,
        shares: short.stats.shares,
        remixes: short.stats.remixes,
        views: short.views || short.stats.views || 0,
        payout: short.stats.payout
      },
      isLiked: short.isLiked || false,
      isDisliked: short.isDisliked || false,
      comments: [],
      commentsLoaded: false,
      timeAgo: short.timeAgo,
      createdAt: short.createdAt,
      parentVideo: short.parentVideo || null,
      parentTimestamp: short.parentTimestamp || null,
      parentComment: short.parentComment || null,
      parentShort: short.parentShort || null,
      reactionChain: short.reactionChain || null,
      childReactions: short.childReactions || null,
      _enriched: short._enriched != null ? short._enriched : true,
    }));

    const applySharedVideoLogic = async (formattedVideos, data) => {
      const sharedVideo = getSharedVideoFromUrl();

      if (sharedVideo) {
        const sharedIndex = formattedVideos.findIndex(
          v => v.author === sharedVideo.author && v.permlink === sharedVideo.permlink
        );

        if (sharedIndex !== -1) {
          setVideos(formattedVideos);
          setCurrentIndex(sharedIndex);
        } else {
          try {
            const actualShort = await hiveApi.findShortByPermlink(sharedVideo.permlink);
            const shortItem = actualShort || {
              owner: sharedVideo.author,
              permlink: sharedVideo.permlink,
              embed_url: `@${sharedVideo.author}/${sharedVideo.permlink}`,
              thumbnail_url: '',
              views: 0,
              createdAt: new Date().toISOString(),
              embed_title: ''
            };

            const sharedVideoData = await hiveApi.fetchCompleteShortData(shortItem, user);
            const formattedSharedVideo = {
              id: sharedVideoData.id,
              author: sharedVideoData.author,
              permlink: sharedVideoData.permlink,
              hivePermlink: sharedVideoData.hivePermlink,
              user: sharedVideoData.user,
              caption: sharedVideoData.caption || sharedVideoData.title || '',
              audio: `${sharedVideoData.user.username} - Original Audio`,
              albumArt: sharedVideoData.user.avatar,
              stats: sharedVideoData.stats,
              isLiked: sharedVideoData.isLiked || false,
              isDisliked: sharedVideoData.isDisliked || false,
              comments: [],
              commentsLoaded: false,
              timeAgo: sharedVideoData.timeAgo,
              createdAt: sharedVideoData.createdAt,
              parentVideo: sharedVideoData.parentVideo || null,
              parentTimestamp: sharedVideoData.parentTimestamp || null,
              parentComment: sharedVideoData.parentComment || null,
              parentShort: sharedVideoData.parentShort || null,
              reactionChain: sharedVideoData.reactionChain || null,
              childReactions: sharedVideoData.childReactions || null,
            };

            setVideos([formattedSharedVideo, ...formattedVideos]);
            setCurrentIndex(0);
          } catch (err) {
            console.warn('Could not fetch shared video, showing feed from start:', err);
            setVideos(formattedVideos);
            if (formattedVideos.length > 0) {
              updateUrlWithCurrentVideo(formattedVideos[0]);
            }
          }
        }
      } else {
        setVideos(formattedVideos);
        if (formattedVideos.length > 0) {
          updateUrlWithCurrentVideo(formattedVideos[0]);
        }
      }

      setHasMore(1 < data.totalPages);
    };

    const fetchShorts = async () => {
      try {
        setError(null);

        // User-specific feed mode: skip preloading, fetch directly from user endpoint
        if (feedUser) {
          setLoading(true);
          const data = await fetchUserShortsWithDetails(feedUser, 1, 20);
          if (data.success) {
            const formattedVideos = formatShorts(data.shorts);
            await applySharedVideoLogic(formattedVideos, data);
          }
        } else {
          // Default global feed
          // Try preloaded data first (already fetched when the app loaded)
          if (!hasShortsPreloaded()) {
            setLoading(true);
          }

          const preloaded = await consumePreloadedShorts();
          if (preloaded?.success) {
            const formattedVideos = formatShorts(preloaded.shorts);
            await applySharedVideoLogic(formattedVideos, preloaded);
            setLoading(false);
            return;
          }

          // No preload available — generate a fresh seed and fetch
          setLoading(true);
          regenerateShortsSeed();
          const data = await hiveApi.fetchShortsWithDetails(1, 10, user);

          if (data.success) {
            const formattedVideos = formatShorts(data.shorts);
            await applySharedVideoLogic(formattedVideos, data);
          }
        }
      } catch (err) {
        console.error('Error fetching shorts:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchShorts();
  }, [user, feedUser, getSharedVideoFromUrl, updateUrlWithCurrentVideo]);

  /* ---------- HANDLE IN-PAGE NAVIGATION TO A SHORT ---------- */
  // When location.search changes (e.g. clicking "View parent reaction"),
  // jump to or load the target short without re-fetching the entire feed.
  const prevSearchRef = useRef(location.search);
  useEffect(() => {
    if (location.search === prevSearchRef.current) return;
    prevSearchRef.current = location.search;

    // Only act if we already have videos loaded
    if (videos.length === 0) return;

    const params = new URLSearchParams(location.search);
    const videoParam = params.get('v');
    if (!videoParam) return;

    const [targetAuthor, targetPermlink] = videoParam.split('/');
    if (!targetAuthor || !targetPermlink) return;

    // Save current short to history stack for back navigation (skip when navigating back)
    if (isNavigatingBackRef.current) {
      isNavigatingBackRef.current = false;
    } else {
      const currentVid = videos[currentIndex];
      if (currentVid) {
        shortHistoryRef.current = [...shortHistoryRef.current, { author: currentVid.author, permlink: currentVid.permlink }];
      }
    }

    // Check if it's already in the feed
    const existingIdx = videos.findIndex(
      v => v.author === targetAuthor && v.permlink === targetPermlink
    );

    if (existingIdx !== -1) {
      setCurrentIndex(existingIdx);
      return;
    }

    // Check chain preload data for instant switch (iframe already warm)
    const preloadKey = `${targetAuthor}-${targetPermlink}`;
    const chainData = chainPreloadDataRef.current.get(preloadKey);

    if (chainData) {
      // Instant switch — create minimal entry, iframe is already loaded
      const formatted = {
        id: preloadKey,
        author: chainData.author,
        permlink: chainData.permlink,
        hivePermlink: chainData.hivePermlink,
        user: {
          username: `@${chainData.author}`,
          avatar: `https://images.hive.blog/u/${chainData.author}/avatar`,
          isSubscribed: false,
        },
        caption: chainData.title || '',
        audio: `@${chainData.author} - Original Audio`,
        albumArt: `https://images.hive.blog/u/${chainData.author}/avatar`,
        stats: { likes: 0, dislikes: 0, comments: 0, shares: 0, remixes: 0, views: 0, payout: '0.00' },
        isLiked: false,
        isDisliked: false,
        comments: [],
        commentsLoaded: false,
        timeAgo: '',
        createdAt: '',
        parentVideo: null,
        parentTimestamp: null,
        parentComment: null,
        parentShort: null,
        reactionChain: null,
        childReactions: null,
      };

      setVideos(prev => [formatted, ...prev]);
      setCurrentIndex(0);

      // Enrich with full data in background
      (async () => {
        try {
          const shortItem = {
            owner: chainData.author,
            permlink: chainData.permlink,
            embed_url: `@${chainData.author}/${chainData.hivePermlink}`,
            thumbnail_url: chainData.thumbnail || '',
            views: 0,
            createdAt: '',
            embed_title: chainData.title || '',
          };
          const shortData = await hiveApi.fetchCompleteShortData(shortItem, user);
          setVideos(prev => prev.map(v => {
            if (v.id !== preloadKey) return v;
            return {
              id: shortData.id,
              author: shortData.author,
              permlink: shortData.permlink,
              hivePermlink: shortData.hivePermlink,
              user: shortData.user,
              caption: shortData.caption || shortData.title || '',
              audio: `${shortData.user.username} - Original Audio`,
              albumArt: shortData.user.avatar,
              stats: shortData.stats,
              isLiked: shortData.isLiked || false,
              isDisliked: shortData.isDisliked || false,
              comments: v.comments,
              commentsLoaded: v.commentsLoaded,
              timeAgo: shortData.timeAgo,
              createdAt: shortData.createdAt,
              parentVideo: shortData.parentVideo || null,
              parentTimestamp: shortData.parentTimestamp || null,
              parentComment: shortData.parentComment || null,
              parentShort: shortData.parentShort || null,
              reactionChain: shortData.reactionChain || null,
              childReactions: shortData.childReactions || null,
            };
          }));
        } catch (err) {
          console.warn('Failed to enrich chain preload:', err);
        }
      })();
      return;
    }

    // Not in feed — fetch and prepend it
    setShortNavLoading(true);
    (async () => {
      try {
        const shortEntry = await hiveApi.findShortByPermlink(targetPermlink);
        const shortItem = shortEntry || {
          owner: targetAuthor,
          permlink: targetPermlink,
          embed_url: `@${targetAuthor}/${targetPermlink}`,
          thumbnail_url: '',
          views: 0,
          createdAt: new Date().toISOString(),
          embed_title: '',
        };

        const shortData = await hiveApi.fetchCompleteShortData(shortItem, user);

        const formatted = {
          id: shortData.id,
          author: shortData.author,
          permlink: shortData.permlink,
          hivePermlink: shortData.hivePermlink,
          user: shortData.user,
          caption: shortData.caption || shortData.title || '',
          audio: `${shortData.user.username} - Original Audio`,
          albumArt: shortData.user.avatar,
          stats: shortData.stats,
          isLiked: shortData.isLiked || false,
          isDisliked: shortData.isDisliked || false,
          comments: [],
          commentsLoaded: false,
          timeAgo: shortData.timeAgo,
          createdAt: shortData.createdAt,
          parentVideo: shortData.parentVideo || null,
          parentTimestamp: shortData.parentTimestamp || null,
          parentComment: shortData.parentComment || null,
          parentShort: shortData.parentShort || null,
          reactionChain: shortData.reactionChain || null,
          childReactions: shortData.childReactions || null,
        };

        setVideos(prev => [formatted, ...prev]);
        setCurrentIndex(0);
      } catch (err) {
        console.warn('Could not navigate to parent short:', err);
      } finally {
        setShortNavLoading(false);
      }
    })();
  }, [location.search, videos, user]);

  /* ---------- LOAD MORE VIDEOS ---------- */
  const loadMoreVideos = useCallback(async () => {
    if (!hasMore || loadingMoreRef.current) return;
    loadingMoreRef.current = true;

    const nextPage = page + 1;
    setPage(nextPage);

    try {
      const data = feedUserRef.current
        ? await fetchUserShortsWithDetails(feedUserRef.current, nextPage, 20)
        : await hiveApi.fetchShortsWithDetails(nextPage, 20, user);

      if (data.success) {
        const formattedVideos = data.shorts.map(short => ({
          id: short.id,
          author: short.author,
          permlink: short.permlink,
          hivePermlink: short.hivePermlink,
          embedUrl: short.embedUrl || null,
          thumbnailUrl: short.thumbnailUrl || null,
          user: {
            username: short.user.username,
            avatar: short.user.avatar,
            isSubscribed: false,
            followersCount: short.user.followersCount ?? null,
            reputation: short.user.reputation ?? null,
          },
          caption: short.caption || short.title || '',
          tags: short.tags || [],
          audio: `${short.user.username} - Original Audio`,
          albumArt: short.user.avatar,
          stats: {
            likes: short.stats.likes,
            dislikes: short.stats.dislikes,
            comments: short.stats.comments,
            shares: short.stats.shares,
            remixes: short.stats.remixes,
            views: short.views || short.stats.views || 0,
            payout: short.stats.payout
          },
          isLiked: short.isLiked || false,
          isDisliked: short.isDisliked || false,
          comments: [],
          commentsLoaded: false,
          timeAgo: short.timeAgo,
          createdAt: short.createdAt,
          parentVideo: short.parentVideo || null,
          parentTimestamp: short.parentTimestamp || null,
          parentComment: short.parentComment || null,
          parentShort: short.parentShort || null,
          reactionChain: short.reactionChain || null,
          childReactions: short.childReactions || null,
          _enriched: short._enriched != null ? short._enriched : true,
        }));

        setVideos(prev => [...prev, ...formattedVideos]);
        setHasMore(nextPage < data.totalPages);
      }
    } catch (err) {
      console.error('Error loading more shorts:', err);
    } finally {
      loadingMoreRef.current = false;
    }
  }, [hasMore, page]);

  /* ---------- FETCH COMMENTS ---------- */
  const fetchComments = useCallback(async () => {
    const video = videos[currentIndex];
    if (!video || !video.hivePermlink || !video.author) return;

    if (commentsFetchedRef.current.has(video.id)) return;

    setCommentsLoading(true);
    commentsFetchedRef.current.add(video.id);

    try {
      const comments = await hiveApi.fetchPostComments(video.author, video.hivePermlink, user);

      // Pre-render comment bodies as HTML
      try {
        const render = await getRenderer();
        const rendered = {};
        const renderComment = (c) => {
          if (c?.body) {
            try { rendered[c.permlink] = render(c.body); } catch (_) {}
          }
          if (c.children) c.children.forEach(renderComment);
        };
        comments.forEach(renderComment);
        setRenderedBodies(prev => ({ ...prev, ...rendered }));
      } catch (_) {}

      setVideos(prev =>
        prev.map((v, idx) =>
          idx === currentIndex
            ? { ...v, comments, commentsLoaded: true }
            : v
        )
      );
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setCommentsLoading(false);
    }
  }, [currentIndex, videos]);

  // Fetch comments when panel opens
  useEffect(() => {
    if (showComments && videos[currentIndex] && !videos[currentIndex].commentsLoaded) {
      fetchComments();
    }
  }, [showComments, currentIndex, videos, fetchComments]);

  const currentVideo = videos[currentIndex];

  /* ---------- VOTE TOOLTIP ---------- */
  const toggleVoteTooltip = (author, permlink) => {
    // Require authentication before opening the vote tooltip
    if (!authenticated) {
      toast.error('Login to complete this operation');
      return;
    }

    setSelectedComment({ author, permlink });
    setShowTooltip(prev => !prev || activeTooltipPermlink !== permlink);
    setActiveTooltipPermlink(prev => (prev === permlink ? null : permlink));
  };

  /* ---------- POST COMMENT ---------- */
  const handlePostComment = async (parentAuthor, parentPermlink, commentText, isReply = false) => {
    if (!commentText.trim()) {
      toast.error('Please enter a comment');
      return;
    }

    if (!user) {
      toast.error('Please login to comment');
      return;
    }

    setPostingComment(true);

    try {
      const response = await axios.post(
        'https://studio.3speak.tv/mobile/comment',
        {
          author: parentAuthor,
          permlink: parentPermlink,
          comment: commentText,
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success) {
        toast.success('Comment posted successfully!');

        const newCommentObj = {
          id: `${user}-re-${parentPermlink}-${Date.now()}`,
          author: user,
          permlink: `re-${parentPermlink}-${Date.now()}`,
          body: commentText,
          createdAt: new Date().toISOString(),
          timeAgo: 'Just now',
          netVotes: 0,
          children: [],
          stats: {
            num_likes: 0,
            total_hive_reward: 0
          },
          user: {
            username: `@${user}`,
            avatar: `https://images.hive.blog/u/${user}/avatar`
          },
          has_voted: false
        };

        if (isReply) {
          // Add reply to the parent comment and increment comment count
          setVideos(prev =>
            prev.map((v, idx) => {
              if (idx !== currentIndex) return v;
              return {
                ...v,
                comments: addReplyToComment(v.comments, parentPermlink, newCommentObj),
                stats: { ...v.stats, comments: (v.stats.comments || 0) + 1 }
              };
            })
          );
          setReplyText('');
          setActiveReply(null);
        } else {
          // Add comment to the main video
          setVideos(prev =>
            prev.map((v, idx) => {
              if (idx !== currentIndex) return v;
              return {
                ...v,
                comments: [newCommentObj, ...v.comments],
                stats: { ...v.stats, comments: (v.stats.comments || 0) + 1 }
              };
            })
          );
          setNewComment('');
        }
      } else {
        toast.error(`Comment failed: ${response.data.message}`);
      }
    } catch (err) {
      console.error('Comment failed:', err);
      toast.error('Comment failed, please try again');
    } finally {
      setPostingComment(false);
    }
  };

  // Helper to add reply to nested comments
  const addReplyToComment = (comments, parentPermlink, newComment) => {
    return comments.map(comment => {
      if (comment.permlink === parentPermlink) {
        return {
          ...comment,
          children: [...(comment.children || []), newComment]
        };
      }
      if (comment.children && comment.children.length > 0) {
        return {
          ...comment,
          children: addReplyToComment(comment.children, parentPermlink, newComment)
        };
      }
      return comment;
    });
  };

  // Update comment list after vote (passed to CommentVoteTooltip)
  const setCommentList = (updateFn) => {
    setVideos(prev =>
      prev.map((v, idx) => {
        if (idx !== currentIndex) return v;
        return {
          ...v,
          comments: typeof updateFn === 'function' ? updateFn(v.comments) : updateFn
        };
      })
    );
  };

  // Update post (video) state after a vote on the main post
  const handlePostVoteSuccess = (author, permlink, isNewVote, voteWeight) => {
    // Show heart animation on confirmed vote
    setShowHeartAnimation(true);
    if (heartAnimTimeoutRef.current) clearTimeout(heartAnimTimeoutRef.current);
    heartAnimTimeoutRef.current = setTimeout(() => setShowHeartAnimation(false), 800);

    setVideos(prev => prev.map(v => {
      if (v.author === author && v.hivePermlink === permlink) {
        const newLikes = isNewVote
          ? (v.stats?.likes || 0) + 1
          : v.stats?.likes || 0;
        return {
          ...v,
          isLiked: true,
          stats: { ...v.stats, likes: newLikes }
        };
      }
      return v;
    }));
  };

  /* ---------- BACK NAVIGATION ---------- */
  const handleShortBack = useCallback(() => {
    const history = shortHistoryRef.current;
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    shortHistoryRef.current = history.slice(0, -1);
    isNavigatingBackRef.current = true;
    navigate(`/shorts?v=${prev.author}/${prev.permlink}`, { replace: true });
  }, [navigate]);

  /* ---------- SHARE FUNCTIONALITY ---------- */
  const handleShare = async () => {
    if (!currentVideo) return;

    // Use shorts route with video parameter
    const shareUrl = `${window.location.origin}/shorts?v=${currentVideo.author}/${currentVideo.permlink}`;
    const shareData = {
      title: currentVideo.caption || '3Speak Short',
      text: `Check out this short by ${currentVideo.user.username} on 3Speak!`,
      url: shareUrl
    };

    try {
      // Check if Web Share API is supported (mainly mobile)
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        toast.success('Shared successfully!');
      } else {
        // Fallback: Copy to clipboard
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied to clipboard!');
      }
    } catch (err) {
      // User cancelled share or error occurred
      if (err.name !== 'AbortError') {
        // Try clipboard as fallback
        try {
          await navigator.clipboard.writeText(shareUrl);
          toast.success('Link copied to clipboard!');
        } catch (clipboardErr) {
          console.error('Share failed:', err);
          toast.error('Failed to share');
        }
      }
    }
  };

  /* ---------- INTERACTIONS ---------- */

  const handleSubscribe = () => {
    setVideos(prev =>
      prev.map((video, idx) =>
        idx === currentIndex
          ? { ...video, user: { ...video.user, isSubscribed: !video.user.isSubscribed } }
          : video
      )
    );
  };

  const handleToggleComments = () => setShowComments(prev => !prev);

  // Mobile comments panel drag-to-close
  const handleCommentsDragStart = useCallback((e) => {
    commentsDragStartY.current = e.touches[0].clientY;
    const panel = commentsPanelRef.current;
    if (panel) panel.style.transition = 'none';
  }, []);

  const handleCommentsDragMove = useCallback((e) => {
    if (commentsDragStartY.current == null) return;
    const dy = e.touches[0].clientY - commentsDragStartY.current;
    const offset = Math.max(0, dy); // only allow dragging down
    const panel = commentsPanelRef.current;
    if (panel) panel.style.transform = `translateY(${offset}px)`;
  }, []);

  const handleCommentsDragEnd = useCallback((e) => {
    if (commentsDragStartY.current == null) return;
    const dy = e.changedTouches[0].clientY - commentsDragStartY.current;
    commentsDragStartY.current = null;
    const panel = commentsPanelRef.current;
    if (panel) panel.style.transition = '';
    if (dy > 80) {
      // Dragged down far enough — close
      setShowComments(false);
      if (panel) panel.style.transform = '';
    } else {
      // Snap back
      if (panel) panel.style.transform = '';
    }
  }, []);

  /* ---------- NAVIGATION ---------- */

  const triggerSwipeAnimation = (direction) => {
    if (swipeAnimRef.current) clearTimeout(swipeAnimRef.current);
    setSwipeDragY(0);
    setSwipeDirection(direction);
    swipeAnimRef.current = setTimeout(() => {
      setSwipeDirection(null);
      swipeAnimRef.current = null;
    }, 350);
  };

  // Find the nearest ready player index in a given direction, skipping up to `maxSkip` non-ready videos
  const findNextReady = (fromIdx, direction = 1, maxSkip = 2) => {
    let target = fromIdx + direction;
    if (readyPlayers.current.has(videos[target]?.id)) return target;
    for (let i = 1; i <= maxSkip; i++) {
      const candidate = target + i * direction;
      if (candidate < 0 || candidate >= videos.length) break;
      if (readyPlayers.current.has(videos[candidate]?.id)) return candidate;
    }
    return target; // fallback to immediate next (will show thumbnail)
  };

  const handlePrevious = () => {
    if (currentIndex === 0) return;
    shortHistoryRef.current = [];
    triggerSwipeAnimation('down');
    const prevIdx = findNextReady(currentIndex, -1);
    setCurrentIndex(Math.max(0, prevIdx));
  };

  const handleNext = async () => {
    if (currentIndex >= videos.length - 1) {
      if (hasMore && !loadingMoreRef.current) {
        await loadMoreVideos();
        triggerSwipeAnimation('up');
        setCurrentIndex(prev => prev + 1);
      }
      return;
    }
    shortHistoryRef.current = [];
    triggerSwipeAnimation('up');
    const nextIdx = findNextReady(currentIndex, 1);
    setCurrentIndex(Math.min(videos.length - 1, nextIdx));

    // Prefetch 7 items before the end of the current page
    if (nextIdx >= videos.length - 7 && hasMore) {
      loadMoreVideos();
    }
  };

  // Keyboard navigation: ArrowUp = previous, ArrowDown = next
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore when typing in inputs or when comments panel is open or transitioning
      const active = document.activeElement;
      const tag = active?.tagName;
      const isEditable = active?.isContentEditable;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || isEditable) return;
      if (showComments || isTransitioning) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handlePrevious();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        seekTo(Math.max(0, currentTimeRef.current - 5));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        seekTo(Math.min(durationRef.current, currentTimeRef.current + 5));
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === 'm' || e.key === 'M') {
        toggleMute();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrevious, seekTo, togglePlayPause, toggleMute, showComments, isTransitioning]);

  // Local handler for the hidden focusable element (helps capture on mobile)
  const handleKeyDownCapture = (e) => {
    const active = document.activeElement;
    const tag = active?.tagName;
    const isEditable = active?.isContentEditable;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || isEditable) return;
    if (showComments || isTransitioning) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleNext();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      handlePrevious();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      seekTo(Math.max(0, currentTimeRef.current - 5));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      seekTo(Math.min(durationRef.current, currentTimeRef.current + 5));
    } else if (e.key === ' ') {
      e.preventDefault();
      togglePlayPause();
    } else if (e.key === 'm' || e.key === 'M') {
      toggleMute();
    }
  };

  /* ---------- TOUCH/SWIPE HANDLERS FOR MOBILE ---------- */

  const onTouchStart = (e) => {
    // Don't handle swipe if comments panel is open
    if (showComments) return;
    setTouchEnd(null);
    const startY = e.targetTouches[0].clientY;
    setTouchStart(startY);
    touchStartYRef.current = startY; // Synchronous mirror for reliable gesture detection
    gestureHandledRef.current = false;
    // Start long-press timer (500ms)
    longPressTimerRef.current = setTimeout(() => {
      gestureHandledRef.current = true;
      toggleMute();
    }, 500);
    // attempt to focus the hidden keyboard capture so mobile hardware keyboards send events
    try {
      keyboardRef.current?.focus?.();
    } catch (err) {
      // ignore
    }
  };

  const onTouchMove = (e) => {
    if (showComments) return;
    const y = e.targetTouches[0].clientY;
    setTouchEnd(y);
    // Live drag: clamp to ±120px for visual feedback
    if (touchStart != null) {
      const delta = y - touchStart;
      setSwipeDragY(Math.max(-120, Math.min(120, delta)));
    }
    // Cancel long press if finger is moving
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const onTouchEnd = async (e) => {
    // Prevent browser from synthesizing a click event after touch
    if (e?.preventDefault) e.preventDefault();
    // Guard: mark recent touch so handleOverlayClick skips any synthetic click
    recentTouchRef.current = true;
    setTimeout(() => { recentTouchRef.current = false; }, 400);
    setSwipeDragY(0);
    // Cancel long-press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    // Compute swipe distance from refs/event (not state, which may be stale on fast swipes)
    const startY = touchStartYRef.current;
    const endY = e.changedTouches?.[0]?.clientY;
    const distance = startY != null && endY != null ? startY - endY : 0;
    const wasSwipe = Math.abs(distance) > minSwipeDistance;

    if (startY != null && endY != null && !showComments && !isTransitioning) {
      if (distance > minSwipeDistance && (currentIndex < videos.length - 1 || hasMore)) {
        setIsTransitioning(true);
        await handleNext();
        setTimeout(() => setIsTransitioning(false), 350);
      } else if (distance < -minSwipeDistance && currentIndex > 0) {
        setIsTransitioning(true);
        handlePrevious();
        setTimeout(() => setIsTransitioning(false), 350);
      }
    }

    // Reset touch state
    setTouchStart(null);
    setTouchEnd(null);
    touchStartYRef.current = null;

    // Gesture tap detection — only if it wasn't a swipe or long press
    if (wasSwipe || gestureHandledRef.current || showComments) return;

    tapCountRef.current += 1;
    if (tapCountRef.current === 1) {
      tapTimerRef.current = setTimeout(() => {
        if (tapCountRef.current === 1) {
          togglePlayPause();
        }
        tapCountRef.current = 0;
      }, 300);
    } else if (tapCountRef.current >= 2) {
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      tapCountRef.current = 0;
      quickUpvote();
    }
  };

  const formatNumber = (num) =>
    num >= 1000 ? (num / 1000).toFixed(1) + 'K' : num?.toString() || '0';

  const formatPayout = (payout) => {
    if (payout === null || payout === undefined) return '$0.00';
    const num = parseFloat(payout);
    if (isNaN(num)) return '$0.00';
    if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
    return `$${num.toFixed(2)}`;
  };

  // Calculate which videos to preload — memoized to prevent cleanup effect from running on every render
  const preloadedIndices = useMemo(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    const preloadRange = { before: 1, after: isMobile ? 4 : 4 };
    const indices = [];
    for (let i = Math.max(0, currentIndex - preloadRange.before); i <= Math.min(videos.length - 1, currentIndex + preloadRange.after); i++) {
      indices.push(i);
    }
    return indices;
  }, [currentIndex, videos.length]);

  // Store iframe ref
  const setIframeRef = useCallback((videoId, element) => {
    if (element) {
      iframeRefs.current[videoId] = element;
    }
  }, []);

  // Populate chain preload data for instant navigation
  useEffect(() => {
    const cv = videos[currentIndex];
    if (cv?.reactionChain) {
      for (const step of cv.reactionChain) {
        if (step.shortPermlink && !step.isRoot) {
          chainPreloadDataRef.current.set(`${step.author}-${step.shortPermlink}`, {
            author: step.author,
            permlink: step.shortPermlink,
            hivePermlink: step.permlink,
            title: step.title || '',
            thumbnail: step.thumbnail || null,
          });
        }
      }
    }
    if (cv?.childReactions) {
      for (const child of cv.childReactions) {
        if (child.shortPermlink) {
          chainPreloadDataRef.current.set(`${child.author}-${child.shortPermlink}`, {
            author: child.author,
            permlink: child.shortPermlink,
            hivePermlink: child.permlink,
            title: child.title || '',
            thumbnail: child.thumbnail || null,
          });
        }
      }
    }
  }, [videos, currentIndex]);

  // Compute chain preload entries for iframe pre-warming
  const chainPreloadEntries = useMemo(() => {
    const cv = videos[currentIndex];
    const entries = [];
    const seen = new Set(videos.map(v => v.id));

    if (cv?.reactionChain) {
      for (const step of cv.reactionChain) {
        if (step.shortPermlink && !step.isRoot) {
          const id = `${step.author}-${step.shortPermlink}`;
          if (!seen.has(id)) {
            seen.add(id);
            entries.push({ id, author: step.author, permlink: step.shortPermlink });
          }
        }
      }
    }
    if (cv?.childReactions) {
      for (const child of cv.childReactions) {
        if (child.shortPermlink) {
          const id = `${child.author}-${child.shortPermlink}`;
          if (!seen.has(id)) {
            seen.add(id);
            entries.push({ id, author: child.author, permlink: child.shortPermlink });
          }
        }
      }
    }

    return entries;
  }, [videos, currentIndex]);

  // Clean up old iframe refs that are no longer in preload range
  // IMPORTANT: pause players before removing them so HLS streams stop downloading
  useEffect(() => {
    const preloadedIds = new Set(preloadedIndices.map(idx => videos[idx]?.id).filter(Boolean));
    chainPreloadEntries.forEach(e => preloadedIds.add(e.id));
    const removedIds = [];
    Object.keys(iframeRefs.current).forEach(id => {
      if (!preloadedIds.has(id)) {
        // Pause the player to stop HLS stream download before removing
        const iframe = iframeRefs.current[id];
        if (iframe?.contentWindow) {
          try {
            iframe.contentWindow.postMessage({ type: 'pause' }, '*');
          } catch (e) { /* iframe may already be gone */ }
        }
        delete iframeRefs.current[id];
        readyPlayers.current.delete(id);
        removedIds.push(id);
      }
    });
    if (removedIds.length > 0) {
      setReadyPlayerIds(prev => {
        if (!removedIds.some(id => prev.has(id))) return prev;
        const next = new Set(prev);
        removedIds.forEach(id => next.delete(id));
        return next;
      });
    }
  }, [preloadedIndices, videos, chainPreloadEntries]);

  const handleProfileNavigation = (username) => {
    navigate(`/p/${username}`);
  };

  /* ---------- RENDER ---------- */

  if (loading && videos.length === 0) {
    return (
      <main className="short-main">
        <div className="loadingState">
          <Loader2 className="spinner" size={48} />
          <p>Loading shorts...</p>
        </div>
      </main>
    );
  }

  // Show "Loading shorts..." overlay until the first player is ready
  // (iframes render underneath so they can load in the background)
  const showInitialLoadingOverlay = !firstPlayerReady && videos.length > 0;

  if (error && videos.length === 0) {
    return (
      <main className="short-main">
        <div className="errorState">
          <p>Error loading shorts: {error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </main>
    );
  }

  if (!currentVideo) {
    return (
      <main className="short-main">
        <div className="emptyState">
          <p>No shorts available</p>
        </div>
      </main>
    );
  }

  return (
    <main className="short-main">
      <div
        tabIndex={0}
        ref={keyboardRef}
        onKeyDown={handleKeyDownCapture}
        className="keyboard-capture"
        aria-hidden="true"
      />
      <div className={`videoWrapper ${showComments ? 'with-comments' : ''}`}>

        {/* VIDEO */}
        <div
          className={`videoContainer${swipeDirection ? ` swipe-${swipeDirection}` : ''}`}
          ref={videoContainerRef}
          style={swipeDragY && !swipeDirection ? { transform: `translateY(${swipeDragY * 0.3}px)`, transition: 'none' } : undefined}
        >
          {/* Preloaded iframes for smooth playback */}
          {preloadedIndices.map((idx) => {
            const video = videos[idx];
            if (!video) return null;
            const isCurrent = idx === currentIndex;
            const isReady = readyPlayerIds.has(video.id);

            return (
              <iframe
                key={video.id}
                id={getPlayerId(video)}
                ref={(el) => setIframeRef(video.id, el)}
                src={`${PLAYER_URL}/embed?v=${video.author}/${video.permlink}&mode=iframe&controls=0&loop=1&mute=1`}
                width="100%"
                height="100%"
                frameBorder="0"
                allow="autoplay; fullscreen"
                allowFullScreen
                onLoad={(e) => {

                  iframeRefs.current[video.id] = e.target;
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  opacity: isCurrent && isReady ? 1 : 0,
                  pointerEvents: 'none',
                  zIndex: isCurrent ? 2 : 0,
                }}
              />
            );
          })}

          {/* Thumbnail placeholder while player initializes */}
          {currentVideo && !readyPlayerIds.has(currentVideo.id) && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#000',
              }}
            >
              {currentVideo.thumbnailUrl && (
                <img
                  src={currentVideo.thumbnailUrl}
                  alt=""
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                  }}
                />
              )}
              <Loader2 className="spinner" size={36} style={{ position: 'relative', zIndex: 2 }} />
            </div>
          )}

          {/* Full "Loading shorts..." overlay for the very first video until its player is ready */}
          {showInitialLoadingOverlay && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 10,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#000',
              }}
            >
              <Loader2 className="spinner" size={48} />
              <p style={{ color: '#fff', marginTop: 12 }}>Loading shorts...</p>
            </div>
          )}

          {/* Chain preload iframes — pre-warm players for instant navigation */}
          {chainPreloadEntries.map(entry => (
            <iframe
              key={entry.id}
              ref={(el) => setIframeRef(entry.id, el)}
              src={`${PLAYER_URL}/embed?v=${entry.author}/${entry.permlink}&mode=iframe&controls=0&loop=1&mute=1`}
              width="100%"
              height="100%"
              frameBorder="0"
              allow="autoplay; fullscreen"
              allowFullScreen
              onLoad={(e) => {
                // chain iframe loaded
                iframeRefs.current[entry.id] = e.target;
              }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                opacity: 0,
                pointerEvents: 'none',
                zIndex: 0,
              }}
            />
          ))}

          {/* Transparent overlay for gestures */}
          <div
            className="videoOverlay"
            onClick={handleOverlayClick}
            onMouseDown={handleOverlayMouseDown}
            onMouseUp={handleOverlayMouseUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {/* Play/Pause icon (long press feedback) */}
            <div className={`playPauseIcon ${showPlayPauseIcon ? 'visible' : ''}`}>
              {isPlaying ? <Pause size={48} /> : <Play size={48} />}
            </div>
            {/* Mute/Unmute icon (single tap feedback) */}
            <div className={`playPauseIcon ${showMuteIcon ? 'visible' : ''}`}>
              {isMuted ? <VolumeX size={48} /> : <Volume2 size={48} />}
            </div>
            {/* Heart animation (double tap feedback) */}
            <div className={`heartAnimation ${showHeartAnimation ? 'visible' : ''}`}>
              <Heart size={80} fill="#ff2d55" color="#ff2d55" />
            </div>
            {/* Mute/unmute toggle button */}
            <div className="muteIndicator"
              onClick={(e) => { e.stopPropagation(); toggleMute(); }}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); toggleMute(); }}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </div>
          </div>

          {/* Progress bar */}
          <div
            className="videoProgressBar"
            ref={progressBarRef}
            onMouseDown={handleProgressMouseDown}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="videoProgressFill" ref={progressFillRef} style={{ width: '0%' }} />
            <div className="videoProgressHandle" ref={progressHandleRef} style={{ left: '0%' }} />
          </div>

          {/* Loading overlay for short navigation */}
          {shortNavLoading && (
            <div className="shortNavLoadingOverlay" onClick={(e) => e.stopPropagation()}>
              <Loader2 size={28} className="spinner" />
            </div>
          )}

          {/* Back button (visible after navigating to a parent short) */}
          {shortHistoryRef.current.length > 0 && (
            <button className="shortBackBtn" onClick={(e) => { e.stopPropagation(); handleShortBack(); }}>
              <ArrowLeft size={18} />
              <span>Back</span>
            </button>
          )}

          {/* Reaction chain overlay (for reactions) */}
          {currentVideo.reactionChain && currentVideo.reactionChain.length > 0 && (() => {
            const rootStep = currentVideo.reactionChain.find(s => s.isRoot);
            const childSteps = currentVideo.reactionChain.filter(s => !s.isRoot);
            const rootUrl = rootStep ? `/watch?v=${rootStep.author}/${rootStep.permlink}${currentVideo.parentTimestamp != null ? `&t=${currentVideo.parentTimestamp}` : ''}` : null;
            return (
              <div className={`reactionChainOverlay${parentCardVisible ? '' : ' collapsed'}${shortHistoryRef.current.length > 0 ? ' has-back' : ''}`} onClick={(e) => e.stopPropagation()}>
                {parentCardVisible && (
                  <div className="reactionChainBreadcrumb">
                    {/* Root / origin card — 50% wide, thumb left + info right */}
                    {rootStep && (
                      <div className="chainRoot">
                        {rootStep.thumbnail && (
                          <img className="chainRootThumb" src={fixVideoThumbnail({ thumbnail: rootStep.thumbnail })} alt="" />
                        )}
                        <div className="chainRootInfo">
                          <span className="chainRootTitle">{rootStep.title || 'Original video'}</span>
                          <div className="chainRootMeta">
                            <AuthorBadge author={rootStep.author} compact noLink />
                            {currentVideo.parentTimestamp != null && (
                              <span className="chainRootTimestamp">
                                {Math.floor(currentVideo.parentTimestamp / 60)}:{(currentVideo.parentTimestamp % 60).toString().padStart(2, '0')}
                              </span>
                            )}
                          </div>
                        </div>
                        <Link to={rootUrl} className="chainActionBtn" onClick={(e) => e.stopPropagation()} title="Watch">
                          <Video size={14} />
                        </Link>
                      </div>
                    )}

                    {/* Child steps — horizontal scroll row */}
                    {childSteps.length > 0 && (
                      <div className="chainChildRow">
                        {childSteps.map((step, i) => {
                          const isExpanded = expandedChainCard === i;
                          return (
                            <React.Fragment key={i}>
                              {i > 0 && <span className="chainDash">&mdash;</span>}
                              <div
                                className={`chainChild${isExpanded ? ' chainChild--expanded' : ''}${step.type === 'video' ? ' chainChild--video' : ' chainChild--comment'}`}
                                onClick={() => setExpandedChainCard(isExpanded ? null : i)}
                              >
                                <div className="chainChildHeader">
                                  <AuthorBadge author={step.author} compact noLink />
                                  {step.type === 'video' && (
                                    step.shortPermlink ? (
                                      <Link to={`/shorts?v=${step.author}/${step.shortPermlink}`} className="chainActionBtn chainActionBtn--sm" onClick={(e) => e.stopPropagation()} title="Open short">
                                        <Camera size={11} />
                                      </Link>
                                    ) : (
                                      <Link to={`/watch?v=${step.author}/${step.permlink}`} className="chainActionBtn chainActionBtn--sm" onClick={(e) => e.stopPropagation()} title="Watch">
                                        <Video size={11} />
                                      </Link>
                                    )
                                  )}
                                </div>
                                <span className={`chainChildTitle${isExpanded ? ' chainChildTitle--full' : ''}`}>
                                  {step.title || (step.type === 'comment' ? 'Comment' : 'Reaction')}
                                </span>
                                {isExpanded && step.body && (
                                  <p className="chainChildText">{step.body}</p>
                                )}
                                {step.duration > 0 && (
                                  <span className="chainChildDuration">
                                    {Math.floor(step.duration / 60)}:{Math.floor(step.duration % 60).toString().padStart(2, '0')}
                                  </span>
                                )}
                              </div>
                            </React.Fragment>
                          );
                        })}
                        <span className="chainDash">&mdash;</span>
                        {(() => {
                          const currentIdx = childSteps.length;
                          const isCurExpanded = expandedChainCard === currentIdx;
                          return (
                            <div
                              className={`chainChild chainChild--current${isCurExpanded ? ' chainChild--expanded' : ''}`}
                              onClick={() => setExpandedChainCard(isCurExpanded ? null : currentIdx)}
                            >
                              <div className="chainChildHeader">
                                <AuthorBadge author={currentVideo.author} compact noLink />
                              </div>
                              <span className={`chainChildTitle${isCurExpanded ? ' chainChildTitle--full' : ''}`}>
                                {currentVideo.caption || 'This video'}
                              </span>
                            </div>
                          );
                        })()}
                        {/* Child reactions (downstream from current short) */}
                        {currentVideo.childReactions?.map((child, ci) => (
                          <React.Fragment key={`child-${ci}`}>
                            <span className="chainDash">&mdash;</span>
                            <div className="chainChild chainChild--video chainChild--downstream">
                              <div className="chainChildHeader">
                                <AuthorBadge author={child.author} compact noLink />
                                <Link to={`/shorts?v=${child.author}/${child.shortPermlink}`} className="chainActionBtn chainActionBtn--sm" onClick={(e) => e.stopPropagation()} title="Open short">
                                  <Camera size={11} />
                                </Link>
                              </div>
                              <span className="chainChildTitle">
                                {child.title || 'Reaction'}
                              </span>
                              {child.duration > 0 && (
                                <span className="chainChildDuration">
                                  {Math.floor(child.duration / 60)}:{Math.floor(child.duration % 60).toString().padStart(2, '0')}
                                </span>
                              )}
                            </div>
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <button className="chainToggleBtn" onClick={(e) => { e.stopPropagation(); setParentCardVisible(prev => !prev); }}>
                  {!parentCardVisible && <span className="chainToggleLabel">show reaction chain</span>}
                  {parentCardVisible ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>
            );
          })()}

          <div className="bottomOverlay">
            <div className="userRow" onClick={(e) => e.stopPropagation()}>
              <AuthorBadge
                author={currentVideo.author}
                showFollow
                followersCount={currentVideo.user.followersCount}
                reputation={currentVideo.user.reputation}
                isFollowing={currentVideo.user.isSubscribed}
                onFollow={() => handleSubscribe()}
              />
            </div>
            <div className={`caption${captionExpanded ? ' caption--expanded' : ''}`} onClick={(e) => { e.stopPropagation(); setCaptionExpanded(prev => !prev); }}>
              <p className="captionText">{currentVideo.caption}</p>
              {captionExpanded && currentVideo.tags?.length > 0 && (
                <div className="captionTags">
                  {currentVideo.tags.map((tag, i) => (
                    <Link key={i} to={`/t/${tag}`} className="captionTag" onClick={(e) => e.stopPropagation()}>#{tag}</Link>
                  ))}
                </div>
              )}
              {!captionExpanded && currentVideo.caption?.length > 60 && (
                <span className="captionMore">more</span>
              )}
            </div>
            <div className="audioMarquee">
              <Music2 size={12} />
              <div className="audioText">
                <p>{currentVideo.audio}</p>
              </div>
            </div>
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="actionSidebar" onClick={(e) => e.stopPropagation()}>
          <div className="actionItem" onClick={(e) => { e.stopPropagation(); toggleVoteTooltip(currentVideo.author, currentVideo.hivePermlink); }}>
            <div className={`actionButton ${currentVideo.isLiked ? 'liked' : ''}`}>
              <Heart size={24} fill={currentVideo.isLiked ? '#ff2d55' : 'none'} />
            </div>
            <span className="actionLabel">{formatNumber(currentVideo.stats.likes)}</span>
            <CommentVoteTooltip
              author={currentVideo.author}
              permlink={currentVideo.hivePermlink}
              showTooltip={showTooltip && activeTooltipPermlink === currentVideo.hivePermlink}
              setShowTooltip={setShowTooltip}
              setCommentList={setCommentList}
              setActiveTooltipPermlink={setActiveTooltipPermlink}
              weight={weight}
              setWeight={setWeight}
              voteValue={voteValue}
              setVoteValue={setVoteValue}
              accountData={accountData}
              setAccountData={setAccountData}
              onVoteSuccess={handlePostVoteSuccess}
            />
          </div>

          <div className="actionItem" onClick={(e) => { e.stopPropagation(); handleToggleComments(); }}>
            <div className={`actionButton ${showComments ? 'active' : ''}`}>
              <MessageSquare size={24} />
            </div>
            <span className="actionLabel">{currentVideo.stats.comments}</span>
          </div>

          {/* Reward/Payout Display */}
          <div className="actionItem" onClick={(e) => e.stopPropagation()}>
            <div className="actionButton reward">
              <HiveIcon size={24} />
            </div>
            <span className="actionLabel">{formatPayout(currentVideo.stats.payout)}</span>
          </div>

          <div className="actionItem" onClick={(e) => { e.stopPropagation(); handleShare(); }}>
            <div className="actionButton">
              <Share2 size={24} />
            </div>
            <span className="actionLabel">Share</span>
          </div>

          <div className="actionItem" onClick={(e) => e.stopPropagation()}>
            <div className="actionButton">
              <RefreshCw size={24} className="flipped" />
            </div>
            <span className="actionLabel">{currentVideo.stats.remixes || 0}</span>
          </div>

          <div className="actionItem" onClick={(e) => { e.stopPropagation(); toggleMute(); }}>
            <div className={`actionButton ${isMuted ? '' : 'active'}`}>
              {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
            </div>
            <span className="actionLabel">{isMuted ? 'Unmute' : 'Mute'}</span>
          </div>

          <div className="albumArt"  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleProfileNavigation(currentVideo.user.username);
                  }}>
            <img src={currentVideo.albumArt} alt="" />
          </div>
        </div>

        {/* NAVIGATION */}
        <div className="navigationArrows">
          <button className="navButton" onClick={handlePrevious} disabled={currentIndex === 0}>
            <ArrowUp size={24} />
          </button>
          <button className="navButton" onClick={handleNext} disabled={currentIndex === videos.length - 1 && !hasMore}>
            {loading && currentIndex === videos.length - 1 ? (
              <Loader2 size={24} className="spinner" />
            ) : (
              <ArrowDown size={24} />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Comments Overlay */}
      <div
        className={`commentsOverlay ${showComments ? 'visible' : ''}`}
        onClick={handleToggleComments}
      />

      {/* COMMENTS PANEL */}
      <div className={`commentsPanel ${showComments ? 'open' : ''}`} ref={commentsPanelRef}>
        {/* Mobile drag handle */}
        <div
          className="commentsPanelHandle"
          onTouchStart={handleCommentsDragStart}
          onTouchMove={handleCommentsDragMove}
          onTouchEnd={handleCommentsDragEnd}
        />

        <div className="commentsHeader">
          <span className="commentsTitle">Comments</span>
          <span className="commentsCount">{currentVideo.stats.comments}</span>
          <div className="commentsHeaderActions">
            {/* <button className="headerBtn">
              <SlidersHorizontal size={20} />
            </button> */}
            <button className="headerBtn" onClick={handleToggleComments}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="commentsList">
          {commentsLoading ? (
            <div className="commentsLoading">
              <Loader2 className="spinner" size={24} />
              <span>Loading comments...</span>
            </div>
          ) : currentVideo.comments?.length === 0 ? (
            <div className="noComments">
              <p>No comments yet</p>
              <span>Be the first to comment!</span>
            </div>
          ) : (
            currentVideo.comments?.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                depth={0}
                formatNumber={formatNumber}
                toggleVoteTooltip={toggleVoteTooltip}
                showTooltip={showTooltip}
                activeTooltipPermlink={activeTooltipPermlink}
                setShowTooltip={setShowTooltip}
                setActiveTooltipPermlink={setActiveTooltipPermlink}
                setCommentList={setCommentList}
                weight={weight}
                setWeight={setWeight}
                voteValue={voteValue}
                setVoteValue={setVoteValue}
                accountData={accountData}
                setAccountData={setAccountData}
                activeReply={activeReply}
                setActiveReply={setActiveReply}
                replyText={replyText}
                setReplyText={setReplyText}
                handlePostComment={handlePostComment}
                postingComment={postingComment}
                user={user}
                renderedBodies={renderedBodies}
              />
            ))
          )}
        </div>

        {/* Comment Input */}
        <div className="commentInput">
          <div className="commentInputAvatar">
            <img src={user ? `https://images.hive.blog/u/${user}/avatar` : "https://images.hive.blog/u/guest/avatar"} alt="" />
          </div>
          <input
            type="text"
            placeholder={user ? "Add a comment..." : "Login to comment"}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            disabled={!user || postingComment}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !postingComment) {
                handlePostComment(currentVideo.author, currentVideo.hivePermlink, newComment, false);
              }
            }}
          />
          <button
            className="sendCommentBtn"
            onClick={() => handlePostComment(currentVideo.author, currentVideo.hivePermlink, newComment, false)}
            disabled={!user || !newComment.trim() || postingComment}
          >
            {postingComment ? <Loader2 size={18} className="spinner" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </main>
  );
};

/* ================= COMMENT ITEM COMPONENT ================= */
const CommentItem = ({
  comment,
  depth,
  formatNumber,
  toggleVoteTooltip,
  showTooltip,
  activeTooltipPermlink,
  setShowTooltip,
  setActiveTooltipPermlink,
  setCommentList,
  weight,
  setWeight,
  voteValue,
  setVoteValue,
  accountData,
  setAccountData,
  activeReply,
  setActiveReply,
  replyText,
  setReplyText,
  handlePostComment,
  postingComment,
  user,
  renderedBodies
}) => {
  const [showReplies, setShowReplies] = useState(false);
  const maxDepth = 3;

  const isReplying = activeReply === comment.permlink;

  // Use pre-rendered HTML if available, strip "replied to" metadata
  const getCommentHtml = () => {
    let html = renderedBodies?.[comment.permlink] || comment.body || '';
    return html
      .replace(/<p>\s*<sup>\s*replied to\s*<a[^>]*>.*?<\/a>\s*<\/sup>\s*<\/p>/gi, '')
      .replace(/<sup>\s*replied to\s*<a[^>]*>.*?<\/a>\s*<\/sup>/gi, '')
      .replace(/\n?<sup>replied to \[.*?\]\([^)]*\)<\/sup>/g, '');
  };

  return (
    <div className={`commentItem ${depth > 0 ? 'nested' : ''}`} style={{ marginLeft: depth > 0 ? '12px' : '0' }}>
      <div className="commentAvatar">
        <img src={comment.user?.avatar} alt="" />
      </div>
      <div className="commentContent">
        <div className="commentMeta">
          <span className="commentUsername">{comment.user?.username}</span>
          <span className="commentTime">{comment.timeAgo}</span>
        </div>
        <div className="commentText markdown-view" dangerouslySetInnerHTML={{ __html: getCommentHtml() }} />
        <div className="commentActions">
          <button
            className={`commentActionBtn ${comment.has_voted ? 'liked' : ''}`}
            onClick={() => toggleVoteTooltip(comment.author, comment.permlink)}
          >
            <Heart size={14} fill={comment.has_voted ? '#ff2d55' : 'none'} />
            <span>{comment.stats?.num_likes ?? 0}</span>
          </button>
          <div className="commentReward">
            <GiTwoCoins size={14} />
            <span>${comment.stats?.total_hive_reward?.toFixed(2) ?? '0.00'}</span>
          </div>
          <button
            className="replyBtn"
            onClick={() => {
              setActiveReply(comment.permlink);
              setReplyText('');
            }}
          >
            Reply
          </button>
          <CommentVoteTooltip
            author={comment.author}
            permlink={comment.permlink}
            showTooltip={showTooltip && activeTooltipPermlink === comment.permlink}
            setShowTooltip={setShowTooltip}
            setCommentList={setCommentList}
            setActiveTooltipPermlink={setActiveTooltipPermlink}
            weight={weight}
            setWeight={setWeight}
            voteValue={voteValue}
            setVoteValue={setVoteValue}
            accountData={accountData}
            setAccountData={setAccountData}
          />
        </div>

        {/* Reply Input */}
        {isReplying && (
          <div className="replyInputWrapper">
            <input
              type="text"
              placeholder="Write a reply..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              disabled={postingComment}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !postingComment) {
                  handlePostComment(comment.author, comment.permlink, replyText, true);
                }
              }}
            />
            <div className="replyActions">
              <button onClick={() => setActiveReply(null)}>Cancel</button>
              <button
                className="submitReply"
                onClick={() => handlePostComment(comment.author, comment.permlink, replyText, true)}
                disabled={!replyText.trim() || postingComment}
              >
                {postingComment ? <Loader2 size={14} className="spinner" /> : 'Reply'}
              </button>
            </div>
          </div>
        )}

        {/* Show replies toggle */}
        {comment.children && comment.children.length > 0 && (
          <button
            className="viewRepliesBtn"
            onClick={() => setShowReplies(!showReplies)}
          >
            {showReplies ? 'Hide' : 'View'} {comment.children.length} {comment.children.length === 1 ? 'reply' : 'replies'}
            <ArrowDown size={14} style={{ transform: showReplies ? 'rotate(180deg)' : 'none' }} />
          </button>
        )}

        {/* Nested replies */}
        {showReplies && comment.children && depth < maxDepth && (
          <div className="nestedComments">
            {comment.children.map((child) => (
              <CommentItem
                key={child.id}
                comment={child}
                depth={depth + 1}
                formatNumber={formatNumber}
                toggleVoteTooltip={toggleVoteTooltip}
                showTooltip={showTooltip}
                activeTooltipPermlink={activeTooltipPermlink}
                setShowTooltip={setShowTooltip}
                setActiveTooltipPermlink={setActiveTooltipPermlink}
                setCommentList={setCommentList}
                weight={weight}
                setWeight={setWeight}
                voteValue={voteValue}
                setVoteValue={setVoteValue}
                accountData={accountData}
                setAccountData={setAccountData}
                activeReply={activeReply}
                setActiveReply={setActiveReply}
                replyText={replyText}
                setReplyText={setReplyText}
                handlePostComment={handlePostComment}
                postingComment={postingComment}
                user={user}
                renderedBodies={renderedBodies}
              />
            ))}
          </div>
        )}
      </div>
      <button className="commentMoreBtn">
        <MoreVertical size={16} />
      </button>
    </div>
  );
};

export default VideoShort;