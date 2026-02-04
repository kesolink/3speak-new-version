import { useParams, Link, useNavigate } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import axios from 'axios';
import { MdHistory } from 'react-icons/md';
import { IoArrowBack } from 'react-icons/io5';
import BarLoader from '../components/Loader/BarLoader';
import icon from '../../public/images/stack.png';
import { useAppStore } from '../lib/store';
import { getWatchHistory } from '../utils/watchHistory';
import { HIVE_API_URL } from '../utils/config';
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
      let thumbnail = 'https://media.3speak.tv/defaults/default_thumbnail.png';
      if (metadata.image?.[0]) {
        thumbnail = metadata.image[0];
      }

      // Extract duration from video metadata
      const duration = metadata.video?.info?.duration || 0;

      return {
        author: post.author,
        permlink: post.permlink,
        title: post.title,
        created_at: post.created,
        images: { thumbnail },
        duration,
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
  const { user: authenticatedUser } = useAppStore();

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

  const videos = data?.pages.flatMap(page => page.videos) || [];

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
              <span>{videos.length} videos</span>
            </div>
          </div>
        </div>

        <button className="back-btn" onClick={() => navigate(-1)}>
          <IoArrowBack /> Back
        </button>
      </div>

      {/* Videos List */}
      <div className="watched-videos">
        {videos.length === 0 ? (
          <div className="empty-wrap">
            <img src={icon} alt="" />
            <span>No watched videos yet</span>
          </div>
        ) : (
          <div className="video-list">
            {videos.map((video, index) => (
              <Link
                key={`${video.author}-${video.permlink}`}
                to={`/watch?v=${video.author}/${video.permlink}`}
                className="video-item"
              >
                <span className="video-position">{index + 1}</span>
                <div className="video-thumbnail">
                  <img src={video.images?.thumbnail} alt={video.title} />
                  {video.duration > 0 && (
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
