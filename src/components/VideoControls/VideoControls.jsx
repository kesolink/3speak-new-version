import { useState, useCallback, useRef, useEffect } from 'react';
import { FaPlay, FaPause, FaExpand, FaCompress, FaVolumeUp, FaVolumeMute, FaVideo, FaCog } from 'react-icons/fa';
import { TbRewindBackward10, TbRewindForward10, TbArrowsMaximize, TbPictureInPicture, TbBulbFilled, TbMoonFilled } from 'react-icons/tb';
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
  buffered,
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
  onReactToMoment,
  onCycleReactionSize,
  reactionSizeLabel,
  onTogglePip,
  qualityLevels,
  currentQuality,
  onQualityChange,
  glowMode,
  onToggleGlow,
}) {
  const resolvedMarkers = markers || [];

  const [hovering, setHovering] = useState(false);
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);
  const qualityMenuRef = useRef(null);
  const isTouchDevice = typeof window !== 'undefined' && 'ontouchstart' in window;
  const [hoveredMarker, setHoveredMarker] = useState(null);
  const trackRef = useRef(null);
  const [dragProgress, setDragProgress] = useState(null); // non-null while dragging
  const progress = dragProgress !== null ? dragProgress : (duration > 0 ? (currentTime / duration) * 100 : 0);
  const bufferedPercent = (buffered || 0) * 100;

  // Build a heatmap gradient showing where reactions cluster
  const heatmapStyle = duration > 0 && resolvedMarkers.length > 0 ? (() => {
    // Create soft gaussian-like glows at each marker position
    const stops = resolvedMarkers.map(m => {
      const pos = (m.time / duration) * 100;
      const color = m.isVideo ? 'rgba(229,57,53,0.25)' : 'rgba(255,255,255,0.12)';
      return `${color} ${pos}%`;
    });
    // Interleave transparent stops to create isolated glows
    const gradient = [];
    for (const m of resolvedMarkers) {
      const pos = (m.time / duration) * 100;
      const color = m.isVideo ? 'rgba(229,57,53,0.25)' : 'rgba(255,255,255,0.12)';
      gradient.push(`transparent ${Math.max(0, pos - 3)}%`);
      gradient.push(`${color} ${pos}%`);
      gradient.push(`transparent ${Math.min(100, pos + 3)}%`);
    }
    return { background: `linear-gradient(to right, ${gradient.join(', ')})` };
  })() : null;

  // Get fraction (0-1) from a pointer/touch event relative to the track
  const fractionFromEvent = useCallback((e) => {
    if (!trackRef.current || !duration) return null;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const rect = trackRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, [duration]);

  // Drag/scrub support — visual progress updates instantly, seeks throttled to ~150ms
  const isDraggingRef = useRef(false);
  const dragFractionRef = useRef(0);
  const lastSeekTimeRef = useRef(0);
  const SEEK_THROTTLE_MS = 150;

  const handleTrackPointerDown = useCallback((e) => {
    if (e.button && e.button !== 0) return;
    const fraction = fractionFromEvent(e);
    if (fraction === null) return;
    isDraggingRef.current = true;
    dragFractionRef.current = fraction;
    setDragProgress(fraction * 100);
    onSeek?.(fraction * duration);
    lastSeekTimeRef.current = Date.now();
    e.preventDefault();
  }, [fractionFromEvent, duration, onSeek]);

  useEffect(() => {
    const handleMove = (e) => {
      if (!isDraggingRef.current || !trackRef.current || !duration) return;
      e.preventDefault();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const rect = trackRef.current.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      dragFractionRef.current = fraction;
      setDragProgress(fraction * 100);
      // Throttle actual seeks so HLS can keep up
      const now = Date.now();
      if (now - lastSeekTimeRef.current >= SEEK_THROTTLE_MS) {
        onSeek?.(fraction * duration);
        lastSeekTimeRef.current = now;
      }
    };
    const handleUp = () => {
      if (isDraggingRef.current && duration) {
        // Final precise seek on release
        onSeek?.(dragFractionRef.current * duration);
      }
      isDraggingRef.current = false;
      setDragProgress(null);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleUp);
    };
  }, [duration, onSeek]);

  // Close quality menu when clicking outside
  useEffect(() => {
    if (!qualityMenuOpen) return;
    const handleClickOutside = (e) => {
      if (qualityMenuRef.current && !qualityMenuRef.current.contains(e.target)) {
        setQualityMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [qualityMenuOpen]);

  const handleMarkerClick = useCallback((e, time, index) => {
    e.stopPropagation();
    onSeek?.(time);
    onMarkerSelect?.(index);
  }, [onSeek, onMarkerSelect]);

  const show = isVisible || hovering;

  return (
    <div
      className={`video-controls${show ? ' visible' : ''}`}
      onMouseEnter={() => { if (!isTouchDevice) setHovering(true); }}
      onMouseLeave={() => { if (!isTouchDevice) setHovering(false); }}
    >
      {/* Progress bar */}
      <div className="vc-progress-row">
        <div className="vc-progress-track" ref={trackRef} onMouseDown={handleTrackPointerDown} onTouchStart={handleTrackPointerDown}>
          {heatmapStyle && <div className="vc-heatmap" style={heatmapStyle} />}
          <div className="vc-buffered-fill" style={{ width: `${bufferedPercent}%` }} />
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
          {onReactToMoment && (
            <button className="vc-btn vc-btn--react" onClick={onReactToMoment} title="React to this moment">
              <FaVideo size={13} />
            </button>
          )}
          <button className="vc-btn" onClick={onToggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
            {isMuted ? <FaVolumeMute size={14} /> : <FaVolumeUp size={14} />}
          </button>
          {onCycleReactionSize && (
            <button className="vc-btn vc-btn--resize" onClick={onCycleReactionSize} title={`Player size: ${reactionSizeLabel || 'Standard'}`}>
              <TbArrowsMaximize size={15} />
              <span className="vc-size-label">{reactionSizeLabel || 'Standard'}</span>
            </button>
          )}
          {/* {onTogglePip && (
            <button className="vc-btn" onClick={onTogglePip} title="Picture-in-Picture">
              <TbPictureInPicture size={16} />
            </button>
          )} */}
          {onToggleGlow && (
            <button
              className={`vc-btn vc-btn--glow${glowMode === 'page' ? ' active' : ''}`}
              onClick={onToggleGlow}
              title={glowMode === 'off' ? 'Ambient light on' : 'Ambient light off'}
            >
              {glowMode === 'off' ? <TbMoonFilled size={15} /> : <TbBulbFilled size={15} />}
            </button>
          )}
          {qualityLevels && qualityLevels.length > 0 && (
            <div className="vc-quality-wrap" ref={qualityMenuRef}>
              <button className="vc-btn" onClick={() => setQualityMenuOpen(o => !o)} title="Quality">
                <FaCog size={14} />
              </button>
              {qualityMenuOpen && (
                <div className="vc-quality-menu">
                  <button
                    className={`vc-quality-item${currentQuality === -1 ? ' active' : ''}`}
                    onClick={() => { onQualityChange?.(-1); setQualityMenuOpen(false); }}
                  >
                    Auto
                  </button>
                  {qualityLevels.map((q) => (
                    <button
                      key={q.index}
                      className={`vc-quality-item${currentQuality === q.index ? ' active' : ''}`}
                      onClick={() => { onQualityChange?.(q.index); setQualityMenuOpen(false); }}
                    >
                      {q.label || `${q.height}p`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button className="vc-btn" onClick={onToggleFullscreen} title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
            {isFullscreen ? <FaCompress size={14} /> : <FaExpand size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default VideoControls;
