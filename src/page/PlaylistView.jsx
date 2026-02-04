import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useState, useCallback } from 'react';
import { MdPlaylistPlay, MdDragIndicator, MdDelete, MdClose } from 'react-icons/md';
import { IoArrowBack, IoTrash, IoSave } from 'react-icons/io5';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import BarLoader from '../components/Loader/BarLoader';
import icon from '../../public/images/stack.png';
import { useAppStore } from '../lib/store';
import {
  executePlaylistChanges,
  deletePlaylist,
  PlaylistActionTypes
} from '../utils/playlistOperations';
import { toast } from 'sonner';
import './PlaylistView.scss';
import { HIVE_API_URL, PLAYLISTS_API_URL } from '../utils/config';

dayjs.extend(relativeTime);

/**
 * Fetch video data from Hive for a list of playlist items
 */
async function fetchVideosForPlaylist(items) {
  if (!items?.length) return [];

  // Sort items by position
  const sortedItems = [...items].sort((a, b) => a.position - b.position);

  // Fetch all video data in parallel
  const videoPromises = sortedItems.map(async (item) => {
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
        position: item.position,
      };
    } catch (error) {
      console.error(`Error fetching video ${item.author}/${item.permlink}:`, error);
      return null;
    }
  });

  const videos = await Promise.all(videoPromises);
  return videos.filter(Boolean);
}

