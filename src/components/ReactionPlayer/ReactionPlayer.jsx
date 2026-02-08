import { useRef, useState, useEffect, useCallback } from 'react';
import { MdChevronLeft, MdChevronRight, MdClose, MdAspectRatio } from 'react-icons/md';
import { FaPlay, FaPause, FaExpand, FaCompress } from 'react-icons/fa';
import { TbRewindBackward10, TbRewindForward10 } from 'react-icons/tb';
import './ReactionPlayer.scss';

const SIZE_LABELS = { small: 'S', medium: 'M', big: 'L' };

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

function ReactionPlayer({
  reactions,
  selectedIndex,
  onSelectReaction,
  onClose,
  mobile,
  size,
  onCycleSize,
  currentTime: mainCurrentTime,
  duration: mainDuration,
  mainIsPlaying,
  onReactionPlay,
}) {
  const scrollRef = useRef(null);
  const itemRefs = useRef([]);
  const userScrolledRef = useRef(false);
  const programmaticScrollRef = useRef(false);
  const iframeRefs = useRef([]);
  const activeIdxRef = useRef(selectedIndex ?? 0);
  const trackRef = useRef(null);

  // Reaction player's own playback state
  const [rctTime, setRctTime] = useState(0);
  const [rctDuration, setRctDuration] = useState(0);
  const [rctPlaying, setRctPlaying] = useState(false);
  const [rctFullscreen, setRctFullscreen] = useState(false);
  const [controlsHovering, setControlsHovering] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const hideTimerRef = useRef(null);

  const idx = (selectedIndex ?? 0);
  activeIdxRef.current = idx;

  // Reset playback state when switching reactions
  const prevIdxRef = useRef(idx);
  useEffect(() => {
    if (prevIdxRef.current !== idx) {
      setRctTime(0);
      setRctDuration(0);
      setRctPlaying(false);
      prevIdxRef.current = idx;
    }
  }, [idx]);

  // Ref for onReactionPlay so the message handler can access it without re-registering
  const onReactionPlayRef = useRef(onReactionPlay);
  onReactionPlayRef.current = onReactionPlay;

  // Send commands to the active reaction player iframe
  const sendCmd = useCallback((msg) => {
    const iframe = iframeRefs.current[activeIdxRef.current];
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(msg, '*');
    }
  }, []);

  // When main player starts playing, pause the reaction player
  const prevMainIsPlaying = useRef(false);
  useEffect(() => {
    if (mainIsPlaying && !prevMainIsPlaying.current) {
      sendCmd({ type: 'pause' });
      setRctPlaying(false);
    }
    prevMainIsPlaying.current = mainIsPlaying;
  }, [mainIsPlaying, sendCmd]);

  // Listen for postMessage from reaction player iframes
  useEffect(() => {
    const handleMessage = (event) => {
      if (!event.data || !event.data.type) return;

      const activeIframe = iframeRefs.current[activeIdxRef.current];

      // Handle player-ready: do NOT auto-play reaction iframes (main player has priority)
      if (event.data.type === '3speak-player-ready') {
        return;
      }

      // For all other messages, only handle from the active iframe
      if (!activeIframe || event.source !== activeIframe.contentWindow) return;

      switch (event.data.type) {
        case '3speak-timeupdate':
          setRctTime(event.data.currentTime ?? 0);
          if (event.data.duration) setRctDuration(event.data.duration);
          break;
        case '3speak-playstate':
          setRctPlaying(event.data.isPlaying ?? false);
          break;
        case '3speak-durationchange':
          setRctDuration(event.data.duration ?? 0);
          break;
        case '3speak-ended':
          setRctPlaying(false);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setRctFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const handleTogglePlay = useCallback(() => {
    sendCmd({ type: 'toggle-play' });
    setRctPlaying(prev => {
      const willPlay = !prev;
      if (willPlay) onReactionPlayRef.current?.();
      return willPlay;
    });
  }, [sendCmd]);
  const handleSeekBackward = useCallback(() => sendCmd({ type: 'seekBackward', seconds: 10 }), [sendCmd]);
  const handleSeekForward = useCallback(() => sendCmd({ type: 'seekForward', seconds: 10 }), [sendCmd]);
  const handleRctSeek = useCallback((time) => sendCmd({ type: 'seek', time }), [sendCmd]);

  const handleTrackClick = useCallback((e) => {
    if (!trackRef.current || !rctDuration) return;
    const rect = trackRef.current.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    handleRctSeek(fraction * rctDuration);
  }, [rctDuration, handleRctSeek]);

  const handleToggleFullscreen = useCallback(() => {
    const wrapper = document.querySelector('.reaction-video-wrap');
    if (!wrapper) return;
    if (!document.fullscreenElement) {
      wrapper.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, []);

  const showControlsTemporarily = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
  }, []);

  // Scroll the list to center a specific item
  const scrollToItem = useCallback((index) => {
    const item = itemRefs.current[index];
    const container = scrollRef.current;
    if (!item || !container) return;

    programmaticScrollRef.current = true;
    const containerRect = container.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const scrollOffset = container.scrollLeft;
    const itemRelativeLeft = itemRect.left - containerRect.left + scrollOffset;
    const targetScroll = itemRelativeLeft - containerRect.width / 2 + itemRect.width / 2;
    container.scrollTo({ left: Math.max(0, targetScroll), behavior: 'smooth' });

    setTimeout(() => { programmaticScrollRef.current = false; }, 500);
  }, []);

  // When user clicks a reaction, reset manual scroll flag
  const handleItemClick = useCallback((index) => {
    userScrolledRef.current = false;
    onSelectReaction(index);
  }, [onSelectReaction]);

  // Detect manual scroll on the reaction list
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (!programmaticScrollRef.current) {
        userScrolledRef.current = true;
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Timeline-based auto-scroll
  useEffect(() => {
    if (userScrolledRef.current) return;
    if (!reactions || reactions.length === 0 || !mainDuration || mainDuration <= 0) return;

    const currentPct = mainCurrentTime / mainDuration;
    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < reactions.length; i++) {
      const dist = Math.abs(reactions[i].pct - currentPct);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }

    scrollToItem(closestIdx);
  }, [mainCurrentTime, mainDuration, reactions, scrollToItem]);

  // Also scroll when selectedIndex changes (from prev/next buttons)
  useEffect(() => {
    if (userScrolledRef.current) return;
    scrollToItem(selectedIndex ?? 0);
  }, [selectedIndex, scrollToItem]);

  if (!reactions || reactions.length === 0) return null;

  const current = reactions[idx] ?? reactions[0];
  const hasPrev = idx > 0;
  const hasNext = idx < reactions.length - 1;
  const rctProgress = rctDuration > 0 ? (rctTime / rctDuration) * 100 : 0;
  const showControls = controlsVisible || controlsHovering;

  return (
    <div className={`reaction-player${mobile ? ' reaction-player--mobile' : ''}`}>
      {/* Video player with all iframes preloaded */}
      <div
        className="reaction-video-wrap"
        onMouseMove={showControlsTemporarily}
        onMouseLeave={() => setControlsVisible(false)}
      >
        {/* Render all iframes, show only the active one */}
        {reactions.map((reaction, i) => (
          <iframe
            key={reaction.id}
            ref={el => { iframeRefs.current[i] = el; }}
            src={`${reaction.videoUrl}&controls=0`}
            className={`rct-iframe${i === idx ? ' rct-iframe--active' : ''}`}
            loading="lazy"
            allowFullScreen
          />
        ))}

        {/* Invisible overlay to capture mouse events above the iframe */}
        <div className="rct-interact-overlay" onClick={handleTogglePlay} />

        {/* Size overlay button */}
        {onCycleSize && (
          <button className="size-overlay-btn" onClick={onCycleSize} title={`Size: ${size || 'small'}`}>
            <MdAspectRatio />
            <span>{SIZE_LABELS[size] || 'S'}</span>
          </button>
        )}

        {/* Custom player controls */}
        <div
          className={`rct-controls${showControls ? ' visible' : ''}`}
          onMouseEnter={() => setControlsHovering(true)}
          onMouseLeave={() => setControlsHovering(false)}
        >
          <div className="rct-progress-row">
            <div className="rct-progress-track" ref={trackRef} onClick={handleTrackClick}>
              <div className="rct-progress-fill" style={{ width: `${rctProgress}%` }} />
            </div>
          </div>
          <div className="rct-controls-row">
            <div className="rct-controls-left">
              <button className="rct-btn" onClick={handleSeekBackward} title="Rewind 10s">
                <TbRewindBackward10 size={14} />
              </button>
              <button className="rct-btn rct-btn--play" onClick={handleTogglePlay} title={rctPlaying ? 'Pause' : 'Play'}>
                {rctPlaying ? <FaPause size={10} /> : <FaPlay size={10} />}
              </button>
              <button className="rct-btn" onClick={handleSeekForward} title="Forward 10s">
                <TbRewindForward10 size={14} />
              </button>
              <div className="rct-time">
                {formatTime(rctTime)} / {formatTime(rctDuration)}
              </div>
            </div>
            <div className="rct-controls-right">
              <button className="rct-btn" onClick={handleToggleFullscreen} title={rctFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
                {rctFullscreen ? <FaCompress size={10} /> : <FaExpand size={10} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Header - below video */}
      <div className="reaction-player-header">
        <div className="reaction-info">
          <img className="reactor-avatar" src={current.avatar} alt="" />
          <div className="reactor-text">
            <span className="reactor-name">@{current.author}</span>
            <span className="reaction-label">Reaction</span>
          </div>
        </div>
        <div className="reaction-controls">
          <button
            className="nav-btn"
            onClick={() => handleItemClick(idx - 1)}
            disabled={!hasPrev}
            title="Previous reaction"
          >
            <MdChevronLeft />
          </button>
          <span className="reaction-count">{idx + 1}/{reactions.length}</span>
          <button
            className="nav-btn"
            onClick={() => handleItemClick(idx + 1)}
            disabled={!hasNext}
            title="Next reaction"
          >
            <MdChevronRight />
          </button>
          <button className="close-btn" onClick={onClose} title="Close reactions">
            <MdClose />
          </button>
        </div>
      </div>

      {/* Horizontal scrollable list of reactions */}
      <div className="reaction-list" ref={scrollRef}>
        {reactions.map((reaction, i) => (
          <div
            key={reaction.id}
            className={`reaction-item${i === idx ? ' active' : ''}`}
            onClick={() => handleItemClick(i)}
            ref={el => { itemRefs.current[i] = el; }}
          >
            <img className="reaction-item-avatar" src={reaction.avatar} alt="" />
            <span className="reaction-item-name">@{reaction.author}</span>
            {reaction.replyCount > 0 && (
              <span className="reaction-item-count">{reaction.replyCount}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ReactionPlayer;
