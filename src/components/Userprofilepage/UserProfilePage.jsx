import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { getFollowers, getRelationshipBetweenAccounts } from '../../hive-api/api';
import { followWithAioha } from '../../hive-api/aioha';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import icon from "../../../public/images/stack.png"
import "./UserProfilePage.scss"
import BarLoader from '../Loader/BarLoader';
import { Quantum } from 'ldrs/react'
import 'ldrs/react/Quantum.css'
import { useInfiniteQuery, useQueryClient as useReactQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { MY_VIDEOS_URL } from '../../utils/config';
import Card3 from '../Cards/Card3';
import { IoMdShare, IoMdAdd } from 'react-icons/io';
import Follower from './Follower';
import PlaylistCard from '../Cards/PlaylistCard';
import { useUserPlaylists } from '../../hooks/useUserPlaylists';
import { useAppStore } from '../../lib/store';
import { createPlaylist } from '../../utils/playlistOperations';
import { toast } from 'sonner';
import { useContentBatch } from '../../hooks/useContentBatch';
import { useWatchHistory } from '../../hooks/useWatchHistory';
import useViewCounts from '../../hooks/useViewCounts';
import { fetchUserShortsWithDetails } from '../../hive-api/hiveApi';



function UserProfilePage() {
    const { user } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate()
    const queryClient = useReactQueryClient();
    const { user: authenticatedUser, authenticated } = useAppStore();
    const [follower, setFollower] = useState(null)
    const [isFollowing, setIsFollowing] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);
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
      useEffect(() => {
        if (user) {
          getFollowersCount(user)
        }
      }, [user])

 const LIMIT = 20;

const fetchVideos = async ({ pageParam = 0 }) => {
  const url = `${MY_VIDEOS_URL}/api/my-videos?username=${user}&limit=${LIMIT}&offset=${pageParam}&status=published&sort=newest`;

  const res = await axios.get(url);
  return res.data?.data?.videos || [];
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
    // If the last page has LIMIT items, there might be more
    if (lastPage.length === LIMIT) {
      return allPages.flat().length; // next offset = total items loaded so far
    }
    return undefined; // stop if last page had fewer than LIMIT items
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
            const shortsVideos = useMemo(() => (
              (shortsData?.pages || []).flatMap(page =>
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
              )
            ), [shortsData?.pages]);

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
            const videos = useMemo(() => data?.pages.flat() || [], [data?.pages]);

            // Batch fetch content data
            const { getContentForVideo } = useContentBatch(videos);

            // Batch check watch history
            const { isWatched } = useWatchHistory(videos);
            
            // Batch fetch view counts
            const { getViewCount } = useViewCounts(videos);

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
          console.error(err)
        }
      }

      // Check follow relationship on mount
      useEffect(() => {
        if (authenticated && authenticatedUser && user && authenticatedUser.toLowerCase() !== user.toLowerCase()) {
          getRelationshipBetweenAccounts(authenticatedUser, user).then((rel) => {
            if (rel) setIsFollowing(rel.follows);
          });
        }
      }, [authenticated, authenticatedUser, user]);

      const handleFollowToggle = async () => {
        if (!authenticated || followLoading) return;
        setFollowLoading(true);
        try {
          await followWithAioha(user, !isFollowing);
          setIsFollowing(!isFollowing);
          // Refresh follower count
          getFollowersCount(user);
          toast.success(isFollowing ? `Unfollowed @${user}` : `Now following @${user}`);
        } catch (err) {
          console.error('Follow error:', err);
          toast.error('Follow action failed: ' + (err.message || 'Unknown error'));
        } finally {
          setFollowLoading(false);
        }
      };

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
              {authenticated && (
                <button
                  className={`btn ${isFollowing ? 'btn-following' : 'btn-follow'}`}
                  onClick={handleFollowToggle}
                  disabled={followLoading}
                >
                  {followLoading ? 'Loading...' : isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
                    <button
                      className="btn btn-secondary"
                      onClick={async () => {
                        const profileUrl = `${window.location.origin}/@${user}`;
                        const shareData = { title: `${user} on 3Speak`, text: `Follow ${user} on 3Speak`, url: profileUrl };
                        try {
                          if (navigator.share && navigator.canShare?.(shareData)) {
                            await navigator.share(shareData);
                          } else {
                            await navigator.clipboard.writeText(profileUrl);
                            toast.success('Profile link copied to clipboard!');
                          }
                        } catch (err) {
                          if (err.name !== 'AbortError') {
                            await navigator.clipboard.writeText(profileUrl);
                            toast.success('Profile link copied to clipboard!');
                          }
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
      <Card3 videos={videos} loading={isFetchingNextPage} getContentForVideo={getContentForVideo} isWatched={isWatched} getViewCount={getViewCount} />
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
      <Card3 videos={shortsVideos} loading={isFetchingNextShortsPage} linkPrefix="/shorts" linkQuery={`&user=${user}`} getViewCount={getViewCount} shortsGrid />
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