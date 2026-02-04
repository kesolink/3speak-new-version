import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTVMode } from '../../context/TVModeContext';
import './TVCommentContextMenu.scss';

/**
 * TV Context Menu for comments
 * Shows options: View Profile, Vote, Reply
 */
function TVCommentContextMenu({
  isOpen,
  onClose,
  onViewProfile,
  onVote,
  onReply,
  commentAuthor = ''
}) {
  const { isTVMode } = useTVMode();
  const navigate = useNavigate();
  const [focusedIndex, setFocusedIndex] = useState(0);

  const menuItems = [
    {
      id: 'profile',
      label: `View @${commentAuthor}'s profile`,
      icon: '👤',
      action: () => {
        onClose();
        navigate(`/p/${commentAuthor}`);
      }
    },
    {
      id: 'vote',
      label: 'Vote on this comment',
      icon: '👍',
      action: onVote
    },
    {
      id: 'reply',
      label: 'Reply to this comment',
      icon: '💬',
      action: onReply
    }
  ];

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen || !isTVMode) return;

    const handleKeyDown = (event) => {
      // Always stop propagation when menu is open to prevent background navigation
      event.preventDefault();
      event.stopPropagation();

      switch (event.keyCode) {
        case 38: // Up
          setFocusedIndex(prev => prev > 0 ? prev - 1 : menuItems.length - 1);
          break;

        case 40: // Down
          setFocusedIndex(prev => prev < menuItems.length - 1 ? prev + 1 : 0);
          break;

        case 13: // Enter
          const selectedItem = menuItems[focusedIndex];
          if (selectedItem?.action) {
            selectedItem.action();
          }
          break;

        case 10009: // Samsung Back
        case 27: // Escape
        case 10135: // Samsung Tools/More
        case 457: // Info key
          onClose();
          break;

        default:
          break;
      }
    };

    // Use capture phase to intercept before other handlers
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, isTVMode, focusedIndex, menuItems, onClose]);

  // Reset focus when menu opens
  useEffect(() => {
    if (isOpen) {
      setFocusedIndex(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="tv-comment-context-menu-overlay" onClick={onClose}>
      <div className="tv-comment-context-menu" onClick={e => e.stopPropagation()}>
        <h3>Comment Options</h3>
        <ul className="tv-comment-context-menu-items">
          {menuItems.map((item, index) => (
            <li
              key={item.id}
              className={`tv-comment-context-menu-item ${focusedIndex === index ? 'tv-focused' : ''}`}
              onClick={() => {
                if (item.action) item.action();
              }}
            >
              <span className="tv-comment-context-menu-icon">{item.icon}</span>
              <span className="tv-comment-context-menu-label">{item.label}</span>
            </li>
          ))}
        </ul>
        <div className="tv-comment-context-menu-hint">
          Press Back to close
        </div>
      </div>
    </div>
  );
}

export default TVCommentContextMenu;
