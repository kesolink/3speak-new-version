import React, { useEffect, useState } from 'react'
import { getFollowers } from '../../hive-api/api';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import icon from "../../../public/images/stack.png"
import "./UserProfilePage.scss"
import BarLoader from '../Loader/BarLoader';
import { Quantum } from 'ldrs/react'
import 'ldrs/react/Quantum.css'
import { useInfiniteQuery, useQueryClient as useReactQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { FEED_URL } from '../../utils/config';
import Card3 from '../Cards/Card3';
import { IoMdShare, IoMdAdd } from 'react-icons/io';
import { IoLogoRss } from 'react-icons/io5';
import Follower from './Follower';
import PlaylistCard from '../Cards/PlaylistCard';
import { useUserPlaylists } from '../../hooks/useUserPlaylists';
import { useAppStore } from '../../lib/store';
import { createPlaylist } from '../../utils/playlistOperations';
import { toast } from 'sonner';
import { useContentBatch } from '../../hooks/useContentBatch';
import { useWatchHistory } from '../../hooks/useWatchHistory';
import { fetchUserShortsWithDetails } from '../../hive-api/hiveApi';



function UserProfilePage() {
    const { user } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate()
    const queryClient = useReactQueryClient();
    const { user: authenticatedUser } = useAppStore();
    const [follower, setFollower] = useState(null)
    const [show, setShow] = useState(() => {
      const tab = searchParams.get('tab');
      if (tab === 'playlists') return 'playlists';
      if (tab === 'shorts') return 'shorts';
      return 'video';
    });
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [newPlaylistAccess, setNewPlaylistAccess] = useState('public');
    const [isCreating, setIsCreating] = useState(false);

    // Check if viewing own profile and redirect to /profile
    const isOwnProfile = authenticatedUser && authenticatedUser.toLowerCase() === user?.toLowerCase();

    // Redirect to /profile if viewing own profile
    useEffect(() => {
      if (isOwnProfile) {
        // Preserve the tab parameter when redirecting
        const tab = searchParams.get('tab');
        const redirectUrl = tab ? `/profile?tab=${tab}` : '/profile';
        navigate(redirectUrl, { replace: true });
      }
    }, [isOwnProfile, navigate, searchParams]);

    // Fetch user's public playlists
    const { data: playlists = [], isLoading: playlistsLoading, error: playlistsError, refetch: refetchPlaylists } = useUserPlaylists(user);

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
        // Refetch playlists after a short delay to allow blockchain indexing
        setTimeout(() => {
          refetchPlaylists();
          queryClient.invalidateQueries(['userPlaylists', user]);
        }, 3000);
      } catch (error) {
        toast.error('Failed to create playlist: ' + error.message);
      } finally {
        setIsCreating(false);
      }
    };

      // GET_TOTAL_COUNT_OF_FOLLOWING
      // const { username } = useParams();
      useEffect(()=>{
        getFollowersCount(user)
      },[])

 const LIMIT = 100;

