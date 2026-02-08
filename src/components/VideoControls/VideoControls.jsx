import { useState, useCallback, useRef } from 'react';
import { FaPlay, FaPause, FaExpand, FaCompress, FaVolumeUp, FaVolumeMute } from 'react-icons/fa';
import { TbRewindBackward10, TbRewindForward10 } from 'react-icons/tb';
import './VideoControls.scss';

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


function VideoControls({
  currentTime,
  duration,
  isPlaying,
  isMuted,
  isFullscreen,
  onSeekBackward,
  onSeekForward,
  onTogglePlay,
  onToggleMute,
  onToggleFullscreen,
  onSeek,
  isVisible,
  markers,
  onMarkerSelect,
}) {
  const resolvedMarkers = markers || [];

  const [hovering, setHovering] = useState(false);
  const [hoveredMarker, setHoveredMarker] = useState(null);
  const trackRef = useRef(null);
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleTrackClick = useCallback((e) => {
    if (!trackRef.current || !duration) return;
    const rect = trackRef.current.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek?.(fraction * duration);
  }, [duration, onSeek]);

  const handleMarkerClick = useCallback((e, time, index) => {
    e.stopPropagation();
    onSeek?.(time);
    onMarkerSelect?.(index);
  }, [onSeek, onMarkerSelect]);

  const show = isVisible || hovering;

  return (
    <div
      className={`video-controls${show ? ' visible' : ''}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Progress bar */}
      <div className="vc-progress-row">
        <div className="vc-progress-track" ref={trackRef} onClick={handleTrackClick}>
          <div className="vc-progress-fill" style={{ width: `${progress}%` }} />

          {/* Timeline markers */}
          {duration > 0 && resolvedMarkers.map((marker, i) => {
            const pos = (marker.time / duration) * 100;
            if (pos < 0 || pos > 100) return null;
            return (
              <div
                key={i}
                className={`vc-marker${hoveredMarker === i ? ' vc-marker--active' : ''}${marker.isVideo ? ' vc-marker--video' : ' vc-marker--comment'}`}
                style={{ left: `${pos}%` }}
                onClick={(e) => handleMarkerClick(e, marker.time, i)}
                onMouseEnter={() => setHoveredMarker(i)}
                onMouseLeave={() => setHoveredMarker(null)}
              >
                <div className="vc-marker-line" />
                <div className="vc-marker-avatar-wrap">
                  <img
                    className="vc-marker-avatar"
                    src={marker.avatar}
                    alt={marker.label || ''}
                  />
                  {marker.replyCount > 0 && (
                    <span className="vc-marker-reply-count">{marker.replyCount}</span>
                  )}
                </div>
                {hoveredMarker === i && marker.label && (
                  <div className="vc-marker-tooltip">
                    {marker.label}
                    {marker.replyCount > 0 && ` (${marker.replyCount} ${marker.replyCount === 1 ? 'reply' : 'replies'})`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Controls row */}
      <div className="vc-controls-row">
        <div className="vc-controls-left">
          <button className="vc-btn" onClick={onSeekBackward} title="Rewind 10s">
            <TbRewindBackward10 size={18} />
          </button>
          <button className="vc-btn vc-btn--play" onClick={onTogglePlay} title={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <FaPause size={14} /> : <FaPlay size={14} />}
          </button>
          <button className="vc-btn" onClick={onSeekForward} title="Forward 10s">
            <TbRewindForward10 size={18} />
          </button>
          <div className="vc-time">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>
        <div className="vc-controls-right">
          <button className="vc-btn" onClick={onToggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
            {isMuted ? <FaVolumeMute size={14} /> : <FaVolumeUp size={14} />}
          </button>
          <button className="vc-btn" onClick={onToggleFullscreen} title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
            {isFullscreen ? <FaCompress size={14} /> : <FaExpand size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default VideoControls;
