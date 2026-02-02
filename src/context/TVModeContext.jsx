import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const TVModeContext = createContext(null);

/**
 * Detect if running on a Samsung Tizen TV
 */
function detectTVMode() {
  if (typeof window === 'undefined') return false;

  const userAgent = navigator.userAgent.toLowerCase();

  // Samsung Tizen TV detection
  const isTizen = userAgent.includes('tizen') ||
                  userAgent.includes('samsung') ||
                  typeof window.tizen !== 'undefined';

  // Also check if running in an iframe (our Tizen wrapper uses iframe)
  const isInIframe = window.self !== window.top;

  // Check URL parameter for testing
  const urlParams = new URLSearchParams(window.location.search);
  const forceTVMode = urlParams.get('tv') === 'true';

  return isTizen || forceTVMode;
}

export function TVModeProvider({ children }) {
  const [isTVMode, setIsTVMode] = useState(false);
  const [focusedSection, setFocusedSection] = useState(null);
  // TV Focus area: 'main' | 'nav' | 'sidebar'
  const [tvFocusArea, setTvFocusArea] = useState('main');
  // Nav focus index: 0 = theme toggle, 1 = login/profile
  const [tvNavFocusIndex, setTvNavFocusIndex] = useState(-1);
  // Sidebar focus index
  const [tvSidebarFocusIndex, setTvSidebarFocusIndex] = useState(-1);
  // Number of sidebar items (set by Sidebar component)
  const [sidebarItemCount, setSidebarItemCount] = useState(9); // 7 nav items + 2 action items
  // TV sidebar visibility (hidden by default, shown when user navigates left)
  const [tvSidebarVisible, setTvSidebarVisible] = useState(false);
  // Exit dialog visibility
  const [showExitDialog, setShowExitDialog] = useState(false);

  useEffect(() => {
    const tvDetected = detectTVMode();
    setIsTVMode(tvDetected);

    if (tvDetected) {
      // Add TV mode class to body for CSS styling
      document.body.classList.add('tv-mode');

      // Try to register TV input device keys (Samsung specific)
      try {
        if (window.tizen && window.tizen.tvinputdevice) {
          const keys = [
            'MediaPlay', 'MediaPause', 'MediaStop',
            'MediaFastForward', 'MediaRewind',
            'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue'
          ];
          keys.forEach(key => {
            try {
              window.tizen.tvinputdevice.registerKey(key);
            } catch (e) {
              // Key might not be available
            }
          });
        }
      } catch (e) {
        console.log('Tizen TV input device not available');
      }
    }

    // Listen for postMessage events from parent Tizen wrapper
    // This allows the parent to forward key events to the iframe
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'keydown') {
        // Create and dispatch a synthetic keyboard event
        const keyEvent = new KeyboardEvent('keydown', {
          keyCode: event.data.keyCode,
          key: event.data.key,
          bubbles: true,
          cancelable: true
        });
        document.dispatchEvent(keyEvent);
        console.log('Received forwarded key from parent:', event.data.keyCode);
      }

      // Handle media controls from parent
      if (event.data && event.data.type === 'media-control') {
        const mediaEvent = new CustomEvent('tv-media-control', {
          detail: { action: event.data.action }
        });
        document.dispatchEvent(mediaEvent);
      }

      // Handle exit dialog request from parent
      if (event.data && event.data.type === 'show-exit-dialog') {
        console.log('Received show-exit-dialog from parent');
        setShowExitDialog(true);
      }

      // Handle back button request from parent - dispatch custom event for components to handle
      if (event.data && event.data.type === 'handle-back-button') {
        console.log('TVModeContext: Received handle-back-button, dispatching event');
        const backEvent = new CustomEvent('tv-back-button', {
          bubbles: true,
          cancelable: true
        });
        document.dispatchEvent(backEvent);

        // If no component handled it (preventDefault), tell parent to proceed
        if (!backEvent.defaultPrevented) {
          console.log('TVModeContext: No component handled back, telling parent to proceed');
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: 'back-button-pressed' }, '*');
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      document.body.classList.remove('tv-mode');
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const enableTVMode = useCallback(() => {
    setIsTVMode(true);
    document.body.classList.add('tv-mode');
  }, []);

  const disableTVMode = useCallback(() => {
    setIsTVMode(false);
    document.body.classList.remove('tv-mode');
  }, []);

  // Notify parent Tizen wrapper about navigation state (for back button handling)
  const notifyNavigationState = useCallback((atRoot) => {
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({ type: 'navigation-state', atRoot }, '*');
        console.log('Sent navigation state to parent, atRoot:', atRoot);
      } catch (e) {
        // Ignore cross-origin errors
      }
    }
  }, []);

  // Confirm exit - send exit-app message to parent
  const confirmExit = useCallback(() => {
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({ type: 'exit-app' }, '*');
      } catch (e) {
        // Ignore cross-origin errors
      }
    }
    setShowExitDialog(false);
  }, []);

  // Cancel exit - just close the dialog
  const cancelExit = useCallback(() => {
    setShowExitDialog(false);
  }, []);

  const value = {
    isTVMode,
    setIsTVMode,
    enableTVMode,
    disableTVMode,
    focusedSection,
    setFocusedSection,
    notifyNavigationState,
    // TV navigation between areas
    tvFocusArea,
    setTvFocusArea,
    tvNavFocusIndex,
    setTvNavFocusIndex,
    tvSidebarFocusIndex,
    setTvSidebarFocusIndex,
    sidebarItemCount,
    setSidebarItemCount,
    // TV sidebar visibility
    tvSidebarVisible,
    setTvSidebarVisible,
    // Exit dialog
    showExitDialog,
    setShowExitDialog,
    confirmExit,
    cancelExit,
  };

  return (
    <TVModeContext.Provider value={value}>
      {children}
    </TVModeContext.Provider>
  );
}

export function useTVMode() {
  const context = useContext(TVModeContext);
  // Return safe defaults if used outside provider (shouldn't happen, but prevents crashes)
  if (!context) {
    console.warn('useTVMode called outside TVModeProvider, returning defaults');
    return {
      isTVMode: false,
      setIsTVMode: () => {},
      enableTVMode: () => {},
      disableTVMode: () => {},
      focusedSection: null,
      setFocusedSection: () => {},
      notifyNavigationState: () => {},
      tvFocusArea: 'main',
      setTvFocusArea: () => {},
      tvNavFocusIndex: -1,
      setTvNavFocusIndex: () => {},
      tvSidebarFocusIndex: -1,
      setTvSidebarFocusIndex: () => {},
      sidebarItemCount: 9,
      setSidebarItemCount: () => {},
      tvSidebarVisible: false,
      setTvSidebarVisible: () => {},
      showExitDialog: false,
      setShowExitDialog: () => {},
      confirmExit: () => {},
      cancelExit: () => {},
    };
  }
  return context;
}

export default TVModeContext;
