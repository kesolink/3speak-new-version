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

  // Send command to the player iframe
  const sendPlayerCommand = useCallback((command) => {
    const iframe = document.querySelector('.video-iframe-wrapper iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: command }, '*');
    }
  }, []);

  const triggerPlay = useCallback(() => {
    sendPlayerCommand('play');
  }, [sendPlayerCommand]);

  // Video playback state for custom controls
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const hideTimerRef = useRef(null);

  // Comment-based timeline markers
  const [commentMarkers, setCommentMarkers] = useState(null);

  useEffect(() => {
    if (!author || !permlink || author === 'unknown') return;
    let cancelled = false;

    (async () => {
      try {
        const replies = await hiveClient.call('condenser_api', 'get_content_replies', [author, permlink]);
        if (cancelled || !replies || replies.length === 0) return;

        // Pick 3 random indices to simulate video reactions, rest are comments
        const videoIndices = new Set();
        const shuffled = [...Array(replies.length).keys()].sort(() => Math.random() - 0.5);
        for (let i = 0; i < Math.min(3, shuffled.length); i++) {
          videoIndices.add(shuffled[i]);
        }

        // Pre-render comment bodies as HTML
        let render;
        try { render = await getRenderer(); } catch (e) { render = null; }

        // Build markers from top-level comments, placed randomly on the timeline
        const markers = replies.map((comment, i) => {
          const replyCount = comment.children || 0;
          let bodyHtml = '';
          if (render && comment.body) {
            try { bodyHtml = render(comment.body); } catch (_) { bodyHtml = comment.body; }
          } else {
            bodyHtml = comment.body || '';
          }
          return {
            pct: Math.random(),
            avatar: `https://images.hive.blog/u/${comment.author}/avatar`,
            label: comment.author,
            permlink: comment.permlink,
            replyCount,
            body: bodyHtml,
            isVideo: videoIndices.has(i),
          };
        });

        // Sort by position so they render left-to-right
        markers.sort((a, b) => a.pct - b.pct);

        if (!cancelled) setCommentMarkers(markers);
      } catch (err) {
        console.error('Failed to fetch comments for markers:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [author, permlink]);

  // Resolve markers with actual time values when duration is known
  const resolvedMarkers = useMemo(() => {
    if (!commentMarkers || videoDuration <= 0) return undefined;
    return commentMarkers.map(m => ({
      time: Math.round(m.pct * videoDuration),
      avatar: m.avatar,
      label: m.label,
      replyCount: m.replyCount,
      isVideo: m.isVideo,
    }));
  }, [commentMarkers, videoDuration]);

  // Reaction player state
  const [selectedReactionIndex, setSelectedReactionIndex] = useState(0);
  const [isReactionPlayerVisible, setIsReactionPlayerVisible] = useState(true);
  const [reactionSize, setReactionSize] = useState(() => {
    return localStorage.getItem('3speak-reaction-size') || 'small';
  });

  const cycleReactionSize = useCallback(() => {
    setReactionSize(prev => {
      const next = prev === 'small' ? 'medium' : prev === 'medium' ? 'big' : 'small';
      localStorage.setItem('3speak-reaction-size', next);
      return next;
    });
  }, []);

  const showControlsTemporarily = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
  }, []);

  const pauseMainPlayer = useCallback(() => {
    sendPlayerCommand('pause');
    setIsPlaying(false);
  }, [sendPlayerCommand]);

  const handleTogglePlay = useCallback(() => {
    sendPlayerCommand('toggle-play');
    setIsPlaying(prev => !prev);
  }, [sendPlayerCommand]);

  const handleToggleMute = useCallback(() => {
    sendPlayerCommand('toggle-mute');
    setIsMuted(prev => !prev);
  }, [sendPlayerCommand]);

  const handleSeekBackward = useCallback(() => {
    const iframe = document.querySelector('.video-iframe-wrapper iframe');
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'seekBackward', seconds: 10 }, '*');
    }
  }, []);

  const handleSeekForward = useCallback(() => {
    const iframe = document.querySelector('.video-iframe-wrapper iframe');
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'seekForward', seconds: 10 }, '*');
    }
  }, []);

  const handleSeek = useCallback((time) => {
    const iframe = document.querySelector('.video-iframe-wrapper iframe');
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'seek', time }, '*');
    }
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    const wrapper = document.querySelector('.video-iframe-wrapper');
    if (!wrapper) return;
    if (!document.fullscreenElement) {
      wrapper.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, []);

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

  // Listen for player messages (only from main player iframe, not reaction player)
  useEffect(() => {
    const handleMessage = (event) => {
      if (!event.data || !event.data.type) return;

      // Only handle messages from the main video player, ignore reaction player iframes
      const mainIframe = document.querySelector('.video-iframe-wrapper iframe');
      if (event.source && mainIframe && event.source !== mainIframe.contentWindow) return;

      switch (event.data.type) {
        case '3speak-player-ready':
          setTimeout(() => { triggerPlay(); setIsPlaying(true); }, 100);
          if (mainIframe?.contentWindow) {
            mainIframe.contentWindow.postMessage({ type: 'hide-controls' }, '*');
          }
          break;
        case '3speak-timeupdate':
          setCurrentTime(event.data.currentTime ?? 0);
          if (event.data.duration) setVideoDuration(event.data.duration);
          break;
        case '3speak-playstate':
          setIsPlaying(event.data.isPlaying ?? false);
          break;
        case '3speak-durationchange':
          setVideoDuration(event.data.duration ?? 0);
          break;
        case '3speak-ended':
          setIsPlaying(false);
          if (playlistData && showPlaylist) {
            navigateToNextVideo();
          }
          break;
      }
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    window.addEventListener('message', handleMessage);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      window.removeEventListener('message', handleMessage);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [triggerPlay, playlistData, showPlaylist, navigateToNextVideo]);

  const { data: videoData, loading: videoLoading, error: videoError } = useQuery(GET_VIDEO_DETAILS, {
    variables: { author, permlink },
  });

  const videoDetails = videoData?.socialPost;

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

  // Build reactions from comment markers: 3 video reactions + rest are comments
  // Note: no dependency on videoDuration to keep the array reference stable
  const reactions = useMemo(() => {
    if (!commentMarkers) return [];
    let videoIdx = 0;
    return commentMarkers.slice(0, 10).map((m, i) => {
      const base = {
        id: `reaction-${i}`,
        author: m.label,
        avatar: m.avatar,
        replyCount: m.replyCount,
        pct: m.pct,
      };
      if (m.isVideo && suggestedVideos.length > 0) {
        const video = suggestedVideos[videoIdx % suggestedVideos.length];
        const videoAuthor = video?.author?.username || video?.author?.id || video?.author || video?.owner;
        videoIdx++;
        return {
          ...base,
          type: 'video',
          videoUrl: `${PLAYER_URL}/watch?v=${videoAuthor}/${video.permlink}&layout=desktop&mode=iframe`,
        };
      }
      return {
        ...base,
        type: 'comment',
        body: m.body,
        permlink: m.permlink,
      };
    });
  }, [commentMarkers, suggestedVideos]);

  const handleSelectReaction = useCallback((index) => {
    if (index < 0 || index >= (reactions?.length ?? 0)) return;
    setSelectedReactionIndex(index);
    setIsReactionPlayerVisible(true);
    // Seek main video to this reaction's timeline position
    const reaction = reactions[index];
    if (reaction && videoDuration > 0) {
      handleSeek(reaction.pct * videoDuration);
    }
  }, [reactions, videoDuration, handleSeek]);

  const isNetworkError = videoError && videoError.networkError;
  const isLoading = videoLoading || (suggestionsLoading && trendingLoading && authorVideosLoading);

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
    <div className={`play-container${isReactionPlayerVisible && reactions.length > 0 ? ` reaction-${reactionSize}` : ''}`}>
      <PlayVideo
        videoDetails={videoDetails}
        author={author}
        permlink={permlink}
        playlistData={showPlaylist ? playlistData : null}
        onClosePlaylist={() => setShowPlaylist(false)}
        videoControls={{
          currentTime,
          duration: videoDuration,
          isPlaying,
          isMuted,
          isFullscreen,
          isVisible: controlsVisible,
          onTogglePlay: handleTogglePlay,
          onToggleMute: handleToggleMute,
          onSeekBackward: handleSeekBackward,
          onSeekForward: handleSeekForward,
          onSeek: handleSeek,
          onToggleFullscreen: handleToggleFullscreen,
          onMouseMove: showControlsTemporarily,
          markers: resolvedMarkers,
          onMarkerSelect: handleSelectReaction,
        }}
      />

      {/* Right column: Reaction Player + Recommended */}
      <div className="right-column">
        {isReactionPlayerVisible && reactions.length > 0 && (
          <ReactionPlayer
            reactions={reactions}
            selectedIndex={selectedReactionIndex}
            onSelectReaction={handleSelectReaction}
            onClose={() => setIsReactionPlayerVisible(false)}
            size={reactionSize}
            onCycleSize={cycleReactionSize}
            currentTime={currentTime}
            duration={videoDuration}
            mainIsPlaying={isPlaying}
            onReactionPlay={pauseMainPlayer}
          />
        )}

        {suggestedVideos.length > 0 && (
          <div className="right-column-videos">
            <h4>More videos</h4>
            <Card3 videos={suggestedVideos} loading={false} />
          </div>
        )}
      </div>

      {suggestedVideos.length > 0 && (
        <div className="mobile-recommended">
          {isReactionPlayerVisible && reactions.length > 0 && (
            <ReactionPlayer
              reactions={reactions}
              selectedIndex={selectedReactionIndex}
              onSelectReaction={handleSelectReaction}
              onClose={() => setIsReactionPlayerVisible(false)}
              size={reactionSize}
              onCycleSize={cycleReactionSize}
              currentTime={currentTime}
              duration={videoDuration}
              mainIsPlaying={isPlaying}
              onReactionPlay={pauseMainPlayer}
              mobile
            />
          )}
          <h4>More videos</h4>
          <Card3 videos={suggestedVideos.slice(0, 12)} loading={false} />
        </div>
      )}
    </div>
  );
}

export default Watch;
