import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import './Watch.scss';
import PlayVideo from '../components/playVideo/PlayVideo';
import Card3 from '../components/Cards/Card3';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { GET_RELATED, GET_VIDEO_DETAILS, TRENDING_FEED, GET_AUTHOR_VIDEOS } from '../graphql/queries';
import { useQuery } from '@apollo/client';
import BarLoader from '../components/Loader/BarLoader';
import { useAppStore } from '../lib/store';
import { recordWatch } from '../utils/watchHistory';
import { Client } from '@hiveio/dhive';
import { HIVE_API_NODES, PLAYER_URL } from '../utils/config';
import ReactionPlayer from '../components/ReactionPlayer/ReactionPlayer';
import { MdVideocam, MdChatBubble } from 'react-icons/md';
import { batchGetReputations, LOW_REP_THRESHOLD } from '../utils/reputation';
import { usePlayer } from '@mantequilla-soft/3speak-player/react';

const hiveClient = new Client(HIVE_API_NODES);

// Lazy-load the Hive markdown renderer
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

// Number of author videos to show at the top of recommendations
const AUTHOR_VIDEOS_COUNT = 4;
const QUALITY_STORAGE_KEY = '3speak-quality-pref';
const GLOW_STORAGE_KEY = '3speak-ambient-glow';

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
  const location = useLocation();
  const navigate = useNavigate();
  const { user, watchHistoryEnabled } = useAppStore();
  const v = searchParams.get('v'); // Extract the "v" query parameter
  const playlistId = searchParams.get('playlist');
  const posParam = searchParams.get('pos');
  const [author, permlink] = (v ?? 'unknown/unknown').split('/');

  // Track which videos we've recorded to avoid duplicate API calls
  const recordedWatchRef = useRef(new Set());

  // Get playlist data from location state (passed from PlaylistView)
  const [playlistData, setPlaylistData] = useState(null);
  const [showPlaylist, setShowPlaylist] = useState(true);

  // Initialize playlist data from location state
  useEffect(() => {
    if (location.state?.playlist && location.state?.videos) {
      setPlaylistData({
        playlist: location.state.playlist,
        videos: location.state.videos,
        currentIndex: location.state.currentIndex ?? parseInt(posParam) ?? 0,
      });
      setShowPlaylist(true);
    } else if (!playlistId) {
      // Clear playlist data if not in playlist mode
      setPlaylistData(null);
    }
  }, [location.state, playlistId, posParam]);

  // Update current index when video changes
  useEffect(() => {
    if (playlistData && posParam !== null) {
      const newIndex = parseInt(posParam);
      if (!isNaN(newIndex) && newIndex !== playlistData.currentIndex) {
        setPlaylistData(prev => prev ? { ...prev, currentIndex: newIndex } : null);
      }
    }
  }, [posParam]);

  // --- SDK Player ---
  const wrapperRef = useRef(null);
  const videoIsVerticalRef = useRef(false);
  const fullscreenFromButtonRef = useRef(false);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const hideTimerRef = useRef(null);
  const [videoEnded, setVideoEnded] = useState(false);

  // Ambient glow mode: 'off' | 'page'
  const [glowMode, setGlowMode] = useState(() => {
    const stored = localStorage.getItem(GLOW_STORAGE_KEY);
    if (stored === 'page' || stored === '1' || stored === 'card') return 'page';
    return 'off';
  });

  const toggleGlow = useCallback(() => {
    setGlowMode(prev => {
      const next = prev === 'off' ? 'page' : 'off';
      localStorage.setItem(GLOW_STORAGE_KEY, next);
      return next;
    });
  }, []);

  // Quality levels state
  const [qualityLevels, setQualityLevels] = useState([]);
  const [currentQuality, setCurrentQuality] = useState(-1); // -1 = auto

  const {
    ref: sdkVideoRef,
    state: playerState,
    player,
    load: loadVideo,
    pause,
    togglePlay,
    seek,
    setMuted,
    togglePip,
    setQuality: sdkSetQuality,
  } = usePlayer({
    apiBase: PLAYER_URL,
    muted: false,
    loop: false,
    poster: true,
    resume: false,
    hlsConfig: {
      maxBufferLength: 600,      // buffer up to 10 min ahead
      maxMaxBufferLength: 600,
      maxBufferSize: 60 * 1000 * 1000, // 60 MB
    },
  });

  // Track when the <video> element is mounted and attached to the Player
  const [videoAttached, setVideoAttached] = useState(false);
  const videoRef = useCallback((element) => {
    sdkVideoRef(element); // pass to usePlayer's internal attach
    setVideoAttached(!!element);
  }, [sdkVideoRef]);

  // Refs synced on every render so event handlers avoid stale closures
  const playlistDataRef = useRef(playlistData);
  playlistDataRef.current = playlistData;
  const showPlaylistRef = useRef(showPlaylist);
  showPlaylistRef.current = showPlaylist;

  // Navigate to next video in playlist
  const navigateToNextVideo = useCallback(() => {
    if (!playlistData || !playlistData.videos || playlistData.videos.length === 0) {
      return;
    }

    const { playlist, videos, currentIndex } = playlistData;
    const nextIndex = currentIndex + 1;

    // Check if there's a next video
    if (nextIndex < videos.length) {
      const nextVideo = videos[nextIndex];
      navigate(`/watch?v=${nextVideo.author}/${nextVideo.permlink}&playlist=${playlist.id}&pos=${nextIndex}`, {
        state: { playlist, videos, currentIndex: nextIndex },
      });
    }
  }, [playlistData, navigate]);

  const navigateToNextVideoRef = useRef(navigateToNextVideo);
  navigateToNextVideoRef.current = navigateToNextVideo;

  // Load video when author/permlink changes (wait for video element to be attached)
  useEffect(() => {
    if (!author || !permlink || author === 'unknown' || !player || !videoAttached) return;
    setVideoEnded(false);
    loadVideo(`${author}/${permlink}`).catch(err => {
      console.error('[Watch] Failed to load video:', err);
    });
  }, [author, permlink, player, loadVideo, videoAttached]);

  // Subscribe to player events (stable effect — uses refs for mutable values)
  useEffect(() => {
    if (!player) return;

    const unsubReady = player.on('ready', ({ isVertical }) => {
      videoIsVerticalRef.current = isVertical;
      wrapperRef.current?.classList.toggle('vertical-video', isVertical);

      // Auto-play
      player.play().catch(() => {});

      // Seek to timestamp if ?t= parameter is present
      const startTime = parseInt(new URLSearchParams(window.location.search).get('t'), 10);
      if (startTime > 0) {
        setTimeout(() => player.seek(startTime), 200);
      }

      // Fetch quality levels and apply stored preference
      const levels = player.getQualities();
      setQualityLevels(levels);

      const storedPref = localStorage.getItem(QUALITY_STORAGE_KEY);
      if (storedPref && storedPref !== 'auto' && levels.length > 0) {
        const preferredHeight = parseInt(storedPref, 10);
        // Find exact match or nearest available level at or below the stored height
        let best = null;
        for (const l of levels) {
          if (l.height === preferredHeight) { best = l; break; }
          if (l.height < preferredHeight && (!best || l.height > best.height)) {
            best = l;
          }
        }
        if (best) {
          player.setQuality(best.index);
          setCurrentQuality(best.index);
        } else {
          // All levels are above stored height — pick the lowest available
          const lowest = levels.reduce((a, b) => a.height < b.height ? a : b);
          player.setQuality(lowest.index);
          setCurrentQuality(lowest.index);
        }
      } else {
        setCurrentQuality(player.getCurrentQuality());
      }
    });

    const unsubQuality = player.on('qualitychange', (level) => {
      setCurrentQuality(level.index);
    });

    const unsubEnded = player.on('ended', () => {
      if (playlistDataRef.current && showPlaylistRef.current) {
        navigateToNextVideoRef.current();
      } else {
        setVideoEnded(true);
      }
    });

    const unsubPlay = player.on('play', () => {
      setVideoEnded(false);
    });

    return () => {
      unsubReady();
      unsubQuality();
      unsubEnded();
      unsubPlay();
    };
  }, [player]);

  // Ambient glow: draw video frames to a tiny canvas, CSS blur does the rest
  const pageGlowRef = useRef(null);

  useEffect(() => {
    const canvas = pageGlowRef.current;
    if (!canvas) return;

    if (glowMode === 'off') {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const video = player?.element;
    if (!video) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) return;

    canvas.width = 32;
    canvas.height = 18;

    let rafId = null;
    let lastDraw = 0;
    const FPS_INTERVAL = 1000 / 4;

    const draw = (now) => {
      rafId = requestAnimationFrame(draw);
      if (now - lastDraw < FPS_INTERVAL) return;
      lastDraw = now;
      if (video.readyState >= 2 && !video.paused) {
        ctx.drawImage(video, 0, 0, 32, 18);
      }
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [player, videoAttached, glowMode]);

  // Handle quality change with optimistic UI update + persist preference
  const handleQualityChange = useCallback((level) => {
    setCurrentQuality(level);
    sdkSetQuality(level);
    // Persist: store the height for cross-video matching, or 'auto'
    if (level === -1) {
      localStorage.setItem(QUALITY_STORAGE_KEY, 'auto');
    } else {
      const match = qualityLevels.find(q => q.index === level);
      if (match) localStorage.setItem(QUALITY_STORAGE_KEY, String(match.height));
    }
  }, [sdkSetQuality, qualityLevels]);

  // Handle replay (when video ended)
  const handleReplay = useCallback(() => {
    if (!player) return;
    player.seek(0);
    player.play().catch(() => {});
    setVideoEnded(false);
  }, [player]);

  // Comment-based timeline markers
  const [commentMarkers, setCommentMarkers] = useState(null);
  const [markersRefreshKey, setMarkersRefreshKey] = useState(0);
  const refreshMarkers = useCallback(() => setMarkersRefreshKey(k => k + 1), []);

  useEffect(() => {
    if (!author || !permlink || author === 'unknown') return;
    let cancelled = false;

    (async () => {
      try {
        const replies = await hiveClient.call('condenser_api', 'get_content_replies', [author, permlink]);
        if (cancelled || !replies || replies.length === 0) return;

        // Pre-render comment bodies as HTML
        let render;
        try { render = await getRenderer(); } catch (e) { render = null; }

        // Only include comments that have parentTimestamp in their metadata
        const markers = [];
        for (const comment of replies) {
          let meta = {};
          try { meta = typeof comment.json_metadata === 'string' ? JSON.parse(comment.json_metadata) : (comment.json_metadata || {}); } catch (_) {}
          const parentTimestamp = typeof meta.parentTimestamp === 'number' ? meta.parentTimestamp : null;

          const replyCount = comment.children || 0;
          let bodyHtml = '';
          if (render && comment.body) {
            try { bodyHtml = render(comment.body); } catch (_) { bodyHtml = comment.body; }
          } else {
            bodyHtml = comment.body || '';
          }

          // Detect video reactions by checking for video metadata
          // Ensure the URL points to play.3speak.tv for proper iframe embedding
          let videoUrl = meta.video?.url || null;
          if (videoUrl && !videoUrl.includes('play.3speak.tv')) {
            // Try to extract video ID from embed.3speak.tv or other URL formats
            // and convert to play.3speak.tv/embed?v=user/videoId
            const match = videoUrl.match(/embed\.3speak\.tv\/(?:watch|embed|uploads)\/(.+)/);
            if (match) {
              videoUrl = `https://play.3speak.tv/embed?v=${comment.author}/${match[1]}`;
            }
          }

          markers.push({
            pct: parentTimestamp,
            pctIsSeconds: true,
            avatar: `https://images.hive.blog/u/${comment.author}/avatar`,
            label: comment.author,
            permlink: comment.permlink,
            replyCount,
            body: bodyHtml,
            isVideo: !!videoUrl,
            videoUrl,
          });
        }

        // Batch-fetch reputations and mark low-rep authors
        const authors = markers.map(m => m.label);
        const reputations = await batchGetReputations(authors);
        for (const m of markers) {
          const rep = reputations.get(m.label) ?? 25;
          m.isLowReputation = rep < LOW_REP_THRESHOLD;
        }

        // Sort by timestamp: timestamped first (ascending), then no-timestamp at end
        markers.sort((a, b) => {
          if (a.pct === null && b.pct === null) return 0;
          if (a.pct === null) return 1;
          if (b.pct === null) return -1;
          return a.pct - b.pct;
        });

        if (!cancelled) setCommentMarkers(markers);
      } catch (err) {
        console.error('Failed to fetch comments for markers:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [author, permlink, markersRefreshKey]);

  // Resolve markers with actual time values when duration is known
  const resolvedMarkers = useMemo(() => {
    if (!commentMarkers || playerState.duration <= 0) return undefined;
    return commentMarkers
      .filter(m => m.pct !== null)
      .map(m => ({
        time: Math.round(m.pct),
        avatar: m.avatar,
        label: m.label,
        replyCount: m.replyCount,
        isVideo: m.isVideo,
      }));
  }, [commentMarkers, playerState.duration]);

  // Reaction player state
  const [selectedReactionIndex, setSelectedReactionIndex] = useState(0);
  const [isReactionPlayerVisible, setIsReactionPlayerVisible] = useState(() => {
    return localStorage.getItem('3speak-reactions-visible') !== 'false';
  });
  const [reactionSize, setReactionSize] = useState(() => {
    return localStorage.getItem('3speak-reaction-size') || 'standard';
  });

  const setReactionsVisible = useCallback((visible) => {
    setIsReactionPlayerVisible(visible);
    localStorage.setItem('3speak-reactions-visible', String(visible));
  }, []);

  const handleAddReaction = useCallback(() => {
    const textarea = document.querySelector('.add-comment-wrap .textarea-box');
    if (textarea) {
      textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => textarea.focus(), 400);
    }
  }, []);

  const handleReactToMoment = useCallback(() => {
    // Exit fullscreen first if active
    const wrapper = wrapperRef.current;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else if (wrapper?.classList.contains('landscape-fullscreen')) {
      wrapper.classList.remove('landscape-fullscreen');
      setIsFullscreen(false);
    }

    // Activate the React tab in the comment section
    const reactTab = document.querySelector('.comment-tabs .comment-tab:nth-child(2)');
    if (reactTab) reactTab.click();
    // Wait for React to render the tab content, then scroll it into view
    setTimeout(() => {
      const addCommentWrap = document.querySelector('.add-comment-wrap');
      if (addCommentWrap) {
        addCommentWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }, []);

  const REACTION_SIZES = ['medium', 'standard', 'large'];
  const REACTION_SIZE_LABELS = { medium: 'Medium', standard: 'Standard', large: 'Cinema' };
  const cycleReactionSize = useCallback(() => {
    setReactionSize(prev => {
      const idx = REACTION_SIZES.indexOf(prev);
      const next = REACTION_SIZES[(idx + 1) % REACTION_SIZES.length];
      localStorage.setItem('3speak-reaction-size', next);
      return next;
    });
  }, []);

  // Desktop: show controls on mouse movement, auto-hide after 3s
  const showControlsTemporarily = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
  }, []);

  // Mobile: tap toggles controls on/off (with auto-hide when showing)
  const toggleControlsVisibility = useCallback(() => {
    setControlsVisible(prev => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (prev) return false;
      hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
      return true;
    });
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    // If currently in CSS landscape-fullscreen, exit that first
    if (wrapper.classList.contains('landscape-fullscreen')) {
      wrapper.classList.remove('landscape-fullscreen');
      setIsFullscreen(false);
      return;
    }

    if (!document.fullscreenElement) {
      fullscreenFromButtonRef.current = true;
      wrapper.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, []);

  // Auto CSS-fullscreen when phone rotates to landscape (horizontal videos only)
  // Note: the Fullscreen API requires a user gesture, so we use a CSS class instead
  useEffect(() => {
    if (!screen.orientation) return;

    const handleOrientationChange = () => {
      // Don't interfere when real fullscreen is active (triggered by button)
      if (document.fullscreenElement) return;

      const wrapper = wrapperRef.current;
      if (!wrapper) return;

      const isLandscape = screen.orientation.type.startsWith('landscape');
      if (isLandscape && !videoIsVerticalRef.current) {
        wrapper.classList.add('landscape-fullscreen');
        setIsFullscreen(true);
      } else if (wrapper.classList.contains('landscape-fullscreen')) {
        wrapper.classList.remove('landscape-fullscreen');
        setIsFullscreen(false);
      }
    };

    screen.orientation.addEventListener('change', handleOrientationChange);
    return () => screen.orientation.removeEventListener('change', handleOrientationChange);
  }, []);

  // Fullscreen change handler (orientation lock)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);

      // Lock screen orientation only when fullscreen was triggered by the button
      if (screen.orientation?.lock && fullscreenFromButtonRef.current) {
        if (isNowFullscreen) {
          const lockType = videoIsVerticalRef.current ? 'portrait' : 'landscape';
          screen.orientation.lock(lockType).catch(() => {});
        } else {
          screen.orientation.unlock?.();
        }
      }
      fullscreenFromButtonRef.current = false;
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // PiP handler — SDK operates directly on the native <video> element
  const handleTogglePip = useCallback(() => {
    togglePip();
  }, [togglePip]);

  const { data: videoData, loading: videoLoading, error: videoError, refetch: refetchVideo } = useQuery(GET_VIDEO_DETAILS, {
    variables: { author, permlink },
  });

  // Hive fallback: when GraphQL doesn't have the video, fetch directly from blockchain
  const [hiveFallback, setHiveFallback] = useState(null);
  const [hiveFallbackLoading, setHiveFallbackLoading] = useState(false);

  useEffect(() => {
    if (videoLoading || videoData?.socialPost || !author || author === 'unknown') return;

    let cancelled = false;
    setHiveFallbackLoading(true);

    (async () => {
      try {
        const post = await hiveClient.call('condenser_api', 'get_content', [author, permlink]);
        if (cancelled || !post || !post.author) { setHiveFallbackLoading(false); return; }

        let meta = {};
        try { meta = JSON.parse(post.json_metadata || '{}'); } catch (_) {}
        const videoInfo = meta.video?.info || {};

        // Build play_url from video metadata
        let play_url = videoInfo.video_v2 || videoInfo.file || null;
        if (!play_url && videoInfo.sourceMap) {
          const videoSource = videoInfo.sourceMap.find(s => s.type === 'video');
          if (videoSource) play_url = videoSource.url;
        }

        // Build thumbnail from metadata
        let thumbnail_url = null;
        if (videoInfo.sourceMap) {
          const thumbSource = videoInfo.sourceMap.find(s => s.type === 'thumbnail');
          if (thumbSource) thumbnail_url = thumbSource.url;
        }
        if (!thumbnail_url && meta.image?.[0]) thumbnail_url = meta.image[0];

        const payout = parseFloat(post.total_payout_value) + parseFloat(post.curator_payout_value) + parseFloat(post.pending_payout_value || '0');

        setHiveFallback({
          title: post.title,
          body: post.body,
          author: {
            id: post.author,
            username: post.author,
            profile: { name: post.author, images: { avatar: `https://images.hive.blog/u/${post.author}/avatar` } },
          },
          stats: {
            num_comments: post.children || 0,
            num_votes: post.active_votes?.length || 0,
            total_hive_reward: payout,
          },
          community: post.category ? { _id: post.category, title: post.category } : null,
          created_at: post.created,
          tags: meta.tags || [],
          parent_permlink: post.parent_permlink,
          spkvideo: play_url ? { play_url, thumbnail_url, duration: videoInfo.duration || 0 } : null,
          _hiveFallback: true,
        });
      } catch (err) {
        console.error('Hive fallback failed:', err);
      } finally {
        if (!cancelled) setHiveFallbackLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [videoLoading, videoData, author, permlink]);

  const videoDetails = videoData?.socialPost || hiveFallback;

  // Record watch history when video loads (if tracking is enabled)
  useEffect(() => {
    if (!user || !author || !permlink || author === 'unknown' || watchHistoryEnabled === false) {
      return;
    }

    const watchKey = `${author}/${permlink}`;
    if (recordedWatchRef.current.has(watchKey)) {
      return; // Already recorded this video in this session
    }

    // Mark as recorded and send to API
    recordedWatchRef.current.add(watchKey);
    recordWatch(user, author, permlink);
  }, [user, author, permlink, watchHistoryEnabled]);

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

  // Build reactions from comment markers: video reactions use the embed URL from metadata
  const reactions = useMemo(() => {
    if (!commentMarkers) return [];
    return commentMarkers
      .filter(m => !m.isLowReputation)
      .map((m, i) => {
        const base = {
          id: `reaction-${i}`,
          author: m.label,
          avatar: m.avatar,
          replyCount: m.replyCount,
          pct: m.pct,
          pctIsSeconds: m.pctIsSeconds,
        };
        if (m.isVideo && m.videoUrl) {
          return {
            ...base,
            type: 'video',
            videoUrl: m.videoUrl,
            permlink: m.permlink,
            body: m.body,
          };
        }
        return {
          ...base,
          type: 'comment',
          body: m.body,
          permlink: m.permlink,
        };
      });
  }, [commentMarkers]);

  const reactionCountLabel = useMemo(() => {
    const videoCount = reactions.filter(r => r.type === 'video').length;
    const commentCount = reactions.length - videoCount;
    return (
      <>
        {videoCount > 0 && <><MdVideocam size={14} /> {videoCount}</>}
        {videoCount > 0 && commentCount > 0 && <span style={{ margin: '0 4px' }}>·</span>}
        {commentCount > 0 && <><MdChatBubble size={12} /> {commentCount}</>}
      </>
    );
  }, [reactions]);

  const handleSelectReaction = useCallback((index) => {
    if (index < 0 || index >= (reactions?.length ?? 0)) return;
    setSelectedReactionIndex(index);
    setReactionsVisible(true);
    // Seek main video to this reaction's timeline position
    const reaction = reactions[index];
    if (reaction && playerState.duration > 0) {
      seek(reaction.pct);
    }
  }, [reactions, playerState.duration, seek]);

  // When loading with ?t= parameter and reactions are available, select the closest reaction
  const initialReactionSetRef = useRef(false);
  useEffect(() => {
    if (initialReactionSetRef.current) return;
    if (!reactions || reactions.length === 0) return;
    const startTime = parseInt(searchParams.get('t'), 10);
    if (!(startTime > 0)) return;

    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < reactions.length; i++) {
      const dist = Math.abs(reactions[i].pct - startTime);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }

    initialReactionSetRef.current = true;
    setSelectedReactionIndex(closestIdx);
    setReactionsVisible(true);
  }, [reactions, searchParams]);

  const isNetworkError = videoError && videoError.networkError;
  const isLoading = videoLoading || hiveFallbackLoading || (suggestionsLoading && trendingLoading && authorVideosLoading);

  if (isLoading) {
    return <BarLoader />;
  }

  if (videoError || !videoDetails) {
    return (
      <div className="watch-error">
        <p>{isNetworkError ? 'Network error. Please check your connection.' : videoError ? 'Error loading video.' : 'Video not found or failed to load.'}</p>
        <button className="watch-error-retry" onClick={() => refetchVideo()}>Retry</button>
      </div>
    );
  }

  return (
    <div className={`play-container${isReactionPlayerVisible && reactions.length > 0 ? ` reaction-${reactionSize}` : ''}`}>
      {/* Page-level ambient glow canvas — lives outside .play-video so it can cover the full page background */}
      <canvas className={`page-glow-canvas${glowMode === 'page' ? ' active' : ''}`} ref={pageGlowRef} aria-hidden="true" />
      <PlayVideo
        videoDetails={videoDetails}
        author={author}
        permlink={permlink}
        videoRef={videoRef}
        wrapperRef={wrapperRef}
        playlistData={showPlaylist ? playlistData : null}
        onClosePlaylist={() => setShowPlaylist(false)}
        videoControls={{
          currentTime: playerState.currentTime,
          duration: playerState.duration,
          buffered: playerState.buffered,
          isPlaying: !playerState.paused,
          isMuted: playerState.muted,
          isFullscreen,
          isVisible: controlsVisible,
          onTogglePlay: togglePlay,
          onToggleMute: () => setMuted(!playerState.muted),
          onSeekBackward: () => seek(Math.max(0, playerState.currentTime - 10)),
          onSeekForward: () => seek(Math.min(playerState.duration, playerState.currentTime + 10)),
          onSeek: seek,
          onRefreshReactions: refreshMarkers,
          onToggleFullscreen: handleToggleFullscreen,
          onMouseMove: showControlsTemporarily,
          onToggleControls: toggleControlsVisibility,
          onPause: pause,
          onReactToMoment: handleReactToMoment,
          markers: resolvedMarkers,
          onMarkerSelect: handleSelectReaction,
          onCycleReactionSize: isReactionPlayerVisible && reactions.length > 0 ? cycleReactionSize : null,
          reactionSizeLabel: REACTION_SIZE_LABELS[reactionSize] || reactionSize,
          onTogglePip: handleTogglePip,
          videoEnded,
          onReplay: handleReplay,
          qualityLevels,
          currentQuality,
          onQualityChange: handleQualityChange,
          glowMode,
          onToggleGlow: toggleGlow,
        }}
        mobileReactionPanel={
          <>
            {isReactionPlayerVisible && reactions.length > 0 && (
              <ReactionPlayer
                reactions={reactions}
                selectedIndex={selectedReactionIndex}
                onSelectReaction={handleSelectReaction}
                onClose={() => setReactionsVisible(false)}
                size={reactionSize}
                onCycleSize={cycleReactionSize}
                currentTime={playerState.currentTime}
                duration={playerState.duration}
                mainIsPlaying={!playerState.paused}
                onReactionPlay={pause}
                mobile
              />
            )}
            {!isReactionPlayerVisible && reactions.length > 0 && (
              <button className="show-reactions-btn" onClick={() => setReactionsVisible(true)}>
                Show Reactions ({reactionCountLabel})
              </button>
            )}
            {reactions.length === 0 && (
              <button className="show-reactions-btn" onClick={handleAddReaction}>
                Add Reaction
              </button>
            )}
          </>
        }
      />

      {/* Right column: Reaction Player + Recommended */}
      <div className="right-column">
        {isReactionPlayerVisible && reactions.length > 0 && (
          <ReactionPlayer
            reactions={reactions}
            selectedIndex={selectedReactionIndex}
            onSelectReaction={handleSelectReaction}
            onClose={() => setReactionsVisible(false)}
            size={reactionSize}
            currentTime={playerState.currentTime}
            duration={playerState.duration}
            mainIsPlaying={!playerState.paused}
            onReactionPlay={pause}
          />
        )}
        {!isReactionPlayerVisible && reactions.length > 0 && (
          <button className="show-reactions-btn" onClick={() => setReactionsVisible(true)}>
            Show Reactions ({reactionCountLabel})
          </button>
        )}
        {reactions.length === 0 && (
          <button className="show-reactions-btn" onClick={handleAddReaction}>
            Add Reaction
          </button>
        )}

        {suggestedVideos.length > 0 && (
          <div className="right-column-videos">
            <h4>More videos</h4>
            <Card3 videos={suggestedVideos} loading={false} shortTimeAgo={false} />
          </div>
        )}
      </div>

      {suggestedVideos.length > 0 && (
        <div className="mobile-recommended">
          <h4>More videos</h4>
          <Card3 videos={suggestedVideos.slice(0, 12)} loading={false} shortTimeAgo={false} />
        </div>
      )}
    </div>
  );
}

export default Watch;
