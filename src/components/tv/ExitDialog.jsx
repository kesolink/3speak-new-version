import React, { useEffect, useState, useCallback } from 'react';
import { useTVMode } from '../../context/TVModeContext';
import './ExitDialog.scss';

function ExitDialog() {
  const { showExitDialog, confirmExit, cancelExit, isTVMode } = useTVMode();
  const [focusedButton, setFocusedButton] = useState(1); // 0 = Yes, 1 = No (default to No)

  // Handle keyboard navigation
  useEffect(() => {
    if (!showExitDialog || !isTVMode) return;

    const handleKeyDown = (event) => {
      switch (event.keyCode) {
        case 37: // Left
        case 39: // Right
          // Toggle between Yes (0) and No (1)
          setFocusedButton(prev => prev === 0 ? 1 : 0);
          event.preventDefault();
          event.stopPropagation();
          break;

        case 13: // Enter
          if (focusedButton === 0) {
            confirmExit();
          } else {
            cancelExit();
          }
          event.preventDefault();
          event.stopPropagation();
          break;

        case 10009: // Samsung Back
        case 27: // Escape
          cancelExit();
          event.preventDefault();
          event.stopPropagation();
          break;

        default:
          break;
      }
    };

    // Use capture phase to intercept before other handlers
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [showExitDialog, isTVMode, focusedButton, confirmExit, cancelExit]);

  // Reset focus to "No" when dialog opens
  useEffect(() => {
    if (showExitDialog) {
      setFocusedButton(1); // Default to "No" for safety
    }
  }, [showExitDialog]);

  if (!showExitDialog) return null;

  return (
    <div className="exit-dialog-overlay">
      <div className="exit-dialog">
        <h2>Exit 3Speak?</h2>
        <p>Do you really want to leave?</p>
        <div className="exit-dialog-buttons">
          <button
            className={`exit-dialog-btn exit-dialog-btn-yes ${focusedButton === 0 ? 'tv-focused' : ''}`}
            onClick={confirmExit}
          >
            Yes, exit
          </button>
          <button
            className={`exit-dialog-btn exit-dialog-btn-no ${focusedButton === 1 ? 'tv-focused' : ''}`}
            onClick={cancelExit}
          >
            No, stay
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExitDialog;
