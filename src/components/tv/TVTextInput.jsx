import React, { useState, useCallback } from 'react';
import { useTVMode } from '../../context/TVModeContext';
import TVKeyboard from './TVKeyboard';
import './TVTextInput.scss';

/**
 * TV-friendly text input that opens an on-screen keyboard
 * Falls back to regular input on non-TV mode
 */
function TVTextInput({
  value,
  onChange,
  onSubmit,
  placeholder = 'Type here...',
  className = '',
  multiline = false,
  focusedClassName = '',
  isFocused = false,
}) {
  const { isTVMode } = useTVMode();
  const [showKeyboard, setShowKeyboard] = useState(false);

  const handleClick = useCallback(() => {
    if (isTVMode) {
      setShowKeyboard(true);
    }
  }, [isTVMode]);

  const handleKeyDown = useCallback((e) => {
    if (isTVMode && e.keyCode === 13) { // Enter
      e.preventDefault();
      e.stopPropagation();
      setShowKeyboard(true);
    }
  }, [isTVMode]);

  // In TV mode, show a display-only div that opens keyboard
  if (isTVMode) {
    return (
      <>
        <div
          className={`tv-text-input-display ${className} ${isFocused ? focusedClassName || 'tv-focused' : ''}`}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          {value || <span className="tv-text-placeholder">{placeholder}</span>}
        </div>
        <TVKeyboard
          isOpen={showKeyboard}
          onClose={() => setShowKeyboard(false)}
          value={value}
          onChange={onChange}
          onSubmit={(val) => {
            if (onSubmit) onSubmit(val);
          }}
          placeholder={placeholder}
        />
      </>
    );
  }

  // Non-TV mode: regular input/textarea
  if (multiline) {
    return (
      <textarea
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    );
  }

  return (
    <input
      type="text"
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onSubmit) {
          onSubmit(value);
        }
      }}
    />
  );
}

export default TVTextInput;
