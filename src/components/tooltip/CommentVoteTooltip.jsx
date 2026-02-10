import React, { useEffect, useState, useRef, useCallback } from 'react';
import './UpvoteTooltip.scss';
import { useAppStore } from '../../lib/store';
import { X, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { getUersContent, getVotePower, getDynamicProps, votingPower, accountVestingShares, calculateVoteRshares } from '../../utils/hiveUtils';
import { TailChase } from 'ldrs/react';
import 'ldrs/react/TailChase.css';
import { Orbit } from 'ldrs/react';
import 'ldrs/react/Orbit.css';
import { voteWithAioha, isLoggedIn } from '../../hive-api/aioha';

// Pure-math vote estimation — no API calls
function estimateLocal(account, dynamicProps, percent) {
  if (!account || !dynamicProps) return '0.000';
  const { fundRecentClaims, fundRewardBalance, base, quote } = dynamicProps;
  if (!fundRecentClaims || !fundRewardBalance || !base || !quote) return '0.000';

  const sign = percent < 0 ? -1 : 1;
  const userEffectiveVests = accountVestingShares(account);
  const userVotingPower = votingPower(account) * 100;
  const voteWeight = Math.abs(percent) * 100;
  const voteEffectiveShares = calculateVoteRshares(userEffectiveVests, userVotingPower * (voteWeight / 10000));
  const voteValue = (voteEffectiveShares / fundRecentClaims) * fundRewardBalance * (base / quote);
  return (Math.max(voteValue, 0) * sign).toFixed(3);
}

const CommentVoteTooltip = ({
  author,
  permlink,
  showTooltip,
  setShowTooltip,
  weight: parentWeight,
  setWeight: setParentWeight,
  setCommentList,
  voteValue: parentVoteValue,
  setVoteValue: setParentVoteValue,
  accountData,
  setAccountData,
  setActiveTooltipPermlink,
  onVoteSuccess,
  compact
}) => {
  const { user, authenticated } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const isLoadingRef = useRef(false);
  const tooltipRef = useRef(null);

  // DOM refs for custom slider
  const sliderContainerRef = useRef(null);
  const fillRef = useRef(null);
  const thumbRef = useRef(null);
  const labelRef = useRef(null);
  const valueRef = useRef(null);

  // Current weight lives in a ref — no React state during drag
  const weightRef = useRef(parentWeight);

  // Cached data for local estimation (fetched once on open)
  const cachedAccountRef = useRef(null);
  const cachedDynamicPropsRef = useRef(null);

  // Update all DOM elements for a given weight (no React re-render)
  const updateSliderDOM = useCallback((w) => {
    weightRef.current = w;
    if (labelRef.current) labelRef.current.textContent = `Vote Weight: ${w}%`;
    if (fillRef.current) fillRef.current.style.width = `${w}%`;
    if (thumbRef.current) thumbRef.current.style.left = `${w}%`;
    if (valueRef.current && cachedAccountRef.current && cachedDynamicPropsRef.current) {
      valueRef.current.textContent = `$${estimateLocal(cachedAccountRef.current, cachedDynamicPropsRef.current, w)}`;
    }
  }, []);

  // Build the custom div-based slider when popup opens
  useEffect(() => {
    if (!showTooltip) return;
    const container = sliderContainerRef.current;
    if (!container) return;

    weightRef.current = parentWeight;
    if (labelRef.current) labelRef.current.textContent = `Vote Weight: ${parentWeight}%`;

    // Build track → fill + thumb
    const track = document.createElement('div');
    track.className = 'vote-slider-track';

    const fill = document.createElement('div');
    fill.className = 'vote-slider-fill';
    fill.style.width = `${parentWeight}%`;

    const thumb = document.createElement('div');
    thumb.className = 'vote-slider-thumb';
    thumb.style.left = `${parentWeight}%`;

    track.appendChild(fill);
    track.appendChild(thumb);

    fillRef.current = fill;
    thumbRef.current = thumb;

    // Convert mouse/touch clientX → 1–100 percent
    const getPct = (clientX) => {
      const rect = track.getBoundingClientRect();
      const raw = ((clientX - rect.left) / rect.width) * 100;
      return Math.round(Math.max(1, Math.min(100, raw)));
    };

    let dragging = false;

    const onPointerDown = (clientX) => {
      if (isLoadingRef.current) return;
      dragging = true;
      const pct = getPct(clientX);
      updateSliderDOM(pct);
    };

    const onPointerMove = (clientX) => {
      if (!dragging) return;
      const pct = getPct(clientX);
      updateSliderDOM(pct);
    };

    const onPointerUp = () => { dragging = false; };

    // Mouse events
    const onMouseDown = (e) => { e.preventDefault(); onPointerDown(e.clientX); };
    const onMouseMove = (e) => { onPointerMove(e.clientX); };
    const onMouseUp = () => { onPointerUp(); };

    // Touch events
    const onTouchStart = (e) => { onPointerDown(e.touches[0].clientX); };
    const onTouchMove = (e) => { if (dragging) { e.preventDefault(); onPointerMove(e.touches[0].clientX); } };
    const onTouchEnd = () => { onPointerUp(); };

    track.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    track.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);

    container.appendChild(track);

    return () => {
      track.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      track.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      if (container.contains(track)) container.removeChild(track);
      fillRef.current = null;
      thumbRef.current = null;
    };
  }, [showTooltip]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  // Close on Escape key
  useEffect(() => {
    if (!showTooltip) return;
    const handleKey = (e) => {
      if (e.key === 'Escape' && !isLoadingRef.current) {
        setShowTooltip(false);
        setActiveTooltipPermlink?.(null);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [showTooltip, setShowTooltip, setActiveTooltipPermlink]);

  // Fetch account + dynamic props ONCE when popup opens
  useEffect(() => {
    if (!user || !showTooltip) return;

    let cancelled = false;
    const init = async () => {
      setInitializing(true);
      try {
        const [acctResult, dynProps] = await Promise.all([
          getVotePower(user),
          getDynamicProps(),
        ]);

        if (cancelled) return;

        const acct = acctResult?.account;
        if (acct) {
          setAccountData(acct);
          cachedAccountRef.current = acct;
        }
        if (dynProps) {
          cachedDynamicPropsRef.current = dynProps;
        }

        // Initial estimate — update DOM directly
        if (acct && dynProps && valueRef.current) {
          valueRef.current.textContent = `$${estimateLocal(acct, dynProps, weightRef.current)}`;
        }
      } catch (err) {
        console.error('Error fetching vote data:', err);
        if (!cancelled && valueRef.current) valueRef.current.textContent = '$0.000';
      } finally {
        if (!cancelled) setInitializing(false);
      }
    };

    init();
    return () => { cancelled = true; };
  }, [user, showTooltip]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVote = async () => {
    if (!authenticated || !isLoggedIn()) {
      toast.error('Login to complete this operation');
      return;
    }

    setIsLoading(true);
    const currentWeight = weightRef.current;
    const voteWeight = Math.round(currentWeight * 100);

    try {
      const data = await getUersContent(author, permlink);

      if (!data) {
        toast.error('Could not fetch post data');
        setIsLoading(false);
        return;
      }

      const existingVote = data.active_votes?.find((vote) => vote.voter === user);

      if (existingVote && existingVote.percent === voteWeight) {
        toast.info('You already voted with this weight. Choose a different value.');
        setIsLoading(false);
        return;
      }

      await voteWithAioha(author, permlink, voteWeight);

      const finalValue = cachedAccountRef.current && cachedDynamicPropsRef.current
        ? estimateLocal(cachedAccountRef.current, cachedDynamicPropsRef.current, currentWeight)
        : '0.000';

      toast.success(`Vote successful! Value: $${finalValue}`);

      // Sync back to parent
      setParentWeight(currentWeight);
      setParentVoteValue(finalValue);

      const isNewVote = !existingVote;
      if (setCommentList) {
        setCommentList(prev => updateCommentsRecursively(prev, permlink, false, isNewVote));
      }

      if (onVoteSuccess) {
        onVoteSuccess(author, permlink, isNewVote, voteWeight);
      }

      setShowTooltip(false);
      setActiveTooltipPermlink?.(null);
    } catch (err) {
      console.error('Vote failed:', err);
      toast.error('Vote failed: ' + (err.message || 'please try again'));
    } finally {
      setIsLoading(false);
    }
  };

  const updateCommentsRecursively = (comments, targetPermlink, isRollback = false, isNewVote = true) => {
    return comments.map(comment => {
      if (comment.permlink === targetPermlink) {
        return {
          ...comment,
          has_voted: !isRollback,
          stats: {
            ...comment.stats,
            num_likes: isRollback
              ? Math.max(0, (comment.stats.num_likes || 0) - 1)
              : isNewVote
                ? (comment.stats.num_likes || 0) + 1
                : comment.stats.num_likes || 0,
          },
        };
      }

      if (comment.children && comment.children.length > 0) {
        return {
          ...comment,
          children: updateCommentsRecursively(comment.children, targetPermlink, isRollback, isNewVote),
        };
      }

      return comment;
    });
  };

  return (
    <>
      {showTooltip && (
        <div className="vote-popup-overlay" onMouseDown={(e) => {
          if (!isLoadingRef.current) {
            setShowTooltip(false);
            setActiveTooltipPermlink?.(null);
          }
        }}>
          <div
            className={`vote-popup${compact ? ' vote-popup--compact' : ''}`}
            ref={tooltipRef}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              className="vote-popup-close"
              onClick={() => {
                if (!isLoading) {
                  setShowTooltip(false);
                  setActiveTooltipPermlink?.(null);
                }
              }}
              disabled={isLoading}
            >
              <X size={18} />
            </button>

            <p className="vote-popup-label" ref={labelRef}>Vote Weight: {parentWeight}%</p>

            {/* Container for custom div-based slider — no <input> at all */}
            <div ref={sliderContainerRef} />

            <p className="vote-popup-value" ref={valueRef}>
              {initializing ? '' : `$${parentVoteValue}`}
            </p>
            {initializing && (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Orbit size="24" speed="1.5" color="red" />
              </div>
            )}

            <button
              className="vote-popup-submit"
              onClick={handleVote}
              disabled={isLoading || initializing}
            >
              {isLoading ? (
                <TailChase size="18" speed="1.5" color="white" />
              ) : (
                <>
                  <ChevronUp size={20} />
                  Vote
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default CommentVoteTooltip;
