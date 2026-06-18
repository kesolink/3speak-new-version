import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import "./Short.scss";
import {
  Heart,
  MessageSquare,
  Share2,
  Music2,
  ArrowUp,
  ArrowDown,
  X,
  SlidersHorizontal,
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
  VolumeX,
  Repeat,
  ChevronsUp,
  Square,
  RotateCcw,
  Repeat2,
  WandSparkles,
  Moon,
  Lightbulb,
  Sun,
  Film,
  Music,
} from 'lucide-react';
import { GiTwoCoins } from 'react-icons/gi';
import { MdTranslate, MdClosedCaption, MdClosedCaptionOff, MdFlag } from 'react-icons/md';
import mantequillaLogo from '../assets/mantequilla-logo.png';
import ReportModal, { isReported } from '../components/modal/ReportModal';
import { Flag } from 'lucide-react';
import ShareChooserModal from '../components/Chat/ShareChooserModal';
import useTranslation from '../hooks/useTranslation';
import TranslateButton from '../components/TranslateButton/TranslateButton';
import useSubtitles from '../hooks/useSubtitles';
import SubtitleOverlay from '../components/SubtitleOverlay/SubtitleOverlay';
import { SUPPORTED_LANGUAGES } from '../utils/translate';

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
import { recordWatch } from '../utils/watchHistory';
import { recordReshare, getResharesForVideo, deleteReshare } from '../utils/reshares';
import axios from 'axios';
import { toast } from 'sonner';
import CommentVoteTooltip from '../components/tooltip/CommentVoteTooltip';
import { PLAYER_URL, FEATURE_EDITOR } from '../utils/config';
import { Player, ThreeSpeakApi } from '@mantequilla-soft/3speak-player';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { fixVideoThumbnail, fallbackImg } from '../utils/fixThumbnails';
import AuthorBadge from '../components/AuthorBadge/AuthorBadge';
import ShortsIcon from '../components/icons/ShortsIcon';
import ShortsLoadingScreen from '../components/ShortsLoadingScreen/ShortsLoadingScreen';
import { markByReputation } from '../utils/reputation';
import { getVotePower, getDynamicProps } from '../utils/hiveUtils';
import { commentWithAioha, isLoggedIn } from '../hive-api/aioha';
import AmbientGlow, { useAmbientGlow } from '../components/AmbientGlow/AmbientGlow';
import EditorModal from '../components/modal/EditorModal';
import { notifyMediaPlay, onMediaPlay } from '../utils/mediaCoordinator';
import HiveAvatar from '../components/HiveAvatar/HiveAvatar';

// Thin wrapper: reads currentTime from a ref via polling to avoid re-rendering the whole Shorts page
function ShortsSubtitleOverlay({ timeRef, cues, style }) {
  const [time, setTime] = useState(0);
  useEffect(() => {
    if (!cues || cues.length === 0) return;
    const id = setInterval(() => setTime(timeRef.current), 250);
    return () => clearInterval(id);
  }, [timeRef, cues]);
  if (!cues || cues.length === 0) return null;
  return <SubtitleOverlay currentTime={time} cues={cues} style={style} />;
}

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

// Markdown collapses single newlines — turn them into hard breaks so multi-line
// comments keep their line breaks when rendered.
const hardBreakMd = (text) => String(text || '').replace(/\n/g, '  \n');

/* ---- Caption renderer: markdown links → clickable badges, strips HTML ---- */
function renderCaption(text) {
  if (!text) return null;
  // Remove <sup>...</sup> blocks (reply-to metadata)
  let cleaned = text.replace(/<sup>[\s\S]*?<\/sup>/gi, '');
  // Remove any remaining HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, '');
  // Remove standalone URLs (not inside markdown link syntax)
  cleaned = cleaned.replace(/(?<!\()https?:\/\/\S+/g, '');
  // Remove markdown bold/italic
  cleaned = cleaned.replace(/[*_]{1,3}/g, '');
  // Remove markdown headers
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');
  // Remove horizontal rules
  cleaned = cleaned.replace(/^---+$/gm, '');
  // Collapse whitespace
  cleaned = cleaned.replace(/\n{2,}/g, '\n').trim();

  // Split on markdown links: [text](url)
  const parts = cleaned.split(/(\[[^\]]*\]\([^)]*\))/g);
  const elements = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const linkMatch = part.match(/^\[([^\]]*)\]\(([^)]*)\)$/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      if (label.trim()) {
        elements.push(
          <a key={i} href={href} className="captionBadge" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
            {label}
          </a>
        );
      }
    } else if (part.trim()) {
      elements.push(<span key={i}>{part}</span>);
    }
  }
  return elements.length > 0 ? elements : null;
}

