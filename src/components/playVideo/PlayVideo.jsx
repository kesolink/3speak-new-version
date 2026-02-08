import PropTypes from "prop-types";
import "./PlayVideo.scss";
import VideoControls from "../VideoControls/VideoControls";
import ViewCount from "../ViewCount/ViewCount";
import { LuTimer } from "react-icons/lu";
import UpvoteCount from "../UpvoteCount/UpvoteCount";
import PayoutAmount from "../PayoutAmount/PayoutAmount";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useQuery } from "@apollo/client";
import { GET_PROFILE } from "../../graphql/queries";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import BlogContent from "./BlogContent";
import CommentSection from "./CommentSection";
import { useAppStore } from '../../lib/store';
import { estimate, getUersContent, getVotePower } from "../../utils/hiveUtils";
import ToolTip from "../tooltip/ToolTip";
import { ImSpinner9 } from "react-icons/im";
import { useNavigate } from "react-router-dom";
import BarLoader from "../Loader/BarLoader";
import TipModal from "../../components/tip-reward/TipModal";
import { toast } from 'sonner';
import { TailChase } from 'ldrs/react';
import 'ldrs/react/TailChase.css';
import { getFollowers, getRelationshipBetweenAccounts } from "../../hive-api/api";
import UpvoteTooltip from "../tooltip/UpvoteTooltip";
import axios from "axios";
import { FEED_URL, PLAYER_URL, HIVE_API_URL } from '../../utils/config';
import { followWithAioha, isLoggedIn } from "../../hive-api/aioha";
import { MdPlaylistAdd, MdWatchLater } from "react-icons/md";
import AddToPlaylistModal from "../AddToPlaylistModal/AddToPlaylistModal";
import VideoPlaylists from "../VideoPlaylists/VideoPlaylists";
import PlaylistBar from "../PlaylistBar/PlaylistBar";
import { useMyPlaylists, isVideoInPlaylist } from "../../hooks/useMyPlaylists";
import { removeFromPlaylist } from "../../utils/playlistOperations";
import { useQueryClient } from "@tanstack/react-query";
import AuthorBadge from "../AuthorBadge/AuthorBadge";
import Button from "../Button/Button";

dayjs.extend(relativeTime);

const PlayVideo = ({ videoDetails, author, permlink, playlistData, onClosePlaylist, videoControls }) => {
  const { user, authenticated } = useAppStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // State
  const [openTooltip, setOpenToolTip] = useState(false);
  const [tooltipVoters, setTooltipVoters] = useState([]);
  const [isTipModalOpen, setIsTipModalOpen] = useState(false);
  const [isVoted, setIsVoted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [followData, setFollowData] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [optimisticVoteCount, setOptimisticVoteCount] = useState(0);
  const [accountData, setAccountData] = useState(null);
  const [voteValue, setVoteValue] = useState(0.0);
  const [weight, setWeight] = useState(100);
  const [view, setView] = useState(0);
  const [speakData, setSpeakData] = useState(null);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [isRemovingWatchLater, setIsRemovingWatchLater] = useState(false);
  const [communityData, setCommunityData] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);

  // Watch Later detection
  const { data: myPlaylists = [], refetch: refetchPlaylists } = useMyPlaylists({ enabled: !!user });
  const watchLaterPlaylist = useMemo(() => myPlaylists.find(p => p.name === 'Watch Later'), [myPlaylists]);
  const isInWatchLater = useMemo(() => watchLaterPlaylist ? isVideoInPlaylist(watchLaterPlaylist, author, permlink) : false, [watchLaterPlaylist, author, permlink]);

  const handleRemoveFromWatchLater = useCallback(async () => {
    if (!watchLaterPlaylist || isRemovingWatchLater) return;
    setIsRemovingWatchLater(true);
    try {
      await removeFromPlaylist(watchLaterPlaylist.id, author, permlink);
      toast.success('Removed from Watch Later');
      setTimeout(() => {
        refetchPlaylists();
        queryClient.invalidateQueries({ queryKey: ['myPlaylists'] });
        queryClient.invalidateQueries({ queryKey: ['userPlaylists'] });
      }, 2000);
    } catch (error) {
      toast.error('Failed to remove: ' + error.message);
    } finally {
      setIsRemovingWatchLater(false);
    }
  }, [watchLaterPlaylist, author, permlink, isRemovingWatchLater, refetchPlaylists, queryClient]);

  // Memoized format function
  const formatRelativeTime = useCallback((date) => {
    const now = dayjs();
    const created = dayjs(date);
    const diffInMinutes = now.diff(created, "minute");
  
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = now.diff(created, "hour");
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = now.diff(created, "day");
    if (diffInDays < 30) return `${diffInDays}d ago`;
    const diffInMonths = now.diff(created, "month");
    return `${diffInMonths}mo ago`;
  }, []);

  // Queries with proper skip conditions
  const getUserProfile = useQuery(GET_PROFILE, {
    variables: { id: videoDetails?.author?.id },
    skip: !videoDetails?.author?.id,
  });

  // Use spkvideo from videoDetails (already fetched by Watch.jsx)
  const spkvideo = videoDetails?.spkvideo;
  const profile = getUserProfile.data?.profile;
  
  // Memoized values
  const tags = useMemo(() => videoDetails?.tags?.slice(0, 7) || [], [videoDetails?.tags]);
  const comunity_name = useMemo(() => videoDetails?.community?.title, [videoDetails?.community?.title]);
  const community_id = useMemo(() => {
  const raw = videoDetails?.community?._id;
  return raw ? raw.split('/').pop() : null;
}, [videoDetails?.community?._id]);

  // Memoized video URL
  const videoUrlSelected = useMemo(() => {
    if (!spkvideo?.play_url) return null;
    
    const url = spkvideo.play_url;
    if (url.startsWith("ipfs://")) {
      const ipfsHash = url.replace("ipfs://", "");
      return `https://ipfs-3speak.b-cdn.net/ipfs/${ipfsHash}`;
    }
    return url;
  }, [spkvideo?.play_url]);

  // Memoized callbacks to prevent recreating functions
  const calculateVoteValue = useCallback(async (account, percent) => {
    try {
      const data = await estimate(account, percent);
      setVoteValue(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const getTooltipVoters = useCallback(async () => {
    try {
      const data = await getUersContent(author, permlink);
      if (!data) return;

      // Batch state updates to prevent multiple re-renders
      const updates = {};

      if (data.active_votes) {
        updates.optimisticVoteCount = data.active_votes.length;
        updates.isVoted = data.active_votes.some(vote => vote.voter === user);

        const totalRshares = data.active_votes.reduce(
          (sum, vote) => sum + parseInt(vote.rshares),
          0
        );

        const totalPayout =
          parseFloat(data.pending_payout_value) > 0
            ? parseFloat(data.pending_payout_value)
            : parseFloat(data.total_payout_value) + parseFloat(data.curator_payout_value);

        const topVotes = data.active_votes
          .sort((a, b) => parseInt(b.rshares) - parseInt(a.rshares))
          .slice(0, 10)
          .map(vote => {
            const reward =
              totalRshares > 0
                ? (parseInt(vote.rshares) / totalRshares) * totalPayout
                : 0;
            return {
              username: vote.voter,
              reward: +reward.toFixed(3),
            };
          });

        updates.tooltipVoters = topVotes;
      }

      // Single state update
      setOptimisticVoteCount(updates.optimisticVoteCount || 0);
      setIsVoted(updates.isVoted || false);
      setTooltipVoters(updates.tooltipVoters || []);
    } catch (error) {
      console.error("Error fetching upvotes:", error);
    }
  }, [author, permlink, user]);

  const speakWatchData = useCallback(async () => {
    try {
      const res = await axios.get(`${FEED_URL}/apiv2/@${author}/${permlink}`);
      setSpeakData(res.data);
      setView(res.data.views);
    } catch (err) {
      console.error("Error fetching speak data:", err);
    }
  }, [author, permlink]);

  const getFollowersCount = useCallback(async (authorName) => {
    try {
      const follower = await getFollowers(authorName);
      setFollowData(follower);
    } catch (err) {
      console.error(err);
    }
  }, []);


  // Effect: Fetch account data (only once when user changes)
  useEffect(() => {
    if (!user) return;
    
    const fetchAccountData = async () => {
      try {
        const result = await getVotePower(user);
        if (result?.account) {
          setAccountData(result.account);
          await calculateVoteValue(result.account, weight);
        }
      } catch (err) {
        console.error('Error fetching account:', err);
      }
    };
    
    fetchAccountData();
  }, [user, calculateVoteValue, weight]);

  // Effect: Fetch speak data and followers (only when author/permlink changes)
  useEffect(() => {
    if (!author || !permlink) return;
    
    speakWatchData();
    getFollowersCount(author);
  }, [author, permlink, speakWatchData, getFollowersCount]);

  // Effect: Check if current user follows the author
  useEffect(() => {
    if (!user || !author || user === author) {
      setIsFollowing(false);
      return;
    }
    const checkRelationship = async () => {
      try {
        const relation = await getRelationshipBetweenAccounts(user, author);
        setIsFollowing(relation?.follows === true);
      } catch (err) {
        console.error('Error checking follow relationship:', err);
      }
    };
    checkRelationship();
  }, [user, author]);

  // Effect: Get tooltip voters (only when author/permlink/user changes)
  useEffect(() => {
    if (!author || !permlink) return;
    getTooltipVoters();
  }, [author, permlink, getTooltipVoters]);

  // Effect: Fetch community data (subscribers count)
  useEffect(() => {
    if (!community_id) {
      setCommunityData(null);
      return;
    }
    const fetchCommunity = async () => {
      try {
        const response = await axios.post(HIVE_API_URL, {
          jsonrpc: '2.0',
          method: 'bridge.get_community',
          params: { name: community_id },
          id: 1,
        });
        const data = response.data?.result;
        if (data) {
          setCommunityData({ subscribers: data.subscribers });
        }
      } catch (err) {
        console.error('Error fetching community data:', err);
      }
    };
    fetchCommunity();
  }, [community_id]);

  // Effect: Recalculate vote value when weight changes
  useEffect(() => {
    if (!accountData) return;
    calculateVoteValue(accountData, weight);
  }, [weight, accountData, calculateVoteValue]);

  // Memoized handlers
  const handleSelectTag = useCallback((tag) => {
    navigate(`/t/${tag}`);
  }, [navigate]);


  const handleProfileNavigate = useCallback((userName) => {
    navigate(`/p/${userName}`);
  }, [navigate]);

  const toggleTooltip = useCallback(() => {
    setShowTooltip((prev) => !prev);
  }, []);

  const handleCommunityNavigate = useCallback((community) => {
    navigate(`/community/${community}`);
  }, [navigate]);

  // Loading state - show loader if essential data is missing
  if (!videoDetails) {
    return <BarLoader />;
  }

  // Follow/unfollow user using aioha (supports multiple providers)
  const toggleFollowUser = async (following) => {
    if (!isLoggedIn()) {
      toast.error("Please login to follow users");
      return;
    }

    const willFollow = !isFollowing;
    try {
      await followWithAioha(following, willFollow);
      setIsFollowing(willFollow);
      toast.success(willFollow ? `Successfully followed @${following}` : `Unfollowed @${following}`);
    } catch (error) {
      console.error('Failed to follow/unfollow user:', error);
      toast.error(`Failed: ${error.message}`);
    }
  };

  return (
    <>
      <div className="play-video">
        <div className="top-container">
          {(author && permlink) ? (
            <div className="video-iframe-wrapper">
              <iframe
                src={`${PLAYER_URL}/watch?v=${author}/${permlink}&layout=desktop&mode=iframe&controls=0`}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  border: "0",
                  overflow: "hidden",
                }}
                frameBorder="0"
                scrolling="no"
                allowFullScreen
              />
              {videoControls && (
                <>
                  <div
                    className="video-interact-overlay"
                    onMouseMove={videoControls.onMouseMove}
                    onClick={videoControls.onTogglePlay}
                  />
                  <VideoControls
                    currentTime={videoControls.currentTime}
                    duration={videoControls.duration}
                    isPlaying={videoControls.isPlaying}
                    isMuted={videoControls.isMuted}
                    isFullscreen={videoControls.isFullscreen}
                    isVisible={videoControls.isVisible}
                    onTogglePlay={videoControls.onTogglePlay}
                    onToggleMute={videoControls.onToggleMute}
                    onSeekBackward={videoControls.onSeekBackward}
                    onSeekForward={videoControls.onSeekForward}
                    onSeek={videoControls.onSeek}
                    onToggleFullscreen={videoControls.onToggleFullscreen}
                    markers={videoControls.markers}
                    onMarkerSelect={videoControls.onMarkerSelect}
                  />
                </>
              )}
            </div>
          ) : (
            <div className="video-loader">
              <ImSpinner9 className="spinner" />
            </div>
          )}

          <h3>{videoDetails?.title}</h3>
          
          <div className="badges-row">
            <AuthorBadge
              author={videoDetails?.author?.id}
              followersCount={followData?.follower_count}
              showFollow={author !== user}
              isFollowing={isFollowing}
              onFollow={() => toggleFollowUser(author)}
            />
            {community_id && (<div className="community-title-wrap" onClick={() => handleCommunityNavigate(community_id)}>
              <img src={`https://images.hive.blog/u/${community_id}/avatar/small`} alt="" />
              <div className="community-text">
                <span className="community-name">{comunity_name}</span>
                {communityData?.subscribers != null && (
                  <span className="community-members">{communityData.subscribers} Members</span>
                )}
              </div>
            </div>)}
          </div>

          <div className="community-tags-row">
            {community_id && (<div className="community-title-wrap mobile-only" onClick={() => handleCommunityNavigate(community_id)}>
              <img src={`https://images.hive.blog/u/${community_id}/avatar/small`} alt="" />
              <div className="community-text">
                <span className="community-name">{comunity_name}</span>
              </div>
            </div>)}
            <div className="tag-wrapper">
              {tags.map((tag, index) => (
                <span key={index} onClick={() => handleSelectTag(tag)}>{tag}</span>
              ))}
            </div>
          </div>
          
          <div className="play-video-info">
            <div className="wrap-left">
              <ViewCount views={view} author={author} permlink={permlink} size={13} />
              <div className="wrap">
                <LuTimer />
                <span>{formatRelativeTime(videoDetails?.created_at)}</span>
              </div>
            </div>
            
            <div className="wrap-right">
              <PayoutAmount amount={videoDetails?.stats?.total_hive_reward ?? 0} size={13} onClick={toggleTooltip} />

              <span className="wrap">
                <UpvoteCount
                  count={optimisticVoteCount}
                  voted={isVoted}
                  onClick={toggleTooltip}
                  loading={isLoading}
                  onCountEnter={() => setOpenToolTip(true)}
                  onCountLeave={() => setOpenToolTip(false)}
                  size={13}
                >
                  <div className="loader-circle">
                    <TailChase className="loader-circle" size="15" speed="1.5" color="red" />
                  </div>
                </UpvoteCount>
                {openTooltip && <ToolTip tooltipVoters={tooltipVoters} />}
              </span>

              {isInWatchLater && (
                <button
                  className={`watch-later-remove-btn ${isRemovingWatchLater ? 'loading' : ''}`}
                  onClick={handleRemoveFromWatchLater}
                  disabled={isRemovingWatchLater}
                  title="Remove from Watch Later"
                >
                  <span className="watch-later-icon-wrap">
                    <MdWatchLater />
                    <span className="x-badge">&times;</span>
                  </span>
                </button>
              )}

              {authenticated && isLoggedIn() && (
                <>
                  <button className="playlist-btn" onClick={() => setIsPlaylistModalOpen(true)} title="Add to playlist">
                    <MdPlaylistAdd />
                  </button>
                  <Button text="Tip" prominent onClick={() => setIsTipModalOpen(true)} />
                </>
              )}

              <UpvoteTooltip
                showTooltip={showTooltip}
                setShowTooltip={setShowTooltip}
                author={author}
                permlink={permlink}
                setIsVoted={setIsVoted}
                setOptimisticVoteCount={setOptimisticVoteCount}
                weight={weight}
                setWeight={setWeight}
                voteValue={voteValue}
                setVoteValue={setVoteValue}
                setAccountData={setAccountData}
                accountData={accountData}
              />
            </div>
          </div>
        </div>

        {/* Show PlaylistBar when watching from a playlist, otherwise show VideoPlaylists */}
        {playlistData ? (
          <PlaylistBar
            playlist={playlistData.playlist}
            videos={playlistData.videos}
            currentIndex={playlistData.currentIndex}
            onClose={onClosePlaylist}
          />
        ) : (
          <VideoPlaylists author={author} permlink={permlink} />
        )}

        <div className="description-wrap">
          <div className="blog-content">
            <BlogContent author={author} permlink={permlink} />
          </div>
        </div>

        <CommentSection
          videoDetails={videoDetails}
          author={author}
          permlink={permlink}
          setIsVoted={setIsVoted}
          currentTime={videoControls?.currentTime}
          duration={videoControls?.duration}
        />
      </div>
      
      {isTipModalOpen && (
        <TipModal
          recipient={author}
          isOpen={isTipModalOpen}
          onClose={() => setIsTipModalOpen(false)}
        />
      )}

      <AddToPlaylistModal
        isOpen={isPlaylistModalOpen}
        onClose={() => setIsPlaylistModalOpen(false)}
        author={author}
        permlink={permlink}
        videoTitle={videoDetails?.title}
      />
    </>
  );
};

PlayVideo.propTypes = {
  videoDetails: PropTypes.shape({
    title: PropTypes.string.isRequired,
    description: PropTypes.string,
    thumbnail_url: PropTypes.string,
    body: PropTypes.string,
    stats: PropTypes.shape({
      num_votes: PropTypes.number,
      total_hive_reward: PropTypes.number,
      num_comments: PropTypes.number,
    }),
    author: PropTypes.shape({
      follower_count: PropTypes.number,
      id: PropTypes.string,
    }),
    community: PropTypes.shape({
      title: PropTypes.string,
      username: PropTypes.string,
    }),
    tags: PropTypes.arrayOf(PropTypes.string),
    created_at: PropTypes.string,
  }),
  author: PropTypes.string.isRequired,
  permlink: PropTypes.string.isRequired,
  playlistData: PropTypes.shape({
    playlist: PropTypes.object,
    videos: PropTypes.array,
    currentIndex: PropTypes.number,
  }),
  onClosePlaylist: PropTypes.func,
};

export default PlayVideo;