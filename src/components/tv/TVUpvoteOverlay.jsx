import React, { useEffect, useState, useRef, useCallback } from 'react';
import { IoChevronUpCircleOutline } from 'react-icons/io5';
import { TailChase } from 'ldrs/react';
import 'ldrs/react/TailChase.css';
import './TVUpvoteOverlay.scss';

const TVUpvoteOverlay = ({
  isOpen,
  onClose,
  weight,
  setWeight,
  voteValue,
  onVote,
  isLoading,
  hiveAuthMessage
}) => {
  // Focus index: 0 = slider, 1 = vote button
  const [focusIndex, setFocusIndex] = useState(0);
  const overlayRef = useRef(null);

  // Reset focus when overlay opens
  useEffect(() => {
    if (isOpen) {
      setFocusIndex(0);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      const WEIGHT_STEP = 5;

      switch (event.keyCode) {
        case 37: // Left arrow
          if (focusIndex === 0) {
            // Decrease weight
            const newWeight = Math.max(1, parseInt(weight) - WEIGHT_STEP);
            setWeight(newWeight);
          } else if (focusIndex === 1) {
            // Move back to slider
            setFocusIndex(0);
          }
          event.preventDefault();
          event.stopPropagation();
          break;

        case 39: // Right arrow
          if (focusIndex === 0) {
            // Increase weight
            const newWeight = Math.min(100, parseInt(weight) + WEIGHT_STEP);
            setWeight(newWeight);
          }
          event.preventDefault();
          event.stopPropagation();
          break;

        case 38: // Up arrow
          if (focusIndex === 1) {
            // Move from vote button back to slider
            setFocusIndex(0);
          } else {
            // On slider, close overlay
            onClose();
          }
          event.preventDefault();
          event.stopPropagation();
          break;

        case 40: // Down arrow
          if (focusIndex === 0) {
            // Move from slider to vote button
            setFocusIndex(1);
          } else {
            // On vote button, close overlay
            onClose();
          }
          event.preventDefault();
          event.stopPropagation();
          break;

        case 13: // Enter
          if (focusIndex === 0) {
            // Move to vote button
            setFocusIndex(1);
          } else if (focusIndex === 1 && !isLoading) {
            // Trigger vote
            onVote();
          }
          event.preventDefault();
          event.stopPropagation();
          break;

        case 10009: // Samsung TV Back
        case 27: // Escape
          onClose();
          event.preventDefault();
          event.stopPropagation();
          break;

        default:
          break;
      }
    };

    // Use capture phase to intercept before other handlers
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, focusIndex, weight, setWeight, onClose, onVote, isLoading]);

  if (!isOpen) return null;

  return (
    <div className="tv-upvote-overlay" ref={overlayRef}>
      <div className="tv-upvote-modal">
        <h2>Vote Weight</h2>

        <div className="weight-display">
          <span className="weight-value">{weight}%</span>
          <span className="vote-value">${voteValue}</span>
        </div>

        <div className={`slider-container${focusIndex === 0 ? ' focused' : ''}`}>
          <span className="slider-label">1%</span>
          <input
            type="range"
            min="1"
            max="100"
            value={weight}
            onChange={(e) => setWeight(parseInt(e.target.value))}
            className="tv-slider"
          />
          <span className="slider-label">100%</span>
        </div>

        <div className="slider-hint">
          {focusIndex === 0 && '← → to adjust • ↓ or Enter for Vote'}
          {focusIndex === 1 && 'Enter to vote • ↑ or ← to go back'}
        </div>

        <button
          className={`vote-button${focusIndex === 1 ? ' focused' : ''}`}
          onClick={onVote}
          disabled={isLoading}
        >
          {isLoading ? (
            <TailChase size="20" speed="1.5" color="white" />
          ) : (
            <>
              <IoChevronUpCircleOutline size={24} />
              <span>Vote</span>
            </>
          )}
        </button>

        {hiveAuthMessage && (
          <div className="hiveauth-waiting">
            <TailChase size="16" speed="1.5" color="#e31337" />
            <span>{hiveAuthMessage}</span>
          </div>
        )}

        <p className="close-hint">Press Back to close</p>
      </div>
    </div>
  );
};

export default TVUpvoteOverlay;
