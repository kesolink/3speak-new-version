import React from 'react';
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
}) => {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!isVisible) return null;

  return (
    <div className={`tv-progress-bar ${overlay ? 'tv-progress-bar--overlay' : ''}`}>
      {/* Playback Controls Row */}
      {showControls && (
        <div className="tv-playback-controls">
          <div className="tv-controls-center">
            <button
              className="tv-control-btn"
              onClick={onSeekBackward}
              title="Rewind 10 seconds"
            >
              <TbRewindBackward10 size={28} />
            </button>
            <button
              className="tv-control-btn tv-control-btn--play"
              onClick={onTogglePlay}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <FaPause size={24} /> : <FaPlay size={24} />}
            </button>
            <button
              className="tv-control-btn"
              onClick={onSeekForward}
              title="Forward 10 seconds"
            >
              <TbRewindForward10 size={28} />
            </button>
          </div>
          <div className="tv-controls-right">
            <button
              className="tv-control-btn"
              onClick={onToggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <FaCompress size={22} /> : <FaExpand size={22} />}
            </button>
          </div>
        </div>
      )}

      {/* Progress Bar Row */}
      <div className="tv-progress-row">
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
};

export default TVProgressBar;
