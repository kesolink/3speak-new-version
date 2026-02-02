import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTVMode } from '../context/TVModeContext';

/**
 * Hook to handle TV sidebar navigation on pages with video grids.
 * This hook provides keyboard navigation support for:
 * - Opening sidebar when pressing Left at the leftmost position
 * - Navigating within the sidebar with Up/Down
 * - Activating sidebar items with Enter
 * - Closing sidebar with Right or Back
 *
 * @param {Object} options
 * @param {Function} options.onLeftAtEdge - Called when Left is pressed at leftmost position, should return true if handled
 * @param {Function} options.onNavigate - Called for navigation key presses (left, right, up, down)
 * @param {Function} options.onSelect - Called when Enter is pressed to select current item
 * @param {boolean} options.enabled - Whether TV navigation is enabled (default: true)
 */
export function useTVSidebarNavigation({
  onLeftAtEdge,
  onNavigate,
  onSelect,
  enabled = true
} = {}) {
  const navigate = useNavigate();
  const {
    isTVMode,
    tvSidebarVisible,
    setTvSidebarVisible,
    tvSidebarFocusIndex,
    setTvSidebarFocusIndex,
    tvFocusArea,
    setTvFocusArea,
    sidebarItemCount
  } = useTVMode();

  // Open sidebar and focus first item
  const openSidebar = useCallback(() => {
    setTvSidebarVisible(true);
    setTvFocusArea('sidebar');
    setTvSidebarFocusIndex(0);
  }, [setTvSidebarVisible, setTvFocusArea, setTvSidebarFocusIndex]);

  // Close sidebar and return focus to main content
  const closeSidebar = useCallback(() => {
    setTvSidebarVisible(false);
    setTvFocusArea('main');
    setTvSidebarFocusIndex(-1);
  }, [setTvSidebarVisible, setTvFocusArea, setTvSidebarFocusIndex]);

  useEffect(() => {
    if (!isTVMode || !enabled) return;

    const handleKeyDown = (event) => {
      // Handle sidebar navigation when sidebar is open
      if (tvSidebarVisible && tvFocusArea === 'sidebar') {
        switch (event.keyCode) {
          case 38: // Up - move up in sidebar
            if (tvSidebarFocusIndex > 0) {
              setTvSidebarFocusIndex(tvSidebarFocusIndex - 1);
            }
            event.preventDefault();
            return;

          case 40: // Down - move down in sidebar
            if (tvSidebarFocusIndex < sidebarItemCount - 1) {
              setTvSidebarFocusIndex(tvSidebarFocusIndex + 1);
            }
            event.preventDefault();
            return;

          case 39: // Right - close sidebar and return to main content
            closeSidebar();
            event.preventDefault();
            return;

          case 13: // Enter - activate sidebar item
            // Find the focused element
            const focusedEl = document.querySelector(`[data-tv-sidebar-index="${tvSidebarFocusIndex}"]`);
            if (focusedEl) {
              // Check if it's the search wrapper - open keyboard, don't close sidebar
              if (focusedEl.classList.contains('tv-search-wrapper')) {
                document.dispatchEvent(new CustomEvent('tv-open-keyboard'));
                event.preventDefault();
                return;
              }

              // Check if it's an action item (login, theme toggle) - don't close sidebar
              if (focusedEl.classList.contains('tv-action-item')) {
                focusedEl.click();
                event.preventDefault();
                return;
              }

              // Navigation link - navigate and close sidebar
              const href = focusedEl.getAttribute('href');
              if (href) {
                navigate(href);
                closeSidebar();
              } else {
                focusedEl.click();
                closeSidebar();
              }
            }
            event.preventDefault();
            return;

          case 10009: // Samsung TV Back
          case 27: // Escape
            closeSidebar();
            event.preventDefault();
            return;

          default:
            return;
        }
      }

      // Handle main content navigation
      switch (event.keyCode) {
        case 37: // Left
          // Check if custom handler exists and handles the event
          if (onLeftAtEdge) {
            const handled = onLeftAtEdge();
            if (!handled) {
              // At leftmost position, open sidebar
              openSidebar();
            }
          } else if (onNavigate) {
            const handled = onNavigate('left');
            if (!handled) {
              openSidebar();
            }
          } else {
            // No handlers, just open sidebar
            openSidebar();
          }
          event.preventDefault();
          break;

        case 39: // Right
          if (onNavigate) {
            onNavigate('right');
          }
          event.preventDefault();
          break;

        case 38: // Up
          if (onNavigate) {
            onNavigate('up');
          }
          event.preventDefault();
          break;

        case 40: // Down
          if (onNavigate) {
            onNavigate('down');
          }
          event.preventDefault();
          break;

        case 13: // Enter
          if (onSelect) {
            onSelect();
          }
          event.preventDefault();
          break;

        case 10009: // Samsung TV Back
        case 27: // Escape
          // Navigate back or show exit dialog - let parent handle
          break;

        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    isTVMode,
    enabled,
    tvSidebarVisible,
    tvFocusArea,
    tvSidebarFocusIndex,
    setTvSidebarFocusIndex,
    sidebarItemCount,
    openSidebar,
    closeSidebar,
    navigate,
    onLeftAtEdge,
    onNavigate,
    onSelect
  ]);

  return {
    isTVMode,
    tvSidebarVisible,
    openSidebar,
    closeSidebar,
    tvFocusArea
  };
}

export default useTVSidebarNavigation;
