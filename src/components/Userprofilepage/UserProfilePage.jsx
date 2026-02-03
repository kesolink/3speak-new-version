import { useQuery } from '@apollo/client';
import React, { useEffect, useState, useRef, useCallback } from 'react'
import { getFollowers } from '../../hive-api/api';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { GET_SOCIAL_FEED_BY_CREATOR } from '../../graphql/queries';
import Cards from '../Cards/Cards';
import icon from "../../../public/images/stack.png"
import "./UserProfilePage.scss"
import BarLoader from '../Loader/BarLoader';
import { Quantum } from 'ldrs/react'
import 'ldrs/react/Quantum.css'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { FEED_URL } from '../../utils/config';
import Card3 from '../Cards/Card3';
import { IoMdShare } from 'react-icons/io';
import { IoLogoRss } from 'react-icons/io5';
import Follower from './Follower';
import { useTVSidebarNavigation } from '../../hooks/useTVSidebarNavigation';
import TVScrollIndicator from '../tv/TVScrollIndicator';



function UserProfilePage() {
    const { user } = useParams();
    const navigate = useNavigate()
    const queryClient = useQueryClient();
    const containerRef = useRef(null);
    const buttonGroupRef = useRef(null);
    const [focusedIndex, setFocusedIndex] = useState(0);
    const [tvFocusArea, setTvFocusArea] = useState('grid'); // 'grid' or 'buttons'
    const [buttonFocusIndex, setButtonFocusIndex] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [follower, setFollower] = useState(null)
    const [show, setShow] = useState("video");
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
  refetch,
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
          
            // Flatten all pages into a single array
            const videos = data?.pages.flat() || [];


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

  // TV Navigation - calculate grid dimensions
  const getGridInfo = useCallback(() => {
    if (!containerRef.current) return { columns: 4, totalCards: 0 };
    const cards = containerRef.current.querySelectorAll('[data-tv-focusable="true"]');
    const totalCards = cards.length;
    // Estimate columns based on container width (cards are ~280px wide)
    const containerWidth = containerRef.current.offsetWidth;
    const columns = Math.max(1, Math.floor(containerWidth / 300));
    return { columns, totalCards };
  }, []);

  // Focus a card by index
  const focusCard = useCallback((index) => {
    if (!containerRef.current) return;
    const cards = containerRef.current.querySelectorAll('[data-tv-focusable="true"]');
    if (cards.length === 0) return;

    const clampedIndex = Math.max(0, Math.min(index, cards.length - 1));

    // Remove focus from all cards and buttons
    cards.forEach(card => card.classList.remove('tv-focused'));
    const buttons = buttonGroupRef.current?.querySelectorAll('.btn');
    buttons?.forEach(btn => btn.classList.remove('tv-focused'));

    // Add focus to target card
    const targetCard = cards[clampedIndex];
    if (targetCard) {
      targetCard.classList.add('tv-focused');
      targetCard.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      setFocusedIndex(clampedIndex);
      setTvFocusArea('grid');
    }
  }, []);

  // Focus a button by index
  const focusButton = useCallback((index) => {
    if (!buttonGroupRef.current) return;
    const buttons = buttonGroupRef.current.querySelectorAll('.btn');
    if (buttons.length === 0) return;

    const clampedIndex = Math.max(0, Math.min(index, buttons.length - 1));

    // Remove focus from all cards and buttons
    const cards = containerRef.current?.querySelectorAll('[data-tv-focusable="true"]');
    cards?.forEach(card => card.classList.remove('tv-focused'));
    buttons.forEach(btn => btn.classList.remove('tv-focused'));

    // Add focus to target button
    const targetButton = buttons[clampedIndex];
    if (targetButton) {
      targetButton.classList.add('tv-focused');
      targetButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setButtonFocusIndex(clampedIndex);
      setTvFocusArea('buttons');
    }
  }, []);

  // Handle refresh when pressing up in first row
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['UserProfilePage', user] });
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, queryClient, refetch, user]);

  // Handle navigation
  const handleNavigate = useCallback((direction) => {
    const { columns, totalCards } = getGridInfo();

    // Handle button area navigation
    if (tvFocusArea === 'buttons') {
      const buttons = buttonGroupRef.current?.querySelectorAll('.btn');
      const buttonCount = buttons?.length || 0;

      switch (direction) {
        case 'left':
          if (buttonFocusIndex > 0) {
            focusButton(buttonFocusIndex - 1);
            return true;
          }
          return false; // At left edge, let sidebar open
        case 'right':
          if (buttonFocusIndex < buttonCount - 1) {
            focusButton(buttonFocusIndex + 1);
          }
          return true;
        case 'up':
          // At buttons, pressing up triggers refresh
          handleRefresh();
          return true;
        case 'down':
          // Move from buttons to video grid
          if (totalCards > 0) {
            focusCard(0);
          }
          return true;
        default:
          return false;
      }
    }

    // Handle grid navigation
    if (totalCards === 0) return false;

    let newIndex = focusedIndex;

    switch (direction) {
      case 'left':
        if (focusedIndex % columns === 0) {
          return false; // At left edge, let sidebar open
        }
        newIndex = focusedIndex - 1;
        break;
      case 'right':
        if ((focusedIndex + 1) % columns === 0 || focusedIndex >= totalCards - 1) {
          return true; // At right edge, but handled
        }
        newIndex = focusedIndex + 1;
        break;
      case 'up':
        if (focusedIndex < columns) {
          // At top row of grid, move to buttons
          focusButton(0);
          return true;
        }
        newIndex = focusedIndex - columns;
        break;
      case 'down':
        if (focusedIndex + columns >= totalCards) {
          return true; // At bottom edge
        }
        newIndex = focusedIndex + columns;
        break;
      default:
        return false;
    }

    if (newIndex >= 0 && newIndex < totalCards) {
      focusCard(newIndex);
      return true;
    }
    return false;
  }, [focusedIndex, getGridInfo, focusCard, handleRefresh, tvFocusArea, buttonFocusIndex, focusButton]);

  // Handle selection (Enter key)
  const handleSelect = useCallback(() => {
    // Handle button selection
    if (tvFocusArea === 'buttons') {
      const buttons = buttonGroupRef.current?.querySelectorAll('.btn');
      if (buttons && buttons[buttonFocusIndex]) {
        buttons[buttonFocusIndex].click();
      }
      return;
    }

    // Handle grid selection
    if (!containerRef.current) return;
    const cards = containerRef.current.querySelectorAll('[data-tv-focusable="true"]');
    if (cards[focusedIndex]) {
      const href = cards[focusedIndex].getAttribute('href');
      if (href) {
        navigate(href);
      }
    }
  }, [focusedIndex, navigate, tvFocusArea, buttonFocusIndex]);

  // Use TV sidebar navigation hook
  const { isTVMode, tvSidebarVisible, closeSidebar } = useTVSidebarNavigation({
    onNavigate: handleNavigate,
    onSelect: handleSelect,
    onLeftAtEdge: () => handleNavigate('left')
  });

  // Handle TV back button - navigate back to previous page
  useEffect(() => {
    if (!isTVMode) return;

    const handleBackButton = (event) => {
      // If sidebar is open, close it first
      if (tvSidebarVisible) {
        closeSidebar();
        event.preventDefault();
        return;
      }

      // Navigate back to previous page
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/');
      }
      event.preventDefault();
    };

    document.addEventListener('tv-back-button', handleBackButton);
    return () => document.removeEventListener('tv-back-button', handleBackButton);
  }, [isTVMode, tvSidebarVisible, closeSidebar, navigate]);

  // Focus first card when data loads in TV mode
  useEffect(() => {
    if (isTVMode && videos.length > 0 && !isLoading) {
      setTimeout(() => focusCard(0), 100);
    }
  }, [isTVMode, videos.length, isLoading, focusCard]);

  return (
    <div className="profile-page-container">
      {/* TV Mode: Vertical scroll indicator */}
      <TVScrollIndicator />

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
      
            <div className="button-group" ref={buttonGroupRef}>
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
          <span onClick={() => setShow("video")}>Videos</span> 
        </div>
        <span className="followers" onClick={()=>{handleWalletNavigate(user)}}>wallet</span> 
      </div>
      <div className="container-video" ref={containerRef}>
        {isRefreshing && (
          <div className="tv-refresh-indicator">Refreshing...</div>
        )}
  {show === "video" ? (
    isLoading ? (
      <BarLoader />
    ) : videos?.length === 0 ? (
      <div className='empty-wrap'>
        <img src={icon} alt="" />
        <span>No Video Data Available</span>
      </div>
    ) : (
      <Card3 videos={videos} loading={isFetchingNextPage} />
    )
  ) : (
    <Follower count={follower} />
  )}
</div>

    </div>
  )
}

export default UserProfilePage