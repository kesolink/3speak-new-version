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
  Send
} from 'lucide-react';
import { GiTwoCoins } from 'react-icons/gi';
import hiveApi from '../hive-api/hiveApi';
import { useAppStore } from '../lib/store';
// import CommentVoteTooltip from '../tooltip/CommentVoteTooltip';
import axios from 'axios';
import { toast } from 'sonner';
import CommentVoteTooltip from '../components/tooltip/CommentVoteTooltip';


/* ================= COMPONENT ================= */
const VideoShort = () => {
  const { user } = useAppStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [videos, setVideos] = useState([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

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

  const accessToken = localStorage.getItem("access_token");

  // Minimum swipe distance to trigger navigation (in pixels)
  const minSwipeDistance = 50;

  /* ---------- 3SPEAK POSTMESSAGE API ---------- */

  const sendCommand = useCallback((command, data = {}) => {
    const iframe = document.getElementById('controlled-player');
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: command, ...data }, '*');
    }
  }, []);

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

      switch (data.type) {
        case '3speak-player-ready':
          const iframe = document.getElementById('controlled-player');
          if (iframe && data.isVertical !== undefined) {
            if (data.isVertical) {
              iframe.style.position = 'absolute';
              iframe.style.top = '0';
              iframe.style.left = '50%';
              iframe.style.transform = 'translateX(-50%)';
              iframe.style.width = 'auto';
              iframe.style.height = '100%';
              iframe.style.aspectRatio = '9 / 16';
            } else {
              iframe.style.position = 'absolute';
              iframe.style.top = '50%';
              iframe.style.left = '0';
              iframe.style.transform = 'translateY(-50%)';
              iframe.style.width = '100%';
              iframe.style.height = 'auto';
              iframe.style.aspectRatio = '16 / 9';
            }
          }
          setTimeout(() => sendCommand('play'), 100);
          break;

        case '3speak-timeupdate':
          if (!isScrubbing && data.duration > 0) {
            setCurrentTime(data.currentTime || 0);
            setDuration(data.duration);
            if (data.paused !== undefined) {
              setIsPlaying(!data.paused);
            }
          }
          break;

        case '3speak-durationchange':
          setDuration(data.duration || 0);
          break;

        case '3speak-play':
          setIsPlaying(true);
          break;

        case '3speak-pause':
          setIsPlaying(false);
          break;

        case '3speak-ended':
          setIsPlaying(false);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [sendCommand, isScrubbing]);

  // Reset player state when video changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [currentIndex]);

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

        const data = await hiveApi.fetchShortsWithDetails(1, 10);

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
            isLiked: false,
            isDisliked: false,
            comments: [],
            commentsLoaded: false,
            timeAgo: short.timeAgo,
            createdAt: short.createdAt
          }));

          setVideos(formattedVideos);
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
  }, []);

  /* ---------- LOAD MORE VIDEOS ---------- */
  const loadMoreVideos = useCallback(async () => {
    if (!hasMore || loading) return;

    const nextPage = page + 1;
    setPage(nextPage);

    try {
      const data = await hiveApi.fetchShortsWithDetails(nextPage, 10);

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
          isLiked: false,
          isDisliked: false,
          comments: [],
          commentsLoaded: false,
          timeAgo: short.timeAgo,
          createdAt: short.createdAt
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
      const comments = await hiveApi.fetchPostComments(video.author, video.hivePermlink);

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

  /* ---------- TOUCH/SWIPE HANDLERS FOR MOBILE ---------- */

  const onTouchStart = (e) => {
    // Don't handle swipe if comments panel is open
    if (showComments) return;
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientY);
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

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

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
      <div className={`videoWrapper ${showComments ? 'with-comments' : ''}`}>

        {/* VIDEO */}
        <div
          className="videoContainer"
          ref={videoContainerRef}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <iframe
            id="controlled-player"
            key={currentVideo.id}
            src={`https://play.3speak.tv/embed?v=${currentVideo.author}/${currentVideo.permlink}&mode=iframe&controls=0`}
            width="100%"
            height="100%"
            frameBorder="0"
            allow="autoplay; fullscreen"
            allowFullScreen
          />

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

          {/* Bottom overlay */}
          <div className="bottomOverlay">
            <div className="userRow">
              <div className="avatar">
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
            <div className="actionButton">
              <ThumbsUp size={24} fill={currentVideo.isLiked ? "white" : "none"} />
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
            />
          </div>

          <div className="actionItem" onClick={(e) => { e.stopPropagation(); handleToggleComments(); }}>
            <div className={`actionButton ${showComments ? 'active' : ''}`}>
              <MessageSquare size={24} />
            </div>
            <span className="actionLabel">{currentVideo.stats.comments}</span>
          </div>

          <div className="actionItem" onClick={(e) => e.stopPropagation()}>
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

          <div className="albumArt" onClick={(e) => e.stopPropagation()}>
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
            <button className="headerBtn">
              <SlidersHorizontal size={20} />
            </button>
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
            <ThumbsUp size={14} fill={comment.has_voted ? "white" : "none"} />
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