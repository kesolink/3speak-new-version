import React, { useEffect, useRef, useState, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";

import { useAppStore } from "../lib/store";
import { getFollowers } from "../hive-api/api";

import Card3 from "../components/Cards/Card3";
import Follower from "../components/Userprofilepage/Follower";
import BarLoader from "../components/Loader/BarLoader";
import { useContentBatch } from "../hooks/useContentBatch";
import { useWatchHistory } from "../hooks/useWatchHistory";

import { FaVideo } from "react-icons/fa";
import { IoLogoRss } from "react-icons/io5";
import { IoMdShare, IoMdAdd } from "react-icons/io";
import { MdLock, MdPublic } from "react-icons/md";

import { LineSpinner, Quantum } from "ldrs/react";
import "ldrs/react/Quantum.css";

import icon from "../../public/images/stack.png";
import { UPLOAD_TOKEN, UPLOAD_URL, FEED_URL } from "../utils/config";
import "./ProfilePage.scss";
import { useLegacyUpload } from "../context/LegacyUploadContext";
import checker from "../../public/images/checker.png";
import { useMyPlaylists } from "../hooks/useMyPlaylists";
import { useWatchedVideosCount } from "../hooks/useWatchedVideos";
import PlaylistCard from "../components/Cards/PlaylistCard";
import WatchedPlaylistCard from "../components/Cards/WatchedPlaylistCard";
import WatchLaterPlaylistCard from "../components/Cards/WatchLaterPlaylistCard";
import { createPlaylist } from "../utils/playlistOperations";
import { useQueryClient } from "@tanstack/react-query";

// Reserved playlist name for Watch Later
const WATCH_LATER_NAME = 'Watch Later';

function ProfilePage() {

  const  {uploadVideoProgress, uploadStatus, hasBackgroundJob} = useLegacyUpload();
  const { user, authenticated } = useAppStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const [follower, setFollower] = useState(null);
  const [show, setShow] = useState(() => {
    // Initialize show based on URL tab parameter
    const tab = searchParams.get('tab');
    return tab === 'playlists' ? 'playlists' : 'video';
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistAccess, setNewPlaylistAccess] = useState('public');
  const [isCreating, setIsCreating] = useState(false);

  // Fetch user's playlists (all - public and private)
  const { data: playlists = [], isLoading: playlistsLoading, refetch: refetchPlaylists } = useMyPlaylists();

  // Fetch watched videos count
  const { data: watchedCount = 0, isLoading: watchedCountLoading } = useWatchedVideosCount();

  // Handle create playlist
  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) {
      toast.error('Please enter a playlist name');
      return;
    }

    setIsCreating(true);
    try {
      await createPlaylist(newPlaylistName.trim(), newPlaylistAccess);
      toast.success('Playlist created! It may take a moment to appear.');
      setShowCreateModal(false);
      setNewPlaylistName('');
      setNewPlaylistAccess('public');
      setTimeout(() => {
        refetchPlaylists();
        queryClient.invalidateQueries(['myPlaylists', user]);
      }, 3000);
    } catch (error) {
      toast.error('Failed to create playlist: ' + error.message);
    } finally {
      setIsCreating(false);
    }
  };

  /* ===============================
     IN-PROGRESS UPLOAD STATE
  =============================== */
  const [inProgress, setInProgress] = useState(null);
  const pollingRef = useRef(null);
  const refetchRef = useRef(null);

  /* ===============================
     FETCH IN-PROGRESS UPLOADS
  =============================== */
  const fetchInProgressUploads = useCallback(async () => {
    if (!user) return;

    try {
      const res = await axios.get(
        `${UPLOAD_URL}/api/upload/in-progress`,
        {
          headers: {
            "X-Hive-Username": user,
          },
        }
      );

      const json = res.data;

      console.log(json)

      if (!json.success) return;

      setInProgress(json.data);

      // stop polling when done
      if (json.data.count === 0 && pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
        if (refetchRef.current) {
          refetchRef.current();
        }
      }
    } catch (err) {
      console.error(
        "In-progress fetch error:",
        err.response?.data || err.message
      );
    }
  }, [user]);


  /* ===============================
     START POLLING ON LOAD
  =============================== */
  useEffect(() => { 
    if (!user) return;

    // Clear any existing interval first
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    // Run immediately
    fetchInProgressUploads(); 

    // Set up polling interval
    pollingRef.current = setInterval(() => { 
      fetchInProgressUploads(); 
    }, 5000); 

    return () => { 
      if (pollingRef.current) { 
        clearInterval(pollingRef.current); 
        pollingRef.current = null;
      } 
    };
  }, [user, fetchInProgressUploads]);


  /* ===============================
     FOLLOWERS
  =============================== */
  useEffect(() => {
    if (!user) return;
    getFollowers(user)
      .then(setFollower)
      .catch(console.error);
  }, [user]);

  /* ===============================
     VIDEO FEED (INFINITE SCROLL)
  =============================== */
  const fetchVideos = async ({ pageParam = 0 }) => {
    if (!user) {
      console.error('No user found');
      return [];
    }

    const pageSize = 20;

    try {
      // Use new reliable API endpoint with server-side pagination
      const res = await axios.get('https://views.3speak.tv/api/my-videos', {
        params: {
          username: user,
          limit: pageSize,
          offset: pageParam * pageSize,
          status: 'all', // Get published and scheduled videos
          sort: 'newest' // Sort by newest first
        },
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const responseData = res.data?.data || {};
      const allVideos = responseData.videos || [];
      
      // Filter out "uploaded" status videos (incomplete uploads)
      const filteredVideos = allVideos.filter(video => video.status !== 'uploaded');
      
      // Attach original count for pagination logic
      filteredVideos._originalCount = allVideos.length;
      
      return filteredVideos;
    } catch (error) {
      console.error('Failed to fetch videos:', error.response?.status, error.response?.data);
      toast.error('Failed to load videos');
      return [];
    }
  };

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["ProfilePage", user],
    queryFn: fetchVideos,
    getNextPageParam: (lastPage, allPages) => {
      // Check original count before filtering to determine if more pages exist
      const originalCount = lastPage?._originalCount || lastPage?.length || 0;
      if (!lastPage || originalCount < 20) return undefined;
      // Return the next page number
      return allPages.length;
    },
  });

  // Store refetch in ref for use in fetchInProgressUploads
  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  const videos = data?.pages.flat() || [];

  // Batch fetch content data
  const { getContentForVideo } = useContentBatch(videos);

  // Batch check watch history
  const { isWatched } = useWatchHistory(videos);

  /* ===============================
     SCROLL HANDLER
  =============================== */
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >=
          document.body.offsetHeight - 200 &&
        !isFetchingNextPage &&
        hasNextPage
      ) {
        fetchNextPage();
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isFetchingNextPage, hasNextPage, fetchNextPage]);

  /* ===============================
     NAVIGATION
  =============================== */
  const handleUploadNavigate = () => {
    if (!authenticated) {
      toast.error("Login to upload video");
    } else {
      navigate("/studio");
    }
  };

  return (
    <div className="profile-page-container">
      {/* ================= PROFILE HEADER ================= */}
      <div className="profile-card">
        <div className="profile-header">
          <img
            className="gradient-bg"
            src={`https://images.hive.blog/u/${user}/cover`}
            alt=""
          />
        </div>

        <div className="profile-body">
          <div className="top-section">
            <div className="left-info">
              <div className="avatar">
                <img
                  src={`https://images.hive.blog/u/${user}/avatar`}
                  alt="avatar"
                />
              </div>

              <div className="user-meta">
                <h2>{user}</h2>

                <div className="user-badges">
                  <span className="status-dot">
                    <span className="dot" /> Verified creator
                  </span>
                </div>
              </div>

            </div>

            <div className="button-group">
              <button
                className="btn btn-primary"
                onClick={() => setShow("follower")}
              >
                Followers{" "}
                {follower?.follower_count ?? (
                  <Quantum size="15" speed="1.75" color="red" />
                )}
              </button>

              <button
                className="btn btn-secondary"
                onClick={() =>
                  window.open(`${FEED_URL}/rss/${user}.xml`, "_blank")
                }
              >
                <IoLogoRss />
              </button>

              <button
                className="btn btn-secondary"
                onClick={() =>
                  navigator.share
                      ? navigator.share({
                          title: user,
                          url: `${FEED_URL}/user/${user}`,
                        })
                      : window.open(
                          `${FEED_URL}/user/${user}`,
                          "_blank"
                        )
                }
              >
                <IoMdShare />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ================= TOGGLE ================= */}
      <div className="toggle-wrap">
        <div className="wrap">
          <span className={show === "video" ? "active" : ""} onClick={() => setShow("video")}>Videos</span>
          <span className={show === "playlists" ? "active" : ""} onClick={() => setShow("playlists")}>
            Playlists {playlists.length > 0 && `(${playlists.length})`}
          </span>
          <Link to="/draft">Edit Video</Link>
        </div>

        <div className="wrap-in">
          <span onClick={() => navigate(`/wallet/${user}`)}>Wallet</span>

          {authenticated && (
            <div className="wrap-upload-video" onClick={handleUploadNavigate}>
              <FaVideo />
            </div>
          )}
        </div>
      </div>

      {/* ================= IN-PROGRESS BANNER ================= */}

      {hasBackgroundJob && !uploadStatus && (<div className="progressbar-container">
            <div className="content-wrap">
              <div className="wrap">
                <div className="wrap-top"><h3>Fetching Video </h3> <div>{uploadVideoProgress}%</div></div>
                {uploadVideoProgress > 0 && <div className="progress-bars">
                  <div className="progress-bar-fill" style={{ width: `${uploadVideoProgress}%` }}>
                    {/* {uploadVideoProgress > 0 && <span className="progress-bar-text">{uploadVideoProgress}%</span>} */}
                  </div>
                </div>}
              </div>
              <div className="wrap">
                <div className="wrap-upload"><h3>{!uploadStatus ? "Uploading video" : 'Video uploaded'} </h3> <div>{!uploadStatus ? <LineSpinner size="20" stroke="3" speed="1" color="black" /> : <img src={checker} alt="" />}</div></div>
              </div>
          <div className="background-text">
            <p>Please do not close your browser while the upload is in progress.</p>
            <p>A background job is currently running and will automatically publish your post.</p>
          </div>


            </div>
          </div>
      )}

    {inProgress?.count > 0 && (
      <div className="active-renders">
        {inProgress.videos.map(video => { 
          const progress = Number(video.progress_percent).toFixed(2);

          return (
          <div key={video.video_id} className="render-card">
          <div className="left">
            <div className="icon">▶</div>
            <div className="info">
              <h3>{video.title}</h3>
              <p className="sub">🎬 Processing your videos</p>
              <div className="meta">
                <span className="status">{video.status_label}</span>
                <span className="time">{video.elapsed_minutes} min ago</span>
              </div>
            </div>
          </div>

         <div className="wrap-progress">
          <div className="right">
            <div className="percent">{progress}%</div>
          </div>
          <div className="progress">
            <div className="bar" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
        </div>
      )})}
      </div>
      )}


      


      

      {/* ================= VIDEO LIST / PLAYLISTS ================= */}
      <div className="container-video">
        {show === "video" ? (
          isLoading ? (
            <BarLoader />
          ) : videos.length === 0 ? (
            <div className="empty-wrap">
              <img src={icon} alt="empty" />
              <span>No Video Data Available</span>
            </div>
          ) : (
            <Card3 videos={videos} loading={isFetchingNextPage} getContentForVideo={getContentForVideo} isWatched={isWatched} />
          )
        ) : show === "playlists" ? (
          <>
            <button className="create-playlist-btn" onClick={() => setShowCreateModal(true)}>
              <IoMdAdd /> Create Playlist
            </button>
            {playlistsLoading && watchedCountLoading ? (
              <BarLoader />
            ) : (
              <>
                {/* Special playlists row: Watch Later and Watched */}
                <div className="special-playlists-row">
                  {/* Watch Later playlist */}
                  {playlists.find(p => p.name === WATCH_LATER_NAME) && (
                    <WatchLaterPlaylistCard
                      playlist={playlists.find(p => p.name === WATCH_LATER_NAME)}
                      username={user}
                    />
                  )}
                  {/* Watched Videos pseudo-playlist */}
                  {watchedCount > 0 && (
                    <WatchedPlaylistCard count={watchedCount} username={user} />
                  )}
                </div>
                {/* Regular playlists (excluding Watch Later) */}
                {playlists.filter(p => p.name !== WATCH_LATER_NAME).length === 0 && watchedCount === 0 && !playlists.find(p => p.name === WATCH_LATER_NAME) ? (
                  <div className="empty-wrap">
                    <img src={icon} alt="empty" />
                    <span>No Playlists Yet</span>
                    <button className="create-playlist-btn-empty" onClick={() => setShowCreateModal(true)}>
                      <IoMdAdd /> Create Your First Playlist
                    </button>
                  </div>
                ) : (
                  <PlaylistCard playlists={playlists.filter(p => p.name !== WATCH_LATER_NAME)} loading={playlistsLoading} showPrivacyBadge={true} />
                )}
              </>
            )}
          </>
        ) : (
          <Follower count={follower} />
        )}
      </div>

      {/* Create Playlist Modal */}
      {showCreateModal && (
        <div className="create-playlist-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="create-playlist-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create New Playlist</h3>
            <div className="form-group">
              <label>Playlist Name</label>
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Enter playlist name"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Visibility</label>
              <div className="privacy-buttons">
                <button
                  type="button"
                  className={`privacy-btn ${newPlaylistAccess === 'public' ? 'active' : ''}`}
                  onClick={() => setNewPlaylistAccess('public')}
                >
                  <MdPublic /> Public
                </button>
                <button
                  type="button"
                  className={`privacy-btn ${newPlaylistAccess === 'private' ? 'active' : ''}`}
                  onClick={() => setNewPlaylistAccess('private')}
                >
                  <MdLock /> Private
                </button>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowCreateModal(false)} disabled={isCreating}>
                Cancel
              </button>
              <button className="btn-create" onClick={handleCreatePlaylist} disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create Playlist'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfilePage;