import PropTypes from "prop-types";
import { getHiveUrl } from '../../utils/hiveNode';
import "./PlayVideo.scss";
import VideoControls from "../VideoControls/VideoControls";
import ViewCount from "../ViewCount/ViewCount";
import { LuTimer } from "react-icons/lu";
import { MdReplay, MdPlayArrow } from "react-icons/md";
import UpvoteCount from "../UpvoteCount/UpvoteCount";
import PayoutAmount from "../PayoutAmount/PayoutAmount";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useQuery } from "@apollo/client";
import { GET_PROFILE, GET_VIDEO } from "../../graphql/queries";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import BlogContent from "./BlogContent";
import CommentSection from "./CommentSection";
import { useAppStore } from '../../lib/store';
import { estimate, getUersContent, getVotePower } from "../../utils/hiveUtils";
import { getUserReputation } from "../../utils/reputation";
import ToolTip from "../tooltip/ToolTip";
import BeneficiariesTooltip from "../tooltip/BeneficiariesTooltip";
import { ImSpinner9 } from "react-icons/im";
import { useNavigate } from "react-router-dom";
import BarLoader from "../Loader/BarLoader";
import TipModal from "../../components/tip-reward/TipModal";
import { toast } from 'sonner';
import { TailChase } from 'ldrs/react';
import 'ldrs/react/TailChase.css';
import { getFollowers, getRelationshipBetweenAccounts } from "../../hive-api/api";
import CommentVoteTooltip from "../tooltip/CommentVoteTooltip";
import axios from "axios";
import { FEED_URL, HIVE_API_URL, CHECKER_URL, FEATURE_EDITOR } from '../../utils/config';
import { fixVideoThumbnail, fallbackImg } from '../../utils/fixThumbnails';
import { isLoggedIn, followWithAioha } from "../../hive-api/aioha";
import { MdPlaylistAdd, MdWatchLater, MdKeyboardArrowDown, MdKeyboardArrowUp, MdAdd, MdClose, MdShare, MdAttachMoney, MdPersonAdd, MdInfo } from "react-icons/md";
import { FaHeart } from "react-icons/fa";
import AddToPlaylistModal from "../AddToPlaylistModal/AddToPlaylistModal";
import VideoPlaylists from "../VideoPlaylists/VideoPlaylists";
import PlaylistBar from "../PlaylistBar/PlaylistBar";
import { useMyPlaylists, isVideoInPlaylist } from "../../hooks/useMyPlaylists";
import { removeFromPlaylist } from "../../utils/playlistOperations";
import { useQueryClient } from "@tanstack/react-query";
import AuthorBadge from "../AuthorBadge/AuthorBadge";
import Button from "../Button/Button";
import { Repeat2, Scissors, Tornado, Film, Music } from 'lucide-react';
import { recordReshare, getResharesForVideo } from '../../utils/reshares';
import EditorModal from '../modal/EditorModal';
import SubtitleOverlay from '../SubtitleOverlay/SubtitleOverlay';

dayjs.extend(relativeTime);

const PlayVideo = ({ videoDetails, author, permlink, playlistData, onClosePlaylist, videoControls, mobileReactionPanel, cinemaReactionPanel, videoRef, wrapperRef }) => {
  const { user, authenticated } = useAppStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const lastTouchRef = useRef(0); // prevent touch+mouse double-fire

  // Mobile collapsible details
  const [mobileDetailsExpanded, setMobileDetailsExpanded] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  // State
  const [openTooltip, setOpenToolTip] = useState(false);
  const [pinnedTooltip, setPinnedTooltip] = useState(false);
  const [tooltipVoters, setTooltipVoters] = useState([]);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [payoutInfo, setPayoutInfo] = useState(null);
  const [showBeneficiaries, setShowBeneficiaries] = useState(false);
  const [pinnedBeneficiaries, setPinnedBeneficiaries] = useState(false);
  const voteCountRef = useRef(null);
  const payoutRef = useRef(null);
  const [isTipModalOpen, setIsTipModalOpen] = useState(false);
  const [tipNudgeVisible, setTipNudgeVisible] = useState(false);
  const tipNudgeShownRef = useRef(false);
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
  const [authorReputation, setAuthorReputation] = useState(null);
  const [fabOpen, setFabOpen] = useState(false);
  const [isFollowingCreator, setIsFollowingCreator] = useState(null);
  const [followLoading, setFollowLoading] = useState(false);

  // Reshare state
  const [reshareCount, setReshareCount] = useState(0);
  const [hasReshared, setHasReshared] = useState(false);

  // Remix/clip eligibility (embed videos only, except meno)
  const [canRemixClip, setCanRemixClip] = useState(false);

  // Editor modal state
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editorVideoUrl, setEditorVideoUrl] = useState(null);
  const [editorVideoName, setEditorVideoName] = useState(null);
  const [editorClipStart, setEditorClipStart] = useState(null);
  const [editorClipEnd, setEditorClipEnd] = useState(null);
  const [editorVideoType, setEditorVideoType] = useState('video');
  const [remixDropdownOpen, setRemixDropdownOpen] = useState(false);
  const remixDropdownRef = useRef(null);

  // Clip mode state
  const [clipMode, setClipMode] = useState(false); // false | 'start' | 'end' | 'done'
  const [clipStart, setClipStart] = useState(null);
  const [clipEnd, setClipEnd] = useState(null);

  // Notify parent when clip mode changes (disables autoplay)
  useEffect(() => {
    if (videoControls?.onClipModeChange) {
      videoControls.onClipModeChange(!!clipMode);
    }
  }, [clipMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tip nudge at 90% playtime (only for logged-in viewers watching someone else's video)
  useEffect(() => {
    const duration = videoControls?.duration;
    const currentTime = videoControls?.currentTime;
    if (!duration || duration < 10 || tipNudgeShownRef.current) return;
    if (!authenticated || !isLoggedIn() || user === author) return;
    const triggerAt = duration * 0.9;
    if (currentTime >= triggerAt) {
      setTipNudgeVisible(true);
      tipNudgeShownRef.current = true;
    }
  }, [videoControls?.currentTime, videoControls?.duration, authenticated, user, author]);

  // Reset nudge state when video changes
  useEffect(() => {
    tipNudgeShownRef.current = false;
    setTipNudgeVisible(false);
  }, [author, permlink]);

  // Report popup open state to parent (blocks autoplay)
  useEffect(() => {
    const isVotePopupOpen = showTooltip && authenticated && isLoggedIn();
    videoControls?.onPopupOpen?.(tipNudgeVisible || isTipModalOpen || isVotePopupOpen);
  }, [tipNudgeVisible, isTipModalOpen, showTooltip, authenticated]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Fetch spkvideo separately (resilient — doesn't block videoDetails)
  const { data: videoData } = useQuery(GET_VIDEO, {
    variables: { author, permlink },
    skip: !author || !permlink,
  });
  const spkvideo = videoData?.socialPost?.spkvideo || videoDetails?.spkvideo;
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
      return `https://hotipfs-3speak-1.b-cdn.net/ipfs/${ipfsHash}`;
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

      // Extract beneficiaries and payout breakdown
      const isPaidOut = parseFloat(data.pending_payout_value) === 0 && parseFloat(data.total_payout_value) > 0;
      if (data.beneficiaries?.length) {
        setBeneficiaries(
          data.beneficiaries
            .map(b => ({ account: b.account, weight: b.weight / 100 }))
            .sort((a, b) => b.weight - a.weight)
        );
      } else {
        setBeneficiaries([]);
      }
      if (isPaidOut) {
        const curatorPayout = parseFloat(data.curator_payout_value);
        const authorPayout = parseFloat(data.total_payout_value);
        setPayoutInfo({ isPaidOut: true, curatorPayout, authorPayout, totalPayout: curatorPayout + authorPayout });
      } else {
        setPayoutInfo({ isPaidOut: false, pendingPayout: parseFloat(data.pending_payout_value) });
      }

      // Single state update
      setOptimisticVoteCount(updates.optimisticVoteCount || 0);
      setIsVoted(updates.isVoted || false);
      setTooltipVoters(updates.tooltipVoters || []);

      // Determine remix/clip eligibility from MongoDB via checker
      try {
        const reusableRes = await axios.get(`${CHECKER_URL}/api/video/${author}/${permlink}`);
        setCanRemixClip(reusableRes.data?.success && !!reusableRes.data.reusable);
      } catch {
        setCanRemixClip(false);
      }
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

  // Effect: Fetch speak data, followers, reputation, and follow status (only when author/permlink changes)
  useEffect(() => {
    if (!author || !permlink) return;

    speakWatchData();
    getFollowersCount(author);
    getUserReputation(author).then(rep => setAuthorReputation(rep)).catch(() => {});

    // Check follow relationship for FAB button
    if (user && author !== user) {
      setIsFollowingCreator(null);
      getRelationshipBetweenAccounts(user, author).then((relation) => {
        if (relation?.follows != null) setIsFollowingCreator(relation.follows);
      }).catch(() => {});
    }
  }, [author, permlink, speakWatchData, getFollowersCount, user]);

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
        const response = await axios.post(getHiveUrl(), {
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


  // Fetch reshare data
  useEffect(() => {
    if (!author || !permlink) return;
    setReshareCount(0);
    setHasReshared(false);
    (async () => {
      try {
        const { reshares, count } = await getResharesForVideo(author, permlink);
        setReshareCount(count);
        if (user) {
          setHasReshared(reshares.some(r => r.username === user));
        }
      } catch (err) {
        console.warn('Failed to fetch reshares:', err);
      }
    })();
  }, [author, permlink, user]);

  const handleReshare = useCallback(async () => {
    if (!authenticated || !user) {
      toast.error('Log in to reshare');
      return;
    }
    if (hasReshared) return;
    const result = await recordReshare(user, author, permlink);
    if (result) {
      setHasReshared(true);
      setReshareCount(prev => prev + 1);
      toast.success('Reshared!');
    } else {
      toast.error('Failed to reshare');
    }
  }, [authenticated, user, author, permlink, hasReshared]);

  const handleRemix = useCallback((mediaType = 'video') => {
    if (!videoUrlSelected) {
      toast.error('Could not resolve video URL for remix');
      return;
    }
    if (videoControls?.onPause) videoControls.onPause();
    setEditorVideoUrl(videoUrlSelected);
    setEditorVideoName(`${author} - ${videoDetails?.title || permlink}`);
    setEditorClipStart(null);
    setEditorClipEnd(null);
    setEditorVideoType(mediaType);
    setShowEditorModal(true);
  }, [videoUrlSelected, author, permlink, videoDetails?.title, videoControls]);

  // Close remix dropdown on click outside
  useEffect(() => {
    if (!remixDropdownOpen) return;
    const handleClickOutside = (e) => {
      if (remixDropdownRef.current && !remixDropdownRef.current.contains(e.target)) {
        setRemixDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [remixDropdownOpen]);

  // Clip mode helpers
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleStartClipMode = useCallback(() => {
    setClipMode('start');
    setClipStart(null);
    setClipEnd(null);
    toast.info('Seek to the start of your clip, then click "Set Start"');
  }, []);

  const handleSetClipStart = useCallback(() => {
    const time = Math.floor(videoControls?.currentTime || 0);
    setClipStart(time);
    setClipMode('end');
    toast.info('Now seek to the end of your clip and click "Set End"');
  }, [videoControls?.currentTime]);

  const handleSetClipEnd = useCallback(() => {
    let time = Math.floor(videoControls?.currentTime || 0);
    if (clipStart !== null && time <= clipStart) {
      toast.error('End time must be after start time');
      return;
    }
    if (clipStart !== null && time - clipStart > 60) {
      time = clipStart + 60;
      toast.info('Clip trimmed to 1 minute — we will trim the clip at the end of the timeline.');
    }
    setClipEnd(time);
    setClipMode('done');
    toast.success(`Clip set: ${formatTime(clipStart)} – ${formatTime(time)}. Now click on "Create Clip"`);
  }, [videoControls?.currentTime, clipStart]);

  const handleCancelClip = useCallback(() => {
    setClipMode(false);
    setClipStart(null);
    setClipEnd(null);
  }, []);

  const handleCreateClip = useCallback(() => {
    if (!videoUrlSelected) {
      toast.error('Could not resolve video URL');
      return;
    }
    if (videoControls?.onPause) videoControls.onPause();
    setEditorVideoUrl(videoUrlSelected);
    setEditorVideoName(`${author} - ${videoDetails?.title || permlink} (clip)`);
    setEditorClipStart(clipStart);
    setEditorClipEnd(clipEnd);
    setShowEditorModal(true);
    setClipMode(false);
  }, [videoUrlSelected, author, permlink, videoDetails?.title, clipStart, clipEnd, videoControls]);

  const handleProfileNavigate = useCallback((userName) => {
    navigate(`/p/${userName}`);
  }, [navigate]);

  const toggleTooltip = useCallback(() => {
    if (!authenticated || !isLoggedIn()) return;
    setShowTooltip((prev) => !prev);
  }, [authenticated]);

  const handleShare = useCallback(async () => {
    const time = Math.floor(videoControls?.currentTime || 0);
    const timeParam = time > 0 ? `&t=${time}` : '';
    const shareUrl = `${window.location.origin}/watch?v=${author}/${permlink}${timeParam}`;
    const shareData = { title: videoDetails?.title || '3Speak Video', url: shareUrl };
    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied to clipboard!');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        try {
          await navigator.clipboard.writeText(shareUrl);
          toast.success('Link copied to clipboard!');
        } catch {
          toast.error('Failed to share');
        }
      }
    }
  }, [author, permlink, videoDetails?.title, videoControls?.currentTime]);

  const handleFabFollow = useCallback(async () => {
    if (!isLoggedIn()) { toast.error('Please login to follow users'); return; }
    if (followLoading) return;
    setFollowLoading(true);
    setIsFollowingCreator(true);
    try {
      await followWithAioha(author, true);
      toast.success(`Followed @${author}`);
    } catch (err) {
      setIsFollowingCreator(false);
      toast.error('Failed to follow: ' + err.message);
    } finally {
      setFollowLoading(false);
    }
  }, [author, followLoading]);

  const handleCommunityNavigate = useCallback((community) => {
    navigate(`/community/${community}`);
  }, [navigate]);

  // Loading state - show loader if essential data is missing
  if (!videoDetails) {
    return <BarLoader />;
  }

  return (
    <>
      <div className="play-video">
        <div className="top-container">
          {(author && permlink) ? (
            <div className="video-iframe-wrapper" ref={wrapperRef}>
              <video
                ref={videoRef}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  background: "#000",
                }}
                playsInline
              />
              {videoControls?.subtitleCues?.length > 0 && (
                <SubtitleOverlay
                  currentTime={videoControls.subtitleCurrentTime}
                  cues={videoControls.subtitleCues}
                  style={videoControls.subtitleStyle}
                />
              )}
              {tipNudgeVisible && !isTipModalOpen && authenticated && isLoggedIn() && user !== author && (
                <div className="tip-nudge">
                  <FaHeart className="tip-nudge-emoji" style={{ color: '#e53935' }} />
                  <span className="tip-nudge-text">Enjoyed this? Send <strong>@{author}</strong> a tip!</span>
                  <button type="button" className="tip-nudge-btn" onClick={() => { setTipNudgeVisible(false); setIsTipModalOpen(true); }}>
                    Tip
                  </button>
                  <button type="button" className="tip-nudge-close" onClick={() => setTipNudgeVisible(false)} aria-label="Dismiss">
                    <MdClose size={14} />
                  </button>
                </div>
              )}
              {videoControls?.videoEnded && (
                <div className="video-ended-overlay">
                  <button type="button" className="video-replay-btn" onClick={videoControls.onReplay} title="Replay">
                    <MdReplay size={48} />
                  </button>
                  {!videoControls.autoplayNext && videoControls.endSuggestions?.length > 0 && (
                    <div className="video-ended-suggestions">
                      {videoControls.endSuggestions.map((v, i) => {
                        const vAuthor = v?.author?.username || v?.author?.id || v?.author || v?.owner;
                        return (
                          <a
                            key={`${vAuthor}-${v.permlink}-${i}`}
                            className="video-ended-card"
                            href={`/watch?v=${vAuthor}/${v.permlink}`}
                            onClick={(e) => { e.preventDefault(); navigate(`/watch?v=${vAuthor}/${v.permlink}`); }}
                          >
                            <img src={fixVideoThumbnail(v)} alt={v.title} onError={(e) => (e.currentTarget.src = fallbackImg)} />
                            <div className="video-ended-card-info">
                              <span className="video-ended-card-title">{v.title?.length > 40 ? v.title.slice(0, 40) + '...' : v.title}</span>
                              <span className="video-ended-card-author">@{vAuthor}</span>
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              {videoControls?.autoplayBlocked && !videoControls?.videoEnded && (
                <div className="video-replay-overlay" onClick={videoControls.onAutoplayTap}>
                  <button type="button" className="video-replay-btn" title="Play">
                    <MdPlayArrow size={48} />
                  </button>
                </div>
              )}
              {videoControls && (
                <>
                  <div
                    className="video-interact-overlay"
                    style={showTooltip ? { pointerEvents: 'none' } : undefined}
                    onMouseMove={() => {
                      if (window.innerWidth > 767) videoControls.onMouseMove();
                    }}
                    onMouseDown={() => {
                      if (Date.now() - lastTouchRef.current < 500) return;
                      if (window.innerWidth <= 767) videoControls.onToggleControls();
                      else videoControls.onTogglePlay();
                    }}
                    onTouchStart={(e) => {
                      lastTouchRef.current = Date.now();
                      e.preventDefault();
                      videoControls.onToggleControls();
                    }}
                  />
                  <VideoControls
                    currentTime={videoControls.currentTime}
                    duration={videoControls.duration}
                    buffered={videoControls.buffered}
                    isPlaying={videoControls.isPlaying}
                    isMuted={videoControls.isMuted}
                    volume={videoControls.volume}
                    isFullscreen={videoControls.isFullscreen}
                    isVisible={videoControls.isVisible}
                    onTogglePlay={videoControls.onTogglePlay}
                    onToggleMute={videoControls.onToggleMute}
                    onVolumeChange={videoControls.onVolumeChange}
                    onSeekBackward={videoControls.onSeekBackward}
                    onSeekForward={videoControls.onSeekForward}
                    onSeek={videoControls.onSeek}
                    onToggleFullscreen={videoControls.onToggleFullscreen}
                    markers={videoControls.markers}
                    onMarkerSelect={videoControls.onMarkerSelect}
                    onReactToMoment={videoControls.onReactToMoment}
                    onCycleReactionSize={videoControls.onCycleReactionSize}
                    reactionSizeLabel={videoControls.reactionSizeLabel}
                    onTogglePip={videoControls.onTogglePip}
                    qualityLevels={videoControls.qualityLevels}
                    currentQuality={videoControls.currentQuality}
                    onQualityChange={videoControls.onQualityChange}
                    glowMode={videoControls.glowMode}
                    onToggleGlow={videoControls.onToggleGlow}
                    autoplayNext={videoControls.autoplayNext}
                    onToggleAutoplay={videoControls.onToggleAutoplay}
                    subtitleLanguages={videoControls.subtitleLanguages}
                    selectedSubtitleLang={videoControls.selectedSubtitleLang}
                    onSubtitleChange={videoControls.onSubtitleChange}
                    subtitleLoading={videoControls.subtitleLoading}
                    subtitleStyle={videoControls.subtitleStyle}
                    onSubtitleStyleChange={videoControls.onSubtitleStyleChange}
                    playbackRate={videoControls.playbackRate}
                    onPlaybackRateChange={videoControls.onPlaybackRateChange}
                    onHoldControls={videoControls.onHoldControls}
                    onReleaseControls={videoControls.onReleaseControls}
                  />
                </>
              )}
            </div>
          ) : (
            <div className="video-loader">
              <ImSpinner9 className="spinner" />
            </div>
          )}

          <div className="video-title-row">
            <div className="video-title-col">
              <h3>{videoDetails?.title}</h3>
              <div className="mobile-title-meta">
                <AuthorBadge
                  author={videoDetails?.author?.id}
                  reputation={authorReputation}
                  followersCount={followData?.follower_count}
                />
                {community_id && (
                  <div className="community-title-wrap" onClick={() => handleCommunityNavigate(community_id)}>
                    <img src={`https://images.hive.blog/u/${community_id}/avatar/small`} alt="" />
                    <div className="community-text">
                      <span className="community-name">{comunity_name}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              className="mobile-title-toggle"
              onClick={() => setMobileDetailsExpanded(prev => !prev)}
            >
              {mobileDetailsExpanded ? <MdKeyboardArrowUp size={20} /> : <MdKeyboardArrowDown size={20} />}
            </button>
          </div>

          <div className={`video-details-collapsible${mobileDetailsExpanded ? '' : ' collapsed'}`}>
          <div className="badges-row">
            <AuthorBadge
              author={videoDetails?.author?.id}
              reputation={authorReputation}
              followersCount={followData?.follower_count}
              showFollow
              isFollowing={isFollowingCreator}
              onFollow={(_, willFollow) => setIsFollowingCreator(willFollow)}
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
            <div className="tag-wrapper">
              {tags.map((tag, index) => (
                <span key={index} onClick={() => handleSelectTag(tag)}>{tag}</span>
              ))}
            </div>
          </div>

          <div className="play-video-info">
            <div className="info-stats-row">
              <div className="wrap-left">
                <ViewCount views={view} author={author} permlink={permlink} size={13} />
                <div className="wrap">
                  <LuTimer />
                  <span>{formatRelativeTime(videoDetails?.created_at)}</span>
                </div>
              </div>
              <div className="wrap-right-stats">
                <span
                  ref={payoutRef}
                  onMouseEnter={() => setShowBeneficiaries(true)}
                  onMouseLeave={() => setShowBeneficiaries(false)}
                  onClick={() => setPinnedBeneficiaries(prev => !prev)}
                  style={{ cursor: 'pointer' }}
                >
                  <PayoutAmount amount={videoDetails?.stats?.total_hive_reward ?? 0} size={13} />
                </span>
                {(showBeneficiaries || pinnedBeneficiaries) && beneficiaries.length > 0 && (
                  <BeneficiariesTooltip
                    beneficiaries={beneficiaries}
                    payoutInfo={payoutInfo}
                    displayTotal={videoDetails?.stats?.total_hive_reward ?? 0}
                    anchorRef={payoutRef}
                    pinned={pinnedBeneficiaries}
                    onClose={() => setPinnedBeneficiaries(false)}
                  />
                )}
                <span className="wrap" ref={voteCountRef}>
                  <UpvoteCount
                    count={optimisticVoteCount}
                    voted={isVoted}
                    onClick={toggleTooltip}
                    loading={isLoading}
                    onCountEnter={() => setOpenToolTip(true)}
                    onCountLeave={() => setOpenToolTip(false)}
                    onCountClick={() => setPinnedTooltip(prev => !prev)}
                    size={13}
                  >
                    <div className="loader-circle">
                      <TailChase className="loader-circle" size="15" speed="1.5" color="red" />
                    </div>
                  </UpvoteCount>
                  {(openTooltip || pinnedTooltip) && (
                    <ToolTip
                      tooltipVoters={tooltipVoters}
                      anchorRef={voteCountRef}
                      pinned={pinnedTooltip}
                      onClose={() => setPinnedTooltip(false)}
                    />
                  )}
                </span>
              </div>
            </div>

            <div className="info-buttons-row">
              {FEATURE_EDITOR && canRemixClip && (
                <div className="info-buttons-left">
                  <button
                    type="button"
                    className={`clip-btn${clipMode ? ' active' : ''}`}
                    onClick={clipMode ? handleCancelClip : handleStartClipMode}
                    title={!authenticated ? 'Log in to clip' : clipMode ? 'Cancel clip' : 'Clip video'}
                    disabled={!authenticated}
                  >
                    <Scissors size={16} />
                    <span className="tools-row-label">Clip Video</span>
                  </button>
                  {clipMode && (
                    <div className="clip-bar-inline">
                      <span className="clip-bar-inline-label">
                        {clipMode === 'start' && 'Seek to start'}
                        {clipMode === 'end' && `${formatTime(clipStart)} →`}
                        {clipMode === 'done' && `${formatTime(clipStart)} – ${formatTime(clipEnd)}`}
                      </span>
                      {clipMode === 'start' && (
                        <button type="button" className="clip-action-btn" onClick={handleSetClipStart}>Set Start</button>
                      )}
                      {clipMode === 'end' && (
                        <button type="button" className="clip-action-btn" onClick={handleSetClipEnd}>Set End</button>
                      )}
                      {clipMode === 'done' && (
                        <button type="button" className="clip-action-btn" onClick={handleCreateClip}>Create Clip</button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="info-buttons-right">
                <button
                  type="button"
                  className="share-btn"
                  onClick={handleShare}
                  title="Share with timestamp"
                >
                  <MdShare size={16} />
                </button>

                <button
                  type="button"
                  className={`reshare-btn${hasReshared ? ' reshared' : ''}`}
                  onClick={handleReshare}
                  disabled={!authenticated || !isLoggedIn()}
                  title={!authenticated ? 'Log in to reshare' : hasReshared ? 'Reshared' : 'Reshare'}
                >
                  <Repeat2 size={16} />
                  {reshareCount > 0 && <span className="reshare-count">{reshareCount}</span>}
                </button>

                {isInWatchLater && (
                  <button
                    type="button"
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
                    <button type="button" className="playlist-btn" onClick={() => setIsPlaylistModalOpen(true)} title="Add to playlist">
                      <MdPlaylistAdd />
                    </button>
                    <Button text="Tip" prominent onClick={() => setIsTipModalOpen(true)} />
                  </>
                )}

                {authenticated && isLoggedIn() && (
                  <CommentVoteTooltip
                    showTooltip={showTooltip}
                    setShowTooltip={setShowTooltip}
                    author={author}
                    permlink={permlink}
                    weight={weight}
                    setWeight={setWeight}
                    voteValue={voteValue}
                    setVoteValue={setVoteValue}
                    accountData={accountData}
                    setAccountData={setAccountData}
                    compact
                    onVoteSuccess={(a, p, isNewVote) => {
                      setIsVoted(true);
                      if (isNewVote) setOptimisticVoteCount(prev => prev + 1);
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Mobile-only tools row (Clip hidden from info-buttons-left on mobile) */}
          {FEATURE_EDITOR && canRemixClip && (
            <div className="tools-row mobile-only">
              <button
                type="button"
                className={`clip-btn${clipMode ? ' active' : ''}`}
                onClick={clipMode ? handleCancelClip : handleStartClipMode}
                title={!authenticated ? 'Log in to clip' : clipMode ? 'Cancel clip' : 'Clip video'}
                disabled={!authenticated}
              >
                <Scissors size={16} />
                <span className="tools-row-label">Clip Video</span>
              </button>
            </div>
          )}

        {/* Clip mode bar */}
        {FEATURE_EDITOR && clipMode && (
          <div className="clip-bar">
            <div className="clip-bar-info">
              <Scissors size={16} />
              <span className="clip-bar-label">
                {clipMode === 'start' && 'Seek to the start of your clip'}
                {clipMode === 'end' && `Start: ${formatTime(clipStart)} — Now seek to the end`}
                {clipMode === 'done' && `Clip: ${formatTime(clipStart)} – ${formatTime(clipEnd)}`}
              </span>
            </div>
            <div className="clip-bar-actions">
              {clipMode === 'start' && (
                <button type="button" className="clip-action-btn" onClick={handleSetClipStart}>Set Start</button>
              )}
              {clipMode === 'end' && (
                <button type="button" className="clip-action-btn" onClick={handleSetClipEnd}>Set End</button>
              )}
              {clipMode === 'done' && (
                <button type="button" className="clip-action-btn" onClick={handleCreateClip}>Create Clip</button>
              )}
              <button type="button" className="clip-cancel-btn" onClick={handleCancelClip}>Cancel</button>
            </div>
          </div>
        )}

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
          <div className={`description-collapsible${descriptionExpanded ? '' : ' collapsed'}`}>
            <div className="blog-content">
              <BlogContent author={author} permlink={permlink} />
            </div>
          </div>
          <button
            type="button"
            className="description-toggle-btn"
            onClick={() => setDescriptionExpanded(prev => !prev)}
          >
            {descriptionExpanded ? 'Hide description' : 'Show description'}
          </button>
        </div>
        </div>{/* end video-details-collapsible */}
        </div>{/* end top-container */}

        {/* Mobile reactions slot — between description and comments */}
        {mobileReactionPanel && (
          <div className="mobile-reactions-slot">
            {mobileReactionPanel}
          </div>
        )}

        {/* Cinema mode reactions slot — between description and comments (desktop) */}
        {cinemaReactionPanel && (
          <div className="cinema-reactions-slot">
            {cinemaReactionPanel}
          </div>
        )}

        <CommentSection
          videoDetails={videoDetails}
          author={author}
          permlink={permlink}
          setIsVoted={setIsVoted}
          currentTime={videoControls?.currentTime}
          duration={videoControls?.duration}
          onSeek={videoControls?.onSeek}
          onRefreshReactions={videoControls?.onRefreshReactions}
          onPause={videoControls?.onPause}
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

      <EditorModal
        isOpen={showEditorModal}
        onClose={() => setShowEditorModal(false)}
        videoUrl={editorVideoUrl}
        videoName={editorVideoName}
        videoType={editorVideoType}
        clipStart={editorClipStart}
        clipEnd={editorClipEnd}
        originalAuthor={author}
        originalPermlink={permlink}
      />

      {/* Mobile FAB — speed-dial for quick actions */}
      {!videoControls?.isFullscreen && fabOpen && (
        <div className="fab-backdrop" onClick={() => setFabOpen(false)} />
      )}
      {!videoControls?.isFullscreen && (
        <div className={`fab-speed-dial${fabOpen ? ' open' : ''}`}>
          {fabOpen && (
            <div className="fab-actions">
              <div className="fab-action">
                <span className="fab-action-label">Share</span>
                <button
                  className="fab-action-btn"
                  onClick={() => { handleShare(); setFabOpen(false); }}
                  aria-label="Share"
                >
                  <MdShare size={20} />
                </button>
              </div>

              <div className="fab-action">
                <span className="fab-action-label">Details</span>
                <button
                  className={`fab-action-btn${mobileDetailsExpanded ? ' fab-action-btn--active' : ''}`}
                  onClick={() => { setMobileDetailsExpanded(prev => !prev); setFabOpen(false); }}
                  aria-label="Toggle details"
                >
                  <MdInfo size={20} />
                </button>
              </div>

              {authenticated && isLoggedIn() && (
                <div className="fab-action">
                  <span className="fab-action-label">Playlist</span>
                  <button
                    className="fab-action-btn"
                    onClick={() => { setIsPlaylistModalOpen(true); setFabOpen(false); }}
                    aria-label="Add to playlist"
                  >
                    <MdPlaylistAdd size={20} />
                  </button>
                </div>
              )}

              {authenticated && isLoggedIn() && !isFollowingCreator && author !== user && (
                <div className="fab-action">
                  <span className="fab-action-label">Follow</span>
                  <button
                    className="fab-action-btn"
                    onClick={() => { handleFabFollow(); setFabOpen(false); }}
                    aria-label="Follow creator"
                  >
                    <MdPersonAdd size={20} />
                  </button>
                </div>
              )}

              {authenticated && isLoggedIn() && (
                <div className="fab-action">
                  <span className="fab-action-label">Tip</span>
                  <button
                    className="fab-action-btn"
                    onClick={() => { setIsTipModalOpen(true); setFabOpen(false); }}
                    aria-label="Tip"
                  >
                    <MdAttachMoney size={20} />
                  </button>
                </div>
              )}

              {FEATURE_EDITOR && canRemixClip && authenticated && isLoggedIn() && (
                <div className="fab-action">
                  <span className="fab-action-label">Clip Video</span>
                  <button
                    className={`fab-action-btn${clipMode ? ' fab-action-btn--active' : ''}`}
                    onClick={() => { setMobileDetailsExpanded(true); handleStartClipMode(); setFabOpen(false); }}
                    aria-label="Clip"
                  >
                    <Scissors size={18} />
                  </button>
                </div>
              )}

              {authenticated && isLoggedIn() && (
                <div className="fab-action">
                  <span className="fab-action-label">Reshare{reshareCount > 0 ? ` (${reshareCount})` : ''}</span>
                  <button
                    className={`fab-action-btn${hasReshared ? ' fab-action-btn--voted' : ''}`}
                    onClick={() => { handleReshare(); setFabOpen(false); }}
                    aria-label="Reshare"
                  >
                    <Repeat2 size={20} />
                  </button>
                </div>
              )}

              {authenticated && isLoggedIn() && (
                <div className="fab-action">
                  <span className="fab-action-label">Vote</span>
                  <button
                    className={`fab-action-btn${isVoted ? ' fab-action-btn--voted' : ''}`}
                    onClick={() => { setMobileDetailsExpanded(true); setShowTooltip(true); setFabOpen(false); }}
                    aria-label="Vote"
                  >
                    <FaHeart size={18} />
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            className="fab-main"
            onClick={() => setFabOpen(prev => !prev)}
            aria-label={fabOpen ? 'Close menu' : 'Open actions'}
          >
            {fabOpen ? <MdClose size={24} /> : <MdAdd size={24} />}
          </button>
        </div>
      )}
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
  mobileReactionPanel: PropTypes.node,
  cinemaReactionPanel: PropTypes.node,
  videoRef: PropTypes.oneOfType([PropTypes.func, PropTypes.object]),
  wrapperRef: PropTypes.oneOfType([PropTypes.func, PropTypes.object]),
};

export default PlayVideo;