import React, { useEffect, useState, useRef } from 'react';
import { IoGiftOutline, IoAdd, IoRemove } from 'react-icons/io5';
import { TailChase } from 'ldrs/react';
import 'ldrs/react/TailChase.css';
import { useTVKeyboard } from '../../context/TVKeyboardContext';
import './TVTipOverlay.scss';

const TVTipOverlay = ({
  isOpen,
  onClose,
  onTip,
  isLoading,
  hiveAuthMessage,
  creatorName = 'creator'
}) => {
  // Focus index: 0 = amount row (-, value, +, asset), 1 = memo field, 2 = tip button
  const [focusIndex, setFocusIndex] = useState(0);
  // Sub-focus for amount row: 0 = minus, 1 = value, 2 = plus, 3 = asset toggle
  const [amountSubFocus, setAmountSubFocus] = useState(1);
  const [amount, setAmount] = useState(1.0);
  const [asset, setAsset] = useState('HIVE');
  const [memo, setMemo] = useState('');
  const overlayRef = useRef(null);
  const { openKeyboard } = useTVKeyboard();

  // Amount step values
  const STEP = 0.5;
  const MIN_AMOUNT = 0.5;
  const MAX_AMOUNT = 10000;

  // Reset state when overlay opens
  useEffect(() => {
    if (isOpen) {
      setFocusIndex(0);
      setAmountSubFocus(1);
      setAmount(1.0);
      setAsset('HIVE');
      setMemo('');
    }
  }, [isOpen]);

  const decreaseAmount = () => {
    setAmount(prev => Math.max(MIN_AMOUNT, parseFloat((prev - STEP).toFixed(3))));
  };

  const increaseAmount = () => {
    setAmount(prev => Math.min(MAX_AMOUNT, parseFloat((prev + STEP).toFixed(3))));
  };

  const toggleAsset = () => {
    setAsset(prev => prev === 'HIVE' ? 'HBD' : 'HIVE');
  };

  const openMemoKeyboard = () => {
    openKeyboard(memo, (newMemo) => {
      setMemo(newMemo);
    }, 'Enter memo (optional)');
  };

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      switch (event.keyCode) {
        case 37: // Left arrow
          if (focusIndex === 0) {
            // Navigate within amount row
            if (amountSubFocus > 0) {
              setAmountSubFocus(amountSubFocus - 1);
            }
          }
          event.preventDefault();
          event.stopPropagation();
          break;

        case 39: // Right arrow
          if (focusIndex === 0) {
            // Navigate within amount row
            if (amountSubFocus < 3) {
              setAmountSubFocus(amountSubFocus + 1);
            }
          }
          event.preventDefault();
          event.stopPropagation();
          break;

        case 38: // Up arrow
          if (focusIndex > 0) {
            setFocusIndex(focusIndex - 1);
          }
          event.preventDefault();
          event.stopPropagation();
          break;

        case 40: // Down arrow
          if (focusIndex < 2) {
            setFocusIndex(focusIndex + 1);
          }
          event.preventDefault();
          event.stopPropagation();
          break;

        case 13: // Enter
          if (focusIndex === 0) {
            // Handle amount row actions
            if (amountSubFocus === 0) {
              decreaseAmount();
            } else if (amountSubFocus === 2) {
              increaseAmount();
            } else if (amountSubFocus === 3) {
              toggleAsset();
            } else {
              // On value, move to next row
              setFocusIndex(1);
            }
          } else if (focusIndex === 1) {
            // Open keyboard for memo
            openMemoKeyboard();
          } else if (focusIndex === 2 && !isLoading) {
            // Trigger tip
            onTip(amount, asset, memo);
          }
          event.preventDefault();
          event.stopPropagation();
          break;

        case 10009: // Samsung TV Back
        case 27: // Escape
          onClose();
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
  }, [isOpen, focusIndex, amountSubFocus, amount, asset, memo, onClose, onTip, isLoading, openKeyboard]);

  if (!isOpen) return null;

  return (
    <div className="tv-tip-overlay" ref={overlayRef}>
      <div className="tv-tip-modal">
        <h2>Tip @{creatorName}</h2>

        {/* Amount Row with +/- buttons and asset */}
        <div className={`amount-row${focusIndex === 0 ? ' focused' : ''}`}>
          <button
            className={`amount-btn minus${focusIndex === 0 && amountSubFocus === 0 ? ' sub-focused' : ''}`}
            onClick={decreaseAmount}
          >
            <IoRemove size={28} />
          </button>

          <div className={`amount-value${focusIndex === 0 && amountSubFocus === 1 ? ' sub-focused' : ''}`}>
            {amount.toFixed(3)}
          </div>

          <button
            className={`amount-btn plus${focusIndex === 0 && amountSubFocus === 2 ? ' sub-focused' : ''}`}
            onClick={increaseAmount}
          >
            <IoAdd size={28} />
          </button>

          <button
            className={`asset-toggle${focusIndex === 0 && amountSubFocus === 3 ? ' sub-focused' : ''}`}
            onClick={toggleAsset}
          >
            {asset}
          </button>
        </div>

        <div className="row-hint">
          {focusIndex === 0 && '← → to navigate, Enter to select'}
        </div>

        {/* Memo Field */}
        <div
          className={`memo-field${focusIndex === 1 ? ' focused' : ''}`}
          onClick={openMemoKeyboard}
        >
          <span className="memo-label">Memo:</span>
          <span className="memo-value">{memo || '(optional)'}</span>
        </div>

        <div className="row-hint">
          {focusIndex === 1 && 'Enter to type memo'}
          {focusIndex === 2 && 'Enter to send tip'}
        </div>

        {/* Send Button */}
        <button
          className={`tip-button${focusIndex === 2 ? ' focused' : ''}`}
          onClick={() => onTip(amount, asset, memo)}
          disabled={isLoading}
        >
          {isLoading ? (
            <TailChase size="20" speed="1.5" color="white" />
          ) : (
            <>
              <IoGiftOutline size={24} />
              <span>Send {amount.toFixed(3)} {asset}</span>
            </>
          )}
        </button>

        {hiveAuthMessage && (
          <div className="hiveauth-waiting">
            <TailChase size="16" speed="1.5" color="#e31337" />
            <span>{hiveAuthMessage}</span>
          </div>
        )}

        <p className="close-hint">Press Back to close</p>
      </div>
    </div>
  );
};

export default TVTipOverlay;
