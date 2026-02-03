import React, { useState, useEffect, useCallback } from 'react';
import { useTVMode } from '../../context/TVModeContext';
import './TVScrollIndicator.scss';

/**
 * TV Scroll Indicator - Shows vertical scroll position for Samsung TV UX compliance
 * Requirement 1.2: "A scroll indicator must be provided when a list or content items exceed one page"
 */
function TVScrollIndicator({ containerRef, className = '' }) {
  const { isTVMode } = useTVMode();
  const [scrollInfo, setScrollInfo] = useState({
    scrollTop: 0,
    scrollHeight: 0,
    clientHeight: 0,
    showIndicator: false,
  });

  const updateScrollInfo = useCallback(() => {
    // Use window scroll or container scroll
    const scrollElement = containerRef?.current || document.documentElement;
    const scrollTop = containerRef?.current
      ? scrollElement.scrollTop
      : window.scrollY || document.documentElement.scrollTop;
    const scrollHeight = scrollElement.scrollHeight;
    const clientHeight = containerRef?.current
      ? scrollElement.clientHeight
      : window.innerHeight;

    const showIndicator = scrollHeight > clientHeight + 50; // Only show if content overflows

    setScrollInfo({
      scrollTop,
      scrollHeight,
      clientHeight,
      showIndicator,
    });
  }, [containerRef]);

  useEffect(() => {
    if (!isTVMode) return;

    // Initial check
    updateScrollInfo();

    // Listen for scroll events
    const scrollTarget = containerRef?.current || window;
    scrollTarget.addEventListener('scroll', updateScrollInfo, { passive: true });

    // Also listen for resize to recalculate
    window.addEventListener('resize', updateScrollInfo);

    // Check periodically for dynamic content
    const interval = setInterval(updateScrollInfo, 1000);

    return () => {
      scrollTarget.removeEventListener('scroll', updateScrollInfo);
      window.removeEventListener('resize', updateScrollInfo);
      clearInterval(interval);
    };
  }, [isTVMode, containerRef, updateScrollInfo]);

  if (!isTVMode || !scrollInfo.showIndicator) {
    return null;
  }

  const { scrollTop, scrollHeight, clientHeight } = scrollInfo;
  const scrollableHeight = scrollHeight - clientHeight;
  const scrollPercentage = scrollableHeight > 0 ? (scrollTop / scrollableHeight) * 100 : 0;

  // Calculate thumb size based on visible content ratio
  const thumbSizePercent = Math.max(15, Math.min(100, (clientHeight / scrollHeight) * 100));

  return (
    <div className={`tv-scroll-indicator ${className}`}>
      <div className="tv-scroll-track">
        <div
          className="tv-scroll-thumb"
          style={{
            height: `${thumbSizePercent}%`,
            top: `${(100 - thumbSizePercent) * (scrollPercentage / 100)}%`
          }}
        />
      </div>
    </div>
  );
}

/**
 * TV Horizontal Scroll Indicator - Shows horizontal scroll position for rows
 */
export function TVHorizontalScrollIndicator({ containerRef, className = '' }) {
  const { isTVMode } = useTVMode();
  const [scrollInfo, setScrollInfo] = useState({
    scrollLeft: 0,
    scrollWidth: 0,
    clientWidth: 0,
    showIndicator: false,
  });

  const updateScrollInfo = useCallback(() => {
    if (!containerRef?.current) return;

    const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
    const showIndicator = scrollWidth > clientWidth + 50;

    setScrollInfo({
      scrollLeft,
      scrollWidth,
      clientWidth,
      showIndicator,
    });
  }, [containerRef]);

  useEffect(() => {
    if (!isTVMode || !containerRef?.current) return;

    // Initial check
    updateScrollInfo();

    // Listen for scroll events
    const element = containerRef.current;
    element.addEventListener('scroll', updateScrollInfo, { passive: true });

    // Also listen for resize
    window.addEventListener('resize', updateScrollInfo);

    // Check periodically for dynamic content
    const interval = setInterval(updateScrollInfo, 1000);

    return () => {
      element.removeEventListener('scroll', updateScrollInfo);
      window.removeEventListener('resize', updateScrollInfo);
      clearInterval(interval);
    };
  }, [isTVMode, containerRef, updateScrollInfo]);

  if (!isTVMode || !scrollInfo.showIndicator) {
    return null;
  }

  const { scrollLeft, scrollWidth, clientWidth } = scrollInfo;
  const scrollableWidth = scrollWidth - clientWidth;
  const scrollPercentage = scrollableWidth > 0 ? (scrollLeft / scrollableWidth) * 100 : 0;

  // Calculate thumb size based on visible content ratio
  const thumbSizePercent = Math.max(15, Math.min(100, (clientWidth / scrollWidth) * 100));

  return (
    <div className={`tv-horizontal-scroll-indicator ${className}`}>
      <div className="tv-horizontal-scroll-track">
        <div
          className="tv-horizontal-scroll-thumb"
          style={{
            width: `${thumbSizePercent}%`,
            left: `${(100 - thumbSizePercent) * (scrollPercentage / 100)}%`
          }}
        />
      </div>
    </div>
  );
}

export default TVScrollIndicator;