function PlaylistView() {
  const { playlistId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: authenticatedUser } = useAppStore();

  // State for edit mode
  const [editableVideos, setEditableVideos] = useState(null);
  const [pendingChanges, setPendingChanges] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Fetch playlist data
  const { data: playlist, isLoading: playlistLoading, error: playlistError } = useQuery({
    queryKey: ['playlist', playlistId],
    queryFn: async () => {
      const response = await axios.get(`${PLAYLISTS_API_URL}/playlists/${playlistId}`);
      return response.data;
    },
    enabled: !!playlistId,
  });

  // Check if user is the owner
  const isOwner = authenticatedUser && playlist?.owner?.toLowerCase() === authenticatedUser.toLowerCase();

  // Fetch videos for the playlist
  const { data: videos = [], isLoading: videosLoading } = useQuery({
    queryKey: ['playlistVideos', playlistId, playlist?.items],
    queryFn: () => fetchVideosForPlaylist(playlist?.items),
    enabled: !!playlist?.items?.length,
    onSuccess: (data) => {
      // Initialize editable videos when data loads
      if (!editableVideos) {
        setEditableVideos(data);
      }
    },
  });

  // Initialize editable videos when videos change
  const displayVideos = editableVideos || videos;

  // Check if there are unsaved changes
  const hasChanges = pendingChanges.length > 0;

  // Handle drag start
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
  };

  // Handle drag over
  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  // Handle drag leave
  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  // Handle drop - reorder videos
  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    const dragIndex = draggedIndex;

    if (dragIndex === null || dragIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    // Create new array with reordered items
    const newVideos = [...displayVideos];
    const [draggedItem] = newVideos.splice(dragIndex, 1);
    newVideos.splice(dropIndex, 0, draggedItem);

    // Update positions
    const updatedVideos = newVideos.map((video, idx) => ({
      ...video,
      position: idx,
    }));

    setEditableVideos(updatedVideos);

    // Track the reorder change
    setPendingChanges(prev => [
      ...prev,
      {
        type: PlaylistActionTypes.REORDER,
        author: draggedItem.author,
        permlink: draggedItem.permlink,
        newPosition: dropIndex,
      },
    ]);

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Handle remove video
  const handleRemoveVideo = (video, index) => {
    const newVideos = displayVideos.filter((_, idx) => idx !== index);

    // Update positions
    const updatedVideos = newVideos.map((v, idx) => ({
      ...v,
      position: idx,
    }));

    setEditableVideos(updatedVideos);

    // Track the remove change
    setPendingChanges(prev => [
      ...prev,
      {
        type: PlaylistActionTypes.REMOVE,
        author: video.author,
        permlink: video.permlink,
      },
    ]);
  };

  // Handle save changes
  const handleSaveChanges = async () => {
    if (pendingChanges.length === 0) return;

    setIsSaving(true);
    try {
      const results = await executePlaylistChanges(
        playlistId,
        pendingChanges,
        (current, total, change) => {
          toast.loading(`Processing ${current}/${total}: ${change.type}...`, { id: 'save-progress' });
        }
      );

      toast.dismiss('save-progress');

      if (results.failed.length > 0) {
        toast.error(`${results.failed.length} operation(s) failed`);
      } else {
        toast.success('All changes saved! They may take a moment to appear.');
      }

      // Clear pending changes
      setPendingChanges([]);

      // Refetch after a delay
      setTimeout(() => {
        queryClient.invalidateQueries(['playlist', playlistId]);
        queryClient.invalidateQueries(['playlistVideos', playlistId]);
      }, 3000);
    } catch (error) {
      toast.error('Failed to save changes: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle discard changes
  const handleDiscardChanges = () => {
    setEditableVideos(videos);
    setPendingChanges([]);
  };

  // Handle delete playlist
  const handleDeletePlaylist = async () => {
    setIsDeleting(true);
    try {
      await deletePlaylist(playlistId);
      toast.success('Playlist deleted! Redirecting...');
      setShowDeleteConfirm(false);

      // Navigate back to profile after a short delay
      setTimeout(() => {
        navigate(`/p/${playlist.owner}`);
      }, 1500);
    } catch (error) {
      toast.error('Failed to delete playlist: ' + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  if (playlistLoading) {
    return (
      <div className="playlist-view-container">
        <BarLoader />
      </div>
    );
  }

  if (playlistError) {
    return (
      <div className="playlist-view-container">
        <div className="error-wrap">
          <p>Error loading playlist: {playlistError.message}</p>
          <Link to="/" className="back-link">
            <IoArrowBack /> Back to Home
          </Link>
        </div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="playlist-view-container">
        <div className="empty-wrap">
          <img src={icon} alt="" />
          <span>Playlist not found</span>
          <Link to="/" className="back-link">
            <IoArrowBack /> Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="playlist-view-container">
      {/* Playlist Header */}
      <div className="playlist-header">
        <div className="playlist-info">
          <div className="playlist-icon-wrap">
            <MdPlaylistPlay className="playlist-icon" />
          </div>
          <div className="playlist-details">
            <h1>{playlist.name}</h1>
            <div className="playlist-meta">
              <Link to={`/p/${playlist.owner}`} className="owner">
                @{playlist.owner}
              </Link>
              <span className="separator">•</span>
              <span>{displayVideos.length} videos</span>
              <span className="separator">•</span>
              <span>Created {dayjs.unix(playlist.created_at).fromNow()}</span>
            </div>
          </div>
        </div>

        {/* Owner Actions */}
        {isOwner && (
          <div className="owner-actions">
            <button
              className="btn-delete-playlist"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isSaving}
            >
              <IoTrash /> Delete Playlist
            </button>
          </div>
        )}
      </div>

      {/* Save Changes Bar */}
      {isOwner && hasChanges && (
        <div className="save-changes-bar">
          <div className="changes-info">
            <span>{pendingChanges.length} unsaved change{pendingChanges.length > 1 ? 's' : ''}</span>
          </div>
          <div className="changes-actions">
            <button className="btn-discard" onClick={handleDiscardChanges} disabled={isSaving}>
              Discard
            </button>
            <button className="btn-save" onClick={handleSaveChanges} disabled={isSaving}>
              {isSaving ? 'Saving...' : <><IoSave /> Save Changes</>}
            </button>
          </div>
        </div>
      )}

      {/* Videos List */}
      <div className="playlist-videos">
        {videosLoading ? (
          <BarLoader />
        ) : displayVideos.length === 0 ? (
          <div className="empty-wrap">
            <img src={icon} alt="" />
            <span>No videos in this playlist</span>
          </div>
        ) : (
          <div className="video-list">
            {displayVideos.map((video, index) => (
              <div
                key={`${video.author}-${video.permlink}`}
                className={`video-item ${draggedIndex === index ? 'dragging' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
                draggable={isOwner}
                onDragStart={(e) => isOwner && handleDragStart(e, index)}
                onDragOver={(e) => isOwner && handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => isOwner && handleDrop(e, index)}
                onDragEnd={() => {
                  setDraggedIndex(null);
                  setDragOverIndex(null);
                }}
              >
                {isOwner && (
                  <div className="drag-handle">
                    <MdDragIndicator />
                  </div>
                )}
                <span className="video-position">{index + 1}</span>
                <Link
                  to={`/watch?v=${video.author}/${video.permlink}&playlist=${playlistId}&pos=${index}`}
                  state={{ playlist, videos: displayVideos, currentIndex: index }}
                  className="video-link"
                >
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
                  </div>
                </Link>
                {isOwner && (
                  <button
                    className="btn-remove-video"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRemoveVideo(video, index);
                    }}
                    title="Remove from playlist"
                  >
                    <MdClose />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="delete-confirm-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Playlist?</h3>
            <p>Are you sure you want to delete "{playlist.name}"? This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>
                Cancel
              </button>
              <button className="btn-confirm-delete" onClick={handleDeletePlaylist} disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : 'Delete Playlist'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlaylistView;