const fetchVideos = async ({ pageParam = 0 }) => {
  let url;
    if (pageParam === 0) {
    // first 100 videos
    url = `${FEED_URL}/apiv2/feeds/@${user}`;
  } else {
    // next batches
    url = `${FEED_URL}/apiv2/feeds/@${user}/more?skip=${pageParam}`;
  }

  const res = await axios.get(url);
  return res.data;
};

      
const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  isLoading,
} = useInfiniteQuery({
  queryKey: ["UserProfilePage", user],
  queryFn: fetchVideos,
  getNextPageParam: (lastPage, allPages) => {
    // If the last page has items, calculate next skip value
    if (lastPage.length > 0) {
      return allPages.flat().length; // next skip = total items loaded so far
    }
    return undefined; // stop if no more data
  },
});

            // Shorts feed for this user
            const fetchUserShorts = async ({ pageParam = 1 }) => {
              const data = await fetchUserShortsWithDetails(user, pageParam, 20);
              return data;
            };

            const {
              data: shortsData,
              fetchNextPage: fetchNextShortsPage,
              hasNextPage: hasNextShortsPage,
              isFetchingNextPage: isFetchingNextShortsPage,
              isLoading: isShortsLoading,
            } = useInfiniteQuery({
              queryKey: ["UserShorts", user],
              queryFn: fetchUserShorts,
              getNextPageParam: (lastPage) => {
                if (lastPage?.page < lastPage?.totalPages) {
                  return lastPage.page + 1;
                }
                return undefined;
              },
              enabled: show === 'shorts',
            });

            // Flatten shorts pages and map to Card3 format
            const shortsVideos = (shortsData?.pages || []).flatMap(page =>
              (page?.shorts || []).map(s => ({
                author: s.author,
                permlink: s.permlink,
                title: (s.caption || s.title || '').slice(0, 80),
                images: { thumbnail: s.thumbnailUrl },
                duration: 0,
                stats: {
                  total_hive_reward: parseFloat(s.stats?.payout) || 0,
                  num_votes: s.stats?.likes || 0,
                },
                created_at: s.createdAt,
              }))
            );

        useEffect(() => {
              const handleScroll = () => {
                if (
                  window.innerHeight + window.scrollY >=
                    document.body.offsetHeight - 200
                ) {
                  if (show === 'shorts' && !isFetchingNextShortsPage && hasNextShortsPage) {
                    fetchNextShortsPage();
                  } else if (show === 'video' && !isFetchingNextPage && hasNextPage) {
                    fetchNextPage();
                  }
                }
              };

              window.addEventListener("scroll", handleScroll);
              return () => window.removeEventListener("scroll", handleScroll);
            }, [show, isFetchingNextPage, hasNextPage, fetchNextPage, isFetchingNextShortsPage, hasNextShortsPage, fetchNextShortsPage]);

            // Flatten all pages into a single array
            const videos = data?.pages.flat() || [];

            // Batch fetch content data
            const { getContentForVideo } = useContentBatch(videos);

            // Batch check watch history
            const { isWatched } = useWatchHistory(videos);

      // const { loading, error, data } = useQuery(GET_SOCIAL_FEED_BY_CREATOR, {
      //   variables: { id: user },
      // });
      // const videos = data?.socialFeed?.items || [];
      // console.log(videos);
    
    
      const getFollowersCount = async (user)=>{
        try{
          const follower = await getFollowers(user)
        setFollower(follower)
        } catch (err){
          console(err)
        }
      }

      const handleWalletNavigate = (user)=>{
        navigate(`/wallet/${user}`)
      }
    
  return (
    <div className="profile-page-container">
      <div className="profile-card">
        <div className="profile-header">
          <img className="gradient-bg" src={`https://images.hive.blog/u/${user}/cover`} alt="" />
        </div>
      <div className="profile-body">
          <div className="top-section">
            <div className="left-info">
              <div className="avatar">
                <img
                  src={`https://images.hive.blog/u/${user}/avatar`}
                  alt="Profile avatar"
                />
              </div>
              <div className="user-meta">
                <h2>{user}</h2>
                <div className="user-badges">
                  <span className="status-dot">
                    <span className="dot"></span>Verified creator
                  </span>
                </div>
              </div>
            </div>
      
            <div className="button-group">
              <button className="btn btn-primary" onClick={() => setShow("follower")}>
                Followers{" "}
                  {follower?.follower_count !== undefined ? (
                    follower.follower_count
                  ) : (
                    <Quantum size="15" speed="1.75" color="red" />
                  )}
              </button>
              <button className="btn btn-secondary" onClick={() => window.open(`${FEED_URL}/rss/${user}.xml`, "_blank")}>
                <IoLogoRss />
              </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        if (navigator.share) {
                          navigator.share({
                            title: `${user}`,
                            text: `Follow ${user} on 3Speak`,
                            url: `${FEED_URL}/user/${user}`,
                          });
                        } else {
                          window.open(`${FEED_URL}/user/${user}`, "_blank");
                        }
                      }}
                    >
                      <IoMdShare />
                    </button>
      
            </div>
          </div>
        </div>
        </div>
      <div className="toggle-wrap">
        <div className="wrap">
          <span className={show === "video" ? "active" : ""} onClick={() => setShow("video")}>Videos</span>
          <span className={show === "shorts" ? "active" : ""} onClick={() => setShow("shorts")}>Shorts</span>
          <span className={show === "playlists" ? "active" : ""} onClick={() => setShow("playlists")}>
            Playlists {playlists.length > 0 && `(${playlists.length})`}
          </span>
        </div>
        <span className="followers" onClick={()=>{handleWalletNavigate(user)}}>wallet</span>
      </div>
      <div className="container-video">
  {show === "video" ? (
    isLoading ? (
      <BarLoader />
    ) : videos?.length === 0 ? (
      <div className='empty-wrap'>
        <img src={icon} alt="" />
        <span>No Video Data Available</span>
      </div>
    ) : (
      <Card3 videos={videos} loading={isFetchingNextPage} getContentForVideo={getContentForVideo} isWatched={isWatched} />
    )
  ) : show === "shorts" ? (
    isShortsLoading ? (
      <BarLoader />
    ) : shortsVideos.length === 0 ? (
      <div className='empty-wrap'>
        <img src={icon} alt="" />
        <span>No Shorts Available</span>
      </div>
    ) : (
      <Card3 videos={shortsVideos} loading={isFetchingNextShortsPage} linkPrefix="/shorts" linkQuery={`&user=${user}`} />
    )
  ) : show === "playlists" ? (
    <>
      {isOwnProfile && (
        <button className="create-playlist-btn" onClick={() => setShowCreateModal(true)}>
          <IoMdAdd /> Create Playlist
        </button>
      )}
      {playlistsLoading ? (
        <BarLoader />
      ) : playlists.length === 0 ? (
        <div className='empty-wrap'>
          <img src={icon} alt="" />
          <span>No Public Playlists Available</span>
          {isOwnProfile && (
            <button className="create-playlist-btn-empty" onClick={() => setShowCreateModal(true)}>
              <IoMdAdd /> Create Your First Playlist
            </button>
          )}
        </div>
      ) : (
        <PlaylistCard playlists={playlists} loading={playlistsLoading} error={playlistsError?.message} />
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
              <select
                value={newPlaylistAccess}
                onChange={(e) => setNewPlaylistAccess(e.target.value)}
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
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
  )
}

export default UserProfilePage