// Register a view on the player backend once a short actually starts playing.
// The backend (/api/view) resolves the video with findEmbedVideo(owner, permlink),
// which matches the embed *asset* permlink — the SAME id the player uses to load
// and play the short — NOT the Hive permlink. So we must send `video.permlink`
// (the asset id); sending `hivePermlink` makes the lookup 404 and the view is
// never counted. A video lives in exactly one collection, so we try 'embed' then
// 'legacy' and stop once one counts it. `seen` dedupes per session so
// replays/loops/seeks never double-count.
async function recordShortView(video, seen) {
  const permlink = video?.permlink || video?.hivePermlink;
  if (!video?.author || video.author === 'unknown' || !permlink) return;
  const key = `${video.author}/${permlink}`;
  if (seen.has(key)) return;
  seen.add(key);
  for (const type of ['embed', 'legacy']) {
    try {
      const res = await fetch(`${PLAYER_URL}/api/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner: video.author, permlink, type }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.counted) break;
    } catch { /* try next type */ }
  }
}

/* ================= COMPONENT ================= */
const VideoShort = () => {
  const { user, authenticated, watchHistoryEnabled } = useAppStore();
  const { translate: onTranslate, getTranslation, clearTranslation, translating } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef(0);
  currentIndexRef.current = currentIndex;

  const [videos, setVideos] = useState([]);
  const videosRef = useRef([]);
  videosRef.current = videos;
  // Desktop opens the comments side-panel by default; mobile keeps it closed
  // (it's a full-screen bottom sheet there).
  const [showComments, setShowComments] = useState(() => typeof window !== 'undefined' && window.innerWidth > 768);
  const [newComment, setNewComment] = useState('');
  const [shareChooserOpen, setShareChooserOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [parentCardVisible, setParentCardVisible] = useState(() => {
    const stored = localStorage.getItem('3speak-chain-visible');
    return stored !== null ? stored === '1' : true;
  });
  const [expandedChainCard, setExpandedChainCard] = useState(null);
  const chainRowRef = useRef(null);
  const chainDragRef = useRef({ isDown: false, startX: 0, scrollLeft: 0 });
  const [shortNavLoading, setShortNavLoading] = useState(false);
  const [firstPlayerReady, setFirstPlayerReady] = useState(false);
  const shortHistoryRef = useRef([]); // Stack of {author, permlink} for back navigation
  const isNavigatingBackRef = useRef(false); // Prevents URL-change effect from pushing to history on back

  // Editor modal state
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editorVideoUrl, setEditorVideoUrl] = useState(null);
  const [editorVideoName, setEditorVideoName] = useState(null);
  const [editorOriginalAuthor, setEditorOriginalAuthor] = useState(null);
  const [editorOriginalPermlink, setEditorOriginalPermlink] = useState(null);
  const [editorOriginalShortPermlink, setEditorOriginalShortPermlink] = useState(null);
  const [editorVideoType, setEditorVideoType] = useState('video');
  const [remixDropdownOpen, setRemixDropdownOpen] = useState(false);
  const remixDropdownRef = useRef(null);

  // Ambient glow
  const { glowMode, toggleGlow } = useAmbientGlow();

  // Player state
  const [isPlaying, setIsPlaying] = useState(false);

  // Cross-player coordination — announce play, pause when another player starts.
  useEffect(() => {
    if (isPlaying) notifyMediaPlay('short');
  }, [isPlaying]);
  useEffect(() => onMediaPlay('short', () => {
    try { playerRef.current?.pause?.(); } catch {}
  }), []);
  const [isMuted, setIsMuted] = useState(() => {
    const stored = localStorage.getItem('3speak-muted');
    if (stored !== null) return stored === '1';
    // Fallback: read legacy cookie
    const cookie = document.cookie.split('; ').find(c => c.startsWith('shorts_muted='));
    return cookie ? cookie.split('=')[1] !== '0' : false;
  });
  // Playback mode: 'auto-replay' (loop), 'auto-swipe' (next near end), 'none' (stop + replay)
  const [playbackMode, setPlaybackMode] = useState(() => {
    const cookie = document.cookie.split('; ').find(c => c.startsWith('shorts_playback_mode='));
    return cookie ? cookie.split('=')[1] : 'auto-replay';
  });
  const playbackModeRef = useRef(playbackMode);
  const [showModeIndicator, setShowModeIndicator] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const modeIndicatorTimeoutRef = useRef(null);
  const autoSwipeTriggeredRef = useRef(false);
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
  const isScrubbingRef = useRef(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [postingComment, setPostingComment] = useState(false);

  // Vote tooltip state
  const [showTooltip, setShowTooltip] = useState(false);
  const [activeTooltipPermlink, setActiveTooltipPermlink] = useState(null);
  const [selectedComment, setSelectedComment] = useState({ author: '', permlink: '' });
  const [weight, setWeight] = useState(100);
  const [voteValue, setVoteValue] = useState(0.0);
  const [accountData, setAccountData] = useState(null);
  // Pre-cached vote data (fetched once on mount, refreshed after each vote)
  const cachedDynamicPropsRef = useRef(null);
  const voteDataReady = useRef(false);

  // Rendered comment bodies (permlink -> HTML string)
  const [renderedBodies, setRenderedBodies] = useState({});

  // Reshare state
  const [reshareCount, setReshareCount] = useState(0);
  const [hasReshared, setHasReshared] = useState(false);
  const [reshareUsers, setReshareUsers] = useState([]); // [{username, reshared_at}]

  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState({ type: 'video', author: '', permlink: '' });

  // Reply state
  const [activeReply, setActiveReply] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [translatedCaption, setTranslatedCaption] = useState(null);

  // Autoplay blocked fallback (iOS Low Power Mode, etc.)
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

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
  const recordedShortsViewsRef = useRef(new Set()); // author/permlink already view-counted
  const videoContainerRef = useRef(null);
  const playerRef = useRef(null); // Single persistent SDK Player instance
  const videoElRef = useRef(null); // Single persistent <video> element ref
  const handleNextRef = useRef(null); // Ref mirror of handleNext for use in Player event handlers
  const sdkApiRef = useRef(new ThreeSpeakApi(PLAYER_URL)); // Shared API for prefetching
  const prefetchedSourcesRef = useRef(new Map()); // Cache: videoId -> VideoSource (from prefetch)
  const prefetchingRef = useRef(new Set()); // Track in-flight prefetch requests
  const keyboardRef = useRef(null); // capture keyboard events on mobile when focused
  const prevIndexRef = useRef(0); // Track previous index
  const prevVideoIdRef = useRef(null); // Track previous video id to avoid re-running play on enrichment
  const readyPlayers = useRef(new Set()); // Track which SDK players have fired 'ready'
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
  const queryClient = useQueryClient();
  const isStoriesMode = location.pathname.includes('/shorts/stories');

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

  /* ---------- 3SPEAK SDK PLAYER API ---------- */

  // Get stable player id for a video
  // Get the persistent SDK player
  const getPlayer = useCallback(() => {
    return playerRef.current || null;
  }, []);

  // Send command to the persistent SDK player
  const sendCommandToVideo = useCallback((video, command, data = {}) => {
    if (!video) return;
    const player = playerRef.current;
    if (!player || player.destroyed) {
      console.log(`[VideoShort] No SDK player available`);
      return;
    }
    switch (command) {
      case 'play': player.play(); break;
      case 'pause': player.pause(); break;
      case 'toggle-play': player.togglePlay(); break;
      case 'mute': player.setMuted(true); break;
      case 'unmute': player.setMuted(false); break;
      case 'seek': player.seek(data.time || 0); break;
      default: console.warn(`[VideoShort] Unknown command: ${command}`);
    }
  }, []);

  // Send command to current video
  const sendCommand = useCallback((command, data = {}) => {
    const currentVid = videos[currentIndex];
    sendCommandToVideo(currentVid, command, data);
  }, [videos, currentIndex, sendCommandToVideo]);

  // Play an SDK player with correct mute state.
  // Always start muted so iOS allows the play(), then unmute after playback starts.
  const playPlayerWithMuteSync = useCallback((player) => {
    if (!player || player.destroyed) return;
    player.setMuted(true);
    player.play().then(() => {
      if (!player.destroyed) {
        player.setMuted(isMutedRef.current);
      }
      setAutoplayBlocked(false);
    }).catch((err) => {
      console.warn('[VideoShort] play() rejected:', err);
      setAutoplayBlocked(true);
    });
  }, []);

  const togglePlayPause = useCallback(() => {
    sendCommand('toggle-play');
    setShowPlayPauseIcon(true);
    if (playPauseTimeoutRef.current) clearTimeout(playPauseTimeoutRef.current);
    playPauseTimeoutRef.current = setTimeout(() => setShowPlayPauseIcon(false), 500);
  }, [sendCommand]);

  // Toggle mute: only send to current (active) player.
  // Other players get mute synced when they become current via playPlayerWithMuteSync.
  const toggleMute = useCallback(() => {
    const newMuted = !isMuted;
    const command = newMuted ? 'mute' : 'unmute';
    sendCommand(command);
    setIsMuted(newMuted);
    isMutedRef.current = newMuted;
    localStorage.setItem('3speak-muted', newMuted ? '1' : '0');
    document.cookie = `shorts_muted=${newMuted ? '1' : '0'}; path=/; max-age=${365 * 24 * 3600}`;
    // Show mute/unmute icon feedback
    setShowMuteIcon(true);
    if (muteIconTimeoutRef.current) clearTimeout(muteIconTimeoutRef.current);
    muteIconTimeoutRef.current = setTimeout(() => setShowMuteIcon(false), 600);
  }, [isMuted, sendCommand]);

  // Cycle playback mode: auto-replay → auto-swipe → none → auto-replay
  const cyclePlaybackMode = useCallback(() => {
    const modes = ['auto-replay', 'auto-swipe', 'none'];
    const nextMode = modes[(modes.indexOf(playbackMode) + 1) % modes.length];
    setPlaybackMode(nextMode);
    playbackModeRef.current = nextMode;
    document.cookie = `shorts_playback_mode=${nextMode}; path=/; max-age=${365 * 24 * 3600}`;
    // Update loop setting on the persistent SDK player
    const shouldLoop = nextMode === 'auto-replay';
    const player = playerRef.current;
    if (player && !player.destroyed) player.setLoop(shouldLoop);
    // Reset ended state when switching modes
    setVideoEnded(false);
    autoSwipeTriggeredRef.current = false;
    // Show mode indicator
    setShowModeIndicator(true);
    if (modeIndicatorTimeoutRef.current) clearTimeout(modeIndicatorTimeoutRef.current);
    modeIndicatorTimeoutRef.current = setTimeout(() => setShowModeIndicator(false), 1500);
  }, [playbackMode, videos, currentIndex]);

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
    if (video.hivePostMissing) {
      toast.error("Voting isn't available for this post");
      return;
    }
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
    if (mouseLongPressHandledRef.current) return;

    // When comments panel is open, allow simple play/pause but skip double-tap gestures
    if (showComments) {
      togglePlayPause();
      return;
    }

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
    isScrubbingRef.current = true;
    handleProgressBarInteraction(e);
  }, [handleProgressBarInteraction]);

  const handleProgressMouseMove = useCallback((e) => {
    if (!isScrubbingRef.current) return;
    handleProgressBarInteraction(e);
  }, [handleProgressBarInteraction]);

  const handleProgressMouseUp = useCallback(() => {
    setIsScrubbing(false);
    isScrubbingRef.current = false;
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

  // SDK event subscriptions are set up once in the setupVideoElement callback.
  // No global postMessage listener needed — the SDK communicates directly via native events.

  // Pre-fetch vote data once when user is logged in
  const fetchVoteData = useCallback(async () => {
    if (!user) return;
    try {
      const [acctResult, dynProps] = await Promise.all([
        getVotePower(user),
        getDynamicProps(),
      ]);
      const acct = acctResult?.account;
      if (acct) setAccountData(acct);
      if (dynProps) cachedDynamicPropsRef.current = dynProps;
      voteDataReady.current = !!(acct && dynProps);
    } catch (err) {
      console.error('Error pre-fetching vote data:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchVoteData();
  }, [fetchVoteData]);

  // Handle video change - pause previous, play current
  // Only react to actual index changes (not videos enrichment re-renders)
  useEffect(() => {
    const currentVid = videos[currentIndex];
    if (!currentVid) return;

    // Skip if index hasn't actually changed (e.g. videos array updated by enrichment)
    if (prevIndexRef.current === currentIndex && currentVid.id === prevVideoIdRef.current) return;

    const prevIndex = prevIndexRef.current;

    console.log(`[VideoShort] Index changed: ${prevIndex} -> ${currentIndex}, video: ${currentVid.id}`);

    // Always clear pending play from previous navigation
    pendingPlayRef.current = null;

    // Update URL with current video (without page reload)
    updateUrlWithCurrentVideo(currentVid);

    // Record watch history — use hivePermlink so WatchedView can look it up via Hive API
    if (user && watchHistoryEnabled !== false && currentVid.author && (currentVid.hivePermlink || currentVid.permlink)) {
      recordWatch(user, currentVid.author, currentVid.hivePermlink || currentVid.permlink, { short: true });
    }

    // Decrement unseen_count for the current creator in the stories bar cache
    if (isStoriesMode && feedUser) {
      queryClient.setQueryData(['shorts-stories', user], (old) => {
        if (!old?.creators) return old;
        return {
          ...old,
          creators: old.creators.map(c =>
            c.username === feedUser && c.unseen_count > 0
              ? { ...c, unseen_count: c.unseen_count - 1 }
              : c
          ),
        };
      });
    }

    // Reset player state
    setIsPlaying(false);
    setVideoEnded(false);
    autoSwipeTriggeredRef.current = false;
    currentTimeRef.current = 0;
    durationRef.current = 0;
    updateProgressBar();
    setParentCardVisible(localStorage.getItem('3speak-chain-visible') !== '0');
    setCaptionExpanded(false);
    setTranslatedCaption(null);

    // Update tracking refs
    prevIndexRef.current = currentIndex;
    prevVideoIdRef.current = currentVid.id;

    // Reset ready state for the new video
    readyPlayers.current.clear();
    setReadyPlayerIds(new Set());

    // Load new video into the persistent player (reuses same <video> element + Player instance)
    const player = playerRef.current;
    if (player && !player.destroyed) {
      pendingPlayRef.current = currentVid.id;
      console.log(`[VideoShort] Loading new source into persistent player: ${currentVid.id}`);

      // Use prefetched source if available, otherwise fetch from API
      const cachedSource = prefetchedSourcesRef.current.get(currentVid.id);
      if (cachedSource) {
        console.log(`[VideoShort] Using prefetched source for ${currentVid.id}`);
        player.load(cachedSource).catch(err => {
          console.error(`[VideoShort] Failed to load ${currentVid.id}:`, err);
        });
      } else {
        player.load(`${currentVid.author}/${currentVid.permlink}`).catch(err => {
          console.error(`[VideoShort] Failed to load ${currentVid.id}:`, err);
        });
      }

      // Fallback retries in case ready event is delayed
      const timeouts = [];
      const playIfReady = (attempt) => {
        if (pendingPlayRef.current !== currentVid.id) return;
        if (readyPlayers.current.has(currentVid.id)) {
          console.log(`[VideoShort] Playing on retry ${attempt}: ${currentVid.id}`);
          pendingPlayRef.current = null;
          playPlayerWithMuteSync(player);
        }
      };

      [500, 1000, 1500, 2000, 3000, 4000, 5000].forEach((delay, idx) => {
        const timeout = setTimeout(() => playIfReady(idx + 1), delay);
        timeouts.push(timeout);
      });

      return () => {
        timeouts.forEach(t => clearTimeout(t));
      };
    }
  }, [currentIndex, videos, sendCommandToVideo]);

  // Force-show fallback: if the player hasn't fired ready after 6s, show it anyway and try playing
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
        const player = playerRef.current;
        if (player && !player.destroyed) playPlayerWithMuteSync(player);
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
            reusable: enriched.reusable,
            hivePostMissing: enriched.hivePostMissing,
            _enriched: true,
          };
        }));
      } catch (err) {
        console.warn('Failed to enrich short:', err);
        setVideos(prev => prev.map(v => v.id === videoId ? { ...v, _enriched: true } : v));
      }
    })();
  }, [currentIndex, videos, user]);

  // Fetch extended video details (mantecurated etc.) from checker API
  const detailsVideoIdRef = useRef(null);
  useEffect(() => {
    const currentVid = videos[currentIndex];
    if (!currentVid) return;
    if (detailsVideoIdRef.current === currentVid.id) return;
    detailsVideoIdRef.current = currentVid.id;
    const videoId = currentVid.id;

    fetch(`${import.meta.env.VITE_CHECKER_URL}/videodetails/${currentVid.author}/${currentVid.permlink}`)
      .then(r => r.ok ? r.json() : {})
      .then(details => {
        setVideos(prev => prev.map(v =>
          v.id === videoId ? { ...v, mantecurated: details.mantecurated === true } : v
        ));
      })
      .catch(() => {});
  }, [currentIndex, videos]);

  // Fetch reshare data when current video changes
  // Use video id to avoid re-fetching on videos array enrichment (which causes avatar flashing)
  const reshareVideoIdRef = useRef(null);
  useEffect(() => {
    const currentVid = videos[currentIndex];
    if (!currentVid) return;
    // Skip if the video identity hasn't changed (e.g. enrichment updated the videos array)
    if (reshareVideoIdRef.current === currentVid.id) return;
    reshareVideoIdRef.current = currentVid.id;

    const author = currentVid.author;
    const permlink = currentVid.hivePermlink || currentVid.permlink;
    if (!author || !permlink) return;

    // Reset state for new video
    setReshareCount(0);
    setHasReshared(false);
    setReshareUsers([]);

    (async () => {
      try {
        const { reshares, count } = await getResharesForVideo(author, permlink);
        setReshareCount(count);
        setReshareUsers(reshares);
        if (user) {
          setHasReshared(reshares.some(r => r.username === user));
        }
      } catch (err) {
        console.warn('Failed to fetch reshares:', err);
      }
    })();
  }, [currentIndex, videos, user]);

  // Cleanup on unmount — destroy player and preload fresh shorts for the next visit
  useEffect(() => {
    return () => {
      if (playPauseTimeoutRef.current) {
        clearTimeout(playPauseTimeoutRef.current);
      }
      if (playerRef.current && !playerRef.current.destroyed) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      preloadShorts(10, user);
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
        // The URL `permlink` may be the embed asset id OR the Hive permlink
        // (shares / chain links use the Hive permlink). Match either.
        const sharedIndex = formattedVideos.findIndex(
          v => v.author === sharedVideo.author &&
            (v.permlink === sharedVideo.permlink || v.hivePermlink === sharedVideo.permlink)
        );

        if (sharedIndex !== -1) {
          setVideos(formattedVideos);
          setCurrentIndex(sharedIndex);
        } else {
          try {
            // Resolve by asset permlink first; if the URL carried the Hive permlink
            // (wave-/snap-/3speak-… shares), resolve via embed_url instead. Either
            // way `actualShort.permlink` is the embed asset id — what the player and
            // the /api/view endpoint need (sending the Hive permlink 404s both).
            let actualShort = await hiveApi.findShortByPermlink(sharedVideo.permlink);
            if (!actualShort) {
              actualShort = await hiveApi.findShortByEmbedUrl(sharedVideo.author, sharedVideo.permlink);
            }
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
              hivePostMissing: sharedVideoData.hivePostMissing,
              embedUrl: sharedVideoData.embedUrl,
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
          // Only use preloaded data for guests — logged-in users need
          // currentuser filtering to exclude already-watched shorts
          if (!user) {
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
          } else {
            // Discard any stale preloaded data that lacks currentuser filtering
            consumePreloadedShorts();
          }

          // Fetch with currentuser parameter so watched shorts are filtered out
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

    // Check chain preload data for instant switch (player already warm)
    const preloadKey = `${targetAuthor}-${targetPermlink}`;
    const chainData = chainPreloadDataRef.current.get(preloadKey);

    if (chainData) {
      // Instant switch — create minimal entry, player is already loaded
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
      const rawComments = await hiveApi.fetchPostComments(video.author, video.hivePermlink, user);
      const comments = await markByReputation(rawComments);

      // Pre-render comment bodies as HTML
      try {
        const render = await getRenderer();
        const rendered = {};
        const renderComment = (c) => {
          if (c?.body) {
            try { rendered[c.permlink] = render(hardBreakMd(c.body)); } catch (_) {}
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

  /* ---------- SUBTITLES ---------- */
  const {
    availableLanguages: subtitleLanguages,
    selectedLang: selectedSubtitleLang,
    selectLanguage: selectSubtitleLang,
    cues: subtitleCues,
    loading: subtitleLoading,
    subtitleStyle,
  } = useSubtitles(currentVideo?.author, currentVideo?.permlink);
  const [subtitleMenuOpen, setSubtitleMenuOpen] = useState(false);
  const [subtitleMenuPos, setSubtitleMenuPos] = useState(null);
  const subtitleMenuRef = useRef(null);
  const subtitleDropdownRef = useRef(null);

  // Close subtitle menu on outside click
  useEffect(() => {
    if (!subtitleMenuOpen) return;
    const handler = (e) => {
      if (
        subtitleMenuRef.current && !subtitleMenuRef.current.contains(e.target) &&
        (!subtitleDropdownRef.current || !subtitleDropdownRef.current.contains(e.target))
      ) {
        setSubtitleMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [subtitleMenuOpen]);

  const openSubtitleMenu = useCallback(() => {
    setSubtitleMenuOpen(prev => {
      if (!prev && subtitleMenuRef.current) {
        const rect = subtitleMenuRef.current.getBoundingClientRect();
        setSubtitleMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
      }
      return !prev;
    });
  }, []);

  /* ---------- CAPTION TRANSLATE ---------- */
  const handleCaptionTranslate = useCallback(async (langCode) => {
    if (!currentVideo) return;
    const result = await onTranslate(currentVideo.permlink, currentVideo.caption, langCode);
    if (result) setTranslatedCaption(result);
  }, [currentVideo, onTranslate]);

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

    if (!parentAuthor || !parentPermlink) {
      toast.error("Comments aren't available for this post");
      return;
    }

    if (!user || !isLoggedIn()) {
      toast.error('Please login to comment');
      return;
    }

    setPostingComment(true);
    const newPermlink = `re-${parentPermlink}-${Date.now()}`;

    const newCommentObj = {
      id: `${user}-${newPermlink}`,
      author: user,
      permlink: newPermlink,
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

    // Pre-render the body (markdown + line breaks) for instant display.
    try {
      const render = await getRenderer();
      const html = render(hardBreakMd(commentText));
      setRenderedBodies(prev => ({ ...prev, [newPermlink]: html }));
    } catch (_) { /* falls back to raw body */ }

    // Optimistically add the comment + bump the count NOW — signing happens in
    // the background, so the UI shouldn't wait for it (and the result shape of
    // the background broadcast must not gate the count).
    setVideos(prev =>
      prev.map((v, idx) => {
        if (idx !== currentIndex) return v;
        return {
          ...v,
          comments: isReply
            ? addReplyToComment(v.comments, parentPermlink, newCommentObj)
            : [newCommentObj, ...v.comments],
          stats: { ...v.stats, comments: (v.stats.comments || 0) + 1 }
        };
      })
    );
    if (isReply) { setReplyText(''); setActiveReply(null); } else { setNewComment(''); }

    try {
      await commentWithAioha(
        parentAuthor,
        parentPermlink,
        newPermlink,
        '', // title (empty for comments)
        commentText,
        { app: '3speak/new-version' }
      );
      toast.success('Comment posted successfully!');
    } catch (err) {
      console.error('Comment failed:', err);
      toast.error('Comment failed: ' + (err.message || 'please try again'));
      // Roll back the optimistic comment + count.
      setVideos(prev =>
        prev.map((v, idx) => {
          if (idx !== currentIndex) return v;
          return {
            ...v,
            comments: removeCommentByPermlink(v.comments, newPermlink),
            stats: { ...v.stats, comments: Math.max(0, (v.stats.comments || 1) - 1) }
          };
        })
      );
    } finally {
      setPostingComment(false);
    }
  };

  // Remove a comment (top-level or nested) by permlink — used to roll back an
  // optimistic comment if the background broadcast fails.
  const removeCommentByPermlink = (comments, permlink) =>
    comments
      .filter(c => c.permlink !== permlink)
      .map(c => (c.children && c.children.length
        ? { ...c, children: removeCommentByPermlink(c.children, permlink) }
        : c));

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

  /* ---------- RESHARE FUNCTIONALITY ---------- */
  const handleReshare = async () => {
    if (!currentVideo || !user) {
      toast.error('Log in to reshare');
      return;
    }
    if (currentVideo.hivePostMissing) {
      toast.error("Reshare isn't available for this post");
      return;
    }
    if (hasReshared) return;

    const author = currentVideo.author;
    const permlink = currentVideo.hivePermlink || currentVideo.permlink;

    const result = await recordReshare(user, author, permlink);
    if (result) {
      setHasReshared(true);
      setReshareCount(prev => prev + 1);
      setReshareUsers(prev => [...prev, { username: user, reshared_at: Math.floor(Date.now() / 1000) }]);
      toast.success('Reshared!');
    } else {
      toast.error('Failed to reshare');
    }
  };

  const handleRemix = useCallback(async (mediaType = 'video') => {
    const currentVid = videos[currentIndex];
    if (!currentVid) return;

    // Pause current video
    if (playerRef.current) {
      playerRef.current.pause();
    }

    try {
      const source = await sdkApiRef.current.fetchSource(currentVid.author, currentVid.permlink);
      const directUrl = source?.url;

      if (directUrl) {
        setEditorVideoUrl(directUrl);
        setEditorVideoName(`${currentVid.author} - ${currentVid.caption || currentVid.permlink}`);
        setEditorOriginalAuthor(currentVid.author);
        setEditorOriginalPermlink(currentVid.hivePermlink || currentVid.permlink);
        setEditorOriginalShortPermlink(currentVid.permlink);
        setEditorVideoType(mediaType);
        setShowEditorModal(true);
      } else {
        toast.error('Could not resolve video URL for remix');
      }
    } catch (err) {
      console.error('[VideoShort] Remix URL resolve failed:', err);
      toast.error('Failed to load video for remix');
    }
  }, [videos, currentIndex]);

  // Close remix dropdown on click outside
  useEffect(() => {
    if (!remixDropdownOpen) return;
    const handleClickOutside = (e) => {
      if (remixDropdownRef.current && !remixDropdownRef.current.contains(e.target)) {
        setRemixDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [remixDropdownOpen]);

  /* ---------- INTERACTIONS ---------- */


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
  const handlePrevious = () => {
    if (currentIndex === 0) return;
    shortHistoryRef.current = [];
    triggerSwipeAnimation('down');
    setCurrentIndex(currentIndex - 1);
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
    const nextIdx = currentIndex + 1;
    setCurrentIndex(nextIdx);

    // Prefetch more items before the end of the current page
    if (nextIdx >= videos.length - 7 && hasMore) {
      loadMoreVideos();
    }
  };
  handleNextRef.current = handleNext;

  // Keyboard navigation: ArrowUp = previous, ArrowDown = next
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore when typing in inputs or when comments panel is open or transitioning
      const active = document.activeElement;
      const tag = active?.tagName;
      const isEditable = active?.isContentEditable;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || isEditable) return;
      // Desktop keeps the comments open as a side panel — keyboard nav still works;
      // only block while the full-screen comments overlay is up (mobile).
      if ((showComments && window.innerWidth <= 768) || isTransitioning) return;

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

  // Desktop: the scroll wheel navigates shorts, exactly like the Up/Down arrows
  // (scroll down = next, scroll up = previous). Attached to the video container
  // only, so scrolling the comments side-panel still scrolls the comments.
  // A short cooldown stops one wheel gesture from skipping several shorts.
  useEffect(() => {
    if (typeof window === 'undefined' || window.innerWidth <= 768) return;
    const el = videoContainerRef.current;
    if (!el) return;
    let lock = false;
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) < 8) return; // ignore tiny trackpad jitter
      e.preventDefault();
      if (lock || isTransitioning) return;
      lock = true;
      if (e.deltaY > 0) handleNext();
      else handlePrevious();
      setTimeout(() => { lock = false; }, 700);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [handleNext, handlePrevious, isTransitioning]);

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
    if (wasSwipe || gestureHandledRef.current) return;

    // When comments panel is open, allow simple play/pause but skip double-tap gestures
    if (showComments) {
      togglePlayPause();
      return;
    }

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

  // Prefetch API metadata + HLS manifest for upcoming videos (lightweight fetch, no <video> needed)
  // iOS only allows one active <video> — so we prefetch to warm the browser cache instead.
  const prefetchVideo = useCallback((videoId, videoAuthor, videoPermlink) => {
    if (prefetchedSourcesRef.current.has(videoId) || prefetchingRef.current.has(videoId)) return;
    prefetchingRef.current.add(videoId);
    const api = sdkApiRef.current;
    api.fetchSource(videoAuthor, videoPermlink).then(source => {
      prefetchedSourcesRef.current.set(videoId, source);
      prefetchingRef.current.delete(videoId);
      // Also prefetch the HLS manifest itself to warm CDN + browser cache
      api.prefetchManifest(source.url).catch(() => {});
      console.log(`[VideoShort] Prefetched source for ${videoId}`);
    }).catch(err => {
      prefetchingRef.current.delete(videoId);
      console.error(`[VideoShort] Prefetch failed for ${videoId}:`, err);
    });
  }, []);

  // One-time setup: attach a persistent Player to the <video> element when it mounts.
  // The Player is reused across all videos — only load() is called on each swipe.
  const setupVideoElement = useCallback((element) => {
    if (!element || videoElRef.current === element) return;
    videoElRef.current = element;

    // Destroy old player if switching elements (shouldn't happen with stable key)
    if (playerRef.current && !playerRef.current.destroyed) {
      playerRef.current.destroy();
    }

    const player = new Player({
      apiBase: PLAYER_URL,
      muted: true,
      loop: playbackModeRef.current === 'auto-replay',
      poster: false,
      debug: false,
    });

    player.attach(element);
    playerRef.current = player;

    // Subscribe to SDK events — these persist for the lifetime of the player.
    // All handlers use refs (videosRef, currentIndexRef) to get current state.
    player.on('ready', ({ isVertical, width, height }) => {
      const currentVid = videosRef.current[currentIndexRef.current];
      const videoId = currentVid?.id;
      console.log(`[VideoShort SDK] Player ready: ${videoId}, ${width}x${height}, vertical=${isVertical}`);

      // Apply orientation styles to the video element
      if (isVertical) {
        element.style.position = 'absolute';
        element.style.top = '0';
        element.style.left = '50%';
        element.style.transform = 'translateX(-50%)';
        element.style.width = 'auto';
        element.style.height = '100%';
        element.style.aspectRatio = '9 / 16';
      } else {
        element.style.position = 'absolute';
        element.style.top = '50%';
        element.style.left = '0';
        element.style.transform = 'translateY(-50%)';
        element.style.width = '100%';
        element.style.height = 'auto';
        element.style.aspectRatio = '16 / 9';
      }

      // Mark this player as ready
      if (videoId) {
        readyPlayers.current.add(videoId);
        setReadyPlayerIds(prev => {
          if (prev.has(videoId)) return prev;
          const next = new Set(prev);
          next.add(videoId);
          return next;
        });
      }
      setFirstPlayerReady(true);

      // If this is the pending video, play it now
      if (videoId && pendingPlayRef.current === videoId) {
        console.log(`[VideoShort SDK] Player ready - now playing: ${videoId}`);
        pendingPlayRef.current = null;
        playPlayerWithMuteSync(player);
      }
    });

    player.on('timeupdate', ({ currentTime, duration, paused }) => {
      if (isScrubbingRef.current || duration <= 0) return;

      currentTimeRef.current = currentTime || 0;
      durationRef.current = duration;
      updateProgressBar();
      setIsPlaying(!paused);

      // Auto-swipe: trigger swipe when near end of video
      if (playbackModeRef.current === 'auto-swipe' && !autoSwipeTriggeredRef.current) {
        const remaining = duration - currentTime;
        if (remaining <= 0.25) {
          autoSwipeTriggeredRef.current = true;
          handleNextRef.current();
        }
      }
      // None mode: pause video near end and show replay button
      if (playbackModeRef.current === 'none' && !autoSwipeTriggeredRef.current) {
        const remaining = duration - currentTime;
        if (remaining <= 0.3 && remaining >= 0) {
          autoSwipeTriggeredRef.current = true;
          player.pause();
          setVideoEnded(true);
          setIsPlaying(false);
        }
      }
    });

    player.on('play', () => {
      setIsPlaying(true);
      setAutoplayBlocked(false);
      // Count a view the moment the active short actually starts playing.
      recordShortView(videosRef.current[currentIndexRef.current], recordedShortsViewsRef.current);
    });

    player.on('pause', () => {
      setIsPlaying(false);
    });

    player.on('ended', () => {
      if (playbackModeRef.current === 'none') {
        setVideoEnded(true);
        setIsPlaying(false);
      }
    });

    player.on('error', ({ message, fatal }) => {
      // Only log fatal errors — non-fatal ones (like bufferStalledError) are recovered automatically by hls.js
      if (fatal) {
        console.error(`[VideoShort SDK] Fatal error: ${message}`);
      }
    });

    // Load the first video
    const currentVid = videosRef.current[currentIndexRef.current];
    if (currentVid) {
      pendingPlayRef.current = currentVid.id;
      const cachedSource = prefetchedSourcesRef.current.get(currentVid.id);
      if (cachedSource) {
        player.load(cachedSource).catch(err => {
          console.error(`[VideoShort SDK] Failed to load initial video:`, err);
        });
      } else {
        player.load(`${currentVid.author}/${currentVid.permlink}`).catch(err => {
          console.error(`[VideoShort SDK] Failed to load initial video:`, err);
        });
      }
    }
  }, []);

  // (Prefetch effect is below, after chainPreloadEntries declaration)

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

  // Compute chain preload entries for player pre-warming
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

  // Prefetch upcoming videos when currentIndex changes
  useEffect(() => {
    preloadedIndices.forEach(idx => {
      if (idx === currentIndex) return; // Current video gets a real player, not just prefetch
      const video = videos[idx];
      if (video) {
        prefetchVideo(video.id, video.author, video.permlink);
      }
    });
    // Also prefetch chain entries
    chainPreloadEntries.forEach(entry => {
      prefetchVideo(entry.id, entry.author, entry.permlink);
    });
  }, [currentIndex, preloadedIndices, videos, chainPreloadEntries, prefetchVideo]);

  // Clean up stale prefetch caches for videos far out of range
  useEffect(() => {
    const keepIds = new Set(preloadedIndices.map(idx => videos[idx]?.id).filter(Boolean));
    chainPreloadEntries.forEach(e => keepIds.add(e.id));
    for (const id of prefetchedSourcesRef.current.keys()) {
      if (!keepIds.has(id)) {
        prefetchedSourcesRef.current.delete(id);
      }
    }
  }, [preloadedIndices, videos, chainPreloadEntries]);

  const handleProfileNavigation = (username) => {
    navigate(`/p/${username}`);
  };

  /* ---------- RENDER ---------- */

  if (loading && videos.length === 0) {
    return (
      <main className="short-main">
        <ShortsLoadingScreen />
      </main>
    );
  }

  // Show "Loading shorts..." overlay until the first player is ready
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
    <>
    <main className="short-main">
      <div className="landscape-block"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
        onTouchStart={(e) => { e.stopPropagation(); e.preventDefault(); }}
        onTouchMove={(e) => { e.stopPropagation(); e.preventDefault(); }}
        onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); }}
        onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
      >
        <RotateCcw size={48} />
        <p>Please rotate your device to portrait mode</p>
      </div>
      <AmbientGlow getVideoEl={() => videoElRef.current} glowMode={glowMode} />
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
          style={swipeDragY && !swipeDirection ? { transform: `translateY(${swipeDragY * 0.6}px)`, transition: 'none' } : undefined}
        >
          {/* Single SDK video player — only the current video gets a <video> element.
              Upcoming videos are prefetched (API + manifest) so they load fast on swipe.
              iOS only allows one active <video> at a time. */}
          {currentVideo && (
            <video
              key="shorts-player"
              id="shorts-player"
              ref={setupVideoElement}
              autoPlay
              playsInline
              webkit-playsinline=""
              muted
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                pointerEvents: 'none',
                zIndex: 2,
                background: '#000',
              }}
            />
          )}

          {/* Tap-to-play fallback when iOS blocks autoplay (Low Power Mode, etc.) */}
          {autoplayBlocked && currentVideo && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                const player = playerRef.current;
                if (player && !player.destroyed) {
                  player.setMuted(true);
                  player.play().then(() => {
                    if (!player.destroyed) player.setMuted(isMutedRef.current);
                    setAutoplayBlocked(false);
                    setIsPlaying(true);
                  }).catch(() => {});
                }
              }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                background: 'rgba(0,0,0,0.3)',
              }}
            >
              <div style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Play size={36} fill="#000" color="#000" style={{ marginLeft: 4 }} />
              </div>
            </div>
          )}

          {/* Full "Loading shorts..." overlay for the very first video until its player is ready */}
          {showInitialLoadingOverlay && (
            <ShortsLoadingScreen overlay />
          )}

          {/* Chain preload videos are prefetched via API + manifest only (no <video> elements) */}

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
            {/* Ambient glow toggle */}
            <div className={`glowIndicator${glowMode !== 'off' ? ' active' : ''}`}
              onClick={(e) => { e.stopPropagation(); toggleGlow(); }}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); toggleGlow(); }}
              title={glowMode === 'off' ? 'Ambient light: subtle' : glowMode === 'page' ? 'Ambient light: vivid' : 'Ambient light: off'}
            >
              {glowMode === 'off' && <Moon size={16} />}
              {glowMode === 'page' && <Lightbulb size={16} />}
              {glowMode === 'vivid' && <Sun size={16} />}
            </div>
            {/* Playback mode toggle button */}
            <div className="playbackModeIndicator"
              onClick={(e) => { e.stopPropagation(); cyclePlaybackMode(); }}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); cyclePlaybackMode(); }}
            >
              {playbackMode === 'auto-replay' ? <Repeat size={16} /> :
               playbackMode === 'auto-swipe' ? <ChevronsUp size={18} /> :
               <Square size={14} />}
            </div>
            {/* Mute/unmute toggle button */}
            <div className="muteIndicator"
              onClick={(e) => { e.stopPropagation(); toggleMute(); }}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); toggleMute(); }}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </div>
            {/* Playback mode fading text indicator */}
            <div className={`modeIndicatorText ${showModeIndicator ? 'visible' : ''}`}>
              {playbackMode === 'auto-replay' ? 'Auto-Replay' :
               playbackMode === 'auto-swipe' ? 'Auto-Swipe' :
               'Manual'}
            </div>
            {/* Replay button for 'none' mode when video ends */}
            {videoEnded && playbackMode === 'none' && (
              <div className="replayOverlay"
                onClick={(e) => {
                  e.stopPropagation();
                  setVideoEnded(false);
                  sendCommand('seek', { time: 0 });
                  setTimeout(() => sendCommand('play'), 100);
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setVideoEnded(false);
                  sendCommand('seek', { time: 0 });
                  setTimeout(() => sendCommand('play'), 100);
                }}
              >
                <RotateCcw size={56} />
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div
            className="videoProgressBar"
            ref={progressBarRef}
            onMouseDown={handleProgressMouseDown}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => { e.stopPropagation(); setIsScrubbing(true); isScrubbingRef.current = true; handleProgressBarInteraction(e.touches[0]); }}
            onTouchMove={(e) => { e.stopPropagation(); if (isScrubbingRef.current) handleProgressBarInteraction(e.touches[0]); }}
            onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); setIsScrubbing(false); isScrubbingRef.current = false; }}
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

          {/* Mobile back button (left of mute button) */}
          {shortHistoryRef.current.length === 0 && (
            <button className="shortBackBtn mobileOnly" onClick={(e) => { e.stopPropagation(); navigate(-1); }}>
              <ArrowLeft size={18} />
            </button>
          )}

          {/* Stories mode button (next to back button on mobile) — only in stories mode */}
          {isStoriesMode && (
            <button className="shortStoriesBtn mobileOnly" onClick={(e) => { e.stopPropagation(); navigate('/shorts'); }}>
              <ShortsIcon size={18} />
            </button>
          )}

          {/* Subtitle/CC toggle (outside videoOverlay; dropdown via portal to escape stacking contexts) */}
          {subtitleLanguages && subtitleLanguages.length > 0 && (
            <div className={`subtitleIndicator${selectedSubtitleLang ? ' active' : ''}${isStoriesMode ? ' stories-mode' : ''}`}
              ref={subtitleMenuRef}
              onClick={(e) => { e.stopPropagation(); openSubtitleMenu(); }}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); openSubtitleMenu(); }}
            >
              {selectedSubtitleLang ? <MdClosedCaption size={18} /> : <MdClosedCaptionOff size={18} />}
            </div>
          )}
          {subtitleMenuOpen && subtitleMenuPos && createPortal(
            <div className="shortsSubtitleMenu"
              ref={subtitleDropdownRef}
              onClick={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              style={{ position: 'fixed', top: subtitleMenuPos.top, right: subtitleMenuPos.right, zIndex: 99999 }}
            >
              <button
                className={`shortsSubtitleItem${!selectedSubtitleLang ? ' active' : ''}`}
                onClick={() => { selectSubtitleLang(null); setSubtitleMenuOpen(false); }}
              >
                Off
              </button>
              {subtitleLanguages.map((sub) => {
                const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === sub.lang);
                const label = langInfo ? langInfo.native : sub.lang;
                return (
                  <button
                    key={sub.lang}
                    className={`shortsSubtitleItem${selectedSubtitleLang === sub.lang ? ' active' : ''}`}
                    onClick={() => { selectSubtitleLang(sub.lang); setSubtitleMenuOpen(false); }}
                  >
                    {label}
                    {subtitleLoading && selectedSubtitleLang === sub.lang && ' ...'}
                  </button>
                );
              })}
            </div>,
            document.body
          )}

          {/* Back button (visible after navigating to a parent short) */}
          {shortHistoryRef.current.length > 0 && (
            <button className="shortBackBtn" onClick={(e) => { e.stopPropagation(); handleShortBack(); }}>
              <ArrowLeft size={18} />
              <span>Back</span>
            </button>
          )}

          {/* Reaction chain overlay (for reactions and remixes) */}
          {((currentVideo.reactionChain && currentVideo.reactionChain.length > 0) || (currentVideo.childReactions && currentVideo.childReactions.length > 0)) && (() => {
            const chain = currentVideo.reactionChain || [];
            const rootStep = chain.find(s => s.isRoot);
            const childSteps = chain.filter(s => !s.isRoot);
            const rootUrl = rootStep ? `/watch?v=${rootStep.author}/${rootStep.permlink}${currentVideo.parentTimestamp != null ? `&t=${currentVideo.parentTimestamp}` : ''}` : null;
            return (
              <div className={`reactionChainOverlay${parentCardVisible ? '' : ' collapsed'}${shortHistoryRef.current.length > 0 ? ' has-back' : ''}`} onClick={(e) => e.stopPropagation()}>
                {parentCardVisible && (
                  <div className="reactionChainBreadcrumb">
                    {/* Root / origin card — 50% wide, thumb left + info right */}
                    {rootStep && (
                      <div className="chainRoot">
                        {rootStep.thumbnail && (
                          <img className="chainRootThumb" src={fixVideoThumbnail({ thumbnail: rootStep.thumbnail })} alt="" onError={(e) => (e.currentTarget.src = fallbackImg)} />
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
                    {(childSteps.length > 0 || currentVideo.childReactions?.length > 0) && (
                      <div
                        className="chainChildRow"
                        ref={chainRowRef}
                        onMouseDown={(e) => {
                          const el = chainRowRef.current;
                          if (!el) return;
                          chainDragRef.current = { isDown: true, startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft };
                          el.style.cursor = 'grabbing';
                        }}
                        onMouseLeave={() => { chainDragRef.current.isDown = false; if (chainRowRef.current) chainRowRef.current.style.cursor = ''; }}
                        onMouseUp={() => { chainDragRef.current.isDown = false; if (chainRowRef.current) chainRowRef.current.style.cursor = ''; }}
                        onMouseMove={(e) => {
                          if (!chainDragRef.current.isDown) return;
                          e.preventDefault();
                          const el = chainRowRef.current;
                          const x = e.pageX - el.offsetLeft;
                          el.scrollLeft = chainDragRef.current.scrollLeft - (x - chainDragRef.current.startX);
                        }}
                      >
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
                        {childSteps.length > 0 && <span className="chainDash">&mdash;</span>}
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
                                <Link to={`/shorts?v=${child.shortAuthor || child.author}/${child.shortPermlink}`} className="chainActionBtn chainActionBtn--sm" onClick={(e) => e.stopPropagation()} title="Open short">
                                  <Camera size={11} />
                                </Link>
                              </div>
                              <span className="chainChildTitle">
                                {child.title || 'Remix'}
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
                <button className="chainToggleBtn" onClick={(e) => { e.stopPropagation(); setParentCardVisible(prev => { const next = !prev; localStorage.setItem('3speak-chain-visible', next ? '1' : '0'); return next; }); }}>
                  {!parentCardVisible && <span className="chainToggleLabel">show reaction chain</span>}
                  {parentCardVisible ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>
            );
          })()}

          <div className="bottomOverlay">
            {/* Subtitle overlay — anchored above user badge, moves with bottomOverlay */}
            {subtitleCues.length > 0 && (
              <ShortsSubtitleOverlay timeRef={currentTimeRef} cues={subtitleCues} style={subtitleStyle} />
            )}
            {/* Reshare avatars — users who reshared (except ourselves) */}
            {reshareUsers.filter(r => r.username !== user).length > 0 && (
              <div className="reshareAvatars" onClick={(e) => e.stopPropagation()}>
                {reshareUsers
                  .filter(r => r.username !== user)
                  .slice(0, 5)
                  .map(r => (
                    <div
                      key={r.username}
                      className="reshareAvatarWrap"
                      title={`@${r.username}`}
                      onClick={(e) => { e.stopPropagation(); handleProfileNavigation(r.username); }}
                    >
                      <HiveAvatar
                        username={r.username}
                        size={null}
                        alt={r.username}
                        imgClassName="reshareAvatar"
                        badgeSize={9}
                      />
                      <Repeat2 size={14} className="reshareBadge" />
                    </div>
                  ))}
                {reshareUsers.filter(r => r.username !== user).length > 5 && (
                  <span className="reshareMore">+{reshareUsers.filter(r => r.username !== user).length - 5}</span>
                )}
              </div>
            )}
            <div className="userRow" onClick={(e) => e.stopPropagation()}>
              <AuthorBadge
                author={currentVideo.author}
                showFollow
                followersCount={currentVideo.user.followersCount}
                reputation={currentVideo.user.reputation}
                color="#fff"
              />
            </div>
            <div className={`caption${captionExpanded ? ' caption--expanded' : ''}`} onClick={(e) => { e.stopPropagation(); setCaptionExpanded(prev => !prev); }}>
              {!captionExpanded && !currentVideo.caption?.trim() && (
                <button
                  className={`captionReportBtn${currentVideo && isReported('short', `${currentVideo.author}/${currentVideo.permlink}`) ? ' reported' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setReportTarget({ type: 'short', author: currentVideo.author, permlink: currentVideo.permlink });
                    setIsReportOpen(true);
                  }}
                  title="Report"
                >
                  <MdFlag size={14} />
                </button>
              )}
              <p className="captionText">
                {renderCaption(translatedCaption || currentVideo.caption)}
                {!captionExpanded && currentVideo.mantecurated && (
                  <span className="shortsCuratedBadge shortsCuratedBadge--inline" title="Curated by Mantequilla" onClick={(e) => { e.stopPropagation(); navigate('/t/mantecurated'); }}>
                    <img src={mantequillaLogo} alt="" />
                    Curated
                  </span>
                )}
              </p>
              {currentVideo.timeAgo && !currentVideo.timeAgo.includes('NaN') && (
                <span className="captionDate">{currentVideo.timeAgo}</span>
              )}
              {captionExpanded && (
                <div className="captionActions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className={`captionReportBtn${currentVideo && isReported('short', `${currentVideo.author}/${currentVideo.permlink}`) ? ' reported' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setReportTarget({ type: 'short', author: currentVideo.author, permlink: currentVideo.permlink });
                      setIsReportOpen(true);
                    }}
                    title="Report"
                  >
                    <MdFlag size={14} />
                  </button>
                  {translatedCaption ? (
                    <button className="captionDismissTranslation" onClick={() => setTranslatedCaption(null)}>
                      <MdTranslate size={12} />
                      <span>Show original</span>
                    </button>
                  ) : (
                    <TranslateButton
                      compact
                      onTranslate={handleCaptionTranslate}
                      isTranslating={!!translating?.[currentVideo.permlink]}
                    />
                  )}
                  {currentVideo.mantecurated && (
                    <span className="shortsCuratedBadge" title="Curated by Mantequilla" onClick={(e) => { e.stopPropagation(); navigate('/t/mantecurated'); }}>
                      <img src={mantequillaLogo} alt="" />
                      Curated
                    </span>
                  )}
                </div>
              )}
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
          <div className="actionItem" onClick={(e) => { e.stopPropagation(); if (currentVideo.hivePostMissing) { toast.error("Voting isn't available for this post"); return; } toggleVoteTooltip(currentVideo.author, currentVideo.hivePermlink); }}>
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
              cachedDynamicProps={cachedDynamicPropsRef.current}
              onVoteDataRefresh={fetchVoteData}
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

          <div className="actionItem" onClick={(e) => { e.stopPropagation(); setShareChooserOpen(true); }}>
            <div className="actionButton">
              <Share2 size={24} />
            </div>
            <span className="actionLabel">Share</span>
          </div>

          <div className="actionItem" onClick={(e) => { e.stopPropagation(); handleReshare(); }}>
            <div className={`actionButton ${hasReshared ? 'reshared' : ''}`}>
              <Repeat2 size={24} />
            </div>
            <span className="actionLabel">{reshareCount || 0}</span>
          </div>

          {FEATURE_EDITOR && authenticated && (() => {
            const vid = videos[currentIndex];
            return vid?.reusable === true ? (
              <div className="actionItem" onClick={(e) => { e.stopPropagation(); handleRemix('video'); }}>
                <div className="actionButton">
                  <WandSparkles size={24} />
                </div>
                <span className="actionLabel">Remix</span>
              </div>
            ) : null;
          })()}


        </div>

        <ShareChooserModal
          open={shareChooserOpen}
          url={`${window.location.origin}/shorts?v=${currentVideo.author}/${currentVideo.permlink}`}
          title={currentVideo.title}
          onClose={() => setShareChooserOpen(false)}
          onGeneralShare={handleShare}
        />

      </div>

      {/* NAVIGATION — kept OUTSIDE .videoWrapper so its position:fixed anchors to
          the viewport. The wrapper gets a transform when comments open, which
          would otherwise become the containing block and mis-place the arrows. */}
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

      {/* Mobile Comments Overlay + Panel — portaled to body so it renders above nav */}
      {createPortal(
      <div className="short-main shorts-comments-portal">
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
                cachedDynamicProps={cachedDynamicPropsRef.current}
                onVoteDataRefresh={fetchVoteData}
                activeReply={activeReply}
                setActiveReply={setActiveReply}
                replyText={replyText}
                setReplyText={setReplyText}
                handlePostComment={handlePostComment}
                postingComment={postingComment}
                user={user}
                renderedBodies={renderedBodies}
                onTranslate={onTranslate}
                getTranslation={getTranslation}
                clearTranslation={clearTranslation}
                translating={translating}
              />
            ))
          )}
        </div>

        {/* Comment Input */}
        <div className="commentInput">
          <div className="commentInputAvatar">
            <HiveAvatar username={user || 'guest'} size={null} alt="" badgeSize={11} />
          </div>
          <textarea
            rows={1}
            placeholder={user ? "Add a comment..." : "Login to comment"}
            value={newComment}
            onChange={(e) => {
              setNewComment(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
            disabled={!user || postingComment || currentVideo.hivePostMissing}
            // Enter always inserts a newline (multi-line comments); posting is
            // handled only by the Send button.
          />
          <button
            className="sendCommentBtn"
            onClick={() => handlePostComment(currentVideo.author, currentVideo.hivePermlink, newComment, false)}
            disabled={!user || !newComment.trim() || postingComment || currentVideo.hivePostMissing}
          >
            {postingComment ? <Loader2 size={18} className="spinner" /> : <Send size={18} />}
          </button>
        </div>
      </div>
      </div>,
      document.body
      )}
      {/* Editor Modal */}
      <EditorModal
        isOpen={showEditorModal}
        onClose={() => setShowEditorModal(false)}
        videoUrl={editorVideoUrl}
        videoName={editorVideoName}
        videoType={editorVideoType}
        originalAuthor={editorOriginalAuthor}
        originalPermlink={editorOriginalPermlink}
        originalShortPermlink={editorOriginalShortPermlink}
      />

      {/* Mobile-only quick comment bar at the bottom (replaces the app nav bar
          on the shorts view). Hidden while the full comments panel is open. */}
      {!showComments && (
        <div className="shortsBottomComment">
          <textarea
            rows={1}
            placeholder={user ? 'Add a comment…' : 'Login to comment'}
            value={newComment}
            onChange={(e) => {
              setNewComment(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
            disabled={!user || currentVideo.hivePostMissing}
          />
          <button
            className="sendCommentBtn"
            onClick={() => handlePostComment(currentVideo.author, currentVideo.hivePermlink, newComment, false)}
            disabled={!user || !newComment.trim() || postingComment || currentVideo.hivePostMissing}
            aria-label="Send comment"
          >
            {postingComment ? <Loader2 size={18} className="spinner" /> : <Send size={18} />}
          </button>
        </div>
      )}
    </main>
  {isReportOpen && (
    <ReportModal
      isOpen={isReportOpen}
      onClose={() => setIsReportOpen(false)}
      type={reportTarget.type}
      target={{ author: reportTarget.author, permlink: reportTarget.permlink }}
    />
  )}
  </>
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
  cachedDynamicProps,
  onVoteDataRefresh,
  activeReply,
  setActiveReply,
  replyText,
  setReplyText,
  handlePostComment,
  postingComment,
  user,
  renderedBodies,
  onTranslate,
  getTranslation,
  clearTranslation,
  translating,
}) => {
  const [showReplies, setShowReplies] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [translatedText, setTranslatedText] = useState(null);
  const [translateError, setTranslateError] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const maxDepth = 3;

  const handleTranslate = async (langCode) => {
    if (!comment?.body) return;
    setTranslateError(false);
    try {
      const result = await onTranslate?.(comment.permlink, comment.body, langCode);
      if (result) setTranslatedText(result);
    } catch { setTranslateError(true); }
  };

  const isReplying = activeReply === comment.permlink;

  // Use pre-rendered HTML if available, strip "replied to" metadata
  const getCommentHtml = () => {
    let html = renderedBodies?.[comment.permlink] || comment.body || '';
    return html
      .replace(/<p>\s*<sup>\s*replied to\s*<a[^>]*>.*?<\/a>\s*<\/sup>\s*<\/p>/gi, '')
      .replace(/<sup>\s*replied to\s*<a[^>]*>.*?<\/a>\s*<\/sup>/gi, '')
      .replace(/\n?<sup>replied to \[.*?\]\([^)]*\)<\/sup>/g, '');
  };

  if (comment.isLowReputation) return null;

  if (collapsed) {
    return (
      <div className="commentItem">
        <div className="comment-collapsed-bar" onClick={() => setCollapsed(false)}>
          <img className="comment-collapsed-avatar" src={comment.user?.avatar} alt="" />
          <span className="comment-collapsed-name">@{comment.user?.username}</span>
          <ChevronUp size={16} className="comment-collapsed-chevron" />
        </div>
      </div>
    );
  }

  const hasChildren = comment.children && comment.children.length > 0;

  return (
    <div className={`commentWrapper ${depth > 0 ? 'nested' : ''}`}>
      {/* Main comment row */}
      <div className="commentItem">
        <div className="commentAvatar">
          <img src={comment.user?.avatar} alt="" />
        </div>
        <div className="commentContent">
          <div className="commentMeta">
            <span className="commentUsername">{comment.user?.username}</span>
            <span className="commentTime">{comment.timeAgo}</span>
            <span className="comment-collapse-chevron" onClick={() => setCollapsed(true)}><ChevronUp size={16} /></span>
          </div>
          <div className="commentText markdown-view" dangerouslySetInnerHTML={{ __html: getCommentHtml() }} />
          {translatedText && (
            <div className="comment-translation">
              <div className="comment-translation-header">
                <MdTranslate size={12} />
                <span>Translation</span>
                <button className="comment-translation-dismiss" onClick={() => { setTranslatedText(null); clearTranslation?.(comment.permlink); }}>&times;</button>
              </div>
              <p>{translatedText}</p>
            </div>
          )}
          {translateError && <div className="comment-translation comment-translation--error"><p>Translation failed</p></div>}
          <div className="commentActions">
            <button
              className={`comment-report-btn${isReported('comment', `${comment.author}/${comment.permlink}`) ? ' reported' : ''}`}
              onClick={() => setIsReportOpen(true)}
              title="Report comment"
            >
              <MdFlag size={14} />
            </button>
            <TranslateButton onTranslate={handleTranslate} isTranslating={!!translating?.[comment.permlink]} compact />
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
              cachedDynamicProps={cachedDynamicProps}
              onVoteDataRefresh={onVoteDataRefresh}
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
          {hasChildren && (
            <button
              className="viewRepliesBtn"
              onClick={() => setShowReplies(!showReplies)}
            >
              {showReplies ? 'Hide' : 'View'} {comment.children.length} {comment.children.length === 1 ? 'reply' : 'replies'}
              <ArrowDown size={14} style={{ transform: showReplies ? 'rotate(180deg)' : 'none' }} />
            </button>
          )}
        </div>
      </div>

      {/* Nested replies — outside the flex row, with thread line */}
      {showReplies && hasChildren && depth < maxDepth && (
        <div className="commentThreadArea">
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
                cachedDynamicProps={cachedDynamicProps}
                onVoteDataRefresh={onVoteDataRefresh}
                activeReply={activeReply}
                setActiveReply={setActiveReply}
                replyText={replyText}
                setReplyText={setReplyText}
                handlePostComment={handlePostComment}
                postingComment={postingComment}
                user={user}
                renderedBodies={renderedBodies}
                onTranslate={onTranslate}
                getTranslation={getTranslation}
                clearTranslation={clearTranslation}
                translating={translating}
              />
            ))}
          </div>
        </div>
      )}
      {isReportOpen && (
        <ReportModal
          isOpen={isReportOpen}
          onClose={() => setIsReportOpen(false)}
          type="comment"
          target={{ author: comment.author, permlink: comment.permlink }}
        />
      )}
    </div>
  );
};

export default VideoShort;