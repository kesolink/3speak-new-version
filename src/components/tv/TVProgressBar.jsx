import React from 'react';
import PropTypes from 'prop-types';
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

const TVProgressBar = ({ currentTime, duration, isVisible, overlay }) => {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!isVisible) return null;

  return (
    <div className={`tv-progress-bar ${overlay ? 'tv-progress-bar--overlay' : ''}`}>
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
  );
};

TVProgressBar.propTypes = {
  currentTime: PropTypes.number,
  duration: PropTypes.number,
  isVisible: PropTypes.bool,
  overlay: PropTypes.bool,
};

TVProgressBar.defaultProps = {
  currentTime: 0,
  duration: 0,
  isVisible: true,
  overlay: false,
};

export default TVProgressBar;
