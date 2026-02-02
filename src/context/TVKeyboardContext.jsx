import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import TVKeyboard from '../components/tv/TVKeyboard';
import { useTVMode } from './TVModeContext';

const TVKeyboardContext = createContext(null);

export const TVKeyboardProvider = ({ children }) => {
  const { isTVMode } = useTVMode();
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState('');
  const [placeholder, setPlaceholder] = useState('');
  const [targetInput, setTargetInput] = useState(null);
  const [onChangeCallback, setOnChangeCallback] = useState(null);
  const [onSubmitCallback, setOnSubmitCallback] = useState(null);

  // Open keyboard with callbacks
  const openKeyboard = useCallback((options = {}) => {
    console.log('[TVKeyboardContext] openKeyboard called with options:', options);
    const {
      initialValue = '',
      placeholder: ph = 'Type here...',
      onChange,
      onSubmit,
      inputElement,
    } = options;

    console.log('[TVKeyboardContext] onSubmit provided:', !!onSubmit);
    setValue(initialValue);
    setPlaceholder(ph);
    setTargetInput(inputElement);
    setOnChangeCallback(() => onChange);
    setOnSubmitCallback(() => onSubmit);
    setIsOpen(true);
  }, []);

  const closeKeyboard = useCallback(() => {
    setIsOpen(false);
    // If there's a target input, update its value
    if (targetInput && value) {
      // Create and dispatch input event
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;
      const nativeTextareaValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      )?.set;

      if (targetInput.tagName === 'INPUT' && nativeInputValueSetter) {
        nativeInputValueSetter.call(targetInput, value);
      } else if (targetInput.tagName === 'TEXTAREA' && nativeTextareaValueSetter) {
        nativeTextareaValueSetter.call(targetInput, value);
      }

      // Dispatch change event
      targetInput.dispatchEvent(new Event('input', { bubbles: true }));
      targetInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    setTargetInput(null);
  }, [targetInput, value]);

  const handleChange = useCallback((newValue) => {
    setValue(newValue);
    if (onChangeCallback) {
      onChangeCallback(newValue);
    }
  }, [onChangeCallback]);

  const handleSubmit = useCallback((finalValue) => {
    console.log('[TVKeyboardContext] handleSubmit called with:', finalValue);
    console.log('[TVKeyboardContext] onSubmitCallback exists:', !!onSubmitCallback);
    if (onSubmitCallback) {
      console.log('[TVKeyboardContext] Calling onSubmitCallback...');
      onSubmitCallback(finalValue);
    }
    closeKeyboard();
  }, [onSubmitCallback, closeKeyboard]);

  // Listen for Enter key on focused inputs in TV mode
  useEffect(() => {
    if (!isTVMode) return;

    const handleKeyDown = (e) => {
      // Only intercept Enter on input fields when keyboard is not already open
      if (e.keyCode === 13 && !isOpen) {
        const activeEl = document.activeElement;
        const tagName = activeEl?.tagName?.toLowerCase();

        // Check if active element is an input or textarea
        if (tagName === 'input' || tagName === 'textarea') {
          // Don't intercept submit buttons
          if (activeEl.type === 'submit' || activeEl.type === 'button') {
            return;
          }

          // Don't intercept if it's already using TVTextInput
          if (activeEl.closest('.tv-text-input-display')) {
            return;
          }

          // Don't intercept if this element has custom keyboard handling (like comment section)
          if (activeEl.closest('[data-tv-custom-keyboard="true"]')) {
            return;
          }

          e.preventDefault();
          e.stopPropagation();

          openKeyboard({
            initialValue: activeEl.value || '',
            placeholder: activeEl.placeholder || 'Type here...',
            inputElement: activeEl,
          });
        }
      }
    };

    // Use capture phase to intercept before other handlers
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isTVMode, isOpen, openKeyboard]);

  return (
    <TVKeyboardContext.Provider value={{ openKeyboard, closeKeyboard, isOpen }}>
      {children}
      {isTVMode && (
        <TVKeyboard
          isOpen={isOpen}
          onClose={closeKeyboard}
          value={value}
          onChange={handleChange}
          onSubmit={handleSubmit}
          placeholder={placeholder}
        />
      )}
    </TVKeyboardContext.Provider>
  );
};

export const useTVKeyboard = () => {
  const context = useContext(TVKeyboardContext);
  if (!context) {
    throw new Error('useTVKeyboard must be used within a TVKeyboardProvider');
  }
  return context;
};
