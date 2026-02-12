import { useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { MdHistory, MdDelete } from 'react-icons/md';
import { IoArrowBack } from 'react-icons/io5';
import BarLoader from '../components/Loader/BarLoader';
import icon from '../../public/images/stack.png';
import { useAppStore } from '../lib/store';
import { getWatchHistory, deleteWatchHistoryEntry } from '../utils/watchHistory';
import { HIVE_API_URL } from '../utils/config';
import { toast } from 'sonner';
import { fixVideoThumbnail, fallbackImg } from '../utils/fixThumbnails';
import { findShortByEmbedUrl } from '../hive-api/hiveApi';
import './WatchedView.scss';

/**
 * Fetch video data from Hive for a list of watched items
 */
async function fetchVideosFromHistory(items) {
  if (!items?.length) return [];

  // Fetch all video data in parallel
  const videoPromises = items.map(async (item) => {
    try {
      const response = await axios.post(HIVE_API_URL, {
        jsonrpc: '2.0',
        method: 'condenser_api.get_content',
        params: [item.author, item.permlink],
        id: 1,
      });

      const post = response.data?.result;
      if (!post || !post.author) return null;

      // Parse json_metadata for video info
      let metadata = {};
      try {
        metadata = typeof post.json_metadata === 'string'
          ? JSON.parse(post.json_metadata)
          : post.json_metadata || {};
      } catch (e) {
        console.error('Error parsing metadata:', e);
      }

      // Extract thumbnail
      let thumbnail = null;
      if (metadata.image?.[0]) {
        thumbnail = metadata.image[0];
      }

      // Extract duration from video metadata
      const duration = metadata.video?.info?.duration || 0;

      // Detect shorts: use API flag first, fall back to metadata heuristics
      const isShort = item.short === true
        || (metadata.tags || []).includes('shorts')
        || (!!metadata.video?.platform && duration > 0 && duration <= 60);

      // For shorts, look up the player/embed permlink from the shorts DB
      let embedPermlink = null;
      if (isShort) {
        try {
          const shortEntry = await findShortByEmbedUrl(post.author, post.permlink);
          if (shortEntry) {
            embedPermlink = shortEntry.permlink;
          }
        } catch (e) {
          console.error('Failed to look up short embed permlink:', e);
        }
      }

      return {
        author: post.author,
        permlink: post.permlink,
        embedPermlink,
        title: post.title,
        created_at: post.created,
        images: { thumbnail },
        duration,
        isShort,
        watched_at: item.last_watched_at || item.watched_at,
        watch_count: item.watch_count || 1,
      };
    } catch (error) {
      console.error(`Error fetching video ${item.author}/${item.permlink}:`, error);
      return null;
    }
  });

  const videos = await Promise.all(videoPromises);
  return videos.filter(Boolean);
}

function WatchedView() {
  const { username } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: authenticatedUser, watchHistoryEnabled, setWatchHistoryEnabled } = useAppStore();
  const [deletedKeys, setDeletedKeys] = useState(new Set());
  const [activeTab, setActiveTab] = useState('videos');

  // Check if viewing own watch history
  const isOwner = authenticatedUser && username?.toLowerCase() === authenticatedUser.toLowerCase();

  // Fetch watched videos with infinite scroll
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteQuery({
    queryKey: ['watchedVideos', username],
    queryFn: async ({ pageParam = 0 }) => {
      const limit = 20;
      const historyItems = await getWatchHistory(username, limit, pageParam * limit);
      const videos = await fetchVideosFromHistory(historyItems);
      return { videos, nextOffset: historyItems.length === limit ? pageParam + 1 : undefined };
    },
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    enabled: !!username,
  });

  const allVideos = data?.pages.flatMap(page => page.videos) || [];
  const nonDeleted = allVideos.filter(v => !deletedKeys.has(`${v.author}/${v.permlink}`));
  const videosList = nonDeleted.filter(v => !v.isShort);
  const shortsList = nonDeleted.filter(v => v.isShort);
  const videos = activeTab === 'shorts' ? shortsList : videosList;

  const handleDelete = useCallback(async (e, author, permlink) => {
    e.preventDefault();
    e.stopPropagation();

    const success = await deleteWatchHistoryEntry(username, author, permlink);
    if (success) {
      setDeletedKeys(prev => new Set(prev).add(`${author}/${permlink}`));
      queryClient.invalidateQueries({ queryKey: ['watchedVideosCount'] });
      toast.success('Removed from watch history');
    } else {
      toast.error('Failed to remove from watch history');
    }
  }, [username, queryClient]);

  // Handle scroll for infinite loading
  const handleScroll = (e) => {
    const bottom = e.target.scrollHeight - e.target.scrollTop <= e.target.clientHeight + 200;
    if (bottom && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  if (isLoading) {
    return (
      <div className="watched-view-container">
        <BarLoader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="watched-view-container">
        <div className="error-wrap">
          <p>Error loading watch history: {error.message}</p>
          <Link to="/" className="back-link">
            <IoArrowBack /> Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="watched-view-container" onScroll={handleScroll}>
      {/* Header */}
      <div className="watched-header">
        <div className="watched-info">
          <div className="watched-icon-wrap">
            <MdHistory className="watched-icon" />
          </div>
          <div className="watched-details">
            <h1>Watched</h1>
            <div className="watched-meta">
              <Link to={`/p/${username}`} className="owner">
                @{username}
              </Link>
              <span className="separator">-</span>
              <span>{nonDeleted.length} watched</span>
            </div>
          </div>
        </div>

        <div className="header-actions">
          {isOwner && (
            <label className="tracking-toggle">
              <input
                type="checkbox"
                checked={watchHistoryEnabled}
                onChange={(e) => setWatchHistoryEnabled(e.target.checked)}
              />
              <span>Track history</span>
            </label>
          )}
          <button className="back-btn" onClick={() => navigate(-1)}>
            <IoArrowBack /> Back
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="watched-tabs">
        <button
          className={`tab-btn ${activeTab === 'videos' ? 'active' : ''}`}
          onClick={() => setActiveTab('videos')}
        >
          Videos ({videosList.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'shorts' ? 'active' : ''}`}
          onClick={() => setActiveTab('shorts')}
        >
          Shorts ({shortsList.length})
        </button>
      </div>

      {/* Videos List */}
      <div className="watched-videos">
        {videos.length === 0 ? (
          <div className="empty-wrap">
            <img src={icon} alt="" />
            <span>No watched {activeTab === 'shorts' ? 'shorts' : 'videos'} yet</span>
          </div>
        ) : (
          <div className="video-list">
            {videos.map((video, index) => (
              <Link
                key={`${video.author}-${video.permlink}`}
                to={video.isShort
                  ? `/shorts?v=${video.author}/${video.embedPermlink || video.permlink}`
                  : `/watch?v=${video.author}/${video.permlink}`}
                className="video-item"
              >
                <span className="video-position">{index + 1}</span>
                <div className="video-thumbnail">
                  <img src={fixVideoThumbnail(video)} alt={video.title} onError={(e) => (e.currentTarget.src = fallbackImg)} />
                  {video.isShort ? (
                    <span className="short-badge">Short</span>
                  ) : video.duration > 0 && (
                    <span className="duration">
                      {Math.floor(video.duration / 60)}:{String(Math.floor(video.duration % 60)).padStart(2, '0')}
                    </span>
                  )}
                </div>
                <div className="video-info">
                  <h3>{video.title}</h3>
                  <p className="video-author">@{video.author}</p>
                  {video.watch_count > 1 && (
                    <p className="watch-count">Watched {video.watch_count} times</p>
                  )}
                </div>
                {isOwner && (
                  <button
                    className="delete-btn"
                    onClick={(e) => handleDelete(e, video.author, video.permlink)}
                    title="Remove from watch history"
                  >
                    <MdDelete />
                  </button>
                )}
              </Link>
            ))}

            {isFetchingNextPage && (
              <div className="loading-more">
                <BarLoader />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default WatchedView;
