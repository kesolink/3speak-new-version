import React, { useState, useEffect, useCallback } from 'react';
import './TVKeyboard.scss';

// Combined layout: letters on left, numpad on right
const KEYBOARD_LAYOUTS = {
  lowercase: [
    // Letters (10) + gap + Numpad (3)
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '|', '7', '8', '9'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', '@', '|', '4', '5', '6'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm', '.', '-', '_', '|', '1', '2', '3'],
    ['!', '?', ':', '#', '$', '%', '&', '*', '(', ')', '|', ' ', '0', ' '],
  ],
  uppercase: [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '|', '7', '8', '9'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', '@', '|', '4', '5', '6'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '.', '-', '_', '|', '1', '2', '3'],
    ['!', '?', ':', '#', '$', '%', '&', '*', '(', ')', '|', ' ', '0', ' '],
  ],
};

// Special keys row
const SPECIAL_KEYS = [
  { key: 'shift', label: 'ABC', width: 1.5 },
  { key: 'space', label: 'Space', width: 4 },
  { key: 'backspace', label: '⌫', width: 1.5 },
  { key: 'done', label: 'Done', width: 2 },
];

function TVKeyboard({ isOpen, onClose, value, onChange, onSubmit, placeholder = 'Type here...' }) {
  const [isUppercase, setIsUppercase] = useState(false);
  const [focusRow, setFocusRow] = useState(0);
  const [focusCol, setFocusCol] = useState(0);

  const layout = isUppercase ? KEYBOARD_LAYOUTS.uppercase : KEYBOARD_LAYOUTS.lowercase;

  const LETTER_ROW_COUNT = layout.length;
  const SPECIAL_ROW_INDEX = LETTER_ROW_COUNT;
  const TOTAL_ROWS = LETTER_ROW_COUNT + 1;

  // Get focusable columns for a row (skip separator '|' and empty spaces ' ')
  const getFocusableIndices = (row) => {
    if (row === SPECIAL_ROW_INDEX) {
      return SPECIAL_KEYS.map((_, i) => i);
    }
    const rowData = layout[row];
    const indices = [];
    for (let i = 0; i < rowData.length; i++) {
      if (rowData[i] !== '|' && rowData[i] !== ' ') {
        indices.push(i);
      }
    }
    return indices;
  };

  // Get the focusable index position (0-based among focusable keys)
  const getFocusablePosition = (row, col) => {
    const indices = getFocusableIndices(row);
    return indices.indexOf(col);
  };

  // Get column from focusable position
  const getColFromPosition = (row, position) => {
    const indices = getFocusableIndices(row);
    const clampedPos = Math.max(0, Math.min(position, indices.length - 1));
    return indices[clampedPos];
  };

  // Get the number of focusable columns in the current row
  const getFocusableCount = (row) => {
    return getFocusableIndices(row).length;
  };

  // Reset focus when keyboard opens
  useEffect(() => {
    if (isOpen) {
      setFocusRow(0);
      setFocusCol(0);
    }
  }, [isOpen]);

  // Handle key press
  const handleKeyPress = useCallback((key) => {
    console.log('[TVKeyboard] handleKeyPress:', key);
    if (key === 'shift') {
      setIsUppercase(prev => !prev);
    } else if (key === 'space') {
      onChange(value + ' ');
    } else if (key === 'backspace') {
      onChange(value.slice(0, -1));
    } else if (key === 'done') {
      console.log('[TVKeyboard] Done pressed, value:', value, 'onSubmit exists:', !!onSubmit);
      if (onSubmit) {
        console.log('[TVKeyboard] Calling onSubmit...');
        onSubmit(value);
      }
      onClose();
    } else {
      // Regular character - add it and exit uppercase mode after first letter
      onChange(value + key);
      // Auto-exit uppercase after typing a letter (like mobile keyboards)
      if (isUppercase && /^[A-Z]$/.test(key)) {
        setIsUppercase(false);
      }
    }
  }, [value, onChange, onSubmit, onClose, isUppercase]);

  // Keyboard navigation with wrap-around
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      console.log('[TVKeyboard] handleKeyDown received, keyCode:', event.keyCode, 'focusRow:', focusRow, 'focusCol:', focusCol);
      const focusableIndices = getFocusableIndices(focusRow);
      const currentPosition = getFocusablePosition(focusRow, focusCol);
      const focusableCount = focusableIndices.length;

      switch (event.keyCode) {
        case 37: // Left - wrap to right side
          {
            let newPosition;
            if (currentPosition <= 0) {
              // Wrap to right side
              newPosition = focusableCount - 1;
            } else {
              newPosition = currentPosition - 1;
            }
            setFocusCol(getColFromPosition(focusRow, newPosition));
          }
          event.preventDefault();
          event.stopImmediatePropagation();
          break;

        case 39: // Right - wrap to left side
          {
            let newPosition;
            if (currentPosition >= focusableCount - 1) {
              // Wrap to left side
              newPosition = 0;
            } else {
              newPosition = currentPosition + 1;
            }
            setFocusCol(getColFromPosition(focusRow, newPosition));
          }
          event.preventDefault();
          event.stopImmediatePropagation();
          break;

        case 38: // Up - wrap around: first row goes to special keys (space)
          {
            let newRow;
            if (focusRow === 0) {
              // Wrap to special keys row, focus on space (index 1)
              newRow = SPECIAL_ROW_INDEX;
              setFocusRow(newRow);
              setFocusCol(1); // Space key
            } else {
              newRow = focusRow - 1;
              // Keep similar horizontal position
              const newFocusableCount = getFocusableCount(newRow);
              const newPosition = Math.min(currentPosition, newFocusableCount - 1);
              setFocusRow(newRow);
              setFocusCol(getColFromPosition(newRow, newPosition));
            }
          }
          event.preventDefault();
          event.stopImmediatePropagation();
          break;

        case 40: // Down - wrap around: special keys goes to first row
          {
            let newRow;
            if (focusRow === SPECIAL_ROW_INDEX) {
              // Wrap to first row
              newRow = 0;
              const newFocusableCount = getFocusableCount(newRow);
              const newPosition = Math.min(currentPosition, newFocusableCount - 1);
              setFocusRow(newRow);
              setFocusCol(getColFromPosition(newRow, newPosition));
            } else {
              newRow = focusRow + 1;
              const newFocusableCount = getFocusableCount(newRow);
              const newPosition = Math.min(currentPosition, newFocusableCount - 1);
              setFocusRow(newRow);
              setFocusCol(getColFromPosition(newRow, newPosition));
            }
          }
          event.preventDefault();
          event.stopImmediatePropagation();
          break;

        case 13: // Enter
          console.log('[TVKeyboard] Enter pressed! focusRow:', focusRow, 'SPECIAL_ROW_INDEX:', SPECIAL_ROW_INDEX);
          if (focusRow === SPECIAL_ROW_INDEX) {
            console.log('[TVKeyboard] Pressing special key:', SPECIAL_KEYS[focusCol].key);
            handleKeyPress(SPECIAL_KEYS[focusCol].key);
          } else {
            console.log('[TVKeyboard] Pressing letter:', layout[focusRow][focusCol]);
            handleKeyPress(layout[focusRow][focusCol]);
          }
          event.preventDefault();
          event.stopImmediatePropagation();
          break;

        case 10009: // Samsung Back
        case 27: // Escape
          onClose();
          event.preventDefault();
          event.stopImmediatePropagation();
          break;

        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, focusRow, focusCol, layout, handleKeyPress, onClose]);

  if (!isOpen) return null;

  return (
    <div className="tv-keyboard-overlay">
      <div className="tv-keyboard-modal">
        {/* Input display */}
        <div className="tv-keyboard-input">
          <span className="tv-keyboard-value">{value || placeholder}</span>
          <span className="tv-keyboard-cursor">|</span>
        </div>

        {/* Keyboard grid */}
        <div className="tv-keyboard-grid">
          {/* Letter + numpad rows */}
          {layout.map((row, rowIndex) => (
            <div key={rowIndex} className="tv-keyboard-row">
              {row.map((key, colIndex) => {
                // Separator
                if (key === '|') {
                  return <div key={`sep-${colIndex}`} className="tv-keyboard-separator" />;
                }
                // Empty space (for alignment)
                if (key === ' ') {
                  return <div key={`empty-${colIndex}`} className="tv-keyboard-empty" />;
                }
                // Regular key
                const isFocused = focusRow === rowIndex && focusCol === colIndex;
                const isNumpad = colIndex > 10; // After the separator
                return (
                  <button
                    key={`${rowIndex}-${colIndex}`}
                    className={`tv-keyboard-key ${isFocused ? 'focused' : ''} ${isNumpad ? 'numpad-key' : ''}`}
                    onClick={() => handleKeyPress(key)}
                  >
                    {key}
                  </button>
                );
              })}
            </div>
          ))}

          {/* Special keys row */}
          <div className="tv-keyboard-row tv-keyboard-special">
            {SPECIAL_KEYS.map((special, index) => (
              <button
                key={special.key}
                className={`tv-keyboard-key tv-keyboard-key-${special.key} ${focusRow === SPECIAL_ROW_INDEX && focusCol === index ? 'focused' : ''}`}
                style={{ flex: special.width }}
                onClick={() => handleKeyPress(special.key)}
              >
                {special.key === 'shift' ? (isUppercase ? 'abc' : 'ABC') : special.label}
              </button>
            ))}
          </div>
        </div>

        <p className="tv-keyboard-hint">Use arrow keys to navigate, Enter to select, Back to close</p>
      </div>
    </div>
  );
}

export default TVKeyboard;
