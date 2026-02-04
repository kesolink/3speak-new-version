import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { FaPlay, FaPause, FaExpand, FaCompress } from 'react-icons/fa';
import { TbRewindBackward10, TbRewindForward10 } from 'react-icons/tb';
import './TVProgressBar.scss';

// Format seconds to MM:SS or HH:MM:SS
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Control button indices: 0=rewind, 1=play/pause, 2=forward, 3=fullscreen
const CONTROL_COUNT = 4;
// Focus areas: 'controls' or 'timeline'
const FOCUS_AREA_CONTROLS = 'controls';
const FOCUS_AREA_TIMELINE = 'timeline';

const TVProgressBar = ({
  currentTime,
  duration,
  isVisible,
  overlay,
  isPlaying,
  isFullscreen,
  onSeekBackward,
  onTogglePlay,
  onSeekForward,
  onToggleFullscreen,
  showControls,
  onNavigateLeft,
  onNavigateRight,
  onNavigateDown,
  hasFocus, // Whether progress bar has focus (controls keyboard handling)
}) => {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Debug logging
  console.log('[TVProgressBar] isPlaying:', isPlaying, 'overlay:', overlay);

  // Focus state for keyboard navigation (start with fullscreen button focused)
  const [focusedIndex, setFocusedIndex] = useState(3);
  const [focusArea, setFocusArea] = useState(FOCUS_AREA_CONTROLS);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event) => {
    console.log('[TVProgressBar] handleKeyDown called, keyCode:', event.keyCode, 'showControls:', showControls);
    if (!showControls) return;

    switch (event.keyCode) {
      case 37: // Left arrow
        if (focusArea === FOCUS_AREA_CONTROLS) {
          if (focusedIndex > 0) {
            setFocusedIndex(prev => prev - 1);
          } else {
            // At leftmost control, navigate out to sidebar (wrap around)
            onNavigateLeft?.();
          }
        } else if (focusArea === FOCUS_AREA_TIMELINE) {
          // Seek backward when on timeline
          onSeekBackward?.();
        }
        event.preventDefault();
        event.stopPropagation();
        break;
      case 39: // Right arrow
        console.log('[TVProgressBar] Right arrow - focusArea:', focusArea, 'focusedIndex:', focusedIndex);
        if (focusArea === FOCUS_AREA_CONTROLS) {
          if (focusedIndex < CONTROL_COUNT - 1) {
            setFocusedIndex(prev => prev + 1);
          } else {
            // At rightmost control, navigate out to recommendations
            console.log('[TVProgressBar] Calling onNavigateRight');
            onNavigateRight?.();
          }
        } else if (focusArea === FOCUS_AREA_TIMELINE) {
          // Seek forward when on timeline
          onSeekForward?.();
        }
        event.preventDefault();
        event.stopPropagation();
        break;
      case 40: // Down arrow
        console.log('[TVProgressBar] Down arrow - focusArea:', focusArea);
        if (focusArea === FOCUS_AREA_CONTROLS) {
          setFocusArea(FOCUS_AREA_TIMELINE);
        } else if (focusArea === FOCUS_AREA_TIMELINE) {
          // On timeline, navigate down to author container
          console.log('[TVProgressBar] Calling onNavigateDown');
          onNavigateDown?.();
        }
        event.preventDefault();
        event.stopPropagation();
        break;
      case 38: // Up arrow
        if (focusArea === FOCUS_AREA_TIMELINE) {
          setFocusArea(FOCUS_AREA_CONTROLS);
        }
        event.preventDefault();
        event.stopPropagation();
        break;
      case 13: // Enter
        if (focusArea === FOCUS_AREA_CONTROLS) {
          // Activate the focused control
          switch (focusedIndex) {
            case 0:
              onSeekBackward?.();
              break;
            case 1:
              onTogglePlay?.();
              break;
            case 2:
              onSeekForward?.();
              break;
            case 3:
              onToggleFullscreen?.();
              break;
          }
        } else if (focusArea === FOCUS_AREA_TIMELINE) {
          // Toggle play/pause when on timeline
          onTogglePlay?.();
        }
        event.preventDefault();
        event.stopPropagation();
        break;
      default:
        break;
    }
  }, [showControls, focusedIndex, focusArea, onSeekBackward, onTogglePlay, onSeekForward, onToggleFullscreen, onNavigateLeft, onNavigateRight, onNavigateDown]);

  // Add keyboard listener when controls are visible AND progress bar has focus
  useEffect(() => {
    console.log('[TVProgressBar] useEffect - isVisible:', isVisible, 'showControls:', showControls, 'hasFocus:', hasFocus);
    // Only add keyboard listener when hasFocus is true (or undefined for backwards compatibility in fullscreen)
    if (!isVisible || !showControls || hasFocus === false) {
      console.log('[TVProgressBar] Skipping keyboard listener setup');
      return;
    }

    console.log('[TVProgressBar] Adding keyboard listener');
    // Use bubble phase (false) so this runs after Watch.jsx's capture phase handler returns early
    document.addEventListener('keydown', handleKeyDown, false);
    return () => {
      console.log('[TVProgressBar] Removing keyboard listener');
      document.removeEventListener('keydown', handleKeyDown, false);
    };
  }, [isVisible, showControls, hasFocus, handleKeyDown]);

  if (!isVisible) return null;

  return (
    <div className={`tv-progress-bar ${overlay ? 'tv-progress-bar--overlay' : ''}`}>
      {/* Playback Controls Row */}
      {showControls && (
        <div className="tv-playback-controls">
          <div className="tv-controls-center">
            <button
              className={`tv-control-btn ${focusArea === FOCUS_AREA_CONTROLS && focusedIndex === 0 ? 'tv-control-btn--focused' : ''}`}
              onClick={onSeekBackward}
              title="Rewind 10 seconds"
            >
              <TbRewindBackward10 size={18} />
            </button>
            <button
              className={`tv-control-btn tv-control-btn--play ${focusArea === FOCUS_AREA_CONTROLS && focusedIndex === 1 ? 'tv-control-btn--focused' : ''}`}
              onClick={onTogglePlay}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <FaPause size={16} /> : <FaPlay size={16} />}
            </button>
            <button
              className={`tv-control-btn ${focusArea === FOCUS_AREA_CONTROLS && focusedIndex === 2 ? 'tv-control-btn--focused' : ''}`}
              onClick={onSeekForward}
              title="Forward 10 seconds"
            >
              <TbRewindForward10 size={18} />
            </button>
          </div>
          <div className="tv-controls-right">
            <button
              className={`tv-control-btn ${focusArea === FOCUS_AREA_CONTROLS && focusedIndex === 3 ? 'tv-control-btn--focused' : ''}`}
              onClick={onToggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <FaCompress size={14} /> : <FaExpand size={14} />}
            </button>
          </div>
        </div>
      )}

      {/* Progress Bar Row */}
      <div className={`tv-progress-row ${focusArea === FOCUS_AREA_TIMELINE ? 'tv-progress-row--focused' : ''}`}>
        <div className="tv-progress-track">
          <div
            className="tv-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="tv-progress-time">
          <span>{formatTime(currentTime)}</span>
          <span className="tv-progress-separator">/</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};

TVProgressBar.propTypes = {
  currentTime: PropTypes.number,
  duration: PropTypes.number,
  isVisible: PropTypes.bool,
  overlay: PropTypes.bool,
  isPlaying: PropTypes.bool,
  isFullscreen: PropTypes.bool,
  onSeekBackward: PropTypes.func,
  onTogglePlay: PropTypes.func,
  onSeekForward: PropTypes.func,
  onToggleFullscreen: PropTypes.func,
  showControls: PropTypes.bool,
  onNavigateLeft: PropTypes.func,
  onNavigateRight: PropTypes.func,
  onNavigateDown: PropTypes.func,
  hasFocus: PropTypes.bool,
};

TVProgressBar.defaultProps = {
  currentTime: 0,
  duration: 0,
  isVisible: true,
  overlay: false,
  isPlaying: false,
  isFullscreen: false,
  onSeekBackward: () => {},
  onTogglePlay: () => {},
  onSeekForward: () => {},
  onToggleFullscreen: () => {},
  showControls: false,
  onNavigateLeft: () => {},
  onNavigateRight: () => {},
  onNavigateDown: () => {},
  hasFocus: undefined, // undefined = handle keys (backwards compatible), false = don't handle
};

export default TVProgressBar;
