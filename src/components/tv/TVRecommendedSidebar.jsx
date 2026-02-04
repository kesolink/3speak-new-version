import React, { forwardRef, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { fixVideoThumbnail } from '../../utils/fixThumbnails';
import speakImg from '../../assets/image/speak.jpg';

/**
 * TV-optimized sidebar for recommended videos
 * Features large thumbnails and keyboard navigation
 */
const TVRecommendedSidebar = forwardRef(({
  videos = [],
  focusedIndex = -1,
  onFocusChange,
  onNavigateLeft,
  onSelect,
}, ref) => {
  const listRef = useRef(null);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('.tv-recommended-sidebar__item');
      const target = items[focusedIndex];
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [focusedIndex]);

  // Handle keyboard navigation when sidebar has focus
  useEffect(() => {
    if (focusedIndex < 0) return; // Only handle keys when focused

    const handleKeyDown = (event) => {
      switch (event.keyCode) {
        case 38: // Up
          if (focusedIndex > 0) {
            onFocusChange?.(focusedIndex - 1);
            event.preventDefault();
            event.stopPropagation();
          }
          break;
        case 40: // Down
          if (focusedIndex < videos.length - 1) {
            onFocusChange?.(focusedIndex + 1);
            event.preventDefault();
            event.stopPropagation();
          }
          break;
        case 37: // Left
          onNavigateLeft?.();
          event.preventDefault();
          event.stopPropagation();
          break;
        case 13: // Enter
          const video = videos[focusedIndex];
          if (video) {
            onSelect?.(video);
            event.preventDefault();
            event.stopPropagation();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [focusedIndex, videos, onFocusChange, onNavigateLeft, onSelect]);

  const getAuthor = (video) => {
    return video?.author?.username || video?.author?.id || video?.author || video?.owner || 'unknown';
  };

  if (videos.length === 0) {
    return (
      <div className="tv-recommended-sidebar" ref={ref}>
        <h3 className="tv-recommended-sidebar__header">Up Next</h3>
        <p style={{ color: 'var(--text-secondary)', padding: '20px' }}>No recommendations available</p>
      </div>
    );
  }

  return (
    <div className="tv-recommended-sidebar" ref={ref}>
      <h3 className="tv-recommended-sidebar__header">Up Next</h3>
      <div className="tv-recommended-sidebar__list" ref={listRef}>
        {videos.map((video, index) => {
          const author = getAuthor(video);
          const isFocused = focusedIndex === index;

          return (
            <div
              key={`${author}-${video.permlink}-${index}`}
              className={`tv-recommended-sidebar__item ${isFocused ? 'tv-recommended-sidebar__item--focused' : ''}`}
              onClick={() => onSelect?.(video)}
              data-tv-focusable="true"
              data-tv-index={index}
            >
              <img
                className="tv-recommended-sidebar__thumbnail"
                src={fixVideoThumbnail(video)}
                alt={video.title}
                onError={(e) => (e.currentTarget.src = speakImg)}
                loading="lazy"
              />
              <div className="tv-recommended-sidebar__info">
                <h4 className="tv-recommended-sidebar__title">{video.title}</h4>
                <span className="tv-recommended-sidebar__author">@{author}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

TVRecommendedSidebar.displayName = 'TVRecommendedSidebar';

TVRecommendedSidebar.propTypes = {
  videos: PropTypes.array,
  focusedIndex: PropTypes.number,
  onFocusChange: PropTypes.func,
  onNavigateLeft: PropTypes.func,
  onSelect: PropTypes.func,
};

export default TVRecommendedSidebar;
