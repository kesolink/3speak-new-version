import React, { useEffect, useState, useRef, useCallback } from 'react';
import './UpvoteTooltip.scss';
import { useAppStore } from '../../lib/store';
import { IoChevronUpCircleOutline } from 'react-icons/io5';
import { toast } from 'sonner';
import { estimate, getUersContent, getVotePower } from '../../utils/hiveUtils';
import { TailChase } from 'ldrs/react';
import 'ldrs/react/TailChase.css';
import { Orbit } from 'ldrs/react';
import 'ldrs/react/Orbit.css';
import { voteWithAioha, isLoggedIn } from '../../hive-api/aioha';
import { useTVMode } from '../../context/TVModeContext';

const UpvoteTooltip = ({
  author,
  permlink,
  showTooltip,
  setShowTooltip,
  voteValue,
  setVoteValue,
  setIsVoted,
  weight,
  setWeight,
  accountData,
  setAccountData,
  setOptimisticVoteCount
}) => {
  const { user, authenticated } = useAppStore();
  const { isTVMode } = useTVMode();
  const [isLoading, setIsLoading] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const tooltipRef = useRef(null);

  // TV Mode state for tooltip navigation
  // -1 = not focused, 0 = slider, 1 = vote button
  const [tvFocusIndex, setTvFocusIndex] = useState(-1);
  const sliderRef = useRef(null);
  const voteBtnRef = useRef(null);

  // Auto-focus slider when tooltip opens in TV mode
  useEffect(() => {
    if (isTVMode && showTooltip) {
      setTvFocusIndex(0); // Focus on slider
    } else if (!showTooltip) {
      setTvFocusIndex(-1); // Reset focus when tooltip closes
    }
  }, [isTVMode, showTooltip]);

  // Use callback ref to focus slider when it mounts
  const setSliderRef = useCallback((node) => {
    sliderRef.current = node;
    // Focus when the slider element mounts (tooltip just opened) in TV mode
    if (node && isTVMode && showTooltip) {
      // Use requestAnimationFrame to ensure the element is fully rendered
      requestAnimationFrame(() => {
        node.focus();
      });
    }
  }, [isTVMode, showTooltip]);

  // TV Mode keyboard navigation
  useEffect(() => {
    if (!isTVMode || !showTooltip || tvFocusIndex < 0) return;

    const handleKeyDown = (event) => {
      const WEIGHT_STEP = 5; // Change weight by 5% per keypress

      switch (event.keyCode) {
        case 37: // Left arrow - decrease weight (when on slider)
          if (tvFocusIndex === 0) {
            const newWeight = Math.max(1, parseInt(weight) - WEIGHT_STEP);
            setWeight(newWeight);
            event.preventDefault();
            event.stopPropagation();
          } else if (tvFocusIndex === 1) {
            // Move from vote button back to slider
            setTvFocusIndex(0);
            sliderRef.current?.focus();
            event.preventDefault();
            event.stopPropagation();
          }
          break;
        case 39: // Right arrow - increase weight (when on slider)
          if (tvFocusIndex === 0) {
            const newWeight = Math.min(100, parseInt(weight) + WEIGHT_STEP);
            setWeight(newWeight);
            event.preventDefault();
            event.stopPropagation();
          }
          break;
        case 38: // Up arrow - exit tooltip
          setShowTooltip(false);
          setTvFocusIndex(-1);
          event.preventDefault();
          event.stopPropagation();
          break;
        case 40: // Down arrow - exit tooltip
          setShowTooltip(false);
          setTvFocusIndex(-1);
          event.preventDefault();
          event.stopPropagation();
          break;
        case 13: // Enter
          if (tvFocusIndex === 0) {
            // Move from slider to vote button
            setTvFocusIndex(1);
            event.preventDefault();
            event.stopPropagation();
          } else if (tvFocusIndex === 1 && !isLoading) {
            // Trigger vote
            handleVote();
            event.preventDefault();
            event.stopPropagation();
          }
          break;
        case 10009: // Samsung TV Back
        case 27: // Escape
          setShowTooltip(false);
          setTvFocusIndex(-1);
          event.preventDefault();
          event.stopPropagation();
          break;
        default:
          break;
      }
    };

    // Use capture phase to intercept events before Watch.jsx
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isTVMode, showTooltip, tvFocusIndex, weight, setWeight, setShowTooltip, isLoading]);

  // Handle click outside to close tooltip
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target)) {
        setShowTooltip(false);
      }
    };

    if (showTooltip) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTooltip, setShowTooltip]);

  // Fetch account data when tooltip opens
  useEffect(() => {
    if (!user || !showTooltip) return;

    const fetchAccountData = async () => {
      try {
        setIsCalculating(true);
        const result = await getVotePower(user);
        
        if (result && result.account) {
          setAccountData(result.account);
          // Calculate initial vote value with the fetched account data
          await calculateVoteValue(result.account, weight);
        } else {
          console.error('No account data returned');
          setVoteValue('0.000');
        }
      } catch (err) {
        console.error('Error fetching account:', err);
        setVoteValue('0.000');
      } finally {
        setIsCalculating(false);
      }
    };

    fetchAccountData();
  }, [user, showTooltip]);

  // Recalculate vote value when weight changes
  useEffect(() => {
    if (!accountData) return;
    
    const debounceTimer = setTimeout(() => {
      calculateVoteValue(accountData, weight);
    }, 100); // Small debounce to avoid too many calculations

    return () => clearTimeout(debounceTimer);
  }, [weight, accountData]);

  const calculateVoteValue = async (account, percent) => {
    try {
      setIsCalculating(true);
      const estimatedValue = await estimate(account, percent);
      setVoteValue(estimatedValue || '0.000');
    } catch (err) {
      console.error('Error calculating vote value:', err);
      setVoteValue('0.000');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleVote = async () => {
    if (!authenticated || !isLoggedIn()) {
      toast.error('Login to complete this operation');
      return;
    }

    setIsLoading(true);
    const voteWeight = Math.round(weight * 100); // Convert 1-100 to 100-10000

    try {
      const data = await getUersContent(author, permlink);
      
      if (!data) {
        toast.error('Could not fetch post data');
        setIsLoading(false);
        return;
      }

      const existingVote = data.active_votes?.find((vote) => vote.voter === user);

      if (existingVote) {
        if (existingVote.percent === voteWeight) {
          toast.info('You already voted with this weight. Choose a different value.');
          setIsLoading(false);
          return;
        }
      }

      // Use aioha for client-side voting
      await voteWithAioha(author, permlink, voteWeight);

      // Success case - If this is a new vote (not a re-vote), increment vote count
      if (!existingVote) {
        setOptimisticVoteCount((prevCount) => prevCount + 1);
      }

      toast.success(`Vote successful! Value: $${voteValue}`);
      setIsVoted(true);
      setShowTooltip(false);
    } catch (err) {
      console.error('Vote failed:', err);
      toast.error('Vote failed: ' + (err.message || 'please try again'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="upvote-tooltip-wrap" 
      ref={tooltipRef} 
      onClick={(e) => e.preventDefault()}
    >
      {showTooltip && (
        <div className={`tooltip-box${isTVMode && tvFocusIndex >= 0 ? ' tv-active' : ''}`}>
          <p>Vote Weight: {weight}%</p>
          <div className="wrap">
            {isLoading ? (
              <div className='wrap-circle'>
                <TailChase 
                  className="loader-circle" 
                  size="15" 
                  speed="1.5" 
                  color="red" 
                />
              </div>
            ) : (
              <IoChevronUpCircleOutline
                ref={voteBtnRef}
                size={30}
                onClick={handleVote}
                className={`circle-vote-btn${tvFocusIndex === 1 ? ' tv-element-focused' : ''}`}
                style={{ cursor: 'pointer' }}
              />
            )}

            <input
              ref={setSliderRef}
              type="range"
              min="1"
              max="100"
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
              disabled={isLoading}
              className={tvFocusIndex === 0 ? 'tv-element-focused' : ''}
            />
            <p>
              {isCalculating ? (
                <Orbit size="30" speed="1.5" color="red" />
              ) : (
                `$${voteValue}`
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpvoteTooltip;