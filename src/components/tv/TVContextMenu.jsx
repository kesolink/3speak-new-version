import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTVMode } from '../../context/TVModeContext';
import './TVContextMenu.scss';

/**
 * TV Context Menu component for the Watch page
 * Shows options like follow/unfollow, vote, comment, expand description, browse tags
 */
function TVContextMenu({
  isOpen,
  onClose,
  onFollow,
  onVote,
  onTip,
  onJumpToComment,
  onExpandDescription,
  isFollowing = false,
  creatorName = 'creator',
  tags = []
}) {
  const { isTVMode } = useTVMode();
  const navigate = useNavigate();
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [showTagBrowser, setShowTagBrowser] = useState(false);
  const [tagFocusIndex, setTagFocusIndex] = useState(0);

  // Filter out empty/invalid tags
  const validTags = tags.filter(tag => tag && typeof tag === 'string' && tag.trim());

  const menuItems = [
    {
      id: 'follow',
      label: isFollowing ? `Unfollow @${creatorName}` : `Follow @${creatorName}`,
      icon: isFollowing ? '👤' : '➕',
      action: onFollow
    },
    {
      id: 'vote',
      label: 'Vote this video',
      icon: '👍',
      action: onVote
    },
    {
      id: 'tip',
      label: `Tip @${creatorName}`,
      icon: '🎁',
      action: onTip
    },
    {
      id: 'comment',
      label: 'Write a comment',
      icon: '💬',
      action: onJumpToComment
    },
    {
      id: 'description',
      label: 'Show description',
      icon: '📄',
      action: onExpandDescription
    },
    // Only show browse tags if there are tags
    ...(validTags.length > 0 ? [{
      id: 'tags',
      label: 'Browse Tags',
      icon: '#',
      action: () => {
        setShowTagBrowser(true);
        setTagFocusIndex(0);
      }
    }] : [])
  ];

  // Handle tag selection
  const handleTagSelect = useCallback((tag) => {
    onClose();
    navigate(`/t/${tag}`);
  }, [navigate, onClose]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen || !isTVMode) return;

    const handleKeyDown = (event) => {
      // Handle tag browser navigation
      if (showTagBrowser) {
        switch (event.keyCode) {
          case 37: // Left - previous tag (wrap)
          case 38: // Up - also previous tag (wrap)
            setTagFocusIndex(prev => prev > 0 ? prev - 1 : validTags.length - 1);
            event.preventDefault();
            event.stopPropagation();
            return;

          case 39: // Right - next tag (wrap)
          case 40: // Down - also next tag (wrap)
            setTagFocusIndex(prev => prev < validTags.length - 1 ? prev + 1 : 0);
            event.preventDefault();
            event.stopPropagation();
            return;

          case 13: // Enter - select tag
            if (validTags[tagFocusIndex]) {
              handleTagSelect(validTags[tagFocusIndex]);
            }
            event.preventDefault();
            event.stopPropagation();
            return;

          case 10009: // Samsung Back
          case 27: // Escape
            // Go back to options menu, don't close the whole menu
            setShowTagBrowser(false);
            event.preventDefault();
            event.stopPropagation();
            return;

          default:
            return;
        }
      }

      // Handle main menu navigation
      switch (event.keyCode) {
        case 38: // Up
          setFocusedIndex(prev => prev > 0 ? prev - 1 : menuItems.length - 1);
          event.preventDefault();
          event.stopPropagation();
          break;

        case 40: // Down
          setFocusedIndex(prev => prev < menuItems.length - 1 ? prev + 1 : 0);
          event.preventDefault();
          event.stopPropagation();
          break;

        case 13: // Enter
          const selectedItem = menuItems[focusedIndex];
          if (selectedItem?.action) {
            selectedItem.action();
            // Don't close if opening tag browser
            if (selectedItem.id !== 'tags') {
              onClose();
            }
          }
          event.preventDefault();
          event.stopPropagation();
          break;

        case 10009: // Samsung Back
        case 27: // Escape
        case 10135: // Samsung Tools/More (close menu)
        case 457: // Info key
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
  }, [isOpen, isTVMode, focusedIndex, menuItems, onClose, showTagBrowser, tagFocusIndex, validTags, handleTagSelect]);

  // Reset focus when menu opens
  useEffect(() => {
    if (isOpen) {
      setFocusedIndex(0);
      setShowTagBrowser(false);
      setTagFocusIndex(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="tv-context-menu-overlay" onClick={onClose}>
      <div className="tv-context-menu" onClick={e => e.stopPropagation()}>
        {showTagBrowser ? (
          // Tag browser view
          <>
            <h3>Browse Tags</h3>
            <div className="tv-tag-browser">
              <div className="tv-tag-browser-hint">
                Use Left/Right to navigate, Enter to select
              </div>
              <div className="tv-tag-list">
                {validTags.map((tag, index) => (
                  <span
                    key={tag}
                    className={`tv-tag ${tagFocusIndex === index ? 'tv-focused' : ''}`}
                    onClick={() => handleTagSelect(tag)}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
              <div className="tv-tag-browser-counter">
                {tagFocusIndex + 1} / {validTags.length}
              </div>
            </div>
            <div className="tv-context-menu-hint">
              Press Back to go back
            </div>
          </>
        ) : (
          // Main menu view
          <>
            <h3>Options</h3>
            <ul className="tv-context-menu-items">
              {menuItems.map((item, index) => (
                <li
                  key={item.id}
                  className={`tv-context-menu-item ${focusedIndex === index ? 'tv-focused' : ''}`}
                  onClick={() => {
                    if (item.action) item.action();
                    if (item.id !== 'tags') onClose();
                  }}
                >
                  <span className="tv-context-menu-icon">{item.icon}</span>
                  <span className="tv-context-menu-label">{item.label}</span>
                </li>
              ))}
            </ul>
            <div className="tv-context-menu-hint">
              Press Back to close
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default TVContextMenu;
