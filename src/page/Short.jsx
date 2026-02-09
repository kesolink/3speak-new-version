import React, { useState, useEffect, useCallback, useRef } from 'react';
import "./Short.scss";
import {
  ThumbsUp,
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
  Camera
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
import hiveApi from '../hive-api/hiveApi';
import { useAppStore } from '../lib/store';
import axios from 'axios';
import { toast } from 'sonner';
import CommentVoteTooltip from '../components/tooltip/CommentVoteTooltip';
import { PLAYER_URL } from '../utils/config';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { fixVideoThumbnail } from '../utils/fixThumbnails';
import AuthorBadge from '../components/AuthorBadge/AuthorBadge';


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
  const shortHistoryRef = useRef([]); // Stack of {author, permlink} for back navigation

  // Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showPlayPauseIcon, setShowPlayPauseIcon] = useState(false);
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

  // Reply state
  const [activeReply, setActiveReply] = useState(null);
  const [replyText, setReplyText] = useState('');

  // Touch/swipe state for mobile navigation
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const progressBarRef = useRef(null);
  const playPauseTimeoutRef = useRef(null);
  const commentsFetchedRef = useRef(new Set());
  const videoContainerRef = useRef(null);
  const iframeRefs = useRef({}); // Store refs to all iframes by video id
  const keyboardRef = useRef(null); // capture keyboard events on mobile when focused
  const prevIndexRef = useRef(0); // Track previous index
  const readyPlayers = useRef(new Set()); // Track which players have sent 3speak-player-ready
  const pendingPlayRef = useRef(null); // Track video waiting to be played

  const accessToken = localStorage.getItem("access_token");
  const navigate = useNavigate();
  const location = useLocation();

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

  const togglePlayPause = useCallback((e) => {
    e.stopPropagation();
    sendCommand('toggle-play');

    setShowPlayPauseIcon(true);
    if (playPauseTimeoutRef.current) {
      clearTimeout(playPauseTimeoutRef.current);
    }
    playPauseTimeoutRef.current = setTimeout(() => {
      setShowPlayPauseIcon(false);
    }, 500);
  }, [sendCommand]);

  const seekTo = useCallback((time) => {
    sendCommand('seek', { time });
  }, [sendCommand]);

  const handleProgressBarInteraction = useCallback((e) => {
    if (!progressBarRef.current || duration === 0) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percentage * duration;

    seekTo(newTime);
    setCurrentTime(newTime);
  }, [duration, seekTo]);

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

          // If this video is waiting to be played (is current and was pending), play it now
          if (isFromCurrentVideo || pendingPlayRef.current === sourceVideoId) {
            console.log(`[VideoShort] Player ready - now playing: ${sourceVideoId}`);
            pendingPlayRef.current = null;
            setTimeout(() => {
              sourceIframe?.contentWindow?.postMessage({ type: 'play' }, '*');
            }, 50);
          }
          break;

        case '3speak-timeupdate':
          // Only update state if from current video
          if (isFromCurrentVideo && !isScrubbing && data.duration > 0) {
            setCurrentTime(data.currentTime || 0);
            setDuration(data.duration);
            if (data.paused !== undefined) {
              setIsPlaying(!data.paused);
            }
          }
          break;

        case '3speak-durationchange':
          if (isFromCurrentVideo) {
            setDuration(data.duration || 0);
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
          if (isFromCurrentVideo) {
            setIsPlaying(false);
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isScrubbing, videos, currentIndex]);

  // Handle video change - pause previous, play current
  useEffect(() => {
    const currentVid = videos[currentIndex];
    const prevIndex = prevIndexRef.current;
    const prevVid = videos[prevIndex];

    if (!currentVid) return;

    console.log(`[VideoShort] Index changed: ${prevIndex} -> ${currentIndex}, video: ${currentVid.id}`);

    // Update URL with current video (without page reload)
    updateUrlWithCurrentVideo(currentVid);

    // Reset player state
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setParentCardVisible(true);

    // Pause the previous video if different
    if (prevVid && prevVid.id !== currentVid.id) {
      console.log(`[VideoShort] Pausing previous video: ${prevVid.id}`);
      sendCommandToVideo(prevVid, 'pause');
    }

    // Check if the player is already ready
    const isPlayerReady = readyPlayers.current.has(currentVid.id);
    console.log(`[VideoShort] Player ready status for ${currentVid.id}: ${isPlayerReady}`);

    if (isPlayerReady) {
      // Player is ready, play immediately
      const iframe = iframeRefs.current[currentVid.id];
      if (iframe?.contentWindow) {
        console.log(`[VideoShort] Playing immediately (player ready): ${currentVid.id}`);
        iframe.contentWindow.postMessage({ type: 'play' }, '*');
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
            iframe.contentWindow.postMessage({ type: 'play' }, '*');
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

      // Update previous index
      prevIndexRef.current = currentIndex;

      // Cleanup
      return () => {
        timeouts.forEach(t => clearTimeout(t));
      };
    }

    // Update previous index
    prevIndexRef.current = currentIndex;
  }, [currentIndex, videos, sendCommandToVideo]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playPauseTimeoutRef.current) {
        clearTimeout(playPauseTimeoutRef.current);
      }
    };
  }, []);

  /* ---------- FETCH SHORTS DATA ---------- */
  useEffect(() => {
    const fetchShorts = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await hiveApi.fetchShortsWithDetails(1, 10, user);

        if (data.success) {
          console.log(data.shorts);
          const formattedVideos = data.shorts.map(short => ({
            id: short.id,
            author: short.author,
            permlink: short.permlink,
            hivePermlink: short.hivePermlink,
            user: {
              username: short.user.username,
              avatar: short.user.avatar,
              isSubscribed: false
            },
            caption: short.caption || short.title || '',
            audio: `${short.user.username} - Original Audio`,
            albumArt: short.user.avatar,
            stats: {
              likes: short.stats.likes,
              dislikes: short.stats.dislikes,
              comments: short.stats.comments,
              shares: short.stats.shares,
              remixes: short.stats.remixes,
              views: short.views,
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
          }));

          // Check if there's a shared video in the URL
          const sharedVideo = getSharedVideoFromUrl();
          
          if (sharedVideo) {
            // Find the index of the shared video in the feed
            const sharedIndex = formattedVideos.findIndex(
              v => v.author === sharedVideo.author && v.permlink === sharedVideo.permlink
            );

            if (sharedIndex !== -1) {
              // Video found in feed, start from that index
              setVideos(formattedVideos);
              setCurrentIndex(sharedIndex);
            } else {
              // Video not in current feed, search the API for the actual short data
              try {
                // Find the short in the API to get the correct embed_url (Hive permlink)
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

                // Prepend shared video to the feed
                setVideos([formattedSharedVideo, ...formattedVideos]);
                setCurrentIndex(0);
              } catch (err) {
                console.warn('Could not fetch shared video, showing feed from start:', err);
                setVideos(formattedVideos);
                // Update URL to first video since shared video couldn't be loaded
                if (formattedVideos.length > 0) {
                  updateUrlWithCurrentVideo(formattedVideos[0]);
                }
              }
            }
          } else {
            setVideos(formattedVideos);
            // Update URL with first video
            if (formattedVideos.length > 0) {
              updateUrlWithCurrentVideo(formattedVideos[0]);
            }
          }

          setHasMore(1 < data.totalPages);
        }
      } catch (err) {
        console.error('Error fetching shorts:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchShorts();
  }, [user, getSharedVideoFromUrl, updateUrlWithCurrentVideo]);

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

    // Save current short to history stack for back navigation
    const currentVid = videos[currentIndex];
    if (currentVid) {
      shortHistoryRef.current = [...shortHistoryRef.current, { author: currentVid.author, permlink: currentVid.permlink }];
    }

    // Check if it's already in the feed
    const existingIdx = videos.findIndex(
      v => v.author === targetAuthor && v.permlink === targetPermlink
    );

    if (existingIdx !== -1) {
      setCurrentIndex(existingIdx);
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
    if (!hasMore || loading) return;

    const nextPage = page + 1;
    setPage(nextPage);

    try {

      const data = await hiveApi.fetchShortsWithDetails(nextPage, 10, user);

      if (data.success) {
        const formattedVideos = data.shorts.map(short => ({
          id: short.id,
          author: short.author,
          permlink: short.permlink,
          hivePermlink: short.hivePermlink,
          user: {
            username: short.user.username,
            avatar: short.user.avatar,
            isSubscribed: false
          },
          caption: short.caption || short.title || '',
          audio: `${short.user.username} - Original Audio`,
          albumArt: short.user.avatar,
          stats: {
            likes: short.stats.likes,
            dislikes: short.stats.dislikes,
            comments: short.stats.comments,
            shares: short.stats.shares,
            remixes: short.stats.remixes,
            views: short.views,
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
        }));

        setVideos(prev => [...prev, ...formattedVideos]);
        setHasMore(nextPage < data.totalPages);
      }
    } catch (err) {
      console.error('Error loading more shorts:', err);
    }
  }, [hasMore, loading, page]);

  /* ---------- FETCH COMMENTS ---------- */
  const fetchComments = useCallback(async () => {
    const video = videos[currentIndex];
    if (!video || !video.hivePermlink || !video.author) return;

    if (commentsFetchedRef.current.has(video.id)) return;

    setCommentsLoading(true);
    commentsFetchedRef.current.add(video.id);

    try {
      const comments = await hiveApi.fetchPostComments(video.author, video.hivePermlink, user);

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
          // Add reply to the parent comment
          setVideos(prev =>
            prev.map((v, idx) => {
              if (idx !== currentIndex) return v;
              return {
                ...v,
                comments: addReplyToComment(v.comments, parentPermlink, newCommentObj)
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
    setVideos(prev => prev.map(v => {
      if (v.author === author && v.hivePermlink === permlink) {
        // Only increment likes count if it's a new vote (not a re-vote with different weight)
        const newLikes = isNewVote 
          ? (v.stats?.likes || 0) + 1 
          : v.stats?.likes || 0;
        return {
          ...v,
          isLiked: true, // Always set to true on successful vote
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

  /* ---------- NAVIGATION ---------- */

  const handlePrevious = () => {
    if (currentIndex === 0) return;
    setCurrentIndex(prev => prev - 1);
  };

  const handleNext = async () => {
    if (currentIndex === videos.length - 1) {
      if (hasMore) {
        await loadMoreVideos();
      }
      return;
    }
    setCurrentIndex(prev => prev + 1);

    if (currentIndex >= videos.length - 3 && hasMore) {
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrevious, showComments, isTransitioning]);

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
    }
  };

  /* ---------- TOUCH/SWIPE HANDLERS FOR MOBILE ---------- */

  const onTouchStart = (e) => {
    // Don't handle swipe if comments panel is open
    if (showComments) return;
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientY);
    // attempt to focus the hidden keyboard capture so mobile hardware keyboards send events
    try {
      keyboardRef.current?.focus?.();
    } catch (err) {
      // ignore
    }
  };

  const onTouchMove = (e) => {
    if (showComments) return;
    setTouchEnd(e.targetTouches[0].clientY);
  };

  const onTouchEnd = async () => {
    if (!touchStart || !touchEnd || showComments || isTransitioning) return;

    const distance = touchStart - touchEnd;
    const isSwipeUp = distance > minSwipeDistance;
    const isSwipeDown = distance < -minSwipeDistance;

    if (isSwipeUp && (currentIndex < videos.length - 1 || hasMore)) {
      // Swipe up = next video
      setIsTransitioning(true);
      await handleNext();
      setTimeout(() => setIsTransitioning(false), 300);
    } else if (isSwipeDown && currentIndex > 0) {
      // Swipe down = previous video
      setIsTransitioning(true);
      handlePrevious();
      setTimeout(() => setIsTransitioning(false), 300);
    }

    // Reset touch state
    setTouchStart(null);
    setTouchEnd(null);
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

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Calculate which videos to preload - keep more in memory
  const preloadRange = { before: 3, after: 6 };
  const preloadedIndices = [];
  for (let i = Math.max(0, currentIndex - preloadRange.before); i <= Math.min(videos.length - 1, currentIndex + preloadRange.after); i++) {
    preloadedIndices.push(i);
  }

  // Store iframe ref
  const setIframeRef = useCallback((videoId, element) => {
    if (element) {
      iframeRefs.current[videoId] = element;
    }
  }, []);

  // Clean up old iframe refs that are no longer in preload range
  useEffect(() => {
    const preloadedIds = new Set(preloadedIndices.map(idx => videos[idx]?.id).filter(Boolean));
    Object.keys(iframeRefs.current).forEach(id => {
      if (!preloadedIds.has(id)) {
        delete iframeRefs.current[id];
        // Also remove from ready players since the iframe is gone
        readyPlayers.current.delete(id);
      }
    });
  }, [preloadedIndices, videos]);

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
          className="videoContainer"
          ref={videoContainerRef}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Preloaded iframes for smooth playback */}
          {preloadedIndices.map((idx) => {
            const video = videos[idx];
            if (!video) return null;
            const isCurrent = idx === currentIndex;
            return (
              <iframe
                key={video.id}
                id={getPlayerId(video)}
                ref={(el) => setIframeRef(video.id, el)}
                src={`${PLAYER_URL}/embed?v=${video.author}/${video.permlink}&mode=iframe&controls=0`}
                width="100%"
                height="100%"
                frameBorder="0"
                allow="autoplay; fullscreen"
                allowFullScreen
                onLoad={(e) => {
                  console.log(`[VideoShort] Iframe loaded for video: ${video.id}, isCurrent: ${isCurrent}`);
                  // Store ref again on load in case it wasn't set
                  iframeRefs.current[video.id] = e.target;
                  
                  // Don't send play here - wait for 3speak-player-ready message
                  // The player inside the iframe needs time to initialize Video.js
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  opacity: isCurrent ? 1 : 0,
                  pointerEvents: 'none',
                  zIndex: isCurrent ? 1 : 0,
                }}
              />
            );
          })}

          {/* Transparent overlay for play/pause */}
          <div
            className="videoOverlay"
            onClick={togglePlayPause}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <div className={`playPauseIcon ${showPlayPauseIcon ? 'visible' : ''}`}>
              {isPlaying ? <Pause size={48} /> : <Play size={48} />}
            </div>
          </div>

          {/* Progress bar */}
          <div
            className="videoProgressBar"
            ref={progressBarRef}
            onMouseDown={handleProgressMouseDown}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="videoProgressFill" style={{ width: `${progressPercentage}%` }} />
            <div className="videoProgressHandle" style={{ left: `${progressPercentage}%` }} />
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
                                      <Link to={`/shorts?v=${step.shortAuthor}/${step.shortPermlink}`} className="chainActionBtn chainActionBtn--sm" onClick={(e) => e.stopPropagation()} title="Open short">
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
                                <Link to={`/shorts?v=${child.shortAuthor}/${child.shortPermlink}`} className="chainActionBtn chainActionBtn--sm" onClick={(e) => e.stopPropagation()} title="Open short">
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
            <div className="userRow">
              <div className="avatar" onClick={(e) => {
                    // e.preventDefault();
                    e.stopPropagation();
                    handleProfileNavigation(currentVideo.user.username);
                  }}>
                <img src={currentVideo.user.avatar} alt="" />
              </div>
              <span className="username">{currentVideo.user.username}</span>
              <button
                className="subscribeBtn"
                onClick={(e) => { e.stopPropagation(); handleSubscribe(); }}
              >
                {currentVideo.user.isSubscribed ? "Following" : "Follow"}
              </button>
            </div>
            <p className="caption">{currentVideo.caption}</p>
            <div className="audioMarquee">
              <Music2 size={16} />
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
              <ThumbsUp size={24} />
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
      <div className={`commentsPanel ${showComments ? 'open' : ''}`}>
        {/* Mobile drag handle */}
        <div className="commentsPanelHandle" />

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
  user
}) => {
  const [showReplies, setShowReplies] = useState(false);
  const maxDepth = 3;

  const isReplying = activeReply === comment.permlink;

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
        <p className="commentText">{comment.body}</p>
        <div className="commentActions">
          <button
            className={`commentActionBtn ${comment.has_voted ? 'liked' : ''}`}
            onClick={() => toggleVoteTooltip(comment.author, comment.permlink)}
          >
            <ThumbsUp size={14} />
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