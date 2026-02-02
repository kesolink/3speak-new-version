import { useEffect, useCallback, useRef } from 'react';

// Samsung TV remote key codes
const TV_KEY_CODES = {
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  ENTER: 13,
  BACK: 10009,
  PLAY: 415,
  PAUSE: 19,
  STOP: 413,
  FAST_FORWARD: 417,
  REWIND: 412,
  // Standard keyboard equivalents
  ESCAPE: 27,
  SPACE: 32,
};

/**
 * Hook for TV D-pad navigation within a container
 * @param {Object} options
 * @param {string} options.containerSelector - CSS selector for the navigation container
 * @param {string} options.itemSelector - CSS selector for focusable items
 * @param {number} options.columns - Number of columns in the grid (for vertical navigation)
 * @param {Function} options.onSelect - Callback when item is selected (Enter pressed)
 * @param {Function} options.onBack - Callback when back is pressed
 * @param {boolean} options.enabled - Whether navigation is enabled
 * @param {boolean} options.wrapAround - Whether to wrap around at edges
 */
export function useTVNavigation({
  containerSelector,
  itemSelector = '[data-tv-focusable="true"]',
  columns = 1,
  onSelect,
  onBack,
  enabled = true,
  wrapAround = false,
} = {}) {
  const focusedIndexRef = useRef(0);

  const getFocusableElements = useCallback(() => {
    const container = containerSelector
      ? document.querySelector(containerSelector)
      : document;
    if (!container) return [];
    return Array.from(container.querySelectorAll(itemSelector));
  }, [containerSelector, itemSelector]);

  const focusElement = useCallback((index) => {
    const elements = getFocusableElements();
    if (elements.length === 0) return;

    // Clamp or wrap index
    let newIndex = index;
    if (wrapAround) {
      newIndex = ((index % elements.length) + elements.length) % elements.length;
    } else {
      newIndex = Math.max(0, Math.min(index, elements.length - 1));
    }

    // Remove focus from all elements
    elements.forEach((el) => el.classList.remove('tv-focused'));

    // Add focus to target element
    const targetElement = elements[newIndex];
    if (targetElement) {
      targetElement.classList.add('tv-focused');
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      focusedIndexRef.current = newIndex;
    }
  }, [getFocusableElements, wrapAround]);

  const handleKeyDown = useCallback((event) => {
    if (!enabled) return;

    const elements = getFocusableElements();
    if (elements.length === 0) return;

    const currentIndex = focusedIndexRef.current;
    let handled = true;

    switch (event.keyCode) {
      case TV_KEY_CODES.LEFT:
        focusElement(currentIndex - 1);
        break;

      case TV_KEY_CODES.RIGHT:
        focusElement(currentIndex + 1);
        break;

      case TV_KEY_CODES.UP:
        if (columns > 1) {
          focusElement(currentIndex - columns);
        } else {
          focusElement(currentIndex - 1);
        }
        break;

      case TV_KEY_CODES.DOWN:
        if (columns > 1) {
          focusElement(currentIndex + columns);
        } else {
          focusElement(currentIndex + 1);
        }
        break;

      case TV_KEY_CODES.ENTER:
      case TV_KEY_CODES.SPACE:
        if (onSelect) {
          const focusedElement = elements[currentIndex];
          onSelect(focusedElement, currentIndex);
        }
        break;

      case TV_KEY_CODES.BACK:
      case TV_KEY_CODES.ESCAPE:
        if (onBack) {
          onBack();
        }
        break;

      default:
        handled = false;
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, [enabled, getFocusableElements, focusElement, columns, onSelect, onBack]);

  // Set up keyboard listener
  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);

  // Initialize focus on first element
  useEffect(() => {
    if (enabled) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => focusElement(0), 100);
      return () => clearTimeout(timer);
    }
  }, [enabled, focusElement]);

  return {
    focusElement,
    getFocusableElements,
    getCurrentIndex: () => focusedIndexRef.current,
    TV_KEY_CODES,
  };
}

/**
 * Hook for TV video player controls
 */
export function useTVVideoControls({
  videoRef,
  onBack,
  enabled = true,
} = {}) {
  const handleKeyDown = useCallback((event) => {
    if (!enabled || !videoRef?.current) return;

    const video = videoRef.current;
    let handled = true;

    switch (event.keyCode) {
      case TV_KEY_CODES.PLAY:
      case TV_KEY_CODES.SPACE:
        if (video.paused) {
          video.play();
        } else {
          video.pause();
        }
        break;

      case TV_KEY_CODES.PAUSE:
        video.pause();
        break;

      case TV_KEY_CODES.STOP:
        video.pause();
        video.currentTime = 0;
        break;

      case TV_KEY_CODES.FAST_FORWARD:
      case TV_KEY_CODES.RIGHT:
        video.currentTime = Math.min(video.duration, video.currentTime + 10);
        break;

      case TV_KEY_CODES.REWIND:
      case TV_KEY_CODES.LEFT:
        video.currentTime = Math.max(0, video.currentTime - 10);
        break;

      case TV_KEY_CODES.UP:
        video.volume = Math.min(1, video.volume + 0.1);
        break;

      case TV_KEY_CODES.DOWN:
        video.volume = Math.max(0, video.volume - 0.1);
        break;

      case TV_KEY_CODES.BACK:
      case TV_KEY_CODES.ESCAPE:
        if (onBack) {
          onBack();
        }
        break;

      default:
        handled = false;
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, [enabled, videoRef, onBack]);

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);

  return { TV_KEY_CODES };
}

export default useTVNavigation;
